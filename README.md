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

## Déploiement (à valider avant toute mise en ligne)

### Option 1 — Netlify ou Vercel (zéro config)

1. Pousser le dépôt sur GitHub.
2. Sur [Netlify](https://app.netlify.com) ou [Vercel](https://vercel.com) : "New site/project from Git", sélectionner le dépôt.
3. Build command : `npm run build` — Publish/Output directory : `dist`.
4. Le site est servi en HTTPS automatiquement (requis pour le service worker) — aucune config PWA supplémentaire nécessaire tant que `base: '/'` reste inchangé dans `vite.config.js`.

### Option 2 — GitHub Pages

GitHub Pages sert le site depuis `https://<utilisateur>.github.io/<nom-du-dépôt>/`, donc l'app n'est pas à la racine du domaine : il faut adapter `base` dans `vite.config.js` :

```js
export default defineConfig({
  base: '/<nom-du-dépôt>/', // ex : '/mon-eco/'
  // ...
});
```

Et mettre à jour `start_url` et `scope` dans le manifest (`vite.config.js`, bloc `VitePWA({ manifest: { ... } })`) sur `'/<nom-du-dépôt>/'` pour que l'installation PWA fonctionne correctement en sous-chemin.

Puis :

```bash
npm run build
```

Déployer le contenu de `dist/` sur la branche `gh-pages` (via l'action GitHub `actions/deploy-pages` ou un outil comme `gh-pages` en devDependency).
