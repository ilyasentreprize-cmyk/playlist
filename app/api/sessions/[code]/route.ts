// GET /api/sessions/[code] — état d'un trajet + liste des participants
// (sans exposer les tokens). Renvoie 404 si inconnu, 410 si expiré.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { json, apiError, getSessionByCode } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { code: string } }) {
  try {
    const supabase = getSupabaseAdmin();
    const { session, expired } = await getSessionByCode(supabase, params.code);
    if (!session) return apiError("Trajet introuvable.", 404);
    if (expired) return apiError("Ce trajet a expiré.", 410);

    const { data: participants } = await supabase
      .from("participants")
      .select("id, name, is_creator, created_at")
      .eq("session_id", session.id)
      .order("created_at", { ascending: true });

    return json({ session, participants: participants ?? [] });
  } catch (e) {
    console.error("GET /api/sessions/[code]", e);
    return apiError("Erreur serveur.", 500);
  }
}
