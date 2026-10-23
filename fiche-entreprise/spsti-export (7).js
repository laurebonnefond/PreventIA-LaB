/* ═══════════════════════════════════════════════════════════════════════
   spsti-export.js — Export d'une fiche d'entreprise au format SPSTI 23/87
   ───────────────────────────────────────────────────────────────────────
   Remplit le template Word officiel (fiche-spsti-template.docx) avec les
   données de la fiche, puis injecte en fin de document les blocs de
   conclusions réglementaires (conclusions-fe.json) correspondant aux
   risques identifiés.

   Dépendances : PizZip (chargé via CDN dans index.html)
   Fichiers requis dans le même dossier :
     - fiche-spsti-template.docx   (template avec placeholders {{VAR}})
     - conclusions-fe.json          (catalogue des blocs Dr RM)

   Usage :
     exporterFicheSPSTI({ ...donnees });      // voir buildDonnees() plus bas
   ═══════════════════════════════════════════════════════════════════════ */

(function (global) {
  'use strict';

  // Chemins relatifs au dossier fiche-entreprise/
  const TEMPLATE_URL     = './fiche-entreprise-spsti-template.docx';
  const CONCLUSIONS_URL  = './conclusions-fe.json';
  const SPECIF_URL       = './specificites-metiers.json';   // optionnel

  // Cache mémoire pour éviter de re-télécharger à chaque export
  let _tplBuffer = null;
  let _catalogue = null;
  let _specif    = null;

  // ─────────────────────────────────────────────────────────────────────
  // Utilitaires
  // ─────────────────────────────────────────────────────────────────────
  function escapeXml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  async function chargerRessources() {
    if (!_tplBuffer) {
      const r = await fetch(TEMPLATE_URL);
      if (!r.ok) throw new Error(`Template introuvable (${r.status}) : ${TEMPLATE_URL}`);
      _tplBuffer = await r.arrayBuffer();
    }
    if (!_catalogue) {
      const r = await fetch(CONCLUSIONS_URL);
      if (!r.ok) throw new Error(`Catalogue introuvable (${r.status}) : ${CONCLUSIONS_URL}`);
      _catalogue = await r.json();
    }
    if (!_specif) {
      try {
        const r = await fetch(SPECIF_URL);
        _specif = r.ok ? await r.json() : { metiers: {} };
      } catch (e) { _specif = { metiers: {} }; }
    }
    return { tpl: _tplBuffer, cat: _catalogue, spec: _specif };
  }

  // ─────────────────────────────────────────────────────────────────────
  // Facteurs de risques : tableaux du template remplis selon les risques
  // et les métiers sélectionnés (+ précisions de specificites-metiers.json)
  // ─────────────────────────────────────────────────────────────────────
  const CAT_RISQUE = {
    routier: 'SITUATIONS', addictions: 'SITUATIONS', manutention: 'SITUATIONS', tms: 'SITUATIONS',
    postures: 'SITUATIONS', coactivite: 'SITUATIONS', ecran: 'SITUATIONS', rps: 'SITUATIONS',
    nuit: 'SITUATIONS', isole: 'SITUATIONS',
    cpp: 'ACCIDENTS', cdh: 'ACCIDENTS', machine: 'ACCIDENTS', electrique: 'ACCIDENTS',
    incendie: 'ACCIDENTS', animal: 'ACCIDENTS',
    bruit: 'PHYSIQUES', thermique: 'PHYSIQUES', vibrations: 'PHYSIQUES', ray_ion: 'PHYSIQUES',
    ray_ni: 'PHYSIQUES', laser: 'PHYSIQUES', hyperbare: 'PHYSIQUES',
    chimique: 'CHIMIQUES', silice: 'CHIMIQUES',
    biologique: 'BIOLOGIQUES',
  };                                    // tout autre risque → DIVERS
  const CATS = ['SITUATIONS', 'ACCIDENTS', 'PHYSIQUES', 'CHIMIQUES', 'BIOLOGIQUES', 'DIVERS'];
  const ETAT_OBS = {
    maitrise: 'Moyens de prévention jugés maîtrisés (à détailler).',
    partiel:  'Moyens de prévention partiellement en place (à détailler).',
    non:      'Aucun moyen de prévention identifié lors de la visite.',
  };

  // Précisions d'un métier pour un risque, avec héritage (_herite)
  function precision(spec, metierId, risqueId, prof = 0) {
    const m = spec && spec.metiers && spec.metiers[metierId];
    if (!m || prof > 3) return null;
    return m[risqueId] || (m._herite ? precision(spec, m._herite, risqueId, prof + 1) : null);
  }

  // Découpe « a ; b ; c » en lignes (une ligne Word par élément)
  const lignes = t => String(t || '').split(/\s*;\s*/).map(x => x.trim()).filter(Boolean)
    .map(x => x.charAt(0).toUpperCase() + x.slice(1));

  /**
   * Une entrée par risque, avec une sous-ligne par groupe de métiers partageant
   * les mêmes précisions (format du modèle SPSTI : famille fusionnée verticalement).
   */
  function construireFacteurs(risquesActifs, metiers, db, answers, spec) {
    const parId = {};
    Object.entries(db.risques || {}).forEach(([cle, r]) => { parId[r.id] = Object.assign({ cle }, r); });
    return risquesActifs.map(id => {
      const r = parId[id]; if (!r) return null;
      const concernes = metiers.filter(m => (m.risques || []).includes(r.cle));
      const groupes = new Map();
      concernes.forEach(m => {
        const p = precision(spec, m.id, id); if (!p) return;
        const k = JSON.stringify(p);
        if (!groupes.has(k)) groupes.set(k, { p, noms: [] });
        groupes.get(k).noms.push(m.label);
      });
      // Colonne « déclarés ou observés » : statut coché dans l'outil (si renseigné) puis
      // propositions à cocher en visite, en gris (☐ à transformer en ☒ ou à supprimer)
      const etat = ETAT_OBS[answers && answers[id]];
      // Une case par mesure : découpe sur « ; » et sur les virgules hors parenthèses
      const mesures = items => items.flatMap(t => {
        const out = []; let cur = '', prof = 0;
        for (const ch of t) {
          if (ch === '(') prof++; else if (ch === ')') prof--;
          if (ch === ',' && prof === 0) { out.push(cur); cur = ''; } else cur += ch;
        }
        out.push(cur);
        return out.map(x => x.trim().replace(/\.$/, '')).filter(Boolean).map(x => x.charAt(0).toUpperCase() + x.slice(1));
      });
      const aCocher = items => (etat ? [etat] : []).concat(mesures(items).map(t => ({ t: ' ' + t, gris: true, cocher: true })));
      const genItems = [r.epc, r.epi].flatMap(x => String(x || '').split(/\s*[,;]\s*/)).map(x => x.trim()).filter(x => x && x !== '—')
        .map(x => x.charAt(0).toUpperCase() + x.slice(1));
      let sous;
      if (groupes.size) {
        sous = [...groupes.values()].map(g => ({
          ghe: g.noms.join(' / '),
          expo: lignes(g.p.expo),
          obs: aCocher(lignes(g.p.conseils)),
          cons: lignes(g.p.conseils).concat(g.p.mp && g.p.mp !== '—' ? ['Maladies professionnelles : ' + g.p.mp] : []),
        }));
        const sansPrec = concernes.filter(m => !precision(spec, m.id, id)).map(m => m.label);
        if (sansPrec.length) sous.push({ ghe: sansPrec.join(' / '), expo: ['Points à relever : ' + r.fe], obs: aCocher(genItems), cons: [r.epc, r.epi].filter(Boolean) });
      } else {
        sous = [{
          ghe: concernes.length ? concernes.map(m => m.label).join(' / ') : 'Tous les salariés concernés',
          expo: r.fe ? ['Points à relever : ' + r.fe] : [''],
          obs: aCocher(genItems),
          cons: [r.epc && 'Protection collective : ' + r.epc, r.epi && 'Protection individuelle : ' + r.epi,
                 r.mp && r.mp !== '—' && 'Maladies professionnelles : ' + r.mp].filter(Boolean),
        }];
      }
      if (r.ref) sous[sous.length - 1].cons.push('Référence : ' + r.ref);
      return { cat: CAT_RISQUE[id] || 'DIVERS', risque: r.label, sous };
    }).filter(Boolean);
  }

  // Remplit les tableaux « Facteurs de risques » du template à partir de la
  // ligne-modèle ({{FR_FAM_<CAT>}} …) : mise en forme 100 % identique au modèle SPSTI.
  function remplirFacteurs(xml, facteurs) {
    for (const cat of CATS) {
      const mk = '{{FR_FAM_' + cat + '}}';
      const iMk = xml.indexOf(mk);
      if (iMk < 0) continue;
      const iTr = Math.max(xml.lastIndexOf('<w:tr>', iMk), xml.lastIndexOf('<w:tr ', iMk));
      const fTr = xml.indexOf('</w:tr>', iMk) + 7;
      const proto = xml.slice(iTr, fTr);
      const lignesCat = facteurs.filter(f => f.cat === cat);
      if (!lignesCat.length) {
        // Aucun risque : on retire le tableau et on laisse une phrase
        const iTb = xml.lastIndexOf('<w:tbl>', iMk), fTb = xml.indexOf('</w:tbl>', iMk) + 8;
        xml = xml.slice(0, iTb) + XML_PARA('Aucun risque de cette catégorie identifié lors de la visite.') + xml.slice(fTb);
        continue;
      }
      let rows = '';
      lignesCat.forEach(f => f.sous.forEach((sl, i) => {
        let row = proto;
        // Fusion verticale de la colonne « Famille de risque »
        if (f.sous.length > 1) {
          row = row.replace(/(<w:tc>\s*<w:tcPr>[\s\S]*?<w:tcW [^>]*\/>)/, '$1' + (i === 0 ? '<w:vMerge w:val="restart"/>' : '<w:vMerge/>'));
        }
        row = remplirCellule(row, mk, [i === 0 ? f.risque : '']);
        row = remplirCellule(row, '{{FR_GHE}}', [sl.ghe]);
        row = remplirCellule(row, '{{FR_EXPO}}', sl.expo);
        row = remplirCellule(row, '{{FR_OBS}}', sl.obs);
        row = remplirCellule(row, '{{FR_CONS}}', sl.cons);
        rows += row;
      }));
      xml = xml.slice(0, iTr) + rows + xml.slice(fTr);
    }
    return xml;
  }

  // Duplique le paragraphe qui porte le marqueur : une ligne = un paragraphe
  function remplirCellule(row, marqueur, valeurs) {
    const i = row.indexOf(marqueur); if (i < 0) return row;
    const iP = Math.max(row.lastIndexOf('<w:p>', i), row.lastIndexOf('<w:p ', i));
    const fP = row.indexOf('</w:p>', i) + 6;
    const para = row.slice(iP, fP);
    const out = (valeurs.length ? valeurs : ['']).map(v => {
      const t = (v && typeof v === 'object') ? v.t : v;
      let q = para.replace(marqueur, escapeXml(t));
      if (v && v.gris) {                                   // texte gris moyen-clair
        q = q.includes('</w:rPr><w:t') ? q.replace(/<\/w:rPr>(<w:t[ >])/, '<w:color w:val="999999"/></w:rPr>$1')
                                        : q.replace(/<w:r>(<w:t[ >])/, '<w:r><w:rPr><w:color w:val="999999"/></w:rPr>$1');
      }
      if (v && v.cocher) q = ajouterCaseACocher(q, escapeXml(t));
      return q;
    }).join('');
    return row.slice(0, iP) + out + row.slice(fP);
  }

  // Case à cocher Word cliquable (contrôle de contenu w14:checkbox) placée devant le texte
  let _idCase = 7000;
  function ajouterCaseACocher(para, texteXml) {
    const iT = para.indexOf(texteXml); if (iT < 0) return para;
    const iR = Math.max(para.lastIndexOf('<w:r>', iT), para.lastIndexOf('<w:r ', iT));
    if (iR < 0) return para;
    const rPrRun = (para.slice(iR, iT).match(/<w:rPr>([\s\S]*?)<\/w:rPr>/) || ['', ''])[1]
      .replace(/<w:rFonts [^>]*\/>/, '').replace(/<w:color [^>]*\/>/g, '');
    const rPrCase = '<w:rPr><w:rFonts w:ascii="MS Gothic" w:eastAsia="MS Gothic" w:hAnsi="MS Gothic" w:hint="eastAsia"/>' +
      rPrRun + '<w:color w:val="136AA8"/></w:rPr>';
    const sdt = '<w:sdt><w:sdtPr>' + rPrCase + '<w:id w:val="' + (++_idCase) + '"/>' +
      '<w14:checkbox><w14:checked w14:val="0"/><w14:checkedState w14:val="2612" w14:font="MS Gothic"/>' +
      '<w14:uncheckedState w14:val="2610" w14:font="MS Gothic"/></w14:checkbox></w:sdtPr>' +
      '<w:sdtContent><w:r>' + rPrCase + '<w:t>☐</w:t></w:r></w:sdtContent></w:sdt>';
    return para.slice(0, iR) + sdt + para.slice(iR);
  }

  // ─────────────────────────────────────────────────────────────────────
  // Génération du XML OOXML des conclusions selon les risques
  // ─────────────────────────────────────────────────────────────────────
  // Style titre : Arial 14pt gras souligné ambre #BF8F00 (charte Dr RM)
  const XML_TITRE = t =>
    '<w:p><w:pPr>' +
      '<w:pStyle w:val="Default"/>' +
      '<w:spacing w:before="240" w:after="120" w:line="360" w:lineRule="auto"/>' +
      '<w:jc w:val="both"/>' +
    '</w:pPr>' +
    '<w:r><w:rPr>' +
      '<w:rFonts w:eastAsia="Times New Roman"/><w:b/>' +
      '<w:color w:val="BF8F00" w:themeColor="accent4" w:themeShade="BF"/>' +
      '<w:sz w:val="28"/><w:szCs w:val="28"/><w:u w:val="single"/>' +
    '</w:rPr><w:t>' + escapeXml(t) + '</w:t></w:r></w:p>';

  const PPR_MODELE = '<w:pPr><w:autoSpaceDE w:val="0"/><w:autoSpaceDN w:val="0"/><w:adjustRightInd w:val="0"/>' +
    '<w:spacing w:before="0" w:after="120"/><w:jc w:val="both"/></w:pPr>';
  const XML_PARA = t => '<w:p>' + PPR_MODELE + '<w:r><w:t xml:space="preserve">' + escapeXml(t) + '</w:t></w:r></w:p>';

  // Liens hypertextes créés pendant l'export (ajoutés aux relations du .docx)
  let _liens = [];
  const run = (t, rpr) => '<w:r>' + (rpr ? '<w:rPr>' + rpr + '</w:rPr>' : '') + '<w:t xml:space="preserve">' + escapeXml(t) + '</w:t></w:r>';
  function lien(url) {
    const id = 'rIdPvx' + (_liens.length + 1);
    _liens.push({ id, url });
    return '<w:hyperlink r:id="' + id + '" w:history="1">' + run(url, '<w:color w:val="0563C1"/><w:u w:val="single"/>') + '</w:hyperlink>';
  }
  // Mini-markdown du catalogue : <url>, *italique*, « > » (citation), « OU »
  function paraCatalogue(t) {
    let txt = String(t || ''), cit = false;
    if (/^\s*!.*\(media\//.test(txt)) return '';               // image pandoc non convertie
    if (/^\s*>/.test(txt)) { cit = true; txt = txt.replace(/^\s*>\s*/, ''); }
    txt = txt.replace(/(\S)\s>\s/g, '$1 ');                      // « > » de citation égaré en milieu de phrase
    const ital = cit ? '<w:i/>' : '';
    let runs = '';
    const re = /<(https?:\/\/[^>\s]+)>|\*([^*]+)\*|(https?:\/\/[^\s)]+)/g;
    let m, last = 0;
    while ((m = re.exec(txt))) {
      if (m.index > last) runs += run(txt.slice(last, m.index), ital);
      if (m[1] || m[3]) runs += lien(m[1] || m[3]);
      else runs += run(m[2], '<w:i/>');
      last = re.lastIndex;
    }
    if (last < txt.length) runs += run(txt.slice(last), ital);
    const ppr = cit ? PPR_MODELE.replace('<w:jc w:val="both"/>', '<w:ind w:left="567"/><w:jc w:val="both"/>') : PPR_MODELE;
    const gras = txt.trim() === 'OU' ? runs.replace('<w:r>', '<w:r><w:rPr><w:b/></w:rPr>') : runs;
    return '<w:p>' + ppr + gras + '</w:p>';
  }

  const XML_VIDE = '<w:p/>';

  function blocToXml(bloc, precisions) {
    if (!bloc) return '';
    let out = XML_TITRE(bloc.titre);
    // « Dans votre établissement » : précisions des métiers sélectionnés
    (precisions || []).forEach(pr => {
      out += '<w:p>' + PPR_MODELE + run('Dans votre établissement (' + pr.noms + ') :', '<w:b/>') + '</w:p>';
      lignes(pr.conseils).forEach(l => { out += paraCatalogue('• ' + l); });
    });
    for (const p of bloc.paragraphes) out += paraCatalogue(p);
    out += XML_VIDE;
    return out;
  }

  /* ── Tableaux de l'améliorateur (mode B) : synthèse + risques + préconisations ── */
  const NAVY = '17428F', ZEBRA = 'F2F2F2', BORD = 'BFBFBF';
  const STAT = { ok: ['Maîtrisé', 'AFCA0C'], warn: ['Partiel', 'EB7420'], no: ['Non maîtrisé', 'C0392B'] };
  const PRIO = { urgent: ['URGENT', 'C0392B'], importante: ['IMPORTANTE', 'EB7420'], recommandee: ['RECOMMANDÉE', '7A9A00'] };

  const XML_H = t =>
    '<w:p><w:pPr><w:spacing w:before="240" w:after="120"/></w:pPr>' +
    '<w:r><w:rPr><w:b/><w:color w:val="' + NAVY + '"/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr>' +
    '<w:t xml:space="preserve">' + escapeXml(t) + '</w:t></w:r></w:p>';

  function xmlCell(txt, o) {
    o = o || {};
    const fill = o.fill ? '<w:shd w:val="clear" w:color="auto" w:fill="' + o.fill + '"/>' : '';
    const rpr = '<w:rPr>' + (o.bold ? '<w:b/>' : '') +
      '<w:color w:val="' + (o.color || '000000') + '"/><w:sz w:val="' + (o.sz || 18) + '"/><w:szCs w:val="' + (o.sz || 18) + '"/></w:rPr>';
    // Un paragraphe Word par ligne (« \n » dans le texte)
    const paras = String(txt ?? '').split('\n').map(l =>
      '<w:p><w:pPr><w:spacing w:before="40" w:after="40"/></w:pPr><w:r>' + rpr +
      '<w:t xml:space="preserve">' + escapeXml(l) + '</w:t></w:r></w:p>').join('');
    return '<w:tc><w:tcPr><w:tcW w:w="' + o.w + '" w:type="dxa"/>' + fill + '</w:tcPr>' + paras + '</w:tc>';
  }

  function xmlTable(widths, header, rows) {
    const b = t => '<w:' + t + ' w:val="single" w:sz="4" w:space="0" w:color="' + BORD + '"/>';
    let x = '<w:tbl><w:tblPr><w:tblW w:w="' + widths.reduce((a, c) => a + c, 0) + '" w:type="dxa"/>' +
      '<w:tblBorders>' + ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(b).join('') + '</w:tblBorders>' +
      '<w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr>' +
      '<w:tblGrid>' + widths.map(w => '<w:gridCol w:w="' + w + '"/>').join('') + '</w:tblGrid>';
    x += '<w:tr><w:trPr><w:tblHeader/></w:trPr>' +
      header.map((h, i) => xmlCell(h, { w: widths[i], fill: NAVY, color: 'FFFFFF', bold: true, sz: 17 })).join('') + '</w:tr>';
    rows.forEach((r, ri) => {
      x += '<w:tr><w:trPr><w:cantSplit/></w:trPr>' +
        r.map((c, i) => xmlCell(c.t, Object.assign({ w: widths[i], fill: ri % 2 ? ZEBRA : null }, c))).join('') + '</w:tr>';
    });
    return x + '</w:tbl>' + XML_VIDE;
  }

  function genererTableaux(V) {
    const rq = V.risqueRows || [], pr = V.precoRows || [];
    if (!rq.length && !pr.length) return '';
    let out = XML_TITRE('Analyse PréventIA-LaB de la fiche d’entreprise');
    if (V.synthese) out += XML_H('Synthèse de l’analyse') + XML_PARA(V.synthese);
    if (rq.length) {
      out += XML_H('Tableau synthétique des risques');
      out += xmlTable([2000, 3900, 1300, 2400], ['Famille de risque', 'Moyens en place (déclarés ou observés)', 'Statut', 'Référence'],
        rq.map(r => {
          const s = STAT[r.statut] || STAT.warn;
          return [{ t: r.risque, bold: true }, { t: r.moyens }, { t: s[0], bold: true, color: s[1] }, { t: r.ref, color: '44546A' }];
        }));
    }
    out += XML_H('Préconisations employeur priorisées');
    const prRows = pr.length ? pr : [{ texte: 'Aucune préconisation restante après déduplication.', ref: '—', prio: 'recommandee', delai: '—' }];
    out += xmlTable([3800, 2500, 2000, 1300], ['Préconisation', 'Référence réglementaire', 'Priorité', 'Échéance'],
      prRows.map(p => {
        const q = PRIO[p.prio] || PRIO.recommandee;
        return [{ t: p.texte }, { t: p.ref, color: '44546A' }, { t: q[0], bold: true, color: q[1] }, { t: p.delai }];
      }));
    return out;
  }

  /**
   * Construit le XML complet du bloc conclusions.
   * @param {string[]} risquesActifs  ids de risques (ex: ['ecran','rps','tms'])
   * @param {object}   cat            catalogue conclusions-fe.json
   */
  function genererConclusions(risquesActifs, cat, metiers, spec, db) {
    metiers = metiers || [];
    // 1. Blocs demandés : risques cochés + blocs propres aux métiers (_conclusions)
    const voulus = new Set();
    const sources = {};                         // bloc → ids de risques qui l'appellent
    for (const id of risquesActifs) (cat.mapping[id] || []).forEach((k, i) => {
      voulus.add(k);
      if (i === 0) (sources[k] = sources[k] || []).push(id);   // précisions sur le bloc principal seulement
    });
    // Métiers réellement exposés à un risque donné
    const cleDe = id => Object.keys((db && db.risques) || {}).find(c => db.risques[c].id === id);
    const exposes = id => metiers.filter(m => (m.risques || []).includes(cleDe(id)));
    metiers.forEach(m => {
      let e = spec && spec.metiers && spec.metiers[m.id], n = 0;
      while (e && n++ < 4) { (e._conclusions || []).forEach(k => voulus.add(k)); e = e._herite ? spec.metiers[e._herite] : null; }
    });
    // 2. Précisions métier par bloc (dédoublonnées, métiers regroupés)
    // Un seul paragraphe par groupe de métiers : on cumule d'abord les conseils
    // de chaque métier (ex. TMS + postures), puis on regroupe les métiers identiques
    const precisionsBloc = k => {
      const parMetier = new Map();
      (sources[k] || []).forEach(id => exposes(id).forEach(m => {
        const p = precision(spec, m.id, id); if (!p || !p.conseils) return;
        if (!parMetier.has(m.label)) parMetier.set(m.label, []);
        const l = parMetier.get(m.label);
        lignes(p.conseils).forEach(x => { if (!l.includes(x)) l.push(x); });
      }));
      const g = new Map();
      parMetier.forEach((l, nom) => {
        const cle = l.join(' ; ');
        if (!g.has(cle)) g.set(cle, []);
        g.get(cle).push(nom);
      });
      return [...g.entries()].map(([conseils, noms]) => ({ conseils, noms: noms.join(', ') }));
    };
    // 3. Assemblage dans l'ordre du catalogue (= ordre du modèle Word)
    let out = blocToXml(cat.commun.installations_generales);
    Object.keys(cat.risques).forEach(k => { if (voulus.has(k)) out += blocToXml(cat.risques[k], precisionsBloc(k)); });
    for (const k of (cat.toujours_inclure || [])) if (k !== 'installations_generales') out += blocToXml(cat.commun[k]);
    return out;
  }

  // ─────────────────────────────────────────────────────────────────────
  // Fonction principale
  // ─────────────────────────────────────────────────────────────────────
  async function exporterFicheSPSTI(donnees) {
    if (typeof PizZip === 'undefined') {
      throw new Error('PizZip non chargé — ajoutez le <script> CDN dans index.html');
    }

    const { tpl, cat, spec } = await chargerRessources();
    const zip = new PizZip(tpl);
    let xml = zip.file('word/document.xml').asText();

    // 1. Remplacements des placeholders scalaires
    const V = donnees;
    const remplacements = {
      // En-tête médecin du travail (constantes SPSTI 23/87)
      '{{CP}}':                 V.cpMdt              ?? '87000',
      '{{VILLE}}':              V.villeMdt           ?? 'LIMOGES CEDEX',
      '{{TELEPHONE_MDT}}':      V.telMdt             ?? '',
      '{{EMAIL_MDT}}':          V.emailMdt           ?? '',
      // Fiche
      '{{NOM_ENTREPRISE}}':     V.nomEntreprise      ?? '',
      '{{N_ADHERENT}}':         V.numAdherent        ?? '',
      '{{DATE_VISITE}}':        V.dateVisite         ?? '',
      '{{REDACTEUR}}':          V.redacteur          ?? '',
      // Renseignements
      '{{ADRESSE}}':            V.adresse            ?? '',
      '{{CHEF_ENTREPRISE}}':    V.chefEntreprise     ?? '',
      '{{PERSONNE_RENCONTREE}}':V.personneRencontree ?? '',
      '{{TELEPHONE_ENTREPRISE}}':V.telEntreprise     ?? '',
      '{{MAIL_ENTREPRISE}}':    V.mailEntreprise     ?? '',
      '{{NAF}}':                V.naf                ?? '',
      '{{ACTIVITE}}':           V.activite           ?? '',
      // GHE (premier GHE — le template a 14 occurrences de {{GHE_NOM}})
      '{{GHE_NOM}}':            V.gheNom             ?? '',
      '{{GHE_METIERS}}':        V.gheMetiers         ?? '',
      // Divers optionnels
      '{{REFERENT_SECURITE}}':  V.referentSecurite   ?? '',
      '{{AT_COMMENTAIRES}}':    V.atCommentaires     ?? '',
      '{{CHIMIQUE_PRODUITS}}':  V.chimiqueProduits   ?? '',
      '{{VERIFICATIONS_COMMENT}}': V.verifComment     ?? '',
      '{{URGENCES_COMMENT}}':   V.urgencesComment    ?? '',
      '{{LOCAL_4}}':            V.local4             ?? '',
      '{{LOCAL_5}}':            V.local5             ?? '',
      '{{LOCAL_6}}':            V.local6             ?? '',
      '{{LOCAUX_DESCRIPTION}}': V.locauxDescription  ?? '',
    };
    for (const [ph, val] of Object.entries(remplacements)) {
      xml = xml.split(ph).join(escapeXml(val));   // remplace TOUTES les occurrences
    }

    // 2a. Tableaux « Facteurs de risques » (6 catégories du template)
    const facteurs = construireFacteurs(V.risquesActifs || [], V.metiersSel || [],
      (typeof DB !== 'undefined') ? DB : {}, (typeof answers !== 'undefined') ? answers : {}, spec);
    xml = remplirFacteurs(xml, facteurs);

    // 2b. Injection des conclusions dynamiques
    _liens = [];
    const blocXml = genererTableaux(V) + genererConclusions(V.risquesActifs || [], cat, V.metiersSel || [], spec, (typeof DB !== 'undefined') ? DB : {});
    // Paragraphe contenant le marqueur, quels que soient ses attributs (w14:paraId… ajoutés par Word)
    const reBloc = /<w:p[ >](?:(?!<w:p[ >])[\s\S])*?\{\{BLOC_CONCLUSIONS\}\}[\s\S]*?<\/w:p>/;
    if (!reBloc.test(xml)) throw new Error('Marqueur {{BLOC_CONCLUSIONS}} introuvable dans le template');
    xml = xml.replace(reBloc, () => blocXml);

    // 3. Rezipper et déclencher le téléchargement
    zip.file('word/document.xml', xml);
    // Relations des liens hypertextes ajoutés dans les conclusions
    if (_liens.length) {
      const relPath = 'word/_rels/document.xml.rels';
      let rels = zip.file(relPath).asText();
      const ajout = _liens.map(l => '<Relationship Id="' + l.id + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="' +
        escapeXml(l.url).replace(/"/g, '&quot;') + '" TargetMode="External"/>').join('');
      zip.file(relPath, rels.replace('</Relationships>', ajout + '</Relationships>'));
    }
    const blob = zip.generate({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      compression: 'DEFLATE'
    });

    const nomFichier = `FE_${(V.nomEntreprise || 'entreprise').replace(/[^\w\-]+/g, '_')}_${(V.dateVisite || '').replace(/[^\w\-]+/g, '')}.docx`;
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: nomFichier });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    return nomFichier;
  }

  // ─────────────────────────────────────────────────────────────────────
  // Pont avec l'outil : construit l'objet donnees depuis l'état courant
  // ─────────────────────────────────────────────────────────────────────
  /**
   * Récupère les risques cochés depuis aggregate() + answers de l'outil.
   * À appeler juste avant exporterFicheSPSTI si tu veux l'automatiser.
   */
  function risquesDepuisOutil() {
    // aggregate() et answers sont des globales de index.html
    if (typeof aggregate !== 'function') return [];
    const A = aggregate();
    // On ne garde que les risques réellement évalués (état ≠ 'nc' et défini)
    return A.risks
      .filter(r => {
        const a = (typeof answers !== 'undefined') ? answers[r.id] : undefined;
        return a && a !== 'nc';   // maitrise / partiel / non
      })
      .map(r => r.id);
  }

  // ─────────────────────────────────────────────────────────────────────
  // Fonction pont : lit l'état courant de l'UI et lance l'export
  // ─────────────────────────────────────────────────────────────────────
  // 2026-10-14 → 14/10/2026
  const dateFR = d => /^\d{4}-\d{2}-\d{2}$/.test(d) ? d.split('-').reverse().join('/') : d;

  function exportSPSTI() {
    // Onglet « Améliorateur » actif + fiche importée → on lit l'améliorateur (AME)
    const paneB = document.getElementById('paneB');
    const ame = global.AME;
    const modeB = !!(paneB && !paneB.classList.contains('hidden') && ame && ame.state && ame.state.risqueRows.length);

    let risquesActifs = [];
    let m = (typeof M !== 'undefined') ? M : {};
    let tableaux = {};

    if (modeB) {
      ame.collect();                                   // récupère les corrections faites à l'écran
      const st = ame.state;
      risquesActifs = [...new Set(st.risqueRows
        .map(r => (typeof ame.matchRisk === 'function') ? ame.matchRisk(r.risque) : null)
        .filter(Boolean).map(r => r.id))];
      m = Object.assign({}, m, st.meta);
      tableaux = { risqueRows: st.risqueRows, precoRows: st.precoRows, synthese: st.synthese || '' };
    } else {
      // Onglet « Création » : risques évalués, sinon tous les risques détectés
      risquesActifs = risquesDepuisOutil();
      if (!risquesActifs.length && typeof aggregate === 'function') {
        risquesActifs = aggregate().risks.map(r => r.id);
      }
    }

    if (!risquesActifs.length && !(tableaux.risqueRows || []).length) {
      alert('Aucun risque détecté : importez une fiche (onglet Améliorateur) ou sélectionnez un NAF, une unité de travail ou un métier (onglet Création).');
      return;
    }
    const s = (typeof S !== 'undefined') ? S : {};
    const db = (typeof DB !== 'undefined') ? DB : {};

    // Métiers sélectionnés (champ GHE + précisions par métier)
    const metiersSel = (s.metiers && db.metiers)
      ? [...s.metiers].map(id => db.metiers.find(mt => mt.id === id)).filter(Boolean)
      : [];
    const gheNom = metiersSel.map(mt => mt.label).join(', ');

    // Assembler les données pour le template
    const donnees = {
      nomEntreprise:      m.entreprise || '',
      naf:                m.naf || '',
      activite:           m.nafLib || '',
      dateVisite:         dateFR(m.date || new Date().toISOString().slice(0, 10)),
      redacteur:          m.preventeur || '',
      gheNom:             gheNom,
      metiersSel:         metiersSel,
      risquesActifs:      risquesActifs,
      risqueRows:         tableaux.risqueRows || [],
      precoRows:          tableaux.precoRows || [],
      synthese:           tableaux.synthese || '',
    };

    // Feedback visuel
    const btn = (typeof event !== 'undefined' && event && event.target && event.target.closest)
      ? event.target.closest('button') : document.querySelector('[onclick="exportSPSTI()"]');
    const label = btn ? btn.textContent : '';
    if (btn) { btn.textContent = '⏳ Génération en cours…'; btn.disabled = true; }

    exporterFicheSPSTI(donnees)
      .then(nom => {
        console.log('✅ Fiche SPSTI générée :', nom);
        if (btn) { btn.textContent = '✅ Téléchargé !'; setTimeout(() => { btn.textContent = label; btn.disabled = false; }, 2000); }
      })
      .catch(err => {
        console.error('❌ Export SPSTI échoué :', err);
        alert('Erreur : ' + err.message + '\n\nVérifiez que les fichiers fiche-entreprise-spsti-template.docx et conclusions-fe.json sont bien dans le dossier fiche-entreprise/ sur GitHub.');
        if (btn) { btn.textContent = label; btn.disabled = false; }
      });
  }

  // Exposer dans le scope global
  global.exporterFicheSPSTI = exporterFicheSPSTI;
  global.risquesDepuisOutil = risquesDepuisOutil;
  global.exportSPSTI = exportSPSTI;
  global.SPSTI_genererConclusions = genererConclusions;

})(window);
