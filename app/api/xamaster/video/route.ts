import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { getCache, cacheForever, generateCacheKey } from '@/app/lib/redis';

// Interfaces for Video Details
interface VideoSource {
    label: string;
    link: string;
    id?: number;
}

interface VideoDetails {
    id: string | number;
    title: string;
    description: string;
    duration: number;
    views: number;
    posterUrl: string;
    videoUrl: string | null;
    sources: VideoSource[];
    categories: string[];
    models: string[];
    created: number;
    uploader: {
        name: string;
        link: string;
    } | null;
}

interface VideoResponse {
    success: boolean;
    videoDetails: VideoDetails | null;
}

// Helper to extract JSON data from scripts
function extractVideoData($: cheerio.CheerioAPI): any {
    let videoData = null;
    $('script').each((_, script) => {
        const content = $(script).html();
        if (content && content.includes('window.initials')) {
            const match = content.match(/window\.initials\s*=\s*({[\s\S]*?});/);
            if (match) {
                try {
                    videoData = JSON.parse(match[1]);
                    // Access the video entity in xHamster structure
                    // Typically: videoModel, or xplayer, or similar.
                    // We return the raw JSON to parse in the main function
                } catch (e) {
                    console.error('Error parsing script JSON:', e);
                }
            }
        }
    });
    return videoData;
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const videoUrl = searchParams.get('url');
        const videoId = searchParams.get('id');

        if (!videoUrl && !videoId) {
            return NextResponse.json(
                { success: false, error: 'Video URL (url) or ID (id) is required' },
                { status: 400 }
            );
        }

        // Construct target URL
        let targetUrl = videoUrl;
        if (!targetUrl && videoId) {
            targetUrl = `https://xhamster.com/videos/${videoId}`; // Approximate URL structure
        }

        if (!targetUrl) {
            return NextResponse.json({ success: false, error: 'Could not resolve target URL' }, { status: 400 });
        }

        // Check cache
        const cacheKey = generateCacheKey('xmaster', 'video', targetUrl);
        const cachedData = await getCache(cacheKey);
        if (cachedData) {
            return NextResponse.json(cachedData);
        }

        console.log(`Fetching xMaster video details from: ${targetUrl}`);

        const proxyUrl = `https://odd-cloud-1e14.hunternisha55.workers.dev/?url=${encodeURIComponent(targetUrl)}`;
        const response = await axios.get(proxyUrl);
        const $ = cheerio.load(response.data);

        // Attempt to extract data
        const initials = extractVideoData($);

        // Initialize default details
        const details: VideoDetails = {
            id: videoId || '',
            title: '',
            description: '',
            duration: 0,
            views: 0,
            posterUrl: '',
            videoUrl: null,
            sources: [],
            categories: [],
            models: [],
            created: 0,
            uploader: null
        };

        // Extraction strategies
        // 1. Try JSON data (xHamster usually puts everything in window.initials)
        if (initials && initials.videoModel) {
            const vm = initials.videoModel;
            details.id = vm.id;
            details.title = vm.title;
            details.description = vm.description || '';
            details.duration = vm.duration || 0;
            details.views = vm.views || 0;
            details.posterUrl = vm.thumbURL || vm.posterURL || '';
            details.created = vm.created || 0;

            if (vm.categories) {
                details.categories = vm.categories.map((c: any) => c.name);
            }
            if (vm.models) {
                details.models = vm.models.map((m: any) => m.name);
            }
            if (vm.author) {
                details.uploader = {
                    name: vm.author.name,
                    link: vm.author.pageURL
                };
            }

            // Sources
            // xHamster structure usually has sources inside `sources` object
            if (vm.sources) {
                // e.g. "mp4": { "480p": "link...", "720p": "link..." }
                // or standard array
                if (typeof vm.sources === 'object') {
                    // Flatten
                    Object.keys(vm.sources).forEach(key => {
                        const val = vm.sources[key];
                        if (typeof val === 'string') {
                            details.sources.push({ label: key, link: val });
                        } else if (typeof val === 'object') {
                            Object.keys(val).forEach(q => {
                                details.sources.push({ label: `${key}-${q}`, link: val[q] });
                            });
                        }
                    });
                }
            }
        } else {
            // Fallback: Meta tags
            details.title = $('meta[property="og:title"]').attr('content') || $('title').text();
            details.description = $('meta[property="og:description"]').attr('content') || '';
            details.posterUrl = $('meta[property="og:image"]').attr('content') || '';
            details.videoUrl = $('meta[property="og:video"]').attr('content') || null;

            // Cannot easily extract sources without JSON on xHamster
        }

        const result: VideoResponse = {
            success: true,
            videoDetails: details
        };

        // Cache
        await cacheForever(cacheKey, result);

        return NextResponse.json(result);

    } catch (error: any) {
        console.error('Error fetching xmaster video details:', error.message);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch video details', message: error.message },
            { status: 500 }
        );
    }
}