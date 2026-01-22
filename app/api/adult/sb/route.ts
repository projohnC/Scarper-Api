import { NextRequest, NextResponse } from 'next/server';
import { load } from 'cheerio';
import { sb } from '@/app/url/baseurl';
import { validateProviderAccess, createProviderErrorResponse } from '@/lib/provider-validator';

export async function GET(request: NextRequest) {
  const validation = await validateProviderAccess(request, "Adult");
  if (!validation.valid) {
    return createProviderErrorResponse(validation.error || "Unauthorized");
  }

  try {
    const cookie = 'coc=IN; cor=Unknown; coe=ww; cookie_consent=eyJ1dWlkIjogImY3YzhmZjc5LWE1YjktNGJhOC04ODQyLWY3YWQwOTRhNTI5MyIsICJ0aW1lc3RhbXAiOiAxNzY5MDcyOTY0LCAiY2F0ZWdvcmllcyI6IHsiZXNzZW50aWFsIjogdHJ1ZSwgImZ1bmN0aW9uYWwiOiBmYWxzZSwgImFuYWx5dGljcyI6IGZhbHNlLCAidGFyZ2V0aW5nIjogZmFsc2V9LCAidmVyc2lvbiI6ICIiLCAidXNlcl9pZCI6IDB9; cookie_consent_required=0; show_cookie_consent_modal=0; backend_version=main; age_pass=1; age_pass=1; av=simple:False:True; preroll_skip=1; __cfruid=7c8c91db837889167271889bb4b6c7fef132c4d8-1769073016; cf_clearance=QcvqytWnk0_.0tUbDq7ZhiGZdwQAaXTZ.6l4owdlrjQ-1769073053-1.2.1.1-1.ybVs2WDA8YmwJSLudrwDTF36DS2DCklZBNtEyJ2SMgBzut4xeGY.FAE0ybd3TyQgP0lDxdE8Cjms3x9d1mJPdGXCW6hEnx0QU4TfjqUqPKJMTlDNZ25kXjDXDImiTX5NTDCs7haPvWlmratCCL3ec4DMg2g_2znJf4hvnXZlj5aSta_4p8GkEv7VMR0bF2hW8gcfCaK7yN4m0rmntjavpUg2IiXFthJh3UVSoKygA; media_layout=four-col; cfc_ok=00|1|ww|spankbang|master|0; sb_session=.eJxFzE0OwiAQQOG7zFoSpGKBy5ARpooNP6XUWJve3bpy_763gS1UIyZKDUyrC53gXvEV2mpdzmMgMKA0keiFZ04jZxcUA9PdtWd40x1XUknBCf6ukssxUvLYQk42-GMRx6Ifvj3Z0OHq5dSGMrHzu_-QdAddZqpgNvi1fN-_rHoxkg.aXHwmA.ul15Is9eDXwp2i3rqTNrwhPd00o; __cf_bm=..eKvdaPY4hf8.PjsAfxeB2FkDVveuB.Yvk5MlsVOAs-1769074935-1.0.1.1-cITxC8BDJ3R6u5agct2tQOryiuFr9tGwiq6qehTakAGkVMc5N21y3pwV_Xh6hlNkMd3LLFmu73Sz51LDe.lit5ZXsSrgkR3OLCcqFoxZpT0';
    
    const proxyUrl = `https://odd-cloud-1e14.hunternisha55.workers.dev/?url=${encodeURIComponent(sb)}&cookie=${encodeURIComponent(cookie)}`;
    
    const response = await fetch(proxyUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      }
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch page: ${response.status}` },
        { status: response.status }
      );
    }

    const html = await response.text();
    const $ = load(html);

    const videos: Array<{
      id: string;
      title: string;
      url: string;
      thumbnail: string;
      duration: string;
      views: string;
      rating: string;
      channel: string;
      channelUrl: string;
      isChannelBadge: boolean;
    }> = [];

    $('.js-video-item[data-testid="video-item"]').each((_, element) => {
      const $item = $(element);
      
      const id = $item.attr('data-id') || '';
      
      const $link = $item.find('a[data-testid="recommended-video"]');
      const url = $link.attr('href') || '';
      const fullUrl = url ? `${sb.replace(/\/$/, '')}${url}` : '';
      
      const $img = $link.find('picture img');
      const thumbnail = $img.attr('src') || '';
      const title = $img.attr('alt') || '';
      
      const duration = $link.find('[data-testid="video-item-length"]').text().trim();
      
      const $videoInfo = $item.find('[data-testid="video-info-with-badge"]');
      
      const views = $videoInfo.find('[data-testid="views"] span:last-child').text().trim();
      const rating = $videoInfo.find('[data-testid="rates"] span:last-child').text().trim();
      
      const $channelLink = $videoInfo.find('[data-testid="title"] a');
      const channel = $channelLink.find('span').text().trim();
      const channelUrl = $channelLink.attr('href') || '';
      const fullChannelUrl = channelUrl ? `${sb.replace(/\/$/, '')}${channelUrl}` : '';
      
      const isChannelBadge = $videoInfo.find('[data-badge="channel"]').length > 0;

      if (id && title && fullUrl) {
        videos.push({
          id,
          title,
          url: fullUrl,
          thumbnail,
          duration,
          views,
          rating,
          channel,
          channelUrl: fullChannelUrl,
          isChannelBadge,
        });
      }
    });

    return NextResponse.json({
      success: true,
      totalVideos: videos.length,
      videos: videos,
    });

  } catch (error) {
    console.error('Error processing SpankBang page:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process page',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
