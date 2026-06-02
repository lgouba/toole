export function Footer() {
  return (
    <footer className="bg-ink-900 py-20 text-paper">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-12 md:grid-cols-[2fr_1fr_1fr] md:gap-20">
          {/* Statement éditorial */}
          <div>
            <div className="text-xs font-medium uppercase tracking-[0.25em] text-paper/40">
              Édition 01
            </div>
            <h3 className="mt-4 font-display text-4xl leading-[1.05] tracking-tight md:text-5xl">
              La livraison <em className="text-terra-300">simple</em>,<br />
              au rythme du Faso.
            </h3>
            <p className="mt-6 max-w-md text-base leading-relaxed text-paper/60">
              Toolé est une application développée à Ouagadougou pour les habitants de Ouagadougou.
              Inscription gratuite. Lancement juin 2026.
            </p>
          </div>

          {/* Liens */}
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-paper/40">
              Découvrir
            </div>
            <ul className="mt-4 space-y-2.5 text-sm text-paper/80">
              <li>
                <a href="#features" className="link-editorial">L'application</a>
              </li>
              <li>
                <a href="#how" className="link-editorial">Fonctionnement</a>
              </li>
              <li>
                <a href="#pricing" className="link-editorial">Tarifs</a>
              </li>
              <li>
                <a href="#driver" className="link-editorial">Devenir livreur</a>
              </li>
              <li>
                <a href="#faq" className="link-editorial">FAQ</a>
              </li>
            </ul>
          </div>

          <div>
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-paper/40">
              Contact
            </div>
            <ul className="mt-4 space-y-2.5 text-sm text-paper/80">
              <li>
                <a href="mailto:contact@tolle.bf" className="link-editorial">contact@tolle.bf</a>
              </li>
              <li>
                <a href="/legal/cgu" className="link-editorial">Conditions générales</a>
              </li>
              <li>
                <a href="/legal/privacy" className="link-editorial">Confidentialité</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-16 flex flex-col items-start justify-between gap-4 border-t border-paper/10 pt-8 text-xs text-paper/40 md:flex-row md:items-center">
          <div>© {new Date().getFullYear()} Toolé — Édité par QALITYLABS · Ouagadougou, Burkina Faso</div>
          <div className="uppercase tracking-[0.2em]">Made in Ouagadougou</div>
        </div>
      </div>
    </footer>
  );
}
