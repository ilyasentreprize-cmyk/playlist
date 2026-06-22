// fetch avec timeout — toute requête externe (Deezer/iTunes) doit l'utiliser
// pour ne jamais bloquer indéfiniment une route API.

export const EXTERNAL_TIMEOUT_MS = 8000;

export async function fetchWithTimeout(
  url: string,
  timeoutMs: number = EXTERNAL_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "playlist-collective/0.1" },
    });
  } finally {
    clearTimeout(timer);
  }
}
