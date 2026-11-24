// שכבת העדכון השבועי (נתונים שמתפרסמים בריפו) מעל הבחירות המקומיות בדפדפן. לוגיקה טהורה, נבדקת ב-tests/weekly.test.mjs.
//  - public/data/wbs-status.json: { updated: "YYYY-MM-DD", plans: { <planId>: { rows: { <id>: {status, decision, owner, requirement, note, products, updated} } } } }
//  - מיזוג לפי שורה: העדכון עם חותמת הזמן המאוחרת יותר קובע (שדה-שדה). בלי חותמת, המקומי גובר.
export const STALE_DAYS = 10;

const ts = (iso) => { const t = Date.parse(iso || ""); return Number.isNaN(t) ? 0 : t; };

// base = מהריפו, local = מהדפדפן. מחזיר שורה אחת ממוזגת, או undefined אם אין אף אחת.
export function mergeRow(base, local) {
  if (!base && !local) return undefined;
  if (!base) return local;
  if (!local) return base;
  // המקומי גובר אלא אם העדכון השבועי חדש ממנו
  return ts(base.updated) > ts(local.updated) ? { ...local, ...base } : { ...base, ...local };
}

export function mergeOverrides(baseRows = {}, localRows = {}) {
  const out = {};
  for (const id of new Set([...Object.keys(baseRows), ...Object.keys(localRows)])) out[id] = mergeRow(baseRows[id], localRows[id]);
  return out;
}

// כמה שורות מקומיות עדיין "מנצחות" את העדכון השבועי (כלומר טרם נכנסו לריפו)
export function pendingLocal(baseRows = {}, localRows = {}) {
  return Object.keys(localRows).filter((id) => {
    const l = localRows[id], b = baseRows[id];
    if (!l || !Object.keys(l).some((k) => k !== "updated")) return false;
    if (!b) return true;
    if (ts(b.updated) > ts(l.updated)) return false;
    return Object.keys(l).some((k) => k !== "updated" && JSON.stringify(l[k]) !== JSON.stringify(b[k]));
  });
}

export function daysSince(dateStr, now = new Date()) {
  const t = Date.parse(dateStr || ""); if (Number.isNaN(t)) return null;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const d = new Date(t); const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((start - day) / 86400000);
}

export function staleness(dateStr, now = new Date()) {
  const days = daysSince(dateStr, now);
  return { days, stale: days === null || days > STALE_DAYS };
}

// הקובץ שמיוצא מהאתר: רק מה שהשתנה מקומית, לכל תכנית שיש בה שינוי. אותו מבנה כמו קובץ העדכון השבועי.
export function buildExport(planIds, readLocal, now = new Date()) {
  const plans = {};
  for (const id of planIds) {
    const s = readLocal(id), rows = s && s.rows ? s.rows : {};
    const clean = Object.fromEntries(Object.entries(rows).filter(([, r]) => r && Object.keys(r).some((k) => k !== "updated")));
    if (Object.keys(clean).length || (s && s.versionB)) plans[id] = { ...(Object.keys(clean).length ? { rows: clean } : {}), ...(s && s.versionB ? { versionB: true } : {}) };
  }
  return { exported: now.toISOString(), source: "spatial-plans-hub", plans };
}
