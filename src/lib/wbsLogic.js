export const STAGES = ["התנעה", "מצב קיים", "ניתוח", "הצעות", "תוצרים", "הטמעה", "תחזוקה"];
export const OWNERS = ["מנהלת הפרויקט", "רפרנט מקצועי", "יועץ מקצועי"];
export const REQUIREMENTS = ["חובה", "לפי צורך", "מותנה", "אבן דרך"];
export const DECISIONS = ["נדרש", "לא נדרש", "טרם הוחלט", "הוחרג בתכולה המקורית"];
export const STATUSES = ["הושלם", "בתהליך", "טרם התחיל", "ממתין", "מעוכב"];
export const EXCLUDED = ["לא נדרש", "הוחרג בתכולה המקורית"];
export const optionsWith = (list, value) => (value && !list.includes(value) ? [...list, value] : list);
export const isMilestone = (row) => String(row.requirement).startsWith("אבן דרך");
export const isCompleted = (plan, versionB = false) => !!plan.completed && !versionB;
export function stageState(plan, s, versionB = false) {
  if (isCompleted(plan, versionB)) return "done";
  if (s < plan.lead && !plan.active.includes(s)) return "done";
  if (plan.active.includes(s)) return "partial";
  if (s === plan.lead) return "lead";
  return "future";
}
export function taskStatus(plan, row, versionB = false) {
  if (isCompleted(plan, versionB)) return "הושלם";
  // גרסה ב' פותחת מחדש את שלבים 0–4 בלבד. בתכנית שהושלמה, שלבי ההטמעה והתחזוקה (5–6) נשארים הושלמו.
  if (versionB && plan.completed) return row.stage <= 4 ? "טרם התחיל" : "הושלם";
  if (versionB && row.stage <= 4) return "טרם התחיל";
  if (row.stage < plan.lead && !plan.active.includes(row.stage)) return "הושלם";
  if (plan.active.includes(row.stage)) return "בתהליך";
  return "טרם התחיל";
}
export function defaultDecision(row, versionB = false, plan = null) {
  if (row.postScope && plan && isCompleted(plan, versionB)) return "הוחרג בתכולה המקורית";
  if (versionB && row.stage <= 4 && !isMilestone(row)) return "טרם הוחלט";
  if (isMilestone(row)) return "נדרש";
  if (String(row.requirement).startsWith("חובה") && row.requirement !== "חובה/לפי צורך") return "נדרש";
  return "טרם הוחלט";
}
export function resolveRow(plan, row, over = {}, versionB = false) {
  const decision = over.decision ?? defaultDecision(row, versionB, plan);
  const excluded = EXCLUDED.includes(decision);
  const status = excluded ? decision : over.status ?? taskStatus(plan, row, versionB);
  return { ...row, requirement: over.requirement ?? row.requirement, owner: over.owner ?? row.owner, decision, excluded, status, products: over.products ?? row.products ?? [] };
}
export function resolveRows(plan, template, overrides = {}, versionB = false) {
  return template.map((r) => resolveRow(plan, r, overrides[r.id] || {}, versionB));
}
export function summarize(rows) {
  const counted = rows.filter((r) => !r.excluded);
  const done = counted.filter((r) => r.status === "הושלם").length;
  return { total: rows.length, counted: counted.length, done, open: counted.length - done, excluded: rows.length - counted.length, pct: counted.length ? Math.round((done / counted.length) * 100) : 0 };
}
export function effectivePct(plan, template, st = {}) {
  const vb = !!st.versionB;
  if (isCompleted(plan, vb)) return 100;
  if (vb) return summarize(resolveRows(plan, template, st.rows || {}, true)).pct;
  return plan.progress;
}
