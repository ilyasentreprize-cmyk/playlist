// POST /api/taste/artists — Étape 2a : enregistre les artistes choisis.
// Minimum 5 artistes (vérifié aussi côté serveur, pas seulement dans l'UI).
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { json, apiError, getParticipant } from "@/lib/api";

const MIN_ARTISTS = 5;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { participantId, token, artists } = body ?? {};
    if (!Array.isArray(artists)) return apiError("Liste d'artistes invalide.", 400);
    if (artists.length < MIN_ARTISTS) {
      return apiError(`Sélectionne au moins ${MIN_ARTISTS} artistes.`, 400);
    }

    const supabase = getSupabaseAdmin();
    const participant = await getParticipant(supabase, participantId, token);
    if (!participant) return apiError("Participant non autorisé.", 403);

    // On remplace l'ensemble (l'utilisateur peut revenir en arrière).
    await supabase.from("participant_artists").delete().eq("participant_id", participant.id);

    const rows = artists.map((a: { id: string; name: string; picture?: string | null }) => ({
      session_id: participant.session_id,
      participant_id: participant.id,
      deezer_artist_id: String(a.id),
      artist_name: a.name,
      picture: a.picture ?? null,
    }));
    const { error } = await supabase.from("participant_artists").insert(rows);
    if (error) throw error;

    return json({ ok: true, count: rows.length });
  } catch (e) {
    console.error("POST /api/taste/artists", e);
    return apiError("Erreur serveur lors de l'enregistrement des artistes.", 500);
  }
}
