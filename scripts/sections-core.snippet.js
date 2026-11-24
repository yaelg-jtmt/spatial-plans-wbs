/* sections: התאמת פרויקט לרחוב (לוגיקה טהורה, בלי DOM) */
const SX_STREET_SERVICES = ['שדרוג רחוב', 'שדרוג רחובות', 'שביל אופניים', 'נתיב תחבורה ציבורית', 'רחוב חדש', 'תנועה משולבת'];
const sxNorm = s => String(s || '').replace(/[־–—\-_"'׳״`]/g, ' ').replace(/[^\u0590-\u05FFa-zA-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
// כינוי נמצא בטקסט כרצף מילים שלמות. מילה ראשונה יכולה לקבל אות יחס (ב, ל, מ, ו, כ, ש, ה): "ברחוב המור", "מהמור".
// כינוי שמתחיל ב-ה' ("הצוף") נמצא גם כשאות יחס ל/ב/כ מחליפה אותה: "לצוף", "בצוף".
// כינוי שבא מיד אחרי "צומת" לא נחשב: "צומת הנגבי/דב יוסף" הוא הצומת ולא הרחוב.
function sxHasAlias(text, alias) {
  const t = sxNorm(text).split(' '), a = sxNorm(alias).split(' ');
  if (!t[0] || !a[0]) return false;
  const forms = [{ w: a, dropped: false }];
  if (a[0].length >= 4 && a[0][0] === 'ה') forms.push({ w: [a[0].slice(1), ...a.slice(1)], dropped: true });
  for (let i = 0; i < t.length; i++) {
    if (i > 0 && /צומת$/.test(t[i - 1])) continue;
    for (const { w, dropped } of forms) {
      if (i + w.length > t.length) continue;
      let ok = true;
      for (let j = 0; j < w.length && ok; j++) {
        const tk = t[i + j], ak = w[j];
        if (j > 0) ok = tk === ak;
        else if (dropped) ok = tk.length === ak.length + 1 && tk.endsWith(ak) && /^[לבכ]/.test(tk);
        else ok = tk === ak || (tk.length > ak.length && tk.length <= ak.length + 2 && tk.endsWith(ak) && /^[ובלמכשה]+$/.test(tk.slice(0, tk.length - ak.length)));
      }
      if (ok) return true;
    }
  }
  return false;
}
// codes (אם הוגדרו לרחוב) הם הקובעים. אחרת: שירות מסוג רחוב + כינוי בשם הפרויקט בלבד.
// תיאור הפרויקט לא משמש להתאמה: הוא מזכיר רחובות סמוכים כנקודות ייחוס ("הנגבי - מחלף דב יוסף") וגרם להתאמות שגויות.
function sxMatch(manifest, p) {
  const plan = sxNorm(p.plan), out = [];
  for (const st of (manifest && manifest.streets) || []) {
    if (sxNorm(st.plan) !== plan) continue;
    if (st.codes && st.codes.length) { if (p.code && st.codes.map(String).includes(String(p.code))) out.push(st); continue; }
    if (!SX_STREET_SERVICES.includes(p.service)) continue;
    if ((st.aliases || []).some(a => sxHasAlias(p.name || '', a))) out.push(st);
  }
  return out;
}
