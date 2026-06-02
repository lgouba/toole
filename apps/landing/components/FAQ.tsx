'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
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
    q: 'Comment devenir livreur Toolé ?',
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
    a: 'Toolé ne partage jamais vos informations à des tiers. Les numéros de téléphone entre client et livreur sont masqués pendant la course. Nous respectons la réglementation sur la protection des données.',
  },
];

export function FAQ() {
  return (
    <section id="faq" className="bg-paper py-28 md:py-40">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-16 lg:grid-cols-[1fr_2fr] lg:gap-20">
          <div>
            <div className="text-xs font-medium uppercase tracking-[0.25em] text-terra-700">
              Questions fréquentes
            </div>
            <h2 className="mt-6 font-display text-5xl leading-[0.95] tracking-tight text-ink-900 md:text-6xl lg:text-7xl">
              Vos réponses,
              <br />
              <em className="text-terra-700">sans détour.</em>
            </h2>
            <p className="mt-8 max-w-sm text-base leading-relaxed text-ink-700">
              Une question qui n'est pas listée ?<br />
              <a
                href="mailto:contact@tolle.bf"
                className="link-editorial font-medium text-ink-900"
              >
                contact@tolle.bf
              </a>
            </p>
          </div>

          <div className="border-t border-ink-900/15">
            {faqs.map((f, i) => (
              <FAQItem key={f.q} q={f.q} a={f.a} initiallyOpen={i === 0} />
            ))}
          </div>
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
    <div className="border-b border-ink-900/15">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-6 py-7 text-left"
      >
        <span className="font-display text-2xl leading-tight tracking-tight text-ink-900 md:text-3xl">
          {q}
        </span>
        <Plus
          className={`mt-2 h-6 w-6 flex-shrink-0 text-ink-700 transition-transform duration-300 ${open ? 'rotate-45' : ''}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <p className="max-w-2xl pb-7 pr-12 text-base leading-[1.7] text-ink-700 md:text-lg">
              {a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
