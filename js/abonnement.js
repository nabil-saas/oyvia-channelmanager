/* ============================================================
   OYVIA — Abonnement : offre en cours, comparatif, options, historique
   Modèle : 4 offres (PLANS dans js/data.js), les mêmes que la landing.
     · Découverte → essai de 15 jours, 5 logements
     · Smart / Business → grille dégressive × nombre de logements gérés
     · Entreprise → sur devis au-delà du catalogue
   L'offre du compte est COMPTE.plan ; on peut en changer depuis cette
   page (le changement est immédiat dans la démo et déverrouille /
   verrouille l'IA Avancée de Vivi).
   ============================================================ */
Layout.init('abonnement');

(function () {
  const nbLog = COMPTE.nbLogements;
  const moisCourant = HISTORIQUE_FACTURATION[HISTORIQUE_FACTURATION.length - 1];

  function renderHero() {
    const p = getPlan(COMPTE.plan);
    const prix = planPrixTexte(p.id, nbLog);
    document.getElementById('ab-hero').innerHTML = `
      <span class="ab-hero__badge">Mois en cours — ${moisCourant.mois}</span>
      <div class="ab-hero__plan">${formatMAD(planTotal(p.id, nbLog))}</div>
      <p style="opacity:.85;font-size:var(--fs-sm);position:relative">Offre <b>${p.nom}</b> — ${prix.montant} ${prix.suffixe}.</p>
      <div class="ab-hero__row">
        <div class="ab-hero__stat"><small>Logements gérés</small><b>${nbLog}</b></div>
        <div class="ab-hero__stat"><small>Offre</small><b>${p.nom}</b></div>
        <div class="ab-hero__stat"><small>Assistant IA</small><b>${p.ia === 'avancee' ? 'Vivi IA Avancée' : 'Non inclus'}</b></div>
      </div>`;
  }

  function renderSummary() {
    const p = getPlan(COMPTE.plan);
    const base = planTotal(p.id, nbLog);
    // Le prix unitaire vient de la grille dégressive : à 10 logements ce
    // n'est pas le même qu'à 40, et la ligne de facture doit le refléter.
    const ligneBase = `${nbLog} logement${nbLog > 1 ? 's' : ''} × ${formatMAD(prixParLogement(p.id, nbLog))} (${p.nom}) · ${moisCourant.mois}`;

    document.getElementById('ab-summary').innerHTML = `
      <div class="ab-summline"><span>${ligneBase}</span><span>${formatMAD(base)}</span></div>
      <div class="ab-summline--total ab-summline"><span>Total mensuel</span><b>${formatMAD(base)}</b></div>
      <p class="text-xs text-muted" style="margin-top:var(--sp-2)">Sans engagement, résiliable à tout moment. Aucune option facturée en plus : l'intégration WhatsApp est comprise dans votre offre.</p>`;
  }

  /* ---------- Comparatif des offres, avec changement d'offre ---------- */
  function renderPlans() {
    const zone = document.getElementById('ab-plans');
    if (!zone) return;
    const actuel = COMPTE.plan;

    zone.innerHTML = PLANS.map(p => {
      const prix = planPrixTexte(p.id, nbLog);
      const isActuel = p.id === actuel;
      const dispo = planEligible(p.id, nbLog);

      // Même découpage par groupes que la landing, mais sans les descriptions :
      // la carte est deux fois plus étroite ici.
      const feats = planGroupes(p.id).map(g => `
        ${g.titre ? `<li class="ab-plan__group">${g.titre}</li>` : ''}
        ${g.items.map(f => `<li>${f.titre}</li>`).join('')}`).join('');

      let action;
      if (isActuel) action = `<span class="badge badge--positive">Offre actuelle</span>`;
      else if (p.unite === 'essai') action = `<span class="text-xs text-muted">Essai consommé</span>`;
      else if (p.unite === 'devis') action = `<a class="btn btn--secondary btn--sm btn--block" href="mailto:contact@oyvia.com?subject=${encodeURIComponent('Demande de devis — ' + nbLog + ' logements')}">Demander un devis</a>`;
      else if (!dispo) action = `<span class="text-xs text-muted">Au-delà de ${PARC_MAX_CATALOGUE} logements</span>`;
      else action = `<button type="button" class="btn btn--secondary btn--sm btn--block" data-choisir="${p.id}">Passer en ${p.nom}</button>`;

      const total = p.unite === 'essai'
        ? `Gratuit ${p.essaiJours} jours, jusqu'à ${p.essaiLogements} logements`
        : p.unite === 'devis'
          ? `Tarif construit avec vous`
          : dispo
            ? `soit ${formatMAD(planTotal(p.id, nbLog))} / mois pour ${nbLog} logement${nbLog > 1 ? 's' : ''}`
            : `Parc trop grand pour le catalogue`;

      return `
        <article class="ab-plan ${isActuel ? 'is-current' : ''} ${!dispo && p.unite === 'logement_mois' ? 'is-locked' : ''}">
          <div class="ab-plan__top">
            <b>${p.nom}</b>
            <span>${prix.montant}<small>${prix.suffixe}</small></span>
          </div>
          <p class="ab-plan__total">${total}</p>
          <ul class="ab-plan__feats">${feats}</ul>
          <div class="ab-plan__action">${action}</div>
        </article>`;
    }).join('');
  }

  function renderHistorique() {
    const rows = HISTORIQUE_FACTURATION.map(m => {
      // Le mois en cours suit l'offre réellement souscrite (COMPTE.plan),
      // qui peut avoir été changée depuis cette page. HISTORIQUE_FACTURATION
      // n'est pas persisté, donc on ne le mute pas.
      const planId = m === moisCourant ? COMPTE.plan : m.plan;
      const p = getPlan(planId);
      return `<div class="ab-hist__row">
        <span>${m.mois}</span>
        <span>${p.nom}</span>
        <span>${m.nbLogements} logement${m.nbLogements > 1 ? 's' : ''}</span>
        <span class="ab-hist__amount">${formatMAD(planTotal(planId, m.nbLogements))}</span>
      </div>`;
    }).join('');
    document.getElementById('ab-historique').innerHTML = `
      <div class="ab-hist__row ab-hist__row--head"><span>Mois</span><span>Offre</span><span>Logements gérés</span><span>Montant</span></div>
      ${rows}`;
  }

  function renderAll() { renderHero(); renderSummary(); renderPlans(); renderHistorique(); }

  /* ---------- Changement d'offre ---------- */
  // Quitter Business coupe l'IA Avancée : on prévient explicitement, car
  // Vivi cesse de répondre aux voyageurs et sa configuration devient inactive.
  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-choisir]');
    if (!btn) return;
    const cible = getPlan(btn.dataset.choisir);
    const perdIA = getPlan(COMPTE.plan).ia && !cible.ia;

    const appliquer = () => {
      COMPTE.plan = cible.id;
      if (typeof saveOyviaState === 'function') saveOyviaState();
      renderAll();
      UI.toast(`Offre ${cible.nom} activée`);
    };

    if (perdIA) {
      UI.confirm({
        title: `Passer en ${cible.nom} ?`,
        message: `Vivi cessera de répondre aux messages entrants de vos voyageurs, et les réponses en attente de relecture ne partiront plus.\n\nVos automatisations de règles (confirmation, rappels, demande d'avis) continuent de fonctionner, et la configuration de Vivi est conservée : elle redeviendra active si vous repassez en Business.`,
        confirmText: `Passer en ${cible.nom}`,
        cancelText: 'Annuler',
        danger: true,
        onConfirm: appliquer,
      });
    } else {
      appliquer();
    }
  });

  renderAll();
})();
