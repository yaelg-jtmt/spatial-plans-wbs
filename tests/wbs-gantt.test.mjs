// npm run test:sync — בדיקות ל-WBS המלא (0–6), לגרסה ב', להחרגות ולגאנט.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DECISIONS, EXCLUDED, OWNERS, REQUIREMENTS, STAGES, STATUSES,
  effectivePct, isCompleted, optionsWith, resolveRows, stageState, summarize,
} from "../src/lib/wbsLogic.js";
import { maintenanceCycles, planSpan, stageRows, taskBar, todayOffset } from "../src/lib/ganttLogic.js";

const read = (f) => JSON.parse(readFileSync(new URL(`../public/data/${f}`, import.meta.url), "utf8"));
const plans = read("plans.json");
const tpl = read("wbs-template.json");
const gantt = read("gantt.json");
const P = Object.fromEntries(plans.map((p) => [p.id, p]));
const COMPLETED = ["AH", "SW", "OR", "GI"];

// ---------- WBS: כיסוי מלא ----------
test("WBS: כל שבעת השלבים 0–6 קיימים וכל שלב מסתיים באבן דרך", () => {
  for (let s = 0; s < 7; s++) {
    const rows = tpl.filter((r) => r.stage === s);
    assert.ok(rows.length >= 6, `שלב ${s}: ${rows.length} שורות`);
    assert.ok(rows.some((r) => r.id.startsWith("M")), `שלב ${s} בלי אבן דרך`);
  }
  assert.equal(STAGES.length, 7);
});
test("WBS: מזהים ייחודיים, ושדות חובה מלאים", () => {
  const ids = tpl.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const r of tpl) for (const f of ["id", "stage", "task", "requirement", "owner", "predecessor", "deliverable", "next"]) assert.ok(r[f] !== undefined && r[f] !== "", `${r.id}.${f}`);
});
test("WBS: Predecessor פשוט מפנה לשורה קיימת", () => {
  const ids = new Set(tpl.map((r) => r.id));
  for (const r of tpl) for (const t of r.predecessor.split(",")) {
    if (/^M?\d+(\.\d+)?[A-Z]?$/.test(t.trim())) assert.ok(ids.has(t.trim()), `${r.id} -> ${t}`);
  }
});
test("WBS: האחראים הם שלושת התפקידים בלבד", () => {
  for (const r of tpl) assert.ok(OWNERS.includes(r.owner), `${r.id}: ${r.owner}`);
});
test("WBS: ערכי requirement שאינם ברשימה לא נעלמים מהתפריט", () => {
  for (const r of tpl) assert.ok(optionsWith(REQUIREMENTS, r.requirement).includes(r.requirement));
  assert.ok(optionsWith(REQUIREMENTS, "חובה*").includes("חובה*"));
  assert.equal(optionsWith(REQUIREMENTS, "חובה").length, REQUIREMENTS.length);
});

