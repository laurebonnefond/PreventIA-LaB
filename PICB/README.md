# PICB — Évaluation des protections auditives

Calculette INRS méthode OB (bandes d'octave) avec export rapport SPSTI `.docx` natif.

## Architecture des fichiers

```
PICB/
├── index.html                  Calculette PICB (interface + moteur de calcul OB)
├── exporteur-word.js           Moteur de génération .docx (mise en page, tableaux, résultats)
├── modele-rapport-spsti.js     Contenu fixe du modèle SPSTI (déontologie, normes, matériel, seuils)
└── README.md                   Ce fichier
```

## Séparation des responsabilités

| Fichier | Rôle | Quand le modifier |
|---------|------|-------------------|
| `index.html` | Interface utilisateur + calcul OB INRS | Ajout de champs, correction calcul |
| `exporteur-word.js` | Mise en page .docx (docx.js) | Changer le layout, les tableaux, les couleurs |
| `modele-rapport-spsti.js` | Textes réglementaires et métier | Corriger un article de loi, ajouter une norme, mettre à jour le matériel |

## Flux de données

```
Saisie utilisateur (spectre, PICB, contexte)
       ↓
  moteur calcul OB (dans index.html)
       ↓
  LAST = { spec, res, diag, adq, picb }   ← variable globale
       ↓
  buildReportData()                         ← passerelle (dans index.html)
       ↓
  reportData = { entreprise, poste, ..., res, diag, adq }
       ↓
  exportRapportWord(reportData)             ← exporteur-word.js
       ↓                                      lit MODELE_RAPPORT_SPSTI
  vrai fichier .docx téléchargé               (modele-rapport-spsti.js)
```

## Dépendance CDN

```html
<script src="https://cdn.jsdelivr.net/npm/docx@9.5.0/build/index.umd.min.js"></script>
```

Chargé automatiquement par `index.html`. Si indisponible → fallback sur l'ancien export HTML-as-doc.

## Modifier le contenu du rapport

Tous les textes fixes sont dans `modele-rapport-spsti.js` :
- **Déontologie** → `MODELE_RAPPORT_SPSTI.deontologie.sections[]`
- **Normes** → `MODELE_RAPPORT_SPSTI.normes.dosimetrie[]` / `.sonometrie[]`
- **Matériel** → `MODELE_RAPPORT_SPSTI.materiel.exposimetres` / `.sonometre`
- **Seuils** → `MODELE_RAPPORT_SPSTI.seuils.tableau[]`

Pas besoin de toucher au moteur pour une correction de texte.
