# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Présentation

Site web privé de monitoring d'annonces immobilières Leboncoin, utilisé par un petit groupe d'utilisateurs (famille/amis). Chaque annonce ajoutée est archivée intégralement en local (photos, description, prix, surfaces, localisation) et son statut en ligne/hors ligne est suivi dans le temps. L'interface et la documentation sont en français. Thème sombre unique, design moderne type dashboard.

## Stack technique

- Next.js (App Router) + TypeScript + Tailwind CSS, composants UI maison (`components/ui.tsx`).
- SQLite via Drizzle ORM (driver better-sqlite3) — aucune base externe.
- Photos stockées sur disque sous `public/photos/`, servies par Next.js.
- Auth maison : session par cookie signé, mots de passe hashés (bcrypt). Pas de bibliothèque d'auth externe.
- Scraping Leboncoin : fetch + cheerio, dans un module isolé. Vérification des statuts par job périodique côté serveur (node-cron via `instrumentation.ts`).

## Architecture

- `app/(protected)/` — pages protégées :
  - `/` — Résumé : tuiles de statistiques, meilleurs taux, capacité d'emprunt, dernières annonces.
  - `/listings` — table complète des annonces (filtres, tri, pagination, vignettes, notes).
  - `/listings/[id]` — fiche annonce : galerie, vote 1–5 étoiles, historique des vérifications, discussion, suppression.
  - `/listings/new` — ajout par URL Leboncoin ou saisie manuelle.
  - `/credit` — taux du marché (actualisation quotidienne + bouton manuel), top 5 des taux, simulateur temps réel (budget mensuel, apport, durée, prix visé, assurance, frais de notaire), gestion des taux saisis à la main.
  - `/settings` — paramètres d'emprunt **communs à tous les utilisateurs** (en lecture, ajustables dans Crédit) + étiquettes.
