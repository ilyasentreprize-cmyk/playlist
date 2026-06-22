"use client";

// Singleton global : garantit qu'un seul extrait joue à la fois.
// Chaque AudioPreview s'enregistre ici au play et reçoit un signal stop si
// un autre composant prend le relais.

let currentAudio: HTMLAudioElement | null = null;
let stopCallback: (() => void) | null = null;

export function registerPlay(audio: HTMLAudioElement, onStop: () => void) {
  if (currentAudio && currentAudio !== audio) {
    currentAudio.pause();
    stopCallback?.();
  }
  currentAudio = audio;
  stopCallback = onStop;
}

export function unregisterPlay(audio: HTMLAudioElement) {
  if (currentAudio === audio) {
    currentAudio = null;
    stopCallback = null;
  }
}
