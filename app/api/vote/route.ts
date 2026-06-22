// POST /api/vote — Étape 5 : un participant vote +1 (like) ou -1 (dislike)
// sur un morceau. Upsert : un seul vote par (morceau, participant), modifiable.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { json, apiError, getParticipant } from "@/lib/api";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { participantId, token, candidateId, value } = body ?? {};
    if (value !== 1 && value !== -1) return apiError("Vote invalide (attendu +1 ou -1).", 400);
    if (!candidateId) return apiError("Morceau manquant.", 400);

    const supabase = getSupabaseAdmin();
    const participant = await getParticipant(supabase, participantId, token);
    if (!participant) return apiError("Participant non autorisé.", 403);

    // Vérifie que le candidat appartient bien à la session du participant.
    const { data: candidate } = await supabase
      .from("candidates")
      .select("id, session_id")
      .eq("id", candidateId)
      .single();
    if (!candidate || candidate.session_id !== participant.session_id) {
      return apiError("Morceau introuvable dans ce trajet.", 404);
    }

    const { error } = await supabase.from("candidate_votes").upsert(
      {
        session_id: participant.session_id,
        candidate_id: candidateId,
        participant_id: participant.id,
        value,
      },
      { onConflict: "candidate_id,participant_id" }
    );
    if (error) throw error;

    return json({ ok: true });
  } catch (e) {
    console.error("POST /api/vote", e);
    return apiError("Erreur serveur lors du vote.", 500);
  }
}
