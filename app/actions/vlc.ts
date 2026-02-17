"use server";

import { getPostDetails, resolveProviderUrl } from "@/lib/hdhub4u";

export async function getMovieDetailsAction(movieUrl: string) {
  try {
    const urlObj = new URL(movieUrl);
    if (!urlObj.hostname.includes('hdhub4u') && !urlObj.hostname.includes('4khdhub')) {
        return { success: false, error: "Invalid URL domain" };
    }

    const details = await getPostDetails(movieUrl);
    return { success: true, data: details };
  } catch (error) {
    console.error("Failed to get movie details:", error);
    return { success: false, error: "Failed to get movie details" };
  }
}

export async function resolveVlcLinkAction(url: string) {
  try {
    const resolved = await resolveProviderUrl(url);
    return { success: true, directUrl: resolved.directUrl };
  } catch (error) {
    console.error("Failed to resolve VLC link:", error);
    return { success: false, error: "Failed to resolve direct streaming link" };
  }
}
