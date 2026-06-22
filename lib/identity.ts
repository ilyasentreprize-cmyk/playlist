"use client";

import type { LocalIdentity } from "./types";

// Persistance de l'identité (pseudo + token) par code de trajet, dans le
// navigateur. Pas de compte : c'est ce token qui ré-identifie le participant.

const keyFor = (code: string) => `playlist:identity:${code.toUpperCase()}`;

export function saveIdentity(code: string, identity: LocalIdentity): void {
  try {
    localStorage.setItem(keyFor(code), JSON.stringify(identity));
  } catch {
    /* localStorage indisponible (navigation privée stricte) : on ignore */
  }
}

export function loadIdentity(code: string): LocalIdentity | null {
  try {
    const raw = localStorage.getItem(keyFor(code));
    return raw ? (JSON.parse(raw) as LocalIdentity) : null;
  } catch {
    return null;
  }
}

export function clearIdentity(code: string): void {
  try {
    localStorage.removeItem(keyFor(code));
  } catch {
    /* ignore */
  }
}
