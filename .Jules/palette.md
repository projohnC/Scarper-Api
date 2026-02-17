## 2024-05-22 - [Loading Skeleton Pattern for Content Rows]
**Learning:** In a media-heavy interface like a Netflix clone, layout shifts during data fetching can be jarring. Implementing a `Skeleton` component that matches the exact aspect ratio and dimensions of the `MovieCard` (e.g., `h-[40vw]` on mobile, `h-[12vw]` on desktop) significantly improves perceived performance and prevents layout thrashing.
**Action:** Always use Skeleton loaders that mirror the final component's skeleton structure when fetching movie metadata or thumbnails.
