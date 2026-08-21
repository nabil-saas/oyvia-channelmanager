/* ============================================================
   OYVIA — Réservations : tableau filtrable + recherche
   ============================================================ */
Layout.init('reservations');

(function () {
  const PAY_BADGE = { paye: 'badge--positive', acompte: 'badge--warning', impaye: 'badge--danger', rembourse: 'badge--neutral' };
  const STA_BADGE = { demande: 'badge--warning', confirme: 'badge--accent', en_cours: 'badge--positive', termine: 'badge--neutral', annule: 'badge--danger' };
  const tbody = document.getElementById('resa-tbody');
  const today = parseDate(AUJOURDHUI);

  // Le filtre par logement n'est plus dupliqué dans la barre de filtres :
  // c'est le sélecteur partagé de l'en-tête de page (#app-logement), rempli
  // et câblé par layout.js.
  const F = {
    q: document.getElementById('resa-search'),
    canal: document.getElementById('resa-canal'),
    logement: document.getElementById('app-logement'),
    paiement: document.getElementById('resa-paiement'),
    periode: document.getElementById('resa-periode'),
    statut: document.getElementById('resa-statut'),
  };

  function matchPeriode(r, p) {
    const a = parseDate(r.arrivee), d = parseDate(r.depart);
    if (p === 'avenir') return a > today;
    if (p === 'encours') return a <= today && d > today;
    if (p === 'passees') return d <= today;
    if (p === 'mois') return a.getFullYear() === 2026 && a.getMonth() === 6;
    return true;
  }

  function filtered() {
    const q = F.q.value.trim().toLowerCase();
    return RESERVATIONS
      .filter(r => r.canal !== 'bloque')
      .filter(r => {
        const l = getLogement(r.logementId);
        if (q && !(`${r.voyageur} ${l.nom} ${r.ref}`.toLowerCase().includes(q))) return false;
        if (F.canal.value !== 'all' && r.canal !== F.canal.value) return false;
        if (F.logement.value !== 'all' && r.logementId !== F.logement.value) return false;
        if (F.paiement.value !== 'all' && r.paiement !== F.paiement.value) return false;
        if (F.statut && F.statut.value !== 'all' && r.statut !== F.statut.value) return false;
        if (!matchPeriode(r, F.periode.value)) return false;
        return true;
      })
      .sort((a, b) => parseDate(a.arrivee) - parseDate(b.arrivee));
  }

  /* Les demandes venues du site ne doivent pas se noyer dans la liste :
     elles ont une échéance implicite (24 h annoncées au voyageur). */
  function renderBandeau() {
    let z = document.getElementById('resa-demandes');
    if (!z) {
      z = document.createElement('div');
      z.id = 'resa-demandes';
      const t = document.querySelector('.table-wrap') || tbody.closest('table').parentElement;
      t.parentElement.insertBefore(z, t);
    }
    const d = demandesEnAttente();
    if (!d.length) { z.innerHTML = ''; return; }
    z.innerHTML = `
      <div class="resa-alerte">
        <div class="grow">
          <b>${d.length} demande${d.length > 1 ? 's' : ''} de réservation à valider</b>
          <small>Reçue${d.length > 1 ? 's' : ''} depuis votre site. Les dates sont retenues en attendant votre réponse.</small>
        </div>
        <button class="btn btn--primary btn--sm" id="resa-voir-demandes">${d.length > 1 ? 'Les voir' : 'La voir'}</button>
      </div>`;
    document.getElementById('resa-voir-demandes').addEventListener('click', () => {
      if (d.length === 1) { UI.openResa(d[0].id); return; }
      F.statut.value = 'demande';
      render();
    });
  }

  function render() {
    renderBandeau();
    const list = filtered();
    document.getElementById('resa-count').textContent =
      `${list.length} réservation${list.length > 1 ? 's' : ''} · ${formatMontant(list.reduce((s, r) => s + r.montant, 0))} de volume`;

    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="8"><div class="empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
        <h4>Aucune réservation</h4><p>Ajustez vos filtres pour élargir la recherche.</p></div></td></tr>`;
      return;
    }
    tbody.innerHTML = list.map(r => {
      const l = getLogement(r.logementId);
      return `<tr class="is-clickable" data-res="${r.id}">
        <td class="fw-semibold">${r.voyageur}</td>
        <td class="text-soft">${l.nom}<br><small class="text-muted">${l.ville}</small></td>
        <td><span class="badge-canal badge-canal--${r.canal}"><span class="dot"></span>${CANAL_LABEL[r.canal]}</span></td>
        <td class="text-soft">${formatPlage(r.arrivee, r.depart)}<br><small class="text-muted">${r.pers} pers · réf ${r.ref}</small></td>
        <td class="num">${r.nuits}</td>
        <td class="num money">${formatMontant(r.montant)}</td>
        <td><span class="badge ${PAY_BADGE[r.paiement]}">${PAIEMENT_LABEL[r.paiement]}</span></td>
        <td><span class="badge ${STA_BADGE[r.statut]}">${STATUT_LABEL[r.statut]}</span></td>
      </tr>`;
    }).join('');
  }

  document.getElementById('resa-export').addEventListener('click', () => {
    const rows = filtered().map(r => {
      const l = getLogement(r.logementId);
      return [r.voyageur, l.nom, l.ville, CANAL_LABEL[r.canal], r.arrivee, r.depart, r.nuits, r.pers, Math.round(versAffichage(r.montant)), PAIEMENT_LABEL[r.paiement], STATUT_LABEL[r.statut], r.ref];
    });
    UI.exportCSV('cleo-reservations.csv',
      ['Voyageur', 'Logement', 'Ville', 'Canal', 'Arrivée', 'Départ', 'Nuits', 'Voyageurs', `Montant (${symboleDevise()})`, 'Paiement', 'Statut', 'Référence'],
      rows);
  });

  /* ---------- Nouvelle réservation ----------
     Le formulaire vit dans js/resa-form.js : le calendrier l'ouvre aussi,
     et deux copies auraient fini par appliquer deux jeux de règles. */
  function openResaModal() { ResaForm.ouvrir(); }
  document.getElementById('resa-new').addEventListener('click', openResaModal);

  tbody.addEventListener('click', e => { const tr = e.target.closest('tr[data-res]'); if (tr) UI.openResa(tr.dataset.res); });
  // F.logement est exclu : layout.js émet déjà logementChange à sa place,
  // l'écouter deux fois provoquerait un double rendu.
  Object.entries(F).forEach(([k, el]) => { if (k !== 'logement') el.addEventListener('input', render); });
  document.addEventListener('logementChange', render);
  document.addEventListener('resaChanged', render);

  render();

  // Ouverture directe d'une réservation via ?r=ID (depuis messagerie, calendrier…)
  const params = new URLSearchParams(location.search);
  if (params.get('r')) UI.openResa(params.get('r'));
  if (params.get('new')) openResaModal();
})();
