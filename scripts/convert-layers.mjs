#!/usr/bin/env node
// ממיר שכבות Esri JSON (ייצוא מ-ArcGIS Pro, ITM / EPSG:2039) ל-GeoJSON שהדאשבורד טוען.
//
// שימוש (ישירות לתיקיית האתר):
//   node scripts/convert-layers.mjs local-data/gilo.point.1.json local-data/gilo.line.1.json local-data/oranim.point.json --state proposed --out public/data/layers
//   --state proposed|existing  מסמן את כל הישויות כמצב מוצע / קיים (ברירת מחדל: לא מסמן)
//   --out <תיקייה>             תיקיית פלט (ברירת מחדל: local-data/layers)
//
// מה הסקריפט עושה:
//  1. מוודא שהקואורדינטות ב-ITM (2039). הדאשבורד עובד ב-ITM, ולכן אין המרת קואורדינטות, רק שינוי פורמט.
//  2. ממיר גאומטריה: x,y -> Point, paths -> LineString / MultiLineString.
//  3. שומר את כל השדות המקוריים, ומוסיף את השדות שהדאשבורד מחפש (ראו mapGilo).
//  4. מדפיס סיכום (ספירות לפי סוג שירות, חומש ותת-מרחב) לבדיקה.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const clean = (v) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : v);
const ITM = { x: [100000, 300000], y: [450000, 800000] };

export function detectSchema(attrs) {
  const keys = Object.keys(attrs || {});
  if (keys.includes("kod_z")) return "gilo";
  if (keys.some((k) => k.startsWith("מהות"))) return "hebrew";
  return "generic";
}

// gilo: נקודות - mahut הוא סוג השירות, schuna הוא תת-המרחב. קווים - sug_sh הוא סוג השירות, mitcham הוא תת-המרחב.
// proj_num לא מוגדר בכוונה: ms_pr חוזר בכל תת-מרחב, והגדרתו הייתה עלולה לאחד פרויקטים שונים. הקוד kod_z ייחודי.
function mapGilo(a, kind) {
  const isLine = kind === "line";
  const out = { ...a };
  out.gis_code = a.kod_z;
  out.sub = (isLine ? a.mitcham : a.schuna) || a.mitcham || a.schuna || "";
  out.ptype = (isLine ? a.sug_sh : a.mahut) || "";
  out.descr = a.shem_p || a.pirut || "";
  out.period = a.homesh || "";
  if (a.status) out.plan_stat = a.status;
  return out;
}
const SCHEMAS = { gilo: mapGilo, hebrew: (a) => ({ ...a }), generic: (a) => ({ ...a }) };

function toGeometry(g) {
  if (!g) return null;
  if (typeof g.x === "number" && typeof g.y === "number") return { type: "Point", coordinates: [g.x, g.y] };
  if (Array.isArray(g.points)) return { type: "MultiPoint", coordinates: g.points.map((p) => [p[0], p[1]]) };
  if (Array.isArray(g.paths)) {
    const paths = g.paths.map((p) => p.map((c) => [c[0], c[1]]));
    return paths.length === 1 ? { type: "LineString", coordinates: paths[0] } : { type: "MultiLineString", coordinates: paths };
  }
  if (g.rings) throw new Error("שכבות פוליגון (rings) אינן נתמכות בממיר הזה");
  throw new Error("סוג גאומטריה לא מוכר");
}
const eachCoord = (geom, fn) => { const walk = (c) => (typeof c[0] === "number" ? fn(c) : c.forEach(walk)); walk(geom.coordinates); };

export function convertEsri(esri, { state = "", name = "layer" } = {}) {
  const wkid = esri.spatialReference && (esri.spatialReference.latestWkid || esri.spatialReference.wkid);
  if (wkid !== 2039) throw new Error(`מערכת הקואורדינטות היא ${wkid ?? "לא ידועה"} ולא ITM (2039). בארקגיס יש לייצא ב-ITM, או לשלוח לי את הקובץ.`);
  const feats = esri.features || [];
  if (!feats.length) throw new Error("אין ישויות בקובץ");
  const kind = /Polyline/i.test(esri.geometryType || "") ? "line" : /Point/i.test(esri.geometryType || "") ? "point" : "other";
  const schema = detectSchema(feats[0].attributes);
  const warnings = []; const features = []; let skipped = 0;
  for (const f of feats) {
    const geometry = toGeometry(f.geometry);
    if (!geometry) { skipped++; continue; }
    let off = false;
    eachCoord(geometry, ([x, y]) => { if (x < ITM.x[0] || x > ITM.x[1] || y < ITM.y[0] || y > ITM.y[1]) off = true; });
    if (off) warnings.push(`FID ${f.attributes.FID}: קואורדינטות מחוץ לטווח ITM סביר`);
    const attrs = Object.fromEntries(Object.entries(f.attributes).map(([k, v]) => [k, clean(v)]));
    const properties = SCHEMAS[schema](attrs, kind);
    if (state === "proposed") properties.type = "מוצע";
    if (state === "existing") properties.type = "קיים";
    features.push({ type: "Feature", properties, geometry });
  }
  if (skipped) warnings.push(`${skipped} ישויות ללא גאומטריה דולגו`);
  const geojson = { type: "FeatureCollection", name, crs: { type: "name", properties: { name: "urn:ogc:def:crs:EPSG::2039" } }, features };
  const count = (key) => features.reduce((m, f) => { const v = f.properties[key] || "(ריק)"; m[v] = (m[v] || 0) + 1; return m; }, {});
  const summary = { schema, kind, features: features.length, byService: count(schema === "gilo" ? "ptype" : "מהות"), byPeriod: count(schema === "gilo" ? "period" : "חומש"), bySub: schema === "gilo" ? count("sub") : undefined };
  return { geojson, summary, warnings };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const take = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args.splice(i, 2)[1] : ""; };
  const state = take("--state");
  const outDir = take("--out") || "local-data/layers";
  if (!args.length) { console.error("שימוש: node scripts/convert-layers.mjs <קובץ.json> [קובץ נוסף...] [--state proposed|existing] [--out <תיקייה>]"); process.exit(1); }
  mkdirSync(outDir, { recursive: true });
  let failed = 0;
  for (const file of args) {
    const name = basename(file, extname(file));
    try {
      const { geojson, summary, warnings } = convertEsri(JSON.parse(readFileSync(file, "utf8")), { state, name });
      const out = join(outDir, `${name}.geojson`);
      writeFileSync(out, JSON.stringify(geojson));
      console.log(`\n✅ ${file} -> ${out}`);
      console.log(`   ${summary.features} ישויות (${summary.kind}), סכמה: ${summary.schema}`);
      const show = (t, o) => o && console.log(`   ${t}: ` + Object.entries(o).map(([k, v]) => `${k} ${v}`).join(" · "));
      show("סוג שירות", summary.byService); show("חומש", summary.byPeriod); show("תת-מרחב", summary.bySub);
      warnings.forEach((w) => console.log("   ⚠️ " + w));
    } catch (e) { failed++; console.error(`\n❌ ${file}: ${e.message}`); }
  }
  process.exit(failed ? 1 : 0);
}
