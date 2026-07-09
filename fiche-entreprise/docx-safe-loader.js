/* =====================================================================
   PréventIA-LaB — Chargeur robuste de la bibliothèque docx
   ---------------------------------------------------------------------
   Corrige : « Uncaught SyntaxError: Unexpected token 'export' »
   Cause    : le fichier chargé est le build ESM (index.mjs / +esm) alors
              qu'il est inséré via <script src> classique.
   Solution : ne charger que le build **UMD** (docx@8.5.0/build/index.umd.js),
              qui définit `window.docx`. Le fichier `build/index.js` n'existe
              PAS dans docx 8.x — tout lien vers lui échoue silencieusement.

   API :
     await DocxLoader.load()      → true si window.docx est prêt
     DocxLoader.ready()           → booléen
     DocxLoader.exportFallback(html, filename)  → export .doc si docx KO
   ===================================================================== */
(function (global) {
  'use strict';

  /* Uniquement des builds UMD/IIFE — jamais index.mjs ni «+esm» */
  const CDNS = [
    'https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.js',
    'https://unpkg.com/docx@8.5.0/build/index.umd.js',
    'https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.iife.js'
  ];
  const TIMEOUT = 12000;
  let _promise = null;

  const ready = () => typeof global.docx !== 'undefined' && !!global.docx.Document;

  function loadScript(url) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = url;
      s.async = true;
      const to = setTimeout(() => { s.remove(); reject(new Error('timeout ' + url)); }, TIMEOUT);
      s.onload = () => {
        clearTimeout(to);
        /* Le script peut se charger sans exposer le global (mauvais build) */
        ready() ? resolve(url) : reject(new Error('global docx absent après ' + url));
      };
      s.onerror = () => { clearTimeout(to); s.remove(); reject(new Error('échec réseau ' + url)); };
      document.head.appendChild(s);
    });
  }

  async function load() {
    if (ready()) return true;
    if (_promise) return _promise;
    _promise = (async () => {
      for (const url of CDNS) {
        try { await loadScript(url); console.log('✅ docx chargé depuis', url); return true; }
        catch (e) { console.warn('↷ ' + e.message); }
      }
      console.error('❌ Aucun CDN docx accessible — bascule sur l’export .doc (HTML/Word).');
      return false;
    })();
    return _promise;
  }

  /* Repli universel : Word ouvre parfaitement un .doc HTML */
  function exportFallback(innerHTML, filename) {
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${filename}</title>
<style>@page{size:A4;margin:2cm}body{font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#222;line-height:1.4}
h1{font-size:16pt;color:#12303f}h2,h3{color:#0E7C86}
table{border-collapse:collapse;width:100%;font-size:9.5pt}th,td{border:1px solid #ccc;padding:4px 6px;text-align:left;vertical-align:top}
th{background:#e9eef3}</style></head><body>${innerHTML}</body></html>`;
    const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename.replace(/\.\w+$/, '') + '.doc';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  global.DocxLoader = { load, ready, exportFallback, CDNS };
})(window);

/* ---------------------------------------------------------------------
   PATCH à appliquer dans fiche-entreprise/index.html
   ---------------------------------------------------------------------
   ❌ AVANT (bloque sur un alert et ne revient jamais) :

     alert("Bibliothèque Word en cours de chargement…");
     await loadDocxLib();            // <script src=".../build/index.js"> → SyntaxError
     const doc = new docx.Document(…);

   ✅ APRÈS :

     async function telechargerWord(){
       const btn = document.getElementById('btnWord');
       const old = btn.textContent;
       btn.disabled = true; btn.textContent = '⏳ Préparation du document…';
       try{
         const ok = await DocxLoader.load();
         if (ok) {
           const doc = new docx.Document({ sections:[{ children: buildDocxChildren() }] });
           const blob = await docx.Packer.toBlob(doc);
           const a = document.createElement('a');
           a.href = URL.createObjectURL(blob);
           a.download = `FE_${nomEntreprise()}.docx`;
           a.click(); URL.revokeObjectURL(a.href);
         } else {
           DocxLoader.exportFallback(document.getElementById('restitBody').innerHTML,
                                     `FE_${nomEntreprise()}`);
         }
       } catch(e){
         console.error(e);
         DocxLoader.exportFallback(document.getElementById('restitBody').innerHTML,
                                   `FE_${nomEntreprise()}`);
       } finally {
         btn.disabled = false; btn.textContent = old;
       }
     }

   Points clés :
     · plus aucun alert() bloquant — l'état passe par le libellé du bouton ;
     · le try/catch garantit toujours un fichier téléchargé (docx ou .doc) ;
     · les URL pointent sur le build UMD, seul compatible avec <script src>.
   --------------------------------------------------------------------- */
