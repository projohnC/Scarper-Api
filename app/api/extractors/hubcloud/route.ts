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
const DIRECT_PATH_PATTERN = /\/(?:d|download|dl)\//i;
const ACTION_TEXT_PATTERN = /(download|direct|instant|get link|generate|continue|proceed|stream)/i;

function isLikelyDirectUrl(url: string): boolean {
  return DIRECT_FILE_PATTERN.test(url) || DIRECT_PATH_PATTERN.test(url) || DIRECT_HOST_PATTERN.test(url);
}

function parseSetCookie(value: string): [string, string] | null {
  const [first] = value.split(';');
  if (!first) return null;

  const eqIndex = first.indexOf('=');
  if (eqIndex === -1) return null;

  const name = first.slice(0, eqIndex).trim();
  const cookieValue = first.slice(eqIndex + 1).trim();

  if (!name) return null;
  return [name, cookieValue];
}

function updateCookiesFromResponse(response: Response, cookies: Map<string, string>) {
  const responseHeaders = response.headers as Headers & {
    getSetCookie?: () => string[];
  };

  const setCookieHeaders = responseHeaders.getSetCookie?.() || [];
  for (const headerValue of setCookieHeaders) {
    const parsed = parseSetCookie(headerValue);
    if (parsed) {
      cookies.set(parsed[0], parsed[1]);
    }
  }

  const fallback = response.headers.get('set-cookie');
  if (fallback) {
    const parsed = parseSetCookie(fallback);
    if (parsed) {
      cookies.set(parsed[0], parsed[1]);
    }
  }
}

function buildCookieHeader(cookies: Map<string, string>): string {
  return [...cookies.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
}

async function fetchWithTimeout(url: string, options: RequestInit): Promise<Response | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      cache: 'no-store',
    });
  } catch (error) {
    console.log('[hubcloud extractor] fetch failed:', error instanceof Error ? error.message : String(error));
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
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
  const prioritized: string[] = [];
  const candidates = new Set<string>();

  const push = (value: string | undefined, contextText = '') => {
    const normalized = normalizeUrl(value, baseUrl);
    if (normalized) {
      if (ACTION_TEXT_PATTERN.test(contextText.toLowerCase()) || isLikelyDirectUrl(normalized)) {
        prioritized.push(normalized);
      }
      candidates.add(normalized);
    }
  };

  $('a[href], iframe[src], source[src], video[src]').each((_, element) => {
    const url = $(element).attr('href') || $(element).attr('src');
    push(url, $(element).text());
  });

  $('button[onclick], input[onclick]').each((_, element) => {
    const onclick = $(element).attr('onclick');
    if (!onclick) {
      return;
    }

    const onclickMatch = onclick.match(/["'](https?:\/\/[^"']+|\/[^"']+)["']/i);
    if (onclickMatch?.[1]) {
      push(onclickMatch[1], $(element).text());
    }
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

  return [...new Set([...prioritized, ...candidates])];
}

async function submitDownloadForms(
  html: string,
  pageUrl: string,
  cookies: Map<string, string>,
): Promise<string | null> {
  const $ = load(html);
  const forms = $('form').toArray();

  for (const formEl of forms) {
    const form = $(formEl);
    const formText = form.text().trim().toLowerCase();
    if (formText && !ACTION_TEXT_PATTERN.test(formText)) {
      continue;
    }

    const action = normalizeUrl(form.attr('action') || pageUrl, pageUrl);
    if (!action) {
      continue;
    }

    const method = (form.attr('method') || 'GET').toUpperCase();
    const params = new URLSearchParams();
    form.find('input').each((_, input) => {
      const inputEl = $(input);
      const name = inputEl.attr('name');
      if (!name) {
        return;
      }

      params.append(name, inputEl.attr('value') || '');
    });

    const headers: Record<string, string> = {
      ...REQUEST_HEADERS,
      Referer: pageUrl,
    };
    const cookieHeader = buildCookieHeader(cookies);
    if (cookieHeader) {
      headers.Cookie = cookieHeader;
    }

    let targetUrl = action;
    const options: RequestInit = {
      method,
      headers,
      redirect: 'follow',
    };

    if (method === 'GET') {
      const separator = action.includes('?') ? '&' : '?';
      targetUrl = `${action}${params.toString() ? `${separator}${params.toString()}` : ''}`;
    } else {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      options.body = params.toString();
    }

    const response = await fetchWithTimeout(targetUrl, options);
    if (!response) {
      continue;
    }

    updateCookiesFromResponse(response, cookies);

    if (isLikelyDirectUrl(response.url)) {
      return response.url;
    }

    const body = await response.text();
    const extractedLinks = extractLinksFromHtml(body, response.url);
    const directCandidate = extractedLinks.find(isLikelyDirectUrl);
    if (directCandidate) {
      return directCandidate;
    }

    const nextCandidate = extractedLinks.find(Boolean);
    if (nextCandidate) {
      return nextCandidate;
    }
  }

  return null;
}

async function resolveHubcloudLink(inputUrl: string): Promise<{ directUrl: string; visited: string[] }> {
  let currentUrl = inputUrl;
  const visited: string[] = [];
  const visitedSet = new Set<string>();
  const cookies = new Map<string, string>();

  for (let step = 0; step < 8; step += 1) {
    if (visitedSet.has(currentUrl)) {
      break;
    }

    visitedSet.add(currentUrl);
    visited.push(currentUrl);

    const headers: Record<string, string> = {
      ...REQUEST_HEADERS,
      Referer: currentUrl,
    };
    const cookieHeader = buildCookieHeader(cookies);
    if (cookieHeader) {
      headers.Cookie = cookieHeader;
    }

    const response = await fetchWithTimeout(currentUrl, {
      headers,
      redirect: 'follow',
    });
    if (!response) {
      break;
    }

    updateCookiesFromResponse(response, cookies);

    const finalUrl = response.url;
    if (!visited.includes(finalUrl)) {
      visited.push(finalUrl);
      visitedSet.add(finalUrl);
    }

    if (isLikelyDirectUrl(finalUrl)) {
      return { directUrl: finalUrl, visited };
    }

    const contentDisposition = response.headers.get('content-disposition') || '';
    const contentType = response.headers.get('content-type') || '';

    if (/attachment/i.test(contentDisposition) || /application\/(?:octet-stream|x-mpegurl)/i.test(contentType)) {
      return { directUrl: finalUrl, visited };
    }

    const html = await response.text();

    const formResult = await submitDownloadForms(html, finalUrl, cookies);
    if (formResult && !visitedSet.has(formResult)) {
      if (isLikelyDirectUrl(formResult)) {
        visited.push(formResult);
        return { directUrl: formResult, visited };
      }
      currentUrl = formResult;
      continue;
    }

    const extractedLinks = extractLinksFromHtml(html, finalUrl);

    const directCandidate = extractedLinks.find(isLikelyDirectUrl);
    if (directCandidate) {
      return { directUrl: directCandidate, visited };
    }

    const nextCandidate = extractedLinks.find((candidate) => !visitedSet.has(candidate));
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
