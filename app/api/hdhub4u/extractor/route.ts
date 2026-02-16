import { NextRequest, NextResponse } from "next/server";
import { load, type CheerioAPI } from "cheerio";
import {
  createProviderErrorResponse,
  validateProviderAccess,
} from "@/lib/provider-validator";

const headers = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

const MAX_STEPS = 8;

function toAbsoluteUrl(candidate: string, base: string): string {
  try {
    return new URL(candidate, base).href;
  } catch {
    return candidate;
  }
}

function looksLikeFinalMedia(url: string): boolean {
  return /\.(m3u8|mp4|mkv|avi|mov|webm|mpd|ts)(\?.*)?$/i.test(url);
}

function looksLikeDirectDownloadHost(url: string): boolean {
  return /hubdrive\.|hubcdn\.|gadgetsweb\.|katfile\.|1fichier\.|clicknupload\.|filemoon\.in\/download|mega\.nz|drive\.google/i.test(
    url,
  );
}

function rot13(str: string): string {
  return str.replace(/[a-zA-Z]/g, (c) =>
    String.fromCharCode(
      (c <= "Z" ? 90 : 122) >= c.charCodeAt(0) + 13
        ? c.charCodeAt(0) + 13
        : c.charCodeAt(0) + 13 - 26,
    ),
  );
}

function encodeBase64(value: string): string {
  return Buffer.from(value, "utf-8").toString("base64");
}

function decodeBase64(value: string): string {
  return Buffer.from(value, "base64").toString("utf-8");
}

function extractHdhub4uPreferredDownload(
  $: CheerioAPI,
  baseUrl: string,
): string | null {
  const candidates: { url: string; score: number; quality?: string }[] = [];

  const selectors = [
    'a[href*="hubdrive"]',
    'a[href*="gadgetsweb"]',
    'a:contains("480p")',
    'a:contains("720p")',
    'a:contains("1080p")',
    'a:contains("Download")',
    'a:contains("WEB-DL")',
    'a:contains("HEVC")',
    'button:contains("Download")',
  ];

  $(selectors.join(",")).each((_, el) => {
    let href = $(el).attr("href")?.trim();
    const text = ($(el).text() || "").toLowerCase().trim();

    if (!href && $(el).attr("onclick")) {
      const match = $(el)
        .attr("onclick")
        ?.match(/location\.href\s*[=:]\s*['"]([^'"]+)['"]/i);
      if (match?.[1]) href = match[1];
    }

    if (!href) return;

    let score = 40;

    if (text.includes("1080p") || text.includes("full hd")) score += 70;
    if (text.includes("720p")) score += 50;
    if (text.includes("480p")) score += 30;
    if (text.includes("web-dl") || text.includes("webrip")) score += 25;
    if (text.includes("dual") || text.includes("hindi")) score += 20;

    if (href.includes("hubdrive")) score += 120;
    if (href.includes("gadgetsweb")) score += 90;
    if (href.includes("katfile") || href.includes("1fichier")) score += 60;

    if (/mixdrop|dood|streamtape|filemoon|voe|sfile/i.test(href)) score -= 40;

    const absUrl = toAbsoluteUrl(href, baseUrl);
    if (/^https?:\/\//i.test(absUrl)) {
      candidates.push({
        url: absUrl,
        score,
        quality: text.match(/(1080p|720p|480p)/)?.[1],
      });
    }
  });

  if (!candidates.length) return null;

  candidates.sort((a, b) => {
    const qualOrder: Record<string, number> = { "1080p": 4, "720p": 3, "480p": 1 };
    const qa = a.quality ? qualOrder[a.quality] ?? 0 : 0;
    const qb = b.quality ? qualOrder[b.quality] ?? 0 : 0;
    if (qa !== qb) return qb - qa;
    return b.score - a.score;
  });

  return candidates[0].url;
}

async function tryDecodeWpHttpCookiePayload(
  html: string,
): Promise<string | null> {
  const patterns = [
    /ck\('_wp_http_\d+','([^']+)'/g,
    /setCookie\('_wp_http_\d+',\s*'([^']+)'/g,
    /document\.cookie\s*=\s*["']_wp_http_\d+=["']([^"']+)["']/g,
    /s\('o',\s*'([^']+)'/g,
  ];

  let payload = "";
  for (const re of patterns) {
    let match: RegExpExecArray | null;
    while ((match = re.exec(html)) !== null) {
      payload += match[1];
    }
    if (payload) break;
  }

  if (!payload) return null;

  let decoded = "";
  try {
    decoded = decodeBase64(rot13(decodeBase64(decodeBase64(payload))));
  } catch {
    // Continue with fallback decode variants below.
  }
  if (!decoded) {
    try {
      decoded = decodeBase64(decodeBase64(decodeBase64(payload)));
    } catch {
      // ignore
    }
  }
  if (!decoded) {
    try {
      decoded = decodeBase64(decodeBase64(payload));
    } catch {
      // ignore
    }
  }

  try {
    const json = JSON.parse(decoded) as {
      o?: string;
      l?: string;
      data?: string;
      wp_http1?: string;
    };

    if (json.o && /^https?:\/\//i.test(json.o)) return json.o;
    if (json.l && /^https?:\/\//i.test(json.l)) return json.l;

    if (json.data && json.wp_http1) {
      const token = encodeBase64(json.data);
      const checkUrl = `${json.wp_http1}?re=${token}`;
      await new Promise((resolve) => setTimeout(resolve, 4500));

      const res = await fetch(checkUrl, { headers }).catch(() => null);
      if (res?.ok) {
        const text = await res.text();
        const match = text.match(/var reurl = "([^"]+)"/);
        if (match?.[1]) return toAbsoluteUrl(match[1], checkUrl);
      }
    }
  } catch {
    // ignore parse/decode failures
  }

  return null;
}

