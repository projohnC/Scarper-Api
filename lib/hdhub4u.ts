import { getProvider } from "./baseurl";

export interface Content {
  id: string;
  title: string;
  url: string;
  imageUrl: string;
}

const REQUEST_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
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
  try {
    const res = await fetch(
      `https://scarperapi-8lk0.onrender.com/api/hdhub4u?action=latest&page=${page}`,
      {
        headers: { "x-api-key": process.env.HDHUB_API_KEY || "" },
        cache: "no-store",
      }
    );

    const json = await res.json();

    if (json.success && json.data.recentMovies) {
      const providerBaseUrl = await getHdhubBaseUrl();
      return (json.data.recentMovies as Record<string, unknown>[]).map(
        (item) => ({
          id: String(item.id || ""),
          title: String(item.title || ""),
          url: makeAbsoluteUrl(providerBaseUrl, String(item.url || "")),
          imageUrl: makeAbsoluteUrl(
            providerBaseUrl,
            String(item.imageUrl || "")
          ),
        })
      );
    }
  } catch (err) {
    console.error("API latest failed:", err);
  }
  return [];
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