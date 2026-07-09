/* =====================================================================
   PréventIA-LaB — Cockpit synthétique (axes cotés /4)
   ---------------------------------------------------------------------
   S'insère APRÈS le scoring et le radar de la fiche d'entreprise.
   Échelle native de l'outil (menus déroulants) :
     0 — N/C (non concerné, exclu du calcul)
     1 — Absent          → risque résiduel 100
     2 — Partiel         → risque résiduel  50
     3 — En place        → risque résiduel  25
     4 — Optimisé        → risque résiduel   0

   API :
     CockpitFE.render('hostId', axes, meta)
     CockpitFE.fromDOM('#axesContainer')   // relit les <select> de la page
     axes  = [{ label:'TMS / Travail répétitif', score:3, note:'' }, …]
     meta  = { entreprise, naf, nafLib, date, preventeur }
   ===================================================================== */
(function (global) {
  'use strict';

  const NIVEAUX = [
    { v: 0, lab: 'N/C',      hex: '#9aa3b2' },
    { v: 1, lab: 'Absent',   hex: '#d23f2f' },
    { v: 2, lab: 'Partiel',  hex: '#e58a2a' },
    { v: 3, lab: 'En place', hex: '#d6b400' },
    { v: 4, lab: 'Optimisé', hex: '#1f9d55' }
  ];
  const RESIDUEL = { 1: 100, 2: 50, 3: 25, 4: 0 };
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const niv = v => NIVEAUX[Math.max(0, Math.min(4, v | 0))];

  const CSS = `
.cfe{background:oklch(0.22 0.05 252);border-radius:16px;padding:20px;color:oklch(0.92 0.01 250);
  font-family:"DM Sans",system-ui,sans-serif;margin-top:18px}
.cfe-head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:16px}
.cfe-head .t{font-family:"DM Serif Display",Georgia,serif;font-size:21px;color:#fff}
.cfe-chip{background:oklch(0.35 0.04 250);padding:4px 10px;border-radius:20px;font-size:11px;margin-left:6px;display:inline-block}
.cfe-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:14px}
.cfe-kpi{background:oklch(0.28 0.04 250);border:1px solid oklch(0.38 0.04 250);border-radius:12px;padding:12px 14px}
.cfe-kpi .l{font-size:10.5px;text-transform:uppercase;letter-spacing:.6px;color:oklch(0.72 0.02 250)}
.cfe-kpi .v{font:700 26px/1.1 "DM Sans",sans-serif;color:#fff;margin:5px 0 2px}
.cfe-kpi .v small{font-size:12px;font-weight:500;color:oklch(0.75 0.02 250)}
.cfe-kpi .g{font-size:11px}
.cfe-grid{display:grid;grid-template-columns:1.1fr .9fr 1fr;gap:12px}
@media(max-width:900px){.cfe-grid{grid-template-columns:1fr}}
.cfe-panel{background:oklch(0.28 0.04 250);border:1px solid oklch(0.38 0.04 250);border-radius:12px;padding:14px}
.cfe-panel.wide{grid-column:1/-1}
.cfe-panel h4{font-size:12px;text-transform:uppercase;letter-spacing:.7px;color:oklch(0.78 0.03 200);margin:0 0 10px}
.cfe-rag{display:flex;align-items:center;gap:9px;padding:6px 0;font-size:12.5px;border-bottom:1px solid oklch(0.35 0.03 250)}
.cfe-rag:last-child{border-bottom:0}
.cfe-rag .d{width:9px;height:9px;border-radius:50%;flex:none}
.cfe-rag .n{flex:1}
.cfe-rag .s{font-weight:700}
.cfe-act{font-size:12.5px;padding:7px 0;border-bottom:1px solid oklch(0.35 0.03 250);display:flex;gap:8px}
.cfe-act:last-child{border-bottom:0}
.cfe-legend{display:flex;gap:12px;flex-wrap:wrap;font-size:10.5px;color:oklch(0.75 0.02 250);margin-top:8px}
.cfe-legend i{display:inline-block;width:9px;height:9px;border-radius:3px;margin-right:4px}
.cfe-note{margin-top:14px;padding:11px 14px;background:oklch(0.30 0.04 250 /.55);border-radius:12px;font-size:12.5px;line-height:1.55}
@media print{.cfe{background:#fff;color:#222;border:1px solid #ccc}.cfe-panel,.cfe-kpi{background:#f7f9fb;border-color:#dde3ea}
  .cfe-head .t,.cfe-kpi .v{color:#12303f}}
`;
  function injectCSS() {
    if (document.getElementById('cfe-style')) return;
    const s = document.createElement('style'); s.id = 'cfe-style'; s.textContent = CSS; document.head.appendChild(s);
  }

  /* ---------- Radar sur échelle 0–4 (« radar en 4 ») ---------- */
  function radar4(axes) {
    const n = axes.length;
    if (n < 3) return '<div style="font-size:12px;color:#9aa3b2">Radar : 3 axes minimum.</div>';
    const cx = 175, cy = 168, R = 108;
    const ang = i => (-90 + i * 360 / n) * Math.PI / 180;
    const pt = (i, r) => [cx + Math.cos(ang(i)) * r, cy + Math.sin(ang(i)) * r];
    const grid = 'oklch(0.45 0.03 250)';
    let g = '';
    [1, 2, 3, 4].forEach(l => {
      g += `<polygon points="${axes.map((_, i) => pt(i, R * l / 4).join(',')).join(' ')}" fill="none" stroke="${grid}" stroke-width="${l === 4 ? 1.4 : 0.8}"/>`;
      g += `<text x="${cx + 4}" y="${cy - R * l / 4 + 3}" font-size="8" fill="oklch(0.6 0.02 250)">${l}</text>`;
    });
    axes.forEach((_, i) => { const [x, y] = pt(i, R); g += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="${grid}"/>`; });
    const poly = axes.map((a, i) => pt(i, R * Math.max(a.score, 0) / 4).join(',')).join(' ');
    g += `<polygon points="${poly}" fill="oklch(0.66 0.10 195 / .30)" stroke="oklch(0.72 0.10 195)" stroke-width="2"/>`;
    axes.forEach((a, i) => { const [x, y] = pt(i, R * Math.max(a.score, 0) / 4); g += `<circle cx="${x}" cy="${y}" r="3.4" fill="${niv(a.score).hex}" stroke="#fff" stroke-width="1"/>`; });
    axes.forEach((a, i) => {
      const [x, y] = pt(i, R + 24);
      const anchor = Math.abs(x - cx) < 14 ? 'middle' : (x < cx ? 'end' : 'start');
      const lab = a.label.length > 22 ? a.label.slice(0, 21) + '…' : a.label;
      g += `<text x="${x}" y="${y}" font-size="9.5" fill="oklch(0.80 0.02 250)" text-anchor="${anchor}" dominant-baseline="middle">${esc(lab)}</text>`;
    });
    return `<svg viewBox="0 0 350 320" width="100%" style="max-width:370px">${g}</svg>`;
  }

  /* ---------- Jauge de risque résiduel ---------- */
  function gauge(score) {
    const b = bande(score), cx = 110, cy = 118, r = 88;
    const arc = (f, t, c) => {
      const p1 = [cx + r * Math.cos(f * Math.PI / 180), cy - r * Math.sin(f * Math.PI / 180)];
      const p2 = [cx + r * Math.cos(t * Math.PI / 180), cy - r * Math.sin(t * Math.PI / 180)];
      return `<path d="M ${p1[0]} ${p1[1]} A ${r} ${r} 0 0 1 ${p2[0]} ${p2[1]}" fill="none" stroke="${c}" stroke-width="13" stroke-linecap="round"/>`;
    };
    let g = '';
    [[0, 20, '#1f9d55'], [20, 40, '#d6b400'], [40, 60, '#e58a2a'], [60, 80, '#d23f2f'], [80, 100, '#4a2320']]
      .forEach(s => g += arc(180 - s[0] * 1.8, 180 - s[1] * 1.8, s[2]));
    const a = (180 - score * 1.8) * Math.PI / 180;
    g += `<line x1="${cx}" y1="${cy}" x2="${cx + (r - 18) * Math.cos(a)}" y2="${cy - (r - 18) * Math.sin(a)}" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`;
    g += `<circle cx="${cx}" cy="${cy}" r="6" fill="#fff"/>`;
    g += `<text x="${cx}" y="${cy - 20}" text-anchor="middle" font-family="DM Serif Display,serif" font-size="34" fill="${b.hex}">${score}</text>`;
    g += `<text x="${cx}" y="${cy + 2}" text-anchor="middle" font-size="10" fill="oklch(0.7 0.02 250)">/ 100</text>`;
    return `<svg viewBox="0 0 220 138" width="100%" style="max-width:230px">${g}</svg>`;
  }
  function bande(s) {
    if (s <= 20) return { lab: 'Maîtrise satisfaisante', hex: '#1f9d55' };
    if (s <= 40) return { lab: 'Surveillance', hex: '#d6b400' };
    if (s <= 60) return { lab: 'Amélioration nécessaire', hex: '#e58a2a' };
    if (s <= 80) return { lab: 'Risque élevé', hex: '#d23f2f' };
    return { lab: 'Situation critique', hex: '#4a2320' };
  }

  /* ---------- Calculs ---------- */
  function calc(axes) {
    const actifs = axes.filter(a => a.score >= 1);
    const nc = axes.length - actifs.length;
    const residuel = actifs.length ? Math.round(actifs.reduce((s, a) => s + RESIDUEL[a.score], 0) / actifs.length) : 0;
    const maitrise = actifs.length ? Math.round(actifs.reduce((s, a) => s + a.score, 0) / (actifs.length * 4) * 100) : null;
    return {
      actifs, nc, residuel, maitrise,
      critiques: actifs.filter(a => a.score <= 1),
      renforcer: actifs.filter(a => a.score === 2),
      forts: actifs.filter(a => a.score >= 3)
    };
  }

  /* ---------- Rendu ---------- */
  function render(host, axes, meta) {
    injectCSS();
    const el = typeof host === 'string' ? document.getElementById(host.replace('#', '')) : host;
    if (!el) return;
    axes = (axes || []).filter(a => a && a.label).map(a => ({ label: a.label, score: Math.max(0, Math.min(4, +a.score || 0)), note: a.note || '' }));
    if (!axes.length) { el.innerHTML = '<p style="font-size:13px;color:#7a8598">Cotez au moins un axe pour générer le cockpit.</p>'; return; }
    meta = meta || {};
    const c = calc(axes), b = bande(c.residuel);
    const date = meta.date || new Date().toISOString().slice(0, 10);

    const kpi = (l, v, u, g, col) => `<div class="cfe-kpi"><div class="l">${l}</div>
      <div class="v">${v}${u ? `<small>${u}</small>` : ''}</div><div class="g" style="color:${col || '#9fb4c8'}">${g || ''}</div></div>`;

    const rag = c.actifs.slice().sort((a, b2) => a.score - b2.score).map(a => {
      const n = niv(a.score);
      return `<div class="cfe-rag"><span class="d" style="background:${n.hex}"></span>
        <span class="n">${esc(a.label)}</span><span class="s" style="color:${n.hex}">${a.score}/4 · ${n.lab}</span></div>`;
    }).join('');

    const actions = c.actifs.filter(a => a.score <= 2).sort((a, b2) => a.score - b2.score).slice(0, 5).map(a => {
      const urgent = a.score <= 1;
      return `<div class="cfe-act"><span>${urgent ? '🔴' : '🟠'}</span>
        <span style="flex:1">${esc(a.label)}<br><small style="color:oklch(0.7 0.02 250)">
        ${urgent ? 'Mesure absente — action sous 3 mois' : 'Mesure partielle — consolider sous 6 mois'}</small></span></div>`;
    }).join('') || '<div class="cfe-act">✅ <span>Aucun axe sous le seuil : maintenir les mesures en place et tracer les vérifications périodiques.</span></div>';

    const concl = `Indice de maîtrise : ${c.maitrise != null ? c.maitrise + '/100' : '—'} sur ${c.actifs.length} axe(s) coté(s)`
      + (c.nc ? ` (${c.nc} axe(s) non concerné(s) exclu(s) du calcul)` : '') + '. '
      + `Risque résiduel pondéré : ${c.residuel}/100 — ${b.lab.toLowerCase()}. `
      + (c.critiques.length ? `Axes critiques : ${c.critiques.map(a => a.label).join(', ')}. ` : 'Aucun axe critique. ')
      + (c.renforcer.length ? `À consolider : ${c.renforcer.map(a => a.label).join(', ')}. ` : '')
      + `Document d'aide à la décision — à valider par le médecin du travail après visite (art. R.4624-46).`;

    el.innerHTML = `<div class="cfe">
      <div class="cfe-head">
        <div class="t">Cockpit synthétique — ${esc(meta.entreprise || 'entreprise')}</div>
        <div>${meta.naf ? `<span class="cfe-chip">NAF ${esc(meta.naf)}</span>` : ''}
          <span class="cfe-chip">${axes.length} axes</span><span class="cfe-chip">${esc(date)}</span></div>
      </div>

      <div class="cfe-kpis">
        ${kpi('Risque résiduel', c.residuel, '/100', b.lab, b.hex)}
        ${kpi('Indice de maîtrise', c.maitrise != null ? c.maitrise : '—', '/100', 'moyenne des axes cotés', '#8fd0e0')}
        ${kpi('Points critiques', c.critiques.length, '', 'axes 0–1', c.critiques.length ? '#d23f2f' : '#4fbf7a')}
        ${kpi('À renforcer', c.renforcer.length, '', 'axes 2', c.renforcer.length ? '#e58a2a' : '#4fbf7a')}
        ${kpi('Points forts', c.forts.length, '', 'axes 3–4', '#4fbf7a')}
        ${kpi('Non concernés', c.nc, '', 'exclus du calcul', '#9aa3b2')}
      </div>

      <div class="cfe-grid">
        <div class="cfe-panel"><h4>Radar de maîtrise (échelle 0–4)</h4>${radar4(axes)}
          <div class="cfe-legend">${NIVEAUX.map(n => `<span><i style="background:${n.hex}"></i>${n.v} — ${n.lab}</span>`).join('')}</div></div>
        <div class="cfe-panel" style="text-align:center"><h4>Jauge de risque résiduel</h4>${gauge(c.residuel)}
          <div style="color:${b.hex};font-weight:700;margin-top:4px;font-size:13px">${b.lab}</div>
          <div style="font-size:11px;color:oklch(0.7 0.02 250);margin-top:4px">1 Absent = 100 · 2 Partiel = 50 · 3 En place = 25 · 4 Optimisé = 0</div></div>
        <div class="cfe-panel"><h4>Indicateurs RAG par axe</h4>${rag}</div>
        <div class="cfe-panel wide"><h4>Actions prioritaires</h4>${actions}</div>
      </div>

      <div class="cfe-note"><b style="color:#fff">Avis de synthèse —</b> ${esc(concl)}</div>
    </div>`;
  }

  /* ---------- Relecture des <select> déjà présents dans la page ---------- */
  function fromDOM(sel) {
    const root = document.querySelector(sel);
    if (!root) return [];
    return [...root.querySelectorAll('[data-axe], .axe-row')].map(row => {
      const lab = row.querySelector('input[type=text], .axe-label');
      const sc = row.querySelector('select');
      return { label: (lab && (lab.value || lab.textContent) || '').trim(), score: sc ? parseInt(sc.value, 10) || 0 : 0 };
    }).filter(a => a.label);
  }

  global.CockpitFE = { render, fromDOM, calc, bande, radar4, gauge, NIVEAUX, RESIDUEL };
})(window);
