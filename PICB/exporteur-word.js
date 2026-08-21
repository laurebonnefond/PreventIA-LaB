/**
 * exporteur-word.js — v26.1
 * ═══════════════════════════════════════════════════════════════
 * Injection des résultats PICB v26 dans le modèle SPSTI .docx
 *
 * Gère : placeholders enrichis (adresse, CP, horaires, UNITE_1-4),
 * mono / multi-sonométries, tâches enrichies (zone, source, Lp,C,
 * caractère), double voie spectre + crête, recommandations
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
    if (x == null || !isFinite(x)) return "\u2014";
    return (Math.round(x * 10) / 10).toFixed(1);
  }
  function hz(f) { return f >= 1000 ? (f / 1000) + "k" : "" + f; }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function cleanColor(c) {
    if (!c) return "102A43";
    var hex = String(c).replace("#", "");
    if (/^[0-9A-Fa-f]{6}$/.test(hex)) return hex;
    var map = {"var(--teal)":"1A7A6D","var(--amber)":"CD8A1C","var(--red)":"C2392B",
      "var(--gold)":"B78A2E","var(--navy)":"1C4C7C","var(--ink)":"102A43","var(--mute)":"5D6B7A"};
    return map[c] || "102A43";
  }

  /* ── Word XML builders ── */
  function tc(text, o) {
    o = o || {};
    var bg = o.bg ? '<w:shd w:val="clear" w:color="auto" w:fill="' + o.bg + '"/>' : '';
    var b = o.bold ? '<w:b/>' : '';
    var col = o.color ? '<w:color w:val="' + o.color + '"/>' : '';
    var sz = o.size ? '<w:sz w:val="' + o.size + '"/><w:szCs w:val="' + o.size + '"/>' : '<w:sz w:val="18"/><w:szCs w:val="18"/>';
    var al = o.align ? '<w:jc w:val="' + o.align + '"/>' : '';
    var fn = o.mono ? '<w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/>' : '';
    var w = o.width ? '<w:tcW w:w="' + o.width + '" w:type="dxa"/>' : '';
    return '<w:tc><w:tcPr>' + w + bg + '</w:tcPr><w:p><w:pPr>' + al + '</w:pPr><w:r><w:rPr>' + fn + b + col + sz + '</w:rPr><w:t xml:space="preserve">' + esc(String(text)) + '</w:t></w:r></w:p></w:tc>';
  }
  function tr(cells) { return '<w:tr>' + cells.join('') + '</w:tr>'; }
  function heading(lv, text) {
    return '<w:p><w:pPr><w:pStyle w:val="Heading' + lv + '"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>' + esc(text) + '</w:t></w:r></w:p>';
  }
  function para(text, o) {
    o = o || {};
    var b = o.bold ? '<w:b/>' : '';
    var col = o.color ? '<w:color w:val="' + o.color + '"/>' : '';
    var sz = o.size ? '<w:sz w:val="' + o.size + '"/>' : '';
    var ind = o.indent ? '<w:ind w:left="' + o.indent + '"/>' : '';
    return '<w:p><w:pPr>' + ind + '</w:pPr><w:r><w:rPr>' + b + col + sz + '</w:rPr><w:t xml:space="preserve">' + esc(text) + '</w:t></w:r></w:p>';
  }
  function bullet(text) {
    return '<w:p><w:pPr><w:ind w:left="360" w:hanging="360"/></w:pPr><w:r><w:t xml:space="preserve">\u2022  ' + esc(text) + '</w:t></w:r></w:p>';
  }
  function tblStart(w) {
    return '<w:tbl><w:tblPr><w:tblW w:w="' + (w || 9072) + '" w:type="dxa"/><w:tblBorders>'
      + '<w:top w:val="single" w:sz="4" w:color="C0C0C0"/><w:left w:val="single" w:sz="4" w:color="C0C0C0"/>'
      + '<w:bottom w:val="single" w:sz="4" w:color="C0C0C0"/><w:right w:val="single" w:sz="4" w:color="C0C0C0"/>'
      + '<w:insideH w:val="single" w:sz="4" w:color="C0C0C0"/><w:insideV w:val="single" w:sz="4" w:color="C0C0C0"/>'
      + '</w:tblBorders></w:tblPr>';
  }

  /* ══════════ PLACEHOLDERS ══════════ */
  function replacePlaceholders(xml, data) {
    var uniteNames = ["", "", "", ""];
    if (data.taches && data.taches.length > 0) {
      for (var i = 0; i < Math.min(4, data.taches.length); i++) {
        var t = data.taches[i];
        uniteNames[i] = (t.zone ? t.zone + " \u2014 " : "") + (t.nom || "T\u00e2che " + (i + 1));
      }
    } else {
      uniteNames[0] = data.poste || "Poste mesur\u00e9";
    }
    var map = {
      "{{ENTREPRISE}}":             data.entreprise || "\u2014",
      "{{ADRESSE}}":                data.adresse || "",
      "{{CP_VILLE}}":               data.cp_ville || "",
      "{{DATES_MESURES}}":          data.date || "\u2014",
      "{{INTERVENANT}}":            data.intervenant || "Nom Pr\u00e9nom",
      "{{INTERVENANT_VALIDATION}}": data.intervenant || "Nom Pr\u00e9nom",
      "{{UNITE_1}}":                uniteNames[0],
      "{{UNITE_2}}":                uniteNames[1],
      "{{UNITE_3}}":                uniteNames[2],
      "{{UNITE_4}}":                uniteNames[3],
      "{{HORAIRES_TITRE}}":         data.horaires || "\u2014"
    };
    Object.keys(map).forEach(function (key) {
      xml = xml.split(key).join(esc(map[key]));
    });
    return xml;
  }

  /* ══════════ TÂCHES MULTI ══════════ */
  function buildTachesXML(data) {
    if (!data.taches || data.taches.length === 0) return '';
    var xml = heading(2, 'T\u00c2CHES / SITUATIONS D\'EXPOSITION');
    xml += para('Spectre par bande d\'octave pour chaque t\u00e2che. La ligne \u00ab Enveloppe MAX \u00bb retient le niveau le plus contraignant par bande (spectre dimensionnant).', { size: '18' });
    xml += '<w:p/>';
    var cW = '660';
    xml += tblStart(9072);
    var hdr = [tc("T\u00e2che", { bold: true, bg: "102A43", color: "FFFFFF", width: "1200", align: "center" }),
      tc("Zone", { bold: true, bg: "102A43", color: "FFFFFF", width: "800", align: "center" }),
      tc("Source", { bold: true, bg: "102A43", color: "FFFFFF", width: "800", align: "center" })];
    FREQS.forEach(function (f) { hdr.push(tc(hz(f), { bold: true, bg: "102A43", color: "FFFFFF", width: cW, align: "center", mono: true })); });
    hdr.push(tc("h", { bold: true, bg: "102A43", color: "FFFFFF", width: "400", align: "center" }));
    hdr.push(tc("Leq(A)", { bold: true, bg: "102A43", color: "FFFFFF", width: "550", align: "center" }));
    hdr.push(tc("Lp,C", { bold: true, bg: "102A43", color: "FFFFFF", width: "500", align: "center" }));
    hdr.push(tc("Car.", { bold: true, bg: "102A43", color: "FFFFFF", width: "420", align: "center" }));
    xml += tr(hdr);
    data.taches.forEach(function (t) {
      var cells = [tc(t.nom || "\u2014", { bold: true, bg: "1C4C7C", color: "FFFFFF", width: "1200" }),
        tc(t.zone || "", { width: "800" }), tc(t.source || "", { width: "800" })];
      for (var i = 0; i < 8; i++) cells.push(tc(t.spectre[i] != null ? f1(t.spectre[i]) : "\u2014", { width: cW, align: "center", mono: true }));
      cells.push(tc(t.duree + "h", { width: "400", align: "center" }));
      cells.push(tc(f1(t.leqA), { width: "550", align: "center", bold: true, mono: true }));
      cells.push(tc(t.lpc != null ? f1(t.lpc) : "\u2014", { width: "500", align: "center", mono: true }));
      cells.push(tc({ continu: "C", intermittent: "I", impulsionnel: "IMP" }[t.caract] || "", { width: "420", align: "center" }));
      xml += tr(cells);
    });
    var envC = [tc("ENVELOPPE MAX", { bold: true, bg: "1A7A6D", color: "FFFFFF", width: "1200" }),
      tc("", { bg: "E6F5F2", width: "800" }), tc("", { bg: "E6F5F2", width: "800" })];
    for (var i = 0; i < 8; i++) envC.push(tc(data.spec[i] != null ? f1(data.spec[i]) : "\u2014", { width: cW, align: "center", mono: true, bold: true, bg: "E6F5F2", color: "1A7A6D" }));
    envC.push(tc("", { bg: "E6F5F2", width: "400" }));
    envC.push(tc("", { bg: "E6F5F2", width: "550" }));
    var mxLpc = null; data.taches.forEach(function (t) { if (t.lpc != null && (mxLpc === null || t.lpc > mxLpc)) mxLpc = t.lpc; });
    envC.push(tc(mxLpc != null ? f1(mxLpc) : "\u2014", { bg: "E6F5F2", width: "500", align: "center", bold: true, mono: true, color: mxLpc != null && mxLpc >= 135 ? "C2392B" : "1A7A6D" }));
    envC.push(tc("", { bg: "E6F5F2", width: "420" }));
    xml += tr(envC);
    xml += '</w:tbl><w:p/>';
    return xml;
  }

  /* ══════════ RÉSULTATS OB ══════════ */
  function buildResultsXML(data) {
    var res = data.res, diag = data.diag, adq = data.adq, spec = data.spec, noPicb = data.noPicb, isMulti = data.mode === "multi";
    var xml = '';
    xml += heading(2, 'R\u00c9SULTATS PICB \u2014 Calcul OB INRS' + (isMulti ? " (spectre dimensionnant \u2014 " + (data.taches ? data.taches.length : 1) + " t\u00e2ches)" : ""));
    var ctxPairs = [
      ["Protecteur \u00e9valu\u00e9", noPicb ? "Aucun PICB port\u00e9" : ((data.picb ? data.picb.nom : "\u2014") + (data.picb && data.picb.snr ? " \u00b7 SNR " + data.picb.snr + " dB" : ""))],
      ["Type", noPicb ? "\u2014" : (data.picb ? data.picb.typeLabel || "" : "\u2014")],
      ["Mode", isMulti ? "Multi-sonom\u00e9tries (enveloppe MAX)" : "\u00c9valuation simple"],
      ["Lex,8h mesur\u00e9", data.lex ? data.lex + " dB(A)" : "\u2014"],
      ["Formation au port", noPicb ? "\u2014" : (data.formation ? "Oui \u2014 APV98 standard" : "Non \u2014 d\u00e9cote " + (res.decote || 0) + " dB")]
    ];
    xml += tblStart(9072);
    ctxPairs.forEach(function (p) { xml += tr([tc(p[0], { bold: true, bg: "E8E4D8", width: "3600" }), tc(p[1], { width: "5472" })]); });
    xml += '</w:tbl><w:p/>';
    xml += heading(3, isMulti ? 'Spectre dimensionnant (enveloppe MAX)' : 'Spectre sonom\u00e9trique mesur\u00e9');
    var colW = "900";
    xml += tblStart(9072);
    var hdr = [tc("Hz", { bold: true, bg: "102A43", color: "FFFFFF", width: "1872", align: "center" })];
    FREQS.forEach(function (f) { hdr.push(tc(hz(f), { bold: true, bg: "102A43", color: "FFFFFF", width: colW, align: "center", mono: true })); });
    xml += tr(hdr);
    var specC = [tc("Lf (dB)", { bold: true, bg: "1C4C7C", color: "FFFFFF", width: "1872" })];
    FREQS.forEach(function (f, i) { specC.push(tc(spec[i] != null ? f1(spec[i]) : "\u2014", { width: colW, align: "center", mono: true })); });
    xml += tr(specC);
    if (!noPicb) {
      function obRow(label, fn, tint) {
        var c = [tc(label, { bold: true, bg: "1C4C7C", color: "FFFFFF", width: "1872" })];
        for (var i = 0; i < 8; i++) c.push(tc(res.idx.indexOf(i) >= 0 ? f1(fn(i)) : "\u2014", { width: colW, align: "center", mono: true, bg: tint ? "FBE6D6" : undefined }));
        return tr(c);
      }
      var apvL = res.decote > 0 ? "APV98+ (\u2212" + res.decote + ")" : "APV98+";
      xml += obRow("APV84", function (i) { return res.apv84[i]; }, false);
      xml += obRow(apvL, function (i) { return res.apv98[i]; }, true);
      xml += obRow("L'84 oreille", function (i) { return spec[i] - res.apv84[i]; }, false);
      xml += obRow("L'98 oreille", function (i) { return Math.min(spec[i], spec[i] - res.apv98[i]); }, true);
    }
    xml += '</w:tbl><w:p/>';
    xml += heading(3, 'R\u00e9sultats');
    xml += tblStart(9072);
    if (noPicb) {
      xml += tr([tc("Leq(A) : " + f1(res.leqA) + " dB(A) \u2014 " + diag.tag + " \u2014 " + diag.label, { bold: true, bg: diag.hex.replace("#", ""), color: "FFFFFF", width: "9072", size: "24" })]);
    } else {
      xml += tr([tc("Leq(A) : " + f1(res.leqA) + " dB(A)", { width: "3024", align: "center" }),
        tc("L'A 84% : " + f1(res.la84) + " dB(A)", { width: "3024", align: "center", color: "1C4C7C", bold: true }),
        tc("L'A 98% RETENU : " + f1(res.la98) + " dB(A)", { width: "3024", align: "center", bg: "FBE6D6", color: "C2410C", bold: true })]);
      xml += tr([tc(diag.tag + " \u2014 " + diag.label + " \u00b7 L'A retenu = " + f1(res.ref) + " dB(A)", { bold: true, bg: diag.hex.replace("#", ""), color: "FFFFFF", width: "9072", size: "22" })]);
    }
    xml += '</w:tbl>';
    xml += para("Leq(C) = " + f1(res.leqC) + " dB(C)  \u00b7  Lc \u2212 La = " + f1(res.lcla) + " dB" + (res.lcla > 5 ? " \u2014 bruit \u00e0 dominante basse fr\u00e9quence" : " \u2014 spectre \u00e9quilibr\u00e9"), { bold: true });
    xml += para(diag.txt);
    xml += '<w:p/>';
    xml += heading(3, 'Ad\u00e9quation au poste de travail');
    xml += tblStart(9072);
    xml += tr([tc(adq.titre, { bold: true, bg: adq.hex.replace("#", ""), color: "FFFFFF", width: "9072", size: "22" })]);
    xml += '</w:tbl>';
    xml += para(adq.message);
    xml += para("Pr\u00e9conisations :", { bold: true });
    if (adq.actions) adq.actions.forEach(function (a) { xml += bullet(a); });
    xml += '<w:p/>';
    return xml;
  }

  /* ══════════ CRÊTES Lp,C ══════════ */
  function buildCreteXML(data) {
    if (!data.crDiag) return '';
    var crD = data.crDiag, lpc = data.lpc;
    var xml = heading(2, 'VOIE 2 \u2014 CONTR\u00d4LE CR\u00caTE Lp,C');
    var bgMap = { c135: "F5DFA0", c137: "E8A090", c140: "C2392B" };
    xml += tblStart(9072);
    xml += tr([tc(crD.tag + " \u2014 Lp,C maximal : " + f1(lpc) + " dB(C)", { bold: true, bg: bgMap[crD.cls] || "CCCCCC", color: crD.cls === "c140" ? "FFFFFF" : "000000", width: "9072", size: "22" })]);
    xml += '</w:tbl>';
    xml += para(crD.msg);
    xml += '<w:p/>';
    xml += para("Actions de pr\u00e9vention \u2014 cr\u00eates :", { bold: true });
    if (crD.actions) crD.actions.forEach(function (a) { xml += bullet(a); });
    xml += '<w:p/>';
    return xml;
  }

  /* ══════════ RECOMMANDATIONS ══════════ */
  function buildRecoXML(data) {
    if (!data.recos || data.recos.length === 0) return '';
    var xml = heading(2, 'PISTES DE PR\u00c9VENTION CONTEXTUALIS\u00c9ES');
    xml += para("Propositions issues du croisement source \u00d7 environnement \u00d7 t\u00e2che \u00d7 spectre \u00d7 dur\u00e9e \u00d7 caract\u00e8re impulsionnel. Ces pistes constituent une aide \u00e0 la d\u00e9cision \u00e0 valider par le pr\u00e9venteur signataire.", { bold: true, size: "18" });
    xml += '<w:p/>';
    data.recos.forEach(function (r) {
      xml += para("[" + (r.cat || "").toUpperCase() + "] " + (r.title || ""), { bold: true, color: cleanColor(r.color) });
      xml += para(r.body || "", { indent: "360" });
      xml += '<w:p/>';
    });
    return xml;
  }

  /* ══════════ ASSEMBLAGE ══════════ */
  function exportRapportWord(data) {
    fetch(TEMPLATE_URL)
      .then(function (r) {
        if (!r.ok) throw new Error("Template introuvable (" + r.status + ")");
        return r.arrayBuffer();
      })
      .then(function (buf) { return JSZip.loadAsync(buf); })
      .then(function (zip) {
        return zip.file("word/document.xml").async("string").then(function (xml) {
          xml = replacePlaceholders(xml, data);
          var resultsXML = '';
          if (data.mode === "multi" && data.taches && data.taches.length > 0) resultsXML += buildTachesXML(data);
          resultsXML += buildResultsXML(data);
          if (data.crDiag) resultsXML += buildCreteXML(data);
          if (data.recos && data.recos.length > 0) resultsXML += buildRecoXML(data);

          var marker = "INDICATEURS DE QUALITE";
          var markerIdx = xml.indexOf(marker);
          if (markerIdx > 0) {
            var zone = xml.substring(Math.max(0, markerIdx - 2000), markerIdx);
            var pStart = zone.lastIndexOf("<w:hyperlink");
            if (pStart < 0) pStart = zone.lastIndexOf("<w:p>");
            if (pStart < 0) pStart = zone.lastIndexOf("<w:p ");
            if (pStart >= 0) {
              var abs = Math.max(0, markerIdx - 2000) + pStart;
              xml = xml.substring(0, abs) + resultsXML + '<w:p><w:r><w:br w:type="page"/></w:r></w:p>' + xml.substring(abs);
            }
          } else {
            xml = xml.replace("</w:body>", resultsXML + '</w:body>');
          }

          zip.file("word/document.xml", xml);
          return zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
        });
      })
      .then(function (blob) {
        var safe = function (s) { return (s || "poste").replace(/[^a-z0-9\u00e0\u00e2\u00e9\u00e8\u00ea\u00eb\u00ef\u00ee\u00f4\u00f9\u00fb\u00fc\u00e7]+/gi, "-").slice(0, 30); };
        var fn = "Estimation-Niveaux-Sonores_" + safe(data.entreprise) + "_" + safe(data.poste) + ".docx";
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url; a.download = fn;
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
      })
      .catch(function (err) {
        console.error("[PreventIA] Erreur export SPSTI:", err);
        alert("Erreur export : " + err.message + "\nFallback...");
        if (typeof exportWordLegacy === "function") exportWordLegacy();
      });
  }

  root.exportRapportWord = exportRapportWord;
})(typeof window !== "undefined" ? window : this);
