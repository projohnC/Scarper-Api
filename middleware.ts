import { NextRequest, NextResponse } from "next/server";

// Read CORS configuration from environment variables
const ALLOWED_ORIGINS = process.env.CORS_ALLOWED_ORIGINS || "*"; // comma-separated list or *
const ALLOWED_METHODS = process.env.CORS_ALLOWED_METHODS || "GET,POST,OPTIONS";
const ALLOWED_HEADERS = process.env.CORS_ALLOWED_HEADERS || "Content-Type,x-api-key";

function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS === "*") return true;

  const allowedOrigins = ALLOWED_ORIGINS.split(",").map((item) => item.trim());
  return allowedOrigins.includes(origin);
}

function applyCorsHeaders(response: NextResponse, origin: string | null): NextResponse {
  if (isOriginAllowed(origin)) {
    response.headers.set("Access-Control-Allow-Origin", ALLOWED_ORIGINS === "*" ? "*" : (origin as string));
  }

  response.headers.set("Access-Control-Allow-Methods", ALLOWED_METHODS);
  response.headers.set("Access-Control-Allow-Headers", ALLOWED_HEADERS);
  response.headers.append("Vary", "Origin");

  return response;
}

export function middleware(req: NextRequest) {
  // Only apply to API routes
  if (!req.nextUrl.pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  const origin = req.headers.get("origin");

  // Handle preflight OPTIONS requests
  if (req.method === "OPTIONS") {
    const response = new NextResponse(null, { status: 204 });
    response.headers.set("Access-Control-Max-Age", "86400"); // cache preflight for 1 day
    return applyCorsHeaders(response, origin);
  }

  // Actual request
  const response = NextResponse.next();
  return applyCorsHeaders(response, origin);
}

// Only apply to API routes
export const config = {
  matcher: "/api/:path*",
};
