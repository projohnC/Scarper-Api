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

    // Check if the URL is already a know resolver URL
    if (url.includes('gyanigurus.xyz') || url.includes('hubdrive.space') || url.includes('hubcloud')) {
      const resolvedUrls = await resolveFinalLink(url);

      // Try to get a title from the page even if it's not a DesireMovies page
      const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
      let title = "Resolved Link";
      if (response.ok) {
        const html = await response.text();
        const $ = cheerio.load(html);
        title = $('title').text().trim() || $('h1').first().text().trim() || "Resolved Link";
      }

      const movieDetails: MovieDetails = {
        title,
        imageUrl: "",
        screenshots: [],
        downloadLinks: resolvedUrls.map(u => ({
          quality: "Resolved",
          size: "Unknown",
          url: u
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

    const title = $('h1.entry-title').text().trim() ||
      $('meta[property="og:title"]').attr('content') || '';

    const imageUrl = $('.entry-content img').first().attr('src') ||
      $('meta[property="og:image"]').attr('content') || '';

    const screenshots: string[] = [];
    $('.entry-content p a img').each((_, element) => {
      const src = $(element).attr('src');
      if (src) {
        screenshots.push(src);
      }
    });

    // Improved link extraction
    const downloadLinks: DownloadLink[] = [];

    // First, collect all potential download links
    const potentialLinks: { url: string, textSnippet: string }[] = [];

    $('a').each((_, el) => {
      const $a = $(el);
      const href = $a.attr('href');
      const text = $a.text().trim();

      if (href && href.startsWith('http') && (
        href.includes('gyanigurus') ||
        href.includes('hubdrive') ||
        href.includes('hubcloud') ||
        href.includes('gdflix') ||
        href.includes('katdrive') ||
        href.includes('pixeldrain') ||
        href.includes('drivemanga') ||
        href.includes('ampproject.org') ||
        href.includes('bloggingvector') ||
        text.toLowerCase().includes('download') ||
        text.toLowerCase().includes('g-drive')
      )) {
        // Find context around the link for quality/size
        const context = $a.parent().text() + " " + $a.parent().next().text() + " " + $a.closest('div').prev().text();
        potentialLinks.push({ url: href, textSnippet: context });
      }
    });

    for (const item of potentialLinks) {
      const qualityMatch = item.textSnippet.match(/(2160p|1080p|720p|480p|4K)/i);
      const sizeMatch = item.textSnippet.match(/\[?([\d.]+\s*[MG]B)\]?/i);

      const quality = qualityMatch ? qualityMatch[1] : "Resolved";
      const size = sizeMatch ? sizeMatch[1] : "Unknown";

      try {
        const resolvedUrls = await resolveFinalLink(item.url);
        if (resolvedUrls.length > 0) {
          for (const resolvedUrl of resolvedUrls) {
            // Only add if it's a "final" link or at least different from original if it was a redirector
            if (resolvedUrl.includes('oreao-cdn') || resolvedUrl.includes('pixeldrain.dev/api') || resolvedUrl !== item.url) {
              downloadLinks.push({
                quality,
                size,
                url: resolvedUrl,
              });
            } else {
              // If it's the same URL, only add if it's not a generic redirector
              if (!resolvedUrl.includes('ampproject.org') && !resolvedUrl.includes('bloggingvector')) {
                downloadLinks.push({ quality, size, url: resolvedUrl });
              }
            }
          }
        }
      } catch (err) {
        console.error(`Error resolving ${item.url}:`, err);
      }
    }

    // Default fallback if no links found with new logic
    if (downloadLinks.length === 0) {
      const initialLinks: DownloadLink[] = [];
      $('.entry-content p').each((_, element) => {
        const $p = $(element);
        const text = $p.text().trim();
        const qualityMatch = text.match(/(2160p|1080p|720p|480p|4K)[^[]*\[([^\]]+)\]/i);

        if (qualityMatch) {
          const quality = qualityMatch[0].replace(/\[.*?\]/, '').trim();
          const size = qualityMatch[2];
          const $nextP = $p.next('p');
          const $link = $nextP.find('a');
          const linkUrl = $link.attr('href');

          if (linkUrl && linkUrl.startsWith('http')) {
            initialLinks.push({ quality, size, url: linkUrl });
          }
        }
      });

      for (const link of initialLinks) {
        try {
          const resolvedUrls = await resolveFinalLink(link.url);
          for (const resolvedUrl of resolvedUrls) {
            downloadLinks.push({ ...link, url: resolvedUrl });
          }
        } catch (err) {
          downloadLinks.push(link);
        }
      }
    }

    const movieDetails: MovieDetails = {
      title,
      imageUrl,
      screenshots,
      downloadLinks: [...new Map(downloadLinks.map(item => [item.url, item])).values()], // Deduplicate by URL
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
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
