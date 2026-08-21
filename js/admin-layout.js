/* ============================================================
   OYVIA — Shell du back-office (usage interne)

   Volontairement séparé de js/layout.js : le menu client et le menu
   interne n'ont ni le même contenu, ni le même public, ni le même
   risque. Les mélanger dans un seul fichier aurait fini par exposer
   une entrée « Comptes clients » à un hôte sur un mauvais `if`.

   La boîte à outils UI (toasts, modales, confirmation) reste partagée :
   c'est du vocabulaire d'interface, pas de la donnée.

   Usage :  AdminLayout.init('comptes');
   ============================================================ */
const AdminLayout = (function () {

  const I = {
    vue:        '<path d="M3 3v18h18"/><path d="M18 17V9M13 17V5M8 17v-3"/>',
    comptes:    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    demandes:   '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    revenus:    '<path d="M12 2v20"/><path d="M17 7H9.5a3 3 0 0 0 0 6h5a3 3 0 0 1 0 6H6"/>',
    plateforme: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    equipe:     '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18"/><circle cx="8" cy="15" r="1.6"/><path d="M13 14h5M13 17h3"/>',
    blog:       '<path d="M4 4h11l5 5v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z"/><path d="M14 4v6h6"/><path d="M7 13h8M7 17h5"/>',
    retour:     '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
    menu:       '<path d="M4 6h16M4 12h16M4 18h16"/>',
  };

  const NAV = [
    { id:'vue',        label:"Vue d'ensemble", title:"Vue d'ensemble",        href:'index.html',      perm:'vue' },
    { id:'comptes',    label:'Comptes clients', title:'Comptes clients',      href:'comptes.html',    perm:'comptes' },
    { id:'demandes',   label:'Demandes',        title:'Demandes clients',     href:'demandes.html',   perm:'demandes', badge:'demandes' },
    { id:'revenus',    label:'Revenus',         title:'Revenus & facturation',href:'revenus.html',    perm:'revenus' },
    { id:'plateforme', label:'Plateforme',      title:'Santé de la plateforme',href:'plateforme.html',perm:'plateforme', badge:'incidents' },
    { id:'blog',       label:'Blog',            title:'Blog — articles',      href:'blog.html',       perm:'blog', badge:'brouillons' },
    { id:'equipe',     label:'Équipe Oyvia',    title:'Équipe Oyvia & journal',href:'equipe.html',    perm:'equipe' },
  ];

  const NAV_GROUPS = [
    { label:'Pilotage',  items:['vue'] },
    { label:'Clients',   items:['comptes', 'demandes'] },
    { label:'Finance',   items:['revenus'] },
    { label:'Technique', items:['plateforme'] },
    { label:'Contenu',   items:['blog'] },
    { label:'Oyvia',     items:['equipe'] },
  ];

  const BADGES = {
    demandes:  () => demandesOuvertes().length,
    incidents: () => incidentsOuverts().length,
    // Compte ce qui attend une décision éditoriale : brouillons et
    // articles programmés. Les articles en ligne, eux, ne demandent rien.
    brouillons: () => (typeof ARTICLES === 'undefined' ? 0
      : ARTICLES.filter(a => statutArticleReel(a) !== 'publie').length),
  };
  function badgeCount(id) {
    const f = BADGES[id];
    if (!f) return 0;
    try { return f() || 0; } catch { return 0; }
  }

  function svg(paths, w) {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w || 2}" stroke-linecap="round" stroke-linejoin="round">${paths || ''}</svg>`;
  }

  /* Une entrée dont le rôle n'a pas la permission n'est pas grisée, elle
     n'existe pas. Griser aurait renseigné sur ce qui se trouve derrière —
     et donné envie de demander l'accès plutôt que de travailler. */
  function entreesVisibles() {
    return NAV.filter(n => !n.perm || peutAdmin(n.perm));
  }

  function sidebarHTML(active) {
    const visibles = entreesVisibles();
    const fichier = location.pathname.split('/').pop() || 'index.html';

    const itemHTML = n => {
      const nb = n.badge ? badgeCount(n.badge) : 0;
      const badge = nb > 0 ? `<span class="app-navitem__badge">${nb}</span>` : '';
      const estActive = n.href === fichier || n.id === active;
      return `<a class="app-navitem ${estActive ? 'is-active' : ''}" href="${n.href}">
        ${svg(I[n.id])}<span>${n.label}</span>${badge}</a>`;
    };

    const groupes = NAV_GROUPS.map(g => {
      const items = g.items.map(id => visibles.find(n => n.id === id)).filter(Boolean).map(itemHTML).join('');
      return items ? `<p class="app-navlabel">${g.label}</p>${items}` : '';
    }).join('');

    const m = membreCourant();
    return `
      <div class="app-sidebar__brand adm-brand">
        <img src="../assets/oyvia-logo.svg" alt="Oyvia" class="brand-logo">
        <span class="adm-brand__tag">Back-office</span>
      </div>
      <nav class="app-sidebar__nav" aria-label="Navigation interne">
        ${groupes}
        <p class="app-navlabel">Application</p>
        <a class="app-navitem" href="../app/dashboard.html">${svg(I.retour)}<span>Revenir à l'app cliente</span></a>
      </nav>
      <div class="app-sidebar__foot">
        <div class="app-userchip" style="cursor:default">
          <span class="avatar avatar--sm">${m.initiales}</span>
          <div class="app-userchip__meta grow">
            <b>${m.nom}</b><span>${getRoleAdmin(m.roleId).nom}</span>
          </div>
        </div>
      </div>`;
  }

  /* Bascule de membre. Ce n'est pas un gadget de démonstration : les
     permissions ne se vérifient qu'en changeant de siège, et une équipe
     qui n'a jamais vu son back-office avec les yeux du support découvre
     les trous le jour où elle recrute. */
  function selecteurMembre() {
    const m = membreCourant();
    const options = MEMBRES_OYVIA.filter(x => x.statut === 'actif')
      .map(x => `<option value="${x.id}" ${x.id === m.id ? 'selected' : ''}>${x.nom} · ${getRoleAdmin(x.roleId).nom}</option>`).join('');
    return `<select class="select adm-membre" id="adm-membre" aria-label="Membre connecté">${options}</select>`;
  }

  function topbarHTML(nav) {
    return `
      <button class="btn btn--secondary btn--icon btn--sm app-topbar__menu" id="app-menu-btn" aria-label="Menu">${svg(I.menu)}</button>
      <h1 class="app-topbar__title">${nav.title}</h1>
      <span class="adm-env">Interne</span>
      <div class="grow"></div>
      ${selecteurMembre()}
      <a class="btn btn--secondary btn--sm" href="../app/dashboard.html">${svg(I.retour)} App cliente</a>`;
  }

  /* Garde-fou de page : une adresse se tape, et rien n'empêche un membre
     du support d'ouvrir /admin/revenus.html à la main. La page se rend
     alors vide, avec la raison affichée. */
  function verrouiller(perm) {
    if (!perm || peutAdmin(perm)) return false;
    const main = document.querySelector('.app-main');
    if (main) main.innerHTML = `
      <div class="card card--pad adm-verrou">
        <div class="adm-verrou__ic">${svg('<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>')}</div>
        <h2>Section réservée</h2>
        <p>Votre rôle (${getRoleAdmin(membreCourant().roleId).nom}) ne donne pas accès à cette section.
           Demandez la permission « ${(PERMISSIONS_ADMIN.find(p => p.id === perm) || {}).label || perm} » à la direction.</p>
        <a class="btn btn--primary" href="index.html">Retour à la vue d'ensemble</a>
      </div>`;
    return true;
  }

  function init(active) {
    const nav = NAV.find(n => n.id === active) || NAV[0];
    document.title = `Oyvia interne — ${nav.title}`;
    document.body.classList.add('is-admin');

    document.querySelectorAll('[data-devise]').forEach(el => { el.textContent = symboleDevise(); });

    const sidebar = document.getElementById('app-sidebar');
    const topbar = document.getElementById('app-topbar');
    if (sidebar) sidebar.innerHTML = sidebarHTML(active);
    if (topbar) topbar.innerHTML = topbarHTML(nav);

    // Tiroir mobile, repris du shell client : même geste, même attente.
    let scrim = document.querySelector('.app-scrim');
    if (!scrim) { scrim = document.createElement('div'); scrim.className = 'app-scrim'; document.body.appendChild(scrim); }
    const fermer = () => { sidebar && sidebar.classList.remove('is-open'); scrim.classList.remove('is-open'); };
    scrim.addEventListener('click', fermer);
    const menuBtn = document.getElementById('app-menu-btn');
    if (menuBtn) menuBtn.addEventListener('click', () => {
      sidebar.classList.toggle('is-open'); scrim.classList.toggle('is-open');
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') fermer(); });

    const sel = document.getElementById('adm-membre');
    if (sel) sel.addEventListener('change', e => {
      ADMIN_MEMBRE.id = e.target.value;
      saveOyviaState();
      location.reload();   // le menu et les garde-fous dépendent du rôle
    });

    return verrouiller(nav.perm);
  }

  // Rafraîchit les pastilles sans redessiner la barre entière.
  function refreshBadges() {
    const sidebar = document.getElementById('app-sidebar');
    if (!sidebar) return;
    NAV.filter(n => n.badge).forEach(n => {
      const lien = sidebar.querySelector(`.app-navitem[href="${n.href}"]`);
      if (!lien) return;
      const nb = badgeCount(n.badge);
      let el = lien.querySelector('.app-navitem__badge');
      if (!nb) { if (el) el.remove(); return; }
      if (!el) { el = document.createElement('span'); el.className = 'app-navitem__badge'; lien.appendChild(el); }
      el.textContent = nb;
    });
  }

  return { init, refreshBadges, svg, NAV };
})();

/* --------- Fragments d'interface communs au back-office --------- */
const Adm = {
  ic(paths, w = 2) { return AdminLayout.svg(paths, w); },

  kpi({ label, valeur, pied = '', icone = '', ton = '' }) {
    return `<div class="kpi ${ton ? 'kpi--' + ton : ''}">
      <div class="kpi__label">${label}</div>
      <div class="kpi__value">${valeur}</div>
      ${pied ? `<div class="kpi__foot">${pied}</div>` : ''}
      ${icone ? `<div class="kpi__icon">${Adm.ic(icone)}</div>` : ''}
    </div>`;
  },

  badge(map, cle) {
    const s = map[cle];
    return s ? `<span class="badge ${s.badge}">${s.label}</span>` : `<span class="badge badge--neutral">${cle || '—'}</span>`;
  },

  vide(titre, texte) {
    return `<div class="empty">
      ${Adm.ic('<circle cx="12" cy="12" r="9"/><path d="M9 12h6"/>')}
      <h4>${titre}</h4><p>${texte}</p></div>`;
  },

  // Options d'un <select>, avec sélection courante.
  options(liste, valeur, cleId = 'id', cleLabel = 'label') {
    return liste.map(o => {
      const id = typeof o === 'string' ? o : o[cleId];
      const lb = typeof o === 'string' ? o : o[cleLabel];
      return `<option value="${id}" ${id === valeur ? 'selected' : ''}>${lb}</option>`;
    }).join('');
  },

  // Initiales pour les pastilles d'assignation.
  initiales(nom) {
    return (nom || '?').split(' ').map(m => m[0]).slice(0, 2).join('').toUpperCase();
  },
};
