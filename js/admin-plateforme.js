/* ============================================================
   OYVIA interne — Santé de la plateforme

   Surveiller des dépendances externes, c'est d'abord savoir EN QUOI
   elles sont dégradées : une pastille rouge sans contexte oblige à
   ouvrir un incident pour trouver ce qu'on cherche. Cette page met
   donc le texte avant la couleur — bandeau, incidents, journal.

   Deux partis pris qui expliquent la structure :

   — Le statut global (santeGlobale) décrit la situation en une phrase,
     pas en une couleur. « Booking.com dégradé » est utile ; « orange »
     ne l'est pas.

   — Les actions de modification (changerStatutService, ouvrirIncident,
     noterIncident, resoudreIncident) journalisent et sauvegardent
     elles-mêmes. On ne les rappelle pas ici pour ne pas doubler les
     entrées du journal.
   ============================================================ */
if (AdminLayout.init('plateforme')) { /* accès refusé */ } else {
(function () {

  const F = id => document.getElementById(id);
  const ic = Adm.ic;

  let panelId = null;   // identifiant de l'incident actuellement ouvert dans le panneau

  /* ---------- Filtres incidents ---------- */
  const filtres = { statut: 'ouverts', service: 'tous' };

  /* ---------- Peuplement du select "service" des filtres ----------
     Fait une seule fois au chargement : la liste de services ne change
     pas au fil de la session. */
  function peuplerSelectServices(selectId) {
    const sel = F(selectId);
    if (!sel) return;
    sel.innerHTML = '<option value="tous">Tous les services</option>' +
      SERVICES_PLATEFORME.map(s => `<option value="${s.id}">${s.nom}</option>`).join('');
  }
  peuplerSelectServices('pl-f-service');
  peuplerSelectServices('pl-f-service-inc');

  /* ---------- Bouton « Déclarer un incident » ----------
     Affiché uniquement si le rôle le permet, pour que les membres en
     lecture seule ne tombent pas sur un formulaire qu'ils ne peuvent
     pas soumettre. */
  if (peutAdmin('incidents')) {
    F('pl-actions').innerHTML =
      `<button class="btn btn--primary" id="pl-ouvrir-inc">
        ${ic('<path d="M12 5v14M5 12h14"/>')} Déclarer un incident
       </button>`;
    F('pl-ouvrir-inc').addEventListener('click', () => {
      F('pl-f-titre-inc').value = '';
      F('pl-f-note-inc').value = '';
      F('pl-f-service-inc').value = SERVICES_PLATEFORME[0].id;
      F('pl-f-gravite-inc').value = 'mineur';
      UI.openPanel('pl-modal-inc');
    });
  }

  /* ---------- Bandeau d'état global ---------- */
  function renderBandeau() {
    const etat = santeGlobale();
    const cfg = {
      ok:      { bg: 'var(--c-positive-soft)', couleur: 'var(--c-positive-ink)', icone: '<path d="M20 6 9 17l-5-5"/>' },
      degrade: { bg: 'var(--c-warning-soft)',  couleur: 'var(--c-warning-ink)',  icone: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>' },
      panne:   { bg: 'var(--c-danger-soft)',   couleur: 'var(--c-danger-ink)',   icone: '<circle cx="12" cy="12" r="9"/><path d="M12 8v4"/><path d="M12 16h.01"/>' },
    }[etat];

    let texte;
    if (etat === 'ok') {
      texte = 'Tout est opérationnel. Aucun service n\'est actuellement dégradé ou interrompu.';
    } else {
      // Nommer les services concernés pour éviter de chercher la pastille rouge
      const concernes = SERVICES_PLATEFORME
        .filter(s => s.statut === (etat === 'panne' ? 'panne' : 'degrade') || (etat === 'panne' && s.statut === 'degrade'))
        .map(s => s.nom);
      const label = etat === 'panne' ? 'Interruption en cours' : 'Service dégradé';
      texte = `${label} — ${concernes.join(', ')}.`;
    }

    F('pl-bandeau').innerHTML = `
      <div style="display:flex;align-items:center;gap:var(--sp-3);padding:var(--sp-4) var(--sp-5);
                  border-radius:var(--r-xl);background:${cfg.bg};color:${cfg.couleur};border:1px solid ${cfg.couleur}30">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px;flex-shrink:0">
          ${cfg.icone}
        </svg>
        <span style="font-weight:var(--fw-semibold);font-size:var(--fs-sm)">${texte}</span>
      </div>`;
  }

  /* ---------- KPI ---------- */
  function renderKpis() {
    const nbServices  = SERVICES_PLATEFORME.length;
    const nbOuverts   = incidentsOuverts().length;
    const dispos      = SERVICES_PLATEFORME.map(s => s.dispo);
    const dispoMoy    = dispos.reduce((a, b) => a + b, 0) / dispos.length;
    // Latence médiane : trier et prendre la valeur centrale
    const latences    = SERVICES_PLATEFORME.map(s => s.latence).sort((a, b) => a - b);
    const latMed      = latences.length % 2 === 0
      ? Math.round((latences[latences.length / 2 - 1] + latences[latences.length / 2]) / 2)
      : latences[Math.floor(latences.length / 2)];

    F('pl-kpis').innerHTML = [
      Adm.kpi({
        label: 'Services surveillés',
        valeur: nbServices,
        pied: `${SERVICES_PLATEFORME.filter(s => s.statut === 'ok').length} opérationnels`,
        icone: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
      }),
      Adm.kpi({
        label: 'Incidents ouverts',
        valeur: nbOuverts,
        pied: nbOuverts > 0 ? 'Intervention requise' : 'Aucun incident actif',
        icone: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
        ton: nbOuverts > 0 ? 'danger' : '',
      }),
      Adm.kpi({
        label: 'Disponibilité moyenne',
        valeur: dispoMoy.toFixed(1) + ' %',
        pied: 'Moyenne de tous les services',
        icone: '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>',
        ton: dispoMoy >= 99.5 ? 'positive' : dispoMoy >= 98 ? '' : 'warning',
      }),
      Adm.kpi({
        label: 'Latence médiane',
        valeur: latMed + ' ms',
        pied: 'Médiane de tous les services',
        icone: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l3 3"/>',
        ton: latMed > 1000 ? 'warning' : '',
      }),
    ].join('');
  }

  /* ---------- Bloc services, groupés par catégorie ---------- */
  const CATEGORIES_ORDRE = ['Canaux', 'Équipements', 'Tarification', 'Paiement', 'Messagerie', 'IA'];

  function renderServices() {
    const peutChanger = peutAdmin('incidents');

    const groupes = CATEGORIES_ORDRE.map(cat => {
      const services = SERVICES_PLATEFORME.filter(s => s.categorie === cat);
      if (!services.length) return '';

      const lignes = services.map(s => {
        const info = SANTE_STATUTS[s.statut] || SANTE_STATUTS.ok;
        // controleLe est au format 'AAAA-MM-JJ HH:MM' — formatDate n'accepte
        // que 'AAAA-MM-JJ', on découpe donc avant de passer la valeur.
        const dateControle = s.controleLe ? s.controleLe.split(' ')[0] : null;
        const nbInc = incidentsService(s.id).length;

        const selectStatut = peutChanger ? `
          <select class="select" style="height:32px;font-size:var(--fs-xs);width:auto;min-width:130px"
                  data-service="${s.id}" aria-label="Changer le statut de ${s.nom}">
            ${Object.entries(SANTE_STATUTS).map(([k, v]) =>
              `<option value="${k}" ${k === s.statut ? 'selected' : ''}>${v.label}</option>`
            ).join('')}
          </select>` : '';

        return `<tr class="adm-clic" data-svc="${s.id}">
          <td style="width:14px;padding-right:0">
            <span class="adm-dot ${info.point}" title="${info.label}"></span>
          </td>
          <td><b>${s.nom}</b></td>
          <td class="num text-muted" style="font-size:var(--fs-xs)">${s.latence} ms</td>
          <td class="num" style="font-size:var(--fs-xs)">${s.dispo.toFixed(2)} %</td>
          <td class="text-xs text-muted">${dateControle ? formatDate(dateControle) : '—'}</td>
          <td>${nbInc > 0
            ? `<span class="badge badge--danger">${nbInc} incident${nbInc > 1 ? 's' : ''}</span>`
            : '<span class="text-xs text-muted">—</span>'}</td>
          ${peutChanger ? `<td>${selectStatut}</td>` : ''}
        </tr>`;
      }).join('');

      return `
        <p class="eyebrow mb-2 mt-5" style="margin-top:var(--sp-5)">${cat}</p>
        <div class="table-wrap">
          <table class="table">
            <thead><tr>
              <th style="width:14px"></th>
              <th>Service</th>
              <th class="num">Latence</th>
              <th class="num">Disponibilité</th>
              <th>Dernier contrôle</th>
              <th>Incidents ouverts</th>
              ${peutChanger ? '<th>Statut</th>' : ''}
            </tr></thead>
            <tbody>${lignes}</tbody>
          </table>
        </div>`;
    }).join('');

    F('pl-services').innerHTML = `
      <div class="row-between mb-2">
        <b style="font-size:var(--fs-md);font-weight:var(--fw-semibold)">Services</b>
      </div>
      ${groupes}`;

  }

  /* ---------- Incidents filtrés ---------- */
  function incidentsFiltres() {
    return INCIDENTS.filter(i => {
      if (filtres.service !== 'tous' && i.serviceId !== filtres.service) return false;
      if (filtres.statut === 'ouverts')  return i.statut !== 'resolu';
      if (filtres.statut === 'resolus')  return i.statut === 'resolu';
      return true;
    });
  }

  /* Durée en jours, avec un texte lisible plutôt qu'un simple chiffre. */
  function dureeTxt(inc) {
    const fin  = inc.resoluLe || AUJOURDHUI;
    const jours = nuitsEntre(inc.ouvertLe, fin);
    if (jours === 0) return 'Ouvert aujourd\'hui';
    return `${jours} jour${jours > 1 ? 's' : ''}`;
  }

  /* ---------- Rendu de la liste des incidents ---------- */
  function renderIncidents() {
    const liste = incidentsFiltres();
    F('pl-inc-compteur').textContent = `${liste.length} incident${liste.length > 1 ? 's' : ''}`;

    if (!liste.length) {
      F('pl-incidents').innerHTML = Adm.vide('Aucun incident', 'Aucun incident ne correspond à ces filtres.');
      return;
    }

    F('pl-incidents').innerHTML = liste.map(i => {
      const svc = getServicePlateforme(i.serviceId);
      const clients = (i.clients || []).map(id => nomClient(id)).filter(n => n !== '—').join(', ');
      return `<div class="adm-ligne adm-clic" data-inc="${i.id}">
        <div class="adm-ligne__meta grow">
          <b>${i.id} — ${i.titre}</b>
          <small>
            ${svc ? svc.nom : i.serviceId} ·
            Ouvert le ${formatDate(i.ouvertLe)} ·
            ${dureeTxt(i)}
            ${clients ? ' · ' + clients : ''}
          </small>
        </div>
        ${Adm.badge(INCIDENT_GRAVITES, i.gravite)}
        ${Adm.badge(INCIDENT_STATUTS, i.statut)}
        <button class="icon-btn" data-inc="${i.id}" aria-label="Ouvrir l'incident">
          ${ic('<path d="m9 18 6-6-6-6"/>')}
        </button>
      </div>`;
    }).join('');
  }

  /* ---------- Panneau incident ---------- */
  function ouvrirPanel(id) {
    const i = getIncident(id);
    if (!i) return;
    panelId = id;

    const svc     = getServicePlateforme(i.serviceId);
    const clients = (i.clients || []).map(c => nomClient(c)).filter(n => n !== '—');
    const jours   = nuitsEntre(i.ouvertLe, i.resoluLe || AUJOURDHUI);

    F('pl-panel-tete').innerHTML = `
      <h3 class="modal__title" id="pl-panel-titre">${i.id} — ${i.titre}</h3>
      <p style="margin-top:var(--sp-1);display:flex;gap:var(--sp-2);flex-wrap:wrap">
        ${Adm.badge(INCIDENT_GRAVITES, i.gravite)}
        ${Adm.badge(INCIDENT_STATUTS, i.statut)}
      </p>`;

    const ligne = (dt, dd) => `<dt>${dt}</dt><dd>${dd}</dd>`;

    // Fil chronologique : la dernière entrée marque un événement fort (résolution ou
    // ouverture), les intermédiaires sont des mises à jour courantes.
    const filEntrees = (i.journal || []).map((e, idx) => {
      const fort = idx === 0 || idx === i.journal.length - 1;
      return `<div class="adm-fil__pt${fort ? ' is-fort' : ''}">
        <div class="adm-fil__date">${formatHorodatage(e.le || AUJOURDHUI)}</div>
        <div class="adm-fil__txt">${e.texte}</div>
      </div>`;
    }).join('');

    F('pl-panel-corps').innerHTML = `
      <dl class="adm-defs mb-5">
        ${ligne('Service',         svc ? svc.nom : i.serviceId)}
        ${ligne('Gravité',         Adm.badge(INCIDENT_GRAVITES, i.gravite))}
        ${ligne('Statut',          Adm.badge(INCIDENT_STATUTS, i.statut))}
        ${ligne('Ouvert le',       formatDate(i.ouvertLe, { annee: true }))}
        ${ligne('Résolu le',       i.resoluLe ? formatDate(i.resoluLe, { annee: true }) : '—')}
        ${ligne('Durée',           jours === 0 ? 'Moins d\'un jour' : `${jours} jour${jours > 1 ? 's' : ''}`)}
        ${ligne('Clients impactés', clients.length ? clients.join(', ') : '—')}
      </dl>

      <p class="eyebrow mb-3">Fil chronologique</p>
      ${filEntrees
        ? `<div class="adm-fil mb-5">${filEntrees}</div>`
        : `<p class="text-sm text-muted mb-5">Aucune entrée dans le journal.</p>`}

      ${peutAdmin('incidents') && i.statut !== 'resolu' ? `
        <p class="eyebrow mb-2">Ajouter une note</p>
        <div class="field mb-3">
          <textarea class="textarea" id="pl-note-txt" rows="3"
                    placeholder="Avancement, décision prise, contact Booking…"></textarea>
        </div>
        <div class="adm-actions mb-4">
          <button class="btn btn--secondary btn--sm" id="pl-note-save">Ajouter la note</button>
        </div>` : ''}
    `;

    // Actions du pied : résoudre n'est proposé que si l'incident est encore ouvert.
    const pieds = [];
    if (peutAdmin('incidents') && i.statut !== 'resolu') {
      pieds.push(`<button class="btn btn--primary btn--sm" id="pl-resolver">Marquer résolu</button>`);
    }
    F('pl-panel-pied').innerHTML = pieds.length
      ? `<div class="adm-actions">${pieds.join('')}</div>`
      : '';

    brancherPanelActions(i);
    UI.openPanel('pl-panel');
  }

  function brancherPanelActions(i) {
    const on = (id, fn) => { const el = F(id); if (el) el.addEventListener('click', fn); };

    on('pl-note-save', () => {
      const txt = (F('pl-note-txt') || {}).value || '';
      if (!txt.trim()) return UI.toast('Rédigez une note avant de l\'enregistrer', false);
      noterIncident(i.id, txt.trim());
      rafraichir();
      ouvrirPanel(i.id);
      UI.toast('Note ajoutée');
    });

    on('pl-resolver', () => {
      // La note de résolution est facultative mais encouragée : un incident
      // clos sans explication est une occasion manquée de capitaliser.
      const noteEl = F('pl-note-txt');
      const noteVal = noteEl ? noteEl.value.trim() : '';
      UI.confirm({
        title: 'Marquer cet incident résolu ?',
        message: `L'incident ${i.id} sera clos. Le service reviendra au vert si aucun autre incident ne pèse dessus.`,
        confirmText: 'Marquer résolu',
        onConfirm: () => {
          resoudreIncident(i.id, noteVal);
          rafraichir();
          ouvrirPanel(i.id);
          UI.toast(`${i.id} marqué résolu`);
        },
      });
    });
  }

  /* ---------- Modale « Déclarer un incident » ---------- */
  const saveIncBtn = F('pl-save-inc');
  if (saveIncBtn) {
    saveIncBtn.addEventListener('click', () => {
      const titre     = (F('pl-f-titre-inc').value || '').trim();
      const serviceId = F('pl-f-service-inc').value;
      const gravite   = F('pl-f-gravite-inc').value;
      const note      = (F('pl-f-note-inc').value || '').trim();

      if (!titre) return UI.toast('Indiquez un titre pour l\'incident', false);

      const inc = ouvrirIncident({ serviceId, titre, gravite, note });
      UI.closeAll();
      rafraichir();
      ouvrirPanel(inc.id);
      UI.toast(`Incident ${inc.id} déclaré`);
    });
  }

  /* ---------- Délégations branchées une seule fois ----------
     renderServices et renderIncidents redessinant leur contenu à chaque
     rafraîchissement, les écouteurs posés sur leurs conteneurs parents
     persistants survivent sans se dupliquer. */
  function brancher() {
    // Incidents
    const plInc = F('pl-incidents');
    if (plInc) {
      plInc.addEventListener('click', e => {
        const cible = e.target.closest('[data-inc]');
        if (cible) ouvrirPanel(cible.dataset.inc);
      });
    }

    // Selects de statut de service (réservé aux membres habilités)
    if (peutAdmin('incidents')) {
      const plSvc = F('pl-services');
      if (plSvc) {
        plSvc.addEventListener('change', e => {
          const sel = e.target.closest('[data-service]');
          if (!sel) return;
          e.stopPropagation();   // ne pas déclencher le clic de ligne
          const serviceId = sel.dataset.service;
          const statut = sel.value;
          changerStatutService(serviceId, statut);
          rafraichir();
          UI.toast(`${getServicePlateforme(serviceId).nom} : ${SANTE_STATUTS[statut].label}`);
        });
      }
    }
  }

  /* ---------- Filtres ---------- */
  F('pl-f-statut').addEventListener('change', e => { filtres.statut = e.target.value; renderIncidents(); });
  F('pl-f-service').addEventListener('change', e => { filtres.service = e.target.value; renderIncidents(); });

  /* ---------- Rafraîchissement global ----------
     Appelé après chaque action pour que la page reflète l'état réel des
     données sans rechargement. AdminLayout.refreshBadges met à jour la
     pastille « incidents » dans la sidebar. */
  function rafraichir() {
    renderBandeau();
    renderKpis();
    renderServices();
    renderIncidents();
    AdminLayout.refreshBadges();
  }

  rafraichir();
  brancher();

  // Ouverture directe par ancre : #INC-31 depuis une autre page du back-office.
  if (location.hash.length > 1) {
    const inc = getIncident(location.hash.slice(1));
    if (inc) ouvrirPanel(inc.id);
  }

})();
}
