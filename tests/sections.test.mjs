// בדיקות לפופאפ חתכי הרחוב: התאמת פרויקט לרחוב, בניית sections.json מה-CSV, דוח ההתאמות, וההזרקה לדאשבורד.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sxHasAlias, sxMatch } from "../scripts/sections-core.mjs";
import { buildSections, deriveAliases, loadAndBuild, parseCsv } from "../scripts/build-sections.mjs";
import { projectsFromLayers, report } from "../scripts/match-sections.mjs";
import { patchSections, SX_MARK } from "../scripts/sections-patch.mjs";

const ROOT = new URL("..", import.meta.url).pathname;

// ---------- התאמת כינוי ----------
test("כינוי: מילים שלמות, עם אותיות יחס, בלי התאמות חלקיות", () => {
  for (const t of ["שדרוג רחוב המור", "הרחבה ברחוב המור", "מהמור לשמיר", "והמור", "רחוב המור, מזרח"]) assert.ok(sxHasAlias(t, "המור"), t);
  for (const t of ["תחנת המורה", "שמירה", "המורים", "אמור", "הנמור"]) assert.ok(!sxHasAlias(t, "המור"), t);
  assert.ok(sxHasAlias("שביל אופניים ברחוב בן-אליעזר", "בן אליעזר"));
  assert.ok(sxHasAlias("רחוב אריה בן אלעזר", "בן אלעזר"));
  assert.ok(!sxHasAlias("בן אליעזר", "אריה בן אליעזר"));
  assert.ok(!sxHasAlias("", "המור") && !sxHasAlias("המור", ""));
});
test("כינוי עם ה' הידיעה: 'הצוף' נמצא גם כ'לצוף' ו'בצוף', אבל לא כמילים אחרות", () => {
  for (const t of ["מרחוב ורדינון לצוף", "בצוף", "כצוף", "הצוף", "מהצוף"]) assert.ok(sxHasAlias(t, "הצוף"), t);
  for (const t of ["שצוף", "אצוף", "צוף", "לצופים", "בצופה"]) assert.ok(!sxHasAlias(t, "הצוף"), t);
  assert.ok(sxHasAlias("הולך למור", "המור") && !sxHasAlias("שמור", "המור") && !sxHasAlias("אמור", "המור"));
});
test("כינוי: אחרי המילה 'צומת' הוא נחשב צומת ולא הרחוב", () => {
  assert.ok(!sxHasAlias("נתיב העדפה לקראת צומת הנגבי/דב יוסף", "הנגבי"));
  assert.ok(!sxHasAlias("שדרוג בצומת המור", "המור") && !sxHasAlias("לצומת המור", "המור"));
  assert.ok(sxHasAlias("שדרוג רחוב המור בצומת דב יוסף", "המור"), "אחרי הכינוי מותר");
  assert.ok(sxHasAlias("צומת דב יוסף ורחוב המור", "המור"));
});
test("כינוי: אות יחס אחת או שתיים בלבד לפני המילה", () => {
  assert.ok(sxHasAlias("ולהמור", "המור"));
  assert.ok(!sxHasAlias("בלבלהמור", "המור"));
});

