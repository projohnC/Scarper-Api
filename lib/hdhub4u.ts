import * as cheerio from 'cheerio';
import { getBaseUrl } from '@/lib/baseurl';
import { resolveLink } from '@/lib/link-resolver';

export interface Content {
  id: string;
  title: string;
  url: string;
  imageUrl: string;
}

export interface DownloadLink {
  quality: string;
  url: string;
  provider: string;
}

export interface Episode {
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
const DIRECT_HOST_PATTERN = /(pixeldrain|gofile|terabox|dropapk|mediafire|filescdn|hubcdn|fsl-lx)/i;
const INTERMEDIATE_HOST_PATTERN = /(hubcloud|hubdrive)/i;

export function normalizeUrl(value: string | undefined, baseUrl: string): string | null {
  if (!value) return null;

  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return null;
  }
}

export function detectProvider(url: string): string {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (hostname.includes('hubcloud') || hostname.includes('hubdrive') || hostname.includes('hubcdn')) return 'hubcloud';
    if (hostname.includes('gofile')) return 'gofile';
    if (hostname.includes('terabox')) return 'terabox';
    if (hostname.includes('dropapk')) return 'dropapk';
    if (hostname.includes('pixeldrain')) return 'pixeldrain';
  } catch {
      // ignore
  }
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

function b64Decode(value: string | undefined): string {
  if (!value) return '';
  return Buffer.from(value, 'base64').toString('utf-8');
}

function rot13(value: string): string {
  return value.replace(/[a-zA-Z]/g, function (char: string) {
    return String.fromCharCode(
      (char <= 'Z' ? 90 : 122) >= (char.charCodeAt(0) + 13)
        ? char.charCodeAt(0) + 13
        : char.charCodeAt(0) + 13 - 26
    );
  });
}

async function getHdhubRedirectLinks(link: string): Promise<string> {
  try {
    const res = await fetch(link, { headers: REQUEST_HEADERS, cache: 'no-store' });
    if (!res.ok) return link;

    const resText = await res.text();
    const patterns = [
      /ck\('_wp_http_\d+','([^']+)'/g,
      /setCookie\('_wp_http_\d+',\s*'([^']+)'/g,
      /document\.cookie\s*=\s*["']_wp_http_\d+=['"]([^'"]+)['"]/g,
      /s\('o',\s*'([^']+)'/g,
    ];

    let combinedString = '';
    for (const regex of patterns) {
      let match;
      while ((match = regex.exec(resText)) !== null) {
        combinedString += match[1];
      }
      if (combinedString) break;
    }

    if (!combinedString) {
      const $ = cheerio.load(resText);

      const hiddenInput = $('form input[type="hidden"]').first().attr('value');
      if (hiddenInput && hiddenInput.startsWith('http')) return hiddenInput;

      const iframeSrc = $('iframe').first().attr('src');
      if (iframeSrc && iframeSrc.startsWith('http')) return iframeSrc;

      const jsUrlPatterns = [
        /var\s+url\s*=\s*["']([^"']+)["']/,
        /var\s+link\s*=\s*["']([^"']+)["']/,
        /window\.location\.href\s*=\s*["']([^"']+)["']/,
      ];

      for (const pattern of jsUrlPatterns) {
        const match = resText.match(pattern);
        if (match && match[1] && match[1].startsWith('http')) return match[1];
      }

      return link;
    }

    try {
      let decodedString;
      try {
        decodedString = b64Decode(rot13(b64Decode(b64Decode(combinedString))));
      } catch {
        try {
          decodedString = b64Decode(b64Decode(b64Decode(combinedString)));
        } catch {
          decodedString = b64Decode(b64Decode(combinedString));
        }
      }

      const data = JSON.parse(decodedString);
      if (data.o) {
        const downloadLink = b64Decode(data.o);
        if (downloadLink && downloadLink.startsWith('http')) return downloadLink;
      }
      if (data.l && data.l.startsWith('http')) return data.l;

      return data.o ? b64Decode(data.o) : link;
    } catch {
      return link;
    }
  } catch {
    return link;
  }
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

export async function resolveProviderUrl(inputUrl: string): Promise<{ directUrl: string; steps: string[]; provider: string }> {
  let currentUrl = inputUrl;
  const steps: string[] = [];

  // If it's a known redirector/shortener pattern used by HDHub4u
  if (currentUrl.includes('linkstaker') || currentUrl.includes('gadgetsweb') || currentUrl.includes('sharedrive')) {
    currentUrl = await getHdhubRedirectLinks(currentUrl);
    steps.push(currentUrl);
  }

  // Use resolveLink from link-resolver to handle things like hubdrive.space
  const resolved = await resolveLink(currentUrl);
  if (resolved !== currentUrl) {
    currentUrl = resolved;
    steps.push(currentUrl);
  }

  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (isLikelyDirectUrl(currentUrl)) {
      return { directUrl: currentUrl, steps, provider: detectProvider(currentUrl) };
    }

    steps.push(currentUrl);

    try {
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
        return { directUrl: finalUrl, steps, provider: detectProvider(finalUrl) };
      }

      const html = await response.text();
      const extractedLinks = extractLinksFromHtml(html, finalUrl);

      const directCandidate = extractedLinks.find(isLikelyDirectUrl);
      if (directCandidate) {
        return { directUrl: directCandidate, steps, provider: detectProvider(directCandidate) };
      }

      const nextCandidate =
        extractedLinks.find((link) => isPreferredCandidate(link) && !steps.includes(link)) ||
        extractedLinks.find((link) => !steps.includes(link));

      if (!nextCandidate) {
        return { directUrl: finalUrl, steps, provider: detectProvider(finalUrl) };
      }

      currentUrl = nextCandidate;

      // If we found a link that might need hdhub specific resolution
      if (currentUrl.includes('linkstaker') || currentUrl.includes('gadgetsweb')) {
         currentUrl = await getHdhubRedirectLinks(currentUrl);
         steps.push(currentUrl);
      }

      const resolvedAgain = await resolveLink(currentUrl);
      if (resolvedAgain !== currentUrl) {
        currentUrl = resolvedAgain;
        steps.push(currentUrl);
      }

    } catch (error) {
      console.error('Error resolving provider URL:', error);
      break;
    }
  }

  return { directUrl: currentUrl, steps, provider: detectProvider(currentUrl) };
}

export async function getLatestContent(page: string): Promise<Content[]> {
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
    const url = normalizeUrl($link.attr('href'), baseUrl) || '';
    const $img = $li.find('img').first();
    const imageUrl = normalizeUrl($img.attr('src'), baseUrl) || '';
    const title = $img.attr('alt') || $img.attr('title') || '';
    const id = url.split('/').filter(Boolean).pop() || '';

    if (title && url) {
      recentMovies.push({ id, title, url, imageUrl });
    }
  });

  return recentMovies;
}

export async function searchContent(query: string, page: string): Promise<Content[]> {
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

  const baseUrl = await getBaseUrl('hdhub');

  return (data.hits || [])
    .map((hit) => {
      const doc = hit.document || {};
      return {
        id: String(doc.id || ''),
        title: String(doc.post_title || ''),
        url: normalizeUrl(String(doc.permalink || ''), baseUrl) || '',
        imageUrl: normalizeUrl(String(doc.post_thumbnail || ''), baseUrl) || '',
      };
    })
    .filter((item) => Boolean(item.title && item.url));
}

export async function getPostDetails(postUrl: string): Promise<{
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
