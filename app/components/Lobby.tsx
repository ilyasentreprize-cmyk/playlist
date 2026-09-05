"use client";

import { useEffect, useState } from "react";
import QRCode from "./QRCode";
import { Check, ChevronRight, Copy, Share } from "./Icon";
import type { LocalIdentity, Participant } from "@/lib/types";

export default function Lobby({
  code,
  identity,
  participants,
  tasteDone,
  onStartTaste,
  onGenerated,
}: {
  code: string;
  identity: LocalIdentity;
  participants: Participant[];
  tasteDone: boolean;
  onStartTaste: () => void;
  onGenerated: () => void;
}) {
  const [joinUrl, setJoinUrl] = useState("");
  const [canShare, setCanShare] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setJoinUrl(`${window.location.origin}/join/${code}`);
    setCanShare(typeof navigator !== "undefined" && !!navigator.share);
  }, [code]);

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          participantId: identity.participantId,
          token: identity.token,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur");
      onGenerated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur réseau.");
      setGenerating(false);
    }
  }

  async function shareLink() {
    if (canShare) {
      try {
        await navigator.share({ title: "Rejoins le trajet", text: `Code ${code}`, url: joinUrl });
        return;
      } catch {
        /* partage annulé : on retombe sur la copie */
      }
    }
    navigator.clipboard.writeText(joinUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="stack-lg" style={{ paddingTop: 12 }}>
      {/* Code et QR */}
      <div className="stack" style={{ alignItems: "center", gap: 16 }}>
        <div className="stack-sm center">
          <p className="footnote secondary">Code du trajet</p>
          <p className="code">{code}</p>
        </div>

        {joinUrl && <QRCode value={joinUrl} size={196} />}

        <p className="footnote secondary center" style={{ maxWidth: 260 }}>
          Fais scanner ce code aux passagers, ou envoie-leur le lien.
        </p>

        <button className="btn btn--plain" onClick={shareLink} style={{ width: "auto" }}>
          {copied ? <Check size={18} /> : canShare ? <Share size={18} /> : <Copy size={18} />}
          {copied ? "Lien copié" : canShare ? "Partager le lien" : "Copier le lien"}
        </button>
      </div>

      {/* Passagers */}
      <div className="stack-sm">
        <p className="section-header">
          Passagers · {participants.length}
        </p>
        <div className="group">
          {participants.map((p) => (
            <div className="row" key={p.id}>
              <div className="avatar">{p.name.charAt(0).toUpperCase()}</div>
              <span className="grow truncate">
                {p.name}
                {p.id === identity.participantId && (
                  <span className="secondary"> · toi</span>
                )}
              </span>
              {p.is_creator && <span className="badge">Hôte</span>}
            </div>
          ))}
        </div>
        {participants.length === 1 && (
          <p className="footnote secondary" style={{ marginLeft: 16 }}>
            En attente des autres passagers.
          </p>
        )}
      </div>

      {/* Goûts musicaux */}
      <div className="stack-sm">
        <p className="section-header">Ta sélection</p>
        <div className="group">
          {tasteDone ? (
            <div className="row">
              <span className="tint" style={{ display: "flex" }}>
                <Check size={20} />
              </span>
              <span className="grow">Goûts enregistrés</span>
              <button className="btn btn--plain" style={{ width: "auto", minHeight: 0, padding: 0 }} onClick={onStartTaste}>
                Modifier
              </button>
            </div>
          ) : (
            <button className="row row--tappable" onClick={onStartTaste}>
              <span className="grow">Choisir mes artistes et mes sons</span>
              <span className="tertiary" style={{ display: "flex" }}>
                <ChevronRight size={18} />
              </span>
            </button>
          )}
        </div>
      </div>

      {error && <div className="notice notice--error">{error}</div>}

      {/* Lancement */}
      {identity.isCreator ? (
        <div className="stack-sm">
          <button className="btn" onClick={generate} disabled={generating}>
            {generating ? "Génération…" : "Lancer la sélection"}
          </button>
          <p className="footnote secondary center">
            À lancer quand tout le monde a rejoint et choisi ses goûts.
          </p>
        </div>
      ) : (
        <p className="footnote secondary center">
          En attente que l’hôte lance la sélection.
        </p>
      )}
    </div>
  );
}
