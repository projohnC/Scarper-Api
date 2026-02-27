import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { validateProviderAccess, createProviderErrorResponse } from "@/lib/provider-validator";
import { getBaseUrl } from "@/lib/baseurl";

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

    const baseUrl = await getBaseUrl("KMMovies");
    let decodedUrl = url;
    try {
      decodedUrl = decodeURIComponent(url);
    } catch {
      decodedUrl = url;
    }
    const resolvedUrl = toAbsoluteUrl(decodedUrl, baseUrl);

    // Fetch the movie details page
    const response = await fetch(resolvedUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch movie details: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract title
    const title =
      $(".hero-title, .entry-title, h1").first().text().trim() ||
      $("meta[property='og:title']").attr("content") ||
      "";

    // Try to parse JSON-LD
    let jsonLdData: JsonLdMovie | null = null;
    for (const elem of $('script[type="application/ld+json"]').toArray()) {
      try {
        const data = JSON.parse($(elem).html() || "{}") as JsonLdMovie;
        if (data["@type"] === "Movie") {
          jsonLdData = data;
          break;
        }
      } catch {
        // Ignore parse errors
      }
    }

    // Extract release date
    const releaseDate = jsonLdData?.datePublished || $(".hero-meta-row .meta-pill").eq(1).text().trim();

    // Extract categories/tags
    const categories: string[] = [];
    $(".breadcrumb a, .cat-links a, .entry-categories a").each((i, elem) => {
      if (i > 0) { // Skip "Home"
        const category = $(elem).text().trim();
        if (category && !categories.includes(category)) {
          categories.push(category);
        }
      }
    });

    // Extract poster image
    const posterImage =
      toAbsoluteUrl($(".hero-poster").attr("src") || "", baseUrl) ||
      toAbsoluteUrl($(".post-thumbnail img, .featured-image img, .entry-content img").first().attr("src") || "", baseUrl) ||
      jsonLdData?.image ||
      "";

    // Extract screenshots from slider
    const screenshots: string[] = [];
    const sliderData = $(".wp-slider-container").attr("data-images");
    if (sliderData) {
      try {
        const images = JSON.parse(sliderData);
        screenshots.push(...images.map((img: string) => toAbsoluteUrl(img, baseUrl)));
      } catch (e) {
        console.error("Failed to parse screenshots:", e);
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

    // Extract storyline
    const storyline =
      $(".hero-description, .plot-summary, .entry-content p").first().text().trim() ||
      jsonLdData?.description ||
      "";

    // Extract movie info
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

    // Fallback or additional info from meta pills
    const ratingText = $(".rating-star").text().trim();
    if (ratingText && !movieInfo.imdbRating) {
      movieInfo.imdbRating = ratingText.replace("★", "").trim();
    }

    const durationText = $(".hero-meta-row .meta-pill").last().text().trim();
    if (durationText && durationText.includes("h") && !movieInfo.runningTime) {
      movieInfo.runningTime = durationText;
    }

    // Fallback info extraction from visible metadata blocks
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

    // Extract download links
    const downloadLinks: DownloadLink[] = [];
    $(".download-category").each((_, catElem) => {
      const category = $(catElem).find(".category-title").text().trim();
      $(catElem).find(".dl-btn").each((_, elem) => {
        const btn = $(elem);
        const quality = btn.find(".dl-quality").text().trim() || btn.find(".dl-res").text().trim();
        const fileSize = btn.find(".dl-size").text().trim();
        const downloadUrl = btn.attr("href") || "";

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

    const responseData: KMMoviesDetailsResponse = {
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
    };

    return NextResponse.json(responseData, { status: 200 });
  } catch (error) {
    console.error("Error fetching KMMovies details:", error);

    const errorResponse: KMMoviesDetailsResponse = {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch movie details",
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}
