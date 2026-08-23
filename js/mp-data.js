/* ============================================================
   OYVIA — MARKETPLACE DES MANDATS (données)

   Des propriétaires déposent un bien à confier ; les conciergeries
   envoient une demande de gestion ; le propriétaire choisit.

   Trois partis pris structurent le fichier :

   1. LA CONCIERGERIE NE RÉDIGE RIEN. Sa demande est un rapport
      automatique, composé de ce que nous mesurons déjà d'elle :
      occupation moyenne, types de biens gérés, ancienneté, note des
      voyageurs. Un texte libre avantagerait ceux qui écrivent bien,
      pas ceux qui gèrent bien — et le propriétaire ne peut vérifier
      aucune des deux qualités dans une lettre de motivation.

   2. LE RAPPORT EST FIGÉ À L'ENVOI. On enregistre les chiffres du jour
      dans la demande. Les recalculer à l'affichage ferait varier une
      candidature après coup : le propriétaire lirait autre chose que
      ce que la conciergerie a envoyé.

   3. LA COMPATIBILITÉ SE CALCULE, ELLE NE SE DÉCLARE PAS. Le classement
      des demandes repose sur des faits comparables (type de bien
      réellement géré, occupation sur ce type, ville, capacité), pas sur
      un argumentaire.

   Tout ce qui concerne la marketplace vit dans les fichiers mp-*.
   ============================================================ */

const MP_AUJOURDHUI = typeof AUJOURDHUI !== 'undefined' ? AUJOURDHUI : '2026-07-23';

/* Familles de biens. On raisonne par FAMILLE et non par intitulé libre :
   « villa » et « riad » ne s'exploitent pas de la même façon, alors
   qu'un T2 et un appartement, si. C'est cette famille qui sert au
   rapprochement entre un bien et l'expérience d'une conciergerie. */
const MP_FAMILLES = {
  appartement: { label:'Appartement',  types:['Studio','T2','T3','T4','Appartement'] },
  maison:      { label:'Maison',       types:['Maison'] },
  villa:       { label:'Villa',        types:['Villa'] },
  riad:        { label:'Riad',         types:['Riad'] },
  chalet:      { label:'Chalet',       types:['Chalet'] },
};
function mpFamille(type) {
  const cle = Object.keys(MP_FAMILLES).find(k => MP_FAMILLES[k].types.includes(type));
  return cle || 'appartement';
}
function mpLabelFamille(cle) { return (MP_FAMILLES[cle] || {}).label || cle; }

const MP_STATUTS_DEMANDE = {
  envoyee:   { label:'Envoyée',       badge:'badge--neutral',  aide:"Le propriétaire n'a pas encore ouvert votre demande." },
  vue:       { label:'Vue',           badge:'badge--accent',   aide:'Votre demande a été consultée.' },
  discussion:{ label:'En discussion', badge:'badge--warning',  aide:'Le propriétaire vous a répondu, les échanges sont en cours.' },
  acceptee:  { label:'Acceptée',      badge:'badge--positive', aide:'Le bien vous est confié.' },
  refusee:   { label:'Refusée',       badge:'badge--danger',   aide:'Le propriétaire a retenu une autre conciergerie.' },
};

/* ------------------------------------------------------------
   Conciergeries inscrites

   `parType` : nombre de biens gérés et occupation moyenne, par famille.
   C'est la donnée qui rend le classement possible — une conciergerie
   excellente sur des studios urbains n'est pas la mieux placée pour un
   riad de cinq chambres, et une moyenne globale masquerait justement
   cette différence.
   ------------------------------------------------------------ */
