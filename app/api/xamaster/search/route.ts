import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { redis, getCache, cacheForever, generateCacheKey } from '@/app/lib/redis';

// Helper function to format duration from seconds to HH:MM:SS
function formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const query = searchParams.get('q');
        const page = searchParams.get('page') || '1';

        if (!query) {
            return NextResponse.json(
                { success: false, error: 'Query parameter (q) is required' },
                { status: 400 }
            );
        }

        // Check cache first
        const cacheKey = generateCacheKey('xmaster', 'search', query, page);
        const cachedData = await getCache(cacheKey);
        if (cachedData) {
            return NextResponse.json(cachedData);
        }

        // Replace spaces with + and build the URL
        const encodedQuery = query.replace(/\s+/g, '+');
        const pageNum = parseInt(page);
        const url = pageNum > 1
            ? `https://xhamster.com/search/${encodedQuery}?page=${pageNum}`
            : `https://xhamster.com/search/${encodedQuery}`;

        // Fetch the search page through proxy
        const proxyUrl = `https://odd-cloud-1e14.hunternisha55.workers.dev/?url=${encodeURIComponent(url)}`;
        const response = await axios.get(proxyUrl);

        // Extract JSON data from response
        let jsonData: any = null;
        const jsonMatch = response.data.match(/window\.initials\s*=\s*({[\s\S]*?});/);
        if (jsonMatch) {
            try {
                jsonData = JSON.parse(jsonMatch[1]);
            } catch (e) {
                console.error('Failed to parse JSON data:', e);
            }
        }

        // Extract data from JSON
        const totalResults = jsonData?.entity?.searchResult?.nbResults || 0;

        // Extract search suggestions from JSON
        const searchSuggestions: any[] = [];
        if (jsonData?.listBlocks?.linkingBlock?.tags) {
            jsonData.listBlocks.linkingBlock.tags.forEach((tag: any) => {
                if (tag.tagKey && tag.link) {
                    searchSuggestions.push({
                        label: tag.tagKey,
                        url: tag.link
                    });
                }
            });
        }

        // Extract pagination info from JSON data
        const pagination: any = {
            currentPage: 1,
            nextPage: null,
            prevPage: null,
            totalPages: null,
            minPage: null,
            maxPage: null,
            hasNextPage: false,
            hasPrevPage: false,
            pageLinkTemplate: null,
            pageLinkFirst: null,
            pages: []
        };

        if (jsonData && jsonData.entity && jsonData.entity.paging) {
            const paging = jsonData.entity.paging;

            pagination.currentPage = paging.active || 1;
            pagination.minPage = paging.minPage || 1;
            pagination.maxPage = paging.maxPage || null;
            pagination.totalPages = paging.maxPages || null;
            pagination.pageLinkTemplate = paging.pageLinkTemplate || null;
            pagination.pageLinkFirst = paging.pageLinkFirst || null;

            // Set next page
            if (paging.next) {
                pagination.nextPage = paging.pageLinkTemplate?.replace('{#}', paging.next.toString()) || null;
                pagination.hasNextPage = true;
            }

            // Set prev page
            if (paging.prev) {
                pagination.prevPage = paging.prev === 1
                    ? paging.pageLinkFirst
                    : paging.pageLinkTemplate?.replace('{#}', paging.prev.toString()) || null;
                pagination.hasPrevPage = true;
            }

            // Generate all page URLs
            if (pagination.totalPages) {
                for (let i = 1; i <= pagination.totalPages; i++) {
                    const pageUrl = i === 1
                        ? paging.pageLinkFirst
                        : paging.pageLinkTemplate?.replace('{#}', i.toString()) || '';

                    pagination.pages.push({
                        page: i,
                        url: pageUrl,
                        active: i === pagination.currentPage,
                        isVisible: i >= pagination.minPage && i <= pagination.maxPage
                    });
                }
            }
        }

        // Extract videos from JSON data
        const videos: any[] = [];

        if (jsonData && jsonData.searchResult && jsonData.searchResult.videoThumbProps) {
            jsonData.searchResult.videoThumbProps.forEach((video: any) => {
                const videoData: any = {
                    id: video.id?.toString() || '',
                    isPlaceholder: false,
                    title: video.title || '',
                    url: video.pageURL || '',
                    pageURL: video.pageURL || '',
                    imageUrl: video.imageURL || video.thumbURL || '',
                    imageURL: video.imageURL || video.thumbURL || '',
                    thumbURL: video.thumbURL || '',
                    previewThumbURL: video.previewThumbURL || null,
                    previewVideoUrl: video.trailerURL || null,
                    trailerURL: video.trailerURL || null,
                    spriteUrl: video.spriteURL || null,
                    spriteURL: video.spriteURL || null,
                    duration: video.duration ? formatDuration(video.duration) : null,
                    durationSeconds: video.duration || null,
                    views: video.views || 0,
                    created: video.created || null,
                    videoType: video.videoType || 'video',
                    uploader: null
                };

                // Add uploader info if available
                if (video.landing) {
                    videoData.uploader = {
                        id: video.landing.id || null,
                        name: video.landing.name || '',
                        url: video.landing.link || '',
                        avatar: video.landing.logo || '',
                        type: video.landing.type || null,
                        subscribers: video.landing.subscribers || null,
                        isInactive: video.landing.isInactive || false,
                        isDeactivated: video.landing.isDeactivated || false
                    };
                }

                videos.push(videoData);
            });
        }

        const responseData = {
            success: true,
            query: query,
            encodedQuery: encodedQuery,
            page: pageNum,
            searchUrl: url,
            totalResults: parseInt(totalResults),
            suggestions: searchSuggestions,
            pagination,
            videos,
            totalVideos: videos.length
        };

        // Cache the response forever
        await cacheForever(cacheKey, responseData);

        return NextResponse.json(responseData);

    } catch (error: any) {
        console.error('Error fetching xmaster search results:', error.message);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to fetch search results',
                message: error.message
            },
            { status: 500 }
        );
    }
}