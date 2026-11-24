// בדיקות לטעינת שכבות ומצגות מקבצי האתר: ההזרקה לדאשבורד, הלוגיקה של הטעינה, ושלמות הקבצים ב-public/data/layers.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { patchDashboard, MARK } from "../scripts/dashboard-patch.mjs";
import { convertEsri } from "../scripts/convert-layers.mjs";

const SNIPPET = readFileSync(new URL("../scripts/repo-content.snippet.js", import.meta.url), "utf8");
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

// ---------- בלוק ה-boot, כפי שהוא בדאשבורד המקורי (G5, שורות ~2713-2730) ----------
const BOOT = `
  /* ---------- boot ---------- */
  (async () => {
    const loading = el('div', { class: 'loading', text: 'טוען שכבות…' }); mapEl.append(loading);
    for (const z of DEFAULT_ZIPS) {
      try {
        const bin = Uint8Array.from(atob(z.b64), c => c.charCodeAt(0));
        const parsed = await GIS.readZip(bin);
        for (const P of parsed) S.layers.push({ id: z.id, name: z.name, plan: z.plan, state: z.state, source: 'default', items: P.items, fields: P.fields, crs: P.crs, fileName: z.file, visible: true });
      } catch (e) { console.error('default layer failed', z.name, e); }
    }
    if (DEFAULT_DECK && DEFAULT_DECK.url) S.decks.push({ ...DEFAULT_DECK, source: 'default' });
    loading.remove();
    rebuild(); fitAll(); buildDataLists();
    S.decks.forEach(d => loadDeck(d));
    initRemote();
    loadDriveDecks();
  })();
  })();
  </script>
  </body>
  </html>`;
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>d</title></head><body>
<button id="openData">טעינת שכבות ומצגת</button><dialog id="dataDlg"></dialog><script>${BOOT}`;

// ---------- עותק של GIS.fromGeoJSON מהדאשבורד (שורות 1211–1230), עם projector מינימלי ל-ITM ----------
const projectorFor = (prj, sample) => ({ name: /Israel_TM/.test(prj) ? "ITM" : "ITM?", fn: (x) => x });
const projectGeom = (g, fn) => g;
function fromGeoJSON(name, gj) {
  const feats = gj.type === "FeatureCollection" ? gj.features : gj.type === "Feature" ? [gj] : [];
  const items = []; const fields = new Set(); let sample = null;
  for (const f of feats) { if (f.geometry) { const c = JSON.stringify(f.geometry.coordinates).match(/-?[\d.]+/g); if (c) { sample = [+c[0], +c[1]]; break; } } }
  const pj = projectorFor(gj.crs && gj.crs.properties && /2039/.test(gj.crs.properties.name) ? "Israel_TM" : "", sample);
  for (const f of feats) {
    const p = f.properties || {}; Object.keys(p).forEach((k) => fields.add(k));
    const geo = f.geometry; if (!geo) continue;
    const add = (g) => items.push({ g: projectGeom(g, pj.fn), p });
    const t = geo.type, c = geo.coordinates;
    if (t === "Point") add({ type: "point", coords: c.slice(0, 2) });
    else if (t === "MultiPoint") c.forEach((pt) => add({ type: "point", coords: pt.slice(0, 2) }));
    else if (t === "LineString") add({ type: "line", coords: [c.map((x) => x.slice(0, 2))] });
    else if (t === "MultiLineString") add({ type: "line", coords: c.map((l) => l.map((x) => x.slice(0, 2))) });
  }
  return { name, fields: [...fields], crs: pj.name, items };
}
const GIS = { fromGeoJSON: fromGeoJSON };

const pt = (x, y, p = {}) => ({ type: "Feature", properties: p, geometry: { type: "Point", coordinates: [x, y] } });
const fc = (features) => ({ type: "FeatureCollection", crs: { type: "name", properties: { name: "urn:ogc:def:crs:EPSG::2039" } }, features });
const BASE = "https://yaelg-jtmt.github.io/spatial-plans-wbs/";
const HREF = BASE + "dashboard/index.html?plan=%D7%92%D7%99%D7%9C%D7%94";

function run(files, S) {
  const calls = [];
  const fetchFn = async (url, opts) => {
    const u = String(url); calls.push(u);
    if (!(u in files)) return { ok: false, status: 404, json: async () => { throw new Error("404"); } };
    return { ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(files[u])) };
  };
  return new AsyncFunction("S", "GIS", "fetch", "location", SNIPPET)(S, GIS, fetchFn, { href: HREF }).then(() => calls);
}
const newS = () => ({ layers: [], decks: [] });

// ---------- ההזרקה ----------
test("הזרקה: ה-CSS מסתיר את הכפתור והחלון, והקוד מוזרק לפני בדיקת DEFAULT_DECK בתוך ה-boot", () => {
  const { html, log, warn } = patchDashboard(PAGE);
  assert.equal(warn.length, 0, warn.join());
  assert.match(html, /<style id="repo-content-css">#openData,#dataDlg\{display:none!important\}<\/style>\s*<\/head>/);
  const iSnip = html.indexOf(MARK), iDeck = html.indexOf("if (DEFAULT_DECK && DEFAULT_DECK.url)"), iLoop = html.indexOf("for (const z of DEFAULT_ZIPS)"), iRemove = html.indexOf("loading.remove()");
  assert.ok(iLoop < iSnip && iSnip < iDeck && iDeck < iRemove, "סדר: לולאת ברירת מחדל, טעינת האתר, DEFAULT_DECK, loading.remove");
  assert.match(html, /\n    await loadRepoContent\(\);\n/);
  assert.equal(log.length, 2);
  // התוכן המקורי נשאר ללא שינוי
  for (const keep of ["initRemote();", "loadDriveDecks();", "rebuild(); fitAll(); buildDataLists();", "GIS.readZip(bin)"]) assert.ok(html.includes(keep), keep);
});
test("הזרקה: בטוחה להרצה חוזרת (idempotent)", () => {
  const once = patchDashboard(PAGE).html;
  const twice = patchDashboard(once);
  assert.equal(twice.html, once);
  assert.equal((once.match(/const loadRepoContent/g) || []).length, 1);
  assert.equal((once.match(/id="repo-content-css"/g) || []).length, 1);
});
test("הזרקה: אם העוגן חסר, לא משנים את הקוד ומחזירים אזהרה מפורשת", () => {
  const broken = PAGE.replace("if (DEFAULT_DECK && DEFAULT_DECK.url)", "if (SOMETHING_ELSE)");
  const r = patchDashboard(broken);
  assert.ok(!r.html.includes("loadRepoContent"));
  assert.match(r.warn.join(" "), /DEFAULT_DECK/);
  assert.ok(r.html.includes("repo-content-css"));   // ההסתרה עדיין מוחלת
});
test("הזרקה: הקוד המוזרק הוא JavaScript תקין בתוך פונקציית async", () => {
  const { html } = patchDashboard(PAGE);
  const script = html.slice(html.indexOf("<script>") + 8, html.indexOf("</script>"));
  // ה-boot בקובץ המקורי נמצא בתוך IIFE חיצוני שנפתח קודם, ולכן פותחים אותו כאן; בודקים תחביר בלבד, בלי הרצה
  assert.doesNotThrow(() => new Function("(() => {" + script));
});

// ---------- הטעינה ----------
test("טעינה: שכבות מהאתר נוספות עם השדות שהדאשבורד מצפה להם, והנתיב יחסי למיקום הדאשבורד", async () => {
  const S = newS();
  const files = {
    [BASE + "data/layers/manifest.json"]: { layers: [{ id: "gilo-point", name: "גילה – נקודות", plan: "גילה", state: "proposed", file: "gilo.point.1.geojson" }] },
    [BASE + "data/layers/gilo.point.1.geojson"]: fc([pt(218835.6, 626946.2, { ptype: "מעבר חציה" }), pt(218982.5, 626529.4, { ptype: "תחנה חדשה" })]),
  };
  const calls = await run(files, S);
  assert.deepEqual(calls, [BASE + "data/layers/manifest.json", BASE + "data/layers/gilo.point.1.geojson"]);
  assert.equal(S.layers.length, 1);
  const L = S.layers[0];
  assert.deepEqual({ id: L.id, name: L.name, plan: L.plan, state: L.state, source: L.source, fileName: L.fileName, visible: L.visible, crs: L.crs }, { id: "repo:gilo-point", name: "גילה – נקודות", plan: "גילה", state: "proposed", source: "default", fileName: "gilo.point.1.geojson", visible: true, crs: "ITM" });
  assert.equal(L.items.length, 2);
  assert.deepEqual(L.items[0].g, { type: "point", coords: [218835.6, 626946.2] });
  assert.ok(L.fields.includes("ptype"));
});
test("טעינה: שכבות שהומרו בממיר נטענות בדיוק (קווים, נקודות, MultiLineString)", async () => {
  const esriLines = { geometryType: "esriGeometryPolyline", spatialReference: { wkid: 2039 }, features: [
    { attributes: { FID: 1, kod_z: "1-13", mitcham: "גילה א", sug_sh: "שביל הליכה", homesh: "חומש 1", shem_p: "שביל" }, geometry: { paths: [[[218459, 626782], [218411, 626794]]] } },
    { attributes: { FID: 2, kod_z: "2-28", mitcham: "גילה ב", sug_sh: "שביל הליכה", homesh: "חומש 3", shem_p: "שביל" }, geometry: { paths: [[[218606, 626322], [218522, 626372]], [[218606, 626322], [218648, 626292]]] } }] };
  const gj = convertEsri(esriLines, { state: "proposed", name: "gilo.line.1" }).geojson;
  const S = newS();
  await run({ [BASE + "data/layers/manifest.json"]: { layers: [{ id: "gl", name: "גילה – קווים", plan: "גילה", state: "proposed", file: "gilo.line.1.geojson" }] }, [BASE + "data/layers/gilo.line.1.geojson"]: gj }, S);
  const items = S.layers[0].items;
  assert.equal(items.length, 2);
  assert.equal(items[0].g.type, "line"); assert.equal(items[0].g.coords.length, 1);
  assert.equal(items[1].g.coords.length, 2);                       // MultiLineString: שני חלקים
  assert.equal(items[0].p.sub, "גילה א"); assert.equal(items[0].p.ptype, "שביל הליכה"); assert.equal(items[0].p.type, "מוצע");
});
test("טעינה: replace מסיר רק שכבות מוטמעות של אותה תכנית ואותו מצב", async () => {
  const S = newS();
  S.layers.push(
    { id: "a1", plan: "ארמון הנציב", state: "proposed", source: "default" },
    { id: "g-old", plan: "גילה", state: "proposed", source: "default" },
    { id: "g-existing", plan: "גילה", state: "existing", source: "default" },
    { id: "g-user", plan: "גילה", state: "proposed", source: "session" },
  );
  const man = { layers: [
    { id: "p", name: "גילה – נקודות", plan: "גילה", state: "proposed", file: "p.geojson", replace: true },
    { id: "l", name: "גילה – קווים", plan: "גילה", state: "proposed", file: "l.geojson", replace: true } ] };
  await run({ [BASE + "data/layers/manifest.json"]: man, [BASE + "data/layers/p.geojson"]: fc([pt(218000, 626000)]), [BASE + "data/layers/l.geojson"]: fc([pt(218100, 626100)]) }, S);
  assert.deepEqual(S.layers.map((l) => l.id), ["a1", "g-existing", "g-user", "repo:p", "repo:l"]);   // שתי השכבות החדשות נשארות
});
test("טעינה: בלי replace, שכבות מוטמעות קיימות לא נפגעות (אורנים נוספת)", async () => {
  const S = newS(); S.layers.push({ id: "a1", plan: "ארמון הנציב", state: "proposed", source: "default" });
  await run({ [BASE + "data/layers/manifest.json"]: { layers: [{ id: "o", name: "אורנים", plan: "אורנים", state: "proposed", file: "o.geojson" }] }, [BASE + "data/layers/o.geojson"]: fc([pt(218703, 628929)]) }, S);
  assert.deepEqual(S.layers.map((l) => l.id), ["a1", "repo:o"]);
});
test("טעינה: התאמת שם תכנית ב-replace מתעלמת מרווחים ומקפים", async () => {
  const S = newS(); S.layers.push({ id: "x", plan: "צור באהר - אום טובא", state: "proposed", source: "default" });
  await run({ [BASE + "data/layers/manifest.json"]: { layers: [{ id: "z", name: "צור באהר", plan: "צור באהר–אום טובא", state: "proposed", file: "z.geojson", replace: true }] }, [BASE + "data/layers/z.geojson"]: fc([pt(220000, 630000)]) }, S);
  assert.deepEqual(S.layers.map((l) => l.id), ["repo:z"]);
});
test("טעינה: קובץ שכבה חסר או ריק לא עוצר את השאר", async () => {
  const S = newS(); const err = console.error; const errs = []; console.error = (...a) => errs.push(a); 
  try {
    await run({ [BASE + "data/layers/manifest.json"]: { layers: [
      { id: "missing", name: "חסר", plan: "גילה", file: "missing.geojson" },
      { id: "empty", name: "ריק", plan: "גילה", file: "empty.geojson" },
      { id: "ok", name: "תקין", plan: "גילה", file: "ok.geojson" } ] },
      [BASE + "data/layers/empty.geojson"]: fc([]), [BASE + "data/layers/ok.geojson"]: fc([pt(218000, 626000)]) }, S);
  } finally { console.error = err; }
  assert.deepEqual(S.layers.map((l) => l.id), ["repo:ok"]);
  assert.equal(errs.length, 2);
});
test("טעינה: בלי manifest (או שגיאת רשת) הדאשבורד ממשיך כרגיל ולא זורק שגיאה", async () => {
  const S = newS(); S.layers.push({ id: "keep", plan: "ארמון הנציב", state: "proposed", source: "default" });
  const warn = console.warn; console.warn = () => {};
  try { await run({}, S); } finally { console.warn = warn; }
  assert.deepEqual(S.layers.map((l) => l.id), ["keep"]);
  assert.deepEqual(S.decks, []);
});
test("טעינה: מצגות PDF מתיקיית האתר נוספות עם כתובת מלאה", async () => {
  const S = newS();
  await run({ [BASE + "data/layers/manifest.json"]: { layers: [], decks: [{ id: "gilo", name: "גילה", plan: "גילה", file: "גילה.pdf" }] } }, S);
  assert.equal(S.decks.length, 1);
  assert.deepEqual({ id: S.decks[0].id, plan: S.decks[0].plan, source: S.decks[0].source }, { id: "repo:gilo", plan: "גילה", source: "default" });
  assert.equal(new URL(S.decks[0].url).pathname, "/spatial-plans-wbs/data/decks/" + encodeURI("גילה.pdf"));
});

// ---------- שלמות הקבצים בריפו (נכשל כשחסר קובץ, כדי שלא יפורסם אתר בלי שכבות) ----------
const MAN = new URL("../public/data/layers/manifest.json", import.meta.url);
test("manifest: מבנה תקין ומזהים ייחודיים", () => {
  const m = JSON.parse(readFileSync(MAN, "utf8"));
  assert.ok(Array.isArray(m.layers) && Array.isArray(m.decks));
  const ids = [...m.layers, ...m.decks].map((x) => x.id);
  assert.equal(new Set(ids).size, ids.length, "מזהים כפולים");
  for (const L of m.layers) for (const f of ["id", "name", "plan", "file"]) assert.ok(L[f], `${L.id || "?"}.${f}`);
  for (const L of m.layers) assert.ok(["proposed", "existing", "auto"].includes(L.state || "auto"), L.id);
  for (const D of m.decks) for (const f of ["id", "name", "plan", "file"]) assert.ok(D[f], `${D.id || "?"}.${f}`);
});
test("קבצי השכבות ב-public/data/layers: קיימים, GeoJSON ב-ITM, והספירה תואמת", () => {
  const m = JSON.parse(readFileSync(MAN, "utf8"));
  for (const L of m.layers) {
    const p = new URL(`../public/data/layers/${L.file}`, import.meta.url);
    assert.ok(existsSync(p), `חסר הקובץ public/data/layers/${L.file}. הריצי: node scripts/convert-layers.mjs local-data/<קובץ>.json --state proposed --out public/data/layers`);
    const gj = JSON.parse(readFileSync(p, "utf8"));
    assert.equal(gj.type, "FeatureCollection", L.file);
    assert.match(gj.crs.properties.name, /2039/, `${L.file}: לא ITM`);
    if (L.count !== undefined) assert.equal(gj.features.length, L.count, `${L.file}: ${gj.features.length} ישויות, צפוי ${L.count}`);
    for (const f of gj.features) {
      assert.ok(f.geometry, `${L.file}: ישות ללא גאומטריה`);
      const flat = JSON.stringify(f.geometry.coordinates).match(/-?[\d.]+/g).map(Number);
      for (let i = 0; i < flat.length; i += 2) assert.ok(flat[i] > 100000 && flat[i] < 300000 && flat[i + 1] > 450000 && flat[i + 1] < 800000, `${L.file}: קואורדינטה מחוץ ל-ITM`);
    }
  }
  for (const D of m.decks) {
    const p = new URL(`../public/data/decks/${D.file}`, import.meta.url);
    assert.ok(existsSync(p), `חסר הקובץ public/data/decks/${D.file}`);
    assert.equal(readFileSync(p).subarray(0, 4).toString(), "%PDF", `${D.file}: אינו PDF`);
  }
});
