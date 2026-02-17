"use client";

import Image from "next/image";
import { Play, Plus, ThumbsUp, ChevronDown } from "lucide-react";
import Link from "next/link";

interface MovieCardProps {
  movie: {
    id: string;
    title: string;
    imageUrl: string;
    url: string;
  };
}

const MovieCard = ({ movie }: MovieCardProps) => {
  const watchUrl = `/watch?url=${encodeURIComponent(movie.url)}`;

  return (
    <div className="group relative h-[40vw] min-w-[150px] cursor-pointer bg-zinc-900 md:h-[12vw] md:min-w-[240px]">
      <Link href={watchUrl}>
        <Image
          src={movie.imageUrl}
          alt={movie.title}
          fill
          className="rounded-sm object-cover transition duration-300 group-hover:opacity-90 sm:group-hover:opacity-0"
        />
      </Link>

      <div className="absolute inset-0 z-10 hidden scale-0 bg-zinc-900 opacity-0 transition duration-300 group-hover:scale-110 group-hover:opacity-100 sm:block rounded-md shadow-xl pointer-events-none group-hover:pointer-events-auto">
        <Link href={watchUrl}>
          <div className="relative h-[12vw]">
            <Image
              src={movie.imageUrl}
              alt={movie.title}
              fill
              className="rounded-t-md object-cover"
            />
          </div>
        </Link>
        <div className="p-2 lg:p-4">
          <div className="flex items-center gap-3">
            <Link href={watchUrl} className="flex h-6 w-6 items-center justify-center rounded-full bg-white transition hover:bg-neutral-300 lg:h-10 lg:w-10">
              <Play className="h-4 w-4 fill-current text-black lg:h-6 lg:w-6" />
            </Link>
            <button className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white transition hover:border-neutral-300 lg:h-10 lg:w-10">
              <Plus className="h-4 w-4 text-white lg:h-6 lg:w-6" />
            </button>
            <button className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white transition hover:border-neutral-300 lg:h-10 lg:w-10">
              <ThumbsUp className="h-4 w-4 text-white lg:h-6 lg:w-6" />
            </button>
            <button className="ml-auto flex h-6 w-6 items-center justify-center rounded-full border-2 border-white transition hover:border-neutral-300 lg:h-10 lg:w-10">
              <ChevronDown className="h-4 w-4 text-white lg:h-6 lg:w-6" />
            </button>
          </div>
          <div className="mt-4 text-[10px] font-semibold text-white lg:text-sm">
            {movie.title}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[8px] text-green-400 lg:text-xs">New</span>
            <span className="text-[8px] text-white lg:text-xs">2h 15m</span>
            <div className="rounded-sm border border-white/40 px-1 text-[8px] text-white lg:text-xs">HD</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MovieCard;
