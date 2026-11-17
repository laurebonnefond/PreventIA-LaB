/* =====================================================================
   PréventIA-LaB — Rattachement NAF → profil de risque
   ---------------------------------------------------------------------
   Lit naf-secteurs.json (règles modifiables à la main) et l'applique
   aux codes NAF chargés par index.html.
   API : NAFSEC.load() · NAFSEC.apply(codes) · NAFSEC.label(idSecteur)
   Règles : la PREMIÈRE qui correspond gagne ; « overrides » passe en dernier.
   ===================================================================== */
(function (global) {
  'use strict';
  let cfg = null;

  async function load() {
    try {
      const r = await fetch('naf-secteurs.json');
      if (r.ok) cfg = await r.json();
    } catch (e) { console.warn('[naf-secteurs] naf-secteurs.json non chargé :', e.message); }
    return cfg;
  }

  function secteurDe(code) {
    if (!cfg) return null;
    const ov = (cfg.overrides || {})[code];
    if (ov) return ov;
    for (const r of cfg.regles || []) {
      const v = r.valeurs || [];
      if (r.type === 'codes' && v.includes(code)) return r.secteur;
      if (r.type === 'prefixe' && v.some(p => code.startsWith(p))) return r.secteur;
      if (r.type === 'division' && v.includes(code.slice(0, 2))) return r.secteur;
    }
    return cfg.defaut || null;
  }

  /* Écrit le champ « secteur » de chaque code (x.c = « 01.11Z ») */
  function apply(codes) {
    if (!cfg) return;
    (codes || []).forEach(x => { const s = secteurDe(x.c || x.code || ''); if (s) x.secteur = s; });
  }

  function label(id) {
    const s = cfg && (cfg.secteurs || []).find(x => x.id === id);
    return s ? s.label : (id || '');
  }

  global.NAFSEC = { load, apply, label, secteurDe };
})(window);
