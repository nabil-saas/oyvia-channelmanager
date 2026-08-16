/* ============================================================
   OYVIA — Statistiques : CA, occupation, canaux, ADR
   ============================================================ */
Layout.init('statistiques');

(function () {
  const css = getComputedStyle(document.documentElement);
  const tok = n => css.getPropertyValue(n).trim();
  const FONT = { family: 'Geist' };
  const BLUE = tok('--blue-600'), GRID = tok('--ink-100'), MUTED = tok('--ink-500');
  Chart.defaults.font.family = 'Geist';
  Chart.defaults.color = MUTED;

  document.getElementById('st-logement').innerHTML = '<option value="all">Tous les logements</option>' +
    LOGEMENTS.map(l => `<option>${l.nom}</option>`).join('');

  const avg = a => Math.round(a.reduce((s, x) => s + x, 0) / a.length);
  const totalCA = STATS.ca.reduce((s, x) => s + x, 0);
  const nuitees = RESERVATIONS.filter(r => r.canal !== 'bloque').reduce((s, r) => s + r.nuits, 0);

  const icon = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  const KPIS = [
    { label: 'CA total (6 mois)', value: formatMontant(totalCA), ic: icon('<path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>') },
    { label: 'Occupation moyenne', value: avg(STATS.occupation) + ' %', ic: icon('<path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/>') },
    { label: 'ADR moyen', value: formatMontant(avg(STATS.adr)), ic: icon('<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>') },
    { label: 'Nuitées vendues', value: nuitees, ic: icon('<path d="M2 4v16M2 8h18a2 2 0 0 1 2 2v10M2 17h20M6 8V4"/>') },
  ];
  document.getElementById('st-kpi').innerHTML = KPIS.map(k => `
    <div class="kpi"><span class="kpi__label">${k.label}</span><span class="kpi__value">${k.value}</span>
    <span class="kpi__icon">${k.ic}</span></div>`).join('');

  /* Export CSV : synthèse mensuelle + occupation par logement */
  document.getElementById('st-export').addEventListener('click', () => {
    // Colonnes monétaires exportées dans la devise d'affichage, comme à l'écran.
    const m$ = v => Math.round(versAffichage(v));
    const rows = STATS.moisLabels.map((m, i) => [m, m$(STATS.ca[i]), STATS.occupation[i] + ' %', m$(STATS.adr[i])]);
    rows.push([]);
    rows.push(['Occupation par logement', '', '', '']);
    STATS.parLogement.forEach(x => rows.push([getLogement(x.id).nom, m$(x.ca), x.occ + ' %', '']));
    UI.exportCSV('cleo-statistiques.csv', ['Mois', `CA (${symboleDevise()})`, 'Occupation', `ADR (${symboleDevise()})`], rows);
  });

  /* CA par mois — barres */
  new Chart(document.getElementById('st-ca'), {
    type: 'bar',
    data: { labels: STATS.moisLabels, datasets: [{ data: STATS.ca, backgroundColor: BLUE, borderRadius: 8, maxBarThickness: 44 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ' ' + formatMontant(c.parsed.y) } } },
      scales: { y: { ticks: { callback: v => Math.round(versAffichage(v) / 1000) + 'k' + symboleDevise() }, grid: { color: GRID }, border: { display: false } }, x: { grid: { display: false }, border: { display: false } } },
    },
  });

  /* Répartition par canal — doughnut */
  const canalData = [
    { k: 'Airbnb', v: STATS.repartitionCanal.airbnb, c: tok('--ch-airbnb') },
    { k: 'Booking.com', v: STATS.repartitionCanal.booking, c: tok('--ch-booking') },
    { k: 'Direct', v: STATS.repartitionCanal.direct, c: tok('--ch-direct') },
  ];
  new Chart(document.getElementById('st-canal'), {
    type: 'doughnut',
    data: { labels: canalData.map(d => d.k), datasets: [{ data: canalData.map(d => d.v), backgroundColor: canalData.map(d => d.c), borderWidth: 0, cutout: '64%' }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ' ' + c.parsed + ' %' } } } },
  });
  document.getElementById('st-canal-legend').innerHTML = canalData.map(d =>
    `<div class="st-legend__item"><i style="background:${d.c}"></i> ${d.k} <b>${d.v} %</b></div>`).join('');

  /* Occupation par logement — barres horizontales */
  const byLog = STATS.parLogement.map(x => ({ nom: getLogement(x.id).nom, occ: x.occ })).sort((a, b) => b.occ - a.occ);
  new Chart(document.getElementById('st-occ'), {
    type: 'bar',
    data: { labels: byLog.map(x => x.nom), datasets: [{ data: byLog.map(x => x.occ), backgroundColor: BLUE, borderRadius: 6, maxBarThickness: 20 }] },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ' ' + c.parsed.x + ' %' } } },
      scales: { x: { max: 100, ticks: { callback: v => v + ' %' }, grid: { color: GRID }, border: { display: false } }, y: { grid: { display: false }, border: { display: false }, ticks: { font: { size: 11 } } } },
    },
  });

  /* ADR par mois — ligne */
  const ctx = document.getElementById('st-adr').getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 320);
  grad.addColorStop(0, 'rgba(81,112,255,0.20)'); grad.addColorStop(1, 'rgba(81,112,255,0)');
  new Chart(ctx, {
    type: 'line',
    data: { labels: STATS.moisLabels, datasets: [{ data: STATS.adr, borderColor: BLUE, backgroundColor: grad, fill: true, tension: 0.4, borderWidth: 3, pointRadius: 4, pointBackgroundColor: BLUE, pointBorderColor: '#fff', pointBorderWidth: 2 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ' ' + formatMontant(c.parsed.y) + ' / nuit' } } },
      scales: { y: { ticks: { callback: v => Math.round(versAffichage(v)) + ' ' + symboleDevise() }, grid: { color: GRID }, border: { display: false } }, x: { grid: { display: false }, border: { display: false } } },
    },
  });
})();
