# Tests E2E — Maestro (Toolé mobile)

Tests end-to-end de l'app Expo/React Native avec [Maestro](https://maestro.mobile.dev).
Cible actuelle : **Android** (émulateur/appareil). iOS s'ajoute plus tard (mêmes flows).

Maestro cible les éléments par **texte visible** ou par **testID** et gère
automatiquement les attentes/retries → peu de flaky, peu de maintenance.

---

## Lancer les tests en local (boucle de feedback rapide)

### 1. Installer Maestro (une fois)

```bash
curl -Ls "https://get.maestro.mobile.dev" | bash
# ajoute ~/.maestro/bin au PATH (le script l'indique), puis :
maestro --version
```

### 2. Avoir l'app installée sur un émulateur/appareil Android

Un émulateur doit tourner (Android Studio > Device Manager, ou `emulator -avd <nom>`).
Installe l'APK dessus. Trois options :

```bash
cd apps/mobile

# a) build local fidèle aux testeurs (profil preview = APK)
eas build --local --platform android --profile preview --output toole.apk
adb install -r toole.apk

# b) OU réutiliser le dernier APK preview déjà buildé sur EAS (plus rapide)
#    -> https://expo.dev/accounts/lgouba/projects/tolle/builds  (télécharge .apk)
#    puis: adb install -r ~/Downloads/xxxx.apk

# c) OU build dev direct (nécessite Metro qui tourne)
npx expo run:android --variant release
```

### 3. Lancer les flows

```bash
cd apps/mobile
maestro test .maestro            # tous les flows
maestro test .maestro/onboarding_smoke.yaml   # un seul
```

### Écrire/déboguer un flow visuellement

```bash
maestro studio     # inspecteur interactif : montre les selecteurs de chaque élément
```

---

## En CI (GitHub Actions)

Workflow : [`.github/workflows/e2e-android.yml`](../../../.github/workflows/e2e-android.yml).
Il build l'APK sur le runner puis lance Maestro sur un émulateur Android.

Déclenché sur : push/PR touchant `apps/mobile/**` + `workflow_dispatch` (manuel).
Séparé de `ci.yml` (typecheck rapide) car un run E2E prend ~20-30 min.

**Prérequis — secret `EXPO_TOKEN`** (sinon le build APK échoue) :
1. Crée un token : https://expo.dev/accounts/lgouba/settings/access-tokens
2. GitHub → repo → Settings → Secrets and variables → Actions → New secret
   → nom `EXPO_TOKEN`, valeur = le token.

---

## Flows actuels

| Flow | Couvre | Backend requis |
|------|--------|----------------|
| `onboarding_smoke.yaml` | Lancement app → onboarding → écran login | Non |

## Roadmap (Phase 2 — flows authentifiés)

Les prochains flows testent les parcours réels et nécessitent un backend en mode
dev (OTP `1234`, paiement `0000`). En CI : Postgres en service + l'API lancée,
APK buildé avec `EXPO_PUBLIC_API_URL` pointant vers ce backend.

- [ ] Login OTP client (téléphone → `1234` → home client)
- [ ] Création d'une course (adresses → estimation prix → confirmation)
- [ ] Login livreur + passage en ligne
- [ ] Cycle course : accept → retrait → code livraison
- [ ] `testID` sur les éléments à contenu dynamique (montants, adresses, statuts)
