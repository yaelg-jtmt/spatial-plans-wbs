// npm run test:sync — העדכון השבועי: מיזוג שכבות, ייצוא, החלת עדכון עם בדיקות, ושלמות הנתונים שבריפו.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyUpdate } from "../scripts/apply-weekly-update.mjs";
import { buildExport, daysSince, mergeOverrides, mergeRow, pendingLocal, staleness } from "../src/lib/weeklyData.js";
import { buildRows } from "../src/lib/wbsNow.js";

const read = (f) => JSON.parse(readFileSync(new URL(`../public/data/${f}`, import.meta.url), "utf8"));
const plans = read("plans.json"), tpl = read("wbs-template.json"), status = read("wbs-status.json");
const P = Object.fromEntries(plans.map((p) => [p.id, p]));
const T = (d) => `2026-${d}T12:00:00.000Z`;
const run = (update, st = status, pl = plans) => applyUpdate({ update, plans: pl, status: st, template: tpl, today: "2026-12-01" });

// ---------- מיזוג ----------
test("מיזוג: העדכון עם חותמת הזמן המאוחרת יותר גובר, שדה-שדה", () => {
  const base = { status: "הושלם", note: "שבועי", updated: T("12-01") }, local = { status: "בתהליך", owner: "יועץ מקצועי", updated: T("11-20") };
  assert.deepEqual(mergeRow(base, local), { status: "הושלם", note: "שבועי", owner: "יועץ מקצועי", updated: T("12-01") });   // שבועי חדש יותר: גובר, והמקומי משלים שדות שחסרים
  const newerLocal = { status: "מעוכב", updated: T("12-03") };
  assert.deepEqual(mergeRow(base, newerLocal), { status: "מעוכב", note: "שבועי", updated: T("12-03") });
  assert.deepEqual(mergeRow(undefined, local), local); assert.deepEqual(mergeRow(base, undefined), base); assert.equal(mergeRow(undefined, undefined), undefined);
  assert.deepEqual(mergeRow({ status: "הושלם" }, { status: "בתהליך" }), { status: "בתהליך" }, "בלי חותמות: המקומי גובר");
});
test("מיזוג: mergeOverrides מאחד שורות משני המקורות, ושורות בלי חפיפה נשמרות", () => {
  const m = mergeOverrides({ "2.1": { status: "הושלם", updated: T("12-01") } }, { "2.2": { status: "בתהליך", updated: T("12-02") }, "2.1": { note: "x", updated: T("11-01") } });
  assert.deepEqual(Object.keys(m).sort(), ["2.1", "2.2"]); assert.equal(m["2.1"].status, "הושלם"); assert.equal(m["2.1"].note, "x");
});
test("שינויים מקומיים שעוד לא נכנסו לעדכון: רק מה שמנצח או שונה", () => {
  const base = { "2.1": { status: "הושלם", updated: T("12-01") }, "2.2": { status: "בתהליך", updated: T("12-01") } };
  const local = { "2.1": { status: "בתהליך", updated: T("11-20") }, "2.2": { status: "בתהליך", updated: T("12-02") }, "2.3": { note: "חדש", updated: T("12-02") }, "2.4": { updated: T("12-02") } };
  assert.deepEqual(pendingLocal(base, local), ["2.3"], "2.1 מוחלף בשבועי החדש, 2.2 זהה לשבועי, 2.4 ללא שינוי ממשי");
  assert.deepEqual(pendingLocal({}, {}), []);
});
test("הרכבה על ה-WBS: סטטוס מהעדכון השבועי משנה את המצב, והתלויות מתעדכנות", () => {
  const weeklyRows = Object.fromEntries(["2.1", "1.6"].map((id) => [id, { status: "הושלם", updated: T("12-01") }]));
  const rows = buildRows(P.TA, tpl, mergeOverrides(weeklyRows, {}));
  const g = (id) => rows.find((r) => r.id === id);
  assert.deepEqual([g("2.1").state, g("2.1").manual, g("1.6").state], ["done", true, "done"]);
  assert.equal(g("2.4").state, "active", "2.4 תלויה ב-2.1 ו-2.3, ו-2.3 עדיין בעבודה");
  assert.equal(g("2.5").state, "active");
});

// ---------- זמן ----------
test("כמה ימים עברו, וממתי נחשב ישן (יותר מ-10 ימים)", () => {
  const now = new Date(2026, 10, 24, 18, 0);
  assert.equal(daysSince("2026-11-24", now), 0); assert.equal(daysSince("2026-11-17", now), 7); assert.equal(daysSince("x", now), null);
  assert.deepEqual(staleness("2026-11-14", now), { days: 10, stale: false }); assert.equal(staleness("2026-11-13", now).stale, true);
  assert.equal(staleness(null, now).stale, true);
});

// ---------- ייצוא ----------
test("ייצוא: רק שינויים ממשיים, גרסה ב', ובלי תכניות שלא השתנו", () => {
  const store = { TA: { rows: { "2.1": { status: "הושלם", updated: T("12-01") }, "2.2": { updated: T("12-01") } }, versionB: false }, GI: { rows: {}, versionB: true }, BK: { rows: {}, versionB: false } };
  const out = buildExport(["TA", "GI", "BK", "AH"], (id) => store[id], new Date("2026-12-01T10:00:00Z"));
  assert.equal(out.exported, "2026-12-01T10:00:00.000Z");
  assert.deepEqual(out.plans, { TA: { rows: { "2.1": { status: "הושלם", updated: T("12-01") } } }, GI: { versionB: true } });
});
test("ייצוא → החלה: הקובץ שמייצא האתר מתקבל כמו שהוא ומתועד בתאריך שלו", () => {
  const exp = buildExport(["TA"], () => ({ rows: { "2.1": { status: "הושלם", note: "נסגר", updated: T("11-30") } }, versionB: false }), new Date("2026-12-01T10:00:00Z"));
  const r = run({ ...exp, date: "2026-12-01" });
  assert.deepEqual(r.errors, []); assert.equal(r.status.plans.TA.rows["2.1"].status, "הושלם"); assert.equal(r.status.plans.TA.rows["2.1"].updated, T("12-01"));
});

