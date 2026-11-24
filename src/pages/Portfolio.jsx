import { useMemo } from "react";
import { CheckCircle2 } from "lucide-react";

export default function Portfolio({ plans, setPlan, go }) {
  const stats = useMemo(
    () => ({
      complete: plans.filter((p) => p.completed).length,
      avg: Math.round(plans.reduce((a, p) => a + p.progress, 0) / (plans.length || 1)),
    }),
    [plans]
  );
  const open = (id, path) => {
    setPlan(id);
    go(path, id);
  };
  return (
    <>
      <h1 className="mb-4 text-2xl font-bold">תמונת מצב</h1>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <b className="text-3xl">{stats.complete}</b>
          <div className="text-slate-500">תכניות שהושלמו</div>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <b className="text-3xl">{stats.avg}%</b>
          <div className="text-slate-500">התקדמות ממוצעת</div>
        </div>
        <div className="rounded-2xl bg-emerald-50 p-5">
          <b>כלל השלמה</b>
          <p className="text-sm">סעיף שהוחרג מהתכולה המקורית אינו מפחית מאחוז ההשלמה.</p>
        </div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map((p) => (
          <div key={p.id} className="rounded-2xl border bg-white p-4">
            <div className="flex items-center justify-between">
              <b>{p.name}</b>
              {p.completed && <CheckCircle2 className="text-emerald-500" />}
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full bg-blue-600" style={{ width: `${p.progress}%` }} />
            </div>
            <div className="mt-2 text-sm">
              {p.progress}% · {p.status}
            </div>
            <div className="mt-3 flex gap-2 text-sm">
              <button onClick={() => open(p.id, "/dashboard")} className="rounded-lg border px-3 py-1 hover:bg-slate-50">
                מפה
              </button>
              <button onClick={() => open(p.id, "/wbs")} className="rounded-lg border px-3 py-1 hover:bg-slate-50">
                WBS
              </button>
              <button onClick={() => open(p.id, "/gantt")} className="rounded-lg border px-3 py-1 hover:bg-slate-50">
                גאנט
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