- `lib/db/` — schéma Drizzle, migrations, instance `db`.
- `lib/auth/` — sessions signées HMAC, `requireUser()`.
- `lib/lbc/` — scraping Leboncoin : récupération navigateur Playwright et parseur multi-stratégies. Module fragile : tout échec de parsing doit aboutir à une saisie manuelle, jamais à une annonce partielle silencieuse.
- `lib/status/` — vérification des statuts : `runCheckPass()` (script + cron), `checkListingNow()`.
- `lib/rates/` — taux de crédit : `market.ts` (CSV du taux officiel Banque de France republié par eco3min), `banks.ts` (baromètre MoneyVox : banques en ligne avec taux par durée), `refresh.ts` (garde « une fois par jour », lignes `source = market` et `source = web`, liens `source_url` de vérification, **instantané quotidien dans `rate_history`** + rétro-remplissage du marché sur 4 mois via la série officielle).
- `lib/actions/` — actions serveur (`"use server"`) : auth, listings, comments, labels, ratings, credit.
- `lib/credit.ts` — mathématiques de crédit (facteur d'annuité, capacité, mensualité, intérêts, frais de notaire ~7,5 %) ; `lib/stats.ts` — baisses de prix et moyennes de notes.
- `scripts/` — `create-user.ts`, `check-listings.ts` (tournent avec tsx, imports `@/` résolus via tsconfig paths).
- `data/` — base SQLite (hors git) ; photos sous `public/photos/` (hors git).

## Règles métier

- La création de comptes se fait **uniquement** via `npm run create-user`. Aucune page, route ou API ne doit permettre de créer un compte depuis le navigateur.
- Une annonce sauvegardée est un snapshot : photos, description et données sont servies depuis le disque local, jamais depuis Leboncoin.
- Chaque annonce porte l'utilisateur qui l'a enregistrée et une étiquette (définie dans Configuration).
- Vote par annonce : chaque utilisateur donne une note de 1 à 5 étoiles (une seule note par utilisateur, modifiable). La liste se trie par note moyenne.
- Les paramètres de crédit (revenus, charges, apport, taux d'endettement, durée) sont **globaux** : une seule ligne `app_settings` (id = 1), partagée par tous les utilisateurs.
- Le statut d'une annonce est le résultat du dernier point de contrôle concluant ; l'historique des prix est conservé pour repérer les baisses (badge −X €).
- Espace partagé : tous les utilisateurs voient l'ensemble des annonces et discussions.
- Un 403/429 de Leboncoin est « non concluant » : il ne change jamais le statut d'une annonce.
- La suppression d'une annonce se fait depuis sa fiche : les lignes liées partent en cascade et les photos sont retirées du disque.

## Contraintes scraping

- Leboncoin est derrière DataDome : un simple `fetch` reçoit un défi JS (403). La récupération passe par un **vrai navigateur Playwright** (`lib/lbc/fetch.ts`) : Chromium complet (pas le headless shell, qui est détecté), profil persistant sous `data/browser-profile/` pour conserver le cookie du défi entre les requêtes.
- Deux profils : headless pour le job périodique, **avec fenêtre** pour les actions déclenchées depuis le navigateur (`headed: true`) — l'utilisateur peut résoudre un captcha à la main s'il apparaît. Sur un serveur sans affichage (Orange Pi, VPS), `ensureBrowserContext` retombe automatiquement en headless. Chromium Playwright a des builds officiels linux-arm64 : voir le guide de déploiement Debian 12 dans le README.
- Un défi non résolu (interstitiel qui traîne, ou captcha) = **non concluant** : le statut de l'annonce ne change jamais dans ce cas.
- **Restriction d'accès** (« Accès temporairement restreint ») : détectée par `RESTRICTION_MARKERS` dans `lib/status/checker.ts`. Elle pose un cooldown (`app_settings.lbcRestrictedUntil`, 12 h, escalade 24 h) pendant lequel **aucune requête** n'est envoyée : la passe cron est annulée, « Vérifier maintenant » note un différé, l'ajout par URL refuse sans ouvrir de navigateur. Un bandeau l'annonce sur les fiches. C'est le seul moyen de laisser le ban se lever — ne pas contourner.
- **Méthode API interne (clé extraite de l'app mobile) : hors périmètre, ne pas implémenter.** Utiliser une clé non délivrée à l'utilisateur contre le service de production d'un tiers est une limite ferme, même à la demande de l'utilisateur. La seule voie légitime reste le navigateur réel + cooldown, la saisie manuelle, ou une API commerciale de scraping si le besoin devient sérieux.
- Ne jamais marteler : si les vérifications enchaînent les 403, la protection monte en captcha puis en restriction, et se calme seulement après une période sans requête.
- Le job de vérification respecte au moins 1 h entre deux passages sur une même annonce.

## Schéma de données (tables principales)

- `users` (identifiant, hash mot de passe, rôle admin)
- `labels` (étiquettes)
- `listings` (url, titre, description, prix, m² habitables, m² jardin, pièces, ville, code postal, statut, fourchette prix/m², label, créé par, dates)
- `listing_checks` (points de contrôle : date, en ligne, concluant, prix constaté, note)
- `photos` (chemin fichier, ordre)
- `comments` (discussion par annonce)
- `ratings` (vote 1–5 par utilisateur et par annonce, index unique)
- `rates` (taux de crédit : organisme, taux, durée — nullable = toutes durées, source `manual`/`market`/`web`, `source_url` pour vérifier)
- `rate_history` (instantané quotidien des taux pour le graphique d'évolution — la page Crédit affiche 4 mois, composant Recharts `components/rate-chart.tsx` ; palette catégorielle sombre validée contre la surface `#12161a`, couleurs fixes par banque)
- `app_settings` (paramètres d'emprunt communs : budget mensuel, apport, durée, date de dernière actualisation des taux — une seule ligne id = 1)

**Piège Drizzle** : les relations `many()` exigent une relation `one()` inverse définie sur la table cible, sinon erreur « not enough information to infer relation ». Toutes les tables ont donc leurs relations définies dans `lib/db/schema.ts`.

## Persistance

Toutes les données sont sur disque et **survivent aux redémarrages** : `data/app.db` (SQLite WAL), `public/photos/`, `data/browser-profile/` (cookies du défi anti-bot). Les chemins passent par `lib/paths.ts` : répertoire de lancement par défaut (toujours démarrer depuis la racine du projet), `DATA_DIR` en absolu pour un service, répertoire temporaire pendant le build Turbopack. Les verrous Chromium (`Singleton*`) laissés par un arrêt brutal sont nettoyés au lancement. Les migrations Drizzle sont incrémentales — jamais de réinitialisation au démarrage.

## Phase 2 — détection de doublons

Approche par heuristiques : candidats comparés sur ville, surface (± tolérance), prix (± tolérance), nombre de pièces ; les doublons probables sont présentés à un humain pour validation avant fusion.

## Conventions

- UI et documentation en français (apostrophe typographique ’ dans les textes JSX : la règle ESLint `react/no-unescaped-entities` refuse `'`) ; code, noms de fichiers et de symboles en anglais.
- Messages de commit en français.
- Pas de `db.query` sur `with` sans les relations inverses (voir piège ci-dessus).

## État d'avancement

- Livré : auth, résumé, annonces (filtres/tri/vignettes), ajout par URL ou manuel, photos, vérifications de statut (manuelles + cron), baisses de prix, votes 1–5 étoiles, étiquettes, discussion, suppression d'annonce, page crédit (taux officiel quotidien + baromètre MoneyVox + top 5 + simulateur temps réel + liens de vérification), configuration commune.
- Reste à faire : détection de doublons (phase 2, heuristiques).
- Le parseur `lib/lbc/parse.ts` n'a jamais été calibré sur une vraie page Leboncoin (la récupération bute sur le défi DataDome tant que la protection est en mode captcha) : dès qu'une vraie page passe, vérifier les stratégies (`findAdObject`/`fromAdObject`) avec le HTML réel.

## Commandes

- `npm run dev` — serveur de développement (un seul à la fois : Next 16 pose un verrou par projet).
- `npm run create-user -- <identifiant> [--admin]` — crée un compte (seule voie d'inscription) ; le mot de passe est demandé de façon masquée.
- `npm run check-listings` — lance une passe de vérification des statuts (aussi exécutée périodiquement).
- `npm run db:generate` / `npm run db:migrate` — migrations Drizzle.
