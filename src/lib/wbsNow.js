// "מה קורה עכשיו בתכנית": לוגיקה טהורה (ללא React) מעל ה-WBS. נבדקת ב-tests/wbs-now.test.mjs.
//  - תלויות: פירוק עמודת ה-Predecessor (כולל טווחים כמו "2.5–2.10") לגרף תלויות
//  - מצב כל משימה: הושלם / בעבודה / מוכנה להתחלה / ממתינה לקודמת / מעוכבת / ממתינה / לא נספרת
//  - השלבים הנוכחיים, סיכומים לכל שלב, רשימות "בעבודה / מוכנות / להחלטה / תקועות"
//  - אמינות: כמה מהסטטוסים עודכנו ידנית, ומתי עודכן לאחרונה
//  - לוח זמנים: חלון השלב בגאנט (תכנון ראשוני) והמחזור הבא של תחזוקה
import { isCompleted, resolveRows } from "./wbsLogic.js";
import { stageRows } from "./ganttLogic.js";

export const STATE_META = {
  done: { label: "הושלם", icon: "✓" },
  active: { label: "בעבודה", icon: "●" },
  ready: { label: "מוכנה להתחלה", icon: "▶" },
  queued: { label: "ממתינה לקודמת", icon: "⏳" },
  blocked: { label: "מעוכבת", icon: "⚠" },
  waiting: { label: "ממתינה", icon: "⏸" },
  excluded: { label: "לא נספרת", icon: "⊘" },
};

export const FILTERS = [
  { key: "all", label: "הכול" },
  { key: "active", label: "בעבודה" },
  { key: "ready", label: "מוכנות להתחלה" },
  { key: "queued", label: "ממתינות לקודמת" },
  { key: "decide", label: "ממתינות להחלטה" },
  { key: "stuck", label: "מעוכבות או ממתינות" },
  { key: "done", label: "הושלמו" },
  { key: "excluded", label: "לא נספרות" },
];

// ---------- תלויות ----------
// "1.2–1.5" = כל השורות מ-1.2 עד 1.5 לפי סדר הטבלה. "2.4/נתונים" = שורה 2.4 והערה חופשית. "—" = אין.
export function parsePredecessors(text, order) {
  const idx = new Map(order.map((id, i) => [id, i]));
  const ids = [], notes = [];
  const add = (id) => { if (!ids.includes(id)) ids.push(id); };
  for (const part of String(text || "").split(",")) {
    for (let tok of part.split("/")) {
      tok = tok.trim();
      if (!tok || tok === "—" || tok === "-") continue;
      if (idx.has(tok)) { add(tok); continue; }
      const m = /^(.+?)[–—-](.+)$/.exec(tok);
      const a = m && m[1].trim(), b = m && m[2].trim();
      if (m && idx.has(a) && idx.has(b) && idx.get(a) <= idx.get(b)) { order.slice(idx.get(a), idx.get(b) + 1).forEach(add); continue; }
      notes.push(tok);
    }
  }
  return { ids, notes };
}

export function buildGraph(template) {
  const order = template.map((r) => r.id);
  const preds = new Map(), notes = new Map(), succs = new Map(order.map((id) => [id, []]));
  for (const r of template) {
    const p = parsePredecessors(r.predecessor, order);
    preds.set(r.id, p.ids.filter((i) => i !== r.id));
    notes.set(r.id, p.notes);
  }
  for (const [id, ps] of preds) for (const p of ps) succs.get(p).push(id);
  return { order, preds, succs, notes };
}

// ---------- מצב משימות ----------
export function classifyRows(rows, graph) {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const satisfied = (id) => { const p = byId.get(id); return !p || p.excluded || p.status === "הושלם"; };
  return rows.map((r) => {
    const unmet = (graph.preds.get(r.id) || []).filter((id) => !satisfied(id));
    let state;
    if (r.excluded) state = "excluded";
    else if (r.status === "הושלם") state = "done";
    else if (r.status === "בתהליך") state = "active";
    else if (r.status === "מעוכב") state = "blocked";
    else if (r.status === "ממתין") state = "waiting";
    else state = unmet.length ? "queued" : "ready";
    return { ...r, state, unmet };
  });
}

// שורות ה-WBS אחרי שילוב בחירות המשתמש. manual = הסטטוס או ההחלטה עודכנו ידנית (ולא חושבו משלב התכנית).
export function buildRows(plan, template, overrides = {}, versionB = false, graph = buildGraph(template)) {
  const rows = resolveRows(plan, template, overrides, versionB).map((r) => {
    const o = overrides[r.id] || {};
    return { ...r, note: o.note || "", updated: o.updated || null, hasOverride: Object.keys(o).length > 0, manual: o.status !== undefined || o.decision !== undefined };
  });
  return classifyRows(rows, graph);
}

