import { NextRequest, NextResponse } from 'next/server';
import { load } from 'cheerio';

const headers = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

const MAX_RESOLVE_STEPS = 6;
const MAX_BRANCHES_PER_PAGE = 8;

const MEDIA_EXT_PATTERN = /(\.m3u8|\.mp4|\.mkv|\.avi|\.mov|\.webm|\.mpd)(\?|$)/i;
const DIRECT_HOST_PATTERN = /hub\.cooldown\.buzz|hubcdn|hubdrive|pixeldrain|gofile|terabox|usersdrive|dd\.xyz|cdn/i;

function encode(value: string | undefined): string {
  if (!value) return '';
  return btoa(value.toString());
}

function decode(value: string | undefined): string {
  if (!value) return '';
  return atob(value.toString());
}

function pen(value: string): string {
  return value.replace(/[a-zA-Z]/g, function (char: string) {
    return String.fromCharCode(
      (char <= 'Z' ? 90 : 122) >= char.charCodeAt(0) + 13
        ? char.charCodeAt(0) + 13
        : char.charCodeAt(0) + 13 - 26,
    );
  });
}

function toAbsoluteUrl(candidate: string, baseUrl: string): string {
  try {
    return new URL(candidate, baseUrl).toString();
  } catch {
    return candidate;
  }
}

function isLikelyFinalMediaUrl(url: string): boolean {
  return MEDIA_EXT_PATTERN.test(url);
}

function isLikelyDirectDownloadUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const hasToken = parsed.searchParams.has('token') || parsed.searchParams.has('download');
    const isKnownFileHost =
      DIRECT_HOST_PATTERN.test(host);

    if (isKnownFileHost && hasToken) return true;
    if (isKnownFileHost && parsed.pathname.length > 24) return true;
    if (/\/d\//i.test(parsed.pathname) && isKnownFileHost) return true;
  } catch {
    return false;
  }

  return false;
}

function scoreCandidate(rawUrl: string, contextText: string): number {
  let score = 20;

  if (isLikelyFinalMediaUrl(rawUrl)) score += 140;
  if (isLikelyDirectDownloadUrl(rawUrl)) score += 120;

  if (/download|direct|final|continue|play|get\s*link|stream|token=/i.test(contextText)) score += 55;
  if (DIRECT_HOST_PATTERN.test(rawUrl)) score += 65;

  if (/ad|ads|popunder|short|sponsor|traffic|monetize|redirect/i.test(rawUrl)) score -= 40;
  if (/ad|ads|sponsor/i.test(contextText)) score -= 30;

  return score;
}

function extractHtmlCandidates(html: string, sourceUrl: string): string[] {
  const $ = load(html);
  const candidates: { url: string; score: number }[] = [];

  const pushCandidate = (raw: string | undefined, contextText: string, baseScore = 0) => {
    if (!raw) return;
    const normalized = toAbsoluteUrl(raw.trim(), sourceUrl);
    if (!/^https?:\/\//i.test(normalized)) return;

    candidates.push({
      url: normalized,
      score: scoreCandidate(normalized, contextText) + baseScore,
    });
  };

  pushCandidate($('iframe').first().attr('src'), 'iframe', 25);

  const metaRefresh = $('meta[http-equiv="refresh"]').attr('content');
  if (metaRefresh) {
    const matched = metaRefresh.match(/url=(.+)/i)?.[1];
    pushCandidate(matched, 'meta refresh', 40);
  }

  pushCandidate($('[data-link]').first().attr('data-link'), 'data-link', 30);
  pushCandidate($('[data-url]').first().attr('data-url'), 'data-url', 30);
  pushCandidate($('[data-href]').first().attr('data-href'), 'data-href', 30);

  pushCandidate($('form').first().attr('action'), 'form action', 15);
  pushCandidate(
    $('form input[type="hidden"][value^="http"]').first().attr('value'),
    'hidden input value',
    30,
  );

  $('a[href]').each((_, element) => {
    const href = $(element).attr('href');
    const text = ($(element).text() || '').trim();
    pushCandidate(href, text, 10);
  });

  const jsPatterns = [
    /var\s+url\s*=\s*["']([^"']+)["']/,
    /var\s+link\s*=\s*["']([^"']+)["']/,
    /var\s+download\s*=\s*["']([^"']+)["']/,
    /downloadUrl\s*=\s*["']([^"']+)["']/,
    /window\.location\s*=\s*["']([^"']+)["']/,
    /window\.location\.href\s*=\s*["']([^"']+)["']/,
    /setTimeout\([^,]*window\.location\.href\s*=\s*["']([^"']+)["']/,
  ];

  for (const pattern of jsPatterns) {
    const matched = html.match(pattern)?.[1];
    pushCandidate(matched, 'javascript redirect', 40);
  }

  const deduped = new Map<string, number>();
  for (const candidate of candidates) {
    const previous = deduped.get(candidate.url) ?? Number.NEGATIVE_INFINITY;
    if (candidate.score > previous) {
      deduped.set(candidate.url, candidate.score);
    }
  }

  return [...deduped.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_BRANCHES_PER_PAGE)
    .map(([url]) => url);
}

async function decodeFromCookiePayload(html: string): Promise<string | null> {
  const patterns = [
    /ck\('_wp_http_\d+','([^']+)'/g,
    /setCookie\('_wp_http_\d+',\s*'([^']+)'/g,
    /document\.cookie\s*=\s*["']_wp_http_\d+=['"]([^'"]+)['"]/g,
    /s\('o',\s*'([^']+)'/g,
  ];

  let combinedString = '';
  for (const regex of patterns) {
    let match;
    while ((match = regex.exec(html)) !== null) {
      combinedString += match[1];
    }
    if (combinedString) break;
  }

  if (!combinedString) return null;

  try {
    let decodedString: string;
    try {
      decodedString = decode(pen(decode(decode(combinedString))));
    } catch {
      try {
        decodedString = decode(decode(decode(combinedString)));
      } catch {
        decodedString = decode(decode(combinedString));
      }
    }

    const data = JSON.parse(decodedString) as {
      o?: string;
      l?: string;
      data?: string;
      wp_http1?: string;
      total_time?: string | number;
    };

    if (data.o || data.l) {
      if (data.o) {
        const decodedLink = decode(data.o);
        if (/^https?:\/\//i.test(decodedLink)) return decodedLink;
      }
      if (data.l && /^https?:\/\//i.test(data.l)) return data.l;
    }

    if (data?.data && data?.wp_http1) {
      const token = encode(data.data);
      const blogLink = `${data.wp_http1}?re=${token}`;

      const waitTime = (Number(data?.total_time || 0) + 3) * 1000;
      if (waitTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }

      for (let attempt = 0; attempt < 5; attempt += 1) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const blogRes = await fetch(blogLink, {
          headers,
          signal: controller.signal,
        }).catch(() => null);

        clearTimeout(timeoutId);
        if (!blogRes) break;

        const blogText = await blogRes.text();
        if (blogText.includes('Invalid Request')) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          continue;
        }

        const reurl = blogText.match(/var reurl = "([^"]+)"/)?.[1];
        if (reurl) return reurl;
        break;
      }

      return blogLink;
    }
  } catch (error) {
    console.log('Cookie decode failed:', error);
  }

  return null;
}

