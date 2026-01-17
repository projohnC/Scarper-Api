export const EXTRACTORS_ENDPOINTS = [
  {
    name: "HubCloud Extractor",
    method: "GET",
    endpoint: "/api/extractors/hubcloud",
    provider: "Extractors",
    description: "Extract download/stream links from HubCloud URLs",
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

interface Stream {
  server: string;
  link: string;
  type: string;
}

interface HubCloudResponse {
  success: boolean;
  streams: Stream[];
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
  "streams": [
    {
      "server": "HubCloud",
      "link": "https://hubcloud.lol/drive/...",
      "type": "mkv"
    }
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
