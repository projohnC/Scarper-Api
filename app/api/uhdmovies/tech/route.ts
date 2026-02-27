import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import axios, { AxiosResponse } from "axios";
import { chromium, type BrowserContext, type Page } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { validateProviderAccess, createProviderErrorResponse } from "@/lib/provider-validator";

export const runtime = "nodejs";

const PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || ".playwright";

interface Stream {
  server: string;
  link: string;
  type: string;
}

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

const MEDIA_URL_PATTERN = /\.(mp4|mkv|avi|mov|m3u8|webm|mpd)(\?|$)/i;
const BLOCKED_REQUEST_PATTERNS = ["zerocostdownloads", "go2cloud", "rhythmicicle", "cloudflareinsights"];
const CONTINUE_TEXT_MATCHER = /(continue|download|verify|instant|go to download)/i;

class CookieJar {
  cookies: Map<string, string> = new Map();

  setCookies(cookieHeader: string | string[] | undefined) {
    if (!cookieHeader) return;
    const headers = Array.isArray(cookieHeader) ? cookieHeader : [cookieHeader];
    headers.forEach(header => {
      const cookie = header.split(';')[0];
      const equalIndex = cookie.indexOf('=');
      if (equalIndex > 0) {
        const name = cookie.substring(0, equalIndex).trim();
        const value = cookie.substring(equalIndex + 1).trim();
        this.cookies.set(name, value);
      }
    });
  }

