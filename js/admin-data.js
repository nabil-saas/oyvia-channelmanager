/* ============================================================
   OYVIA — DONNÉES DU BACK-OFFICE (usage interne)

   Ce fichier décrit Oyvia vue de l'intérieur : les conciergeries
   CLIENTES, ce qu'elles paient, ce qu'elles demandent, l'état des
   intégrations et qui, chez nous, agit sur tout ça.

   Deux principes structurent le modèle :

   1. Le prix ne se saisit pas ici. Le MRR d'un compte se recalcule à
      partir du catalogue (PLANS) et du nombre de logements — un chiffre
      recopié à la main aurait dérivé du jour où une grille change, et
      le back-office deviendrait la seule source à ne plus dire la
      vérité. Seuls les contrats Entreprise, négociés un par un, portent
      un montant propre.

   2. Toute action a un auteur. Changer l'offre d'un client, annuler une
      facture ou suspendre un compte laisse une trace dans le journal.
      Sans ça, « qui a fait passer ce compte en gratuit ? » reste sans
      réponse, et c'est précisément la question qu'on se pose.

   Chargé APRÈS js/data.js, dont il réutilise le catalogue, les devises
   et la persistance (cf. enregistrerEntitesOyvia en fin de fichier).
   ============================================================ */

/* ------------------------------------------------------------
   ÉQUIPE OYVIA — qui accède au back-office, et jusqu'où
   ------------------------------------------------------------ */

// Le découpage suit les métiers réels d'un éditeur : on ne donne pas la
// facturation au support, ni les comptes clients à l'astreinte technique.
const PERMISSIONS_ADMIN = [
  { id:'vue',         label:"Vue d'ensemble",            groupe:'Pilotage' },
  { id:'comptes',     label:'Consulter les comptes',     groupe:'Clients' },
  { id:'comptes_agir',label:'Agir sur un compte',        groupe:'Clients',
    aide:"Changer d'offre, prolonger un essai, suspendre, résilier." },
  { id:'connexion',   label:'Ouvrir un compte en lecture', groupe:'Clients',
    aide:"Voir l'application telle que le client la voit, sans rien pouvoir y modifier." },
  { id:'revenus',     label:'Revenus et factures',       groupe:'Finance' },
  { id:'revenus_agir',label:'Encaisser, annuler, relancer', groupe:'Finance' },
  { id:'demandes',    label:'Demandes clients',          groupe:'Support' },
  { id:'plateforme',  label:'Santé de la plateforme',    groupe:'Technique' },
  { id:'incidents',   label:'Déclarer et clore un incident', groupe:'Technique' },
  { id:'equipe',      label:'Équipe Oyvia et rôles',     groupe:'Administration' },
  { id:'journal',     label:"Journal d'audit",           groupe:'Administration' },
];
const TOUTES_PERMISSIONS_ADMIN = PERMISSIONS_ADMIN.map(p => p.id);

const ROLES_ADMIN = [
  { id:'direction', nom:'Direction', systeme:true,
    desc:"Accès complet, y compris l'équipe interne et le journal d'audit.",
    permissions:[...TOUTES_PERMISSIONS_ADMIN] },
  { id:'support', nom:'Support', systeme:false,
    desc:"Répond aux demandes et consulte les comptes, sans toucher à la facturation.",
    permissions:['vue','comptes','demandes','connexion','plateforme'] },
  { id:'finance', nom:'Finance', systeme:false,
    desc:"Facturation, encaissements et relances.",
    permissions:['vue','comptes','revenus','revenus_agir','journal'] },
  { id:'technique', nom:'Technique', systeme:false,
    desc:"Surveille les intégrations et publie les incidents.",
    permissions:['vue','plateforme','incidents','comptes'] },
];
function getRoleAdmin(id) { return ROLES_ADMIN.find(r => r.id === id) || ROLES_ADMIN[0]; }

/* Identifiant suivant d'une série numérotée (DM-1058, INC-31, J-0208…).
   On repart du plus grand numéro EXISTANT et non du nombre d'éléments :
   après une suppression, compter les éléments réattribuerait un
   identifiant déjà utilisé, et deux lignes du journal porteraient le
   même nom. La largeur est reprise du dernier identifiant vu, pour que
   J-0208 ne soit pas suivi de J-209. */
function prochainId(prefixe, liste) {
  let max = 0, largeur = 0;
  liste.forEach(x => {
    if (!x || typeof x.id !== 'string' || !x.id.startsWith(prefixe)) return;
    const suffixe = x.id.slice(prefixe.length);
    const n = parseInt(suffixe, 10);
    if (!isFinite(n)) return;
    if (n > max) max = n;
    largeur = Math.max(largeur, suffixe.length);
  });
  return prefixe + String(max + 1).padStart(largeur, '0');
}

const MEMBRES_OYVIA = [
  { id:'M1', nom:'Nabil Hilali',    initiales:'NH', email:'nabil@oyvia.com',   roleId:'direction', statut:'actif',    dernierAcces:'2026-07-23' },
  { id:'M2', nom:'Sarah Benali',    initiales:'SB', email:'sarah@oyvia.com',   roleId:'support',   statut:'actif',    dernierAcces:'2026-07-23' },
  { id:'M3', nom:'Thomas Lefèvre',  initiales:'TL', email:'thomas@oyvia.com',  roleId:'finance',   statut:'actif',    dernierAcces:'2026-07-22' },
  { id:'M4', nom:'Yasmine Chraibi', initiales:'YC', email:'yasmine@oyvia.com', roleId:'support',   statut:'actif',    dernierAcces:'2026-07-21' },
  { id:'M5', nom:'Marc Aubert',     initiales:'MA', email:'marc@oyvia.com',    roleId:'technique', statut:'actif',    dernierAcces:'2026-07-23' },
  { id:'M6', nom:'Léa Rousseau',    initiales:'LR', email:'lea@oyvia.com',     roleId:'support',   statut:'suspendu', dernierAcces:'2026-05-30' },
];
function getMembre(id) { return MEMBRES_OYVIA.find(m => m.id === id) || null; }
function nomMembre(id) { const m = getMembre(id); return m ? m.nom : '—'; }
function effectifRoleAdmin(roleId) { return MEMBRES_OYVIA.filter(m => m.roleId === roleId).length; }

// Membre connecté au back-office. L'équivalent d'UTILISATEUR côté client.
const ADMIN_MEMBRE = { id:'M1' };
function membreCourant() { return getMembre(ADMIN_MEMBRE.id) || MEMBRES_OYVIA[0]; }
function peutAdmin(permId) {
  const m = membreCourant();
  return !!m && getRoleAdmin(m.roleId).permissions.includes(permId);
}

/* ------------------------------------------------------------
   COMPTES CLIENTS
   ------------------------------------------------------------ */

