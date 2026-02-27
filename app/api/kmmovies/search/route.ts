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

interface KMMoviesSearchResponse {
  success: boolean;
  data?: {
    query: string;
    results: Movie[];
    totalResults: number;
  };
  error?: string;
}

const FALLBACK_BASE_URLS = ["https://kmmovies.store", "https://kmmovies.best"];

function toAbsoluteUrl(value: string, baseUrl: string): string {
  if (!value) return "";
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return value;
  }
}

async function getBaseCandidates(): Promise<string[]> {
  try {
    const primary = await getBaseUrl("KMMovies");
    return [primary, ...FALLBACK_BASE_URLS.filter((url) => url !== primary)];
  } catch {
    return FALLBACK_BASE_URLS;
  }
}

async function fetchSearchHtml(query: string): Promise<{ html: string; baseUrl: string }> {
  const cookies = await getCookies().catch(() => "");
  const candidates = await getBaseCandidates();
  const errors: string[] = [];

  for (const baseUrl of candidates) {
    const searchUrl = `${baseUrl}/?s=${encodeURIComponent(query)}`;
    const headers: Record<string, string> = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
      Referer: baseUrl,
      Origin: new URL(baseUrl).origin,
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    };

    if (cookies) {
      headers.Cookie = cookies;
    }

    const response = await fetch(searchUrl, { headers, redirect: "follow", cache: "no-store" });
    if (response.ok) {
      return { html: await response.text(), baseUrl };
    }

    errors.push(`${baseUrl}: ${response.status} ${response.statusText}`);
  }

  throw new Error(`Failed to fetch search results: ${errors.join(" | ")}`);
}

export async function GET(request: NextRequest) {
  const validation = await validateProviderAccess(request, "KMMovies");
  if (!validation.valid) {
    return createProviderErrorResponse(validation.error || "Unauthorized");
  }

  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");

    if (!query) {
      return NextResponse.json(
        {
          success: false,
          error: "Query parameter is required",
        } as KMMoviesSearchResponse,
        { status: 400 }
      );
    }

    const { html, baseUrl } = await fetchSearchHtml(query);
    const $ = cheerio.load(html);

    const results: Movie[] = [];
    const seenUrls = new Set<string>();

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
        results.push({ id, title, url, image, imageAlt });
      }
    });

    return NextResponse.json({
      success: true,
      data: { query, results, totalResults: results.length },
    } as KMMoviesSearchResponse, { status: 200 });
  } catch (error) {
    console.error("Error searching KMMovies:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to search movies",
      } as KMMoviesSearchResponse,
      { status: 500 }
    );
  }
}
