#!/usr/bin/env node
// מחיל קובץ עדכון שבועי על נתוני האתר, אחרי בדיקות. אותו מבנה גם לייצוא מהאתר ("ייצוא עדכונים") וגם לעדכון שנכתב ידנית.
//   node scripts/apply-weekly-update.mjs <update.json> [--date YYYY-MM-DD] [--dry]
//
// מבנה הקובץ:
// { "date": "2026-12-01",
//   "plans": { "TA": {
//       "progress": 58, "status": "בתהליך", "blocker": "...", "next": "...", "qa": "...", "target": "Q1/2027", "owner": "רפרנט מקצועי",
//       "active": [2,3], "lead": 2, "completed": false,
//       "rows": { "2.1": { "status": "הושלם", "decision": "נדרש", "owner": "...", "requirement": "...", "note": "...", "products": ["..."] } } } } }
// שדות התכנית נכנסים ל-plans.json (הפורטפוליו), ו-rows ל-wbs-status.json (ה-WBS). null בשורה מוחק את העדכון של אותה שורה.
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { DECISIONS, OWNERS, REQUIREMENTS, STATUSES } from "../src/lib/wbsLogic.js";

const PLAN_STATUSES = ["הושלם", "בתהליך", "ממתין", "מעוכב"];
const QA = ["טרם נבדק", "דורש בדיקה", "נמצא פער", "תקין"];
const ROW_FIELDS = ["status", "decision", "owner", "requirement", "note", "products"];
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

export function applyUpdate({ update, plans, status, template, today }) {
  const errors = [], changes = [], warnings = [];
  const date = update.date || today;
  if (!isDate(date)) errors.push(`התאריך "${date}" אינו בפורמט YYYY-MM-DD`);
  const ids = new Set(plans.map((p) => p.id)), rowIds = new Set(template.map((r) => r.id));
  const nextPlans = JSON.parse(JSON.stringify(plans)), nextStatus = JSON.parse(JSON.stringify(status));
  nextStatus.plans = nextStatus.plans || {};
  const stamp = isDate(date) ? new Date(date + "T12:00:00.000Z").toISOString() : null;

  for (const [pid, u] of Object.entries(update.plans || {})) {
    if (!ids.has(pid)) { errors.push(`תכנית לא מוכרת: ${pid}`); continue; }
    const p = nextPlans.find((x) => x.id === pid);
    const set = (k, v, ok = true, why = "") => {
      if (!ok) { errors.push(`${pid}.${k}: ${why}`); return; }
      if (JSON.stringify(p[k]) !== JSON.stringify(v)) { changes.push(`${p.name}: ${k} ${JSON.stringify(p[k])} -> ${JSON.stringify(v)}`); p[k] = v; }
    };
    if ("progress" in u) set("progress", u.progress, Number.isInteger(u.progress) && u.progress >= 0 && u.progress <= 100, "אחוז שלם בין 0 ל-100");
    if ("status" in u) set("status", u.status, PLAN_STATUSES.includes(u.status), `אחד מ: ${PLAN_STATUSES.join(", ")}`);
    if ("qa" in u) set("qa", u.qa, QA.includes(u.qa), `אחד מ: ${QA.join(", ")}`);
    if ("owner" in u) set("owner", u.owner, OWNERS.includes(u.owner), `אחד מ: ${OWNERS.join(", ")}`);
    for (const k of ["blocker", "next", "target"]) if (k in u) set(k, u[k], typeof u[k] === "string" && u[k].trim() !== "", "טקסט לא ריק");
    if ("active" in u) set("active", u.active, Array.isArray(u.active) && u.active.every((s) => Number.isInteger(s) && s >= 0 && s <= 6) && new Set(u.active).size === u.active.length, "מערך של שלבים 0–6 ללא כפילות");
    if ("lead" in u) set("lead", u.lead, Number.isInteger(u.lead) && u.lead >= 0 && u.lead <= 6, "שלב 0–6");
    if ("completed" in u) {
      if (u.completed === true) { set("completed", true); set("progress", 100); set("status", "הושלם"); }
      else if (u.completed === false) { if (p.completed) { changes.push(`${p.name}: completed true -> false`); delete p.completed; } }
      else errors.push(`${pid}.completed: true או false`);
    }
    if (u.lead !== undefined && Array.isArray(p.active) && !p.active.includes(p.lead) && p.lead !== Math.max(...p.active, -1) && !p.completed)
      warnings.push(`${p.name}: השלב המוביל (${p.lead}) אינו בין השלבים הפעילים (${p.active.join(",")}). בדקי שזה מכוון`);
    if (p.progress === 100 && !p.completed && !("completed" in u)) warnings.push(`${p.name}: אחוז 100 בלי completed:true. התכנית לא תסומן כהושלמה`);
    if (p.completed && p.progress !== 100) warnings.push(`${p.name}: תכנית שהושלמה צריכה להיות 100%`);

    for (const [rid, patch] of Object.entries(u.rows || {})) {
      if (!rowIds.has(rid)) { errors.push(`${pid}: שורת WBS לא קיימת: ${rid}`); continue; }
      const rows = ((nextStatus.plans[pid] = nextStatus.plans[pid] || {}).rows = nextStatus.plans[pid].rows || {});
      if (patch === null) { if (rows[rid]) { changes.push(`${p.name} ${rid}: עדכון נמחק`); delete rows[rid]; } continue; }
      const next = { ...(rows[rid] || {}) }; let touched = false;
      for (const k of Object.keys(patch)) {
        if (k === "updated") continue;
        if (!ROW_FIELDS.includes(k)) { errors.push(`${pid} ${rid}: שדה לא מוכר "${k}"`); continue; }
        const v = patch[k];
        const bad = (k === "status" && !STATUSES.includes(v)) ? `סטטוס: ${STATUSES.join(", ")}` : (k === "decision" && !DECISIONS.includes(v)) ? `החלטה: ${DECISIONS.join(", ")}` :
          (k === "owner" && !OWNERS.includes(v)) ? `אחראי: ${OWNERS.join(", ")}` : (k === "requirement" && !REQUIREMENTS.includes(v) && !template.some((r) => r.id === rid && r.requirement === v)) ? `סוג: ${REQUIREMENTS.join(", ")}` :
          (k === "products" && !(Array.isArray(v) && v.every((x) => typeof x === "string"))) ? "products: מערך של טקסטים" : (k === "note" && typeof v !== "string") ? "note: טקסט" : "";
        if (bad) { errors.push(`${pid} ${rid}.${k}="${v}": ${bad}`); continue; }
        if (JSON.stringify(next[k]) !== JSON.stringify(v)) { changes.push(`${p.name} ${rid}: ${k} ${JSON.stringify(next[k] ?? "—")} -> ${JSON.stringify(v)}`); next[k] = v; touched = true; }
      }
      if (touched && stamp) { next.updated = stamp; rows[rid] = next; }
      else if (touched) rows[rid] = next;
    }
    if (nextStatus.plans[pid] && !Object.keys(nextStatus.plans[pid].rows || {}).length) delete nextStatus.plans[pid];
  }
  if (isDate(date)) nextStatus.updated = date;
  return { errors, warnings, changes, plans: nextPlans, status: nextStatus, date };
}

