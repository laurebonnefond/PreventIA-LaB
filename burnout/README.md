# SanensIA — Outils de prévention santé au travail

Outils interactifs pour IPRP, IST et professionnels de santé au travail.  
Développés dans le cadre du projet **SanensIA** — IA appliquée à la prévention des risques professionnels.

---

## Outils disponibles

| Outil | Description | Lien |
|-------|-------------|------|
| Évaluation burn-out | Questionnaire MBI 22 items, 6 dimensions, scoring automatique, recommandations INRS/HAS | [burnout/](./burnout/) |
| Calculette PICB (à venir) | Méthode OB INRS — Évaluation protections auditives | — |

---

## Accès en ligne (GitHub Pages)

Une fois GitHub Pages activé sur ce dépôt (branche `main`, dossier `/`) :

```
https://<votre-username>.github.io/sanensia-outils/burnout/
```

---

## Déploiement rapide

### 1. Créer le dépôt GitHub

```bash
git init sanensia-outils
cd sanensia-outils
git remote add origin https://github.com/<votre-username>/sanensia-outils.git
```

### 2. Copier les fichiers

```
sanensia-outils/
├── README.md
└── burnout/
    └── index.html
```

### 3. Pousser et activer GitHub Pages

```bash
git add .
git commit -m "feat: ajout outil évaluation burn-out"
git push -u origin main
```

Puis dans les **Settings** du dépôt GitHub :
→ Pages → Source : `main` / `/ (root)` → Save

L'URL est disponible dans les 2–3 minutes.

---

## Références scientifiques

- **MBI** — Maslach, C. & Jackson, S.E. (1996). *Maslach Burnout Inventory Manual*
- **INRS** — Dossier RPS et burn-out, ED 6140 (2015)
- **HAS** — Recommandations sur le syndrome d'épuisement professionnel (2017)
- **Karasek** — Modèle demande/contrôle (1979)
- **Siegrist** — Modèle effort/récompense (1996)

---

## Auteure

**Laure** — Infirmière en santé au travail, IPRP — Projet SanensIA  
Master IA DATA · IPSSI Bordeaux (nov. 2026)

---

> Ces outils sont des aides à la décision à usage professionnel.  
> Ils ne remplacent pas une évaluation clinique.  
> Données traitées localement — aucun envoi serveur.
