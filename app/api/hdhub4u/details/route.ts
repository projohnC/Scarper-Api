import { NextRequest, NextResponse } from "next/server";
import { validateProviderAccess, createProviderErrorResponse } from "@/lib/provider-validator";
import { getPostDetails, resolveProviderUrl } from "@/lib/hdhub4u";

export async function GET(request: NextRequest) {
  const validation = await validateProviderAccess(request, "HDHub4u");
  if (!validation.valid) {
    return createProviderErrorResponse(validation.error || "Unauthorized");
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const url = searchParams.get("url");

    if (!url) {
      return NextResponse.json(
        { error: "URL parameter is required" },
        { status: 400 }
      );
    }

    // SSRF protection
    try {
      const urlObj = new URL(url);
      const allowedDomains = ['hdhub4u', '4khdhub', 'gadgetsweb', 'linkstaker', 'sharedrive', 'hubdrive', 'hubcloud'];
      const isAllowed = allowedDomains.some(domain => urlObj.hostname.includes(domain));

      if (!isAllowed) {
         return NextResponse.json(
           { error: "Invalid URL domain. Only HDHub4u related domains are allowed." },
           { status: 400 }
         );
      }
    } catch {
      return NextResponse.json(
        { error: "Invalid URL format" },
        { status: 400 }
      );
    }

    // Use the library's scraping logic which includes normalization
    const details = await getPostDetails(url);

    // Resolve links in parallel to provide direct links as requested by the user
    // Limit concurrency if needed, but for now we follow the previous turn's request
    const resolvedLinks = await Promise.all(
      details.links.map(async (link) => {
        try {
          const resolved = await resolveProviderUrl(link.url);
          return {
            ...link,
            url: resolved.directUrl,
            provider: resolved.provider
          };
        } catch {
          return link;
        }
      })
    );

    // Also resolve episode links
    const resolvedEpisodes = await Promise.all(
      details.episodes.map(async (episode) => {
        const links = await Promise.all(
          episode.links.map(async (link) => {
            try {
              const resolved = await resolveProviderUrl(link.url);
              return {
                ...link,
                url: resolved.directUrl,
                provider: resolved.provider
              };
            } catch {
              return link;
            }
          })
        );
        return { ...episode, links };
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        title: details.title,
        imageUrl: details.imageUrl,
        description: details.description,
        downloadLinks: resolvedLinks,
        episodes: resolvedEpisodes,
      },
    });

  } catch (error) {
    console.error("Error in HDHub4u Details API:", error);
    return NextResponse.json(
      { 
        error: "Internal server error", 
        message: error instanceof Error ? error.message : "Unknown error" 
      },
      { status: 500 }
    );
  }
}
