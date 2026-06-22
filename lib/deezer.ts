// Accès à l'API publique Deezer — SERVEUR UNIQUEMENT (Deezer bloque le CORS
// navigateur). Toujours appelé depuis une route API Next.js.
// Endpoints publics utilisés : /search/artist, /search/track,
// /artist/{id}/top, /artist/{id}/related. Aucune authentification requise.

import { fetchWithTimeout } from "./http";
import type { ArtistResult, TrackResult } from "./types";

const BASE = "https://api.deezer.com";

interface DeezerArtist {
  id: number;
  name: string;
  picture_medium?: string;
  picture?: string;
}

interface DeezerTrack {
  id: number;
  title: string;
  preview?: string;
  artist?: { id: number; name: string };
  album?: { cover_medium?: string; cover?: string };
}

interface DeezerList<T> {
  data?: T[];
  error?: { type: string; message: string };
}

async function deezerGet<T>(path: string): Promise<DeezerList<T>> {
  const res = await fetchWithTimeout(`${BASE}${path}`);
  if (!res.ok) {
    throw new Error(`Deezer ${path} a renvoyé ${res.status}`);
  }
  const json = (await res.json()) as DeezerList<T>;
  // Deezer renvoie 200 avec un objet { error } en cas de rate limit / quota.
  if (json.error) {
    throw new Error(`Deezer error: ${json.error.message}`);
  }
  return json;
}

function mapArtist(a: DeezerArtist): ArtistResult {
  return {
    id: String(a.id),
    name: a.name,
    picture: a.picture_medium ?? a.picture ?? null,
  };
}

function mapTrack(t: DeezerTrack): TrackResult {
  return {
    id: String(t.id),
    title: t.title,
    artistName: t.artist?.name ?? "Artiste inconnu",
    artistId: t.artist ? String(t.artist.id) : null,
    cover: t.album?.cover_medium ?? t.album?.cover ?? null,
    preview: t.preview && t.preview.length > 0 ? t.preview : null,
  };
}

export async function searchArtists(query: string, limit = 8): Promise<ArtistResult[]> {
  const q = encodeURIComponent(query.trim());
  if (!q) return [];
  const json = await deezerGet<DeezerArtist>(`/search/artist?q=${q}&limit=${limit}`);
  return (json.data ?? []).map(mapArtist);
}

export async function searchTracks(query: string, limit = 10): Promise<TrackResult[]> {
  const q = encodeURIComponent(query.trim());
  if (!q) return [];
  const json = await deezerGet<DeezerTrack>(`/search/track?q=${q}&limit=${limit}`);
  return (json.data ?? []).map(mapTrack);
}

export async function topTracks(artistId: string, limit = 5): Promise<TrackResult[]> {
  const json = await deezerGet<DeezerTrack>(`/artist/${artistId}/top?limit=${limit}`);
  return (json.data ?? []).map(mapTrack);
}

export async function relatedArtists(artistId: string, limit = 6): Promise<ArtistResult[]> {
  const json = await deezerGet<DeezerArtist>(`/artist/${artistId}/related?limit=${limit}`);
  return (json.data ?? []).map(mapArtist);
}