// ---------- התאמת פרויקט ----------
const SEC = { streets: [
  { id: "GI_hamor", plan: "גילה", name: "המור", aliases: ["המור"], codes: [] },
  { id: "GI_levona", plan: "גילה", name: "לבונה", aliases: ["לבונה"], codes: ["9-9"] },
  { id: "OR_hamor", plan: "אורנים", name: "המור", aliases: ["המור"], codes: [] },
] };
const P = (o) => ({ plan: "גילה", code: "1-1", service: "שדרוג רחוב", name: "", desc: "", ...o });
test("התאמה: שם רחוב + סוג רחוב + אותה תכנית", () => {
  assert.deepEqual(sxMatch(SEC, P({ name: "שדרוג רחוב המור" })).map((s) => s.id), ["GI_hamor"]);
  assert.deepEqual(sxMatch(SEC, P({ plan: "אורנים", name: "שדרוג רחוב המור" })).map((s) => s.id), ["OR_hamor"]);
  assert.deepEqual(sxMatch(SEC, P({ plan: "תלפיות", name: "שדרוג רחוב המור" })), []);
});
test("התאמה: שירות שאינו רחוב (שביל הליכה, חצייה, אחר) לא מותאם לפי שם", () => {
  for (const service of ["שביל הליכה", "מעבר חצייה", "תחנה חדשה", "אחר", "מעבר מכני"]) assert.deepEqual(sxMatch(SEC, P({ service, name: "ברחוב המור" })), [], service);
  for (const service of ["שדרוג רחוב", "שביל אופניים", "נתיב תחבורה ציבורית", "רחוב חדש", "תנועה משולבת"]) assert.equal(sxMatch(SEC, P({ service, name: "ברחוב המור" })).length, 1, service);
});
test("התאמה: אם הוגדרו קודים הם הקובעים, ובלי תלות בשם או בשירות", () => {
  assert.deepEqual(sxMatch(SEC, P({ code: "9-9", service: "אחר", name: "ללא שם" })).map((s) => s.id), ["GI_levona"]);
  assert.deepEqual(sxMatch(SEC, P({ code: "9-8", name: "שדרוג רחוב לבונה" })), []);
});
test("התאמה: רק שם הפרויקט קובע. תיאור שמזכיר רחוב אחר לא מתאים, ושם שמזכיר שני רחובות מחזיר את שניהם", () => {
  assert.deepEqual(sxMatch(SEC, P({ name: "שדרוג", desc: "ברחוב המור" })), []);
  assert.deepEqual(sxMatch(SEC, P({ name: "שדרוג רחוב המור", desc: "ליד לבונה" })).map((s) => s.id), ["GI_hamor"]);
  const two = { streets: [...SEC.streets, { id: "GI_shamir", plan: "גילה", name: "שמיר", aliases: ["שמיר"], codes: [] }] };
  assert.deepEqual(sxMatch(two, P({ name: "חיבור מהמור לשמיר" })).map((s) => s.id).sort(), ["GI_hamor", "GI_shamir"]);
});

// ---------- CSV ----------
test("CSV: BOM, מירכאות, פסיקים ושורות ריקות", () => {
  const r = parseCsv('\uFEFFa,b,c\r\n1,"x, y",3\r\n\r\n"q""uote",,z\r\n');
  assert.deepEqual(r, [{ a: "1", b: "x, y", c: "3" }, { a: 'q"uote', b: "", c: "z" }]);
});

// ---------- בניית sections.json ----------
const HEAD = "תכנית,רחוב,מקטע,מצב,חלופה,קובץ תמונה,רוחב זכות דרך (מ'),הערה קצרה,קוד פרויקט / GIS";
function tmpImages(files) { const d = mkdtempSync(join(tmpdir(), "sx-")); for (const f of files) writeFileSync(join(d, f), "x".repeat(2000)); return d; }
const build = (rows, files, extra = {}) => buildSections({ csvFiles: [{ name: "T.csv", text: [HEAD, ...rows].join("\n") }], imagesDir: tmpImages(files), ...extra });

