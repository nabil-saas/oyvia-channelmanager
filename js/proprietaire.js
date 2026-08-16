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
    // Le portail lisait un simple « CA × taux ». C'était faux dès que le
    // contrat comportait un forfait ou des dépenses refacturées : le
    // propriétaire y voyait un net supérieur à ce qu'il touchait vraiment.
    // On passe par le même calcul que la comptabilité du gestionnaire.
    const depensesOwner = DEPENSES
      .filter(d => biens.some(l => l.id === d.logementId))
      .reduce((t, d) => t + d.montant, 0);
    const dec = calculFacture(o, ownerCA, depensesOwner);
    const commission = Math.round(dec.honoraires);
    const net = Math.round(dec.netProprietaire);
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
      { label: 'CA du mois', value: formatMontant(ownerCA), foot: `sur ${biens.length} biens`, ic: icon('<path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>') },
      { label: 'Net propriétaire', value: formatMontant(net),
        foot: dec.depensesACharge ? `après honoraires et ${formatMontant(dec.depensesACharge)} de frais` : `après honoraires ${formatMontant(commission)}`,
        ic: icon('<path d="M20 6 9 17l-5-5"/>') },
      { label: 'Occupation moyenne', value: avgOcc + ' %', foot: 'ce mois-ci', ic: icon('<path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/>') },
      { label: 'Réservations à venir', value: upcoming.length, foot: 'sur vos biens', ic: icon('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>') },
    ];
    document.getElementById('op-kpis').innerHTML = KPIS.map(k => `
      <div class="kpi"><span class="kpi__label">${k.label}</span><span class="kpi__value">${k.value}</span>
      <span class="kpi__foot">${k.foot}</span><span class="kpi__icon">${k.ic}</span></div>`).join('');

    /* Biens.
       La commission ne se ventile par bien que si elle est proportionnelle
       au CA. Sous contrat au forfait, répartir le forfait bien par bien
       inventerait une clé de répartition dont personne n'a convenu : on
       affiche alors 0 et le forfait reste au total. */
    const commBien = ca => o.remuneration === 'forfait' ? 0 : Math.round(ca * (o.commission || 0));
    document.getElementById('op-biens').innerHTML = biens.map(l => {
      const ca = caBien(l), comm = commBien(ca);
      return `<tr>
        <td><div class="row gap-3"><span class="op-thumb" style="background:${l.couleur}">${l.ville.slice(0, 2).toUpperCase()}</span>
          <div><b class="fw-semibold">${l.nom}</b><br><small class="text-muted">${l.ville} · ${labelTypeLogement(l.type)}</small></div></div></td>
        <td class="num">${occBien(l)} %</td>
        <td class="num money">${formatMontant(ca)}</td>
        <td class="num text-soft">− ${formatMontant(comm)}</td>
        <td class="num money fw-semibold">${formatMontant(ca - comm)}</td>
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
        <td class="num money">${formatMontant(r.montant)}</td>
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
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ' ' + formatMontant(c.parsed.y) } } },
        scales: { y: { ticks: { callback: v => Math.round(versAffichage(v) / 1000) + 'k' + symboleDevise() }, grid: { color: GRID }, border: { display: false } }, x: { grid: { display: false }, border: { display: false } } } },
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
      // Colonnes monétaires exportées dans la devise d'affichage, comme à l'écran.
      const m = v => Math.round(versAffichage(v));
      const rows = biens.map(l => { const ca = caBien(l), comm = commBien(ca); return [l.nom, l.ville, occBien(l) + ' %', m(ca), m(comm), m(ca - comm)]; });
      rows.push([]);
      rows.push(['TOTAL', '', avgOcc + ' %', m(ownerCA), m(commission), m(net)]);
      UI.exportCSV(`releve-${o.societe.replace(/\s+/g, '-')}.csv`, ['Bien', 'Ville', 'Occupation', `CA (${symboleDevise()})`, `Commission (${symboleDevise()})`, `Net (${symboleDevise()})`], rows);
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
