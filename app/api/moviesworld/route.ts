import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey, createUnauthorizedResponse } from '@/lib/middleware/api-auth';

interface MoviesWorldItem {
  _id: string;
  tmdb_id: number;
  title: string;
  genres: string[];
  description: string;
  rating: number;
  release_year: number;
  poster: string;
  backdrop: string;
  media_type: 'movie' | 'tv';
}

interface MoviesWorldResponse {
  success: boolean;
  data?: {
    total_count: number;
    results: MoviesWorldItem[];
    query?: string;
    page: number;
  };
  error?: string;
  message?: string;
  remainingRequests?: number;
}

async function fetchMoviesWorldData(query?: string, page: number = 1): Promise<{ total_count: number; results: MoviesWorldItem[] }> {
  try {
    let url: string;
    
    if (query && query.trim()) {
      // Search endpoint
      url = `https://moviesworld738-e52c71f18b14.herokuapp.com/api/search/?query=${encodeURIComponent(query.trim())}&page=${page}`;
    } else {
      // Default/trending endpoint (assuming there's a trending or popular endpoint)
      url = `https://moviesworld738-e52c71f18b14.herokuapp.com/api/trending/?page=${page}`;
    }

    console.log(`Fetching MoviesWorld data from: ${url}`);

    const response = await fetch(url, {
      cache: 'no-cache',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(15000) // 15 second timeout
    });

    if (!response.ok) {
      // If trending endpoint doesn't exist and we get 404, try search with empty query
      if (response.status === 404 && !query) {
        const searchUrl = `https://moviesworld738-e52c71f18b14.herokuapp.com/api/search/?query=&page=${page}`;
        const searchResponse = await fetch(searchUrl, {
          cache: 'no-cache',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(15000)
        });
        
        if (!searchResponse.ok) {
          throw new Error(`Failed to fetch data: ${searchResponse.status}`);
        }
        
        const data = await searchResponse.json();
        return data;
      }
      
      throw new Error(`Failed to fetch data: ${response.status}`);
    }

    const data = await response.json();
    
    // Validate response structure
    if (!data || typeof data.total_count !== 'number' || !Array.isArray(data.results)) {
      throw new Error('Invalid response format from MoviesWorld API');
    }

    console.log(`Successfully fetched ${data.results.length} items from MoviesWorld`);
    return data;

  } catch (error) {
    console.error('Error fetching MoviesWorld data:', error);
    throw error;
  }
}

export async function GET(request: NextRequest): Promise<NextResponse<MoviesWorldResponse>> {
  try {
    // Validate API key
    const authResult = await validateApiKey(request);
    if (!authResult.isValid) {
      return createUnauthorizedResponse(authResult.error || 'Invalid API key') as NextResponse<MoviesWorldResponse>;
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query') || searchParams.get('search') || searchParams.get('q');
    const page = parseInt(searchParams.get('page') || '1');

    if (page < 1) {
      return NextResponse.json<MoviesWorldResponse>(
        { 
          success: false, 
          error: 'Page number must be 1 or greater' 
        },
        { status: 400 }
      );
    }

    console.log('Processing MoviesWorld request:', { query, page });

    const data = await fetchMoviesWorldData(query || undefined, page);

    if (!data.results || data.results.length === 0) {
      return NextResponse.json<MoviesWorldResponse>({
        success: false,
        error: 'No content found',
        message: query 
          ? `No results found for search query: "${query}"` 
          : `No content found on page ${page}`,
        remainingRequests: authResult.apiKey ? (authResult.apiKey.requestsLimit - authResult.apiKey.requestsUsed) : 0
      });
    }

    return NextResponse.json<MoviesWorldResponse>({
      success: true,
      data: {
        total_count: data.total_count,
        results: data.results,
        query: query || undefined,
        page
      },
      remainingRequests: authResult.apiKey ? (authResult.apiKey.requestsLimit - authResult.apiKey.requestsUsed) : 0
    });

  } catch (error: unknown) {
    console.error('MoviesWorld API error:', error);
    
    return NextResponse.json<MoviesWorldResponse>(
      { 
        success: false, 
        error: 'Failed to fetch content from MoviesWorld',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}
