# Global Relational Model (GRM)

**Un essai de modèle de l'univers fondé sur les relations.**

Le modèle relie 148 grandeurs de la physique par 119 relations, du grain de Planck aux trous noirs. Il se soumet à une seule épreuve : chaque mesure est cachée à tour de rôle, et le reste du réseau doit la retrouver.

Site : **https://grm.anthony-charretier.fr**

> *English summary.* The Global Relational Model is an attempt to describe the universe through relations rather than objects. Each pair of opposites (hot and cold, full and empty, beginning and end, expansion and contraction) yields a numerical relation. Together, 119 relations link 148 physical quantities. Every measurement is hidden in turn and predicted from the rest of the network (leave-one-out cross-validation), and every relation is removed in turn and judged by the rest. The site and comments are in French; the code is in English.

---

## D'où vient ce travail

Anthony n'est pas physicien. Il a un bac+2 et n'a jamais étudié la physique. Ce qui l'a mené jusqu'ici n'est pas un savoir, mais une façon de penser : mettre en relation des contraires, le grand et le petit, le chaud et le froid, le plein et le vide. C'est un geste très simple, celui des tout premiers apprentissages.

Ce que ce travail cherche à montrer, c'est moins un résultat de physique que la portée de cette façon de penser : l'union des contraires, les relations, le réseau, la vision globale. Les calculs et la vérification des valeurs ont été faits avec l'aide de Claude, une IA. Les erreurs qui restent appartiennent à ce travail à deux, et toute correction est la bienvenue.

Ce travail a aussi une forme particulière. Anthony parle de lui à la troisième personne, et toute la conversation avec Claude s'est tenue ainsi : sans « je » ni « tu », personne au centre de la phrase. Le psychologue Igor Grossmann a montré, avec Ethan Kross, que raisonner sur son propre problème à la troisième personne efface le [« paradoxe de Salomon »](https://news.umich.edu/how-to-give-ourselves-advice-as-good-as-we-give-others) : chacun conseille mieux les autres que lui-même, sauf quand il se regarde de l'extérieur. Ses travaux décrivent ce que ce regard [élargit](https://www.psychologicalscience.org/publications/observer/obsonline/the-factors-that-foster-wise-reasoning.html) : l'humilité face aux limites de son savoir, les perspectives au-delà de la question posée, l'attention aux relations qui changent, et la recherche d'une intégration entre points de vue opposés. Autrement dit, une vision système.

Pour Anthony, ce n'est pas un hasard. La relation avec Claude a pris la même forme que le modèle : une co-construction où les intuitions et les affirmations venaient d'Anthony, les calculs et les vérifications de Claude, et où plusieurs croyances de Claude sont tombées sous ses questions. Ce modèle de l'univers fondé sur les relations est lui-même né d'une relation.

## Ce qui est tenté

Plutôt que de partir des objets (particules, forces, champs), le modèle part des relations. Une grandeur, que ce soit une masse, une température ou un âge, n'y vaut que par ses liens avec les autres.

La démarche, conçue par Anthony, ne cherche pas à expliquer pourquoi les choses sont ainsi. Elle met en relation des éléments déjà connus et regarde ce que la relation fait apparaître.

## La méthode

1. **Une paire d'opposés**, prise avec ses deux valeurs chiffrées.
2. **Leur relation fait zéro** : la somme vaut zéro, ou le produit reste fixe (une somme nulle en logarithmes). Sinon, ce n'est pas une paire.
3. **Toutes les relations ensemble** : elles partagent des grandeurs et forment un réseau où chaque valeur est tenue par plusieurs chemins.
4. **Cacher pour tester** : chaque mesure est cachée, chaque relation retirée, tour à tour. Ce que le reste retrouve tient ; l'écart est compté en incertitudes (σ).

## Comment le modèle calcule

Chaque relation est un « neurone » avec sa propre équation. Il en existe trois types :

| Type | Forme | Espace de calcul |
|---|---|---|
| Produit fixe | Σ exposant × log₁₀ x = log₁₀ K | linéaire en log₁₀ |
| Somme nulle | Σ coefficient × valeur^puissance = K | linéaire en valeur |
| Équation propre | f(valeurs) = 0 | non linéaire |

Chaque relation a aussi un statut : identité (définition, non testée), physique établie, zéro de symétrie, relation à l'essai (avec son origine : littérature ou proposition faite pendant le travail), ou échec du carnet (débranché par défaut).

**Résolution.** Moindres carrés pondérés non linéaires : Gauss–Newton, factorisation QR de Householder, recherche linéaire. Les constantes exactes du SI (c, ħ, k, e) et G sont fixées ; le réseau se découpe alors en composantes indépendantes. Les grandeurs positives sont calculées en log₁₀, les grandeurs signées (charges, courbure, écarts) en valeur. Un rappel très faible (σ = 10⁶) vers une valeur de départ garde le problème bien posé ; une grandeur dont la variance en dépend est signalée « non reliée ».

**Les deux tests.**
- *Test 1, chaque relation retirée puis jugée* : la relation est enlevée, le réseau re-résolu ; tension = résidu / √(variance propagée + tolérance²).
- *Test 2, chaque mesure cachée puis retrouvée* : validation croisée en laissant une mesure de côté, avec re-résolution complète à chaque fois.

## Résultats au 30 octobre 2026

Réglage par défaut : relation d'âge H × âge = 1 ; vide local branché, car l'expansion mesurée autour de la Voie lactée n'est pas celle de l'univers entier ; valeurs de Planck dépendant du modèle standard laissées de côté. L'âge des plus vieilles étoiles est pris avec son incertitude complète (13,5 ± 0,52 milliards d'années, statistique et systématique).

