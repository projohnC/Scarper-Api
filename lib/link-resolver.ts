import * as cheerio from 'cheerio';

const headers = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

/**
 * Resolves intermediate links to direct download links where possible.
 */
export async function resolveLink(url: string): Promise<string> {
  const links = await resolveDownloadLinks(url);
  return links[0] ?? url;
}

/**
 * Resolves one URL into one or more direct download URLs.
 * Gyanigurus links can expand into multiple provider URLs.
 */
export async function resolveDownloadLinks(url: string): Promise<string[]> {
  if (!url) return [];

  try {
    const urlObj = new URL(url);

    if (urlObj.hostname.includes('gyanigurus.xyz') && urlObj.pathname.includes('/view/')) {
      const providerLinks = await extractGyanigurusProviderLinks(url);
      if (!providerLinks.length) return [url];

      const resolvedLinks = await Promise.all(providerLinks.map((providerLink) => resolveSingleLink(providerLink)));
      return dedupeLinks(resolvedLinks.flat());
    }

    return dedupeLinks(await resolveSingleLink(url));
  } catch {
    return [url];
  }
}

async function resolveSingleLink(url: string): Promise<string[]> {
  if (!url) return [];

  try {
    const urlObj = new URL(url);

    if (urlObj.hostname.includes('hubdrive.space')) {
      return [await resolveHubDrive(url)];
    }

    if (urlObj.hostname.includes('gdflix.dev') || urlObj.hostname.includes('gdflix.app')) {
      return [await resolveGdFlix(url)];
    }

    if (urlObj.hostname.includes('hubcloud.foo')) {
      return [await resolveHubCloud(url)];
    }

    if (urlObj.hostname.includes('pixeldrain.dev') && urlObj.pathname.startsWith('/u/')) {
      return [toPixeldrainDirect(urlObj)];
    }

    return [url];
  } catch {
    return [url];
  }
}

async function extractGyanigurusProviderLinks(url: string): Promise<string[]> {
  try {
    const response = await fetch(url, { headers });
    if (!response.ok) return [];

    const html = await response.text();
    const $ = cheerio.load(html);
    const providerLinks = new Set<string>();

    $('#content_for_display a, .link a, a.link').each((_, element) => {
      const href = $(element).attr('href');
      if (href?.startsWith('http')) {
        providerLinks.add(href);
      }
    });

    $('a').each((_, element) => {
      const href = $(element).attr('href');
      if (!href?.startsWith('http')) return;

      const looksLikeProvider =
        href.includes('hubcloud') ||
        href.includes('gdflix') ||
        href.includes('hubdrive') ||
        href.includes('pixeldrain');

      if (looksLikeProvider) {
        providerLinks.add(href);
      }
    });

    return [...providerLinks];
  } catch (error) {
    console.error('Error extracting Gyanigurus provider links:', error);
    return [];
  }
}

async function resolveHubDrive(url: string): Promise<string> {
  try {
    if (!url.includes('/file/')) return url;

    const response = await fetch(url, { headers, redirect: 'follow' });
    if (!response.ok) return url;

    const html = await response.text();
    const $ = cheerio.load(html);

    const directButtonHref = $('#ddl, a#ddl, a[href*="oreao-cdn"], a[href*="token="]').first().attr('href');
    if (directButtonHref?.startsWith('http')) {
      return directButtonHref;
    }

    const id = $('#down-id').text().trim() || $('input[name="id"]').attr('value')?.trim() || '';
    if (!id) return url;

    const ajaxResponse = await fetch('https://hubdrive.space/ajax.php?ajax=direct-download', {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/x-www-form-urlencoded',
        Referer: url,
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: `id=${encodeURIComponent(id)}`,
    });

    if (!ajaxResponse.ok) return url;

    const data = await ajaxResponse.json();
    if (data?.code === '200' && data?.data?.gd) {
      return data.data.gd;
    }

    return url;
  } catch (error) {
    console.error('Error in resolveHubDrive:', error);
    return url;
  }
}

async function resolveGdFlix(url: string): Promise<string> {
  try {
    const response = await fetch(url, { headers, redirect: 'follow' });
    if (!response.ok) return url;

    const html = await response.text();
    const $ = cheerio.load(html);

    const pixelHref =
      $('a[href*="pixeldrain.dev/u/"]').first().attr('href') ||
      $('a:contains("PixelDrain")').first().attr('href') ||
      '';

    if (pixelHref) {
      const pixelUrl = new URL(pixelHref);
      if (pixelUrl.pathname.startsWith('/u/')) {
        return toPixeldrainDirect(pixelUrl);
      }
      return pixelHref;
    }

    return url;
  } catch (error) {
    console.error('Error in resolveGdFlix:', error);
    return url;
  }
}

async function resolveHubCloud(url: string): Promise<string> {
  try {
    const response = await fetch(url, { headers, redirect: 'follow' });
    if (!response.ok) return url;

    const html = await response.text();
    const $ = cheerio.load(html);

    const gatewayLink =
      $('a#download').attr('href') ||
      $('a[href*="gamerxyt.com/hubcloud.php"]').attr('href') ||
      '';

    if (!gatewayLink) return url;

    const gatewayResponse = await fetch(gatewayLink, { headers, redirect: 'follow' });
    if (!gatewayResponse.ok) return gatewayLink;

    const gatewayHtml = await gatewayResponse.text();
    const $$ = cheerio.load(gatewayHtml);

    const finalDirectLink =
      $$('a#fsl').attr('href') ||
      $$('a[href*="r2.dev"]').attr('href') ||
      $$('a[href*="oreao-cdn"]').attr('href') ||
      '';

    return finalDirectLink || gatewayLink;
  } catch (error) {
    console.error('Error in resolveHubCloud:', error);
    return url;
  }
}

function toPixeldrainDirect(urlObj: URL): string {
  const id = urlObj.pathname.replace('/u/', '').replace(/\/$/, '');
  return `https://pixeldrain.dev/api/file/${id}?download`;
}

function dedupeLinks(links: string[]): string[] {
  return [...new Set(links.filter((link) => link && link.startsWith('http')))];
}
