'use client';

import { motion } from 'framer-motion';
import { Smartphone, MapPin, PackageCheck, Star } from 'lucide-react';

const clientSteps = [
  {
    icon: Smartphone,
    title: 'Créez votre demande',
    text: 'Adresse de récupération, livraison, type de colis. Prix calculé instantanément.',
  },
  {
    icon: MapPin,
    title: 'Suivez votre livreur',
    text: 'Position GPS temps réel, ETA précis, contact direct par appel ou message.',
  },
  {
    icon: PackageCheck,
    title: 'Récupérez votre colis',
    text: 'Confirmation par code, paiement Mobile Money, livreur noté en un tap.',
  },
];

const driverSteps = [
  {
    icon: Smartphone,
    title: 'Inscrivez-vous',
    text: 'Photos CNIB et permis. Validation sous 24h par notre équipe.',
  },
  {
    icon: MapPin,
    title: 'Passez en ligne',
    text: 'Recevez les demandes proches en temps réel. Vous choisissez ce que vous acceptez.',
  },
  {
    icon: Star,
    title: 'Gagnez et progressez',
    text: 'Gains immédiats à chaque course. Plus votre note monte, plus vous recevez de demandes.',
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="bg-sand-50 py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-terra-50 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-terra-700">
            Comment ça marche
          </span>
          <h2 className="mt-5 text-4xl font-bold tracking-tight text-ink-900 md:text-5xl">
            Simple pour tout le monde.
          </h2>
          <p className="mt-4 text-lg text-ink-700">
            Que vous envoyiez un colis ou que vous fassiez des livraisons, l'expérience est pensée pour aller à l'essentiel.
          </p>
        </div>

        {/* Deux colonnes : client + livreur */}
        <div className="mt-16 grid gap-10 lg:grid-cols-2 lg:gap-14">
          <StepColumn role="Client" steps={clientSteps} accent="terra" />
          <StepColumn role="Livreur" steps={driverSteps} accent="kola" />
        </div>
      </div>
    </section>
  );
}

function StepColumn({
  role,
  steps,
  accent,
}: {
  role: 'Client' | 'Livreur';
  steps: { icon: typeof Smartphone; title: string; text: string }[];
  accent: 'terra' | 'kola';
}) {
  const bg = accent === 'terra' ? 'bg-terra-50/70' : 'bg-kola-50/70';
  const ring = accent === 'terra' ? 'ring-terra-200' : 'ring-kola-200';
  const dot = accent === 'terra' ? 'bg-terra-700 text-white' : 'bg-kola-700 text-white';
  const num = accent === 'terra' ? 'text-terra-700' : 'text-kola-700';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.5 }}
      className={`relative rounded-3xl ${bg} p-8 ring-1 ${ring} md:p-10`}
    >
      <div className="mb-8 flex items-center gap-3">
        <span className={`inline-flex h-9 w-9 items-center justify-center rounded-full ${dot} text-xs font-bold uppercase tracking-wider`}>
          {role === 'Client' ? 'C' : 'L'}
        </span>
        <h3 className="text-2xl font-bold tracking-tight">Côté {role.toLowerCase()}</h3>
      </div>

      <ol className="space-y-7">
        {steps.map((s, i) => {
          const Icon = s.icon;
          return (
            <li key={s.title} className="flex gap-5">
              <div className="flex flex-col items-center">
                <div className={`grid h-12 w-12 place-items-center rounded-2xl bg-white shadow-md ring-1 ring-ink-900/5`}>
                  <Icon className={`h-5 w-5 ${accent === 'terra' ? 'text-terra-700' : 'text-kola-700'}`} />
                </div>
                {i < steps.length - 1 && (
                  <span className={`mt-2 h-12 w-px ${accent === 'terra' ? 'bg-terra-200' : 'bg-kola-200'}`} />
                )}
              </div>
              <div className="flex-1 pb-2">
                <div className={`text-xs font-bold uppercase tracking-widest ${num}`}>
                  Étape {i + 1}
                </div>
                <div className="mt-1 text-lg font-semibold text-ink-900">{s.title}</div>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-700">{s.text}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </motion.div>
  );
}
