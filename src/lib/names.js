// נרמול שמות תכניות: מסיר רווחים, גרשיים ומקפים מכל סוג, כך ש"צור באהר–אום טובא"
// ו"צור באהר - אום טובא" ייחשבו זהים. אותה לוגיקה קיימת ב-public/dashboard/bridge.js.
export const normName = (s) => String(s || "").replace(/["'׳״`\s\-–—_]/g, "");

// שם התכנית באתר + כינויים (aliases) שבהם היא מופיעה בדאשבורד, למשל "צור באהר" במקום "צור באהר–אום טובא".
export const planNames = (p) => [p.name, ...(p.aliases || [])];

export function findPlanByName(plans, name) {
  const n = normName(name);
  if (!n) return null;
  const exact = plans.find((p) => planNames(p).some((x) => normName(x) === n));
  if (exact) return exact;
  if (n.length < 4) return null;
  return (
    plans.find((p) =>
      planNames(p).some((x) => {
        const pn = normName(x);
        return pn.length >= 4 && (pn.includes(n) || n.includes(pn));
      })
    ) || null
  );
}
