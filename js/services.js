/* ============================================================
   OYVIA — Services additionnels (Vente directe)

   Ce que l'hôte vend en plus de la nuitée. C'est la marge la plus
   rentable du métier : aucune commission d'OTA à reverser, et le
   voyageur est déjà acquis — il ne reste qu'à lui proposer.

   Le point délicat du paramétrage est l'UNITÉ de facturation, et
   l'écran insiste dessus : un transfert se paie par trajet, un
   petit-déjeuner par personne et par jour, un lit d'appoint par
   séjour. Se tromper d'unité, ce n'est pas une imprécision, c'est
   facturer dix fois trop cher ou dix fois trop peu. D'où l'aperçu
   chiffré sous le formulaire, sur un séjour type.
   ============================================================ */
Layout.init('services');

(function () {
  const ic = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  const ICO_EDIT = '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>';
  const ICO_DEL  = '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6"/>';

  // Séjour de référence pour l'aperçu : 4 nuits, 2 voyageurs. Assez court
  // pour rester lisible, assez long pour que l'unité se voie.
  const EX_NUITS = 4, EX_PERS = 2;

  let editId = null;
  const F = id => document.getElementById(id);

  // Ce que coûte le service sur le séjour de référence, selon son unité.
  function totalExemple(prix, unite) {
    switch (unite) {
      case 'personne':      return prix * EX_PERS;
      case 'personne_jour': return prix * EX_PERS * EX_NUITS;
      case 'nuit':          return prix * EX_NUITS;
      default:              return prix;   // séjour, trajet, unité, heure
    }
  }

  /* ---------- Liste, groupée par catégorie ---------- */
  function renderListe() {
    F('sv-liste').innerHTML = servicesParCategorie().map(g => `
      <div class="card card--pad mb-4">
        <div class="row-between mb-4">
          <p class="eyebrow">${g.label}</p>
          <span class="text-xs text-muted">${g.items.filter(s => s.actif).length} / ${g.items.length} proposés</span>
        </div>
        ${g.items.map(s => `
          <div class="sv-item ${s.actif ? '' : 'is-off'}" data-id="${s.id}">
            <div class="sv-item__meta grow">
              <b>${s.nom}</b>
              <small>${s.desc}</small>
              <div class="sv-item__tags">
                <span class="sv-tag">${s.prix ? formatMontant(s.prix) : 'Offert'} ${SERVICES_UNITES[s.unite]}</span>
                <span class="sv-tag sv-tag--muted">${s.delaiPrevenance} h de prévenance</span>
                ${s.prestataire ? `<span class="sv-tag sv-tag--muted">${s.prestataire}</span>` : '<span class="sv-tag sv-tag--muted">En interne</span>'}
                ${(() => { const p = porteeService(s);
                  return `<span class="sv-tag ${p.tous ? 'sv-tag--muted' : (p.ids.length ? 'sv-tag--portee' : 'sv-tag--vide')}"
                    title="${p.tous ? 'Tout le parc' : p.ids.map(id => getLogement(id).nom).join(', ') || 'Aucun logement sélectionné'}">${p.label}</span>`; })()}
                ${s.prix ? `<span class="sv-tag sv-tag--muted">marge ${s.marge} %</span>` : ''}
              </div>
            </div>
            <label class="switch" title="${s.actif ? 'Ne plus proposer' : 'Proposer aux voyageurs'}">
              <input type="checkbox" data-toggle="${s.id}" ${s.actif ? 'checked' : ''}><span class="switch__track"></span>
            </label>
            <button class="icon-btn" data-edit="${s.id}" aria-label="Modifier">${ic(ICO_EDIT)}</button>
            <button class="icon-btn icon-btn--danger" data-del="${s.id}" aria-label="Supprimer">${ic(ICO_DEL)}</button>
          </div>`).join('')}
      </div>`).join('');
  }

  /* ============================================================
     DEMANDES DES VOYAGEURS

     Regroupées PAR PRESTATION et non par réservation. C'est la
     différence utile avec la fiche de réservation, qui répond à « que
     veut ce voyageur ? ». Ici la question est celle de l'exploitation :
     « combien de paniers d'accueil dois-je commander cette semaine, et
     pour quand ? ». Quinze demandes éparpillées dans quinze fiches ne
     répondent pas à ça.

     Chaque ligne porte sa date d'échéance — l'arrivée pour les services
     d'arrivée, le départ pour les autres — parce que c'est elle qui
     ordonne le travail, pas la date de la demande.
     ============================================================ */
  let filtreCommandes = 'demande';

  function echeanceCommande(c) {
    const r = getReservation(c.reservationId);
    const sv = getService(c.serviceId);
    if (!r || !sv) return null;
    return sv.categorie === 'arrivee' ? r.arrivee : r.depart;
  }

  function commandesFiltrees() {
    return COMMANDES_SERVICE
      .filter(c => filtreCommandes === 'tous' || c.statut === filtreCommandes)
      .filter(c => getReservation(c.reservationId) && getService(c.serviceId))
      .sort((a, b) => String(echeanceCommande(a)).localeCompare(String(echeanceCommande(b))));
  }

  function renderCommandes() {
    const liste = commandesFiltrees();
    const enAttente = COMMANDES_SERVICE.filter(c => c.statut === 'demande').length;

    // Pastille de l'onglet : ce qui attend une décision, rien d'autre.
    F('sv-nb').textContent = enAttente || '';
    F('sv-nb').hidden = !enAttente;
    F('sv-c-compteur').textContent = `${liste.length} demande${liste.length > 1 ? 's' : ''}`;

    if (!liste.length) {
      F('sv-commandes').innerHTML = `<div class="card card--pad"><div class="empty">
        ${ic('<circle cx="12" cy="12" r="9"/><path d="M9 12h6"/>')}
        <h4>Rien à traiter</h4>
        <p>${filtreCommandes === 'demande'
          ? 'Aucune demande en attente. Les extras choisis par vos voyageurs apparaîtront ici.'
          : 'Aucune demande ne correspond à ce filtre.'}</p></div></div>`;
      return;
    }

    // Groupement par service, en conservant l'ordre d'échéance.
    const groupes = [];
    liste.forEach(c => {
      let g = groupes.find(x => x.serviceId === c.serviceId);
      if (!g) { g = { serviceId: c.serviceId, items: [] }; groupes.push(g); }
      g.items.push(c);
    });

    F('sv-commandes').innerHTML = groupes.map(g => {
      const sv = getService(g.serviceId);
      const total = g.items.filter(c => c.statut !== 'refuse').reduce((t, c) => t + montantCommande(c), 0);
      const unites = g.items.reduce((t, c) => t + (c.quantite || 1), 0);
      return `<div class="card card--pad mb-4">
        <div class="row-between mb-4">
          <div>
            <p class="eyebrow">${SERVICES_CATEGORIES[sv.categorie] || ''}</p>
            <b class="sv-cmd__titre">${sv.nom}</b>
            <span class="text-xs text-muted"> · ${sv.prestataire || 'en interne'} · ${sv.delaiPrevenance} h de prévenance</span>
          </div>
          <div class="sv-cmd__droite">
            <b>${sv.prix ? formatMontant(total) : 'Offert'}</b>
            <div class="text-xs text-muted">${g.items.length} demande${g.items.length > 1 ? 's' : ''} · ${unites} ${SERVICES_UNITES[sv.unite] || ''}</div>
          </div>
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Voyageur</th><th>Logement</th><th>Pour le</th><th class="num">Quantité</th><th class="num">Montant</th><th>Statut</th><th></th></tr></thead>
            <tbody>${g.items.map(c => ligneCommandeHTML(c, sv)).join('')}</tbody>
          </table>
        </div>
      </div>`;
    }).join('');
  }

  function ligneCommandeHTML(c, sv) {
    const r = getReservation(c.reservationId);
    const l = getLogement(r.logementId);
    const st = STATUTS_COMMANDE[c.statut] || STATUTS_COMMANDE.demande;
    const ech = echeanceCommande(c);
    const jours = Math.round((parseDate(ech) - parseDate(AUJOURDHUI)) / 86400000);
    // Le préavis est-il encore tenable ? La question ne se pose que tant
    // qu'on n'a pas répondu.
    const tendu = c.statut === 'demande' && jours * 24 - (sv.delaiPrevenance || 0) <= 24;
    return `<tr class="${c.statut === 'refuse' ? 'sv-cmd--refuse' : ''}">
      <td><b>${r.voyageur}</b><div class="text-xs text-muted">${formatPlage(r.arrivee, r.depart)}</div></td>
      <td>${l ? `${l.nom}<div class="text-xs text-muted">${l.ville}</div>` : '—'}</td>
      <td class="text-sm">${formatDate(ech)}
        ${tendu ? '<span class="sv-serre">préavis serré</span>' : ''}</td>
      <td class="num">${c.quantite || 1}</td>
      <td class="num">${sv.prix ? formatMontant(montantCommande(c)) : '—'}</td>
      <td><span class="badge ${st.badge}">${st.label}</span></td>
      <td class="sv-cmd__actions">
        ${c.statut === 'demande' ? `
          <button class="icon-btn" data-cmd-ok="${c.id}" title="Confirmer au voyageur" aria-label="Confirmer">${ic('<path d="M20 6 9 17l-5-5"/>')}</button>
          <button class="icon-btn icon-btn--danger" data-cmd-non="${c.id}" title="Décliner" aria-label="Décliner">${ic('<path d="M18 6 6 18M6 6l12 12"/>')}</button>`
          : `<button class="icon-btn" data-cmd-resa="${c.reservationId}" title="Ouvrir la réservation" aria-label="Ouvrir la réservation">${ic('<path d="m9 18 6-6-6-6"/>')}</button>`}
      </td>
    </tr>`;
  }

  function render() { renderListe(); renderCommandes(); }

  /* ---------- Formulaire ---------- */
  F('sv-f-cat').innerHTML = Object.entries(SERVICES_CATEGORIES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
  F('sv-f-unite').innerHTML = Object.entries(SERVICES_UNITES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');

  // L'aperçu est le garde-fou contre l'erreur d'unité : il montre ce que le
  // voyageur paiera réellement, pas ce qui est écrit dans la case prix.
  function majApercu() {
    const prix = Number(F('sv-f-prix').value) || 0;
    const unite = F('sv-f-unite').value;
    const total = totalExemple(prix, unite);
    const marge = Math.round(total * (Number(F('sv-f-marge').value) || 0) / 100);
    F('sv-f-apercu').innerHTML = prix
      ? `Sur un séjour de ${EX_NUITS} nuits à ${EX_PERS} voyageurs, le voyageur paie <b>${formatMontant(total)}</b>, dont <b>${formatMontant(marge)}</b> pour vous.`
      : 'Service offert : aucun montant facturé au voyageur.';
  }
  ['sv-f-prix', 'sv-f-unite', 'sv-f-marge'].forEach(id => {
    F(id).addEventListener('input', majApercu);
    F(id).addEventListener('change', majApercu);
  });

  /* Cases à cocher des logements. On les rend à chaque ouverture plutôt qu'une
     fois pour toutes : le parc peut avoir changé depuis le dernier passage. */
  function renderLogements(selection) {
    F('sv-f-logements').innerHTML = LOGEMENTS.map(l => `
      <label class="sv-logement">
        <input type="checkbox" value="${l.id}" ${selection.includes(l.id) ? 'checked' : ''} />
        <span><b>${l.nom}</b><small>${l.ville}</small></span>
      </label>`).join('')
      + `<div class="sv-logements__actions">
           <button type="button" class="btn btn--ghost btn--sm" data-tout="1">Tout cocher</button>
           <button type="button" class="btn btn--ghost btn--sm" data-tout="0">Tout décocher</button>
         </div>`;
  }
  function majPortee() {
    const selection = document.querySelector('input[name="sv-f-portee"]:checked').value === 'selection';
    F('sv-f-logements').classList.toggle('hidden', !selection);
  }
  document.querySelectorAll('input[name="sv-f-portee"]').forEach(r => r.addEventListener('change', majPortee));
  F('sv-f-logements').addEventListener('click', e => {
    const b = e.target.closest('[data-tout]');
    if (!b) return;
    const cocher = b.dataset.tout === '1';
    F('sv-f-logements').querySelectorAll('input[type="checkbox"]').forEach(c => { c.checked = cocher; });
  });

  function ouvrir(id) {
    editId = id || null;
    const s = id ? getService(id) : null;
    F('sv-f-nom').value = s ? s.nom : '';
    F('sv-f-cat').value = s ? s.categorie : 'confort';
    F('sv-f-desc').value = s ? s.desc : '';
    F('sv-f-prix').value = s ? s.prix : 0;
    F('sv-f-unite').value = s ? s.unite : 'sejour';
    F('sv-f-marge').value = s ? s.marge : 100;
    F('sv-f-delai').value = s ? s.delaiPrevenance : 24;
    F('sv-f-prest').value = s && s.prestataire ? s.prestataire : '';
    F('sv-f-actif').checked = s ? s.actif : true;
    const p = porteeService(s);
    document.querySelector(`input[name="sv-f-portee"][value="${!s || p.tous ? 'tous' : 'selection'}"]`).checked = true;
    renderLogements(p.tous ? [] : p.ids);
    majPortee();
    F('sv-modal-title').textContent = s ? `Modifier — ${s.nom}` : 'Nouveau service';
    majApercu();
    UI.openPanel('sv-modal');
  }

  F('sv-add').addEventListener('click', () => ouvrir(null));

  F('sv-save').addEventListener('click', () => {
    const nom = F('sv-f-nom').value.trim();
    if (!nom) { UI.toast('Donnez un nom au service', false); return; }

    const surSelection = document.querySelector('input[name="sv-f-portee"]:checked').value === 'selection';
    const coches = [...F('sv-f-logements').querySelectorAll('input[type="checkbox"]:checked')].map(c => c.value);
    // Un service restreint à zéro logement ne serait proposable nulle part :
    // il serait « actif » à l'écran et invisible partout ailleurs.
    if (surSelection && !coches.length) { UI.toast('Choisissez au moins un logement, ou passez sur « Tous »', false); return; }
    const portee = surSelection ? coches : 'tous';
    const data = {
      nom, categorie: F('sv-f-cat').value, desc: F('sv-f-desc').value.trim(),
      prix: Math.max(0, Number(F('sv-f-prix').value) || 0),
      unite: F('sv-f-unite').value,
      marge: Math.max(0, Math.min(100, Number(F('sv-f-marge').value) || 0)),
      delaiPrevenance: Math.max(0, parseInt(F('sv-f-delai').value, 10) || 0),
      prestataire: F('sv-f-prest').value.trim() || null,
      actif: F('sv-f-actif').checked,
      logements: portee,
    };
    if (editId) Object.assign(getService(editId), data);
    else SERVICES.push({ id: 'SV' + Date.now(), ...data });
    saveOyviaState(); UI.closeAll(); render();
    UI.toast(editId ? 'Service modifié' : 'Service créé');
  });

  /* ---------- Interactions ---------- */
  F('sv-liste').addEventListener('click', e => {
    const ed = e.target.closest('[data-edit]');
    const del = e.target.closest('[data-del]');
    if (ed) { ouvrir(ed.dataset.edit); return; }
    if (del) {
      const s = getService(del.dataset.del);
      UI.confirm({
        title: `Supprimer « ${s.nom} » ?`,
        message: "Le service disparaît du catalogue. Si vous voulez seulement cesser de le proposer, désactivez-le plutôt : le paramétrage sera conservé.",
        confirmText: 'Supprimer', danger: true,
        onConfirm: () => {
          const i = SERVICES.findIndex(x => x.id === del.dataset.del);
          if (i > -1) SERVICES.splice(i, 1);
          saveOyviaState(); render(); UI.toast('Service supprimé');
        },
      });
    }
  });

  F('sv-liste').addEventListener('change', e => {
    const t = e.target.closest('[data-toggle]');
    if (!t) return;
    const s = getService(t.dataset.toggle);
    s.actif = t.checked;
    saveOyviaState(); render();
    UI.toast(s.actif ? `${s.nom} proposé aux voyageurs` : `${s.nom} retiré du catalogue`);
  });

  /* ---------- Onglets ---------- */
  F('sv-tabs').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    F('sv-tabs').querySelectorAll('button').forEach(x => x.classList.remove('is-active'));
    b.classList.add('is-active');
    document.querySelectorAll('.tabpane').forEach(p => p.classList.toggle('is-active', p.dataset.pane === b.dataset.tab));
  });
  F('sv-c-statut').addEventListener('change', e => { filtreCommandes = e.target.value; renderCommandes(); });

  F('sv-commandes').addEventListener('click', e => {
    const ouvrir = e.target.closest('[data-cmd-resa]');
    if (ouvrir) { UI.openResa(ouvrir.dataset.cmdResa); return; }

    const oui = e.target.closest('[data-cmd-ok]');
    const non = e.target.closest('[data-cmd-non]');
    const btn = oui || non;
    if (!btn) return;
    const c = COMMANDES_SERVICE.find(x => x.id === (oui ? btn.dataset.cmdOk : btn.dataset.cmdNon));
    if (!c) return;
    const sv = getService(c.serviceId), r = getReservation(c.reservationId);
    c.statut = oui ? 'confirme' : 'refuse';
    saveOyviaState();
    renderCommandes();
    if (Layout.refreshSidebarBadges) Layout.refreshSidebarBadges();
    if (UI.refreshBellBadge) UI.refreshBellBadge();
    UI.toast(oui
      ? `${sv.nom} confirmé à ${r.voyageur}`
      : `${sv.nom} décliné pour ${r.voyageur}`);
  });

  render();
})();
