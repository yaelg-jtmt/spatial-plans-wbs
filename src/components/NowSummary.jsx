import StageFlow from "./StageFlow.jsx";
import { STAGES } from "../lib/wbsLogic.js";

const TILES = [
  { key: "active", label: "בעבודה", cls: "border-amber-300 bg-amber-50" },
  { key: "ready", label: "מוכנות להתחלה", cls: "border-blue-300 bg-blue-50" },
  { key: "queued", label: "ממתינות לקודמת", cls: "border-slate-300 bg-slate-50" },
  { key: "decide", label: "ממתינות להחלטה", cls: "border-violet-300 bg-violet-50" },
  { key: "stuck", label: "מעוכבות או ממתינות", cls: "border-red-300 bg-red-50" },
  { key: "done", label: "הושלמו", cls: "border-emerald-300 bg-emerald-50" },
];
const fmtDate = (iso) => new Date(iso).toLocaleDateString("he-IL", { day: "numeric", month: "numeric", year: "numeric" });

export default function NowSummary({ plan, completed, versionB, pct, current, summaries, counts, fresh, schedules, maint, filter, onFilter, stageFocus, onStage }) {
  const showPlanInfo = !completed && !versionB;
  return (
    <section aria-label="מצב התכנית עכשיו" className="mb-4 rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-bold">{plan.name}</h2>
        {completed && <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700">✓ התכנית הושלמה · 100%</span>}
        {versionB && <span className="rounded-full bg-violet-100 px-3 py-1 text-sm font-semibold text-violet-700">גרסה ב׳ בעבודה</span>}
        {!completed && <span className="rounded-full bg-slate-100 px-3 py-1 text-sm">התקדמות {pct}%</span>}
        <span className="text-sm text-slate-600">יעד: {plan.target}</span>
        <span className="text-sm text-slate-600">אחראי: {plan.owner}</span>
        {showPlanInfo && <span className="text-sm text-slate-600">QA: {plan.qa}</span>}
      </div>

      <div className="my-4"><StageFlow summaries={summaries} current={current} selected={stageFocus} onSelect={onStage} versionB={versionB} /></div>

      <ul className="mb-3 space-y-1 text-sm">
        {current.map((s) => (
          <li key={s} data-testid={`current-${s}`}>
            <b>שלב {s}: {STAGES[s]}</b>
            {s === 6 && maint && <span className="text-slate-600"> · מחזורי · {maint.now ? "מחזור התחזוקה מתקיים החודש" : `המחזור הבא: ${maint.label}`}</span>}
            {schedules[s] && <span className="text-slate-600"> · חלון בגאנט: {schedules[s].label}</span>}
            {schedules[s] && schedules[s].late && (
              <span className="mr-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700" title="תאריכי הגאנט הם תכנון ראשוני ולא מאומתים">עבר חלון הזמן בגאנט</span>
            )}
          </li>
        ))}
      </ul>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-6" role="group" aria-label="סינון לפי מצב">
        {TILES.map((t) => (
          <button
            key={t.key}
            type="button"
            aria-pressed={filter === t.key}
            onClick={() => onFilter(filter === t.key ? "all" : t.key)}
            className={`rounded-xl border p-3 text-start hover:brightness-95 ${t.cls} ${filter === t.key ? "ring-2 ring-slate-700" : ""}`}
          >
            <b className="text-2xl">{counts[t.key]}</b>
            {t.key === "done" && <span className="text-sm text-slate-600"> מתוך {counts.counted}</span>}
            <span className="block text-sm">{t.label}</span>
          </button>
        ))}
      </div>

      {showPlanInfo && (
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm"><b>חסם</b><p>{plan.blocker}</p></div>
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm"><b>הפעולה הבאה</b><p>{plan.next}</p></div>
        </div>
      )}
      {versionB && <p className="mt-3 rounded-xl bg-violet-50 p-3 text-sm">גרסה ב׳: עוברים על שלבים 0–4 ומחליטים בכל רכיב נדרש / לא נדרש. הפאנל &quot;ממתינות להחלטה&quot; מציג את הרכיבים שנותרו.</p>}

      {!(completed && !versionB) && fresh.total > 0 && (
        fresh.confirmed === 0 ? (
          <p className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm" data-testid="trust">
            הסטטוס של משימות השלב הנוכחי עדיין לא עודכן ידנית, והוא מחושב משלב התכנית. כדי לראות מה קורה בפועל, עדכנו סטטוס בשורות או בכפתורי הפאנלים שמתחת.
          </p>
        ) : (
          <p className="mt-3 text-sm text-slate-600" data-testid="trust">
            עודכנו ידנית {fresh.confirmed} מתוך {fresh.total} משימות בשלבים הנוכחיים{fresh.last ? ` · עדכון אחרון: ${fmtDate(fresh.last)}` : ""}.
          </p>
        )
      )}
    </section>
  );
}
