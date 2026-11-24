// פרוטוקול ההודעות בין האתר (iframe parent) לדאשבורד. פונקציות טהורות, כדי שאפשר לבדוק אותן
// ב-Node (tests/) ובדפדפן (tools/sync-test.html) באותו קוד שרץ באתר.
import { findPlanByName } from "./names.js";

export const SOURCE_DASH = "spatial-plans-dashboard";
export const SOURCE_HUB = "spatial-plans-hub";

export const dashboardUrl = (path, planName, aliases = []) =>
  `${path}?plan=${encodeURIComponent(planName || "")}` +
  aliases.map((a) => `&alias=${encodeURIComponent(a)}`).join("");

// aliases: שמות חלופיים של אותה תכנית בדאשבורד (ראו plans.json)
export const selectPlanMessage = (name, aliases = []) => ({ source: SOURCE_HUB, type: "select-plan", name, aliases });

export const isReadyMessage = (d) => !!d && d.source === SOURCE_DASH && d.type === "ready";

// מחזיר את ה-id של התכנית שהאתר צריך לעבור אליה, או null אם אין מה לעשות.
export function planFromDashboardMessage(data, plans, currentId) {
  if (!data || data.source !== SOURCE_DASH || data.type !== "plan-selected") return null;
  const match = findPlanByName(plans, data.name);
  return match && match.id !== currentId ? match.id : null;
}

// הדאשבורד כולל את כל מרחבי Xplan, והאתר רק 12 תכניות. אם נבחר מרחב שאינו ברשימה,
// מחזירים את שמו כדי שהאתר יציג הודעה, ולא יישאר בשקט על תכנית אחרת.
export function unknownPlanFromDashboardMessage(data, plans) {
  if (!data || data.source !== SOURCE_DASH || data.type !== "plan-selected") return null;
  const name = String(data.name || "").trim();
  return name && !findPlanByName(plans, name) ? name : null;
}
