import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { validateProviderAccess, createProviderErrorResponse } from "@/lib/provider-validator";

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

    // Fetch the movie details page
    const response = await fetch(url, {
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
    const title = $(".hero-title").first().text().trim() || $("h1").first().text().trim();

    // Try to parse JSON-LD
    let jsonLdData: Record<string, unknown> | null = null;
    $('script[type="application/ld+json"]').each((_, elem) => {
      try {
        const data = JSON.parse($(elem).html() || "{}");
        if (data["@type"] === "Movie") {
          jsonLdData = data as Record<string, unknown>;
        }
      } catch {
        // Ignore parse errors
      }
    });

    // Extract release date
    const releaseDate = jsonLdData?.datePublished || $(".hero-meta-row .meta-pill").eq(1).text().trim();

    // Extract categories/tags
    const categories: string[] = [];
    $(".breadcrumb a").each((i, elem) => {
      if (i > 0) { // Skip "Home"
        categories.push($(elem).text().trim());
      }
    });

    // Extract poster image
    const posterImage = $(".hero-poster").attr("src") || $(".post-thumbnail img").attr("src") || jsonLdData?.image || "";

    // Extract screenshots from slider
    const screenshots: string[] = [];
    const sliderData = $(".wp-slider-container").attr("data-images");
    if (sliderData) {
      try {
        const images = JSON.parse(sliderData);
        screenshots.push(...images);
      } catch (e) {
        console.error("Failed to parse screenshots:", e);
      }
    }

    // Extract storyline
    const storyline = $(".hero-description").text().trim() || jsonLdData?.description || "";

    // Extract movie info
    const movieInfo: MovieInfo = {};
    
    if (jsonLdData) {
      movieInfo.movieName = jsonLdData.name as string;
      movieInfo.imdbRating = (jsonLdData.aggregateRating as Record<string, unknown>)?.ratingValue as string;
      movieInfo.director = (jsonLdData.director as Record<string, unknown>)?.name as string;
      movieInfo.starring = (jsonLdData.actor as Record<string, unknown>[])?.map((a) => a.name as string).join(", ");
      movieInfo.genres = (jsonLdData.genre as string[])?.join(", ");
      movieInfo.runningTime = jsonLdData.duration as string;
      movieInfo.releaseDate = jsonLdData.datePublished as string;
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
