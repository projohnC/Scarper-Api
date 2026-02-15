import { NextRequest, NextResponse } from 'next/server';
import { load } from 'cheerio';

const headers = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

const MAX_RESOLVE_STEPS = 5;

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
  return /(\.m3u8|\.mp4|\.mkv|\.avi|\.mov|\.webm|\.mpd)(\?|$)/i.test(url);
}

function extractBestHtmlCandidate(html: string, sourceUrl: string): string | null {
  const $ = load(html);
  const candidates: { url: string; score: number }[] = [];

  const pushCandidate = (raw: string | undefined, score: number) => {
    if (!raw) return;
    const url = toAbsoluteUrl(raw.trim(), sourceUrl);
    if (!/^https?:\/\//i.test(url)) return;

    let finalScore = score;
    if (isLikelyFinalMediaUrl(url)) finalScore += 100;
    if (/download|dl|play|stream|video|hubdrive|hubcdn|pixeldrain|gofile|terabox/i.test(url)) finalScore += 40;
    if (/ad|ads|popunder|short|redirect/i.test(url)) finalScore -= 25;

    candidates.push({ url, score: finalScore });
  };

  const iframeSrc = $('iframe').first().attr('src');
  pushCandidate(iframeSrc, 65);

  const metaRefresh = $('meta[http-equiv="refresh"]').attr('content');
  if (metaRefresh) {
    const urlMatch = metaRefresh.match(/url=(.+)/i);
    pushCandidate(urlMatch?.[1], 70);
  }

  pushCandidate($('[data-link]').first().attr('data-link'), 60);
  pushCandidate($('[data-url]').first().attr('data-url'), 60);
  pushCandidate($('[data-href]').first().attr('data-href'), 60);

  const formAction = $('form').first().attr('action');
  pushCandidate(formAction, 50);
  pushCandidate($('form input[type="hidden"][value^="http"]').first().attr('value'), 60);

  $('a[href]').each((_, element) => {
    const href = $(element).attr('href');
    const text = ($(element).text() || '').toLowerCase();

    let score = 25;
    if (/download|direct|final|get\s*link|continue|play/i.test(text)) score += 40;
    if (/ads|advert|sponsor/i.test(text)) score -= 20;

    pushCandidate(href, score);
  });

  const jsUrlPatterns = [
    /var\s+url\s*=\s*["']([^"']+)["']/,
    /var\s+link\s*=\s*["']([^"']+)["']/,
    /var\s+download\s*=\s*["']([^"']+)["']/,
    /downloadUrl\s*=\s*["']([^"']+)["']/,
    /window\.location\s*=\s*["']([^"']+)["']/,
    /window\.location\.href\s*=\s*["']([^"']+)["']/,
    /setTimeout\([^,]*window\.location\.href\s*=\s*["']([^"']+)["']/,
  ];

  for (const pattern of jsUrlPatterns) {
    const match = html.match(pattern);
    pushCandidate(match?.[1], 75);
  }

  if (!candidates.length) return null;

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0].url;
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
        const downloadLink = decode(data.o);
        if (downloadLink && /^https?:\/\//i.test(downloadLink)) return downloadLink;
      }

      if (data.l && /^https?:\/\//i.test(data.l)) return data.l;
      return data.o ? decode(data.o) : null;
    }

    if (data?.data && data?.wp_http1) {
      const token = encode(data.data);
      const blogLink = `${data.wp_http1}?re=${token}`;

      const waitTime = (Number(data?.total_time || 0) + 3) * 1000;
      if (waitTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }

      let attempts = 0;
      while (attempts < 5) {
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
          attempts += 1;
          await new Promise((resolve) => setTimeout(resolve, 2000));
          continue;
        }

        const reurlMatch = blogText.match(/var reurl = "([^"]+)"/);
        if (reurlMatch?.[1]) return reurlMatch[1];
        break;
      }

      return blogLink;
    }
  } catch (error) {
    console.log('Cookie payload decode failed:', error);
  }

  return null;
}

async function getNextRedirectLink(link: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(link, {
      headers,
      signal: controller.signal,
    }).catch(() => null);

    clearTimeout(timeoutId);

    if (!res || !res.ok) return link;

    const html = await res.text();

    const decodedLink = await decodeFromCookiePayload(html);
    if (decodedLink) return toAbsoluteUrl(decodedLink, link);

    const candidate = extractBestHtmlCandidate(html, link);
    if (candidate) return candidate;

    return link;
  } catch (error) {
    console.log('Error resolving redirect link:', error);
    return link;
  }
}

async function resolveFinalLink(initialUrl: string): Promise<string> {
  let current = initialUrl;
  const visited = new Set<string>([initialUrl]);

  for (let step = 0; step < MAX_RESOLVE_STEPS; step += 1) {
    const next = await getNextRedirectLink(current);

    if (!next || next === current || visited.has(next)) {
      break;
    }

    current = next;
    visited.add(current);

    if (isLikelyFinalMediaUrl(current)) {
      break;
    }
  }

  return current;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Failed to extract redirect URL';
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const url = searchParams.get('url');

    if (!url) {
      return NextResponse.json(
        { error: 'URL parameter is required' },
        { status: 400 },
      );
    }

    const redirectUrl = await resolveFinalLink(url);

    return NextResponse.json({
      success: true,
      originalUrl: url,
      redirectUrl,
    });
  } catch (error: unknown) {
    console.error('Error in extractor:', error);
    return NextResponse.json(
      {
        success: false,
        error: getErrorMessage(error),
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json(
        { error: 'URL parameter is required in request body' },
        { status: 400 },
      );
    }

    const redirectUrl = await resolveFinalLink(url);

    return NextResponse.json({
      success: true,
      originalUrl: url,
      redirectUrl,
    });
  } catch (error: unknown) {
    console.error('Error in extractor:', error);
    return NextResponse.json(
      {
        success: false,
        error: getErrorMessage(error),
      },
      { status: 500 },
    );
  }
}
