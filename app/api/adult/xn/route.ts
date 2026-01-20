import { NextRequest, NextResponse } from "next/server";
import { validateProviderAccess, createProviderErrorResponse } from "@/lib/provider-validator";

const API_BASE_URL = "https://xs-bice.vercel.app/api/xnxx/homepage";

export async function GET(req: NextRequest) {
  const validation = await validateProviderAccess(req, "Adult");
  if (!validation.valid) {
    return createProviderErrorResponse(validation.error || "Unauthorized");
  }

  try {
    const searchParams = req.nextUrl.searchParams;
    const page = searchParams.get("page") || "0";
    
    // Construct API URL with page parameter
    const apiUrl = `${API_BASE_URL}?page=${page}`;
    
    const response = await fetch(apiUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: "Failed to fetch data" },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching XNXX homepage:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
