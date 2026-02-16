import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiKey } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { isAdminUser } from "@/lib/admin";

export async function GET(_req: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = isAdminUser({ id: session.user.id, email: session.user.email });

    const keys = await db
      .select()
      .from(apiKey)
      .where(eq(apiKey.userId, session.user.id));

    const totalApiCalls = keys.reduce((sum, key) => sum + key.requestCount, 0);
    const totalQuotaRaw = keys.reduce((sum, key) => sum + key.requestQuota, 0);
    const hasUnlimitedKey = keys.some((key) => key.requestQuota < 0);
    const totalQuota = hasUnlimitedKey ? null : totalQuotaRaw;

    const stats = {
      totalApiCalls,
      totalQuota,
      activeKeys: keys.filter((key) => key.isActive).length,
      successRate:
        !totalQuota || totalQuota <= 0
          ? "0.0"
          : ((totalApiCalls / totalQuota) * 100).toFixed(1),
      lastUsed:
        keys.length > 0 && keys[0].lastUsedAt
          ? new Date(keys[0].lastUsedAt).toISOString()
          : null,
      isAdmin,
      keyLimitText: isAdmin ? "Unlimited keys" : "1 key maximum",
      quotaText: hasUnlimitedKey ? "Unlimited" : `${totalQuotaRaw}`,
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
