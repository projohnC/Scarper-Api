import { NextRequest, NextResponse } from "next/server";

// Allowed frontend origins
const ALLOWED_ORIGINS = (process.env.CORS_ALLOWED_ORIGINS || "")
  .split(",")
  .map(o => o.trim().toLowerCase());

const ALLOWED_METHODS = process.env.CORS_ALLOWED_METHODS || "GET,POST,OPTIONS";
const ALLOWED_HEADERS = process.env.CORS_ALLOWED_HEADERS || "Content-Type,x-api-key,Authorization,Accept";

function isOriginAllowed(origin: string | null) {
  if (!origin) return false;
  return ALLOWED_ORIGINS.includes(origin.toLowerCase());
}

function applyCors(response: NextResponse, origin: string | null) {
  if (origin && isOriginAllowed(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Credentials", "true");
  }
  response.headers.set("Access-Control-Allow-Methods", ALLOWED_METHODS);
  response.headers.set("Access-Control-Allow-Headers", ALLOWED_HEADERS);
  response.headers.set("Access-Control-Max-Age", "86400");
  response.headers.append("Vary", "Origin");
  return response;
}

export function middleware(req: NextRequest) {
  // Only API routes
  if (!req.nextUrl.pathname.startsWith("/api")) return NextResponse.next();

  const origin = req.headers.get("origin");

  // Handle preflight OPTIONS requests
  if (req.method === "OPTIONS") {
    const response = new NextResponse(null, { status: 204 });
    return applyCors(response, origin);
  }

  // Normal requests
  const response = NextResponse.next();
  return applyCors(response, origin);
}

export const config = {
  matcher: ["/api/:path*"],
};