const CLIENT_STATUTS = {
  essai:    { label:'Essai',     badge:'badge--accent',   aide:"Période d'essai en cours, aucune facturation." },
  actif:    { label:'Actif',     badge:'badge--positive', aide:'Abonnement en cours et facturé.' },
  suspendu: { label:'Suspendu',  badge:'badge--warning',  aide:"Accès bloqué, le plus souvent pour impayé. L'abonnement n'est plus facturé." },
  resilie:  { label:'Résilié',   badge:'badge--neutral',  aide:'Compte fermé, données conservées six mois.' },
};

const CLIENT_SOURCES = {
  site:       'Site web',
  demo:       'Démonstration',
  parrainage: 'Parrainage',
  salon:      'Salon / événement',
  entrant:    'Appel entrant',
};

/* Un compte = une conciergerie ou un hôte. `logements` est la donnée qui
   pilote la facturation : c'est elle qui détermine le palier applicable.
   `mrrNegocie` (MAD) ne sert qu'aux contrats Entreprise, hors grille. */
const CLIENTS = [
  { id:'C001', societe:'Conciergerie Lumia',      contact:'Camille Dupont',   email:'camille@conciergerie-lumia.fr', telephone:'+33 6 12 45 78 90',
    ville:'Annecy',      pays:'France',  plan:'business',   periodicite:'annuel',  statut:'actif',    logements:10, creeLe:'2026-01-14', dernierAcces:'2026-07-23', essaiFinLe:null, source:'demo',       mrrNegocie:null, note:"Compte de référence, très actif sur la messagerie." },
  { id:'C002', societe:'Atlas Stays',             contact:'Youssef Amrani',   email:'y.amrani@atlasstays.ma',        telephone:'+212 6 61 22 34 55',
    ville:'Marrakech',   pays:'Maroc',   plan:'business',   periodicite:'mensuel', statut:'actif',    logements:34, creeLe:'2025-09-02', dernierAcces:'2026-07-22', essaiFinLe:null, source:'parrainage', mrrNegocie:null, note:'Croissance rapide, 12 logements ajoutés au printemps.' },
  { id:'C003', societe:'Riad Collection',         contact:'Salma Bennani',    email:'salma@riadcollection.ma',       telephone:'+212 6 70 88 12 03',
    ville:'Fès',         pays:'Maroc',   plan:'smart',      periodicite:'mensuel', statut:'actif',    logements:6,  creeLe:'2026-02-20', dernierAcces:'2026-07-21', essaiFinLe:null, source:'site',       mrrNegocie:null, note:'' },
  { id:'C004', societe:'Bleu Cassis',             contact:'Hugo Marchetti',   email:'hugo@bleucassis.fr',            telephone:'+33 6 84 03 55 21',
    ville:'Marseille',   pays:'France',  plan:'smart',      periodicite:'annuel',  statut:'actif',    logements:4,  creeLe:'2025-11-08', dernierAcces:'2026-07-20', essaiFinLe:null, source:'site',       mrrNegocie:null, note:'' },
  { id:'C005', societe:'Groupe Meridiem',         contact:'Claire Vasseur',   email:'c.vasseur@meridiem-group.com',  telephone:'+33 1 44 78 90 12',
    ville:'Paris',       pays:'France',  plan:'entreprise', periodicite:'annuel',  statut:'actif',    logements:214,creeLe:'2025-06-17', dernierAcces:'2026-07-23', essaiFinLe:null, source:'entrant',    mrrNegocie:31500, note:'Contrat cadre signé pour 24 mois. Interlocuteur : direction des opérations.' },
  { id:'C006', societe:'Casa Nomad',              contact:'Reda Filali',      email:'reda@casanomad.ma',             telephone:'+212 6 45 90 71 66',
    ville:'Casablanca',  pays:'Maroc',   plan:'smart',      periodicite:'mensuel', statut:'actif',    logements:9,  creeLe:'2026-03-11', dernierAcces:'2026-07-19', essaiFinLe:null, source:'salon',      mrrNegocie:null, note:'' },
  { id:'C007', societe:'Alpes Évasion',           contact:'Julien Perret',    email:'julien@alpes-evasion.fr',       telephone:'+33 6 22 40 18 77',
    ville:'Chamonix',    pays:'France',  plan:'business',   periodicite:'mensuel', statut:'actif',    logements:17, creeLe:'2025-12-01', dernierAcces:'2026-07-23', essaiFinLe:null, source:'parrainage', mrrNegocie:null, note:'Saisonnalité forte : creux marqué en mai-juin.' },
  { id:'C008', societe:'Ocean Keys',              contact:'Manon Le Gall',    email:'manon@oceankeys.fr',            telephone:'+33 6 77 12 88 45',
    ville:'Biarritz',    pays:'France',  plan:'smart',      periodicite:'mensuel', statut:'actif',    logements:7,  creeLe:'2026-04-05', dernierAcces:'2026-07-18', essaiFinLe:null, source:'site',       mrrNegocie:null, note:'' },
  { id:'C009', societe:'Medina Hosting',          contact:'Karim Tazi',       email:'karim@medinahosting.ma',        telephone:'+212 6 12 55 09 87',
    ville:'Rabat',       pays:'Maroc',   plan:'business',   periodicite:'mensuel', statut:'actif',    logements:23, creeLe:'2025-10-22', dernierAcces:'2026-07-22', essaiFinLe:null, source:'demo',       mrrNegocie:null, note:'' },
  { id:'C010', societe:'Le Nid Bordelais',        contact:'Élodie Fabre',     email:'elodie@lenidbordelais.fr',      telephone:'+33 6 09 33 71 24',
    ville:'Bordeaux',    pays:'France',  plan:'decouverte', periodicite:'mensuel', statut:'actif',    logements:2,  creeLe:'2026-06-12', dernierAcces:'2026-07-23', essaiFinLe:null, source:'site',       mrrNegocie:null, note:"Offre Découverte : bascule sur Smart le 12 décembre." },
  { id:'C011', societe:'Sud Sérénité',            contact:'Patrick Nguyen',   email:'patrick@sud-serenite.fr',       telephone:'+33 6 55 21 90 08',
    ville:'Nice',        pays:'France',  plan:'smart',      periodicite:'mensuel', statut:'essai',    logements:5,  creeLe:'2026-07-14', dernierAcces:'2026-07-23', essaiFinLe:'2026-07-29', source:'site',       mrrNegocie:null, note:'A branché Airbnb dès le premier jour.' },
  { id:'C012', societe:'Kasbah Rentals',          contact:'Nadia Ouazzani',   email:'nadia@kasbahrentals.ma',        telephone:'+212 6 88 44 20 15',
    ville:'Agadir',      pays:'Maroc',   plan:'smart',      periodicite:'mensuel', statut:'essai',    logements:8,  creeLe:'2026-07-19', dernierAcces:'2026-07-22', essaiFinLe:'2026-08-03', source:'salon',      mrrNegocie:null, note:'' },
  { id:'C013', societe:'Loire & Co',              contact:'Antoine Bruneau',  email:'antoine@loire-and-co.fr',       telephone:'+33 6 31 07 62 90',
    ville:'Tours',       pays:'France',  plan:'gratuit',    periodicite:'mensuel', statut:'essai',    logements:3,  creeLe:'2026-07-21', dernierAcces:'2026-07-21', essaiFinLe:'2026-08-05', source:'site',       mrrNegocie:null, note:"N'a pas encore connecté de canal." },
  { id:'C014', societe:'Villa Prestige',          contact:'Sophie Andréani',  email:'sophie@villaprestige.fr',       telephone:'+33 6 14 78 03 52',
    ville:'Ajaccio',     pays:'France',  plan:'business',   periodicite:'mensuel', statut:'suspendu', logements:12, creeLe:'2025-08-30', dernierAcces:'2026-06-28', essaiFinLe:null, sortiLe:'2026-07-10', source:'entrant',    mrrNegocie:null, note:'Suspendu le 10 juillet : deux échéances impayées.' },
  { id:'C015', societe:'Ker Breizh',              contact:'Gwen Tanguy',      email:'gwen@kerbreizh.fr',             telephone:'+33 6 62 19 47 30',
    ville:'Quiberon',    pays:'France',  plan:'smart',      periodicite:'mensuel', statut:'resilie',  logements:3,  creeLe:'2025-07-04', dernierAcces:'2026-04-30', essaiFinLe:null, sortiLe:'2026-04-30', source:'site',       mrrNegocie:null, note:'A repris la gestion en direct. Départ à l’amiable.' },
  { id:'C016', societe:'Sahara Lodges',           contact:'Omar Belkacem',    email:'omar@saharalodges.ma',          telephone:'+212 6 33 71 28 44',
    ville:'Ouarzazate',  pays:'Maroc',   plan:'smart',      periodicite:'mensuel', statut:'resilie',  logements:6,  creeLe:'2025-05-19', dernierAcces:'2026-03-15', essaiFinLe:null, sortiLe:'2026-03-15', source:'parrainage', mrrNegocie:null, note:'Activité arrêtée (saison).' },
];
function getClient(id) { return CLIENTS.find(c => c.id === id) || null; }
function nomClient(id) { const c = getClient(id); return c ? c.societe : '—'; }

