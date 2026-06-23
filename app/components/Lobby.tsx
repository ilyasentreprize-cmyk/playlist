"use client";

import { useEffect, useState } from "react";
import QRCode from "./QRCode";
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
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setJoinUrl(`${window.location.origin}/join/${code}`);
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

  function copyLink() {
    navigator.clipboard.writeText(joinUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="stack">
      {/* En-tête */}
      <div className="center">
        <p className="muted" style={{ margin: 0 }}>Code du trajet</p>
        <div className="code-badge">{code}</div>
      </div>

      {/* QR code */}
      {joinUrl && (
        <div className="card center stack">
          <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
            Fais scanner ce QR code aux passagers
          </p>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <QRCode value={joinUrl} size={220} />
          </div>
          <button className="btn ghost" onClick={copyLink} style={{ fontSize: "0.85rem" }}>
            {copied ? "✅ Lien copié !" : "📋 Copier le lien"}
          </button>
        </div>
      )}

      {/* Participants en temps réel */}
      <div className="card stack">
        <h2 style={{ margin: 0 }}>
          Passagers ({participants.length})
        </h2>
        {participants.map((p) => (
          <div className="list-item" key={p.id}>
            <div className="badge-rank">{p.name.charAt(0).toUpperCase()}</div>
            <div className="grow ellipsis">
              {p.name}
              {p.id === identity.participantId && " (toi)"}
            </div>
            {p.is_creator && <span className="pill">hôte</span>}
          </div>
        ))}
        {participants.length === 1 && (
          <p className="muted" style={{ fontSize: "0.85rem", margin: 0 }}>
            En attente des autres passagers…
          </p>
        )}
      </div>

      {/* Bouton choisir ses goûts */}
      {!tasteDone && (
        <button className="btn" onClick={onStartTaste}>
          🎵 Choisir mes goûts musicaux →
        </button>
      )}
      {tasteDone && (
        <div className="success-box center">
          ✅ Tes goûts sont enregistrés
        </div>
      )}

      {error && <div className="error-box">{error}</div>}

      {/* Génération — créateur uniquement */}
      {identity.isCreator ? (
        <div className="stack">
          <p className="muted center" style={{ fontSize: "0.85rem" }}>
            Quand tout le monde a rejoint et choisi ses goûts, lance la sélection.
          </p>
          <button className="btn" onClick={generate} disabled={generating}>
            {generating ? "Génération…" : "🎶 Lancer la sélection"}
          </button>
        </div>
      ) : (
        <p className="muted center" style={{ fontSize: "0.85rem" }}>
          En attente que l'hôte lance la sélection…
        </p>
      )}
    </div>
  );
}