// ---------- השלב הנוכחי ----------
export function currentStages(plan, versionB = false) {
  if (versionB) return [0, 1, 2, 3, 4];
  if (isCompleted(plan, false)) return [6];
  return [...new Set([...plan.active, plan.lead])].sort((a, b) => a - b);
}

export function stageSummary(rows, s) {
  const list = rows.filter((r) => r.stage === s), c = { total: list.length, counted: 0, done: 0, active: 0, ready: 0, queued: 0, blocked: 0, waiting: 0, excluded: 0 };
  for (const r of list) { c[r.state]++; if (!r.excluded) c.counted++; }
  c.stuck = c.blocked + c.waiting;
  c.undecided = list.filter((r) => !r.excluded && r.decision === "טרם הוחלט" && r.state !== "done").length;
  c.pct = c.counted ? Math.round((c.done / c.counted) * 100) : 0;
  return c;
}
export function stageDisplay(sum, isCurrent) {
  if (sum.counted > 0 && sum.done === sum.counted) return "done";
  if (isCurrent) return "current";
  return sum.active > 0 || sum.done > 0 ? "partial" : "future";
}

// ---------- רשימות ----------
export const needsDecision = (r, maxStage) => !r.excluded && r.decision === "טרם הוחלט" && r.state !== "done" && r.stage <= maxStage;
export function matchesFilter(r, key, maxStage) {
  switch (key) {
    case "active": return r.state === "active";
    case "ready": return r.state === "ready";
    case "queued": return r.state === "queued";
    case "decide": return needsDecision(r, maxStage);
    case "stuck": return r.state === "blocked" || r.state === "waiting";
    case "done": return r.state === "done";
    case "excluded": return r.state === "excluded";
    default: return true;
  }
}
export function countsFor(rows, maxStage) {
  const c = { all: rows.length };
  for (const f of FILTERS) if (f.key !== "all") c[f.key] = rows.filter((r) => matchesFilter(r, f.key, maxStage)).length;
  c.counted = rows.filter((r) => !r.excluded).length;
  return c;
}
// בעבודה / מוכנות: לפי שלב, ואז מי שכל קודמותיו הושלמו (unmet קטן) קודם, ואז סדר הטבלה.
// להחלטה / תקועות: לפי סדר הטבלה (שלב ומספר), כי הקשר בין משימות כאן אינו קובע סדר.
export function focusLists(rows, maxStage) {
  const order = new Map(rows.map((r, i) => [r.id, i]));
  const byTable = (a, b) => order.get(a.id) - order.get(b.id);
  const byReadiness = (a, b) => a.stage - b.stage || a.unmet.length - b.unmet.length || byTable(a, b);
  return {
    active: rows.filter((r) => r.state === "active").sort(byReadiness),
    ready: rows.filter((r) => r.state === "ready").sort(byReadiness),
    decide: rows.filter((r) => needsDecision(r, maxStage)).sort(byTable),
    stuck: rows.filter((r) => r.state === "blocked" || r.state === "waiting").sort(byTable),
  };
}

// ---------- אמינות הסטטוס ----------
// בשלבים הנוכחיים: כמה משימות עודכנו ידנית. בלי עדכון ידני הסטטוס מחושב משלב התכנית בלבד.
export function freshness(rows, current) {
  const inCur = rows.filter((r) => current.includes(r.stage) && !r.excluded);
  const stamps = rows.map((r) => r.updated).filter(Boolean).sort();
  return { total: inCur.length, confirmed: inCur.filter((r) => r.manual).length, last: stamps.length ? stamps[stamps.length - 1] : null };
}

// ---------- לוח זמנים (תכנון ראשוני בגאנט, לא מאומת) ----------
const monthsSince = (start, now) => (now.getFullYear() - start.year) * 12 + (now.getMonth() + 1 - start.month);
export function scheduleOf(plan, gantt, s, versionB = false, now = new Date()) {
  const row = stageRows(plan, gantt, versionB).find((r) => r.s === s);
  if (!row || !row.bars.length || s === 6) return null;
  const a = Math.min(...row.bars.map((b) => b.a)), b = Math.max(...row.bars.map((x) => x.b)), total = gantt.months.length;
  return { label: gantt.months[a] + " – " + gantt.months[Math.min(b, total) - 1], late: monthsSince(gantt.start, now) >= b };
}
export function nextMaintenance(plan, gantt, versionB = false, now = new Date()) {
  const row = stageRows(plan, gantt, versionB).find((r) => r.s === 6);
  if (!row || !row.bars.length) return null;
  const idx = monthsSince(gantt.start, now), bar = row.bars.find((b) => b.a >= idx);
  return bar ? { label: gantt.months[bar.a], now: bar.a === idx } : null;
}
