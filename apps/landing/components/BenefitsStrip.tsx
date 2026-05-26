'use client';

import { motion } from 'framer-motion';
import { Zap, Shield, Smartphone } from 'lucide-react';

const benefits = [
  {
    icon: Zap,
    title: 'Livraison express',
    desc: 'Vos colis livrés en moins de 30 minutes à travers Ouagadougou.',
  },
  {
    icon: Shield,
    title: 'Livreurs vérifiés',
    desc: 'Identité, permis, véhicule contrôlés. Note publique sur chaque livreur.',
  },
  {
    icon: Smartphone,
    title: 'Mobile Money intégré',
    desc: 'Orange Money, Moov Money ou espèces. Au choix, à chaque course.',
  },
];

export function BenefitsStrip() {
  return (
    <section className="bg-sand-50 py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-8 md:grid-cols-3 md:gap-10">
          {benefits.map((b, i) => {
            const Icon = b.icon;
            return (
              <motion.div
                key={b.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="group rounded-3xl border border-ink-900/5 bg-white p-7 transition hover:border-ink-900/10 hover:shadow-lg"
              >
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-kola-700 shadow-lg shadow-kola-700/20">
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="mt-6 text-xl font-bold tracking-tight text-ink-900">
                  {b.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-700">
                  {b.desc}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
