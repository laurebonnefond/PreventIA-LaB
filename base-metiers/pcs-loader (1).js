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
  function deduireSuivi(risques) {
    const SIR_TRIGGERS = [
      'Risque biologique', 'Risque chimique (incl. radon, CMR)',
      'Chute de hauteur', 'Bruit',
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
        existing.includes(labelNorm.slice(0, 10)) || labelNorm.includes(existing.slice(0, 10))
      );
      if (dejaPresent) continue;

      // Convertir les risques PCS → clés DB.risques
      const risques = prof.risques
        .map(r => RISK_MAP[r] || r)
        .filter(r => DB.risques && DB.risques[r]);  // ne garder que les risques connus

      // Construire le secteur à partir du premier NAF
      const secteur = SECT_LABELS[prof.naf?.[0]] || '';

      // Suivi médical déduit des risques
      const suivi = deduireSuivi(risques);

      const metier = {
        id:              id,
        label:           prof.l,
        secteur:         secteur,
        risques:         risques,
        suivi:           suivi,
        periodicite_ans: deduirePeriodicite(suivi),
        _pcs:            prof.c,       // référence PCS pour traçabilité
        _naf:            prof.naf,     // sections NAF associées (pour auto-sélection)
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
      // Redessiner les chips si la fonction draw existe
      if (typeof drawRisques === 'function') drawRisques();
    } else {
      console.log('[pcs-loader] Tous les métiers PCS déjà présents.');
    }
  }

  // ── Enrichir aussi l'auto-sélection NAF → métiers ──
  // Surcharge la sélection NAF pour aussi pré-cocher les métiers PCS
  // dont le champ _naf contient la section du NAF sélectionné.
  const _origSelectNaf = window.selectNaf;
  window.selectNaf = function (x) {
    // Appeler la fonction originale
    if (typeof _origSelectNaf === 'function') _origSelectNaf(x);

    // Auto-sélectionner les métiers PCS dont la section NAF correspond
    if (x && x.s && typeof S !== 'undefined') {
      DB.metiers.forEach(m => {
        if (m._naf && m._naf.includes(x.s)) {
          S.metiers.add(m.id);
        }
      });
      if (typeof drawRisques === 'function') drawRisques();
    }
  };

  // Lancer la fusion au chargement
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fusionnerPCS);
  } else {
    fusionnerPCS();
  }

})();
