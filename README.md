# Mon Budget

Application de gestion budgétaire personnelle — solde, patrimoine, épargne, catégories de dépenses/revenus, budgets mensuels et objectifs. **PWA installable et 100% fonctionnelle hors ligne.**

## Stack

- Vite + React + Tailwind CSS v4
- `lucide-react` (icônes), `recharts` (camembert de répartition)
- `vite-plugin-pwa` (Workbox) pour le service worker et le manifest
- Persistance locale via `localStorage` (clé `mon-budget-v1`) — aucune donnée n'est envoyée à un serveur

## Développement

```bash
npm install
npm run dev
```

L'app démarre sur `http://localhost:5173`.

## Build de production

```bash
npm run build
```

Génère le dossier `dist/` avec l'app compilée, le `manifest.webmanifest` et le service worker (`sw.js`, `workbox-*.js`).

## Régénérer les icônes PWA

Les icônes (`public/icons/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`) sont générées à partir des SVG dans `scripts/` via [sharp](https://sharp.pixelplumbing.com/) :

```bash
npm run generate-icons
```

## Tester l'installation PWA en local

Le service worker et l'installabilité nécessitent un contexte sécurisé (HTTPS ou `localhost`). Le plus simple :

```bash
npm run build
npm run preview
```

Puis ouvrir `http://localhost:4173` dans Chrome/Edge :
1. Une icône d'installation apparaît dans la barre d'adresse (ou menu ⋮ → "Installer l'application").
2. Installer l'app, la fermer, puis couper le réseau (mode avion ou onglet réseau → Offline dans DevTools) : l'app doit continuer à fonctionner intégralement.
3. Dans l'onglet **Application** des DevTools, vérifier `Manifest` (icônes, `display: standalone`) et `Service Workers` (statut *activated and running*).

Sur iOS (Safari) : ouvrir l'URL, bouton Partager → "Sur l'écran d'accueil". Les meta `apple-mobile-web-app-capable` et `apple-touch-icon` sont déjà en place dans `index.html`.

## Fonctionnalités

- **Accueil** : solde disponible, patrimoine total (éditable — tu peux renseigner directement l'argent que tu as déjà), montant mis de côté, ajout rapide de transactions (dépense/revenu, catégorie, note, date), historique des dernières opérations.
- **Analyse** : répartition des dépenses du mois (camembert + liste), budgets mensuels par catégorie avec barre de progression et alerte de dépassement.
- **Épargne** : objectifs d'épargne (créer, alimenter, retirer, supprimer), suivi de progression.
- **Réglages** : devise (FCFA / € / $ / symbole personnalisé), décimales, position du symbole, réinitialisation complète des données.

## Déploiement

### GitHub Pages (déjà configuré, actif dans ce dépôt)

Le dépôt est prêt pour GitHub Pages : `base`, `start_url` et `scope` sont réglés sur `/Mon-eco/` dans `vite.config.js`, et `.github/workflows/deploy.yml` build + déploie automatiquement sur `https://jordansad.github.io/Mon-eco/` à chaque push sur `main`.

**Étape unique à faire une fois, côté GitHub** (aucun outil ne me permet de le faire à ta place) : dans le dépôt → **Settings → Pages → Build and deployment → Source : "GitHub Actions"**. Une fois ce réglage activé, chaque push sur `main` republie automatiquement le site — rien d'autre à faire ensuite.

Si tu renommes le dépôt ou changes de propriétaire, mets à jour `BASE_PATH` dans `vite.config.js` (et la doc ci-dessus) en conséquence.

### Alternative — Netlify ou Vercel (zéro config)

1. Sur [Netlify](https://app.netlify.com) ou [Vercel](https://vercel.com) : "New site/project from Git", sélectionner le dépôt.
2. Build command : `npm run build` — Publish/Output directory : `dist`.
3. Ces plateformes servent l'app à la racine du domaine : remettre `BASE_PATH` à `'/'` dans `vite.config.js` avant de déployer dessus (sinon les assets pointeront vers `/Mon-eco/...` qui n'existe pas sur ce domaine).
