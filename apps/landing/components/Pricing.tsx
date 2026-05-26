'use client';

import { motion } from 'framer-motion';
import { Package, Box, Archive } from 'lucide-react';

const tiers = [
  {
    icon: Package,
    name: 'Enveloppe',
    desc: 'Documents, lettres, petits objets',
    base: 500,
    perKm: 100,
    example: { km: 3, total: '800 FCFA' },
    accent: 'kola',
  },
  {
    icon: Box,
    name: 'Petit colis',
    desc: "Jusqu'à 5 kg, taille d'un sac à main",
    base: 700,
    perKm: 150,
    example: { km: 4, total: '1 300 FCFA' },
    accent: 'terra',
    highlight: true,
  },
  {
    icon: Archive,
    name: 'Gros colis',
    desc: 'Jusqu\'à 25 kg, carton standard',
    base: 1000,
    perKm: 250,
    example: { km: 5, total: '2 250 FCFA' },
    accent: 'kola',
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="bg-white py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-6">
        {/* Header */}
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-terra-100 px-3.5 py-1.5 text-xs font-bold uppercase tracking-widest text-terra-800">
            Tarifs
          </span>
          <h2 className="mt-5 text-4xl font-bold leading-[1.1] tracking-tight text-ink-900 md:text-5xl">
            Pas de surprise.{' '}
            <span className="bg-gradient-to-br from-kola-600 to-kola-800 bg-clip-text text-transparent">
              Pas de cachoteries.
            </span>
          </h2>
          <p className="mt-5 text-lg text-ink-700">
            Tarif calculé sur le type de colis et la distance. Affiché avant que vous validiez.
          </p>
        </div>

        {/* Tiers */}
        <div className="mt-16 grid gap-6 md:grid-cols-3 md:gap-8">
          {tiers.map((t, i) => {
            const Icon = t.icon;
            const isHighlight = t.highlight;
            return (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className={`relative rounded-3xl p-8 ${
                  isHighlight
                    ? 'bg-ink-900 text-white shadow-2xl'
                    : 'border border-ink-900/8 bg-sand-50 text-ink-900'
                }`}
              >
                {isHighlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-terra-600 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white">
                    Le plus utilisé
                  </div>
                )}

                <div
                  className={`grid h-12 w-12 place-items-center rounded-2xl ${
                    isHighlight
                      ? 'bg-terra-600/20 ring-1 ring-terra-500/40'
                      : 'bg-white shadow-md'
                  }`}
                >
                  <Icon
                    className={`h-5 w-5 ${
                      isHighlight ? 'text-terra-300' : 'text-kola-700'
                    }`}
                  />
                </div>

                <h3
                  className={`mt-6 text-xl font-bold tracking-tight ${
                    isHighlight ? 'text-white' : 'text-ink-900'
                  }`}
                >
                  {t.name}
                </h3>
                <p
                  className={`mt-1 text-sm ${
                    isHighlight ? 'text-white/60' : 'text-ink-500'
                  }`}
                >
                  {t.desc}
                </p>

                {/* Prix */}
                <div className="mt-8 space-y-3 text-sm">
                  <div className="flex items-baseline justify-between">
                    <span
                      className={
                        isHighlight ? 'text-white/60' : 'text-ink-500'
                      }
                    >
                      Frais de base
                    </span>
                    <span className="text-lg font-bold tabular-nums">
                      {t.base} FCFA
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span
                      className={
                        isHighlight ? 'text-white/60' : 'text-ink-500'
                      }
                    >
                      Par km
                    </span>
                    <span className="text-lg font-bold tabular-nums">
                      +{t.perKm} FCFA
                    </span>
                  </div>
                </div>

                {/* Exemple */}
                <div
                  className={`mt-8 rounded-2xl p-4 ${
                    isHighlight
                      ? 'bg-white/5 ring-1 ring-white/10'
                      : 'bg-white ring-1 ring-ink-900/5'
                  }`}
                >
                  <div
                    className={`text-[10px] font-bold uppercase tracking-widest ${
                      isHighlight ? 'text-white/50' : 'text-ink-500'
                    }`}
                  >
                    Exemple {t.example.km} km
                  </div>
                  <div
                    className={`mt-1 text-2xl font-bold tabular-nums ${
                      isHighlight ? 'text-white' : 'text-ink-900'
                    }`}
                  >
                    {t.example.total}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Footnote */}
        <div className="mx-auto mt-10 max-w-3xl text-center text-sm text-ink-500">
          Tarifs indicatifs. Majoration de 20% appliquée pour les courses entre 22h et 6h. Code promo sur certaines courses.
        </div>
      </div>
    </section>
  );
}
