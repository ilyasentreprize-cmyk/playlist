// Fallback iTunes Search API — SERVEUR. Gratuit, sans authentification.
// Sert à récupérer un extrait 30s quand Deezer n'en a pas, et (en secours)
// à chercher des morceaux si Deezer est indisponible.

import { fetchWithTimeout } from "./http";
import type { TrackResult } from "./types";

const BASE = "https://itunes.apple.com/search";

interface ItunesTrack {
  trackId: number;
  trackName?: string;
  artistName?: string;
  artistId?: number;
  artworkUrl100?: string;
  previewUrl?: string;
}

interface ItunesResponse {
  resultCount: number;
  results: ItunesTrack[];
}

async function itunesSearch(term: string, limit: number): Promise<ItunesTrack[]> {
  const q = encodeURIComponent(term.trim());
  if (!q) return [];
  const url = `${BASE}?term=${q}&media=music&entity=song&limit=${limit}`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`iTunes a renvoyé ${res.status}`);
  const json = (await res.json()) as ItunesResponse;
  return json.results ?? [];
}

function mapItunes(t: ItunesTrack): TrackResult {
  return {
    id: `itunes:${t.trackId}`,
    title: t.trackName ?? "Titre inconnu",
    artistName: t.artistName ?? "Artiste inconnu",
    artistId: t.artistId ? `itunes:${t.artistId}` : null,
    // Pochette en meilleure résolution que la 100x100 par défaut.
    cover: t.artworkUrl100 ? t.artworkUrl100.replace("100x100", "300x300") : null,
    preview: t.previewUrl ?? null,
  };
}

export async function itunesSearchTracks(query: string, limit = 10): Promise<TrackResult[]> {
  const results = await itunesSearch(query, limit);
  return results.map(mapItunes);
}

// Cherche un extrait 30s pour un couple (titre, artiste) donné.
// Renvoie l'URL du preview, ou null si rien de probant.
export async function itunesPreviewFor(
  title: string,
  artistName: string
): Promise<string | null> {
  const results = await itunesSearch(`${artistName} ${title}`, 3);
  const withPreview = results.find((r) => r.previewUrl);
  return withPreview?.previewUrl ?? null;
}
