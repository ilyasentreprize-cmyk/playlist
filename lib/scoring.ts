// =============================================================================
// Logique de scoring — FONCTIONS PURES, sans I/O, testables isolément.
// Deux responsabilités :
//   1. generateCandidates() — étape 3 : croise les goûts de tous les
//      participants pour produire une liste candidate.
//   2. computeFinalResult() — étape 6 : applique le seuil d'exclusion
//      proportionnel et trie la playlist finale.
//
// Tous les "nombres magiques" sont des constantes nommées et commentées ci-dessous
// pour pouvoir ajuster l'algorithme facilement plus tard.
// =============================================================================

// --- Constantes de pondération (étape 3) -------------------------------------

// Un participant qui a LIKÉ directement le morceau en 2b : signal le plus fort.
const W_DIRECT_LIKE = 1.0;

// Un participant qui n'a pas liké ce morceau précis mais a déclaré son ARTISTE
// en 2a : le morceau lui correspond probablement, signal modéré.
const W_DECLARED_ARTIST = 0.6;

// Bonus de consensus : on multiplie le score brut par (1 + BONUS * (nb_personnes - 1)).
// Effet voulu : "plusieurs personnes qui aiment un peu" pèse plus que
// "une seule personne qui adore". Avec 0.5, deux contributeurs valent x1.5,
// trois valent x2, etc. C'est le mécanisme central anti-"pic extrême".
const CONSENSUS_BONUS = 0.5;

// --- Constantes de taille de la liste candidate (étape 3) --------------------

// On vise 20-30 morceaux. Plancher pour que l'étape de vote ait de la matière.
const MIN_CANDIDATES = 20;
// Plafond dur pour éviter une liste de swipe interminable, tout en laissant
// dépasser 30 quand le consensus est large (cf. cahier des charges).
const HARD_MAX_CANDIDATES = 50;

// --- Constante du seuil d'exclusion (étape 6) --------------------------------

// Un morceau est exclu si dislikes >= ceil(N * EXCLUSION_RATIO).
// 0.4 donne : 2 pers -> 1 dislike, 4-5 -> 2, 6 -> 3, 8 -> 4.
const EXCLUSION_RATIO = 0.4;

// =============================================================================
// Étape 3 — Génération
// =============================================================================

export interface TrackLikeInput {
  participantId: string;
  trackId: string;
  title: string;
  artistName: string;
  artistId: string | null;
  cover: string | null;
  preview: string | null;
}

export interface ArtistLikeInput {
  participantId: string;
  artistId: string;
}

export interface ScoredCandidate {
  trackId: string;
  title: string;
  artistName: string;
  artistId: string | null;
  cover: string | null;
  preview: string | null;
  score: number;
  distinctSupporters: number; // nb de participants qui contribuent au score
}

/**
 * Croise les goûts de tous les participants et renvoie la liste candidate triée
 * par score décroissant.
 *
 * Univers des candidats = tous les morceaux likés en 2b par au moins une
 * personne (ces likes incluent déjà des morceaux d'artistes SIMILAIRES, donc
 * la découverte est capturée nativement).
 *
 * Pour chaque morceau T (d'artiste A) et chaque participant P :
 *   contribution(P, T) = W_DIRECT_LIKE        si P a liké T en 2b
 *                      = W_DECLARED_ARTIST     sinon si P a déclaré A en 2a
 *                      = 0                      sinon
 * (on prend le maximum : un like direct ne se cumule pas avec l'artiste déclaré)
 *
 *   score(T) = (Σ_P contribution) * (1 + CONSENSUS_BONUS * (supporters - 1))
 */
