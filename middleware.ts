import { NextRequest, NextResponse } from "next/server";

// Read CORS configuration from environment variables
const ALLOWED_ORIGINS = process.env.CORS_ALLOWED_ORIGINS || "*"; // comma-separated list or *
const ALLOWED_METHODS = process.env.CORS_ALLOWED_METHODS || "GET,POST,OPTIONS";
const ALLOWED_HEADERS = process.env.CORS_ALLOWED_HEADERS || "Content-Type,x-api-key";

// Helper to check if origin is allowed
function isOriginAllowed(origin: string | null) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS === "*") return true;
  const allowed = ALLOWED_ORIGINS.split(",").map((o) => o.trim());
  return allowed.includes(origin);
}

export function middleware(req: NextRequest) {
  // Only apply to API routes
  if (!req.nextUrl.pathname.startsWith("/api")) return NextResponse.next();

  const origin = req.headers.get("origin") || "";

  // Handle preflight OPTIONS requests
  if (req.method === "OPTIONS") {
    const res = new NextResponse(null, { status: 204 });
    res.headers.set("Access-Control-Allow-Origin", isOriginAllowed(origin) ? origin : "");
    res.headers.set("Access-Control-Allow-Methods", ALLOWED_METHODS);
    res.headers.set("Access-Control-Allow-Headers", ALLOWED_HEADERS);
    res.headers.set("Access-Control-Max-Age", "86400"); // cache preflight for 1 day
    return res;
  }

  // Actual request
  const res = NextResponse.next();
  res.headers.set("Access-Control-Allow-Origin", isOriginAllowed(origin) ? origin : "");
  res.headers.set("Access-Control-Allow-Methods", ALLOWED_METHODS);
  res.headers.set("Access-Control-Allow-Headers", ALLOWED_HEADERS);

  return res;
}

// Only apply to API routes
export const config = {
  matcher: "/api/:path*",
};