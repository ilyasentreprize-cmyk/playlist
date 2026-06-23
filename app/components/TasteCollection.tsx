"use client";

import { useEffect, useRef, useState } from "react";
import AudioPreview from "./AudioPreview";
import type { ArtistResult, LocalIdentity } from "@/lib/types";

interface PoolTrack {
  id: string;
  title: string;
  artistName: string;
  artistId: string | null;
  cover: string | null;
  preview: string | null;
  origin: "selected" | "similar";
  sourceArtistId: string;
}

const MIN_ARTISTS = 5;
const BATCH_SIZE = 10;

export default function TasteCollection({
  identity,
  allowSkip,
  onDone,
}: {
  identity: LocalIdentity;
  allowSkip: boolean;
  onDone: () => void;
}) {
  const [phase, setPhase] = useState<"artists" | "tracks">("artists");

  // ---- Étape 2a : artistes ----
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ArtistResult[]>([]);
  const [selected, setSelected] = useState<ArtistResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Recommandations dynamiques
  const [reco, setReco] = useState<ArtistResult[]>([]);
  const recoDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Charge les recommandations — au mount (rap) puis à chaque changement de sélection
  function loadReco(sel: ArtistResult[]) {
    if (recoDebounceRef.current) clearTimeout(recoDebounceRef.current);
    recoDebounceRef.current = setTimeout(async () => {
      const selectedIds = sel.map((a) => a.id).join(",");
      const excludeIds = sel.map((a) => a.id).join(",");
      const params = new URLSearchParams();
      if (selectedIds) params.set("selectedIds", selectedIds);
      if (excludeIds) params.set("exclude", excludeIds);
      try {
        const res = await fetch(`/api/recommendations/artists?${params}`);
        const data = await res.json();
        // Filtre côté client aussi pour être sûr
        const selSet = new Set(sel.map((a) => a.id));
        setReco((data.artists ?? []).filter((a: ArtistResult) => !selSet.has(a.id)));
      } catch {
        /* silencieux : les reco sont un bonus */
      }
    }, 400);
  }

  // Chargement initial
  useEffect(() => { loadReco([]); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 2) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      setError(null);
      try {
        const res = await fetch(`/api/search/artists?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Recherche indisponible");
        setResults(data.artists ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur de recherche.");
      } finally {
        setSearching(false);
      }
    }, 300);
  }, [query]);

  function toggleArtist(a: ArtistResult) {
    setSelected((prev) => {
      const next = prev.some((x) => x.id === a.id)
        ? prev.filter((x) => x.id !== a.id)
        : [...prev, a];
      loadReco(next);
      return next;
    });
  }

  const [submitting, setSubmitting] = useState(false);
  async function submitArtists() {
    if (selected.length < MIN_ARTISTS) return setError(`Sélectionne au moins ${MIN_ARTISTS} artistes.`);
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/taste/artists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId: identity.participantId, token: identity.token, artists: selected }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur");
      await loadPool();
      setPhase("tracks");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur réseau.");
    } finally {
      setSubmitting(false);
    }
  }

  // ---- Étape 2b : like de sons ----
  const [pool, setPool] = useState<PoolTrack[]>([]);
  const [batchOffset, setBatchOffset] = useState(0);
  const [liked, setLiked] = useState<Record<string, PoolTrack>>({});
  const [poolError, setPoolError] = useState<string | null>(null);

  // Recherche de morceaux dans l'étape 2b
  const [trackQuery, setTrackQuery] = useState("");
  const [trackResults, setTrackResults] = useState<PoolTrack[]>([]);
  const [trackSearching, setTrackSearching] = useState(false);
  const trackDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (trackDebounceRef.current) clearTimeout(trackDebounceRef.current);
    const q = trackQuery.trim();
    if (q.length < 2) { setTrackResults([]); return; }
    trackDebounceRef.current = setTimeout(async () => {
      setTrackSearching(true);
      try {
        const res = await fetch(`/api/search/tracks?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        const tracks: PoolTrack[] = (data.tracks ?? []).map((t: { id: string; title: string; artistName: string; artistId: string | null; cover: string | null; preview: string | null }) => ({
          ...t,
          origin: "selected" as const,
          sourceArtistId: t.artistId ?? "",
        }));
        setTrackResults(tracks);
      } catch {
        setTrackResults([]);
      } finally {
        setTrackSearching(false);
      }
    }, 300);
  }, [trackQuery]);

  async function loadPool() {
    setPoolError(null);
    try {
      const res = await fetch(`/api/pool?participantId=${identity.participantId}&token=${identity.token}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Pool indisponible");
      setPool(data.tracks ?? []);
    } catch (e) {
      setPoolError(e instanceof Error ? e.message : "Erreur réseau.");
    }
  }

  function toggleLike(t: PoolTrack) {
    setLiked((prev) => {
      const next = { ...prev };
      if (next[t.id]) delete next[t.id];
      else next[t.id] = t;
      return next;
    });
  }

  const [finishing, setFinishing] = useState(false);
  async function finishTracks() {
    setFinishing(true);
    try {
      const likedTracks = Object.values(liked).map((t) => ({
        id: t.id, title: t.title, artistName: t.artistName,
        artistId: t.artistId, cover: t.cover, preview: t.preview,
        origin: t.origin, sourceArtistId: t.sourceArtistId,
      }));
      const res = await fetch("/api/taste/tracks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId: identity.participantId, token: identity.token, likedTracks }),
      });
      if (!res.ok) { const data = await res.json(); throw new Error(data.error ?? "Erreur"); }
      onDone();
    } catch (e) {
      setPoolError(e instanceof Error ? e.message : "Erreur réseau.");
      setFinishing(false);
    }
  }

  // ============================ Rendu ============================

  if (phase === "artists") {
    return (
      <div className="stack">
        <div>
          <h2>Tes artistes préférés</h2>
          <p className="muted">Choisis-en au moins {MIN_ARTISTS}. Ça nous donne le signal de départ.</p>
        </div>

        {allowSkip && (
          <button className="btn ghost" onClick={onDone}>Passer et voter directement →</button>
        )}

        <input
          className="input"
          placeholder="Rechercher un artiste…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />

        {error && <div className="error-box">{error}</div>}

        {selected.length > 0 && (
          <div className="row" style={{ flexWrap: "wrap" }}>
            {selected.map((a) => (
              <span className="pill" key={a.id} onClick={() => toggleArtist(a)}>{a.name} ✕</span>
            ))}
          </div>
        )}

        {/* Recommandations dynamiques */}
        {reco.length > 0 && query.trim().length < 2 && (
          <div className="stack">
            <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
              {selected.length === 0 ? "🎤 Suggestions rap" : "🎯 Artistes similaires à tes choix"}
            </p>
            {reco.map((a) => (
              <div key={a.id} className="list-item selectable" onClick={() => toggleArtist(a)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="thumb" src={a.picture ?? ""} alt="" />
                <div className="grow ellipsis">{a.name}</div>
                <div>+</div>
              </div>
            ))}
          </div>
        )}

        {/* Résultats de recherche */}
        <div className="stack">
          {searching && <p className="muted">Recherche…</p>}
          {results.map((a) => {
            const isSel = selected.some((x) => x.id === a.id);
            return (
              <div key={a.id} className={`list-item selectable ${isSel ? "selected" : ""}`} onClick={() => toggleArtist(a)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="thumb" src={a.picture ?? ""} alt="" />
                <div className="grow ellipsis">{a.name}</div>
                <div>{isSel ? "✓" : "+"}</div>
              </div>
            );
          })}
        </div>

        <div className="row" style={{ position: "sticky", bottom: 0, paddingTop: 8 }}>
          <button className="btn" onClick={submitArtists} disabled={submitting}>
            {submitting ? "Chargement…" : `Continuer (${selected.length}/${MIN_ARTISTS})`}
          </button>
        </div>
      </div>
    );
  }

  // phase === "tracks"
  const visible = pool.slice(batchOffset, batchOffset + BATCH_SIZE);
  const likedCount = Object.keys(liked).length;

  const poolIds = new Set(pool.map((t) => t.id));
  const filteredSearchResults = trackResults.filter((t) => !poolIds.has(t.id));

  function TrackCard({ t }: { t: PoolTrack }) {
    const isLiked = !!liked[t.id];
    return (
      <div
        className={`track-card${isLiked ? " liked" : ""}`}
        onClick={() => toggleLike(t)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="track-card__cover" src={t.cover ?? ""} alt="" />
        <div className="track-card__body">
          <div className="track-card__title">{t.title}</div>
          <div className="track-card__artist">{t.artistName}</div>
          <div className="track-card__actions">
            <span className="track-card__heart">{isLiked ? "❤️" : "🤍"}</span>
            <div onClick={(e) => e.stopPropagation()}>
              <AudioPreview preview={t.preview} title={t.title} artist={t.artistName} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="stack">
      <div>
        <h2>Like les sons que tu aimes</h2>
        <p className="muted">Tape sur une carte pour liker, ▶ pour écouter.</p>
      </div>

      <input
        className="input"
        placeholder="🔍 Chercher un titre ou artiste…"
        value={trackQuery}
        onChange={(e) => setTrackQuery(e.target.value)}
      />

      {poolError && <div className="error-box">{poolError}</div>}

      {(trackSearching || filteredSearchResults.length > 0) && (
        <div className="stack">
          <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>Résultats de recherche</p>
          {trackSearching && <p className="muted">Recherche…</p>}
          <div className="track-grid">
            {filteredSearchResults.map((t) => <TrackCard key={t.id} t={t} />)}
          </div>
        </div>
      )}

      <p className="muted" style={{ fontSize: "0.85rem", margin: 0 }}>
        Suggestions · page {Math.floor(batchOffset / BATCH_SIZE) + 1}/{Math.ceil(pool.length / BATCH_SIZE) || 1}
      </p>
      <div className="track-grid">
        {visible.map((t) => <TrackCard key={t.id} t={t} />)}
      </div>

      {pool.length > BATCH_SIZE && (
        <div className="row">
          <button
            className="btn secondary"
            style={{ flex: 1 }}
            onClick={() => setBatchOffset((o) => Math.max(0, o - BATCH_SIZE))}
            disabled={batchOffset === 0}
          >
            ← Précédents
          </button>
          <button
            className="btn secondary"
            style={{ flex: 1 }}
            onClick={() => setBatchOffset((o) => Math.min(pool.length - BATCH_SIZE, o + BATCH_SIZE))}
            disabled={batchOffset + BATCH_SIZE >= pool.length}
          >
            Suivants →
          </button>
        </div>
      )}

      <button className="btn" onClick={finishTracks} disabled={finishing}>
        {finishing ? "Enregistrement…" : `✅ J'ai fini${likedCount > 0 ? ` · ${likedCount} ❤️` : ""}`}
      </button>
    </div>
  );
}
