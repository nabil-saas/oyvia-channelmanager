/* ============================================================
   OYVIA — Comportements de la landing (vanilla, sans dépendance)

   Peu d'animations, et chacune sert à quelque chose :
     · une révélation discrète à l'entrée dans l'écran,
     · le calendrier du hero qui se remplit pour montrer la
       synchronisation,
     · la visite guidée du produit, dont le défilement automatique
       est cadencé par l'animation CSS du filet de progression —
       pas par un setInterval qui se désynchroniserait de lui.
   ============================================================ */
(function () {
  const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Révélation au défilement ----------
     Le décalage est calculé ici, d'après le rang de l'élément
     parmi ses frères révélables : aucun délai n'est écrit à la
     main dans le HTML, donc réordonner une grille ne casse rien.

     Mesure directe plutôt qu'IntersectionObserver : l'observateur
     ne se déclenche pas tant que le document n'est pas peint, et
     une page dont tout le texte attend un callback pour devenir
     visible est une page qui peut rester blanche. Ici, au pire,
     un écouteur de défilement ne s'exécute pas — mais le premier
     passage, lui, est synchrone. */
  (function reveal() {
    let restants = [...document.querySelectorAll('[data-reveal]')];
    if (!restants.length) return;
    if (reduit) { restants.forEach(el => el.classList.add('is-in')); return; }

    restants.forEach(el => {
      const freres = [...el.parentElement.children].filter(n => n.hasAttribute('data-reveal'));
      const rang = freres.indexOf(el);
      if (rang > 0) el.style.setProperty('--rd', (rang * 0.07).toFixed(2) + 's');
    });

    let planifie = false;
    function verifier() {
      planifie = false;
      const h = window.innerHeight;
      restants = restants.filter(el => {
        const r = el.getBoundingClientRect();
        if (r.top < h - 40 && r.bottom > 0) { el.classList.add('is-in'); return false; }
        return true;
      });
      if (!restants.length) {
        window.removeEventListener('scroll', planifier);
        window.removeEventListener('resize', planifier);
      }
    }
    function planifier() {
      if (planifie) return;
      planifie = true;
      requestAnimationFrame(verifier);
    }
    window.addEventListener('scroll', planifier, { passive: true });
    window.addEventListener('resize', planifier);
    verifier();
    // Les polices et les images décalent la mise en page : on repasse.
    window.addEventListener('load', planifier);
    setTimeout(planifier, 400);
  })();

  /* ---------- Navbar : se densifie dès qu'on quitte le haut ---------- */
  (function stickyNav() {
    const wrap = document.getElementById('lp-navwrap');
    if (!wrap) return;
    const maj = () => wrap.classList.toggle('is-stuck', window.scrollY > 12);
    maj();
    window.addEventListener('scroll', maj, { passive: true });
  })();

  /* ---------- Remplissage d'un calendrier de démonstration ----------
     Les barres apparaissent l'une après l'autre, de la plus à
     gauche à la plus à droite : on lit la synchronisation au lieu
     de la deviner. */
  function remplirCalendrier(racine, retard = 300, pas = 180) {
    const barres = [...racine.querySelectorAll('.lcal__bar')];
    if (!barres.length) return 0;
    barres.forEach(b => b.classList.remove('is-in'));
    if (reduit) { barres.forEach(b => b.classList.add('is-in')); return 0; }
    barres.forEach((b, i) => setTimeout(() => b.classList.add('is-in'), retard + i * pas));
    return retard + barres.length * pas;
  }

  /* ---------- Hero : le calendrier se synchronise en boucle ---------- */
  (function heroCalendar() {
    const stage = document.querySelector('.lp-stage');
    if (!stage) return;
    const sync = document.getElementById('lp-hero-sync');
    const setSync = (enCours) => {
      if (!sync) return;
      sync.classList.toggle('is-syncing', enCours);
      sync.lastChild.textContent = enCours ? ' Synchronisation…' : ' À jour';
    };
    function cycle() {
      setSync(true);
      const duree = remplirCalendrier(stage, 400, 190);
      setTimeout(() => setSync(false), duree + 300);
    }
    cycle();
    if (!reduit) setInterval(cycle, 9000);
  })();

  /* ---------- Visite guidée du produit ---------- */
  (function tour() {
    const racine = document.getElementById('lpTour');
    if (!racine) return;
    const onglets = [...racine.querySelectorAll('.lp-mod')];
    const volets = [...racine.querySelectorAll('.lp-pane')];
    if (!onglets.length || onglets.length !== volets.length) return;

    // Sans JS, l'attribut hidden garde un seul volet visible ; avec JS,
    // c'est la classe qui décide, pour que le fondu soit possible.
    volets.forEach(v => v.removeAttribute('hidden'));

    let courant = 0;
    const comptesFaits = new WeakSet();

    function animerDemo(volet) {
      const cal = volet.querySelector('.lcal');
      if (cal) remplirCalendrier(cal, 150, 150);

      // Reflow forcé plutôt que requestAnimationFrame : la classe doit
      // être reposée dans le même tour, sinon un onglet ouvert alors que
      // la page n'est pas peinte reste vide.
      const dpo = volet.querySelector('.dpo');
      if (dpo) { dpo.classList.remove('is-viz'); void dpo.offsetWidth; dpo.classList.add('is-viz'); }

      const ds = volet.querySelector('.ds');
      if (ds && !comptesFaits.has(ds)) {
        comptesFaits.add(ds);
        ds.classList.add('is-viz');
        compter(volet.querySelector('#ds-kpi-ca'), 34600, n => n.toLocaleString('fr-FR') + ' €');
        compter(volet.querySelector('#ds-kpi-occ'), 86, n => n + ' %');
        compter(volet.querySelector('#ds-kpi-adr'), 128, n => n + ' €');
      }
    }

    function compter(el, cible, format) {
      if (!el) return;
      if (reduit) { el.textContent = format(cible); return; }
      const duree = 1100, t0 = performance.now();
      (function pas(maintenant) {
        const p = Math.min((maintenant - t0) / duree, 1);
        el.textContent = format(Math.round(cible * (1 - Math.pow(1 - p, 3))));
        if (p < 1) requestAnimationFrame(pas);
      })(t0);
    }

    function activer(i) {
      courant = (i + onglets.length) % onglets.length;
      onglets.forEach((o, k) => {
        const actif = k === courant;
        o.classList.toggle('is-active', actif);
        o.setAttribute('aria-selected', actif ? 'true' : 'false');
        o.tabIndex = actif ? 0 : -1;
      });
      volets.forEach((v, k) => v.classList.toggle('is-active', k === courant));

      // Redémarre le filet de progression : sans ce reflow, réactiver
      // le même onglet ne relancerait pas l'animation CSS.
      const filet = onglets[courant].querySelector('.lp-mod__prog i');
      if (filet) { filet.style.animation = 'none'; void filet.offsetWidth; filet.style.animation = ''; }

      animerDemo(volets[courant]);
    }

    // La cadence vient de l'animation CSS du filet : mettre le tour en
    // pause suspend l'animation, donc suspend aussi l'enchaînement.
    racine.addEventListener('animationend', e => {
      if (!e.target.matches('.lp-mod__prog i')) return;
      if (e.target.closest('.lp-mod') !== onglets[courant]) return;
      activer(courant + 1);
    });

    const pause = (oui) => racine.classList.toggle('is-paused', oui);
    racine.addEventListener('mouseenter', () => pause(true));
    racine.addEventListener('mouseleave', () => pause(false));
    racine.addEventListener('focusin', () => pause(true));
    racine.addEventListener('focusout', () => pause(false));
    racine.addEventListener('touchstart', () => pause(true), { passive: true });

    onglets.forEach((o, i) => {
      o.addEventListener('click', () => activer(i));
      o.addEventListener('keydown', e => {
        const suivant = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
        if (!suivant) return;
        e.preventDefault();
        activer(courant + suivant);
        onglets[courant].focus();
      });
    });

    activer(0);
  })();

  /* ---------- Démo tâches : le statut évolue ---------- */
  (function taskStatus() {
    const els = [...document.querySelectorAll('.dt-status')];
    if (!els.length || reduit) return;
    const etats = [
      { t: 'À faire', c: 'badge--warning' },
      { t: 'En cours', c: 'badge--accent' },
      { t: 'Terminé', c: 'badge--positive' },
    ];
    let i = 0;
    setInterval(() => {
      i = (i + 1) % etats.length;
      els.forEach(el => { el.className = 'badge dt-status ' + etats[i].c; el.textContent = etats[i].t; });
    }, 2100);
  })();

  /* ---------- Nav mobile : menu déroulant (burger) ---------- */
  (function mobileNav() {
    const btn = document.getElementById('lp-burger-btn');
    const menu = document.getElementById('lp-navlinks');
    if (!btn || !menu) return;

    const close = () => { menu.classList.remove('is-open'); btn.setAttribute('aria-expanded', 'false'); };
    const open = () => { menu.classList.add('is-open'); btn.setAttribute('aria-expanded', 'true'); };

    btn.addEventListener('click', e => {
      e.stopPropagation();
      menu.classList.contains('is-open') ? close() : open();
    });
    menu.addEventListener('click', e => { if (e.target.closest('a')) close(); });
    document.addEventListener('click', e => {
      if (!menu.classList.contains('is-open')) return;
      if (menu.contains(e.target) || btn.contains(e.target)) return;
      close();
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    window.addEventListener('resize', () => { if (window.innerWidth > 900) close(); });
  })();

  /* ---------- Sélecteur de langue ----------
     Visuel uniquement : aucune traduction réelle dans cette maquette.
     Un code ISO plutôt qu'un drapeau — Windows ne rend pas les drapeaux
     émoji, et une langue n'est de toute façon pas un pays. */
  (function langSwitcher() {
    const btn = document.getElementById('lp-lang-btn');
    const menu = document.getElementById('lp-lang-menu');
    const langsMobile = document.getElementById('lp-navlinks-langs');
    if (!btn && !menu && !langsMobile) return;

    const NOMS = { fr: 'Français', en: 'English', es: 'Español', de: 'Deutsch', ar: 'العربية' };
    const code = document.getElementById('lp-lang-code');

    const close = () => { if (menu) { menu.classList.remove('is-open'); btn.setAttribute('aria-expanded', 'false'); } };
    const open = () => { if (menu) { menu.classList.add('is-open'); btn.setAttribute('aria-expanded', 'true'); } };

    function toast(msg) {
      let zone = document.querySelector('.toast-zone');
      if (!zone) { zone = document.createElement('div'); zone.className = 'toast-zone'; document.body.appendChild(zone); }
      const t = document.createElement('div');
      t.className = 'toast';
      t.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg> ${msg}`;
      zone.appendChild(t);
      setTimeout(() => t.remove(), 2600);
    }

    // Les deux menus (icône desktop, ligne repliée mobile) restent d'accord.
    function choisir(lang) {
      document.querySelectorAll('[data-lang]').forEach(i => i.classList.toggle('is-active', i.dataset.lang === lang));
      if (code) code.textContent = lang.toUpperCase();
      toast(`Langue changée : ${NOMS[lang] || lang}`);
    }

    if (btn && menu) {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        menu.classList.contains('is-open') ? close() : open();
      });
      menu.addEventListener('click', e => {
        const item = e.target.closest('[data-lang]'); if (!item) return;
        close();
        choisir(item.dataset.lang);
      });
      document.addEventListener('click', e => {
        if (!menu.classList.contains('is-open')) return;
        if (menu.contains(e.target) || btn.contains(e.target)) return;
        close();
      });
      document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    }

    if (langsMobile) {
      langsMobile.addEventListener('click', e => {
        const item = e.target.closest('[data-lang]'); if (!item) return;
        choisir(item.dataset.lang);
      });
    }
  })();
})();