// ---------- שלב 2: החלטת מתודולוגיה לשלב ההצעות (חדש) ----------
test("שלב 2: החלטה על מתודולוגיית העבודה בשלב ההצעות (2.12) בסוף שלב הניתוח, לפני אבן הדרך", () => {
  const s2 = tpl.filter((r) => r.stage === 2).map((r) => r.id);
  assert.equal(s2.at(-1), "M2.8");
  assert.equal(s2.at(-2), "2.12");
  assert.ok(s2.indexOf("2.11") < s2.indexOf("2.12"));
  const g = tpl.find((r) => r.id === "2.12");
  assert.match(g.task, /מתודולוגיית העבודה בשלב ההצעות/);
  assert.match(g.task, /מחולקת למרחבים/);
  assert.equal(g.requirement, "מותנה");
  assert.ok(g.predecessor.split(",").includes("2.11"));
  assert.ok(tpl.find((r) => r.id === "M2.8").predecessor.split(",").includes("2.12"));
  assert.equal(tpl.find((r) => r.id === "3.1").predecessor, "M2.8");
});
test("2.12: בתכנית שהושלמה היא מוחרגת (לא מורידה מ-100%), ובתכנית פעילה 'טרם הוחלט'", () => {
  for (const id of COMPLETED) {
    const r = resolveRows(P[id], tpl).find((x) => x.id === "2.12");
    assert.equal(r.decision, "הוחרג בתכולה המקורית", id);
    assert.equal(r.excluded, true);
    assert.equal(summarize(resolveRows(P[id], tpl)).pct, 100);
  }
  for (const id of ["BK", "PN", "TA", "GZ", "FI", "ZB"]) {
    const r = resolveRows(P[id], tpl).find((x) => x.id === "2.12");
    assert.equal(r.decision, "טרם הוחלט", id);
    assert.equal(r.excluded, false);
  }
});
test("2.12: אפשר לשנות את ההחלטה בכל תכנית, והחרגה/'לא נדרש' אינה נספרת", () => {
  const base = summarize(resolveRows(P.PN, tpl));
  const no = resolveRows(P.PN, tpl, { "2.12": { decision: "לא נדרש" } });
  assert.equal(no.find((r) => r.id === "2.12").excluded, true);
  assert.equal(summarize(no).counted, base.counted - 1);
  const yes = resolveRows(P.PN, tpl, { "2.12": { decision: "נדרש" } });
  assert.equal(yes.find((r) => r.id === "2.12").excluded, false);
  assert.equal(summarize(resolveRows(P.AH, tpl, { "2.12": { decision: "נדרש" } })).counted, tpl.length);
});
test("2.12: בגרסה ב' היא נפתחת להחלטה גם בתכנית שהושלמה", () => {
  const r = resolveRows(P.GI, tpl, {}, true).find((x) => x.id === "2.12");
  assert.equal(r.decision, "טרם הוחלט");
  assert.equal(r.excluded, false);
  assert.equal(r.status, "טרם התחיל");
});

// ---------- הערות גורי ----------
test("גורי 5: שלב 5 כולל את מסלולי ההטמעה שצוינו", () => {
  const t = tpl.filter((r) => r.stage === 5).map((r) => r.task).join(" | ");
  for (const k of ["דאשבורד", "פרויקטור עירייה", "תח״צ", "מסופים", "נת״צים", "תכנית אב לרכיבה", "גישור טופוגרפי", "חוות דעת מסכם לתב״עות"]) assert.ok(t.includes(k), k);
});
test("גורי 5: שלב 6 כולל עדכון סטטוס, רענון תוצרים, חוות דעת ו'גרסה ב'", () => {
  const t = tpl.filter((r) => r.stage === 6).map((r) => r.task).join(" | ");
  for (const k of ["עדכון סטטוס פרויקטים", "רענון התוצרים", "חוות דעת לתכניות במרחב", "גרסה ב"]) assert.ok(t.includes(k), k);
});
test("גורי 6: לכל שורה 'משויך לתוצר' (מערך), ללא שיוך כברירת מחדל", () => {
  for (const r of tpl) assert.deepEqual(r.products, []);
});

// ---------- השלמה והחרגות (גורי 2,3) ----------
test("ארבע התכניות שגורי ציין מסומנות כהושלמו ב-100%", () => {
  for (const id of COMPLETED) {
    assert.equal(P[id].completed, true);
    assert.equal(effectivePct(P[id], tpl), 100);
  }
  for (const id of ["BK", "RA", "TH", "ZB", "PN", "TA", "GZ", "FI"]) assert.ok(!P[id].completed);
});
test("תכנית שהושלמה: כל הסעיפים הנספרים 'הושלם', ורק 2.12 מוחרגת", () => {
  for (const id of COMPLETED) {
    const rows = resolveRows(P[id], tpl);
    assert.ok(rows.filter((r) => !r.excluded).every((r) => r.status === "הושלם"), id);
    assert.deepEqual(rows.filter((r) => r.excluded).map((r) => r.id), ["2.12"]);
    assert.equal(summarize(rows).pct, 100);
    for (let s = 0; s < 7; s++) assert.equal(stageState(P[id], s), "done");
  }
});
test("החרגה לא מורידה מ-100%: סעיפים מוחרגים / 'לא נדרש' אינם נספרים", () => {
  const over = { "2.8": { decision: "הוחרג בתכולה המקורית" }, "3.9": { decision: "לא נדרש" }, "5.3": { decision: "לא נדרש", status: "טרם התחיל" } };
  const rows = resolveRows(P.AH, tpl, over);
  const s = summarize(rows);
  assert.equal(s.pct, 100);
  assert.equal(s.excluded, 4); // שלוש ההחרגות + 2.12
  assert.equal(s.counted, tpl.length - 4);
  assert.ok(rows.find((r) => r.id === "2.8").excluded);
  assert.equal(rows.find((r) => r.id === "5.3").status, "לא נדרש");
});
test("תכנית פעילה: סעיף שלא הושלם מוריד, וסימון 'לא נדרש' מעלה את האחוז", () => {
  const base = summarize(resolveRows(P.BK, tpl));
  assert.ok(base.pct > 0 && base.pct < 100);
  const open = resolveRows(P.BK, tpl).filter((r) => !r.excluded && r.status !== "הושלם");
  const over = Object.fromEntries(open.slice(0, 3).map((r) => [r.id, { decision: "לא נדרש" }]));
  const after = summarize(resolveRows(P.BK, tpl, over));
  assert.ok(after.pct > base.pct);
});
test("סטטוס ברירת מחדל נגזר משלבי התכנית (כמו במקור)", () => {
  const fi = resolveRows(P.FI, tpl);
  const st = (id) => fi.find((r) => r.id === id).status;
  assert.equal(st("0.1"), "הושלם");
  assert.equal(st("1.1"), "בתהליך");
  assert.equal(st("3.2"), "טרם התחיל");
});