const MP_CONCIERGERIES = [
  { id:'CG1', nom:'Conciergerie Lumia', ville:'Lyon', zones:['Lyon','Annecy'], depuis:2019,
    logements:10, capaciteRestante:6, note:4.8, delaiReponseMin:11, moi:true,
    parType:{ appartement:{ nb:7, occupation:81 }, maison:{ nb:2, occupation:74 }, chalet:{ nb:1, occupation:69 } } },

  { id:'CG2', nom:'Atlas Stays', ville:'Marrakech', zones:['Marrakech','Essaouira'], depuis:2017,
    logements:34, capaciteRestante:9, note:4.7, delaiReponseMin:7,
    parType:{ riad:{ nb:12, occupation:79 }, villa:{ nb:9, occupation:71 }, appartement:{ nb:13, occupation:84 } } },

  { id:'CG3', nom:'Medina Hosting', ville:'Marrakech', zones:['Marrakech'], depuis:2015,
    logements:23, capaciteRestante:2, note:4.5, delaiReponseMin:26,
    parType:{ riad:{ nb:15, occupation:73 }, appartement:{ nb:8, occupation:68 } } },

  { id:'CG4', nom:'Casa Nomad', ville:'Casablanca', zones:['Casablanca','Rabat'], depuis:2021,
    logements:9, capaciteRestante:5, note:4.6, delaiReponseMin:19,
    parType:{ appartement:{ nb:9, occupation:76 } } },

  { id:'CG5', nom:'Bleu Cassis', ville:'Marseille', zones:['Marseille','Cassis'], depuis:2021,
    logements:19, capaciteRestante:4, note:4.9, delaiReponseMin:14,
    parType:{ appartement:{ nb:12, occupation:72 }, maison:{ nb:7, occupation:66 } } },

  { id:'CG6', nom:'Alpes Évasion', ville:'Annecy', zones:['Annecy','Chamonix'], depuis:2015,
    logements:61, capaciteRestante:0, note:4.7, delaiReponseMin:31,
    parType:{ chalet:{ nb:38, occupation:70 }, appartement:{ nb:23, occupation:75 } } },

  { id:'CG7', nom:'Le Nid Bordelais', ville:'Bordeaux', zones:['Bordeaux','Arcachon'], depuis:2022,
    logements:14, capaciteRestante:8, note:4.4, delaiReponseMin:23,
    parType:{ appartement:{ nb:14, occupation:70 } } },

  { id:'CG8', nom:'Riviera Home', ville:'Nice', zones:['Nice','Villefranche'], depuis:2018,
    logements:40, capaciteRestante:11, note:4.6, delaiReponseMin:16,
    parType:{ appartement:{ nb:31, occupation:78 }, villa:{ nb:9, occupation:64 } } },
];
function mpConciergerie(id) { return MP_CONCIERGERIES.find(c => c.id === id) || null; }

// La conciergerie connectée au channel manager. Son nom suit celui du
// compte quand l'application est chargée : deux identités différentes
// pour un même utilisateur passeraient pour un bug.
const MP_MOI = 'CG1';
function mpMoi() {
  const c = mpConciergerie(MP_MOI) || MP_CONCIERGERIES[0];
  if (typeof COMPTE !== 'undefined' && COMPTE.societe) c.nom = COMPTE.societe;
  return c;
}

/* ------------------------------------------------------------
   Biens déposés par les propriétaires
   ------------------------------------------------------------ */