/* ------------------------------------------------------------
   REVENUS — le MRR se calcule, il ne se saisit pas
   ------------------------------------------------------------ */

/* Montant mensuel récurrent d'un compte, en MAD (devise du catalogue).
   Un essai vaut 0 : compter comme acquis un revenu qui n'est pas encore
   engagé, c'est se raconter une histoire. Un compte suspendu vaut 0 lui
   aussi — il n'est plus prélevé — mais reste visible ailleurs comme
   revenu à récupérer. */
function mrrClient(c) {
  if (!c || c.statut !== 'actif') return 0;
  const p = getPlan(c.plan);
  if (!p) return 0;
  if (p.unite === 'devis')   return c.mrrNegocie || 0;
  if (p.unite === 'gratuit') return 0;
  return totalMensuel(c.plan, c.logements, c.periodicite || 'mensuel');
}
function mrrTotal(liste = CLIENTS) { return liste.reduce((s, c) => s + mrrClient(c), 0); }
function arrTotal(liste = CLIENTS) { return mrrTotal(liste) * 12; }

// Revenu moyen par compte payant. Les comptes gratuits fausseraient la
// moyenne vers le bas sans rien dire de la valeur d'un client.
function clientsPayants() { return CLIENTS.filter(c => mrrClient(c) > 0); }
function arpa() {
  const payants = clientsPayants();
  return payants.length ? mrrTotal(payants) / payants.length : 0;
}
function clientsParStatut(statut) { return CLIENTS.filter(c => c.statut === statut); }
function logementsSousGestion() {
  return CLIENTS.filter(c => c.statut === 'actif' || c.statut === 'essai')
                .reduce((s, c) => s + c.logements, 0);
}

// Répartition du MRR par offre : c'est ce qui dit d'où vient réellement
// l'argent, quand la répartition par NOMBRE de comptes dit l'inverse.
function repartitionParPlan() {
  return PLANS.map(p => {
    const comptes = CLIENTS.filter(c => c.plan === p.id && c.statut === 'actif');
    return { plan: p, comptes: comptes.length, mrr: mrrTotal(comptes) };
  }).filter(r => r.comptes > 0);
}

/* Douze derniers mois de MRR (MAD), le dernier point étant le mois en
   cours. Figé volontairement : le recalculer à partir des comptes
   actuels donnerait une courbe plate, puisqu'on n'a pas l'historique des
   changements d'offre. */
const MRR_HISTORIQUE = [
  { mois:'2025-08', mrr:14200, comptes:5  },
  { mois:'2025-09', mrr:16850, comptes:6  },
  { mois:'2025-10', mrr:19400, comptes:7  },
  { mois:'2025-11', mrr:22150, comptes:8  },
  { mois:'2025-12', mrr:24900, comptes:9  },
  { mois:'2026-01', mrr:27300, comptes:10 },
  { mois:'2026-02', mrr:29850, comptes:11 },
  { mois:'2026-03', mrr:32100, comptes:12 },
  { mois:'2026-04', mrr:34600, comptes:12 },
  { mois:'2026-05', mrr:35100, comptes:12 },
  { mois:'2026-06', mrr:37400, comptes:11 },
  { mois:'2026-07', mrr:0,     comptes:0  },   // rempli au chargement, cf. plus bas
];

/* Remise en ordre après restauration.

   La fusion de l'instantané réinjecte les éléments créés depuis l'interface
   à la FIN du tableau (cf. _oyviaFusionner dans data.js), quel que soit
   l'ordre dans lequel ils ont été créés. Un journal d'audit dont les
   dernières actions se retrouvent en bas après un rechargement ne se lit
   plus : l'ordre est ici une propriété de la donnée, pas une coquetterie
   d'affichage. On le rétablit une fois, au chargement, plutôt que de
   demander à chaque page de trier ce qu'elle lit. */
function _apresRestaurationAdmin() {
  // Le dernier point de la courbe doit refléter l'état réel des comptes,
  // sinon le graphique contredirait le KPI affiché juste à côté.
  const dernier = MRR_HISTORIQUE[MRR_HISTORIQUE.length - 1];
  dernier.mrr = Math.round(mrrTotal());
  dernier.comptes = clientsParStatut('actif').length;

  const parDate = cle => (a, b) => String(b[cle] || '').localeCompare(String(a[cle] || ''));
  JOURNAL_ADMIN.sort(parDate('le'));
  DEMANDES.sort(parDate('creeLe'));
  INCIDENTS.sort(parDate('ouvertLe'));
  FACTURES_SAAS.sort(parDate('emiseLe'));
}

