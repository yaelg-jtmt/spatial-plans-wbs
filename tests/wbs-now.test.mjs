// npm run test:sync — "מה קורה עכשיו בתכנית": תלויות, מצב משימות, השלב הנוכחי, רשימות, אמינות ולוח זמנים.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { STAGES } from "../src/lib/wbsLogic.js";
import {
  FILTERS, buildGraph, buildRows, classifyRows, countsFor, currentStages, focusLists, freshness, matchesFilter,
  needsDecision, nextMaintenance, parsePredecessors, scheduleOf, stageDisplay, stageSummary,
} from "../src/lib/wbsNow.js";

const read = (f) => JSON.parse(readFileSync(new URL(`../public/data/${f}`, import.meta.url), "utf8"));
const plans = read("plans.json"), tpl = read("wbs-template.json"), gantt = read("gantt.json");
const P = Object.fromEntries(plans.map((p) => [p.id, p]));
const graph = buildGraph(tpl);
const view = (id, over = {}, vb = false) => buildRows(P[id], tpl, over, vb, graph);
const done = (ids) => Object.fromEntries(ids.map((i) => [i, { status: "הושלם" }]));
const idsOf = (rows) => rows.map((r) => r.id);

// ---------- תלויות ----------
test("תלויות: טווחים מורחבים לפי סדר הטבלה, ו'נתונים' נשמר כהערה", () => {
  const order = graph.order;
  assert.deepEqual(parsePredecessors("1.2–1.5", order).ids, ["1.2", "1.3", "1.4", "1.5"]);
  assert.deepEqual(parsePredecessors("3.2–3.13A", order).ids, ["3.2", "3.6", "3.9", "3.10", "3.11", "3.13A"]);
  assert.deepEqual(parsePredecessors("6.2–6.6", order).ids, ["6.2", "6.3", "6.4", "6.4A", "6.5", "6.6"]);
  assert.deepEqual(parsePredecessors("4.1,M3.4", order).ids, ["4.1", "M3.4"]);
  assert.deepEqual(parsePredecessors("2.4/נתונים", order), { ids: ["2.4"], notes: ["נתונים"] });
  for (const none of ["—", "", null, undefined, "-"]) assert.deepEqual(parsePredecessors(none, order), { ids: [], notes: [] });
  assert.deepEqual(parsePredecessors("9.9", order), { ids: [], notes: ["9.9"] });
  assert.deepEqual(parsePredecessors("1.5–1.2", order).ids, [], "טווח הפוך לא מורחב");
  assert.deepEqual(parsePredecessors("1.1,1.1", order).ids, ["1.1"]);
});
test("תלויות: בכל 65 השורות כל קודמת קיימת ומופיעה לפני המשימה, ההערה היחידה היא 'נתונים', ואין מעגלים", () => {
  assert.equal(tpl.length, 65);
  const notes = [...graph.notes.entries()].filter(([, n]) => n.length);
  assert.deepEqual(notes, [["2.8", ["נתונים"]]]);
  for (const r of tpl) for (const p of graph.preds.get(r.id)) assert.ok(graph.order.indexOf(p) < graph.order.indexOf(r.id), `${r.id} <- ${p}`);
  for (const [id, ps] of graph.preds) for (const p of ps) assert.ok(graph.succs.get(p).includes(id));
  assert.deepEqual(graph.succs.get("M2.8"), ["3.1"]);
  assert.equal(graph.preds.get("0.1").length, 0);
});

