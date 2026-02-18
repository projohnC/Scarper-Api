export const EXTRACTORS_ENDPOINTS = [
  {
    name: "MDrive Full Extractor",
    method: "GET",
    endpoint: "/api/extractors/mdrive",
    provider: "Extractors",
    description: "Resolve MDrive page links through HubCloud and return direct media URLs",
    requiresAuth: true,
    parameters: [
      { name: "url", type: "string", required: true, description: "MDrive post URL" },
      { name: "limit", type: "number", required: false, description: "How many HubCloud links to resolve (default: 1, max: 10)" },
    ],
    tsExample: `const response = await fetch(\`\${baseUrl}/api/extractors/mdrive?url=\${encodeURIComponent(mdriveUrl)}&limit=1\`, {
  method: 'GET',
  headers: {
    'x-api-key': 'YOUR_API_KEY',
    'Content-Type': 'application/json'
  }
});

interface MDriveResolvedItem {
  label: string;
  size: string;
  hubCloudUrl: string;
  cryptonewzUrl: string | null;
  finalLinks: string[];
}

interface MDriveExtractorResponse {
  success: boolean;
  title: string;
  resolved: MDriveResolvedItem[];
}

const data: MDriveExtractorResponse = await response.json();
console.log(data);`,
    jsExample: `fetch(\`\${baseUrl}/api/extractors/mdrive?url=\${encodeURIComponent(mdriveUrl)}&limit=1\`, {
  method: 'GET',
  headers: {
    'x-api-key': 'YOUR_API_KEY',
    'Content-Type': 'application/json'
  }
})
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error('Error:', error));`,
    curlExample: `curl -X GET "https://screenscapeapi.dev/api/extractors/mdrive?url=https%3A%2F%2Fmdrive.lol%2Farchives%2F12345&limit=1" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json"`,
    responseExample: `{
  "success": true,
  "title": "Sample MDrive Post",
  "resolved": [
    {
      "label": "Ep1",
      "size": "350MB",
      "hubCloudUrl": "https://hubcloud.xxx/drive/code",
      "cryptonewzUrl": "https://cryptonewz.one/games/xxxx",
      "finalLinks": [
        "https://cdn.example.com/video.mp4"
      ]
    }
  ]
}`
  },
  {
    name: "HubCloud Extractor",
    method: "GET",
    endpoint: "/api/extractors/hubcloud",
    provider: "Extractors",
    description: "Open HubCloud, follow Generate Direct Link flow, collect server buttons, and capture final media URLs",
    requiresAuth: true,
    parameters: [
      { name: "url", type: "string", required: true, description: "HubCloud URL to extract" },
    ],
    tsExample: `const response = await fetch(\`\${baseUrl}/api/extractors/hubcloud?url=\${encodeURIComponent(hubcloudUrl)}\`, {
  method: 'GET',
  headers: {
    'x-api-key': 'YOUR_API_KEY',
    'Content-Type': 'application/json'
  }
});

interface HubCloudServer {
  name: string;
  url: string;
}

interface HubCloudResponse {
  success: boolean;
  hubcloudUrl: string;
  cryptonewzUrl: string | null;
  servers: HubCloudServer[];
  finalLinks: string[];
}

const data: HubCloudResponse = await response.json();
console.log(data);`,
    jsExample: `fetch(\`\${baseUrl}/api/extractors/hubcloud?url=\${encodeURIComponent(hubcloudUrl)}\`, {
  method: 'GET',
  headers: {
    'x-api-key': 'YOUR_API_KEY',
    'Content-Type': 'application/json'
  }
})
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error('Error:', error));`,
    curlExample: `curl -X GET "https://screenscapeapi.dev/api/extractors/hubcloud?url=https%3A%2F%2Fhubcloud.lol%2F..." \\
  -H "x-api-key: YOUR_API_KEY" \\
  -H "Content-Type: application/json"`,
    responseExample: `{
  "success": true,
  "hubcloudUrl": "https://hubcloud.foo/drive/1rlb8n1u1xabd2e",
  "cryptonewzUrl": "https://cryptonewz.one/games/xxxxx",
  "servers": [
    {
      "name": "fls server",
      "url": "https://cryptonewz.one/games/xxxxx?server=fls"
    },
    {
      "name": "server 10gbps",
      "url": "https://cryptonewz.one/games/xxxxx?server=10gbps"
    },
    {
      "name": "pixelverse",
      "url": "https://cryptonewz.one/games/xxxxx?server=pixelverse"
    }
  ],
  "finalLinks": [
    "https://cdn.example.com/video.mp4"
  ]
}`
  },
  {
    name: "GDFlix Extractor",
    method: "GET",
    endpoint: "/api/extractors/gdflix",
    provider: "Extractors",
    description: "Extract download/stream links from GDFlix URLs",
    requiresAuth: true,
    parameters: [
      { name: "url", type: "string", required: true, description: "GDFlix URL to extract" },
    ],
    tsExample: `const response = await fetch(\`\${baseUrl}/api/extractors/gdflix?url=\${encodeURIComponent(gdflixUrl)}\`, {
  method: 'GET',
  headers: {
    'x-api-key': 'YOUR_API_KEY',
    'Content-Type': 'application/json'
  }
});

interface Stream {
  server: string;
  link: string;
  type: string;
  quality?: string;
}

interface GDFlixResponse {
  success: boolean;
  streams: Stream[];
}

const data: GDFlixResponse = await response.json();
console.log(data);`,
    jsExample: `fetch(\`\${baseUrl}/api/extractors/gdflix?url=\${encodeURIComponent(gdflixUrl)}\`, {
  method: 'GET',
  headers: {
    'x-api-key': 'YOUR_API_KEY',
    'Content-Type': 'application/json'
  }
})
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error('Error:', error));`,
    curlExample: `curl -X GET "https://screenscapeapi.dev/api/extractors/gdflix?url=https%3A%2F%2Fgdflix.cfd%2F..." \\
  -H "x-api-key: YOUR_API_KEY" \\
  -H "Content-Type: application/json"`,
    responseExample: `{
  "success": true,
  "streams": [
    {
      "server": "GDFlix",
      "link": "https://gdflix.cfd/file/...",
      "type": "mkv",
      "quality": "1080p"
    }
  ]
}`
  },
];