function croissanceMrr() {
  const n = MRR_HISTORIQUE.length;
  if (n < 2) return 0;
  const avant = MRR_HISTORIQUE[n - 2].mrr;
  if (!avant) return 0;
  return ((MRR_HISTORIQUE[n - 1].mrr - avant) / avant) * 100;
}

/* Taux d'attrition mensuel : comptes partis sur le mois / comptes actifs
   au début du mois. On compte les résiliations ET les suspensions pour
   impayé : un compte suspendu ne paie plus, l'appeler « client » ne
   change rien à la trésorerie. */
function tauxChurn() {
  const partis = CLIENTS.filter(c =>
    (c.statut === 'resilie' || c.statut === 'suspendu') && (c.sortiLe || '') >= moisDebut(AUJOURDHUI)).length;
  const base = clientsParStatut('actif').length + partis;
  return base ? (partis / base) * 100 : 0;
}
function moisDebut(date) { return date.slice(0, 8) + '01'; }
function moisDe(date) { return date.slice(0, 7); }
function libelleMois(mois) {
  const [a, m] = mois.split('-');
  return `${MOIS_COURT[parseInt(m, 10) - 1]} ${a.slice(2)}`;
}

/* Les horodatages du back-office (journal, incidents) portent l'heure :
   « 2026-07-22 17:12 ». formatDate ne sait pas la lire et rendrait une
   date invalide, d'où ce découpage — au même endroit pour toutes les
   pages, plutôt que réinventé dans chacune. */
function formatHorodatage(valeur, opts = {}) {
  if (!valeur) return '';
  const [jour, heure] = String(valeur).split(' ');
  const date = formatDate(jour, opts);
  return heure ? `${date} à ${heure}` : date;
}

/* ------------------------------------------------------------
   FACTURATION SAAS — ce qu'on facture à nos clients
   ------------------------------------------------------------ */

const FACTURE_SAAS_STATUTS = {
  payee:    { label:'Payée',     badge:'badge--positive' },
  attente:  { label:'En attente',badge:'badge--warning'  },
  impayee:  { label:'Impayée',   badge:'badge--danger'   },
  annulee:  { label:'Annulée',   badge:'badge--neutral'  },
};
const MOYENS_PAIEMENT = {
  cb:          'Carte bancaire',
  prelevement: 'Prélèvement SEPA',
  virement:    'Virement',
};

// Montants en MAD, comme le catalogue. `montant` est le TTC facturé.
const FACTURES_SAAS = [
  { id:'OY-2026-0198', clientId:'C005', periode:'2026-07', montant:31500, emiseLe:'2026-07-01', echeanceLe:'2026-07-31', statut:'attente', payeeLe:null,         moyen:'virement',    relances:0 },
  { id:'OY-2026-0197', clientId:'C002', periode:'2026-07', montant:5100,  emiseLe:'2026-07-01', echeanceLe:'2026-07-15', statut:'payee',   payeeLe:'2026-07-02', moyen:'prelevement', relances:0 },
  { id:'OY-2026-0196', clientId:'C009', periode:'2026-07', montant:3910,  emiseLe:'2026-07-01', echeanceLe:'2026-07-15', statut:'payee',   payeeLe:'2026-07-03', moyen:'cb',          relances:0 },
  { id:'OY-2026-0195', clientId:'C007', periode:'2026-07', montant:2890,  emiseLe:'2026-07-01', echeanceLe:'2026-07-15', statut:'payee',   payeeLe:'2026-07-01', moyen:'cb',          relances:0 },
  { id:'OY-2026-0194', clientId:'C014', periode:'2026-07', montant:2040,  emiseLe:'2026-07-01', echeanceLe:'2026-07-15', statut:'impayee', payeeLe:null,         moyen:'cb',          relances:2 },
  { id:'OY-2026-0193', clientId:'C003', periode:'2026-07', montant:1140,  emiseLe:'2026-07-01', echeanceLe:'2026-07-15', statut:'payee',   payeeLe:'2026-07-04', moyen:'cb',          relances:0 },
  { id:'OY-2026-0192', clientId:'C006', periode:'2026-07', montant:1710,  emiseLe:'2026-07-01', echeanceLe:'2026-07-15', statut:'payee',   payeeLe:'2026-07-06', moyen:'prelevement', relances:1 },
  { id:'OY-2026-0191', clientId:'C008', periode:'2026-07', montant:1330,  emiseLe:'2026-07-01', echeanceLe:'2026-07-15', statut:'impayee', payeeLe:null,         moyen:'cb',          relances:1 },
  { id:'OY-2026-0190', clientId:'C010', periode:'2026-07', montant:22,    emiseLe:'2026-07-01', echeanceLe:'2026-07-15', statut:'payee',   payeeLe:'2026-07-01', moyen:'cb',          relances:0 },
  { id:'OY-2026-0189', clientId:'C001', periode:'2026-07', montant:19200, emiseLe:'2026-07-01', echeanceLe:'2026-07-31', statut:'payee',   payeeLe:'2026-07-02', moyen:'virement',    relances:0 },
  { id:'OY-2026-0188', clientId:'C004', periode:'2026-07', montant:6528,  emiseLe:'2026-07-01', echeanceLe:'2026-07-31', statut:'payee',   payeeLe:'2026-07-05', moyen:'virement',    relances:0 },

  { id:'OY-2026-0176', clientId:'C005', periode:'2026-06', montant:31500, emiseLe:'2026-06-01', echeanceLe:'2026-06-30', statut:'payee',   payeeLe:'2026-06-24', moyen:'virement',    relances:1 },
  { id:'OY-2026-0175', clientId:'C002', periode:'2026-06', montant:5100,  emiseLe:'2026-06-01', echeanceLe:'2026-06-15', statut:'payee',   payeeLe:'2026-06-02', moyen:'prelevement', relances:0 },
  { id:'OY-2026-0174', clientId:'C009', periode:'2026-06', montant:3910,  emiseLe:'2026-06-01', echeanceLe:'2026-06-15', statut:'payee',   payeeLe:'2026-06-02', moyen:'cb',          relances:0 },
  { id:'OY-2026-0173', clientId:'C007', periode:'2026-06', montant:2890,  emiseLe:'2026-06-01', echeanceLe:'2026-06-15', statut:'payee',   payeeLe:'2026-06-03', moyen:'cb',          relances:0 },
  { id:'OY-2026-0172', clientId:'C014', periode:'2026-06', montant:2040,  emiseLe:'2026-06-01', echeanceLe:'2026-06-15', statut:'impayee', payeeLe:null,         moyen:'cb',          relances:3 },
  { id:'OY-2026-0171', clientId:'C003', periode:'2026-06', montant:1140,  emiseLe:'2026-06-01', echeanceLe:'2026-06-15', statut:'payee',   payeeLe:'2026-06-05', moyen:'cb',          relances:0 },
  { id:'OY-2026-0170', clientId:'C006', periode:'2026-06', montant:1710,  emiseLe:'2026-06-01', echeanceLe:'2026-06-15', statut:'payee',   payeeLe:'2026-06-11', moyen:'prelevement', relances:1 },
  { id:'OY-2026-0169', clientId:'C008', periode:'2026-06', montant:1330,  emiseLe:'2026-06-01', echeanceLe:'2026-06-15', statut:'payee',   payeeLe:'2026-06-04', moyen:'cb',          relances:0 },
  { id:'OY-2026-0168', clientId:'C016', periode:'2026-06', montant:1140,  emiseLe:'2026-06-01', echeanceLe:'2026-06-15', statut:'annulee', payeeLe:null,         moyen:'cb',          relances:0 },

  { id:'OY-2026-0152', clientId:'C002', periode:'2026-05', montant:4590,  emiseLe:'2026-05-01', echeanceLe:'2026-05-15', statut:'payee',   payeeLe:'2026-05-02', moyen:'prelevement', relances:0 },
  { id:'OY-2026-0151', clientId:'C009', periode:'2026-05', montant:3910,  emiseLe:'2026-05-01', echeanceLe:'2026-05-15', statut:'payee',   payeeLe:'2026-05-02', moyen:'cb',          relances:0 },
  { id:'OY-2026-0150', clientId:'C007', periode:'2026-05', montant:2890,  emiseLe:'2026-05-01', echeanceLe:'2026-05-15', statut:'payee',   payeeLe:'2026-05-08', moyen:'cb',          relances:1 },
  { id:'OY-2026-0149', clientId:'C014', periode:'2026-05', montant:2040,  emiseLe:'2026-05-01', echeanceLe:'2026-05-15', statut:'payee',   payeeLe:'2026-05-14', moyen:'cb',          relances:1 },
  { id:'OY-2026-0148', clientId:'C015', periode:'2026-05', montant:570,   emiseLe:'2026-05-01', echeanceLe:'2026-05-15', statut:'payee',   payeeLe:'2026-05-03', moyen:'cb',          relances:0 },
];
function getFactureSaas(id) { return FACTURES_SAAS.find(f => f.id === id) || null; }
function facturesClient(id) { return FACTURES_SAAS.filter(f => f.clientId === id); }

