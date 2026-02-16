import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiKey, user } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { nanoid } from "nanoid";
import { eq, and } from "drizzle-orm";
import { getAdminQuota, getDefaultUserQuota, isAdminUser } from "@/lib/admin";


function generateApiKey(): string {
  return `sk_${nanoid(32)}`;
}

export async function GET(_req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = isAdminUser({ id: session.user.id, email: session.user.email });

    const keys = isAdmin
      ? await db.select().from(apiKey)
      : await db.select().from(apiKey).where(eq(apiKey.userId, session.user.id));

    const maskedKeys = keys.map((key) => {
      if (isAdmin) return key;
      return { ...key, key: `${key.key.substring(0, 12)}${"*".repeat(20)}` };
    });

    return NextResponse.json(maskedKeys);
  } catch (error) {
    console.error("Error fetching API keys:", error);
    return NextResponse.json({ error: "Failed to fetch API keys" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = isAdminUser({ id: session.user.id, email: session.user.email });

    const body = await req.json();
    const { name } = body;
    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const existingKeys = await db
      .select()
      .from(apiKey)
      .where(eq(apiKey.userId, session.user.id));

    if (existingKeys.length > 0 && !isAdmin) {
      return NextResponse.json(
        { error: "You can only create one API key." },
        { status: 400 }
      );
    }

    const key = generateApiKey();
    const id = nanoid();
    const defaultUserQuota = getDefaultUserQuota();
    const adminQuota = getAdminQuota();
    const requestQuota = isAdmin ? adminQuota : defaultUserQuota;

    const newKey = await db
      .insert(apiKey)
      .values({
        id,
        key,
        name,
        userId: session.user.id,
        requestQuota,
        requestCount: 0,
        isActive: true,
      })
      .returning();

    if (!isAdmin) {
      await db
        .update(user)
        .set({
          totalRequestQuota: defaultUserQuota,
          updatedAt: new Date(),
        })
        .where(eq(user.id, session.user.id));
    }

    return NextResponse.json(newKey[0]);
  } catch (error) {
    console.error("Error creating API key:", error);
    return NextResponse.json({ error: "Failed to create API key" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = isAdminUser({ id: session.user.id, email: session.user.email });

    const { searchParams } = new URL(req.url);
    const keyId = searchParams.get("id");
    if (!keyId) {
      return NextResponse.json({ error: "API key ID is required" }, { status: 400 });
    }

    if (isAdmin) {
      await db.delete(apiKey).where(eq(apiKey.id, keyId));
    } else {
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
