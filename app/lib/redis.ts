import { Redis } from '@upstash/redis'

if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    throw new Error('Missing Upstash Redis credentials')
}

export const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

/**
 * Cache data with a key that never expires
 * @param key - The cache key
 * @param data - The data to cache
 */
export async function cacheForever(key: string, data: any) {
    try {
        await redis.set(key, JSON.stringify(data))
        return true
    } catch (error) {
        console.error('Failed to cache data:', error)
        return false
    }
}

/**
 * Get cached data
 * @param key - The cache key
 */
export async function getCache(key: string) {
    try {
        const data = await redis.get(key)
        if (data && typeof data === 'string') {
            return JSON.parse(data)
        }
        return data
    } catch (error) {
        console.error('Failed to get cached data:', error)
        return null
    }
}

/**
 * Generate a cache key for video API to prevent duplicate caching
 * @param platform - The platform name (xmaster, xnxx, xvideos)
 * @param url - The video URL
 */
export function generateVideoCacheKey(platform: string, url: string): string {
    // Normalize the URL to ensure consistency
    const normalizedUrl = url.toLowerCase().trim()
    return `video:${platform}:${Buffer.from(normalizedUrl).toString('base64')}`
}

/**
 * Generate a generic cache key
 * @param prefix - The key prefix
 * @param params - Additional parameters to include in the key
 */
export function generateCacheKey(prefix: string, ...params: string[]): string {
    return `${prefix}:${params.join(':')}`
}