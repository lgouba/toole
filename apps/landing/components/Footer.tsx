export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-ink-900 py-14 text-white">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-8 px-6 md:flex-row md:items-center">
        <div className="flex items-center gap-3">
          <img src="/logo-wordmark-dark.svg" alt="Tôllé" className="h-9" />
          <div className="text-sm text-white/50">
            Livraison rapide · Burkina Faso
          </div>
        </div>

        <nav className="flex flex-wrap gap-x-8 gap-y-3 text-sm font-medium text-white/70">
          <a className="transition hover:text-white" href="#how">
            Fonctionnement
          </a>
          <a className="transition hover:text-white" href="#driver">
            Devenir livreur
          </a>
          <a className="transition hover:text-white" href="mailto:contact@tolle.bf">
            Contact
          </a>
          <a className="transition hover:text-white" href="/legal/cgu">
            CGU
          </a>
          <a className="transition hover:text-white" href="/legal/privacy">
            Confidentialité
          </a>
        </nav>

        <div className="text-sm text-white/40">
          © {new Date().getFullYear()} Tôllé — Qality Labs
        </div>
      </div>
    </footer>
  );
}
