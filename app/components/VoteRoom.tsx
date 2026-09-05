"use client";

import { useMemo, useState } from "react";
import AudioPreview from "./AudioPreview";
import { Check, Close, Heart } from "./Icon";
import type { Candidate, CandidateVote, LocalIdentity, Participant } from "@/lib/types";

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
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  const myVoted = useMemo(() => {
    const s = new Set<string>();
    for (const v of votes) {
      if (v.participant_id === identity.participantId) s.add(v.candidate_id);
    }
    return s;
  }, [votes, identity.participantId]);

  const queue = useMemo(
    () => candidates.filter((c) => !myVoted.has(c.id)),
    [candidates, myVoted]
  );
  const current = queue[0];

  const votesByParticipant = useMemo(() => {
    const m = new Map<string, number>();
    for (const v of votes) m.set(v.participant_id, (m.get(v.participant_id) ?? 0) + 1);
    return m;
  }, [votes]);

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

  const total = candidates.length;
  const done = Math.min(myVoted.size, total);
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <div>
      <nav className="nav">
        <div className="nav__side" />
        <span className="nav__title">Vote</span>
        <div className="nav__side nav__side--right">
          <span className="badge" style={{ marginRight: 8 }}>{code}</span>
        </div>
      </nav>

      <div className="stack-lg" style={{ paddingTop: 12 }}>
        {/* Progression personnelle */}
        <div className="stack-sm">
          <div className="hstack" style={{ justifyContent: "space-between" }}>
            <span className="footnote secondary">Ta progression</span>
            <span className="footnote secondary tabular">
              {done} sur {total}
            </span>
          </div>
          <div className="progress">
            <div className="progress__fill" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {error && <div className="notice notice--error">{error}</div>}

        {current ? (
          <div className="stack-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="vote-art" src={current.cover ?? ""} alt="" />

            <div className="stack-sm center">
              <h1 className="title">{current.title}</h1>
              <p className="body secondary">{current.artist_name}</p>
              <div style={{ display: "flex", justifyContent: "center", marginTop: 4 }}>
                <AudioPreview
                  preview={current.preview}
                  title={current.title}
                  artist={current.artist_name}
                />
              </div>
            </div>

            <div className="vote-actions">
              <button
                className="vote-btn vote-btn--no"
                onClick={() => vote(-1)}
                disabled={busy}
                aria-label="Refuser"
              >
                <Close size={26} />
              </button>
              <button
                className="vote-btn vote-btn--yes"
                onClick={() => vote(1)}
                disabled={busy}
                aria-label="Accepter"
              >
                <Heart size={24} filled />
              </button>
            </div>

            <p className="footnote secondary center">
              {queue.length} morceau{queue.length > 1 ? "x" : ""} restant
              {queue.length > 1 ? "s" : ""}
            </p>
          </div>
        ) : (
          <div className="empty" style={{ padding: "40px 24px" }}>
            <span className="tint" style={{ display: "flex" }}>
              <Check size={40} />
            </span>
            <h2 className="title" style={{ color: "var(--label)" }}>
              Tu as tout voté
            </h2>
            <p className="subhead">En attente des autres passagers.</p>
          </div>
        )}

        {/* Progression du groupe */}
        <div className="stack-sm">
          <p className="section-header">Le groupe</p>
          <div className="group">
            {participants.map((p) => {
              const n = Math.min(votesByParticipant.get(p.id) ?? 0, total);
              const complete = total > 0 && n >= total;
              return (
                <div className="row" key={p.id}>
                  <div className="avatar">{p.name.charAt(0).toUpperCase()}</div>
                  <span className="grow truncate">
                    {p.name}
                    {p.id === identity.participantId && (
                      <span className="secondary"> · toi</span>
                    )}
                  </span>
                  {complete ? (
                    <span className="tint" style={{ display: "flex" }}>
                      <Check size={18} />
                    </span>
                  ) : (
                    <span className="footnote secondary tabular">
                      {n}/{total}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {identity.isCreator && (
          <div className="stack-sm">
            <button className="btn" onClick={finalize} disabled={finalizing}>
              {finalizing ? "Clôture…" : "Clôturer et voir la playlist"}
            </button>
            <p className="footnote secondary center">
              Le vote se ferme pour tout le monde.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
