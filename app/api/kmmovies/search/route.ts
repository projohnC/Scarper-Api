import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { getBaseUrl } from "@/lib/baseurl";
import { validateProviderAccess, createProviderErrorResponse } from "@/lib/provider-validator";

interface Movie {
  id: string;
  title: string;
  url: string;
  image: string;
  imageAlt: string;
}

interface KMMoviesSearchResponse {
  success: boolean;
  data?: {
    query: string;
    results: Movie[];
    totalResults: number;
  };
  error?: string;
}

function toAbsoluteUrl(value: string, baseUrl: string): string {
  if (!value) return "";
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return value;
  }
}

export async function GET(request: NextRequest) {
  const validation = await validateProviderAccess(request, "KMMovies");
  if (!validation.valid) {
    return createProviderErrorResponse(validation.error || "Unauthorized");
  }

  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") ;

    if (!query) {
      return NextResponse.json(
        {
          success: false,
          error: "Query parameter is required",
        } as KMMoviesSearchResponse,
        { status: 400 }
      );
    }

    const baseUrl = await getBaseUrl("KMMovies");
    const searchUrl = `${baseUrl}/?s=${encodeURIComponent(query)}`;

    const response = await fetch(searchUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch search results: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const results: Movie[] = [];
    const seenUrls = new Set<string>();

    // Parse search result articles from multiple KMMovies layouts
    $("article.movie-card, article.post, .post-item, .items article").each((_, element) => {
      const article = $(element);
      const link = article.find("a[href]").first();
      const rawUrl = link.attr("href") || "";
      const url = toAbsoluteUrl(rawUrl, baseUrl);
      const id = url.split("/").filter(Boolean).pop() || "";
      const img = article.find("img.poster, img.wp-post-image, img").first();
      const image = toAbsoluteUrl(img.attr("src") || "", baseUrl);
      const imageAlt = img.attr("alt") || "";
      const title =
        article.find(".movie-title, .entry-title, .post-title, h2, h3").first().text().trim() ||
        link.attr("title") ||
        imageAlt;

      if (url && title && !seenUrls.has(url)) {
        seenUrls.add(url);
        results.push({
          id,
          title,
          url,
          image,
          imageAlt,
        });
      }
    });

    const responseData: KMMoviesSearchResponse = {
      success: true,
      data: {
        query,
        results,
        totalResults: results.length,
      },
    };

    return NextResponse.json(responseData, { status: 200 });
  } catch (error) {
    console.error("Error searching KMMovies:", error);

    const errorResponse: KMMoviesSearchResponse = {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to search movies",
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}
