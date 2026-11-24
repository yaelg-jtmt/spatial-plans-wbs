import { STAGES } from "../lib/wbsLogic.js";
import { stageDisplay } from "../lib/wbsNow.js";

const CIRCLE = { done: "bg-emerald-500 text-white", current: "bg-blue-600 text-white", partial: "bg-amber-500 text-white", future: "bg-slate-300 text-slate-700" };
const BAR = { done: "bg-emerald-500", current: "bg-blue-600", partial: "bg-amber-500", future: "bg-slate-300" };

// שבעת השלבים. לחיצה על שלב מסננת את הטבלה אליו (ולחיצה נוספת מבטלת). "כעת" = השלב הנוכחי.
export default function StageFlow({ summaries, current, selected, onSelect, versionB }) {
  return (
    <ol className="grid grid-cols-7 gap-2" aria-label="שלבי התכנית">
      {STAGES.map((name, s) => {
        const sum = summaries[s], isCur = current.includes(s), d = stageDisplay(sum, isCur);
        return (
          <li key={s}>
            <button
              type="button"
              aria-pressed={selected === s}
              aria-label={`שלב ${s} ${name}: ${sum.done} מתוך ${sum.counted} הושלמו${isCur ? ", השלב הנוכחי" : ""}`}
              onClick={() => onSelect(selected === s ? null : s)}
              className={`flex w-full flex-col items-center rounded-xl border bg-white px-1 py-2 text-center hover:bg-slate-50 ${selected === s ? "border-blue-500 ring-2 ring-blue-300" : "border-slate-200"}`}
            >
              <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full font-bold ${CIRCLE[d]}`}>{d === "done" ? "✓" : s}</span>
              <span className="mt-1 text-xs font-semibold">{name}</span>
              <span className="text-[11px] text-slate-500">{sum.done}/{sum.counted}</span>
              <span className="mt-1 block h-1.5 w-4/5 overflow-hidden rounded-full bg-slate-200">
                <span className={`block h-full ${BAR[d]}`} style={{ width: `${sum.pct}%` }} />
              </span>
              <span className="mt-1 h-4 text-[11px] font-bold text-blue-700">{isCur ? (versionB ? "בבחינה מחדש" : "כעת") : ""}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
