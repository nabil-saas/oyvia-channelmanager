/* ============================================================
   OYVIA — Landing : simulateur de tarif
   Modèle : un tarif dégressif par logement géré, qu'il ait été
   réservé ou non dans le mois (total = prix_tranche × nombre de
   logements).

   L'option WhatsApp est simplement mentionnée dans la page (sans
   tarif) ; son détail de facturation reste dans l'app, sur
   Paramètres > Options supplémentaires.
   ============================================================ */
(function () {
  // formatMAD() et trancheTarifaire() sont définis globalement dans data.js
  // (partagés avec l'abonnement de l'app pour rester cohérents).

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
      elSub.textContent = 'pour un seul logement géré';
    } else {
      const total = t.prix * n;
      elTotal.textContent = formatMAD(total);
      elSub.textContent = `par mois, pour vos ${n} logement${n > 1 ? 's gérés' : ' géré'}`;
    }

    const prixTxt = t.prix === null ? 'tarif sur devis' : t.prix === 0 ? 'gratuit' : `${formatMAD(t.prix)} / logement / mois`;
    elPlan.innerHTML = `Sur cette tranche : <b>${prixTxt}</b>. Facturation simple sur l'ensemble de votre parc, réservé ou non.`;
  }

  range.addEventListener('input', () => renderSim(parseInt(range.value, 10)));
  elCount.addEventListener('input', () => { if (elCount.value !== '') renderSim(parseInt(elCount.value, 10)); });
  elCount.addEventListener('blur', () => renderSim(parseInt(elCount.value, 10)));

  renderSim(parseInt(elCount.value, 10));
})();
