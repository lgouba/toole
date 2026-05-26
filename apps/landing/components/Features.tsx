'use client';

import { motion } from 'framer-motion';
import { Check, MapPin, CreditCard, Camera, Calendar } from 'lucide-react';
import { ScreenshotPlaceholder } from './ScreenshotPlaceholder';

const features = [
  {
    eyebrow: 'Course en 30 secondes',
    title: 'Demandez une livraison\nen quelques tapotis.',
    desc: 'Saisissez les adresses de récupération et de livraison, choisissez le type de colis. Le prix est calculé instantanément. Acceptez, et un livreur prend la course en quelques secondes.',
    points: [
      'Recherche d\'adresse intelligente (Ouaga 2000, Cissin, Patte d\'Oie...)',
      'Prix transparent affiché avant validation',
      'Tarification au km adaptée à la taille du colis',
    ],
    icon: MapPin,
    screen: { label: 'Création de course', filename: 'create-delivery.png' },
    side: 'right' as const,
  },
  {
    eyebrow: 'Suivi temps réel',
    title: 'Voyez votre livreur\nse déplacer sur la carte.',
    desc: 'Position GPS en direct, ETA précis recalculé à chaque seconde. Vous savez exactement quand votre colis va arriver. Partagez le lien de suivi avec le destinataire en un clic.',
    points: [
      'Position GPS toutes les 10 secondes',
      'ETA recalculé en temps réel (OSRM)',
      'Lien de suivi partageable WhatsApp',
    ],
    icon: MapPin,
    screen: { label: 'Suivi live sur carte', filename: 'tracking-map.png' },
    side: 'left' as const,
  },
  {
    eyebrow: 'Paiement flexible',
    title: 'Mobile Money,\nou cash à la livraison.',
    desc: 'Payez directement avec Orange Money ou Moov Money depuis l\'app. Ou choisissez le cash : votre livreur encaisse, et la commission plateforme est reversée par le livreur après la course.',
    points: [
      'Orange Money + Moov Money intégrés',
      'Option paiement cash à la livraison',
      'Reçu numérique automatique',
    ],
    icon: CreditCard,
    screen: { label: 'Choix de paiement', filename: 'payment.png' },
    side: 'right' as const,
  },
  {
    eyebrow: 'Sécurité colis',
    title: 'Code de livraison\n+ photos preuves.',
    desc: 'Un code unique de 4 chiffres est généré pour chaque course. Le destinataire le donne au livreur à la remise. Le livreur photographie le colis à la récupération et à la livraison.',
    points: [
      'Code à 4 chiffres unique par course',
      'Photo récupération + photo livraison',
      'Historique complet conservé',
    ],
    icon: Camera,
    screen: { label: 'Validation par code', filename: 'validation-code.png' },
    side: 'left' as const,
  },
];

export function Features() {
  return (
    <section id="features" className="bg-sand-50 py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-6">
        {/* Header */}
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-kola-100 px-3.5 py-1.5 text-xs font-bold uppercase tracking-widest text-kola-800">
            L'application
          </span>
          <h2 className="mt-5 text-4xl font-bold leading-[1.1] tracking-tight text-ink-900 md:text-5xl lg:text-6xl">
            Tout ce qu'il faut pour{' '}
            <span className="bg-gradient-to-br from-terra-600 to-terra-800 bg-clip-text text-transparent">
              livrer simplement.
            </span>
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-ink-700">
            Tôllé n'est pas qu'une app de mise en relation. C'est un outil pensé pour le quotidien à Ouagadougou.
          </p>
        </div>

        {/* Features alternées */}
        <div className="mt-20 space-y-28 md:mt-28 md:space-y-40">
          {features.map((f) => (
            <FeatureRow key={f.title} {...f} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureRow({
  eyebrow,
  title,
  desc,
  points,
  screen,
  side,
}: typeof features[0]) {
  const screenshotEl = (
    <motion.div
      initial={{ opacity: 0, scale: 0.94 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6 }}
    >
      <ScreenshotPlaceholder label={screen.label} filename={screen.filename} />
    </motion.div>
  );

  const textEl = (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.5 }}
    >
      <div className="text-xs font-bold uppercase tracking-[0.15em] text-terra-700">
        {eyebrow}
      </div>
      <h3 className="mt-3 whitespace-pre-line text-3xl font-bold leading-[1.15] tracking-tight text-ink-900 md:text-4xl lg:text-5xl">
        {title}
      </h3>
      <p className="mt-5 max-w-lg text-base leading-relaxed text-ink-700 md:text-lg">
        {desc}
      </p>
      <ul className="mt-8 space-y-3">
        {points.map((p) => (
          <li key={p} className="flex items-start gap-3">
            <div className="mt-0.5 grid h-5 w-5 flex-shrink-0 place-items-center rounded-full bg-kola-700">
              <Check className="h-3 w-3 text-white" />
            </div>
            <span className="text-sm text-ink-700 md:text-base">{p}</span>
          </li>
        ))}
      </ul>
    </motion.div>
  );

  return (
    <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
      {side === 'left' ? (
        <>
          {screenshotEl}
          {textEl}
        </>
      ) : (
        <>
          {textEl}
          {screenshotEl}
        </>
      )}
    </div>
  );
}
