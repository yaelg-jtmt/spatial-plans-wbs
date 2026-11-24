// בדיקות להורדת הטבלאות: שורות הטבלאות, חישוב "פרויקט עובר בתחום תב"ע" מול חישוב עצמאי (shapely), וההזרקה לדאשבורד.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { XT_PLAN_HEAD, XT_PROJ_HEAD, xtPlanRows, xtProjectRows } from "../scripts/xtables-core.mjs";
import { patchXtables, XT_HTML, XT_MARK, UI } from "../scripts/xtables-patch.mjs";

const fx = (n) => JSON.parse(readFileSync(new URL(`./fixtures/xtables/${n}.json`, import.meta.url), "utf8"));

// ---- עותקים של הפונקציות הגאומטריות והמיון מהדאשבורד (דאשבורד_תכניות_מרחביות_G5, xpPip/xpPlanRings/xpBox/xpRank). אם הדאשבורד משתנה, יש לעדכן. ----
const xpPlanRings = (g) => (!g || !g.coordinates ? [] : g.type === "MultiPolygon" ? g.coordinates.flat() : g.coordinates);
const xpBox = (rings) => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; rings.forEach((r) => r.forEach((c) => { if (c[0] < x0) x0 = c[0]; if (c[0] > x1) x1 = c[0]; if (c[1] < y0) y0 = c[1]; if (c[1] > y1) y1 = c[1]; })); return { x0, y0, x1, y1 }; };
const xpPip = (x, y, rings) => { let ins = false; for (const r of rings) { const n = r.length; for (let i = 0, j = n - 1; i < n; j = i++) { const xi = r[i][0], yi = r[i][1], xj = r[j][0], yj = r[j][1]; if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) ins = !ins; } } return ins; };
const ORDER = ["הכנת תכנית", "הכנת הודעה 77/78", "בבדיקה תכנונית", "במילוי תנאים להפקדה", "הפקדה להתנגדויות/השגות", "הכרעה בהתנגדויות / אישור", "בהליך אישור", "אישור", "רשת חלוקה", "מסמך מדיניות", "תסקיר סביבתי", "אחר"];
const rank = (s) => { const i = ORDER.indexOf(s); return i < 0 ? 99 : i + 1; };
const hasUrl = (u) => /^https?:\/\//.test(u || "");

const projects = fx("armon-projects");
const { plans: geoms, expected } = fx("armon-plans");
const G = Object.fromEntries(geoms.map((p) => [p.num, p.geom]));
const rec = (num, o = {}) => ({ num, space: "ארמון הנציב", name: "תב״ע " + num, station: "הפקדה להתנגדויות/השגות", url: "", geom: G[num], units: null, pct: null, ...o });
const deps = (o = {}) => ({ pip: xpPip, ringsOf: xpPlanRings, box: xpBox, ptsOf: (p) => p.pts, isBig: () => false, links: {}, authOf: (r) => r.auth || "(לא צוין)", rank, hasUrl, skipBig: false, ...o });
const hitsBy = (rows, planNum) => Object.fromEntries(rows.filter((r) => r[1] === planNum).map((r) => [String(r[6]), r[12]]));

// ---------- נתוני הבדיקה ----------
test("נתוני הבדיקה: 50 פרויקטים אמיתיים של ארמון הנציב, ו-6 פוליגונים עם תוצאה צפויה שחושבה ב-shapely", () => {
  assert.equal(projects.length, 50);
  assert.ok(projects.every((p) => p.pts.length >= 2 && p.pts.every((q) => q[0] > 34 && q[0] < 36 && q[1] > 31 && q[1] < 32)));
  assert.deepEqual(Object.keys(expected).sort(), ["P-BIG", "P-CORE", "P-FAR", "P-HOLE", "P-MULTI", "P-STRIP"]);
});