test("בנייה: זוג קיים + שתי חלופות, תוויות, רוחב ושדות", () => {
  const r = build(["גילה,המור,כל הרחוב,קיים,,GI_hamor_existing.png,24.59,,", "גילה,המור,A,מוצע,א,GI_hamor_A_proposed.png,24.6,,", "גילה,המור,B,מוצע,ב,GI_hamor_B_proposed.png,25.1,הערה,2-9"],
    ["GI_hamor_existing.png", "GI_hamor_A_proposed.png", "GI_hamor_B_proposed.png"]);
  assert.deepEqual(r.errors, []);
  const s = r.manifest.streets[0];
  assert.equal(s.id, "GI_hamor"); assert.equal(s.existing.width, 24.59);
  assert.deepEqual(s.proposed.map((a) => a.label), ["חלופה א", "חלופה ב"]);
  assert.equal(s.proposed[1].note, "הערה"); assert.deepEqual(s.codes, ["2-9"]);
});
test("בנייה: שתי תמונות לאותה חלופה מקבלות 'חתך 2'", () => {
  const r = build(["גילה,הצוף,כל הרחוב,קיים,,GI_hatzof_existing.png,17.7,,", "גילה,הצוף,A,מוצע,א,GI_hatzof_A_proposed.png,17.9,חתך 3.4,", "גילה,הצוף,A2,מוצע,א,GI_hatzof_A2_proposed.png,17.9,חתך 3.4A,"],
    ["GI_hatzof_existing.png", "GI_hatzof_A_proposed.png", "GI_hatzof_A2_proposed.png"]);
  assert.deepEqual(r.manifest.streets[0].proposed.map((a) => a.label), ["חלופה א", "חלופה א – חתך 2"]);
});
test("בנייה: שגיאות ברורות לקובץ חסר, שם שגוי, מצב לא תואם, כפילות, שני חתכים קיימים ורוחב לא מספרי", () => {
  const rows = [
    "גילה,המור,כל הרחוב,קיים,,GI_hamor_existing.png,24.59,,",
    "גילה,המור,כל הרחוב,קיים,,GI_hamor_existing.png,24.59,,",          // כפילות
    "גילה,המור,A,מוצע,א,GI_hamor_A_proposed.png,כ,,",                    // רוחב שגוי
    "גילה,המור,B,מוצע,ב,GI_hamor_B_proposed.png,25,,",                   // קובץ חסר
    "גילה,המור,C,קיים,ג,GI_hamor_C_proposed.png,25,,",                   // מצב לא תואם
    "גילה,המור,D,מוצע,ד,המור_D.png,25,,",                                 // שם בעברית
  ];
  const e = build(rows, ["GI_hamor_existing.png", "GI_hamor_A_proposed.png", "GI_hamor_C_proposed.png"]).errors.join("\n");
  for (const k of ["מופיע פעמיים", "אינו מספר", "GI_hamor_B_proposed.png לא נמצא", "לא תואם לשם הקובץ", "אינו בפורמט"]) assert.match(e, new RegExp(k), k);
  const two = build(["גילה,המור,כל הרחוב,קיים,,GI_hamor_existing.png,1,,", "גילה,המור,כל הרחוב,קיים,,GI_hamor_existing-2.png,1,,"], ["GI_hamor_existing.png", "GI_hamor_existing-2.png"]).errors.join("\n");
  assert.match(two, /יותר מחתך קיים אחד/);
});
test("בנייה: אזהרה כשאין חתך קיים או מוצע, וקבצים כבדים מסומנים", () => {
  const w = build(["גילה,המור,A,מוצע,א,GI_hamor_A_proposed.png,24,,", "גילה,שמיר,כל הרחוב,קיים,,GI_shamir_existing.png,11,,"], ["GI_hamor_A_proposed.png", "GI_shamir_existing.png"]).warnings.join("\n");
  assert.match(w, /GI_hamor: אין חתך קיים/); assert.match(w, /GI_shamir: אין חתך מוצע/);
  const d = tmpImages([]); writeFileSync(join(d, "GI_a_existing.png"), Buffer.alloc(400 * 1024)); writeFileSync(join(d, "GI_a_A_proposed.png"), Buffer.alloc(2 * 1024 * 1024));
  const r = buildSections({ csvFiles: [{ name: "T.csv", text: [HEAD, "גילה,א,כל הרחוב,קיים,,GI_a_existing.png,1,,", "גילה,א,A,מוצע,א,GI_a_A_proposed.png,1,,"].join("\n") }], imagesDir: d });
  assert.match(r.warnings.join(), /GI_a_existing.png: 400KB/); assert.match(r.errors.join(), /כבד מדי/);
});
test("בנייה: כינויים מחושבים מהשם ומקובץ aliases, וקודים מ-codes.json מתמזגים עם ה-CSV", () => {
  assert.deepEqual(deriveAliases("אריה בן-אליעזר"), ["אריה בן אליעזר", "בן אליעזר"]);
  assert.deepEqual(deriveAliases("המור"), ["המור"]);
  const r = build(["גילה,המור,כל הרחוב,קיים,,GI_hamor_existing.png,1,,5-5", "גילה,המור,A,מוצע,א,GI_hamor_A_proposed.png,1,,"], ["GI_hamor_existing.png", "GI_hamor_A_proposed.png"], { aliases: { GI_hamor: ["הרב המור"] }, codes: { GI_hamor: ["6-6", "5-5"] } });
  assert.deepEqual(r.manifest.streets[0].aliases, ["המור", "הרב המור"]); assert.deepEqual(r.manifest.streets[0].codes, ["5-5", "6-6"]);
});

