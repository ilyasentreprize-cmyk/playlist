// POST /api/sessions — Étape 1 : créer un trajet + le participant créateur.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { generateCode } from "@/lib/code";
import { json, apiError } from "@/lib/api";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const name = String(body?.name ?? "").trim();
    if (!name) return apiError("Un pseudo est requis.", 400);

    const supabase = getSupabaseAdmin();

    // Génère un code unique (quelques tentatives en cas de collision improbable).
    let code = "";
    let sessionId: string | null = null;
    for (let attempt = 0; attempt < 6; attempt++) {
      code = generateCode();
      const { data, error } = await supabase
        .from("sessions")
        .insert({ code })
        .select("id")
        .single();
      if (!error && data) {
        sessionId = data.id;
        break;
      }
      // 23505 = violation d'unicité (collision de code) -> on réessaie.
      if (error && error.code !== "23505") {
        throw error;
      }
    }
    if (!sessionId) return apiError("Impossible de générer un code unique.", 500);

    const { data: participant, error: pErr } = await supabase
      .from("participants")
      .insert({ session_id: sessionId, name, is_creator: true })
      .select("id, name, is_creator, token")
      .single();
    if (pErr || !participant) throw pErr ?? new Error("participant non créé");

    return json({
      code,
      identity: {
        participantId: participant.id,
        token: participant.token,
        name: participant.name,
        isCreator: true,
      },
    });
  } catch (e) {
    console.error("POST /api/sessions", e);
    return apiError("Erreur serveur lors de la création du trajet.", 500);
  }
}
