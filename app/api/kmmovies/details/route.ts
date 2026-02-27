import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { validateProviderAccess, createProviderErrorResponse } from "@/lib/provider-validator";
import { getBaseUrl, getCookies } from "@/lib/baseurl";

interface DownloadLink {
  quality: string;
  badge?: string;
  fileSize?: string;
  url: string;
}

interface MovieInfo {
  imdbRating?: string;
  movieName?: string;
  director?: string;
  starring?: string;
  genres?: string;
  runningTime?: string;
  writer?: string;
  releaseDate?: string;
  ott?: string;
  quality?: string;
  language?: string;
  subtitles?: string;
  format?: string;
}

interface JsonLdPerson {
  name?: string;
}

interface JsonLdMovie {
  "@type"?: string;
  datePublished?: string;
  image?: string;
  description?: string;
  name?: string;
  duration?: string;
  genre?: string[];
  aggregateRating?: {
    ratingValue?: string;
  };
  director?: JsonLdPerson;
  actor?: JsonLdPerson[];
}

interface KMMoviesDetailsResponse {
  success: boolean;
  data?: {
    title: string;
    releaseDate?: string;
    categories: string[];
    posterImage?: string;
    screenshots: string[];
    storyline?: string;
    movieInfo: MovieInfo;
    downloadLinks: DownloadLink[];
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

function replaceHostKeepingPath(url: string, targetBase: string): string {
  try {
    const current = new URL(url);
    const next = new URL(targetBase);
    return `${next.origin}${current.pathname}${current.search}${current.hash}`;
  } catch {
    return url;
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

async function fetchDetailsHtml(urlParam: string): Promise<{ html: string; baseUrl: string }> {
  const cookies = await getCookies().catch(() => "");
  const baseCandidates = await getBaseCandidates();

  const candidateUrls = new Set<string>();
  let decodedUrl = urlParam;
  try {
    decodedUrl = decodeURIComponent(urlParam);
  } catch {
    decodedUrl = urlParam;
  }

  for (const base of baseCandidates) {
    const absolute = toAbsoluteUrl(decodedUrl, base);
    candidateUrls.add(absolute);
    candidateUrls.add(replaceHostKeepingPath(absolute, base));
  }

  const errors: string[] = [];
  for (const url of candidateUrls) {
    let baseUrl = FALLBACK_BASE_URLS[0];
    try {
      baseUrl = new URL(url).origin;
    } catch {
      // ignore
    }

    const headers: Record<string, string> = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
      Referer: baseUrl,
      Origin: baseUrl,
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    };

    if (cookies) {
      headers.Cookie = cookies;
    }

    const response = await fetch(url, { headers, redirect: "follow", cache: "no-store" });
    if (response.ok) {
      return { html: await response.text(), baseUrl };
    }

    errors.push(`${url}: ${response.status} ${response.statusText}`);
  }

  throw new Error(`Failed to fetch movie details: ${errors.join(" | ")}`);
}

export async function GET(request: NextRequest) {
  const validation = await validateProviderAccess(request, "KMMovies");
  if (!validation.valid) {
    return createProviderErrorResponse(validation.error || "Unauthorized");
  }

  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get("url");

    if (!url) {
      return NextResponse.json(
        {
          success: false,
          error: "URL parameter is required",
        } as KMMoviesDetailsResponse,
        { status: 400 }
      );
    }

    const { html, baseUrl } = await fetchDetailsHtml(url);
    const $ = cheerio.load(html);

    const title =
      $(".hero-title, .entry-title, h1").first().text().trim() ||
      $("meta[property='og:title']").attr("content") ||
      "";

    let jsonLdData: JsonLdMovie | null = null;
    for (const elem of $('script[type="application/ld+json"]').toArray()) {
      try {
        const data = JSON.parse($(elem).html() || "{}") as JsonLdMovie;
        if (data["@type"] === "Movie") {
          jsonLdData = data;
          break;
        }
      } catch {
        // ignore parse error
      }
    }

    const releaseDate = jsonLdData?.datePublished || $(".hero-meta-row .meta-pill").eq(1).text().trim();

    const categories: string[] = [];
    $(".breadcrumb a, .cat-links a, .entry-categories a").each((i, elem) => {
      if (i > 0) {
        const category = $(elem).text().trim();
        if (category && !categories.includes(category)) {
          categories.push(category);
        }
      }
    });

    const posterImage =
      toAbsoluteUrl($(".hero-poster").attr("src") || "", baseUrl) ||
      toAbsoluteUrl($(".post-thumbnail img, .featured-image img, .entry-content img").first().attr("src") || "", baseUrl) ||
      jsonLdData?.image ||
      "";

    const screenshots: string[] = [];
    const sliderData = $(".wp-slider-container").attr("data-images");
    if (sliderData) {
      try {
        const images = JSON.parse(sliderData);
        screenshots.push(...images.map((img: string) => toAbsoluteUrl(img, baseUrl)));
      } catch {
        // ignore
      }
    }

    if (screenshots.length === 0) {
      $(".ss-img img, .gallery img, .entry-content img").each((_, imgElem) => {
        const src = toAbsoluteUrl($(imgElem).attr("src") || "", baseUrl);
        if (src && !screenshots.includes(src) && src !== posterImage) {
          screenshots.push(src);
        }
      });
    }

    const storyline =
      $(".hero-description, .plot-summary, .entry-content p").first().text().trim() ||
      jsonLdData?.description ||
      "";

    const movieInfo: MovieInfo = {};
    if (jsonLdData) {
      movieInfo.movieName = jsonLdData.name;
      movieInfo.imdbRating = jsonLdData.aggregateRating?.ratingValue;
      movieInfo.director = jsonLdData.director?.name;
      movieInfo.starring = jsonLdData.actor?.map((a) => a.name).filter(Boolean).join(", ");
      movieInfo.genres = jsonLdData.genre?.join(", ");
      movieInfo.runningTime = jsonLdData.duration;
      movieInfo.releaseDate = jsonLdData.datePublished;
    }

    const ratingText = $(".rating-star").text().trim();
    if (ratingText && !movieInfo.imdbRating) {
      movieInfo.imdbRating = ratingText.replace("★", "").trim();
    }

    const durationText = $(".hero-meta-row .meta-pill").last().text().trim();
    if (durationText && durationText.includes("h") && !movieInfo.runningTime) {
      movieInfo.runningTime = durationText;
    }

    $(".entry-content p, .single-service-content p").each((_, element) => {
      const text = $(element).text().replace(/\s+/g, " ").trim();
      if (!text.includes(":")) return;

      const [rawLabel, ...rest] = text.split(":");
      const label = rawLabel.trim().toLowerCase();
      const value = rest.join(":").trim();
      if (!value) return;

      if (label.includes("movie name") && !movieInfo.movieName) movieInfo.movieName = value;
      if (label.includes("director") && !movieInfo.director) movieInfo.director = value;
      if ((label.includes("starring") || label.includes("cast")) && !movieInfo.starring) movieInfo.starring = value;
      if ((label.includes("genres") || label.includes("genre")) && !movieInfo.genres) movieInfo.genres = value;
      if ((label.includes("running") || label.includes("duration")) && !movieInfo.runningTime) movieInfo.runningTime = value;
      if (label.includes("writer") && !movieInfo.writer) movieInfo.writer = value;
      if (label.includes("release") && !movieInfo.releaseDate) movieInfo.releaseDate = value;
      if (label.includes("ott") && !movieInfo.ott) movieInfo.ott = value;
      if (label.includes("quality") && !movieInfo.quality) movieInfo.quality = value;
      if (label.includes("language") && !movieInfo.language) movieInfo.language = value;
      if (label.includes("subtitles") && !movieInfo.subtitles) movieInfo.subtitles = value;
      if (label.includes("format") && !movieInfo.format) movieInfo.format = value;
    });

    const downloadLinks: DownloadLink[] = [];
    $(".download-category").each((_, catElem) => {
      const category = $(catElem).find(".category-title").text().trim();
      $(catElem).find(".dl-btn").each((_, elem) => {
        const btn = $(elem);
        const quality = btn.find(".dl-quality").text().trim() || btn.find(".dl-res").text().trim();
        const fileSize = btn.find(".dl-size").text().trim();
        const downloadUrl = toAbsoluteUrl(btn.attr("href") || "", baseUrl);

        if (quality && downloadUrl) {
          downloadLinks.push({
            quality,
            badge: category || undefined,
            fileSize: fileSize || undefined,
            url: downloadUrl,
          });
        }
      });
    });

    if (downloadLinks.length === 0) {
      $(".downloads-btns-div a.btn, .download-buttons a.download-button, a.btn-zip, a[href*='magiclinks']").each((_, elem) => {
        const btn = $(elem);
        const href = toAbsoluteUrl(btn.attr("href") || "", baseUrl);
        const rawText = btn.text().replace(/\s+/g, " ").trim();
        if (!href) return;

        const qualityMatch = rawText.match(/(4k|2160p|1080p|720p|480p)/i);
        const fileSizeMatch = rawText.match(/(\d+(?:\.\d+)?\s?(?:GB|MB))/i);

        downloadLinks.push({
          quality: qualityMatch?.[1] || rawText || "Download",
          fileSize: fileSizeMatch?.[1],
          url: href,
        });
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        title,
        releaseDate: releaseDate || undefined,
        categories,
        posterImage: posterImage || undefined,
        screenshots,
        storyline: storyline || undefined,
        movieInfo,
        downloadLinks,
      },
    } as KMMoviesDetailsResponse, { status: 200 });
  } catch (error) {
    console.error("Error fetching KMMovies details:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch movie details",
      } as KMMoviesDetailsResponse,
      { status: 500 }
    );
  }
}