// ---------- מצב משימות ----------
test("מצב משימה: הושלם / בעבודה / מוכנה / ממתינה לקודמת / מעוכבת / ממתינה / לא נספרת", () => {
  const rows = view("BK", { "5.1": { status: "מעוכב" }, "5.2": { status: "ממתין" }, "5.3": { decision: "לא נדרש" } });
  const st = (id) => rows.find((r) => r.id === id).state;
  assert.equal(st("0.1"), "done");           // שלב 0 הושלם
  assert.equal(st("4.1"), "active");         // שלב 4 פעיל
  assert.equal(st("5.1"), "blocked");
  assert.equal(st("5.2"), "waiting");
  assert.equal(st("5.3"), "excluded");
  assert.equal(st("5.4"), "queued");         // תלויה ב-5.1 שלא הושלמה
  assert.deepEqual(rows.find((r) => r.id === "5.4").unmet, ["5.1"]);
});
test("מוכנה להתחלה: רק כשכל הקודמות הושלמו או לא נספרות", () => {
  let rows = view("BK");
  assert.equal(rows.filter((r) => r.state === "ready").length, 0, "בתחילה כל שלב 5 ממתין ל-M4.7");
  rows = view("BK", done(["4.1", "4.2", "4.3", "4.4", "4.5", "4.6", "4.7", "4.9", "M4.7"]));
  assert.deepEqual(idsOf(rows.filter((r) => r.state === "ready")), ["5.1"]);
  rows = view("BK", { ...done(["4.1", "4.2", "4.3", "4.4", "4.5", "4.6", "4.7", "4.9", "M4.7", "5.1"]) });
  assert.deepEqual(idsOf(rows.filter((r) => r.state === "ready")), ["5.2", "5.3", "5.4", "5.5", "5.6", "5.7", "5.8", "5.9"]);
});
test("קודמת שאינה נספרת (לא נדרש / הוחרגה) לא חוסמת", () => {
  const base = done(["4.1", "4.2", "4.3", "4.4", "4.5", "4.6", "4.7", "4.9", "M4.7"]);
  const rows = view("BK", { ...base, "5.1": { decision: "לא נדרש" } });
  assert.equal(rows.find((r) => r.id === "5.1").state, "excluded");
  assert.deepEqual(idsOf(rows.filter((r) => r.state === "ready")), ["5.2", "5.3", "5.4", "5.5", "5.6", "5.7", "5.8", "5.9"]);
});
test("תכנית שהושלמה: הכול 'הושלם' או 'לא נספרת', בלי עבודה פעילה", () => {
  for (const id of ["AH", "SW", "OR", "GI"]) {
    const s = new Set(view(id).map((r) => r.state));
    assert.deepEqual([...s].sort(), ["done", "excluded"], id);
  }
});
test("שורות: שדות manual / note / updated נגזרים מהבחירות ולא משנים את התבנית", () => {
  const snapshot = JSON.stringify(tpl);
  const rows = view("TA", { "2.1": { status: "הושלם", note: "נסגר בפגישה", updated: "2026-11-20T08:00:00.000Z" }, "2.4": { owner: "יועץ מקצועי" }, "2.8": { decision: "לא נדרש" } });
  const g = (id) => rows.find((r) => r.id === id);
  assert.deepEqual([g("2.1").manual, g("2.1").note, g("2.1").updated], [true, "נסגר בפגישה", "2026-11-20T08:00:00.000Z"]);
  assert.deepEqual([g("2.4").manual, g("2.4").hasOverride], [false, true], "שינוי אחראי בלבד אינו עדכון סטטוס");
  assert.deepEqual([g("2.8").manual, g("2.8").state], [true, "excluded"]);
  assert.deepEqual([g("2.2").manual, g("2.2").hasOverride, g("2.2").note, g("2.2").updated], [false, false, "", null]);
  assert.equal(JSON.stringify(tpl), snapshot);
});

// ---------- השלב הנוכחי ----------
test("השלבים הנוכחיים: לפי התכנית, תכנית שהושלמה = תחזוקה, וגרסה ב' = 0–4", () => {
  assert.deepEqual(currentStages(P.TA), [2, 3]);
  assert.deepEqual(currentStages(P.BK), [4]);
  assert.deepEqual(currentStages(P.ZB), [3, 4]);
  assert.deepEqual(currentStages(P.FI), [1, 2]);
  for (const id of ["AH", "SW", "OR", "GI"]) assert.deepEqual(currentStages(P[id]), [6]);
  assert.deepEqual(currentStages(P.GI, true), [0, 1, 2, 3, 4]);
});
test("סיכום שלב: הספירות מסתכמות, ואחוז הושלם מחושב ללא לא-נספרות", () => {
  const rows = view("TA", { "2.8": { decision: "לא נדרש" }, ...done(["2.1", "2.2"]) });
  for (let s = 0; s < 7; s++) {
    const c = stageSummary(rows, s);
    assert.equal(c.done + c.active + c.ready + c.queued + c.blocked + c.waiting + c.excluded, c.total, `שלב ${s}`);
  }
  const s2 = stageSummary(rows, 2);
  assert.deepEqual([s2.total, s2.counted, s2.done, s2.excluded], [13, 12, 2, 1]);
  assert.equal(s2.pct, Math.round((2 / 12) * 100));
  assert.equal(stageSummary(rows, 0).pct, 100);
  assert.equal(stageDisplay(stageSummary(rows, 0), false), "done");
  assert.equal(stageDisplay(stageSummary(rows, 2), true), "current");
  assert.equal(stageDisplay(stageSummary(rows, 4), false), "future");
  assert.equal(stageDisplay({ counted: 5, done: 1, active: 0 }, false), "partial");
});

