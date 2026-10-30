// ===== Relation network: data and solver (no DOM) =====
// Every node is a quantity. Positive quantities live in log10 space ("log" nodes),
// signed quantities (charges, curvature, shifts) live in plain space ("lin" nodes).
// Every relation is a neuron with its own equation:
//   prod: sum(exponent * log10 x) = log10 K   (a fixed product, i.e. a zero sum in logarithms)
//   sum:  sum(coef * value^power) = K          (a zero sum in values)
//   fn:   any equation f(values) = 0           (an equation of its own, solved step by step)

const LN10 = Math.LN10;
const C0 = 299792458, E0 = 1.602176634e-19, HBAR0 = 1.054571817e-34;
const MPC = 3.0857e22, GYR = 3.15576e16, YEAR = 3.15576e7;
const L_MEV = Math.log10(C0 * C0 / (E0 * 1e6));      // kg -> MeV
const L_KMSMPC = Math.log10(MPC / 1e3);               // s^-1 -> km/s/Mpc
const L_GYR = -Math.log10(GYR);                        // s -> Gyr
const WIEN_B = 2.897771955e-3;                         // m K, exact in SI
const SIGMA_SB = 5.670374419e-8;                       // W m^-2 K^-4, exact in SI

const EXACT = 1e-7;            // tolerance of an identity, in the relation's own residual unit
const RIDGE_SIGMA = 1e6;       // very weak pull toward the starting guess, only to keep the problem well posed
const UNREACHABLE_VAR = 1e4;   // a variance above this means no path leads to the node

const TOL = { exact: EXACT, pct1: 0.0043, pct10: 0.0414, order: 0.5 };
const TOL_LABEL = { exact: "exacte", pct1: "à 1 % près", pct10: "à 10 % près", order: "en ordre de grandeur" };

const CHAPTERS = [
  { id: "grain", name: "Le grain", plain: "Les constantes de la nature et les unités de Planck, le plus petit grain possible." },
  { id: "light", name: "Lumière et matière", plain: "Comment la lumière tient l'électron à l'atome, et ce que pèsent les particules." },
  { id: "charges", name: "Charges et zéros", plain: "Les sommes nulles qui fixent les charges électriques et rendent l'atome neutre." },
  { id: "particles", name: "Particules", plain: "Le champ de Higgs, les bosons W et Z, les leptons, les neutrinos et le noyau." },
  { id: "cosmos", name: "Cosmos", plain: "L'expansion, l'âge, la matière noire et l'énergie noire, l'histoire chaude." },
  { id: "bounds", name: "Début et fin", plain: "Le plafond et le plancher, les pixels du contenant et le nombre 10¹²²." },
  { id: "notes", name: "Les notes", plain: "L'univers comme un tambour : sa note la plus grave, celle de la matière, leur milieu." },
  { id: "holes", name: "Trous noirs", plain: "La chaîne densité → chaleur → temps → espace, sur le trou noir du centre de la Voie lactée, et l'intérieur de Kasner." },
  { id: "life", name: "Le vivant", plain: "Le Soleil, la Terre et la durée du présent vécu." },
];