const MP_BIENS = [
  { id:'B01', ville:'Marrakech', quartier:'Guéliz',      type:'T2',          surface:70,  couchages:4,  publieLe:'2026-07-20', statut:'pris',
    proprietaire:{ prenom:'Yassine', nom:'Berrada', email:'y.berrada@example.ma', telephone:'+212 6 61 44 07 18' },
    revenuEstime:42000, dejaLoue:true, note:"Bien rénové en 2025, déjà loué en direct. Je cherche à déléguer entièrement." },

  { id:'B02', ville:'Marrakech', quartier:'Hivernage',   type:'T2',          surface:50,  couchages:4,  publieLe:'2026-07-17', statut:'disponible',
    proprietaire:{ prenom:'Salma', nom:'Idrissi', email:'salma.idrissi@example.ma', telephone:'+212 6 61 08 55 12' },
    revenuEstime:31000, dejaLoue:true, note:"Loué depuis deux ans, je pars vivre à l'étranger." },

  { id:'B03', ville:'Marrakech', quartier:'Palmeraie',   type:'Villa',       surface:240, couchages:8,  publieLe:'2026-07-18', statut:'disponible',
    proprietaire:{ prenom:'Antoine', nom:'Lemoine', email:'a.lemoine@example.fr', telephone:'+33 6 74 90 21 66' },
    revenuEstime:96000, dejaLoue:false, note:"Villa avec piscine, jamais louée. Je veux un interlocuteur unique sur place." },

  { id:'B04', ville:'Marrakech', quartier:'Médina',      type:'Riad',        surface:180, couchages:10, publieLe:'2026-07-02', statut:'disponible',
    proprietaire:{ prenom:'Hélène', nom:'Marchand', email:'helene.marchand@example.fr', telephone:'+33 6 24 88 10 55' },
    revenuEstime:78000, dejaLoue:true, note:"Riad de cinq chambres. Mon gestionnaire actuel arrête son activité." },

  { id:'B05', ville:'Casablanca', quartier:'Gauthier',   type:'Appartement', surface:65,  couchages:2,  publieLe:'2026-07-06', statut:'disponible',
    proprietaire:{ prenom:'Karim', nom:'Tazi', email:'karim.tazi@example.ma', telephone:'+212 6 12 55 09 87' },
    revenuEstime:26000, dejaLoue:false, note:"Appartement vide, je veux tester la location courte durée." },

  { id:'B06', ville:'Lyon', quartier:'Vieux-Lyon',       type:'T3',          surface:78,  couchages:6,  publieLe:'2026-07-21', statut:'disponible',
    proprietaire:{ prenom:'Claire', nom:'Vasseur', email:'c.vasseur@example.fr', telephone:'+33 6 45 33 90 02' },
    revenuEstime:34000, dejaLoue:true, note:"Je gère seule depuis trois ans, je n'y arrive plus. Comptes clairs exigés." },

  { id:'B07', ville:'Lyon', quartier:'Croix-Rousse',     type:'Studio',      surface:28,  couchages:2,  publieLe:'2026-07-22', statut:'disponible',
    proprietaire:{ prenom:'Serge', nom:'Vallet', email:'s.vallet@example.fr', telephone:'+33 6 71 05 42 18' },
    revenuEstime:14000, dejaLoue:false, note:"Studio libre depuis le départ de mon locataire." },

  { id:'B08', ville:'Annecy', quartier:'Bord du lac',    type:'Chalet',      surface:92,  couchages:6,  publieLe:'2026-06-26', statut:'pris',
    proprietaire:{ prenom:'Bertrand', nom:'Nogaro', email:'b.nogaro@example.fr', telephone:'+33 6 09 33 71 24' },
    revenuEstime:52000, dejaLoue:true, note:"Deux saisons pleines, je veux monter en gamme sur l'accueil." },

  { id:'B09', ville:'Bordeaux', quartier:'Chartrons',    type:'T2',          surface:54,  couchages:4,  publieLe:'2026-07-19', statut:'disponible',
    proprietaire:{ prenom:'Nathalie', nom:'Roche', email:'nathalie.roche@example.fr', telephone:'+33 6 45 12 88 74' },
    revenuEstime:22000, dejaLoue:true, note:"Je change de conciergerie : manque de transparence sur les comptes." },

  { id:'B10', ville:'Marseille', quartier:'Endoume',     type:'Maison',      surface:130, couchages:8,  publieLe:'2026-07-11', statut:'disponible',
    proprietaire:{ prenom:'Antoine', nom:'Ferrand', email:'a.ferrand@example.fr', telephone:'+33 6 12 76 44 90' },
    revenuEstime:38000, dejaLoue:true, note:"Maison familiale louée l'été, j'aimerais l'ouvrir à l'année." },

  { id:'B11', ville:'Nice', quartier:"Carré d'Or",       type:'T3',          surface:85,  couchages:6,  publieLe:'2026-06-17', statut:'disponible',
    proprietaire:{ prenom:'Vincent', nom:'Paoli', email:'v.paoli@example.fr', telephone:'+33 6 88 45 21 09' },
    revenuEstime:44000, dejaLoue:true, note:"Bien performant, je cherche mieux sur le remplissage hors saison." },

  { id:'B12', ville:'Paris', quartier:'11e — Oberkampf', type:'Studio',      surface:24,  couchages:2,  publieLe:'2026-07-14', statut:'disponible',
    proprietaire:{ prenom:'Léa', nom:'Bourdin', email:'lea.bourdin@example.fr', telephone:'+33 6 55 71 30 12' },
    revenuEstime:19000, dejaLoue:false, note:"Bail mobilité jusqu'ici, je bascule sur du court séjour." },
];
function mpBien(id) { return MP_BIENS.find(b => b.id === id) || null; }
function mpVilles() { return [...new Set(MP_BIENS.map(b => b.ville))].sort(); }
function mpTypes() { return [...new Set(MP_BIENS.map(b => b.type))].sort(); }

