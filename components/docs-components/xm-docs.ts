export const XM_ENDPOINTS = [
  {
    name: "XM Home",
    method: "GET",
    endpoint: "/api/adult/xm",
    provider: "Adult (XM)",
    description: "Get latest adult videos from xHamster homepage (18+ Only)",
    requiresAuth: true,
    parameters: [],
    tsExample: `const response = await fetch(\`\${baseUrl}/api/adult/xm\`, {
  method: 'GET',
  headers: {
    'x-api-key': 'YOUR_API_KEY',
    'Content-Type': 'application/json'
  }
});

interface VideoInfo {
  id: number;
  title: string;
  duration: number;
  created: number;
  videoType: string;
  pageURL: string;
  thumbURL: string;
  imageURL: string;
  previewThumbURL: string;
  spriteURL: string;
  trailerURL: string;
  views: number;
  landing: {
    type: string;
    id: number;
    name: string;
    logo: string;
    link: string;
    subscribers: number | null;
  };
}

interface XMResponse {
  videos: VideoInfo[];
}

const data: XMResponse = await response.json();
console.log(data);`,
    jsExample: `fetch(\`\${baseUrl}/api/adult/xm\`, {
  method: 'GET',
  headers: {
    'x-api-key': 'YOUR_API_KEY',
    'Content-Type': 'application/json'
  }
})
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error('Error:', error));`,
    curlExample: `curl -X GET "https://screenscapeapi.dev/api/adult/xm" \\
  -H "x-api-key: YOUR_API_KEY" \\
  -H "Content-Type: application/json"`,
    responseExample: `{
  "videos": [
    {
      "id": 12345678,
      "title": "Sample Video Title",
      "duration": 600,
      "created": 1705449600,
      "videoType": "premium",
      "pageURL": "https://xhamster.com/videos/...",
      "thumbURL": "https://thumb-p6.xhcdn.com/...",
      "imageURL": "https://thumb-p6.xhcdn.com/...",
      "previewThumbURL": "https://thumb-p6.xhcdn.com/...",
      "spriteURL": "https://thumb-p6.xhcdn.com/...",
      "trailerURL": "https://thumb-p6.xhcdn.com/...",
      "views": 150000,
      "landing": {
        "type": "creator",
        "id": 123456,
        "name": "Creator Name",
        "logo": "https://thumb-p6.xhcdn.com/...",
        "link": "https://xhamster.com/creators/...",
        "subscribers": 50000
      }
    }
  ]
}`
  },
  {
    name: "XM Search",
    method: "GET",
    endpoint: "/api/adult/xm/search",
    provider: "Adult (XM)",
    description: "Search adult videos on xHamster (18+ Only)",
    requiresAuth: true,
    parameters: [
      { name: "q", type: "string", required: true, description: "Search query" },
      { name: "page", type: "string", required: false, description: "Page number (default: 1)" },
    ],
    tsExample: `const response = await fetch(\`\${baseUrl}/api/adult/xm/search?q=\${query}&page=1\`, {
  method: 'GET',
  headers: {
    'x-api-key': 'YOUR_API_KEY',
    'Content-Type': 'application/json'
  }
});

interface SearchVideo {
  id: number;
  title: string;
  duration: string;
  views: string;
  rating: string;
  thumbURL: string;
  pageURL: string;
  videoType: string;
  created: string;
  uploaderName: string;
  uploaderUrl: string;
  isVerified: boolean;
}

interface SearchResponse {
  success: boolean;
  query: string;
  page: number;
  totalResults: number;
  searchSuggestions: Array<{ label: string; url: string }>;
  pagination: {
    currentPage: number;
    nextPage: number | null;
    prevPage: number | null;
    totalPages: number | null;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
  videos: SearchVideo[];
}

const data: SearchResponse = await response.json();
console.log(data);`,
    jsExample: `fetch(\`\${baseUrl}/api/adult/xm/search?q=\${query}&page=1\`, {
  method: 'GET',
  headers: {
    'x-api-key': 'YOUR_API_KEY',
    'Content-Type': 'application/json'
  }
})
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error('Error:', error));`,
    curlExample: `curl -X GET "https://screenscapeapi.dev/api/adult/xm/search?q=search+term&page=1" \\
  -H "x-api-key: YOUR_API_KEY" \\
  -H "Content-Type: application/json"`,
    responseExample: `{
  "success": true,
  "query": "search term",
  "page": 1,
  "totalResults": 50000,
  "searchSuggestions": [
    {
      "label": "suggestion tag",
      "url": "https://xhamster.com/tags/..."
    }
  ],
  "pagination": {
    "currentPage": 1,
    "nextPage": 2,
    "prevPage": null,
    "totalPages": 100,
    "hasNextPage": true,
    "hasPrevPage": false
  },
  "videos": [
    {
      "id": 12345678,
      "title": "Video Title",
      "duration": "10:00",
      "views": "1.5M",
      "rating": "95%",
      "thumbURL": "https://thumb-p6.xhcdn.com/...",
      "pageURL": "https://xhamster.com/videos/...",
      "videoType": "premium",
      "created": "2024-01-15",
      "uploaderName": "Creator Name",
      "uploaderUrl": "https://xhamster.com/creators/...",
      "isVerified": true
    }
  ]
}`
  },
  {
    name: "XM Stream",
    method: "GET",
    endpoint: "/api/adult/xm/stream",
    provider: "Adult (XM)",
    description: "Get video streaming details and related videos from xHamster (18+ Only)",
    requiresAuth: true,
    parameters: [
      { name: "url", type: "string", required: true, description: "Full video URL" },
    ],
    tsExample: `const response = await fetch(\`\${baseUrl}/api/adult/xm/stream?url=\${videoUrl}\`, {
  method: 'GET',
  headers: {
    'x-api-key': 'YOUR_API_KEY',
    'Content-Type': 'application/json'
  }
});

interface StreamResponse {
  success: boolean;
  preloadLinks: {
    videoUrl: string | null;
    thumbnailUrl: string | null;
    promoImageUrl: string | null;
  };
  videoDetails: {
    id: string | number | null;
    title: string | null;
    duration: number | null;
    views: number | null;
    rating: number | null;
    created: string | null;
    categories: unknown[];
    tags: unknown[];
    uploader: {
      id: string | number | null;
      name: string | null;
      url: string | null;
      subscribers: number | null;
      isVerified: boolean;
    } | null;
  };
  relatedVideos: {
    maxPages: number;
    videoThumbProps: unknown[];
  } | null;
}

const data: StreamResponse = await response.json();
console.log(data);`,
    jsExample: `fetch(\`\${baseUrl}/api/adult/xm/stream?url=\${videoUrl}\`, {
  method: 'GET',
  headers: {
    'x-api-key': 'YOUR_API_KEY',
    'Content-Type': 'application/json'
  }
})
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error('Error:', error));`,
    curlExample: `curl -X GET "https://screenscapeapi.dev/api/adult/xm/stream?url=https://xhamster.com/videos/..." \\
  -H "x-api-key: YOUR_API_KEY" \\
  -H "Content-Type: application/json"`,
    responseExample: `{
  "success": true,
  "preloadLinks": {
    "videoUrl": "https://vcdn.xhcdn.com/.../playlist.m3u8",
    "thumbnailUrl": "https://thumb-p6.xhcdn.com/...",
    "promoImageUrl": "https://thumb-p6.xhcdn.com/..."
  },
  "videoDetails": {
    "id": "12345678",
    "title": "Video Title",
    "duration": 600,
    "views": 150000,
    "rating": 95,
    "created": "2024-01-15T10:30:00Z",
    "categories": ["category1", "category2"],
    "tags": ["tag1", "tag2"],
    "uploader": {
      "id": "123456",
      "name": "Creator Name",
      "url": "https://xhamster.com/creators/...",
      "subscribers": 50000,
      "isVerified": true
    }
  },
  "relatedVideos": {
    "maxPages": 5,
    "videoThumbProps": []
  }
}`
  },
];
