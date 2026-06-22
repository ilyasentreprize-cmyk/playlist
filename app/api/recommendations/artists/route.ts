// GET /api/recommendations/artists?selectedIds=id1,id2&exclude=id3,id4
// Renvoie 3 artistes recommandés :
//   - Sans sélection : top artistes rap/hip-hop (Deezer genre 116)
//   - Avec sélection : artistes similaires aux derniers choix (Deezer /related)
import { relatedArtists } from "@/lib/deezer";
import { fetchWithTimeout } from "@/lib/http";
import { json } from "@/lib/api";
import type { ArtistResult } from "@/lib/types";

export const dynamic = "force-dynamic";

const RAP_GENRE_ID = 116; // Rap/Hip-Hop sur Deezer

async function getRapArtists(): Promise<ArtistResult[]> {
  try {
    const res = await fetchWithTimeout(
      `https://api.deezer.com/genre/${RAP_GENRE_ID}/artists`
    );
    const data = await res.json();
    const artists = (data.data ?? []) as {
      id: number;
      name: string;
      picture_medium?: string;
      picture?: string;
    }[];
    return artists.map((a) => ({
      id: String(a.id),
      name: a.name,
      picture: a.picture_medium ?? a.picture ?? null,
    }));
  } catch {
    return [];
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const selectedIds = (url.searchParams.get("selectedIds") ?? "")
    .split(",")
    .filter(Boolean);
  const exclude = new Set(
    (url.searchParams.get("exclude") ?? "").split(",").filter(Boolean)
  );

  let candidates: ArtistResult[] = [];

  if (selectedIds.length === 0) {
    // Aucune sélection → top rap Deezer
    candidates = await getRapArtists();
  } else {
    // Artistes similaires aux 3 derniers choix (on prend le dernier en priorité)
    const toQuery = selectedIds.slice(-3).reverse();
    for (const id of toQuery) {
      try {
        const related = await relatedArtists(id, 10);
        candidates.push(...related);
        if (candidates.length >= 20) break;
      } catch {
        /* artiste indisponible, on continue */
      }
    }
    // Si pas assez de résultats similaires, compléter avec du rap
    if (candidates.length < 3) {
      const rap = await getRapArtists();
      candidates.push(...rap);
    }
  }

  // Dédoublonne, exclut les déjà sélectionnés et déjà affichés
  const seen = new Set<string>();
  const filtered: ArtistResult[] = [];
  for (const a of candidates) {
    if (!seen.has(a.id) && !exclude.has(a.id)) {
      seen.add(a.id);
      filtered.push(a);
    }
    if (filtered.length === 3) break;
  }

  return json({ artists: filtered });
}
