# 📋 Base Métiers — Santé au travail & prévention

> Outil PréventIA-LaB · Référentiel des suivis médicaux, risques professionnels, EPI et EPC par métier

## 🎯 À quoi ça sert

Référentiel exploitable pour :
- **Préparer une fiche d'entreprise** : identifier rapidement les risques typiques par poste
- **Préparer une consultation** : visualiser le suivi médical réglementaire pour un métier donné
- **Construire un DUERP** : croiser métier + catégorie de risque pour ne rien oublier
- **Sensibiliser les employeurs** : support pédagogique pour la visite d'entreprise

## 📦 Contenu

- **119 métiers** référencés sur **19 secteurs NAF** (A → S)
- **28 catégories de risque** détectées automatiquement (5 familles : chimique, biologique, physique, psychosocial, activité)
- **3 niveaux de suivi médical** : SIR (83) · SIA (22) · SI (14)

## 🆕 Conformité réglementaire (mai 2026)

- ✅ Décret n° 2025-355 du 18/04/2025 — sortie SIR caristes/électriciens (en vigueur 01/10/2025)
- ✅ Arrêté du 26/09/2025 — attestation d'absence de contre-indications médicales (validité 5 ans)
- ✅ Décret n° 2023-736 du 08/08/2023 — compétences vaccinales pharmaciens PUI
- ✅ Classification biologique R.4421-3 (groupes 1-2 vs 3-4)
- ✅ Catégories rayonnements ionisants A/B (R.4451-57)

## 🗂️ Fichiers

| Fichier | Description |
|---|---|
| `index.html` | Interface complète autonome (HTML + CSS + JS inline) |
| `metiers.json` | Données structurées pour réutilisation cross-outils |
| `README.md` | Cette documentation |

## 🔌 Intégration dans d'autres outils PréventIA-LaB

```javascript
// Charger la base depuis n'importe quel outil PréventIA-LaB
async function getMetiersData() {
  const res = await fetch('../base-metiers/metiers.json');
  return await res.json();
}

// Exemples d'usage cross-outils
const { metiers, categories_risque } = await getMetiersData();

// 1) ChimieRisk → suggérer les métiers exposés à un produit
const metiersExposes = metiers.filter(m => m.categories.includes('CMR'));

// 2) DUERP radar → préremplir les axes de risque pour un métier
const fiche = metiers.find(m => m.metier.includes('cariste'));
const axesRisque = fiche.categories;  // ['TMS','BRUIT','MECA','CONDUITE',...]

// 3) Évaluateur burnout → cibler les métiers RPS-sensibles
const metiersRPS = metiers.filter(m => m.categories.includes('RPS'));
```

## 🔄 Mise à jour

À actualiser lors de :
- Nouvelle parution réglementaire (décret, arrêté périodicités)
- Évolution classification CIRC (cancérogénicité)
- Mise à jour calendrier vaccinal professionnel
- Retour terrain : ajout de métiers spécifiques (saisonniers, plateformes, etc.)

## 📚 Sources réglementaires

- Code du travail : R.4624-10 et suivants (SI), R.4624-22 à R.4624-28 (SIR)
- INRS — ED 6140 (évaluation risques chimiques), ED 6253 (cytotoxiques), ED 6184 (espaces confinés)
- DGT — Guides d'application décret n° 2025-355
- Tableaux de Maladies Professionnelles (régime général + agricole)

## ⚖️ Avertissement

Ce référentiel est un **outil d'aide à la décision**. La décision finale du suivi médical relève du médecin du travail après évaluation des risques professionnels (EvRP) propre à chaque entreprise (Article L.4624-1 du Code du travail). Les catégories de risque détectées automatiquement ne préjugent pas de l'exposition réelle, qui doit être évaluée sur site.

---

**PréventIA-LaB** · Laure · IPRP SPSTI 23/87 · Limoges
