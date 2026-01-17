import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { handleLoginNotification } from "@/lib/login-handler";

/**
 * Endpoint to send login notification email
 * Called automatically after successful login from client-side
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get IP and user agent from request
    const ipAddress = req.headers.get('x-forwarded-for') || 
                      req.headers.get('x-real-ip') || 
                      'Unknown';
    const userAgent = req.headers.get('user-agent') || 'Unknown';

    // Send login notification
    const result = await handleLoginNotification(
      session.user.id,
      session.user.email,
      session.user.name,
      ipAddress,
      userAgent
    );

    if (result.success) {
      return NextResponse.json({ 
        success: true,
        message: "Login notification sent successfully" 
      });
    } else {
      return NextResponse.json({ 
        success: false,
        message: "Failed to send login notification" 
      }, { status: 500 });
    }
  } catch (error) {
    console.error("Error sending login notification:", error);
    return NextResponse.json(
      { error: "Failed to send login notification" },
      { status: 500 }
    );
  }
}
