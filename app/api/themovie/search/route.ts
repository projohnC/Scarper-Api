import { NextRequest, NextResponse } from 'next/server';
import { getBaseUrl } from '@/lib/baseurl';
import * as cheerio from 'cheerio';

interface SearchResult {
  title: string;
  href: string;
  fullUrl: string;
  imageUrl: string;
  rating: string;
}

interface SearchResponse {
  success: boolean;
  query?: string;
  baseUrl?: string;
  searchUrl?: string;
  totalResults?: number;
  results?: SearchResult[];
  error?: string;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q");

    if (!query) {
      return NextResponse.json({
        success: false,
        error: "Query parameter 'q' or 'query' is required"
      } as SearchResponse, { status: 400 });
    }

    const baseUrl = await getBaseUrl('moviebox');
    
    const searchUrlObj = new URL('newWeb/searchResult', baseUrl);
    searchUrlObj.searchParams.set('keyword', query);
    const searchUrl = searchUrlObj.toString();

    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Ch-Ua': '"Not(A:Brand";v="8", "Chromium";v="144", "Brave";v="144"',
        'Sec-Ch-Ua-Mobile': '?1',
        'Sec-Ch-Ua-Platform': '"Android"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Gpc': '1'
      }
    });

    if (!response.ok) {
      return NextResponse.json({
        success: false,
        query,
        baseUrl,
        searchUrl,
        error: `Failed to fetch search results: ${response.status} ${response.statusText}`
      } as SearchResponse, { status: response.status });
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    
    const results: SearchResult[] = [];
    
    $('a.card[href^="/moviesDetail/"]').each((index, element) => {
      const $card = $(element);
      
      const href = $card.attr('href') || '';
      
      const title = $card.find('h2.card-title').attr('title') || $card.find('h2.card-title').text().trim();
      
      let imageUrl = '';
      const imgElement = $card.find('img').first();
      if (imgElement.length) {
        imageUrl = imgElement.attr('src') || imgElement.attr('data-src') || '';
      }
      
      const rating = $card.find('span.rate').text().trim();
      
      if (title && href) {
        results.push({
          title,
          href,
          fullUrl: href.startsWith('http') ? href : new URL(href, baseUrl).toString(),
          imageUrl,
          rating
        });
      }
    });

    return NextResponse.json({
      success: true,
      query,
      baseUrl,
      searchUrl,
      
      totalResults: results.length,
      results
    } as SearchResponse);

  } catch (error) {
    console.error("Error in TheMovie Search API:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Internal server error"
    } as SearchResponse, { status: 500 });
  }
}