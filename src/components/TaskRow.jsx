import Select from "./Select.jsx";
import ProductAssignment from "./ProductAssignment.jsx";
import { DECISIONS, OWNERS, REQUIREMENTS, STATUSES, optionsWith } from "../lib/wbsLogic.js";
import { STATE_META } from "../lib/wbsNow.js";

const BORDER = { done: "border-r-emerald-500", active: "border-r-amber-500", ready: "border-r-blue-500", queued: "border-r-slate-300", blocked: "border-r-red-500", waiting: "border-r-orange-400", excluded: "border-r-slate-200" };
const CHIP = { done: "bg-emerald-50 text-emerald-700", active: "bg-amber-50 text-amber-800", ready: "bg-blue-50 text-blue-700", queued: "bg-slate-100 text-slate-600", blocked: "bg-red-50 text-red-700", waiting: "bg-orange-50 text-orange-700", excluded: "bg-slate-100 text-slate-500" };
const GBAR = { done: "bg-emerald-500", active: "bg-amber-500", ready: "bg-blue-500", queued: "bg-slate-400", blocked: "bg-red-500", waiting: "bg-orange-400", excluded: "bg-slate-300" };
const fmtDate = (iso) => new Date(iso).toLocaleDateString("he-IL", { day: "numeric", month: "numeric", year: "2-digit" });