// ---------- Nodes ----------
// scale: "log" (value > 0) or "lin". base: unit of the stored value. unit + dispLog: what the page shows.
const NODES = [
  // Le grain
  { id: "c", ch: "grain", sym: "c", name: "vitesse de la lumière", unit: "m/s", guess: 2.998e8, plain: "La vitesse de la lumière, la même pour tous." },
  { id: "hbar", ch: "grain", sym: "ħ", name: "quantum d'action", unit: "J·s", guess: 1.0546e-34, plain: "Le plus petit « prix » d'un changement : rien ne se fait en dessous." },
  { id: "G", ch: "grain", sym: "G", name: "constante de gravitation", unit: "m³/(kg·s²)", guess: 6.674e-11, plain: "L'intensité de la gravité." },
  { id: "kB", ch: "grain", sym: "k", name: "constante de Boltzmann", unit: "J/K", guess: 1.3806e-23, plain: "Le pont entre température et énergie." },
  { id: "e", ch: "grain", sym: "e", name: "charge élémentaire", unit: "C", guess: 1.602e-19, plain: "La charge de l'électron, au signe près." },
  { id: "eps0", ch: "grain", sym: "ε₀", name: "permittivité du vide", unit: "F/m", guess: 8.854e-12, plain: "Ce que le vide oppose au champ électrique." },
  { id: "mu0", ch: "grain", sym: "μ₀", name: "perméabilité du vide", unit: "N/A²", guess: 1.2566e-6, plain: "Ce que le vide oppose au champ magnétique." },
  { id: "lP", ch: "grain", sym: "l_P", name: "longueur de Planck", unit: "m", guess: 1.616e-35, plain: "La plus petite longueur qui ait un sens : là où quantique, gravité et lumière se rejoignent." },
  { id: "tP", ch: "grain", sym: "t_P", name: "temps de Planck", unit: "s", guess: 5.39e-44, plain: "Le plus petit instant : le temps que met la lumière à traverser une longueur de Planck." },
  { id: "mP", ch: "grain", sym: "m_P", name: "masse de Planck", unit: "kg", guess: 2.176e-8, plain: "La masse où gravité et quantique ont le même poids, environ 22 microgrammes." },
  { id: "EP", ch: "grain", sym: "E_P", name: "énergie de Planck", unit: "J", guess: 1.956e9, plain: "L'énergie de la masse de Planck." },
  { id: "TP", ch: "grain", sym: "T_P", name: "plafond de température", unit: "K", guess: 1.417e32, plain: "Le chaud absolu : au-delà, la physique connue ne s'applique plus." },
  // Lumière et matière
  { id: "alpha", ch: "light", sym: "α", name: "constante de structure fine", unit: "", guess: 7.297e-3, plain: "L'intensité de la lumière qui lie l'électron au noyau, environ 1/137." },
  { id: "me", ch: "light", sym: "m_e", name: "masse de l'électron", unit: "MeV", dispLog: L_MEV, guess: 0.511, plain: "La masse de l'électron." },
  { id: "mp", ch: "light", sym: "m_p", name: "masse du proton", unit: "MeV", dispLog: L_MEV, guess: 938.27, plain: "La masse du proton, 1 836 fois celle de l'électron." },
  { id: "mS", ch: "light", sym: "m_S", name: "masse de Stoney", unit: "kg", guess: 1.86e-9, plain: "La masse où l'attraction de gravité égale la répulsion électrique de deux charges élémentaires." },
  { id: "N", ch: "light", sym: "N", name: "masse de Planck / proton", unit: "", guess: 1.3e19, plain: "Combien de protons font une masse de Planck." },
  { id: "re", ch: "light", sym: "r_e", name: "rayon classique de l'électron", unit: "m", guess: 2.818e-15, plain: "La taille qu'aurait l'électron si toute sa masse venait de sa charge." },
  { id: "Ry", ch: "light", sym: "Ry", name: "énergie de Rydberg", unit: "eV", guess: 13.6057, plain: "L'énergie qui lie l'électron dans l'atome d'hydrogène (noyau supposé immobile)." },
  { id: "RyH", ch: "light", sym: "Ry_H", name: "énergie de liaison de l'hydrogène", unit: "eV", guess: 13.598, plain: "La même, en tenant compte du léger recul du proton." },
  { id: "lyA", ch: "light", sym: "Lyα", name: "raie Lyman alpha", unit: "nm", dispLog: 9, guess: 121.567, plain: "La couleur (ultraviolette) de la lumière émise quand l'électron tombe du 2ᵉ au 1ᵉʳ niveau." },
  { id: "Egam", ch: "light", sym: "E_γ", name: "photon d'annihilation", unit: "keV", dispLog: -3, guess: 511, plain: "L'énergie de chacun des deux photons nés quand un électron rencontre un positron." },
  { id: "ly", ch: "light", sym: "a.l.", name: "année-lumière", unit: "m", guess: 9.461e15, plain: "La distance parcourue par la lumière en un an." },
  { id: "Fratio", ch: "light", sym: "F_e/F_g", name: "électricité / gravité entre deux électrons", unit: "", guess: 4.17e42, plain: "Combien de fois la répulsion électrique de deux électrons dépasse leur attraction de gravité." },
  // Charges et zéros
  { id: "YQ", ch: "charges", sym: "Y_Q", name: "hypercharge des quarks gauches", unit: "", scale: "lin", guess: 1 / 6, plain: "Le « B » des quarks gauches : sert de référence aux autres." },
  { id: "Yu", ch: "charges", sym: "Y_u", name: "hypercharge du quark u droit", unit: "", scale: "lin", guess: 2 / 3, plain: "Le « B » du quark u droit." },
  { id: "Yd", ch: "charges", sym: "Y_d", name: "hypercharge du quark d droit", unit: "", scale: "lin", guess: -1 / 3, plain: "Le « B » du quark d droit." },
  { id: "YL", ch: "charges", sym: "Y_L", name: "hypercharge des leptons gauches", unit: "", scale: "lin", guess: -1 / 2, plain: "Le « B » de l'électron et du neutrino gauches." },
  { id: "Ye", ch: "charges", sym: "Y_e", name: "hypercharge de l'électron droit", unit: "", scale: "lin", guess: -1, plain: "Le « B » de l'électron droit." },
  { id: "Qu", ch: "charges", sym: "Q_u", name: "charge du quark u", unit: "e", scale: "lin", guess: 2 / 3, plain: "La charge électrique du quark u." },
  { id: "Qd", ch: "charges", sym: "Q_d", name: "charge du quark d", unit: "e", scale: "lin", guess: -1 / 3, plain: "La charge électrique du quark d." },
  { id: "Qe", ch: "charges", sym: "Q_e", name: "charge de l'électron", unit: "e", scale: "lin", guess: -1, plain: "La charge électrique de l'électron." },
  { id: "Qnu", ch: "charges", sym: "Q_ν", name: "charge du neutrino", unit: "e", scale: "lin", guess: 0, plain: "La charge électrique du neutrino." },
  { id: "Qp", ch: "charges", sym: "Q_p", name: "charge du proton", unit: "e", scale: "lin", guess: 1, plain: "La charge du proton : deux quarks u et un quark d." },
  { id: "Qn", ch: "charges", sym: "Q_n", name: "charge du neutron", unit: "e", scale: "lin", guess: 0, plain: "La charge du neutron : un quark u et deux quarks d." },
  { id: "Qatom", ch: "charges", sym: "Q_H", name: "charge de l'atome d'hydrogène", unit: "e", scale: "lin", guess: 0, plain: "Proton plus électron : la neutralité de la matière." },
  { id: "etaEP", ch: "charges", sym: "η_EP", name: "écart masse inerte / masse pesante", unit: "× 10⁻¹⁵", scale: "lin", guess: 0, plain: "La différence entre la masse qui résiste au mouvement et celle qui tombe." },
  // Particules
  { id: "v", ch: "particles", sym: "v", name: "champ de Higgs dans le vide", unit: "GeV", guess: 246.22, plain: "La valeur que le champ de Higgs garde partout, même dans le vide." },
  { id: "mH", ch: "particles", sym: "m_H", name: "masse du boson de Higgs", unit: "GeV", guess: 125.2, plain: "La masse du boson de Higgs, découvert en 2012." },
  { id: "lamH", ch: "particles", sym: "λ", name: "terme +λ du potentiel de Higgs", unit: "", guess: 0.129, plain: "Le terme qui retient le champ (le fond du bol)." },
  { id: "muH", ch: "particles", sym: "μ", name: "terme −μ² du potentiel de Higgs", unit: "GeV", guess: 88.5, plain: "Le terme qui pousse le champ hors de zéro." },
  { id: "mW", ch: "particles", sym: "m_W", name: "masse du boson W", unit: "GeV", guess: 80.36, plain: "La masse du boson W, porteur de la force faible." },
  { id: "mZ", ch: "particles", sym: "m_Z", name: "masse du boson Z", unit: "GeV", guess: 91.19, plain: "La masse du boson Z." },
  { id: "cosW", ch: "particles", sym: "cos θ", name: "cosinus de l'angle de mélange", unit: "", guess: 0.8813, plain: "Comment W³ et B se mélangent pour donner le photon et le Z." },
  { id: "s2W", ch: "particles", sym: "sin² θ", name: "sinus² de l'angle de mélange", unit: "", scale: "lin", guess: 0.2233, plain: "L'autre face du même mélange." },
  { id: "thetaW", ch: "particles", sym: "θ", name: "angle de mélange", unit: "°", scale: "lin", guess: 28.2, plain: "L'angle de la rotation entre W³ et B." },
  { id: "mmu", ch: "particles", sym: "m_μ", name: "masse du muon", unit: "MeV", dispLog: L_MEV, guess: 105.658, plain: "Le muon, un électron 207 fois plus lourd." },
  { id: "mtau", ch: "particles", sym: "m_τ", name: "masse du tau", unit: "MeV", dispLog: L_MEV, guess: 1776.9, plain: "Le tau, le plus lourd des trois." },
  { id: "mpi", ch: "particles", sym: "m_π", name: "masse du pion", unit: "MeV", dispLog: L_MEV, guess: 139.57, plain: "La particule qui porte la force forte entre protons et neutrons." },
  { id: "mu_q", ch: "particles", sym: "m_u", name: "masse du quark u", unit: "MeV", dispLog: L_MEV, guess: 2.16, plain: "La masse propre du quark u." },
  { id: "md_q", ch: "particles", sym: "m_d", name: "masse du quark d", unit: "MeV", dispLog: L_MEV, guess: 4.7, plain: "La masse propre du quark d." },
  { id: "fq", ch: "particles", sym: "f_q", name: "part des quarks dans le proton", unit: "%", dispLog: 2, guess: 0.961, plain: "La part de la masse du proton qui vient des quarks eux-mêmes ; le reste vient du champ fort." },
  { id: "dQCD", ch: "particles", sym: "Δ_fort", name: "part forte de l'écart neutron − proton", unit: "MeV", scale: "lin", guess: 2.52, plain: "Ce que la force forte (et le quark d plus lourd) ajoute au neutron." },
  { id: "dQED", ch: "particles", sym: "Δ_élec", name: "part électrique de l'écart neutron − proton", unit: "MeV", scale: "lin", guess: -1.0, plain: "Ce que l'électricité ajoute au proton chargé." },
  { id: "dmnp", ch: "particles", sym: "m_n − m_p", name: "écart de masse neutron − proton", unit: "MeV", scale: "lin", guess: 1.293, plain: "Le neutron est un peu plus lourd : c'est pour cela que l'hydrogène est stable." },
  { id: "d21", ch: "particles", sym: "Δm²₂₁", name: "écart de masse² des neutrinos 1 et 2", unit: "eV²", guess: 7.49e-5, plain: "Mesuré par les oscillations des neutrinos du Soleil et des réacteurs." },
  { id: "d31", ch: "particles", sym: "Δm²₃₁", name: "écart de masse² des neutrinos 1 et 3", unit: "eV²", guess: 2.534e-3, plain: "Mesuré par les oscillations des neutrinos de l'atmosphère et des accélérateurs." },
  { id: "m1", ch: "particles", sym: "m₁", name: "neutrino le plus léger", unit: "meV", dispLog: 3, guess: 1.5, plain: "La seule masse de neutrino encore inconnue." },
  { id: "m2", ch: "particles", sym: "m₂", name: "neutrino du milieu", unit: "meV", dispLog: 3, guess: 8.8, plain: "Déduit de m₁ et de Δm²₂₁." },
  { id: "m3", ch: "particles", sym: "m₃", name: "neutrino le plus lourd", unit: "meV", dispLog: 3, guess: 50.4, plain: "Déduit de m₁ et de Δm²₃₁." },
  { id: "Snu", ch: "particles", sym: "Σm_ν", name: "somme des masses des neutrinos", unit: "eV", guess: 0.0607, plain: "Ce que mesurent les grands relevés de galaxies (DESI)." },
  { id: "M", ch: "particles", sym: "M", name: "masse lourde de la bascule", unit: "GeV", guess: 1.2e15, plain: "Le partenaire très lourd qui rendrait le neutrino si léger." },
  { id: "aS", ch: "particles", sym: "a_S", name: "énergie de surface du noyau", unit: "MeV", guess: 18.3, plain: "Ce que coûtent les nucléons du bord, moins liés." },
  { id: "aC", ch: "particles", sym: "a_C", name: "répulsion électrique dans le noyau", unit: "MeV", guess: 0.714, plain: "Ce que coûte la répulsion entre protons." },
  { id: "Z2A", ch: "particles", sym: "Z²/A", name: "limite de fission", unit: "", guess: 51, plain: "Au-delà, un noyau se brise sans barrière." },
  // Cosmos
  { id: "H0", ch: "cosmos", sym: "H₀", name: "expansion de l'univers (globale)", unit: "km/s/Mpc", dispLog: L_KMSMPC, guess: 70, plain: "La vitesse d'expansion de l'univers dans son ensemble, aujourd'hui." },
  { id: "H0loc", ch: "cosmos", sym: "H₀ local", name: "expansion mesurée autour de la Voie lactée", unit: "km/s/Mpc", dispLog: L_KMSMPC, guess: 73, plain: "La même vitesse, mesurée sur les galaxies proches." },
  { id: "t0", ch: "cosmos", sym: "âge", name: "âge de l'univers", unit: "milliards d'années", dispLog: L_GYR, guess: 13.6, plain: "Le temps écoulé depuis le début chaud." },
  { id: "wb", ch: "cosmos", sym: "ω_b", name: "densité physique de matière ordinaire", unit: "", guess: 0.02237, plain: "Ce que le fond diffus mesure directement de la matière ordinaire (Ω_b h²)." },
  { id: "wc", ch: "cosmos", sym: "ω_n", name: "densité physique de matière noire", unit: "", guess: 0.12, plain: "La même chose pour la matière noire (Ω_n h²)." },
  { id: "OB", ch: "cosmos", sym: "Ω_b", name: "part de matière ordinaire", unit: "", guess: 0.047, plain: "La part de l'univers faite d'atomes." },
  { id: "ODM", ch: "cosmos", sym: "Ω_n", name: "part de matière noire", unit: "", guess: 0.25, plain: "La part de l'univers faite de matière invisible." },
  { id: "Om", ch: "cosmos", sym: "Ω_m", name: "part de matière totale", unit: "", guess: 0.3, plain: "Matière ordinaire et matière noire ensemble." },
  { id: "OL", ch: "cosmos", sym: "Ω_Λ", name: "part d'énergie noire", unit: "", guess: 0.7, plain: "La part de l'univers qui accélère l'expansion." },
  { id: "OK", ch: "cosmos", sym: "Ω_K", name: "courbure de l'univers", unit: "", scale: "lin", guess: 0, plain: "Zéro si l'univers est plat." },
  { id: "Hend", ch: "cosmos", sym: "H_fin", name: "expansion finale", unit: "km/s/Mpc", dispLog: L_KMSMPC, guess: 58, plain: "Le rythme vers lequel tend l'expansion quand il ne reste que l'énergie noire." },
  { id: "Rh", ch: "cosmos", sym: "R_H", name: "rayon de Hubble", unit: "m", guess: 1.3e26, plain: "La distance où l'expansion atteint la vitesse de la lumière." },
  { id: "EH", ch: "cosmos", sym: "E_H", name: "énergie de la sphère de Hubble", unit: "J", guess: 8e69, plain: "Toute l'énergie contenue dans cette sphère." },
  { id: "Rs", ch: "cosmos", sym: "R_S", name: "rayon de trou noir de cette énergie", unit: "m", guess: 1.3e26, plain: "Le rayon qu'aurait un trou noir de même masse." },
  { id: "a0", ch: "cosmos", sym: "a₀", name: "accélération des galaxies", unit: "m/s²", guess: 1.1e-10, plain: "En dessous de cette accélération, les étoiles du bord des galaxies tournent trop vite." },
  { id: "delta", ch: "cosmos", sym: "δ", name: "sous-densité du vide local (KBC)", unit: "", scale: "lin", guess: 0.46, plain: "La région autour de la Voie lactée serait 46 % moins dense que la moyenne." },
  { id: "eta", ch: "cosmos", sym: "η", name: "rapport matière / lumière", unit: "", guess: 6.1e-10, plain: "Combien de protons pour un photon : la trace de la victoire de la matière sur l'antimatière." },
  { id: "p1", ch: "holes", sym: "p₁", name: "rythme de la direction qui se contracte", unit: "", scale: "lin", guess: -1 / 3, plain: "Dans un univers de Kasner, la direction qui se rétracte (ici, à l'intérieur d'un trou noir)." },
  { id: "p2", ch: "holes", sym: "p₂", name: "rythme d'une direction qui s'étire", unit: "", scale: "lin", guess: 2 / 3, plain: "Une des deux directions qui s'étirent." },
  { id: "p3", ch: "holes", sym: "p₃", name: "rythme de l'autre direction qui s'étire", unit: "", scale: "lin", guess: 2 / 3, plain: "L'autre direction qui s'étire." },
  { id: "MS", ch: "holes", sym: "M_Sgr", name: "masse de Sgr A*", unit: "millions de masses solaires", dispLog: -Math.log10(1.98847e36), guess: 4.3, plain: "Le trou noir au centre de la Voie lactée, pesé par les orbites des étoiles qui tournent autour." },
  { id: "DS", ch: "holes", sym: "D_Sgr", name: "distance de Sgr A*", unit: "kpc", dispLog: -Math.log10(3.0857e19), guess: 8.28, plain: "La distance du Soleil au centre de la Galaxie." },
  { id: "rsS", ch: "holes", sym: "r_s", name: "rayon de l'horizon de Sgr A*", unit: "km", dispLog: -3, guess: 1.27e7, plain: "La frontière d'où rien ne ressort." },
  { id: "rhoS", ch: "holes", sym: "ρ_Sgr", name: "densité moyenne de Sgr A*", unit: "kg/m³", guess: 1e6, plain: "Sa masse divisée par le volume de son horizon : environ mille fois l'eau." },
  { id: "THS", ch: "holes", sym: "T_H", name: "chaleur de Sgr A* (Hawking)", unit: "K", guess: 1.4e-14, plain: "La température que l'horizon rayonne, d'autant plus froide que le trou noir est lourd." },
  { id: "tauS", ch: "holes", sym: "τ", name: "temps maximal à l'intérieur", unit: "s", guess: 66, plain: "Le temps le plus long qu'un objet puisse vivre entre l'horizon et le centre." },
  { id: "shS", ch: "holes", sym: "ombre", name: "taille de l'ombre de Sgr A*", unit: "µas", dispLog: Math.log10(206264.806e6), guess: 53, plain: "L'angle sous lequel l'ombre du trou noir apparaît depuis la Terre." },
  { id: "w0", ch: "cosmos", sym: "w₀", name: "équation d'état de l'énergie noire", unit: "", scale: "lin", guess: -0.9, plain: "Vaut −1 si l'énergie noire est constante ; s'en écarte si elle varie dans le temps." },
  { id: "Odark", ch: "cosmos", sym: "Ω_sombre", name: "secteur sombre, un seul objet", unit: "", guess: 0.95, plain: "Énergie noire et matière noire comptées ensemble, comme les deux faces d'une même chose." },
  { id: "darkRatio", ch: "cosmos", sym: "Ω_Λ / Ω_n", name: "face vide / face pleine", unit: "", guess: 3, plain: "Combien la face « énergie noire » pèse par rapport à la face « matière noire » aujourd'hui." },
  { id: "b2", ch: "cosmos", sym: "b²", name: "échange entre énergie noire et matière", unit: "", scale: "lin", guess: 0, plain: "Zéro si l'énergie noire et la matière n'échangent rien ; positif si l'énergie noire en cède à la matière." },
  { id: "Tcmb", ch: "cosmos", sym: "T_fond", name: "température du fond diffus", unit: "K", guess: 2.7255, plain: "La température de la plus vieille lumière, aujourd'hui." },
  { id: "zp1", ch: "cosmos", sym: "1 + z*", name: "étirement depuis la libération de la lumière", unit: "", guess: 1090.9, plain: "Combien de fois l'univers s'est étiré depuis que la lumière s'est libérée." },
  { id: "Trec", ch: "cosmos", sym: "T*", name: "température quand la lumière s'est libérée", unit: "K", guess: 2973, plain: "La température de l'univers quand les atomes se sont formés." },
  { id: "theta", ch: "cosmos", sym: "θ*", name: "taille angulaire de l'horizon sonore", unit: "rad", guess: 1.0411e-2, plain: "L'angle sous lequel on voit la plus grande onde sonore de l'univers jeune." },
  { id: "lA", ch: "cosmos", sym: "ℓ_A", name: "pas entre les pics acoustiques", unit: "", guess: 301.8, plain: "L'écart entre deux harmoniques du fond diffus." },
  { id: "Tfr", ch: "cosmos", sym: "T_gel", name: "température du gel des neutrons", unit: "MeV", guess: 1, plain: "Quand neutrons et protons cessent de se transformer l'un en l'autre." },
  { id: "tfr", ch: "cosmos", sym: "t_gel", name: "instant du gel des neutrons", unit: "s", guess: 0.74, plain: "L'âge de l'univers à ce moment." },
  { id: "TD", ch: "cosmos", sym: "T_D", name: "température de formation des noyaux", unit: "MeV", guess: 0.1, plain: "Quand le deutérium cesse d'être brisé par la lumière." },
  { id: "tD", ch: "cosmos", sym: "t_D", name: "instant de formation des noyaux", unit: "s", guess: 130, plain: "L'âge de l'univers quand les premiers noyaux se forment." },
  { id: "zturn", ch: "cosmos", sym: "z_bascule", name: "décalage de la bascule freinage → accélération", unit: "", scale: "lin", guess: 0.63, plain: "Quand la matière ne suffit plus à freiner l'expansion." },
  { id: "tturn", ch: "cosmos", sym: "il y a (bascule)", name: "bascule freinage → accélération", unit: "milliards d'années", dispLog: L_GYR, guess: 6.1, plain: "Il y a combien de temps l'expansion a commencé à accélérer." },
  { id: "teq", ch: "cosmos", sym: "il y a (égalité)", name: "égalité matière / énergie noire", unit: "milliards d'années", dispLog: L_GYR, guess: 3.5, plain: "Il y a combien de temps les deux densités étaient égales." },
  // Début et fin
  { id: "Tfloor", ch: "bounds", sym: "T_min", name: "plancher de température", unit: "K", guess: 2.2e-30, plain: "La température la plus basse que l'univers puisse avoir : celle de son horizon final." },
  { id: "S", ch: "bounds", sym: "S", name: "pixels du contenant", unit: "k", guess: 3e122, plain: "Le nombre de pixels de Planck sur la surface de l'horizon final : son entropie maximale." },
  { id: "rhoL", ch: "bounds", sym: "ρ_Λ", name: "densité d'énergie noire", unit: "J/m³", guess: 5.5e-10, plain: "L'énergie noire contenue dans un mètre cube." },
  { id: "Edark", ch: "bounds", sym: "E_n", name: "échelle de l'énergie noire", unit: "meV", dispLog: 3, guess: 2.2, plain: "L'énergie noire ramenée à une énergie de particule." },
  { id: "Emid", ch: "bounds", sym: "E_mil", name: "axe de la sinusoïde", unit: "meV", dispLog: 3, guess: 3.8, plain: "Le milieu entre le plus grand quantum (Planck) et le plus petit (le cadre)." },
  { id: "Estock", ch: "bounds", sym: "E_stock", name: "stock d'énergie noire de l'horizon final", unit: "J", guess: 1e70, plain: "Toute l'énergie noire contenue dans l'horizon final." },
  { id: "stockEP", ch: "bounds", sym: "E_stock / E_P", name: "stock en énergies de Planck", unit: "", guess: 5e60, plain: "Ce stock compté en énergies de Planck." },
  { id: "pixRatio", ch: "bounds", sym: "pixel × surface", name: "énergie d'un pixel de volume × pixels de surface", unit: "E_P", guess: 1.5, plain: "Ce produit vaut une énergie de Planck et demie." },
  { id: "vacRatio", ch: "bounds", sym: "ρ_P / ρ_Λ", name: "énergie du vide prédite / mesurée", unit: "", guess: 8.8e122, plain: "L'écart célèbre entre la théorie quantique et la mesure." },
  { id: "Nops", ch: "bounds", sym: "N_op", name: "nombre maximal de changements d'état", unit: "", guess: 2e121, plain: "Combien de « relations » l'univers a pu accomplir depuis le début." },
  { id: "S0", ch: "bounds", sym: "S₀", name: "pixels de l'horizon d'aujourd'hui", unit: "k", guess: 2e122, plain: "Le nombre de pixels de Planck sur la surface de l'horizon actuel (rayon c/H₀)." },
  { id: "allRatio", ch: "bounds", sym: "N_op π² / S₀", name: "toutes les relations / pixels d'aujourd'hui", unit: "", guess: 1, plain: "Vaut 1 si la somme de toutes les relations égale les pixels du contenant, comptés sur le même horizon." },
  { id: "ageP2", ch: "bounds", sym: "(âge / t_P)²", name: "l'âge compté en temps de Planck, au carré", unit: "", guess: 6e121, plain: "Un autre chemin vers 10¹²²." },
  { id: "Lmid", ch: "bounds", sym: "L_mil", name: "longueur du milieu", unit: "mm", dispLog: 3, guess: 0.047, plain: "Le milieu entre la longueur de Planck et le rayon de Hubble." },
  { id: "Ldark", ch: "bounds", sym: "L_n", name: "longueur de l'énergie noire", unit: "mm", dispLog: 3, guess: 0.088, plain: "La longueur d'onde associée à l'échelle de l'énergie noire." },
  { id: "Equant", ch: "bounds", sym: "kT_min", name: "quantum de chaleur du plancher", unit: "J", guess: 3e-53, plain: "La plus petite chaleur que garde l'horizon final." },
  { id: "E0ratio", ch: "bounds", sym: "½ħH / kT_min", name: "vibration de repos / chaleur du plancher", unit: "", guess: 3.14, plain: "Le cadre ne peut jamais être immobile : ce rapport vaut exactement π." },
  { id: "mHub", ch: "bounds", sym: "m_H", name: "masse de Hubble", unit: "eV", guess: 1.2e-33, plain: "La plus petite masse que l'horizon final puisse distinguer." },
  { id: "Emin", ch: "bounds", sym: "E_min", name: "énergie minimale d'une relation longue comme l'âge", unit: "J", guess: 6e-52, plain: "Le prix minimal d'un changement qui dure tout l'âge de l'univers." },
  // Les notes
  { id: "fH", ch: "notes", sym: "f_cadre", name: "note fondamentale du cadre", unit: "Hz", guess: 2.9e-19, plain: "La vibration la plus grave possible : une période de 110 milliards d'années." },
  { id: "oct", ch: "notes", sym: "octaves", name: "octaves sous le la 440", unit: "", scale: "lin", guess: 70, plain: "Combien de fois il faut diviser le la du diapason par deux pour l'atteindre." },
  { id: "fe", ch: "notes", sym: "f_e", name: "note propre de l'électron", unit: "Hz", guess: 1.2e20, plain: "La fréquence de la masse de l'électron : sa note plancher." },
  { id: "fp", ch: "notes", sym: "f_p", name: "note propre du proton", unit: "Hz", guess: 2.3e23, plain: "La fréquence de la masse du proton." },
  { id: "fmid", ch: "notes", sym: "f_mil", name: "note du milieu", unit: "Hz", guess: 255, plain: "Le milieu entre la note du proton et celle du cadre : près du do du piano." },
  { id: "Emq", ch: "notes", sym: "h·f_mil", name: "quantum de la note du milieu", unit: "eV", guess: 1e-12, plain: "L'énergie d'un grain de cette note." },
  { id: "Nlam", ch: "notes", sym: "R / λ", name: "longueurs d'onde du fond diffus dans l'horizon", unit: "", guess: 1.6e29, plain: "Combien de vagues de la plus vieille lumière tiennent dans l'horizon final." },
  { id: "tlife", ch: "notes", sym: "durée de vie", name: "durée de vie de la lumière", unit: "milliards d'années", dispLog: L_GYR, guess: 1200, plain: "Le temps qu'il faut à l'expansion pour étirer cette lumière à la taille de l'horizon." },
  // Le vivant
  { id: "Tsun", ch: "life", sym: "T_☉", name: "température du Soleil", unit: "K", guess: 5772, plain: "La température de la surface du Soleil." },
  { id: "Rsun", ch: "life", sym: "R_☉", name: "rayon du Soleil", unit: "m", guess: 6.957e8, plain: "Le rayon du Soleil." },
  { id: "AU", ch: "life", sym: "UA", name: "distance Terre – Soleil", unit: "m", guess: 1.496e11, plain: "La distance moyenne de la Terre au Soleil." },
  { id: "albedo", ch: "life", sym: "A", name: "albédo de la Terre", unit: "", scale: "lin", guess: 0.29, plain: "La part de lumière que la Terre renvoie sans l'absorber." },
  { id: "Tearth", ch: "life", sym: "T_⊕", name: "température d'émission de la Terre", unit: "K", guess: 255, plain: "La température à laquelle la Terre rayonne vers l'espace." },
  { id: "Nph", ch: "life", sym: "photons sortis / entrés", name: "photons renvoyés pour un reçu", unit: "", guess: 22.6, plain: "Pour la même énergie, la Terre renvoie environ 23 photons froids pour 1 photon chaud reçu : c'est ce qui permet le vivant." },
  { id: "Snow", ch: "life", sym: "S_act", name: "entropie actuelle de l'univers", unit: "k", guess: 3e104, plain: "Le désordre présent, surtout dans les trous noirs." },
  { id: "used", ch: "life", sym: "S_act / S", name: "part du potentiel déjà utilisée", unit: "", guess: 1e-18, plain: "La part de l'entropie maximale que l'univers a déjà produite." },
  { id: "tPresent", ch: "life", sym: "présent", name: "durée du présent vécu", unit: "s", guess: 3, plain: "La fenêtre de quelques secondes que la perception vit comme « maintenant »." },
];
NODES.forEach(n => { n.scale = n.scale || "log"; n.dispLog = n.dispLog || 0; });

