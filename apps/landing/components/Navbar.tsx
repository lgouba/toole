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
          ? 'bg-ink-900/90 backdrop-blur-xl border-b border-white/10'
          : 'bg-ink-900'
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <a href="#top" className="flex items-center gap-2.5">
          {/* Wordmark Tôllé sur fond navy : accents en blanc */}
          <img src="/logo-wordmark-dark.svg" alt="Tôllé" className="h-9" />
        </a>

        <nav className="hidden gap-8 text-sm font-medium text-white/70 md:flex">
          <a className="transition hover:text-white" href="#how">
            Comment ça marche
          </a>
          <a className="transition hover:text-white" href="#driver">
            Devenir livreur
          </a>
          <a className="transition hover:text-white" href="#download">
            Télécharger
          </a>
        </nav>

        <a
          href="#download"
          className="group hidden items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-ink-900 transition hover:scale-[1.02] md:inline-flex"
        >
          Être notifié
          <span className="transition group-hover:translate-x-0.5">→</span>
        </a>
      </div>
    </header>
  );
}
