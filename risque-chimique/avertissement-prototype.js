/* ════════════════════════════════════════════════════════════════
   AVERTISSEMENT PROTOTYPE — PréventIA-LaB
   Bandeau permanent + fenêtre de lecture obligatoire + filigrane impression.
   Usage : <script src="avertissement-prototype.js" defer></script>
   Pour changer le texte : modifier l'objet AVERT ci-dessous.
   Incrémenter AVERT.version force une nouvelle lecture chez tous les utilisateurs.
   ════════════════════════════════════════════════════════════════ */
(function () {
  const AVERT = {
    version: 'v1-2026-11',
    titre: 'Prototype à visée pédagogique',
    bandeau: "Outil en cours de développement. Il ne remplace ni la FDS du fournisseur, ni l'expertise toxicologique, ni l'avis du médecin du travail.",
    points: [
      ["🧪", "<strong>Prototype pédagogique</strong> — outil expérimental, non validé scientifiquement ni institutionnellement. Il sert à sensibiliser et à structurer la réflexion, pas à conclure."],
      ["📄", "<strong>La FDS du fournisseur fait foi</strong> (Règlement REACH, art. 31). Les informations proposées par l'outil, notamment par l'IA, peuvent être incomplètes ou erronées : vérifier chaque donnée sur la FDS à jour."],
      ["🔬", "<strong>Ne remplace pas l'expertise toxicologique.</strong> Toute question sur la toxicité, les mélanges, la substitution ou la métrologie relève du toxicologue et de l'équipe pluridisciplinaire du SPSTI."],
      ["🩺", "<strong>Validation par le médecin du travail.</strong> Toute conclusion concernant les salariés (suivi individuel, exposition CMR, VLEP, conduite à tenir) doit être validée par le médecin du travail."],
      ["🔒", "<strong>Aucune donnée nominative ou de santé</strong> ne doit être saisie dans cet outil."]
    ],
    mentionImpression: "PROTOTYPE PÉDAGOGIQUE — Document de travail non validé. La FDS du fournisseur fait foi. À valider par le médecin du travail et l'expertise toxicologique du SPSTI."
  };
  const CLE = 'preventia-avert-chimique-' + AVERT.version;

  const css = `
  .pv-bandeau{position:relative;z-index:50;display:flex;align-items:center;gap:12px;flex-wrap:wrap;
    background:#fff7ed;border-bottom:2px solid #f97316;color:#7c2d12;padding:10px 16px;
    font:500 13px/1.45 'DM Sans',system-ui,sans-serif}
  .pv-badge{background:#f97316;color:#fff;font-weight:700;font-size:11px;letter-spacing:.06em;
    text-transform:uppercase;padding:4px 10px;border-radius:999px;white-space:nowrap}
  .pv-bandeau p{margin:0;flex:1;min-width:220px}
  .pv-bandeau button{background:none;border:1px solid #f97316;color:#9a3412;border-radius:8px;
    padding:5px 12px;font:600 12px 'DM Sans',system-ui,sans-serif;cursor:pointer}
  .pv-voile{position:fixed;inset:0;z-index:2000;background:rgba(15,23,42,.6);display:flex;
    align-items:center;justify-content:center;padding:16px}
  .pv-modal{background:#fff;max-width:560px;width:100%;max-height:90vh;overflow:auto;border-radius:16px;
    padding:24px;border-top:6px solid #f97316;font:14px/1.55 'DM Sans',system-ui,sans-serif;color:#1e293b}
  .pv-modal h2{margin:0 0 4px;font:400 22px 'DM Serif Display',Georgia,serif;color:#0f2a4a}
  .pv-modal .pv-sous{margin:0 0 16px;color:#64748b;font-size:13px}
  .pv-modal ul{list-style:none;padding:0;margin:0 0 16px}
  .pv-modal li{display:flex;gap:10px;padding:10px 0;border-bottom:1px solid #f1f5f9}
  .pv-modal li span{font-size:18px;line-height:1.3}
  .pv-modal label{display:flex;gap:10px;align-items:flex-start;background:#fff7ed;padding:12px;
    border-radius:10px;cursor:pointer;font-weight:500}
  .pv-modal input{margin-top:3px;width:18px;height:18px;accent-color:#f97316}
  .pv-ok{margin-top:14px;width:100%;padding:12px;border:0;border-radius:10px;background:#0f766e;
    color:#fff;font:600 14px 'DM Sans',system-ui,sans-serif;cursor:pointer}
  .pv-ok:disabled{background:#cbd5e1;cursor:not-allowed}
  .pv-print{display:none}
  @media print{
    .pv-bandeau button,.pv-voile{display:none!important}
    .pv-bandeau{border:2px solid #f97316;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .pv-print{display:block;position:fixed;bottom:0;left:0;right:0;text-align:center;
      font:600 9px 'DM Sans',sans-serif;color:#9a3412;border-top:1px solid #f97316;padding:4px;background:#fff}
    body::after{content:"PROTOTYPE — NON VALIDÉ";position:fixed;top:45%;left:50%;
      transform:translate(-50%,-50%) rotate(-30deg);font:700 64px 'DM Sans',sans-serif;
      color:rgba(249,115,22,.12);white-space:nowrap;pointer-events:none;z-index:9999}
  }`;

  function lu() { try { return localStorage.getItem(CLE) === '1'; } catch (e) { return false; } }
  function marquerLu() { try { localStorage.setItem(CLE, '1'); } catch (e) {} }

  function ouvrirModal(obligatoire) {
    const voile = document.createElement('div');
    voile.className = 'pv-voile';
    voile.setAttribute('role', 'dialog');
    voile.setAttribute('aria-modal', 'true');
    voile.innerHTML = `
      <div class="pv-modal">
        <h2>⚠️ ${AVERT.titre}</h2>
        <p class="pv-sous">À lire avant toute utilisation</p>
        <ul>${AVERT.points.map(([i, t]) => `<li><span>${i}</span><div>${t}</div></li>`).join('')}</ul>
        <label><input type="checkbox" id="pv-check"> J'ai compris que cet outil est un prototype pédagogique et que ses résultats doivent être vérifiés et validés.</label>
        <button class="pv-ok" id="pv-ok" disabled>Accéder à l'outil</button>
      </div>`;
    document.body.appendChild(voile);
    const check = voile.querySelector('#pv-check');
    const ok = voile.querySelector('#pv-ok');
    if (!obligatoire) { check.checked = true; ok.disabled = false; ok.textContent = 'Fermer'; }
    check.addEventListener('change', () => { ok.disabled = !check.checked; });
    ok.addEventListener('click', () => { marquerLu(); voile.remove(); });
    ok.focus();
  }

  function init() {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    const bandeau = document.createElement('div');
    bandeau.className = 'pv-bandeau';
    bandeau.innerHTML = `<span class="pv-badge">${AVERT.titre}</span><p>${AVERT.bandeau}</p><button type="button">En savoir plus</button>`;
    bandeau.querySelector('button').addEventListener('click', () => ouvrirModal(false));
    const nav = document.querySelector('.navbar');
    if (nav) nav.insertAdjacentElement('afterend', bandeau); else document.body.prepend(bandeau);

    const pied = document.createElement('div');
    pied.className = 'pv-print';
    pied.textContent = AVERT.mentionImpression;
    document.body.appendChild(pied);

    if (!lu()) ouvrirModal(true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