// ---------- הנתונים בריפו ----------
test("נתוני גילה: sections.json תואם ל-CSV ואין שגיאות או אזהרות", () => {
  const { manifest, errors, warnings } = loadAndBuild(ROOT);
  assert.deepEqual(errors, []); assert.deepEqual(warnings, []);
  assert.equal(readFileSync(join(ROOT, "public/data/sections/sections.json"), "utf8"), JSON.stringify(manifest, null, 2) + "\n", "הריצי: node scripts/build-sections.mjs");
});
test("נתוני גילה: 9 רחובות, לכל אחד חתך קיים ולפחות חלופה אחת, ו-30 תמונות", () => {
  const { streets } = JSON.parse(readFileSync(join(ROOT, "public/data/sections/sections.json"), "utf8"));
  assert.equal(streets.length, 9);
  let n = 0;
  for (const s of streets) { assert.ok(s.existing, s.id); assert.ok(s.proposed.length >= 1, s.id); assert.equal(s.plan, "גילה"); n += 1 + s.proposed.length; }
  assert.equal(n, 30);
  assert.deepEqual(streets.map((s) => s.proposed.length).sort(), [2, 2, 2, 2, 2, 2, 3, 3, 3]);   // 21 חלופות + 9 חתכים קיימים
});
test("תמונות: PNG אמיתי, רוחב סביר, ועד 300KB", () => {
  const { streets } = JSON.parse(readFileSync(join(ROOT, "public/data/sections/sections.json"), "utf8"));
  for (const s of streets) for (const it of [s.existing, ...s.proposed]) {
    const f = join(ROOT, "public/data/sections/images", it.file);
    assert.ok(existsSync(f), it.file);
    const b = readFileSync(f);
    assert.equal(b.subarray(1, 4).toString(), "PNG", it.file);
    assert.ok(b.readUInt32BE(16) >= 400, `${it.file}: רוחב ${b.readUInt32BE(16)}`);
    assert.ok(statSync(f).size <= 300 * 1024, it.file);
  }
});
test("שמות הרחובות של גילה מזוהים ממשפטים טיפוסיים (כולל כתיב חלופי)", () => {
  const sec = JSON.parse(readFileSync(join(ROOT, "public/data/sections/sections.json"), "utf8"));
  const id = (name) => sxMatch(sec, P({ name })).map((s) => s.id);
  assert.deepEqual(id("שדרוג רחוב שבתאי הנגבי"), ["GI_hanegbi"]);
  assert.deepEqual(id("שביל אופניים ברחוב הנגבי"), ["GI_hanegbi"]);
  assert.deepEqual(id("שדרוג רחוב אריה בן אלעזר"), ["GI_ben-eliezer"]);
  assert.deepEqual(id("שדרוג רחוב בן-אליעזר"), ["GI_ben-eliezer"]);
  assert.deepEqual(id("שדרוג רחוב יוטסמן"), ["GI_yustman"]);
  assert.deepEqual(id("שדרוג רחוב יוסטמן"), ["GI_yustman"]);
  for (const [n, k] of [["ורדינון", "vardinon"], ["לבונה", "levona"], ["אפרסמון", "afarsemon"], ["שמיר", "shamir"], ["הצוף", "hatzof"], ["המור", "hamor"]]) assert.deepEqual(id("שדרוג רחוב " + n), ["GI_" + k], n);
  assert.deepEqual(id("שדרוג רחוב דב יוסף"), []);
});

// ---------- דוח ההתאמות ----------
test("דוח התאמות: פרויקטים מסוג רחוב ללא חתך מופיעים כיתומים, והקודים נאספים", () => {
  const d = mkdtempSync(join(tmpdir(), "sxm-")); mkdirSync(join(d, "public/data/layers"), { recursive: true });
  const ft = (code, ptype, descr) => ({ type: "Feature", properties: { gis_code: code, ptype, descr, sub: "גילה א" }, geometry: { type: "LineString", coordinates: [[218000, 626000], [218010, 626010]] } });
  writeFileSync(join(d, "public/data/layers/g.geojson"), JSON.stringify({ type: "FeatureCollection", features: [
    ft("2-9", "שדרוג רחוב", "שדרוג רחוב המור"), ft("2-9", "שדרוג רחוב", "שדרוג רחוב המור"),   // אותו פרויקט בשני קטעים
    ft("3-3", "שביל אופניים", "שביל אופניים ברחוב ורדינון"), ft("1-37", "נתיב תחבורה ציבורית", "נתיב העדפה ברחוב דב יוסף"),
    ft("1-13", "שביל הליכה", "שביל הליכה שמיר"), ft("4-4", "רחוב חדש", "חיבור מהמור אל שמיר") ] }));
  const projects = projectsFromLayers({ layers: [{ plan: "גילה", file: "g.geojson" }] }, d);
  assert.equal(projects.length, 5);
  const sec = { streets: [
    { id: "GI_hamor", plan: "גילה", name: "המור", aliases: ["המור"], codes: [] }, { id: "GI_vardinon", plan: "גילה", name: "ורדינון", aliases: ["ורדינון"], codes: [] },
    { id: "GI_shamir", plan: "גילה", name: "שמיר", aliases: ["שמיר"], codes: [] }, { id: "GI_none", plan: "גילה", name: "אין", aliases: ["אין"], codes: [] } ] };
  const r = report(sec, projects);
  assert.deepEqual(r.matched.get("GI_hamor").map((p) => p.code), ["2-9", "4-4"]);
  assert.deepEqual(r.matched.get("GI_vardinon").map((p) => p.code), ["3-3"]);
  assert.deepEqual(r.matched.get("GI_shamir").map((p) => p.code), ["4-4"]);      // שביל הליכה שמיר לא נספר
  assert.deepEqual(r.matched.get("GI_none"), []);
  assert.deepEqual(r.orphan.map((p) => p.code), ["1-37"]);                      // דב יוסף: אין לו חתך
  assert.deepEqual(r.multi.map((m) => m.p.code), ["4-4"]);
});

