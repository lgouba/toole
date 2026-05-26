'use client';

import { motion } from 'framer-motion';
import { Bell, MapPin, Clock, ShieldCheck } from 'lucide-react';
import { Countdown } from './Countdown';
import { DownloadQR } from './DownloadQR';
import { PhoneMockup } from './PhoneMockup';

// Date de lancement — paramétrable via env var NEXT_PUBLIC_LAUNCH_DATE
const DEFAULT_LAUNCH_DATE = '2026-06-09T12:00:00+00:00';

function getLaunchDate(): Date {
  const env = process.env.NEXT_PUBLIC_LAUNCH_DATE;
  const iso = env && env.length > 0 ? env : DEFAULT_LAUNCH_DATE;
  return new Date(iso);
}

function formatFrenchDate(d: Date): string {
  return d.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function Hero() {
  const launchDate = getLaunchDate();
  const dayLabel = formatFrenchDate(launchDate);

  return (
    <section id="top" className="relative overflow-hidden bg-ink-900 pt-28 pb-20 md:pt-36 md:pb-28">
      {/* Halo gradient terra cotta + kola en fond */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 top-1/4 h-[500px] w-[500px] rounded-full bg-kola-600 opacity-20 blur-[120px]" />
        <div className="absolute -right-40 bottom-0 h-[600px] w-[600px] rounded-full bg-terra-700 opacity-15 blur-[120px]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      {/* Grid subtil */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
      />

      <div className="relative mx-auto max-w-7xl px-6">
        {/* ======= LIGNE 1 : Badge + Titre + Tagline (pleine largeur centré) ======= */}
        <div className="text-center">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full border border-kola-400/30 bg-kola-700/20 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-kola-200"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-kola-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-kola-300" />
            </span>
            Disponible bientôt à Ouagadougou
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mt-6 font-display text-5xl font-extrabold leading-[1.05] tracking-tight text-white md:text-7xl"
          >
            <span className="block text-white/60">Lancement</span>
            <span className="mt-1 block bg-gradient-to-br from-kola-200 via-kola-300 to-kola-500 bg-clip-text text-transparent">
              Tôllé
            </span>
          </motion.h1>

          {/* Tagline qui dit clairement ce que c'est */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/80 md:text-xl"
          >
            L'application qui fait livrer vos colis en <span className="font-semibold text-white">moins de 30 minutes</span> à Ouagadougou.
          </motion.p>
        </div>

        {/* ======= LIGNE 2 : Grid 2 colonnes — countdown à gauche, mockup à droite ======= */}
        <div className="mt-14 grid items-center gap-10 lg:mt-20 lg:grid-cols-[1.2fr_1fr] lg:gap-16">
          {/* COL GAUCHE : Date + Countdown + CTAs + Trust */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-white/40 lg:text-sm">
              Rendez-vous le
            </div>
            <div className="mt-1.5 text-xl font-semibold text-white md:text-2xl">
              {dayLabel}
            </div>

            {/* Countdown */}
            <div className="mt-7">
              <Countdown target={launchDate} />
            </div>

            {/* QR codes */}
            <div id="download" className="mt-8">
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 lg:text-xs">
                Scannez pour télécharger dès la sortie
              </div>
              <div className="mt-4">
                <div className="flex flex-wrap items-center gap-3 lg:justify-start">
                  <DownloadQR />
                </div>
              </div>
            </div>

            {/* CTAs */}
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href="#notify"
                className="group inline-flex items-center gap-2.5 rounded-full bg-white px-6 py-3 text-base font-bold text-ink-900 shadow-xl transition hover:scale-[1.02]"
              >
                <Bell className="h-4 w-4" />
                Être notifié
              </a>
              <a
                href="#how"
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-3 text-base font-medium text-white transition hover:bg-white/10"
              >
                En savoir plus
              </a>
            </div>

            {/* Trust mini */}
            <div className="mt-10 flex flex-wrap gap-x-7 gap-y-3 text-xs uppercase tracking-widest text-white/40">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-kola-300" />
                <span>Sous 30 min</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-kola-300" />
                <span>Livreurs vérifiés</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-kola-300" />
                <span>Suivi temps réel</span>
              </div>
            </div>
          </motion.div>

          {/* COL DROITE : Phone Mockup */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="relative flex justify-center lg:justify-end"
          >
            <div className="relative scale-90 origin-top md:scale-100">
              <PhoneMockup />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
