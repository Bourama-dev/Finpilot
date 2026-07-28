"use client";

import { useState } from "react";
import Link from "next/link";
import { CircleUserRound, Menu, X } from "lucide-react";

const AVATAR_URLS = [
  "https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=100",
  "https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=100",
  "https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=100",
  "https://images.pexels.com/photos/697509/pexels-photo-697509.jpeg?auto=compress&cs=tinysrgb&w=100",
];

const NAV_LINKS = [
  { label: "Accueil", href: "/" },
  { label: "Notre Approche", href: "/#approche" },
  { label: "Nos Solutions", href: "/#solutions" },
];

function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 256 256" fill="white" className={className}>
      <path d="M 128 128 C 198.692 128 256 185.308 256 256 L 151.883 256 C 149.812 220.307 120.213 192 84 192 C 47.787 192 18.188 220.307 16.117 256 L 0 256 C 0 185.308 57.308 128 128 128 Z M 104.117 0 C 106.188 35.694 135.787 64 172 64 C 208.213 64 237.812 35.694 239.883 0 L 256 0 C 256 70.692 198.692 128 128 128 C 57.308 128 0 70.692 0 0 Z" />
    </svg>
  );
}

function DotTriangleIcon() {
  const positions = [
    { top: 0, left: 8 },
    { top: 6, left: 4 },
    { top: 6, left: 12 },
    { top: 12, left: 0 },
    { top: 12, left: 8 },
    { top: 12, left: 16 },
    { top: 18, left: 0 },
    { top: 18, left: 8 },
    { top: 18, left: 16 },
  ];
  return (
    <div className="relative h-5 w-5">
      {positions.map((pos, i) => (
        <span
          key={i}
          className="absolute h-[2.5px] w-[2.5px] bg-white/60"
          style={{ top: pos.top, left: pos.left }}
        />
      ))}
    </div>
  );
}

function CheckerGridIcon() {
  return (
    <div className="grid h-5 w-5 grid-cols-3 gap-[2px]">
      {Array.from({ length: 9 }).map((_, i) => (
        <span
          key={i}
          className={`h-1 w-1 rounded-[2px] ${i % 2 === 0 ? "bg-white/60" : "bg-white/0"}`}
        />
      ))}
    </div>
  );
}

export default function HomePage() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <main className="relative h-screen w-full overflow-hidden bg-black">
      <video
        className="absolute inset-0 h-full w-full object-cover"
        src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260715_082433_69699cf8-444b-4484-93cc-053e57896dfd.mp4"
        autoPlay
        loop
        muted
        playsInline
      />

      {/* Navigation */}
      <nav className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-5 pt-6 sm:px-8 sm:pt-8 md:px-16 md:pt-8 lg:px-20">
        <Link href="/">
          <Logo className="h-8 w-8 md:h-9 md:w-9" />
        </Link>

        <div className="liquid-glass hidden items-center gap-8 rounded-full px-8 py-3 md:flex">
          {NAV_LINKS.map((link, i) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm font-medium transition-opacity ${
                i === 0 ? "text-white" : "text-white/70 hover:opacity-100"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <Link
          href="/auth/login"
          className="liquid-glass hidden h-10 w-10 items-center justify-center rounded-full md:flex"
        >
          <CircleUserRound className="h-5 w-5 text-white/80" strokeWidth={1.5} />
        </Link>

        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="liquid-glass relative z-50 flex h-10 w-10 items-center justify-center rounded-full md:hidden"
        >
          <Menu
            className={`absolute h-5 w-5 text-white/80 transition-all duration-300 ${
              menuOpen ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100"
            }`}
            strokeWidth={1.5}
          />
          <X
            className={`absolute h-5 w-5 text-white/80 transition-all duration-300 ${
              menuOpen ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0"
            }`}
            strokeWidth={1.5}
          />
        </button>
      </nav>

      {/* Mobile menu overlay */}
      <div
        className={`fixed inset-0 z-10 bg-black/80 backdrop-blur-xl transition-opacity duration-500 ease-out md:hidden ${
          menuOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div
          className={`flex h-full flex-col items-center justify-center gap-8 transition-transform duration-500 ease-out ${
            menuOpen ? "translate-y-0" : "-translate-y-8"
          }`}
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="text-2xl font-medium text-white"
            >
              {link.label}
            </Link>
          ))}

          <div className="mt-4 flex flex-col items-center gap-3">
            <Link
              href="/auth/login"
              onClick={() => setMenuOpen(false)}
              className="liquid-glass flex h-10 w-10 items-center justify-center rounded-full"
            >
              <CircleUserRound className="h-5 w-5 text-white/80" strokeWidth={1.5} />
            </Link>
            <span className="text-sm font-light text-white/60">Compte</span>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div
        className={`relative z-10 flex h-full flex-col justify-between px-5 pb-8 sm:px-8 sm:pb-10 md:px-16 md:pb-14 lg:px-20 transition-opacity duration-300 ${
          menuOpen ? "pointer-events-none opacity-0 md:pointer-events-auto md:opacity-100" : "opacity-100"
        }`}
      >
        <div className="mt-14 max-w-2xl sm:mt-20 md:mt-28">
          <div className="liquid-glass mb-5 inline-flex items-center gap-2.5 rounded-full px-3 py-1.5 sm:mb-6 sm:gap-3 sm:px-4 sm:py-2">
            <div className="flex -space-x-2">
              {AVATAR_URLS.map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={src}
                  alt=""
                  className="h-5 w-5 rounded-full border-2 border-white/20 object-cover sm:h-6 sm:w-6"
                />
              ))}
            </div>
            <span className="text-xs font-light text-white/80 sm:text-sm">
              notre approche du pilotage financier
            </span>
          </div>

          <h1
            className="inline text-4xl font-normal leading-[1.05] text-white sm:text-5xl md:text-6xl lg:text-7xl"
            style={{ letterSpacing: "-0.05em" }}
          >
            Pilotez Vos Finances
            <br />
            En Toute Clarté
          </h1>

          <p className="mt-4 text-sm font-light text-white/70 sm:mt-5 sm:text-base md:text-lg">
            Suivi intelligent. Décisions éclairées.
          </p>

          <Link
            href="/auth/register"
            className="liquid-glass mt-6 inline-block rounded-full px-6 py-3 text-sm font-medium text-white transition duration-300 hover:bg-white/10 sm:mt-8 sm:px-7 sm:py-3.5"
          >
            Commencez Votre Parcours
          </Link>
        </div>

        <div className="flex items-end gap-6 sm:gap-10 md:gap-16">
          <div>
            <DotTriangleIcon />
            <p className="mt-2 text-xl font-normal text-white sm:text-2xl md:text-3xl">48h</p>
            <p className="text-xs font-light text-white/60 sm:text-sm">Mise en route initiale</p>
          </div>
          <div>
            <CheckerGridIcon />
            <p className="mt-2 text-xl font-normal text-white sm:text-2xl md:text-3xl">24/7</p>
            <p className="text-xs font-light text-white/60 sm:text-sm">Suivi Financier</p>
          </div>
        </div>
      </div>
    </main>
  );
}
