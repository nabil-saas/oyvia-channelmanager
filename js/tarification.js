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
  const NB_JOURS = 21;              // colonnes affichées dans le calendrier
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
    if (!pricelabsConnecte()) { elActions.innerHTML = ''; return; }
    elActions.innerHTML = `
      <select class="select app-logement-select" id="td-logement" aria-label="Filtrer par logement">
        <option value="all">Tous les logements</option>
        ${tdLogementsPilotes().map(l => `<option value="${l.id}" ${l.id === filtreLogement ? 'selected' : ''}>${l.nom}</option>`).join('')}
      </select>
      <button class="btn btn--secondary" id="td-sync">
        ${ic('<path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/>')}
        Synchroniser maintenant
      </button>
      <a class="btn btn--ghost" href="parametres.html">Gérer la connexion</a>`;

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
  }

  /* ============================================================
     Écran d'accroche — passerelle non connectée
     ============================================================ */
  function renderGate() {
    const pf = PLATEFORMES.find(p => p.id === 'pricelabs');
    const exemple = LOGEMENTS[0];
    const b = exemple ? tdBornes(exemple) : { base: 0, min: 0, max: 0 };
    elGate.innerHTML = `
      <div class="card td-gate">
        <div class="td-gate__main">
          <span class="td-gate__logo">P</span>
          <h2>Connectez PriceLabs pour activer la tarification dynamique</h2>
          <p class="text-soft">
            PriceLabs recalcule le prix de chaque nuit à partir de votre prix de base,
            de la saison, du jour de la semaine et du remplissage de votre calendrier,
            puis pousse le résultat vers vos canaux. Oyvia lui fournit vos réservations
            et applique vos garde-fous : jamais en dessous de votre plancher,
            jamais au-dessus de votre plafond.
          </p>
          <div class="td-gate__actions">
            <button class="btn btn--primary btn--lg" id="td-connect">Connecter mon compte PriceLabs</button>
            <a class="btn btn--ghost" href="parametres.html">Voir toutes les plateformes</a>
          </div>
          <p class="text-xs text-muted mt-3">${pf ? pf.desc : ''}</p>
        </div>
        <ul class="td-gate__points">
          <li>${ic('<path d="M3 16.5 8 10l4 3.5L21 4"/><path d="M16 4h5v5"/>')}
            <div><b>Un prix par nuit, pas un tarif figé</b>
            <span>Exemple sur « ${exemple ? exemple.nom : '—'} » : base ${formatEuro(b.base)}, plancher ${formatEuro(b.min)}, plafond ${formatEuro(b.max)}.</span></div></li>
          <li>${ic('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>')}
            <div><b>Les nuits orphelines détectées</b>
            <span>Un trou trop court pour votre minimum de séjour est décoté et son minimum assoupli, sinon il reste invendable.</span></div></li>
          <li>${ic('<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>')}
            <div><b>Vous gardez la main</b>
            <span>Un prix fixé à la main sur une date précise l'emporte sur tout le moteur.</span></div></li>
        </ul>
      </div>`;

    document.getElementById('td-connect').addEventListener('click', () => {
      const p = PLATEFORMES.find(x => x.id === 'pricelabs');
      if (p) p.connecte = true;
      tdSynchroniser();
      saveOyviaState();
      render();
      UI.toast('PriceLabs connecté — premiers prix calculés');
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
      kpi('Prix moyen recommandé', formatEuro(s.prixMoyen),
        `sur ${s.nuits} nuits encore à vendre (30 j)`,
        '<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>'),
      kpi('Écart au prix de base', `<span class="${signe}">${pct(s.ecartPct)}</span>`,
        `base moyenne ${formatEuro(s.baseMoyenne)}`,
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
      else if (r.orphelin) { classes.push('td-cell--orphelin'); sup = '<span class="td-cell__tag">Orphelin</span>'; }
      else if (r.borne === 'min') { classes.push('td-cell--plancher'); sup = '<span class="td-cell__tag">Plancher</span>'; }
      else if (r.borne === 'max') { classes.push('td-cell--plafond'); sup = '<span class="td-cell__tag">Plafond</span>'; }
      else if (r.prix > r.base) classes.push('td-cell--haut');
      else if (r.prix < r.base) classes.push('td-cell--bas');
    }
    const montant = r.reservation && r.reservation.canal === 'bloque' ? '—' : formatEuro(r.prix);
    return `<button type="button" class="${classes.join(' ')}" data-nuit="${l.id}|${date}"
      aria-label="${l.nom}, ${formatDate(date, { annee: true })}, ${montant}">
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

    const dates = Array.from({ length: NB_JOURS }, (_, i) => addDays(debut, i));
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
              : `Base ${formatEuro(b.base)} · ${formatEuro(b.min)}–${formatEuro(b.max)}`}</span>
          </div>
        </div>
        <div class="td-row__cells">${dates.map(d => celluleHTML(l, d)).join('')}</div>
      </div>`;
    }).join('');

    const finDate = addDays(debut, NB_JOURS - 1);
    pane.innerHTML = `
      <div class="card td-cal">
        <div class="card__head">
          <div>
            <div class="card__title">${formatPlage(debut, finDate)}</div>
            <p class="text-sm text-soft">Le prix affiché est celui qui part vers vos canaux pour cette nuit-là.</p>
          </div>
          <div class="row gap-2">
            <button class="icon-btn" id="td-prev" aria-label="Période précédente">${ic('<path d="m15 18-6-6 6-6"/>')}</button>
            <button class="btn btn--secondary btn--sm" id="td-auj">Aujourd'hui</button>
            <button class="icon-btn" id="td-next" aria-label="Période suivante">${ic('<path d="m9 18 6-6-6-6"/>')}</button>
          </div>
        </div>
        <div class="td-scroll">
          <div class="td-grid" style="--td-cols:${NB_JOURS}">
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
          <span><i class="td-dot td-dot--orphelin"></i>Nuit orpheline</span>
          <span><i class="td-dot td-dot--fixe"></i>Prix fixé à la main</span>
          <span><i class="td-dot td-dot--vendu"></i>Déjà vendu</span>
        </div>
      </div>`;

    document.getElementById('td-prev').addEventListener('click', () => { debut = addDays(debut, -NB_JOURS); renderCalendrier(); });
    document.getElementById('td-next').addEventListener('click', () => { debut = addDays(debut, NB_JOURS); renderCalendrier(); });
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
        <b>Prix fixé à la main : ${formatEuro(r.override.prix)}</b>
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
        <div class="td-calc__ligne"><span>Prix de base</span><b>${formatEuro(r.base)}</b></div>
        <ul class="td-fac">${lignes || '<li class="td-fac__vide">Aucune règle ne s\'applique à cette nuit.</li>'}</ul>
        <div class="td-calc__ligne td-calc__ligne--brut"><span>Prix calculé</span><b>${formatEuro(r.brut)}</b></div>
        ${r.borne ? `<div class="td-calc__borne">
          Ramené au ${r.borne === 'min' ? 'plancher' : 'plafond'} de ${formatEuro(r.borne === 'min' ? r.min : r.max)} :
          vos garde-fous s'appliquent en dernier et l'emportent sur les règles.
        </div>` : ''}
        <div class="td-calc__total"><span>Prix poussé</span><b>${formatEuro(r.prix)}</b></div>
      </div>`;
    }

    corps += `<div class="td-meta">
      <div><span>Plancher</span><b>${formatEuro(r.min)}</b></div>
      <div><span>Plafond</span><b>${formatEuro(r.max)}</b></div>
      <div><span>Minimum de nuits</span><b>${r.minNuits}</b></div>
      ${r.tensionPct !== undefined ? `<div><span>Calendrier rempli</span><b>${r.tensionPct} %</b></div>` : ''}
    </div>`;

    if (r.orphelin) {
      corps += `<div class="td-note td-note--orphelin">
        Trou de ${r.orphelin.taille} nuit${r.orphelin.taille > 1 ? 's' : ''} entre deux séjours, alors que ce logement
        demande ${r.orphelin.seuil} nuits minimum. Sans décote ET sans assouplir le minimum, personne ne peut réserver
        cette nuit : les deux vont ensemble.</div>`;
    }

    corps += `<div class="field mt-5">
      <label class="field__label" for="td-fixe">Fixer le prix de cette nuit (€)</label>
      <input class="input" type="number" min="0" step="1" id="td-fixe" value="${r.override ? r.override.prix : r.prix}" />
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
        const n = Math.round(Number(v));
        if (!isFinite(n) || n <= 0) { UI.toast('Montant invalide', false); return; }
        tdPoserOverride(logementId, date, n, note);
        UI.toast(`Nuit du ${formatDate(date)} fixée à ${formatEuro(n)}`);
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
        <td class="num money">${formatEuro(b.base)}</td>
        <td class="num money">${formatEuro(b.min)}</td>
        <td class="num money">${formatEuro(b.max)}</td>
        <td class="num money">${r ? (r.reservation ? '<span class="text-muted">vendu</span>' : formatEuro(r.prix)) : '<span class="text-muted">—</span>'}</td>
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
        l.tarifs.dynamique.source = input.checked ? 'PriceLabs' : null;
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
        <div class="field"><label class="field__label" for="tb-base">Prix de base (€)</label>
          <input class="input" type="number" min="0" id="tb-base" value="${b.base}" /></div>
        <div class="field"><label class="field__label" for="tb-min">Plancher (€)</label>
          <input class="input" type="number" min="0" id="tb-min" value="${b.min}" /></div>
        <div class="field"><label class="field__label" for="tb-max">Plafond (€)</label>
          <input class="input" type="number" min="0" id="tb-max" value="${b.max}" /></div>
      </div>
      <p class="text-xs text-muted mt-4" id="tb-apercu"></p>`;

    const apercu = () => {
      const base = Number(document.getElementById('tb-base').value);
      const min = Number(document.getElementById('tb-min').value);
      const max = Number(document.getElementById('tb-max').value);
      const el = document.getElementById('tb-apercu');
      if (min > max) { el.innerHTML = '<span class="text-danger">Le plancher dépasse le plafond : rien ne serait envoyé.</span>'; return; }
      if (base < min || base > max) { el.innerHTML = '<span class="text-danger">Le prix de base est hors des bornes.</span>'; return; }
      el.textContent = `Amplitude de ${formatEuro(max - min)}, soit ${Math.round(((max - min) / base) * 100)} % du prix de base.`;
    };
    ['tb-base', 'tb-min', 'tb-max'].forEach(i => document.getElementById(i).addEventListener('input', apercu));
    apercu();

    const ok = document.getElementById('td-bornes-ok');
    const frais = ok.cloneNode(true);
    ok.parentNode.replaceChild(frais, ok);
    frais.addEventListener('click', () => {
      const base = Math.round(Number(document.getElementById('tb-base').value));
      const min = Math.round(Number(document.getElementById('tb-min').value));
      const max = Math.round(Number(document.getElementById('tb-max').value));
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
  function champPct(cle, index, valeur, label) {
    return `<label class="td-pct">
      <span>${label}</span>
      <input class="input input--pct" type="number" step="1" data-pctcle="${cle}" data-pctidx="${index}" value="${valeur}" />
    </label>`;
  }

  function renderRegles() {
    const T = TARIF_DYNAMIQUE;
    const mois = T.saison.mois.map((v, i) => champPct('saison', i, v, MOIS_COURT[i])).join('');
    const jours = T.jours.pct.map((v, i) => champPct('jours', i, v, JOURS_MINI[i])).join('');
    const lm = T.derniereMinute.paliers.map((p, i) =>
      champPct('derniereMinute', i, p.pct, `≤ ${p.jours} j`)).join('');
    const tens = T.tension.paliers.map((p, i) =>
      champPct('tension', i, p.pct, `≥ ${p.seuil} %`)).join('');

    document.getElementById('td-pane-regles').innerHTML = `
      <div class="td-regles">
        ${bloc('Saisonnalité', 'Modulation mois par mois, en pourcentage du prix de base.',
          `<div class="td-pcts td-pcts--12">${mois}</div>`, inter('saison', T.saison.actif))}

        ${bloc('Jour de la semaine', 'Un vendredi ne vaut pas un mardi. Les écarts se cumulent avec la saison.',
          `<div class="td-pcts td-pcts--7">${jours}</div>`, inter('jours', T.jours.actif))}

        ${bloc('Dernière minute', "Décote à l'approche de l'arrivée. Une nuit invendue ne se rattrape jamais.",
          `<div class="td-pcts td-pcts--4">${lm}</div>
           <p class="text-xs text-muted mt-3">Le palier le plus proche l'emporte. Ces décotes ne touchent que les nuits encore libres.</p>`,
          inter('derniereMinute', T.derniereMinute.actif))}

        ${bloc('Nuits orphelines', "Un trou plus court que votre minimum de séjour, coincé entre deux réservations.",
          `<div class="row gap-4">
            ${champPct('orphelines', 0, T.orphelines.pct, 'Décote')}
            <p class="text-xs text-muted grow">Le minimum de nuits est ramené à la taille du trou, sinon la décote ne servirait à rien : la réservation resterait interdite.</p>
          </div>`, inter('orphelines', T.orphelines.actif))}

        ${bloc('Tension sur la période',
          `Part de votre calendrier déjà vendue autour de la date, sur ± ${T.tension.fenetre} jours. Mesurée sur <b>vos</b> réservations, pas sur des données de marché — Oyvia n'en dispose pas.`,
          `<div class="td-pcts td-pcts--4">${tens}</div>`, inter('tension', T.tension.actif))}

        ${bloc('Minimum de nuits piloté', "Assouplir le minimum là où l'on cherche à remplir.",
          `<ul class="td-liste">
            <li>Nuit orpheline : minimum ramené à la taille du trou.</li>
            <li>Arrivée dans ${T.minNuits.derniereMinuteJours} jours ou moins : minimum ramené à ${T.minNuits.derniereMinuteMin} nuit.</li>
          </ul>`, inter('minNuits', T.minNuits.actif))}

        ${bloc('Synchronisation', 'Fréquence à laquelle les prix repartent vers vos canaux.',
          `<div class="app-grid app-grid--2">
            <div class="field"><label class="field__label" for="td-heure">Heure d'envoi</label>
              <input class="input" type="time" id="td-heure" value="${T.heureSync}" /></div>
            <div class="field"><label class="field__label" for="td-horizon">Horizon (jours)</label>
              <input class="input" type="number" min="30" max="730" id="td-horizon" value="${T.horizonJours}" /></div>
          </div>`, inter('syncAuto', T.syncAuto))}
      </div>`;

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
        else if (cle === 'derniereMinute') T.derniereMinute.paliers[i].pct = v;
        else if (cle === 'tension') T.tension.paliers[i].pct = v;
        else if (cle === 'orphelines') T.orphelines.pct = v;
        saveOyviaState(); renderKpis(); renderCalendrier();
      });
    });
    const heure = document.getElementById('td-heure');
    if (heure) heure.addEventListener('change', () => { T.heureSync = heure.value; saveOyviaState(); });
    const horizon = document.getElementById('td-horizon');
    if (horizon) horizon.addEventListener('change', () => {
      T.horizonJours = Math.max(30, Math.min(730, Math.round(Number(horizon.value) || 365)));
      horizon.value = T.horizonJours; saveOyviaState();
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
        <p class="text-xs text-muted mt-3">
          ${TARIF_DYNAMIQUE.syncAuto
            ? `Envoi automatique chaque jour à ${TARIF_DYNAMIQUE.heureSync}, sur ${TARIF_DYNAMIQUE.horizonJours} jours d'horizon.`
            : "Envoi automatique désactivé : les prix ne partent que si vous cliquez sur « Synchroniser maintenant »."}
        </p>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Quand</th><th>Résultat</th><th class="num">Logements</th><th class="num">Nuits</th><th>Détail</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
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
    const connecte = pricelabsConnecte();
    elGate.hidden = connecte;
    elCorps.hidden = !connecte;
    document.getElementById('td-sous-titre').textContent = connecte
      ? 'Vos prix, recalculés chaque nuit et poussés vers vos canaux.'
      : 'Disponible dès que votre compte PriceLabs est relié à Oyvia.';
    renderActions();
    if (!connecte) { renderGate(); return; }
    if (filtreLogement !== 'all' && !tdLogementsPilotes().some(l => l.id === filtreLogement)) filtreLogement = 'all';
    renderKpis();
    renderCalendrier();
    renderLogements();
    renderRegles();
    renderJournal();
  }

  render();
})();
