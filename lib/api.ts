// Helpers communs aux routes API : réponses JSON normalisées + autorisation
// d'un participant via son token secret (stocké côté navigateur).

import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function apiError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

// Vérifie qu'un participant existe et que son token correspond.
// Renvoie la ligne participant, ou null si invalide.
export async function getParticipant(
  supabase: SupabaseClient,
  participantId: string,
  token: string
): Promise<{ id: string; session_id: string; is_creator: boolean; name: string } | null> {
  if (!participantId || !token) return null;
  const { data, error } = await supabase
    .from("participants")
    .select("id, session_id, is_creator, name, token")
    .eq("id", participantId)
    .single();
  if (error || !data) return null;
  if (data.token !== token) return null;
  return {
    id: data.id,
    session_id: data.session_id,
    is_creator: data.is_creator,
    name: data.name,
  };
}

// Charge une session par code et vérifie qu'elle n'est pas expirée.
export async function getSessionByCode(supabase: SupabaseClient, code: string) {
  const { data, error } = await supabase
    .from("sessions")
    .select("id, code, status, created_at, expires_at")
    .eq("code", code.toUpperCase())
    .single();
  if (error || !data) return { session: null, expired: false };
  const expired = new Date(data.expires_at).getTime() < Date.now();
  return { session: data, expired };
}
