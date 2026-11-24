import { useMemo, useState } from "react";
import PlanPicker from "../components/PlanPicker.jsx";
import { planSpan, stageRows, todayOffset } from "../lib/ganttLogic.js";
import { readState } from "../lib/useWbsState.js";
import { STAGES, effectivePct, isCompleted } from "../lib/wbsLogic.js";

const BAR = { done: "bg-emerald-500", active: "bg-amber-500", future: "bg-slate-400", maint: "bg-blue-600" };

function Timeline({ total, today, children }) {
  return (
    <div
      className="relative grid min-h-[42px] items-center"
      style={{
        gridTemplateColumns: `repeat(${total}, 1fr)`,
        backgroundImage: "linear-gradient(to left, #e2e8f0 1px, transparent 1px)",
        backgroundSize: `calc(100% / ${total}) 100%`,
      }}
    >
      {today !== null && <div className="absolute inset-y-0 z-10 w-0.5 bg-red-500" style={{ right: `${(today / total) * 100}%` }} title="היום" />}
      {children}
    </div>
  );
}

function Bar({ b, label }) {
  return (
    <div
      className={`mx-0.5 flex h-6 items-center justify-center overflow-hidden whitespace-nowrap rounded-lg text-[10px] font-bold text-white ${BAR[b.st] || BAR.future}`}
      style={{ gridColumn: `${b.a + 1} / span ${Math.max(1, b.b - b.a)}`, gridRow: 1 }}
      title={label}
    >
      {label}
    </div>
  );
}

export default function Gantt({ plans, plan, setPlan, gantt, template }) {
  const [planFilter, setPlanFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [expanded, setExpanded] = useState(() => Object.fromEntries(plans.map((p) => [p.id, true])));
  const total = gantt.months.length;
  const today = useMemo(() => todayOffset(gantt.start, total), [gantt, total]);
  const setAll = (v) => setExpanded(Object.fromEntries(plans.map((p) => [p.id, v])));
  const shown = plans.filter((p) => planFilter === "all" || p.id === planFilter);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">גאנט כל התכניות</h1>
          <p className="text-sm text-slate-500">תצוגה חודשית מנובמבר 2026 עד דצמבר 2027. לחיצה על שם תכנית פותחת וסוגרת את שלביה. תחזוקה מוצגת כמחזורים לאורך השנה.</p>
        </div>
        <PlanPicker plans={plans} plan={plan} onChange={(id) => { setPlan(id); setPlanFilter(id); }} />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 text-sm shadow-sm">
        <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value)} className="rounded-lg border bg-white px-3 py-2">
          <option value="all">כל התכניות</option>
          {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)} className="rounded-lg border bg-white px-3 py-2">
          <option value="all">כל השלבים</option>
          {STAGES.map((n, i) => <option key={i} value={i}>שלב {i}: {n}</option>)}
        </select>
        <button onClick={() => setAll(true)} className="rounded-lg border bg-white px-3 py-2">פתח הכול</button>
        <button onClick={() => setAll(false)} className="rounded-lg border bg-white px-3 py-2">סגור הכול</button>
        <span className="flex flex-wrap items-center gap-3 text-xs">
          <span><i className="ml-1 inline-block h-3 w-3 rounded bg-emerald-500" />הושלם</span>
          <span><i className="ml-1 inline-block h-3 w-3 rounded bg-amber-500" />פעיל</span>
          <span><i className="ml-1 inline-block h-3 w-3 rounded bg-slate-400" />עתידי</span>
          <span><i className="ml-1 inline-block h-3 w-3 rounded bg-blue-600" />מחזור תחזוקה</span>
          <span><i className="ml-1 inline-block h-3 w-0.5 bg-red-500" />היום</span>
        </span>
      </div>

      <div className="max-h-[72vh] overflow-auto rounded-2xl border bg-white">
        <div className="min-w-[1500px]">
          <div className="sticky top-0 z-30 grid grid-cols-[230px_150px_1fr] border-b bg-slate-100 text-xs font-bold">
            <div className="border-l p-3">תכנית</div>
            <div className="border-l p-3">שלב</div>
            <div className="grid" style={{ gridTemplateColumns: `repeat(${total}, 1fr)` }}>
              {gantt.months.map((m) => <div key={m} className="border-l p-3 text-center">{m}</div>)}
            </div>
          </div>

          {shown.map((p) => {
            const st = readState(p.id);
            const vb = st.versionB;
            const pct = effectivePct(p, template, st);
            const rows = stageRows(p, gantt, vb).filter((r) => stageFilter === "all" || r.s === +stageFilter);
            if (!rows.length) return null;
            const done = isCompleted(p, vb);
            const span = planSpan(rows);
            return (
              <div key={p.id}>
                <div className="grid cursor-pointer grid-cols-[230px_150px_1fr] border-b bg-slate-50 hover:bg-blue-50" onClick={() => setExpanded((e) => ({ ...e, [p.id]: !e[p.id] }))}>
                  <div className="border-l p-3 font-bold">
                    {p.name}
                    <div className="text-[11px] font-normal text-slate-500">{pct}% · יעד {p.target}</div>
                  </div>
                  <div className="border-l p-3 text-xs">{expanded[p.id] ? "▾" : "◂"} {rows.length} שלבים</div>
                  <Timeline total={total} today={today}>
                    {done ? (
                      <div className="px-3 text-xs font-bold text-emerald-700" style={{ gridColumn: "2 / span 5", gridRow: 1 }}>✓ הושלמה · 100%</div>
                    ) : (
                      span && <Bar b={{ a: span.a, b: span.b, st: p.status === "ממתין" ? "future" : "active" }} label={`${pct}%`} />
                    )}
                  </Timeline>
                </div>
                {expanded[p.id] &&
                  rows.map((r) => (
                    <div key={r.s} className="grid grid-cols-[230px_150px_1fr] border-b">
                      <div className="border-l p-3 pr-6 text-xs text-slate-500">{r.label}</div>
                      <div className="border-l p-3 text-xs">{r.s} · {STAGES[r.s]}</div>
                      <Timeline total={total} today={today}>
                        {r.undated ? (
                          <div className="px-3 text-xs font-semibold text-emerald-600" style={{ gridColumn: "2 / span 4", gridRow: 1 }}>הושלם</div>
                        ) : r.st === "unscheduled" ? (
                          <div className="px-3 text-xs text-slate-400" style={{ gridColumn: "2 / span 4", gridRow: 1 }}>טרם תוזמן</div>
                        ) : (
                          r.bars.map((b, i) => <Bar key={i} b={b} label={b.l} />)
                        )}
                        {r.bars.map((b, i) => b.m !== undefined && (
                          <div key={`m${i}`} className="z-10 h-3.5 w-3.5 rotate-45 justify-self-center bg-violet-600" style={{ gridColumn: b.m + 1, gridRow: 1 }} title="אבן דרך ידועה" />
                        ))}
                      </Timeline>
                    </div>
                  ))}
              </div>
            );
          })}
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-500">תאריכים הם תכנון עבודה ראשוני עד לאימות. תכניות שהושלמו מוצגות כהושלמו, ורק מחזורי התחזוקה מתוארכים.</p>
    </>
  );
}
