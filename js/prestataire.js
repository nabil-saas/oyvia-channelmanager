/* ============================================================
   OYVIA — Espace prestataire : connexion + planning personnel
   Chaque prestataire ne voit que SES interventions à venir,
   filtrables par type (ménage, check-in, maintenance…).
   ============================================================ */
(function () {
  const JOURS_LONG = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const TYPE_BADGE = { menage: 'badge--accent', checkin: 'badge--positive', maintenance: 'badge--warning', linge: 'badge--neutral' };
  const STA_NEXT = { a_faire: 'en_cours', en_cours: 'termine', termine: 'a_faire' };
  const STA_LABEL = { a_faire: 'Démarrer', en_cours: 'Terminer', termine: 'Terminé ✓' };
  const initiales = n => n.split(' ').map(m => m[0]).slice(0, 2).join('').toUpperCase();
  const params = new URLSearchParams(location.search);

  const sel = document.getElementById('pr-who');
  sel.innerHTML = PRESTATAIRES.map(p => `<option value="${p.id}">${p.nom} · ${p.role}</option>`).join('');
  if (params.get('p') && getPrestataire(params.get('p'))) sel.value = params.get('p');

  let currentId = null;
  let filterType = 'all';

  function myTasks() {
    return TACHES
      .filter(t => t.prestataireId === currentId && parseDate(t.date) >= parseDate(AUJOURDHUI))
      .sort((a, b) => (a.date + a.heure).localeCompare(b.date + b.heure));
  }

  function photoSection(t) {
    const photos = t.photos || [];
    const thumbs = photos.map((src, i) => `
      <div class="pr-photos__item">
        <img src="${src}" alt="Photo de l'intervention" />
        <button type="button" class="pr-photos__del" data-photo-del="${t.id}::${i}" aria-label="Supprimer la photo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>`).join('');
    return `<div class="pr-photos">
      <p class="pr-photos__label">Photos de l'intervention${photos.length ? ` (${photos.length})` : ''}</p>
      <div class="pr-photos__grid">
        ${thumbs}
        <label class="pr-photos__add">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
          <span>Ajouter</span>
          <input type="file" accept="image/*" multiple data-photo-input="${t.id}" hidden />
        </label>
      </div>
    </div>`;
  }

  function taskCard(t) {
    const l = getLogement(t.logementId);
    return `<div class="pr-task ${t.statut === 'termine' ? 'is-done' : ''}" data-id="${t.id}">
      <div class="pr-task__head">
        <span class="badge ${TYPE_BADGE[t.type] || 'badge--neutral'}">${TACHE_LABEL[t.type] || t.type}</span>
        <span class="pr-task__time">${t.heure}</span>
      </div>
      <b>${l.nom}</b>
      <div class="pr-task__loc">${l.ville} · ${l.adresse}</div>
      ${t.note ? `<div class="pr-task__loc" style="margin-top:4px">📝 ${t.note}</div>` : ''}
      <div class="pr-task__access">
        <span class="pr-task__code">Code porte <b>${l.codeAcces}</b></span>
        <span class="pr-task__code">Wifi <b>${l.wifi.ssid}</b></span>
      </div>
      <div class="pr-task__foot">
        <span class="pr-task__pay">${t.montant ? formatEuro(t.montant) : '—'}</span>
        <button class="pr-status pr-status--${t.statut}" data-status="${t.id}">${STA_LABEL[t.statut]}</button>
      </div>
      ${t.statut === 'termine' ? photoSection(t) : ''}
    </div>`;
  }

  function render() {
    const p = getPrestataire(currentId);
    document.getElementById('pr-user').innerHTML =
      `<div class="pr-user__meta"><b>${p.nom}</b><small>${p.role} · ${p.zone}</small></div><span class="avatar">${initiales(p.nom)}</span>`;
    document.getElementById('pr-hello').innerHTML =
      `<b>Bonjour ${p.nom.split(' ')[0]} 👋</b><span>Voici vos interventions à venir.</span>`;

    const all = myTasks();
    const due = all.reduce((s, t) => s + t.montant, 0);
    document.getElementById('pr-stats').innerHTML =
      `<div class="pr-stat"><small>Tâches à venir</small><b>${all.length}</b></div>
       <div class="pr-stat"><small>Montant dû</small><b>${formatEuro(due)}</b></div>`;

    const types = [...new Set(all.map(t => t.type))];
    if (!types.includes(filterType)) filterType = 'all';
    document.getElementById('pr-filter').innerHTML =
      `<span class="pr-chip ${filterType === 'all' ? 'is-active' : ''}" data-f="all">Toutes</span>` +
      types.map(ty => `<span class="pr-chip ${filterType === ty ? 'is-active' : ''}" data-f="${ty}">${TACHE_LABEL[ty] || ty}</span>`).join('');

    const list = all.filter(t => filterType === 'all' || t.type === filterType);
    const byDay = {};
    list.forEach(t => { (byDay[t.date] = byDay[t.date] || []).push(t); });
    const days = Object.keys(byDay).sort();
    document.getElementById('pr-tasks').innerHTML = days.length
      ? days.map(d => {
          const dd = parseDate(d);
          const label = (d === AUJOURDHUI ? 'Aujourd\'hui · ' : '') + `${JOURS_LONG[dd.getDay()]} ${dd.getDate()} ${MOIS_LONG[dd.getMonth()]}`;
          return `<div class="pr-day ${d === AUJOURDHUI ? 'pr-day--today' : ''}">${label}</div>${byDay[d].map(taskCard).join('')}`;
        }).join('')
      : '<div class="empty"><h4>Aucune intervention à venir</h4><p>Votre planning est à jour. 🎉</p></div>';
  }

  function signIn() {
    currentId = sel.value;
    filterType = 'all';
    document.getElementById('pr-login').classList.add('hidden');
    document.getElementById('pr-app').classList.remove('hidden');
    render();
  }

  document.getElementById('pr-form').addEventListener('submit', signIn);
  document.getElementById('pr-signin').addEventListener('click', signIn);
  document.getElementById('pr-logout').addEventListener('click', () => {
    document.getElementById('pr-app').classList.add('hidden');
    document.getElementById('pr-login').classList.remove('hidden');
  });
  document.getElementById('pr-filter').addEventListener('click', e => {
    const c = e.target.closest('[data-f]'); if (c) { filterType = c.dataset.f; render(); }
  });
  document.getElementById('pr-tasks').addEventListener('click', e => {
    const del = e.target.closest('[data-photo-del]');
    if (del) {
      const [taskId, idx] = del.dataset.photoDel.split('::');
      const t = TACHES.find(x => x.id === taskId);
      if (t && t.photos) t.photos.splice(parseInt(idx, 10), 1);
      render();
      return;
    }
    const b = e.target.closest('[data-status]'); if (!b) return;
    const t = TACHES.find(x => x.id === b.dataset.status);
    t.statut = STA_NEXT[t.statut];
    render();
    if (typeof UI !== 'undefined') UI.toast(t.statut === 'termine' ? 'Intervention terminée' : t.statut === 'en_cours' ? 'Intervention démarrée' : 'Statut mis à jour');
  });
  document.getElementById('pr-tasks').addEventListener('change', e => {
    const input = e.target.closest('[data-photo-input]'); if (!input || !input.files.length) return;
    const t = TACHES.find(x => x.id === input.dataset.photoInput);
    if (!t) return;
    t.photos = t.photos || [];
    [...input.files].forEach(file => t.photos.push(URL.createObjectURL(file)));
    render();
    if (typeof UI !== 'undefined') UI.toast(input.files.length > 1 ? 'Photos ajoutées' : 'Photo ajoutée');
  });

  // Connexion directe via ?p=P1
  if (params.get('p') && getPrestataire(params.get('p'))) signIn();
})();
