import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { validateProviderAccess, createProviderErrorResponse } from "@/lib/provider-validator";

interface DownloadLink {
  quality: string;
  url: string;
  type?: string;
}

interface Episode {
  episode: string;
  links: DownloadLink[];
}

interface MovieDetails {
  title: string;
  imageUrl: string;
  description: string;
  downloadLinks: DownloadLink[];
  episodes: Episode[];
}

const REQUEST_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
};

const DIRECT_FILE_PATTERN = /\.(mkv|mp4|avi|mov|webm|m4v|zip|rar|7z|srt)(?:\?|#|$)/i;
const DIRECT_SIGNAL_PATTERN = /(token=|download=1|\/dl\/|\/download\/|hub\.fsl-|pixeldrain|mediafire|gofile|terabox|dropapk|filescdn)/i;

function decode(value: string): string {
  return atob(value.toString());
}

function encode(value: string): string {
  return btoa(value.toString());
}

function pen(value: string): string {
  return value.replace(/[a-zA-Z]/g, (char: string) =>
    String.fromCharCode(
      (char <= "Z" ? 90 : 122) >= char.charCodeAt(0) + 13
        ? char.charCodeAt(0) + 13
        : char.charCodeAt(0) + 13 - 26,
    ),
  );
}

function normalizeUrl(value: string | undefined, baseUrl: string): string | null {
  if (!value) return null;

  try {
    return new URL(value.trim(), baseUrl).toString();
  } catch {
    return null;
  }
}

function inferQuality(text: string): string {
  const value = text.replace(/\s+/g, " ").trim();
  if (!value) {
    return "UNKNOWN";
  }

  return value;
}

function isLikelyDirectUrl(url: string): boolean {
  return DIRECT_FILE_PATTERN.test(url) || DIRECT_SIGNAL_PATTERN.test(url);
}

function extractScriptLinks(html: string, baseUrl: string): string[] {
  const links = new Set<string>();

  const push = (value: string | undefined) => {
    const normalized = normalizeUrl(value, baseUrl);
    if (normalized) {
      links.add(normalized);
    }
  };

  const patterns = [
    /(?:window\.location(?:\.href)?|location\.href)\s*=\s*["']([^"']+)["']/gi,
    /(?:file|source|url|link|downloadUrl|redirectUrl)\s*[:=]\s*["']([^"']+)["']/gi,
    /open\(["']([^"']+)["']/gi,
  ];

  for (const regex of patterns) {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(html)) !== null) {
      push(match[1]);
    }
  }

  return [...links];
}

function parseSetCookie(value: string): [string, string] | null {
  const [first] = value.split(";");
  if (!first) return null;

  const eqIndex = first.indexOf("=");
  if (eqIndex === -1) return null;

  const name = first.slice(0, eqIndex).trim();
  const cookieValue = first.slice(eqIndex + 1).trim();
  if (!name) return null;

  return [name, cookieValue];
}

function updateCookiesFromResponse(response: Response, cookies: Map<string, string>) {
  const responseHeaders = response.headers as Headers & { getSetCookie?: () => string[] };
  const setCookieHeaders = responseHeaders.getSetCookie?.() || [];

  for (const value of setCookieHeaders) {
    const parsed = parseSetCookie(value);
    if (parsed) {
      cookies.set(parsed[0], parsed[1]);
    }
  }

  const fallback = response.headers.get("set-cookie");
  if (fallback) {
    const parsed = parseSetCookie(fallback);
    if (parsed) {
      cookies.set(parsed[0], parsed[1]);
    }
  }
}

