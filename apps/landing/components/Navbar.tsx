'use client';

import { useEffect, useState } from 'react';

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-sand-50/85 backdrop-blur-lg border-b border-ink-900/5'
          : 'bg-transparent'
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <a href="#top" className="flex items-center gap-2.5">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-terra-700 text-white font-bold text-lg shadow-lg shadow-terra-700/30">
            T
          </div>
          <span className="text-xl font-semibold tracking-tight">Tollé</span>
        </a>

        <nav className="hidden gap-8 text-sm font-medium text-ink-700 md:flex">
          <a className="transition hover:text-terra-700" href="#how">
            Comment ça marche
          </a>
          <a className="transition hover:text-terra-700" href="#driver">
            Devenir livreur
          </a>
          <a className="transition hover:text-terra-700" href="#download">
            Télécharger
          </a>
        </nav>

        <a
          href="#download"
          className="group hidden items-center gap-2 rounded-full bg-ink-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-terra-700 md:inline-flex"
        >
          Télécharger l'app
          <span className="transition group-hover:translate-x-0.5">→</span>
        </a>
      </div>
    </header>
  );
}
