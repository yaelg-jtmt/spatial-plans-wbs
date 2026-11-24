/* xtables: ממשק להורדת טבלאות (תב"עות לפי מרחב, ופרויקטים שעוברים בתחום תב"ע). רץ בתוך ה-scope של הדאשבורד אחרי xpWire(). */
const XT = { touched: false, seq: 0, plans: [] };
const xtDeps = extra => Object.assign({ pip: xpPip, ringsOf: xpPlanRings, box: xpBox, ptsOf: xpProjectPts, isBig: xpBig, links: xp.links, authOf: r => xpAuthOf(r), rank: xpRank, hasUrl: xpHasUrl }, extra || {});
const xtStatus = (t, bad) => { const s = $('#xtStatus'); if (s) { s.textContent = t; s.style.color = bad ? 'var(--warn)' : ''; } };
const xtDate = () => new Date().toISOString().slice(0, 10);
const xtFile = s => String(s).replace(/[\\/:*?"<>|\s]+/g, '_').replace(/^_+|_+$/g, '');
const xtSleep = ms => new Promise(r => setTimeout(r, ms));
// טוען מרחב אם צריך, ומחכה לסיום. מחזיר true אם הרשומות נטענו.
async function xtEnsure(sp) {
  if (xp.records.has(sp.id)) return true;
  if (!xp.loading.has(sp.id)) { xp.failed.delete(sp.id); xpLoad(sp); }
  const t0 = Date.now();
  while ((xp.loading.has(sp.id) || (!xp.records.has(sp.id) && !xp.failed.has(sp.id))) && Date.now() - t0 < 180000) await xtSleep(150);
  return xp.records.has(sp.id);
}
async function xtEnsureMany(list) {
  const loaded = [], failed = []; let next = 0, done = 0;
  const work = async () => { while (next < list.length) { const sp = list[next++]; const ok = await xtEnsure(sp); (ok ? loaded : failed).push(sp); done++; if (list.length > 1) xtStatus('טוען תב"עות… (' + done + ' מתוך ' + list.length + ' מרחבים)'); } };
  await Promise.all(Array.from({ length: Math.min(XP_MAX_PARALLEL, list.length) }, work));
  return { loaded: list.filter(s => loaded.includes(s)), failed };
}
const xtFailText = (failed) => failed.map(s => s.name + (xp.failed.get(s.id) ? ' (' + xp.failed.get(s.id) + ')' : '')).join(', ');
function xtSpaceOfSelect() { const v = $('#xtSpace').value; if (!v || v === '*') return null; try { return xpSpaceOf(v); } catch (e) { return null; } }

async function xtExportPlansBySpace() {
  const v = $('#xtSpace').value;
  if (!v) { xtStatus('בחרי מרחב, או "כל המרחבים".', true); return; }
  let list; try { xpInitSpaces(); list = v === '*' ? xp.spaces.slice() : [xpSpaceOf(v)].filter(Boolean); } catch (e) { xtStatus('לא ניתן להכין את גבולות המרחבים: ' + e.message, true); return; }
  if (!list.length) { xtStatus('לא נמצא מרחב בשם "' + v + '".', true); return; }
  xtStatus('טוען תב"עות…');
  const ok = await xtEnsureMany(list), noFilter = $('#xtAll').checked;
  let recs = [], total = 0;
  for (const sp of ok.loaded) { const all = xp.records.get(sp.id) || []; total += all.length; recs = recs.concat(noFilter ? all : xpStage([sp], 4)); }
  if (!recs.length) { xtStatus(ok.failed.length ? 'הטעינה נכשלה: ' + xtFailText(ok.failed) : total ? 'כל ' + total + ' התב"עות מוסתרות בסינון הנוכחי. אפשר לסמן "ללא סינון".' : 'לא נמצאו תב"עות במרחב.', true); return; }
  const rows = xtPlanRows(recs, xtDeps());
  xpSave(await xpXlsx(XT_PLAN_HEAD, rows, XT_PLAN_WIDTHS), 'תכניות_מקודמות_' + (v === '*' ? 'כל_המרחבים' : xtFile(list[0].name)) + '_' + xtDate() + '.xlsx');
  const hidden = total - recs.length;
  xtStatus('יוצאו ' + rows.length + ' תב"עות' + (hidden ? '. ' + hidden + ' מוסתרות בסינון הנוכחי (לסימון "ללא סינון" יוצאות כולן)' : '') + (ok.failed.length ? '. לא נטענו: ' + xtFailText(ok.failed) : '') + '.', ok.failed.length > 0);
}

async function xtFillPlans() {
  const sel = $('#xtPlan'), seq = ++XT.seq; if (!sel) return;
  const v = $('#xtSpace').value;
  const reset = t => { sel.replaceChildren(el('option', { value: '', text: t })); XT.plans = []; };
  if (!v) { reset('בחרי מרחב…'); return; }
  if (v === '*') { reset('בחרי מרחב אחד (לא "כל המרחבים")'); return; }
  const sp = xtSpaceOfSelect(); if (!sp) { reset('לא נמצא מרחב'); return; }
  reset('טוען תב"עות…');
  const ok = await xtEnsure(sp); if (seq !== XT.seq) return;
  if (!ok) { reset('הטעינה נכשלה'); xtStatus(xp.failed.get(sp.id) || 'הטעינה נכשלה.', true); return; }
  const recs = (xp.records.get(sp.id) || []).slice().sort((a, b) => xpRank(a.station) - xpRank(b.station) || String(a.num).localeCompare(String(b.num)));
  XT.plans = recs;
  sel.replaceChildren(el('option', { value: '', text: 'בחרי תב"ע…' }), el('option', { value: '*', text: 'כל התב"עות במרחב (' + recs.length + ')' }),
    ...recs.map((r, i) => el('option', { value: String(i), text: r.num + ' · ' + String(r.name || '').slice(0, 70) + ' · ' + (r.station || 'ללא סטטוס') })));
}

// rec: תב"ע בודדת (מחלון התב"ע במפה). בלי rec: לפי הבחירה בסרגל.
async function xtExportProjects(rec) {
  let plans, label, spaceName, multi = false;
  try {
    if (rec) { plans = [rec]; label = rec.num; spaceName = rec.space; }
    else {
      const sp = xtSpaceOfSelect(); if (!sp) { xtStatus('בחרי מרחב אחד.', true); return; }
      const pv = $('#xtPlan').value; if (pv === '') { xtStatus('בחרי תב"ע, או "כל התב"עות במרחב".', true); return; }
      xtStatus('טוען תב"עות…');
      if (!(await xtEnsure(sp))) { xtStatus(xp.failed.get(sp.id) || 'הטעינה נכשלה.', true); return; }
      const every = xp.records.get(sp.id) || [];
      if (pv === '*') { multi = true; plans = $('#xtAll').checked ? every : xpStage([sp], 4); label = 'כל_התבעות_' + xtFile(sp.name); }
      else { plans = XT.plans[+pv] ? [XT.plans[+pv]] : []; label = plans[0] ? plans[0].num : ''; }
      spaceName = sp.name;
    }
  } catch (e) { xtStatus('שגיאה: ' + e.message, true); return; }
  if (!plans.length) { xtStatus('אין תב"עות לבדיקה.', true); return; }
  if (!S.projects || !S.projects.length) { xtStatus('אין פרויקטים טעונים, ולכן אין מה לחפש.', true); return; }
  const rows = xtProjectRows(plans, S.projects, xtDeps({ skipBig: multi }));
  if (!rows.length) { xtStatus(plans.length === 1 ? 'לא נמצאו פרויקטים שעוברים בתב"ע ' + plans[0].num + '.' : 'לא נמצאו פרויקטים שעוברים באף אחת מהתב"עות.', true); return; }
  xpSave(await xpXlsx(XT_PROJ_HEAD, rows, XT_PROJ_WIDTHS), 'פרויקטים_בתחום_תבע_' + xtFile(label) + '_' + xtDate() + '.xlsx');
  const nProj = new Set(rows.map(r => r[5] + '|' + r[6] + '|' + r[7])).size, nPlans = new Set(rows.map(r => r[1])).size;
  xtStatus('יוצאו ' + rows.length + ' שורות: ' + nProj + ' פרויקטים ב-' + nPlans + ' תב"עות' + (spaceName ? ' (' + spaceName + ')' : '') + '. הפרויקטים נלקחו מכל השכבות הטעונות.');
}

(function xtInit() {
  const sel = $('#xtSpace'); if (!sel) return;
  sel.replaceChildren(el('option', { value: '', text: 'בחרי מרחב…' }), el('option', { value: '*', text: 'כל המרחבים (טעינת כולם)' }), ...xpAllNames().map(n => el('option', { value: n, text: n })));
  const dflt = () => { if (XT.touched) return; try { const sp = S.f.plan !== '*' ? xpSpaceOf(S.f.plan) : null; if (sp) { sel.value = sp.name; xtFillPlans(); } } catch (e) { /* ללא ברירת מחדל */ } };
  sel.addEventListener('change', () => { XT.touched = true; xtFillPlans(); });
  $('#planSel').addEventListener('change', dflt);
  $('#xtPlansBtn').addEventListener('click', xtExportPlansBySpace);
  $('#xtProjBtn').addEventListener('click', () => xtExportProjects());
  dflt();
})();
// כפתור גם בחלון התב"ע במפה
{ const xtBasePopup = xpPopup; xpPopup = r => { const d = xtBasePopup(r); d.append(el('br'), el('button', { class: 'btn small', type: 'button', style: 'margin-top:6px', onclick: () => xtExportProjects(r), text: 'ייצוא הפרויקטים שעוברים בתב"ע' })); return d; }; }
