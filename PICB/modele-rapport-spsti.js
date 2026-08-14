/**
 * modele-rapport-spsti.js
 * ═══════════════════════════════════════════════════════════════
 * Contenu fixe du modèle de rapport SPSTI 23/87
 * « Estimation des niveaux sonores — Évaluation PICB »
 *
 * Ce fichier contient UNIQUEMENT le texte métier et réglementaire.
 * Pour modifier un paragraphe, une norme ou un seuil : c'est ici.
 * Le moteur de génération (exporteur-word.js) lit cet objet.
 *
 * PréventIA-LaB · SPSTI 23/87
 * ═══════════════════════════════════════════════════════════════
 */

/* global */
var MODELE_RAPPORT_SPSTI = (function () {
  "use strict";

  return {

    /* ── Identité du service ── */
    service: {
      nom: "SPSTI 23/87",
      adresse: "6, rue Voltaire CS 51223, 87065 LIMOGES CEDEX",
      siret: "778 069 005 00016",
      ape: "851 C",
      tel: "05 55 77 65 63",
      fax: "05 55 79 70 93"
    },

    /* ── Page de garde ── */
    garde: {
      kicker: "PRÉVENTIA-LAB · SANTÉ AU TRAVAIL",
      titre: "Estimation des niveaux sonores",
      sousTitre: "Évaluation des protections auditives (PICB)",
      methode: "Méthode par bandes d'octave (OB) · NF EN ISO 4869-2 · Calculette INRS PICB-VLE-V7.2"
    },

    /* ── 1. Déontologie ── */
    deontologie: {
      titre: "1. Les principes de déontologie",
      sections: [
        {
          titre: "Confidentialité",
          texte: "Les salariés du SPSTI 23-87 sont tenus au secret professionnel (articles 226-13 et 226-14 du code pénal) sur toutes les questions qu'ils seront amenés à connaître directement ou indirectement, en raison de leurs fonctions. Les salariés sont également tenus au secret de fabrication. Cette obligation implique la non-divulgation de toutes les informations auxquelles ils pourraient avoir accès concernant les domaines suivants (liste non exhaustive) : les dispositifs industriels, les techniques de fabrication, la composition des produits employés ou fabriqués, les données commerciales et financières..."
        },
        {
          titre: "Droit à l'image",
          texte: "La prise d'image requiert que le salarié soit informé des conditions d'utilisation des images produites et qu'il exprime son consentement. Ce dernier sera recueilli oralement par l'intervenant. Les copies d'images dans les rapports d'interventions réalisées par les salariés du SPSTI 23-87 doivent faire l'objet d'une modification dès lors que des personnes y figurent (visages masqués)."
        },
        {
          titre: "Cession des images",
          texte: "Les images réalisées dans le cadre des actions en milieu de travail par les salariés du SPSTI 23-87 ne peuvent être cédées, que ce soit à titre gracieux ou onéreux, sans accord explicite de l'entreprise et des personnes figurant sur les images. Elles ne peuvent être utilisées dans le cadre d'une exploitation différente et étrangère à l'objet pour lesquelles elles ont été produites."
        },
        {
          titre: "Clause de réserve",
          texte: "Les résultats du présent rapport ne peuvent en aucun cas revêtir un caractère d'expertise et être opposés à des tiers. Ils ne doivent faire de la part des destinataires l'objet d'aucune divulgation ou publication sans l'accord exprès du SPSTI 23-87."
        }
      ]
    },

    /* ── 2. Termes et définitions ── */
    termes: {
      titre: "2. Les termes et définitions",
      definitions: [
        { terme: "dB(A)",    def: "Unité de mesure des pressions acoustiques pondérée en fonction de la réception de l'oreille humaine qui est non linéaire en fréquence et en intensité." },
        { terme: "dB(C)",    def: "Unité de mesure des pressions acoustiques proche du décibel physique utilisée pour la mesure des pressions dites crêtes ; c'est-à-dire le maximum du signal sonore." },
        { terme: "LAeq,T",   def: "Valeur du niveau de pression acoustique continu équivalent pondéré A au cours d'une période donnée (T). On ramène, pendant une période de temps T, le niveau de pression acoustique variable d'un bruit industriel au niveau qu'il aurait eu pendant le même intervalle T, s'il avait été constant." },
        { terme: "Lp,C",     def: "Niveau de pression acoustique de crête. C'est la valeur maximale de la pression acoustique instantanée, mesurée avec la pondération fréquentielle C, au niveau de l'oreille du travailleur sans tenir compte du port éventuel d'une protection individuelle." },
        { terme: "LAeq,Te",  def: "Niveau de pression acoustique reçu pendant la durée effective de la journée de travail (par exemple 7 heures)." },
        { terme: "Lex,8h",   def: "Niveau de pression acoustique reçu (pondéré A) ramené à une journée de 8 heures, cela permet de comparer les niveaux entre eux." },
        { terme: "GEH",      def: "Groupe d'Exposition Homogène : groupe de travailleurs affectés à des fonctions de travail ou à des tâches similaires, qui les exposent à des niveaux de pressions acoustiques semblables." },
        { terme: "PICB",     def: "Protecteur Individuel Contre le Bruit." }
      ]
    },

    /* ── 3. La demande ── */
    demande: {
      titre: "3. La demande",
      texteIntro: "Le présent rapport de mesures a été établi à la demande de l'entreprise conformément à l'article R4433-2 du Décret n°2008-244 du 7 mars 2008 - art. (V) :",
      texteLoi: "L'évaluation des niveaux de bruit et, si nécessaire, leur mesurage sont planifiés et réalisés par des personnes compétentes, avec le concours, le cas échéant, du service de santé au travail. Ils sont réalisés à des intervalles appropriés, notamment lorsqu'une modification des installations ou des modes de travail est susceptible d'entraîner une élévation des niveaux de bruit. En cas de mesurage, celui-ci est renouvelé au moins tous les cinq ans.",
      texteObjectif: "L'objectif de l'évaluation des niveaux de bruit est d'évaluer de façon représentative l'exposition professionnelle au bruit en tenant compte de tous les niveaux de pression acoustique auxquels les salariés concernés sont habituellement exposés."
    },

    /* ── 4. Normes de références ── */
    normes: {
      titre: "4. Les normes de références",
      dosimetrie: [
        { ref: "NF EN 61672-1",    desc: "Electroacoustique ; Sonomètres - Partie 1 : spécifications" },
        { ref: "NF EN/CEI 60942",  desc: "Classe LS et Classe 1, Calibreurs acoustiques" },
        { ref: "NF S 31-084",      desc: "Acoustique ; Méthode de mesurage des niveaux d'exposition au bruit en milieu de travail, AFNOR (2002)." },
        { ref: "NF EN ISO 9612",   desc: "Acoustique - Détermination de l'exposition au bruit en milieu de travail - Méthode d'expertise, AFNOR (2009)." }
      ],
      sonometrie: [
        { ref: "NF EN ISO 4869-2", desc: "Protecteurs individuels contre le bruit. - Partie 2 : estimation des niveaux de pression acoustique pondérés A en cas d'utilisation de protecteurs individuels contre le bruit." }
      ]
    },

    /* ── 5. Matériel utilisé (configurable par SPSTI) ── */
    materiel: {
      titre: "5. Le matériel utilisé",
      exposimetres: {
        modele: "Exposimètres ACOEM WED-730",
        quantite: 3,
        series: [
          { numero: "A10367", etalonnage: "21/12/2023" },
          { numero: "A10368", etalonnage: "21/12/2023" },
          { numero: "A10369", etalonnage: "21/12/2023" }
        ],
        calibreur: { numero: "105225", etalonnage: "21/12/2023" }
      },
      sonometre: {
        modele: "Sonomètre intégrateur 01 dB type « FUSION Analyzer »",
        serie: "13096",
        etalonnage: "10/07/2023",
        calibreur: { numero: "105224", etalonnage: "13/08/2024" }
      },
      logiciel: "ACOEM dBTRAIT v 6.x.",
      microphone: {
        position: "Fixé au vêtement du travailleur, sur l'épaule, orienté au-dessus de l'épaule.",
        cote: "Du côté de l'oreille la plus exposée à environ 0.04 m",
        contrainte: "Le microphone doit être fixé de manière que l'influence mécanique (frottements) ou la couverture par les vêtements ne fausse pas les résultats."
      }
    },

    /* ── Seuils réglementaires ── */
    seuils: {
      reference: "Décret n°2006-892 du 19 juillet 2006 · Art. R.4431-1 à R.4437-4 du Code du travail · Directive 2003/10/CE.",
      tableau: [
        {
          seuil: "Valeur d'action inférieure",
          lex: "80 dB(A)",
          lpc: "135 dB(C)",
          obligation: "Information, formation, mise à disposition des PICB"
        },
        {
          seuil: "Valeur d'action supérieure",
          lex: "85 dB(A)",
          lpc: "137 dB(C)",
          obligation: "Port du PICB obligatoire, programme de réduction du bruit"
        },
        {
          seuil: "Valeur limite d'exposition",
          lex: "87 dB(A)",
          lpc: "140 dB(C)",
          obligation: "Jamais dépassable — PICB pris en compte"
        }
      ]
    },

    /* ── Indicateurs qualité d'évaluation ── */
    indicateurs: {
      titre: "Les indicateurs de qualité d'évaluation",
      texteIntro: "Lorsque le mesurage est terminé, il est recommandé de valider la représentativité des mesurages en comparant les conditions réelles de mesurage à ce qui avait été prévu initialement.",
      checklistEntreprise: [
        "Vérifier que toutes les entités concernées ont fait l'objet de mesurages",
        "S'assurer que toutes les fonctions ont fait l'objet de mesurages",
        "Contrôler que les groupes ayant fait l'objet de mesurages sont représentatifs de l'ensemble de l'effectif",
        "S'assurer que la période d'observation est représentative d'une période normale de fonctionnement"
      ],
      checklistGEH: [
        "S'assurer que la production est représentative de la production moyenne",
        "Vérifier si le plan de mesurage a été respecté",
        "Vérifier si les évènements acoustiques détectés ont été effectivement mesurés",
        "S'assurer que les postes voisins éventuellement bruyants fonctionnaient lors des mesurages"
      ]
    },

    /* ── Validation ── */
    validation: {
      titre: "Validation du rapport d'intervention",
      texteIntro: "Validation du rapport d'intervention par l'Intervenant en Prévention des Risques Professionnels et le Médecin du Travail avant restitution de l'étude à l'entreprise :"
    },

    /* ── Pied de page / disclaimer ── */
    footer: {
      disclaimer: "Document généré par PréventIA-LaB — outil d'aide à l'évaluation des protections auditives. Les résultats reposent sur les données saisies et les fiches techniques fabricants. Une mesure d'atténuation in situ reste recommandée.",
      analysePrecision: "Analyse IPRP enrichie — les sections précédentes reproduisent strictement la méthode OB de la calculette INRS PICB-VLE V7.2. L'analyse d'adéquation ci-dessous, les seuils de classification (CONFORME / VIGILANCE / NON CONFORME) et les préconisations numérotées constituent une lecture complémentaire de l'IPRP signataire (référentiels INRS ED 868 et bonnes pratiques métier). Elles ne figurent pas dans la calculette officielle."
    }
  };
})();
