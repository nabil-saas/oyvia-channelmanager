/* ============================================================
   OYVIA — Guest Page (page voyageur publique, sans compte)

   Adressée par ?s=<jeton>, jamais par identifiant de réservation :
   la page expose le code d'accès et le mot de passe Wi-Fi, une URL
   incrémentable donnerait ceux du logement voisin.

   Le lien est envoyé au voyageur par l'automatisation J-1
   (variable {lien_sejour}), et n'est ouvert que dans sa fenêtre de
   validité : 7 jours avant l'arrivée → 2 jours après le départ.
   ============================================================ */
(function () {
  const params = new URLSearchParams(location.search);
  const shell = document.getElementById('g-shell');

  // Écran de repli : jeton inconnu, ou lien pas encore ouvert / périmé.
  function ecranFerme(titre, message) {
    shell.innerHTML = `
      <div class="g-top">
        <div class="g-brand"><img src="assets/oyvia-logo.svg" alt="Oyvia" class="brand-logo"></div>
        <span class="g-top__tag">Votre séjour</span>
      </div>
      <div class="g-closed">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
        <h1>${titre}</h1>
        <p>${message}</p>
      </div>`;
  }

  // Sans jeton du tout, on retombe sur une réservation de démonstration :
  // la maquette doit rester consultable depuis un lien nu.
  const r = params.has('s') ? getReservationParToken(params.get('s')) : getReservation('R07');

  if (!r) {
    ecranFerme('Ce lien n’est pas valide',
      "Vérifiez le lien reçu dans votre messagerie, ou demandez à votre hôte de vous le renvoyer.");
    return;
  }

  const statut = lienSejourStatut(r);
  if (!statut.actif) {
    if (statut.motif === 'trop_tot') {
      ecranFerme('Votre page séjour n’est pas encore ouverte',
        `Elle s'ouvrira ${LIEN_SEJOUR_AVANT} jours avant votre arrivée, avec l'adresse exacte, le code d'accès et le Wi-Fi. Encore ${statut.jours} jour${statut.jours > 1 ? 's' : ''} à patienter.`);
    } else {
      ecranFerme('Ce lien a expiré',
        "Votre séjour est terminé — nous espérons qu'il s'est bien passé. Contactez votre hôte si vous avez besoin d'une information.");
    }
    return;
  }

  const l = getLogement(r.logementId);
  const v = r.voyageurId ? getVoyageur(r.voyageurId) : null;
  const prenom = (v ? v.nom : r.voyageur).split(' ')[0];
  const ic = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  // Les informations sensibles n'apparaissent qu'à l'approche de l'arrivée,
  // même si le lien a été envoyé plus tôt (cf. PAGE_SEJOUR.joursAvantCode).
  const codeVisible = codeAccesVisible(r);

  // Contexte des variables ({code}, {wifi}…) : il porte aussi la règle de
  // visibilité du code, pour qu'un texte libre ne puisse pas la contourner.
  const CTX = { logement: l, prenom, codeVisible };
  const vars = t => remplirVariablesSejour(t, CTX);



  // Couleur d'accent choisie par l'hôte : posée en variable CSS plutôt
  // qu'en style sur chaque élément, pour qu'un seul réglage repeigne
  // boutons, pastilles et liens de la page.
  if (PAGE_SEJOUR.couleur) document.documentElement.style.setProperty('--g-accent', PAGE_SEJOUR.couleur);

  /* Rendu d'un bloc, par identifiant. Une fonction par bloc plutôt qu'un
     long gabarit : l'ordre d'affichage se règle depuis l'application,
     et il faut pouvoir composer la page dans n'importe quelle suite. */
  const section = (id, corps) => {
    const t = texteBloc(id);
    if (!corps) return '';
    return `<div class="g-section">
      ${t.titre ? `<h2>${vars(t.titre)}</h2>` : ''}
      ${t.texte ? `<p class="g-intro">${vars(t.texte)}</p>` : ''}
      ${corps}
    </div>`;
  };

  const BLOCS = {
    // Le mot d'accueil n'est pas une section : il s'inscrit sous le titre
    // du logement, dans l'en-tête. Rendu à part, plus bas.
    accueil: () => '',

    fiche_police: () => `<div class="g-card"><div id="fp-section"><!-- injecté --></div></div>`,

    acces: () => {
      const items = accesSejour();
      if (!items.length) return '';
      /* Tant que le code n'est pas visible, on remplace la grille par une
         explication plutôt que par trois cases « communiqué avant votre
         arrivée » : le voyageur veut savoir QUAND, pas lire trois fois
         qu'il ne saura pas encore. */
      const sensible = items.some(x => /\{code\}|\{wifi_mdp\}/.test(x.texte || ''));
      if (!codeVisible && sensible) {
        return `<div class="g-card g-masque">
          ${ic('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>')}
          <p>Le code d'accès apparaîtra ici ${PAGE_SEJOUR.joursAvantCode === 1 ? 'la veille de votre arrivée' : `${PAGE_SEJOUR.joursAvantCode} jours avant votre arrivée`}.</p>
        </div>`;
      }
      // Une information vide ne laisse pas de case orpheline.
      const rendus = items.map(x => ({ ...x, valeur: vars(x.texte).trim() })).filter(x => x.valeur);
      if (!rendus.length) return '';
      return `<div class="g-codes">
        ${rendus.map(x => `<div class="g-code ${x.large ? 'g-code--full' : ''}">
          <small>${vars(x.titre)}</small><b>${x.valeur}</b></div>`).join('')}
      </div>`;
    },

    instructions: () => {
      const etapes = etapesSejour();
      if (!etapes.length) return '';
      return `<div class="g-card"><div class="g-steps">
        ${etapes.map((e, i) => `
          <div class="g-step">
            <span class="g-step__num">${i + 1}</span>
            <div class="g-step__txt"><b>${vars(e.titre)}</b>${e.texte ? `<p>${vars(e.texte)}</p>` : ''}</div>
          </div>`).join('')}
      </div></div>`;
    },

    guide: () => {
      const tuiles = tuilesSejour();
      if (!tuiles.length) return '';
      return `<div class="g-guide">
        ${tuiles.map(g => `
          <div class="g-tile">
            <div class="g-tile__ic">${ic((ICONES_SEJOUR[g.icone] || ICONES_SEJOUR.info).path)}</div>
            <b>${vars(g.titre)}</b><p>${vars(g.texte)}</p>
          </div>`).join('')}
      </div>`;
    },

    // Rubrique vide = rubrique absente : une section « Envie d'un extra ? »
    // sans rien en dessous fait une page en travaux.
    services: () => {
      const dispo = servicesPageSejour(l.id);
      if (!dispo.length) return '';
      return `<div class="g-services">
        ${dispo.map(sv => `
          <div class="g-service">
            <div class="g-service__txt"><b>${sv.nom}</b><p>${sv.desc || ''}</p></div>
            <div class="g-service__prix">
              <b>${sv.prix ? formatMontant(sv.prix) : 'Offert'}</b>
              <small>${SERVICES_UNITES[sv.unite] || ''}</small>
            </div>
          </div>`).join('')}
      </div>`;
    },

    // Le bloc « départ » n'a d'autre contenu que son texte : il est rendu
    // plus bas, pour disparaître entièrement si l'hôte l'efface.
    depart: () => '',

    contact: () => {
      const lien = lienContactSejour();
      const libelle = vars(texteBloc('contact').titre) || 'Contacter votre hôte';
      // Un lien réel quand il en existe un : rien n'agace autant qu'un
      // bouton « Appeler » qui ouvre une boîte de dialogue.
      return `<a class="g-cta" ${lien ? `href="${lien}" target="_blank" rel="noopener"` : `href="#" onclick="event.preventDefault(); alert('Un message a été envoyé à votre hôte. (démo)')"`}>
          ${ic('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>')}
          ${libelle}
        </a>`;
    },
  };

  /* Deux blocs n'ont pas d'en-tête : l'accueil vit dans le hero, et le
     bouton de contact se suffit à lui-même. */
  const SANS_ENTETE = { accueil: true, contact: true };

  const corpsPage = blocsPageSejourOrdonnes().map(b => {
    if (b.id === 'depart') {
      const t = texteBloc('depart');
      return t.texte
        ? `<div class="g-section">${t.titre ? `<h2>${vars(t.titre)}</h2>` : ''}<div class="g-card"><p class="text-sm">${vars(t.texte)}</p></div></div>`
        : '';
    }
    const rendu = BLOCS[b.id] ? BLOCS[b.id]() : '';
    if (!rendu) return '';
    if (SANS_ENTETE[b.id]) return `<div class="g-section">${rendu}</div>`;
    return section(b.id, rendu);
  }).join('');

  const accueil = blocPageSejourActif('accueil') ? vars(texteBloc('accueil').texte) : '';

  shell.innerHTML = `
    <div class="g-top">
      <div class="g-brand">${PAGE_SEJOUR.enseigne
        ? `<span class="g-enseigne">${PAGE_SEJOUR.enseigne}</span>`
        : '<img src="assets/oyvia-logo.svg" alt="Oyvia" class="brand-logo">'}</div>
      <span class="g-top__tag">Votre séjour</span>
    </div>

    <div class="g-hero">
      <div class="g-hero__cover" style="background:linear-gradient(135deg, ${PAGE_SEJOUR.couleur || l.couleur}, ${l.couleur})">
        <h1>${l.nom}</h1>
      </div>
      <div class="g-hero__body">
        <p class="g-hero__welcome">Bienvenue ${prenom} 👋</p>
        <p class="g-hero__sub">${accueil || `${l.ville} · ${l.quartier}`}</p>
        <div class="g-dates">
          <div class="g-dates__box"><small>Arrivée</small><b>${formatDate(r.arrivee, { moisLong: false })}</b></div>
          <div class="g-dates__arrow">${ic('<path d="M5 12h14M13 6l6 6-6 6"/>')}</div>
          <div class="g-dates__box"><small>Départ</small><b>${formatDate(r.depart, { moisLong: false })}</b></div>
        </div>
      </div>
    </div>

    ${corpsPage}

    ${PAGE_SEJOUR.signature ? `<p class="g-signature">${vars(PAGE_SEJOUR.signature)}</p>` : ''}
    <p class="g-foot">Séjour géré avec <a href="index.html">Oyvia</a> · Merci de votre visite ✦</p>`;

  /* ---------- Fiches de police (une par voyageur de la réservation) ---------- */
  (function fichesPolice() {
    // Le bloc peut être désactivé dans la configuration : #fp-section
    // n'existe alors pas, inutile d'aller plus loin.
    if (!blocPageSejourActif('fiche_police')) return;
    const TYPE_PIECE = { cni: 'Carte nationale d\'identité', passeport: 'Passeport', titre_sejour: 'Titre de séjour' };
    const total = r.pers || 1;
    let editingSlot = null;

    function ficheRowHTML(i, f) {
      if (f) {
        return `<div class="fp-row">
          <div class="fp-row__who">
            <span class="fp-row__ic fp-row__ic--done">${ic('<path d="M20 6 9 17l-5-5"/>')}</span>
            <div><b class="fp-row__name">${f.prenom} ${f.nom}</b><p class="fp-row__meta">${f.nationalite} · ${TYPE_PIECE[f.typePiece]}</p></div>
          </div>
          <button type="button" class="btn btn--secondary btn--sm" data-fp-edit="${i}">Modifier</button>
        </div>`;
      }
      return `<div class="fp-row">
        <div class="fp-row__who">
          <span class="fp-row__ic fp-row__ic--pending">${ic('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>')}</span>
          <div><b class="fp-row__name">Voyageur ${i + 1}</b><p class="fp-row__meta">Fiche à compléter</p></div>
        </div>
        <button type="button" class="btn btn--primary btn--sm" data-fp-edit="${i}">Remplir la fiche</button>
      </div>`;
    }

    function renderSection() {
      const fiches = getFichesPolice(r.id);
      const done = fiches.filter(Boolean).length;
      const pct = Math.round((done / total) * 100);
      document.getElementById('fp-section').innerHTML = `
        <div class="fp-summary">
          <div class="progress" style="flex:1"><div class="progress__bar ${done === total ? 'progress__bar--sage' : ''}" style="width:${pct}%"></div></div>
          <span class="fp-summary__count">${done}/${total} complétée${total > 1 ? 's' : ''}</span>
        </div>
        <div class="fp-list">${Array.from({ length: total }).map((_, i) => ficheRowHTML(i, fiches[i])).join('')}</div>`;
      document.querySelectorAll('[data-fp-edit]').forEach(b => b.addEventListener('click', () => openModal(parseInt(b.dataset.fpEdit, 10))));
    }

    function openModal(i) {
      editingSlot = i;
      const f = getFichesPolice(r.id)[i] || {};
      const set = (id, val) => { document.getElementById(id).value = val || ''; };
      set('fp-civilite', f.civilite || 'M.');
      set('fp-nom', f.nom);
      set('fp-prenom', f.prenom);
      set('fp-naissance', f.dateNaissance);
      set('fp-lieu', f.lieuNaissance);
      set('fp-nationalite', f.nationalite);
      set('fp-adresse', f.adresse);
      set('fp-type-piece', f.typePiece || 'cni');
      set('fp-numero', f.numeroPiece);
      document.getElementById('fp-consent').checked = !!f.soumisLe;
      document.getElementById('fp-modal-title').textContent = `Fiche de police — Voyageur ${i + 1}`;
      openOverlay();
    }

    function openOverlay() {
      let scrim = document.getElementById('g-scrim');
      if (!scrim) { scrim = document.createElement('div'); scrim.id = 'g-scrim'; scrim.className = 'overlay'; document.body.appendChild(scrim); scrim.addEventListener('click', closeOverlay); }
      scrim.classList.add('is-open');
      document.getElementById('fp-modal').classList.add('is-open');
    }
    function closeOverlay() {
      document.getElementById('fp-modal').classList.remove('is-open');
      const s = document.getElementById('g-scrim'); if (s) s.classList.remove('is-open');
    }
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeOverlay(); });

    function toast(msg, ok = true) {
      let zone = document.querySelector('.toast-zone');
      if (!zone) { zone = document.createElement('div'); zone.className = 'toast-zone'; document.body.appendChild(zone); }
      const t = document.createElement('div');
      t.className = 'toast';
      const svgIc = ok ? '<path d="M20 6 9 17l-5-5"/>' : '<path d="M18 6 6 18M6 6l12 12"/>';
      t.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${svgIc}</svg> ${msg}`;
      zone.appendChild(t);
      setTimeout(() => t.remove(), 2600);
    }

    document.getElementById('fp-close').addEventListener('click', closeOverlay);
    document.getElementById('fp-cancel').addEventListener('click', closeOverlay);
    document.getElementById('fp-save').addEventListener('click', () => {
      const val = id => document.getElementById(id).value.trim();
      const nom = val('fp-nom'), prenom = val('fp-prenom'), naissance = val('fp-naissance'),
        lieu = val('fp-lieu'), nationalite = val('fp-nationalite'), adresse = val('fp-adresse'), numero = val('fp-numero');
      const consent = document.getElementById('fp-consent').checked;
      if (!nom || !prenom || !naissance || !nationalite || !numero) { toast('Merci de compléter tous les champs obligatoires', false); return; }
      if (!consent) { toast('Merci de certifier l\'exactitude des informations', false); return; }
      saveFichePolice(r.id, editingSlot, {
        civilite: document.getElementById('fp-civilite').value,
        nom, prenom, dateNaissance: naissance, lieuNaissance: lieu, nationalite, adresse,
        typePiece: document.getElementById('fp-type-piece').value, numeroPiece: numero,
      });
      closeOverlay();
      renderSection();
      toast('Fiche enregistrée, merci !');
    });

    renderSection();
  })();
})();
