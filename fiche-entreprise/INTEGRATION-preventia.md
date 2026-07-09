# PréventIA-LaB — Intégration : base NAF complète + restitutions 3 niveaux

## 1. `naf-codes.json` — base partagée

732 sous-classes officielles extraites de la **NAF rév. 2 (réédition INSEE 2020)**, avec double schéma de clés pour être lue **sans modification** par les deux outils :

```json
{
  "meta": { "source": "INSEE — NAF rév. 2 …", "nb_sous_classes": 732 },
  "sections": [ { "s": "A", "label": "Agriculture, sylviculture et pêche" }, … ],
  "secteursPreventIA": ["agriculture","agroalim","aide_domicile", …],
  "codes": [
    {
      "c": "86.10Z",  "l": "Activités hospitalières",  "s": "Q",
      "kw": "activités hospitalières",
      "code": "86.10Z", "libelle": "Activités hospitalières",
      "secteur": "sante", "division": "86", "classe": "86.10",
      "sectionLib": "Santé humaine et action sociale"
    }
  ]
}
```

| Outil | Clés lues | Rien à modifier |
|---|---|---|
| `fiche-entreprise-unified.html` | `data.codes[].c / .l / .s / .kw` + `data.sections[].s / .label` | ✅ |
| `PreventIA-etude-poste.html` | `data.codes[].code / .libelle / .secteur` | ✅ |

Le champ **`secteur`** rattache chaque code NAF à l'un des 18 profils PréventIA
(`sante`, `btp`, `hcr`, `agroalim`, `proprete`, `coiffure`, `dechets`, `tertiaire`…),
ce qui déclenche automatiquement `appliquerProfil()` dans l'étude de poste **et**
`autoCheckMetiers()` dans la fiche d'entreprise.

Règles de rattachement (dérivées du guide NAF/CPF §5.2 et §5.5) :

| Divisions NAF | Secteur PréventIA |
|---|---|
| 01–03 | agriculture |
| 05–09, 13–35 | industrie |
| 10–12 | agroalim |
| 36–39 | dechets (eau, assainissement, déchets, dépollution) |
| 41–43 | btp |
| 45–47 | commerce |
| 49–51 / 52–53 | transport / logistique |
| 55–56 | hcr |
| 85 (sauf 85.10Z) | enseignement |
| 86–88 | sante |
| 81.2x / 81.30Z / 96.02x / 80.x | proprete / espaces_verts / coiffure / securite |
| 88.10A/C, 97.00Z, 98.x | aide_domicile |
| 88.91A/B, 85.10Z | petite_enfance |
| reste | tertiaire |

> ⚠️ Mention à conserver dans la FE : *« L'attribution par l'INSEE d'un code APE, à des fins statistiques, ne saurait suffire à créer des droits ou des obligations »* (art. 5 du décret n° 2007-1888).

**Déploiement :** déposer `naf-codes.json` à la racine du dossier de l'outil (à côté du `.html`).

---

## 2. `preventia-restitutions.js` — restitutions 3 niveaux

Module autonome (aucune dépendance, styles auto-injectés). Il reproduit **exactement**
les primitives graphiques de l'étude de poste : `svgGauge`, `svgRadar` (8 familles),
`svgMatrix` (gravité × probabilité), `svgBars`, `svgTimeline`.

### 2.1 Modèle de scoring adapté à la fiche d'entreprise

| Grandeur | Source FE | Échelle |
|---|---|---|
| **Gravité** | niveau de suivi : `SIR=5`, `SIA=4`, `SI=3`, `–=2` | 1–5 |
| **Probabilité résiduelle** | réponse maîtrise : `maîtrisé=1`, `partiel=3`, `non=5`, non évalué=3 | 1–5 |
| **Risque résiduel** | `gravité × probabilité / 25 × 100` | 0–100 |
| **Score famille** | moyenne des résiduels de la famille | 0–100 |
| **Score PréventIA** | moyenne pondérée par la gravité | 0–100 |

Sémantique identique à l'étude de poste : **0 = maîtrisé, 100 = critique**.
L'`indice PréventIA®` existant (taux de maîtrise) est conservé et affiché en parallèle.

Les 12 familles de la base FE (`TMS`, `Chimique`, `Ambiances physiques`, `Chutes`,
`Risques mécaniques`, `Transports`, `Organisationnel`, `Psychosociaux`…) sont
remappées sur les **8 familles PréventIA** pour que le radar et la matrice soient
strictement superposables entre les deux outils.

### 2.2 Branchement dans `fiche-entreprise-unified.html`

**a)** avant `</body>` :

```html
<script src="preventia-restitutions.js"></script>
```

**b)** ajouter l'onglet dans `render()` :

```js
<button class="tab ${currentTab==='restit'?'on':''}" data-tab="restit">🧭 Restitutions</button>
…
<div data-pane="restit" id="pvxHost" style="display:${currentTab==='restit'?'block':'none'}"></div>
```

**c)** juste après `res.innerHTML = panes;` :

```js
if (currentTab === 'restit') {
  PVX.render('pvxHost', {
    A, S: computeScoring(A), answers,
    meta: {
      entreprise : (document.getElementById('nom-entreprise')?.value) || '',
      naf        : selNafCode ? selNafCode.c : '',
      nafLib     : selNafCode ? selNafCode.l : '',
      section    : selNafCode ? selNafCode.s : '',
      sectionLib : selNafCode ? (DB.secteurs.find(s=>s.naf===selNafCode.s)||{}).label : '',
      effectif   : globalEffectif || '',
      date       : new Date().toISOString().slice(0,10),
      preventeur : ''
    },
    doublons: {
      n: ameSuggestions.filter(s => s.type === 'redondance' && !s.rejected).length,
      items: ameSuggestions.filter(s => s.type === 'redondance').map(s => ({
        risque: s.section, observe: s.observed, conseille: s.advised, sim: s.sim
      }))
    }
  });
}
```

