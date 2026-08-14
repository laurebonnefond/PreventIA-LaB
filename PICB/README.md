# PICB — Évaluation des protections auditives

Calculette INRS méthode OB avec export rapport SPSTI `.docx` natif.

## Architecture

```
PICB/
├── index.html                    Calculette PICB (interface + calcul OB)
├── exporteur-word.js             Moteur d'injection dans le template SPSTI
├── modele-rapport-spsti.docx     Template Word SPSTI avec {{placeholders}}
└── README.md
```

## Principe d'export

```
Calcul OB (index.html)
       ↓
buildReportData()     → objet structuré
       ↓
exportRapportWord()   → charge modele-rapport-spsti.docx via fetch
       ↓                  (JSZip : dézip en mémoire)
Remplace {{ENTREPRISE}}, {{ADRESSE}}, etc.
       ↓
Injecte les tableaux OB + résultats + adéquation
       ↓
Re-zippe → télécharge le .docx final
```

Le document final conserve EXACTEMENT le modèle SPSTI :
logo, mise en page, en-têtes, pieds de page, sommaire, sections fixes.

## Modifier le template

1. Ouvrir `modele-rapport-spsti.docx` dans Word
2. Les zones dynamiques sont marquées `{{VARIABLE}}`
3. Modifier la mise en page / ajouter des sections normalement
4. Sauvegarder et re-committer

## Dépendance CDN

```html
<script src="https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js"></script>
```
