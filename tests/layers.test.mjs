// בדיקות לממיר השכבות (scripts/convert-layers.mjs) על דגימות אמיתיות מהקבצים של גילה ואורנים.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { convertEsri, detectSchema } from "../scripts/convert-layers.mjs";

const fx = (n) => JSON.parse(readFileSync(new URL(`./fixtures/layers/${n}.json`, import.meta.url), "utf8"));

// עותק של pick/normalize מהדאשבורד (דאשבורד_תכניות_מרחביות_G5, שורות 1252–1279) כדי לוודא שהשכבות
// המומרות נקראות נכון. אם הדאשבורד משתנה, יש לעדכן את העותק הזה.
function pick(p, prefixes) {
  for (const pre of prefixes) { const lp = pre.toLowerCase(); for (const k in p) { if (k.toLowerCase().startsWith(lp)) { const v = p[k]; if (v !== null && v !== undefined && String(v).trim() !== "") return v; } } }
  return "";
}
const SERVICE_ALIASES = { "מעברים מכאניים": "מעבר מכני", "כביש חדש": "רחוב חדש", "מעברי חצייה": "מעבר חצייה", "מעבר חציה": "מעבר חצייה", "מעברי חציה": "מעבר חצייה" };
const normService = (s) => { s = String(s || "").trim(); return SERVICE_ALIASES[s] || s; };
function normalize(p, layerState) {
  const tv = String(p.type || p.TYPE || p["מצב"] || "");
  const state = /קיים/.test(tv) ? "existing" : /מוצע/.test(tv) ? "proposed" : layerState;
  let num = pick(p, ["proj_num", "מס פר", "מספר פר", "מס_פר"]);
  num = num === "" || num === null || isNaN(+num) || +num === 0 ? null : +num;
  const detail = pick(p, ["פירוט"]);
  let service = pick(p, ["ptype"]) || pick(p, ["שירות", "מהות"]) || (detail && String(detail).length < 24 ? detail : "") || pick(p, ["סוג"]) || pick(p, ["HIRARCHY", "היררכ"]);
  service = normService(service) || "אחר";
  const quint = String(pick(p, ["חומש", "period"]) || "").trim();
  const status = String(pick(p, ["סטטוס", "plan_stat"]) || "").trim();
  const name = String(pick(p, ["שם פר", "שם", "name", "descr", "STREET"]) || "").trim();
  return { state, num, service, quint: quint || "לא צוין", status: status || "לא צוין", name, code: String(pick(p, ["gis_code"]) || "").trim(), sub: String(pick(p, ["sub"]) || "").trim() };
}

test("זיהוי סכמה לפי שמות השדות", () => {
  assert.equal(detectSchema(fx("gilo-points-sample").features[0].attributes), "gilo");
  assert.equal(detectSchema(fx("gilo-lines-sample").features[0].attributes), "gilo");
  assert.equal(detectSchema(fx("oranim-points-sample").features[0].attributes), "hebrew");
  assert.equal(detectSchema({ a: 1 }), "generic");
});

test("גילה, נקודות: GeoJSON תקין, קואורדינטות ITM ללא שינוי, וסוג השירות מ-mahut", () => {
  const { geojson, summary, warnings } = convertEsri(fx("gilo-points-sample"), { name: "gilo.point" });
  assert.equal(geojson.type, "FeatureCollection");
  assert.match(geojson.crs.properties.name, /2039/);
  assert.equal(geojson.features.length, 3);
  assert.deepEqual(geojson.features[0].geometry, { type: "Point", coordinates: [218835.60576419532, 626946.22436843626] });
  assert.equal(warnings.length, 0);
  assert.deepEqual(summary.byService, { "מעבר חציה": 1, "תחנה חדשה": 1, "אחר": 1 });
  const p = geojson.features[0].properties;
  assert.equal(p.gis_code, "1-4"); assert.equal(p.sub, "גילה א"); assert.equal(p.ptype, "מעבר חציה"); assert.equal(p.period, "מיידי");
  assert.equal(p.kod_z, "1-4"); assert.equal(p.mahut, "מעבר חציה");   // השדות המקוריים נשמרים
  assert.equal(p.sh_tich, ""); assert.equal(p.status, "");        // רווחים בלבד -> ריק
  assert.ok(!("plan_stat" in p));
});

test("גילה, קווים: LineString / MultiLineString, תת-מרחב מ-mitcham וסוג שירות מ-sug_sh", () => {
  const { geojson, summary } = convertEsri(fx("gilo-lines-sample"), { name: "gilo.line" });
  const by = Object.fromEntries(geojson.features.map((f) => [f.properties.kod_z, f]));
  assert.equal(by["1-13"].geometry.type, "LineString");
  assert.equal(by["1-13"].geometry.coordinates.length, 2);
  assert.equal(by["2-28"].geometry.type, "MultiLineString");
  assert.equal(by["2-28"].geometry.coordinates.length, 2);
  assert.equal(by["1-37"].geometry.coordinates.length, 4);
  assert.equal(by["1-13"].properties.sub, "גילה א");        // לא "גילה" (schuna בקווים)
  assert.equal(by["2-28"].properties.sub, "גילה ב");
  assert.equal(by["3-1"].properties.ptype, "רחוב חדש");
  assert.deepEqual(summary.bySub, { "גילה א": 2, "גילה ב": 1, "גילה ג": 1 });
  assert.ok(!("proj_num" in by["1-13"].properties), "proj_num לא מוגדר כדי לא לאחד פרויקטים שונים");
});

