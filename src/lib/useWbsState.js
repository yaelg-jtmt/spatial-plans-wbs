import { useCallback, useEffect, useState } from "react";

const keyOf = (planId) => `spatial-hub:wbs:v2:${planId}`;
const EMPTY = { rows: {}, versionB: false };

// שימו לב: נשמר ב-localStorage של הדפדפן, לכל תכנית בנפרד. לא משותף בין משתמשים.
export function readState(planId) {
  try {
    if (typeof window === "undefined") return EMPTY;
    const s = JSON.parse(localStorage.getItem(keyOf(planId)) || "null");
    return s && typeof s === "object" ? { rows: s.rows || {}, versionB: !!s.versionB } : EMPTY;
  } catch {
    return EMPTY;
  }
}
export const readVersionB = (planId) => readState(planId).versionB;

export function useWbsState(planId) {
  const [state, setState] = useState(EMPTY);
  useEffect(() => setState(readState(planId)), [planId]);

  const commit = useCallback(
    (fn) =>
      setState((prev) => {
        const next = fn(prev);
        try { localStorage.setItem(keyOf(planId), JSON.stringify(next)); } catch {}
        return next;
      }),
    [planId]
  );

  // כל עדכון לשורה מתועד בחותמת זמן (updated), כדי שאפשר לדעת מתי היא עודכנה לאחרונה.
  const setMany = useCallback(
    (id, patch) => commit((s) => ({ ...s, rows: { ...s.rows, [id]: { ...(s.rows[id] || {}), ...patch, updated: new Date().toISOString() } } })),
    [commit]
  );
  const update = useCallback((id, field, value) => setMany(id, { [field]: value }), [setMany]);
  const clearRow = useCallback(
    (id) => commit((s) => { const rows = { ...s.rows }; delete rows[id]; return { ...s, rows }; }),
    [commit]
  );
  const setVersionB = useCallback((v) => commit((s) => ({ ...s, versionB: v })), [commit]);
  const reset = useCallback(() => commit(() => EMPTY), [commit]);

  return { state, update, setMany, clearRow, setVersionB, reset };
}
