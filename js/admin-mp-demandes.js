/* ============================================================
   OYVIA — Back-office : les demandes de gestion

   Toutes les candidatures, d'un seul écran. Elles restent REGROUPÉES
   PAR BIEN : une candidature ne se juge pas seule. « 62/100 » ne veut
   rien dire dans l'absolu — ça veut dire beaucoup quand c'est le
   meilleur dossier reçu, et autre chose encore quand deux conciergeries
   à 84 attendent devant elle. Une liste à plat aurait détruit
   exactement l'information qu'on vient chercher.

   Le classement est calculé, jamais déclaré : type de bien réellement
   géré, occupation sur ce type, implantation, capacité restante. Et le
   score n'est jamais montré nu — le panneau détaille les quatre
   critères et ce qui les fonde, parce qu'un propriétaire nous demandera
   au téléphone pourquoi celle-ci plutôt que celle-là.

   Le score ordonne, il ne décide pas : une candidature acceptée reste
   en tête même si son score n'est pas le meilleur. Le classement
   informe, il ne réécrit pas l'histoire.
   ============================================================ */
(function () {
  if (AdminLayout.init('mpdemandes')) return;

  const F = id => document.getElementById(id);
  const filtres = { q: '', bien: 'tous', statut: 'tous', compat: 'toutes' };

  // Un lien depuis la fiche d'un bien (…#B04) ouvre l'écran cadré dessus.
  const ancre = location.hash.slice(1);
  if (ancre && mpBien(ancre)) filtres.bien = ancre;

  /* ---------- Filtres ---------- */
  F('mg-bien').innerHTML = '<option value="tous">Tous les biens</option>' +
    MP_BIENS.slice()
      .filter(b => mpDemandesDuBien(b.id).length)
      .sort((a, b) => mpDemandesDuBien(b.id).length - mpDemandesDuBien(a.id).length)
      .map(b => `<option value="${b.id}" ${b.id === filtres.bien ? 'selected' : ''}>${mpEch(b.type)} · ${mpEch(b.ville)} — ${mpEch(b.quartier)} (${mpDemandesDuBien(b.id).length})</option>`)
      .join('');

  F('mg-statut').innerHTML = '<option value="tous">Tous les statuts</option>' +
    Object.keys(MP_STATUTS_DEMANDE).map(c => `<option value="${c}">${MP_STATUTS_DEMANDE[c].label}</option>`).join('');

  /* ---------- Sélection ----------
     On classe d'abord bien par bien (le rang doit refléter la
     concurrence réelle), on filtre ensuite. Filtrer avant aurait
     renuméroté les candidatures restantes : masquer les refusées
     ferait passer la troisième pour la première. */
  function groupes() {
    const q = filtres.q.trim().toLowerCase();

    return MP_BIENS
      .filter(b => filtres.bien === 'tous' || b.id === filtres.bien)
      .map(b => {
        const classement = mpClassement(b.id).map((c, i) => Object.assign({ rang: i + 1 }, c));
        const retenues = classement.filter(({ demande, conciergerie, compat }) => {
          if (filtres.statut !== 'tous' && demande.statut !== filtres.statut) return false;
          if (filtres.compat !== 'toutes' && (!compat || compat.niveau !== filtres.compat)) return false;
          if (!q) return true;
          return `${conciergerie ? conciergerie.nom + ' ' + conciergerie.ville : ''} ${b.type} ${b.ville} ${b.quartier}`
            .toLowerCase().includes(q);
        });
        return { bien: b, total: classement.length, lignes: retenues };
      })
      .filter(g => g.lignes.length)
      .sort((a, b) => b.lignes.length - a.lignes.length ||
        String(b.bien.publieLe).localeCompare(String(a.bien.publieLe)));
  }

  /* ---------- Rendu ----------
     UN SEUL GESTE PAR LIGNE : la coche.

     Il n'y a rien à décider candidature par candidature — retenir
     quelqu'un écarte tous les autres, la croix ne faisait donc que
     répéter à la main ce que la coche produit toute seule. Et la
     colonne « Statut » disait la même chose une troisième fois : la
     coche pleine EST le statut, les lignes écartées s'effacent.

     Reste un cas que la coche ne couvre pas — n'en retenir aucune. Il
     ne se décide pas ligne par ligne mais logement par logement, d'où
     un bouton unique dans l'en-tête du groupe. */
  function actionHTML(demande, bien) {
    const dejaRetenue = mpDemandesDuBien(bien.id).some(x => x.statut === 'acceptee');
    const retenue = demande.statut === 'acceptee';

    // Un mandat déjà attribué ailleurs : plus rien à cliquer sur cette
    // ligne. Un bouton qui refuserait de répondre en dirait moins.
    if (dejaRetenue && !retenue) return '';

    return `
      <button class="mg-act mg-act--oui ${retenue ? 'is-actif' : ''}"
        ${retenue ? `data-annuler="${demande.id}"` : `data-valider="${demande.id}"`}
        aria-label="${retenue ? 'Conciergerie retenue — revenir sur le mandat' : 'Retenir cette conciergerie'}"
        title="${retenue ? 'Conciergerie retenue · cliquer pour revenir sur le mandat' : 'Retenir cette conciergerie'}">
        ${Adm.ic('<path d="M20 6 9 17l-5-5"/>')}</button>`;
  }

  function ligneHTML(bien, { demande, conciergerie, compat, rang }) {
    const attente = demande.statut === 'envoyee' && mpJoursDepuis(demande.envoyeeLe) >= 7;
    return `
      <tr class="mp-clic ${demande.statut === 'refusee' ? 'mp-ligne-prise' : ''}" data-demande="${demande.id}">
        <td class="num" style="width:44px"><span class="mpa-rang ${rang === 1 ? 'is-premier' : ''}">${rang}</span></td>
        <td>
          <b>${mpEch(conciergerie ? conciergerie.nom : 'Conciergerie inconnue')}</b>
          <div class="text-xs text-muted">${conciergerie
            ? `${mpEch(conciergerie.ville)} · ${conciergerie.logements} logements en gestion`
            : ''}</div>
        </td>
        <td style="min-width:180px">
          <span class="mpa-jauge mpa-jauge--${compat ? compat.niveau : 'faible'}"><i style="width:${compat ? compat.score : 0}%"></i></span>
          <div class="text-xs text-muted mt-1">${compat ? compat.score : 0}/100 · ${compat ? MP_NIVEAUX[compat.niveau].label : '—'}</div>
        </td>
        <td class="text-sm">${mpEch(mpDateCourte(demande.envoyeeLe))}
          <div class="text-xs text-muted">${mpDepuis(demande.envoyeeLe)}</div>
          ${attente ? '<span class="mp-alerte">sans réponse</span>' : ''}</td>
        <td style="width:56px">${actionHTML(demande, bien)}</td>
        <td style="text-align:right"><button class="icon-btn" data-demande="${demande.id}" aria-label="Voir le détail">
          ${Adm.ic('<path d="m9 18 6-6-6-6"/>')}</button></td>
      </tr>`;
  }

  // Trois états, trois couleurs, une seule définition (mp-data.js) :
  // cet écran et « Logements propriétaires » doivent dire la même chose.
  function etatHTML(bien) {
    const e = mpEtatBien(bien);
    return `<span class="badge ${e.badge}">${e.label}</span>` +
      (e.note ? `<span class="mp-alerte">${e.note}</span>` : '');
  }

  function render() {
    const g = groupes();
    const nb = g.reduce((n, x) => n + x.lignes.length, 0);
    F('mg-compteur').textContent = `${nb} demande${nb > 1 ? 's' : ''} sur ${MP_DEMANDES.length}`;

    if (!g.length) {
      F('mg-groupes').innerHTML = `<div class="card card--pad">${Adm.vide('Aucune demande',
        'Aucune candidature ne correspond à ces filtres.')}</div>`;
      return;
    }

    F('mg-groupes').innerHTML = g.map(({ bien, total, lignes }) => `
      <section class="card card--pad mb-4">
        <header class="mg-tete">
          <div class="grow">
            <h2 class="mg-tete__titre">${mpEch(bien.type)} · ${mpEch(bien.ville)}
              <span class="text-sm text-muted">— ${mpEch(bien.quartier)}</span></h2>
            <p class="text-xs text-muted">
              ${mpEch(mpLabelFamille(mpFamille(bien.type)))} · ${bien.surface} m² · ${bien.couchages} couchages ·
              ${mpEch(mpTrancheRevenu(bien))} ·
              ${mpEch(bien.proprietaire.prenom)} ${mpEch(bien.proprietaire.nom)}
            </p>
          </div>
          ${etatHTML(bien)}
          <span class="text-xs text-muted">${lignes.length === total
            ? `${total} candidature${total > 1 ? 's' : ''}`
            : `${lignes.length} sur ${total}`}</span>
          ${bien.statut === 'pris' || mpToutesEcartees(bien) ? '' :
            `<button class="btn btn--ghost btn--sm" data-aucune="${bien.id}">Aucune ne correspond</button>`}
        </header>

        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr><th></th><th>Conciergerie</th><th>Compatibilité</th><th>Envoyée</th><th>Retenir</th><th></th></tr>
            </thead>
            <tbody>${lignes.map(l => ligneHTML(bien, l)).join('')}</tbody>
          </table>
        </div>
        ${mpToutesEcartees(bien) ? `
          <p class="mg-rien">${Adm.ic('<circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/>')}
            Aucune de ces candidatures n'a été retenue. Le logement reste à pourvoir :
            il faut le proposer à d'autres conciergeries du secteur.</p>` : ''}
      </section>`).join('');
  }

  /* ---------- Détail d'une candidature ---------- */
  function ouvrir(id) {
    const demande = mpDemande(id);
    if (!demande) return;
    const bien = mpBien(demande.bienId);
    const conciergerie = mpConciergerie(demande.conciergerieId);
    const compat = bien && conciergerie ? mpCompatibilite(bien, conciergerie) : null;
    const r = demande.rapport;

    F('mg-panel-titre').textContent = conciergerie ? conciergerie.nom : 'Candidature';
    F('mg-panel-corps').innerHTML = `
      <div class="row-between mb-4">
        ${Adm.badge(MP_STATUTS_DEMANDE, demande.statut)}
        <span class="text-xs text-muted">Envoyée le ${mpEch(mpDate(demande.envoyeeLe))}</span>
      </div>

      <p class="eyebrow mb-2">Pour ce bien</p>
      <div class="mp-recap mb-4">
        <div><span>Bien</span><b>${mpEch(bien ? bien.type + ' · ' + bien.ville : '—')}</b></div>
        <div><span>Quartier</span><b>${mpEch(bien ? bien.quartier : '—')}</b></div>
        <div><span>Famille recherchée</span><b>${mpEch(bien ? mpLabelFamille(mpFamille(bien.type)) : '—')}</b></div>
        <div><span>Propriétaire</span><b>${bien ? mpEch(bien.proprietaire.prenom + ' ' + bien.proprietaire.nom) : '—'}</b></div>
      </div>

      ${compat ? `
        <p class="eyebrow mb-2">Compatibilité calculée</p>
        <div class="mpa-score" style="margin-top:0">
          <div class="mpa-score__chiffre"><b>${compat.score}</b><span>/100</span></div>
          <div class="grow">
            <span class="mpa-jauge mpa-jauge--${compat.niveau}"><i style="width:${compat.score}%"></i></span>
            <span class="badge ${MP_NIVEAUX[compat.niveau].badge} mt-2">${MP_NIVEAUX[compat.niveau].label}</span>
          </div>
        </div>
        <table class="table mpa-criteres mb-4">
          <tbody>
            ${compat.criteres.map(c => `
              <tr>
                <td>${mpEch(c.label)}<div class="text-xs text-muted">${mpEch(c.detail)}</div></td>
                <td class="num">${c.points}<span class="text-xs text-muted">/${c.sur}</span></td>
              </tr>`).join('')}
          </tbody>
        </table>` : ''}

      ${r ? `
        <p class="eyebrow mb-2">Rapport reçu par le propriétaire</p>
        <div class="mp-recap mb-2">
          <div><span>Occupation moyenne</span><b>${r.occupationGlobale} %</b></div>
          <div><span>Note voyageurs</span><b>${String(r.note).replace('.', ',')}/5</b></div>
          <div><span>Réponse aux voyageurs</span><b>${r.delaiReponseMin} min</b></div>
          <div><span>Ancienneté</span><b>${r.anciennete} ans</b></div>
          <div><span>Logements gérés</span><b>${r.logements}</b></div>
          <div><span>Sur ce type de bien</span><b>${r.experienceFamille
            ? `${r.experienceFamille.nb} biens · ${r.experienceFamille.occupation} %`
            : 'aucune référence'}</b></div>
        </div>
        <p class="text-xs text-muted mb-4">Chiffres figés au ${mpEch(mpDate(demande.envoyeeLe))} :
          la conciergerie n'a rien rédigé, et ces valeurs ne bougent plus après l'envoi.</p>` : ''}

      <p class="eyebrow mb-2">Suivi</p>
      <div class="mp-fil">
        ${(demande.suivi || []).slice().reverse().map((e, i) => `
          <div class="mp-fil__pt ${i === 0 ? 'is-fort' : ''}">
            <div class="mp-fil__date">${mpEch(mpDate(e.le))}</div>
            <div class="mp-fil__txt">${mpEch(e.texte)}</div>
          </div>`).join('')}
      </div>`;

    /* La décision se prend aussi depuis le détail : c'est ici qu'on lit
       les quatre critères, et obliger à refermer le panneau pour cliquer
       sur une coche du tableau reviendrait à séparer la lecture du
       geste qu'elle motive. */
    const dejaRetenue = bien && mpDemandesDuBien(bien.id).some(x => x.statut === 'acceptee');
    const retenue = demande.statut === 'acceptee';
    F('mg-panel-pied').innerHTML = `
      <button class="btn btn--secondary" onclick="UI.closeAll()">Fermer</button>
      ${retenue ? `<button class="btn btn--ghost" data-annuler="${demande.id}">Rompre le mandat</button>` : ''}
      ${(!bien || retenue || dejaRetenue) ? '' :
        `<button class="btn btn--primary" data-valider="${demande.id}">Confier le logement</button>`}`;

    UI.openPanel('mg-panel');
  }

  /* ---------- Décisions ----------
     Retenir une conciergerie prévient toutes les autres dans la même
     seconde. C'est irréversible du point de vue des conciergeries — un
     message parti ne se rappelle pas — donc on demande confirmation, et
     la confirmation dit exactement qui sera prévenu. Une boîte qui
     annonce « Confirmer ? » sans nommer les conséquences ne protège de
     rien : on clique sans lire. */
  function demanderValidation(id) {
    const d = mpDemande(id);
    const b = d && mpBien(d.bienId);
    const c = d && mpConciergerie(d.conciergerieId);
    if (!d || !b) return;

    const autres = mpDemandesDuBien(b.id).filter(x => x.id !== id && x.statut !== 'refusee');
    const noms = autres.map(x => (mpConciergerie(x.conciergerieId) || {}).nom || x.conciergerieId);

    UI.confirm({
      title: 'Confier ce logement ?',
      message: `${c ? c.nom : 'Cette conciergerie'} devient gestionnaire de ${b.type} · ${b.ville} — ${b.quartier}.\n\n` +
        (noms.length
          ? `${noms.length} autre${noms.length > 1 ? 's' : ''} candidature${noms.length > 1 ? 's' : ''} ` +
            `(${noms.join(', ')}) ${noms.length > 1 ? 'seront écartées' : 'sera écartée'} et ` +
            `${noms.length > 1 ? 'recevront' : 'recevra'} une notification dans ${noms.length > 1 ? 'leur' : 'son'} espace pro.`
          : 'Aucune autre candidature en lice.'),
      confirmText: 'Confier le logement',
      onConfirm() {
        const r = mpAccepterDemande(id);
        UI.closeAll();
        if (!r.ok) { UI.toast(r.raison, 'error'); return; }
        rafraichir();
        UI.toast(`Logement confié à ${c ? c.nom : 'la conciergerie'}` +
          (r.ecartees.length ? ` · ${r.ecartees.length} candidature${r.ecartees.length > 1 ? 's' : ''} écartée${r.ecartees.length > 1 ? 's' : ''} et prévenue${r.ecartees.length > 1 ? 's' : ''}` : ''));
      },
    });
  }

  /* Revenir sur un mandat. Le seul geste de retour possible depuis une
     ligne : on ne « dé-refuse » pas une candidature écartée — il suffit
     de cocher celle qu'on veut retenir. */
  function demanderAnnulation(id) {
    const d = mpDemande(id);
    const b = d && mpBien(d.bienId);
    const c = d && mpConciergerie(d.conciergerieId);
    if (!d || !b) return;

    UI.confirm({
      title: 'Revenir sur ce mandat ?',
      message: `${c ? c.nom : 'Cette conciergerie'} ne gérera plus ${b.type} · ${b.ville} — ${b.quartier}.\n\n` +
        `Le logement redevient à pourvoir et la conciergerie en est informée. ` +
        `Les candidatures déjà écartées le restent : vous pourrez en retenir une autre.`,
      confirmText: 'Rompre le mandat',
      danger: true,
      onConfirm() {
        const r = mpRefuserDemande(id);
        UI.closeAll();
        if (!r.ok) { UI.toast(r.raison, 'error'); return; }
        rafraichir();
        UI.toast('Mandat rompu, le logement est de nouveau à pourvoir');
      },
    });
  }

  /* N'en retenir aucune. Décision de logement, pas de candidature :
     elle écarte tout ce qui est encore en lice d'un seul geste. */
  function demanderAucune(bienId) {
    const b = mpBien(bienId);
    if (!b) return;
    const restantes = mpDemandesDuBien(bienId).filter(d => d.statut !== 'refusee');
    const noms = restantes.map(d => (mpConciergerie(d.conciergerieId) || {}).nom || d.conciergerieId);

    UI.confirm({
      title: 'Aucune candidature retenue ?',
      message: `${noms.length} candidature${noms.length > 1 ? 's' : ''} (${noms.join(', ')}) ` +
        `${noms.length > 1 ? 'seront écartées' : 'sera écartée'} et ` +
        `${noms.length > 1 ? 'recevront' : 'recevra'} une notification dans ${noms.length > 1 ? 'leur' : 'son'} espace pro.\n\n` +
        `${b.type} · ${b.ville} — ${b.quartier} restera à pourvoir, sans aucun candidat : ` +
        `il faudra le proposer à d'autres conciergeries du secteur.`,
      confirmText: 'Écarter toutes les candidatures',
      danger: true,
      onConfirm() {
        const r = mpEcarterToutes(bienId);
        UI.closeAll();
        if (!r.ok) { UI.toast(r.raison, 'error'); return; }
        rafraichir();
        UI.toast(`${r.ecartees.length} candidature${r.ecartees.length > 1 ? 's' : ''} écartée${r.ecartees.length > 1 ? 's' : ''} · logement remis en recherche`);
      },
    });
  }

  // Une décision change les indicateurs, les états de logement et les
  // pastilles du menu : tout se redessine, rien ne se rafistole.
  function rafraichir() {
    render();
    if (typeof AdminLayout.refreshBadges === 'function') AdminLayout.refreshBadges();
  }

  /* ---------- Événements ---------- */
  F('mg-groupes').addEventListener('click', e => {
    const oui = e.target.closest('[data-valider]');
    if (oui) { demanderValidation(oui.dataset.valider); return; }
    const annuler = e.target.closest('[data-annuler]');
    if (annuler) { demanderAnnulation(annuler.dataset.annuler); return; }
    const aucune = e.target.closest('[data-aucune]');
    if (aucune) { demanderAucune(aucune.dataset.aucune); return; }
    const cible = e.target.closest('[data-demande]');
    if (cible) ouvrir(cible.dataset.demande);
  });
  F('mg-panel-pied').addEventListener('click', e => {
    const oui = e.target.closest('[data-valider]');
    if (oui) { demanderValidation(oui.dataset.valider); return; }
    const annuler = e.target.closest('[data-annuler]');
    if (annuler) demanderAnnulation(annuler.dataset.annuler);
  });
  F('mg-q').addEventListener('input', e => { filtres.q = e.target.value; render(); });
  ['bien', 'statut', 'compat'].forEach(cle => {
    F('mg-' + cle).addEventListener('change', e => {
      filtres[cle] = e.target.value;
      if (cle === 'bien') history.replaceState(null, '', e.target.value === 'tous' ? location.pathname : '#' + e.target.value);
      render();
    });
  });

  F('mg-export').addEventListener('click', () => {
    const lignes = [];
    groupes().forEach(({ bien, lignes: l }) => l.forEach(({ demande, conciergerie, compat, rang }) => {
      lignes.push([`${bien.type} · ${bien.ville} — ${bien.quartier}`,
        `${bien.proprietaire.prenom} ${bien.proprietaire.nom}`,
        conciergerie ? conciergerie.nom : '—', rang, compat ? compat.score : '',
        compat ? MP_NIVEAUX[compat.niveau].label : '', demande.envoyeeLe,
        MP_STATUTS_DEMANDE[demande.statut] ? MP_STATUTS_DEMANDE[demande.statut].label : demande.statut,
        demande.rapport ? demande.rapport.occupationGlobale + ' %' : '']);
    }));
    UI.exportCSV('oyvia-demandes-gestion',
      ['Bien', 'Propriétaire', 'Conciergerie', 'Rang', 'Score', 'Compatibilité', 'Envoyée le', 'Statut', 'Occupation annoncée'],
      lignes);
  });

  render();
})();
