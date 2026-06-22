"use client";

import { useEffect, useRef, useState } from "react";
import { registerPlay, unregisterPlay } from "@/lib/audioManager";

export default function AudioPreview({
  preview,
  title,
  artist,
}: {
  preview: string | null;
  title: string;
  artist: string;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [url, setUrl] = useState<string | null>(preview);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [noPreview, setNoPreview] = useState(false);

  useEffect(() => {
    setUrl(preview);
    setNoPreview(false);
    stop();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview, title, artist]);

  useEffect(() => {
    return () => stop();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stop() {
    if (audioRef.current) {
      audioRef.current.pause();
      unregisterPlay(audioRef.current);
      audioRef.current = null;
    }
    setPlaying(false);
  }

  async function resolveItunes(): Promise<string | null> {
    try {
      const res = await fetch(
        `/api/preview?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}`
      );
      const data = await res.json();
      return data.preview ?? null;
    } catch {
      return null;
    }
  }

  async function toggle() {
    if (audioRef.current && playing) {
      stop();
      return;
    }

    let src = url;
    if (!src) {
      setLoading(true);
      src = await resolveItunes();
      setLoading(false);
      if (!src) { setNoPreview(true); return; }
      setUrl(src);
    }

    const audio = new Audio(src);
    audio.onended = () => { unregisterPlay(audio); setPlaying(false); };
    audio.onpause = () => setPlaying(false);
    audioRef.current = audio;

    // Enregistre auprès du gestionnaire global — stoppe l'éventuel autre son.
    registerPlay(audio, () => setPlaying(false));

    try {
      await audio.play();
      setPlaying(true);
    } catch {
      setNoPreview(true);
    }
  }

  return (
    <button
      className="icon-btn"
      onClick={toggle}
      disabled={noPreview}
      aria-label={playing ? "Pause" : "Écouter l'extrait"}
      title={noPreview ? "Aucun extrait disponible" : "Écouter 30s"}
    >
      {loading ? "…" : noPreview ? "🚫" : playing ? "⏸" : "▶"}
    </button>
  );
}
