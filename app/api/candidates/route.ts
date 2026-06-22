// POST /api/candidates — Étape 4 : ajout manuel d'un morceau à la liste candidate.
// Le morceau entre dans le vote au même titre que les morceaux générés
// (pas de passe-droit). On trace qui l'a proposé (added_by).
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { json, apiError, getParticipant, getSessionByCode } from "@/lib/api";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { code, participantId, token, track } = body ?? {};
    if (!track?.id || !track?.title) return apiError("Morceau invalide.", 400);

    const supabase = getSupabaseAdmin();
    const participant = await getParticipant(supabase, participantId, token);
    if (!participant) return apiError("Participant non autorisé.", 403);

    const { session, expired } = await getSessionByCode(supabase, String(code ?? ""));
    if (!session) return apiError("Trajet introuvable.", 404);
    if (expired) return apiError("Ce trajet a expiré.", 410);
    if (session.id !== participant.session_id) return apiError("Trajet incohérent.", 400);
    // L'ajout n'est possible que pendant la phase de vote.
    if (session.status !== "voting") {
      return apiError("L'ajout de morceaux n'est ouvert que pendant le vote.", 409);
    }

    const { data: candidate, error } = await supabase
      .from("candidates")
      .upsert(
        {
          session_id: session.id,
          deezer_track_id: String(track.id),
          title: track.title,
          artist_name: track.artistName ?? "Artiste inconnu",
          cover: track.cover ?? null,
          preview: track.preview ?? null,
          gen_score: 0,
          source: "manual",
          added_by: participant.id,
        },
        { onConflict: "session_id,deezer_track_id", ignoreDuplicates: true }
      )
      .select("*")
      .maybeSingle();
    if (error) throw error;

    // candidate null = le morceau était déjà dans la liste (doublon ignoré).
    return json({ ok: true, candidate, duplicate: !candidate });
  } catch (e) {
    console.error("POST /api/candidates", e);
    return apiError("Erreur serveur lors de l'ajout du morceau.", 500);
  }
}
