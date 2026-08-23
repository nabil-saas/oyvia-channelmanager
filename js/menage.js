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
        ${preuvesHTML(t)}
      </div>
      <div class="mn-task__prest"><select class="select" data-assign="${t.id}">${options}</select></div>
      <div class="mn-task__status"><span class="badge ${STATUT_BADGE[t.statut]} mn-statusbtn" data-status="${t.id}" title="Cliquer pour changer">${STATUT_TXT[t.statut]}</span></div>
      <button class="icon-btn icon-btn--danger" data-del="${t.id}" title="Supprimer cette tâche" aria-label="Supprimer la tâche ${TACHE_LABEL[t.type]} du ${formatDate(t.date)}">
        ${icon('<path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V6"/><path d="M10 11v6M14 11v6"/>')}
      </button>
    </div>`;
  }

  /* ---------- Preuves d'intervention ----------

     Le prestataire photographie ce qu'il a fait depuis son espace ; ces
     photos n'apparaissaient nulle part côté gestion. Une preuve que
     personne ne regarde ne prouve rien — et c'est précisément ce qu'on
     demande à un prestataire de fournir quand un voyageur conteste
     l'état du logement à son arrivée.

     Elles ne s'affichent que sur une tâche TERMINÉE : avant, il n'y a
     rien à constater, et une vignette sur une tâche à faire laisserait
     croire qu'elle est déjà passée. */
  function preuvesHTML(t) {
    const photos = t.photos || [];
    if (t.statut !== 'termine' || !photos.length) return '';
    // Quatre au plus dans la ligne : au-delà, la tâche devient une
    // galerie et le planning cesse de se lire. Le reste se compte.
    const visibles = photos.slice(0, 4);
    const reste = photos.length - visibles.length;
    return `<div class="mn-preuves">
      ${visibles.map((src, i) => `
        <button type="button" class="mn-preuve" data-preuve="${t.id}::${i}"
          title="Photo ${i + 1} de l'intervention — agrandir" aria-label="Agrandir la photo ${i + 1}">
          <img src="${src}" alt="" loading="lazy" />
        </button>`).join('')}
      ${reste > 0 ? `<button type="button" class="mn-preuve mn-preuve--plus" data-preuve="${t.id}::${visibles.length}">+${reste}</button>` : ''}
      <span class="mn-preuves__l">${photos.length} photo${photos.length > 1 ? 's' : ''} du prestataire</span>
    </div>`;
  }

  /* Agrandissement : une vignette de 40 px ne permet pas de vérifier
     qu'un lit est fait. On ouvre donc en grand, avec les flèches pour
     passer d'une photo à l'autre sans refermer. */
  let visionneuse = { photos: [], index: 0 };
  function ouvrirPreuve(taskId, index) {
    const t = TACHES.find(x => x.id === taskId);
    if (!t || !(t.photos || []).length) return;
    visionneuse = { photos: t.photos, index: Math.min(index, t.photos.length - 1), tache: t };
    let el = document.getElementById('mn-visionneuse');
    if (!el) {
      el = document.createElement('div');
      el.id = 'mn-visionneuse';
      el.className = 'modal modal--lg mn-visionneuse';
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-modal', 'true');
      document.body.appendChild(el);
      el.addEventListener('click', e => {
        const nav = e.target.closest('[data-vis]');
        if (!nav) return;
        const n = visionneuse.photos.length;
        visionneuse.index = (visionneuse.index + Number(nav.dataset.vis) + n) % n;
        rendreVisionneuse();
      });
    }
    rendreVisionneuse();
    UI.openPanel('mn-visionneuse');
  }
  function rendreVisionneuse() {
    const { photos, index, tache } = visionneuse;
    const l = getLogement(tache.logementId);
    const p = getPrestataire(tache.prestataireId);
    document.getElementById('mn-visionneuse').innerHTML = `
      <div class="modal__head">
        <div>
          <h3 class="modal__title">${TACHE_LABEL[tache.type] || tache.type} · ${l ? l.nom : ''}</h3>
          <p class="text-soft text-sm">${p ? p.nom : 'Prestataire'} · ${formatDate(tache.date)} · photo ${index + 1} sur ${photos.length}</p>
        </div>
        <button class="icon-btn" onclick="UI.closeAll()" aria-label="Fermer">
          ${icon('<path d="M18 6 6 18M6 6l12 12"/>')}
        </button>
      </div>
      <div class="modal__body mn-visionneuse__corps">
        ${photos.length > 1 ? `<button class="mn-visionneuse__nav" data-vis="-1" aria-label="Photo précédente">${icon('<path d="m15 18-6-6 6-6"/>')}</button>` : ''}
        <img src="${photos[index]}" alt="Photo ${index + 1} de l'intervention" />
        ${photos.length > 1 ? `<button class="mn-visionneuse__nav mn-visionneuse__nav--d" data-vis="1" aria-label="Photo suivante">${icon('<path d="m9 18 6-6-6-6"/>')}</button>` : ''}
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
    const pv = e.target.closest('[data-preuve]');
    if (pv) {
      const [taskId, idx] = pv.dataset.preuve.split('::');
      ouvrirPreuve(taskId, parseInt(idx, 10));
      return;
    }
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

  /* ---------- Ajout d'une tâche ----------
     Le formulaire vit dans js/tache-form.js : le calendrier l'ouvre aussi
     depuis son mode Tâches prestataires. */
  document.getElementById('mn-add').addEventListener('click', () => TacheForm.ouvrir());
  document.addEventListener('tacheChanged', render);

  render();
})();
