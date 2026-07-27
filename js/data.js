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

/* ---------- Petits utilitaires de formatage (globaux) ---------- */
function formatEuro(n, decimales = 0) {
  if (n === null || n === undefined) return 'Sur devis';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency', currency: 'EUR',
    minimumFractionDigits: decimales, maximumFractionDigits: decimales
  }).format(n);
}
// Tarification landing + abonnement (modèle « prix dégressif par logement géré »)
function formatMAD(n, decimales = 0) {
  if (n === null || n === undefined) return 'Sur devis';
  return n.toLocaleString('fr-FR', { minimumFractionDigits: decimales, maximumFractionDigits: decimales }) + ' MAD';
}
const MOIS_COURT = ['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
const MOIS_LONG  = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
const JOURS_COURT = ['dim.','lun.','mar.','mer.','jeu.','ven.','sam.'];
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
   LOGEMENTS (10)
   ============================================================ */
const LOGEMENTS = [
  { id:'L001', nom:'T2 Vieux-Lyon avec balcon', ville:'Lyon', quartier:'Vieux-Lyon', pays:'France',
    type:'T2', capacite:4, chambres:1, lits:2, sdb:1, tarifBase:95, menageTarif:45, couleur:'#B5654A',
    adresse:'12 rue du Bœuf, 69005 Lyon', note:4.9, avis:127,
    canaux:{ airbnb:'ok', booking:'ok', direct:'ok' },
    codeAcces:'A2481', wifi:{ ssid:'Oyvia-VieuxLyon', pass:'balcon2024' },
    equipements:['Wifi fibre','Balcon','Lave-linge','Cuisine équipée','Chauffage'] },

  { id:'L002', nom:'Studio Montmartre lumineux', ville:'Paris', quartier:'Montmartre', pays:'France',
    type:'Studio', capacite:2, chambres:1, lits:1, sdb:1, tarifBase:78, menageTarif:35, couleur:'#3D5A80',
    adresse:'8 rue Lepic, 75018 Paris', note:4.7, avis:203,
    canaux:{ airbnb:'ok', booking:'ok', direct:'ok' },
    codeAcces:'7734B', wifi:{ ssid:'OyviaParis18', pass:'lepic0018' },
    equipements:['Wifi','Ascenseur','Cuisine','Vue Sacré-Cœur'] },

  { id:'L003', nom:'Appartement Chartrons design', ville:'Bordeaux', quartier:'Chartrons', pays:'France',
    type:'T3', capacite:4, chambres:2, lits:3, sdb:1, tarifBase:88, menageTarif:40, couleur:'#5B7A6B',
    adresse:'24 cours de la Martinique, 33000 Bordeaux', note:4.8, avis:96,
    canaux:{ airbnb:'ok', booking:'attention', direct:'ok' },
    codeAcces:'C9012', wifi:{ ssid:'Oyvia-Chartrons', pass:'design2024' },
    equipements:['Wifi fibre','Parking','Lave-vaisselle','Terrasse'] },

  { id:'L004', nom:'Chalet vue lac d\'Annecy', ville:'Annecy', quartier:'Veyrier-du-Lac', pays:'France',
    type:'Chalet', capacite:6, chambres:3, lits:4, sdb:2, tarifBase:165, menageTarif:70, couleur:'#4A6A58',
    adresse:'5 chemin des Cyprès, 74290 Veyrier-du-Lac', note:5.0, avis:64,
    canaux:{ airbnb:'ok', booking:'ok', direct:'ok' },
    codeAcces:'CH440', wifi:{ ssid:'ChaletLac', pass:'annecy2024' },
    equipements:['Wifi','Cheminée','Vue lac','Parking 2 voitures','Jardin'] },

  { id:'L005', nom:'Villa front de mer', ville:'Biarritz', quartier:'Côte des Basques', pays:'France',
    type:'Villa', capacite:8, chambres:4, lits:5, sdb:3, tarifBase:240, menageTarif:90, couleur:'#C99A3C',
    adresse:'18 avenue de la Plage, 64200 Biarritz', note:4.9, avis:81,
    canaux:{ airbnb:'ok', booking:'ok', direct:'ok' },
    codeAcces:'VILLA6', wifi:{ ssid:'VillaBiarritz', pass:'ocean2024' },
    equipements:['Wifi','Piscine','Accès plage','Parking','Terrasse'] },

  { id:'L006', nom:'Loft Vieux-Port', ville:'Marseille', quartier:'Le Panier', pays:'France',
    type:'Loft', capacite:3, chambres:1, lits:2, sdb:1, tarifBase:82, menageTarif:35, couleur:'#8A5A3C',
    adresse:'3 rue du Panier, 13002 Marseille', note:4.6, avis:112,
    canaux:{ airbnb:'ok', booking:'ok', direct:'ok' },
    codeAcces:'P1330', wifi:{ ssid:'OyviaPanier', pass:'vieuxport13' },
    equipements:['Wifi','Climatisation','Vue port','Cuisine'] },

  { id:'L007', nom:'Studio Promenade des Anglais', ville:'Nice', quartier:'Promenade', pays:'France',
    type:'Studio', capacite:2, chambres:1, lits:1, sdb:1, tarifBase:72, menageTarif:30, couleur:'#3D6E80',
    adresse:'45 promenade des Anglais, 06000 Nice', note:4.7, avis:158,
    canaux:{ airbnb:'ok', booking:'ok', direct:'ok' },
    codeAcces:'NCE07', wifi:{ ssid:'OyviaNice', pass:'promenade06' },
    equipements:['Wifi','Climatisation','Balcon','Vue mer'] },

  { id:'L008', nom:'Maison de pêcheur', ville:'La Rochelle', quartier:'Vieux-Port', pays:'France',
    type:'Maison', capacite:5, chambres:2, lits:3, sdb:1, tarifBase:110, menageTarif:50, couleur:'#6E7A5B',
    adresse:'9 rue des Voiliers, 17000 La Rochelle', note:4.8, avis:73,
    canaux:{ airbnb:'ok', booking:'ok', direct:'ok' },
    codeAcces:'LR170', wifi:{ ssid:'MaisonPecheur', pass:'larochelle17' },
    equipements:['Wifi','Vélos','Jardin','Cuisine équipée','Barbecue'] },

  { id:'L009', nom:'Duplex Capitole', ville:'Toulouse', quartier:'Capitole', pays:'France',
    type:'Duplex', capacite:4, chambres:2, lits:2, sdb:1, tarifBase:84, menageTarif:38, couleur:'#9A5A6E',
    adresse:'2 place du Capitole, 31000 Toulouse', note:4.7, avis:89,
    canaux:{ airbnb:'ok', booking:'ok', direct:'attention' },
    codeAcces:'TLS09', wifi:{ ssid:'OyviaCapitole', pass:'toulouse31' },
    equipements:['Wifi','Cuisine','Machine à laver','Centre-ville'] },

  { id:'L010', nom:'T3 Presqu\'île rénové', ville:'Lyon', quartier:'Presqu\'île', pays:'France',
    type:'T3', capacite:5, chambres:2, lits:3, sdb:1, tarifBase:98, menageTarif:45, couleur:'#4A6A80',
    adresse:'30 rue de la République, 69002 Lyon', note:4.8, avis:104,
    canaux:{ airbnb:'ok', booking:'ok', direct:'ok' },
    codeAcces:'LY102', wifi:{ ssid:'OyviaPresquile', pass:'republique69' },
    equipements:['Wifi fibre','Ascenseur','Lave-vaisselle','Centre-ville'] },
];

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
   PROPRIÉTAIRES — la conciergerie gère les biens pour le compte
   de plusieurs propriétaires. Chaque propriétaire a son propre
   modèle de facturation (modeFacturation) :
     - reversement : la conciergerie encaisse le CA, prélève sa
       commission + les dépenses, puis reverse le net au propriétaire.
     - commission  : le propriétaire encaisse directement le CA ; la
       conciergerie lui facture uniquement sa commission (+ dépenses
       si refacturerDepenses est activé).
     - forfait     : abonnement mensuel fixe (forfaitMensuel),
       indépendant du nombre de réservations.
     - mixte       : commission + forfait mensuel fixe, dépenses
       généralement refacturées à part (courant en haut de gamme).
   ============================================================ */
const MODE_FACTURATION_LABEL = {
  reversement: 'Le gestionnaire encaisse & reverse le net',
  commission:  'Commission sur les réservations',
  forfait:     'Forfait mensuel',
  mixte:       'Mixte (commission + forfait)',
};
const MODE_FACTURATION_DESC = {
  reversement: 'Vous encaissez les réservations, prélevez votre commission et (si activé) les dépenses, puis reversez le net au propriétaire.',
  commission:  'Le propriétaire encaisse directement ses réservations ; vous lui facturez votre commission (et les dépenses si elles sont refacturées).',
  forfait:     'Vous facturez un montant fixe chaque mois, quel que soit le nombre de réservations.',
  mixte:       'Commission sur le CA + forfait mensuel fixe ; les dépenses sont généralement refacturées séparément.',
};
const PROPRIETAIRES = [
  { id:'O1', societe:'SCI Bernard',            contact:'Paul Bernard',  email:'paul.bernard@sci-bernard.fr', tel:'+33 6 12 34 56 78',
    modeFacturation:'reversement', commission:0.20, forfaitMensuel:0,   refacturerDepenses:true },
  { id:'O2', societe:'Investissements Lefort', contact:'Sophie Lefort',  email:'s.lefort@gmail.com',           tel:'+33 6 98 76 54 32',
    modeFacturation:'commission',  commission:0.18, forfaitMensuel:0,   refacturerDepenses:true },
  { id:'O3', societe:'Patrimoine Aziz',        contact:'Karim Aziz',     email:'k.aziz@gmail.com',             tel:'+33 6 45 67 89 01',
    modeFacturation:'mixte',       commission:0.10, forfaitMensuel:99,  refacturerDepenses:true },
];
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
   CONVERSATIONS (15) — reliées à une réservation
   canal : airbnb | booking | email
   ============================================================ */
const CONVERSATIONS = [
  { id:'C01', reservationId:'R07', canal:'airbnb', nonLu:2, horodatage:'09:12', messages:[
    { de:'voyageur', texte:'Bonjour ! J\'arrive aujourd\'hui vers 15h. Comment récupérer les clés ?', heure:'08:40' },
    { de:'hote',     texte:'Bonjour Nina, bienvenue ! L\'accès se fait par boîte à clés, code 7734B à droite de la porte.', heure:'08:52' },
    { de:'voyageur', texte:'Parfait, merci. Y a-t-il un ascenseur ? J\'ai une grosse valise.', heure:'09:10' },
    { de:'voyageur', texte:'Et à quelle heure dois-je libérer le logement le 26 ?', heure:'09:12' },
  ]},
  { id:'C02', reservationId:'R32', canal:'email', nonLu:1, horodatage:'08:55', messages:[
    { de:'voyageur', texte:'Bonjour, nous arrivons en voiture ce soir. Y a-t-il un parking à proximité ?', heure:'08:30' },
    { de:'hote',     texte:'Bonjour Antoine, oui, le parking République est à 100m (payant, environ 18€/jour).', heure:'08:48' },
    { de:'voyageur', texte:'Super, merci. On sera là vers 19h.', heure:'08:55' },
  ]},
  { id:'C03', reservationId:'R23', canal:'airbnb', nonLu:1, horodatage:'Hier', messages:[
    { de:'voyageur', texte:'Bonjour, le wifi ne fonctionne pas très bien dans la chambre. Une solution ?', heure:'Hier 21:15' },
    { de:'hote',     texte:'Désolé pour la gêne Marie. Pouvez-vous redémarrer la box (bouton à l\'arrière, 30s) ?', heure:'Hier 21:30' },
    { de:'voyageur', texte:'Ça remarche, merci beaucoup !', heure:'Hier 21:48' },
  ]},
  { id:'C04', reservationId:'R17', canal:'airbnb', nonLu:0, horodatage:'Hier', messages:[
    { de:'voyageur', texte:'Hi! Could you recommend a good seafood restaurant nearby?', heure:'Hier 18:20' },
    { de:'hote',     texte:'Bonjour James ! Essayez « Chez Albert » sur le port, à 10 min à pied. Réservez le soir.', heure:'Hier 18:40' },
    { de:'voyageur', texte:'Perfect, thank you!', heure:'Hier 19:02' },
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
  { id:'C08', reservationId:'R15', canal:'booking', nonLu:1, horodatage:'21 juil.', messages:[
    { de:'voyageur', texte:'Bonjour, je n\'ai pas encore réglé le solde. Puis-je payer à l\'arrivée ?', heure:'21 juil. 09:30' },
    { de:'hote',     texte:'Bonjour Elena, le solde doit être réglé 7 jours avant l\'arrivée via le lien envoyé.', heure:'21 juil. 10:00' },
    { de:'voyageur', texte:'D\'accord, je m\'en occupe cette semaine.', heure:'21 juil. 10:15' },
  ]},
  { id:'C09', reservationId:'R29', canal:'booking', nonLu:0, horodatage:'20 juil.', messages:[
    { de:'voyageur', texte:'Bonjour, les animaux sont-ils acceptés ? Nous avons un petit chien.', heure:'20 juil. 13:12' },
    { de:'hote',     texte:'Bonjour Zoé, oui les animaux calmes sont les bienvenus, sans supplément.', heure:'20 juil. 13:40' },
    { de:'voyageur', texte:'Génial, merci !', heure:'20 juil. 13:45' },
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
   PRESTATAIRES (5) — équipe ménage / maintenance
   ============================================================ */
const PRESTATAIRES = [
  { id:'P1', nom:'Sylvie Ménard',  role:'Ménage',      zone:'Lyon',         tel:'+33 6 22 44 11 09', tarifMenage:35 },
  { id:'P2', nom:'Karim Bouaziz',  role:'Polyvalent',  zone:'Paris',        tel:'+33 6 55 77 22 88', tarifMenage:40 },
  { id:'P3', nom:'Nadia Lopez',    role:'Ménage',      zone:'Sud-Ouest',    tel:'+33 6 88 33 55 12', tarifMenage:38 },
  { id:'P4', nom:'Marc Antoine',   role:'Maintenance', zone:'Multi-villes', tel:'+33 6 12 78 90 44', tarifMenage:0 },
  { id:'P5', nom:'Léna Fritsch',   role:'Ménage',      zone:'Sud-Est',      tel:'+33 6 44 90 11 77', tarifMenage:36 },
];

/* ============================================================
   TACHES (22) — ménage, check-in, maintenance, linge
   type : menage | checkin | maintenance | linge
   statut : a_faire | en_cours | termine
   ============================================================ */
const TACHES = [
  { id:'T01', type:'menage',      logementId:'L002', date:'2026-07-23', heure:'11:00', prestataireId:'P2', statut:'en_cours', montant:35, reservationId:'R06', note:'Rotation same-day : départ 11h → arrivée 15h' },
  { id:'T02', type:'menage',      logementId:'L003', date:'2026-07-23', heure:'11:30', prestataireId:'P3', statut:'a_faire',  montant:40, reservationId:'R10' },
  { id:'T03', type:'checkin',     logementId:'L010', date:'2026-07-23', heure:'18:30', prestataireId:'P1', statut:'a_faire',  montant:20, reservationId:'R32', note:'Accueil en personne demandé' },
  { id:'T04', type:'menage',      logementId:'L006', date:'2026-07-24', heure:'11:00', prestataireId:'P5', statut:'a_faire',  montant:35, reservationId:'R20' },
  { id:'T05', type:'linge',       logementId:'L007', date:'2026-07-24', heure:'09:00', prestataireId:'P5', statut:'a_faire',  montant:15, reservationId:null,  note:'Livraison linge propre' },
  { id:'T06', type:'menage',      logementId:'L009', date:'2026-07-24', heure:'12:00', prestataireId:'P3', statut:'a_faire',  montant:38, reservationId:'R29' },
  { id:'T07', type:'maintenance', logementId:'L005', date:'2026-07-24', heure:'15:00', prestataireId:'P4', statut:'a_faire',  montant:0,  reservationId:null,  note:'Vérifier pompe piscine' },
  { id:'T08', type:'menage',      logementId:'L004', date:'2026-07-25', heure:'11:00', prestataireId:'P5', statut:'a_faire',  montant:70, reservationId:'R14' },
  { id:'T09', type:'checkin',     logementId:'L004', date:'2026-07-25', heure:'16:00', prestataireId:'P5', statut:'a_faire',  montant:25, reservationId:'R14', note:'Installer lit bébé' },
  { id:'T10', type:'menage',      logementId:'L007', date:'2026-07-27', heure:'11:00', prestataireId:'P5', statut:'a_faire',  montant:30, reservationId:'R23' },
  { id:'T11', type:'menage',      logementId:'L010', date:'2026-07-27', heure:'11:30', prestataireId:'P1', statut:'a_faire',  montant:45, reservationId:'R32' },
  { id:'T12', type:'menage',      logementId:'L003', date:'2026-07-27', heure:'12:00', prestataireId:'P3', statut:'a_faire',  montant:40, reservationId:'R11', note:'Arrivée anticipée 13h possible' },
  { id:'T13', type:'menage',      logementId:'L002', date:'2026-07-26', heure:'11:00', prestataireId:'P2', statut:'a_faire',  montant:35, reservationId:'R07' },
  { id:'T14', type:'menage',      logementId:'L005', date:'2026-07-26', heure:'11:00', prestataireId:'P4', statut:'a_faire',  montant:90, reservationId:'R17' },
  { id:'T15', type:'menage',      logementId:'L008', date:'2026-07-26', heure:'12:00', prestataireId:'P3', statut:'a_faire',  montant:50, reservationId:'R26' },
  { id:'T16', type:'maintenance', logementId:'L001', date:'2026-07-28', heure:'10:00', prestataireId:'P4', statut:'a_faire',  montant:0,  reservationId:null,  note:'Changer joint robinet cuisine' },
  { id:'T17', type:'menage',      logementId:'L001', date:'2026-07-28', heure:'11:30', prestataireId:'P1', statut:'a_faire',  montant:45, reservationId:'R03' },
  { id:'T18', type:'menage',      logementId:'L009', date:'2026-07-29', heure:'11:00', prestataireId:'P3', statut:'a_faire',  montant:38, reservationId:'R29' },
  { id:'T19', type:'menage',      logementId:'L004', date:'2026-07-30', heure:'11:00', prestataireId:'P5', statut:'a_faire',  montant:70, reservationId:'R14' },
  { id:'T20', type:'menage',      logementId:'L008', date:'2026-08-01', heure:'11:00', prestataireId:'P3', statut:'a_faire',  montant:50, reservationId:'R26' },
  { id:'T21', type:'menage',      logementId:'L005', date:'2026-08-01', heure:'11:00', prestataireId:'P4', statut:'a_faire',  montant:90, reservationId:'R18' },
  { id:'T22', type:'menage',      logementId:'L001', date:'2026-07-22', heure:'11:00', prestataireId:'P1', statut:'termine',  montant:45, reservationId:'R02' },
];

/* ============================================================
   AUTOMATISATIONS (8)
   declencheur : reservation | j_moins_1 | jour_arrivee |
                 jour_depart | j_plus_1 | j_plus_3
   ============================================================ */
const AUTOMATISATIONS = [
  { id:'A1', nom:'Confirmation de réservation', declencheur:'reservation', actif:true, langue:'FR', canaux:'Tous', logements:'tous', envoyes:342,
    modele:'Bonjour {prenom}, votre réservation au {nom_logement} est confirmée pour le {date_arrivee}. Nous avons hâte de vous accueillir ! Toutes les infos pratiques vous seront envoyées la veille de votre arrivée.' },
  { id:'A2', nom:'Instructions d\'arrivée', declencheur:'j_moins_1', actif:true, langue:'FR', canaux:'Tous', logements:'tous', envoyes:318,
    modele:'Bonjour {prenom}, votre séjour approche ! Adresse : {adresse}. Le code d\'accès est {code_acces}. Wifi : {wifi}. Arrivée possible à partir de 15h. Bon voyage !' },
  { id:'A3', nom:'Message de bienvenue', declencheur:'jour_arrivee', actif:true, langue:'FR', canaux:'Tous', logements:'tous', envoyes:305,
    modele:'Bienvenue {prenom} ! Nous espérons que votre voyage s\'est bien passé. Le guide de bienvenue est dans l\'entrée. N\'hésitez pas à nous écrire pour toute question. Bon séjour !' },
  { id:'A4', nom:'Rappel départ & checklist', declencheur:'jour_depart', actif:true, langue:'FR', canaux:'Tous', logements:'tous', envoyes:289,
    modele:'Bonjour {prenom}, le départ est prévu avant 11h. Merci de laisser les clés dans la boîte et de fermer les fenêtres. Ce fut un plaisir de vous accueillir !' },
  { id:'A5', nom:'Demande d\'avis', declencheur:'j_plus_1', actif:true, langue:'FR', canaux:'Airbnb, Booking', logements:'tous', envoyes:276,
    modele:'Bonjour {prenom}, merci d\'avoir séjourné au {nom_logement} ! Si tout vous a plu, un avis nous aiderait beaucoup. Au plaisir de vous revoir bientôt.' },
  { id:'A6', nom:'Vérification mi-séjour', declencheur:'jour_arrivee', actif:false, langue:'FR', canaux:'Direct', logements:'sélection', envoyes:47,
    modele:'Bonjour {prenom}, tout se passe bien depuis votre arrivée ? N\'hésitez pas si vous avez besoin de quoi que ce soit.' },
  { id:'A7', nom:'Welcome message (EN)', declencheur:'jour_arrivee', actif:true, langue:'EN', canaux:'Tous', logements:'tous', envoyes:96,
    modele:'Welcome {prenom}! We hope you had a pleasant trip. The access code is {code_acces} and the Wifi is {wifi}. Enjoy your stay and reach out anytime!' },
  { id:'A8', nom:'Offre réservation directe', declencheur:'j_plus_3', actif:true, langue:'FR', canaux:'Airbnb, Booking', logements:'tous', envoyes:41,
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
   TARIFS — modèle unique : un tarif dégressif par logement géré
   (le nombre total de logements du parc, indépendamment du fait
   qu'ils aient été réservés ou non dans le mois).
   Utilisé à la fois par la landing (index.html#tarifs) et par
   l'abonnement de l'app (app/abonnement.html), pour rester cohérents.
   ============================================================ */
const TRANCHES_TARIFAIRES = [
  { min:1,   max:1,        prix:0   },
  { min:2,   max:5,        prix:150 },
  { min:6,   max:15,       prix:120 },
  { min:16,  max:30,       prix:100 },
  { min:31,  max:99,       prix:90  },
  { min:100, max:Infinity, prix:null },
];
function trancheTarifaire(n) { return TRANCHES_TARIFAIRES.find(t => n >= t.min && n <= t.max); }

// Option à la carte : WhatsApp, facturée AU MESSAGE (modèle inspiré de Twilio/Meta).
// Tarifs « tout compris » par catégorie de message. La fenêtre de service de 24 h est gratuite.
const OPTIONS_LANDING = [
  {
    id: 'whatsapp',
    nom: 'WhatsApp voyageur',
    desc: 'Messagerie WhatsApp centralisée dans Oyvia, facturée au message envoyé — sans abonnement mensuel.',
    tarifs: [
      { cat: 'Réponses & service', detail: 'Fenêtre de 24 h après un message du voyageur', prix: 0 },
      { cat: 'Message utilitaire', detail: 'Instructions d\'arrivée, code d\'accès, rappel', prix: 0.10 },
      { cat: 'Authentification',    detail: 'Envoi d\'un code à usage unique', prix: 0.10 },
      { cat: 'Message marketing',   detail: 'Offre, relance, demande d\'avis', prix: 0.40 },
    ],
  },
];

/* ============================================================
   HISTORIQUE DE FACTURATION (app/abonnement.html) — pour chaque
   mois, le nombre total de logements gérés à cette date (le parc
   grandit avec le temps ; le montant se déduit via trancheTarifaire,
   pas de valeur en dur). Dernier mois = mois en cours (juillet 2026,
   cf. AUJOURDHUI).
   ============================================================ */
const HISTORIQUE_FACTURATION = [
  { mois: 'Février 2026', nbLogements: 4 },
  { mois: 'Mars 2026',    nbLogements: 5 },
  { mois: 'Avril 2026',   nbLogements: 6 },
  { mois: 'Mai 2026',     nbLogements: 8 },
  { mois: 'Juin 2026',    nbLogements: 9 },
  { mois: 'Juillet 2026', nbLogements: 10 },
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

const COMPTE = {
  societe:'Conciergerie Lumia',
  nbLogements:10,             // logements gérés au total
  optionsActives:['whatsapp'],
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
  { id:'google',     section:'connexions',   nom:'Google',       lettre:'G', connecte:false, desc:"Affichez vos disponibilités sur Google (Recherche et Maps)." },
  { id:'pricelabs',  section:'applications', nom:'PriceLabs',    lettre:'P', connecte:false, desc:"Synchronisez une tarification dynamique, logement par logement." },
  { id:'ical',       section:'applications', nom:'iCal',         lettre:'I', connecte:true,  desc:"Importez un calendrier externe (Airbnb, Vrbo, Google…) pour bloquer les dates." },
];

/* ============================================================
   PARAMÈTRES GÉNÉRAUX — localisation & séjour
   (page Paramètres > Général)
   ============================================================ */
const PARAMETRES_GENERAUX = {
  devise:'MAD',
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
const CANAL_LABEL = { airbnb:'Airbnb', booking:'Booking.com', direct:'Direct', bloque:'Blocage' };
const PAIEMENT_LABEL = { paye:'Payé', acompte:'Acompte', impaye:'Impayé', rembourse:'Remboursé' };
const STATUT_LABEL = { confirme:'Confirmée', en_cours:'En cours', termine:'Terminée', annule:'Annulée' };

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
  // Urgentes d'abord, puis par proximité d'arrivée
  return notifs.sort((a, b) => {
    if (a.urgence !== b.urgence) return a.urgence === 'high' ? -1 : 1;
    return joursAvantArrivee(getReservation(a.resaId).arrivee) - joursAvantArrivee(getReservation(b.resaId).arrivee);
  });
}
const TACHE_LABEL = { menage:'Ménage', checkin:'Check-in', maintenance:'Maintenance', linge:'Linge' };
const DECLENCHEUR_LABEL = {
  reservation:'À la réservation', j_moins_1:'J-1 avant arrivée', jour_arrivee:'Jour de l\'arrivée',
  jour_depart:'Jour du départ', j_plus_1:'J+1 après départ', j_plus_3:'J+3 après départ',
};

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
const OYVIA_STATE_KEY = 'oyvia_state_v1';

// Entités mutables à sauvegarder/restaurer. Les données purement
// statiques (STATS, TRANCHES_TARIFAIRES, HISTORIQUE_FACTURATION…) ne
// sont jamais modifiées depuis l'UI et n'ont pas besoin d'être stockées.
const _OYVIA_ENTITIES = {
  LOGEMENTS, RESERVATIONS, VOYAGEURS, CONVERSATIONS, TACHES,
  PRESTATAIRES, AUTOMATISATIONS, RECURRENTES, PLATEFORMES,
  COMPTE, UTILISATEUR, PARAMETRES_GENERAUX, TACHE_LABEL,
  PROPRIETAIRES, DEPENSES, FACTURES,
  ROLES, UTILISATEURS,
};

(function _oyviaRestoreState() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(OYVIA_STATE_KEY)); } catch { saved = null; }
  if (!saved) return;
  Object.keys(_OYVIA_ENTITIES).forEach(name => {
    const ref = _OYVIA_ENTITIES[name];
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
})();

let _oyviaResetting = false;
function saveOyviaState() {
  if (_oyviaResetting) return; // une réinitialisation est en cours : ne pas réécrire l'ancien état
  try {
    const snapshot = {};
    Object.keys(_OYVIA_ENTITIES).forEach(name => { snapshot[name] = _OYVIA_ENTITIES[name]; });
    localStorage.setItem(OYVIA_STATE_KEY, JSON.stringify(snapshot));
  } catch (e) { /* quota dépassé, navigation privée… on ignore silencieusement */ }
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
