"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loadIdentity, saveIdentity } from "@/lib/identity";

// On arrive ici via le QR code ou le code saisi.
// Identité déjà connue pour ce trajet -> on file vers la salle.
// Sinon : on valide le code, on demande un prénom, on rejoint.
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
    if (loadIdentity(code)) {
      router.replace(`/trip/${code}`);
      return;
    }
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
      <main className="screen">
        <div className="empty" style={{ paddingTop: 120 }}>
          <span className="spinner" />
          <p className="subhead secondary">Vérification du trajet…</p>
        </div>
      </main>
    );
  }

  if (status === "invalid" || status === "expired") {
    return (
      <main className="screen">
        <div className="stack-lg" style={{ marginTop: 80 }}>
          <div className="stack-sm">
            <h1 className="title-lg">
              {status === "expired" ? "Trajet expiré" : "Trajet introuvable"}
            </h1>
            <p className="body secondary">
              {status === "expired"
                ? "Ce trajet n’est plus actif. Les trajets se ferment automatiquement après 24 heures."
                : `Aucun trajet ne correspond au code ${code}. Vérifie-le, ou crée un nouveau trajet.`}
            </p>
          </div>
          <button className="btn" onClick={() => router.push("/")}>
            Retour à l’accueil
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="screen">
      <div className="stack-lg" style={{ marginTop: 80 }}>
        <div className="stack-sm">
          <h1 className="title-lg">Rejoindre le trajet</h1>
          <p className="body secondary">
            Choisis un prénom pour que le groupe te reconnaisse.
          </p>
        </div>

        {error && <div className="notice notice--error">{error}</div>}

        <input
          className="field"
          placeholder="Ton prénom"
          value={name}
          maxLength={20}
          autoComplete="given-name"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && join()}
          autoFocus
        />

        <button className="btn" onClick={join} disabled={loading || !name.trim()}>
          {loading ? "Connexion…" : "Rejoindre"}
        </button>
      </div>
    </main>
  );
}
