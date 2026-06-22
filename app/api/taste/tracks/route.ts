// POST /api/taste/tracks — Étape 2b : enregistre les morceaux likés dans le pool.
// Appelé de façon incrémentale (à chaque lot ou à "j'ai fini"). Upsert : on
// peut renvoyer la liste complète des likes sans créer de doublons.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { json, apiError, getParticipant } from "@/lib/api";

interface IncomingLike {
  id: string;
  title: string;
  artistName: string;
  artistId?: string | null;
  cover?: string | null;
  preview?: string | null;
  origin?: "selected" | "similar";
  sourceArtistId?: string | null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { participantId, token, likedTracks } = body ?? {};
    if (!Array.isArray(likedTracks)) return apiError("Liste de morceaux invalide.", 400);

    const supabase = getSupabaseAdmin();
    const participant = await getParticipant(supabase, participantId, token);
    if (!participant) return apiError("Participant non autorisé.", 403);

    if (likedTracks.length === 0) return json({ ok: true, count: 0 });

    const rows = (likedTracks as IncomingLike[]).map((t) => ({
      session_id: participant.session_id,
      participant_id: participant.id,
      deezer_track_id: String(t.id),
      title: t.title,
      artist_name: t.artistName,
      artist_id: t.artistId ?? null,
      cover: t.cover ?? null,
      preview: t.preview ?? null,
      origin: t.origin ?? "selected",
      source_artist_id: t.sourceArtistId ?? null,
    }));

    // upsert sur (participant_id, deezer_track_id) -> idempotent.
    const { error } = await supabase
      .from("participant_track_likes")
      .upsert(rows, { onConflict: "participant_id,deezer_track_id" });
    if (error) throw error;

    return json({ ok: true, count: rows.length });
  } catch (e) {
    console.error("POST /api/taste/tracks", e);
    return apiError("Erreur serveur lors de l'enregistrement des likes.", 500);
  }
}
