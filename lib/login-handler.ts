import { sendLoginNotification } from "./email-service";
import { db } from "./db";
import { apiKey } from "./db/schema";
import { eq } from "drizzle-orm";

/**
 * Send login notification email after successful login
 * This should be called from client-side after successful authentication
 */
export async function handleLoginNotification(
  userId: string,
  userEmail: string,
  userName: string,
  ipAddress?: string,
  userAgent?: string
) {
  try {
    // Get user's API usage stats
    const [apiKeyData] = await db
      .select()
      .from(apiKey)
      .where(eq(apiKey.userId, userId))
      .limit(1);

    const requestCount = apiKeyData?.requestCount || 0;
    const requestQuota = apiKeyData?.requestQuota || 0;

    // Send login notification email asynchronously
    await sendLoginNotification({
      email: userEmail,
      userName: userName,
      loginTime: new Date().toLocaleString('en-US', {
        dateStyle: 'full',
        timeStyle: 'long',
      }),
      ipAddress: ipAddress || 'Unknown',
      userAgent: userAgent || 'Unknown',
      requestCount,
      requestQuota,
    });

    return { success: true };
  } catch (error) {
    console.error('Failed to send login notification:', error);
    // Don't throw error, just log it
    return { success: false, error };
  }
}
