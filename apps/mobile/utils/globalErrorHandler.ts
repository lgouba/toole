/**
 * Attache un handler global pour les "unhandled promise rejections" afin d'éviter
 * qu'une erreur axios oubliee n'affiche un bandeau rouge bloquant dans l'app.
 *
 * A importer une seule fois au démarrage de l'app (dans app/_layout.tsx).
 */

type GlobalWithPromiseHandler = typeof globalThis & {
  HermesInternal?: {
    enablePromiseRejectionTracker?: (options: {
      allRejections?: boolean;
      onUnhandled?: (id: number, error: unknown) => void;
    }) => void;
  };
};

const g = globalThis as GlobalWithPromiseHandler;

if (g.HermesInternal?.enablePromiseRejectionTracker) {
  g.HermesInternal.enablePromiseRejectionTracker({
    allRejections: true,
    onUnhandled: (id, error: any) => {
      const msg = error?.message ?? String(error);
      const status = error?.response?.status ?? '';
      const url = error?.config?.url ?? '';
      // Log discret, pas d'affichage d'erreur rouge
      console.log(`[unhandled-rejection] id=${id} status=${status} url=${url} msg=${msg}`);
    },
  });
}
