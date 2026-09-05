"use client";

import { useMemo, useState } from "react";
import AudioPreview from "./AudioPreview";
import { Check, ChevronRight, Copy, Heart, MusicNote } from "./Icon";
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
  const [exported, setExported] = useState(false);

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

  function plainList() {
    return result.kept.map((i) => `${i.title} - ${i.artistName}`).join("\n");
  }

  function copyList() {
    navigator.clipboard.writeText(plainList()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // Copie la liste puis ouvre le convertisseur : l'utilisateur n'a plus qu'à
  // coller pour créer la playlist d'un coup, au lieu d'ajouter titre par titre.
  function exportTo(url: string) {
    navigator.clipboard.writeText(plainList()).then(() => {
      setExported(true);
      setTimeout(() => setExported(false), 6000);
      window.open(url, "_blank", "noopener,noreferrer");
    });
  }

  return (
    <div>
      <nav className="nav">
        <div className="nav__side" />
        <span className="nav__title">Playlist</span>
        <div className="nav__side nav__side--right" />
      </nav>

      <div className="stack-lg" style={{ paddingTop: 12 }}>
        <div className="stack-sm">
          <h1 className="title-lg">Votre playlist</h1>
          <p className="subhead secondary">
            {result.kept.length > 0
              ? `${result.kept.length} morceau${result.kept.length > 1 ? "x" : ""} · trajet ${code}`
              : `Trajet ${code}`}
          </p>
        </div>

        {result.kept.length === 0 ? (
          <div className="empty">
            <span className="empty__icon">
              <MusicNote size={34} />
            </span>
            <h2 className="headline" style={{ color: "var(--label)" }}>
              Aucun morceau ne fait consensus
            </h2>
            <p className="subhead" style={{ maxWidth: 300 }}>
              Tous les candidats ont dépassé le seuil de {result.threshold} refus.
              Relancez un trajet avec des artistes plus proches.
            </p>
          </div>
        ) : (
          <>
            <div className="group">
              {result.kept.map((item, idx) => {
                const c = byId.get(item.candidateId);
                if (!c) return null;
                return (
                  <div className="row row--full" key={item.candidateId}>
                    <span className="rank">{idx + 1}</span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className="artwork artwork--sm" src={c.cover ?? ""} alt="" />
                    <div className="grow">
                      <div className="truncate">{c.title}</div>
                      <div className="footnote secondary truncate">{c.artist_name}</div>
                    </div>
                    <span
                      className="footnote secondary hstack tabular"
                      style={{ gap: 3 }}
                    >
                      <Heart size={12} filled />
                      {item.likes}
                    </span>
                    <AudioPreview
                      preview={c.preview}
                      title={c.title}
                      artist={c.artist_name}
                    />
                  </div>
                );
              })}
            </div>

            {/* Export */}
            <div className="stack-sm">
              <p className="section-header">Récupérer la playlist</p>
              <div className="group">
                <button className="row row--tappable" onClick={copyList}>
                  <span className={copied ? "tint" : "secondary"} style={{ display: "flex" }}>
                    {copied ? <Check size={20} /> : <Copy size={20} />}
                  </span>
                  <span className="grow">{copied ? "Liste copiée" : "Copier la liste"}</span>
                </button>

                <button
                  className="row row--tappable"
                  onClick={() => exportTo("https://www.tunemymusic.com/fr/transfer")}
                >
                  <span className="grow">
                    <span style={{ display: "block" }}>Créer la playlist</span>
                    <span className="footnote secondary">
                      Spotify, Deezer ou Apple Music
                    </span>
                  </span>
                  <span className="tertiary" style={{ display: "flex" }}>
                    <ChevronRight size={18} />
                  </span>
                </button>

                <button
                  className="row row--tappable"
                  onClick={() => exportTo("https://soundiiz.com/standalone/txt-to-spotify")}
                >
                  <span className="grow">
                    <span style={{ display: "block" }}>Autre convertisseur</span>
                    <span className="footnote secondary">Via Soundiiz</span>
                  </span>
                  <span className="tertiary" style={{ display: "flex" }}>
                    <ChevronRight size={18} />
                  </span>
                </button>
              </div>

              <p className="footnote secondary" style={{ margin: "0 16px" }}>
                {exported
                  ? "Liste copiée. Colle-la dans le champ texte du site qui vient de s’ouvrir, puis choisis ton service."
                  : "La liste est copiée automatiquement : il suffit de la coller sur le site pour créer la playlist d’un seul coup."}
              </p>
            </div>
          </>
        )}

        {result.excluded.length > 0 && (
          <p className="footnote tertiary center">
            {result.excluded.length} morceau{result.excluded.length > 1 ? "x" : ""} écarté
            {result.excluded.length > 1 ? "s" : ""} par le vote.
          </p>
        )}
      </div>
    </div>
  );
}
