'use client';

import { motion } from 'framer-motion';
import { MapPin, Clock, ShieldCheck } from 'lucide-react';
import { PhoneMockup } from './PhoneMockup';

export function Hero() {
  return (
    <section id="top" className="bg-mesh relative pt-32 pb-24 md:pt-40 md:pb-32">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 md:grid-cols-2 md:gap-16">
        {/* Texte */}
        <div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 rounded-full border border-terra-200 bg-terra-50/80 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-terra-800"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-terra-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-terra-600" />
            </span>
            Disponible à Ouagadougou
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="mt-6 text-5xl font-bold leading-[1.05] tracking-tight text-ink-900 md:text-6xl lg:text-7xl"
          >
            Vos colis livrés en{' '}
            <span className="relative inline-block">
              <span className="relative z-10 text-terra-700">moins de 30 min</span>
              <span className="absolute inset-x-0 bottom-1 -z-0 h-3 bg-sand-200/80" />
            </span>
            .
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mt-6 max-w-xl text-lg leading-relaxed text-ink-700 md:text-xl"
          >
            Tollé connecte particuliers et livreurs vérifiés. Suivi temps réel, paiement Mobile Money, livreurs notés. Simple, sûr, rapide.
          </motion.p>

          {/* CTA stores */}
          <motion.div
            id="download"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="mt-9 flex flex-wrap items-center gap-3"
          >
            <a
              href="https://apps.apple.com/app/id6771436858"
              target="_blank"
              rel="noreferrer"
              className="group flex items-center gap-3 rounded-2xl bg-ink-900 px-5 py-3.5 text-white shadow-xl shadow-ink-900/20 transition hover:bg-ink-900/90 hover:shadow-2xl"
            >
              <svg viewBox="0 0 384 512" className="h-7 w-7 fill-current" aria-hidden>
                <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
              </svg>
              <div className="text-left leading-tight">
                <div className="text-[10px] font-medium uppercase tracking-widest opacity-70">
                  Télécharger sur
                </div>
                <div className="text-lg font-semibold">App Store</div>
              </div>
            </a>

            <a
              href="#"
              className="group flex items-center gap-3 rounded-2xl bg-ink-900 px-5 py-3.5 text-white shadow-xl shadow-ink-900/20 transition hover:bg-ink-900/90 hover:shadow-2xl"
            >
              <svg viewBox="0 0 512 512" className="h-7 w-7" aria-hidden>
                <path
                  fill="#34D399"
                  d="m325.3 234.3-180.8 105 99.6-99.6 81.2-5.4z"
                />
                <path
                  fill="#FBBF24"
                  d="m393.4 277.6-58-33.7-44.4 44.4 50.4 50.4 51.9-30.2c16.8-9.8 16.8-21.2.1-30.9z"
                />
                <path
                  fill="#EF4444"
                  d="m144.5 86.7 180.8 105.1-81.3-5.4-99.5-99.7z"
                />
                <path
                  fill="#3B82F6"
                  d="M144.5 86.7 244 186.4 144.5 425.3c-3.8-2.2-6.4-6.5-6.4-12.3V99c0-5.8 2.6-10.1 6.4-12.3z"
                />
              </svg>
              <div className="text-left leading-tight">
                <div className="text-[10px] font-medium uppercase tracking-widest opacity-70">
                  Disponible sur
                </div>
                <div className="text-lg font-semibold">Google Play</div>
              </div>
            </a>
          </motion.div>

          {/* Trust badges */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-10 flex flex-wrap items-center gap-6 text-sm text-ink-700"
          >
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-terra-700" />
              <span className="font-medium">Livraison sous 30 min</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-kola-700" />
              <span className="font-medium">Livreurs vérifiés</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-terra-700" />
              <span className="font-medium">Suivi temps réel</span>
            </div>
          </motion.div>
        </div>

        {/* Phone mockup */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="relative flex justify-center md:justify-end"
        >
          <div className="phone-halo relative animate-float-slow">
            <PhoneMockup />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
