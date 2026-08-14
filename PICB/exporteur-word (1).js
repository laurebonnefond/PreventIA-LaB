/**
 * exporteur-word.js
 * ═══════════════════════════════════════════════════════════════
 * Moteur de génération de rapport .docx
 * « Estimation des niveaux sonores — Évaluation PICB »
 *
 * Dépendances (CDN) :
 *   docx@9.5.0 — https://cdn.jsdelivr.net/npm/docx@9.5.0/build/index.umd.min.js
 *
 * Données en entrée :
 *   reportData — objet construit par buildReportData() dans index.html
 *   MODELE_RAPPORT_SPSTI — objet du modèle (modele-rapport-spsti.js)
 *
 * Usage : exportRapportWord(reportData)
 *
 * PréventIA-LaB · SPSTI 23/87
 * ═══════════════════════════════════════════════════════════════
 */

/* global docx, MODELE_RAPPORT_SPSTI */
(function (root) {
  "use strict";

  /* ══════════ PALETTE ══════════ */
  var C = {
    INK:"102a43", NAVY:"1c4c7c", ACCENT:"c2410c", GOLD:"b78a2e",
    WHITE:"ffffff", PAPER:"f4f1ea", LINE:"e2dccd",
    GREEN:"2f7d4f", AMBER:"cd8a1c", RED:"c2392b", DARKRED:"8a1c12"
  };
  var MARGIN = 1418, CONTENT_W = 11906 - 2 * MARGIN; // A4

  var D = docx; // shorthand

  /* ══════════ HELPERS ══════════ */
  function f1(x) {
    if (x == null || !isFinite(x)) return "—";
    return (Math.round(x * 10) / 10).toFixed(1);
  }
  function hz(f) { return f >= 1000 ? (f / 1000) + "k" : "" + f; }

  function txt(s, o) {
    o = o || {};
    return new D.TextRun(Object.assign({ text: String(s == null ? "" : s) }, o));
  }
  function para(runs, o) {
    if (typeof runs === "string") runs = [txt(runs)];
    if (!Array.isArray(runs)) runs = [runs];
    o = o || {};
    return new D.Paragraph(Object.assign({ children: runs }, o));
  }
  function heading(text, level) {
    return para([txt(text, { bold: true })], {
      heading: level === 1 ? D.HeadingLevel.HEADING_1 : D.HeadingLevel.HEADING_2,
      spacing: { before: 240, after: 120 }
    });
  }
  function emptyP() { return para(""); }
  function pageBreak() { return new D.Paragraph({ children: [new D.PageBreak()] }); }

  function cell(content, o) {
    o = o || {};
    var ch;
    if (typeof content === "string" || typeof content === "number") {
      ch = [para([txt(String(content), {
        bold: !!o.bold, color: o.fontColor || undefined,
        size: o.fontSize || 20, font: o.mono ? "Courier New" : "Calibri"
      })], { alignment: o.align || D.AlignmentType.LEFT, spacing: { before: 40, after: 40 } })];
    } else if (Array.isArray(content)) { ch = content; }
    else { ch = [content]; }
    var co = {
      children: ch,
      width: o.width ? { size: o.width, type: D.WidthType.DXA } : undefined,
      shading: o.bg ? { type: D.ShadingType.CLEAR, fill: o.bg } : undefined,
      verticalAlign: D.VerticalAlign.CENTER,
      borders: {
        top:    { style: D.BorderStyle.SINGLE, size: 1, color: C.LINE },
        bottom: { style: D.BorderStyle.SINGLE, size: 1, color: C.LINE },
        left:   { style: D.BorderStyle.SINGLE, size: 1, color: C.LINE },
        right:  { style: D.BorderStyle.SINGLE, size: 1, color: C.LINE }
      }
    };
    if (o.columnSpan) co.columnSpan = o.columnSpan;
    return new D.TableCell(co);
  }
  function row(cells) { return new D.TableRow({ children: cells }); }
  function table(rows, colWidths) {
    return new D.Table({
      rows: rows,
      width: { size: CONTENT_W, type: D.WidthType.DXA },
      columnWidths: colWidths
    });
  }
  function diagHex(d) {
    if (!d) return C.NAVY;
    return ({ ok: C.GREEN, sur: C.AMBER, lim: C.AMBER, nc: C.RED, vle: C.DARKRED })[d.key] || C.NAVY;
  }

  /* ══════════ PAGE DE GARDE ══════════ */
  function buildGarde(data) {
    var M = MODELE_RAPPORT_SPSTI.garde;
    return [
      table([row([cell([
        para([txt(M.kicker, { size: 18, bold: true, color: C.GOLD })]),
        para([txt(M.titre, { size: 36, bold: true, color: C.WHITE })]),
        para([txt(M.sousTitre, { size: 20, color: "c7d2dd" })]),
        para([txt(M.methode, { size: 16, color: "aebccb" })])
      ], { bg: C.INK, width: CONTENT_W })])], [CONTENT_W]),
      emptyP(), emptyP(),
      para([txt(data.entreprise || "Nom entreprise", { bold: true, size: 32 })]),
      para([txt(data.adresse || "", { size: 24 })]),
      para([txt(data.cp_ville || "", { size: 24 })]),
      emptyP(),
      para([txt("Dosimétrie & Sonométrie du poste suivant :", { bold: true, size: 24 })]),
      para([txt("• " + (data.poste || "—"), { size: 24 })]),
      emptyP(), emptyP(),
      para([txt("Mesures réalisées le " + (data.date || "—"), { bold: true, size: 22 })]),
      para([txt((data.intervenant || "—") + " — " + (data.qualite || "IPRP"), { bold: true, size: 22 })]),
      pageBreak()
    ];
  }

  /* ══════════ SECTIONS FIXES (depuis modele-rapport-spsti.js) ══════════ */

  function buildDeontologie() {
    var S = MODELE_RAPPORT_SPSTI.deontologie;
    var elts = [heading(S.titre, 2)];
    S.sections.forEach(function (sec) {
      elts.push(para([txt(sec.titre, { bold: true, size: 22 })]));
      elts.push(para(sec.texte, { spacing: { after: 100 } }));
    });
    return elts;
  }

  function buildTermes() {
    var S = MODELE_RAPPORT_SPSTI.termes;
    var rows_ = S.definitions.map(function (d) {
      return row([
        cell(d.terme, { bold: true, bg: C.PAPER, width: 1800, fontSize: 18 }),
        cell(d.def, { width: CONTENT_W - 1800, fontSize: 18 })
      ]);
    });
    return [heading(S.titre, 2), table(rows_, [1800, CONTENT_W - 1800])];
  }

  function buildNormes() {
    var S = MODELE_RAPPORT_SPSTI.normes;
    var elts = [heading(S.titre, 2)];
    elts.push(para([txt("DOSIMÉTRIE :", { bold: true, underline: {} })]));
    S.dosimetrie.forEach(function (n) { elts.push(para(n.ref + " : " + n.desc)); });
    elts.push(emptyP());
    elts.push(para([txt("SONOMÉTRIE :", { bold: true, underline: {} })]));
    S.sonometrie.forEach(function (n) { elts.push(para(n.ref + " : " + n.desc)); });
    return elts;
  }

  function buildMateriel() {
    var S = MODELE_RAPPORT_SPSTI.materiel;
    var elts = [heading(S.titre, 2)];
    elts.push(para([txt("Acquisition des données", { bold: true, underline: {} })]));
    elts.push(para([txt(S.exposimetres.quantite + " " + S.exposimetres.modele + " :", { bold: true })]));
    var matRows = S.exposimetres.series.map(function (s) {
      return row([
        cell("N° de série WED :", { bold: true, width: 3000 }),
        cell(s.numero, { width: 2000, mono: true }),
        cell("Dernier étalonnage le " + s.etalonnage, { width: CONTENT_W - 5000 })
      ]);
    });
    matRows.push(row([
      cell("Calibreur n° :", { bold: true, width: 3000 }),
      cell(S.exposimetres.calibreur.numero, { width: 2000, mono: true }),
      cell("Dernier étalonnage le " + S.exposimetres.calibreur.etalonnage, { width: CONTENT_W - 5000 })
    ]));
    elts.push(table(matRows, [3000, 2000, CONTENT_W - 5000]));
    elts.push(emptyP());
    elts.push(para([txt(S.sonometre.modele, { bold: true })]));
    elts.push(para("N° de série : " + S.sonometre.serie + " — dernier étalonnage le " + S.sonometre.etalonnage));
    elts.push(para("Source de calibration n° " + S.sonometre.calibreur.numero + " — étalonnage le " + S.sonometre.calibreur.etalonnage));
    elts.push(emptyP());
    elts.push(para([txt("Emplacement du microphone :", { bold: true, underline: {} })]));
    elts.push(para(S.microphone.position));
    elts.push(para(S.microphone.cote));
    elts.push(para(S.microphone.contrainte));
    elts.push(emptyP());
    elts.push(para([txt("Traitement des données :", { bold: true, underline: {} })]));
    elts.push(para("Logiciel " + S.logiciel + " — norme européenne ISO 9612-2009."));
    return elts;
  }

  function buildSeuils(n) {
    var S = MODELE_RAPPORT_SPSTI.seuils;
    var header = row([
      cell("Seuil",              { bold: true, bg: C.INK, fontColor: C.WHITE, width: 2400 }),
      cell("Lex,8h",             { bold: true, bg: C.INK, fontColor: C.WHITE, width: 1100, align: D.AlignmentType.CENTER }),
      cell("Lpc",                { bold: true, bg: C.INK, fontColor: C.WHITE, width: 1100, align: D.AlignmentType.CENTER }),
      cell("Obligation employeur",{ bold: true, bg: C.INK, fontColor: C.WHITE, width: CONTENT_W - 4600 })
    ]);
    var rows_ = [header].concat(S.tableau.map(function (s) {
      return row([
        cell(s.seuil, { width: 2400, bold: true }),
        cell(s.lex,   { width: 1100, align: D.AlignmentType.CENTER, bold: true, mono: true }),
        cell(s.lpc,   { width: 1100, align: D.AlignmentType.CENTER, bold: true, mono: true }),
        cell(s.obligation, { width: CONTENT_W - 4600 })
      ]);
    }));
    return [
      heading(n + ". Rappel des seuils réglementaires", 2),
      table(rows_, [2400, 1100, 1100, CONTENT_W - 4600]),
      para(S.reference, { spacing: { before: 60 } })
    ];
  }

  /* ══════════ SECTIONS DYNAMIQUES (données du calcul HTML) ══════════ */

  function buildContexte(data, n) {
    var pairs = [
      ["Entreprise", data.entreprise || "—"],
      ["Poste de travail", data.poste || "—"],
      ["Date des mesures", data.date || "—"],
      ["Intervenant", (data.intervenant || "—") + " — " + (data.qualite || "")],
      ["Service de santé au travail", data.service || "SPSTI 23/87"],
      ["Niveau d'exposition Lex,8h mesuré", data.lex ? data.lex + " dB(A)" : "—"]
    ];
    if (!data.noPicb && data.picb) {
      if (data.picb.isDouble) {
        pairs.push(["Protecteur évalué (PICB)", "Double protection (bouchon + casque)"]);
        pairs.push(["Protection 1 — bouchon", data.picb.picb1.nom + (data.picb.picb1.snr ? " · SNR " + data.picb.picb1.snr + " dB" : "")]);
        pairs.push(["Protection 2 — casque",  data.picb.picb2.nom + (data.picb.picb2.snr ? " · SNR " + data.picb.picb2.snr + " dB" : "")]);
      } else {
        pairs.push(["Protecteur évalué (PICB)", (data.picb.nom || "—") + (data.picb.snr ? " · SNR " + data.picb.snr + " dB" : "")]);
        pairs.push(["Type de protecteur", data.picb.typeLabel || "—"]);
      }
      pairs.push(["Formation au port du PICB",
        data.formation ? "Oui — APV98 standard (pas de décote)"
          : "Non — décote INRS de " + (data.res.decote || 0) + " dB appliquée"]);
    } else {
      pairs.push(["Protecteur évalué (PICB)", "Aucun — pas de PICB porté à ce poste"]);
    }
    var rows_ = pairs.map(function (p) {
      return row([
        cell(p[0], { bold: true, bg: C.PAPER, width: 3600, fontSize: 19 }),
        cell(p[1], { width: CONTENT_W - 3600, fontSize: 19 })
      ]);
    });
    return [heading(n + ". Contexte de l'intervention", 2), table(rows_, [3600, CONTENT_W - 3600])];
  }

  function buildSpectre(data, n) {
    var FREQS = [63, 125, 250, 500, 1000, 2000, 4000, 8000];
    var colW = Math.floor((CONTENT_W - 1800) / 8);
    var hC = [cell("Fréquence (Hz)", { bold: true, bg: C.INK, fontColor: C.WHITE, width: 1800, fontSize: 18 })];
    var sC = [cell("Niveau Lf (dB)", { bold: true, bg: C.NAVY, fontColor: C.WHITE, width: 1800, fontSize: 18 })];
    FREQS.forEach(function (f, i) {
      hC.push(cell(hz(f), { bold: true, bg: C.INK, fontColor: C.WHITE, width: colW, align: D.AlignmentType.CENTER, fontSize: 18, mono: true }));
      sC.push(cell((data.spec && data.spec[i] != null) ? f1(data.spec[i]) : "—", { width: colW, align: D.AlignmentType.CENTER, fontSize: 18, mono: true }));
    });
    var cW = [1800]; for (var k = 0; k < 8; k++) cW.push(colW);
    return [
      heading(n + ". Spectre sonométrique mesuré", 2),
      table([row(hC), row(sC)], cW),
      para("La bande 63 Hz est facultative (conforme à la calculette INRS V7.2).", { spacing: { before: 60 } })
    ];
  }

  function buildOB(data, n) {
    if (data.noPicb) return [];
    var FREQS = [63, 125, 250, 500, 1000, 2000, 4000, 8000];
    var res = data.res, spec = data.spec;
    var colW = Math.floor((CONTENT_W - 1800) / 8);
    var cW = [1800]; for (var k = 0; k < 8; k++) cW.push(colW);

    function obRow(label, fn, tint) {
      var cells = [cell(label, { bold: true, bg: C.NAVY, fontColor: C.WHITE, width: 1800, fontSize: 17 })];
      for (var i = 0; i < 8; i++) {
        cells.push(cell(res.idx.indexOf(i) >= 0 ? f1(fn(i)) : "—", {
          width: colW, align: D.AlignmentType.CENTER, fontSize: 17, mono: true,
          bg: tint ? "fbe6d6" : undefined
        }));
      }
      return row(cells);
    }
    var hC = [cell("Fréquence (Hz)", { bold: true, bg: C.INK, fontColor: C.WHITE, width: 1800, fontSize: 17 })];
    FREQS.forEach(function (f) {
      hC.push(cell(hz(f), { bold: true, bg: C.INK, fontColor: C.WHITE, width: colW, align: D.AlignmentType.CENTER, fontSize: 17, mono: true }));
    });
    var apv98Lbl = res.decote > 0 ? "APV98+ (−" + res.decote + " dB)" : "APV98+";

    return [
      heading(n + ". Calcul par la méthode OB — Atténuations APV et bruit résiduel", 2),
      table([
        row(hC),
        obRow("Lf mesuré",   function (i) { return spec[i]; }, false),
        obRow("APV₈₄",       function (i) { return res.apv84[i]; }, false),
        obRow(apv98Lbl,      function (i) { return res.apv98[i]; }, true),
        obRow("L'₈₄ oreille",function (i) { return spec[i] - res.apv84[i]; }, false),
        obRow("L'₉₈ oreille",function (i) { return Math.min(spec[i], spec[i] - res.apv98[i]); }, true)
      ], cW),
      para(res.decote > 0
        ? "APV84 = Mf − Sf (ISO 4869-2) · APV98+ = MAX(0, Mf − 2·Sf − " + res.decote + ") avec décote INRS (référence retenue, surlignée)."
        : "APV84 = Mf − Sf (ISO 4869-2) · APV98+ = MAX(0, Mf − 2·Sf) (référence INRS retenue, surlignée).",
      { spacing: { before: 60 } })
    ];
  }

  function buildResultats(data, n) {
    var res = data.res, diag = data.diag, noPicb = data.noPicb;
    var elts = [heading(n + ". Résultats" + (noPicb ? " — Exposition au bruit ambiant" : ""), 2)];
    if (noPicb) {
      elts.push(para([txt("Aucun protecteur auditif porté à ce poste.", { bold: true }),
        txt(" Le niveau d'exposition correspond au bruit ambiant mesuré.")]));
    }
    var dH = diagHex(diag);
    var thirdW = Math.floor(CONTENT_W / 3);
    if (noPicb) {
      elts.push(table([row([cell([
        para([txt("NIVEAU D'EXPOSITION AMBIANT Leq(A)", { size: 18, color: C.WHITE })], { alignment: D.AlignmentType.CENTER }),
        para([txt(f1(res.leqA) + " dB(A)", { size: 44, bold: true, color: C.WHITE })], { alignment: D.AlignmentType.CENTER }),
        para([txt(diag.tag + " — " + diag.label, { size: 20, color: C.WHITE })], { alignment: D.AlignmentType.CENTER })
      ], { bg: dH, width: CONTENT_W })])], [CONTENT_W]));
    } else {
      elts.push(table([row([
        cell([
          para([txt("Leq(A) sans PICB", { size: 16, color: "5d6b7a" })], { alignment: D.AlignmentType.CENTER }),
          para([txt(f1(res.leqA) + " dB(A)", { size: 34, bold: true })], { alignment: D.AlignmentType.CENTER })
        ], { width: thirdW }),
        cell([
          para([txt("L'A à 84 % — ISO 4869-2", { size: 16, color: "5d6b7a" })], { alignment: D.AlignmentType.CENTER }),
          para([txt(f1(res.la84) + " dB(A)", { size: 34, bold: true, color: C.NAVY })], { alignment: D.AlignmentType.CENTER })
        ], { width: thirdW }),
        cell([
          para([txt("L'A à 98 % — RETENU INRS", { size: 16, color: C.ACCENT })], { alignment: D.AlignmentType.CENTER }),
          para([txt(f1(res.la98) + " dB(A)", { size: 34, bold: true, color: C.ACCENT })], { alignment: D.AlignmentType.CENTER })
        ], { bg: "fbe6d6", width: thirdW })
      ])], [thirdW, thirdW, thirdW]));
    }
    elts.push(emptyP());
    var lcNote = res.lcla > 5 ? " — bruit à dominante basse fréquence" : " — spectre équilibré";
    elts.push(para([
      txt("Leq(C) = " + f1(res.leqC) + " dB(C)", { bold: true }), txt("  ·  "),
      txt("Indicateur Lc − La = " + f1(res.lcla) + " dB", { bold: true }),
      txt(lcNote, { color: res.lcla > 5 ? C.RED : "5d6b7a" })
    ]));
    if (!noPicb) {
      elts.push(emptyP());
      elts.push(table([row([cell([para([
        txt(diag.tag + " — " + diag.label + "  ·  L'A retenu = " + f1(res.ref) + " dB(A)",
          { bold: true, color: C.WHITE, size: 22 })
      ])], { bg: dH, width: CONTENT_W })])], [CONTENT_W]));
    }
    elts.push(para(diag.txt, { spacing: { before: 80 } }));
    return elts;
  }

  function buildAdequation(data, n) {
    var adq = data.adq, noPicb = data.noPicb;
    var titre = noPicb
      ? n + ". Conformité réglementaire au poste"
      : n + ". Vérification de l'adéquation au poste de travail";
    var elts = [heading(titre, 2)];
    if (!noPicb) {
      elts.push(para([
        txt("Analyse IPRP enrichie", { bold: true }),
        txt(" — " + MODELE_RAPPORT_SPSTI.footer.analysePrecision)
      ], { border: { left: { style: D.BorderStyle.SINGLE, size: 6, color: C.GOLD } },
        indent: { left: 200 }, spacing: { after: 120 } }));
    }
    var adqH = adq.hex ? adq.hex.replace("#", "") : C.NAVY;
    elts.push(table([row([cell([para([txt(adq.titre, { bold: true, color: C.WHITE, size: 22 })])], { bg: adqH, width: CONTENT_W })])], [CONTENT_W]));
    elts.push(para(adq.message, { spacing: { before: 80, after: 120 } }));
    elts.push(para([txt("Préconisations :", { bold: true })]));
    if (adq.actions) {
      adq.actions.forEach(function (a) {
        elts.push(para([txt(a)], {
          numbering: { reference: "precos", level: 0 },
          spacing: { before: 40, after: 40 },
          indent: { left: 400, hanging: 260 }
        }));
      });
    }
    return elts;
  }

  function buildValidation(data, n) {
    var halfW = Math.floor(CONTENT_W / 2);
    var svc = MODELE_RAPPORT_SPSTI.service;
    return [
      heading(n + ". " + MODELE_RAPPORT_SPSTI.validation.titre, 2),
      para(MODELE_RAPPORT_SPSTI.validation.texteIntro),
      emptyP(),
      table([
        row([
          cell([
            para([txt("Intervenant", { color: "5d6b7a", size: 18 })]),
            para([txt((data.intervenant||"—") + " — " + (data.qualite||"IPRP"), { bold: true })]),
            para([txt(data.service || svc.nom, { size: 18 })]),
            emptyP(), emptyP(),
            para([txt("Date et signature", { color: "5d6b7a", size: 18 })])
          ], { width: halfW }),
          cell([
            para([txt("Visa de l'entreprise", { color: "5d6b7a", size: 18 })]),
            emptyP(), emptyP(), emptyP(), emptyP(),
            para([txt("Nom, qualité, cachet", { color: "5d6b7a", size: 18 })])
          ], { width: halfW })
        ]),
        row([cell([
          para([txt("Médecin du travail", { color: "5d6b7a", size: 18 })]),
          para([txt(data.medecin || "Dr ________________", { bold: true })]),
          emptyP(), emptyP(),
          para([txt("Date et signature", { color: "5d6b7a", size: 18 })])
        ], { width: CONTENT_W, columnSpan: 2 })])
      ], [halfW, halfW]),
      emptyP(),
      para([txt(MODELE_RAPPORT_SPSTI.footer.disclaimer, { size: 18, color: "5d6b7a" })], {
        border: { top: { style: D.BorderStyle.SINGLE, size: 4, color: C.ACCENT } },
        spacing: { before: 120 }
      }),
      para([txt(svc.nom + " — " + svc.adresse + " — Tél. " + svc.tel, { size: 18, color: "5d6b7a" })])
    ];
  }

  /* ══════════ ASSEMBLAGE ══════════ */
  function exportRapportWord(data) {
    var noPicb = !!data.noPicb;
    // Numérotation dynamique des sections
    var s = 1;
    var nGarde = null; // pas de numéro
    var nDeon = s++;   // 1
    var nTermes = s++; // 2
    var nDemande = s++;// 3
    var nNormes = s++; // 4
    var nMat = s++;    // 5
    var nCtx = s++;    // 6
    var nSpec = s++;   // 7
    var nOB = noPicb ? null : s++; // 8 (ou skip)
    var nRes = s++;    // 8 ou 9
    var nAdq = s++;    // 9 ou 10
    var nSeuils = s++; // 10 ou 11
    var nValid = s++;  // 11 ou 12

    var children = []
      .concat(buildGarde(data))
      .concat(buildDeontologie())
      .concat([pageBreak()])
      .concat(buildTermes())
      .concat([pageBreak()])
      .concat(buildNormes())
      .concat(buildMateriel())
      .concat([pageBreak()])
      .concat(buildContexte(data, nCtx))
      .concat(buildSpectre(data, nSpec))
      .concat(buildOB(data, nOB))
      .concat([pageBreak()])
      .concat(buildResultats(data, nRes))
      .concat(buildAdequation(data, nAdq))
      .concat(buildSeuils(nSeuils))
      .concat([pageBreak()])
      .concat(buildValidation(data, nValid));

    var doc = new D.Document({
      numbering: { config: [{
        reference: "precos",
        levels: [{ level: 0, format: D.LevelFormat.DECIMAL, text: "%1.",
          alignment: D.AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 400, hanging: 260 } } }
        }]
      }] },
      styles: { paragraphStyles: [
        { id: "Normal", name: "Normal", run: { font: "Calibri", size: 22 } }
      ] },
      sections: [{ properties: {
        page: {
          size: { width: 11906, height: 16838, orientation: D.PageOrientation.PORTRAIT },
          margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN }
        }
      }, children: children }]
    });

    D.Packer.toBlob(doc).then(function (blob) {
      var safe = function (s) { return (s || "poste").replace(/[^a-z0-9àâéèêëïîôùûüç]+/gi, "-").slice(0, 30); };
      var fn = "Rapport-PICB-SPSTI_" + safe(data.entreprise) + "_" + safe(data.poste) + ".docx";
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url; a.download = fn;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    });
  }

  root.exportRapportWord = exportRapportWord;
})(typeof window !== "undefined" ? window : this);
