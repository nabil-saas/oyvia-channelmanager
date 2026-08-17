/* ============================================================
   OYVIA — Tarification dynamique (Intégrations)

   La page n'a de raison d'être que si le compte PriceLabs est relié :
   sans passerelle, aucun prix ne part, et afficher un calendrier de
   recommandations donnerait à croire le contraire. Tant que la
   connexion manque, on montre donc l'écran d'accroche et RIEN d'autre.

   Une fois connectée, la page tient en quatre onglets :
   · Calendrier   — le prix poussé pour chaque nuit, logement par logement
   · Logements    — le pilotage et les garde-fous, bien par bien
   · Règles       — les leviers qui produisent ces prix
   · Synchronisation — ce qui est réellement parti vers les canaux
   ============================================================ */
Layout.init('tarification');

(function () {
  const elActions = document.getElementById('td-actions');
  const elGate    = document.getElementById('td-gate');
  const elCorps   = document.getElementById('td-corps');
  const elKpis    = document.getElementById('td-kpis');
  const elTabs    = document.getElementById('td-tabs');

  const JOURS_MINI = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
  /* Nombre de colonnes du calendrier. Il ne peut pas être fixe : « 180 € »
     tient dans une case étroite, « 208 696 F CFA » non — en dirhams et en
     francs CFA les montants débordaient et se chevauchaient d'une case à
     l'autre. On dimensionne donc sur le montant le plus long réellement
     affiché, ce qui suit à la fois la devise et le niveau de prix du parc. */
  function nbJours() {
    const liste = logementsAffiches();
    if (!liste.length) return 21;
    const plusLong = liste.reduce((n, l) => {
      const b = tdBornes(l);
      return Math.max(n, formatMontantNu(b.max).length, formatMontantNu(b.base).length);
    }, 0);
    if (plusLong <= 4) return 21;   // « 180 »
    if (plusLong <= 6) return 14;   // « 1 957 »
    return 10;                      // « 208 696 »
  }
  let debut = AUJOURDHUI;           // première colonne
  let filtreLogement = 'all';
  let nuitOuverte = null;           // { logementId, date }

  const ic = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  const pct = n => `${n > 0 ? '+' : ''}${n} %`;

  function logementsAffiches() {
    const pilotes = tdLogementsPilotes();
    return filtreLogement === 'all' ? pilotes : pilotes.filter(l => l.id === filtreLogement);
  }

  /* ============================================================
     En-tête : actions disponibles selon l'état de la connexion
     ============================================================ */
  function renderActions() {
    if (!tdMoteurChoisi()) { elActions.innerHTML = ''; return; }
    elActions.innerHTML = `
      <select class="select app-logement-select" id="td-logement" aria-label="Filtrer par logement">
        <option value="all">Tous les logements</option>
        ${tdLogementsPilotes().map(l => `<option value="${l.id}" ${l.id === filtreLogement ? 'selected' : ''}>${l.nom}</option>`).join('')}
      </select>
      <button class="btn btn--secondary" id="td-sync">
        ${ic('<path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/>')}
        Synchroniser maintenant
      </button>
      <span class="td-moteur-actif" title="Moteur de tarification en service">
        <i class="td-moteur-actif__pastille"${tdMoteurInterne() ? '' : ' data-externe'}>${tdMoteur().lettre}</i>
        <span><small>Moteur actif</small><b>${tdMoteur().nom}</b></span>
      </span>
      <button class="btn btn--danger" id="td-moteur-btn" title="Déconnecter ${tdMoteur().nom} et choisir un autre moteur">
        ${ic('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>')}
        Déconnecter
      </button>`;

    document.getElementById('td-logement').addEventListener('change', e => {
      filtreLogement = e.target.value;
      render();
    });
    document.getElementById('td-sync').addEventListener('click', () => {
      const e = tdSynchroniser();
      saveOyviaState();
      render();
      UI.toast(e.statut === 'ok' ? `${e.logements} logements synchronisés` : e.message, e.statut === 'ok');
    });
    document.getElementById('td-moteur-btn').addEventListener('click', deconnecterMoteur);
  }

  /* Déconnecter le moteur en cours, à tout moment et quel qu'il soit — ce qui
     ramène à l'écran de choix.
     Ce qui est conservé diffère selon le cas, et il faut le dire : quitter
     Oyvia laisse ses règles intactes (on les retrouve en revenant), quitter
     une plateforme externe coupe une connexion qu'il faudra rétablir. Dans les
     deux cas, garde-fous et prix fixés à la main ne bougent pas — ils
     appartiennent au logement, pas au moteur. */
  function deconnecterMoteur() {
    const m = tdMoteur();
    if (!m) return;
    UI.confirm({
      title: `Déconnecter ${m.nom} ?`,
      message: m.externe
        ? `${m.nom} cessera de pousser des prix vers vos canaux. Vos garde-fous (plancher, plafond) et vos prix fixés à la main sont conservés, ainsi que vos réglages de la tarification Oyvia.\n\nVous pourrez reconnecter cette plateforme ou en choisir une autre à tout moment.`
        : `Plus aucun prix ne partira vers vos canaux tant qu'aucun moteur n'est choisi.\n\nVos cinq règles, vos garde-fous et vos prix fixés à la main sont conservés : vous les retrouverez intacts en réactivant la tarification Oyvia.`,
      confirmText: 'Déconnecter',
      cancelText: 'Annuler',
      danger: true,
      onConfirm: () => {
        tdDeconnecterMoteur();
        saveOyviaState();
        render();
        UI.toast(`${m.nom} déconnecté — choisissez votre moteur`);
      },
    });
  }

  /* ============================================================
     Écran d'accroche — passerelle non connectée
     ============================================================ */
  function renderGate() {
    const b = LOGEMENTS[0] ? tdBornes(LOGEMENTS[0]) : { base: 0, min: 0, max: 0 };
    const interne = MOTEURS_TARIFICATION.filter(m => !m.externe);
    const externes = MOTEURS_TARIFICATION.filter(m => m.externe);

    elGate.innerHTML = `
      <div class="td-choix">
        <div class="td-choix__intro">
          <h2>Comment voulez-vous fixer vos prix ?</h2>
          <p class="text-soft">
            Oyvia sait calculer lui-même le prix de chaque nuit, ou se brancher sur la plateforme
            de tarification que vous utilisez déjà. Dans les deux cas, vos garde-fous s'appliquent
            en dernier — jamais sous votre plancher, jamais au-dessus de votre plafond — et un prix
            que vous fixez à la main l'emporte sur tout.
          </p>
        </div>

        ${interne.map(m => `
          <div class="td-moteur td-moteur--interne">
            <div class="td-moteur__head">
              <span class="td-moteur__logo">${m.lettre}</span>
              <div class="grow">
                <b>${m.nom}</b>
                <small>${m.accroche}</small>
              </div>
              <span class="badge badge--accent">Inclus dans votre offre</span>
            </div>
            <p class="text-sm text-soft">${m.desc}</p>
            <ul class="td-moteur__points">
              <li>${ic('<path d="M3 16.5 8 10l4 3.5L21 4"/><path d="M16 4h5v5"/>')}
                <div><b>Cinq règles que vous réglez</b>
                <span>Occupation du parc, saison, jour de la semaine, durée du séjour, délai de réservation.</span></div></li>
              <li>${ic('<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>')}
                <div><b>Vos garde-fous d'abord</b>
                <span>Exemple sur « ${LOGEMENTS[0] ? LOGEMENTS[0].nom : '—'} » : base ${formatMontant(b.base)}, plancher ${formatMontant(b.min)}, plafond ${formatMontant(b.max)}.</span></div></li>
              <li>${ic('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>')}
                <div><b>Calculé sur vos données</b>
                <span>Vos réservations, votre parc. Aucune donnée de marché n'est inventée.</span></div></li>
            </ul>
            <button class="btn btn--primary btn--lg" data-moteur="${m.id}">Utiliser la tarification Oyvia</button>
          </div>`).join('')}

        <div class="td-choix__externes">
          <p class="eyebrow mb-3">Ou connecter votre plateforme</p>
          ${externes.map(m => `
            <div class="td-moteur td-moteur--externe">
              <span class="td-moteur__logo td-moteur__logo--sm">${m.lettre}</span>
              <div class="grow">
                <b>${m.nom}</b>
                <small>${m.accroche}</small>
              </div>
              <button class="btn btn--secondary btn--sm" data-moteur="${m.id}">Connecter</button>
            </div>`).join('')}
          <p class="text-xs text-muted mt-3">
            Avec une plateforme externe, vos règles restent configurées chez elle : Oyvia lui transmet
            vos réservations, applique vos garde-fous et pousse les prix vers vos canaux.
          </p>
        </div>
      </div>`;

    elGate.querySelectorAll('[data-moteur]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.moteur;
        tdChoisirMoteur(id);
        tdSynchroniser();
        saveOyviaState();
        render();
        const m = getMoteurTarification(id);
        UI.toast(m.externe ? `${m.nom} connecté — premiers prix reçus` : 'Tarification Oyvia activée — premiers prix calculés');
      });
    });
  }

  /* ============================================================
     Compteurs d'en-tête
     ============================================================ */
  function renderKpis() {
    const ids = logementsAffiches().map(l => l.id);
    const s = tdSynthese(ids, 30);
    const pilotes = tdLogementsPilotes().length;
    const total = LOGEMENTS.length;
    const j = TD_JOURNAL[0];

    const kpi = (label, valeur, pied, icone) => `
      <div class="kpi">
        <div class="kpi__label">${label}</div>
        <div class="kpi__value">${valeur}</div>
        <div class="kpi__foot">${pied}</div>
        <div class="kpi__icon">${ic(icone)}</div>
      </div>`;

    const signe = s.ecartPct > 0 ? 'trend--up' : (s.ecartPct < 0 ? 'trend--down' : '');
    elKpis.innerHTML = [
      kpi('Logements pilotés', `${pilotes}<span class="kpi__sur">/${total}</span>`,
        pilotes === total ? 'Tout le parc est piloté' : `${total - pilotes} encore au prix fixe`,
        '<path d="M3 9.5 12 3l9 6.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>'),
      kpi('Prix moyen recommandé', formatMontant(s.prixMoyen),
        `sur ${s.nuits} nuits encore à vendre (30 j)`,
        '<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>'),
      kpi('Écart au prix de base', `<span class="${signe}">${pct(s.ecartPct)}</span>`,
        `base moyenne ${formatMontant(s.baseMoyenne)}`,
        '<path d="M3 16.5 8 10l4 3.5L21 4"/><path d="M16 4h5v5"/>'),
      kpi('Dernière synchronisation', tdDepuis(TARIF_DYNAMIQUE.derniereSync),
        j ? `${TD_STATUT_JOURNAL[j.statut]} — ${j.logements} logements` : '—',
        '<path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/>'),
    ].join('');
  }

  /* ============================================================
     Onglet Calendrier — une ligne par logement, une colonne par nuit

     Le tableau croisé plutôt qu'un calendrier mensuel par logement :
     l'intérêt d'un moteur de prix est justement de comparer d'un coup
     d'œil ce que valent les mêmes dates sur des biens différents.
     ============================================================ */
  function celluleHTML(l, date) {
    const r = prixRecommande(l.id, date);
    const classes = ['td-cell'];
    let sup = '';
    if (r.reservation) {
      classes.push('td-cell--vendu');
      sup = `<span class="td-cell__tag">${r.reservation.canal === 'bloque' ? 'Bloqué' : 'Vendu'}</span>`;
    } else {
      if (r.override) { classes.push('td-cell--fixe'); sup = '<span class="td-cell__tag">Fixé</span>'; }
      else if (r.borne === 'min') { classes.push('td-cell--plancher'); sup = '<span class="td-cell__tag">Plancher</span>'; }
      else if (r.borne === 'max') { classes.push('td-cell--plafond'); sup = '<span class="td-cell__tag">Plafond</span>'; }
      else if (r.prix > r.base) classes.push('td-cell--haut');
      else if (r.prix < r.base) classes.push('td-cell--bas');
    }
    // Sans symbole : il est rappelé une seule fois dans l'en-tête du tableau.
    const montant = r.reservation && r.reservation.canal === 'bloque' ? '—' : formatMontantNu(r.prix);
    return `<button type="button" class="${classes.join(' ')}" data-nuit="${l.id}|${date}"
      aria-label="${l.nom}, ${formatDate(date, { annee: true })}, ${r.reservation && r.reservation.canal === 'bloque' ? 'bloqué' : formatMontant(r.prix)}">
      <span class="td-cell__prix">${montant}</span>${sup}</button>`;
  }

  function renderCalendrier() {
    const pane = document.getElementById('td-pane-calendrier');
    const liste = logementsAffiches();

    if (!liste.length) {
      pane.innerHTML = `<div class="card"><div class="empty">
        ${ic('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>')}
        <h4>Aucun logement piloté</h4>
        <p>Activez la tarification dynamique sur au moins un logement depuis l'onglet « Logements ».</p>
      </div></div>`;
      return;
    }

    const cols = nbJours();
    const dates = Array.from({ length: cols }, (_, i) => addDays(debut, i));
    const entetes = dates.map(d => {
      const dd = parseDate(d);
      const we = dd.getDay() === 0 || dd.getDay() === 6;
      return `<div class="td-col ${we ? 'is-we' : ''} ${d === AUJOURDHUI ? 'is-today' : ''}">
        <span class="td-col__j">${JOURS_MINI[dd.getDay()]}</span>
        <span class="td-col__d">${dd.getDate()}</span></div>`;
    }).join('');

    const lignes = liste.map(l => {
      const b = tdBornes(l);
      const erreur = tdBornesInvalides(l);
      return `<div class="td-row">
        <div class="td-row__nom">
          <span class="td-row__pastille" style="background:${l.couleur}"></span>
          <div class="grow">
            <b>${l.nom}</b>
            <span>${erreur
              ? `<span class="text-danger">${erreur}</span>`
              : `Base ${formatMontantNu(b.base)} · ${formatMontantNu(b.min)}–${formatMontantNu(b.max)}`}</span>
          </div>
        </div>
        <div class="td-row__cells">${dates.map(d => celluleHTML(l, d)).join('')}</div>
      </div>`;
    }).join('');

    const finDate = addDays(debut, cols - 1);
    pane.innerHTML = `
      <div class="card td-cal">
        <div class="card__head">
          <div>
            <div class="card__title">${formatPlage(debut, finDate)}</div>
            <p class="text-sm text-soft">Le prix affiché est celui qui part vers vos canaux pour cette nuit-là. Montants en <b>${getDevise(deviseAffichee()).label}</b>.</p>
          </div>
          <div class="row gap-2">
            <button class="icon-btn" id="td-prev" aria-label="Période précédente">${ic('<path d="m15 18-6-6 6-6"/>')}</button>
            <button class="btn btn--secondary btn--sm" id="td-auj">Aujourd'hui</button>
            <button class="icon-btn" id="td-next" aria-label="Période suivante">${ic('<path d="m9 18 6-6-6-6"/>')}</button>
          </div>
        </div>
        <div class="td-scroll">
          <div class="td-grid" style="--td-cols:${cols}">
            <div class="td-row td-row--head">
              <div class="td-row__nom"></div>
              <div class="td-row__cells">${entetes}</div>
            </div>
            ${lignes}
          </div>
        </div>
        <div class="td-legende">
          <span><i class="td-dot td-dot--haut"></i>Au-dessus de la base</span>
          <span><i class="td-dot td-dot--bas"></i>En dessous</span>
          <span><i class="td-dot td-dot--plancher"></i>Bloqué au plancher</span>
          <span><i class="td-dot td-dot--plafond"></i>Bloqué au plafond</span>
          <span><i class="td-dot td-dot--fixe"></i>Prix fixé à la main</span>
          <span><i class="td-dot td-dot--vendu"></i>Déjà vendu</span>
        </div>
      </div>`;

    document.getElementById('td-prev').addEventListener('click', () => { debut = addDays(debut, -cols); renderCalendrier(); });
    document.getElementById('td-next').addEventListener('click', () => { debut = addDays(debut, cols); renderCalendrier(); });
    document.getElementById('td-auj').addEventListener('click', () => { debut = AUJOURDHUI; renderCalendrier(); });
    pane.querySelectorAll('[data-nuit]').forEach(btn => {
      btn.addEventListener('click', () => {
        const [id, date] = btn.dataset.nuit.split('|');
        ouvrirNuit(id, date);
      });
    });
  }

  /* ============================================================
     Panneau : d'où vient ce prix, et comment le reprendre en main
     ============================================================ */
  function ouvrirNuit(logementId, date) {
    nuitOuverte = { logementId, date };
    const l = getLogement(logementId);
    const r = prixRecommande(logementId, date);
    document.getElementById('td-panel-title').textContent = formatDate(date, { jourSemaine: true, moisLong: true, annee: true });
    document.getElementById('td-panel-sub').textContent = l.nom;

    let corps = '';

    if (r.reservation) {
      const res = r.reservation;
      corps += `<div class="td-note td-note--info">
        ${res.canal === 'bloque' ? 'Cette nuit est bloquée' : `Cette nuit est déjà vendue à ${res.voyageur}`}
        ${res.canal === 'bloque' ? '' : ` (${formatPlage(res.arrivee, res.depart)}).`}
        Le moteur ne pousse plus de prix dessus.</div>`;
    }

    if (r.override) {
      corps += `<div class="td-note td-note--fixe">
        <b>Prix fixé à la main : ${formatMontant(r.override.prix)}</b>
        ${r.override.note ? `<span>${r.override.note}</span>` : ''}
        <span>Il l'emporte sur toutes les règles, y compris le plancher et le plafond.</span>
      </div>`;
    } else {
      const lignes = r.facteurs.map(f => `
        <li>
          <span class="td-fac__lab"><b>${f.label}</b><span>${f.detail}</span></span>
          <span class="td-fac__pct ${f.pct > 0 ? 'is-plus' : 'is-moins'}">${pct(f.pct)}</span>
        </li>`).join('');

      corps += `<div class="td-calc">
        <div class="td-calc__ligne"><span>Prix de base</span><b>${formatMontant(r.base)}</b></div>
        <ul class="td-fac">${lignes || '<li class="td-fac__vide">Aucune règle ne s\'applique à cette nuit.</li>'}</ul>
        <div class="td-calc__ligne td-calc__ligne--brut"><span>Prix calculé</span><b>${formatMontant(r.brut)}</b></div>
        ${r.borne ? `<div class="td-calc__borne">
          Ramené au ${r.borne === 'min' ? 'plancher' : 'plafond'} de ${formatMontant(r.borne === 'min' ? r.min : r.max)} :
          vos garde-fous s'appliquent en dernier et l'emportent sur les règles.
        </div>` : ''}
        <div class="td-calc__total"><span>Prix poussé</span><b>${formatMontant(r.prix)}</b></div>
      </div>`;
    }

    corps += `<div class="td-meta">
      <div><span>Plancher</span><b>${formatMontant(r.min)}</b></div>
      <div><span>Plafond</span><b>${formatMontant(r.max)}</b></div>
      ${r.occupationPct !== undefined ? `<div><span>Parc occupé</span><b>${r.occupationPct} %</b></div>` : ''}
    </div>`;

    corps += `<div class="field mt-5">
      <label class="field__label" for="td-fixe">Fixer le prix de cette nuit (${symboleDevise()})</label>
      <input class="input" type="number" min="0" step="1" id="td-fixe" value="${montantSaisie(r.override ? r.override.prix : r.prix)}" />
      <span class="field__hint">Laissez vide et validez pour revenir au prix calculé.</span>
    </div>
    <div class="field mt-3">
      <label class="field__label" for="td-fixe-note">Pourquoi ? (facultatif)</label>
      <input class="input" id="td-fixe-note" placeholder="Ex. festival, congrès, groupe attendu…"
        value="${r.override ? (r.override.note || '').replace(/"/g, '&quot;') : ''}" />
    </div>`;

    document.getElementById('td-panel-body').innerHTML = corps;
    document.getElementById('td-panel-foot').innerHTML = `
      <div class="row gap-2">
        ${r.override ? '<button class="btn btn--secondary grow" id="td-fixe-reset">Revenir au prix calculé</button>' : ''}
        <button class="btn btn--primary grow" id="td-fixe-ok">Enregistrer</button>
      </div>`;

    document.getElementById('td-fixe-ok').addEventListener('click', () => {
      const v = document.getElementById('td-fixe').value.trim();
      const note = document.getElementById('td-fixe-note').value.trim();
      if (v === '') { tdRetirerOverride(logementId, date); UI.toast('Prix calculé rétabli'); }
      else {
        // Saisi dans la devise d'affichage, stocké en euros.
        const n = Math.round(versReference(Number(v)));
        if (!isFinite(n) || n <= 0) { UI.toast('Montant invalide', false); return; }
        tdPoserOverride(logementId, date, n, note);
        UI.toast(`Nuit du ${formatDate(date)} fixée à ${formatMontant(n)}`);
      }
      saveOyviaState(); UI.closeAll(); render();
    });
    const reset = document.getElementById('td-fixe-reset');
    if (reset) reset.addEventListener('click', () => {
      tdRetirerOverride(logementId, date);
      saveOyviaState(); UI.closeAll(); render();
      UI.toast('Prix calculé rétabli');
    });

    UI.openPanel('td-panel');
  }

  /* ============================================================
     Onglet Logements — pilotage et garde-fous
     ============================================================ */
  function renderLogements() {
    const rows = LOGEMENTS.map(l => {
      const b = tdBornes(l);
      const actif = tdPilote(l);
      const erreur = tdBornesInvalides(l);
      const r = actif ? prixRecommande(l.id, AUJOURDHUI) : null;
      const s = actif ? tdSynthese([l.id], 30) : null;
      const ecart = s ? s.ecartPct : 0;
      return `<tr>
        <td>
          <div class="row gap-3">
            <span class="td-row__pastille" style="background:${l.couleur}"></span>
            <div><b>${l.nom}</b><div class="text-xs text-soft">${l.ville} · minimum ${l.sejour.nuitsMin} nuits</div></div>
          </div>
        </td>
        <td class="num money">${formatMontant(b.base)}</td>
        <td class="num money">${formatMontant(b.min)}</td>
        <td class="num money">${formatMontant(b.max)}</td>
        <td class="num money">${r ? (r.reservation ? '<span class="text-muted">vendu</span>' : formatMontant(r.prix)) : '<span class="text-muted">—</span>'}</td>
        <td class="num">${s ? `<span class="${ecart > 0 ? 'trend--up' : (ecart < 0 ? 'trend--down' : '')}">${pct(ecart)}</span>` : '<span class="text-muted">—</span>'}</td>
        <td>${erreur && actif ? `<span class="badge badge--danger">${erreur}</span>` : ''}</td>
        <td class="row gap-2" style="justify-content:flex-end">
          <button class="btn btn--secondary btn--sm" data-bornes="${l.id}">Bornes</button>
          <label class="switch" title="${actif ? 'Désactiver' : 'Activer'} le pilotage">
            <input type="checkbox" data-pilote="${l.id}" ${actif ? 'checked' : ''} />
            <span class="switch__track"></span>
          </label>
        </td>
      </tr>`;
    }).join('');

    document.getElementById('td-pane-logements').innerHTML = `
      <div class="table-wrap">
        <table class="table">
          <thead><tr>
            <th>Logement</th><th class="num">Base</th><th class="num">Plancher</th><th class="num">Plafond</th>
            <th class="num">Ce soir</th><th class="num">Écart 30 j</th><th></th><th></th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <p class="text-xs text-muted mt-3">
        L'écart sur 30 jours ne porte que sur les nuits encore à vendre : une nuit déjà réservée a été vendue
        à un prix décidé avant, la compter fausserait la mesure.
      </p>`;

    document.querySelectorAll('[data-pilote]').forEach(input => {
      input.addEventListener('change', () => {
        const l = getLogement(input.dataset.pilote);
        l.tarifs.dynamique.actif = input.checked;
        l.tarifs.dynamique.source = input.checked ? (tdMoteur() || {}).id || null : null;
        if (input.checked && l.tarifs.min == null) {
          const b = tdBornes(l);
          l.tarifs.min = b.min; l.tarifs.max = b.max;
        }
        if (!input.checked && filtreLogement === l.id) filtreLogement = 'all';
        saveOyviaState(); render();
        UI.toast(input.checked ? `${l.nom} piloté par PriceLabs` : `${l.nom} repasse au prix fixe`);
      });
    });
    document.querySelectorAll('[data-bornes]').forEach(btn => {
      btn.addEventListener('click', () => ouvrirBornes(btn.dataset.bornes));
    });
  }

  function ouvrirBornes(id) {
    const l = getLogement(id);
    const b = tdBornes(l);
    document.getElementById('td-bornes-title').textContent = `Bornes — ${l.nom}`;
    document.getElementById('td-bornes-body').innerHTML = `
      <p class="text-sm text-soft mb-4">
        Le plancher et le plafond s'appliquent après toutes les règles. Aucune combinaison de saison,
        de week-end ou de dernière minute ne peut vendre une nuit en dehors de cet intervalle.
      </p>
      <div class="app-grid app-grid--3">
        <div class="field"><label class="field__label" for="tb-base">Prix de base (${symboleDevise()})</label>
          <input class="input" type="number" min="0" id="tb-base" value="${montantSaisie(b.base)}" /></div>
        <div class="field"><label class="field__label" for="tb-min">Plancher (${symboleDevise()})</label>
          <input class="input" type="number" min="0" id="tb-min" value="${montantSaisie(b.min)}" /></div>
        <div class="field"><label class="field__label" for="tb-max">Plafond (${symboleDevise()})</label>
          <input class="input" type="number" min="0" id="tb-max" value="${montantSaisie(b.max)}" /></div>
      </div>
      <p class="text-xs text-muted mt-4" id="tb-apercu"></p>`;

    const apercu = () => {
      const base = Number(document.getElementById('tb-base').value);
      const min = Number(document.getElementById('tb-min').value);
      const max = Number(document.getElementById('tb-max').value);
      const el = document.getElementById('tb-apercu');
      if (min > max) { el.innerHTML = '<span class="text-danger">Le plancher dépasse le plafond : rien ne serait envoyé.</span>'; return; }
      if (base < min || base > max) { el.innerHTML = '<span class="text-danger">Le prix de base est hors des bornes.</span>'; return; }
      el.textContent = `Amplitude de ${formatMontant(versReference(max - min))}, soit ${Math.round(((max - min) / base) * 100)} % du prix de base.`;
    };
    ['tb-base', 'tb-min', 'tb-max'].forEach(i => document.getElementById(i).addEventListener('input', apercu));
    apercu();

    const ok = document.getElementById('td-bornes-ok');
    const frais = ok.cloneNode(true);
    ok.parentNode.replaceChild(frais, ok);
    frais.addEventListener('click', () => {
      // Saisies dans la devise d'affichage, converties en euros pour le stockage.
      const base = Math.round(lireMontantSaisi(document.getElementById('tb-base').value, l.tarifBase));
      const min = Math.round(lireMontantSaisi(document.getElementById('tb-min').value, l.tarifs.min));
      const max = Math.round(lireMontantSaisi(document.getElementById('tb-max').value, l.tarifs.max));
      if (![base, min, max].every(n => isFinite(n) && n > 0)) { UI.toast('Montants invalides', false); return; }
      if (min > max) { UI.toast('Le plancher doit rester sous le plafond', false); return; }
      if (base < min || base > max) { UI.toast('Le prix de base doit rester entre les bornes', false); return; }
      l.tarifBase = base; l.tarifs.min = min; l.tarifs.max = max;
      saveOyviaState(); UI.closeAll(); render();
      UI.toast(`Bornes de ${l.nom} enregistrées`);
    });

    UI.openPanel('td-bornes-modal');
  }

  /* ============================================================
     Onglet Règles — les leviers, avec leur effet chiffré
     ============================================================ */
  function bloc(titre, desc, corps, toggle) {
    return `<div class="card card--pad td-regle">
      <div class="row gap-3 mb-3">
        <div class="grow">
          <div class="card__title">${titre}</div>
          <p class="text-sm text-soft">${desc}</p>
        </div>
        ${toggle}
      </div>
      ${corps}
    </div>`;
  }
  function inter(id, actif) {
    return `<label class="switch"><input type="checkbox" data-regle="${id}" ${actif ? 'checked' : ''} /><span class="switch__track"></span></label>`;
  }

  // Libellé d'un palier borné, du type « 7–13 nuits » ou « 30+ ».
  function bornes(p, unite) {
    return p.max == null ? `${p.min}+ ${unite}` : `${p.min}–${p.max} ${unite}`;
  }

  function renderRegles() {
    const T = TARIF_DYNAMIQUE;
    const m = tdMoteur();
    const editable = tdMoteurInterne();

    /* Avec une plateforme externe, les règles vivent chez elle. On les
       montre pour que l'écran reste lisible, mais en lecture seule : les
       rendre modifiables ici laisserait croire qu'on agit sur des prix
       qu'Oyvia ne fait que recevoir. */
    const bandeau = editable ? '' : `
      <div class="card card--pad td-externe mb-4">
        <div class="row gap-3">
          <span class="td-moteur__logo td-moteur__logo--sm">${m.lettre}</span>
          <div class="grow">
            <b>Ces règles sont configurées dans ${m.nom}</b>
            <p class="text-sm text-soft">Oyvia applique vos garde-fous et vos prix fixés à la main, puis pousse le résultat vers vos canaux. Pour modifier la stratégie elle-même, passez par ${m.nom}.</p>
          </div>
          <button class="btn btn--danger btn--sm" id="td-changer-moteur">Déconnecter</button>
        </div>
      </div>`;

    const ro = editable ? '' : ' disabled';
    const champ = (cle, i, v, label) => `<label class="td-pct">
      <span>${label}</span>
      <input class="input input--pct" type="number" step="1" data-pctcle="${cle}" data-pctidx="${i}" value="${v}"${ro} />
    </label>`;

    const occ    = T.occupation.paliers.map((p, i) => champ('occupation', i, p.pct,
                     i === 0 ? `0–${p.jusqua} %` : `${T.occupation.paliers[i - 1].jusqua}–${p.jusqua} %`)).join('');
    const mois   = T.saison.mois.map((v, i) => champ('saison', i, v, MOIS_COURT[i])).join('');
    const jours  = T.jours.pct.map((v, i) => champ('jours', i, v, JOURS_MINI[i])).join('');
    const duree  = T.duree.paliers.map((p, i) => champ('duree', i, p.pct, bornes(p, 'nuits'))).join('');
    const delai  = T.delai.paliers.map((p, i) => champ('delai', i, p.pct, bornes(p, 'j'))).join('');

    // Effet concret de la règle de durée sur un séjour réel : sans ça, la
    // grille reste abstraite et on ne voit pas ce qu'elle change.
    const ex = tdLogementsPilotes()[0];
    const apercuDuree = ex ? T.duree.paliers.map(p => {
      const n = p.min;
      const d = prixSejour(ex.id, addDays(AUJOURDHUI, 30), n);
      return `<li><span>${bornes(p, 'nuits')}</span><b>${formatMontant(d.parNuit)}</b><small>/ nuit</small></li>`;
    }).join('') : '';

    document.getElementById('td-pane-regles').innerHTML = `
      ${bandeau}
      <div class="td-regles">
        ${bloc("1 · Taux d'occupation",
          `Part de votre parc déjà vendue pour la nuit concernée : logements réservés / ${LOGEMENTS.length} logements. Plus le parc se remplit, plus les nuits restantes se vendent cher.`,
          `<div class="td-pcts td-pcts--5">${occ}</div>
           <p class="text-xs text-muted mt-3">Mesuré sur <b>vos</b> réservations, pas sur des données de marché — Oyvia n'en dispose pas. Au-delà de ${T.occupation.horizonUtile} jours la règle ne s'applique plus : un parc vide à six mois est normal, ce n'est pas un signal de faible demande.</p>`,
          inter('occupation', T.occupation.actif))}

        ${bloc('2 · Saison',
          'Modulation mois par mois, en pourcentage du prix de base.',
          `<div class="td-pcts td-pcts--12">${mois}</div>`, inter('saison', T.saison.actif))}

        ${bloc('3 · Jour de la semaine',
          'Un vendredi ne vaut pas un mardi. Les écarts se cumulent avec la saison.',
          `<div class="td-pcts td-pcts--7">${jours}</div>`, inter('jours', T.jours.actif))}

        ${bloc('4 · Durée du séjour',
          "S'applique au séjour entier, pas à la nuit : en calculant le prix d'un mardi, on ignore encore combien de nuits le voyageur prendra.",
          `<div class="td-pcts td-pcts--5">${duree}</div>
           ${apercuDuree ? `<p class="text-xs text-muted mt-4 mb-2">Effet sur « ${ex.nom} », arrivée dans 30 jours :</p>
             <ul class="td-apercu">${apercuDuree}</ul>` : ''}
           <p class="text-xs text-muted mt-3">La remise ne peut pas faire descendre la nuit moyenne sous votre plancher : le garde-fou passe en dernier.</p>`,
          inter('duree', T.duree.actif))}

        ${bloc('5 · Délai de réservation',
          "Nombre de jours entre aujourd'hui et la nuit. Une nuit invendue ne se rattrape jamais ; à l'inverse, une réservation très anticipée sécurise le calendrier.",
          `<div class="td-pcts td-pcts--5">${delai}</div>
           <p class="text-xs text-muted mt-3">${T.delai.paliers.map(p => `<b>${bornes(p, 'j')}</b> ${p.label}`).join(' · ')}</p>
           <p class="text-xs text-muted mt-2">Ces ajustements ne touchent que les nuits encore libres.</p>`,
          inter('delai', T.delai.actif))}

      </div>`;

    const changer = document.getElementById('td-changer-moteur');
    if (changer) changer.addEventListener('click', deconnecterMoteur);

    document.querySelectorAll('[data-regle]').forEach(input => {
      input.addEventListener('change', () => {
        const cle = input.dataset.regle;
        if (cle === 'syncAuto') T.syncAuto = input.checked;
        else T[cle].actif = input.checked;
        saveOyviaState(); renderKpis(); renderCalendrier();
        UI.toast(input.checked ? 'Règle activée' : 'Règle désactivée');
      });
    });
    document.querySelectorAll('[data-pctcle]').forEach(input => {
      input.addEventListener('change', () => {
        const cle = input.dataset.pctcle, i = Number(input.dataset.pctidx);
        const v = Math.round(Number(input.value) || 0);
        if (cle === 'saison') T.saison.mois[i] = v;
        else if (cle === 'jours') T.jours.pct[i] = v;
        else if (cle === 'occupation') T.occupation.paliers[i].pct = v;
        else if (cle === 'duree') T.duree.paliers[i].pct = v;
        else if (cle === 'delai') T.delai.paliers[i].pct = v;
        saveOyviaState(); renderKpis(); renderCalendrier();
        // La grille de durée s'illustre par un aperçu chiffré : il doit suivre.
        if (cle === 'duree') renderRegles();
      });
    });
  }

  /* ============================================================
     Onglet Synchronisation — ce qui est réellement parti
     ============================================================ */
  function renderJournal() {
    const badge = { ok:'badge--positive', attention:'badge--warning', erreur:'badge--danger' };
    const canaux = PLATEFORMES.filter(p => p.section === 'ota' && p.connecte);
    const rows = TD_JOURNAL.map(j => `<tr>
      <td>${j.horodatage.replace(' ', ' à ')}</td>
      <td><span class="badge ${badge[j.statut]}">${TD_STATUT_JOURNAL[j.statut]}</span></td>
      <td class="num">${j.logements}</td>
      <td class="num">${j.nuits.toLocaleString('fr-FR')}</td>
      <td class="text-soft">${j.message}</td>
    </tr>`).join('');

    document.getElementById('td-pane-journal').innerHTML = `
      <div class="card card--pad mb-4">
        <p class="eyebrow mb-3">Canaux qui reçoivent les prix</p>
        ${canaux.length
          ? `<div class="row gap-2 wrap">${canaux.map(c => `<span class="chip-canal chip-canal--${c.id === 'booking' ? 'booking' : (c.id === 'airbnb' ? 'airbnb' : 'direct')}">${c.nom}</span>`).join('')}</div>`
          : `<p class="text-sm text-danger">Aucun canal connecté : les prix sont calculés mais ne partent nulle part.</p>`}
      </div>

      <div class="card card--pad mb-4">
        <div class="row-between mb-4">
          <div>
            <p class="eyebrow">Envoi automatique</p>
            <p class="text-sm text-soft">${TARIF_DYNAMIQUE.syncAuto
              ? 'Les prix repartent chaque jour, sans intervention.'
              : 'Désactivé : les prix ne partent que si vous cliquez sur « Synchroniser maintenant ».'}</p>
          </div>
          <label class="switch"><input type="checkbox" id="td-sync-auto" ${TARIF_DYNAMIQUE.syncAuto ? 'checked' : ''} /><span class="switch__track"></span></label>
        </div>
        <div class="app-grid app-grid--2">
          <div class="field"><label class="field__label" for="td-heure">Heure d'envoi</label>
            <input class="input" type="time" id="td-heure" value="${TARIF_DYNAMIQUE.heureSync}" ${TARIF_DYNAMIQUE.syncAuto ? '' : 'disabled'} /></div>
          <div class="field"><label class="field__label" for="td-horizon">Horizon (jours)</label>
            <input class="input" type="number" min="30" max="730" id="td-horizon" value="${TARIF_DYNAMIQUE.horizonJours}" /></div>
        </div>
        <p class="text-xs text-muted mt-3">L'horizon est la profondeur de calendrier poussée aux canaux : au-delà, aucun prix n'est envoyé.</p>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Quand</th><th>Résultat</th><th class="num">Logements</th><th class="num">Nuits</th><th>Détail</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;

    const T = TARIF_DYNAMIQUE;
    document.getElementById('td-sync-auto').addEventListener('change', e => {
      T.syncAuto = e.target.checked;
      saveOyviaState(); renderJournal();
      UI.toast(T.syncAuto ? 'Envoi automatique activé' : 'Envoi automatique désactivé');
    });
    document.getElementById('td-heure').addEventListener('change', e => {
      T.heureSync = e.target.value; saveOyviaState();
    });
    document.getElementById('td-horizon').addEventListener('change', e => {
      // Bornes larges mais réelles : moins de 30 jours ne sert à rien, au-delà
      // de deux ans aucun canal n'accepte le calendrier.
      T.horizonJours = Math.max(30, Math.min(730, Math.round(Number(e.target.value) || 365)));
      e.target.value = T.horizonJours; saveOyviaState();
    });
  }

  /* ---------- Onglets ---------- */
  const panes = [...document.querySelectorAll('.tabpane')];
  elTabs.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    elTabs.querySelectorAll('button').forEach(x => x.classList.remove('is-active'));
    b.classList.add('is-active');
    panes.forEach(p => p.classList.toggle('is-active', p.dataset.pane === b.dataset.tab));
  });

  /* ---------- Rendu global ---------- */
  function render() {
    const m = tdMoteur();
    elGate.hidden = !!m;
    elCorps.hidden = !m;
    document.getElementById('td-sous-titre').textContent = m
      ? (m.externe
          ? `Prix reçus de ${m.nom}, garde-fous appliqués, puis poussés vers vos canaux.`
          : 'Vos prix, recalculés chaque nuit par Oyvia et poussés vers vos canaux.')
      : 'Choisissez qui calcule vos prix : Oyvia, ou la plateforme que vous utilisez déjà.';
    renderActions();
    if (!m) { renderGate(); return; }
    if (filtreLogement !== 'all' && !tdLogementsPilotes().some(l => l.id === filtreLogement)) filtreLogement = 'all';
    renderKpis();
    renderCalendrier();
    renderLogements();
    renderRegles();
    renderJournal();
  }

  render();
})();