// ---------- רשימות ----------
test("תכנית פעילה (תלפיות): 24 משימות בעבודה, 2.4/2.8/2.9/2.12 ו-3.x 'לפי צורך' מחכות להחלטה, ושלבים 4–6 ממתינים", () => {
  const rows = view("TA"), c = countsFor(rows, 3), l = focusLists(rows, 3);
  assert.equal(c.active, 24); assert.equal(c.ready, 0); assert.equal(c.done, 13);
  assert.equal(c.queued, 28); assert.equal(c.stuck, 0); assert.equal(c.excluded, 0);
  assert.equal(c.done + c.active + c.queued, 65);
  assert.deepEqual(idsOf(l.decide), ["2.4", "2.8", "2.9", "2.12", "3.2", "3.9", "3.13A", "3.14"]);
  assert.ok(!idsOf(l.decide).includes("5.3"), "החלטות בשלבים עתידיים לא מוצגות");
  assert.deepEqual(l.active.slice(0, 3).map((r) => r.id), ["2.1", "2.6", "2.7"], "קודם מי שכל הקודמות שלו הושלמו (2.5 מחכה ל-2.1), לפי סדר הטבלה");
});
test("מיון 'בעבודה': לפי שלב, ואז מי שכל קודמותיו הושלמו (unmet קטן) קודם", () => {
  const rows = view("TA");
  const l = focusLists(rows, 3).active;
  for (let i = 1; i < l.length; i++) assert.ok(l[i - 1].stage < l[i].stage || (l[i - 1].stage === l[i].stage && l[i - 1].unmet.length <= l[i].unmet.length));
  assert.equal(l[0].unmet.length, 0);
});
test("ממתינות להחלטה: לא כוללת הושלמו, לא-נספרות, ושלבים אחרי השלב הנוכחי", () => {
  const rows = view("TA", { "2.4": { status: "הושלם" }, "2.8": { decision: "לא נדרש" }, "2.9": { decision: "נדרש" } });
  assert.deepEqual(idsOf(focusLists(rows, 3).decide), ["2.12", "3.2", "3.9", "3.13A", "3.14"]);
  assert.ok(needsDecision(rows.find((r) => r.id === "2.12"), 3) && !needsDecision(rows.find((r) => r.id === "2.12"), 1));
});
test("גרסה ב': כל רכיבי 0–4 ממתינים להחלטה, השלב הנוכחי 0–4, ושלבים 5–6 לא", () => {
  const rows = view("GI", {}, true), cur = currentStages(P.GI, true), l = focusLists(rows, Math.max(...cur));
  const need = idsOf(tpl.filter((r) => r.stage <= 4 && !r.id.startsWith("M")));
  assert.deepEqual(idsOf(l.decide), need);
  assert.deepEqual(idsOf(l.ready), ["0.1"], "רק 0.1 ללא קודמת");
  assert.ok(rows.filter((r) => r.stage >= 5).every((r) => r.state === "done" || r.state === "excluded"), "הושלמה: 5–6 נשארים הושלמו בגרסה ב'");
  assert.equal(rows.filter((r) => r.state === "active").length, 0, "בגרסה ב' של תכנית שהושלמה אין עבודה פעילה עד שמתחילים");
  // תכנית שלא הושלמה: גרסה ב' לא משנה את שלבים 5–6
  const bk = view("BK", {}, true);
  assert.ok(bk.filter((r) => r.stage >= 5).every((r) => r.state === "queued"));
});
test("מסננים: ההגדרות תואמות לספירות, והספירות לא מכפילות (כל משימה במצב אחד)", () => {
  const rows = view("BK", { "5.1": { status: "מעוכב" }, "5.3": { decision: "לא נדרש" } }), c = countsFor(rows, 4);
  for (const f of FILTERS) assert.equal(rows.filter((r) => matchesFilter(r, f.key, 4)).length, c[f.key], f.key);
  assert.equal(c.done + c.active + c.ready + c.queued + c.stuck + c.excluded, c.all);
  assert.equal(c.stuck, 1);
});

