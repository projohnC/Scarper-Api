import { NextRequest, NextResponse } from 'next/server';
import { load } from 'cheerio';
import { validateApiKey, createUnauthorizedResponse } from '@/lib/middleware/api-auth';

interface StreamLink {
  server: string;
  link: string;
  type: string;
}

interface EpisodeStreamResponse {
  success: boolean;
  data?: {
    episodeUrl: string;
    streamLinks: StreamLink[];
  };
  error?: string;
  message?: string;
  remainingRequests?: number;
}

async function modExtractor(url: string): Promise<{ data: string } | null> {
  try {
    const wpHttp = url.split('sid=')[1];
    if (!wpHttp) {
      throw new Error('Invalid URL format - no sid parameter found');
    }

    var bodyFormData0 = new FormData();
    bodyFormData0.append('_wp_http', wpHttp);
    
    const res = await fetch(url.split('?')[0], {
      method: 'POST',
      body: bodyFormData0,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      }
    });

    if (!res.ok) {
      throw new Error(`First request failed: ${res.status}`);
    }

    const data = await res.text();
    const $ = load(data);

    // Find input with name="_wp_http2"
    const wpHttp2 = $('input[name="_wp_http2"]').val() as string;
    
    if (!wpHttp2) {
      throw new Error('_wp_http2 input not found');
    }

    console.log('wpHttp2:', wpHttp2);

    // Form data for second request
    var bodyFormData = new FormData();
    bodyFormData.append('_wp_http2', wpHttp2);
    
    const formUrl1 = $('form').attr('action');
    const formUrl = formUrl1 || url.split('?')[0];

    const res2 = await fetch(formUrl, {
      method: 'POST',
      body: bodyFormData,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Referer': url.split('?')[0],
      }
    });

    if (!res2.ok) {
      throw new Error(`Second request failed: ${res2.status}`);
    }

    const html2 = await res2.text();
    const linkMatch = html2.match(/setAttribute\("href",\s*"(.*?)"/);
    
    if (!linkMatch) {
      throw new Error('Download link not found in response');
    }

    const link = linkMatch[1];
    console.log('Extracted link:', link);
    
    const cookie = link.split('=')[1];
    console.log('Cookie:', cookie);

    const downloadLink = await fetch(link, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': formUrl,
        'Cookie': `${cookie}=${wpHttp2}`,
      }
    });

    if (!downloadLink.ok) {
      throw new Error(`Download link request failed: ${downloadLink.status}`);
    }

    const finalData = await downloadLink.text();
    return { data: finalData };
    
  } catch (error) {
    console.error('Mod extractor error:', error);
    return null;
  }
}

async function isDriveLink(ddl: string): Promise<string> {
  if (ddl.includes('drive')) {
    try {
      const driveLeach = await fetch(ddl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        }
      });
      
      const data = await driveLeach.text();
      const pathMatch = data.match(/window\.location\.replace\("([^"]+)"\)/);
      
      if (pathMatch) {
        const path = pathMatch[1];
        const mainUrl = ddl.split('/')[2];
        return `https://${mainUrl}${path}`;
      }
    } catch (error) {
      console.error('Drive link processing error:', error);
    }
  }
  return ddl;
}

