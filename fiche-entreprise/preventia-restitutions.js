/* =====================================================================
   PréventIA-LaB — Module de restitutions à 3 niveaux
   Fiche d'entreprise  ·  cohérence graphique avec « Étude de poste »
   ---------------------------------------------------------------------
   Expose : window.PVX
     PVX.render(targetEl|targetId, ctx)
     PVX.setTab(tab)            // 'expert' | 'synth' | 'cockpit'
     PVX.svgGauge / svgRadar / svgMatrix / svgBars / svgTimeline
   Contexte attendu (ctx) :
     { A, S, answers, meta, doublons }
       A        = aggregate()          (secteur, taille, metiers, unites, risks)
       S        = computeScoring(A)    (indice, tauxMaitrise, effExpose, …)
       answers  = { [riskId]: 'maitrise'|'partiel'|'non'|'nc' }
       meta     = { entreprise, naf, nafLib, section, effectif, date, preventeur, sectionLib }
       doublons = { n, items:[{risque, observe, conseille, sim}] }   (améliorateur FE)
   Auteur : Laure Bonnefond · PréventIA-LaB · 2026
   ===================================================================== */
(function (global) {
  'use strict';

  /* ---------------------------------------------------------------
     1. Design tokens + styles (injectés une seule fois)
     --------------------------------------------------------------- */
  const CSS = `
:root{
  --pvx-navy:oklch(0.30 0.055 250); --pvx-navy-900:oklch(0.22 0.05 252);
  --pvx-teal:oklch(0.66 0.10 195); --pvx-teal-600:oklch(0.58 0.10 196); --pvx-teal-050:oklch(0.96 0.02 195);
  --pvx-orange:oklch(0.72 0.16 55); --pvx-ink:oklch(0.26 0.02 250); --pvx-muted:oklch(0.52 0.02 250);
  --pvx-line:oklch(0.90 0.01 250);
}
.pvx-tabs{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:0 0 16px}
.pvx-tab{border:1px solid var(--pvx-line);background:#fff;color:var(--pvx-ink);padding:9px 14px;border-radius:10px;
  font:500 13.5px/1 "DM Sans",system-ui,sans-serif;cursor:pointer;transition:.15s}
.pvx-tab:hover{border-color:var(--pvx-teal);color:var(--pvx-teal-600)}
.pvx-tab.active{background:var(--pvx-navy);border-color:var(--pvx-navy);color:#fff}
.pvx-btn{border:1px solid var(--pvx-line);background:#fff;padding:7px 12px;border-radius:9px;font-size:12.5px;cursor:pointer}
.pvx-btn:hover{border-color:var(--pvx-teal);color:var(--pvx-teal-600)}
.pvx-sec{background:#fff;border:1px solid var(--pvx-line);border-radius:14px;padding:20px;margin-bottom:14px}
.pvx-eyebrow{font-size:11px;letter-spacing:1.4px;text-transform:uppercase;color:var(--pvx-teal-600);font-weight:600;margin-bottom:10px}
.pvx-sec table,.pvx-a4 table{width:100%;border-collapse:collapse;font-size:12.5px}
.pvx-sec th,.pvx-a4 th{text-align:left;font-size:10.5px;text-transform:uppercase;letter-spacing:.5px;color:var(--pvx-muted);
  border-bottom:1.5px solid var(--pvx-line);padding:6px 6px}
.pvx-sec td,.pvx-a4 td{padding:6px;border-bottom:1px solid oklch(0.95 0.005 250);vertical-align:top}
.pvx-sub{color:var(--pvx-muted);font-size:12px}
.pvx-grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
@media(max-width:820px){.pvx-grid3{grid-template-columns:1fr}}
.pvx-res{background:oklch(0.97 0.008 250);border-radius:12px;padding:14px;text-align:center}
.pvx-res .v{font:700 26px/1 "DM Sans",sans-serif}
.pvx-res .l{font-size:11.5px;color:var(--pvx-muted);margin-top:5px}

/* ---- Niveau 2 : Synthèse A4 ---- */
.pvx-a4{background:#fff;width:100%;max-width:820px;margin:0 auto;padding:26px 30px;border:1px solid var(--pvx-line);
  border-radius:12px;font-size:11.5px;line-height:1.45;color:var(--pvx-ink)}
.pvx-a4-head{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;
  border-bottom:2px solid var(--pvx-navy);padding-bottom:10px;margin-bottom:14px}
.pvx-a4-head .ttl{font-family:"DM Serif Display",Georgia,serif;font-size:24px;line-height:1.1}
.pvx-a4-head .meta{text-align:right;font-size:10.5px;color:var(--pvx-muted)}
.pvx-a4 h5{font-size:10.5px;text-transform:uppercase;letter-spacing:1.1px;color:var(--pvx-teal-600);margin:0 0 6px}
.pvx-block{margin-bottom:12px}
.pvx-idcard{display:grid;grid-template-columns:repeat(4,1fr);gap:6px 14px;font-size:11px;
  background:oklch(0.97 0.01 195);border-radius:9px;padding:9px 12px}
.pvx-idcard b{display:block;font-size:9.5px;text-transform:uppercase;letter-spacing:.5px;color:var(--pvx-muted)}
.pvx-cols{display:grid;grid-template-columns:1fr 1fr;gap:16px}
@media(max-width:760px){.pvx-cols,.pvx-idcard{grid-template-columns:1fr 1fr}}
.pvx-pill{display:inline-block;font-size:10px;padding:1px 7px;border-radius:20px;font-weight:600}
.pvx-pill.ok{background:oklch(0.93 0.06 150);color:oklch(0.40 0.12 150)}
.pvx-pill.warn{background:oklch(0.95 0.08 85);color:oklch(0.45 0.12 70)}
.pvx-pill.no{background:oklch(0.93 0.06 25);color:oklch(0.45 0.16 25)}

/* ---- Niveau 3 : Cockpit ---- */
.pvx-cockpit{background:var(--pvx-navy-900);border-radius:16px;padding:20px;color:oklch(0.92 0.01 250)}
.pvx-cock-head{display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:16px}
.pvx-cock-head .t{font-family:"DM Serif Display",Georgia,serif;font-size:21px;color:#fff}
.pvx-chip{background:oklch(0.35 0.04 250);padding:4px 10px;border-radius:20px;font-size:11px;margin-left:6px;display:inline-block}
.pvx-kpi-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:12px}
.pvx-kpi{background:oklch(0.28 0.04 250);border:1px solid oklch(0.38 0.04 250);border-radius:12px;padding:12px 14px}
.pvx-kpi .k-lab{font-size:10.5px;text-transform:uppercase;letter-spacing:.6px;color:oklch(0.72 0.02 250)}
.pvx-kpi .k-val{font:700 26px/1.1 "DM Sans",sans-serif;color:#fff;margin:5px 0 2px}
.pvx-kpi .k-val small{font-size:12px;font-weight:500;color:oklch(0.75 0.02 250);margin-left:2px}
.pvx-kpi .k-tag{font-size:11px}
.pvx-cock-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
@media(max-width:900px){.pvx-cock-grid{grid-template-columns:1fr}}
.pvx-panel{background:oklch(0.28 0.04 250);border:1px solid oklch(0.38 0.04 250);border-radius:12px;padding:14px}
.pvx-panel.wide{grid-column:1/-1}
.pvx-panel h4{font-size:12px;text-transform:uppercase;letter-spacing:.7px;color:oklch(0.78 0.03 200);margin:0 0 10px}
.pvx-rag{display:flex;align-items:center;gap:9px;padding:5px 0;font-size:12.5px;border-bottom:1px solid oklch(0.35 0.03 250)}
.pvx-rag .d{width:9px;height:9px;border-radius:50%;flex:none}
.pvx-cock-table{width:100%;border-collapse:collapse;font-size:12px}
.pvx-cock-table th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:oklch(0.7 0.02 250);
  border-bottom:1px solid oklch(0.4 0.04 250);padding:5px 6px}
.pvx-cock-table td{padding:5px 6px;border-bottom:1px solid oklch(0.33 0.03 250)}
.pvx-legend{display:flex;gap:12px;flex-wrap:wrap;font-size:10.5px;color:oklch(0.75 0.02 250)}
.pvx-legend i{display:inline-block;width:9px;height:9px;border-radius:3px;margin-right:4px}
.pvx-mention{margin-top:14px;font-size:10.5px;color:var(--pvx-muted);font-style:italic;line-height:1.5}
@media print{.pvx-tabs,.pvx-btn{display:none!important}.pvx-a4{border:0;padding:0;max-width:none}}
`;

  function injectCSS() {
    if (document.getElementById('pvx-style')) return;
    const s = document.createElement('style');
    s.id = 'pvx-style'; s.textContent = CSS;
    document.head.appendChild(s);
  }

  /* ---------------------------------------------------------------
     2. Référentiel des 8 familles PréventIA (identique étude de poste)
     --------------------------------------------------------------- */
  const FAMILLES = [
    { key: 'tms',            nom: 'TMS',                 ic: '🦴', grav: 4 },
    { key: 'chimique',       nom: 'Risque chimique',     ic: '🧪', grav: 5 },
    { key: 'biologique',     nom: 'Risque biologique',   ic: '🦠', grav: 4 },
    { key: 'physique',       nom: 'Risque physique',     ic: '🔊', grav: 3 },
    { key: 'psychosocial',   nom: 'Risques psychosociaux', ic: '🧠', grav: 4 },
    { key: 'organisationnel',nom: 'Risque organisationnel', ic: '🕐', grav: 3 },
    { key: 'accidentel',     nom: 'Risque accidentel',   ic: '⚠️', grav: 5 },
    { key: 'environnemental',nom: 'Environnement de travail', ic: '🌍', grav: 2 }
  ];
  const FAM_GRAVITE = {}; FAMILLES.forEach(f => FAM_GRAVITE[f.key] = f.grav);

  /* Mapping familles de la base « fiche d'entreprise » → 8 familles */
  const MAP_FAM = {
    'TMS': 'tms', 'TMS/Psycho': 'tms',
    'Chimique': 'chimique',
    'Biologique': 'biologique',
    'Ambiances physiques': 'physique', 'Risques physiques': 'physique',
    'Psychosociaux': 'psychosocial',
    'Organisationnel': 'organisationnel',
    'Risques mécaniques': 'accidentel', 'Chutes': 'accidentel', 'Transports': 'accidentel',
    'Autre': 'environnemental'
  };
  /* Correctifs par identifiant de risque (prioritaires sur la famille) */
  const MAP_ID = {
    routier: 'accidentel', machine: 'accidentel', electrique: 'accidentel',
    chute_hauteur: 'accidentel', chute_plain: 'accidentel', coactivite: 'organisationnel',
    ecran: 'tms', postures: 'tms', manutention: 'tms',
    bruit: 'physique', vibrations: 'physique', thermique: 'environnemental',
    incendie: 'accidentel', atex: 'accidentel', isole: 'organisationnel',
    nuit: 'organisationnel', rps: 'psychosocial'
  };
  const famOf = r => MAP_ID[r.id] || MAP_FAM[r.famille] || 'environnemental';

  /* ---------------------------------------------------------------
     3. Scoring (aligné sur la sémantique « étude de poste »)
        score 0 = risque maîtrisé · 100 = situation critique
     --------------------------------------------------------------- */
  const SURV_GRAV = { SIR: 5, SIA: 4, SI: 3, '-': 2 };
  const MAIT_PROB = { maitrise: 1, partiel: 3, non: 5 };  // probabilité résiduelle 1..5
  const PROB_DEFAUT = 3;                                  // non évalué → prudence

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function riskRow(r, answers) {
    const a = answers[r.id];
    const grav = SURV_GRAV[r.surveillance] || 2;
    const prob = (a && a !== 'nc') ? (MAIT_PROB[a] ?? PROB_DEFAUT) : PROB_DEFAUT;
    const evalue = !!(a && a !== 'nc');
    const residuel = Math.round(grav * prob / 25 * 100);
    return { r, fam: famOf(r), grav, prob, evalue, residuel, maitrise: a || null };
  }
  function rowsOf(A, answers) { return (A.risks || []).map(r => riskRow(r, answers)); }

  function famScores(rows) {
    const o = {}; FAMILLES.forEach(f => o[f.key] = 0);
    FAMILLES.forEach(f => {
      const rs = rows.filter(x => x.fam === f.key);
      o[f.key] = rs.length ? Math.round(rs.reduce((s, x) => s + x.residuel, 0) / rs.length) : 0;
    });
    return o;
  }
  function globalScore(rows) {
    if (!rows.length) return 0;
    let num = 0, den = 0;
    rows.forEach(x => { const w = x.grav; num += x.residuel * w; den += w; });
    return Math.round(clamp(num / (den || 1), 0, 100));
  }
  function band(s) {
    if (s <= 20) return { lab: 'Faible', hex: '#1f9d55' };
    if (s <= 40) return { lab: 'Surveillance', hex: '#d6b400' };
    if (s <= 60) return { lab: 'Amélioration nécessaire', hex: '#e58a2a' };
    if (s <= 80) return { lab: 'Risque élevé', hex: '#d23f2f' };
    return { lab: 'Situation critique', hex: '#4a2320' };
  }

  /* ---------------------------------------------------------------
     4. Visualisations SVG (mêmes primitives que l'étude de poste)
     --------------------------------------------------------------- */
  function svgRadar(scores, opts = {}) {
    const keys = FAMILLES.map(f => f.key);
    const labels = FAMILLES.map(f => f.nom.split('(')[0].trim());
    const cx = 170, cy = 155, R = 105, n = keys.length, dark = opts.dark;
    const ang = i => (-90 + i * 360 / n) * Math.PI / 180;
    const pt = (i, r) => [cx + Math.cos(ang(i)) * r, cy + Math.sin(ang(i)) * r];
    const gridCol = dark ? '#4a5a72' : '#e6eaf0';
    let g = '';
    [25, 50, 75, 100].forEach(l => {
      g += `<polygon points="${keys.map((_, i) => pt(i, R * l / 100).join(',')).join(' ')}" fill="none" stroke="${gridCol}" stroke-width="1"/>`;
    });
    keys.forEach((_, i) => { const [x, y] = pt(i, R); g += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="${gridCol}"/>`; });
    const poly = keys.map((k, i) => pt(i, R * (scores[k] || 0) / 100).join(',')).join(' ');
    g += `<polygon points="${poly}" fill="oklch(0.66 0.10 195 / .28)" stroke="oklch(0.58 0.10 196)" stroke-width="2"/>`;
    keys.forEach((k, i) => { const [x, y] = pt(i, R * (scores[k] || 0) / 100); g += `<circle cx="${x}" cy="${y}" r="3" fill="oklch(0.58 0.10 196)"/>`; });
    labels.forEach((lb, i) => {
      const [x, y] = pt(i, R + 22);
      const anchor = Math.abs(x - cx) < 12 ? 'middle' : (x < cx ? 'end' : 'start');
      g += `<text x="${x}" y="${y}" font-size="9.5" fill="${dark ? '#c6cfdd' : '#5a667a'}" text-anchor="${anchor}" dominant-baseline="middle">${esc(lb)}</text>`;
    });
    return `<svg viewBox="0 0 340 300" width="100%" style="max-width:360px">${g}</svg>`;
  }

  function svgGauge(score, opts = {}) {
    const b = band(score), dark = opts.dark, cx = 110, cy = 120, r = 90;
    const arc = (from, to, color, w) => {
      const p1 = [cx + r * Math.cos(from * Math.PI / 180), cy - r * Math.sin(from * Math.PI / 180)];
      const p2 = [cx + r * Math.cos(to * Math.PI / 180), cy - r * Math.sin(to * Math.PI / 180)];
      return `<path d="M ${p1[0]} ${p1[1]} A ${r} ${r} 0 0 1 ${p2[0]} ${p2[1]}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round"/>`;
    };
    let g = '';
    [[0, 20, '#1f9d55'], [20, 40, '#d6b400'], [40, 60, '#e58a2a'], [60, 80, '#d23f2f'], [80, 100, '#4a2320']]
      .forEach(s => g += arc(180 - s[0] / 100 * 180, 180 - s[1] / 100 * 180, s[2], 13));
    const a = (180 - score / 100 * 180) * Math.PI / 180;
    g += `<line x1="${cx}" y1="${cy}" x2="${cx + (r - 18) * Math.cos(a)}" y2="${cy - (r - 18) * Math.sin(a)}" stroke="${dark ? '#fff' : '#2a3345'}" stroke-width="3" stroke-linecap="round"/>`;
    g += `<circle cx="${cx}" cy="${cy}" r="6" fill="${dark ? '#fff' : '#2a3345'}"/>`;
    g += `<text x="${cx}" y="${cy - 20}" text-anchor="middle" font-family="DM Serif Display,serif" font-size="34" fill="${b.hex}">${score}</text>`;
    g += `<text x="${cx}" y="${cy + 2}" text-anchor="middle" font-size="10" fill="${dark ? '#aeb8c8' : '#7a8598'}">/ 100</text>`;
    return `<svg viewBox="0 0 220 140" width="100%" style="max-width:240px">${g}</svg>`;
  }

  function svgMatrix(rows, dark) {
    const cell = 46, ox = 42, oy = 14, W = ox + cell * 5 + 16, H = oy + cell * 5 + 34;
    const scale = [['#e9f7ef'], ['#fff7db'], ['#ffe9d4'], ['#fbe0dc'], ['#efd7d3']];
    const crit = (g, p) => { const c = g * p; return c <= 4 ? 0 : c <= 9 ? 1 : c <= 14 ? 2 : c <= 19 ? 3 : 4; };
    let g = '';
    for (let gr = 5; gr >= 1; gr--) for (let pr = 1; pr <= 5; pr++) {
      g += `<rect x="${ox + (pr - 1) * cell}" y="${oy + (5 - gr) * cell}" width="${cell - 3}" height="${cell - 3}" rx="6" fill="${scale[crit(gr, pr)][0]}" stroke="${dark ? '#3a4658' : '#e6eaf0'}"/>`;
    }
    const placed = {};
    rows.forEach(x => {
      const key = x.grav + '-' + x.prob; placed[key] = (placed[key] || 0);
      const cxp = ox + (x.prob - 1) * cell + cell / 2 - 1;
      const cyp = oy + (5 - x.grav) * cell + cell / 2 - 1 - placed[key] * 9;
      placed[key]++;
      if (placed[key] > 3) return;
      g += `<circle cx="${cxp}" cy="${cyp}" r="8" fill="oklch(0.30 0.055 250)" stroke="#fff" stroke-width="1.5"/>`;
      g += `<text x="${cxp}" y="${cyp + 3}" text-anchor="middle" font-size="7.5" fill="#fff" font-weight="700">${esc((x.r.court || x.r.id || '').slice(0, 2).toUpperCase())}</text>`;
    });
    const axCol = dark ? '#aeb8c8' : '#7a8598';
    for (let i = 1; i <= 5; i++) g += `<text x="${ox + (i - 1) * cell + cell / 2 - 1}" y="${oy + 5 * cell + 14}" text-anchor="middle" font-size="9" fill="${axCol}">${i}</text>`;
    for (let gr = 1; gr <= 5; gr++) g += `<text x="${ox - 8}" y="${oy + (5 - gr) * cell + cell / 2}" text-anchor="end" font-size="9" fill="${axCol}">${gr}</text>`;
    g += `<text x="${ox + cell * 2.5}" y="${H - 2}" text-anchor="middle" font-size="9.5" fill="${dark ? '#c6cfdd' : '#5a667a'}" font-weight="600">Probabilité (résiduelle) →</text>`;
    g += `<text x="12" y="${oy + cell * 2.5}" text-anchor="middle" font-size="9.5" fill="${dark ? '#c6cfdd' : '#5a667a'}" font-weight="600" transform="rotate(-90 12 ${oy + cell * 2.5})">Gravité →</text>`;
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:300px">${g}</svg>`;
  }

  function svgBars(data, opts = {}) {
    const dark = opts.dark, W = 340, bh = 24, gap = 11, ox = 126, oy = 8;
    const H = oy + data.length * (bh + gap);
    let g = '';
    data.forEach((d, i) => {
      const y = oy + i * (bh + gap), w = (W - ox - 20) * clamp(d.val, 0, 100) / 100;
      g += `<text x="${ox - 8}" y="${y + bh / 2 + 4}" text-anchor="end" font-size="10.5" fill="${dark ? '#c6cfdd' : '#5a667a'}">${esc(d.lab)}</text>`;
      g += `<rect x="${ox}" y="${y}" width="${W - ox - 20}" height="${bh}" rx="6" fill="${dark ? '#3a4658' : '#eef1f6'}"/>`;
      g += `<rect x="${ox}" y="${y}" width="${Math.max(w, 3)}" height="${bh}" rx="6" fill="${d.col || 'oklch(0.58 0.10 196)'}"/>`;
      g += `<text x="${ox + Math.max(w, 3) + 6}" y="${y + bh / 2 + 4}" font-size="10.5" font-weight="700" fill="${dark ? '#e6ebf3' : '#3a4658'}">${Math.round(d.val)}</text>`;
    });
    return `<svg viewBox="0 0 ${W} ${H}" width="100%">${g}</svg>`;
  }

  function svgTimeline(actions, dark) {
    if (!actions.length) return `<div class="pvx-sub">Aucune action prioritaire : les risques identifiés sont déclarés maîtrisés.</div>`;
    const W = 680, rowH = 30, ox = 8, oy = 22, months = 12, plotW = W - 180 - ox;
    let g = `<text x="180" y="12" font-size="9" fill="${dark ? '#aeb8c8' : '#7a8598'}">Échéance (mois) →</text>`;
    for (let m = 3; m <= months; m += 3) {
      const x = 180 + plotW * m / months;
      g += `<line x1="${x}" y1="16" x2="${x}" y2="${oy + actions.length * rowH}" stroke="${dark ? '#3a4658' : '#eef1f6'}"/><text x="${x}" y="12" font-size="8" fill="${dark ? '#8a94a6' : '#9aa3b2'}" text-anchor="middle">${m}</text>`;
    }
    actions.forEach((a, i) => {
      const y = oy + i * rowH, x = 180 + plotW * a.mois / months;
      const col = a.prio === '🔴' ? '#d23f2f' : a.prio === '🟠' ? '#e58a2a' : '#1f9d55';
      g += `<text x="${ox}" y="${y + 14}" font-size="9.5" fill="${dark ? '#c6cfdd' : '#5a667a'}">${esc(a.txt.slice(0, 30))}</text>`;
      g += `<rect x="180" y="${y + 5}" width="${x - 180}" height="10" rx="5" fill="${col}" opacity="0.28"/>`;
      g += `<circle cx="${x}" cy="${y + 10}" r="6" fill="${col}"/>`;
    });
    return `<svg viewBox="0 0 ${W} ${oy + actions.length * rowH + 6}" width="100%">${g}</svg>`;
  }

  /* ---------------------------------------------------------------
     5. Analyses dérivées : plan d'action, synthèse
     --------------------------------------------------------------- */
  function planAction(rows) {
    const plan = [];
    rows.filter(x => x.residuel >= 25 || (x.r.surveillance === 'SIR' && x.maitrise !== 'maitrise'))
      .sort((a, b) => b.residuel - a.residuel)
      .forEach(x => {
        const prio = x.residuel >= 60 ? '🔴' : x.residuel >= 36 ? '🟠' : '🟢';
        const mois = x.residuel >= 60 ? 3 : x.residuel >= 36 ? 6 : 12;
        const epc = (x.r.epc && x.r.epc !== '—') ? x.r.epc.split(',')[0].trim() : 'mesure collective à définir';
        plan.push({
          prio, mois,
          txt: `${x.r.label} — ${epc}`,
          fam: FAMILLES.find(f => f.key === x.fam).nom,
          epc: x.r.epc || '—', epi: x.r.epi || '—',
          ref: x.r.ref || '—',
          impact: x.residuel >= 60 ? 'Fort' : x.residuel >= 36 ? 'Moyen' : 'Modéré',
          resp: x.r.surveillance === 'SIR' ? 'Employeur + SPSTI' : 'Employeur'
        });
      });
    return plan.slice(0, 12);
  }

  function synthese(rows, S, doublons) {
    const fs = famScores(rows);
    const top = FAMILLES.filter(f => fs[f.key] >= 36).sort((a, b) => fs[b.key] - fs[a.key]);
    const maitrises = rows.filter(x => x.maitrise === 'maitrise').map(x => x.r.court || x.r.label);
    const nonEval = rows.filter(x => !x.evalue).map(x => x.r.court || x.r.label);
    const sir = rows.filter(x => x.r.surveillance === 'SIR');
    const g = globalScore(rows), b = band(g);
    let concl = `Indice PréventIA® de maîtrise : ${S && S.indice != null ? S.indice : '—'}/100. `
      + `Score de risque résiduel pondéré : ${g}/100 (${b.lab.toLowerCase()}). `
      + `${rows.length} risque(s) identifié(s), dont ${sir.length} relevant d'un suivi individuel renforcé. `;
    if (top.length) concl += `Familles prioritaires : ${top.slice(0, 3).map(f => f.nom).join(', ')}. `;
    if (nonEval.length) concl += `${nonEval.length} risque(s) restent à évaluer in situ. `;
    if (doublons && doublons.n) concl += `${doublons.n} redondance(s) « observé / conseillé » détectée(s) : à arbitrer avant diffusion. `;
    concl += `Document d'aide à la rédaction (art. R.4624-46) — à valider par le médecin du travail après visite d'entreprise.`;
    return {
      familles: top.map(f => `${f.nom} (${fs[f.key]})`),
      protecteurs: maitrises.slice(0, 6),
      expertise: nonEval.slice(0, 6),
      sir: sir.map(x => x.r.label),
      conclusion: concl, g, b, fs
    };
  }

  /* ---------------------------------------------------------------
     6. Rendu des 3 niveaux
     --------------------------------------------------------------- */
  const MENTION = `Fiche d'entreprise établie au titre de l'article R.4624-46 du Code du travail. Ce document est descriptif et non prescriptif : il recense les risques et les moyens de prévention constatés. Les scores et diagrammes sont des indicateurs d'aide à la décision (méthode PréventIA®), sans valeur réglementaire. Toute cotation doit être confirmée par une visite in situ et validée par le médecin du travail.`;

  function head(ctx) {
    const m = ctx.meta || {};
    return { m, date: m.date || new Date().toISOString().slice(0, 10) };
  }

  /* --- Niveau 1 : Étude expert --- */
  function drawExpert(ctx) {
    const { A, S, answers, doublons } = ctx;
    const { m, date } = head(ctx);
    const rows = rowsOf(A, answers), fs = famScores(rows), ia = synthese(rows, S, doublons);
    const sec = (t, body) => `<div class="pvx-sec"><div class="pvx-eyebrow">${t}</div>${body}</div>`;

    const idCard = `<div class="pvx-idcard" style="grid-template-columns:repeat(3,1fr)">
      <div><b>Entreprise</b>${esc(m.entreprise || '—')}</div>
      <div><b>Code NAF / APE</b>${esc(m.naf || '—')} — ${esc(m.nafLib || '—')}</div>
      <div><b>Section</b>${esc(m.section || '—')} · ${esc(m.sectionLib || '')}</div>
      <div><b>Effectif</b>${esc(m.effectif || (S && S.effExpose) || '—')}</div>
      <div><b>Taille</b>${esc(A.taille ? A.taille.label : '—')}</div>
      <div><b>Date / préventeur</b>${esc(date)} · ${esc(m.preventeur || '—')}</div>
    </div>`;

    const famTable = `<table><thead><tr><th>Famille</th><th>Score résiduel /100</th><th>Niveau</th><th>Risques rattachés</th></tr></thead><tbody>${
      FAMILLES.map(f => {
        const rs = rows.filter(x => x.fam === f.key);
        if (!rs.length) return '';
        const bb = band(fs[f.key]);
        return `<tr><td>${f.ic} ${esc(f.nom)}</td><td><b style="color:${bb.hex}">${fs[f.key]}</b></td><td>${bb.lab}</td>
          <td class="pvx-sub">${rs.map(x => esc(x.r.court || x.r.label)).join(', ')}</td></tr>`;
      }).join('') || '<tr><td colspan="4" class="pvx-sub">Aucun risque sélectionné</td></tr>'}</tbody></table>`;

    const risqTable = `<table><thead><tr><th>Risque</th><th>Famille</th><th>Suivi</th><th>Maîtrise</th><th>Gravité</th><th>Proba</th><th>Résiduel</th><th>Référence</th></tr></thead><tbody>${
      rows.map(x => {
        const pill = x.maitrise === 'maitrise' ? '<span class="pvx-pill ok">Maîtrisé</span>'
          : x.maitrise === 'partiel' ? '<span class="pvx-pill warn">Partiel</span>'
          : x.maitrise === 'non' ? '<span class="pvx-pill no">Non</span>'
          : '<span class="pvx-sub">Non évalué</span>';
        const bb = band(x.residuel);
        return `<tr><td><b>${esc(x.r.label)}</b><div class="pvx-sub">${esc(x.r.fe || '')}</div></td>
          <td class="pvx-sub">${esc(FAMILLES.find(f => f.key === x.fam).nom)}</td>
          <td>${esc(x.r.surveillance)}</td><td>${pill}</td><td>${x.grav}</td><td>${x.prob}</td>
          <td><b style="color:${bb.hex}">${x.residuel}</b></td><td class="pvx-sub">${esc(x.r.ref || '—')}</td></tr>`;
      }).join('') || '<tr><td colspan="8" class="pvx-sub">Aucun risque</td></tr>'}</tbody></table>`;

    const moyensTable = `<table><thead><tr><th>Risque</th><th>Protection collective (EPC)</th><th>Protection individuelle (EPI)</th><th>Maladies pro.</th></tr></thead><tbody>${
      rows.map(x => `<tr><td>${esc(x.r.court || x.r.label)}</td><td class="pvx-sub">${esc(x.r.epc || '—')}</td>
        <td class="pvx-sub">${esc(x.r.epi || '—')}</td><td class="pvx-sub">${esc(x.r.mp || '—')}</td></tr>`).join('')
      || '<tr><td colspan="4" class="pvx-sub">—</td></tr>'}</tbody></table>`;

    const plan = planAction(rows);
    const planTable = `<table><thead><tr><th>Prio</th><th>Action</th><th>Famille</th><th>Impact</th><th>Échéance</th><th>Responsable</th><th>Référence</th></tr></thead><tbody>${
      plan.map(a => `<tr><td>${a.prio}</td><td>${esc(a.txt)}</td><td class="pvx-sub">${esc(a.fam)}</td><td>${a.impact}</td>
        <td>${a.mois} mois</td><td>${esc(a.resp)}</td><td class="pvx-sub">${esc(a.ref)}</td></tr>`).join('')
      || '<tr><td colspan="7" class="pvx-sub">Aucune action prioritaire</td></tr>'}</tbody></table>`;

    const doubTable = (doublons && doublons.items && doublons.items.length)
      ? `<table><thead><tr><th>Risque</th><th>Observé</th><th>Conseillé</th><th>Similarité</th></tr></thead><tbody>${
        doublons.items.slice(0, 15).map(d => `<tr><td>${esc(d.risque || '—')}</td><td class="pvx-sub">${esc(d.observe)}</td>
          <td class="pvx-sub">${esc(d.conseille)}</td><td><b style="color:#d23f2f">${Math.round((d.sim || 0) * 100)} %</b></td></tr>`).join('')
      }</tbody></table><div class="pvx-sub" style="margin-top:8px">Une mesure déjà <b>observée</b> ne doit pas être reformulée en <b>conseil</b> : arbitrer (supprimer le doublon ou monter le conseil d'un cran).</div>`
      : `<div class="pvx-sub">Aucune redondance détectée entre les colonnes « observé » et « conseillé » (seuil Jaccard 0,55).</div>`;

    return `<div id="pvxExpert">
      ${sec('1 · Identification de l’entreprise', idCard)}
      ${sec('2 · Unités de travail & métiers', `<div class="pvx-sub">Unités : ${A.unites.map(u => esc(u.label)).join(' · ') || '—'}</div>
        <div class="pvx-sub" style="margin-top:6px">Métiers : ${A.metiers.map(x => esc(x.label)).join(' · ') || '—'}</div>`)}
      ${sec('3 · Risques professionnels — cotation détaillée', risqTable)}
      ${sec('4 · Synthèse par famille (8 familles PréventIA)', famTable)}
      ${sec('5 · Moyens de prévention en place', moyensTable)}
      ${sec('6 · Contrôle qualité — doublons « observé / conseillé »', doubTable)}
      ${sec('7 · Analyse', `<div style="font-size:13.5px;line-height:1.75">
        <b>Familles prioritaires :</b> ${ia.familles.join(' · ') || 'aucune'}<br>
        <b>Postes en suivi renforcé (SIR) :</b> ${ia.sir.map(esc).join(' · ') || 'aucun'}<br>
        <b>Facteurs protecteurs (déclarés maîtrisés) :</b> ${ia.protecteurs.map(esc).join(' · ') || '—'}<br>
        <b>À expertiser in situ :</b> ${ia.expertise.map(esc).join(' · ') || '—'}</div>`)}
      ${sec('8 · Préconisations & plan d’action priorisé', planTable)}
      ${sec('9 · Conclusion', `<div style="background:var(--pvx-teal-050);padding:12px 14px;border-radius:10px;font-size:13.5px">${esc(ia.conclusion)}</div>`)}
      <div class="pvx-mention">${MENTION}</div>
    </div>`;
  }

  /* --- Niveau 2 : Synthèse A4 --- */
  function drawSynth(ctx) {
    const { A, S, answers, doublons } = ctx;
    const { m, date } = head(ctx);
    const rows = rowsOf(A, answers), fs = famScores(rows), ia = synthese(rows, S, doublons);
    const g = ia.g, b = ia.b;
    const plan = planAction(rows);

    const topRows = rows.slice().sort((a, b2) => b2.residuel - a.residuel).slice(0, 7).map(x => {
      const bb = band(x.residuel);
      const pill = x.maitrise === 'maitrise' ? '<span class="pvx-pill ok">✅</span>'
        : x.maitrise === 'partiel' ? '<span class="pvx-pill warn">⚠️</span>'
        : x.maitrise === 'non' ? '<span class="pvx-pill no">❌</span>' : '—';
      return `<tr><td>${esc(x.r.court || x.r.label)}</td><td>${esc(x.r.surveillance)}</td><td>${x.grav}</td><td>${x.prob}</td>
        <td><b style="color:${bb.hex}">${x.residuel}</b></td><td style="text-align:center">${pill}</td></tr>`;
    }).join('') || '<tr><td colspan="6" class="pvx-sub">Aucun risque renseigné</td></tr>';

    const planRows = plan.slice(0, 5).map(a => `<tr><td style="text-align:center">${a.prio}</td><td>${esc(a.txt)}</td>
      <td>${a.impact}</td><td>${a.mois} mois</td><td>${esc(a.resp)}</td></tr>`).join('')
      || '<tr><td colspan="5" class="pvx-sub">—</td></tr>';

    /* Répartition des contraintes = 5 macro-axes agrégés des 8 familles */
    const contraintes = [
      { lab: 'Physiques', val: Math.round((fs.tms + fs.physique) / 2) },
      { lab: 'Chimiques / biologiques', val: Math.round((fs.chimique + fs.biologique) / 2) },
      { lab: 'Organisationnelles', val: fs.organisationnel },
      { lab: 'Psychosociales', val: fs.psychosocial },
      { lab: 'Accidentelles', val: Math.round((fs.accidentel + fs.environnemental) / 2) }
    ];

    return `<div class="pvx-a4" id="pvxA4">
      <div class="pvx-a4-head">
        <div><div class="ttl">Synthèse décisionnelle</div>
          <div style="font-size:11px;color:var(--pvx-muted)">PréventIA-LaB · fiche d’entreprise (art. R.4624-46)</div></div>
        <div class="meta"><b>${esc(m.entreprise || '—')}</b><br>${esc(m.naf || '')} · ${esc((m.nafLib || '').slice(0, 40))}<br>${esc(date)} · ${esc(m.preventeur || '')}</div>
      </div>

      <div class="pvx-block pvx-idcard">
        <div><b>NAF</b>${esc(m.naf || '—')}</div>
        <div><b>Section</b>${esc(m.section || '—')}</div>
        <div><b>Effectif</b>${esc(m.effectif || (S && S.effExpose) || '—')}</div>
        <div><b>Risques / dont SIR</b>${rows.length} / ${(S && S.cSIR) || rows.filter(x => x.r.surveillance === 'SIR').length}</div>
      </div>

      <div class="pvx-cols">
        <div>
          <div class="pvx-block"><h5>Risques critiques</h5>
            <table><thead><tr><th>Risque</th><th>Suivi</th><th>G</th><th>P</th><th>Résid.</th><th>Maîtr.</th></tr></thead>
            <tbody>${topRows}</tbody></table></div>
          <div class="pvx-block"><h5>Répartition des contraintes</h5>${svgBars(contraintes)}</div>
        </div>
        <div>
          <div class="pvx-block" style="text-align:center"><h5>Score PréventIA (risque résiduel)</h5>${svgGauge(g)}
            <div style="font-weight:700;color:${b.hex};font-size:13px">${b.lab}</div>
            <div class="pvx-sub">Indice de maîtrise : ${S && S.indice != null ? S.indice + '/100' : 'non évalué'}</div></div>
          <div class="pvx-cols" style="margin-top:6px;gap:8px">
            <div><h5>Familles de risques</h5>${svgRadar(fs)}</div>
            <div><h5>Gravité × probabilité</h5>${svgMatrix(rows, false)}</div>
          </div>
        </div>
      </div>

      <div class="pvx-cols">
        <div class="pvx-block"><h5>Points clés</h5>
          <div style="font-size:10.5px;line-height:1.55">
            <b>Familles prioritaires :</b> ${ia.familles.join(' · ') || 'aucune'}<br>
            <b>Suivi renforcé (SIR) :</b> ${ia.sir.map(esc).join(' · ') || 'aucun'}<br>
            <b>Facteurs protecteurs :</b> ${ia.protecteurs.map(esc).join(' · ') || '—'}<br>
            <b>À expertiser :</b> ${ia.expertise.map(esc).join(' · ') || '—'}<br>
            <b>Doublons observé/conseillé :</b> ${(doublons && doublons.n) || 0}
          </div></div>
        <div class="pvx-block"><h5>Conclusion</h5>
          <div style="font-size:10.5px;line-height:1.55;background:var(--pvx-teal-050);padding:8px 10px;border-radius:8px">${esc(ia.conclusion)}</div></div>
      </div>

      <div class="pvx-block"><h5>Plan d’action priorisé</h5>
        <table><thead><tr><th>Prio</th><th>Action</th><th>Impact</th><th>Échéance</th><th>Responsable</th></tr></thead><tbody>${planRows}</tbody></table></div>

      <div class="pvx-mention">${MENTION}</div>
    </div>`;
  }

  /* --- Niveau 3 : Cockpit --- */
  function drawCockpit(ctx) {
    const { A, S, answers, doublons } = ctx;
    const { m, date } = head(ctx);
    const rows = rowsOf(A, answers), fs = famScores(rows), ia = synthese(rows, S, doublons);
    const g = ia.g, b = ia.b, plan = planAction(rows);
    const critiques = FAMILLES.filter(f => fs[f.key] >= 61).length;
    const nonMaitrises = rows.filter(x => x.maitrise === 'non' || x.maitrise === 'partiel').length;
    const nonEval = rows.filter(x => !x.evalue).length;
    const cSIR = rows.filter(x => x.r.surveillance === 'SIR').length;

    const kpi = (lab, val, unit, tag, col) => `<div class="pvx-kpi"><div class="k-lab">${lab}</div>
      <div class="k-val">${val}${unit ? `<small>${unit}</small>` : ''}</div><div class="k-tag" style="color:${col || '#9fb4c8'}">${tag || ''}</div></div>`;
    const rag = (lab, v) => { const bb = band(v); return `<div class="pvx-rag"><span class="d" style="background:${bb.hex}"></span><span style="flex:1">${lab}</span><b>${v}</b></div>`; };

    const riskRows = FAMILLES.filter(f => rows.some(x => x.fam === f.key)).map(f => {
      const bb = band(fs[f.key]);
      return `<tr><td>${f.ic} ${esc(f.nom)}</td><td><b style="color:${bb.hex}">${fs[f.key]}</b></td><td>${f.grav}</td>
        <td>${rows.filter(x => x.fam === f.key).length}</td><td><span style="color:${bb.hex}">●</span> ${bb.lab}</td></tr>`;
    }).join('') || '<tr><td colspan="5">—</td></tr>';

    return `<div class="pvx-cockpit" id="pvxCockpit">
      <div class="pvx-cock-head">
        <div class="t">Cockpit décisionnel — ${esc(m.entreprise || 'entreprise')}</div>
        <div><span class="pvx-chip">NAF ${esc(m.naf || '—')}</span><span class="pvx-chip">Section ${esc(m.section || '—')}</span>
          <span class="pvx-chip">${esc(A.taille ? A.taille.label : '—')}</span><span class="pvx-chip">${esc(date)}</span></div>
      </div>

      <div class="pvx-kpi-row">
        ${kpi('Score risque résiduel', g, '/100', b.lab, b.hex)}
        ${kpi('Indice PréventIA®', S && S.indice != null ? S.indice : '—', '/100', 'maîtrise pondérée', '#8fd0e0')}
        ${kpi('Risques identifiés', rows.length, '', `dont ${cSIR} en SIR`, cSIR ? '#e58a2a' : '#4fbf7a')}
        ${kpi('Familles critiques', critiques, '', critiques ? 'à traiter' : 'aucune', critiques ? '#d23f2f' : '#4fbf7a')}
        ${kpi('Salariés exposés', (S && S.effExpose) || m.effectif || '—', '', 'effectif renseigné', '#8fd0e0')}
      </div>
      <div class="pvx-kpi-row">
        ${kpi('Non ou partiellement maîtrisés', nonMaitrises, '', 'préconisations', nonMaitrises ? '#e58a2a' : '#4fbf7a')}
        ${kpi('Risques non évalués', nonEval, '', 'à voir in situ', nonEval ? '#e6c34a' : '#4fbf7a')}
        ${kpi('Taux de maîtrise', S && S.tauxMaitrise != null ? S.tauxMaitrise : '—', '%', `${(S && S.answered) || 0}/${rows.length} évalués`, '#8fd0e0')}
        ${kpi('Niveau documentaire', (S && S.docScore) || 0, '%', 'risques référencés', '#c9a26b')}
        ${kpi('Doublons obs./conseil', (doublons && doublons.n) || 0, '', 'améliorateur FE', (doublons && doublons.n) ? '#d23f2f' : '#4fbf7a')}
      </div>

      <div class="pvx-cock-grid">
        <div class="pvx-panel"><h4>Radar des 8 familles</h4>${svgRadar(fs, { dark: true })}</div>
        <div class="pvx-panel" style="text-align:center"><h4>Jauge du score</h4>${svgGauge(g, { dark: true })}
          <div style="color:${b.hex};font-weight:700;margin-top:4px">${b.lab}</div></div>
        <div class="pvx-panel"><h4>Matrice gravité × probabilité</h4>${svgMatrix(rows, true)}</div>

        <div class="pvx-panel"><h4>Histogramme des familles</h4>
          ${svgBars(FAMILLES.filter(f => rows.some(x => x.fam === f.key)).map(f => ({ lab: f.nom.slice(0, 14), val: fs[f.key], col: band(fs[f.key]).hex })), { dark: true })}</div>
        <div class="pvx-panel wide"><h4>Indicateurs RAG — synthèse</h4>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 26px">
            <div>${rag('TMS', fs.tms)}${rag('Chimique', fs.chimique)}${rag('Biologique', fs.biologique)}${rag('Physique', fs.physique)}</div>
            <div>${rag('RPS', fs.psychosocial)}${rag('Organisationnel', fs.organisationnel)}${rag('Accidentel', fs.accidentel)}${rag('Environnement', fs.environnemental)}</div>
          </div></div>

        <div class="pvx-panel wide"><h4>Chronologie du plan d’action</h4>${svgTimeline(plan.map(a => ({ txt: a.txt, mois: a.mois, prio: a.prio })), true)}
          <div class="pvx-legend" style="margin-top:8px"><span><i style="background:#d23f2f"></i>≤ 3 mois</span><span><i style="background:#e58a2a"></i>≤ 6 mois</span><span><i style="background:#1f9d55"></i>≤ 12 mois</span></div></div>

        <div class="pvx-panel wide"><h4>Tableau des familles de risques</h4>
          <table class="pvx-cock-table"><thead><tr><th>Famille</th><th>Score résiduel</th><th>Gravité</th><th>Nb risques</th><th>Niveau</th></tr></thead>
          <tbody>${riskRows}</tbody></table></div>
      </div>

      <div style="margin-top:14px;padding:12px 14px;background:oklch(0.3 0.04 250 /.5);border-radius:12px;font-size:12.5px">
        <b style="color:#fff">Avis pour le médecin du travail —</b> ${esc(ia.conclusion)}
      </div>
    </div>`;
  }

  /* ---------------------------------------------------------------
     7. Contrôleur
     --------------------------------------------------------------- */
  let _tab = 'synth', _ctx = null, _el = null;

  function render(target, ctx) {
    injectCSS();
    _el = (typeof target === 'string') ? document.getElementById(target) : target;
    if (!_el) return;
    if (ctx) _ctx = ctx;
    if (!_ctx || !_ctx.A) { _el.innerHTML = '<p class="pvx-sub">Sélectionnez un code NAF et des métiers pour générer les restitutions.</p>'; return; }
    _ctx.answers = _ctx.answers || {};
    const tabs = `<div class="pvx-tabs">
      <button class="pvx-tab ${_tab === 'expert' ? 'active' : ''}" data-t="expert">📚 Étude expert (N1)</button>
      <button class="pvx-tab ${_tab === 'synth' ? 'active' : ''}" data-t="synth">📄 Synthèse A4 (N2)</button>
      <button class="pvx-tab ${_tab === 'cockpit' ? 'active' : ''}" data-t="cockpit">📊 Cockpit médecin (N3)</button>
      <div style="flex:1"></div>
      <button class="pvx-btn" onclick="window.print()">🖨️ Imprimer / PDF</button>
      <button class="pvx-btn" onclick="PVX.exportWord()">📝 Word</button>
    </div><div id="pvxBody"></div>`;
    _el.innerHTML = tabs;
    document.getElementById('pvxBody').innerHTML =
      ({ expert: drawExpert, synth: drawSynth, cockpit: drawCockpit })[_tab](_ctx);
    _el.querySelectorAll('.pvx-tab').forEach(b => b.onclick = () => { _tab = b.dataset.t; render(_el, _ctx); });
  }

  /* Export Word (docx via Blob HTML — compatible Word/LibreOffice) */
  function exportWord() {
    const body = document.getElementById('pvxBody');
    if (!body) return;
    const m = (_ctx && _ctx.meta) || {};
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>Fiche d'entreprise</title><style>
body{font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#222}
table{border-collapse:collapse;width:100%;font-size:9.5pt}th,td{border:1px solid #ccc;padding:4px 6px;text-align:left}
th{background:#e9eef3}h1{font-size:16pt}.pvx-eyebrow{font-weight:bold;color:#0E7C86;text-transform:uppercase;font-size:9pt}
</style></head><body><h1>Fiche d'entreprise — ${esc(m.entreprise || '')}</h1>${body.innerHTML}</body></html>`;
    const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `FE_${(m.entreprise || 'entreprise').replace(/\W+/g, '_')}_${_tab}.doc`;
    a.click(); URL.revokeObjectURL(a.href);
  }

  global.PVX = {
    render, exportWord,
    setTab: t => { _tab = t; render(_el, _ctx); },
    svgGauge, svgRadar, svgMatrix, svgBars, svgTimeline,
    FAMILLES, famScores, globalScore, band, rowsOf, planAction, synthese
  };
})(window);
