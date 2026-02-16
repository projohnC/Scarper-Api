import { NextRequest, NextResponse } from 'next/server';
import { load } from 'cheerio';

const headers = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

const DIRECT_FILE_PATTERN = /\.(mkv|mp4|avi|mov|webm|m4v|zip|rar|7z|srt)(?:\?|#|$)/i;
const DIRECT_SIGNAL_PATTERN = /(token=|download=1|\/dl\/|\/download\/|hub\.fsl-|pixeldrain|mediafire|gofile)/i;
const INTERMEDIATE_SIGNAL_PATTERN = /(hubcdn|hubcloud|hubdrive)/i;
const BUTTON_TEXT_PATTERN = /(direct|instant|download here|download now|generate|get link|create download|continue|proceed)/i;

function encode(value: string | undefined): string {
  if (!value) {
    return '';
  }

  return btoa(value.toString());
}

function decode(value: string | undefined): string {
  if (!value || value === undefined) {
    return '';
  }

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

function normalizeUrl(value: string | undefined, baseUrl: string): string | null {
  if (!value) {
    return null;
  }

  try {
    return new URL(value.trim(), baseUrl).toString();
  } catch {
    return null;
  }
}

function isLikelyDirectUrl(url: string): boolean {
  return DIRECT_FILE_PATTERN.test(url) || DIRECT_SIGNAL_PATTERN.test(url);
}

function isPreferredCandidate(url: string): boolean {
  return isLikelyDirectUrl(url) || INTERMEDIATE_SIGNAL_PATTERN.test(url);
}

function buildCookieHeader(cookies: Map<string, string>): string {
  return Array.from(cookies.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

function updateCookiesFromResponse(response: Response, cookies: Map<string, string>) {
  const responseHeaders = response.headers as Headers & {
    getSetCookie?: () => string[];
  };

  const setCookieHeaders = responseHeaders.getSetCookie?.() || [];

  for (const cookie of setCookieHeaders) {
    const [pair] = cookie.split(';');
    const [name, value] = pair.split('=');

    if (name && value !== undefined) {
      cookies.set(name.trim(), value.trim());
    }
  }
}

async function fetchWithTimeout(url: string, options: RequestInit): Promise<Response | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    console.log('Fetch error:', error instanceof Error ? error.message : String(error));
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

function extractScriptUrls(html: string, baseUrl: string): string[] {
  const patterns = [
    /(?:window\.location(?:\.href)?|location\.href)\s*=\s*["']([^"']+)["']/gi,
    /(?:file|source|url|link|downloadUrl|redirectUrl)\s*[:=]\s*["']([^"']+)["']/gi,
    /open\(["']([^"']+)["']/gi,
  ];

  const links = new Set<string>();

  for (const regex of patterns) {
    let match: RegExpExecArray | null;

    while ((match = regex.exec(html)) !== null) {
      const normalized = normalizeUrl(match[1], baseUrl);
      if (normalized) {
        links.add(normalized);
      }
    }
  }

  return [...links];
}

function extractPriorityLinks(html: string, baseUrl: string): string[] {
  const $ = load(html);
  const prioritized: string[] = [];
  const fallback: string[] = [];

  const pushLink = (value: string | undefined, text = '') => {
    const normalized = normalizeUrl(value, baseUrl);
    if (!normalized) {
      return;
    }

    if (BUTTON_TEXT_PATTERN.test(text) || isLikelyDirectUrl(normalized)) {
      prioritized.push(normalized);
      return;
    }

    fallback.push(normalized);
  };

  $('a[href]').each((_, element) => {
    const anchor = $(element);
    pushLink(anchor.attr('href'), anchor.text().trim().toLowerCase());

    const onclick = anchor.attr('onclick');
    if (onclick) {
      const onclickMatch = onclick.match(/["'](https?:\/\/[^"']+|\/[^"']+)["']/i);
      if (onclickMatch?.[1]) {
        pushLink(onclickMatch[1], anchor.text().trim().toLowerCase());
      }
    }
  });

  $('button[onclick], input[onclick]').each((_, element) => {
    const onclick = $(element).attr('onclick');
    if (!onclick) {
      return;
    }

    const onclickMatch = onclick.match(/["'](https?:\/\/[^"']+|\/[^"']+)["']/i);
    if (onclickMatch?.[1]) {
      pushLink(onclickMatch[1], $(element).text().trim().toLowerCase());
    }
  });

  const metaRefresh = $('meta[http-equiv="refresh"]').attr('content');
  if (metaRefresh) {
    const match = metaRefresh.match(/url\s*=\s*([^;]+)/i);
    if (match?.[1]) {
      pushLink(match[1].trim().replace(/^['"]|['"]$/g, ''), 'refresh');
    }
  }

  $('iframe[src], source[src], video[src]').each((_, element) => {
    const src = $(element).attr('src');
    pushLink(src, 'embed');
  });

  for (const link of extractScriptUrls(html, baseUrl)) {
    pushLink(link, 'script');
  }

  const deduped = new Set<string>();
  for (const item of [...prioritized, ...fallback]) {
    deduped.add(item);
  }

  return [...deduped];
}

async function submitCandidateForms(
  html: string,
  pageUrl: string,
  cookies: Map<string, string>,
): Promise<string | null> {
  const $ = load(html);

  const forms = $('form').toArray();

  for (const formElement of forms) {
    const form = $(formElement);
    const formText = form.text().trim().toLowerCase();

    if (formText && !BUTTON_TEXT_PATTERN.test(formText) && !/download|link/.test(formText)) {
      continue;
    }

    const action = normalizeUrl(form.attr('action') || pageUrl, pageUrl);
    if (!action) {
      continue;
    }

    const method = (form.attr('method') || 'GET').toUpperCase();
    const params = new URLSearchParams();

    form.find('input').each((_, inputEl) => {
      const input = $(inputEl);
      const name = input.attr('name');
      if (!name) {
        return;
      }

      params.append(name, input.attr('value') || '');
    });

    const cookieHeader = buildCookieHeader(cookies);
    const requestHeaders: Record<string, string> = {
      ...headers,
      Referer: pageUrl,
    };

    if (cookieHeader) {
      requestHeaders.Cookie = cookieHeader;
    }

    let targetUrl = action;
    let requestOptions: RequestInit = {
      method,
      headers: requestHeaders,
      redirect: 'follow',
      cache: 'no-store',
    };

    if (method === 'GET') {
      const separator = action.includes('?') ? '&' : '?';
      targetUrl = `${action}${params.toString() ? `${separator}${params.toString()}` : ''}`;
    } else {
      requestHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
      requestOptions = {
        ...requestOptions,
        body: params.toString(),
      };
    }

    const response = await fetchWithTimeout(targetUrl, requestOptions);
    if (!response) {
      continue;
    }

    updateCookiesFromResponse(response, cookies);

    if (isLikelyDirectUrl(response.url)) {
      return response.url;
    }

    const body = await response.text();
    const links = extractPriorityLinks(body, response.url);
    const direct = links.find(isLikelyDirectUrl);

    if (direct) {
      return direct;
    }

    const nextStep = links.find(isPreferredCandidate) || links.find(Boolean);
    if (nextStep) {
      return nextStep;
    }
  }

  return null;
}

async function decodeLegacyPayload(resText: string, originalLink: string): Promise<string | null> {
  const patterns = [
    /ck\('_wp_http_\d+','([^']+)'/g,
    /setCookie\('_wp_http_\d+',\s*'([^']+)'/g,
    /document\.cookie\s*=\s*["']_wp_http_\d+=['"]([^'"]+)['"]/g,
    /s\('o',\s*'([^']+)'/g,
  ];

  let combinedString = '';

  for (const regex of patterns) {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(resText)) !== null) {
      combinedString += match[1];
    }

    if (combinedString) {
      break;
    }
  }

  if (!combinedString) {
    return null;
  }

  try {
    let decodedString = '';

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
      const decodedO = data.o ? decode(data.o) : '';

      if (decodedO.startsWith('http')) {
        return decodedO;
      }

      if (data.l?.startsWith('http')) {
        return data.l;
      }

      return decodedO || data.l || null;
    }

    if (data.data && data.wp_http1) {
      const token = encode(data.data);
      const blogLink = `${data.wp_http1}?re=${token}`;
      const waitTime = (Number(data.total_time) + 3) * 1000;

      if (waitTime > 0 && waitTime < 30000) {
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }

      const blogRes = await fetchWithTimeout(blogLink, {
        headers,
        redirect: 'follow',
        cache: 'no-store',
      });

      if (!blogRes) {
        return blogLink;
      }

      const blogText = await blogRes.text();
      const reurlMatch = blogText.match(/var reurl = "([^"]+)"/);
      return reurlMatch?.[1] || blogRes.url || blogLink;
    }

    return originalLink;
  } catch {
    return null;
  }
}

async function getRedirectLinks(link: string): Promise<{ finalUrl: string; steps: string[] }> {
  const cookies = new Map<string, string>();
  const visited = new Set<string>();
  const steps: string[] = [];
  let currentUrl = link;

  for (let hop = 0; hop < 8; hop++) {
    if (visited.has(currentUrl)) {
      break;
    }

    visited.add(currentUrl);
    steps.push(currentUrl);

    const cookieHeader = buildCookieHeader(cookies);
    const requestHeaders: Record<string, string> = {
      ...headers,
      Referer: currentUrl,
    };

    if (cookieHeader) {
      requestHeaders.Cookie = cookieHeader;
    }

    const response = await fetchWithTimeout(currentUrl, {
      headers: requestHeaders,
      redirect: 'follow',
      cache: 'no-store',
    });

    if (!response) {
      break;
    }

    updateCookiesFromResponse(response, cookies);

    const resolvedUrl = response.url;
    if (!visited.has(resolvedUrl)) {
      steps.push(resolvedUrl);
    }

    const contentDisposition = response.headers.get('content-disposition') || '';
    const contentType = response.headers.get('content-type') || '';

    if (isLikelyDirectUrl(resolvedUrl)) {
      return { finalUrl: resolvedUrl, steps };
    }

    if (/attachment/i.test(contentDisposition) || /application\/octet-stream/i.test(contentType)) {
      return { finalUrl: resolvedUrl, steps };
    }

    const html = await response.text();

    const decoded = await decodeLegacyPayload(html, resolvedUrl);
    if (decoded && decoded !== resolvedUrl) {
      currentUrl = normalizeUrl(decoded, resolvedUrl) || decoded;
      if (isLikelyDirectUrl(currentUrl)) {
        steps.push(currentUrl);
        return { finalUrl: currentUrl, steps };
      }
      continue;
    }

    const formResult = await submitCandidateForms(html, resolvedUrl, cookies);
    if (formResult && formResult !== resolvedUrl) {
      currentUrl = formResult;
      if (isLikelyDirectUrl(currentUrl)) {
        steps.push(currentUrl);
        return { finalUrl: currentUrl, steps };
      }
      continue;
    }

    const links = extractPriorityLinks(html, resolvedUrl);
    const bestDirect = links.find(isLikelyDirectUrl);
    if (bestDirect) {
      steps.push(bestDirect);
      return { finalUrl: bestDirect, steps };
    }

    const nextLink =
      links.find((candidate) => isPreferredCandidate(candidate) && !visited.has(candidate)) ||
      links.find((candidate) => !visited.has(candidate));
    if (!nextLink) {
      return { finalUrl: resolvedUrl, steps };
    }

    currentUrl = nextLink;
  }

  return { finalUrl: currentUrl, steps };
}

async function handleExtraction(url: string) {
  const { finalUrl, steps } = await getRedirectLinks(url);

  return NextResponse.json({
    success: true,
    originalUrl: url,
    redirectUrl: finalUrl,
    steps,
  });
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const url = searchParams.get('url');

    if (!url) {
      return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
    }

    return await handleExtraction(url);
  } catch (error) {
    console.error('Error in extractor:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to extract redirect URL',
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { url?: string };
    const { url } = body;

    if (!url) {
      return NextResponse.json({ error: 'URL parameter is required in request body' }, { status: 400 });
    }

    return await handleExtraction(url);
  } catch (error) {
    console.error('Error in extractor:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to extract redirect URL',
      },
      { status: 500 },
    );
  }
}