> Si le mode « améliorateur » n'a pas été utilisé, passer `doublons: {n:0, items:[]}`.

### 2.3 Les 3 niveaux produits

| Niveau | Contenu | Public |
|---|---|---|
| **N1 — Étude expert** | 9 sections : identification, unités & métiers, cotation risque par risque (G × P × résiduel + réf. réglementaire), synthèse par famille, moyens EPC/EPI/MP, **contrôle qualité doublons observé ↔ conseillé**, analyse, plan d'action, conclusion | IPRP, préventeur |
| **N2 — Synthèse A4** | 1 page : carte d'identité, top 7 risques, jauge, radar 8 familles, matrice G × P, histogramme des 5 macro-contraintes, points clés, conclusion, plan d'action top 5 | Employeur, CSE |
| **N3 — Cockpit** | 10 KPI (score résiduel, indice PréventIA®, SIR, familles critiques, effectif exposé, non maîtrisés, non évalués, taux de maîtrise, niveau documentaire, **doublons détectés**), radar, jauge, matrice, histogramme, RAG 8 familles, chronologie 12 mois, tableau des familles, avis médecin | Médecin du travail, direction |

Export **Word** (`.doc`) et **Impression / PDF** disponibles sur les 3 niveaux.

### 2.4 Le repérage de doublons est conservé et remonté

L'algorithme existant (`ameSimilarity`, Jaccard sur mots-clés significatifs, seuil 0,55)
alimente désormais :
- un **tableau dédié** dans l'étude expert (risque · observé · conseillé · % de similarité),
- un **KPI dans le cockpit**,
- une **ligne dans la conclusion** (« *n* redondance(s) à arbitrer avant diffusion »).

---

## 3. Vérifications faites

- 732 sous-classes extraites = compte officiel INSEE (NAF rév. 2).
- Contrôle ponctuel : `86.10Z` Activités hospitalières · `47.11D` Supermarchés ·
  `43.99C` Travaux de maçonnerie générale et gros œuvre · `88.10A` Aide à domicile ·
  `28.99A` Fabrication de machines d'imprimerie.
- Aucun libellé tronqué, aucun > 150 caractères parasité par les notes explicatives.
- Module testé : cotation, familles, plan d'action, génération des 5 SVG.

## 4. Pistes suivantes

1. Enrichir `naf-codes.json` d'un champ `risquesTypes: [ids]` par division (préremplissage
   du DUERP à la sélection du NAF).
2. Basculer le rattachement NAF → secteur en table externe éditable (`naf-secteurs.json`)
   plutôt qu'en dur, pour ajuster sans reparser le PDF.
3. Réutiliser `PVX` tel quel dans l'évaluateur de risque chimique (même jauge, même radar).

---

## 5. `naf-secteurs.json` + `naf-secteurs.js` — rattachement éditable

Le champ `secteur` reste présent dans `naf-codes.json` (fallback hors-ligne), mais il
est désormais **recalculé au chargement** depuis une table de règles externe, modifiable
sans reparser le PDF INSEE.

### Structure de `naf-secteurs.json`

```json
{
  "secteurs": [ { "id": "aide_domicile", "label": "Aide et services à domicile" }, … ],
  "regles": [
    { "id":"r01", "type":"codes",    "valeurs":["88.10A","97.00Z"], "secteur":"aide_domicile" },
    { "id":"r04", "type":"prefixe",  "valeurs":["81.2"],            "secteur":"proprete" },
    { "id":"r11", "type":"division", "valeurs":["41","42","43"],    "secteur":"btp" }
  ],
  "overrides": { "10.71C": "agroalim" },
  "defaut": "tertiaire"
}
```

- **Règles ordonnées** : la première qui matche gagne. Ajouter une règle *en haut* = priorité maximale.
- **3 types** : `codes` (sous-classe exacte), `prefixe` (groupe ou classe), `division` (2 chiffres).
- **`overrides`** : appliqué en dernier, écrase tout. C'est là qu'on note les cas particuliers
  rencontrés en visite (une entreprise dont le code APE ne reflète pas l'activité réelle —
  situation prévue par l'art. 5 du décret n° 2007-1888).

### Branchement

```html
<script src="naf-secteurs.js"></script>
```

puis, dans `loadDB()` juste après `await loadNafCodes();` :

```js
await NAFSEC.load();        // charge naf-secteurs.json (silencieux si absent)
NAFSEC.apply(NAF_CODES);    // réécrit .secteur / .sec sur les 732 codes
```

Idem dans l'étude de poste, dans `loadRealBase()` après le mapping de `NAF`.

### Utilitaires

| Appel | Retour |
|---|---|
| `NAFSEC.resolve('88.10A')` | `'aide_domicile'` |
| `NAFSEC.explain('81.30Z')` | `{secteur:'espaces_verts', regle:'r03', commentaire:'Services d'aménagement paysager'}` |
| `NAFSEC.label('hcr')` | `'Hôtellerie, café, restauration'` |
| `NAFSEC.stats(NAF_CODES)` | `[['industrie',237],['tertiaire',153],…]` — pour vérifier l'effet d'une modif de règle |

**Vérifié :** la table de règles reproduit à l'identique le mapping des 732 codes (0 écart).
