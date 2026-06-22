// GET /api/preview?title=&artist= — Fallback extrait 30s via iTunes.
// Utilisé en étapes 5 et 7 quand un morceau n'a pas de preview Deezer.
// Renvoie { preview: string | null } — null = aucun extrait, l'UI désactive le play.
import { itunesPreviewFor } from "@/lib/itunes";
import { json } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const title = url.searchParams.get("title") ?? "";
  const artist = url.searchParams.get("artist") ?? "";
  if (!title.trim()) return json({ preview: null });
  try {
    const preview = await itunesPreviewFor(title, artist);
    return json({ preview });
  } catch (e) {
    console.error("GET /api/preview", e);
    // Jamais bloquant : on renvoie null, l'UI gère l'absence d'extrait.
    return json({ preview: null });
  }
}
