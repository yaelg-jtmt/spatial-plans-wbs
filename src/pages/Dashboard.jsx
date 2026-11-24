import { useEffect, useRef, useState } from "react";
import PlanPicker from "../components/PlanPicker.jsx";
import {
  dashboardUrl,
  isReadyMessage,
  planFromDashboardMessage,
  selectPlanMessage,
  unknownPlanFromDashboardMessage,
} from "../lib/dashboardSync.js";

const DASH_PATH = `${import.meta.env.BASE_URL}dashboard/index.html`;

// הדאשבורד המקורי רץ בתוך iframe (אותו origin). public/dashboard/bridge.js
// מסנכרן את בורר התכנית בשני הכיוונים באמצעות postMessage.
export default function Dashboard({ plans, plan, setPlan }) {
  const current = plans.find((p) => p.id === plan);
  const frameRef = useRef(null);
  const [fileReady, setFileReady] = useState(null); // null=בודק
  const [unknownPlan, setUnknownPlan] = useState(null);
  const [initialSrc] = useState(() => dashboardUrl(DASH_PATH, current?.name, current?.aliases));

  useEffect(() => {
    fetch(DASH_PATH)
      .then((r) => r.text())
      .then((t) => setFileReady(t.includes("planSel")))
      .catch(() => setFileReady(false));
  }, []);

  const post = () => {
    if (current) frameRef.current?.contentWindow?.postMessage(selectPlanMessage(current.name, current.aliases), "*");
  };

  // דאשבורד -> האתר (כולל "ready" אחרי טעינה, כדי לא לאבד הודעה שנשלחה מוקדם)
  useEffect(() => {
    const onMsg = (e) => {
      if (e.source !== frameRef.current?.contentWindow) return;
      if (isReadyMessage(e.data)) return post();
      setUnknownPlan(unknownPlanFromDashboardMessage(e.data, plans));
      const next = planFromDashboardMessage(e.data, plans, plan);
      if (next) setPlan(next);
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  });

  // האתר -> דאשבורד
  useEffect(() => {
    if (fileReady) post();
    setUnknownPlan(null);
  }, [current, fileReady]);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">דאשבורד מרחבי</h1>
          <p className="text-sm text-slate-500">בחירת תכנית כאן משותפת גם ל-WBS ולגאנט.</p>
        </div>
        <PlanPicker plans={plans} plan={plan} onChange={setPlan} />
      </div>

      {unknownPlan && (
        <div className="mb-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm">
          בדאשבורד נבחר "<b>{unknownPlan}</b>", שאינו אחת מ-12 התכניות באתר. ה-WBS והגאנט ממשיכים להציג את{" "}
          <b>{current?.name}</b>.
        </div>
      )}

      {fileReady === false && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm">
          <b>קובץ הדאשבורד עדיין לא הוכן.</b>
          <p className="mt-1">
            מריצים: <code dir="ltr">node scripts/prepare-dashboard.mjs "&lt;path&gt;/דאשבורד_תכניות_מרחביות_G5.html"</code>
          </p>
        </div>
      )}

      {fileReady !== false && (
        <iframe
          ref={frameRef}
          title="דאשבורד תכניות מרחביות"
          src={initialSrc}
          className="h-[78vh] w-full rounded-2xl border bg-white"
        />
      )}
    </>
  );
}
