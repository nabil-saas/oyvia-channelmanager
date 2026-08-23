/* ============================================================
   OYVIA — Données simulées (aucun réseau, aucune base)
   Toutes les entités sont exposées en variables globales et
   reliées entre elles par identifiant :
   LOGEMENTS · RESERVATIONS · VOYAGEURS · CONVERSATIONS ·
   TACHES · PRESTATAIRES · AUTOMATISATIONS · TARIFS · OPTIONS ·
   STATS · UTILISATEUR · COMPTE
   Date de référence de la démo : 23 juillet 2026.
   ============================================================ */

const AUJOURDHUI = '2026-07-23';

/* ---------- Montants & devise (globaux) ------------------------------

   Deux référentiels cohabitent, et il ne faut surtout pas les mélanger :

   - Les données d'EXPLOITATION (tarifs des logements, réservations,
     dépenses, tâches, factures) sont saisies en euros → DEVISE_REF.
   - Le catalogue d'ABONNEMENT Oyvia (PLANS) est libellé en MAD, la
     devise de référence commerciale du produit.

   PARAMETRES_GENERAUX.devise ne modifie aucune donnée stockée : c'est la
   devise d'AFFICHAGE. Tout ce qui est montré à l'écran est converti
   depuis son référentiel vers elle, et tout ce qui est saisi refait le
   chemin inverse avant enregistrement. Les données restent donc dans
   leur devise d'origine, quoi qu'on affiche.

   Le simulateur de la page d'accueil garde sa propre devise : un visiteur
   qui compare les offres n'a pas de compte, donc pas de réglage.
   -------------------------------------------------------------------- */
const DEVISE_REF = 'EUR';

function deviseAffichee() {
  return (typeof PARAMETRES_GENERAUX !== 'undefined' && PARAMETRES_GENERAUX.devise) || DEVISE_REF;
}
// Taux entre deux devises quelconques, déduits de la table DEVISES (pivot MAD).
function tauxEntre(depuis, vers) {
  return getDevise(vers).taux / getDevise(depuis).taux;
}
function versAffichage(montantEUR, deviseId = deviseAffichee()) {
  if (montantEUR === null || montantEUR === undefined) return montantEUR;
  return montantEUR * tauxEntre(DEVISE_REF, deviseId);
}
function versReference(montantAffiche, deviseId = deviseAffichee()) {
  if (montantAffiche === null || montantAffiche === undefined) return montantAffiche;
  return montantAffiche * tauxEntre(deviseId, DEVISE_REF);
}

function _formatDeviseIntl(valeur, deviseId, decimales) {
  const texte = new Intl.NumberFormat('fr-FR', {
    style: 'currency', currency: deviseId,
    // Sans narrowSymbol, le français écrit « 103 $US » et « 82 £GB » : correct
    // typographiquement, mais inhabituel dans une interface produit.
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: decimales, maximumFractionDigits: decimales
  }).format(valeur);
  /* Intl sépare le montant de la devise par une espace INSÉCABLE (U+00A0) :
     « 7 099 565 F CFA » devient alors un seul mot que rien ne peut couper, et
     il déborde de sa boîte au lieu de passer à la ligne. On la rend sécable
     pour offrir ce point de coupure — et un seul.
     Les séparateurs de milliers restent en espace fine insécable (U+202F) :
     eux ne doivent jamais casser, sous peine de lire « 7 099 » puis « 565 ». */
  return texte.replace(/ /g, ' ');
}

// Montant d'exploitation (stocké en euros), rendu dans la devise d'affichage.
function formatMontant(n, decimales = 0) {
  if (n === null || n === undefined) return 'Sur devis';
  const d = deviseAffichee();
  return _formatDeviseIntl(versAffichage(n, d), d, decimales);
}

// Prix d'abonnement (catalogue en MAD), rendu dans la même devise d'affichage.
function formatPrixAbo(n, decimales = 0) {
  if (n === null || n === undefined) return 'Sur devis';
  const d = deviseAffichee();
  return _formatDeviseIntl(convertirMAD(n, d), d, decimales);
}

// Symbole seul, pour les libellés de champs : « Tarif de base (€ / nuit) ».
function symboleDevise(deviseId = deviseAffichee()) { return getDevise(deviseId).symbole; }

/* Montant converti mais SANS symbole, pour les grilles denses où la devise
   est déjà nommée une fois en en-tête. Répéter « F CFA » dans chaque case
   d'un calendrier de 21 colonnes rend les chiffres illisibles alors que
   c'est justement eux qu'on vient lire. */
function formatMontantNu(n, decimales = 0) {
  if (n === null || n === undefined) return '—';
  return versAffichage(n).toLocaleString('fr-FR', {
    minimumFractionDigits: decimales, maximumFractionDigits: decimales,
  });
}

// Valeur à pré-remplir dans un <input type="number"> : convertie et arrondie
// à l'entier, un champ de saisie affichant douze décimales étant inutilisable.
function montantSaisie(montantEUR, deviseId = deviseAffichee()) {
  if (montantEUR === null || montantEUR === undefined || montantEUR === '') return '';
  return Math.round(versAffichage(montantEUR, deviseId));
}

/* Relecture d'un champ monétaire.

   Si l'utilisateur n'a pas touché à la valeur affichée, on renvoie le montant
   d'origine INTACT au lieu de le reconvertir. Sans cette précaution, ouvrir
   puis réenregistrer une fiche dans une devise à fort taux (FCFA, ~652 pour
   1 €) grignoterait quelques unités à chaque passage, par cumul d'arrondis.
   On ne reconvertit donc que ce qui a réellement été modifié. */
function lireMontantSaisi(valeurChamp, montantOrigineEUR, deviseId = deviseAffichee()) {
  const saisi = parseFloat(valeurChamp);
  if (!isFinite(saisi)) return montantOrigineEUR == null ? 0 : montantOrigineEUR;
  if (montantOrigineEUR != null && saisi === montantSaisie(montantOrigineEUR, deviseId)) return montantOrigineEUR;
  return Math.round(versReference(saisi, deviseId) * 100) / 100;
}
const MOIS_COURT = ['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
const MOIS_LONG  = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
const JOURS_COURT = ['dim.','lun.','mar.','mer.','jeu.','ven.','sam.'];
const JOURS_LONG  = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
function parseDate(s) { const [y,m,d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function formatDate(s, opts = {}) {
  const d = parseDate(s);
  const jour = opts.jourSemaine ? JOURS_COURT[d.getDay()] + ' ' : '';
  const mois = opts.moisLong ? MOIS_LONG[d.getMonth()] : MOIS_COURT[d.getMonth()];
  const annee = opts.annee ? ' ' + d.getFullYear() : '';
  return `${jour}${d.getDate()} ${mois}${annee}`;
}
function formatPlage(a, b) {
  const da = parseDate(a), db = parseDate(b);
  if (da.getMonth() === db.getMonth()) return `${da.getDate()}–${db.getDate()} ${MOIS_COURT[db.getMonth()]}`;
  return `${da.getDate()} ${MOIS_COURT[da.getMonth()]} – ${db.getDate()} ${MOIS_COURT[db.getMonth()]}`;
}
function nuitsEntre(a, b) { return Math.round((parseDate(b) - parseDate(a)) / 86400000); }
function addDays(s, n) {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/* ============================================================
   RÉFÉRENTIELS LOGEMENT — vocabulaire normalisé

   Ces listes reprennent le découpage réel des API de distribution
   (Airbnb, Booking.com, VRBO/Expedia). Elles servent de pivot : un
   channel manager reçoit des libellés différents selon la plateforme
   et les ramène toujours à ces identifiants-là. C'est ce qui permet
   de pousser une même fiche vers plusieurs canaux sans la ressaisir.
   ============================================================ */

// property_type côté Airbnb / accommodation type côté Booking.
const TYPES_LOGEMENT = [
  { id:'appartement', label:'Appartement' }, { id:'maison',  label:'Maison' },
  { id:'studio',      label:'Studio' },      { id:'loft',    label:'Loft' },
  { id:'villa',       label:'Villa' },       { id:'chalet',  label:'Chalet' },
  { id:'duplex',      label:'Duplex' },      { id:'autre',   label:'Autre' },
];

// room_type : ce que le voyageur loue réellement. Champ obligatoire chez
// Airbnb, et le plus structurant — il change le prix, les règles et le public.
const TYPES_CHAMBRE = [
  { id:'entier',   label:'Logement entier',   desc:"Le voyageur dispose de tout le logement." },
  { id:'privee',   label:'Chambre privée',    desc:"Chambre pour le voyageur, espaces communs partagés." },
  { id:'partagee', label:'Chambre partagée',  desc:"Le voyageur partage la chambre avec d'autres." },
];

// Configuration des couchages, pièce par pièce (bedrooms[].beds[] chez Airbnb).
const TYPES_LIT = [
  { id:'king',      label:'Lit king size',  places:2 },
  { id:'queen',     label:'Lit queen size', places:2 },
  { id:'double',    label:'Lit double',     places:2 },
  { id:'simple',    label:'Lit simple',     places:1 },
  { id:'canape',    label:'Canapé-lit',     places:2 },
  { id:'superpose', label:'Lits superposés',places:2 },
  { id:'bebe',      label:'Lit bébé',       places:0 },
];

// Équipements normalisés. Airbnb en expose une centaine ; on garde ceux
// qui pèsent sur le référencement et sur les questions des voyageurs.
const AMENITY_CATEGORIES = {
  essentiels:    'Essentiels',
  cuisine:       'Cuisine & repas',
  confort:       'Confort',
  exterieur:     'Extérieur & loisirs',
  stationnement: 'Stationnement & accès',
  securite:      'Sécurité',
  famille:       'Famille',
};
const AMENITIES = [
  { id:'wifi',          label:'Wi-Fi',                   cat:'essentiels' },
  { id:'wifi_fibre',    label:'Wi-Fi fibre',             cat:'essentiels' },
  { id:'chauffage',     label:'Chauffage',               cat:'essentiels' },
  { id:'clim',          label:'Climatisation',           cat:'essentiels' },
  { id:'eau_chaude',    label:'Eau chaude',              cat:'essentiels' },
  { id:'lave_linge',    label:'Lave-linge',              cat:'essentiels' },
  { id:'seche_linge',   label:'Sèche-linge',             cat:'essentiels' },
  { id:'linge_fourni',  label:'Draps et serviettes',     cat:'essentiels' },
  { id:'espace_travail',label:'Espace de travail',       cat:'essentiels' },
  { id:'tv',            label:'Télévision',              cat:'confort' },
  { id:'cuisine',       label:'Cuisine équipée',         cat:'cuisine' },
  { id:'lave_vaisselle',label:'Lave-vaisselle',          cat:'cuisine' },
  { id:'four',          label:'Four',                    cat:'cuisine' },
  { id:'micro_ondes',   label:'Micro-ondes',             cat:'cuisine' },
  { id:'cafetiere',     label:'Cafetière',               cat:'cuisine' },
  { id:'ascenseur',     label:'Ascenseur',               cat:'confort' },
  { id:'cheminee',      label:'Cheminée',                cat:'confort' },
  { id:'vue_mer',       label:'Vue mer',                 cat:'confort' },
  { id:'vue_lac',       label:'Vue lac',                 cat:'confort' },
  { id:'vue_monument',  label:'Vue sur monument',        cat:'confort' },
  { id:'balcon',        label:'Balcon',                  cat:'exterieur' },
  { id:'terrasse',      label:'Terrasse',                cat:'exterieur' },
  { id:'jardin',        label:'Jardin',                  cat:'exterieur' },
  { id:'piscine',       label:'Piscine',                 cat:'exterieur' },
  { id:'barbecue',      label:'Barbecue',                cat:'exterieur' },
  { id:'velos',         label:'Vélos',                   cat:'exterieur' },
  { id:'acces_plage',   label:'Accès direct à la plage', cat:'exterieur' },
  { id:'parking_gratuit',label:'Parking gratuit',        cat:'stationnement' },
  { id:'parking_payant',label:'Parking payant',          cat:'stationnement' },
  { id:'arrivee_auto',  label:'Arrivée autonome',        cat:'stationnement' },
  { id:'detecteur_fumee',label:'Détecteur de fumée',     cat:'securite' },
  { id:'detecteur_co',  label:'Détecteur de monoxyde',   cat:'securite' },
  { id:'extincteur',    label:'Extincteur',              cat:'securite' },
  { id:'trousse_secours',label:'Trousse de secours',     cat:'securite' },
  { id:'lit_bebe',      label:'Lit bébé',                cat:'famille' },
  { id:'chaise_haute',  label:'Chaise haute',            cat:'famille' },
];

// Politiques d'annulation : chaque plateforme a ses noms, mais tous les
// canaux se ramènent à ces quatre paliers.
const POLITIQUES_ANNULATION = [
  { id:'flexible',      label:'Flexible',            desc:"Remboursement intégral jusqu'à 24 h avant l'arrivée." },
  { id:'moderee',       label:'Modérée',             desc:"Remboursement intégral jusqu'à 5 jours avant l'arrivée." },
  { id:'stricte',       label:'Stricte',             desc:"Remboursement intégral dans les 48 h suivant la réservation, si l'arrivée est à plus de 14 jours." },
  { id:'non_remboursable', label:'Non remboursable', desc:"Aucun remboursement, tarif réduit en contrepartie." },
];

// Comment le voyageur entre dans le logement. Trois modes seulement, parce
// qu'ils ne se gèrent pas du tout pareil : l'un est piloté par une API
// (Seam), l'autre par un code saisi à la main, le dernier par un humain.
const TYPES_ACCES = [
  { id:'serrure_connectee', label:'Serrure connectée', desc:"Le code est créé et révoqué à distance sur la serrure, via Seam." },
  { id:'boite_cles',        label:'Boîte à clés',      desc:"Un code fixe, que vous définissez et changez quand vous le souhaitez." },
  { id:'personne',          label:'Remise en personne', desc:"Quelqu'un accueille le voyageur et lui remet les clés en main propre." },
];

const STATUT_ANNONCE = {
  publie:    { label:'Publiée',    badge:'badge--positive' },
  masque:    { label:'Masquée',    badge:'badge--neutral'  },
  en_pause:  { label:'En pause',   badge:'badge--warning'  },
  brouillon: { label:'Brouillon',  badge:'badge--neutral'  },
};

// Assiette de la taxe de séjour : elle varie d'une commune à l'autre.
const MODES_TAXE_SEJOUR = {
  par_personne_nuit: 'Par personne et par nuit',
  pourcentage:       'Pourcentage du prix de la nuit',
  par_sejour:        'Forfait par séjour',
};
/* ============================================================
   LOGEMENTS (10) — schéma normalisé de channel manager

   Chaque champ correspond à une donnée réellement échangée avec les
   plateformes (Airbnb, Booking.com, VRBO/Expedia). Le modèle est
   organisé comme chez Guesty ou Hospitable : un socle commun, que
   chaque canal consomme à sa façon.

   Les champs de premier niveau (nom, ville, adresse, type, capacite,
   tarifBase, menageTarif, codeAcces, wifi, note, couleur) restent à
   plat : ils sont lus partout dans l'app (réservations, messagerie,
   comptabilité, portail voyageur). Le reste est regroupé par thème.

   DEFAUTS_LOGEMENT documente le schéma complet et sert de base à
   chaque fiche : un logement ne déclare que ce qui lui est propre,
   et aucune fiche ne peut se retrouver avec un champ manquant —
   c'est ce qui casserait l'affichage du détail.
   ============================================================ */
const DEFAUTS_LOGEMENT = {
  statut: 'publie',                 // cf. STATUT_ANNONCE

  /* --- Annonce publique : ce que le voyageur lit avant de réserver --- */
  annonce: {
    titre: '',                      // titre commercial, distinct du nom interne
    resume: '',                     // « summary » Airbnb
    espace: '',                     // « the space » : description détaillée
    quartierTxt: '',                // « neighborhood overview »
    transports: '',                 // « getting around »
    aSavoir: '',                    // « other things to note »
  },

  /* --- Localisation --- */
  lieu: {
    rue: '', complement: '', codePostal: '', region: '',
    latitude: null, longitude: null,
    fuseau: 'Europe/Paris',
    adressePrecise: false,          // Airbnb ne révèle l'adresse exacte qu'après réservation
  },

  /* --- Structure & couchages --- */
  typeChambre: 'entier',            // cf. TYPES_CHAMBRE — champ obligatoire Airbnb
  typologie: '',                    // typologie française (T2, T3…), hors API
  surface: null,                    // m²
  sdbPrivees: 1, sdbPartagees: 0,
  couchages: [],                    // [{ piece, lits:[{ type, nb }] }]
  equipements: [],                  // identifiants AMENITIES

  /* --- Tarification --- */
  tarifs: {
    devise: 'EUR',
    weekend: null,                  // prix vendredi/samedi, null = même prix
    personnesIncluses: 2,
    personneSup: 0,                 // par personne au-delà du seuil, par nuit
    fraisMenagePar: 'sejour',       // sejour | nuit
    caution: 0,
    fraisAnimal: 0,
    taxeSejour: { mode: 'par_personne_nuit', montant: 0, plafondNuits: 7 },
    remises: { hebdo: 0, mensuelle: 0, earlyBirdJours: 0, earlyBird: 0, lastMinuteJours: 0, lastMinute: 0 },
    min: null, max: null,           // bornes de la tarification dynamique
    dynamique: { actif: false, source: null },
  },

  /* --- Disponibilité & restrictions de séjour --- */
  sejour: {
    nuitsMin: 2, nuitsMax: 30,
    preavis: 1,                     // délai minimum avant l'arrivée, en jours
    preparation: 0,                 // nuits bloquées entre deux séjours
    fenetreMois: 12,                // horizon d'ouverture du calendrier
    reservationInstantanee: true,
    arrivee: '15:00', arriveeMax: '21:00', depart: '11:00',
    arriveeFlexible: false,
    joursArrivee: ['lun','mar','mer','jeu','ven','sam','dim'],
    joursDepart:  ['lun','mar','mer','jeu','ven','sam','dim'],
  },

  /* --- Politiques & règlement intérieur --- */
  politiqueAnnulation: 'moderee',
  regles: {
    fumeurs: false, animaux: false, animauxMax: 0,
    fetes: false, enfants: true, bebes: true,
    silenceDebut: '22:00', silenceFin: '08:00',
    complement: '',
  },

  /* --- Accès & logistique terrain ---
     Le code en vigueur reste `codeAcces` à plat : c'est lui que lisent la
     messagerie, le portail voyageur et les automatisations. Les trois
     sous-objets ci-dessous décrivent COMMENT ce code (ou son absence) est
     produit, ce qui n'est pas la même mécanique d'un mode à l'autre. */
  acces: {
    type: 'boite_cles',             // cf. TYPES_ACCES
    emplacementCles: '',
    etage: 0, ascenseur: false,
    parking: '',
    instructions: '',
    contactUrgence: '',

    // Mode « serrure connectée » : piloté par Seam (cf. Seam plus bas).
    // Aucun code n'existe côté Oyvia tant que la serrure n'en a pas créé un.
    serrure: {
      connectee: false,
      fournisseur: 'seam',
      deviceId: '',                 // identifiant du device chez Seam
      marque: '', modele: '',
      batterie: null,               // %, null si le device ne la remonte pas
      enLigne: false,
      verrouillee: true,
      derniereSynchro: '',
      // code actif : { valeur, statut, creeLe, debut, fin, seamId }
      // statut : actif | programme | expire — null = aucun code sur la serrure
      code: null,
    },

    // Mode « boîte à clés » : un code fixe, changé à la main.
    boiteCles: { emplacement: '', modele: '', modifieLe: '' },

    // Mode « remise en personne » : qui remet les clés, et comment le joindre.
    personne: {
      nom: '', role: '', telephone: '', email: '',
      langues: [], disponibilites: '', lieuRdv: '', notes: '',
    },
  },

  /* --- Conformité (déclaration en mairie, plafond de nuitées) --- */
  conformite: {
    numeroEnregistrement: '', typeDeclaration: 'meuble_tourisme',
    plafondNuits: null, nuitsConsommees: 0,
    assurance: '',
  },

  /* --- Notes détaillées, telles que renvoyées par Airbnb --- */
  notesDetail: { proprete: 0, precision: 0, arrivee: 0, communication: 0, emplacement: 0, qualitePrix: 0 },
  superhote: false,

  /* --- Photos : ordre + légende ; la première est la couverture --- */
  photos: [],

  /* Fichier de couverture, dans assets/logements/. Sert d'abord à
     RECONNAÎTRE le logement : le nom seul se lit, la photo se repère.
     Sur un calendrier de dix lignes ou une grille de tarifs, l'œil
     retrouve « le chalet » avant d'avoir fini de lire « Chalet vue lac
     d'Annecy ». La couleur reste : elle sert de fond tant que l'image
     n'est pas chargée, et de repli si le fichier manque. */
  couverture: null,

  /* --- Connexions aux plateformes ---
     Deux états distincts, qu'il ne faut pas confondre :
     - `connecte` : le canal est rattaché à ce logement (identifiant d'annonce
       connu). Le débrancher fait perdre le lien.
     - `actif`    : la synchronisation tourne. La mettre en pause n'efface
       rien — l'annonce et l'identifiant restent, on arrête juste d'échanger.
     statut : ok | attention | erreur · listingId = identifiant chez le canal */
  canaux: {},
};

// Chaque fiche ne déclare que ses spécificités : la fusion garantit qu'aucun
// champ ne manque, y compris dans les sous-objets.
function _logement(o) {
  const D = DEFAUTS_LOGEMENT;
  return {
    ...D, ...o,
    annonce:    { ...D.annonce,    ...(o.annonce    || {}) },
    lieu:       { ...D.lieu,       ...(o.lieu       || {}) },
    tarifs:     { ...D.tarifs,     ...(o.tarifs     || {}),
                  taxeSejour: { ...D.tarifs.taxeSejour, ...((o.tarifs || {}).taxeSejour || {}) },
                  remises:    { ...D.tarifs.remises,    ...((o.tarifs || {}).remises    || {}) },
                  dynamique:  { ...D.tarifs.dynamique,  ...((o.tarifs || {}).dynamique  || {}) } },
    sejour:     { ...D.sejour,     ...(o.sejour     || {}) },
    regles:     { ...D.regles,     ...(o.regles     || {}) },
    acces:      { ...D.acces,      ...(o.acces      || {}),
                  serrure:    { ...D.acces.serrure,    ...((o.acces || {}).serrure    || {}) },
                  boiteCles:  { ...D.acces.boiteCles,  ...((o.acces || {}).boiteCles  || {}) },
                  personne:   { ...D.acces.personne,   ...((o.acces || {}).personne   || {}) } },
    conformite: { ...D.conformite, ...(o.conformite || {}) },
    notesDetail:{ ...D.notesDetail,...(o.notesDetail|| {}) },
    // Un canal branché synchronise, sauf mention contraire : `actif` est donc
    // implicite dans les fiches, et seule une mise en pause s'écrit.
    canaux: Object.fromEntries(Object.entries(o.canaux || {}).map(([k, c]) => [k, { actif: true, ...c }])),
  };
}
const LOGEMENTS = [
  _logement({
    id:'L001', nom:'T2 Vieux-Lyon avec balcon', couleur:'#B5654A',
    couverture:'L001.jpg',
    ville:'Lyon', quartier:'Vieux-Lyon', pays:'France',
    adresse:'12 rue du Bœuf, 69005 Lyon',
    type:'appartement', typologie:'T2', typeChambre:'entier',
    capacite:4, chambres:1, lits:2, sdb:1, surface:48,
    tarifBase:95, menageTarif:45, note:4.9, avis:127, superhote:true,
    annonce:{
      titre:"T2 avec balcon au cœur du Vieux-Lyon — vue cour calme",
      resume:"Appartement rénové de 48 m² dans un immeuble Renaissance, à 5 minutes à pied de la cathédrale Saint-Jean. Balcon sur cour intérieure, très calme malgré l'hyper-centre.",
      espace:"Séjour avec canapé-lit, chambre séparée avec lit double, cuisine entièrement équipée et salle de bain avec douche à l'italienne. Le balcon donne sur une cour intérieure plantée.",
      quartierTxt:"Le Vieux-Lyon est piéton et classé au patrimoine mondial. Boulangerie ouverte 7 j/7 au coin de la rue, marché Saint-Antoine à 10 minutes.",
      transports:"Métro D Vieux-Lyon à 300 m. Aéroport Saint-Exupéry en 45 min via le Rhônexpress depuis Part-Dieu.",
      aSavoir:"Immeuble ancien du XVIᵉ : la porte de la rue coince un peu, il faut pousser en tournant la clé.",
    },
    lieu:{ rue:'12 rue du Bœuf', codePostal:'69005', region:'Auvergne-Rhône-Alpes', latitude:45.7623, longitude:4.8271 },
    couchages:[
      { piece:'Chambre 1', lits:[{ type:'double', nb:1 }] },
      { piece:'Séjour',    lits:[{ type:'canape', nb:1 }] },
    ],
    equipements:['wifi_fibre','chauffage','eau_chaude','lave_linge','linge_fourni','espace_travail','tv','cuisine','lave_vaisselle','four','micro_ondes','cafetiere','balcon','arrivee_auto','detecteur_fumee','detecteur_co','extincteur','trousse_secours'],
    tarifs:{ weekend:115, personnesIncluses:2, personneSup:15, caution:300,
      taxeSejour:{ mode:'par_personne_nuit', montant:2.30, plafondNuits:7 },
      remises:{ hebdo:10, mensuelle:25, earlyBirdJours:60, earlyBird:8, lastMinuteJours:7, lastMinute:12 },
      min:75, max:180, dynamique:{ actif:true, source:'PriceLabs' } },
    sejour:{ nuitsMin:2, nuitsMax:30, preavis:1, preparation:0, arrivee:'15:00', arriveeMax:'22:00', depart:'11:00', arriveeFlexible:true },
    politiqueAnnulation:'moderee',
    regles:{ fumeurs:false, animaux:false, fetes:false, complement:"Pas de bruit après 22 h. Fumer est autorisé sur le balcon uniquement." },
    acces:{ type:'boite_cles', emplacementCles:"Boîte à clés noire, à droite de la porte d'entrée", etage:2, ascenseur:false,
      parking:"Parking Saint-Jean à 100 m, payant, 15 €/nuit",
      instructions:"Composez le code sur la boîte à clés, prenez le trousseau, 2ᵉ étage porte gauche.",
      contactUrgence:'+33 6 12 45 78 90',
      boiteCles:{ emplacement:"À droite de la porte d'entrée, sous l'interphone", modele:'Master Lock 5401EURD', modifieLe:'2026-04-12' } },
    codeAcces:'A2481', wifi:{ ssid:'Oyvia-VieuxLyon', pass:'balcon2024' },
    conformite:{ numeroEnregistrement:'6938300123456', plafondNuits:120, nuitsConsommees:87, assurance:'AXA Loueur meublé n° 4417820' },
    notesDetail:{ proprete:4.9, precision:4.8, arrivee:5.0, communication:4.9, emplacement:5.0, qualitePrix:4.7 },
    photos:[
      { legende:'Séjour et balcon' }, { legende:'Chambre' }, { legende:'Cuisine équipée' },
      { legende:'Salle de bain' }, { legende:'Vue depuis le balcon' }, { legende:"Entrée de l'immeuble" },
    ],
    canaux:{
      airbnb: { connecte:true, statut:'ok', listingId:'AB-48211937', url:'https://airbnb.fr/rooms/48211937', note:4.9, avis:98,  commission:3,  derniereSynchro:'2026-07-23 12:40' },
      booking:{ connecte:true, statut:'ok', listingId:'BK-8842190',  url:'https://booking.com/hotel/fr/8842190', note:9.2, avis:29, commission:15, derniereSynchro:'2026-07-23 12:38' },
      direct: { connecte:true, statut:'ok', listingId:'OY-L001',     url:'https://oyvia.com/l/t2-vieux-lyon', note:null, avis:0, commission:0, derniereSynchro:'2026-07-23 12:41' },
    },
  }),

  _logement({
    id:'L002', nom:'Studio Montmartre lumineux', couleur:'#3D5A80',
    couverture:'L002.jpg',
    ville:'Paris', quartier:'Montmartre', pays:'France',
    adresse:'8 rue Lepic, 75018 Paris',
    type:'studio', typologie:'T1', typeChambre:'entier',
    capacite:2, chambres:1, lits:1, sdb:1, surface:26,
    tarifBase:78, menageTarif:35, note:4.7, avis:203, superhote:true,
    annonce:{
      titre:"Studio lumineux rue Lepic — 5 min du Sacré-Cœur",
      resume:"Studio de 26 m² au 3ᵉ étage sans ascenseur, en plein Montmartre. Grande fenêtre plein sud, vue sur les toits.",
      espace:"Pièce de vie avec lit double, coin cuisine équipé, salle d'eau séparée.",
      quartierTxt:"Rue Lepic, entre le marché et le Moulin de la Galette. Commerces de bouche au pied de l'immeuble.",
      transports:"Métro Blanche et Abbesses à 5 minutes. Gare du Nord en 15 min.",
      aSavoir:"3ᵉ étage sans ascenseur : à signaler aux voyageurs qui annoncent de grosses valises. La rue est en pente.",
    },
    lieu:{ rue:'8 rue Lepic', codePostal:'75018', region:'Île-de-France', latitude:48.8846, longitude:2.3376 },
    couchages:[{ piece:'Pièce principale', lits:[{ type:'double', nb:1 }] }],
    equipements:['wifi','chauffage','eau_chaude','lave_linge','linge_fourni','tv','cuisine','micro_ondes','cafetiere','vue_monument','arrivee_auto','detecteur_fumee','extincteur'],
    tarifs:{ weekend:92, personnesIncluses:2, caution:250,
      taxeSejour:{ mode:'par_personne_nuit', montant:5.20, plafondNuits:7 },
      remises:{ hebdo:8, mensuelle:20, lastMinuteJours:5, lastMinute:10 },
      min:62, max:140, dynamique:{ actif:true, source:'PriceLabs' } },
    sejour:{ nuitsMin:2, nuitsMax:21, preavis:1, arrivee:'16:00', arriveeMax:'23:00', depart:'11:00' },
    politiqueAnnulation:'stricte',
    regles:{ complement:"Immeuble ancien : merci d'éviter le bruit dans les escaliers après 21 h." },
    acces:{ type:'boite_cles', emplacementCles:"Boîte à clés dans le hall, sous les boîtes aux lettres", etage:3, ascenseur:false,
      parking:"Aucun stationnement sur place, parking Anvers à 400 m",
      instructions:"Composez le code à la porte de la rue, boîte à clés dans le hall, puis 3ᵉ étage porte droite.",
      contactUrgence:'+33 6 12 45 78 90',
      boiteCles:{ emplacement:'Dans le hall, sous les boîtes aux lettres', modele:'Igloohome Keybox 3', modifieLe:'2026-02-28' } },
    codeAcces:'7734B', wifi:{ ssid:'OyviaParis18', pass:'lepic0018' },
    conformite:{ numeroEnregistrement:'7511800987654', plafondNuits:120, nuitsConsommees:112, assurance:'AXA Loueur meublé n° 4417820' },
    notesDetail:{ proprete:4.8, precision:4.6, arrivee:4.7, communication:4.9, emplacement:4.9, qualitePrix:4.5 },
    photos:[{ legende:'Pièce principale' }, { legende:'Coin cuisine' }, { legende:'Salle d\'eau' }, { legende:'Vue sur les toits' }],
    canaux:{
      airbnb: { connecte:true, statut:'ok', listingId:'AB-31905442', url:'https://airbnb.fr/rooms/31905442', note:4.7, avis:167, commission:3,  derniereSynchro:'2026-07-23 12:40' },
      booking:{ connecte:true, statut:'ok', listingId:'BK-6610233',  url:'https://booking.com/hotel/fr/6610233', note:8.9, avis:36, commission:15, derniereSynchro:'2026-07-23 12:39' },
      direct: { connecte:true, statut:'ok', listingId:'OY-L002',     url:'https://oyvia.com/l/studio-montmartre', note:null, avis:0, commission:0, derniereSynchro:'2026-07-23 12:41' },
    },
  }),

  _logement({
    id:'L003', nom:'Appartement Chartrons design', couleur:'#5B7A6B',
    couverture:'L003.jpg',
    ville:'Bordeaux', quartier:'Chartrons', pays:'France',
    adresse:'24 cours de la Martinique, 33000 Bordeaux',
    type:'appartement', typologie:'T3', typeChambre:'entier',
    capacite:4, chambres:2, lits:3, sdb:1, surface:65,
    tarifBase:88, menageTarif:40, note:4.8, avis:96,
    annonce:{
      titre:"T3 design aux Chartrons — terrasse et parking",
      resume:"Appartement de 65 m² entièrement rénové dans le quartier des antiquaires, avec terrasse et place de parking privative.",
      espace:"Deux chambres, séjour ouvert sur la cuisine, terrasse de 12 m² exposée ouest.",
      quartierTxt:"Les Chartrons : brocantes, quais aménagés et marché dominical au bord de la Garonne.",
      transports:"Tram B station CAPC à 5 minutes. Gare Saint-Jean en 20 min.",
    },
    lieu:{ rue:'24 cours de la Martinique', codePostal:'33000', region:'Nouvelle-Aquitaine', latitude:44.8543, longitude:-0.5701 },
    couchages:[
      { piece:'Chambre 1', lits:[{ type:'queen', nb:1 }] },
      { piece:'Chambre 2', lits:[{ type:'simple', nb:2 }] },
    ],
    equipements:['wifi_fibre','chauffage','clim','eau_chaude','lave_linge','seche_linge','linge_fourni','espace_travail','tv','cuisine','lave_vaisselle','four','micro_ondes','terrasse','parking_gratuit','detecteur_fumee','detecteur_co','extincteur'],
    tarifs:{ weekend:104, personnesIncluses:2, personneSup:12, caution:400,
      taxeSejour:{ mode:'par_personne_nuit', montant:2.10, plafondNuits:7 },
      remises:{ hebdo:12, mensuelle:22 }, min:70, max:150 },
    sejour:{ nuitsMin:3, nuitsMax:60, preavis:2, preparation:1, arrivee:'16:00', depart:'10:00', joursArrivee:['ven','sam','dim','lun'] },
    politiqueAnnulation:'moderee',
    regles:{ animaux:true, animauxMax:1 },
    acces:{ type:'serrure_connectee', emplacementCles:'Serrure connectée, code envoyé la veille', etage:1, ascenseur:true,
      parking:"Place privative n° 12 au sous-sol, hauteur max 1,90 m",
      instructions:"Le code de la serrure est envoyé automatiquement 24 h avant l'arrivée.",
      contactUrgence:'+33 6 12 45 78 90',
      serrure:{ connectee:true, deviceId:'seam_dev_9c41ab72e0', marque:'Nuki', modele:'Smart Lock 4.0 Pro',
        batterie:78, enLigne:true, verrouillee:true, derniereSynchro:'2026-07-23 12:35',
        code:{ valeur:'C9012', statut:'actif', creeLe:'2026-07-17 09:02', debut:'2026-07-18 14:00', fin:'2026-07-23 11:00', seamId:'seam_code_4f0b18d3' } } },
    codeAcces:'C9012', wifi:{ ssid:'Oyvia-Chartrons', pass:'design2024' },
    conformite:{ numeroEnregistrement:'3306300445566', plafondNuits:120, nuitsConsommees:54 },
    notesDetail:{ proprete:4.9, precision:4.8, arrivee:4.7, communication:4.8, emplacement:4.7, qualitePrix:4.8 },
    photos:[{ legende:'Séjour' }, { legende:'Terrasse' }, { legende:'Chambre 1' }, { legende:'Chambre 2' }, { legende:'Cuisine' }],
    canaux:{
      airbnb: { connecte:true, statut:'ok',        listingId:'AB-52847103', url:'https://airbnb.fr/rooms/52847103', note:4.8, avis:71, commission:3,  derniereSynchro:'2026-07-23 12:40' },
      booking:{ connecte:true, statut:'attention', listingId:'BK-9034117',  url:'https://booking.com/hotel/fr/9034117', note:9.0, avis:25, commission:15, derniereSynchro:'2026-07-21 08:12', message:"Tarifs refusés par Booking : la caution dépasse le plafond autorisé sur ce canal." },
      direct: { connecte:true, statut:'ok',        listingId:'OY-L003',     url:'https://oyvia.com/l/chartrons-design', note:null, avis:0, commission:0, derniereSynchro:'2026-07-23 12:41' },
    },
  }),

  _logement({
    id:'L004', nom:"Chalet vue lac d'Annecy", couleur:'#4A6A58',
    couverture:'L004.jpg',
    ville:'Annecy', quartier:'Veyrier-du-Lac', pays:'France',
    adresse:'5 chemin des Cyprès, 74290 Veyrier-du-Lac',
    type:'chalet', typeChambre:'entier',
    capacite:6, chambres:3, lits:4, sdb:2, surface:120,
    tarifBase:165, menageTarif:70, note:5.0, avis:64, superhote:true,
    annonce:{
      titre:"Chalet avec vue lac à Veyrier — cheminée et jardin",
      resume:"Chalet familial de 120 m² surplombant le lac d'Annecy, avec jardin clos et cheminée.",
      espace:"Trois chambres, deux salles de bain, grand séjour avec cheminée, cuisine ouverte, jardin de 400 m².",
      quartierTxt:"Veyrier-du-Lac, rive est du lac. Plage à 800 m, sentiers de randonnée au départ du chalet.",
      transports:"Voiture indispensable. Annecy centre à 10 min, Genève à 50 min.",
      aSavoir:"Chemin d'accès en pente, verglacé en hiver : pneus neige conseillés de décembre à mars.",
    },
    lieu:{ rue:'5 chemin des Cyprès', codePostal:'74290', region:'Auvergne-Rhône-Alpes', latitude:45.8721, longitude:6.1898 },
    couchages:[
      { piece:'Chambre 1', lits:[{ type:'king', nb:1 }] },
      { piece:'Chambre 2', lits:[{ type:'double', nb:1 }] },
      { piece:'Chambre 3', lits:[{ type:'simple', nb:2 }] },
    ],
    equipements:['wifi','chauffage','eau_chaude','lave_linge','seche_linge','linge_fourni','tv','cuisine','lave_vaisselle','four','micro_ondes','cafetiere','cheminee','vue_lac','jardin','barbecue','parking_gratuit','detecteur_fumee','detecteur_co','extincteur','trousse_secours','lit_bebe','chaise_haute'],
    tarifs:{ weekend:195, personnesIncluses:4, personneSup:25, caution:800, fraisAnimal:30,
      taxeSejour:{ mode:'par_personne_nuit', montant:1.80, plafondNuits:7 },
      remises:{ hebdo:15, mensuelle:30, earlyBirdJours:90, earlyBird:10 },
      min:120, max:320, dynamique:{ actif:true, source:'PriceLabs' } },
    sejour:{ nuitsMin:3, nuitsMax:90, preavis:2, preparation:1, fenetreMois:18, reservationInstantanee:false,
      arrivee:'17:00', arriveeMax:'21:00', depart:'10:00', joursArrivee:['sam'], joursDepart:['sam'] },
    politiqueAnnulation:'stricte',
    regles:{ animaux:true, animauxMax:2, fetes:false, complement:"Le jardin est clos mais non surveillé." },
    acces:{ type:'boite_cles', emplacementCles:'Boîte à clés sur le portail, à gauche', etage:0, ascenseur:false,
      parking:"2 places dans la cour, portail automatique",
      instructions:"Le portail s'ouvre avec la télécommande laissée dans l'entrée. Une clé de secours se trouve dans le boîtier à gauche.",
      contactUrgence:'+33 6 12 45 78 90',
      boiteCles:{ emplacement:'Sur le portail, à gauche du portillon', modele:'Master Lock 5440EURD', modifieLe:'2026-05-30' } },
    codeAcces:'CH440', wifi:{ ssid:'ChaletLac', pass:'annecy2024' },
    conformite:{ numeroEnregistrement:'7429000778899', assurance:'Allianz Multirisque location saisonnière' },
    notesDetail:{ proprete:5.0, precision:5.0, arrivee:4.9, communication:5.0, emplacement:5.0, qualitePrix:4.9 },
    photos:[{ legende:'Vue sur le lac' }, { legende:'Séjour et cheminée' }, { legende:'Jardin' }, { legende:'Chambre parentale' }, { legende:'Cuisine ouverte' }, { legende:'Terrasse' }],
    canaux:{
      airbnb: { connecte:true, statut:'ok', listingId:'AB-61230944', url:'https://airbnb.fr/rooms/61230944', note:5.0, avis:47, commission:3,  derniereSynchro:'2026-07-23 12:40' },
      booking:{ connecte:true, statut:'ok', listingId:'BK-7719004',  url:'https://booking.com/hotel/fr/7719004', note:9.6, avis:17, commission:15, derniereSynchro:'2026-07-23 12:39' },
      direct: { connecte:true, statut:'ok', listingId:'OY-L004',     url:'https://oyvia.com/l/chalet-annecy', note:null, avis:0, commission:0, derniereSynchro:'2026-07-23 12:41' },
      vrbo:   { connecte:true, statut:'ok', listingId:'VR-2299013',  url:'https://vrbo.com/2299013', note:4.8, avis:12, commission:8, derniereSynchro:'2026-07-23 11:05' },
    },
  }),

  _logement({
    id:'L005', nom:'Villa front de mer', couleur:'#C99A3C',
    couverture:'L005.jpg',
    ville:'Biarritz', quartier:'Côte des Basques', pays:'France',
    adresse:'18 avenue de la Plage, 64200 Biarritz',
    type:'villa', typeChambre:'entier',
    capacite:8, chambres:4, lits:5, sdb:3, surface:210,
    tarifBase:240, menageTarif:90, note:4.9, avis:81, superhote:true,
    annonce:{
      titre:"Villa front de mer à Biarritz — piscine et accès plage",
      resume:"Villa de 210 m² face à l'océan, avec piscine et accès direct à la Côte des Basques.",
      espace:"Quatre chambres, trois salles de bain, vaste séjour ouvert sur la terrasse et la piscine.",
      quartierTxt:"Côte des Basques, spot de surf historique. Centre de Biarritz à 15 min à pied.",
      transports:"Aéroport de Biarritz à 10 min en voiture. Gare à 15 min.",
      aSavoir:"Piscine non chauffée, ouverte d'avril à octobre.",
    },
    lieu:{ rue:'18 avenue de la Plage', codePostal:'64200', region:'Nouvelle-Aquitaine', latitude:43.4772, longitude:-1.5652 },
    couchages:[
      { piece:'Chambre 1', lits:[{ type:'king', nb:1 }] },
      { piece:'Chambre 2', lits:[{ type:'queen', nb:1 }] },
      { piece:'Chambre 3', lits:[{ type:'double', nb:1 }] },
      { piece:'Chambre 4', lits:[{ type:'simple', nb:2 }] },
    ],
    equipements:['wifi_fibre','chauffage','clim','eau_chaude','lave_linge','seche_linge','linge_fourni','espace_travail','tv','cuisine','lave_vaisselle','four','micro_ondes','cafetiere','vue_mer','terrasse','jardin','piscine','barbecue','acces_plage','parking_gratuit','detecteur_fumee','detecteur_co','extincteur','trousse_secours','lit_bebe','chaise_haute'],
    tarifs:{ weekend:290, personnesIncluses:6, personneSup:35, caution:1500,
      taxeSejour:{ mode:'pourcentage', montant:5, plafondNuits:7 },
      remises:{ hebdo:10, mensuelle:20, earlyBirdJours:120, earlyBird:12 },
      min:180, max:520, dynamique:{ actif:true, source:'PriceLabs' } },
    sejour:{ nuitsMin:5, nuitsMax:60, preavis:3, preparation:1, fenetreMois:18, reservationInstantanee:false,
      arrivee:'16:00', arriveeMax:'20:00', depart:'10:00', joursArrivee:['sam'], joursDepart:['sam'] },
    politiqueAnnulation:'stricte',
    regles:{ animaux:true, animauxMax:1, fetes:false, complement:"Piscine non surveillée : enfants sous la responsabilité des parents. Aucun événement sans accord écrit." },
    acces:{ type:'personne', emplacementCles:'Remise en main propre', etage:0, ascenseur:false,
      parking:"2 places dans la cour fermée",
      instructions:"Accueil sur place par la conciergerie, merci de confirmer votre heure d'arrivée la veille.",
      contactUrgence:'+33 6 12 45 78 90',
      personne:{ nom:'Céline Barrère', role:'Conciergerie Côte Basque', telephone:'+33 6 84 22 07 51',
        email:'celine@conciergerie-cotebasque.fr', langues:['Français','Anglais','Espagnol'],
        disponibilites:'Tous les jours, 9 h – 20 h · prévenir la veille pour une arrivée après 20 h',
        lieuRdv:"Devant le portail de la villa, 14 avenue de l'Impératrice",
        notes:"Fait le tour de la maison avec les voyageurs et relève les compteurs. Double des clés conservé à son bureau, à 5 min." } },
    codeAcces:'VILLA6', wifi:{ ssid:'VillaBiarritz', pass:'ocean2024' },
    conformite:{ numeroEnregistrement:'6412200112233', plafondNuits:null, assurance:'Allianz Multirisque location saisonnière' },
    notesDetail:{ proprete:4.9, precision:4.9, arrivee:4.8, communication:5.0, emplacement:5.0, qualitePrix:4.6 },
    photos:[{ legende:'Vue océan' }, { legende:'Piscine' }, { legende:'Séjour' }, { legende:'Chambre parentale' }, { legende:'Terrasse' }, { legende:'Cuisine' }],
    canaux:{
      airbnb: { connecte:true, statut:'ok', listingId:'AB-70118225', url:'https://airbnb.fr/rooms/70118225', note:4.9, avis:58, commission:3,  derniereSynchro:'2026-07-23 12:40' },
      booking:{ connecte:true, statut:'ok', listingId:'BK-8123776',  url:'https://booking.com/hotel/fr/8123776', note:9.4, avis:23, commission:15, derniereSynchro:'2026-07-23 12:39' },
      direct: { connecte:true, statut:'ok', listingId:'OY-L005',     url:'https://oyvia.com/l/villa-biarritz', note:null, avis:0, commission:0, derniereSynchro:'2026-07-23 12:41' },
      vrbo:   { connecte:true, statut:'ok', listingId:'VR-3390771',  url:'https://vrbo.com/3390771', note:4.9, avis:9, commission:8, derniereSynchro:'2026-07-23 11:05' },
    },
  }),

  _logement({
    id:'L006', nom:'Loft Vieux-Port', couleur:'#8A5A3C',
    couverture:'L006.jpg',
    ville:'Marseille', quartier:'Le Panier', pays:'France',
    adresse:'3 rue du Panier, 13002 Marseille',
    type:'loft', typeChambre:'entier',
    capacite:3, chambres:1, lits:2, sdb:1, surface:42,
    tarifBase:82, menageTarif:35, note:4.6, avis:112,
    annonce:{
      titre:"Loft d'artiste au Panier — 5 min du Vieux-Port",
      resume:"Loft de 42 m² sous verrière dans le plus vieux quartier de Marseille.",
      espace:"Espace ouvert avec mezzanine, cuisine américaine, salle d'eau.",
      quartierTxt:"Le Panier, ses ruelles colorées et ses ateliers d'artistes. MuCEM à 10 minutes.",
      transports:"Métro Vieux-Port à 6 minutes à pied.",
    },
    lieu:{ rue:'3 rue du Panier', codePostal:'13002', region:"Provence-Alpes-Côte d'Azur", latitude:43.2988, longitude:5.3690 },
    couchages:[
      { piece:'Mezzanine', lits:[{ type:'double', nb:1 }] },
      { piece:'Séjour',    lits:[{ type:'canape', nb:1 }] },
    ],
    equipements:['wifi','chauffage','clim','eau_chaude','lave_linge','linge_fourni','tv','cuisine','micro_ondes','arrivee_auto','detecteur_fumee','extincteur'],
    tarifs:{ weekend:96, personnesIncluses:2, personneSup:14, caution:250,
      taxeSejour:{ mode:'par_personne_nuit', montant:1.65, plafondNuits:7 },
      remises:{ hebdo:8, mensuelle:18 }, min:60, max:130 },
    sejour:{ nuitsMin:2, preavis:1, arrivee:'15:00', depart:'11:00' },
    politiqueAnnulation:'flexible',
    acces:{ type:'boite_cles', emplacementCles:'Boîte à clés côté droit de la porte', etage:1, ascenseur:false,
      parking:"Aucun stationnement, ruelles piétonnes. Parking Vieux-Port à 500 m",
      instructions:"Ruelle piétonne : les taxis vous déposent place de Lenche, à 100 m.",
      contactUrgence:'+33 6 12 45 78 90',
      boiteCles:{ emplacement:'Côté droit de la porte, à hauteur de poignée', modele:'Master Lock 5401EURD', modifieLe:'2026-06-08' } },
    codeAcces:'MRS13', wifi:{ ssid:'LoftPanier', pass:'marseille13' },
    conformite:{ numeroEnregistrement:'1320200334455', plafondNuits:120, nuitsConsommees:71 },
    notesDetail:{ proprete:4.5, precision:4.6, arrivee:4.7, communication:4.8, emplacement:4.9, qualitePrix:4.6 },
    photos:[{ legende:'Espace de vie' }, { legende:'Mezzanine' }, { legende:'Cuisine' }, { legende:'Ruelle du Panier' }],
    canaux:{
      airbnb: { connecte:true,  statut:'ok', listingId:'AB-44902118', url:'https://airbnb.fr/rooms/44902118', note:4.6, avis:88, commission:3,  derniereSynchro:'2026-07-23 12:40' },
      booking:{ connecte:true,  statut:'ok', listingId:'BK-7005512',  url:'https://booking.com/hotel/fr/7005512', note:8.7, avis:24, commission:15, derniereSynchro:'2026-07-23 12:39' },
      direct: { connecte:true,  statut:'ok', listingId:'OY-L006',     url:'https://oyvia.com/l/loft-panier', note:null, avis:0, commission:0, derniereSynchro:'2026-07-23 12:41' },
    },
  }),

  _logement({
    id:'L007', nom:'Studio Promenade des Anglais', couleur:'#3D6E80',
    couverture:'L007.jpg',
    ville:'Nice', quartier:'Promenade', pays:'France',
    adresse:'45 promenade des Anglais, 06000 Nice',
    type:'studio', typologie:'T1', typeChambre:'entier',
    capacite:2, chambres:1, lits:1, sdb:1, surface:30,
    tarifBase:72, menageTarif:30, note:4.7, avis:158,
    annonce:{
      titre:"Studio vue mer sur la Promenade des Anglais",
      resume:"Studio de 30 m² au 4ᵉ étage avec balcon et vue frontale sur la Baie des Anges.",
      espace:"Pièce de vie avec lit double, kitchenette, salle d'eau, balcon plein sud.",
      quartierTxt:"Face à la plage, à 10 minutes du Vieux-Nice et du marché aux fleurs.",
      transports:"Aéroport de Nice à 10 min en tram. Arrêt Congrès à 200 m.",
    },
    lieu:{ rue:'45 promenade des Anglais', codePostal:'06000', region:"Provence-Alpes-Côte d'Azur", latitude:43.6934, longitude:7.2489 },
    couchages:[{ piece:'Pièce principale', lits:[{ type:'double', nb:1 }] }],
    equipements:['wifi','chauffage','clim','eau_chaude','linge_fourni','tv','cuisine','micro_ondes','balcon','vue_mer','ascenseur','arrivee_auto','detecteur_fumee','extincteur'],
    tarifs:{ weekend:88, personnesIncluses:2, caution:200,
      taxeSejour:{ mode:'par_personne_nuit', montant:2.75, plafondNuits:7 },
      remises:{ hebdo:10, mensuelle:20, lastMinuteJours:7, lastMinute:15 },
      min:55, max:145, dynamique:{ actif:true, source:'PriceLabs' } },
    sejour:{ nuitsMin:2, nuitsMax:30, preavis:1, arrivee:'15:00', arriveeMax:'22:00', depart:'11:00', arriveeFlexible:true },
    politiqueAnnulation:'moderee',
    acces:{ type:'boite_cles', emplacementCles:'Boîte à clés dans le hall', etage:4, ascenseur:true,
      parking:"Parking public Ferber à 300 m, 18 €/jour",
      instructions:"Hall d'immeuble ouvert de 7 h à 22 h ; au-delà, appelez le gardien.",
      contactUrgence:'+33 6 12 45 78 90',
      boiteCles:{ emplacement:'Dans le hall, colonne de droite après les boîtes aux lettres', modele:'Igloohome Keybox 3', modifieLe:'2026-03-19' } },
    codeAcces:'NCE07', wifi:{ ssid:'OyviaNice', pass:'promenade06' },
    conformite:{ numeroEnregistrement:'0608800556677', plafondNuits:120, nuitsConsommees:98 },
    notesDetail:{ proprete:4.7, precision:4.7, arrivee:4.8, communication:4.7, emplacement:5.0, qualitePrix:4.5 },
    photos:[{ legende:'Vue mer depuis le balcon' }, { legende:'Pièce principale' }, { legende:'Kitchenette' }, { legende:'Salle d\'eau' }],
    canaux:{
      airbnb: { connecte:true, statut:'ok', listingId:'AB-38771902', url:'https://airbnb.fr/rooms/38771902', note:4.7, avis:129, commission:3,  derniereSynchro:'2026-07-23 12:40' },
      booking:{ connecte:true, statut:'ok', listingId:'BK-6644128',  url:'https://booking.com/hotel/fr/6644128', note:8.8, avis:29, commission:15, derniereSynchro:'2026-07-23 12:39' },
      direct: { connecte:true, statut:'ok', listingId:'OY-L007',     url:'https://oyvia.com/l/studio-nice', note:null, avis:0, commission:0, derniereSynchro:'2026-07-23 12:41' },
    },
  }),

  _logement({
    id:'L008', nom:'Maison de pêcheur', couleur:'#6E7A5B',
    couverture:'L008.jpg',
    ville:'La Rochelle', quartier:'Vieux-Port', pays:'France',
    adresse:'9 rue des Voiliers, 17000 La Rochelle',
    type:'maison', typeChambre:'entier',
    capacite:5, chambres:2, lits:3, sdb:1, surface:78,
    tarifBase:110, menageTarif:50, note:4.8, avis:73,
    annonce:{
      titre:"Maison de pêcheur au Vieux-Port — jardin et vélos",
      resume:"Maison de caractère de 78 m² à deux pas du Vieux-Port, avec jardin clos et deux vélos à disposition.",
      espace:"Deux chambres à l'étage, séjour et cuisine au rez-de-chaussée, jardin de 60 m² avec barbecue.",
      quartierTxt:"Quartier des Voiliers, entre le Vieux-Port et les Minimes.",
      transports:"Gare à 15 min à pied. Île de Ré à 25 min en voiture.",
    },
    lieu:{ rue:'9 rue des Voiliers', codePostal:'17000', region:'Nouvelle-Aquitaine', latitude:46.1558, longitude:-1.1520 },
    couchages:[
      { piece:'Chambre 1', lits:[{ type:'double', nb:1 }] },
      { piece:'Chambre 2', lits:[{ type:'simple', nb:2 }] },
      { piece:'Séjour',    lits:[{ type:'canape', nb:1 }] },
    ],
    equipements:['wifi','chauffage','eau_chaude','lave_linge','linge_fourni','tv','cuisine','lave_vaisselle','four','micro_ondes','cafetiere','jardin','barbecue','velos','detecteur_fumee','extincteur','trousse_secours','lit_bebe'],
    tarifs:{ weekend:130, personnesIncluses:4, personneSup:18, caution:500,
      taxeSejour:{ mode:'par_personne_nuit', montant:1.50, plafondNuits:7 },
      remises:{ hebdo:12, mensuelle:25 }, min:85, max:190 },
    sejour:{ nuitsMin:3, preavis:2, preparation:1, arrivee:'16:00', depart:'10:00' },
    politiqueAnnulation:'moderee',
    regles:{ animaux:true, animauxMax:1 },
    acces:{ type:'boite_cles', emplacementCles:'Boîte à clés sur le portillon du jardin', etage:0, ascenseur:false,
      parking:"Stationnement gratuit dans la rue, zone résidentielle",
      instructions:"Le portillon du jardin donne sur la porte d'entrée, sur la gauche.",
      contactUrgence:'+33 6 12 45 78 90',
      boiteCles:{ emplacement:'Sur le portillon du jardin, côté rue', modele:'Master Lock 5440EURD', modifieLe:'2026-01-24' } },
    codeAcces:'LR170', wifi:{ ssid:'MaisonPecheur', pass:'larochelle17' },
    conformite:{ numeroEnregistrement:'1730000889900', plafondNuits:120, nuitsConsommees:63 },
    notesDetail:{ proprete:4.8, precision:4.9, arrivee:4.8, communication:4.9, emplacement:4.7, qualitePrix:4.8 },
    photos:[{ legende:'Façade' }, { legende:'Jardin' }, { legende:'Séjour' }, { legende:'Chambre 1' }, { legende:'Cuisine' }],
    canaux:{
      airbnb: { connecte:true, statut:'ok', listingId:'AB-55014782', url:'https://airbnb.fr/rooms/55014782', note:4.8, avis:52, commission:3,  derniereSynchro:'2026-07-23 12:40' },
      booking:{ connecte:true, statut:'ok', listingId:'BK-7788201',  url:'https://booking.com/hotel/fr/7788201', note:9.1, avis:21, commission:15, derniereSynchro:'2026-07-23 12:39' },
      direct: { connecte:true, statut:'ok', listingId:'OY-L008',     url:'https://oyvia.com/l/maison-pecheur', note:null, avis:0, commission:0, derniereSynchro:'2026-07-23 12:41' },
    },
  }),

  _logement({
    id:'L009', nom:'Duplex Capitole', couleur:'#9A5A6E',
    couverture:'L009.jpg',
    ville:'Toulouse', quartier:'Capitole', pays:'France',
    adresse:'2 place du Capitole, 31000 Toulouse',
    type:'duplex', typologie:'T3', typeChambre:'entier',
    capacite:4, chambres:2, lits:2, sdb:1, surface:70,
    tarifBase:84, menageTarif:38, note:4.7, avis:89,
    annonce:{
      titre:"Duplex place du Capitole — hyper-centre",
      resume:"Duplex de 70 m² donnant directement sur la place du Capitole.",
      espace:"Séjour et cuisine au premier niveau, deux chambres à l'étage.",
      quartierTxt:"Place du Capitole : marché le mercredi, commerces et restaurants au pied de l'immeuble.",
      transports:"Métro Capitole en bas de l'immeuble. Aéroport en 30 min via la navette.",
      aSavoir:"Place animée le week-end : les chambres donnent sur cour, mais le séjour est côté place.",
    },
    lieu:{ rue:'2 place du Capitole', codePostal:'31000', region:'Occitanie', latitude:43.6045, longitude:1.4442 },
    couchages:[
      { piece:'Chambre 1', lits:[{ type:'queen', nb:1 }] },
      { piece:'Chambre 2', lits:[{ type:'double', nb:1 }] },
    ],
    equipements:['wifi','chauffage','clim','eau_chaude','lave_linge','linge_fourni','espace_travail','tv','cuisine','lave_vaisselle','micro_ondes','ascenseur','arrivee_auto','detecteur_fumee','extincteur'],
    tarifs:{ weekend:98, personnesIncluses:2, personneSup:14, caution:300,
      taxeSejour:{ mode:'par_personne_nuit', montant:1.95, plafondNuits:7 },
      remises:{ hebdo:10, mensuelle:20 }, min:62, max:140 },
    sejour:{ nuitsMin:2, preavis:1, arrivee:'15:00', depart:'11:00' },
    politiqueAnnulation:'moderee',
    acces:{ type:'boite_cles', emplacementCles:'Boîte à clés dans le hall', etage:2, ascenseur:true,
      parking:"Parking Capitole sous la place, 22 €/jour",
      instructions:"Composez le code à la porte cochère, boîte à clés dans le hall, puis ascenseur jusqu'au 2ᵉ.",
      contactUrgence:'+33 6 12 45 78 90',
      boiteCles:{ emplacement:'Dans le hall, derrière la porte cochère', modele:'Master Lock 5401EURD', modifieLe:'2026-05-02' } },
    codeAcces:'TLS09', wifi:{ ssid:'OyviaCapitole', pass:'toulouse31' },
    conformite:{ numeroEnregistrement:'3155500223344', plafondNuits:120, nuitsConsommees:76 },
    notesDetail:{ proprete:4.7, precision:4.6, arrivee:4.8, communication:4.8, emplacement:5.0, qualitePrix:4.6 },
    photos:[{ legende:'Vue sur la place' }, { legende:'Séjour' }, { legende:'Chambre 1' }, { legende:'Cuisine' }],
    canaux:{
      airbnb: { connecte:true,  statut:'ok',        listingId:'AB-49118023', url:'https://airbnb.fr/rooms/49118023', note:4.7, avis:66, commission:3,  derniereSynchro:'2026-07-23 12:40' },
      booking:{ connecte:true,  statut:'ok',        listingId:'BK-7290145',  url:'https://booking.com/hotel/fr/7290145', note:8.9, avis:23, commission:15, derniereSynchro:'2026-07-23 12:39' },
      direct: { connecte:true,  statut:'attention', listingId:'OY-L009',     url:'https://oyvia.com/l/duplex-capitole', note:null, avis:0, commission:0, derniereSynchro:'2026-07-20 09:14', message:"Moteur de réservation directe en pause : aucune photo de couverture définie." },
    },
  }),

  _logement({
    id:'L010', nom:"T3 Presqu'île rénové", couleur:'#4A6A80',
    couverture:'L010.jpg',
    ville:'Lyon', quartier:"Presqu'île", pays:'France',
    adresse:'30 rue de la République, 69002 Lyon',
    type:'appartement', typologie:'T3', typeChambre:'entier',
    capacite:5, chambres:2, lits:3, sdb:1, surface:72,
    tarifBase:98, menageTarif:45, note:4.8, avis:104,
    annonce:{
      titre:"T3 rénové rue de la République — Presqu'île",
      resume:"Appartement de 72 m² entièrement rénové, dans la principale rue piétonne de Lyon.",
      espace:"Deux chambres, séjour lumineux, cuisine équipée, salle de bain avec baignoire.",
      quartierTxt:"Presqu'île : commerces, Opéra et place Bellecour à quelques minutes.",
      transports:"Métro A Cordeliers à 100 m. Part-Dieu en 10 min.",
    },
    lieu:{ rue:'30 rue de la République', codePostal:'69002', region:'Auvergne-Rhône-Alpes', latitude:45.7640, longitude:4.8357 },
    couchages:[
      { piece:'Chambre 1', lits:[{ type:'queen', nb:1 }] },
      { piece:'Chambre 2', lits:[{ type:'simple', nb:2 }] },
      { piece:'Séjour',    lits:[{ type:'canape', nb:1 }] },
    ],
    equipements:['wifi_fibre','chauffage','eau_chaude','lave_linge','linge_fourni','espace_travail','tv','cuisine','lave_vaisselle','four','micro_ondes','cafetiere','ascenseur','arrivee_auto','detecteur_fumee','detecteur_co','extincteur'],
    tarifs:{ weekend:118, personnesIncluses:2, personneSup:16, caution:350,
      taxeSejour:{ mode:'par_personne_nuit', montant:2.30, plafondNuits:7 },
      remises:{ hebdo:10, mensuelle:22 }, min:72, max:165 },
    sejour:{ nuitsMin:2, preavis:1, arrivee:'15:00', depart:'11:00' },
    politiqueAnnulation:'moderee',
    acces:{ type:'serrure_connectee', emplacementCles:'Serrure connectée, code envoyé la veille', etage:3, ascenseur:true,
      parking:"Parking République à 150 m, 20 €/jour",
      instructions:"Rue piétonne : dépose-minute autorisée avant 11 h.",
      contactUrgence:'+33 6 12 45 78 90',
      serrure:{ connectee:true, deviceId:'seam_dev_31e7c0a5bd', marque:'Igloohome', modele:'Deadbolt 2S',
        batterie:14, enLigne:true, verrouillee:true, derniereSynchro:'2026-07-23 12:31',
        code:{ valeur:'LY102', statut:'actif', creeLe:'2026-07-21 18:40', debut:'2026-07-22 15:00', fin:'2026-07-27 11:00', seamId:'seam_code_b7d2ee91' } } },
    codeAcces:'LY102', wifi:{ ssid:'OyviaPresquile', pass:'republique69' },
    conformite:{ numeroEnregistrement:'6938300998877', plafondNuits:120, nuitsConsommees:44 },
    notesDetail:{ proprete:4.9, precision:4.8, arrivee:4.8, communication:4.8, emplacement:4.9, qualitePrix:4.7 },
    photos:[{ legende:'Séjour' }, { legende:'Chambre 1' }, { legende:'Cuisine' }, { legende:'Salle de bain' }],
    canaux:{
      airbnb: { connecte:true, statut:'ok', listingId:'AB-58023117', url:'https://airbnb.fr/rooms/58023117', note:4.8, avis:79, commission:3,  derniereSynchro:'2026-07-23 12:40' },
      booking:{ connecte:true, statut:'ok', listingId:'BK-8390442',  url:'https://booking.com/hotel/fr/8390442', note:9.0, avis:25, commission:15, derniereSynchro:'2026-07-23 12:39' },
      direct: { connecte:true, statut:'ok', listingId:'OY-L010',     url:'https://oyvia.com/l/t3-presquile', note:null, avis:0, commission:0, derniereSynchro:'2026-07-23 12:41' },
    },
  }),
];

/* ---------- Accès au référentiel logement ---------- */
function getAmenity(id) { return AMENITIES.find(a => a.id === id) || { id, label:id, cat:'essentiels' }; }
function labelAmenities(ids) { return (ids || []).map(i => getAmenity(i).label); }
// Équipements d'un logement regroupés par catégorie, dans l'ordre du référentiel.
function amenitiesParCategorie(l) {
  const groupes = {};
  (l.equipements || []).forEach(id => {
    const a = getAmenity(id);
    (groupes[a.cat] = groupes[a.cat] || []).push(a);
  });
  return Object.keys(AMENITY_CATEGORIES)
    .filter(c => groupes[c])
    .map(c => ({ cat:c, label:AMENITY_CATEGORIES[c], items:groupes[c] }));
}
function labelTypeLogement(id) { return (TYPES_LOGEMENT.find(t => t.id === id) || {}).label || id; }
function labelTypeChambre(id)  { return (TYPES_CHAMBRE.find(t => t.id === id)  || {}).label || id; }
function labelTypeLit(id)      { return (TYPES_LIT.find(t => t.id === id)      || {}).label || id; }
function labelTypeAcces(id)    { return (TYPES_ACCES.find(t => t.id === id)    || {}).label || id; }
function labelPolitique(id)    { return (POLITIQUES_ANNULATION.find(p => p.id === id) || {}).label || id; }

/* ------------------------------------------------------------
   SEAM — passerelle vers les serrures connectées

   Seam expose une API unique par-dessus une trentaine de fabricants
   (Nuki, Igloohome, TTLock, August, Yale…). On ne parle jamais au
   constructeur : on manipule un `device`, et sur ce device des
   `access_code`. Les deux seules opérations dont l'hôte a besoin :
   en créer un, le révoquer.

   Ici c'est une simulation — pas de backend dans cette maquette — mais
   la forme est celle de l'API réelle : appels asynchrones, latence,
   et surtout un point important à ne pas gommer : chez Seam la création
   d'un code n'est pas instantanée. L'API accuse réception, puis la
   serrure confirme quand elle a reçu l'ordre. D'où le délai simulé :
   une interface qui afficherait le code immédiatement mentirait sur ce
   qui se passe réellement sur la porte.
   ------------------------------------------------------------ */
const Seam = (function () {
  const LATENCE = 900;                       // aller-retour API + serrure
  const attendre = ms => new Promise(r => setTimeout(r, ms));
  // Horodatage au format des autres dates de la maquette (AUJOURDHUI fige
  // le « maintenant » de la démo, mais l'heure réelle reste parlante).
  const maintenant = () => {
    const h = new Date();
    return `${AUJOURDHUI} ${String(h.getHours()).padStart(2, '0')}:${String(h.getMinutes()).padStart(2, '0')}`;
  };
  // Les serrures n'acceptent que du numérique sur le clavier physique.
  const nouveauCode = () => String(Math.floor(100000 + Math.random() * 900000));
  const nouvelId = p => p + Math.random().toString(16).slice(2, 10);

  return {
    /* POST /access_codes/create — crée (ou remplace) le code de la serrure.
       `fenetre` : { debut, fin } au format 'YYYY-MM-DD HH:MM', optionnel.
       Sans fenêtre, Seam crée un code permanent. */
    async creerCode(logement, fenetre = null) {
      const s = logement.acces.serrure;
      if (!s.connectee) throw new Error('Aucune serrure connectée sur ce logement');
      if (!s.enLigne)   throw new Error('La serrure est hors ligne : impossible de lui pousser un code');
      await attendre(LATENCE);
      s.code = {
        valeur: nouveauCode(),
        statut: fenetre && fenetre.debut > maintenant() ? 'programme' : 'actif',
        creeLe: maintenant(),
        debut: fenetre ? fenetre.debut : null,
        fin:   fenetre ? fenetre.fin   : null,
        seamId: nouvelId('seam_code_'),
      };
      s.derniereSynchro = maintenant();
      logement.codeAcces = s.code.valeur;    // ce que liront messagerie et portail voyageur
      return s.code;
    },

    /* DELETE /access_codes/delete — révoque le code sur la serrure.
       Le logement se retrouve volontairement sans code : c'est l'état à
       montrer tel quel plutôt que de laisser traîner un code mort. */
    async supprimerCode(logement) {
      const s = logement.acces.serrure;
      if (!s.code) throw new Error('Aucun code à supprimer');
      if (!s.enLigne) throw new Error('La serrure est hors ligne : impossible de révoquer le code');
      await attendre(LATENCE);
      s.code = null;
      s.derniereSynchro = maintenant();
      logement.codeAcces = '';
      return true;
    },

    /* GET /devices/get — rafraîchit l'état du device (batterie, connexion). */
    async synchroniser(logement) {
      const s = logement.acces.serrure;
      if (!s.connectee) throw new Error('Aucune serrure connectée sur ce logement');
      await attendre(LATENCE / 2);
      s.derniereSynchro = maintenant();
      return s;
    },
  };
})();

// Une batterie qui tombe est la panne n° 1 des serrures connectées : elle
// mérite d'être qualifiée, pas juste affichée en pourcentage.
function etatBatterie(pct) {
  if (pct == null)  return { niveau:'inconnu',  texte:'Non remontée', badge:'badge--neutral' };
  if (pct <= 20)    return { niveau:'critique', texte:`${pct} % — à remplacer`, badge:'badge--danger' };
  if (pct <= 40)    return { niveau:'faible',   texte:`${pct} % — à surveiller`, badge:'badge--warning' };
  return { niveau:'ok', texte:`${pct} %`, badge:'badge--positive' };
}

// Total des couchages déclarés, pour contrôler la cohérence avec la capacité.
function placesCouchages(l) {
  return (l.couchages || []).reduce((s, p) =>
    s + p.lits.reduce((t, b) => t + (TYPES_LIT.find(x => x.id === b.type) || { places:0 }).places * b.nb, 0), 0);
}
// Canaux réellement connectés, dans l'ordre de PLATEFORMES.
function canauxConnectes(l) {
  return Object.entries(l.canaux || {}).filter(([, c]) => c.connecte);
}
// Canaux qui synchronisent vraiment : connectés ET non mis en pause. C'est
// cette liste qui décide des pages canal affichées sur la fiche.
function canauxActifs(l) {
  return canauxConnectes(l).filter(([, c]) => c.actif !== false);
}
/* ------------------------------------------------------------
   ANNONCE TELLE QU'ELLE EXISTE CHEZ LE CANAL

   Oyvia stocke un socle normalisé ; chaque plateforme en tire SA
   propre annonce, avec son vocabulaire, son échelle de notes, ses
   frais et ses champs obligatoires. `annonceCanal()` refait ce
   chemin dans l'autre sens : à partir du socle et de la connexion,
   il reconstitue l'annonce telle que le voyageur la voit sur la
   plateforme.

   C'est volontairement dérivé et non stocké : une annonce recopiée
   à la main dans data.js serait figée et divergerait du socle dès
   la première modification de la fiche.
   ------------------------------------------------------------ */
const CANAUX_META = {
  airbnb:  { label:'Airbnb',      lettre:'A', couleur:'var(--ch-airbnb)',  echelle:5,  fraisVoyageur:0.142, siteNom:'Airbnb' },
  booking: { label:'Booking.com', lettre:'B', couleur:'var(--ch-booking)', echelle:10, fraisVoyageur:0,     siteNom:'Booking.com' },
  direct:  { label:'Direct',      lettre:'D', couleur:'var(--ch-direct)',  echelle:5,  fraisVoyageur:0,     siteNom:'votre site Oyvia' },
  vrbo:    { label:'VRBO',        lettre:'V', couleur:'#1668E3',           echelle:5,  fraisVoyageur:0.12,  siteNom:'VRBO' },
  expedia: { label:'Expedia',     lettre:'E', couleur:'#FFC94D',           echelle:10, fraisVoyageur:0,     siteNom:'Expedia' },
};

// Booking accompagne chaque note d'un adjectif : c'est lui que les
// voyageurs retiennent, pas le chiffre.
function mentionBooking(n) {
  if (n == null) return null;
  if (n >= 9.5) return 'Exceptionnel';
  if (n >= 9)   return 'Fabuleux';
  if (n >= 8.6) return 'Superbe';
  if (n >= 8)   return 'Très bien';
  if (n >= 7)   return 'Bien';
  return 'Correct';
}

// Devis type — 7 nuits, 2 voyageurs — décomposé comme la plateforme le
// présente : Airbnb ajoute des frais de service voyageur, Booking non
// (il se paie sur la commission hôte).
function devisCanal(l, canalId, nuits = 7, pers = 2) {
  const m = CANAUX_META[canalId] || CANAUX_META.direct;
  const t = l.tarifs;
  const nuitees = l.tarifBase * nuits;
  const remise = Math.round(nuitees * (t.remises.hebdo || 0) / 100);
  const sup = Math.max(0, pers - (t.personnesIncluses || pers)) * (t.personneSup || 0) * nuits;
  const taxe = t.taxeSejour.mode === 'pourcentage'
    ? Math.round(nuitees * t.taxeSejour.montant / 100)
    : t.taxeSejour.mode === 'par_sejour'
      ? t.taxeSejour.montant
      : t.taxeSejour.montant * pers * Math.min(nuits, t.taxeSejour.plafondNuits || nuits);
  const sousTotal = nuitees - remise + sup + l.menageTarif;
  const fraisService = Math.round(sousTotal * m.fraisVoyageur);
  return { nuits, pers, nuitees, remise, sup, menage: l.menageTarif, fraisService, taxe,
           total: sousTotal + fraisService + Math.round(taxe) };
}

function annonceCanal(l, canalId) {
  const c = (l.canaux || {})[canalId];
  if (!c) return null;
  const m = CANAUX_META[canalId] || CANAUX_META.direct;
  const a = l.annonce, s = l.sejour, r = l.regles, t = l.tarifs, nd = l.notesDetail;
  const pol = POLITIQUES_ANNULATION.find(p => p.id === l.politiqueAnnulation) || {};
  const devis = devisCanal(l, canalId);
  const equipements = amenitiesParCategorie(l);
  const lits = (l.couchages || []).map(p => ({ piece:p.piece, detail:p.lits.map(b => `${b.nb} × ${labelTypeLit(b.type)}`).join(' · ') }));
  const nonRenseigne = v => v || null;
  const oui = v => v ? 'Oui' : 'Non';

  /* --- Airbnb, VRBO : même famille de vocabulaire, note sur 5 --- */
  if (canalId === 'airbnb' || canalId === 'vrbo') {
    const vrbo = canalId === 'vrbo';
    return {
      canal: canalId, meta: m, connexion: c,
      entete: {
        titre: a.titre || l.nom,
        sousTitre: `${labelTypeChambre(l.typeChambre)} · ${l.quartier}, ${l.ville}`,
        note: c.note, echelle: 5, avis: c.avis,
        badges: [labelTypeLogement(l.type), `${l.capacite} voyageurs`, `${l.chambres} chambre${l.chambres > 1 ? 's' : ''}`,
                 `${l.lits} lit${l.lits > 1 ? 's' : ''}`, `${l.sdb} salle de bain`]
                 .concat(l.superhote && !vrbo ? ['Superhôte'] : [])
                 .concat(s.reservationInstantanee ? ['Réservation instantanée'] : []),
      },
      sections: [
        { titre: 'Description publiée', type:'texte', blocs: [
          { label:'Résumé',           texte: nonRenseigne(a.resume) },
          { label:'Le logement',      texte: nonRenseigne(a.espace) },
          { label:'Le quartier',      texte: nonRenseigne(a.quartierTxt) },
          { label:'Se déplacer',      texte: nonRenseigne(a.transports) },
          { label:'À savoir',         texte: nonRenseigne(a.aSavoir) },
        ]},
        { titre: 'Où vous dormirez', type:'couchages', items: lits },
        { titre: 'Ce que propose ce logement', type:'groupes', groupes: equipements },
        { titre: 'Notes détaillées', type:'notes', echelle: 5, items: [
          { k:'Propreté', v:nd.proprete }, { k:'Exactitude', v:nd.precision },
          { k:'Arrivée', v:nd.arrivee },   { k:'Communication', v:nd.communication },
          { k:'Emplacement', v:nd.emplacement }, { k:'Qualité-prix', v:nd.qualitePrix },
        ]},
        { titre: `Prix voyageur · ${devis.nuits} nuits, ${devis.pers} voyageurs`, type:'prix', lignes: [
          { k:`${devis.nuits} nuits × ${formatMontant(l.tarifBase)}`, v: formatMontant(devis.nuitees) },
          devis.remise ? { k:'Réduction séjour à la semaine', v:`− ${formatMontant(devis.remise)}`, positif:true } : null,
          devis.sup ? { k:'Voyageurs supplémentaires', v: formatMontant(devis.sup) } : null,
          { k:'Frais de ménage', v: formatMontant(devis.menage) },
          { k:`Frais de service ${m.label}`, v: formatMontant(devis.fraisService) },
          { k:'Taxes et impôts', v: formatMontant(devis.taxe) },
        ].filter(Boolean), total: { k:'Total', v: formatMontant(devis.total) } },
        { titre: 'Arrivée, départ et règlement', type:'paires', paires: [
          { k:'Arrivée',                v:`${s.arrivee}${s.arriveeMax ? ` – ${s.arriveeMax}` : ''}` },
          { k:'Départ',                 v:`avant ${s.depart}` },
          { k:'Nuits minimum',          v:`${s.nuitsMin}` },
          { k:'Nuits maximum',          v:`${s.nuitsMax}` },
          { k:'Animaux',                v: r.animaux ? `Oui, ${r.animauxMax} max` : 'Non' },
          { k:'Fumeurs',                v: oui(r.fumeurs) },
          { k:'Fêtes et événements',    v: oui(r.fetes) },
          { k:'Heures de silence',      v:`${r.silenceDebut} – ${r.silenceFin}` },
          { k:"Politique d'annulation", v: pol.label || l.politiqueAnnulation },
        ]},
      ],
    };
  }

  /* --- Booking.com, Expedia : établissement + unité, note sur 10 --- */
  if (canalId === 'booking' || canalId === 'expedia') {
    const sur10 = v => Math.round(v * 2 * 10) / 10;
    return {
      canal: canalId, meta: m, connexion: c,
      entete: {
        titre: `${labelTypeLogement(l.type)} ${l.nom}`,
        sousTitre: `${l.lieu.rue || l.adresse}, ${l.lieu.codePostal || ''} ${l.ville}`.trim(),
        note: c.note, echelle: 10, avis: c.avis, mention: mentionBooking(c.note),
        badges: [`${l.surface ? l.surface + ' m²' : labelTypeLogement(l.type)}`, `${l.capacite} personnes`,
                 `${l.chambres} chambre${l.chambres > 1 ? 's' : ''}`, `${l.sdb} salle de bain`,
                 r.fumeurs ? 'Fumeurs autorisés' : 'Non-fumeurs'],
      },
      sections: [
        { titre: "Description de l'établissement", type:'texte', blocs: [
          { label:'Présentation',        texte: nonRenseigne([a.resume, a.espace].filter(Boolean).join('\n\n')) },
          { label:'Quartier et environs', texte: nonRenseigne(a.quartierTxt) },
          { label:'Informations utiles', texte: nonRenseigne([a.transports, a.aSavoir].filter(Boolean).join('\n\n')) },
        ]},
        { titre: 'Configuration du logement', type:'couchages', items: lits },
        { titre: 'Équipements et services', type:'groupes', groupes: equipements },
        { titre: 'Note des voyageurs', type:'notes', echelle: 10, items: [
          { k:'Personnel',                 v: sur10(nd.communication) },
          { k:'Équipements',               v: sur10(nd.qualitePrix) },
          { k:'Propreté',                  v: sur10(nd.proprete) },
          { k:'Confort',                   v: sur10(nd.precision) },
          { k:'Rapport qualité/prix',      v: sur10(nd.qualitePrix) },
          { k:'Situation géographique',    v: sur10(nd.emplacement) },
        ]},
        { titre: `Prix voyageur · ${devis.nuits} nuits, ${devis.pers} personnes`, type:'prix', lignes: [
          { k:`${devis.nuits} nuits × ${formatMontant(l.tarifBase)}`, v: formatMontant(devis.nuitees) },
          devis.remise ? { k:'Réduction longue durée', v:`− ${formatMontant(devis.remise)}`, positif:true } : null,
          devis.sup ? { k:'Personnes supplémentaires', v: formatMontant(devis.sup) } : null,
          { k:'Frais de nettoyage', v: formatMontant(devis.menage) },
          { k:'Taxe de séjour',     v: formatMontant(devis.taxe) },
        ].filter(Boolean), total: { k:'Prix total', v: formatMontant(devis.total) } },
        { titre: 'Conditions', type:'paires', paires: [
          { k:'Arrivée',                  v:`de ${s.arrivee} à ${s.arriveeMax || '00:00'}` },
          { k:'Départ',                   v:`jusqu'à ${s.depart}` },
          { k:'Séjour minimum',           v:`${s.nuitsMin} nuits` },
          { k:'Séjour maximum',           v:`${s.nuitsMax} nuits` },
          { k:'Annulation',               v: pol.label || l.politiqueAnnulation },
          { k:'Enfants',                  v: r.enfants ? 'Tous les âges sont acceptés' : 'Non acceptés' },
          { k:'Lits bébé',                v: oui(r.bebes) },
          { k:'Animaux domestiques',      v: r.animaux ? `Acceptés (${r.animauxMax} max)` : 'Non acceptés' },
          { k:'Fêtes',                    v: r.fetes ? 'Autorisées' : 'Interdites' },
          { k:'Caution',                  v: t.caution ? formatMontant(t.caution) : 'Aucune' },
          { k:'Commission Booking',       v:`${c.commission} %` },
        ]},
      ],
    };
  }

  /* --- Réservation directe : votre propre site, aucune commission --- */
  return {
    canal: canalId, meta: m, connexion: c,
    entete: {
      titre: a.titre || l.nom,
      sousTitre: `${l.quartier}, ${l.ville} — page de réservation directe`,
      note: l.note, echelle: 5, avis: l.avis,
      badges: [labelTypeLogement(l.type), `${l.capacite} voyageurs`, `${l.chambres} chambre${l.chambres > 1 ? 's' : ''}`,
               'Sans commission', 'Paiement direct'],
    },
    sections: [
      { titre: 'Contenu de la page', type:'texte', blocs: [
        { label:'Accroche',      texte: nonRenseigne(a.resume) },
        { label:'Le logement',   texte: nonRenseigne(a.espace) },
        { label:'Le quartier',   texte: nonRenseigne(a.quartierTxt) },
        { label:'Accès',         texte: nonRenseigne(a.transports) },
        { label:'Bon à savoir',  texte: nonRenseigne(a.aSavoir) },
      ]},
      { titre: 'Couchages', type:'couchages', items: lits },
      { titre: 'Équipements affichés', type:'groupes', groupes: equipements },
      { titre: 'Notes reprises de vos canaux', type:'notes', echelle: 5, items: [
        { k:'Propreté', v:nd.proprete }, { k:'Exactitude', v:nd.precision },
        { k:'Arrivée', v:nd.arrivee },   { k:'Communication', v:nd.communication },
        { k:'Emplacement', v:nd.emplacement }, { k:'Qualité-prix', v:nd.qualitePrix },
      ]},
      { titre: `Prix voyageur · ${devis.nuits} nuits, ${devis.pers} voyageurs`, type:'prix', lignes: [
        { k:`${devis.nuits} nuits × ${formatMontant(l.tarifBase)}`, v: formatMontant(devis.nuitees) },
        devis.remise ? { k:'Remise séjour à la semaine', v:`− ${formatMontant(devis.remise)}`, positif:true } : null,
        devis.sup ? { k:'Voyageurs supplémentaires', v: formatMontant(devis.sup) } : null,
        { k:'Forfait ménage', v: formatMontant(devis.menage) },
        { k:'Taxe de séjour', v: formatMontant(devis.taxe) },
        { k:'Frais de service', v:'Aucun', positif:true },
      ].filter(Boolean), total: { k:'Total voyageur', v: formatMontant(devis.total) } },
      { titre: 'Conditions affichées', type:'paires', paires: [
        { k:'Arrivée',                v:`à partir de ${s.arrivee}` },
        { k:'Départ',                 v:`avant ${s.depart}` },
        { k:'Nuits minimum',          v:`${s.nuitsMin}` },
        { k:"Politique d'annulation", v: pol.label || l.politiqueAnnulation },
        { k:'Caution',                v: t.caution ? formatMontant(t.caution) : 'Aucune' },
        { k:'Commission',             v:'0 % — vous encaissez la totalité' },
      ]},
    ],
  };
}

// Le plafond de nuitées est une obligation légale dans les grandes villes :
// on veut pouvoir alerter avant de le dépasser.
function conformiteStatut(l) {
  const c = l.conformite || {};
  if (!c.numeroEnregistrement) return { niveau:'manquant', texte:"Numéro d'enregistrement absent" };
  if (!c.plafondNuits)         return { niveau:'ok', texte:'Aucun plafond de nuitées' };
  const reste = c.plafondNuits - (c.nuitsConsommees || 0);
  if (reste <= 0)  return { niveau:'depasse', texte:`Plafond de ${c.plafondNuits} nuits atteint` };
  if (reste <= 15) return { niveau:'alerte',  texte:`${reste} nuits restantes sur ${c.plafondNuits}` };
  return { niveau:'ok', texte:`${reste} nuits restantes sur ${c.plafondNuits}` };
}

/* ============================================================
   RESERVATIONS (33, dont 1 blocage) — juin → sept. 2026
   canal : airbnb | booking | direct | bloque
   paiement : paye | acompte | impaye | rembourse
   statut : confirme | en_cours | termine | annule
   ============================================================ */
const RESERVATIONS = [
  // L001
  { id:'R01', logementId:'L001', voyageurId:'V01', voyageur:'Emma Laurent',      canal:'airbnb',  arrivee:'2026-07-03', depart:'2026-07-07', pers:2, montant:425,  paiement:'paye',    statut:'termine',  ref:'HMABX3' },
  { id:'R02', logementId:'L001', voyageurId:'V02', voyageur:'Marco Rossi',       canal:'booking', arrivee:'2026-07-12', depart:'2026-07-16', pers:3, montant:425,  paiement:'paye',    statut:'termine',  ref:'BK80421' },
  { id:'R03', logementId:'L001', voyageurId:'V03', voyageur:'Sophie Meyer',      canal:'airbnb',  arrivee:'2026-07-24', depart:'2026-07-28', pers:2, montant:425,  paiement:'acompte', statut:'confirme', ref:'HMKD91' },
  { id:'R04', logementId:'L001', voyageurId:'V04', voyageur:'Julie Fontaine',    canal:'direct',  arrivee:'2026-08-05', depart:'2026-08-10', pers:4, montant:520,  paiement:'acompte', statut:'confirme', ref:'CL-1042' },
  // L002
  { id:'R05', logementId:'L002', voyageurId:'V05', voyageur:'Liam O\'Connor',    canal:'airbnb',  arrivee:'2026-07-06', depart:'2026-07-09', pers:2, montant:269,  paiement:'paye',    statut:'termine',  ref:'HM5521' },
  { id:'R06', logementId:'L002', voyageurId:'V06', voyageur:'Chen Wei',          canal:'booking', arrivee:'2026-07-20', depart:'2026-07-23', pers:2, montant:269,  paiement:'paye',    statut:'en_cours', ref:'BK80588' },
  { id:'R07', logementId:'L002', voyageurId:'V07', voyageur:'Nina Kowalski',     canal:'airbnb',  arrivee:'2026-07-23', depart:'2026-07-26', pers:1, montant:269,  paiement:'paye',    statut:'confirme', ref:'HM6033' },
  { id:'R08', logementId:'L002', voyageurId:'V08', voyageur:'Thomas Bernard',    canal:'direct',  arrivee:'2026-08-01', depart:'2026-08-04', pers:2, montant:269,  paiement:'acompte', statut:'confirme', ref:'CL-1043' },
  // L003
  { id:'R09', logementId:'L003', voyageurId:'V09', voyageur:'Anna Schmidt',      canal:'booking', arrivee:'2026-07-01', depart:'2026-07-05', pers:4, montant:392,  paiement:'paye',    statut:'termine',  ref:'BK80233' },
  { id:'R10', logementId:'L003', voyageurId:'V10', voyageur:'David Cohen',       canal:'airbnb',  arrivee:'2026-07-18', depart:'2026-07-23', pers:3, montant:480,  paiement:'paye',    statut:'en_cours', ref:'HM6120' },
  { id:'R11', logementId:'L003', voyageurId:'V11', voyageur:'Camille Roux',      canal:'airbnb',  arrivee:'2026-07-27', depart:'2026-08-02', pers:4, montant:568,  paiement:'acompte', statut:'confirme', ref:'HM6240' },
  { id:'R12', logementId:'L003', voyageurId:null,  voyageur:'Maintenance plomberie', canal:'bloque', arrivee:'2026-08-03', depart:'2026-08-06', pers:0, montant:0,  paiement:'paye',    statut:'confirme', ref:'—', note:'Rénovation salle de bain' },
  // L004
  { id:'R13', logementId:'L004', voyageurId:'V12', voyageur:'Paul Girard',       canal:'direct',  arrivee:'2026-07-11', depart:'2026-07-18', pers:6, montant:1225, paiement:'paye',    statut:'termine',  ref:'CL-1038' },
  { id:'R14', logementId:'L004', voyageurId:'V13', voyageur:'Lukas Weber',       canal:'airbnb',  arrivee:'2026-07-25', depart:'2026-07-30', pers:5, montant:895,  paiement:'acompte', statut:'confirme', ref:'HM6301' },
  { id:'R15', logementId:'L004', voyageurId:'V14', voyageur:'Elena Popova',      canal:'booking', arrivee:'2026-08-08', depart:'2026-08-15', pers:6, montant:1225, paiement:'impaye',  statut:'confirme', ref:'BK80712' },
  // L005
  { id:'R16', logementId:'L005', voyageurId:'V15', voyageur:'Groupe Moreau',     canal:'direct',  arrivee:'2026-07-04', depart:'2026-07-11', pers:8, montant:1770, paiement:'paye',    statut:'termine',  ref:'CL-1036' },
  { id:'R17', logementId:'L005', voyageurId:'V16', voyageur:'James Wilson',      canal:'airbnb',  arrivee:'2026-07-19', depart:'2026-07-26', pers:6, montant:1770, paiement:'paye',    statut:'en_cours', ref:'HM6088' },
  { id:'R18', logementId:'L005', voyageurId:'V17', voyageur:'Yuki Tanaka',       canal:'booking', arrivee:'2026-08-01', depart:'2026-08-08', pers:8, montant:1770, paiement:'acompte', statut:'confirme', ref:'BK80690' },
  // L006
  { id:'R19', logementId:'L006', voyageurId:'V18', voyageur:'Léa Dubois',        canal:'airbnb',  arrivee:'2026-07-08', depart:'2026-07-11', pers:2, montant:281,  paiement:'paye',    statut:'termine',  ref:'HM5840' },
  { id:'R20', logementId:'L006', voyageurId:'V19', voyageur:'Paolo Bianchi',     canal:'booking', arrivee:'2026-07-21', depart:'2026-07-24', pers:3, montant:281,  paiement:'paye',    statut:'en_cours', ref:'BK80601' },
  { id:'R21', logementId:'L006', voyageurId:'V20', voyageur:'Sarah Klein',       canal:'direct',  arrivee:'2026-08-02', depart:'2026-08-06', pers:2, montant:363,  paiement:'acompte', statut:'confirme', ref:'CL-1045' },
  // L007
  { id:'R22', logementId:'L007', voyageurId:'V21', voyageur:'Ahmed Benali',      canal:'booking', arrivee:'2026-07-09', depart:'2026-07-14', pers:2, montant:390,  paiement:'paye',    statut:'termine',  ref:'BK80301' },
  { id:'R23', logementId:'L007', voyageurId:'V22', voyageur:'Marie Lefèvre',     canal:'airbnb',  arrivee:'2026-07-22', depart:'2026-07-27', pers:2, montant:390,  paiement:'paye',    statut:'en_cours', ref:'HM6155' },
  { id:'R24', logementId:'L007', voyageurId:'V23', voyageur:'Oliver Brown',      canal:'airbnb',  arrivee:'2026-08-04', depart:'2026-08-09', pers:2, montant:390,  paiement:'acompte', statut:'confirme', ref:'HM6350' },
  // L008
  { id:'R25', logementId:'L008', voyageurId:'V24', voyageur:'Famille Petit',     canal:'direct',  arrivee:'2026-07-13', depart:'2026-07-20', pers:5, montant:820,  paiement:'paye',    statut:'termine',  ref:'CL-1040' },
  { id:'R26', logementId:'L008', voyageurId:'V25', voyageur:'Hans Müller',       canal:'airbnb',  arrivee:'2026-07-26', depart:'2026-08-01', pers:4, montant:710,  paiement:'acompte', statut:'confirme', ref:'HM6290' },
  { id:'R27', logementId:'L008', voyageurId:'V26', voyageur:'Isabella Ferrari',  canal:'booking', arrivee:'2026-08-10', depart:'2026-08-16', pers:5, montant:710,  paiement:'impaye',  statut:'confirme', ref:'BK80745' },
  // L009
  { id:'R28', logementId:'L009', voyageurId:'V27', voyageur:'Kevin Martin',      canal:'airbnb',  arrivee:'2026-07-16', depart:'2026-07-21', pers:3, montant:458,  paiement:'paye',    statut:'termine',  ref:'HM6045' },
  { id:'R29', logementId:'L009', voyageurId:'V28', voyageur:'Zoé Garnier',       canal:'booking', arrivee:'2026-07-24', depart:'2026-07-29', pers:4, montant:458,  paiement:'acompte', statut:'confirme', ref:'BK80655' },
  { id:'R30', logementId:'L009', voyageurId:'V29', voyageur:'Lucas Fabre',       canal:'direct',  arrivee:'2026-08-07', depart:'2026-08-12', pers:2, montant:458,  paiement:'acompte', statut:'confirme', ref:'CL-1047' },
  // L010
  { id:'R31', logementId:'L010', voyageurId:'V30', voyageur:'Grace Kim',         canal:'airbnb',  arrivee:'2026-07-17', depart:'2026-07-22', pers:2, montant:535,  paiement:'paye',    statut:'termine',  ref:'HM6060' },
  { id:'R32', logementId:'L010', voyageurId:'V31', voyageur:'Antoine Roche',     canal:'direct',  arrivee:'2026-07-23', depart:'2026-07-27', pers:4, montant:437,  paiement:'paye',    statut:'confirme', ref:'CL-1044' },
  { id:'R33', logementId:'L010', voyageurId:'V32', voyageur:'Fatima Zahra',      canal:'booking', arrivee:'2026-08-05', depart:'2026-08-11', pers:5, montant:633,  paiement:'acompte', statut:'confirme', ref:'BK80699' },
];
// nuits calculées une fois pour toutes
RESERVATIONS.forEach(r => { r.nuits = nuitsEntre(r.arrivee, r.depart); });

/* ============================================================
   PROPRIÉTAIRES & MODÈLE DE FACTURATION

   Le contrat entre la conciergerie et un propriétaire se décrit par
   TROIS questions indépendantes. Les mélanger en une seule liste
   d'options était la faiblesse du modèle précédent : « forfait
   mensuel » ne dit pas qui encaisse les réservations, et « le
   gestionnaire encaisse » ne dit pas comment il est rémunéré. Les
   deux combinaisons existent réellement sur le terrain.

   1. encaissement — QUI REÇOIT L'ARGENT DES VOYAGEURS ?
        'gestionnaire' : la conciergerie encaisse, retient ce qui lui
                         revient et REVERSE le solde au propriétaire.
        'proprietaire' : le propriétaire encaisse ; la conciergerie
                         lui ADRESSE UNE FACTURE.
      C'est cette question, et elle seule, qui donne le SENS du
      document : un relevé de reversement ne se lit pas comme une
      facture, et l'argent ne circule pas dans le même sens.

   2. remuneration — COMMENT LA CONCIERGERIE EST-ELLE PAYÉE ?
        'commission' : pourcentage du chiffre d'affaires.
        'forfait'    : montant fixe par mois, quel que soit le CA.
        'mixte'      : forfait de base + commission sur le CA.

   3. depensesPayeesPar — QUI AVANCE LES FRAIS (ménage, plomberie…) ?
        'gestionnaire' : la conciergerie avance. On demande alors si
                         elle les refacture (refacturerDepenses). Si
                         non, elles sortent de sa propre marge.
        'proprietaire' : le propriétaire règle directement ses
                         prestataires. La question de la refacturation
                         ne se pose plus — d'où le fait qu'elle
                         disparaisse de l'écran dans ce cas.
   ============================================================ */

const ENCAISSEMENT_LABEL = {
  gestionnaire: 'Le gestionnaire encaisse',
  proprietaire: 'Le propriétaire encaisse',
};
const ENCAISSEMENT_DESC = {
  gestionnaire: "Vous recevez l'argent des réservations, retenez ce qui vous revient et reversez le solde au propriétaire.",
  proprietaire: "Le propriétaire reçoit directement l'argent des réservations ; vous lui adressez une facture.",
};
const REMUNERATION_LABEL = {
  commission: "Commission sur le chiffre d'affaires",
  forfait:    'Forfait mensuel fixe',
  mixte:      'Mixte : forfait + commission',
};
const REMUNERATION_DESC = {
  commission: "Un pourcentage du CA encaissé sur la période.",
  forfait:    'Un montant fixe chaque mois, quel que soit le nombre de réservations.',
  mixte:      "Un forfait de base auquel s'ajoute une commission sur le CA.",
};
const PAYEUR_LABEL = {
  gestionnaire: 'Le gestionnaire avance les frais',
  proprietaire: 'Le propriétaire règle ses frais',
};

const PROPRIETAIRES = [
  // Cas 1a : le gestionnaire encaisse, avance les frais et les déduit du reversement.
  { id:'O1', societe:'SCI Bernard',            contact:'Paul Bernard',  email:'paul.bernard@sci-bernard.fr', tel:'+33 6 12 34 56 78',
    encaissement:'gestionnaire', remuneration:'commission', commission:0.20, forfaitMensuel:0,
    depensesPayeesPar:'gestionnaire', refacturerDepenses:true },
  // Cas 2 : le propriétaire encaisse et règle lui-même ses prestataires.
  { id:'O2', societe:'Investissements Lefort', contact:'Sophie Lefort',  email:'s.lefort@gmail.com',           tel:'+33 6 98 76 54 32',
    encaissement:'proprietaire', remuneration:'commission', commission:0.18, forfaitMensuel:0,
    depensesPayeesPar:'proprietaire', refacturerDepenses:false },
  // Cas 3a : le propriétaire encaisse, le gestionnaire avance et refacture.
  { id:'O3', societe:'Patrimoine Aziz',        contact:'Karim Aziz',     email:'k.aziz@gmail.com',             tel:'+33 6 45 67 89 01',
    encaissement:'proprietaire', remuneration:'mixte', commission:0.10, forfaitMensuel:99,
    depensesPayeesPar:'gestionnaire', refacturerDepenses:true },
];

/* Anciens contrats enregistrés avec `modeFacturation` (un seul champ).
   On les convertit plutôt que d'exiger une ressaisie : un état
   localStorage antérieur ne doit pas casser l'écran de comptabilité.
   L'ancien modèle supposait toujours que la conciergerie avançait les
   frais, c'est donc la valeur de reprise. */
const _MODE_FACTURATION_LEGACY = {
  reversement: { encaissement:'gestionnaire', remuneration:'commission' },
  commission:  { encaissement:'proprietaire', remuneration:'commission' },
  forfait:     { encaissement:'proprietaire', remuneration:'forfait'    },
  mixte:       { encaissement:'proprietaire', remuneration:'mixte'      },
};
function _migrerFacturation() {
  PROPRIETAIRES.forEach(o => {
    if (!o.encaissement || !o.remuneration) {
      const l = _MODE_FACTURATION_LEGACY[o.modeFacturation] || _MODE_FACTURATION_LEGACY.commission;
      o.encaissement = o.encaissement || l.encaissement;
      o.remuneration = o.remuneration || l.remuneration;
    }
    if (!o.depensesPayeesPar) o.depensesPayeesPar = 'gestionnaire';
    if (o.refacturerDepenses === undefined) o.refacturerDepenses = true;
    delete o.modeFacturation;
  });
}

/* ============================================================
   LE DÉCOMPTE — un seul calcul pour tous les contrats

   Deux nombres seulement changent de place selon le contrat : les
   honoraires de la conciergerie, et les dépenses. Le reste en
   découle. On les calcule donc, puis on décide QUI DOIT QUOI À QUI.

   `sens` vaut :
     'reversement' → la conciergerie doit de l'argent au propriétaire
     'facture'     → le propriétaire doit de l'argent à la conciergerie

   `depensesACharge` répond à « qui supporte finalement les frais ? »,
   qui n'est pas la même question que « qui les a avancés ». Une
   dépense avancée par la conciergerie et non refacturée est bel et
   bien à SA charge : elle sort de sa marge, et c'est ce que traduit
   `resultatGestionnaire`.
   ============================================================ */
function calculFacture(o, ca, depenses, nbJours = 30) {
  const commission = o.remuneration === 'forfait' ? 0 : ca * (o.commission || 0);
  const forfait = (o.remuneration === 'forfait' || o.remuneration === 'mixte')
    ? (o.forfaitMensuel || 0) * (nbJours / 30)
    : 0;
  const honoraires = commission + forfait;

  const avanceesParGestionnaire = o.depensesPayeesPar === 'gestionnaire';
  const refacturees = (avanceesParGestionnaire && o.refacturerDepenses) ? depenses : 0;
  const absorbees   = (avanceesParGestionnaire && !o.refacturerDepenses) ? depenses : 0;
  // À la charge du propriétaire : celles qu'il règle lui-même, ou
  // celles qu'on lui refacture. Jamais les deux, par construction.
  const depensesACharge = avanceesParGestionnaire ? refacturees : depenses;

  const sens = o.encaissement === 'gestionnaire' ? 'reversement' : 'facture';
  // Le montant du document : ce que la conciergerie retient sur
  // l'encaissement, ou ce qu'elle facture. C'est le même calcul.
  const montant = honoraires + refacturees;

  return {
    sens, ca, depenses,
    commission, forfait, honoraires,
    depensesRefacturees: refacturees,
    depensesAbsorbees: absorbees,
    depensesACharge,
    montant,
    // Ce que le propriétaire conserve réellement, tous frais déduits.
    netProprietaire: ca - honoraires - depensesACharge,
    // Ce qui reste à la conciergerie une fois supportées ses avances
    // non refacturées.
    resultatGestionnaire: honoraires - absorbees,
    // Somme réellement transférée, et dans quel sens.
    aVerser: sens === 'reversement' ? ca - montant : 0,
    aRecevoir: sens === 'facture' ? montant : 0,
  };
}

// Résumé d'une ligne de contrat, pour les listes.
function libelleContrat(o) {
  const remun = o.remuneration === 'forfait'
    ? `forfait ${formatMontant(o.forfaitMensuel || 0)}/mois`
    : o.remuneration === 'mixte'
      ? `${Math.round((o.commission || 0) * 100)} % + ${formatMontant(o.forfaitMensuel || 0)}/mois`
      : `${Math.round((o.commission || 0) * 100)} %`;
  return `${ENCAISSEMENT_LABEL[o.encaissement]} · ${remun}`;
}

// Sort des dépenses, tel qu'on le lit sur un décompte.
function libelleDepenses(o) {
  if (o.depensesPayeesPar === 'proprietaire') return 'Réglées directement par le propriétaire';
  return o.refacturerDepenses
    ? (o.encaissement === 'gestionnaire' ? 'Avancées puis déduites du reversement' : 'Avancées puis refacturées')
    : 'Avancées par le gestionnaire, non refacturées';
}
// Répartition des 10 biens entre les 3 propriétaires
const _PROP_MAP = { L001:'O1', L002:'O1', L003:'O1', L010:'O1', L004:'O2', L005:'O2', L006:'O2', L007:'O3', L008:'O3', L009:'O3' };
LOGEMENTS.forEach(l => { l.proprietaireId = _PROP_MAP[l.id] || 'O1'; });

/* ============================================================
   DÉPENSES — frais engagés pour un logement (réparation, entretien,
   remplacement de matériel…), saisis manuellement par la conciergerie
   avec justificatif optionnel (facture jointe). Utilisées dans le
   module Comptabilité pour calculer le résultat net du propriétaire :
   CA − commission − dépenses.
   ============================================================ */
const DEPENSES = [
  { id:'D01', logementId:'L001', date:'2026-07-05', montant:180, libelle:'Réparation robinet cuisine',        factureNom:'facture-plombier-L001.pdf', factureData:null },
  { id:'D02', logementId:'L001', date:'2026-06-18', montant:65,  libelle:'Ampoules & consommables',           factureNom:null, factureData:null },
  { id:'D03', logementId:'L002', date:'2026-07-10', montant:340, libelle:'Remplacement matelas',              factureNom:'facture-literie-L002.pdf', factureData:null },
  { id:'D04', logementId:'L003', date:'2026-07-02', montant:120, libelle:'Entretien chaudière',                factureNom:'facture-chauffagiste.pdf', factureData:null },
  { id:'D05', logementId:'L004', date:'2026-06-25', montant:450, libelle:'Vidange spa & produits',            factureNom:null, factureData:null },
  { id:'D06', logementId:'L004', date:'2026-07-15', montant:90,  libelle:'Remplacement vaisselle cassée',     factureNom:null, factureData:null },
  { id:'D07', logementId:'L005', date:'2026-07-08', montant:620, libelle:'Réparation pompe piscine',          factureNom:'facture-piscine-L005.pdf', factureData:null },
  { id:'D08', logementId:'L006', date:'2026-06-30', montant:75,  libelle:'Produits ménagers',                  factureNom:null, factureData:null },
  { id:'D09', logementId:'L007', date:'2026-07-12', montant:210, libelle:'Peinture volets',                    factureNom:'facture-peintre.pdf', factureData:null },
  { id:'D10', logementId:'L008', date:'2026-07-04', montant:150, libelle:'Entretien jardin',                   factureNom:null, factureData:null },
  { id:'D11', logementId:'L009', date:'2026-06-22', montant:95,  libelle:'Remplacement serrure',              factureNom:'facture-serrurier.pdf', factureData:null },
  { id:'D12', logementId:'L010', date:'2026-07-18', montant:280, libelle:'Réparation lave-linge',             factureNom:'facture-electromenager.pdf', factureData:null },
];
function getDepensesByLogement(id) { return DEPENSES.filter(d => d.logementId === id); }
function getDepensesByProprietaire(id) {
  const biens = getLogementsByProprietaire(id).map(l => l.id);
  return DEPENSES.filter(d => biens.includes(d.logementId));
}

/* ============================================================
   FACTURATION PROPRIÉTAIRES — un relevé/facture de commission par
   propriétaire et par mois. La conciergerie encaisse le CA des
   réservations (via les plateformes ou en direct), prélève sa
   commission + les dépenses avancées, puis reverse le net au
   propriétaire ; la facture matérialise cette commission prélevée.
   statut : generee (✓, déjà émise) | attente (⏳, à générer).
   ============================================================ */
const MOIS_COMPTABLES = ['Février 2026', 'Mars 2026', 'Avril 2026', 'Mai 2026', 'Juin 2026', 'Juillet 2026'];
const FACTURES = [];
PROPRIETAIRES.forEach(o => {
  MOIS_COMPTABLES.forEach((mois, i) => {
    FACTURES.push({ id:`F-${o.id}-${i}`, proprietaireId:o.id, mois, statut: i < MOIS_COMPTABLES.length - 1 ? 'generee' : 'attente' });
  });
});
function getFacturesByProprietaire(id) { return FACTURES.filter(f => f.proprietaireId === id); }


/* ============================================================
   VOYAGEURS (CRM) — quelques habitués (nbSejours > 1)
   ============================================================ */
const VOYAGEURS = [
  { id:'V01', nom:'Emma Laurent',    email:'emma.laurent@gmail.com',   tel:'+33 6 12 45 78 90', pays:'France',      nbSejours:3, totalDepense:1245, dernierSejour:'2026-07-03', note:'Cliente fidèle, très soigneuse. Voyage souvent en couple.' },
  { id:'V02', nom:'Marco Rossi',     email:'marco.rossi@libero.it',    tel:'+39 340 118 22 55', pays:'Italie',      nbSejours:1, totalDepense:425,  dernierSejour:'2026-07-12', note:'' },
  { id:'V03', nom:'Sophie Meyer',    email:'s.meyer@outlook.fr',       tel:'+33 6 88 21 04 33', pays:'France',      nbSejours:2, totalDepense:810,  dernierSejour:'2026-07-24', note:'A déjà séjourné à Lyon l\'an dernier.' },
  { id:'V04', nom:'Julie Fontaine',  email:'julie.fontaine@gmail.com', tel:'+33 7 61 90 12 44', pays:'France',      nbSejours:1, totalDepense:520,  dernierSejour:'2026-08-05', note:'Réservation directe via le site.' },
  { id:'V05', nom:'Liam O\'Connor',  email:'liam.oconnor@gmail.com',   tel:'+353 85 774 21 09', pays:'Irlande',     nbSejours:1, totalDepense:269,  dernierSejour:'2026-07-06', note:'' },
  { id:'V06', nom:'Chen Wei',        email:'chen.wei@163.com',         tel:'+86 138 0011 2233', pays:'Chine',       nbSejours:1, totalDepense:269,  dernierSejour:'2026-07-20', note:'' },
  { id:'V07', nom:'Nina Kowalski',   email:'nina.kowalski@wp.pl',      tel:'+48 512 334 776',   pays:'Pologne',     nbSejours:1, totalDepense:269,  dernierSejour:'2026-07-23', note:'Voyage d\'affaires.' },
  { id:'V08', nom:'Thomas Bernard',  email:'t.bernard@free.fr',        tel:'+33 6 74 55 12 08', pays:'France',      nbSejours:1, totalDepense:269,  dernierSejour:'2026-08-01', note:'' },
  { id:'V09', nom:'Anna Schmidt',    email:'anna.schmidt@gmx.de',      tel:'+49 171 223 44 55', pays:'Allemagne',   nbSejours:1, totalDepense:392,  dernierSejour:'2026-07-01', note:'' },
  { id:'V10', nom:'David Cohen',     email:'david.cohen@gmail.com',    tel:'+972 54 221 09 88', pays:'Israël',      nbSejours:2, totalDepense:960,  dernierSejour:'2026-07-18', note:'Voyage en famille, apprécie les logements calmes.' },
  { id:'V11', nom:'Camille Roux',    email:'camille.roux@gmail.com',   tel:'+33 6 33 87 21 09', pays:'France',      nbSejours:1, totalDepense:568,  dernierSejour:'2026-07-27', note:'' },
  { id:'V12', nom:'Paul Girard',     email:'paul.girard@orange.fr',    tel:'+33 6 09 44 71 22', pays:'France',      nbSejours:2, totalDepense:2340, dernierSejour:'2026-07-11', note:'Réserve le chalet chaque été en famille.' },
  { id:'V13', nom:'Lukas Weber',     email:'lukas.weber@bluewin.ch',   tel:'+41 79 445 12 33',  pays:'Suisse',      nbSejours:1, totalDepense:895,  dernierSejour:'2026-07-25', note:'Demande un lit bébé.' },
  { id:'V14', nom:'Elena Popova',    email:'elena.popova@mail.ru',     tel:'+7 916 223 44 55',  pays:'Russie',      nbSejours:1, totalDepense:1225, dernierSejour:'2026-08-08', note:'Paiement en attente.' },
  { id:'V15', nom:'Groupe Moreau',   email:'contact@moreau-events.fr', tel:'+33 6 51 22 88 04', pays:'France',      nbSejours:1, totalDepense:1770, dernierSejour:'2026-07-04', note:'Séminaire d\'entreprise, 8 personnes.' },
  { id:'V16', nom:'James Wilson',    email:'james.wilson@gmail.com',   tel:'+44 7700 900123',   pays:'Royaume-Uni', nbSejours:2, totalDepense:3400, dernierSejour:'2026-07-19', note:'Fidèle sur la villa de Biarritz.' },
  { id:'V17', nom:'Yuki Tanaka',     email:'yuki.tanaka@gmail.com',    tel:'+81 90 1234 5678',  pays:'Japon',       nbSejours:1, totalDepense:1770, dernierSejour:'2026-08-01', note:'' },
  { id:'V18', nom:'Léa Dubois',      email:'lea.dubois@gmail.com',     tel:'+33 6 77 41 90 23', pays:'France',      nbSejours:1, totalDepense:281,  dernierSejour:'2026-07-08', note:'' },
  { id:'V19', nom:'Paolo Bianchi',   email:'paolo.bianchi@gmail.com',  tel:'+39 333 887 22 10', pays:'Italie',      nbSejours:1, totalDepense:281,  dernierSejour:'2026-07-21', note:'' },
  { id:'V20', nom:'Sarah Klein',     email:'sarah.klein@gmail.com',    tel:'+49 152 334 77 88', pays:'Allemagne',   nbSejours:1, totalDepense:363,  dernierSejour:'2026-08-02', note:'' },
  { id:'V21', nom:'Ahmed Benali',    email:'ahmed.benali@gmail.com',   tel:'+212 6 61 22 33 44',pays:'Maroc',       nbSejours:1, totalDepense:390,  dernierSejour:'2026-07-09', note:'' },
  { id:'V22', nom:'Marie Lefèvre',   email:'marie.lefevre@gmail.com',  tel:'+33 6 21 55 78 90', pays:'France',      nbSejours:1, totalDepense:390,  dernierSejour:'2026-07-22', note:'' },
  { id:'V23', nom:'Oliver Brown',    email:'oliver.brown@gmail.com',   tel:'+44 7700 900456',   pays:'Royaume-Uni', nbSejours:1, totalDepense:390,  dernierSejour:'2026-08-04', note:'' },
  { id:'V24', nom:'Famille Petit',   email:'famille.petit@gmail.com',  tel:'+33 6 88 90 11 22', pays:'France',      nbSejours:1, totalDepense:820,  dernierSejour:'2026-07-13', note:'2 adultes, 3 enfants.' },
  { id:'V25', nom:'Hans Müller',     email:'hans.mueller@t-online.de', tel:'+49 160 223 44 88', pays:'Allemagne',   nbSejours:1, totalDepense:710,  dernierSejour:'2026-07-26', note:'Arrive en train.' },
  { id:'V26', nom:'Isabella Ferrari',email:'isabella.ferrari@gmail.com',tel:'+39 348 776 22 11',pays:'Italie',      nbSejours:1, totalDepense:710,  dernierSejour:'2026-08-10', note:'' },
  { id:'V27', nom:'Kevin Martin',    email:'kevin.martin@gmail.com',   tel:'+33 6 45 12 78 33', pays:'France',      nbSejours:1, totalDepense:458,  dernierSejour:'2026-07-16', note:'' },
  { id:'V28', nom:'Zoé Garnier',     email:'zoe.garnier@gmail.com',    tel:'+33 7 82 44 90 11', pays:'France',      nbSejours:1, totalDepense:458,  dernierSejour:'2026-07-24', note:'Voyage avec un chien.' },
  { id:'V29', nom:'Lucas Fabre',     email:'lucas.fabre@gmail.com',    tel:'+33 6 90 33 71 45', pays:'France',      nbSejours:1, totalDepense:458,  dernierSejour:'2026-08-07', note:'' },
  { id:'V30', nom:'Grace Kim',       email:'grace.kim@gmail.com',      tel:'+82 10 2233 4455',  pays:'Corée du Sud',nbSejours:1, totalDepense:535,  dernierSejour:'2026-07-17', note:'' },
  { id:'V31', nom:'Antoine Roche',   email:'antoine.roche@gmail.com',  tel:'+33 6 12 90 45 78', pays:'France',      nbSejours:1, totalDepense:437,  dernierSejour:'2026-07-23', note:'Réservation directe, weekend en famille.' },
  { id:'V32', nom:'Fatima Zahra',    email:'fatima.zahra@gmail.com',   tel:'+212 6 70 11 22 33',pays:'Maroc',       nbSejours:1, totalDepense:633,  dernierSejour:'2026-08-05', note:'' },
];

/* ============================================================
   AVIS — la réputation, dans les deux sens

   Deux flux distincts, d'où les deux sous-sections de la page :

   1. AVIS  : ce que les voyageurs ont écrit sur vos logements, tous
      canaux confondus. L'hôte y répond ; la réponse repart vers la
      plateforme d'origine.
   2. ÉVALUATIONS : ce que l'hôte écrit sur ses voyageurs. Ce n'est
      pas le miroir du premier — c'est un autre objet, avec un autre
      délai et une autre destination.

   Deux pièges du monde réel qu'on modélise plutôt que de les lisser :

   · LES ÉCHELLES DIFFÈRENT. Airbnb note sur 5, Booking.com sur 10.
     Afficher « 9,2 » à côté de « 4,8 » sans le dire ferait passer
     un bon avis Booking pour une note délirante, et tout ramener
     sur 5 trahirait ce que le voyageur a réellement mis. On garde
     donc l'échelle d'origine à l'écran, et on ne normalise que pour
     comparer et faire des moyennes.

   · LES DÉLAIS EXPIRENT. Une évaluation de voyageur n'est pas
     déposable indéfiniment : passé la fenêtre de la plateforme, le
     bouton doit disparaître. Laisser croire qu'on peut encore
     évaluer un séjour de mai serait un mensonge de l'interface.
   ============================================================ */

/* `evaluationVoyageur` : la plateforme permet-elle à l'hôte d'évaluer son
   voyageur ? Toutes ne le font pas. Booking.com, Expedia et Agoda
   recueillent l'avis du voyageur sur le logement, mais rien dans l'autre
   sens : y afficher un bouton « Évaluer » promettrait une action que la
   plateforme refusera. `delaiEvaluation` n'a donc de sens que là où
   l'évaluation existe. */
const AVIS_CANAUX = {
  airbnb:  { label:'Airbnb',      max:5,  pas:1,   evaluationVoyageur:true,  delaiEvaluation:14 },
  booking: { label:'Booking.com', max:10, pas:0.5, evaluationVoyageur:false, delaiEvaluation:null },
  expedia: { label:'Expedia',     max:5,  pas:1,   evaluationVoyageur:false, delaiEvaluation:null },
  vrbo:    { label:'Vrbo',        max:5,  pas:1,   evaluationVoyageur:true,  delaiEvaluation:14 },
  agoda:   { label:'Agoda',       max:10, pas:0.5, evaluationVoyageur:false, delaiEvaluation:null },
  // Le direct n'a pas de plateforme tierce : l'évaluation est recueillie
  // par Oyvia lui-même, sans date limite imposée de l'extérieur.
  direct:  { label:'Direct',      max:5,  pas:1,   evaluationVoyageur:true,  delaiEvaluation:null },
};
// Peut-on évaluer le voyageur d'une réservation passée par ce canal ?
function evaluationPossible(canal) { return !!avisCanal(canal).evaluationVoyageur; }
function avisCanal(canal) { return AVIS_CANAUX[canal] || AVIS_CANAUX.direct; }

// Note ramenée sur 5, UNIQUEMENT pour trier et moyenner. Jamais affichée
// telle quelle à la place de la note d'origine.
function avisNoteSur5(note, canal) {
  const c = avisCanal(canal);
  return c.max === 5 ? note : (note / c.max) * 5;
}
// Note telle que le voyageur l'a mise, avec son échelle : « 9,2/10 ».
function avisNoteTexte(note, canal) {
  const c = avisCanal(canal);
  const n = Number(note);
  const txt = Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ',');
  return `${txt}/${c.max}`;
}

/* Avis reçus. `reponse: null` = en attente de réponse de l'hôte. */
const AVIS = [
  { id:'AV01', logementId:'L001', reservationId:'R01', voyageurId:'V01', canal:'airbnb',  note:5,   date:'2026-07-08',
    texte:"Appartement exactement comme sur les photos, très calme malgré l'hyper-centre. Le balcon sur cour est un vrai plus. Camille a répondu à toutes nos questions avant l'arrivée.",
    reponse:"Merci beaucoup Emma, c'est un plaisir de vous accueillir à nouveau quand vous voulez !", reponseDate:'2026-07-09' },
  { id:'AV02', logementId:'L001', reservationId:'R02', voyageurId:'V02', canal:'booking', note:8.8, date:'2026-07-17',
    texte:"Ottima posizione, appartamento pulito. La porta d'ingresso dell'edificio è difficile da aprire, ci abbiamo messo un po'.",
    reponse:null, reponseDate:null },
  { id:'AV03', logementId:'L002', reservationId:'R05', voyageurId:'V05', canal:'airbnb',  note:4,   date:'2026-07-10',
    texte:"Great little studio, perfect location for exploring Montmartre. Only downside is the noise from the street on Friday night.",
    reponse:null, reponseDate:null },
  { id:'AV04', logementId:'L003', reservationId:'R09', voyageurId:'V09', canal:'booking', note:9.6, date:'2026-07-06',
    texte:"Sehr schöne Wohnung, geschmackvoll eingerichtet. Die Kommunikation war ausgezeichnet.",
    reponse:"Vielen Dank Anna! Wir freuen uns auf Ihren nächsten Besuch in Bordeaux.", reponseDate:'2026-07-07' },
  { id:'AV05', logementId:'L004', reservationId:'R13', voyageurId:'V12', canal:'direct',  note:5,   date:'2026-07-19',
    texte:"Comme chaque été, le chalet est impeccable. Le spa avait été contrôlé avant notre arrivée, c'est appréciable.",
    reponse:null, reponseDate:null },
  { id:'AV06', logementId:'L005', reservationId:'R16', voyageurId:'V15', canal:'direct',  note:4,   date:'2026-07-12',
    texte:"Villa parfaite pour notre séminaire, très spacieuse. La connexion Wi-Fi a été un peu juste pour 8 personnes en visioconférence.",
    reponse:null, reponseDate:null },
  { id:'AV07', logementId:'L006', reservationId:'R19', voyageurId:'V18', canal:'airbnb',  note:5,   date:'2026-07-12',
    texte:"Séjour parfait, logement conforme et hôte très réactive. Je recommande sans hésiter.",
    reponse:null, reponseDate:null },
  { id:'AV08', logementId:'L007', reservationId:'R22', voyageurId:'V21', canal:'booking', note:7.5, date:'2026-07-15',
    texte:"Logement correct et bien situé. Le ménage n'était pas terminé à notre arrivée, nous avons attendu vingt minutes.",
    reponse:null, reponseDate:null },
  { id:'AV09', logementId:'L008', reservationId:'R25', voyageurId:'V24', canal:'direct',  note:5,   date:'2026-07-21',
    texte:"Idéal avec trois enfants, la maison est sécurisée et le jardin très agréable. Merci pour le lit parapluie.",
    reponse:"Merci pour votre retour, c'était un plaisir de vous recevoir en famille !", reponseDate:'2026-07-22' },
  { id:'AV10', logementId:'L009', reservationId:'R28', voyageurId:'V27', canal:'airbnb',  note:3,   date:'2026-07-22',
    texte:"Le logement est bien placé mais la climatisation ne fonctionnait pas correctement pendant la canicule. Signalé dès le premier jour, rien n'a été fait.",
    reponse:null, reponseDate:null },
  { id:'AV11', logementId:'L010', reservationId:'R31', voyageurId:'V30', canal:'airbnb',  note:5,   date:'2026-07-23',
    texte:"Wonderful stay, the flat is beautiful and very well equipped. Check-in was smooth and self-service.",
    reponse:null, reponseDate:null },
];

/* Évaluations déposées PAR l'hôte SUR les voyageurs. Ce qui n'est pas
   là est « à évaluer », tant que le délai de la plateforme court. */
const EVALUATIONS = [
  { id:'EV01', reservationId:'R01', note:5, texte:"Emma est une voyageuse idéale : communication fluide, logement rendu impeccable.", date:'2026-07-08' },
  { id:'EV02', reservationId:'R09', note:5, texte:"Séjour sans le moindre accroc, je recommande Anna à tout hôte.", date:'2026-07-06' },
];

/* ---------- Avis reçus : lectures dérivées ---------- */
function getAvis(id) { return AVIS.find(a => a.id === id) || null; }
function avisEnAttente() { return AVIS.filter(a => !a.reponse); }
// Un avis sur un canal débranché ne peut plus recevoir de réponse :
// la passerelle qui la porterait n'existe plus.
function avisRepondable(a) {
  const pf = PLATEFORMES.find(p => p.id === a.canal);
  return a.canal === 'direct' || (pf ? pf.connecte : false);
}
function repondreAvis(id, texte) {
  const a = getAvis(id);
  if (!a || !texte.trim()) return null;
  a.reponse = texte.trim();
  a.reponseDate = AUJOURDHUI;
  return a;
}
function supprimerReponseAvis(id) {
  const a = getAvis(id);
  if (!a) return false;
  a.reponse = null; a.reponseDate = null;
  return true;
}

/* Moyenne du parc, normalisée sur 5 : c'est la seule façon de mêler des
   notes Airbnb et Booking sans additionner des choux et des carottes. */
function avisMoyenne(liste) {
  const src = liste || AVIS;
  if (!src.length) return 0;
  const s = src.reduce((t, a) => t + avisNoteSur5(a.note, a.canal), 0);
  return s / src.length;
}
function avisParLogement(logementId) { return AVIS.filter(a => a.logementId === logementId); }

/* ---------- Évaluations de voyageurs ---------- */
function evaluationDe(reservationId) {
  return EVALUATIONS.find(e => e.reservationId === reservationId) || null;
}
// Dernier jour où la plateforme accepte encore l'évaluation. `null` =
// pas d'échéance : soit le canal n'en impose aucune (direct), soit il
// n'autorise pas l'évaluation du tout (cf. evaluationPossible).
function dateLimiteEvaluation(r) {
  const c = avisCanal(r.canal);
  return c.evaluationVoyageur && c.delaiEvaluation ? addDays(r.depart, c.delaiEvaluation) : null;
}
function evaluationExpiree(r, aujourdhui = AUJOURDHUI) {
  const limite = dateLimiteEvaluation(r);
  return limite ? aujourdhui > limite : false;
}

/* Séjours terminés, avec leur état d'évaluation. On renvoie TOUT, y
   compris les délais expirés : les masquer donnerait l'illusion d'un
   fichier propre alors que ces évaluations sont définitivement perdues,
   ce qui est justement l'information utile. */
function sejoursAEvaluer() {
  return RESERVATIONS
    // Un séjour Booking n'a pas sa place dans cette file : la plateforme
    // n'accepte aucune évaluation de voyageur. L'y laisser créerait une
    // tâche éternellement « à faire », impossible à conclure.
    .filter(r => r.statut === 'termine' && evaluationPossible(r.canal))
    .map(r => {
      const ev = evaluationDe(r.id);
      const limite = dateLimiteEvaluation(r);
      const expire = !ev && evaluationExpiree(r);
      return {
        reservation: r, evaluation: ev, limite, expire,
        statut: ev ? 'fait' : (expire ? 'expire' : 'a_faire'),
        joursRestants: (!ev && limite && !expire) ? nuitsEntre(AUJOURDHUI, limite) : null,
      };
    })
    // À évaluer d'abord, et parmi eux le plus urgent en tête : c'est
    // l'ordre de la file d'attente, pas l'ordre chronologique.
    .sort((a, b) => {
      const rang = { a_faire: 0, expire: 1, fait: 2 };
      if (rang[a.statut] !== rang[b.statut]) return rang[a.statut] - rang[b.statut];
      if (a.statut === 'a_faire') return (a.joursRestants ?? 99) - (b.joursRestants ?? 99);
      return b.reservation.depart.localeCompare(a.reservation.depart);
    });
}

function evaluerVoyageur(reservationId, note, texte) {
  const r = getReservation(reservationId);
  if (!r || !evaluationPossible(r.canal) || evaluationExpiree(r)) return null;
  const ex = evaluationDe(reservationId);
  if (ex) { ex.note = note; ex.texte = texte.trim(); ex.date = AUJOURDHUI; return ex; }
  const e = { id: 'EV' + Date.now(), reservationId, note, texte: texte.trim(), date: AUJOURDHUI };
  EVALUATIONS.push(e);
  return e;
}

/* ============================================================
   CONVERSATIONS (18) — reliées à une réservation
   canal : airbnb | booking | email | whatsapp

   WhatsApp est surtout utilisé par les voyageurs en réservation
   directe, qui n'ont pas de messagerie OTA pour vous joindre.
   Ces conversations ne s'affichent que si la plateforme WhatsApp
   est connectée (Paramètres > Plateformes).
   ============================================================ */
const CONVERSATIONS = [
  { id:'C16', reservationId:'R21', canal:'whatsapp', nonLu:2, horodatage:'10:24', messages:[
    { de:'voyageur', texte:'Bonjour ! On arrive le 2 août vers 14h, est-ce qu\'on peut déposer les valises avant le check-in ?', heure:'10:05' },
    { de:'hote',     texte:'Bonjour Sarah ! Oui, le logement est libre dès 12h ce jour-là, vous pourrez entrer directement.', heure:'10:18' },
    { de:'voyageur', texte:'Super ! Et le linge de lit est fourni ?', heure:'10:22' },
    { de:'voyageur', texte:'Dernière question : y a-t-il un parking à proximité ?', heure:'10:24' },
  ]},
  { id:'C01', reservationId:'R07', canal:'airbnb', nonLu:3, horodatage:'09:41', messages:[
    { de:'voyageur', texte:'Bonjour ! J\'arrive aujourd\'hui vers 15h. Comment récupérer les clés ?', heure:'08:40' },
    { de:'hote',     texte:'Bonjour Nina, bienvenue ! L\'accès se fait par boîte à clés, code 7734B à droite de la porte.', heure:'08:52' },
    { de:'voyageur', texte:'Parfait, merci. Y a-t-il un ascenseur ? J\'ai une grosse valise.', heure:'09:10' },
    { de:'voyageur', texte:'Et à quelle heure dois-je libérer le logement le 26 ?', heure:'09:12' },
    { de:'voyageur', texte:'Je viens d\'entrer : la salle de bain n\'a pas été faite, il y a des cheveux dans la douche et la poubelle est pleine. C\'est dommage.', heure:'09:41' },
  ]},
  { id:'C19', reservationId:'R10', canal:'airbnb', nonLu:1, horodatage:'11:20', messages:[
    { de:'voyageur', texte:'Bonjour, tout se passe très bien, merci pour l\'accueil !', heure:'09:30' },
    { de:'hote',     texte:'Merci David, ravi que le séjour vous plaise ! N\'hésitez pas si besoin.', heure:'09:52' },
    { de:'voyageur', texte:'Petit souci en revanche : la serrure de la porte d\'entrée est bloquée, on n\'arrive plus à fermer à clé.', heure:'11:20' },
  ]},
  { id:'C02', reservationId:'R32', canal:'email', nonLu:1, horodatage:'08:55', messages:[
    { de:'voyageur', texte:'Bonjour, nous arrivons en voiture ce soir. Y a-t-il un parking à proximité ?', heure:'08:30' },
    { de:'hote',     texte:'Bonjour Antoine, oui, le parking République est à 100m (payant, environ 18€/jour).', heure:'08:48' },
    { de:'voyageur', texte:'Super, merci. On sera là vers 19h.', heure:'08:55' },
  ]},
  { id:'C20', reservationId:'R06', canal:'booking', nonLu:1, horodatage:'07:45', messages:[
    { de:'voyageur', texte:'Bonjour, il n\'y a plus d\'eau chaude depuis ce matin, le chauffe-eau ne redémarre pas.', heure:'07:45' },
  ]},
  { id:'C17', reservationId:'R08', canal:'whatsapp', nonLu:0, horodatage:'Hier', messages:[
    { de:'voyageur', texte:'Bonsoir, je viens de régler l\'acompte. Vous confirmez la réservation du 1er au 4 août ?', heure:'Hier 20:10' },
    { de:'hote',     texte:'Bonsoir Thomas, c\'est bien reçu, réservation confirmée. Je vous envoie les instructions d\'arrivée la veille.', heure:'Hier 20:26' },
    { de:'voyageur', texte:'Parfait, merci beaucoup !', heure:'Hier 20:31' },
  ]},
  { id:'C18', reservationId:'R30', canal:'whatsapp', nonLu:1, horodatage:'21 juil.', messages:[
    { de:'voyageur', texte:'Bonjour, nous serons finalement 3 au lieu de 2. C\'est possible ?', heure:'21 juil. 15:40' },
    { de:'hote',     texte:'Bonjour Lucas, aucun souci, le duplex accueille jusqu\'à 4 personnes. Je mets à jour la réservation.', heure:'21 juil. 16:02' },
    { de:'voyageur', texte:'Merci ! Il y aura un lit d\'appoint du coup ?', heure:'21 juil. 16:15' },
  ]},
  { id:'C03', reservationId:'R23', canal:'airbnb', nonLu:1, horodatage:'09:05', messages:[
    { de:'voyageur', texte:'Bonjour, le wifi ne fonctionne pas très bien dans la chambre. Une solution ?', heure:'Hier 21:15' },
    { de:'hote',     texte:'Désolé pour la gêne Marie. Pouvez-vous redémarrer la box (bouton à l\'arrière, 30s) ?', heure:'Hier 21:30' },
    { de:'voyageur', texte:'Ça remarche, merci beaucoup !', heure:'Hier 21:48' },
    { de:'voyageur', texte:'Rebonjour ! Il ne reste plus de papier toilette ni de capsules pour la machine à café. Possible d\'en avoir ?', heure:'09:05' },
  ]},
  { id:'C04', reservationId:'R17', canal:'airbnb', nonLu:1, horodatage:'08:12', messages:[
    { de:'voyageur', texte:'Hi! Could you recommend a good seafood restaurant nearby?', heure:'Hier 18:20' },
    { de:'hote',     texte:'Bonjour James ! Essayez « Chez Albert » sur le port, à 10 min à pied. Réservez le soir.', heure:'Hier 18:40' },
    { de:'voyageur', texte:'Perfect, thank you!', heure:'Hier 19:02' },
    { de:'voyageur', texte:'Hi again — the air conditioning in the master bedroom is not working, it only blows warm air since last night. Could someone take a look?', heure:'08:12' },
  ]},
  { id:'C05', reservationId:'R03', canal:'airbnb', nonLu:0, horodatage:'22 juil.', messages:[
    { de:'voyageur', texte:'Bonjour, est-il possible de se garer facilement dans le Vieux-Lyon ?', heure:'22 juil. 14:10' },
    { de:'hote',     texte:'Bonjour Sophie, le quartier est piéton. Parking Saint-Jean à 3 min, 20€/jour.', heure:'22 juil. 14:35' },
  ]},
  { id:'C06', reservationId:'R04', canal:'email', nonLu:0, horodatage:'22 juil.', messages:[
    { de:'voyageur', texte:'Bonjour, nous arriverons tard le 5 août, vers 22h. Est-ce un problème ?', heure:'22 juil. 11:00' },
    { de:'hote',     texte:'Aucun souci Julie, l\'arrivée est autonome par boîte à clés, à toute heure.', heure:'22 juil. 11:20' },
    { de:'voyageur', texte:'Parfait, merci pour votre réactivité.', heure:'22 juil. 11:40' },
  ]},
  { id:'C07', reservationId:'R14', canal:'airbnb', nonLu:0, horodatage:'21 juil.', messages:[
    { de:'voyageur', texte:'Bonjour, serait-il possible d\'avoir un lit bébé pour notre séjour ?', heure:'21 juil. 16:05' },
    { de:'hote',     texte:'Bonjour Lukas, bien sûr, un lit parapluie et une chaise haute seront installés.', heure:'21 juil. 16:22' },
    { de:'voyageur', texte:'Merci infiniment, c\'est parfait.', heure:'21 juil. 16:30' },
  ]},
  { id:'C08', reservationId:'R15', canal:'booking', nonLu:2, horodatage:'Hier', messages:[
    { de:'voyageur', texte:'Bonjour, je n\'ai pas encore réglé le solde. Puis-je payer à l\'arrivée ?', heure:'21 juil. 09:30' },
    { de:'hote',     texte:'Bonjour Elena, le solde doit être réglé 7 jours avant l\'arrivée via le lien envoyé.', heure:'21 juil. 10:00' },
    { de:'voyageur', texte:'D\'accord, je m\'en occupe cette semaine.', heure:'21 juil. 10:15' },
    { de:'voyageur', texte:'Autre chose : nous restons une semaine complète, serait-il possible d\'avoir un ménage à mi-séjour ? Nous le paierons volontiers.', heure:'Hier 18:05' },
  ]},
  { id:'C09', reservationId:'R29', canal:'booking', nonLu:1, horodatage:'Hier', messages:[
    { de:'voyageur', texte:'Bonjour, les animaux sont-ils acceptés ? Nous avons un petit chien.', heure:'20 juil. 13:12' },
    { de:'hote',     texte:'Bonjour Zoé, oui les animaux calmes sont les bienvenus, sans supplément.', heure:'20 juil. 13:40' },
    { de:'voyageur', texte:'Génial, merci !', heure:'20 juil. 13:45' },
    { de:'voyageur', texte:'Dernière chose : nous restons 5 nuits, serait-il possible d\'avoir un passage de ménage pendant le séjour ?', heure:'Hier 17:20' },
  ]},
  { id:'C10', reservationId:'R26', canal:'airbnb', nonLu:0, horodatage:'20 juil.', messages:[
    { de:'voyageur', texte:'Bonjour, j\'arrive en train à La Rochelle. Le logement est-il loin de la gare ?', heure:'20 juil. 10:05' },
    { de:'hote',     texte:'Bonjour Hans, comptez 15 min à pied ou 6 min en taxi. Des vélos sont à disposition.', heure:'20 juil. 10:25' },
  ]},
  { id:'C11', reservationId:'R11', canal:'airbnb', nonLu:0, horodatage:'19 juil.', messages:[
    { de:'voyageur', texte:'Bonjour, serait-il possible d\'arriver un peu plus tôt, vers 13h le 27 ?', heure:'19 juil. 17:30' },
    { de:'hote',     texte:'Bonjour Camille, je vous confirme la veille selon le ménage, mais c\'est probable.', heure:'19 juil. 17:55' },
  ]},
  { id:'C12', reservationId:'R18', canal:'booking', nonLu:0, horodatage:'18 juil.', messages:[
    { de:'voyageur', texte:'Bonjour, combien de vrais lits doubles dans la villa ? Nous sommes 4 couples.', heure:'18 juil. 12:00' },
    { de:'hote',     texte:'Bonjour Yuki, 3 lits doubles + 2 lits simples jumelables en double. 4 couples OK.', heure:'18 juil. 12:30' },
    { de:'voyageur', texte:'Thank you, that works well for us.', heure:'18 juil. 12:45' },
  ]},
  { id:'C13', reservationId:'R24', canal:'airbnb', nonLu:0, horodatage:'17 juil.', messages:[
    { de:'voyageur', texte:'Hello, would a late checkout at 1pm be possible on the 9th?', heure:'17 juil. 15:20' },
    { de:'hote',     texte:'Bonjour Oliver, un départ à 13h est possible pour 25€. Je vous le confirme la veille.', heure:'17 juil. 15:45' },
  ]},
  { id:'C14', reservationId:'R33', canal:'booking', nonLu:0, horodatage:'16 juil.', messages:[
    { de:'voyageur', texte:'Bonjour, y a-t-il un parking et le wifi est-il inclus ?', heure:'16 juil. 19:10' },
    { de:'hote',     texte:'Bonjour Fatima, wifi fibre inclus. Parking République à 100m (payant).', heure:'16 juil. 19:30' },
    { de:'voyageur', texte:'Merci pour ces précisions.', heure:'16 juil. 19:35' },
  ]},
  { id:'C15', reservationId:'R20', canal:'booking', nonLu:0, horodatage:'15 juil.', messages:[
    { de:'voyageur', texte:'Merci pour ce super séjour ! Quand la caution est-elle rendue ?', heure:'15 juil. 20:00' },
    { de:'hote',     texte:'Merci Paolo ! La caution est libérée sous 5 jours après le départ, tout est parfait.', heure:'15 juil. 20:20' },
  ]},
];

/* ============================================================
   DISPONIBILITÉ — ce qui alimente les sélecteurs de date

   Convention hôtelière : une réservation du 3 au 6 occupe les NUITS
   du 3, 4 et 5. Le 6 est un jour de départ, il reste donc disponible
   à l'arrivée d'un autre voyageur (rotation le jour même). Compter le
   jour de départ comme occupé interdirait à tort une nuit sur deux.
   ============================================================ */

// Map « date de nuit » → réservation qui l'occupe, pour un logement.
function nuitsOccupees(logementId, ignorerReservationId) {
  const occ = new Map();
  RESERVATIONS.forEach(r => {
    if (r.logementId !== logementId) return;
    if (ignorerReservationId && r.id === ignorerReservationId) return;
    // Une réservation annulée libère ses nuits : sans ce filtre, refuser
    // une demande laisserait les dates bloquées à jamais, invendables
    // partout sans qu'aucun séjour n'y corresponde.
    if (r.statut === 'annule') return;
    for (let d = r.arrivee; d < r.depart; d = addDays(d, 1)) occ.set(d, r);
  });
  return occ;
}

// Libellé de l'occupant d'une nuit, pour l'infobulle du jour désactivé.
function occupantNuit(logementId, date, ignorerReservationId) {
  const r = nuitsOccupees(logementId, ignorerReservationId).get(date);
  if (!r) return null;
  return r.canal === 'bloque'
    ? `Bloqué — ${r.voyageur}`
    : `Réservé — ${r.voyageur} (${formatPlage(r.arrivee, r.depart)})`;
}

// Première nuit occupée à partir d'une date : borne haute d'un départ.
// Un séjour peut se terminer LE jour où le suivant commence, d'où le
// fait que cette date soit une borne inclusive côté départ.
function prochaineNuitOccupee(logementId, depuis, ignorerReservationId) {
  const occ = nuitsOccupees(logementId, ignorerReservationId);
  const futures = [...occ.keys()].filter(d => d >= depuis).sort();
  return futures.length ? futures[0] : null;
}

// Le voyageur est-il sur place ce jour-là ? Sert à SIGNALER, pas à
// interdire : un ménage de mi-séjour se fait justement pendant le séjour.
function occupationLogement(logementId, date) {
  const r = RESERVATIONS.find(x => x.logementId === logementId
    && x.canal !== 'bloque' && x.statut !== 'annule' && date >= x.arrivee && date <= x.depart);
  if (!r) return null;
  if (date === r.arrivee) return `Arrivée de ${r.voyageur}`;
  if (date === r.depart)  return `Départ de ${r.voyageur}`;
  return `${r.voyageur} sur place`;
}

// Charge d'un prestataire un jour donné. On signale, on n'interdit pas :
// une femme de ménage enchaîne plusieurs logements dans la journée.
function chargePrestataire(prestataireId, date, ignorerTacheId) {
  return TACHES.filter(t => t.prestataireId === prestataireId
    && t.date === date && t.statut !== 'termine' && t.id !== ignorerTacheId);
}

// Volume de travail d'un prestataire, toutes dates confondues. `effectuees`
// est le chiffre qui compte pour juger d'un collaborateur ; `restantes`
// évite de lire « 0 tâche effectuée » comme « ne fait rien » alors qu'il
// vient d'arriver et a déjà des interventions au planning.
function statsPrestataire(prestataireId) {
  const siennes = TACHES.filter(t => t.prestataireId === prestataireId);
  const effectuees = siennes.filter(t => t.statut === 'termine').length;
  return { effectuees, restantes: siennes.length - effectuees, total: siennes.length };
}

/* ============================================================
   ALERTES — la surveillance que l'hôte paramètre lui-même

   Le principe : plutôt que d'imposer des notifications décidées par
   Oyvia, l'hôte déclare les seuils qui comptent POUR LUI. Un parc de
   deux studios en ville et une conciergerie de quarante biens n'ont
   pas les mêmes signaux d'alerte.

   Chaque règle porte sa condition, son seuil et ses canaux de
   notification. `derniereAlerte` évite de renotifier en boucle tant
   que la situation n'a pas changé — une alerte qui se répète chaque
   heure finit ignorée, ce qui est pire que pas d'alerte du tout.
   ============================================================ */
const ALERTES_CONDITIONS = [
  { id:'occupation_sous',  label:"Occupation sous un seuil",     unite:'%',      defaut:40,
    aide:"Taux d'occupation du parc sur les 30 prochains jours", sens:'sous' },
  { id:'note_sous',        label:'Note moyenne sous un seuil',   unite:'/ 5',    defaut:4,
    aide:"Note moyenne des avis reçus, tous canaux confondus",   sens:'sous' },
  { id:'sans_reservation', label:'Logement sans réservation',    unite:'jours',  defaut:14,
    aide:"Aucune nouvelle réservation depuis X jours",           sens:'depuis' },
  { id:'menage_non_pris',  label:'Ménage non pris',              unite:'heures', defaut:24,
    aide:"Ménage non accepté à X h de l'échéance",               sens:'avant' },
  { id:'message_sans_reponse', label:'Message sans réponse',     unite:'heures', defaut:4,
    aide:"Un voyageur attend une réponse depuis X h",            sens:'depuis' },
  { id:'police_incomplete', label:'Fiche de police non remplie',  unite:'heures', defaut:24,
    aide:"Fiche non complétée à X h de l'arrivée du voyageur",     sens:'avant' },
  { id:'plafond_nuitees',  label:'Plafond de nuitées approché',  unite:'nuits',  defaut:15,
    aide:"Il reste moins de X nuits avant le plafond légal",     sens:'reste' },
  { id:'batterie_serrure', label:'Batterie de serrure faible',   unite:'%',      defaut:20,
    aide:"Batterie d'une serrure connectée sous X %",            sens:'sous' },
  { id:'prix_au_plancher', label:'Prix bloqué au plancher',      unite:'nuits',  defaut:5,
    aide:"X nuits ou plus collées au plancher tarifaire",        sens:'atteint' },
];
function getConditionAlerte(id) { return ALERTES_CONDITIONS.find(c => c.id === id) || null; }

/* Les quatre raccourcis proposés en un clic : les situations que tout hôte
   veut voir venir, avec des seuils déjà calibrés. Ils créent une règle
   ordinaire, modifiable ensuite comme les autres. */
const ALERTES_RAPIDES = [
  { condition:'occupation_sous',  seuil:40, nom:'Occupation sous 40 %' },
  { condition:'note_sous',        seuil:4,  nom:'Note moyenne sous 4 / 5' },
  { condition:'sans_reservation', seuil:14, nom:'Sans réservation sur 14 j' },
  { condition:'menage_non_pris',  seuil:24, nom:'Ménage non pris à 24 h' },
  { condition:'police_incomplete', seuil:24, nom:'Fiche de police à 24 h' },
];

const ALERTES = [
  { id:'AL1', nom:'Occupation sous 40 %',        condition:'occupation_sous',  seuil:40,
    logementId:null, canaux:['cloche','email'], actif:true,  derniereAlerte:'2026-07-19 08:12' },
  { id:'AL2', nom:'Ménage non pris à 24 h',      condition:'menage_non_pris',  seuil:24,
    logementId:null, canaux:['cloche'],         actif:true,  derniereAlerte:'2026-07-22 17:40' },
  { id:'AL3', nom:'Note moyenne sous 4 / 5',     condition:'note_sous',        seuil:4,
    logementId:null, canaux:['cloche','email'], actif:true,  derniereAlerte:null },
  { id:'AL4', nom:'Plafond de nuitées — Paris',  condition:'plafond_nuitees',  seuil:15,
    logementId:'L002', canaux:['cloche','email'], actif:true, derniereAlerte:'2026-07-21 06:30' },
  { id:'AL5', nom:'Message sans réponse 4 h',    condition:'message_sans_reponse', seuil:4,
    logementId:null, canaux:['cloche'],         actif:false, derniereAlerte:null },
  { id:'AL6', nom:'Fiche de police à 24 h',      condition:'police_incomplete', seuil:24,
    logementId:null, canaux:['cloche','email'], actif:true,  derniereAlerte:'2026-07-22 09:05' },
];

// Libellé lisible d'une règle : « Occupation sous 40 % · tout le parc ».
function libelleAlerte(a) {
  const c = getConditionAlerte(a.condition);
  const ou = a.logementId ? (getLogement(a.logementId) || {}).nom : 'Tout le parc';
  return `${c ? c.label : a.condition} · ${a.seuil} ${c ? c.unite : ''} · ${ou}`;
}

/* ============================================================
   FICHES DE POLICE

   Obligation légale française : tout hébergeur doit faire remplir une
   fiche individuelle de police à chaque voyageur étranger, la
   conserver six mois et la tenir à disposition des autorités.

   Deux statuts, et ils se DÉDUISENT du contenu :
     en_attente → il manque au moins une mention obligatoire
     complete   → tout est renseigné

   Pas d'état intermédiaire déclaratif : « envoyée », « transmise » ou
   « à remplir » décrivent des actions, pas l'état du document. Les
   confondre avec un statut laisse croire qu'une fiche vide mais
   envoyée serait plus avancée qu'une fiche vide — elle ne l'est pas.

   `pieces` porte les justificatifs. Le voyageur peut photographier sa
   pièce d'identité depuis son téléphone : c'est infiniment plus fiable
   qu'une saisie manuelle du numéro, où une coquille passe inaperçue.
   ============================================================ */
const POLICE_STATUTS = {
  en_attente: { label:'En attente', badge:'badge--warning' },
  complete:   { label:'Complète',   badge:'badge--positive' },
};
const POLICE_DOCUMENTS = [
  { id:'passeport',   label:'Passeport' },
  { id:'cni',         label:"Carte nationale d'identité" },
  { id:'titre_sejour',label:'Titre de séjour' },
];
// Seuls les voyageurs étrangers sont concernés : imposer la fiche à un
// résident français serait une collecte de données sans base légale.
const POLICE_OBLIGATOIRE_HORS = 'France';

const FICHES_POLICE = [
  { id:'FP1', reservationId:'R02', statut:'complete', nom:'Rossi', prenom:'Marco',
    naissanceDate:'1988-04-12', naissanceLieu:'Milan, Italie', nationalite:'Italie',
    domicile:'Via Torino 14, Milan', document:'passeport', documentNumero:'YA4471820',
    accompagnants:2, envoyeeLe:'2026-07-10', completeeLe:'2026-07-11',
    pieces:[{ nom:'passeport-rossi.jpg', type:'photo', ajouteLe:'2026-07-11' }] },
  { id:'FP2', reservationId:'R06', statut:'complete', nom:'Wei', prenom:'Chen',
    naissanceDate:'1991-11-03', naissanceLieu:'Shanghai, Chine', nationalite:'Chine',
    domicile:'Nanjing Road 288, Shanghai', document:'passeport', documentNumero:'EG9902144',
    accompagnants:1, envoyeeLe:'2026-07-18', completeeLe:'2026-07-19',
    pieces:[{ nom:'passeport-wei.jpg', type:'photo', ajouteLe:'2026-07-19' }] },
  { id:'FP3', reservationId:'R09', statut:'en_attente', nom:'Schmidt', prenom:'Anna',
    naissanceDate:'', naissanceLieu:'', nationalite:'Allemagne',
    domicile:'', document:'', documentNumero:'',
    accompagnants:3, envoyeeLe:'2026-07-20', completeeLe:null, pieces:[] },
  { id:'FP4', reservationId:'R15', statut:'en_attente', nom:'Popova', prenom:'Elena',
    naissanceDate:'', naissanceLieu:'', nationalite:'Bulgarie',
    domicile:'', document:'', documentNumero:'',
    accompagnants:5, envoyeeLe:null, completeeLe:null, pieces:[] },
  // Arrivée demain : c'est cette fiche que l'alerte des 24 h fait remonter.
  { id:'FP6', reservationId:'R03', statut:'en_attente', nom:'Meyer', prenom:'Sophie',
    naissanceDate:'1990-09-08', naissanceLieu:'Genève, Suisse', nationalite:'Suisse',
    domicile:'', document:'', documentNumero:'',
    accompagnants:1, envoyeeLe:'2026-07-21', completeeLe:null, pieces:[] },
  { id:'FP7', reservationId:'R14', statut:'en_attente', nom:'Weber', prenom:'Lukas',
    naissanceDate:'', naissanceLieu:'', nationalite:'Allemagne',
    domicile:'', document:'', documentNumero:'',
    accompagnants:4, envoyeeLe:null, completeeLe:null, pieces:[] },
  { id:'FP5', reservationId:'R05', statut:'complete', nom:"O'Connor", prenom:'Liam',
    naissanceDate:'1985-06-27', naissanceLieu:'Cork, Irlande', nationalite:'Irlande',
    domicile:'12 Patrick Street, Cork', document:'cni', documentNumero:'IE7781093',
    accompagnants:1, envoyeeLe:'2026-07-02', completeeLe:'2026-07-04',
    pieces:[{ nom:'cni-oconnor-recto.jpg', type:'photo', ajouteLe:'2026-07-04' }] },
];
function getFichePolice(id) { return FICHES_POLICE.find(f => f.id === id) || null; }

/* Heures restantes avant l'arrivée du voyageur. Négatif = l'arrivée est
   passée, et la fiche aurait dû être remplie — c'est le cas le plus grave,
   pas simplement « en retard ». L'heure d'arrivée du logement sert de
   référence : une fiche due « à 24 h » se compte depuis l'entrée réelle. */
function heuresAvantArrivee(fiche, maintenant = AUJOURDHUI) {
  const r = getReservation(fiche.reservationId);
  if (!r) return null;
  const l = getLogement(r.logementId);
  const heure = (l && l.sejour && l.sejour.arrivee) || '15:00';
  /* Le « maintenant » de la démo est une DATE, sans heure. La prendre à
     minuit ferait qu'une arrivée du lendemain à 15 h compte 39 h, et le
     seuil des 24 h ne se déclencherait jamais qu'au jour même. On se cale
     donc sur la même heure d'arrivée des deux côtés : une arrivée demain
     tombe alors exactement à 24 h, ce qui est le sens de la règle. */
  const arrivee = new Date(`${r.arrivee}T${heure}:00`);
  const ref = new Date(`${maintenant}T${heure}:00`);
  return Math.round((arrivee - ref) / 36e5);
}
/* Fiches non finalisées dont l'arrivée tombe dans la fenêtre surveillée.

   Les séjours déjà terminés sont exclus : une fiche manquante sur un séjour
   clos reste un manquement, mais ce n'est plus une relance à faire avant
   l'arrivée — la mélanger aux échéances du jour noierait ce qui est encore
   rattrapable. */
function fichesPoliceUrgentes(heures = 24, maintenant = AUJOURDHUI) {
  return FICHES_POLICE.filter(f => {
    if (f.statut === 'complete') return false;
    const r = getReservation(f.reservationId);
    if (!r || r.depart < maintenant) return false;
    const h = heuresAvantArrivee(f, maintenant);
    return h !== null && h <= heures;
  });
}
function fichePoliceParReservation(id) { return FICHES_POLICE.find(f => f.reservationId === id) || null; }
// Une fiche est complète quand toutes les mentions obligatoires sont là.
// La liste vient du formulaire réglementaire, pas d'un choix produit.
function fichePoliceManquants(f) {
  const requis = [['nom','Nom'], ['prenom','Prénom'], ['naissanceDate','Date de naissance'],
                  ['naissanceLieu','Lieu de naissance'], ['nationalite','Nationalité'],
                  ['domicile','Domicile'], ['document', "Type de document"], ['documentNumero','Numéro du document']];
  return requis.filter(([cle]) => !f[cle]).map(([, label]) => label);
}

/* ============================================================
   SERVICES ADDITIONNELS (Vente directe)

   Ce que l'hôte vend EN PLUS de la nuitée. C'est la marge la plus
   rentable du métier : aucune commission d'OTA, et le voyageur est
   déjà acquis.

   `unite` détermine la façon de facturer, et ce n'est pas cosmétique :
   un transfert se paie par trajet, un petit-déjeuner par personne et
   par jour, un lit d'appoint par séjour. Se tromper d'unité, c'est
   facturer dix fois trop cher ou dix fois trop peu.

   `delaiPrevenance` est le délai minimum entre la commande et la
   prestation : réserver un chef à domicile deux heures avant n'a pas
   de sens, et accepter la commande serait promettre l'impossible.

   `logements` vaut 'tous' ou la LISTE des biens concernés. Tout n'est
   pas proposable partout : un accès spa partenaire n'a de sens qu'à
   proximité du spa, un parking privé que là où il existe. Proposer un
   service qu'on ne peut pas rendre est pire que ne rien proposer.
   ============================================================ */
const SERVICES_UNITES = {
  sejour:        'par séjour',
  personne:      'par personne',
  personne_jour: 'par personne et par jour',
  nuit:          'par nuit',
  trajet:        'par trajet',
  unite:         "à l'unité",
  heure:         "par heure",
};
const SERVICES_CATEGORIES = {
  arrivee:   'Arrivée & départ',
  confort:   'Confort sur place',
  restauration: 'Restauration',
  mobilite:  'Mobilité',
  experience:'Expériences',
  menage:    'Ménage & linge',
};

const SERVICES = [
  { id:'SV01', nom:'Transfert aéroport', categorie:'mobilite', unite:'trajet', prix:65,
    desc:"Prise en charge à l'aéroport ou à la gare, avec panneau au nom du voyageur.",
    actif:true, delaiPrevenance:24, logements:'tous', prestataire:'Partenaire VTC', marge:30 },
  { id:'SV02', nom:'Location de voiture', categorie:'mobilite', unite:'nuit', prix:45,
    desc:'Véhicule livré sur place, assurance comprise.',
    actif:false, delaiPrevenance:48, logements:'tous', prestataire:'Loueur partenaire', marge:15 },
  { id:'SV03', nom:'Arrivée anticipée', categorie:'arrivee', unite:'sejour', prix:30,
    desc:"Accès au logement dès 11 h au lieu de 15 h, sous réserve de disponibilité.",
    actif:true, delaiPrevenance:24, logements:'tous', prestataire:null, marge:100 },
  { id:'SV04', nom:'Départ tardif', categorie:'arrivee', unite:'sejour', prix:30,
    desc:"Libération du logement à 15 h au lieu de 11 h, sous réserve de disponibilité.",
    actif:true, delaiPrevenance:24, logements:'tous', prestataire:null, marge:100 },
  { id:'SV05', nom:'Panier d\'accueil', categorie:'restauration', unite:'sejour', prix:35,
    desc:'Produits locaux, bouteille de vin et douceurs à l\'arrivée.',
    actif:true, delaiPrevenance:48, logements:'tous', prestataire:'Épicerie fine', marge:40 },
  { id:'SV06', nom:'Petit-déjeuner livré', categorie:'restauration', unite:'personne_jour', prix:12,
    desc:'Viennoiseries, jus frais et boissons chaudes déposés chaque matin.',
    actif:false, delaiPrevenance:24, logements:'tous', prestataire:'Boulangerie du quartier', marge:35 },
  { id:'SV07', nom:'Chef à domicile', categorie:'restauration', unite:'personne', prix:75,
    desc:'Dîner préparé sur place, menu convenu à l\'avance.',
    actif:false, delaiPrevenance:72, logements:'tous', prestataire:'Chef partenaire', marge:20 },
  { id:'SV08', nom:'Réservation restaurant', categorie:'restauration', unite:'unite', prix:0,
    desc:'Table réservée dans nos adresses partenaires. Service offert.',
    actif:true, delaiPrevenance:24, logements:'tous', prestataire:null, marge:0 },
  { id:'SV09', nom:'Lit d\'appoint', categorie:'confort', unite:'sejour', prix:25,
    desc:'Lit simple installé avant l\'arrivée, linge fourni.',
    actif:true, delaiPrevenance:24, logements:'tous', prestataire:null, marge:100 },
  { id:'SV10', nom:'Lit bébé et chaise haute', categorie:'confort', unite:'sejour', prix:15,
    desc:'Lit parapluie et chaise haute, installés et désinfectés.',
    actif:true, delaiPrevenance:24, logements:'tous', prestataire:null, marge:100 },
  { id:'SV11', nom:'Ménage en cours de séjour', categorie:'menage', unite:'unite', prix:45,
    desc:'Passage complet en milieu de séjour, changement du linge inclus.',
    actif:true, delaiPrevenance:48, logements:'tous', prestataire:'Équipe ménage', marge:35 },
  { id:'SV12', nom:'Blanchisserie', categorie:'menage', unite:'unite', prix:20,
    desc:'Collecte et retour sous 24 h.',
    actif:false, delaiPrevenance:24, logements:'tous', prestataire:'Pressing partenaire', marge:30 },
  { id:'SV13', nom:'Massage à domicile', categorie:'experience', unite:'personne', prix:80,
    desc:'Praticien diplômé, matériel apporté sur place.',
    actif:false, delaiPrevenance:48, logements:'tous', prestataire:'Spa partenaire', marge:25 },
  { id:'SV14', nom:'Accès spa et piscine', categorie:'experience', unite:'personne_jour', prix:25,
    desc:'Entrée à l\'espace bien-être partenaire, à deux pas du logement.',
    actif:false, delaiPrevenance:24, logements:['L005','L004'], prestataire:'Spa partenaire', marge:20 },
  { id:'SV15', nom:'Excursions et activités', categorie:'experience', unite:'personne', prix:55,
    desc:'Visites guidées, dégustations, activités nautiques selon la saison.',
    actif:true, delaiPrevenance:72, logements:'tous', prestataire:'Agence locale', marge:20 },
  { id:'SV16', nom:'Location de matériel', categorie:'experience', unite:'nuit', prix:18,
    desc:'Vélos, skis ou planches livrés au logement.',
    actif:false, delaiPrevenance:48, logements:['L004'], prestataire:'Loueur local', marge:25 },
  { id:'SV17', nom:'Parking privé', categorie:'mobilite', unite:'nuit', prix:15,
    desc:'Place réservée à proximité immédiate.',
    actif:true, delaiPrevenance:24, logements:['L003','L004','L005','L008'], prestataire:null, marge:100 },
  { id:'SV18', nom:'Garde d\'animaux', categorie:'confort', unite:'nuit', prix:25,
    desc:'Promenade et garde pendant vos sorties.',
    actif:false, delaiPrevenance:72, logements:'tous', prestataire:'Pet-sitter', marge:25 },
];
function getService(id) { return SERVICES.find(s => s.id === id) || null; }

/* Portée d'un service. Les identifiants pointant vers un logement supprimé
   sont écartés : sans ce filtre, un service afficherait « 3 logements » en
   n'en couvrant réellement que deux. */
function porteeService(s) {
  if (!s || s.logements === 'tous') return { tous: true, ids: LOGEMENTS.map(l => l.id), label: 'Tous les logements' };
  const ids = (Array.isArray(s.logements) ? s.logements : []).filter(id => getLogement(id));
  const label = ids.length === 0 ? 'Aucun logement'
              : ids.length === 1 ? getLogement(ids[0]).nom
              : `${ids.length} logements`;
  return { tous: false, ids, label };
}
function serviceCouvreLogement(s, logementId) {
  return porteeService(s).ids.includes(logementId);
}
// Services réellement proposables sur un bien donné : actifs ET dans la portée.
function servicesPourLogement(logementId) {
  return SERVICES.filter(s => s.actif && serviceCouvreLogement(s, logementId));
}
function servicesActifs() { return SERVICES.filter(s => s.actif); }
function servicesParCategorie() {
  return Object.keys(SERVICES_CATEGORIES)
    .map(c => ({ cat:c, label:SERVICES_CATEGORIES[c], items:SERVICES.filter(s => s.categorie === c) }))
    .filter(g => g.items.length);
}

/* ============================================================
   SITE WEB — la vitrine qui alimente les réservations directes

   Raison d'être : chaque réservation passée par une OTA coûte 15 à 18 %
   de commission. Un site propre, avec un vrai moteur de réservation
   branché sur le MÊME calendrier que le reste d'Oyvia, transforme ces
   séjours en direct. C'est pour ça que la page n'est pas une simple
   plaquette : elle expose des disponibilités réelles.

   Les réservations créées depuis le site arrivent avec canal 'direct',
   exactement comme celles saisies à la main — aucun circuit parallèle,
   donc aucun risque de surréservation entre le site et les OTA.
   ============================================================ */

const SITE_THEMES = [
  { id:'epure',    label:'Épuré',    desc:"Blanc, typographie large, beaucoup d'air.",
    fond:'#FFFFFF', alt:'#F5F7FB', texte:'#0B1020', titres:'#0B1020', c1:'#5170FF', c2:'#0B1020' },
  { id:'chaleur',  label:'Chaleur',  desc:"Tons sable et terracotta, esprit maison d'hôtes.",
    fond:'#FDF8F3', alt:'#F6EDE4', texte:'#3A302A', titres:'#2A211C', c1:'#C2703F', c2:'#3A302A' },
  { id:'nuit',     label:'Nuit',     desc:'Fond sombre, photos mises en avant.',
    fond:'#0F1422', alt:'#171E30', texte:'#C9D2E4', titres:'#FFFFFF', c1:'#7B93FF', c2:'#070A12' },
  { id:'olive',    label:'Olive',    desc:'Vert grisé, sobre et naturel.',
    fond:'#FAFAF7', alt:'#EFF1EA', texte:'#3A3F36', titres:'#22261E', c1:'#6C7574', c2:'#011E1C' },
  { id:'azur',     label:'Azur',     desc:'Bleu clair, bord de mer.',
    fond:'#FBFDFF', alt:'#EAF3FA', texte:'#28394A', titres:'#12293D', c1:'#1E88C7', c2:'#0C2739' },
  { id:'terracotta', label:'Terracotta', desc:'Ocre et brique, ambiance méditerranéenne.',
    fond:'#FFFAF6', alt:'#F7E9E0', texte:'#4A362E', titres:'#33231C', c1:'#B4542F', c2:'#33231C' },
  { id:'ardoise',  label:'Ardoise',  desc:'Gris profond, très contemporain.',
    fond:'#FAFAFB', alt:'#EEEFF2', texte:'#33383F', titres:'#16191D', c1:'#41474F', c2:'#16191D' },
  { id:'or',       label:'Or',       desc:'Noir et doré, positionnement haut de gamme.',
    fond:'#FFFFFF', alt:'#F7F4EC', texte:'#3B372C', titres:'#191713', c1:'#B08A38', c2:'#191713' },
];
function getTheme(id) { return SITE_THEMES.find(t => t.id === id) || SITE_THEMES[0]; }

// Canaux de contact affichés sur le site. Le logo est porté par le
// référentiel, pas par le gabarit : ajouter un canal ne demande alors
// aucune retouche de la vitrine.
const SITE_CONTACTS = [
  { id:'tel',       label:'Téléphone', placeholder:'+212 6 00 00 00 00', lien: v => `tel:${String(v).replace(/[^+\d]/g, '')}`,
    icone:'<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>' },
  { id:'whatsapp',  label:'WhatsApp',  placeholder:'+212 6 00 00 00 00', lien: v => `https://wa.me/${String(v).replace(/[^\d]/g, '')}`,
    icone:'<path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2z"/><path d="M8.5 7.8c.2-.4.4-.4.6-.4h.6c.2 0 .5 0 .7.5l.9 2c.1.3 0 .5-.1.7l-.4.5c-.1.2-.3.3-.1.6a7 7 0 0 0 3.3 2.9c.3.1.5.1.7-.1l.6-.7c.2-.2.4-.2.6-.1l1.9.9c.3.1.4.3.4.5 0 .5-.2 1.4-.9 1.8-.6.4-1.6.6-2.7.2a11 11 0 0 1-6.3-6c-.4-1.1-.2-2.2.2-2.8z" fill="#fff" stroke="none"/>' },
  { id:'instagram', label:'Instagram', placeholder:'votre_compte',       lien: v => `https://instagram.com/${String(v).replace(/^@/, '')}`,
    icone:'<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1.2" fill="currentColor" stroke="none"/>' },
  { id:'email',     label:'E-mail',    placeholder:'contact@exemple.com', lien: v => `mailto:${v}`,
    icone:'<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 7 10 6 10-6"/>' },
];
function getContactCanal(id) { return SITE_CONTACTS.find(c => c.id === id) || null; }
// Valeur d'un canal, uniquement s'il est activé. Renvoie '' sinon, ce qui
// permet aux gabarits de tester la présence sans vérifier deux champs.
function contactValeur(id) {
  const c = (SITE_WEB.contacts || {})[id];
  return c && c.actif ? String(c.valeur || '').trim() : '';
}
function lienContact(id) {
  const canal = getContactCanal(id), v = contactValeur(id);
  return canal && v ? canal.lien(v) : '';
}
// Canaux réellement affichables : activés ET renseignés.
function contactsActifs() {
  return SITE_CONTACTS
    .map(c => ({ canal: c, conf: (SITE_WEB.contacts || {})[c.id] }))
    .filter(x => x.conf && x.conf.actif && String(x.conf.valeur || '').trim());
}

// Modes de confirmation d'une demande venue du site.
const SITE_MODES_RESA = [
  { id:'instantane', label:'Réservation instantanée',
    desc:"Le voyageur réserve et paie en ligne ; les dates se bloquent immédiatement." },
  { id:'demande',    label:'Demande à valider',
    desc:"Vous recevez la demande et confirmez sous 24 h. Les dates ne se bloquent qu'après votre accord." },
];

const SITE_WEB = {
  // Assistant de création : tant qu'il n'est pas terminé, la page affiche
  // les 5 étapes plutôt que les réglages détaillés. Un réglage fin n'a pas
  // de sens avant que le site ait un nom, des couleurs et des logements.
  configure: false,
  statut: 'brouillon',                  // publie | brouillon
  actif: false,
  sousDomaine: 'mon-site',              // mon-site.oyvia.site
  domainePerso: '',                     // ex. www.conciergerie-lumia.fr
  domaineVerifie: false,
  theme: 'epure',
  couleur: '#5170FF',
  couleurSecondaire: '#0B1020',
  couleurTexte: '#3A4152',
  couleurTitres: '#0B1020',
  couleurFond: '#FFFFFF',
  // Couverture : hauteur du bandeau d'accueil et densité du voile sombre,
  // sans quoi un titre blanc sur une photo claire devient illisible.
  couvertureHauteur: 78,               // % de la hauteur d'écran
  couvertureVoile: 45,                 // % d'opacité du voile
  contacts: {
    tel:       { actif:false, valeur:'' },
    whatsapp:  { actif:false, valeur:'' },
    instagram: { actif:false, valeur:'' },
    email:     { actif:false, valeur:'' },
  },
  whatsappFlottant: false,
  logo: null,                           // image réduite, en data URL
  photos: [],                           // accueil : plusieurs = carrousel
  titre: '',
  slogan: '',
  adresse: '',
  accroche: 'Votre prochain séjour commence ici',
  sousAccroche: "Des locations d'exception, en réservation directe.",
  // Sections éditoriales de la vitrine. Stockées ici pour qu'elles restent
  // modifiables comme le reste, plutôt que figées dans le gabarit.
  // Sections de la page, dans l'ordre d'affichage. Chacune peut être
  // renommée, déplacée, masquée ou supprimée — c'est ce qui rend le site
  // modifiable sans toucher au code.
  sections: [
    { id:'sec-logements', type:'logements', actif:true,
      surtitre:'Nos adresses', titre:'Choisissez votre logement' },
    { id:'sec-services', type:'cartes', actif:true, fond:'alt',
      surtitre:'Notre conciergerie', titre:"L'expérience d'un séjour d'exception",
      items:[
        { titre:'Conciergerie complète', texte:"Annonces, tarifs, voyageurs, ménage : nous prenons tout en charge." },
        { titre:'Ménage hôtelier',       texte:"Linge fourni, contrôle qualité avant chaque arrivée." },
        { titre:'Accueil des voyageurs', texte:"Remise des clés, assistance 7 j/7, réponse en moins d'une heure." },
        { titre:'Revenus optimisés',     texte:"Tarification ajustée à la saison et à la demande réelle." },
      ] },
    { id:'sec-proprio', type:'proprietaire', actif:true,
      surtitre:'Propriétaires', titre:'Vous êtes propriétaire ?',
      texte:"Confiez-nous votre bien : nous nous occupons de tout, de la mise en ligne au ménage, et vous suivez vos revenus en toute transparence.",
      bouton:'Nous confier un bien' },
    { id:'sec-contact', type:'contact', actif:true, fond:'alt',
      surtitre:'Contact', titre:'Une question ?' },
  ],
  apropos: "Nous gérons une dizaine d'adresses en France. Chaque logement est nettoyé par notre équipe, vérifié avant chaque arrivée, et nous répondons en moins d'une heure.",
  logementsPublies: [],
  reseaux: { instagram: '', facebook: '' },
  // Moteur de réservation
  reservation: {
    actif: true,
    mode: 'demande',
    remiseDirecte: 10,                  // % affiché face au prix OTA
    acompte: 30,                        // % à la réservation
    nuitsMin: 2,
    delaiMin: 1,                        // jours entre la demande et l'arrivée
    annulation: 'flexible',             // cf. POLITIQUES_ANNULATION
    cgvAcceptees: true,
    paiementEnLigne: true,
  },
  // Compteurs de la démo (non dérivables : on ne trace pas les visites)
  stats: { visites30j: 0, demandes30j: 0, tauxConversion: 0 },
};

// Types de sections proposés à l'ajout. « unique » interdit les doublons :
// deux listes de logements ou deux blocs contact n'auraient pas de sens.
const SITE_TYPES_SECTION = [
  { id:'texte',        label:'Texte libre',     desc:'Un titre et un paragraphe.', unique:false },
  { id:'cartes',       label:'Cartes',          desc:'Une grille de services ou d\'atouts.', unique:false },
  { id:'logements',    label:'Nos logements',   desc:'La grille des biens publiés.', unique:true },
  { id:'proprietaire', label:'Propriétaires',   desc:'Un appel aux propriétaires, avec chiffres clés.', unique:true },
  { id:'contact',      label:'Contact',         desc:'Vos coordonnées et vos réseaux.', unique:true },
];
function nouvelleSection(type) {
  const t = SITE_TYPES_SECTION.find(x => x.id === type) || SITE_TYPES_SECTION[0];
  const base = { id: 'sec-' + Date.now(), type: t.id, actif: true, surtitre: '', titre: t.label };
  if (t.id === 'cartes') base.items = [{ titre: 'Un atout', texte: 'Décrivez-le en une phrase.' }];
  if (t.id === 'texte') base.texte = 'Votre texte ici.';
  if (t.id === 'proprietaire') { base.texte = 'Confiez-nous votre bien.'; base.bouton = 'Nous contacter'; }
  return base;
}

// Les 5 étapes de l'assistant. « complete » sert à la fois à la pastille
// de progression et au blocage du bouton « Continuer » : une étape sans
// contenu utile ne doit pas pouvoir être franchie.
const SITE_ETAPES = [
  { id:'identite', titre:'Votre identité',       sous:"Le nom et le slogan affichés en haut de votre site.",
    complete: () => !!String(SITE_WEB.titre || '').trim() },
  { id:'couleurs', titre:'Vos couleurs',         sous:"Elles habillent les boutons et accents de votre site.",
    complete: () => !!SITE_WEB.couleur },
  { id:'photos',   titre:"Vos photos d'accueil", sous:"Plusieurs images = carrousel automatique. Vous pourrez aussi importer les photos de vos biens depuis Airbnb plus tard.",
    complete: () => true },              // facultatif : un site sans photo reste un site
  { id:'contact',  titre:'Vos coordonnées',      sous:"Pour que vos voyageurs et propriétaires puissent vous joindre.",
    // Au moins UN moyen d'être joint : lequel importe peu, mais publier un
    // site sans aucun contact revient à publier une impasse.
    complete: () => contactsActifs().length > 0 },
  { id:'logements',titre:'Vos logements',        sous:"Sélectionnez les biens à afficher. Vous pourrez tout affiner ensuite.",
    complete: () => true },
];

// Logements réellement publiables : une annonce en brouillon ou hors ligne
// n'a rien à faire sur le site public.
function logementsPubliables() {
  return LOGEMENTS.filter(l => l.statut !== 'brouillon');
}
function logementsDuSite() {
  return logementsPubliables().filter(l => SITE_WEB.logementsPublies.includes(l.id));
}
/* ---------- Images du site ----------
   Les photos sont stockées en data URL dans le même instantané que le
   reste. Sans réduction, deux photos de smartphone suffiraient à dépasser
   le quota localStorage — et saveOyviaState échoue silencieusement, ce qui
   ferait perdre TOUT l'état, pas seulement les images. On redimensionne
   donc systématiquement avant de stocker, et on plafonne le nombre. */
const SITE_PHOTOS_MAX = 6;
const SITE_IMAGE_LARGEUR_MAX = 1400;
const SITE_LOGO_LARGEUR_MAX = 400;

function reduireImage(file, largeurMax) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) return reject(new Error('Fichier non image'));
    const lecteur = new FileReader();
    lecteur.onerror = () => reject(new Error('Lecture impossible'));
    lecteur.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Image illisible'));
      img.onload = () => {
        const ratio = Math.min(1, largeurMax / img.width);
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * ratio);
        c.height = Math.round(img.height * ratio);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        // Le PNG conserve la transparence, indispensable pour un logo.
        const png = file.type === 'image/png' && largeurMax === SITE_LOGO_LARGEUR_MAX;
        resolve(c.toDataURL(png ? 'image/png' : 'image/jpeg', 0.78));
      };
      img.src = lecteur.result;
    };
    lecteur.readAsDataURL(file);
  });
}

function urlSite() {
  return SITE_WEB.domainePerso && SITE_WEB.domaineVerifie
    ? SITE_WEB.domainePerso
    : `${SITE_WEB.sousDomaine || 'mon-site'}.oyvia.site`;
}
// Prix affiché en direct : la remise est le principal argument face aux OTA.
function prixDirect(l) {
  const r = SITE_WEB.reservation;
  return Math.round(l.tarifBase * (1 - (r.remiseDirecte || 0) / 100));
}
// Réservations directes déjà encaissées, et commission évitée. Le taux OTA
// moyen est une hypothèse assumée : on l'affiche comme telle dans l'écran.
const COMMISSION_OTA_MOYENNE = 0.15;
function statsReservationsDirectes() {
  const directes = RESERVATIONS.filter(r => r.canal === 'direct' && r.statut !== 'annule');
  const ca = directes.reduce((s, r) => s + r.montant, 0);
  return { nombre: directes.length, ca, commissionEvitee: Math.round(ca * COMMISSION_OTA_MOYENNE) };
}

/* ---------- Demandes de réservation venues du site ----------
   Une demande occupe déjà ses nuits dès sa création : c'est volontaire.
   Les laisser vendables pendant qu'on réfléchit reviendrait à promettre
   un logement qu'on peut perdre entre-temps. Accepter ne change donc pas
   la disponibilité, seulement l'engagement ; refuser la libère. */
function demandesEnAttente() {
  return RESERVATIONS.filter(r => r.statut === 'demande');
}
// L'e-mail du demandeur est déposé dans la note à la création (site public).
function emailDemande(r) {
  const m = String(r.note || '').match(/[\w.+-]+@[\w-]+\.[\w.]+/);
  return m ? m[0] : '';
}
function accepterDemande(id) {
  const r = getReservation(id);
  if (!r || r.statut !== 'demande') return null;
  r.statut = 'confirme';
  // L'acompte réglé en ligne ne l'a pas encore été : en mode « demande »,
  // rien n'est encaissé tant que l'hôte n'a pas dit oui.
  const ac = (SITE_WEB.reservation || {}).acompte || 0;
  r.paiement = ac ? 'acompte' : 'impaye';
  r.accepteeLe = AUJOURDHUI;
  if (typeof saveOyviaState === 'function') saveOyviaState();
  return r;
}
function refuserDemande(id, motif) {
  const r = getReservation(id);
  if (!r || r.statut !== 'demande') return null;
  r.statut = 'annule';
  r.paiement = 'rembourse';
  r.motifRefus = motif || '';
  r.refuseeLe = AUJOURDHUI;
  if (typeof saveOyviaState === 'function') saveOyviaState();
  return r;
}

/* ============================================================
   PRESTATAIRES (5) — équipe ménage / maintenance
   ============================================================ */
/* ============================================================
   RÔLES DES PRESTATAIRES

   À ne pas confondre avec ROLES (plus bas), qui régit les COMPTES
   utilisateurs et leurs permissions. Ici il s'agit du métier d'un
   intervenant terrain : ce qu'il vient faire, pas ce qu'il a le droit
   de voir dans l'application.

   La liste est ouverte : un gestionnaire peut créer « Jardinage » ou
   « Piscine » sans que le code ait à connaître ces métiers. Les rôles
   d'origine sont marqués `systeme` — non pas pour les protéger d'un
   caprice, mais parce que l'affectation automatique des tâches par
   Vivi s'appuie dessus (cf. _viviPrestatairePour).
   ============================================================ */
const ROLES_PRESTATAIRE = [
  { id:'menage',      nom:'Ménage',      systeme:true },
  { id:'polyvalent',  nom:'Polyvalent',  systeme:true },
  { id:'maintenance', nom:'Maintenance', systeme:true },
];
function getRolePrestataire(nom) { return ROLES_PRESTATAIRE.find(r => r.nom === nom) || null; }
// Combien de prestataires occupent ce rôle : on ne supprime pas un métier
// encore exercé, sinon leurs fiches pointeraient vers un rôle inexistant.
function effectifRole(nom) { return PRESTATAIRES.filter(p => p.role === nom).length; }

const PRESTATAIRES = [
  // Aucun tarif ici : la rémunération d'une intervention dépend du bien
  // (un chalet de 5 pièces n'est pas un studio), pas de la personne.
  // Elle est portée par BAREME_INTERVENTIONS, plus bas.
  { id:'P1', nom:'Sylvie Ménard',  role:'Ménage',      zone:'Lyon',         tel:'+33 6 22 44 11 09' },
  { id:'P2', nom:'Karim Bouaziz',  role:'Polyvalent',  zone:'Paris',        tel:'+33 6 55 77 22 88' },
  { id:'P3', nom:'Nadia Lopez',    role:'Ménage',      zone:'Sud-Ouest',    tel:'+33 6 88 33 55 12' },
  { id:'P4', nom:'Marc Antoine',   role:'Maintenance', zone:'Multi-villes', tel:'+33 6 12 78 90 44' },
  { id:'P5', nom:'Léna Fritsch',   role:'Ménage',      zone:'Sud-Est',      tel:'+33 6 44 90 11 77' },
];

/* ============================================================
   TACHES (22) — ménage, check-in, maintenance, linge
   type : menage | checkin | maintenance | linge
   statut : a_faire | en_cours | termine
   ============================================================ */
const TACHES = [
  { id:'T01', type:'menage',      logementId:'L002', date:'2026-07-23', heure:'11:00', prestataireId:'P2', statut:'en_cours', reservationId:'R06', note:'Rotation same-day : départ 11h → arrivée 15h' },
  { id:'T02', type:'menage',      logementId:'L003', date:'2026-07-23', heure:'11:30', prestataireId:'P3', statut:'a_faire', reservationId:'R10' },
  { id:'T03', type:'checkin',     logementId:'L010', date:'2026-07-23', heure:'18:30', prestataireId:'P1', statut:'a_faire', reservationId:'R32', note:'Accueil en personne demandé' },
  { id:'T04', type:'menage',      logementId:'L006', date:'2026-07-24', heure:'11:00', prestataireId:'P5', statut:'a_faire', reservationId:'R20' },
  { id:'T05', type:'linge',       logementId:'L007', date:'2026-07-24', heure:'09:00', prestataireId:'P5', statut:'a_faire', reservationId:null,  note:'Livraison linge propre' },
  { id:'T06', type:'menage',      logementId:'L009', date:'2026-07-24', heure:'12:00', prestataireId:'P3', statut:'a_faire', reservationId:'R29' },
  { id:'T07', type:'maintenance', logementId:'L005', date:'2026-07-24', heure:'15:00', prestataireId:'P4', statut:'a_faire',  reservationId:null,  note:'Vérifier pompe piscine' },
  { id:'T08', type:'menage',      logementId:'L004', date:'2026-07-25', heure:'11:00', prestataireId:'P5', statut:'a_faire', reservationId:'R14' },
  { id:'T09', type:'checkin',     logementId:'L004', date:'2026-07-25', heure:'16:00', prestataireId:'P5', statut:'a_faire', reservationId:'R14', note:'Installer lit bébé' },
  { id:'T10', type:'menage',      logementId:'L007', date:'2026-07-27', heure:'11:00', prestataireId:'P5', statut:'a_faire', reservationId:'R23' },
  { id:'T11', type:'menage',      logementId:'L010', date:'2026-07-27', heure:'11:30', prestataireId:'P1', statut:'a_faire', reservationId:'R32' },
  { id:'T12', type:'menage',      logementId:'L003', date:'2026-07-27', heure:'12:00', prestataireId:'P3', statut:'a_faire', reservationId:'R11', note:'Arrivée anticipée 13h possible' },
  { id:'T13', type:'menage',      logementId:'L002', date:'2026-07-26', heure:'11:00', prestataireId:'P2', statut:'a_faire', reservationId:'R07' },
  { id:'T14', type:'menage',      logementId:'L005', date:'2026-07-26', heure:'11:00', prestataireId:'P4', statut:'a_faire', reservationId:'R17' },
  { id:'T15', type:'menage',      logementId:'L008', date:'2026-07-26', heure:'12:00', prestataireId:'P3', statut:'a_faire', reservationId:'R26' },
  { id:'T16', type:'maintenance', logementId:'L001', date:'2026-07-28', heure:'10:00', prestataireId:'P4', statut:'a_faire',  reservationId:null,  note:'Changer joint robinet cuisine' },
  { id:'T17', type:'menage',      logementId:'L001', date:'2026-07-28', heure:'11:30', prestataireId:'P1', statut:'a_faire', reservationId:'R03' },
  { id:'T18', type:'menage',      logementId:'L009', date:'2026-07-29', heure:'11:00', prestataireId:'P3', statut:'a_faire', reservationId:'R29' },
  { id:'T19', type:'menage',      logementId:'L004', date:'2026-07-30', heure:'11:00', prestataireId:'P5', statut:'a_faire', reservationId:'R14' },
  { id:'T20', type:'menage',      logementId:'L008', date:'2026-08-01', heure:'11:00', prestataireId:'P3', statut:'a_faire', reservationId:'R26' },
  { id:'T21', type:'menage',      logementId:'L005', date:'2026-08-01', heure:'11:00', prestataireId:'P4', statut:'a_faire', reservationId:'R18' },
  { id:'T22', type:'menage',      logementId:'L001', date:'2026-07-22', heure:'11:00', prestataireId:'P1', statut:'termine', reservationId:'R02' },

  /* --- Historique : interventions déjà réalisées (juin → 21 juillet) ---
     Sans ce passé, la page Équipe afficherait « 0 tâche effectuée » pour
     presque tout le monde : le planning ne couvre que la dizaine de jours à
     venir. Chaque prestataire reste sur sa zone, comme dans le planning. */
  // P1 — Sylvie Ménard · Lyon (L001, L010)
  { id:'H01', type:'menage',      logementId:'L001', date:'2026-06-08', heure:'11:00', prestataireId:'P1', statut:'termine', reservationId:null },
  { id:'H02', type:'menage',      logementId:'L010', date:'2026-06-14', heure:'11:30', prestataireId:'P1', statut:'termine', reservationId:null },
  { id:'H03', type:'menage',      logementId:'L001', date:'2026-06-21', heure:'11:00', prestataireId:'P1', statut:'termine', reservationId:null },
  { id:'H04', type:'linge',       logementId:'L010', date:'2026-06-25', heure:'09:00', prestataireId:'P1', statut:'termine', reservationId:null },
  { id:'H05', type:'menage',      logementId:'L010', date:'2026-06-28', heure:'11:30', prestataireId:'P1', statut:'termine', reservationId:null },
  { id:'H06', type:'menage',      logementId:'L001', date:'2026-07-03', heure:'11:00', prestataireId:'P1', statut:'termine', reservationId:null },
  { id:'H07', type:'checkin',     logementId:'L001', date:'2026-07-03', heure:'16:00', prestataireId:'P1', statut:'termine', reservationId:'R01' },
  { id:'H08', type:'menage',      logementId:'L001', date:'2026-07-07', heure:'11:00', prestataireId:'P1', statut:'termine', reservationId:'R01' },
  { id:'H09', type:'menage',      logementId:'L010', date:'2026-07-12', heure:'11:30', prestataireId:'P1', statut:'termine', reservationId:null },
  { id:'H10', type:'menage',      logementId:'L001', date:'2026-07-16', heure:'11:00', prestataireId:'P1', statut:'termine', reservationId:'R02' },
  { id:'H11', type:'linge',       logementId:'L001', date:'2026-07-20', heure:'09:00', prestataireId:'P1', statut:'termine', reservationId:null },

  // P2 — Karim Bouaziz · Paris (L002), polyvalent
  { id:'H12', type:'menage',      logementId:'L002', date:'2026-06-11', heure:'11:00', prestataireId:'P2', statut:'termine', reservationId:null },
  { id:'H13', type:'menage',      logementId:'L002', date:'2026-06-19', heure:'11:00', prestataireId:'P2', statut:'termine', reservationId:null },
  { id:'H14', type:'maintenance', logementId:'L002', date:'2026-06-24', heure:'14:00', prestataireId:'P2', statut:'termine', reservationId:null, note:'Remplacement chauffe-eau' },
  { id:'H15', type:'menage',      logementId:'L002', date:'2026-06-30', heure:'11:00', prestataireId:'P2', statut:'termine', reservationId:null },
  { id:'H16', type:'menage',      logementId:'L002', date:'2026-07-06', heure:'11:00', prestataireId:'P2', statut:'termine', reservationId:'R05' },
  { id:'H17', type:'menage',      logementId:'L002', date:'2026-07-09', heure:'11:00', prestataireId:'P2', statut:'termine', reservationId:'R05' },
  { id:'H18', type:'checkin',     logementId:'L002', date:'2026-07-20', heure:'17:00', prestataireId:'P2', statut:'termine', reservationId:'R06' },

  // P3 — Nadia Lopez · Sud-Ouest (L003, L005, L008, L009)
  { id:'H19', type:'menage',      logementId:'L003', date:'2026-06-06', heure:'12:00', prestataireId:'P3', statut:'termine', reservationId:null },
  { id:'H20', type:'menage',      logementId:'L009', date:'2026-06-13', heure:'11:00', prestataireId:'P3', statut:'termine', reservationId:null },
  { id:'H21', type:'menage',      logementId:'L008', date:'2026-06-17', heure:'12:00', prestataireId:'P3', statut:'termine', reservationId:null },
  { id:'H22', type:'menage',      logementId:'L003', date:'2026-06-22', heure:'12:00', prestataireId:'P3', statut:'termine', reservationId:null },
  { id:'H23', type:'linge',       logementId:'L008', date:'2026-06-26', heure:'09:00', prestataireId:'P3', statut:'termine', reservationId:null },
  { id:'H24', type:'menage',      logementId:'L009', date:'2026-06-29', heure:'11:00', prestataireId:'P3', statut:'termine', reservationId:null },
  { id:'H25', type:'menage',      logementId:'L003', date:'2026-07-01', heure:'12:00', prestataireId:'P3', statut:'termine', reservationId:'R09' },
  { id:'H26', type:'menage',      logementId:'L003', date:'2026-07-05', heure:'12:00', prestataireId:'P3', statut:'termine', reservationId:'R09' },
  { id:'H27', type:'menage',      logementId:'L008', date:'2026-07-08', heure:'12:00', prestataireId:'P3', statut:'termine', reservationId:null },
  { id:'H28', type:'menage',      logementId:'L009', date:'2026-07-13', heure:'11:00', prestataireId:'P3', statut:'termine', reservationId:null },
  { id:'H29', type:'menage',      logementId:'L003', date:'2026-07-18', heure:'12:00', prestataireId:'P3', statut:'termine', reservationId:'R10' },
  { id:'H30', type:'checkin',     logementId:'L009', date:'2026-07-19', heure:'16:30', prestataireId:'P3', statut:'termine', reservationId:null },
  { id:'H31', type:'menage',      logementId:'L008', date:'2026-07-21', heure:'12:00', prestataireId:'P3', statut:'termine', reservationId:null },

  // P4 — Marc Antoine · maintenance, toutes villes
  { id:'H32', type:'maintenance', logementId:'L004', date:'2026-06-10', heure:'10:00', prestataireId:'P4', statut:'termine', reservationId:null, note:'Ramonage cheminée' },
  { id:'H33', type:'maintenance', logementId:'L006', date:'2026-06-16', heure:'14:00', prestataireId:'P4', statut:'termine',  reservationId:null, note:'Fuite sous évier' },
  { id:'H34', type:'maintenance', logementId:'L001', date:'2026-06-23', heure:'09:30', prestataireId:'P4', statut:'termine',  reservationId:null, note:'Volet roulant bloqué' },
  { id:'H35', type:'maintenance', logementId:'L007', date:'2026-07-02', heure:'11:00', prestataireId:'P4', statut:'termine',  reservationId:null, note:'Entretien climatisation' },
  { id:'H36', type:'maintenance', logementId:'L009', date:'2026-07-07', heure:'15:00', prestataireId:'P4', statut:'termine', reservationId:null, note:'Remplacement serrure' },
  { id:'H37', type:'menage',      logementId:'L005', date:'2026-07-11', heure:'11:00', prestataireId:'P4', statut:'termine',  reservationId:null },
  { id:'H38', type:'maintenance', logementId:'L003', date:'2026-07-15', heure:'10:00', prestataireId:'P4', statut:'termine',  reservationId:null, note:'Révision lave-vaisselle' },
  { id:'H39', type:'menage',      logementId:'L005', date:'2026-07-18', heure:'11:00', prestataireId:'P4', statut:'termine',  reservationId:'R17' },

  // P5 — Léna Fritsch · Sud-Est (L004, L006, L007)
  { id:'H40', type:'menage',      logementId:'L006', date:'2026-06-07', heure:'11:00', prestataireId:'P5', statut:'termine', reservationId:null },
  { id:'H41', type:'menage',      logementId:'L007', date:'2026-06-12', heure:'11:00', prestataireId:'P5', statut:'termine', reservationId:null },
  { id:'H42', type:'menage',      logementId:'L004', date:'2026-06-18', heure:'11:00', prestataireId:'P5', statut:'termine', reservationId:null },
  { id:'H43', type:'linge',       logementId:'L007', date:'2026-06-20', heure:'09:00', prestataireId:'P5', statut:'termine', reservationId:null },
  { id:'H44', type:'menage',      logementId:'L006', date:'2026-06-27', heure:'11:00', prestataireId:'P5', statut:'termine', reservationId:null },
  { id:'H45', type:'menage',      logementId:'L007', date:'2026-07-04', heure:'11:00', prestataireId:'P5', statut:'termine', reservationId:null },
  { id:'H46', type:'menage',      logementId:'L004', date:'2026-07-11', heure:'11:00', prestataireId:'P5', statut:'termine', reservationId:'R13' },
  { id:'H47', type:'checkin',     logementId:'L004', date:'2026-07-11', heure:'16:00', prestataireId:'P5', statut:'termine', reservationId:'R13' },
  { id:'H48', type:'menage',      logementId:'L004', date:'2026-07-18', heure:'11:00', prestataireId:'P5', statut:'termine', reservationId:'R13' },
  { id:'H49', type:'menage',      logementId:'L006', date:'2026-07-19', heure:'11:00', prestataireId:'P5', statut:'termine', reservationId:null },
  { id:'H50', type:'menage',      logementId:'L007', date:'2026-07-21', heure:'11:00', prestataireId:'P5', statut:'termine', reservationId:null },
];

/* ============================================================
   BARÈME DES INTERVENTIONS

   Ce que la conciergerie PAIE à un prestataire pour une tâche. À ne pas
   confondre avec `menageTarif`, qui est le forfait ménage facturé au
   VOYAGEUR : deux nombres différents, dans deux sens opposés.

   Trois niveaux, du plus général au plus précis, et le plus précis
   gagne :

     1. `defaut`   — par type de tâche. Suffit à démarrer.
     2. `parType`  — affiné par type de logement. Un ménage de villa
                     n'est pas un ménage de studio.
     3. le logement — `l.bareme`, l'exception.

   Pourquoi les trois et non un seul : par type de logement uniquement,
   le tarif serait faux dès que deux T2 diffèrent (quatrième sans
   ascenseur contre rez-de-chaussée) ; par logement uniquement, une
   conciergerie de quarante biens devrait remplir cent soixante cases
   avant d'émettre sa première facture — et n'émettrait jamais la
   première. Le défaut rend l'outil utilisable tout de suite, l'exception
   le rend juste là où ça compte.

   `origine` est renvoyé avec le montant, et ce n'est pas cosmétique :
   une facture dont on ne sait pas d'où sort le chiffre ne se conteste
   pas, elle se subit.
   ============================================================ */
const BAREME_INTERVENTIONS = {
  defaut: { menage: 45, checkin: 25, linge: 18, maintenance: 60 },
  parType: {
    studio:      { menage: 32, checkin: 20, linge: 14 },
    appartement: {},
    duplex:      { menage: 58, linge: 22 },
    loft:        { menage: 52, linge: 22 },
    maison:      { menage: 70, linge: 26 },
    villa:       { menage: 95, checkin: 35, linge: 34, maintenance: 80 },
    chalet:      { menage: 85, checkin: 30, linge: 30, maintenance: 75 },
  },
  // Filet pour les catégories créées à la main depuis le formulaire de
  // tâche : mieux vaut un tarif discutable qu'une ligne à zéro euro qui
  // disparaît silencieusement du total.
  inconnu: 40,
};

function coutIntervention(type, logementId) {
  const l = getLogement(logementId);
  const perso = l && l.bareme && l.bareme[type];
  if (perso != null) return { montant: perso, origine: 'logement' };

  const parType = l && BAREME_INTERVENTIONS.parType[l.type];
  if (parType && parType[type] != null) return { montant: parType[type], origine: 'type' };

  const d = BAREME_INTERVENTIONS.defaut[type];
  if (d != null) return { montant: d, origine: 'defaut' };
  return { montant: BAREME_INTERVENTIONS.inconnu, origine: 'inconnu' };
}
const ORIGINE_COUT = {
  logement: { label: 'Tarif du logement', court: 'logement' },
  type:     { label: 'Barème par type de bien', court: 'type de bien' },
  defaut:   { label: 'Barème par défaut', court: 'défaut' },
  inconnu:  { label: 'Catégorie sans tarif', court: 'à définir' },
};

/* ------------------------------------------------------------
   Facturation des prestataires

   On ne facture que les interventions TERMINÉES. Une tâche planifiée
   n'est pas due : la payer d'avance ferait porter à la facture du mois
   des heures qui n'ont pas été faites, et obligerait à des avoirs le
   mois suivant.
   ------------------------------------------------------------ */
const FACTURES_PRESTATAIRE = [];
PRESTATAIRES.forEach(p => {
  MOIS_COMPTABLES.forEach((mois, i) => {
    FACTURES_PRESTATAIRE.push({
      id: `FP-${p.id}-${i}`, prestataireId: p.id, mois,
      statut: i < MOIS_COMPTABLES.length - 1 ? 'generee' : 'attente',
    });
  });
});
function getFacturesByPrestataire(id) { return FACTURES_PRESTATAIRE.filter(f => f.prestataireId === id); }

// « Juillet 2026 » → { debut:'2026-07-01', fin:'2026-07-31' }
const _MOIS_INDEX = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
function bornesMoisComptable(mois) {
  const [nom, an] = String(mois).split(' ');
  const m = _MOIS_INDEX.indexOf(nom.toLowerCase());
  if (m < 0) return null;
  const annee = Number(an);
  const dernier = new Date(annee, m + 1, 0).getDate();
  const p2 = n => String(n).padStart(2, '0');
  return { debut: `${annee}-${p2(m + 1)}-01`, fin: `${annee}-${p2(m + 1)}-${p2(dernier)}` };
}

function interventionsFacturables(prestataireId, mois) {
  const b = bornesMoisComptable(mois);
  if (!b) return [];
  return TACHES
    .filter(t => t.prestataireId === prestataireId && t.statut === 'termine'
      && t.date >= b.debut && t.date <= b.fin)
    .sort((a, x) => a.date.localeCompare(x.date) || a.heure.localeCompare(x.heure));
}

function calculFacturePrestataire(prestataireId, mois) {
  const lignes = interventionsFacturables(prestataireId, mois).map(t => {
    const c = coutIntervention(t.type, t.logementId);
    return { tache: t, logement: getLogement(t.logementId), ...c };
  });
  const parType = {};
  lignes.forEach(l => {
    const e = parType[l.tache.type] = parType[l.tache.type] || { nb: 0, total: 0 };
    e.nb++; e.total += l.montant;
  });
  return { lignes, parType, total: lignes.reduce((t, l) => t + l.montant, 0), nb: lignes.length };
}

/* ============================================================
   AUTOMATISATIONS (8)
   declencheur : reservation | j_moins_1 | jour_arrivee |
                 jour_depart | j_plus_1 | j_plus_3
   ============================================================ */
const AUTOMATISATIONS = [
  { id:'A1', nom:'Confirmation de réservation', declencheur:'reservation', jours:0, heure:'10:00', actif:true, langue:'FR', canaux:'Tous', logements:'tous', envoyes:342,
    modele:'Bonjour {prenom}, votre réservation au {nom_logement} est confirmée pour le {date_arrivee}. Nous avons hâte de vous accueillir ! Toutes les infos pratiques vous seront envoyées la veille de votre arrivée.' },
  { id:'A2', nom:'Instructions d\'arrivée', declencheur:'avant_arrivee', jours:1, heure:'10:00', actif:true, langue:'FR', canaux:'Tous', logements:'tous', envoyes:318,
    modele:'Bonjour {prenom}, votre séjour au {nom_logement} commence demain ! Retrouvez tout le nécessaire sur votre page séjour : adresse exacte, code d\'accès, Wi-Fi et bonnes adresses du quartier — {lien_sejour}. Arrivée possible à partir de 15h. Bon voyage !' },
  { id:'A3', nom:'Message de bienvenue', declencheur:'jour_arrivee', jours:0, heure:'18:00', actif:true, langue:'FR', canaux:'Tous', logements:'tous', envoyes:305,
    modele:'Bienvenue {prenom} ! Nous espérons que votre voyage s\'est bien passé. Le guide de bienvenue est dans l\'entrée. N\'hésitez pas à nous écrire pour toute question. Bon séjour !' },
  { id:'A4', nom:'Rappel départ & checklist', declencheur:'jour_depart', jours:0, heure:'08:00', actif:true, langue:'FR', canaux:'Tous', logements:'tous', envoyes:289,
    modele:'Bonjour {prenom}, le départ est prévu avant 11h. Merci de laisser les clés dans la boîte et de fermer les fenêtres. Ce fut un plaisir de vous accueillir !' },
  { id:'A5', nom:'Demande d\'avis', declencheur:'apres_depart', jours:1, heure:'11:00', actif:true, langue:'FR', canaux:'Airbnb, Booking', logements:'tous', envoyes:276,
    modele:'Bonjour {prenom}, merci d\'avoir séjourné au {nom_logement} ! Si tout vous a plu, un avis nous aiderait beaucoup. Au plaisir de vous revoir bientôt.' },
  { id:'A6', nom:'Vérification mi-séjour', declencheur:'jour_arrivee', jours:0, heure:'20:00', actif:false, langue:'FR', canaux:'Direct', logements:'sélection', envoyes:47,
    modele:'Bonjour {prenom}, tout se passe bien depuis votre arrivée ? N\'hésitez pas si vous avez besoin de quoi que ce soit.' },
  { id:'A7', nom:'Welcome message (EN)', declencheur:'jour_arrivee', jours:0, heure:'18:00', actif:true, langue:'EN', canaux:'Tous', logements:'tous', envoyes:96,
    modele:'Welcome {prenom}! We hope you had a pleasant trip. Everything you need is on your stay page: {lien_sejour}. Enjoy your stay and reach out anytime!' },
  { id:'A8', nom:'Offre réservation directe', declencheur:'apres_depart', jours:3, heure:'11:00', actif:true, langue:'FR', canaux:'Airbnb, Booking', logements:'tous', envoyes:41,
    modele:'Bonjour {prenom}, merci pour votre séjour ! La prochaine fois, réservez en direct sur notre site et bénéficiez de -10% sans commission. À bientôt !' },
];

/* ============================================================
   TÂCHES RÉCURRENTES par logement — créées automatiquement à
   chaque réservation (ou selon un rythme) et assignées à un
   collaborateur. type : menage|accueil|maintenance|inspection|linge|cles
   declencheur : checkin|checkout|j_avant_checkin|h_avant_checkin|
                 j_apres_checkout|quotidien|hebdo|mensuel
   ============================================================ */
const RECURRENTES = [
  { id:'RC01', logementId:'L001', nom:'Ménage complet', type:'menage', description:'Nettoyage intégral du logement après chaque départ.', declencheur:'checkout', delai:null, prestataireId:'P1', dateDebut:'2026-01-01', dateFin:null, actif:true },
  { id:'RC02', logementId:'L001', nom:'Accueil & remise des clés', type:'accueil', description:'Accueil en personne du voyageur et état des lieux d\'entrée.', declencheur:'checkin', delai:null, prestataireId:'P2', dateDebut:'2026-01-01', dateFin:null, actif:true },
  { id:'RC03', logementId:'L001', nom:'Inspection mensuelle', type:'inspection', description:'Vérification de l\'état général et des équipements.', declencheur:'mensuel', delai:null, prestataireId:'P4', dateDebut:'2026-01-01', dateFin:'2026-12-31', actif:false },
  { id:'RC04', logementId:'L002', nom:'Ménage complet', type:'menage', description:'Nettoyage après chaque départ.', declencheur:'checkout', delai:null, prestataireId:'P2', dateDebut:'2026-02-01', dateFin:null, actif:true },
  { id:'RC05', logementId:'L002', nom:'Préparation du linge', type:'linge', description:'Livraison du linge propre la veille de l\'arrivée.', declencheur:'j_avant_checkin', delai:1, prestataireId:'P2', dateDebut:'2026-02-01', dateFin:null, actif:true },
  { id:'RC06', logementId:'L004', nom:'Ménage du chalet', type:'menage', description:'Nettoyage complet après chaque séjour.', declencheur:'checkout', delai:null, prestataireId:'P5', dateDebut:'2026-01-15', dateFin:null, actif:true },
  { id:'RC07', logementId:'L004', nom:'Contrôle spa & cheminée', type:'maintenance', description:'Vérification hebdomadaire du spa et de la cheminée.', declencheur:'hebdo', delai:null, prestataireId:'P4', dateDebut:'2026-01-15', dateFin:null, actif:true },
  { id:'RC08', logementId:'L004', nom:'Accueil premium', type:'accueil', description:'Accueil personnalisé avec panier de bienvenue.', declencheur:'checkin', delai:null, prestataireId:'P5', dateDebut:'2026-01-15', dateFin:null, actif:true },
  { id:'RC09', logementId:'L005', nom:'Ménage de la villa', type:'menage', description:'Nettoyage complet de la villa après départ.', declencheur:'checkout', delai:null, prestataireId:'P4', dateDebut:'2026-03-01', dateFin:null, actif:true },
  { id:'RC10', logementId:'L005', nom:'Ouverture & contrôle piscine', type:'maintenance', description:'Vérification de la piscine 2 jours avant l\'arrivée.', declencheur:'j_avant_checkin', delai:2, prestataireId:'P4', dateDebut:'2026-03-01', dateFin:null, actif:true },
  { id:'RC11', logementId:'L010', nom:'Ménage complet', type:'menage', description:'Nettoyage après chaque départ.', declencheur:'checkout', delai:null, prestataireId:'P1', dateDebut:'2026-01-01', dateFin:null, actif:true },
];

/* ============================================================
   TARIFS — 5 offres. Source unique de vérité, partagée par la
   landing (index.html#tarifs) et l'abonnement de l'app
   (app/abonnement.html), pour qu'elles ne divergent jamais.

   Trois façons de facturer :
     - unite:'gratuit'       → sans contrepartie ni limite affichée
                               (Gratuit)
     - unite:'logement_mois' → prix par logement géré. Grille dégressive
                               pour Smart et Business ; prix unique pour
                               Découverte, qui plafonne en plus le nombre
                               de logements facturés (logementsInclus) et
                               la durée de l'offre (dureeMois).
     - unite:'devis'         → hors catalogue (Entreprise)

   Ce qui sépare Smart de Business est UNIQUEMENT l'intelligence
   artificielle : Smart contient tout l'opérationnel (calendrier,
   messagerie, automatisations de règles, ménage, statistiques),
   Business y ajoute Vivi. Les automatisations de Smart sont des
   règles, pas de l'IA — la distinction est volontaire et se
   retrouve dans toute l'interface.

   Les fonctionnalités sont cumulatives (champ « herite ») et
   regroupées par thème (champ « groupes ») pour rester lisibles
   sur une carte.
   ============================================================ */

/* Déclaré ici et non plus bas : PLANS s'en sert pour borner Smart et
   Business, et une constante `const` lue avant sa déclaration lèverait
   une ReferenceError. Au-delà de ce parc, le tarif catalogue n'a plus
   de sens : on bascule sur un devis plutôt que d'afficher un montant à
   cinq chiffres. */
const PARC_MAX_CATALOGUE = 100;

/* Grille dégressive, en MAD par logement et par mois.

   Tarification « de volume » et non par tranches cumulées : le palier
   atteint s'applique à TOUT le parc. Un parc de 20 logements est donc
   facturé 20 × 130, pas 10 × 140 + 10 × 130. C'est la lecture naturelle
   d'une grille « 11-30 : 130 MAD/logement », et c'est aussi la seule qui
   permet au visiteur de refaire le calcul de tête. Effet de bord assumé :
   passer de 10 à 11 logements fait BAISSER la facture unitaire, jamais
   monter — on ne pénalise jamais la croissance du parc.

   `max` est la borne haute INCLUSE du palier. Au-delà du dernier palier,
   on sort du catalogue et l'offre Entreprise prend le relais. */
const PALIERS_SMART = [
  { min:1,  max:10,  prix:140 },
  { min:11, max:30,  prix:130 },
  { min:31, max:50,  prix:120 },
  { min:51, max:100, prix:110 },
];
const PALIERS_BUSINESS = [
  { min:1,  max:10,  prix:190 },
  { min:11, max:30,  prix:180 },
  { min:31, max:50,  prix:170 },
  { min:51, max:100, prix:160 },
];

const PLANS = [
  {
    id:'gratuit', nom:'Gratuit', unite:'gratuit',
    minLog:1, maxLog:Infinity,
    accroche:"Créez votre compte et découvrez la plateforme.",
    idealPour:"Voir concrètement ce que fait Oyvia, avant de vous engager.",
    herite:null,
    groupes:[
      { titre:null, items:[
        { titre:'Création de compte immédiate', desc:"Aucune carte bancaire demandée." },
        { titre:'Découverte de la plateforme',  desc:"Parcourez les écrans et la mécanique du produit." },
        { titre:'Aucun engagement',             desc:"Vous passez à une offre payante quand vous le décidez." },
      ] },
    ],
    ia:null,
  },
  {
    /* Offre d'entrée, pensée pour lever le frein du premier mois : un prix
       symbolique par logement, plafonné aux `logementsInclus` premiers, et
       borné dans le temps. Au-delà du plafond ou de la durée, on bascule
       sur Smart — c'est dit sur la carte plutôt que découvert à la facture. */
    id:'decouverte', nom:'Découverte', unite:'logement_mois',
    paliers:[{ min:1, max:PARC_MAX_CATALOGUE, prix:11 }],   // ≈ 1 € / logement / mois
    logementsInclus:2, dureeMois:6,
    // maxLog aligné sur logementsInclus : au-delà de 2 logements l'offre ne
    // couvre plus le parc, elle est donc proposée comme indisponible plutôt
    // que d'afficher un prix qui ne financerait qu'une partie des biens.
    minLog:1, maxLog:2,
    accroche:"Lancez-vous pour le prix d'un café, sur vos deux premiers logements.",
    idealPour:"Démarrer avec un ou deux biens, sans risque.",
    herite:null,
    groupes:[
      { titre:'Inclus', items:[
        { titre:'Tout le socle Smart',        desc:"Calendrier unifié, messagerie, messages automatiques, ménage, comptabilité." },
        { titre:'Vos 2 premiers logements',   desc:"Au-delà de 2 logements, le passage à Smart est nécessaire." },
        { titre:'Pendant 6 mois',             desc:"À l'issue des 6 mois, l'offre bascule automatiquement sur Smart, au tarif du catalogue." },
        { titre:'Sans engagement',            desc:"Résiliable à tout moment pendant les 6 mois." },
      ] },
    ],
    ia:null,
  },
  {
    id:'smart', nom:'Smart', unite:'logement_mois', paliers:PALIERS_SMART,
    minLog:1, maxLog:PARC_MAX_CATALOGUE,
    accroche:"Tout le nécessaire pour automatiser la gestion quotidienne de vos locations.",
    idealPour:"Les hôtes indépendants (2 à 5 logements).",
    herite:null,
    groupes:[
      { titre:'Inclus', items:[
        { titre:'Calendrier unifié multi-canaux',    desc:"Airbnb, Booking, Expedia… plus de 60 autres" },
        { titre:'Messagerie centralisée',            desc:"Airbnb, Booking, Expedia… plus de 60 autres" },
        { titre:'Messages automatiques',             desc:"Confirmation, avant arrivée, check-out, demande d'avis — envoyés sur Airbnb, Booking, e-mail et WhatsApp" },
        { titre:'Réservations directes sans commission' },
        { titre:'Gestion du ménage et des équipes',  desc:"Tâches automatiques, assignation, check-list mobile" },
        { titre:'Tableau de bord & statistiques' },
        { titre:'Comptabilité' },
        { titre:'Intégration WhatsApp' },
        { titre:'Création de site web',              desc:"Pour vos réservations directes" },
        { titre:'Support standard' },
      ] },
      { titre:'En option', items:[
        { titre:'Serrures connectées',               desc:"Nuki, TTLock, Yale et plus de 20 autres marques — codes d'accès créés et révoqués à distance" },
      ] },
    ],
    ia:null,
  },
  {
    id:'business', nom:'Business', unite:'logement_mois', paliers:PALIERS_BUSINESS,
    minLog:1, maxLog:PARC_MAX_CATALOGUE, populaire:true,
    accroche:"Tout Smart, plus Vivi : l'IA qui répond aux voyageurs et déclenche vos interventions.",
    idealPour:"Les hôtes confirmés, à partir de 6 logements.",
    herite:'smart',
    groupes:[
      { titre:'Vivi — IA Avancée', items:[
        { titre:'Répond automatiquement aux messages', desc:"Dans toutes les langues, sur Airbnb, Booking, e-mail et WhatsApp" },
        { titre:'Détecte les incidents et crée les tâches', desc:"Ménage, maintenance, intervention…" },
        { titre:'Contexte personnalisé par logement', desc:"Wi-Fi, parking, check-in, équipements, règles" },
        { titre:'Ton et personnalité personnalisables' },
        { titre:'Garde-fous intelligents',            desc:"Escalade automatique pour les remboursements, réclamations et demandes sensibles" },
        { titre:'Seuil de confiance configurable',    desc:"Réponse automatique uniquement au-dessus de 75 %, par exemple" },
      ] },
    ],
    ia:'avancee',
  },
  {
    id:'entreprise', nom:'Entreprise', unite:'devis',
    minLog:PARC_MAX_CATALOGUE + 1, maxLog:Infinity,
    accroche:"Au-delà de 100 logements, la grille catalogue ne s'applique plus : le tarif se construit avec vous.",
    idealPour:"Les conciergeries.",
    herite:'business',
    groupes:[
      { titre:null, items:[
        { titre:'Tarif sur mesure', desc:"Établi selon la taille de votre parc et vos besoins." },
      ] },
    ],
    ia:'avancee',
  },
];

function getPlan(id) { return PLANS.find(p => p.id === id) || PLANS[0]; }

/* Palier applicable à un parc donné, pour une offre à grille dégressive.
   Renvoie null pour les offres sans grille (essai, devis) : l'appelant
   doit alors afficher autre chose qu'un prix, pas un « 0 MAD » trompeur. */
function palierPour(planId, nbLogements) {
  const p = getPlan(planId);
  if (!p.paliers || !p.paliers.length) return null;
  const n = Math.max(1, Math.round(nbLogements) || 1);
  return p.paliers.find(x => n <= x.max) || null;
}
// Prix mensuel par logement au catalogue, pour ce parc-là. 0 si hors grille.
function prixParLogement(planId, nbLogements) {
  const pal = palierPour(planId, nbLogements);
  return pal ? pal.prix : 0;
}

// Total mensuel d'une offre pour un parc donné.
/* ============================================================
   DEVISES & PÉRIODICITÉ DE FACTURATION

   Les tarifs de PLANS sont exprimés en MAD : c'est la devise de
   référence du produit. Les autres montants en sont convertis.

   Un vrai SaaS fixerait un prix propre à chaque marché (on ne vend pas
   14,90 € parce que 160 MAD font 14,73 €) ; ici la conversion suffit à
   la démonstration, et les taux sont regroupés en un seul endroit pour
   pouvoir être remplacés par une grille par pays le jour venu.
   ============================================================ */
const DEVISES = [
  { id:'EUR',  label:'EUR',   symbole:'€',    taux:0.092, avant:false, arrondi:1 },
  { id:'MAD',  label:'MAD',   symbole:'MAD',  taux:1,     avant:false, arrondi:5 },
  { id:'USD',  label:'USD',   symbole:'$',    taux:0.10,  avant:true,  arrondi:1 },
  { id:'GBP',  label:'GBP',   symbole:'£',    taux:0.079, avant:true,  arrondi:1 },
  { id:'XOF',  label:'FCFA',  symbole:'FCFA', taux:60,    avant:false, arrondi:500 },
];
function getDevise(id) { return DEVISES.find(d => d.id === id) || DEVISES[1]; }

// Remise appliquée à l'engagement annuel, affichée telle quelle sur le
// sélecteur : c'est l'argument de la bascule.
const REMISE_ANNUELLE = 20;

// Conversion + arrondi « commercial » : un prix affiché 11,04 € ferait
// bricolé. On arrondit au pas propre à chaque devise.
function convertirMAD(montantMAD, deviseId) {
  const d = getDevise(deviseId);
  const brut = montantMAD * d.taux;
  return Math.round(brut / d.arrondi) * d.arrondi;
}
function formatDevise(montantMAD, deviseId, opts = {}) {
  const d = getDevise(deviseId);
  const v = opts.deja ? montantMAD : convertirMAD(montantMAD, deviseId);
  const n = v.toLocaleString('fr-FR');
  return d.avant ? `${d.symbole}${n}` : `${n} ${d.symbole}`;
}

// Prix mensuel par logement, éventuellement remisé si l'on paie à l'année.
// On raisonne toujours en « par mois » : c'est ce que le visiteur compare.
// Le parc entre dans le calcul, puisqu'il détermine le palier applicable.
function prixMensuelParLogement(planId, periodicite, nbLogements) {
  const p = getPlan(planId);
  if (p.unite !== 'logement_mois') return 0;
  const base = prixParLogement(planId, nbLogements);
  return periodicite === 'annuel' ? base * (1 - REMISE_ANNUELLE / 100) : base;
}
function totalMensuel(planId, nbLogements, periodicite) {
  return prixMensuelParLogement(planId, periodicite, nbLogements) * logementsFactures(planId, nbLogements);
}
// Ce qui est réellement débité : douze mois d'un coup en annuel.
function totalFacture(planId, nbLogements, periodicite) {
  const m = totalMensuel(planId, nbLogements, periodicite);
  return periodicite === 'annuel' ? m * 12 : m;
}

/* Tarif tel qu'il sera AFFICHÉ, dans la devise choisie.

   Point délicat : convertir séparément le prix unitaire et le total donne
   des chiffres qui ne tombent pas juste à l'écran (17 € × 8 ≠ 132 €), parce
   que chaque conversion est arrondie de son côté. On ancre donc tout sur le
   prix unitaire arrondi, et le total en découle par simple multiplication.
   La remise annuelle s'applique elle aussi à ce prix affiché : le client
   doit pouvoir refaire le calcul de tête. */
function tarifAffiche(planId, nbLogements, deviseId, periodicite) {
  const p = getPlan(planId);
  const d = getDevise(deviseId);
  const n = Math.max(1, Math.round(nbLogements) || 1);
  if (p.unite !== 'logement_mois') return { unite: 0, total: 0, plein: 0, annuel: 0, palier: null };

  const pal = palierPour(planId, n);
  if (!pal) return { unite: 0, total: 0, plein: 0, annuel: 0, palier: null };

  const plein = convertirMAD(pal.prix, deviseId);
  const unite = periodicite === 'annuel'
    ? Math.round(plein * (1 - REMISE_ANNUELLE / 100) / d.arrondi) * d.arrondi
    : plein;
  // Découverte ne facture que ses deux premiers logements : le total doit
  // suivre ce plafond, sinon l'écran promet un prix qui n'est pas celui-là.
  const factures = logementsFactures(planId, n);
  const total = unite * factures;
  return { unite, total, factures, plein: plein * factures, annuel: total * 12, palier: pal };
}

function planTotal(planId, nbLogements) {
  const n = Math.max(1, nbLogements);
  return prixParLogement(planId, n) * logementsFactures(planId, n);
}

// Le prix affiché « à l'unité », tel qu'on le lit sur une carte d'offre.
// Il dépend du parc : sans lui, on ne saurait pas quel palier citer.
function planPrixTexte(planId, nbLogements) {
  const p = getPlan(planId);
  if (p.unite === 'gratuit') return { montant:formatPrixAbo(0), suffixe:'sans engagement' };
  if (p.unite === 'devis')   return { montant:'Sur devis', suffixe:`au-delà de ${PARC_MAX_CATALOGUE} logements` };
  const suffixe = p.dureeMois
    ? `par logement et par mois, pendant ${p.dureeMois} mois`
    : 'par logement et par mois';
  return { montant:formatPrixAbo(prixParLogement(planId, nbLogements)), suffixe };
}

/* Nombre de logements réellement FACTURÉS par une offre. Découverte plafonne
   aux `logementsInclus` premiers : sans ce plafond, un parc de 8 logements
   verrait un total de 8 × 1 €, alors que l'offre n'en couvre que 2. */
function logementsFactures(planId, nbLogements) {
  const p = getPlan(planId);
  const n = Math.max(1, Math.round(nbLogements) || 1);
  return p.logementsInclus ? Math.min(n, p.logementsInclus) : n;
}

/* Une offre est-elle proposable pour ce nombre de logements ?

   Smart et Business s'arrêtent au catalogue (100 logements) : au-delà,
   la grille n'a plus de prix à appliquer et c'est Entreprise qui prend
   le relais. Symétriquement, Entreprise ne s'active qu'au-dessus.
   Gratuit et Découverte restent toujours proposables : elles ne se
   refusent pas à un gros parc. Découverte couvre simplement les deux
   premiers logements, ce que la carte dit explicitement. */
function planEligible(planId, nbLogements) {
  const p = getPlan(planId);
  const n = Math.max(1, Math.round(nbLogements) || 1);
  return n >= p.minLog && n <= p.maxLog;
}

// L'offre conseillée, calée sur le « Idéal pour » de chaque offre :
// Smart jusqu'à 5 logements, Business de 6 à 100, Entreprise au-delà.
function planRecommande(nbLogements) {
  if (nbLogements > PARC_MAX_CATALOGUE) return 'entreprise';
  return nbLogements <= 5 ? 'smart' : 'business';
}

// Toutes les fonctionnalités d'une offre, groupe par groupe, en incluant
// une ligne de renvoi vers l'offre héritée plutôt que d'en recopier la liste.
function planGroupes(planId) {
  const p = getPlan(planId);
  const parent = p.herite ? getPlan(p.herite) : null;
  const heritage = parent
    ? [{ titre:null, herite:true, items:[{ titre:`Tout ce qui est inclus dans l'offre ${parent.nom}` }] }]
    : [];
  return [...heritage, ...p.groupes];
}

/* ============================================================
   MATRICE COMPARATIVE DES OFFRES

   Le tableau « fonctionnalités × offres » de la landing. C'est une
   SECONDE source à côté des `groupes` de PLANS, et c'est assumé :
   les `groupes` servent l'argumentaire d'une offre prise seule
   (« voici ce que vous achetez »), la matrice sert la comparaison
   (« voici ce qui change d'une offre à l'autre »). Une même liste ne
   fait pas bien les deux : comparer exige une ligne par fonctionnalité,
   y compris quand l'offre ne la contient pas.

   Quatre états possibles par cellule :
     'inclus' → compris dans l'offre        (coche verte)
     'non'    → non disponible              (gris)
     'option' → disponible en supplément    (bleu)
     texte    → une valeur (« 2 max », « 6 mois »), pour les lignes de
                périmètre où un oui/non ne dirait rien

   L'ordre des valeurs suit MATRICE_COLONNES, calé sur celui de PLANS.
   ============================================================ */
const MATRICE_COLONNES = ['gratuit', 'decouverte', 'smart', 'business', 'entreprise'];

const MATRICE_OFFRES = [
  { groupe: 'Périmètre', lignes: [
    { nom: 'Logements couverts',        v: ['Découverte', '2 max', '1 à 100', '1 à 100', 'Illimité'] },
    { nom: "Durée de l'offre",          v: ['15 jours', '6 mois', 'Sans limite', 'Sans limite', 'Sur mesure'] },
    { nom: 'Création de compte sans carte bancaire', v: ['inclus', 'inclus', 'inclus', 'inclus', 'inclus'] },
    { nom: 'Sans engagement',           v: ['inclus', 'inclus', 'inclus', 'inclus', 'inclus'] },
  ]},

  { groupe: 'Canaux & réservations', lignes: [
    { nom: 'Calendrier unifié multi-canaux', desc: 'Airbnb, Booking, Expedia… plus de 60 autres',
      v: ['non', 'inclus', 'inclus', 'inclus', 'inclus'] },
    // « Bientôt » plutôt qu'une coche : annoncer comme livré ce qui ne
    // l'est pas encore se paie au premier client qui l'active.
    { nom: 'Réservations directes sans commission', v: ['non', 'Bientôt', 'Bientôt', 'Bientôt', 'Bientôt'] },
    { nom: 'Création de site web',      desc: 'Pour vos réservations directes',
      v: ['non', 'Bientôt', 'Bientôt', 'Bientôt', 'Bientôt'] },
  ]},

  { groupe: 'Communication voyageurs', lignes: [
    { nom: 'Messagerie centralisée',    desc: 'Airbnb, Booking, Expedia… plus de 60 autres',
      v: ['non', 'inclus', 'inclus', 'inclus', 'inclus'] },
    { nom: 'Intégration WhatsApp',      v: ['non', 'inclus', 'inclus', 'inclus', 'inclus'] },
    { nom: 'Messages automatiques',     desc: "Confirmation, avant arrivée, check-out, demande d'avis",
      v: ['non', 'inclus', 'inclus', 'inclus', 'inclus'] },
    { nom: 'Portail voyageur',          desc: 'Page séjour : accès, Wi-Fi, bonnes adresses',
      v: ['non', 'inclus', 'inclus', 'inclus', 'inclus'] },
    { nom: 'Collecte et suivi des avis', v: ['non', 'inclus', 'inclus', 'inclus', 'inclus'] },
  ]},

  { groupe: 'Opérations terrain', lignes: [
    { nom: 'Gestion du ménage et des équipes', desc: 'Tâches, assignation, check-list mobile',
      v: ['non', 'inclus', 'inclus', 'inclus', 'inclus'] },
    { nom: 'Tâches récurrentes',        v: ['non', 'inclus', 'inclus', 'inclus', 'inclus'] },
    { nom: 'Espace prestataire',        v: ['non', 'inclus', 'inclus', 'inclus', 'inclus'] },
    { nom: 'Serrures connectées',       desc: 'Nuki, TTLock, Yale et plus de 20 autres marques',
      v: ['non', 'option', 'option', 'option', 'option'] },
  ]},

  { groupe: 'Tarification', lignes: [
    { nom: 'Tarification dynamique Oyvia', desc: 'Occupation, saison, jour, durée, délai',
      v: ['non', 'inclus', 'inclus', 'inclus', 'inclus'] },
    { nom: 'Connexion à une plateforme externe', desc: 'PriceLabs, Beyond, Wheelhouse',
      v: ['non', 'option', 'option', 'option', 'option'] },
  ]},

  { groupe: 'Pilotage & finance', lignes: [
    { nom: 'Tableau de bord & statistiques', v: ['non', 'inclus', 'inclus', 'inclus', 'inclus'] },
    { nom: 'Comptabilité',              v: ['non', 'inclus', 'inclus', 'inclus', 'inclus'] },
    { nom: 'Exports CSV',               v: ['non', 'inclus', 'inclus', 'inclus', 'inclus'] },
  ]},

  { groupe: 'Accompagnement', lignes: [
    { nom: 'Support par e-mail',        v: ['inclus', 'inclus', 'inclus', 'inclus', 'inclus'] },
    { nom: 'Support prioritaire',       v: ['inclus', 'inclus', 'inclus', 'inclus', 'inclus'] },
    { nom: 'Accompagnement à la mise en route', v: ['inclus', 'inclus', 'inclus', 'inclus', 'inclus'] },
  ]},

  // Vivi ferme la marche : c'est le seul bloc qui sépare vraiment Business
  // de Smart, et une colonne de croix se lit mieux en fin de tableau qu'au
  // milieu, où elle donne l'impression que l'offre s'arrête là.
  { groupe: 'Vivi — IA voyageur', lignes: [
    { nom: 'Réponses automatiques aux messages', desc: 'Dans toutes les langues, sur tous les canaux',
      v: ['non', 'non', 'non', 'inclus', 'inclus'] },
    { nom: 'Détection des incidents et création des tâches', v: ['non', 'non', 'non', 'inclus', 'inclus'] },
    { nom: 'Contexte personnalisé par logement', desc: 'Wi-Fi, parking, check-in, équipements, règles',
      v: ['non', 'non', 'non', 'inclus', 'inclus'] },
    { nom: 'Ton et personnalité personnalisables', v: ['non', 'non', 'non', 'inclus', 'inclus'] },
    { nom: 'Garde-fous et escalade automatique', desc: 'Remboursements, réclamations, demandes sensibles',
      v: ['non', 'non', 'non', 'inclus', 'inclus'] },
    { nom: 'Seuil de confiance configurable', v: ['non', 'non', 'non', 'inclus', 'inclus'] },
  ]},
];

/* ============================================================
   HISTORIQUE DE FACTURATION (app/abonnement.html) — pour chaque
   mois, l'offre souscrite et le nombre total de logements gérés à
   cette date (le parc grandit avec le temps ; le montant se déduit
   via planTotal, pas de valeur en dur). Dernier mois = mois en
   cours (juillet 2026, cf. AUJOURDHUI).
   Le compte est passé de Smart à Business en juin 2026.
   ============================================================ */
const HISTORIQUE_FACTURATION = [
  { mois: 'Février 2026', nbLogements: 4,  plan: 'smart'    },
  { mois: 'Mars 2026',    nbLogements: 5,  plan: 'smart'    },
  { mois: 'Avril 2026',   nbLogements: 6,  plan: 'smart'    },
  { mois: 'Mai 2026',     nbLogements: 8,  plan: 'smart'    },
  { mois: 'Juin 2026',    nbLogements: 9,  plan: 'business' },
  { mois: 'Juillet 2026', nbLogements: 10, plan: 'business' },
];

/* ============================================================
   STATISTIQUES — séries pré-calculées (6 mois : févr.→juil. 2026)
   ============================================================ */
const STATS = {
  moisLabels: ['Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.'],
  ca:         [12400, 15800, 21300, 26900, 31200, 34600],
  occupation: [58, 64, 71, 78, 83, 86],       // %
  adr:        [96, 102, 108, 118, 124, 129],   // panier moyen / nuit (€)
  repartitionCanal: { airbnb: 48, booking: 27, direct: 25 }, // % des réservations
  // Occupation & CA par logement sur le mois en cours (juillet)
  parLogement: [
    { id:'L001', occ:82, ca:3120 }, { id:'L002', occ:88, ca:2410 },
    { id:'L003', occ:79, ca:2880 }, { id:'L004', occ:74, ca:5960 },
    { id:'L005', occ:91, ca:7080 }, { id:'L006', occ:68, ca:2190 },
    { id:'L007', occ:85, ca:1950 }, { id:'L008', occ:77, ca:3540 },
    { id:'L009', occ:72, ca:2280 }, { id:'L010', occ:80, ca:3210 },
  ],
};

/* ============================================================
   UTILISATEUR & COMPTE (abonnement en cours)
   ============================================================ */
const UTILISATEUR = {
  nom:'Camille Dupont', initiales:'CD', email:'camille@conciergerie-lumia.fr',
  role:'Conciergerie Lumia', avatar:null,
};

/* ============================================================
   SUPPORT OYVIA — le point de contact commercial

   Un changement d'offre n'est pas un réglage : il engage une facturation,
   parfois une migration de parc. Il passe donc par l'équipe, jamais par un
   bouton en libre-service. Coordonnées regroupées ici pour n'avoir qu'un
   endroit à modifier le jour où elles changent.
   ============================================================ */
const SUPPORT_OYVIA = {
  whatsapp: '+212 6 00 00 00 00',
  email: 'contact@oyvia.com',
  delaiReponse: 'Réponse sous 24 h ouvrées',
};
// wa.me n'accepte que des chiffres ; le message est pré-rempli côté WhatsApp.
function lienWhatsAppSupport(message) {
  const num = SUPPORT_OYVIA.whatsapp.replace(/[^\d]/g, '');
  return `https://wa.me/${num}?text=${encodeURIComponent(message || '')}`;
}

const COMPTE = {
  societe:'Conciergerie Lumia',
  nbLogements:10,             // logements gérés au total
  plan:'business',            // cf. PLANS — conditionne l'accès à l'IA Avancée (Vivi)
  compteCreeLe:'2026-01-14',  // compte créé bien avant la période couverte par la démo
};

/* ============================================================
   RÔLES & COMPTES UTILISATEURS  (Paramètres > Rôles & accès)

   Deux familles de rôles :
     - portail « app »  : l'équipe interne de la conciergerie, qui se
       connecte à l'application complète. Ses accès sont définis
       section par section (voir PERMISSIONS, calqué sur le menu).
     - portails externes : prestataires et propriétaires, qui n'entrent
       jamais dans l'app mais disposent de leur propre espace dédié
       (prestataire.html / proprietaire.html) limité à leurs données.
   ============================================================ */

// Une permission = une section du menu de l'app.
const PERMISSIONS = [
  { id:'dashboard',       label:'Tableau de bord',   groupe:'Aperçu' },
  { id:'calendrier',      label:'Calendrier',        groupe:'Aperçu' },
  { id:'statistiques',    label:'Statistiques',      groupe:'Aperçu' },
  { id:'logements',       label:'Logements',         groupe:'Locations' },
  { id:'proprietaires',   label:'Propriétaires',     groupe:'Locations' },
  { id:'reservations',    label:'Réservations',      groupe:'Locations' },
  { id:'voyageurs',       label:'Voyageurs',         groupe:'Locations' },
  { id:'messagerie',      label:'Messagerie',        groupe:'Communication' },
  { id:'automatisations', label:'Automatisations',   groupe:'Communication' },
  { id:'vivi',            label:'Assistant IA (Vivi)',groupe:'Communication' },
  { id:'menage',          label:'Gestion des tâches',groupe:'Équipe' },
  { id:'equipe',          label:'Équipe',            groupe:'Équipe' },
  { id:'comptabilite',    label:'Comptabilité',      groupe:'Comptabilité' },
  { id:'abonnement',      label:'Abonnement',        groupe:'Compte' },
  { id:'parametres',      label:'Paramètres & rôles',groupe:'Compte' },
];
const TOUTES_PERMISSIONS = PERMISSIONS.map(p => p.id);

const PORTAIL_LABEL = {
  app:          'Application complète',
  prestataire:  'Espace prestataire',
  proprietaire: 'Espace propriétaire',
};

const ROLES = [
  { id:'admin', nom:'Administrateur', portail:'app', systeme:true,
    desc:'Accès total, y compris la facturation, les paramètres et la gestion des rôles.',
    permissions:[...TOUTES_PERMISSIONS] },

  { id:'gestionnaire', nom:'Gestionnaire', portail:'app', systeme:false,
    desc:'Pilote l’activité au quotidien. N’accède ni à l’abonnement ni aux paramètres.',
    permissions:['dashboard','calendrier','statistiques','logements','proprietaires','reservations','voyageurs','messagerie','automatisations','menage','equipe','comptabilite'] },

  { id:'secretaire', nom:'Secrétaire', portail:'app', systeme:false,
    desc:'Gère les réservations, les voyageurs et les échanges. Aucun accès financier.',
    permissions:['dashboard','calendrier','reservations','voyageurs','messagerie','menage'] },

  { id:'comptable', nom:'Comptable', portail:'app', systeme:false,
    desc:'Suit la facturation, les dépenses et les reversements aux propriétaires.',
    permissions:['dashboard','statistiques','proprietaires','comptabilite','abonnement'] },

  { id:'prestataire', nom:'Prestataire', portail:'prestataire', systeme:true,
    desc:'Consulte uniquement les tâches qui lui sont assignées et y ajoute ses photos.',
    permissions:[] },

  { id:'proprietaire', nom:'Propriétaire', portail:'proprietaire', systeme:true,
    desc:'Consulte ses logements, ses réservations et sa synthèse comptable, en lecture seule.',
    permissions:[] },
];

/* Comptes créés. `lienId` rattache un compte externe à sa fiche métier
   (un prestataire de PRESTATAIRES, un propriétaire de PROPRIETAIRES). */
const UTILISATEURS = [
  { id:'U1', nom:'Camille Dupont',  email:'camille@conciergerie-lumia.fr', roleId:'admin',        statut:'actif',   lienId:null, dernierAcces:'2026-07-23' },
  { id:'U2', nom:'Inès Marchand',   email:'ines@conciergerie-lumia.fr',    roleId:'secretaire',   statut:'actif',   lienId:null, dernierAcces:'2026-07-22' },
  { id:'U3', nom:'Bruno Faure',     email:'bruno.faure@cabinet-fc.fr',     roleId:'comptable',    statut:'actif',   lienId:null, dernierAcces:'2026-07-18' },
  { id:'U4', nom:'Sylvie Ménard',   email:'sylvie.menard@gmail.com',       roleId:'prestataire',  statut:'actif',   lienId:'P1', dernierAcces:'2026-07-23' },
  { id:'U5', nom:'Marc Antoine',    email:'marc.antoine@gmail.com',        roleId:'prestataire',  statut:'actif',   lienId:'P4', dernierAcces:'2026-07-21' },
  { id:'U6', nom:'Paul Bernard',    email:'paul.bernard@sci-bernard.fr',   roleId:'proprietaire', statut:'actif',   lienId:'O1', dernierAcces:'2026-07-20' },
  { id:'U7', nom:'Sophie Lefort',   email:'s.lefort@gmail.com',            roleId:'proprietaire', statut:'invite',  lienId:'O2', dernierAcces:null },
];

const STATUT_COMPTE_LABEL = { actif:'Actif', invite:'Invitation envoyée', suspendu:'Suspendu' };

function getRole(id) { return ROLES.find(r => r.id === id); }
function getUtilisateurCompte(id) { return UTILISATEURS.find(u => u.id === id); }
function getComptesByRole(id) { return UTILISATEURS.filter(u => u.roleId === id); }

/* ============================================================
   PLATEFORMES — connexions aux OTA, moteurs de visibilité & outils
   (page Paramètres > Plateformes)
   ============================================================ */
const PLATEFORME_SECTION_LABEL = { ota:'OTA', connexions:'Connexions', applications:'Applications' };

const PLATEFORMES = [
  { id:'airbnb',     section:'ota',          nom:'Airbnb',       lettre:'A', connecte:true,  desc:"Synchronisez vos annonces et réservations Airbnb en temps réel." },
  { id:'booking',    section:'ota',          nom:'Booking.com',  lettre:'B', connecte:true,  desc:"Synchronisez vos annonces et réservations Booking.com en temps réel." },
  { id:'expedia',    section:'ota',          nom:'Expedia',      lettre:'E', connecte:false, desc:"Diffusez vos logements sur Expedia et Hotels.com." },
  { id:'agoda',      section:'ota',          nom:'Agoda',        lettre:'A', connecte:false, desc:"Diffusez vos logements sur Agoda, très utilisé en Asie." },
  { id:'vrbo',       section:'ota',          nom:'Vrbo',         lettre:'V', connecte:false, desc:"Synchronisez vos annonces Vrbo et gérez vos réservations depuis Oyvia." },
  { id:'whatsapp',   section:'connexions',   nom:'WhatsApp',     lettre:'W', connecte:true,  desc:"Recevez et répondez aux messages WhatsApp de vos voyageurs directement dans la messagerie Oyvia." },
  { id:'google',     section:'connexions',   nom:'Google',       lettre:'G', connecte:false, desc:"Affichez vos disponibilités sur Google (Recherche et Maps)." },
  { id:'pricelabs',  section:'applications', nom:'PriceLabs',    lettre:'P', connecte:false, desc:"Synchronisez une tarification dynamique, logement par logement." },
];

/* ============================================================
   TARIFICATION DYNAMIQUE — moteur Oyvia ou plateforme externe
   (section Intégrations)

   Ce que fait PriceLabs, et que l'on reproduit ici : il part d'un
   PRIX DE BASE par logement, lui applique une pile de règles
   (saison, jour de la semaine, proximité de l'arrivée, nuits
   durée du séjour, délai de réservation), puis borne le résultat entre
   un plancher et un plafond décidés par l'hôte. Le prix obtenu est
   poussé chaque nuit vers les canaux connectés.

   Trois partis pris, importants pour ne rien raconter de faux :

   1. Le plancher et le plafond ne sont pas des règles de plus, ce
      sont des GARDE-FOUS. Ils s'appliquent en dernier et écrasent
      tout le reste : aucune combinaison de règles ne peut vendre
      une nuit sous le prix que l'hôte a fixé comme acceptable.

   2. Les plateformes du marché (PriceLabs, Beyond…) s'appuient sur
      des données de COMPARABLES du quartier. Oyvia n'en dispose pas.
      Le taux d'occupation se mesure donc sur VOTRE parc, et il est
      libellé comme tel à l'écran. C'est moins puissant qu'une donnée
      de marché, mais c'est vérifiable.

   3. Quatre des cinq règles portent sur une NUIT (occupation, saison,
      jour, délai de réservation) : elles se cumulent pour produire le
      prix affiché au calendrier. La cinquième, la durée du séjour,
      ne peut pas s'appliquer à une nuit isolée — on ne sait pas, en
      calculant le mardi, combien de nuits le voyageur réservera. Elle
      s'applique au DEVIS, une fois la durée connue. Cf. prixSejour().
   ============================================================ */

/* Qui calcule les prix. Oyvia sait le faire lui-même ; sinon on se branche
   sur une plateforme spécialisée, qui garde alors la main sur ses règles. */
const MOTEURS_TARIFICATION = [
  { id:'oyvia',      nom:'Tarification Oyvia', lettre:'O', externe:false,
    accroche:"Le moteur intégré : vos règles, vos garde-fous, aucun outil supplémentaire à payer.",
    desc:"Cinq leviers que vous réglez vous-même — occupation, saison, jour de la semaine, durée du séjour, délai de réservation." },
  { id:'pricelabs',  nom:'PriceLabs',  lettre:'P', externe:true,
    accroche:"La référence du marché, avec les données de comparables de votre quartier.",
    desc:"Vos règles restent configurées dans PriceLabs. Oyvia lui transmet vos réservations, applique vos garde-fous et pousse les prix vers vos canaux." },
  { id:'beyond',     nom:'Beyond',     lettre:'B', externe:true,
    accroche:"Tarification pilotée par la demande, orientée gestionnaires multi-biens.",
    desc:"Vos règles restent configurées dans Beyond. Oyvia applique vos garde-fous et pousse les prix vers vos canaux." },
  { id:'wheelhouse', nom:'Wheelhouse', lettre:'W', externe:true,
    accroche:"Stratégies personnalisables, du plus prudent au plus agressif.",
    desc:"Vos règles restent configurées dans Wheelhouse. Oyvia applique vos garde-fous et pousse les prix vers vos canaux." },
];
function getMoteurTarification(id) { return MOTEURS_TARIFICATION.find(m => m.id === id) || null; }

const TARIF_DYNAMIQUE = {
  id: 'TD',
  // null = aucun choix fait, l'écran de sélection s'affiche.
  moteur: null,
  syncAuto: true,
  heureSync: '06:00',
  derniereSync: '2026-07-23 06:12',
  horizonJours: 365,          // profondeur de calendrier poussée aux canaux
  arrondi: 1,                 // arrondi du prix final, en euros

  /* 1. TAUX D'OCCUPATION — le levier principal.
     Part de VOS logements déjà vendus pour cette nuit-là :
     logements réservés / logements du parc. Plus le parc se remplit,
     plus les nuits restantes peuvent se vendre cher.

     `horizonUtile` est le garde-fou de cette règle : au-delà, elle ne
     s'applique plus. Un parc vide à six mois n'est PAS un signal de
     faible demande, c'est l'état normal d'un calendrier à six mois.
     Sans cette borne, la règle lirait ce vide comme une alerte et
     collerait toutes les dates lointaines au plancher.
     Le palier retenu est le premier dont `jusqua` couvre la valeur. */
  occupation: { actif: true, horizonUtile: 120, paliers: [
    { jusqua: 30,  pct: -15 },
    { jusqua: 50,  pct: -8  },
    { jusqua: 70,  pct: 0   },
    { jusqua: 85,  pct: 12  },
    { jusqua: 100, pct: 25  },
  ]},

  // 2. SAISON — modulation mois par mois (index 0 = janvier).
  saison:  { actif: true, mois: [-20, -15, -10, 0, 5, 12, 25, 30, 10, 0, -15, -5] },

  // 3. JOUR DE LA SEMAINE — index = getDay() : 0 = dimanche … 6 = samedi.
  jours:   { actif: true, pct: [-8, -10, -10, -8, -3, 12, 15] },

  /* 4. DURÉE DU SÉJOUR — s'applique au devis, pas à la nuit.
     En calculant le prix d'un mardi, on ignore si le voyageur prendra
     2 nuits ou 3 semaines : cette règle ne peut donc pas entrer dans le
     prix affiché au calendrier. Elle module le TOTAL une fois la durée
     connue (cf. prixSejour), comme le fait une grille LOS. Bornes en
     nuits, inclusives des deux côtés ; `max: null` = pas de limite. */
  duree: { actif: true, paliers: [
    { min: 2,  max: 3,    pct: 0   },
    { min: 4,  max: 6,    pct: -5  },
    { min: 7,  max: 13,   pct: -12 },
    { min: 14, max: 29,   pct: -20 },
    { min: 30, max: null, pct: -30 },
  ]},

  /* 5. DÉLAI DE RÉSERVATION — nombre de jours entre aujourd'hui et la nuit.
     Une nuit invendue ne se rattrape jamais : on décote à l'approche, et
     on peut au contraire majorer les réservations très anticipées, qui
     sécurisent le calendrier. Bornes en jours, inclusives. */
  delai: { actif: true, paliers: [
    { min: 0,  max: 3,    label: 'Dernière minute', pct: -20 },
    { min: 4,  max: 7,    label: 'Rush',            pct: -10 },
    { min: 8,  max: 30,   label: 'Normal',          pct: 0   },
    { min: 31, max: 60,   label: 'Early bird',      pct: 5   },
    { min: 61, max: null, label: 'Super early',     pct: 8   },
  ]},

};

/* Copie des réglages d'usine, prise avant toute restauration : _migrerTarification()
   s'en sert pour reconstruire une règle absente d'un ancien instantané. */
const _TD_DEFAUTS = JSON.parse(JSON.stringify({
  occupation: TARIF_DYNAMIQUE.occupation,
  duree: TARIF_DYNAMIQUE.duree,
  delai: TARIF_DYNAMIQUE.delai,
}));

/* Prix fixés à la main pour une nuit précise. Ils court-circuitent tout le
   moteur — y compris le plancher et le plafond : si l'hôte inscrit un prix,
   c'est qu'il sait quelque chose que le calendrier ignore (un festival, un
   congrès, une réservation de groupe attendue). */
const TD_OVERRIDES = [
  { id:'TDO1', logementId:'L001', date:'2026-08-15', prix:210, note:"Fête de l'Assomption — forte demande en centre-ville" },
  { id:'TDO2', logementId:'L003', date:'2026-09-12', prix:340, note:'Congrès — tout le quartier est plein' },
];

/* Journal des synchronisations poussées vers les canaux. */
const TD_JOURNAL = [
  { id:'TDJ1', horodatage:'2026-07-23 06:12', statut:'ok',        logements:5, nuits:1825, message:'Prix poussés vers Airbnb et Booking.com' },
  { id:'TDJ2', horodatage:'2026-07-22 06:11', statut:'ok',        logements:5, nuits:1825, message:'Prix poussés vers Airbnb et Booking.com' },
  { id:'TDJ3', horodatage:'2026-07-21 06:13', statut:'attention', logements:4, nuits:1460, message:"L005 ignoré : plancher supérieur au plafond, bornes à corriger" },
  { id:'TDJ4', horodatage:'2026-07-20 06:10', statut:'ok',        logements:5, nuits:1825, message:'Prix poussés vers Airbnb et Booking.com' },
];

const TD_STATUT_JOURNAL = { ok:'Réussie', attention:'Avertissement', erreur:'Échec' };

/* Moteur retenu par l'hôte. Tant qu'aucun choix n'est fait, la section
   affiche l'écran de sélection et rien d'autre : montrer un calendrier de
   recommandations laisserait croire que des prix partent déjà. */
function tdMoteur() { return getMoteurTarification(TARIF_DYNAMIQUE.moteur); }
function tdMoteurChoisi() { return !!tdMoteur(); }
// Les règles ne sont modifiables ici que si c'est Oyvia qui calcule : avec
// une plateforme externe, elles vivent chez elle, et les éditer ici
// laisserait croire qu'on agit sur des prix qu'on ne fait que recevoir.
function tdMoteurInterne() { const m = tdMoteur(); return !!m && !m.externe; }

function tdChoisirMoteur(id) {
  const m = getMoteurTarification(id);
  if (!m) return false;
  TARIF_DYNAMIQUE.moteur = id;
  // Une plateforme externe se reflète dans la liste des intégrations :
  // les deux écrans doivent raconter la même chose.
  PLATEFORMES.forEach(p => { if (MOTEURS_TARIFICATION.some(x => x.externe && x.id === p.id)) p.connecte = (p.id === id); });
  return true;
}
function tdDeconnecterMoteur() {
  const ancien = TARIF_DYNAMIQUE.moteur;
  TARIF_DYNAMIQUE.moteur = null;
  PLATEFORMES.forEach(p => { if (p.id === ancien) p.connecte = false; });
}

// Conservé : d'autres écrans (Paramètres > Plateformes) parlent encore de
// PriceLabs en tant qu'intégration, indépendamment du moteur retenu.
function pricelabsConnecte() {
  const p = PLATEFORMES.find(x => x.id === 'pricelabs');
  return !!(p && p.connecte);
}

// Un logement est piloté s'il est activé ET si un moteur est choisi :
// afficher « tarification dynamique » sur une fiche alors qu'aucun moteur
// ne tourne laisserait croire que des prix partent, alors que rien ne part.
function tdPilote(l) {
  return tdMoteurChoisi() && !!(l && l.tarifs && l.tarifs.dynamique && l.tarifs.dynamique.actif);
}
function tdLogementsPilotes() { return LOGEMENTS.filter(tdPilote); }

// Prix de base et garde-fous. Un logement qui n'a jamais été borné reçoit
// des valeurs de départ dérivées de son prix de base, pour que le moteur ne
// tourne jamais sans filet.
function tdBornes(l) {
  const base = l.tarifBase || 0;
  const min = (l.tarifs && l.tarifs.min != null) ? l.tarifs.min : Math.round(base * 0.75);
  const max = (l.tarifs && l.tarifs.max != null) ? l.tarifs.max : Math.round(base * 1.9);
  return { base, min, max };
}
// Bornes incohérentes : le moteur ne peut pas trancher à la place de l'hôte.
function tdBornesInvalides(l) {
  const { base, min, max } = tdBornes(l);
  if (min > max) return 'Le plancher dépasse le plafond.';
  if (base < min || base > max) return 'Le prix de base est hors des bornes.';
  return null;
}

function tdOverride(logementId, date) {
  return TD_OVERRIDES.find(o => o.logementId === logementId && o.date === date) || null;
}
function tdPoserOverride(logementId, date, prix, note) {
  const ex = tdOverride(logementId, date);
  if (ex) { ex.prix = prix; if (note !== undefined) ex.note = note; return ex; }
  const o = { id:'TDO' + Date.now(), logementId, date, prix, note: note || '' };
  TD_OVERRIDES.push(o);
  return o;
}
function tdRetirerOverride(logementId, date) {
  const o = tdOverride(logementId, date);
  return o ? supprimerEntite('TD_OVERRIDES', o.id) : false;
}

/* Taux d'occupation du parc pour une nuit : logements réservés / logements
   du parc. Un seul passage sur les réservations, sans reconstruire un
   calendrier par logement — la fonction est appelée pour chaque cellule du
   calendrier, la différence se voit. */
function tdOccupationParc(date) {
  const total = LOGEMENTS.length;
  if (!total) return 0;
  const pris = new Set();
  RESERVATIONS.forEach(r => {
    if (r.statut === 'annule') return;
    if (date >= r.arrivee && date < r.depart) pris.add(r.logementId);
  });
  return Math.round((pris.size / total) * 100);
}
// Premier palier dont le plafond couvre la valeur (paliers « jusqua »).
function tdPalierJusqua(paliers, valeur) {
  return paliers.find(p => valeur <= p.jusqua) || paliers[paliers.length - 1];
}
// Palier d'un intervalle [min, max] inclusif ; max null = pas de limite.
function tdPalierIntervalle(paliers, valeur) {
  return paliers.find(p => valeur >= p.min && (p.max == null || valeur <= p.max)) || null;
}

/* Cœur du moteur. Renvoie le prix poussé pour une nuit, ET le détail des
   règles qui y mènent : sans ce détail, l'hôte ne peut ni faire confiance
   au chiffre ni corriger la règle fautive. */
function prixRecommande(logementId, date) {
  const l = getLogement(logementId);
  if (!l) return null;
  const T = TARIF_DYNAMIQUE;
  const { base, min, max } = tdBornes(l);
  const reservation = nuitsOccupees(logementId).get(date) || null;
  const jAvant = nuitsEntre(AUJOURDHUI, date);

  const res = {
    logementId, date, base, min, max,
    reservation, passe: jAvant < 0,
    facteurs: [], override: null, brut: base, prix: base,
    borne: null, minNuits: (l.sejour && l.sejour.nuitsMin) || 1,
  };

  const ov = tdOverride(logementId, date);
  if (ov) {
    res.override = ov;
    res.brut = ov.prix; res.prix = ov.prix;
    return res;
  }

  const d = parseDate(date);
  let coef = 1;
  const ajouter = (id, label, pct, detail) => {
    if (!pct) return;
    res.facteurs.push({ id, label, pct, detail: detail || '' });
    coef *= 1 + pct / 100;
  };

  if (T.saison.actif) ajouter('saison', MOIS_LONG[d.getMonth()], T.saison.mois[d.getMonth()] || 0, 'Saisonnalité');
  if (T.jours.actif)  ajouter('jour', JOURS_LONG[d.getDay()], T.jours.pct[d.getDay()] || 0, 'Jour de la semaine');

  // Les règles de remplissage ne s'appliquent qu'à une nuit encore à vendre.
  // Recalculer une décote « dernière minute » sur une nuit déjà réservée
  // n'aurait aucun sens : le prix est encaissé, il ne bouge plus.
  if (!reservation && !res.passe) {
    if (T.delai.actif) {
      const p = tdPalierIntervalle(T.delai.paliers, jAvant);
      if (p) ajouter('delai', `${p.label} · ${jAvant} j avant`, p.pct, 'Délai de réservation');
    }
    // Hors de l'horizon utile, un parc vide n'est pas encore un signal.
    if (T.occupation.actif && jAvant <= (T.occupation.horizonUtile || Infinity)) {
      const t = tdOccupationParc(date);
      const p = tdPalierJusqua(T.occupation.paliers, t);
      res.occupationPct = t;
      ajouter('occupation', `Parc occupé à ${t} %`, p.pct, "Taux d'occupation");
    }
  }

  res.brut = Math.round(base * coef);
  const arr = T.arrondi || 1;
  let prix = Math.round((base * coef) / arr) * arr;
  if (prix < min) { prix = min; res.borne = 'min'; }
  else if (prix > max) { prix = max; res.borne = 'max'; }
  res.prix = prix;

  return res;
}

/* Synthèse sur une fenêtre glissante, pour les compteurs d'en-tête.
   On ne mesure QUE les nuits encore à vendre : inclure les nuits déjà
   réservées ferait passer pour une recommandation un prix qui a été
   décidé il y a des mois. */
/* Prix d'un SÉJOUR complet — c'est ici, et seulement ici, que la règle de
   durée entre en jeu.

   On somme les prix nuit par nuit (chacun portant déjà l'occupation, la
   saison, le jour et le délai), puis on applique le palier de durée au
   total. Impossible de faire autrement : au moment où l'on calcule le prix
   d'un mardi, on ignore si le voyageur prendra 2 nuits ou 3 semaines.

   Le plancher est revérifié sur la moyenne par nuit : une remise longue
   durée de 30 % ne doit pas passer sous le prix que l'hôte a fixé comme
   acceptable, sinon le garde-fou ne serait plus un garde-fou. */
function prixSejour(logementId, arrivee, nuits) {
  const l = getLogement(logementId);
  if (!l || !nuits || nuits < 1) return null;
  const T = TARIF_DYNAMIQUE;
  const { min } = tdBornes(l);

  const lignes = [];
  let sousTotal = 0;
  for (let i = 0; i < nuits; i++) {
    const date = addDays(arrivee, i);
    const r = prixRecommande(logementId, date);
    const p = r ? r.prix : 0;
    lignes.push({ date, prix: p });
    sousTotal += p;
  }

  const palier = T.duree.actif ? tdPalierIntervalle(T.duree.paliers, nuits) : null;
  const pctDuree = palier ? palier.pct : 0;
  let total = Math.round(sousTotal * (1 + pctDuree / 100));

  // Garde-fou : la remise de durée ne peut pas faire descendre la nuit
  // moyenne sous le plancher du logement.
  let plancherApplique = false;
  if (total < min * nuits) { total = min * nuits; plancherApplique = true; }

  return {
    logementId, arrivee, nuits, lignes,
    sousTotal, pctDuree, palierDuree: palier,
    total, parNuit: Math.round(total / nuits), plancherApplique,
  };
}

function tdSynthese(logementIds, jours = 30, depuis = AUJOURDHUI) {
  const ids = logementIds && logementIds.length
    ? logementIds
    : tdLogementsPilotes().map(l => l.id);
  let nuits = 0, sommePrix = 0, sommeBase = 0;
  let plancher = 0, plafond = 0, fixes = 0;
  ids.forEach(id => {
    for (let i = 0; i < jours; i++) {
      const date = addDays(depuis, i);
      const r = prixRecommande(id, date);
      if (!r || r.reservation) continue;
      nuits++;
      sommePrix += r.prix;
      sommeBase += r.base;
      if (r.override) fixes++;
      if (r.borne === 'min') plancher++;
      if (r.borne === 'max') plafond++;
    }
  });
  const moyen = nuits ? sommePrix / nuits : 0;
  const moyenBase = nuits ? sommeBase / nuits : 0;
  return {
    logements: ids.length, nuits,
    prixMoyen: Math.round(moyen),
    baseMoyenne: Math.round(moyenBase),
    ecartPct: moyenBase ? Math.round(((moyen - moyenBase) / moyenBase) * 100) : 0,
    plancher, plafond, fixes,
  };
}

/* Pousse les prix vers les canaux et journalise le résultat.
   Un logement aux bornes incohérentes est EXCLU de l'envoi plutôt que
   corrigé d'office : un plancher au-dessus du plafond est une erreur de
   saisie, et deviner l'intention de l'hôte reviendrait à vendre ses nuits
   à un prix qu'il n'a jamais validé. On l'écrit dans le journal. */
function tdSynchroniser() {
  const pilotes = tdLogementsPilotes();
  const bloques = pilotes.filter(l => tdBornesInvalides(l));
  const envoyes = pilotes.filter(l => !tdBornesInvalides(l));
  const horizon = TARIF_DYNAMIQUE.horizonJours;

  const horodatage = _tdMaintenant();

  const canaux = PLATEFORMES.filter(p => p.section === 'ota' && p.connecte).map(p => p.nom);
  let statut = 'ok';
  let message = canaux.length
    ? `Prix poussés vers ${canaux.join(' et ')}`
    : "Prix calculés, mais aucun canal connecté pour les recevoir";
  if (!canaux.length) statut = 'attention';
  if (bloques.length) {
    statut = 'attention';
    message = `${bloques.map(l => l.id).join(', ')} ignoré${bloques.length > 1 ? 's' : ''} : bornes à corriger`;
  }
  if (!envoyes.length) {
    statut = 'erreur';
    message = 'Aucun logement piloté : rien à synchroniser';
  }

  const entree = {
    id: 'TDJ' + Date.now(), horodatage, statut,
    logements: envoyes.length, nuits: envoyes.length * horizon, message,
  };
  TD_JOURNAL.unshift(entree);
  if (TD_JOURNAL.length > 30) TD_JOURNAL.length = 30;
  TARIF_DYNAMIQUE.derniereSync = horodatage;
  return entree;
}

/* « Maintenant » dans le référentiel de la démo : la DATE d'AUJOURDHUI,
   l'HEURE de l'horloge réelle. Prendre Date.now() tel quel daterait la
   synchronisation d'un jour qui n'existe pas dans le calendrier affiché,
   et « il y a 9 j » s'afficherait sur une synchro faite à l'instant. */
function _tdMaintenant() {
  const n = new Date();
  const p2 = v => String(v).padStart(2, '0');
  return `${AUJOURDHUI} ${p2(n.getHours())}:${p2(n.getMinutes())}`;
}
function _tdHorodatageMs(horodatage) {
  const [dpart, hpart] = String(horodatage).split(' ');
  const [y, m, d] = dpart.split('-').map(Number);
  const [hh, mm] = (hpart || '00:00').split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm).getTime();
}

// « il y a 2 h », pour dater la dernière synchronisation sans faire lire
// un horodatage complet à l'utilisateur.
function tdDepuis(horodatage) {
  if (!horodatage) return 'jamais';
  const min = Math.round((_tdHorodatageMs(_tdMaintenant()) - _tdHorodatageMs(horodatage)) / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const j = Math.round(h / 24);
  return `il y a ${j} j`;
}

/* ============================================================
   VIVI — assistant IA d'Oyvia

   Deux usages bien distincts, à ne pas confondre :

   1. VIVI CHAT (toutes les offres) — le copilote de l'utilisateur.
      Bouton flottant + popup : il répond aux questions sur le
      produit, explique pourquoi une réponse IA n'est pas partie,
      donne des chiffres d'activité, et sait escalader au support.

   2. IA AVANCÉE (offre Business uniquement) — Vivi répond
      automatiquement aux MESSAGES ENTRANTS DES VOYAGEURS.
      L'envoi de confirmations et de rappels, lui, reste géré par
      les automatisations de règles (cf. AUTOMATISATIONS) : ce
      sont deux mécaniques séparées.

   Smart n'inclut aucune IA voyageur : ses « automatisations » et ses
   « messages automatiques » sont des règles déclenchées par la
   réservation. L'IA est le seul écart entre Smart et Business.
   ============================================================ */

// Types de messages que Vivi est autorisée à traiter seule pour un logement.
const VIVI_SUJETS = [
  { id:'parking',      label:'Questions sur le parking' },
  { id:'wifi',         label:'Questions sur le WiFi' },
  { id:'acces',        label:'Accès et remise des clés' },
  { id:'horaires',     label:'Horaires de check-in / check-out' },
  { id:'equipements',  label:'Équipements (où est le thermostat ?)' },
  { id:'technique',    label:'Problèmes techniques', escaladeConseillee:true },
];

// Garde-fous : cas où Vivi ne répond JAMAIS seule.
// « libre » = la catégorie s'accompagne d'un champ texte, pour que
// l'utilisateur étende le périmètre au-delà des cas prévus.
const VIVI_ESCALADES = [
  { id:'remboursement', label:"Demandes de remboursement ou d'annulation" },
  { id:'plainte',       label:'Plaintes ou problèmes graves' },
  { id:'legal',         label:'Demandes légales ou administratives' },
  { id:'agressif',      label:'Messages au ton agressif ou urgent' },
  { id:'hors_domaine',  label:'Sujets hors de votre domaine' },
  { id:'modification',  label:'Demandes de modification de réservation' },
  { id:'autre',         label:'Autre', libre:true, placeholder:"Ex. toute question sur la caution, les animaux, les factures…" },
];

const VIVI_TONS = [
  { id:'formel',      label:'Très formel',            desc:'Registre hôtel 4★, vouvoiement strict.' },
  { id:'pro_amical',  label:'Professionnel amical',   desc:'Cordial mais cadré, la valeur sûre.' },
  { id:'decontracte', label:'Décontracté, personnalisé', desc:'Direct, chaleureux, sans formules toutes faites.' },
];
const VIVI_A_EVITER = [
  { id:'jargon',  label:'Les jargons techniques' },
  { id:'robot',   label:'Les réponses robot' },
  { id:'blagues', label:'Les blagues' },
  { id:'emojis',  label:'Les emojis' },
  { id:'autre',   label:'Autre', libre:true, placeholder:"Ex. les superlatifs, le tutoiement, les abréviations…" },
];
const VIVI_TYPES_HOTE = [
  { id:'particulier',  label:'Particulier' },
  { id:'conciergerie', label:'Conciergerie' },
  { id:'agence',       label:'Agence' },
  { id:'autre',        label:'Autre' },
];
const VIVI_APPROBATEURS = [
  { id:'moi',           label:'Moi seulement' },
  { id:'moi_managers',  label:'Moi + mes managers' },
  { id:'equipe',        label:"Toute l'équipe" },
];
const VIVI_LANGUES = [
  { id:'fr', label:'Français' }, { id:'en', label:'Anglais' },
  { id:'de', label:'Allemand' }, { id:'es', label:'Espagnol' },
  { id:'it', label:'Italien' },  { id:'ar', label:'Arabe' },
];

const VIVI_CONFIG = {
  // A — Contexte global : Vivi sait qui elle représente.
  // Pas de zone géographique à saisir : chaque réservation porte son
  // logement, donc sa ville et son pays. Vivi s'y adapte d'elle-même.
  global: {
    entreprise:'Conciergerie Lumia',
    typeHote:'conciergerie',
    langueTravail:'fr',
    languesVoyageurs:['fr', 'en', 'de', 'es'],
  },
  // B — Personnalité & ton : Vivi écrit comme la conciergerie, pas comme un bot.
  // « eviterAutre » complète la liste fermée par les consignes maison.
  personnalite: {
    perception:"On est accueillants et chaleureux, on répond vite et on n'aime pas les formalités.",
    ton:'decontracte',
    exemples:"Bonjour Sophie ! Le code de la porte est le 4721#, il fonctionne dès 15 h. Le parking est juste en face, place Saint-Jean. Bon voyage et à tout à l'heure !",
    eviter:['jargon', 'robot'],
    eviterAutre:'',
  },
  // C — Garde-fous & escalade : quand Vivi s'arrête et vous passe la main.
  // silenceActif:false ⇒ Vivi répond 24 h/24, les horaires sont ignorés.
  gardeFous: {
    escalade:['remboursement', 'plainte', 'legal', 'agressif', 'hors_domaine', 'modification'],
    escaladeAutre:'',
    confianceMin:75,
    delaiMin:30,          // secondes avant l'envoi automatique
    silenceActif:true,
    silenceDebut:'22:00',
    silenceFin:'08:00',
    approbateurs:'moi_managers',
  },
  // D — Tâches ménagères déduites des messages.
  //
  // Déroulé standard, en deux temps :
  //   1. Vivi RÉPOND au voyageur — envoi automatique ou mise en attente,
  //      selon les garde-fous et le seuil de confiance ci-dessus ;
  //   2. la TÂCHE vous est proposée et attend votre validation.
  //
  // La validation est donc le défaut sur toutes les catégories : engager un
  // prestataire coûte un déplacement, alors qu'un accusé de réception n'engage
  // qu'une phrase. « Créer seule » reste disponible pour les sujets où vous
  // jugez le risque nul (typiquement le réapprovisionnement).
  //   auto    → Vivi crée la tâche immédiatement et vous notifie
  //   valider → Vivi prépare la tâche, vous la créez d'un clic
  //   ignorer → Vivi ne propose rien sur ce sujet
  taches: {
    actif:true,
    modes: { panne:'valider', proprete:'valider', consommables:'valider', menage_sejour:'valider' },
  },
  // E — Contexte par logement : UNIQUEMENT ce qu'Oyvia ne sait pas déjà.
  // L'adresse, le code d'accès, le Wi-Fi et les équipements viennent de la
  // fiche du logement (LOGEMENTS) et les horaires des paramètres généraux :
  // les redemander ici créerait deux sources de vérité pour la même donnée.
  // On ne stocke donc que le contexte terrain, les règles et le périmètre
  // que Vivi peut traiter seule.
  logements: {
    L001: {
      contexte:"Immeuble ancien : la porte de la rue coince, il faut pousser en tournant la clé. Le balcon donne sur une cour intérieure, très calme malgré le quartier. Boulangerie ouverte 7 j/7 au coin de la rue.",
      regles:"Pas de bruit après 22 h, pas de fête, interdiction de fumer à l'intérieur (balcon autorisé).",
      contactTel:'+33 6 12 45 78 90', contactHoraires:'9 h – 19 h',
      sujets:['parking', 'wifi', 'acces', 'horaires', 'equipements'],
    },
    L002: {
      contexte:"3e étage sans ascenseur : prévenir les voyageurs qui annoncent de grosses valises. Rue en pente, taxi conseillé depuis la gare du Nord.",
      regles:"Immeuble ancien : merci d'éviter le bruit dans les escaliers après 21 h.",
      contactTel:'+33 6 12 45 78 90', contactHoraires:'9 h – 19 h',
      sujets:['wifi', 'acces', 'horaires'],
    },
    L005: {
      contexte:"Piscine non chauffée, ouverte d'avril à octobre. Le portail automatique se bloque de temps en temps : une clé de secours se trouve dans le boîtier à gauche de l'entrée.",
      regles:"Piscine non surveillée : enfants sous la responsabilité des parents. Pas d'événement sans accord écrit.",
      contactTel:'+33 6 12 45 78 90', contactHoraires:'8 h – 20 h',
      sujets:['parking', 'wifi', 'acces', 'horaires', 'equipements'],
    },
  },
};

// Renvoie le contexte d'un logement, ou null s'il n'a pas encore été décrit.
function getViviLogement(id) { return VIVI_CONFIG.logements[id] || null; }
function viviLogementsRenseignes() { return LOGEMENTS.filter(l => !!VIVI_CONFIG.logements[l.id]); }
function viviLogementsACompleter() { return LOGEMENTS.filter(l => !VIVI_CONFIG.logements[l.id]); }

// L'offre du compte donne-t-elle accès à l'IA voyageur ?
// 'avancee' = Vivi répond seule (Business) · null = aucune IA (Gratuit, Smart)
function viviNiveauIA() { return getPlan(COMPTE.plan).ia; }

/* ------------------------------------------------------------
   E — Audit : les dernières réponses générées par Vivi.

   Chaque entrée pointe vers une CONVERSATION réelle, et rien n'est
   dupliqué depuis elle : le logement, le canal et le voyageur sont
   déduits de la réservation liée. C'est ce qui garantit que l'audit
   et la messagerie racontent exactement la même histoire.

   statut :
     envoyee   → la réponse est DÉJÀ dans la conversation, à l'index
                 msgIndex. On ne stocke donc pas son texte.
     attente   → confiance insuffisante ou heures de silence : la
                 proposition vit ici (champ « reponse ») et n'a pas
                 encore été postée. msgIndex vaut null.
     escaladee → un garde-fou s'est déclenché ; même principe.
   ------------------------------------------------------------ */
const VIVI_STATUT_LABEL = { envoyee:'Envoyée auto', attente:'En attente de révision', escaladee:'Escaladée' };
const VIVI_STATUT_BADGE = { envoyee:'badge--positive', attente:'badge--warning', escaladee:'badge--danger' };

const VIVI_REPONSES = [
  /* --- En attente de votre aval : rien n'est encore parti --- */
  {
    id:'V347', conversationId:'C16', msgIndex:null, statut:'attente',
    quand:'2026-07-23 10:24', langue:'fr', confiance:58, delai:null,
    question:"Dernière question : y a-t-il un parking à proximité ?",
    reponse:"Bonjour Sarah ! Je vérifie les possibilités de stationnement autour du logement et je reviens vers vous très vite.",
    raison:"Logement non décrit : Vivi n'a pas l'information du parking",
  },
  {
    id:'V346', conversationId:'C01', msgIndex:null, statut:'attente',
    quand:'2026-07-23 09:12', langue:'fr', confiance:96, delai:null,
    question:"Et à quelle heure dois-je libérer le logement le 26 ?",
    reponse:"Le départ se fait avant 11 h le 26. Laissez simplement les clés dans la boîte (code 7734B) et pensez à fermer les fenêtres. Bon séjour d'ici là !",
    raison:"Une question précédente est restée sans réponse (l'ascenseur)",
  },
  {
    id:'V345', conversationId:'C18', msgIndex:null, statut:'escaladee',
    quand:'2026-07-21 16:15', langue:'fr', confiance:71, delai:null,
    question:"Merci ! Il y aura un lit d'appoint du coup ?",
    reponse:"Bonjour Lucas, je vérifie la configuration exacte des lits pour 3 personnes et je vous confirme dans la journée.",
    raison:"Demande de modification de réservation",
  },

  /* --- Déjà envoyées automatiquement (texte lu dans la conversation) --- */
  { id:'V344', conversationId:'C16', msgIndex:1, statut:'envoyee', quand:'2026-07-23 10:18', langue:'fr', confiance:91, delai:33, raison:null },
  { id:'V343', conversationId:'C03', msgIndex:1, statut:'envoyee', quand:'2026-07-22 21:30', langue:'fr', confiance:88, delai:41, raison:null },
  { id:'V342', conversationId:'C05', msgIndex:1, statut:'envoyee', quand:'2026-07-22 14:35', langue:'fr', confiance:94, delai:35, raison:null },
  { id:'V341', conversationId:'C10', msgIndex:1, statut:'envoyee', quand:'2026-07-20 10:25', langue:'fr', confiance:90, delai:37, raison:null },
  { id:'V340', conversationId:'C13', msgIndex:1, statut:'envoyee', quand:'2026-07-17 15:45', langue:'en', confiance:84, delai:44, raison:null },
  { id:'V339', conversationId:'C12', msgIndex:1, statut:'envoyee', quand:'2026-07-18 12:30', langue:'fr', confiance:87, delai:39, raison:null },
  { id:'V338', conversationId:'C11', msgIndex:1, statut:'envoyee', quand:'2026-07-19 17:55', langue:'fr', confiance:79, delai:52, raison:null },
  { id:'V337', conversationId:'C15', msgIndex:1, statut:'envoyee', quand:'2026-07-15 20:20', langue:'fr', confiance:92, delai:31, raison:null },
];

/* ---------- Accès aux réponses de Vivi ---------- */
function getViviConversation(r) { return CONVERSATIONS.find(c => c.id === r.conversationId) || null; }
function getViviReponses(convId) { return VIVI_REPONSES.filter(r => r.conversationId === convId); }
// Une conversation n'a qu'une proposition en attente à la fois.
function getViviEnAttente(convId) { return VIVI_REPONSES.find(r => r.conversationId === convId && r.statut !== 'envoyee') || null; }
function viviReponsesEnAttente() { return VIVI_REPONSES.filter(r => r.statut !== 'envoyee'); }
// Un message de la conversation a-t-il été écrit par Vivi ? On le déduit,
// plutôt que de marquer les messages : impossible de désynchroniser.
function viviAEcrit(convId, index) {
  return VIVI_REPONSES.some(r => r.conversationId === convId && r.msgIndex === index);
}

// Contexte d'une réponse (logement, canal, voyageur), déduit de la conversation.
function viviContexte(r) {
  const c = getViviConversation(r);
  const resa = c ? getReservation(c.reservationId) : null;
  return {
    conversation: c,
    reservation: resa,
    logement: resa ? getLogement(resa.logementId) : null,
    canal: c ? c.canal : null,
    voyageur: resa ? resa.voyageur : null,
  };
}
// Le texte de la question : stocké pour les propositions en attente,
// relu dans la conversation pour les réponses déjà parties.
function viviQuestion(r) {
  if (r.question) return r.question;
  const c = getViviConversation(r);
  if (!c || r.msgIndex == null) return '';
  for (let i = r.msgIndex - 1; i >= 0; i--) if (c.messages[i].de === 'voyageur') return c.messages[i].texte;
  return '';
}
function viviTexte(r) {
  if (r.statut !== 'envoyee') return r.reponse || '';
  const c = getViviConversation(r);
  return c && c.messages[r.msgIndex] ? c.messages[r.msgIndex].texte : (r.reponse || '');
}

/* ---------- Actions sur une proposition en attente ----------
   Approuver POSTE réellement le message dans la conversation : la
   messagerie et l'audit restent cohérents sans code de synchronisation.
   « texteAlternatif » sert quand l'utilisateur a corrigé la réponse. */
function viviApprouver(id, texteAlternatif) {
  const r = VIVI_REPONSES.find(x => x.id === id);
  if (!r || r.statut === 'envoyee') return null;
  const c = getViviConversation(r);
  const texte = String(texteAlternatif != null ? texteAlternatif : r.reponse || '').trim();
  if (!c || !texte) return null;

  c.messages.push({ de:'hote', texte, heure:"À l'instant" });
  c.horodatage = "À l'instant";
  r.msgIndex = c.messages.length - 1;
  r.reponse = texte;
  r.statut = 'envoyee';
  // delai ne mesure que l'envoi automatique : ici c'est un humain qui a
  // validé, donc il n'y a pas de délai à afficher.
  r.delai = null;
  r.approuvee = true;
  r.raison = null;
  if (texteAlternatif != null) r.corrigee = true;
  return r;
}
// Le badge de statut : une réponse validée à la main n'est pas « auto ».
function viviStatutLabel(r) {
  if (r.statut !== 'envoyee') return VIVI_STATUT_LABEL[r.statut];
  return (r.approuvee || r.corrigee) ? 'Envoyée après relecture' : VIVI_STATUT_LABEL.envoyee;
}
// Comment une réponse est partie, en une phrase courte réutilisable partout.
function viviOrigine(r) {
  // Une confirmation de créneau n'est ni « approuvée » ni « automatique » :
  // c'est la suite directe de la tâche que vous venez de créer.
  if (r.confirmationCreneau) return 'envoyée à la création de la tâche';
  if (r.corrigee) return 'corrigée puis envoyée par vous';
  if (r.approuvee) return 'approuvée par vous';
  return `envoyée automatiquement en ${r.delai} s`;
}
function viviRefuser(id) {
  const i = VIVI_REPONSES.findIndex(x => x.id === id);
  if (i > -1) VIVI_REPONSES.splice(i, 1);
}

/* ---------- Pourquoi cette réponse attend-elle ? ----------
   Le seuil de confiance n'est qu'UNE des trois conditions d'envoi
   automatique. Une réponse peut donc très bien afficher 96 % et
   attendre quand même, parce qu'un garde-fou s'est déclenché ou que
   le message est arrivé pendant les heures de silence.

   Afficher côte à côte « en attente » et « confiance 96 % » sans
   expliciter le lien laissait croire à une incohérence. On qualifie
   donc la confiance PAR RAPPORT AU SEUIL, et on nomme le vrai
   bloquant.
     type : 'gardefou'  → l'escalade prime, la confiance n'entre pas en jeu
            'confiance' → c'est bien le seuil qui n'est pas atteint
            'autre'     → seuil atteint, mais une autre règle retient l'envoi */
function viviMotifAttente(r) {
  if (!r || r.statut === 'envoyee') return null;
  const seuil = (VIVI_CONFIG.gardeFous && VIVI_CONFIG.gardeFous.confianceMin) || 0;
  const atteint = r.confiance >= seuil;
  const type = r.statut === 'escaladee' ? 'gardefou' : (atteint ? 'autre' : 'confiance');
  return {
    type, seuil, atteint, confiance: r.confiance, cause: r.raison || '',
    // Étiquette courte affichée à côté du statut.
    etiquette: type === 'gardefou'
      ? 'Garde-fou'
      : `${r.confiance} % ${atteint ? '≥' : '<'} seuil ${seuil} %`,
    // Phrase complète, pour les infobulles et l'audit.
    phrase: type === 'gardefou'
      ? `Garde-fou déclenché — ${r.raison}. L'escalade prime sur la confiance (${r.confiance} %).`
      : type === 'confiance'
        ? `Confiance ${r.confiance} %, sous votre seuil de ${seuil} % — ${r.raison}.`
        : `Confiance ${r.confiance} %, votre seuil de ${seuil} % est atteint. C'est une autre règle qui retient l'envoi — ${r.raison}.`,
  };
}

/* ============================================================
   VIVI — TÂCHES DÉDUITES DES MESSAGES

   Quand un voyageur signale un besoin d'intervention, le déroulé est
   en DEUX TEMPS, dans cet ordre :

     1. Vivi RÉPOND au voyageur. Cette réponse passe par les mêmes
        règles que toutes ses réponses — garde-fous, seuil de confiance,
        heures de silence — donc elle part seule ou attend votre aval.
        Un voyageur qui signale une fuite ne doit pas rester sans
        nouvelles pendant qu'on organise l'intervention.

     2. La TÂCHE vous est proposée et attend votre validation. Créer
        une tâche engage un prestataire et un déplacement : c'est une
        décision, pas un accusé de réception.

   L'unité persistée est le SIGNALEMENT (VIVI_SIGNALEMENTS), pas la
   proposition. C'est nécessaire : l'étape 1 poste un message dans la
   conversation, qui cesse donc d'être « restée sans réponse ». Si la
   tâche était recalculée depuis les messages ouverts, elle
   disparaîtrait à l'instant précis où Vivi répond.

   Le balayage initial, lui, ne regarde que les messages restés sans
   réponse : un problème que vous avez déjà traité à la main ne
   redéclenche pas de signalement.
   ============================================================ */

const VIVI_URGENCES = {
  haute:   { label:'Urgent',  badge:'badge--danger'  },
  normale: { label:'Normal',  badge:'badge--neutral' },
};

// Les mots-clés simulent ici ce qu'un modèle de langue ferait en
// production. L'ordre du tableau fait la priorité : une fuite d'eau
// prime sur un manque de serviettes si le message parle des deux.
//
// Les « exemples » ne sont pas décoratifs : ce sont de vrais messages que
// le détecteur ci-dessous classe dans cette catégorie. viviVerifierExemples()
// le contrôle — si un exemple cesse d'être reconnu après une modification
// des mots-clés, on le voit au lieu d'afficher une promesse fausse.
const VIVI_CATEGORIES_TACHE = [
  {
    id:'panne', label:'Panne ou dégât', type:'maintenance', urgence:'haute',
    desc:"Fuite, chauffe-eau, serrure, électroménager, climatisation, Wi-Fi.",
    heureDefaut:'16:00',
    confirmations:{
      fr:"Bonjour {prenom}, c'est confirmé : notre intervenant passera {quand} pour régler le problème. Merci de votre patience !",
      en:"Hello {prenom}, it's confirmed: our technician will come {quand} to fix the issue. Thank you for your patience!",
    },
    exemples:[
      "Bonjour, il y a une fuite sous l'évier de la cuisine, ça coule depuis ce matin.",
      "Plus d'eau chaude depuis hier soir, le chauffe-eau ne redémarre pas.",
      "Hi, the air conditioning is not working in the bedroom.",
    ],
    mots:['fuite','fuit','panne','ne fonctionne pas','ne marche pas','plus d\'eau chaude','chauffe-eau','chaudière',
          'climatisation','la clim','radiateur','serrure','bloqué','bloquée','cassé','cassée','bouché','bouchée',
          'coupure','disjoncte','not working','is not working','doesn\'t work','broken','leak','no hot water',
          'air conditioning'],
  },
  {
    id:'proprete', label:'Problème de propreté', type:'menage', urgence:'haute',
    desc:"Logement sale à l'arrivée, poubelles pleines, draps ou serviettes tachés.",
    heureDefaut:'14:00',
    confirmations:{
      fr:"Bonjour {prenom}, c'est confirmé : une équipe de ménage passera {quand}. Encore désolés pour ce désagrément, et merci de nous l'avoir signalé.",
      en:"Hello {prenom}, it's confirmed: a cleaning team will come {quand}. Again, sorry for the inconvenience, and thank you for letting us know.",
    },
    exemples:[
      "Nous venons d'arriver et la salle de bain n'est pas propre, il y a des cheveux dans la douche.",
      "La cuisine n'a pas été nettoyée et il reste de la poussière partout.",
      "Les draps sales du séjour précédent sont encore sur le lit.",
    ],
    mots:['pas propre','pas très propre','sale','saleté','poubelle est pleine','poubelles pleines','cheveux',
          'poussière','taché','tachés','tachée','draps sales','pas nettoyé','pas été nettoyé','pas été fait',
          'ménage pas fait','moisi','mauvaise odeur','dirty','not clean','stains'],
  },
  {
    id:'consommables', label:'Linge et consommables', type:'linge', urgence:'normale',
    desc:"Serviettes, draps, papier toilette, capsules, produits d'entretien.",
    heureDefaut:'09:00',
    confirmations:{
      fr:"Bonjour {prenom}, c'est noté : le réapprovisionnement vous sera livré {quand}. Bonne journée !",
      en:"Hello {prenom}, all set: your restock will be delivered {quand}. Have a great day!",
    },
    exemples:[
      "Il ne reste plus de papier toilette ni de capsules pour la machine à café.",
      "Serait-il possible d'avoir deux serviettes supplémentaires ?",
      "Il n'y a plus de liquide vaisselle sous l'évier.",
    ],
    mots:['papier toilette','serviette','serviettes','draps','capsule','capsules','savon','shampoing',
          'liquide vaisselle','il ne reste plus','il n\'y a plus','manque de','running out','towels','toilet paper'],
  },
  {
    id:'menage_sejour', label:'Ménage en cours de séjour', type:'menage', urgence:'normale',
    desc:"Séjour long : ménage intermédiaire demandé par le voyageur.",
    heureDefaut:'11:00',
    confirmations:{
      fr:"Bonjour {prenom}, c'est confirmé : le ménage de mi-séjour est programmé {quand}. Merci de laisser l'accès possible à cette heure-là.",
      en:"Hello {prenom}, it's confirmed: your mid-stay cleaning is scheduled {quand}. Please make sure access is possible at that time.",
    },
    exemples:[
      "Nous restons deux semaines, un ménage à mi-séjour est-il possible ?",
      "Pourrait-on avoir un passage de ménage pendant le séjour ? Nous le paierons.",
      "Could we book a mid-stay cleaning for next Wednesday?",
    ],
    mots:['ménage à mi-séjour','ménage mi-séjour','mi-séjour','ménage intermédiaire','ménage pendant le séjour',
          'passage de ménage','un ménage en cours','mid-stay clean','cleaning during'],
  },
];

function getCategorieTache(id) { return VIVI_CATEGORIES_TACHE.find(c => c.id === id) || null; }
function viviModeTache(catId) {
  const m = (VIVI_CONFIG.taches && VIVI_CONFIG.taches.modes) || {};
  return m[catId] || 'valider';
}

/* Un SIGNALEMENT = un message de voyageur qui appelle une intervention.
   C'est l'unité persistée : une fois créé, il survit à la réponse que Vivi
   envoie juste après (sinon la tâche disparaîtrait au moment même où elle
   devient nécessaire).
     statut : ouvert (tâche à valider) | creee | refusee
   Le voyageur n'est prévenu qu'à la création, avec le créneau : pas
   d'accusé de réception préalable, qui l'obligerait à lire deux messages
   pour une seule information. */
const VIVI_SIGNALEMENTS = [];

/* ---------- Détection ---------- */
// Renvoie { categorie, mots } ou null. Le score est le nombre de
// mots-clés distincts trouvés ; à égalité, l'ordre du tableau tranche.
function viviDetecterTache(texte) {
  const t = ' ' + String(texte || '').toLowerCase() + ' ';
  let best = null;
  VIVI_CATEGORIES_TACHE.forEach(cat => {
    const trouves = cat.mots.filter(m => t.includes(m));
    if (!trouves.length) return;
    if (!best || trouves.length > best.mots.length) best = { categorie:cat, mots:trouves };
  });
  return best;
}

// Auto-contrôle : chaque exemple affiché dans la configuration doit être
// réellement classé dans sa catégorie. Renvoie la liste des exemples qui
// ne le sont pas — vide en temps normal.
function viviVerifierExemples() {
  const ecarts = [];
  VIVI_CATEGORIES_TACHE.forEach(cat => {
    (cat.exemples || []).forEach(texte => {
      const d = viviDetecterTache(texte);
      if (!d || d.categorie.id !== cat.id) {
        ecarts.push({ attendu: cat.id, obtenu: d ? d.categorie.id : null, texte });
      }
    });
  });
  return ecarts;
}
// Exemples effectivement reconnus : l'interface n'affiche que ceux-là, pour
// ne jamais promettre une détection qui n'aurait pas lieu.
function viviExemplesVerifies(catId) {
  const cat = getCategorieTache(catId);
  if (!cat) return [];
  return (cat.exemples || []).filter(t => {
    const d = viviDetecterTache(t);
    return d && d.categorie.id === catId;
  });
}

// Index des messages du voyageur restés sans réponse de l'hôte.
function messagesSansReponse(c) {
  let dernierHote = -1;
  c.messages.forEach((m, i) => { if (m.de === 'hote') dernierHote = i; });
  const out = [];
  for (let i = dernierHote + 1; i < c.messages.length; i++) if (c.messages[i].de === 'voyageur') out.push(i);
  return out;
}

/* ---------- Assignation : le prestataire habituel du logement ----------
   On ne devine pas : on lit ce qui existe déjà, dans cet ordre.
     1. une tâche récurrente active du même type sur ce logement
     2. le prestataire le plus souvent intervenu sur ce logement pour ce type
     3. n'importe quelle tâche récurrente active du logement
     4. un prestataire dont le rôle correspond au type de tâche
   Renvoie null si le parc n'a personne : la tâche part alors « à assigner »
   plutôt que d'atterrir chez quelqu'un au hasard. */
function prestataireHabituel(logementId, type) {
  const rc = RECURRENTES.find(r => r.logementId === logementId && r.actif && r.type === type && r.prestataireId);
  if (rc) return rc.prestataireId;

  const compte = {};
  TACHES.filter(t => t.logementId === logementId && t.type === type && t.prestataireId)
        .forEach(t => { compte[t.prestataireId] = (compte[t.prestataireId] || 0) + 1; });
  const top = Object.keys(compte).sort((a, b) => compte[b] - compte[a])[0];
  if (top) return top;

  const rcAny = RECURRENTES.find(r => r.logementId === logementId && r.actif && r.prestataireId);
  if (rcAny) return rcAny.prestataireId;

  const roles = { menage:'Ménage', linge:'Ménage', maintenance:'Maintenance' };
  const p = PRESTATAIRES.find(x => x.role === roles[type]) || PRESTATAIRES.find(x => x.role === 'Polyvalent');
  return p ? p.id : null;
}
function getPrestataire(id) { return PRESTATAIRES.find(p => p.id === id) || null; }

/* Une tâche ne porte plus de montant : la rémunération d'une intervention
   dépend du bien et reste à définir. Rien n'est donc chiffré ici, ni proposé
   à l'écran — plutôt qu'un prix arbitraire qui aurait l'air d'un engagement. */

/* ---------- Date proposée ----------
   Urgent → aujourd'hui, sinon demain ; jamais avant l'arrivée du
   voyageur, et un ménage de mi-séjour tombe au milieu du séjour. */
function _viviDateTache(cat, resa) {
  if (!resa) return AUJOURDHUI;
  if (cat.id === 'menage_sejour') {
    const milieu = Math.max(1, Math.floor(nuitsEntre(resa.arrivee, resa.depart) / 2));
    return addDays(resa.arrivee, milieu);
  }
  const base = cat.urgence === 'haute' ? AUJOURDHUI : addDays(AUJOURDHUI, 1);
  return parseDate(base) < parseDate(resa.arrivee) ? resa.arrivee : base;
}

/* ---------- Construction d'une proposition ---------- */
function _viviProposition(c, msgIndex, detection) {
  const cat = detection.categorie;
  const resa = getReservation(c.reservationId);
  if (!resa) return null;
  const prestataireId = prestataireHabituel(resa.logementId, cat.type);
  return {
    id: `VT-${c.id}-${msgIndex}`,
    conversationId: c.id, msgIndex,
    categorieId: cat.id, categorie: cat,
    extrait: c.messages[msgIndex].texte,
    // La confiance suit le nombre d'indices trouvés dans le message.
    confiance: Math.min(96, 68 + detection.mots.length * 9),
    tache: {
      type: cat.type,
      logementId: resa.logementId,
      reservationId: resa.id,
      date: _viviDateTache(cat, resa),
      heure: cat.heureDefaut,
      prestataireId,
      note: `Signalé par ${resa.voyageur} — ${cat.label.toLowerCase()}`,
    },
  };
}

function getSignalement(convId, msgIndex) {
  return VIVI_SIGNALEMENTS.find(s => s.conversationId === convId && s.msgIndex === msgIndex) || null;
}

// Détection de langue volontairement grossière : elle sert seulement à
// choisir le modèle de réponse. Un vrai modèle ferait mieux.
const _VIVI_MOTS_EN = [' the ', ' is ', ' are ', ' we ', ' our ', ' could ', ' would ', ' please ',
                       ' thank ', ' hello ', ' hi ', ' not ', ' working ', ' room ', ' there '];
function viviLangueMessage(texte) {
  const t = ' ' + String(texte || '').toLowerCase().replace(/[^a-zà-ÿ\s]/g, ' ').replace(/\s+/g, ' ') + ' ';
  return _VIVI_MOTS_EN.filter(m => t.includes(m)).length >= 3 ? 'en' : 'fr';
}

/* ---------- La tâche proposée ----------
   Les propositions sont construites à partir des SIGNALEMENTS ouverts, et
   non des messages restés sans réponse : créer la tâche envoie un message
   au voyageur, ce qui ferait sortir le message d'origine de la liste des
   « sans réponse » et évaporerait la proposition en cours de route. */
function viviTachesProposees(convId) {
  if (!VIVI_CONFIG.taches || !VIVI_CONFIG.taches.actif) return [];
  if (viviNiveauIA() !== 'avancee') return [];
  const out = [];
  VIVI_SIGNALEMENTS.forEach(s => {
    if (s.statut !== 'ouvert') return;
    if (convId && s.conversationId !== convId) return;
    if (viviModeTache(s.categorieId) === 'ignorer') return;
    const c = CONVERSATIONS.find(x => x.id === s.conversationId);
    const cat = getCategorieTache(s.categorieId);
    if (!c || !cat || !c.messages[s.msgIndex]) return;
    const p = _viviProposition(c, s.msgIndex, { categorie: cat, mots: s.mots || [] });
    if (p) out.push(p);
  });
  return out;
}
// Une conversation n'affiche qu'une proposition à la fois : la plus récente.
function viviTacheEnAttente(convId) {
  const l = viviTachesProposees(convId);
  return l.length ? l[l.length - 1] : null;
}
// Signalements d'une conversation, quel que soit leur état.
function viviSignalements(convId) {
  return VIVI_SIGNALEMENTS.filter(s => s.conversationId === convId);
}

/* ---------- Étape 3 : confirmer le créneau au voyageur ----------
   Sans elle, le voyageur reçoit « nous revenons vers vous » et plus rien :
   la promesse de l'étape 1 reste en l'air. Cette confirmation ne passe PAS
   par les garde-fous — elle ne fait que reprendre une date et une heure que
   vous venez vous-même de valider, et c'est votre clic qui l'envoie. */
function quandTache(date, heure, langue) {
  const en = langue === 'en';
  const jour = date === AUJOURDHUI ? (en ? 'today' : "aujourd'hui")
    : date === addDays(AUJOURDHUI, 1) ? (en ? 'tomorrow' : 'demain')
    : en ? `on ${date.split('-').reverse().slice(0, 2).join('/')}`
         : `le ${formatDate(date, { jourSemaine: true, moisLong: true })}`;
  return `${jour} ${en ? 'at' : 'à'} ${heure}`;
}

function viviTexteConfirmation(cat, resa, tache, langue) {
  if (!cat || !cat.confirmations) return '';
  return (cat.confirmations[langue] || cat.confirmations.fr)
    .replace(/{prenom}/g, String(resa.voyageur || '').split(' ')[0])
    .replace(/{quand}/g, quandTache(tache.date, tache.heure, langue));
}

/* ---------- Créer / refuser ----------
   Créer POUSSE réellement la tâche dans TACHES : elle apparaît dans
   la section Ménage et dans le planning du prestataire, exactement
   comme une tâche saisie à la main.
   « prevenir » (vrai par défaut) envoie en plus la confirmation du créneau. */
function viviTacheCreer(propositionId, overrides, auto, prevenir) {
  const [, convId, idx] = propositionId.split('-');
  const msgIndex = Number(idx);
  const s = getSignalement(convId, msgIndex);
  const c = CONVERSATIONS.find(x => x.id === convId);
  const cat = s ? getCategorieTache(s.categorieId) : null;
  if (!s || s.statut !== 'ouvert' || !c || !cat) return null;
  const p = _viviProposition(c, msgIndex, { categorie: cat, mots: s.mots || [] });
  if (!p) return null;

  const t = Object.assign({}, p.tache, overrides || {}, {
    id: 'T' + Date.now() + Math.floor(Math.random() * 100),
    statut: 'a_faire',
    origine: 'vivi',                 // affiché dans la section Ménage
    origineConversation: convId,
  });
  TACHES.push(t);
  s.statut = 'creee';
  s.tacheId = t.id;
  s.auto = !!auto;
  s.quand = AUJOURDHUI;

  if (prevenir !== false) {
    const resa = getReservation(c.reservationId);
    const langue = viviLangueMessage(c.messages[msgIndex].texte);
    const texte = viviTexteConfirmation(cat, resa, t, langue);
    if (texte) {
      c.messages.push({ de: 'hote', texte, heure: "À l'instant" });
      c.horodatage = "À l'instant";
      const conf = {
        id: `VC-${convId}-${msgIndex}`,
        conversationId: convId, msgIndex: c.messages.length - 1,
        statut: 'envoyee', quand: `${AUJOURDHUI} ${t.heure}`,
        langue, confiance: 100, delai: null, approuvee: true,
        reponse: texte, question: c.messages[msgIndex].texte,
        origineTache: cat.id, confirmationCreneau: true, raison: null,
      };
      VIVI_REPONSES.unshift(conf);
      s.confirmationId = conf.id;
    }
  }
  return t;
}
function viviTacheRefuser(propositionId) {
  const [, convId, idx] = propositionId.split('-');
  const s = getSignalement(convId, Number(idx));
  if (!s || s.statut !== 'ouvert') return;
  s.statut = 'refusee';
  s.quand = AUJOURDHUI;
}
// Annuler une création : la tâche disparaît de la section Ménage et la
// proposition redevient disponible. La réponse déjà envoyée au voyageur,
// elle, n'est pas rétractable — on ne touche pas à la conversation.
function viviTacheAnnuler(convId, msgIndex) {
  const s = getSignalement(convId, Number(msgIndex));
  if (!s) return;
  if (s.tacheId) {
    const j = TACHES.findIndex(t => t.id === s.tacheId);
    if (j > -1) TACHES.splice(j, 1);
  }
  s.tacheId = null;
  s.auto = false;
  s.statut = 'ouvert';
}

/* ---------- Le déroulé complet, au chargement ----------
   1. on repère les messages qui appellent une intervention ;
   2. Vivi RÉPOND (envoi auto ou mise en attente selon les garde-fous) ;
   3. la tâche reste à valider — sauf catégorie réglée sur « Créer seule ».

   L'étape 2 poste parfois un message dans la conversation, ce qui change
   la liste des messages « sans réponse » : c'est pourquoi le balayage se
   fait sur un instantané des index, avant toute écriture. */
function _viviTraiterSignalements() {
  if (!VIVI_CONFIG.taches || !VIVI_CONFIG.taches.actif) return;
  if (viviNiveauIA() !== 'avancee') return;

  CONVERSATIONS.forEach(c => {
    messagesSansReponse(c).slice().forEach(i => {
      if (getSignalement(c.id, i)) return;                 // déjà connu
      const det = viviDetecterTache(c.messages[i].texte);
      if (!det) return;
      if (viviModeTache(det.categorie.id) === 'ignorer') return;

      VIVI_SIGNALEMENTS.push({
        id: `VS-${c.id}-${i}`,
        conversationId: c.id, msgIndex: i,
        categorieId: det.categorie.id,
        mots: det.mots,
        statut: 'ouvert', tacheId: null, auto: false,
        quand: AUJOURDHUI,
      });
    });
  });

  // Étape 3 : les catégories que vous avez réglées sur « Créer seule ».
  _viviAppliquerTachesAuto();
}

function _viviAppliquerTachesAuto() {
  viviTachesProposees().forEach(p => {
    if (viviModeTache(p.categorieId) === 'auto') viviTacheCreer(p.id, null, true);
  });
}

// Agrégats du mois affichés dans l'audit. Les totaux mensuels ne sont pas
// dérivables de VIVI_REPONSES, qui ne contient que les dernières réponses :
// on les stocke, et l'audit affiche le détail ligne à ligne à côté.
const VIVI_METRIQUES = {
  mois:'Juillet 2026',
  messagesRecus:1450,
  reponsesGenerees:342,
  autoEnvoyees:298,
  heuresGagnees:28,
  satisfaction:4.6,
};

// Ce que Vivi a mal fait, et où le corriger. Chaque suggestion pointe vers
// la section de configuration concernée pour que l'action soit à un clic.
const VIVI_SUGGESTIONS = [
  { titre:"Code WiFi oublié sur 2 logements", conseil:"Renseignez le WiFi dans le contexte du logement pour que Vivi puisse le donner elle-même.", section:'logements' },
  { titre:"Confusion sur les horaires de check-in", conseil:"Précisez si le check-in est flexible : Vivi promet parfois une arrivée plus tôt.", section:'logements' },
  { titre:"Numéro d'urgence absent de 7 logements", conseil:"Ajoutez le contact urgent : c'est ce que Vivi propose quand elle ne sait pas répondre.", section:'logements' },
];

// FAQ rapide du chat : 3 boutons rotatifs sous la conversation.
const VIVI_FAQ = [
  { q:"Comment ajouter un 2e logement ?",                  intent:'ajouter_logement' },
  { q:"Pourquoi je ne reçois pas les messages Booking ?",  intent:'diagnostic_canal' },
  { q:"Comment configurer l'IA avancée ?",                 intent:'config_ia' },
  { q:"Quels sont mes revenus ce mois-ci ?",               intent:'revenus' },
  { q:"Combien de réponses attendent ma révision ?",       intent:'attente' },
  { q:"Comment fonctionne la facturation ?",               intent:'facturation' },
];

/* ============================================================
   PARAMÈTRES GÉNÉRAUX — localisation & séjour
   (page Paramètres > Général)
   ============================================================ */
/* ============================================================
   CONFORMITÉ DE L'EXPLOITANT

   La carte professionnelle « G » (Gestion immobilière), délivrée par
   la CCI. Elle est obligatoire dès qu'on gère le bien d'autrui contre
   rémunération : sans elle, l'activité de conciergerie est en
   infraction. Son numéro doit figurer sur les mandats, les factures
   et les fiches de police éditées.
   ============================================================ */
const CONFORMITE = {
  carteG: '',        // numéro de carte professionnelle G
  carteGCci: '',     // CCI émettrice
  carteGExpire: '',  // date de fin de validité
};

const PARAMETRES_GENERAUX = {
  // Les données de démonstration sont des biens français tarifés en euros :
  // c'est aussi DEVISE_REF, donc l'app s'ouvre sans conversion.
  devise:'EUR',
  fuseauHoraire:'Europe/Paris',
  formatDate:'dd/MM/yyyy',
  premierJourSemaine:'lundi',
  heureArriveeDefaut:'15:00',
  heureDepartDefaut:'11:00',
  langueVoyageurs:'fr',
  gestionAnnulations:'manuel',
};

/* ============================================================
   Petites fonctions d'accès (lecture seule)
   ============================================================ */
function getLogement(id)   { return LOGEMENTS.find(l => l.id === id); }

/* Chemin de la photo de couverture depuis la page courante.

   Les écrans vivent à deux profondeurs — la racine (site public, page
   voyageur) et app/ ou admin/ — et un chemin écrit en dur dans les
   données casserait de l'autre côté. On le résout donc à l'affichage,
   une fois, plutôt que de recopier « ../ » à chaque appel. */
const OYVIA_RACINE = /\/(app|admin)\//.test(location.pathname) ? '../' : '';
function photoLogement(l) {
  const log = typeof l === 'string' ? getLogement(l) : l;
  return log && log.couverture ? `${OYVIA_RACINE}assets/logements/${log.couverture}` : null;
}

function getVoyageur(id)    { return VOYAGEURS.find(v => v.id === id); }
function getReservation(id) { return RESERVATIONS.find(r => r.id === id); }
function getPrestataire(id) { return PRESTATAIRES.find(p => p.id === id); }
function getConversationByReservation(id) { return CONVERSATIONS.find(c => c.reservationId === id); }
function getProprietaire(id) { return PROPRIETAIRES.find(p => p.id === id); }
function getLogementsByProprietaire(id) { return LOGEMENTS.filter(l => l.proprietaireId === id); }
function getLogementsSansProprietaire() { return LOGEMENTS.filter(l => !l.proprietaireId); }
function getReservationsByLogement(id) { return RESERVATIONS.filter(r => r.logementId === id); }
function getReservationsByVoyageur(id) { return RESERVATIONS.filter(r => r.voyageurId === id); }
function getRecurrentesByLogement(id) { return RECURRENTES.filter(r => r.logementId === id); }

/* ============================================================
   LIEN DE SÉJOUR — l'URL de la page voyageur (guest.html)

   Elle est envoyée au voyageur par l'automatisation J-1 via la
   variable {lien_sejour}, sur le canal de sa réservation.

   Deux précautions, parce que cette page expose le code d'accès
   et le mot de passe Wi-Fi du logement :

     1. Jeton, pas identifiant. Une URL en ?r=R07 serait
        incrémentable : n'importe qui lirait le code de la porte
        du voisin. Le jeton est tiré au hasard, sans lien avec la
        réservation.
     2. Fenêtre de validité. Le lien s'ouvre 7 jours avant
        l'arrivée et se ferme 2 jours après le départ. Un lien
        transmis un jour reste sinon valable indéfiniment.

   Dans un vrai backend le jeton viendrait d'un générateur
   cryptographique ; ici crypto.getRandomValues suffit et illustre
   la même mécanique.
   ============================================================ */
const LIEN_SEJOUR_AVANT = 7;   // jours d'ouverture avant l'arrivée
const LIEN_SEJOUR_APRES = 2;   // jours de validité après le départ

/* ------------------------------------------------------------
   CONTENU DE LA PAGE SÉJOUR

   Ce que le voyageur voit, bloc par bloc. La configuration est
   commune à toutes les automatisations qui envoient le lien : la
   page est unique, seule la date d'envoi change.

   « joursAvantCode » mérite une explication. Le code de porte et le
   Wi-Fi n'apparaissent qu'à N jours de l'arrivée, même si le lien a
   été envoyé plus tôt. Sans ce délai, programmer l'envoi à J-7
   exposerait le code pendant une semaine. 0 = toujours visible.
   ------------------------------------------------------------ */
const BLOCS_PAGE_SEJOUR = [
  { id:'accueil',      label:"Mot d'accueil",           desc:"Message personnalisé, en haut de page." },
  { id:'fiche_police', label:'Fiche de police',         desc:"Obligatoire en France. Le voyageur la remplit en ligne avant d'arriver." },
  { id:'acces',        label:'Accès au logement',       desc:"Code de porte, étage et Wi-Fi." },
  { id:'instructions', label:"Instructions d'arrivée",  desc:"Les étapes, du point de rendez-vous à l'installation." },
  { id:'guide',        label:'Guide de bienvenue',      desc:"Horaires, quartier, équipements, bonnes adresses." },
  { id:'services',     label:'Services additionnels',   desc:"Ce que le voyageur peut réserver en plus : transfert, ménage, petit-déjeuner." },
  { id:'depart',       label:'Consignes de départ',     desc:"Ce qu'il faut faire en partant. Évite le message de dernière minute." },
  { id:'contact',      label:"Contacter l'hôte",        desc:"Bouton de contact direct depuis la page." },
];

// Manières de joindre l'hôte depuis la page. Le canal choisi décide du
// lien réellement posé sur le bouton : un bouton qui ouvre la mauvaise
// application vaut moins qu'un numéro écrit en clair.
const CONTACTS_SEJOUR = {
  message:   { label:'Messagerie Oyvia', aide:"La réponse arrive dans votre messagerie, tous canaux confondus." },
  whatsapp:  { label:'WhatsApp',         aide:'Ouvre une conversation WhatsApp avec le numéro indiqué.' },
  telephone: { label:'Téléphone',        aide:'Lance un appel depuis le téléphone du voyageur.' },
  email:     { label:'E-mail',           aide:'Ouvre un brouillon vers votre adresse.' },
};

/* Textes par défaut de chaque bloc. Ils vivent ici et non dans la page
   voyageur : le titre d'une section est un contenu, pas de la mise en
   page, et l'hôte doit pouvoir écrire « Votre arrivée » là où nous
   proposons « Instructions d'arrivée ».

   `titre` sert d'en-tête de section ; `texte` d'introduction, et pour
   deux blocs (accueil, départ) il EST le contenu. */
const TEXTES_SEJOUR_DEFAUT = {
  accueil:      { titre:'',                          texte:"Nous sommes ravis de vous accueillir. Vous trouverez ici tout ce qu'il faut savoir avant et pendant votre séjour — écrivez-nous si quoi que ce soit vous manque." },
  fiche_police: { titre:'Fiche de police voyageurs', texte:"Conformément à la réglementation, chaque voyageur doit compléter sa fiche individuelle avant l'arrivée. Ces informations sont conservées avec votre réservation et ne sont communiquées qu'aux autorités si la loi l'exige." },
  acces:        { titre:'Accès au logement',         texte:'' },
  instructions: { titre:"Instructions d'arrivée",    texte:'' },
  guide:        { titre:'Le guide de bienvenue',     texte:'' },
  services:     { titre:"Envie d'un extra ?",        texte:'Demandez-nous : nous ajoutons la prestation à votre séjour.' },
  depart:       { titre:'En partant',                texte:"Laissez les clés dans la boîte, fermez les fenêtres et démarrez le lave-vaisselle si vous l'avez utilisé. Le reste, on s'en occupe." },
  contact:      { titre:'Contacter votre hôte',      texte:'' },
};

// Un bloc dont le texte n'a jamais été touché retombe sur le défaut :
// l'hôte n'a rien à écrire pour que la page soit correcte.
function texteBloc(id) {
  const perso = (PAGE_SEJOUR.textes || {})[id] || {};
  const defaut = TEXTES_SEJOUR_DEFAUT[id] || { titre:'', texte:'' };
  return {
    titre: perso.titre !== undefined && perso.titre !== null ? perso.titre : defaut.titre,
    texte: perso.texte !== undefined && perso.texte !== null ? perso.texte : defaut.texte,
  };
}
function texteBlocParDefaut(id) { return TEXTES_SEJOUR_DEFAUT[id] || { titre:'', texte:'' }; }

/* ------------------------------------------------------------
   Éléments internes des sections

   Les étapes d'arrivée et les tuiles du guide étaient écrites en dur
   dans la page voyageur. Les rendre modifiables impose deux choses :
   un stockage (ci-dessous) et des VARIABLES, car ces textes parlent du
   logement — « Composez le code 4712 » n'a de sens que si 4712 se
   recalcule pour chaque bien. Sans variables, l'hôte qui personnalise
   une étape la figerait sur les données d'un seul logement.
   ------------------------------------------------------------ */
const VARIABLES_SEJOUR = [
  { cle:'{logement}',  aide:'Nom du logement' },
  { cle:'{adresse}',   aide:'Adresse complète' },
  { cle:'{rue}',       aide:'Rue seule, sans code postal ni ville' },
  { cle:'{quartier}',  aide:'Quartier' },
  { cle:'{ville}',     aide:'Ville' },
  { cle:'{code}',      aide:"Code d'accès — masqué tant qu'il n'est pas visible" },
  { cle:'{cles}',      aide:'Emplacement des clés' },
  { cle:'{etage}',     aide:'Étage (RDC si rez-de-chaussée)' },
  { cle:'{wifi}',      aide:'Nom du réseau Wi-Fi' },
  { cle:'{wifi_mdp}',  aide:'Mot de passe Wi-Fi' },
  { cle:'{capacite}',  aide:'Nombre de voyageurs' },
  { cle:'{chambres}',  aide:'Nombre de chambres' },
  { cle:'{h_arrivee}', aide:"Heure d'arrivée" },
  { cle:'{h_depart}',  aide:'Heure de départ' },
  { cle:'{voyageur}',  aide:'Prénom du voyageur' },
];

/* Le code d'accès suit la même règle que partout ailleurs : tant que la
   fenêtre d'affichage n'est pas ouverte, il ne sort pas — y compris via
   une variable glissée dans un texte libre. */
function remplirVariablesSejour(texte, ctx) {
  if (!texte) return '';
  const l = ctx.logement || {};
  const acces = l.acces || {};
  const wifi = l.wifi || {};
  const sejour = l.sejour || {};
  const masque = "communiqué avant votre arrivée";
  const valeurs = {
    '{logement}':  l.nom || '',
    '{adresse}':   l.adresse || '',
    '{rue}':       (l.adresse || '').split(',')[0],
    '{quartier}':  l.quartier || '',
    '{ville}':     l.ville || '',
    '{code}':      ctx.codeVisible ? (l.codeAcces || '') : masque,
    '{cles}':      acces.emplacementCles || '',
    '{etage}':     acces.etage === 0 ? 'RDC' : (acces.etage != null ? acces.etage + 'ᵉ' : ''),
    '{wifi}':      wifi.ssid || '',
    '{wifi_mdp}':  ctx.codeVisible ? (wifi.pass || '') : masque,
    '{capacite}':  l.capacite != null ? String(l.capacite) : '',
    '{chambres}':  l.chambres != null ? String(l.chambres) : '',
    '{h_arrivee}': sejour.arrivee || '',
    '{h_depart}':  sejour.depart || '',
    '{voyageur}':  ctx.prenom || '',
  };
  return String(texte).replace(/\{[a-z_]+\}/g, m => (valeurs[m] !== undefined ? valeurs[m] : m));
}

// Pictogrammes proposés pour les tuiles du guide.
const ICONES_SEJOUR = {
  wifi:     { label:'Wi-Fi',      path:'<path d="M5 12.55a11 11 0 0 1 14 0M2 8.5a16 16 0 0 1 20 0M8.5 16.5a6 6 0 0 1 7 0M12 20h.01"/>' },
  horloge:  { label:'Horaire',    path:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>' },
  maison:   { label:'Logement',   path:'<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>' },
  boussole: { label:'Quartier',   path:'<path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zM2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z"/>' },
  epingle:  { label:'Adresse',    path:'<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>' },
  cafe:     { label:'Café',       path:'<path d="M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4zM6 1v3M10 1v3M14 1v3"/>' },
  cle:      { label:'Clés',       path:'<circle cx="8" cy="15" r="4"/><path d="m10.8 12.2 8-8 2 2-2 2 2 2-3 3-2-2-2 2"/>' },
  poubelle: { label:'Déchets',    path:'<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>' },
  info:     { label:'Information',path:'<circle cx="12" cy="12" r="9"/><path d="M12 16v-5M12 8h.01"/>' },
};

/* Informations d'accès. Le Wi-Fi n'y figure plus : entrer dans le
   logement et s'y connecter sont deux besoins distincts, à deux moments
   différents. Le mot de passe vit désormais dans le guide de bienvenue,
   où le voyageur le retrouve une fois installé.

   `large` occupe toute la largeur : une phrase comme « boîte à clés
   noire à droite de la porte » ne tient pas dans une demi-case. */
const ACCES_SEJOUR_DEFAUT = [
  { titre:'Code porte', texte:'{code}' },
  { titre:'Étage',      texte:'{etage}' },
  { titre:'Clés',       texte:'{cles}', large:true },
];

// Étapes d'arrivée par défaut, écrites avec des variables.
const ETAPES_SEJOUR_DEFAUT = [
  { titre:'Rendez-vous au {rue}', texte:'Le quartier {quartier} est facilement accessible.' },
  { titre:'{cles}',               texte:'Composez le code {code} puis récupérez les clés.' },
  { titre:'Installez-vous',       texte:"Le wifi et le guide de bienvenue vous attendent à l'intérieur. Arrivée à partir de {h_arrivee}." },
];

// Tuiles du guide par défaut.
const TUILES_SEJOUR_DEFAUT = [
  // Le mot de passe rejoint le réseau : c'est ici, et non dans le bloc
  // d'accès, qu'on vient chercher de quoi se connecter.
  { icone:'wifi',     titre:'Wifi',      texte:'{wifi} · {wifi_mdp}' },
  { icone:'horloge',  titre:'Départ',    texte:'Avant {h_depart} le jour du départ' },
  { icone:'maison',   titre:'Sur place', texte:'{capacite} voyageurs · {chambres} ch.' },
  { icone:'boussole', titre:'Quartier',  texte:'{quartier}, {ville}' },
  { icone:'epingle',  titre:'Adresse',   texte:'{adresse}' },
  { icone:'cafe',     titre:'Petit-déj', texte:'Café & thé offerts en cuisine' },
];

// Les listes personnalisées remplacent les défauts en bloc : une liste
// vide est un choix (« je ne veux pas d'étapes »), pas un oubli.
function accesSejour() { return Array.isArray(PAGE_SEJOUR.acces) ? PAGE_SEJOUR.acces : ACCES_SEJOUR_DEFAUT; }
function etapesSejour() { return Array.isArray(PAGE_SEJOUR.etapes) ? PAGE_SEJOUR.etapes : ETAPES_SEJOUR_DEFAUT; }
function tuilesSejour() { return Array.isArray(PAGE_SEJOUR.tuiles) ? PAGE_SEJOUR.tuiles : TUILES_SEJOUR_DEFAUT; }

const PAGE_SEJOUR = {
  blocs: ['accueil', 'fiche_police', 'acces', 'instructions', 'guide', 'services', 'depart', 'contact'],
  joursAvantCode: 1,
  /* Textes par bloc, vides au départ : chaque champ non renseigné suit
     TEXTES_SEJOUR_DEFAUT. On ne recopie pas les défauts ici, sinon une
     reformulation de notre part ne parviendrait jamais aux hôtes qui
     n'ont rien personnalisé. */
  textes: {},
  // null tant que l'hôte n'a rien changé : il suit alors nos listes de
  // référence, mises à jour avec le produit.
  acces: null,
  etapes: null,
  tuiles: null,
  // Identité affichée au voyageur. Le logo Oyvia n'a rien à faire en
  // tête d'une page qui représente l'hôte : c'est son nom qui rassure.
  enseigne: 'Conciergerie Lumia',
  signature: "Camille, votre hôte",
  couleur: '#5B6BF5',
  contact: { canal: 'message', numero: '+33 6 12 45 78 90', email: 'camille@conciergerie-lumia.fr' },
};

function blocPageSejourActif(id) { return PAGE_SEJOUR.blocs.includes(id); }

/* Page séjour enregistrée avant que chaque bloc ait son titre et son
   texte. Le mot d'accueil et les consignes de départ vivaient dans deux
   champs à part ; on les verse dans `textes` pour ne pas faire perdre à
   l'hôte ce qu'il avait écrit. Les blocs ajoutés depuis (services,
   départ) manquent aussi de la liste : on les ajoute à la fin plutôt
   qu'en tête, l'ordre existant étant un choix de l'utilisateur. */
function _migrerPageSejour() {
  if (!PAGE_SEJOUR.textes || typeof PAGE_SEJOUR.textes !== 'object') PAGE_SEJOUR.textes = {};
  const reprendre = (champ, bloc) => {
    if (!PAGE_SEJOUR[champ]) return;
    PAGE_SEJOUR.textes[bloc] = { ...(PAGE_SEJOUR.textes[bloc] || {}), texte: PAGE_SEJOUR[champ] };
    delete PAGE_SEJOUR[champ];
  };
  reprendre('messageAccueil', 'accueil');
  reprendre('consignesDepart', 'depart');

  if (!Array.isArray(PAGE_SEJOUR.blocs)) PAGE_SEJOUR.blocs = BLOCS_PAGE_SEJOUR.map(b => b.id);
  // Un identifiant disparu du catalogue ne doit pas rester dans l'ordre :
  // il ferait un trou silencieux dans le rendu.
  PAGE_SEJOUR.blocs = PAGE_SEJOUR.blocs.filter(id => BLOCS_PAGE_SEJOUR.some(b => b.id === id));
}

/* Ordre d'affichage réel : la liste `blocs` fait foi, y compris pour la
   position. Les blocs absents sont simplement désactivés. */
function blocsPageSejourOrdonnes() {
  return PAGE_SEJOUR.blocs.map(id => BLOCS_PAGE_SEJOUR.find(b => b.id === id)).filter(Boolean);
}

/* Liste affichée dans l'écran de réglage : les blocs actifs dans leur
   ordre, suivis des inactifs. Un bloc décoché garde sa place dans la
   liste des réglages, pas dans la page. */
function blocsPageSejourTous() {
  const actifs = blocsPageSejourOrdonnes();
  const restants = BLOCS_PAGE_SEJOUR.filter(b => !PAGE_SEJOUR.blocs.includes(b.id));
  return [...actifs, ...restants];
}

/* Lien du bouton de contact, selon le canal choisi. Renvoie null pour la
   messagerie interne : il n'y a pas d'URL à ouvrir, la page poste le
   message elle-même. */
function lienContactSejour() {
  const c = PAGE_SEJOUR.contact || {};
  const num = String(c.numero || '').replace(/[^0-9+]/g, '');
  if (c.canal === 'whatsapp')  return num ? `https://wa.me/${num.replace(/^\+/, '')}` : null;
  if (c.canal === 'telephone') return num ? `tel:${num}` : null;
  if (c.canal === 'email')     return c.email ? `mailto:${c.email}` : null;
  return null;
}

/* Services proposés au voyageur sur sa page séjour : ceux qui sont
   actifs ET qui couvrent son logement. Filtrer ici plutôt que dans la
   page évite d'afficher un transfert aéroport sur un bien où il n'a
   jamais été paramétré. */
function servicesPageSejour(logementId) {
  if (typeof SERVICES === 'undefined') return [];
  return SERVICES.filter(s => s.actif && serviceCouvreLogement(s, logementId));
}

// Les informations sensibles sont-elles déjà visibles pour cette réservation ?
function codeAccesVisible(r, aujourdhui = AUJOURDHUI) {
  const seuil = PAGE_SEJOUR.joursAvantCode || 0;
  if (!seuil) return true;
  return Math.round((parseDate(r.arrivee) - parseDate(aujourdhui)) / 86400000) <= seuil;
}

function nouveauTokenSejour() {
  const buf = new Uint8Array(16);
  (self.crypto || {}).getRandomValues
    ? self.crypto.getRandomValues(buf)
    : buf.forEach((_, i) => { buf[i] = Math.floor(Math.random() * 256); });
  return Array.from(buf, b => b.toString(16).padStart(2, '0')).join('');
}

// Les réservations de démo n'ont pas de jeton en dur : on en attribue un au
// premier chargement, puis il est persisté avec le reste de l'état.
function _assurerTokensSejour() {
  RESERVATIONS.forEach(r => { if (!r.token) r.token = nouveauTokenSejour(); });
}

function getReservationParToken(token) {
  return token ? RESERVATIONS.find(r => r.token === token) : null;
}

// URL relative de la page voyageur, pour la navigation interne
// (« Prévisualiser »). « depuisApp » car les écrans de l'application vivent
// dans /app/ et doivent remonter d'un cran.
function lienSejour(r, depuisApp = false) {
  return `${depuisApp ? '../' : ''}guest.html?s=${r.token}`;
}
// URL absolue, pour tout ce qui SORT de l'app : messages aux voyageurs,
// automatisations, presse-papiers. Un lien relatif y serait inexploitable.
function lienSejourAbsolu(r, depuisApp = false) {
  return new URL(lienSejour(r, depuisApp), location.href).href;
}

// Le lien est-il ouvert aujourd'hui ? Renvoie aussi le motif, pour que la
// page voyageur explique la fermeture au lieu d'afficher une erreur brute.
function lienSejourStatut(r, aujourdhui = AUJOURDHUI) {
  const j = Math.round((parseDate(r.arrivee) - parseDate(aujourdhui)) / 86400000);
  const jFin = Math.round((parseDate(aujourdhui) - parseDate(r.depart)) / 86400000);
  if (j > LIEN_SEJOUR_AVANT) return { actif:false, motif:'trop_tot', jours:j - LIEN_SEJOUR_AVANT };
  if (jFin > LIEN_SEJOUR_APRES) return { actif:false, motif:'expire' };
  return { actif:true, motif:null };
}

/* ============================================================
   FICHES DE POLICE — une fiche par voyageur de la réservation.
   Pas de backend : conservées dans localStorage (clé unique par
   réservation) pour survivre à la navigation entre la page voyageur
   publique (guest.html) et l'app hôte (qui chargent data.js séparément).
   ============================================================ */
const FICHES_POLICE_KEY = 'oyvia_fiches_police';
const TYPE_PIECE_LABEL = { cni: 'Carte nationale d\'identité', passeport: 'Passeport', titre_sejour: 'Titre de séjour' };

function _lireFichesPolice() {
  try { return JSON.parse(localStorage.getItem(FICHES_POLICE_KEY)) || {}; }
  catch { return {}; }
}
function _ecrireFichesPolice(all) {
  localStorage.setItem(FICHES_POLICE_KEY, JSON.stringify(all));
}
// Retourne un tableau (index = n° voyageur), les cases vides valent undefined.
function getFichesPolice(reservationId) {
  const all = _lireFichesPolice();
  return all[reservationId] ? [...all[reservationId]] : [];
}
function saveFichePolice(reservationId, index, data) {
  const all = _lireFichesPolice();
  const list = all[reservationId] ? [...all[reservationId]] : [];
  list[index] = { ...data, soumisLe: new Date().toISOString() };
  all[reservationId] = list;
  _ecrireFichesPolice(all);
  return list;
}

// Libellés lisibles
// Les 4 premiers sont des canaux de réservation ; « whatsapp » et « email »
// n'existent que côté messagerie (une conversation, mais pas de réservation).
const CANAL_LABEL = { airbnb:'Airbnb', booking:'Booking.com', direct:'Direct', bloque:'Blocage', whatsapp:'WhatsApp', email:'E-mail' };
const PAIEMENT_LABEL = { paye:'Payé', acompte:'Acompte', impaye:'Impayé', rembourse:'Remboursé' };
// « demande » : une réservation venue du site en mode « à valider ». Elle
// existe bel et bien dans le calendrier — sinon on la revendrait ailleurs —
// mais elle attend votre accord, d'où un statut distinct de « confirmée ».
const STATUT_LABEL = { demande:'Demande à valider', confirme:'Confirmée', en_cours:'En cours', termine:'Terminée', annule:'Annulée' };

/* ============================================================
   NOTIFICATIONS — alertes recalculées à la volée (pas de serveur,
   pas de file d'attente : à chaque ouverture du centre de notifications
   on relit RESERVATIONS + les fiches de police + les paiements et on
   reconstruit la liste). Deux familles couvertes pour l'instant :
     - fiches de police incomplètes à l'approche de l'arrivée
     - solde non encaissé à l'approche de l'arrivée
   ============================================================ */
function joursAvantArrivee(dateStr) {
  return Math.round((parseDate(dateStr) - parseDate(AUJOURDHUI)) / 86400000);
}
function libelleEcheance(j) {
  if (j === 0) return 'arrivée aujourd\'hui';
  if (j === 1) return 'arrivée demain';
  return `arrivée dans ${j} jours`;
}
function getNotifications() {
  const notifs = [];
  RESERVATIONS.forEach(r => {
    if (r.canal === 'bloque') return;
    const j = joursAvantArrivee(r.arrivee);
    if (j < 0 || j > 3) return; // on ne remonte que les arrivées imminentes (J à J+3)

    // --- Fiches de police incomplètes ---
    const total = r.pers || 1;
    const done = getFichesPolice(r.id).filter(Boolean).length;
    if (done < total) {
      const urgent = j <= 1;
      notifs.push({
        id: `police-${r.id}`,
        type: 'police',
        urgence: urgent ? 'high' : 'medium',
        titre: urgent ? 'Fiches de police incomplètes' : 'Fiches de police à compléter',
        message: `${r.voyageur} · ${done}/${total} fiche${total > 1 ? 's' : ''} complétée${total > 1 ? 's' : ''} · ${libelleEcheance(j)}`,
        resaId: r.id,
      });
    }

    // --- Paiement non soldé ---
    if (r.paiement === 'impaye' && j <= 3) {
      notifs.push({
        id: `paiement-${r.id}`,
        type: 'paiement',
        urgence: 'high',
        titre: 'Paiement en attente — action requise',
        message: `${r.voyageur} · ${PAIEMENT_LABEL[r.paiement]} · ${libelleEcheance(j)}`,
        resaId: r.id,
      });
    } else if (r.paiement === 'acompte' && j <= 1) {
      notifs.push({
        id: `paiement-${r.id}`,
        type: 'paiement',
        urgence: 'medium',
        titre: 'Solde à encaisser avant l’arrivée',
        message: `${r.voyageur} · ${PAIEMENT_LABEL[r.paiement]} · ${libelleEcheance(j)}`,
        resaId: r.id,
      });
    }
  });

  // --- Réponses de Vivi qui attendent votre validation ---
  // Une escalade est plus urgente qu'une simple confiance insuffisante :
  // le voyageur a écrit quelque chose que l'IA a refusé de traiter seule.
  viviReponsesEnAttente().forEach(r => {
    const ctx = viviContexte(r);
    if (!ctx.reservation) return;
    notifs.push({
      id: `vivi-${r.id}`,
      type: 'vivi',
      urgence: r.statut === 'escaladee' ? 'high' : 'medium',
      titre: r.statut === 'escaladee' ? 'Vivi a escaladé un message' : 'Réponse de Vivi à valider',
      message: `${ctx.voyageur} · ${r.raison}`,
      resaId: ctx.reservation.id,
      // Ces alertes se traitent dans la conversation, pas dans la fiche résa.
      href: `messagerie.html?conv=${r.conversationId}`,
    });
  });

  // --- Tâches déduites d'un message qui attendent votre validation ---
  // Même traitement que les réponses : elles vivent dans la conversation et
  // relèvent du même geste. Les omettre ici laisserait le centre de
  // notifications en retard sur le compteur « IA - À valider ».
  if (typeof viviTachesProposees === 'function') {
    viviTachesProposees().forEach(p => {
      const conv = CONVERSATIONS.find(c => c.id === p.conversationId);
      const resa = conv ? getReservation(conv.reservationId) : null;
      if (!resa) return;
      const l = getLogement(p.tache.logementId);
      notifs.push({
        id: `vivi-tache-${p.id}`,
        type: 'vivi',
        urgence: p.categorie.urgence === 'haute' ? 'high' : 'medium',
        titre: `Tâche proposée par Vivi · ${p.categorie.label}`,
        message: `${resa.voyageur}${l ? ' · ' + l.nom : ''}`,
        resaId: resa.id,
        href: `messagerie.html?conv=${p.conversationId}`,
      });
    });
  }

  /* --- Réponse du propriétaire à une demande de gestion ---
     La conciergerie a candidaté sur la marketplace ; le propriétaire a
     tranché. Sans cette alerte, elle ne l'apprendrait qu'en repassant
     d'elle-même sur « Mes prospects » — c'est-à-dire trop tard pour
     redéposer une candidature ailleurs, ou trop tard pour se préparer à
     prendre le bien. */
  if (typeof mpDecisionsNonLues === 'function') {
    mpDecisionsNonLues().forEach(d => {
      const b = mpBien(d.bienId);
      const retenue = d.statut === 'acceptee';
      notifs.push({
        id: `mandat-${d.id}`,
        type: 'mandat',
        urgence: retenue ? 'high' : 'medium',
        titre: retenue ? 'Mandat obtenu' : 'Le propriétaire a choisi une autre conciergerie',
        message: b ? `${b.type} · ${b.ville} — ${b.quartier}` : 'Bien retiré de la marketplace',
        href: `prospects.html?demande=${d.id}`,
      });
    });
  }

  /* Urgentes d'abord, puis par proximité d'arrivée. Toutes les alertes
     ne portent pas sur un séjour : celles qui n'ont pas de réservation
     (une réponse de la marketplace) passent après, sans quoi le tri
     irait chercher une date qui n'existe pas. */
  const echeance = n => {
    const r = n.resaId ? getReservation(n.resaId) : null;
    return r ? joursAvantArrivee(r.arrivee) : Infinity;
  };
  return notifs.sort((a, b) => {
    if (a.urgence !== b.urgence) return a.urgence === 'high' ? -1 : 1;
    return echeance(a) - echeance(b);
  });
}
const TACHE_LABEL = { menage:'Ménage', checkin:'Check-in', maintenance:'Maintenance', linge:'Linge' };
/* ------------------------------------------------------------
   PLANIFICATION DES AUTOMATISATIONS

   Une automatisation se programme en trois morceaux, comme chez
   Hospitable ou Smartbnb :
     declencheur — l'événement de référence
     jours       — le décalage, pour les déclencheurs « décalables »
     heure       — l'heure d'envoi ce jour-là

   L'heure est indispensable : « J-1 » sans heure ne dit pas si le
   message part à 8 h ou à 23 h, alors qu'un voyageur qui reçoit ses
   instructions d'arrivée en pleine nuit ne les lira pas.
   ------------------------------------------------------------ */
const DECLENCHEURS = [
  { id:'reservation',   label:'À la réservation',      decalable:false, immediat:true },
  { id:'avant_arrivee', label:"Avant l'arrivée",       decalable:true  },
  { id:'jour_arrivee',  label:"Le jour de l'arrivée",  decalable:false },
  { id:'jour_depart',   label:'Le jour du départ',     decalable:false },
  { id:'apres_depart',  label:'Après le départ',       decalable:true  },
];

// Anciens identifiants figés → nouveau couple (déclencheur, décalage).
// Conservé pour que les automatisations déjà enregistrées en localStorage
// continuent de fonctionner sans réinitialisation.
const _DECLENCHEURS_LEGACY = {
  j_moins_1: { declencheur:'avant_arrivee', jours:1 },
  j_plus_1:  { declencheur:'apres_depart',  jours:1 },
  j_plus_3:  { declencheur:'apres_depart',  jours:3 },
};
function _migrerDeclencheurs() {
  AUTOMATISATIONS.forEach(a => {
    const m = _DECLENCHEURS_LEGACY[a.declencheur];
    if (m) { a.declencheur = m.declencheur; a.jours = m.jours; }
    if (a.jours == null) a.jours = 0;
    if (!a.heure) a.heure = '10:00';
  });
}

function getDeclencheur(id) { return DECLENCHEURS.find(d => d.id === id) || DECLENCHEURS[0]; }

// « 1 jour avant l'arrivée, à 10:00 » — la phrase complète, pour qu'on ne
// relise jamais un « J-1 » dont on ignore l'heure.
function libelleDeclencheur(a) {
  const d = getDeclencheur(a.declencheur);
  if (d.immediat) return 'Dès la réservation';
  const quand = d.decalable
    ? `${a.jours} jour${a.jours > 1 ? 's' : ''} ${a.declencheur === 'avant_arrivee' ? "avant l'arrivée" : 'après le départ'}`
    : d.label.replace(/^Le /, '');
  return `${quand.charAt(0).toUpperCase()}${quand.slice(1)}, à ${a.heure}`;
}
// Version courte, pour les badges de la liste.
function libelleDeclencheurCourt(a) {
  const d = getDeclencheur(a.declencheur);
  if (d.immediat) return 'À la réservation';
  if (!d.decalable) return d.label;
  return a.declencheur === 'avant_arrivee' ? `J-${a.jours}` : `J+${a.jours}`;
}

/* ============================================================
   PERSISTANCE LOCALE (localStorage) — c'est un mockup sans backend :
   toutes les données ci-dessus ne sont que des valeurs de démarrage,
   qui se réinitialiseraient sinon à chaque rechargement. On restaure
   ici l'état sauvegardé (s'il existe) EN PLACE dans les mêmes tableaux
   et objets, avant que les autres scripts de la page ne les lisent,
   puis on sauvegarde automatiquement à chaque action.
   Ça marche pareil une fois hébergé sur GitHub Pages : localStorage
   est propre à chaque navigateur/appareil sur le domaine du site
   (pas de synchronisation entre appareils ni de vraie base de données,
   mais les actions d'un même visiteur survivent aux rechargements et
   aux visites suivantes, tant qu'il ne vide pas les données du site).
   ============================================================ */
// La version fait partie de la clé : un ancien instantané écrirait par-dessus
// le nouveau schéma logement (equipements passés de libellés à identifiants,
// canaux passés d'une chaîne à un objet) et casserait la fiche détail.
// Changer de clé invalide proprement le stockage précédent.
const OYVIA_STATE_KEY = 'oyvia_state_v2';

// Entités mutables à sauvegarder/restaurer. Les données purement
// statiques (STATS, PLANS, HISTORIQUE_FACTURATION…) ne
// sont jamais modifiées depuis l'UI et n'ont pas besoin d'être stockées.
const _OYVIA_ENTITIES = {
  LOGEMENTS, RESERVATIONS, VOYAGEURS, CONVERSATIONS, TACHES,
  PRESTATAIRES, AUTOMATISATIONS, RECURRENTES, PLATEFORMES,
  COMPTE, UTILISATEUR, PARAMETRES_GENERAUX, CONFORMITE, TACHE_LABEL,
  PROPRIETAIRES, DEPENSES, FACTURES,
  ROLES, UTILISATEURS, ROLES_PRESTATAIRE,
  ALERTES, FICHES_POLICE, SERVICES,
  VIVI_CONFIG, VIVI_REPONSES, VIVI_SIGNALEMENTS, PAGE_SEJOUR, SITE_WEB,
  TARIF_DYNAMIQUE, TD_OVERRIDES, TD_JOURNAL,
  AVIS, EVALUATIONS,
};

/* Identifiants supprimés depuis l'interface, par entité.

   Sans cette liste, « Supprimer » ne supprimerait rien de durable : la
   restauration repart des tableaux définis plus haut dans ce fichier et ne
   fait que superposer l'instantané. Un élément de démonstration effacé
   réapparaîtrait donc au rechargement suivant. On mémorise donc aussi ce
   qui a été retiré, pas seulement ce qui reste. */
const OYVIA_SUPPRIMES = {};

// Retire l'élément du tableau ET note sa disparition. Renvoie false si
// l'identifiant n'existe pas, pour que l'appelant ne mente pas à l'écran.
function supprimerEntite(nom, id) {
  const ref = _OYVIA_ENTITIES[nom];
  if (!Array.isArray(ref)) return false;
  const i = ref.findIndex(x => x && x.id === id);
  if (i < 0) return false;
  ref.splice(i, 1);
  const liste = OYVIA_SUPPRIMES[nom] = OYVIA_SUPPRIMES[nom] || [];
  if (!liste.includes(id)) liste.push(id);
  if (typeof saveOyviaState === 'function') saveOyviaState();
  return true;
}

// Supprimer une tâche née d'un signalement Vivi doit rendre la main à Vivi :
// sinon le signalement resterait « créée » en pointant une tâche disparue, et
// l'intervention ne serait jamais reproposée.
function supprimerTache(id) {
  const s = VIVI_SIGNALEMENTS.find(x => x.tacheId === id);
  if (s) { s.tacheId = null; s.auto = false; s.statut = 'ouvert'; }
  return supprimerEntite('TACHES', id);
}

/* La restauration fusionne les logements à plat (`Object.assign`). Sur les
   champs de premier niveau, l'instantané ne peut qu'écraser une valeur par une
   autre — sans dégât. Sur un SOUS-OBJET, en revanche, il remplace l'objet
   entier : un `acces` enregistré avant l'éclatement en trois modes efface donc
   `serrure`, `boiteCles` et `personne` de la fiche fraîche. La fiche détail
   plantait alors au rendu, et le clic sur la carte ne faisait plus rien.

   Vider le cache HTTP n'y change rien — l'instantané est dans localStorage.
   On répare donc l'accès ici, après restauration, comme pour les autres
   migrations de ce fichier. */
/* Les tâches ne portent plus de montant. Un instantané enregistré avant ce
   changement en contient encore, et la restauration (Object.assign) le
   réinjecterait à chaque chargement : le champ ressusciterait indéfiniment
   dans l'état sauvegardé, alors que plus rien ne l'affiche ni ne le tient à
   jour. On le retire donc explicitement. */
function _migrerTachesSansMontant() {
  TACHES.forEach(t => { if (t && 'montant' in t) delete t.montant; });
  PRESTATAIRES.forEach(p => { if (p && 'tarifMenage' in p) delete p.tarifMenage; });
}

/* Réglages de tarification enregistrés avant l'arrivée du choix de moteur et
   des cinq familles de règles. La restauration écrase TARIF_DYNAMIQUE avec
   l'instantané : sans réparation, `occupation`, `duree` et `delai` seraient
   absents et le moteur planterait au premier calcul de prix. */
function _migrerTarification() {
  const T = TARIF_DYNAMIQUE, D = _TD_DEFAUTS;
  /* Attention au sens de la restauration : elle procède par Object.assign,
     donc une clé ABSENTE de l'instantané laisse la valeur d'usine en place.
     Après restauration, `occupation` existe donc toujours — tester son
     absence ne détecterait jamais un ancien état. Ce sont les ANCIENNES clés
     (`tension`, `derniereMinute`) qui signalent un instantané à migrer. */
  if (!T.occupation) T.occupation = JSON.parse(JSON.stringify(D.occupation));
  if (!T.delai)      T.delai      = JSON.parse(JSON.stringify(D.delai));
  if (!T.duree)      T.duree      = JSON.parse(JSON.stringify(D.duree));

  // L'ancienne règle « tension » mesurait la même idée — le remplissage —
  // mais sur le calendrier d'un seul logement. On reprend ses pourcentages
  // plutôt que d'imposer les valeurs d'usine : c'était un réglage de l'hôte.
  if (T.tension && Array.isArray(T.tension.paliers)) {
    T.occupation.actif = T.tension.actif !== false;
    T.tension.paliers.forEach((p, i) => { if (T.occupation.paliers[i]) T.occupation.paliers[i].pct = p.pct; });
    if (T.tension.horizonUtile) T.occupation.horizonUtile = T.tension.horizonUtile;
  }
  if (T.derniereMinute) T.delai.actif = T.derniereMinute.actif !== false;

  // Un compte qui avait déjà branché une plateforme garde son moteur.
  if (!T.moteur) {
    const externe = MOTEURS_TARIFICATION.find(m => m.externe && (PLATEFORMES.find(p => p.id === m.id) || {}).connecte);
    T.moteur = externe ? externe.id : null;
  }

  delete T.tension;
  delete T.derniereMinute;
}

/* La conformité s'est réduite à la seule carte professionnelle. Les clés des
   autres mentions survivraient dans l'instantané sans que rien ne les lise. */
/* Les fiches de police n'ont plus que deux statuts. Un instantané enregistré
   avant garde « a_remplir » ou « transmise », que plus aucun libellé ne sait
   afficher — la colonne Statut serait vide. On les ramène sur les deux
   statuts subsistants, et on retire la date de transmission devenue sans objet. */
function _migrerFichesPolice() {
  const REMPLACES = { a_remplir: 'en_attente', transmise: 'complete' };
  FICHES_POLICE.forEach(f => {
    if (REMPLACES[f.statut]) f.statut = REMPLACES[f.statut];
    if (!POLICE_STATUTS[f.statut]) f.statut = 'en_attente';
    delete f.transmiseLe;
  });
}

function _migrerConformite() {
  ['garantieFinanciere', 'garantieMontant', 'rcPro', 'rcProNumero', 'siret', 'tvaIntra', 'mediateur']
    .forEach(k => { delete CONFORMITE[k]; });
}

function _migrerAcces() {
  // Les modes retirés du référentiel se ramènent à celui qui leur ressemble.
  const REMPLACES = { digicode: 'boite_cles', accueil: 'personne', concierge: 'personne' };
  const D = DEFAUTS_LOGEMENT.acces;
  LOGEMENTS.forEach(l => {
    const a = l.acces || {};
    l.acces = {
      ...D, ...a,
      type: REMPLACES[a.type] || a.type || D.type,
      serrure:   { ...D.serrure,   ...(a.serrure   || {}) },
      boiteCles: { ...D.boiteCles, ...(a.boiteCles || {}) },
      personne:  { ...D.personne,  ...(a.personne  || {}) },
    };
    // Même logique pour les canaux : un instantané d'avant l'ajout de la mise
    // en pause n'a pas de `actif`, et un canal branché synchronise par défaut.
    Object.values(l.canaux || {}).forEach(c => { if (c && c.actif === undefined) c.actif = true; });
  });
}

// Instantané lu une seule fois au chargement, puis conservé : les modules
// chargés APRÈS ce fichier (le back-office, par exemple) déclarent leurs
// entités trop tard pour la restauration ci-dessous et doivent pouvoir
// rejouer la même fusion sur le même instantané.
let _oyviaSnapshot = null;
function _oyviaLireInstantane() {
  try { return JSON.parse(localStorage.getItem(OYVIA_STATE_KEY)); } catch { return null; }
}

/* Fusion d'un instantané dans un jeu d'entités vivantes. Extraite de la
   restauration pour être réutilisable telle quelle par les modules
   optionnels — dupliquer cette logique, c'est se garantir deux
   comportements divergents à la première correction. */
function _oyviaFusionner(entites, saved) {
  if (!saved) return;
  Object.keys(entites).forEach(name => {
    const ref = entites[name];
    const data = saved[name];
    if (data === undefined || data === null) return;
    if (Array.isArray(ref)) {
      // Fusion par id plutôt que remplacement intégral : les objets « frais »
      // définis ci-dessus dans ce fichier servent de base (ils contiennent
      // les derniers champs ajoutés par le code), et on ne superpose que
      // les valeurs sauvegardées par-dessus. Ça évite qu'un ancien
      // instantané localStorage (enregistré avant l'ajout d'un nouveau
      // champ) n'efface silencieusement ce nouveau champ après une mise à
      // jour de l'app. Les entrées créées par l'utilisateur (sans
      // équivalent « frais », ex. une tâche ou une dépense ajoutée depuis
      // l'UI) sont simplement ajoutées telles quelles.
      const savedById = new Map(data.filter(x => x && x.id != null).map(x => [x.id, x]));
      ref.forEach(item => {
        if (item && item.id != null && savedById.has(item.id)) {
          Object.assign(item, savedById.get(item.id));
          savedById.delete(item.id);
        }
      });
      savedById.forEach(extra => ref.push(extra));
    } else if (ref && typeof ref === 'object') {
      Object.assign(ref, data);
    }
  });
}

/* Déclaration tardive d'entités, pour les fichiers chargés après data.js
   (js/admin-data.js). Le module fournit ses tableaux « frais » ; on leur
   applique les suppressions puis l'instantané, exactement comme aux
   entités du socle, et on les inscrit dans la carte de sauvegarde pour
   que saveOyviaState() les emporte désormais. */
function enregistrerEntitesOyvia(entites, migration) {
  Object.keys(entites).forEach(nom => {
    _OYVIA_ENTITIES[nom] = entites[nom];
    const ref = entites[nom];
    const morts = new Set(OYVIA_SUPPRIMES[nom] || []);
    if (Array.isArray(ref) && morts.size) {
      for (let i = ref.length - 1; i >= 0; i--) if (ref[i] && morts.has(ref[i].id)) ref.splice(i, 1);
    }
  });
  _oyviaFusionner(entites, _oyviaSnapshot);
  if (typeof migration === 'function') migration();
}

(function _oyviaRestoreState() {
  _oyviaSnapshot = _oyviaLireInstantane();
  const saved = _oyviaSnapshot;
  if (!saved) return;

  // Les suppressions s'appliquent AVANT la fusion : on retire des tableaux
  // « frais » ce qui a été effacé, faute de quoi la fusion le réintroduirait.
  Object.assign(OYVIA_SUPPRIMES, saved.__supprimes || {});
  Object.keys(OYVIA_SUPPRIMES).forEach(nom => {
    const ref = _OYVIA_ENTITIES[nom];
    if (!Array.isArray(ref)) return;
    const morts = new Set(OYVIA_SUPPRIMES[nom] || []);
    for (let i = ref.length - 1; i >= 0; i--) if (ref[i] && morts.has(ref[i].id)) ref.splice(i, 1);
  });

  _oyviaFusionner(_OYVIA_ENTITIES, saved);
})();

// Après restauration : toute réservation sans jeton de séjour en reçoit un.
// Placé ici pour couvrir aussi bien le premier chargement que les
// réservations créées avant l'ajout de cette fonctionnalité.
_assurerTokensSejour();
// Automatisations enregistrées avant l'ajout de l'heure d'envoi : on les
// complète plutôt que d'exiger une réinitialisation.
_migrerDeclencheurs();
// Contrats propriétaires enregistrés sous l'ancien champ modeFacturation,
// qui mélangeait « qui encaisse » et « comment on est rémunéré ».
_migrerFacturation();
// Accès enregistrés avant l'éclatement en trois modes (serrure / boîte /
// personne). Voir la fonction pour le détail : c'est la restauration
// elle-même qui abîme ces fiches, il faut donc les réparer juste après.
_migrerAcces();
// Tarification enregistrée avant le choix de moteur et les 5 familles de règles.
_migrerTarification();
// Tâches et prestataires enregistrés avant le retrait de la notion de prix.
_migrerTachesSansMontant();
// Conformité enregistrée avant sa réduction à la carte professionnelle.
_migrerConformite();
// Fiches de police enregistrées avec les quatre anciens statuts.
_migrerFichesPolice();
// Page séjour enregistrée avant les textes par bloc et leur ordre.
_migrerPageSejour();
// Déroulé complet sur les messages qui signalent un besoin d'intervention :
// Vivi répond, puis prépare la tâche. Appelé APRÈS la restauration, pour que
// les signalements déjà traités soient connus — un rechargement ne renvoie
// pas un second message au voyageur et ne recrée pas une tâche annulée.
_viviTraiterSignalements();

let _oyviaResetting = false;

/* Un aperçu ne doit RIEN écrire.

   La page séjour s'affiche dans un cadre depuis l'écran « Fiche séjour »,
   et partage le même stockage local que l'application. Or data.js arme
   une sauvegarde automatique dans chaque document : le cadre réécrivait
   donc l'état complet avec sa propre copie, prise au chargement — et
   annulait, deux secondes plus tard, les réglages qu'on venait de
   modifier. On voyait les couleurs et les blocs revenir seuls à leurs
   valeurs d'origine, sans rien pour l'expliquer à l'écran.

   Les documents ouverts avec ?apercu= sont donc en lecture seule. */
const _oyviaApercu = /[?&]apercu=/.test(location.search);
/* Renvoie false si l'enregistrement a échoué. Le silence d'origine
   convenait tant que l'état pesait quelques kilo-octets ; depuis que le
   back-office permet d'embarquer des images dans un article, le quota
   (~5 Mo) devient atteignable, et un échec muet ferait perdre un texte
   qu'on croyait sauvegardé. Les appelants qui peuvent prévenir
   l'utilisateur testent donc le retour.

   IMPORTANT — l'instantané est FUSIONNÉ, pas remplacé. Toutes les pages
   ne chargent pas les mêmes modules : le site public ignore le
   back-office, l'application cliente ignore les articles de blog. Une
   sauvegarde qui n'écrirait que `_OYVIA_ENTITIES` effacerait donc tout
   ce que la page courante ne connaît pas — il suffisait d'ouvrir le
   tableau de bord après avoir écrit un article pour le perdre. On
   repart de l'instantané lu au chargement et on n'écrase que les
   entités effectivement gérées ici. */
function saveOyviaState() {
  if (_oyviaResetting) return true; // une réinitialisation est en cours : ne pas réécrire l'ancien état
  if (_oyviaApercu) return true;    // aperçu : on affiche, on n'enregistre pas
  try {
    const snapshot = Object.assign({}, _oyviaSnapshot || {});
    Object.keys(_OYVIA_ENTITIES).forEach(name => { snapshot[name] = _OYVIA_ENTITIES[name]; });
    // Ce qui a disparu compte autant que ce qui reste (cf. OYVIA_SUPPRIMES).
    // Même raisonnement : les suppressions faites ailleurs sont conservées.
    snapshot.__supprimes = Object.assign({}, (_oyviaSnapshot || {}).__supprimes || {}, OYVIA_SUPPRIMES);
    localStorage.setItem(OYVIA_STATE_KEY, JSON.stringify(snapshot));
    return true;
  } catch (e) { return false; /* quota dépassé, navigation privée… */ }
}

// Sauvegarde automatique : à la fermeture/navigation, quand l'onglet
// passe en arrière-plan, et un filet de sécurité toutes les 2 secondes
// pour couvrir les cas où ces évènements ne se déclenchent pas.
window.addEventListener('pagehide', saveOyviaState);
window.addEventListener('beforeunload', saveOyviaState);
document.addEventListener('visibilitychange', () => { if (document.hidden) saveOyviaState(); });
setInterval(saveOyviaState, 2000);

// Réinitialise les données de démonstration à leur état d'origine
// (utile si la démo part en vrille) — accessible depuis le menu compte.
function resetOyviaState() {
  _oyviaResetting = true;
  try { localStorage.removeItem(OYVIA_STATE_KEY); } catch {}
  location.reload();
}
