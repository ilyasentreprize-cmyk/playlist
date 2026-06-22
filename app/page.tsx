"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveIdentity } from "@/lib/identity";

// Accueil : créer un trajet (étape 1) ou en rejoindre un.
export default function HomePage() {
  const router = useRouter();
  const [mode, setMode] = useState<"home" | "create" | "join">("home");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createTrip() {
    if (!name.trim()) return setError("Entre ton prénom.");
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur");
      saveIdentity(data.code, data.identity);
      router.push(`/trip/${data.code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur réseau.");
      setLoading(false);
    }
  }

  function goJoin() {
    const c = code.trim().toUpperCase();
    if (c.length < 4) return setError("Code à 4 caractères.");
    router.push(`/join/${c}`);
  }

  return (
    <main className="container">
      <div style={{ textAlign: "center", marginBottom: 28, marginTop: 20 }}>
        <div style={{ fontSize: 48 }}>🎵</div>
        <h1>Playlist Collective</h1>
        <p className="muted">
          Une playlist de trajet qui plaît à <strong>tout le monde</strong>, pas juste à
          celui qui tient l’aux.
        </p>
      </div>

      {error && (
        <div className="error-box" style={{ marginBottom: 14 }}>
          {error}
        </div>
      )}

      {mode === "home" && (
        <div className="stack">
          <button className="btn" onClick={() => { setMode("create"); setError(null); }}>
            🚗 Créer un trajet
          </button>
          <button
            className="btn secondary"
            onClick={() => { setMode("join"); setError(null); }}
          >
            🔑 Rejoindre avec un code
          </button>
        </div>
      )}

      {mode === "create" && (
        <div className="card stack">
          <h2>Créer un trajet</h2>
          <input
            className="input"
            placeholder="Ton prénom"
            value={name}
            maxLength={20}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createTrip()}
            autoFocus
          />
          <button className="btn" onClick={createTrip} disabled={loading}>
            {loading ? "Création…" : "Créer et obtenir le QR code"}
          </button>
          <button className="btn ghost" onClick={() => setMode("home")}>
            Retour
          </button>
        </div>
      )}

      {mode === "join" && (
        <div className="card stack">
          <h2>Rejoindre un trajet</h2>
          <input
            className="input"
            placeholder="Code (ex: K3P9)"
            value={code}
            maxLength={4}
            style={{ textTransform: "uppercase", letterSpacing: "0.3rem", textAlign: "center" }}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && goJoin()}
            autoFocus
          />
          <button className="btn" onClick={goJoin}>
            Continuer
          </button>
          <button className="btn ghost" onClick={() => setMode("home")}>
            Retour
          </button>
        </div>
      )}

      <p className="muted center" style={{ marginTop: 28, fontSize: "0.8rem" }}>
        Sans compte, sans Spotify, sans abonnement. Données musicales : Deezer & iTunes.
      </p>
    </main>
  );
}
