import { NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { hmasterBaseUrl } from '@/app/url/baseurl';
import { redis, getCache, cacheForever, generateCacheKey } from '@/app/lib/redis';

export async function GET() {
    try {
        // Check cache first
        const cacheKey = generateCacheKey('xmaster', 'homepage');
        const cachedData = await getCache(cacheKey);
        if (cachedData) {
            return NextResponse.json(cachedData);
        }

        // Decode base64 URL
        const baseUrl = Buffer.from(hmasterBaseUrl, 'base64').toString('utf-8');

        // Initialize data structure
        const data: {
            videos: Array<{
                id: number;
                title: string;
                duration: number;
                created: number;
                videoType: string;
                pageURL: string;
                thumbURL: string;
                imageURL: string;
                previewThumbURL: string;
                spriteURL: string;
                trailerURL: string;
                views: number;
                landing: {
                    type: string;
                    id: number;
                    name: string;
                    logo: string;
                    link: string;
                    subscribers: number | null;
                };
            }>;
        } = {
            videos: []
        };

        // Helper function to extract videos from JSON in script tags
        const extractVideos = ($: cheerio.CheerioAPI) => {
            const videos: typeof data.videos = [];

            try {
                // Find script tags containing JSON data
                $('script').each((_, script) => {
                    const scriptContent = $(script).html();
                    if (scriptContent && scriptContent.includes('videoThumbProps')) {
                        try {
                            // Extract JSON from script
                            const jsonMatch = scriptContent.match(/window\.initials\s*=\s*({[\s\S]*?});/);
                            if (jsonMatch) {
                                const jsonData = JSON.parse(jsonMatch[1]);

                                // Navigate to videoThumbProps
                                if (jsonData?.layoutPage?.videoListProps?.videoThumbProps) {
                                    const videoThumbProps = jsonData.layoutPage.videoListProps.videoThumbProps;

                                    videoThumbProps.forEach((video: any) => {
                                        if (video.id && video.title) {
                                            videos.push({
                                                id: video.id,
                                                title: video.title,
                                                duration: video.duration,
                                                created: video.created,
                                                videoType: video.videoType,
                                                pageURL: video.pageURL,
                                                thumbURL: video.thumbURL,
                                                imageURL: video.imageURL,
                                                previewThumbURL: video.previewThumbURL,
                                                spriteURL: video.spriteURL,
                                                trailerURL: video.trailerURL,
                                                views: video.views,
                                                landing: {
                                                    type: video.landing?.type || '',
                                                    id: video.landing?.id || 0,
                                                    name: video.landing?.name || '',
                                                    logo: video.landing?.logo || '',
                                                    link: video.landing?.link || '',
                                                    subscribers: video.landing?.subscribers || null
                                                }
                                            });
                                        }
                                    });
                                }
                            }
                        } catch (parseError) {
                            console.error('Error parsing JSON from script:', parseError);
                        }
                    }
                });
            } catch (error) {
                console.error('Error extracting videos:', error);
            }

            return videos;
        };

        // Fetch and parse 5 pages through proxy
        for (let page = 1; page <= 5; page++) {
            const pageUrl = page === 1 ? baseUrl : `${baseUrl}/${page}`;
            const proxyUrl = `https://odd-cloud-1e14.hunternisha55.workers.dev/?url=${encodeURIComponent(pageUrl)}`;

            try {
                const response = await axios.get(proxyUrl);
                const html = response.data;
                const $ = cheerio.load(html);
                const videos = extractVideos($);
                data.videos.push(...videos);
                console.log(`Fetched ${videos.length} videos from page ${page}`);
            } catch (pageError) {
                console.error(`Error fetching page ${page}:`, pageError);
            }
        }

        // Cache the response forever
        await cacheForever(cacheKey, data);

        return NextResponse.json(data);
    } catch (error) {
        console.error('Error fetching xmaster data:', error);
        return NextResponse.json(
            { error: 'Failed to fetch xmaster data', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}