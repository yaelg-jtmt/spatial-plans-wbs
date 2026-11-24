// npm run test:sync  (Node 18+, ללא תלויות)
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { findPlanByName, normName } from "../src/lib/names.js";
import {
  dashboardUrl, isReadyMessage, planFromDashboardMessage, selectPlanMessage,
  unknownPlanFromDashboardMessage, SOURCE_DASH, SOURCE_HUB,
} from "../src/lib/dashboardSync.js";

const plans = JSON.parse(readFileSync(new URL("../public/data/plans.json", import.meta.url), "utf8"));
const byId = Object.fromEntries(plans.map((p) => [p.id, p]));
const variants = (name) => [name, name.replace(/–/g, "-"), name.replace(/–/g, " - "), name.replace(/–/g, "—"), name.replace(/\s+/g, "  "), `"${name}"`];

test("שמות: כל 12 התכניות מותאמות בכל וריאציית כתיבה", () => {
  assert.equal(plans.length, 12);
  for (const p of plans) for (const v of variants(p.name)) assert.equal(findPlanByName(plans, v)?.id, p.id, `"${v}"`);
});
test("שמות: אין התאמות שגויות בין תכניות דומות", () => {
  assert.equal(findPlanByName(plans, "צור הדסה").id, "TH");
  assert.equal(findPlanByName(plans, "צור באהר - אום טובא").id, "ZB");
  assert.equal(findPlanByName(plans, "גבעת זאב").id, "GZ");
  assert.equal(findPlanByName(plans, "פסגת זאב - נווה יעקב").id, "PN");
  assert.equal(findPlanByName(plans, "גבעה צרפתית - עיסאוויה").id, "FI");
});
test("שמות: ערכים שלא אמורים להתאים", () => {
  for (const v of ["", null, undefined, "כל התכניות", "תכנית שלא קיימת", "רמ", "*"]) assert.equal(findPlanByName(plans, v), null, `"${v}"`);
});
test("שמות: נרמול הוא idempotent", () => {
  for (const p of plans) assert.equal(normName(normName(p.name)), normName(p.name));
});
test("פרוטוקול: plan-selected מהדאשבורד עובר לתכנית הנכונה", () => {
  assert.equal(planFromDashboardMessage({ source: SOURCE_DASH, type: "plan-selected", name: "צור באהר - אום טובא" }, plans, "GI"), "ZB");
});
test("פרוטוקול: אותה תכנית כבר נבחרה -> אין שינוי (מונע לולאה)", () => {
  assert.equal(planFromDashboardMessage({ source: SOURCE_DASH, type: "plan-selected", name: byId.GI.name }, plans, "GI"), null);
});
test("פרוטוקול: הודעות זרות, חלקיות או לא מוכרות מתעלמים", () => {
  assert.equal(planFromDashboardMessage(null, plans, "GI"), null);
  assert.equal(planFromDashboardMessage({}, plans, "GI"), null);
  assert.equal(planFromDashboardMessage({ source: "other", type: "plan-selected", name: "גילה" }, plans, "AH"), null);
  assert.equal(planFromDashboardMessage({ source: SOURCE_DASH, type: "ready" }, plans, "AH"), null);
  assert.equal(planFromDashboardMessage({ source: SOURCE_DASH, type: "plan-selected", name: "לא קיימת" }, plans, "AH"), null);
});
test("פרוטוקול: ready, select-plan וכתובת ה-iframe", () => {
  assert.ok(isReadyMessage({ source: SOURCE_DASH, type: "ready" }));
  assert.ok(!isReadyMessage({ source: SOURCE_HUB, type: "ready" }));
  assert.deepEqual(selectPlanMessage("גילה"), { source: SOURCE_HUB, type: "select-plan", name: "גילה", aliases: [] });
  assert.deepEqual(selectPlanMessage("צור באהר–אום טובא", ["צור באהר"]).aliases, ["צור באהר"]);
  assert.equal(new URL(dashboardUrl("./dashboard/index.html", "צור באהר–אום טובא"), "http://x/").searchParams.get("plan"), "צור באהר–אום טובא");
  const u = new URL(dashboardUrl("./d.html", "צור באהר–אום טובא", ["צור באהר"]), "http://x/");
  assert.deepEqual(u.searchParams.getAll("alias"), ["צור באהר"]);
});
test("מרחב מהדאשבורד שאינו ב-12 התכניות: לא מחליף תכנית, אבל מדווח", () => {
  const msg = { source: SOURCE_DASH, type: "plan-selected", name: "מרכז העיר" };
  assert.equal(planFromDashboardMessage(msg, plans, "GI"), null);
  assert.equal(unknownPlanFromDashboardMessage(msg, plans), "מרכז העיר");
});
test("תכנית מוכרת או הודעות אחרות לא מדווחות כלא מוכרות", () => {
  assert.equal(unknownPlanFromDashboardMessage({ source: SOURCE_DASH, type: "plan-selected", name: "גילה" }, plans), null);
  assert.equal(unknownPlanFromDashboardMessage({ source: SOURCE_DASH, type: "ready" }, plans), null);
  assert.equal(unknownPlanFromDashboardMessage({ source: SOURCE_DASH, type: "plan-selected", name: "  " }, plans), null);
  assert.equal(unknownPlanFromDashboardMessage(null, plans), null);
});
test("כינויים: השמות הקצרים של הדאשבורד מותאמים לתכנית הנכונה", () => {
  assert.equal(findPlanByName(plans, "צור באהר").id, "ZB");
  assert.equal(findPlanByName(plans, "פסגת זאב").id, "PN");
  assert.equal(findPlanByName(plans, "הגבעה הצרפתית").id, "FI");
  assert.equal(findPlanByName(plans, "צור הדסה").id, "TH");
  assert.equal(findPlanByName(plans, "גבעת זאב").id, "GZ");
});
test("כינויים: הודעה מהדאשבורד בשם קצר מעבירה תכנית ולא מדווחת כלא מוכרת", () => {
  for (const [alias, id] of [["צור באהר", "ZB"], ["פסגת זאב", "PN"], ["הגבעה הצרפתית", "FI"]]) {
    const msg = { source: SOURCE_DASH, type: "plan-selected", name: alias };
    assert.equal(planFromDashboardMessage(msg, plans, "GI"), id);
    assert.equal(unknownPlanFromDashboardMessage(msg, plans), null);
  }
});
test("עקביות: הנרמול ב-bridge.js זהה לנרמול באתר", () => {
  const bridge = readFileSync(new URL("../public/dashboard/bridge.js", import.meta.url), "utf8");
  const m = bridge.match(/var norm = function \(s\) \{ return String\(s \|\| ""\)\.replace\((\/.*?\/g), ""\); \};/);
  assert.ok(m, "לא נמצאה פונקציית norm ב-bridge.js");
  const re = eval(m[1]);
  for (const p of plans) for (const v of variants(p.name)) assert.equal(String(v).replace(re, ""), normName(v));
});
test("bridge.js: שמות ההודעות תואמים לפרוטוקול באתר", () => {
  const bridge = readFileSync(new URL("../public/dashboard/bridge.js", import.meta.url), "utf8");
  for (const s of [SOURCE_DASH, SOURCE_HUB, "plan-selected", "select-plan", '"ready"', "getAll(\"alias\")"]) assert.ok(bridge.includes(s), s);
});
