import type { PlacedZone } from "../types.js";

// Gaps to a right-neighbour zone narrower than this can't hold a useful organiser,
// so we absorb them into the zone instead of leaving a thin reserve sliver.
const SLIVER_MAX_CM = 8;

export function alignColumns(placed: PlacedZone[]): PlacedZone[] {
  const changes = new Map<string, number>();
  const widthOf = (z: PlacedZone): number => changes.get(z.zone_id) ?? z.assigned_w_cm;

  // nearest right-neighbour zone left edge within z's depth span (Infinity = open space)
  function rightNeighbourX(z: PlacedZone): number {
    let x = Infinity;
    const zY2 = z.y_cm + z.assigned_d_cm;
    for (const other of placed) {
      if (other === z || other.x_cm <= z.x_cm) continue;
      const otherY2 = other.y_cm + other.assigned_d_cm;
      if (z.y_cm < otherY2 && other.y_cm < zY2 && other.x_cm < x) x = other.x_cm;
    }
    return x;
  }

  // 1) equalize widths within each left-aligned column (narrow zones grow to the
  //    column's widest, capped by their own right neighbour)
  const groups = new Map<number, PlacedZone[]>();
  for (const z of placed) {
    const key = Math.round(z.x_cm * 100) / 100;
    const group = groups.get(key);
    if (group) group.push(z);
    else groups.set(key, [z]);
  }
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const columnMaxW = Math.max(...group.map((z) => z.assigned_w_cm));
    for (const z of group) {
      if (z.assigned_w_cm >= columnMaxW) continue;
      const safeW = Math.min(columnMaxW, rightNeighbourX(z) - z.x_cm);
      if (safeW > z.assigned_w_cm) changes.set(z.zone_id, safeW);
    }
  }

  // 2) absorb thin slivers: extend a zone to its right-neighbour zone when the
  //    remaining gap is too small to be a useful reserve, so blocks stay tiled
  //    (e.g. bras ending where the front row ends). Open space at the drawer
  //    edge (no neighbour) is left untouched — that is the real reserve.
  for (const z of placed) {
    const neighbourX = rightNeighbourX(z);
    if (!Number.isFinite(neighbourX)) continue;
    const gap = neighbourX - (z.x_cm + widthOf(z));
    if (gap > 0 && gap <= SLIVER_MAX_CM) changes.set(z.zone_id, neighbourX - z.x_cm);
  }

  if (changes.size === 0) return placed;
  return placed.map((z) => {
    const newW = changes.get(z.zone_id);
    return newW !== undefined ? { ...z, assigned_w_cm: newW } : z;
  });
}
