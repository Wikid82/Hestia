#!/usr/bin/env node
// Computes patch coverage (coverage of only the lines changed vs a git
// baseline) from coverage/lcov.info, mirroring what Codecov's patch status
// check reports — so gaps can be caught and closed locally before pushing,
// instead of finding out from a failed PR check.
//
// Usage: node scripts/check-patch-coverage.mjs [baseline] [--threshold=N]
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const ROOT = new URL("../", import.meta.url).pathname;
const LCOV_PATH = `${ROOT}coverage/lcov.info`;

// Keep in sync with codecov.yml's `ignore` list and vitest.config.ts's
// coverage.exclude — these files aren't gated on, so flagging their added
// lines as "uncovered" here would just be noise.
const IGNORE_PATTERNS = [
  /^src\/app\/.*\/page\.tsx$/,
  /^src\/app\/.*\/layout\.tsx$/,
  /^src\/app\/layout\.tsx$/,
  /^src\/db\/schema\.ts$/,
  /^src\/db\/index\.ts$/,
  /^src\/instrumentation\.ts$/,
  /\.test\.tsx?$/,
  /^src\/test\//,
];

function isIgnored(path) {
  return IGNORE_PATTERNS.some((pattern) => pattern.test(path));
}

function isTracked(path) {
  return (
    (path.endsWith(".ts") || path.endsWith(".tsx")) &&
    path.startsWith("src/") &&
    !isIgnored(path)
  );
}

function parseArgs(argv) {
  let baseline = null;
  let threshold = Number.parseFloat(process.env.HESTIA_MIN_COVERAGE ?? "85");
  for (const arg of argv) {
    if (arg.startsWith("--threshold=")) {
      threshold = Number.parseFloat(arg.slice("--threshold=".length));
    } else if (!arg.startsWith("--")) {
      baseline = arg;
    }
  }
  return { baseline, threshold };
}

function resolveBaseline(explicit) {
  if (explicit) return explicit;

  // Tier 1: ask gh what the current branch's actual open PR base is, so
  // the local diff matches exactly what Codecov compares against.
  try {
    const base = execFileSync(
      "gh",
      ["pr", "view", "--json", "baseRefName", "-q", ".baseRefName"],
      { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 5000 },
    ).trim();
    if (base && refExists(`origin/${base}`)) return `origin/${base}`;
  } catch {
    // gh not available, no PR open, or not authenticated — fall through.
  }

  // Tier 2: static fallback. development is the default integration
  // branch; main is only ever a target for the release-please/nightly
  // promotion flow.
  for (const candidate of ["origin/development", "development", "origin/main", "main"]) {
    if (refExists(candidate)) return candidate;
  }

  throw new Error(
    "Couldn't resolve a baseline ref (tried origin/development, development, origin/main, main). " +
      "Pass one explicitly: node scripts/check-patch-coverage.mjs <baseline>",
  );
}

function refExists(ref) {
  try {
    execFileSync("git", ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`], {
      cwd: ROOT,
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

// Parses `git diff --unified=0 <baseline>...HEAD` into { path -> Set<addedLineNumbers> }.
function parseDiff(baseline) {
  const diff = execFileSync(
    "git",
    ["diff", "--unified=0", "--diff-filter=ACMR", `${baseline}...HEAD`],
    { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );

  const addedByFile = new Map();
  let currentFile = null;
  let newLineCursor = null;

  for (const line of diff.split("\n")) {
    if (line.startsWith("+++ ")) {
      const path = line.slice(4).replace(/^b\//, "");
      currentFile = path === "/dev/null" ? null : path;
      continue;
    }
    if (line.startsWith("@@ ")) {
      const match = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
      if (match) newLineCursor = Number.parseInt(match[1], 10);
      continue;
    }
    if (currentFile === null || newLineCursor === null) continue;

    if (line.startsWith("+") && !line.startsWith("+++")) {
      if (!addedByFile.has(currentFile)) addedByFile.set(currentFile, new Set());
      addedByFile.get(currentFile).add(newLineCursor);
      newLineCursor += 1;
    } else if (!line.startsWith("-")) {
      // Neither +/- (shouldn't happen with --unified=0 outside hunk noise).
    }
    // '-' lines consume no new-line-number.
  }

  return addedByFile;
}

// Parses coverage/lcov.info into { path -> Map<line, hits> }.
function parseLcov(lcovPath) {
  const text = readFileSync(lcovPath, "utf8");
  const hitsByFile = new Map();
  let currentFile = null;

  for (const line of text.split("\n")) {
    if (line.startsWith("SF:")) {
      currentFile = line.slice(3).trim();
      hitsByFile.set(currentFile, new Map());
    } else if (line.startsWith("DA:") && currentFile) {
      const [lineNo, hits] = line.slice(3).split(",").map(Number);
      hitsByFile.get(currentFile).set(lineNo, hits);
    }
  }

  return hitsByFile;
}

function toRepoRelative(lcovPath) {
  // vitest's v8 reporter writes absolute or repo-relative paths depending
  // on version; normalize to repo-relative for matching against git diff paths.
  return lcovPath.startsWith(ROOT) ? lcovPath.slice(ROOT.length) : lcovPath;
}

function main() {
  const { baseline: explicitBaseline, threshold } = parseArgs(process.argv.slice(2));

  if (!existsSync(LCOV_PATH)) {
    console.error(
      `Error: ${LCOV_PATH} not found. Run \`npm run test:coverage\` first.`,
    );
    process.exit(1);
  }

  const baseline = resolveBaseline(explicitBaseline);
  const addedByFile = parseDiff(baseline);
  const rawHitsByFile = parseLcov(LCOV_PATH);
  const hitsByFile = new Map(
    [...rawHitsByFile.entries()].map(([path, hits]) => [toRepoRelative(path), hits]),
  );

  let totalAdded = 0;
  let totalCovered = 0;
  const rows = [];

  for (const [path, addedLines] of addedByFile) {
    if (!isTracked(path)) continue;

    const hits = hitsByFile.get(path);
    const uncovered = [];
    let counted = 0;
    let covered = 0;

    for (const lineNo of [...addedLines].sort((a, b) => a - b)) {
      if (!hits || !hits.has(lineNo)) continue; // not instrumented (blank/brace/comment) — not counted
      counted += 1;
      if (hits.get(lineNo) > 0) {
        covered += 1;
      } else {
        uncovered.push(lineNo);
      }
    }

    if (counted === 0) continue;

    totalAdded += counted;
    totalCovered += covered;
    rows.push({ path, counted, covered, uncovered });
  }

  const pct = totalAdded === 0 ? 100 : (totalCovered / totalAdded) * 100;

  console.log(`Patch coverage vs ${baseline}\n`);
  if (rows.length === 0) {
    console.log("No tracked source lines changed.");
  } else {
    for (const row of rows) {
      const rowPct = ((row.covered / row.counted) * 100).toFixed(1);
      console.log(`  ${row.path}: ${row.covered}/${row.counted} (${rowPct}%)`);
      if (row.uncovered.length > 0) {
        console.log(`    uncovered lines: ${row.uncovered.join(", ")}`);
      }
    }
  }

  console.log(
    `\nTotal: ${totalCovered}/${totalAdded} lines (${pct.toFixed(1)}%) — threshold ${threshold}%`,
  );

  if (pct < threshold) {
    console.error(
      `\nFAIL: patch coverage ${pct.toFixed(1)}% is below the ${threshold}% mandate.`,
    );
    console.error(
      "Add tests for the uncovered lines above before pushing — see /fix-patch-coverage.",
    );
    process.exit(1);
  }

  console.log("\nPASS");
}

main();
