/* ============================================================
   OYVIA — Équipe : prestataires, ajout/édition/suppression
   (le planning des tâches ménage est sur menage.html)
   ============================================================ */
Layout.init('equipe');

(function () {
  const ROLES = ['Ménage', 'Polyvalent', 'Maintenance'];
  const ICO_EDIT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
  const ICO_DEL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6"/></svg>';
  let editId = null;

  /* ---------- Liste des prestataires : édition en place, suppression ---------- */
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
    document.getElementById('eq-team-list').innerHTML = PRESTATAIRES.map(teamRow).join('');
  }

  function renderAll() { renderTeamList(); }

  document.getElementById('eq-team-list').addEventListener('click', e => {
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
      editId = null; renderAll(); UI.toast('Prestataire modifié');
    }
    else if (del) {
      if (PRESTATAIRES.length <= 1) { UI.toast('Gardez au moins un prestataire', false); return; }
      const id = del.dataset.del;
      const fallback = PRESTATAIRES.find(p => p.id !== id).id;
      let n = 0;
      TACHES.forEach(t => { if (t.prestataireId === id) { t.prestataireId = fallback; n++; } });
      PRESTATAIRES.splice(PRESTATAIRES.findIndex(p => p.id === id), 1);
      editId = null; renderAll();
      UI.toast(n ? `Prestataire supprimé · ${n} tâche(s) réassignée(s)` : 'Prestataire supprimé');
    }
  });

  document.getElementById('eq-add-btn').addEventListener('click', () => { UI.openPanel('eq-add-modal'); });
  document.getElementById('eq-add-confirm').addEventListener('click', () => {
    const nom = document.getElementById('eq-t-nom').value.trim();
    if (!nom) { UI.toast('Renseignez le nom', false); return; }
    PRESTATAIRES.push({
      id: 'P' + Date.now(), nom,
      role: document.getElementById('eq-t-role').value,
      zone: document.getElementById('eq-t-zone').value.trim() || '—',
      tel: '+33 6 00 00 00 00',
      tarifMenage: parseInt(document.getElementById('eq-t-tarif').value, 10) || 0,
    });
    document.getElementById('eq-t-nom').value = '';
    UI.closeAll(); renderAll(); UI.toast('Prestataire ajouté');
  });

  renderAll();
})();
