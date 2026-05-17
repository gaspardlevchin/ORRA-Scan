# Terrain Scan App

Application web professionnelle en Next.js + TypeScript pour visualiser une carte topographique 3D centrée automatiquement sur la position de l'utilisateur.

L'interface est sombre, minimaliste et orientée lecture terrain : carte Mapbox GL JS, relief 3D, bâtiments extrudés, viseur radar, coordonnées GPS en temps réel et contrôles essentiels.

## Fonctionnalités

- Demande de géolocalisation au chargement.
- Centrage automatique sur la position utilisateur si l'autorisation est accordée.
- Repli automatique sur Paris si la géolocalisation est refusée, indisponible ou non supportée.
- Carte Mapbox sombre avec terrain 3D et ombrage topographique.
- Bâtiments 3D extrudés à partir des données Mapbox.
- Marqueur de position utilisateur.
- Viseur central type scanner/radar.
- Panneau d'informations : centre de carte, position utilisateur, zoom, pitch, altitude disponible et statut de géolocalisation.
- Contrôles : me localiser, activer/désactiver le terrain, activer/désactiver les bâtiments, plein écran.
- Interface responsive desktop et mobile.

## Stack

- Next.js App Router
- TypeScript
- React
- Mapbox GL JS
- CSS global sans bibliothèque UI lourde

## Installation

Prérequis recommandé : Node.js 22. Next.js reste compatible avec Node.js 20.9 ou plus récent.

```bash
npm install
```

## Configuration Mapbox

Créez un fichier `.env.local` à la racine du projet :

```bash
cp .env.local.example .env.local
```

Ajoutez votre token Mapbox public :

```bash
NEXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_token_here
```

Remplacez `your_mapbox_token_here` par votre clé Mapbox. Le token n'est jamais écrit directement dans le code source.

## Lancement local

```bash
npm run dev
```

Ouvrez ensuite [http://localhost:3000](http://localhost:3000).

Si le port `3000` est déjà utilisé, Next.js proposera automatiquement un autre port.

## Déploiement Vercel

1. Poussez ce repository sur GitHub.
2. Créez un nouveau projet sur [Vercel](https://vercel.com).
3. Importez le repository GitHub.
4. Dans les variables d'environnement du projet Vercel, ajoutez :

```bash
NEXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_token_here
```

5. Lancez le déploiement.

Le fichier `vercel.json` indique explicitement que le framework est Next.js. Vercel détecte ensuite les commandes standard du projet.

## Géolocalisation, localhost et HTTPS

Les navigateurs n'autorisent la géolocalisation que dans des contextes sécurisés. Elle fonctionne donc :

- en local via `localhost` ;
- en production via HTTPS.

Vercel fournit automatiquement HTTPS en production, ce qui permet à la géolocalisation de fonctionner après déploiement si l'utilisateur l'autorise.

## Scripts npm

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run typecheck
```

## Structure

```txt
app/
  layout.tsx
  page.tsx
  globals.css
components/
  MapView.tsx
  InfoPanel.tsx
  ControlPanel.tsx
  RadarOverlay.tsx
lib/
  geolocation.ts
  mapbox.ts
types/
  map.ts
```

## Notes de maintenance

- `components/MapView.tsx` contient l'orchestration Mapbox, la géolocalisation et les interactions de carte.
- `lib/geolocation.ts` isole l'accès au navigateur et les messages d'erreur.
- `lib/mapbox.ts` regroupe les constantes et helpers liés aux couches terrain et bâtiments.
- `types/map.ts` centralise les types partagés par l'interface.
