import { NextRequest, NextResponse } from 'next/server';
import { load } from 'cheerio';
import { validateApiKey } from '@/lib/api-auth';

const REQUEST_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

const DIRECT_FILE_PATTERN = /\.(mkv|mp4|avi|mov|webm|m4v|zip|rar|7z)(\?|$)/i;
const DIRECT_HOST_PATTERN = /(hubcdn|hubcloud|hubdrive|pixeldrain|gofile|terabox|dropapk|mediafire|filescdn)/i;

function isLikelyDirectUrl(url: string): boolean {
  return DIRECT_FILE_PATTERN.test(url) || DIRECT_HOST_PATTERN.test(url);
}

function normalizeUrl(value: string | undefined, baseUrl: string): string | null {
  if (!value) return null;

  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return null;
  }
}

function extractLinksFromHtml(html: string, baseUrl: string): string[] {
  const $ = load(html);
  const candidates = new Set<string>();

  const push = (value: string | undefined) => {
    const normalized = normalizeUrl(value, baseUrl);
    if (normalized) {
      candidates.add(normalized);
    }
  };

  $('a[href], iframe[src], source[src], video[src]').each((_, element) => {
    const url = $(element).attr('href') || $(element).attr('src');
    push(url);
  });

  const metaRefresh = $('meta[http-equiv="refresh"]').attr('content');
  if (metaRefresh) {
    const match = metaRefresh.match(/url\s*=\s*([^;]+)/i);
    if (match?.[1]) {
      push(match[1].trim().replace(/^['"]|['"]$/g, ''));
    }
  }

  const scriptPatterns = [
    /(?:file|source|url|link|downloadUrl|redirectUrl)\s*[:=]\s*["']([^"']+)["']/gi,
    /window\.location(?:\.href)?\s*=\s*["']([^"']+)["']/gi,
  ];

  for (const pattern of scriptPatterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(html)) !== null) {
      push(match[1]);
    }
  }

  return [...candidates];
}

async function resolveHubcloudLink(inputUrl: string): Promise<{ directUrl: string; visited: string[] }> {
  let currentUrl = inputUrl;
  const visited: string[] = [];

  for (let step = 0; step < 4; step += 1) {
    visited.push(currentUrl);

    const response = await fetch(currentUrl, {
      headers: REQUEST_HEADERS,
      redirect: 'follow',
      cache: 'no-store',
    });

    const finalUrl = response.url;
    if (!visited.includes(finalUrl)) {
      visited.push(finalUrl);
    }

    if (isLikelyDirectUrl(finalUrl)) {
      return { directUrl: finalUrl, visited };
    }

    const html = await response.text();
    const extractedLinks = extractLinksFromHtml(html, finalUrl);

    const directCandidate = extractedLinks.find(isLikelyDirectUrl);
    if (directCandidate) {
      return { directUrl: directCandidate, visited };
    }

    const nextCandidate = extractedLinks.find((candidate) => !visited.includes(candidate));
    if (!nextCandidate) {
      return { directUrl: finalUrl, visited };
    }

    currentUrl = nextCandidate;
  }

  return { directUrl: currentUrl, visited };
}

async function extractFromRequest(request: NextRequest): Promise<string | null> {
  if (request.method === 'GET') {
    return request.nextUrl.searchParams.get('url');
  }

  const body = (await request.json().catch(() => null)) as { url?: string } | null;
  return body?.url ?? null;
}

async function handleRequest(request: NextRequest) {
  const validation = await validateApiKey(request);
  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.error || 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const url = await extractFromRequest(request);

    if (!url) {
      return NextResponse.json(
        { error: 'URL parameter is required' },
        { status: 400 },
      );
    }

    const { directUrl, visited } = await resolveHubcloudLink(url);

    return NextResponse.json({
      success: true,
      inputUrl: url,
      directUrl,
      visited,
    });
  } catch (error) {
    console.error('Error in hubcloud extractor:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  return handleRequest(request);
}

export async function POST(request: NextRequest) {
  return handleRequest(request);
}
