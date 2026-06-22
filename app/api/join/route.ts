// POST /api/join — Étape 2 : rejoindre un trajet avec un pseudo (pas de compte).
// Autorisé en 'lobby' ET en 'voting' (retardataire). Refusé si 'finished'.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { json, apiError, getSessionByCode } from "@/lib/api";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const code = String(body?.code ?? "").trim().toUpperCase();
    const name = String(body?.name ?? "").trim();
    if (!code) return apiError("Code de trajet manquant.", 400);
    if (!name) return apiError("Un pseudo est requis.", 400);

    const supabase = getSupabaseAdmin();
    const { session, expired } = await getSessionByCode(supabase, code);
    if (!session) return apiError("Trajet introuvable.", 404);
    if (expired) return apiError("Ce trajet a expiré.", 410);
    if (session.status === "finished") {
      return apiError("Ce trajet est terminé, impossible de le rejoindre.", 409);
    }

    const { data: participant, error } = await supabase
      .from("participants")
      .insert({ session_id: session.id, name })
      .select("id, name, is_creator, token")
      .single();
    if (error || !participant) throw error ?? new Error("participant non créé");

    return json({
      session,
      // `lateJoiner` = a rejoint alors que le vote est déjà en cours : l'étape 2
      // (goûts) devient optionnelle pour lui, il peut voter directement.
      lateJoiner: session.status === "voting",
      identity: {
        participantId: participant.id,
        token: participant.token,
        name: participant.name,
        isCreator: false,
      },
    });
  } catch (e) {
    console.error("POST /api/join", e);
    return apiError("Erreur serveur lors de la jointure.", 500);
  }
}
