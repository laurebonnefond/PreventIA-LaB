/**
 * exporteur-word.js — v26
 * ═══════════════════════════════════════════════════════════════
 * Injection des résultats PICB v26 dans le modèle SPSTI .docx
 *
 * Gère : mono / multi-sonométries, tâches enrichies (zone, source,
 * Lp,C, caractère), double voie spectre + crête, recommandations
 * contextualisées.
 *
 * Dépendance CDN : JSZip 3.10+
 * PréventIA-LaB · SPSTI 23/87
 * ═══════════════════════════════════════════════════════════════
 */

/* global JSZip */
(function (root) {
  "use strict";

  var TEMPLATE_URL = "modele-rapport-spsti.docx";
  var FREQS = [63, 125, 250, 500, 1000, 2000, 4000, 8000];

  /* ── Helpers ── */
  function f1(x) {
    if (x == null || !isFinite(x)) return "—";
    return (Math.round(x * 10) / 10).toFixed(1);
  }
  function hz(f) { return f >= 1000 ? (f / 1000) + "k" : "" + f; }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /* ── Word XML builders ── */
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
  function heading(level, text) {
    return '<w:p><w:pPr><w:pStyle w:val="Heading' + level + '"/></w:pPr>'
      + '<w:r><w:rPr><w:b/></w:rPr>'
      + '<w:t>' + esc(text) + '</w:t></w:r></w:p>';
  }
  function para(text, opts) {
    opts = opts || {};
    var bold = opts.bold ? '<w:b/>' : '';
    var color = opts.color ? '<w:color w:val="' + opts.color + '"/>' : '';
    var sz = opts.size ? '<w:sz w:val="' + opts.size + '"/>' : '';
    var indent = opts.indent ? '<w:ind w:left="' + opts.indent + '"/>' : '';
    return '<w:p><w:pPr>' + indent + '</w:pPr>'
      + '<w:r><w:rPr>' + bold + color + sz + '</w:rPr>'
      + '<w:t xml:space="preserve">' + esc(text) + '</w:t></w:r></w:p>';
  }
  function bullet(text) {
    return '<w:p><w:pPr><w:ind w:left="360" w:hanging="360"/></w:pPr>'
      + '<w:r><w:t xml:space="preserve">•  ' + esc(text) + '</w:t></w:r></w:p>';
  }
  function tblStart(widthDxa) {
    return '<w:tbl><w:tblPr><w:tblW w:w="' + (widthDxa || 9072) + '" w:type="dxa"/><w:tblBorders>'
      + '<w:top w:val="single" w:sz="4" w:color="C0C0C0"/>'
      + '<w:left w:val="single" w:sz="4" w:color="C0C0C0"/>'
      + '<w:bottom w:val="single" w:sz="4" w:color="C0C0C0"/>'
      + '<w:right w:val="single" w:sz="4" w:color="C0C0C0"/>'
      + '<w:insideH w:val="single" w:sz="4" w:color="C0C0C0"/>'
      + '<w:insideV w:val="single" w:sz="4" w:color="C0C0C0"/>'
      + '</w:tblBorders></w:tblPr>';
  }

  /* ══════════ REMPLACEMENT DES PLACEHOLDERS ══════════ */
  function replacePlaceholders(xml, data) {
    var map = {
      "{{ENTREPRISE}}":              data.entreprise || "—",
      "{{ADRESSE}}":                 data.adresse || "",
      "{{CP_VILLE}}":                data.cp_ville || "",
      "{{DATES_MESURES}}":           data.date || "—",
      "{{INTERVENANT}}":             data.intervenant || "Nom Prénom",
      "{{INTERVENANT_VALIDATION}}":  data.intervenant || "Nom Prénom",
      "{{UNITE_1}}":                 data.poste || "Poste mesuré",
      "{{UNITE_2}}":                 "",
      "{{UNITE_3}}":                 "",
      "{{UNITE_4}}":                 "",
      "{{HORAIRES_TITRE}}":          "Date et horaires de l'intervention"
    };
    Object.keys(map).forEach(function (key) {
      xml = xml.split(key).join(esc(map[key]));
    });
    return xml;
  }

  /* ══════════ BLOC MULTI-TÂCHES (v26) ══════════ */
  function buildTachesXML(data) {
    if (!data.taches || data.taches.length === 0) return '';

    var xml = heading(2, 'TÂCHES / SITUATIONS D\'EXPOSITION — Multi-sonométries');
    xml += para('Spectre par bande d\'octave pour chaque tâche. La ligne « Enveloppe MAX » retient le niveau le plus contraignant par bande (spectre dimensionnant).', { size: '18' });
    xml += '<w:p/>';

    /* Tableau avec colonnes : Tâche | Zone | Source | 8 bandes | Durée | Leq(A) | Lp,C | Caract. */
    var cW = '660';  // bandes étroites
    xml += tblStart(9072);

    /* Header */
    var hdr = [
      tc("Tâche", { bold: true, bg: "102A43", color: "FFFFFF", width: "1400", align: "center" }),
      tc("Zone", { bold: true, bg: "102A43", color: "FFFFFF", width: "900", align: "center" }),
      tc("Source", { bold: true, bg: "102A43", color: "FFFFFF", width: "900", align: "center" })
    ];
    FREQS.forEach(function (f) {
      hdr.push(tc(hz(f), { bold: true, bg: "102A43", color: "FFFFFF", width: cW, align: "center", mono: true }));
    });
    hdr.push(tc("Durée", { bold: true, bg: "102A43", color: "FFFFFF", width: "500", align: "center" }));
    hdr.push(tc("Leq(A)", { bold: true, bg: "102A43", color: "FFFFFF", width: "600", align: "center" }));
    hdr.push(tc("Lp,C", { bold: true, bg: "102A43", color: "FFFFFF", width: "500", align: "center" }));
    hdr.push(tc("Car.", { bold: true, bg: "102A43", color: "FFFFFF", width: "500", align: "center" }));
    xml += tr(hdr);

    /* Data rows */
    data.taches.forEach(function (t) {
      var cells = [
        tc(t.nom || "—", { bold: true, bg: "1C4C7C", color: "FFFFFF", width: "1400" }),
        tc(t.zone || "", { width: "900" }),
        tc(t.source || "", { width: "900" })
      ];
      for (var i = 0; i < 8; i++) {
        cells.push(tc(t.spectre[i] != null ? f1(t.spectre[i]) : "—", { width: cW, align: "center", mono: true }));
      }
      cells.push(tc(t.duree + "h", { width: "500", align: "center" }));
      cells.push(tc(f1(t.leqA), { width: "600", align: "center", bold: true, mono: true }));
      cells.push(tc(t.lpc != null ? f1(t.lpc) : "—", { width: "500", align: "center", mono: true }));
      var carLabel = { continu: "C", intermittent: "I", impulsionnel: "IMP" }[t.caract] || t.caract || "";
      cells.push(tc(carLabel, { width: "500", align: "center" }));
      xml += tr(cells);
    });

    /* Enveloppe MAX row */
    var envCells = [
      tc("ENVELOPPE MAX", { bold: true, bg: "1A7A6D", color: "FFFFFF", width: "1400" }),
      tc("", { bg: "E6F5F2", width: "900" }),
      tc("", { bg: "E6F5F2", width: "900" })
    ];
    for (var i = 0; i < 8; i++) {
      envCells.push(tc(data.spec[i] != null ? f1(data.spec[i]) : "—", {
        width: cW, align: "center", mono: true, bold: true, bg: "E6F5F2", color: "1A7A6D"
      }));
    }
    envCells.push(tc("—", { bg: "E6F5F2", width: "500", align: "center" }));
    envCells.push(tc("—", { bg: "E6F5F2", width: "600", align: "center" }));
    var maxLpc = null;
    data.taches.forEach(function (t) { if (t.lpc != null && (maxLpc === null || t.lpc > maxLpc)) maxLpc = t.lpc; });
    envCells.push(tc(maxLpc != null ? f1(maxLpc) : "—", {
      bg: "E6F5F2", width: "500", align: "center", bold: true, mono: true,
      color: maxLpc != null && maxLpc >= 135 ? "C2392B" : "1A7A6D"
    }));
    envCells.push(tc("", { bg: "E6F5F2", width: "500" }));
    xml += tr(envCells);

    xml += '</w:tbl>';
    xml += '<w:p/>';
    return xml;
  }

  /* ══════════ BLOC RÉSULTATS OB ══════════ */
  function buildResultsXML(data) {
    var res = data.res, diag = data.diag, adq = data.adq;
    var noPicb = data.noPicb;
    var spec = data.spec;
    var isMulti = data.mode === "multi";
    var xml = '';

    /* Titre */
    var titleSuffix = isMulti ? " (spectre dimensionnant — " + (data.taches ? data.taches.length : 1) + " tâches)" : "";
    xml += heading(2, 'RÉSULTATS PICB — Calcul OB INRS' + titleSuffix);

    /* Contexte PICB */
    var ctxPairs = [
      ["Protecteur évalué", noPicb ? "Aucun PICB porté" : ((data.picb ? data.picb.nom : "—") + (data.picb && data.picb.snr ? " · SNR " + data.picb.snr + " dB" : ""))],
      ["Type", noPicb ? "—" : (data.picb ? data.picb.typeLabel || "" : "—")],
      ["Mode d'évaluation", isMulti ? "Multi-sonométries (enveloppe MAX)" : "Évaluation simple"],
      ["Formation au port", noPicb ? "—" : (data.formation ? "Oui — APV98 standard" : "Non — décote " + (res.decote || 0) + " dB")]
    ];
    xml += tblStart(9072);
    ctxPairs.forEach(function (p) {
      xml += tr([
        tc(p[0], { bold: true, bg: "E8E4D8", width: "3600" }),
        tc(p[1], { width: "5472" })
      ]);
    });
    xml += '</w:tbl><w:p/>';

    /* Tableau spectre dimensionnant */
    xml += heading(3, isMulti ? 'Spectre dimensionnant (enveloppe MAX)' : 'Spectre sonométrique mesuré');
    var colW = "900";
    xml += tblStart(9072);
    var hdr = [tc("Hz", { bold: true, bg: "102A43", color: "FFFFFF", width: "1872", align: "center" })];
    FREQS.forEach(function (f) {
      hdr.push(tc(hz(f), { bold: true, bg: "102A43", color: "FFFFFF", width: colW, align: "center", mono: true }));
    });
    xml += tr(hdr);

    var specCells = [tc("Lf (dB)", { bold: true, bg: "1C4C7C", color: "FFFFFF", width: "1872" })];
    FREQS.forEach(function (f, i) {
      specCells.push(tc(spec[i] != null ? f1(spec[i]) : "—", { width: colW, align: "center", mono: true }));
    });
    xml += tr(specCells);

    if (!noPicb) {
      function obRow(label, fn, tint) {
        var cells = [tc(label, { bold: true, bg: "1C4C7C", color: "FFFFFF", width: "1872" })];
        for (var i = 0; i < 8; i++) {
          cells.push(tc(res.idx.indexOf(i) >= 0 ? f1(fn(i)) : "—", {
            width: colW, align: "center", mono: true, bg: tint ? "FBE6D6" : undefined
          }));
        }
        return tr(cells);
      }
      var apvLbl = res.decote > 0 ? "APV98+ (−" + res.decote + ")" : "APV98+";
      xml += obRow("APV₈₄", function (i) { return res.apv84[i]; }, false);
      xml += obRow(apvLbl, function (i) { return res.apv98[i]; }, true);
      xml += obRow("L'₈₄ oreille", function (i) { return spec[i] - res.apv84[i]; }, false);
      xml += obRow("L'₉₈ oreille", function (i) { return Math.min(spec[i], spec[i] - res.apv98[i]); }, true);
    }
    xml += '</w:tbl><w:p/>';

    /* Carte résultats */
    xml += heading(3, 'Résultats');
    xml += tblStart(9072);
    if (noPicb) {
      xml += tr([tc("Leq(A) : " + f1(res.leqA) + " dB(A) — " + diag.tag + " — " + diag.label,
        { bold: true, bg: diag.hex.replace("#", ""), color: "FFFFFF", width: "9072", size: "24" })]);
    } else {
      xml += tr([
        tc("Leq(A) : " + f1(res.leqA) + " dB(A)", { width: "3024", align: "center" }),
        tc("L'A 84% : " + f1(res.la84) + " dB(A)", { width: "3024", align: "center", color: "1C4C7C", bold: true }),
        tc("L'A 98% RETENU : " + f1(res.la98) + " dB(A)", { width: "3024", align: "center", bg: "FBE6D6", color: "C2410C", bold: true })
      ]);
      xml += tr([tc(diag.tag + " — " + diag.label + " · L'A retenu = " + f1(res.ref) + " dB(A)",
        { bold: true, bg: diag.hex.replace("#", ""), color: "FFFFFF", width: "9072", size: "22" })]);
    }
    xml += '</w:tbl>';

    xml += para("Leq(C) = " + f1(res.leqC) + " dB(C)  ·  Lc − La = " + f1(res.lcla) + " dB"
      + (res.lcla > 5 ? " — bruit à dominante basse fréquence" : " — spectre équilibré"), { bold: true });
    xml += para(diag.txt);
    xml += '<w:p/>';

    /* Adéquation */
    xml += heading(3, 'Adéquation au poste de travail');
    xml += tblStart(9072);
    xml += tr([tc(adq.titre, { bold: true, bg: adq.hex.replace("#", ""), color: "FFFFFF", width: "9072", size: "22" })]);
    xml += '</w:tbl>';
    xml += para(adq.message);
    xml += para("Préconisations :", { bold: true });
    if (adq.actions) {
      adq.actions.forEach(function (a) { xml += bullet(a); });
    }
    xml += '<w:p/>';

    return xml;
  }

  /* ══════════ BLOC CONTRÔLE CRÊTES Lp,C (VOIE 2) ══════════ */
  function buildCreteXML(data) {
    if (!data.crDiag) return '';

    var xml = heading(2, 'VOIE 2 — CONTRÔLE CRÊTE Lp,C');

    var crD = data.crDiag;
    var lpc = data.lpc;
    var bgColor = { c135: "F5DFA0", c137: "E8A090", c140: "C2392B" }[crD.cls] || "CCCCCC";
    var txtColor = crD.cls === "c140" ? "FFFFFF" : "000000";

    xml += tblStart(9072);
    xml += tr([tc(crD.tag + " — Lp,C maximal : " + f1(lpc) + " dB(C)",
      { bold: true, bg: bgColor, color: txtColor, width: "9072", size: "22" })]);
    xml += '</w:tbl>';

    xml += para(crD.msg);
    xml += '<w:p/>';

    xml += para("Actions de prévention — crêtes :", { bold: true });
    if (crD.actions) {
      crD.actions.forEach(function (a) { xml += bullet(a); });
    }
    xml += '<w:p/>';

    return xml;
  }

  /* ══════════ BLOC RECOMMANDATIONS CONTEXTUALISÉES ══════════ */
  function buildRecoXML(data) {
    if (!data.recos || data.recos.length === 0) return '';

    var xml = heading(2, 'PISTES DE PRÉVENTION CONTEXTUALISÉES');
    xml += para("Propositions issues du croisement source × environnement × tâche × spectre × durée × caractère impulsionnel. Ces pistes constituent une aide à la décision à valider par le préventeur signataire.", { bold: true, size: "18" });
    xml += '<w:p/>';

    data.recos.forEach(function (r) {
      xml += para("[" + r.cat.toUpperCase() + "] " + r.title, { bold: true, color: r.color ? r.color.replace("#", "").replace("var(--", "").replace(")", "") : "102A43" });
      xml += para(r.body, { indent: "360" });
      xml += '<w:p/>';
    });

    return xml;
  }

  /* ══════════ ASSEMBLAGE ET INJECTION ══════════ */
  function exportRapportWord(data) {
    fetch(TEMPLATE_URL)
      .then(function (r) {
        if (!r.ok) throw new Error("Template introuvable (" + r.status + ") — vérifiez que modele-rapport-spsti.docx est dans le même dossier.");
        return r.arrayBuffer();
      })
      .then(function (buf) { return JSZip.loadAsync(buf); })
      .then(function (zip) {
        return zip.file("word/document.xml").async("string").then(function (xml) {

          /* 1. Remplacer les placeholders textuels */
          xml = replacePlaceholders(xml, data);

          /* 2. Construire le bloc complet v26 */
          var resultsXML = '';

          // Multi-tâches (si mode multi)
          if (data.mode === "multi" && data.taches && data.taches.length > 0) {
            resultsXML += buildTachesXML(data);
          }

          // Résultats OB
          resultsXML += buildResultsXML(data);

          // Voie 2 — Crêtes
          if (data.crDiag) {
            resultsXML += buildCreteXML(data);
          }

          // Recommandations contextualisées
          if (data.recos && data.recos.length > 0) {
            resultsXML += buildRecoXML(data);
          }

          /* 3. Injecter avant la section INDICATEURS DE QUALITE */
          var marker = "INDICATEURS DE QUALITE";
          var markerIdx = xml.indexOf(marker);
          if (markerIdx > 0) {
            var pStart = xml.lastIndexOf("<w:p>", markerIdx);
            if (pStart < 0) pStart = xml.lastIndexOf("<w:p ", markerIdx);
            if (pStart > 0) {
              xml = xml.substring(0, pStart)
                + resultsXML
                + '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'
                + xml.substring(pStart);
            }
          } else {
            xml = xml.replace("</w:body>", resultsXML + '</w:body>');
          }

          /* 4. Remettre le XML modifié */
          zip.file("word/document.xml", xml);
          return zip.generateAsync({
            type: "blob",
            mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          });
        });
      })
      .then(function (blob) {
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
        alert("Erreur export : " + err.message + "\nFallback sur l'export HTML…");
        if (typeof exportWordLegacy === "function") exportWordLegacy();
      });
  }

  root.exportRapportWord = exportRapportWord;
})(typeof window !== "undefined" ? window : this);
