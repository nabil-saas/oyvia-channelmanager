/* ============================================================
   OYVIA interne — Vue d'ensemble

   Trois questions, dans cet ordre : combien rentre-t-il, d'où, et
   qu'est-ce qui attend quelqu'un aujourd'hui ? Le reste (détail des
   comptes, des factures, des incidents) vit dans les pages dédiées ;
   cet écran ne sert qu'à décider où aller.
   ============================================================ */
if (AdminLayout.init('vue')) { /* accès refusé : la page a été remplacée */ } else {
(function () {

  const F = id => document.getElementById(id);
  const ic = Adm.ic;

  // Couleurs de répartition : reprises des paliers d'offre, du moins
  // engageant au plus engageant. Le lecteur retrouve le même ordre que
  // sur la page publique des tarifs.
  const COULEURS_PLAN = {
    gratuit:    '#cbd5e1',
    decouverte: '#93c5fd',
    smart:      '#3b82f6',
    business:   '#1d4ed8',
    entreprise: '#312e81',
  };

  F('av-date').textContent = formatDate(AUJOURDHUI, { moisLong: true, annee: true });

  /* ---------- Indicateurs ---------- */
  function renderKpis() {
    const croissance = croissanceMrr();
    const essais = clientsParStatut('essai');
    const impaye = montantImpaye();
    const nbImpayees = facturesImpayees().length;

    F('av-kpis').innerHTML = [
      Adm.kpi({
        label: 'MRR', valeur: formatPrixAbo(mrrTotal()),
        pied: `${croissance >= 0 ? '+' : ''}${croissance.toFixed(1)} % vs mois précédent`,
        icone: '<path d="M3 16.5 8 10l4 3.5L21 4"/><path d="M16 4h5v5"/>',
        ton: croissance >= 0 ? 'positive' : 'danger',
      }),
      Adm.kpi({
        label: 'ARR', valeur: formatPrixAbo(arrTotal()),
        pied: `${formatPrixAbo(arpa())} par compte payant`,
        icone: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
      }),
      Adm.kpi({
        label: 'Comptes actifs', valeur: clientsParStatut('actif').length,
        pied: `${essais.length} essai${essais.length > 1 ? 's' : ''} en cours · ${logementsSousGestion()} logements gérés`,
        icone: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>',
      }),
      Adm.kpi({
        label: 'Impayés', valeur: formatPrixAbo(impaye),
        pied: nbImpayees ? `${nbImpayees} facture${nbImpayees > 1 ? 's' : ''} en retard` : 'Rien en retard',
        icone: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
        ton: impaye ? 'danger' : 'positive',
      }),
    ].join('');
  }

  /* ---------- Histogramme du MRR ----------
     L'échelle démarre à zéro. Tronquer l'axe pour « mieux voir la
     tendance » transforme une croissance de 6 % en mur, et c'est
     exactement le genre de graphique qu'on finit par croire. */
  function renderChart() {
    const serie = MRR_HISTORIQUE;
    const max = Math.max(...serie.map(p => p.mrr), 1);
    F('av-chart').innerHTML = `
      <div class="adm-chart">
        ${serie.map((p, i) => `
          <div class="adm-chart__col ${i === serie.length - 1 ? 'is-courant' : ''}" title="${libelleMois(p.mois)} · ${formatPrixAbo(p.mrr)} · ${p.comptes} comptes">
            <div class="adm-chart__bar" style="height:${Math.max(2, (p.mrr / max) * 100)}%">
              <span class="adm-chart__val">${formatPrixAbo(p.mrr)}</span>
            </div>
            <span class="adm-chart__mois">${libelleMois(p.mois)}</span>
          </div>`).join('')}
      </div>`;
  }

  /* ---------- Répartition par offre ---------- */
  function renderMix() {
    const parts = repartitionParPlan().filter(r => r.mrr > 0).sort((a, b) => b.mrr - a.mrr);
    const total = parts.reduce((s, p) => s + p.mrr, 0) || 1;

    F('av-mix').innerHTML = `
      <div class="adm-mix">
        ${parts.map(p => `<div class="adm-mix__part" style="width:${(p.mrr / total) * 100}%;background:${COULEURS_PLAN[p.plan.id] || '#94a3b8'}"
             title="${p.plan.nom} · ${formatPrixAbo(p.mrr)}"></div>`).join('')}
      </div>
      <div class="adm-legende">
        ${parts.map(p => `
          <div class="adm-legende__item">
            <i class="adm-legende__pt" style="background:${COULEURS_PLAN[p.plan.id] || '#94a3b8'}"></i>
            <div>
              <b>${Math.round((p.mrr / total) * 100)} %</b>
              <span> · ${p.plan.nom} (${p.comptes})</span>
            </div>
          </div>`).join('')}
      </div>
      <p class="text-xs text-muted mt-4">
        ${parts.length ? `${parts[0].plan.nom} pèse ${Math.round((parts[0].mrr / total) * 100)} % du revenu pour ${parts[0].comptes} compte${parts[0].comptes > 1 ? 's' : ''}.` : ''}
      </p>`;
  }

  /* ---------- File du jour ----------
     Une seule liste, triée par ce qui coûte le plus cher à laisser
     traîner : un impayé, puis une demande sans réponse, puis un essai
     qui expire, puis un incident déjà pris en charge. */
  function renderTodo() {
    const lignes = [];

    const impayees = facturesImpayees();
    if (impayees.length) lignes.push({
      href: 'revenus.html',
      ton: 'danger',
      icone: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
      titre: `${impayees.length} facture${impayees.length > 1 ? 's' : ''} impayée${impayees.length > 1 ? 's' : ''}`,
      detail: `${formatPrixAbo(montantImpaye())} · retard le plus ancien : ${Math.max(...impayees.map(factureEnRetardDe))} jours`,
    });

    const nouvelles = DEMANDES.filter(d => d.statut === 'nouvelle');
    if (nouvelles.length) lignes.push({
      href: 'demandes.html',
      ton: 'warning',
      icone: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
      titre: `${nouvelles.length} demande${nouvelles.length > 1 ? 's' : ''} sans réponse`,
      detail: nouvelles.map(d => nomClient(d.clientId)).slice(0, 3).join(', '),
    });

    // Un essai qui expire dans moins de 7 jours est une vente à conclure,
    // pas une échéance administrative : il a sa place ici.
    const bientot = clientsParStatut('essai')
      .filter(c => c.essaiFinLe && nuitsEntre(AUJOURDHUI, c.essaiFinLe) <= 7)
      .sort((a, b) => a.essaiFinLe.localeCompare(b.essaiFinLe));
    if (bientot.length) lignes.push({
      href: 'comptes.html?statut=essai',
      ton: 'accent',
      icone: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
      titre: `${bientot.length} essai${bientot.length > 1 ? 's' : ''} se termine${bientot.length > 1 ? 'nt' : ''} sous 7 jours`,
      detail: bientot.map(c => `${c.societe} (${nuitsEntre(AUJOURDHUI, c.essaiFinLe)} j)`).join(', '),
    });

    const inc = incidentsOuverts();
    if (inc.length) lignes.push({
      href: 'plateforme.html',
      ton: 'warning',
      icone: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
      titre: `${inc.length} incident${inc.length > 1 ? 's' : ''} en cours`,
      detail: inc.map(i => `${i.id} · ${i.titre}`).join(' — '),
    });

    /* Le chevron de droite passe par une classe dédiée : posé nu dans le
       lien, un SVG sans dimension s'étire à la hauteur de la ligne et
       s'affiche en noir plein — une flèche de 60 px au milieu de la
       liste. La taille des icônes est donc décidée en CSS, jamais
       laissée au navigateur. */
    F('av-todo').innerHTML = lignes.length ? lignes.map(l => `
      <a class="adm-ligne adm-clic adm-todo" href="${l.href}">
        <span class="adm-todo__ic adm-todo__ic--${l.ton}">${ic(l.icone)}</span>
        <div class="adm-ligne__meta grow">
          <b>${l.titre}</b>
          <small>${l.detail}</small>
        </div>
        <span class="adm-todo__chev">${ic('<path d="m9 18 6-6-6-6"/>')}</span>
      </a>`).join('')
      : Adm.vide('Rien en attente', "Aucun impayé, aucune demande ouverte, aucun incident. Profitez-en.");
  }

  /* ---------- Journal ---------- */
  function renderJournal() {
    const derniers = JOURNAL_ADMIN.slice(0, 6);
    F('av-journal').innerHTML = derniers.length ? `
      <div class="adm-fil">
        ${derniers.map((j, i) => `
          <div class="adm-fil__pt ${i === 0 ? 'is-fort' : ''}">
            <p class="adm-fil__date">${formatHorodatage(j.le)} · ${nomMembre(j.auteurId)}</p>
            <p class="adm-fil__txt"><b>${j.action}</b> — ${j.cible}</p>
            ${j.detail ? `<p class="text-xs text-muted">${j.detail}</p>` : ''}
          </div>`).join('')}
      </div>` : Adm.vide('Journal vide', "Les actions du back-office s'inscriront ici.");
  }

  renderKpis();
  renderChart();
  renderMix();
  renderTodo();
  renderJournal();
})();
}