/* ------------------------------------------------------------
   Rapport de candidature

   Composé automatiquement à partir du profil de la conciergerie, et
   ORIENTÉ sur la famille du bien visé : c'est son expérience de ce
   type-là qui intéresse le propriétaire, pas sa moyenne toutes
   catégories confondues.
   ------------------------------------------------------------ */
const MP_FENETRE_MOIS = 12;   // profondeur des chiffres publiés

function mpRapport(conciergerie, bien) {
  const c = conciergerie;
  const famille = mpFamille(bien.type);
  const surFamille = c.parType[famille] || null;
  const anciennete = Number(String(MP_AUJOURDHUI).slice(0, 4)) - c.depuis;

  // Occupation globale : moyenne pondérée par le nombre de biens, sinon
  // une famille d'un seul logement pèserait autant qu'une de trente.
  const familles = Object.keys(c.parType);
  const total = familles.reduce((s, f) => s + c.parType[f].nb, 0) || 1;
  const occupationGlobale = Math.round(
    familles.reduce((s, f) => s + c.parType[f].occupation * c.parType[f].nb, 0) / total);

  return {
    conciergerieId: c.id,
    nom: c.nom,
    ville: c.ville,
    zones: c.zones.slice(),
    anciennete,
    logements: c.logements,
    note: c.note,
    delaiReponseMin: c.delaiReponseMin,
    occupationGlobale,
    fenetreMois: MP_FENETRE_MOIS,
    famille,
    // null = la conciergerie n'a jamais géré ce type de bien. On le dit
    // plutôt que de le taire : c'est une information utile au
    // propriétaire, et la cacher se retournerait contre nous.
    experienceFamille: surFamille ? { nb: surFamille.nb, occupation: surFamille.occupation } : null,
    parType: familles.map(f => ({ famille: f, label: mpLabelFamille(f), nb: c.parType[f].nb, occupation: c.parType[f].occupation })),
  };
}

/* ------------------------------------------------------------
   Score de compatibilité (côté administration)

   Quatre critères, pondérés. Le détail est renvoyé avec la note :
   un classement dont on ne peut pas expliquer l'ordre ne sert qu'à
   masquer un choix arbitraire.
   ------------------------------------------------------------ */
function mpCompatibilite(bien, conciergerie) {
  const famille = mpFamille(bien.type);
  const exp = conciergerie.parType[famille] || null;
  const criteres = [];

  // 1. Expérience du type de bien (40) — le critère décisif : gérer un
  //    riad n'a rien à voir avec gérer un studio.
  let ptsType = 0;
  if (exp) ptsType = exp.nb >= 8 ? 40 : exp.nb >= 3 ? 30 : 20;
  criteres.push({ label: 'Expérience du type de bien', sur: 40, points: ptsType,
    detail: exp ? `${exp.nb} ${mpLabelFamille(famille).toLowerCase()}${exp.nb > 1 ? 's' : ''} en gestion` : `Aucun ${mpLabelFamille(famille).toLowerCase()} géré` });

  // 2. Occupation obtenue sur ce type (30) — la performance là où elle
  //    compte, pas la moyenne du parc.
  const occ = exp ? exp.occupation : 0;
  const ptsOcc = !exp ? 0 : occ >= 80 ? 30 : occ >= 72 ? 22 : occ >= 65 ? 14 : 8;
  criteres.push({ label: 'Occupation sur ce type', sur: 30, points: ptsOcc,
    detail: exp ? `${occ} % sur ${MP_FENETRE_MOIS} mois` : 'Non mesurable' });

  // 3. Présence sur le secteur (20). Une conciergerie à trois cents
  //    kilomètres peut candidater, elle part simplement de plus loin.
  const surPlace = conciergerie.ville === bien.ville || conciergerie.zones.includes(bien.ville);
  criteres.push({ label: 'Présence sur le secteur', sur: 20, points: surPlace ? 20 : 4,
    detail: surPlace ? `Implantée à ${bien.ville}` : `Basée à ${conciergerie.ville}` });

  // 4. Capacité à prendre le bien (10). Une équipe saturée signera puis
  //    décevra : mieux vaut que cela pèse dès le classement.
  const cap = conciergerie.capaciteRestante;
  const ptsCap = cap >= 5 ? 10 : cap >= 2 ? 6 : cap >= 1 ? 3 : 0;
  criteres.push({ label: 'Capacité disponible', sur: 10, points: ptsCap,
    detail: cap > 0 ? `${cap} logement${cap > 1 ? 's' : ''} de marge` : 'Parc saturé' });

  const score = criteres.reduce((s, c) => s + c.points, 0);
  return {
    score,
    niveau: score >= 75 ? 'fort' : score >= 50 ? 'moyen' : 'faible',
    criteres,
  };
}
const MP_NIVEAUX = {
  fort:   { label:'Correspond bien',   badge:'badge--positive' },
  moyen:  { label:'Correspond en partie', badge:'badge--warning' },
  faible: { label:'Peu adapté',        badge:'badge--neutral' },
};

