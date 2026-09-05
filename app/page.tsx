"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveIdentity } from "@/lib/identity";
import { ChevronLeft, MusicNote } from "@/app/components/Icon";

// Accueil : créer un trajet ou en rejoindre un avec son code.
export default function HomePage() {
  const router = useRouter();
  const [mode, setMode] = useState<"home" | "create" | "join">("home");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function back() {
    setMode("home");
    setError(null);
  }

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
    if (c.length < 4) return setError("Le code fait 4 caractères.");
    router.push(`/join/${c}`);
  }

  if (mode === "home") {
    return (
      <main className="screen">
        <div
          className="stack-lg"
          style={{ minHeight: "100dvh", justifyContent: "center", paddingBottom: 40 }}
        >
          <div className="stack" style={{ alignItems: "center", gap: 20 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 76,
                height: 76,
                borderRadius: 20,
                background: "var(--tint)",
                color: "#fff",
              }}
            >
              <MusicNote size={36} />
            </div>
            <div className="stack-sm center">
              <h1 className="title-lg">Playlist</h1>
              <p className="body secondary" style={{ maxWidth: 300 }}>
                La musique du trajet, choisie par tout le monde. Pas seulement par
                celui qui tient le câble.
              </p>
            </div>
          </div>

          <div className="stack">
            <button className="btn" onClick={() => setMode("create")}>
              Créer un trajet
            </button>
            <button className="btn btn--secondary" onClick={() => setMode("join")}>
              Rejoindre avec un code
            </button>
          </div>

          <p className="footnote tertiary center" style={{ margin: 0 }}>
            Sans compte ni abonnement.
          </p>
        </div>
      </main>
    );
  }

  const isCreate = mode === "create";

  return (
    <main className="screen">
      <nav className="nav">
        <div className="nav__side">
          <button className="nav-btn" onClick={back}>
            <ChevronLeft size={22} />
            Retour
          </button>
        </div>
        <div className="nav__side nav__side--right" />
      </nav>

      <div className="stack-lg" style={{ marginTop: 24 }}>
        <div className="stack-sm">
          <h1 className="title-lg">{isCreate ? "Créer un trajet" : "Rejoindre"}</h1>
          <p className="subhead secondary">
            {isCreate
              ? "Choisis ton prénom, tu obtiendras un code et un QR code à partager."
              : "Entre le code à 4 caractères affiché sur le téléphone du conducteur."}
          </p>
        </div>

        {error && <div className="notice notice--error">{error}</div>}

        {isCreate ? (
          <input
            className="field"
            placeholder="Ton prénom"
            value={name}
            maxLength={20}
            autoComplete="given-name"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createTrip()}
            autoFocus
          />
        ) : (
          <input
            className="field"
            placeholder="Code"
            value={code}
            maxLength={4}
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            style={{
              textAlign: "center",
              fontSize: 28,
              fontWeight: 600,
              letterSpacing: "0.32em",
              textIndent: "0.32em",
            }}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && goJoin()}
            autoFocus
          />
        )}

        <button
          className="btn"
          onClick={isCreate ? createTrip : goJoin}
          disabled={loading || (isCreate ? !name.trim() : code.trim().length < 4)}
        >
          {loading ? "Création…" : "Continuer"}
        </button>
      </div>
    </main>
  );
}
