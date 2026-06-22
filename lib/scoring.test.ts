// Tests des fonctions de scoring pures. Lancer avec : npm test (Node >= 22).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  generateCandidates,
  exclusionThreshold,
  computeFinalResult,
  type TrackLikeInput,
  type ArtistLikeInput,
} from "./scoring.ts";

function track(p: string, id: string, artistId: string): TrackLikeInput {
  return {
    participantId: p,
    trackId: id,
    title: `Track ${id}`,
    artistName: `Artist ${artistId}`,
    artistId,
    cover: null,
    preview: null,
  };
}

test("le consensus large bat le pic d'une seule personne", () => {
  // t1 : liké par 3 personnes. t2 : liké par 1 seule (même intensité directe).
  const likes: TrackLikeInput[] = [
    track("p1", "t1", "a1"),
    track("p2", "t1", "a1"),
    track("p3", "t1", "a1"),
    track("p1", "t2", "a2"),
  ];
  const artists: ArtistLikeInput[] = [];
  const out = generateCandidates(likes, artists);
  const t1 = out.find((c) => c.trackId === "t1")!;
  const t2 = out.find((c) => c.trackId === "t2")!;
  // t1 : 3 * 1.0 * (1 + 0.5*2) = 6 ; t2 : 1 * 1.0 * 1 = 1
  assert.equal(t1.score, 6);
  assert.equal(t2.score, 1);
  assert.ok(out[0].trackId === "t1");
});

test("un artiste déclaré (2a) sans like direct contribue à 0.6", () => {
  const likes: TrackLikeInput[] = [track("p1", "t1", "a1")];
  // p2 n'a pas liké t1 mais a déclaré l'artiste a1 en 2a.
  const artists: ArtistLikeInput[] = [{ participantId: "p2", artistId: "a1" }];
  const out = generateCandidates(likes, artists);
  const t1 = out.find((c) => c.trackId === "t1")!;
  // raw = 1.0 (p1 direct) + 0.6 (p2 artiste) = 1.6 ; supporters=2 ; x(1+0.5)=1.5
  assert.equal(t1.distinctSupporters, 2);
  assert.equal(t1.score, 1.6 * 1.5);
});

test("dédoublonnage : deux likes du même morceau = un seul candidat", () => {
  const likes: TrackLikeInput[] = [track("p1", "t1", "a1"), track("p2", "t1", "a1")];
  const out = generateCandidates(likes, []);
  assert.equal(out.filter((c) => c.trackId === "t1").length, 1);
});

test("seuil d'exclusion proportionnel — exemples du cahier des charges", () => {
  assert.equal(exclusionThreshold(1), 1); // solo : 1 dislike exclut
  assert.equal(exclusionThreshold(2), 1);
  assert.equal(exclusionThreshold(4), 2);
  assert.equal(exclusionThreshold(5), 2);
  assert.equal(exclusionThreshold(6), 3);
  assert.equal(exclusionThreshold(8), 4);
});

test("computeFinalResult exclut au seuil et trie par score net", () => {
  const tallies = [
    { candidateId: "c1", title: "A", artistName: "x", likes: 4, dislikes: 1 },
    { candidateId: "c2", title: "B", artistName: "x", likes: 2, dislikes: 2 }, // exclu (>=2)
    { candidateId: "c3", title: "C", artistName: "x", likes: 5, dislikes: 0 },
  ];
  // 5 participants -> seuil = 2
  const res = computeFinalResult(tallies, 5);
  assert.equal(res.threshold, 2);
  assert.deepEqual(
    res.kept.map((k) => k.candidateId),
    ["c3", "c1"] // net 5 puis net 3
  );
  assert.equal(res.excluded.length, 1);
  assert.equal(res.excluded[0].candidateId, "c2");
});

test("playlist entièrement exclue est gérée (liste vide, pas de crash)", () => {
  const tallies = [
    { candidateId: "c1", title: "A", artistName: "x", likes: 0, dislikes: 1 },
  ];
  const res = computeFinalResult(tallies, 2); // seuil = 1
  assert.equal(res.kept.length, 0);
  assert.equal(res.excluded.length, 1);
});
