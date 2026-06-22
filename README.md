# 🎵 Playlist Collective

Web app pour créer **ensemble**, en quelques minutes avant un trajet en voiture, une
playlist qui plaît à **tout le monde** — pas juste à celui qui tient l’aux.

- Sans compte, sans Spotify, sans abonnement.
- Données musicales via l’**API Deezer** (publique, sans auth) + **iTunes Search API**
  en fallback pour les extraits 30 s.
- Temps réel via **Supabase Realtime**.
- Mobile-first : chacun scanne un QR code avec son téléphone.

---

## 1. Prérequis

- **Node.js ≥ 18** (testé sur Node 24).
- Un projet **Supabase** gratuit (https://supabase.com).

## 2. Configuration de la base Supabase

1. Crée un projet sur Supabase.
2. Ouvre **SQL Editor** et exécute le contenu de [`supabase/schema.sql`](supabase/schema.sql).
   Cela crée les tables, active la Row Level Security (lecture seule pour la clé
   publique, écritures réservées au serveur) et expose les tables au Realtime.
3. (Optionnel) Pour purger automatiquement les sessions expirées (> 24 h) :
   active l’extension **pg_cron** (Database → Extensions) puis décommente le bloc
   `cron.schedule(...)` en bas de `schema.sql`.

## 3. Variables d’environnement

Copie `.env.local.example` en **`.env.local`** (jamais commité) et remplis :

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...      # clé "anon public"
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...          # clé "service_role" — SECRÈTE
```

Les deux clés se trouvent dans **Project Settings → API**.

> ⚠️ La clé `service_role` contourne la sécurité RLS. Elle n’est utilisée que
> côté serveur (routes API) et ne doit **jamais** être préfixée par `NEXT_PUBLIC_`
> ni exposée au navigateur.

## 4. Lancer en local

```bash
npm install
npm run dev
```

Ouvre http://localhost:3000.

> Pour tester le flow multi-participants en local, ouvre plusieurs onglets /
> fenêtres privées, ou utilise ton IP locale (ex. `http://192.168.x.x:3000`) sur
> ton téléphone (même réseau Wi-Fi).

## 5. Tests de la logique de scoring

La logique de l’algorithme (génération + seuil d’exclusion) est isolée dans
[`lib/scoring.ts`](lib/scoring.ts) sous forme de **fonctions pures** testées :

```bash
npm test
```

## 6. Déploiement sur Vercel

1. Pousse le projet sur un dépôt Git (GitHub/GitLab).
   > Le dossier de l’app est `playlist-app/`. Si ton repo contient d’autres
   > projets, configure le **Root Directory** sur `playlist-app` dans Vercel.
2. Sur https://vercel.com → **New Project** → importe le repo.
3. Dans **Settings → Environment Variables**, ajoute les 3 variables ci-dessus
   (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`).
4. Déploie. Aucune configuration supplémentaire : les appels Deezer passent par les
   API routes Next.js (proxy serveur, obligatoire car Deezer bloque le CORS navigateur).

---

## Architecture

```
playlist-app/
├── supabase/schema.sql        # Schéma + RLS + Realtime
├── lib/
│   ├── scoring.ts             # ⭐ Logique de scoring (fonctions PURES, testables)
│   ├── scoring.test.ts        # Tests unitaires du scoring
│   ├── deezer.ts              # Client API Deezer (serveur uniquement)
│   ├── itunes.ts              # Fallback iTunes (serveur)
│   ├── http.ts                # fetch avec timeout
│   ├── supabase/{client,server}.ts
│   ├── api.ts                 # Helpers routes (JSON, auth participant)
│   ├── code.ts, identity.ts, types.ts
├── app/
│   ├── page.tsx               # Étape 1 : accueil (créer / rejoindre)
│   ├── join/[code]/page.tsx   # Étape 2 : pseudo
│   ├── trip/[code]/page.tsx   # Hub temps réel (aiguille les phases 1→7)
│   ├── components/            # TasteCollection, Lobby, VoteRoom, FinalPlaylist…
│   └── api/                   # Routes serveur (proxy Deezer/iTunes + écritures)
```

### Le flow (7 étapes)

| Étape | Écran / route | Détail |
|------|----------------|--------|
| 1 | `page.tsx` → `Lobby` | Création du trajet, code 4 car., QR code, salle d’attente temps réel |
| 2a | `TasteCollection` | Choix de ≥ 5 artistes (recherche Deezer) |
| 2b | `TasteCollection` | Like de sons (top tracks + artistes similaires), par lots de 10 |
| 3 | `/api/generate` | Croisement des goûts → liste candidate (consensus pondéré) |
| 4 | `TrackSearchAdd` | Ajout manuel d’un morceau (passe aussi par le vote) |
| 5 | `VoteRoom` | Swipe like/dislike + extrait 30 s + progression temps réel |
| 6 | `/api/finalize` + `computeFinalResult` | Exclusion si dislikes ≥ `ceil(N×0.4)`, tri par score net |
| 7 | `FinalPlaylist` | Playlist finale avec lecture des extraits |

### Décisions de design notables

- **Sécurité sans compte** : RLS activée, la clé publique ne peut que **lire**
  (nécessaire au Realtime). Toutes les écritures passent par les routes API avec
  la clé `service_role`, et chaque participant est authentifié par un **token secret**
  stocké dans son navigateur.
- **Scoring anti-« pic »** : le score d’un morceau est multiplié par un facteur de
  consensus croissant avec le nombre de personnes qui l’aiment, pour que « plusieurs
  qui aiment un peu » l’emporte sur « une seule qui adore ». Voir les constantes
  commentées dans `lib/scoring.ts`.
- **Seuil d’exclusion** : `ceil(N × 0.4)` où **N = participants ayant réellement
  voté** (figé au calcul du résultat), pour qu’un présent silencieux ne durcisse pas
  le seuil. Exemples : 2→1, 4-5→2, 6→3, 8→4.
- **Retardataire** : s’il rejoint pendant le vote, il ne relance pas la génération ;
  l’étape 2 (goûts) devient optionnelle (bouton « passer et voter directement »).
- **Extraits audio** : Deezer d’abord, iTunes en fallback, et si rien → le bouton play
  est désactivé mais le morceau reste votable (jamais bloquant).

## Limites connues / pistes

- L’API publique Deezer peut renvoyer des erreurs ponctuelles (rate limit, 403
  régionaux). Tous les appels ont un timeout et un fallback/erreur claire ; la
  recherche d’**artistes** (étape 2a) n’a pas de fallback (iTunes ne recherche pas
  d’artistes correctement) → message d’erreur explicite en cas d’indisponibilité.
- Pas de PWA / app native (web responsive uniquement, comme demandé).
