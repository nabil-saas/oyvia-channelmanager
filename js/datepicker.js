/* ============================================================
   OYVIA — Sélecteur de date contextuel (simple ou par plage)

   Pourquoi ne pas garder le champ natif : <input type="date"> ne
   sait borner qu'un intervalle continu (min/max). Or l'indisponibilité
   réelle est faite de TROUS — un logement loué du 3 au 6 puis du 12 au
   15 laisse deux fenêtres libres, pas une. Il faut donc dessiner la
   grille nous-mêmes pour pouvoir éteindre des jours au milieu.

   Deux modes :

     attach(input, opts)               une seule date
     range(inputDébut, inputFin, opts) une plage, façon Airbnb/Booking :
                                       un seul calendrier, on clique le
                                       début puis la fin, la traînée entre
                                       les deux se colore au survol.

   Le mode plage n'est pas qu'un habillage : tant que le début n'est pas
   posé, on ne peut pas savoir jusqu'où la fin peut aller (elle s'arrête
   à la réservation suivante). Deux calendriers séparés obligeaient à
   deviner cette borne avant d'avoir l'information.

   Distinction volontaire, et c'est le cœur du composant :

     · DÉSACTIVÉ  ce qui est impossible. Réserver une nuit déjà vendue,
                  planifier une intervention dans le passé, dater une
                  dépense de demain. Jour barré, non cliquable, raison
                  en infobulle.

     · SIGNALÉ    ce qui est possible mais mérite un regard : un
                  voyageur sur place, un prestataire déjà chargé ce
                  jour-là. Le jour reste cliquable, avec une pastille.
                  Griser ces cas serait faux — un ménage de mi-séjour
                  se fait justement pendant l'occupation.

   Les champs natifs restent porteurs de la valeur (format ISO), en
   lecture seule : tout le code qui lit « input.value » continue de
   fonctionner sans modification.
   ============================================================ */
