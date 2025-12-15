"use client"

import { useAuth } from "@/contexts/auth-context"
import { useRouter } from "next/navigation"
import { useEffect, useState, useCallback } from "react"
import { Search, X, Play, Clock, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import Image from "next/image"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

// Interfaces
interface XMasterVideo {
    id: number | string
    title: string
    duration: number | string
    created?: number | null
    videoType: string
    pageURL: string
    thumbURL: string
    imageURL?: string
    previewThumbURL?: string | null
    views: number
    uploader?: {
        name: string
    } | null
}

interface ApiResponse {
    success?: boolean
    videos?: XMasterVideo[]
    // Search response has pagination
    pagination?: {
        currentPage: number
        hasNextPage: boolean
    }
}

function Navbar({
    searchQuery,
    onSearchChange
}: {
    searchQuery: string,
    onSearchChange: (query: string) => void,
}) {
    return (
        <div className="border-b">
            <div className="flex h-16 items-center px-4">
                <div className="flex items-center gap-4 flex-1">
                    <div className="font-semibold text-lg">xMaster Test</div>
                    {/* Search Bar */}
                    <div className="relative flex-1 max-w-sm md:max-w-md lg:max-w-lg">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="text"
                            placeholder="Search videos..."
                            value={searchQuery}
                            onChange={(e) => onSearchChange(e.target.value)}
                            className="pl-10 pr-10 w-full"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => onSearchChange("")}
                                className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

// Add debounce hook for search
function useDebounce(value: string, delay: number) {
    const [debouncedValue, setDebouncedValue] = useState(value)

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value)
        }, delay)

        return () => {
            clearTimeout(handler)
        }
    }, [value, delay])

    return debouncedValue
}

function VideosGrid({ videos, searchQuery, isSearching }: { videos: XMasterVideo[], searchQuery: string, isSearching: boolean }) {
    if (isSearching) {
        return (
            <div className="flex flex-col items-center justify-center h-[50vh] text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
                <p className="text-lg font-medium mb-2">Searching xMaster...</p>
            </div>
        )
    }

    if (searchQuery && videos.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-[50vh] text-center">
                <Search className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium mb-2">No videos found</p>
                <p className="text-muted-foreground">No results for "{searchQuery}".</p>
            </div>
        )
    }

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 md:gap-5 lg:gap-6 mt-6">
            {videos.map((video, index) => (
                <a
                    key={`${video.id}-${index}`}
                    href={video.pageURL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group transition-transform hover:scale-[1.03] focus:outline-none focus:ring-2 focus:ring-primary rounded-lg overflow-hidden bg-card border shadow-sm"
                >
                    <div className="flex flex-col h-full">
                        <div className="aspect-video relative overflow-hidden bg-muted">
                            {video.thumbURL ? (
                                <Image
                                    src={video.thumbURL}
                                    alt={video.title}
                                    fill
                                    className="object-cover transition-opacity duration-300 group-hover:opacity-90"
                                    sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 20vw"
                                    unoptimized // xHamster images might be external
                                />
                            ) : (
                                <div className="flex items-center justify-center h-full text-muted-foreground">
                                    <Play className="h-8 w-8 opacity-50" />
                                </div>
                            )}
                            {/* Duration Badge */}
                            {video.duration && (
                                <div className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] px-1 rounded flex items-center gap-0.5">
                                    <Clock className="w-3 h-3" />
                                    <span>
                                        {typeof video.duration === 'number'
                                            ? new Date(video.duration * 1000).toISOString().substr(11, 8).replace(/^00:/, '')
                                            : video.duration}
                                    </span>
                                </div>
                            )}
                        </div>
                        <div className="p-3 flex flex-col flex-1">
                            <h3 className="font-medium text-sm line-clamp-2 mb-1 group-hover:text-primary transition-colors">
                                {video.title}
                            </h3>
                            <div className="mt-auto flex items-center justify-between text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                    <Eye className="w-3 h-3" />
                                    {typeof video.views === 'number' ? video.views.toLocaleString() : video.views}
                                </span>
                                {video.uploader && (
                                    <span className="truncate max-w-[80px]">{video.uploader.name}</span>
                                )}
                            </div>
                        </div>
                    </div>
                </a>
            ))}
        </div>
    )
}

export default function XMasterDashboard() {
    const { user, loading: authLoading } = useAuth()
    const router = useRouter()
    const [videos, setVideos] = useState<XMasterVideo[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState("")
    const [isSearching, setIsSearching] = useState(false)

    // Debounce search query
    const debouncedSearchQuery = useDebounce(searchQuery, 600)

    useEffect(() => {
        if (!authLoading && !user) {
            router.push("/login")
        }
    }, [user, authLoading, router])

    // Fetch Homepage Data
    const fetchHomepage = useCallback(async () => {
        try {
            setLoading(true)
            setError('')

            const res = await fetch('/api/xamaster/homepage')
            const data = await res.json()

            // The homepage API returns { videos: [...] } directly or nested?
            // Based on my code: NextResponse.json(data) where data = { videos: [] }
            // Or in the latest edit: NextResponse.json(data)

            if (data.videos) {
                setVideos(data.videos)
            } else if (Array.isArray(data)) {
                setVideos(data)
            } else {
                console.warn("Unexpected API format", data)
                setVideos([])
            }
        } catch (err) {
            setError("Failed to load homepage videos")
            console.error(err)
        } finally {
            setLoading(false)
        }
    }, [])

    // Search Function
    const performSearch = useCallback(async (query: string) => {
        if (!query.trim()) {
            fetchHomepage()
            setIsSearching(false)
            return
        }

        setIsSearching(true)
        setError('')

        try {
            const params = new URLSearchParams()
            params.append('q', query.trim())

            const res = await fetch(`/api/xamaster/search?${params.toString()}`)
            const data: ApiResponse = await res.json()

            if (data.success && data.videos) {
                setVideos(data.videos)
            } else {
                setVideos([])
            }
        } catch (err) {
            console.error("Search error:", err)
            setError("Failed to search videos")
            setVideos([])
        } finally {
            setIsSearching(false)
        }
    }, [fetchHomepage])

    // Initial Fetch
    useEffect(() => {
        if (user && !searchQuery) {
            fetchHomepage()
        }
    }, [user, fetchHomepage, searchQuery])

    // Handle Search Debounce
    useEffect(() => {
        // Only search if there's a query; otherwise the initial fetch handles empty state
        if (debouncedSearchQuery) {
            performSearch(debouncedSearchQuery)
        } else if (user && !loading && videos.length === 0 && !error) {
            // If search is cleared, reload homepage
            fetchHomepage()
        }
    }, [debouncedSearchQuery, performSearch, user])


    if (authLoading) return <div className="p-8 text-center">Loading auth...</div>
    if (!user) return null

    return (
        <div className="flex flex-col min-h-screen bg-background">
            <Navbar
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
            />

            <div className="flex-1 p-4 md:p-6 overflow-y-auto">
                {error && (
                    <div className="bg-destructive/15 text-destructive px-4 py-3 rounded-md mb-6">
                        {error}
                        <Button variant="link" onClick={() => window.location.reload()} className="ml-2 h-auto p-0">Retry</Button>
                    </div>
                )}

                {loading && !isSearching ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 mt-6">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => (
                            <div key={i} className="aspect-video bg-muted animate-pulse rounded-lg"></div>
                        ))}
                    </div>
                ) : (
                    <VideosGrid videos={videos} searchQuery={searchQuery} isSearching={isSearching} />
                )}
            </div>
        </div>
    )
}
