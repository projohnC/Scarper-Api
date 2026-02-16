<div align="center">
  <h1>🎬 ScraperAPI</h1>
  <p><strong>A powerful, modern API service for scraping movie and anime content from multiple providers</strong></p>
  
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  [![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org/)
  [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/Anshu78780/ScarperApi/pulls)
  
  <a href="https://github.com/Anshu78780/ScarperApi/stargazers">
    <img src="https://img.shields.io/github/stars/Anshu78780/ScarperApi?style=social" alt="GitHub stars">
  </a>
  
  ---
  
  ### ⭐ If you find this project useful, please consider giving it a star! ⭐
  
  <a href="https://github.com/Anshu78780/ScarperApi/stargazers">
    <img src="https://reporoster.com/stars/dark/Anshu78780/ScarperApi" alt="Stargazers repo roster">
  </a>
</div>

## 📋 Table of Contents

- [Features](#-features)
- [Supported Providers](#-supported-providers)
- [Tech Stack](#-tech-stack)
- [Getting Started](#-getting-started)
- [API Documentation](#-api-documentation)
- [Authentication](#-authentication)
- [Environment Variables](#-environment-variables)
- [Deployment](#-deployment)
- [Contributing](#-contributing)
- [License](#-license)
- [Support](#-support)

## ✨ Features

- 🔐 **Secure API Key Authentication** - JWT-based authentication with request quota management
- 📊 **Multiple Content Providers** - Support for KMMovies, AnimeSalt, NetMirror, and more
- 🎯 **Comprehensive Endpoints** - Search, details, streaming links, and download options
- 🚀 **High Performance** - Built with Next.js 15 and modern optimizations
- 📱 **Modern Dashboard** - User-friendly interface for API key management and documentation
- 🔄 **Real-time Updates** - Dynamic content scraping with caching strategies
- 📖 **Interactive Documentation** - Built-in API playground with TypeScript examples
- 🎨 **Beautiful UI** - Shadcn/ui components with Tailwind CSS
- 💾 **PostgreSQL Database** - Powered by Neon serverless PostgreSQL with Drizzle ORM
- 📧 **Email Notifications** - Automated login alerts and quota warnings with beautiful HTML emails

## 🎯 Supported Providers

### Movies & TV Shows
- **KMMovies** - Latest Bollywood, Hollywood, and dubbed movies
  - Homepage listings with pagination
  - Advanced search functionality
  - Detailed movie information with IMDb ratings
  - Multiple quality download links (480p, 720p, 1080p, 4K)
  - Magic links resolver for direct downloads

- **NetMirror** - Streaming content with multiple servers
  - Homepage content with categories
  - Search functionality
  - Post details with metadata
  - Stream links with playlist URLs

### Anime
- **AnimeSalt** - Comprehensive anime database
  - Latest anime releases
  - Episode listings
  - Streaming and download links
  - Search with filters

## 🛠 Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS + Shadcn/ui
- **Authentication:** Better Auth
- **Database:** Neon PostgreSQL + Drizzle ORM
- **Web Scraping:** Cheerio + Axios
- **API Validation:** Custom middleware with quota management
- **Deployment:** Vercel

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn/pnpm/bun
- PostgreSQL database (Neon recommended)
- Git

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/Anshu78780/ScarperApi.git
cd ScarperApi
```

2. **Install dependencies**
```bash
npm install
# or
yarn install
# or
pnpm install
# or
bun install
```

3. **Set up environment variables**
```bash
cp .env.example .env.local
```

Edit `.env.local` with your configuration (see [Environment Variables](#-environment-variables))

4. **Run database migrations**
```bash
npm run db:push
```

5. **Start the development server**
```bash
npm run dev
```

6. **Open your browser**
Navigate to [http://localhost:3000](http://localhost:3000)

## 📚 API Documentation

Access the interactive API documentation at `/dashboard/docs` after logging in.

### Example Request

```typescript
const response = await fetch('https://screenscapeapi.dev/api/kmmovies/search?q=inception', {
  method: 'GET',
  headers: {
    'x-api-key': 'YOUR_API_KEY',
    'Content-Type': 'application/json'
  }
});

const data = await response.json();
console.log(data);
```

### Available Endpoints

#### KMMovies
- `GET /api/kmmovies` - Latest releases
- `GET /api/kmmovies/search?q={query}` - Search movies
- `GET /api/kmmovies/details?url={url}` - Movie details
- `GET /api/kmmovies/magiclinks?url={url}` - Download links

#### AnimeSalt
- `GET /api/animesalt` - Latest anime
- `GET /api/animesalt/search?q={query}` - Search anime
- `GET /api/animesalt/details?url={url}` - Anime details
- `GET /api/animesalt/stream?url={url}` - Streaming links

#### NetMirror
- `GET /api/netmirror` - Homepage content
- `GET /api/netmirror/search?q={query}` - Search content
- `GET /api/netmirror/getpost?id={id}` - Post details
- `GET /api/netmirror/stream?id={id}` - Stream URLs

#### HDHub4u
- `GET /api/hdhub4u` - Latest content listing
- `GET /api/hdhub4u/search?q={query}` - Search HDHub4u posts
- `GET /api/hdhub4u/details?url={url}` - Extract post metadata and available links
- `GET /api/hdhub4u/extractor?url={url}` - Resolve a provider page URL into a direct/usable stream or download link

### Build a search-and-play website (authorized content only)

If you have the legal rights to the content, you can build a website that:
- searches items,
- opens details,
- resolves a playable URL, and
- plays it in an HTML5 player.

> ⚠️ Important: only use this pattern for content you are licensed/authorized to distribute.

Recommended architecture:

1. **Frontend search UI** (title input + results list)
2. **Backend proxy route** (adds API key server-side, never expose your key in browser code)
3. **Details + resolver call** to get final media URL
4. **Playback layer**
   - MP4/WebM: native `<video>`
   - HLS (`.m3u8`): `hls.js`

Minimal Next.js API proxy example:

```ts
// app/api/player/search/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q");
  if (!q) return NextResponse.json({ error: "q is required" }, { status: 400 });

  const upstream = new URL(`${process.env.SCRAPER_API_BASE}/api/hdhub4u/search`);
  upstream.searchParams.set("q", q);

  const res = await fetch(upstream.toString(), {
    headers: { "x-api-key": process.env.SCRAPER_API_KEY || "" },
    cache: "no-store",
  });

  const body = await res.text();
  return new NextResponse(body, {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") || "application/json" },
  });
}
```

Minimal client page (search + click-to-play):

```tsx
"use client";

import { useState } from "react";

type Item = { title: string; url: string; imageUrl?: string };

export default function PlayerPage() {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [loading, setLoading] = useState(false);

  async function onSearch() {
    setLoading(true);
    try {
      const res = await fetch(`/api/player/search?q=${encodeURIComponent(q)}`);
      const json = await res.json();
      setItems(json?.data?.results || []);
    } finally {
      setLoading(false);
    }
  }

  async function onPlay(itemUrl: string) {
    // 1) fetch details
    const detailsRes = await fetch(`/api/player/details?url=${encodeURIComponent(itemUrl)}`);
    const details = await detailsRes.json();

    // 2) pick a candidate URL from details payload
    const candidate = details?.data?.downloadLinks?.[0]?.url;
    if (!candidate) return;

    // 3) resolve candidate into playable link
    const playRes = await fetch(`/api/player/extract?url=${encodeURIComponent(candidate)}`);
    const play = await playRes.json();

    const resolved = play?.data?.url || play?.url || "";
    setVideoUrl(resolved);
  }

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Search & Play</h1>

      <div className="flex gap-2">
        <input
          className="border rounded px-3 py-2 w-full"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search title"
        />
        <button className="border rounded px-4" onClick={onSearch} disabled={loading || !q}>
          {loading ? "Searching..." : "Search"}
        </button>
      </div>

      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.url} className="border rounded p-3 flex justify-between gap-3">
            <span>{item.title}</span>
            <button className="border rounded px-3" onClick={() => onPlay(item.url)}>
              Play
            </button>
          </li>
        ))}
      </ul>

      {videoUrl && (
        <video className="w-full rounded" controls src={videoUrl}>
          Your browser does not support video playback.
        </video>
      )}
    </main>
  );
}
```

Production checklist:
- Keep API keys server-side only.
- Validate/sanitize outbound URLs and allowlist trusted domains.
- Add retry/circuit-breaker logic for unstable upstream pages.
- Cache search/detail responses to reduce scraper load.
- Gracefully handle non-embeddable URLs and CORS failures.

## 🔐 Authentication

All API endpoints require authentication via API keys.

### Getting an API Key

1. Sign up at `/signup`
2. Log in at `/login`
3. Navigate to `/dashboard/apis`
4. Generate a new API key
5. Copy and use in your requests

### Authentication Methods

**Header (Recommended)**
```bash
curl -H "x-api-key: YOUR_API_KEY" https://screenscapeapi.dev/api/kmmovies
```

**Query Parameter**
```bash
curl "https://screenscapeapi.dev/api/kmmovies?api_key=YOUR_API_KEY"
```

**Session (Dashboard)**
Automatic when logged into the dashboard

## 🔧 Environment Variables

Create a `.env.local` file with the following variables:

```env
# Database
DATABASE_URL="postgresql://user:password@host/database"

# Better Auth
BETTER_AUTH_SECRET="your-secret-key-here"
BETTER_AUTH_URL="http://localhost:3000"

# Base URLs (optional - managed via providers.json)
# These are fetched from remote JSON for easy updates

# Admin detection (optional, comma-separated)
# Admin users get unlimited quota and can create multiple API keys
ADMIN_EMAILS="admin@example.com"
ADMIN_USERNAMES="adminUsername"
ADMIN_USER_IDS="user_id_1,user_id_2"

# Optional: Rate Limiting
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=900000

# Optional: Cookie Management
COOKIES_URL="https://your-cookies-endpoint.com/cookies.json"
```

## 🌐 Deployment

### Deploy on Vercel (Recommended)

1. Fork this repository
2. Import to Vercel
3. Add environment variables
4. Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Anshu78780/ScarperApi)

### Manual Deployment

```bash
npm run build
npm run start
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 💬 Support

- **Issues:** [GitHub Issues](https://github.com/Anshu78780/ScarperApi/issues)
- **Discussions:** [GitHub Discussions](https://github.com/Anshu78780/ScarperApi/discussions)
- **Email:** anshu78780@gmail.com

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org/)
- [Vercel](https://vercel.com/)
- [Neon](https://neon.tech/)
- [Shadcn/ui](https://ui.shadcn.com/)
- [Better Auth](https://better-auth.com/)

---

<div align="center">
  <p>Made with ❤️ by <a href="https://github.com/Anshu78780">Anshu</a></p>
  
  <p>
    <strong>⭐ Star this repo if you find it useful! ⭐</strong>
  </p>
  
  <a href="https://github.com/Anshu78780/ScarperApi/stargazers">
    <img src="https://img.shields.io/github/stars/Anshu78780/ScarperApi?style=for-the-badge" alt="Star this repo">
  </a>
</div>
