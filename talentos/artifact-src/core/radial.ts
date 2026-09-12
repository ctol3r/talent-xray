/**
 * Geometry for the next-steps wheel (W20.2): eight equal ring segments
 * around a hub, one per lettered step A–H. Pure functions — the UI positions
 * buttons and draws paths from these numbers, and the tests check them.
 *
 * Angles are in degrees, 0 at twelve o'clock, increasing clockwise, so
 * segment 0 (step A) sits at the top and the letters read round like a clock.
 */
export interface Point {
  x: number;
  y: number;
}

export interface Segment {
  index: number;
  startAngle: number;
  endAngle: number;
  /** SVG path for the ring slice. */
  path: string;
  /** Where the segment's button sits (mid-angle, mid-radius). */
  anchor: Point;
}

const round = (n: number): number => Math.round(n * 1000) / 1000;

export function polar(center: Point, radius: number, angleDeg: number): Point {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: round(center.x + radius * Math.cos(rad)),
    y: round(center.y + radius * Math.sin(rad)),
  };
}

/** A ring slice between two angles, with a small gap so slices read apart. */
export function segmentPath(
  center: Point,
  outer: number,
  inner: number,
  startAngle: number,
  endAngle: number,
  gapDeg = 2,
): string {
  const a0 = startAngle + gapDeg / 2;
  const a1 = endAngle - gapDeg / 2;
  const large = a1 - a0 > 180 ? 1 : 0;
  const o0 = polar(center, outer, a0);
  const o1 = polar(center, outer, a1);
  const i1 = polar(center, inner, a1);
  const i0 = polar(center, inner, a0);
  return [
    `M ${o0.x} ${o0.y}`,
    `A ${outer} ${outer} 0 ${large} 1 ${o1.x} ${o1.y}`,
    `L ${i1.x} ${i1.y}`,
    `A ${inner} ${inner} 0 ${large} 0 ${i0.x} ${i0.y}`,
    "Z",
  ].join(" ");
}

export interface WheelSpec {
  /** Width and height of the square drawing box. */
  size: number;
  /** Ring thickness as a fraction of the radius (0–1). */
  thickness: number;
  count: number;
}

export function wheelSegments(spec: WheelSpec): Segment[] {
  const center = { x: spec.size / 2, y: spec.size / 2 };
  const outer = spec.size / 2 - 2;
  const inner = outer * (1 - spec.thickness);
  const sweep = 360 / spec.count;
  const out: Segment[] = [];
  for (let i = 0; i < spec.count; i += 1) {
    // Segment 0 is centred on twelve o'clock.
    const startAngle = i * sweep - sweep / 2;
    const endAngle = startAngle + sweep;
    out.push({
      index: i,
      startAngle,
      endAngle,
      path: segmentPath(center, outer, inner, startAngle, endAngle),
      anchor: polar(center, (outer + inner) / 2, startAngle + sweep / 2),
    });
  }
  return out;
}

/** Which segment an angle falls in (for pointer or key handling). */
export function segmentAt(angleDeg: number, count: number): number {
  const sweep = 360 / count;
  const a = (((angleDeg + sweep / 2) % 360) + 360) % 360;
  return Math.floor(a / sweep);
}

/** Hub radius in the same box, so the centre content stays inside the hole. */
export function hubRadius(spec: WheelSpec): number {
  const outer = spec.size / 2 - 2;
  return round(outer * (1 - spec.thickness) - 6);
}
