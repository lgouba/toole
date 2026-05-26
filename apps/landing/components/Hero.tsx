'use client';

import { motion } from 'framer-motion';
import { Bell, MapPin, Clock, ShieldCheck } from 'lucide-react';
import { Countdown } from './Countdown';
import { DownloadQR } from './DownloadQR';
import { PhoneMockup } from './PhoneMockup';

// Date de lancement — paramétrable via env var NEXT_PUBLIC_LAUNCH_DATE
// Format ISO 8601 (ex: '2026-06-09T12:00:00Z')
// Defaut : ~2 semaines à partir du 26 mai 2026
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
    <section id="top" className="relative overflow-hidden bg-ink-900 pt-32 pb-24 md:pt-40 md:pb-32">
      {/* Halo gradient terra cotta + kola en fond */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 top-1/4 h-[500px] w-[500px] rounded-full bg-kola-600 opacity-20 blur-[120px]" />
        <div className="absolute -right-40 bottom-0 h-[600px] w-[600px] rounded-full bg-terra-700 opacity-15 blur-[120px]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      {/* Mesh subtil grid pattern (look "tech") */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
      />

      <div className="relative mx-auto max-w-6xl px-6">
        {/* HEADER : "Lancement Tôllé" en gros */}
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
            className="mt-8 font-display text-5xl font-extrabold leading-[1.05] tracking-tight text-white md:text-7xl lg:text-8xl"
          >
            <span className="block text-white/70">Lancement</span>
            <span className="mt-2 block bg-gradient-to-br from-kola-200 via-kola-300 to-kola-500 bg-clip-text text-transparent">
              Tôllé
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="mx-auto mt-8 max-w-2xl text-base leading-relaxed text-white/70 md:text-lg"
          >
            Rendez-vous le{' '}
            <span className="font-semibold text-white">{dayLabel}</span> à{' '}
            <span className="font-semibold text-white">Ouagadougou</span>.<br />
            La livraison express, au rythme du Faso.
          </motion.p>
        </div>

        {/* COUNTDOWN — element central */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.35 }}
          className="mx-auto mt-14 max-w-4xl"
        >
          <Countdown target={launchDate} />
        </motion.div>

        {/* CTAs + QR codes */}
        <motion.div
          id="download"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.5 }}
          className="mt-14"
        >
          <div className="text-center text-xs font-bold uppercase tracking-[0.2em] text-white/40">
            Scannez pour télécharger dès la sortie
          </div>
          <div className="mt-6">
            <DownloadQR />
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <a
              href="#notify"
              className="group inline-flex items-center gap-2.5 rounded-full bg-white px-7 py-3.5 text-base font-bold text-ink-900 shadow-2xl transition hover:scale-[1.02] hover:shadow-kola-500/20"
            >
              <Bell className="h-4 w-4" />
              Être notifié au lancement
            </a>
            <a
              href="#how"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-3.5 text-base font-medium text-white transition hover:bg-white/10"
            >
              En savoir plus
            </a>
          </div>
        </motion.div>

        {/* Trust badges */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.7 }}
          className="mt-16 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-xs uppercase tracking-widest text-white/40"
        >
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
        </motion.div>

        {/* Phone mockup en preview discret */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="relative mt-20 flex justify-center"
        >
          <div className="relative scale-90 origin-top md:scale-100">
            <PhoneMockup />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
