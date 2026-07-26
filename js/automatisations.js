/* ============================================================
   OYVIA — Automatisations : liste + éditeur de modèle
   ============================================================ */
Layout.init('automatisations');

(function () {
  const VARS = ['{prenom}', '{date_arrivee}', '{code_acces}', '{wifi}', '{nom_logement}', '{adresse}'];
  const TRIGGER_IC = {
    reservation: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
    j_moins_1: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    jour_arrivee: '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="M10 17l5-5-5-5M15 12H3"/>',
    jour_depart: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>',
    j_plus_1: '<path d="M12 2l3 6.9 7.6.6-5.8 5 1.8 7.4L12 18l-6.4 3.9 1.8-7.4-5.8-5 7.6-.6z"/>',
    j_plus_3: '<path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/>',
  };
  const listView = document.getElementById('auto-list-view');
  const editView = document.getElementById('auto-edit-view');
  const listEl = document.getElementById('auto-list');
  const editEl = document.getElementById('auto-edit-content');
  const icon = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;

  function renderList() {
    listEl.innerHTML = AUTOMATISATIONS.map(a => `
      <div class="auto-item ${a.actif ? '' : 'is-off'}">
        <div class="auto-item__ic">${icon(TRIGGER_IC[a.declencheur])}</div>
        <div class="auto-item__meta">
          <b>${a.nom}</b>
          <div class="auto-item__sub">
            <span class="badge badge--neutral">${DECLENCHEUR_LABEL[a.declencheur]}</span>
            <span>Langue ${a.langue}</span> · <span>${a.canaux}</span> ·
            <span>${a.logements === 'tous' ? 'Tous les logements' : 'Sélection de logements'}</span> ·
            <span>${a.envoyes} envoyés</span>
          </div>
        </div>
        <div class="auto-item__actions">
          <span class="badge ${a.actif ? 'badge--positive' : 'badge--neutral'}">${a.actif ? 'Actif' : 'Inactif'}</span>
          <label class="switch" title="Activer/désactiver"><input type="checkbox" ${a.actif ? 'checked' : ''} data-toggle="${a.id}"><span class="switch__track"></span></label>
          <button class="btn btn--secondary btn--sm" data-edit="${a.id}">Modifier</button>
        </div>
      </div>`).join('');
  }

  function sample(text) {
    const l = LOGEMENTS[0];
    return text.replace(/{prenom}/g, 'Sophie').replace(/{date_arrivee}/g, '24 juil.')
      .replace(/{code_acces}/g, l.codeAcces).replace(/{wifi}/g, `${l.wifi.ssid} / ${l.wifi.pass}`)
      .replace(/{nom_logement}/g, l.nom).replace(/{adresse}/g, l.adresse);
  }

  function showEdit(id) {
    const a = AUTOMATISATIONS.find(x => x.id === id);
    editEl.innerHTML = `
      <div class="app-pagehead"><div><h1>${a.nom}</h1><p>Modifiez le déclencheur et le contenu du message.</p></div>
        <div class="app-pagehead__actions">
          <label class="row gap-2 text-sm fw-medium">Automatisation active <span class="switch"><input type="checkbox" id="auto-active" ${a.actif ? 'checked' : ''}><span class="switch__track"></span></span></label>
        </div>
      </div>
      <div class="app-grid app-grid--2-1">
        <div class="card card--pad">
          <div class="app-grid app-grid--2" style="margin-bottom:var(--sp-4)">
            <div class="field"><label class="field__label">Déclencheur</label>
              <select class="select" id="auto-trig">${Object.keys(DECLENCHEUR_LABEL).map(k => `<option value="${k}" ${k === a.declencheur ? 'selected' : ''}>${DECLENCHEUR_LABEL[k]}</option>`).join('')}</select></div>
            <div class="field"><label class="field__label">Langue</label>
              <select class="select"><option ${a.langue === 'FR' ? 'selected' : ''}>FR</option><option ${a.langue === 'EN' ? 'selected' : ''}>EN</option><option>ES</option><option>DE</option></select></div>
          </div>
          <div class="field"><label class="field__label">Logements concernés</label>
            <select class="select"><option ${a.logements === 'tous' ? 'selected' : ''}>Tous les logements</option><option ${a.logements !== 'tous' ? 'selected' : ''}>Sélection de logements</option></select></div>
          <div class="field" style="margin-top:var(--sp-4)"><label class="field__label">Message</label>
            <textarea class="textarea" id="auto-model" rows="7">${a.modele}</textarea></div>
          <p class="field__hint" style="margin-top:var(--sp-3)">Variables disponibles — cliquez pour insérer :</p>
          <div class="auto-vars" style="margin-top:var(--sp-2)">${VARS.map(v => `<span class="auto-var" data-var="${v}">${v}</span>`).join('')}</div>
          <div class="row gap-2" style="margin-top:var(--sp-5)">
            <button class="btn btn--primary" id="auto-save">Enregistrer</button>
            <button class="btn btn--secondary" id="auto-cancel">Annuler</button>
          </div>
        </div>
        <div class="card card--pad">
          <p class="eyebrow mb-4">Aperçu</p>
          <div class="auto-preview" id="auto-prev">${sample(a.modele)}</div>
          <p class="field__hint" style="margin-top:var(--sp-3)">Exemple avec un séjour de démonstration au ${LOGEMENTS[0].nom}.</p>
        </div>
      </div>`;

    const ta = editEl.querySelector('#auto-model');
    const prev = editEl.querySelector('#auto-prev');
    const refresh = () => { prev.textContent = sample(ta.value); };
    ta.addEventListener('input', refresh);
    editEl.querySelectorAll('.auto-var').forEach(v => v.addEventListener('click', () => {
      const pos = ta.selectionStart;
      ta.value = ta.value.slice(0, pos) + v.dataset.var + ta.value.slice(ta.selectionEnd);
      ta.focus(); refresh();
    }));
    editEl.querySelector('#auto-save').addEventListener('click', () => {
      a.modele = ta.value; a.actif = editEl.querySelector('#auto-active').checked;
      a.declencheur = editEl.querySelector('#auto-trig').value;
      backToList(); UI.toast('Automatisation enregistrée');
    });
    editEl.querySelector('#auto-cancel').addEventListener('click', backToList);

    listView.classList.add('hidden'); editView.classList.remove('hidden'); window.scrollTo(0, 0);
  }

  function backToList() { editView.classList.add('hidden'); listView.classList.remove('hidden'); renderList(); }

  listEl.addEventListener('click', e => {
    const edit = e.target.closest('[data-edit]'); if (edit) { showEdit(edit.dataset.edit); return; }
  });
  listEl.addEventListener('change', e => {
    const t = e.target.closest('[data-toggle]'); if (t) {
      const a = AUTOMATISATIONS.find(x => x.id === t.dataset.toggle);
      a.actif = t.checked; UI.toast(a.actif ? 'Automatisation activée' : 'Automatisation désactivée');
      renderList();
    }
  });
  document.getElementById('auto-back').addEventListener('click', backToList);

  // Créer une nouvelle automatisation → ouvre l'éditeur
  document.getElementById('auto-new').addEventListener('click', () => {
    const a = {
      id: 'A' + Date.now(), nom: 'Nouvelle automatisation', declencheur: 'jour_arrivee',
      actif: false, langue: 'FR', canaux: 'Tous', logements: 'tous', envoyes: 0,
      modele: 'Bonjour {prenom}, ',
    };
    AUTOMATISATIONS.push(a);
    showEdit(a.id);
  });

  renderList();
})();