// ---------- טבלת תב"עות ----------
test("טבלת תב\"עות: עמודות ומיון זהים לייצוא הקיים (מרחב, סטטוס לפי דירוג, מספר)", () => {
  const recs = [
    { space: "תלפיות", num: "101-9", name: "ב", station: "אישור", auth: "מחוזית", units: 120, pct: 0.8749, url: "https://mavat.iplan.gov.il/x" },
    { space: "גילה", num: "101-2", name: "א", station: "אישור", auth: "מקומית", units: null, pct: null, url: "" },
    { space: "גילה", num: "101-1", name: "ג", station: "הכנת תכנית", auth: "מחוזית", units: -5, pct: 1, url: "ftp://bad" },
    { space: "גילה", num: "101-3", name: "ד", station: "", auth: "מחוזית", units: 0, pct: 0.004, url: "http://ok" },
  ];
  const rows = xtPlanRows(recs, { authOf: (r) => r.auth, rank, hasUrl });
  assert.equal(XT_PLAN_HEAD.length, 8);
  assert.deepEqual(rows.map((r) => r[1]), ["101-1", "101-2", "101-3", "101-9"]);      // גילה לפני תלפיות; הכנת תכנית < אישור < ללא סטטוס(99)
  assert.ok(rows.every((r) => r.length === XT_PLAN_HEAD.length));
  assert.deepEqual(rows[3], ["תלפיות", "101-9", "ב", "אישור", "מחוזית", 120, 87, { link: "https://mavat.iplan.gov.il/x", text: "פתיחה במבא\u05F4ת" }]);
  assert.deepEqual(rows[1].slice(5), ["", "", ""]);                                    // אין יח"ד, אין אחוז, אין קישור
  assert.equal(rows[0][5], -5); assert.equal(rows[0][7], "");                          // קישור שאינו http לא מוצג
  assert.equal(rows[2][3], "(ללא סטטוס)"); assert.equal(rows[2][5], 0); assert.equal(rows[2][6], 0);
});

