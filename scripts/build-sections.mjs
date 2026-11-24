#!/usr/bin/env node
// בונה את public/data/sections/sections.json מקבצי ה-CSV ב-data-src/sections/ (קובץ לכל תכנית, לדוגמה GI.csv).
//   node scripts/build-sections.mjs          בנייה + בדיקות (נכשל אם יש שגיאה)
//   node scripts/build-sections.mjs --check  בדיקה בלבד, בלי כתיבה (גם משמש את npm test)
// עמודות ב-CSV (שמירה מאקסל כ-"CSV UTF-8"): תכנית, רחוב, מקטע, מצב (קיים/מוצע), חלופה, קובץ תמונה, רוחב זכות דרך (מ'),
// הערה קצרה (מוצגת בפופאפ), קוד פרויקט / GIS (אופציונלי), הערת בדיקה (פנימי) (לא מוצגת).
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const FILE_RE = /^([A-Za-z]{2,4})_([a-z0-9-]+?)(?:_([A-Z]\d*))?_(existing|proposed)(?:-\d+)?\.(png|jpe?g|webp|svg)$/;
const MAX_KB_WARN = 300, MAX_KB_ERR = 1024;
const norm = (s) => String(s || "").replace(/[־–—\-_"'׳״`]/g, " ").replace(/\s+/g, " ").trim();

export function parseCsv(text) {
  text = text.replace(/^\uFEFF/, "");
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.some((x) => x.trim() !== ""));
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] || "").trim()])));
}
const col = (r, startsWith) => { const k = Object.keys(r).find((x) => x.startsWith(startsWith)); return k ? r[k] : ""; };

export function deriveAliases(name) {
  const toks = norm(name).split(" "), out = new Set([norm(name)]);
  for (let i = 1; i < toks.length - 0; i++) { const s = toks.slice(i); if (s.length >= 2) out.add(s.join(" ")); }
  return [...out].filter(Boolean);
}

export function buildSections({ csvFiles, imagesDir, aliases = {}, codes = {} }) {
  const errors = [], warnings = [], streets = new Map(), seenFiles = new Set();
  for (const { name: csvName, text } of csvFiles) {
    parseCsv(text).forEach((r, idx) => {
      const where = `${csvName} שורה ${idx + 2}`;
      const file = r["קובץ תמונה"], state = r["מצב"];
      const m = FILE_RE.exec(file || "");
      if (!m) { errors.push(`${where}: שם הקובץ "${file}" אינו בפורמט תכנית_רחוב_[מקטע]_existing|proposed.png (אותיות באנגלית)`); return; }
      const [, prefix, slug, code, kind] = m;
      if ((state === "קיים") !== (kind === "existing") || !["קיים", "מוצע"].includes(state)) { errors.push(`${where}: המצב "${state}" לא תואם לשם הקובץ ${file}`); return; }
      if (seenFiles.has(file)) { errors.push(`${where}: הקובץ ${file} מופיע פעמיים`); return; }
      seenFiles.add(file);
      const p = join(imagesDir, file);
      if (!existsSync(p)) { errors.push(`${where}: הקובץ ${file} לא נמצא ב-${imagesDir}`); return; }
      const kb = statSync(p).size / 1024;
      if (kb > MAX_KB_ERR) errors.push(`${where}: ${file} כבד מדי (${Math.round(kb)}KB, מקסימום ${MAX_KB_ERR}KB)`);
      else if (kb > MAX_KB_WARN) warnings.push(`${file}: ${Math.round(kb)}KB, מומלץ עד ${MAX_KB_WARN}KB`);
      const id = `${prefix}_${slug}`;
      if (!streets.has(id)) streets.set(id, { id, plan: r["תכנית"], name: r["רחוב"], aliases: [], codes: [], existing: null, proposed: [] });
      const st = streets.get(id);
      if (st.plan !== r["תכנית"]) errors.push(`${where}: הרחוב ${id} מופיע בשתי תכניות (${st.plan}, ${r["תכנית"]})`);
      const width = col(r, "רוחב זכות דרך").replace(",", ".");
      if (width && !/^\d+(\.\d+)?$/.test(width)) errors.push(`${where}: רוחב זכות דרך "${width}" אינו מספר`);
      const item = { file, width: width ? Number(width) : null, note: r["הערה קצרה"] || "" };
      for (const c of (r["קוד פרויקט / GIS"] || "").split(/[,;\s]+/).filter(Boolean)) if (!st.codes.includes(c)) st.codes.push(c);
      if (kind === "existing") {
        if (st.existing) errors.push(`${where}: לרחוב ${id} יש יותר מחתך קיים אחד`); else st.existing = item;
      } else {
        const digit = (code || "").replace(/\D/g, "");
        const alt = r["חלופה"];
        item.label = alt ? `חלופה ${alt}` + (digit ? ` – חתך ${digit}` : "") : `חלופה ${st.proposed.length + 1}`;
        st.proposed.push(item);
      }
    });
  }
  for (const st of streets.values()) {
    for (const c of codes[st.id] || []) if (!st.codes.includes(c)) st.codes.push(c);
    st.aliases = [...new Set([...deriveAliases(st.name), ...(aliases[st.id] || [])])];
    if (!st.existing) warnings.push(`${st.id}: אין חתך קיים`);
    if (!st.proposed.length) warnings.push(`${st.id}: אין חתך מוצע`);
  }
  const out = { streets: [...streets.values()].sort((a, b) => a.plan.localeCompare(b.plan, "he") || a.name.localeCompare(b.name, "he")) };
  return { manifest: out, errors, warnings };
}

export function loadAndBuild(root = ".") {
  const srcDir = join(root, "data-src/sections"), imagesDir = join(root, "public/data/sections/images");
  const csvFiles = readdirSync(srcDir).filter((f) => f.endsWith(".csv")).sort().map((f) => ({ name: f, text: readFileSync(join(srcDir, f), "utf8") }));
  const readJson = (f) => (existsSync(join(srcDir, f)) ? JSON.parse(readFileSync(join(srcDir, f), "utf8")) : {});
  return buildSections({ csvFiles, imagesDir, aliases: readJson("aliases.json"), codes: readJson("codes.json") });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const check = process.argv.includes("--check");
  const { manifest, errors, warnings } = loadAndBuild(".");
  warnings.forEach((w) => console.log("⚠️ " + w));
  if (errors.length) { console.error("\n❌ שגיאות:\n" + errors.map((e) => " - " + e).join("\n")); process.exit(1); }
  const out = JSON.stringify(manifest, null, 2) + "\n";
  const target = "public/data/sections/sections.json";
  if (check) {
    const cur = existsSync(target) ? readFileSync(target, "utf8") : "";
    if (cur !== out) { console.error(`❌ ${target} אינו מעודכן. הריצי: node scripts/build-sections.mjs`); process.exit(1); }
    console.log("✅ sections.json מעודכן");
  } else {
    writeFileSync(target, out);
    const n = manifest.streets.reduce((a, s) => a + (s.existing ? 1 : 0) + s.proposed.length, 0);
    console.log(`✅ ${target}: ${manifest.streets.length} רחובות, ${n} חתכים`);
  }
}
