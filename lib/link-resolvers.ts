import * as cheerio from "cheerio";

const SCRAPER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
};

/**
 * Resolves Gyaniguru links to get intermediate download links (hubdrive, hubcloud, etc.)
 */
export async function resolveGyaniguru(url: string): Promise<string[]> {
    try {
        const response = await fetch(url, { headers: SCRAPER_HEADERS });
        if (!response.ok) return [];

        const html = await response.text();
        const $ = cheerio.load(html);
        const links: string[] = [];

        // Look for links that match common movie hosts
        $('a').each((_, el) => {
            const href = $(el).attr('href');
            if (href && (
                href.includes('hubdrive.space') ||
                href.includes('hubcloud') ||
                href.includes('gdflix') ||
                href.includes('katdrive') ||
                href.includes('drivemanga')
            )) {
                links.push(href);
            }
        });

        return [...new Set(links)];
    } catch (error) {
        console.error("Gyaniguru resolve error:", error);
        return [];
    }
}

/**
 * Resolves HubDrive-style links (including katdrive, drivemanga) to get the final direct download link
 */
export async function resolveHubDrive(url: string): Promise<string[]> {
    try {
        const urlObj = new URL(url);
        const baseUrl = `${urlObj.protocol}//${urlObj.host}`;
        const fileId = url.split('/').pop();
        if (!fileId) return [url];

        // Step 1: Fetch the initial page to get cookies
        const response = await fetch(url, { headers: SCRAPER_HEADERS });
        if (!response.ok) return [url];

        const cookies = response.headers.get('set-cookie') || "";

        // Step 2: Trigger the direct download generation via AJAX
        const ajaxResponse = await fetch(`${baseUrl}/ajax.php?ajax=direct-download`, {
            method: "POST",
            headers: {
                ...SCRAPER_HEADERS,
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "Referer": url,
                "X-Requested-With": "XMLHttpRequest",
                "Cookie": cookies,
            },
            body: `id=${fileId}`,
        });

        if (ajaxResponse.ok) {
            try {
                const ajaxHtml = await ajaxResponse.text();
                const ajaxData = JSON.parse(ajaxHtml);
                if (ajaxData && ajaxData.code === "200" && ajaxData.data && ajaxData.data.gd) {
                    return [ajaxData.data.gd];
                }
            } catch (e) {
                console.error("Failed to parse HubDrive AJAX JSON:", e);
            }
        }

        // Fallback: Navigate to /newdl
        const newDlResponse = await fetch(`${baseUrl}/newdl`, {
            headers: {
                ...SCRAPER_HEADERS,
                "Referer": url,
                "Cookie": cookies
            }
        });

        if (!newDlResponse.ok) return [url];

        const newDlHtml = await newDlResponse.text();
        const $newDl = cheerio.load(newDlHtml);

        const finalLinks: string[] = [];

        // Find the "ddl" button or any direct host link
        const ddlLink = $newDl('#ddl').attr('href');
        if (ddlLink) finalLinks.push(ddlLink);

        $newDl('a, button').each((_, el) => {
            const $el = $newDl(el);
            const href = $el.attr('href') || $el.attr('data-href') || $el.attr('onclick')?.match(/window\.open\('([^']+)'/)?.[1];
            if (href && (
                href.includes('oreao-cdn') ||
                href.includes('/download/') ||
                href.includes('pixeldrain.dev')
            )) {
                if (href.startsWith('/')) {
                    finalLinks.push(`${baseUrl}${href}`);
                } else if (href.startsWith('http')) {
                    finalLinks.push(href);
                }
            }
        });

        if (finalLinks.length > 0) return [...new Set(finalLinks)];

        return [url];
    } catch (error) {
        console.error("HubDrive resolve error:", error);
        return [url];
    }
}

/**
 * Resolves PixelDrain links
 */
export function resolvePixelDrain(url: string): string {
    // https://pixeldrain.dev/u/S528SHyr -> https://pixeldrain.dev/api/file/S528SHyr?download
    if (url.includes('/api/file/') && url.includes('?download')) {
        return url;
    }
    const id = url.split('/').pop();
    if (id) {
        return `https://pixeldrain.dev/api/file/${id}?download`;
    }
    return url;
}

/**
 * Resolves GDFlix links
 */
export async function resolveGDFlix(url: string): Promise<string[]> {
    try {
        const response = await fetch(url, { headers: SCRAPER_HEADERS, redirect: 'follow' });
        if (!response.ok) return [url];

        const html = await response.text();
        const $ = cheerio.load(html);
        const links: string[] = [];

        $('a, button').each((_, el) => {
            const $el = $(el);
            const href = $el.attr('href') || $el.attr('data-href') || $el.attr('onclick')?.match(/window\.open\('([^']+)'/)?.[1];

            if (href && href.startsWith('http') && !EXCLUDED_DOMAINS.some(d => href.includes(d))) {
                if (
                    href.includes('pixeldrain.dev') ||
                    href.includes('hubdrive') ||
                    href.includes('hubcloud') ||
                    href.includes('katdrive') ||
                    href.includes('drivemanga') ||
                    href.includes('gdflix') ||
                    href.includes('gdtot')
                ) {
                    // Ignore the current URL and social domains
                    if (!href.includes(url.split('/').pop() || 'INVALID')) {
                        links.push(href);
                    }
                }
            }
        });

        if (links.length === 0) return [url];

        return [...new Set(links)];
    } catch (error) {
        console.error("GDFlix resolve error:", error);
        return [url];
    }
}

