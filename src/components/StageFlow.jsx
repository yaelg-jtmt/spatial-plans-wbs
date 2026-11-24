import { STAGES, stageState } from "../lib/wbsLogic.js";

const BG = { done: "bg-emerald-500", partial: "bg-amber-500", lead: "bg-blue-600", future: "bg-slate-300" };
const LABEL = { done: "הושלם", partial: "פעיל", lead: "מוביל", future: "עתידי" };

export default function StageFlow({ plan, versionB = false }) {
  return (
    <div className="relative my-4 flex">
      <div className="absolute left-[5%] right-[5%] top-4 h-1 bg-slate-200" />
      {STAGES.map((name, s) => {
        const st = stageState(plan, s, versionB);
        return (
          <div key={s} className="relative flex-1 text-center" title={`שלב ${s}: ${name} · ${LABEL[st]}`}>
            <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full border-4 border-white font-bold text-white ${BG[st]}`}>{s}</span>
            <small className="mt-1 block text-[10px]">{name}</small>
          </div>
        );
      })}
    </div>
  );
}
