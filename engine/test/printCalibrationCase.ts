declare const process: { argv: string[] };
import { buildBaseCalibrationCaseReport, buildForcedOpenFallbackCalibrationCaseReport, buildFourItemStressCalibrationCaseReport } from "../calibration/buildCalibrationCaseReport.js";
const reportName = process.argv[2] ?? "base";
const report = reportName === "forced-open-fallback" ? buildForcedOpenFallbackCalibrationCaseReport() : reportName === "four-item-stress" ? buildFourItemStressCalibrationCaseReport() : buildBaseCalibrationCaseReport();
console.log(JSON.stringify(report, null, 2));
