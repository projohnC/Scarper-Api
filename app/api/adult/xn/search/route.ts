import { NextRequest, NextResponse } from "next/server";
import { validateProviderAccess, createProviderErrorResponse } from "@/lib/provider-validator";

const API_BASE_URL = "https://xs-bice.vercel.app/api/xnxx/search";

export async function GET(req: NextRequest) {
  const validation = await validateProviderAccess(req, "Adult");
  if (!validation.valid) {
    return createProviderErrorResponse(validation.error || "Unauthorized");
  }

  try {
    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get("q");
    
    if (!query) {
      return NextResponse.json(
        { success: false, error: "Query parameter 'q' is required" },
        { status: 400 }
      );
    }
    
    // Construct API URL with query parameter
    const apiUrl = `${API_BASE_URL}?q=${encodeURIComponent(query)}`;
    
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
    console.error("Error searching XNXX:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