/**
 * Resolves HubCloud links
 */
export async function resolveHubCloud(url: string): Promise<string | null> {
    try {
        const response = await fetch(url, { headers: SCRAPER_HEADERS });
        if (!response.ok) return url;

        const html = await response.text();
        const $ = cheerio.load(html);

        // HubCloud often has a primary download link or a redirect
        const downloadLink = $('#download-link').attr('href') ||
            $('.btn-primary').attr('href') ||
            $('a:contains("Download")').attr('href');

        return downloadLink || url;
    } catch (error) {
        return url;
    }
}

const EXCLUDED_DOMAINS = [
    't.me', 'telegram.me', 'facebook.com', 'twitter.com', 'instagram.com',
    'youtube.com', 'pinterest.com', 'linkedin.com', 'about-us', 'contact-us',
    'privacy-policy', 'terms-conditions', 'copyright-policy'
];

/**
 * Orchestrates the resolution of a link through multiple stages if necessary
 */
export async function resolveFinalLink(url: string): Promise<string[]> {
    if (EXCLUDED_DOMAINS.some(domain => url.includes(domain))) {
        return [];
    }

    const finalLinks: string[] = [];

    // Helper to decode base64 URLs
    const decodeBase64Url = (str: string): string | null => {
        try {
            // Find base64 part - look for standard base64 characters with possible padding
            // We look for a sequence of 30+ chars that looks like base64
            const b64Match = str.match(/[a-zA-Z0-9+/]{30,}=*/);
            if (b64Match) {
                const b64 = b64Match[0];
                const decoded = Buffer.from(b64, 'base64').toString('utf-8');
                if (decoded.startsWith('http')) return decoded;
            }
        } catch (e) { }
        return null;
    };

    try {
        if (url.includes('gyanigurus.xyz')) {
            const intermediateLinks = await resolveGyaniguru(url);
            if (intermediateLinks.length === 0) {
                finalLinks.push(url);
            } else {
                for (const link of intermediateLinks) {
                    const resolved = await resolveFinalLink(link);
                    finalLinks.push(...resolved);
                }
            }
        } else if (url.includes('hubdrive') || url.includes('drivemanga')) {
            const resolved = await resolveHubDrive(url);
            for (const link of resolved) {
                if (link !== url) {
                    const deepResolved = await resolveFinalLink(link);
                    finalLinks.push(...deepResolved);
                } else {
                    finalLinks.push(link);
                }
            }
        } else if (url.includes('hubcloud')) {
            const final = await resolveHubCloud(url);
            if (final && final !== url) {
                const deepResolved = await resolveFinalLink(final);
                finalLinks.push(...deepResolved);
            } else {
                finalLinks.push(final || url);
            }
        } else if (url.includes('gdflix') || url.includes('katdrive') || url.includes('gdtot')) {
            const resolved = await resolveGDFlix(url);
            for (const link of resolved) {
                if (link !== url) {
                    const deepResolved = await resolveFinalLink(link);
                    finalLinks.push(...deepResolved);
                } else {
                    finalLinks.push(link);
                }
            }
        } else if (url.includes('pixeldrain.dev')) {
            finalLinks.push(resolvePixelDrain(url));
        } else if (url.includes('ampproject.org') || url.includes('bloggingvector') || url.includes('newsongs.co.in')) {
            const decoded = decodeBase64Url(url);
            if (decoded) {
                const deepResolved = await resolveFinalLink(decoded);
                finalLinks.push(...deepResolved);
            } else {
                try {
                    const response = await fetch(url, { headers: SCRAPER_HEADERS, redirect: 'follow' });
                    const finalUrl = response.url;
                    if (finalUrl !== url && !EXCLUDED_DOMAINS.some(d => finalUrl.includes(d))) {
                        const deepResolved = await resolveFinalLink(finalUrl);
                        finalLinks.push(...deepResolved);
                    } else {
                        // Scan page for more links
                        const html = await response.text();
                        const $ = cheerio.load(html);
                        const subLinks: string[] = [];
                        $('a').each((_, el) => {
                            const href = $(el).attr('href');
                            if (href && href.startsWith('http') && !EXCLUDED_DOMAINS.some(d => href.includes(d))) {
                                if (href.includes('hubdrive') || href.includes('gdflix') || href.includes('pixeldrain') || href.includes('hubcloud') || href.includes('gdtot')) {
                                    subLinks.push(href);
                                }
                            }
                        });
                        if (subLinks.length > 0) {
                            for (const subLink of subLinks) {
                                const deepResolved = await resolveFinalLink(subLink);
                                finalLinks.push(...deepResolved);
                            }
                        } else {
                            finalLinks.push(url);
                        }
                    }
                } catch (e) {
                    finalLinks.push(url);
                }
            }
        } else {
            finalLinks.push(url);
        }
    } catch (err) {
        console.error(`Error in resolveFinalLink for ${url}:`, err);
        finalLinks.push(url);
    }

    // Filter out duplicates and intermediate links if we have final ones
    const unique = [...new Set(finalLinks)];
    const hasFinal = unique.some(l => l.includes('oreao-cdn') || l.includes('pixeldrain.dev/api'));

    if (hasFinal) {
        return unique.filter(l => l.includes('oreao-cdn') || l.includes('pixeldrain.dev/api'));
    }

    return unique;
}