// ---------- Relations ----------
// kind: identity (definition, not tested) | standard (established physics) | zero (a symmetry, sum = 0)
//       | claim (a relation under test, with its origin) | failure (tested and failed, unplugged by default)
// type: prod | sum | fn. res: "dex" (log10 ratio) or "abs".
const P = (o) => ({ type: "prod", res: "dex", ...o });
const S = (o) => ({ type: "sum", res: "abs", ...o });
const F = (o) => ({ type: "fn", res: "dex", ...o });
const lg = Math.log10;
const lcdmAge = (H, OL, a) => {  // age at scale factor a, flat matter + Lambda, in s
  const Om = 1 - OL;
  return 2 / (3 * H * Math.sqrt(OL)) * Math.asinh(Math.sqrt(OL / Om) * Math.pow(a, 1.5));
};

const RELATIONS = [
  // Le grain
  P({ id: "i_lP", ch: "grain", kind: "identity", label: "longueur de Planck", formula: "l_P = √(ħG / c³)", terms: { lP: 1, hbar: -0.5, G: -0.5, c: 1.5 }, K: 1, carnet: "r57", plain: "Le quantique (ħ), la gravité (G) et la lumière (c) donnent ensemble une seule longueur." }),
  P({ id: "i_tP", ch: "grain", kind: "identity", label: "temps de Planck", formula: "t_P = l_P / c", terms: { tP: 1, lP: -1, c: 1 }, K: 1, plain: "Le plus petit instant est le temps que la lumière met à traverser le plus petit pas." }),
  P({ id: "i_mP", ch: "grain", kind: "identity", label: "masse de Planck", formula: "m_P = √(ħc / G)", terms: { mP: 1, hbar: -0.5, c: -0.5, G: 0.5 }, K: 1, plain: "La masse où la gravité devient aussi forte que le quantique." }),
  P({ id: "i_EP", ch: "grain", kind: "identity", label: "énergie de Planck", formula: "E_P = m_P c²", terms: { EP: 1, mP: -1, c: -2 }, K: 1, plain: "Masse et énergie sont la même chose, à c² près." }),
  P({ id: "i_TP", ch: "grain", kind: "identity", label: "plafond", formula: "T_P = E_P / k", terms: { TP: 1, EP: -1, kB: 1 }, K: 1, carnet: "r72", plain: "Le plafond de température est l'énergie de Planck traduite en chaleur." }),
  P({ id: "i_c", ch: "grain", kind: "identity", label: "électricité / magnétisme", formula: "c = 1 / √(ε₀ μ₀)", terms: { c: 1, eps0: 0.5, mu0: 0.5 }, K: 1, carnet: "r02", plain: "La vitesse de la lumière naît de la relation entre le champ électrique et le champ magnétique." }),
  // Lumière et matière
  P({ id: "i_alpha", ch: "light", kind: "identity", label: "électricité / lumière", formula: "α = e² / (4π ε₀ ħ c)", terms: { alpha: 1, e: -2, eps0: 1, hbar: 1, c: 1 }, K: 1 / (4 * Math.PI), carnet: "r28", plain: "La force qui tient l'électron, mesurée sans unité : environ 1/137." }),
  P({ id: "i_stoney", ch: "light", kind: "identity", label: "masse de Stoney", formula: "m_S = √α · m_P", terms: { mS: 1, alpha: -0.5, mP: -1 }, K: 1, carnet: "r27", plain: "La masse où électricité et gravité s'équilibrent entre deux charges élémentaires." }),
  P({ id: "i_N", ch: "light", kind: "identity", label: "N", formula: "N = m_P / m_p", terms: { N: 1, mP: -1, mp: 1 }, K: 1, carnet: "r32", plain: "Le nombre qui sépare le grain de Planck du proton." }),
  P({ id: "i_re", ch: "light", kind: "identity", label: "rayon de l'électron", formula: "r_e = α ħ / (m_e c)", terms: { re: 1, alpha: -1, hbar: -1, me: 1, c: 1 }, K: 1, plain: "La taille qu'aurait l'électron si sa masse venait de sa charge." }),
  P({ id: "i_Ry", ch: "light", kind: "identity", label: "liaison de l'atome", formula: "Ry = α² m_e c² / 2", terms: { Ry: 1, alpha: -2, me: -1, c: -2, e: 1 }, K: 0.5, carnet: "r28", plain: "La lumière (α) et la masse de l'électron fixent l'énergie qui tient l'atome." }),
  F({ id: "i_RyH", ch: "light", kind: "identity", label: "recul du proton", formula: "Ry_H = Ry / (1 + m_e / m_p)", nodes: ["RyH", "Ry", "me", "mp"], f: v => lg(v.RyH) - lg(v.Ry / (1 + v.me / v.mp)), plain: "Le proton recule un peu sous l'électron : la liaison diminue d'un deux-millième." }),
  F({ id: "i_lyA", ch: "light", kind: "identity", label: "raie Lyman alpha", formula: "λ = 4hc / (3 Ry_H)", nodes: ["lyA", "RyH", "hbar", "c", "e"], f: v => lg(v.lyA) - lg(4 * 2 * Math.PI * v.hbar * v.c / (3 * v.RyH * v.e)), sigma: 3e-5, plain: "La couleur de la raie se déduit de l'énergie de liaison (à la structure fine près, 0,005 %)." }),
  P({ id: "i_Egam", ch: "light", kind: "identity", label: "matière / antimatière", formula: "E_γ = m_e c²", terms: { Egam: 1, me: -1, c: -2, e: 1 }, K: 1, carnet: "r20", plain: "Un électron et un positron se changent en deux photons de lumière, chacun de 511 keV." }),
  P({ id: "i_ly", ch: "light", kind: "identity", label: "espace / temps", formula: "1 a.l. = c × 1 an", terms: { ly: 1, c: -1 }, K: YEAR, carnet: "r01", plain: "c²t² − x² = 0 : pour la lumière, l'espace parcouru et le temps écoulé se compensent." }),
  P({ id: "i_Fratio", ch: "light", kind: "identity", label: "électricité / gravité", formula: "F_e / F_g = α ħ c / (G m_e²)", terms: { Fratio: 1, alpha: -1, hbar: -1, c: -1, G: 1, me: 2 }, K: 1, carnet: "r19", plain: "Entre deux électrons, l'électricité est 10⁴² fois plus forte que la gravité." }),
  // Charges et zéros
  S({ id: "z_grav", ch: "charges", kind: "zero", label: "somme des B (gravité)", formula: "6Y_Q + 2Y_L − 3Y_u − 3Y_d − Y_e = 0", terms: { YQ: 6, YL: 2, Yu: -3, Yd: -3, Ye: -1 }, K: 0, carnet: "r22", plain: "Les hypercharges d'une génération s'annulent : sinon la gravité ne serait pas cohérente avec la matière." }),
  S({ id: "z_cube", ch: "charges", kind: "zero", label: "somme des B au cube", formula: "6Y_Q³ + 2Y_L³ − 3Y_u³ − 3Y_d³ − Y_e³ = 0", terms: { YQ: 6, YL: 2, Yu: -3, Yd: -3, Ye: -1 }, pow: 3, K: 0, carnet: "r22", plain: "La même somme, au cube, s'annule aussi. Ces deux zéros fixent les charges." }),
  S({ id: "z_su2", ch: "charges", kind: "zero", label: "zéro de la force faible", formula: "3Y_Q + Y_L = 0", terms: { YQ: 3, YL: 1 }, K: 0, carnet: "r43", plain: "Quarks et leptons gauches se compensent face à la force faible." }),
  S({ id: "z_su3", ch: "charges", kind: "zero", label: "zéro de la force forte", formula: "2Y_Q − Y_u − Y_d = 0", terms: { YQ: 2, Yu: -1, Yd: -1 }, K: 0, carnet: "r43", plain: "Les quarks gauches et droits se compensent face à la force forte." }),
  S({ id: "i_Qu", ch: "charges", kind: "identity", label: "charge = T₃ + Y (u)", formula: "Q_u = ½ + Y_Q", terms: { Qu: 1, YQ: -1 }, K: 0.5, carnet: "r30", plain: "La charge électrique naît de deux autres charges : l'isospin faible et l'hypercharge." }),
  S({ id: "i_Qd", ch: "charges", kind: "identity", label: "charge = T₃ + Y (d)", formula: "Q_d = −½ + Y_Q", terms: { Qd: 1, YQ: -1 }, K: -0.5, carnet: "r30", plain: "Même règle pour le quark d." }),
  S({ id: "i_Qe", ch: "charges", kind: "identity", label: "charge = T₃ + Y (électron)", formula: "Q_e = −½ + Y_L", terms: { Qe: 1, YL: -1 }, K: -0.5, carnet: "r30", plain: "Même règle pour l'électron." }),
  S({ id: "i_Qnu", ch: "charges", kind: "identity", label: "charge = T₃ + Y (neutrino)", formula: "Q_ν = ½ + Y_L", terms: { Qnu: 1, YL: -1 }, K: 0.5, carnet: "r30", plain: "Même règle : le neutrino sort neutre." }),
  S({ id: "i_Qp", ch: "charges", kind: "identity", label: "charge du proton", formula: "Q_p = 2Q_u + Q_d", terms: { Qp: 1, Qu: -2, Qd: -1 }, K: 0, plain: "Le proton : deux quarks u et un quark d." }),
  S({ id: "i_Qn", ch: "charges", kind: "identity", label: "charge du neutron", formula: "Q_n = Q_u + 2Q_d", terms: { Qn: 1, Qu: -1, Qd: -2 }, K: 0, plain: "Le neutron : un quark u et deux quarks d." }),
  S({ id: "z_atom", ch: "charges", kind: "zero", label: "charge positive / négative", formula: "Q_H = Q_p + Q_e = 0", terms: { Qatom: 1, Qp: -1, Qe: -1 }, K: 0, carnet: "r29", plain: "Le proton et l'électron se compensent exactement : l'atome est neutre." }),
  S({ id: "z_EP", ch: "charges", kind: "zero", label: "masse inerte / masse pesante", formula: "η_EP = 0", terms: { etaEP: 1 }, K: 0, carnet: "r49", plain: "Tout tombe de la même façon : c'est ce qui fait de la gravité une courbure de l'espace-temps." }),
  // Particules
  P({ id: "i_lamH", ch: "particles", kind: "identity", label: "potentiel de Higgs (+λ)", formula: "λ = m_H² / (2v²)", terms: { lamH: 1, mH: -2, v: 2 }, K: 0.5, carnet: "r52", plain: "La masse du Higgs et la valeur du champ fixent le terme qui retient le champ." }),
  P({ id: "i_muH", ch: "particles", kind: "identity", label: "potentiel de Higgs (−μ²)", formula: "v = μ / √λ", terms: { v: 1, muH: -1, lamH: 0.5 }, K: 1, carnet: "r52", plain: "Les deux termes opposés du potentiel s'équilibrent à v = 246 GeV." }),
  P({ id: "i_cosW", ch: "particles", kind: "identity", label: "W³ / B", formula: "cos θ = m_W / m_Z", terms: { cosW: 1, mW: -1, mZ: 1 }, K: 1, carnet: "r21", plain: "Le rapport des masses du W et du Z donne l'angle de mélange." }),
  S({ id: "i_s2W", ch: "particles", kind: "identity", label: "cos² + sin² = 1", formula: "sin² θ = 1 − cos² θ", terms: { s2W: 1, cosW: 1 }, pow: { cosW: 2 }, K: 1, carnet: "r24", plain: "Les deux faces du mélange se complètent." }),
  F({ id: "i_thetaW", ch: "particles", kind: "identity", res: "abs", label: "angle de mélange", formula: "θ = arccos(m_W / m_Z)", nodes: ["thetaW", "cosW"], f: v => v.thetaW - Math.acos(v.cosW) * 180 / Math.PI, plain: "L'angle lui-même, environ 28°." }),
  F({ id: "c_koide", origin: "Formule de Yoshio Koide (1981), reprise dans le carnet.", ch: "particles", kind: "claim", res: "abs", label: "électron / muon / tau (Koide)", formula: "(m_e + m_μ + m_τ) / (√m_e + √m_μ + √m_τ)² = 2/3", nodes: ["me", "mmu", "mtau"], f: v => (v.me + v.mmu + v.mtau) / Math.pow(Math.sqrt(v.me) + Math.sqrt(v.mmu) + Math.sqrt(v.mtau), 2) - 2 / 3, carnet: "r26", tol: "exact", note: "Formule trouvée par Yoshio Koide en 1981 ; aucune théorie ne l'explique encore.", plain: "Les trois leptons chargés tiendraient dans un rapport exact de 2/3." }),
  F({ id: "i_fq", ch: "particles", kind: "identity", label: "masse (force forte) / quarks", formula: "f_q = (2m_u + m_d) / m_p", nodes: ["fq", "mu_q", "md_q", "mp"], f: v => lg(v.fq) - lg((2 * v.mu_q + v.md_q) / v.mp), carnet: "r40", plain: "Les quarks ne font qu'environ 1 % de la masse du proton : le reste est l'énergie du champ fort." }),
  S({ id: "s_np", ch: "particles", kind: "standard", label: "neutron / proton", formula: "m_n − m_p = Δ_fort + Δ_élec", terms: { dmnp: 1, dQCD: -1, dQED: -1 }, K: 0, carnet: "r46", note: "Les deux parts viennent du calcul sur réseau de Borsanyi et al. (2015).", plain: "Deux contributions de signe opposé : la force forte alourdit le neutron, l'électricité alourdit le proton." }),
  F({ id: "i_m2", ch: "particles", kind: "identity", label: "neutrino 2", formula: "m₂ = √(m₁² + Δm²₂₁)", nodes: ["m2", "m1", "d21"], f: v => lg(v.m2) - 0.5 * lg(v.m1 * v.m1 + v.d21), plain: "Les oscillations donnent les écarts entre les masses, pas les masses elles-mêmes." }),
  F({ id: "i_m3", ch: "particles", kind: "identity", label: "neutrino 3", formula: "m₃ = √(m₁² + Δm²₃₁)", nodes: ["m3", "m1", "d31"], f: v => lg(v.m3) - 0.5 * lg(v.m1 * v.m1 + v.d31), plain: "Même règle pour le plus lourd (ordre normal des masses)." }),
  S({ id: "i_Snu", ch: "particles", kind: "identity", label: "somme des neutrinos", formula: "Σ = m₁ + m₂ + m₃", terms: { Snu: 1, m1: -1, m2: -1, m3: -1 }, K: 0, plain: "La somme que mesurent les relevés de galaxies." }),
  P({ id: "c_seesaw", origin: "Mécanisme de bascule (seesaw) de la physique des neutrinos, repris dans le carnet.", ch: "particles", kind: "claim", label: "bascule (seesaw)", formula: "m₃ × M = v²", terms: { m3: 1, M: 1, v: -2 }, K: 1e9, carnet: "r38", tol: "exact", note: "m₃ en eV, M et v en GeV.", plain: "Le neutrino serait léger parce qu'un partenaire très lourd se tient de l'autre côté de la balançoire." }),
  P({ id: "c_ruleA", origin: "Règle A (le milieu géométrique), posée par Claude dans le carnet pour chercher des cibles.", ch: "particles", kind: "claim", label: "règle A : milieu chaud / froid", formula: "m₁ = √(E_P · k T_min)", terms: { m1: 2, EP: -1, kB: -1, Tfloor: -1, e: 2 }, K: 1, carnet: "r33", tol: "exact", plain: "Le neutrino le plus léger se tiendrait au milieu exact de l'énergie la plus chaude et de la plus froide." }),
  P({ id: "f_ruleA2", origin: "Premier essai de la règle A, posé par Claude.", ch: "particles", kind: "failure", label: "milieu énergie noire / électron", formula: "m₁ = √(E_n · m_e c²)", terms: { m1: 2, Edark: -1, me: -1, c: -2, e: 1 }, K: 1, carnet: "r34", tol: "exact", plain: "Premier essai de la règle A : il donnait 34 eV, exclu par les mesures." }),
  P({ id: "c_weinberg", origin: "Relation remarquée par Steven Weinberg (1972), proposée par Claude comme candidat pour H.", ch: "particles", kind: "claim", label: "gravité / matière (Weinberg)", formula: "m_π³ = ħ² H₀ / (G c)", terms: { mpi: 3, hbar: -2, H0: -1, G: 1, c: 1 }, K: 1, carnet: "r73", tol: "order", note: "Relation remarquée par Steven Weinberg (1972) entre le pion et l'expansion.", plain: "La masse d'une particule de la force forte serait liée à l'expansion de tout l'univers." }),
  P({ id: "i_Z2A", ch: "particles", kind: "identity", label: "attraction forte / répulsion électrique", formula: "Z²/A = 2a_S / a_C", terms: { Z2A: 1, aS: -1, aC: 1 }, K: 2, carnet: "r47", plain: "Au-delà de cette limite, la répulsion électrique l'emporte sur la cohésion du noyau." }),
  // Cosmos
  P({ id: "i_OB", ch: "cosmos", kind: "identity", label: "part de matière ordinaire", formula: "Ω_b = ω_b / h²", terms: { OB: 1, wb: -1, H0: 2 }, K: Math.pow(1e5 / MPC, 2), plain: "Le fond diffus mesure une densité ; la part dépend de la vitesse d'expansion." }),
  P({ id: "i_ODM", ch: "cosmos", kind: "identity", label: "part de matière noire", formula: "Ω_n = ω_n / h²", terms: { ODM: 1, wc: -1, H0: 2 }, K: Math.pow(1e5 / MPC, 2), plain: "Même chose pour la matière noire." }),
  S({ id: "i_Om", ch: "cosmos", kind: "identity", label: "matière totale", formula: "Ω_m = Ω_b + Ω_n", terms: { Om: 1, OB: -1, ODM: -1 }, K: 0, plain: "La matière totale additionne l'ordinaire et la noire." }),
  S({ id: "z_flat", origin: "Paire posée par Anthony : gravité / expansion.", ch: "cosmos", kind: "zero", label: "gravité / expansion", formula: "Ω_K + Ω_Λ + Ω_m = 1", terms: { OK: 1, OL: 1, Om: 1 }, K: 1, carnet: "r06", plain: "L'attraction de tout ce qui pèse et l'élan de l'expansion se compensent : l'univers est plat." }),
  P({ id: "i_Hend", ch: "cosmos", kind: "identity", label: "expansion finale", formula: "H_fin = H₀ √Ω_Λ", terms: { Hend: 1, H0: -1, OL: -0.5 }, K: 1, plain: "Quand la matière s'est diluée, il ne reste que l'énergie noire." }),
  P({ id: "i_Rh", ch: "cosmos", kind: "identity", label: "rayon de Hubble", formula: "R_H = c / H₀", terms: { Rh: 1, c: -1, H0: 1 }, K: 1, plain: "La distance où l'expansion va à la vitesse de la lumière." }),
  P({ id: "i_EH", ch: "cosmos", kind: "identity", label: "énergie de la sphère", formula: "E_H = c⁵ / (2G H₀)", terms: { EH: 1, c: -5, G: 1, H0: 1 }, K: 0.5, carnet: "r53", plain: "L'énergie d'une sphère de Hubble remplie à la densité critique." }),
  P({ id: "i_Rs", ch: "cosmos", kind: "identity", label: "univers / trou noir", formula: "R_S = 2G E_H / c⁴", terms: { Rs: 1, G: -1, EH: -1, c: 4 }, K: 2, carnet: "r09", plain: "Cette sphère a exactement le rayon d'un trou noir de même masse : rapport 1 (Pathria, 1972)." }),
  P({ id: "i_rsS", ch: "holes", kind: "identity", label: "rayon de l'horizon", formula: "r_s = 2GM / c²", terms: { rsS: 1, G: -1, MS: -1, c: 2 }, K: 2, plain: "Le rayon d'où même la lumière ne ressort plus." }),
  P({ id: "i_rhoS", ch: "holes", kind: "identity", label: "densité moyenne", formula: "ρ = 3M / (4π r_s³)", terms: { rhoS: 1, MS: -1, rsS: 3 }, K: 3 / (4 * Math.PI), plain: "La masse répartie dans le volume de l'horizon." }),
  P({ id: "i_THS", ch: "holes", kind: "identity", label: "chaleur de Hawking", formula: "T = ħc³ / (8πGMk)", terms: { THS: 1, hbar: -1, c: -3, G: 1, MS: 1, kB: 1 }, K: 1 / (8 * Math.PI), plain: "Un trou noir n'est pas tout à fait noir : son horizon rayonne une chaleur." }),
  P({ id: "i_tauS", ch: "holes", kind: "identity", label: "temps intérieur", formula: "τ = πGM / c³", terms: { tauS: 1, G: -1, MS: -1, c: 3 }, K: Math.PI, plain: "Le temps propre maximal entre l'horizon et la singularité." }),
  P({ id: "i_dens_heat", origin: "Idée d'Anthony : la densité d'énergie est une chaleur, donc un temps, donc un espace. Relations de Schwarzschild et de Hawking.", ch: "holes", kind: "identity", label: "densité / chaleur", formula: "ρ = 6π k²T² / (G ħ²)", terms: { rhoS: 1, kB: -2, THS: -2, G: 1, hbar: 2 }, K: 6 * Math.PI, plain: "Plus un trou noir est dense, plus il est chaud : la densité est le carré de la chaleur." }),
  P({ id: "i_heat_time", origin: "Idée d'Anthony : la densité d'énergie est une chaleur, donc un temps, donc un espace. Relations de Schwarzschild et de Hawking.", ch: "holes", kind: "identity", label: "chaleur / temps", formula: "k T × τ = ħ / 8", terms: { THS: 1, tauS: 1, kB: 1, hbar: -1 }, K: 1 / 8, plain: "La chaleur de l'horizon et le temps vécu à l'intérieur forment un produit fixe : un huitième du quantum d'action." }),
  P({ id: "i_heat_space", origin: "Idée d'Anthony : la densité d'énergie est une chaleur, donc un temps, donc un espace. Relations de Schwarzschild et de Hawking.", ch: "holes", kind: "identity", label: "chaleur / espace", formula: "k T × r_s = ħc / 4π", terms: { THS: 1, rsS: 1, kB: 1, hbar: -1, c: -1 }, K: 1 / (4 * Math.PI), plain: "La chaleur et la taille forment aussi un produit fixe, comme pour l'univers qui refroidit en grandissant." }),
  P({ id: "i_dens_space", origin: "Idée d'Anthony : la densité d'énergie est une chaleur, donc un temps, donc un espace. Relations de Schwarzschild et de Hawking. Même forme que le rayon de Hubble face à la densité de l'univers (Pathria, 1972).", ch: "holes", kind: "identity", label: "densité / espace", formula: "r_s = √(3c² / (8πGρ))", terms: { rsS: 1, c: -1, G: 0.5, rhoS: 0.5 }, K: Math.sqrt(3 / (8 * Math.PI)), carnet: "r09", plain: "Un trou noir et un univers de même densité ont le même rayon." }),
  P({ id: "s_shadow", sigma: 0.02, origin: "Ombre d'un trou noir sans rotation ; l'anneau mesuré par l'EHT en est une approximation à quelques pour cent près, d'où une tolérance de 5 %.", ch: "holes", kind: "standard", label: "l'ombre vue depuis la Terre", formula: "θ = 2√27 · GM / (c² D)", terms: { shS: 1, G: -1, MS: -1, c: 2, DS: 1 }, K: 2 * Math.sqrt(27), plain: "La masse pesée par les étoiles et la distance prédisent la taille de l'ombre ; l'Event Horizon Telescope l'a photographiée." }),
  S({ id: "z_kasner1", theory: true, origin: "Solution de Kasner (1921) des équations d'Einstein dans le vide.", ch: "holes", kind: "zero", label: "Kasner : le volume", formula: "p₁ + p₂ + p₃ = 1", terms: { p1: 1, p2: 1, p3: 1 }, K: 1, plain: "Les trois directions changent à des rythmes différents, mais le volume grandit toujours comme le temps." }),
  S({ id: "z_kasner2", theory: true, origin: "Solution de Kasner (1921) des équations d'Einstein dans le vide.", ch: "holes", kind: "zero", label: "Kasner : les carrés", formula: "p₁² + p₂² + p₃² = 1", terms: { p1: 1, p2: 1, p3: 1 }, pow: 2, K: 1, plain: "La seconde condition du vide. Avec la première, elle oblige une direction à se contracter." }),
  S({ id: "z_kasner_inv", theory: true, origin: "Idée d'Anthony : expansion et rétraction forment une relation. Somme des inverses calculée par Claude à partir des deux sommes de Kasner.", ch: "holes", kind: "zero", label: "expansion / rétraction", formula: "1/p₁ + 1/p₂ + 1/p₃ = 0", terms: { p1: 1, p2: 1, p3: 1 }, pow: -1, K: 0, plain: "La contraction est fixée par les deux expansions : la somme des inverses des trois rythmes fait zéro." }),
  S({ id: "s_bh", theory: true, origin: "Solution de Schwarzschild : près de la singularité, l'intérieur d'un trou noir est un univers de Kasner d'exposants (−1/3, 2/3, 2/3).", ch: "holes", kind: "standard", label: "intérieur d'un trou noir", formula: "p₁ = −1/3", terms: { p1: 1 }, K: -1 / 3, plain: "Là où il y a des trous noirs, l'espace se rétracte dans une direction et s'étire dans les deux autres : c'est l'étirement en spaghetti." }),
  S({ id: "i_sph", theory: true, ch: "holes", kind: "identity", label: "symétrie sphérique", formula: "p₂ = p₃", terms: { p2: 1, p3: -1 }, K: 0, plain: "Autour d'un trou noir sans rotation, les deux directions angulaires sont équivalentes." }),
  F({ id: "c_ht1", origin: "Deux lectures d'une même relation : « la somme de toutes les relations vaut 10¹²² » (affirmation d'Anthony) et H × âge = 1 (proposée par Claude comme candidat pour H). Comptées sur l'horizon d'aujourd'hui, elles sont équivalentes.", ch: "cosmos", kind: "claim", group: "age", label: "freinage = accélération = toutes les relations", formula: "H₀ × âge = 1  ⇔  N_op × π² = S₀", nodes: ["H0", "t0"], f: v => lg(v.H0 * v.t0), carnet: "r73", tol: "exact", note: "La moyenne du paramètre de décélération sur toute l'histoire serait nulle (Avelino & Kirshner 2016 relèvent la coïncidence). Équivalence : N_op = 2E_H t₀/(πħ) et S₀ = π(c/H₀)²/l_P² donnent N_op π²/S₀ = H₀ t₀.", plain: "Le freinage passé et l'accélération présente se compenseraient exactement. Dit autrement : la somme de toutes les relations accomplies égalerait le nombre de pixels du contenant." }),
  F({ id: "s_lcdm", ch: "cosmos", kind: "standard", group: "age", label: "âge du modèle standard", formula: "H₀ × âge = f(Ω_Λ)", nodes: ["H0", "t0", "OL"], f: v => lg(v.H0 * v.t0) - lg(v.H0 * lcdmAge(v.H0, v.OL, 1)), plain: "Dans le modèle standard, l'âge se calcule à partir de H₀ et de la part d'énergie noire." }),
  F({ id: "s_novoid", ch: "cosmos", kind: "standard", group: "local", label: "pas de vide local", formula: "H₀ local = H₀", nodes: ["H0loc", "H0"], f: v => lg(v.H0loc / v.H0), plain: "Hypothèse habituelle : autour de la Voie lactée, l'expansion est la même qu'ailleurs." }),
  F({ id: "c_kbc", origin: "Image d'Anthony : comme des poumons, une région moins dense s'étend plus vite. Formule de la littérature (Haslbauer, Banik et Kroupa 2020).", ch: "cosmos", kind: "claim", group: "local", label: "vide local (KBC)", formula: "H₀ local = H₀ (1 + Ω_m^0,55 δ / 3)", nodes: ["H0loc", "H0", "Om", "delta"], f: v => lg(v.H0loc) - lg(v.H0 * (1 + Math.pow(v.Om, 0.55) * v.delta / 3)), carnet: "r37", tol: "exact", note: "Vide de Keenan, Barger et Cowie (2013) ; Haslbauer, Banik et Kroupa (2020).", plain: "Une région moins dense s'étend plus vite, comme des poumons : le H₀ local serait plus grand." }),
  S({ id: "i_dark", ch: "cosmos", kind: "identity", label: "un seul objet sombre", formula: "Ω_sombre = Ω_Λ + Ω_n", terms: { Odark: 1, OL: -1, ODM: -1 }, K: 0, origin: "Principe d'Anthony : deux éléments en relation sont la même chose, séparée.", plain: "L'énergie noire et la matière noire comptées comme un seul objet : environ 95 % de l'univers." }),
  P({ id: "i_darkRatio", ch: "cosmos", kind: "identity", label: "face vide / face pleine", formula: "Ω_Λ / Ω_n", terms: { darkRatio: 1, OL: -1, ODM: 1 }, K: 1, plain: "Le partage du secteur sombre entre ses deux faces, aujourd'hui." }),
  F({ id: "c_ihde", group: "de", origin: "Principe d'Anthony : énergie noire et matière noire sont la même chose, séparée. La tension espace / temps (énergie noire) et la tension vide / plein (matière noire) seraient les deux faces de l'équation d'Einstein, géométrie d'un côté, contenu de l'autre. Forme de calcul : énergie noire holographique en interaction (Wang, Gong et Abdalla, 2005).", ch: "cosmos", kind: "claim", res: "abs", label: "énergie noire = matière noire, séparée", formula: "w₀ = −1/3 − (2/3) √Ω_Λ − b² / Ω_Λ", nodes: ["w0", "OL", "b2"], f: v => v.w0 - (-1 / 3 - (2 / 3) * Math.sqrt(v.OL) - v.b2 / v.OL), tol: "exact", note: "L'énergie noire reste la tension entre le grain et l'horizon ; le terme b² mesure l'énergie qu'elle échange avec la matière (Q = 3b²Hρ). Avec ce réglage libre, la relation ne peut plus échouer : le réseau mesure b² au lieu de tester une prédiction.", plain: "L'énergie noire et la matière noire seraient un seul objet vu de deux côtés : face vide (l'espace et le temps) et face pleine (la matière). Le terme b² mesure ce qui passe d'une face à l'autre au fil du temps." }),
  F({ id: "c_hde", group: "de", origin: "Affirmation d'Anthony : l'énergie noire est la tension entre l'espace et le temps. Forme existante : l'énergie noire holographique de Li (2004), où la densité est fixée par le grain de Planck et l'horizon, avec c = 1.", ch: "cosmos", kind: "claim", res: "abs", label: "énergie noire = tension espace / temps", formula: "w₀ = −1/3 − (2/3) √Ω_Λ", nodes: ["w0", "OL"], f: v => v.w0 - (-1 / 3 - (2 / 3) * Math.sqrt(v.OL)), tol: "exact", note: "Densité ρ_Λ = 3c²M_P²/R_h², R_h étant l'horizon des événements futurs : l'énergie noire varie avec l'horizon, donc dans le temps.", plain: "Face vide du secteur sombre. Si l'énergie noire naît de la relation entre le plus petit grain d'espace et la taille de l'horizon, elle n'est pas constante : elle varie dans le temps, et son équation d'état s'écarte de −1." }),
  P({ id: "c_a0", origin: "Coïncidence relevée par Milgrom, proposée par Claude comme candidat pour H.", ch: "cosmos", kind: "claim", label: "galaxies / contenant", formula: "a₀ = c H₀ / 2π", terms: { a0: 1, c: -1, H0: -1 }, K: 1 / (2 * Math.PI), carnet: "r73", tol: "exact", note: "Coïncidence relevée par Milgrom.", plain: "L'accélération où les galaxies « décrochent » serait fixée par l'expansion de tout l'univers." }),
  P({ id: "c_verlinde", origin: "Idée d'Anthony : la matière noire comme tension entre le vide et le plein. Équation de Verlinde (2016).", ch: "cosmos", kind: "claim", label: "vide / plein (Verlinde)", formula: "Ω_n² = 4/3 · Ω_b", terms: { ODM: 2, OB: -1 }, K: 4 / 3, carnet: "r35", tol: "exact", note: "Relation de la gravité émergente de Verlinde (2016).", plain: "Face pleine du secteur sombre : la matière noire serait la réponse du vide (énergie noire) au plein (matière ordinaire)." }),
  P({ id: "s_eta", ch: "cosmos", kind: "standard", label: "matière / antimatière (η)", formula: "η = 274 × 10⁻¹⁰ · ω_b", terms: { eta: 1, wb: -1 }, K: 274e-10, carnet: "r20", plain: "Le fond diffus et les premiers noyaux doivent donner le même rapport matière / lumière." }),
  P({ id: "i_Trec", ch: "cosmos", kind: "identity", label: "chaleur / étendue", formula: "T* = T_fond × (1 + z*)", terms: { Trec: 1, Tcmb: -1, zp1: -1 }, K: 1, carnet: "r05", plain: "Température × taille reste constant : 3 000 K quand l'univers était 1 090 fois plus petit." }),
  P({ id: "i_lA", ch: "cosmos", kind: "identity", label: "harmoniques du fond diffus", formula: "ℓ_A = π / θ*", terms: { lA: 1, theta: 1 }, K: Math.PI, carnet: "r36", plain: "L'angle de la plus grande onde sonore donne l'écart entre les harmoniques." }),
  P({ id: "i_tfr", ch: "cosmos", kind: "identity", label: "temps / température (gel)", formula: "t = 2,42 s / √g* × (MeV / T)², g* = 10,75", terms: { tfr: 1, Tfr: 2 }, K: 2.42 / Math.sqrt(10.75), carnet: "r04", plain: "Dans l'univers jeune, temps × température² reste constant." }),
  P({ id: "i_tD", ch: "cosmos", kind: "identity", label: "temps / température (noyaux)", formula: "t = 2,42 s / √g* × (MeV / T)², g* = 3,36", terms: { tD: 1, TD: 2 }, K: 2.42 / Math.sqrt(3.36), carnet: "r04", plain: "Même règle, après la disparition des paires électron-positron." }),
  F({ id: "s_zturn", ch: "cosmos", kind: "standard", res: "abs", label: "freinage / accélération", formula: "Ω_m (1+z)³ = 2 Ω_Λ", nodes: ["zturn", "Om", "OL"], f: v => v.zturn - (Math.cbrt(2 * v.OL / v.Om) - 1), carnet: "r07", plain: "L'expansion bascule quand la matière pèse deux fois l'énergie noire." }),
  F({ id: "s_tturn", ch: "cosmos", kind: "standard", label: "date de la bascule", formula: "t(0) − t(z_bascule)", nodes: ["tturn", "H0", "OL", "zturn"], f: v => lg(v.tturn) - lg(lcdmAge(v.H0, v.OL, 1) - lcdmAge(v.H0, v.OL, 1 / (1 + v.zturn))), carnet: "r07", plain: "Le temps écoulé depuis la bascule." }),
  F({ id: "s_teq", ch: "cosmos", kind: "standard", label: "matière / énergie noire", formula: "Ω_m (1+z)³ = Ω_Λ", nodes: ["teq", "H0", "OL", "Om"], f: v => lg(v.teq) - lg(lcdmAge(v.H0, v.OL, 1) - lcdmAge(v.H0, v.OL, Math.cbrt(v.Om / v.OL))), carnet: "r08", plain: "Le moment où les deux densités étaient égales." }),
  // Début et fin
  P({ id: "i_Tfloor", ch: "bounds", kind: "identity", label: "plancher (Gibbons–Hawking, Unruh)", formula: "T_min = ħ H_fin / (2π k)", terms: { Tfloor: 1, hbar: -1, Hend: -1, kB: 1 }, K: 1 / (2 * Math.PI), carnet: "r71", plain: "L'horizon final garde une chaleur : c'est la trace du mouvement de l'univers, qui ne peut jamais s'arrêter." }),
  P({ id: "i_S", ch: "bounds", kind: "identity", label: "pixels du contenant", formula: "S = π c² / (H_fin² l_P²)", terms: { S: 1, c: -2, Hend: 2, lP: 2 }, K: Math.PI, carnet: "r11", plain: "La surface de l'horizon final, comptée en pixels de Planck : 10¹²². C'est aussi (plafond / plancher)² / 4π." }),
  P({ id: "i_rhoL", ch: "bounds", kind: "identity", label: "densité d'énergie noire", formula: "ρ_Λ = 3 c² H₀² Ω_Λ / (8πG)", terms: { rhoL: 1, c: -2, H0: -2, OL: -1, G: 1 }, K: 3 / (8 * Math.PI), plain: "Ce que contient un mètre cube de vide." }),
  P({ id: "i_Edark", ch: "bounds", kind: "identity", label: "échelle de l'énergie noire", formula: "E_n = (ρ_Λ (ħc)³)^¼", terms: { Edark: 1, rhoL: -0.25, hbar: -0.75, c: -0.75, e: 1 }, K: 1, plain: "L'énergie noire ramenée à l'énergie d'une particule : environ 2 meV." }),
  P({ id: "i_Emid", ch: "bounds", kind: "identity", label: "axe de la sinusoïde", formula: "E_mil = √(E_P · ħ H_fin)", terms: { Emid: 1, EP: -0.5, hbar: -0.5, Hend: -0.5, e: 1 }, K: 1, carnet: "r68", plain: "Le milieu entre le plus grand et le plus petit quantum. Il diffère de l'énergie noire d'un facteur fixe, 0,588 : c'est une identité." }),
  P({ id: "i_Estock", ch: "bounds", kind: "identity", label: "stock d'énergie noire", formula: "E_stock = ρ_Λ · 4π/3 · (c / H_fin)³", terms: { Estock: 1, rhoL: -1, c: -3, Hend: 3 }, K: 4 * Math.PI / 3, carnet: "r12", plain: "Toute l'énergie noire dans l'horizon final." }),
  P({ id: "i_stockEP", ch: "bounds", kind: "identity", label: "début / fin (énergie)", formula: "E_stock / E_P = (T_P / T_min) / 4π", terms: { stockEP: 1, Estock: -1, EP: 1 }, K: 1, carnet: "r12", plain: "Ce stock vaut 5 × 10⁶⁰ énergies de Planck, le rapport des températures divisé par 4π." }),
  P({ id: "i_pix", ch: "bounds", kind: "identity", label: "pixel / horizon", formula: "ρ_Λ l_P³ × 4S / E_P = 3/2", terms: { pixRatio: 1, rhoL: -1, lP: -3, S: -1, EP: 1 }, K: 4, carnet: "r13", plain: "L'énergie noire d'un pixel de volume, multipliée par les pixels de surface, donne une énergie de Planck et demie." }),
  P({ id: "i_vac", ch: "bounds", kind: "identity", label: "énergie du vide prédite / mesurée", formula: "(E_P / l_P³) / ρ_Λ", terms: { vacRatio: 1, EP: -1, lP: 3, rhoL: 1 }, K: 1, carnet: "r16", plain: "La théorie compte les pixels du volume ; la mesure suit ceux de la surface. L'écart est de 10¹²²." }),
  P({ id: "i_Nops", ch: "bounds", kind: "identity", label: "toutes les relations", formula: "N_op = 2 E_H × âge / (π ħ)", terms: { Nops: 1, EH: -1, t0: -1, hbar: 1 }, K: 2 / Math.PI, carnet: "r53", plain: "Le nombre maximal de changements d'état depuis le début (limite de Margolus–Levitin)." }),
  P({ id: "i_S0", ch: "bounds", kind: "identity", label: "pixels d'aujourd'hui", formula: "S₀ = π c² / (H₀² l_P²)", terms: { S0: 1, c: -2, H0: 2, lP: 2 }, K: Math.PI, carnet: "r53", plain: "Le même comptage que S, sur l'horizon d'aujourd'hui au lieu de l'horizon final." }),
  P({ id: "i_allRatio", ch: "bounds", kind: "identity", label: "toutes les relations / contenant", formula: "N_op π² / S₀ = H₀ × âge", terms: { allRatio: 1, Nops: -1, S0: 1 }, K: Math.PI * Math.PI, carnet: "r53", plain: "Comptées sur le même horizon, la somme de toutes les relations et les pixels du contenant ne diffèrent que de H₀ × âge (et de π², qui vient des conventions de comptage)." }),
  P({ id: "i_ageP2", ch: "bounds", kind: "identity", label: "chemin de l'âge", formula: "(âge / t_P)²", terms: { ageP2: 1, t0: -2, tP: 2 }, K: 1, carnet: "r17", plain: "L'âge compté en instants de Planck, au carré : encore 10¹²²." }),
  P({ id: "i_Lmid", ch: "bounds", kind: "identity", label: "petit / grand", formula: "L_mil = √(l_P R_H)", terms: { Lmid: 1, lP: -0.5, Rh: -0.5 }, K: 1, carnet: "r15", plain: "Le milieu entre le plus petit et le plus grand : un vingtième de millimètre." }),
  P({ id: "i_Ldark", ch: "bounds", kind: "identity", label: "longueur de l'énergie noire", formula: "L_n = ħc / E_n", terms: { Ldark: 1, hbar: -1, c: -1, Edark: 1, e: 1 }, K: 1, carnet: "r15", plain: "La longueur de l'énergie noire, du même ordre que le milieu." }),
  P({ id: "i_Equant", ch: "bounds", kind: "identity", label: "dernier quantum", formula: "kT_min", terms: { Equant: 1, kB: -1, Tfloor: -1 }, K: 1, carnet: "r61", plain: "Ce qui reste à la fin : un quantum de chaleur de 3 × 10⁻⁵³ J." }),
  P({ id: "i_E0", ch: "bounds", kind: "identity", label: "zéro absolu / plancher", formula: "½ħH_fin / kT_min = π", terms: { E0ratio: 1, hbar: -1, Hend: -1, Equant: 1 }, K: 0.5, carnet: "r71", plain: "La vibration de repos du cadre vaut exactement π fois la chaleur du plancher : le zéro absolu est inatteignable." }),
  P({ id: "i_mHub", ch: "bounds", kind: "identity", label: "l'étincelle", formula: "m_H c² = ħ H_fin", terms: { mHub: 1, hbar: -1, Hend: -1, e: 1 }, K: 1, carnet: "r62", plain: "La masse la plus légère que l'horizon final puisse porter." }),
  P({ id: "i_Emin", ch: "bounds", kind: "identity", label: "le prix d'une relation", formula: "E_min = πħ / (2 × âge)", terms: { Emin: 1, hbar: -1, t0: 1 }, K: Math.PI / 2, carnet: "r39", plain: "Une relation qui dure Δt coûte au moins πħ / (2Δt)." }),
  P({ id: "c_dirac", origin: "Grands nombres de Dirac ; chemin calculé par Claude dans le carnet.", ch: "bounds", kind: "claim", label: "électron / univers (Dirac)", formula: "(R_H / r_e)³ = S", terms: { Rh: 3, re: -3, S: -1 }, K: 1, carnet: "r18", tol: "order", plain: "Le rapport entre l'univers et l'électron, au cube, redonnerait les pixels du contenant." }),
  P({ id: "f_cube", origin: "Chemin essayé par Claude dans le carnet.", ch: "bounds", kind: "failure", label: "électricité / gravité, au cube", formula: "(F_e / F_g)³ = S", terms: { Fratio: 3, S: -1 }, K: 1, carnet: "r19", tol: "order", plain: "Premier essai : il donnait 10¹²⁸, un million de fois trop. 10¹²² est un carré, pas un cube." }),
  // Les notes
  P({ id: "i_fH", ch: "notes", kind: "identity", label: "note fondamentale", formula: "f = H_fin / 2π", terms: { fH: 1, Hend: -1 }, K: 1 / (2 * Math.PI), carnet: "r64", plain: "La vibration la plus grave que le cadre puisse porter." }),
  F({ id: "i_oct", ch: "notes", kind: "identity", res: "abs", label: "octaves", formula: "log₂(440 Hz / f)", nodes: ["oct", "fH"], f: v => v.oct - Math.log2(440 / v.fH), carnet: "r64", plain: "Environ 70 octaves sous le la du diapason." }),
  P({ id: "i_fe", ch: "notes", kind: "identity", label: "note propre de l'électron", formula: "f_e = m_e c² / h", terms: { fe: 1, me: -1, c: -2, hbar: 1 }, K: 1 / (2 * Math.PI), carnet: "r65", plain: "La masse est une note plancher : la matière vibre toujours au moins à cette fréquence." }),
  P({ id: "i_fp", ch: "notes", kind: "identity", label: "note propre du proton", formula: "f_p = m_p c² / h", terms: { fp: 1, mp: -1, c: -2, hbar: 1 }, K: 1 / (2 * Math.PI), carnet: "r65", plain: "La même chose pour le proton." }),
  P({ id: "i_fmid", ch: "notes", kind: "identity", label: "aigu / grave", formula: "f_mil = √(f_p · f_cadre)", terms: { fmid: 1, fp: -0.5, fH: -0.5 }, K: 1, carnet: "r66", plain: "Le milieu de la note la plus aiguë et de la plus grave tombe à 255 Hz, près du do du piano." }),
  P({ id: "i_Emq", ch: "notes", kind: "identity", label: "vibration / création de particules", formula: "E = h f_mil", terms: { Emq: 1, hbar: -1, fmid: -1, e: 1 }, K: 2 * Math.PI, carnet: "r67", plain: "Un grain de cette note porte 10⁻¹² eV : bien trop peu pour créer de la matière." }),
  P({ id: "i_Nlam", ch: "notes", kind: "identity", label: "taille du cadre / énergie de la peau", formula: "R / λ = (c / H_fin) / (b / T_fond)", terms: { Nlam: 1, c: -1, Hend: 1, Tcmb: -1 }, K: 1 / WIEN_B, carnet: "r63", plain: "Combien de vagues de la plus vieille lumière tiennent dans l'horizon final." }),
  F({ id: "i_tlife", ch: "notes", kind: "identity", label: "durée de vie de la lumière", formula: "t = ln(R / λ) / H_fin", nodes: ["tlife", "Nlam", "Hend"], f: v => lg(v.tlife) - lg(Math.log(v.Nlam) / v.Hend), carnet: "r64", plain: "L'expansion étire cette lumière jusqu'à la taille de l'horizon en environ 1 200 milliards d'années." }),
  // Le vivant
  F({ id: "s_Tearth", ch: "life", kind: "standard", label: "Soleil / Terre", formula: "T_⊕ = T_☉ √(R_☉ / 2 UA) (1 − A)^¼", nodes: ["Tearth", "Tsun", "Rsun", "AU", "albedo"], f: v => lg(v.Tearth) - lg(v.Tsun * Math.sqrt(v.Rsun / (2 * v.AU)) * Math.pow(1 - v.albedo, 0.25)), carnet: "r59", plain: "La Terre renvoie toute l'énergie qu'elle reçoit : sa température en découle." }),
  P({ id: "i_Nph", ch: "life", kind: "identity", label: "ordre / désordre (le vivant)", formula: "photons sortis / entrés = T_☉ / T_⊕", terms: { Nph: 1, Tsun: -1, Tearth: 1 }, K: 1, carnet: "r59", plain: "Même énergie, mais 23 photons froids sortent pour 1 photon chaud entré : c'est ce surplus d'ordre qui fait vivre." }),
  P({ id: "i_used", ch: "life", kind: "identity", label: "actuel / potentiel", formula: "S_act / S", terms: { used: 1, Snow: -1, S: 1 }, K: 1, carnet: "r14", plain: "L'univers n'aurait encore utilisé qu'environ 10⁻¹⁸ de son potentiel de désordre." }),
  P({ id: "c_present", origin: "Question posée par Anthony (le budget du présent) ; équation posée par Claude.", ch: "life", kind: "claim", label: "budget du présent", formula: "présent / âge = S_act / S", terms: { tPresent: 1, t0: -1, Snow: -1, S: 1 }, K: 1, carnet: "r60", tol: "order", plain: "La durée du présent, rapportée à l'âge de l'univers, vaudrait la part d'entropie déjà utilisée." }),
];
RELATIONS.forEach(r => {
  if (r.type !== "fn") r.nodes = Object.keys(r.terms);
  if (r.type === "sum" && typeof r.pow === "number") {
    const p = r.pow; r.pow = {}; r.nodes.forEach(id => { r.pow[id] = p; });
  }
  r.pow = r.pow || {};
});

