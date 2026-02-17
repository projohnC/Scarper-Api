import { NextRequest, NextResponse } from "next/server";

// Allowed frontend origins - default to "*" if not specified
const ALLOWED_ORIGINS = (process.env.CORS_ALLOWED_ORIGINS || "*")
  .split(",")
  .map(o => o.trim().toLowerCase());

const ALLOWED_METHODS = process.env.CORS_ALLOWED_METHODS || "GET,POST,PUT,DELETE,PATCH,OPTIONS";
const ALLOWED_HEADERS = process.env.CORS_ALLOWED_HEADERS || "Content-Type,x-api-key,Authorization,Accept,Origin,X-Requested-With";

function isOriginAllowed(origin: string | null) {
  if (ALLOWED_ORIGINS.includes("*")) return true;
  if (!origin) return false;
  return ALLOWED_ORIGINS.includes(origin.toLowerCase());
}

function applyCors(response: NextResponse, origin: string | null) {
  const isAllowed = isOriginAllowed(origin);

  if (isAllowed) {
    if (origin) {
      // If we allow all origins (*), we must reflect the request origin
      // when Access-Control-Allow-Credentials is true.
      response.headers.set("Access-Control-Allow-Origin", origin);
      response.headers.set("Access-Control-Allow-Credentials", "true");
    } else {
      // For non-browser requests or if origin header is missing
      response.headers.set("Access-Control-Allow-Origin", "*");
    }
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
