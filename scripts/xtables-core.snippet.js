/* xtables: בניית שורות לטבלאות הייצוא (לוגיקה טהורה, בלי DOM). נבדקת ב-Node ורצה בדאשבורד כמו שהיא. */
const XT_PLAN_HEAD = ['מרחב', 'מספר תכנית', 'שם תכנית', 'סטטוס', 'סמכות', 'שינוי ביח"ד', '% בתוך המרחב (הערכה)', 'קישור למבא\u05F4ת'];
const XT_PLAN_WIDTHS = [20, 16, 62, 26, 22, 12, 16, 16];
const XT_PROJ_HEAD = ['מרחב התב"ע', 'מספר תב"ע', 'שם תב"ע', 'סטטוס תב"ע', 'סמכות', 'תכנית (פרויקט)', 'מס\' / קוד פרויקט', 'שם פרויקט', 'סוג שירות', 'חומש', 'סטטוס פרויקט', 'תלות בתכנית', 'נק\' חפיפה', '% מהפרויקט בתוך התב"ע (הערכה)', 'סטטוס הקישור', 'קישור למבא\u05F4ת'];
const XT_PROJ_WIDTHS = [18, 16, 46, 24, 22, 18, 14, 40, 20, 14, 18, 16, 10, 16, 16, 16];

// טבלת תב"עות: אותן עמודות ואותו מיון כמו "ייצוא תב"עות לאקסל" הקיים. d: { authOf, rank, hasUrl }
function xtPlanRows(recs, d) {
  return recs.slice()
    .sort((a, b) => String(a.space).localeCompare(String(b.space), 'he') || d.rank(a.station) - d.rank(b.station) || String(a.num).localeCompare(String(b.num)))
    .map(r => [r.space, r.num, r.name, r.station || '(ללא סטטוס)', d.authOf(r), r.units != null ? r.units : '', r.pct != null ? Math.round(r.pct * 100) : '',
      d.hasUrl(r.url) ? { link: r.url, text: 'פתיחה במבא\u05F4ת' } : '']);
}

// טבלת פרויקטים שעוברים בתחום תב"ע. אותו חישוב חפיפה כמו xpCandidates בדאשבורד: נקודות הפרויקט (קודקודים ואמצעי קטעים)
// שנמצאות בתוך הפוליגון. d: { pip, ringsOf, box, ptsOf, isBig, links, authOf, rank, hasUrl, skipBig }
//  skipBig: תב"עות שמכסות את רוב המרחב לא נכללות (כמו בחלונית הפרויקט), אלא אם הקישור אושר ידנית. כשמייצאים תב"ע אחת בוחרים אותה במפורש, ולכן שם false.
function xtProjectRows(plans, projects, d) {
  const prep = projects.map(p => {
    const pts = d.ptsOf(p) || []; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const q of pts) { if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0]; if (q[1] < y0) y0 = q[1]; if (q[1] > y1) y1 = q[1]; }
    return { p, pts, bb: { x0, y0, x1, y1 } };
  });
  const out = [];
  for (const r of plans) {
    if (!r.geom) continue;
    const rings = d.ringsOf(r.geom), bb = r._bb || (r._bb = d.box(rings));
    const big = d.skipBig && d.isBig(r);
    for (const z of prep) {
      const decided = (d.links[z.p.key] || {})[r.num];
      if (big && decided !== 'yes') continue;
      let hits = 0;
      if (z.pts.length && z.bb.x1 >= bb.x0 && z.bb.x0 <= bb.x1 && z.bb.y1 >= bb.y0 && z.bb.y0 <= bb.y1)
        for (const q of z.pts) if (q[0] >= bb.x0 && q[0] <= bb.x1 && q[1] >= bb.y0 && q[1] <= bb.y1 && d.pip(q[0], q[1], rings)) hits++;
      if (!hits && decided !== 'yes') continue;
      out.push({ r, p: z.p, hits, total: z.pts.length, decided });
    }
  }
  out.sort((a, b) => d.rank(a.r.station) - d.rank(b.r.station) || String(a.r.num).localeCompare(String(b.r.num)) || (b.decided === 'yes') - (a.decided === 'yes') || b.hits - a.hits
    || String(a.p.plan).localeCompare(String(b.p.plan), 'he') || String(a.p.name).localeCompare(String(b.p.name), 'he'));
  return out.map(({ r, p, hits, total, decided }) => [r.space, r.num, r.name, r.station || '(ללא סטטוס)', d.authOf(r), p.plan, p.code || (p.num !== null && p.num !== undefined ? p.num : ''), p.name, p.service, p.quint, p.status, p.dep,
    hits, total ? Math.round(100 * hits / total) : '', decided === 'yes' ? 'אושר' : decided === 'no' ? 'נדחה' : 'מועמד אוטומטי', d.hasUrl(r.url) ? { link: r.url, text: 'פתיחה במבא\u05F4ת' } : '']);
}
