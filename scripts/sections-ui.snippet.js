/* sections: פופאפ חתכי רחוב (קיים | מוצע). משתמש ב-el, S, panel ו-renderPanel של הדאשבורד. */
const SX = { data: null, state: new Map(), dlg: null };
const sxUrl = rel => new URL('../data/sections/' + rel, location.href).href;
(() => {
  const css = document.createElement('style');
  css.textContent = '.sx-grid{display:grid;grid-template-columns:1fr;gap:10px;margin:6px 0}@media(max-width:560px){.sx-grid{grid-template-columns:1fr}}'
    + '.sx-fig{margin:0;border:1px solid var(--rule,#ccc);border-radius:8px;background:#fff;overflow:hidden}'
    + '.sx-fig figcaption{display:flex;flex-wrap:wrap;gap:6px;align-items:center;justify-content:space-between;padding:5px 8px;background:var(--paper,#f6f6f6);font-size:13px;color:var(--muted,#555);border-bottom:1px solid var(--rule,#ccc)}'
    + '.sx-img{display:block;width:100%;height:auto;cursor:zoom-in;background:#fff}.sx-alts{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}'
    + '.sx-dlg{width:min(96vw,1500px);max-height:94vh;padding:0;border:1px solid var(--rule,#ccc);border-radius:10px;background:var(--paper,#fff);color:inherit}.sx-dlg::backdrop{background:rgba(0,0,0,.45)}'
    + '.sx-dlg .sx-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 14px;border-bottom:1px solid var(--rule,#ccc)}.sx-dlg .sx-body{padding:12px 14px;overflow:auto;max-height:calc(94vh - 60px)}'
    + '.sx-dlg .sx-grid{grid-template-columns:1fr}@media(max-width:900px){.sx-dlg .sx-grid{grid-template-columns:1fr}}';
  document.head.append(css);
})();
// אחרי בנייה מחדש של כפתורי הבחירה, ה-focus חוזר לכפתור הנבחר (נגישות, ושמירה על Escape בתוך החלון)
function sxKeepFocus(root, fn) {
  const had = root.contains(document.activeElement);
  fn();
  if (had) { const c = root.querySelector('.chip[aria-pressed="true"]'); if (c) c.focus(); }
}
async function sxLoad() {
  try {
    const r = await fetch(sxUrl('sections.json'), { cache: 'no-cache' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    SX.data = await r.json();
    try { if (S.view && S.view.mode === 'project') renderPanel(true); } catch (e) { /* הפאנל יתרענן בלחיצה הבאה */ }
  } catch (e) { console.warn('sections not loaded', e); SX.data = { streets: [] }; }
}
sxLoad();
function sxFigure(title, it, street, onZoom) {
  if (!it) return el('figure', { class: 'sx-fig' }, el('figcaption', {}, el('b', { text: title })), el('p', { class: 'hint', style: 'padding:14px;margin:0', text: 'אין חתך זמין' }));
  const cap = el('figcaption', {}, el('b', { text: title }), it.width ? el('span', { class: 'tag', text: 'זכות דרך ' + it.width + ' מ\'' }) : null);
  const img = el('img', { class: 'sx-img', src: sxUrl('images/' + it.file), alt: title + ' – ' + street.name, loading: 'lazy', title: 'לחצו להגדלה', onclick: onZoom });
  return el('figure', { class: 'sx-fig' }, cap, img, it.note ? el('p', { class: 'hint', style: 'margin:0;padding:6px 8px', text: it.note }) : null);
}
function sxAltChips(street, st, redraw) {
  if (street.proposed.length < 2) return null;
  return el('div', { class: 'sx-alts', role: 'group', 'aria-label': 'חלופות מוצעות' }, ...street.proposed.map((a, i) =>
    el('button', { class: 'chip', type: 'button', 'aria-pressed': String(i === st.a), onclick: () => { st.a = i; redraw(); }, text: a.label })));
}
function sxOpen(street, st, onClose) {
  if (!SX.dlg) {
    SX.dlg = el('dialog', { class: 'sx-dlg', id: 'sxDlg', 'aria-label': 'חתכי רחוב' });
    SX.dlg.addEventListener('click', e => { if (e.target === SX.dlg) SX.dlg.close(); });
    SX.dlg.addEventListener('close', () => { if (SX.onClose) SX.onClose(); });
    // Escape כשהחלון פתוח סוגר רק אותו. ב-capture, כדי שיעבוד גם כשה-focus אבד אחרי החלפת חלופה
    addEventListener('keydown', e => { if (e.key === 'Escape' && SX.dlg && SX.dlg.open) e.stopPropagation(); }, true);
    document.body.append(SX.dlg);
  }
  SX.onClose = onClose || null;
  const draw = () => sxKeepFocus(SX.dlg, () => {
    const alt = street.proposed[st.a] || null;
    SX.dlg.replaceChildren(
      el('div', { class: 'sx-head' }, el('h3', { style: 'margin:0', text: 'חתכי רחוב: ' + street.name }), el('button', { class: 'btn small', type: 'button', onclick: () => SX.dlg.close(), text: 'סגירה ✕' })),
      el('div', { class: 'sx-body' }, ...[sxAltChips(street, st, draw), el('div', { class: 'sx-grid' }, sxFigure('מצב קיים', street.existing, street, null), sxFigure('מצב מוצע' + (alt && street.proposed.length > 1 ? ' – ' + alt.label : ''), alt, street, null))].filter(Boolean)));
  });
  draw();
  if (!SX.dlg.open) SX.dlg.showModal();
}
function sxBlock(body, p) {
  if (!SX.data) return;
  const streets = sxMatch(SX.data, p);
  if (!streets.length) return;
  const st = SX.state.get(p.key) || { s: 0, a: 0 }; SX.state.set(p.key, st);
  const box = el('div', { class: 'sx-box' });
  body.append(el('div', { class: 'section-h', text: 'חתכי רחוב – קיים ומוצע' }), box);
  const draw = () => sxKeepFocus(box, () => {
    if (st.s >= streets.length) st.s = 0;
    const street = streets[st.s];
    if (st.a >= street.proposed.length) st.a = 0;
    const alt = street.proposed[st.a] || null;
    const zoom = () => sxOpen(street, st, draw);
    box.replaceChildren(...[
      streets.length > 1 ? el('div', { class: 'sx-alts', role: 'group', 'aria-label': 'רחוב' }, ...streets.map((s, i) =>
        el('button', { class: 'chip', type: 'button', 'aria-pressed': String(i === st.s), onclick: () => { st.s = i; st.a = 0; draw(); }, text: s.name }))) : null,
      sxAltChips(street, st, draw),
      el('div', { class: 'sx-grid' }, sxFigure('מצב קיים', street.existing, street, zoom), sxFigure('מצב מוצע' + (alt && street.proposed.length > 1 ? ' – ' + alt.label : ''), alt, street, zoom)),
      el('div', { class: 'linkbar' }, el('span', { text: 'רחוב ' + street.name }), el('button', { class: 'btn small', type: 'button', onclick: zoom, text: 'הגדלה' }))].filter(Boolean));
  });
  draw();
}
