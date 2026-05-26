'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const faqs = [
  {
    q: "Quand l'application sera-t-elle disponible ?",
    a: "Le lancement est prévu pour juin 2026 à Ouagadougou. Le compte à rebours sur cette page vous donne la date exacte. Inscrivez-vous pour être notifié dès la sortie.",
  },
  {
    q: 'Comment je paie ma course ?',
    a: 'Trois options : Orange Money, Moov Money (depuis l\'app), ou cash directement au livreur à la livraison. Vous choisissez à chaque course.',
  },
  {
    q: 'Quelles zones sont desservies ?',
    a: 'Au lancement : Ouagadougou intra-muros (Ouaga 2000, Cissin, Patte d\'Oie, Tampouy, Dapoya, Pissy, Zone du Bois...). Extension prévue à Bobo-Dioulasso et autres villes par la suite.',
  },
  {
    q: 'Comment devenir livreur Tôllé ?',
    a: 'Téléchargez l\'app dès la sortie, créez votre compte livreur, soumettez vos documents (CNIB, permis, photo véhicule). Validation par notre équipe sous 24h. Vous gérez vos horaires librement.',
  },
  {
    q: 'Que se passe-t-il si le livreur ne vient pas ?',
    a: 'La course est automatiquement annulée si aucun livreur ne l\'accepte dans les délais, ou si le livreur tarde au-delà du raisonnable. Vous n\'êtes pas débité.',
  },
  {
    q: 'Y a-t-il un service client ?',
    a: 'Oui. Une équipe support est disponible 7j/7 par téléphone, WhatsApp et email pour toute question ou litige. Les coordonnées seront accessibles dans l\'app.',
  },
  {
    q: 'Mes données personnelles sont-elles protégées ?',
    a: 'Tôllé ne partage jamais vos informations à des tiers. Les numéros de téléphone entre client et livreur sont masqués pendant la course. Nous respectons la réglementation sur la protection des données.',
  },
];

export function FAQ() {
  return (
    <section id="faq" className="bg-sand-50 py-24 md:py-32">
      <div className="mx-auto max-w-3xl px-6">
        <div className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-ink-900/5 px-3.5 py-1.5 text-xs font-bold uppercase tracking-widest text-ink-700">
            FAQ
          </span>
          <h2 className="mt-5 text-4xl font-bold tracking-tight text-ink-900 md:text-5xl">
            Questions fréquentes.
          </h2>
          <p className="mt-4 text-lg text-ink-700">
            Tout ce que vous voulez savoir avant le lancement.
          </p>
        </div>

        <div className="mt-14 divide-y divide-ink-900/8 rounded-3xl border border-ink-900/8 bg-white">
          {faqs.map((f, i) => (
            <FAQItem key={f.q} q={f.q} a={f.a} initiallyOpen={i === 0} />
          ))}
        </div>

        <div className="mt-12 text-center text-sm text-ink-700">
          Une question ?{' '}
          <a
            href="mailto:contact@tolle.bf"
            className="font-semibold text-terra-700 underline-offset-4 hover:underline"
          >
            contact@tolle.bf
          </a>
        </div>
      </div>
    </section>
  );
}

function FAQItem({
  q,
  a,
  initiallyOpen,
}: {
  q: string;
  a: string;
  initiallyOpen?: boolean;
}) {
  const [open, setOpen] = useState(!!initiallyOpen);
  return (
    <div className="px-6 md:px-8">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 py-6 text-left"
      >
        <span className="text-base font-semibold text-ink-900 md:text-lg">{q}</span>
        <ChevronDown
          className={`h-5 w-5 flex-shrink-0 text-ink-500 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <p className="pb-6 pr-10 text-base leading-relaxed text-ink-700">
              {a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
