import {  NextResponse } from 'next/server';
import { getBaseUrl, getCookies } from '@/lib/baseurl';
import * as cheerio from 'cheerio';

interface Movie {
  title: string;
  href: string;
  imageUrl: string;
  language: string;
  fullUrl: string;
}

export async function GET( ) {
  try {
    // Get the moviebox URL from your providers
    const movieboxUrl = await getBaseUrl('moviebox');
    const cookies = await getCookies();
    
    // Fetch the HTML from moviebox
    const response = await fetch(movieboxUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Cookie': cookies,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch moviebox page: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    
    const movies: Movie[] = [];
    
    // Parse the movie cards from the HTML
    $('.movie-card').each((index, element) => {
      const $card = $(element);
      
      const title = $card.find('p').text().trim();
      const href = $card.attr('href') || '';
      const imageUrl = $card.find('img').attr('src') || $card.find('img').attr('data-src') || '';
      const language = $card.find('span').text().trim() || 'Unknown';
      
      if (title && href) {
        movies.push({
          title,
          href,
          imageUrl,
          language,
          fullUrl: href.startsWith('http') ? href : `${movieboxUrl}${href}`
        });
      }
    });
    
    return NextResponse.json({
      success: true,
      provider: 'moviebox',
      baseUrl: movieboxUrl,
      totalMovies: movies.length,
      movies: movies
    });
    
  } catch (error) {
    console.error('Error scraping moviebox:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to scrape moviebox data'
    }, { status: 500 });
  }
}