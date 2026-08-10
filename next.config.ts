import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3"],
  // Lets self-hosters serve Hestia from a subpath (e.g. a reverse proxy at
  // example.com/hestia/) — unset by default, which serves from the domain
  // root as before. See BASE_PATH in .env.example.
  basePath: process.env.BASE_PATH || undefined,
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
