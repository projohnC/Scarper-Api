import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { validateProviderAccess, createProviderErrorResponse } from "@/lib/provider-validator";

interface DownloadLink {
  label: string;
  url: string;
}

interface FileInfo {
  fileName?: string;
  size?: string;
  format?: string;
  dateAdded?: string;
}

interface MagicLinksResponse {
  success: boolean;
  data?: {
    fileInfo: FileInfo;
    downloadLinks: DownloadLink[];
  };
  error?: string;
}

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function resolveUrl(label: string, url: string, referer: string): Promise<string> {
  try {
    const upperLabel = label.toUpperCase();

    // Handle WATCH ONLINE links (usually zipzap.lol)
    if (upperLabel.includes("WATCH ONLINE")) {
      const response = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          "Referer": referer
        },
        redirect: "follow",
      });
      const finalUrl = response.url;

      // Try extracting from URL first
      try {
        const urlParams = new URL(finalUrl).searchParams;
        const videoUrl = urlParams.get("videoUrl");
        if (videoUrl) return videoUrl;
      } catch {}

      // Try parsing HTML if videoUrl was not in the URL
      if (response.ok) {
        const html = await response.text();
        const $ = cheerio.load(html);

        // Try to find in jwplayer setup
        const scriptContent = $("script").text();
        const fileMatch = scriptContent.match(/file:\s*["']([^"']+)["']/);
        if (fileMatch) return fileMatch[1];

        // Try to find in input[id="videoUrl"]
        const inputValue = $("input#videoUrl").val();
        if (inputValue && typeof inputValue === 'string') return inputValue;
      }

      return finalUrl;
    }

    // Handle SKYDROP links
    if (upperLabel.includes("SKYDROP")) {
      const idMatch = url.match(/id=([^&]+)/);
      if (idMatch) {
        const id = idMatch[1];
        const baseUrl = new URL(url).origin;
        const apiUrl = `${baseUrl}/api.php?id=${id}`;
        const response = await fetch(apiUrl, {
          headers: {
            "User-Agent": USER_AGENT,
            "Referer": url
          },
        });
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.link) {
            return data.link;
          }
        }
      }
    }

    // Handle ZIP-ZAP, ULTRA FAST, ONE CLICK, etc.
    if (
      upperLabel.includes("ZIP-ZAP") ||
      upperLabel.includes("ULTRA FAST") ||
      upperLabel.includes("ONE CLICK") ||
      url.includes("zipzap.lol")
    ) {
       const response = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          "Referer": referer
        },
      });
      if (response.ok) {
        const html = await response.text();
        const $ = cheerio.load(html);

        let downloadUrl: string | undefined;
        // Try to find the primary download button (R2)
        const fastDl = $("a.btn-primary").attr("href");
        if (fastDl) {
           downloadUrl = new URL(fastDl, url).toString();
        } else {
           // Try to find the secondary download button (Worker/Direct)
           const secondaryDl = $("a.btn-secondary").attr("href");
           if (secondaryDl) {
              downloadUrl = new URL(secondaryDl, url).toString();
           } else {
              // Fallback to any button that looks like a download button
              const downloadButton = $("a.download-button, a:contains('Download Now'), a:contains('Fast Download')").attr("href");
              if (downloadButton) {
                 downloadUrl = new URL(downloadButton, url).toString();
              }
           }
        }

        if (downloadUrl) {
          // Follow one more level to get the final direct link if possible
          try {
            const finalResponse = await fetch(downloadUrl, {
              headers: {
                "User-Agent": USER_AGENT,
                "Referer": url
              },
              method: "HEAD",
              redirect: "follow"
            });
            return finalResponse.url;
          } catch {
             return downloadUrl;
          }
        }
      }
    }
  } catch (error) {
    console.error(`Error resolving ${label} (${url}):`, error);
  }

  return url;
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
        } as MagicLinksResponse,
        { status: 400 }
      );
    }

    // Fetch the magic links page
    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        Referer: "https://kmmovies.best/",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch magic links: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract file info
    const fileInfo: FileInfo = {};
    
    $(".file-details p").each((_, elem) => {
      const text = $(elem).text().trim();
      const strongText = $(elem).find("strong").text().trim();
      const value = text.replace(strongText, "").trim().replace(/^:\s*/, "");

      if (strongText.includes("File Name:")) {
        fileInfo.fileName = value;
      } else if (strongText.includes("Size:")) {
        fileInfo.size = value;
      } else if (strongText.includes("Format:")) {
        fileInfo.format = value;
      } else if (strongText.includes("Date Added:")) {
        fileInfo.dateAdded = value;
      }
    });

    // Extract download links
    const downloadLinks: DownloadLink[] = [];
    
    $(".download-buttons a.download-button").each((_, elem) => {
      const href = $(elem).attr("href");
      const label = $(elem).text().trim();

      if (href && label) {
        downloadLinks.push({
          label,
          url: href,
        });
      }
    });

    // Resolve final URLs
    const resolvedLinks = await Promise.all(
      downloadLinks.map(async (link) => {
        const resolvedUrl = await resolveUrl(link.label, link.url, url);
        return {
          ...link,
          url: resolvedUrl,
        };
      })
    );

    const responseData: MagicLinksResponse = {
      success: true,
      data: {
        fileInfo,
        downloadLinks: resolvedLinks,
      },
    };

    return NextResponse.json(responseData, { status: 200 });
  } catch (error) {
    console.error("Error fetching magic links:", error);

    const errorResponse: MagicLinksResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch magic links",
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}
