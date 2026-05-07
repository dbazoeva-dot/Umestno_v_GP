import type { DrawerSize, PlacedZone } from "../types.js";
type FreeRectangle = { x_cm: number; y_cm: number; w_cm: number; d_cm: number; h_cm: number };
export function findFreeRectangles(drawerSize: DrawerSize, placed: PlacedZone[]): FreeRectangle[] {
  if (placed.length === 0) return [{ x_cm: 0, y_cm: 0, w_cm: drawerSize.w_cm, d_cm: drawerSize.d_cm, h_cm: drawerSize.h_cm }];
  const xCuts = uniqueSorted([0, drawerSize.w_cm, ...placed.map((zone) => zone.x_cm), ...placed.map((zone) => zone.x_cm + zone.assigned_w_cm)]);
  const yCuts = uniqueSorted([0, drawerSize.d_cm, ...placed.map((zone) => zone.y_cm), ...placed.map((zone) => zone.y_cm + zone.assigned_d_cm)]);
  const occupied = Array.from({ length: yCuts.length - 1 }, (_, row) => Array.from({ length: xCuts.length - 1 }, (_, col) => {
    const cell = { x_cm: xCuts[col], y_cm: yCuts[row], w_cm: xCuts[col + 1] - xCuts[col], d_cm: yCuts[row + 1] - yCuts[row] };
    return placed.some((zone) => rectanglesOverlap(cell, { x_cm: zone.x_cm, y_cm: zone.y_cm, w_cm: zone.assigned_w_cm, d_cm: zone.assigned_d_cm }));
  }));
  const rects: FreeRectangle[] = [];
  for (let row = 0; row < yCuts.length - 1; row += 1) for (let col = 0; col < xCuts.length - 1; col += 1) {
    if (occupied[row][col]) continue;
    for (let endCol = col; endCol < xCuts.length - 1 && !occupied[row][endCol]; endCol += 1) {
      let endRow = row;
      while (endRow < yCuts.length - 1 && rangeIsFree(occupied[endRow], col, endCol)) endRow += 1;
      rects.push({ x_cm: xCuts[col], y_cm: yCuts[row], w_cm: xCuts[endCol + 1] - xCuts[col], d_cm: yCuts[endRow] - yCuts[row], h_cm: drawerSize.h_cm });
    }
  }
  return dedupeRectangles(rects).filter((rect) => rect.w_cm > 0 && rect.d_cm > 0).sort((a, b) => a.y_cm - b.y_cm || a.x_cm - b.x_cm || b.w_cm * b.d_cm - a.w_cm * a.d_cm);
}
function uniqueSorted(values: number[]) { return [...new Set(values.map((value) => Number(value.toFixed(4))))].sort((a, b) => a - b); }
function rangeIsFree(row: boolean[], startCol: number, endCol: number) { for (let col = startCol; col <= endCol; col += 1) if (row[col]) return false; return true; }
function rectanglesOverlap(a: { x_cm: number; y_cm: number; w_cm: number; d_cm: number }, b: { x_cm: number; y_cm: number; w_cm: number; d_cm: number }) { return a.x_cm < b.x_cm + b.w_cm && a.x_cm + a.w_cm > b.x_cm && a.y_cm < b.y_cm + b.d_cm && a.y_cm + a.d_cm > b.y_cm; }
function dedupeRectangles(rects: FreeRectangle[]) { const seen = new Set<string>(); return rects.filter((rect) => { const key = `${rect.x_cm}:${rect.y_cm}:${rect.w_cm}:${rect.d_cm}`; if (seen.has(key)) return false; seen.add(key); return true; }); }
