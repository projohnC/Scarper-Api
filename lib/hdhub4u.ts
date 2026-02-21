import { getProvider } from "./baseurl";
import * as cheerio from "cheerio";

export interface Content {
  id: string;
  title: string;
  url: string;
  imageUrl: string;
}

const REQUEST_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
};

/**
 * Helper to ensure URLs are absolute
 */
export function makeAbsoluteUrl(base: string, path: string): string {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  try {
    const url = new URL(path, base);
    return url.href;
  } catch {
    return path;
  }
}


async function getHdhubBaseUrl(): Promise<string> {
  const provider = await getProvider("hdhub");
  return provider.baseUrl || provider.url;
}

function extractIdFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname.replace(/\/$/, "");
    const lastSegment = pathname.split("/").filter(Boolean).pop() || "";
    return lastSegment;
  } catch {
    return "";
  }
}

function isValidPostUrl(url: string): boolean {
  if (!url) return false;
  if (url.includes("#") || url.startsWith("javascript:")) return false;

  return !/(\/page\/\d+\/?$|\/category\/|\/tag\/|\/author\/|\/wp-content\/|\/feed\/?$)/i.test(url);
}

function shouldExcludeLatestItem(url: string, title: string, baseUrl: string): boolean {
  const normalizedBase = baseUrl.replace(/\/$/, "");
  const normalizedUrl = url.replace(/\/$/, "");

  if (!normalizedUrl || normalizedUrl === normalizedBase) return true;
  if (/\.apk($|\?)/i.test(normalizedUrl)) return true;
  if (/download our official android app/i.test(title)) return true;

  return false;
}

function parseLatestContent(html: string, baseUrl: string): Content[] {
  const $ = cheerio.load(html);
  const seenUrls = new Set<string>();
  const recentMovies: Content[] = [];

  $("a[href]").each((_, element) => {
    const $anchor = $(element);
    const normalizedUrl = makeAbsoluteUrl(baseUrl, $anchor.attr("href") || "");

    if (!isValidPostUrl(normalizedUrl) || seenUrls.has(normalizedUrl)) {
      return;
    }

    const $context = $anchor.closest("article, li, .post, .item, .entry");
    const rawImage =
      $anchor.find("img").first().attr("src") ||
      $anchor.find("img").first().attr("data-src") ||
      $anchor.find("img").first().attr("data-lazy-src") ||
      $context.find("img").first().attr("src") ||
      $context.find("img").first().attr("data-src") ||
      $context.find("img").first().attr("data-lazy-src") ||
      "";

    const title =
      $anchor.attr("title")?.trim() ||
      $anchor.find("img").first().attr("alt")?.trim() ||
      $anchor.find("h1, h2, h3, h4").first().text().trim() ||
      $context.find("h1, h2, h3, h4").first().text().trim() ||
      $anchor.text().trim();

    if (!title || !rawImage || shouldExcludeLatestItem(normalizedUrl, title, baseUrl)) {
      return;
    }

    seenUrls.add(normalizedUrl);
    recentMovies.push({
      id: extractIdFromUrl(normalizedUrl),
      title,
      url: normalizedUrl,
      imageUrl: makeAbsoluteUrl(baseUrl, rawImage),
    });
  });

  return recentMovies;
}

