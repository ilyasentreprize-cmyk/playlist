// Types partagés entre le client et les routes API.

export type SessionStatus = "lobby" | "voting" | "finished";

export interface Session {
  id: string;
  code: string;
  status: SessionStatus;
  created_at: string;
  expires_at: string;
}

export interface Participant {
  id: string;
  session_id: string;
  name: string;
  is_creator: boolean;
  created_at: string;
}

// Identité locale stockée dans le navigateur (localStorage) après create/join.
// `token` est secret et n'est jamais affiché aux autres participants.
export interface LocalIdentity {
  participantId: string;
  token: string;
  name: string;
  isCreator: boolean;
}

// Résultat normalisé d'une recherche d'artiste (Deezer).
export interface ArtistResult {
  id: string;
  name: string;
  picture: string | null;
}

// Résultat normalisé d'un morceau (Deezer ou iTunes), forme commune à toute l'app.
export interface TrackResult {
  id: string; // id Deezer, ou "itunes:<trackId>" en fallback
  title: string;
  artistName: string;
  artistId: string | null;
  cover: string | null;
  preview: string | null; // URL extrait 30s, peut être null
}

export interface Candidate {
  id: string;
  session_id: string;
  deezer_track_id: string;
  title: string;
  artist_name: string;
  cover: string | null;
  preview: string | null;
  gen_score: number;
  source: "generated" | "manual";
  added_by: string | null;
  created_at: string;
}

export interface CandidateVote {
  id: string;
  session_id: string;
  candidate_id: string;
  participant_id: string;
  value: 1 | -1;
}
