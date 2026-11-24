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

  const update = useCallback(
    (id, field, value) => commit((s) => ({ ...s, rows: { ...s.rows, [id]: { ...(s.rows[id] || {}), [field]: value } } })),
    [commit]
  );
  const setVersionB = useCallback((v) => commit((s) => ({ ...s, versionB: v })), [commit]);
  const reset = useCallback(() => commit(() => EMPTY), [commit]);

  return { state, update, setVersionB, reset };
}
