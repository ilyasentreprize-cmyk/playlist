"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { loadIdentity } from "@/lib/identity";
import TasteCollection from "@/app/components/TasteCollection";
import Lobby from "@/app/components/Lobby";
import VoteRoom from "@/app/components/VoteRoom";
import FinalPlaylist from "@/app/components/FinalPlaylist";
import type {
  Candidate,
  CandidateVote,
  LocalIdentity,
  Participant,
  Session,
} from "@/lib/types";

type Screen = "loading" | "config-error" | "invalid" | "expired" | "ok";

const tasteKey = (code: string) => `playlist:taste:${code.toUpperCase()}`;

// Hub temps réel du trajet : aiguille vers la bonne phase selon le statut de la
// session et l'avancement du participant local.
export default function TripPage({ params }: { params: { code: string } }) {
  const router = useRouter();
  const code = params.code.toUpperCase();

  const [screen, setScreen] = useState<Screen>("loading");
  const [identity, setIdentity] = useState<LocalIdentity | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [votes, setVotes] = useState<CandidateVote[]>([]);
  const [tasteDone, setTasteDone] = useState(false);

  const sessionIdRef = useRef<string | null>(null);

  // --- chargements ---
  const refetchParticipants = useCallback(async (sid: string) => {
    const supabase = getSupabaseBrowser();
    const { data } = await supabase
      .from("participants")
      .select("id, session_id, name, is_creator, created_at")
      .eq("session_id", sid)
      .order("created_at", { ascending: true });
    setParticipants((data as Participant[]) ?? []);
  }, []);

  const refetchCandidates = useCallback(async (sid: string) => {
    const supabase = getSupabaseBrowser();
    const { data } = await supabase
      .from("candidates")
      .select("*")
      .eq("session_id", sid)
      .order("created_at", { ascending: true });
    setCandidates((data as Candidate[]) ?? []);
  }, []);

  const refetchVotes = useCallback(async (sid: string) => {
    const supabase = getSupabaseBrowser();
    const { data } = await supabase
      .from("candidate_votes")
      .select("id, session_id, candidate_id, participant_id, value")
      .eq("session_id", sid);
    setVotes((data as CandidateVote[]) ?? []);
  }, []);

  const refetchSession = useCallback(async (sid: string) => {
    const supabase = getSupabaseBrowser();
    const { data } = await supabase
      .from("sessions")
      .select("id, code, status, created_at, expires_at")
      .eq("id", sid)
      .single();
    if (data) setSession(data as Session);
  }, []);

  // --- init + abonnements realtime ---
  useEffect(() => {
    const id = loadIdentity(code);
    if (!id) {
      router.replace(`/join/${code}`);
      return;
    }
    setIdentity(id);
    setTasteDone(localStorage.getItem(tasteKey(code)) === "1");

    let supabase;
    try {
      supabase = getSupabaseBrowser();
    } catch {
      setScreen("config-error");
      return;
    }

    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      const { data: s, error } = await supabase
        .from("sessions")
        .select("id, code, status, created_at, expires_at")
        .eq("code", code)
        .single();

      if (error || !s) {
        setScreen("invalid");
        return;
      }
      if (new Date(s.expires_at).getTime() < Date.now()) {
        setScreen("expired");
        return;
      }

      const sid = s.id;
      sessionIdRef.current = sid;
      setSession(s as Session);

      await Promise.all([
        refetchParticipants(sid),
        refetchCandidates(sid),
        refetchVotes(sid),
      ]);
      setScreen("ok");

      // Nom unique par montage : évite le conflit de cache Supabase quand
      // React StrictMode (dev) exécute l'effet deux fois de suite.
      const channelName = `session:${sid}:${Date.now()}`;
      channel = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "participants", filter: `session_id=eq.${sid}` },
          () => refetchParticipants(sid)
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "candidates", filter: `session_id=eq.${sid}` },
          () => refetchCandidates(sid)
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "candidate_votes", filter: `session_id=eq.${sid}` },
          () => refetchVotes(sid)
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "sessions", filter: `id=eq.${sid}` },
          () => refetchSession(sid)
        )
        .subscribe();
    })();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [code, router, refetchParticipants, refetchCandidates, refetchVotes, refetchSession]);

  // Contrôle si l'utilisateur est en train de faire son étape goûts
  // (depuis le lobby, via le bouton "Choisir mes goûts").
  const [inTasteFlow, setInTasteFlow] = useState(false);

  function markTasteDone() {
    localStorage.setItem(tasteKey(code), "1");
    setTasteDone(true);
    setInTasteFlow(false);
  }

  // --- rendus d'états ---
  if (screen === "loading") {
    return (
      <main className="container center">
        <p className="muted" style={{ marginTop: 60 }}>Chargement du trajet…</p>
      </main>
    );
  }

  if (screen === "config-error") {
    return (
      <main className="container">
        <div className="error-box" style={{ marginTop: 40 }}>
          Configuration Supabase manquante. Renseigne NEXT_PUBLIC_SUPABASE_URL et
          NEXT_PUBLIC_SUPABASE_ANON_KEY dans <code>.env.local</code>.
        </div>
      </main>
    );
  }

  if (screen === "invalid" || screen === "expired") {
    return (
      <main className="container">
        <div className="card stack" style={{ marginTop: 40 }}>
          <h2>{screen === "expired" ? "Trajet expiré" : "Trajet introuvable"}</h2>
          <p className="muted">
            {screen === "expired"
              ? "Ce trajet n’est plus actif (expiration après 24h)."
              : "Ce code ne correspond à aucun trajet actif."}
          </p>
          <button className="btn" onClick={() => router.push("/")}>
            Retour à l’accueil
          </button>
        </div>
      </main>
    );
  }

  if (!identity || !session) return null;

  // Aiguillage de phase :
  // - En lobby : tout le monde voit le lobby (QR code + liste). Le bouton
  //   "Choisir mes goûts" bascule vers TasteCollection puis revient au lobby.
  // - En voting : si goûts pas faits → TasteCollection (skip possible pour
  //   retardataires), sinon VoteRoom.
  // - Finished : FinalPlaylist.
  const showTasteInVoting = session.status === "voting" && !tasteDone && !inTasteFlow;

  return (
    <main className="container">
      {inTasteFlow ? (
        <TasteCollection
          identity={identity}
          allowSkip={session.status === "voting"}
          onDone={markTasteDone}
        />
      ) : session.status === "lobby" ? (
        <Lobby
          code={code}
          identity={identity}
          participants={participants}
          tasteDone={tasteDone}
          onStartTaste={() => setInTasteFlow(true)}
          onGenerated={() => sessionIdRef.current && refetchSession(sessionIdRef.current)}
        />
      ) : showTasteInVoting ? (
        <TasteCollection
          identity={identity}
          allowSkip
          onDone={markTasteDone}
        />
      ) : session.status === "voting" ? (
        <VoteRoom
          code={code}
          identity={identity}
          participants={participants}
          candidates={candidates}
          votes={votes}
          onFinalized={() => sessionIdRef.current && refetchSession(sessionIdRef.current)}
        />
      ) : (
        <FinalPlaylist code={code} candidates={candidates} votes={votes} />
      )}
    </main>
  );
}
