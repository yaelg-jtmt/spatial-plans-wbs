import { useState } from "react";
import { STAGES } from "../lib/wbsLogic.js";

const LIMIT = 5;
const PANELS = [
  { key: "active", title: "בעבודה עכשיו", empty: "אין משימות בעבודה. כשמתחילים משימה, היא מופיעה כאן.", actions: [{ label: "✓ הושלמה", patch: { status: "הושלם" } }] },
  { key: "ready", title: "מוכנות להתחלה", empty: "אין משימות שכל הקודמות שלהן הושלמו. כשמסיימים משימות, הבאות בתור מופיעות כאן.", actions: [{ label: "▶ התחלתי", patch: { status: "בתהליך" } }] },
  { key: "decide", title: "ממתינות להחלטה", empty: "אין החלטות פתוחות בשלבים עד השלב הנוכחי.", actions: [{ label: "נדרש", patch: { decision: "נדרש" } }, { label: "לא נדרש", patch: { decision: "לא נדרש" } }] },
  { key: "stuck", title: "מעוכבות או ממתינות", empty: "אין משימות מעוכבות.", actions: [{ label: "חזרה לעבודה", patch: { status: "בתהליך" } }] },
];

// ארבעה פאנלים. כל פריט פותח את השורה שלו בטבלה, ויש כפתורי עדכון מהיר.
export default function FocusPanels({ lists, onGoTo, onAction, workMode = false }) {
  const [all, setAll] = useState({});
  return (
    <div className="mb-4 grid items-start gap-3 md:grid-cols-2" role="group" aria-label="מה לעשות עכשיו">
      {PANELS.map((p) => {
        const items = lists[p.key], shown = all[p.key] ? items : items.slice(0, LIMIT);
        return (
          <section key={p.key} aria-label={p.title} className="rounded-2xl bg-white p-4 shadow-sm" data-testid={`panel-${p.key}`}>
            <h3 className="mb-2 flex items-center justify-between font-bold">
              <span>{p.title}</span>
              <span className="rounded-full bg-slate-100 px-2 text-sm" data-testid={`panel-${p.key}-count`}>{items.length}</span>
            </h3>
            {!items.length && <p className="text-sm text-slate-500">{p.empty}</p>}
            <ul className="space-y-2">
              {shown.map((r) => (
                <li key={r.id} className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2 last:border-0">
                  <button type="button" onClick={() => onGoTo(r.id)} className="text-start text-sm hover:underline" title="פתיחת השורה בטבלה">
                    <b>{r.id}</b> {r.task}
                    <span className="block text-xs text-slate-500">שלב {r.stage}: {STAGES[r.stage]} · {r.owner}{p.key === "active" && r.unmet.length ? ` · ממתינה לסיום ${r.unmet.slice(0, 2).join(", ")}${r.unmet.length > 2 ? "…" : ""}` : ""}</span>
                  </button>
                  <span className="flex shrink-0 gap-1">
                    {workMode && p.actions.map((a) => (
                      <button key={a.label} type="button" aria-label={`${a.label} ${r.id}`} onClick={() => onAction(r.id, a.patch)} className="rounded-lg border bg-white px-2 py-1 text-xs hover:bg-slate-50">{a.label}</button>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
            {items.length > LIMIT && (
              <button type="button" onClick={() => setAll((a) => ({ ...a, [p.key]: !a[p.key] }))} className="mt-2 text-sm text-blue-700 hover:underline">
                {all[p.key] ? "הצג פחות" : `הצג את כל ${items.length}`}
              </button>
            )}
          </section>
        );
      })}
    </div>
  );
}
