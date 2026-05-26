'use client';

import { motion } from 'framer-motion';
import { ArrowRight, Bell } from 'lucide-react';
import { Countdown } from './Countdown';
import { PhoneMockup } from './PhoneMockup';

const DEFAULT_LAUNCH_DATE = '2026-06-09T12:00:00+00:00';

function getLaunchDate(): Date {
  const env = process.env.NEXT_PUBLIC_LAUNCH_DATE;
  return new Date(env && env.length > 0 ? env : DEFAULT_LAUNCH_DATE);
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
    <section id="top" className="relative overflow-hidden pt-36 pb-24 md:pt-44 md:pb-32">
      {/* Halos crème/terra organiques en arrière-plan */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 top-1/4 h-[600px] w-[600px] rounded-full bg-terra-200 opacity-40 blur-[140px]" />
        <div className="absolute -right-32 -top-20 h-[500px] w-[500px] rounded-full bg-gold/30 opacity-50 blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-6">
        <div className="grid items-start gap-12 lg:grid-cols-[1.4fr_1fr] lg:gap-20">
          {/* ─── COLONNE TEXTE (éditorial) ─── */}
          <div>
            {/* Eyebrow date */}
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="flex items-center gap-3"
            >
              <span className="h-px w-10 bg-ink-900/30" />
              <span className="text-xs font-medium uppercase tracking-[0.25em] text-ink-700">
                Lancement {dayLabel.split(' ').slice(1).join(' ')}
              </span>
            </motion.div>

            {/* Big serif title */}
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.05 }}
              className="mt-6 font-display text-6xl leading-[0.95] tracking-[-0.02em] text-ink-900 md:text-7xl lg:text-[9rem]"
            >
              La livraison
              <br />
              <span className="italic text-terra-700">qui change</span>
              <br />
              Ouaga.
            </motion.h1>

            {/* Sub */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="mt-10 max-w-xl text-lg leading-relaxed text-ink-700 md:text-xl md:leading-[1.6]"
            >
              <span className="font-display italic text-ink-900">Tôllé</span>{' '}
              connecte particuliers et livreurs vérifiés en moins de 30 minutes.
              Suivi temps réel, paiement Mobile Money, prix transparent.
            </motion.p>

            {/* Sub date + countdown line */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="mt-12"
            >
              <div className="text-[11px] font-bold uppercase tracking-[0.25em] text-ink-500">
                Disponible dans
              </div>
              <div className="mt-4">
                <Countdown target={launchDate} />
              </div>
            </motion.div>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.45 }}
              className="mt-12 flex flex-wrap items-center gap-4"
            >
              <a
                href="#notify"
                className="group inline-flex items-center gap-3 rounded-full bg-ink-900 px-7 py-4 text-base font-semibold text-paper shadow-2xl shadow-ink-900/20 transition hover:scale-[1.02]"
              >
                <Bell className="h-4 w-4" />
                Être notifié au lancement
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </a>
              <a
                href="#features"
                className="link-editorial inline-flex items-center gap-2 text-base font-medium text-ink-900"
              >
                Découvrir l'application
              </a>
            </motion.div>
          </div>

          {/* ─── COLONNE VISUEL (mockup) ─── */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.4 }}
            className="relative mx-auto mt-8 lg:mt-12"
          >
            {/* Décor floral subtil derrière le phone */}
            <div className="pointer-events-none absolute -inset-10">
              <div className="absolute right-0 top-0 h-72 w-72 rounded-full bg-kola-300 opacity-25 blur-3xl" />
              <div className="absolute left-0 bottom-0 h-64 w-64 rounded-full bg-terra-300 opacity-30 blur-3xl" />
            </div>

            {/* Numéro de page éditorial */}
            <div className="absolute -left-10 top-0 hidden text-xs font-medium uppercase tracking-[0.25em] text-ink-500 lg:block">
              <div className="rotate-180 [writing-mode:vertical-rl]">
                Édition Lancement · N°01
              </div>
            </div>

            <div className="relative animate-float-slow">
              <PhoneMockup />
            </div>
          </motion.div>
        </div>

        {/* Bandeau social proof : mini-stats éditoriales */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.6 }}
          className="mt-24 border-t border-ink-900/10 pt-10"
        >
          <div className="grid grid-cols-2 gap-x-8 gap-y-8 md:grid-cols-4">
            <Stat number="30" suffix="min" label="livraison moyenne" />
            <Stat number="500" suffix="FCFA" label="tarif de base" />
            <Stat number="100%" label="livreurs vérifiés" />
            <Stat number="7/7" label="support disponible" />
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function Stat({
  number,
  suffix,
  label,
}: {
  number: string;
  suffix?: string;
  label: string;
}) {
  return (
    <div>
      <div className="flex items-baseline gap-1.5">
        <span className="font-display text-5xl tracking-tight text-ink-900 md:text-6xl">
          {number}
        </span>
        {suffix && (
          <span className="text-xl font-medium text-ink-700 md:text-2xl">
            {suffix}
          </span>
        )}
      </div>
      <div className="mt-2 text-xs font-medium uppercase tracking-[0.18em] text-ink-500">
        {label}
      </div>
    </div>
  );
}
