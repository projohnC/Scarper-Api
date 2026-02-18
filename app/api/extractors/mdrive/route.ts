import { NextRequest, NextResponse } from "next/server";
import { chromium, type Page } from "playwright";
import * as cheerio from "cheerio";
import axios from "axios";
import { validateApiKey } from "@/lib/api-auth";

export const runtime = "nodejs";

type MDriveItem = {
  label: string;
  size: string;
  hubCloudUrl: string;
};

type ResolvedItem = MDriveItem & {
  cryptonewzUrl: string | null;
  finalLinks: string[];
};

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
};

async function extractHubCloudLinks(mdriveUrl: string): Promise<{ title: string; items: MDriveItem[] }> {
  const response = await axios.get(mdriveUrl, { headers: BROWSER_HEADERS });
  const $ = cheerio.load(response.data);

  const title = $(".entry-title").text().trim() || $("title").text().trim();
  const items: MDriveItem[] = [];

  $(".entry-content h5").each((_, element) => {
    const block = $(element);
    const text = block.text();

    if (!text.match(/Ep\d+/i)) {
      return;
    }

    const epMatch = text.match(/Ep\s*(\d+)/i);
    const sizeMatch = text.match(/\[([\d.]+\s*[GMK]?B)\]/i);
    const nextH5 = block.next("h5");
    const hubCloudUrl = nextH5.find("a[href*='hubcloud']").attr("href");

    if (!hubCloudUrl || !epMatch) {
      return;
    }

    items.push({
      label: `Ep${epMatch[1]}`,
      size: sizeMatch?.[1] || "",
      hubCloudUrl,
    });
  });

  if (items.length === 0) {
    $(".entry-content a[href*='hubcloud']").each((_, element) => {
      const hubCloudUrl = $(element).attr("href");
      if (!hubCloudUrl) {
        return;
      }

      const sectionText = $(element).closest("h4, h5, p, li, div").text();
      const sizeMatch = sectionText.match(/\[([\d.]+\s*[GMK]?B)\]/i);
      items.push({
        label: "Full Movie",
        size: sizeMatch?.[1] || "",
        hubCloudUrl,
      });
    });
  }

  return { title, items };
}

function collectCandidateLinks(urls: string[]): string[] {
  const mediaPattern = /\.(mp4|mkv|avi|mov|m3u8|webm)(\?|$)/i;

  const filtered = urls.filter((url) => {
    if (!url.startsWith("http")) {
      return false;
    }

    if (mediaPattern.test(url)) {
      return true;
    }

    return /download|dl=|gdrive|drive\.google|file\//i.test(url);
  });

  return [...new Set(filtered)];
}

async function clickGenerate(page: Page) {
  const selectors = [
    "button:has-text('Generate Direct Link')",
    "a:has-text('Generate Direct Link')",
    "button:has-text('Generate')",
    "a:has-text('Generate')",
    "#generate",
    ".generate",
  ];

  for (const selector of selectors) {
    const target = page.locator(selector).first();
    if (await target.count()) {
      await target.click({ timeout: 8_000 });
      return;
    }
  }

  throw new Error("Generate button not found on HubCloud page");
}

async function resolveHubCloudUrl(hubCloudUrl: string): Promise<{ cryptonewzUrl: string | null; finalLinks: string[] }> {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  const page = await browser.newPage({ userAgent: BROWSER_HEADERS["User-Agent"] });

  try {
    await page.goto(hubCloudUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await clickGenerate(page);

    await page.waitForLoadState("domcontentloaded", { timeout: 30_000 });
    await page.waitForTimeout(2_000);

    const cryptonewzUrl = page.url().includes("cryptonewz") ? page.url() : null;

    const hrefs = await page.evaluate(() =>
      Array.from(document.querySelectorAll("a[href]"))
        .map((a) => (a as HTMLAnchorElement).href)
        .filter(Boolean)
    );

    const finalLinks = collectCandidateLinks(hrefs);
    return { cryptonewzUrl, finalLinks };
  } finally {
    await page.close();
    await browser.close();
  }
}

export async function GET(request: NextRequest) {
  const validation = await validateApiKey(request);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error || "Unauthorized" }, { status: 401 });
  }

  try {
    const mdriveUrl = request.nextUrl.searchParams.get("url");
    const limitParam = request.nextUrl.searchParams.get("limit");
    const parsedLimit = limitParam ? Number(limitParam) : 1;
    const limit = Number.isFinite(parsedLimit) ? Math.max(1, Math.min(10, parsedLimit)) : 1;

    if (!mdriveUrl) {
      return NextResponse.json({ error: "URL parameter is required" }, { status: 400 });
    }

    const { title, items } = await extractHubCloudLinks(mdriveUrl);

    if (items.length === 0) {
      return NextResponse.json({
        success: false,
        step: "mdrive",
        message: "No HubCloud links found on the provided page",
      });
    }

    const selectedItems = items.slice(0, limit);
    const resolved: ResolvedItem[] = [];

    for (const item of selectedItems) {
      try {
        const { cryptonewzUrl, finalLinks } = await resolveHubCloudUrl(item.hubCloudUrl);
        resolved.push({ ...item, cryptonewzUrl, finalLinks });
      } catch (error) {
        resolved.push({
          ...item,
          cryptonewzUrl: null,
          finalLinks: [],
        });

        console.error("Failed resolving HubCloud URL", item.hubCloudUrl, error);
      }
    }

    return NextResponse.json({
      success: true,
      url: mdriveUrl,
      title,
      extractedHubCloudLinks: items.length,
      resolvedCount: resolved.length,
      resolved,
    });
  } catch (error) {
    console.error("Error in mdrive extractor flow:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
