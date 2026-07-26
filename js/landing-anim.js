/* ============================================================
   OYVIA — Animations de la landing (vanilla, sans dépendance)
   ============================================================ */
(function () {
  /* ---------- Hero : le calendrier se synchronise ---------- */
  (function heroCalendar() {
    const bars = [...document.querySelectorAll('.lp-window .hcal__bar')];
    const sync = document.getElementById('hcal-sync');
    if (!bars.length) return;
    const setSync = on => { if (!sync) return; sync.classList.toggle('is-syncing', on); sync.lastChild.textContent = on ? ' Synchronisation…' : ' À jour'; };
    function cycle() {
      bars.forEach(b => b.classList.remove('is-in'));
      setSync(true);
      bars.forEach((b, i) => setTimeout(() => b.classList.add('is-in'), 300 + i * 230));
      setTimeout(() => setSync(false), 300 + bars.length * 230 + 300);
    }
    cycle();
    setInterval(cycle, 7000);
  })();

  /* ---------- Démo tâches : le statut évolue (synchronisé partout où il apparaît) ---------- */
  (function taskStatus() {
    const els = [...document.querySelectorAll('.dt-status')];
    if (!els.length) return;
    const states = [
      { t: 'À faire', c: 'badge--warning' },
      { t: 'En cours', c: 'badge--accent' },
      { t: 'Terminé', c: 'badge--positive' },
    ];
    let i = 0;
    setInterval(() => {
      i = (i + 1) % states.length;
      els.forEach(el => { el.className = 'badge dt-status ' + states[i].c; el.textContent = states[i].t; });
    }, 1900);
  })();

  /* ---------- Slider : ce qui vous fait perdre du temps ---------- */
  (function problemsSlider() {
    const root = document.getElementById('pbSlider');
    if (!root) return;
    const viewport = document.getElementById('pbViewport');
    const track = document.getElementById('pbTrack');
    const slides = [...track.children];
    const dotsWrap = document.getElementById('pbDots');
    const prevBtn = document.getElementById('pbPrev');
    const nextBtn = document.getElementById('pbNext');
    let index = 0;
    let autoplay = null;
    let snapRestore = null;

    slides.forEach((_, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pb-dot' + (i === 0 ? ' is-active' : '');
      b.setAttribute('aria-label', "Aller à l'élément " + (i + 1));
      b.addEventListener('click', () => goTo(i));
      dotsWrap.appendChild(b);
    });
    const dots = [...dotsWrap.children];

    function setActive(i) {
      index = i;
      dots.forEach((d, di) => d.classList.toggle('is-active', di === i));
    }
    function goTo(i, smooth = true) {
      const clamped = (i + slides.length) % slides.length;
      // Chaque slide fait 100% de la largeur du viewport : on cible un multiple exact
      // plutôt que offsetLeft, qui se calcule par rapport à l'offsetParent et pas au scroller.
      // Le snap CSS est coupé le temps du scroll animé : sinon, avec scroll-snap-type
      // mandatory, un saut programmatique de plusieurs slides (dot lointaine, retour au
      // début) peut être écourté au premier point de snap rencontré au lieu de la cible.
      if (smooth) {
        viewport.style.scrollSnapType = 'none';
        clearTimeout(snapRestore);
        snapRestore = setTimeout(() => { viewport.style.scrollSnapType = ''; }, 550);
      }
      viewport.scrollTo({ left: clamped * viewport.clientWidth, behavior: smooth ? 'smooth' : 'auto' });
    }
    prevBtn.addEventListener('click', () => { goTo(index - 1); restart(); });
    nextBtn.addEventListener('click', () => { goTo(index + 1); restart(); });

    // Suit le scroll (swipe tactile, molette, flèches) pour garder les puces synchronisées
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting && e.intersectionRatio > 0.6) setActive(slides.indexOf(e.target));
      });
    }, { root: viewport, threshold: [0.6] });
    slides.forEach(s => io.observe(s));

    function start() {
      stop();
      autoplay = setInterval(() => goTo(index + 1), 5000);
    }
    function stop() { if (autoplay) clearInterval(autoplay); }
    function restart() { stop(); start(); }

    start();
    root.addEventListener('mouseenter', stop);
    root.addEventListener('mouseleave', start);
    root.addEventListener('touchstart', stop, { passive: true });
    window.addEventListener('resize', () => goTo(index, false));
  })();

  /* ---------- Démo stats : révélée au scroll + compteurs ---------- */
  (function statsReveal() {
    const ds = document.querySelector('.lp-demo--stats .ds');
    if (!ds) return;
    function countUp(el, target, fmt) {
      const dur = 1100, t0 = performance.now();
      (function step(now) {
        const p = Math.min((now - t0) / dur, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = fmt(Math.round(target * eased));
        if (p < 1) requestAnimationFrame(step);
      })(t0);
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (!e.isIntersecting || ds.classList.contains('is-viz')) return;
        ds.classList.add('is-viz');
        const ca = document.getElementById('ds-kpi-ca');
        const occ = document.getElementById('ds-kpi-occ');
        if (ca) countUp(ca, 34600, n => n.toLocaleString('fr-FR') + ' €');
        if (occ) countUp(occ, 86, n => n + ' %');
      });
    }, { threshold: 0.4 });
    io.observe(ds);
  })();

  /* ---------- Démo fiche de police : barre + fiches révélées au scroll ---------- */
  (function policeReveal() {
    const dpo = document.querySelector('.lp-demo--police .dpo');
    if (!dpo) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        dpo.classList.add('is-viz');
        io.disconnect();
      });
    }, { threshold: 0.35 });
    io.observe(dpo);
  })();

  /* ---------- Nav mobile : menu déroulant (burger) ---------- */
  (function mobileNav() {
    const btn = document.getElementById('lp-burger-btn');
    const menu = document.getElementById('lp-navlinks');
    if (!btn || !menu) return;

    function close() {
      menu.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
    }
    function open() {
      menu.classList.add('is-open');
      btn.setAttribute('aria-expanded', 'true');
    }

    btn.addEventListener('click', e => {
      e.stopPropagation();
      menu.classList.contains('is-open') ? close() : open();
    });
    // Referme au clic sur un lien (ancre ou page) et au clic en dehors
    menu.addEventListener('click', e => { if (e.target.closest('a')) close(); });
    document.addEventListener('click', e => {
      if (!menu.classList.contains('is-open')) return;
      if (menu.contains(e.target) || btn.contains(e.target)) return;
      close();
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    // Si on repasse en desktop (rotation, redimensionnement), on referme proprement
    window.addEventListener('resize', () => { if (window.innerWidth > 900) close(); });
  })();

  /* ---------- Sélecteur de langue (visuel — aucune traduction réelle dans cette maquette) ---------- */
  (function langSwitcher() {
    const btn = document.getElementById('lp-lang-btn');
    const menu = document.getElementById('lp-lang-menu');
    const langsMobile = document.getElementById('lp-navlinks-langs');
    if (!btn && !menu && !langsMobile) return;

    const LANG_NAMES = { fr: '🇫🇷 Français', en: '🇬🇧 English', es: '🇪🇸 Español', de: '🇩🇪 Deutsch', ar: '🇲🇦 العربية' };
    const LANG_FLAGS = { fr: '🇫🇷', en: '🇬🇧', es: '🇪🇸', de: '🇩🇪', ar: '🇲🇦' };
    const flagEl = document.getElementById('lp-lang-flag');

    function close() { if (!menu) return; menu.classList.remove('is-open'); btn.setAttribute('aria-expanded', 'false'); }
    function open() { if (!menu) return; menu.classList.add('is-open'); btn.setAttribute('aria-expanded', 'true'); }

    function toast(msg) {
      let zone = document.querySelector('.toast-zone');
      if (!zone) { zone = document.createElement('div'); zone.className = 'toast-zone'; document.body.appendChild(zone); }
      const t = document.createElement('div');
      t.className = 'toast';
      t.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg> ${msg}`;
      zone.appendChild(t);
      setTimeout(() => t.remove(), 2600);
    }

    // Sélectionner une langue met à jour les DEUX menus (icône desktop + ligne repliée mobile), qu'ils soient visibles ou non
    function selectLang(lang) {
      document.querySelectorAll('[data-lang]').forEach(i => i.classList.toggle('is-active', i.dataset.lang === lang));
      if (flagEl && LANG_FLAGS[lang]) flagEl.textContent = LANG_FLAGS[lang];
      toast(`Langue changée : ${LANG_NAMES[lang] || lang}`);
    }

    if (btn && menu) {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        menu.classList.contains('is-open') ? close() : open();
      });
      menu.addEventListener('click', e => {
        const item = e.target.closest('[data-lang]'); if (!item) return;
        close();
        selectLang(item.dataset.lang);
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
        selectLang(item.dataset.lang);
      });
    }
  })();
})();