// Une facture en attente dont l'échéance est passée EST une facture
// impayée : laisser l'étiquette « en attente » masquerait le problème.
function statutFactureReel(f) {
  if (f.statut === 'attente' && f.echeanceLe < AUJOURDHUI) return 'impayee';
  return f.statut;
}
function facturesImpayees() { return FACTURES_SAAS.filter(f => statutFactureReel(f) === 'impayee'); }
function montantImpaye() { return facturesImpayees().reduce((s, f) => s + f.montant, 0); }
function encaissementsDuMois(mois = moisDe(AUJOURDHUI)) {
  return FACTURES_SAAS.filter(f => f.statut === 'payee' && moisDe(f.payeeLe || '') === mois)
                      .reduce((s, f) => s + f.montant, 0);
}
function factureEnRetardDe(f) {
  if (statutFactureReel(f) !== 'impayee') return 0;
  return Math.max(0, nuitsEntre(f.echeanceLe, AUJOURDHUI));
}

/* ------------------------------------------------------------
   DEMANDES CLIENTS — l'autre bout du bouton « Contacter le support »
   ------------------------------------------------------------ */

const DEMANDE_SUJETS = {
  offre:       { label:"Changement d'offre", icone:'offre' },
  facturation: { label:'Facturation',        icone:'facture' },
  technique:   { label:'Problème technique', icone:'technique' },
  resiliation: { label:'Résiliation',        icone:'resiliation' },
  question:    { label:'Question produit',   icone:'question' },
};
const DEMANDE_STATUTS = {
  nouvelle: { label:'Nouvelle',  badge:'badge--danger'   },
  en_cours: { label:'En cours',  badge:'badge--warning'  },
  traitee:  { label:'Traitée',   badge:'badge--positive' },
};
const DEMANDE_PRIORITES = {
  basse:   { label:'Basse',   badge:'badge--neutral' },
  normale: { label:'Normale', badge:'badge--accent'  },
  haute:   { label:'Haute',   badge:'badge--danger'  },
};
const DEMANDE_CANAUX = { formulaire:'Formulaire', whatsapp:'WhatsApp', email:'E-mail', telephone:'Téléphone' };

const DEMANDES = [
  { id:'DM-1058', clientId:'C007', sujet:'offre', canal:'whatsapp', statut:'nouvelle', priorite:'haute', assigneA:null,
    creeLe:'2026-07-23', message:"Nous passons de 17 à 24 logements en septembre. Est-ce que le palier change automatiquement ou faut-il refaire un contrat ?",
    echanges:[] },
  { id:'DM-1057', clientId:'C011', sujet:'question', canal:'formulaire', statut:'nouvelle', priorite:'normale', assigneA:null,
    creeLe:'2026-07-23', message:"Bonjour, mon essai se termine le 29. Est-ce que je perds mes données si je ne prends pas d'abonnement tout de suite ?",
    echanges:[] },
  { id:'DM-1056', clientId:'C008', sujet:'facturation', canal:'email', statut:'en_cours', priorite:'haute', assigneA:'M3',
    creeLe:'2026-07-21', message:"Le prélèvement de juillet a été refusé par la banque, la carte a été renouvelée. Comment la mettre à jour ?",
    echanges:[{ de:'M3', le:'2026-07-21', texte:"Je vous envoie un lien de mise à jour du moyen de paiement. La facture reste ouverte sans pénalité jusqu'au 31." }] },
  { id:'DM-1055', clientId:'C002', sujet:'technique', canal:'formulaire', statut:'en_cours', priorite:'haute', assigneA:'M5',
    creeLe:'2026-07-20', message:"La synchronisation Booking s'est arrêtée sur 4 logements depuis samedi. Les autres canaux fonctionnent.",
    echanges:[{ de:'M5', le:'2026-07-20', texte:"Confirmé de notre côté : l'API Booking rejette les jetons émis avant le 12 juillet. Reconnexion en cours, incident INC-31 ouvert." }] },
  { id:'DM-1054', clientId:'C014', sujet:'facturation', canal:'telephone', statut:'en_cours', priorite:'haute', assigneA:'M3',
    creeLe:'2026-07-14', message:"Demande d'échelonnement des deux échéances impayées sur trois mois.",
    echanges:[{ de:'M3', le:'2026-07-15', texte:"Proposition envoyée : trois mensualités à partir du 1er août, réactivation du compte dès le premier versement." }] },
  { id:'DM-1053', clientId:'C003', sujet:'question', canal:'whatsapp', statut:'traitee', priorite:'normale', assigneA:'M2',
    creeLe:'2026-07-11', message:"Peut-on faire remplir la fiche de police par le voyageur avant l'arrivée ?",
    echanges:[{ de:'M2', le:'2026-07-11', texte:"Oui : le lien est envoyé automatiquement avec le message d'avant-arrivée, et la fiche passe en Complète dès que le voyageur a tout renseigné." }] },
  { id:'DM-1052', clientId:'C010', sujet:'offre', canal:'formulaire', statut:'traitee', priorite:'normale', assigneA:'M2',
    creeLe:'2026-07-08', message:"Je voudrais ajouter un troisième logement, mais je suis en offre Découverte.",
    echanges:[{ de:'M2', le:'2026-07-08', texte:"Découverte est limitée à deux logements. Le passage à Smart peut se faire dès aujourd'hui, au prorata." }] },
  { id:'DM-1051', clientId:'C015', sujet:'resiliation', canal:'email', statut:'traitee', priorite:'normale', assigneA:'M1',
    creeLe:'2026-04-24', message:"Nous reprenons la gestion en direct, merci de clôturer le compte à la fin du mois.",
    echanges:[{ de:'M1', le:'2026-04-25', texte:"Compte clôturé au 30 avril, export complet des données envoyé. Nous gardons la porte ouverte." }] },
  { id:'DM-1050', clientId:'C006', sujet:'technique', canal:'formulaire', statut:'traitee', priorite:'basse', assigneA:'M5',
    creeLe:'2026-06-30', message:"Les codes de serrure ne se créent plus sur deux appartements.",
    echanges:[{ de:'M5', le:'2026-06-30', texte:"Les deux serrures étaient hors ligne (batterie). Un remplacement de piles a suffi, la création de code refonctionne." }] },
];
function getDemande(id) { return DEMANDES.find(d => d.id === id) || null; }
function demandesOuvertes() { return DEMANDES.filter(d => d.statut !== 'traitee'); }
function demandesClient(id) { return DEMANDES.filter(d => d.clientId === id); }