async function getStreamFromUhdUrl(url: string): Promise<StreamLink[]> {
  try {
    console.log('Extracting stream from UHD URL:', url);
    
    // Get the encoded download link
    const downloadLink = await modExtractor(url);
    if (!downloadLink?.data) {
      throw new Error('Failed to extract download link');
    }

    const ddl = downloadLink.data.match(/content="0;url=(.*?)"/)?.[1] || url;
    console.log('Extracted DDL:', ddl);
    
    // Process drive link
    const driveLink = await isDriveLink(ddl);
    console.log('Processed drive link:', driveLink);
    
    const serverLinks: StreamLink[] = [];
    
    const driveRes = await fetch(driveLink, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      }
    });
    
    if (!driveRes.ok) {
      throw new Error(`Failed to fetch drive link: ${driveRes.status}`);
    }
    
    const driveHtml = await driveRes.text();
    const $drive = load(driveHtml);
    
    // Extract instant link
    try {
      const seed = $drive('.btn-danger').attr('href') || '';
      if (seed) {
        const instantToken = seed.split('=')[1];
        const videoSeedUrl = seed.split('/').slice(0, 3).join('/') + '/api';
        
        const formData = new FormData();
        formData.append('keys', instantToken);
        
        const instantLinkRes = await fetch(videoSeedUrl, {
          method: 'POST',
          body: formData,
          headers: {
            'x-token': videoSeedUrl,
          },
        });
        
        const instantLinkData = await instantLinkRes.json();
        
        if (instantLinkData.error === false && instantLinkData.url) {
          serverLinks.push({
            server: 'Gdrive-Instant',
            link: instantLinkData.url,
            type: 'mkv',
          });
        }
      }
    } catch (err) {
      console.log('Instant link extraction failed:', err);
    }
    
    // Extract resume link
    try {
      const resumeDrive = driveLink.replace('/file', '/zfile');
      const resumeDriveRes = await fetch(resumeDrive, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        }
      });
      
      if (resumeDriveRes.ok) {
        const resumeDriveHtml = await resumeDriveRes.text();
        const $resumeDrive = load(resumeDriveHtml);
        const resumeLink = $resumeDrive('.btn-success').attr('href');
        
        if (resumeLink) {
          serverLinks.push({
            server: 'ResumeCloud',
            link: resumeLink,
            type: 'mkv',
          });
        }
      }
    } catch (err) {
      console.log('Resume link extraction failed:', err);
    }
    
    // Extract CF workers type 1
    try {
      const cfWorkersLink = driveLink.replace('/file', '/wfile') + '?type=1';
      const cfWorkersRes = await fetch(cfWorkersLink, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        }
      });
      
      if (cfWorkersRes.ok) {
        const cfWorkersHtml = await cfWorkersRes.text();
        const $cfWorkers = load(cfWorkersHtml);
        
        $cfWorkers('.btn-success').each((i, el) => {
          const link = $cfWorkers(el).attr('href');
          if (link) {
            serverLinks.push({
              server: `Cf Worker 1.${i}`,
              link: link,
              type: 'mkv',
            });
          }
        });
      }
    } catch (err) {
      console.log('CF workers type 1 extraction failed:', err);
    }
    
    // Extract CF workers type 2
    try {
      const cfWorkersLink = driveLink.replace('/file', '/wfile') + '?type=2';
      const cfWorkersRes = await fetch(cfWorkersLink, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        }
      });
      
      if (cfWorkersRes.ok) {
        const cfWorkersHtml = await cfWorkersRes.text();
        const $cfWorkers = load(cfWorkersHtml);
        
        $cfWorkers('.btn-success').each((i, el) => {
          const link = $cfWorkers(el).attr('href');
          if (link) {
            serverLinks.push({
              server: `Cf Worker 2.${i}`,
              link: link,
              type: 'mkv',
            });
          }
        });
      }
    } catch (err) {
      console.log('CF workers type 2 extraction failed:', err);
    }
    
    console.log('Extracted server links:', serverLinks.length);
    return serverLinks;
    
  } catch (error) {
    console.error('Error extracting stream:', error);
    return [];
  }
}

export async function GET(request: NextRequest): Promise<NextResponse<EpisodeStreamResponse>> {
  try {
    // Validate API key
    const authResult = await validateApiKey(request);
    if (!authResult.isValid) {
      return createUnauthorizedResponse(authResult.error || 'Invalid API key') as NextResponse<EpisodeStreamResponse>;
    }

    const { searchParams } = new URL(request.url);
    const episodeUrl = searchParams.get('url');

    if (!episodeUrl) {
      return NextResponse.json<EpisodeStreamResponse>(
        { 
          success: false, 
          error: 'Episode URL is required',
          message: 'Please provide an episode URL parameter'
        },
        { status: 400 }
      );
    }

    // Validate that it's a tech.unblockedgames.world URL
    if (!episodeUrl.includes('tech.unblockedgames.world')) {
      return NextResponse.json<EpisodeStreamResponse>(
        { 
          success: false, 
          error: 'Invalid URL',
          message: 'URL must be from tech.unblockedgames.world'
        },
        { status: 400 }
      );
    }

    console.log('Processing episode stream request for URL:', episodeUrl);

    const streamLinks = await getStreamFromUhdUrl(episodeUrl);

    if (!streamLinks || streamLinks.length === 0) {
      return NextResponse.json<EpisodeStreamResponse>({
        success: false,
        error: 'No stream links found',
        message: 'No streaming links could be extracted from the provided URL',
        remainingRequests: authResult.apiKey ? (authResult.apiKey.requestsLimit - authResult.apiKey.requestsUsed) : 0
      });
    }

    return NextResponse.json<EpisodeStreamResponse>({
      success: true,
      data: {
        episodeUrl,
        streamLinks
      },
      remainingRequests: authResult.apiKey ? (authResult.apiKey.requestsLimit - authResult.apiKey.requestsUsed) : 0
    });

  } catch (error: unknown) {
    console.error('Episode stream API error:', error);
    
    return NextResponse.json<EpisodeStreamResponse>(
      { 
        success: false, 
        error: 'Failed to extract stream links',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}
