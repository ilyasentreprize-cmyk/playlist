// Génération du code de session : 4 caractères, alphabet sans ambiguïté
// (pas de 0/O, 1/I/L) pour être dicté facilement à l'oral dans une voiture.

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateCode(length = 4): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}
