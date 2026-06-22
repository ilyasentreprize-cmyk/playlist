import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Client serveur (clé service_role). Bypass RLS : utilisé UNIQUEMENT dans les
// routes API pour les écritures validées côté serveur. Ne jamais importer ce
// module dans du code client.
let serverClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (serverClient) return serverClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Variables Supabase serveur manquantes : NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  serverClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return serverClient;
}
