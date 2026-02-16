import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { getBaseUrl } from '@/lib/baseurl';
import { createProviderErrorResponse, validateProviderAccess } from '@/lib/provider-validator';

interface Content {
  id: string;
  title: string;
  url: string;
  imageUrl: string;
}

interface DownloadLink {
  quality: string;
  url: string;
  provider: string;
}

interface Episode {
  episode: string;
  links: DownloadLink[];
}

const REQUEST_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
};

const DIRECT_FILE_PATTERN = /\.(mkv|mp4|avi|mov|webm|m4v|zip|rar|7z)(?:\?|#|$)/i;
const DIRECT_HOST_PATTERN = /(pixeldrain|gofile|terabox|dropapk|mediafire|filescdn)/i;
const INTERMEDIATE_HOST_PATTERN = /(hubcdn|hubcloud|hubdrive)/i;

function normalizeUrl(value: string | undefined, baseUrl: string): string | null {
  if (!value) return null;

  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return null;
  }
}

function detectProvider(url: string): string {
  const hostname = new URL(url).hostname.toLowerCase();

  if (hostname.includes('hubcloud') || hostname.includes('hubdrive') || hostname.includes('hubcdn')) return 'hubcloud';
  if (hostname.includes('gofile')) return 'gofile';
  if (hostname.includes('terabox')) return 'terabox';
  if (hostname.includes('dropapk')) return 'dropapk';
  if (hostname.includes('pixeldrain')) return 'pixeldrain';
  return 'other';
}

function isLikelyDirectUrl(url: string): boolean {
  return DIRECT_FILE_PATTERN.test(url) || DIRECT_HOST_PATTERN.test(url);
}

function isPreferredCandidate(url: string): boolean {
  return isLikelyDirectUrl(url) || INTERMEDIATE_HOST_PATTERN.test(url);
}

function inferQuality(text: string): string {
  const match = text.match(/(2160p|4k|1080p|720p|480p|360p|hq|hd)/i);
  return match?.[1]?.toUpperCase() || 'UNKNOWN';
}

