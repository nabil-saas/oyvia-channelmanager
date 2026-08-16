/* ============================================================
   OYVIA — Voyageurs (CRM) : liste + fiche avec historique
   ============================================================ */
Layout.init('voyageurs');

(function () {
  const AVA = ['', 'avatar--v2', 'avatar--v3', 'avatar--v4'];
  const PAY_BADGE = { paye: 'badge--positive', acompte: 'badge--warning', impaye: 'badge--danger', rembourse: 'badge--neutral' };
  const initiales = nom => nom.split(' ').map(m => m[0]).slice(0, 2).join('').toUpperCase();
  const tbody = document.getElementById('voy-tbody');
  const search = document.getElementById('voy-search');
  const sort = document.getElementById('voy-sort');

  document.getElementById('voy-count').textContent = `${VOYAGEURS.length} voyageurs dans votre fichier`;

  function sorted(list) {
    const s = sort.value;
    return [...list].sort((a, b) => {
      if (s === 'depense') return b.totalDepense - a.totalDepense;
      if (s === 'sejours') return b.nbSejours - a.nbSejours;
      if (s === 'nom') return a.nom.localeCompare(b.nom);
      return parseDate(b.dernierSejour) - parseDate(a.dernierSejour);
    });
  }

  function render() {
    const q = search.value.trim().toLowerCase();
    const list = sorted(VOYAGEURS.filter(v => !q || `${v.nom} ${v.email} ${v.pays}`.toLowerCase().includes(q)));
    tbody.innerHTML = list.map((v, i) => `
      <tr class="is-clickable" data-id="${v.id}">
        <td><div class="row gap-3">
          <span class="avatar avatar--sm ${AVA[i % 4]}">${initiales(v.nom)}</span>
          <div><b class="fw-semibold">${v.nom}</b><br><small class="text-muted">${v.email}</small></div>
        </div></td>
        <td class="text-soft">${v.pays}</td>
        <td class="num">${v.nbSejours}</td>
        <td class="num money">${formatMontant(v.totalDepense)}</td>
        <td class="text-soft">${formatDate(v.dernierSejour, { annee: true })}</td>
        <td class="text-muted" style="text-align:right"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg></td>
      </tr>`).join('') ||
      '<tr><td colspan="6"><div class="empty"><h4>Aucun voyageur</h4></div></td></tr>';
  }

  function openFiche(id) {
    const v = getVoyageur(id);
    const resas = getReservationsByVoyageur(id).sort((a, b) => parseDate(b.arrivee) - parseDate(a.arrivee));
    const hist = resas.length ? resas.map(r => {
      const l = getLogement(r.logementId);
      return `<div class="app-list__item">
        <span class="chip-canal chip-canal--${r.canal}">${CANAL_LABEL[r.canal]}</span>
        <div class="grow"><b>${l.nom}</b><small>${formatPlage(r.arrivee, r.depart)} · ${r.nuits} nuits</small></div>
        <span class="money fw-semibold text-sm">${formatMontant(r.montant)}</span>
      </div>`;
    }).join('') : '<p class="text-muted text-sm">Aucun séjour enregistré sur cette période.</p>';

    document.getElementById('voy-panel-content').innerHTML = `
      <div class="panel__head">
        <div class="rp-guest">
          <span class="avatar avatar--lg">${initiales(v.nom)}</span>
          <div><b>${v.nom}</b><p class="text-soft text-sm">${v.pays}</p></div>
        </div>
        <button class="icon-btn" onclick="UI.closeAll()" aria-label="Fermer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
      </div>
      <div class="panel__body">
        <div class="app-grid app-grid--3" style="gap:var(--sp-3);margin-bottom:var(--sp-4)">
          <div class="kpi"><span class="kpi__label">Séjours</span><span class="kpi__value">${v.nbSejours}</span></div>
          <div class="kpi"><span class="kpi__label">Dépensé</span><span class="kpi__value" style="font-size:var(--fs-xl)">${formatMontant(v.totalDepense)}</span></div>
          <div class="kpi"><span class="kpi__label">Dernier</span><span class="kpi__value" style="font-size:var(--fs-md)">${formatDate(v.dernierSejour)}</span></div>
        </div>
        <div class="rp-section">
          <p class="eyebrow mb-2">Contact</p>
          <div class="rp-row"><span>E-mail</span><span>${v.email}</span></div>
          <div class="rp-row"><span>Téléphone</span><span>${v.tel}</span></div>
        </div>
        ${v.note ? `<div class="rp-section"><p class="eyebrow mb-2">Note interne</p><p class="text-sm text-soft">${v.note}</p></div>` : ''}
        <div class="rp-section"><p class="eyebrow mb-2">Historique des séjours</p><div class="app-list">${hist}</div></div>
      </div>
      <div class="panel__foot"><a class="btn btn--primary btn--block" href="messagerie.html">Écrire à ${v.nom.split(' ')[0]}</a></div>`;
    UI.openPanel('voy-panel');
  }

  tbody.addEventListener('click', e => { const tr = e.target.closest('tr[data-id]'); if (tr) openFiche(tr.dataset.id); });
  search.addEventListener('input', render);
  sort.addEventListener('change', render);
  render();
})();
