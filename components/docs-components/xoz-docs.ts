export const XOZ_ENDPOINTS = [
  {
    name: "Xozilla Home",
    method: "GET",
    endpoint: "/api/adult/xoz",
    provider: "Adult (Xozilla)",
    description: "Get latest adult videos from Xozilla homepage with multiple sections (18+ Only)",
    requiresAuth: true,
    parameters: [],
    tsExample: `const response = await fetch(\`\${baseUrl}/api/adult/xoz\`, {
  method: 'GET',
  headers: {
    'x-api-key': 'YOUR_API_KEY',
    'Content-Type': 'application/json'
  }
});

interface VideoItem {
  title: string;
  url: string;
  imageUrl: string;
  videoPreviewUrl?: string;
  duration?: string;
  hdLabel?: boolean;
}

interface XozillaResponse {
  videosWatchedRightNow: VideoItem[];
  sections: Array<{
    sectionName: string;
    videos: VideoItem[];
  }>;
}

const data: XozillaResponse = await response.json();
console.log(data);`,
    jsExample: `fetch(\`\${baseUrl}/api/adult/xoz\`, {
  method: 'GET',
  headers: {
    'x-api-key': 'YOUR_API_KEY',
    'Content-Type': 'application/json'
  }
})
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error('Error:', error));`,
    curlExample: `curl -X GET "https://your-domain.com/api/adult/xoz" \\
  -H "x-api-key: YOUR_API_KEY" \\
  -H "Content-Type: application/json"`,
    responseExample: `{
  "videosWatchedRightNow": [
    {
      "title": "Popular Video Title",
      "url": "/video/12345/video-slug/",
      "imageUrl": "https://static-ca-cdn.xozilla.xyz/...",
      "videoPreviewUrl": "https://static-ca-cdn.xozilla.xyz/...",
      "duration": "12:34",
      "hdLabel": true
    }
  ],
  "sections": [
    {
      "sectionName": "Most Recent Videos",
      "videos": [
        {
          "title": "Recent Video Title",
          "url": "/video/67890/video-slug/",
          "imageUrl": "https://static-ca-cdn.xozilla.xyz/...",
          "videoPreviewUrl": "https://static-ca-cdn.xozilla.xyz/...",
          "duration": "08:45",
          "hdLabel": false
        }
      ]
    },
    {
      "sectionName": "Top Rated Videos",
      "videos": []
    }
  ]
}`
  },
  {
    name: "Xozilla Search",
    method: "GET",
    endpoint: "/api/adult/xoz/search",
    provider: "Adult (Xozilla)",
    description: "Search adult videos on Xozilla (18+ Only)",
    requiresAuth: true,
    parameters: [
      { name: "q", type: "string", required: true, description: "Search query" },
    ],
    tsExample: `const response = await fetch(\`\${baseUrl}/api/adult/xoz/search?q=\${query}\`, {
  method: 'GET',
  headers: {
    'x-api-key': 'YOUR_API_KEY',
    'Content-Type': 'application/json'
  }
});

interface SearchVideo {
  title: string;
  url: string;
  imageUrl: string;
  videoPreviewUrl?: string;
  duration?: string;
  hdLabel?: boolean;
}

interface SearchResponse {
  success: boolean;
  query: string;
  searchUrl: string;
  videos: SearchVideo[];
}

const data: SearchResponse = await response.json();
console.log(data);`,
    jsExample: `fetch(\`\${baseUrl}/api/adult/xoz/search?q=\${query}\`, {
  method: 'GET',
  headers: {
    'x-api-key': 'YOUR_API_KEY',
    'Content-Type': 'application/json'
  }
})
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error('Error:', error));`,
    curlExample: `curl -X GET "https://your-domain.com/api/adult/xoz/search?q=search+term" \\
  -H "x-api-key: YOUR_API_KEY" \\
  -H "Content-Type: application/json"`,
    responseExample: `{
  "success": true,
  "query": "search term",
  "searchUrl": "https://xozilla.xyz/search/search+term/",
  "videos": [
    {
      "title": "Search Result Video",
      "url": "/video/12345/video-slug/",
      "imageUrl": "https://static-ca-cdn.xozilla.xyz/...",
      "videoPreviewUrl": "https://static-ca-cdn.xozilla.xyz/...",
      "duration": "15:30",
      "hdLabel": true
    }
  ]
}`
  },
  {
    name: "Xozilla Stream",
    method: "GET",
    endpoint: "/api/adult/xoz/stream",
    provider: "Adult (Xozilla)",
    description: "Get video streaming details from Xozilla (Note: Same as search endpoint) (18+ Only)",
    requiresAuth: true,
    parameters: [
      { name: "q", type: "string", required: true, description: "Video identifier or search query" },
    ],
    tsExample: `const response = await fetch(\`\${baseUrl}/api/adult/xoz/stream?q=\${videoId}\`, {
  method: 'GET',
  headers: {
    'x-api-key': 'YOUR_API_KEY',
    'Content-Type': 'application/json'
  }
});

interface StreamVideo {
  title: string;
  url: string;
  imageUrl: string;
  videoPreviewUrl?: string;
  duration?: string;
  hdLabel?: boolean;
}

interface StreamResponse {
  success: boolean;
  query: string;
  searchUrl: string;
  videos: StreamVideo[];
}

const data: StreamResponse = await response.json();
console.log(data);`,
    jsExample: `fetch(\`\${baseUrl}/api/adult/xoz/stream?q=\${videoId}\`, {
  method: 'GET',
  headers: {
    'x-api-key': 'YOUR_API_KEY',
    'Content-Type': 'application/json'
  }
})
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error('Error:', error));`,
    curlExample: `curl -X GET "https://your-domain.com/api/adult/xoz/stream?q=video-slug" \\
  -H "x-api-key: YOUR_API_KEY" \\
  -H "Content-Type: application/json"`,
    responseExample: `{
  "success": true,
  "query": "video-slug",
  "searchUrl": "https://xozilla.xyz/search/video-slug/",
  "videos": [
    {
      "title": "Video Title",
      "url": "/video/12345/video-slug/",
      "imageUrl": "https://static-ca-cdn.xozilla.xyz/...",
      "videoPreviewUrl": "https://static-ca-cdn.xozilla.xyz/...",
      "duration": "20:15",
      "hdLabel": true
    }
  ]
}`
  },
];
