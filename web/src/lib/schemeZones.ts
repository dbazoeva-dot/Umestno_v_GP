// Builds the unified scheme_zones view model
import type { PlacedZone } from "@engine/types.js";

export interface SchemeZone {
  id: string;
  type: "content" | "reserve";
  content_type?: string;
  label: string;
  x: number;
  y: number;
  w: number;
  d: number;
  h?: number;
  division_type?: "cells" | "slots" | "open" | "reserve";
  warnings?: string[];
}

interface FreeRect {
  x_cm: number;
  y_cm: number;
  w_cm: number;
  d_cm: number;
  h_cm?: number;
}

// Pick the single largest non-trivial free rectangle as the visual reserve zone.
function selectBestReserveRect(
  rects: FreeRect[],
  drawerW: number,
  drawerD: number
): FreeRect | null {
  const minArea = drawerW * drawerD * 0.06;
  const sorted = rects
    .filter(r => r.w_cm * r.d_cm >= minArea)
    .sort((a, b) => b.w_cm * b.d_cm - a.w_cm * a.d_cm);
  return sorted[0] ?? null;
}

export function buildSchemeZones(
  assignedZones: PlacedZone[],
  reserveRects: FreeRect[],
  drawerW: number,
  drawerD: number,
  showDimensions: boolean
): SchemeZone[] {
  const contentZones: SchemeZone[] = assignedZones.map((z) => ({
    id: z.zone_id,
    type: "content",
    content_type: z.content_type,
    label: z.content_type,
    x: z.x_cm,
    y: z.y_cm,
    w: z.assigned_w_cm,
    d: z.assigned_d_cm,
    h: showDimensions ? z.zone_h_cm : undefined,
    division_type: z.division_type as SchemeZone["division_type"],
    warnings: z.soft_height_warning ? [z.soft_height_warning.message] : undefined,
  }));

  const best = selectBestReserveRect(reserveRects, drawerW, drawerD);
  const reserveZones: SchemeZone[] = best
    ? [{ id: "reserve_0", type: "reserve", label: "Свободно", x: best.x_cm, y: best.y_cm, w: best.w_cm, d: best.d_cm, h: best.h_cm, division_type: "reserve" }]
    : [];

  return [...contentZones, ...reserveZones];
}
