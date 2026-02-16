import { NextRequest, NextResponse } from "next/server";

const DEFAULT_ALLOWED_HEADERS = "Content-Type, Authorization, x-api-key";
const DEFAULT_ALLOWED_METHODS = "GET, POST, PUT, PATCH, DELETE, OPTIONS";

function parseCsv(value?: string): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function resolveAllowedOrigin(requestOrigin: string | null): string {
  const configuredOrigins = parseCsv(process.env.CORS_ALLOWED_ORIGINS);

  if (configuredOrigins.length === 0 || configuredOrigins.includes("*")) {
    return "*";
  }

  if (!requestOrigin) {
    return configuredOrigins[0];
  }

  return configuredOrigins.includes(requestOrigin) ? requestOrigin : "";
}

function withCorsHeaders(request: NextRequest, response: NextResponse): NextResponse {
  const allowedOrigin = resolveAllowedOrigin(request.headers.get("origin"));

  if (!allowedOrigin) {
    return response;
  }

  response.headers.set("Access-Control-Allow-Origin", allowedOrigin);
  response.headers.set(
    "Access-Control-Allow-Methods",
    process.env.CORS_ALLOWED_METHODS || DEFAULT_ALLOWED_METHODS
  );
  response.headers.set(
    "Access-Control-Allow-Headers",
    process.env.CORS_ALLOWED_HEADERS || DEFAULT_ALLOWED_HEADERS
  );
  response.headers.set("Vary", "Origin");

  return response;
}

export function middleware(request: NextRequest) {
  if (request.method === "OPTIONS") {
    const response = new NextResponse(null, { status: 204 });
    return withCorsHeaders(request, response);
  }

  return withCorsHeaders(request, NextResponse.next());
}

export const config = {
  matcher: "/api/:path*",
};