/* Créée depuis l'application cliente (abonnement → « Contacter le
   support »). C'est ce qui relie les deux moitiés du produit : côté
   client on envoie un message, côté Oyvia il apparaît dans la file. */
function creerDemandeClient({ clientId, sujet = 'question', canal = 'formulaire', message = '', priorite = 'normale' }) {
  const d = {
    id: prochainId('DM-', DEMANDES),
    clientId: clientId || COMPTE_CLIENT_COURANT,
    sujet, canal, statut:'nouvelle', priorite, assigneA:null,
    creeLe: AUJOURDHUI, message, echanges: [],
  };
  DEMANDES.unshift(d);
  if (typeof saveOyviaState === 'function') saveOyviaState();
  return d;
}
// Le compte que l'application cliente représente : c'est Conciergerie Lumia
// (cf. COMPTE dans data.js). Une demande envoyée depuis la démo lui est donc
// rattachée, ce qui la rend visible ici sans configuration.
const COMPTE_CLIENT_COURANT = 'C001';

/* ------------------------------------------------------------
   SANTÉ DE LA PLATEFORME
   ------------------------------------------------------------ */

const SANTE_STATUTS = {
  ok:      { label:'Opérationnel', badge:'badge--positive', point:'is-ok' },
  degrade: { label:'Dégradé',      badge:'badge--warning',  point:'is-degrade' },
  panne:   { label:'Interrompu',   badge:'badge--danger',   point:'is-panne' },
};

const SERVICES_PLATEFORME = [
  { id:'airbnb',    nom:'Airbnb',            categorie:'Canaux',       statut:'ok',      latence:340, dispo:99.98, controleLe:'2026-07-23 09:40' },
  { id:'booking',   nom:'Booking.com',       categorie:'Canaux',       statut:'degrade', latence:1870,dispo:97.20, controleLe:'2026-07-23 09:40' },
  { id:'expedia',   nom:'Expedia',           categorie:'Canaux',       statut:'ok',      latence:520, dispo:99.91, controleLe:'2026-07-23 09:40' },
  { id:'ical',      nom:'Synchronisation iCal', categorie:'Canaux',    statut:'ok',      latence:210, dispo:99.99, controleLe:'2026-07-23 09:35' },
  { id:'seam',      nom:'Seam (serrures connectées)', categorie:'Équipements', statut:'ok', latence:610, dispo:99.87, controleLe:'2026-07-23 09:38' },
  { id:'pricelabs', nom:'PriceLabs',         categorie:'Tarification', statut:'ok',      latence:430, dispo:99.95, controleLe:'2026-07-23 09:30' },
  { id:'stripe',    nom:'Paiements',         categorie:'Paiement',     statut:'ok',      latence:180, dispo:100,   controleLe:'2026-07-23 09:42' },
  { id:'whatsapp',  nom:'WhatsApp Business', categorie:'Messagerie',   statut:'ok',      latence:260, dispo:99.93, controleLe:'2026-07-23 09:41' },
  { id:'email',     nom:'Envoi d’e-mails',   categorie:'Messagerie',   statut:'ok',      latence:150, dispo:99.99, controleLe:'2026-07-23 09:41' },
  { id:'vivi',      nom:'Vivi (assistant IA)', categorie:'IA',         statut:'ok',      latence:920, dispo:99.80, controleLe:'2026-07-23 09:39' },
];
function getServicePlateforme(id) { return SERVICES_PLATEFORME.find(s => s.id === id) || null; }

const INCIDENT_GRAVITES = {
  mineur:   { label:'Mineur',   badge:'badge--neutral' },
  majeur:   { label:'Majeur',   badge:'badge--warning' },
  critique: { label:'Critique', badge:'badge--danger'  },
};
const INCIDENT_STATUTS = {
  ouvert:   { label:'Ouvert',      badge:'badge--danger'   },
  surveille:{ label:'Sous surveillance', badge:'badge--warning' },
  resolu:   { label:'Résolu',      badge:'badge--positive' },
};

