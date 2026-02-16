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
 * Currently supports:
 * - hubdrive.space
 */
export async function resolveLink(url: string): Promise<string> {
  if (!url) return '';

  try {
    const urlObj = new URL(url);

    if (urlObj.hostname.includes('hubdrive.space')) {
      return await resolveHubDrive(url);
    }

    // Add other resolvers here as needed

    return url;
  } catch {
    // If URL is invalid, return original string
    return url;
  }
}

async function resolveHubDrive(url: string): Promise<string> {
  try {
    // Check if it's already a direct link or something else
    if (!url.includes('/file/')) return url;

    console.log('Resolving HubDrive link:', url);

    const response = await fetch(url, { headers });
    if (!response.ok) {
      console.log('Failed to fetch HubDrive page:', response.status);
      return url;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract ID from <div id="down-id" hidden="true">ID</div>
    const id = $('#down-id').text().trim();
    if (!id) {
      console.log('HubDrive ID not found on page');
      return url;
    }

    console.log('Found HubDrive ID:', id);

    // Make the AJAX request to get the direct link
    const ajaxResponse = await fetch(`https://hubdrive.space/ajax.php?ajax=direct-download`, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': url,
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: `id=${encodeURIComponent(id)}`,
    });

    if (!ajaxResponse.ok) {
      console.log('HubDrive AJAX request failed:', ajaxResponse.status);
      return url;
    }

    const data = await ajaxResponse.json();
    console.log('HubDrive AJAX response:', data);

    if (data?.code === "200" && data?.data?.gd) {
      return data.data.gd;
    }

    return url;
  } catch (error) {
    console.error('Error in resolveHubDrive:', error);
    return url;
  }
}