// ---------- פרויקטים שעוברים בתחום תב"ע, מול חישוב עצמאי ----------
test("פרויקטים בתחום תב\"ע: מספר נקודות החפיפה לכל פרויקט זהה לחישוב ב-shapely, בכל 6 הפוליגונים", () => {
  for (const num of ["P-STRIP", "P-CORE", "P-HOLE", "P-MULTI", "P-BIG", "P-FAR"]) {
    const rows = xtProjectRows([rec(num)], projects, deps());
    assert.deepEqual(hitsBy(rows, num), expected[num], num);
    assert.equal(rows.length, Object.keys(expected[num]).length, num);
  }
});
test("חור בפוליגון (even-odd) ו-MultiPolygon מטופלים: פחות פרויקטים בחור, ושני חלקים ב-MultiPolygon", () => {
  const core = hitsBy(xtProjectRows([rec("P-CORE")], projects, deps()), "P-CORE"), hole = hitsBy(xtProjectRows([rec("P-HOLE")], projects, deps()), "P-HOLE");
  assert.ok(Object.keys(hole).length < Object.keys(core).length);
  assert.ok(Object.keys(hole).every((k) => k in core) && Object.keys(hole).some((k) => hole[k] < core[k]));
  const multi = hitsBy(xtProjectRows([rec("P-MULTI")], projects, deps()), "P-MULTI");
  assert.ok(multi["420"] >= 25, "הרצועה סביב פרויקט 420 נכללת");
  assert.ok(Object.keys(multi).length >= 2, "גם הפרויקטים שבחלק השני");
});
test("אחוז החפיפה הוא נקודות בפנים חלקי כל נקודות הפרויקט, ועמודות השורה מלאות", () => {
  const rows = xtProjectRows([rec("P-STRIP", { name: "רצועת גרונר", station: "אישור", auth: "מחוזית", url: "https://mavat.iplan.gov.il/p" })], projects, deps());
  assert.equal(XT_PROJ_HEAD.length, 16); assert.ok(rows.every((r) => r.length === 16));
  for (const r of rows) {
    const p = projects.find((q) => q.num === r[6]);
    assert.equal(r[13], Math.round(100 * r[12] / p.pts.length), String(r[6]));
    assert.deepEqual([r[0], r[1], r[2], r[3], r[4]], ["ארמון הנציב", "P-STRIP", "רצועת גרונר", "אישור", "מחוזית"]);
    assert.deepEqual([r[5], r[7], r[8], r[9], r[10], r[11]], [p.plan, p.name, p.service, p.quint, p.status, p.dep]);
    assert.equal(r[14], "מועמד אוטומטי"); assert.deepEqual(r[15], { link: "https://mavat.iplan.gov.il/p", text: "פתיחה במבא\u05F4ת" });
  }
});
test("תב\"ע שמכסה את רוב המרחב: לא נכללת ברשימה כוללת (skipBig), נכללת כשבוחרים אותה במפורש, ונכללת לפרויקט שאושר ידנית", () => {
  const big = rec("P-BIG"), isBig = (r) => r.num === "P-BIG";
  assert.equal(xtProjectRows([big], projects, deps({ skipBig: true, isBig })).length, 0);
  assert.equal(xtProjectRows([big], projects, deps({ skipBig: false, isBig })).length, 50);
  const links = { [projects[7].key]: { "P-BIG": "yes" } };
  const rows = xtProjectRows([big], projects, deps({ skipBig: true, isBig, links }));
  assert.deepEqual(rows.map((r) => r[6]), [projects[7].num]);
  assert.equal(rows[0][14], "אושר");
});
test("קישור שאושר ידנית ללא חפיפה גאומטרית נכלל עם 0 נקודות, וקישור שנדחה נשאר מסומן 'נדחה'", () => {
  const far = rec("P-FAR"), p0 = projects[0], p1 = projects[1];
  assert.equal(xtProjectRows([far], projects, deps()).length, 0);
  const yes = xtProjectRows([far], projects, deps({ links: { [p0.key]: { "P-FAR": "yes" } } }));
  assert.equal(yes.length, 1); assert.equal(yes[0][12], 0); assert.equal(yes[0][14], "אושר"); assert.equal(yes[0][6], p0.num);
  const strip = rec("P-STRIP"), hit = Object.keys(expected["P-STRIP"])[0], p = projects.find((q) => String(q.num) === hit);
  const no = xtProjectRows([strip], projects, deps({ links: { [p.key]: { "P-STRIP": "no" } } })).find((r) => String(r[6]) === hit);
  assert.equal(no[14], "נדחה"); assert.ok(no[12] > 0);
  assert.equal(p1.num !== undefined, true);
});
test("מיון: תב\"ע לפי דירוג הסטטוס ואז מספר, בתוכה 'אושר' קודם, ואז לפי מספר נקודות יורד", () => {
  const a = rec("P-CORE", { station: "אישור", num: "B-2" }), b = rec("P-CORE", { station: "הכנת תכנית", num: "A-1" }), c = rec("P-CORE", { station: "אישור", num: "A-9" });
  const keyOfTop = projects.find((p) => p.num === 5).key;
  const rows = xtProjectRows([a, b, c], projects, deps({ links: { [keyOfTop]: { "B-2": "yes" } } }));
  const order = []; for (const r of rows) if (order[order.length - 1] !== r[1]) order.push(r[1]);
  assert.deepEqual(order, ["A-1", "A-9", "B-2"]);
  const inB2 = rows.filter((r) => r[1] === "B-2");
  assert.equal(inB2[0][14], "אושר");
  const rest = inB2.slice(1).map((r) => r[12]); assert.deepEqual(rest, rest.slice().sort((x, y) => y - x));
});
test("רשומות ללא גאומטריה מדולגות, פרויקט בלי נקודות לא מפיל, ופרויקט שמחוץ לתיבה לא נבדק", () => {
  const noGeom = { ...rec("P-STRIP"), geom: null };
  assert.deepEqual(xtProjectRows([noGeom], projects, deps()), []);
  const empty = { key: "x|1", plan: "ארמון הנציב", num: 1, name: "ריק", pts: [] };
  assert.doesNotThrow(() => xtProjectRows([rec("P-CORE")], [empty, ...projects], deps()));
  let calls = 0; const countingPip = (...a) => { calls++; return xpPip(...a); };
  xtProjectRows([rec("P-FAR")], projects, deps({ pip: countingPip }));
  assert.equal(calls, 0, "תיבת התב\"ע הרחוקה פוסלת את כל הפרויקטים לפני בדיקת נקודה בפוליגון");
});
test("כל הפרויקטים נבדקים (גם מתכניות אחרות), והעמודה 'תכנית (פרויקט)' אומרת מאיזו תכנית הם", () => {
  const mixed = projects.slice(0, 5).concat([{ ...projects[5], key: "גילה|7", plan: "גילה", num: null, code: "2-9", name: "פרויקט של גילה" }]);
  const rows = xtProjectRows([rec("P-BIG")], mixed, deps());
  assert.equal(rows.length, 6);
  const g = rows.find((r) => r[5] === "גילה"); assert.equal(g[6], "2-9");                // קוד GIS קודם למספר
  assert.deepEqual(rows.filter((r) => r[5] === "ארמון הנציב").map((r) => r[6]).sort(), [1, 2, 3, 4, 5]);
});

