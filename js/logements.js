/* ============================================================
   OYVIA — Logements : cartes + fiche détaillée à onglets
   ============================================================ */
Layout.init('logements');

(function () {
  const CH = {
    airbnb: { label: 'Airbnb', letter: 'A', col: 'var(--ch-airbnb)' },
    booking: { label: 'Booking.com', letter: 'B', col: 'var(--ch-booking)' },
    direct: { label: 'Direct', letter: 'D', col: 'var(--ch-direct)' },
  };
  const list = document.getElementById('lg-list');
  const detail = document.getElementById('lg-detail');
  const grid = document.getElementById('lg-grid');
  const content = document.getElementById('lg-detail-content');
  const star = '<svg viewBox="0 0 24 24"><path d="M12 2l3 6.9 7.6.6-5.8 5 1.8 7.4L12 18l-6.4 3.9 1.8-7.4-5.8-5 7.6-.6z"/></svg>';

  /* ---------- Tâches récurrentes ---------- */
  const icon = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  const initiales = n => n.split(' ').map(m => m[0]).slice(0, 2).join('').toUpperCase();
  const ICO_EDIT = '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>';
  const ICO_DEL = '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6"/>';
  const REC_TYPES = {
    menage:      { label: 'Ménage',          icon: '<path d="M12 2.5l1.7 4.3 4.6.3-3.6 2.9 1.2 4.5L12 12l-3.9 2.5 1.2-4.5-3.6-2.9 4.6-.3z"/><path d="M6 21l3-4M18 21l-3-4"/>' },
    accueil:     { label: 'Accueil',          icon: '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="M10 17l5-5-5-5M15 12H3"/>' },
    maintenance: { label: 'Maintenance',      icon: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-2.4z"/>' },
    inspection:  { label: 'Inspection',       icon: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>' },
    linge:       { label: 'Linge',            icon: '<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/>' },
    cles:        { label: 'Remise des clés',  icon: '<circle cx="8" cy="15" r="4"/><path d="M10.8 12.2 20 3M16 5l3 3M19 8l1.5-1.5"/>' },
  };
  const REC_TRIGGERS = {
    checkin:          { label: 'À chaque check-in' },
    checkout:         { label: 'À chaque check-out' },
    j_avant_checkin:  { unit: 'jours avant le check-in',  tpl: n => `${n} jour${n > 1 ? 's' : ''} avant le check-in` },
    h_avant_checkin:  { unit: 'heures avant le check-in', tpl: n => `${n} h avant le check-in` },
    j_apres_checkout: { unit: 'jours après le check-out', tpl: n => `${n} jour${n > 1 ? 's' : ''} après le check-out` },
    quotidien:        { label: 'Tous les jours' },
    hebdo:            { label: 'Toutes les semaines' },
    mensuel:          { label: 'Tous les mois' },
  };
  const triggerLabel = r => { const m = REC_TRIGGERS[r.declencheur]; return m.tpl ? m.tpl(r.delai) : m.label; };
  let currentLgId = null, recEditId = null, recType = 'menage';

  /* ---------- Cartes ---------- */
  function channelsHTML(l) {
    return Object.entries(l.canaux).map(([k, sync]) =>
      `<span class="lg-chan" style="background:${CH[k].col}" title="${CH[k].label} — ${sync === 'ok' ? 'synchronisé' : 'à vérifier'}">${CH[k].letter}<span class="lg-chan__sync lg-chan__sync--${sync}"></span></span>`
    ).join('');
  }
  function renderCards() {
    document.getElementById('lg-count').textContent = `${LOGEMENTS.length} logements connectés`;
    grid.innerHTML = LOGEMENTS.map(l => `
      <article class="lg-card" data-id="${l.id}">
        <div class="lg-card__cover" style="background:${l.couleur}">
          <span class="lg-card__note">${star} ${l.note.toFixed(1)}</span>
        </div>
        <div class="lg-card__body">
          <div class="lg-card__title">${l.nom}</div>
          <div class="lg-card__meta">${l.ville} · ${l.type} · ${l.capacite} voyageurs</div>
          <div class="lg-card__row">
            <div class="lg-card__channels">${channelsHTML(l)}</div>
            <div class="lg-card__price"><b>${formatEuro(l.tarifBase)}</b> <span>/ nuit</span></div>
          </div>
        </div>
      </article>`).join('');
  }
  renderCards();

  grid.addEventListener('click', e => { const c = e.target.closest('.lg-card'); if (c) showDetail(c.dataset.id); });

  /* ---------- Ajout / modification d'un logement ---------- */
  const COULEURS = ['#5170FF', '#00A550', '#F5A300', '#0A3D91', '#8A5A3C', '#9A5A6E', '#3D6E80', '#4A6A58'];
  let editLogementId = null;

  function openLogementModal(id) {
    editLogementId = id || null;
    const l = id ? getLogement(id) : null;
    document.getElementById('lg-f-nom').value = l ? l.nom : '';
    document.getElementById('lg-f-ville').value = l ? l.ville : '';
    document.getElementById('lg-f-type').value = l ? l.type : 'Studio';
    document.getElementById('lg-f-cap').value = l ? l.capacite : 2;
    document.getElementById('lg-f-tarif').value = l ? l.tarifBase : 80;
    document.getElementById('lg-modal-title').textContent = l ? 'Modifier le logement' : 'Ajouter un logement';
    document.getElementById('lg-create').textContent = l ? 'Enregistrer' : 'Créer le logement';
    UI.openPanel('lg-modal');
  }

  document.getElementById('lg-add').addEventListener('click', () => openLogementModal(null));
  document.getElementById('lg-create').addEventListener('click', () => {
    const nom = document.getElementById('lg-f-nom').value.trim();
    const ville = document.getElementById('lg-f-ville').value.trim();
    if (!nom || !ville) { UI.toast('Renseignez au moins le nom et la ville', false); return; }
    const cap = parseInt(document.getElementById('lg-f-cap').value, 10) || 2;
    const tarif = parseInt(document.getElementById('lg-f-tarif').value, 10) || 80;
    const type = document.getElementById('lg-f-type').value;

    if (editLogementId) {
      Object.assign(getLogement(editLogementId), { nom, ville, type, capacite: cap, tarifBase: tarif, menageTarif: Math.round(tarif * 0.4) });
      const id = editLogementId; editLogementId = null;
      UI.closeAll(); renderCards();
      if (!detail.classList.contains('hidden')) showDetail(id);
      UI.toast('Logement modifié');
      return;
    }

    const id = 'L' + String(LOGEMENTS.length + 1).padStart(3, '0') + Date.now().toString().slice(-3);
    LOGEMENTS.push({
      id, nom, ville, quartier: 'Centre-ville', pays: 'France', type, capacite: cap,
      chambres: Math.max(1, Math.round(cap / 2)), lits: Math.max(1, Math.round(cap / 2)), sdb: 1,
      tarifBase: tarif, menageTarif: Math.round(tarif * 0.4), couleur: COULEURS[LOGEMENTS.length % COULEURS.length],
      adresse: `${ville}, France`, note: 5.0, avis: 0,
      canaux: { airbnb: 'ok', booking: 'ok', direct: 'ok' },
      codeAcces: String(Math.floor(1000 + Math.random() * 9000)), wifi: { ssid: 'Oyvia-' + ville, pass: 'bienvenue' + tarif },
      equipements: ['Wifi', 'Cuisine équipée', 'Chauffage'],
    });
    UI.closeAll(); renderCards(); UI.toast('Logement ajouté');
  });

  /* ---------- Détail ---------- */
  function showDetail(id) {
    const l = getLogement(id);
    const resas = getReservationsByLogement(id).filter(r => r.canal !== 'bloque');
    const caLogement = resas.reduce((s, r) => s + r.montant, 0);

    content.innerHTML = `
      <div class="lg-detail__head">
        <div class="lg-detail__thumb" style="background:${l.couleur}">${l.ville.slice(0, 2).toUpperCase()}</div>
        <div class="lg-detail__meta grow">
          <h1>${l.nom}</h1>
          <p>${l.adresse}</p>
          <div class="row gap-2" style="margin-top:8px">
            <span class="badge badge--neutral">${l.type}</span>
            <span class="badge badge--neutral">${l.capacite} voyageurs</span>
            <span class="badge badge--accent">${star.replace('viewBox','style="width:12px;height:12px;fill:currentColor" viewBox')} ${l.note.toFixed(1)} · ${l.avis} avis</span>
          </div>
        </div>
        <button class="btn btn--secondary" id="lg-edit-btn">Modifier</button>
      </div>

      <div class="tabs" id="lg-tabs">
        <button class="is-active" data-tab="infos">Informations</button>
        <button data-tab="tarifs">Tarifs &amp; restrictions</button>
        <button data-tab="canaux">Canaux connectés</button>
        <button data-tab="acces">Infos d'accès</button>
        <button data-tab="recurrentes">Tâches récurrentes</button>
        <button data-tab="photos">Photos</button>
      </div>

      <div class="lg-tabpane is-active" data-pane="infos">
        <div class="app-grid app-grid--2">
          <div class="card card--pad">
            <p class="eyebrow mb-4">Caractéristiques</p>
            <div class="rp-row"><span>Type</span><span>${l.type}</span></div>
            <div class="rp-row"><span>Capacité</span><span>${l.capacite} voyageurs</span></div>
            <div class="rp-row"><span>Chambres</span><span>${l.chambres}</span></div>
            <div class="rp-row"><span>Lits</span><span>${l.lits}</span></div>
            <div class="rp-row"><span>Salles de bain</span><span>${l.sdb}</span></div>
            <div class="rp-row"><span>Ville</span><span>${l.ville} — ${l.quartier}</span></div>
          </div>
          <div class="card card--pad">
            <p class="eyebrow mb-4">Performance</p>
            <div class="rp-row"><span>Réservations (3 mois)</span><span>${resas.length}</span></div>
            <div class="rp-row"><span>Chiffre d'affaires</span><span class="fw-semibold">${formatEuro(caLogement)}</span></div>
            <div class="rp-row"><span>Note moyenne</span><span>${l.note.toFixed(1)} / 5 (${l.avis} avis)</span></div>
            <p class="eyebrow mb-2" style="margin-top:var(--sp-4)">Équipements</p>
            <div class="lg-equip">${l.equipements.map(e => `<span>${e}</span>`).join('')}</div>
          </div>
        </div>
      </div>

      <div class="lg-tabpane" data-pane="tarifs">
        <div class="card card--pad" style="max-width:560px">
          <div class="rp-row"><span>Tarif de base</span><span class="fw-semibold">${formatEuro(l.tarifBase)} / nuit</span></div>
          <div class="rp-row"><span>Forfait ménage</span><span>${formatEuro(l.menageTarif)}</span></div>
          <div class="rp-row"><span>Séjour minimum</span><span>2 nuits</span></div>
          <div class="rp-row"><span>Délai de préavis</span><span>1 jour</span></div>
          <div class="rp-row"><span>Caution</span><span>${formatEuro(l.tarifBase * 3)}</span></div>
          <div class="rp-row"><span>Tarification dynamique</span><span><span class="badge badge--neutral">Désactivée</span></span></div>
        </div>
      </div>

      <div class="lg-tabpane" data-pane="canaux">
        ${Object.entries(l.canaux).map(([k, sync]) => `
          <div class="lg-channelrow">
            <div class="lg-channelrow__ic" style="background:${CH[k].col}">${CH[k].letter}</div>
            <div class="grow"><b>${CH[k].label}</b><br><small class="text-muted">${sync === 'ok' ? 'Synchronisé il y a 4 min' : 'Synchronisation à vérifier'}</small></div>
            <span class="badge ${sync === 'ok' ? 'badge--positive' : 'badge--warning'}">${sync === 'ok' ? 'Connecté' : 'Attention'}</span>
            <label class="switch"><input type="checkbox" checked><span class="switch__track"></span></label>
          </div>`).join('')}
      </div>

      <div class="lg-tabpane" data-pane="acces">
        <div class="card card--pad" style="max-width:480px">
          <p class="eyebrow mb-4">Accès autonome</p>
          <div class="msg-ctx__code"><span class="text-sm text-soft">Code porte</span><b>${l.codeAcces}</b></div>
          <div class="msg-ctx__code"><span class="text-sm text-soft">Réseau Wifi</span><b>${l.wifi.ssid}</b></div>
          <div class="msg-ctx__code"><span class="text-sm text-soft">Mot de passe Wifi</span><b>${l.wifi.pass}</b></div>
          <p class="text-xs text-muted" style="margin-top:var(--sp-3)">Ces informations sont insérées automatiquement dans les messages via les variables {code_acces} et {wifi}.</p>
        </div>
      </div>

      <div class="lg-tabpane" data-pane="recurrentes">
        <div class="rec-head">
          <p class="text-soft text-sm">Ces tâches sont générées automatiquement à chaque réservation (ou selon le rythme choisi) et assignées à un collaborateur.</p>
          <button class="btn btn--primary" id="rec-add">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
            Nouvelle tâche récurrente
          </button>
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Tâche</th><th>Déclencheur</th><th>Collaborateur</th><th>Début</th><th>Fin</th><th>Statut</th><th></th></tr></thead>
            <tbody id="rec-tbody"></tbody>
          </table>
        </div>
      </div>

      <div class="lg-tabpane" data-pane="photos">
        <div class="lg-photos">
          ${Array.from({ length: 6 }, (_, i) => `<div class="lg-photo" style="background:linear-gradient(${135 + i * 30}deg, ${l.couleur}, ${i % 2 ? 'var(--ink-300)' : 'var(--blue-400)'})"></div>`).join('')}
        </div>
      </div>`;

    content.querySelector('#lg-tabs').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      content.querySelectorAll('#lg-tabs button').forEach(x => x.classList.remove('is-active'));
      b.classList.add('is-active');
      content.querySelectorAll('.lg-tabpane').forEach(p => p.classList.toggle('is-active', p.dataset.pane === b.dataset.tab));
    });
    content.querySelector('#lg-edit-btn').addEventListener('click', () => openLogementModal(id));

    currentLgId = id;
    renderRec();
    content.querySelector('#rec-add').addEventListener('click', () => openRecModal(null));
    content.querySelector('#rec-tbody').addEventListener('click', e => {
      const ed = e.target.closest('[data-rec-edit]'); const del = e.target.closest('[data-rec-del]');
      if (ed) openRecModal(ed.dataset.recEdit);
      else if (del) { const i = RECURRENTES.findIndex(x => x.id === del.dataset.recDel); if (i > -1) RECURRENTES.splice(i, 1); renderRec(); UI.toast('Tâche supprimée'); }
    });

    list.classList.add('hidden'); detail.classList.remove('hidden');
    window.scrollTo(0, 0);
  }

  document.getElementById('lg-back').addEventListener('click', () => { detail.classList.add('hidden'); list.classList.remove('hidden'); });

  /* ---------- Rendu du tableau des tâches récurrentes ---------- */
  function renderRec() {
    const tb = document.getElementById('rec-tbody'); if (!tb) return;
    const rows = getRecurrentesByLogement(currentLgId);
    if (!rows.length) {
      tb.innerHTML = `<tr><td colspan="7"><div class="empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
        <h4>Aucune tâche récurrente</h4><p>Automatisez le ménage, l'accueil ou la maintenance de ce logement.</p></div></td></tr>`;
      return;
    }
    tb.innerHTML = rows.map(r => {
      const ty = REC_TYPES[r.type] || REC_TYPES.menage;
      const p = getPrestataire(r.prestataireId);
      return `<tr data-rec="${r.id}">
        <td><div class="rec-task"><span class="rec-ic rec-ic--${r.type}">${icon(ty.icon)}</span>
          <div class="rec-task__meta"><b>${r.nom}</b><small>${r.description || ''}</small></div></div></td>
        <td class="text-soft">${triggerLabel(r)}</td>
        <td>${p ? `<div class="row gap-2"><span class="avatar avatar--sm">${initiales(p.nom)}</span>${p.nom}</div>` : '—'}</td>
        <td class="text-soft">${r.dateDebut ? formatDate(r.dateDebut, { annee: true }) : '—'}</td>
        <td class="text-soft">${r.dateFin ? formatDate(r.dateFin, { annee: true }) : '<span class="text-muted">—</span>'}</td>
        <td><span class="badge ${r.actif ? 'badge--positive' : 'badge--neutral'}">${r.actif ? 'Active' : 'Désactivée'}</span></td>
        <td><div class="rec-actions">
          <button class="icon-btn" data-rec-edit="${r.id}" aria-label="Modifier">${icon(ICO_EDIT)}</button>
          <button class="icon-btn icon-btn--danger" data-rec-del="${r.id}" aria-label="Supprimer">${icon(ICO_DEL)}</button>
        </div></td>
      </tr>`;
    }).join('');
  }

  /* ---------- Modale de création / édition ---------- */
  const recTrigger = document.getElementById('rec-f-trigger');
  const recNofin = document.getElementById('rec-f-nofin');
  const recActive = document.getElementById('rec-f-active');

  function buildTypePicker() {
    document.getElementById('rec-f-typepicker').innerHTML = Object.entries(REC_TYPES).map(([k, v]) =>
      `<button type="button" class="rec-typechip ${k === recType ? 'is-active' : ''}" data-type="${k}">${icon(v.icon)} ${v.label}</button>`).join('');
  }
  function updateDelai() {
    const m = REC_TRIGGERS[recTrigger.value];
    document.getElementById('rec-f-delai-wrap').classList.toggle('hidden', !m.unit);
    if (m.unit) document.getElementById('rec-f-delai-unit').textContent = m.unit;
  }

  function openRecModal(recId) {
    recEditId = recId || null;
    const r = recId ? RECURRENTES.find(x => x.id === recId) : null;
    recType = r ? r.type : 'menage';
    buildTypePicker();
    document.getElementById('rec-f-nom').value = r ? r.nom : '';
    document.getElementById('rec-f-desc').value = r ? (r.description || '') : '';
    recTrigger.value = r ? r.declencheur : 'checkout';
    document.getElementById('rec-f-delai').value = r && r.delai ? r.delai : 2;
    updateDelai();
    document.getElementById('rec-f-prest').innerHTML = PRESTATAIRES.map(p => `<option value="${p.id}">${p.nom} · ${p.role}</option>`).join('');
    document.getElementById('rec-f-prest').value = r ? r.prestataireId : PRESTATAIRES[0].id;
    document.getElementById('rec-f-start').value = r ? r.dateDebut : '2026-01-01';
    const nofin = r ? !r.dateFin : false;
    recNofin.checked = nofin;
    document.getElementById('rec-f-end').value = r && r.dateFin ? r.dateFin : '2026-12-31';
    document.getElementById('rec-f-end').disabled = nofin;
    recActive.checked = r ? r.actif : true;
    document.getElementById('rec-f-active-label').textContent = recActive.checked ? 'Active' : 'Désactivée';
    document.getElementById('rec-modal-title').textContent = recId ? 'Modifier la tâche récurrente' : 'Nouvelle tâche récurrente';
    document.getElementById('rec-save').textContent = recId ? 'Enregistrer' : 'Créer la tâche';
    UI.openPanel('rec-modal');
  }

  document.getElementById('rec-f-typepicker').addEventListener('click', e => {
    const c = e.target.closest('[data-type]'); if (!c) return;
    recType = c.dataset.type;
    document.querySelectorAll('#rec-f-typepicker .rec-typechip').forEach(x => x.classList.toggle('is-active', x.dataset.type === recType));
  });
  recTrigger.addEventListener('change', updateDelai);
  recNofin.addEventListener('change', () => { document.getElementById('rec-f-end').disabled = recNofin.checked; });
  recActive.addEventListener('change', () => { document.getElementById('rec-f-active-label').textContent = recActive.checked ? 'Active' : 'Désactivée'; });

  document.getElementById('rec-save').addEventListener('click', () => {
    const nom = document.getElementById('rec-f-nom').value.trim();
    if (!nom) { UI.toast('Renseignez le nom de la tâche', false); return; }
    const trigger = recTrigger.value;
    const needsDelai = !!REC_TRIGGERS[trigger].unit;
    const data = {
      logementId: currentLgId, nom, type: recType,
      description: document.getElementById('rec-f-desc').value.trim(),
      declencheur: trigger, delai: needsDelai ? (parseInt(document.getElementById('rec-f-delai').value, 10) || 1) : null,
      prestataireId: document.getElementById('rec-f-prest').value,
      dateDebut: document.getElementById('rec-f-start').value || null,
      dateFin: recNofin.checked ? null : (document.getElementById('rec-f-end').value || null),
      actif: recActive.checked,
    };
    if (recEditId) Object.assign(RECURRENTES.find(x => x.id === recEditId), data);
    else RECURRENTES.push({ id: 'RC' + Date.now(), ...data });
    UI.closeAll(); renderRec(); UI.toast(recEditId ? 'Tâche modifiée' : 'Tâche récurrente créée');
  });
})();
