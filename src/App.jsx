import { useEffect, useState } from "react";
import { useHashRoute } from "./lib/route.js";
import Portfolio from "./pages/Portfolio.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Wbs from "./pages/Wbs.jsx";
import Gantt from "./pages/Gantt.jsx";

const BASE = import.meta.env.BASE_URL;
const tabs = [
  ["/portfolio", "פורטפוליו"],
  ["/dashboard", "דאשבורד"],
  ["/wbs", "WBS"],
  ["/gantt", "גאנט"],
];

export default function App() {
  const { path, params, navigate } = useHashRoute();
  const [plans, setPlans] = useState([]);
  const [template, setTemplate] = useState([]);
  const [gantt, setGantt] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all(["plans", "wbs-template", "gantt"].map((n) => fetch(`${BASE}data/${n}.json`).then((r) => r.json())))
      .then(([p, t, g]) => { setPlans(p); setTemplate(t); setGantt(g); })
      .catch((e) => setError(String(e)));
  }, []);

  if (error) return <div dir="rtl" className="p-6 text-red-700">שגיאה בטעינת הנתונים: {error}</div>;
  if (!plans.length || !gantt) return <div dir="rtl" className="p-6">טוען…</div>;

  const plan = plans.some((p) => p.id === params.plan) ? params.plan : plans[0].id;
  const workMode = params.mode === "work";
  const routeParams = (id = plan) => ({ plan: id, ...(workMode ? { mode: "work" } : {}) });
  const setPlan = (id) => navigate(path, routeParams(id));
  const go = (to, id = plan) => navigate(to, routeParams(id));

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-40 border-b bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4 p-4">
          <div>
            <div className="text-xl font-bold">תכניות מרחביות</div>
            <div className="text-sm text-slate-500">פורטפוליו · דאשבורד · WBS · גאנט</div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex rounded-xl border bg-slate-100 p-1" role="group" aria-label="מצב האתר">
              <button
                type="button"
                onClick={() => navigate(path, { plan })}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${!workMode ? "bg-white text-blue-700 shadow-sm" : "text-slate-600"}`}
              >
                👁 תצוגה
              </button>
              <button
                type="button"
                onClick={() => navigate(path, { plan, mode: "work" })}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${workMode ? "bg-blue-600 text-white shadow-sm" : "text-slate-600"}`}
              >
                ✏️ עבודה
              </button>
            </div>

            <nav className="flex gap-2">
              {tabs.map(([k, t]) => (
                <button key={k} onClick={() => go(k)} className={`rounded-xl px-4 py-2 ${path === k ? "bg-blue-600 text-white" : "border bg-white"}`}>{t}</button>
              ))}
            </nav>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1600px] p-5">
        {path === "/dashboard" ? (
          <Dashboard plans={plans} plan={plan} setPlan={setPlan} />
        ) : path === "/wbs" ? (
          <Wbs plans={plans} plan={plan} setPlan={setPlan} template={template} gantt={gantt} go={go} workMode={workMode} />
        ) : path === "/gantt" ? (
          <Gantt plans={plans} plan={plan} setPlan={setPlan} gantt={gantt} template={template} />
        ) : (
          <Portfolio plans={plans} setPlan={setPlan} go={go} template={template} />
        )}
      </main>
    </div>
  );
}
