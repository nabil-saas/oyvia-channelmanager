/* ============================================================
   OYVIA — Avis

   Deux sous-sections, parce que ce sont deux files d'attente
   différentes et non deux vues du même objet :

   · Logements — ce que les voyageurs ont écrit sur vos biens, tous
     canaux connectés confondus. Ce qui attend une réponse remonte en
     tête : c'est la seule chose sur laquelle il y a à agir.

   · Voyageurs — les séjours terminés que vous pouvez encore évaluer.
     Le tri suit l'urgence (délai le plus court d'abord), pas la
     chronologie, parce qu'une évaluation qui expire demain passe
     avant une qui expire dans dix jours.

   Les échelles de notation ne sont jamais converties à l'écran :
   Booking note sur 10, Airbnb sur 5, et les deux s'affichent avec
   leur dénominateur. Voir AVIS_CANAUX dans js/data.js.
   ============================================================ */
Layout.init('avis');

(function () {
  const elKpis = document.getElementById('av-kpis');
  const elTabs = document.getElementById('av-tabs');
  const elListe = document.getElementById('av-liste');
  const elVoy = document.getElementById('av-voyageurs');

  const fLogement = document.getElementById('av-f-logement');
  const fCanal    = document.getElementById('av-f-canal');
  const fStatut   = document.getElementById('av-f-statut');
  const gStatut   = document.getElementById('av-g-statut');

  let evaluationEnCours = null;   // { reservationId, note }

  const ic = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  /* Étoiles pleines/vides ramenées sur 5, avec la note d'origine en clair
     à côté : l'étoile donne l'ordre de grandeur, le texte donne la vérité. */
  function etoiles(note, canal) {
    const sur5 = avisNoteSur5(note, canal);
    let html = '';
    for (let i = 1; i <= 5; i++) {
      const pleine = sur5 >= i - 0.25;
      html += `<span class="av-star ${pleine ? 'is-on' : ''}" aria-hidden="true">${
        ic('<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z"/>')}</span>`;
    }
    return `<span class="av-stars" role="img" aria-label="${avisNoteTexte(note, canal)}">${html}</span>`;
  }

  function pastilleCanal(canal) {
    const c = avisCanal(canal);
    const cls = ['airbnb', 'booking', 'direct'].includes(canal) ? canal : 'direct';
    return `<span class="chip-canal chip-canal--${cls}">${c.label}</span>`;
  }

  /* ============================================================
     Compteurs
     ============================================================ */
  function renderKpis() {
    const attente = avisEnAttente().filter(avisRepondable);
    const aEvaluer = sejoursAEvaluer().filter(s => s.statut === 'a_faire');
    // Le plus urgent parmi ceux qui ont réellement une échéance.
    const urgent = aEvaluer.find(s => s.limite !== null);
    const moy = avisMoyenne(AVIS);
    const negatifs = AVIS.filter(a => avisNoteSur5(a.note, a.canal) < 4);

    const kpi = (label, valeur, pied, icone, alerte) => `
      <div class="kpi ${alerte ? 'kpi--alerte' : ''}">
        <div class="kpi__label">${label}</div>
        <div class="kpi__value">${valeur}</div>
        <div class="kpi__foot">${pied}</div>
        <div class="kpi__icon">${ic(icone)}</div>
      </div>`;

    elKpis.innerHTML = [
      kpi('Avis reçus', AVIS.length, `sur ${new Set(AVIS.map(a => a.logementId)).size} logements`,
        '<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z"/>'),
      kpi('Note moyenne', moy.toFixed(1).replace('.', ',') + '<span class="kpi__sur">/5</span>',
        'toutes plateformes, ramenées sur 5',
        '<path d="M3 16.5 8 10l4 3.5L21 4"/><path d="M16 4h5v5"/>'),
      kpi('En attente de réponse', attente.length,
        attente.length ? 'à traiter' : 'tout est répondu',
        '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>', attente.length > 0),
      kpi('Voyageurs à évaluer', aEvaluer.length,
        !aEvaluer.length ? 'aucun séjour en attente'
          : !urgent ? 'aucune échéance imposée'
          : urgent.joursRestants <= 0 ? "dernier jour pour le plus urgent"
          : `le plus urgent dans ${urgent.joursRestants} j`,
        '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>', aEvaluer.length > 0),
      kpi('Avis sous 4/5', negatifs.length, 'à surveiller de près',
        '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>'),
    ].join('');
  }

  /* ============================================================
     Onglet Logements
     ============================================================ */
  function remplirFiltres() {
    // Seuls les logements et canaux qui ont réellement des avis :
    // proposer un filtre qui ne renvoie jamais rien est une impasse.
    const logIds = [...new Set(AVIS.map(a => a.logementId))];
    fLogement.innerHTML = '<option value="all">Tous les logements</option>' +
      logIds.map(id => {
        const l = getLogement(id);
        return l ? `<option value="${id}">${esc(l.nom)}</option>` : '';
      }).join('');

    const canaux = [...new Set(AVIS.map(a => a.canal))];
    fCanal.innerHTML = '<option value="all">Toutes les plateformes</option>' +
      canaux.map(c => `<option value="${c}">${avisCanal(c).label}</option>`).join('');
  }

  function avisFiltres() {
    const l = fLogement.value, c = fCanal.value, s = fStatut.value;
    return AVIS.filter(a => {
      if (l !== 'all' && a.logementId !== l) return false;
      if (c !== 'all' && a.canal !== c) return false;
      if (s === 'attente' && a.reponse) return false;
      if (s === 'repondu' && !a.reponse) return false;
      return true;
    }).sort((x, y) => {
      // En attente d'abord — c'est la consigne de l'écran. À égalité,
      // le plus récent en premier.
      const ax = x.reponse ? 1 : 0, ay = y.reponse ? 1 : 0;
      if (ax !== ay) return ax - ay;
      return y.date.localeCompare(x.date);
    });
  }

  function carteAvis(a) {
    const l = getLogement(a.logementId);
    const v = getVoyageur(a.voyageurId);
    const repondable = avisRepondable(a);
    const enAttente = !a.reponse;

    const blocReponse = a.reponse
      ? `<div class="av-reponse">
           <div class="av-reponse__tete">
             <b>Votre réponse</b>
             <span>publiée le ${formatDate(a.reponseDate, { annee: true })}</span>
           </div>
           <p>${esc(a.reponse)}</p>
           <div class="av-reponse__actions">
             <button class="btn btn--ghost btn--sm" data-editer="${a.id}">Modifier</button>
           </div>
         </div>`
      : repondable
        ? `<div class="av-repondre" data-zone="${a.id}">
             <button class="btn btn--secondary btn--sm" data-ouvrir="${a.id}">
               ${ic('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>')}
               Répondre
             </button>
           </div>`
        // Canal débranché : on explique au lieu d'offrir un bouton qui
        // échouerait, la réponse n'ayant aucune passerelle pour partir.
        : `<p class="av-bloque">${avisCanal(a.canal).label} est déconnecté : la réponse ne pourrait pas être publiée.
             <a href="parametres.html">Reconnecter</a></p>`;

    return `
      <article class="card av-carte ${enAttente ? 'is-attente' : ''}" data-avis="${a.id}">
        <div class="av-carte__tete">
          <span class="thumb av-carte__vignette" style="background:${l ? l.couleur : 'var(--ink-300)'}">${l ? esc(l.nom.charAt(0)) : '?'}</span>
          <div class="grow">
            <b class="av-carte__logement">${l ? esc(l.nom) : 'Logement supprimé'}</b>
            <div class="av-carte__meta">
              ${pastilleCanal(a.canal)}
              <span>${v ? esc(v.nom) : 'Voyageur'}</span>
              <span>${formatDate(a.date, { annee: true })}</span>
            </div>
          </div>
          <div class="av-carte__note">
            ${etoiles(a.note, a.canal)}
            <b>${avisNoteTexte(a.note, a.canal)}</b>
          </div>
        </div>
        <p class="av-carte__texte">${esc(a.texte)}</p>
        ${blocReponse}
      </article>`;
  }

  function renderListe() {
    const liste = avisFiltres();
    const attente = liste.filter(a => !a.reponse).length;

    if (!liste.length) {
      elListe.innerHTML = `<div class="card"><div class="empty">
        ${ic('<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z"/>')}
        <h4>Aucun avis</h4><p>Aucun avis ne correspond à ces filtres.</p>
      </div></div>`;
      return;
    }

    elListe.innerHTML = `
      <p class="av-compte">${liste.length} avis${attente ? ` · <b>${attente} en attente de réponse</b>` : ''}</p>
      <div class="av-liste">${liste.map(carteAvis).join('')}</div>`;

    elListe.querySelectorAll('[data-ouvrir]').forEach(b =>
      b.addEventListener('click', () => ouvrirReponse(b.dataset.ouvrir, '')));
    elListe.querySelectorAll('[data-editer]').forEach(b =>
      b.addEventListener('click', () => ouvrirReponse(b.dataset.editer, getAvis(b.dataset.editer).reponse)));
  }

  /* Réponse en ligne plutôt qu'en modale : l'hôte doit relire l'avis
     pendant qu'il rédige, ce qu'une modale par-dessus lui interdirait. */
  function ouvrirReponse(id, valeur) {
    const a = getAvis(id);
    const carte = elListe.querySelector(`[data-avis="${id}"]`);
    if (!a || !carte) return;

    const existante = carte.querySelector('.av-reponse, .av-repondre');
    if (!existante) return;

    const form = document.createElement('div');
    form.className = 'av-form';
    form.innerHTML = `
      <label class="field__label" for="av-txt-${id}">Votre réponse publique sur ${avisCanal(a.canal).label}</label>
      <textarea class="textarea" id="av-txt-${id}" rows="3"
        placeholder="Remerciez, corrigez un point factuel, expliquez ce qui a été fait…">${esc(valeur || '')}</textarea>
      <p class="field__hint">Elle sera visible de tous les voyageurs sur ${avisCanal(a.canal).label}.</p>
      <div class="av-form__actions">
        <button class="btn btn--secondary btn--sm" data-annuler>Annuler</button>
        <button class="btn btn--primary btn--sm" data-envoyer>Publier la réponse</button>
      </div>`;
    existante.replaceWith(form);

    const zone = form.querySelector('textarea');
    zone.focus();
    zone.setSelectionRange(zone.value.length, zone.value.length);

    form.querySelector('[data-annuler]').addEventListener('click', () => renderListe());
    form.querySelector('[data-envoyer]').addEventListener('click', () => {
      const txt = zone.value.trim();
      if (!txt) { UI.toast('Écrivez une réponse avant de publier', false); return; }
      repondreAvis(id, txt);
      saveOyviaState();
      renderTout();
      UI.toast(`Réponse publiée sur ${avisCanal(a.canal).label}`);
    });
  }

  /* ============================================================
     Onglet Voyageurs
     ============================================================ */
  function ligneSejour(s) {
    const r = s.reservation;
    const v = getVoyageur(r.voyageurId);
    const l = getLogement(r.logementId);

    const etat = {
      a_faire: `<span class="badge badge--warning">À évaluer</span>`,
      fait:    `<span class="badge badge--positive">Évalué</span>`,
      expire:  `<span class="badge badge--neutral">Délai expiré</span>`,
    }[s.statut];

    // Une réservation directe n'a pas de plateforme pour imposer un délai :
    // afficher « Dernier jour » y serait une urgence inventée de toutes
    // pièces (c'est ce que produisait un joursRestants nul comparé à 0).
    const sansDelai = s.limite === null;
    const detail = s.statut === 'a_faire'
      ? sansDelai
        ? `<span class="text-xs text-muted">Sans date limite</span>`
        : `<span class="av-delai ${s.joursRestants <= 3 ? 'is-urgent' : ''}">${
            s.joursRestants <= 0 ? "Dernier jour" : `${s.joursRestants} j restants`}</span>`
      : s.statut === 'fait'
        ? `${etoiles(s.evaluation.note, 'direct')} <span class="text-xs text-muted">le ${formatDate(s.evaluation.date)}</span>`
        : `<span class="text-xs text-muted">clos le ${formatDate(s.limite)}</span>`;

    const action = s.statut === 'a_faire'
      ? `<button class="btn btn--primary btn--sm" data-evaluer="${r.id}">Évaluer</button>`
      : s.statut === 'fait'
        ? `<button class="btn btn--secondary btn--sm" data-evaluer="${r.id}">Modifier</button>`
        : `<span class="text-xs text-muted">Non modifiable</span>`;

    return `<tr>
      <td>
        <div class="row gap-3">
          <span class="avatar avatar--sm">${v ? esc(v.nom.split(' ').map(m => m[0]).join('').slice(0, 2)) : '?'}</span>
          <div>
            <b>${esc(r.voyageur)}</b>
            <div class="text-xs text-soft">${l ? esc(l.nom) : '—'}</div>
          </div>
        </div>
      </td>
      <td>${pastilleCanal(r.canal)}</td>
      <td class="text-sm">${formatPlage(r.arrivee, r.depart)}</td>
      <td>${etat}</td>
      <td class="text-sm">${detail}</td>
      <td style="text-align:right">${action}</td>
    </tr>`;
  }

  function renderVoyageurs() {
    const f = gStatut.value;
    const liste = sejoursAEvaluer().filter(s => f === 'all' || s.statut === f);
    const aFaire = sejoursAEvaluer().filter(s => s.statut === 'a_faire').length;

    if (!liste.length) {
      elVoy.innerHTML = `<div class="card"><div class="empty">
        ${ic('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>')}
        <h4>Aucun séjour</h4><p>Aucun séjour terminé ne correspond à ce filtre.</p>
      </div></div>`;
      return;
    }

    elVoy.innerHTML = `
      <p class="av-compte">${liste.length} séjour${liste.length > 1 ? 's' : ''} terminé${liste.length > 1 ? 's' : ''}${
        aFaire ? ` · <b>${aFaire} à évaluer</b>` : ''}</p>
      <div class="table-wrap">
        <table class="table">
          <thead><tr>
            <th>Voyageur</th><th>Plateforme</th><th>Séjour</th><th>Statut</th><th>Détail</th><th></th>
          </tr></thead>
          <tbody>${liste.map(ligneSejour).join('')}</tbody>
        </table>
      </div>
      <p class="text-xs text-muted mt-3">
        Le délai d'évaluation court à partir du départ et dépend de la plateforme
        (${Object.values(AVIS_CANAUX).filter(c => c.delaiEvaluation)
            .map(c => `${c.label} : ${c.delaiEvaluation} j`).join(' · ')}).
        Passé ce délai, la plateforme n'accepte plus l'évaluation.
      </p>`;

    elVoy.querySelectorAll('[data-evaluer]').forEach(b =>
      b.addEventListener('click', () => ouvrirEvaluation(b.dataset.evaluer)));
  }

  /* ---------- Modale d'évaluation ---------- */
  function ouvrirEvaluation(reservationId) {
    const r = getReservation(reservationId);
    if (!r) return;
    const ex = evaluationDe(reservationId);
    evaluationEnCours = { reservationId, note: ex ? ex.note : 0 };

    const l = getLogement(r.logementId);
    document.getElementById('av-modal-title').textContent = `Évaluer ${r.voyageur}`;
    document.getElementById('av-modal-body').innerHTML = `
      <p class="text-sm text-soft mb-4">
        ${l ? esc(l.nom) : ''} · ${formatPlage(r.arrivee, r.depart)} ·
        envoyé sur <b>${avisCanal(r.canal).label}</b>.
      </p>
      <div class="field mb-4">
        <span class="field__label">Note</span>
        <div class="av-notes" id="av-notes" role="radiogroup" aria-label="Note de 1 à 5">
          ${[1, 2, 3, 4, 5].map(n => `
            <button type="button" class="av-note" data-note="${n}" role="radio"
              aria-checked="false" aria-label="${n} sur 5">
              ${ic('<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z"/>')}
            </button>`).join('')}
          <span class="av-notes__valeur" id="av-note-txt">Aucune note</span>
        </div>
      </div>
      <div class="field">
        <label class="field__label" for="av-eval-txt">Commentaire</label>
        <textarea class="textarea" id="av-eval-txt" rows="4"
          placeholder="Ce voyageur a-t-il respecté le logement, communiqué clairement, rendu les lieux en ordre ?">${ex ? esc(ex.texte) : ''}</textarea>
        <span class="field__hint">Visible par les autres hôtes de ${avisCanal(r.canal).label}.</span>
      </div>`;

    const zone = document.getElementById('av-notes');
    const majNote = () => {
      zone.querySelectorAll('.av-note').forEach(b => {
        const on = Number(b.dataset.note) <= evaluationEnCours.note;
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-checked', String(Number(b.dataset.note) === evaluationEnCours.note));
      });
      document.getElementById('av-note-txt').textContent =
        evaluationEnCours.note ? `${evaluationEnCours.note}/5` : 'Aucune note';
    };
    zone.querySelectorAll('.av-note').forEach(b =>
      b.addEventListener('click', () => { evaluationEnCours.note = Number(b.dataset.note); majNote(); }));
    majNote();

    const ok = document.getElementById('av-modal-ok');
    ok.textContent = ex ? "Mettre à jour l'évaluation" : "Envoyer l'évaluation";
    const frais = ok.cloneNode(true);
    ok.parentNode.replaceChild(frais, ok);
    frais.addEventListener('click', () => {
      const txt = document.getElementById('av-eval-txt').value.trim();
      if (!evaluationEnCours.note) { UI.toast('Choisissez une note de 1 à 5', false); return; }
      if (!txt) { UI.toast('Écrivez un commentaire', false); return; }
      const res = evaluerVoyageur(reservationId, evaluationEnCours.note, txt);
      if (!res) { UI.toast("Le délai d'évaluation est dépassé", false); return; }
      saveOyviaState(); UI.closeAll(); renderTout();
      UI.toast(`Évaluation envoyée sur ${avisCanal(r.canal).label}`);
    });

    UI.openPanel('av-modal');
  }

  /* ---------- Onglets & rendu ---------- */
  const panes = [...document.querySelectorAll('.tabpane')];
  elTabs.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    elTabs.querySelectorAll('button').forEach(x => x.classList.remove('is-active'));
    b.classList.add('is-active');
    panes.forEach(p => p.classList.toggle('is-active', p.dataset.pane === b.dataset.tab));
  });

  [fLogement, fCanal, fStatut].forEach(el => el.addEventListener('change', renderListe));
  gStatut.addEventListener('change', renderVoyageurs);

  function renderTout() {
    renderKpis();
    renderListe();
    renderVoyageurs();
    // La pastille du menu compte les avis sans réponse et les évaluations
    // à faire : répondre ici doit la faire baisser tout de suite.
    Layout.refreshSidebarBadges();
  }

  remplirFiltres();
  renderTout();
})();
