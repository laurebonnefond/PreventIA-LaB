/**
 * exporteur-word.js
 * ═══════════════════════════════════════════════════════════════
 * Moteur d'injection des résultats PICB dans le modèle SPSTI .docx
 *
 * Principe : charge le template modele-rapport-spsti.docx (avec {{placeholders}}),
 * remplace les variables par les données calculées, re-zippe → télécharge un vrai .docx
 * identique au modèle SPSTI (logo, mise en page, en-têtes, pieds de page conservés).
 *
 * Dépendance CDN : JSZip — https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js
 *
 * PréventIA-LaB · SPSTI 23/87
 * ═══════════════════════════════════════════════════════════════
 */

/* global JSZip */
(function (root) {
  "use strict";

  /* URL du template — relative au dossier PICB/ sur GitHub Pages */
  var TEMPLATE_URL = "modele-rapport-spsti.docx";

  /* ══════════ HELPERS ══════════ */
  function f1(x) {
    if (x == null || !isFinite(x)) return "—";
    return (Math.round(x * 10) / 10).toFixed(1);
  }
  function hz(f) { return f >= 1000 ? (f / 1000) + "k" : "" + f; }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

  /* ══════════ REMPLACEMENT DES PLACEHOLDERS ══════════ */
  function replacePlaceholders(xml, data) {
    var map = {
      "{{ENTREPRISE}}":              data.entreprise || "—",
      "{{ADRESSE}}":                 data.adresse || "",
      "{{CP_VILLE}}":                data.cp_ville || "",
      "{{DATES_MESURES}}":           data.date || "—",
      "{{INTERVENANT}}":             (data.intervenant || "Nom Prénom"),
      "{{INTERVENANT_VALIDATION}}":  (data.intervenant || "Nom Prénom"),
      "{{UNITE_1}}":                 data.poste || "Poste mesuré",
      "{{UNITE_2}}":                 "",
      "{{UNITE_3}}":                 "",
      "{{UNITE_4}}":                 "",
      "{{HORAIRES_TITRE}}":          "Date et horaires de l'intervention"
    };

    Object.keys(map).forEach(function (key) {
      // The placeholder might be split across XML tags, but merge_runs.py fixed that
      xml = xml.split(key).join(esc(map[key]));
    });

    return xml;
  }

  /* ══════════ GÉNÉRATION DU BLOC RÉSULTATS OB (XML Word natif) ══════════ */
  function buildResultsXML(data) {
    var res = data.res, diag = data.diag, adq = data.adq;
    var noPicb = data.noPicb;
    var FREQS = [63, 125, 250, 500, 1000, 2000, 4000, 8000];

    /* Helper : cellule Word XML */
    function tc(text, opts) {
      opts = opts || {};
      var bg = opts.bg ? '<w:shd w:val="clear" w:color="auto" w:fill="' + opts.bg + '"/>' : '';
      var bold = opts.bold ? '<w:b/>' : '';
      var color = opts.color ? '<w:color w:val="' + opts.color + '"/>' : '';
      var sz = opts.size ? '<w:sz w:val="' + opts.size + '"/><w:szCs w:val="' + opts.size + '"/>' : '<w:sz w:val="18"/><w:szCs w:val="18"/>';
      var align = opts.align ? '<w:jc w:val="' + opts.align + '"/>' : '';
      var font = opts.mono ? '<w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/>' : '';
      var width = opts.width ? '<w:tcW w:w="' + opts.width + '" w:type="dxa"/>' : '';
      return '<w:tc><w:tcPr>' + width + bg + '</w:tcPr>'
        + '<w:p><w:pPr>' + align + '</w:pPr>'
        + '<w:r><w:rPr>' + font + bold + color + sz + '</w:rPr>'
        + '<w:t xml:space="preserve">' + esc(String(text)) + '</w:t></w:r></w:p></w:tc>';
    }
    function tr(cells) { return '<w:tr>' + cells.join('') + '</w:tr>'; }

    var xml = '';

    /* ── Titre section résultats PICB ── */
    xml += '<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr>'
      + '<w:r><w:rPr><w:b/></w:rPr>'
      + '<w:t>RÉSULTATS DE L\'ÉVALUATION PICB — Calcul OB INRS</w:t></w:r></w:p>';

    /* ── Tableau contexte PICB ── */
    var ctxPairs = [
      ["Protecteur évalué (PICB)", noPicb ? "Aucun" : ((data.picb ? data.picb.nom : "—") + (data.picb && data.picb.snr ? " · SNR " + data.picb.snr + " dB" : ""))],
      ["Type de protecteur", noPicb ? "Pas de PICB porté" : (data.picb ? data.picb.typeLabel : "—")],
      ["Lex,8h mesuré", data.lex ? data.lex + " dB(A)" : "—"],
      ["Formation au port", data.formation ? "Oui — APV98 standard" : "Non — décote " + (res.decote || 0) + " dB"]
    ];
    xml += '<w:tbl><w:tblPr><w:tblW w:w="9072" w:type="dxa"/><w:tblBorders>'
      + '<w:top w:val="single" w:sz="4" w:color="C0C0C0"/>'
      + '<w:left w:val="single" w:sz="4" w:color="C0C0C0"/>'
      + '<w:bottom w:val="single" w:sz="4" w:color="C0C0C0"/>'
      + '<w:right w:val="single" w:sz="4" w:color="C0C0C0"/>'
      + '<w:insideH w:val="single" w:sz="4" w:color="C0C0C0"/>'
      + '<w:insideV w:val="single" w:sz="4" w:color="C0C0C0"/>'
      + '</w:tblBorders></w:tblPr>';
    ctxPairs.forEach(function (p) {
      xml += tr([
        tc(p[0], { bold: true, bg: "E8E4D8", width: "3600" }),
        tc(p[1], { width: "5472" })
      ]);
    });
    xml += '</w:tbl>';
    xml += '<w:p/>';

    /* ── Tableau spectre mesuré ── */
    xml += '<w:p><w:pPr><w:pStyle w:val="Heading3"/></w:pPr>'
      + '<w:r><w:t>Spectre sonométrique mesuré</w:t></w:r></w:p>';

    var colW = "900";
    xml += '<w:tbl><w:tblPr><w:tblW w:w="9072" w:type="dxa"/><w:tblBorders>'
      + '<w:top w:val="single" w:sz="4" w:color="1C4C7C"/>'
      + '<w:left w:val="single" w:sz="4" w:color="1C4C7C"/>'
      + '<w:bottom w:val="single" w:sz="4" w:color="1C4C7C"/>'
      + '<w:right w:val="single" w:sz="4" w:color="1C4C7C"/>'
      + '<w:insideH w:val="single" w:sz="4" w:color="C0C0C0"/>'
      + '<w:insideV w:val="single" w:sz="4" w:color="C0C0C0"/>'
      + '</w:tblBorders></w:tblPr>';
    // Header
    var hdr = [tc("Hz", { bold: true, bg: "102A43", color: "FFFFFF", width: "1872", align: "center" })];
    FREQS.forEach(function (f) {
      hdr.push(tc(hz(f), { bold: true, bg: "102A43", color: "FFFFFF", width: colW, align: "center", mono: true }));
    });
    xml += tr(hdr);
    // Spectrum values
    var specCells = [tc("Lf (dB)", { bold: true, bg: "1C4C7C", color: "FFFFFF", width: "1872" })];
    FREQS.forEach(function (f, i) {
      specCells.push(tc(data.spec[i] != null ? f1(data.spec[i]) : "—", { width: colW, align: "center", mono: true }));
    });
    xml += tr(specCells);

    if (!noPicb) {
      /* APV rows */
      function obRow(label, fn, tint) {
        var cells = [tc(label, { bold: true, bg: "1C4C7C", color: "FFFFFF", width: "1872" })];
        for (var i = 0; i < 8; i++) {
          cells.push(tc(res.idx.indexOf(i) >= 0 ? f1(fn(i)) : "—", {
            width: colW, align: "center", mono: true, bg: tint ? "FBE6D6" : undefined
          }));
        }
        return tr(cells);
      }
      var spec = data.spec;
      var apvLbl = res.decote > 0 ? "APV98+ (−" + res.decote + ")" : "APV98+";
      xml += obRow("APV₈₄", function (i) { return res.apv84[i]; }, false);
      xml += obRow(apvLbl, function (i) { return res.apv98[i]; }, true);
      xml += obRow("L'₈₄ oreille", function (i) { return spec[i] - res.apv84[i]; }, false);
      xml += obRow("L'₉₈ oreille", function (i) { return Math.min(spec[i], spec[i] - res.apv98[i]); }, true);
    }
    xml += '</w:tbl>';
    xml += '<w:p/>';

    /* ── Carte résultats ── */
    xml += '<w:p><w:pPr><w:pStyle w:val="Heading3"/></w:pPr>'
      + '<w:r><w:t>Résultats</w:t></w:r></w:p>';

    var refVal = noPicb ? res.leqA : res.ref;
    xml += '<w:tbl><w:tblPr><w:tblW w:w="9072" w:type="dxa"/><w:tblBorders>'
      + '<w:top w:val="single" w:sz="4" w:color="C0C0C0"/>'
      + '<w:bottom w:val="single" w:sz="4" w:color="C0C0C0"/>'
      + '</w:tblBorders></w:tblPr>';
    if (noPicb) {
      xml += tr([tc("Leq(A) ambiant : " + f1(res.leqA) + " dB(A) — " + diag.tag + " — " + diag.label,
        { bold: true, bg: diag.hex.replace("#", ""), color: "FFFFFF", width: "9072", size: "24" })]);
    } else {
      xml += tr([
        tc("Leq(A) sans PICB : " + f1(res.leqA) + " dB(A)", { width: "3024", align: "center" }),
        tc("L'A 84% : " + f1(res.la84) + " dB(A)", { width: "3024", align: "center", color: "1C4C7C", bold: true }),
        tc("L'A 98% RETENU : " + f1(res.la98) + " dB(A)", { width: "3024", align: "center", bg: "FBE6D6", color: "C2410C", bold: true })
      ]);
      xml += tr([tc(diag.tag + " — " + diag.label + " · L'A retenu = " + f1(res.ref) + " dB(A)",
        { bold: true, bg: diag.hex.replace("#", ""), color: "FFFFFF", width: "9072", size: "22" })]);
    }
    xml += '</w:tbl>';

    /* Indicateurs */
    xml += '<w:p><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">Leq(C) = ' + f1(res.leqC)
      + ' dB(C)  ·  Lc − La = ' + f1(res.lcla) + ' dB'
      + (res.lcla > 5 ? ' — bruit à dominante basse fréquence' : ' — spectre équilibré')
      + '</w:t></w:r></w:p>';

    xml += '<w:p><w:r><w:t>' + esc(diag.txt) + '</w:t></w:r></w:p>';
    xml += '<w:p/>';

    /* ── Adéquation ── */
    xml += '<w:p><w:pPr><w:pStyle w:val="Heading3"/></w:pPr>'
      + '<w:r><w:t>Adéquation au poste de travail</w:t></w:r></w:p>';

    xml += '<w:tbl><w:tblPr><w:tblW w:w="9072" w:type="dxa"/></w:tblPr>';
    xml += tr([tc(adq.titre, { bold: true, bg: adq.hex.replace("#", ""), color: "FFFFFF", width: "9072", size: "22" })]);
    xml += '</w:tbl>';
    xml += '<w:p><w:r><w:t>' + esc(adq.message) + '</w:t></w:r></w:p>';

    xml += '<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Préconisations :</w:t></w:r></w:p>';
    if (adq.actions) {
      adq.actions.forEach(function (a) {
        xml += '<w:p><w:pPr><w:ind w:left="360" w:hanging="360"/></w:pPr>'
          + '<w:r><w:t xml:space="preserve">•  ' + esc(a) + '</w:t></w:r></w:p>';
      });
    }

    return xml;
  }

  /* ══════════ INJECTION DANS LE TEMPLATE ══════════ */
  function exportRapportWord(data) {
    /* 1. Charger le template */
    fetch(TEMPLATE_URL)
      .then(function (r) {
        if (!r.ok) throw new Error("Template introuvable (" + r.status + ") — vérifiez que modele-rapport-spsti.docx est dans le même dossier.");
        return r.arrayBuffer();
      })
      .then(function (buf) { return JSZip.loadAsync(buf); })
      .then(function (zip) {
        return zip.file("word/document.xml").async("string").then(function (xml) {

          /* 2. Remplacer les placeholders textuels */
          xml = replacePlaceholders(xml, data);

          /* 3. Injecter le bloc résultats OB avant la section Indicateurs qualité
                On cherche le marqueur "indicateurs de qualite" dans le XML */
          var resultsXML = buildResultsXML(data);

          /* Point d'injection : juste avant la section 8 (Indicateurs qualité)
             On cherche "INDICATEURS DE QUALITE" dans le texte XML */
          var marker = "INDICATEURS DE QUALITE";
          var markerIdx = xml.indexOf(marker);
          if (markerIdx > 0) {
            /* Remonter au <w:p> parent le plus proche */
            var pStart = xml.lastIndexOf("<w:p>", markerIdx);
            if (pStart < 0) pStart = xml.lastIndexOf("<w:p ", markerIdx);
            if (pStart > 0) {
              xml = xml.substring(0, pStart)
                + resultsXML
                + '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'
                + xml.substring(pStart);
            }
          } else {
            /* Fallback : injecter avant </w:body> */
            xml = xml.replace("</w:body>", resultsXML + '</w:body>');
          }

          /* 4. Remettre le XML modifié dans le zip */
          zip.file("word/document.xml", xml);
          return zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
        });
      })
      .then(function (blob) {
        /* 5. Télécharger */
        var safe = function (s) { return (s || "poste").replace(/[^a-z0-9àâéèêëïîôùûüç]+/gi, "-").slice(0, 30); };
        var fn = "Estimation-Niveaux-Sonores_" + safe(data.entreprise) + "_" + safe(data.poste) + ".docx";
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url; a.download = fn;
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
      })
      .catch(function (err) {
        console.error("[PréventIA] Erreur export SPSTI:", err);
        alert("Erreur export : " + err.message + "\nFallback sur l'ancien export…");
        if (typeof exportWordLegacy === "function") exportWordLegacy();
      });
  }

  root.exportRapportWord = exportRapportWord;
})(typeof window !== "undefined" ? window : this);
