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
      return {
        results: json.data.results,
        found: json.data.found || json.data.results.length,
      };
    }
  } catch (err) {
    console.error("API search failed:", err);
  }

  const formattedQuery = query.replace(/\s+/g, "+");

  const searchUrl = `https://search.pingora.fyi/collections/post/documents/search?q=${formattedQuery}&query_by=post_title&page=${page}`;

  // 🔥 Hard fallback base URL
  const baseUrl =
    (await getBaseUrl("hdhub")) ||
    process.env.HDHUB4U_BASE ||
    "https://new2.hdhub4u.fo";

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

    const normalizedUrl =
      rawUrl.startsWith("http")
        ? rawUrl
        : `${baseUrl.replace(/\/$/, "")}${rawUrl}`;

    const normalizedImage =
      rawImage.startsWith("http")
        ? rawImage
        : `${baseUrl.replace(/\/$/, "")}${rawImage}`;

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