function extractGeneralCandidate(
  html: string,
  $: CheerioAPI,
  baseUrl: string,
): string | null {
  const candidates: { url: string; score: number }[] = [];

  const add = (raw?: string, score = 0) => {
    if (!raw) return;
    const url = toAbsoluteUrl(raw.trim(), baseUrl);
    if (!/^https?:\/\//i.test(url)) return;

    let weightedScore = score;
    if (looksLikeFinalMedia(url)) weightedScore += 100;
    if (looksLikeDirectDownloadHost(url)) weightedScore += 140;
    if (/download|direct|480p|720p|1080p/i.test(url)) weightedScore += 40;
    if (/mixdrop|dood|streamtape|filemoon/i.test(url)) weightedScore += 30;

    candidates.push({ url, score: weightedScore });
  };

  add($("iframe").first().attr("src"), 70);

  const metaRefresh = $("meta[http-equiv='refresh']")
    .attr("content")
    ?.match(/url=(.+)/i)?.[1];
  add(metaRefresh, 80);

  add(
    $("[data-link],[data-url],[data-href]").first().attr("data-link") ||
      $("[data-link],[data-url],[data-href]").first().attr("data-url") ||
      $("[data-link],[data-url],[data-href]").first().attr("data-href"),
    65,
  );

  $("a[href]").each((_, el) => {
    const txt = $(el).text().toLowerCase();
    let score = 35;
    if (/download|direct|play|watch|stream|get\s*link/i.test(txt)) score += 45;
    add($(el).attr("href"), score);
  });

  const jsPatterns = [
    /var\s+(?:url|link|downloadUrl|file)\s*=\s*["']([^"']+)["']/, 
    /window\.location(?:\.href)?\s*=\s*["']([^"']+)["']/, 
  ];

  for (const pattern of jsPatterns) {
    const match = html.match(pattern);
    add(match?.[1], 70);
  }

  if (!candidates.length) return null;

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0].url;
}

async function resolveLink(startUrl: string): Promise<string> {
  let current = startUrl.trim();
  const visited = new Set([current]);

  for (let step = 0; step < MAX_STEPS; step += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 14000);

    try {
      const res = await fetch(current, {
        headers,
        redirect: "manual",
        signal: controller.signal,
      }).catch(() => null);

      if (!res) break;

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (location) {
          const redirectUrl = toAbsoluteUrl(location, current);
          if (visited.has(redirectUrl)) break;
          current = redirectUrl;
          visited.add(current);
          continue;
        }
      }

      const html = await res.text().catch(() => "");
      if (!html) break;

      const $ = load(html);
      const next =
        extractHdhub4uPreferredDownload($, current) ||
        (await tryDecodeWpHttpCookiePayload(html)) ||
        extractGeneralCandidate(html, $, current);

      if (!next || next === current || visited.has(next)) break;

      current = next;
      visited.add(current);

      if (looksLikeFinalMedia(current) || looksLikeDirectDownloadHost(current)) break;
    } catch (error) {
      console.error("Step error:", error);
      break;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return current;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Failed to resolve URL";
}

async function handleResolve(url: string) {
  const resolvedUrl = await resolveLink(url);
  const isDirect =
    looksLikeDirectDownloadHost(resolvedUrl) || looksLikeFinalMedia(resolvedUrl);

  return NextResponse.json({
    success: true,
    original: url,
    resolved: resolvedUrl,
    originalUrl: url,
    redirectUrl: resolvedUrl,
    isProbablyDirectDownload: isDirect,
  });
}

export async function GET(request: NextRequest) {
  const validation = await validateProviderAccess(request, "HDHub4u");
  if (!validation.valid) {
    return createProviderErrorResponse(validation.error || "Unauthorized");
  }

  const url = request.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Missing ?url= parameter" }, { status: 400 });
  }

  try {
    return await handleResolve(url);
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const validation = await validateProviderAccess(request, "HDHub4u");
  if (!validation.valid) {
    return createProviderErrorResponse(validation.error || "Unauthorized");
  }

  try {
    const body = (await request.json()) as { url?: string };
    if (!body.url) {
      return NextResponse.json({ error: "Missing url in body" }, { status: 400 });
    }

    return await handleResolve(body.url);
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
