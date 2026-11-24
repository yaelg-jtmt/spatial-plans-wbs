// מחיל על הדאשבורד המקורי שני שינויים, בלי לגעת בשאר הקוד:
//  1. מסתיר את כפתור וחלון "טעינת שכבות ומצגת" (CSS בלבד, כך שהקוד שמסתמך על אלמנטים אלה ממשיך לעבוד).
//  2. מזריק לפונקציית ה-boot טעינה של שכבות ומצגות מקבצי האתר (data/layers/manifest.json).
// בטוח להרצה חוזרת. אם עוגן לא נמצא, השינוי לא מוחל ומוחזרת אזהרה מפורשת.
import { readFileSync } from "node:fs";

const SNIPPET = readFileSync(new URL("./repo-content.snippet.js", import.meta.url), "utf8");
export const MARK = "/* repo-content:";
const CSS_ID = "repo-content-css";
const CSS = `<style id="${CSS_ID}">#openData,#dataDlg{display:none!important}</style>`;
// העוגן: השורה בפונקציית ה-boot שאחרי לולאת DEFAULT_ZIPS ולפני loading.remove()
const ANCHOR = /^([ \t]*)if \(DEFAULT_DECK && DEFAULT_DECK\.url\)/m;

export function patchDashboard(html) {
  const log = [], warn = [];
  if (!html.includes(`id="${CSS_ID}"`)) {
    if (/<\/head>/i.test(html)) { html = html.replace(/<\/head>/i, CSS + "\n</head>"); log.push("הוסתר חלון 'טעינת שכבות ומצגת'"); }
    else warn.push("לא נמצא </head>, החלון לא הוסתר");
  }
  if (html.includes(MARK)) log.push("טעינת התוכן מהאתר כבר מוזרקת");
  else if (ANCHOR.test(html)) {
    html = html.replace(ANCHOR, (m, indent) => SNIPPET.trimEnd().split("\n").map((l) => indent + l).join("\n") + "\n" + m);
    log.push("הוזרקה טעינת שכבות ומצגות מקבצי האתר");
  } else warn.push("לא נמצא העוגן 'if (DEFAULT_DECK && DEFAULT_DECK.url)' ב-boot. שכבות האתר לא יטענו. שלחי לי את שורות ה-boot שבסוף הקובץ.");
  return { html, log, warn };
}
