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
    const blocXml = genererConclusions(V.risquesActifs || [], cat);
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
  function exportSPSTI() {
    // Récupérer les risques évalués depuis l'outil
    let risquesActifs = risquesDepuisOutil();

    // Si aucun risque évalué, prendre TOUS les risques détectés (non évalués = présents quand même)
    if (!risquesActifs.length && typeof aggregate === 'function') {
      risquesActifs = aggregate().risks.map(r => r.id);
    }

    if (!risquesActifs.length) {
      alert('Sélectionnez d\'abord un NAF, une unité de travail ou un métier pour détecter les risques.');
      return;
    }

    // Lire les métadonnées depuis l'objet global M de index.html
    const m = (typeof M !== 'undefined') ? M : {};
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
      dateVisite:         m.date || new Date().toISOString().slice(0, 10),
      redacteur:          m.preventeur || '',
      gheNom:             gheNom,
      risquesActifs:      risquesActifs,
    };

    // Feedback visuel
    const btn = document.querySelector('[onclick="exportSPSTI()"]');
    if (btn) { btn.textContent = '⏳ Génération en cours…'; btn.disabled = true; }

    exporterFicheSPSTI(donnees)
      .then(nom => {
        console.log('✅ Fiche SPSTI générée :', nom);
        if (btn) { btn.textContent = '✅ Téléchargé !'; setTimeout(() => { btn.textContent = '📋 Export SPSTI officiel'; btn.disabled = false; }, 2000); }
      })
      .catch(err => {
        console.error('❌ Export SPSTI échoué :', err);
        alert('Erreur : ' + err.message + '\n\nVérifiez que les fichiers fiche-spsti-template.docx et conclusions-fe.json sont bien dans le dossier fiche-entreprise/ sur GitHub.');
        if (btn) { btn.textContent = '📋 Export SPSTI officiel'; btn.disabled = false; }
      });
  }

  // Exposer dans le scope global
  global.exporterFicheSPSTI = exporterFicheSPSTI;
  global.risquesDepuisOutil = risquesDepuisOutil;
  global.exportSPSTI = exportSPSTI;
  global.SPSTI_genererConclusions = genererConclusions;

})(window);
