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
