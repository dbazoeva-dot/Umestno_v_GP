export function calculateOpenCapacityInBox({ availableBox, unit, clearances, itemGap, itemGapIfOpen, requiredCount }: { availableBox: { w_cm:number; d_cm:number; h_cm:number }; unit: { w_cm:number; d_cm:number; h_cm:number }; clearances: { side_clear?:number; fb_clear?:number; h_clear?:number }; itemGap?: number; itemGapIfOpen?: number; requiredCount: number }) {
  const gap = itemGapIfOpen ?? itemGap ?? 0;
  const usableW = availableBox.w_cm - 2 * (clearances.side_clear ?? 0);
  const usableD = availableBox.d_cm - 2 * (clearances.fb_clear ?? 0);
  const cols = Math.max(0, Math.floor((usableW + gap) / (unit.w_cm + gap)));
  const rows = Math.max(0, Math.floor((usableD + gap) / (unit.d_cm + gap)));
  const capacity = cols * rows;
  const heightOk = unit.h_cm + (clearances.h_clear ?? 0) <= availableBox.h_cm;
  return { cols, rows, capacity, requiredCount, reserveCapacity: capacity - requiredCount, heightOk, fits: capacity >= requiredCount && heightOk };
}
