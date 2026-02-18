import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { chromium, type BrowserContext, type Page } from "playwright";
import { validateApiKey } from "@/lib/api-auth";

export const runtime = "nodejs";

const PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || ".playwright";
process.env.PLAYWRIGHT_BROWSERS_PATH = PLAYWRIGHT_BROWSERS_PATH;

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
};

const MEDIA_URL_PATTERN = /\.(mp4|mkv|avi|mov|m3u8|webm|mpd)(\?|$)/i;
const SERVER_LABEL_PATTERN = /(fls|10\s*gbps|pixelverse)/i;

type HubCloudServer = {
  name: string;
  url: string;
};

function canUseAsFinalLink(url: string): boolean {
  if (!url.startsWith("http")) {
    return false;
  }

  if (MEDIA_URL_PATTERN.test(url)) {
    return true;
  }

  return /download|stream|play|video|cdn|file\//i.test(url);
}

function resolveChromiumExecutablePath(): string {
  const browsersRoot = path.isAbsolute(PLAYWRIGHT_BROWSERS_PATH)
    ? PLAYWRIGHT_BROWSERS_PATH
    : path.join(process.cwd(), PLAYWRIGHT_BROWSERS_PATH);

  if (!fs.existsSync(browsersRoot)) {
    return chromium.executablePath();
  }

  const executableRelPaths = [
    "chrome-linux/chrome",
    "chrome-linux/headless_shell",
    "chrome-linux64/chrome",
    "chrome-linux64/headless_shell",
  ];

  const chromiumDirs = fs
    .readdirSync(browsersRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("chromium-"))
    .sort((a, b) => b.name.localeCompare(a.name));

  for (const chromiumDir of chromiumDirs) {
    for (const relPath of executableRelPaths) {
      const candidate = path.join(browsersRoot, chromiumDir.name, relPath);
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
  }

  return chromium.executablePath();
}

async function clickGenerateButton(page: Page): Promise<void> {
  const selectors = [
    "button:has-text('Generate Direct Link')",
    "a:has-text('Generate Direct Link')",
    "button:has-text('Generate')",
    "a:has-text('Generate')",
    "text=Generate Direct Link",
    "text=Generate",
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

async function waitForRedirectAfterGenerate(page: Page, initialUrl: string): Promise<void> {
  try {
    await page.waitForURL((url) => url.toString() !== initialUrl, { timeout: 20_000 });
  } catch {
    await page.waitForLoadState("domcontentloaded", { timeout: 10_000 }).catch(() => undefined);
  }

  await page.waitForTimeout(2_000);
}

async function extractServers(page: Page): Promise<HubCloudServer[]> {
  const links = await page.$$eval("a[href]", (anchors) =>
    anchors
      .map((anchor) => ({
        name: (anchor.textContent || "").trim(),
        url: (anchor as HTMLAnchorElement).href,
      }))
      .filter((entry) => entry.url && entry.name)
  );

  const prioritized = links.filter((entry) => SERVER_LABEL_PATTERN.test(entry.name));
  const fallback = links.filter((entry) => /server/i.test(entry.name));
  const selected = prioritized.length > 0 ? prioritized : fallback;

  const unique = new Map<string, HubCloudServer>();
  for (const entry of selected) {
    unique.set(entry.url, { name: entry.name, url: entry.url });
  }

  return Array.from(unique.values());
}

function attachMediaCapture(page: Page, context: BrowserContext, collector: Set<string>): void {
  const capture = (candidate: string) => {
    if (canUseAsFinalLink(candidate)) {
      collector.add(candidate);
    }
  };

  page.on("response", (response) => capture(response.url()));
  page.on("request", (request) => capture(request.url()));
  page.on("framenavigated", (frame) => capture(frame.url()));

  context.on("page", (newPage) => {
    newPage.on("response", (response) => capture(response.url()));
    newPage.on("request", (request) => capture(request.url()));
    newPage.on("framenavigated", (frame) => capture(frame.url()));
  });
}

async function clickServerAndCapture(page: Page, server: HubCloudServer): Promise<void> {
  const byHref = page.locator(`a[href="${server.url}"]`).first();
  if (await byHref.count()) {
    await byHref.click({ timeout: 8_000 });
    return;
  }

  const byText = page
    .locator("a", {
      hasText: server.name,
    })
    .first();

  if (await byText.count()) {
    await byText.click({ timeout: 8_000 });
    return;
  }

  await page.evaluate((targetUrl) => {
    const element = Array.from(document.querySelectorAll("a[href]")).find(
      (anchor) => (anchor as HTMLAnchorElement).href === targetUrl
    ) as HTMLAnchorElement | undefined;

    element?.click();
  }, server.url);
}

async function resolveHubCloudUrl(hubcloudUrl: string): Promise<{
  hubcloudUrl: string;
  cryptonewzUrl: string | null;
  servers: HubCloudServer[];
  finalLinks: string[];
}> {
  const browser = await chromium.launch({
    executablePath: resolveChromiumExecutablePath(),
    headless: true,
    chromiumSandbox: false,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-software-rasterizer",
      "--disable-accelerated-2d-canvas",
      "--no-zygote",
      "--single-process",
      "--disable-background-networking",
      "--disable-background-timer-throttling",
      "--disable-breakpad",
      "--disable-component-update",
      "--disable-default-apps",
      "--disable-extensions",
      "--disable-features=Translate,BackForwardCache,AcceptCHFrame,MediaRouter",
      "--disable-hang-monitor",
      "--disable-ipc-flooding-protection",
      "--disable-renderer-backgrounding",
      "--force-color-profile=srgb",
      "--metrics-recording-only",
      "--mute-audio",
      "--headless=new",
    ],
  });

  const context = await browser.newContext({
    userAgent: BROWSER_HEADERS["User-Agent"],
    viewport: { width: 1280, height: 720 },
    javaScriptEnabled: true,
  });
  const page = await context.newPage();
  const finalLinks = new Set<string>();
  attachMediaCapture(page, context, finalLinks);

  try {
    await page.goto(hubcloudUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });

    const initialUrl = page.url();
    await clickGenerateButton(page);
    await waitForRedirectAfterGenerate(page, initialUrl);

    const cryptonewzUrl = page.url().includes("cryptonewz") ? page.url() : null;
    const servers = await extractServers(page);

    for (const server of servers) {
      try {
        await clickServerAndCapture(page, server);
        await page.waitForTimeout(3_500);
      } catch (error) {
        console.error("Failed to click server", server.url, error);
      }
    }

    return {
      hubcloudUrl,
      cryptonewzUrl,
      servers,
      finalLinks: Array.from(finalLinks),
    };
  } finally {
    await page.close();
    await context.close();
    await browser.close();
  }
}

export async function GET(request: NextRequest) {
  const validation = await validateApiKey(request);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error || "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get("url");

    if (!url) {
      return NextResponse.json({ error: "URL parameter is required" }, { status: 400 });
    }

    const data = await resolveHubCloudUrl(url);

    return NextResponse.json({
      success: true,
      ...data,
    });
  } catch (error) {
    console.error("Error in hubcloud extractor:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
