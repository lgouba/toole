'use client';

import { motion } from 'framer-motion';
import { ArrowRight, Wallet, Calendar, TrendingUp } from 'lucide-react';

export function DriverCTA() {
  return (
    <section id="driver" className="relative overflow-hidden bg-ink-900 py-24 text-white md:py-32">
      {/* Glow background */}
      <div className="pointer-events-none absolute -left-32 top-1/2 h-[500px] w-[500px] -translate-y-1/2 rounded-full bg-kola-700 opacity-30 blur-3xl" />
      <div className="pointer-events-none absolute -right-40 -bottom-40 h-[600px] w-[600px] rounded-full bg-terra-700 opacity-25 blur-3xl" />

      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-6 md:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <span className="inline-flex items-center gap-2 rounded-full bg-kola-700/20 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-kola-200 ring-1 ring-kola-700/40">
            Devenir livreur Tollé
          </span>
          <h2 className="mt-5 text-4xl font-bold leading-tight tracking-tight md:text-5xl lg:text-6xl">
            Gagnez votre vie,{' '}
            <span className="bg-gradient-to-r from-terra-300 to-sand-200 bg-clip-text text-transparent">
              à votre rythme.
            </span>
          </h2>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-white/75">
            Rejoignez les livreurs Tollé à Ouagadougou. Inscription gratuite,
            paiements rapides, soutien 7/7. Vous gérez vos horaires.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <Stat icon={Wallet} value="80%" label="de la course pour vous" />
            <Stat icon={Calendar} value="7j/7" label="horaires libres" />
            <Stat icon={TrendingUp} value="24h" label="validation du dossier" />
          </div>

          <div className="mt-10 flex flex-wrap gap-3">
            <a
              href="#download"
              className="group inline-flex items-center gap-2 rounded-full bg-terra-600 px-6 py-3.5 text-base font-semibold text-white shadow-xl shadow-terra-700/40 transition hover:bg-terra-500"
            >
              Je m'inscris
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </a>
            <a
              href="mailto:contact@tolle.bf"
              className="inline-flex items-center gap-2 rounded-full bg-white/5 px-6 py-3.5 text-base font-semibold text-white ring-1 ring-white/15 transition hover:bg-white/10"
            >
              Une question ?
            </a>
          </div>
        </motion.div>

        {/* Carte témoignage / visuel */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="relative"
        >
          <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-terra-600/40 via-kola-600/30 to-transparent blur-2xl" />

          <div className="relative rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl md:p-10">
            <div className="flex items-center gap-4">
              <div className="grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-terra-500 to-terra-700 text-xl font-bold">
                OG
              </div>
              <div>
                <div className="text-lg font-semibold">Oswald G.</div>
                <div className="text-sm text-white/60">Livreur Tollé · Ouagadougou</div>
              </div>
            </div>

            <p className="mt-6 text-lg leading-relaxed text-white/90">
              « Je travaille quand je veux, je sais combien je vais gagner avant
              d'accepter, et les paiements arrivent tout de suite sur mon Orange
              Money. C'est carré. »
            </p>

            <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-5 text-sm">
              <div>
                <div className="text-white/60">Courses ce mois</div>
                <div className="text-2xl font-bold tabular-nums">142</div>
              </div>
              <div>
                <div className="text-white/60">Note moyenne</div>
                <div className="text-2xl font-bold tabular-nums">4,9 ★</div>
              </div>
              <div>
                <div className="text-white/60">Gains</div>
                <div className="text-2xl font-bold tabular-nums">214k</div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function Stat({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Wallet;
  value: string;
  label: string;
}) {
  return (
    <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
      <Icon className="h-5 w-5 text-kola-300" />
      <div className="mt-2 text-2xl font-bold tracking-tight">{value}</div>
      <div className="text-xs text-white/70">{label}</div>
    </div>
  );
}
