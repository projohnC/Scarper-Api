export const UHDMOVIES_ENDPOINTS = [
  {
    name: "UhdMovies Home",
    method: "GET",
    endpoint: "/api/uhdmovies",
    provider: "UhdMovies",
    description: "Get recent movies and TV shows from UhdMovies homepage",
    requiresAuth: true,
    parameters: [
      { name: "page", type: "string", required: false, description: "Page number (default: 1)" },
    ],
    tsExample: `const response = await fetch(\`\${baseUrl}/api/uhdmovies?page=1\`, {
  method: 'GET',
  headers: {
    'x-api-key': 'YOUR_API_KEY',
    'Content-Type': 'application/json'
  }
});

interface Movie {
  id: string;
  title: string;
  url: string;
  imageUrl: string;
}

interface UhdMoviesResponse {
  success: boolean;
  data: {
    movies: Movie[];
    page: number;
    totalItems: number;
  };
}

const data: UhdMoviesResponse = await response.json();
console.log(data);`,
    jsExample: `fetch(\`\${baseUrl}/api/uhdmovies?page=1\`, {
  method: 'GET',
  headers: {
    'x-api-key': 'YOUR_API_KEY',
    'Content-Type': 'application/json'
  }
})
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error('Error:', error));`,
    curlExample: `curl -X GET "https://screenscapeapi.dev/api/uhdmovies?page=1" \\
  -H "x-api-key: YOUR_API_KEY" \\
  -H "Content-Type: application/json"`,
    responseExample: `{
  "success": true,
  "data": {
    "movies": [
      {
        "id": "killer-whale-2026",
        "title": "Download Killer Whale (2026) {English Audio} 2160p || 4k || 1080p",
        "url": "https://uhdmovies.earth/download-killer-whale-2026/",
        "imageUrl": "https://uhdmovies.earth/wp-content/uploads/..."
      }
    ],
    "page": 1,
    "totalItems": 20
  }
}`
  },
  {
    name: "UhdMovies Search",
    method: "GET",
    endpoint: "/api/uhdmovies/search",
    provider: "UhdMovies",
    description: "Search movies and TV shows on UhdMovies",
    requiresAuth: true,
    parameters: [
      { name: "q", type: "string", required: true, description: "Search query" },
      { name: "page", type: "string", required: false, description: "Page number (default: 1)" },
    ],
    tsExample: `const response = await fetch(\`\${baseUrl}/api/uhdmovies/search?q=\${query}&page=1\`, {
  method: 'GET',
  headers: {
    'x-api-key': 'YOUR_API_KEY',
    'Content-Type': 'application/json'
  }
});

interface SearchResult {
  id: string;
  title: string;
  url: string;
  imageUrl: string;
}

interface SearchResponse {
  success: boolean;
  data: {
    searchResults: SearchResult[];
    query: string;
    page: number;
    totalItems: number;
  };
}

const data: SearchResponse = await response.json();
console.log(data);`,
    jsExample: `fetch(\`\${baseUrl}/api/uhdmovies/search?q=inception&page=1\`, {
  method: 'GET',
  headers: {
    'x-api-key': 'YOUR_API_KEY',
    'Content-Type': 'application/json'
  }
})
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error('Error:', error));`,
    curlExample: `curl -X GET "https://screenscapeapi.dev/api/uhdmovies/search?q=inception&page=1" \\
  -H "x-api-key: YOUR_API_KEY" \\
  -H "Content-Type: application/json"`,
    responseExample: `{
  "success": true,
  "data": {
    "searchResults": [
      {
        "id": "inception-2010",
        "title": "Download Inception (2010) 4K UHD",
        "url": "https://uhdmovies.earth/inception-2010/",
        "imageUrl": "https://uhdmovies.earth/wp-content/uploads/..."
      }
    ],
    "query": "inception",
    "page": 1,
    "totalItems": 5
  }
}`
  },
  {
    name: "UhdMovies Details",
    method: "GET",
    endpoint: "/api/uhdmovies/details",
    provider: "UhdMovies",
    description: "Get detailed information about a movie or TV show including download links",
    requiresAuth: true,
    parameters: [
      { name: "url", type: "string", required: true, description: "Full URL of the movie/show page" },
    ],
    tsExample: `const response = await fetch(\`\${baseUrl}/api/uhdmovies/details?url=\${encodeURIComponent(movieUrl)}\`, {
  method: 'GET',
  headers: {
    'x-api-key': 'YOUR_API_KEY',
    'Content-Type': 'application/json'
  }
});

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

interface DetailsResponse {
  success: boolean;
  data: MovieDetails;
}

const data: DetailsResponse = await response.json();
console.log(data);`,
    jsExample: `const movieUrl = 'https://uhdmovies.earth/download-killer-whale-2026/';

fetch(\`\${baseUrl}/api/uhdmovies/details?url=\${encodeURIComponent(movieUrl)}\`, {
  method: 'GET',
  headers: {
    'x-api-key': 'YOUR_API_KEY',
    'Content-Type': 'application/json'
  }
})
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error('Error:', error));`,
    curlExample: `curl -X GET "https://screenscapeapi.dev/api/uhdmovies/details?url=https%3A%2F%2Fuhdmovies.earth%2Fdownload-killer-whale-2026%2F" \\
  -H "x-api-key: YOUR_API_KEY" \\
  -H "Content-Type: application/json"`,
    responseExample: `{
  "success": true,
  "data": {
    "title": "Download Killer Whale (2026) {English Audio} 2160p || 4k || 1080p",
    "imageUrl": "https://image.tmdb.org/t/p/original/...",
    "posterImages": [
      "https://image.tmdb.org/t/p/original/..."
    ],
    "description": "Download Killer Whale (2026) WEB-DL...",
    "genres": ["Movies"],
    "releaseDate": "January 16, 2026",
    "views": "4,561 views",
    "youtubeTrailer": "https://youtube.com/embed/...",
    "downloadLinks": [
      {
        "quality": "4K/2160p",
        "url": "https://tech.unblockedgames.world/?sid=...",
        "type": "HEVC WEB-DL",
        "size": "9.56 GB",
        "fileName": "Killer.Whale.2026.2160p.AMZN.WEB-DL.DDP5.1.H.265-BYNDR"
      },
      {
        "quality": "1080p",
        "url": "https://tech.unblockedgames.world/?sid=...",
        "type": "x264 WEB-DL",
        "size": "5.39 GB",
        "fileName": "Killer.Whale.2026.1080p.AMZN.WEB-DL.DDP5.1.H.264-BYNDR"
      }
    ],
    "episodes": []
  }
}`
  },
  {
    name: "UhdMovies Tech Extractor",
    method: "GET",
    endpoint: "/api/uhdmovies/tech",
    provider: "UhdMovies",
    description: "Extract direct download links from tech.unblockedgames.world URLs with multiple server options",
    requiresAuth: true,
    parameters: [
      { name: "url", type: "string", required: true, description: "Full tech.unblockedgames.world URL with sid parameter" },
    ],
    tsExample: `const response = await fetch(\`\${baseUrl}/api/uhdmovies/tech?url=\${encodeURIComponent(techUrl)}\`, {
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

interface TechResponse {
  success: boolean;
  data: {
    servers: Stream[];
    totalServers: number;
  };
}

const data: TechResponse = await response.json();
console.log(data);`,
    jsExample: `const techUrl = 'https://tech.unblockedgames.world/?sid=...';

fetch(\`\${baseUrl}/api/uhdmovies/tech?url=\${encodeURIComponent(techUrl)}\`, {
  method: 'GET',
  headers: {
    'x-api-key': 'YOUR_API_KEY',
    'Content-Type': 'application/json'
  }
})
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error('Error:', error));`,
    curlExample: `curl -X GET "https://screenscapeapi.dev/api/uhdmovies/tech?url=https%3A%2F%2Ftech.unblockedgames.world%2F%3Fsid%3D..." \\
  -H "x-api-key: YOUR_API_KEY" \\
  -H "Content-Type: application/json"`,
    responseExample: `{
  "success": true,
  "data": {
    "servers": [
      {
        "server": "ResumeBot",
        "link": "https://resumebot.example.com/download/...",
        "type": "mkv"
      },
      {
        "server": "Cloud Download",
        "link": "https://cloud.example.com/...",
        "type": "mkv"
      },
      {
        "server": "Cf Worker 1.0",
        "link": "https://worker1.example.com/...",
        "type": "mkv"
      },
      {
        "server": "Cf Worker 2.0",
        "link": "https://worker2.example.com/...",
        "type": "mkv"
      },
      {
        "server": "Gdrive-Instant",
        "link": "https://drive.google.com/...",
        "type": "mkv"
      }
    ],
    "totalServers": 5
  }
}`
  },
];
