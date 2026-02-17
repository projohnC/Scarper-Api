import { getPostDetails, resolveProviderUrl } from "@/lib/hdhub4u";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

export default async function WatchPage({
  searchParams,
}: {
  searchParams: Promise<{ url?: string }>;
}) {
  const params = await searchParams;
  const url = params.url;

  if (!url) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-black text-white">
        <div className="text-center">
          <p className="text-xl">No movie URL provided.</p>
          <Link href="/browse" className="mt-4 inline-block text-red-600 hover:underline">
            Go back to browse
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-black overflow-hidden">
      <Suspense fallback={
        <div className="flex h-full w-full flex-col items-center justify-center bg-black text-white">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-red-600 border-t-transparent"></div>
          <p className="mt-4 text-lg animate-pulse">Fetching movie details...</p>
        </div>
      }>
        <PlayerWrapper url={url} />
      </Suspense>
    </div>
  );
}

async function PlayerWrapper({ url }: { url: string }) {
  let details;
  let resolved;
  let selectedLink;

  try {
    details = await getPostDetails(url);

    // Find the best quality link or just the first one
    // Prioritizing user-requested qualities: 720p 10Bit HEVC and 480p⚡
    const userPreferredQualities = ["720p 10bit hevc", "480p⚡"];
    const standardQualities = ["1080p", "720p", "480p"];

    selectedLink = details.links[0];

    let foundPreferred = false;
    for (const quality of userPreferredQualities) {
      const found = details.links.find(l => l.quality.toLowerCase().includes(quality.toLowerCase()));
      if (found) {
        selectedLink = found;
        foundPreferred = true;
        break;
      }
    }

    if (!foundPreferred) {
      for (const quality of standardQualities) {
        const found = details.links.find(l => l.quality.toLowerCase().includes(quality));
        if (found) {
          selectedLink = found;
          break;
        }
      }
    }

    if (selectedLink) {
      // Resolve the direct link
      resolved = await resolveProviderUrl(selectedLink.url);
    }
  } catch (error) {
    console.error("Error in PlayerWrapper:", error);
    return (
      <div className="flex h-full w-full flex-col items-center justify-center text-white p-4 text-center">
        <p className="text-xl font-bold text-red-500">Failed to load the movie.</p>
        <p className="text-gray-400 mt-2">Error: {error instanceof Error ? error.message : "Unknown error"}</p>
        <Link href="/browse" className="mt-6 rounded bg-red-600 px-6 py-2 font-bold hover:bg-red-700">
          Return to Browse
        </Link>
      </div>
    );
  }

  if (!details || !selectedLink || !resolved) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center text-white">
        <p className="text-xl font-bold">No playable links found.</p>
        <p className="text-gray-400 mt-2">This movie might not be available for direct streaming.</p>
        <Link href="/browse" className="mt-6 rounded bg-red-600 px-6 py-2 font-bold hover:bg-red-700">
          Go Back
        </Link>
      </div>
    );
  }

  const isEmbed = resolved.directUrl.includes('embed') ||
                  resolved.directUrl.includes('vcloud.icu') ||
                  resolved.directUrl.includes('player') ||
                  !resolved.directUrl.match(/\.(mp4|mkv|webm|m4v|mov|avi)(?:\?|#|$)/i);

  return (
    <div className="relative h-full w-full group">
        <Link
          href="/browse"
          className="absolute top-8 left-8 z-50 flex items-center gap-2 rounded-full bg-black/40 p-3 text-white backdrop-blur-md transition hover:bg-black/60 opacity-0 group-hover:opacity-100"
        >
          <ArrowLeft className="h-6 w-6" />
          <span className="font-medium pr-2">Back to Browse</span>
        </Link>

        {isEmbed ? (
          <iframe
            src={resolved.directUrl}
            className="h-full w-full border-0"
            allowFullScreen
            allow="autoplay; encrypted-media"
          />
        ) : (
          <video
            src={resolved.directUrl}
            controls
            autoPlay
            className="h-full w-full object-contain"
          >
            Your browser does not support the video tag.
          </video>
        )}

        <div className="absolute bottom-20 left-10 z-40 max-w-2xl text-white opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none">
          <h1 className="text-3xl font-bold drop-shadow-lg">{details.title}</h1>
          <div className="mt-2 flex items-center gap-4">
             <span className="rounded bg-zinc-800 px-2 py-1 text-sm font-bold border border-zinc-700">{selectedLink.quality}</span>
             <span className="text-green-400 font-medium">Playing from {resolved.provider || "Direct Link"}</span>
          </div>
          <p className="mt-4 line-clamp-2 text-gray-300 drop-shadow-md">{details.description}</p>
        </div>
      </div>
    );
}