function extractLinksFromHtml(html: string, baseUrl: string): string[] {
  const $ = cheerio.load(html);
  const links = new Set<string>();

  const push = (value: string | undefined) => {
    const normalized = normalizeUrl(value, baseUrl);
    if (normalized) {
      links.add(normalized);
    }
  };

  $('a[href], iframe[src], source[src], video[src]').each((_, element) => {
    push($(element).attr('href') || $(element).attr('src'));
  });

  const metaRefresh = $('meta[http-equiv="refresh"]').attr('content');
  if (metaRefresh) {
    const match = metaRefresh.match(/url\s*=\s*([^;]+)/i);
    if (match?.[1]) {
      push(match[1].trim().replace(/^['"]|['"]$/g, ''));
    }
  }

  const jsPatterns = [
    /(?:file|source|url|link|downloadUrl|redirectUrl)\s*[:=]\s*["']([^"']+)["']/gi,
    /window\.location(?:\.href)?\s*=\s*["']([^"']+)["']/gi,
  ];

  for (const pattern of jsPatterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(html)) !== null) {
      push(match[1]);
    }
  }

  return [...links];
}

async function resolveProviderUrl(inputUrl: string): Promise<{ directUrl: string; steps: string[] }> {
  let currentUrl = inputUrl;
  const steps: string[] = [];

  for (let attempt = 0; attempt < 4; attempt += 1) {
    steps.push(currentUrl);

    const response = await fetch(currentUrl, {
      headers: REQUEST_HEADERS,
      redirect: 'follow',
      cache: 'no-store',
    });

    const finalUrl = response.url;
    if (!steps.includes(finalUrl)) {
      steps.push(finalUrl);
    }

    if (isLikelyDirectUrl(finalUrl)) {
      return { directUrl: finalUrl, steps };
    }

    const html = await response.text();
    const extractedLinks = extractLinksFromHtml(html, finalUrl);

    const directCandidate = extractedLinks.find(isLikelyDirectUrl);
    if (directCandidate) {
      return { directUrl: directCandidate, steps };
    }

    const nextCandidate =
      extractedLinks.find((link) => isPreferredCandidate(link) && !steps.includes(link)) ||
      extractedLinks.find((link) => !steps.includes(link));
    if (!nextCandidate) {
      return { directUrl: finalUrl, steps };
    }

    currentUrl = nextCandidate;
  }

  return { directUrl: currentUrl, steps };
}

async function getLatestContent(page: string): Promise<Content[]> {
  const baseUrl = await getBaseUrl('hdhub');
  const fetchUrl = page !== '1' ? `${baseUrl}/page/${page}` : baseUrl;

  const response = await fetch(fetchUrl, { headers: REQUEST_HEADERS, cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to fetch latest content: ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const recentMovies: Content[] = [];

  $('ul.recent-movies li.thumb').each((_, element) => {
    const $li = $(element);
    const $link = $li.find('a').first();
    const url = $link.attr('href') || '';
    const $img = $li.find('img').first();
    const imageUrl = $img.attr('src') || '';
    const title = $img.attr('alt') || $img.attr('title') || '';
    const id = url.split('/').filter(Boolean).pop() || '';

    if (title && url) {
      recentMovies.push({ id, title, url, imageUrl });
    }
  });

  return recentMovies;
}

async function searchContent(query: string, page: string): Promise<Content[]> {
  const formattedQuery = query.replace(/\s+/g, '+');
  const searchUrl = `https://search.pingora.fyi/collections/post/documents/search?q=${formattedQuery}&query_by=post_title&page=${page}`;

  const response = await fetch(searchUrl, {
    headers: {
      Origin: 'https://new2.hdhub4u.fo',
      Referer: 'https://new2.hdhub4u.fo/',
      'User-Agent': REQUEST_HEADERS['User-Agent'],
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Failed to search HDHub4u: ${response.status}`);
  }

  const data = (await response.json()) as {
    hits?: Array<{ document?: { id?: string; post_title?: string; permalink?: string; post_thumbnail?: string } }>;
  };

  return (data.hits || [])
    .map((hit) => {
      const doc = hit.document || {};
      return {
        id: String(doc.id || ''),
        title: String(doc.post_title || ''),
        url: String(doc.permalink || ''),
        imageUrl: String(doc.post_thumbnail || ''),
      };
    })
    .filter((item) => Boolean(item.title && item.url));
}

async function getPostDetails(postUrl: string): Promise<{
  title: string;
  imageUrl: string;
  description: string;
  links: DownloadLink[];
  episodes: Episode[];
}> {
  const response = await fetch(postUrl, { headers: REQUEST_HEADERS, cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to fetch details: ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  const title =
    $('h1.entry-title').text().trim() ||
    $('meta[property="og:title"]').attr('content') ||
    '';

  const imageUrl =
    $('.entry-content img').first().attr('src') ||
    $('meta[property="og:image"]').attr('content') ||
    '';

  const description =
    $('meta[name="description"]').attr('content') ||
    $('.entry-content p').first().text().trim() ||
    '';

  const links: DownloadLink[] = [];
  const episodes: Episode[] = [];

  const pushLink = (text: string, href: string | undefined) => {
    const normalized = normalizeUrl(href, postUrl);
    if (!normalized) return;

    links.push({
      quality: inferQuality(text),
      url: normalized,
      provider: detectProvider(normalized),
    });
  };

  $('.entry-content a[href]').each((_, anchor) => {
    const $anchor = $(anchor);
    pushLink($anchor.text().trim(), $anchor.attr('href'));
  });

  $('h3, h4, h5').each((_, heading) => {
    const $heading = $(heading);
    const headingText = $heading.text().trim();

    if (!/episode\s*\d+/i.test(headingText)) {
      return;
    }

    const episodeLinks: DownloadLink[] = [];

    $heading.nextUntil('h3, h4, h5').find('a[href]').each((_, anchor) => {
      const $anchor = $(anchor);
      const normalized = normalizeUrl($anchor.attr('href'), postUrl);
      if (!normalized) return;

      episodeLinks.push({
        quality: inferQuality($anchor.text().trim() || headingText),
        url: normalized,
        provider: detectProvider(normalized),
      });
    });

    if (episodeLinks.length > 0) {
      episodes.push({ episode: headingText, links: episodeLinks });
    }
  });

  const dedupedLinks = Array.from(new Map(links.map((link) => [link.url, link])).values());

  return { title, imageUrl, description, links: dedupedLinks, episodes };
}

export async function GET(request: NextRequest) {
  const validation = await validateProviderAccess(request, 'HDHub4u');
  if (!validation.valid) {
    return createProviderErrorResponse(validation.error || 'Unauthorized');
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const action = (searchParams.get('action') || 'latest').toLowerCase();

    if (action === 'latest') {
      const page = searchParams.get('page') || '1';
      const recentMovies = await getLatestContent(page);

      return NextResponse.json({
        success: true,
        action,
        data: {
          page: Number(page) || 1,
          totalItems: recentMovies.length,
          recentMovies,
        },
      });
    }

    if (action === 'search') {
      const query = searchParams.get('q') || searchParams.get('s');
      const page = searchParams.get('page') || '1';

      if (!query) {
        return NextResponse.json({ error: 'Search query parameter (q or s) is required' }, { status: 400 });
      }

      const results = await searchContent(query, page);
      return NextResponse.json({
        success: true,
        action,
        data: {
          query,
          page: Number(page) || 1,
          totalResults: results.length,
          results,
        },
      });
    }

    if (action === 'details') {
      const url = searchParams.get('url');
      if (!url) {
        return NextResponse.json({ error: 'URL parameter is required for details action' }, { status: 400 });
      }

      const details = await getPostDetails(url);
      return NextResponse.json({ success: true, action, data: details });
    }

    if (action === 'resolve') {
      const url = searchParams.get('url');
      if (!url) {
        return NextResponse.json({ error: 'URL parameter is required for resolve action' }, { status: 400 });
      }

      const resolved = await resolveProviderUrl(url);
      return NextResponse.json({
        success: true,
        action,
        data: {
          inputUrl: url,
          directUrl: resolved.directUrl,
          provider: detectProvider(resolved.directUrl),
          steps: resolved.steps,
        },
      });
    }

    return NextResponse.json(
      {
        error: 'Invalid action. Supported actions: latest, search, details, resolve',
      },
      { status: 400 },
    );
  } catch (error) {
    console.error('Error in HDHub4u API:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
