/* ============================================================
   OYVIA — Paramètres : profil, mot de passe, plateformes connectées
   ============================================================ */
Layout.init('parametres');

(function () {
  /* ---------- Onglets ---------- */
  const tabs = document.getElementById('pf-tabs');
  const panes = [...document.querySelectorAll('.tabpane')];
  tabs.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    tabs.querySelectorAll('button').forEach(x => x.classList.remove('is-active'));
    b.classList.add('is-active');
    panes.forEach(p => p.classList.toggle('is-active', p.dataset.pane === b.dataset.tab));
  });

  /* ---------- Rafraîchit le nom/les initiales affichés dans la sidebar et la topbar ---------- */
  function refreshIdentityUI() {
    document.querySelectorAll('.app-userchip__meta b').forEach(el => { el.textContent = UTILISATEUR.nom; });
    const topbarAvatar = document.getElementById('app-avatar-btn');
    if (topbarAvatar) topbarAvatar.textContent = UTILISATEUR.initiales;
    document.querySelectorAll('.app-userchip .avatar').forEach(el => { el.textContent = UTILISATEUR.initiales; });
  }

  /* ---------- Profil (+ sécurité / mot de passe) ---------- */
  function renderProfil() {
    document.getElementById('pf-pane-profil').innerHTML = `
      <div class="card card--pad mb-4" style="max-width:560px">
        <p class="eyebrow mb-4">Informations du profil</p>
        <div class="row gap-3 mb-4">
          <span class="avatar avatar--lg" id="pf-avatar-preview">${UTILISATEUR.initiales}</span>
          <div>
            <b>${UTILISATEUR.nom}</b>
            <p class="text-sm text-soft">${UTILISATEUR.role}</p>
          </div>
        </div>
        <div class="field mb-4">
          <label class="field__label">Nom complet</label>
          <input class="input" id="pf-nom" value="${UTILISATEUR.nom}" />
        </div>
        <div class="field mb-4">
          <label class="field__label">Société / Conciergerie</label>
          <input class="input" id="pf-societe" value="${COMPTE.societe}" />
        </div>
        <div class="field mb-4">
          <label class="field__label">Adresse e-mail</label>
          <input class="input" type="email" id="pf-email" value="${UTILISATEUR.email}" />
        </div>
        <button type="button" class="btn btn--primary" id="pf-save-profil">Enregistrer les modifications</button>
      </div>

      <div class="card card--pad" style="max-width:560px">
        <p class="eyebrow mb-4">Sécurité</p>
        <div class="field mb-4">
          <label class="field__label">Mot de passe actuel</label>
          <input class="input" type="password" id="pf-pwd-current" placeholder="••••••••" autocomplete="current-password" />
        </div>
        <div class="field mb-4">
          <label class="field__label">Nouveau mot de passe</label>
          <input class="input" type="password" id="pf-pwd-new" placeholder="8 caractères minimum" autocomplete="new-password" />
        </div>
        <div class="field mb-4">
          <label class="field__label">Confirmer le nouveau mot de passe</label>
          <input class="input" type="password" id="pf-pwd-confirm" placeholder="••••••••" autocomplete="new-password" />
        </div>
        <button type="button" class="btn btn--primary" id="pf-save-pwd">Mettre à jour le mot de passe</button>
      </div>`;

    document.getElementById('pf-save-profil').addEventListener('click', () => {
      const nom = document.getElementById('pf-nom').value.trim();
      const societe = document.getElementById('pf-societe').value.trim();
      const email = document.getElementById('pf-email').value.trim();
      if (!nom || !email) { UI.toast('Le nom et l’e-mail sont obligatoires', false); return; }
      if (!email.includes('@')) { UI.toast('Adresse e-mail invalide', false); return; }
      UTILISATEUR.nom = nom;
      UTILISATEUR.initiales = nom.split(' ').map(m => m[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
      UTILISATEUR.email = email;
      COMPTE.societe = societe;
      refreshIdentityUI();
      renderProfil();
      UI.toast('Profil mis à jour');
    });

    document.getElementById('pf-save-pwd').addEventListener('click', () => {
      const cur = document.getElementById('pf-pwd-current').value;
      const n1 = document.getElementById('pf-pwd-new').value;
      const n2 = document.getElementById('pf-pwd-confirm').value;
      if (!cur || !n1 || !n2) { UI.toast('Merci de remplir tous les champs', false); return; }
      if (n1.length < 8) { UI.toast('Le nouveau mot de passe doit faire au moins 8 caractères', false); return; }
      if (n1 !== n2) { UI.toast('Les deux mots de passe ne correspondent pas', false); return; }
      document.getElementById('pf-pwd-current').value = '';
      document.getElementById('pf-pwd-new').value = '';
      document.getElementById('pf-pwd-confirm').value = '';
      UI.toast('Mot de passe mis à jour');
    });
  }

  /* ---------- Localisation ---------- */
  const opt = (value, label, current) => `<option value="${value}" ${value === current ? 'selected' : ''}>${label}</option>`;

  function renderLocalisation() {
    const g = PARAMETRES_GENERAUX;
    document.getElementById('pf-pane-localisation').innerHTML = `
      <div class="card card--pad" style="max-width:560px">
        <p class="eyebrow mb-4">Localisation</p>

        <div class="field mb-2">
          <label class="field__label">Devise</label>
          <select class="select" id="pg-devise">
            ${opt('EUR', 'EUR — Euro', g.devise)}
            ${opt('MAD', 'MAD — Dirham marocain', g.devise)}
            ${opt('USD', 'USD — Dollar américain', g.devise)}
            ${opt('GBP', 'GBP — Livre sterling', g.devise)}
            ${opt('XOF', 'FCFA — Franc CFA', g.devise)}
          </select>
        </div>
        <p class="field__hint mb-4">S'applique partout : tarifs, réservations, comptabilité, portail propriétaires et abonnement. Vos montants restent enregistrés en euros — la devise choisie sert à l'affichage et à la saisie.</p>

        <div class="field mb-4">
          <label class="field__label">Fuseau horaire</label>
          <select class="select" id="pg-fuseau">
            ${opt('Europe/Paris', 'Europe/Paris', g.fuseauHoraire)}
            ${opt('Africa/Casablanca', 'Africa/Casablanca', g.fuseauHoraire)}
            ${opt('Europe/London', 'Europe/London', g.fuseauHoraire)}
            ${opt('America/New_York', 'America/New_York', g.fuseauHoraire)}
          </select>
        </div>

        <div class="field mb-4">
          <label class="field__label">Format de date</label>
          <select class="select" id="pg-format-date">
            ${opt('dd/MM/yyyy', 'dd/MM/yyyy', g.formatDate)}
            ${opt('MM/dd/yyyy', 'MM/dd/yyyy', g.formatDate)}
            ${opt('yyyy-MM-dd', 'yyyy-MM-dd', g.formatDate)}
          </select>
        </div>

        <div class="field mb-4">
          <label class="field__label">Premier jour de la semaine</label>
          <select class="select" id="pg-premier-jour">
            ${opt('lundi', 'Lundi', g.premierJourSemaine)}
            ${opt('dimanche', 'Dimanche', g.premierJourSemaine)}
          </select>
        </div>

        <button type="button" class="btn btn--primary" id="pg-save-localisation">Enregistrer les modifications</button>
      </div>`;

    document.getElementById('pg-save-localisation').addEventListener('click', () => {
      const ancienneDevise = g.devise;
      g.devise = document.getElementById('pg-devise').value;
      g.fuseauHoraire = document.getElementById('pg-fuseau').value;
      g.formatDate = document.getElementById('pg-format-date').value;
      g.premierJourSemaine = document.getElementById('pg-premier-jour').value;

      // Les montants sont rendus au moment où chaque écran se construit : une
      // page déjà affichée garderait l'ancienne devise. Plutôt que de câbler
      // un rafraîchissement dans les dix-huit vues concernées, on recharge —
      // l'état est persisté, donc rien n'est perdu, et TOUT repart juste.
      if (g.devise !== ancienneDevise) {
        saveOyviaState();
        UI.toast(`Devise passée en ${getDevise(g.devise).label} — mise à jour de l'application…`);
        setTimeout(() => location.reload(), 700);
        return;
      }
      UI.toast('Paramètres de localisation mis à jour');
    });
  }

  /* ---------- Séjour ---------- */
  function renderSejour() {
    const g = PARAMETRES_GENERAUX;
    document.getElementById('pf-pane-sejour').innerHTML = `
      <div class="card card--pad" style="max-width:560px">
        <p class="eyebrow mb-2">Séjour</p>
        <p class="text-sm text-soft mb-4">Paramètres par défaut des séjours</p>

        <div class="field mb-4">
          <label class="field__label">Heure d'arrivée par défaut</label>
          <input class="input" type="time" id="pg-heure-arrivee" value="${g.heureArriveeDefaut}" />
        </div>

        <div class="field mb-4">
          <label class="field__label">Heure de départ par défaut</label>
          <input class="input" type="time" id="pg-heure-depart" value="${g.heureDepartDefaut}" />
        </div>

        <div class="field mb-4">
          <label class="field__label">Langue de communication voyageurs</label>
          <select class="select" id="pg-langue">
            ${opt('fr', 'Français', g.langueVoyageurs)}
            ${opt('en', 'English', g.langueVoyageurs)}
            ${opt('es', 'Español', g.langueVoyageurs)}
          </select>
        </div>

        <div class="field mb-4">
          <label class="field__label">Gestion des annulations</label>
          <select class="select" id="pg-annulations">
            ${opt('manuel', 'Manuel', g.gestionAnnulations)}
            ${opt('auto_accepter', 'Accepter automatiquement', g.gestionAnnulations)}
            ${opt('auto_refuser', 'Refuser automatiquement', g.gestionAnnulations)}
          </select>
        </div>

        <button type="button" class="btn btn--primary" id="pg-save-sejour">Enregistrer les modifications</button>
      </div>`;

    document.getElementById('pg-save-sejour').addEventListener('click', () => {
      const arr = document.getElementById('pg-heure-arrivee').value;
      const dep = document.getElementById('pg-heure-depart').value;
      if (!arr || !dep) { UI.toast('Merci de renseigner les deux horaires', false); return; }
      g.heureArriveeDefaut = arr;
      g.heureDepartDefaut = dep;
      g.langueVoyageurs = document.getElementById('pg-langue').value;
      g.gestionAnnulations = document.getElementById('pg-annulations').value;
      UI.toast('Paramètres de séjour mis à jour');
    });
  }

  /* ============================================================
     Rôles & accès : comptes utilisateurs + permissions par rôle
     ============================================================ */
  const rlIc = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  const IC_EDIT = rlIc('<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>');
  const IC_DEL  = rlIc('<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6"/>');

  const PORTAIL_BADGE = { app:'badge--accent', prestataire:'badge--warning', proprietaire:'badge--positive' };
  const STATUT_BADGE  = { actif:'badge--positive', invite:'badge--warning', suspendu:'badge--danger' };

  // Libellé de la fiche métier rattachée à un compte externe.
  function lienLabel(u) {
    if (!u.lienId) return null;
    const r = getRole(u.roleId);
    if (r && r.portail === 'prestataire') { const p = getPrestataire(u.lienId); return p ? p.nom : null; }
    if (r && r.portail === 'proprietaire') { const o = getProprietaire(u.lienId); return o ? o.societe : null; }
    return null;
  }

  const initialesDe = nom => nom.split(' ').map(m => m[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  const estMonCompte = u => u.email === UTILISATEUR.email;
  const nbAdminsActifs = () => UTILISATEURS.filter(u => u.roleId === 'admin' && u.statut !== 'suspendu').length;

  function renderComptes() {
    const rows = UTILISATEURS.map(u => {
      const r = getRole(u.roleId);
      const lien = lienLabel(u);
      const moi = estMonCompte(u);
      return `<tr data-user="${u.id}">
        <td>
          <div class="row gap-3">
            <span class="avatar avatar--sm">${initialesDe(u.nom)}</span>
            <div><b>${u.nom}${moi ? ' <span class="text-xs text-muted">(vous)</span>' : ''}</b>
              <div class="text-xs text-muted">${u.email}</div></div>
          </div>
        </td>
        <td>
          <select class="select rl-roleselect" data-user-role="${u.id}" aria-label="Rôle de ${u.nom}">
            ${ROLES.map(x => `<option value="${x.id}" ${x.id === u.roleId ? 'selected' : ''}>${x.nom}</option>`).join('')}
          </select>
          ${lien ? `<div class="text-xs text-muted rl-lien">↳ ${lien}</div>` : ''}
        </td>
        <td><span class="badge ${PORTAIL_BADGE[r.portail]}">${PORTAIL_LABEL[r.portail]}</span></td>
        <td><span class="badge ${STATUT_BADGE[u.statut]}">${STATUT_COMPTE_LABEL[u.statut]}</span></td>
        <td class="text-soft">${u.dernierAcces ? formatDate(u.dernierAcces) : '—'}</td>
        <td class="row gap-1" style="justify-content:flex-end">
          <button class="icon-btn" data-user-toggle="${u.id}" title="${u.statut === 'suspendu' ? 'Réactiver' : 'Suspendre'}" aria-label="${u.statut === 'suspendu' ? 'Réactiver' : 'Suspendre'} ${u.nom}">
            ${u.statut === 'suspendu'
              ? rlIc('<path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/>')
              : rlIc('<circle cx="12" cy="12" r="9"/><path d="M15 9l-6 6"/>')}
          </button>
          <button class="icon-btn icon-btn--danger" data-user-del="${u.id}" aria-label="Supprimer ${u.nom}">${IC_DEL}</button>
        </td>
      </tr>`;
    }).join('');

    return `<div class="app-pagehead" style="margin-bottom:var(--sp-4)">
        <div><p class="eyebrow">Comptes</p>
          <p class="text-sm text-soft">${UTILISATEURS.length} compte${UTILISATEURS.length > 1 ? 's' : ''} · ${nbAdminsActifs()} administrateur${nbAdminsActifs() > 1 ? 's' : ''}</p></div>
        <div class="app-pagehead__actions">
          <button class="btn btn--primary" id="rl-invite">${rlIc('<path d="M12 5v14M5 12h14"/>')} Inviter un utilisateur</button>
        </div>
      </div>
      <div class="table-wrap rl-comptes">
        <table class="table">
          <thead><tr><th>Utilisateur</th><th>Rôle</th><th>Accès</th><th>Statut</th><th>Dernier accès</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  function renderRoleCards() {
    return ROLES.map(r => {
      const nb = getComptesByRole(r.id).length;
      const interne = r.portail === 'app';

      const perms = interne
        ? Object.entries(PERMISSIONS.reduce((acc, p) => { (acc[p.groupe] = acc[p.groupe] || []).push(p); return acc; }, {}))
            .map(([groupe, items]) => `
              <div class="rl-permgroup">
                <p class="rl-permgroup__label">${groupe}</p>
                ${items.map(p => `
                  <label class="rl-perm ${r.systeme ? 'is-locked' : ''}">
                    <input type="checkbox" data-perm="${r.id}:${p.id}" ${r.permissions.includes(p.id) ? 'checked' : ''} ${r.systeme ? 'disabled' : ''}>
                    <span>${p.label}</span>
                  </label>`).join('')}
              </div>`).join('')
        : `<p class="text-sm text-soft">Accès limité à son propre espace : ce rôle ne voit que les données qui le concernent, sans accéder à l’application de gestion.</p>`;

      return `<div class="rl-rolecard">
        <div class="rl-rolecard__head">
          <div class="grow">
            <div class="row gap-2" style="align-items:center">
              <b>${r.nom}</b>
              <span class="badge ${PORTAIL_BADGE[r.portail]}">${PORTAIL_LABEL[r.portail]}</span>
              ${r.systeme ? `<span class="badge badge--neutral" title="Rôle système : ses accès ne sont pas modifiables">Système</span>` : ''}
            </div>
            <p class="text-sm text-soft mt-2">${r.desc}</p>
          </div>
          <span class="badge badge--neutral">${nb} compte${nb > 1 ? 's' : ''}</span>
        </div>
        ${interne ? `<p class="text-xs text-muted mb-2">Sections accessibles ${r.systeme ? '(non modifiable)' : ''}</p>` : ''}
        <div class="rl-perms">${perms}</div>
      </div>`;
    }).join('');
  }

  function renderRoles() {
    document.getElementById('pf-pane-roles').innerHTML = `
      ${renderComptes()}
      <p class="eyebrow mb-2">Rôles</p>
      <p class="text-sm text-soft mb-4">Chaque rôle définit ce que ses comptes peuvent consulter. Les rôles système ne sont pas modifiables afin d’éviter tout blocage d’accès.</p>
      ${renderRoleCards()}`;
  }

  /* ---------- Interactions : comptes ---------- */
  document.getElementById('pf-pane-roles').addEventListener('change', e => {
    const roleSel = e.target.closest('[data-user-role]');
    if (roleSel) {
      const u = getUtilisateurCompte(roleSel.dataset.userRole);
      const ancien = u.roleId;
      if (ancien === 'admin' && roleSel.value !== 'admin' && nbAdminsActifs() <= 1) {
        UI.toast('Gardez au moins un administrateur actif', false);
        roleSel.value = ancien; return;
      }
      const nouveau = getRole(roleSel.value);
      // Changer de famille de portail invalide la fiche rattachée.
      if (getRole(ancien).portail !== nouveau.portail) u.lienId = null;
      u.roleId = roleSel.value;
      renderRoles();
      UI.toast(`${u.nom} est désormais ${nouveau.nom}`);
      return;
    }

    const perm = e.target.closest('[data-perm]');
    if (perm) {
      const [roleId, permId] = perm.dataset.perm.split(':');
      const r = getRole(roleId);
      if (perm.checked) { if (!r.permissions.includes(permId)) r.permissions.push(permId); }
      else { r.permissions = r.permissions.filter(x => x !== permId); }
      const label = (PERMISSIONS.find(p => p.id === permId) || {}).label || permId;
      UI.toast(`${r.nom} · ${label} ${perm.checked ? 'autorisé' : 'retiré'}`);
      return;
    }
  });

  document.getElementById('pf-pane-roles').addEventListener('click', e => {
    const inviteBtn = e.target.closest('#rl-invite');
    if (inviteBtn) { openInviteModal(); return; }

    const tog = e.target.closest('[data-user-toggle]');
    if (tog) {
      const u = getUtilisateurCompte(tog.dataset.userToggle);
      if (u.statut !== 'suspendu' && u.roleId === 'admin' && nbAdminsActifs() <= 1) {
        UI.toast('Gardez au moins un administrateur actif', false); return;
      }
      if (u.statut === 'suspendu') {
        u.statut = 'actif'; renderRoles(); UI.toast(`${u.nom} réactivé`);
      } else {
        UI.confirm({
          title: 'Suspendre ce compte ?',
          message: `${u.nom} ne pourra plus se connecter tant que le compte reste suspendu. Ses données et son historique sont conservés.`,
          confirmText: 'Suspendre', danger: true,
          onConfirm: () => { u.statut = 'suspendu'; renderRoles(); UI.toast(`${u.nom} suspendu`); },
        });
      }
      return;
    }

    const del = e.target.closest('[data-user-del]');
    if (del) {
      const u = getUtilisateurCompte(del.dataset.userDel);
      if (estMonCompte(u)) { UI.toast('Vous ne pouvez pas supprimer votre propre compte', false); return; }
      if (u.roleId === 'admin' && nbAdminsActifs() <= 1) { UI.toast('Gardez au moins un administrateur actif', false); return; }
      UI.confirm({
        title: 'Supprimer ce compte ?',
        message: `Le compte de ${u.nom} (${u.email}) sera définitivement supprimé et son accès révoqué immédiatement. Cette action est irréversible.`,
        confirmText: 'Supprimer', danger: true,
        onConfirm: () => {
          UTILISATEURS.splice(UTILISATEURS.findIndex(x => x.id === u.id), 1);
          renderRoles(); UI.toast(`Compte de ${u.nom} supprimé`);
        },
      });
      return;
    }
  });

  /* ---------- Modale d'invitation ---------- */
  const elRoleSel = document.getElementById('rl-f-role');
  const elLienWrap = document.getElementById('rl-f-lien-wrap');
  const elLienSel = document.getElementById('rl-f-lien');

  function refreshLienField() {
    const r = getRole(elRoleSel.value);
    document.getElementById('rl-f-roledesc').textContent = r.desc;
    if (r.portail === 'prestataire') {
      elLienWrap.hidden = false;
      elLienSel.innerHTML = PRESTATAIRES.map(p => `<option value="${p.id}">${p.nom} — ${p.role}</option>`).join('');
    } else if (r.portail === 'proprietaire') {
      elLienWrap.hidden = false;
      elLienSel.innerHTML = PROPRIETAIRES.map(o => `<option value="${o.id}">${o.societe} — ${o.contact}</option>`).join('');
    } else {
      elLienWrap.hidden = true;
      elLienSel.innerHTML = '';
    }
  }

  function openInviteModal() {
    elRoleSel.innerHTML = ROLES.map(r => `<option value="${r.id}">${r.nom}</option>`).join('');
    elRoleSel.value = 'secretaire';
    document.getElementById('rl-f-nom').value = '';
    document.getElementById('rl-f-email').value = '';
    refreshLienField();
    UI.openPanel('rl-modal');
  }

  elRoleSel.addEventListener('change', refreshLienField);

  document.getElementById('rl-modal-confirm').addEventListener('click', () => {
    const nom = document.getElementById('rl-f-nom').value.trim();
    const email = document.getElementById('rl-f-email').value.trim();
    if (!nom) { UI.toast('Renseignez le nom complet', false); return; }
    if (!email.includes('@')) { UI.toast('Adresse e-mail invalide', false); return; }
    if (UTILISATEURS.some(u => u.email.toLowerCase() === email.toLowerCase())) {
      UI.toast('Un compte utilise déjà cette adresse e-mail', false); return;
    }
    const r = getRole(elRoleSel.value);
    UTILISATEURS.push({
      id: 'U' + Date.now(), nom, email, roleId: r.id, statut: 'invite',
      lienId: (r.portail === 'app') ? null : elLienSel.value, dernierAcces: null,
    });
    UI.closeAll(); renderRoles();
    UI.toast(`Invitation envoyée à ${email}`);
  });

  /* ---------- Plateformes ---------- */
  const PF_COLOR = {
    airbnb: 'var(--ch-airbnb)', booking: 'var(--ch-booking)', expedia: 'var(--ch-expedia)',
    agoda: 'var(--ch-agoda)', vrbo: 'var(--ch-vrbo)', google: 'var(--ch-google)',
    pricelabs: 'var(--ch-pricelabs)', ical: 'var(--ch-ical)', whatsapp: 'var(--ch-whatsapp)',
  };

  function pfCard(p) {
    return `<div class="pf-card">
      <div class="pf-card__head">
        <div class="pf-card__ic" style="background:${PF_COLOR[p.id] || 'var(--ink-400)'}">${p.lettre}</div>
        <div class="grow">
          <div class="pf-card__name">${p.nom}</div>
          <div class="pf-card__status"><span class="status-dot status-dot--${p.connecte ? 'ok' : 'off'}"></span>${p.connecte ? 'Connecté' : 'Non connecté'}</div>
        </div>
      </div>
      <p class="pf-card__desc">${p.desc}</p>
      <button type="button" class="btn ${p.connecte ? 'btn--secondary' : 'btn--primary'} btn--sm btn--block" data-pf-toggle="${p.id}">${p.connecte ? 'Déconnecter' : 'Associer un compte'}</button>
    </div>`;
  }

  function renderPlateformes() {
    const sections = ['ota', 'connexions', 'applications'];
    document.getElementById('pf-pane-plateformes').innerHTML = sections.map(sec => {
      const items = PLATEFORMES.filter(p => p.section === sec);
      if (!items.length) return '';
      return `<div class="pf-section">
        <p class="eyebrow pf-section__label">${PLATEFORME_SECTION_LABEL[sec]}</p>
        <div class="pf-grid">${items.map(pfCard).join('')}</div>
      </div>`;
    }).join('');
  }

  document.getElementById('pf-pane-plateformes').addEventListener('click', e => {
    const btn = e.target.closest('[data-pf-toggle]'); if (!btn) return;
    const p = PLATEFORMES.find(x => x.id === btn.dataset.pfToggle);
    if (!p) return;
    p.connecte = !p.connecte;
    renderPlateformes();
    UI.toast(p.connecte ? `${p.nom} connecté` : `${p.nom} déconnecté`, p.connecte);
  });

  /* ---------- Conformité ----------
     La carte professionnelle « G » et rien d'autre : c'est elle qui autorise
     l'activité de gestion, et son numéro doit figurer sur les documents
     édités — mandats, factures, fiches de police. */
  function renderConformite() {
    const c = CONFORMITE;

    // Une carte expirée n'est pas « bientôt à renouveler » : l'activité de
    // gestion est en infraction tant qu'elle n'est pas à jour.
    const expiree = c.carteGExpire && c.carteGExpire < AUJOURDHUI;
    const bientot = c.carteGExpire && !expiree && nuitsEntre(AUJOURDHUI, c.carteGExpire) <= 90;
    const alerte = (classe, icone, titre, texte) => `
      <div class="pf-conformite__alerte ${classe}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">${icone}</svg>
        <div><b>${titre}</b><p>${texte}</p></div>
      </div>`;
    const ICO_ALERTE = '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>';
    const ICO_HORLOGE = '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>';

    document.getElementById('pf-pane-conformite').innerHTML = `
      ${!c.carteG
        ? alerte('', ICO_ALERTE, 'Carte professionnelle non renseignée',
            "La carte « G » est obligatoire dès lors que vous gérez le bien d'autrui contre rémunération.")
        : expiree
          ? alerte('', ICO_ALERTE, 'Carte professionnelle expirée',
              `Validité dépassée depuis le ${formatDate(c.carteGExpire, { annee: true })}. Le renouvellement se demande auprès de votre CCI.`)
          : bientot
            ? alerte('pf-conformite__alerte--douce', ICO_HORLOGE, 'Carte à renouveler',
                `Elle expire le ${formatDate(c.carteGExpire, { annee: true })}. Comptez deux à trois mois d'instruction.`)
            : ''}

      <div class="card card--pad" style="max-width:560px">
        <p class="eyebrow mb-2">Carte professionnelle</p>
        <p class="text-sm text-soft mb-4">Délivrée par la CCI, mention « Gestion immobilière ». Son numéro apparaît sur vos mandats, vos factures et les fiches de police que vous éditez.</p>

        <div class="field mb-4">
          <label class="field__label" for="cf-carteg">Numéro de carte G</label>
          <input class="input" id="cf-carteg" value="${c.carteG}" placeholder="CPI 0000 0000 000 000 000" />
          <p class="field__hint">Format : CPI 6901 2024 000 012 345</p>
        </div>
        <div class="field mb-4">
          <label class="field__label" for="cf-carteg-cci">CCI émettrice</label>
          <input class="input" id="cf-carteg-cci" value="${c.carteGCci}" placeholder="CCI Lyon Métropole" />
        </div>
        <div class="field mb-4">
          <label class="field__label" for="cf-carteg-expire">Valable jusqu'au</label>
          <input class="input" type="date" id="cf-carteg-expire" value="${c.carteGExpire}" />
        </div>

        <button type="button" class="btn btn--primary" id="cf-save">Enregistrer</button>
      </div>`;

    document.getElementById('cf-save').addEventListener('click', () => {
      const v = id => document.getElementById(id).value.trim();
      Object.assign(CONFORMITE, {
        carteG: v('cf-carteg'), carteGCci: v('cf-carteg-cci'), carteGExpire: v('cf-carteg-expire'),
      });
      saveOyviaState(); renderConformite();
      UI.toast('Carte professionnelle enregistrée');
    });
  }

  renderProfil();
  renderLocalisation();
  renderSejour();
  renderConformite();
  renderRoles();
  renderPlateformes();
})();