// ---------- גרסה ב' ----------
test("גרסה ב': שלבים 0–4 חוזרים ל'טרם הוחלט' / 'טרם התחיל', ושלבים 5–6 לא", () => {
  const rows = resolveRows(P.SW, tpl, {}, true);
  for (const r of rows.filter((r) => r.stage <= 4 && !r.id.startsWith("M"))) {
    assert.equal(r.decision, "טרם הוחלט", r.id);
    assert.equal(r.status, "טרם התחיל", r.id);
  }
  assert.equal(isCompleted(P.SW, true), false);
  const pct = effectivePct(P.SW, tpl, { versionB: true, rows: {} });
  assert.ok(pct < 100, `אחוז בגרסה ב': ${pct}`);
  assert.equal(pct, summarize(rows).pct);
  assert.equal(effectivePct(P.BK, tpl, {}), P.BK.progress);
});
test("גרסה ב': לא נפתחות אוטומטית כל המשימות - 'לא נדרש' מוציא רכיב מהספירה", () => {
  const all = summarize(resolveRows(P.SW, tpl, {}, true));
  const over = Object.fromEntries(tpl.filter((r) => r.stage === 2).map((r) => [r.id, { decision: "לא נדרש" }]));
  const some = summarize(resolveRows(P.SW, tpl, over, true));
  assert.ok(some.counted < all.counted);
  assert.equal(some.excluded, tpl.filter((r) => r.stage === 2).length);
});
test("ערכי הבחירה: כל ההחלטות והסטטוסים מוגדרים, וההחרגות תואמות", () => {
  assert.deepEqual(DECISIONS, ["נדרש", "לא נדרש", "טרם הוחלט", "הוחרג בתכולה המקורית"]);
  assert.ok(EXCLUDED.every((d) => DECISIONS.includes(d)));
  assert.ok(STATUSES.includes("הושלם"));
});

