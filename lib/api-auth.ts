import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiKey, user } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { sendQuotaWarningEmail, shouldSendQuotaWarning, calculateUsagePercentage } from "@/lib/email-service";
import { isAdminUser } from "@/lib/admin";

export async function validateApiKey(
  request: NextRequest
): Promise<{ valid: boolean; error?: string; keyData?: any }> {
  // Try to get API key from different sources
  let key: string | null = null;

  // 1. Check Authorization header
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    key = authHeader.substring(7);
  }

  // 2. Check x-api-key header
  if (!key) {
    key = request.headers.get("x-api-key");
  }

  // 3. Check query parameter
  if (!key) {
    const { searchParams } = new URL(request.url);
    key = searchParams.get("api_key") || searchParams.get("apiKey");
  }

  // 4. Check cookie
  if (!key) {
    key = request.cookies.get("api_key")?.value || null;
  }

  // 5. If no API key provided, try session-based authentication
  if (!key) {
    try {
      const session = await auth.api.getSession({
        headers: await headers(),
      });

      if (session?.user) {
        // Get the user's API key from the database
        const [userKey] = await db
          .select()
          .from(apiKey)
          .where(eq(apiKey.userId, session.user.id))
          .limit(1);

        if (userKey) {
          key = userKey.key;
        }
      }
    } catch (error) {
      // Session check failed, continue without key
    }
  }

  if (!key) {
    return {
      valid: false,
      error: "API key is required. Provide it via Authorization header, x-api-key header, api_key query parameter, api_key cookie, or login to use your account key.",
    };
  }

  try {
    // Validate the API key in database
    const [keyRecord] = await db
      .select()
      .from(apiKey)
      .where(eq(apiKey.key, key))
      .limit(1);

    if (!keyRecord) {
      return {
        valid: false,
        error: "Invalid API key",
      };
    }

    if (!keyRecord.isActive) {
      return {
        valid: false,
        error: "API key is inactive",
      };
    }

// Get user data to check user-level quota
const [userData] = await db
  .select()
  .from(user)
  .where(eq(user.id, keyRecord.userId))
  .limit(1);

if (!userData) {
  return {
    valid: false,
    error: "User not found",
  };
}

const isAdmin = isAdminUser({ id: userData.id, email: userData.email, name: userData.name });
const keyQuota = isAdmin ? Number.POSITIVE_INFINITY : 500;
const userQuota = isAdmin ? Number.POSITIVE_INFINITY : 500;

if (!isAdmin && keyRecord.requestQuota !== 500) {
  await db
    .update(apiKey)
    .set({ requestQuota: 500, updatedAt: new Date() })
    .where(eq(apiKey.id, keyRecord.id));
}

if (!isAdmin && userData.totalRequestQuota !== 500) {
  await db
    .update(user)
    .set({ totalRequestQuota: 500, updatedAt: new Date() })
    .where(eq(user.id, userData.id));
}

// Check key-level quota (skip for admin)
if (!isAdmin && keyRecord.requestCount >= keyQuota) {
  return {
    valid: false,
    error: "API key quota exceeded",
  };
}

// Check user-level quota (skip for admin)
if (!isAdmin && userData.totalRequestCount >= userQuota) {
  return {
    valid: false,
    error: "User quota exceeded. Cannot get more requests by recreating API keys.",
  };
}
    // Increment both key-level and user-level request counts
    const newRequestCount = userData.totalRequestCount + 1;
    
    await Promise.all([
      db
        .update(apiKey)
        .set({
          requestCount: keyRecord.requestCount + 1,
          lastUsedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(apiKey.id, keyRecord.id)),
      db
        .update(user)
        .set({
          totalRequestCount: newRequestCount,
          updatedAt: new Date(),
        })
        .where(eq(user.id, keyRecord.userId))
    ]);

    // Check if we should send quota warning email (90% usage)
    // Only send if we haven't sent one in the last 24 hours
    const shouldSendEmail = !isAdmin && shouldSendQuotaWarning(newRequestCount, userQuota);
    const lastWarningTime = userData.lastQuotaWarningAt?.getTime() || 0;
    const now = new Date().getTime();
    const hoursSinceLastWarning = (now - lastWarningTime) / (1000 * 60 * 60);
    
    if (shouldSendEmail && hoursSinceLastWarning >= 24) {
      const usagePercentage = calculateUsagePercentage(newRequestCount, userQuota);
      
      // Update last warning timestamp
      await db
        .update(user)
        .set({
          lastQuotaWarningAt: new Date(),
        })
        .where(eq(user.id, keyRecord.userId));
      
      // Send email asynchronously without blocking the response
      sendQuotaWarningEmail({
        email: userData.email,
        userName: userData.name,
        requestCount: newRequestCount,
        requestQuota: userQuota,
        usagePercentage,
        quotaResetDate: userData.quotaResetAt?.toLocaleDateString() || 'Not set',
      }).catch(error => {
        console.error('Failed to send quota warning email:', error);
      });
    }

    return {
      valid: true,
      keyData: keyRecord,
    };
  } catch (error) {
    console.error("Error validating API key:", error);
    return {
      valid: false,
      error: "Failed to validate API key",
    };
  }
}

export function createUnauthorizedResponse(error: string) {
  return NextResponse.json(
    {
      success: false,
      error,
      message: "API key authentication failed",
    },
    { status: 401 }
  );
}
