import { useMemo, useState } from "react";
import Select from "../components/Select.jsx";
import ProductAssignment from "../components/ProductAssignment.jsx";
import PlanPicker from "../components/PlanPicker.jsx";
import StageFlow from "../components/StageFlow.jsx";
import { useWbsState } from "../lib/useWbsState.js";
import { stageRows, taskBar } from "../lib/ganttLogic.js";
import {
  DECISIONS, OWNERS, REQUIREMENTS, STAGES, STATUSES,
  effectivePct, isCompleted, optionsWith, resolveRows, summarize,
} from "../lib/wbsLogic.js";

const BAR = { done: "bg-emerald-500", active: "bg-amber-500", future: "bg-slate-400", maint: "bg-blue-600" };
const FILTERS = ["הכול", "רק פתוחות", "רק שהושלמו", "רק מוחרגות / לא נדרש"];
const keep = { "הכול": () => true, "רק פתוחות": (r) => !r.excluded && r.status !== "הושלם", "רק שהושלמו": (r) => r.status === "הושלם", "רק מוחרגות / לא נדרש": (r) => r.excluded };

function MiniGantt({ bars, total, color }) {
  return (
    <div className="grid h-6 items-center" style={{ gridTemplateColumns: `repeat(${total}, 1fr)` }}>
      {bars.map((b, i) => (
        <div key={i} className={`h-4 rounded ${color}`} style={{ gridColumn: `${b.a + 1} / span ${Math.max(1, b.b - b.a)}` }} />
      ))}
    </div>
  );
}

