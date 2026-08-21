/* ============================================================
   OYVIA — Landing : offres tarifaires + simulateur
   Modèle : 5 offres (cf. PLANS dans js/data.js).
     · Gratuit    → création de compte, découverte de la plateforme
     · Découverte → ~1 €/logement/mois, 2 logements, 6 mois
     · Smart      → grille dégressive par logement, sans IA voyageur
     · Business   → grille dégressive par logement, + Vivi IA Avancée
     · Entreprise → sur devis au-delà de 100 logements

   Les cartes ne portent que le montant et l'action ; le détail des
   fonctionnalités est rendu juste en dessous, offre par offre.

   Les cartes d'offres ET le simulateur sont générés depuis PLANS :
   la landing ne peut donc pas diverger du tarif appliqué dans l'app
   (app/abonnement.html lit exactement les mêmes données).

   Le simulateur est placé AVANT les cartes : on demande d'abord la
   taille du parc, puis chaque carte affiche le montant réel pour ce
   parc-là plutôt qu'un prix unitaire à multiplier de tête.
   ============================================================ */
(function () {
  // formatPrixAbo(), PLANS, planTotal(), planPrixTexte(), planEligible(),
  // planRecommande(), planGroupes() et getPlan() viennent de data.js.

  const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
  const elPlans = document.getElementById('lp-plans');

  /* ---------- Les cartes d'offres ----------
     Elles se recalculent à chaque réglage de la barre : devise, taille du
     parc et périodicité. Business porte le repère « Le plus populaire »,
     fixe et non calculé — c'est un choix commercial, pas une déduction. */
  const PLAN_POPULAIRE = 'business';

  function planCardHTML(p, n) {
    const gratuit = p.unite === 'gratuit';
    const devis   = p.unite === 'devis';

    /* Une offre payante qui ne couvre pas le parc saisi est grisée plutôt que
       retirée : le visiteur doit voir ce qu'il quitte en changeant de taille.
       On s'appuie sur planEligible, donc sur les bornes déclarées dans PLANS —
       Découverte s'arrête à 2 logements, Smart et Business au catalogue. */
    const bloque = !gratuit && !devis && !planEligible(p.id, n);

    // Dire POURQUOI c'est indisponible, et court : une phrase longue élargit
    // sa colonne de grille et décale toute la rangée.
    const limite = bloque
      ? (p.maxLog < PARC_MAX_CATALOGUE
          ? `Jusqu'à ${p.maxLog} logement${p.maxLog > 1 ? 's' : ''}`
          : `Jusqu'à ${PARC_MAX_CATALOGUE} logements`)
      : '';

    const populaire = p.id === PLAN_POPULAIRE && !bloque;

    /* Bloc prix. La carte ne porte plus QUE le montant et l'action : le
       détail des fonctionnalités est repris plus bas, offre par offre, où
       il y a la place de le lire. */
    let bloc;
    if (bloque) {
      bloc = `<div class="lp-plan__price"><b>—</b></div>`;
    } else if (gratuit) {
      bloc = `<div class="lp-plan__price"><b>0</b><span>/ mois</span></div>`;
    } else if (devis) {
      bloc = `<div class="lp-plan__price"><b>Sur devis</b></div>`;
    } else {
      // Tout vient de tarifAffiche : les montants à l'écran restent
      // cohérents entre eux (prix unitaire × logements facturés = total).
      const t = tarifAffiche(p.id, n, devise, periode);
      const f = v => formatDevise(v, devise, { deja: true });
      bloc = `
        ${periode === 'annuel'
          ? `<p class="lp-plan__avant"><s>${f(t.plein)}</s>
               <span class="lp-plan__promo">${f(t.plein - t.total)} économisés</span></p>`
          : ''}
        <div class="lp-plan__price">
          <b>${f(t.total)}</b><span>/ mois</span>
        </div>`;
    }

    let cta;
    if (bloque)       cta = `<span class="btn btn--secondary btn--block is-disabled" aria-disabled="true">${limite}</span>`;
    else if (gratuit) cta = `<a class="btn btn--secondary btn--block" href="app/dashboard.html">Créer mon compte</a>`;
    else if (devis)   cta = `<a class="btn ${n > PARC_MAX_CATALOGUE ? 'btn--primary' : 'btn--secondary'} btn--block" href="mailto:contact@oyvia.com?subject=${encodeURIComponent('Demande de devis — ' + n + ' logements')}">Demander un devis</a>`;
    else              cta = `<a class="btn ${populaire ? 'btn--primary' : 'btn--secondary'} btn--block" href="app/dashboard.html">Choisir ${p.nom}</a>`;

    return `
      <article class="lp-plan lp-plan--compact ${populaire ? 'is-popular' : ''} ${gratuit ? 'lp-plan--free' : ''} ${bloque ? 'is-locked' : ''}">
        ${populaire ? '<span class="lp-plan__flag">Le plus populaire</span>' : ''}
        <h3 class="lp-plan__name">${p.nom}</h3>
        <p class="lp-plan__resume">${p.accroche}</p>
        ${bloc}
        <div class="lp-plan__foot">${cta}</div>
      </article>`;
  }

  /* ---------- Tableau comparatif ----------
     Une ligne par fonctionnalité, une colonne par offre. Les cartes ne
     portant plus que le montant, c'est ici qu'on répond à « qu'est-ce que
     je gagne en montant d'offre ? » — question qui se lit en balayant une
     ligne, pas en comparant cinq listes côte à côte. */
  const elDetails = document.getElementById('lp-details');

  const CROIX = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';

  function celluleMatrice(valeur) {
    if (valeur === 'inclus') return `<td class="lp-tab__cell lp-tab__cell--oui"><span class="sr-only">Inclus</span>${CHECK}</td>`;
    if (valeur === 'non')    return `<td class="lp-tab__cell lp-tab__cell--non"><span class="sr-only">Non inclus</span>${CROIX}</td>`;
    if (valeur === 'option') return `<td class="lp-tab__cell lp-tab__cell--option"><span class="lp-tab__option">Option</span></td>`;
    return `<td class="lp-tab__cell lp-tab__cell--texte">${valeur}</td>`;
  }

  function renderTableau() {
    if (!elDetails) return;
    const cols = MATRICE_COLONNES.map(id => getPlan(id)).filter(Boolean);

    const entetes = cols.map(p => `
      <th scope="col" class="${p.id === PLAN_POPULAIRE ? 'is-popular' : ''}">
        <span class="lp-tab__offre">${p.nom}</span>
      </th>`).join('');

    const corps = MATRICE_OFFRES.map(g => `
      <tr class="lp-tab__grouperow">
        <th scope="rowgroup" colspan="${cols.length + 1}">${g.groupe}</th>
      </tr>
      ${g.lignes.map(l => `
        <tr>
          <th scope="row" class="lp-tab__feat">
            <b>${l.nom}</b>${l.desc ? `<em>${l.desc}</em>` : ''}
          </th>
          ${l.v.map((val, i) => celluleMatrice(val).replace('lp-tab__cell',
              'lp-tab__cell' + (cols[i] && cols[i].id === PLAN_POPULAIRE ? ' is-popular' : ''))).join('')}
        </tr>`).join('')}
    `).join('');

    elDetails.innerHTML = `
      <div class="lp-tab__scroll">
        <table class="lp-tab">
          <thead>
            <tr><th scope="col" class="lp-tab__coin">Fonctionnalité</th>${entetes}</tr>
          </thead>
          <tbody>${corps}</tbody>
        </table>
      </div>
      <p class="lp-tab__legende">
        <span><i class="lp-tab__pastille lp-tab__pastille--oui"></i> Inclus</span>
        <span><i class="lp-tab__pastille lp-tab__pastille--option"></i> Disponible en option</span>
        <span><i class="lp-tab__pastille lp-tab__pastille--non"></i> Non disponible</span>
      </p>`;
  }

  function renderPlans(n) {
    if (elPlans) elPlans.innerHTML = PLANS.map(p => planCardHTML(p, n)).join('');
    // Le tableau ne dépend ni du parc ni de la devise : un seul rendu suffit.
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

  /* Taille de parc affichée à l'ouverture de la page.

     Choix commercial, pas technique : il décide de ce que le visiteur
     voit avant d'avoir rien réglé. À 1 logement, ce sont les montants
     les plus BAS de la grille qui s'affichent — l'entrée de gamme parle
     d'elle-même, et celui qui gère davantage de biens monte le compteur
     de lui-même. Contrepartie assumée : la dégressivité par logement,
     elle, ne se découvre qu'une fois le chiffre augmenté.

     Une seule ligne à changer : le champ de la page est rempli depuis
     cette valeur (cf. setParc en fin de fichier), il n'y a rien à
     modifier dans index.html. */
  const PARC_DEFAUT = 1;

  let devise = 'MAD';
  let periode = 'mensuel';
  let parc = PARC_DEFAUT;

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

  // Le tableau comparatif est statique : rendu une fois, hors du cycle
  // de recalcul déclenché par la devise ou la taille du parc.
  renderTableau();

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