// ---------- הזרקה לדאשבורד ----------
const DASH = `<script>\n(() => {\n  function presGila(body, p) {}\n  function presProject(body, p) {\n    if (p.code && PRES.gila) { presGila(body, p); return; }\n    const entries = [];\n  }\n  function other() {}\n})();\n</script>`;
test("הזרקה: הקוד לפני presProject, הקריאה כשורה הראשונה בה, והתוכן המקורי נשמר", () => {
  const { html, log, warn } = patchSections(DASH);
  assert.deepEqual(warn, []); assert.equal(log.length, 1);
  const iMark = html.indexOf(SX_MARK), iFn = html.indexOf("function presProject(body, p) {"), iCall = html.indexOf("sxBlock(body, p);", iFn);
  assert.ok(iMark > 0 && iMark < iFn && iFn < iCall);
  assert.equal(html.slice(iFn).split("\n")[1].trim().startsWith("try { sxBlock(body, p)"), true);
  for (const keep of ["if (p.code && PRES.gila) { presGila(body, p); return; }", "function presGila(body, p) {}", "function other() {}"]) assert.ok(html.includes(keep), keep);
  assert.doesNotThrow(() => new Function("el", "S", "PRES", "renderPanel", "fetch", "location", "addEventListener", "document", html.replace(/<\/?script>/g, "")));
});
test("הזרקה: בטוחה להרצה חוזרת, ואזהרה מפורשת כשהעוגן חסר", () => {
  const once = patchSections(DASH).html, twice = patchSections(once);
  assert.equal(twice.html, once); assert.equal((once.match(/const SX = /g) || []).length, 1);
  const r = patchSections(DASH.replace("function presProject", "function presOther"));
  assert.equal(r.html, DASH.replace("function presProject", "function presOther")); assert.match(r.warn.join(), /presProject/);
});

test("הזרקה: עובדת גם בקובץ עם סיומות שורה של Windows (CRLF)", () => {
  const crlf = DASH.replace(/\n/g, "\r\n");
  const { html, warn } = patchSections(crlf);
  assert.deepEqual(warn, []);
  assert.ok(html.includes("try { sxBlock(body, p); }") && html.includes("const SX = "));
  assert.ok(!/[^\r]\n/.test(html.replace(/\r\n/g, "")) && !html.replace(/\r\n/g, "").includes("\n"), "כל סיומות השורה נשארו CRLF");
  assert.equal(patchSections(html).html, html);
});

