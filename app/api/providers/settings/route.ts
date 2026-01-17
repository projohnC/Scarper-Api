import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { userSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  updateUserProviders,
  getUserEnabledProviders,
  getDefaultProviders,
  ProviderName,
} from "@/lib/provider-cache";

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const settings = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, session.user.id))
      .limit(1);

    let enabledProviders: ProviderName[];
    
    if (settings.length > 0 && settings[0].enabledProviders) {
      enabledProviders = settings[0].enabledProviders as unknown as ProviderName[];
      await updateUserProviders(session.user.id, enabledProviders);
    } else {
      enabledProviders = await getDefaultProviders();
    }

    return NextResponse.json({ enabledProviders });
  } catch (error) {
    console.error("Error fetching provider settings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { enabledProviders, adultConsent } = body;

    if (!Array.isArray(enabledProviders)) {
      return NextResponse.json(
        { error: "enabledProviders must be an array" },
        { status: 400 }
      );
    }

    const allProviders = await import("@/lib/provider-cache").then(m => m.ALL_PROVIDERS);
    const validProviders = enabledProviders.filter((p: string) =>
      allProviders.includes(p as ProviderName)
    );

    const existingSettings = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, session.user.id))
      .limit(1);

    const updateData: {
      enabledProviders: unknown;
      updatedAt: Date;
      adultEnabled?: boolean;
      adultConsentAt?: Date;
    } = {
      enabledProviders: validProviders as unknown as null,
      updatedAt: new Date(),
    };

    if (adultConsent === true) {
      updateData.adultEnabled = true;
      updateData.adultConsentAt = new Date();
    }

    if (existingSettings.length > 0) {
      await db
        .update(userSettings)
        .set(updateData)
        .where(eq(userSettings.userId, session.user.id));
    } else {
      await db.insert(userSettings).values({
        id: `settings_${session.user.id}`,
        userId: session.user.id,
        ...updateData,
      });
    }

    await updateUserProviders(session.user.id, validProviders as ProviderName[]);

    return NextResponse.json({
      success: true,
      enabledProviders: validProviders,
    });
  } catch (error) {
    console.error("Error updating provider settings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
