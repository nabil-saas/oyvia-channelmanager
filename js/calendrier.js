/* ============================================================
   OYVIA — Calendrier unifié (écran le plus important)
   Grille logements × dates, barres par canal, tooltip,
   panneau de détail (partagé via UI.openResa), blocage de
   dates, vue mois / semaine.
   ============================================================ */
Layout.init('calendrier');

(function () {
  const JOURS_MINI = ['di', 'lu', 'ma', 'me', 'je', 've', 'sa'];
  const MS_JOUR = 86400000;
  const grid = document.getElementById('cal-grid');
  const label = document.getElementById('cal-label');
  const tt = document.getElementById('cal-tt');

  const state = {
    view: 'month',
    year: 2026, month: 6,                 // juillet 2026
    weekStart: lundiDeLaSemaine(parseDate(AUJOURDHUI)),
  };
  let logementFiltre = 'all';

  function lundiDeLaSemaine(d) {
    const x = new Date(d); const j = (x.getDay() + 6) % 7; x.setDate(x.getDate() - j); return x;
  }
  const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const isWE = d => d.getDay() === 0 || d.getDay() === 6;
  const isToday = d => sameDay(d, parseDate(AUJOURDHUI));
  const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  function getRange() {
    if (state.view === 'week') {
      return Array.from({ length: 7 }, (_, i) => new Date(state.weekStart.getFullYear(), state.weekStart.getMonth(), state.weekStart.getDate() + i));
    }
    const n = new Date(state.year, state.month + 1, 0).getDate();
    return Array.from({ length: n }, (_, i) => new Date(state.year, state.month, i + 1));
  }

  function updateLabel(days) {
    if (state.view === 'week') {
      const a = days[0], b = days[6];
      label.textContent = `${a.getDate()} – ${b.getDate()} ${MOIS_COURT[b.getMonth()]} ${b.getFullYear()}`;
    } else {
      label.textContent = `${MOIS_LONG[state.month].charAt(0).toUpperCase() + MOIS_LONG[state.month].slice(1)} ${state.year}`;
    }
  }

  function barFor(r, rangeStart, N) {
    const s = Math.round((parseDate(r.arrivee) - rangeStart) / MS_JOUR);
    const e = Math.round((parseDate(r.depart) - rangeStart) / MS_JOUR); // checkout (exclu)
    const visStart = Math.max(s, 0);
    const visEnd = Math.min(e, N);
    if (visEnd <= 0 || visStart >= N || visEnd <= visStart) return '';
    const labelTxt = r.canal === 'bloque' ? (r.note || 'Bloqué') : r.voyageur;
    // Une demande n'est pas une réservation confirmée : elle occupe la
    // place mais reste hachurée, pour qu'on la repère sans ouvrir la fiche.
    const enAttente = r.statut === 'demande' ? ' cal-bar--demande' : '';
    const suffixe = r.statut === 'demande' ? ' (à valider)' : '';
    return `<div class="cal-bar cal-bar--${r.canal}${enAttente}" style="grid-column:${visStart + 1}/${visEnd + 1}" data-res="${r.id}" tabindex="0" role="button" aria-label="${labelTxt}, ${formatPlage(r.arrivee, r.depart)}${suffixe}">${labelTxt}${suffixe}</div>`;
  }

  /* ---------- Interventions d'une ligne ----------

     Les tâches vivent SOUS les réservations du même logement, dans la
     même ligne. C'est ce qui a motivé la refonte : séparer les deux en
     deux onglets obligeait à basculer pour répondre à la seule question
     qu'on se pose devant un planning — « qui arrive, et qui doit passer
     avant ? ». Le ménage du 14 et le départ du 14 sont le même
     événement vu deux fois ; les afficher sur deux écrans revenait à
     demander à l'utilisateur de faire la jointure de tête.

     Une tâche sur plusieurs jours devient UNE barre continue, et non
     une pastille répétée chaque jour : c'est une seule intervention.

     Les voies évitent que deux tâches d'un même jour se recouvrent —
     chacune descend d'un cran jusqu'à trouver une place libre. La ligne
     grandit d'autant : mieux vaut une ligne haute qu'une tâche cachée
     derrière une autre. */
  function voiesTaches(logementId, rangeStart, N) {
    const items = TACHES.filter(t => t.logementId === logementId).map(t => {
      const finIso = (t.dateFin && parseDate(t.dateFin) > parseDate(t.date)) ? t.dateFin : t.date;
      const s = Math.round((parseDate(t.date) - rangeStart) / MS_JOUR);
      const e = Math.round((parseDate(finIso) - rangeStart) / MS_JOUR) + 1;  // dernier jour inclus
      return { t, s, e, debut: Math.max(s, 0), fin: Math.min(e, N), multi: finIso !== t.date };
    }).filter(x => x.e > 0 && x.s < N && x.fin > x.debut)
      .sort((a, b) => a.debut - b.debut || b.fin - a.fin);

    const finDeVoie = [];   // colonne de fin de la dernière tâche posée sur chaque voie
    items.forEach(it => {
      let v = finDeVoie.findIndex(fin => fin <= it.debut);
      if (v < 0) { v = finDeVoie.length; }
      finDeVoie[v] = it.fin;
      it.voie = v;
    });
    return { items, nbVoies: finDeVoie.length };
  }

  function barreTache({ t, debut, fin, voie, multi, s, e }, N) {
    const p = getPrestataire(t.prestataireId);
    const nom = p ? p.nom : (TACHE_LABEL[t.type] || t.type);
    const type = TACHE_LABEL[t.type] ? t.type : 'autre';

    /* Le libellé s'adapte à la place réellement disponible.

       Une nuit fait 42 px en vue mois : « 11:00 Sylvie Ménard » y devient
       « 1… », ce qui n'apprend rien et fait du bruit. Sur une seule
       journée et en vue mois, on ne garde donc que l'heure — la couleur
       dit le type, l'infobulle dit qui. En semaine, les colonnes sont
       larges : le nom tient et il est utile.

       Une tâche sur plusieurs jours a de la place quelle que soit la
       vue ; et l'heure n'y a pas de sens — « 10:00 » sur une barre de
       cinq jours laisse croire à un rendez-vous unique. */
    const large = multi || state.view === 'week';
    const quand = multi ? '' : `<b>${t.heure}</b>`;
    // Sur une journée, prénom seul : « 09:00 Sylvie Ménard » ne tient pas
    // dans une colonne de semaine et se fait couper au milieu du nom.
    // L'heure est ce qu'on vient lire, le nom complet est dans l'infobulle.
    const libelle = multi ? nom
      : (large ? `${quand} ${nom.split(' ')[0]}` : quand);
    const tronquee = (s < 0 ? ' cal-tbar--gauche' : '') + (e > N ? ' cal-tbar--droite' : '');
    return `<div class="cal-tbar cal-tbar--${type} cal-tbar--${t.statut}${tronquee}${large ? '' : ' cal-tbar--compacte'}"
      style="grid-column:${debut + 1}/${fin + 1};grid-row:${2 + voie}"
      data-task="${t.id}" tabindex="0" role="button"
      aria-label="${TACHE_LABEL[t.type] || t.type}, ${nom}, ${multi ? formatPlage(t.date, t.dateFin) : formatDate(t.date) + ' ' + t.heure}"><span
      class="cal-tbar__txt">${libelle}</span></div>`;
  }

  /* Prix affiché sous chaque nuit.

     Trois cas, et un seul est une « recommandation » :

     — nuit vendue : on montre ce qu'elle a RAPPORTÉ (montant du séjour
       divisé par ses nuits), pas ce que le moteur proposerait
       aujourd'hui. Le prix est encaissé, le recalculer donnerait un
       chiffre qui n'a jamais existé ;
     — nuit bloquée : rien à afficher, elle n'est pas à vendre ;
     — nuit libre : le prix recommandé si la tarification dynamique
       pilote ce logement, sinon le tarif de base — afficher un prix
       calculé par un moteur débranché ferait croire à un pilotage qui
       n'a pas lieu.

     Le montant est rendu SANS symbole : sur 31 colonnes, « 113 € »
     répété fait perdre les chiffres qu'on vient justement lire. La
     devise se lit dans l'infobulle, et partout ailleurs dans l'app. */
  function prixNuit(l, date, occ) {
    const r = occ.get(date);
    if (r && r.canal === 'bloque') return { texte: '—', titre: 'Nuit bloquée' };
    if (r) {
      const nuits = r.nuits || Math.max(1, nuitsEntre(r.arrivee, r.depart));
      const parNuit = Math.round((r.montant || 0) / nuits);
      return {
        texte: parNuit ? formatMontantNu(parNuit) : '—',
        titre: `Vendu ${formatMontant(parNuit)} la nuit — ${r.voyageur}`,
      };
    }
    if (tdPilote(l)) {
      // Exactement le chiffre de la grille Tarification dynamique : même
      // fonction, mêmes règles. Deux calculs parallèles finiraient par
      // afficher deux prix différents pour la même nuit.
      const reco = prixRecommande(l.id, date);
      const ecart = reco.prix - reco.base;
      return {
        texte: formatMontantNu(reco.prix),
        titre: `Prix recommandé ${formatMontant(reco.prix)}`
          + (ecart ? ` (${ecart > 0 ? '+' : ''}${Math.round((ecart / reco.base) * 100)} % vs base)` : ''),
      };
    }
    const { base } = tdBornes(l);
    return { texte: base ? formatMontantNu(base) : '—', titre: `Tarif de base ${formatMontant(base)}` };
  }

  function render() {
    const days = getRange();
    const N = days.length;
    const rangeStart = days[0];
    const cols = `repeat(${N}, minmax(42px, 1fr))`;
    updateLabel(days);

    const head = days.map(d => {
      const cls = `${isToday(d) ? 'cal-dayhead--today' : ''} ${isWE(d) ? 'cal-dayhead--we' : ''}`;
      return `<div class="cal-dayhead ${cls}"><small>${JOURS_MINI[d.getDay()]}</small><b>${d.getDate()}</b></div>`;
    }).join('');

    let html = `<div class="cal-row cal-row--head">
      <div class="cal-namecell">Logement</div>
      <div class="cal-track" style="grid-template-columns:${cols}">${head}</div>
    </div>`;

    const logements = logementFiltre === 'all' ? LOGEMENTS : LOGEMENTS.filter(l => l.id === logementFiltre);
    logements.forEach(l => {
      // Une seule construction de la carte des nuits occupées par
      // logement : la refaire à chaque jour relirait tout le tableau
      // des réservations 31 fois par ligne.
      const occ = nuitsOccupees(l.id);
      /* Colonne explicite sur chaque cellule : les barres occupent la
         même rangée, et un placement automatique ferait « couler » les
         cellules après elles au lieu de les laisser se superposer. Le
         décalage se voyait immédiatement — le prix d'une nuit vendue
         s'affichait trois colonnes plus loin. */
      const cells = days.map((d, i) => {
        const p = prixNuit(l, ymd(d), occ);
        return `<div class="cal-daycell ${isToday(d) ? 'cal-daycell--today' : ''} ${isWE(d) ? 'cal-daycell--we' : ''}" style="grid-column:${i + 1}">
          <span class="cal-prix" title="${p.titre}">${p.texte}</span>
        </div>`;
      }).join('');

      const barres = RESERVATIONS.filter(r => r.logementId === l.id && r.statut !== 'annule')
        .map(r => barFor(r, rangeStart, N)).join('');

      const { items, nbVoies } = voiesTaches(l.id, rangeStart, N);
      const taches = items.map(it => barreTache(it, N)).join('');

      html += `<div class="cal-row cal-row--body">
        <div class="cal-namecell">
          ${UI.vignetteLogement(l, 'cal-namecell__thumb')}
          <div class="cal-namecell__meta">
            <b title="${l.nom}">${l.nom}</b>
            <small>${l.ville}</small>
            ${nbVoies ? `<span class="cal-namecell__taches">${items.length} intervention${items.length > 1 ? 's' : ''}</span>` : ''}
          </div>
        </div>
        <div class="cal-track" style="grid-template-columns:${cols}">${cells}${barres}${taches}</div>
      </div>`;
    });
    grid.innerHTML = html;
  }

  /* ---------- Tooltip ---------- */
  grid.addEventListener('mouseover', e => {
    const taskEl = e.target.closest('.cal-tbar');
    if (taskEl) {
      const t = TACHES.find(x => x.id === taskEl.dataset.task); if (!t) return;
      const p = getPrestataire(t.prestataireId);
      const stLabel = { a_faire: 'À faire', en_cours: 'En cours', termine: 'Terminé' }[t.statut];
      const multi = t.dateFin && parseDate(t.dateFin) > parseDate(t.date);
      const quand = multi
        ? `${formatPlage(t.date, t.dateFin)} · ${nuitsEntre(t.date, t.dateFin) + 1} jours`
        : `${formatDate(t.date)} · ${t.heure}`;
      tt.innerHTML = `<b>${TACHE_LABEL[t.type] || t.type} · ${getLogement(t.logementId).nom}</b>
        <div class="cal-tt__row"><span>Quand</span><span>${quand}</span></div>
        <div class="cal-tt__row"><span>Prestataire</span><span>${p ? p.nom : '—'}</span></div>
        <div class="cal-tt__row"><span>Statut</span><span>${stLabel}</span></div>
`;
      tt.classList.add('is-open');
      return;
    }
    const bar = e.target.closest('.cal-bar'); if (!bar) return;
    const r = getReservation(bar.dataset.res); if (!r) return;
    const money = r.canal === 'bloque' ? '' :
      `<div class="cal-tt__row"><span>Montant</span><span>${formatMontant(r.montant)}</span></div>
       <div class="cal-tt__row"><span>Statut</span><span>${STATUT_LABEL[r.statut]}</span></div>`;
    tt.innerHTML = `<b>${r.canal === 'bloque' ? 'Blocage' : r.voyageur}</b>
      <div class="cal-tt__row"><span>Canal</span><span>${CANAL_LABEL[r.canal]}</span></div>
      <div class="cal-tt__row"><span>Séjour</span><span>${formatPlage(r.arrivee, r.depart)}</span></div>
      <div class="cal-tt__row"><span>Nuits</span><span>${r.nuits}</span></div>${money}`;
    tt.classList.add('is-open');
  });
  grid.addEventListener('mousemove', e => {
    if (!tt.classList.contains('is-open')) return;
    const pad = 16, w = tt.offsetWidth, h = tt.offsetHeight;
    let x = e.clientX + pad, y = e.clientY + pad;
    if (x + w > window.innerWidth - 8) x = e.clientX - w - pad;
    if (y + h > window.innerHeight - 8) y = e.clientY - h - pad;
    tt.style.left = x + 'px'; tt.style.top = y + 'px';
  });
  grid.addEventListener('mouseout', e => { if (e.target.closest('.cal-bar') || e.target.closest('.cal-tbar')) tt.classList.remove('is-open'); });

  /* ---------- Ouverture du détail (panneau partagé) ---------- */
  grid.addEventListener('click', e => { const bar = e.target.closest('.cal-bar'); if (bar) UI.openResa(bar.dataset.res); });
  grid.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('cal-bar')) { e.preventDefault(); UI.openResa(e.target.dataset.res); }
  });

  /* ---------- Blocage de dates ---------- */
  document.getElementById('blk-log').innerHTML = LOGEMENTS.map(l => `<option value="${l.id}">${l.nom}</option>`).join('');
  document.getElementById('blk-prest-list').innerHTML = PRESTATAIRES.map(p => `
    <label class="blk-prest-row">
      <input type="checkbox" value="${p.id}">
      ${p.nom}
      <small>${p.role} · ${p.zone}</small>
    </label>`).join('');
  /* ---------- Dates réellement blocables ----------
     Un blocage est une réservation comme une autre dans le modèle : il
     occupe les mêmes nuits et obéit donc aux mêmes règles. Bloquer une
     nuit déjà vendue reviendrait à surréserver le logement. */
  const blkLog = document.getElementById('blk-log');
  const blkFrom = document.getElementById('blk-from');
  const blkTo = document.getElementById('blk-to');
  /* Un blocage peut légitimement recouvrir un séjour : une chaudière qui
     lâche ne consulte pas le planning. Les nuits occupées sont donc
     BARRÉES mais sélectionnables — averties, pas interdites. La borne
     `maxFin` disparaît pour la même raison : elle empêchait d'enjamber la
     réservation suivante. Le formulaire de réservation, lui, garde le
     refus ferme : deux voyageurs sur la même nuit n'existent pas. */
  DatePicker.range(blkFrom, blkTo, () => ({
    labels: { debut: 'la date de début', fin: 'la date de fin' },
    avertir: d => occupantNuit(blkLog.value, d),
    note: d => occupationLogement(blkLog.value, d),
    uniteDuree: 'jours bloqués',
    legende: [
      { classe: 'barre', texte: 'Nuit occupée — sélectionnable' },
      { classe: 'note', texte: 'Arrivée ou départ' },
    ],
  }));

  /* Trois entrées directes, plus de question intermédiaire.

     L'ancien bouton unique « Bloquer des dates » ouvrait une modale qui
     demandait « qu'est-ce qui occupe le logement ? ». Cette question ne
     se pose pas : on sait ce qu'on vient créer avant de cliquer. Elle
     coûtait un aller-retour à chaque réservation saisie à la main.

     Le logement filtré à l'écran est presque toujours celui qu'on vise :
     on le pré-remplit. */
  const logementVise = () => (logementFiltre !== 'all' ? logementFiltre : null);

  document.getElementById('cal-resa').addEventListener('click', () => {
    ResaForm.ouvrir({ logementId: logementVise(), onCree: () => render() });
  });

  /* La grille se redessine dès la création — sans quoi il faudrait
     changer de mois pour voir apparaître ce qu'on vient de planifier. */
  document.getElementById('cal-tache').addEventListener('click', () => {
    TacheForm.ouvrir({ logementId: logementVise(), onCree: () => render() });
  });

  document.getElementById('cal-block').addEventListener('click', () => {
    document.getElementById('blk-motif').value = '';
    document.getElementById('blk-from').value = '';
    document.getElementById('blk-to').value = '';
    const vise = logementVise();
    if (vise) blkLog.value = vise;
    document.querySelectorAll('#blk-prest-list input:checked').forEach(c => { c.checked = false; });
    UI.openPanel('cal-modal');
  });
  /* Séjours (hors blocages) qu'un blocage viendrait recouvrir. */
  function sejoursRecouverts(logementId, du, au) {
    return RESERVATIONS.filter(r => r.logementId === logementId
      && r.canal !== 'bloque' && r.statut !== 'annule'
      && r.arrivee < au && r.depart > du);
  }

  // Mémorise l'accord donné dans la boîte de confirmation, le temps du
  // second passage dans ce même gestionnaire.
  let confirmationFaite = false;

  document.getElementById('blk-confirm').addEventListener('click', () => {
    const logId = document.getElementById('blk-log').value;
    const from = document.getElementById('blk-from').value;
    const to = document.getElementById('blk-to').value;
    const motif = document.getElementById('blk-motif').value.trim();
    if (!motif) { UI.toast('Le motif est obligatoire', false); return; }
    if (!from || !to || parseDate(to) <= parseDate(from)) { UI.toast('Dates invalides', false); return; }


    /* Recouvrir un séjour reste possible, mais jamais par inadvertance :
       on nomme les voyageurs concernés et on fait confirmer. Le
       chevauchement se voit sinon uniquement dans la grille, une fois
       enregistré. */
    const genes = sejoursRecouverts(logId, from, to);
    if (genes.length && !confirmationFaite) {
      UI.confirm({
        title: 'Ces dates sont déjà occupées',
        message: `${genes.map(r => `${r.voyageur} (${formatPlage(r.arrivee, r.depart)})`).join(', ')} ${genes.length > 1 ? 'occupent' : 'occupe'} déjà ce logement sur la période. Le blocage se superposera au séjour : prévenez ${genes.length > 1 ? 'les voyageurs' : 'le voyageur'} ou déplacez les travaux.`,
        confirmText: 'Bloquer quand même',
        danger: true,
        onConfirm: () => { confirmationFaite = true; document.getElementById('blk-confirm').click(); },
      });
      return;
    }
    confirmationFaite = false;

    const blockId = 'RB' + Date.now();
    RESERVATIONS.push({
      id: blockId, logementId: logId, voyageurId: null, voyageur: motif,
      canal: 'bloque', arrivee: from, depart: to, pers: 0, montant: 0, paiement: 'paye',
      statut: 'confirme', ref: '—', note: motif, nuits: nuitsEntre(from, to),
    });

    // Assignation optionnelle à un ou plusieurs prestataires : une tâche par prestataire coché.
    // dateFin = dernier jour réellement bloqué (le "Au" est exclusif, comme un départ de réservation).
    const dateFin = addDays(to, -1);
    const prestIds = [...document.querySelectorAll('#blk-prest-list input:checked')].map(c => c.value);
    prestIds.forEach((prestataireId, i) => {
      TACHES.push({
        id: 'T' + Date.now() + i, type: 'maintenance',
        logementId: logId, date: from, dateFin,
        heure: '10:00',
        prestataireId, statut: 'a_faire',
        reservationId: blockId, note: motif,
      });
    });

    UI.closeAll(); render();
    UI.toast(prestIds.length
      ? `Dates bloquées · ${prestIds.length} tâche${prestIds.length > 1 ? 's' : ''} créée${prestIds.length > 1 ? 's' : ''}`
      : 'Dates bloquées');
  });

  /* ---------- Navigation ---------- */
  document.getElementById('cal-view').addEventListener('click', e => {
    const btn = e.target.closest('button'); if (!btn) return;
    document.querySelectorAll('#cal-view button').forEach(b => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    state.view = btn.dataset.view;
    render();
  });
  document.getElementById('cal-prev').addEventListener('click', () => shift(-1));
  document.getElementById('cal-next').addEventListener('click', () => shift(1));
  function shift(dir) {
    if (state.view === 'week') {
      state.weekStart = new Date(state.weekStart.getFullYear(), state.weekStart.getMonth(), state.weekStart.getDate() + dir * 7);
    } else {
      state.month += dir;
      if (state.month < 0) { state.month = 11; state.year--; }
      if (state.month > 11) { state.month = 0; state.year++; }
    }
    render();
  }

  // Filtres & synchronisation
  document.addEventListener('resaChanged', render);
  document.addEventListener('logementChange', e => { logementFiltre = e.detail; render(); });
  document.addEventListener('resaChanged', render);

  render();
})();
