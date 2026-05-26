export function Footer() {
  return (
    <footer className="border-t border-ink-900/10 bg-sand-50 py-12">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-8 px-6 md:flex-row md:items-center">
        <div className="flex items-center gap-3">
          <img src="/logo-wordmark.svg" alt="Tôllé" className="h-9" />
          <div className="text-sm text-ink-500">
            Livraison rapide · Burkina Faso
          </div>
        </div>

        <nav className="flex flex-wrap gap-x-8 gap-y-3 text-sm font-medium text-ink-700">
          <a className="hover:text-terra-700" href="#how">
            Fonctionnement
          </a>
          <a className="hover:text-terra-700" href="#driver">
            Devenir livreur
          </a>
          <a className="hover:text-terra-700" href="mailto:contact@tolle.bf">
            Contact
          </a>
          <a className="hover:text-terra-700" href="/legal/cgu">
            CGU
          </a>
          <a className="hover:text-terra-700" href="/legal/privacy">
            Confidentialité
          </a>
        </nav>

        <div className="text-sm text-ink-500">
          © {new Date().getFullYear()} Tollé — Qality Labs
        </div>
      </div>
    </footer>
  );
}
