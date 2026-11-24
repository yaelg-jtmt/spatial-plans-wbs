/* repo-content: שכבות ומצגות נטענות מקבצי האתר (data/layers, data/decks) במקום מחלון הטעינה.
   מוזרק ע"י scripts/prepare-dashboard.mjs לתוך פונקציית ה-boot של הדאשבורד, ולכן משתמש ב-S, GIS ו-location שלו. */
const loadRepoContent = async () => {
  const REPO = new URL('../data/', location.href);
  const nk = s => String(s || '').replace(/["'׳״`\s\-–—_]/g, '');
  let man;
  try {
    const r = await fetch(new URL('layers/manifest.json', REPO), { cache: 'no-cache' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    man = await r.json();
  } catch (e) { console.warn('repo manifest not loaded', e); return; }
  const layers = man.layers || [], decks = man.decks || [];
  // replace: true מסיר שכבות מוטמעות קיימות של אותה תכנית ואותו מצב, ומחליף אותן בשכבות מהאתר
  const drop = new Set(layers.filter(L => L.replace).map(L => nk(L.plan) + '|' + (L.state || 'auto')));
  if (drop.size) S.layers = S.layers.filter(l => !(l.source === 'default' && drop.has(nk(l.plan) + '|' + (l.state || 'auto'))));
  for (const L of layers) {
    try {
      const r = await fetch(new URL('layers/' + L.file, REPO));
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const P = GIS.fromGeoJSON(L.name, await r.json());
      if (!P.items.some(it => it.g)) throw new Error('אין גאומטריה בקובץ');
      S.layers.push({ id: 'repo:' + L.id, name: L.name, plan: L.plan || '', state: L.state || 'auto', source: 'default', items: P.items, fields: P.fields, crs: P.crs, fileName: L.file, visible: true });
    } catch (e) { console.error('repo layer failed', L.file, e); }
  }
  for (const D of decks) S.decks.push({ id: 'repo:' + D.id, name: D.name, plan: D.plan || '', source: 'default', url: new URL('decks/' + D.file, REPO).href });
};
await loadRepoContent();
