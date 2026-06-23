# PréventIA-LaB — Documentation technique

**Suite d'outils IA d'aide à la décision en santé au travail**
Conçue par Laure Bonnefond — Infirmière en santé au travail & IPRP (SPSTI 23/87)
Master IA, Big Data & Développement — IPSSI Bordeaux

---

## 1. Vue d'ensemble

PréventIA-LaB est une plateforme open source (GitHub Pages, HTML/CSS/JS vanilla) regroupant des outils d'évaluation des risques professionnels. Plusieurs outils utilisent l'IA (Claude d'Anthropic) via un proxy Make.com qui protège la clé API.

**URL de production :** https://laurebonnefond.github.io/PreventIA-LaB

**Charte graphique :** couleurs oklch (teal/navy/orange), polices DM Sans + DM Serif Display.

---

## 2. Structure du dépôt GitHub

```
PreventIA-LaB/
├── index.html                    → Page d'accueil (cartes par catégorie)
├── logo.png
├── hero-bg.jpg
│
├── PICB/
│   └── index.html                → Évaluation PICB + lecture sonométrie (VISION)
│
├── analyse-epi-epc/
│   └── index.html                → Analyse EPI/EPC par photo (VISION)
│
├── evaluation-tms/
│   └── index.html                → Évaluation TMS RULA/REBA (TEXTE)
│
├── risque-chimique/
│   └── index.html                → Évaluateur risque chimique / FDS (TEXTE)
│
├── burnout/
│   └── index.html                → Évaluation burn-out (MBI Maslach)
│
├── base-metiers/
│   └── index.html                → Base de données 119 métiers
│
└── quizz/
    ├── index.html
    ├── quiz-bruit-industriel.html
    ├── quiz-risque-chimique.html
    └── quiz-risques-metiers.html
```

> ⚠️ À nettoyer : supprimer le fichier `evaluation-tms/html` (sans extension, créé par erreur).

---

## 3. Architecture des webhooks Make.com

L'IA n'est jamais appelée directement depuis le navigateur. Chaque requête passe par un **scénario Make.com** qui ajoute la clé API Anthropic côté serveur (jamais exposée à l'utilisateur).

### Deux types de scénarios

| Type | Usage | Outils concernés |
|------|-------|------------------|
| **VISION** | Analyse d'images (photo, capture) | PICB, EPI/EPC |
| **TEXTE** | Questions/prompts texte | Risque chimique, TMS, chatbot |

### Scénario VISION — PreventIA-Vision-V2

| Paramètre | Valeur |
|-----------|--------|
| Nom | PreventIA-Vision-V2 |
| Scenario ID | 6284620 |
| Webhook URL | `https://hook.eu1.make.com/y91ilwbt4jpfgt4m42gzurbbmolkxj2x` |
| Webhook UDID | `y91ilwbt4jpfgt4m42gzurbbmolkxj2x` |
| Token partagé | `previa_vision_2026_xxx` |
| Format envoyé | `{ token, payload }` où payload = JSON Anthropic pré-sérialisé |

**Structure du scénario (4 modules) :**
1. **Custom webhook** — reçoit la requête du navigateur
2. **Parse JSON** — structure `structure-vision-v2` avec 2 champs : `token` (Text) + `payload` (Text). JSON string = `{{1.value}}`
3. **HTTP — Make a request** — POST vers `https://api.anthropic.com/v1/messages`
   - Headers : `x-api-key`, `anthropic-version: 2023-06-01`, `Content-Type: application/json`
   - Body content type : application/json — Body input : JSON string — Body content : `{{2.payload}}`
4. **Webhook response** — Status 200, Body `{{3.data}}`, header content-type application/json

### Scénario TEXTE — chatbot

| Paramètre | Valeur |
|-----------|--------|
| Webhook (chimique actuel) | `https://hook.eu1.make.com/286lg39urqouoo6kta4vh8llxdf7n9fr` |
| Format chimique | `{ question }` |
| Format TMS | `{ prompt, rula }` |

> À harmoniser : idéalement un seul webhook texte pour chimique + TMS + chatbot.

---

## 4. Le pattern "Solution C" (côté navigateur)

Pour éviter que Make re-sérialise mal le JSON, le navigateur **pré-sérialise** le payload Anthropic en chaîne de caractères avant l'envoi :

```javascript
var body = JSON.stringify({
  token: WEBHOOK_TOKEN,
  payload: JSON.stringify(payloadAnthropic)   // ← double stringify volontaire
});
```

Make relaie ensuite `payload` tel quel à l'API. C'est ce qui rend `{{2.payload}}` directement utilisable dans le module HTTP.

---

## 5. État des outils

| Outil | Type | Webhook | Statut |
|-------|------|---------|--------|
| PICB | Vision | y91ilwbt | ✅ Fonctionnel |
| EPI/EPC | Vision | y91ilwbt | ✅ Corrigé, à tester en ligne |
| Risque chimique | Texte | 286lg39u | ⏳ Webhook texte à vérifier |
| TMS | Texte | à définir | ⏳ À brancher sur webhook texte |
| Burn-out | — | — | ✅ Pas d'IA (scoring local) |
| Base métiers | — | — | ✅ Pas d'IA (données locales) |
| Quiz (×3) | — | — | ✅ Pas d'IA |

---

## 6. Prise de photo mobile (PICB & EPI/EPC)

Les deux outils vision proposent désormais sur smartphone :
- **📷 Prendre une photo** → ouvre la caméra arrière (`capture="environment"`)
- **🖼️ Choisir un fichier** → ouvre la galerie / les fichiers
- **Drag and drop** → conservé sur ordinateur

> ⚠️ La caméra et l'appel à Make ne fonctionnent QUE sur le site déployé (GitHub Pages), pas dans un aperçu local ou en bac à sable. Toujours tester depuis l'URL `laurebonnefond.github.io`.

---

## 7. Sécurité

- **Clé API Anthropic** : stockée uniquement dans Make (module HTTP), jamais dans le code public. ✅
- **Filtre token** : un filtre entre les modules 2 et 3 vérifie `{{2.token}} = previa_vision_2026_xxx` pour bloquer les usages non autorisés du webhook.
- **Recommandation** : remplacer le token `previa_vision_2026_xxx` par une valeur plus robuste (ex. `spsti2387_picb_K7mN9pQ2`), identique dans le code ET dans le filtre Make.
- **localStorage** : l'URL du webhook est mémorisée par navigateur (clé `previa_picb_webhook`). Une valeur par défaut (`WEBHOOK_DEFAULT`) évite aux nouveaux utilisateurs de la saisir.

> ⚠️ Si tu partages un blueprint Make, retire toujours la clé API avant (remplace par `sk-ant-xxxxx`).

---

## 8. Procédure de déploiement

1. Sur GitHub, dépôt `PreventIA-LaB`
2. Pour chaque fichier modifié : **Add file → Upload files** (ou éditer directement)
3. Pour créer un dossier + fichier : **Add file → Create new file**, taper `dossier/index.html`
4. Commit
5. Attendre 1-2 min (rafraîchissement GitHub Pages)
6. Tester depuis `laurebonnefond.github.io/PreventIA-LaB` avec **Ctrl+F5** (vider le cache)

---

## 9. Tâches restantes

- [ ] Déployer PICB et EPI/EPC (versions avec boutons photo mobile)
- [ ] Tester EPI/EPC en ligne sur mobile
- [ ] Brancher TMS sur le webhook texte (vérifier format `{prompt, rula}`)
- [ ] Vérifier/réparer le webhook texte du risque chimique
- [ ] Renforcer le token de sécurité
- [ ] Supprimer le fichier `evaluation-tms/html` erroné

---

## 10. Dépannage rapide

| Symptôme | Cause probable | Solution |
|----------|----------------|----------|
| "Queue is full" | Mauvais module webhook (mailhook), ou scénario corrompu | Vérifier que module 1 = Custom webhook ; recréer si besoin |
| "jsonStringBodyContent empty" | payload vide en sortie du Parse JSON | Vérifier JSON string = `{{1.value}}` et structure token/payload |
| Console : ancienne URL appelée | URL en cache dans localStorage | Bouton "configurer le proxy" → coller la bonne URL → Enregistrer |
| Caméra ne s'ouvre pas | Test en aperçu local/sandbox | Tester sur l'URL GitHub Pages réelle |
| "Unexpected token Q" | Make renvoie du texte au lieu de JSON | Le scénario a échoué — inspecter le module en rouge dans History |

---

*Documentation générée le 22/06/2026.*
