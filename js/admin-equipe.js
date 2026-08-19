/* ============================================================
   OYVIA interne — Équipe & journal

   Cette page est la seule qui touche à la structure du back-office
   lui-même : qui a accès, jusqu'où, et ce qui a été fait.

   Deux risques spécifiques à garder en tête dans toute la page :

   — Un membre ne peut pas se suspendre ni se supprimer lui-même.
     Un retrait accidentel des propres droits de la personne connectée
     la verrouillerait dehors sans qu'elle puisse corriger l'erreur.

   — On ne peut jamais rétirer le dernier membre actif ayant la permission
     'equipe'. Si tous ceux qui peuvent gérer l'équipe disparaissent,
     personne ne peut rendre l'accès à quiconque : la page serait
     inaccessible pour toujours, sans aucun moyen de récupérer la
     situation sans intervention en base de données. C'est le verrou
     implicite du système — l'interface doit le rendre explicite.
   ============================================================ */
if (AdminLayout.init('equipe')) { /* accès refusé */ } else {
(function () {

  const F = id => document.getElementById(id);
  const ic = Adm.ic;

  /* Vrai si le membre connecté peut gérer l'équipe. Sans ce droit,
     la page reste visible (lecture seule) mais sans aucun bouton d'action :
     voir qui fait quoi est différent de pouvoir le changer. */
  const peutGererEquipe = peutAdmin('equipe');

  /* Clé du rôle en cours d'édition dans la modale rôle. null = création. */
  let roleEditId = null;
  /* Identifiant du membre ouvert dans le panneau latéral. */
  let membreEditId = null;

  /* ================================================================
     ONGLETS — navigation par hash
     ================================================================ */

  const ONGLETS = ['membres', 'roles', 'journal'];

  function ongletActif() {
    const h = location.hash.replace('#', '');
    return ONGLETS.includes(h) ? h : 'membres';
  }

  function activerOnglet(nom) {
    history.replaceState(null, '', '#' + nom);

    F('eq-tabs').querySelectorAll('[data-onglet]').forEach(btn => {
      const actif = btn.dataset.onglet === nom;
      btn.classList.toggle('is-active', actif);
      btn.setAttribute('aria-selected', String(actif));
    });

    ONGLETS.forEach(o => {
      const pane = F('eq-pane-' + o);
      if (pane) pane.classList.toggle('is-active', o === nom);
    });

    renderActionsPagehead(nom);

    // Chaque onglet se rend à la demande pour ne pas calculer trois fois
    // au chargement ce dont l'utilisateur ne regarde peut-être qu'un seul.
    if (nom === 'membres')  renderMembres();
    if (nom === 'roles')    renderRoles();
    if (nom === 'journal')  renderJournal();
  }

  /* Les boutons d'en-tête varient selon l'onglet actif : « Inviter » n'a
     de sens que sur Membres, « Nouveau rôle » que sur Rôles. */
  function renderActionsPagehead(onglet) {
    const el = F('eq-pagehead-actions');
    if (!el) return;
    if (!peutGererEquipe) { el.innerHTML = ''; return; }

    if (onglet === 'membres') {
      el.innerHTML = `<button class="btn btn--primary" id="eq-btn-inviter">
        ${ic('<path d="M12 5v14M5 12h14"/>')} Inviter un membre
      </button>`;
      F('eq-btn-inviter').addEventListener('click', ouvrirModaleInviter);

    } else if (onglet === 'roles') {
      el.innerHTML = `<button class="btn btn--primary" id="eq-btn-nouveau-role">
        ${ic('<path d="M12 5v14M5 12h14"/>')} Nouveau rôle
      </button>`;
      F('eq-btn-nouveau-role').addEventListener('click', () => ouvrirModaleRole(null));

    } else if (onglet === 'journal') {
      el.innerHTML = `<button class="btn btn--secondary" id="eq-btn-export">
        ${ic('<path d="M12 3v12"/><path d="m7 12 5 5 5-5"/><path d="M5 21h14"/>')} Exporter
      </button>`;
      F('eq-btn-export').addEventListener('click', exporterJournal);

    } else {
      el.innerHTML = '';
    }
  }

  /* ================================================================
     SECTION 1 — MEMBRES
     ================================================================ */

  /* Nombre de membres actifs qui possèdent la permission 'equipe'.
     Cette vérification traverse les rôles : un membre avec le rôle
     'direction' hérite de toutes les permissions, dont 'equipe'. */
  function gardiensDeLEquipe() {
    return MEMBRES_OYVIA.filter(m => {
      if (m.statut !== 'actif') return false;
      return getRoleAdmin(m.roleId).permissions.includes('equipe');
    });
  }

  function estDernierGardien(membreId) {
    const gardiens = gardiensDeLEquipe();
    return gardiens.length === 1 && gardiens[0].id === membreId;
  }

  function renderKpisMembres() {
    const actifs = MEMBRES_OYVIA.filter(m => m.statut === 'actif');
    const tousAcces = MEMBRES_OYVIA.filter(m => m.dernierAcces)
      .sort((a, b) => b.dernierAcces.localeCompare(a.dernierAcces));
    const recent = tousAcces[0];

    F('eq-kpis').innerHTML = [
      Adm.kpi({
        label: 'Membres actifs',
        valeur: actifs.length,
        pied: `${MEMBRES_OYVIA.length - actifs.length} suspendu${MEMBRES_OYVIA.length - actifs.length > 1 ? 's' : ''}`,
        icone: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
      }),
      Adm.kpi({
        label: 'Rôles définis',
        valeur: ROLES_ADMIN.length,
        pied: `${ROLES_ADMIN.filter(r => r.systeme).length} système${ROLES_ADMIN.filter(r => r.systeme).length > 1 ? 's' : ''} · ${ROLES_ADMIN.filter(r => !r.systeme).length} personnalisé${ROLES_ADMIN.filter(r => !r.systeme).length > 1 ? 's' : ''}`,
        icone: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18"/>',
      }),
      Adm.kpi({
        label: 'Dernière connexion',
        valeur: recent ? recent.nom : '—',
        pied: recent ? formatDate(recent.dernierAcces, { annee: true }) : '',
        icone: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
        ton: 'positive',
      }),
    ].join('');
  }

  const filtresMembres = { q: '' };

  function membresFiltres() {
    const q = filtresMembres.q.trim().toLowerCase();
    if (!q) return MEMBRES_OYVIA;
    return MEMBRES_OYVIA.filter(m =>
      [m.nom, m.email, getRoleAdmin(m.roleId).nom].join(' ').toLowerCase().includes(q)
    );
  }

  const STATUTS_MEMBRE = {
    actif:    { label: 'Actif',    badge: 'badge--positive' },
    suspendu: { label: 'Suspendu', badge: 'badge--neutral' },
  };

  function renderTableMembres() {
    const liste = membresFiltres();
    const moi = membreCourant();
    F('eq-compteur').textContent = `${liste.length} membre${liste.length > 1 ? 's' : ''} sur ${MEMBRES_OYVIA.length}`;

    F('eq-tbody').innerHTML = liste.length ? liste.map(m => {
      const role = getRoleAdmin(m.roleId);
      const estMoi = m.id === moi.id;

      const btnModifier = peutGererEquipe
        ? `<button class="btn btn--ghost btn--sm" data-action="modifier" data-id="${m.id}">Modifier</button>`
        : '';

      const btnSuspendre = peutGererEquipe && m.statut === 'actif'
        ? `<button class="btn btn--ghost btn--sm" data-action="suspendre" data-id="${m.id}">Suspendre</button>`
        : '';

      const btnReactiver = peutGererEquipe && m.statut === 'suspendu'
        ? `<button class="btn btn--ghost btn--sm" data-action="reactiver" data-id="${m.id}">Réactiver</button>`
        : '';

      const btnSupprimer = peutGererEquipe
        ? `<button class="btn btn--ghost btn--sm icon-btn--danger" data-action="supprimer" data-id="${m.id}" aria-label="Supprimer ${m.nom}">${ic('<path d="M3 6h18"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>')}</button>`
        : '';

      return `<tr>
        <td>
          <div style="display:flex;align-items:center;gap:var(--sp-3)">
            <span class="avatar avatar--sm">${m.initiales}</span>
            <div>
              <b>${m.nom}${estMoi ? ' <span class="badge badge--accent" style="font-size:10px">Vous</span>' : ''}</b>
              <div class="text-xs text-muted">${m.email}</div>
            </div>
          </div>
        </td>
        <td>${role.nom}</td>
        <td>${Adm.badge(STATUTS_MEMBRE, m.statut)}</td>
        <td class="text-xs text-muted">${m.dernierAcces ? formatDate(m.dernierAcces, { annee: true }) : '—'}</td>
        <td style="text-align:right">
          <div class="adm-actions" style="justify-content:flex-end">
            ${btnModifier}
            ${btnSuspendre}
            ${btnReactiver}
            ${btnSupprimer}
          </div>
        </td>
      </tr>`;
    }).join('') : `<tr><td colspan="5">${Adm.vide('Aucun membre', 'Aucun membre ne correspond à cette recherche.')}</td></tr>`;
  }

  function renderMembres() {
    renderKpisMembres();
    renderTableMembres();
  }

  /* ---- Actions membres ---- */

  function suspendreOuReactiverMembre(id, suspendre) {
    const m = getMembre(id);
    if (!m) return;

    // Garde-fou 1 : on ne se suspend pas soi-même.
    if (m.id === membreCourant().id) {
      return UI.toast('Vous ne pouvez pas modifier votre propre statut', false);
    }

    // Garde-fou 2 : si on suspend le dernier gardien de l'équipe, plus personne
    // ne pourra jamais accéder à cette page ni rendre les accès.
    if (suspendre && estDernierGardien(id)) {
      return UI.toast('Impossible : ce membre est le seul à pouvoir gérer l\'équipe. Attribuez d\'abord la permission « Équipe » à quelqu\'un d\'autre.', false);
    }

    m.statut = suspendre ? 'suspendu' : 'actif';
    journaliser(
      suspendre ? 'Membre suspendu' : 'Membre réactivé',
      m.nom,
      suspendre ? 'Accès au back-office révoqué.' : 'Accès au back-office rétabli.'
    );
    saveOyviaState();
    UI.toast(suspendre ? `${m.nom} suspendu` : `${m.nom} réactivé`);
    renderMembres();
    AdminLayout.refreshBadges();
  }

  function supprimerMembre(id) {
    const m = getMembre(id);
    if (!m) return;

    // Garde-fou 1 : on ne se supprime pas soi-même.
    if (m.id === membreCourant().id) {
      return UI.toast('Vous ne pouvez pas supprimer votre propre compte', false);
    }

    // Garde-fou 2 : supprimer le dernier gardien de l'équipe rendrait la page
    // définitivement inaccessible — voir le commentaire en tête de fichier.
    if (estDernierGardien(id)) {
      return UI.toast('Impossible : ce membre est le seul à pouvoir gérer l\'équipe. Attribuez d\'abord la permission « Équipe » à quelqu\'un d\'autre.', false);
    }

    UI.confirm({
      title: 'Supprimer ce membre ?',
      message: `${m.nom} (${m.email}) perdra tout accès au back-office. Cette action est irréversible.`,
      confirmText: 'Supprimer',
      danger: true,
      onConfirm: () => {
        journaliser('Membre supprimé', m.nom, `${getRoleAdmin(m.roleId).nom} — ${m.email}.`);
        supprimerEntite('MEMBRES_OYVIA', id);
        UI.toast(`${m.nom} supprimé`);
        renderMembres();
        AdminLayout.refreshBadges();
      },
    });
  }

  /* Délégation sur le corps du tableau : le rendu le remplace à chaque filtre,
     poser un écouteur par ligne ne survivrait pas au premier re-rendu. */
  F('eq-tbody').addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;
    if (action === 'modifier')  ouvrirPanneauMembre(id);
    if (action === 'suspendre') suspendreOuReactiverMembre(id, true);
    if (action === 'reactiver') suspendreOuReactiverMembre(id, false);
    if (action === 'supprimer') supprimerMembre(id);
  });

  F('eq-q').addEventListener('input', e => {
    filtresMembres.q = e.target.value;
    renderTableMembres();
  });

  /* ---- Panneau modification membre ---- */

  function ouvrirPanneauMembre(id) {
    const m = getMembre(id);
    if (!m) return;
    membreEditId = id;
    const role = getRoleAdmin(m.roleId);

    F('eq-panel-membre-titre').textContent = m.nom;

    F('eq-panel-membre-corps').innerHTML = `
      <div style="display:flex;align-items:center;gap:var(--sp-4);margin-bottom:var(--sp-6)">
        <span class="avatar" style="width:48px;height:48px;font-size:var(--fs-md)">${m.initiales}</span>
        <div>
          <b>${m.nom}</b>
          <div class="text-sm text-muted">${m.email}</div>
        </div>
      </div>

      <div class="field">
        <label class="field__label" for="eq-pm-role">Rôle</label>
        <select class="select" id="eq-pm-role">
          ${ROLES_ADMIN.map(r => `<option value="${r.id}" ${r.id === m.roleId ? 'selected' : ''}>${r.nom}</option>`).join('')}
        </select>
      </div>

      <p class="eyebrow mt-5 mb-2">Permissions du rôle</p>
      <div id="eq-pm-perms-lecture" class="adm-perm" style="--roles:1">
        <div></div>
        <div class="adm-perm__tete">${role.nom}</div>
        ${renderLignesPermMatrix([role])}
      </div>
    `;

    /* Mise à jour de la prévisualisation des permissions quand on change
       le rôle dans la liste, avant même d'enregistrer. */
    F('eq-pm-role').addEventListener('change', e => {
      const r = getRoleAdmin(e.target.value);
      const container = F('eq-pm-perms-lecture');
      if (!container) return;
      container.innerHTML = `
        <div></div>
        <div class="adm-perm__tete">${r.nom}</div>
        ${renderLignesPermMatrix([r])}
      `;
    });

    F('eq-panel-membre-pied').innerHTML = `
      <div class="adm-actions">
        <button class="btn btn--secondary" onclick="UI.closeAll()">Annuler</button>
        <button class="btn btn--primary" id="eq-pm-save">Enregistrer</button>
      </div>
    `;

    F('eq-pm-save').addEventListener('click', () => {
      const m2 = getMembre(membreEditId);
      if (!m2) return;
      const ancienRoleId = m2.roleId;
      const nouveauRoleId = F('eq-pm-role').value;

      // Garde-fou 2 : rétrograder le dernier gardien de l'équipe vers un rôle
      // sans 'equipe' laisserait personne pour gérer cette page.
      if (
        ancienRoleId !== nouveauRoleId &&
        estDernierGardien(membreEditId) &&
        !getRoleAdmin(nouveauRoleId).permissions.includes('equipe')
      ) {
        return UI.toast('Impossible : ce membre est le seul à pouvoir gérer l\'équipe. Attribuez d\'abord la permission « Équipe » à quelqu\'un d\'autre.', false);
      }

      const ancienNom = getRoleAdmin(ancienRoleId).nom;
      const nouveauNom = getRoleAdmin(nouveauRoleId).nom;
      m2.roleId = nouveauRoleId;

      journaliser(
        'Rôle modifié',
        m2.nom,
        ancienRoleId !== nouveauRoleId ? `${ancienNom} → ${nouveauNom}.` : 'Fiche mise à jour sans changement de rôle.'
      );
      saveOyviaState();
      UI.closeAll();
      UI.toast(`${m2.nom} mis à jour`);
      renderMembres();
    });

    UI.openPanel('eq-panel-membre');
  }

  /* ---- Modale d'invitation ---- */

  function ouvrirModaleInviter() {
    F('eq-f-nom').value = '';
    F('eq-f-email').value = '';
    F('eq-f-role').innerHTML = ROLES_ADMIN.map(r =>
      `<option value="${r.id}">${r.nom}</option>`
    ).join('');
    UI.openPanel('eq-modal-inviter');
  }

  F('eq-inviter-save').addEventListener('click', () => {
    const nom = F('eq-f-nom').value.trim();
    const email = F('eq-f-email').value.trim();
    const roleId = F('eq-f-role').value;

    if (!nom)   return UI.toast('Indiquez le nom du membre', false);
    if (!email) return UI.toast('Indiquez un e-mail', false);

    const nouveau = {
      id:           prochainId('M', MEMBRES_OYVIA),
      nom,
      initiales:    Adm.initiales(nom),
      email,
      roleId,
      statut:       'actif',
      dernierAcces: AUJOURDHUI,
    };
    MEMBRES_OYVIA.push(nouveau);
    journaliser('Membre invité', nom, `Rôle : ${getRoleAdmin(roleId).nom} — ${email}.`);
    saveOyviaState();
    UI.closeAll();
    UI.toast(`${nom} invité`);
    renderMembres();
    AdminLayout.refreshBadges();
  });

  /* ================================================================
     SECTION 2 — RÔLES & PERMISSIONS
     ================================================================ */

  /* Construit les lignes de la matrice pour un sous-ensemble de rôles.
     Réutilisé aussi dans le panneau « modifier un membre » pour une
     colonne unique en lecture. */
  function renderLignesPermMatrix(roles) {
    const IC_OUI = ic('<polyline points="20 6 9 17 4 12"/>');
    const IC_NON = ic('<path d="M18 6 6 18M6 6l12 12"/>');

    let html = '';
    let derniereGroupe = null;

    PERMISSIONS_ADMIN.forEach(p => {
      if (p.groupe !== derniereGroupe) {
        derniereGroupe = p.groupe;
        html += `<div class="adm-perm__groupe">${p.groupe}</div>`;
      }
      html += `<div class="adm-perm__lib">
        <b>${p.label}</b>
        ${p.aide ? `<small>${p.aide}</small>` : ''}
      </div>`;
      roles.forEach(r => {
        const aPerm = r.permissions.includes(p.id);
        html += `<div class="adm-perm__case ${aPerm ? 'is-oui' : 'is-non'}">${aPerm ? IC_OUI : IC_NON}</div>`;
      });
    });
    return html;
  }

  function renderRoles() {
    /* ---- Cartes par rôle ---- */
    F('eq-roles-cartes').innerHTML = ROLES_ADMIN.map(r => {
      const nb = effectifRoleAdmin(r.id);
      const nbPerms = r.permissions.length;
      const peutModifier = peutGererEquipe && !r.systeme;
      const peutSupprimer = peutGererEquipe && !r.systeme && nb === 0;

      return `<div class="card card--pad">
        <div class="row-between mb-2">
          <b style="font-size:var(--fs-lg)">${r.nom}</b>
          ${r.systeme ? '<span class="badge badge--neutral">Système</span>' : ''}
        </div>
        <p class="text-sm text-soft mb-4">${r.desc}</p>
        <div class="row-between text-xs text-muted mb-4">
          <span>${nb} membre${nb > 1 ? 's' : ''}</span>
          <span>${nbPerms} permission${nbPerms > 1 ? 's' : ''}</span>
        </div>
        ${peutModifier || peutSupprimer ? `
          <div class="adm-actions">
            ${peutModifier ? `<button class="btn btn--secondary btn--sm" data-role-action="modifier" data-role-id="${r.id}">Modifier</button>` : ''}
            ${peutSupprimer ? `<button class="btn btn--danger btn--sm" data-role-action="supprimer" data-role-id="${r.id}">Supprimer</button>` : ''}
          </div>` : ''}
        ${r.systeme && peutGererEquipe ? `<p class="text-xs text-muted mt-2">Les rôles système ne peuvent pas être supprimés ni vidés de leurs permissions.</p>` : ''}
      </div>`;
    }).join('');

    /* ---- Matrice permissions × rôles ---- */
    F('eq-perm-matrice').innerHTML = `
      <div class="adm-perm" style="--roles:${ROLES_ADMIN.length}">
        <div></div>
        ${ROLES_ADMIN.map(r => `<div class="adm-perm__tete">${r.nom}</div>`).join('')}
        ${renderLignesPermMatrix(ROLES_ADMIN)}
      </div>
    `;

  }

  /* Délégation posée une seule fois, en dehors de renderRoles, pour ne
     pas accumuler des listeners à chaque re-rendu des cartes. */
  F('eq-roles-cartes').addEventListener('click', e => {
    const btn = e.target.closest('[data-role-action]');
    if (!btn) return;
    const { roleAction, roleId } = btn.dataset;
    if (roleAction === 'modifier')  ouvrirModaleRole(roleId);
    if (roleAction === 'supprimer') supprimerRole(roleId);
  });

  /* ---- Modale rôle ---- */

  function ouvrirModaleRole(id) {
    roleEditId = id;
    const r = id ? ROLES_ADMIN.find(x => x.id === id) : null;

    F('eq-modal-role-titre').textContent = r ? r.nom : 'Nouveau rôle';
    F('eq-r-nom').value  = r ? r.nom : '';
    F('eq-r-desc').value = r ? r.desc : '';

    /* Cases à cocher groupées par groupe de permission */
    let html = '';
    let derniereGroupe = null;
    PERMISSIONS_ADMIN.forEach(p => {
      if (p.groupe !== derniereGroupe) {
        derniereGroupe = p.groupe;
        html += `<p class="text-xs text-muted" style="margin:var(--sp-4) 0 var(--sp-2);font-weight:var(--fw-bold);text-transform:uppercase;letter-spacing:var(--tracking-wider)">${p.groupe}</p>`;
      }
      const coche = r && r.permissions.includes(p.id);
      html += `<label style="display:flex;align-items:flex-start;gap:var(--sp-3);padding:var(--sp-2) 0;cursor:pointer">
        <input type="checkbox" name="perm" value="${p.id}" ${coche ? 'checked' : ''} style="margin-top:3px;flex-shrink:0" />
        <span>
          <b style="font-size:var(--fs-sm)">${p.label}</b>
          ${p.aide ? `<br><span class="text-xs text-muted">${p.aide}</span>` : ''}
        </span>
      </label>`;
    });
    F('eq-r-perms').innerHTML = html;

    UI.openPanel('eq-modal-role');
  }

  F('eq-role-save').addEventListener('click', () => {
    const nom = F('eq-r-nom').value.trim();
    if (!nom) return UI.toast('Indiquez un nom de rôle', false);

    const permsChoisies = Array.from(F('eq-r-perms').querySelectorAll('input[type=checkbox]:checked'))
      .map(cb => cb.value);
    if (!permsChoisies.length) return UI.toast('Choisissez au moins une permission', false);

    if (roleEditId) {
      const r = ROLES_ADMIN.find(x => x.id === roleEditId);
      if (!r) return;
      r.nom  = nom;
      r.desc = F('eq-r-desc').value.trim();
      r.permissions = permsChoisies;
      journaliser('Rôle modifié', nom, `${permsChoisies.length} permission(s) attribuées.`);
      UI.toast(`Rôle « ${nom} » mis à jour`);
    } else {
      const nouveau = {
        id:          nom.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
        nom,
        desc:        F('eq-r-desc').value.trim(),
        systeme:     false,
        permissions: permsChoisies,
      };
      /* Si l'id généré entre en collision avec un existant, on le rend unique. */
      if (ROLES_ADMIN.find(x => x.id === nouveau.id)) {
        nouveau.id += '-' + Date.now().toString(36);
      }
      ROLES_ADMIN.push(nouveau);
      journaliser('Rôle créé', nom, `${permsChoisies.length} permission(s) attribuées.`);
      UI.toast(`Rôle « ${nom} » créé`);
    }

    saveOyviaState();
    UI.closeAll();
    renderRoles();
  });

  function supprimerRole(id) {
    const r = ROLES_ADMIN.find(x => x.id === id);
    if (!r) return;

    UI.confirm({
      title: `Supprimer le rôle « ${r.nom} » ?`,
      message: 'Ce rôle n\'est attribué à aucun membre. La suppression est définitive.',
      confirmText: 'Supprimer',
      danger: true,
      onConfirm: () => {
        const idx = ROLES_ADMIN.findIndex(x => x.id === id);
        if (idx >= 0) ROLES_ADMIN.splice(idx, 1);
        journaliser('Rôle supprimé', r.nom, 'Rôle non-système sans membre attribué.');
        saveOyviaState();
        UI.toast(`Rôle « ${r.nom} » supprimé`);
        renderRoles();
      },
    });
  }

  /* ================================================================
     SECTION 3 — JOURNAL D'AUDIT
     ================================================================ */

  const filtresJournal = { q: '', auteurId: '' };
  const LIMITE_AFFICHAGE = 60;

  function journalFiltre() {
    const q = filtresJournal.q.trim().toLowerCase();
    return JOURNAL_ADMIN.filter(e => {
      if (filtresJournal.auteurId && e.auteurId !== filtresJournal.auteurId) return false;
      if (!q) return true;
      return [e.action, e.cible, e.detail, nomMembre(e.auteurId)].join(' ').toLowerCase().includes(q);
    });
  }

  function renderJournal() {
    /* Options du sélecteur d'auteurs : membres qui ont au moins une entrée. */
    const auteursSeen = [...new Set(JOURNAL_ADMIN.map(e => e.auteurId))];
    const selectAuteur = F('eq-jauteur');
    /* Conserver la valeur sélectionnée si elle existe encore. */
    const valeurActuelle = selectAuteur.value;
    selectAuteur.innerHTML = '<option value="">Tous les auteurs</option>' +
      auteursSeen.map(id => {
        const nom = nomMembre(id);
        return `<option value="${id}" ${id === valeurActuelle ? 'selected' : ''}>${nom}</option>`;
      }).join('');

    const liste = journalFiltre();
    const affichees = liste.slice(0, LIMITE_AFFICHAGE);
    const tronquee = liste.length > LIMITE_AFFICHAGE;

    F('eq-jcompteur').textContent = tronquee
      ? `${liste.length} entrées (${LIMITE_AFFICHAGE} affichées)`
      : `${liste.length} entrée${liste.length > 1 ? 's' : ''}`;

    const troncature = F('eq-journal-troncature');
    if (troncature) troncature.hidden = !tronquee;

    F('eq-journal-fil').innerHTML = affichees.length ? affichees.map(e => {
      const auteur = getMembre(e.auteurId);
      const initiales = auteur ? auteur.initiales : '?';
      return `<div class="adm-fil__pt">
        <div class="adm-fil__date" style="display:flex;align-items:center;gap:var(--sp-2)">
          <span class="avatar avatar--sm">${initiales}</span>
          <span>${nomMembre(e.auteurId)} · ${formatHorodatage(e.le)}</span>
        </div>
        <div class="adm-fil__txt mt-1">
          <b>${e.action}</b>${e.cible ? ' — ' + e.cible : ''}
        </div>
        ${e.detail ? `<div class="text-xs text-muted mt-1">${e.detail}</div>` : ''}
      </div>`;
    }).join('') : Adm.vide('Aucune entrée', 'Aucune entrée ne correspond à ces filtres.');
  }

  F('eq-jq').addEventListener('input', e => {
    filtresJournal.q = e.target.value;
    renderJournal();
  });

  F('eq-jauteur').addEventListener('change', e => {
    filtresJournal.auteurId = e.target.value;
    renderJournal();
  });

  function exporterJournal() {
    const liste = journalFiltre();
    UI.exportCSV('oyvia-journal.csv',
      ['Date', 'Heure', 'Auteur', 'Action', 'Cible', 'Détail'],
      liste.map(e => {
        const [jour, heure] = (e.le || '').split(' ');
        return [
          jour || e.le || '',
          heure || '',
          nomMembre(e.auteurId),
          e.action,
          e.cible,
          e.detail,
        ];
      })
    );
    UI.toast(`${liste.length} entrée${liste.length > 1 ? 's' : ''} exportée${liste.length > 1 ? 's' : ''}`);
  }

  /* ================================================================
     CÂBLAGE INITIAL
     ================================================================ */

  F('eq-tabs').addEventListener('click', e => {
    const btn = e.target.closest('[data-onglet]');
    if (btn) activerOnglet(btn.dataset.onglet);
  });

  /* L'onglet résolu depuis l'URL : la vue d'ensemble pointe sur #journal,
     d'autres liens peuvent pointer sur #membres ou #roles. */
  activerOnglet(ongletActif());

})();
}
