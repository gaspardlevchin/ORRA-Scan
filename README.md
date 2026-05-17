# ORRA Scan

Application web professionnelle en Next.js + TypeScript pour lire une carte topographique mondiale comme un scanner GPS.

L'interface reprend un langage d'instrument terrain : carte sombre, grille verte, ligne de visée, cibles radar, position appareil, altitude ouverte et lecture GPS live.

## Sources ouvertes

- MapLibre GL JS pour le rendu WebGL.
- OpenFreeMap / OpenStreetMap pour la carte vectorielle mondiale.
- OpenTopoMap pour l'overlay topographique.
- Open-Meteo Elevation API, basée sur Copernicus DEM GLO-90, pour l'altitude terrain.

Aucune clé Mapbox n'est nécessaire pour le fonctionnement par défaut.

## Fonctionnalités

- Demande de géolocalisation au chargement.
- Centrage automatique sur la position utilisateur si l'autorisation est accordée.
- Repli automatique sur Paris si la géolocalisation est refusée, indisponible ou non supportée.
- Carte mondiale vectorielle open source.
- Overlay topographique ouvert avec relief visuel.
- Bâtiments 3D extrudés quand les données OSM/OpenFreeMap sont disponibles.
- Marqueur de position utilisateur.
- Suivi GPS live via l'API Geolocation du navigateur.
- Altitude terrain via Open-Meteo/Copernicus DEM.
- Panneau d'informations : centre de carte, position utilisateur, zoom, pitch, cap, vitesse, précision, altitude appareil, altitude terrain et statut de géolocalisation.
- Contrôles : me localiser, activer/désactiver la topo, activer/désactiver les bâtiments, plein écran.
- Interface responsive desktop et mobile.

## Stack

- Next.js App Router
- TypeScript
- React
- MapLibre GL JS
- OpenFreeMap
- OpenTopoMap
- Open-Meteo Elevation API
- CSS global sans bibliothèque UI lourde

## Installation

Prérequis recommandé : Node.js 22. Next.js reste compatible avec Node.js 20.9 ou plus récent.

```bash
npm install
```

## Configuration

Le projet ne nécessite pas de clé API pour afficher la carte par défaut.

Vous pouvez créer un fichier `.env.local` si vous ajoutez plus tard des services privés, mais la version open-source actuelle fonctionne sans variable d'environnement.

```bash
cp .env.local.example .env.local
```

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
4. Lancez le déploiement.

Le fichier `vercel.json` indique explicitement que le framework est Next.js. Vercel détecte ensuite les commandes standard du projet.

## Déploiement GitHub Pages

Un workflow GitHub Actions est fourni dans `.github/workflows/deploy-github-pages.yml`.

Pour publier l'application sur `https://gaspardlevchin.github.io/ORRA-Scan/` :

1. Dans GitHub, ouvrez `Settings` > `Pages`.
2. Dans `Build and deployment`, sélectionnez `GitHub Actions`.
3. Poussez la branche `main`, ou lancez manuellement le workflow `Deploy GitHub Pages`.

GitHub Pages sert l'application depuis le sous-chemin `/ORRA-Scan`. La configuration Next.js applique donc `basePath` et `assetPrefix` uniquement quand le build est lancé avec `GITHUB_PAGES=true`.

## Géolocalisation, localhost et HTTPS

Les navigateurs n'autorisent la géolocalisation que dans des contextes sécurisés. Elle fonctionne donc :

- en local via `localhost` ;
- en production via HTTPS.

Vercel et GitHub Pages fournissent HTTPS en production, ce qui permet à la géolocalisation de fonctionner après déploiement si l'utilisateur l'autorise.

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
  elevation.ts
  geolocation.ts
  open-maps.ts
types/
  map.ts
```

## Notes de maintenance

- `components/MapView.tsx` contient l'orchestration MapLibre, la géolocalisation et les interactions de carte.
- `lib/open-maps.ts` regroupe les styles et couches open source.
- `lib/elevation.ts` isole les appels Open-Meteo/Copernicus DEM.
- `lib/geolocation.ts` isole l'accès au navigateur et les messages d'erreur.
- `types/map.ts` centralise les types partagés par l'interface.

## Attributions

Les données et tuiles utilisées imposent une attribution visible. MapLibre affiche l'attribution fournie par les styles et les sources, notamment OpenStreetMap, OpenFreeMap, OpenMapTiles, OpenTopoMap et Open-Meteo/Copernicus lorsque l'altitude est utilisée.