export async function searchContent(
  query: string,
  page: string
): Promise<{ results: Content[]; found: number }> {
  try {
    const res = await fetch(
      `https://scarperapi-8lk0.onrender.com/api/hdhub4u?action=search&q=${encodeURIComponent(
        query
      )}&page=${page}`,
      {
        headers: { "x-api-key": process.env.HDHUB_API_KEY || "" },
        cache: "no-store",
      }
    );

    const json = await res.json();

    if (json.success && json.data.results) {
      const providerBaseUrl = await getHdhubBaseUrl();
      return {
        results: (json.data.results as Record<string, unknown>[]).map(
          (item) => ({
            id: String(item.id || ""),
            title: String(item.title || ""),
            url: makeAbsoluteUrl(providerBaseUrl, String(item.url || "")),
            imageUrl: makeAbsoluteUrl(
              providerBaseUrl,
              String(item.imageUrl || "")
            ),
          })
        ),
        found: (json.data.found as number) || json.data.results.length,
      };
    }
  } catch (err) {
    console.error("API search failed:", err);
  }

  const formattedQuery = query.replace(/\s+/g, "+");

  const searchUrl = `https://search.pingora.fyi/collections/post/documents/search?q=${formattedQuery}&query_by=post_title&page=${page}`;

  const baseUrl = await getHdhubBaseUrl();

  const response = await fetch(searchUrl, {
    headers: {
      Origin: baseUrl.replace(/\/$/, ""),
      Referer: baseUrl,
      "User-Agent": REQUEST_HEADERS["User-Agent"],
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to search HDHub4u: ${response.status}`);
  }

  const data = (await response.json()) as {
    found?: number;
    hits?: Array<{
      document?: {
        id?: string;
        post_title?: string;
        permalink?: string;
        post_thumbnail?: string;
      };
    }>;
  };

  const results: Content[] = [];

  for (const hit of data.hits || []) {
    const doc = hit.document || {};

    const rawUrl = String(doc.permalink || "");
    const rawImage = String(doc.post_thumbnail || "");

    const normalizedUrl = makeAbsoluteUrl(baseUrl, rawUrl);
    const normalizedImage = makeAbsoluteUrl(baseUrl, rawImage);

    if (doc.post_title && normalizedUrl) {
      results.push({
        id: String(doc.id || ""),
        title: String(doc.post_title),
        url: normalizedUrl,
        imageUrl: normalizedImage,
      });
    }
  }

  return {
    results,
    found: typeof data.found === "number" ? data.found : results.length,
  };
}

export async function getLatestContent(page: string): Promise<Content[]> {
  const providerBaseUrl = await getHdhubBaseUrl();
  const pageNumber = Math.max(1, Number.parseInt(page, 10) || 1);
  const pageUrl = pageNumber === 1 ? providerBaseUrl : `${providerBaseUrl.replace(/\/$/, "")}/page/${pageNumber}/`;

  const response = await fetch(pageUrl, {
    headers: {
      "User-Agent": REQUEST_HEADERS["User-Agent"],
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": REQUEST_HEADERS["Accept-Language"],
      "Referer": providerBaseUrl,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch latest HDHub4u page: ${response.status}`);
  }

  const html = await response.text();
  const recentMovies = parseLatestContent(html, providerBaseUrl);

  if (recentMovies.length === 0) {
    console.warn(
      `[HDHub4u] No latest content parsed on page ${pageNumber}. HTML snippet: ${html
        .replace(/\s+/g, " ")
        .slice(0, 800)}`
    );
  }

  return recentMovies;
}

export async function getPostDetails(
  url: string
): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(
      `https://scarperapi-8lk0.onrender.com/api/hdhub4u?action=details&url=${encodeURIComponent(
        url
      )}`,
      {
        headers: { "x-api-key": process.env.HDHUB_API_KEY || "" },
        cache: "no-store",
      }
    );

    const json = await res.json();
    if (json.success && json.data) {
      const providerBaseUrl = await getHdhubBaseUrl();
      if (json.data.imageUrl) {
        json.data.imageUrl = makeAbsoluteUrl(providerBaseUrl, json.data.imageUrl);
      }
      return json.data;
    }
  } catch (err) {
    console.error("API details failed:", err);
  }
  return null;
}

export async function resolveProviderUrl(
  url: string
): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(
      `https://scarperapi-8lk0.onrender.com/api/hdhub4u?action=resolve&url=${encodeURIComponent(
        url
      )}`,
      {
        headers: { "x-api-key": process.env.HDHUB_API_KEY || "" },
        cache: "no-store",
      }
    );

    const json = await res.json();
    if (json.success && json.data) {
      return json.data;
    }
  } catch (err) {
    console.error("API resolve failed:", err);
  }
  return null;
}

export async function detectProvider(url: string): Promise<boolean> {
  const domains = ["hdhub4u", "4khdhub", "gadgetsweb"];
  try {
    const urlObj = new URL(url);
    return domains.some((domain) => urlObj.hostname.includes(domain));
  } catch {
    return false;
  }
}
