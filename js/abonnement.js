/* ============================================================
   OYVIA — Abonnement : mois en cours, options, historique
   Modèle : vous ne payez que pour les logements ayant reçu au
   moins une réservation durant le mois en cours (même principe
   et mêmes tranches — TRANCHES_TARIFAIRES — que la landing page).
   ============================================================ */
Layout.init('abonnement');

(function () {
  const OPT_IC = {
    whatsapp: '<path d="M21 11.5a8.4 8.4 0 0 1-12.3 7.5L3 21l2.1-5.6A8.4 8.4 0 1 1 21 11.5z"/>',
  };
  const icon = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;

  const nbLog = COMPTE.nbLogements;
  const moisCourant = HISTORIQUE_FACTURATION[HISTORIQUE_FACTURATION.length - 1];
  const trancheCourante = trancheTarifaire(moisCourant.logementsReserves);
  const baseCourante = trancheCourante.prix === null ? null : trancheCourante.prix * moisCourant.logementsReserves;

  // WhatsApp est facturé à l'usage → estimation mensuelle sur un volume type,
  // proportionnelle aux logements réservés ce mois-ci (pas à tout le parc).
  function whatsappEstimate() {
    const wa = OPTIONS_LANDING.find(o => o.id === 'whatsapp');
    const rate = c => (wa.tarifs.find(t => t.cat.toLowerCase().includes(c)) || {}).prix || 0;
    const n = moisCourant.logementsReserves;
    const nUtil = n * 25, nMkt = n * 6, nService = n * 30;
    return { messages: nUtil + nMkt + nService, cost: nUtil * rate('utilitaire') + nMkt * rate('marketing') };
  }

  function renderHero() {
    document.getElementById('ab-hero').innerHTML = `
      <span class="ab-hero__badge">Mois en cours — ${moisCourant.mois}</span>
      <div class="ab-hero__plan">${formatMAD(baseCourante)}</div>
      <p style="opacity:.85;font-size:var(--fs-sm);position:relative">Vous ne payez que les logements ayant reçu au moins une réservation ce mois-ci.</p>
      <div class="ab-hero__row">
        <div class="ab-hero__stat"><small>Logements gérés</small><b>${nbLog}</b></div>
        <div class="ab-hero__stat"><small>Réservés ce mois-ci</small><b>${moisCourant.logementsReserves}</b></div>
        <div class="ab-hero__stat"><small>Tarif appliqué</small><b>${trancheCourante.prix === null ? 'Sur devis' : formatMAD(trancheCourante.prix) + ' /logement'}</b></div>
      </div>`;
  }

  function renderOptions() {
    document.getElementById('ab-options').innerHTML = OPTIONS_LANDING.map(o => {
      const active = COMPTE.optionsActives.includes(o.id);
      const rates = o.tarifs ? `<div class="ab-rates">${o.tarifs.map(t =>
        `<div class="ab-rate"><span>${t.cat}<small>${t.detail}</small></span><b class="${t.prix === 0 ? 'free' : ''}">${t.prix === 0 ? 'Gratuit' : formatMAD(t.prix, 2) + ' / message'}</b></div>`).join('')}</div>` : '';
      return `<div class="ab-optionrow">
        <div class="ab-optionrow__ic">${icon(OPT_IC[o.id])}</div>
        <div class="ab-optionrow__meta"><b>${o.nom}</b><small>${o.desc}</small></div>
        <span class="ab-optionrow__price">à l'usage</span>
        <label class="switch"><input type="checkbox" data-opt="${o.id}" ${active ? 'checked' : ''}><span class="switch__track"></span></label>
      </div>${rates}`;
    }).join('');
  }

  function renderSummary() {
    const waActive = COMPTE.optionsActives.includes('whatsapp');
    const est = whatsappEstimate();
    const waLine = waActive
      ? `<div class="ab-summline"><span>WhatsApp voyageur <span class="text-muted">(à l'usage)</span></span><span>≈ ${formatMAD(est.cost)}</span></div>`
      : '';
    const total = (baseCourante || 0) + (waActive ? est.cost : 0);

    document.getElementById('ab-summary').innerHTML = `
      <div class="ab-summline"><span>${moisCourant.logementsReserves} logement${moisCourant.logementsReserves > 1 ? 's' : ''} réservé${moisCourant.logementsReserves > 1 ? 's' : ''} · ${moisCourant.mois}</span><span>${formatMAD(baseCourante)}</span></div>
      ${waLine}
      <div class="ab-summline--total ab-summline"><span>Total mensuel${waActive ? ' estimé' : ''}</span><b>${baseCourante === null ? 'Sur devis' : formatMAD(total)}</b></div>
      ${waActive
        ? `<p class="text-xs text-muted" style="margin-top:var(--sp-2)">Estimation WhatsApp sur ~${est.messages} messages/mois ; les réponses en fenêtre de 24 h sont gratuites.</p>`
        : `<p class="text-xs text-muted" style="margin-top:var(--sp-2)">Sans engagement, résiliable à tout moment. Seuls les logements réservés dans le mois sont facturés.</p>`}`;
  }

  function renderHistorique() {
    const rows = HISTORIQUE_FACTURATION.map(m => {
      const t = trancheTarifaire(m.logementsReserves);
      const montant = t.prix === null ? 'Sur devis' : formatMAD(t.prix * m.logementsReserves);
      return `<div class="ab-hist__row">
        <span>${m.mois}</span>
        <span>${m.logementsReserves} logement${m.logementsReserves > 1 ? 's' : ''}</span>
        <span class="ab-hist__amount">${montant}</span>
      </div>`;
    }).join('');
    document.getElementById('ab-historique').innerHTML = `
      <div class="ab-hist__row ab-hist__row--head"><span>Mois</span><span>Logements réservés</span><span>Montant</span></div>
      ${rows}`;
  }

  function renderAll() { renderHero(); renderOptions(); renderSummary(); renderHistorique(); }

  document.getElementById('ab-options').addEventListener('change', e => {
    const t = e.target.closest('[data-opt]'); if (!t) return;
    const id = t.dataset.opt;
    if (t.checked) { if (!COMPTE.optionsActives.includes(id)) COMPTE.optionsActives.push(id); }
    else { COMPTE.optionsActives = COMPTE.optionsActives.filter(x => x !== id); }
    renderSummary();
    UI.toast(t.checked ? 'Option activée' : 'Option désactivée');
  });

  renderAll();
})();
