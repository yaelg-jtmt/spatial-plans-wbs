import { useCallback, useEffect, useMemo, useState } from "react";
import { mergeOverrides, pendingLocal } from "./weeklyData.js";

const keyOf = (planId) => `spatial-hub:wbs:v2:${planId}`;
const EMPTY = { rows: {}, versionB: false };

// שימו לב: הבחירות המקומיות נשמרות ב-localStorage של הדפדפן, לכל תכנית בנפרד, ולא משותפות בין משתמשים.
// מה שמשותף הוא העדכון השבועי שמתפרסם בריפו (base). המקומי והשבועי ממוזגים לפי חותמת הזמן של כל שורה.
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

export function useWbsState(planId, baseRows = {}) {
  const [local, setLocal] = useState(EMPTY);
  useEffect(() => setLocal(readState(planId)), [planId]);

  const commit = useCallback(
    (fn) =>
      setLocal((prev) => {
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

  // state.rows = השורות הממוזגות (העדכון השבועי + המקומי). local = המקומי בלבד.
  const state = useMemo(() => ({ rows: mergeOverrides(baseRows, local.rows), versionB: local.versionB }), [baseRows, local]);
  const pending = useMemo(() => pendingLocal(baseRows, local.rows), [baseRows, local.rows]);
  return { state, local, pending, update, setMany, clearRow, setVersionB, reset };
}
