import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { resolveFinalLink } from "@/lib/link-resolvers";

interface DownloadLink {
  quality: string;
  size: string;
  url: string;
}

interface MovieDetails {
  title: string;
  imageUrl: string;
  screenshots: string[];
  downloadLinks: DownloadLink[];
}

const QUALITY_REGEX = /(2160p|4k|1080p|720p|480p|360p|240p)/i;
const SIZE_REGEX = /(\d+(?:\.\d+)?\s?(?:GB|MB))/i;

function normalizeQuality(quality: string) {
  return quality.toLowerCase() === "4k" ? "2160p" : quality;
}

function extractQualityAndSize(...sources: Array<string | undefined>) {
  const combined = sources
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  const qualityMatch = combined.match(QUALITY_REGEX);
  const sizeMatch = combined.match(SIZE_REGEX);

  return {
    quality: qualityMatch ? normalizeQuality(qualityMatch[1]) : "Unknown",
    size: sizeMatch ? sizeMatch[1].replace(/\s+/g, "") : "Unknown",
  };
}

function isCandidateDownloadLink(href: string, text: string) {
  const lowerText = text.toLowerCase();
  return (
    href.startsWith("http") &&
    (href.includes("gyanigurus") ||
      href.includes("hubdrive") ||
      href.includes("hubcloud") ||
      href.includes("gdflix") ||
      href.includes("katdrive") ||
      href.includes("pixeldrain") ||
      href.includes("drivemanga") ||
      href.includes("ampproject.org") ||
      href.includes("bloggingvector") ||
      lowerText.includes("download") ||
      lowerText.includes("g-drive"))
  );
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

    if (url.includes("gyanigurus.xyz") || url.includes("hubdrive.space") || url.includes("hubcloud")) {
      const resolvedUrls = await resolveFinalLink(url);

      const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
      let title = "Resolved Link";
      if (response.ok) {
        const html = await response.text();
        const $ = cheerio.load(html);
        title = $("title").text().trim() || $("h1").first().text().trim() || "Resolved Link";
      }

      const movieDetails: MovieDetails = {
        title,
        imageUrl: "",
        screenshots: [],
        downloadLinks: resolvedUrls.map((resolvedUrl) => ({
          quality: "Unknown",
          size: "Unknown",
          url: resolvedUrl,
        })),
      };

      return NextResponse.json({
        success: true,
        data: movieDetails,
      });
    }

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
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

    const title =
      $("h1.entry-title").text().trim() ||
      $("meta[property='og:title']").attr("content") ||
      "";

    const imageUrl =
      $(".entry-content img").first().attr("src") ||
      $("meta[property='og:image']").attr("content") ||
      "";

    const screenshots: string[] = [];
    $(".entry-content p a img").each((_, element) => {
      const src = $(element).attr("src");
      if (src) {
        screenshots.push(src);
      }
    });

    const downloadLinks: DownloadLink[] = [];
    const potentialLinks: Array<{ url: string; quality: string; size: string }> = [];

    $(".entry-content a, article a, main a").each((_, el) => {
      const $a = $(el);
      const href = $a.attr("href") || "";
      const linkText = $a.text().trim();
      if (!href || !isCandidateDownloadLink(href, linkText)) {
        return;
      }

      const $container = $a.closest("p, li, div, section");
      const $prev = $container.prev();
      const $next = $container.next();

      const contextText = [
        linkText,
        $container.text(),
        $prev.text(),
        $next.text(),
        $container.prevAll("h2, h3, h4, h5").first().text(),
        $container.parent().prevAll("h2, h3, h4, h5").first().text(),
      ].join(" ");

      const contextHtml = [
        $container.html() || "",
        $prev.html() || "",
        $next.html() || "",
      ].join(" ");

      const { quality, size } = extractQualityAndSize(contextText, contextHtml);
      potentialLinks.push({ url: href, quality, size });
    });

    for (const item of potentialLinks) {
      try {
        const resolvedUrls = await resolveFinalLink(item.url);
        if (resolvedUrls.length === 0) {
          continue;
        }

        for (const resolvedUrl of resolvedUrls) {
          if (
            resolvedUrl.includes("oreao-cdn") ||
            resolvedUrl.includes("pixeldrain.dev/api") ||
            resolvedUrl !== item.url ||
            (!resolvedUrl.includes("ampproject.org") && !resolvedUrl.includes("bloggingvector"))
          ) {
            downloadLinks.push({
              quality: item.quality,
              size: item.size,
              url: resolvedUrl,
            });
          }
        }
      } catch (err) {
        console.error(`Error resolving ${item.url}:`, err);
      }
    }

    if (downloadLinks.length === 0) {
      $(".entry-content p, .entry-content li").each((_, element) => {
        const $block = $(element);
        const text = $block.text().trim();
        const { quality, size } = extractQualityAndSize(text, $block.html() || "");

        $block.find("a").each((__, anchor) => {
          const linkUrl = $(anchor).attr("href");
          if (linkUrl && linkUrl.startsWith("http")) {
            downloadLinks.push({ quality, size, url: linkUrl });
          }
        });
      });
    }

    const movieDetails: MovieDetails = {
      title,
      imageUrl,
      screenshots,
      downloadLinks: [...new Map(downloadLinks.map((item) => [item.url, item])).values()],
    };

    return NextResponse.json({
      success: true,
      data: movieDetails,
    });
  } catch (error) {
    console.error("Error in DesireMovies Details API:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