/* ------------------------------------------------------------
   Demandes de gestion

   Une par couple (bien, conciergerie). Le rapport y est figé au moment
   de l'envoi.
   ------------------------------------------------------------ */
const MP_DEMANDES = [
  { id:'DG1', bienId:'B01', conciergerieId:'CG1', envoyeeLe:'2026-07-20', statut:'refusee',
    suivi:[{ le:'2026-07-20', texte:'Demande envoyée' }, { le:'2026-07-21', texte:'Consultée par le propriétaire' }, { le:'2026-07-22', texte:'Une autre conciergerie a été retenue' }] },
  { id:'DG2', bienId:'B01', conciergerieId:'CG2', envoyeeLe:'2026-07-20', statut:'acceptee',
    suivi:[{ le:'2026-07-20', texte:'Demande envoyée' }, { le:'2026-07-21', texte:'Consultée par le propriétaire' }, { le:'2026-07-22', texte:'Mandat confirmé' }] },
  { id:'DG3', bienId:'B01', conciergerieId:'CG3', envoyeeLe:'2026-07-21', statut:'refusee',
    suivi:[{ le:'2026-07-21', texte:'Demande envoyée' }, { le:'2026-07-22', texte:'Une autre conciergerie a été retenue' }] },

  { id:'DG4', bienId:'B04', conciergerieId:'CG3', envoyeeLe:'2026-07-03', statut:'discussion',
    suivi:[{ le:'2026-07-03', texte:'Demande envoyée' }, { le:'2026-07-04', texte:'Consultée par le propriétaire' }, { le:'2026-07-08', texte:'Le propriétaire demande une visite' }] },
  { id:'DG5', bienId:'B04', conciergerieId:'CG2', envoyeeLe:'2026-07-04', statut:'vue',
    suivi:[{ le:'2026-07-04', texte:'Demande envoyée' }, { le:'2026-07-05', texte:'Consultée par le propriétaire' }] },

  { id:'DG6', bienId:'B03', conciergerieId:'CG2', envoyeeLe:'2026-07-19', statut:'vue',
    suivi:[{ le:'2026-07-19', texte:'Demande envoyée' }, { le:'2026-07-20', texte:'Consultée par le propriétaire' }] },
  { id:'DG7', bienId:'B03', conciergerieId:'CG8', envoyeeLe:'2026-07-20', statut:'envoyee',
    suivi:[{ le:'2026-07-20', texte:'Demande envoyée' }] },

  { id:'DG8', bienId:'B06', conciergerieId:'CG1', envoyeeLe:'2026-07-22', statut:'vue',
    suivi:[{ le:'2026-07-22', texte:'Demande envoyée' }, { le:'2026-07-23', texte:'Consultée par le propriétaire' }] },
  { id:'DG9', bienId:'B09', conciergerieId:'CG7', envoyeeLe:'2026-07-19', statut:'discussion',
    suivi:[{ le:'2026-07-19', texte:'Demande envoyée' }, { le:'2026-07-21', texte:'Échange en cours' }] },
  { id:'DG10', bienId:'B08', conciergerieId:'CG6', envoyeeLe:'2026-06-27', statut:'acceptee',
    suivi:[{ le:'2026-06-27', texte:'Demande envoyée' }, { le:'2026-07-01', texte:'Rendez-vous sur place' }, { le:'2026-07-05', texte:'Mandat confirmé' }] },
];

// Les rapports des demandes de démonstration sont calculés au chargement
// à partir des profils : les écrire à la main aurait garanti qu'ils
// divergent du jour où un profil change.
MP_DEMANDES.forEach(d => {
  if (!d.rapport) {
    const c = mpConciergerie(d.conciergerieId);
    const b = mpBien(d.bienId);
    if (c && b) d.rapport = mpRapport(c, b);
  }
});