function buildCookieHeader(cookies: Map<string, string>): string {
  return [...cookies.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
}

async function fetchWithTimeout(url: string, options: RequestInit): Promise<Response | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      cache: "no-store",
      redirect: "follow",
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function decodeGadgetLink(link: string): Promise<string | null> {
  const response = await fetchWithTimeout(link, {
    headers: REQUEST_HEADERS,
  });

  if (!response) {
    return null;
  }

  const html = await response.text();

  const encrypted = html.split("s('o','")?.[1]?.split("',180")?.[0];
  if (!encrypted) {
    return null;
  }

  try {
    const decodedPayload = decode(pen(decode(decode(encrypted))));
    const data = JSON.parse(decodedPayload) as {
      o?: string;
      data?: string;
      wp_http1?: string;
      total_time?: number | string;
      l?: string;
    };

    if (data.o) {
      const decodedUrl = decode(data.o);
      if (decodedUrl.startsWith("http")) {
        return decodedUrl;
      }
    }

    if (data.l?.startsWith("http")) {
      return data.l;
    }

    if (data.data && data.wp_http1) {
      const token = encode(data.data);
      const blogLink = `${data.wp_http1}?re=${token}`;
      const waitTime = (Number(data.total_time || 0) + 3) * 1000;
      if (waitTime > 0 && waitTime < 30000) {
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }

      const blogRes = await fetchWithTimeout(blogLink, { headers: REQUEST_HEADERS });
      if (!blogRes) {
        return blogLink;
      }

      const blogText = await blogRes.text();
      const reurlMatch = blogText.match(/var reurl = "([^"]+)"/);
      return reurlMatch?.[1] || blogRes.url || blogLink;
    }

    return null;
  } catch {
    return null;
  }
}

