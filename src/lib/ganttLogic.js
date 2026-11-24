// לוגיקה טהורה של הגאנט: חלונות זמן לשלבים, מחזורי תחזוקה (לא פס רציף) ו"היום".
import { STAGES, isCompleted, stageState } from "./wbsLogic.js";

export function maintenanceCycles(seg, cycleMonths, total) {
  return cycleMonths.filter((m) => m >= seg.a && m < Math.min(seg.b, total)).map((m) => ({ a: m, b: m + 1 }));
}

// שורות הגאנט של תכנית: תמיד שורה לכל אחד משבעת השלבים (0–6), כך שרואים גם שלבים שהסתיימו וגם שלבים שטרם תוזמנו.
//  - שלב עם חלון זמן בנתונים: פס (או מחזורי תחזוקה בשלב 6)
//  - שלב שהסתיים ואין לו תאריכים בנתונים (או תכנית שהושלמה): "הושלם" ללא תאריך
//  - שלב עתידי ללא חלון: "טרם תוזמן"
export function stageRows(plan, gantt, versionB = false) {
  const done = isCompleted(plan, versionB);
  const total = gantt.months.length;
  const segs = Object.fromEntries((gantt.planGantt[plan.id] || []).map((g) => [g.s, g]));
  return STAGES.map((name, s) => {
    const seg = segs[s];
    if (s === 6 && seg) {
      const bars = maintenanceCycles(seg, gantt.cycleMonths, total).map((c) => ({ ...c, st: "maint", l: "מחזור" }));
      return { s, label: "תחזוקה (מחזורי)", bars, undated: false, st: "maint" };
    }
    if (seg && !done) return { s, label: seg.l, bars: [{ a: seg.a, b: seg.b, st: seg.st, l: seg.l, m: seg.m }], undated: false, st: seg.st };
    if (seg && done) return { s, label: seg.l, bars: [], undated: true, st: "done" };
    const state = versionB && s <= 4 ? "future" : stageState(plan, s, versionB);
    if (state === "done") return { s, label: name, bars: [], undated: true, st: "done" };
    return { s, label: name, bars: [], undated: false, st: "unscheduled" };
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
