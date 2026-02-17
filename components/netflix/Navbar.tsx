"use client";

import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { Search, Bell, User, X } from "lucide-react";
import { useRouter } from "next/navigation";

interface NavbarProps {
  initialSearchValue?: string;
}

const Navbar = ({ initialSearchValue = "" }: NavbarProps) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(!!initialSearchValue);
  const [searchValue, setSearchValue] = useState(initialSearchValue);
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 0) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 z-50 w-full px-4 py-4 transition-colors duration-300 lg:px-12 ${
        isScrolled ? "bg-zinc-950" : "bg-transparent bg-gradient-to-b from-black/70 to-transparent"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 lg:gap-10">
          <Link href="/browse">
            <span className="text-2xl font-bold text-red-600 lg:text-3xl">NETFLIX</span>
          </Link>
          <div className="hidden items-center gap-4 text-sm text-gray-200 lg:flex">
            <Link href="/browse" className="hover:text-gray-400">Home</Link>
            <Link href="#" className="hover:text-gray-400">TV Shows</Link>
            <Link href="#" className="hover:text-gray-400">Movies</Link>
            <Link href="#" className="hover:text-gray-400">New & Popular</Link>
            <Link href="#" className="hover:text-gray-400">My List</Link>
          </div>
        </div>

        <div className="flex items-center gap-4 text-white">
          <div className={`flex items-center gap-2 border border-white/40 bg-black/50 px-2 py-1 transition-all duration-300 ${isSearchOpen ? "w-40 lg:w-64" : "w-10 border-transparent bg-transparent"}`}>
            <button
              onClick={() => {
                setIsSearchOpen(!isSearchOpen);
                if (!isSearchOpen) setTimeout(() => searchInputRef.current?.focus(), 100);
              }}
              className="hover:text-gray-400"
            >
              <Search className="h-5 w-5" />
            </button>
            {isSearchOpen && (
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Titles, people, genres"
                className="w-full bg-transparent text-sm text-white placeholder:text-gray-400 focus:outline-none"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && searchValue.trim()) {
                    router.push(`/browse?s=${encodeURIComponent(searchValue.trim())}`);
                  }
                  if (e.key === "Escape") {
                    setIsSearchOpen(false);
                  }
                }}
              />
            )}
            {isSearchOpen && searchValue && (
              <button onClick={() => setSearchValue("")}>
                <X className="h-4 w-4 text-gray-400" />
              </button>
            )}
          </div>
          <button className="hover:text-gray-400">
            <Bell className="h-5 w-5" />
          </button>
          <div className="h-8 w-8 overflow-hidden rounded bg-zinc-800">
             <User className="h-full w-full p-1" />
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
