export const SB_ENDPOINTS = [
  {
    name: "SB Home",
    method: "GET",
    endpoint: "/api/adult/sb",
    provider: "Adult (SB)",
    description: "Get latest adult videos from SpankBang homepage (18+ Only)",
    requiresAuth: true,
    parameters: [],
    tsExample: `const response = await fetch(\`\${baseUrl}/api/adult/sb\`, {
  method: 'GET',
  headers: {
    'x-api-key': 'YOUR_API_KEY',
    'Content-Type': 'application/json'
  }
});

interface VideoInfo {
  id: string;
  title: string;
  url: string;
  thumbnail: string;
  duration: string;
  views: string;
  rating: string;
  channel: string;
  channelUrl: string;
  isChannelBadge: boolean;
}

interface SBResponse {
  videos: VideoInfo[];
}

const data: SBResponse = await response.json();
console.log(data);`,
    jsExample: `fetch(\`\${baseUrl}/api/adult/sb\`, {
  method: 'GET',
  headers: {
    'x-api-key': 'YOUR_API_KEY',
    'Content-Type': 'application/json'
  }
})
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error('Error:', error));`,
    curlExample: `curl -X GET "https://screenscapeapi.dev/api/adult/sb" \\
  -H "x-api-key: YOUR_API_KEY" \\
  -H "Content-Type: application/json"`,
    responseExample: `{
  "videos": [
    {
      "id": "12345",
      "title": "Sample Video Title",
      "url": "https://spankbang.com/...",
      "thumbnail": "https://...",
      "duration": "10:30",
      "views": "1.2M",
      "rating": "95%",
      "channel": "Channel Name",
      "channelUrl": "https://spankbang.com/profile/...",
      "isChannelBadge": true
    }
  ]
}`
  },
  {
    name: "SB Search",
    method: "GET",
    endpoint: "/api/adult/sb/search",
    provider: "Adult (SB)",
    description: "Search adult videos on SpankBang (18+ Only)",
    requiresAuth: true,
    parameters: [
      { name: "q", type: "string", required: true, description: "Search query" },
    ],
    tsExample: `const response = await fetch(\`\${baseUrl}/api/adult/sb/search?q=\${query}\`, {
  method: 'GET',
  headers: {
    'x-api-key': 'YOUR_API_KEY',
    'Content-Type': 'application/json'
  }
});

interface VideoInfo {
  id: string;
  title: string;
  url: string;
  thumbnail: string;
  duration: string;
  resolution: string;
  views: string;
  rating: string;
  channel: string;
  channelUrl: string;
  isChannelBadge: boolean;
}

interface SearchResponse {
  relatedKeywords: Array<{
    label: string;
    url: string;
  }>;
  alsoSearchedFor: Array<{
    label: string;
    url: string;
  }>;
  videos: VideoInfo[];
}

const data: SearchResponse = await response.json();
console.log(data);`,
    jsExample: `fetch(\`\${baseUrl}/api/adult/sb/search?q=\${query}\`, {
  method: 'GET',
  headers: {
    'x-api-key': 'YOUR_API_KEY',
    'Content-Type': 'application/json'
  }
})
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error('Error:', error));`,
    curlExample: `curl -X GET "https://screenscapeapi.dev/api/adult/sb/search?q=sample" \\
  -H "x-api-key: YOUR_API_KEY" \\
  -H "Content-Type: application/json"`,
    responseExample: `{
  "relatedKeywords": [
    {
      "label": "keyword1",
      "url": "https://spankbang.com/s/keyword1/"
    }
  ],
  "alsoSearchedFor": [
    {
      "label": "related search",
      "url": "https://spankbang.com/s/related+search/"
    }
  ],
  "videos": [
    {
      "id": "12345",
      "title": "Sample Video Title",
      "url": "https://spankbang.com/...",
      "thumbnail": "https://...",
      "duration": "10:30",
      "resolution": "1080p",
      "views": "1.2M",
      "rating": "95%",
      "channel": "Channel Name",
      "channelUrl": "https://spankbang.com/profile/...",
      "isChannelBadge": true
    }
  ]
}`
  },
  {
    name: "SB Stream",
    method: "GET",
    endpoint: "/api/adult/sb/stream",
    provider: "Adult (SB)",
    description: "Extract video stream data and download URLs from SpankBang video page (18+ Only)",
    requiresAuth: true,
    parameters: [
      { name: "url", type: "string", required: true, description: "Video page URL" },
    ],
    tsExample: `const response = await fetch(\`\${baseUrl}/api/adult/sb/stream?url=\${videoUrl}\`, {
  method: 'GET',
  headers: {
    'x-api-key': 'YOUR_API_KEY',
    'Content-Type': 'application/json'
  }
});

interface StreamData {
  ana_video_id: string | null;
  stream_data: {
    '240p': string[];
    '320p': string[];
    '480p': string[];
    '720p': string[];
    '1080p': string[];
    '4k': string[];
    'mpd': string[];
    'm3u8': string[];
    'm3u8_240p': string[];
    'm3u8_320p': string[];
    'm3u8_480p': string[];
    'm3u8_720p': string[];
    'm3u8_1080p': string[];
    'm3u8_4k': string[];
    'cover_image': string;
    'thumbnail': string;
    'stream_raw_id': number;
    'stream_sheet': string;
    'length': number;
    'main': string[];
  } | null;
  live_keywords: string | null;
  qualities: {
    '240p': string | null;
    '320p': string | null;
    '480p': string | null;
    '720p': string | null;
    '1080p': string | null;
    '4k': string | null;
  } | null;
  hls: {
    master: string | null;
    '240p': string | null;
    '320p': string | null;
    '480p': string | null;
    '720p': string | null;
    '1080p': string | null;
    '4k': string | null;
  } | null;
  mpd: string | null;
  cover_image: string | null;
  thumbnail: string | null;
  stream_raw_id: number | null;
  stream_sheet: string | null;
  length: number | null;
  main: string | null;
}

const data: StreamData = await response.json();
console.log(data);`,
    jsExample: `fetch(\`\${baseUrl}/api/adult/sb/stream?url=\${videoUrl}\`, {
  method: 'GET',
  headers: {
    'x-api-key': 'YOUR_API_KEY',
    'Content-Type': 'application/json'
  }
})
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error('Error:', error));`,
    curlExample: `curl -X GET "https://screenscapeapi.dev/api/adult/sb/stream?url=https://spankbang.com/..." \\
  -H "x-api-key: YOUR_API_KEY" \\
  -H "Content-Type: application/json"`,
    responseExample: `{
  "ana_video_id": "16974604",
  "stream_data": {
    "240p": ["https://vdownload-45.sb-cd.com/..."],
    "320p": [],
    "480p": ["https://vdownload-45.sb-cd.com/..."],
    "720p": ["https://vdownload-45.sb-cd.com/..."],
    "1080p": ["https://vdownload-45.sb-cd.com/..."],
    "4k": [],
    "mpd": [],
    "m3u8": ["https://hls-uranus.sb-cd.com/hls/..."],
    "m3u8_240p": ["https://hls-uranus.sb-cd.com/hls/..."],
    "m3u8_320p": [],
    "m3u8_480p": ["https://hls-uranus.sb-cd.com/hls/..."],
    "m3u8_720p": ["https://hls-uranus.sb-cd.com/hls/..."],
    "m3u8_1080p": ["https://hls-uranus.sb-cd.com/hls/..."],
    "m3u8_4k": [],
    "cover_image": "https://tbi.sb-cd.com/t/...",
    "thumbnail": "https://tbi.sb-cd.com/t/...",
    "stream_raw_id": 16974604,
    "stream_sheet": "https://tbv.sb-cd.com/t/...",
    "length": 1369,
    "main": ["https://vdownload-45.sb-cd.com/..."]
  },
  "live_keywords": "big tits,ebony,big ass,bbw,handjob,brunette,black",
  "qualities": {
    "240p": "https://vdownload-45.sb-cd.com/...",
    "320p": null,
    "480p": "https://vdownload-45.sb-cd.com/...",
    "720p": "https://vdownload-45.sb-cd.com/...",
    "1080p": "https://vdownload-45.sb-cd.com/...",
    "4k": null
  },
  "hls": {
    "master": "https://hls-uranus.sb-cd.com/hls/...",
    "240p": "https://hls-uranus.sb-cd.com/hls/...",
    "320p": null,
    "480p": "https://hls-uranus.sb-cd.com/hls/...",
    "720p": "https://hls-uranus.sb-cd.com/hls/...",
    "1080p": "https://hls-uranus.sb-cd.com/hls/...",
    "4k": null
  },
  "mpd": null,
  "cover_image": "https://tbi.sb-cd.com/t/...",
  "thumbnail": "https://tbi.sb-cd.com/t/...",
  "stream_raw_id": 16974604,
  "stream_sheet": "https://tbv.sb-cd.com/t/...",
  "length": 1369,
  "main": "https://vdownload-45.sb-cd.com/..."
}`
  },
];