test("גילה: הדאשבורד קורא את השכבות המומרות נכון (שירות, חומש, קוד, תת-מרחב)", () => {
  const pts = convertEsri(fx("gilo-points-sample")).geojson.features.map((f) => normalize(f.properties, "proposed"));
  assert.deepEqual(pts.map((n) => n.service), ["מעבר חצייה", "תחנה חדשה", "אחר"]);   // "מעבר חציה" -> "מעבר חצייה" לפי הדאשבורד
  assert.deepEqual(pts.map((n) => n.quint), ["מיידי", "חומש 2", "חומש 2"]);
  assert.deepEqual(pts.map((n) => n.code), ["1-4", "2-57", "1-21"]);
  assert.deepEqual(pts.map((n) => n.sub), ["גילה א", "גילה ב", "גילה א"]);
  assert.ok(pts.every((n) => n.name.length > 5));
  const lines = convertEsri(fx("gilo-lines-sample")).geojson.features.map((f) => normalize(f.properties, "proposed"));
  assert.deepEqual(lines.map((n) => n.service), ["שביל הליכה", "נתיב תחבורה ציבורית", "שביל הליכה", "רחוב חדש"]);
  assert.deepEqual(lines.map((n) => n.sub), ["גילה א", "גילה א", "גילה ב", "גילה ג"]);
  assert.ok(lines.every((n) => n.num === null));
});

test("גילה: ללא המיפוי, הדאשבורד לא היה מזהה שירות, חומש או תת-מרחב (הוכחה שהמיפוי נחוץ)", () => {
  const raw = fx("gilo-points-sample").features[0].attributes;
  const n = normalize(raw, "proposed");
  assert.equal(n.quint, "לא צוין"); assert.equal(n.sub, ""); assert.equal(n.code, "");
});

test("אורנים: שדות עבריים נשארים כמות שהם והדאשבורד קורא אותם ישירות", () => {
  const { geojson, summary } = convertEsri(fx("oranim-points-sample"), { name: "oranim.point" });
  assert.equal(geojson.features.length, 3);
  const keys = Object.keys(geojson.features[0].properties);
  const nameKey = keys.find((k) => k.startsWith("שם_פר"));
  assert.ok(nameKey, "שדה שם הפרויקט נשמר (כולל התו הפגום בסופו)");
  assert.ok(!("gis_code" in geojson.features[0].properties), "אין שדות מומצאים בסכמה עברית");
  const ns = geojson.features.map((f) => normalize(f.properties, "proposed"));
  assert.deepEqual(ns.map((n) => n.service), ["תחנה חדשה", "הלכתיות", "אחר"]);
  assert.deepEqual(ns.map((n) => n.quint), ["1 - 2025-2030", "חומש 1-2024-2028", "לא צוין"]);
  assert.equal(ns[0].status, "טרום תכנון");
  assert.equal(ns[0].name, "הוספת תחנת אוטובוס");
  assert.equal(geojson.features[2].properties["גורם"], "101-0690859");   // רווח מוביל נוקה
  assert.deepEqual(summary.byService, { "תחנה חדשה": 1, "הלכתיות": 1, "(ריק)": 1 });
});

test("אפשרות --state מסמנת את כל הישויות, והדאשבורד מכבד אותה גם בלי בחירה בחלון", () => {
  const g = convertEsri(fx("gilo-points-sample"), { state: "proposed" }).geojson;
  assert.ok(g.features.every((f) => f.properties.type === "מוצע"));
  assert.ok(g.features.every((f) => normalize(f.properties, "existing").state === "proposed"));
  const e = convertEsri(fx("gilo-points-sample"), { state: "existing" }).geojson;
  assert.ok(e.features.every((f) => normalize(f.properties, "proposed").state === "existing"));
  const none = convertEsri(fx("gilo-points-sample")).geojson;
  assert.ok(none.features.every((f) => !("type" in f.properties)));
});

test("מערכת קואורדינטות שאינה ITM נדחית, ולא ממירים בשקט לקואורדינטות שגויות", () => {
  assert.throws(() => convertEsri(fx("wrong-crs")), /4326.*ITM|ITM.*4326/);
  assert.throws(() => convertEsri({ spatialReference: { wkid: 2039 }, features: [] }), /אין ישויות/);
  assert.throws(() => convertEsri({ spatialReference: { wkid: 2039 }, geometryType: "esriGeometryPolygon", features: [{ attributes: {}, geometry: { rings: [[[1, 1]]] } }] }), /פוליגון/);
});

test("ישות מחוץ לטווח ITM מדווחת כאזהרה", () => {
  const d = fx("gilo-points-sample");
  d.features[0].geometry = { x: 35.2, y: 31.7 };      // קואורדינטות גיאוגרפיות בטעות
  const { warnings } = convertEsri(d);
  assert.equal(warnings.length, 1); assert.match(warnings[0], /FID 0/);
});
