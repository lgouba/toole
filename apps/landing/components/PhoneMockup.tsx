import { MapPin, Package } from 'lucide-react';

/**
 * Mockup d'iPhone "stylisé" — pas une vraie capture mais un rendu propre
 * en CSS qui reprend les codes visuels de l'app (vert kola, gain en gros).
 * À remplacer par un vrai screenshot quand on en a un.
 */
export function PhoneMockup() {
  return (
    <div className="relative h-[620px] w-[300px] rounded-[44px] border-[12px] border-ink-900 bg-ink-900 shadow-2xl">
      {/* Encoche */}
      <div className="absolute left-1/2 top-0 z-10 h-6 w-28 -translate-x-1/2 rounded-b-2xl bg-ink-900" />

      {/* Écran */}
      <div className="relative flex h-full w-full flex-col overflow-hidden rounded-[32px] bg-kola-800">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-10 pb-4 text-white">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-white/15">
              <Package className="h-4 w-4" />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-white/70">
                Nouvelle course
              </div>
              <div className="text-sm font-semibold">Une demande pour vous</div>
            </div>
          </div>
          <div className="grid h-12 w-12 place-items-center rounded-full border-[3px] border-terra-400/40">
            <span className="text-base font-bold tabular-nums text-white">52</span>
          </div>
        </div>

        {/* Decoration milieu */}
        <div className="flex flex-1 items-center justify-center text-center">
          <div>
            <div className="text-5xl">🛵💨</div>
            <div className="mt-2 text-sm font-medium text-white/80">
              Une course t'attend !
            </div>
          </div>
        </div>

        {/* Sheet bas */}
        <div className="rounded-t-3xl bg-white px-5 pt-5 pb-7 text-ink-900">
          {/* Gain hero */}
          <div className="rounded-2xl bg-kola-700 p-4 text-center text-white">
            <div className="text-[10px] font-semibold uppercase tracking-widest opacity-80">
              Votre gain
            </div>
            <div className="mt-1 text-3xl font-bold tracking-tight">1 870 FCFA</div>
            <div className="mt-3 flex items-center justify-center gap-4 text-xs">
              <span className="font-semibold">3.6 km</span>
              <span className="h-3 w-px bg-white/30" />
              <span className="opacity-80">Gros colis</span>
            </div>
          </div>

          {/* Trajet */}
          <div className="mt-3 rounded-2xl bg-sand-50 p-3.5">
            <div className="flex gap-3">
              <div className="flex flex-col items-center pt-1">
                <span className="h-2.5 w-2.5 rounded-full bg-terra-700" />
                <span className="my-1 h-7 w-px bg-ink-300" />
                <span className="h-2.5 w-2.5 rounded-full bg-kola-700" />
              </div>
              <div className="flex-1 leading-tight">
                <div className="text-[9px] font-bold uppercase tracking-widest text-ink-500">
                  Récupération
                </div>
                <div className="truncate text-xs font-semibold">
                  91 Avenue de Fabron
                </div>
                <div className="mt-3 text-[9px] font-bold uppercase tracking-widest text-ink-500">
                  Livraison
                </div>
                <div className="truncate text-xs font-semibold">
                  833 Av. Général de Gaulle
                </div>
              </div>
            </div>
          </div>

          {/* Bouton */}
          <button
            type="button"
            className="mt-4 w-full rounded-xl bg-terra-700 py-3.5 text-sm font-bold text-white shadow-md shadow-terra-700/30"
          >
            Accepter la course
          </button>
        </div>
      </div>

      {/* Floating chip — "livraison en cours" */}
      <div className="absolute -left-8 top-24 hidden rounded-2xl bg-white p-3 shadow-xl ring-1 ring-ink-900/5 md:flex">
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-kola-100">
            <MapPin className="h-4 w-4 text-kola-700" />
          </div>
          <div className="leading-tight">
            <div className="text-[10px] font-semibold uppercase text-ink-500">
              En route
            </div>
            <div className="text-xs font-bold">Arrivée dans 8 min</div>
          </div>
        </div>
      </div>
    </div>
  );
}