// ---------- רגרסיה על השמות האמיתיים מדוח ההתאמה של גילה א (מה-Codespace של יעל, 24.11.2026) ----------
const SECT = () => JSON.parse(readFileSync(join(ROOT, "public/data/sections/sections.json"), "utf8"));
const REPORT = [  // [קוד, שירות, שם, תיאור (רק היכן שהתיאור הוא שגרם לטעות, בדמיון לתיאור שבשכבה), רחובות צפויים]
  ["1-16", "רחוב חדש", "כביש חדש מצפון לדרום האפרסמון", "", ["afarsemon"]],
  ["1-12", "רחוב חדש", "כביש חדש אפרסמון לרוזמרין", "", ["afarsemon"]],
  ["1-29", "שביל אופניים", "שביל אופניים האפרסמון לבגין", "עד רחוב המור", ["afarsemon"]],
  ["1-18", "תנועה משולבת", "מיתון תנועה ברחוב האפרסמון", "", ["afarsemon"]],
  ["1-43", "שדרוג רחוב", "שדרוג רחוב אפרסמון", "", ["afarsemon"]],
  ["1-27", "שביל אופניים", "שביל אופניים אריה בן אלעזר", "", ["ben-eliezer"]],
  ["1-41", "שדרוג רחוב", "שדרוג רחוב אריה בן-אלעזר", "", ["ben-eliezer"]],
  ["1-30", "שביל אופניים", "שביל אופניים המור", "", ["hamor"]],
  ["1-44", "שדרוג רחוב", "שדרוג רחוב המור", "", ["hamor"]],
  ["1-17", "רחוב חדש", "כביש מצפון לדרום מרחוב ורדינון לצוף", "", ["hatzof", "vardinon"]],
  ["1-31", "שביל אופניים", "שביל אופניים ורדינון", "", ["vardinon"]],
  ["1-40", "שדרוג רחוב", "שדרוג רחוב ורדינון", "", ["vardinon"]],
  ["1-45", "שדרוג רחוב", "שדרוג רחוב יוסטמן", "", ["yustman"]],
  ["1-28", "שדרוג רחוב", "שדרוג רחוב לבונה", "", ["levona"]],
  ["1-39", "שדרוג רחוב", "שדרוג רחוב שבתאי הנגבי", "", ["hanegbi"]],
  ["1-19", "תנועה משולבת", "מיתון תנועה ברחוב שמיר", "", ["shamir"]],
  // לא אמורים להותאם:
  ["1-37", "נתיב תחבורה ציבורית", "נתיב העדפה לשני הכוונים ברחוב דב יוסף", "הנגבי - מחלף דב יוסף", []],   // היה מותאם בטעות להנגבי
  ["1-36", "נתיב תחבורה ציבורית", "נתיב העדפה לקראת צומת הנגבי/דב יוסף לכיוון מערב", "", []],              // צומת
  ["1-20", "תנועה משולבת", "מיתון תנועה ברחוב שרפאת", "", []],
  ["1-33", "שביל אופניים", "שביל אופניים סינגל לשביל המסילה (מלחה)", "", []],
  ["1-13", "שביל הליכה", "שביל הליכה שמיר", "", []],
];
test("גילה א: ההתאמות לפי שמות הפרויקטים האמיתיים (16 פרויקטים מותאמים, ובלי התאמות שגויות)", () => {
  const sec = SECT();
  for (const [code, service, name, desc, want] of REPORT) {
    const got = sxMatch(sec, P({ code, service, name, desc })).map((s) => s.id.replace("GI_", "")).sort();
    assert.deepEqual(got, [...want].sort(), `${code} ${name}`);
  }
  assert.equal(REPORT.filter((r) => r[4].length).length, 16);
});
test("גילה ב–ה: 30 שמות אמיתיים מהדוח (רחובות שאין להם עדיין חתך) לא מותאמים לאף חתך", () => {
  const sec = SECT();
  const names = ["נתיב העדפה לשני הכוונים ברחוב הרוזמרין", "כביש חדש חד כווני יפה רום", "שביל אופניים ברחוב האחלמה", "שביל אופניים ברחוב שלמה דוגה", "שדרוג רחוב הרוזמרין", "שדרוג רחוב שלמה דוגה",
    "שדרוג רחוב לשם", "שדרוג רחוב המרגלית", "שדרוג רחובהסנונית", "שדרוג רחוב דגן", "שדרוג רחוב המחנכת", "שדרוג רחוב אבנר חי שאקי", "שדרוג רחוב ברוכי יהושע", "מיתון תנועה ברחוב המחנכת",
    "מיתון תנועה ברחוב האחות יהודית", "מיתון תנועה ברחוב אלטשולר", "מיתון תנועה ברחוב גבעת קנדה", "מיתון תנועה ברחוב הציפורן", "שביל אופניים בכביש 1", "שביל אופניים ברחוב אונטרמן",
    "כביש חדש מרחוב המרגלית לאודם, מצפון לדרום", "כביש חדש מלשם לסנונית", "כביש חדש מרחוב השיש לאחות יהודית", "שדרוג רחוב יפה רום", "שדרוג רחוב הציפורן", "שביל אופניים צביה ויצחק לפארק גילה",
    "שביל אופניים על כביש חדש מוצע מרחוב המרגלית לתירוש", "מיתון תנועה ברחוב שרפאת", "שדרוג רחוב יעקב ברמן", "שדרוג רחוב פוצקי"];
  for (const service of ["שדרוג רחוב", "שביל אופניים", "רחוב חדש", "תנועה משולבת", "נתיב תחבורה ציבורית"])
    for (const name of names) assert.deepEqual(sxMatch(sec, P({ service, name })), [], `${service} | ${name}`);
});
