import { jwtVerify } from "jose";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/signup"];

function getSecretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET environment variable is not set");
  }
  return new TextEncoder().encode(secret);
}

async function isValid(token: string | undefined) {
  if (!token) return false;
  try {
    await jwtVerify(token, getSecretKey());
    return true;
  } catch {
    return false;
  }
}

// Proxy defaults to the Node.js runtime as of Next.js 16, but this only does
// a lightweight JWT check (no DB query) to avoid doubling up on the real
// authorization that happens in Server Components/Actions via
// requireActiveUser() — that's also where household-scoped data access is
// actually enforced, not here.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  const hasSession = await isValid(
    request.cookies.get("hestia_session")?.value,
  );
  if (!hasSession) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (pathname === "/switch-profile") {
    return NextResponse.next();
  }

  const hasProfile = await isValid(
    request.cookies.get("hestia_profile")?.value,
  );
  if (!hasProfile) {
    return NextResponse.redirect(new URL("/switch-profile", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
