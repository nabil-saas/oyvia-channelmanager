/* ============================================================
   OYVIA — Landing : offres tarifaires + simulateur
   Modèle : 3 offres (cf. PLANS dans js/data.js).
     · Gratuit  → essai de 15 jours à la création du compte
     · Smart    → prix par logement et par mois, sans IA voyageur
     · Business → prix par logement et par mois, + Vivi IA Avancée

   Les cartes d'offres ET le simulateur sont générés depuis PLANS :
   la landing ne peut donc pas diverger du tarif appliqué dans l'app
   (app/abonnement.html lit exactement les mêmes données).

   Le simulateur est placé AVANT les cartes : on demande d'abord la
   taille du parc, puis chaque carte affiche le montant réel pour ce
   parc-là plutôt qu'un prix unitaire à multiplier de tête.
   ============================================================ */
(function () {
  // formatMAD(), PLANS, planTotal(), planPrixTexte(), planEligible(),
  // planRecommande(), planGroupes() et getPlan() viennent de data.js.

  const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
  const elPlans = document.getElementById('lp-plans');

  /* ---------- Les cartes d'offres, recalculées pour n logements ---------- */
  // actifId = l'offre mise en avant (celle du niveau d'IA choisi, ou la
  // recommandation par défaut) · manuel = l'utilisateur l'a choisie lui-même,
  // auquel cas on ne prétend pas que c'est « la plus adaptée ».
  function planCardHTML(p, n, actifId, manuel) {
    const prix = planPrixTexte(p.id);
    const enAvant = p.id === actifId;

    // Dix lignes d'affilée sur Business seraient illisibles : on les rend
    // groupe par groupe, avec l'intitulé du groupe en intertitre.
    const feats = planGroupes(p.id).map(g => `
      ${g.titre ? `<li class="lp-plan__group">${g.titre}</li>` : ''}
      ${g.items.map(f => `
        <li class="lp-plan__feat ${g.herite ? 'lp-plan__feat--herite' : ''}">${CHECK}<span><b>${f.titre}</b>${f.desc ? `<em>${f.desc}</em>` : ''}</span></li>`).join('')}
    `).join('');

    const cta = p.unite === 'essai'
      ? `<a class="btn btn--secondary btn--block" href="app/dashboard.html">Créer mon compte</a>`
      : `<a class="btn ${enAvant ? 'btn--primary' : 'btn--secondary'} btn--block" href="app/dashboard.html">Choisir ${p.nom}</a>`;

    // Ce que ça coûte vraiment pour le parc saisi — l'information que le
    // visiteur cherche.
    const total = p.unite === 'essai'
      ? `Gratuit pendant ${p.essaiJours} jours`
      : `soit <b>${formatMAD(planTotal(p.id, n))}</b> / mois pour ${n} logement${n > 1 ? 's' : ''}`;

    return `
      <article class="lp-plan ${enAvant ? 'is-popular' : ''} ${p.unite === 'essai' ? 'lp-plan--free' : ''}">
        ${enAvant ? `<span class="lp-plan__flag">${manuel ? 'Votre sélection' : 'Adaptée à votre parc'}</span>` : ''}
        <h3 class="lp-plan__name">${p.nom}</h3>
        <div class="lp-plan__price">
          <b>${prix.montant}</b>
          <span>${prix.suffixe}</span>
        </div>
        <p class="lp-plan__total">${total}</p>
        <p class="lp-plan__resume">${p.accroche}</p>
        <ul class="lp-plan__feats">${feats}</ul>
        <div class="lp-plan__foot">
          <p class="lp-plan__ideal"><b>Idéal pour :</b> ${p.idealPour}</p>
          ${cta}
        </div>
      </article>`;
  }

  function renderPlans(n, actifId, manuel) {
    if (elPlans) elPlans.innerHTML = PLANS.map(p => planCardHTML(p, n, actifId, manuel)).join('');
  }

  /* ---------- Simulateur : curseur + saisie libre + niveau d'IA ---------- */
  const range = document.getElementById('sim-range');
  const elCount = document.getElementById('sim-count');
  const elTotal = document.getElementById('sim-total');
  const elSub = document.getElementById('sim-sub');
  const elPlan = document.getElementById('sim-plan');
  const elIA = document.getElementById('sim-ia');
  if (!range || !elCount) return;

  const COUNT_MIN = parseInt(elCount.min, 10) || 1;
  const COUNT_MAX = parseInt(elCount.max, 10) || 500;

  // L'IA est la seule chose qui sépare Smart de Business : on expose donc ce
  // choix-là plutôt que des noms d'offres, qui ne disent rien de ce qu'on achète.
  const NIVEAUX_IA = [
    { id: 'aucun',   plan: 'smart',    label: 'Sans IA',           phrase: 'sans IA' },
    { id: 'avancee', plan: 'business', label: 'IA Avancée (Vivi)', phrase: "avec l'IA Avancée (Vivi)" },
  ];

  let iaChoisie = null;   // null = on suit la recommandation automatique

  // Le curseur ne va que jusqu'à 100 (pour rester maniable au glisser) ; au-delà,
  // on continue d'accepter la saisie au clavier — le curseur reste juste calé au bout.
  function syncRangeThumb(n) {
    range.value = Math.min(n, parseInt(range.max, 10));
  }

  function renderIA(actif) {
    if (!elIA) return;
    // Smart et Business n'ont plus de plafond : les deux choix sont
    // toujours disponibles, quel que soit le nombre de logements.
    elIA.innerHTML = NIVEAUX_IA.map(niv => `
      <button type="button" data-ia="${niv.id}" class="${niv.plan === actif ? 'is-active' : ''}"
        aria-pressed="${niv.plan === actif}">${niv.label}</button>`).join('');
  }

  function renderSim(n) {
    n = Math.min(COUNT_MAX, Math.max(COUNT_MIN, Math.round(n) || COUNT_MIN));
    elCount.value = n;
    syncRangeThumb(n);

    // Offre active : celle du niveau d'IA choisi, sinon la recommandation.
    const manuel = !!iaChoisie;
    const p = getPlan(manuel
      ? NIVEAUX_IA.find(x => x.id === iaChoisie).plan
      : planRecommande(n));

    renderIA(p.id);

    elTotal.textContent = formatMAD(planTotal(p.id, n));
    elSub.textContent = `par mois en ${p.nom}, ${n > 1 ? `pour vos ${n} logements gérés` : 'pour votre logement'}`;

    const prix = planPrixTexte(p.id);
    const niv = NIVEAUX_IA.find(x => x.plan === p.id);
    elPlan.innerHTML = `${manuel
      ? `${n} logement${n > 1 ? 's' : ''} ${niv.phrase} : offre <b>${p.nom}</b>`
      : `L'offre la plus adaptée à ${n} logement${n > 1 ? 's' : ''} est <b>${p.nom}</b>`} — ${prix.montant} ${prix.suffixe}.
      <br><span class="lp-sim__trial">Et avant de payer : 15 jours gratuits dès la création du compte.</span>`;

    renderPlans(n, p.id, manuel);
  }

  if (elIA) elIA.addEventListener('click', e => {
    const btn = e.target.closest('button[data-ia]');
    if (!btn) return;
    iaChoisie = btn.dataset.ia;
    renderSim(parseInt(elCount.value, 10));
  });

  range.addEventListener('input', () => renderSim(parseInt(range.value, 10)));
  elCount.addEventListener('input', () => { if (elCount.value !== '') renderSim(parseInt(elCount.value, 10)); });
  elCount.addEventListener('blur', () => renderSim(parseInt(elCount.value, 10)));

  renderSim(parseInt(elCount.value, 10));
})();
