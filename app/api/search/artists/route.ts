// GET /api/search/artists?q= — Étape 2a : recherche d'artistes (proxy Deezer).
import { searchArtists } from "@/lib/deezer";
import { json, apiError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  if (!q.trim()) return json({ artists: [] });
  try {
    const artists = await searchArtists(q);
    return json({ artists });
  } catch (e) {
    console.error("GET /api/search/artists", e);
    // Pas de fallback artiste fiable : on renvoie une erreur claire au client.
    return apiError("La recherche d'artistes est momentanément indisponible.", 502);
  }
}