// ---------- גאנט ----------
test("גאנט: 14 חודשים, חלונות תקינים, ולכל תכנית יש גאנט", () => {
  assert.equal(gantt.months.length, 14);
  for (const p of plans) assert.ok(gantt.planGantt[p.id]?.length, p.id);
  for (const [id, segs] of Object.entries(gantt.planGantt)) {
    assert.ok(P[id], id);
    for (const g of segs) { assert.ok(g.a >= 0 && g.b <= 14 && g.a < g.b, `${id} ${g.l}`); assert.ok(g.s >= 0 && g.s <= 6); }
  }
});
test("גאנט: תחזוקה היא מחזור שנתי אחד", () => {
  for (const p of plans) {
    const rows = stageRows(p, gantt);
    const m = rows.find((r) => r.s === 6);
    if (!m || !m.bars.length) continue;
    assert.ok(m.bars.every((b) => b.b - b.a === 1), `${p.id}: מחזור = חודש אחד`);
    assert.ok(m.bars.every((b) => gantt.cycleMonths.includes(b.a)));
    const months = m.bars.map((b) => b.a);
    for (let i = 1; i < months.length; i++) assert.ok(months[i] - months[i - 1] > 1, `${p.id}: מחזורים רציפים`);
    assert.ok(months.length <= 4);
  }
  const sw = stageRows(P.SW, gantt).find((r) => r.s === 6);
  assert.deepEqual(sw.bars.map((b) => b.a), [2]);
  assert.deepEqual(maintenanceCycles({ a: 0, b: 14 }, [2], 14), [{ a: 2, b: 3 }]);
});
test("גאנט: תכנית שהושלמה - שלבים 'הושלם' ללא תאריכים, ורק מחזורי תחזוקה מתוארכים", () => {
  for (const id of COMPLETED) {
    for (const r of stageRows(P[id], gantt)) {
      if (r.s === 6) assert.ok(r.bars.length > 0);
      else { assert.equal(r.undated, true); assert.equal(r.bars.length, 0); assert.equal(r.st, "done"); }
    }
  }
});
test("גאנט: פתיחת גרסה ב' מחזירה לתכנית שהושלמה חלונות זמן פעילים", () => {
  const rows = stageRows(P.SW, gantt, true);
  assert.ok(rows.some((r) => r.s === 3 && r.bars.length === 1 && !r.undated));
});
test("גאנט: לכל תכנית תמיד 7 שורות שלבים (0–6), כולל שלבים שהסתיימו ושטרם תוזמנו", () => {
  for (const p of plans) for (const vb of [false, true]) {
    assert.deepEqual(stageRows(p, gantt, vb).map((r) => r.s), [0, 1, 2, 3, 4, 5, 6], `${p.id} vb=${vb}`);
  }
});
test("גאנט: שלבים שקדמו לשלב הנוכחי 'הושלם', ושלבים עתידיים ללא חלון - 'טרם תוזמן'", () => {
  const ta = stageRows(P.TA, gantt);
  for (const s of [0, 1]) { assert.equal(ta[s].st, "done"); assert.equal(ta[s].undated, true); assert.equal(ta[s].bars.length, 0); }
  const fi = stageRows(P.FI, gantt);
  assert.equal(fi[0].st, "done");
  assert.equal(fi[3].st, "future");
  assert.equal(fi[6].st, "unscheduled");
  assert.ok(fi[1].bars.length === 1 && fi[2].bars.length === 1);
  const zb = stageRows(P.ZB, gantt);
  assert.equal(zb[0].st, "done"); assert.equal(zb[2].st, "done");
  assert.equal(stageRows(P.SW, gantt, true)[1].st, "unscheduled");
});
test("גאנט: תכנית פעילה מציגה חלון לכל שלב מתוזמן, ועם 'span' כולל", () => {
  const rows = stageRows(P.ZB, gantt);
  assert.deepEqual(rows.filter((r) => r.bars.length).map((r) => r.s), [3, 4, 5]);
  assert.ok(planSpan(rows).a === 0 && planSpan(rows).b === 8);
  assert.equal(rows[3].bars[0].m, 1);
});
test("גאנט: פס משימה נשאר בתוך חלון השלב שלו (כולל שלב 2 עם 2.12)", () => {
  for (const id of ["TA", "PN", "GZ", "FI"]) {
    const rows = stageRows(P[id], gantt);
    for (const seg of rows.filter((r) => r.s !== 6 && r.bars.length)) {
      const stageTasks = tpl.filter((r) => r.stage === seg.s);
      stageTasks.forEach((t, i) => {
        const [b] = taskBar(t, i, stageTasks.length, seg);
        assert.ok(b.a >= seg.bars[0].a && b.b <= seg.bars[0].b && b.b > b.a, `${id} ${t.id}`);
      });
    }
    for (const seg of rows.filter((r) => !r.bars.length)) assert.equal(taskBar(tpl.find((t) => t.stage === seg.s), 0, 5, seg), null);
  }
  assert.equal(taskBar(tpl[0], 0, 6, { bars: [], undated: true }), null);
  assert.equal(taskBar(tpl[0], 0, 6, undefined), null);
});
test("גאנט: מיקום 'היום'", () => {
  const x = todayOffset(gantt.start, 14, new Date(2026, 10, 24));
  assert.ok(x > 0.7 && x < 0.85, String(x));
  assert.equal(todayOffset(gantt.start, 14, new Date(2025, 0, 1)), null);
  assert.equal(todayOffset(gantt.start, 14, new Date(2029, 0, 1)), null);
  assert.equal(todayOffset(gantt.start, 14, new Date(2027, 0, 1)), 2);
});
