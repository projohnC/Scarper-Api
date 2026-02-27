interface RawLink {
  quality?: string;
  size?: string;
  url: string;
}

interface RawSection {
  label: string;
  links: RawLink[];
}

export interface RawSeriesData {
  title?: string;
  imageUrl?: string;
  sections?: RawSection[];
}

interface FormattedEpisodeGroup {
  episodeStart: number;
  episodeEnd: number;
  qualities: {
    "2160p": string[];
    "1080p": string[];
    "720p": string[];
    "480p": string[];
  };
}

export interface FormattedSeriesData {
  title: string;
  posterUrl: string;
  season: number;
  episodes: FormattedEpisodeGroup[];
  metadata: {
    language: string;
    subtitles: string;
    videoFormat: string;
    codec: string;
  };
}

const QUALITY_ORDER = ["2160p", "1080p", "720p", "480p"] as const;

function detectEpisodeRange(label: string): { episodeStart: number; episodeEnd: number } {
  const normalized = label.replace(/\s+/g, " ").trim();

  const rangeMatch = normalized.match(/(?:EP(?:ISODE)?\s*)?(\d+)\s*(?:TO|-)\s*(\d+)/i);
  if (rangeMatch) {
    const start = Number.parseInt(rangeMatch[1], 10);
    const end = Number.parseInt(rangeMatch[2], 10);
    return {
      episodeStart: Number.isNaN(start) ? 0 : start,
      episodeEnd: Number.isNaN(end) ? 0 : end,
    };
  }

  const singleMatch = normalized.match(/(?:EP(?:ISODE)?\s*)(\d+)/i);
  if (singleMatch) {
    const episode = Number.parseInt(singleMatch[1], 10);
    const safeEpisode = Number.isNaN(episode) ? 0 : episode;
    return { episodeStart: safeEpisode, episodeEnd: safeEpisode };
  }

  return { episodeStart: 0, episodeEnd: 0 };
}

function detectQuality(label: string, fallback = ""): (typeof QUALITY_ORDER)[number] | null {
  const value = `${label} ${fallback}`;
  const match = value.match(/(2160p|4k|1080p|720p|480p)/i);

  if (!match) {
    return null;
  }

  const normalized = match[1].toLowerCase() === "4k" ? "2160p" : match[1].toLowerCase();
  return QUALITY_ORDER.find((quality) => quality === normalized) ?? null;
}

function detectHostType(url: string): string {
  try {
    const hostname = new URL(url).hostname.toLowerCase();

    if (hostname.includes("hubcloud")) return "hubcloud";
    if (hostname.includes("pixeldrain")) return "pixeldrain";
    if (hostname.includes("r2.dev")) return "direct";
    if (hostname.includes("gdflix")) return "gdflix";
    if (hostname.includes("filesgram")) return "telegram";

    return hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

function createEpisodeGroup(start: number, end: number): FormattedEpisodeGroup {
  return {
    episodeStart: start,
    episodeEnd: end,
    qualities: {
      "2160p": [],
      "1080p": [],
      "720p": [],
      "480p": [],
    },
  };
}

export function formatWebSeriesData(raw: RawSeriesData): FormattedSeriesData {
  const groupedEpisodes = new Map<string, FormattedEpisodeGroup>();

  for (const section of raw.sections ?? []) {
    const { episodeStart, episodeEnd } = detectEpisodeRange(section.label || "");
    const groupKey = `${episodeStart}-${episodeEnd}`;

    if (!groupedEpisodes.has(groupKey)) {
      groupedEpisodes.set(groupKey, createEpisodeGroup(episodeStart, episodeEnd));
    }

    const episodeGroup = groupedEpisodes.get(groupKey);
    if (!episodeGroup) {
      continue;
    }

    for (const link of section.links ?? []) {
      const hostType = detectHostType(link.url);
      if (hostType === "telegram") {
        continue;
      }

      const quality = detectQuality(link.quality || "", section.label || "");
      if (!quality) {
        continue;
      }

      if (!episodeGroup.qualities[quality].includes(link.url)) {
        episodeGroup.qualities[quality].push(link.url);
      }
    }
  }

  const episodes = [...groupedEpisodes.values()].sort((a, b) => {
    if (a.episodeStart === b.episodeStart) {
      return a.episodeEnd - b.episodeEnd;
    }

    if (a.episodeStart === 0) return 1;
    if (b.episodeStart === 0) return -1;

    return a.episodeStart - b.episodeStart;
  });

  return {
    title: raw.title || "",
    posterUrl: raw.imageUrl || "",
    season: 0,
    episodes,
    metadata: {
      language: "",
      subtitles: "",
      videoFormat: "",
      codec: "",
    },
  };
}
