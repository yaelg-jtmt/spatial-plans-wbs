import { useState } from "react";
import { RefreshCw } from "lucide-react";
import PlanPicker from "../components/PlanPicker.jsx";

export default function Gantt({ plans, plan, setPlan }) {
  const [maintenance, setMaintenance] = useState(["Q1", "Q2", "Q3", "Q4"]);
  const toggle = (q) =>
    setMaintenance((m) => (m.includes(q) ? m.filter((x) => x !== q) : [...m, q]));
  return (
    <>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">גאנט ותחזוקה מחזורית</h1>
          <p className="text-sm text-slate-500">תחזוקה מוצגת בנקודות עבודה במהלך השנה ולא כפס רציף.</p>
        </div>
        <PlanPicker plans={plans} plan={plan} onChange={setPlan} />
      </div>
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="grid grid-cols-4 gap-3">
          {["Q1", "Q2", "Q3", "Q4"].map((q) => (
            <button
              key={q}
              onClick={() => toggle(q)}
              className={`rounded-xl border p-4 text-center ${
                maintenance.includes(q) ? "border-blue-500 bg-blue-50" : "bg-slate-50 text-slate-400"
              }`}
            >
              <RefreshCw className="mx-auto mb-2 h-4 w-4" />
              <b>{q}</b>
              <div className="text-xs">{maintenance.includes(q) ? "מחזור תחזוקה" : "ללא מחזור"}</div>
            </button>
          ))}
        </div>
        <div className="mt-4 text-sm text-slate-500">
          בכל מחזור: עדכון סטטוס פרויקטים → רענון תוצרים לפי צורך → חוות דעת לפי צורך → החלטה אם לפתוח גרסה ב׳.
        </div>
      </div>
    </>
  );
}
