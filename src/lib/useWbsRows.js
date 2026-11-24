import { useCallback, useEffect, useMemo, useState } from "react";

// ההחלטות נשמרות לכל תכנית בנפרד ב-localStorage של הדפדפן.
// שימו לב: זה לא משותף בין משתמשים. לשיתוף אמיתי נדרש שרת/SharePoint List.
export function useWbsRows(planId, template) {
  const key = `spatial-hub:wbs:v1:${planId}`;
  const [overrides, setOverrides] = useState({});

  useEffect(() => {
    try {
      setOverrides(JSON.parse(localStorage.getItem(key) || "{}"));
    } catch {
      setOverrides({});
    }
  }, [key]);

  const rows = useMemo(
    () => template.map((r) => ({ ...r, ...(overrides[r.id] || {}) })),
    [template, overrides]
  );

  const update = useCallback(
    (id, field, value) =>
      setOverrides((o) => {
        const next = { ...o, [id]: { ...(o[id] || {}), [field]: value } };
        localStorage.setItem(key, JSON.stringify(next));
        return next;
      }),
    [key]
  );

  const reset = useCallback(() => {
    localStorage.removeItem(key);
    setOverrides({});
  }, [key]);

  return { rows, update, reset };
}
