/**
 * The candidate deck (W20.3): a fanned stack of cards, one per record, with
 * the chosen card in front. Ordering and poses are pure so they can be
 * tested; the UI only applies them. A card's colour follows the record, not
 * its position, so bringing one forward never recolours the rest.
 */
export interface CardPose {
  /** Position in the fan: 0 is the front card. */
  position: number;
  x: number;
  y: number;
  scale: number;
  /** Stacking order — the front card is on top. */
  z: number;
  /** Cards past the visible depth are hidden, not removed. */
  visible: boolean;
}

/** How many cards the fan shows before it says "+N more". */
export const DECK_DEPTH = 6;

/** Each card behind shows its name row: the stripe plus one line of text. */
const STEP_X = 30;
const STEP_Y = -44;
const STEP_SCALE = 0.03;

export function cardPose(position: number): CardPose {
  const p = Math.max(0, position);
  return {
    position: p,
    x: p * STEP_X,
    y: p === 0 ? 0 : p * STEP_Y,
    scale: Math.max(0.6, 1 - p * STEP_SCALE),
    z: 100 - p,
    visible: p < DECK_DEPTH,
  };
}

/** The front card first, everything else in its original order. */
export function deckOrder<T extends { id: string }>(
  items: readonly T[],
  frontId: string | null,
): T[] {
  if (!frontId) return [...items];
  const front = items.find((i) => i.id === frontId);
  if (!front) return [...items];
  return [front, ...items.filter((i) => i.id !== frontId)];
}

/** The card after `id` in the fan, wrapping — for arrow-key cycling. */
export function nextInDeck<T extends { id: string }>(
  items: readonly T[],
  id: string | null,
  direction: 1 | -1,
): string | null {
  if (!items.length) return null;
  const at = id ? items.findIndex((i) => i.id === id) : -1;
  if (at < 0) return items[0].id;
  const next = (at + direction + items.length) % items.length;
  return items[next].id;
}

/** Six distinguishable stripe hues; indexed by the record's own position. */
export const DECK_HUES = [204, 262, 340, 20, 152, 46] as const;

export function hueFor(index: number): number {
  return DECK_HUES[
    ((index % DECK_HUES.length) + DECK_HUES.length) % DECK_HUES.length
  ];
}
