#!/usr/bin/env node
// בודק אילו פרויקטים בשכבות יציגו חתך רחוב, ומציע קודי פרויקט.
//   node scripts/match-sections.mjs                 דוח בלבד
//   node scripts/match-sections.mjs --write-codes   שומר את ההתאמות ב-data-src/sections/codes.json (אחר כך: node scripts/build-sections.mjs)
// קלט: public/data/layers/manifest.json והקבצים שהוא מפנה אליהם, ו-public/data/sections/sections.json.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { sxMatch, SX_STREET_SERVICES, sxNorm } from "./sections-core.mjs";

// מייצג פרויקט כפי שהדאשבורד רואה אותו: קוד, שם (descr), שירות (ptype), תכנית
export function projectsFromLayers(layersManifest, root = ".") {
  const byKey = new Map();
  for (const L of layersManifest.layers || []) {
    const f = join(root, "public/data/layers", L.file);
    if (!existsSync(f)) continue;
    const gj = JSON.parse(readFileSync(f, "utf8"));
    for (const ft of gj.features) {
      const a = ft.properties || {};
      const code = String(a.gis_code || a.kod_z || "").trim();
      if (!code) continue;
      const key = L.plan + "|" + code;
      if (!byKey.has(key)) byKey.set(key, { plan: L.plan, code, num: a.proj_num !== undefined && a.proj_num !== "" && !isNaN(+a.proj_num) && +a.proj_num !== 0 ? +a.proj_num : null, name: a.descr || a.shem_p || a.pirut || "", desc: a.pirut || "", service: a.ptype || a.sug_sh || a.mahut || "", sub: a.sub || "" });
    }
  }
  return [...byKey.values()];
}

export function report(sections, projects) {
  const matched = new Map(sections.streets.map((s) => [s.id, []])), streetProjects = [], orphan = [], multi = [];
  for (const p of projects) {
    if (!SX_STREET_SERVICES.includes(p.service) && !sections.streets.some((s) => s.codes && s.codes.includes(p.code))) continue;
    streetProjects.push(p);
    const hits = sxMatch(sections, p);
    if (!hits.length) orphan.push(p);
    if (hits.length > 1) multi.push({ p, hits });
    hits.forEach((s) => matched.get(s.id).push(p));
  }
  return { matched, orphan, multi, streetProjects };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const write = process.argv.includes("--write-codes");
  const secPath = "public/data/sections/sections.json", layPath = "public/data/layers/manifest.json";
  if (!existsSync(secPath) || !existsSync(layPath)) { console.error("חסר sections.json או manifest של השכבות"); process.exit(1); }
  const sections = JSON.parse(readFileSync(secPath, "utf8")), layers = JSON.parse(readFileSync(layPath, "utf8"));
  const projects = projectsFromLayers(layers);
  const { matched, orphan, multi, streetProjects } = report(sections, projects);
  console.log(`פרויקטים בשכבות: ${projects.length}, מהם מסוג רחוב: ${streetProjects.length}\n`);
  for (const s of sections.streets) {
    const m = matched.get(s.id);
    console.log(`${m.length ? "✅" : "❌"} ${s.plan} · ${s.name}: ${m.length} פרויקטים` + (s.codes.length ? " (לפי קודים)" : " (לפי שם)"));
    m.forEach((p) => console.log(`     ${p.code.padEnd(6)} ${p.service} | ${p.name.slice(0, 80)}`));
  }
  if (multi.length) { console.log("\n⚠️ פרויקטים שהותאמו ליותר מרחוב אחד (יוצגו עם בחירת רחוב):"); multi.forEach(({ p, hits }) => console.log(`     ${p.code} ${p.name.slice(0, 60)} -> ${hits.map((h) => h.name).join(", ")}`)); }
  if (orphan.length) { console.log(`\n⚠️ ${orphan.length} פרויקטים מסוג רחוב שלא הותאמו לשום חתך (אין חתך לרחוב, או שהשם שונה):`); orphan.forEach((p) => console.log(`     ${p.code.padEnd(6)} ${p.service} | ${p.name.slice(0, 80)}`)); }
  if (write) {
    const f = "data-src/sections/codes.json", cur = existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : {};
    for (const s of sections.streets) { const c = matched.get(s.id).map((p) => p.code); if (c.length) cur[s.id] = [...new Set([...(cur[s.id] || []), ...c])]; }
    writeFileSync(f, JSON.stringify(cur, null, 2) + "\n");
    console.log(`\n✅ נשמר ב-${f}. עכשיו: node scripts/build-sections.mjs`);
  } else console.log("\nלשמירת ההתאמות כקודים קבועים: node scripts/match-sections.mjs --write-codes");
}
