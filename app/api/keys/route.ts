import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiKey } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { nanoid } from "nanoid";
import { eq, and } from "drizzle-orm";

const ADMIN_KEY = process.env.ADMIN_KEY || "sk_Wv4v8TwKE4muWoxW-2UD8zG0CW_CLT6z";

// Generate API key
function generateApiKey(): string {
  return `sk_${nanoid(32)}`;
}

// GET - List API keys
export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let keys;
    if (session.user.apiKey === ADMIN_KEY) {
      // Admin can see all keys
      keys = await db.select().from(apiKey);
    } else {
      keys = await db
        .select()
        .from(apiKey)
        .where(eq(apiKey.userId, session.user.id));
    }

    // Mask the keys for normal users, admin can see full keys
    const maskedKeys = keys.map(key => {
      if (session.user.apiKey === ADMIN_KEY) return key;
      return { ...key, key: `${key.key.substring(0, 12)}${"*".repeat(20)}` };
    });

    return NextResponse.json(maskedKeys);
  } catch (error) {
    console.error("Error fetching API keys:", error);
    return NextResponse.json({ error: "Failed to fetch API keys" }, { status: 500 });
  }
}

// POST - Create a new API key
export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name } = body;
    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const existingKeys = await db
      .select()
      .from(apiKey)
      .where(eq(apiKey.userId, session.user.id));

    // Normal users can only create one key
    if (existingKeys.length > 0 && session.user.apiKey !== ADMIN_KEY) {
      return NextResponse.json(
        { error: "You can only create one API key." },
        { status: 400 }
      );
    }

    const key = generateApiKey();
    const id = nanoid();

    const newKey = await db
      .insert(apiKey)
      .values({
        id,
        key,
        name,
        userId: session.user.id,
        requestQuota: session.user.apiKey === ADMIN_KEY ? 99999 : 500,
        requestCount: 0,
        isActive: true,
      })
      .returning();

    return NextResponse.json(newKey[0]);
  } catch (error) {
    console.error("Error creating API key:", error);
    return NextResponse.json({ error: "Failed to create API key" }, { status: 500 });
  }
}

// DELETE - Delete an API key
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const keyId = searchParams.get("id");
    if (!keyId) {
      return NextResponse.json({ error: "API key ID is required" }, { status: 400 });
    }

    if (session.user.apiKey === ADMIN_KEY) {
      // Admin can delete any key
      await db.delete(apiKey).where(eq(apiKey.id, keyId));
    } else {
      // Normal users can only delete their own key
      await db
        .delete(apiKey)
        .where(and(eq(apiKey.id, keyId), eq(apiKey.userId, session.user.id)));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting API key:", error);
    return NextResponse.json({ error: "Failed to delete API key" }, { status: 500 });
  }
}
