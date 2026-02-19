import { NextRequest, NextResponse } from "next/server";
import { chromium } from "playwright";
import { validateApiKey } from "@/lib/api-auth";

interface HubCloudServer {
  name: string;
  url: string;
}

interface HubCloudResponse {
  success: boolean;
  hubcloudUrl: string;
  cryptonewzUrl: string | null;
  servers: HubCloudServer[];
  finalLinks: string[];
}

const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const BLOCKED_DOMAINS = [
  "zerocostdownloads.com",
  "go2cloud.org",
  "rhythmicicle.com",
  "cloudflareinsights.com",
  "google-analytics.com",
  "googletagmanager.com",
];

export async function GET(request: NextRequest) {
  // Validate API key
  const validation = await validateApiKey(request);
  if (!validation.valid) {
    return NextResponse.json(
      { success: false, error: validation.error || "Unauthorized" },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json(
      { success: false, error: "URL parameter is required" },
      { status: 400 }
    );
  }

  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: ["--disable-blink-features=AutomationControlled"],
    });

    const context = await browser.newContext({
      userAgent: CHROME_UA,
      viewport: { width: 1280, height: 720 },
      locale: "en-US",
    });

    // Add anti-detection: navigator.webdriver override
    await context.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });

    const page = await context.newPage();

    // Request blocking
    await page.route("**/*", (route) => {
      const url = route.request().url();
      if (BLOCKED_DOMAINS.some((domain) => url.includes(domain))) {
        return route.abort();
      }
      return route.continue();
    });

    console.log("Navigating to HubCloud:", url);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

    // 8s settle wait as requested
    await new Promise((resolve) => setTimeout(resolve, 8000));

    // Try to find direct links or cryptonewz links
    const hubcloudUrl = page.url();
    let cryptonewzUrl: string | null = null;
    const servers: HubCloudServer[] = [];
    const finalLinks: string[] = [];

    // Common HubCloud selectors for servers
    const serverElements = await page.$$("a.btn, .download-links a");
    for (const el of serverElements) {
      const href = await el.getAttribute("href");
      const text = (await el.innerText()).trim();

      if (href && href.startsWith("http")) {
        if (href.includes("cryptonewz.net")) {
          cryptonewzUrl = href;
        } else if (href.includes("hubcloud") || href.includes("drive.google.com") || href.includes("pixeldrain")) {
          servers.push({ name: text || "Server", url: href });
        }
      }
    }

    // If we found a cryptonewz URL, we might want to follow it to get final links
    if (cryptonewzUrl) {
      console.log("Found Cryptonewz URL, navigating:", cryptonewzUrl);
      await page.goto(cryptonewzUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const cryptonewzLinks = await page.$$("a.btn-success, a.btn-primary");
      for (const el of cryptonewzLinks) {
        const href = await el.getAttribute("href");
        if (href && href.startsWith("http") && !href.includes("cryptonewz.net")) {
          finalLinks.push(href);
        }
      }
    }

    // Fallback: if no final links yet, check the current page for common download patterns
    if (finalLinks.length === 0) {
      const allLinks = await page.$$eval("a", (links) =>
        links
          .map(a => ({ href: a.href, text: a.innerText }))
          .filter(a => a.href.includes("drive.google.com") || a.href.includes("pixeldrain") || a.href.includes("gofile.io"))
      );
      for (const link of allLinks) {
        finalLinks.push(link.href);
      }
    }

    return NextResponse.json({
      success: true,
      hubcloudUrl,
      cryptonewzUrl,
      servers,
      finalLinks,
    } as HubCloudResponse);
  } catch (error) {
    console.error("Error in hubcloud extractor:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Extraction failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
