/* ============================================================
   OYVIA — Ménage & équipe : planning + assignation + dû prestataire
   ============================================================ */
Layout.init('menage');

(function () {
  const TYPE_IC = {
    menage: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
    checkin: '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="M10 17l5-5-5-5M15 12H3"/>',
    maintenance: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-2.4z"/>',
    linge: '<rect x="4" y="3" width="16" height="18" rx="2"/><circle cx="12" cy="13" r="4"/><path d="M8 6h.01"/>',
  };
  const STATUT_BADGE = { a_faire: 'badge--warning', en_cours: 'badge--accent', termine: 'badge--positive' };
  const STATUT_TXT = { a_faire: 'À faire', en_cours: 'En cours', termine: 'Terminé' };
  const NEXT = { a_faire: 'en_cours', en_cours: 'termine', termine: 'a_faire' };
  const icon = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;

  const F = {
    prest: document.getElementById('mn-prestataire'),
    type: document.getElementById('mn-type'),
    statut: document.getElementById('mn-statut'),
  };
  F.prest.innerHTML = '<option value="all">Tous les prestataires</option>' +
    PRESTATAIRES.map(p => `<option value="${p.id}">${p.nom}</option>`).join('');

  /* ---------- Dû par prestataire ---------- */
  function renderTeam() {
    document.getElementById('mn-team').innerHTML = PRESTATAIRES.map((p, i) => {
      const tasks = TACHES.filter(t => t.prestataireId === p.id && parseDate(t.date) >= parseDate(AUJOURDHUI));
      const due = tasks.reduce((s, t) => s + t.montant, 0);
      const av = ['', 'avatar--v2', 'avatar--v3', 'avatar--v4'][i % 4];
      return `<div class="mn-teamcard">
        <span class="avatar ${av}">${p.nom.split(' ').map(m => m[0]).join('')}</span>
        <div class="mn-teamcard__meta"><b>${p.nom}</b><small>${p.role} · ${p.zone}</small></div>
        <div class="mn-teamcard__due"><b>${formatEuro(due)}</b><small>${tasks.length} tâches</small></div>
      </div>`;
    }).join('');
  }

  /* ---------- Planning groupé par jour ---------- */
  function render() {
    renderTeam();
    const list = TACHES.filter(t => {
      if (parseDate(t.date) < parseDate(AUJOURDHUI)) return false; // on masque le passé
      if (F.prest.value !== 'all' && t.prestataireId !== F.prest.value) return false;
      if (F.type.value !== 'all' && t.type !== F.type.value) return false;
      if (F.statut.value !== 'all' && t.statut !== F.statut.value) return false;
      return true;
    }).sort((a, b) => (a.date + a.heure).localeCompare(b.date + b.heure));

    const byDay = {};
    list.forEach(t => { (byDay[t.date] = byDay[t.date] || []).push(t); });

    const days = Object.keys(byDay).sort();
    const html = days.map(date => {
      const isToday = date === AUJOURDHUI;
      const rows = byDay[date].map(t => taskRow(t)).join('');
      return `<div class="mn-daygroup">
        <div class="mn-dayhead ${isToday ? 'mn-dayhead--today' : ''}">
          <h3>${formatDate(date, { jourSemaine: true, moisLong: true })}</h3>
          ${isToday ? '<span class="badge badge--accent">Aujourd\'hui</span>' : ''}
          <span class="badge badge--neutral">${byDay[date].length} tâche${byDay[date].length > 1 ? 's' : ''}</span>
        </div>
        <div class="mn-tasks">${rows}</div>
      </div>`;
    }).join('') || '<div class="empty"><h4>Aucune tâche</h4><p>Ajustez les filtres.</p></div>';

    document.getElementById('mn-planning').innerHTML = html;
  }

  function taskRow(t) {
    const l = getLogement(t.logementId);
    const options = PRESTATAIRES.map(p => `<option value="${p.id}" ${p.id === t.prestataireId ? 'selected' : ''}>${p.nom}</option>`).join('');
    return `<div class="mn-task ${t.statut === 'termine' ? 'is-done' : ''}" data-id="${t.id}">
      <span class="mn-task__time">${t.heure}</span>
      <span class="mn-task__ic mn-task__ic--${t.type}">${icon(TYPE_IC[t.type] || 'M12 2 2 7v10l10 5 10-5V7z')}</span>
      <div class="mn-task__meta">
        <b>${TACHE_LABEL[t.type]} · ${l.nom}</b>
        <small>${l.ville}${t.note ? ' · ' + t.note : ''}</small>
      </div>
      <div class="mn-task__prest"><select class="select" data-assign="${t.id}">${options}</select></div>
      <span class="mn-task__amount">${t.montant ? formatEuro(t.montant) : '—'}</span>
      <div class="mn-task__status"><span class="badge ${STATUT_BADGE[t.statut]} mn-statusbtn" data-status="${t.id}" title="Cliquer pour changer">${STATUT_TXT[t.statut]}</span></div>
    </div>`;
  }

  /* ---------- Interactions ---------- */
  const planning = document.getElementById('mn-planning');
  planning.addEventListener('change', e => {
    const s = e.target.closest('[data-assign]'); if (s) {
      const t = TACHES.find(x => x.id === s.dataset.assign);
      t.prestataireId = s.value; renderTeam(); UI.toast('Prestataire assigné');
    }
  });
  planning.addEventListener('click', e => {
    const b = e.target.closest('[data-status]'); if (b) {
      const t = TACHES.find(x => x.id === b.dataset.status);
      t.statut = NEXT[t.statut]; render();
    }
  });
  Object.values(F).forEach(el => el.addEventListener('change', render));

  /* ---------- Ajout d'une tâche : assignée à une RÉSERVATION ---------- */
  const typeSel = document.getElementById('mn-f-type');
  const resaSel = document.getElementById('mn-f-resa');
  const newtypeWrap = document.getElementById('mn-f-newtype-wrap');

  function dateDeLaTache(r, type) { return type === 'checkin' ? r.arrivee : r.depart; }

  function updateDerived() {
    const r = getReservation(resaSel.value);
    const box = document.getElementById('mn-f-derived');
    if (!r) { box.innerHTML = ''; return; }
    const l = getLogement(r.logementId);
    const isCheckin = typeSel.value === 'checkin';
    const date = dateDeLaTache(r, typeSel.value);
    box.innerHTML = `Liée à <b>${r.voyageur}</b> · Logement <b>${l.nom}</b> · Prévue le <b>${formatDate(date, { jourSemaine: true })}</b> (${isCheckin ? 'jour d\'arrivée' : 'jour du départ'}).`;
    document.getElementById('mn-f-montant').value = l.menageTarif;
  }

  function fillTaskModal() {
    typeSel.innerHTML = Object.entries(TACHE_LABEL).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')
      + '<option value="__new">＋ Nouvelle catégorie…</option>';
    resaSel.innerHTML = RESERVATIONS.filter(r => r.canal !== 'bloque' && parseDate(r.depart) >= parseDate(AUJOURDHUI))
      .sort((a, b) => parseDate(a.depart) - parseDate(b.depart))
      .map(r => `<option value="${r.id}">${r.voyageur} — ${getLogement(r.logementId).nom} (${formatPlage(r.arrivee, r.depart)})</option>`).join('');
    document.getElementById('mn-f-prest').innerHTML = PRESTATAIRES.map(p => `<option value="${p.id}">${p.nom}</option>`).join('');
    newtypeWrap.classList.add('hidden');
    updateDerived();
  }
  typeSel.addEventListener('change', () => { newtypeWrap.classList.toggle('hidden', typeSel.value !== '__new'); updateDerived(); });
  resaSel.addEventListener('change', updateDerived);
  document.getElementById('mn-add').addEventListener('click', () => { fillTaskModal(); UI.openPanel('mn-modal'); });
  document.getElementById('mn-create').addEventListener('click', () => {
    const r = getReservation(resaSel.value);
    if (!r) { UI.toast('Sélectionnez une réservation', false); return; }
    let type = typeSel.value;
    if (type === '__new') {
      const label = document.getElementById('mn-f-newtype').value.trim();
      if (!label) { UI.toast('Nommez la nouvelle catégorie', false); return; }
      type = 'c' + Date.now().toString().slice(-6);
      TACHE_LABEL[type] = label;
    }
    TACHES.push({
      id: 'T' + Date.now(), type,
      logementId: r.logementId,
      date: dateDeLaTache(r, type),
      heure: document.getElementById('mn-f-heure').value || '11:00',
      prestataireId: document.getElementById('mn-f-prest').value,
      statut: 'a_faire',
      montant: parseInt(document.getElementById('mn-f-montant').value, 10) || 0,
      reservationId: r.id,
    });
    UI.closeAll(); render(); UI.toast('Tâche assignée à la réservation');
  });

  /* ---------- Gérer l'équipe : liste, édition en place, suppression ---------- */
  const ROLES = ['Ménage', 'Polyvalent', 'Maintenance'];
  const ICO_EDIT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
  const ICO_DEL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6"/></svg>';
  let editId = null;

  function refreshTeam() {
    renderTeamList();
    F.prest.innerHTML = '<option value="all">Tous les prestataires</option>' +
      PRESTATAIRES.map(p => `<option value="${p.id}">${p.nom}</option>`).join('');
    render();
  }

  function teamRow(p) {
    if (editId === p.id) {
      return `<div class="mn-teamrow is-editing" data-id="${p.id}">
        <div class="mn-teamedit">
          <input class="input" data-f="nom" value="${p.nom}" placeholder="Nom" />
          <select class="select" data-f="role">${ROLES.map(r => `<option ${r === p.role ? 'selected' : ''}>${r}</option>`).join('')}</select>
          <input class="input" data-f="zone" value="${p.zone}" placeholder="Zone" />
          <input class="input" type="number" min="0" data-f="tarif" value="${p.tarifMenage}" placeholder="Tarif €" />
        </div>
        <div class="mn-teamedit__actions">
          <button class="btn btn--secondary btn--sm" data-cancel>Annuler</button>
          <button class="btn btn--primary btn--sm" data-save="${p.id}">Enregistrer</button>
        </div>
      </div>`;
    }
    return `<div class="mn-teamrow" data-id="${p.id}">
      <span class="avatar avatar--sm">${p.nom.split(' ').map(m => m[0]).join('').slice(0, 2)}</span>
      <div class="mn-teamrow__meta"><b>${p.nom}</b><small>${p.role} · ${p.zone} · ${p.tarifMenage ? formatEuro(p.tarifMenage) + ' / ménage' : 'tarif —'}</small></div>
      <button class="icon-btn" data-edit="${p.id}" aria-label="Modifier">${ICO_EDIT}</button>
      <button class="icon-btn icon-btn--danger" data-del="${p.id}" aria-label="Supprimer">${ICO_DEL}</button>
    </div>`;
  }

  function renderTeamList() {
    document.getElementById('mn-team-list').innerHTML = PRESTATAIRES.map(teamRow).join('');
  }

  document.getElementById('mn-team-list').addEventListener('click', e => {
    const ed = e.target.closest('[data-edit]');
    const del = e.target.closest('[data-del]');
    const save = e.target.closest('[data-save]');
    const cancel = e.target.closest('[data-cancel]');
    if (ed) { editId = ed.dataset.edit; renderTeamList(); }
    else if (cancel) { editId = null; renderTeamList(); }
    else if (save) {
      const row = e.target.closest('.mn-teamrow');
      const p = getPrestataire(save.dataset.save);
      const nom = row.querySelector('[data-f="nom"]').value.trim();
      if (!nom) { UI.toast('Le nom est requis', false); return; }
      p.nom = nom;
      p.role = row.querySelector('[data-f="role"]').value;
      p.zone = row.querySelector('[data-f="zone"]').value.trim() || '—';
      p.tarifMenage = parseInt(row.querySelector('[data-f="tarif"]').value, 10) || 0;
      editId = null; refreshTeam(); UI.toast('Prestataire modifié');
    }
    else if (del) {
      if (PRESTATAIRES.length <= 1) { UI.toast('Gardez au moins un prestataire', false); return; }
      const id = del.dataset.del;
      const fallback = PRESTATAIRES.find(p => p.id !== id).id;
      let n = 0;
      TACHES.forEach(t => { if (t.prestataireId === id) { t.prestataireId = fallback; n++; } });
      PRESTATAIRES.splice(PRESTATAIRES.findIndex(p => p.id === id), 1);
      editId = null; refreshTeam();
      UI.toast(n ? `Prestataire supprimé · ${n} tâche(s) réassignée(s)` : 'Prestataire supprimé');
    }
  });

  document.getElementById('mn-team-btn').addEventListener('click', () => { editId = null; renderTeamList(); UI.openPanel('mn-team-modal'); });
  document.getElementById('mn-team-add').addEventListener('click', () => {
    const nom = document.getElementById('mn-t-nom').value.trim();
    if (!nom) { UI.toast('Renseignez le nom', false); return; }
    PRESTATAIRES.push({
      id: 'P' + Date.now(), nom,
      role: document.getElementById('mn-t-role').value,
      zone: document.getElementById('mn-t-zone').value.trim() || '—',
      tel: '+33 6 00 00 00 00',
      tarifMenage: parseInt(document.getElementById('mn-t-tarif').value, 10) || 0,
    });
    document.getElementById('mn-t-nom').value = '';
    refreshTeam(); UI.toast('Prestataire ajouté');
  });

  render();
})();
