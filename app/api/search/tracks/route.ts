// GET /api/search/tracks?q= — recherche de morceaux (étape 4, ajout manuel).
// Deezer en priorité, iTunes en fallback si Deezer échoue.
import { searchTracks } from "@/lib/deezer";
import { itunesSearchTracks } from "@/lib/itunes";
import { json } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  if (!q.trim()) return json({ tracks: [], source: "none" });

  try {
    const tracks = await searchTracks(q);
    if (tracks.length > 0) return json({ tracks, source: "deezer" });
  } catch (e) {
    console.error("search/tracks deezer", e);
  }

  // Fallback iTunes (Deezer vide ou en erreur).
  try {
    const tracks = await itunesSearchTracks(q);
    return json({ tracks, source: "itunes" });
  } catch (e) {
    console.error("search/tracks itunes", e);
    return json({ tracks: [], source: "error" }, 200);
  }
}