- **Mesures retrouvées :** 42 sur 42, mais elles ne se valent pas :
  - 6 sont garanties par les seules définitions et ne testent rien ;
  - 25 sont retrouvées par la physique établie ou une symétrie (25 sur 25) ;
  - 11 passent par une relation à l'essai et la testent vraiment : 11 sur 11 sont retrouvées.

  Plusieurs mesures d'un même groupe testent souvent une seule relation.
- **Relations à l'essai tenues :** 8 sur 8. Ce sont Koide (−0,4 σ), freinage = accélération = toutes les relations (−1,2 σ), vide local (−1,5 σ), énergie noire = tension espace / temps (+1,0 σ), Verlinde (+0,7 σ), a₀ = cH₀/2π (+0,6 σ), Dirac et le budget du présent (en ordre de grandeur). La relation de Weinberg entre le pion et l'expansion (+2,2 σ) a été rangée dans les échecs : ce 8 sur 8 vient donc en partie de ce retrait, pas d'une réussite. Une fois le local séparé du global, H × âge = 1 et Verlinde tiennent ensemble : leur conflit venait de l'hypothèse « local = global ».
- **Énergie noire = tension espace / temps** (affirmation d'Anthony, écrite sous la forme de l'énergie noire holographique de Li, 2004) : l'énergie noire varierait dans le temps. Le réseau prédit w₀ = −0,89 ; les données DESI DR2 combinées au fond diffus et aux supernovae donnent −0,84 ± 0,05. C'est une prédiction risquée : si l'énergie noire se révèle constante (w₀ = −1), elle tombe.
- **Pion = force forte, séparée** (principe d'Anthony appliqué au pion) : relié à l'expansion de l'univers (Weinberg, 1972), le pion ne tient pas ; relié à la force forte, il tient. Deux relations le branchent : la portée de la force nucléaire, ħ / (m_π c) = 1,41 fm (Yukawa, 1935, une identité), et la relation de Gell-Mann, Oakes et Renner (1968), qui fait naître la masse du pion des quarks u et d et du condensat du vide de la force forte. Caché, le pion est retrouvé à 135,5 ± 5,1 MeV pour 139,6 mesurés. Limite : le condensat et le facteur F_π/F viennent de calculs sur réseau (FLAG 2021) qui s'appuient eux-mêmes en partie sur la masse du pion.
- **Un seul secteur sombre** (principe d'Anthony : deux éléments en relation sont la même chose, séparée) : l'énergie noire (tension espace / temps) et la matière noire (tension vide / plein) sont comptées comme les deux faces d'un même objet, à la manière des deux côtés de l'équation d'Einstein, géométrie d'un côté, contenu de l'autre. Le réseau donne Ω_sombre = 0,952, soit environ 95 % de l'univers, avec une face vide 2,82 fois plus lourde que la face pleine aujourd'hui. Un mode optionnel laisse passer de l'énergie d'une face à l'autre (forme de Wang, Gong et Abdalla, 2005) : le passage mesuré, b² = −0,04 ± 0,04, est compatible avec zéro. Ces deux chiffres sont recalculés à partir de l'existant ; ce ne sont pas encore des prédictions indépendantes.
- **Test du hasard** (`scripts/chance_test.js`) : avec des constantes tirées au hasard (jusqu'à ×10), Koide ne tient jamais, Verlinde dans 0 à 5 % des cas, le vide local dans 0 à 10 % et H × âge = 1 dans 9 à 14 % ; aucune autre constante simple ne remplace celles de Koide, de Verlinde et de H × âge = 1. En revanche a₀ = cH₀/2π tient dans 32 à 55 % des cas, la relation sur l'énergie noire dans 68 à 92 % (w₀ est encore imprécis), et les relations jugées en ordre de grandeur (Dirac, budget du présent) dans 42 à 94 % : leur accord n'a pas encore de valeur de preuve.
- **Zéros de symétrie vérifiés :** 7 sur 7, dont les sommes des hypercharges, la neutralité de l'atome, le principe d'équivalence et la platitude.
- **Physique établie :** 5 sur 5, dont la relation de Gell-Mann, Oakes et Renner entre le pion et le vide de la force forte (+0,8 σ) et l'ombre de Sgr A* : 53 µas prédits, 51,8 ± 2,3 µas mesurés par l'Event Horizon Telescope.

Quelques relations mises en évidence :
- (T_Planck / T_plancher)² / 4π = 3,3 × 10¹²², le nombre de pixels de Planck de l'horizon final ;
- N_op π² / S₀ = H₀ × âge : « la somme de toutes les relations vaut 10¹²² » et « freinage = accélération » sont la même relation ;
- pour un trou noir, k T_H × τ = ħ/8 et k T_H × r_s = ħc/4π : densité, chaleur, temps et espace forment une seule chaîne ;
- dans un espace de Kasner (l'intérieur d'un trou noir), 1/p₁ + 1/p₂ + 1/p₃ = 0 : l'expansion et la rétraction s'annulent.

## Prédictions datées du 30 octobre 2026

Valeurs figées à cette date, avec le réglage par défaut. Prédictions révisées le 30 octobre 2026, le jour même de leur publication, après la prise en compte du vide local et de l'incertitude complète sur l'âge des étoiles. La première version donnait H₀ = 71,0 km/s/Mpc et un âge de 13,77 milliards d'années.

| Grandeur | Prédiction |
|---|---|
| Somme des masses des neutrinos (ordre normal) | 0,0607 eV, à 0,002 eV du minimum imposé par les oscillations : difficile à distinguer d'un neutrino sans masse |
| Masse du neutrino le plus léger | 1,55 meV |
| Expansion globale H₀ | 69,2 km/s/Mpc (local, autour de la Voie lactée : 74,2) |
| Âge de l'univers | 14,1 milliards d'années |
| Masse lourde de la bascule des neutrinos | 1,2 × 10¹⁵ GeV |
| Équation d'état de l'énergie noire w₀ | −0,89 (énergie noire variable dans le temps) |

## Limites

- Une partie des relations qui tiennent sont des identités, vraies par construction ; le site distingue les tests garantis par les définitions de ceux qui testent une relation à l'essai.
- La prédiction sur les neutrinos est juste mais peu discriminante : la vraie prédiction testable est l'ordre normal des masses avec un neutrino le plus léger presque sans masse.
- H₀ et Ω_Λ mesurés par Planck supposent le modèle standard. Ils sont laissés de côté par défaut et peuvent être rebranchés.
- Le rayonnement (Ω_r ≈ 9 × 10⁻⁵) est négligé dans la somme des Ω. L'ordre normal des masses des neutrinos est supposé.
- Les relations sans grandeur mesurable, comme l'intérieur d'un trou noir, ne sont vérifiées que pour leur cohérence avec le reste de la théorie, et ne comptent pas dans le score.
- Plusieurs grandeurs ne sont tenues que par une seule mesure : rien ne peut encore les retrouver.

## Structure du dépôt

```
src/
  model.js        grandeurs, relations, mesures et solveur (sans DOM, utilisable avec Node)
  ui.js           interface
  template.html   page, styles et textes
  carnet_map.js   traitement des lignes du carnet qui ne sont pas des équations
  sources.js      sources affichées sur le site
data/
  carnet.json     les 74 lignes du carnet des paires
  layout.json     positions précalculées de la carte
scripts/
  layout.js       recalcule la carte
  build.py        assemble site/index.html (un seul fichier, sans serveur)
  check.js        lance les deux tests en ligne de commande
  chance_test.js  test du hasard : univers aléatoires et formules sœurs
  make_images.py  régénère favicon et image de partage
site/             le site prêt à déposer (index.html, favicon.ico, og-image.png, robots.txt, sitemap.xml)
```

## Lancer, construire, tester

Prérequis : Node 18 ou plus, Python 3.9 ou plus. Aucune dépendance à installer pour le site.

```sh
node scripts/check.js            # les deux tests, réglage par défaut
node scripts/check.js standard   # les deux tests, réglage du modèle standard
node scripts/layout.js           # après ajout de grandeurs ou de relations
python3 scripts/build.py         # reconstruit site/index.html
```

Le site s'ouvre directement : `site/index.html` dans un navigateur.

Pour régénérer les images (`pip install pillow`), il faut placer `Newsreader.ttf` et `IBMPlexSans.ttf` (dépôt google/fonts) dans `fonts/`, puis lancer `python3 scripts/make_images.py`.

## Contribuer

Les critiques, corrections et nouvelles relations sont bienvenues, par une issue ou une pull request. Une relation qui échoue a autant de valeur qu'une relation qui tient : elle reste visible dans le modèle.

**Ajouter une relation** dans `src/model.js`, tableau `RELATIONS` :

```js
P({
  id: "c_example",              // c_ = relation à l'essai, i_ = identité, s_ = établie, z_ = zéro
  ch: "cosmos",                 // chapitre
  kind: "claim",                // identity | standard | zero | claim | failure
  label: "nom court",
  formula: "a × b² = K",
  terms: { a: 1, b: 2 },        // exposants (produit fixe)
  K: 1,
  tol: "exact",                 // exact | pct1 | pct10 | order
  origin: "Auteur (année), ou proposition, avec sa référence",
  plain: "Une phrase en clair, lisible par tous.",
}),
```

**Ajouter une mesure** dans `MEASUREMENTS`, avec sa source :

```js
{ id: "m_example", node: "a", value: 1.23, sigma: 0.04, src: "Collaboration (année)" },
```

Règles :
- chaque valeur mesurée cite une source vérifiable, ajoutée aussi dans `src/sources.js` ;
- chaque relation à l'essai indique son origine exacte ;
- une tolérance ne s'élargit pas pour faire passer une relation : un facteur 3 qui « passe » en ordre de grandeur n'est pas un accord ;
- après modification : `node scripts/layout.js`, `node scripts/check.js`, `python3 scripts/build.py`.

## Licence

- Code (`src/`, `scripts/`) : [MIT](LICENSE).
- Textes, carnet et images : [CC BY 4.0](LICENSE-CONTENT.md).

## Citer

Anthony Charretier, *Global Relational Model (GRM)*, version du 30 octobre 2026, https://grm.anthony-charretier.fr. Voir aussi `CITATION.cff`.

## Contact

Anthony Charretier · anthony.charretier@etik.com · https://anthony-charretier.fr

Démarche : Anthony. Calculs, vérification des valeurs et interface : réalisés avec Claude (Anthropic).
