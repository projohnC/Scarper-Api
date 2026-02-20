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

const isDriveLink = async (ddl: string) => {
  if (ddl.includes('drive')) {
    try {
      const driveLeach = await axios.get(ddl, { headers: BROWSER_HEADERS });
      const match = driveLeach.data.match(/window\.location\.replace\("([^"]+)"\)/);
      if (match) {
        const path = match[1];
        const mainUrl = ddl.split('/')[2];
        console.log(`driveUrl = https://${mainUrl}${path}`);
        return `https://${mainUrl}${path}`;
      }
    } catch (e) {
      console.error("isDriveLink error", e);
    }
  }
  return ddl;
};

export async function modExtractor(url: string, jar: CookieJar) {
  let currentUrl = url;
  let referer = "https://tech.unblockedgames.world/";
  let html = "";
  const redirectChain: string[] = [];

  try {
    for (let i = 0; i < 5; i++) {
      redirectChain.push(currentUrl);
      const response: AxiosResponse = await axios.get(currentUrl, {
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
          nextUrl = new URL(nextUrl, currentUrl).href;
        }
        referer = currentUrl;
        currentUrl = nextUrl;
        continue;
      }

      // Handle hidden forms (wp_http pattern)
      const $ = cheerio.load(html);
      const form = $('form');
      if (form.length > 0 && (html.includes('_wp_http') || html.includes('_wp_http2'))) {
        const action = form.attr('action') || currentUrl;
        const targetUrl = action.startsWith('http') ? action : new URL(action, currentUrl).href;
        const formData = new URLSearchParams();

        form.find('input[type="hidden"], input[type="text"]').each((_, el) => {
          const name = $(el).attr('name');
          const value = $(el).attr('value') || '';
          if (name) formData.append(name, value);
        });

        const postRes = await axios.post(targetUrl, formData.toString(), {
          headers: {
            ...BROWSER_HEADERS,
            'Content-Type': 'application/x-www-form-urlencoded',
            Referer: currentUrl,
            Cookie: jar.getCookieString(),
          },
          maxRedirects: 0,
          validateStatus: (status) => status >= 200 && status < 400,
        });

        jar.setCookies(postRes.headers['set-cookie']);
        html = postRes.data;
        referer = currentUrl;

        if (postRes.status >= 300 && postRes.status < 400 && postRes.headers.location) {
          currentUrl = postRes.headers.location.startsWith('http') ? postRes.headers.location : new URL(postRes.headers.location, targetUrl).href;
          continue;
        }
      }
      break;
    }

    console.log("[Debug] Redirect Chain:", redirectChain);
    console.log("[Debug] Cookies received:", jar.cookies.size);
    console.log("[Debug] HTML Length:", html.length);

    // If there's a meta refresh or a JS redirect we should try to catch it
    const metaRefresh = html.match(/content="0;url=(.*?)"/i);
    if (metaRefresh) {
        const nextUrl = metaRefresh[1].startsWith('http') ? metaRefresh[1] : new URL(metaRefresh[1], currentUrl).href;
        const finalRes = await axios.get(nextUrl, {
            headers: {
                ...BROWSER_HEADERS,
                Referer: currentUrl,
                Cookie: jar.getCookieString()
            }
        });
        jar.setCookies(finalRes.headers['set-cookie']);
        return { data: finalRes.data, url: nextUrl };
    }

    return { data: html, url: currentUrl };
  } catch (err) {
    console.log('modExtractor error', err);
    throw err;
  }
}

