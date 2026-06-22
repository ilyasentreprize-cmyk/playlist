"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loadIdentity, saveIdentity } from "@/lib/identity";

// Étape 2 (entrée) : on arrive ici via le QR code ou le code saisi.
// Si on a déjà une identité pour ce trajet -> on file vers la salle.
// Sinon : on valide le code, on demande un pseudo, on rejoint.
export default function JoinPage({ params }: { params: { code: string } }) {
  const router = useRouter();
  const code = params.code.toUpperCase();

  const [status, setStatus] = useState<"checking" | "ready" | "invalid" | "expired">(
    "checking"
  );
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Déjà membre de ce trajet ?
    if (loadIdentity(code)) {
      router.replace(`/trip/${code}`);
      return;
    }
    // Sinon on vérifie que le trajet existe.
    (async () => {
      try {
        const res = await fetch(`/api/sessions/${code}`);
        if (res.status === 404) return setStatus("invalid");
        if (res.status === 410) return setStatus("expired");
        if (!res.ok) return setStatus("invalid");
        setStatus("ready");
      } catch {
        setStatus("invalid");
      }
    })();
  }, [code, router]);

  async function join() {
    if (!name.trim()) return setError("Entre ton prénom.");
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur");
      saveIdentity(code, data.identity);
      router.replace(`/trip/${code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur réseau.");
      setLoading(false);
    }
  }

  if (status === "checking") {
    return (
      <main className="container center">
        <p className="muted" style={{ marginTop: 60 }}>Vérification du trajet…</p>
      </main>
    );
  }

  if (status === "invalid" || status === "expired") {
    return (
      <main className="container">
        <div className="card stack" style={{ marginTop: 40 }}>
          <h2>{status === "expired" ? "Trajet expiré" : "Trajet introuvable"}</h2>
          <p className="muted">
            {status === "expired"
              ? "Ce trajet n’est plus actif (les trajets expirent après 24h)."
              : "Ce code ne correspond à aucun trajet. Vérifie-le ou crées-en un nouveau."}
          </p>
          <button className="btn" onClick={() => router.push("/")}>
            Retour à l’accueil
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="container">
      <div className="card stack" style={{ marginTop: 40 }}>
        <h2>Rejoindre le trajet {code}</h2>
        <p className="muted">Choisis un prénom pour que le groupe te reconnaisse.</p>
        {error && <div className="error-box">{error}</div>}
        <input
          className="input"
          placeholder="Ton prénom"
          value={name}
          maxLength={20}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && join()}
          autoFocus
        />
        <button className="btn" onClick={join} disabled={loading}>
          {loading ? "Connexion…" : "Rejoindre"}
        </button>
      </div>
    </main>
  );
}
