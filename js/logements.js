/* ============================================================
   OYVIA — Logements : cartes + fiche détaillée à onglets
   ============================================================ */
Layout.init('logements');

(function () {
  // Habillage des canaux de distribution. Les notes ne sont pas sur la même
  // échelle selon la plateforme : Airbnb et VRBO notent sur 5, Booking sur 10.
  const CH = {
    airbnb:  { label: 'Airbnb',      letter: 'A', col: 'var(--ch-airbnb)',  echelle: 5  },
    booking: { label: 'Booking.com', letter: 'B', col: 'var(--ch-booking)', echelle: 10 },
    direct:  { label: 'Direct',      letter: 'D', col: 'var(--ch-direct)',  echelle: 5  },
    vrbo:    { label: 'VRBO',        letter: 'V', col: '#1668E3',           echelle: 5  },
    expedia: { label: 'Expedia',     letter: 'E', col: '#FFC94D',           echelle: 10 },
  };
  const list = document.getElementById('lg-list');
  const detail = document.getElementById('lg-detail');
  const grid = document.getElementById('lg-grid');
  const content = document.getElementById('lg-detail-content');
  const star = '<svg viewBox="0 0 24 24"><path d="M12 2l3 6.9 7.6.6-5.8 5 1.8 7.4L12 18l-6.4 3.9 1.8-7.4-5.8-5 7.6-.6z"/></svg>';

  /* ---------- Tâches récurrentes ---------- */
  const icon = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  const initiales = n => n.split(' ').map(m => m[0]).slice(0, 2).join('').toUpperCase();
  const ICO_EDIT = '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>';
  const ICO_DEL = '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6"/>';
  const REC_TYPES = {
    menage:      { label: 'Ménage',          icon: '<path d="M12 2.5l1.7 4.3 4.6.3-3.6 2.9 1.2 4.5L12 12l-3.9 2.5 1.2-4.5-3.6-2.9 4.6-.3z"/><path d="M6 21l3-4M18 21l-3-4"/>' },
    accueil:     { label: 'Accueil',          icon: '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="M10 17l5-5-5-5M15 12H3"/>' },
    maintenance: { label: 'Maintenance',      icon: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-2.4z"/>' },
    inspection:  { label: 'Inspection',       icon: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>' },
    linge:       { label: 'Linge',            icon: '<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/>' },
    cles:        { label: 'Remise des clés',  icon: '<circle cx="8" cy="15" r="4"/><path d="M10.8 12.2 20 3M16 5l3 3M19 8l1.5-1.5"/>' },
  };
  const REC_TRIGGERS = {
    checkin:          { label: 'À chaque check-in' },
    checkout:         { label: 'À chaque check-out' },
    j_avant_checkin:  { unit: 'jours avant le check-in',  tpl: n => `${n} jour${n > 1 ? 's' : ''} avant le check-in` },
    h_avant_checkin:  { unit: 'heures avant le check-in', tpl: n => `${n} h avant le check-in` },
    j_apres_checkout: { unit: 'jours après le check-out', tpl: n => `${n} jour${n > 1 ? 's' : ''} après le check-out` },
    quotidien:        { label: 'Tous les jours' },
    hebdo:            { label: 'Toutes les semaines' },
    mensuel:          { label: 'Tous les mois' },
  };
  const triggerLabel = r => { const m = REC_TRIGGERS[r.declencheur]; return m.tpl ? m.tpl(r.delai) : m.label; };
  let currentLgId = null, recEditId = null, recType = 'menage';

  /* ---------- Cartes ---------- */
  function channelsHTML(l) {
    return canauxConnectes(l).map(([k, c]) =>
      `<span class="lg-chan" style="background:${CH[k].col}" title="${CH[k].label} — ${c.statut === 'ok' ? 'synchronisé' : 'à vérifier'}">${CH[k].letter}<span class="lg-chan__sync lg-chan__sync--${c.statut}"></span></span>`
    ).join('');
  }
  // Le filtre de l'en-tête de page (#app-logement, rempli par layout.js)
  // restreint la grille à un seul bien.
  function logementsVisibles() {
    const id = Layout.currentLogement;
    return id === 'all' ? LOGEMENTS : LOGEMENTS.filter(l => l.id === id);
  }

  function renderCards() {
    const visibles = logementsVisibles();
    document.getElementById('lg-count').textContent = visibles.length === LOGEMENTS.length
      ? `${LOGEMENTS.length} logements connectés`
      : `${visibles.length} logement affiché sur ${LOGEMENTS.length} · filtre actif`;
    grid.innerHTML = visibles.map(l => {
      const st = STATUT_ANNONCE[l.statut] || STATUT_ANNONCE.publie;
      const conf = conformiteStatut(l);
      // Deux signaux méritent d'être vus sans ouvrir la fiche : une annonce
      // qui n'est pas en ligne, et un plafond de nuitées près d'être atteint.
      const alerte = conf.niveau === 'alerte' || conf.niveau === 'depasse'
        ? `<div class="lg-card__flag" title="${conf.texte}">⚠ ${conf.texte}</div>` : '';
      return `
      <article class="lg-card" data-id="${l.id}">
        <div class="lg-card__cover" style="background:${l.couleur}">
          <span class="lg-card__note">${star} ${l.note.toFixed(1)}</span>
          ${l.statut !== 'publie' ? `<span class="badge ${st.badge} lg-card__statut">${st.label}</span>` : ''}
        </div>
        <div class="lg-card__body">
          <div class="lg-card__title">${l.nom}</div>
          <div class="lg-card__meta">${l.ville} · ${labelTypeLogement(l.type)} · ${labelTypeChambre(l.typeChambre)}</div>
          <div class="lg-card__specs">${l.capacite} voyageurs · ${l.chambres} ch. · ${l.sdb} sdb${l.surface ? ` · ${l.surface} m²` : ''}</div>
          ${alerte}
          <div class="lg-card__row">
            <div class="lg-card__channels">${channelsHTML(l)}</div>
            <div class="lg-card__price"><b>${formatMontant(l.tarifBase)}</b> <span>/ nuit</span></div>
          </div>
        </div>
      </article>`;
    }).join('');
  }
  renderCards();

  // Filtrer depuis la fiche détaillée n'aurait pas de sens : on revient à la
  // liste pour que le résultat du filtre soit visible tout de suite.
  document.addEventListener('logementChange', () => {
    if (!detail.classList.contains('hidden')) backToList();
    renderCards();
  });

  grid.addEventListener('click', e => { const c = e.target.closest('.lg-card'); if (c) showDetail(c.dataset.id); });

  /* ---------- Ajout / modification d'un logement ---------- */
  const COULEURS = ['#5170FF', '#00A550', '#F5A300', '#0A3D91', '#8A5A3C', '#9A5A6E', '#3D6E80', '#4A6A58'];
  let editLogementId = null;

  // Les listes déroulantes sont alimentées par le référentiel : ajouter un
  // type de bien dans data.js suffit à le voir apparaître ici.
  document.getElementById('lg-f-type').innerHTML =
    TYPES_LOGEMENT.map(t => `<option value="${t.id}">${t.label}</option>`).join('');
  document.getElementById('lg-f-typechambre').innerHTML =
    TYPES_CHAMBRE.map(t => `<option value="${t.id}">${t.label}</option>`).join('');

  function openLogementModal(id) {
    editLogementId = id || null;
    const l = id ? getLogement(id) : null;
    document.getElementById('lg-f-nom').value = l ? l.nom : '';
    document.getElementById('lg-f-ville').value = l ? l.ville : '';
    document.getElementById('lg-f-type').value = l ? l.type : 'appartement';
    document.getElementById('lg-f-typechambre').value = l ? l.typeChambre : 'entier';
    document.getElementById('lg-f-cap').value = l ? l.capacite : 2;
    // Les tarifs sont stockés en euros : on les présente dans la devise choisie.
    document.getElementById('lg-f-tarif').value = montantSaisie(l ? l.tarifBase : 80);
    document.getElementById('lg-f-surface').value = l && l.surface ? l.surface : '';
    document.getElementById('lg-modal-title').textContent = l ? 'Modifier le logement' : 'Ajouter un logement';
    document.getElementById('lg-create').textContent = l ? 'Enregistrer' : 'Créer le logement';
    UI.openPanel('lg-modal');
  }

  document.getElementById('lg-add').addEventListener('click', () => openLogementModal(null));
  document.getElementById('lg-create').addEventListener('click', () => {
    const nom = document.getElementById('lg-f-nom').value.trim();
    const ville = document.getElementById('lg-f-ville').value.trim();
    if (!nom || !ville) { UI.toast('Renseignez au moins le nom et la ville', false); return; }
    const cap = parseInt(document.getElementById('lg-f-cap').value, 10) || 2;
    // Retour vers l'euro, devise de stockage. lireMontantSaisi() laisse le
    // montant d'origine intact s'il n'a pas été modifié : pas de dérive
    // d'arrondi à force d'ouvrir et de refermer la fiche.
    const ancien = editLogementId ? getLogement(editLogementId).tarifBase : null;
    const tarif = lireMontantSaisi(document.getElementById('lg-f-tarif').value, ancien) || 80;
    const type = document.getElementById('lg-f-type').value;
    const typeChambre = document.getElementById('lg-f-typechambre').value;
    const surface = parseInt(document.getElementById('lg-f-surface').value, 10) || null;

    if (editLogementId) {
      // Le forfait ménage n'est PAS recalculé ici. Il est dérivé du tarif de
      // base à la création, faute de mieux, mais il se règle ensuite pour de
      // bon ailleurs. Le réécrire à chaque modification effaçait sans prévenir
      // un forfait ajusté à la main — cette modale ne propose même pas le
      // champ, l'hôte n'avait donc aucun moyen de s'en apercevoir.
      Object.assign(getLogement(editLogementId), { nom, ville, type, typeChambre, surface, capacite: cap, tarifBase: tarif });
      const id = editLogementId; editLogementId = null;
      UI.closeAll(); renderCards();
      if (!detail.classList.contains('hidden')) showDetail(id);
      UI.toast('Logement modifié');
      return;
    }

    const id = 'L' + String(LOGEMENTS.length + 1).padStart(3, '0') + Date.now().toString().slice(-3);
    const chambres = Math.max(1, Math.round(cap / 2));

    // _logement() applique DEFAUTS_LOGEMENT : le nouveau bien possède donc
    // tout le schéma, même les champs qu'on ne demande pas à la création.
    // Sans ça, la fiche détail planterait sur les sous-objets manquants.
    // Il naît en brouillon : rien ne doit partir sur les canaux avant que
    // l'annonce et les tarifs aient été relus.
    LOGEMENTS.push(_logement({
      id, nom, ville, quartier: 'Centre-ville', pays: 'France',
      type, typeChambre, surface, capacite: cap,
      chambres, lits: chambres, sdb: 1,
      tarifBase: tarif, menageTarif: Math.round(tarif * 0.4),
      couleur: COULEURS[LOGEMENTS.length % COULEURS.length],
      adresse: `${ville}, France`, note: 5.0, avis: 0,
      statut: 'brouillon',
      annonce: { titre: nom },
      lieu: { rue: '', region: '' },
      couchages: Array.from({ length: chambres }, (_, i) => ({ piece: `Chambre ${i + 1}`, lits: [{ type: 'double', nb: 1 }] })),
      equipements: ['wifi', 'chauffage', 'eau_chaude', 'cuisine', 'linge_fourni', 'detecteur_fumee'],
      tarifs: { caution: tarif * 3 },
      codeAcces: String(Math.floor(1000 + Math.random() * 9000)),
      wifi: { ssid: 'Oyvia-' + ville, pass: 'bienvenue' + tarif },
      photos: [],
      canaux: {},   // aucun canal tant que l'annonce n'est pas prête
    }));
    UI.closeAll(); renderCards(); UI.toast('Logement créé en brouillon');
  });

  /* ---------- Fiche détaillée ---------- */
  const JOURS_COURTS = { lun:'Lun', mar:'Mar', mer:'Mer', jeu:'Jeu', ven:'Ven', sam:'Sam', dim:'Dim' };
  const oui = v => v ? '<span class="badge badge--positive">Oui</span>' : '<span class="badge badge--neutral">Non</span>';
  const row = (k, v) => `<div class="rp-row"><span>${k}</span><span>${v}</span></div>`;
  const vide = '<span class="text-muted">Non renseigné</span>';

  // Un séjour de 7 nuits à 2 personnes : de quoi comparer les frais entre eux
  // plutôt que d'aligner des montants isolés.
  function exempleTotal(l) {
    const nuits = 7, pers = 2, t = l.tarifs;
    const nuitees = l.tarifBase * nuits;
    const taxe = t.taxeSejour.mode === 'pourcentage'
      ? Math.round(nuitees * t.taxeSejour.montant / 100)
      : t.taxeSejour.mode === 'par_sejour'
        ? t.taxeSejour.montant
        : t.taxeSejour.montant * pers * Math.min(nuits, t.taxeSejour.plafondNuits || nuits);
    const remise = Math.round(nuitees * (t.remises.hebdo || 0) / 100);
    return { nuits, pers, nuitees, remise, menage: l.menageTarif, taxe, total: nuitees - remise + l.menageTarif + taxe };
  }

  function paneAnnonce(l) {
    const st = STATUT_ANNONCE[l.statut] || STATUT_ANNONCE.publie;
    const conf = conformiteStatut(l);
    const badgeConf = { ok:'badge--positive', alerte:'badge--warning', depasse:'badge--danger', manquant:'badge--danger' }[conf.niveau];
    const a = l.annonce;
    const bloc = (titre, txt) => `<div class="lg-desc"><p class="lg-desc__label">${titre}</p><p>${txt || vide}</p></div>`;

    return `
      <div class="app-grid app-grid--2-1">
        <div class="card card--pad">
          <div class="row" style="justify-content:space-between;align-items:center;margin-bottom:var(--sp-4)">
            <p class="eyebrow">Contenu de l'annonce</p>
            <span class="badge ${st.badge}">${st.label}</span>
          </div>
          <div class="lg-desc"><p class="lg-desc__label">Titre public</p><p class="fw-semibold">${a.titre || vide}</p></div>
          ${bloc('Résumé', a.resume)}
          ${bloc('Le logement', a.espace)}
          ${bloc('Le quartier', a.quartierTxt)}
          ${bloc('Se déplacer', a.transports)}
          ${bloc('À savoir', a.aSavoir)}
        </div>

        <div>
          <div class="card card--pad">
            <p class="eyebrow mb-4">Adresse</p>
            ${row('Rue', l.lieu.rue || l.adresse)}
            ${row('Code postal', l.lieu.codePostal || vide)}
            ${row('Ville', l.ville)}
            ${row('Quartier', l.quartier)}
            ${row('Région', l.lieu.region || vide)}
            ${row('Pays', l.pays)}
            ${row('Coordonnées', l.lieu.latitude ? `${l.lieu.latitude}, ${l.lieu.longitude}` : vide)}
            ${row('Fuseau horaire', l.lieu.fuseau)}
            ${row('Adresse exacte publiée', oui(l.lieu.adressePrecise))}
            <p class="text-xs text-muted" style="margin-top:var(--sp-3)">Airbnb ne communique l'adresse exacte au voyageur qu'après confirmation de la réservation.</p>
          </div>

          <div class="card card--pad mt-4">
            <div class="row" style="justify-content:space-between;align-items:center;margin-bottom:var(--sp-4)">
              <p class="eyebrow">Conformité</p>
              <span class="badge ${badgeConf}">${conf.texte}</span>
            </div>
            ${row("Numéro d'enregistrement", l.conformite.numeroEnregistrement || vide)}
            ${row('Plafond de nuitées', l.conformite.plafondNuits ? `${l.conformite.nuitsConsommees} / ${l.conformite.plafondNuits} nuits` : 'Non applicable')}
            ${row('Assurance', l.conformite.assurance || vide)}
            ${l.conformite.plafondNuits ? `<div class="lg-jauge mt-4"><div class="lg-jauge__barre"><i style="width:${Math.min(100, Math.round(l.conformite.nuitsConsommees / l.conformite.plafondNuits * 100))}%"></i></div></div>` : ''}
          </div>
        </div>
      </div>`;
  }

  function paneLogement(l, resas, ca) {
    const places = placesCouchages(l);
    const groupes = amenitiesParCategorie(l);
    const nd = l.notesDetail;
    const noteRow = (k, v) => `<div class="lg-note"><span>${k}</span><div class="lg-note__barre"><i style="width:${v / 5 * 100}%"></i></div><b>${v.toFixed(1)}</b></div>`;

    return `
      <div class="app-grid app-grid--2">
        <div class="card card--pad">
          <p class="eyebrow mb-4">Caractéristiques</p>
          ${row('Type de bien', labelTypeLogement(l.type) + (l.typologie ? ` · ${l.typologie}` : ''))}
          ${row('Type de location', labelTypeChambre(l.typeChambre))}
          ${row('Capacité', `${l.capacite} voyageurs`)}
          ${row('Chambres', l.chambres)}
          ${row('Salles de bain', `${l.sdb}${l.sdbPartagees ? ` (dont ${l.sdbPartagees} partagée${l.sdbPartagees > 1 ? 's' : ''})` : ''}`)}
          ${row('Surface', l.surface ? `${l.surface} m²` : vide)}
          <p class="text-xs text-muted" style="margin-top:var(--sp-3)">${TYPES_CHAMBRE.find(t => t.id === l.typeChambre).desc}</p>
        </div>

        <div class="card card--pad">
          <div class="row" style="justify-content:space-between;align-items:baseline;margin-bottom:var(--sp-4)">
            <p class="eyebrow">Couchages</p>
            <span class="text-xs ${places < l.capacite ? 'text-danger' : 'text-muted'}">${places} place${places > 1 ? 's' : ''} déclarée${places > 1 ? 's' : ''} pour ${l.capacite} voyageurs</span>
          </div>
          ${l.couchages.length ? l.couchages.map(p => `
            <div class="lg-couchage">
              <b>${p.piece}</b>
              <span>${p.lits.map(b => `${b.nb} × ${labelTypeLit(b.type)}`).join(' · ')}</span>
            </div>`).join('') : `<p class="text-sm text-muted">${vide}</p>`}
        </div>
      </div>

      <div class="card card--pad mt-4">
        <p class="eyebrow mb-4">Équipements · ${l.equipements.length} déclarés</p>
        ${groupes.map(g => `
          <div class="lg-amgroupe">
            <p class="lg-amgroupe__label">${g.label}</p>
            <div class="lg-equip">${g.items.map(a => `<span>${a.label}</span>`).join('')}</div>
          </div>`).join('')}
        <p class="text-xs text-muted" style="margin-top:var(--sp-4)">Ces identifiants sont normalisés : chaque canal les traduit dans son propre vocabulaire lors de la synchronisation.</p>
      </div>

      <div class="app-grid app-grid--2 mt-4">
        <div class="card card--pad">
          <p class="eyebrow mb-4">Notes détaillées</p>
          ${noteRow('Propreté', nd.proprete)}
          ${noteRow('Exactitude', nd.precision)}
          ${noteRow('Arrivée', nd.arrivee)}
          ${noteRow('Communication', nd.communication)}
          ${noteRow('Emplacement', nd.emplacement)}
          ${noteRow('Rapport qualité-prix', nd.qualitePrix)}
        </div>
        <div class="card card--pad">
          <p class="eyebrow mb-4">Performance</p>
          ${row('Réservations', resas.length)}
          ${row("Chiffre d'affaires", `<span class="fw-semibold">${formatMontant(ca)}</span>`)}
          ${row('Note globale', `${l.note.toFixed(1)} / 5 · ${l.avis} avis`)}
          ${row('Statut Superhôte', oui(l.superhote))}
        </div>
      </div>`;
  }

  function paneTarifs(l) {
    const t = l.tarifs, ex = exempleTotal(l);
    const pct = v => v ? `−${v} %` : vide;
    const taxeTxt = t.taxeSejour.mode === 'pourcentage'
      ? `${t.taxeSejour.montant} % du prix de la nuit`
      : t.taxeSejour.mode === 'par_sejour'
        ? `${formatMontant(t.taxeSejour.montant, 2)} par séjour`
        : `${formatMontant(t.taxeSejour.montant, 2)} par personne et par nuit`;

    return `
      <div class="app-grid app-grid--2">
        <div class="card card--pad">
          <p class="eyebrow mb-4">Prix</p>
          ${row('Tarif de base', `<span class="fw-semibold">${formatMontant(l.tarifBase)} / nuit</span>`)}
          ${row('Tarif week-end', t.weekend ? `${formatMontant(t.weekend)} / nuit` : 'Identique à la semaine')}
          ${row('Voyageurs inclus', t.personnesIncluses)}
          ${row('Personne supplémentaire', t.personneSup ? `${formatMontant(t.personneSup)} / nuit` : 'Sans supplément')}
          ${row('Tarification dynamique', tdPilote(l)
            // Le nom vient du moteur réellement en service, jamais d'une
            // valeur figée sur la fiche : afficher « PriceLabs » alors que
            // c'est Oyvia qui calcule laisserait croire l'inverse.
            ? `<span class="badge badge--positive">${tdMoteur().nom}</span>`
            : (t.dynamique.actif
              // Activée sur la fiche mais aucun moteur choisi : nommer une
              // plateforme laisserait croire que des prix partent.
              ? '<span class="badge badge--warning">En attente d\'un moteur</span>'
              : '<span class="badge badge--neutral">Désactivée</span>'))}
          ${row('Bornes du tarif', t.min && t.max ? `${formatMontant(t.min)} — ${formatMontant(t.max)}` : vide)}
        </div>

        <div class="card card--pad">
          <p class="eyebrow mb-4">Frais &amp; taxes</p>
          ${row('Forfait ménage', `${formatMontant(l.menageTarif)} <span class="text-muted text-xs">par ${t.fraisMenagePar === 'nuit' ? 'nuit' : 'séjour'}</span>`)}
          ${row('Caution', t.caution ? formatMontant(t.caution) : 'Aucune')}
          ${row('Frais animal', t.fraisAnimal ? `${formatMontant(t.fraisAnimal)} par séjour` : (l.regles.animaux ? 'Gratuit' : 'Animaux non acceptés'))}
          ${row('Taxe de séjour', taxeTxt)}
          ${row('Plafond taxe', t.taxeSejour.plafondNuits ? `${t.taxeSejour.plafondNuits} nuits` : 'Aucun')}
          ${row('Devise', t.devise)}
        </div>
      </div>

      <div class="app-grid app-grid--2 mt-4">
        <div class="card card--pad">
          <p class="eyebrow mb-4">Remises</p>
          ${row('Séjour à la semaine', pct(t.remises.hebdo))}
          ${row('Séjour au mois', pct(t.remises.mensuelle))}
          ${row('Réservation anticipée', t.remises.earlyBird ? `${pct(t.remises.earlyBird)} au-delà de ${t.remises.earlyBirdJours} jours` : vide)}
          ${row('Dernière minute', t.remises.lastMinute ? `${pct(t.remises.lastMinute)} à moins de ${t.remises.lastMinuteJours} jours` : vide)}
        </div>

        <div class="card card--pad">
          <p class="eyebrow mb-4">Exemple · ${ex.nuits} nuits, ${ex.pers} voyageurs</p>
          ${row(`${ex.nuits} nuits × ${formatMontant(l.tarifBase)}`, formatMontant(ex.nuitees))}
          ${ex.remise ? row('Remise séjour à la semaine', `<span class="text-positive">− ${formatMontant(ex.remise)}</span>`) : ''}
          ${row('Forfait ménage', formatMontant(ex.menage))}
          ${row('Taxe de séjour', formatMontant(ex.taxe))}
          <div class="rp-row" style="border-top:1px solid var(--c-border);margin-top:var(--sp-2);padding-top:var(--sp-3)">
            <span class="fw-semibold">Total voyageur</span><span class="fw-semibold">${formatMontant(ex.total)}</span>
          </div>
          <p class="text-xs text-muted" style="margin-top:var(--sp-3)">Hors caution, restituée après le séjour. Les commissions des plateformes s'appliquent en plus, côté hôte.</p>
        </div>
      </div>`;
  }

  function paneSejour(l) {
    const s = l.sejour, r = l.regles;
    const pol = POLITIQUES_ANNULATION.find(p => p.id === l.politiqueAnnulation) || {};
    const jours = liste => Object.keys(JOURS_COURTS).map(j =>
      `<span class="lg-jour ${liste.includes(j) ? 'is-on' : ''}">${JOURS_COURTS[j]}</span>`).join('');

    return `
      <div class="app-grid app-grid--2">
        <div class="card card--pad">
          <p class="eyebrow mb-4">Durée &amp; disponibilité</p>
          ${row('Séjour minimum', `${s.nuitsMin} nuit${s.nuitsMin > 1 ? 's' : ''}`)}
          ${row('Séjour maximum', `${s.nuitsMax} nuits`)}
          ${row('Préavis avant arrivée', `${s.preavis} jour${s.preavis > 1 ? 's' : ''}`)}
          ${row('Nuits de préparation', s.preparation ? `${s.preparation} nuit${s.preparation > 1 ? 's' : ''} bloquée${s.preparation > 1 ? 's' : ''} après chaque départ` : 'Aucune')}
          ${row('Calendrier ouvert sur', `${s.fenetreMois} mois`)}
          ${row('Réservation instantanée', oui(s.reservationInstantanee))}
        </div>

        <div class="card card--pad">
          <p class="eyebrow mb-4">Arrivée &amp; départ</p>
          ${row('Arrivée', `à partir de ${s.arrivee}${s.arriveeMax ? ` — jusqu'à ${s.arriveeMax}` : ''}`)}
          ${row('Départ', `avant ${s.depart}`)}
          ${row('Arrivée flexible', oui(s.arriveeFlexible))}
          <div class="field mt-4"><span class="field__label">Jours d'arrivée autorisés</span><div class="lg-jours">${jours(s.joursArrivee)}</div></div>
          <div class="field mt-4"><span class="field__label">Jours de départ autorisés</span><div class="lg-jours">${jours(s.joursDepart)}</div></div>
        </div>
      </div>

      <div class="app-grid app-grid--2 mt-4">
        <div class="card card--pad">
          <p class="eyebrow mb-4">Politique d'annulation</p>
          <div class="rp-row"><span>Palier appliqué</span><span><span class="badge badge--accent">${pol.label}</span></span></div>
          <p class="text-sm text-soft" style="margin-top:var(--sp-3)">${pol.desc || ''}</p>
          <p class="text-xs text-muted" style="margin-top:var(--sp-3)">Chaque plateforme nomme ses paliers différemment ; Oyvia les ramène à un vocabulaire commun avant de les pousser.</p>
        </div>

        <div class="card card--pad">
          <p class="eyebrow mb-4">Règlement intérieur</p>
          ${row('Fumeurs', oui(r.fumeurs))}
          ${row('Animaux', r.animaux ? `<span class="badge badge--positive">Oui, ${r.animauxMax} max</span>` : oui(false))}
          ${row('Fêtes et événements', oui(r.fetes))}
          ${row('Enfants bienvenus', oui(r.enfants))}
          ${row('Adapté aux bébés', oui(r.bebes))}
          ${row('Heures de silence', `${r.silenceDebut} — ${r.silenceFin}`)}
          ${r.complement ? `<p class="text-sm text-soft" style="margin-top:var(--sp-3)">${r.complement}</p>` : ''}
        </div>
      </div>`;
  }

  /* ---------- Accès ----------
     Trois modes, trois mécaniques réellement différentes : un code piloté
     par API (Seam), un code saisi à la main, un humain. Le panneau central
     change entièrement selon le mode ; le reste (sur place, Wi-Fi) est
     commun aux trois. */
  const ACC_ICONS = {
    serrure_connectee: '<rect x="4" y="10.5" width="16" height="10.5" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/><path d="M12 14.5v2.5"/>',
    boite_cles:        '<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M7.5 8V5.5a4.5 4.5 0 0 1 9 0V8"/><path d="M8 12.5h.01M12 12.5h.01M16 12.5h.01M8 16h.01M12 16h.01M16 16h.01"/>',
    personne:          '<circle cx="10" cy="7.5" r="3.5"/><path d="M3.5 21a6.5 6.5 0 0 1 13 0"/><circle cx="18" cy="14" r="2.2"/><path d="M19.3 15.6 22 18.3M20.6 17l.9-.9"/>',
  };
  const ICO_SEAM_VIDE = '<rect x="4" y="10.5" width="16" height="10.5" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 7.5-2"/>';

  // Une fiche peut avoir été créée avant que ces sous-objets n'existent, ou
  // arriver amputée. On relit toujours l'accès à travers le schéma de
  // référence plutôt que de supposer que les sous-objets sont là : le coût
  // est nul, et ça évite qu'un champ manquant fasse tomber tout l'onglet.
  function accesComplet(l) {
    const D = DEFAUTS_LOGEMENT.acces, a = l.acces || {};
    return {
      ...D, ...a,
      serrure:   { ...D.serrure,   ...(a.serrure   || {}) },
      boiteCles: { ...D.boiteCles, ...(a.boiteCles || {}) },
      personne:  { ...D.personne,  ...(a.personne  || {}) },
    };
  }
  // Variante qui recolle le résultat sur le logement : à appeler avant toute
  // écriture, pour ne pas greffer un sous-objet à moitié rempli.
  function normaliserAcces(lg) { lg.acces = accesComplet(lg); return lg.acces; }

  function panneauSerrure(l) {
    const s = accesComplet(l).serrure;
    if (!s.connectee) {
      return `
        <div class="card card--pad">
          <p class="eyebrow mb-4">Serrure connectée</p>
          <div class="empty">
            ${icon(ICO_SEAM_VIDE)}
            <h4>Aucune serrure appairée</h4>
            <p>Oyvia pilote les serrures via <b>Seam</b>, qui parle à Nuki, Igloohome, TTLock, August ou Yale avec une seule API.</p>
            <button class="btn btn--primary" style="margin-top:var(--sp-4)" data-acc-seam>Appairer une serrure</button>
          </div>
        </div>`;
    }
    const bat = etatBatterie(s.batterie);
    const c = s.code;
    // Hors ligne, Seam refuse aussi bien la création que la révocation :
    // mieux vaut griser les boutons que laisser l'hôte croire que l'ordre est parti.
    const off = !s.enLigne ? 'disabled' : '';
    const STATUTS = { actif:{ label:'Actif', badge:'badge--positive' }, programme:{ label:'Programmé', badge:'badge--warning' }, expire:{ label:'Expiré', badge:'badge--neutral' } };

    return `
      <div class="card card--pad">
        <div class="row-between mb-4">
          <p class="eyebrow">Serrure connectée</p>
          <div class="row gap-2">
            <span class="badge ${s.enLigne ? 'badge--positive' : 'badge--danger'}">${s.enLigne ? 'En ligne' : 'Hors ligne'}</span>
            <button class="btn btn--ghost btn--sm" data-acc-sync>Synchroniser</button>
          </div>
        </div>
        <div class="acc-device">
          <div class="acc-device__ic">${icon(ACC_ICONS.serrure_connectee)}</div>
          <div class="grow">
            <b>${s.marque} ${s.modele}</b>
            <small class="text-muted font-mono">${s.deviceId}</small>
          </div>
          <span class="badge ${bat.badge}">Batterie ${bat.texte}</span>
        </div>
        ${row('Fournisseur', 'Seam — passerelle multi-marques')}
        ${row('État de la porte', s.verrouillee ? 'Verrouillée' : '<span class="text-danger">Déverrouillée</span>')}
        ${row('Dernière synchronisation', s.derniereSynchro || vide)}
        <div class="row-between mt-4">
          <span class="text-sm text-soft">Appairage</span>
          <button class="btn btn--ghost btn--sm" data-acc-seam>Modifier</button>
        </div>
        ${bat.niveau === 'critique' ? `<p class="lg-canal__alerte" style="margin-top:var(--sp-3);border-radius:var(--r-md)">⚠ Batterie à ${s.batterie} % : remplacez-la avant la prochaine arrivée, un code ne sert à rien sur une serrure éteinte.</p>` : ''}
      </div>

      <div class="card card--pad mt-4">
        <div class="row-between mb-4">
          <p class="eyebrow">Code d'accès</p>
          ${c ? `<span class="badge ${STATUTS[c.statut].badge}">${STATUTS[c.statut].label}</span>` : '<span class="badge badge--neutral">Aucun code</span>'}
        </div>
        ${c ? `
          <div class="acc-code">
            <span class="acc-code__val">${c.valeur}</span>
            <span class="acc-code__hint">à composer sur le clavier de la serrure</span>
          </div>
          ${row('Créé le', c.creeLe)}
          ${row('Valable', c.debut ? `du ${c.debut} au ${c.fin}` : 'En permanence, jusqu\'à révocation')}
          ${row('Référence Seam', `<span class="font-mono text-xs">${c.seamId}</span>`)}
          <div class="acc-actions">
            <button class="btn btn--secondary" data-acc-regen ${off}>Régénérer le code</button>
            <button class="btn btn--danger" data-acc-delcode ${off}>Supprimer le code</button>
          </div>
        ` : `
          <div class="empty" style="padding:var(--sp-8) var(--sp-4)">
            ${icon(ICO_SEAM_VIDE)}
            <h4>Aucun code sur la serrure</h4>
            <p>Personne ne peut entrer avec un clavier. Générez un code : il sera poussé sur la serrure et repris automatiquement dans vos messages.</p>
            <button class="btn btn--primary" style="margin-top:var(--sp-4)" data-acc-regen ${off}>Générer un code</button>
          </div>
        `}
        <p class="text-xs text-muted" style="margin-top:var(--sp-3)">La création n'est pas instantanée : Seam accuse réception, puis la serrure confirme. Le code n'apparaît ici qu'une fois confirmé par la porte.</p>
      </div>`;
  }

  function panneauBoiteCles(l) {
    const a = accesComplet(l), b = a.boiteCles;
    return `
      <div class="card card--pad">
        <div class="row-between mb-4">
          <p class="eyebrow">Boîte à clés</p>
          <button class="btn btn--secondary btn--sm" data-acc-boite>Modifier</button>
        </div>
        ${l.codeAcces ? `
          <div class="acc-code">
            <span class="acc-code__val">${l.codeAcces}</span>
            <span class="acc-code__hint">à composer sur la molette de la boîte</span>
          </div>` : `
          <div class="acc-code acc-code--vide">
            <span class="acc-code__val">— — — —</span>
            <span class="acc-code__hint">aucun code défini</span>
          </div>`}
        ${row('Emplacement', b.emplacement || a.emplacementCles || vide)}
        ${row('Modèle', b.modele || vide)}
        ${row('Dernier changement', b.modifieLe ? formatDate(b.modifieLe, { annee: true }) : vide)}
        <p class="text-xs text-muted" style="margin-top:var(--sp-3)">Un code de boîte à clés est fixe : tous les voyageurs passés le connaissent encore. Changez-le régulièrement, en particulier après un long séjour.</p>
      </div>`;
  }

  function panneauPersonne(l) {
    const p = accesComplet(l).personne;
    const renseigne = p.nom || p.telephone || p.email;
    return `
      <div class="card card--pad">
        <div class="row-between mb-4">
          <p class="eyebrow">Personne en charge de la remise des clés</p>
          <button class="btn btn--secondary btn--sm" data-acc-personne>${renseigne ? 'Modifier' : 'Renseigner'}</button>
        </div>
        ${renseigne ? `
          <div class="acc-device">
            <span class="avatar">${p.nom ? initiales(p.nom) : '?'}</span>
            <div class="grow"><b>${p.nom || vide}</b><small class="text-muted">${p.role || 'Rôle non précisé'}</small></div>
          </div>
          ${row('Téléphone', p.telephone ? `<a href="tel:${p.telephone.replace(/\s/g, '')}">${p.telephone}</a>` : vide)}
          ${row('E-mail', p.email ? `<a href="mailto:${p.email}">${p.email}</a>` : vide)}
          ${row('Langues parlées', p.langues && p.langues.length ? p.langues.join(', ') : vide)}
          ${row('Disponibilités', p.disponibilites || vide)}
          ${row('Lieu de rendez-vous', p.lieuRdv || vide)}
          ${p.notes ? `<div class="lg-desc mt-4"><p class="lg-desc__label">Consignes</p><p>${p.notes}</p></div>` : ''}
          <p class="text-xs text-muted" style="margin-top:var(--sp-3)">Ces coordonnées sont internes : elles ne partent sur aucun canal et ne sont pas visibles du voyageur.</p>
        ` : `
          <div class="empty">
            ${icon(ACC_ICONS.personne)}
            <h4>Personne désignée manquante</h4>
            <p>Sans contact enregistré, personne ne sait qui appeler si un voyageur arrive et attend devant la porte.</p>
            <button class="btn btn--primary" style="margin-top:var(--sp-4)" data-acc-personne>Renseigner la personne</button>
          </div>
        `}
      </div>`;
  }

  function paneAcces(l) {
    const a = accesComplet(l);
    const panneau = a.type === 'serrure_connectee' ? panneauSerrure(l)
                  : a.type === 'personne'          ? panneauPersonne(l)
                  :                                  panneauBoiteCles(l);
    return `
      <div class="acc-modes">
        ${TYPES_ACCES.map(t => `
          <button type="button" class="acc-mode ${t.id === a.type ? 'is-active' : ''}" data-acc-mode="${t.id}">
            <span class="acc-mode__ic">${icon(ACC_ICONS[t.id])}</span>
            <span class="acc-mode__txt"><b>${t.label}</b><small>${t.desc}</small></span>
          </button>`).join('')}
      </div>

      <div class="app-grid app-grid--2-1 mt-4">
        <div>${panneau}</div>
        <div>
          <div class="card card--pad">
            <p class="eyebrow mb-4">Sur place</p>
            ${row('Étage', a.etage === 0 ? 'Rez-de-chaussée' : `${a.etage}ᵉ étage`)}
            ${row('Ascenseur', oui(a.ascenseur))}
            ${row('Stationnement', a.parking || vide)}
            ${row('Contact urgence', a.contactUrgence || vide)}
            <div class="lg-desc mt-4"><p class="lg-desc__label">Instructions d'arrivée</p><p>${a.instructions || vide}</p></div>
          </div>

          <div class="card card--pad mt-4">
            <p class="eyebrow mb-4">Wi-Fi</p>
            <div class="msg-ctx__code"><span class="text-sm text-soft">Réseau</span><b>${l.wifi.ssid}</b></div>
            <div class="msg-ctx__code"><span class="text-sm text-soft">Mot de passe</span><b>${l.wifi.pass}</b></div>
            <p class="text-xs text-muted" style="margin-top:var(--sp-3)">Le code d'accès et le Wi-Fi sont insérés automatiquement dans les messages via les variables {code_acces} et {wifi}.</p>
          </div>
        </div>
      </div>`;
  }

  /* ---------- Canaux ----------
     L'onglet Canaux pilote l'activation ; chaque canal actif obtient sa
     propre page, qui montre l'annonce telle qu'elle existe chez lui — son
     vocabulaire, son échelle de notes, ses frais. */
  const nl2p = txt => String(txt).split('\n').filter(Boolean).map(p => `<p>${p}</p>`).join('');
  const cardWrap = (titre, corps) => `<div class="card card--pad"><p class="eyebrow mb-4">${titre}</p>${corps}</div>`;

  function sectionCanalHTML(sec) {
    if (sec.type === 'texte') {
      const blocs = sec.blocs.filter(b => b.texte);
      return cardWrap(sec.titre, blocs.length
        ? blocs.map(b => `<div class="lg-desc"><p class="lg-desc__label">${b.label}</p>${nl2p(b.texte)}</div>`).join('')
        : `<p class="text-sm text-muted">Aucun contenu publié sur ce canal.</p>`);
    }
    if (sec.type === 'paires')
      return cardWrap(sec.titre, sec.paires.map(p => row(p.k, p.v)).join(''));
    if (sec.type === 'groupes')
      return cardWrap(sec.titre, sec.groupes.map(g => `
        <div class="lg-amgroupe">
          <p class="lg-amgroupe__label">${g.label}</p>
          <div class="lg-equip">${g.items.map(a => `<span>${a.label}</span>`).join('')}</div>
        </div>`).join(''));
    if (sec.type === 'couchages')
      return cardWrap(sec.titre, sec.items.length
        ? sec.items.map(p => `<div class="lg-couchage"><b>${p.piece}</b><span>${p.detail}</span></div>`).join('')
        : `<p class="text-sm text-muted">${vide}</p>`);
    if (sec.type === 'notes')
      return cardWrap(sec.titre, sec.items.map(n => `
        <div class="lg-note">
          <span>${n.k}</span>
          <div class="lg-note__barre"><i style="width:${Math.min(100, n.v / sec.echelle * 100)}%"></i></div>
          <b>${n.v.toFixed(1)}</b>
        </div>`).join(''));
    if (sec.type === 'prix')
      return cardWrap(sec.titre,
        sec.lignes.map(x => `<div class="rp-row"><span>${x.k}</span><span${x.positif ? ' class="text-positive"' : ''}>${x.v}</span></div>`).join('') +
        `<div class="rp-row" style="border-top:1px solid var(--c-border);margin-top:var(--sp-2);padding-top:var(--sp-3)">
           <span class="fw-semibold">${sec.total.k}</span><span class="fw-semibold">${sec.total.v}</span>
         </div>`);
    return '';
  }

  function paneCanalDetail(l, k) {
    const A = annonceCanal(l, k);
    const meta = A.meta, c = A.connexion, e = A.entete;
    const noteTxt = e.note != null
      ? `<b>${e.note}</b><span> / ${e.echelle}</span>${e.mention ? ` <em>${e.mention}</em>` : ''} · ${e.avis} avis`
      : '<span class="text-muted">Pas encore noté</span>';
    const pleines = A.sections.filter(s => s.type === 'texte');
    const colonnes = A.sections.filter(s => s.type !== 'texte');

    return `
      <div class="ota-head" style="--ota:${meta.couleur}">
        <div class="ota-head__ic">${meta.lettre}</div>
        <div class="grow">
          <p class="ota-head__canal">Annonce telle qu'elle est publiée sur ${meta.siteNom}</p>
          <h2>${e.titre}</h2>
          <p class="ota-head__sub">${e.sousTitre}</p>
          <div class="ota-head__badges">${e.badges.map(b => `<span class="badge badge--neutral">${b}</span>`).join('')}</div>
        </div>
        <div class="ota-head__note">
          <div class="ota-head__score">${star} ${noteTxt}</div>
          <a class="btn btn--secondary btn--sm" href="${c.url || '#'}" target="_blank" rel="noopener">Ouvrir sur ${meta.label} ↗</a>
        </div>
      </div>

      ${c.message ? `<p class="lg-canal__alerte" style="border-radius:var(--r-md);margin-bottom:var(--sp-4)">⚠ ${c.message}</p>` : ''}

      <div class="lg-photos mb-4">
        ${l.photos.length ? l.photos.map((p, i) => `
          <div class="lg-photo" style="background:linear-gradient(${135 + i * 30}deg, ${l.couleur}, ${i % 2 ? 'var(--ink-300)' : 'var(--blue-400)'})">
            ${i === 0 ? '<span class="lg-photo__flag">Couverture</span>' : ''}
            <span class="lg-photo__legende">${p.legende}</span>
          </div>`).join('') : `<p class="text-sm text-muted">Aucune photo transmise à ce canal.</p>`}
      </div>

      ${pleines.map(sectionCanalHTML).join('')}

      <div class="app-grid app-grid--2 mt-4">
        ${colonnes.map(s => `<div>${sectionCanalHTML(s)}</div>`).join('')}
      </div>`;
  }

  function paneCanaux(l) {
    const connectes = canauxConnectes(l);
    const absents = Object.keys(CH).filter(k => !l.canaux[k] || !l.canaux[k].connecte);
    const nbActifs = canauxActifs(l).length;

    return `
      <p class="text-soft text-sm mb-4">Activez un canal pour qu'il synchronise : sa page apparaît alors dans les onglets ci-dessus, avec l'annonce telle que la plateforme la publie. Le désactiver met la synchronisation en pause sans rien effacer — l'annonce et son identifiant restent rattachés.</p>

      ${connectes.map(([k, c]) => {
        const meta = CH[k];
        const actif = c.actif !== false;
        const note = c.note != null ? `${c.note} / ${meta.echelle} · ${c.avis} avis` : 'Pas encore noté';
        return `
        <div class="lg-canal${actif ? '' : ' lg-canal--pause'}">
          <div class="lg-canal__head">
            <div class="lg-channelrow__ic" style="background:${meta.col}">${meta.letter}</div>
            <div class="grow">
              <b>${meta.label}</b>
              <small class="text-muted">${c.listingId} · ${actif ? `synchronisé le ${c.derniereSynchro}` : `en pause depuis le ${c.derniereSynchro}`}</small>
            </div>
            ${actif
              ? `<span class="badge ${c.statut === 'ok' ? 'badge--positive' : 'badge--warning'}">${c.statut === 'ok' ? 'Connecté' : 'À vérifier'}</span>
                 <button class="btn btn--ghost btn--sm" data-canal-ouvrir="${k}">Ouvrir la page ${icon('<path d="m9 18 6-6-6-6"/>')}</button>`
              : '<span class="badge badge--neutral">En pause</span>'}
            <label class="switch" title="${actif ? 'Désactiver ce canal' : 'Activer ce canal'}">
              <input type="checkbox" data-canal-toggle="${k}"${actif ? ' checked' : ''}>
              <span class="switch__track"></span>
            </label>
          </div>
          <div class="lg-canal__grid">
            <div><small>Identifiant annonce</small><span class="font-mono">${c.listingId}</span></div>
            <div><small>Note sur ce canal</small><span>${note}</span></div>
            <div><small>Commission</small><span>${c.commission} %</span></div>
            <div><small>Prix voyageur · 7 nuits</small><span>${formatMontant(devisCanal(l, k).total)}</span></div>
          </div>
          ${actif && c.message ? `<p class="lg-canal__alerte">⚠ ${c.message}</p>` : ''}
        </div>`;
      }).join('')}

      ${connectes.length && !nbActifs ? `<p class="lg-canal__alerte" style="border-radius:var(--r-md);margin-bottom:var(--sp-3)">⚠ Tous les canaux sont en pause : ce logement n'est plus diffusé nulle part et ne peut plus recevoir de réservation.</p>` : ''}

      ${absents.length ? `
        <div class="card card--pad mt-4">
          <p class="eyebrow mb-4">Canaux disponibles</p>
          ${absents.map(k => `
            <div class="lg-channelrow">
              <div class="lg-channelrow__ic" style="background:${CH[k].col};opacity:.4">${CH[k].letter}</div>
              <div class="grow"><b>${CH[k].label}</b><br><small class="text-muted">Non connecté pour ce logement</small></div>
              <button class="btn btn--secondary btn--sm" onclick="UI.toast('Connexion ${CH[k].label} à configurer dans Paramètres')">Connecter</button>
            </div>`).join('')}
        </div>` : ''}
`;
  }

  function panePhotos(l) {
    return `
      <div class="lg-photos">
        ${l.photos.map((p, i) => `
          <div class="lg-photo" style="background:linear-gradient(${135 + i * 30}deg, ${l.couleur}, ${i % 2 ? 'var(--ink-300)' : 'var(--blue-400)'})">
            ${i === 0 ? '<span class="lg-photo__flag">Couverture</span>' : ''}
            <span class="lg-photo__legende">${p.legende}</span>
          </div>`).join('')}
      </div>
      <p class="text-xs text-muted" style="margin-top:var(--sp-4)">${l.photos.length} photo${l.photos.length > 1 ? 's' : ''} · la première sert de couverture sur tous les canaux. Airbnb en exige au moins 5 pour publier une annonce.</p>`;
  }

  /* Une fiche ne doit jamais devenir inaccessible à cause d'un seul onglet.
     Sans ce filet, une exception dans un panneau interrompt la construction
     du HTML : `content.innerHTML` n'est jamais affecté, la vue détail reste
     masquée, et le clic sur la carte semble ne rien faire — sans le moindre
     message. On isole donc chaque panneau et on montre l'échec là où il est. */
  function safePane(nom, rendu) {
    try { return rendu(); }
    catch (e) {
      console.error(`[logements] onglet « ${nom} » :`, e);
      return `<div class="card card--pad"><div class="empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>
        <h4>Cet onglet n'a pas pu s'afficher</h4>
        <p>Donnée incomplète ou incompatible (${e.message}). Le reste de la fiche reste consultable.</p>
      </div></div>`;
    }
  }

  /* La fiche tient en trois onglets fixes — Accès, Tâches récurrentes,
     Canaux — suivis d'une page par canal ACTIF. Le contenu de l'annonce, les
     tarifs, les règles et les photos ne se saisissent plus ici : ils se lisent
     canal par canal, tels que chaque plateforme les publie. Les panneaux
     correspondants (paneAnnonce, paneLogement, paneTarifs, paneSejour,
     panePhotos) restent dans ce fichier, prêts à être remontés. */
  const ONGLETS_FIXES = [
    { tab:'acces',       label:'Accès' },
    { tab:'recurrentes', label:'Tâches récurrentes' },
    { tab:'canaux',      label:'Canaux' },
  ];

  function showDetail(id, tabActif = 'acces') {
    const l = getLogement(id);
    const actifs = canauxActifs(l);
    // L'onglet demandé peut avoir disparu (canal mis en pause) : on retombe
    // alors sur Canaux, d'où l'action est venue.
    const onglets = ONGLETS_FIXES.concat(actifs.map(([k]) => ({ tab: 'canal-' + k, label: CH[k].label, canal: k })));
    if (!onglets.some(o => o.tab === tabActif)) tabActif = 'canaux';
    const st = STATUT_ANNONCE[l.statut] || STATUT_ANNONCE.publie;

    content.innerHTML = `
      <div class="lg-detail__head">
        <div class="lg-detail__thumb" style="background:${l.couleur}">${l.ville.slice(0, 2).toUpperCase()}</div>
        <div class="lg-detail__meta grow">
          <h1>${l.nom}</h1>
          <p>${l.adresse}</p>
          <div class="row gap-2" style="margin-top:8px;flex-wrap:wrap">
            <span class="badge ${st.badge}">${st.label}</span>
            <span class="badge badge--neutral">${labelTypeLogement(l.type)}</span>
            <span class="badge badge--neutral">${labelTypeChambre(l.typeChambre)}</span>
            <span class="badge badge--neutral">${l.capacite} voyageurs</span>
            <span class="badge badge--accent">${star.replace('viewBox','style="width:12px;height:12px;fill:currentColor" viewBox')} ${l.note.toFixed(1)} · ${l.avis} avis</span>
            ${l.superhote ? '<span class="badge badge--accent">Superhôte</span>' : ''}
          </div>
        </div>
        <button class="btn btn--secondary" id="lg-edit-btn">Modifier</button>
      </div>

      <div class="tabs" id="lg-tabs">
        ${onglets.map(o => `<button${o.tab === tabActif ? ' class="is-active"' : ''} data-tab="${o.tab}">${
          o.canal ? `<span class="lg-tabcanal" style="background:${CH[o.canal].col}"></span>` : ''}${o.label}</button>`).join('')}
      </div>

      <div class="lg-tabpane${tabActif === 'acces' ? ' is-active' : ''}" data-pane="acces">${safePane('Accès', () => paneAcces(l))}</div>
      <div class="lg-tabpane${tabActif === 'canaux' ? ' is-active' : ''}" data-pane="canaux">${safePane('Canaux', () => paneCanaux(l))}</div>
      ${actifs.map(([k]) => `<div class="lg-tabpane${tabActif === 'canal-' + k ? ' is-active' : ''}" data-pane="canal-${k}">${
        safePane(CH[k].label, () => paneCanalDetail(l, k))}</div>`).join('')}

      <div class="lg-tabpane${tabActif === 'recurrentes' ? ' is-active' : ''}" data-pane="recurrentes">
        <div class="rec-head">
          <p class="text-soft text-sm">Ces tâches sont générées automatiquement à chaque réservation (ou selon le rythme choisi) et assignées à un collaborateur.</p>
          <button class="btn btn--primary" id="rec-add">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
            Nouvelle tâche récurrente
          </button>
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Tâche</th><th>Déclencheur</th><th>Collaborateur</th><th>Début</th><th>Fin</th><th>Statut</th><th></th></tr></thead>
            <tbody id="rec-tbody"></tbody>
          </table>
        </div>
      </div>`;

    // Basculer sur la fiche AVANT de brancher quoi que ce soit : le HTML est
    // en place, donc le logement doit être visible même si un branchement
    // échoue ensuite. L'inverse rendait la carte muette au clic.
    currentLgId = id;
    list.classList.add('hidden'); detail.classList.remove('hidden');
    window.scrollTo(0, 0);

    content.querySelector('#lg-tabs').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      content.querySelectorAll('#lg-tabs button').forEach(x => x.classList.remove('is-active'));
      b.classList.add('is-active');
      content.querySelectorAll('.lg-tabpane').forEach(p => p.classList.toggle('is-active', p.dataset.pane === b.dataset.tab));
    });
    content.querySelector('#lg-edit-btn').addEventListener('click', () => openLogementModal(id));

    bindAcces(l);
    bindCanaux(l);
    renderRec();
    content.querySelector('#rec-add').addEventListener('click', () => openRecModal(null));
    content.querySelector('#rec-tbody').addEventListener('click', e => {
      const ed = e.target.closest('[data-rec-edit]'); const del = e.target.closest('[data-rec-del]');
      if (ed) openRecModal(ed.dataset.recEdit);
      else if (del) { const i = RECURRENTES.findIndex(x => x.id === del.dataset.recDel); if (i > -1) RECURRENTES.splice(i, 1); renderRec(); UI.toast('Tâche supprimée'); }
    });
  }

  function backToList() { detail.classList.add('hidden'); list.classList.remove('hidden'); }
  document.getElementById('lg-back').addEventListener('click', backToList);

  /* ---------- Onglet Accès : interactions ---------- */
  function renderAcces() {
    const pane = content.querySelector('[data-pane="acces"]');
    if (pane) pane.innerHTML = safePane('Accès', () => paneAcces(getLogement(currentLgId)));
  }

  function bindAcces(l) {
    const pane = content.querySelector('[data-pane="acces"]');
    if (!pane) return;
    pane.addEventListener('click', e => {
      const lg = getLogement(currentLgId);
      normaliserAcces(lg);   // toutes les actions ci-dessous écrivent dans acces
      const mode = e.target.closest('[data-acc-mode]');
      if (mode) {
        if (lg.acces.type === mode.dataset.accMode) return;
        lg.acces.type = mode.dataset.accMode;
        renderAcces();
        UI.toast(`Mode d'accès : ${labelTypeAcces(lg.acces.type)}`);
        return;
      }
      if (e.target.closest('[data-acc-boite]'))    { openBoiteModal(lg); return; }
      if (e.target.closest('[data-acc-personne]')) { openPersonneModal(lg); return; }
      if (e.target.closest('[data-acc-seam]'))     { openSeamModal(lg); return; }
      if (e.target.closest('[data-acc-sync]'))     { synchroniserSerrure(lg); return; }
      if (e.target.closest('[data-acc-regen]'))    { openGenModal(lg); return; }
      if (e.target.closest('[data-acc-delcode]'))  { supprimerCode(lg); return; }
    });
  }

  // Les trois actions Seam partagent la même mécanique : on verrouille le
  // panneau le temps de l'aller-retour, puis on redessine sur le résultat réel.
  function actionSeam(pane, promesse, onOk) {
    if (pane) pane.classList.add('is-busy');
    promesse
      .then(onOk)
      .catch(err => UI.toast(err.message, false))
      .finally(() => { if (pane) pane.classList.remove('is-busy'); renderAcces(); });
  }

  function synchroniserSerrure(lg) {
    const pane = content.querySelector('[data-pane="acces"]');
    UI.toast('Interrogation de la serrure…');
    actionSeam(pane, Seam.synchroniser(lg), () => UI.toast('Serrure synchronisée'));
  }

  function supprimerCode(lg) {
    UI.confirm({
      title: 'Supprimer le code de la serrure',
      message: "Le code sera révoqué sur la porte. Les voyageurs qui l'ont reçu ne pourront plus entrer, et le logement se retrouvera sans code d'accès jusqu'à ce que vous en génériez un nouveau.",
      confirmText: 'Supprimer le code', danger: true,
      onConfirm: () => {
        const pane = content.querySelector('[data-pane="acces"]');
        UI.toast('Révocation en cours sur la serrure…');
        actionSeam(pane, Seam.supprimerCode(lg), () => UI.toast('Code révoqué sur la serrure'));
      },
    });
  }

  /* ---------- Onglet Canaux : interactions ----------
     Activer ou mettre en pause un canal change la liste des onglets : on
     redessine donc toute la fiche, en restant sur Canaux pour que l'effet de
     l'action soit visible là où on vient de cliquer. */
  function bindCanaux(l) {
    const pane = content.querySelector('[data-pane="canaux"]');
    if (!pane) return;
    pane.addEventListener('change', e => {
      const t = e.target.closest('[data-canal-toggle]');
      if (!t) return;
      const k = t.dataset.canalToggle;
      const lg = getLogement(currentLgId);
      const c = lg.canaux[k];
      c.actif = t.checked;
      showDetail(currentLgId, 'canaux');
      UI.toast(c.actif
        ? `${CH[k].label} activé — la page du canal est disponible`
        : `${CH[k].label} mis en pause — l'annonce et son identifiant sont conservés`);
    });
    pane.addEventListener('click', e => {
      const o = e.target.closest('[data-canal-ouvrir]');
      if (o) showDetail(currentLgId, 'canal-' + o.dataset.canalOuvrir);
    });
  }

  /* ---------- Modales de l'onglet Accès ---------- */
  const $ = id => document.getElementById(id);

  /* Boîte à clés — un code fixe, saisi à la main. */
  function openBoiteModal(lg) {
    $('acc-b-code').value = lg.codeAcces || '';
    $('acc-b-emplacement').value = lg.acces.boiteCles.emplacement || lg.acces.emplacementCles || '';
    $('acc-b-modele').value = lg.acces.boiteCles.modele || '';
    UI.openPanel('acc-boite-modal');
  }
  $('acc-b-save').addEventListener('click', () => {
    const lg = getLogement(currentLgId);
    const code = $('acc-b-code').value.trim().toUpperCase();
    if (!code) { UI.toast('Renseignez le code de la boîte à clés', false); return; }
    const change = code !== lg.codeAcces;
    lg.codeAcces = code;
    lg.acces.boiteCles.emplacement = $('acc-b-emplacement').value.trim();
    lg.acces.boiteCles.modele = $('acc-b-modele').value.trim();
    lg.acces.emplacementCles = lg.acces.boiteCles.emplacement || lg.acces.emplacementCles;
    if (change) lg.acces.boiteCles.modifieLe = AUJOURDHUI;
    UI.closeAll(); renderAcces();
    UI.toast(change ? 'Nouveau code enregistré — pensez à le changer sur la boîte' : 'Boîte à clés mise à jour');
  });

  /* Remise en personne — la fiche de qui détient les clés. */
  function openPersonneModal(lg) {
    const p = lg.acces.personne;
    $('acc-p-nom').value = p.nom || '';
    $('acc-p-role').value = p.role || '';
    $('acc-p-tel').value = p.telephone || '';
    $('acc-p-email').value = p.email || '';
    $('acc-p-langues').value = (p.langues || []).join(', ');
    $('acc-p-dispo').value = p.disponibilites || '';
    $('acc-p-rdv').value = p.lieuRdv || '';
    $('acc-p-notes').value = p.notes || '';
    UI.openPanel('acc-personne-modal');
  }
  $('acc-p-save').addEventListener('click', () => {
    const lg = getLogement(currentLgId);
    const nom = $('acc-p-nom').value.trim();
    const tel = $('acc-p-tel').value.trim();
    // Sans nom ni téléphone la fiche ne sert à rien le jour où un voyageur
    // attend devant la porte : ce sont les deux seuls champs exigés.
    if (!nom || !tel) { UI.toast('Le nom et le téléphone sont indispensables', false); return; }
    Object.assign(lg.acces.personne, {
      nom, telephone: tel,
      role: $('acc-p-role').value.trim(),
      email: $('acc-p-email').value.trim(),
      langues: $('acc-p-langues').value.split(',').map(s => s.trim()).filter(Boolean),
      disponibilites: $('acc-p-dispo').value.trim(),
      lieuRdv: $('acc-p-rdv').value.trim(),
      notes: $('acc-p-notes').value.trim(),
    });
    UI.closeAll(); renderAcces(); UI.toast('Personne en charge enregistrée');
  });

  /* Appairage Seam — le device, pas encore le code. */
  function openSeamModal(lg) {
    const s = lg.acces.serrure;
    $('acc-s-marque').value = s.marque || 'Nuki';
    $('acc-s-modele').value = s.modele || '';
    $('acc-s-device').value = s.deviceId || '';
    $('acc-seam-modal-title').textContent = s.connectee ? 'Modifier la serrure appairée' : 'Appairer une serrure';
    $('acc-s-save').textContent = s.connectee ? 'Enregistrer' : 'Appairer';
    UI.openPanel('acc-seam-modal');
  }
  $('acc-s-save').addEventListener('click', () => {
    const lg = getLogement(currentLgId);
    const device = $('acc-s-device').value.trim();
    if (!device) { UI.toast('Renseignez l\'identifiant du device Seam', false); return; }
    const nouveau = !lg.acces.serrure.connectee;
    Object.assign(lg.acces.serrure, {
      connectee: true, deviceId: device,
      marque: $('acc-s-marque').value,
      modele: $('acc-s-modele').value.trim(),
    });
    // Un device fraîchement appairé remonte son état, mais n'a aucun code :
    // c'est une action distincte, et l'écran doit le dire.
    if (nouveau) Object.assign(lg.acces.serrure, { enLigne: true, verrouillee: true, batterie: 100, code: null, derniereSynchro: AUJOURDHUI });
    UI.closeAll(); renderAcces();
    UI.toast(nouveau ? 'Serrure appairée — aucun code actif pour l\'instant' : 'Serrure mise à jour');
  });

  /* Génération d'un code — permanent, ou borné à une fenêtre de séjour. */
  function openGenModal(lg) {
    const s = lg.acces.serrure;
    $('acc-gen-modal-title').textContent = s.code ? 'Régénérer le code' : 'Générer un code';
    $('acc-g-remplace').classList.toggle('hidden', !s.code);
    // Pré-remplir sur la prochaine arrivée : c'est le cas d'usage réel, et
    // ça évite de créer par défaut un code permanent qu'on oubliera.
    const prochaine = getReservationsByLogement(lg.id)
      .filter(r => r.canal !== 'bloque' && r.statut !== 'annule' && r.depart >= AUJOURDHUI)
      .sort((a, b) => a.arrivee.localeCompare(b.arrivee))[0];
    const dep = lg.sejour.arrivee, fin = lg.sejour.depart;
    $('acc-g-debut').value = prochaine ? `${prochaine.arrivee}T${dep}` : `${AUJOURDHUI}T${dep}`;
    $('acc-g-fin').value   = prochaine ? `${prochaine.depart}T${fin}`  : `${AUJOURDHUI}T${fin}`;
    $('acc-g-contexte').textContent = prochaine
      // formatDate abrège le mois avec un point final : ne pas en rajouter un.
      ? `Calé sur la prochaine réservation : ${prochaine.voyageur}, du ${formatDate(prochaine.arrivee)} au ${formatDate(prochaine.depart)}`
      : 'Aucune réservation à venir sur ce logement : les dates sont à définir.';
    document.querySelector('input[name="acc-g-portee"][value="' + (prochaine ? 'fenetre' : 'permanent') + '"]').checked = true;
    majPorteeGen();
    UI.openPanel('acc-gen-modal');
  }
  function majPorteeGen() {
    const fenetre = document.querySelector('input[name="acc-g-portee"]:checked').value === 'fenetre';
    $('acc-g-dates').classList.toggle('hidden', !fenetre);
  }
  document.querySelectorAll('input[name="acc-g-portee"]').forEach(r => r.addEventListener('change', majPorteeGen));

  $('acc-g-save').addEventListener('click', () => {
    const lg = getLogement(currentLgId);
    const fenetre = document.querySelector('input[name="acc-g-portee"]:checked').value === 'fenetre';
    let bornes = null;
    if (fenetre) {
      const d = $('acc-g-debut').value, f = $('acc-g-fin').value;
      if (!d || !f)  { UI.toast('Renseignez le début et la fin de validité', false); return; }
      if (f <= d)    { UI.toast('La fin de validité doit suivre le début', false); return; }
      bornes = { debut: d.replace('T', ' '), fin: f.replace('T', ' ') };
    }
    UI.closeAll();
    const pane = content.querySelector('[data-pane="acces"]');
    UI.toast('Envoi du code à la serrure…');
    actionSeam(pane, Seam.creerCode(lg, bornes), c => UI.toast(`Code ${c.valeur} confirmé par la serrure`));
  });

  /* ---------- Rendu du tableau des tâches récurrentes ---------- */
  function renderRec() {
    const tb = document.getElementById('rec-tbody'); if (!tb) return;
    const rows = getRecurrentesByLogement(currentLgId);
    if (!rows.length) {
      tb.innerHTML = `<tr><td colspan="7"><div class="empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
        <h4>Aucune tâche récurrente</h4><p>Automatisez le ménage, l'accueil ou la maintenance de ce logement.</p></div></td></tr>`;
      return;
    }
    tb.innerHTML = rows.map(r => {
      const ty = REC_TYPES[r.type] || REC_TYPES.menage;
      const p = getPrestataire(r.prestataireId);
      return `<tr data-rec="${r.id}">
        <td><div class="rec-task"><span class="rec-ic rec-ic--${r.type}">${icon(ty.icon)}</span>
          <div class="rec-task__meta"><b>${r.nom}</b><small>${r.description || ''}</small></div></div></td>
        <td class="text-soft">${triggerLabel(r)}</td>
        <td>${p ? `<div class="row gap-2"><span class="avatar avatar--sm">${initiales(p.nom)}</span>${p.nom}</div>` : '—'}</td>
        <td class="text-soft">${r.dateDebut ? formatDate(r.dateDebut, { annee: true }) : '—'}</td>
        <td class="text-soft">${r.dateFin ? formatDate(r.dateFin, { annee: true }) : '<span class="text-muted">—</span>'}</td>
        <td><span class="badge ${r.actif ? 'badge--positive' : 'badge--neutral'}">${r.actif ? 'Active' : 'Désactivée'}</span></td>
        <td><div class="rec-actions">
          <button class="icon-btn" data-rec-edit="${r.id}" aria-label="Modifier">${icon(ICO_EDIT)}</button>
          <button class="icon-btn icon-btn--danger" data-rec-del="${r.id}" aria-label="Supprimer">${icon(ICO_DEL)}</button>
        </div></td>
      </tr>`;
    }).join('');
  }

  /* ---------- Modale de création / édition ---------- */
  const recTrigger = document.getElementById('rec-f-trigger');
  const recNofin = document.getElementById('rec-f-nofin');
  const recActive = document.getElementById('rec-f-active');

  function buildTypePicker() {
    document.getElementById('rec-f-typepicker').innerHTML = Object.entries(REC_TYPES).map(([k, v]) =>
      `<button type="button" class="rec-typechip ${k === recType ? 'is-active' : ''}" data-type="${k}">${icon(v.icon)} ${v.label}</button>`).join('');
  }
  function updateDelai() {
    const m = REC_TRIGGERS[recTrigger.value];
    document.getElementById('rec-f-delai-wrap').classList.toggle('hidden', !m.unit);
    if (m.unit) document.getElementById('rec-f-delai-unit').textContent = m.unit;
  }

  function openRecModal(recId) {
    recEditId = recId || null;
    const r = recId ? RECURRENTES.find(x => x.id === recId) : null;
    recType = r ? r.type : 'menage';
    buildTypePicker();
    document.getElementById('rec-f-nom').value = r ? r.nom : '';
    document.getElementById('rec-f-desc').value = r ? (r.description || '') : '';
    recTrigger.value = r ? r.declencheur : 'checkout';
    document.getElementById('rec-f-delai').value = r && r.delai ? r.delai : 2;
    updateDelai();
    document.getElementById('rec-f-prest').innerHTML = PRESTATAIRES.map(p => `<option value="${p.id}">${p.nom} · ${p.role}</option>`).join('');
    document.getElementById('rec-f-prest').value = r ? r.prestataireId : PRESTATAIRES[0].id;
    document.getElementById('rec-f-start').value = r ? r.dateDebut : '2026-01-01';
    const nofin = r ? !r.dateFin : false;
    recNofin.checked = nofin;
    document.getElementById('rec-f-end').value = r && r.dateFin ? r.dateFin : '2026-12-31';
    document.getElementById('rec-f-end').disabled = nofin;
    // Une récurrence n'a pas de notion d'occupation : la seule règle est
    // qu'elle ne peut pas se terminer avant d'avoir commencé.
    // Période d'activité de la récurrence : aucune notion d'occupation,
    // seulement l'ordre des deux bornes — que le mode plage garantit.
    DatePicker.range(
      document.getElementById('rec-f-start'),
      document.getElementById('rec-f-end'),
      () => ({ labels: { debut: 'la date de début', fin: 'la date de fin' }, uniteDuree: 'jours' })
    );
    recActive.checked = r ? r.actif : true;
    document.getElementById('rec-f-active-label').textContent = recActive.checked ? 'Active' : 'Désactivée';
    document.getElementById('rec-modal-title').textContent = recId ? 'Modifier la tâche récurrente' : 'Nouvelle tâche récurrente';
    document.getElementById('rec-save').textContent = recId ? 'Enregistrer' : 'Créer la tâche';
    UI.openPanel('rec-modal');
  }

  document.getElementById('rec-f-typepicker').addEventListener('click', e => {
    const c = e.target.closest('[data-type]'); if (!c) return;
    recType = c.dataset.type;
    document.querySelectorAll('#rec-f-typepicker .rec-typechip').forEach(x => x.classList.toggle('is-active', x.dataset.type === recType));
  });
  recTrigger.addEventListener('change', updateDelai);
  recNofin.addEventListener('change', () => { document.getElementById('rec-f-end').disabled = recNofin.checked; });
  recActive.addEventListener('change', () => { document.getElementById('rec-f-active-label').textContent = recActive.checked ? 'Active' : 'Désactivée'; });

  document.getElementById('rec-save').addEventListener('click', () => {
    const nom = document.getElementById('rec-f-nom').value.trim();
    if (!nom) { UI.toast('Renseignez le nom de la tâche', false); return; }
    const trigger = recTrigger.value;
    const needsDelai = !!REC_TRIGGERS[trigger].unit;
    const data = {
      logementId: currentLgId, nom, type: recType,
      description: document.getElementById('rec-f-desc').value.trim(),
      declencheur: trigger, delai: needsDelai ? (parseInt(document.getElementById('rec-f-delai').value, 10) || 1) : null,
      prestataireId: document.getElementById('rec-f-prest').value,
      dateDebut: document.getElementById('rec-f-start').value || null,
      dateFin: recNofin.checked ? null : (document.getElementById('rec-f-end').value || null),
      actif: recActive.checked,
    };
    if (recEditId) Object.assign(RECURRENTES.find(x => x.id === recEditId), data);
    else RECURRENTES.push({ id: 'RC' + Date.now(), ...data });
    UI.closeAll(); renderRec(); UI.toast(recEditId ? 'Tâche modifiée' : 'Tâche récurrente créée');
  });
})();
