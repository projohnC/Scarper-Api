import { Button } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";

async function getGitHubStars() {
  try {
    const response = await fetch(
      'https://api.github.com/repos/Anshu78780/ScarperApi',
      { next: { revalidate: 3600 } }
    );
    
    if (!response.ok) {
      return 0;
    }
    
    const data = await response.json();
    return data.stargazers_count || 0;
  } catch {
    return 0;
  }
}

export default async function Home() {
  const stars = await getGitHubStars();

  return (
    <div className="dark flex min-h-screen flex-col bg-zinc-950 text-white selection:bg-red-500/30">
      {/* Navigation */}
      <nav className="fixed top-0 z-50 w-full border-b border-zinc-800/50 bg-zinc-950/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <Image src="/logo.svg" alt="Logo" width={32} height={32} />
            <span className="text-xl font-bold tracking-tight">ScraperAPI</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="https://github.com/Anshu78780/ScarperApi" target="_blank" className="hidden sm:flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors">
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3-.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                {stars}
              </span>
              GitHub
            </Link>
            <Link href="/login">
              <Button variant="ghost" className="text-zinc-400 hover:text-white">Login</Button>
            </Link>
            <Link href="/signup">
              <Button className="bg-red-600 hover:bg-red-700">Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-grow pt-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl">
              Powerful <span className="text-red-600">Scraping API</span> <br />
              for Modern Developers
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-zinc-400 sm:text-xl">
              Access streaming links, download options, and movie details from multiple providers with a single, high-performance API.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link href="/signup">
                <Button size="lg" className="h-12 px-8 text-lg bg-red-600 hover:bg-red-700">Create Free Account</Button>
              </Link>
              <Link href="/dashboard/docs">
                <Button size="lg" variant="outline" className="h-12 px-8 text-lg border-zinc-800 bg-transparent text-white hover:bg-zinc-900">Read Documentation</Button>
              </Link>
            </div>
          </div>

          {/* Features Grid */}
          <div className="mt-32 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: "Multiple Providers",
                description: "Seamlessly fetch data from HDHub4u, KMMovies, AnimeSalt, and more.",
                icon: "🌐"
              },
              {
                title: "Real-time Resolution",
                description: "Advanced link resolution logic that handles complex redirects and obfuscation.",
                icon: "⚡"
              },
              {
                title: "Developer First",
                description: "Clean JSON responses, simple authentication, and comprehensive documentation.",
                icon: "🛠️"
              },
              {
                title: "Quota Management",
                description: "Track your usage and manage API keys through a powerful dashboard.",
                icon: "📊"
              },
              {
                title: "High Performance",
                description: "Built on Next.js 15 for maximum speed and global scalability.",
                icon: "🚀"
              },
              {
                title: "Dual Audio Support",
                description: "Filter and find content with specific audio tracks and qualities.",
                icon: "🎧"
              }
            ].map((feature, i) => (
              <div key={i} className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 hover:border-zinc-700 transition-colors">
                <div className="text-3xl mb-4">{feature.icon}</div>
                <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
                <p className="text-zinc-400">{feature.description}</p>
              </div>
            ))}
          </div>

          {/* CTA Section */}
          <div className="my-32 rounded-3xl bg-gradient-to-r from-red-900/20 to-zinc-900 p-12 text-center border border-red-500/10">
            <h2 className="text-3xl font-bold sm:text-4xl">Ready to start scraping?</h2>
            <p className="mt-4 text-zinc-400">Join other developers building the future of media applications.</p>
            <div className="mt-8">
              <Link href="/signup">
                <Button size="lg" className="bg-red-600 hover:bg-red-700">Get Your API Key Now</Button>
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-950 py-12">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Image src="/logo.svg" alt="Logo" width={24} height={24} />
            <span className="text-lg font-bold">ScraperAPI</span>
          </div>
          <p className="text-zinc-500 text-sm">
            © {new Date().getFullYear()} ScraperAPI. Built for developers by Anshu.
          </p>
        </div>
      </footer>
    </div>
  );
}
