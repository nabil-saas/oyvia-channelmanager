/* ============================================================
   OYVIA — Abonnement : offre en cours, contact support, historique
   Modèle : 4 offres (PLANS dans js/data.js), les mêmes que la landing.
     · Gratuit    → création de compte, découverte de la plateforme
     · Découverte → ~1 €/logement/mois, 2 logements, 6 mois
     · Smart / Business → grille dégressive × nombre de logements gérés
     · Entreprise → sur devis au-delà du catalogue
   L'offre du compte est COMPTE.plan ; on peut en changer depuis cette
   page (le changement est immédiat dans la démo et déverrouille /
   verrouille l'IA Avancée de Vivi).
   ============================================================ */
Layout.init('abonnement');

(function () {
  const nbLog = COMPTE.nbLogements;
  const ICO_WA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2z"/><path d="M8.6 8.2c.2-.4.4-.4.6-.4h.5c.2 0 .4 0 .6.4l.8 1.8c.1.2 0 .4-.1.6l-.4.4c-.1.2-.2.3 0 .5a6 6 0 0 0 2.9 2.6c.2.1.4 0 .5-.1l.5-.6c.2-.2.3-.2.5-.1l1.7.8c.2.1.3.2.3.4 0 .5-.2 1.2-.8 1.6-.5.3-1.4.5-2.4.2a9.6 9.6 0 0 1-5.5-5.3c-.4-1-.2-1.9.1-2.4z"/></svg>';
  const moisCourant = HISTORIQUE_FACTURATION[HISTORIQUE_FACTURATION.length - 1];

  function renderHero() {
    const p = getPlan(COMPTE.plan);
    const prix = planPrixTexte(p.id, nbLog);
    document.getElementById('ab-hero').innerHTML = `
      <span class="ab-hero__badge">Mois en cours — ${moisCourant.mois}</span>
      <div class="ab-hero__plan">${formatPrixAbo(planTotal(p.id, nbLog))}</div>
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
    const ligneBase = `${nbLog} logement${nbLog > 1 ? 's' : ''} × ${formatPrixAbo(prixParLogement(p.id, nbLog))} (${p.nom}) · ${moisCourant.mois}`;

    document.getElementById('ab-summary').innerHTML = `
      <div class="ab-summline"><span>${ligneBase}</span><span>${formatPrixAbo(base)}</span></div>
      <div class="ab-summline--total ab-summline"><span>Total mensuel</span><b>${formatPrixAbo(base)}</b></div>
      <p class="text-xs text-muted" style="margin-top:var(--sp-2)">Sans engagement, résiliable à tout moment. Aucune option facturée en plus : l'intégration WhatsApp est comprise dans votre offre.</p>`;
  }

  /* ---------- Changer d'offre : contact du support ----------
     La grille des offres a été retirée de cette page : l'hôte connaît déjà
     la sienne (rappelée en tête), et le comparatif complet vit sur la
     landing. Ne reste donc que l'action utile — joindre l'équipe.

     Deux chemins volontairement : WhatsApp pour qui veut une réponse tout de
     suite, formulaire pour qui préfère cadrer sa demande. Le message est
     pré-rempli avec l'offre en cours et la taille du parc — sans quoi
     l'échange commence par trois questions que nous connaissons déjà. */
  function messagePreRempli(cible) {
    const actuel = getPlan(COMPTE.plan);
    return `Bonjour, je suis ${UTILISATEUR.nom} (${COMPTE.societe}). `
         + `Je suis actuellement en offre ${actuel.nom} avec ${nbLog} logement${nbLog > 1 ? 's' : ''}. `
         + (cible ? `Je souhaite passer en offre ${cible}. ` : `Je souhaite faire évoluer mon offre. `)
         + `Pouvez-vous m'accompagner ?`;
  }

  function renderContactSupport() {
    const zone = document.getElementById('ab-support');
    if (!zone) return;
    zone.innerHTML = `
      <div class="ab-support">
        <div class="ab-support__txt">
          <b>Vous souhaitez changer d'offre ?</b>
          <p>Notre équipe s'en occupe avec vous : ajustement du parc, bascule de facturation et reprise de vos données. ${SUPPORT_OYVIA.delaiReponse}.</p>
        </div>
        <div class="ab-support__actions">
          <a class="btn btn--primary" id="ab-wa" href="${lienWhatsAppSupport(messagePreRempli(null))}" target="_blank" rel="noopener">
            ${ICO_WA} Écrire sur WhatsApp
          </a>
          <button type="button" class="btn btn--secondary" id="ab-form-open">Remplir le formulaire</button>
        </div>
      </div>`;

    document.getElementById('ab-form-open').addEventListener('click', ouvrirFormulaire);
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
        <span class="ab-hist__amount">${formatPrixAbo(planTotal(planId, m.nbLogements))}</span>
      </div>`;
    }).join('');
    document.getElementById('ab-historique').innerHTML = `
      <div class="ab-hist__row ab-hist__row--head"><span>Mois</span><span>Offre</span><span>Logements gérés</span><span>Montant</span></div>
      ${rows}`;
  }

  function renderAll() { renderHero(); renderSummary(); renderContactSupport(); renderHistorique(); }

  /* ---------- Formulaire de demande ----------
     Rien n'est appliqué au compte : la demande part au support, qui procède
     au changement. Faire basculer l'offre ici donnerait l'illusion d'un
     changement acté alors que rien n'a été facturé ni validé. */
  function ouvrirFormulaire() {
    const sel = document.getElementById('ab-f-offre');
    // On ne propose que des offres différentes de l'actuelle, et éligibles au
    // parc — proposer ce qui ne peut pas être souscrit ferait perdre du temps
    // à l'hôte comme au support.
    const cibles = PLANS.filter(p => p.id !== COMPTE.plan && (planEligible(p.id, nbLog) || p.unite === 'devis'));
    sel.innerHTML = cibles.map(p => `<option value="${p.id}">${p.nom}</option>`).join('')
      + '<option value="autre">Je ne sais pas encore / autre demande</option>';

    document.getElementById('ab-f-parc').value = nbLog;
    document.getElementById('ab-f-msg').value = '';
    document.getElementById('ab-f-offre-actuelle').textContent = getPlan(COMPTE.plan).nom;
    UI.openPanel('ab-form-modal');
  }

  document.getElementById('ab-form-send').addEventListener('click', () => {
    const offreId = document.getElementById('ab-f-offre').value;
    const parc = parseInt(document.getElementById('ab-f-parc').value, 10) || nbLog;
    const cible = offreId === 'autre' ? null : getPlan(offreId);
    const msg = document.getElementById('ab-f-msg').value.trim();

    UI.closeAll();
    UI.toast(`Demande envoyée au support — ${SUPPORT_OYVIA.delaiReponse.toLowerCase()}`);
    // Aucune écriture sur COMPTE : l'offre ne change qu'une fois traitée par
    // l'équipe. Le récapitulatif reste donc celui de l'offre en cours.
    console.info('[abonnement] demande de changement d\'offre', {
      de: COMPTE.plan, vers: offreId, parc, message: msg,
    });
  });

  renderAll();
})();
