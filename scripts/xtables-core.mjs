// טוען את אותו קוד שמוזרק לדאשבורד, כדי שהבדיקות ירוצו על הקוד האמיתי.
import { readFileSync } from "node:fs";
const src = readFileSync(new URL("./xtables-core.snippet.js", import.meta.url), "utf8");
export const { XT_PLAN_HEAD, XT_PLAN_WIDTHS, XT_PROJ_HEAD, XT_PROJ_WIDTHS, xtPlanRows, xtProjectRows } = new Function(
  src + "\nreturn { XT_PLAN_HEAD, XT_PLAN_WIDTHS, XT_PROJ_HEAD, XT_PROJ_WIDTHS, xtPlanRows, xtProjectRows };")();
