// טוען את לוגיקת ההתאמה מאותו קובץ שמוזרק לדאשבורד, כך שהדוח, הבדיקות והדאשבורד משתמשים בקוד אחד.
import { readFileSync } from "node:fs";
const src = readFileSync(new URL("./sections-core.snippet.js", import.meta.url), "utf8");
export const { sxMatch, sxHasAlias, sxNorm, SX_STREET_SERVICES } = new Function(src + "\nreturn { sxMatch, sxHasAlias, sxNorm, SX_STREET_SERVICES };")();