// ---------- Measurements (display units) ----------
const MEASUREMENTS = [
  { id: "m_c", node: "c", value: 299792458, exact: true, src: "SI, valeur exacte", base: true },
  { id: "m_hbar", node: "hbar", value: 1.054571817e-34, exact: true, src: "SI, valeur exacte", base: true },
  { id: "m_kB", node: "kB", value: 1.380649e-23, exact: true, src: "SI, valeur exacte", base: true },
  { id: "m_e", node: "e", value: 1.602176634e-19, exact: true, src: "SI, valeur exacte", base: true },
  { id: "m_G", node: "G", value: 6.67430e-11, sigma: 0.00015e-11, src: "CODATA 2022", base: true },
  { id: "m_eps0", node: "eps0", value: 8.8541878188e-12, sigma: 0.0000000014e-12, src: "CODATA 2022" },
  { id: "m_mu0", node: "mu0", value: 1.25663706127e-6, sigma: 0.00000000020e-6, src: "CODATA 2022" },
  { id: "m_me", node: "me", value: 0.51099895000, sigma: 0.00000000015, src: "CODATA 2022" },
  { id: "m_mp", node: "mp", value: 938.27208943, sigma: 0.00000029, src: "CODATA 2022" },
  { id: "m_Ry", node: "Ry", value: 13.605693122990, sigma: 0.000000000015, src: "CODATA 2022" },
  { id: "m_lyA", node: "lyA", value: 121.567, sigma: 0.001, src: "raie de l'hydrogène (NIST)" },
  { id: "m_YQ", node: "YQ", value: 1 / 6, exact: true, src: "référence : fixe l'échelle des hypercharges", base: true },
  { id: "m_Yu", node: "Yu", value: 2 / 3, exact: true, src: "modèle standard, déduit des charges mesurées" },
  { id: "m_Yd", node: "Yd", value: -1 / 3, exact: true, src: "modèle standard, déduit des charges mesurées" },
  { id: "m_YL", node: "YL", value: -1 / 2, exact: true, src: "modèle standard, déduit des charges mesurées" },
  { id: "m_Ye", node: "Ye", value: -1, exact: true, src: "modèle standard, déduit des charges mesurées" },
  { id: "m_Qatom", node: "Qatom", value: -0.1e-21, sigma: 1.1e-21, src: "neutralité de la matière (Bressi et al. 2011)" },
  { id: "m_etaEP", node: "etaEP", value: -1.5, sigma: 2.7, src: "satellite MICROSCOPE (2022)" },
  { id: "m_v", node: "v", value: 246.22, sigma: 0.01, src: "constante de Fermi" },
  { id: "m_mH", node: "mH", value: 125.20, sigma: 0.11, src: "PDG 2024" },
  { id: "m_mW", node: "mW", value: 80.3625, sigma: 0.013, src: "carnet, moyenne mondiale" },
  { id: "m_mZ", node: "mZ", value: 91.1876, sigma: 0.0021, src: "LEP" },
  { id: "m_mmu", node: "mmu", value: 105.6583755, sigma: 0.0000023, src: "CODATA / PDG" },
  { id: "m_mtau", node: "mtau", value: 1776.93, sigma: 0.09, src: "PDG 2024" },
  { id: "m_mpi", node: "mpi", value: 139.57039, sigma: 0.00018, src: "PDG" },
  { id: "m_mu_q", node: "mu_q", value: 2.16, sigma: 0.07, src: "PDG 2024" },
  { id: "m_md_q", node: "md_q", value: 4.70, sigma: 0.07, src: "PDG 2024" },
  { id: "m_dQCD", node: "dQCD", value: 2.52, sigma: 0.29, src: "Borsanyi et al. 2015 (calcul sur réseau)" },
  { id: "m_dQED", node: "dQED", value: -1.00, sigma: 0.16, src: "Borsanyi et al. 2015 (calcul sur réseau)" },
  { id: "m_dmnp", node: "dmnp", value: 1.29333236, sigma: 0.0000005, src: "CODATA 2022" },
  { id: "m_d21", node: "d21", value: 7.49e-5, sigma: 0.19e-5, src: "NuFIT 6.0" },
  { id: "m_d31", node: "d31", value: 2.534e-3, sigma: 0.025e-3, src: "NuFIT 6.0" },
  { id: "m_aS", node: "aS", value: 18.3, sigma: 0.4, src: "formule de masse des noyaux" },
  { id: "m_aC", node: "aC", value: 0.714, sigma: 0.015, src: "formule de masse des noyaux" },
  { id: "m_H0cmb", node: "H0", value: 67.4, sigma: 0.5, src: "Planck 2018, fond diffus", modelDep: true },
  { id: "m_H0loc", node: "H0loc", value: 73.04, sigma: 1.04, src: "SH0ES (Riess et al. 2022)" },
  { id: "m_t0", node: "t0", value: 13.5, sigma: 0.27, src: "plus vieilles étoiles (Valcin et al. 2021)" },
  { id: "m_wb", node: "wb", value: 0.02237, sigma: 0.00015, src: "Planck 2018, fond diffus" },
  { id: "m_wc", node: "wc", value: 0.1200, sigma: 0.0012, src: "Planck 2018, fond diffus" },
  { id: "m_OL", node: "OL", value: 0.6847, sigma: 0.0073, src: "Planck 2018, modèle standard", modelDep: true },
  { id: "m_OK", node: "OK", value: 0.001, sigma: 0.002, src: "Planck 2018 + BAO" },
  { id: "m_a0", node: "a0", value: 1.20e-10, sigma: 0.24e-10, src: "McGaugh, Lelli & Schombert 2016" },
  { id: "m_delta", node: "delta", value: 0.46, sigma: 0.06, src: "vide KBC (Keenan, Barger & Cowie 2013)" },
  { id: "m_eta", node: "eta", value: 6.040e-10, sigma: 0.118e-10, src: "premiers noyaux, deutérium (PDG 2025)" },
  { id: "m_MS", node: "MS", value: 4.297, sigma: 0.042, src: "GRAVITY 2022 (orbites des étoiles)" },
  { id: "m_DS", node: "DS", value: 8.277, sigma: 0.031, src: "GRAVITY 2022" },
  { id: "m_shS", node: "shS", value: 51.8, sigma: 2.3, src: "anneau, Event Horizon Telescope 2022" },
  { id: "m_w0", node: "w0", value: -0.841, sigma: 0.053, src: "DESI DR2 + fond diffus + supernovae Pantheon+ (analyse arXiv 2512.07281)" },
  { id: "m_Tcmb", node: "Tcmb", value: 2.72548, sigma: 0.00057, src: "Fixsen 2009" },
  { id: "m_zp1", node: "zp1", value: 1090.92, sigma: 0.25, src: "Planck 2018" },
  { id: "m_theta", node: "theta", value: 1.04110e-2, sigma: 0.00031e-2, src: "Planck 2018" },
  { id: "m_Tfr", node: "Tfr", value: 1, sigma: 0.1, src: "repère : gel vers 1 MeV (PDG)" },
  { id: "m_TD", node: "TD", value: 0.1, sigma: 0.01, src: "repère : noyaux vers 0,1 MeV (PDG)" },
  { id: "m_Tsun", node: "Tsun", value: 5772, sigma: 0.8, src: "UAI 2015, valeur nominale" },
  { id: "m_Rsun", node: "Rsun", value: 6.957e8, sigma: 0.001e8, src: "UAI 2015, valeur nominale" },
  { id: "m_AU", node: "AU", value: 1.495978707e11, exact: true, src: "UAI 2012, valeur exacte" },
  { id: "m_albedo", node: "albedo", value: 0.29, sigma: 0.01, src: "bilan radiatif (CERES)" },
  { id: "m_Tearth", node: "Tearth", value: 255, sigma: 1, src: "≈ 240 W/m² émis vers l'espace (CERES)" },
  { id: "m_Snow", node: "Snow", value: 3.1e104, sigmaDex: 0.3, src: "Egan & Lineweaver 2010" },
  { id: "m_tPresent", node: "tPresent", value: 3, sigmaDex: 0.2, src: "présent psychologique (Pöppel), valeur discutée" },
];

