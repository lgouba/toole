'use client';

import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

const promises = [
  { value: '80%', label: 'de la course revient au livreur' },
  { value: '7j/7', label: 'vous gérez vos horaires librement' },
  { value: '24h', label: 'validation du dossier livreur' },
];

export function DriverCTA() {
  return (
    <section id="driver" className="relative overflow-hidden bg-ink-900 py-28 text-paper md:py-40">
      {/* Halos chauds */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 top-1/4 h-[600px] w-[600px] rounded-full bg-terra-700 opacity-30 blur-[140px]" />
        <div className="absolute -right-40 bottom-0 h-[500px] w-[500px] rounded-full bg-gold opacity-20 blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
          className="max-w-4xl"
        >
          <div className="flex items-center gap-3">
            <span className="h-px w-10 bg-paper/40" />
            <span className="text-xs font-medium uppercase tracking-[0.25em] text-paper/60">
              Devenir livreur Toolé
            </span>
          </div>

          <h2 className="mt-8 font-display text-6xl leading-[0.95] tracking-tight md:text-7xl lg:text-8xl">
            Roulez,<br />
            <em className="bg-gradient-to-br from-terra-200 via-terra-300 to-gold bg-clip-text text-transparent">
              gagnez votre vie.
            </em>
          </h2>

          <p className="mt-10 max-w-xl text-lg leading-[1.7] text-paper/70 md:text-xl">
            Rejoignez les livreurs Toolé à Ouagadougou.
            Inscription gratuite, paiements rapides Mobile Money,
            soutien 7j/7, horaires libres. Vous gérez.
          </p>
        </motion.div>

        {/* 3 promesses concrètes */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mt-20 grid gap-px overflow-hidden rounded-3xl bg-paper/10 md:grid-cols-3"
        >
          {promises.map((p) => (
            <div key={p.label} className="bg-ink-900 p-8 md:p-10">
              <div className="font-display text-7xl leading-none tracking-tight text-terra-300 md:text-8xl">
                {p.value}
              </div>
              <p className="mt-6 max-w-xs text-sm leading-relaxed text-paper/60 md:text-base">
                {p.label}
              </p>
            </div>
          ))}
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-16 flex flex-wrap items-center gap-5"
        >
          <a
            href="#notify"
            className="group inline-flex items-center gap-3 rounded-full bg-paper px-7 py-4 text-base font-semibold text-ink-900 transition hover:scale-[1.02]"
          >
            Je veux m'inscrire
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </a>
          <a
            href="mailto:contact@toole.bf"
            className="link-editorial text-base font-medium text-paper"
          >
            Une question ? contact@toole.bf
          </a>
        </motion.div>
      </div>
    </section>
  );
}
