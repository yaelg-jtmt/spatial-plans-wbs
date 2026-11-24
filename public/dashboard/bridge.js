/* גשר בין הדאשבורד המקורי לאתר המאוחד. מוסיפים לפני </body>:  <script src="bridge.js"></script>
   (scripts/prepare-dashboard.mjs עושה זאת אוטומטית)
   - קורא ?plan=<שם>&alias=<כינוי>... ובוחר את התכנית ב-#planSel (שם באתר + השמות שבהם היא מופיעה בדאשבורד)
   - מקשיב להודעות מהאתר (select-plan)
   - מדווח לאתר כשהמשתמש מחליף תכנית בדאשבורד (plan-selected), ו-ready אחרי טעינה
   - אחרי כל בנייה מחדש של רשימת התכניות (fillPlanSelect) מחזיר את התכנית שנבחרה, אלא אם המשתמש בחר "כל התכניות"
   הדאשבורד המקורי מאזין ל-change על #planSel (מאומת בקוד), ולכן dispatchEvent מפעיל את כל הלוגיקה שלו. */
(function () {
  // אותו נרמול כמו src/lib/names.js
  var norm = function (s) { return String(s || "").replace(/["'׳״`\s\-–—_]/g, ""); };
  var qs = new URLSearchParams(location.search);
  // wanted = רשימת שמות מקבילים של אותה תכנית (שם באתר + כינויים בדאשבורד)
  var wanted = [qs.get("plan")].concat(qs.getAll("alias")).filter(Boolean);
  var applying = false;
  window.__spatialBridge = { version: 4 };

  function select() { return document.getElementById("planSel"); }
  function post(msg) {
    if (window.parent && window.parent !== window) window.parent.postMessage(msg, "*");
  }

  function findOption(s, names) {
    var ws = names.map(norm).filter(Boolean), i, j, o;
    for (i = 0; i < s.options.length; i++) {            // התאמה מדויקת לאחד השמות קודם
      o = s.options[i];
      if (o.value !== "*" && ws.indexOf(norm(o.text)) > -1) return o;
    }
    for (i = 0; i < s.options.length; i++) {            // ואז התאמה חלקית
      o = s.options[i];
      var t = norm(o.text);
      if (o.value === "*" || t.length < 4) continue;
      for (j = 0; j < ws.length; j++) {
        if (ws[j].length >= 4 && (t.indexOf(ws[j]) > -1 || ws[j].indexOf(t) > -1)) return o;
      }
    }
    return null;
  }

  function apply(names) {
    var s = select();
    if (!s) return false;
    var o = findOption(s, names);
    if (!o) return false;
    if (s.value !== o.value) {
      applying = true;
      try {
        s.value = o.value;
        s.dispatchEvent(new Event("change", { bubbles: true }));
      } finally { applying = false; }
    }
    return true;
  }

  function init() {
    var s = select();
    if (!s) return;
    if (wanted.length) apply(wanted);
    // האפשרויות נטענות ומתחדשות אסינכרונית (שכבות, Xplan, Drive). בכל חידוש מחזירים את הבחירה.
    new MutationObserver(function () {
      if (!applying && wanted.length) apply(wanted);
    }).observe(s, { childList: true });
    s.addEventListener("change", function () {
      if (applying) return;
      var o = s.options[s.selectedIndex];
      if (!o) return;
      if (o.value === "*") { wanted = []; return; }   // המשתמש בחר "כל התכניות": מפסיקים להחזיר
      wanted = [o.text];
      post({ source: "spatial-plans-dashboard", type: "plan-selected", name: o.text });
    });
    post({ source: "spatial-plans-dashboard", type: "ready" });
  }

  window.addEventListener("message", function (e) {
    var d = e.data;
    if (d && d.source === "spatial-plans-hub" && d.type === "select-plan") {
      wanted = [d.name].concat(d.aliases || []);
      apply(wanted);
    }
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
