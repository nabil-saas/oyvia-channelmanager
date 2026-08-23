/* ============================================================
   OYVIA — Formulaire « nouvelle réservation », partagé

   Deux écrans créent une réservation : la liste des réservations et le
   calendrier, quand on découvre en bloquant des dates qu'il s'agit en
   fait d'un séjour. Recopier le formulaire dans les deux pages aurait
   garanti qu'ils divergent — la règle « on ne peut pas chevaucher une
   réservation existante » aurait fini par n'exister que d'un côté.

   Le gabarit est donc injecté ici, une fois, à la première ouverture.

   Usage :
     ResaForm.ouvrir();                                   // vierge
     ResaForm.ouvrir({ logementId, arrivee, depart });     // pré-rempli
     ResaForm.ouvrir({ onCree: r => … });                  // après création
   ============================================================ */
const ResaForm = (function () {

  let monte = false;
  let onCree = null;
  let champs = null;

  const GABARIT = `
    <div class="modal" id="resaform-modal" role="dialog" aria-modal="true" aria-labelledby="resaform-titre">
      <div class="modal__head">
        <h3 class="modal__title" id="resaform-titre">Nouvelle réservation</h3>
        <button class="icon-btn" onclick="UI.closeAll()" aria-label="Fermer">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="modal__body">
        <div class="app-grid app-grid--3">
          <div class="field"><label class="field__label" for="rf-prenom">Prénom</label>
            <input class="input" id="rf-prenom" placeholder="Emma" autocomplete="given-name" /></div>
          <div class="field"><label class="field__label" for="rf-nom">Nom</label>
            <input class="input" id="rf-nom" placeholder="Laurent" autocomplete="family-name" /></div>
          <div class="field"><label class="field__label" for="rf-tel">Téléphone</label>
            <input class="input" type="tel" id="rf-tel" placeholder="+33 6 12 45 78 90" autocomplete="tel" /></div>
        </div>
        <div class="app-grid app-grid--3" style="margin-top:var(--sp-4)">
          <div class="field"><label class="field__label" for="rf-log">Logement</label>
            <select class="select" id="rf-log"></select></div>
          <div class="field"><label class="field__label" for="rf-arrivee">Arrivée</label>
            <input class="input" type="date" id="rf-arrivee" /></div>
          <div class="field"><label class="field__label" for="rf-depart">Départ</label>
            <input class="input" type="date" id="rf-depart" /></div>
        </div>
        <div class="app-grid app-grid--3" style="margin-top:var(--sp-4)">
          <div class="field"><label class="field__label" for="rf-pers">Voyageurs</label>
            <input class="input" type="number" min="1" id="rf-pers" value="2" /></div>
          <div class="field"><label class="field__label" for="rf-montant">Montant (<span data-devise></span>)</label>
            <input class="input" type="number" min="0" id="rf-montant" value="0" /></div>
          <div class="field"><label class="field__label" for="rf-paiement">Paiement</label>
            <select class="select" id="rf-paiement">
              <option value="acompte">Acompte</option>
              <option value="paye">Payé</option>
              <option value="impaye">Impayé</option>
            </select></div>
        </div>
      </div>
      <div class="modal__foot">
        <button class="btn btn--secondary" onclick="UI.closeAll()">Annuler</button>
        <button class="btn btn--primary" id="rf-create">Créer la réservation</button>
      </div>
    </div>`;

  function monter() {
    if (monte) return;
    const hote = document.createElement('div');
    hote.innerHTML = GABARIT;
    document.body.appendChild(hote.firstElementChild);
    monte = true;

    const F = id => document.getElementById(id);
    champs = {
      prenom: F('rf-prenom'), nom: F('rf-nom'), tel: F('rf-tel'), log: F('rf-log'),
      arrivee: F('rf-arrivee'), depart: F('rf-depart'),
      pers: F('rf-pers'), montant: F('rf-montant'), paiement: F('rf-paiement'),
    };
    champs.log.innerHTML = LOGEMENTS.map(l => `<option value="${l.id}">${l.nom}</option>`).join('');
    // Le symbole de devise du libellé « Montant (€) » : layout.js ne le
    // remplit qu'au chargement, or ce gabarit arrive après.
    document.querySelectorAll('#resaform-modal [data-devise]').forEach(el => { el.textContent = symboleDevise(); });

    [champs.log, champs.arrivee, champs.depart].forEach(el => el.addEventListener('change', suggererMontant));

    /* Dates réellement réservables. Deux règles, différentes entre
       l'arrivée et le départ :

       · ARRIVÉE — toute nuit déjà vendue est impossible. Le jour de
         départ d'un autre séjour reste libre : c'est la rotation du
         même jour.
       · DÉPART — il ne doit pas ENJAMBER la réservation suivante. La
         borne haute est donc la première nuit occupée après l'arrivée :
         on peut partir le jour où l'autre arrive, pas après. Sans cette
         borne, on créerait un séjour à cheval sur un autre sans qu'aucun
         jour cliqué ne paraisse fautif. */
    DatePicker.range(champs.arrivee, champs.depart, () => ({
      labels: { debut: "l'arrivée", fin: 'le départ' },
      indispo: d => occupantNuit(champs.log.value, d),
      note: d => occupationLogement(champs.log.value, d),
      maxFin: debut => prochaineNuitOccupee(champs.log.value, debut),
      msgMax: 'Chevaucherait la réservation suivante',
      legende: [{ classe: 'off', texte: 'Nuit déjà vendue' }, { classe: 'note', texte: 'Arrivée ou départ ce jour-là' }],
    }));

    // Changer de logement invalide des dates choisies pour l'ancien.
    champs.log.addEventListener('change', () => {
      if (champs.arrivee.value && occupantNuit(champs.log.value, champs.arrivee.value)) {
        champs.arrivee.value = ''; champs.depart.value = '';
        UI.toast('Dates réinitialisées : elles ne sont pas libres sur ce logement', false);
      }
    });

    F('rf-create').addEventListener('click', creer);
  }

  function suggererMontant() {
    const l = getLogement(champs.log.value);
    if (!l) return;
    const n = nuitsEntre(champs.arrivee.value, champs.depart.value);
    // Suggestion calculée en euros, présentée dans la devise d'affichage.
    if (n > 0) champs.montant.value = montantSaisie(l.tarifBase * n + l.menageTarif);
  }

  /* Ultime garde-fou, en plus du sélecteur de dates : les champs `date`
     natifs se remplissent aussi au clavier, et une valeur pré-remplie
     par un autre écran peut avoir vieilli. Refuser ici, c'est refuser
     partout. */
  function chevauchement(logementId, arrivee, depart) {
    const occ = nuitsOccupees(logementId);
    for (let d = arrivee; d < depart; d = addDays(d, 1)) {
      const r = occ.get(d);
      if (r) return { date: d, resa: r };
    }
    return null;
  }

  /* Le voyageur saisi ici entre dans le fichier clients.

     Sans ça, le téléphone qu'on vient de demander ne s'afficherait
     nulle part : le panneau de réservation ne montre les coordonnées que
     pour un voyageur RATTACHÉ (`voyageurId`), et une réservation créée à
     la main n'en avait aucun. Demander une information qu'on ne restitue
     pas est la meilleure façon de la faire saisir n'importe comment.

     Un numéro déjà connu rattache au même voyageur plutôt que d'en
     créer un jumeau — c'est le téléphone qui identifie, pas
     l'orthographe du prénom. */
  function rattacherVoyageur(prenom, nom, tel, resa) {
    const nomComplet = `${prenom} ${nom}`.trim();
    const normalise = t => String(t || '').replace(/[^0-9+]/g, '');
    const connu = normalise(tel) && VOYAGEURS.find(v => normalise(v.tel) === normalise(tel));

    if (connu) {
      connu.nom = nomComplet || connu.nom;
      connu.nbSejours = (connu.nbSejours || 0) + 1;
      connu.totalDepense = (connu.totalDepense || 0) + resa.montant;
      connu.dernierSejour = resa.arrivee;
      return connu.id;
    }
    const n = VOYAGEURS.reduce((m, v) => Math.max(m, parseInt(String(v.id).replace(/\D/g, ''), 10) || 0), 0);
    const v = {
      id: 'V' + String(n + 1).padStart(2, '0'),
      nom: nomComplet, email: '', tel: tel.trim(), pays: '',
      nbSejours: 1, totalDepense: resa.montant, dernierSejour: resa.arrivee,
      note: 'Créé depuis une réservation saisie à la main.',
    };
    VOYAGEURS.push(v);
    return v.id;
  }

  function creer() {
    const prenom = champs.prenom.value.trim();
    const nom = champs.nom.value.trim();
    if (!prenom && !nom) return UI.toast('Renseignez le nom du voyageur', false);
    if (!champs.arrivee.value || !champs.depart.value
        || parseDate(champs.depart.value) <= parseDate(champs.arrivee.value)) {
      return UI.toast('Dates invalides', false);
    }
    const conflit = chevauchement(champs.log.value, champs.arrivee.value, champs.depart.value);
    if (conflit) {
      return UI.toast(`Le ${formatDate(conflit.date)} est déjà pris — ${conflit.resa.canal === 'bloque' ? 'dates bloquées' : conflit.resa.voyageur}`, false);
    }

    /* Canal imposé : DIRECT.

       Le choix a disparu du formulaire, et c'est cohérent — une
       réservation Airbnb ou Booking arrive par la synchronisation des
       canaux, elle ne se saisit pas à la main. Laisser cocher « Airbnb »
       permettait d'inventer une réservation de plateforme que la
       plateforme ignore : la ligne apparaissait dans les statistiques
       par canal et dans les commissions, sans exister nulle part
       ailleurs. Ce qu'on tape ici, on l'a pris soi-même. */
    const resa = {
      id: 'R' + Date.now(), logementId: champs.log.value, voyageurId: null,
      voyageur: `${prenom} ${nom}`.trim(), canal: 'direct',
      arrivee: champs.arrivee.value, depart: champs.depart.value,
      pers: parseInt(champs.pers.value, 10) || 1,
      montant: lireMontantSaisi(champs.montant.value, null) || 0,
      paiement: champs.paiement.value, statut: 'confirme',
      ref: 'CL-' + Math.floor(1000 + Math.random() * 9000),
      nuits: nuitsEntre(champs.arrivee.value, champs.depart.value),
    };
    resa.voyageurId = rattacherVoyageur(prenom, nom, champs.tel.value, resa);
    RESERVATIONS.push(resa);
    if (typeof saveOyviaState === 'function') saveOyviaState();

    UI.closeAll();
    document.dispatchEvent(new Event('resaChanged'));
    if (typeof onCree === 'function') onCree(resa);
    UI.toast('Réservation créée');
  }

  function ouvrir(opts = {}) {
    monter();
    onCree = opts.onCree || null;

    champs.prenom.value = '';
    champs.nom.value = '';
    champs.tel.value = '';
    if (opts.logementId && getLogement(opts.logementId)) champs.log.value = opts.logementId;
    // Des dates pré-remplies déjà occupées seraient refusées au moment de
    // valider : autant ne pas les proposer du tout.
    const libres = opts.arrivee && opts.depart && !chevauchement(champs.log.value, opts.arrivee, opts.depart);
    champs.arrivee.value = libres ? opts.arrivee : '';
    champs.depart.value = libres ? opts.depart : '';
    suggererMontant();

    UI.openPanel('resaform-modal');
    setTimeout(() => champs.prenom.focus(), 120);
  }

  return { ouvrir, chevauchement };
})();
