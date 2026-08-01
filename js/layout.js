/* ============================================================
   OYVIA — Shell applicatif (sidebar + topbar)
   Injecté une seule fois ici, réutilisé par tous les écrans.
   Usage dans chaque page :  Layout.init('calendrier');
   ============================================================ */
const Layout = (function () {

  // Icônes (style Lucide, stroke)
  const I = {
    dashboard: '<path d="M3 3h8v8H3zM13 3h8v5h-8zM13 12h8v9h-8zM3 15h8v6H3z"/>',
    calendrier:'<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    reservations:'<path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/>',
    messagerie:'<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    automatisations:'<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
    logements: '<path d="M3 9.5 12 3l9 6.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
    menage:    '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
    equipe:    '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><path d="M2 13h20"/>',
    statistiques:'<path d="M3 3v18h18"/><path d="M18 17V9M13 17V5M8 17v-3"/>',
    voyageurs: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    proprietaires:'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M5.5 17c.6-2.2 2.2-3.5 3.5-3.5s2.9 1.3 3.5 3.5"/><path d="M14 9h5M14 13h5"/>',
    comptabilite:'<path d="M4 2h13l3 3v17a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z"/><path d="M17 2v4h4"/><path d="M8 11h8M8 15h8M8 19h5"/>',
    abonnement:'<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
    parametres:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    vivi:      '<rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 4v4M9 13h.01M15 13h.01M10 17h4"/><path d="M2 13h2M20 13h2"/>',
    site:      '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18z"/>',
    tarification:'<path d="M3 16.5 8 10l4 3.5L21 4"/><path d="M16 4h5v5"/><path d="M3 21h18"/>',
    search:    '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    bell:      '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
    menu:      '<path d="M4 6h16M4 12h16M4 18h16"/>',
    chevrons:  '<path d="m11 17-5-5 5-5M18 17l-5-5 5-5"/>',
  };

  const NAV = [
    { id:'dashboard',    label:'Tableau de bord', title:'Tableau de bord',   href:'dashboard.html' },
    { id:'calendrier',   label:'Calendrier',      title:'Calendrier unifié', href:'calendrier.html' },
    { id:'statistiques', label:'Statistiques',    title:'Statistiques',      href:'statistiques.html' },
    { id:'logements',    label:'Logements',       title:'Logements',         href:'logements.html' },
    { id:'proprietaires',label:'Propriétaires',   title:'Propriétaires',     href:'proprietaires.html' },
    { id:'reservations', label:'Réservations',    title:'Réservations',      href:'reservations.html' },
    { id:'voyageurs',    label:'Voyageurs',       title:'Voyageurs',         href:'voyageurs.html' },
    { id:'site',         label:'Site web',        title:'Site web & réservations directes', href:'site.html' },
    { id:'messagerie',   label:'Messagerie',      title:'Messagerie',        href:'messagerie.html', badge:'unread' },
    { id:'automatisations', label:'Automatisations', title:'Automatisations', href:'automatisations.html' },
    { id:'vivi',         label:'Assistant IA',    title:'Vivi — Assistant IA', href:'vivi.html' },
    { id:'menage',       label:'Gestion des tâches', title:'Gestion des tâches', href:'menage.html' },
    { id:'equipe',       label:'Équipe',          title:'Équipe',            href:'equipe.html' },
    { id:'tarification', label:'Tarification dynamique', title:'Tarification dynamique', href:'tarification.html' },
    { id:'comptabilite', label:'Comptabilité',    title:'Comptabilité',      href:'comptabilite.html' },
    { id:'abonnement',   label:'Abonnement',      title:'Abonnement & Facturation', href:'abonnement.html' },
    { id:'parametres',   label:'Paramètres',      title:'Paramètres',       href:'parametres.html' },
  ];

  // Regroupement du menu par catégories (l'ordre des groupes = l'ordre affiché).
  const NAV_GROUPS = [
    { label:'Aperçu',        items:['dashboard', 'calendrier', 'statistiques'] },
    { label:'Locations',     items:['logements', 'proprietaires', 'reservations', 'voyageurs'] },
    { label:'Vente directe', items:['site'] },
    { label:'Communication', items:['messagerie', 'automatisations', 'vivi'] },
    { label:'Équipe',        items:['menage', 'equipe'] },
    // Accueille les outils tiers branchés sur Oyvia. Un seul aujourd'hui,
    // mais le groupe existe pour que le suivant s'y range sans redécoupage.
    { label:'Intégrations',  items:['tarification'] },
    { label:'Comptabilité',  items:['comptabilite'] },
    { label:'Compte',        items:['abonnement', 'parametres'] },
  ];

  function svg(paths, w) { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w||2}" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`; }

  // Ne compte que les conversations réellement visibles dans la messagerie :
  // un canal dont la plateforme est déconnectée ne doit pas gonfler le badge.
  function canalConnecte(canal) {
    const pf = PLATEFORMES.find(p => p.id === canal);
    return pf ? pf.connecte : true;
  }
  function unreadCount() {
    return CONVERSATIONS.reduce((s, c) => s + (canalConnecte(c.canal) ? (c.nonLu || 0) : 0), 0);
  }

  function sidebarHTML(active) {
    const groups = NAV_GROUPS.map(g => {
      const items = g.items.map(id => NAV.find(n => n.id === id)).filter(Boolean).map(n => {
        const badge = n.badge === 'unread' && unreadCount() > 0 ? `<span class="app-navitem__badge">${unreadCount()}</span>` : '';
        return `<a class="app-navitem ${n.id === active ? 'is-active' : ''}" href="${n.href}">
          ${svg(I[n.id])}<span>${n.label}</span>${badge}</a>`;
      }).join('');
      return `<p class="app-navlabel">${g.label}</p>${items}`;
    }).join('');
    return `
      <div class="app-sidebar__brand"><img src="../assets/oyvia-logo.svg" alt="Oyvia" class="brand-logo"></div>
      <nav class="app-sidebar__nav" aria-label="Navigation">
        ${groups}
      </nav>
      <div class="app-sidebar__foot">
        <button type="button" class="app-userchip" id="app-userchip-btn" aria-haspopup="true" aria-expanded="false">
          <span class="avatar avatar--sm">${UTILISATEUR.initiales}</span>
          <div class="app-userchip__meta grow">
            <b>${UTILISATEUR.nom}</b><span>${UTILISATEUR.role}</span>
          </div>
        </button>
      </div>`;
  }

  function logementOptions() {
    return '<option value="all">Tous les logements</option>' +
      LOGEMENTS.map(l => `<option value="${l.id}">${l.nom}</option>`).join('');
  }

  // Le filtre par logement n'est plus dans la topbar : il occupait toute la
  // largeur sur chaque écran, y compris ceux où filtrer par logement n'a
  // aucun sens (Paramètres, Abonnement, Équipe…). Il vit désormais dans
  // l'en-tête de page, en petit, comme sur Statistiques — et uniquement sur
  // les écrans concernés : Tableau de bord, Calendrier, Logements,
  // Réservations. Il suffit à ces pages de placer un
  // <select id="app-logement"> dans .app-pagehead__actions : init() le
  // remplit et le câble automatiquement.
  function topbarHTML(nav) {
    return `
      <button class="btn btn--secondary btn--icon btn--sm app-topbar__menu" id="app-menu-btn" aria-label="Menu">${svg(I.menu)}</button>
      <h1 class="app-topbar__title">${nav.title}</h1>
      <div class="input-icon app-topbar__search">
        ${svg(I.search)}
        <input class="input" type="search" placeholder="Rechercher…" aria-label="Rechercher" />
      </div>
      <button class="btn btn--secondary btn--icon app-bell" id="app-bell-btn" aria-label="Notifications" aria-haspopup="true">
        ${svg(I.bell)}<span class="app-bell__count" id="app-bell-count" hidden></span>
      </button>
      <button class="btn btn--secondary btn--icon" id="app-collapse" aria-label="Replier le menu">${svg(I.chevrons)}</button>
      <button type="button" class="avatar" id="app-avatar-btn" aria-label="Mon compte" aria-haspopup="true" aria-expanded="false">${UTILISATEUR.initiales}</button>`;
  }

  function init(active) {
    const nav = NAV.find(n => n.id === active) || NAV[0];
    document.title = `Oyvia — ${nav.title}`;

    const sidebar = document.getElementById('app-sidebar');
    const topbar = document.getElementById('app-topbar');
    if (sidebar) sidebar.innerHTML = sidebarHTML(active);
    if (topbar) topbar.innerHTML = topbarHTML(nav);

    // Scrim mobile
    let scrim = document.querySelector('.app-scrim');
    if (!scrim) { scrim = document.createElement('div'); scrim.className = 'app-scrim'; document.body.appendChild(scrim); }

    const closeDrawer = () => { sidebar && sidebar.classList.remove('is-open'); scrim.classList.remove('is-open'); };
    scrim.addEventListener('click', closeDrawer);

    const menuBtn = document.getElementById('app-menu-btn');
    if (menuBtn) menuBtn.addEventListener('click', () => {
      sidebar.classList.toggle('is-open'); scrim.classList.toggle('is-open');
    });

    const collapseBtn = document.getElementById('app-collapse');
    if (collapseBtn) collapseBtn.addEventListener('click', () => {
      if (window.innerWidth <= 900) { sidebar.classList.toggle('is-open'); scrim.classList.toggle('is-open'); }
      else { sidebar.classList.toggle('is-mini'); }
    });

    // Sélecteur de logement, désormais dans l'en-tête de page : présent
    // seulement sur les écrans où il a du sens. On le remplit ici pour que
    // les pages n'aient pas à dupliquer la liste des logements.
    const sel = document.getElementById('app-logement');
    if (sel) {
      sel.innerHTML = logementOptions();
      sel.value = Layout.currentLogement;
      sel.addEventListener('change', e => {
        Layout.currentLogement = e.target.value;
        document.dispatchEvent(new CustomEvent('logementChange', { detail: e.target.value }));
      });
    }

    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });

    // Centre de notifications (cloche) — recalculé à chaque chargement de page
    const bellBtn = document.getElementById('app-bell-btn');
    if (bellBtn) bellBtn.addEventListener('click', e => { e.stopPropagation(); UI.toggleNotifDropdown(); });
    if (typeof UI !== 'undefined') {
      UI.refreshBellBadge();
      UI.maybeShowNotifPush();
    }

    // Menu de compte (avatar de la topbar + fiche utilisateur en bas de la sidebar)
    const userchipBtn = document.getElementById('app-userchip-btn');
    if (userchipBtn) userchipBtn.addEventListener('click', e => { e.stopPropagation(); UI.toggleAccountDropdown(userchipBtn, 'top'); });
    const avatarBtn = document.getElementById('app-avatar-btn');
    if (avatarBtn) avatarBtn.addEventListener('click', e => { e.stopPropagation(); UI.toggleAccountDropdown(avatarBtn, 'bottom'); });
  }

  return { init, currentLogement: 'all', svg, NAV, unreadCount };
})();