function mpDemande(id) { return MP_DEMANDES.find(d => d.id === id) || null; }
function mpDemandesDuBien(bienId) { return MP_DEMANDES.filter(d => d.bienId === bienId); }
function mpMesDemandes() { return MP_DEMANDES.filter(d => d.conciergerieId === MP_MOI); }
function mpMaDemandePourBien(bienId) { return MP_DEMANDES.find(d => d.bienId === bienId && d.conciergerieId === MP_MOI) || null; }

/* Demandes d'un bien, classées par compatibilité. Le tri sert
   l'administration : c'est la vue qui permet de conseiller un
   propriétaire sans relire dix dossiers. */
function mpClassement(bienId) {
  const b = mpBien(bienId);
  if (!b) return [];
  return mpDemandesDuBien(bienId).map(d => {
    const c = mpConciergerie(d.conciergerieId);
    return { demande: d, conciergerie: c, compat: c ? mpCompatibilite(b, c) : null };
  }).sort((x, y) => {
    // Une candidature déjà acceptée passe en tête quel que soit son
    // score : le classement informe, il ne réécrit pas l'histoire.
    const rang = s => (s === 'acceptee' ? 0 : 1);
    if (rang(x.demande.statut) !== rang(y.demande.statut)) return rang(x.demande.statut) - rang(y.demande.statut);
    return (y.compat ? y.compat.score : 0) - (x.compat ? x.compat.score : 0);
  });
}

/* ------------------------------------------------------------
   Écriture
   ------------------------------------------------------------ */
function mpEnvoyerDemande(bienId) {
  const b = mpBien(bienId);
  const c = mpMoi();
  if (!b || b.statut === 'pris' || mpMaDemandePourBien(bienId)) return null;
  const n = MP_DEMANDES.reduce((m, d) => Math.max(m, parseInt(String(d.id).replace(/\D/g, ''), 10) || 0), 0);
  const demande = {
    id: 'DG' + (n + 1),
    bienId,
    conciergerieId: c.id,
    envoyeeLe: MP_AUJOURDHUI,
    statut: 'envoyee',
    rapport: mpRapport(c, b),
    suivi: [{ le: MP_AUJOURDHUI, texte: 'Demande envoyée' }],
  };
  MP_DEMANDES.unshift(demande);
  if (typeof saveOyviaState === 'function') saveOyviaState();
  return demande;
}

function mpRetirerDemande(id) {
  const i = MP_DEMANDES.findIndex(d => d.id === id);
  if (i < 0 || MP_DEMANDES[i].statut === 'acceptee') return false;
  MP_DEMANDES.splice(i, 1);
  if (typeof saveOyviaState === 'function') saveOyviaState();
  return true;
}

/* ------------------------------------------------------------
   Décision sur une candidature

   Retenir une conciergerie n'est pas un changement de statut, c'est
   quatre effets indissociables : la demande est acceptée, le bien est
   pourvu, les concurrentes sont écartées, et toutes sont prévenues.
   Les séparer laisserait un jour un bien « pourvu » avec trois
   candidatures encore « en discussion » — trois conciergeries qui
   attendent une réponse déjà donnée à quelqu'un d'autre.

   D'où une fonction unique, appelée par l'écran d'administration : la
   règle « un seul mandat par logement » se garde ici, pas dans le
   rendu.
   ------------------------------------------------------------ */
function mpMarquer(demande, texte) {
  (demande.suivi = demande.suivi || []).push({ le: MP_AUJOURDHUI, texte });
  // Ce qui déclenche la notification côté conciergerie. Elle s'éteint
  // quand la demande est ouverte dans « Mes prospects » : une alerte
  // qu'on ne peut pas faire disparaître cesse d'être lue.
  demande.decisionVue = false;
  demande.decideeLe = MP_AUJOURDHUI;
}

