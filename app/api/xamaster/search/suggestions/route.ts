import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { redis, getCache, cacheForever, generateCacheKey } from '@/app/lib/redis';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const query = searchParams.get('q');

        if (!query) {
            return NextResponse.json(
                { success: false, error: 'Query parameter (q) is required' },
                { status: 400 }
            );
        }

        // Check cache first
        const cacheKey = generateCacheKey('xmaster', 'suggestion', query);
        const cachedData = await getCache(cacheKey);
        if (cachedData) {
            return NextResponse.json(cachedData);
        }

        // Replace spaces with + for the API call
        const encodedQuery = query.replace(/\s+/g, '+');

        // Call xHamster search suggestion API through proxy
        const apiUrl = `https://xhamster.com/api/front/search/suggest?searchValue=${encodedQuery}&searchScope=video&orientation=straight`;
        const proxyUrl = `https://odd-cloud-1e14.hunternisha55.workers.dev/?url=${encodeURIComponent(apiUrl)}`;
        const response = await axios.get(proxyUrl);

        // Parse and format the suggestions
        const suggestions = response.data.map((item: any) => ({
            text: item.text || '',
            plainText: item.plainText || '',
            link: item.link || '',
            type: item.type2 || item.type || '',
            weight: item.weight || 0,
            modelName: item.modelName || '',
            orientation: item.orientation || null,
            count: item.count || 0,
            source: item.source || null
        }));

        const responseData = {
            success: true,
            query: query,
            encodedQuery: encodedQuery,
            suggestions,
            totalSuggestions: suggestions.length
        };

        // Cache the response forever
        await cacheForever(cacheKey, responseData);

        return NextResponse.json(responseData);

    } catch (error: any) {
        console.error('Error fetching search suggestions:', error.message);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to fetch search suggestions',
                message: error.message
            },
            { status: 500 }
        );
    }
}