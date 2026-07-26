/* ============================================================
   OYVIA — Calendrier unifié (écran le plus important)
   Grille logements × dates, barres par canal, tooltip,
   panneau de détail (partagé via UI.openResa), blocage de
   dates, vue mois / semaine.
   ============================================================ */
Layout.init('calendrier');

(function () {
  const JOURS_MINI = ['di', 'lu', 'ma', 'me', 'je', 've', 'sa'];
  const MS_JOUR = 86400000;
  const grid = document.getElementById('cal-grid');
  const label = document.getElementById('cal-label');
  const tt = document.getElementById('cal-tt');

  const state = {
    view: 'month',
    year: 2026, month: 6,                 // juillet 2026
    weekStart: lundiDeLaSemaine(parseDate(AUJOURDHUI)),
  };
  let logementFiltre = 'all';
  let mode = 'reservations';   // 'reservations' | 'taches'

  function lundiDeLaSemaine(d) {
    const x = new Date(d); const j = (x.getDay() + 6) % 7; x.setDate(x.getDate() - j); return x;
  }
  const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const isWE = d => d.getDay() === 0 || d.getDay() === 6;
  const isToday = d => sameDay(d, parseDate(AUJOURDHUI));
  const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  function getRange() {
    if (state.view === 'week') {
      return Array.from({ length: 7 }, (_, i) => new Date(state.weekStart.getFullYear(), state.weekStart.getMonth(), state.weekStart.getDate() + i));
    }
    const n = new Date(state.year, state.month + 1, 0).getDate();
    return Array.from({ length: n }, (_, i) => new Date(state.year, state.month, i + 1));
  }

  function updateLabel(days) {
    if (state.view === 'week') {
      const a = days[0], b = days[6];
      label.textContent = `${a.getDate()} – ${b.getDate()} ${MOIS_COURT[b.getMonth()]} ${b.getFullYear()}`;
    } else {
      label.textContent = `${MOIS_LONG[state.month].charAt(0).toUpperCase() + MOIS_LONG[state.month].slice(1)} ${state.year}`;
    }
  }

  function barFor(r, rangeStart, N) {
    const s = Math.round((parseDate(r.arrivee) - rangeStart) / MS_JOUR);
    const e = Math.round((parseDate(r.depart) - rangeStart) / MS_JOUR); // checkout (exclu)
    const visStart = Math.max(s, 0);
    const visEnd = Math.min(e, N);
    if (visEnd <= 0 || visStart >= N || visEnd <= visStart) return '';
    const labelTxt = r.canal === 'bloque' ? (r.note || 'Bloqué') : r.voyageur;
    return `<div class="cal-bar cal-bar--${r.canal}" style="grid-column:${visStart + 1}/${visEnd + 1}" data-res="${r.id}" tabindex="0" role="button" aria-label="${labelTxt}, ${formatPlage(r.arrivee, r.depart)}">${labelTxt}</div>`;
  }

  function render() {
    const days = getRange();
    const N = days.length;
    const rangeStart = days[0];
    const cols = `repeat(${N}, minmax(42px, 1fr))`;
    updateLabel(days);

    const head = days.map(d => {
      const cls = `${isToday(d) ? 'cal-dayhead--today' : ''} ${isWE(d) ? 'cal-dayhead--we' : ''}`;
      return `<div class="cal-dayhead ${cls}"><small>${JOURS_MINI[d.getDay()]}</small><b>${d.getDate()}</b></div>`;
    }).join('');

    let html = `<div class="cal-row cal-row--head">
      <div class="cal-namecell">Logement</div>
      <div class="cal-track" style="grid-template-columns:${cols}">${head}</div>
    </div>`;

    const logements = logementFiltre === 'all' ? LOGEMENTS : LOGEMENTS.filter(l => l.id === logementFiltre);
    logements.forEach(l => {
      let cells, extra = '';
      if (mode === 'taches') {
        const tByDate = {};
        TACHES.filter(t => t.logementId === l.id).forEach(t => { (tByDate[t.date] = tByDate[t.date] || []).push(t); });
        cells = days.map(d => {
          const chips = (tByDate[ymd(d)] || []).sort((a, b) => a.heure.localeCompare(b.heure)).map(t => {
            const p = getPrestataire(t.prestataireId);
            return `<div class="cal-tchip cal-tchip--${t.type}" data-task="${t.id}"><b>${t.heure}</b> ${p ? p.nom : (TACHE_LABEL[t.type] || t.type)}</div>`;
          }).join('');
          return `<div class="cal-daycell ${isToday(d) ? 'cal-daycell--today' : ''} ${isWE(d) ? 'cal-daycell--we' : ''}">${chips ? `<div class="cal-tchips">${chips}</div>` : ''}</div>`;
        }).join('');
      } else {
        cells = days.map(d => `<div class="cal-daycell ${isToday(d) ? 'cal-daycell--today' : ''} ${isWE(d) ? 'cal-daycell--we' : ''}"></div>`).join('');
        extra = RESERVATIONS.filter(r => r.logementId === l.id).map(r => barFor(r, rangeStart, N)).join('');
      }
      html += `<div class="cal-row cal-row--body">
        <div class="cal-namecell">
          <span class="cal-namecell__thumb" style="background:${l.couleur}">${l.ville.slice(0, 2).toUpperCase()}</span>
          <div class="cal-namecell__meta"><b title="${l.nom}">${l.nom}</b><small>${l.ville}</small></div>
        </div>
        <div class="cal-track" style="grid-template-columns:${cols}">${cells}${extra}</div>
      </div>`;
    });
    grid.classList.toggle('cal-grid--taches', mode === 'taches');
    grid.innerHTML = html;
  }

  /* ---------- Tooltip ---------- */
  grid.addEventListener('mouseover', e => {
    const taskEl = e.target.closest('.cal-tchip');
    if (taskEl) {
      const t = TACHES.find(x => x.id === taskEl.dataset.task); if (!t) return;
      const p = getPrestataire(t.prestataireId);
      const stLabel = { a_faire: 'À faire', en_cours: 'En cours', termine: 'Terminé' }[t.statut];
      tt.innerHTML = `<b>${TACHE_LABEL[t.type] || t.type} · ${getLogement(t.logementId).nom}</b>
        <div class="cal-tt__row"><span>Quand</span><span>${formatDate(t.date)} · ${t.heure}</span></div>
        <div class="cal-tt__row"><span>Prestataire</span><span>${p ? p.nom : '—'}</span></div>
        <div class="cal-tt__row"><span>Statut</span><span>${stLabel}</span></div>
        ${t.montant ? `<div class="cal-tt__row"><span>Montant</span><span>${formatEuro(t.montant)}</span></div>` : ''}`;
      tt.classList.add('is-open');
      return;
    }
    const bar = e.target.closest('.cal-bar'); if (!bar) return;
    const r = getReservation(bar.dataset.res); if (!r) return;
    const money = r.canal === 'bloque' ? '' :
      `<div class="cal-tt__row"><span>Montant</span><span>${formatEuro(r.montant)}</span></div>
       <div class="cal-tt__row"><span>Statut</span><span>${STATUT_LABEL[r.statut]}</span></div>`;
    tt.innerHTML = `<b>${r.canal === 'bloque' ? 'Blocage' : r.voyageur}</b>
      <div class="cal-tt__row"><span>Canal</span><span>${CANAL_LABEL[r.canal]}</span></div>
      <div class="cal-tt__row"><span>Séjour</span><span>${formatPlage(r.arrivee, r.depart)}</span></div>
      <div class="cal-tt__row"><span>Nuits</span><span>${r.nuits}</span></div>${money}`;
    tt.classList.add('is-open');
  });
  grid.addEventListener('mousemove', e => {
    if (!tt.classList.contains('is-open')) return;
    const pad = 16, w = tt.offsetWidth, h = tt.offsetHeight;
    let x = e.clientX + pad, y = e.clientY + pad;
    if (x + w > window.innerWidth - 8) x = e.clientX - w - pad;
    if (y + h > window.innerHeight - 8) y = e.clientY - h - pad;
    tt.style.left = x + 'px'; tt.style.top = y + 'px';
  });
  grid.addEventListener('mouseout', e => { if (e.target.closest('.cal-bar') || e.target.closest('.cal-tchip')) tt.classList.remove('is-open'); });

  /* ---------- Ouverture du détail (panneau partagé) ---------- */
  grid.addEventListener('click', e => { const bar = e.target.closest('.cal-bar'); if (bar) UI.openResa(bar.dataset.res); });
  grid.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('cal-bar')) { e.preventDefault(); UI.openResa(e.target.dataset.res); }
  });

  /* ---------- Blocage de dates ---------- */
  document.getElementById('blk-log').innerHTML = LOGEMENTS.map(l => `<option value="${l.id}">${l.nom}</option>`).join('');
  document.getElementById('blk-prest-list').innerHTML = PRESTATAIRES.map(p => `
    <label class="blk-prest-row">
      <input type="checkbox" value="${p.id}">
      ${p.nom}
      <small>${p.role} · ${p.zone}</small>
    </label>`).join('');
  document.getElementById('cal-block').addEventListener('click', () => {
    document.getElementById('blk-motif').value = '';
    document.querySelectorAll('#blk-prest-list input:checked').forEach(c => { c.checked = false; });
    UI.openPanel('cal-modal');
  });
  document.getElementById('blk-confirm').addEventListener('click', () => {
    const logId = document.getElementById('blk-log').value;
    const from = document.getElementById('blk-from').value;
    const to = document.getElementById('blk-to').value;
    const motif = document.getElementById('blk-motif').value.trim();
    if (!motif) { UI.toast('Le motif est obligatoire', false); return; }
    if (!from || !to || parseDate(to) <= parseDate(from)) { UI.toast('Dates invalides', false); return; }

    const blockId = 'RB' + Date.now();
    RESERVATIONS.push({
      id: blockId, logementId: logId, voyageurId: null, voyageur: motif,
      canal: 'bloque', arrivee: from, depart: to, pers: 0, montant: 0, paiement: 'paye',
      statut: 'confirme', ref: '—', note: motif, nuits: nuitsEntre(from, to),
    });

    // Assignation optionnelle à un ou plusieurs prestataires : une tâche par prestataire coché
    const prestIds = [...document.querySelectorAll('#blk-prest-list input:checked')].map(c => c.value);
    prestIds.forEach((prestataireId, i) => {
      TACHES.push({
        id: 'T' + Date.now() + i, type: 'maintenance',
        logementId: logId, date: from, heure: '10:00',
        prestataireId, statut: 'a_faire', montant: 0,
        reservationId: blockId, note: motif,
      });
    });

    UI.closeAll(); render();
    UI.toast(prestIds.length
      ? `Dates bloquées · ${prestIds.length} tâche${prestIds.length > 1 ? 's' : ''} créée${prestIds.length > 1 ? 's' : ''}`
      : 'Dates bloquées');
  });

  /* ---------- Navigation ---------- */
  document.getElementById('cal-view').addEventListener('click', e => {
    const btn = e.target.closest('button'); if (!btn) return;
    document.querySelectorAll('#cal-view button').forEach(b => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    state.view = btn.dataset.view;
    render();
  });
  document.getElementById('cal-prev').addEventListener('click', () => shift(-1));
  document.getElementById('cal-next').addEventListener('click', () => shift(1));
  function shift(dir) {
    if (state.view === 'week') {
      state.weekStart = new Date(state.weekStart.getFullYear(), state.weekStart.getMonth(), state.weekStart.getDate() + dir * 7);
    } else {
      state.month += dir;
      if (state.month < 0) { state.month = 11; state.year--; }
      if (state.month > 11) { state.month = 0; state.year++; }
    }
    render();
  }

  // Bascule Réservations / Tâches prestataires
  document.getElementById('cal-mode').addEventListener('click', e => {
    const btn = e.target.closest('button'); if (!btn) return;
    document.querySelectorAll('#cal-mode button').forEach(b => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    mode = btn.dataset.mode;
    document.getElementById('cal-legend-resa').classList.toggle('hidden', mode !== 'reservations');
    document.getElementById('cal-legend-taches').classList.toggle('hidden', mode !== 'taches');
    document.getElementById('cal-block').style.display = mode === 'taches' ? 'none' : '';
    render();
  });

  // Filtres & synchronisation
  document.addEventListener('logementChange', e => { logementFiltre = e.detail; render(); });
  document.addEventListener('resaChanged', render);

  render();
})();
