/* ═══════════════════════════════════════════════════════════════════════
   pcs-loader.js — Enrichit DB.metiers avec les professions PCS 2020
   ───────────────────────────────────────────────────────────────────────
   Au chargement, récupère pcs2020.json et ajoute dans DB.metiers toutes
   les professions qui n'y figurent pas encore. Résultat : quand on
   sélectionne un NAF, TOUS les métiers PCS associés apparaissent en chips.

   Placer ce <script> APRÈS la ligne qui définit DB={...} et AVANT draw().
   ═══════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ── Table de correspondance : libellé risque PCS → clé exacte DB.risques ──
  // Les libellés dans pcs2020.json sont courts ; ceux dans DB.risques sont
  // parfois plus longs. On normalise vers les clés exactes de DB.risques.
  const RISK_MAP = {
    'Risque routier':                       'Risque routier',
    'Vibrations mécaniques':                'Vibrations mécaniques',
    'Risque machine':                       'Risque machine',
    'Risque chimique (incl. radon, CMR)':   'Risque chimique (incl. radon, CMR)',
    'Risque chimique':                      'Risque chimique (incl. radon, CMR)',
    'Manutention manuelle':                 'Manutention manuelle',
    'Ambiance thermique':                   'Ambiance thermique',
    'Risque biologique':                    'Risque biologique',
    'TMS / Travail répétitif':              'TMS / Travail répétitif',
    'Postures contraignantes':              'Postures contraignantes',
    'Bruit':                                'Bruit',
    'RPS / contact public':                 'RPS / contact public',
    'Travail sur écran':                    'Travail sur écran',
    'Chute de plain-pied':                  'Chute de plain-pied',
    'Chute de hauteur':                     'Chute de hauteur',
    'Coactivité':                           'Coactivité',
    'Risque électrique':                    'Risque électrique',
    'Incendie / explosion':                 'Incendie / explosion',
    'Horaires atypiques / nuit':            'Horaires atypiques / nuit',
    'Horaires atypiques':                   'Horaires atypiques / nuit',
    'Travail isolé':                        'Travail isolé',
    'Addictions / sécurité':                'Addictions / sécurité',
    // Alias (anciens libellés / formes courtes)
    'Éclairage / rayonnements':             'Rayonnements non ionisants / CEM',
    'Silice':                               'Poussières minérales / silice cristalline',
    'Contact animal':                       'Contact animal (morsures, coups, contention)',
  };

  // ── Table NAF section → label secteur (pour le champ "secteur" des chips) ──
  const SECT_LABELS = {
    A: 'A · Agriculture', B: 'B · Extraction', C: 'C · Industrie',
    D: 'D · Énergie', E: 'E · Déchets', F: 'F · Construction',
    G: 'G · Commerce', H: 'H · Transport', I: 'I · Restauration',
    J: 'J · Info-com', K: 'K · Finance', L: 'L · Immobilier',
    M: 'M · Scientifique', N: 'N · Services admin', O: 'O · Administration',
    P: 'P · Enseignement', Q: 'Q · Santé', R: 'R · Loisirs',
    S: 'S · Services', T: 'T · Ménages',
  };

  // ── Suivi médical par défaut selon les risques ──
  // Approximation : en droit, le SIR ne vise que les CMR (pas tout le risque
  // chimique) et les agents biologiques des groupes 3-4 (pas tout le biologique).
  // Le bruit ne relève pas du SIR (R.4624-23) : retiré de la liste.
  // Pour imposer le bon suivi, renseigner "suivi" dans pcs2020.json.
  function deduireSuivi(risques) {
    const SIR_TRIGGERS = [
      'Risque biologique', 'Risque chimique (incl. radon, CMR)',
      'Chute de hauteur', 'Rayonnements ionisants', 'Risque hyperbare',
      'Poussières minérales / silice cristalline',
    ];
    if (risques.some(r => SIR_TRIGGERS.includes(r))) return 'SIR';
    const SIA_TRIGGERS = [
      'Vibrations mécaniques', 'Manutention manuelle', 'Horaires atypiques / nuit',
      'Travail isolé', 'RPS / contact public',
    ];
    if (risques.some(r => SIA_TRIGGERS.includes(r))) return 'SIA';
    return 'SI';
  }

  function deduirePeriodicite(suivi) {
    return suivi === 'SIR' ? 4 : suivi === 'SIA' ? 3 : 5;
  }

  // ── Chargement et fusion ──
  async function fusionnerPCS() {
    if (typeof DB === 'undefined' || !DB.metiers) {
      console.warn('[pcs-loader] DB.metiers non trouvé — abandon.');
      return;
    }

    let pcs;
    try {
      const r = await fetch('./pcs2020.json');
      if (!r.ok) throw new Error(r.status);
      pcs = await r.json();
    } catch (e) {
      console.warn('[pcs-loader] pcs2020.json non chargé :', e.message);
      return;
    }

    // Index des IDs déjà présents (pour dédoublonner)
    const idsExistants = new Set(DB.metiers.map(m => m.id));
    // Index des labels normalisés (pour détecter les doublons par nom)
    const labelsNorm = new Set(DB.metiers.map(m => m.label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')));

    let ajouts = 0;
    for (const prof of pcs.professions) {
      const id = 'm_pcs_' + prof.c;  // ex: m_pcs_311
      if (idsExistants.has(id)) continue;

      // Vérifier si un métier au label similaire existe déjà
      const labelNorm = prof.l.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const dejaPresent = [...labelsNorm].some(existing =>
        // libellé identique, ou l'un commence par l'autre (« Chirurgien-dentiste »
        // ↔ « Chirurgien-dentiste / Assistant(e) dentaire »). L'ancien test sur
        // 10 caractères confondait « Ouvrier qualifié… » ou « Auxiliaire… ».
        existing === labelNorm || existing.startsWith(labelNorm) || labelNorm.startsWith(existing)
      );
      if (dejaPresent) continue;

      // Convertir les risques PCS → clés DB.risques
      const risques = prof.risques
        .map(r => RISK_MAP[r] || r)
        .filter(r => {                                // ne garder que les risques connus
          const ok = DB.risques && DB.risques[r];
          if (!ok) console.warn(`[pcs-loader] risque inconnu ignoré pour ${prof.c} : « ${r} »`);
          return ok;
        });

      // Construire le secteur à partir du premier NAF
      const secteur = SECT_LABELS[prof.naf?.[0]] || '';

      // Suivi : imposé par pcs2020.json si renseigné, sinon déduit des risques
      const suivi = prof.suivi || deduireSuivi(risques);

      const metier = {
        id:              id,
        label:           prof.l,
        secteur:         secteur,
        risques:         risques,
        suivi:           suivi,
        periodicite_ans: deduirePeriodicite(suivi),
        _pcs:            prof.c,       // référence PCS pour traçabilité
        _naf:            prof.naf,     // sections NAF associées (traçabilité)
        naf_codes:       prof.naf_codes || [],  // codes/préfixes NAF précis (auto-sélection)
      };

      DB.metiers.push(metier);
      idsExistants.add(id);
      labelsNorm.add(labelNorm);
      ajouts++;
    }

    if (ajouts > 0) {
      // Trier par secteur puis label pour un affichage propre
      DB.metiers.sort((a, b) => (a.secteur + a.label).localeCompare(b.secteur + b.label, 'fr'));
      console.log(`[pcs-loader] ✅ ${ajouts} professions PCS ajoutées → ${DB.metiers.length} métiers total`);
      // Redessiner les chips métiers ET risques
      if (typeof drawMetiers === 'function') drawMetiers();
      if (typeof drawRisques === 'function') drawRisques();
    } else {
      console.log('[pcs-loader] Tous les métiers PCS déjà présents.');
    }
  }

  // ── Enrichir l'auto-sélection NAF → métiers ──
  // index.html appelle pickNaf() → autoMetiers(x) (l'ancienne surcharge de
  // selectNaf ne se déclenchait jamais : cette fonction n'existe pas).
  // On complète autoMetiers : pré-coche les métiers (DB ou PCS) dont un
  // naf_codes est un préfixe du code choisi (ex. "23.4" ↔ "23.41Z").
  // Pas de correspondance par section entière : un NAF « C » cocherait tous
  // les métiers de l'industrie (boulanger, soudeur, porcelainier…).
  const _origAuto = window.autoMetiers;
  window.autoMetiers = function (x) {
    if (typeof _origAuto === 'function') _origAuto(x);
    const code = x && (x.c || x.code);
    if (!code || typeof S === 'undefined') return;
    DB.metiers.forEach(m => {
      if ((m.naf_codes || []).some(p => code.startsWith(p))) S.metiers.add(m.id);
    });
  };

  // Lancer la fusion au chargement
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fusionnerPCS);
  } else {
    fusionnerPCS();
  }

})();
