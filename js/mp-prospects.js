/* ============================================================
   OYVIA — Mes prospects : suivi des demandes de gestion

   La question à laquelle cet écran répond n'est pas « combien de
   demandes ai-je envoyées » mais « lesquelles avancent, lesquelles
   dorment ». D'où deux choix :

   — Un rappel du DÉLAI depuis le dernier mouvement sur chaque ligne. Une
     demande envoyée il y a dix jours et jamais ouverte n'est pas au même
     endroit qu'une demande vue hier : c'est le même statut à l'écran,
     ce n'est pas la même action à mener.

   — Un fil chronologique dans le panneau plutôt qu'une simple étiquette
     de statut. Ce qui se négocie ici se joue sur plusieurs échanges ;
     l'historique est le dossier.
   ============================================================ */
Layout.init('prospects');

/* La marketplace n'a plus d'entrée dans le menu : Layout.init ne trouve
   donc pas son écran et retombe sur le premier du produit, dont il
   reprend le titre. On repose le nôtre juste après. */
document.title = 'Oyvia — Mes prospects';
(function () {
  const t = document.querySelector('.app-topbar__title');
  if (t) t.textContent = 'Mes prospects';
})();

(function () {
  const F = id => document.getElementById(id);
  const ech = t => String(t == null ? '' : t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  let filtreStatut = 'tous';

  F('mp-f-statut').innerHTML = '<option value="tous">Toutes les demandes</option>' +
    Object.keys(MP_STATUTS_DEMANDE).map(k => `<option value="${k}">${MP_STATUTS_DEMANDE[k].label}</option>`).join('');

  function triees() {
    // Ce qui est vivant d'abord, ce qui est clos ensuite : une demande
    // refusée n'appelle plus de décision, elle ne doit pas occuper le
    // haut de la liste.
    const rang = { discussion: 0, vue: 1, envoyee: 2, acceptee: 3, refusee: 4 };
    return mpMesDemandes()
      .filter(d => filtreStatut === 'tous' || d.statut === filtreStatut)
      .sort((a, b) => (rang[a.statut] - rang[b.statut]) || b.envoyeeLe.localeCompare(a.envoyeeLe));
  }

  function dernierMouvement(d) {
    const dernier = d.suivi[d.suivi.length - 1];
    return dernier ? dernier.le : d.envoyeeLe;
  }

  /* ---------- Compteurs par étape ---------- */
  function renderPipeline() {
    const etapes = ['envoyee', 'vue', 'discussion', 'acceptee'];
    F('mp-pipeline').innerHTML = etapes.map(k => {
      const n = mpMesDemandes().filter(d => d.statut === k).length;
      return `
        <button type="button" class="mp-etape ${filtreStatut === k ? 'is-active' : ''}" data-etape="${k}">
          <span class="mp-etape__n">${n}</span>
          <span class="mp-etape__label">${MP_STATUTS_DEMANDE[k].label}</span>
        </button>`;
    }).join('') + `
      <div class="mp-etape mp-etape--info">
        <span class="mp-etape__n">${mpMesDemandes().filter(d => d.statut === 'refusee').length}</span>
        <span class="mp-etape__label">Refusées</span>
      </div>`;
  }

  /* ---------- Liste ---------- */
  function renderListe() {
    const l = triees();
    F('mp-p-compteur').textContent = `${l.length} demande${l.length > 1 ? 's' : ''} sur ${mpMesDemandes().length}`;

    if (!l.length) {
      F('mp-prospects').innerHTML = `
        <div class="mp-vide">
          <h4>Aucune demande</h4>
          <p>Vos demandes de gestion apparaîtront ici, avec leur avancement.
             <a href="marketplace.html">Parcourir les biens disponibles</a>.</p>
        </div>`;
      return;
    }

    F('mp-prospects').innerHTML = `
      <div class="table-wrap">
        <table class="table">
          <thead><tr>
            <th>Bien</th><th>Envoyée</th><th>Dernier mouvement</th><th>Statut</th><th></th>
          </tr></thead>
          <tbody>${l.map(ligne).join('')}</tbody>
        </table>
      </div>`;
  }

  function ligne(d) {
    const b = mpBien(d.bienId);
    const jours = mpJoursDepuis(dernierMouvement(d));
    // Une demande sans nouvelle depuis une semaine mérite d'être
    // signalée : c'est le moment de relancer, pas d'attendre encore.
    const dort = jours >= 7 && (d.statut === 'envoyee' || d.statut === 'vue');
    return `
      <tr class="mp-clic" data-demande="${d.id}">
        <td>
          <b>${b ? ech(b.type + ' · ' + b.ville) : 'Bien retiré'}</b>
          <div class="text-xs text-muted">${b ? ech(b.quartier) : ''}</div>
        </td>
        <td class="text-sm">${ech(formatDate(d.envoyeeLe))}</td>
        <td class="text-sm">
          ${mpDepuis(dernierMouvement(d))}
          ${dort ? '<span class="mp-alerte">à relancer</span>' : ''}
        </td>
        <td><span class="badge ${MP_STATUTS_DEMANDE[d.statut].badge}">${MP_STATUTS_DEMANDE[d.statut].label}</span>
          ${d.decisionVue === false ? '<span class="mp-neuf">non lu</span>' : ''}</td>
        <td style="text-align:right"><button class="icon-btn" data-demande="${d.id}" aria-label="Ouvrir le suivi">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg>
        </button></td>
      </tr>`;
  }

  /* ---------- Panneau de suivi ---------- */
  function ouvrirSuivi(id) {
    const d = mpDemande(id);
    if (!d) return;
    const b = mpBien(d.bienId);
    const ouvert = d.statut === 'acceptee';
    const p = b ? b.proprietaire : null;

    // La réponse du propriétaire est lue : l'alerte de la cloche s'éteint.
    // Une notification qu'on ne peut pas faire disparaître finit ignorée.
    const nonLue = d.decisionVue === false;
    mpMarquerDecisionLue(d.id);

    F('mp-panel-titre').textContent = b ? `${b.type} · ${b.ville}` : 'Demande';
    F('mp-panel-corps').innerHTML = `
      <div class="row-between mb-4">
        <span class="badge ${MP_STATUTS_DEMANDE[d.statut].badge}">${MP_STATUTS_DEMANDE[d.statut].label}</span>
        <span class="text-xs text-muted">Envoyée le ${ech(formatDate(d.envoyeeLe, { annee: true }))}</span>
      </div>
      ${nonLue && d.statut === 'acceptee' ? `
        <div class="mp-reponse mp-reponse--oui">
          <b>Le propriétaire vous a retenue.</b>
          <p>Le logement vous est confié : ses coordonnées sont ci-dessous.</p>
        </div>` : ''}
      ${nonLue && d.statut === 'refusee' ? `
        <div class="mp-reponse mp-reponse--non">
          <b>Le propriétaire a choisi une autre conciergerie.</b>
          <p>Votre dossier n'est pas en cause : un seul mandat est attribué par logement.</p>
        </div>` : ''}
      ${nonLue && (d.statut === 'acceptee' || d.statut === 'refusee') ? ''
        : `<p class="text-sm text-muted mb-4">${ech(MP_STATUTS_DEMANDE[d.statut].aide)}</p>`}

      ${b ? `
        <p class="eyebrow mb-2">Le bien</p>
        <div class="mp-recap mb-4">
          <div><span>Localisation</span><b>${ech(b.quartier)}, ${ech(b.ville)}</b></div>
          <div><span>Type</span><b>${ech(b.type)}</b></div>
        </div>` : ''}

      ${ouvert && p ? `
        <p class="eyebrow mb-2">Propriétaire</p>
        <div class="mp-recap mb-4">
          <div><span>Contact</span><b>${ech(p.prenom)} ${ech(p.nom)}</b></div>
          <div><span>Courriel</span><b>${ech(p.email)}</b></div>
          <div><span>Téléphone</span><b>${ech(p.telephone)}</b></div>
        </div>` : ''}

      <p class="eyebrow mb-2">Rapport envoyé</p>
      ${d.rapport ? `
        <div class="mp-recap mb-4">
          <div><span>Occupation moyenne</span><b>${d.rapport.occupationGlobale} %</b></div>
          <div><span>Note voyageurs</span><b>${String(d.rapport.note).replace('.', ',')}/5</b></div>
          <div><span>Logements gérés</span><b>${d.rapport.logements}</b></div>
          <div><span>Sur ce type de bien</span><b>${d.rapport.experienceFamille
            ? `${d.rapport.experienceFamille.nb} biens · ${d.rapport.experienceFamille.occupation} %`
            : 'aucune référence'}</b></div>
        </div>
        <p class="field__hint mb-4">Chiffres figés au ${ech(mpDate(d.envoyeeLe))} : ils ne changent plus après l'envoi.</p>`
        : '<p class="text-sm text-muted mb-4">Rapport indisponible.</p>'}

      <p class="eyebrow mb-2">Suivi</p>
      <div class="mp-fil">
        ${d.suivi.slice().reverse().map((e, i) => `
          <div class="mp-fil__pt ${i === 0 ? 'is-fort' : ''}">
            <p class="mp-fil__date">${ech(formatDate(e.le, { annee: true }))}</p>
            <p class="mp-fil__txt">${ech(e.texte)}</p>
          </div>`).join('')}
      </div>`;

    // Retirer une candidature acceptée reviendrait à annuler un mandat
    // depuis un écran de prospection : l'action n'est pas proposée.
    F('mp-panel-pied').innerHTML = `
      <button class="btn btn--secondary" onclick="UI.closeAll()">Fermer</button>
      ${b && b.statut === 'disponible' ? `<a class="btn btn--ghost" href="marketplace.html">Voir l'annonce</a>` : ''}
      ${d.statut === 'acceptee' || d.statut === 'refusee' ? '' :
        `<button class="btn btn--danger" id="mp-retirer">Retirer ma demande</button>`}`;

    const retirer = F('mp-retirer');
    if (retirer) retirer.addEventListener('click', () => UI.confirm({
      title: 'Retirer cette demande ?',
      message: `Votre candidature sur ce bien sera annulée. Vous pourrez en envoyer une nouvelle tant que le bien reste disponible.`,
      confirmText: 'Retirer',
      danger: true,
      onConfirm: () => { mpRetirerDemande(d.id); UI.closeAll(); rafraichir(); UI.toast('Demande retirée'); },
    }));

    UI.openPanel('mp-panel');
  }

  /* ---------- Câblage ---------- */
  F('mp-prospects').addEventListener('click', e => {
    const cible = e.target.closest('[data-demande]');
    if (cible) ouvrirSuivi(cible.dataset.demande);
  });
  F('mp-pipeline').addEventListener('click', e => {
    const b = e.target.closest('[data-etape]');
    if (!b) return;
    // Un second clic sur l'étape active enlève le filtre : c'est le
    // geste attendu quand on vient de restreindre la vue par curiosité.
    filtreStatut = filtreStatut === b.dataset.etape ? 'tous' : b.dataset.etape;
    F('mp-f-statut').value = filtreStatut;
    rafraichir();
  });
  F('mp-f-statut').addEventListener('change', e => { filtreStatut = e.target.value; rafraichir(); });

  function rafraichir() {
    renderPipeline();
    renderListe();
    // La cloche compte les réponses non lues : la vider ici évite qu'elle
    // annonce encore une décision qu'on vient d'ouvrir.
    if (UI.refreshBellBadge) UI.refreshBellBadge();
  }
  rafraichir();

  /* Ouverture directe d'une demande : depuis la marketplace
     (prospects.html#DG4) ou depuis le centre de notifications
     (prospects.html?demande=DG4). Deux chemins, un seul comportement. */
  const params = new URLSearchParams(location.search);
  const cible = params.get('demande') || location.hash.slice(1);
  if (cible && mpDemande(cible)) {
    ouvrirSuivi(cible);
    rafraichir();
  }
})();
