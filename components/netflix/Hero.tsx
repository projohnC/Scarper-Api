"use client";

import { Play, Info } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

interface HeroProps {
  movie?: {
    id: string;
    title: string;
    url?: string;
    imageUrl: string;
    description?: string;
  };
}

const Hero = ({ movie }: HeroProps) => {
  const router = useRouter();
  if (!movie) return null;

  return (
    <div className="relative h-[80vh] w-full">
      <div className="absolute inset-0">
        <Image
          src={movie.imageUrl}
          alt={movie.title}
          fill
          className="object-cover brightness-[0.4]"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-black/30" />
        <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/80 via-transparent to-transparent" />
      </div>

      <div className="absolute bottom-[25%] md:bottom-[15%] left-4 lg:left-12 max-w-xl">
        <h1 className="mb-2 md:mb-4 text-2xl font-bold text-white sm:text-4xl lg:text-6xl line-clamp-2">
          {movie.title}
        </h1>
        <p className="mb-4 md:mb-6 line-clamp-2 md:line-clamp-3 text-sm sm:text-lg text-gray-200 lg:text-xl">
          {movie.description || "Experience the latest cinematic masterpiece on our platform."}
        </p>
        <div className="flex gap-2 md:gap-3">
          <Button
            size="sm"
            className="bg-white px-5 py-2 text-black hover:bg-white/90 md:px-8 md:py-3 md:text-lg"
            onClick={() => router.push(`/watch?url=${encodeURIComponent(movie.url || movie.id)}`)}
          >
            <Play className="mr-2 h-6 w-6 fill-current" />
            Play
          </Button>
          <Button size="sm" variant="secondary" className="bg-zinc-500/50 px-5 py-2 text-white hover:bg-zinc-500/70 backdrop-blur-sm md:px-8 md:py-3 md:text-lg">
            <Info className="mr-2 h-4 w-4 md:h-6 md:w-6" />
            More Info
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Hero;