async function headlessFallback(url: string): Promise<Stream[]> {
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

  await page.route("**/*", (route) => {
    const requestUrl = route.request().url().toLowerCase();
    const shouldBlock = BLOCKED_REQUEST_PATTERNS.some((pattern) => requestUrl.includes(pattern));
    if (shouldBlock) return route.abort();
    return route.continue();
  });

  page.on("request", (request) => {
    const reqUrl = request.url();
    if (MEDIA_URL_PATTERN.test(reqUrl)) capturedLinks.add(reqUrl);
  });

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(5000);
    
    const selectors = ["button:has-text('Download')", "a:has-text('Download')", "#download", ".download"];
    for (const selector of selectors) {
      if (await page.locator(selector).first().isVisible()) {
        await page.locator(selector).first().click().catch(() => {});
        await page.waitForTimeout(5000);
      }
    }

    const servers: Stream[] = [];
    capturedLinks.forEach(link => {
      servers.push({ server: "Headless Capture", link, type: link.match(MEDIA_URL_PATTERN)?.[1] || "link" });
    });

    const pageLinks = await page.$$eval("a[href]", (anchors) =>
      anchors.map(a => ({ text: a.textContent?.trim(), href: (a as HTMLAnchorElement).href }))
    );

    pageLinks.forEach(l => {
      if (MEDIA_URL_PATTERN.test(l.href)) {
        servers.push({ server: l.text || "Direct Link", link: l.href, type: l.href.match(MEDIA_URL_PATTERN)?.[1] || "link" });
      }
    });

    return Array.from(new Map(servers.map(s => [s.link, s])).values());
  } catch (err) {
    console.error("[Headless] Error:", err);
    return [];
  } finally {
    await browser.close();
  }
}

