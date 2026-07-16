/* =====================================================================
   PréventIA-LaB — Améliorateur de fiche d'entreprise (module autonome)
   ---------------------------------------------------------------------
   Remplace l'ancien bloc inline « ame* » de fiche-entreprise/index.html.

   Chaîne complète :
     .docx importé → mammoth (texte brut) → parsing robuste (3 stratégies)
     → ÉDITEUR à l'écran (tout est modifiable) → export .docx charté.

   Dépendances globales attendues (déclarées dans index.html) :
     DB, M, doublons, esc, draw()
   Dépendances externes : mammoth (lecture .docx), DocxLoader + docx (export)

   API exposée :
     window.ameImportDocx(file) · ameRun() · ameDemo() · ameExportDocx()
     window.AME.state  → état courant { meta, risqueRows, precoRows, ... }
   ===================================================================== */
(function (global) {
  'use strict';

  /* ═════════ CHARTE (source unique de vérité pour l'écran ET le .docx) ═════════ */
  const CHARTE = {
    navy: '12303F',      // titres de niveau 1, en-tête de tableau
    teal: '0E7C86',      // titres de niveau 2
    orange: 'D98324',
    ink: '2B3440',
    muted: '6B7684',
    zebra: 'F4F7F9',
    ok: '1F9D55', warn: 'E58A2A', no: 'C0392B',
    font: 'DM Sans'
  };
  const hx = c => '#' + c;

  /* ═════════ OUTILS TEXTE ═════════ */
  const STOP = new Set('a au aux de des du en et la le les l d un une ou pour par sur avec dans son sa ses ce cet cette ces mettre place fournir realiser mise etre est sont'.split(' '));
  const clean = t => String(t || '').replace(/\r/g, '').replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ');
  const nrm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[«»\u201c\u201d\u2018\u2019'`]/g, ' ')
    .replace(/[.,;:!?()\[\]{}\-–—/\\]+/g, ' ').replace(/\s+/g, ' ').trim();
  const kw = s => nrm(s).split(' ').filter(w => w.length > 3 && !STOP.has(w));
  function sim(a, b) {
    const A = new Set(kw(a)), B = new Set(kw(b));
    if (!A.size || !B.size) return 0;
    let i = 0; A.forEach(w => { if (B.has(w)) i++; });
    return i / (A.size + B.size - i);
  }
  /* Découpe une énumération en mesures unitaires */
  const splitItems = t => String(t || '')
    .split(/[;•·]|\n|(?:,\s*(?=[a-zéèêàôûîç]))|\s+et\s+(?=[a-zéèêàôûîç]{4})/)
    .map(s => s.replace(/^[\s\-–—•·*]+/, '').replace(/[.\s]+$/, '').trim())
    .filter(s => s.length > 4 && s.length < 240);
  const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  const escq = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ═════════ MOTIFS « observé » / « conseillé » (larges, tolérants) ═════════ */
  const A_ = '[a-zA-ZÀ-ÖØ-öø-ÿ]';   // lettre accentuée incluse (\w ne matche pas « é »)
  const RE_OBS = /^\s*(?:moyens?\s+|mesures?\s+|dispositifs?\s+|actions?\s+)?(?:observ[a-zà-öø-ÿ]*|constat[a-zà-öø-ÿ]*|existant[a-zà-öø-ÿ]*|en\s*place|actuel[a-zà-öø-ÿ]*|d[ée]j[àa]\s*en\s*place|r[ée]alis[a-zà-öø-ÿ]*|pr[ée]sent[a-zà-öø-ÿ]*)\s*[:：\-–—>»]\s*(.*)$/i;
  const RE_CON = /^\s*(?:moyens?\s+|mesures?\s+|actions?\s+)?(?:conseill[a-zà-öø-ÿ]*|pr[ée]conis[a-zà-öø-ÿ]*|recommand[a-zà-öø-ÿ]*|[àa]\s*mettre\s*en\s*place|propositions?|axes?\s+d.?am[ée]lioration|[àa]\s*pr[ée]voir|[àa]\s*am[ée]liorer|pistes?)\s*[:：\-–—>»]\s*(.*)$/i;
  const RE_TITRE = /^\s*(?:(?:\d{1,2}(?:\.\d{1,2})*|[IVX]{1,5})\s*[.)\-–]\s*|[•▪●]\s*)?([A-ZÉÈÀÂÎÔÛÇ][^.!?]{2,72})\s*:?\s*$/;

  const nbPlaceholders = t => (String(t || '').match(/\*{3,}|\.{4,}|…{2,}|\[\s*[àa]\s*compl[ée]ter\s*\]|<[^>]{0,20}compl[ée]ter[^>]{0,20}>/gi) || []).length;

  /* ═════════ RÉFÉRENCES RÉGLEMENTAIRES ═════════ */
  const REF_THEMES = [
    { lab: 'Organisation des secours (SST / référent)', kw: ['referent sst', 'sauveteur secouriste', 'secouriste', 'sst'], ref: 'Art. L.4644-1 et R.4644-1 du Code du travail', urgent: true },
    { kw: ['formation sst', 'recyclage sst'], ref: 'Art. R.4224-15 du Code du travail', urgent: false },
    { lab: 'DUERP — document unique', kw: ['duerp', 'document unique'], ref: 'Art. R.4121-1 et suivants du Code du travail', urgent: true },
    { lab: 'PAPRIPACT — programme annuel de prévention', kw: ['papripact'], ref: 'Art. R.4121-3 du Code du travail', urgent: false },
    { lab: 'Coactivité — plan de prévention', kw: ['plan de prevention', 'entreprise exterieure'], ref: 'Art. R.4512-6 à R.4512-12 du Code du travail', urgent: false },
    { kw: ['electrique', 'habilitation'], ref: 'Art. R.4226-14 et suivants ; NF C 18-510', urgent: true },
    { kw: ['gaz', 'desenfumage'], ref: 'Art. R.4215-15, R.4216-28 ; Arrêté du 25/06/1980', urgent: true },
    { lab: 'Locaux sociaux (vestiaires, sanitaires)', kw: ['vestiaire', 'casier', 'sanitaire'], ref: 'Art. R.4228-1 et suivants du Code du travail', urgent: false },
    { lab: 'Gestion des déchets', kw: ['dechet', 'dasri'], ref: 'Art. R.4227-28 CT ; R.541-43 Code de l’environnement', urgent: false },
    { kw: ['ecran', 'poste informatique', 'teletravail'], ref: 'Art. R.4542-1 et suivants du Code du travail', urgent: false },
    { kw: ['manutention', 'port de charge'], ref: 'Art. R.4541-1 et suivants ; NF X35-109', urgent: false },
    { kw: ['routier', 'vehicule', 'conduite'], ref: 'Art. L.4121-1 CT ; Recommandation CNAM R.488', urgent: false },
    { kw: ['evacuation', 'incendie', 'extincteur'], ref: 'Art. R.4227-28 à R.4227-41 du Code du travail', urgent: true },
    { lab: 'Affichage réglementaire', kw: ['affichage'], ref: 'Art. D.4711-1 et suivants du Code du travail', urgent: false },
    { lab: 'Accueil sécurité des nouveaux arrivants', kw: ['accueil securite', 'nouvel arrivant'], ref: 'Art. L.4141-1 et R.4141-1 du Code du travail', urgent: false },
    { kw: ['rps', 'psychosocial', 'stress', 'harcelement'], ref: 'Art. L.4121-1 CT ; ANI du 02/07/2008', urgent: false },
    { kw: ['vibration'], ref: 'Art. R.4441-1 et suivants du Code du travail', urgent: false },
    { kw: ['penibilite', 'c2p'], ref: 'Art. L.4161-1 et D.4163-1 du Code du travail', urgent: false },
    { kw: ['bruit', 'sonometrie', 'picb'], ref: 'Art. R.4431-1 à R.4437-4 du Code du travail', urgent: true },
    { kw: ['chimique', 'cmr', 'fds'], ref: 'Art. R.4412-1 et suivants ; R.4412-59 (CMR)', urgent: true },
    { kw: ['biologique', 'aes', 'vaccination'], ref: 'Art. R.4421-1 à R.4427-5 du Code du travail', urgent: true },
    { kw: ['hauteur', 'echafaudage', 'harnais'], ref: 'Art. R.4323-58 et suivants du Code du travail', urgent: true },
    { kw: ['erp'], ref: 'Art. R.143-1 et suivants du Code de la construction', urgent: false },
    { kw: ['amiante'], ref: 'Art. R.4412-97 et suivants du Code du travail', urgent: true },
    { kw: ['isole', 'pti', 'dati'], ref: 'Art. R.4543-19 du Code du travail', urgent: false },
    { kw: ['nuit', 'horaire atypique'], ref: 'Art. L.3122-1 et suivants du Code du travail', urgent: false }
  ];
  const REF_DEFAUT = 'Art. L.4121-1 du Code du travail (obligation générale de sécurité)';
  function findTheme(text) { const n = nrm(text); return REF_THEMES.find(t => t.kw.some(k => n.includes(nrm(k)))) || null; }
  function matchRisk(name) {
    let best = null, bs = 0;
    Object.values(global.DB ? DB.risques : {}).forEach(r => {
      const s = Math.max(sim(name, r.label), sim(name, r.court || ''));
      if (s > bs) { bs = s; best = r; }
    });
    return bs >= 0.3 ? best : null;
  }

  /* ═════════ PARSING — stratégie 1 : blocs titrés « observés / conseillés » ═════════ */
  function parseBlocs(text) {
    const lignes = clean(text).split('\n').map(l => l.trim());
    const out = []; let cur = null, mode = null;
    const push = () => { if (cur && (cur.observed || cur.advised || cur.libre)) out.push(cur); cur = null; mode = null; };

    lignes.forEach(l => {
      if (!l) { mode = null; return; }
      const mo = l.match(RE_OBS), mc = l.match(RE_CON);
      if (mo && cur) { mode = 'o'; if (mo[1]) cur.observed += (cur.observed ? ' ; ' : '') + mo[1].trim(); return; }
      if (mc && cur) { mode = 'c'; if (mc[1]) cur.advised += (cur.advised ? ' ; ' : '') + mc[1].trim(); return; }
      const mt = l.match(RE_TITRE);
      if (mt && !mo && !mc && l.length < 80) { push(); cur = { name: mt[1].trim().slice(0, 90), observed: '', advised: '', libre: '' }; return; }
      if (!cur) return;
      if (mode === 'o') cur.observed += ' ; ' + l;
      else if (mode === 'c') cur.advised += ' ; ' + l;
      else cur.libre += (cur.libre ? ' ' : '') + l;
    });
    push();
    return out.filter(s => s.observed || s.advised);
  }


  /* ═════════ LEXIQUE TERRAIN — vocabulaire réel des FE, par identifiant de risque ═════════ */
  const LEXIQUE = {
    routier: ['vehicule', 'voiture', 'kilometrage', 'conduite', 'permis', 'deplacement', 'trajet', 'flotte', 'camion', 'utilitaire'],
    manutention: ['manutention', 'port de charge', 'charge', 'palette', 'transpalette', 'chariot', 'prap', 'colis', 'caisse', 'sac', 'diable', 'gerbeur'],
    tms: ['repetitif', 'tms', 'geste', 'cadence', 'cycle', 'poignet', 'epaule', 'canal carpien', 'tendinite', 'rotation de poste'],
    rps: ['rps', 'psychosocial', 'stress', 'incivilite', 'agression', 'public', 'violence', 'charge mentale', 'harcelement', 'burn out', 'souffrance', 'usagers'],
    chimique: ['chimique', 'fds', 'fiche de donnees', 'cmr', 'solvant', 'colle', 'peinture', 'poussiere', 'vapeur', 'aerosol', 'radon', 'vlep', 'etiquetage', 'javel', 'detergent', 'desinfectant', 'amiante'],
    biologique: ['biologique', 'aes', 'sang', 'contamination', 'vaccination', 'hepatite', 'sha', 'hydroalcoolique', 'dasri', 'germe', 'virus', 'bacterie', 'soin', 'linge sale'],
    bruit: ['bruit', 'sonore', 'sonometrie', 'decibel', 'db a', 'picb', 'bouchon', 'anti bruit', 'audiogramme', 'acoustique', 'casque auditif'],
    thermique: ['chaleur', 'froid', 'canicule', 'temperature', 'chambre froide', 'intemperie', 'climatisation', 'thermique', 'four'],
    vibrations: ['vibration', 'engin', 'tracteur', 'marteau', 'piqueur', 'siege suspendu', 'tondeuse', 'debroussailleuse', 'meuleuse'],
    electrique: ['electrique', 'habilitation', 'armoire electrique', 'tableau electrique', 'consignation', 'tension', 'rallonge'],
    cpp: ['plain pied', 'glissade', 'sol glissant', 'trebuchement', 'encombrement', 'allee', 'circulation pietonne'],
    cdh: ['hauteur', 'echafaudage', 'echelle', 'escabeau', 'harnais', 'toiture', 'nacelle', 'pemp', 'garde corps', 'mezzanine'],
    coactivite: ['coactivite', 'entreprise exterieure', 'plan de prevention', 'protocole de securite', 'sous traitant', 'intervenant exterieur'],
    machine: ['machine', 'marquage ce', 'carter', 'protecteur', 'scie', 'presse', 'trancheuse', 'petrin', 'maintenance', 'outil portatif'],
    postures: ['posture', 'accroupi', 'genoux', 'bras en l air', 'penche', 'flexion', 'torsion', 'station debout', 'pietinement'],
    ecran: ['ecran', 'informatique', 'ordinateur', 'bureautique', 'souris', 'clavier', 'visuel', 'teletravail'],
    incendie: ['incendie', 'extincteur', 'evacuation', 'alarme', 'permis feu', 'inflammable', 'desenfumage', 'issue de secours'],
    addictions: ['alcool', 'drogue', 'cannabis', 'addiction', 'ethylotest', 'stupefiant', 'tabac'],
    isole: ['travail isole', 'isolement', 'pti', 'dati', 'salarie seul'],
    nuit: ['travail de nuit', 'horaire atypique', '3x8', 'astreinte', 'poste de nuit', 'horaire decale']
  };

  /* ═════════ PARSING — stratégie 2 : balayage par mots-clés de la base risques ═════════ */
  /* mot entier (tolérant au pluriel) — évite « four » qui matcherait « fournis » */
  const TERM_CACHE = new Map();
  function hasTerm(nPhrase, terme) {
    let re = TERM_CACHE.get(terme);
    if (!re) { re = new RegExp('(^| )' + terme.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(s|es|x)?( |$)'); TERM_CACHE.set(terme, re); }
    return re.test(nPhrase);
  }

  function parseParMotsCles(text) {
    if (!global.DB || !DB.risques) return [];
    const phrases = clean(text).split(/(?<=[.;!?])\s+|\n/).map(p => p.trim()).filter(p => p.length > 15 && p.length < 400);
    const RE_FUTUR = /\b(mettre|pr[ée]voir|r[ée]aliser|former|installer|fournir|v[ée]rifier|instaurer|planifier|compl[ée]ter|actualiser|d[ée]signer|substituer|d[ée]limiter|[àa]\s+faire|il\s+conviendra|il\s+faudra|il\s+est\s+recommand|penser\s+[àa]|devra|reste\s+[àa])/i;
    const map = new Map();

    Object.values(DB.risques).forEach(r => {
      /* label + libellé court + lexique terrain — le champ « fe » est trop générique (il contient « formation », « sols »…) */
      const cles = [r.label, r.court, ...(LEXIQUE[r.id] || [])].map(nrm).filter(x => x.length > 2);
      const hits = phrases.filter(p => { const n = nrm(p); return cles.some(c => c && hasTerm(n, c)); });
      if (!hits.length) return;
      const obs = hits.filter(p => !RE_FUTUR.test(p));
      const adv = hits.filter(p => RE_FUTUR.test(p));
      map.set(r.label, { name: r.label, observed: obs.join(' ; '), advised: adv.join(' ; '), libre: '' });
    });

    /* 2e passe : thèmes administratifs absents de la base risques (SST, DUERP, affichage, vestiaires…) */
    REF_THEMES.filter(t => t.lab).forEach(t => {
      const hits = phrases.filter(p => { const n = nrm(p); return t.kw.some(k => hasTerm(n, nrm(k))); });
      if (!hits.length || map.has(t.lab)) return;
      const obs = hits.filter(p => !RE_FUTUR.test(p));
      const adv = hits.filter(p => RE_FUTUR.test(p));
      map.set(t.lab, { name: t.lab, observed: obs.join(' ; '), advised: adv.join(' ; '), libre: '' });
    });

    return [...map.values()].filter(s => s.observed || s.advised);
  }

  /* ═════════ PARSING — stratégie 3 : squelette depuis la sélection NAF/métiers ═════════ */
  function parseDepuisSelection() {
    if (typeof global.aggregate !== 'function') return [];
    const A = global.aggregate();
    return (A.risks || []).map(r => ({ name: r.label, observed: '', advised: r.epc || '', libre: '' }));
  }

  /* ═════════ ANALYSE ═════════ */
  let RAW = '';           // texte brut importé (jamais affiché en entier)
  const state = { meta: {}, secs: [], risqueRows: [], precoRows: [], placeholders: 0, strategie: '', source: '' };

  function analyser(text) {
    RAW = clean(text);
    state.placeholders = nbPlaceholders(RAW);

    let secs = parseBlocs(RAW), strat = 'Blocs « observés / conseillés » détectés dans le document';
    if (secs.length < 2) { const alt = parseParMotsCles(RAW); if (alt.length > secs.length) { secs = alt; strat = 'Aucun bloc « observés / conseillés » exploitable — reconstruction par balayage sémantique des risques'; } }
    if (!secs.length) { secs = parseDepuisSelection(); strat = 'Document non structuré — squelette généré depuis le NAF et les métiers sélectionnés (onglet Création)'; }
    state.strategie = strat;
    state.secs = secs;

    /* redondances observé ↔ conseillé */
    const items = [];
    secs.forEach(s => {
      if (!s.observed || !s.advised) return;
      splitItems(s.observed).forEach(o => splitItems(s.advised).forEach(c => {
        const v = sim(o, c);
        if (v >= 0.55) items.push({ risque: s.name, observe: o, conseille: c, sim: v });
      }));
    });
    try { global.doublons = { n: items.length, items }; } catch (e) { }

    /* tableaux */
    const rq = [], pr = [];
    secs.forEach(s => {
      const obs = splitItems(s.observed), cons = splitItems(s.advised);
      const kept = cons.filter(c => !obs.some(o => sim(o, c) >= 0.55));
      const statut = (!cons.length || !kept.length) ? 'ok' : (!obs.length ? 'no' : 'warn');
      const m = matchRisk(s.name);
      const th = findTheme(s.name + ' ' + kept.join(' '));
      const ref = m ? m.ref : (th ? th.ref : REF_DEFAUT);
      rq.push({ risque: cap(s.name), moyens: obs.map(cap).join(' ; ') || '—', statut, ref, suivi: m ? m.surveillance : '' });
      kept.forEach(c => {
        const th2 = findTheme(c) || th;
        const prio = (th2 && th2.urgent) ? 'urgent' : (!obs.length ? 'importante' : 'recommandee');
        pr.push({ texte: cap(c), ref: (th2 ? th2.ref : ref), prio, delai: prio === 'urgent' ? '3 mois' : prio === 'importante' ? '6 mois' : '12 mois' });
      });
    });
    const ordre = { urgent: 0, importante: 1, recommandee: 2 };
    pr.sort((a, b) => ordre[a.prio] - ordre[b.prio]);
    state.risqueRows = rq; state.precoRows = pr;

    state.meta = {
      entreprise: (global.M && M.entreprise) || '', naf: (global.M && M.naf) || '', nafLib: (global.M && M.nafLib) || '',
      effectif: (global.M && M.effectif) || '', preventeur: (global.M && M.preventeur) || '',
      date: (global.M && M.date) || new Date().toISOString().slice(0, 10)
    };
    render();
  }

  /* ═════════ SYNTHÈSE AUTOMATIQUE ═════════ */
  function syntheseTexte() {
    const r = state.risqueRows, p = state.precoRows;
    const ok = r.filter(x => x.statut === 'ok').length, w = r.filter(x => x.statut === 'warn').length, no = r.filter(x => x.statut === 'no').length;
    const u = p.filter(x => x.prio === 'urgent').length;
    const idx = r.length ? Math.round((ok * 100 + w * 50) / r.length) : 0;
    const d = (global.doublons && global.doublons.n) || 0;
    return `L'analyse porte sur ${r.length} famille(s) de risques : ${ok} maîtrisée(s), ${w} partiellement maîtrisée(s), ${no} non maîtrisée(s) — indice de maîtrise documentaire ${idx}/100. `
      + `${p.length} préconisation(s) restent à l'employeur après déduplication, dont ${u} de priorité urgente (échéance 3 mois). `
      + (d ? `${d} redondance(s) « moyen observé / moyen conseillé » ont été retirées du plan d'actions. ` : 'Aucune redondance « observé / conseillé » détectée. ')
      + (state.placeholders ? `${state.placeholders} champ(s) laissé(s) à compléter dans le document source. ` : '')
      + `Document d'aide à la décision (méthode PréventIA®) — à confirmer par une visite in situ et à valider par le médecin du travail (art. R.4624-46 du Code du travail).`;
  }

  /* ═════════ ÉDITEUR ═════════ */
  const CSSED = `
.ame-doc{border:1px solid var(--line);border-radius:14px;background:#fff;overflow:hidden;margin-top:14px}
.ame-band{background:var(--navy-900);color:#fff;padding:14px 18px}
.ame-band .t{font-family:"DM Serif Display",Georgia,serif;font-size:19px}
.ame-band .s{font-size:11px;letter-spacing:.7px;text-transform:uppercase;color:oklch(.78 .03 200)}
.ame-body{padding:18px}
.ame-h2{font-family:"DM Serif Display",Georgia,serif;font-size:16px;color:${hx(CHARTE.teal)};margin:20px 0 8px;border-bottom:2px solid var(--teal-050);padding-bottom:4px}
.ame-h2:first-child{margin-top:0}
.ame-meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-bottom:6px}
.ame-meta label{font-size:11px;font-weight:600;color:var(--navy-700);display:block;margin-bottom:3px}
.ame-meta input{width:100%;padding:7px 9px;border:1px solid var(--line);border-radius:8px;font-size:13px}
.ame-t{width:100%;border-collapse:collapse;font-size:12.5px}
.ame-t th{background:${hx(CHARTE.navy)};color:#fff;text-align:left;font-size:10.5px;letter-spacing:.5px;text-transform:uppercase;padding:7px 8px}
.ame-t td{border-bottom:1px solid var(--line);padding:6px 8px;vertical-align:top}
.ame-t tr:nth-child(even) td{background:${hx(CHARTE.zebra)}}
.ame-t [contenteditable]{outline:none;min-height:18px;border-radius:5px;padding:2px 4px;transition:background .15s}
.ame-t [contenteditable]:hover{background:var(--teal-050)}
.ame-t [contenteditable]:focus{background:#fff;box-shadow:0 0 0 2px var(--teal)}
.ame-t select{border:1px solid var(--line);border-radius:6px;padding:3px 4px;font-size:11.5px;font-weight:600}
.ame-t .del{border:0;background:transparent;color:var(--muted);font-size:15px;line-height:1}
.ame-t .del:hover{color:${hx(CHARTE.no)}}
.ame-sy[contenteditable]{border:1px dashed var(--line);border-radius:10px;padding:10px 12px;font-size:12.5px;line-height:1.6;outline:none}
.ame-sy:focus{border-color:var(--teal);background:var(--teal-050)}
.ame-add{margin-top:8px}
.ame-flag{display:inline-block;font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px;background:var(--teal-050);color:var(--teal-600);margin-left:6px}
`;
  function injectCSS() {
    if (document.getElementById('ame-style')) return;
    const s = document.createElement('style'); s.id = 'ame-style'; s.textContent = CSSED; document.head.appendChild(s);
  }

  const STAT_LAB = { ok: '✅ Maîtrisé', warn: '⚠️ Partiel', no: '🔴 Non maîtrisé' };
  const STAT_HEX = { ok: CHARTE.ok, warn: CHARTE.warn, no: CHARTE.no };
  const PRIO_LAB = { urgent: '🔴 URGENT', importante: '🟡 IMPORTANTE', recommandee: '🟢 RECOMMANDÉE' };
  const PRIO_HEX = { urgent: CHARTE.no, importante: CHARTE.warn, recommandee: CHARTE.ok };

  function render() {
    injectCSS();
    const host = document.getElementById('ameRes');
    if (!host) return;
    if (!state.risqueRows.length) {
      host.innerHTML = `<div class="notice warn">Aucune famille de risque n'a pu être extraite. Importez un .docx contenant des rubriques de risques, ou renseignez le NAF et les métiers dans l'onglet « Création de fiche d'entreprise » pour générer un squelette.</div>`;
      return;
    }
    const m = state.meta, d = (global.doublons && global.doublons.n) || 0;

    const trRisque = (r, i) => `<tr data-i="${i}">
      <td contenteditable data-f="risque"><b>${escq(r.risque)}</b></td>
      <td contenteditable data-f="moyens">${escq(r.moyens)}</td>
      <td><select data-f="statut" style="color:${hx(STAT_HEX[r.statut])}">
        ${['ok', 'warn', 'no'].map(k => `<option value="${k}" ${r.statut === k ? 'selected' : ''}>${STAT_LAB[k]}</option>`).join('')}
      </select></td>
      <td contenteditable data-f="ref">${escq(r.ref)}</td>
      <td style="text-align:center"><button class="del" title="Supprimer la ligne" onclick="AME.delRisque(${i})">✕</button></td></tr>`;

    const trPreco = (p, i) => `<tr data-i="${i}">
      <td contenteditable data-f="texte">${escq(p.texte)}</td>
      <td contenteditable data-f="ref">${escq(p.ref)}</td>
      <td><select data-f="prio" onchange="AME.syncDelai(this)" style="color:${hx(PRIO_HEX[p.prio])}">
        ${['urgent', 'importante', 'recommandee'].map(k => `<option value="${k}" ${p.prio === k ? 'selected' : ''}>${PRIO_LAB[k]}</option>`).join('')}
      </select></td>
      <td contenteditable data-f="delai">${escq(p.delai)}</td>
      <td style="text-align:center"><button class="del" title="Supprimer la ligne" onclick="AME.delPreco(${i})">✕</button></td></tr>`;

    host.innerHTML = `
    <div class="notice" style="margin-bottom:10px">
      ${state.risqueRows.length} risque(s) · ${state.precoRows.length} préconisation(s) · ${d} redondance(s) retirée(s) · ${state.placeholders} champ(s) « à compléter »
      <span class="ame-flag">tout est modifiable ci-dessous</span>
    </div>
    <div class="hint" style="margin-bottom:10px">🧭 Stratégie d'extraction : ${escq(state.strategie)}${state.source ? ' — source : ' + escq(state.source) : ''}</div>

    <div class="ame-doc" id="ameDoc">
      <div class="ame-band">
        <div class="s">PréventIA-LaB · Fiche d'entreprise améliorée</div>
        <div class="t">${escq(m.entreprise || 'Établissement anonymisé')}</div>
      </div>
      <div class="ame-body">
        <div class="ame-h2">1 · Identification</div>
        <div class="ame-meta">
          <div><label>Entreprise (pseudonyme)</label><input id="ed_ent" value="${escq(m.entreprise)}" placeholder="Établissement A"></div>
          <div><label>Code NAF</label><input id="ed_naf" value="${escq(m.naf)}" placeholder="86.10Z"></div>
          <div><label>Effectif</label><input id="ed_eff" value="${escq(m.effectif)}" placeholder="24"></div>
          <div><label>Préventeur</label><input id="ed_prev" value="${escq(m.preventeur)}" placeholder="IPRP / IDEST"></div>
          <div><label>Date</label><input id="ed_date" type="date" value="${escq(m.date)}"></div>
        </div>

        <div class="ame-h2">2 · Synthèse de l'analyse</div>
        <div class="ame-sy" id="ed_synth" contenteditable>${escq(syntheseTexte())}</div>

        <div class="ame-h2">3 · Tableau synthétique des risques</div>
        <table class="ame-t"><thead><tr><th style="width:20%">Famille de risque</th><th style="width:38%">Moyens en place (observés)</th>
          <th style="width:13%">Statut</th><th style="width:25%">Référence</th><th style="width:4%"></th></tr></thead>
          <tbody id="ed_risques">${state.risqueRows.map(trRisque).join('')}</tbody></table>
        <button class="btn ame-add" onclick="AME.addRisque()">➕ Ajouter un risque</button>

        <div class="ame-h2">4 · Préconisations employeur priorisées</div>
        <table class="ame-t"><thead><tr><th style="width:40%">Préconisation</th><th style="width:28%">Référence réglementaire</th>
          <th style="width:15%">Priorité</th><th style="width:13%">Échéance</th><th style="width:4%"></th></tr></thead>
          <tbody id="ed_precos">${state.precoRows.map(trPreco).join('')}</tbody></table>
        <button class="btn ame-add" onclick="AME.addPreco()">➕ Ajouter une préconisation</button>

        ${d ? `<div class="ame-h2">5 · Contrôle qualité — redondances retirées</div>
        ${global.doublons.items.slice(0, 12).map(x => `<div class="dbl"><b>${escq(x.risque)}</b> — similarité ${Math.round(x.sim * 100)} %<br>
          <span style="color:var(--muted)">Observé :</span> ${escq(x.observe)}<br>
          <span style="color:var(--muted)">Conseillé :</span> ${escq(x.conseille)}</div>`).join('')}
        <p class="hint">Ces conseils ont été retirés du plan d'actions : la mesure est déjà déclarée en place.</p>` : ''}

        <div class="mention" style="margin-top:18px">Fiche d'entreprise établie au titre de l'article R.4624-46 du Code du travail. Les scores et statuts sont des indicateurs d'aide à la décision (méthode PréventIA®), sans valeur réglementaire, à confirmer par une visite in situ et à valider par le médecin du travail.</div>
      </div>
    </div>`;

    /* Alimenter restitutions + cockpit depuis les données de l'améliorateur */
    setTimeout(feedRestitutions, 50);
  }

  /* ═════════ RELECTURE DE L'ÉDITEUR → ÉTAT ═════════ */
  function collect() {
    const txt = el => (el ? el.textContent.trim() : '');
    const v = (id, def) => { const e = document.getElementById(id); return e ? e.value.trim() : (def || ''); };
    const m0 = state.meta || {};
    state.meta = { entreprise: v('ed_ent', m0.entreprise), naf: v('ed_naf', m0.naf), nafLib: m0.nafLib || '',
      effectif: v('ed_eff', m0.effectif), preventeur: v('ed_prev', m0.preventeur), date: v('ed_date', m0.date) || m0.date };
    const sy = document.getElementById('ed_synth'); if (sy) state.synthese = sy.textContent.trim();

    const rq = document.getElementById('ed_risques');
    if (rq) state.risqueRows = [...rq.querySelectorAll('tr')].map(tr => ({
      risque: txt(tr.querySelector('[data-f=risque]')), moyens: txt(tr.querySelector('[data-f=moyens]')) || '—',
      statut: (tr.querySelector('[data-f=statut]') || {}).value || 'warn', ref: txt(tr.querySelector('[data-f=ref]')) || REF_DEFAUT
    })).filter(r => r.risque);

    const pr = document.getElementById('ed_precos');
    if (pr) state.precoRows = [...pr.querySelectorAll('tr')].map(tr => ({
      texte: txt(tr.querySelector('[data-f=texte]')), ref: txt(tr.querySelector('[data-f=ref]')) || REF_DEFAUT,
      prio: (tr.querySelector('[data-f=prio]') || {}).value || 'recommandee', delai: txt(tr.querySelector('[data-f=delai]')) || '12 mois'
    })).filter(p => p.texte);

    /* on renvoie aussi vers l'état global de la page (restitutions + cockpit) */
    if (global.M) { M.entreprise = state.meta.entreprise; M.preventeur = state.meta.preventeur; M.date = state.meta.date; if (state.meta.effectif) M.effectif = state.meta.effectif; }
    return state;
  }

  /* ═════════ ACTIONS ÉDITEUR ═════════ */
  const AME = {
    state,
    delRisque(i) { collect(); state.risqueRows.splice(i, 1); render(); },
    delPreco(i) { collect(); state.precoRows.splice(i, 1); render(); },
    addRisque() { collect(); state.risqueRows.push({ risque: 'Nouveau risque', moyens: '—', statut: 'warn', ref: REF_DEFAUT }); render(); },
    addPreco() { collect(); state.precoRows.push({ texte: 'Nouvelle préconisation', ref: REF_DEFAUT, prio: 'recommandee', delai: '12 mois' }); render(); },
    syncDelai(sel) {
      const tr = sel.closest('tr'), c = tr.querySelector('[data-f=delai]');
      sel.style.color = hx(PRIO_HEX[sel.value]);
      if (c) c.textContent = sel.value === 'urgent' ? '3 mois' : sel.value === 'importante' ? '6 mois' : '12 mois';
    },
    collect, render, analyser
  };

  /* ═════════ IMPORT .docx ═════════ */
  async function ameImportDocx(file) {
    if (!file) return;
    const st = document.getElementById('ameFileStatus');
    const set = h => { if (st) st.innerHTML = h; };
    set('⏳ Lecture du fichier…');
    try {
      if (!global.mammoth) {
        set('⏳ Chargement du lecteur .docx…');
        await new Promise((ok, ko) => {
          const s = document.createElement('script');
          s.src = 'https://cdn.jsdelivr.net/npm/mammoth@1.6.0/mammoth.browser.min.js';
          s.onload = ok; s.onerror = () => ko(new Error('CDN mammoth indisponible'));
          document.head.appendChild(s);
        });
      }
      const buf = await file.arrayBuffer();
      const r = await global.mammoth.extractRawText({ arrayBuffer: buf });
      const texte = clean(r.value || '');
      if (texte.length < 80) throw new Error('document vide ou illisible (' + texte.length + ' caractères extraits)');
      state.source = file.name;
      set(`✅ « ${escq(file.name)} » importé — ${texte.length} caractères analysés localement. <b>Vérifiez l'anonymisation</b> (raison sociale, SIRET, noms) avant diffusion.`);
      analyser(texte);
    } catch (e) {
      console.error(e);
      set('❌ Lecture impossible : ' + e.message + '. Essayez « Exemple » pour vérifier le fonctionnement de l’outil.');
    }
  }

  /* ═════════ EXEMPLE ═════════ */
  const DEMO = `1. Risque chimique
Moyens observés : ventilation générale du local, port de gants nitrile, fiches de données de sécurité classées
Moyens conseillés : mettre en place une ventilation générale du local, fournir des gants nitrile aux opérateurs, substituer les produits CMR identifiés

2. Bruit
Moyens observés : bouchons moulés fournis à chaque salarié
Moyens conseillés : réaliser une sonométrie, délimiter les zones supérieures à 85 dB(A), fournir des bouchons moulés

3. Manutention manuelle
Moyens observés : transpalette électrique disponible
Moyens conseillés : former les salariés à la méthode PRAP

4. Organisation des secours
Moyens observés : ***
Moyens conseillés : désigner un référent santé sécurité, former deux sauveteurs secouristes du travail`;
  function ameDemo() {
    state.source = 'exemple intégré';
    const st = document.getElementById('ameFileStatus');
    if (st) st.innerHTML = '📄 Exemple chargé — aucune donnée réelle.';
    analyser(DEMO);
  }
  function ameRun() { if (RAW) analyser(RAW); else ameDemo(); }

  /* ═════════ EXPORT .docx CHARTÉ ═════════ */
  function buildDoc() {
    const D = global.docx;
    const { Document, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle, ShadingType } = D;
    const m = state.meta;

    const P = (text, o = {}) => new Paragraph({
      alignment: o.align, spacing: { before: o.before || 0, after: o.after == null ? 100 : o.after },
      children: [new TextRun({ text: String(text), bold: !!o.bold, italics: !!o.italics, size: o.size || 20, color: o.color || CHARTE.ink, font: CHARTE.font })]
    });
    const H1 = t => new Paragraph({
      spacing: { before: 0, after: 60 },
      children: [new TextRun({ text: t, bold: true, size: 34, color: CHARTE.navy, font: CHARTE.font })]
    });
    const H2 = t => new Paragraph({
      spacing: { before: 260, after: 100 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: CHARTE.teal } },
      children: [new TextRun({ text: t, bold: true, size: 26, color: CHARTE.teal, font: CHARTE.font })]
    });
    const cell = (text, o = {}) => new TableCell({
      width: o.w ? { size: o.w, type: WidthType.PERCENTAGE } : undefined,
      shading: o.fill ? { type: ShadingType.CLEAR, fill: o.fill, color: 'auto' } : undefined,
      margins: { top: 60, bottom: 60, left: 90, right: 90 },
      children: [new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: String(text ?? ''), bold: !!o.bold, size: o.size || 17, color: o.color || CHARTE.ink, font: CHARTE.font })] })]
    });
    const table = (widths, header, rows) => new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 2, color: 'DDE3EA' }, bottom: { style: BorderStyle.SINGLE, size: 2, color: 'DDE3EA' },
        left: { style: BorderStyle.SINGLE, size: 2, color: 'DDE3EA' }, right: { style: BorderStyle.SINGLE, size: 2, color: 'DDE3EA' },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: 'DDE3EA' }, insideVertical: { style: BorderStyle.SINGLE, size: 2, color: 'DDE3EA' }
      },
      rows: [
        new TableRow({ tableHeader: true, children: header.map((h, i) => cell(h, { fill: CHARTE.navy, bold: true, color: 'FFFFFF', size: 16, w: widths[i] })) }),
        ...rows
      ]
    });

    const rqRows = state.risqueRows.map((r, i) => new TableRow({
      children: [
        cell(r.risque, { bold: true, fill: i % 2 ? CHARTE.zebra : undefined }),
        cell(r.moyens, { fill: i % 2 ? CHARTE.zebra : undefined }),
        cell(STAT_LAB[r.statut], { bold: true, color: STAT_HEX[r.statut], fill: i % 2 ? CHARTE.zebra : undefined }),
        cell(r.ref, { color: CHARTE.muted, fill: i % 2 ? CHARTE.zebra : undefined })
      ]
    }));
    const prRows = (state.precoRows.length ? state.precoRows : [{ texte: 'Aucune préconisation restante après déduplication.', ref: '—', prio: 'recommandee', delai: '—' }])
      .map((p, i) => new TableRow({
        children: [
          cell(p.texte, { fill: i % 2 ? CHARTE.zebra : undefined }),
          cell(p.ref, { color: CHARTE.muted, fill: i % 2 ? CHARTE.zebra : undefined }),
          cell(PRIO_LAB[p.prio], { bold: true, color: PRIO_HEX[p.prio], fill: i % 2 ? CHARTE.zebra : undefined }),
          cell(p.delai, { fill: i % 2 ? CHARTE.zebra : undefined })
        ]
      }));

    /* Bandeau d'en-tête aux couleurs de la charte */
    const bandeau = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
      rows: [new TableRow({
        children: [new TableCell({
          shading: { type: ShadingType.CLEAR, fill: CHARTE.navy, color: 'auto' },
          margins: { top: 200, bottom: 200, left: 200, right: 200 },
          children: [
            new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: 'PRÉVENTIA-LAB · FICHE D’ENTREPRISE AMÉLIORÉE', size: 15, color: '8FD0E0', font: CHARTE.font })] }),
            new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: m.entreprise || 'Établissement anonymisé', bold: true, size: 32, color: 'FFFFFF', font: CHARTE.font })] })
          ]
        })]
      })]
    });

    const idLine = [
      m.naf ? `NAF ${m.naf}${m.nafLib ? ' — ' + m.nafLib : ''}` : null,
      m.effectif ? `Effectif : ${m.effectif}` : null,
      `Date : ${m.date}`,
      `Préventeur : ${m.preventeur || '—'}`,
      state.source ? `Source : ${state.source}` : null
    ].filter(Boolean).join('  ·  ');

    return new Document({
      styles: { default: { document: { run: { font: CHARTE.font, size: 20, color: CHARTE.ink } } } },
      sections: [{
        properties: { page: { margin: { top: 900, bottom: 900, left: 900, right: 900 } } },
        children: [
          bandeau,
          P('', { after: 160 }),
          P(idLine, { size: 17, color: CHARTE.muted }),
          H2('1 · Synthèse de l’analyse'),
          P(state.synthese || syntheseTexte(), { size: 19 }),
          H2('2 · Tableau synthétique des risques'),
          table([20, 38, 14, 28], ['Famille de risque', 'Moyens en place (observés)', 'Statut', 'Référence'], rqRows),
          H2('3 · Préconisations employeur priorisées'),
          table([42, 28, 16, 14], ['Préconisation', 'Référence réglementaire', 'Priorité', 'Échéance'], prRows),
          P('', { after: 200 }),
          P('Fiche d’entreprise établie au titre de l’article R.4624-46 du Code du travail. L’attribution par l’INSEE d’un code APE, à des fins statistiques, ne saurait suffire à créer des droits ou des obligations (art. 5 du décret n° 2007-1888). Les statuts et priorités sont des indicateurs d’aide à la décision (méthode PréventIA®), sans valeur réglementaire, à confirmer par une visite in situ et à valider par le médecin du travail.',
            { italics: true, size: 15, color: CHARTE.muted })
        ]
      }]
    });
  }

  /* Repli .doc HTML — même charte */
  function fallbackHTML() {
    const m = state.meta;
    const rows = state.risqueRows.map(r => `<tr><td><b>${escq(r.risque)}</b></td><td>${escq(r.moyens)}</td>
      <td style="color:${hx(STAT_HEX[r.statut])};font-weight:700">${STAT_LAB[r.statut]}</td><td>${escq(r.ref)}</td></tr>`).join('');
    const pre = state.precoRows.map(p => `<tr><td>${escq(p.texte)}</td><td>${escq(p.ref)}</td>
      <td style="color:${hx(PRIO_HEX[p.prio])};font-weight:700">${PRIO_LAB[p.prio]}</td><td>${escq(p.delai)}</td></tr>`).join('');
    return `<div style="background:${hx(CHARTE.navy)};color:#fff;padding:16px">
        <div style="font-size:9pt;letter-spacing:1px;color:#8FD0E0">PRÉVENTIA-LAB · FICHE D'ENTREPRISE AMÉLIORÉE</div>
        <div style="font-size:18pt;font-weight:700">${escq(m.entreprise || 'Établissement anonymisé')}</div></div>
      <p style="color:${hx(CHARTE.muted)};font-size:9pt">${escq([m.naf ? 'NAF ' + m.naf : '', m.effectif ? 'Effectif : ' + m.effectif : '', 'Date : ' + m.date, 'Préventeur : ' + (m.preventeur || '—')].filter(Boolean).join('  ·  '))}</p>
      <h2>1 · Synthèse de l'analyse</h2><p>${escq(state.synthese || syntheseTexte())}</p>
      <h2>2 · Tableau synthétique des risques</h2>
      <table><thead><tr><th>Famille de risque</th><th>Moyens en place (observés)</th><th>Statut</th><th>Référence</th></tr></thead><tbody>${rows}</tbody></table>
      <h2>3 · Préconisations employeur priorisées</h2>
      <table><thead><tr><th>Préconisation</th><th>Référence réglementaire</th><th>Priorité</th><th>Échéance</th></tr></thead><tbody>${pre}</tbody></table>
      <p style="font-size:8pt;font-style:italic;color:${hx(CHARTE.muted)}">Fiche d'entreprise établie au titre de l'article R.4624-46 du Code du travail — document d'aide à la décision (méthode PréventIA®), à valider par le médecin du travail après visite in situ.</p>`;
  }

  async function ameExportDocx() {
    const btn = document.getElementById('ameDlBtn');
    if (!state.risqueRows.length) { alert('Importez d’abord une fiche (.docx) ou chargez l’exemple : il n’y a rien à exporter.'); return; }
    collect();
    const old = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Préparation du document…'; }
    const nom = `FE_${(state.meta.entreprise || 'anonyme').replace(/\W+/g, '_')}_AMELIOREE`;
    try {
      const ok = await global.DocxLoader.load();
      if (!ok) throw new Error('docx.js indisponible');
      const blob = await global.docx.Packer.toBlob(buildDoc());
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = nom + '.docx';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch (e) {
      console.warn('Repli .doc :', e.message);
      global.DocxLoader.exportFallback(fallbackHTML(), nom);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = old; }
    }
  }

  /* ═════════ PONT → RESTITUTIONS (PVX) + COCKPIT ═════════
     Reconstruit le contexte attendu par PVX.render() et CockpitFE.render()
     à partir des données extraites par l'améliorateur, sans passer par
     l'onglet A (sélection NAF / métiers / cotation manuelle).
     ═════════════════════════════════════════════════════════════════════ */
  const STATUT_TO_ANSWER = { ok: 'maitrise', warn: 'partiel', no: 'non' };
  const STATUT_TO_SCORE  = { ok: 4, warn: 2, no: 1 };
  const SURV_SCORE = { SIR: 4, SIA: 3, SI: 2, '-': 1 };

  function feedRestitutions() {
    if (!state.risqueRows.length) return;
    const DB_ = global.DB;
    if (!DB_ || !DB_.risques) return;

    /* 1. Matcher chaque ligne → objet risque de la base */
    const matched = [];
    const fakeAnswers = {};
    state.risqueRows.forEach(row => {
      const r = matchRisk(row.risque);
      if (r) {
        matched.push(r);
        fakeAnswers[r.id] = STATUT_TO_ANSWER[row.statut] || 'nc';
      }
    });

    /* 2. Construire l'agrégat A (même forme que aggregate()) */
    const taille = DB_.taillesEntreprises
      ? DB_.taillesEntreprises.find(t => t.id === (global.S && S.taille) || '') || null
      : null;
    const A = {
      secteur: null,
      taille: taille,
      metiers: [],
      unites: [],
      risks: matched
    };

    /* 3. Scoring (même formule que computeScoring dans index.html) */
    let num = 0, den = 0, ev = 0, sum = 0;
    A.risks.forEach(r => {
      const a = fakeAnswers[r.id]; if (!a || a === 'nc') return;
      const m = a === 'maitrise' ? 4 : a === 'partiel' ? 2 : 1;
      const c = SURV_SCORE[r.surveillance] || 1;
      num += m * c; den += 4 * c; ev++; sum += m;
    });
    const Sc = {
      indice: den ? Math.round(num / den * 100) : null,
      tauxMaitrise: ev ? Math.round(sum / (ev * 4) * 100) : null,
      answered: ev, total: A.risks.length,
      effExpose: parseInt(state.meta.effectif) || 0,
      docScore: A.risks.length ? Math.round(A.risks.filter(r => r.ref && r.ref !== '—').length / A.risks.length * 100) : 0,
      cSIR: A.risks.filter(r => r.surveillance === 'SIR').length,
      prioritaires: A.risks.filter(r => {
        const a = fakeAnswers[r.id];
        return (r.surveillance === 'SIR' && a !== 'maitrise') || a === 'non' || a === 'partiel';
      }).length
    };

    /* 4. Métadonnées */
    const meta = {
      entreprise: state.meta.entreprise || '',
      naf: state.meta.naf || '',
      nafLib: state.meta.nafLib || '',
      section: '', sectionLib: '',
      effectif: state.meta.effectif || '',
      date: state.meta.date || '',
      preventeur: state.meta.preventeur || ''
    };

    /* 5. Appeler PVX */
    if (global.PVX && typeof PVX.render === 'function') {
      try {
        PVX.render('pvxHost', { A, S: Sc, answers: fakeAnswers, meta, doublons: global.doublons || { n: 0, items: [] } });
      } catch (e) { console.warn('PVX.render :', e.message); }
    }

    /* 6. Appeler le cockpit synthétique */
    if (global.CockpitFE && typeof CockpitFE.render === 'function') {
      try {
        const axes = state.risqueRows.map(row => ({
          label: row.risque,
          score: STATUT_TO_SCORE[row.statut] || 0
        }));
        CockpitFE.render('cockpitHost', axes, {
          entreprise: meta.entreprise || 'entreprise',
          naf: meta.naf, nafLib: meta.nafLib,
          date: meta.date, preventeur: meta.preventeur
        });
      } catch (e) { console.warn('CockpitFE.render :', e.message); }
    }
  }

  global.AME = AME;
  global.ameImportDocx = ameImportDocx;
  global.ameRun = ameRun;
  global.ameDemo = ameDemo;
  global.ameExportDocx = ameExportDocx;
})(window);
