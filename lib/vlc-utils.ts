import { toast } from "sonner";
import { getMovieDetailsAction, resolveVlcLinkAction } from "@/app/actions/vlc";

export async function playInVLC(movieUrl: string) {
  const toastId = toast.loading("Fetching movie details...");

  try {
    const result = await getMovieDetailsAction(movieUrl);

    if (!result.success || !result.data) {
      throw new Error(result.error || "Failed to fetch movie details");
    }

    const details = result.data;
    const links = details.links || []; // Note: getPostDetails returns 'links' not 'downloadLinks'

    if (links.length === 0) {
      throw new Error("No playable links found for this movie.");
    }

    // Prioritizing user-requested qualities: 720p 10Bit HEVC and 480p⚡
    const userPreferredQualities = ["720p 10bit hevc", "480p⚡"];
    const standardQualities = ["1080p", "720p", "480p"];

    let selectedLink = links[0];
    let foundPreferred = false;

    for (const quality of userPreferredQualities) {
      const found = links.find((l: { quality: string }) => l.quality.toLowerCase().includes(quality.toLowerCase()));
      if (found) {
        selectedLink = found;
        foundPreferred = true;
        break;
      }
    }

    if (!foundPreferred) {
      for (const quality of standardQualities) {
        const found = links.find((l: { quality: string }) => l.quality.toLowerCase().includes(quality.toLowerCase()));
        if (found) {
          selectedLink = found;
          break;
        }
      }
    }

    if (!selectedLink || !selectedLink.url) {
        throw new Error("Could not find a valid stream link.");
    }

    toast.loading(`Resolving direct link for ${selectedLink.quality}...`, { id: toastId });

    const resolveResult = await resolveVlcLinkAction(selectedLink.url);
    if (!resolveResult.success || !resolveResult.directUrl) {
      throw new Error(resolveResult.error || "Failed to resolve direct streaming link");
    }

    toast.success(`Found link! Opening VLC...`, { id: toastId });

    // Open in VLC
    window.location.href = `vlc://${resolveResult.directUrl}`;

  } catch (error) {
    console.error("VLC Playback Error:", error);
    toast.error(error instanceof Error ? error.message : "Failed to play in VLC", { id: toastId });
  }
}
