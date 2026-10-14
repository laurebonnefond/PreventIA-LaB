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

  // Cache mémoire pour éviter de re-télécharger à chaque export
  let _tplBuffer = null;
  let _catalogue = null;

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
    return { tpl: _tplBuffer, cat: _catalogue };
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

  const XML_PARA = t =>
    '<w:p><w:pPr>' +
      '<w:spacing w:before="0" w:after="120"/><w:jc w:val="both"/>' +
    '</w:pPr>' +
    '<w:r><w:t xml:space="preserve">' + escapeXml(t) + '</w:t></w:r></w:p>';

  const XML_VIDE = '<w:p/>';

  function blocToXml(bloc) {
    if (!bloc) return '';
    let out = XML_TITRE(bloc.titre);
    for (const p of bloc.paragraphes) out += XML_PARA(p);
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
    return '<w:tc><w:tcPr><w:tcW w:w="' + o.w + '" w:type="dxa"/>' + fill + '</w:tcPr>' +
      '<w:p><w:pPr><w:spacing w:before="40" w:after="40"/></w:pPr><w:r>' + rpr +
      '<w:t xml:space="preserve">' + escapeXml(txt) + '</w:t></w:r></w:p></w:tc>';
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
      out += xmlTable([2000, 3900, 1300, 2400], ['Famille de risque', 'Moyens en place (observés)', 'Statut', 'Référence'],
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
  function genererConclusions(risquesActifs, cat) {
    // 1. Résoudre les clés de blocs via la table de correspondance
    const cles = [];
    const vus = new Set();
    for (const id of risquesActifs) {
      const mapped = cat.mapping[id] || [];
      for (const k of mapped) {
        if (!vus.has(k)) { vus.add(k); cles.push(k); }
      }
    }

    // 2. Assemblage ordonné
    const blocs = [];
    // 2a. Installations générales en tête (toujours)
    blocs.push(cat.commun.installations_generales);
    // 2b. Les blocs de risques identifiés
    for (const k of cles) blocs.push(cat.risques[k]);
    // 2c. Blocs communs de clôture
    for (const k of (cat.toujours_inclure || [])) {
      if (k !== 'installations_generales') blocs.push(cat.commun[k]);
    }

    // 3. Rendu XML
    return blocs.map(blocToXml).join('');
  }

  // ─────────────────────────────────────────────────────────────────────
  // Fonction principale
  // ─────────────────────────────────────────────────────────────────────
  async function exporterFicheSPSTI(donnees) {
    if (typeof PizZip === 'undefined') {
      throw new Error('PizZip non chargé — ajoutez le <script> CDN dans index.html');
    }

    const { tpl, cat } = await chargerRessources();
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
    };
    for (const [ph, val] of Object.entries(remplacements)) {
      xml = xml.split(ph).join(escapeXml(val));   // remplace TOUTES les occurrences
    }

    // 2. Injection des conclusions dynamiques
    const blocXml = genererTableaux(V) + genererConclusions(V.risquesActifs || [], cat);
    xml = xml.replace(
      '<w:p><w:r><w:t>{{BLOC_CONCLUSIONS}}</w:t></w:r></w:p>',
      blocXml
    );

    // 3. Rezipper et déclencher le téléchargement
    zip.file('word/document.xml', xml);
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

    // Construire le nom des métiers sélectionnés (pour le champ GHE)
    let gheNom = '';
    if (s.metiers && db.metiers) {
      gheNom = [...s.metiers]
        .map(id => db.metiers.find(mt => mt.id === id))
        .filter(Boolean)
        .map(mt => mt.label)
        .join(', ');
    }

    // Assembler les données pour le template
    const donnees = {
      nomEntreprise:      m.entreprise || '',
      naf:                m.naf || '',
      activite:           m.nafLib || '',
      dateVisite:         dateFR(m.date || new Date().toISOString().slice(0, 10)),
      redacteur:          m.preventeur || '',
      gheNom:             gheNom,
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
