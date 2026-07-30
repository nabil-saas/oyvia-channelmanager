/* ============================================================
   OYVIA — Espace propriétaire : performance des biens
   Chaque propriétaire ne voit QUE ses biens (CA, occupation,
   commission conciergerie, net, réservations à venir) + relevé.
   ============================================================ */
(function () {
  const css = getComputedStyle(document.documentElement);
  const tok = n => css.getPropertyValue(n).trim();
  const BLUE = tok('--blue-600'), GRID = tok('--ink-100'), MUTED = tok('--ink-500');
  Chart.defaults.font.family = 'Geist';
  Chart.defaults.color = MUTED;

  const params = new URLSearchParams(location.search);
  const sel = document.getElementById('op-who');
  sel.innerHTML = PROPRIETAIRES.map(o => `<option value="${o.id}">${o.societe} · ${o.contact}</option>`).join('');
  if (params.get('o') && getProprietaire(params.get('o'))) sel.value = params.get('o');

  let currentId = null;
  let chartRev = null, chartOcc = null;

  const caBien = l => (STATS.parLogement.find(x => x.id === l.id) || { ca: 0 }).ca;
  const occBien = l => (STATS.parLogement.find(x => x.id === l.id) || { occ: 0 }).occ;
  const icon = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;

  function render() {
    const o = getProprietaire(currentId);
    const biens = getLogementsByProprietaire(currentId);
    const ownerCA = biens.reduce((s, l) => s + caBien(l), 0);
    const commission = Math.round(ownerCA * o.commission);
    const net = ownerCA - commission;
    const avgOcc = Math.round(biens.reduce((s, l) => s + occBien(l), 0) / biens.length);
    const upcoming = RESERVATIONS
      .filter(r => r.canal !== 'bloque' && biens.some(l => l.id === r.logementId) && parseDate(r.arrivee) >= parseDate(AUJOURDHUI))
      .sort((a, b) => parseDate(a.arrivee) - parseDate(b.arrivee));

    document.getElementById('op-user').innerHTML =
      `<div class="op-user__meta"><b>${o.societe}</b><small>${biens.length} biens · ${o.contact}</small></div><span class="avatar">${o.societe.split(' ').map(m => m[0]).slice(0, 2).join('')}</span>`;
    document.getElementById('op-hello').innerHTML =
      `<h1>Bonjour ${o.contact.split(' ')[0]} 👋</h1><p>Voici la performance de vos ${biens.length} biens, gérés par Conciergerie Lumia.</p>`;

    /* KPIs */
    const KPIS = [
      { label: 'CA du mois', value: formatEuro(ownerCA), foot: `sur ${biens.length} biens`, ic: icon('<path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>') },
      { label: 'Net propriétaire', value: formatEuro(net), foot: `après commission ${Math.round(o.commission * 100)} %`, ic: icon('<path d="M20 6 9 17l-5-5"/>') },
      { label: 'Occupation moyenne', value: avgOcc + ' %', foot: 'ce mois-ci', ic: icon('<path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/>') },
      { label: 'Réservations à venir', value: upcoming.length, foot: 'sur vos biens', ic: icon('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>') },
    ];
    document.getElementById('op-kpis').innerHTML = KPIS.map(k => `
      <div class="kpi"><span class="kpi__label">${k.label}</span><span class="kpi__value">${k.value}</span>
      <span class="kpi__foot">${k.foot}</span><span class="kpi__icon">${k.ic}</span></div>`).join('');

    /* Biens */
    document.getElementById('op-biens').innerHTML = biens.map(l => {
      const ca = caBien(l), comm = Math.round(ca * o.commission);
      return `<tr>
        <td><div class="row gap-3"><span class="op-thumb" style="background:${l.couleur}">${l.ville.slice(0, 2).toUpperCase()}</span>
          <div><b class="fw-semibold">${l.nom}</b><br><small class="text-muted">${l.ville} · ${labelTypeLogement(l.type)}</small></div></div></td>
        <td class="num">${occBien(l)} %</td>
        <td class="num money">${formatEuro(ca)}</td>
        <td class="num text-soft">− ${formatEuro(comm)}</td>
        <td class="num money fw-semibold">${formatEuro(ca - comm)}</td>
      </tr>`;
    }).join('');

    /* Réservations à venir */
    document.getElementById('op-resa').innerHTML = upcoming.length ? upcoming.map(r => {
      const l = getLogement(r.logementId);
      return `<tr>
        <td class="fw-semibold">${r.voyageur}</td>
        <td class="text-soft">${l.nom}</td>
        <td><span class="badge-canal badge-canal--${r.canal}"><span class="dot"></span>${CANAL_LABEL[r.canal]}</span></td>
        <td class="text-soft">${formatDate(r.arrivee, { jourSemaine: true })}</td>
        <td class="num">${r.nuits}</td>
        <td class="num money">${formatEuro(r.montant)}</td>
      </tr>`;
    }).join('') : '<tr><td colspan="6"><div class="empty"><h4>Aucune réservation à venir</h4></div></td></tr>';

    /* Graphiques */
    const allCA = STATS.parLogement.reduce((s, x) => s + x.ca, 0);
    const share = ownerCA / allCA;
    const monthlyRev = STATS.ca.map(v => Math.round(v * share));
    if (chartRev) chartRev.destroy();
    const ctx = document.getElementById('op-chart-rev').getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 240);
    grad.addColorStop(0, 'rgba(81,112,255,0.20)'); grad.addColorStop(1, 'rgba(81,112,255,0)');
    chartRev = new Chart(ctx, {
      type: 'line',
      data: { labels: STATS.moisLabels, datasets: [{ data: monthlyRev, borderColor: BLUE, backgroundColor: grad, fill: true, tension: 0.4, borderWidth: 3, pointRadius: 3, pointBackgroundColor: BLUE, pointBorderColor: '#fff', pointBorderWidth: 2 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ' ' + formatEuro(c.parsed.y) } } },
        scales: { y: { ticks: { callback: v => (v / 1000).toFixed(0) + 'k€' }, grid: { color: GRID }, border: { display: false } }, x: { grid: { display: false }, border: { display: false } } } },
    });

    if (chartOcc) chartOcc.destroy();
    chartOcc = new Chart(document.getElementById('op-chart-occ'), {
      type: 'bar',
      data: { labels: biens.map(l => l.nom), datasets: [{ data: biens.map(occBien), backgroundColor: BLUE, borderRadius: 6, maxBarThickness: 18 }] },
      options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ' ' + c.parsed.x + ' %' } } },
        scales: { x: { max: 100, ticks: { callback: v => v + ' %' }, grid: { color: GRID }, border: { display: false } }, y: { grid: { display: false }, border: { display: false }, ticks: { font: { size: 10 } } } } },
    });

    /* Relevé CSV */
    document.getElementById('op-releve').onclick = () => {
      const rows = biens.map(l => { const ca = caBien(l), comm = Math.round(ca * o.commission); return [l.nom, l.ville, occBien(l) + ' %', ca, comm, ca - comm]; });
      rows.push([]);
      rows.push(['TOTAL', '', avgOcc + ' %', ownerCA, commission, net]);
      UI.exportCSV(`releve-${o.societe.replace(/\s+/g, '-')}.csv`, ['Bien', 'Ville', 'Occupation', 'CA (€)', 'Commission (€)', 'Net (€)'], rows);
    };
  }

  function signIn() {
    currentId = sel.value;
    document.getElementById('op-login').classList.add('hidden');
    document.getElementById('op-app').classList.remove('hidden');
    render();
  }
  document.getElementById('op-form').addEventListener('submit', signIn);
  document.getElementById('op-signin').addEventListener('click', signIn);
  document.getElementById('op-logout').addEventListener('click', () => {
    document.getElementById('op-app').classList.add('hidden');
    document.getElementById('op-login').classList.remove('hidden');
  });

  if (params.get('o') && getProprietaire(params.get('o'))) signIn();
})();
