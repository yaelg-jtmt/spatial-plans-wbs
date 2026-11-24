// מזריק לדאשבורד את הורדת הטבלאות: תב"עות לפי מרחב, ופרויקטים שעוברים בתחום תב"ע.
// שני עוגנים חייבים להימצא, ואם אחד חסר לא משנים כלום: (1) שורת הכפתורים של ייצוא Xplan ב-HTML, (2) הקריאה xpWire(); ב-JS.
import { readFileSync } from "node:fs";

const read = (f) => readFileSync(new URL(f, import.meta.url), "utf8");
export const CORE = read("./xtables-core.snippet.js");
export const UI = read("./xtables-ui.snippet.js");
export const XT_MARK = "/* xtables:";
const HTML_ANCHOR = /(id="xpLinksX">[^<]*<\/button><\/div>)/;
const JS_ANCHOR = /^xpWire\(\);[ \t]*(\r?\n)/m;
export const XT_HTML = `
        <div class="gh" style="margin-top:14px"><h2>הורדת טבלאות</h2></div>
        <p class="hint">טבלת תב"עות לפי מרחב, וטבלת הפרויקטים שעוברים בתחום תב"ע. אפשר גם מחלון התב"ע במפה. הקבצים בפורמט אקסל.</p>
        <div class="toggles"><label>מרחב <select id="xtSpace"></select></label>
          <label title="בלי סינון הסמכות, יח&quot;ד, הסטטוס והאחוז בתוך המרחב שמוגדרים למעלה"><input type="checkbox" id="xtAll"> ללא סינון (כל התב"עות שנשלפו)</label></div>
        <div class="chips" style="margin:6px 0"><button class="btn small" type="button" id="xtPlansBtn">הורדת טבלת תב"עות</button></div>
        <div class="toggles"><label>תב"ע <select id="xtPlan" style="max-width:100%"><option value="">בחרי מרחב…</option></select></label></div>
        <div class="chips" style="margin:6px 0"><button class="btn small" type="button" id="xtProjBtn">הורדת הפרויקטים שעוברים בתב"ע</button></div>
        <p class="hint" id="xtStatus"></p>`;

export function patchXtables(html) {
  const log = [], warn = [];
  if (html.includes(XT_MARK)) { log.push("הורדת הטבלאות כבר מוזרקת"); return { html, log, warn }; }
  const okHtml = HTML_ANCHOR.test(html), okJs = JS_ANCHOR.test(html);
  if (!okHtml || !okJs) {
    if (!okHtml) warn.push('לא נמצאה שורת כפתורי הייצוא של Xplan (id="xpLinksX"). הורדת הטבלאות לא הוזרקה.');
    if (!okJs) warn.push("לא נמצאה הקריאה xpWire(); ב-JS. הורדת הטבלאות לא הוזרקה.");
    return { html, log, warn };
  }
  const nl = JS_ANCHOR.exec(html)[1];   // סיומת השורה של הקובץ (LF או CRLF), גם ל-HTML המוזרק
  html = html.replace(HTML_ANCHOR, (m) => m + XT_HTML.split("\n").join(nl));
  html = html.replace(JS_ANCHOR, (m) => m + (CORE + "\n" + UI).trimEnd().split("\n").join(nl) + nl);
  log.push("הוזרקה הורדת טבלאות (תב\"עות לפי מרחב, פרויקטים בתחום תב\"ע)");
  return { html, log, warn };
}