function mpAccepterDemande(id) {
  const d = mpDemande(id);
  if (!d) return { ok: false, raison: 'Demande introuvable.' };
  const b = mpBien(d.bienId);
  if (!b) return { ok: false, raison: 'Bien introuvable.' };

  const dejaRetenue = mpDemandesDuBien(b.id).find(x => x.statut === 'acceptee' && x.id !== id);
  if (dejaRetenue) {
    const c = mpConciergerie(dejaRetenue.conciergerieId);
    return { ok: false, raison: `Ce logement est déjà confié à ${c ? c.nom : 'une autre conciergerie'}.` };
  }
  if (d.statut === 'acceptee') return { ok: false, raison: 'Cette candidature est déjà retenue.' };

  d.statut = 'acceptee';
  mpMarquer(d, 'Mandat confirmé : le propriétaire vous a retenue');

  const ecartees = mpDemandesDuBien(b.id).filter(x => x.id !== id && x.statut !== 'refusee');
  ecartees.forEach(x => {
    x.statut = 'refusee';
    mpMarquer(x, 'Le propriétaire a retenu une autre conciergerie');
  });

  b.statut = 'pris';

  const gagnante = mpConciergerie(d.conciergerieId);
  if (typeof journaliser === 'function') {
    journaliser('Mandat attribué', `${b.type} · ${b.ville} — ${b.quartier}`,
      `${gagnante ? gagnante.nom : d.conciergerieId} retenue` +
      (ecartees.length ? ` · ${ecartees.length} candidature${ecartees.length > 1 ? 's' : ''} écartée${ecartees.length > 1 ? 's' : ''}` : ''));
  }
  if (typeof saveOyviaState === 'function') saveOyviaState();
  return { ok: true, bien: b, retenue: d, ecartees };
}

function mpRefuserDemande(id) {
  const d = mpDemande(id);
  if (!d) return { ok: false, raison: 'Demande introuvable.' };
  if (d.statut === 'refusee') return { ok: false, raison: 'Cette candidature est déjà écartée.' };
  const b = mpBien(d.bienId);

  /* Écarter la conciergerie retenue, c'est rompre un mandat : le bien
     redevient à pourvoir. Le cas est rare mais il existe, et le laisser
     « pourvu » sans titulaire serait pire qu'un clic malheureux. */
  const rompt = d.statut === 'acceptee';
  d.statut = 'refusee';
  mpMarquer(d, rompt ? 'Le propriétaire est revenu sur sa décision'
                     : 'Le propriétaire a retenu une autre conciergerie');
  if (rompt && b) b.statut = 'disponible';

  const c = mpConciergerie(d.conciergerieId);
  if (typeof journaliser === 'function' && b) {
    journaliser(rompt ? 'Mandat rompu' : 'Candidature écartée',
      `${b.type} · ${b.ville} — ${b.quartier}`, c ? c.nom : d.conciergerieId);
  }
  if (typeof saveOyviaState === 'function') saveOyviaState();
  return { ok: true, bien: b, toutesEcartees: b ? mpToutesEcartees(b) : false };
}

/* Aucune candidature ne convient. La décision ne se prend pas
   candidature par candidature — c'est le logement entier qu'on remet en
   recherche — donc une seule opération, et une seule vague de
   notifications. Refuser dix dossiers à la suite aurait produit le même
   résultat en dix clics, avec le risque de s'arrêter au septième. */
function mpEcarterToutes(bienId) {
  const b = mpBien(bienId);
  if (!b) return { ok: false, raison: 'Bien introuvable.' };
  const restantes = mpDemandesDuBien(bienId).filter(d => d.statut !== 'refusee');
  if (!restantes.length) return { ok: false, raison: 'Toutes les candidatures sont déjà écartées.' };

  restantes.forEach(d => {
    d.statut = 'refusee';
    mpMarquer(d, 'Le propriétaire n’a retenu aucune candidature');
  });
  b.statut = 'disponible';

  if (typeof journaliser === 'function') {
    journaliser('Candidatures écartées', `${b.type} · ${b.ville} — ${b.quartier}`,
      `${restantes.length} candidature${restantes.length > 1 ? 's' : ''} · logement remis en recherche`);
  }
  if (typeof saveOyviaState === 'function') saveOyviaState();
  return { ok: true, bien: b, ecartees: restantes };
}

// Toutes les candidatures reçues ont été écartées : le bien reste à
// pourvoir, mais plus personne n'est en lice. C'est un état qui appelle
// une action — d'où sa couleur propre dans les listes.
function mpToutesEcartees(bien) {
  const d = mpDemandesDuBien(bien.id);
  return bien.statut !== 'pris' && d.length > 0 && d.every(x => x.statut === 'refusee');
}

