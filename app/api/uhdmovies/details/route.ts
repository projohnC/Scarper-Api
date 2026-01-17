import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { validateProviderAccess, createProviderErrorResponse } from "@/lib/provider-validator";

interface DownloadLink {
  quality: string;
  url: string;
  type?: string;
  size?: string;
  fileName?: string;
}

interface Episode {
  episode: string;
  links: DownloadLink[];
}

interface MovieDetails {
  title: string;
  imageUrl: string;
  posterImages: string[];
  description: string;
  genres: string[];
  releaseDate: string;
  views: string;
  youtubeTrailer: string;
  downloadLinks: DownloadLink[];
  episodes: Episode[];
}

export async function GET(request: NextRequest) {
  const validation = await validateProviderAccess(request, "UhdMovies");
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

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch movie details" },
        { status: response.status }
      );
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const title = $('h1.entry-title').text().trim() || 
                  $('h1').first().text().trim() ||
                  $('meta[property="og:title"]').attr('content') || '';
    const imageUrl = $('.entry-image img').first().attr('src') || 
                     $('meta[property="og:image"]').attr('content') || '';
    
    // Extract all poster images
    const posterImages: string[] = [];
    $('.entry-content img').each((_, elem) => {
      const imgSrc = $(elem).attr('src');
      if (imgSrc && !posterImages.includes(imgSrc)) {
        posterImages.push(imgSrc);
      }
    });
    
    // Extract description from meta or first paragraph
    const description = $('meta[name="description"]').attr('content') || 
                       $('meta[property="og:description"]').attr('content') ||
                       $('.entry-content p').first().text().trim() || '';

    // Extract genres from categories
    const genres: string[] = [];
    $('.entry-category a').each((_, elem) => {
      const genre = $(elem).text().trim();
      if (genre && !genres.includes(genre)) {
        genres.push(genre);
      }
    });

    // Extract release date and views
    const releaseDate = $('.meta-date .updated').text().trim() || '';
    const views = $('.meta-views').text().trim() || '';

    // Extract YouTube trailer
    let youtubeTrailer = '';
    $('iframe').each((_, elem) => {
      const src = $(elem).attr('src') || '';
      if (src.includes('youtube.com') || src.includes('youtu.be')) {
        youtubeTrailer = src;
      }
    });

    const downloadLinks: DownloadLink[] = [];
    const episodes: Episode[] = [];
    let currentEpisode: string | null = null;
    let currentEpisodeLinks: DownloadLink[] = [];
    let currentFileName = '';
    let currentFileSize = '';
    
    // Extract download links from content - focus on paragraphs with file info and G-Drive links
    $('.entry-content p').each((_, element) => {
      const $p = $(element);
      const pText = $p.text().trim();
      
      // Check if this is an episode header
      if (pText.match(/episode\s+\d+|ep\s*\d+|e\d+/i) && !pText.match(/\[.*GB\]/i)) {
        // Save previous episode if exists
        if (currentEpisode && currentEpisodeLinks.length > 0) {
          episodes.push({
            episode: currentEpisode,
            links: [...currentEpisodeLinks],
          });
        }
        currentEpisode = pText;
        currentEpisodeLinks = [];
        currentFileName = '';
        currentFileSize = '';
        return;
      }
      
      // Extract file name and size from text like "Killer.Whale.2026.2160p.AMZN.WEB-DL.DDP5.1.H.265-BYNDR [9.56 GB]"
      const fileMatch = pText.match(/^([^\[]+)\s*\[([^\]]+)\]/);
      if (fileMatch) {
        currentFileName = fileMatch[1].trim();
        currentFileSize = fileMatch[2].trim();
      }
      
      // Find download links in this paragraph
      $p.find('a').each((_, linkElem) => {
        const $link = $(linkElem);
        const linkUrl = $link.attr('href') || '';
        const linkText = $link.text().trim();
        
        // Skip non-download links
        if (!linkUrl || linkUrl.startsWith('#') || linkUrl.startsWith('javascript:')) {
          return;
        }
        
        // Only process G-Drive and similar download links
        if (!linkText.match(/download|g-drive|google\s*drive/i)) {
          return;
        }
        
        // Determine quality from file name or link context
        let quality = 'Unknown';
        let type = 'Direct';
        
        if (currentFileName) {
          if (currentFileName.match(/4k|2160p/i)) quality = '4K/2160p';
          else if (currentFileName.match(/1080p/i)) quality = '1080p';
          else if (currentFileName.match(/720p/i)) quality = '720p';
          else if (currentFileName.match(/480p/i)) quality = '480p';
          else if (currentFileName.match(/360p/i)) quality = '360p';
          
          if (currentFileName.match(/x264/i)) type = 'x264';
          else if (currentFileName.match(/hevc|h\.265|x265/i)) type = 'HEVC';
          else if (currentFileName.match(/h\.264/i)) type = 'x264';
          if (currentFileName.match(/web-dl|webdl/i)) type += ' WEB-DL';
          else if (currentFileName.match(/bluray/i)) type += ' BluRay';
        }
        
        const downloadLink: DownloadLink = {
          quality,
          url: linkUrl,
          type,
          size: currentFileSize,
          fileName: currentFileName,
        };
        
        if (currentEpisode) {
          currentEpisodeLinks.push(downloadLink);
        } else {
          downloadLinks.push(downloadLink);
        }
      });
    });
    
    // Save last episode if exists
    if (currentEpisode && currentEpisodeLinks.length > 0) {
      episodes.push({
        episode: currentEpisode,
        links: currentEpisodeLinks,
      });
    }

    const movieDetails: MovieDetails = {
      title,
      imageUrl,
      posterImages,
      description,
      genres,
      releaseDate,
      views,
      youtubeTrailer,
      downloadLinks,
      episodes,
    };

    return NextResponse.json({
      success: true,
      data: movieDetails,
    });

  } catch (error) {
    console.error("Error in UhdMovies details API:", error);
    return NextResponse.json(
      { 
        error: "Internal server error", 
        message: error instanceof Error ? error.message : "Unknown error" 
      },
      { status: 500 }
    );
  }
}
