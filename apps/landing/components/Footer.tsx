export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-ink-900 py-10 text-white">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-6 md:flex-row md:items-center">
        <div className="text-sm text-white/60">
          Livraison rapide · Burkina Faso
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
          © {new Date().getFullYear()} Tôllé — QALITYLABS
        </div>
      </div>
    </footer>
  );
}
