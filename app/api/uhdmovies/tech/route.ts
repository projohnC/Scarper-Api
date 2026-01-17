import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import axios from "axios";
import { validateProviderAccess, createProviderErrorResponse } from "@/lib/provider-validator";

interface Stream {
  server: string;
  link: string;
  type: string;
}

const headers = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
};

const isDriveLink = async (ddl: string) => {
  if (ddl.includes('drive')) {
    const driveLeach = await axios.get(ddl);
    const path = driveLeach.data.match(
      /window\.location\.replace\("([^"]+)"\)/,
    )[1];
    const mainUrl = ddl.split('/')[2];
    console.log(`driveUrl = https://${mainUrl}${path}`);
    return `https://${mainUrl}${path}`;
  } else {
    return ddl;
  }
};

export async function modExtractor(url: string) {
  try {
    const wpHttp = url.split('sid=')[1];
    const bodyFormData0 = new FormData();
    bodyFormData0.append('_wp_http', wpHttp);
    const res = await fetch(url.split('?')[0], {
      method: 'POST',
      body: bodyFormData0,
    });
    const data = await res.text();
    const html = data;
    const $ = cheerio.load(html);

    // find input with name="_wp_http2"
    const wpHttp2 = $('input').attr('name', '_wp_http2').val();

    // form data
    const bodyFormData = new FormData();
    bodyFormData.append('_wp_http2', wpHttp2);
    const formUrl1 = $('form').attr('action');
    const formUrl = formUrl1 || url.split('?')[0];

    const res2 = await fetch(formUrl, {
      method: 'POST',
      body: bodyFormData,
    });
    const html2 = await res2.text();
    const linkMatch = html2.match(/setAttribute\("href",\s*"(.*?)"/);
    if (!linkMatch) {
      throw new Error('Could not extract link from response');
    }
    const link = linkMatch[1];
    console.log(link);
    const cookie = link.split('=')[1];
    console.log('cookie', cookie);

    const downloadLink = await axios.get(link, {
      headers: {
        Referer: formUrl,
        Cookie: `${cookie}=${wpHttp2}`,
      },
    });
    return downloadLink;
  } catch (err) {
    console.log('modExtractor error', err);
  }
}

export const modGetStream = async (url: string): Promise<Stream[]> => {
  try {
    console.log('modGetStream', url);

    const downloadLink = await modExtractor(url);

    const ddl = downloadLink?.data?.match(/content="0;url=(.*?)"/)?.[1] || url;
    
    const servers: Stream[] = [];
    const driveLink = await isDriveLink(ddl);
    const driveRes = await axios.get(driveLink, {headers});
    const driveHtml = driveRes.data;
    const $drive = cheerio.load(driveHtml);

    try {
      const resumeBot = $drive('.btn.btn-light').attr('href') || '';
      if (resumeBot) {
        const resumeBotRes = await axios.get(resumeBot, {headers});
        const resumeBotToken = resumeBotRes.data.match(
          /formData\.append\('token', '([a-f0-9]+)'\)/,
        )?.[1];
        const resumeBotPath = resumeBotRes.data.match(
          /fetch\('\/download\?id=([a-zA-Z0-9\/+]+)'/,
        )?.[1];
        
        if (resumeBotToken && resumeBotPath) {
          const resumeBotBody = new FormData();
          resumeBotBody.append('token', resumeBotToken);
          const resumeBotBaseUrl = resumeBot.split('/download')[0];

          const resumeBotDownload = await fetch(
            resumeBotBaseUrl + '/download?id=' + resumeBotPath,
            {
              method: 'POST',
              body: resumeBotBody,
              headers: {
                Referer: resumeBot,
                Cookie: 'PHPSESSID=7e9658ce7c805dab5bbcea9046f7f308',
              },
            },
          );
          const resumeBotDownloadData = await resumeBotDownload.json();
          console.log('resumeBotDownloadData', resumeBotDownloadData.url);
          servers.push({
            server: 'ResumeBot',
            link: resumeBotDownloadData.url,
            type: 'mkv',
          });
        }
      }
    } catch (err) {
      console.log('ResumeBot link not found', err);
    }
    
    // Cloud Download fallback if ResumeBot not found
    if (servers.length === 0) {
      try {
        const cloudDownload = $drive('.btn.btn-success').attr('href') || '';
        if (cloudDownload) {
          console.log('Using Cloud Download:', cloudDownload);
          servers.push({
            server: 'Cloud Download',
            link: cloudDownload,
            type: 'mkv',
          });
        }
      } catch (err) {
        console.log('Cloud Download link not found', err);
      }
    }
    
    // CF workers type 1
    try {
      const cfWorkersLink = driveLink.replace('/file', '/wfile') + '?type=1';
      const cfWorkersRes = await axios.get(cfWorkersLink, {headers});
      const cfWorkersHtml = cfWorkersRes.data;
      const $cfWorkers = cheerio.load(cfWorkersHtml);
      const cfWorkersStream = $cfWorkers('.btn-success');
      cfWorkersStream.each((i, el) => {
        const link = $cfWorkers(el).attr('href');
        if (link) {
          servers.push({
            server: 'Cf Worker 1.' + i,
            link: link,
            type: 'mkv',
          });
        }
      });
    } catch (err) {
      console.log('CF workers link not found', err);
    }

    // CF workers type 2
    try {
      const cfWorkersLink = driveLink.replace('/file', '/wfile') + '?type=2';
      const cfWorkersRes = await axios.get(cfWorkersLink, {headers});
      const cfWorkersHtml = cfWorkersRes.data;
      const $cfWorkers = cheerio.load(cfWorkersHtml);
      const cfWorkersStream = $cfWorkers('.btn-success');
      cfWorkersStream.each((i, el) => {
        const link = $cfWorkers(el).attr('href');
        if (link) {
          servers.push({
            server: 'Cf Worker 2.' + i,
            link: link,
            type: 'mkv',
          });
        }
      });
    } catch (err) {
      console.log('CF workers link not found', err);
    }

    // Instant link
    try {
      const seed = $drive('.btn-danger').attr('href') || '';
      const instantToken = seed.split('=')[1];
      const InstantFromData = new FormData();
      InstantFromData.append('keys', instantToken);
      const videoSeedUrl = seed.split('/').slice(0, 3).join('/') + '/api';
      const instantLinkRes = await fetch(videoSeedUrl, {
        method: 'POST',
        body: InstantFromData,
        headers: {
          'x-token': videoSeedUrl,
        },
      });
      const instantLinkData = await instantLinkRes.json();
      if (instantLinkData.error === false) {
        const instantLink = instantLinkData.url;
        servers.push({
          server: 'Gdrive-Instant',
          link: instantLink,
          type: 'mkv',
        });
      } else {
        console.log('Instant link not found', instantLinkData);
      }
    } catch (err) {
      console.log('Instant link not found', err);
    }
    
    // CDN Video Leech Instant Download (fallback)
    if (servers.length === 0) {
      try {
        const cdnInstantLink = $drive('.btn-danger[href*="cdn.video-leech.pro"]').attr('href') || '';
        if (cdnInstantLink) {
          console.log('Found CDN video-leech instant link:', cdnInstantLink);
          
          const apiUrl = `https://net-cookie-kacj.vercel.app/api/vlich?url=${encodeURIComponent(cdnInstantLink)}`;
          const apiResponse = await axios.get(apiUrl);
          
          console.log('API response:', apiResponse.data);
          
          if (apiResponse.data && apiResponse.data.location) {
            const videoUrl = apiResponse.data.location;
            console.log('Extracted video URL:', videoUrl);
            
            servers.push({
              server: 'CDN-Instant',
              link: videoUrl,
              type: 'mkv',
            });
          }
        }
      } catch (err) {
        console.log('CDN video-leech instant link error:', err);
      }
    }
    
    return servers;
  } catch (err) {
    console.log('modGetStream error', err);
    return [];
  }
};

export async function GET(request: NextRequest) {
  const validation = await validateProviderAccess(request, "UhdMovies");
  if (!validation.valid) {
    return createProviderErrorResponse(validation.error || "Unauthorized");
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const url = searchParams.get("url");

    if (!url) {
      return NextResponse.json(
        { error: "URL parameter is required" },
        { status: 400 }
      );
    }

    const servers = await modGetStream(url);

    if (!servers || servers.length === 0) {
      return NextResponse.json(
        { error: "Failed to extract download links" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        servers,
        totalServers: servers.length,
      },
    });

  } catch (error) {
    console.error("Error in UhdMovies tech API:", error);
    return NextResponse.json(
      { 
        error: "Internal server error", 
        message: error instanceof Error ? error.message : "Unknown error" 
      },
      { status: 500 }
    );
  }
}
