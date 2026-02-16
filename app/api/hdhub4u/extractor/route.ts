import { NextRequest, NextResponse } from 'next/server';
import { load } from 'cheerio';

const headers = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

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
      (char <= 'Z' ? 90 : 122) >= (char.charCodeAt(0) + 13)
        ? char.charCodeAt(0) + 13
        : char.charCodeAt(0) + 13 - 26,
    );
  });
}

async function getRedirectLinks(link: string): Promise<string> {
  try {
    console.log('Fetching page:', link);
    
    // Add timeout to fetch request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const res = await fetch(link, { 
      headers, 
      signal: controller.signal 
    }).catch(err => {
      console.log('Fetch error:', err.message);
      return null;
    });
    
    clearTimeout(timeoutId);
    
    if (!res || !res.ok) {
      console.log('Failed to fetch page, status:', res?.status);
      return link;
    }
    
    const resText = await res.text();

    // Try multiple regex patterns to find encoded data
    const patterns = [
      /ck\('_wp_http_\d+','([^']+)'/g,
      /setCookie\('_wp_http_\d+',\s*'([^']+)'/g,
      /document\.cookie\s*=\s*["']_wp_http_\d+=['"]([^'"]+)['"]/g,
      /s\('o',\s*'([^']+)'/g, // For gadgetsweb.xyz pattern: s('o','encoded_string',...)
    ];

    let combinedString = '';

    for (const regex of patterns) {
      let match;
      while ((match = regex.exec(resText)) !== null) {
        combinedString += match[1];
      }
      if (combinedString) {
        console.log('Found encoded data with pattern:', regex.source);
        break;
      }
    }

    if (!combinedString) {
      console.log('No encoded data found in HTML');
      
      // Log a sample of the HTML to help debug
      console.log('HTML sample (first 500 chars):', resText.substring(0, 500));
      
      // Check for iframe src or meta refresh
      const $ = load(resText);
      
      // Check for forms with hidden inputs that might contain links
      const formAction = $('form').first().attr('action');
      const hiddenInput = $('form input[type="hidden"]').first().attr('value');
      if (formAction || hiddenInput) {
        console.log('Found form:', { formAction, hiddenInput });
        if (hiddenInput && hiddenInput.startsWith('http')) {
          return hiddenInput;
        }
      }
      
      // Check for iframe
      const iframeSrc = $('iframe').first().attr('src');
      if (iframeSrc && iframeSrc.startsWith('http')) {
        console.log('Found iframe redirect:', iframeSrc);
        return iframeSrc;
      }
      
      // Check for meta refresh
      const metaRefresh = $('meta[http-equiv="refresh"]').attr('content');
      if (metaRefresh) {
        const urlMatch = metaRefresh.match(/url=(.+)/i);
        if (urlMatch && urlMatch[1]) {
          console.log('Found meta refresh:', urlMatch[1]);
          return urlMatch[1];
        }
      }
      
      // Look for buttons or links with data attributes
      const dataLink = $('[data-link]').first().attr('data-link');
      const dataUrl = $('[data-url]').first().attr('data-url');
      if (dataLink && dataLink.startsWith('http')) {
        console.log('Found data-link:', dataLink);
        return dataLink;
      }
      if (dataUrl && dataUrl.startsWith('http')) {
        console.log('Found data-url:', dataUrl);
        return dataUrl;
      }
      
      // Look for JavaScript variables with URLs
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
        const match = resText.match(pattern);
        if (match && match[1] && match[1].startsWith('http')) {
          console.log('Found URL in JavaScript:', match[1]);
          return match[1];
        }
      }
      
      // Try to find download links
      const linkPatterns = [
        'a[href*="hubdrive"]',
        'a[href*="hubcdn"]',
        'a[href*="gofile"]',
        'a[href*="dropapk"]',
        'a[href*="intoupload"]',
        'a[href*="terabox"]',
      ];

      for (const pattern of linkPatterns) {
        const foundLink = $(pattern).first().attr('href');
        if (foundLink) {
          console.log(`Found link with pattern ${pattern}:`, foundLink);
          return foundLink;
        }
      }

      console.log('No download links found, returning original link');
      return link;
    }

    try {
      console.log('Starting decode process...');
      console.log('Combined string length:', combinedString.length);
      
      // Try the standard decode: decode(pen(decode(decode(combinedString))))
      let decodedString;
      try {
        decodedString = decode(pen(decode(decode(combinedString))));
      } catch (firstDecodeError) {
        console.log('Standard decode failed, trying alternative methods');
        
        // Try just triple decode
        try {
          decodedString = decode(decode(decode(combinedString)));
        } catch (e) {
          // Try double decode
          decodedString = decode(decode(combinedString));
        }
      }
      
      console.log('Successfully decoded string');
      const data = JSON.parse(decodedString);
      console.log('Decoded data:', data);
      
      // Handle different data formats
      if (data.o || data.l) {
        // New format with 'o' (base64 encoded link) and/or 'l' (redirect link)
        console.log('Using new data format with o/l properties');
        
        // Try to decode the 'o' property first to get the actual download link
        if (data.o) {
          const downloadLink = decode(data.o);
          console.log('Decoded download link:', downloadLink);
          
          if (downloadLink && downloadLink.startsWith('http')) {
            return downloadLink;
          }
        }
        
        // If 'o' doesn't contain a valid URL, try the 'l' property
        if (data.l && data.l.startsWith('http')) {
          console.log('Using redirect link from l property:', data.l);
          return data.l;
        }
        
        // If both fail, return what we got from 'o'
        return data.o ? decode(data.o) : link;
      } else if (data?.data && data?.wp_http1) {
        // Old format with 'data' and 'wp_http1' properties
        console.log('Using old data format with data/wp_http1 properties');
        
        const token = encode(data.data);
        const blogLink = data.wp_http1 + '?re=' + token;

        // Wait for the specified time
        const waitTime = (Number(data?.total_time) + 3) * 1000;
        console.log(`Waiting ${waitTime}ms before proceeding...`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));

        console.log('Fetching blogLink:', blogLink);

        let vcloudLink = 'Invalid Request';
        let attempts = 0;
        const maxAttempts = 5;

        while (vcloudLink.includes('Invalid Request') && attempts < maxAttempts) {
          const controller2 = new AbortController();
          const timeoutId2 = setTimeout(() => controller2.abort(), 10000);
          
          const blogRes = await fetch(blogLink, { 
            headers, 
            signal: controller2.signal 
          }).catch(err => {
            console.log('Blog fetch error:', err.message);
            return null;
          });
          
          clearTimeout(timeoutId2);
          
          if (!blogRes) {
            console.log('Failed to fetch blog link');
            break;
          }
          
          const blogText = await blogRes.text();

          if (blogText.includes('Invalid Request')) {
            console.log('Invalid request, retrying...');
            attempts++;
            await new Promise((resolve) => setTimeout(resolve, 2000));
          } else {
            const reurlMatch = blogText.match(/var reurl = "([^"]+)"/);
            if (reurlMatch && reurlMatch[1]) {
              vcloudLink = reurlMatch[1];
              console.log('Found redirect URL:', vcloudLink);
              return vcloudLink;
            }
            break;
          }
        }

        return blogLink;
      } else {
        console.log('Unknown data format:', data);
        return link;
      }
    } catch (parseError) {
      console.log('Decoding/parsing failed:', parseError);
      console.log('Trying to extract links directly from HTML');
      const $ = load(resText);

      const linkPatterns = [
        'a[href*="hubdrive.space"]',
        'a[href*="gofile.io"]',
        'a[href*="dropapk.to"]',
        'a[href*="intoupload.net"]',
      ];

      for (const pattern of linkPatterns) {
        const foundLink = $(pattern).first().attr('href');
        if (foundLink) {
          console.log(`Found link with pattern ${pattern}:`, foundLink);
          return foundLink;
        }
      }

      console.log('No download links found, returning original link');
      return link;
    }
  } catch (err) {
    console.log('Error in getRedirectLinks:', err);
    return link;
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const url = searchParams.get('url');

    if (!url) {
      return NextResponse.json(
        { error: 'URL parameter is required' },
        { status: 400 }
      );
    }

    console.log('Extracting redirect link for:', url);

    const redirectUrl = await getRedirectLinks(url);

    return NextResponse.json({
      success: true,
      originalUrl: url,
      redirectUrl: redirectUrl,
    });
  } catch (error: any) {
    console.error('Error in extractor:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to extract redirect URL',
      },
      { status: 500 }
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
        { status: 400 }
      );
    }

    console.log('Extracting redirect link for:', url);

    const redirectUrl = await getRedirectLinks(url);

    return NextResponse.json({
      success: true,
      originalUrl: url,
      redirectUrl: redirectUrl,
    });
  } catch (error: any) {
    console.error('Error in extractor:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to extract redirect URL',
      },
      { status: 500 }
    );
  }
}
