// שימוש:
//   node scripts/prepare-dashboard.mjs "<נתיב>/דאשבורד_תכניות_מרחביות_G5.html"
//
// מה הסקריפט עושה:
//  1. מעתיק את הדאשבורד אל public/dashboard/index.html
//  2. מוציא מפתחות ו-ID של תיקיית Drive אל public/dashboard/config.js (מוחרג מ-Git)
//  3. מסיר את בלוק המטא-דאטה של SharePoint (כתובת פנימית של הארגון)
//  4. מוסיף <script src="config.js"> לפני שאר הסקריפטים ו-<script src="bridge.js"> לפני </body>
// ההרצה בטוחה לחזרה: אפשר להריץ שוב על קובץ מקור חדש.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = process.argv[2];
if (!src || !existsSync(src)) {
  console.error('❌ יש לציין נתיב לקובץ הדאשבורד המקורי.\n   node scripts/prepare-dashboard.mjs "<path>.html"');
  process.exit(1);
}

let html = readFileSync(src, "utf8");
const log = [];
const warn = [];

// 1) הוצאת קבועים רגישים -> window.DASHBOARD_CONFIG
const CONSTS = [
  ["CARTO_KEY", "cartoKey"],
  ["GOOGLE_API_KEY", "googleApiKey"],
  ["DRIVE_FOLDER_ID", "driveFolderId"],
];
const config = {};
for (const [name, prop] of CONSTS) {
  const re = new RegExp(`\\b(const|let|var)\\s+${name}\\s*=\\s*(['"\`])([^'"\`]*)\\2`);
  const m = html.match(re);
  if (!m) { warn.push(`לא נמצא הקבוע ${name} (אולי שמו שונה, יש לבדוק ידנית)`); continue; }
  config[prop] = m[3];
  html = html.replace(re, `$1 ${name} = (window.DASHBOARD_CONFIG && window.DASHBOARD_CONFIG.${prop}) || ''`);
  log.push(`הוצא ${name} -> config.js (${prop})`);
}

// 2) הסרת בלוק SharePoint (תנאי mso עם כתובת פנימית)
const msoRe = /<!--\[if gte mso 9\]>[\s\S]*?<!\[endif\]-->/g;
if (msoRe.test(html)) { html = html.replace(msoRe, ""); log.push("הוסר בלוק מטא-דאטה של SharePoint"); }
html = html.replace(/\sxmlns:mso="[^"]*"/, "").replace(/\sxmlns:msdt="[^"]*"/, "");

// 3) הזרקת config.js לפני הסקריפט הראשון, ו-bridge.js לפני </body>
if (!/src=["']config\.js["']/.test(html)) {
  const i = html.search(/<script\b/i);
  if (i < 0) { console.error("❌ לא נמצאו תגי <script> בקובץ"); process.exit(1); }
  html = html.slice(0, i) + '<script src="config.js"></script>\n' + html.slice(i);
  log.push("נוסף config.js");
}
if (!/src=["']bridge\.js["']/.test(html)) {
  const j = html.lastIndexOf("</body>");
  if (j < 0) { console.error("❌ לא נמצא </body>"); process.exit(1); }
  html = html.slice(0, j) + '<script src="bridge.js"></script>\n' + html.slice(j);
  log.push("נוסף bridge.js");
}

// 4) בדיקות תקינות
if (!/id=["']planSel["']/.test(html)) warn.push('לא נמצא #planSel, ה-bridge לא יוכל לסנכרן תכניות');
for (const k of ["AIza", "cb1_"]) if (html.includes(k)) warn.push(`עדיין נראה שיש מפתח בקוד (התחלה: ${k}…)`);

// 5) כתיבה
const out = resolve(root, "public/dashboard");
mkdirSync(out, { recursive: true });
writeFileSync(resolve(out, "index.html"), html);
const cfgText =
  "// נוצר אוטומטית. מוחרג מ-Git. ב-CI נוצר מ-GitHub Secrets.\n" +
  "window.DASHBOARD_CONFIG = " + JSON.stringify(config, null, 2) + ";\n";
writeFileSync(resolve(out, "config.js"), cfgText);
writeFileSync(
  resolve(out, "config.example.js"),
  "// העתיקי ל-config.js ומלאי ערכים. config.js לא נכנס ל-Git.\n" +
  'window.DASHBOARD_CONFIG = { cartoKey: "", googleApiKey: "", driveFolderId: "" };\n'
);

console.log("✅ public/dashboard/index.html נוצר\n" + log.map((l) => " - " + l).join("\n"));
if (warn.length) console.log("\n⚠️ לבדיקה:\n" + warn.map((w) => " - " + w).join("\n"));
