// Fixed, UUID-shaped ids derived from a name, so a repeated seed writes the same rows.
function fnv(text: string, seed: number) {
  let h = seed >>> 0;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h.toString(16).padStart(8, '0');
}
export function fixedId(name: string) {
  const hex = [0x811c9dc5, 0x01000193, 0x9e3779b9, 0x85ebca6b].map(seed => fnv(name, seed)).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
/** A stable fraction in [0, 1) for a name: the seed's only "randomness". */
export const chance = (name: string) => parseInt(fnv(name, 0x2545f491), 16) / 0x1_0000_0000;
