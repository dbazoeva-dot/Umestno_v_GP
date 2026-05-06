import type { UserInput } from "../types.js";
import { baseCalibrationInput, forcedOpenFallbackCalibrationInput } from "./buildCalibrationCaseReport.js";

export const calibrationCases: Array<{ id: string; input: UserInput; should_not: string[]; expected: string[] }> = [
  {
    id: "base_90x45x15_underwear_medium",
    input: baseCalibrationInput,
    should_not: ["fit_none"],
    expected: ["fit_all", "fit_partial", "fit_all_after_adjustment"]
  },
  {
    id: "forced_open_fallback_75x45x15_underwear_medium",
    input: forcedOpenFallbackCalibrationInput,
    should_not: ["fit_none"],
    expected: ["fit_all", "fit_partial", "fit_all_after_adjustment"]
  }
];
