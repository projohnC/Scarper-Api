import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { sendLoginNotification, sendQuotaWarningEmail } from "@/lib/email-service";
import { db } from "@/lib/db";
import { apiKey, user } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// Test endpoint to send login notification
export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { type } = body;

    // Get user data
    const [userData] = await db
      .select()
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1);

    if (!userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get API key data
    const [apiKeyData] = await db
      .select()
      .from(apiKey)
      .where(eq(apiKey.userId, session.user.id))
      .limit(1);

    if (type === "login") {
      // Test login notification
      const result = await sendLoginNotification({
        email: userData.email,
        userName: userData.name,
        loginTime: new Date().toLocaleString('en-US', {
          dateStyle: 'full',
          timeStyle: 'long',
        }),
        ipAddress: req.headers.get('x-forwarded-for') || 'Test IP',
        userAgent: req.headers.get('user-agent') || 'Test Browser',
        requestCount: userData.totalRequestCount,
        requestQuota: userData.totalRequestQuota,
      });

      return NextResponse.json({
        success: result.success,
        message: result.success 
          ? "Login notification sent successfully!"
          : "Failed to send login notification",
        data: result,
      });
    }

    if (type === "quota") {
      // Test quota warning
      const usagePercentage = Math.round(
        (userData.totalRequestCount / userData.totalRequestQuota) * 100
      );

      const result = await sendQuotaWarningEmail({
        email: userData.email,
        userName: userData.name,
        requestCount: userData.totalRequestCount,
        requestQuota: userData.totalRequestQuota,
        usagePercentage,
        quotaResetDate: userData.quotaResetAt?.toLocaleDateString() || 'Not set',
      });

      return NextResponse.json({
        success: result.success,
        message: result.success 
          ? "Quota warning email sent successfully!"
          : "Failed to send quota warning email",
        data: result,
      });
    }

    return NextResponse.json({
      error: "Invalid type. Use 'login' or 'quota'",
    }, { status: 400 });

  } catch (error) {
    console.error("Error sending test email:", error);
    return NextResponse.json(
      { error: "Failed to send test email" },
      { status: 500 }
    );
  }
}
