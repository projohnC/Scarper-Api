import { getPostDetails, resolveProviderUrl } from "@/lib/hdhub4u";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

export default async function WatchPage({
  searchParams,
}: {
  searchParams: Promise<{ url?: string; quality?: string }>;
}) {
  const params = await searchParams;
  const url = params.url;
  const quality = params.quality;

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
        <PlayerWrapper url={url} selectedQuality={quality} />
      </Suspense>
    </div>
  );
}

async function PlayerWrapper({ url, selectedQuality }: { url: string; selectedQuality?: string }) {
  let details;
  let resolved;
  let selectedLink;

  try {
    details = await getPostDetails(url);

    if (selectedQuality) {
      selectedLink = details.links.find(l => l.quality === selectedQuality);
    }

    if (!selectedLink) {
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

  return (
    <div className="relative h-full w-full bg-zinc-950 flex flex-col items-center justify-center p-4">
        <Link
          href="/browse"
          className="absolute top-8 left-8 z-50 flex items-center gap-2 rounded-full bg-white/10 p-3 text-white backdrop-blur-md transition hover:bg-white/20"
        >
          <ArrowLeft className="h-6 w-6" />
          <span className="font-medium pr-2">Back to Browse</span>
        </Link>

        <div className="max-w-4xl w-full space-y-8 text-center">
          {details.imageUrl && (
            <div className="mx-auto w-64 h-96 overflow-hidden rounded-lg shadow-2xl shadow-red-900/20">
               <img src={details.imageUrl} alt={details.title} className="w-full h-full object-cover" />
            </div>
          )}
          
          <div className="space-y-4">
            <h1 className="text-4xl md:text-6xl font-bold text-white tracking-tight">{details.title}</h1>
            <div className="flex items-center justify-center gap-4 text-sm font-bold uppercase tracking-widest text-zinc-400">
               <span className="rounded border border-zinc-800 px-3 py-1 bg-zinc-900/50">{selectedLink.quality}</span>
               <span className="text-green-500">Ready to Stream</span>
            </div>
            <p className="text-lg text-zinc-400 max-w-2xl mx-auto line-clamp-3">
              {details.description}
            </p>
          </div>

          <div className="pt-8 flex flex-col items-center gap-6">
            <a
              href={`vlc://${resolved.directUrl}`}
              className="group relative flex items-center gap-4 rounded-full bg-red-600 px-12 py-5 text-2xl font-black text-white transition-all hover:scale-105 hover:bg-red-700 active:scale-95 shadow-[0_0_50px_-12px_rgba(220,38,38,0.5)]"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20">
                 <svg viewBox="0 0 24 24" fill="currentColor" className="h-8 w-8 ml-1">
                    <path d="M8 5v14l11-7z" />
                 </svg>
              </div>
              OPEN IN VLC
            </a>
            
            <p className="text-zinc-500 text-sm max-w-xs italic">
              Clicking the button will attempt to launch VLC Media Player with the direct stream link.
            </p>

            <div className="pt-4 flex flex-wrap justify-center gap-2 opacity-60">
               {details.links.slice(0, 5).map((link, idx) => (
                 <Link 
                   key={idx} 
                   href={`/watch?url=${encodeURIComponent(url)}&quality=${encodeURIComponent(link.quality)}`}
                   className={`px-3 py-1 text-xs rounded border transition ${link.quality === selectedLink.quality ? 'border-red-500 text-red-500 bg-red-500/10' : 'border-zinc-800 text-zinc-500 hover:border-zinc-600'}`}
                 >
                   {link.quality}
                 </Link>
               ))}
            </div>
          </div>
        </div>
      </div>
    );
}