const NODE_INDEX = Object.fromEntries(NODES.map((n, i) => [n.id, i]));
const nodeOf = id => NODES[NODE_INDEX[id]];

// Measurement in solver space: log nodes -> log10 of the base value; lin nodes -> value.
function measInSpace(m) {
  const n = nodeOf(m.node);
  if (n.scale === "lin") return m.value;
  return Math.log10(m.value) - n.dispLog;
}
function measSigma(m) {   // sigma in solver space, capped below to keep the problem well conditioned
  const n = nodeOf(m.node);
  if (m.exact) return EXACT;
  if (m.sigmaDex) return m.sigmaDex;
  if (n.scale === "lin") return Math.max(m.sigma, EXACT);
  return Math.max(m.sigma / (Math.abs(m.value) * LN10), EXACT);
}
function measSigmaTrue(m) {  // sigma used to judge a prediction
  const n = nodeOf(m.node);
  if (m.exact) return 0;
  if (m.sigmaDex) return m.sigmaDex;
  if (n.scale === "lin") return m.sigma;
  return m.sigma / (Math.abs(m.value) * LN10);
}
const toValue = (n, x) => (n.scale === "lin" ? x : Math.pow(10, x));
const guessInSpace = n => (n.scale === "lin" ? n.guess : Math.log10(n.guess) - n.dispLog);
const displayValue = (n, x) => (n.scale === "lin" ? x : Math.pow(10, x + n.dispLog));

