// GET /api/pool?participantId=&token= — Étape 2b : construit le pool de morceaux
// à liker à partir des artistes choisis en 2a.
// Pool = top tracks des artistes sélectionnés + top tracks d'artistes SIMILAIRES
// (Deezer /artist/{id}/related), pour capturer des goûts plus larges que la
// déclaration explicite. Mélangé et dédoublonné.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { topTracks, relatedArtists } from "@/lib/deezer";
import { json, apiError, getParticipant } from "@/lib/api";
import type { TrackResult } from "@/lib/types";

// Lit request.url (params) → route dynamique, jamais pré-rendue au build.
export const dynamic = "force-dynamic";

const TOP_PER_SELECTED = 4; // morceaux par artiste choisi
const RELATED_PER_ARTIST = 3; // nb d'artistes similaires explorés par artiste choisi
const TOP_PER_RELATED = 2; // morceaux par artiste similaire

interface PoolTrack extends TrackResult {
  origin: "selected" | "similar";
  sourceArtistId: string;
}

// Mélange Fisher-Yates (déterministe seulement dans l'ordre, pas le contenu).
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const participantId = url.searchParams.get("participantId") ?? "";
    const token = url.searchParams.get("token") ?? "";

    const supabase = getSupabaseAdmin();
    const participant = await getParticipant(supabase, participantId, token);
    if (!participant) return apiError("Participant non autorisé.", 403);

    const { data: selected } = await supabase
      .from("participant_artists")
      .select("deezer_artist_id")
      .eq("participant_id", participant.id);

    const selectedIds = (selected ?? []).map((r) => r.deezer_artist_id);
    if (selectedIds.length === 0) {
      return apiError("Aucun artiste sélectionné.", 400);
    }

    const pool = new Map<string, PoolTrack>();

    // Récupère en parallèle, mais on encapsule chaque appel pour qu'un échec
    // ponctuel (rate limit sur un artiste) ne fasse pas tomber tout le pool.
    await Promise.all(
      selectedIds.map(async (artistId) => {
        try {
          const tops = await topTracks(artistId, TOP_PER_SELECTED);
          for (const t of tops) {
            if (!pool.has(t.id)) {
              pool.set(t.id, { ...t, origin: "selected", sourceArtistId: artistId });
            }
          }
          const related = await relatedArtists(artistId, RELATED_PER_ARTIST);
          await Promise.all(
            related.map(async (ra) => {
              try {
                const rTops = await topTracks(ra.id, TOP_PER_RELATED);
                for (const t of rTops) {
                  if (!pool.has(t.id)) {
                    pool.set(t.id, { ...t, origin: "similar", sourceArtistId: artistId });
                  }
                }
              } catch {
                /* artiste similaire indisponible : on ignore */
              }
            })
          );
        } catch {
          /* artiste choisi indisponible : on ignore, le pool reste utilisable */
        }
      })
    );

    if (pool.size === 0) {
      return apiError("Impossible de construire un pool (API musicale indisponible).", 502);
    }

    return json({ tracks: shuffle([...pool.values()]) });
  } catch (e) {
    console.error("GET /api/pool", e);
    return apiError("Erreur serveur lors de la construction du pool.", 500);
  }
}
