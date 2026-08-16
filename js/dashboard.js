/* ============================================================
   OYVIA — Tableau de bord
   KPIs, activité du jour, graphique d'occupation, prochaines résas.

   Tout est recalculé à chaque changement du filtre par logement
   (#app-logement dans l'en-tête de page, câblé par layout.js) :
   « Tous les logements » donne la vue du parc, sinon on se restreint
   au bien sélectionné.
   ============================================================ */
Layout.init('dashboard');

(function () {
  const JOURS_LONG = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const css = getComputedStyle(document.documentElement);
  const tok = n => css.getPropertyValue(n).trim();
  const PAY_BADGE = { paye: 'badge--positive', acompte: 'badge--warning', impaye: 'badge--danger', rembourse: 'badge--neutral' };
  const icon = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;

  // En-tête (indépendant du filtre)
  const d = parseDate(AUJOURDHUI);
  document.getElementById('dash-hello').textContent = `Bonjour ${UTILISATEUR.nom.split(' ')[0]} 👋`;
  document.getElementById('dash-date').textContent =
    `${JOURS_LONG[d.getDay()]} ${d.getDate()} ${MOIS_LONG[d.getMonth()]} ${d.getFullYear()} — voici l'activité de vos logements.`;

  /* ---------- Portée courante ---------- */
  const scope = () => Layout.currentLogement;
  const tousLogements = () => scope() === 'all';
  const inScope = r => tousLogements() || r.logementId === scope();
  const last = STATS.occupation.length - 1;
  const firstNames = list => list.map(r => r.voyageur.split(' ')[0]).join(', ') || '—';

  // Occupation & CA du mois : le parc a un historique (STATS), un logement
  // seul n'a que la valeur du mois en cours (STATS.parLogement).
  function chiffresDuMois() {
    if (tousLogements()) {
      const occ = STATS.occupation[last], ca = STATS.ca[last];
      return {
        occ, ca,
        occFoot: `<span class="trend trend--up">▲ ${occ - STATS.occupation[last - 1]} pts</span> ce mois-ci`,
        caFoot: `<span class="trend trend--up">▲ ${Math.round((ca - STATS.ca[last - 1]) / STATS.ca[last - 1] * 100)} %</span> vs. mois dernier`,
      };
    }
    const pl = STATS.parLogement.find(p => p.id === scope()) || { occ: 0, ca: 0 };
    const moyenneParc = STATS.occupation[last];
    const ecart = pl.occ - moyenneParc;
    const partCA = Math.round(pl.ca / STATS.ca[last] * 100);
    return {
      occ: pl.occ, ca: pl.ca,
      occFoot: `<span class="trend trend--${ecart >= 0 ? 'up' : 'down'}">${ecart >= 0 ? '▲' : '▼'} ${Math.abs(ecart)} pts</span> vs. moyenne du parc`,
      caFoot: `${partCA} % du CA du parc ce mois-ci`,
    };
  }

  /* ---------- KPIs ---------- */
  function renderKpis() {
    const arrivals = RESERVATIONS.filter(r => r.arrivee === AUJOURDHUI && r.canal !== 'bloque' && inScope(r));
    const departures = RESERVATIONS.filter(r => r.depart === AUJOURDHUI && r.canal !== 'bloque' && inScope(r));
    const m = chiffresDuMois();

    // Les conversations sont rattachées à une réservation, donc à un logement.
    const convScope = CONVERSATIONS.filter(c => {
      if (tousLogements()) return true;
      const r = getReservation(c.reservationId);
      return r && r.logementId === scope();
    });
    const unread = tousLogements()
      ? Layout.unreadCount()
      : convScope.reduce((s, c) => s + (c.nonLu || 0), 0);

    const taches = TACHES.filter(t => tousLogements() || t.logementId === scope());
    const menagePending = taches.filter(t => t.type === 'menage' && t.statut !== 'termine').length;
    const menageToday = taches.filter(t => t.date === AUJOURDHUI).length;

    const KPIS = [
      { label: 'Arrivées aujourd\'hui', value: arrivals.length, foot: firstNames(arrivals), ic: icon('<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="M10 17l5-5-5-5M15 12H3"/>') },
      { label: 'Départs aujourd\'hui', value: departures.length, foot: firstNames(departures), ic: icon('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>') },
      { label: 'Taux d\'occupation', value: m.occ + ' %', foot: m.occFoot, ic: icon('<path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/>') },
      { label: 'CA du mois', value: formatMontant(m.ca), foot: m.caFoot, ic: icon('<path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>') },
      { label: 'Messages non lus', value: unread, foot: `${convScope.filter(c => c.nonLu > 0).length} conversations à traiter`, ic: icon('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>') },
      { label: 'Ménages à venir', value: menagePending, foot: `dont ${menageToday} prévus aujourd'hui`, ic: icon('<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>') },
    ];
    document.getElementById('dash-kpi').innerHTML = KPIS.map(k => `
      <div class="kpi">
        <span class="kpi__label">${k.label}</span>
        <span class="kpi__value">${k.value}</span>
        <span class="kpi__foot">${k.foot}</span>
        <span class="kpi__icon">${k.ic}</span>
      </div>`).join('');
  }

  /* ---------- Activité du jour ---------- */
  function todayItem(r, dir) {
    const l = getLogement(r.logementId);
    const arrow = dir === 'in'
      ? '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="M10 17l5-5-5-5M15 12H3"/>'
      : '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>';
    return `<div class="app-list__item">
      <span class="dash-arrow dash-arrow--${dir === 'in' ? 'in' : 'out'}">${icon(arrow)}</span>
      <div class="grow"><b>${r.voyageur}</b><small>${l.nom} · ${l.ville}</small></div>
      <span class="badge-canal badge-canal--${r.canal}"><span class="dot"></span>${CANAL_LABEL[r.canal]}</span>
    </div>`;
  }
  function renderToday() {
    const arrivals = RESERVATIONS.filter(r => r.arrivee === AUJOURDHUI && r.canal !== 'bloque' && inScope(r));
    const departures = RESERVATIONS.filter(r => r.depart === AUJOURDHUI && r.canal !== 'bloque' && inScope(r));
    document.getElementById('dash-today').innerHTML = `
      <div class="dash-today__group">
        <p class="eyebrow mb-2">Arrivées · ${arrivals.length}</p>
        <div class="app-list">${arrivals.length ? arrivals.map(r => todayItem(r, 'in')).join('') : '<p class="text-muted text-sm">Aucune arrivée aujourd\'hui.</p>'}</div>
      </div>
      <div class="dash-today__group">
        <p class="eyebrow mb-2">Départs · ${departures.length}</p>
        <div class="app-list">${departures.length ? departures.map(r => todayItem(r, 'out')).join('') : '<p class="text-muted text-sm">Aucun départ aujourd\'hui.</p>'}</div>
      </div>`;
  }

  /* ---------- Prochaines réservations ---------- */
  function renderNext() {
    const next = RESERVATIONS
      .filter(r => r.canal !== 'bloque' && inScope(r) && parseDate(r.arrivee) >= parseDate(AUJOURDHUI))
      .sort((a, b) => parseDate(a.arrivee) - parseDate(b.arrivee))
      .slice(0, 7);
    const tbody = document.getElementById('dash-next');
    if (!next.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-muted text-sm" style="padding:var(--sp-6);text-align:center">Aucune réservation à venir sur ce logement.</td></tr>`;
      return;
    }
    tbody.innerHTML = next.map(r => {
      const l = getLogement(r.logementId);
      return `<tr class="is-clickable" onclick="window.location.href='reservations.html'">
        <td class="fw-semibold">${r.voyageur}</td>
        <td class="text-soft">${l.nom}</td>
        <td><span class="badge-canal badge-canal--${r.canal}"><span class="dot"></span>${CANAL_LABEL[r.canal]}</span></td>
        <td class="text-soft">${formatDate(r.arrivee, { jourSemaine: true })}</td>
        <td class="num">${r.nuits}</td>
        <td class="num money">${formatMontant(r.montant)}</td>
        <td><span class="badge ${PAY_BADGE[r.paiement]}">${PAIEMENT_LABEL[r.paiement]}</span></td>
      </tr>`;
    }).join('');
  }

  /* ---------- Graphique d'occupation ---------- */
  // STATS ne contient un historique 6 mois que pour l'ensemble du parc. Pour un
  // logement seul, on garde la forme de la courbe du parc et on la recale sur
  // l'occupation connue du bien (STATS.parLogement) : c'est une interpolation
  // de démo, assumée — le libellé de la carte précise le périmètre affiché.
  function serieOccupation() {
    if (tousLogements()) return STATS.occupation;
    const pl = STATS.parLogement.find(p => p.id === scope());
    if (!pl) return STATS.occupation;
    const facteur = pl.occ / STATS.occupation[last];
    return STATS.occupation.map(v => Math.min(100, Math.round(v * facteur)));
  }

  const ctx = document.getElementById('dash-occ').getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 260);
  grad.addColorStop(0, 'rgba(81,112,255,0.22)');
  grad.addColorStop(1, 'rgba(81,112,255,0)');
  const chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: STATS.moisLabels,
      datasets: [{
        data: serieOccupation(), borderColor: tok('--blue-600'), backgroundColor: grad, fill: true,
        tension: 0.4, borderWidth: 3, pointRadius: 4, pointHoverRadius: 6,
        pointBackgroundColor: tok('--blue-600'), pointBorderColor: '#fff', pointBorderWidth: 2,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ' ' + c.parsed.y + ' % d\'occupation' } } },
      scales: {
        y: { min: 0, max: 100, ticks: { callback: v => v + ' %', color: tok('--ink-500'), font: { family: 'Geist' } }, grid: { color: tok('--ink-100') }, border: { display: false } },
        x: { ticks: { color: tok('--ink-500'), font: { family: 'Geist' } }, grid: { display: false }, border: { display: false } },
      },
    },
  });

  function renderChart() {
    chart.data.datasets[0].data = serieOccupation();
    chart.update();
    const badge = document.getElementById('dash-occ-scope');
    if (badge) {
      const l = tousLogements() ? null : getLogement(scope());
      badge.textContent = l ? `${l.nom} · 6 derniers mois` : '6 derniers mois';
    }
  }

  function renderAll() { renderKpis(); renderToday(); renderNext(); renderChart(); }

  document.addEventListener('logementChange', renderAll);
  renderAll();
})();