export const modGetStream = async (url: string): Promise<Stream[]> => {
  try {
    console.log('modGetStream', url);
    const jar = new CookieJar();
    const extraction = await modExtractor(url, jar);
    const html = extraction.data;
    const currentUrl = extraction.url;

    const $ = cheerio.load(html);
    const servers: Stream[] = [];

    if (html.includes("cloudflare") || html.includes("Ray ID")) {
        throw new Error("Blocked by Cloudflare");
    }

    // Traditional specific logic
    const ddl = html.match(/content="0;url=(.*?)"/)?.[1] || currentUrl;
    const driveLink = await isDriveLink(ddl);

    try {
        const driveRes = await axios.get(driveLink, { headers: { ...BROWSER_HEADERS, Cookie: jar.getCookieString() } });
        const $drive = cheerio.load(driveRes.data);

        // ResumeBot
        const resumeBot = $drive('.btn.btn-light').attr('href') || '';
        if (resumeBot) {
            try {
                const rbRes = await axios.get(resumeBot, { headers: BROWSER_HEADERS });
                const token = rbRes.data.match(/formData\.append\('token', '([a-f0-9]+)'\)/)?.[1];
                const id = rbRes.data.match(/fetch\('\/download\?id=([a-zA-Z0-9\/+]+)'/)?.[1];
                if (token && id) {
                    const rbBody = new FormData();
                    rbBody.append('token', token);
                    const rbDownload = await fetch(resumeBot.split('/download')[0] + '/download?id=' + id, {
                        method: 'POST',
                        body: rbBody,
                        headers: { Referer: resumeBot }
                    });
                    const rbData = await rbDownload.json();
                    if (rbData.url) servers.push({ server: 'ResumeBot', link: rbData.url, type: rbData.url.match(MEDIA_URL_PATTERN)?.[1] || 'mkv' });
                }
            } catch (e) {}
        }

        // Cloud Download
        const cloudDownload = $drive('.btn.btn-success').attr('href') || '';
        if (cloudDownload) servers.push({ server: 'Cloud Download', link: cloudDownload, type: cloudDownload.match(MEDIA_URL_PATTERN)?.[1] || 'mkv' });

        // CF Workers
        for (const type of [1, 2]) {
            try {
                const cfLink = driveLink.replace('/file', '/wfile') + `?type=${type}`;
                const cfRes = await axios.get(cfLink, { headers: BROWSER_HEADERS });
                const $cf = cheerio.load(cfRes.data);
                $cf('.btn-success').each((i, el) => {
                    const href = $cf(el).attr('href');
                    if (href) servers.push({ server: `Cf Worker ${type}.${i}`, link: href, type: href.match(MEDIA_URL_PATTERN)?.[1] || 'mkv' });
                });
            } catch (e) {}
        }

        // Instant
        const seed = $drive('.btn-danger').attr('href') || '';
        if (seed && seed.includes('=')) {
            try {
                const token = seed.split('=')[1];
                const body = new FormData();
                body.append('keys', token);
                const api = seed.split('/').slice(0, 3).join('/') + '/api';
                const res = await fetch(api, { method: 'POST', body, headers: { 'x-token': api } });
                const data = await res.json();
                if (data.url) servers.push({ server: 'Gdrive-Instant', link: data.url, type: data.url.match(MEDIA_URL_PATTERN)?.[1] || 'mkv' });
            } catch (e) {}
        }
    } catch (e) {}

    // Requirement 6 & 7: Broad Extraction
    // <a> tags
    $('a[href]').each((_, el) => {
        let href = $(el).attr('href') || '';
        const text = $(el).text().toLowerCase();
        if (href && (MEDIA_URL_PATTERN.test(href) || /download|dl|get|server|direct/.test(text)) && !href.startsWith('#')) {
            if (!href.startsWith('http')) try { href = new URL(href, currentUrl).href; } catch(e) {}
            servers.push({ server: $(el).text().trim() || 'Link', link: href, type: href.match(MEDIA_URL_PATTERN)?.[1] || 'link' });
        }
    });

    // buttons & data-href
    $('[onclick], [data-href]').each((_, el) => {
        let href = $(el).attr('data-href') || '';
        if (!href) {
            const onclick = $(el).attr('onclick') || '';
            const match = onclick.match(/window\.open\(['"](.*?)['"]\)|location\.href=['"](.*?)['"]/);
            href = match?.[1] || match?.[2] || '';
        }
        if (href && !href.startsWith('#')) {
            if (!href.startsWith('http')) try { href = new URL(href, currentUrl).href; } catch(e) {}
            servers.push({ server: $(el).text().trim() || 'Server', link: href, type: href.match(MEDIA_URL_PATTERN)?.[1] || 'link' });
        }
    });

    // Script regex
    const scriptLinks = html.match(/https?:\/\/[^\s'"]+\.(mp4|mkv|m3u8|avi)[^\s'"]*/g);
    if (scriptLinks) {
        scriptLinks.forEach((link, i) => {
            servers.push({ server: `Script Link ${i + 1}`, link, type: link.match(MEDIA_URL_PATTERN)?.[1] || 'link' });
        });
    }

    // Fallback to headless if empty
    if (servers.length === 0 && (html.length < 5000 || html.includes("javascript"))) {
        const headlessServers = await headlessFallback(url);
        servers.push(...headlessServers);
    }

    // Deduplicate
    const unique = Array.from(new Map(servers.map(s => [s.link, s])).values());
    return unique;
  } catch (err) {
    console.log('modGetStream error', err);
    if (err instanceof Error && err.message === "Blocked by Cloudflare") throw err;
    return [];
  }
};

export async function GET(request: NextRequest) {
  const validation = await validateProviderAccess(request, "UhdMovies");
  if (!validation.valid) return createProviderErrorResponse(validation.error || "Unauthorized");

  try {
    const searchParams = request.nextUrl.searchParams;
    const url = searchParams.get("url");

    if (!url) return NextResponse.json({ error: "URL parameter is required" }, { status: 400 });

    try {
        const sid = new URL(url).searchParams.get("sid");
        if (!sid || !Buffer.from(sid, 'base64').toString('utf-8')) {
            return NextResponse.json({ error: "sid invalid" }, { status: 400 });
        }
    } catch (e) {
        return NextResponse.json({ error: "sid invalid" }, { status: 400 });
    }

    const servers = await modGetStream(url);
    if (!servers || servers.length === 0) return NextResponse.json({ error: "no servers found" }, { status: 404 });

    return NextResponse.json({ success: true, data: { servers, totalServers: servers.length } });
  } catch (error) {
    if (error instanceof Error && error.message === "Blocked by Cloudflare") {
        return NextResponse.json({ error: "blocked by Cloudflare" }, { status: 403 });
    }
    console.error("Error in UhdMovies tech API:", error);
    return NextResponse.json({ error: "Internal server error", message: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
