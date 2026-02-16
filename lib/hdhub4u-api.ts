export interface Hdhub4uListItem {
  id: string;
  title: string;
  url: string;
  imageUrl: string;
}

export interface Hdhub4uLatestResponse {
  success: boolean;
  data: {
    recentMovies: Hdhub4uListItem[];
    page: number;
    totalItems: number;
  };
}

export interface Hdhub4uSearchResponse {
  success: boolean;
  data: {
    query: string;
    page: number;
    results: Hdhub4uListItem[];
    totalResults: number;
    found: number;
  };
}

export interface Hdhub4uDownloadLink {
  quality: string;
  url: string;
  type?: string;
}

export interface Hdhub4uEpisode {
  episode: string;
  links: Hdhub4uDownloadLink[];
}

export interface Hdhub4uDetailsResponse {
  success: boolean;
  data: {
    title: string;
    imageUrl: string;
    description: string;
    downloadLinks: Hdhub4uDownloadLink[];
    episodes: Hdhub4uEpisode[];
  };
}

export interface Hdhub4uResolveResponse {
  success: boolean;
  originalUrl: string;
  redirectUrl: string;
}

export interface Hdhub4uClientConfig {
  baseUrl: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
}

export class Hdhub4uApiClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: Hdhub4uClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.apiKey = config.apiKey;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async latest(page = 1): Promise<Hdhub4uLatestResponse> {
    return this.get<Hdhub4uLatestResponse>("/api/hdhub4u", { page: String(page) });
  }

  async search(query: string, page = 1): Promise<Hdhub4uSearchResponse> {
    return this.get<Hdhub4uSearchResponse>("/api/hdhub4u/search", {
      q: query,
      page: String(page),
    });
  }

  async postDetails(url: string): Promise<Hdhub4uDetailsResponse> {
    return this.get<Hdhub4uDetailsResponse>("/api/hdhub4u/details", { url });
  }

  async resolveProviderUrl(url: string): Promise<Hdhub4uResolveResponse> {
    return this.get<Hdhub4uResolveResponse>("/api/hdhub4u/extractor", { url });
  }

  private async get<T>(path: string, query: Record<string, string>): Promise<T> {
    const requestUrl = new URL(`${this.baseUrl}${path}`);

    for (const [key, value] of Object.entries(query)) {
      if (value) requestUrl.searchParams.set(key, value);
    }

    const response = await this.fetchImpl(requestUrl.toString(), {
      headers: {
        ...(this.apiKey ? { "x-api-key": this.apiKey } : {}),
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`HDHub4u API request failed (${response.status}): ${body}`);
    }

    return (await response.json()) as T;
  }
}
