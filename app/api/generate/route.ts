// POST /api/generate — Étape 3 : le créateur déclenche la génération.
// Croise les goûts de TOUS les participants (fonction pure generateCandidates),
// insère les candidats et fait passer la session en 'voting'.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { json, apiError, getParticipant, getSessionByCode } from "@/lib/api";
import { generateCandidates, type TrackLikeInput, type ArtistLikeInput } from "@/lib/scoring";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { code, participantId, token } = body ?? {};

    const supabase = getSupabaseAdmin();
    const participant = await getParticipant(supabase, participantId, token);
    if (!participant) return apiError("Participant non autorisé.", 403);
    if (!participant.is_creator) {
      return apiError("Seul le créateur peut lancer la génération.", 403);
    }

    const { session, expired } = await getSessionByCode(supabase, String(code ?? ""));
    if (!session) return apiError("Trajet introuvable.", 404);
    if (expired) return apiError("Ce trajet a expiré.", 410);
    if (session.id !== participant.session_id) return apiError("Trajet incohérent.", 400);

    // Idempotence : si déjà généré, on ne régénère pas (les retardataires ne
    // doivent pas relancer la génération).
    if (session.status !== "lobby") {
      return json({ ok: true, alreadyGenerated: true, status: session.status });
    }

    // Récupère tous les signaux de la session.
    const [{ data: trackRows }, { data: artistRows }] = await Promise.all([
      supabase
        .from("participant_track_likes")
        .select("participant_id, deezer_track_id, title, artist_name, artist_id, cover, preview")
        .eq("session_id", session.id),
      supabase
        .from("participant_artists")
        .select("participant_id, deezer_artist_id")
        .eq("session_id", session.id),
    ]);

    const trackLikes: TrackLikeInput[] = (trackRows ?? []).map((r) => ({
      participantId: r.participant_id,
      trackId: r.deezer_track_id,
      title: r.title,
      artistName: r.artist_name,
      artistId: r.artist_id,
      cover: r.cover,
      preview: r.preview,
    }));
    const artistLikes: ArtistLikeInput[] = (artistRows ?? []).map((r) => ({
      participantId: r.participant_id,
      artistId: r.deezer_artist_id,
    }));

    const candidates = generateCandidates(trackLikes, artistLikes);

    if (candidates.length > 0) {
      const rows = candidates.map((c) => ({
        session_id: session.id,
        deezer_track_id: c.trackId,
        title: c.title,
        artist_name: c.artistName,
        cover: c.cover,
        preview: c.preview,
        gen_score: c.score,
        source: "generated" as const,
      }));
      const { error } = await supabase
        .from("candidates")
        .upsert(rows, { onConflict: "session_id,deezer_track_id" });
      if (error) throw error;
    }

    // Passe en phase de vote.
    const { error: upErr } = await supabase
      .from("sessions")
      .update({ status: "voting" })
      .eq("id", session.id);
    if (upErr) throw upErr;

    return json({ ok: true, count: candidates.length });
  } catch (e) {
    console.error("POST /api/generate", e);
    return apiError("Erreur serveur lors de la génération.", 500);
  }
}
