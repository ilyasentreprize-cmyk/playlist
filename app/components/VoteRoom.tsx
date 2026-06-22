"use client";

import { useMemo, useState } from "react";
import AudioPreview from "./AudioPreview";
import TrackSearchAdd from "./TrackSearchAdd";
import type { Candidate, CandidateVote, LocalIdentity, Participant } from "@/lib/types";

// Étape 5 : validation par swipe. Un morceau à la fois, like (+1) / dislike (-1).
// Étape 4 (ajout manuel) accessible via un panneau. Progression temps réel.
export default function VoteRoom({
  code,
  identity,
  participants,
  candidates,
  votes,
  onFinalized,
}: {
  code: string;
  identity: LocalIdentity;
  participants: Participant[];
  candidates: Candidate[];
  votes: CandidateVote[];
  onFinalized: () => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  // Set des candidats déjà votés par moi.
  const myVoted = useMemo(() => {
    const s = new Set<string>();
    for (const v of votes) {
      if (v.participant_id === identity.participantId) s.add(v.candidate_id);
    }
    return s;
  }, [votes, identity.participantId]);

  // File des candidats restant à voter (ordre stable d'arrivée).
  const queue = useMemo(
    () => candidates.filter((c) => !myVoted.has(c.id)),
    [candidates, myVoted]
  );
  const current = queue[0];

  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of participants) m.set(p.id, p.name);
    return m;
  }, [participants]);

  async function vote(value: 1 | -1) {
    if (!current || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantId: identity.participantId,
          token: identity.token,
          candidateId: current.id,
          value,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Erreur");
      }
      // L'avancement réel vient du Realtime (votes) ; rien à faire de plus ici.
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur réseau.");
    } finally {
      setBusy(false);
    }
  }

  async function finalize() {
    setFinalizing(true);
    setError(null);
    try {
      const res = await fetch("/api/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          participantId: identity.participantId,
          token: identity.token,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Erreur");
      }
      onFinalized();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur réseau.");
      setFinalizing(false);
    }
  }

  // Progression par participant : nb de votes / nb de candidats.
  const total = candidates.length;
  const votesByParticipant = useMemo(() => {
    const m = new Map<string, number>();
    for (const v of votes) m.set(v.participant_id, (m.get(v.participant_id) ?? 0) + 1);
    return m;
  }, [votes]);

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2 style={{ margin: 0 }}>Validation</h2>
        <span className="pill">{code}</span>
      </div>

      {toast && <div className="success-box">{toast}</div>}
      {error && <div className="error-box">{error}</div>}

      {/* Carte de swipe ou état "fini" */}
      {current ? (
        <div className="swipe-card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="swipe-cover" src={current.cover ?? ""} alt="" />
          <h2 style={{ marginTop: 16, marginBottom: 2 }}>{current.title}</h2>
          <p className="muted" style={{ margin: 0 }}>{current.artist_name}</p>

          <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
            <AudioPreview
              preview={current.preview}
              title={current.title}
              artist={current.artist_name}
            />
          </div>

          {current.source === "manual" && current.added_by && (
            <p className="muted" style={{ fontSize: "0.8rem", marginTop: 10 }}>
              proposé par {nameById.get(current.added_by) ?? "un passager"}
            </p>
          )}

          <div className="vote-row">
            <button className="vote-btn dislike" onClick={() => vote(-1)} disabled={busy}>
              👎
            </button>
            <button className="vote-btn like" onClick={() => vote(1)} disabled={busy}>
              👍
            </button>
          </div>
          <p className="muted" style={{ marginTop: 14, fontSize: "0.85rem" }}>
            {queue.length} morceau{queue.length > 1 ? "x" : ""} restant
            {queue.length > 1 ? "s" : ""}
          </p>
        </div>
      ) : (
        <div className="card center stack">
          <div style={{ fontSize: 40 }}>✅</div>
          <h2 style={{ margin: 0 }}>Tu as tout voté</h2>
          <p className="muted">
            {total === 0
              ? "Aucun morceau pour l’instant — ajoute-en un ci-dessous."
              : "En attente des autres passagers…"}
          </p>
        </div>
      )}

      {/* Ajout manuel (étape 4) */}
      <button className="btn secondary" onClick={() => setShowAdd((v) => !v)}>
        {showAdd ? "Fermer la recherche" : "➕ Ajouter un morceau"}
      </button>
      {showAdd && <TrackSearchAdd code={code} identity={identity} onAdded={notify} />}

      {/* Progression temps réel */}
      <div className="card stack">
        <h2 style={{ margin: 0, fontSize: "1.05rem" }}>Avancement</h2>
        {participants.map((p) => {
          const done = Math.min(votesByParticipant.get(p.id) ?? 0, total);
          const pct = total === 0 ? 0 : Math.round((done / total) * 100);
          return (
            <div key={p.id} className="stack" style={{ gap: 6 }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="ellipsis">
                  {p.name}
                  {p.id === identity.participantId && " (toi)"}
                </span>
                <span className="muted" style={{ fontSize: "0.85rem" }}>
                  {done}/{total}
                </span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Clôture — créateur uniquement */}
      {identity.isCreator && (
        <button className="btn" onClick={finalize} disabled={finalizing}>
          {finalizing ? "Clôture…" : "🏁 Terminer le vote et voir la playlist"}
        </button>
      )}
    </div>
  );
}
