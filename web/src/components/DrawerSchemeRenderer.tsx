"use client";

import { useState } from "react";
import {
  buildSchemeViewBox,
  computeZoneRenders,
  BRAND,
  ZONE_GAP,
  type ZoneData,
  type DrawerSize,
} from "@/lib/schemeSvg";

const FRAME_PAD = 14;
const FRAME_RADIUS = 10;
const ZONE_RADIUS = 6;

interface Props {
  zones: ZoneData[];
  drawer: DrawerSize;
  className?: string;
}

export default function DrawerSchemeRenderer({ zones, drawer, className }: Props) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const { innerW, innerH, totalW, totalH } = buildSchemeViewBox(drawer);
  const zoneRenders = computeZoneRenders(zones);

  return (
    <svg
      viewBox={`0 0 ${totalW} ${totalH}`}
      className={className}
      style={{ width: "100%", height: "auto" }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x={0} y={0} width={totalW} height={totalH} fill={BRAND.frame} rx={FRAME_RADIUS} ry={FRAME_RADIUS} />
      <rect x={FRAME_PAD - 4} y={FRAME_PAD - 4} width={innerW + 8} height={innerH + 8} fill={BRAND.frameInner} rx={FRAME_RADIUS - 2} ry={FRAME_RADIUS - 2} />
      <rect x={FRAME_PAD} y={FRAME_PAD} width={innerW} height={innerH} fill={BRAND.drawerBg} rx={4} ry={4} />

      {zoneRenders.map((z) => {
        const isHovered = hoveredId === z.zone_id;
        const cx = z.px + z.pw / 2;
        const cy = z.py + z.ph / 2;

        if (z.isReserve) {
          const fs = Math.max(7, Math.min(11, z.ph * 0.14));
          return (
            <g key={z.zone_id}>
              <rect
                x={z.px} y={z.py} width={z.pw} height={z.ph}
                fill="#F5EFE6" fillOpacity={0.5}
                stroke={BRAND.frame} strokeWidth={1.5} strokeDasharray="5,4"
                rx={ZONE_RADIUS} ry={ZONE_RADIUS}
              />
              <text x={cx} y={cy + fs * 0.4} textAnchor="middle" fontFamily="Manrope, Arial, sans-serif"
                fontSize={fs} fill={BRAND.frame} opacity={0.65} letterSpacing="0.05em" pointerEvents="none">
                Свободно
              </text>
            </g>
          );
        }

        const blockFs = Math.max(7, Math.min(10, z.ph * 0.15));
        const nameFs  = Math.max(8, Math.min(13, z.ph * 0.22));
        const half = ZONE_GAP / 2;

        return (
          <g key={z.zone_id} onMouseEnter={() => setHoveredId(z.zone_id)} onMouseLeave={() => setHoveredId(null)} style={{ cursor: "default" }}>
            <rect
              x={z.px - (isHovered ? half : 0)} y={z.py - (isHovered ? half : 0)}
              width={z.pw + (isHovered ? ZONE_GAP : 0)} height={z.ph + (isHovered ? ZONE_GAP : 0)}
              fill={z.fillColor} stroke={isHovered ? BRAND.accent : z.strokeColor}
              strokeWidth={isHovered ? 2 : 1} rx={ZONE_RADIUS} ry={ZONE_RADIUS}
              style={{ transition: "all 0.15s ease" }}
            />
            <text x={cx} y={cy - nameFs * 0.55} textAnchor="middle" fontFamily="Manrope, Arial, sans-serif"
              fontSize={blockFs} fill={BRAND.textLight} pointerEvents="none">
              Блок {z.index}.
            </text>
            <text x={cx} y={cy + nameFs * 0.8} textAnchor="middle" fontFamily="Manrope, Arial, sans-serif"
              fontSize={nameFs} fontWeight="700" fill={BRAND.text} pointerEvents="none">
              {z.labelRu}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
