import { NextRequest, NextResponse } from "next/server";
import { validateProviderAccess, createProviderErrorResponse } from "@/lib/provider-validator";
import { searchContent } from "@/lib/hdhub4u";

export async function GET(request: NextRequest) {
  const validation = await validateProviderAccess(request, "HDHub4u");
  if (!validation.valid) {
    return createProviderErrorResponse(validation.error || "Unauthorized");
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q") || searchParams.get("s");
    const page = searchParams.get("page") || "1";

    if (!query) {
      return NextResponse.json(
        { error: "Search query parameter (q or s) is required" },
        { status: 400 }
      );
    }

    const { results, found } = await searchContent(query, page);
    const pageNumber = parseInt(page) || 1;

    return NextResponse.json({
      success: true,
      data: {
        query,
        page: pageNumber,
        results,
        totalResults: results.length,
        found,
      },
    });

  } catch (error) {
    console.error("Error in HDHub4u Search API:", error);
    return NextResponse.json(
      { 
        error: "Internal server error", 
        message: error instanceof Error ? error.message : "Unknown error" 
      },
      { status: 500 }
    );
  }
}
