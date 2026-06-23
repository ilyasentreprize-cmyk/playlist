"use client";

import { useMemo, useState } from "react";
import AudioPreview from "./AudioPreview";
import { computeFinalResult, type CandidateTally } from "@/lib/scoring";
import type { Candidate, CandidateVote } from "@/lib/types";

export default function FinalPlaylist({
  code,
  candidates,
  votes,
}: {
  code: string;
  candidates: Candidate[];
  votes: CandidateVote[];
}) {
  const [copied, setCopied] = useState(false);
  const [copiedExport, setCopiedExport] = useState(false);

  const { result, byId } = useMemo(() => {
    const likes = new Map<string, number>();
    const dislikes = new Map<string, number>();
    const voters = new Set<string>();
    for (const v of votes) {
      voters.add(v.participant_id);
      const map = v.value === 1 ? likes : dislikes;
      map.set(v.candidate_id, (map.get(v.candidate_id) ?? 0) + 1);
    }
    const tallies: CandidateTally[] = candidates.map((c) => ({
      candidateId: c.id,
      title: c.title,
      artistName: c.artist_name,
      likes: likes.get(c.id) ?? 0,
      dislikes: dislikes.get(c.id) ?? 0,
    }));
    const byId = new Map(candidates.map((c) => [c.id, c]));
    const n = Math.max(voters.size, 1);
    return { result: computeFinalResult(tallies, n), byId };
  }, [candidates, votes]);

  function copyToClipboard() {
    const text = result.kept
      .map((item, idx) => `${idx + 1}. ${item.title} — ${item.artistName}`)
      .join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  function exportAndOpen(url: string) {
    const text = result.kept
      .map((item) => `${item.title} - ${item.artistName}`)
      .join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopiedExport(true);
      setTimeout(() => setCopiedExport(false), 4000);
      window.open(url, "_blank", "noopener,noreferrer");
    });
  }

  return (
    <div className="stack">
      <div className="center">
        <div style={{ fontSize: 40 }}>🎉</div>
        <h1 style={{ marginBottom: 2 }}>Votre playlist</h1>
        <p className="muted">Trajet {code} · triée par consensus</p>
      </div>

      {result.kept.length === 0 ? (
        <div className="card center stack">
          <div style={{ fontSize: 36 }}>🤷</div>
          <h2 style={{ margin: 0 }}>Aucun morceau ne fait l'unanimité</h2>
          <p className="muted">
            Tous les candidats ont été trop rejetés (seuil : {result.threshold} dislike
            {result.threshold > 1 ? "s" : ""}). Relancez un trajet ou ajoutez des morceaux que tout le monde accepte.
          </p>
        </div>
      ) : (
        <>
          {/* Liste de la playlist */}
          <div className="stack">
            {result.kept.map((item, idx) => {
              const c = byId.get(item.candidateId);
              if (!c) return null;
              return (
                <div className="list-item" key={item.candidateId}>
                  <div className="badge-rank">{idx + 1}</div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="thumb lg" src={c.cover ?? ""} alt="" />
                  <div className="grow">
                    <div className="ellipsis">{c.title}</div>
                    <div className="muted ellipsis" style={{ fontSize: "0.85rem" }}>{c.artist_name}</div>
                    <div className="muted" style={{ fontSize: "0.78rem" }}>👍 {item.likes} · 👎 {item.dislikes}</div>
                  </div>
                  <AudioPreview preview={c.preview} title={c.title} artist={c.artist_name} />
                </div>
              );
            })}
          </div>

          {/* Actions d'export */}
          <div className="stack">
            <button className="btn secondary" onClick={copyToClipboard}>
              {copied ? "✅ Copié !" : "📋 Copier la liste (texte)"}
            </button>

            <div className="card stack">
              <p style={{ margin: 0, fontWeight: 600, fontSize: "0.95rem" }}>Créer la playlist en 2 clics</p>
              <p className="muted" style={{ fontSize: "0.82rem", margin: 0 }}>
                Clique sur un service → la liste est copiée automatiquement → colle-la dans le champ texte du site → ta playlist est créée sur Spotify, Deezer ou Apple Music.
              </p>
              {copiedExport && (
                <div className="success-box" style={{ fontSize: "0.85rem" }}>
                  ✅ Liste copiée ! Colle-la dans le champ texte du site qui vient de s'ouvrir.
                </div>
              )}
              <div className="row">
                <button
                  className="btn"
                  style={{ background: "linear-gradient(135deg, #1DB954, #158a3e)", flex: 1 }}
                  onClick={() => exportAndOpen("https://www.tunemymusic.com/fr/transfer")}
                >
                  Spotify / Deezer
                </button>
                <button
                  className="btn secondary"
                  style={{ flex: 1 }}
                  onClick={() => exportAndOpen("https://soundiiz.com/standalone/txt-to-spotify")}
                >
                  Soundiiz
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {result.excluded.length > 0 && (
        <p className="muted center" style={{ fontSize: "0.8rem" }}>
          {result.excluded.length} morceau{result.excluded.length > 1 ? "x" : ""} écarté
          {result.excluded.length > 1 ? "s" : ""} par le vote.
        </p>
      )}
    </div>
  );
}
