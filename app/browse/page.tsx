import { getLatestContent, searchContent } from "@/lib/hdhub4u";
import Navbar from "@/components/netflix/Navbar";
import Hero from "@/components/netflix/Hero";
import MovieRow from "@/components/netflix/MovieRow";
import MovieCard from "@/components/netflix/MovieCard";

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const params = await searchParams;
  const searchQuery = params.s;

  if (searchQuery) {
    const searchResults = await searchContent(searchQuery, "1");
    return (
      <main className="relative min-h-screen bg-zinc-950 pb-20">
        <Navbar initialSearchValue={searchQuery} />
        <div className="pt-24 px-4 lg:px-12">
          <h1 className="mb-8 text-2xl font-bold text-white lg:text-3xl">
            Search results for: <span className="text-gray-400">{searchQuery}</span>
          </h1>
          {searchResults.length > 0 ? (
            <div className="grid grid-cols-2 gap-y-8 gap-x-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {searchResults.map((movie) => (
                <MovieCard key={movie.id} movie={movie} />
              ))}
            </div>
          ) : (
            <div className="flex h-[50vh] flex-col items-center justify-center text-white">
              <p className="text-xl">No results found for &quot;{searchQuery}&quot;</p>
              <p className="mt-2 text-gray-400">Try different keywords.</p>
            </div>
          )}
        </div>
      </main>
    );
  }

  const [latestMovies, moreMovies, trendingMovies, popularMovies] = await Promise.all([
    getLatestContent("1"),
    getLatestContent("2"),
    getLatestContent("3"),
    getLatestContent("4"),
  ]);

  const featuredMovie = latestMovies[0] || {
    id: "1",
    title: "Featured Movie",
    imageUrl: "https://images.unsplash.com/photo-1626814026160-2237a95fc5a0?q=80&w=2070&auto=format&fit=crop",
    description: "Welcome to our Netflix-inspired movie platform. Enjoy the latest content from HdHub4u."
  };

  return (
    <main className="relative min-h-screen bg-zinc-950 pb-20">
      <Navbar />
      <Hero movie={featuredMovie} />

      <div className="relative z-10 -mt-32 pb-20 md:-mt-48 lg:-mt-64">
        <MovieRow title="Latest on HdHub4u" movies={latestMovies} />
        <MovieRow title="Trending Now" movies={trendingMovies} />
        <MovieRow title="Top Picks for You" movies={moreMovies} />
        <MovieRow title="New Releases" movies={popularMovies} />
        <MovieRow title="Action & Adventure" movies={latestMovies.slice().reverse()} />
      </div>
    </main>
  );
}
