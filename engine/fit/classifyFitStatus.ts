import type { FitStatus } from "../types.js";
export function classifyFitStatus(placedCount: number, totalCount: number): FitStatus {
  if (placedCount === totalCount) return "fit_all";
  if (placedCount > 0) return "fit_partial";
  return "fit_none";
}
