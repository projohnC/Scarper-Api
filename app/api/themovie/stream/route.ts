import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

interface StreamResponse {
  success: boolean;
  originalUrl?: string;
  convertedUrl?: string;
  apiUrl?: string;
  movieImage?: string;
  data?: any;
  error?: string;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const inputUrl = searchParams.get("url");
    const customSeason = searchParams.get("season"); // Allow season override via query param
    const customEpisode = searchParams.get("episode"); // Allow episode override via query param

    if (!inputUrl) {
      return NextResponse.json({
        success: false,
        error: "URL parameter is required"
      } as StreamResponse, { status: 400 });
    }

    const url = new URL(inputUrl);
    const pathParts = url.pathname.split('/');
    
    if (pathParts[1] !== 'moviesDetail') {
      return NextResponse.json({
        success: false,
        error: "Invalid URL format. Expected /moviesDetail/ path"
      } as StreamResponse, { status: 400 });
    }

    const slug = pathParts[2]; // e.g., "loki-hindi-GF8hK7K8c4a"
    const id = url.searchParams.get('id');
    const urlSeason = url.searchParams.get('season'); // Season from the input URL
    const urlEpisode = url.searchParams.get('episode'); // Episode from the input URL
    const type = url.searchParams.get('type') || '/movie/detail';

    if (!id) {
      return NextResponse.json({
        success: false,
        error: "ID parameter is required in the URL"
      } as StreamResponse, { status: 400 });
    }

    const finalSeason = customSeason || urlSeason;
    const finalEpisode = customEpisode || urlEpisode || '1';

    const convertedUrl = new URL(`https://themoviebox.org/movies/${slug}`);
    convertedUrl.searchParams.set('id', id);
    convertedUrl.searchParams.set('type', type);
    
    if (finalSeason) {
      convertedUrl.searchParams.set('detailSe', finalSeason);
      convertedUrl.searchParams.set('detailEp', finalEpisode);
    }
    
    convertedUrl.searchParams.set('lang', 'en');

    const apiUrl = new URL('https://themoviebox.org/wefeed-h5api-bff/subject/play');
    apiUrl.searchParams.set('subjectId', id);
    
    if (finalSeason) {
      apiUrl.searchParams.set('se', finalSeason);
      apiUrl.searchParams.set('ep', finalEpisode);
    } else {
      apiUrl.searchParams.set('se', '0');
      apiUrl.searchParams.set('ep', '0');
    }
    
    apiUrl.searchParams.set('detailPath', slug);

    const response = await fetch(apiUrl.toString(), {
      method: 'GET',
      headers: {
        'Cookie': 'mb_token=%22eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOjEzMzI1MTYyOTA2MjM4NTEyMDgsImF0cCI6MywiZXh0IjoiMTc2OTU3NDU3NyIsImV4cCI6MTc3NzM1MDU3NywiaWF0IjoxNzY5NTc0Mjc3fQ.Gc4HmKDugVKcWSGoxtCqBTWdZix5dvRpp_22_Z7-7Vk%22; i18n_lang=en',
        'Priority': 'u=1, i',
        'Referer': convertedUrl.toString(),
        'Sec-Ch-Ua': '"Not(A:Brand";v="8", "Chromium";v="144", "Brave";v="144"',
        'Sec-Ch-Ua-Mobile': '?1',
        'Sec-Ch-Ua-Platform': '"Android"',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Gpc': '1',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36',
        'X-Client-Info': '{"timezone":"Asia/Calcutta"}',
        'X-Source': 'h5'
      }
    });

    if (!response.ok) {
      return NextResponse.json({
        success: false,
        originalUrl: inputUrl,
        convertedUrl: convertedUrl.toString(),
        apiUrl: apiUrl.toString(),
        error: `API request failed with status: ${response.status}`
      } as StreamResponse, { status: response.status });
    }

    const data = await response.json();