const DatePicker = (function () {
  const JOURS = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];
  let pop = null, courant = null, moisAffiche = null, survol = null;

  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const parse = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); };

  function fermer() {
    if (pop) pop.classList.remove('is-open');
    courant = null;
    survol = null;
  }

  /* ---------- Choix d'un jour ---------- */
  function choisir(d) {
    const c = courant;
    // Le panneau peut avoir été refermé entre-temps (défilement, Échap) alors
    // que son contenu est encore à l'écran le temps de la transition : un clic
    // tardif ne doit pas lever d'exception.
    if (!c) return;
    if (c.mode === 'simple') {
      poser(c.input, d);
      fermer();
      return;
    }
    // Plage : premier clic = début (on repart de zéro), second = fin.
    if (c.phase === 'debut') {
      poser(c.inputA, d);
      poser(c.inputB, '');
      c.phase = 'fin';
      survol = null;
      dessiner();
      return;
    }
    // Un clic avant le début ne veut pas dire « erreur » mais « je
    // recommence » : c'est le comportement attendu sur Airbnb, et ça
    // évite un message d'erreur pour une intention parfaitement claire.
    if (d <= c.inputA.value) {
      poser(c.inputA, d);
      poser(c.inputB, '');
      dessiner();
      return;
    }
    poser(c.inputB, d);
    fermer();
  }

  function poser(input, valeur) {
    input.value = valeur;
    // On simule la saisie utilisateur : les pages écoutent déjà
    // « change » et « input » sur ces champs.
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function construire() {
    if (pop) return pop;
    pop = document.createElement('div');
    pop.className = 'dp';
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-label', 'Choisir une date');
    document.body.appendChild(pop);

    pop.addEventListener('click', e => {
      // Marqueur lu par le gestionnaire « clic à l'extérieur » plus bas.
      // Indispensable : changer de mois régénère le contenu du panneau, si
      // bien que le bouton cliqué est DÉTACHÉ quand l'évènement remonte
      // jusqu'à document. « pop.contains(e.target) » y répondrait alors
      // faux et refermerait le calendrier à chaque changement de mois.
      e.dpInterne = true;
      const nav = e.target.closest('[data-dp-nav]');
      if (nav) {
        moisAffiche.setMonth(moisAffiche.getMonth() + Number(nav.dataset.dpNav));
        dessiner();
        return;
      }
      if (e.target.closest('[data-dp-reset]')) {
        poser(courant.inputA, '');
        poser(courant.inputB, '');
        courant.phase = 'debut';
        survol = null;
        dessiner();
        return;
      }
      const jour = e.target.closest('[data-dp-jour]');
      if (jour && !jour.disabled) choisir(jour.dataset.dpJour);
    });

    // Survol : prévisualisation de la traînée entre le début posé et le
    // jour pointé. On ne redessine que les classes, pas tout le panneau.
    pop.addEventListener('mouseover', e => {
      if (!courant || courant.mode !== 'plage' || courant.phase !== 'fin') return;
      const j = e.target.closest('[data-dp-jour]');
      const v = j && !j.disabled ? j.dataset.dpJour : null;
      if (v !== survol) { survol = v; majTrainee(); }
    });
    pop.addEventListener('mouseleave', () => {
      if (survol) { survol = null; majTrainee(); }
    });

    document.addEventListener('click', e => {
      if (!courant) return;
      if (e.dpInterne || pop.contains(e.target)) return;
      if (e.target === courant.input || e.target === courant.inputA || e.target === courant.inputB) return;
      fermer();
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') fermer(); });
    window.addEventListener('resize', fermer);
    // Le panneau est positionné en coordonnées absolues : tout défilement
    // le décrocherait de son champ, on préfère le refermer.
    window.addEventListener('scroll', fermer, true);
    return pop;
  }

  /* ---------- Bornes de la plage en cours ---------- */
  function bornes() {
    const c = courant;
    if (c.mode !== 'plage') return { debut: null, fin: null };
    const debut = c.inputA.value || null;
    const fin = c.inputB.value || (c.phase === 'fin' ? survol : null);
    return (debut && fin && fin > debut) ? { debut, fin } : { debut, fin: null };
  }

  function classesPlage(d) {
    const { debut, fin } = bornes();
    if (!debut) return '';
    if (!fin) return d === debut ? 'is-start is-seul' : '';
    if (d === debut) return 'is-start';
    if (d === fin) return 'is-end';
    return (d > debut && d < fin) ? 'is-in' : '';
  }

  function majTrainee() {
    pop.querySelectorAll('[data-dp-jour]').forEach(b => {
      b.classList.remove('is-start', 'is-end', 'is-in', 'is-seul');
      const cl = classesPlage(b.dataset.dpJour);
      if (cl) b.classList.add(...cl.split(' '));
    });
    majPied();
  }

  // Contraintes du jour, selon le mode et la phase.
  function raisonDe(d, o) {
    const c = courant;
    if (c.mode === 'plage' && c.phase === 'fin') {
      const debut = c.inputA.value;
      // Avant le début : le clic REDÉMARRE la sélection, ce jour devient donc
      // un début. Il doit obéir aux règles du début — sans quoi une nuit déjà
      // vendue redeviendrait cliquable dès la seconde étape.
      if (d <= debut) return o.indispo ? o.indispo(d) : null;
      const max = o.maxFin ? o.maxFin(debut) : null;
      if (max && d > max) return o.msgMax || 'Chevaucherait la période suivante';
      return o.indispoFin ? o.indispoFin(d, debut) : null;
    }
    const base = o.indispo ? o.indispo(d) : null;
    if (base) return base;
    if (o.min && d < o.min) return o.msgMin || 'Date trop ancienne';
    if (o.max && d > o.max) return o.msgMax || 'Date trop lointaine';
    return null;
  }

  function majPied() {
    const pied = pop.querySelector('.dp__pied');
    if (!pied || courant.mode !== 'plage') return;
    const o = courant.opts, L = o.labels || {};
    const a = courant.inputA.value, b = courant.inputB.value;
    if (a && b) {
      const n = Math.round((parse(b) - parse(a)) / 86400000);
      pied.innerHTML = `<b>${formatDate(a)} → ${formatDate(b)}</b><span>${n} ${o.uniteDuree || (n > 1 ? 'nuits' : 'nuit')}</span>
        <button type="button" class="dp__reset" data-dp-reset>Effacer</button>`;
    } else if (a) {
      // Les libellés portent leur article (« l'arrivée », « le départ ») :
      // le préfixer ici donnerait « la arrivée ».
      pied.innerHTML = `<b>${formatDate(a)}</b><span>Choisissez ${L.fin || 'la date de fin'}</span>
        <button type="button" class="dp__reset" data-dp-reset>Effacer</button>`;
    } else {
      pied.innerHTML = `<span>Choisissez ${L.debut || 'la date de début'}</span>`;
    }
  }

  function dessiner() {
    const o = courant.opts;
    const annee = moisAffiche.getFullYear(), mois = moisAffiche.getMonth();
    const premier = new Date(annee, mois, 1);
    const nbJours = new Date(annee, mois + 1, 0).getDate();
    // getDay() : 0 = dimanche. La semaine commence lundi en France.
    const decalage = (premier.getDay() + 6) % 7;

    let cases = '';
    for (let i = 0; i < decalage; i++) cases += '<span class="dp__vide"></span>';

    for (let j = 1; j <= nbJours; j++) {
      const d = iso(new Date(annee, mois, j));
      const raison = raisonDe(d, o);
      /* Avertissement : la nuit est occupée, mais le choix reste permis.
         Bloquer un logement pour travaux par-dessus un séjour est une
         décision légitime — il faut la voir, pas l'interdire. Le jour est
         donc barré, pas désactivé. `indispo` reste le refus ferme, pour
         les cas où l'écriture n'aurait aucun sens (deux voyageurs dans le
         même lit). */
      const alerte = raison ? null : (o.avertir ? o.avertir(d) : null);
      const note = (raison || alerte) ? null : (o.note ? o.note(d) : null);
      const classes = [
        'dp__jour',
        raison ? 'is-off' : '',
        alerte ? 'is-barre' : '',
        note ? 'is-note' : '',
        d === AUJOURDHUI ? 'is-today' : '',
        courant.mode === 'plage' ? classesPlage(d) : (d === courant.input.value ? 'is-sel' : ''),
      ].filter(Boolean).join(' ');

      cases += `<button type="button" class="${classes}" data-dp-jour="${d}" ${raison ? 'disabled' : ''}
        title="${(raison || alerte || note || formatDate(d, { jourSemaine: true, moisLong: true })).replace(/"/g, '&quot;')}"><span class="dp__pip">${j}</span></button>`;
    }

    const legende = (o.legende || []).map(l => `<span class="dp__leg"><i class="${l.classe}"></i>${l.texte}</span>`).join('');

    pop.innerHTML = `
      <div class="dp__head">
        <button type="button" class="dp__nav" data-dp-nav="-1" aria-label="Mois précédent">‹</button>
        <b>${MOIS_LONG[mois]} ${annee}</b>
        <button type="button" class="dp__nav" data-dp-nav="1" aria-label="Mois suivant">›</button>
      </div>
      <div class="dp__dows">${JOURS.map(j => `<span>${j}</span>`).join('')}</div>
      <div class="dp__grid">${cases}</div>
      ${courant.mode === 'plage' ? '<div class="dp__pied"></div>' : ''}
      ${legende ? `<div class="dp__legende">${legende}</div>` : ''}`;

    majPied();
  }

  function positionner(ancre) {
    const r = ancre.getBoundingClientRect();
    pop.classList.add('is-open');           // mesurable seulement une fois affiché
    const h = pop.offsetHeight, w = pop.offsetWidth;
    // Sous le champ par défaut, au-dessus s'il n'y a pas la place.
    const dessous = r.bottom + 6 + h <= window.innerHeight;
    let left = r.left;
    if (left + w > window.innerWidth - 8) left = Math.max(8, window.innerWidth - w - 8);
    pop.style.left = `${left + window.scrollX}px`;
    pop.style.top = `${(dessous ? r.bottom + 6 : Math.max(8, r.top - h - 6)) + window.scrollY}px`;
  }

  function ouvrir(ctx, ancre, getOpts) {
    construire();
    courant = Object.assign({ opts: (typeof getOpts === 'function' ? getOpts() : getOpts) || {} }, ctx);
    survol = null;
    // On ouvre sur le mois de la valeur courante, à défaut sur la borne
    // basse, à défaut sur aujourd'hui : jamais sur un mois vide.
    const ref = courant.mode === 'plage'
      ? (courant.inputA.value || courant.opts.min || AUJOURDHUI)
      : (courant.input.value || courant.opts.min || AUJOURDHUI);
    moisAffiche = parse(ref);
    moisAffiche.setDate(1);
    dessiner();
    positionner(ancre);
  }

  function equiper(input) {
    // Lecture seule : la valeur ne peut alors venir que de la grille, donc
    // elle respecte forcément les contraintes. Le champ garde son type
    // « date », donc son affichage localisé et sa valeur ISO.
    input.readOnly = true;
    input.classList.add('dp-input');
  }

  function attach(input, getOpts) {
    if (!input || input.dataset.dpOn) return;
    input.dataset.dpOn = '1';
    equiper(input);
    const ouvrirSimple = () => ouvrir({ mode: 'simple', input }, input, getOpts);
    input.addEventListener('click', e => {
      e.preventDefault();
      if (courant && courant.input === input) { fermer(); return; }
      ouvrirSimple();
    });
    input.addEventListener('keydown', e => {
      if (['Enter', ' '].includes(e.key)) { e.preventDefault(); ouvrirSimple(); }
    });
  }

  /* ---------- Mode plage ----------
     Un seul calendrier pour les deux champs. Cliquer le champ de fin
     alors qu'aucun début n'est posé ouvre quand même sur la phase
     « début » : on ne peut pas choisir une fin sans début. */
  function range(inputA, inputB, getOpts) {
    if (!inputA || !inputB || inputA.dataset.dpOn) return;
    inputA.dataset.dpOn = inputB.dataset.dpOn = '1';
    equiper(inputA); equiper(inputB);

    const ouvrirPlage = (ancre, phase) => {
      const ctx = { mode: 'plage', inputA, inputB, phase: (phase === 'fin' && inputA.value) ? 'fin' : 'debut' };
      if (ctx.phase === 'debut') { inputA.value = ''; inputB.value = ''; }
      ouvrir(ctx, ancre, getOpts);
    };
    [[inputA, 'debut'], [inputB, 'fin']].forEach(([el, phase]) => {
      el.addEventListener('click', e => {
        e.preventDefault();
        if (courant && courant.inputA === inputA) { fermer(); return; }
        ouvrirPlage(el, phase);
      });
      el.addEventListener('keydown', e => {
        if (['Enter', ' '].includes(e.key)) { e.preventDefault(); ouvrirPlage(el, phase); }
      });
    });
  }

  return { attach, range, fermer };
})();
