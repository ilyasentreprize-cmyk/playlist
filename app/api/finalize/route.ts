// POST /api/finalize — Étape 6 : le créateur clôt le vote.
// Ferme l'ajout manuel ET fige la session en 'finished'. Le calcul du résultat
// (seuil + tri) est fait à la lecture par la fonction pure computeFinalResult.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { json, apiError, getParticipant, getSessionByCode } from "@/lib/api";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { code, participantId, token } = body ?? {};

    const supabase = getSupabaseAdmin();
    const participant = await getParticipant(supabase, participantId, token);
    if (!participant) return apiError("Participant non autorisé.", 403);
    if (!participant.is_creator) {
      return apiError("Seul le créateur peut clôturer le vote.", 403);
    }

    const { session, expired } = await getSessionByCode(supabase, String(code ?? ""));
    if (!session) return apiError("Trajet introuvable.", 404);
    if (expired) return apiError("Ce trajet a expiré.", 410);
    if (session.id !== participant.session_id) return apiError("Trajet incohérent.", 400);

    const { error } = await supabase
      .from("sessions")
      .update({ status: "finished" })
      .eq("id", session.id);
    if (error) throw error;

    return json({ ok: true });
  } catch (e) {
    console.error("POST /api/finalize", e);
    return apiError("Erreur serveur lors de la clôture.", 500);
  }
}
