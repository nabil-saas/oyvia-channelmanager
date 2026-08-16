/* ============================================================
   OYVIA — Vitrine publique et moteur de réservation directe

   Cette page joue le rôle du site du client. Elle n'a volontairement
   PAS son propre stock : elle interroge RESERVATIONS via les mêmes
   fonctions que l'application (nuitsOccupees, prochaineNuitOccupee).
   Une nuit vendue sur Airbnb est donc invisible ici sans qu'aucune
   synchronisation n'ait à tourner — c'est la même source.

   Une demande validée pousse une réservation de canal « direct » dans
   le même tableau. Elle apparaît immédiatement dans le calendrier, la
   liste des réservations et la comptabilité.
   ============================================================ */
(function () {
  const S = SITE_WEB;
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  let logementCourant = null;
  const ic = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;

  // Le thème n'est plus une classe CSS mais un jeu de variables : ajouter
  // un thème dans data.js suffit, sans nouvelle règle de style.
  const th = getTheme(S.theme);
  const R = document.documentElement.style;
  R.setProperty('--pub-accent', S.couleur || th.c1);
  R.setProperty('--pub-accent-2', S.couleurSecondaire || th.c2);
  R.setProperty('--pub-fond', S.couleurFond || th.fond);
  R.setProperty('--pub-alt', th.alt);
  R.setProperty('--pub-texte', S.couleurTexte || th.texte);
  R.setProperty('--pub-titres', S.couleurTitres || th.titres);
  R.setProperty('--pub-voile', (S.couvertureVoile ?? 45) / 100);
  R.setProperty('--pub-couv', (S.couvertureHauteur ?? 78) + 'vh');

  /* ---------- Site hors ligne ---------- */
  // Un brouillon n'est pas un site hors ligne par accident : c'est un site
  // qu'on n'a pas encore voulu montrer. Même écran, message adapté.
  if (!S.actif || S.statut === 'brouillon') {
    document.getElementById('pub-main').innerHTML = `
      <div class="pub-offline">
        <h1>${S.statut === 'brouillon' ? 'Site en brouillon' : 'Site hors ligne'}</h1>
        <p>${S.statut === 'brouillon'
          ? "Ce site est enregistré en brouillon. Publiez-le depuis Oyvia pour le rendre visible."
          : "Ce site n'est pas encore publié. Activez-le depuis Oyvia pour le rendre visible."}</p>
        <a class="btn btn--primary" href="app/site.html">Ouvrir les réglages</a>
      </div>`;
    document.getElementById('pub-head').innerHTML = '';
    return;
  }

  /* ---------- En-tête et pied ---------- */
  document.getElementById('pub-head').innerHTML = `
    <div class="pub-wrap pub-head__in">
      <a class="pub-marque" href="#top">
        ${S.logo ? `<img class="pub-marque__logo" src="${S.logo}" alt="${esc(S.titre)}" />` : ''}
        <span>
          <b class="pub-logo">${esc(S.titre)}</b>
          ${S.slogan ? `<small class="pub-slogan">${esc(S.slogan)}</small>` : ''}
        </span>
      </a>
      <nav class="pub-nav">
        <a href="#top">Accueil</a>
        <a href="#logements">Logements</a>
        <a href="#services">Services</a>
        <a href="#proprietaire">Propriétaire</a>
        <a href="#contact">Contact</a>
      </nav>
      <div class="pub-canaux">
        ${contactsActifs().map(({ canal, conf }) => canal.id === 'tel'
          ? `<a class="pub-tel" href="${canal.lien(conf.valeur)}">${esc(conf.valeur)}</a>`
          : `<a class="pub-canal pub-canal--${canal.id}" href="${canal.lien(conf.valeur)}" target="_blank" rel="noopener"
               title="${canal.label}" aria-label="${canal.label}">${ic(canal.icone)}</a>`).join('')}
      </div>
    </div>`;

  document.getElementById('pub-foot').innerHTML = `
    <div class="pub-wrap pub-foot__in">
      <div>
        <b>${esc(S.titre)}</b>
        <p>${contactsActifs().map(({ conf }) => esc(conf.valeur)).join(' · ') || ''}</p>
        ${S.adresse ? `<p>${esc(S.adresse)}</p>` : ''}
      </div>
      <p class="pub-foot__legal">Réservation en direct, sans intermédiaire. Site propulsé par Oyvia.</p>
    </div>`;

  /* ---------- Corps ---------- */
  const logements = logementsDuSite();
  const r = S.reservation;
  const argumentDirect = r.actif && r.remiseDirecte
    ? `<span class="pub-badge">-${r.remiseDirecte} % en réservant ici</span>`
    : '';

  document.getElementById('pub-main').innerHTML = `
    <section class="pub-hero ${S.photos.length ? 'pub-hero--photo' : ''}" id="top">
      ${S.photos.length ? `<div class="pub-carrousel">
        ${S.photos.map((p, i) => `<div class="pub-carrousel__img ${i === 0 ? 'is-on' : ''}" style="background-image:url('${p}')"></div>`).join('')}
        <div class="pub-carrousel__voile"></div>
      </div>` : ''}
      <div class="pub-wrap pub-hero__in">
        ${argumentDirect}
        <h1>${esc(S.accroche)}</h1>
        <p>${esc(S.sousAccroche || '')}${S.sousAccroche ? ' ' : ''}${esc(S.titre)}.</p>
      </div>

      ${r.actif ? `
      <!-- Barre de recherche : elle chevauche le bas du hero, comme sur la
           plupart des sites de location. Elle interroge les disponibilités
           réelles, ce n'est pas un champ décoratif. -->
      <form class="pub-recherche" id="pub-recherche">
        <div class="pub-recherche__champ">
          <label>Dates du séjour</label>
          <div class="pub-dates">
            <input type="date" id="pub-du" placeholder="Arrivée" />
            <span class="pub-dates__fleche">→</span>
            <input type="date" id="pub-au" placeholder="Départ" />
          </div>
        </div>
        <div class="pub-recherche__champ pub-recherche__champ--pers">
          <label for="pub-pers">Voyageurs</label>
          <select id="pub-pers">
            <option value="">—</option>
            ${[1,2,3,4,5,6,8,10].map(n => `<option value="${n}">${n} voyageur${n > 1 ? 's' : ''}</option>`).join('')}
          </select>
        </div>
        <button class="btn btn--primary" type="submit">Rechercher</button>
      </form>` : ''}
    </section>

${S.sections.filter(x => x.actif).map(sectionHTML).join('')}`;

  /* ---------- Rendu d'une section ----------
     Un seul aiguillage par type. Une section inconnue ne casse rien : elle
     est simplement ignorée, ce qui évite qu'une donnée héritée d'une
     ancienne version vide la page entière. */
  function sectionHTML(sec) {
    const entete = `
      ${sec.surtitre ? `<p class="pub-eyebrow">${esc(sec.surtitre)}</p>` : ''}
      ${sec.titre ? `<h2 class="pub-h2">${esc(sec.titre)}</h2>` : ''}`;
    const classe = `pub-sec ${sec.fond === 'alt' ? 'pub-sec--alt' : ''}`;

    if (sec.type === 'logements') return `
      <section class="${classe}" id="logements">
        <div class="pub-wrap">
          ${entete}
          <p class="pub-resultat" id="pub-resultat"></p>
          <div class="pub-grid" id="pub-grid">${logements.map(l => carte(l)).join('')}</div>
          ${logements.length ? '' : `<p class="pub-vide">Aucun logement publié pour le moment.</p>`}
        </div>
      </section>`;

    if (sec.type === 'cartes') return `
      <section class="${classe}" id="${sec.id}">
        <div class="pub-wrap">
          ${entete}
          <div class="pub-services">
            ${(sec.items || []).map(x => `<article><b>${esc(x.titre)}</b><p>${esc(x.texte)}</p></article>`).join('')}
          </div>
        </div>
      </section>`;

    if (sec.type === 'texte') return `
      <section class="${classe}" id="${sec.id}">
        <div class="pub-wrap pub-texte">
          ${entete}
          <p>${esc(sec.texte || '')}</p>
        </div>
      </section>`;

    if (sec.type === 'proprietaire') {
      const mail = contactValeur('email');
      return `
      <section class="${classe}" id="proprietaire">
        <div class="pub-wrap pub-prop">
          <div>
            ${sec.surtitre ? `<p class="pub-eyebrow" style="text-align:left">${esc(sec.surtitre)}</p>` : ''}
            <h2 class="pub-h2 pub-h2--gauche">${esc(sec.titre || '')}</h2>
            <p class="pub-prop__txt">${esc(sec.texte || '')}</p>
            ${mail ? `<a class="btn btn--primary" href="mailto:${esc(mail)}?subject=${encodeURIComponent('Confier mon bien — ' + S.titre)}">${esc(sec.bouton || 'Nous contacter')}</a>` : ''}
          </div>
          <ul class="pub-prop__pts">
            ${r.remiseDirecte ? `<li><b>0 %</b> de commission sur les réservations directes</li>` : ''}
            <li><b>${labelPolitique(r.annulation)}</b> — politique appliquée à chaque séjour</li>
            <li><b>${logements.length}</b> logement${logements.length > 1 ? 's' : ''} déjà gérés</li>
            <li><b>7 j/7</b> — accueil et assistance voyageurs</li>
          </ul>
        </div>
      </section>`;
    }

    if (sec.type === 'contact') return `
      <section class="${classe}" id="contact">
        <div class="pub-wrap pub-contact">
          ${entete}
          <div class="pub-contacts">
            ${contactsActifs().map(({ canal, conf }) => `
              <a class="pub-contact__item" href="${canal.lien(conf.valeur)}" ${canal.id === 'tel' || canal.id === 'email' ? '' : 'target="_blank" rel="noopener"'}>
                <span class="pub-contact__ic pub-canal--${canal.id}">${ic(canal.icone)}</span>
                <span><b>${canal.label}</b><small>${esc(conf.valeur)}</small></span>
              </a>`).join('')}
          </div>
          ${S.adresse ? `<p class="pub-contact__adr">${esc(S.adresse)}</p>` : ''}
        </div>
      </section>`;

    return '';
  }

  /* ---------- Bouton WhatsApp flottant ----------
     Ancré en bas à droite, comme sur la plupart des sites de conciergerie.
     N'apparaît que si un numéro est réellement renseigné : un bouton qui
     ouvre une conversation vide est pire que pas de bouton. */
  if (S.whatsappFlottant && contactValeur('whatsapp')) {
    const a = document.createElement('a');
    a.className = 'pub-wa';
    a.href = lienContact('whatsapp');
    a.target = '_blank'; a.rel = 'noopener';
    a.setAttribute('aria-label', 'Nous écrire sur WhatsApp');
    a.innerHTML = ic(getContactCanal('whatsapp').icone);
    document.body.appendChild(a);
  }

  /* ---------- Carrousel ----------
     Une seule photo n'est pas un carrousel : on ne lance l'intervalle que
     s'il y a réellement plusieurs images, sinon on ferait tourner un
     minuteur pour rien pendant toute la visite. */
  if (S.photos.length > 1) {
    const vues = [...document.querySelectorAll('.pub-carrousel__img')];
    let i = 0;
    setInterval(() => {
      vues[i].classList.remove('is-on');
      i = (i + 1) % vues.length;
      vues[i].classList.add('is-on');
    }, 5000);
  }

  /* ============================================================
     Recherche par disponibilité

     Le champ n'est pas décoratif : il interroge le même calendrier que
     le moteur de réservation. Un logement n'est proposé que si TOUTES
     les nuits de la période sont libres — toutes plateformes confondues.
     ============================================================ */
  const formRecherche = document.getElementById('pub-recherche');
  if (formRecherche) {
    const du = document.getElementById('pub-du');
    const au = document.getElementById('pub-au');
    const premierJour = addDays(AUJOURDHUI, r.delaiMin || 0);

    // Ici on ne grise pas selon un logement précis : la recherche porte sur
    // tout le parc, et une date occupée sur l'un peut être libre sur l'autre.
    DatePicker.range(du, au, () => ({
      labels: { debut: "l'arrivée", fin: 'le départ' },
      min: premierJour,
      msgMin: r.delaiMin ? `Réservation possible à partir de ${formatDate(premierJour)}` : 'Date passée',
      indispoFin: (x, debut) => nuitsEntre(debut, x) < r.nuitsMin ? `Séjour minimum : ${r.nuitsMin} nuits` : null,
    }));

    const libre = (l, a, d) => {
      for (let x = a; x < d; x = addDays(x, 1)) if (occupantNuit(l.id, x)) return false;
      return true;
    };

    formRecherche.addEventListener('submit', e => {
      e.preventDefault();
      const a = du.value, d = au.value;
      const pers = parseInt(document.getElementById('pub-pers').value, 10) || 0;
      const grille = document.getElementById('pub-grid');
      const info = document.getElementById('pub-resultat');

      if (!a || !d) {
        grille.innerHTML = logements.map(l => carte(l)).join('');
        info.innerHTML = pers
          ? `Filtré sur ${pers} voyageur${pers > 1 ? 's' : ''}. Ajoutez des dates pour voir les disponibilités.`
          : '';
        if (pers) {
          const cap = logements.filter(l => l.capacite >= pers);
          grille.innerHTML = cap.map(l => carte(l)).join('');
          info.innerHTML = `${cap.length} logement${cap.length > 1 ? 's' : ''} pour ${pers} voyageur${pers > 1 ? 's' : ''}.`;
        }
        return;
      }

      const dispo = logements.filter(l => (!pers || l.capacite >= pers) && libre(l, a, d));
      grille.innerHTML = dispo.length
        ? dispo.map(l => carte(l, a, d)).join('')
        : `<p class="pub-vide">Aucun logement disponible sur ces dates${pers ? ` pour ${pers} voyageur${pers > 1 ? 's' : ''}` : ''}.
             Essayez une autre période — nos adresses partent vite en haute saison.</p>`;
      info.innerHTML = `<b>${dispo.length}</b> logement${dispo.length > 1 ? 's' : ''} disponible${dispo.length > 1 ? 's' : ''}
        du ${formatDate(a)} au ${formatDate(d)}${pers ? ` · ${pers} voyageur${pers > 1 ? 's' : ''}` : ''}
        <button type="button" class="pub-reset" id="pub-reset">Effacer</button>`;
    });

    document.addEventListener('click', e => {
      if (!e.target.closest('#pub-reset')) return;
      du.value = ''; au.value = '';
      document.getElementById('pub-pers').value = '';
      document.getElementById('pub-grid').innerHTML = logements.map(l => carte(l)).join('');
      document.getElementById('pub-resultat').innerHTML = '';
    });
  }

  function carte(l, a, d) {
    const prix = r.actif && r.remiseDirecte ? prixDirect(l) : l.tarifBase;
    const nuits = a && d ? nuitsEntre(a, d) : 0;
    return `
      <article class="pub-card">
        <div class="pub-card__img" style="background:${l.couleur}">
          <span class="pub-card__ville">${esc(l.ville)}</span>
        </div>
        <div class="pub-card__body">
          <b>${esc(l.nom)}</b>
          <small>${labelTypeLogement(l.type)} · ${l.capacite} voyageurs · ${l.chambres} chambre${l.chambres > 1 ? 's' : ''}</small>
          <div class="pub-card__foot">
            <span class="pub-card__prix">
              ${nuits
                ? `<b>${formatMontant(prix * nuits + (l.menageTarif || 0))}</b> <em>· ${nuits} nuit${nuits > 1 ? 's' : ''}</em>`
                : `${r.remiseDirecte ? `<s>${formatMontant(l.tarifBase)}</s>` : ''}<b>${formatMontant(prix)}</b> <em>/ nuit</em>`}
            </span>
            ${r.actif
              ? `<button class="btn btn--primary btn--sm" data-reserver="${l.id}" data-du="${a || ''}" data-au="${d || ''}">Réserver</button>`
              : `<a class="btn btn--secondary btn--sm" href="${lienContact('email') || '#contact'}">Nous écrire</a>`}
          </div>
        </div>
      </article>`;
  }

  /* ============================================================
     Moteur de réservation
     ============================================================ */
  const overlay = document.getElementById('pub-overlay');
  const modal = document.getElementById('pub-modal');
  const corps = document.getElementById('pub-modal-body');

  function ouvrir(l, du, au) {
    logementCourant = l;
    document.getElementById('pub-modal-titre').textContent = l.nom;
    corps.innerHTML = formulaire(l);
    overlay.classList.add('is-open');
    modal.classList.add('is-open');
    equiperDates(l);
    // Report des dates issues de la recherche : les redemander serait
    // absurde puisqu'on vient de filtrer dessus.
    if (du && au) {
      document.getElementById('pb-arrivee').value = du;
      document.getElementById('pb-depart').value = au;
    }
    majRecap();
  }
  function fermer() {
    overlay.classList.remove('is-open');
    modal.classList.remove('is-open');
    logementCourant = null;
  }
  overlay.addEventListener('click', fermer);
  document.getElementById('pub-close').addEventListener('click', fermer);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') fermer(); });

  function formulaire(l) {
    const capacites = Array.from({ length: l.capacite }, (_, i) => i + 1);
    return `
      <div class="pub-form">
        <div class="form-grid">
          <div class="field">
            <label class="field__label" for="pb-arrivee">Arrivée</label>
            <input class="input" type="date" id="pb-arrivee" />
          </div>
          <div class="field">
            <label class="field__label" for="pb-depart">Départ</label>
            <input class="input" type="date" id="pb-depart" />
          </div>
        </div>
        <div class="form-grid mt-4">
          <div class="field">
            <label class="field__label" for="pb-pers">Voyageurs</label>
            <select class="select" id="pb-pers">${capacites.map(n => `<option value="${n}">${n} voyageur${n > 1 ? 's' : ''}</option>`).join('')}</select>
          </div>
          <div class="field">
            <label class="field__label" for="pb-nom">Votre nom</label>
            <input class="input" id="pb-nom" placeholder="Prénom et nom" />
          </div>
        </div>
        <div class="field mt-4">
          <label class="field__label" for="pb-email">Votre e-mail</label>
          <input class="input" type="email" id="pb-email" placeholder="vous@exemple.fr" />
        </div>

        <div class="pub-recap" id="pb-recap"><!-- injecté --></div>

        <button class="btn btn--primary btn--block mt-4" id="pb-valider">
          ${r.mode === 'instantane' ? 'Réserver et payer l\'acompte' : 'Envoyer ma demande'}
        </button>
        <p class="pub-mentions">
          ${r.mode === 'instantane'
            ? `Vos dates sont bloquées dès validation.`
            : `Votre demande n'engage rien : nous vous répondons sous 24 h.`}
          Annulation ${labelPolitique(r.annulation).toLowerCase()}.
        </p>
      </div>`;
  }

  /* ---------- Dates : les vraies disponibilités ----------
     On réutilise le sélecteur de plage de l'application. Les nuits déjà
     vendues — quelle que soit la plateforme — sont barrées, et le départ
     ne peut pas enjamber le séjour suivant. */
  function equiperDates(l) {
    const a = document.getElementById('pb-arrivee');
    const d = document.getElementById('pb-depart');
    // Un voyageur ne réserve pas dans le passé, et le délai minimum
    // d'arrivée est un réglage de l'hôte : on l'applique ici, pas en aval.
    const premierJour = addDays(AUJOURDHUI, r.delaiMin || 0);
    DatePicker.range(a, d, () => ({
      labels: { debut: "l'arrivée", fin: 'le départ' },
      min: premierJour,
      msgMin: r.delaiMin ? `Réservation possible à partir de ${formatDate(premierJour)}` : 'Date passée',
      indispo: x => x < premierJour
        ? (r.delaiMin ? `Trop proche : ${r.delaiMin} jour${r.delaiMin > 1 ? 's' : ''} de délai` : 'Date passée')
        : (occupantNuit(l.id, x) ? 'Déjà réservé' : null),
      maxFin: debut => prochaineNuitOccupee(l.id, debut),
      msgMax: 'Le séjour suivant est déjà réservé',
      indispoFin: (x, debut) => nuitsEntre(debut, x) < r.nuitsMin
        ? `Séjour minimum : ${r.nuitsMin} nuits` : null,
      legende: [{ classe: 'off', texte: 'Indisponible' }],
    }));
    [a, d].forEach(el => el.addEventListener('change', majRecap));
  }

  /* ---------- Récapitulatif de prix ---------- */
  function majRecap() {
    const zone = document.getElementById('pb-recap');
    if (!zone || !logementCourant) return;
    const l = logementCourant;
    const a = document.getElementById('pb-arrivee').value;
    const d = document.getElementById('pb-depart').value;

    if (!a || !d) {
      zone.innerHTML = `<p class="pub-recap__vide">Choisissez vos dates pour voir le prix total.</p>`;
      return;
    }
    const n = nuitsEntre(a, d);
    const nuit = r.remiseDirecte ? prixDirect(l) : l.tarifBase;
    const sejour = nuit * n;
    const menage = l.menageTarif || 0;
    const total = sejour + menage;
    const acompte = Math.round(total * (r.acompte || 0) / 100);
    // Ce que la même réservation coûterait via une plateforme : c'est
    // l'argument du direct, autant le montrer chiffré.
    const via = l.tarifBase * n + menage;

    zone.innerHTML = `
      <div class="pub-recap__ligne"><span>${formatMontant(nuit)} × ${n} nuit${n > 1 ? 's' : ''}</span><span>${formatMontant(sejour)}</span></div>
      ${menage ? `<div class="pub-recap__ligne"><span>Frais de ménage</span><span>${formatMontant(menage)}</span></div>` : ''}
      <div class="pub-recap__ligne pub-recap__total"><span>Total</span><b>${formatMontant(total)}</b></div>
      ${r.remiseDirecte && via > total
        ? `<p class="pub-recap__eco">Vous économisez ${formatMontant(via - total)} par rapport au prix affiché sur les plateformes.</p>` : ''}
      ${acompte ? `<p class="pub-recap__acompte">À régler maintenant : <b>${formatMontant(acompte)}</b> (${r.acompte} %). Le solde ${formatMontant(total - acompte)} avant l'arrivée.</p>` : ''}`;
  }

  /* ---------- Validation ---------- */
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-reserver]');
    if (b) { ouvrir(getLogement(b.dataset.reserver), b.dataset.du, b.dataset.au); return; }

    if (!e.target.closest('#pb-valider')) return;

    const l = logementCourant;
    const a = document.getElementById('pb-arrivee').value;
    const d = document.getElementById('pb-depart').value;
    const nom = document.getElementById('pb-nom').value.trim();
    const email = document.getElementById('pb-email').value.trim();
    const pers = parseInt(document.getElementById('pb-pers').value, 10) || 1;

    const erreur = m => { alert(m); };
    if (!a || !d) return erreur('Choisissez vos dates.');
    if (nuitsEntre(a, d) < r.nuitsMin) return erreur(`Le séjour minimum est de ${r.nuitsMin} nuits.`);
    if (!nom) return erreur('Indiquez votre nom.');
    if (!email || !email.includes('@')) return erreur('Indiquez un e-mail valide.');

    // Dernier contrôle avant écriture : entre l'ouverture du formulaire et
    // la validation, une nuit a pu être vendue ailleurs. Sans ce test, le
    // site créerait une surréservation.
    for (let x = a; x < d; x = addDays(x, 1)) {
      if (occupantNuit(l.id, x)) {
        return erreur("Ces dates viennent d'être réservées. Merci d'en choisir d'autres.");
      }
    }

    const n = nuitsEntre(a, d);
    const nuit = r.remiseDirecte ? prixDirect(l) : l.tarifBase;
    const total = nuit * n + (l.menageTarif || 0);
    const instantane = r.mode === 'instantane';

    const resa = {
      id: 'R' + Date.now(),
      logementId: l.id, voyageurId: null, voyageur: nom,
      canal: 'direct', arrivee: a, depart: d, pers, montant: total,
      // En mode « demande », rien n'est encaissé tant que l'hôte n'a pas
      // accepté : le paiement reste impayé, pas « acompte ».
      paiement: instantane && r.acompte ? 'acompte' : 'impaye',
      statut: instantane ? 'confirme' : 'demande',
      ref: 'WEB-' + Math.floor(1000 + Math.random() * 9000),
      nuits: n,
      note: `Réservation directe depuis le site · ${email}`,
      origineSite: true,
    };
    RESERVATIONS.push(resa);
    if (typeof nouveauTokenSejour === 'function') resa.token = nouveauTokenSejour();
    if (typeof saveOyviaState === 'function') saveOyviaState();

    corps.innerHTML = `
      <div class="pub-ok">
        <div class="pub-ok__ic">✓</div>
        <h3>${instantane ? 'Séjour confirmé' : 'Demande envoyée'}</h3>
        <p>${instantane
          ? `Vos dates sont bloquées. Vous recevrez la confirmation à ${esc(email)}.`
          : `Nous revenons vers vous sous 24 h à ${esc(email)}. Vos dates ne sont pas encore garanties.`}</p>
        <div class="pub-ok__recap">
          <div><span>Logement</span><b>${esc(l.nom)}</b></div>
          <div><span>Séjour</span><b>${formatPlage(a, d)}</b></div>
          <div><span>Voyageurs</span><b>${pers}</b></div>
          <div><span>Total</span><b>${formatMontant(total)}</b></div>
          <div><span>Référence</span><b>${resa.ref}</b></div>
        </div>
        <p class="pub-ok__note">Cette réservation apparaît dès maintenant dans le calendrier Oyvia.</p>
        <a class="btn btn--secondary btn--block mt-4" href="app/reservations.html?r=${resa.id}">La voir dans Oyvia</a>
      </div>`;
  });
})();