  getCookieString() {
    return Array.from(this.cookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
  }

  get(name: string) {
    return this.cookies.get(name);
  }
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

async function staticExtractor(url: string, referer: string): Promise<{ servers: Stream[], html: string, redirectChain: string[], cookies: Record<string, string> }> {
  const jar = new CookieJar();
  const servers: Stream[] = [];
  const redirectChain: string[] = [];

  let currentUrl = url;
  let html = "";
  let response: AxiosResponse;

  try {
    // Phase 1: Follow redirects and handle forms
    for (let i = 0; i < 5; i++) { // Limit redirects
      redirectChain.push(currentUrl);
      console.log(`[Static] Fetching: ${currentUrl}`);

      response = await axios.get(currentUrl, {
        headers: {
          ...BROWSER_HEADERS,
          Referer: referer,
          Cookie: jar.getCookieString(),
        },
        maxRedirects: 0,
        validateStatus: (status) => status >= 200 && status < 400,
      });

      jar.setCookies(response.headers['set-cookie']);
      html = response.data;

      if (response.status >= 300 && response.status < 400 && response.headers.location) {
        let nextUrl = response.headers.location;
        if (!nextUrl.startsWith('http')) {
          const urlObj = new URL(currentUrl);
          nextUrl = `${urlObj.protocol}//${urlObj.host}${nextUrl.startsWith('/') ? '' : '/'}${nextUrl}`;
        }
        referer = currentUrl;
        currentUrl = nextUrl;
        continue;
      }

      // Check for hidden forms and auto-submit
      const $ = cheerio.load(html);
      const form = $('form');
      if (form.length > 0 && html.includes('_wp_http')) {
        console.log("[Static] Found form, attempting auto-submit...");
        const action = form.attr('action') || currentUrl;
        const method = form.attr('method')?.toUpperCase() || 'POST';
        const formData = new URLSearchParams();

        form.find('input[type="hidden"], input[type="text"]').each((_, el) => {
          const name = $(el).attr('name');
          const value = $(el).attr('value') || '';
          if (name) formData.append(name, value);
        });

        const targetUrl = action.startsWith('http') ? action : new URL(action, currentUrl).href;
        
        response = await axios({
          method,
          url: targetUrl,
          data: formData.toString(),
          headers: {
            ...BROWSER_HEADERS,
            'Content-Type': 'application/x-www-form-urlencoded',
            Referer: currentUrl,
            Cookie: jar.getCookieString(),
          },
          maxRedirects: 0,
          validateStatus: (status) => status >= 200 && status < 400,
        });

        jar.setCookies(response.headers['set-cookie']);
        html = response.data;
        referer = currentUrl;

        if (response.status >= 300 && response.status < 400 && response.headers.location) {
           currentUrl = response.headers.location.startsWith('http') ? response.headers.location : new URL(response.headers.location, targetUrl).href;
           continue;
        }
      }

      break; // No more redirects or forms to handle automatically
    }

    // Extract links from final HTML
    const $ = cheerio.load(html);
    
    // 1. <a> tags
    $('a[href]').each((_, el) => {
      let href = $(el).attr('href') || '';
      if (href && !href.startsWith('http') && !href.startsWith('#') && !href.startsWith('javascript:')) {
        try { href = new URL(href, currentUrl).href; } catch (e) {}
      }

      const text = $(el).text().toLowerCase();
      const isDownload = /download|dl|get|server|direct|mirror/.test(text);
      const isMedia = MEDIA_URL_PATTERN.test(href);

      if (href && (isDownload || isMedia) && !href.startsWith('#') && !href.includes('javascript:')) {
        const type = href.match(MEDIA_URL_PATTERN)?.[1] || 'link';
        servers.push({
          server: $(el).text().trim() || 'Link',
          link: href,
          type
        });
      }
    });

    // 2. Buttons with onclick
    $('[onclick]').each((_, el) => {
      const onclick = $(el).attr('onclick') || '';
      const match = onclick.match(/window\.open\(['"](.*?)['"]\)|location\.href=['"](.*?)['"]/);
      let href = match?.[1] || match?.[2];
      if (href && !href.startsWith('#')) {
        if (!href.startsWith('http')) {
          try { href = new URL(href, currentUrl).href; } catch (e) {}
        }
        servers.push({
          server: $(el).text().trim() || 'Button',
          link: href,
          type: href.match(MEDIA_URL_PATTERN)?.[1] || 'link'
        });
      }
    });

    // 3. data-href
    $('[data-href]').each((_, el) => {
      let href = $(el).attr('data-href') || '';
      if (href) {
        if (!href.startsWith('http') && !href.startsWith('#')) {
          try { href = new URL(href, currentUrl).href; } catch (e) {}
        }
        servers.push({
          server: $(el).text().trim() || 'Data Link',
          link: href,
          type: href.match(MEDIA_URL_PATTERN)?.[1] || 'link'
        });
      }
    });

    // 4. Regex for links in scripts
    const scriptLinks = html.match(/https?:\/\/[^\s'"]+\.(mp4|mkv|m3u8|avi)[^\s'"]*/g);
    if (scriptLinks) {
      scriptLinks.forEach((link, i) => {
        servers.push({
          server: `Script Link ${i + 1}`,
          link,
          type: link.match(MEDIA_URL_PATTERN)?.[1] || 'link'
        });
      });
    }

    // Deduplicate
    const uniqueServers = Array.from(new Map(servers.map(s => [s.link, s])).values());

    return {
      servers: uniqueServers,
      html,
      redirectChain,
      cookies: Object.fromEntries(jar.cookies)
    };
  } catch (error) {
    console.error("[Static] Error:", error);
    return { servers: [], html, redirectChain, cookies: Object.fromEntries(jar.cookies) };
  }
}

async function headlessExtractor(url: string): Promise<Stream[]> {
  console.log("[Headless] Starting Playwright...");
  const browser = await chromium.launch({
    executablePath: resolveChromiumExecutablePath(),
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-blink-features=AutomationControlled"],
  });

  const context = await browser.newContext({
    userAgent: BROWSER_HEADERS["User-Agent"],
  });

  const page = await context.newPage();
  const capturedLinks = new Set<string>();
  const discoveredDownloadPages = new Set<string>();

  // Block ads and analytics
  await page.route("**/*", (route) => {
    const requestUrl = route.request().url().toLowerCase();
    const shouldBlock = BLOCKED_REQUEST_PATTERNS.some((pattern) => requestUrl.includes(pattern));
    if (shouldBlock) {
      return route.abort();
    }
    return route.continue();
  });

  // Capture network requests
  page.on("request", (request) => {
    const reqUrl = request.url();
    if (MEDIA_URL_PATTERN.test(reqUrl)) {
      capturedLinks.add(reqUrl);
    }
  });

  page.on("response", (response) => {
    const responseUrl = response.url();
    if (responseUrl.includes("driveseed.org") || responseUrl.includes("video-leech.pro")) {
      discoveredDownloadPages.add(responseUrl);
    }
  });

  const delay = async (ms: number) => page.waitForTimeout(ms);

  const clickIfVisible = async (selector: string, timeout = 4000) => {
    const locator = page.locator(selector).first();
    try {
      await locator.waitFor({ state: "visible", timeout });
      await locator.click({ timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  };

  const extractServersFromCurrentPage = async () => {
    const pageLinks = await page.$$eval("a[href]", (anchors) =>
      anchors
        .map((a) => ({
          text: a.textContent?.trim() || "",
          href: (a as HTMLAnchorElement).href,
        }))
        .filter((a) => a.href && /^https?:\/\//.test(a.href))
    );

    const servers: Stream[] = [];
    for (const link of pageLinks) {
      const isLikelyServer =
        MEDIA_URL_PATTERN.test(link.href) ||
        CONTINUE_TEXT_MATCHER.test(link.text) ||
        /resumebot|worker|gdrive|cloud|video-leech|drive/i.test(link.href);

      if (!isLikelyServer) continue;

      servers.push({
        server: link.text || "Direct Link",
        link: link.href,
        type: link.href.match(MEDIA_URL_PATTERN)?.[1] || "link",
      });
    }

    return Array.from(new Map(servers.map((server) => [server.link, server])).values());
  };

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await delay(3000);

    await clickIfVisible("h5:has-text('Start Verification')");
    await delay(3000);
    await clickIfVisible("#verify_text");
    await delay(5000);
    await clickIfVisible("#verify_button");
    await delay(2500);

    const downloadBtnClicked = await clickIfVisible("#two_steps_btn") ||
      await clickIfVisible("a:has-text('Go to download')") ||
      await clickIfVisible("a:has-text('Continue')") ||
      await clickIfVisible("a:has-text('Download')");

    if (!downloadBtnClicked) {
      await delay(3000);
    }

    const popup = await context.waitForEvent("page", { timeout: 12000 }).catch(() => null);
    const pagesToInspect: Page[] = [page];
    if (popup) {
      await popup.waitForLoadState("domcontentloaded", { timeout: 30000 }).catch(() => {});
      pagesToInspect.push(popup);
    }

    const aggregatedServers: Stream[] = [];

    for (const activePage of pagesToInspect) {
      if (!activePage.url().includes("driveseed.org")) {
        await activePage.waitForTimeout(2000);
      }

      const instantSelectors = [
        "a:has-text('Instant Download')",
        "a.btn.btn-danger:has-text('Instant Download')",
        "a:has-text('Download')",
      ];

      for (const selector of instantSelectors) {
        const locator = activePage.locator(selector).first();
        const isVisible = await locator.isVisible().catch(() => false);
        if (isVisible) {
          const href = await locator.getAttribute("href");
          if (href) {
            aggregatedServers.push({
              server: "Instant Download",
              link: href,
              type: href.match(MEDIA_URL_PATTERN)?.[1] || "link",
            });
          }
          await locator.click().catch(() => {});
          await activePage.waitForTimeout(2500);
          break;
        }
      }

      const linkData = await activePage.$$eval("a[href]", (anchors) =>
        anchors.map((a) => ({
          text: a.textContent?.trim() || "",
          href: (a as HTMLAnchorElement).href,
        }))
      );

      for (const link of linkData) {
        if (link.href.includes("video-leech.pro") || link.href.includes("driveseed.org")) {
          aggregatedServers.push({
            server: link.text || "Download Page",
            link: link.href,
            type: link.href.match(MEDIA_URL_PATTERN)?.[1] || "link",
          });
        }
      }
    }

    for (const discoveredPageUrl of discoveredDownloadPages) {
      aggregatedServers.push({
        server: "Resolved Page",
        link: discoveredPageUrl,
        type: discoveredPageUrl.match(MEDIA_URL_PATTERN)?.[1] || "link",
      });
    }

    for (const capturedLink of capturedLinks) {
      aggregatedServers.push({
        server: "Headless Capture",
        link: capturedLink,
        type: capturedLink.match(MEDIA_URL_PATTERN)?.[1] || "link",
      });
    }

    const onPageServers = await extractServersFromCurrentPage();
    aggregatedServers.push(...onPageServers);

    return Array.from(new Map(aggregatedServers.map((server) => [server.link, server])).values());
  } catch (err) {
    console.error("[Headless] Error:", err);
    return [];
  } finally {
    await browser.close();
  }
}

export async function GET(request: NextRequest) {
  const validation = await validateProviderAccess(request, "UhdMovies");
  if (!validation.valid) {
    return createProviderErrorResponse(validation.error || "Unauthorized");
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const url = searchParams.get("url");

    if (!url) {
      return NextResponse.json({ error: "URL parameter is required" }, { status: 400 });
    }

    // Decode sid for logging/debug if needed
    try {
      const urlObj = new URL(url);
      const sid = urlObj.searchParams.get("sid");
      if (!sid) {
        return NextResponse.json({ error: "sid invalid" }, { status: 400 });
      }
      const decodedSid = Buffer.from(sid, 'base64').toString('utf-8');
      if (!decodedSid) {
        return NextResponse.json({ error: "sid invalid" }, { status: 400 });
      }
      console.log("[Debug] Decoded SID length:", decodedSid.length);
    } catch (e) {
      console.log("[Debug] Failed to decode SID or URL invalid");
      return NextResponse.json({ error: "sid invalid" }, { status: 400 });
    }

    // Phase 1: Static Extraction
    const { servers: staticServers, html, redirectChain, cookies } = await staticExtractor(url, "https://tech.unblockedgames.world/");

    console.log("[Debug] Redirect Chain:", redirectChain);
    console.log("[Debug] Cookies received count:", Object.keys(cookies).length);
    console.log("[Debug] HTML Length:", html.length);

    if (html.includes("cloudflare") || html.includes("Ray ID")) {
       return NextResponse.json({ error: "Blocked by Cloudflare" }, { status: 403 });
    }

    let finalServers = staticServers;

    // Phase 2: Fallback to Headless if needed
    if (finalServers.length === 0 && (html.length < 5000 || html.includes("javascript") || html.includes("loading"))) {
      console.log("[Debug] Static extraction failed or page looks JS-heavy. Falling back to headless...");
      const headlessServers = await headlessExtractor(url);
      finalServers = headlessServers;
    }

    if (finalServers.length === 0) {
      return NextResponse.json({ error: "No servers found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        servers: finalServers,
        totalServers: finalServers.length,
      },
    });

  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      const html = String(error.response.data || "");
      if (html.includes("cloudflare") || html.includes("Ray ID") || error.response.status === 403) {
        return NextResponse.json({ error: "Blocked by Cloudflare" }, { status: 403 });
      }
    }

    console.error("Error in UhdMovies tech API:", error);
    return NextResponse.json(
      { 
        error: "Internal server error", 
        message: error instanceof Error ? error.message : "Unknown error" 
      },
      { status: 500 }
    );
  }
}
