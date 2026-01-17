import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  // Validate API key
  const validation = await validateApiKey(request);
  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.error || 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');

    if (!url) {
      return NextResponse.json(
        { error: 'URL parameter is required' },
        { status: 400 }
      );
    }

    // Get the API key from validation
    const apiKey = validation.keyData?.key;

    // Make request to external extractor API
    const response = await fetch(
      `https://scarperapi-extractor-7tr4.vercel.app/api/gdflix?url=${encodeURIComponent(url)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey || ''
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: 'Failed to extract from gdflix', details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in gdflix extractor:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
