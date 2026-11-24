import { Fragment, useEffect, useMemo, useState } from "react";
import PlanPicker from "../components/PlanPicker.jsx";
import NowSummary from "../components/NowSummary.jsx";
import FocusPanels from "../components/FocusPanels.jsx";
import TaskRow from "../components/TaskRow.jsx";
import { useWbsState } from "../lib/useWbsState.js";
import { stageRows, taskBar } from "../lib/ganttLogic.js";
import { OWNERS, STAGES, effectivePct, isCompleted } from "../lib/wbsLogic.js";
import { FILTERS, buildGraph, buildRows, countsFor, currentStages, focusLists, freshness, matchesFilter, nextMaintenance, scheduleOf, stageSummary } from "../lib/wbsNow.js";

const HEADERS = ["WBS", "משימה", "סטטוס", "החלטה", "אחראי", "הפעולה הבאה"];

export default function Wbs({ plans, plan, setPlan, template, gantt, go }) {
  const current = plans.find((p) => p.id === plan);
  const { state, setMany, clearRow, setVersionB, reset } = useWbsState(plan);
  const versionB = state.versionB;

  const [filter, setFilter] = useState("all");
  const [owner, setOwner] = useState("all");
  const [q, setQ] = useState("");
  const [stageFocus, setStageFocus] = useState(null);
  const [openStages, setOpenStages] = useState({});
  const [openRows, setOpenRows] = useState({});
  const [flash, setFlash] = useState(null);
  useEffect(() => { setFilter("all"); setOwner("all"); setQ(""); setStageFocus(null); setOpenStages({}); setOpenRows({}); }, [plan, versionB]);

  const now = useMemo(() => new Date(), []);
  const graph = useMemo(() => buildGraph(template), [template]);
  const rows = useMemo(() => buildRows(current, template, state.rows, versionB, graph), [current, template, state.rows, versionB, graph]);
  const rowsById = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  const cur = useMemo(() => currentStages(current, versionB), [current, versionB]);
  const maxStage = Math.max(...cur);
  const summaries = useMemo(() => STAGES.map((_, s) => stageSummary(rows, s)), [rows]);
  const counts = useMemo(() => countsFor(rows, maxStage), [rows, maxStage]);
  const lists = useMemo(() => focusLists(rows, maxStage), [rows, maxStage]);
  const fresh = useMemo(() => freshness(rows, cur), [rows, cur]);
  const segs = useMemo(() => Object.fromEntries(stageRows(current, gantt, versionB).map((r) => [r.s, r])), [current, gantt, versionB]);
  const schedules = useMemo(() => Object.fromEntries(cur.map((s) => [s, scheduleOf(current, gantt, s, versionB, now)])), [cur, current, gantt, versionB, now]);
  const maint = useMemo(() => nextMaintenance(current, gantt, versionB, now), [current, gantt, versionB, now]);
  const completed = isCompleted(current, versionB);
  const pct = effectivePct(current, template, state);
  const total = gantt.months.length;

  const needle = q.trim().toLowerCase();
  const filtersOn = filter !== "all" || owner !== "all" || needle !== "" || stageFocus !== null;
  const matches = (r) =>
    (stageFocus === null || r.stage === stageFocus) &&
    matchesFilter(r, filter, maxStage) &&
    (owner === "all" || r.owner === owner) &&
    (!needle || [r.id, r.task, r.next, r.deliverable, r.note, r.owner].some((t) => String(t || "").toLowerCase().includes(needle)));
  const isOpen = (s) => filtersOn || (s in openStages ? openStages[s] : cur.includes(s));

  const clearFilters = () => { setFilter("all"); setOwner("all"); setQ(""); setStageFocus(null); };
  const goTo = (id) => {
    const r = rowsById.get(id); if (!r) return;
    clearFilters();
    setOpenStages((o) => ({ ...o, [r.stage]: true }));
    setOpenRows((o) => ({ ...o, [id]: true }));
    setFlash(id);
    setTimeout(() => document.getElementById(`task-${id}`)?.scrollIntoView({ block: "center", behavior: "smooth" }), 60);
    setTimeout(() => setFlash((f) => (f === id ? null : f)), 2500);
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">מה קורה בתכנית · WBS</h1>
          <p className="text-sm text-slate-500">הסטטוסים וההחלטות נשמרים לכל תכנית בנפרד, בדפדפן הנוכחי. משימות שלא עודכנו ידנית מחושבות משלב התכנית.</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <PlanPicker plans={plans} plan={plan} onChange={setPlan} />
          <button onClick={() => go("/gantt", plan)} className="rounded-xl border bg-white px-4 py-2 text-sm hover:bg-slate-50">גאנט התכנית</button>
          <button onClick={reset} className="rounded-xl border bg-white px-4 py-2 text-sm hover:bg-slate-50">איפוס בחירות לתכנית</button>
        </div>
      </div>

      <NowSummary plan={current} completed={completed} versionB={versionB} pct={pct} current={cur} summaries={summaries} counts={counts} fresh={fresh}
        schedules={schedules} maint={maint} filter={filter} onFilter={setFilter} stageFocus={stageFocus} onStage={setStageFocus} />

      <FocusPanels lists={lists} onGoTo={goTo} onAction={(id, patch) => setMany(id, patch)} />

      <div className="mb-4 rounded-2xl border border-violet-200 bg-violet-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <b>גרסה ב׳ / עדכון מהותי</b>
            <p className="mt-1 text-sm">פותח מחדש את שלבים 0–4 לבחינה: כל רכיב עובר ל&quot;טרם הוחלט&quot;, ובכל שורה בוחרים נדרש / לא נדרש. לא כל המשימות נפתחות אוטומטית.</p>
          </div>
          <button onClick={() => setVersionB(!versionB)} className={`rounded-xl px-4 py-2 text-sm font-semibold ${versionB ? "border bg-white text-violet-700" : "bg-violet-600 text-white"}`}>
            {versionB ? "סגירת גרסה ב׳" : "פתיחת גרסה ב׳"}
          </button>
        </div>
      </div>

      <section aria-label="כל המשימות">
        <div className="mb-2 flex flex-wrap items-center gap-2" role="group" aria-label="מסנני משימות">
          {FILTERS.map((f) => (
            <button key={f.key} type="button" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}
              className={`rounded-full border px-3 py-1 text-sm ${filter === f.key ? "border-slate-800 bg-slate-800 text-white" : "bg-white hover:bg-slate-50"}`}>
              {f.label} <span className="opacity-70">{counts[f.key]}</span>
            </button>
          ))}
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} aria-label="חיפוש במשימות" placeholder="חיפוש לפי מספר, שם, הערה או פעולה" className="min-w-[260px] rounded-lg border bg-white px-3 py-2" />
          <label className="flex items-center gap-2">אחראי
            <select aria-label="סינון לפי אחראי" value={owner} onChange={(e) => setOwner(e.target.value)} className="rounded-lg border bg-white px-3 py-2">
              <option value="all">כולם</option>
              {OWNERS.map((o) => <option key={o}>{o}</option>)}
            </select>
          </label>
          {stageFocus !== null && <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-800">מוצג רק שלב {stageFocus}: {STAGES[stageFocus]}</span>}
          {filtersOn && <button type="button" onClick={clearFilters} className="rounded-lg border bg-white px-3 py-2">ניקוי סינון</button>}
          <button type="button" onClick={() => setOpenStages(Object.fromEntries(STAGES.map((_, i) => [i, true])))} className="rounded-lg border bg-white px-3 py-2">פתח כל השלבים</button>
          <button type="button" onClick={() => setOpenStages(Object.fromEntries(STAGES.map((_, i) => [i, false])))} className="rounded-lg border bg-white px-3 py-2">סגור כל השלבים</button>
        </div>

        <div className="max-h-[75vh] overflow-auto rounded-2xl border bg-white">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="sticky top-0 z-30 bg-slate-100 shadow-sm">
              <tr>
                {HEADERS.map((h) => <th className="border-b p-3 text-right" key={h}>{h}</th>)}
                <th className="border-b p-3 text-right"><span className="sr-only">פרטים</span></th>
              </tr>
            </thead>
            <tbody>
              {STAGES.map((name, s) => {
                const all = rows.filter((r) => r.stage === s), vis = all.filter(matches), sum = summaries[s], open = isOpen(s), isCur = cur.includes(s), sch = schedules[s];
                if (filtersOn && vis.length === 0) return null;
                return (
                  <Fragment key={s}>
                    <tr id={`stage-${s}`} className={`scroll-mt-12 ${isCur ? "bg-blue-100" : "bg-blue-50"}`}>
                      <td colSpan={7} className="p-0">
                        <button type="button" aria-expanded={open} disabled={filtersOn} onClick={() => setOpenStages((o) => ({ ...o, [s]: !open }))} className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 p-3 text-start font-semibold disabled:cursor-default">
                          <span aria-hidden="true">{open ? "▾" : "◂"}</span>
                          <span>שלב {s}: {name}</span>
                          <span className="text-xs font-normal text-slate-700">✓ {sum.done}/{sum.counted}</span>
                          {sum.active > 0 && <span className="text-xs font-normal text-amber-800">● {sum.active} בעבודה</span>}
                          {sum.ready > 0 && <span className="text-xs font-normal text-blue-800">▶ {sum.ready} מוכנות</span>}
                          {sum.undecided > 0 && <span className="text-xs font-normal text-violet-800">? {sum.undecided} להחלטה</span>}
                          {sum.stuck > 0 && <span className="text-xs font-normal text-red-700">⚠ {sum.stuck} מעוכבות</span>}
                          {sum.excluded > 0 && <span className="text-xs font-normal text-slate-500">⊘ {sum.excluded} לא נספרות</span>}
                          {isCur && <span className="rounded-full bg-blue-600 px-2 text-xs font-bold text-white">{versionB ? "בבחינה מחדש" : "כעת"}</span>}
                          {sch && <span className="text-xs font-normal text-slate-600">חלון בגאנט: {sch.label}</span>}
                          {sch && sch.late && <span className="rounded-full bg-red-100 px-2 text-xs text-red-700">עבר החלון</span>}
                          {filtersOn && <span className="text-xs font-normal text-slate-600">מוצגות {vis.length}</span>}
                        </button>
                      </td>
                    </tr>
                    {open && vis.map((r) => {
                      const idx = all.indexOf(r), gs = segs[r.stage];
                      return (
                        <TaskRow key={r.id} r={r} open={!!openRows[r.id]} onToggle={(id) => setOpenRows((o) => ({ ...o, [id]: !o[id] }))}
                          onPatch={setMany} onClear={clearRow} onGoTo={goTo} rowsById={rowsById} graph={graph} flash={flash === r.id}
                          bars={taskBar(r, idx, all.length, gs)} total={total} undatedText={gs && gs.undated ? "הושלם (ללא תאריך)" : gs && gs.st === "unscheduled" ? "טרם תוזמן" : "אין חלון בגאנט"} />
                      );
                    })}
                  </Fragment>
                );
              })}
              {filtersOn && STAGES.every((_, s) => rows.filter((r) => r.stage === s).filter(matches).length === 0) && (
                <tr><td colSpan={7} className="p-6 text-center text-slate-500">אין משימות שמתאימות לסינון.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-500">תאריכי הגאנט הם תכנון ראשוני (חלון זמן לכל שלב), עד לאימות תאריכים מדויקים.</p>
      </section>
    </>
  );
}