// ---------- החלת עדכון ----------
test("החלה: שדות תכנית נכנסים ל-plans, שורות ל-wbs-status, התאריך נרשם, והמקור לא משתנה", () => {
  const snap = JSON.stringify([plans, status]);
  const r = run({ date: "2026-12-01", plans: { TA: { progress: 58, blocker: "ממתינים לאישור", next: "לקיים Decision Gate", rows: { "2.1": { status: "הושלם", note: "x" } } } } });
  assert.deepEqual(r.errors, []);
  const ta = r.plans.find((p) => p.id === "TA"); assert.deepEqual([ta.progress, ta.blocker, ta.next], [58, "ממתינים לאישור", "לקיים Decision Gate"]);
  assert.equal(r.status.updated, "2026-12-01"); assert.deepEqual(r.status.plans.TA.rows["2.1"], { status: "הושלם", note: "x", updated: T("12-01") });
  assert.equal(r.changes.length, 5);
  assert.equal(JSON.stringify([plans, status]), snap, "הקלט לא שונה");
});
test("החלה: אותו עדכון פעמיים לא משנה כלום (אידמפוטנטי)", () => {
  const u = { date: "2026-12-01", plans: { TA: { progress: 58, rows: { "2.1": { status: "הושלם" } } } } };
  const a = run(u), b = run(u, a.status, a.plans);
  assert.equal(b.changes.length, 0); assert.deepEqual(b.status, a.status); assert.deepEqual(b.plans, a.plans);
});
test("החלה: null בשורה מוחק את העדכון, ותכנית בלי שורות לא נשארת ריקה", () => {
  const a = run({ date: "2026-12-01", plans: { TA: { rows: { "2.1": { status: "הושלם" } } } } });
  const b = run({ date: "2026-12-08", plans: { TA: { rows: { "2.1": null } } } }, a.status, a.plans);
  assert.deepEqual(b.errors, []); assert.deepEqual(b.status.plans, {}); assert.equal(b.status.updated, "2026-12-08");
});
test("החלה: סימון completed מעדכן אחוז וסטטוס, ו-completed:false מבטל", () => {
  const a = run({ date: "2026-12-01", plans: { BK: { completed: true } } });
  const bk = a.plans.find((p) => p.id === "BK"); assert.deepEqual([bk.completed, bk.progress, bk.status], [true, 100, "הושלם"]);
  const b = run({ date: "2026-12-08", plans: { BK: { completed: false, progress: 90, status: "בתהליך" } } }, a.status, a.plans);
  assert.equal(b.plans.find((p) => p.id === "BK").completed, undefined); assert.equal(b.plans.find((p) => p.id === "BK").progress, 90);
});
test("החלה: שגיאות ברורות ולא מוחלים חלקית (תכנית, שורה, ערכים, תאריך, שדה לא מוכר)", () => {
  const r = run({ date: "01/12/2026", plans: { XX: { progress: 5 }, TA: { progress: 130, status: "כמעט", qa: "?", owner: "מישהו", active: [2, 2, 9], lead: 8, completed: "כן", blocker: " ",
    rows: { "9.9": { status: "הושלם" }, "2.1": { status: "גמור", decision: "אולי", owner: "x", products: "a", bogus: 1, note: 3 } } } } });
  const e = r.errors.join("\n");
  for (const k of ["אינו בפורמט", "XX", "TA.progress", "TA.status", "TA.qa", "TA.owner", "TA.active", "TA.lead", "TA.completed", "TA.blocker", "9.9", "2.1.status", "2.1.decision", "2.1.owner", "products", "bogus", "note"]) assert.match(e, new RegExp(k.replace(".", "\\.")), k);
});
test("החלה: אזהרות על אחוז 100 בלי completed ועל תכנית שהושלמה שאינה 100", () => {
  assert.match(run({ date: "2026-12-01", plans: { BK: { progress: 100 } } }).warnings.join(), /בלי completed/);
  assert.match(run({ date: "2026-12-01", plans: { SW: { progress: 90 } } }).warnings.join(), /צריכה להיות 100/);
});

// ---------- הנתונים בריפו ----------
test("wbs-status.json בריפו: מבנה תקין, כל התכניות והשורות קיימות, והערכים חוקיים", () => {
  assert.match(status.updated, /^\d{4}-\d{2}-\d{2}$/); assert.equal(typeof status.plans, "object");
  const r = applyUpdate({ update: { date: status.updated, plans: Object.fromEntries(Object.entries(status.plans).map(([id, v]) => [id, { rows: Object.fromEntries(Object.entries(v.rows || {}).map(([k, x]) => { const { updated, ...rest } = x; return [k, rest]; })) }])) }, plans, status: { plans: {} }, template: tpl, today: status.updated });
  assert.deepEqual(r.errors, []);
});
