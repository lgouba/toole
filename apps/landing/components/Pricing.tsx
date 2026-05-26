'use client';

import { motion } from 'framer-motion';

const tiers = [
  {
    name: 'Enveloppe',
    desc: 'Documents, lettres, petits objets.',
    base: 500,
    perKm: 100,
    example: { km: 3, total: '800 FCFA' },
  },
  {
    name: 'Petit colis',
    desc: "Jusqu'à 5 kg. La majorité des courses.",
    base: 700,
    perKm: 150,
    example: { km: 4, total: '1 300 FCFA' },
    highlight: true,
  },
  {
    name: 'Gros colis',
    desc: 'Jusqu\'à 25 kg, carton standard.',
    base: 1000,
    perKm: 250,
    example: { km: 5, total: '2 250 FCFA' },
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="bg-paper py-28 md:py-40">
      <div className="mx-auto max-w-7xl px-6">
        {/* Header */}
        <div className="grid gap-8 lg:grid-cols-[1fr_2fr] lg:gap-16 lg:items-end">
          <div>
            <div className="text-xs font-medium uppercase tracking-[0.25em] text-terra-700">
              Tarifs
            </div>
            <p className="mt-6 max-w-sm text-base leading-relaxed text-ink-700">
              Prix calculés sur le type de colis et la distance. Affichés avant que vous validiez. Aucune surcharge cachée.
            </p>
          </div>
          <h2 className="font-display text-5xl leading-[1.0] tracking-tight text-ink-900 md:text-7xl">
            Pas de surprise.<br />
            <em className="text-terra-700">Pas de cachoteries.</em>
          </h2>
        </div>

        {/* Tiers */}
        <div className="mt-20 grid gap-px overflow-hidden rounded-3xl border border-ink-900/10 bg-ink-900/10 md:mt-28 md:grid-cols-3">
          {tiers.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className={`relative p-8 md:p-10 ${
                t.highlight ? 'bg-ink-900 text-paper' : 'bg-paper text-ink-900'
              }`}
            >
              {t.highlight && (
                <div className="absolute top-6 right-6 inline-flex items-center gap-1.5 rounded-full bg-terra-600/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-terra-300 ring-1 ring-terra-500/40">
                  <span className="h-1.5 w-1.5 rounded-full bg-terra-400" />
                  Standard
                </div>
              )}

              <div
                className={`font-display text-2xl italic ${
                  t.highlight ? 'text-paper/40' : 'text-ink-300'
                }`}
              >
                Tarif {String.fromCharCode(65 + i)}
              </div>
              <h3 className="mt-2 font-display text-4xl leading-tight tracking-tight md:text-5xl">
                {t.name}
              </h3>
              <p
                className={`mt-3 text-sm ${
                  t.highlight ? 'text-paper/60' : 'text-ink-500'
                }`}
              >
                {t.desc}
              </p>

              {/* Détail */}
              <div
                className={`mt-10 space-y-4 border-t pt-6 ${
                  t.highlight ? 'border-paper/15' : 'border-ink-900/10'
                }`}
              >
                <Row
                  label="Frais de base"
                  value={`${t.base} FCFA`}
                  dim={t.highlight ? 'text-paper/60' : 'text-ink-500'}
                />
                <Row
                  label="Par km"
                  value={`+${t.perKm} FCFA`}
                  dim={t.highlight ? 'text-paper/60' : 'text-ink-500'}
                />
              </div>

              <div
                className={`mt-8 rounded-2xl p-5 ${
                  t.highlight ? 'bg-paper/5' : 'bg-paper-dim'
                }`}
              >
                <div
                  className={`text-[10px] font-bold uppercase tracking-[0.2em] ${
                    t.highlight ? 'text-paper/50' : 'text-ink-500'
                  }`}
                >
                  Course de {t.example.km} km
                </div>
                <div className="mt-2 font-display text-4xl tracking-tight">
                  {t.example.total}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mx-auto mt-12 max-w-3xl text-center text-sm leading-relaxed text-ink-500">
          Tarifs indicatifs susceptibles d'évolution.
          Majoration de 20% appliquée pour les courses entre 22h et 6h.
        </div>
      </div>
    </section>
  );
}

function Row({
  label,
  value,
  dim,
}: {
  label: string;
  value: string;
  dim: string;
}) {
  return (
    <div className="flex items-baseline justify-between">
      <span className={`text-sm ${dim}`}>{label}</span>
      <span className="font-display text-2xl tabular-nums tracking-tight">
        {value}
      </span>
    </div>
  );
}
