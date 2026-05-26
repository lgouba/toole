'use client';

import { motion } from 'framer-motion';
import { Zap, ShieldCheck, Wallet } from 'lucide-react';

const benefits = [
  {
    num: '01',
    icon: Zap,
    title: 'Express, vraiment.',
    desc: 'Une course acceptée en quelques secondes. Le colis chez vous en moins de 30 minutes.',
  },
  {
    num: '02',
    icon: ShieldCheck,
    title: 'Confiance, garantie.',
    desc: 'Tous les livreurs sont vérifiés : identité, permis, véhicule. Vous savez à qui vous confiez votre colis.',
  },
  {
    num: '03',
    icon: Wallet,
    title: 'Paiement, sans friction.',
    desc: 'Orange Money, Moov Money ou espèces. Le prix est affiché avant la course. Pas de surprise.',
  },
];

export function BenefitsStrip() {
  return (
    <section className="bg-paper-dim py-28 md:py-36">
      <div className="mx-auto max-w-7xl px-6">
        {/* Header éditorial */}
        <div className="grid gap-6 lg:grid-cols-[1fr_2fr] lg:items-end lg:gap-16">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.25em] text-terra-700">
              Pourquoi Tôllé
            </div>
          </div>
          <h2 className="font-display text-5xl leading-[1.05] tracking-tight text-ink-900 md:text-6xl lg:text-7xl">
            Trois engagements, <em className="text-terra-700">tenus</em>.
          </h2>
        </div>

        {/* 3 cards éditoriales */}
        <div className="mt-16 grid gap-px overflow-hidden rounded-3xl border border-ink-900/10 bg-ink-900/10 md:mt-24 md:grid-cols-3">
          {benefits.map((b, i) => {
            const Icon = b.icon;
            return (
              <motion.article
                key={b.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="group relative bg-paper p-8 md:p-10"
              >
                <div className="flex items-start justify-between">
                  <div className="font-display text-5xl text-ink-300 md:text-6xl">{b.num}</div>
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-ink-900 text-paper">
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
                <h3 className="mt-12 font-display text-3xl leading-tight tracking-tight text-ink-900 md:text-4xl">
                  {b.title}
                </h3>
                <p className="mt-4 text-base leading-relaxed text-ink-700">
                  {b.desc}
                </p>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
