import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";

interface DownloadLink {
  title: string;
  quality: string;
  size: string;
  url: string;
}

const QUALITY_REGEX = /(2160p|1080p|720p|480p|360p|240p)/i;
const SIZE_REGEX = /(\d+(?:\.\d+)?\s?(?:GB|MB))/i;

function extractQualityAndSize(rawText: string, rawHtml = "") {
  const normalizedText = rawText.replace(/\s+/g, " ").trim();
  const normalizedHtml = rawHtml.replace(/\s+/g, " ").trim();
  const combined = `${normalizedText} ${normalizedHtml}`;

  const qualityMatch = combined.match(QUALITY_REGEX);
  const sizeMatch = combined.match(SIZE_REGEX);

  return {
    quality: qualityMatch ? qualityMatch[1] : "Unknown",
    size: sizeMatch ? sizeMatch[1].replace(/\s+/g, "") : "Unknown",
  };
}

interface WatchOnlineLink {
  url: string;
}

interface MovieInfo {
  movieName?: string;
  releaseYear?: string;
  language?: string;
  subtitles?: string;
  size?: string;
  quality?: string;
  format?: string;
}

interface MovieDetails {
  title: string;
  imageUrl: string;
  videoLabel: string;
  description: string;
  movieInfo: MovieInfo;
  storyline: string;
  screenshots: string[];
  watchOnline: WatchOnlineLink | null;
  downloadLinks: DownloadLink[];
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const url = searchParams.get("url");

    if (!url) {
      return NextResponse.json(
        { error: "URL parameter is required" },
        { status: 400 }
      );
    }

    // Fetch the page
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch movie details" },
        { status: response.status }
      );
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract title
    const title = $('.single-service-content h1').first().text().trim();

    // Extract image URL
    const imageUrl = $('.post-thumbnail img').attr('src') || '';

    // Extract video label
    const videoLabel = $('.video-label').first().text().trim();

    // Extract description (first paragraph after title)
    const description = $('.single-service-content > p').first().text().trim();

    // Extract movie info
    const movieInfo: MovieInfo = {};
    const movieInfoText = $('h2.movie-title:contains("Movie/Series Info:")').next('p').text();
    
    if (movieInfoText) {
      const lines = movieInfoText.split('\n');
      lines.forEach(line => {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('Movie Name:')) {
          movieInfo.movieName = trimmedLine.replace('Movie Name:', '').trim();
        } else if (trimmedLine.startsWith('Release Year:')) {
          movieInfo.releaseYear = trimmedLine.replace('Release Year:', '').trim();
        } else if (trimmedLine.startsWith('Language:')) {
          movieInfo.language = trimmedLine.replace('Language:', '').trim();
        } else if (trimmedLine.startsWith('Subtitles:')) {
          movieInfo.subtitles = trimmedLine.replace('Subtitles:', '').trim();
        } else if (trimmedLine.startsWith('Size:')) {
          movieInfo.size = trimmedLine.replace('Size:', '').trim();
        } else if (trimmedLine.startsWith('Quality:')) {
          movieInfo.quality = trimmedLine.replace('Quality:', '').trim();
        } else if (trimmedLine.startsWith('Format:')) {
          movieInfo.format = trimmedLine.replace('Format:', '').trim();
        }
      });
    }

    // Extract storyline
    let storyline = '';
    $('h3.movie-title').each((_, element) => {
      const $element = $(element);
      if ($element.text().includes('Storyline:')) {
        storyline = $element.next('p').text().trim();
        return false; // break
      }
    });

    // Extract screenshots
    const screenshots: string[] = [];
    $('.ss-img img').each((_, element) => {
      const src = $(element).attr('src');
      if (src) {
        screenshots.push(src);
      }
    });

    // Extract watch online link
    let watchOnline: WatchOnlineLink | null = null;
    const watchOnlineUrl = $('.watch-btns-div a.btn-zip').attr('href');
    if (watchOnlineUrl) {
      watchOnline = { url: watchOnlineUrl };
    }

    // Extract download links
    const downloadLinks: DownloadLink[] = [];
    $('.download-links-div h4').each((_, element) => {
      const $h4 = $(element);
      const sectionText = $h4.text().trim();
      const sectionHtml = $h4.html() || "";
      const { quality, size } = extractQualityAndSize(sectionText, sectionHtml);

      const $downloadContainer = $h4.nextAll('.downloads-btns-div').first();
      $downloadContainer.find('a.btn').each((__, linkElement) => {
        const $link = $(linkElement);
        const linkText = $link.text().trim();
        const linkUrl = $link.attr('href');

        if (!linkUrl) {
          return;
        }

        const fallback = extractQualityAndSize(linkText, $link.html() || "");

        downloadLinks.push({
          title: sectionText || linkText,
          quality: quality !== "Unknown" ? quality : fallback.quality,
          size: size !== "Unknown" ? size : fallback.size,
          url: linkUrl,
        });
      });
    });

    const movieDetails: MovieDetails = {
      title,
      imageUrl,
      videoLabel,
      description,
      movieInfo,
      storyline,
      screenshots,
      watchOnline,
      downloadLinks,
    };

    return NextResponse.json({
      success: true,
      data: movieDetails,
    });

  } catch (error) {
    console.error("Error in Movies4u Details API:", error);
    return NextResponse.json(
      { 
        error: "Internal server error", 
        message: error instanceof Error ? error.message : "Unknown error" 
      },
      { status: 500 }
    );
  }
}
