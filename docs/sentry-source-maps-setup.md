# Sentry — upload des source maps (à finaliser)

**Statut : différé** — nécessite les identifiants du projet Sentry (org + project
slugs) et un auth token, non disponibles au moment de l'implémentation analytics.

Le crash reporting + la **release health** (crash-free users/sessions) fonctionnent
déjà sans ça (cf. `apps/mobile/services/sentry.ts`). Les source maps servent
uniquement à rendre les **stack traces lisibles** (sinon elles pointent sur le
bundle minifié).

## À faire quand on a les identifiants Sentry

1. Récupérer dans Sentry : **organization slug**, **project slug**, et créer un
   **auth token** (scope `project:releases` + `org:read`) via *Settings → Auth Tokens*.

2. Ajouter le plugin au `apps/mobile/app.json`, dans `expo.plugins` :
   ```json
   [
     "@sentry/react-native/expo",
     { "organization": "<org-slug>", "project": "<project-slug>" }
   ]
   ```

3. Fournir le token au build **sans le committer** (secret EAS) :
   ```bash
   eas secret:create --scope project --name SENTRY_AUTH_TOKEN --value <token>
   ```

4. Rebuild natif (même build que l'analytics, 1.2.0) : le plugin uploade les
   source maps automatiquement au build. Sans `SENTRY_AUTH_TOKEN`, l'upload est
   simplement sauté (pas d'échec de build).

## Pourquoi ce n'est pas câblé tout de suite

Mettre le plugin avec des slugs placeholder dans `app.json` risquerait de
perturber le build 1.2.0. On attend les vrais identifiants pour l'ajouter d'un
coup, proprement.
