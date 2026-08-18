/* ============================================================
   OYVIA — Équipe : prestataires, ajout/édition/suppression
   (le planning des tâches ménage est sur menage.html)
   ============================================================ */
Layout.init('equipe');

(function () {
  // Les métiers viennent de ROLES_PRESTATAIRE (data.js) : la liste est
  // ouverte, un gestionnaire peut créer « Jardinage » ou « Piscine ».
  const noms = () => ROLES_PRESTATAIRE.map(r => r.nom);
  const ICO_EDIT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
  const ICO_DEL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6"/></svg>';
  let editId = null;

  /* ---------- Liste des prestataires : édition en place, suppression ---------- */
  function teamRow(p) {
    if (editId === p.id) {
      return `<div class="mn-teamrow is-editing" data-id="${p.id}">
        <div class="mn-teamedit">
          <input class="input" data-f="nom" value="${p.nom}" placeholder="Nom" />
          <select class="select" data-f="role">${noms().map(r => `<option ${r === p.role ? 'selected' : ''}>${r}</option>`).join('')}</select>
          <input class="input" data-f="zone" value="${p.zone}" placeholder="Zone" />
        </div>
        <div class="mn-teamedit__actions">
          <button class="btn btn--secondary btn--sm" data-cancel>Annuler</button>
          <button class="btn btn--primary btn--sm" data-save="${p.id}">Enregistrer</button>
        </div>
      </div>`;
    }
    const s = statsPrestataire(p.id);
    return `<div class="mn-teamrow" data-id="${p.id}">
      <span class="avatar avatar--sm">${p.nom.split(' ').map(m => m[0]).join('').slice(0, 2)}</span>
      <div class="mn-teamrow__meta"><b>${p.nom}</b><small>${p.role} · ${p.zone}</small></div>
      <div class="eq-charge" title="${s.total} tâche${s.total > 1 ? 's' : ''} assignée${s.total > 1 ? 's' : ''} au total">
        <b>${s.effectuees}</b>
        <span>tâche${s.effectuees > 1 ? 's' : ''} effectuée${s.effectuees > 1 ? 's' : ''}</span>
        ${s.restantes ? `<em>${s.restantes} en cours</em>` : ''}
      </div>
      <button class="icon-btn" data-edit="${p.id}" aria-label="Modifier">${ICO_EDIT}</button>
      <button class="icon-btn icon-btn--danger" data-del="${p.id}" aria-label="Supprimer">${ICO_DEL}</button>
    </div>`;
  }

  function renderTeamList() {
    document.getElementById('eq-team-list').innerHTML = PRESTATAIRES.map(teamRow).join('');
  }

  /* ---------- Les métiers ----------
     Un rôle encore exercé ne se supprime pas : les fiches des prestataires
     concernés pointeraient vers un métier inexistant, et leur select
     retomberait silencieusement sur la première valeur de la liste. */
  function renderRoles() {
    const zone = document.getElementById('eq-roles');
    if (!zone) return;
    zone.innerHTML = ROLES_PRESTATAIRE.map(r => {
      const n = effectifRole(r.nom);
      return `<div class="eq-role">
        <div class="grow"><b>${r.nom}</b><small>${n ? `${n} prestataire${n > 1 ? 's' : ''}` : 'Personne pour l\'instant'}</small></div>
        ${r.systeme
          ? '<span class="text-xs text-muted" title="Utilisé par l\'affectation automatique des tâches">Rôle système</span>'
          : `<button class="icon-btn icon-btn--danger" data-role-del="${r.nom}" aria-label="Supprimer le rôle">${ICO_DEL}</button>`}
      </div>`;
    }).join('');
  }

  function renderAll() { renderTeamList(); renderRoles(); }

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

  /* Création d'un métier. Le nom sert de clé (les prestataires stockent le
     libellé), donc les doublons sont refusés — deux « Ménage » rendraient
     l'affectation ambiguë. */
  document.getElementById('eq-role-add').addEventListener('click', () => {
    const champ = document.getElementById('eq-role-nom');
    const nom = champ.value.trim();
    if (!nom) { UI.toast('Indiquez le nom du rôle', false); return; }
    if (getRolePrestataire(nom)) { UI.toast('Ce rôle existe déjà', false); return; }
    ROLES_PRESTATAIRE.push({ id: nom.toLowerCase().replace(/[^a-z0-9]+/g, '_'), nom, systeme: false });
    champ.value = '';
    saveOyviaState(); renderAll();
    UI.toast(`Rôle « ${nom} » créé`);
  });

  document.getElementById('eq-roles').addEventListener('click', e => {
    const b = e.target.closest('[data-role-del]');
    if (!b) return;
    const nom = b.dataset.roleDel;
    if (effectifRole(nom)) {
      UI.toast(`${effectifRole(nom)} prestataire(s) occupent ce rôle — réaffectez-les d'abord`, false);
      return;
    }
    const i = ROLES_PRESTATAIRE.findIndex(r => r.nom === nom);
    if (i > -1) ROLES_PRESTATAIRE.splice(i, 1);
    saveOyviaState(); renderAll();
    UI.toast(`Rôle « ${nom} » supprimé`);
  });

  document.getElementById('eq-add-btn').addEventListener('click', () => {
    document.getElementById('eq-t-role').innerHTML = noms().map(r => `<option>${r}</option>`).join('');
    UI.openPanel('eq-add-modal');
  });
  document.getElementById('eq-add-confirm').addEventListener('click', () => {
    const nom = document.getElementById('eq-t-nom').value.trim();
    if (!nom) { UI.toast('Renseignez le nom', false); return; }
    PRESTATAIRES.push({
      id: 'P' + Date.now(), nom,
      role: document.getElementById('eq-t-role').value,
      zone: document.getElementById('eq-t-zone').value.trim() || '—',
      tel: '+33 6 00 00 00 00',
    });
    document.getElementById('eq-t-nom').value = '';
    UI.closeAll(); renderAll(); UI.toast('Prestataire ajouté');
  });

  renderAll();
})();