/* État d'un bien tel qu'on l'affiche côté Oyvia. Centralisé : trois
   écrans le montrent, et trois codes couleurs divergents en feraient
   trois vérités. */
const MP_ETATS_BIEN = {
  pourvu:   { label:'Mandat conclu', badge:'badge--positive' },
  ecarte:   { label:'À pourvoir',    badge:'badge--warning', note:'toutes écartées' },
  apourvoir:{ label:'À pourvoir',    badge:'badge--neutral' },
};
function mpEtatBien(bien) {
  if (bien.statut === 'pris') return Object.assign({ cle:'pourvu' }, MP_ETATS_BIEN.pourvu);
  if (mpToutesEcartees(bien)) return Object.assign({ cle:'ecarte' }, MP_ETATS_BIEN.ecarte);
  return Object.assign({ cle:'apourvoir' }, MP_ETATS_BIEN.apourvoir);
}

/* Décisions que la conciergerie connectée n'a pas encore lues. Sert au
   centre de notifications du channel manager. */
function mpDecisionsNonLues() {
  return mpMesDemandes().filter(d => d.decisionVue === false &&
    (d.statut === 'acceptee' || d.statut === 'refusee'));
}
function mpMarquerDecisionLue(id) {
  const d = mpDemande(id);
  if (!d || d.decisionVue !== false) return false;
  d.decisionVue = true;
  if (typeof saveOyviaState === 'function') saveOyviaState();
  return true;
}

/* ------------------------------------------------------------
   Utilitaires
   ------------------------------------------------------------ */
function mpJoursDepuis(iso) {
  const [a1, m1, j1] = MP_AUJOURDHUI.split('-').map(Number);
  const [a2, m2, j2] = iso.split('-').map(Number);
  return Math.round((Date.UTC(a1, m1 - 1, j1) - Date.UTC(a2, m2 - 1, j2)) / 86400000);
}
function mpEstRecent(b) { return b.statut === 'disponible' && mpJoursDepuis(b.publieLe) <= 10; }

// Ancienneté en toutes lettres. « il y a 0 j » se lit comme une panne
// d'affichage ; c'est pourtant le cas le plus fréquent le jour où une
// demande part.
function mpDepuis(iso) {
  const j = mpJoursDepuis(iso);
  if (j <= 0) return "aujourd'hui";
  if (j === 1) return 'hier';
  return `il y a ${j} j`;
}

const MP_MOIS = ['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
function mpDate(iso) {
  if (!iso) return '';
  const [a, m, j] = iso.split('-').map(Number);
  return `${j} ${MP_MOIS[m - 1]} ${a}`;
}
function mpDateCourte(iso) {
  if (!iso) return '';
  const [, m, j] = iso.split('-').map(Number);
  return `${j} ${MP_MOIS[m - 1]}`;
}
function mpEuros(n) {
  return new Intl.NumberFormat('fr-FR', { style:'currency', currency:'EUR', maximumFractionDigits:0 })
    .format(n || 0).replace(/ /g, ' ');
}
function mpTrancheRevenu(b) {
  const r = b.revenuEstime || 0;
  if (!r) return 'Non communiqué';
  if (r < 20000) return 'moins de 20 k€ / an';
  if (r < 40000) return '20 à 40 k€ / an';
  if (r < 70000) return '40 à 70 k€ / an';
  return 'plus de 70 k€ / an';
}
function mpEch(t) {
  return String(t == null ? '' : t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ------------------------------------------------------------
   Persistance

   Le channel manager et le back-office lisent le même instantané : une
   demande envoyée depuis la marketplace doit apparaître dans le
   classement interne, sans quoi les deux moitiés du produit se
   contrediraient.

   La migration recalcule les rapports manquants. Un enregistrement
   antérieur au rapport automatique restituerait des candidatures sans
   chiffres — affichées vides, elles passeraient pour un bug plutôt que
   pour une donnée d'un autre âge.
   ------------------------------------------------------------ */
if (typeof enregistrerEntitesOyvia === 'function') {
  enregistrerEntitesOyvia({ MP_BIENS, MP_DEMANDES }, function _migrerMarketplace() {
    MP_DEMANDES.forEach(d => {
      if (d.rapport) return;
      const c = mpConciergerie(d.conciergerieId), b = mpBien(d.bienId);
      if (c && b) d.rapport = mpRapport(c, b);
    });
  });
}
