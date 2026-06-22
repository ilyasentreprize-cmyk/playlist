"use client";

import { useEffect, useState } from "react";
import QRCode from "./QRCode";
import type { LocalIdentity, Participant } from "@/lib/types";

// Salle d'attente. Le créateur voit le QR + la liste qui se remplit en temps
// réel, et peut déclencher la génération (étape 3). Les autres patientent.
export default function Lobby({
  code,
  identity,
  participants,
  onGenerated,
}: {
  code: string;
  identity: LocalIdentity;
  participants: Participant[];
  onGenerated: () => void;
}) {
  const [joinUrl, setJoinUrl] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="stack">
      <div className="center">
        <p className="muted">Code du trajet</p>
        <div className="code-badge">{code}</div>
      </div>

      {identity.isCreator && joinUrl && (
        <div className="card center stack">
          <p className="muted">Fais scanner ce QR code aux passagers</p>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <QRCode value={joinUrl} size={200} />
          </div>
          <p className="muted" style={{ fontSize: "0.8rem", wordBreak: "break-all" }}>
            {joinUrl}
          </p>
        </div>
      )}

      <div className="card stack">
        <h2>Participants ({participants.length})</h2>
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
      </div>

      {error && <div className="error-box">{error}</div>}

      {identity.isCreator ? (
        <div className="stack">
          <p className="muted center" style={{ fontSize: "0.85rem" }}>
            Quand tout le monde a rejoint et choisi ses goûts, lance la génération.
          </p>
          <button className="btn" onClick={generate} disabled={generating}>
            {generating ? "Génération…" : "🎶 Générer la sélection"}
          </button>
        </div>
      ) : (
        <p className="muted center">
          En attente que l’hôte lance la sélection… Tu peux fermer puis revenir, ta
          place est gardée.
        </p>
      )}
    </div>
  );
}
