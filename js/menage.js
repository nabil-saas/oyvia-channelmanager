/* ============================================================
   OYVIA — Gestion des tâches : planning + assignation
   (la gestion de l'équipe de prestataires est sur equipe.html)
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

  /* ---------- Planning groupé par jour ---------- */
  // Une tâche issue d'un blocage multi-jours (dateFin renseignée) apparaît dans le
  // groupe de CHAQUE jour qu'elle couvre (pas seulement son jour de début), pour que
  // le planning d'une journée donnée reflète fidèlement qui est sur place ce jour-là.
  // C'est toujours la même tâche (même id) : changer son statut/prestataire un jour
  // le change partout, puisque render() régénère tout à partir des mêmes objets.
  function render() {
    const list = TACHES.filter(t => {
      const fin = t.dateFin || t.date;
      if (parseDate(fin) < parseDate(AUJOURDHUI)) return false; // on masque les tâches entièrement passées
      if (F.prest.value !== 'all' && t.prestataireId !== F.prest.value) return false;
      if (F.type.value !== 'all' && t.type !== F.type.value) return false;
      if (F.statut.value !== 'all' && t.statut !== F.statut.value) return false;
      return true;
    });

    const byDay = {};
    list.forEach(t => {
      const fin = (t.dateFin && parseDate(t.dateFin) > parseDate(t.date)) ? t.dateFin : t.date;
      let d = parseDate(t.date) < parseDate(AUJOURDHUI) ? AUJOURDHUI : t.date; // on n'affiche pas les jours déjà passés
      while (parseDate(d) <= parseDate(fin)) {
        (byDay[d] = byDay[d] || []).push({ task: t, isStart: d === t.date });
        d = addDays(d, 1);
      }
    });

    const days = Object.keys(byDay).sort();
    const html = days.map(date => {
      const isToday = date === AUJOURDHUI;
      const entries = byDay[date].sort((a, b) => a.task.heure.localeCompare(b.task.heure));
      const rows = entries.map(e => taskRow(e.task, e.isStart)).join('');
      return `<div class="mn-daygroup">
        <div class="mn-dayhead ${isToday ? 'mn-dayhead--today' : ''}">
          <h3>${formatDate(date, { jourSemaine: true, moisLong: true })}</h3>
          ${isToday ? '<span class="badge badge--accent">Aujourd\'hui</span>' : ''}
          <span class="badge badge--neutral">${entries.length} tâche${entries.length > 1 ? 's' : ''}</span>
        </div>
        <div class="mn-tasks">${rows}</div>
      </div>`;
    }).join('') || '<div class="empty"><h4>Aucune tâche</h4><p>Ajustez les filtres.</p></div>';

    document.getElementById('mn-planning').innerHTML = html;
  }

  // Une tâche déduite d'un message par Vivi doit être identifiable, et
  // ramener au message d'origine : c'est là qu'est le contexte (« il y a
  // des cheveux dans la douche »), pas dans la ligne de planning.
  function origineTag(t) {
    if (t.origine !== 'vivi') return '';
    const href = t.origineConversation ? `messagerie.html?conv=${t.origineConversation}` : 'messagerie.html';
    return ` <a class="mn-task__vivi" href="${href}" title="Créée par Vivi à partir d'un message du voyageur — voir la conversation">✦ Vivi</a>`;
  }

  function taskRow(t, isStart) {
    const l = getLogement(t.logementId);
    const options = PRESTATAIRES.map(p => `<option value="${p.id}" ${p.id === t.prestataireId ? 'selected' : ''}>${p.nom}</option>`).join('');
    const isMultiDay = t.dateFin && t.dateFin !== t.date;

    const timeCell = isStart
      ? `<span class="mn-task__time">${t.heure}</span>`
      : `<span class="mn-task__time mn-task__time--continuation" title="Suite d'une tâche débutée le ${formatDate(t.date)}">${icon('<path d="M4 4v7a4 4 0 0 0 4 4h12"/><path d="m16 10 5 5-5 5"/>')}</span>`;
    const spanBadge = isStart && isMultiDay
      ? `<span class="badge badge--neutral mn-task__span">→ ${formatDate(t.dateFin)} · ${nuitsEntre(t.date, t.dateFin) + 1} jours</span>`
      : '';
    const continuationTag = !isStart ? `<span class="mn-task__continuation-tag">(suite)</span>` : '';

    return `<div class="mn-task ${t.statut === 'termine' ? 'is-done' : ''} ${!isStart ? 'mn-task--continuation' : ''}" data-id="${t.id}">
      ${timeCell}
      <span class="mn-task__ic mn-task__ic--${t.type}">${icon(TYPE_IC[t.type] || 'M12 2 2 7v10l10 5 10-5V7z')}</span>
      <div class="mn-task__meta">
        <b>${TACHE_LABEL[t.type]} · ${l.nom} ${continuationTag}${origineTag(t)}</b>
        <small>${l.ville}${t.note ? ' · ' + t.note : ''}</small>
        ${spanBadge}
      </div>
      <div class="mn-task__prest"><select class="select" data-assign="${t.id}">${options}</select></div>
      <span class="mn-task__amount">${t.montant ? formatMontant(t.montant) : '—'}</span>
      <div class="mn-task__status"><span class="badge ${STATUT_BADGE[t.statut]} mn-statusbtn" data-status="${t.id}" title="Cliquer pour changer">${STATUT_TXT[t.statut]}</span></div>
      <button class="icon-btn icon-btn--danger" data-del="${t.id}" title="Supprimer cette tâche" aria-label="Supprimer la tâche ${TACHE_LABEL[t.type]} du ${formatDate(t.date)}">
        ${icon('<path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V6"/><path d="M10 11v6M14 11v6"/>')}
      </button>
    </div>`;
  }

  /* ---------- Interactions ---------- */
  const planning = document.getElementById('mn-planning');
  planning.addEventListener('change', e => {
    const s = e.target.closest('[data-assign]'); if (s) {
      const t = TACHES.find(x => x.id === s.dataset.assign);
      t.prestataireId = s.value; UI.toast('Prestataire assigné');
    }
  });
  planning.addEventListener('click', e => {
    const b = e.target.closest('[data-status]'); if (b) {
      const t = TACHES.find(x => x.id === b.dataset.status);
      t.statut = NEXT[t.statut]; render();
      return;
    }

    const del = e.target.closest('[data-del]');
    if (del) {
      const t = TACHES.find(x => x.id === del.dataset.del);
      if (!t) return;
      const l = getLogement(t.logementId);
      const p = PRESTATAIRES.find(x => x.id === t.prestataireId);

      // Deux conséquences valent d'être annoncées : le prestataire perd la
      // ligne de son planning, et une tâche née d'un signalement de Vivi
      // fait revenir la proposition (le besoin du voyageur, lui, demeure).
      const extra = [
        p ? `${p.nom} ne la verra plus dans son planning.` : '',
        t.origine === 'vivi' ? `Elle vient d'un message de voyageur : Vivi vous la reproposera dans la conversation.` : '',
      ].filter(Boolean).join('\n');

      UI.confirm({
        title: 'Supprimer cette tâche ?',
        message: `${TACHE_LABEL[t.type] || t.type} · ${l ? l.nom : ''} · ${formatDate(t.date)} à ${t.heure}.${extra ? '\n\n' + extra : ''}`,
        confirmText: 'Supprimer',
        cancelText: 'Annuler',
        danger: true,
        onConfirm() {
          supprimerTache(t.id);
          render();
          UI.toast('Tâche supprimée');
        },
      });
    }
  });
  Object.values(F).forEach(el => el.addEventListener('change', render));

  /* ---------- Ajout d'une tâche : on part du LOGEMENT, la réservation n'est qu'une info dérivée ---------- */
  const logementSel = document.getElementById('mn-f-logement');
  const typeSel = document.getElementById('mn-f-type');
  const dateField = document.getElementById('mn-f-date');
  const newtypeWrap = document.getElementById('mn-f-newtype-wrap');

  // Réservation en cours pour ce logement (aujourd'hui compris dans le séjour) ;
  // à défaut, la prochaine réservation à venir.
  function reservationPourLogement(logementId) {
    const resas = RESERVATIONS.filter(r => r.logementId === logementId && r.canal !== 'bloque');
    const enCours = resas.find(r => parseDate(r.arrivee) <= parseDate(AUJOURDHUI) && parseDate(r.depart) >= parseDate(AUJOURDHUI));
    if (enCours) return { r: enCours, enCours: true };
    const aVenir = resas.filter(r => parseDate(r.arrivee) >= parseDate(AUJOURDHUI))
      .sort((a, b) => parseDate(a.arrivee) - parseDate(b.arrivee))[0];
    return aVenir ? { r: aVenir, enCours: false } : null;
  }

  function updateDerived() {
    const box = document.getElementById('mn-f-derived');
    const found = reservationPourLogement(logementSel.value);
    if (!found) {
      box.innerHTML = `Aucune réservation en cours ou à venir pour ce logement.`;
      if (!dateField.value) dateField.value = AUJOURDHUI;
      return;
    }
    const { r, enCours } = found;
    box.innerHTML = `${enCours ? 'Réservation en cours' : 'Prochaine réservation'} : <b>${r.voyageur}</b> · ${formatPlage(r.arrivee, r.depart)}.`;
    dateField.value = typeSel.value === 'checkin' ? r.arrivee : r.depart;
  }

  function fillTaskModal() {
    logementSel.innerHTML = LOGEMENTS.map(l => `<option value="${l.id}">${l.nom} — ${l.ville}</option>`).join('');
    typeSel.innerHTML = Object.entries(TACHE_LABEL).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')
      + '<option value="__new">＋ Nouvelle catégorie…</option>';
    document.getElementById('mn-f-prest').innerHTML = PRESTATAIRES.map(p => `<option value="${p.id}">${p.nom}</option>`).join('');
    newtypeWrap.classList.add('hidden');
    dateField.value = '';
    document.getElementById('mn-f-heure').value = '11:00';
    updateDerived();
  }
  /* ---------- Dates planifiables pour une intervention ----------
     Ici la frontière n'est pas la même que pour une réservation, et c'est
     volontaire :

     · IMPOSSIBLE — planifier dans le passé. Rien d'autre : une équipe peut
       enchaîner plusieurs logements dans la journée, et un ménage de
       mi-séjour se fait justement pendant l'occupation. Griser ces cas
       interdirait des situations parfaitement légitimes.

     · SIGNALÉ — le voyageur est sur place, c'est un jour d'arrivée ou de
       départ, ou le prestataire a déjà des interventions ce jour-là. On
       donne l'information, la décision reste à vous. */
  const prestSel = document.getElementById('mn-f-prest');
  DatePicker.attach(dateField, () => ({
    min: AUJOURDHUI,
    indispo: d => d < AUJOURDHUI ? 'Date passée' : null,
    note: d => {
      const bouts = [];
      const occ = occupationLogement(logementSel.value, d);
      if (occ) bouts.push(occ);
      const charge = chargePrestataire(prestSel.value, d);
      if (charge.length) {
        const p = PRESTATAIRES.find(x => x.id === prestSel.value);
        bouts.push(`${p ? p.nom : 'Le prestataire'} : ${charge.length} intervention${charge.length > 1 ? 's' : ''} déjà prévue${charge.length > 1 ? 's' : ''}`);
      }
      return bouts.length ? bouts.join(' · ') : null;
    },
    legende: [{ classe: 'off', texte: 'Passé' }, { classe: 'note', texte: 'Voyageur sur place ou prestataire chargé' }],
  }));

  logementSel.addEventListener('change', updateDerived);
  typeSel.addEventListener('change', () => { newtypeWrap.classList.toggle('hidden', typeSel.value !== '__new'); updateDerived(); });
  document.getElementById('mn-add').addEventListener('click', () => { fillTaskModal(); UI.openPanel('mn-modal'); });
  document.getElementById('mn-create').addEventListener('click', () => {
    const logementId = logementSel.value;
    if (!logementId) { UI.toast('Sélectionnez un logement', false); return; }
    if (!dateField.value) { UI.toast('Choisissez une date', false); return; }
    let type = typeSel.value;
    if (type === '__new') {
      const label = document.getElementById('mn-f-newtype').value.trim();
      if (!label) { UI.toast('Nommez la nouvelle catégorie', false); return; }
      type = 'c' + Date.now().toString().slice(-6);
      TACHE_LABEL[type] = label;
    }
    const found = reservationPourLogement(logementId);
    TACHES.push({
      id: 'T' + Date.now(), type,
      logementId,
      date: dateField.value,
      heure: document.getElementById('mn-f-heure').value || '11:00',
      prestataireId: document.getElementById('mn-f-prest').value,
      statut: 'a_faire',
      montant: 0,
      reservationId: found ? found.r.id : null,
    });
    UI.closeAll(); render(); UI.toast('Tâche créée');
  });

  render();
})();
