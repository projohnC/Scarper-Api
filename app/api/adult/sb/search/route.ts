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
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter "q" is required' },
        { status: 400 }
      );
    }

    const cookie = 'coc=IN; cor=Unknown; coe=ww; cookie_consent=eyJ1dWlkIjogImY3YzhmZjc5LWE1YjktNGJhOC04ODQyLWY3YWQwOTRhNTI5MyIsICJ0aW1lc3RhbXAiOiAxNzY5MDcyOTY0LCAiY2F0ZWdvcmllcyI6IHsiZXNzZW50aWFsIjogdHJ1ZSwgImZ1bmN0aW9uYWwiOiBmYWxzZSwgImFuYWx5dGljcyI6IGZhbHNlLCAidGFyZ2V0aW5nIjogZmFsc2V9LCAidmVyc2lvbiI6ICIiLCAidXNlcl9pZCI6IDB9; cookie_consent_required=0; show_cookie_consent_modal=0; backend_version=main; age_pass=1; age_pass=1; av=simple:False:True; preroll_skip=1; __cfruid=7c8c91db837889167271889bb4b6c7fef132c4d8-1769073016; cf_clearance=QcvqytWnk0_.0tUbDq7ZhiGZdwQAaXTZ.6l4owdlrjQ-1769073053-1.2.1.1-1.ybVs2WDA8YmwJSLudrwDTF36DS2DCklZBNtEyJ2SMgBzut4xeGY.FAE0ybd3TyQgP0lDxdE8Cjms3x9d1mJPdGXCW6hEnx0QU4TfjqUqPKJMTlDNZ25kXjDXDImiTX5NTDCs7haPvWlmratCCL3ec4DMg2g_2znJf4hvnXZlj5aSta_4p8GkEv7VMR0bF2hW8gcfCaK7yN4m0rmntjavpUg2IiXFthJh3UVSoKygA; media_layout=four-col; cfc_ok=00|1|ww|spankbang|master|0; sb_session=.eJxFzE0OwiAQQOG7zFoSpGKBy5ARpooNP6XUWJve3bpy_763gS1UIyZKDUyrC53gXvEV2mpdzmMgMKA0keiFZ04jZxcUA9PdtWd40x1XUknBCf6ukssxUvLYQk42-GMRx6Ifvj3Z0OHq5dSGMrHzu_-QdAddZqpgNvi1fN-_rHoxkg.aXHwmA.ul15Is9eDXwp2i3rqTNrwhPd00o; __cf_bm=..eKvdaPY4hf8.PjsAfxeB2FkDVveuB.Yvk5MlsVOAs-1769074935-1.0.1.1-cITxC8BDJ3R6u5agct2tQOryiuFr9tGwiq6qehTakAGkVMc5N21y3pwV_Xh6hlNkMd3LLFmu73Sz51LDe.lit5ZXsSrgkR3OLCcqFoxZpT0';
    
    const searchUrl = `${sb.replace(/\/$/, '')}/s/${encodeURIComponent(query)}`;
    const proxyUrl = `https://odd-cloud-1e14.hunternisha55.workers.dev/?url=${encodeURIComponent(searchUrl)}&cookie=${encodeURIComponent(cookie)}`;
    
    const response = await fetch(proxyUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      }
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch search results: ${response.status}` },
        { status: response.status }
      );
    }

    const html = await response.text();
    const $ = load(html);

    // Extract related keywords/tags from the top section
    const relatedKeywords: Array<{ label: string; url: string }> = [];
    $('[data-testid="search-related-keywords"] [data-testid="tag"]').each((_, element) => {
      const $tag = $(element);
      const label = $tag.text().trim();
      const href = $tag.attr('href') || '';
      const fullUrl = href ? `${sb.replace(/\/$/, '')}${href}` : '';
      
      if (label && fullUrl) {
        relatedKeywords.push({ label, url: fullUrl });
      }
    });

    // Extract "Searches Related To" keywords
    const alsoSearchedFor: Array<{ label: string; url: string }> = [];
    $('[data-testid="searched-for-item"]').each((_, element) => {
      const $tag = $(element);
      const label = $tag.text().trim();
      const href = $tag.attr('href') || '';
      const fullUrl = href ? `${sb.replace(/\/$/, '')}${href}` : '';
      
      if (label && fullUrl) {
        alsoSearchedFor.push({ label, url: fullUrl });
      }
    });

    // Extract videos
    const videos: Array<{
      id: string;
      title: string;
      url: string;
      thumbnail: string;
      duration: string;
      resolution: string;
      views: string;
      rating: string;
      channel: string;
      channelUrl: string;
      badgeType: string;
    }> = [];

    $('[data-testid="video-item"].js-video-item').each((_, element) => {
      const $item = $(element);
      
      const id = $item.attr('data-id') || '';
      
      // Get the main video link
      const $link = $item.find('a').first();
      const url = $link.attr('href') || '';
      const fullUrl = url ? `${sb.replace(/\/$/, '')}${url}` : '';
      
      // Get thumbnail and title
      const $img = $link.find('picture img');
      const thumbnail = $img.attr('src') || $img.attr('data-src') || '';
      const title = $img.attr('alt') || '';
      
      // Get duration and resolution
      const duration = $link.find('[data-testid="video-item-length"]').text().trim();
      const resolution = $link.find('[data-testid="video-item-resolution"]').text().trim();
      
      // Get video info section
      const $videoInfo = $item.find('[data-testid="video-info-with-badge"]');
      
      // Get views and rating
      const views = $videoInfo.find('[data-testid="views"] span.md\\:text-body-md').text().trim();
      const rating = $videoInfo.find('[data-testid="rates"] span.md\\:text-body-md').text().trim();
      
      // Get channel/tag info
      const $channelLink = $videoInfo.find('[data-testid="title"] a');
      const channel = $channelLink.find('span').text().trim();
      const channelUrl = $channelLink.attr('href') || '';
      const fullChannelUrl = channelUrl ? `${sb.replace(/\/$/, '')}${channelUrl}` : '';
      
      // Get badge type (channel or tag)
      const $badge = $videoInfo.find('[data-testid="badge"]');
      const badgeType = $badge.attr('data-badge') || '';

      if (id && title && fullUrl) {
        videos.push({
          id,
          title,
          url: fullUrl,
          thumbnail,
          duration,
          resolution,
          views,
          rating,
          channel,
          channelUrl: fullChannelUrl,
          badgeType,
        });
      }
    });

    return NextResponse.json({
      success: true,
      query: query,
      searchUrl: searchUrl,
      totalResults: videos.length,
      relatedKeywords: relatedKeywords,
      alsoSearchedFor: alsoSearchedFor,
      videos: videos,
    });

  } catch (error) {
    console.error('Error processing SpankBang search:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process search',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
