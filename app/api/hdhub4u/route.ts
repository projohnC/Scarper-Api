import { NextRequest, NextResponse } from 'next/server';
import {
  getLatestContent,
  searchContent,
  getPostDetails,
  resolveProviderUrl,
  detectProvider,
} from '@/lib/hdhub4u';
import { validateProviderAccess, createProviderErrorResponse } from '@/lib/provider-validator';

export async function GET(request: NextRequest) {
  const validation = await validateProviderAccess(request, 'HDHub4u');
  if (!validation.valid) {
    return createProviderErrorResponse(validation.error || 'Unauthorized');
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const action = (searchParams.get('action') || 'latest').toLowerCase();

    if (action === 'latest') {
      const page = searchParams.get('page') || '1';
      const recentMovies = await getLatestContent(page);

      return NextResponse.json({
        success: true,
        action,
        data: {
          page: Number(page) || 1,
          totalItems: recentMovies.length,
          recentMovies,
        },
      });
    }

    if (action === 'search') {
      const query = searchParams.get('q') || searchParams.get('s');
      const page = searchParams.get('page') || '1';

      if (!query) {
        return NextResponse.json({ error: 'Search query parameter (q or s) is required' }, { status: 400 });
      }

      const results = await searchContent(query, page);
      return NextResponse.json({
        success: true,
        action,
        data: {
          query,
          page: Number(page) || 1,
          totalResults: results.length,
          results,
        },
      });
    }

    if (action === 'details') {
      const url = searchParams.get('url');
      if (!url) {
        return NextResponse.json({ error: 'URL parameter is required for details action' }, { status: 400 });
      }

      const details = await getPostDetails(url);
      return NextResponse.json({ success: true, action, data: details });
    }

    if (action === 'resolve') {
      const url = searchParams.get('url');
      if (!url) {
        return NextResponse.json({ error: 'URL parameter is required for resolve action' }, { status: 400 });
      }

      const resolved = await resolveProviderUrl(url);
      return NextResponse.json({
        success: true,
        action,
        data: {
          inputUrl: url,
          ...resolved,
        },
      });
    }

    return NextResponse.json(
      {
        error: 'Invalid action. Supported actions: latest, search, details, resolve',
      },
      { status: 400 },
    );
  } catch (error) {
    console.error('Error in HDHub4u API:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
