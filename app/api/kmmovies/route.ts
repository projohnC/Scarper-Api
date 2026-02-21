import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { getBaseUrl, getCookies } from "@/lib/baseurl";
import { validateProviderAccess, createProviderErrorResponse } from "@/lib/provider-validator";

interface Movie {
  id: string;
  title: string;
  url: string;
  image: string;
  imageAlt: string;
}

interface KMMoviesResponse {
  success: boolean;
  data?: {
    movies: Movie[];
    pagination?: {
      current: number;
      next: string | null;
      last: string | null;
    };
  };
  error?: string;
}

export async function GET(request: NextRequest) {
  const validation = await validateProviderAccess(request, "KMMovies");
  if (!validation.valid) {
    return createProviderErrorResponse(validation.error || "Unauthorized");
  }

  try {
    const { searchParams } = new URL(request.url);
    const page = searchParams.get("page") || "1";

    // Get base URL from baseurl.ts
    const baseUrl = await getBaseUrl("KMMovies");
    const url = page === "1" ? baseUrl : `${baseUrl}/page/${page}/`;

    // Fetch the page
    const headers: Record<string, string> = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
      Referer: baseUrl,
      Origin: new URL(baseUrl).origin,
    };

    try {
      const cookies = await getCookies();
      headers.Cookie = cookies;
    } catch (cookieError) {
      console.warn("KMMovies cookie fetch failed, continuing without cookies", cookieError);
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`Failed to fetch data: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const movies: Movie[] = [];

    // Parse articles from the site-main section
    $("article.movie-card").each((_, element) => {
      const article = $(element);
      const link = article.find("a").first();
      const url = link.attr("href") || "";
      const id = url.split("/").filter(Boolean).pop() || "";
      const img = article.find("img.poster");
      const image = img.attr("src") || "";
      const imageAlt = img.attr("alt") || "";
      const title = article.find(".movie-title").text().trim() || imageAlt;

      if (url && title) {
        movies.push({
          id,
          title,
          url,
          image,
          imageAlt,
        });
      }
    });

    // Parse pagination
    const pagination = {
      current: parseInt(page),
      next: null as string | null,
      last: null as string | null,
    };

    const nextLink = $("nav.pager a.next").attr("href");
    if (nextLink) {
      const nextPage = nextLink.match(/\/page\/(\d+)\//);
      pagination.next = nextPage ? nextPage[1] : null;
    }

    const lastLink = $("nav.pager a.page-numbers")
      .not(".next")
      .not(".current")
      .not(".dots")
      .last()
      .attr("href");
    if (lastLink) {
      const lastPage = lastLink.match(/\/page\/(\d+)\//);
      pagination.last = lastPage ? lastPage[1] : null;
    }

    const responseData: KMMoviesResponse = {
      success: true,
      data: {
        movies,
        pagination,
      },
    };

    return NextResponse.json(responseData, { status: 200 });
  } catch (error) {
    console.error("Error fetching KMMovies data:", error);

    const errorResponse: KMMoviesResponse = {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to fetch movies data",
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}