export function generateCandidates(
  trackLikes: TrackLikeInput[],
  artistLikes: ArtistLikeInput[]
): ScoredCandidate[] {
  // Index : artistes déclarés par participant (pour le tier W_DECLARED_ARTIST).
  const declaredByParticipant = new Map<string, Set<string>>();
  for (const a of artistLikes) {
    let set = declaredByParticipant.get(a.participantId);
    if (!set) {
      set = new Set();
      declaredByParticipant.set(a.participantId, set);
    }
    set.add(a.artistId);
  }

  // Agrège les likes par morceau (dédoublonnage par trackId).
  interface Agg {
    meta: TrackLikeInput;
    directLikers: Set<string>;
  }
  const byTrack = new Map<string, Agg>();
  for (const t of trackLikes) {
    let agg = byTrack.get(t.trackId);
    if (!agg) {
      agg = { meta: t, directLikers: new Set() };
      byTrack.set(t.trackId, agg);
    }
    agg.directLikers.add(t.participantId);
    // Complète les métadonnées manquantes au fil des occurrences.
    if (!agg.meta.cover && t.cover) agg.meta.cover = t.cover;
    if (!agg.meta.preview && t.preview) agg.meta.preview = t.preview;
  }

  // Ensemble de tous les participants (pour parcourir le tier "artiste déclaré").
  const allParticipants = new Set<string>();
  for (const t of trackLikes) allParticipants.add(t.participantId);
  for (const a of artistLikes) allParticipants.add(a.participantId);

  const scored: ScoredCandidate[] = [];
  for (const [trackId, agg] of byTrack) {
    const artistId = agg.meta.artistId;
    let raw = 0;
    const supporters = new Set<string>();

    for (const p of allParticipants) {
      let contribution = 0;
      if (agg.directLikers.has(p)) {
        contribution = W_DIRECT_LIKE;
      } else if (artistId && declaredByParticipant.get(p)?.has(artistId)) {
        contribution = W_DECLARED_ARTIST;
      }
      if (contribution > 0) {
        raw += contribution;
        supporters.add(p);
      }
    }

    const consensusFactor = 1 + CONSENSUS_BONUS * (supporters.size - 1);
    scored.push({
      trackId,
      title: agg.meta.title,
      artistName: agg.meta.artistName,
      artistId,
      cover: agg.meta.cover,
      preview: agg.meta.preview,
      score: raw * consensusFactor,
      distinctSupporters: supporters.size,
    });
  }

  // Tri : score desc, puis nb de supporters desc, puis trackId pour la stabilité.
  scored.sort(
    (a, b) =>
      b.score - a.score ||
      b.distinctSupporters - a.distinctSupporters ||
      a.trackId.localeCompare(b.trackId)
  );

  // Sélection de la taille de liste :
  //  - on garde d'abord tous les morceaux à VRAI consensus (>= 2 supporters),
  //    plafonnés à HARD_MAX pour ne pas exploser la longueur du swipe ;
  //  - si on est sous le plancher, on complète avec les meilleurs morceaux
  //    à 1 seul supporter.
  const consensus = scored.filter((s) => s.distinctSupporters >= 2);
  const singles = scored.filter((s) => s.distinctSupporters < 2);

  let selected = consensus.slice(0, HARD_MAX_CANDIDATES);
  if (selected.length < MIN_CANDIDATES) {
    const need = MIN_CANDIDATES - selected.length;
    selected = selected.concat(singles.slice(0, need));
  }
  return selected;
}

// =============================================================================
// Étape 6 — Résultat
// =============================================================================

/**
 * Seuil d'exclusion : un morceau est exclu si son nombre de dislikes ATTEINT
 * ou DÉPASSE ce seuil. Proportionnel au nombre de participants.
 */
export function exclusionThreshold(participantCount: number): number {
  return Math.ceil(participantCount * EXCLUSION_RATIO);
}

export interface CandidateTally {
  candidateId: string;
  title: string;
  artistName: string;
  likes: number;
  dislikes: number;
}

export interface FinalResult {
  threshold: number;
  kept: Array<CandidateTally & { net: number }>;
  excluded: Array<CandidateTally & { net: number }>;
}

/**
 * Applique le seuil d'exclusion et trie la playlist finale.
 * @param tallies décompte likes/dislikes par morceau
 * @param participantCount N = nombre de participants ayant effectivement voté
 *        (figé au moment du calcul, cf. décision de design sur les retardataires)
 */
export function computeFinalResult(
  tallies: CandidateTally[],
  participantCount: number
): FinalResult {
  const threshold = exclusionThreshold(participantCount);

  const withNet = tallies.map((t) => ({ ...t, net: t.likes - t.dislikes }));

  const kept = withNet.filter((t) => t.dislikes < threshold);
  const excluded = withNet.filter((t) => t.dislikes >= threshold);

  // Tri de la playlist gardée : score net desc, puis likes desc, puis titre.
  kept.sort(
    (a, b) => b.net - a.net || b.likes - a.likes || a.title.localeCompare(b.title)
  );

  return { threshold, kept, excluded };
}
