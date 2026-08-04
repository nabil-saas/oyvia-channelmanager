/* ============================================================
   OYVIA — Propriétaires : coordonnées + logements rattachés.
   Le modèle de facturation (commission, forfait…) se configure
   depuis Comptabilité > Facturation ; cette page ne gère que
   l'identité du propriétaire et l'affectation de ses biens.
   ============================================================ */
Layout.init('proprietaires');

(function () {
  const ICO_EDIT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
  const ICO_DEL  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6"/></svg>';
  const ICO_X    = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
  const ICO_WARN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v5M12 16h.01"/></svg>';

  let editId = null;

  function nextProprietaireId() {
    let n = 1;
    const ids = new Set(PROPRIETAIRES.map(o => o.id));
    while (ids.has('O' + n)) n++;
    return 'O' + n;
  }

  function initiales(nom) {
    return nom.split(' ').map(m => m[0]).filter(Boolean).join('').slice(0, 2).toUpperCase();
  }

  function renderUnassigned() {
    const el = document.getElementById('po-unassigned');
    const libres = getLogementsSansProprietaire();
    if (!libres.length) { el.innerHTML = ''; return; }
    el.innerHTML = `
      <div class="cp-alert">
        ${ICO_WARN}
        <div class="cp-alert__body">
          <b>${libres.length} logement${libres.length > 1 ? 's' : ''} sans propriétaire</b>
          <span>${libres.map(l => l.nom).join(', ')} — affectez-le${libres.length > 1 ? 's' : ''} à un propriétaire ci-dessous pour qu'il${libres.length > 1 ? 's' : ''} apparaisse${libres.length > 1 ? 'nt' : ''} en Comptabilité.</span>
        </div>
      </div>`;
  }

  // Options du <select> "Ajouter un logement" pour un propriétaire donné :
  // les logements libres d'abord, puis ceux d'autres propriétaires (réaffectation).
  function assignOptions(ownerId) {
    const libres = getLogementsSansProprietaire();
    const ailleurs = LOGEMENTS.filter(l => l.proprietaireId && l.proprietaireId !== ownerId);
    let html = '<option value="">+ Ajouter un logement…</option>';
    if (libres.length) {
      html += `<optgroup label="Non affectés">${libres.map(l => `<option value="${l.id}">${l.nom} — ${l.ville}</option>`).join('')}</optgroup>`;
    }
    if (ailleurs.length) {
      html += `<optgroup label="Réaffecter depuis un autre propriétaire">${ailleurs.map(l => `<option value="${l.id}">${l.nom} — ${getProprietaire(l.proprietaireId).societe}</option>`).join('')}</optgroup>`;
    }
    return html;
  }

  function ownerCard(o) {
    const biens = getLogementsByProprietaire(o.id);
    const modeLabel = libelleContrat(o);

    if (editId === o.id) {
      return `<div class="po-card" data-id="${o.id}">
        <div class="po-card__head" style="align-items:flex-start">
          <div class="po-card__editgrid">
            <input class="input" data-f="societe" value="${o.societe}" placeholder="Société / nom" />
            <input class="input" data-f="contact" value="${o.contact}" placeholder="Contact" />
            <input class="input" type="email" data-f="email" value="${o.email}" placeholder="Email" />
            <input class="input" data-f="tel" value="${o.tel}" placeholder="Téléphone" />
          </div>
          <div class="po-card__actions">
            <button class="btn btn--secondary btn--sm" data-cancel>Annuler</button>
            <button class="btn btn--primary btn--sm" data-save="${o.id}">Enregistrer</button>
          </div>
        </div>
        ${ownerCardBody(o, biens)}
      </div>`;
    }

    return `<div class="po-card" data-id="${o.id}">
      <div class="po-card__head">
        <span class="avatar avatar--sm">${initiales(o.societe)}</span>
        <div class="po-card__meta">
          <b>${o.societe}</b>
          <small>${o.contact} · ${o.email} · ${o.tel}</small>
        </div>
        <span class="badge badge--neutral">${biens.length} logement${biens.length > 1 ? 's' : ''}</span>
        <span class="po-billing">${modeLabel} · <a href="comptabilite.html#facturation">modifier</a></span>
        <div class="po-card__actions">
          <button class="icon-btn" data-edit="${o.id}" aria-label="Modifier">${ICO_EDIT}</button>
          <button class="icon-btn icon-btn--danger" data-del="${o.id}" aria-label="Supprimer">${ICO_DEL}</button>
        </div>
      </div>
      ${ownerCardBody(o, biens)}
    </div>`;
  }

  function ownerCardBody(o, biens) {
    const chips = biens.length
      ? `<div class="po-chips">${biens.map(l => `
          <span class="po-chip">${l.nom} — ${l.ville}
            <button type="button" class="po-chip__del" data-unassign="${l.id}" aria-label="Retirer ${l.nom}">${ICO_X}</button>
          </span>`).join('')}</div>`
      : `<p class="po-chips-empty">Aucun logement rattaché pour l'instant.</p>`;
    return `
      <p class="text-xs text-muted" style="margin-bottom:var(--sp-1)">Biens gérés</p>
      ${chips}
      <div class="po-addrow">
        <select class="select" data-assign-select="${o.id}">${assignOptions(o.id)}</select>
        <button type="button" class="btn btn--secondary btn--sm" data-assign-btn="${o.id}">Ajouter</button>
      </div>`;
  }

  function renderAll() {
    document.getElementById('po-list').innerHTML = PROPRIETAIRES.map(ownerCard).join('');
    renderUnassigned();
  }

  /* ---------- Édition inline (société, contact, email, tel) ---------- */
  document.getElementById('po-list').addEventListener('click', e => {
    const edit = e.target.closest('[data-edit]');
    const cancel = e.target.closest('[data-cancel]');
    const save = e.target.closest('[data-save]');
    const del = e.target.closest('[data-del]');
    const unassign = e.target.closest('[data-unassign]');
    const assignBtn = e.target.closest('[data-assign-btn]');

    if (edit) { editId = edit.dataset.edit; renderAll(); return; }
    if (cancel) { editId = null; renderAll(); return; }

    if (save) {
      const card = e.target.closest('.po-card');
      const o = getProprietaire(save.dataset.save);
      const societe = card.querySelector('[data-f="societe"]').value.trim();
      if (!societe) { UI.toast('La société / le nom est requis', false); return; }
      o.societe = societe;
      o.contact = card.querySelector('[data-f="contact"]').value.trim() || '—';
      o.email = card.querySelector('[data-f="email"]').value.trim() || '—';
      o.tel = card.querySelector('[data-f="tel"]').value.trim() || '—';
      editId = null; renderAll();
      UI.toast('Propriétaire modifié');
      return;
    }

    if (del) {
      if (PROPRIETAIRES.length <= 1) { UI.toast('Gardez au moins un propriétaire', false); return; }
      const id = del.dataset.del;
      if (getLogementsByProprietaire(id).length) {
        UI.toast('Réaffectez d\'abord ses logements avant de supprimer ce propriétaire', false);
        return;
      }
      const o = getProprietaire(id);
      PROPRIETAIRES.splice(PROPRIETAIRES.findIndex(p => p.id === id), 1);
      for (let i = FACTURES.length - 1; i >= 0; i--) { if (FACTURES[i].proprietaireId === id) FACTURES.splice(i, 1); }
      editId = null; renderAll();
      UI.toast(`${o.societe} supprimé`);
      return;
    }

    if (unassign) {
      const l = getLogement(unassign.dataset.unassign);
      const owner = getProprietaire(l.proprietaireId);
      UI.confirm({
        title: 'Retirer ce logement ?',
        message: `Retirer "${l.nom}" de ${owner.societe} ?\n\nCela peut impacter la comptabilité : son chiffre d'affaires, ses dépenses et ses factures passées ne seront plus rattachés à ce propriétaire tant qu'il n'est pas réaffecté.`,
        confirmText: 'Retirer',
        danger: true,
        onConfirm: () => {
          l.proprietaireId = null;
          renderAll();
          UI.toast(`${l.nom} n'est plus rattaché à un propriétaire`);
        },
      });
      return;
    }

    if (assignBtn) {
      const ownerId = assignBtn.dataset.assignBtn;
      const select = document.querySelector(`[data-assign-select="${ownerId}"]`);
      const logementId = select.value;
      if (!logementId) { UI.toast('Choisissez un logement à ajouter', false); return; }
      const l = getLogement(logementId);
      const previousOwner = l.proprietaireId ? getProprietaire(l.proprietaireId) : null;
      const newOwner = getProprietaire(ownerId);

      const doAssign = () => {
        l.proprietaireId = ownerId;
        renderAll();
        UI.toast(previousOwner
          ? `${l.nom} réaffecté de ${previousOwner.societe} à ${newOwner.societe}`
          : `${l.nom} affecté à ${newOwner.societe}`);
      };

      if (previousOwner) {
        UI.confirm({
          title: 'Réaffecter ce logement ?',
          message: `Réaffecter "${l.nom}" de ${previousOwner.societe} à ${newOwner.societe} ?\n\nCela peut impacter la comptabilité : le chiffre d'affaires, les dépenses et les factures passées de ce logement basculeront vers ${newOwner.societe} et ne seront plus comptés chez ${previousOwner.societe}.`,
          confirmText: 'Réaffecter',
          danger: true,
          onConfirm: doAssign,
        });
      } else {
        doAssign();
      }
      return;
    }
  });

  /* ---------- Modale : ajouter un propriétaire ---------- */
  document.getElementById('po-add-btn').addEventListener('click', () => {
    document.getElementById('po-modal-title').textContent = 'Ajouter un propriétaire';
    document.getElementById('po-modal-confirm').textContent = 'Ajouter le propriétaire';
    ['po-f-societe', 'po-f-contact', 'po-f-email', 'po-f-tel'].forEach(id => document.getElementById(id).value = '');
    UI.openPanel('po-modal');
  });

  document.getElementById('po-modal-confirm').addEventListener('click', () => {
    const societe = document.getElementById('po-f-societe').value.trim();
    if (!societe) { UI.toast('Renseignez au moins la société / le nom', false); return; }
    const contact = document.getElementById('po-f-contact').value.trim() || '—';
    const email = document.getElementById('po-f-email').value.trim() || '—';
    const tel = document.getElementById('po-f-tel').value.trim() || '—';

    const id = nextProprietaireId();
    PROPRIETAIRES.push({
      id, societe, contact, email, tel,
      // Contrat par défaut le plus courant : le propriétaire encaisse et
      // règle ses frais, la conciergerie facture sa commission. Tout se
      // reparamètre depuis Comptabilité › Facturation.
      encaissement: 'proprietaire', remuneration: 'commission',
      commission: 0.20, forfaitMensuel: 0,
      depensesPayeesPar: 'proprietaire', refacturerDepenses: false,
    });
    MOIS_COMPTABLES.forEach((mois, i) => {
      FACTURES.push({ id: `F-${id}-${i}`, proprietaireId: id, mois, statut: 'attente' });
    });

    UI.closeAll(); renderAll();
    UI.toast('Propriétaire ajouté — pensez à lui rattacher ses logements');
  });

  renderAll();
})();
