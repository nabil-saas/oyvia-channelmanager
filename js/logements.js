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
            <div class="lg-card__price"><b>${formatEuro(l.tarifBase)}</b> <span>/ nuit</span></div>
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
    document.getElementById('lg-f-tarif').value = l ? l.tarifBase : 80;
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
    const tarif = parseInt(document.getElementById('lg-f-tarif').value, 10) || 80;
    const type = document.getElementById('lg-f-type').value;
    const typeChambre = document.getElementById('lg-f-typechambre').value;
    const surface = parseInt(document.getElementById('lg-f-surface').value, 10) || null;

    if (editLogementId) {
      Object.assign(getLogement(editLogementId), { nom, ville, type, typeChambre, surface, capacite: cap, tarifBase: tarif, menageTarif: Math.round(tarif * 0.4) });
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
          ${row("Chiffre d'affaires", `<span class="fw-semibold">${formatEuro(ca)}</span>`)}
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
        ? `${formatEuro(t.taxeSejour.montant, 2)} par séjour`
        : `${formatEuro(t.taxeSejour.montant, 2)} par personne et par nuit`;

    return `
      <div class="app-grid app-grid--2">
        <div class="card card--pad">
          <p class="eyebrow mb-4">Prix</p>
          ${row('Tarif de base', `<span class="fw-semibold">${formatEuro(l.tarifBase)} / nuit</span>`)}
          ${row('Tarif week-end', t.weekend ? `${formatEuro(t.weekend)} / nuit` : 'Identique à la semaine')}
          ${row('Voyageurs inclus', t.personnesIncluses)}
          ${row('Personne supplémentaire', t.personneSup ? `${formatEuro(t.personneSup)} / nuit` : 'Sans supplément')}
          ${row('Tarification dynamique', t.dynamique.actif
            ? `<span class="badge badge--positive">${t.dynamique.source}</span>`
            : '<span class="badge badge--neutral">Désactivée</span>')}
          ${row('Bornes du tarif', t.min && t.max ? `${formatEuro(t.min)} — ${formatEuro(t.max)}` : vide)}
        </div>

        <div class="card card--pad">
          <p class="eyebrow mb-4">Frais &amp; taxes</p>
          ${row('Forfait ménage', `${formatEuro(l.menageTarif)} <span class="text-muted text-xs">par ${t.fraisMenagePar === 'nuit' ? 'nuit' : 'séjour'}</span>`)}
          ${row('Caution', t.caution ? formatEuro(t.caution) : 'Aucune')}
          ${row('Frais animal', t.fraisAnimal ? `${formatEuro(t.fraisAnimal)} par séjour` : (l.regles.animaux ? 'Gratuit' : 'Animaux non acceptés'))}
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
          ${row(`${ex.nuits} nuits × ${formatEuro(l.tarifBase)}`, formatEuro(ex.nuitees))}
          ${ex.remise ? row('Remise séjour à la semaine', `<span class="text-positive">− ${formatEuro(ex.remise)}</span>`) : ''}
          ${row('Forfait ménage', formatEuro(ex.menage))}
          ${row('Taxe de séjour', formatEuro(ex.taxe))}
          <div class="rp-row" style="border-top:1px solid var(--c-border);margin-top:var(--sp-2);padding-top:var(--sp-3)">
            <span class="fw-semibold">Total voyageur</span><span class="fw-semibold">${formatEuro(ex.total)}</span>
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

  function paneAcces(l) {
    const a = l.acces;
    return `
      <div class="app-grid app-grid--2">
        <div class="card card--pad">
          <p class="eyebrow mb-4">Accès autonome</p>
          ${row("Mode d'accès", labelTypeAcces(a.type))}
          ${row('Emplacement des clés', a.emplacementCles || vide)}
          ${row('Étage', a.etage === 0 ? 'Rez-de-chaussée' : `${a.etage}ᵉ étage`)}
          ${row('Ascenseur', oui(a.ascenseur))}
          <div class="msg-ctx__code mt-4"><span class="text-sm text-soft">Code d'accès</span><b>${l.codeAcces}</b></div>
          <div class="msg-ctx__code"><span class="text-sm text-soft">Réseau Wi-Fi</span><b>${l.wifi.ssid}</b></div>
          <div class="msg-ctx__code"><span class="text-sm text-soft">Mot de passe Wi-Fi</span><b>${l.wifi.pass}</b></div>
          <p class="text-xs text-muted" style="margin-top:var(--sp-3)">Insérés automatiquement dans les messages via les variables {code_acces} et {wifi}.</p>
        </div>

        <div class="card card--pad">
          <p class="eyebrow mb-4">Sur place</p>
          ${row('Stationnement', a.parking || vide)}
          ${row('Contact urgence', a.contactUrgence || vide)}
          <div class="lg-desc mt-4"><p class="lg-desc__label">Instructions d'arrivée</p><p>${a.instructions || vide}</p></div>
        </div>
      </div>`;
  }

  function paneCanaux(l) {
    const connectes = canauxConnectes(l);
    const absents = Object.keys(CH).filter(k => !l.canaux[k] || !l.canaux[k].connecte);

    return `
      ${connectes.map(([k, c]) => {
        const meta = CH[k];
        const note = c.note ? `${c.note} / ${meta.echelle} · ${c.avis} avis` : 'Pas encore noté';
        return `
        <div class="lg-canal">
          <div class="lg-canal__head">
            <div class="lg-channelrow__ic" style="background:${meta.col}">${meta.letter}</div>
            <div class="grow">
              <b>${meta.label}</b>
              <small class="text-muted">${c.listingId} · synchronisé le ${c.derniereSynchro}</small>
            </div>
            <span class="badge ${c.statut === 'ok' ? 'badge--positive' : 'badge--warning'}">${c.statut === 'ok' ? 'Connecté' : 'À vérifier'}</span>
            <label class="switch"><input type="checkbox" checked><span class="switch__track"></span></label>
          </div>
          <div class="lg-canal__grid">
            <div><small>Identifiant annonce</small><span class="font-mono">${c.listingId}</span></div>
            <div><small>Note sur ce canal</small><span>${note}</span></div>
            <div><small>Commission</small><span>${c.commission} %</span></div>
            <div><small>Annonce</small><span>${c.url ? `<a href="${c.url}" target="_blank" rel="noopener">Ouvrir ↗</a>` : vide}</span></div>
          </div>
          ${c.message ? `<p class="lg-canal__alerte">⚠ ${c.message}</p>` : ''}
        </div>`;
      }).join('')}

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

      <div class="card card--pad mt-4">
        <p class="eyebrow mb-4">Synchronisation iCal</p>
        ${row('Flux exporté', l.ical.exporte ? `<span class="font-mono text-xs">${l.ical.exporte}</span>` : vide)}
        ${row('Flux importés', l.ical.importe.length ? l.ical.importe.map(u => `<span class="font-mono text-xs">${u}</span>`).join('<br>') : 'Aucun')}
        <p class="text-xs text-muted" style="margin-top:var(--sp-3)">L'iCal sert de secours pour les plateformes sans connexion directe : il ne transporte que les dates, jamais les tarifs ni les voyageurs.</p>
      </div>`;
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

  function showDetail(id) {
    const l = getLogement(id);
    const resas = getReservationsByLogement(id).filter(r => r.canal !== 'bloque');
    const ca = resas.reduce((s, r) => s + r.montant, 0);
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
        <button class="is-active" data-tab="annonce">Annonce</button>
        <button data-tab="logement">Le logement</button>
        <button data-tab="tarifs">Tarifs &amp; frais</button>
        <button data-tab="sejour">Séjour &amp; règles</button>
        <button data-tab="acces">Accès</button>
        <button data-tab="canaux">Canaux</button>
        <button data-tab="photos">Photos</button>
        <button data-tab="recurrentes">Tâches récurrentes</button>
      </div>

      <div class="lg-tabpane is-active" data-pane="annonce">${paneAnnonce(l)}</div>
      <div class="lg-tabpane" data-pane="logement">${paneLogement(l, resas, ca)}</div>
      <div class="lg-tabpane" data-pane="tarifs">${paneTarifs(l)}</div>
      <div class="lg-tabpane" data-pane="sejour">${paneSejour(l)}</div>
      <div class="lg-tabpane" data-pane="acces">${paneAcces(l)}</div>
      <div class="lg-tabpane" data-pane="canaux">${paneCanaux(l)}</div>
      <div class="lg-tabpane" data-pane="photos">${panePhotos(l)}</div>

      <div class="lg-tabpane" data-pane="recurrentes">
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

    content.querySelector('#lg-tabs').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      content.querySelectorAll('#lg-tabs button').forEach(x => x.classList.remove('is-active'));
      b.classList.add('is-active');
      content.querySelectorAll('.lg-tabpane').forEach(p => p.classList.toggle('is-active', p.dataset.pane === b.dataset.tab));
    });
    content.querySelector('#lg-edit-btn').addEventListener('click', () => openLogementModal(id));

    currentLgId = id;
    renderRec();
    content.querySelector('#rec-add').addEventListener('click', () => openRecModal(null));
    content.querySelector('#rec-tbody').addEventListener('click', e => {
      const ed = e.target.closest('[data-rec-edit]'); const del = e.target.closest('[data-rec-del]');
      if (ed) openRecModal(ed.dataset.recEdit);
      else if (del) { const i = RECURRENTES.findIndex(x => x.id === del.dataset.recDel); if (i > -1) RECURRENTES.splice(i, 1); renderRec(); UI.toast('Tâche supprimée'); }
    });

    list.classList.add('hidden'); detail.classList.remove('hidden');
    window.scrollTo(0, 0);
  }

  function backToList() { detail.classList.add('hidden'); list.classList.remove('hidden'); }
  document.getElementById('lg-back').addEventListener('click', backToList);

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
