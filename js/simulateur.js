/* ============================================================
   OYVIA — Landing : simulateur de tarif + option WhatsApp
   Modèle : vous ne payez que pour les logements ayant reçu au
   moins une réservation durant le mois en cours. Le tarif de la
   tranche s'applique à ces logements réservés
   (total = prix_tranche × nombre de logements réservés).
   ============================================================ */
(function () {
  // formatMAD() et trancheTarifaire() sont définis globalement dans data.js
  // (partagés avec l'abonnement de l'app pour rester cohérents).

  /* ---------- Option WhatsApp (facturée au message) ---------- */
  function renderOptions() {
    const wa = OPTIONS_LANDING.find(o => o.id === 'whatsapp');
    const rates = wa.tarifs.map(t => `
      <div class="lp-wa__rate">
        <span class="cat">${t.cat}<small>${t.detail}</small></span>
        <span class="price ${t.prix === 0 ? 'free' : ''}">${t.prix === 0 ? 'Gratuit' : formatMAD(t.prix, 2) + ' / message'}</span>
      </div>`).join('');
    document.getElementById('options').innerHTML = `
      <div class="lp-wa">
        <div class="lp-wa__head">
          <div class="lp-wa__ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-12.3 7.5L3 21l2.1-5.6A8.4 8.4 0 1 1 21 11.5z"/></svg></div>
          <div><b>${wa.nom}</b><span>${wa.desc}</span></div>
        </div>
        <div class="lp-wa__rates">${rates}</div>
      </div>`;
  }

  /* ---------- Simulateur : curseur + saisie libre d'un chiffre, synchronisés ---------- */
  const range = document.getElementById('sim-range');
  const elCount = document.getElementById('sim-count');
  const elTotal = document.getElementById('sim-total');
  const elSub = document.getElementById('sim-sub');
  const elPlan = document.getElementById('sim-plan');

  const COUNT_MIN = parseInt(elCount.min, 10) || 1;
  const COUNT_MAX = parseInt(elCount.max, 10) || 500;

  // Le curseur ne va que jusqu'à 100 (pour rester maniable au glisser) ; au-delà,
  // on continue d'accepter la saisie au clavier — le curseur reste juste calé au bout.
  function syncRangeThumb(n) {
    const rMax = parseInt(range.max, 10);
    range.value = Math.min(n, rMax);
  }

  function renderSim(n) {
    n = Math.min(COUNT_MAX, Math.max(COUNT_MIN, Math.round(n) || COUNT_MIN));
    elCount.value = n;
    syncRangeThumb(n);
    const t = trancheTarifaire(n);

    if (t.prix === null) {
      elTotal.textContent = 'Sur devis';
      elSub.textContent = 'tarif dégressif pour les grands parcs';
    } else if (t.prix === 0) {
      elTotal.textContent = 'Gratuit';
      elSub.textContent = 'si votre unique logement est réservé ce mois-ci';
    } else {
      const total = t.prix * n;
      elTotal.textContent = formatMAD(total);
      elSub.textContent = `par mois, si vos ${n} logement${n > 1 ? 's sont réservés' : ' est réservé'} ce mois-ci`;
    }

    const prixTxt = t.prix === null ? 'tarif sur devis' : t.prix === 0 ? 'gratuit' : `${formatMAD(t.prix)} / logement réservé / mois`;
    elPlan.innerHTML = `Sur cette tranche : <b>${prixTxt}</b>. Un logement non réservé ce mois-ci ne vous coûte rien.`;
  }

  range.addEventListener('input', () => renderSim(parseInt(range.value, 10)));
  elCount.addEventListener('input', () => { if (elCount.value !== '') renderSim(parseInt(elCount.value, 10)); });
  elCount.addEventListener('blur', () => renderSim(parseInt(elCount.value, 10)));

  renderOptions();
  renderSim(parseInt(elCount.value, 10));
})();
