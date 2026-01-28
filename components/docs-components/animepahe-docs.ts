export const ANIMEPAHE_ENDPOINTS = [
  {
    name: "AnimePahe Airing",
    method: "GET",
    endpoint: "/api/animepahe",
    provider: "AnimePahe",
    description: "Get currently airing anime from AnimePahe. Fetches data from multiple pages in a single request.",
    requiresAuth: true,
    parameters: [
      { name: "maxPages", type: "string", required: false, description: "Number of pages to fetch (default: 5, max recommended: 10)" },
    ],
    tsExample: `const response = await fetch(\`\${baseUrl}/api/animepahe?maxPages=5\`, {
  method: 'GET',
  headers: {
    'x-api-key': 'YOUR_API_KEY',
    'Content-Type': 'application/json'
  }
});

interface AnimeEpisode {
  id: number;
  anime_id: number;
  anime_title: string;
  anime_session: string;
  episode: number;
  episode2: number;
  edition: string;
  fansub: string;
  snapshot: string;
  disc: string;
  session: string;
  filler: number;
  created_at: string;
  completed: number;
}

interface AiringResponse {
  success: boolean;
  result: {
    total: number;
    per_page: number;
    pages_fetched: number;
    last_page: number;
    data: AnimeEpisode[];
  };
}

const data: AiringResponse = await response.json();
console.log(data);`,
    jsExample: `fetch(\`\${baseUrl}/api/animepahe?maxPages=5\`, {
  method: 'GET',
  headers: {
    'x-api-key': 'YOUR_API_KEY',
    'Content-Type': 'application/json'
  }
})
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error('Error:', error));`,
    curlExample: `curl -X GET "https://screenscapeapi.dev/api/animepahe?maxPages=5" \\
  -H "x-api-key: YOUR_API_KEY" \\
  -H "Content-Type: application/json"`,
    responseExample: `{
  "success": true,
  "result": {
    "total": 6110,
    "per_page": 12,
    "pages_fetched": 5,
    "last_page": 510,
    "data": [
      {
        "id": 73615,
        "anime_id": 6302,
        "anime_title": "Hell Teacher: Jigoku Sensei Nube Part 2",
        "anime_session": "ed961a64-29fb-baf9-64bb-f4227238e2bc",
        "episode": 17,
        "episode2": 0,
        "edition": "",
        "fansub": "Amazon",
        "snapshot": "https://i.animepahe.si/snapshots/...",
        "disc": "",
        "session": "1a1aaa8be45f086c3ba2381e33158a6385ecf1790d151db861cd1d1b9d65bd1d",
        "filler": 0,
        "created_at": "2026-01-28 16:24:13",
        "completed": 0
      }
    ]
  }
}`
  },
  {
    name: "AnimePahe Episode Details",
    method: "GET",
    endpoint: "/api/animepahe/details",
    provider: "AnimePahe",
    description: "Get detailed information about an anime episode including all available episodes and streaming details.",
    requiresAuth: true,
    parameters: [
      { name: "url", type: "string", required: true, description: "Full AnimePahe play URL (e.g., https://animepahe.si/play/anime_session/episode_session)" },
    ],
    tsExample: `const response = await fetch(\`\${baseUrl}/api/animepahe/details?url=\${encodeURIComponent(playUrl)}\`, {
  method: 'GET',
  headers: {
    'x-api-key': 'YOUR_API_KEY',
    'Content-Type': 'application/json'
  }
});

interface Episode {
  episode: number;
  session: string;
  url: string;
  isActive: boolean;
}

interface CurrentEpisode {
  episode: number;
  session: string;
  provider: string;
  stream_url: string;
}

interface DetailsResponse {
  success: boolean;
  data: {
    anime_session: string;
    anime_title: string;
    current_episode: CurrentEpisode;
    episodes: Episode[];
    total_episodes: number;
  };
}

const data: DetailsResponse = await response.json();
console.log(data);`,
    jsExample: `fetch(\`\${baseUrl}/api/animepahe/details?url=\${encodeURIComponent(playUrl)}\`, {
  method: 'GET',
  headers: {
    'x-api-key': 'YOUR_API_KEY',
    'Content-Type': 'application/json'
  }
})
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error('Error:', error));`,
    curlExample: `curl -X GET "https://screenscapeapi.dev/api/animepahe/details?url=https%3A%2F%2Fanimepahe.si%2Fplay%2F99c9e7db-403a-f564-bc74-52d7ea781f91%2F9f5e55583d79a47bb69d6f905f86fba8c64339a5783d07b2ae2f42c5743c0be2" \\
  -H "x-api-key: YOUR_API_KEY" \\
  -H "Content-Type: application/json"`,
    responseExample: `{
  "success": true,
  "data": {
    "anime_session": "99c9e7db-403a-f564-bc74-52d7ea781f91",
    "anime_title": "Tamon's B-Side - Episode 5",
    "current_episode": {
      "episode": 5,
      "session": "9f5e55583d79a47bb69d6f905f86fba8c64339a5783d07b2ae2f42c5743c0be2",
      "provider": "kwik",
      "stream_url": "https://kwik.cx/e/Sm5UhKJc9L5Y"
    },
    "episodes": [
      {
        "episode": 1,
        "session": "a8bed0a582cc22ecacbfae1b8f59133a486dc52136ce974cfa06c30b963a4ced",
        "url": "https://animepahe.si/play/99c9e7db-403a-f564-bc74-52d7ea781f91/a8bed0a582cc22ecacbfae1b8f59133a486dc52136ce974cfa06c30b963a4ced",
        "isActive": false
      },
      {
        "episode": 5,
        "session": "9f5e55583d79a47bb69d6f905f86fba8c64339a5783d07b2ae2f42c5743c0be2",
        "url": "https://animepahe.si/play/99c9e7db-403a-f564-bc74-52d7ea781f91/9f5e55583d79a47bb69d6f905f86fba8c64339a5783d07b2ae2f42c5743c0be2",
        "isActive": true
      }
    ],
    "total_episodes": 5
  }
}`
  },
  {
    name: "AnimePahe Stream Extractor",
    method: "GET",
    endpoint: "/api/animepahe/stream",
    provider: "AnimePahe",
    description: "Extract m3u8 stream URL from kwik.cx or other AnimePahe streaming providers. ⚠️ IMPORTANT: Requires Referer and Origin headers to play.",
    requiresAuth: true,
    parameters: [
      { name: "url", type: "string", required: true, description: "Streaming page URL (e.g., https://kwik.cx/e/...)" },
    ],
    tsExample: `const response = await fetch(\`\${baseUrl}/api/animepahe/stream?url=\${encodeURIComponent(streamUrl)}\`, {
  method: 'GET',
  headers: {
    'x-api-key': 'YOUR_API_KEY',
    'Content-Type': 'application/json'
  }
});

interface StreamResponse {
  success: boolean;
  data: {
    m3u8_url: string;
    source_url: string;
  };
}

const data: StreamResponse = await response.json();

// IMPORTANT: To play the m3u8 URL, you must include these headers:
const videoResponse = await fetch(data.data.m3u8_url, {
  headers: {
    'Referer': 'https://kwik.cx/',
    'Origin': 'https://kwik.cx'
  }
});`,
    jsExample: `fetch(\`\${baseUrl}/api/animepahe/stream?url=\${encodeURIComponent(streamUrl)}\`, {
  method: 'GET',
  headers: {
    'x-api-key': 'YOUR_API_KEY',
    'Content-Type': 'application/json'
  }
})
  .then(response => response.json())
  .then(data => {
    console.log(data);
    
    // IMPORTANT: To play the m3u8 URL, you must include these headers:
    // Referer: https://kwik.cx/
    // Origin: https://kwik.cx
  })
  .catch(error => console.error('Error:', error));`,
    curlExample: `curl -X GET "https://screenscapeapi.dev/api/animepahe/stream?url=https%3A%2F%2Fkwik.cx%2Fe%2FSm5UhKJc9L5Y" \\
  -H "x-api-key: YOUR_API_KEY" \\
  -H "Content-Type: application/json"`,
    responseExample: `{
  "success": true,
  "data": {
    "m3u8_url": "https://top-owocdn.vault.stream/01/46b3708cfeea9148ff5bff940b2e922a775b0c03cc54bf246535fc1fd58199e8/uwu.m3u8",
    "source_url": "https://kwik.cx/e/Sm5UhKJc9L5Y"
  }
}

⚠️ IMPORTANT: To play this m3u8 URL, you MUST include these headers:
- Referer: https://kwik.cx/
- Origin: https://kwik.cx

Without these headers, the stream will not work!`
  }
];
