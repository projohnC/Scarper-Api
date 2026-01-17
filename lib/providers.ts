import { getUserEnabledProviders, ProviderName } from "./provider-cache";

export interface Provider {
  name: ProviderName;
  endpoint: string;
}

const PROVIDER_ENDPOINTS: Record<ProviderName, string> = {
  "4kHDHub": "/api/4khdhub/search",
  "HDHub4u": "/api/hdhub4u/search",
  "Movies4u": "/api/movies4u/search",
  "Drive": "/api/drive/search",
  "Vega": "/api/vega/search",
  "ZeeFliz": "/api/zeefliz/search",
  "ZinkMovies": "/api/zinkmovies/search",
  "DesireMovies": "/api/desiremovies/search",
  "NetMirror": "/api/netmirror/search",
  "AnimeSalt": "/api/animesalt/search",
  "KMMovies": "/api/kmmovies/search",
  "Adult": "/api/adult/search",
  "UhdMovies": "/api/uhdmovies/search",
};

export async function getUserProviders(userId: string): Promise<Provider[]> {
  const enabledProviders = await getUserEnabledProviders(userId);
  return enabledProviders
    .filter((name) => name in PROVIDER_ENDPOINTS)
    .map((name) => ({
      name,
      endpoint: PROVIDER_ENDPOINTS[name],
    }));
}

export function getProviderEndpoint(provider: ProviderName): string | null {
  return PROVIDER_ENDPOINTS[provider] || null;
}