const INCIDENTS = [
  { id:'INC-31', serviceId:'booking', titre:"Jetons Booking rejetés après renouvellement", gravite:'majeur', statut:'ouvert',
    ouvertLe:'2026-07-20', resoluLe:null, clients:['C002','C009','C007'],
    journal:[
      { le:'2026-07-20 08:15', texte:"Remontée par Atlas Stays : 4 logements ne se synchronisent plus." },
      { le:'2026-07-20 11:02', texte:"Reproduit : les jetons émis avant le 12 juillet sont refusés côté Booking." },
      { le:'2026-07-22 16:40', texte:"Reconnexion automatique déployée pour 2 comptes sur 3. Suivi en cours." },
    ] },
  { id:'INC-30', serviceId:'vivi', titre:"Latence des réponses Vivi au-dessus de 3 s", gravite:'mineur', statut:'surveille',
    ouvertLe:'2026-07-18', resoluLe:null, clients:['C001','C005'],
    journal:[
      { le:'2026-07-18 14:20', texte:"Pic de latence constaté aux heures de pointe (18 h – 21 h)." },
      { le:'2026-07-19 10:05', texte:"File d'attente élargie. Latence redescendue à 900 ms en moyenne." },
    ] },
  { id:'INC-29', serviceId:'seam', titre:"Création de code impossible sur serrures hors ligne", gravite:'mineur', statut:'resolu',
    ouvertLe:'2026-06-30', resoluLe:'2026-06-30', clients:['C006'],
    journal:[
      { le:'2026-06-30 09:10', texte:"Deux serrures injoignables chez Casa Nomad." },
      { le:'2026-06-30 15:30', texte:"Batteries déchargées côté client. Alerte de batterie faible ajoutée au socle d'alertes." },
    ] },
  { id:'INC-28', serviceId:'stripe', titre:"Échecs de prélèvement sur cartes renouvelées", gravite:'majeur', statut:'resolu',
    ouvertLe:'2026-07-01', resoluLe:'2026-07-04', clients:['C008','C014'],
    journal:[
      { le:'2026-07-01 06:00', texte:"3 prélèvements refusés au passage de la facturation mensuelle." },
      { le:'2026-07-04 09:20', texte:"Relance automatique et lien de mise à jour de carte envoyés." },
    ] },
];
function getIncident(id) { return INCIDENTS.find(i => i.id === id) || null; }
function incidentsOuverts() { return INCIDENTS.filter(i => i.statut !== 'resolu'); }
function incidentsService(id) { return INCIDENTS.filter(i => i.serviceId === id && i.statut !== 'resolu'); }

// Un seul mot pour l'état général, celui qu'on veut lire en arrivant.
function santeGlobale() {
  if (SERVICES_PLATEFORME.some(s => s.statut === 'panne')) return 'panne';
  if (SERVICES_PLATEFORME.some(s => s.statut === 'degrade')) return 'degrade';
  return 'ok';
}

/* ------------------------------------------------------------
   JOURNAL D'AUDIT
   ------------------------------------------------------------ */

const JOURNAL_ADMIN = [
  { id:'J-0208', le:'2026-07-22 17:12', auteurId:'M3', action:'Relance envoyée',        cible:'OY-2026-0194 · Villa Prestige', detail:'Deuxième relance, échéance dépassée de 7 jours.' },
  { id:'J-0207', le:'2026-07-22 16:40', auteurId:'M5', action:'Incident mis à jour',    cible:'INC-31',                        detail:'Reconnexion automatique déployée pour 2 comptes sur 3.' },
  { id:'J-0206', le:'2026-07-21 11:05', auteurId:'M2', action:'Demande assignée',       cible:'DM-1056',                       detail:'Assignée à Thomas Lefèvre (Finance).' },
  { id:'J-0205', le:'2026-07-19 09:30', auteurId:'M1', action:'Compte créé',            cible:'Kasbah Rentals',                detail:'Essai de 15 jours ouvert à la suite du salon de Marrakech.' },
  { id:'J-0204', le:'2026-07-14 15:22', auteurId:'M1', action:'Offre modifiée',         cible:'Atlas Stays',                   detail:'Smart → Business, à la demande du client.' },
  { id:'J-0203', le:'2026-07-10 10:00', auteurId:'M3', action:'Compte suspendu',        cible:'Villa Prestige',                detail:'Deux échéances impayées, suspension automatique.' },
  { id:'J-0202', le:'2026-07-04 09:20', auteurId:'M5', action:'Incident clos',          cible:'INC-28',                        detail:'Échecs de prélèvement — résolu.' },
  { id:'J-0201', le:'2026-06-28 14:45', auteurId:'M1', action:'Rôle modifié',           cible:'Yasmine Chraibi',               detail:'Support : ajout de la permission « Ouvrir un compte en lecture ».' },
];

/* Toute action du back-office passe par ici. La signature est volontairement
   pauvre (action, cible, détail) : un journal qu'on enrichit page par page
   finit illisible, et son intérêt est justement de se relire d'un bloc. */
