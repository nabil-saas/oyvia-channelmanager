/* ============================================================
   OYVIA — Alertes : les règles de surveillance de l'hôte

   Le parti pris : Oyvia ne décide pas de ce qui mérite une alerte.
   Un studio en ville et un chalet de montagne n'ont ni la même
   saisonnalité ni les mêmes seuils critiques. L'hôte déclare donc
   SES seuils, et le produit se contente de les surveiller.

   Deux chemins d'entrée volontairement : quatre raccourcis calibrés
   pour démarrer en un clic, et un formulaire complet pour le reste.
   Les deux produisent la même chose — une règle ordinaire, modifiable.
   ============================================================ */
Layout.init('alertes');

(function () {
  const ic = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  const ICO_EDIT = '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>';
  const ICO_DEL  = '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6"/>';

  let editId = null;

  const F = {
    nom: document.getElementById('al-f-nom'),
    condition: document.getElementById('al-f-condition'),
    seuil: document.getElementById('al-f-seuil'),
    logement: document.getElementById('al-f-logement'),
    cloche: document.getElementById('al-f-cloche'),
    email: document.getElementById('al-f-email'),
    aide: document.getElementById('al-f-aide'),
    unite: document.getElementById('al-f-unite'),
  };

  /* ---------- Raccourcis ----------
     Une règle déjà posée ne se repropose pas : le raccourci se grise plutôt
     que de disparaître, pour que l'hôte voie qu'elle est déjà couverte. */
  function renderRapides() {
    document.getElementById('al-rapides').innerHTML = ALERTES_RAPIDES.map(r => {
      const deja = ALERTES.some(a => a.condition === r.condition && a.seuil === r.seuil && !a.logementId);
      return `<button type="button" class="al-rapide ${deja ? 'is-off' : ''}" data-rapide="${r.condition}|${r.seuil}" ${deja ? 'disabled' : ''}>
        ${ic(deja ? '<path d="M20 6 9 17l-5-5"/>' : '<path d="M12 5v14M5 12h14"/>')}
        <span>${r.nom}</span>
        ${deja ? '<em>déjà active</em>' : ''}
      </button>`;
    }).join('');
  }

  /* ---------- Liste des règles ---------- */
  function renderListe() {
    const zone = document.getElementById('al-liste');
    if (!ALERTES.length) {
      zone.innerHTML = `<div class="empty">
        ${ic('<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>')}
        <h4>Aucune règle</h4>
        <p>Ajoutez une règle pour être prévenu sans avoir à surveiller vos écrans.</p>
      </div>`;
      return;
    }
    zone.innerHTML = ALERTES.map(a => {
      const c = getConditionAlerte(a.condition);
      const portee = a.logementId ? (getLogement(a.logementId) || {}).nom : 'Tout le parc';
      const canaux = a.canaux.map(x => x === 'email'
        ? '<span class="al-canaltag">E-mail</span>'
        : '<span class="al-canaltag">Notification</span>').join('');
      return `<div class="al-regle ${a.actif ? '' : 'is-off'}" data-id="${a.id}">
        <div class="al-regle__meta grow">
          <b>${a.nom}</b>
          <small>${c ? c.label : a.condition} · seuil ${a.seuil} ${c ? c.unite : ''} · ${portee}</small>
          <div class="al-regle__tags">${canaux}
            ${a.derniereAlerte
              ? `<span class="al-canaltag al-canaltag--muted">Dernière alerte ${formatDate(a.derniereAlerte.slice(0, 10))}</span>`
              : '<span class="al-canaltag al-canaltag--muted">Jamais déclenchée</span>'}</div>
        </div>
        <label class="switch" title="${a.actif ? 'Désactiver' : 'Activer'}">
          <input type="checkbox" data-toggle="${a.id}" ${a.actif ? 'checked' : ''}><span class="switch__track"></span>
        </label>
        <button class="icon-btn" data-edit="${a.id}" aria-label="Modifier">${ic(ICO_EDIT)}</button>
        <button class="icon-btn icon-btn--danger" data-del="${a.id}" aria-label="Supprimer">${ic(ICO_DEL)}</button>
      </div>`;
    }).join('');
  }

  function render() { renderRapides(); renderListe(); }

  /* ---------- Formulaire ---------- */
  F.condition.innerHTML = ALERTES_CONDITIONS.map(c => `<option value="${c.id}">${c.label}</option>`).join('');
  F.logement.innerHTML = '<option value="">Tout le parc</option>'
    + LOGEMENTS.map(l => `<option value="${l.id}">${l.nom}</option>`).join('');
  document.getElementById('al-f-email-adresse').textContent = UTILISATEUR.email;

  // L'unité et l'aide dépendent de la condition : afficher « Seuil » sans
  // préciser s'il s'agit d'heures ou de pourcents rendrait la saisie devinette.
  function majCondition() {
    const c = getConditionAlerte(F.condition.value);
    if (!c) return;
    F.unite.textContent = c.unite ? `(${c.unite})` : '';
    F.aide.textContent = c.aide;
    if (!editId) F.seuil.value = c.defaut;
  }
  F.condition.addEventListener('change', majCondition);

  function ouvrir(id) {
    editId = id || null;
    const a = id ? ALERTES.find(x => x.id === id) : null;
    F.nom.value = a ? a.nom : '';
    F.condition.value = a ? a.condition : ALERTES_CONDITIONS[0].id;
    majCondition();
    if (a) F.seuil.value = a.seuil;
    F.logement.value = a && a.logementId ? a.logementId : '';
    F.cloche.checked = a ? a.canaux.includes('cloche') : true;
    F.email.checked = a ? a.canaux.includes('email') : false;
    document.getElementById('al-modal-title').textContent = a ? 'Modifier la règle' : 'Nouvelle règle personnalisée';
    document.getElementById('al-save').textContent = a ? 'Enregistrer' : 'Créer la règle';
    UI.openPanel('al-modal');
  }

  document.getElementById('al-add').addEventListener('click', () => ouvrir(null));

  document.getElementById('al-save').addEventListener('click', () => {
    const seuil = Number(F.seuil.value);
    if (!isFinite(seuil) || seuil < 0) { UI.toast('Indiquez un seuil valide', false); return; }
    const canaux = [];
    if (F.cloche.checked) canaux.push('cloche');
    if (F.email.checked) canaux.push('email');
    // Une règle sans canal ne préviendrait personne : elle serait active à
    // l'écran mais silencieuse, ce qui est le pire des deux mondes.
    if (!canaux.length) { UI.toast('Choisissez au moins un moyen d\'être prévenu', false); return; }

    const c = getConditionAlerte(F.condition.value);
    const nom = F.nom.value.trim() || `${c.label} · ${seuil} ${c.unite}`;
    const data = { nom, condition: F.condition.value, seuil, logementId: F.logement.value || null, canaux };

    if (editId) Object.assign(ALERTES.find(x => x.id === editId), data);
    else ALERTES.push({ id: 'AL' + Date.now(), ...data, actif: true, derniereAlerte: null });

    saveOyviaState(); UI.closeAll(); render();
    UI.toast(editId ? 'Règle modifiée' : 'Règle créée — la surveillance démarre');
  });

  /* ---------- Interactions ---------- */
  document.getElementById('al-rapides').addEventListener('click', e => {
    const b = e.target.closest('[data-rapide]');
    if (!b) return;
    const [condition, seuil] = b.dataset.rapide.split('|');
    const modele = ALERTES_RAPIDES.find(r => r.condition === condition && String(r.seuil) === seuil);
    ALERTES.push({
      id: 'AL' + Date.now(), nom: modele.nom, condition, seuil: Number(seuil),
      logementId: null, canaux: ['cloche', 'email'], actif: true, derniereAlerte: null,
    });
    saveOyviaState(); render();
    UI.toast(`« ${modele.nom} » ajoutée`);
  });

  document.getElementById('al-liste').addEventListener('click', e => {
    const ed = e.target.closest('[data-edit]');
    const del = e.target.closest('[data-del]');
    if (ed) { ouvrir(ed.dataset.edit); return; }
    if (del) {
      const a = ALERTES.find(x => x.id === del.dataset.del);
      UI.confirm({
        title: 'Supprimer cette règle ?',
        message: `« ${a.nom} » ne sera plus surveillée. Vous pourrez la recréer à tout moment.`,
        confirmText: 'Supprimer', danger: true,
        onConfirm: () => {
          const i = ALERTES.findIndex(x => x.id === del.dataset.del);
          if (i > -1) ALERTES.splice(i, 1);
          saveOyviaState(); render(); UI.toast('Règle supprimée');
        },
      });
    }
  });

  document.getElementById('al-liste').addEventListener('change', e => {
    const t = e.target.closest('[data-toggle]');
    if (!t) return;
    const a = ALERTES.find(x => x.id === t.dataset.toggle);
    a.actif = t.checked;
    saveOyviaState(); renderListe();
    UI.toast(a.actif ? 'Règle activée' : 'Règle désactivée');
  });

  render();
})();
