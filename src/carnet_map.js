// How each row of the carnet enters the network when no relation carries its id.
const CARNET_NOTES = {
  r03: { how: "qualitative", why: "Les lois ne distinguent pas passé et futur ; seule l'entropie le fait. Pas de nombre à relier." },
  r10: { how: "failure", why: "La règle B (égalité de chemins) ne donne pas une équation unique : elle n'est pas branchée." },
  r23: { how: "formula", why: "Les intensités des forces varient avec l'énergie : il faudrait leurs équations d'évolution." },
  r25: { how: "trivial", why: "+½ − ½ = 0 : zéro par construction, sans grandeur mesurée à relier." },
  r31: { how: "work", why: "Essai de Claude, pas une paire de la démarche : deux forces distinctes qui s'affrontent dans le noyau, sans s'annuler. Leur équilibre est repris dans le noyau (r47). La paire de l'électricité est lumière / électricité (r02, r28)." },
  r44: { how: "qualitative", why: "Les particules comme vibrations de champs : un cadre de lecture, pas une équation." },
  r45: { how: "formula", why: "Le pic du fer sort d'une formule à cinq termes (nuclear.py) ; sa limite de fission est branchée (r47)." },
  r48: { how: "qualitative", why: "Le quadrupôle faible et la forme de l'univers : une piste, pas une relation chiffrée." },
  r50: { how: "failure", why: "Aucun partenaire supersymétrique trouvé ; contourné par le comptage des pixels de surface." },
  r51: { how: "qualitative", why: "Un décompte de champs (Boyle et Turok), sans grandeur mesurée à relier." },
  r54: { how: "synthesis", why: "La synthèse des zéros et des restes : c'est la légende même de ce réseau." },
  r55: { how: "work", why: "Mis de côté : Anthony ne voit pas de limite possible." },
  r56: { how: "formula", why: "V² + D² ≤ 1 est une inégalité, pas une égalité." },
  r58: { how: "qualitative", why: "La symétrie CPT relie les restes entre eux, sans valeur à prédire." },
  r69: { how: "qualitative", why: "Le zéro de friction comme condition du cycle : une lecture, pas un calcul." },
  r70: { how: "qualitative", why: "La production d'entropie tend vers zéro : une tendance, pas une valeur." },
  r41: { how: "work", why: "Ce réseau lui-même." },
  r42: { how: "work", why: "Vérification des valeurs citées : faite pour toutes les valeurs de ce réseau." },
  r74: { how: "work", why: "Le premier réseau d'équations, dont celui-ci est la suite." },
};
const CARNET_HOW_LABEL = {
  branched: "branchée", qualitative: "qualitative", failure: "échec", formula: "autre forme d'équation",
  trivial: "zéro évident", synthesis: "synthèse", work: "ligne de travail",
};
