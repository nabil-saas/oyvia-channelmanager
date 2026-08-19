/* ============================================================
   OYVIA interne — Demandes clients

   File de support : chaque demande arrive d'un des deux points
   d'entrée du produit (bouton « Contacter le support » dans
   l'app cliente, ou WhatsApp Business). L'enjeu n'est pas
   d'en traiter beaucoup mais de n'en rater aucune.

   Structure du fichier :
   — Filtres et onglets : état en mémoire, recalculé à chaque
     interaction sans toucher l'URL (contrairement à comptes.js
     qui lit les params GET, ici aucun écran externe ne pointe
     sur un filtre précis).
   — Cartes : rendu léger, délégation sur le conteneur.
   — Panneau : rendu complet à chaque ouverture pour rester
     synchrone sans gestion de diff.
   ============================================================ */
if (AdminLayout.init('demandes')) { /* accès refusé */ } else {
(function () {

  const F = id => document.getElementById(id);
  const ic = Adm.ic;
  const peutAgir = peutAdmin('demandes');

  let panneauId = null;   // demande actuellement ouverte dans le panneau
  let ongletActif = 'a_traiter';

  const filtres = {
    q: '',
    sujet: 'tous',
    assignation: 'tous',
  };

  /* ---------- Peuplement des selects ----------
     Les membres actifs sont injectés une seule fois : la liste ne
     change pas pendant la session, inutile de la reconstruire à
     chaque rendu. */
  (function initSelects() {
    const sujets = F('dm-sujet');
    Object.keys(DEMANDE_SUJETS).forEach(k => {
      const o = document.createElement('option');
      o.value = k;
      o.textContent = DEMANDE_SUJETS[k].label;
      sujets.appendChild(o);
    });

    const assignation = F('dm-assignation');
    MEMBRES_OYVIA.filter(m => m.statut === 'actif').forEach(m => {
      const o = document.createElement('option');
      o.value = m.id;
      o.textContent = m.nom;
      assignation.appendChild(o);
    });
  })();

  /* ---------- Logique de filtrage ---------- */
  function listeFiltree() {
    const q = filtres.q.trim().toLowerCase();

    return DEMANDES.filter(d => {
      // L'onglet filtre d'abord : inutile d'évaluer le reste si l'onglet
      // exclut déjà la demande.
      if (ongletActif === 'a_traiter' && d.statut === 'traitee') return false;
      if (ongletActif === 'traitees'  && d.statut !== 'traitee') return false;

      if (filtres.sujet !== 'tous' && d.sujet !== filtres.sujet) return false;

      if (filtres.assignation === 'non_assignees' && d.assigneA) return false;
      if (filtres.assignation !== 'tous' && filtres.assignation !== 'non_assignees' && d.assigneA !== filtres.assignation) return false;

      if (!q) return true;
      const societe = nomClient(d.clientId).toLowerCase();
      return d.message.toLowerCase().includes(q) || societe.includes(q);
    });
  }

  /* ---------- Délai moyen de première réponse (en jours) ----------
     On calcule sur les demandes ayant au moins un échange : une
     demande sans réponse ne dit pas combien de temps on a mis,
     elle dit seulement qu'on n'a pas encore répondu. */
  function delaiMoyenPremierReponse() {
    let total = 0, n = 0;
    DEMANDES.forEach(d => {
      if (!d.echanges || !d.echanges.length) return;
      const ecart = nuitsEntre(d.creeLe, d.echanges[0].le);
      if (ecart >= 0) { total += ecart; n++; }
    });
    if (!n) return null;
    return (total / n).toFixed(1);
  }

  /* ---------- KPI ---------- */
  function renderKpis() {
    const nouvelles = DEMANDES.filter(d => d.statut === 'nouvelle').length;
    const enCours   = DEMANDES.filter(d => d.statut === 'en_cours').length;
    const traitees  = DEMANDES.filter(d => d.statut === 'traitee').length;
    const delai     = delaiMoyenPremierReponse();

    F('dm-kpis').innerHTML = [
      Adm.kpi({
        label: 'Nouvelles',
        valeur: nouvelles,
        pied: nouvelles ? 'En attente de prise en charge' : 'Aucune demande en attente',
        icone: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
        // Un rouge immédiat : une nouvelle demande non vue est une promesse
        // client non tenue.
        ton: nouvelles > 0 ? 'danger' : '',
      }),
      Adm.kpi({
        label: 'En cours',
        valeur: enCours,
        pied: enCours ? 'Demandes assignées et traitées' : 'Aucune en cours',
        icone: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
        ton: 'warning',
      }),
      Adm.kpi({
        label: 'Traitées',
        valeur: traitees,
        pied: 'Depuis le début',
        icone: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
        ton: 'positive',
      }),
      Adm.kpi({
        label: 'Délai moyen 1re réponse',
        valeur: delai !== null ? delai + ' j' : '—',
        pied: delai !== null ? 'Sur les demandes avec échange' : 'Pas encore de réponse enregistrée',
        icone: '<path d="M12 2v10l4 2"/><circle cx="12" cy="12" r="10"/>',
      }),
    ].join('');
  }

  /* ---------- Cartes de la liste ---------- */
  function renderListe() {
    const liste = listeFiltree();
    const total = DEMANDES.filter(d => {
      if (ongletActif === 'a_traiter') return d.statut !== 'traitee';
      if (ongletActif === 'traitees')  return d.statut === 'traitee';
      return true;
    }).length;

    F('dm-compteur').textContent =
      `${liste.length} demande${liste.length > 1 ? 's' : ''} sur ${total}`;

    if (!liste.length) {
      F('dm-liste').innerHTML = Adm.vide(
        'Aucune demande',
        'Aucune demande ne correspond à ces critères.'
      );
      return;
    }

    F('dm-liste').innerHTML = liste.map(d => carteHtml(d)).join('');
  }

  function carteHtml(d) {
    const sujet     = DEMANDE_SUJETS[d.sujet]   || { label: d.sujet };
    const priorite  = DEMANDE_PRIORITES[d.priorite] || {};
    const statut    = DEMANDE_STATUTS[d.statut]  || {};
    const client    = getClient(d.clientId);
    const societe   = client ? client.societe : '—';
    const canal     = DEMANDE_CANAUX[d.canal] || d.canal;
    const msgCourt  = d.message.length > 120
      ? d.message.slice(0, 120) + '…'
      : d.message;

    // Assignation : avatar si quelqu'un, mention sinon.
    const membre = d.assigneA ? getMembre(d.assigneA) : null;
    const assignHtml = membre
      ? `<span class="avatar avatar--sm">${membre.initiales}</span> ${membre.nom}`
      : '<span style="color:var(--c-text-muted)">Non assignée</span>';

    const nbEchanges = d.echanges ? d.echanges.length : 0;
    const echangesHtml = nbEchanges
      ? `<span>${nbEchanges} échange${nbEchanges > 1 ? 's' : ''}</span>`
      : '';

    return `<div class="adm-dem is-${d.statut}" data-dem="${d.id}" role="button" tabindex="0" aria-label="Ouvrir la demande ${d.id}">
      <div class="adm-dem__corps">
        <div class="adm-dem__head">
          <span class="badge badge--neutral">${sujet.label}</span>
          ${priorite.badge ? `<span class="badge ${priorite.badge}">${priorite.label}</span>` : ''}
          ${statut.badge   ? `<span class="badge ${statut.badge}">${statut.label}</span>`     : ''}
          <span class="text-xs text-muted" style="margin-left:auto">${societe} · ${canal} · ${formatDate(d.creeLe)}</span>
        </div>
        <p class="adm-dem__msg">${msgCourt}</p>
        <div class="adm-dem__pied">
          <span style="display:inline-flex;align-items:center;gap:var(--sp-2)">${assignHtml}</span>
          ${echangesHtml}
        </div>
      </div>
    </div>`;
  }

  /* ---------- Panneau de traitement ---------- */
  function ouvrirPanneau(id) {
    const d = getDemande(id);
    if (!d) return;
    panneauId = id;

    const client  = getClient(d.clientId);
    const societe = client ? client.societe : '—';
    const sujet   = DEMANDE_SUJETS[d.sujet] || { label: d.sujet };

    // En-tête : titre + badges d'état côte à côte.
    F('dm-panel-tete').innerHTML = `
      <div>
        <h3 class="modal__title" id="dm-panel-titre">${d.id} — ${sujet.label}</h3>
        <p class="text-sm text-muted" style="margin-top:var(--sp-1)">
          ${client
            ? `<a href="comptes.html#${d.clientId}" class="text-link">${societe}</a>`
            : societe}
          &nbsp;·&nbsp;${Adm.badge(DEMANDE_STATUTS, d.statut)}
        </p>
      </div>`;

    renderCorps(d);
    UI.openPanel('dm-panel');
  }

  function renderCorps(d) {
    // Le fil est affiché en lecture seule pour qui n'a pas la permission
    // « demandes » : voir sans agir vaut mieux que ne rien voir du tout.

    const echangesHtml = d.echanges && d.echanges.length
      ? d.echanges.map(e => `
          <div class="adm-echange">
            <div class="adm-echange__de">${nomMembre(e.de)} · ${formatDate(e.le)}</div>
            <div>${e.texte}</div>
          </div>`).join('')
      : '<p class="text-sm text-muted">Aucun échange pour l\'instant.</p>';

    const membresCible = MEMBRES_OYVIA.filter(m => m.statut === 'actif');
    const optMembres = '<option value="">Non assignée</option>' +
      membresCible.map(m =>
        `<option value="${m.id}" ${d.assigneA === m.id ? 'selected' : ''}>${m.nom}</option>`
      ).join('');

    const optStatuts = Object.keys(DEMANDE_STATUTS).map(k =>
      `<option value="${k}" ${d.statut === k ? 'selected' : ''}>${DEMANDE_STATUTS[k].label}</option>`
    ).join('');

    // Le formulaire de réponse n'est rendu que pour les agents autorisés :
    // montrer des boutons inactifs créerait de la confusion.
    const formReponse = peutAgir ? `
      <p class="eyebrow mb-2 mt-5">Répondre</p>
      <div class="field mb-3">
        <textarea class="textarea" id="dm-texte" rows="4" placeholder="Votre réponse au client…"></textarea>
      </div>
      <div class="adm-actions">
        <button class="btn btn--primary btn--sm" id="dm-btn-repondre">Répondre</button>
        <button class="btn btn--secondary btn--sm" id="dm-btn-clore">Répondre et clore</button>
      </div>` : '';

    const formActions = peutAgir ? `
      <p class="eyebrow mb-2 mt-5">Gestion</p>
      <div class="app-grid app-grid--2" style="gap:var(--sp-3)">
        <div class="field">
          <label class="field__label" for="dm-sel-assignation">Assigné à</label>
          <select class="select" id="dm-sel-assignation">${optMembres}</select>
        </div>
        <div class="field">
          <label class="field__label" for="dm-sel-statut">Statut</label>
          <select class="select" id="dm-sel-statut">${optStatuts}</select>
        </div>
      </div>` : '';

    F('dm-panel-corps').innerHTML = `
      <p class="eyebrow mb-2">Message d'origine</p>
      <div class="adm-echange mb-4">
        <div class="adm-echange__de">${nomClient(d.clientId)} · ${DEMANDE_CANAUX[d.canal] || d.canal} · ${formatDate(d.creeLe)}</div>
        <div>${d.message}</div>
      </div>

      <p class="eyebrow mb-2">Échanges</p>
      <div id="dm-echanges">${echangesHtml}</div>

      ${formActions}
      ${formReponse}
    `;

    F('dm-panel-pied').innerHTML = '';

    if (!peutAgir) return;

    // Assignation : change immédiatement, pas de bouton « Enregistrer »
    // superflu — le changement est atomique et journalisé dans assignerDemande.
    const selAssign = F('dm-sel-assignation');
    if (selAssign) selAssign.addEventListener('change', e => {
      assignerDemande(d.id, e.target.value || null);
      rafraichir();
      // Resynchroniser l'en-tête (statut peut avoir changé via assignerDemande).
      ouvrirPanneau(d.id);
    });

    const selStatut = F('dm-sel-statut');
    if (selStatut) selStatut.addEventListener('change', e => {
      changerStatutDemande(d.id, e.target.value);
      rafraichir();
      ouvrirPanneau(d.id);
    });

    const btnRepondre = F('dm-btn-repondre');
    const btnClore   = F('dm-btn-clore');

    function envoyerReponse(cloturer) {
      const ta = F('dm-texte');
      if (!ta) return;
      const texte = ta.value.trim();
      if (!texte) { UI.toast('Le message ne peut pas être vide', false); return; }
      repondreDemande(d.id, texte, cloturer);
      ta.value = '';
      rafraichir();
      ouvrirPanneau(d.id);
      UI.toast(cloturer ? 'Demande clôturée' : 'Réponse envoyée');
    }

    if (btnRepondre) btnRepondre.addEventListener('click', () => envoyerReponse(false));
    if (btnClore)   btnClore.addEventListener('click',    () => envoyerReponse(true));
  }

  /* ---------- Onglets ---------- */
  F('dm-tabs').addEventListener('click', e => {
    const btn = e.target.closest('[data-onglet]');
    if (!btn) return;
    ongletActif = btn.dataset.onglet;
    F('dm-tabs').querySelectorAll('button').forEach(b => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    renderListe();
  });

  /* ---------- Filtres ---------- */
  F('dm-q').addEventListener('input', e => {
    filtres.q = e.target.value;
    renderListe();
  });
  F('dm-sujet').addEventListener('change', e => {
    filtres.sujet = e.target.value;
    renderListe();
  });
  F('dm-assignation').addEventListener('change', e => {
    filtres.assignation = e.target.value;
    renderListe();
  });

  /* ---------- Délégation sur la liste ----------
     Les cartes sont redessinées à chaque filtre : des écouteurs individuels
     ne survivraient pas au premier rendu. */
  F('dm-liste').addEventListener('click', e => {
    const carte = e.target.closest('[data-dem]');
    if (carte) ouvrirPanneau(carte.dataset.dem);
  });
  // Accessibilité clavier : Entrée et Espace ouvrent la carte.
  F('dm-liste').addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const carte = e.target.closest('[data-dem]');
    if (carte) { e.preventDefault(); ouvrirPanneau(carte.dataset.dem); }
  });

  /* ---------- Rafraîchissement global ---------- */
  function rafraichir() {
    renderKpis();
    renderListe();
    AdminLayout.refreshBadges();
  }

  rafraichir();

  /* ---------- Ouverture directe par ancre ----------
     Un lien depuis comptes.html (demandes.html#DM-1056) ouvre
     directement le panneau sans passer par la liste. */
  if (location.hash.length > 1) {
    const d = getDemande(location.hash.slice(1));
    if (d) {
      // S'assurer que l'onglet « Toutes » est actif pour que la demande
      // traitée soit bien visible dans la liste en arrière-plan.
      if (d.statut === 'traitee') {
        ongletActif = 'toutes';
        F('dm-tabs').querySelectorAll('button').forEach(b => {
          b.classList.toggle('is-active', b.dataset.onglet === 'toutes');
        });
        renderListe();
      }
      ouvrirPanneau(d.id);
    }
  }

})();
}