function journaliser(action, cible, detail = '') {
  JOURNAL_ADMIN.unshift({
    id: prochainId('J-', JOURNAL_ADMIN),
    le: AUJOURDHUI + ' ' + heureCourante(),
    auteurId: membreCourant().id,
    action, cible, detail,
  });
  if (typeof saveOyviaState === 'function') saveOyviaState();
}
// L'horloge du navigateur, la date restant celle de la démonstration :
// mélanger les deux donnerait des entrées datées d'aujourd'hui à côté
// d'un parc figé en juillet 2026.
function heureCourante() {
  const d = new Date();
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

/* ------------------------------------------------------------
   ACTIONS SUR UN COMPTE
   Chacune journalise, aucune ne se contente de changer un champ.
   ------------------------------------------------------------ */

function changerOffreClient(clientId, planId) {
  const c = getClient(clientId);
  if (!c) return false;
  const avant = getPlan(c.plan).nom;
  c.plan = planId;
  // Repasser un compte en offre payante depuis une suspension n'a pas de
  // sens tant que l'impayé n'est pas soldé : on ne réactive pas ici.
  journaliser("Offre modifiée", c.societe, `${avant} → ${getPlan(planId).nom}.`);
  if (typeof saveOyviaState === 'function') saveOyviaState();
  return true;
}

function prolongerEssai(clientId, jours = 15) {
  const c = getClient(clientId);
  if (!c || c.statut !== 'essai') return false;
  c.essaiFinLe = addDays(c.essaiFinLe || AUJOURDHUI, jours);
  journaliser('Essai prolongé', c.societe, `+${jours} jours, nouvelle fin le ${formatDate(c.essaiFinLe, { annee: true })}.`);
  if (typeof saveOyviaState === 'function') saveOyviaState();
  return true;
}

function suspendreClient(clientId, motif = '') {
  const c = getClient(clientId);
  if (!c || c.statut === 'suspendu') return false;
  c.statutAvantSuspension = c.statut;
  c.statut = 'suspendu';
  c.sortiLe = AUJOURDHUI;
  journaliser('Compte suspendu', c.societe, motif || "Suspension manuelle depuis le back-office.");
  if (typeof saveOyviaState === 'function') saveOyviaState();
  return true;
}

function reactiverClient(clientId) {
  const c = getClient(clientId);
  if (!c || (c.statut !== 'suspendu' && c.statut !== 'resilie')) return false;
  c.statut = c.statutAvantSuspension || 'actif';
  c.statutAvantSuspension = null;
  c.sortiLe = null;
  journaliser('Compte réactivé', c.societe, "Accès rétabli.");
  if (typeof saveOyviaState === 'function') saveOyviaState();
  return true;
}

function resilierClient(clientId, motif = '') {
  const c = getClient(clientId);
  if (!c || c.statut === 'resilie') return false;
  c.statut = 'resilie';
  c.sortiLe = AUJOURDHUI;
  journaliser('Compte résilié', c.societe, motif || 'Résiliation à la demande du client.');
  if (typeof saveOyviaState === 'function') saveOyviaState();
  return true;
}

/* ------------------------------------------------------------
   ACTIONS SUR UNE FACTURE
   ------------------------------------------------------------ */

function marquerFacturePayee(id, moyen) {
  const f = getFactureSaas(id);
  if (!f || f.statut === 'payee') return false;
  f.statut = 'payee';
  f.payeeLe = AUJOURDHUI;
  if (moyen) f.moyen = moyen;
  journaliser('Paiement enregistré', `${f.id} · ${nomClient(f.clientId)}`, `${formatPrixAbo(f.montant)} — ${MOYENS_PAIEMENT[f.moyen] || f.moyen}.`);
  if (typeof saveOyviaState === 'function') saveOyviaState();
  return true;
}

function relancerFacture(id) {
  const f = getFactureSaas(id);
  if (!f || f.statut === 'payee' || f.statut === 'annulee') return false;
  f.relances = (f.relances || 0) + 1;
  f.relanceeLe = AUJOURDHUI;
  journaliser('Relance envoyée', `${f.id} · ${nomClient(f.clientId)}`, `Relance n° ${f.relances}.`);
  if (typeof saveOyviaState === 'function') saveOyviaState();
  return true;
}

function annulerFacture(id, motif = '') {
  const f = getFactureSaas(id);
  if (!f || f.statut === 'payee') return false;
  f.statut = 'annulee';
  journaliser('Facture annulée', `${f.id} · ${nomClient(f.clientId)}`, motif || 'Annulation manuelle.');
  if (typeof saveOyviaState === 'function') saveOyviaState();
  return true;
}

/* ------------------------------------------------------------
   ACTIONS SUR UNE DEMANDE
   ------------------------------------------------------------ */

function assignerDemande(id, membreId) {
  const d = getDemande(id);
  if (!d) return false;
  d.assigneA = membreId || null;
  if (d.statut === 'nouvelle' && membreId) d.statut = 'en_cours';
  journaliser('Demande assignée', d.id, membreId ? `Assignée à ${nomMembre(membreId)}.` : 'Assignation retirée.');
  if (typeof saveOyviaState === 'function') saveOyviaState();
  return true;
}

function repondreDemande(id, texte, cloturer = false) {
  const d = getDemande(id);
  if (!d || !texte.trim()) return false;
  d.echanges.push({ de: membreCourant().id, le: AUJOURDHUI, texte: texte.trim() });
  d.statut = cloturer ? 'traitee' : 'en_cours';
  if (!d.assigneA) d.assigneA = membreCourant().id;
  journaliser(cloturer ? 'Demande traitée' : 'Réponse envoyée', `${d.id} · ${nomClient(d.clientId)}`, texte.trim().slice(0, 90));
  if (typeof saveOyviaState === 'function') saveOyviaState();
  return true;
}

function changerStatutDemande(id, statut) {
  const d = getDemande(id);
  if (!d || !DEMANDE_STATUTS[statut]) return false;
  d.statut = statut;
  journaliser('Statut de demande modifié', d.id, DEMANDE_STATUTS[statut].label + '.');
  if (typeof saveOyviaState === 'function') saveOyviaState();
  return true;
}

/* ------------------------------------------------------------
   ACTIONS SUR LA PLATEFORME
   ------------------------------------------------------------ */

function changerStatutService(serviceId, statut) {
  const s = getServicePlateforme(serviceId);
  if (!s || !SANTE_STATUTS[statut]) return false;
  s.statut = statut;
  journaliser('État de service modifié', s.nom, SANTE_STATUTS[statut].label + '.');
  if (typeof saveOyviaState === 'function') saveOyviaState();
  return true;
}

function ouvrirIncident({ serviceId, titre, gravite = 'mineur', note = '' }) {
  const inc = {
    id: prochainId('INC-', INCIDENTS), serviceId, titre, gravite, statut:'ouvert',
    ouvertLe: AUJOURDHUI, resoluLe: null, clients: [],
    journal: note ? [{ le: AUJOURDHUI + ' ' + heureCourante(), texte: note }] : [],
  };
  INCIDENTS.unshift(inc);
  // Un incident majeur ou critique dégrade le service concerné : laisser
  // la pastille au vert pendant qu'un incident est ouvert dessus serait
  // le meilleur moyen de ne plus jamais regarder les pastilles.
  const s = getServicePlateforme(serviceId);
  if (s && s.statut === 'ok') s.statut = gravite === 'critique' ? 'panne' : 'degrade';
  journaliser('Incident ouvert', inc.id, `${titre} — ${INCIDENT_GRAVITES[gravite].label}.`);
  if (typeof saveOyviaState === 'function') saveOyviaState();
  return inc;
}

function noterIncident(id, texte) {
  const i = getIncident(id);
  if (!i || !texte.trim()) return false;
  i.journal.push({ le: AUJOURDHUI + ' ' + heureCourante(), texte: texte.trim() });
  if (typeof saveOyviaState === 'function') saveOyviaState();
  return true;
}

function resoudreIncident(id, note = '') {
  const i = getIncident(id);
  if (!i || i.statut === 'resolu') return false;
  i.statut = 'resolu';
  i.resoluLe = AUJOURDHUI;
  if (note) i.journal.push({ le: AUJOURDHUI + ' ' + heureCourante(), texte: note });
  // Le service revient au vert si plus rien ne pèse dessus.
  const s = getServicePlateforme(i.serviceId);
  if (s && !incidentsService(i.serviceId).length) s.statut = 'ok';
  journaliser('Incident clos', i.id, note || i.titre);
  if (typeof saveOyviaState === 'function') saveOyviaState();
  return true;
}

/* ------------------------------------------------------------
   PERSISTANCE

   Déclaration tardive : data.js a déjà restauré son propre état quand ce
   fichier s'exécute. enregistrerEntitesOyvia rejoue la même fusion sur
   ces entités-ci et les inscrit dans la sauvegarde automatique.
   ------------------------------------------------------------ */
if (typeof enregistrerEntitesOyvia === 'function') {
  enregistrerEntitesOyvia({
    CLIENTS, FACTURES_SAAS, DEMANDES, SERVICES_PLATEFORME, INCIDENTS,
    JOURNAL_ADMIN, MEMBRES_OYVIA, ROLES_ADMIN, ADMIN_MEMBRE, MRR_HISTORIQUE,
  }, _apresRestaurationAdmin);
} else {
  _apresRestaurationAdmin();
}
