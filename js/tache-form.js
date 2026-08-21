/* ============================================================
   OYVIA — Formulaire « ajouter une tâche », partagé

   Deux écrans créent une intervention : la gestion des tâches et le
   calendrier en mode Tâches prestataires. Comme pour les réservations,
   le gabarit est injecté ici une seule fois — dupliquer le formulaire
   aurait dupliqué ses règles, à commencer par le choix des dates
   planifiables, qui n'est pas celui d'une réservation.

   Usage :
     TacheForm.ouvrir();                                  // vierge
     TacheForm.ouvrir({ logementId, date });               // pré-rempli
     TacheForm.ouvrir({ onCree: t => … });                 // après création
   ============================================================ */
const TacheForm = (function () {

  let monte = false;
  let onCree = null;
  let champs = null;

  const GABARIT = `
    <div class="modal" id="tacheform-modal" role="dialog" aria-modal="true" aria-labelledby="tacheform-titre">
      <div class="modal__head">
        <h3 class="modal__title" id="tacheform-titre">Ajouter une tâche</h3>
        <button class="icon-btn" onclick="UI.closeAll()" aria-label="Fermer">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="modal__body">
        <div class="field"><label class="field__label" for="tf-logement">Logement</label>
          <select class="select" id="tf-logement"></select></div>
        <div class="mn-derived" id="tf-derived" style="margin-top:var(--sp-4)"></div>
        <div class="field mt-4"><label class="field__label" for="tf-type">Catégorie de tâche</label>
          <select class="select" id="tf-type"></select></div>
        <div class="field mt-4 hidden" id="tf-newtype-wrap">
          <label class="field__label" for="tf-newtype">Nom de la nouvelle catégorie</label>
          <input class="input" id="tf-newtype" placeholder="Ex. Jardinage, Piscine…" /></div>
        <div class="app-grid app-grid--2" style="margin-top:var(--sp-4)">
          <div class="field"><label class="field__label" for="tf-date">Date</label>
            <input class="input" type="date" id="tf-date" /></div>
          <div class="field"><label class="field__label" for="tf-heure">Heure</label>
            <input class="input" type="time" id="tf-heure" value="11:00" /></div>
        </div>
        <div class="field mt-4"><label class="field__label" for="tf-prest">Prestataire assigné</label>
          <select class="select" id="tf-prest"></select></div>
      </div>
      <div class="modal__foot">
        <button class="btn btn--secondary" onclick="UI.closeAll()">Annuler</button>
        <button class="btn btn--primary" id="tf-create">Créer la tâche</button>
      </div>
    </div>`;

  // Réservation en cours pour ce logement (aujourd'hui compris dans le
  // séjour) ; à défaut, la prochaine à venir. Sert à dater la tâche et à
  // la rattacher au séjour concerné.
  function reservationPourLogement(logementId) {
    const resas = RESERVATIONS.filter(r => r.logementId === logementId && r.canal !== 'bloque');
    const enCours = resas.find(r => parseDate(r.arrivee) <= parseDate(AUJOURDHUI) && parseDate(r.depart) >= parseDate(AUJOURDHUI));
    if (enCours) return { r: enCours, enCours: true };
    const aVenir = resas.filter(r => parseDate(r.arrivee) >= parseDate(AUJOURDHUI))
      .sort((a, b) => parseDate(a.arrivee) - parseDate(b.arrivee))[0];
    return aVenir ? { r: aVenir, enCours: false } : null;
  }

  function majDerive() {
    const box = champs.derived;
    const found = reservationPourLogement(champs.logement.value);
    if (!found) {
      box.innerHTML = 'Aucune réservation en cours ou à venir pour ce logement.';
      if (!champs.date.value) champs.date.value = AUJOURDHUI;
      return;
    }
    const { r, enCours } = found;
    box.innerHTML = `${enCours ? 'Réservation en cours' : 'Prochaine réservation'} : <b>${r.voyageur}</b> · ${formatPlage(r.arrivee, r.depart)}.`;
    // Un check-in se cale sur l'arrivée, tout le reste sur le départ :
    // c'est le moment où le logement se libère.
    champs.date.value = champs.type.value === 'checkin' ? r.arrivee : r.depart;
  }

  function monter() {
    if (monte) return;
    const hote = document.createElement('div');
    hote.innerHTML = GABARIT;
    document.body.appendChild(hote.firstElementChild);
    monte = true;

    const F = id => document.getElementById(id);
    champs = {
      logement: F('tf-logement'), type: F('tf-type'), date: F('tf-date'),
      heure: F('tf-heure'), prest: F('tf-prest'),
      newtype: F('tf-newtype'), newtypeWrap: F('tf-newtype-wrap'), derived: F('tf-derived'),
    };

    /* Dates planifiables pour une intervention. La frontière n'est pas
       celle d'une réservation, et c'est volontaire :

       · IMPOSSIBLE — planifier dans le passé. Rien d'autre : une équipe
         enchaîne plusieurs logements dans la journée, et un ménage de
         mi-séjour se fait justement pendant l'occupation. Griser ces cas
         interdirait des situations parfaitement légitimes.

       · SIGNALÉ — le voyageur est sur place, c'est un jour d'arrivée ou
         de départ, ou le prestataire a déjà des interventions ce jour-là.
         On donne l'information, la décision reste à l'utilisateur. */
    DatePicker.attach(champs.date, () => ({
      min: AUJOURDHUI,
      indispo: d => d < AUJOURDHUI ? 'Date passée' : null,
      note: d => {
        const bouts = [];
        const occ = occupationLogement(champs.logement.value, d);
        if (occ) bouts.push(occ);
        const charge = chargePrestataire(champs.prest.value, d);
        if (charge.length) {
          const p = PRESTATAIRES.find(x => x.id === champs.prest.value);
          bouts.push(`${p ? p.nom : 'Le prestataire'} : ${charge.length} intervention${charge.length > 1 ? 's' : ''} déjà prévue${charge.length > 1 ? 's' : ''}`);
        }
        return bouts.length ? bouts.join(' · ') : null;
      },
      legende: [{ classe: 'off', texte: 'Passé' }, { classe: 'note', texte: 'Voyageur sur place ou prestataire chargé' }],
    }));

    champs.logement.addEventListener('change', majDerive);
    champs.type.addEventListener('change', () => {
      champs.newtypeWrap.classList.toggle('hidden', champs.type.value !== '__new');
      majDerive();
    });
    F('tf-create').addEventListener('click', creer);
  }

  function creer() {
    const logementId = champs.logement.value;
    if (!logementId) return UI.toast('Sélectionnez un logement', false);
    if (!champs.date.value) return UI.toast('Choisissez une date', false);

    let type = champs.type.value;
    if (type === '__new') {
      const label = champs.newtype.value.trim();
      if (!label) return UI.toast('Nommez la nouvelle catégorie', false);
      type = 'c' + Date.now().toString().slice(-6);
      TACHE_LABEL[type] = label;
    }

    const found = reservationPourLogement(logementId);
    const tache = {
      id: 'T' + Date.now(), type, logementId,
      date: champs.date.value,
      heure: champs.heure.value || '11:00',
      prestataireId: champs.prest.value,
      statut: 'a_faire',
      reservationId: found ? found.r.id : null,
    };
    TACHES.push(tache);
    if (typeof saveOyviaState === 'function') saveOyviaState();

    UI.closeAll();
    document.dispatchEvent(new Event('tacheChanged'));
    if (typeof onCree === 'function') onCree(tache);
    UI.toast('Tâche créée');
  }

  function ouvrir(opts = {}) {
    monter();
    onCree = opts.onCree || null;

    champs.logement.innerHTML = LOGEMENTS.map(l => `<option value="${l.id}">${l.nom} — ${l.ville}</option>`).join('');
    champs.type.innerHTML = Object.entries(TACHE_LABEL).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')
      + '<option value="__new">＋ Nouvelle catégorie…</option>';
    champs.prest.innerHTML = PRESTATAIRES.map(p => `<option value="${p.id}">${p.nom}</option>`).join('');
    champs.newtypeWrap.classList.add('hidden');
    champs.heure.value = '11:00';
    champs.date.value = '';

    if (opts.logementId && getLogement(opts.logementId)) champs.logement.value = opts.logementId;
    majDerive();
    // La date proposée par l'appelant prime sur celle déduite du séjour :
    // ouvrir le formulaire depuis une case du calendrier doit parler de
    // CE jour-là. Une date passée est ignorée, le formulaire la refuserait.
    if (opts.date && opts.date >= AUJOURDHUI) champs.date.value = opts.date;

    UI.openPanel('tacheform-modal');
  }

  return { ouvrir };
})();
