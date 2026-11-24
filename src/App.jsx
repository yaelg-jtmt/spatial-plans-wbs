import { useEffect, useState } from "react";
import { useHashRoute } from "./lib/route.js";
import Portfolio from "./pages/Portfolio.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Wbs from "./pages/Wbs.jsx";
import Gantt from "./pages/Gantt.jsx";

const BASE = import.meta.env.BASE_URL;
const stages = ["התנעה", "מצב קיים", "ניתוח", "הצעות", "תוצרים", "הטמעה", "תחזוקה"];
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
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([
      fetch(`${BASE}data/plans.json`).then((r) => r.json()),
      fetch(`${BASE}data/wbs-template.json`).then((r) => r.json()),
    ])
      .then(([p, t]) => {
        setPlans(p);
        setTemplate(t);
      })
      .catch((e) => setError(String(e)));
  }, []);

  if (error) return <div dir="rtl" className="p-6 text-red-700">שגיאה בטעינת הנתונים: {error}</div>;
  if (!plans.length) return <div dir="rtl" className="p-6">טוען…</div>;

  const plan = plans.some((p) => p.id === params.plan) ? params.plan : plans[0].id;
  const setPlan = (id) => navigate(path, { plan: id });
  const go = (to, id = plan) => navigate(to, { plan: id });

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-50 border-b bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4 p-4">
          <div>
            <div className="text-xl font-bold">תכניות מרחביות</div>
            <div className="text-sm text-slate-500">פורטפוליו · דאשבורד · WBS · גאנט</div>
          </div>
          <nav className="flex gap-2">
            {tabs.map(([k, t]) => (
              <button
                key={k}
                onClick={() => go(k)}
                className={`rounded-xl px-4 py-2 ${path === k ? "bg-blue-600 text-white" : "border bg-white"}`}
              >
                {t}
              </button>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-[1600px] p-5">
        {path === "/dashboard" ? (
          <Dashboard plans={plans} plan={plan} setPlan={setPlan} />
        ) : path === "/wbs" ? (
          <Wbs plans={plans} plan={plan} setPlan={setPlan} template={template} stages={stages} />
        ) : path === "/gantt" ? (
          <Gantt plans={plans} plan={plan} setPlan={setPlan} />
        ) : (
          <Portfolio plans={plans} setPlan={setPlan} go={go} />
        )}
      </main>
    </div>
  );
}
