import { NextRequest, NextResponse } from "next/server";

const ALLOWED_ORIGINS = process.env.CORS_ALLOWED_ORIGINS || "*"; // e.g. "https://www.filetolink.in,https://filetolink.in"
const ALLOWED_METHODS = process.env.CORS_ALLOWED_METHODS || "GET,POST,OPTIONS";
const ALLOWED_HEADERS = process.env.CORS_ALLOWED_HEADERS || "Content-Type,x-api-key,Authorization,Accept";

function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS === "*") return true;

  const allowed = ALLOWED_ORIGINS.split(",").map((o) => o.trim().toLowerCase());
  return allowed.includes(origin.toLowerCase());
}

function applyCorsHeaders(response: NextResponse, origin: string | null): NextResponse {
  if (origin && isOriginAllowed(origin)) {
    response.headers.set(
      "Access-Control-Allow-Origin",
      ALLOWED_ORIGINS === "*" ? "*" : origin
    );
  }
  response.headers.set("Access-Control-Allow-Methods", ALLOWED_METHODS);
  response.headers.set("Access-Control-Allow-Headers", ALLOWED_HEADERS);
  response.headers.set("Access-Control-Max-Age", "86400"); // cache preflight 24h
  response.headers.append("Vary", "Origin");

  // Optional: if you ever need credentials (cookies, auth)
  // response.headers.set("Access-Control-Allow-Credentials", "true");

  return response;
}

export function middleware(req: NextRequest) {
  // Skip non-API routes
  if (!req.nextUrl.pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  const origin = req.headers.get("origin");

  // Handle preflight OPTIONS – respond early with 204
  if (req.method === "OPTIONS") {
    const response = new NextResponse(null, { status: 204 });
    return applyCorsHeaders(response, origin);
  }

  // For normal requests: proceed + add CORS headers to the final response
  const response = NextResponse.next();
  return applyCorsHeaders(response, origin);
}

export const config = {
  matcher: ["/api/:path*"], // only apply to /api/*
};