// ---------- אמינות ----------
test("אמינות: כמה משימות בשלבים הנוכחיים עודכנו ידנית, ומתי עודכן לאחרונה", () => {
  assert.deepEqual(freshness(view("TA"), [2, 3]), { total: 24, confirmed: 0, last: null });
  const rows = view("TA", { "2.1": { status: "הושלם", updated: "2026-11-20T08:00:00.000Z" }, "2.2": { decision: "נדרש", updated: "2026-11-22T10:00:00.000Z" }, "1.1": { note: "x", updated: "2026-11-23T10:00:00.000Z" }, "2.8": { decision: "לא נדרש", updated: "2026-11-21T10:00:00.000Z" } });
  const f = freshness(rows, [2, 3]);
  assert.equal(f.confirmed, 2, "2.1 ו-2.2 (2.8 לא נספרת, 1.1 בשלב קודם)");
  assert.equal(f.total, 23);
  assert.equal(f.last, "2026-11-23T10:00:00.000Z");
});

// ---------- לוח זמנים ----------
test("לוח זמנים: חלון השלב בגאנט, ו'עבר החלון' רק אחרי סוף החלון", () => {
  const at = (y, m, d) => new Date(y, m, d);
  assert.deepEqual(scheduleOf(P.ZB, gantt, 3, false, at(2026, 10, 24)), { label: "נוב׳ 26 – דצמ׳ 26", late: false });
  assert.equal(scheduleOf(P.ZB, gantt, 3, false, at(2026, 11, 31)).late, false, "בחודש האחרון של החלון");
  assert.equal(scheduleOf(P.ZB, gantt, 3, false, at(2027, 0, 1)).late, true, "החודש שאחרי החלון");
  assert.deepEqual(scheduleOf(P.ZB, gantt, 4, false, at(2027, 1, 15)), { label: "דצמ׳ 26 – מרץ 27", late: false });
  assert.equal(scheduleOf(P.TA, gantt, 2, false, at(2027, 2, 1)).late, true);
  assert.equal(scheduleOf(P.TA, gantt, 0, false, at(2026, 10, 24)), null, "שלב שהסתיים אין לו חלון");
  assert.equal(scheduleOf(P.SW, gantt, 6, false, at(2026, 10, 24)), null, "תחזוקה היא מחזורית");
  assert.equal(scheduleOf(P.SW, gantt, 3, false, at(2026, 10, 24)), null, "תכנית שהושלמה: בלי חלון");
  assert.deepEqual(scheduleOf(P.SW, gantt, 3, true, at(2026, 10, 24)), { label: "נוב׳ 26 – דצמ׳ 26", late: false }, "בגרסה ב' החלון חוזר");
});
test("תחזוקה: המחזור הבא, והאם המחזור הנוכחי", () => {
  assert.deepEqual(nextMaintenance(P.SW, gantt, false, new Date(2026, 10, 24)), { label: "ינו׳ 27", now: false });
  assert.deepEqual(nextMaintenance(P.SW, gantt, false, new Date(2027, 0, 10)), { label: "ינו׳ 27", now: true });
  assert.deepEqual(nextMaintenance(P.SW, gantt, false, new Date(2027, 0, 31)), { label: "ינו׳ 27", now: true });
  assert.deepEqual(nextMaintenance(P.SW, gantt, false, new Date(2027, 1, 1)), { label: "אפר׳ 27", now: false });
  assert.equal(nextMaintenance(P.SW, gantt, false, new Date(2028, 0, 1)), null, "אחרי סוף הגאנט");
  assert.equal(nextMaintenance(P.FI, gantt, false, new Date(2026, 10, 24)), null, "אין תחזוקה בגאנט");
});
test("classifyRows: פונקציה טהורה, ללא תלות ב-React או ב-DOM", () => {
  assert.deepEqual(classifyRows([], graph), []);
  assert.equal(STAGES.length, 7);
});
