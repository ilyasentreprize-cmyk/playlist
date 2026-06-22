"use client";

import { useEffect, useRef, useState } from "react";

// Bouton play/pause d'un extrait 30s.
// - Si `preview` (Deezer) est fourni, on le joue directement.
// - Sinon, au premier clic, on tente le fallback iTunes via /api/preview.
// - Si aucun extrait n'existe, le bouton est désactivé (jamais bloquant).
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

  // Reset quand on change de morceau.
  useEffect(() => {
    setUrl(preview);
    setNoPreview(false);
    setPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  }, [preview, title, artist]);

  // Nettoyage à l'unmount.
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

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
      audioRef.current.pause();
      setPlaying(false);
      return;
    }

    let src = url;
    if (!src) {
      setLoading(true);
      src = await resolveItunes();
      setLoading(false);
      if (!src) {
        setNoPreview(true);
        return;
      }
      setUrl(src);
    }

    const audio = new Audio(src);
    audio.onended = () => setPlaying(false);
    audio.onpause = () => setPlaying(false);
    audioRef.current = audio;
    try {
      await audio.play();
      setPlaying(true);
    } catch {
      setNoPreview(true);
    }
  }

  const disabled = noPreview;
  return (
    <button
      className="icon-btn"
      onClick={toggle}
      disabled={disabled}
      aria-label={playing ? "Pause" : "Écouter l'extrait"}
      title={noPreview ? "Aucun extrait disponible" : "Écouter 30s"}
    >
      {loading ? "…" : noPreview ? "🚫" : playing ? "⏸" : "▶"}
    </button>
  );
}