// ---------- Residuals ----------
function relationResidual(r, x) {
  if (r.type === "prod") {
    let s = -Math.log10(r.K);
    for (const id of r.nodes) s += r.terms[id] * x[NODE_INDEX[id]];
    return s;
  }
  if (r.type === "sum") {
    let s = -r.K;
    for (const id of r.nodes) {
      const n = nodeOf(id);
      const val = toValue(n, x[NODE_INDEX[id]]);
      s += r.terms[id] * Math.pow(val, r.pow[id] || 1);
    }
    return s;
  }
  const v = {};
  for (const id of r.nodes) v[id] = toValue(nodeOf(id), x[NODE_INDEX[id]]);
  return r.f(v);
}
function relationGradient(r, x) {
  const g = {};
  if (r.type === "prod") { for (const id of r.nodes) g[id] = r.terms[id]; return g; }
  if (r.type === "sum") {
    for (const id of r.nodes) {
      const n = nodeOf(id), xi = x[NODE_INDEX[id]];
      const val = toValue(n, xi), p = r.pow[id] || 1;
      const dval = n.scale === "lin" ? 1 : val * LN10;
      g[id] = r.terms[id] * p * Math.pow(val, p - 1) * dval;
    }
    return g;
  }
  for (const id of r.nodes) {
    const i = NODE_INDEX[id], h = nodeOf(id).scale === "lin" ? 1e-6 * Math.max(1, Math.abs(x[i])) : 1e-6;
    const xp = x.slice(), xm = x.slice();
    xp[i] += h; xm[i] -= h;
    g[id] = (relationResidual(r, xp) - relationResidual(r, xm)) / (2 * h);
  }
  return g;
}

