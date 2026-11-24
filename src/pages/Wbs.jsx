import Select from "../components/Select.jsx";
import ProductAssignment from "../components/ProductAssignment.jsx";
import PlanPicker from "../components/PlanPicker.jsx";
import { useWbsRows } from "../lib/useWbsRows.js";

const choiceOptions = ["נדרש", "לא נדרש", "טרם הוחלט", "הוחרג בתכולה המקורית"];
const requirementOptions = ["חובה", "לפי צורך", "מותנה", "אבן דרך"];
const ownerOptions = ["מנהלת הפרויקט", "רפרנט מקצועי", "יועץ מקצועי"];

export default function Wbs({ plans, plan, setPlan, template, stages }) {
  const current = plans.find((p) => p.id === plan);
  const { rows, update, reset } = useWbsRows(plan, template);
  const headers = ["WBS", "שלב", "משימה", "חובה / לפי צורך", "החלטה", "אחראי", "משויך לתוצר"];

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">WBS אינטראקטיבי</h1>
          <p className="text-sm text-slate-500">
            הבחירות נשמרות לכל תכנית בנפרד, בדפדפן הנוכחי, ומאפשרות החלטה ברמת כל שורה.
          </p>
        </div>
        <div className="flex items-end gap-3">
          <PlanPicker plans={plans} plan={plan} onChange={setPlan} />
          <button onClick={reset} className="rounded-xl border bg-white px-4 py-2 text-sm hover:bg-slate-50">
            איפוס בחירות לתכנית
          </button>
        </div>
      </div>

      <div className="mb-4 rounded-2xl bg-white p-4 shadow-sm">
        <b>{current?.name}</b> · {current?.progress}%{" "}
        {current?.completed && (
          <span className="mr-2 rounded-full bg-emerald-100 px-2 py-1 text-sm text-emerald-700">הושלם</span>
        )}
      </div>

      <div className="max-h-[68vh] overflow-auto rounded-2xl border bg-white">
        <table className="w-full min-w-[1250px] text-sm">
          <thead className="sticky top-0 z-20 bg-slate-100 shadow-sm">
            <tr>
              {headers.map((h) => (
                <th className="border-b p-3 text-right" key={h}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b align-top hover:bg-slate-50">
                <td className="p-3 font-bold">{r.id}</td>
                <td className="p-3">
                  {r.stage} · {stages[r.stage]}
                </td>
                <td className="p-3">{r.task}</td>
                <td className="p-2">
                  <Select value={r.requirement} options={requirementOptions} onChange={(v) => update(r.id, "requirement", v)} />
                </td>
                <td className="p-2">
                  <Select value={r.decision} options={choiceOptions} onChange={(v) => update(r.id, "decision", v)} />
                </td>
                <td className="p-2">
                  <Select value={r.owner} options={ownerOptions} onChange={(v) => update(r.id, "owner", v)} />
                </td>
                <td className="p-2">
                  <ProductAssignment values={r.products || []} onChange={(v) => update(r.id, "products", v)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
        <b>גרסה ב׳ / עדכון מהותי</b>
        <p className="mt-1 text-sm">
          בעת פתיחת עדכון עמוק עוברים מחדש על הצ׳קליסט ומחליטים בכל רכיב נדרש, לא נדרש או מוחרג. אין פתיחה אוטומטית של
          כל המשימות.
        </p>
      </div>
    </>
  );
}
