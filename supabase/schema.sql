-- =============================================================================
-- Playlist Collective — Schéma Supabase
-- =============================================================================
-- À exécuter dans Supabase > SQL Editor (une seule fois).
--
-- Modèle de sécurité :
--   * RLS activé sur toutes les tables.
--   * La clé "anon" (navigateur) a UNIQUEMENT le droit de SELECT — indispensable
--     pour que Supabase Realtime pousse les changements aux participants.
--   * TOUTES les écritures passent par les routes API Next.js qui utilisent la
--     clé "service_role" (bypass RLS). Le client ne peut donc jamais falsifier
--     un vote, un score, ni rejoindre une session inexistante.
-- =============================================================================

-- Extension pour gen_random_uuid()
create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- sessions : un trajet
-- -----------------------------------------------------------------------------
create table if not exists public.sessions (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,                 -- 4 caractères, dicté à l'oral
  status      text not null default 'lobby',        -- 'lobby' | 'voting' | 'finished'
  created_at  timestamptz not null default now(),
  -- Expiration : 24h après création. Purge via pg_cron (voir bas du fichier)
  -- + filtrage paresseux à la lecture côté API.
  expires_at  timestamptz not null default (now() + interval '24 hours'),
  constraint sessions_status_chk check (status in ('lobby', 'voting', 'finished'))
);

-- -----------------------------------------------------------------------------
-- participants : un membre d'un trajet (pas de compte, juste un pseudo)
-- -----------------------------------------------------------------------------
create table if not exists public.participants (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.sessions(id) on delete cascade,
  name        text not null,
  is_creator  boolean not null default false,
  -- Jeton secret renvoyé au navigateur (localStorage) pour ré-identifier le
  -- participant sur ses appels API ultérieurs. Jamais exposé aux autres clients
  -- (voir la policy SELECT qui n'expose pas cette colonne via une vue).
  token       text not null default encode(gen_random_bytes(16), 'hex'),
  created_at  timestamptz not null default now()
);
create index if not exists participants_session_idx on public.participants(session_id);

-- -----------------------------------------------------------------------------
-- participant_artists : artistes likés en étape 2a (signal FORT, déclaré)
-- -----------------------------------------------------------------------------
create table if not exists public.participant_artists (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references public.sessions(id) on delete cascade,
  participant_id  uuid not null references public.participants(id) on delete cascade,
  deezer_artist_id text not null,
  artist_name     text not null,
  picture         text,
  created_at      timestamptz not null default now(),
  unique (participant_id, deezer_artist_id)
);
create index if not exists participant_artists_session_idx on public.participant_artists(session_id);

-- -----------------------------------------------------------------------------
-- participant_track_likes : sons likés en étape 2b (signal LARGE, découverte)
-- Le pool inclut top tracks des artistes choisis ET d'artistes similaires.
-- source_artist_id = l'artiste sélectionné qui a fait remonter ce morceau
-- (utile au scoring pour distinguer "artiste déclaré" vs "artiste similaire").
-- -----------------------------------------------------------------------------
create table if not exists public.participant_track_likes (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references public.sessions(id) on delete cascade,
  participant_id  uuid not null references public.participants(id) on delete cascade,
  deezer_track_id text not null,
  title           text not null,
  artist_name     text not null,
  artist_id       text,
  cover           text,
  preview         text,
  -- 'selected' = top track d'un artiste choisi en 2a ; 'similar' = artiste proche
  origin          text not null default 'selected',
  source_artist_id text,
  created_at      timestamptz not null default now(),
  unique (participant_id, deezer_track_id)
);
create index if not exists track_likes_session_idx on public.participant_track_likes(session_id);

-- -----------------------------------------------------------------------------
-- candidates : playlist candidate (générée en étape 3 + ajouts manuels étape 4)
-- -----------------------------------------------------------------------------
create table if not exists public.candidates (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references public.sessions(id) on delete cascade,
  deezer_track_id text not null,
  title           text not null,
  artist_name     text not null,
  cover           text,
  preview         text,
  -- Score de génération (étape 3). 0 pour un ajout manuel.
  gen_score       numeric not null default 0,
  source          text not null default 'generated',  -- 'generated' | 'manual'
  -- null = généré automatiquement ; sinon le participant qui a proposé le morceau
  added_by        uuid references public.participants(id) on delete set null,
  created_at      timestamptz not null default now(),
  unique (session_id, deezer_track_id),
  constraint candidates_source_chk check (source in ('generated', 'manual'))
);
create index if not exists candidates_session_idx on public.candidates(session_id);

-- -----------------------------------------------------------------------------
-- candidate_votes : votes de validation (étape 5), +1 like / -1 dislike
-- -----------------------------------------------------------------------------
create table if not exists public.candidate_votes (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references public.sessions(id) on delete cascade,
  candidate_id    uuid not null references public.candidates(id) on delete cascade,
  participant_id  uuid not null references public.participants(id) on delete cascade,
  value           smallint not null,                 -- +1 ou -1
  created_at      timestamptz not null default now(),
  unique (candidate_id, participant_id),             -- un vote par personne / morceau
  constraint vote_value_chk check (value in (1, -1))
);
create index if not exists votes_session_idx on public.candidate_votes(session_id);
create index if not exists votes_candidate_idx on public.candidate_votes(candidate_id);

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.sessions               enable row level security;
alter table public.participants            enable row level security;
alter table public.participant_artists     enable row level security;
alter table public.participant_track_likes enable row level security;
alter table public.candidates              enable row level security;
alter table public.candidate_votes         enable row level security;

-- Lecture publique (anon) : nécessaire au Realtime. Aucune policy d'écriture
-- pour anon => insert/update/delete refusés par défaut. Les écritures se font
-- exclusivement via la clé service_role (qui bypass RLS) dans les routes API.
do $$
declare t text;
begin
  foreach t in array array[
    'sessions','participants','participant_artists',
    'participant_track_likes','candidates','candidate_votes'
  ]
  loop
    execute format(
      'drop policy if exists "anon_select_%1$s" on public.%1$I;', t
    );
    execute format(
      'create policy "anon_select_%1$s" on public.%1$I for select to anon, authenticated using (true);', t
    );
  end loop;
end $$;

-- =============================================================================
-- Realtime : exposer les tables au canal de réplication
-- =============================================================================
do $$
begin
  -- Ajoute chaque table à la publication realtime si pas déjà présente.
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'sessions') then
    alter publication supabase_realtime add table public.sessions;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'participants') then
    alter publication supabase_realtime add table public.participants;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'candidates') then
    alter publication supabase_realtime add table public.candidates;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'candidate_votes') then
    alter publication supabase_realtime add table public.candidate_votes;
  end if;
end $$;

-- =============================================================================
-- Purge des sessions expirées (optionnel mais recommandé)
-- Nécessite l'extension pg_cron (Supabase > Database > Extensions > pg_cron).
-- Décommenter après avoir activé pg_cron :
-- =============================================================================
-- select cron.schedule(
--   'purge-expired-sessions',
--   '0 * * * *',  -- toutes les heures
--   $$ delete from public.sessions where expires_at < now(); $$
-- );