// ---------- Linear algebra: Householder QR least squares ----------
function lstsq(A, b, m, n) {
  // A: Float64Array m*n row-major (copied), b: Float64Array m. Returns { d, R }.
  const a = Float64Array.from(A), y = Float64Array.from(b);
  for (let k = 0; k < n; k++) {
    let norm = 0;
    for (let i = k; i < m; i++) norm += a[i * n + k] * a[i * n + k];
    norm = Math.sqrt(norm);
    if (norm === 0) continue;
    const alpha = a[k * n + k] > 0 ? -norm : norm;
    const v0 = a[k * n + k] - alpha;
    // v = [v0, a[k+1..m-1][k]]
    let vnorm2 = v0 * v0;
    for (let i = k + 1; i < m; i++) vnorm2 += a[i * n + k] * a[i * n + k];
    if (vnorm2 === 0) continue;
    const vk = new Float64Array(m - k);
    vk[0] = v0;
    for (let i = k + 1; i < m; i++) vk[i - k] = a[i * n + k];
    for (let j = k; j < n; j++) {
      let dot = 0;
      for (let i = k; i < m; i++) dot += vk[i - k] * a[i * n + j];
      const f = 2 * dot / vnorm2;
      if (f === 0) continue;
      for (let i = k; i < m; i++) a[i * n + j] -= f * vk[i - k];
    }
    let dot = 0;
    for (let i = k; i < m; i++) dot += vk[i - k] * y[i];
    const f = 2 * dot / vnorm2;
    for (let i = k; i < m; i++) y[i] -= f * vk[i - k];
  }
  const R = new Float64Array(n * n);
  for (let i = 0; i < n; i++) for (let j = i; j < n; j++) R[i * n + j] = a[i * n + j];
  const d = new Float64Array(n);
  for (let i = n - 1; i >= 0; i--) {
    let s = y[i];
    for (let j = i + 1; j < n; j++) s -= R[i * n + j] * d[j];
    d[i] = s / R[i * n + i];
  }
  return { d, R };
}
function covarianceFromR(R, n) {
  // cov = (R^T R)^-1 = Rinv Rinv^T
  const Ri = new Float64Array(n * n);
  for (let i = n - 1; i >= 0; i--) {
    Ri[i * n + i] = 1 / R[i * n + i];
    for (let j = i + 1; j < n; j++) {
      let s = 0;
      for (let k = i + 1; k <= j; k++) s += R[i * n + k] * Ri[k * n + j];
      Ri[i * n + j] = -s / R[i * n + i];
    }
  }
  const cov = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      let s = 0;
      for (let k = j; k < n; k++) s += Ri[i * n + k] * Ri[j * n + k];
      cov[i * n + j] = s; cov[j * n + i] = s;
    }
  }
  return cov;
}

