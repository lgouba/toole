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
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
        scrolled
          ? 'bg-paper/85 backdrop-blur-xl border-b border-ink-900/8'
          : 'bg-transparent'
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <a href="#top" className="flex items-center gap-2.5">
          <img src="/logo-wordmark.svg" alt="Tôllé" className="h-8" />
        </a>

        <nav className="hidden gap-8 text-sm font-medium text-ink-700 lg:flex">
          <a className="link-editorial" href="#features">
            L'application
          </a>
          <a className="link-editorial" href="#how">
            Fonctionnement
          </a>
          <a className="link-editorial" href="#pricing">
            Tarifs
          </a>
          <a className="link-editorial" href="#driver">
            Livreurs
          </a>
          <a className="link-editorial" href="#faq">
            FAQ
          </a>
        </nav>

        <a
          href="#notify"
          className="group hidden items-center gap-2 rounded-full bg-ink-900 px-5 py-2.5 text-sm font-semibold text-paper transition hover:scale-[1.02] md:inline-flex"
        >
          Être notifié
          <span className="transition group-hover:translate-x-0.5">→</span>
        </a>
      </div>
    </header>
  );
}
