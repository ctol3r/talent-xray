/** Stable keyword identity only; colour does not imply qualification or fit. */
export function keywordHue(target: string): number {
  const key = target.replace(/^tag:/, "").trim().toLowerCase();
  let hash = 2166136261;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % 360;
}