// ---------- Solver: Gauss-Newton with a weak ridge toward the guess ----------
function relationSigma(r) {
  if (r.kind === "identity" || r.kind === "zero") return r.sigma || EXACT;
  if (r.kind === "standard") return r.sigma || EXACT;
  return TOL[r.tolNow || r.tol || "exact"];
}
// Nodes pinned by an exact base measurement (c, ħ, k, e, G, ...) act as constants.
// Removing them splits the network into independent components, each solved on its own.
function componentsOf(rels, fixed) {
  const parent = NODES.map((_, i) => i);
  const find = i => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (const r of rels) {
    const ids = r.nodes.map(id => NODE_INDEX[id]).filter(i => !fixed[i]);
    for (let k = 1; k < ids.length; k++) parent[find(ids[k])] = find(ids[0]);
  }
  const groups = new Map();
  NODES.forEach((_, i) => { if (fixed[i]) return; const root = find(i); if (!groups.has(root)) groups.set(root, []); groups.get(root).push(i); });
  return [...groups.values()];
}

function solveComponent(vars, rels, meas, x, guess, maxIter) {
  const n = vars.length;
  const local = new Map(vars.map((g, l) => [g, l]));
  const rows = rels.length + meas.length + n;
  const buildSystem = (xx, withJ) => {
    const A = withJ ? new Float64Array(rows * n) : null;
    const b = new Float64Array(rows);
    let k = 0;
    for (const r of rels) {
      const s = relationSigma(r);
      b[k] = -relationResidual(r, xx) / s;
      if (withJ) {
        const g = relationGradient(r, xx);
        for (const id in g) { const l = local.get(NODE_INDEX[id]); if (l !== undefined) A[k * n + l] = g[id] / s; }
      }
      k++;
    }
    for (const m of meas) {
      const gi = NODE_INDEX[m.node], s = measSigma(m);
      b[k] = -(xx[gi] - measInSpace(m)) / s;
      if (withJ) A[k * n + local.get(gi)] = 1 / s;
      k++;
    }
    for (let l = 0; l < n; l++) {
      const gi = vars[l];
      const rs = NODES[gi].scale === "lin" ? RIDGE_SIGMA * Math.max(1, Math.abs(NODES[gi].guess)) : RIDGE_SIGMA;
      b[k] = -(xx[gi] - guess[gi]) / rs;
      if (withJ) A[k * n + l] = 1 / rs;
      k++;
    }
    return { A, b };
  };
  const cost = xx => { const { b } = buildSystem(xx, false); let s = 0; for (const v of b) s += v * v; return s; };
  let R = null, c0 = cost(x);
  for (let iter = 0; iter < maxIter; iter++) {
    const { A, b } = buildSystem(x, true);
    const sol = lstsq(A, b, rows, n);
    R = sol.R;
    let step = 1, xn = x, c1 = c0;
    for (let t = 0; t < 12; t++) {
      xn = x.slice();
      for (let l = 0; l < n; l++) xn[vars[l]] += step * sol.d[l];
      c1 = cost(xn);
      if (isFinite(c1) && c1 <= c0 * (1 + 1e-12) + 1e-300) break;
      step /= 2;
    }
    let maxStep = 0;
    for (let l = 0; l < n; l++) maxStep = Math.max(maxStep, Math.abs(sol.d[l] * step));
    const gain = c0 - c1;
    x = xn; c0 = c1;
    if (maxStep < 1e-10 || (gain >= 0 && gain < 1e-12 * Math.max(1, c0))) break;
  }
  return { x, R, n, vars, local, cost: c0 };
}

function solveNetwork(rels, meas, xStart, options = {}) {
  const N = NODES.length;
  const guess = NODES.map(guessInSpace);
  let x = (xStart || guess).slice();
  const fixed = new Array(N).fill(false);
  for (const m of meas) if (m.base) { const i = NODE_INDEX[m.node]; fixed[i] = true; x[i] = measInSpace(m); }
  const comps = options.only ? [options.only] : componentsOf(rels, fixed);
  const parts = [];
  const compOf = new Array(N).fill(-1);
  for (const vars of comps) {
    const set = new Set(vars);
    const crel = rels.filter(r => r.nodes.some(id => set.has(NODE_INDEX[id])));
    const cmeas = meas.filter(m => !m.base && set.has(NODE_INDEX[m.node]));
    const part = solveComponent(vars, crel, cmeas, x, guess, options.maxIter || 30);
    x = part.x;
    parts.forEach(() => {});
    vars.forEach(i => { compOf[i] = parts.length; });
    parts.push(part);
  }
  const fit = { x, parts, compOf, fixed, comps };
  if (options.fullCov) {
    fit.varDiag = new Array(N).fill(0);
    fit.reachable = new Array(N).fill(true);
    parts.forEach(part => {
      const cov = covarianceFromR(part.R, part.n);
      part.cov = cov;
      part.vars.forEach((gi, l) => { fit.varDiag[gi] = Math.max(cov[l * part.n + l], 0); fit.reachable[gi] = fit.varDiag[gi] < UNREACHABLE_VAR; });
    });
  }
  return fit;
}

// g^T (R^T R)^-1 g = |R^-T g|^2 over one component, by forward substitution
function quadForm(part, gLocal) {
  const n = part.n, R = part.R, y = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let s = gLocal[i] || 0;
    for (let k = 0; k < i; k++) s -= R[k * n + i] * y[k];
    y[i] = s / R[i * n + i];
  }
  let q = 0; for (let i = 0; i < n; i++) q += y[i] * y[i];
  return q;
}
function variance(fit, gi) {
  if (fit.fixed[gi]) return 0;
  if (fit.varDiag) return fit.varDiag[gi];
  const part = fit.parts[fit.compOf[gi]];
  const g = new Float64Array(part.n); g[part.local.get(gi)] = 1;
  return quadForm(part, g);
}
function covEntry(fit, a, b) {
  const part = fit.parts[fit.compOf[a]];
  if (!part.cov || fit.compOf[a] !== fit.compOf[b]) return 0;
  return part.cov[part.local.get(a) * part.n + part.local.get(b)];
}

// Solve from the given start and from the default start, keep the better fit
// (a start far from the answer can leave Gauss-Newton stuck on a nonlinear relation).
function solveBest(rels, meas, xStart, options) {
  const a = solveNetwork(rels, meas, xStart, options);
  if (!xStart) return a;
  const b = solveNetwork(rels, meas, null, options);
  const cost = f => f.parts.reduce((s, p) => s + p.cost, 0);
  return cost(b) < cost(a) * (1 - 1e-9) ? b : a;
}

// Hide one measurement, predict it from all the others.
function testMeasurement(rels, meas, k, xStart, options) {
  const m = meas[k];
  const others = meas.filter((_, j) => j !== k);
  const i = NODE_INDEX[m.node];
  const fit = solveBest(rels, others, xStart, { only: options.compOfNode(i) });
  const vp = variance(fit, i);
  if (!(vp < UNREACHABLE_VAR)) return { m, reachable: false };
  const pred = fit.x[i];
  const sd = Math.sqrt(vp + measSigmaTrue(m) ** 2);
  const pull = sd > 0 ? (pred - measInSpace(m)) / sd : 0;
  return { m, reachable: true, pred, sdPred: Math.sqrt(vp), pull };
}

// Remove one relation, measure how far its equation is from what the rest implies.
function testRelation(rels, meas, r, xStart, options) {
  const others = rels.filter(o => o !== r);
  const anyVar = r.nodes.map(id => NODE_INDEX[id]).find(i => options.compOfNode(i));
  if (anyVar === undefined) return { r, testable: false };
  const fit = solveBest(others, meas, xStart, { only: options.compOfNode(anyVar) });
  const part = fit.parts[0];
  const gObj = relationGradient(r, fit.x);
  const g = new Float64Array(part.n);
  let gnorm2 = 0;
  for (const id in gObj) { const l = part.local.get(NODE_INDEX[id]); if (l !== undefined) { g[l] = gObj[id]; gnorm2 += gObj[id] * gObj[id]; } }
  const v = quadForm(part, g);
  if (!(v < 1e2 * Math.max(1, gnorm2))) return { r, testable: false };
  const resid = relationResidual(r, fit.x);
  const sd = Math.sqrt(Math.max(v, 0) + relationSigma(r) ** 2);
  return { r, testable: true, resid, sdRest: Math.sqrt(Math.max(v, 0)), pull: resid / sd };
}

function testOptions(fit) {
  return { compOfNode: i => (fit.compOf[i] >= 0 ? fit.comps[fit.compOf[i]] : null) };
}

if (typeof module !== "undefined") {
  module.exports = { NODES, RELATIONS, MEASUREMENTS, CHAPTERS, NODE_INDEX, TOL, TOL_LABEL, solveNetwork, testMeasurement, testRelation, testOptions, variance,
    relationResidual, displayValue, measInSpace, nodeOf, EXACT };
}
// ===== end of model =====
