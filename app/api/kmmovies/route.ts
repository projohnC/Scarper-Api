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

async function fetchHtmlFromCandidates(pathForBase: (baseUrl: string) => string): Promise<{ html: string; baseUrl: string }> {
  const cookies = await getCookies().catch(() => "");
  const candidates = await getBaseCandidates();
  const errors: string[] = [];

  for (const baseUrl of candidates) {
    const targetUrl = pathForBase(baseUrl);
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

    const response = await fetch(targetUrl, { headers, redirect: "follow", cache: "no-store" });
    if (response.ok) {
      return { html: await response.text(), baseUrl };
    }

    errors.push(`${baseUrl}: ${response.status} ${response.statusText}`);
  }

  throw new Error(`Failed to fetch data: ${errors.join(" | ")}`);
}

export async function GET(request: NextRequest) {
  const validation = await validateProviderAccess(request, "KMMovies");
  if (!validation.valid) {
    return createProviderErrorResponse(validation.error || "Unauthorized");
  }

  try {
    const { searchParams } = new URL(request.url);
    const page = searchParams.get("page") || "1";

    const { html, baseUrl } = await fetchHtmlFromCandidates((base) =>
      page === "1" ? base : `${base}/page/${page}/`
    );

    const $ = cheerio.load(html);

    const movies: Movie[] = [];
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
        movies.push({ id, title, url, image, imageAlt });
      }
    });

    const pagination = {
      current: parseInt(page, 10),
      next: null as string | null,
      last: null as string | null,
    };

    const nextLink = $("nav.pager a.next, .nav-links a.next, .nav-links a.nextpostslink").first().attr("href");
    if (nextLink) {
      const nextPage = nextLink.match(/\/page\/(\d+)\//);
      pagination.next = nextPage ? nextPage[1] : null;
    }

    const lastLink = $("nav.pager a.page-numbers, .nav-links a.page-numbers")
      .not(".next")
      .not(".current")
      .not(".dots")
      .last()
      .attr("href");
    if (lastLink) {
      const lastPage = lastLink.match(/\/page\/(\d+)\//);
      pagination.last = lastPage ? lastPage[1] : null;
    }

    return NextResponse.json({
      success: true,
      data: { movies, pagination },
    } as KMMoviesResponse, { status: 200 });
  } catch (error) {
    console.error("Error fetching KMMovies data:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch movies data",
      } as KMMoviesResponse,
      { status: 500 }
    );
  }
}
