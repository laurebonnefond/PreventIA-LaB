/* =====================================================================
   PréventIA-LaB — Cockpit synthétique v3
   ---------------------------------------------------------------------
   Inspiré des diagrammes SPSTI 23/87 :
     • Radar à 8 macro-catégories (pas 26 axes individuels)
     • Labels majuscules bold autour + pastilles de score colorées
     • Score global de prévention avec jauge circulaire
     • Points forts / actions prioritaires

   Échelle 1–5 (fréquence × gravité) :
     5 — Très important (rouge)    → risque résiduel 100
     4 — Important (orange)        → risque résiduel  75
     3 — Modéré (jaune)            → risque résiduel  50
     2 — Faible (vert clair)       → risque résiduel  25
     1 — Très faible (vert foncé)  → risque résiduel   0
     0 — N/C (gris)                → exclu du calcul

   API :
     CockpitFE.render('hostId', axes, meta)
     axes  = [{ label:'TMS / Travail répétitif', score:3, note:'' }, …]
     meta  = { entreprise, naf, nafLib, date, preventeur }
   ===================================================================== */
(function (global) {
  'use strict';

  const NIVEAUX = [
    { v: 0, lab: 'N/C',              hex: '#9aa3b2' },
    { v: 1, lab: 'Très faible',      hex: '#1f9d55' },
    { v: 2, lab: 'Faible',           hex: '#6bba45' },
    { v: 3, lab: 'Modéré',           hex: '#e5a800' },
    { v: 4, lab: 'Important',        hex: '#e58a2a' },
    { v: 5, lab: 'Très important',   hex: '#d23f2f' }
  ];
  /* Mapping ancien score 0–4 → nouveau 1–5 pour compatibilité */
  const MAP_OLD = { 0: 0, 1: 5, 2: 3, 3: 2, 4: 1 };
  const RESIDUEL = { 1: 0, 2: 25, 3: 50, 4: 75, 5: 100 };
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const niv = v => NIVEAUX[Math.max(0, Math.min(5, v | 0))];

  /* ═══════════ MACRO-CATÉGORIES ═══════════
     Chaque axe individuel est rattaché à l'une de ces 8 familles.
     Le score de la famille = pire score parmi ses axes (approche prudente). */
  const MACROS = [
    { id: 'chimique',    lab: 'RISQUES\nCHIMIQUES',           kw: ['chimique','cmr','radon','amiante','poussiere'] },
    { id: 'biologique',  lab: 'RISQUES\nBIOLOGIQUES',         kw: ['biologique','aes','vaccination','sang'] },
    { id: 'tms',         lab: 'TMS /\nERGONOMIE',             kw: ['tms','manutention','posture','répétitif','ergon','ecran','contraignant'] },
    { id: 'psycho',      lab: 'RISQUES\nPSYCHOSOCIAUX',       kw: ['rps','psycho','contact public','harcelement','stress','addiction','isolé','nuit','atypique'] },
    { id: 'securite',    lab: 'SÉCURITÉ /\nACCIDENTS',         kw: ['plain-pied','hauteur','machine','electrique','vibration','coactiv','chute'] },
    { id: 'incendie',    lab: 'INCENDIE /\nURGENCES',          kw: ['incendie','explosion','secours','sst','evacuation','extincteur'] },
    { id: 'orga',        lab: 'ORGANISATION /\nRÉGLEMENTAIRE', kw: ['duerp','document unique','affichage','vestiaire','sanitaire','locaux sociaux','dechet','routier','thermique'] },
    { id: 'travecran',   lab: 'TRAVAIL\nSUR ÉCRAN',            kw: ['écran','informatique','bureautique','teletravail'] }
  ];

  function classifyAxes(axes) {
    const groups = MACROS.map(m => ({ ...m, axes: [], score: 0 }));
    const unclassified = [];
    axes.forEach(a => {
      const n = a.label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      let found = false;
      for (const g of groups) {
        if (g.kw.some(k => n.includes(k.normalize('NFD').replace(/[\u0300-\u036f]/g, '')))) {
          g.axes.push(a); found = true; break;
        }
      }
      if (!found) unclassified.push(a);
    });
    /* Unclassified → « Organisation / Réglementaire » par défaut */
    const orga = groups.find(g => g.id === 'orga');
    unclassified.forEach(a => orga.axes.push(a));

    /* Score = pire des axes (le plus défavorable, càd le plus élevé en nouveau barème 1–5) */
    groups.forEach(g => {
      if (!g.axes.length) { g.score = 0; return; }
      const scores = g.axes.map(a => {
        const s = Math.max(0, Math.min(4, a.score | 0));
        return MAP_OLD[s] || 0;
      });
      g.score = Math.max(...scores);
    });
    return groups.filter(g => g.axes.length > 0);
  }

  /* ═══════════ RADAR SVG ═══════════ */
  function radar(groups) {
    const n = groups.length;
    if (n < 3) return '<div style="font-size:12px;color:#9aa3b2">3 catégories minimum.</div>';
    const cx = 300, cy = 280, R = 170;
    const ang = i => (-90 + i * 360 / n) * Math.PI / 180;
    const pt = (i, r) => [cx + Math.cos(ang(i)) * r, cy + Math.sin(ang(i)) * r];
    const gridCol = '#c0cad855';
    const axisCol = '#6b7e9444';
    let g = '';
    /* Grille concentrique + échelle */
    [1, 2, 3, 4, 5].forEach(l => {
      g += `<polygon points="${groups.map((_, i) => pt(i, R * l / 5).join(',')).join(' ')}" fill="none" stroke="${gridCol}" stroke-width="${l === 5 ? 1.5 : 0.7}" stroke-dasharray="${l === 5 ? '0' : '4,3'}"/>`;
      if (l <= 5) g += `<text x="${cx + 6}" y="${cy - R * l / 5 + 4}" font-size="11" font-weight="600" fill="#8ba0b8">${l}</text>`;
    });
    /* Axes */
    groups.forEach((_, i) => { const [x, y] = pt(i, R + 6); g += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="${axisCol}" stroke-width="1"/>`; });
    /* Référence (niveau 3 = moyen) */
    const ref = groups.map((_, i) => pt(i, R * 3 / 5).join(',')).join(' ');
    g += `<polygon points="${ref}" fill="none" stroke="#8ba0b888" stroke-width="1.5" stroke-dasharray="6,4"/>`;
    /* Polygone entreprise */
    const poly = groups.map((gr, i) => pt(i, R * Math.max(gr.score, 0) / 5).join(',')).join(' ');
    g += `<polygon points="${poly}" fill="rgba(23,66,143,0.18)" stroke="#17428F" stroke-width="2.5"/>`;
    /* Points */
    groups.forEach((gr, i) => {
      const [x, y] = pt(i, R * Math.max(gr.score, 0) / 5);
      g += `<circle cx="${x}" cy="${y}" r="5" fill="#17428F" stroke="#fff" stroke-width="2"/>`;
    });
    /* Labels multilignes + pastilles de score */
    groups.forEach((gr, i) => {
      const labDist = R + 55;
      const badgeDist = R + 25;
      const [lx, ly] = pt(i, labDist);
      const [bx, by] = pt(i, badgeDist);
      const anchor = Math.abs(lx - cx) < 30 ? 'middle' : (lx < cx ? 'end' : 'start');
      const lines = gr.lab.split('\n');
      const lineH = 16;
      const yOff = -(lines.length - 1) * lineH / 2;
      lines.forEach((line, j) => {
        g += `<text x="${lx}" y="${ly + yOff + j * lineH}" font-size="12.5" font-weight="700" fill="#17428F" text-anchor="${anchor}" dominant-baseline="middle" font-family="Arial,sans-serif">${esc(line)}</text>`;
      });
      /* Pastille de score colorée */
      const n5 = niv(gr.score);
      g += `<circle cx="${bx}" cy="${by}" r="14" fill="#fff" stroke="${n5.hex}" stroke-width="2.5"/>`;
      g += `<text x="${bx}" y="${by}" font-size="14" font-weight="700" fill="${n5.hex}" text-anchor="middle" dominant-baseline="central" font-family="Arial,sans-serif">${gr.score || '–'}</text>`;
    });
    /* Légende sous le radar */
    const legY = cy + R + 70;
    g += `<line x1="${cx - 60}" y1="${legY - 18}" x2="${cx - 30}" y2="${legY - 18}" stroke="#17428F" stroke-width="2"/>`;
    g += `<text x="${cx - 25}" y="${legY - 14}" font-size="10" fill="#8ba0b8" font-family="Arial">Niveau de risque de l'entreprise</text>`;
    g += `<line x1="${cx - 60}" y1="${legY}" x2="${cx - 30}" y2="${legY}" stroke="#8ba0b888" stroke-width="1.5" stroke-dasharray="6,4"/>`;
    g += `<text x="${cx - 25}" y="${legY + 4}" font-size="10" fill="#8ba0b8" font-family="Arial">Référence (niveau moyen)</text>`;

    return `<svg viewBox="0 0 600 ${legY + 20}" width="100%" preserveAspectRatio="xMidYMid meet" style="display:block;max-width:600px;margin:0 auto" xmlns="http://www.w3.org/2000/svg">${g}</svg>`;
  }

  /* ═══════════ SCORE GLOBAL (jauge circulaire) ═══════════ */
  function scoreGlobal(groups) {
    const actifs = groups.filter(g => g.score > 0);
    if (!actifs.length) return { pct: 0, label: '—', hex: '#9aa3b2' };
    /* Score = % de maîtrise = 100 - moyenne résiduel */
    const moy = actifs.reduce((s, g) => s + (RESIDUEL[g.score] || 0), 0) / actifs.length;
    const pct = Math.round(100 - moy);
    let label, hex;
    if (pct >= 80) { label = 'MAÎTRISÉ'; hex = '#1f9d55'; }
    else if (pct >= 60) { label = 'À AMÉLIORER'; hex = '#e5a800'; }
    else if (pct >= 40) { label = 'INSUFFISANT'; hex = '#e58a2a'; }
    else { label = 'CRITIQUE'; hex = '#d23f2f'; }
    return { pct, label, hex };
  }

  function gaugeCircle(sg) {
    const r = 54, cx = 70, cy = 70, circ = 2 * Math.PI * r;
    const dash = circ * sg.pct / 100;
    return `<svg viewBox="0 0 140 140" width="130" height="130" style="display:block;margin:0 auto">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#e0e6ed" stroke-width="10"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${sg.hex}" stroke-width="10"
        stroke-dasharray="${dash} ${circ - dash}" stroke-dashoffset="${circ / 4}"
        stroke-linecap="round" transform="rotate(0 ${cx} ${cy})"/>
      <text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="28" font-weight="700" fill="${sg.hex}" font-family="Arial">${sg.pct}%</text>
      <text x="${cx}" y="${cy + 14}" text-anchor="middle" font-size="8.5" font-weight="600" fill="#44546A" font-family="Arial">${sg.label}</text>
    </svg>`;
  }

  /* ═══════════ CSS ═══════════ */
  const CSS = `
.cfe{background:#fff;border-radius:16px;border:2px solid #17428F;padding:0;color:#222;font-family:Arial,Helvetica,sans-serif;overflow:hidden}
.cfe-header{background:#17428F;color:#fff;padding:14px 20px;display:flex;justify-content:space-between;align-items:center}
.cfe-header .t{font-size:18px;font-weight:700;letter-spacing:.5px}
.cfe-header .chips{display:flex;gap:8px}
.cfe-header .chip{background:rgba(255,255,255,.15);padding:3px 10px;border-radius:20px;font-size:11px}
.cfe-body{padding:20px}
.cfe-cols{display:grid;grid-template-columns:1fr 280px;gap:20px;align-items:start}
@media(max-width:900px){.cfe-cols{grid-template-columns:1fr}}
.cfe-right{display:flex;flex-direction:column;gap:14px}
.cfe-box{border:1.5px solid #17428F;border-radius:12px;overflow:hidden}
.cfe-box-head{background:#17428F;color:#fff;padding:7px 12px;font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;text-align:center}
.cfe-box-body{padding:12px 14px}
.cfe-echelle{display:flex;flex-wrap:wrap;gap:6px 12px;font-size:11px}
.cfe-echelle span{display:flex;align-items:center;gap:5px}
.cfe-echelle i{display:inline-block;width:18px;height:18px;border-radius:50%;text-align:center;line-height:18px;font-style:normal;font-weight:700;color:#fff;font-size:10px}
.cfe-forts{list-style:none;padding:0;margin:0}
.cfe-forts li{display:flex;align-items:flex-start;gap:6px;padding:4px 0;font-size:12px;border-bottom:1px solid #f0f0f0}
.cfe-forts li:last-child{border-bottom:0}
.cfe-forts .check{color:#1f9d55;font-size:16px;flex:none}
.cfe-actions{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-top:16px}
.cfe-prio{border-radius:10px;padding:12px 14px;font-size:12px}
.cfe-prio.p1{background:#fbe9e7;border-left:4px solid #d23f2f}
.cfe-prio.p2{background:#fff3e0;border-left:4px solid #e5a800}
.cfe-prio.p3{background:#e8f5e9;border-left:4px solid #1f9d55}
.cfe-prio h5{margin:0 0 6px;font-size:11.5px;text-transform:uppercase;letter-spacing:.5px}
.cfe-prio.p1 h5{color:#d23f2f} .cfe-prio.p2 h5{color:#e5a800} .cfe-prio.p3 h5{color:#1f9d55}
.cfe-prio ul{margin:0;padding-left:16px} .cfe-prio li{margin:2px 0}
.cfe-footer{margin-top:16px;padding:10px 14px;background:#f5f7fa;border-radius:8px;font-size:11px;color:#44546A;line-height:1.5}
@media print{.cfe{border:1px solid #ccc;page-break-inside:avoid}.cfe-header{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
`;

  function injectCSS() {
    if (document.getElementById('cfe-style')) return;
    const s = document.createElement('style'); s.id = 'cfe-style'; s.textContent = CSS; document.head.appendChild(s);
  }

  /* ═══════════ CALCULS ═══════════ */
  function calc(axes) {
    const actifs = axes.filter(a => a.score >= 1);
    const nc = axes.length - actifs.length;
    const residuel = actifs.length ? Math.round(actifs.reduce((s, a) => s + (RESIDUEL[MAP_OLD[a.score]] || 0), 0) / actifs.length) : 0;
    const maitrise = actifs.length ? Math.round(actifs.reduce((s, a) => s + a.score, 0) / (actifs.length * 4) * 100) : null;
    return {
      actifs, nc, residuel, maitrise,
      critiques: actifs.filter(a => a.score <= 1),
      renforcer: actifs.filter(a => a.score === 2),
      forts: actifs.filter(a => a.score >= 3)
    };
  }
  function bande(s) {
    if (s <= 20) return { lab: 'Maîtrise satisfaisante', hex: '#1f9d55' };
    if (s <= 40) return { lab: 'Surveillance', hex: '#d6b400' };
    if (s <= 60) return { lab: 'Amélioration nécessaire', hex: '#e58a2a' };
    if (s <= 80) return { lab: 'Risque élevé', hex: '#d23f2f' };
    return { lab: 'Situation critique', hex: '#4a2320' };
  }

  /* ═══════════ RENDU PRINCIPAL ═══════════ */
  function render(host, axes, meta) {
    injectCSS();
    const el = typeof host === 'string' ? document.getElementById(host.replace('#', '')) : host;
    if (!el) return;
    axes = (axes || []).filter(a => a && a.label).map(a => ({ label: a.label, score: Math.max(0, Math.min(4, +a.score || 0)), note: a.note || '' }));
    if (!axes.length) { el.innerHTML = '<p style="font-size:13px;color:#7a8598">Cotez au moins un axe pour générer le cockpit.</p>'; return; }
    meta = meta || {};
    const c = calc(axes);
    const date = meta.date || new Date().toISOString().slice(0, 10);

    /* Classification en macro-catégories */
    const groups = classifyAxes(axes);
    const sg = scoreGlobal(groups);

    /* Points forts (score 1 = très faible risque = point fort) */
    const forts = axes.filter(a => a.score >= 4).slice(0, 8);
    /* Actions : axes mal cotés, classés par urgence */
    const p1 = axes.filter(a => a.score <= 1 && a.score > 0);
    const p2 = axes.filter(a => a.score === 2);
    const p3 = axes.filter(a => a.score >= 3);

    el.innerHTML = `<div class="cfe">
      <div class="cfe-header">
        <div class="t">SYNTHÈSE DES RISQUES PROFESSIONNELS</div>
        <div class="chips">
          ${meta.naf ? `<span class="chip">NAF ${esc(meta.naf)}</span>` : ''}
          <span class="chip">${axes.length} risques évalués</span>
          <span class="chip">${esc(date)}</span>
        </div>
      </div>
      <div class="cfe-body">
        <div style="text-align:center;font-size:14px;font-weight:700;color:#17428F;margin-bottom:4px">
          DIAGRAMME EN ARAIGNÉE DES RISQUES
        </div>
        <div style="text-align:center;font-size:12px;color:#44546A;margin-bottom:14px">
          Évaluation de l'importance des risques pour l'entreprise — ${esc(meta.entreprise || '')}
        </div>

        <div class="cfe-cols">
          <div>${radar(groups)}</div>
          <div class="cfe-right">
            <div class="cfe-box">
              <div class="cfe-box-head">Score global de prévention</div>
              <div class="cfe-box-body" style="text-align:center">
                ${gaugeCircle(sg)}
                <div style="font-size:11px;color:#44546A;margin-top:6px;line-height:1.4">
                  ${sg.pct >= 60
                    ? 'Les risques sont identifiés et en partie maîtrisés. Des actions prioritaires sont à mettre en œuvre pour renforcer la prévention.'
                    : 'Le niveau de maîtrise est insuffisant. Des actions correctives urgentes sont nécessaires.'}
                </div>
              </div>
            </div>
            <div class="cfe-box">
              <div class="cfe-box-head">Échelle d'évaluation</div>
              <div class="cfe-box-body">
                <div class="cfe-echelle">
                  ${NIVEAUX.slice(1).reverse().map(n => `<span><i style="background:${n.hex}">${n.v}</i>${n.lab}</span>`).join('')}
                </div>
                <div style="font-size:10px;color:#8ba0b8;margin-top:6px">Évaluation basée sur la fréquence et la gravité du risque</div>
              </div>
            </div>
            ${forts.length ? `<div class="cfe-box">
              <div class="cfe-box-head" style="background:#1f9d55">Points forts déjà en place</div>
              <div class="cfe-box-body">
                <ul class="cfe-forts">${forts.map(a => `<li><span class="check">✅</span>${esc(a.label)}</li>`).join('')}</ul>
              </div>
            </div>` : ''}
          </div>
        </div>

        <div style="text-align:center;font-size:14px;font-weight:700;color:#17428F;margin-top:20px;margin-bottom:10px;text-transform:uppercase">
          Plan d'actions — Priorisation des risques
        </div>
        <div class="cfe-actions">
          ${p1.length ? `<div class="cfe-prio p1">
            <h5>🔴 Priorité 1 — à traiter en priorité</h5>
            <ul>${p1.map(a => `<li>${esc(a.label)}</li>`).join('')}</ul>
          </div>` : ''}
          ${p2.length ? `<div class="cfe-prio p2">
            <h5>🟡 Priorité 2 — à planifier</h5>
            <ul>${p2.map(a => `<li>${esc(a.label)}</li>`).join('')}</ul>
          </div>` : ''}
          ${p3.length ? `<div class="cfe-prio p3">
            <h5>✅ Priorité 3 — à maintenir</h5>
            <ul>${p3.map(a => `<li>${esc(a.label)}</li>`).join('')}</ul>
          </div>` : ''}
        </div>

        <div class="cfe-footer">
          Ce diagramme synthétique permet d'identifier en un coup d'œil les risques prioritaires et de piloter efficacement votre démarche de prévention.<br>
          Document établi le ${esc(date)} — ${esc(meta.entreprise || 'Établissement')} · ${esc(meta.preventeur || 'Préventeur')} · Fiche d'entreprise (art. R.4624-46)
        </div>
      </div>
    </div>`;
  }

  function fromDOM(sel) {
    const root = document.querySelector(sel);
    if (!root) return [];
    return [...root.querySelectorAll('[data-axe], .axe-row')].map(row => {
      const lab = row.querySelector('input[type=text], .axe-label');
      const sc = row.querySelector('select');
      return { label: (lab && (lab.value || lab.textContent) || '').trim(), score: sc ? parseInt(sc.value, 10) || 0 : 0 };
    }).filter(a => a.label);
  }

  global.CockpitFE = { render, fromDOM, calc, bande, classifyAxes, scoreGlobal, radar, gaugeCircle, NIVEAUX, RESIDUEL };
})(window);
