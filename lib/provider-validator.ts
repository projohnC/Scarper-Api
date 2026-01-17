import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "./api-auth";
import { isProviderEnabled } from "./provider-cache";

export async function validateProviderAccess(
  request: NextRequest,
  providerName: string
): Promise<{ valid: boolean; error?: string; userId?: string }> {
  const validation = await validateApiKey(request);
  
  if (!validation.valid) {
    return {
      valid: false,
      error: validation.error || "Unauthorized",
    };
  }

  if (!validation.keyData?.userId) {
    return {
      valid: false,
      error: "User ID not found",
    };
  }

  const isEnabled = await isProviderEnabled(
    validation.keyData.userId,
    providerName
  );

  if (!isEnabled) {
    return {
      valid: false,
      error: `Provider '${providerName}' is not enabled for this user`,
      userId: validation.keyData.userId,
    };
  }

  return {
    valid: true,
    userId: validation.keyData.userId,
  };
}

export function createProviderErrorResponse(error: string) {
  return NextResponse.json(
    { error },
    { status: 403 }
  );
}