export default function Wbs({ plans, plan, setPlan, template, gantt, go }) {
  const current = plans.find((p) => p.id === plan);
  const { state, update, setVersionB, reset } = useWbsState(plan);
  const versionB = state.versionB;
  const [open, setOpen] = useState(() => Object.fromEntries(STAGES.map((_, i) => [i, true])));
  const [show, setShow] = useState("הכול");

  const rows = useMemo(() => resolveRows(current, template, state.rows, versionB), [current, template, state.rows, versionB]);
  const sum = summarize(rows);
  const seg = useMemo(() => Object.fromEntries(stageRows(current, gantt, versionB).map((r) => [r.s, r])), [current, gantt, versionB]);
  const completed = isCompleted(current, versionB);
  const total = gantt.months.length;
  const headers = ["WBS", "משימה", "חובה / לפי צורך", "החלטה", "סטטוס", "אחראי", "Predecessor", "תוצר", "Next Action", "משויך לתוצר", "גאנט"];

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">WBS אינטראקטיבי · כל 7 השלבים</h1>
          <p className="text-sm text-slate-500">כולל שלבים שהושלמו. הבחירות נשמרות לכל תכנית בנפרד, בדפדפן הנוכחי.</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <PlanPicker plans={plans} plan={plan} onChange={setPlan} />
          <button onClick={() => go("/gantt", plan)} className="rounded-xl border bg-white px-4 py-2 text-sm hover:bg-slate-50">גאנט התכנית</button>
          <button onClick={reset} className="rounded-xl border bg-white px-4 py-2 text-sm hover:bg-slate-50">איפוס בחירות לתכנית</button>
        </div>
      </div>

      <div className="mb-4 rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <b className="text-lg">{current.name}</b>
          {completed && <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700">✓ התכנית הושלמה · 100%</span>}
          {versionB && <span className="rounded-full bg-violet-100 px-3 py-1 text-sm font-semibold text-violet-700">גרסה ב׳ בעבודה</span>}
        </div>
        <StageFlow plan={current} versionB={versionB} />
        <div className="grid gap-3 text-sm md:grid-cols-4">
          <div><b>התקדמות:</b> {effectivePct(current, template, state)}%</div>
          <div><b>יעד:</b> {current.target}</div>
          <div><b>משימות:</b> {sum.done} מתוך {sum.counted} הושלמו</div>
          <div><b>לא נספרות (מוחרגות / לא נדרש):</b> {sum.excluded}</div>
        </div>
        <p className="mt-2 text-xs text-slate-500">סעיף שהוחרג או סומן &quot;לא נדרש&quot; אינו מוריד ואינו מוסיף לאחוז ההשלמה.</p>
      </div>

      <div className="mb-4 rounded-2xl border border-violet-200 bg-violet-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <b>גרסה ב׳ / עדכון מהותי</b>
            <p className="mt-1 text-sm">
              פותח מחדש את שלבים 0–4 לבחינה: כל רכיב עובר ל&quot;טרם הוחלט&quot;, ובכל שורה בוחרים נדרש / לא נדרש. לא כל המשימות נפתחות אוטומטית.
            </p>
          </div>
          <button
            onClick={() => setVersionB(!versionB)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold ${versionB ? "border bg-white text-violet-700" : "bg-violet-600 text-white"}`}
          >
            {versionB ? "סגירת גרסה ב׳" : "פתיחת גרסה ב׳"}
          </button>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2">הצג
          <select value={show} onChange={(e) => setShow(e.target.value)} className="rounded-lg border bg-white px-3 py-2">
            {FILTERS.map((f) => <option key={f}>{f}</option>)}
          </select>
        </label>
        <button onClick={() => setOpen(Object.fromEntries(STAGES.map((_, i) => [i, true])))} className="rounded-lg border bg-white px-3 py-2">פתח כל השלבים</button>
        <button onClick={() => setOpen(Object.fromEntries(STAGES.map((_, i) => [i, false])))} className="rounded-lg border bg-white px-3 py-2">סגור כל השלבים</button>
      </div>

      <div className="max-h-[70vh] overflow-auto rounded-2xl border bg-white">
        <table className="w-full min-w-[2000px] text-sm">
          <thead className="sticky top-0 z-30 bg-slate-100 shadow-sm">
            <tr>{headers.map((h) => <th className="border-b p-3 text-right" key={h}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {STAGES.map((name, s) => {
              const stageAll = rows.filter((r) => r.stage === s);
              const ss = summarize(stageAll);
              const list = stageAll.filter(keep[show]);
              const gs = seg[s];
              return [
                <tr key={`h${s}`} className="cursor-pointer bg-blue-50 font-semibold" onClick={() => setOpen((o) => ({ ...o, [s]: !o[s] }))}>
                  <td className="p-3" colSpan={headers.length}>
                    {open[s] ? "▾" : "◂"} שלב {s}: {name} · {ss.done}/{ss.counted} הושלמו{ss.excluded ? ` · ${ss.excluded} לא נספרות` : ""}
                  </td>
                </tr>,
                ...(open[s]
                  ? list.map((r) => {
                      const idx = stageAll.indexOf(r);
                      const bars = taskBar(r, idx, stageAll.length, gs);
                      return (
                        <tr key={r.id} className="border-b align-top hover:bg-slate-50">
                          <td className="p-3 font-bold">{r.id}</td>
                          <td className="p-3">{r.task}</td>
                          <td className="p-2"><Select className="min-w-[140px]" value={r.requirement} options={optionsWith(REQUIREMENTS, r.requirement)} onChange={(v) => update(r.id, "requirement", v)} /></td>
                          <td className="p-2"><Select className="min-w-[190px]" value={r.decision} options={DECISIONS} onChange={(v) => update(r.id, "decision", v)} /></td>
                          <td className="p-2">
                            {r.excluded ? (
                              <span className="inline-block min-w-[120px] rounded-full bg-slate-100 px-3 py-2 text-xs text-slate-600">{r.status}</span>
                            ) : (
                              <Select className="min-w-[120px]" value={r.status} options={STATUSES} onChange={(v) => update(r.id, "status", v)} />
                            )}
                          </td>
                          <td className="p-2"><Select className="min-w-[160px]" value={r.owner} options={OWNERS} onChange={(v) => update(r.id, "owner", v)} /></td>
                          <td className="p-3">{r.predecessor}</td>
                          <td className="p-3">{r.deliverable}</td>
                          <td className="p-3">{r.next}</td>
                          <td className="p-2"><ProductAssignment values={r.products} onChange={(v) => update(r.id, "products", v)} /></td>
                          <td className="min-w-[320px] p-2">
                            {bars ? (
                              <MiniGantt bars={bars} total={total} color={r.status === "הושלם" ? BAR.done : r.status === "בתהליך" ? BAR.active : s === 6 ? BAR.maint : BAR.future} />
                            ) : (
                              <span className="text-xs text-slate-400">{gs?.undated ? "הושלם (ללא תאריך)" : "—"}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  : []),
              ];
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-500">תאריכי הגאנט הם תכנון עבודה ראשוני (חלון זמן לכל שלב), עד לאימות תאריכים מדויקים.</p>
    </>
  );
}
