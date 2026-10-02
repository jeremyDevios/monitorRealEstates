# Suivi immobilier

Site privé de suivi d'annonces immobilières Leboncoin : archivage local complet (photos, description, prix, surfaces), suivi du statut en ligne/hors ligne, étiquettes, discussion par annonce et (bientôt) détection de doublons.

## Prérequis

- Node.js ≥ 20.9
- npm

## Démarrage

1. `npm install`
2. Créer `.env.local` à partir de `.env.example` et renseigner `SESSION_SECRET` (ex. `openssl rand -hex 32`)
3. `npm run db:generate` puis `npm run db:migrate` (ou simplement lancer l'app : les migrations s'appliquent au démarrage)
4. Créer un compte : `npm run create-user -- <identifiant> [--admin]` — le mot de passe est demandé de façon masquée
5. `npm run dev` puis ouvrir http://localhost:3000

## Commandes

| Commande | Rôle |
| --- | --- |
| `npm run dev` | serveur de développement |
| `npm run build` puis `npm start` | production |
| `npm run create-user -- <identifiant> [--admin]` | crée un compte (seule voie d'inscription) |
| `npm run check-listings` | vérifie le statut de toutes les annonces (aussi planifié automatiquement en production) |
| `npm run db:generate` / `npm run db:migrate` | migrations Drizzle |

Les données restent sur le serveur et **survivent aux redémarrages** : base SQLite dans `data/app.db` (WAL, durable), photos dans `public/photos/`, profils navigateur (cookies anti-bot) dans `data/browser-profile/`. Rien n'est réinitialisé au démarrage — les migrations sont incrémentales.

> Lancer l'app **depuis la racine du projet** (`npm run dev` / `npm start`). Pour un service lancé avec un autre répertoire de travail (launchd, systemd…), définir `DATA_DIR` en chemin absolu : la base sera lue/écrite là où elle est, sinon une base vide serait créée ailleurs.

## Déploiement — Debian 12 / Orange Pi (ARM64)

Chromium (Playwright) a des builds officiels `linux-arm64` : la récupération Leboncoin fonctionne sur Orange Pi. Sur un serveur sans écran, la navigation se fait automatiquement en headless (le mode « avec fenêtre » est réservé aux machines avec affichage, comme le Mac de dev).

1. **Node.js ≥ 20.9** (Debian 12 fournit Node 18) :
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
   sudo apt install -y nodejs git
   ```
2. **Cloner et installer** :
   ```bash
   git clone <ce-dépôt> /opt/monitor-real-estates
   cd /opt/monitor-real-estates
   npm install
   # si npm demande : approuver les scripts natifs (better-sqlite3, esbuild…)
   npm approve-scripts better-sqlite3 esbuild unrs-resolver
   ```
   Si better-sqlite3 n'a pas de binaire précompilé (rare), installer `build-essential python3` et relancer `npm rebuild better-sqlite3`.
3. **Chromium pour Playwright** (télécharge le build ARM64 + les bibliothèques système) :
   ```bash
   npx playwright install --with-deps chromium
   ```
   Prévoir ~1 Go de RAM libre pendant une navigation (une seule instance tourne à la fois).
4. **Configuration** :
   ```bash
   echo "SESSION_SECRET=$(openssl rand -hex 32)" > .env.local
   # optionnel : DATA_DIR=/chemin/absolu, CHECK_CRON, RATES_CRON (voir .env.example)
   ```
5. **Base + premier compte** :
   ```bash
   npm run db:migrate
   npm run create-user -- <identifiant> [--admin]
   ```
6. **Build et démarrage** : `npm run build && npm start` — en production (`npm start`), les jobs périodiques (vérifications des annonces, taux quotidiens) sont actifs.

Service systemd (redémarrage automatique au boot) — `/etc/systemd/system/monitor-real-estates.service` :
```ini
[Unit]
Description=Suivi immobilier
After=network.target

[Service]
WorkingDirectory=/opt/monitor-real-estates
Environment=DATA_DIR=/opt/monitor-real-estates/data
Environment=PORT=3000
ExecStart=/usr/bin/npm start
Restart=always
User=<ton-utilisateur>

[Install]
WantedBy=multi-user.target
```
```bash
sudo systemctl enable --now monitor-real-estates
```

**Sans écran, un captcha ne peut pas être résolu à la main** : si Leboncoin en affiche un pendant une vérification, elle sera « non concluante », le cooldown s'appliquera, et la saisie manuelle reste le secours (comme sur le poste de dev).
