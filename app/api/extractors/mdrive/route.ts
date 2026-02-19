import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { validateApiKey } from "@/lib/api-auth";

interface MDriveResolvedItem {
  label: string;
  size: string;
  hubCloudUrl: string;
  cryptonewzUrl: string | null;
  finalLinks: string[];
}

export async function GET(request: NextRequest) {
  // Validate API key
  const validation = await validateApiKey(request);
  if (!validation.valid) {
    return NextResponse.json(
      { success: false, error: validation.error || "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const url = searchParams.get("url");
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam) : null;

    if (!url) {
      return NextResponse.json(
        { success: false, error: "URL parameter is required" },
        { status: 400 }
      );
    }

    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: `Failed to fetch URL: ${response.statusText}` },
        { status: response.status }
      );
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const title = $(".entry-title").text().trim();
    let resolved: MDriveResolvedItem[] = [];

    $(".entry-content h5").each((index, element) => {
      const $el = $(element);
      const text = $el.text();

      if (text.match(/Ep\d+.*\d+.*MB/)) {
        const epMatch = text.match(/Ep(\d+)/);
        const sizeMatch = text.match(/\[([\d.]+\s*MB)\]/);
        
        const label = epMatch ? `Ep${epMatch[1]}` : "";
        const size = sizeMatch ? sizeMatch[1] : "";

        const $nextH5 = $el.next("h5");
        const hubCloudLink = $nextH5.find("a[href*='hubcloud']").attr("href");

        if (label && hubCloudLink) {
          resolved.push({
            label,
            size,
            hubCloudUrl: hubCloudLink,
            cryptonewzUrl: null,
            finalLinks: [],
          });
        }
      }
    });

    if (resolved.length === 0) {
      $(".entry-content a[href*='hubcloud']").each((_, element) => {
        const href = $(element).attr("href");
        const $container = $(element).closest("h4, h5, p");
        const containerText = $container.text();
        const sizeMatch = containerText.match(/\[([\d.]+\s*[GM]B)\]/i);
        
        if (href) {
          resolved.push({
            label: "Full Movie",
            size: sizeMatch ? sizeMatch[1] : "",
            hubCloudUrl: href,
            cryptonewzUrl: null,
            finalLinks: [],
          });
        }
      });
    }

    // Apply limit if specified
    if (limit !== null && limit > 0) {
      resolved = resolved.slice(0, limit);
    }

    return NextResponse.json({
      success: true,
      title,
      resolved,
    });
  } catch (error) {
    console.error("Error in MDrive extractor:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch links",
      },
      { status: 500 }
    );
  }
}
