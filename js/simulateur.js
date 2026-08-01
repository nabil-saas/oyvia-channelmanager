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

  /* ---------- Les cartes d'offres ----------
     Elles se recalculent à chaque réglage de la barre : devise, taille du
     parc et périodicité. Business porte le repère « Le plus populaire »,
     fixe et non calculé — c'est un choix commercial, pas une déduction. */
  const PLAN_POPULAIRE = 'business';

  function planCardHTML(p, n) {
    const gratuit = p.unite === 'essai';

    // Dix lignes d'affilée sur Business seraient illisibles : on les rend
    // groupe par groupe, avec l'intitulé du groupe en intertitre.
    const feats = planGroupes(p.id).map(g => `
      ${g.titre ? `<li class="lp-plan__group">${g.titre}</li>` : ''}
      ${g.items.map(f => `
        <li class="lp-plan__feat ${g.herite ? 'lp-plan__feat--herite' : ''}">${CHECK}<span><b>${f.titre}</b>${f.desc ? `<em>${f.desc}</em>` : ''}</span></li>`).join('')}
    `).join('');

    const populaire = p.id === PLAN_POPULAIRE;

    // Bloc prix. En annuel on montre le prix mensuel barré : la remise doit
    // se voir sur le chiffre, pas seulement sur une pastille.
    let bloc;
    if (gratuit) {
      bloc = `<div class="lp-plan__price"><b>0</b><span>pendant ${p.essaiJours} jours</span></div>
              <p class="lp-plan__total">Aucune carte bancaire demandée</p>`;
    } else if (surDevis()) {
      bloc = `<div class="lp-plan__price"><b>Sur devis</b></div>
              <p class="lp-plan__total">Au-delà de ${PARC_MAX_CATALOGUE} logements</p>`;
    } else {
      // Tout vient de tarifAffiche : les montants à l'écran sont cohérents
      // entre eux (prix unitaire × nombre de logements = total).
      const t = tarifAffiche(p.id, n, devise, periode);
      const f = v => formatDevise(v, devise, { deja: true });
      bloc = `
        ${periode === 'annuel'
          ? `<p class="lp-plan__avant"><s>${f(t.plein)}</s>
               <span class="lp-plan__promo">${f(t.plein - t.total)} économisés</span></p>`
          : ''}
        <div class="lp-plan__price">
          <b>${f(t.total)}</b><span>/ mois</span>
        </div>
        <p class="lp-plan__total">
          ${f(t.unite)} par logement · ${n} logement${n > 1 ? 's' : ''}
          ${periode === 'annuel' ? `<br>Facturé ${f(t.annuel)} par an` : ''}
        </p>`;
    }

    const cta = gratuit
      ? `<a class="btn btn--secondary btn--block" href="app/dashboard.html">Créer mon compte</a>`
      : surDevis()
        ? `<a class="btn ${populaire ? 'btn--primary' : 'btn--secondary'} btn--block" href="mailto:contact@oyvia.com?subject=${encodeURIComponent('Demande de devis — ' + n + ' logements')}">Demander un devis</a>`
        : `<a class="btn ${populaire ? 'btn--primary' : 'btn--secondary'} btn--block" href="app/dashboard.html">Choisir ${p.nom}</a>`;

    return `
      <article class="lp-plan ${populaire ? 'is-popular' : ''} ${gratuit ? 'lp-plan--free' : ''}">
        ${populaire ? '<span class="lp-plan__flag">Le plus populaire</span>' : ''}
        <h3 class="lp-plan__name">${p.nom}</h3>
        <p class="lp-plan__resume">${p.accroche}</p>
        ${bloc}
        <div class="lp-plan__foot lp-plan__foot--haut">${cta}</div>
        <ul class="lp-plan__feats">${feats}</ul>
        <p class="lp-plan__ideal"><b>Idéal pour :</b> ${p.idealPour}</p>
      </article>`;
  }

  function renderPlans(n) {
    if (elPlans) elPlans.innerHTML = PLANS.map(p => planCardHTML(p, n)).join('');
  }

  /* ============================================================
     Barre de réglage : devise · parc · périodicité

     Le curseur a disparu : sur un parc de 3 logements comme de 80, ce
     qu'on veut c'est saisir un nombre, pas viser une position. Les deux
     boutons − / + restent visibles en permanence, et le champ accepte la
     frappe directe.
     ============================================================ */
  const elDevise = document.getElementById('lp-devise');
  const elPeriode = document.getElementById('lp-periode');
  const elCount = document.getElementById('lp-count');
  const elDevis = document.getElementById('lp-devis');
  if (!elDevise || !elCount) return;

  const PERIODES = [
    { id: 'mensuel', label: 'Mensuel' },
    { id: 'annuel',  label: 'Annuel'  },
  ];

  let devise = 'MAD';
  let periode = 'mensuel';
  let parc = 8;

  const surDevis = () => parc > PARC_MAX_CATALOGUE;

  function renderBarre() {
    elDevise.innerHTML = DEVISES.map(d => `
      <button type="button" data-devise="${d.id}" class="${d.id === devise ? 'is-active' : ''}"
        aria-pressed="${d.id === devise}">${d.label}</button>`).join('');

    // La pastille de remise vit DANS le bouton « Annuel » : posée à côté,
    // elle semblait flotter hors de la sélection alors qu'elle qualifie
    // précisément ce choix-là.
    elPeriode.innerHTML = PERIODES.map(x => `
      <button type="button" data-periode="${x.id}" class="${x.id === periode ? 'is-active' : ''}"
        aria-pressed="${x.id === periode}">${x.label}${
          x.id === 'annuel' ? `<span class="lp-seg__promo">−${REMISE_ANNUELLE} %</span>` : ''}</button>`).join('');

    // Au-delà du catalogue, on le dit là où la décision se prend.
    elDevis.hidden = !surDevis();
    if (surDevis()) {
      elDevis.innerHTML = `Au-delà de ${PARC_MAX_CATALOGUE} logements, le tarif se construit avec vous.
        <a href="mailto:contact@oyvia.com?subject=${encodeURIComponent('Demande de devis — ' + parc + ' logements')}">Demander un devis</a>`;
    }
  }

  function renderTout() {
    renderBarre();
    renderPlans(parc);
  }

  function setParc(n) {
    // 1 minimum : proposer un tarif pour zéro logement n'aurait pas de sens.
    parc = Math.max(1, Math.min(999, Math.round(n) || 1));
    elCount.value = parc;
    renderTout();
  }

  elDevise.addEventListener('click', e => {
    const b = e.target.closest('button[data-devise]'); if (!b) return;
    devise = b.dataset.devise; renderTout();
  });
  elPeriode.addEventListener('click', e => {
    const b = e.target.closest('button[data-periode]'); if (!b) return;
    periode = b.dataset.periode; renderTout();
  });
  document.getElementById('lp-moins').addEventListener('click', () => setParc(parc - 1));
  document.getElementById('lp-plus').addEventListener('click', () => setParc(parc + 1));

  // Saisie libre : on ne recalcule que sur un nombre valide, sinon effacer
  // le champ pour retaper ferait sauter l'affichage à 1 sous les doigts.
  elCount.addEventListener('input', () => {
    const v = elCount.value.replace(/\D/g, '');
    elCount.value = v;
    if (v !== '') { parc = Math.max(1, Math.min(999, parseInt(v, 10))); renderTout(); }
  });
  elCount.addEventListener('blur', () => setParc(parseInt(elCount.value, 10)));
  elCount.addEventListener('keydown', e => {
    if (e.key === 'ArrowUp')   { e.preventDefault(); setParc(parc + 1); }
    if (e.key === 'ArrowDown') { e.preventDefault(); setParc(parc - 1); }
  });

  setParc(parc);
})();
