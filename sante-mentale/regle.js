/* Règle graduée interactive (harcèlomètre, violentomètre)
   SM.regle(element, { zones:[{cls:'z-ok', titre, sous, items:[...]}, ...], resultats:{aucun, ok, warn, bad} })
   Aucune donnée n'est enregistrée ni envoyée : tout reste à l'écran. */
window.SM = window.SM || {};
SM.regle = function (el, cfg) {
  const NIV = { 'z-ok': 1, 'z-warn': 2, 'z-bad': 3 };
  const COUL = { 0: 'var(--line)', 1: 'var(--ok)', 2: 'var(--warn)', 3: 'var(--bad)' };
  const CLE = { 0: 'aucun', 1: 'ok', 2: 'warn', 3: 'bad' };
  let id = 0;
  el.innerHTML = `<div class="ruler-wrap">
    <div class="ruler">${cfg.zones.map(z => `
      <div class="zone ${z.cls}">
        <div class="zone-h"><i></i>${z.titre} <small>${z.sous || ''}</small></div>
        ${z.items.map(t => `<label class="item"><input type="checkbox" data-n="${NIV[z.cls]}" id="it${++id}"><span>${t}</span></label>`).join('')}
      </div>`).join('')}
    </div>
    <aside class="result" aria-live="polite">
      <div class="sm-eyebrow" style="color:var(--muted)">Résultat</div>
      <div class="lvl"></div>
      <div class="meter"><i></i></div>
      <div class="txt"></div>
      <div style="display:flex;gap:.5rem;margin-top:1rem;flex-wrap:wrap">
        <button class="btn" data-raz>↺ Tout décocher</button>
        <button class="btn" onclick="window.print()">🖨 Imprimer</button>
      </div>
    </aside></div>`;
  const maj = () => {
    const coches = [...el.querySelectorAll('input:checked')];
    el.querySelectorAll('.item').forEach(l => l.classList.toggle('on', l.querySelector('input').checked));
    const n = coches.reduce((m, c) => Math.max(m, +c.dataset.n), 0);
    const r = cfg.resultats[CLE[n]];
    el.querySelector('.lvl').textContent = r.titre;
    el.querySelector('.lvl').style.color = n ? COUL[n] : 'var(--text)';
    const m = el.querySelector('.meter i');
    m.style.width = (n / 3 * 100) + '%'; m.style.background = COUL[n];
    el.querySelector('.txt').innerHTML = r.html + (coches.length ? `<p style="font-size:12px;color:var(--muted);margin-top:.8rem">${coches.length} situation(s) cochée(s)</p>` : '');
  };
  el.addEventListener('change', maj);
  el.querySelector('[data-raz]').onclick = () => { el.querySelectorAll('input').forEach(i => i.checked = false); maj(); };
  maj();
};

/* Onglets simples : <button class="tab" data-t="id"> + <section class="panel" id="id"> */
SM.onglets = function () {
  document.querySelectorAll('.tab').forEach(b => b.onclick = () => {
    document.querySelectorAll('.tab,.panel').forEach(e => e.classList.remove('on'));
    b.classList.add('on'); document.getElementById(b.dataset.t).classList.add('on');
    history.replaceState(null, '', '#' + b.dataset.t);
  });
  const h = location.hash.slice(1);
  if (h && document.querySelector(`.tab[data-t="${h}"]`)) document.querySelector(`.tab[data-t="${h}"]`).click();
};
