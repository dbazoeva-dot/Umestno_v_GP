import type { PlacedZone } from "../types.js";

export function alignColumns(placed: PlacedZone[]): PlacedZone[] {
  const groups = new Map<number, PlacedZone[]>();
  for (const z of placed) {
    const key = Math.round(z.x_cm * 100) / 100;
    const group = groups.get(key);
    if (group) group.push(z);
    else groups.set(key, [z]);
  }

  const changes = new Map<string, number>();

  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const columnMaxW = Math.max(...group.map((z) => z.assigned_w_cm));

    for (const z of group) {
      if (z.assigned_w_cm >= columnMaxW) continue;

      let rightNeighbourX = Infinity;
      const zY2 = z.y_cm + z.assigned_d_cm;
      for (const other of placed) {
        if (other.x_cm <= z.x_cm) continue;
        const otherY2 = other.y_cm + other.assigned_d_cm;
        if (z.y_cm < otherY2 && other.y_cm < zY2 && other.x_cm < rightNeighbourX) {
          rightNeighbourX = other.x_cm;
        }
      }

      const safeW = Math.min(columnMaxW, rightNeighbourX - z.x_cm);
      if (safeW > z.assigned_w_cm) changes.set(z.zone_id, safeW);
    }
  }

  if (changes.size === 0) return placed;
  return placed.map((z) => {
    const newW = changes.get(z.zone_id);
    return newW !== undefined ? { ...z, assigned_w_cm: newW } : z;
  });
}
