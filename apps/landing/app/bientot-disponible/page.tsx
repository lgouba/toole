import Link from 'next/link';
import { Bell, ArrowLeft } from 'lucide-react';

interface PageProps {
  searchParams?: Promise<{ platform?: string }>;
}

export default async function BientotDisponiblePage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const platform = params.platform === 'android' ? 'android' : params.platform === 'ios' ? 'ios' : null;
  const platformLabel =
    platform === 'ios' ? 'App Store' : platform === 'android' ? 'Google Play' : 'votre plateforme';

  return (
    <main className="relative min-h-screen overflow-hidden bg-ink-900 text-white">
      {/* Halo background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/4 top-1/3 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-kola-600 opacity-25 blur-[130px]" />
        <div className="absolute right-1/4 bottom-1/4 h-[400px] w-[400px] translate-x-1/2 translate-y-1/2 rounded-full bg-terra-700 opacity-15 blur-[120px]" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 py-16 text-center">
        {/* Logo */}
        <img src="/logo-wordmark.svg" alt="Tôllé" className="h-12 mb-12 opacity-90 invert brightness-200" />

        {/* Pill platform */}
        {platform && (
          <div className="inline-flex items-center gap-2 rounded-full border border-kola-400/30 bg-kola-700/20 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-kola-200">
            {platformLabel}
          </div>
        )}

        {/* Titre principal */}
        <h1 className="mt-8 font-display text-5xl font-extrabold leading-[1.05] tracking-tight md:text-7xl">
          <span className="block bg-gradient-to-br from-kola-200 via-kola-300 to-kola-500 bg-clip-text text-transparent">
            Bientôt
          </span>
          <span className="mt-2 block">disponible.</span>
        </h1>

        <p className="mx-auto mt-8 max-w-md text-base leading-relaxed text-white/70 md:text-lg">
          Tôllé arrive très prochainement sur <span className="font-semibold text-white">{platformLabel}</span>.
          Inscrivez-vous pour être prévenu dès la sortie de l'application.
        </p>

        {/* CTAs */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/#download"
            className="group inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-base font-bold text-ink-900 shadow-xl transition hover:scale-[1.02]"
          >
            <Bell className="h-4 w-4" />
            Être notifié au lancement
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-3.5 text-base font-medium text-white transition hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour à l'accueil
          </Link>
        </div>

        {/* Petit hint */}
        <div className="mt-16 text-[11px] uppercase tracking-[0.2em] text-white/30">
          Tôllé · Livraison rapide · Burkina Faso
        </div>
      </div>
    </main>
  );
}

export const metadata = {
  title: 'Bientôt disponible — Tôllé',
  description: 'L\'application Tôllé arrive bientôt sur App Store et Google Play.',
};
