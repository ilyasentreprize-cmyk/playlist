"use client";

import { useEffect, useRef, useState } from "react";
import AudioPreview from "./AudioPreview";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Close,
  CloseCircle,
  MusicNote,
  Plus,
  Search,
} from "./Icon";
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

  // ------------------------ Phase 1 : artistes ------------------------
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ArtistResult[]>([]);
  const [selected, setSelected] = useState<ArtistResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [reco, setReco] = useState<ArtistResult[]>([]);
  const recoDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Recommandations : rap au départ, puis artistes proches des choix faits.
  function loadReco(sel: ArtistResult[]) {
    if (recoDebounceRef.current) clearTimeout(recoDebounceRef.current);
    recoDebounceRef.current = setTimeout(async () => {
      const ids = sel.map((a) => a.id).join(",");
      const params = new URLSearchParams();
      if (ids) {
        params.set("selectedIds", ids);
        params.set("exclude", ids);
      }
      try {
        const res = await fetch(`/api/recommendations/artists?${params}`);
        const data = await res.json();
        const selSet = new Set(sel.map((a) => a.id));
        setReco((data.artists ?? []).filter((a: ArtistResult) => !selSet.has(a.id)));
      } catch {
        /* silencieux : les suggestions sont un bonus */
      }
    }, 400);
  }

  useEffect(() => {
    loadReco([]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (selected.length < MIN_ARTISTS)
      return setError(`Choisis au moins ${MIN_ARTISTS} artistes.`);
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/taste/artists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantId: identity.participantId,
          token: identity.token,
          artists: selected,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur");
      await loadPool();
      setPhase("tracks");
      window.scrollTo(0, 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur réseau.");
    } finally {
      setSubmitting(false);
    }
  }

  // -------------------------- Phase 2 : sons --------------------------
  const [pool, setPool] = useState<PoolTrack[]>([]);
  const [batchOffset, setBatchOffset] = useState(0);
  const [liked, setLiked] = useState<Record<string, PoolTrack>>({});
  const [poolError, setPoolError] = useState<string | null>(null);

  const [trackQuery, setTrackQuery] = useState("");
  const [trackResults, setTrackResults] = useState<PoolTrack[]>([]);
  const [trackSearching, setTrackSearching] = useState(false);
  const trackDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (trackDebounceRef.current) clearTimeout(trackDebounceRef.current);
    const q = trackQuery.trim();
    if (q.length < 2) {
      setTrackResults([]);
      return;
    }
    trackDebounceRef.current = setTimeout(async () => {
      setTrackSearching(true);
      try {
        const res = await fetch(`/api/search/tracks?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        const tracks: PoolTrack[] = (data.tracks ?? []).map(
          (t: {
            id: string;
            title: string;
            artistName: string;
            artistId: string | null;
            cover: string | null;
            preview: string | null;
          }) => ({ ...t, origin: "selected" as const, sourceArtistId: t.artistId ?? "" })
        );
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
      const res = await fetch(
        `/api/pool?participantId=${identity.participantId}&token=${identity.token}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Suggestions indisponibles");
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
        id: t.id,
        title: t.title,
        artistName: t.artistName,
        artistId: t.artistId,
        cover: t.cover,
        preview: t.preview,
        origin: t.origin,
        sourceArtistId: t.sourceArtistId,
      }));
      const res = await fetch("/api/taste/tracks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantId: identity.participantId,
          token: identity.token,
          likedTracks,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Erreur");
      }
      onDone();
    } catch (e) {
      setPoolError(e instanceof Error ? e.message : "Erreur réseau.");
      setFinishing(false);
    }
  }

  // ============================== Rendu ==============================

  if (phase === "artists") {
    const searchingActive = query.trim().length >= 2;

    return (
      <div>
        <nav className="nav">
          <div className="nav__side" />
          <span className="nav__title">Artistes</span>
          <div className="nav__side nav__side--right">
            {allowSkip && (
              <button className="nav-btn" onClick={onDone}>
                Passer
              </button>
            )}
          </div>
        </nav>

        <div className="stack-lg" style={{ paddingTop: 12 }}>
          <div className="stack-sm">
            <h1 className="title-lg">Tes artistes</h1>
            <p className="subhead secondary">
              Choisis-en au moins {MIN_ARTISTS}. Ils servent de point de départ pour
              les suggestions du groupe.
            </p>
          </div>

          <div className="search">
            <span className="search__icon">
              <Search size={17} />
            </span>
            <input
              className="search__input"
              placeholder="Rechercher un artiste"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
            />
            {query && (
              <button
                className="search__clear"
                onClick={() => setQuery("")}
                aria-label="Effacer"
              >
                <CloseCircle size={17} />
              </button>
            )}
          </div>

          {error && <div className="notice notice--error">{error}</div>}

          {selected.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {selected.map((a) => (
                <button className="chip" key={a.id} onClick={() => toggleArtist(a)}>
                  {a.name}
                  <span className="chip__x">
                    <Close size={13} />
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Suggestions, masquées pendant une recherche */}
          {!searchingActive && reco.length > 0 && (
            <div className="stack-sm">
              <p className="section-header">
                {selected.length === 0 ? "Suggestions" : "Dans le même esprit"}
              </p>
              <div className="group">
                {reco.map((a) => (
                  <ArtistRow key={a.id} artist={a} selected={false} onToggle={toggleArtist} />
                ))}
              </div>
            </div>
          )}

          {/* Résultats de recherche */}
          {searchingActive && (
            <div className="stack-sm">
              <p className="section-header">Résultats</p>
              {searching && results.length === 0 ? (
                <div className="empty">
                  <span className="spinner" />
                </div>
              ) : results.length === 0 ? (
                <div className="empty">
                  <p className="subhead">Aucun artiste trouvé</p>
                </div>
              ) : (
                <div className="group">
                  {results.map((a) => (
                    <ArtistRow
                      key={a.id}
                      artist={a}
                      selected={selected.some((x) => x.id === a.id)}
                      onToggle={toggleArtist}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="footer-actions">
          <button
            className="btn"
            onClick={submitArtists}
            disabled={submitting || selected.length < MIN_ARTISTS}
          >
            {submitting
              ? "Chargement…"
              : selected.length < MIN_ARTISTS
              ? `Continuer · ${selected.length}/${MIN_ARTISTS}`
              : "Continuer"}
          </button>
        </div>
      </div>
    );
  }

  // ------------------------------ Sons ------------------------------
  const visible = pool.slice(batchOffset, batchOffset + BATCH_SIZE);
  const likedCount = Object.keys(liked).length;
  const page = Math.floor(batchOffset / BATCH_SIZE) + 1;
  const pageCount = Math.max(1, Math.ceil(pool.length / BATCH_SIZE));

  const poolIds = new Set(pool.map((t) => t.id));
  const searchHits = trackResults.filter((t) => !poolIds.has(t.id));
  const searchingTracks = trackQuery.trim().length >= 2;

  function Tile({ t }: { t: PoolTrack }) {
    const on = !!liked[t.id];
    return (
      <div
        className={`tile${on ? " tile--on" : ""}`}
        onClick={() => toggleLike(t)}
        role="button"
        tabIndex={0}
        aria-pressed={on}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleLike(t);
          }
        }}
      >
        <div className="tile__art">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={t.cover ?? ""} alt="" />
          <span className="tile__check">
            <Check size={14} />
          </span>
          <AudioPreview
            preview={t.preview}
            title={t.title}
            artist={t.artistName}
            variant="overlay"
          />
        </div>
        <div>
          <div className="tile__title truncate">{t.title}</div>
          <div className="tile__artist truncate">{t.artistName}</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <nav className="nav">
        <div className="nav__side">
          <button className="nav-btn" onClick={() => setPhase("artists")}>
            <ChevronLeft size={22} />
            Artistes
          </button>
        </div>
        <span className="nav__title">Sons</span>
        <div className="nav__side nav__side--right" />
      </nav>

      <div className="stack-lg" style={{ paddingTop: 12 }}>
        <div className="stack-sm">
          <h1 className="title-lg">Tes sons</h1>
          <p className="subhead secondary">
            Touche une pochette pour la retenir. Le bouton lecture fait écouter
            trente secondes.
          </p>
        </div>

        <div className="search">
          <span className="search__icon">
            <Search size={17} />
          </span>
          <input
            className="search__input"
            placeholder="Rechercher un titre"
            value={trackQuery}
            onChange={(e) => setTrackQuery(e.target.value)}
            autoComplete="off"
          />
          {trackQuery && (
            <button
              className="search__clear"
              onClick={() => setTrackQuery("")}
              aria-label="Effacer"
            >
              <CloseCircle size={17} />
            </button>
          )}
        </div>

        {poolError && <div className="notice notice--error">{poolError}</div>}

        {searchingTracks && (
          <div className="stack-sm">
            <p className="section-header section-header--flush">Résultats</p>
            {trackSearching && searchHits.length === 0 ? (
              <div className="empty">
                <span className="spinner" />
              </div>
            ) : searchHits.length === 0 ? (
              <div className="empty">
                <p className="subhead">Aucun titre trouvé</p>
              </div>
            ) : (
              <div className="grid">
                {searchHits.map((t) => (
                  <Tile key={t.id} t={t} />
                ))}
              </div>
            )}
          </div>
        )}

        <div className="stack-sm">
          <p className="section-header section-header--flush">Suggestions</p>
          {pool.length === 0 ? (
            <div className="empty">
              <span className="empty__icon">
                <MusicNote size={30} />
              </span>
              <p className="subhead">Aucune suggestion pour l’instant</p>
            </div>
          ) : (
            <div className="grid">
              {visible.map((t) => (
                <Tile key={t.id} t={t} />
              ))}
            </div>
          )}
        </div>

        {pool.length > BATCH_SIZE && (
          <div
            className="hstack"
            style={{ justifyContent: "space-between", padding: "0 4px" }}
          >
            <button
              className="icon-btn"
              onClick={() => setBatchOffset((o) => Math.max(0, o - BATCH_SIZE))}
              disabled={batchOffset === 0}
              aria-label="Suggestions précédentes"
            >
              <ChevronLeft size={17} />
            </button>
            <span className="footnote secondary tabular">
              {page} sur {pageCount}
            </span>
            <button
              className="icon-btn"
              onClick={() =>
                setBatchOffset((o) => Math.min(pool.length - BATCH_SIZE, o + BATCH_SIZE))
              }
              disabled={batchOffset + BATCH_SIZE >= pool.length}
              aria-label="Suggestions suivantes"
            >
              <ChevronRight size={17} />
            </button>
          </div>
        )}
      </div>

      <div className="footer-actions">
        <button className="btn" onClick={finishTracks} disabled={finishing}>
          {finishing
            ? "Enregistrement…"
            : likedCount === 0
            ? "Terminer"
            : `Terminer · ${likedCount} son${likedCount > 1 ? "s" : ""}`}
        </button>
      </div>
    </div>
  );
}

// Ligne d'artiste : pochette ronde, nom, état de sélection à droite.
function ArtistRow({
  artist,
  selected,
  onToggle,
}: {
  artist: ArtistResult;
  selected: boolean;
  onToggle: (a: ArtistResult) => void;
}) {
  return (
    <button
      className="row row--tappable row--full"
      onClick={() => onToggle(artist)}
      aria-pressed={selected}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="artwork artwork--sm artwork--circle" src={artist.picture ?? ""} alt="" />
      <span className="grow truncate">{artist.name}</span>
      <span className={selected ? "tint" : "tertiary"} style={{ display: "flex" }}>
        {selected ? <Check size={20} /> : <Plus size={20} />}
      </span>
    </button>
  );
}
