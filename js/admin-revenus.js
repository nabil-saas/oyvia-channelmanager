/* ============================================================
   OYVIA interne — Revenus & facturation

   Ce fichier gère la seule page financière du back-office :
   encaissements, relances et annulations de factures SaaS.

   Deux points de vigilance qui expliquent les choix du code :

   — On ne lit jamais f.statut directement dans l'affichage :
     une facture « en attente » dont l'échéance est passée est
     une impayée. statutFactureReel() centralise cette logique ;
     la contourner dans la vue divergerait silencieusement.

   — Les actions (marquerFacturePayee, relancerFacture,
     annulerFacture) écrivent déjà dans le journal. Un second
     appel à journaliser() ici doublerait chaque entrée.
   ============================================================ */
if (AdminLayout.init('revenus')) { /* accès refusé */ } else {
(function () {

  const F = id => document.getElementById(id);
  const ic = Adm.ic;
  const peutAgir = peutAdmin('revenus_agir');

  // Facture en cours de traitement dans la modale d'encaissement.
  let encaisserId = null;

  /* ------------------------------------------------------------------ */
  /* Filtres                                                              */
  /* ------------------------------------------------------------------ */

  const filtres = { q: '', statut: 'tous', periode: 'toutes' };

  // Périodes distinctes issues des factures réelles, triées du plus récent.
  const periodes = [...new Set(FACTURES_SAAS.map(f => f.periode))]
    .sort((a, b) => b.localeCompare(a));

  F('rv-statut').innerHTML = '<option value="tous">Tous les statuts</option>' +
    Object.keys(FACTURE_SAAS_STATUTS)
      .map(k => `<option value="${k}">${FACTURE_SAAS_STATUTS[k].label}</option>`)
      .join('');

  // On filtre sur le statut « réel » (statutFactureReel), pas sur le statut
  // brut, pour que le select « Impayée » remonte aussi les factures en attente
  // échues que le client verrait du même mauvais œil.
  F('rv-periode').innerHTML = '<option value="toutes">Toutes les périodes</option>' +
    periodes.map(p => `<option value="${p}">${libelleMois(p)}</option>`).join('');

  function listeFiltree() {
    const q = filtres.q.trim().toLowerCase();
    return FACTURES_SAAS.filter(f => {
      if (filtres.statut !== 'tous' && statutFactureReel(f) !== filtres.statut) return false;
      if (filtres.periode !== 'toutes' && f.periode !== filtres.periode) return false;
      if (!q) return true;
      return (f.id + ' ' + nomClient(f.clientId)).toLowerCase().includes(q);
    }).sort((a, b) => b.emiseLe.localeCompare(a.emiseLe));
  }

  /* ------------------------------------------------------------------ */
  /* KPI                                                                  */
  /* ------------------------------------------------------------------ */

  function renderKpis() {
    const moisCourant = moisDe(AUJOURDHUI);
    const encMois = encaissementsDuMois(moisCourant);
    const mrr = mrrTotal();
    const impaye = montantImpaye();
    const nbImpayees = facturesImpayees().length;

    // « À encaisser ce mois » : factures du mois courant ni payées ni annulées.
    const aEncaisser = FACTURES_SAAS
      .filter(f => f.periode === moisCourant && statutFactureReel(f) !== 'payee' && f.statut !== 'annulee')
      .reduce((s, f) => s + f.montant, 0);

    F('rv-kpis').innerHTML = [
      Adm.kpi({
        label: 'Encaissé ce mois',
        valeur: formatPrixAbo(encMois),
        pied: libelleMois(moisCourant),
        icone: '<path d="M12 2v20"/><path d="M17 7H9.5a3 3 0 0 0 0 6h5a3 3 0 0 1 0 6H6"/>',
        ton: 'positive',
      }),
      Adm.kpi({
        label: 'MRR',
        valeur: formatPrixAbo(mrr),
        pied: `${clientsPayants().length} compte${clientsPayants().length > 1 ? 's' : ''} payant${clientsPayants().length > 1 ? 's' : ''}`,
        icone: '<path d="M3 16.5 8 10l4 3.5L21 4"/><path d="M16 4h5v5"/>',
      }),
      Adm.kpi({
        label: 'Impayés',
        valeur: formatPrixAbo(impaye),
        pied: nbImpayees
          ? `${nbImpayees} facture${nbImpayees > 1 ? 's' : ''} en retard`
          : 'Aucun retard',
        icone: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
        ton: nbImpayees > 0 ? 'danger' : '',
      }),
      Adm.kpi({
        label: 'À encaisser ce mois',
        valeur: formatPrixAbo(aEncaisser),
        pied: `Factures ${libelleMois(moisCourant)} non réglées`,
        icone: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
        ton: aEncaisser > 0 ? 'warning' : '',
      }),
    ].join('');
  }

  /* ------------------------------------------------------------------ */
  /* Histogramme — 6 derniers mois présents dans FACTURES_SAAS           */
  /* ------------------------------------------------------------------ */

  function renderChart() {
    // On somme les encaissements par période plutôt que d'utiliser
    // MRR_HISTORIQUE, car ce graphique représente CE QUI A ÉTÉ ENCAISSÉ,
    // pas le MRR théorique — un impayé ne devrait pas y apparaître.
    const parMois = {};
    FACTURES_SAAS.forEach(f => {
      if (f.statut !== 'payee') return;
      parMois[f.periode] = (parMois[f.periode] || 0) + f.montant;
    });

    const moisTries = Object.keys(parMois).sort().slice(-6);
    const moisCourant = moisDe(AUJOURDHUI);
    const max = Math.max(...moisTries.map(m => parMois[m]), 1);

    F('rv-chart').innerHTML = `
      <div class="adm-chart">
        ${moisTries.map(m => `
          <div class="adm-chart__col ${m === moisCourant ? 'is-courant' : ''}"
               title="${libelleMois(m)} · ${formatPrixAbo(parMois[m])}">
            <div class="adm-chart__bar" style="height:${Math.max(2, (parMois[m] / max) * 100)}%">
              <span class="adm-chart__val">${formatPrixAbo(parMois[m])}</span>
            </div>
            <span class="adm-chart__mois">${libelleMois(m)}</span>
          </div>`).join('')}
      </div>`;
  }

  /* ------------------------------------------------------------------ */
  /* Bloc « Relances à faire »                                            */
  /* ------------------------------------------------------------------ */

  function renderRelances() {
    // On trie par ancienneté de retard décroissante : la facture la plus
    // urgente apparaît en premier, sans que l'agent ait à chercher.
    const aRelancer = facturesImpayees()
      .filter(f => f.statut !== 'annulee')
      .sort((a, b) => factureEnRetardDe(b) - factureEnRetardDe(a));

    const contenu = aRelancer.length
      ? `<p class="eyebrow mb-4">Relances à faire</p>` +
        aRelancer.map(f => {
          const retard = factureEnRetardDe(f);
          const retardTexte = retard > 0 ? `en retard de ${retard} j` : 'échéance aujourd\'hui';
          return `<div class="adm-ligne">
            <div class="adm-ligne__meta grow">
              <b>${f.id} · ${nomClient(f.clientId)}</b>
              <small>${libelleMois(f.periode)} · ${retardTexte} · relance${f.relances > 0 ? ` n° ${f.relances + 1}` : ' initiale'}</small>
            </div>
            <span class="adm-ligne__val">${formatPrixAbo(f.montant)}</span>
            ${Adm.badge(FACTURE_SAAS_STATUTS, statutFactureReel(f))}
            ${peutAgir
              ? `<button class="btn btn--secondary btn--sm" data-relancer="${f.id}">Relancer</button>`
              : ''}
          </div>`;
        }).join('')
      : Adm.vide('Aucune relance à faire', 'Toutes les factures en retard ont déjà été relancées ou sont à jour.');

    F('rv-relances-bloc').innerHTML = contenu;

    // Branchement des boutons de relance directe du bloc récapitulatif.
    F('rv-relances-bloc').querySelectorAll('[data-relancer]').forEach(btn => {
      btn.addEventListener('click', () => agirRelancer(btn.dataset.relancer));
    });
  }

  /* ------------------------------------------------------------------ */
  /* Tableau des factures                                                 */
  /* ------------------------------------------------------------------ */

  function renderTable() {
    const liste = listeFiltree();
    F('rv-compteur').textContent =
      `${liste.length} facture${liste.length > 1 ? 's' : ''} sur ${FACTURES_SAAS.length}`;

    F('rv-tbody').innerHTML = liste.length ? liste.map(f => {
      const statut = statutFactureReel(f);
      const retard = factureEnRetardDe(f);
      const echeanceTexte = retard > 0
        ? `<div class="text-xs" style="color:var(--c-danger-ink)">en retard de ${retard} j</div>`
        : '';

      // Les boutons d'action ne s'affichent que si le membre a la permission.
      // On ne grise pas : un bouton inaccessible invite à réclamer l'accès,
      // et la finance n'a pas à expliquer ses droits à chaque visiteur.
      const actions = [];
      if (peutAgir) {
        if (statut !== 'payee' && statut !== 'annulee') {
          actions.push(`<button class="btn btn--primary btn--sm" data-enc="${f.id}">Encaisser</button>`);
          actions.push(`<button class="btn btn--secondary btn--sm" data-rel="${f.id}">Relancer</button>`);
        }
        if (statut !== 'payee' && f.statut !== 'annulee') {
          actions.push(`<button class="btn btn--ghost btn--sm" data-ann="${f.id}">Annuler</button>`);
        }
      }

      return `<tr class="adm-clic">
        <td>
          <b>${f.id}</b>
          <div class="text-xs text-muted">${nomClient(f.clientId)}</div>
        </td>
        <td>${libelleMois(f.periode)}</td>
        <td class="text-xs text-muted">${formatDate(f.emiseLe)}</td>
        <td>
          ${formatDate(f.echeanceLe)}
          ${echeanceTexte}
        </td>
        <td class="num money">${formatPrixAbo(f.montant)}</td>
        <td class="text-xs text-muted">${MOYENS_PAIEMENT[f.moyen] || '—'}</td>
        <td>${Adm.badge(FACTURE_SAAS_STATUTS, statut)}</td>
        <td style="text-align:right">
          <div class="adm-actions" style="justify-content:flex-end">
            ${actions.join('')}
          </div>
        </td>
      </tr>`;
    }).join('')
    : `<tr><td colspan="8">${Adm.vide('Aucune facture', 'Aucune facture ne correspond à ces filtres.')}</td></tr>`;
  }

  /* ------------------------------------------------------------------ */
  /* Actions                                                              */
  /* ------------------------------------------------------------------ */

  function agirEncaisser(id) {
    const f = getFactureSaas(id);
    if (!f) return;
    encaisserId = id;
    F('rv-enc-desc').textContent =
      `${f.id} · ${nomClient(f.clientId)} · ${formatPrixAbo(f.montant)}`;
    F('rv-enc-moyen').value = f.moyen || 'cb';
    UI.openPanel('rv-modal-encaisser');
  }

  F('rv-enc-valider').addEventListener('click', () => {
    if (!encaisserId) return;
    const moyen = F('rv-enc-moyen').value;
    marquerFacturePayee(encaisserId, moyen);
    UI.closeAll();
    UI.toast(`Paiement enregistré — ${MOYENS_PAIEMENT[moyen] || moyen}`);
    encaisserId = null;
    rafraichir();
  });

  function agirRelancer(id) {
    const f = getFactureSaas(id);
    if (!f) return;
    relancerFacture(id);
    // Le numéro de relance vient d'être incrémenté par relancerFacture :
    // on le lit sur l'objet mis à jour, pas sur la valeur capturée avant.
    UI.toast(`Relance n° ${getFactureSaas(id).relances} envoyée — ${f.id}`);
    rafraichir();
  }

  function agirAnnuler(id) {
    const f = getFactureSaas(id);
    if (!f) return;
    UI.confirm({
      title: 'Annuler cette facture ?',
      message: `${f.id} · ${nomClient(f.clientId)} · ${formatPrixAbo(f.montant)} sera marquée annulée. Cette action est irréversible.`,
      confirmText: 'Annuler la facture',
      danger: true,
      onConfirm: () => {
        annulerFacture(id);
        UI.toast(`Facture ${f.id} annulée`);
        rafraichir();
      },
    });
  }

  /* ------------------------------------------------------------------ */
  /* Export CSV                                                           */
  /* ------------------------------------------------------------------ */

  F('rv-export').addEventListener('click', () => {
    const liste = listeFiltree();
    UI.exportCSV('oyvia-factures.csv',
      ['Facture', 'Client', 'Période', 'Émise le', 'Échéance', 'Montant', 'Moyen', 'Statut', 'Payée le'],
      liste.map(f => [
        f.id,
        nomClient(f.clientId),
        libelleMois(f.periode),
        f.emiseLe,
        f.echeanceLe,
        Math.round(convertirMAD(f.montant, deviseAffichee())),
        MOYENS_PAIEMENT[f.moyen] || f.moyen,
        FACTURE_SAAS_STATUTS[statutFactureReel(f)].label,
        f.payeeLe || '',
      ]));
    UI.toast(`${liste.length} facture${liste.length > 1 ? 's' : ''} exportée${liste.length > 1 ? 's' : ''}`);
  });

  /* ------------------------------------------------------------------ */
  /* Câblage des filtres et délégation du tableau                        */
  /* ------------------------------------------------------------------ */

  F('rv-q').addEventListener('input', e => { filtres.q = e.target.value; renderTable(); });
  F('rv-statut').addEventListener('change', e => { filtres.statut = e.target.value; renderTable(); });
  F('rv-periode').addEventListener('change', e => { filtres.periode = e.target.value; renderTable(); });

  // Délégation sur le tableau : les boutons sont recréés à chaque rendu,
  // poser un écouteur par cellule ne survivrait pas au premier filtre.
  F('rv-tbody').addEventListener('click', e => {
    const enc = e.target.closest('[data-enc]');
    const rel = e.target.closest('[data-rel]');
    const ann = e.target.closest('[data-ann]');
    if (enc) agirEncaisser(enc.dataset.enc);
    else if (rel) agirRelancer(rel.dataset.rel);
    else if (ann) agirAnnuler(ann.dataset.ann);
  });

  /* ------------------------------------------------------------------ */
  /* Rafraîchissement global                                              */
  /* ------------------------------------------------------------------ */

  function rafraichir() {
    renderKpis();
    renderChart();
    renderRelances();
    renderTable();
    AdminLayout.refreshBadges();
  }

  rafraichir();

})();
}