async function getNextRedirectLinks(link: string): Promise<{ links: string[]; final?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(link, {
      headers,
      signal: controller.signal,
      redirect: 'follow',
    }).catch(() => null);

    clearTimeout(timeoutId);

    if (!response || !response.ok) {
      return { links: [] };
    }

    const contentType = response.headers.get('content-type')?.toLowerCase() || '';
    const finalUrl = response.url || link;

    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      return { links: [], final: finalUrl };
    }

    const html = await response.text();

    const decoded = await decodeFromCookiePayload(html);
    const links: string[] = [];

    if (decoded) {
      links.push(toAbsoluteUrl(decoded, finalUrl));
    }

    const htmlCandidates = extractHtmlCandidates(html, finalUrl);
    links.push(...htmlCandidates);

    const uniqueLinks = [...new Set(links)].filter((candidate) => candidate !== link);

    return { links: uniqueLinks };
  } catch (error) {
    console.log('getNextRedirectLinks error:', error);
    return { links: [] };
  }
}

async function resolveFinalLink(initialUrl: string): Promise<string> {
  const queue: Array<{ url: string; depth: number }> = [{ url: initialUrl, depth: 0 }];
  const visited = new Set<string>([initialUrl]);
  let bestSeen = initialUrl;

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;

    const { url, depth } = current;
    bestSeen = url;

    if (isLikelyFinalMediaUrl(url) || isLikelyDirectDownloadUrl(url)) {
      return url;
    }

    if (depth >= MAX_RESOLVE_STEPS) {
      continue;
    }

    const { links, final } = await getNextRedirectLinks(url);

    if (final && (isLikelyFinalMediaUrl(final) || isLikelyDirectDownloadUrl(final))) {
      return final;
    }

    for (const nextLink of links) {
      if (visited.has(nextLink)) continue;
      visited.add(nextLink);
      queue.push({ url: nextLink, depth: depth + 1 });
    }
  }

  return bestSeen;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Failed to extract redirect URL';
}

function successResponse(originalUrl: string, redirectUrl: string) {
  return NextResponse.json({
    success: true,
    originalUrl,
    redirectUrl,
  });
}

export async function GET(request: NextRequest) {
  try {
    const url = request.nextUrl.searchParams.get('url');
    if (!url) {
      return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
    }

    const redirectUrl = await resolveFinalLink(url);
    return successResponse(url, redirectUrl);
  } catch (error: unknown) {
    console.error('Error in extractor:', error);
    return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { url?: string };
    const url = body.url;

    if (!url) {
      return NextResponse.json({ error: 'URL parameter is required in request body' }, { status: 400 });
    }

    const redirectUrl = await resolveFinalLink(url);
    return successResponse(url, redirectUrl);
  } catch (error: unknown) {
    console.error('Error in extractor:', error);
    return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: 500 });
  }
}
