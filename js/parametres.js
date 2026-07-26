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
          <label class="field__label">Devise par défaut</label>
          <select class="select" id="pg-devise">
            ${opt('MAD', 'MAD — Dirham marocain', g.devise)}
            ${opt('EUR', 'EUR — Euro', g.devise)}
            ${opt('USD', 'USD — Dollar américain', g.devise)}
            ${opt('GBP', 'GBP — Livre sterling', g.devise)}
          </select>
        </div>
        <p class="field__hint mb-4">Utilisée pour les séjours manuels et les exports.</p>

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
      g.devise = document.getElementById('pg-devise').value;
      g.fuseauHoraire = document.getElementById('pg-fuseau').value;
      g.formatDate = document.getElementById('pg-format-date').value;
      g.premierJourSemaine = document.getElementById('pg-premier-jour').value;
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

  /* ---------- Options supplémentaires ---------- */
  const OPT_IC = {
    whatsapp: '<path d="M21 11.5a8.4 8.4 0 0 1-12.3 7.5L3 21l2.1-5.6A8.4 8.4 0 1 1 21 11.5z"/>',
  };
  const optIcon = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p || '<circle cx="12" cy="12" r="9"/>'}</svg>`;

  function renderOptionsSupp() {
    document.getElementById('pf-pane-options').innerHTML = `
      <div class="card" style="max-width:640px">
        <div class="card__head"><span class="card__title">Options supplémentaires</span></div>
        <div class="card__body" id="pg-options" style="padding-top:0">
          ${OPTIONS_LANDING.map(o => {
            const active = COMPTE.optionsActives.includes(o.id);
            const rates = o.tarifs ? `<div class="ab-rates">${o.tarifs.map(t =>
              `<div class="ab-rate"><span>${t.cat}<small>${t.detail}</small></span><b class="${t.prix === 0 ? 'free' : ''}">${t.prix === 0 ? 'Gratuit' : formatMAD(t.prix, 2) + ' / message'}</b></div>`).join('')}</div>` : '';
            return `<div class="ab-optionrow">
              <div class="ab-optionrow__ic">${optIcon(OPT_IC[o.id])}</div>
              <div class="ab-optionrow__meta"><b>${o.nom}</b><small>${o.desc}</small></div>
              <span class="ab-optionrow__price">à l'usage</span>
              <label class="switch"><input type="checkbox" data-opt="${o.id}" ${active ? 'checked' : ''}><span class="switch__track"></span></label>
            </div>${rates}`;
          }).join('')}
        </div>
      </div>`;
  }

  document.getElementById('pf-pane-options').addEventListener('change', e => {
    const t = e.target.closest('[data-opt]'); if (!t) return;
    const id = t.dataset.opt;
    if (t.checked) { if (!COMPTE.optionsActives.includes(id)) COMPTE.optionsActives.push(id); }
    else { COMPTE.optionsActives = COMPTE.optionsActives.filter(x => x !== id); }
    UI.toast(t.checked ? 'Option activée' : 'Option désactivée');
  });

  /* ---------- Plateformes ---------- */
  const PF_COLOR = {
    airbnb: 'var(--ch-airbnb)', booking: 'var(--ch-booking)', expedia: 'var(--ch-expedia)',
    agoda: 'var(--ch-agoda)', vrbo: 'var(--ch-vrbo)', google: 'var(--ch-google)',
    pricelabs: 'var(--ch-pricelabs)', ical: 'var(--ch-ical)',
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

  renderProfil();
  renderLocalisation();
  renderSejour();
  renderOptionsSupp();
  renderPlateformes();
})();