    // Optionally fetch movie image from the detail page
    let movieImage = '';
    try {
      const detailResponse = await fetch(inputUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        }
      });
      
      if (detailResponse.ok) {
        const detailHtml = await detailResponse.text();
        const $ = cheerio.load(detailHtml);
        
        // Extract image from the movie detail page
        const imgElement = $('.card-cover img, .movie-poster img, img[alt*="full"]').first();
        movieImage = imgElement.attr('src') || imgElement.attr('data-src') || '';
      }
    } catch (imageError) {
      console.warn('Failed to fetch movie image:', imageError);
      // Continue without image - not critical
    }

    return NextResponse.json({
      success: true,
      originalUrl: inputUrl,
      convertedUrl: convertedUrl.toString(),
      apiUrl: apiUrl.toString(),
      movieImage,
      extractedParams: {
        urlSeason,
        urlEpisode,
        finalSeason,
        finalEpisode
      },
      data
    } as StreamResponse);

  } catch (error) {
    console.error("Error in TheMovie Stream API:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Internal server error"
    } as StreamResponse, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url: inputUrl, season: customSeason, episode: customEpisode } = body;

    if (!inputUrl) {
      return NextResponse.json({
        success: false,
        error: "URL is required in request body"
      } as StreamResponse, { status: 400 });
    }

    const url = new URL(inputUrl);
    const pathParts = url.pathname.split('/');
    
    if (pathParts[1] !== 'moviesDetail') {
      return NextResponse.json({
        success: false,
        error: "Invalid URL format. Expected /moviesDetail/ path"
      } as StreamResponse, { status: 400 });
    }

    const slug = pathParts[2];
    const id = url.searchParams.get('id');
    const originalSeason = url.searchParams.get('season');
    const type = url.searchParams.get('type') || '/movie/detail';

    if (!id) {
      return NextResponse.json({
        success: false,
        error: "ID parameter is required in the URL"
      } as StreamResponse, { status: 400 });
    }

    const finalSeason = customSeason || originalSeason;
    const finalEpisode = customEpisode || '1';

    const convertedUrl = new URL(`https://themoviebox.org/movies/${slug}`);
    convertedUrl.searchParams.set('id', id);
    convertedUrl.searchParams.set('type', type);
    
    if (finalSeason) {
      convertedUrl.searchParams.set('detailSe', finalSeason);
      convertedUrl.searchParams.set('detailEp', finalEpisode);
    }
    
    convertedUrl.searchParams.set('lang', 'en');

    const apiUrl = new URL('https://themoviebox.org/wefeed-h5api-bff/subject/play');
    apiUrl.searchParams.set('subjectId', id);
    
    if (finalSeason) {
      apiUrl.searchParams.set('se', finalSeason);
      apiUrl.searchParams.set('ep', finalEpisode);
    } else {
      apiUrl.searchParams.set('se', '0');
      apiUrl.searchParams.set('ep', '0');
    }
    
    apiUrl.searchParams.set('detailPath', slug);

    const response = await fetch(apiUrl.toString(), {
      method: 'GET',
      headers: {
        'Cookie': 'mb_token=%22eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOjEzMzI1MTYyOTA2MjM4NTEyMDgsImF0cCI6MywiZXh0IjoiMTc2OTU3NDU3NyIsImV4cCI6MTc3NzM1MDU3NywiaWF0IjoxNzY5NTc0Mjc3fQ.Gc4HmKDugVKcWSGoxtCqBTWdZix5dvRpp_22_Z7-7Vk%22; i18n_lang=en',
        'Priority': 'u=1, i',
        'Referer': convertedUrl.toString(),
        'Sec-Ch-Ua': '"Not(A:Brand";v="8", "Chromium";v="144", "Brave";v="144"',
        'Sec-Ch-Ua-Mobile': '?1',
        'Sec-Ch-Ua-Platform': '"Android"',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Gpc': '1',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36',
        'X-Client-Info': '{"timezone":"Asia/Calcutta"}',
        'X-Source': 'h5'
      }
    });

    if (!response.ok) {
      return NextResponse.json({
        success: false,
        originalUrl: inputUrl,
        convertedUrl: convertedUrl.toString(),
        apiUrl: apiUrl.toString(),
        error: `API request failed with status: ${response.status}`
      } as StreamResponse, { status: response.status });
    }

    const data = await response.json();

    // Optionally fetch movie image from the detail page
    let movieImage = '';
    try {
      const detailResponse = await fetch(inputUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        }
      });
      
      if (detailResponse.ok) {
        const detailHtml = await detailResponse.text();
        const $ = cheerio.load(detailHtml);
        
        // Extract image from the movie detail page
        const imgElement = $('.card-cover img, .movie-poster img, img[alt*="full"]').first();
        movieImage = imgElement.attr('src') || imgElement.attr('data-src') || '';
      }
    } catch (imageError) {
      console.warn('Failed to fetch movie image:', imageError);
      // Continue without image - not critical
    }

    return NextResponse.json({
      success: true,
      originalUrl: inputUrl,
      convertedUrl: convertedUrl.toString(),
      apiUrl: apiUrl.toString(),
      movieImage,
      customParams: {
        season: customSeason,
        episode: customEpisode
      },
      data
    } as StreamResponse);

  } catch (error) {
    console.error("Error in TheMovie Stream POST API:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Internal server error"
    } as StreamResponse, { status: 500 });
  }
}