import { useMemo, useState } from "react";
import { readState } from "../lib/useWbsState.js";
import { OWNERS, STAGES, effectivePct, isCompleted, stageState } from "../lib/wbsLogic.js";

const SQ = { done: "bg-emerald-500", partial: "bg-amber-500", lead: "bg-blue-600", future: "bg-slate-200" };
const COLS = { gridTemplateColumns: "230px repeat(7, minmax(60px, 1fr)) 120px" };

export default function Portfolio({ plans, setPlan, go, template }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [stage, setStage] = useState("all");
  const [owner, setOwner] = useState("all");
  const [drawer, setDrawer] = useState(null);

  const states = useMemo(() => Object.fromEntries(plans.map((p) => [p.id, readState(p.id)])), [plans]);
  const vb = useMemo(() => Object.fromEntries(plans.map((p) => [p.id, states[p.id].versionB])), [plans, states]);
  const pct = useMemo(() => Object.fromEntries(plans.map((p) => [p.id, effectivePct(p, template, states[p.id])])), [plans, states, template]);
  const stats = useMemo(() => {
    const completed = plans.filter((p) => isCompleted(p, vb[p.id])).length;
    const avg = Math.round(plans.reduce((a, p) => a + pct[p.id], 0) / (plans.length || 1));
    return [
      ["תכניות שהושלמו", completed],
      ["התקדמות ממוצעת", `${avg}%`],
      ["בתהליך", plans.filter((p) => !isCompleted(p, vb[p.id]) && p.status === "בתהליך").length],
      ["ממתינות", plans.filter((p) => p.status === "ממתין").length],
      ["פערי QA", plans.filter((p) => p.qa === "נמצא פער").length],
    ];
  }, [plans, vb, pct]);

  const list = plans.filter(
    (p) =>
      (status === "all" || p.status === status) &&
      (stage === "all" || p.active.includes(+stage)) &&
      (owner === "all" || p.owner === owner) &&
      [p.name, p.blocker, p.next].some((t) => t.includes(q))
  );
  const open = (id, path) => { setPlan(id); go(path, id); };
  const drawerPlan = plans.find((p) => p.id === drawer);

  return (
    <>
      <h1 className="mb-1 text-2xl font-bold">תמונת מצב של 12 התכניות</h1>
      <p className="mb-4 text-sm text-slate-500">מפת שלבים, חסמים ופעולות הבאות. לחיצה על תכנית פותחת פרטים.</p>

      <div className="grid gap-3 md:grid-cols-5">
        {stats.map(([label, v]) => (
          <div key={label} className="rounded-2xl bg-white p-4 shadow-sm">
            <b className="text-2xl">{v}</b>
            <div className="text-sm text-slate-500">{label}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 text-sm shadow-sm">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש לפי תכנית, חסם או פעולה" className="min-w-[220px] rounded-lg border px-3 py-2" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border bg-white px-3 py-2">
          <option value="all">כל הסטטוסים</option>
          {["הושלם", "בתהליך", "ממתין", "מעוכב"].map((s) => <option key={s}>{s}</option>)}
        </select>
        <select value={stage} onChange={(e) => setStage(e.target.value)} className="rounded-lg border bg-white px-3 py-2">
          <option value="all">כל השלבים</option>
          {STAGES.map((n, i) => <option key={i} value={i}>שלב {i}: {n}</option>)}
        </select>
        <select value={owner} onChange={(e) => setOwner(e.target.value)} className="rounded-lg border bg-white px-3 py-2">
          <option value="all">כל האחראים</option>
          {OWNERS.map((o) => <option key={o}>{o}</option>)}
        </select>
        <span className="flex flex-wrap items-center gap-3 text-xs">
          <span><i className="ml-1 inline-block h-3 w-3 rounded bg-emerald-500" />הושלם</span>
          <span><i className="ml-1 inline-block h-3 w-3 rounded bg-amber-500" />פעיל</span>
          <span><i className="ml-1 inline-block h-3 w-3 rounded bg-blue-600" />מוביל</span>
          <span><i className="ml-1 inline-block h-3 w-3 rounded bg-slate-200" />עתידי</span>
        </span>
      </div>

      <div className="mt-4 max-h-[65vh] overflow-auto rounded-2xl border bg-white">
        <div className="min-w-[1050px]">
          <div className="sticky top-0 z-10 grid border-b bg-slate-100 text-sm font-bold" style={COLS}>
            <div className="p-3">תכנית</div>
            {STAGES.map((n, s) => <div key={s} className="p-3 text-center">{s}<div className="text-[11px] font-normal text-slate-500">{n}</div></div>)}
            <div className="p-3 text-center">התקדמות</div>
          </div>
          {list.map((p) => {
            const v = vb[p.id];
            const done = isCompleted(p, v);
            return (
              <div key={p.id} className="grid items-center border-b" style={COLS}>
                <div className="cursor-pointer p-3 font-bold hover:bg-blue-50" onClick={() => setDrawer(p.id)}>
                  {p.name} {done && <span className="mr-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] text-emerald-700">✓ הושלמה</span>}
                  <div className="text-xs font-normal text-slate-500">יעד {p.target}</div>
                </div>
                {STAGES.map((n, s) => {
                  const st = stageState(p, s, v);
                  return (
                    <div key={s} className="p-3 text-center">
                      <div className={`mx-auto h-6 w-6 rounded-lg ${SQ[st]} ${p.active.includes(s) && !done ? "ring-4 ring-amber-200" : ""}`} title={`שלב ${s}: ${n}`} />
                    </div>
                  );
                })}
                <div className="p-3 text-center">
                  <b>{pct[p.id]}%</b>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-blue-600" style={{ width: `${pct[p.id]}%` }} /></div>
                </div>
              </div>
            );
          })}
          {!list.length && <div className="p-6 text-center text-slate-500">אין תכניות שמתאימות לסינון</div>}
        </div>
      </div>

      {drawerPlan && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-slate-900/30" onClick={() => setDrawer(null)} />
          <aside className="relative mr-auto h-full w-[min(560px,100%)] overflow-auto bg-white p-6 shadow-2xl">
            <button className="float-left text-2xl" onClick={() => setDrawer(null)}>×</button>
            <h2 className="text-xl font-bold">{drawerPlan.name}</h2>
            <div className="mt-3 rounded-xl border p-4 text-sm">
              <b>התקדמות {pct[drawerPlan.id]}%</b>
              <p>יעד: {drawerPlan.target}</p>
              <p>אחראי: {drawerPlan.owner}</p>
              <p>QA: {drawerPlan.qa}</p>
            </div>
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm"><b>חסם</b><p>{drawerPlan.blocker}</p></div>
            <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm"><b>הפעולה הבאה</b><p>{drawerPlan.next}</p></div>
            <div className="mt-4 flex flex-wrap gap-2 text-sm">
              <button onClick={() => open(drawerPlan.id, "/wbs")} className="rounded-lg bg-blue-600 px-4 py-2 text-white">פתח WBS</button>
              <button onClick={() => open(drawerPlan.id, "/gantt")} className="rounded-lg border px-4 py-2">גאנט</button>
              <button onClick={() => open(drawerPlan.id, "/dashboard")} className="rounded-lg border px-4 py-2">מפה</button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
