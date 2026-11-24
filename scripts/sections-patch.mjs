// מזריק לדאשבורד את פופאפ חתכי הרחוב. עוגן: הפונקציה presProject בדאשבורד המקורי.
// הקוד מוכנס לפניה (אותו scope), ונקרא כשורה הראשונה בה. בטוח להרצה חוזרת. אם העוגן חסר: לא משנים, ומחזירים אזהרה.
import { readFileSync } from "node:fs";

const read = (f) => readFileSync(new URL(f, import.meta.url), "utf8");
export const CORE = read("./sections-core.snippet.js");
export const UI = read("./sections-ui.snippet.js");
export const SX_MARK = "/* sections:";
const ANCHOR = /^([ \t]*)function presProject\(body, p\) \{[ \t]*(\r?\n)/m;   // תומך גם בסיומות שורה של Windows (CRLF)

export function patchSections(html) {
  const log = [], warn = [];
  if (html.includes(SX_MARK)) { log.push("פופאפ חתכי הרחוב כבר מוזרק"); return { html, log, warn }; }
  if (!ANCHOR.test(html)) {
    warn.push("לא נמצאה הפונקציה presProject. פופאפ החתכים לא הוזרק. שלחי לי את שורות presProject מהדאשבורד.");
    return { html, log, warn };
  }
  html = html.replace(ANCHOR, (m, indent, nl) => {
    const code = (CORE + "\n" + UI).trimEnd().split("\n").map((l) => indent + l).join(nl);
    return code + nl + m + indent + "  try { sxBlock(body, p); } catch (e) { console.error('sections', e); }" + nl;
  });
  log.push("הוזרק פופאפ חתכי רחוב (קיים | מוצע)");
  return { html, log, warn };
}
