import { NextRequest, NextResponse } from "next/server";
import { validateProviderAccess, createProviderErrorResponse } from "@/lib/provider-validator";
import { searchContent } from "@/lib/hdhub4u";

const HDHUB4U_FALLBACK_BASE_URL = "https://new3.hdhub4u.fo";

function toAbsolutePostUrl(url: string): string {
  const baseUrl = (process.env.HDHUB4U_BASE || HDHUB4U_FALLBACK_BASE_URL).replace(/\/$/, "");

  if (!url) {
    return url;
  }

  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url.replace(/\/$/, "");
  }

  const normalizedPath = url.startsWith("/") ? url : `/${url}`;
  return `${baseUrl}${normalizedPath}`.replace(/\/$/, "");
}

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
    const normalizedResults = results.map((result) => ({
      ...result,
      url: toAbsolutePostUrl(result.url),
    }));
    const pageNumber = parseInt(page) || 1;

    return NextResponse.json({
      success: true,
      data: {
        query,
        page: pageNumber,
        results: normalizedResults,
        totalResults: normalizedResults.length,
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
