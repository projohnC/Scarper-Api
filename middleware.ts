import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { redis } from "@/lib/redis"; // Make sure you have this lib
import { db } from "@/lib/db";
import { apiKey } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function middleware(request: NextRequest) {
  // 1. Get Key from headers
  const key = request.headers.get("x-api-key");
  if (!key) return new NextResponse("Unauthorized", { status: 401 });

  // 2. Check Upstash Redis first (Speed!)
  const usageKey = `usage:${key}`;
  const currentUsage = await redis.get<number>(usageKey) || 0;

  // 3. Get Quota from Neon (Cached in Redis for 1 hour)
  const quotaCacheKey = `quota_limit:${key}`;
  let quota = await redis.get<number>(quotaCacheKey);

  if (!quota) {
    const dbKey = await db.query.apiKey.findFirst({
      where: eq(apiKey.key, key),
    });
    quota = dbKey?.requestQuota || 500;
    await redis.set(quotaCacheKey, quota, { ex: 3600 });
  }

  // 4. Enforce the limit
  if (currentUsage >= quota) {
    return new NextResponse("Quota Exceeded", { status: 429 });
  }

  // 5. Increment usage
  await redis.incr(usageKey);
  
  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*", // Protects all API routes
};