// ---------- ההזרקה ----------
const DASH = '<div class="chips"><button id="xpRefresh">רענון</button><button id="xpXlsx">ייצוא</button><button class="btn small" type="button" id="xpLinksX">ייצוא קישורי פרויקט-תב"ע</button></div>\n<script>\nfunction xpWire() {}\nxpWire();\nfunction presProject() {}\n</script>';
test("הזרקה: ה-HTML אחרי שורת כפתורי הייצוא, והקוד מיד אחרי xpWire();", () => {
  const { html, log, warn } = patchXtables(DASH);
  assert.deepEqual(warn, []); assert.equal(log.length, 1);
  assert.ok(html.indexOf('id="xtSpace"') > html.indexOf('id="xpLinksX"'));
  assert.ok(html.indexOf(XT_MARK) > html.indexOf("xpWire();") && html.indexOf(XT_MARK) < html.indexOf("function presProject"));
  assert.ok(html.includes('id="xpRefresh"') && html.includes("function xpWire() {}"));
});
test("הזרקה: בטוחה להרצה חוזרת, ובקובץ עם CRLF", () => {
  const once = patchXtables(DASH).html; assert.equal(patchXtables(once).html, once);
  assert.equal((once.match(/const XT = /g) || []).length, 1); assert.equal((once.match(/id="xtSpace"/g) || []).length, 1);
  const crlf = patchXtables(DASH.replace(/\n/g, "\r\n"));
  assert.deepEqual(crlf.warn, []); assert.ok(!/[^\r]\n/.test(crlf.html));
});
test("הזרקה: אם אחד העוגנים חסר, לא משנים כלום ומקבלים אזהרה מפורשת", () => {
  const noJs = DASH.replace("xpWire();", "xpWireX();"), noHtml = DASH.replace('id="xpLinksX"', 'id="other"');
  for (const [d, re] of [[noJs, /xpWire/], [noHtml, /xpLinksX/]]) { const r = patchXtables(d); assert.equal(r.html, d); assert.match(r.warn.join(), re); }
});
test("ה-HTML המוזרק כולל כל מזהה שהקוד מחפש", () => {
  const used = [...new Set([...UI.matchAll(/\$\('#([A-Za-z]+)'\)/g)].map((m) => m[1]))].filter((id) => id.startsWith("xt"));
  assert.ok(used.length >= 6, used.join());
  for (const id of used) assert.ok(XT_HTML.includes(`id="${id}"`), id);
});
test("הקוד המוזרק הוא JavaScript תקין ב-scope של הדאשבורד", () => {
  const { html } = patchXtables(DASH);
  const js = html.slice(html.indexOf("<script>") + 8, html.lastIndexOf("</script>"));
  assert.doesNotThrow(() => new Function("$", "el", "S", "xp", "xpPip", "xpPlanRings", "xpBox", "xpProjectPts", "xpBig", "xpAuthOf", "xpRank", "xpHasUrl", "xpLoad", "xpStage", "xpSave", "xpXlsx", "xpInitSpaces", "xpSpaceOf", "xpAllNames", "XP_MAX_PARALLEL", "xpPopup", "presProject", js + "\nreturn 1;"));
});