function StateChip({ r }) {
  const m = STATE_META[r.state];
  const extra = r.state === "queued" && r.unmet.length ? ` (${r.unmet.slice(0, 2).join(", ")}${r.unmet.length > 2 ? "…" : ""})` : "";
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${CHIP[r.state]}`}><span aria-hidden="true">{m.icon}</span>{m.label}{extra}</span>;
}

function MiniGantt({ bars, total, state }) {
  return (
    <div className="grid h-5 items-center" style={{ gridTemplateColumns: `repeat(${total}, 1fr)` }} aria-hidden="true">
      {bars.map((b, i) => <div key={i} className={`h-3 rounded ${GBAR[state]}`} style={{ gridColumn: `${b.a + 1} / span ${Math.max(1, b.b - b.a)}` }} />)}
    </div>
  );
}

export default function TaskRow({ r, open, onToggle, onPatch, onClear, onGoTo, rowsById, graph, bars, total, flash, undatedText }) {
  const preds = graph.preds.get(r.id) || [], predNotes = graph.notes.get(r.id) || [];
  const waitingOnMe = (graph.succs.get(r.id) || []).filter((id) => { const x = rowsById.get(id); return x && !x.excluded && x.state !== "done"; });
  const chip = (id) => { const x = rowsById.get(id); return x ? (
    <button key={id} type="button" onClick={() => onGoTo(id)} title={`${id} · ${x.task} · ${STATE_META[x.state].label}`} aria-label={`מעבר למשימה ${id}: ${STATE_META[x.state].label}`} className={`rounded-full px-2 py-0.5 text-xs hover:brightness-95 ${CHIP[x.state]}`}>
      <span aria-hidden="true">{STATE_META[x.state].icon}</span> {id}
    </button>) : null; };
  const L = (what) => `${what} ${r.id}`;

  return (
    <>
      <tr id={`task-${r.id}`} className={`border-b align-top hover:bg-slate-50 ${flash ? "bg-yellow-50" : ""}`}>
        <td className={`border-r-4 p-3 font-bold ${BORDER[r.state]}`}>{r.id}</td>
        <td className="min-w-[260px] p-3">
          <div className="font-medium">{r.task}</div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <StateChip r={r} />
            <span className="text-xs text-slate-500">{r.requirement}</span>
            {r.note && <span className="text-xs text-slate-500" title={r.note}>📝 יש הערה</span>}
          </div>
        </td>
        <td className="min-w-[150px] p-2">
          {r.excluded ? <span className="inline-block rounded-full bg-slate-100 px-3 py-2 text-xs text-slate-600">{r.status}</span> : <Select label={L("סטטוס")} value={r.status} options={STATUSES} onChange={(v) => onPatch(r.id, { status: v })} />}
          <div className="mt-1 text-[11px] text-slate-500">{r.manual ? (r.updated ? `עודכן ${fmtDate(r.updated)}` : "עודכן ידנית") : "מחושב משלב התכנית"}</div>
        </td>
        <td className="min-w-[180px] p-2"><Select label={L("החלטה")} value={r.decision} options={DECISIONS} onChange={(v) => onPatch(r.id, { decision: v })} /></td>
        <td className="min-w-[150px] p-2"><Select label={L("אחראי")} value={r.owner} options={optionsWith(OWNERS, r.owner)} onChange={(v) => onPatch(r.id, { owner: v })} /></td>
        <td className="min-w-[200px] p-3 text-sm text-slate-700">{r.next}</td>
        <td className="p-2">
          <button type="button" aria-expanded={open} aria-controls={`detail-${r.id}`} aria-label={L(open ? "סגירת פרטים של" : "פתיחת פרטים של")} onClick={() => onToggle(r.id)} className="rounded-lg border bg-white px-2 py-1 text-xs hover:bg-slate-50">{open ? "▴ פחות" : "▾ פרטים"}</button>
        </td>
      </tr>
      {open && (
        <tr id={`detail-${r.id}`} className="border-b bg-slate-50">
          <td colSpan={7} className="p-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <h4 className="mb-1 text-sm font-bold">תלויות</h4>
                <p className="text-xs text-slate-500">קודמות (צריכות להסתיים לפני המשימה):</p>
                <div className="mb-2 mt-1 flex flex-wrap gap-1" data-testid={`preds-${r.id}`}>
                  {preds.length || predNotes.length ? <>{preds.map(chip)}{predNotes.map((n) => <span key={n} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{n}</span>)}</> : <span className="text-xs text-slate-500">אין, אפשר להתחיל</span>}
                </div>
                <p className="text-xs text-slate-500">משימות שמחכות לה:</p>
                <div className="mt-1 flex flex-wrap gap-1" data-testid={`succs-${r.id}`}>
                  {waitingOnMe.length ? waitingOnMe.slice(0, 10).map(chip) : <span className="text-xs text-slate-500">אין</span>}
                  {waitingOnMe.length > 10 && <span className="text-xs text-slate-500">ועוד {waitingOnMe.length - 10}</span>}
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-sm"><span className="mb-1 block font-bold">סוג המשימה</span>
                  <Select label={L("סוג משימה")} value={r.requirement} options={optionsWith(REQUIREMENTS, r.requirement)} onChange={(v) => onPatch(r.id, { requirement: v })} />
                </label>
                <p className="text-sm"><b>תוצר מצופה: </b>{r.deliverable}</p>
                <div><span className="mb-1 block text-sm font-bold">משויך לתוצר</span><ProductAssignment label={r.id} values={r.products} onChange={(v) => onPatch(r.id, { products: v })} /></div>
              </div>
              <div className="space-y-2">
                <label className="block text-sm"><span className="mb-1 block font-bold">{r.status === "מעוכב" ? "חסם / סיבת העיכוב" : "הערה: מה קורה במשימה"}</span>
                  <textarea aria-label={L("הערה")} value={r.note} onChange={(e) => onPatch(r.id, { note: e.target.value })} rows={3} className="w-full rounded-lg border border-slate-200 bg-white p-2" placeholder="למשל: ממתינים לתחזית מהיועץ, צפוי בשבוע הבא" />
                </label>
                <div className="text-xs text-slate-500">לוח זמנים בגאנט (תכנון ראשוני):</div>
                {bars ? <MiniGantt bars={bars} total={total} state={r.state} /> : <div className="text-xs text-slate-400">{undatedText}</div>}
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{r.updated ? `עודכן לאחרונה: ${fmtDate(r.updated)}` : "לא עודכן"}</span>
                  {r.hasOverride && <button type="button" aria-label={L("איפוס לברירת מחדל של")} onClick={() => onClear(r.id)} className="rounded-lg border bg-white px-2 py-1 hover:bg-slate-50">איפוס לברירת מחדל</button>}
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