/* --------- Boîte à outils UI partagée (toasts, panneau) --------- */
const UI = {
  toast(msg = 'Action enregistrée', ok = true) {
    let zone = document.querySelector('.toast-zone');
    if (!zone) { zone = document.createElement('div'); zone.className = 'toast-zone'; document.body.appendChild(zone); }
    const t = document.createElement('div');
    t.className = 'toast';
    const ic = ok ? '<path d="M20 6 9 17l-5-5"/>' : '<path d="M18 6 6 18M6 6l12 12"/>';
    t.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${ic}</svg> ${msg}`;
    zone.appendChild(t);
    setTimeout(() => t.remove(), 2600);
  },
  // Génère et télécharge un vrai fichier CSV (séparateur ';' + BOM pour Excel FR)
  exportCSV(filename, headers, rows) {
    const esc = v => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
    const csv = [headers, ...rows].map(r => r.map(esc).join(';')).join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click();
    a.remove(); URL.revokeObjectURL(url);
    UI.toast('Export CSV téléchargé');
  },
  openPanel(id) {
    let scrim = document.getElementById('ui-scrim');
    if (!scrim) { scrim = document.createElement('div'); scrim.id = 'ui-scrim'; scrim.className = 'overlay'; document.body.appendChild(scrim); scrim.addEventListener('click', () => UI.closeAll()); }
    scrim.classList.add('is-open');
    const el = document.getElementById(id); if (el) el.classList.add('is-open');
  },
  closeAll() {
    document.querySelectorAll('.panel.is-open, .modal.is-open').forEach(e => e.classList.remove('is-open'));
    const s = document.getElementById('ui-scrim'); if (s) s.classList.remove('is-open');
    UI.closeNotifDropdown();
    UI.closeAccountDropdown();
  },

  // Popup de confirmation avec le même design que le reste de l'app (au lieu du confirm() natif du navigateur).
  // Usage : UI.confirm({ title, message, confirmText, danger, onConfirm })
  confirm({ title = 'Confirmer', message = '', confirmText = 'Confirmer', cancelText = 'Annuler', danger = false, onConfirm } = {}) {
    let modal = document.getElementById('ui-confirm-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.className = 'modal';
      modal.id = 'ui-confirm-modal';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.setAttribute('aria-labelledby', 'ui-confirm-title');
      modal.innerHTML = `
        <div class="modal__head">
          <h3 class="modal__title" id="ui-confirm-title"></h3>
          <button class="icon-btn" onclick="UI.closeAll()" aria-label="Fermer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
        </div>
        <div class="modal__body"><p id="ui-confirm-message" class="text-sm text-soft" style="white-space:pre-line"></p></div>
        <div class="modal__foot">
          <button class="btn btn--secondary" onclick="UI.closeAll()">Annuler</button>
          <button class="btn" id="ui-confirm-ok"></button>
        </div>`;
      document.body.appendChild(modal);
    }
    modal.querySelector('#ui-confirm-title').textContent = title;
    modal.querySelector('#ui-confirm-message').textContent = message;
    modal.querySelector('.modal__foot button:first-child').textContent = cancelText;

    const okBtn = modal.querySelector('#ui-confirm-ok');
    okBtn.textContent = confirmText;
    okBtn.className = 'btn ' + (danger ? 'btn--danger' : 'btn--primary');
    const freshOk = okBtn.cloneNode(true); // évite d'empiler les listeners d'un appel précédent
    okBtn.parentNode.replaceChild(freshOk, okBtn);
    freshOk.addEventListener('click', () => {
      UI.closeAll();
      if (typeof onConfirm === 'function') onConfirm();
    });

    UI.openPanel('ui-confirm-modal');
  },

  /* ---------- Centre de notifications (cloche de la topbar) ---------- */
  refreshBellBadge() {
    const badge = document.getElementById('app-bell-count');
    if (!badge) return;
    const notifs = getNotifications();
    if (!notifs.length) { badge.hidden = true; return; }
    badge.hidden = false;
    badge.textContent = notifs.length > 9 ? '9+' : String(notifs.length);
    badge.classList.toggle('app-bell__count--medium', !notifs.some(n => n.urgence === 'high'));
  },
  toggleNotifDropdown() {
    const existing = document.getElementById('notif-dropdown');
    if (existing && existing.classList.contains('is-open')) { UI.closeNotifDropdown(); return; }
    let el = existing;
    if (!el) { el = document.createElement('div'); el.id = 'notif-dropdown'; el.className = 'notif-dropdown'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Notifications'); document.body.appendChild(el); }
    el.innerHTML = UI.notifDropdownHTML();
    const btn = document.getElementById('app-bell-btn');
    if (btn) {
      const rect = btn.getBoundingClientRect();
      el.style.top = (rect.bottom + 8) + 'px';
      el.style.right = Math.max(8, window.innerWidth - rect.right) + 'px';
    }
    el.classList.add('is-open');
    el.querySelectorAll('[data-notif-resa]').forEach(row => row.addEventListener('click', () => {
      UI.closeNotifDropdown();
      if (row.dataset.notifHref) window.location.href = row.dataset.notifHref;
      else UI.openResa(row.dataset.notifResa);
    }));
    setTimeout(() => document.addEventListener('click', UI._notifOutsideClick, true), 0);
  },
  closeNotifDropdown() {
    const el = document.getElementById('notif-dropdown');
    if (el) el.classList.remove('is-open');
    document.removeEventListener('click', UI._notifOutsideClick, true);
  },
  _notifOutsideClick(e) {
    const el = document.getElementById('notif-dropdown');
    const btn = document.getElementById('app-bell-btn');
    if (!el) return;
    if (el.contains(e.target) || (btn && btn.contains(e.target))) return;
    UI.closeNotifDropdown();
  },
  notifDropdownHTML() {
    const notifs = getNotifications();
    const ICONS = {
      police: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>',
      paiement: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
      // Même pictogramme que l'entrée de menu « Assistant IA »
      vivi: '<rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 4v4M9 13h.01M15 13h.01M10 17h4"/><path d="M2 13h2M20 13h2"/>',
    };
    if (!notifs.length) {
      return `<div class="notif-dropdown__head"><b>Notifications</b></div>
        <div class="notif-empty">${UI._ic('<path d="M20 6 9 17l-5-5"/>')}<p>Aucune alerte pour le moment</p></div>`;
    }
    // Une alerte peut se traiter ailleurs que dans la fiche réservation
    // (les réponses de Vivi s'approuvent dans la conversation) : dans ce cas
    // la notification porte un href et on y navigue au lieu d'ouvrir le panneau.
    const rows = notifs.map(n => `
      <button type="button" class="notif-item" data-notif-resa="${n.resaId}"${n.href ? ` data-notif-href="${n.href}"` : ''}>
        <span class="notif-item__ic notif-item__ic--${n.urgence}">${UI._ic(ICONS[n.type] || ICONS.police)}</span>
        <span class="notif-item__body"><b>${n.titre}</b><p>${n.message}</p></span>
      </button>`).join('');
    return `<div class="notif-dropdown__head"><b>Notifications</b><span class="text-xs text-muted">${notifs.length}</span></div>${rows}`;
  },

  /* ---------- Menu de compte (avatar topbar + fiche utilisateur sidebar) ---------- */
  toggleAccountDropdown(trigger, anchor = 'bottom') {
    const existing = document.getElementById('account-dropdown');
    if (existing && existing.classList.contains('is-open')) { UI.closeAccountDropdown(); return; }
    let el = existing;
    if (!el) { el = document.createElement('div'); el.id = 'account-dropdown'; el.className = 'account-dropdown'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Mon compte'); document.body.appendChild(el); }
    el.innerHTML = UI.accountDropdownHTML();
    if (trigger) {
      const rect = trigger.getBoundingClientRect();
      el.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - 260 - 8)) + 'px';
      if (anchor === 'top') {
        // Déclencheur en bas de l'écran (fiche utilisateur sidebar) : le menu s'ouvre vers le haut
        el.style.top = 'auto';
        el.style.bottom = (window.innerHeight - rect.top + 8) + 'px';
      } else {
        // Déclencheur en haut de l'écran (avatar topbar) : le menu s'ouvre vers le bas
        el.style.bottom = 'auto';
        el.style.top = (rect.bottom + 8) + 'px';
      }
    }
    el.classList.add('is-open');
    trigger && trigger.setAttribute('aria-expanded', 'true');
    const logoutBtn = document.getElementById('account-logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', UI.logout);
    const resetBtn = document.getElementById('account-reset-btn');
    if (resetBtn) resetBtn.addEventListener('click', UI.resetDemo);
    setTimeout(() => document.addEventListener('click', UI._accountOutsideClick, true), 0);
  },
  closeAccountDropdown() {
    const el = document.getElementById('account-dropdown');
    if (el) el.classList.remove('is-open');
    document.querySelectorAll('#app-userchip-btn, #app-avatar-btn').forEach(b => b.setAttribute('aria-expanded', 'false'));
    document.removeEventListener('click', UI._accountOutsideClick, true);
  },
  _accountOutsideClick(e) {
    const el = document.getElementById('account-dropdown');
    if (!el) return;
    if (el.contains(e.target) || e.target.closest('#app-userchip-btn, #app-avatar-btn')) return;
    UI.closeAccountDropdown();
  },
  accountDropdownHTML() {
    return `
      <div class="account-dropdown__head">
        <b>${UTILISATEUR.nom}</b>
        <span>${UTILISATEUR.email}</span>
      </div>
      <div class="account-dropdown__body">
        <a class="account-dropdown__item" href="parametres.html">${UI._ic('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>')} Paramètres</a>
        <button type="button" class="account-dropdown__item" id="account-reset-btn">${UI._ic('<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>')} Réinitialiser les données de démo</button>
        <div class="account-dropdown__sep"></div>
        <button type="button" class="account-dropdown__item account-dropdown__item--danger" id="account-logout-btn">${UI._ic('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>')} Se déconnecter</button>
      </div>`;
  },
  logout() {
    UI.closeAccountDropdown();
    window.location.href = '../login.html';
  },
  resetDemo() {
    UI.closeAccountDropdown();
    if (confirm('Réinitialiser toutes les données de démo (réservations, tâches, prestataires, paramètres…) ? Cette action est irréversible.')) {
      resetOyviaState();
    }
  },
  // Simule l'arrivée d'une notification push : un seul toast par session,
  // uniquement s'il y a au moins une alerte urgente à signaler à l'hôte.
  maybeShowNotifPush() {
    if (sessionStorage.getItem('oyvia_notif_pushed')) return;
    const urgentes = getNotifications().filter(n => n.urgence === 'high');
    if (!urgentes.length) return;
    sessionStorage.setItem('oyvia_notif_pushed', '1');
    setTimeout(() => {
      let zone = document.querySelector('.toast-zone');
      if (!zone) { zone = document.createElement('div'); zone.className = 'toast-zone'; document.body.appendChild(zone); }
      const t = document.createElement('div');
      t.className = 'toast toast--notif';
      t.innerHTML = `${UI._ic('<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>')} ${urgentes.length} alerte${urgentes.length > 1 ? 's' : ''} à traiter avant l’arrivée — voir les notifications`;
      t.addEventListener('click', () => { t.remove(); UI.toggleNotifDropdown(); });
      zone.appendChild(t);
      setTimeout(() => t.remove(), 5000);
    }, 1200);
  },

  // Panneau de détail d'une réservation — partagé (calendrier, réservations, voyageurs…)
  openResa(id) {
    const r = getReservation(id); if (!r) return;
    let el = document.getElementById('ui-resa-panel');
    if (!el) { el = document.createElement('aside'); el.id = 'ui-resa-panel'; el.className = 'panel'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); document.body.appendChild(el); }
    el.innerHTML = UI.resaPanelHTML(r);
    UI.openPanel('ui-resa-panel');
    el.querySelectorAll('[data-fiche-view]').forEach(b => b.addEventListener('click', () => UI.viewFiche(r.id, parseInt(b.dataset.ficheView, 10))));
    el.querySelectorAll('[data-fiche-pdf]').forEach(b => b.addEventListener('click', () => UI.downloadFichePDF(r.id, parseInt(b.dataset.fichePdf, 10))));
    // Accepter / refuser une demande. Le panneau est partagé : la même
    // décision est donc possible depuis le calendrier et depuis la liste.
    el.querySelectorAll('[data-demande-ok]').forEach(b => b.addEventListener('click', () => {
      accepterDemande(b.dataset.demandeOk);
      UI.openResa(b.dataset.demandeOk);                 // rafraîchit le panneau
      document.dispatchEvent(new Event('resaChanged'));
      UI.toast('Réservation confirmée');
    }));
    el.querySelectorAll('[data-demande-no]').forEach(b => b.addEventListener('click', () => {
      const rid = b.dataset.demandeNo;
      UI.confirm({
        title: 'Refuser cette demande ?',
        message: "Les dates seront libérées et redeviendront réservables, ici comme sur vos autres canaux.\n\nPensez à prévenir le voyageur : Oyvia ne lui envoie pas de refus automatique.",
        confirmText: 'Refuser la demande',
        cancelText: 'Revenir',
        danger: true,
        onConfirm() {
          refuserDemande(rid);
          UI.openResa(rid);
          document.dispatchEvent(new Event('resaChanged'));
          UI.toast('Demande refusée — dates libérées');
        },
      });
    }));
    el.querySelectorAll('[data-copier-lien]').forEach(b => b.addEventListener('click', () => {
      // On copie l'URL absolue : le lien part par message, il doit être complet.
      const abs = new URL(b.dataset.copierLien, location.href).href;
      (navigator.clipboard ? navigator.clipboard.writeText(abs) : Promise.reject())
        .then(() => UI.toast('Lien du séjour copié'))
        .catch(() => UI.toast('Copie impossible depuis ce navigateur', false));
    }));
  },

  // Petite icône SVG inline (style Lucide, cohérent avec le reste de l'app)
  _ic(paths, w = 2) {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
  },

  /* ---------- Fiches de police : visualisation + export PDF ---------- */
  viewFiche(resaId, i) {
    const r = getReservation(resaId); if (!r) return;
    const f = getFichesPolice(resaId)[i];
    if (!f) { UI.toast('Cette fiche n’a pas encore été complétée', false); return; }
    let el = document.getElementById('ui-fiche-modal');
    if (!el) { el = document.createElement('div'); el.id = 'ui-fiche-modal'; el.className = 'modal modal--fiche'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); document.body.appendChild(el); }
    el.innerHTML = UI.ficheModalHTML(r, f, i);
    UI.openPanel('ui-fiche-modal');
    const dl = document.getElementById('fiche-modal-dl');
    if (dl) dl.addEventListener('click', () => UI.downloadFichePDF(resaId, i));
  },
  ficheModalHTML(r, f, i) {
    const l = getLogement(r.logementId);
    const close = `<button class="icon-btn" onclick="UI.closeAll()" aria-label="Fermer">${UI._ic('<path d="M18 6 6 18M6 6l12 12"/>')}</button>`;
    const soumis = f.soumisLe ? new Date(f.soumisLe).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';
    const field = (label, val) => `<div class="fiche-doc__f"><small>${label}</small><b>${val || '—'}</b></div>`;
    return `<div class="modal__head"><div><h3 class="modal__title">Fiche de police</h3><p class="text-soft text-sm">${f.prenom} ${f.nom} · Voyageur ${i + 1}</p></div>${close}</div>
      <div class="modal__body">
        <div class="fiche-doc">
          <div class="fiche-doc__band"><span class="badge badge--positive">Complétée</span><span class="text-xs text-muted">Conforme à la loi n°80-14</span></div>
          <div class="fiche-doc__grid">
            ${field('Civilité', f.civilite)}
            ${field('Nom', f.nom)}
            ${field('Prénom', f.prenom)}
            ${field('Date de naissance', f.dateNaissance ? formatDate(f.dateNaissance, { moisLong: true, annee: true }) : '')}
            ${field('Lieu de naissance', f.lieuNaissance)}
            ${field('Nationalité', f.nationalite)}
            ${field('Pièce d’identité', TYPE_PIECE_LABEL[f.typePiece] || f.typePiece)}
            ${field('N° de pièce', f.numeroPiece)}
            <div class="fiche-doc__f fiche-doc__f--full"><small>Domicile habituel</small><b>${f.adresse || '—'}</b></div>
          </div>
          <div class="rp-section" style="border-top:1px solid var(--c-border); margin-top:var(--sp-4); padding-top:var(--sp-4);">
            <div class="rp-row"><span>Logement</span><span>${l.nom} · ${l.ville}</span></div>
            <div class="rp-row"><span>Séjour</span><span>${formatPlage(r.arrivee, r.depart)}</span></div>
            <div class="rp-row"><span>Réservation</span><span>${r.ref}</span></div>
            <div class="rp-row"><span>Fiche soumise le</span><span>${soumis}</span></div>
          </div>
        </div>
      </div>
      <div class="modal__foot">
        <button type="button" class="btn btn--secondary" onclick="UI.closeAll()">Fermer</button>
        <button type="button" class="btn btn--primary" id="fiche-modal-dl">${UI._ic('<path d="M12 3v12m0 0 4-4m-4 4-4-4"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>')} Télécharger en PDF</button>
      </div>`;
  },
  _loadJsPDF() {
    if (window.jspdf) return Promise.resolve();
    if (UI._jspdfLoading) return UI._jspdfLoading;
    UI._jspdfLoading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('jsPDF non chargé'));
      document.head.appendChild(s);
    });
    return UI._jspdfLoading;
  },
  downloadFichePDF(resaId, i) {
    const r = getReservation(resaId); if (!r) return;
    const f = getFichesPolice(resaId)[i];
    if (!f) { UI.toast('Cette fiche n’a pas encore été complétée', false); return; }
    const l = getLogement(r.logementId);
    UI._loadJsPDF().then(() => {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const marginX = 20;
      let y = 22;

      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(140);
      doc.text('OYVIA', marginX, y);
      y += 11;
      doc.setTextColor(15);
      doc.setFontSize(17);
      doc.text('Fiche de police — Renseignements du voyageur', marginX, y);
      y += 7;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(110);
      doc.text('Conforme aux dispositions de la loi n°80-14 relative à l’hébergement touristique', marginX, y);
      doc.setTextColor(20);
      y += 9;
      doc.setDrawColor(220); doc.line(marginX, y, pageW - marginX, y);
      y += 10;

      const row = (label, value) => {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(130);
        doc.text(label.toUpperCase(), marginX, y);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(12); doc.setTextColor(20);
        doc.text(String(value || '—'), marginX, y + 6);
        y += 15;
      };

      row('Civilité / Nom / Prénom', `${f.civilite || ''} ${f.nom} ${f.prenom}`.trim());
      row('Date et lieu de naissance', `${f.dateNaissance ? formatDate(f.dateNaissance, { moisLong: true, annee: true }) : '—'}${f.lieuNaissance ? ' à ' + f.lieuNaissance : ''}`);
      row('Nationalité', f.nationalite);
      row('Domicile habituel', f.adresse);
      row('Pièce d’identité', `${TYPE_PIECE_LABEL[f.typePiece] || f.typePiece} — n° ${f.numeroPiece}`);

      y += 1;
      doc.setDrawColor(220); doc.line(marginX, y, pageW - marginX, y);
      y += 10;

      row('Logement', `${l.nom} · ${l.ville}`);
      row('Séjour', formatPlage(r.arrivee, r.depart));
      row('Référence de réservation', r.ref);
      row('Fiche soumise le', f.soumisLe ? new Date(f.soumisLe).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—');

      doc.setFontSize(8.5); doc.setTextColor(150);
      doc.text('Document généré automatiquement par Oyvia — à conserver avec le dossier de réservation.', marginX, 284);

      const filename = `fiche-police-${(f.nom || 'voyageur')}-${(f.prenom || '')}`
        .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      doc.save(`${filename}.pdf`);
      UI.toast('Fiche téléchargée en PDF');
    }).catch(() => UI.toast('Impossible de générer le PDF (connexion internet requise)', false));
  },
  deleteResa(id) {
    const i = RESERVATIONS.findIndex(r => r.id === id);
    if (i > -1) RESERVATIONS.splice(i, 1);
    // Les tâches créées pour ce blocage n'ont plus lieu d'être : sinon un prestataire
    // resterait assigné à un blocage supprimé (tâche fantôme dans le planning).
    let n = 0;
    for (let k = TACHES.length - 1; k >= 0; k--) { if (TACHES[k].reservationId === id) { TACHES.splice(k, 1); n++; } }
    UI.closeAll();
    UI.toast(n ? `Dates débloquées · ${n} tâche${n > 1 ? 's' : ''} supprimée${n > 1 ? 's' : ''}` : 'Dates débloquées');
    document.dispatchEvent(new Event('resaChanged'));
  },
  resaPanelHTML(r) {
    const close = '<button class="icon-btn" onclick="UI.closeAll()" aria-label="Fermer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg></button>';
    const l = getLogement(r.logementId);
    if (r.canal === 'bloque') {
      const STATUT_TACHE = { a_faire: ['badge--warning', 'À faire'], en_cours: ['badge--accent', 'En cours'], termine: ['badge--positive', 'Terminé'] };
      const tachesBloc = TACHES.filter(t => t.reservationId === r.id);
      const prestRows = tachesBloc.length
        ? tachesBloc.map(t => {
          const p = getPrestataire(t.prestataireId);
          const [cls, txt] = STATUT_TACHE[t.statut] || ['badge--neutral', t.statut];
          const quand = (t.dateFin && t.dateFin !== t.date)
            ? `${formatPlage(t.date, t.dateFin)} · ${nuitsEntre(t.date, t.dateFin) + 1} jours`
            : `${formatDate(t.date)} · ${t.heure}`;
          return `<div class="rp-fiche">
              <div class="rp-fiche__who">
                <span class="rp-fiche__ic rp-fiche__ic--done">${UI._ic('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/>')}</span>
                <div><b>${p ? p.nom : '—'}</b><small class="text-muted">${TACHE_LABEL[t.type] || t.type} · ${quand}</small></div>
              </div>
              <span class="badge ${cls}">${txt}</span>
            </div>`;
        }).join('')
        : '<p class="text-muted text-sm">Aucun prestataire assigné à ce blocage.</p>';

      return `<div class="panel__head"><div><span class="chip-canal chip-canal--bloque">Blocage manuel</span>
          <h3 style="margin-top:8px;">${r.note || 'Dates bloquées'}</h3><p class="text-soft text-sm">${l.nom} · ${l.ville}</p></div>${close}</div>
        <div class="panel__body">
          <div class="rp-section"><p class="eyebrow mb-2">Blocage</p>
            <div class="rp-row"><span>Motif</span><span class="fw-semibold">${r.note || '—'}</span></div>
            <div class="rp-row"><span>Période</span><span>${formatPlage(r.arrivee, r.depart)}</span></div>
            <div class="rp-row"><span>Durée</span><span>${r.nuits} nuit${r.nuits > 1 ? 's' : ''}</span></div>
            <div class="rp-row"><span>Logement</span><span>${l.nom} · ${l.ville}</span></div></div>
          <div class="rp-section"><p class="eyebrow mb-2">Prestataires assignés (${tachesBloc.length})</p>${prestRows}</div>
        </div>
        <div class="panel__foot"><button class="btn btn--danger btn--block" onclick="UI.deleteResa('${r.id}')">Débloquer ces dates</button></div>`;
    }
    const v = r.voyageurId ? getVoyageur(r.voyageurId) : null;
    const conv = getConversationByReservation(r.id);
    const taches = TACHES.filter(t => t.reservationId === r.id);
    const payBadge = { paye: 'badge--positive', acompte: 'badge--warning', impaye: 'badge--danger', rembourse: 'badge--neutral' }[r.paiement] || 'badge--neutral';
    const guestRows = v ? `
      <div class="rp-row"><span>E-mail</span><span>${v.email}</span></div>
      <div class="rp-row"><span>Téléphone</span><span>${v.tel}</span></div>
      <div class="rp-row"><span>Pays</span><span>${v.pays}</span></div>
      <div class="rp-row"><span>Historique</span><span>${v.nbSejours} séjour${v.nbSejours > 1 ? 's' : ''} · ${formatEuro(v.totalDepense)}</span></div>` : '';
    const tacheRows = taches.length ? taches.map(t =>
      `<div class="rp-row"><span>${TACHE_LABEL[t.type]} · ${formatDate(t.date)} ${t.heure}</span><span>${getPrestataire(t.prestataireId) ? getPrestataire(t.prestataireId).nom : '—'}</span></div>`).join('')
      : '<p class="text-muted text-sm">Aucune tâche liée.</p>';
    const totalVoy = r.pers || 1;
    const fiches = getFichesPolice(r.id);
    const ficheDone = fiches.filter(Boolean).length;
    const ficheRows = Array.from({ length: totalVoy }).map((_, i) => {
      const f = fiches[i];
      if (f) return `<div class="rp-fiche">
          <div class="rp-fiche__who">
            <span class="rp-fiche__ic rp-fiche__ic--done">${UI._ic('<path d="M20 6 9 17l-5-5"/>')}</span>
            <div><b>${f.prenom} ${f.nom}</b><small class="text-muted">${f.nationalite || '—'} · ${TYPE_PIECE_LABEL[f.typePiece] || f.typePiece} n° ${f.numeroPiece}</small></div>
          </div>
          <div class="rp-fiche__actions">
            <span class="badge badge--positive">Complétée</span>
            <button type="button" class="icon-btn" title="Visualiser la fiche" aria-label="Visualiser la fiche" data-fiche-view="${i}">${UI._ic('<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>')}</button>
            <button type="button" class="icon-btn" title="Télécharger en PDF" aria-label="Télécharger en PDF" data-fiche-pdf="${i}">${UI._ic('<path d="M12 3v12m0 0 4-4m-4 4-4-4"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>')}</button>
          </div>
        </div>`;
      return `<div class="rp-fiche">
          <div class="rp-fiche__who">
            <span class="rp-fiche__ic rp-fiche__ic--pending">${UI._ic('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>')}</span>
            <div><b>Voyageur ${i + 1}</b><small class="text-muted">Fiche à compléter</small></div>
          </div>
          <span class="badge badge--warning">En attente</span>
        </div>`;
    }).join('');

    // Lien de la page séjour : l'hôte doit pouvoir le prévisualiser et le
    // renvoyer à la main, sans attendre l'automatisation J-1.
    const st = lienSejourStatut(r);
    const url = lienSejour(r, true);
    const lienRows = `
      <div class="rp-row"><span>Statut du lien</span><span>${st.actif
        ? '<span class="badge badge--positive">Ouvert</span>'
        : st.motif === 'trop_tot'
          ? `<span class="badge badge--neutral">Ouvre dans ${st.jours} j</span>`
          : '<span class="badge badge--neutral">Expiré</span>'}</span></div>
      <div class="rp-row"><span>Envoi automatique</span><span>Automatisation J-1</span></div>
      <div class="row gap-2 mt-2">
        <a class="btn btn--secondary btn--sm grow" href="${url}" target="_blank" rel="noopener">Prévisualiser</a>
        <button type="button" class="btn btn--secondary btn--sm grow" data-copier-lien="${url}">Copier le lien</button>
      </div>`;

    // Une demande venue du site attend une décision : elle passe avant tout
    // le reste, sinon on parcourt la fiche sans savoir qu'il faut agir.
    const acompte = Math.round(r.montant * ((SITE_WEB.reservation || {}).acompte || 0) / 100);
    const mailDemandeur = typeof emailDemande === 'function' ? emailDemande(r) : '';
    const blocDecision = r.statut === 'demande' ? `
      <div class="rp-decision">
        <div class="rp-decision__tete">
          <b>Demande à valider</b>
          <span>Reçue depuis votre site${mailDemandeur ? ` · ${mailDemandeur}` : ''}</span>
        </div>
        <p class="rp-decision__txt">
          Les dates sont retenues en attendant votre réponse : personne d'autre ne peut les réserver.
          ${acompte ? `En acceptant, vous demandez un acompte de <b>${formatEuro(acompte)}</b>.` : ''}
        </p>
        <div class="rp-decision__actions">
          <button type="button" class="btn btn--primary grow" data-demande-ok="${r.id}">Accepter la réservation</button>
          <button type="button" class="btn btn--secondary" data-demande-no="${r.id}">Refuser</button>
        </div>
      </div>` : '';

    // Une demande refusée reste consultable : on explique pourquoi elle est là.
    const blocRefus = r.statut === 'annule' && r.motifRefus !== undefined ? `
      <div class="rp-decision rp-decision--refus">
        <div class="rp-decision__tete"><b>Demande refusée</b><span>${r.refuseeLe ? formatDate(r.refuseeLe) : ''}</span></div>
        ${r.motifRefus ? `<p class="rp-decision__txt">Motif : ${r.motifRefus}</p>` : ''}
        <p class="rp-decision__txt">Les dates ont été libérées et redeviennent réservables.</p>
      </div>` : '';

    return `<div class="panel__head"><div><span class="chip-canal chip-canal--${r.canal}">${CANAL_LABEL[r.canal]}</span>
        <h3 style="margin-top:8px;">${r.voyageur}</h3><p class="text-soft text-sm">${l.nom} · ${l.ville}</p></div>${close}</div>
      <div class="panel__body">
        ${blocDecision}${blocRefus}
        <div class="rp-section"><p class="eyebrow mb-2">Séjour</p>
          <div class="rp-row"><span>Dates</span><span>${formatPlage(r.arrivee, r.depart)}</span></div>
          <div class="rp-row"><span>Nuits</span><span>${r.nuits}</span></div>
          <div class="rp-row"><span>Voyageurs</span><span>${r.pers} personne${r.pers > 1 ? 's' : ''}</span></div>
          <div class="rp-row"><span>Référence</span><span>${r.ref}</span></div></div>
        <div class="rp-section"><p class="eyebrow mb-2">Paiement</p>
          <div class="rp-row"><span>Montant total</span><span class="fw-semibold">${formatEuro(r.montant)}</span></div>
          <div class="rp-row"><span>Statut</span><span><span class="badge ${payBadge}">${PAIEMENT_LABEL[r.paiement]}</span></span></div></div>
        <div class="rp-section"><p class="eyebrow mb-2">Voyageur</p>${guestRows}</div>
        <div class="rp-section"><p class="eyebrow mb-2">Fiches de police (${ficheDone}/${totalVoy})</p>${ficheRows}</div>
        <div class="rp-section"><p class="eyebrow mb-2">Tâches liées</p>${tacheRows}</div>
        <div class="rp-section"><p class="eyebrow mb-2">Page séjour du voyageur</p>${lienRows}</div>
      </div>
      <div class="panel__foot"><div class="row gap-2">
        <a class="btn btn--secondary grow" href="${mailDemandeur ? `mailto:${mailDemandeur}` : 'messagerie.html'}">${
          mailDemandeur ? 'Écrire au demandeur' : conv ? 'Ouvrir la conversation' : 'Écrire au voyageur'}</a>
        <a class="btn btn--primary grow" href="reservations.html?r=${r.id}">Voir la réservation</a></div></div>`;
  },
};
document.addEventListener('keydown', e => { if (e.key === 'Escape') UI.closeAll(); });
