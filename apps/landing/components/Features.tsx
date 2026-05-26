'use client';

import { motion } from 'framer-motion';
import { ScreenshotPlaceholder } from './ScreenshotPlaceholder';

const features = [
  {
    chapter: 'Ch. I',
    eyebrow: 'Course en 30 secondes',
    title: 'Demandez.\nC\'est parti.',
    desc: 'Saisissez les adresses, choisissez le type de colis. Le prix s\'affiche instantanément. Validez. Un livreur prend la course en quelques secondes.',
    bullets: [
      'Recherche d\'adresse intelligente',
      'Prix transparent avant validation',
      'Estimation distance & temps',
    ],
    screen: { label: 'Création de course', filename: 'create-delivery.png' },
    side: 'right' as const,
  },
  {
    chapter: 'Ch. II',
    eyebrow: 'Suivi temps réel',
    title: 'La carte\nvit pour vous.',
    desc: 'Position GPS du livreur en direct sur la carte. ETA recalculé à chaque seconde. Vous savez à la minute près quand votre colis va arriver.',
    bullets: [
      'Position GPS toutes les 10 secondes',
      'Temps d\'arrivée précis (OSRM)',
      'Partage WhatsApp du suivi',
    ],
    screen: { label: 'Suivi live sur carte', filename: 'tracking-map.png' },
    side: 'left' as const,
  },
  {
    chapter: 'Ch. III',
    eyebrow: 'Paiement',
    title: 'Mobile Money,\nou espèces.',
    desc: 'Payez directement avec Orange Money ou Moov Money depuis l\'application. Ou choisissez le cash : votre livreur encaisse à la livraison.',
    bullets: [
      'Orange Money + Moov Money',
      'Option cash à la livraison',
      'Reçu numérique',
    ],
    screen: { label: 'Choix de paiement', filename: 'payment.png' },
    side: 'right' as const,
  },
  {
    chapter: 'Ch. IV',
    eyebrow: 'Sécurité',
    title: 'Code + photo.\nColis protégé.',
    desc: 'Un code unique à 4 chiffres pour chaque course. Le destinataire le donne au livreur à la remise. Photos preuves récupération et livraison.',
    bullets: [
      'Code à 4 chiffres unique',
      'Photos preuves récup + livraison',
      'Historique conservé',
    ],
    screen: { label: 'Validation par code', filename: 'validation-code.png' },
    side: 'left' as const,
  },
];

export function Features() {
  return (
    <section id="features" className="bg-paper py-28 md:py-40">
      <div className="mx-auto max-w-7xl px-6">
        {/* Header éditorial */}
        <div className="mx-auto max-w-4xl text-center">
          <div className="flex items-center justify-center gap-3">
            <span className="h-px w-10 bg-ink-900/30" />
            <span className="text-xs font-medium uppercase tracking-[0.25em] text-ink-700">
              L'application
            </span>
            <span className="h-px w-10 bg-ink-900/30" />
          </div>
          <h2 className="mt-8 font-display text-6xl leading-[0.95] tracking-[-0.02em] text-ink-900 md:text-7xl lg:text-8xl">
            Tout ce qu'il faut.
            <br />
            <em className="text-terra-700">Rien de superflu.</em>
          </h2>
          <p className="mx-auto mt-8 max-w-2xl text-lg leading-[1.6] text-ink-700 md:text-xl">
            Quatre fonctionnalités pensées pour le quotidien à Ouagadougou.
            Pas de gadget. Du concret.
          </p>
        </div>

        {/* Features alternées */}
        <div className="mt-28 space-y-32 md:mt-40 md:space-y-48">
          {features.map((f) => (
            <FeatureRow key={f.title} {...f} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureRow({
  chapter,
  eyebrow,
  title,
  desc,
  bullets,
  screen,
  side,
}: typeof features[0]) {
  const screenshotEl = (
    <motion.div
      initial={{ opacity: 0, scale: 0.94, y: 24 }}
      whileInView={{ opacity: 1, scale: 1, y: 0 }}
      viewport={{ once: true, margin: '-100px' }}
      transition={{ duration: 0.7 }}
    >
      <ScreenshotPlaceholder label={screen.label} filename={screen.filename} />
    </motion.div>
  );

  const textEl = (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-100px' }}
      transition={{ duration: 0.6 }}
    >
      <div className="flex items-center gap-3">
        <span className="font-display text-2xl italic text-terra-600">
          {chapter}
        </span>
        <span className="h-px w-8 bg-ink-300" />
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-ink-500">
          {eyebrow}
        </span>
      </div>
      <h3 className="mt-6 whitespace-pre-line font-display text-5xl leading-[0.95] tracking-tight text-ink-900 md:text-6xl lg:text-7xl">
        {title}
      </h3>
      <p className="mt-8 max-w-lg text-base leading-[1.7] text-ink-700 md:text-lg">
        {desc}
      </p>
      <ul className="mt-10 space-y-3">
        {bullets.map((b) => (
          <li key={b} className="flex items-start gap-4">
            <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-terra-600" />
            <span className="text-base text-ink-700 md:text-lg">{b}</span>
          </li>
        ))}
      </ul>
    </motion.div>
  );

  return (
    <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
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
