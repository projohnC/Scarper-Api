import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";

const REQUEST_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

function isHubDriveFileUrl(url: string): boolean {
  return /^https?:\/\/hubdrive\.space\/file\/[A-Za-z0-9_-]+\/?$/i.test(url);
}

function toCookieHeader(setCookie: string | null): string {
  if (!setCookie) {
    return "";
  }

  return setCookie
    .split(",")
    .map((cookie) => cookie.split(";")[0]?.trim())
    .filter(Boolean)
    .join("; ");
}

async function extractHubDriveDirectLink(fileUrl: string): Promise<string | null> {
  const filePageResponse = await fetch(fileUrl, {
    headers: REQUEST_HEADERS,
    redirect: "follow",
  });

  if (!filePageResponse.ok) {
    return null;
  }

  const cookies = toCookieHeader(filePageResponse.headers.get("set-cookie"));
  const filePageHtml = await filePageResponse.text();
  const $filePage = cheerio.load(filePageHtml);

  const newDlPath = $filePage("a[href*='/newdl']").attr("href") || "/newdl";
  const newDlUrl = new URL(newDlPath, filePageResponse.url).toString();

  const newDlResponse = await fetch(newDlUrl, {
    headers: {
      ...REQUEST_HEADERS,
      Referer: filePageResponse.url,
      ...(cookies ? { Cookie: cookies } : {}),
    },
    redirect: "follow",
  });

  if (!newDlResponse.ok) {
    return null;
  }

  const newDlHtml = await newDlResponse.text();
  const $newDlPage = cheerio.load(newDlHtml);
  const directLink = $newDlPage("a#dllink").attr("href")?.trim();

  if (!directLink || !directLink.startsWith("http")) {
    return null;
  }

  return directLink;
}

export async function GET(request: NextRequest) {
  try {
    const url = request.nextUrl.searchParams.get("url")?.trim();

    if (!url || !isHubDriveFileUrl(url)) {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to extract HubDrive link",
        },
        { status: 400 }
      );
    }

    const directLink = await extractHubDriveDirectLink(url);

    if (!directLink) {
      return NextResponse.json({
        success: false,
        error: "Failed to extract HubDrive link",
      });
    }

    return NextResponse.json({
      success: true,
      directLink,
    });
  } catch (error) {
    console.error("Error in HubDrive extractor:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to extract HubDrive link",
    });
  }
}
