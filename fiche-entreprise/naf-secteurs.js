/* =====================================================================
   PréventIA-LaB — Résolveur NAF → profil de risque
   ---------------------------------------------------------------------
   Charge `naf-secteurs.json` (table de règles éditable) et réaffecte le
   champ `secteur` de chaque code NAF. Si le fichier est absent, la valeur
   `secteur` déjà présente dans `naf-codes.json` est conservée (fallback).

   Usage :
     await NAFSEC.load();                  // à faire après loadNafCodes()
     NAFSEC.resolve('88.10A')              // → 'aide_domicile'
     NAFSEC.apply(NAF_CODES);              // réécrit .secteur sur place
     NAFSEC.label('aide_domicile')         // → 'Aide et services à domicile'
     NAFSEC.explain('81.30Z')              // → {secteur, regle, commentaire}

   Auteur : Laure Bonnefond · PréventIA-LaB · 2026
   ===================================================================== */
(function (global) {
  'use strict';

  let TABLE = null;                 // contenu de naf-secteurs.json
  const cache = new Map();

  /* --- Chargement (silencieux si le fichier n'existe pas) --- */
  async function load(url = 'naf-secteurs.json') {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const d = await r.json();
      if (!d || !Array.isArray(d.regles)) throw new Error('format invalide');
      TABLE = d;
      cache.clear();
      console.log(`✅ Table NAF→secteur chargée : ${d.regles.length} règles, ${Object.keys(d.overrides || {}).filter(k => !k.startsWith('__')).length} override(s)`);
      return true;
    } catch (e) {
      console.log('naf-secteurs.json absent ou invalide — le champ `secteur` de naf-codes.json est conservé.');
      TABLE = null;
      return false;
    }
  }

  /* --- Résolution d'un code, avec traçabilité --- */
  function explain(code) {
    if (!TABLE) return { secteur: null, regle: null, commentaire: 'table non chargée' };
    code = String(code || '').trim().toUpperCase();
    const div = code.slice(0, 2);

    const ov = TABLE.overrides || {};
    if (ov[code]) return { secteur: ov[code], regle: 'override', commentaire: 'cas particulier déclaré manuellement' };

    for (const r of TABLE.regles) {
      let hit = false;
      if (r.type === 'codes')    hit = r.valeurs.includes(code);
      else if (r.type === 'prefixe')  hit = r.valeurs.some(p => code.startsWith(p));
      else if (r.type === 'division') hit = r.valeurs.includes(div);
      if (hit) return { secteur: r.secteur, regle: r.id, commentaire: r.commentaire || '' };
    }
    return { secteur: TABLE.defaut || 'tertiaire', regle: 'defaut', commentaire: 'aucune règle spécifique' };
  }

  function resolve(code) {
    if (!TABLE) return null;
    if (cache.has(code)) return cache.get(code);
    const s = explain(code).secteur;
    cache.set(code, s);
    return s;
  }

  /* --- Application en masse sur un tableau de codes NAF --- */
  function apply(codes) {
    if (!TABLE || !Array.isArray(codes)) return 0;
    let n = 0;
    codes.forEach(c => {
      const code = c.code || c.c;
      if (!code) return;
      const s = resolve(code);
      if (s && s !== c.secteur) n++;
      if (s) { c.secteur = s; c.sec = s; }
    });
    if (n) console.log(`↻ ${n} code(s) NAF réaffecté(s) par naf-secteurs.json`);
    return n;
  }

  function label(id) {
    if (!TABLE) return id;
    const s = (TABLE.secteurs || []).find(x => x.id === id);
    return s ? s.label : id;
  }
  function secteurs() { return TABLE ? TABLE.secteurs.slice() : []; }

  /* --- Statistiques (utile pour vérifier une modif de règle) --- */
  function stats(codes) {
    const o = {};
    (codes || []).forEach(c => { const s = resolve(c.code || c.c) || c.secteur; o[s] = (o[s] || 0) + 1; });
    return Object.entries(o).sort((a, b) => b[1] - a[1]);
  }

  global.NAFSEC = { load, resolve, explain, apply, label, secteurs, stats, get table() { return TABLE; } };
})(window);