if (process.argv[1] && import.meta.url === pathToFileURL(new URL(process.argv[1], "file://" + process.cwd() + "/").pathname).href) {
  const args = process.argv.slice(2), dry = args.includes("--dry");
  const di = args.indexOf("--date"), dateArg = di >= 0 ? args.splice(di, 2)[1] : null;
  const file = args.find((a) => !a.startsWith("--"));
  if (!file) { console.error("שימוש: node scripts/apply-weekly-update.mjs <update.json> [--date YYYY-MM-DD] [--dry]"); process.exit(1); }
  const read = (f) => JSON.parse(readFileSync(f, "utf8"));
  const update = read(file); if (dateArg) update.date = dateArg;
  const today = new Date().toISOString().slice(0, 10);
  const r = applyUpdate({ update, plans: read("public/data/plans.json"), status: read("public/data/wbs-status.json"), template: read("public/data/wbs-template.json"), today });
  r.warnings.forEach((w) => console.log("⚠️ " + w));
  if (r.errors.length) { console.error("\n❌ העדכון לא הוחל:\n" + r.errors.map((e) => " - " + e).join("\n")); process.exit(1); }
  console.log(`\n${r.changes.length} שינויים (תאריך העדכון: ${r.date}):\n` + (r.changes.map((c) => " · " + c).join("\n") || " (אין שינויים)"));
  if (dry) { console.log("\n(הרצה יבשה: לא נכתב דבר)"); process.exit(0); }
  writeFileSync("public/data/plans.json", JSON.stringify(r.plans, null, 2) + "\n");
  writeFileSync("public/data/wbs-status.json", JSON.stringify(r.status, null, 2) + "\n");
  console.log("\n✅ עודכנו public/data/plans.json ו-public/data/wbs-status.json");
}
