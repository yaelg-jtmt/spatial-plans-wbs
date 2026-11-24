// לוגיקה טהורה של הגאנט: חלונות זמן לשלבים, מחזורי תחזוקה (לא פס רציף) ו"היום".
import { isCompleted } from "./wbsLogic.js";

export function maintenanceCycles(seg, cycleMonths, total) {
  return cycleMonths.filter((m) => m >= seg.a && m < Math.min(seg.b, total)).map((m) => ({ a: m, b: m + 1 }));
}

// שורות הגאנט של תכנית: לכל שלב שורה אחת. תכנית שהושלמה: שלבים בלי תאריכים (הושלם), ורק מחזורי תחזוקה מתוארכים.
export function stageRows(plan, gantt, versionB = false) {
  const done = isCompleted(plan, versionB);
  const total = gantt.months.length;
  return (gantt.planGantt[plan.id] || []).map((seg) => {
    if (seg.s === 6) {
      const bars = maintenanceCycles(seg, gantt.cycleMonths, total).map((c) => ({ ...c, st: "maint", l: "מחזור" }));
      return { s: 6, label: "תחזוקה (מחזורי)", bars, undated: false, st: "maint" };
    }
    if (done) return { s: seg.s, label: seg.l, bars: [], undated: true, st: "done" };
    return { s: seg.s, label: seg.l, bars: [{ a: seg.a, b: seg.b, st: seg.st, l: seg.l, m: seg.m }], undated: false, st: seg.st };
  });
}

// פס של משימה בתוך חלון השלב שלה (פריסה רציפה לפי סדר המשימות)
export function taskBar(row, index, count, seg) {
  if (!seg || !seg.bars.length) return null;
  if (row.stage === 6) return seg.bars;
  const { a, b } = seg.bars[0];
  const len = b - a;
  const start = a + Math.floor((index * len) / count);
  const span = Math.max(1, Math.ceil(len / count));
  return [{ a: start, b: Math.min(b, start + span) }];
}

// מיקום "היום" כשבר של ציר הזמן (0..months) או null אם מחוץ לטווח
export function todayOffset(start, total, now = new Date()) {
  const months = (now.getFullYear() - start.year) * 12 + (now.getMonth() + 1 - start.month);
  const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const x = months + (now.getDate() - 1) / dim;
  return x >= 0 && x <= total ? x : null;
}

export function planSpan(rows) {
  const bars = rows.filter((r) => r.s !== 6).flatMap((r) => r.bars);
  if (!bars.length) return null;
  return { a: Math.min(...bars.map((b) => b.a)), b: Math.max(...bars.map((b) => b.b)) };
}