async function resolveDownloadUrl(originalUrl: string): Promise<string> {
  const cookies = new Map<string, string>();
  const visited = new Set<string>();
  let currentUrl = originalUrl;

  for (let hop = 0; hop < 8; hop += 1) {
    if (visited.has(currentUrl)) {
      break;
    }

    visited.add(currentUrl);

    if (/gadgetsweb\.xyz/i.test(new URL(currentUrl).hostname)) {
      const gadgetDecoded = await decodeGadgetLink(currentUrl);
      if (gadgetDecoded && !visited.has(gadgetDecoded)) {
        currentUrl = gadgetDecoded;
      }
    }

    if (isLikelyDirectUrl(currentUrl)) {
      return currentUrl;
    }

    const requestHeaders: Record<string, string> = {
      ...REQUEST_HEADERS,
      Referer: currentUrl,
    };

    const cookieHeader = buildCookieHeader(cookies);
    if (cookieHeader) {
      requestHeaders.Cookie = cookieHeader;
    }

    const response = await fetchWithTimeout(currentUrl, { headers: requestHeaders });
    if (!response) {
      return currentUrl;
    }

    updateCookiesFromResponse(response, cookies);

    const resolvedUrl = response.url;
    if (isLikelyDirectUrl(resolvedUrl)) {
      return resolvedUrl;
    }

    const contentDisposition = response.headers.get("content-disposition") || "";
    const contentType = response.headers.get("content-type") || "";
    if (/attachment/i.test(contentDisposition) || /application\/octet-stream/i.test(contentType)) {
      return resolvedUrl;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const directButtonHref = normalizeUrl($("a#dllink").attr("href"), resolvedUrl);
    if (directButtonHref) {
      return directButtonHref;
    }

    const anchorCandidates = new Set<string>();

    $("a[href], iframe[src], source[src], video[src]").each((_, element) => {
      const candidate = normalizeUrl($(element).attr("href") || $(element).attr("src"), resolvedUrl);
      if (candidate) {
        anchorCandidates.add(candidate);
      }
    });

    for (const scriptLink of extractScriptLinks(html, resolvedUrl)) {
      anchorCandidates.add(scriptLink);
    }

    const nextByText = $("a[href]")
      .toArray()
      .map((element) => ({
        href: normalizeUrl($(element).attr("href"), resolvedUrl),
        text: $(element).text().toLowerCase(),
      }))
      .find((item) => item.href && /(download here|direct|instant|get link|proceed|continue)/i.test(item.text));

    if (nextByText?.href) {
      anchorCandidates.add(nextByText.href);
    }

    if (/hubdrive|hubcloud|hubcdn/i.test(new URL(resolvedUrl).hostname) && /\/file\//i.test(new URL(resolvedUrl).pathname)) {
      anchorCandidates.add(`${new URL(resolvedUrl).origin}/newdl`);
    }

    const directCandidate = [...anchorCandidates].find(isLikelyDirectUrl);
    if (directCandidate) {
      return directCandidate;
    }

    const nextCandidate = [...anchorCandidates].find((candidate) => !visited.has(candidate));
    if (!nextCandidate) {
      return resolvedUrl;
    }

    currentUrl = nextCandidate;
  }

  return currentUrl;
}

export async function GET(request: NextRequest) {
  const validation = await validateProviderAccess(request, "HDHub4u");
  if (!validation.valid) {
    return createProviderErrorResponse(validation.error || "Unauthorized");
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const url = searchParams.get("url");
    const shouldResolve = searchParams.get("resolve") !== "false";

    if (!url) {
      return NextResponse.json({ error: "URL parameter is required" }, { status: 400 });
    }

    const response = await fetch(url, {
      headers: REQUEST_HEADERS,
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch movie details" }, { status: response.status });
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const title =
      $("h1.entry-title").text().trim() ||
      $("h2").first().text().trim() ||
      $("meta[property='og:title']").attr("content") ||
      "";

    const imageUrl =
      $(".entry-content img").first().attr("src") ||
      $("meta[property='og:image']").attr("content") ||
      "";

    const description =
      $("meta[name='description']").attr("content") ||
      $(".entry-content p").first().text().trim() ||
      "";

    const downloadLinks: DownloadLink[] = [];
    const episodes: Episode[] = [];

    const pushLink = (target: DownloadLink[], qualityText: string, href: string | undefined) => {
      const normalized = normalizeUrl(href, url);
      if (!normalized) {
        return;
      }

      target.push({
        quality: inferQuality(qualityText),
        url: normalized,
      });
    };

    $(".entry-content a[href]").each((_, anchor) => {
      const linkText = $(anchor).text().trim();
      pushLink(downloadLinks, linkText, $(anchor).attr("href"));
    });

    $("h3, h4, h5").each((_, heading) => {
      const headingText = $(heading).text().trim();
      if (!/episode\s*\d+/i.test(headingText)) {
        return;
      }

      const episodeLinks: DownloadLink[] = [];
      $(heading)
        .nextUntil("h3, h4, h5")
        .find("a[href]")
        .each((_, anchor) => {
          const linkText = $(anchor).text().trim();
          pushLink(episodeLinks, linkText || headingText, $(anchor).attr("href"));
        });

      if (episodeLinks.length > 0) {
        episodes.push({ episode: headingText, links: episodeLinks });
      }
    });

    const dedupedDownloads = Array.from(new Map(downloadLinks.map((link) => [link.url, link])).values());

    const resolvedDownloadLinks = shouldResolve
      ? await Promise.all(
          dedupedDownloads.map(async (link) => ({
            ...link,
            url: await resolveDownloadUrl(link.url),
          })),
        )
      : dedupedDownloads;

    const resolvedEpisodes = shouldResolve
      ? await Promise.all(
          episodes.map(async (episode) => ({
            episode: episode.episode,
            links: await Promise.all(
              episode.links.map(async (link) => ({
                ...link,
                url: await resolveDownloadUrl(link.url),
              })),
            ),
          })),
        )
      : episodes;

    const movieDetails: MovieDetails = {
      title,
      imageUrl,
      description,
      downloadLinks: resolvedDownloadLinks,
      episodes: resolvedEpisodes,
    };

    return NextResponse.json({ success: true, data: movieDetails });
  } catch (error) {
    console.error("Error in HDHub4u Details API:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
