"use client";

import { useEffect, useRef, useState } from "react";
import type { LocalIdentity, TrackResult } from "@/lib/types";

// Étape 4 : recherche Deezer/iTunes pour ajouter un morceau à la liste candidate.
export default function TrackSearchAdd({
  code,
  identity,
  onAdded,
}: {
  code: string;
  identity: LocalIdentity;
  onAdded: (msg: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TrackResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      setError(null);
      try {
        const res = await fetch(`/api/search/tracks?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setResults(data.tracks ?? []);
      } catch {
        setError("Recherche indisponible.");
      } finally {
        setSearching(false);
      }
    }, 300);
  }, [query]);

  async function add(track: TrackResult) {
    try {
      const res = await fetch("/api/candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          participantId: identity.participantId,
          token: identity.token,
          track,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur");
      onAdded(data.duplicate ? "Déjà dans la liste." : `« ${track.title} » ajouté.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur réseau.");
    }
  }

  return (
    <div className="stack">
      <input
        className="input"
        placeholder="Rechercher un morceau à ajouter…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
      />
      {error && <div className="error-box">{error}</div>}
      {searching && <p className="muted">Recherche…</p>}
      {results.map((t) => (
        <div key={t.id} className="list-item">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="thumb" src={t.cover ?? ""} alt="" />
          <div className="grow">
            <div className="ellipsis">{t.title}</div>
            <div className="muted ellipsis" style={{ fontSize: "0.85rem" }}>
              {t.artistName}
            </div>
          </div>
          <button className="icon-btn" onClick={() => add(t)} aria-label="Ajouter">
            +
          </button>
        </div>
      ))}
    </div>
  );
}
