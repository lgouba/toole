'use client';

import { motion } from 'framer-motion';

const clientSteps = [
  {
    n: '01',
    title: 'Créez votre demande',
    desc: 'Adresses, type de colis, prix calculé en temps réel.',
  },
  {
    n: '02',
    title: 'Suivez votre livreur',
    desc: 'Position GPS en direct, contact direct par téléphone.',
  },
  {
    n: '03',
    title: 'Récupérez le colis',
    desc: 'Validation par code, paiement Mobile Money ou cash.',
  },
];

const driverSteps = [
  {
    n: '01',
    title: 'Inscrivez-vous',
    desc: 'CNIB et permis. Validation sous 24h.',
  },
  {
    n: '02',
    title: 'Passez en ligne',
    desc: 'Recevez les courses dans votre zone.',
  },
  {
    n: '03',
    title: 'Gagnez et progressez',
    desc: 'Paiement immédiat. La note ouvre des opportunités.',
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="bg-paper-dim py-28 md:py-40">
      <div className="mx-auto max-w-7xl px-6">
        {/* Header */}
        <div className="text-center">
          <div className="text-xs font-medium uppercase tracking-[0.25em] text-terra-700">
            Mode d'emploi
          </div>
          <h2 className="mt-6 font-display text-6xl leading-[0.95] tracking-tight text-ink-900 md:text-7xl lg:text-8xl">
            Trois étapes.
            <br />
            <em className="text-terra-700">De chaque côté.</em>
          </h2>
        </div>

        <div className="mt-20 grid gap-12 lg:grid-cols-2 lg:gap-20">
          <Column role="Pour les clients" steps={clientSteps} />
          <Column role="Pour les livreurs" steps={driverSteps} accent="kola" />
        </div>
      </div>
    </section>
  );
}

function Column({
  role,
  steps,
  accent,
}: {
  role: string;
  steps: { n: string; title: string; desc: string }[];
  accent?: 'kola' | 'terra';
}) {
  const isKola = accent === 'kola';
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.5 }}
    >
      <div className="flex items-center gap-3">
        <span className="text-xs font-bold uppercase tracking-[0.25em] text-ink-500">
          {role}
        </span>
      </div>

      <ol className="mt-10 space-y-12">
        {steps.map((s) => (
          <li key={s.n} className="grid grid-cols-[auto_1fr] gap-x-8 gap-y-2">
            <div
              className={`font-display text-7xl leading-none ${
                isKola ? 'text-kola-700' : 'text-terra-700'
              }`}
            >
              {s.n}
            </div>
            <div className="pt-2">
              <h3 className="font-display text-3xl leading-tight tracking-tight text-ink-900">
                {s.title}
              </h3>
              <p className="mt-2 max-w-sm text-base leading-relaxed text-ink-700">
                {s.desc}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </motion.div>
  );
}
