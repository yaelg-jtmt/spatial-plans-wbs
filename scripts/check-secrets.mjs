// נכשל בבנייה אם נמצאו מפתחות/טוקנים בקוד או בקבצים הציבוריים.
// ALLOW_SECRETS=1 npm run build  -> עוקף (לא מומלץ)
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const ROOTS = ["src", "public", "index.html"];
const EXT = new Set([".js", ".jsx", ".mjs", ".html", ".json", ".css", ".txt"]);
const PATTERNS = [
  [/(api[_-]?key|apikey|access[_-]?token|secret|token)\s*["']?\s*[:=]\s*["'][A-Za-z0-9_\-\.]{16,}["']/gi, "מפתח/טוקן בקוד"],
  [/carto[^\n]{0,120}(key|token)[^\n]{0,40}["'][A-Za-z0-9_\-]{12,}["']/gi, "מפתח CARTO"],
  [/AIza[0-9A-Za-z_\-]{30,}/g, "Google API key"],
  [/gh[pousr]_[A-Za-z0-9]{30,}/g, "GitHub token"],
  [/Bearer\s+[A-Za-z0-9_\-\.]{20,}/g, "Bearer token"],
];

function* walk(p) {
  if (p.replace(/\\/g, "/").endsWith("public/dashboard/config.js")) return; // מוחרג מ-Git, נוצר ב-CI
  const st = statSync(p, { throwIfNoEntry: false });
  if (!st) return;
  if (st.isFile()) { if (EXT.has(extname(p)) || p.endsWith("index.html")) yield p; return; }
  for (const f of readdirSync(p)) yield* walk(join(p, f));
}

const hits = [];
for (const root of ROOTS) {
  for (const file of walk(root)) {
    const text = readFileSync(file, "utf8");
    for (const [re, label] of PATTERNS) {
      for (const m of text.matchAll(re)) {
        const line = text.slice(0, m.index).split("\n").length;
        hits.push(`${file}:${line}  ${label}`);
      }
    }
  }
}

if (hits.length && process.env.ALLOW_SECRETS !== "1") {
  console.error("\n❌ נמצאו מפתחות אפשריים. יש להסיר לפני פרסום:\n" + hits.map((h) => " - " + h).join("\n"));
  process.exit(1);
}
console.log(hits.length ? "⚠️ נמצאו ממצאים, אבל ALLOW_SECRETS=1" : "✅ לא נמצאו מפתחות בקוד.");
