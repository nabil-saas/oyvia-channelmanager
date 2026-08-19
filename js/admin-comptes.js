/* ============================================================
   OYVIA interne — Comptes clients

   L'écran de référence du back-office : c'est de là qu'on ouvre une
   fiche, qu'on change une offre et qu'on suspend un accès.

   Deux partis pris qui expliquent le reste du fichier :

   — Le MRR n'est jamais stocké. Il se recalcule à l'affichage à partir
     de l'offre et du nombre de logements (cf. mrrClient). Un chiffre
     figé dans la fiche aurait vieilli dès le premier changement de
     grille, et on aurait piloté sur du faux.

   — Les actions lourdes (suspendre, résilier) passent par UI.confirm et
     laissent une trace dans le journal. Elles coupent l'accès d'une
     entreprise à son outil de travail : c'est la seule catégorie
     d'action du produit qui mérite qu'on demande deux fois.
   ============================================================ */
if (AdminLayout.init('comptes')) { /* accès refusé */ } else {
(function () {

  const F = id => document.getElementById(id);
  const ic = Adm.ic;
  const peutAgir = peutAdmin('comptes_agir');

  let editId = null;     // compte en cours de modification dans la modale
  let ficheId = null;    // compte affiché dans le panneau

  /* ---------- Filtres ----------
     L'état initial peut venir de l'URL : la vue d'ensemble pointe
     directement sur « les essais qui se terminent ». Un lien qui ouvre
     la page sans appliquer le filtre annoncé fait perdre plus de temps
     qu'il n'en fait gagner. */
  const params = new URLSearchParams(location.search);
  const filtres = {
    q: '',
    statut: params.get('statut') || 'tous',
    plan: 'tous',
    tri: 'mrr',
  };

  F('ac-statut').innerHTML = '<option value="tous">Tous les statuts</option>' +
    Object.keys(CLIENT_STATUTS).map(k => `<option value="${k}">${CLIENT_STATUTS[k].label}</option>`).join('');
  F('ac-statut').value = filtres.statut;
  F('ac-plan').innerHTML = '<option value="tous">Toutes les offres</option>' +
    PLANS.map(p => `<option value="${p.id}">${p.nom}</option>`).join('');

  function listeFiltree() {
    const q = filtres.q.trim().toLowerCase();
    let liste = CLIENTS.filter(c => {
      if (filtres.statut !== 'tous' && c.statut !== filtres.statut) return false;
      if (filtres.plan !== 'tous' && c.plan !== filtres.plan) return false;
      if (!q) return true;
      return [c.societe, c.contact, c.email, c.ville, c.pays].join(' ').toLowerCase().includes(q);
    });
    const tris = {
      mrr:       (a, b) => mrrClient(b) - mrrClient(a),
      recent:    (a, b) => b.creeLe.localeCompare(a.creeLe),
      logements: (a, b) => b.logements - a.logements,
      nom:       (a, b) => a.societe.localeCompare(b.societe, 'fr'),
    };
    return liste.sort(tris[filtres.tri] || tris.mrr);
  }

  /* ---------- Indicateurs de tête ---------- */
  function renderKpis() {
    const actifs = clientsParStatut('actif');
    const essais = clientsParStatut('essai');
    const sortis = CLIENTS.filter(c => c.statut === 'resilie' || c.statut === 'suspendu');
    F('ac-kpis').innerHTML = [
      Adm.kpi({ label:'Comptes', valeur: CLIENTS.length,
        pied:`${actifs.length} actifs · ${essais.length} en essai · ${sortis.length} sortis`,
        icone:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>' }),
      Adm.kpi({ label:'MRR cumulé', valeur: formatPrixAbo(mrrTotal()),
        pied:`${formatPrixAbo(arpa())} par compte payant`,
        icone:'<path d="M12 2v20"/><path d="M17 7H9.5a3 3 0 0 0 0 6h5a3 3 0 0 1 0 6H6"/>', ton:'positive' }),
      Adm.kpi({ label:'Logements gérés', valeur: logementsSousGestion(),
        pied:'Comptes actifs et en essai',
        icone:'<path d="M3 9.5 12 3l9 6.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>' }),
      Adm.kpi({ label:'Attrition du mois', valeur: tauxChurn().toFixed(1) + ' %',
        pied: sortis.length ? sortis.map(c => c.societe).slice(0, 2).join(', ') : 'Aucun départ',
        icone:'<path d="M3 7.5 8 14l4-3.5L21 20"/><path d="M16 20h5v-5"/>',
        ton: tauxChurn() > 5 ? 'danger' : '' }),
    ].join('');
  }

  /* ---------- Tableau ---------- */
  function renderTable() {
    const liste = listeFiltree();
    F('ac-compteur').textContent = `${liste.length} compte${liste.length > 1 ? 's' : ''} sur ${CLIENTS.length}`;

    F('ac-tbody').innerHTML = liste.length ? liste.map(c => {
      const mrr = mrrClient(c);
      return `<tr class="adm-clic" data-fiche="${c.id}">
        <td>
          <b>${c.societe}</b>
          <div class="text-xs text-muted">${c.contact} · ${c.email}</div>
        </td>
        <td>${c.ville}<div class="text-xs text-muted">${c.pays}</div></td>
        <td>${getPlan(c.plan).nom}${c.periodicite === 'annuel' ? '<div class="text-xs text-muted">Annuel</div>' : ''}</td>
        <td class="num">${c.logements}</td>
        <td class="num money">${mrr ? formatPrixAbo(mrr) : '—'}</td>
        <td>${Adm.badge(CLIENT_STATUTS, c.statut)}</td>
        <td class="text-xs text-muted">${formatDate(c.dernierAcces)}</td>
        <td style="text-align:right"><button class="icon-btn" data-fiche="${c.id}" aria-label="Ouvrir la fiche">${ic('<path d="m9 18 6-6-6-6"/>')}</button></td>
      </tr>`;
    }).join('') : `<tr><td colspan="8">${Adm.vide('Aucun compte', "Aucun compte ne correspond à ces filtres.")}</td></tr>`;
  }

  /* ---------- Fiche compte (panneau) ---------- */
  function ouvrirFiche(id) {
    const c = getClient(id);
    if (!c) return;
    ficheId = id;

    const mrr = mrrClient(c);
    const factures = facturesClient(id).sort((a, b) => b.emiseLe.localeCompare(a.emiseLe)).slice(0, 4);
    const demandes = demandesClient(id).filter(d => d.statut !== 'traitee');
    const restantEssai = c.statut === 'essai' && c.essaiFinLe ? nuitsEntre(AUJOURDHUI, c.essaiFinLe) : null;

    F('ac-panel-tete').innerHTML = `
      <div class="adm-fiche__head">
        <div class="adm-fiche__logo">${Adm.initiales(c.societe)}</div>
        <div class="grow">
          <h3 class="modal__title" id="ac-panel-titre">${c.societe}</h3>
          <p class="text-sm text-muted">${getPlan(c.plan).nom} · ${c.logements} logement${c.logements > 1 ? 's' : ''} · ${Adm.badge(CLIENT_STATUTS, c.statut)}</p>
        </div>
      </div>`;

    const ligne = (dt, dd) => `<dt>${dt}</dt><dd>${dd}</dd>`;

    F('ac-panel-corps').innerHTML = `
      ${restantEssai !== null ? `
        <div class="card card--pad mb-4" style="background:var(--c-accent-soft);border:0">
          <b>Essai en cours</b>
          <p class="text-sm">${restantEssai <= 0 ? "L'essai est arrivé à terme." : `Encore ${restantEssai} jour${restantEssai > 1 ? 's' : ''}, jusqu'au ${formatDate(c.essaiFinLe, { annee: true })}.`}</p>
        </div>` : ''}

      ${c.statut === 'suspendu' ? `
        <div class="card card--pad mb-4" style="background:var(--c-warning-soft);border:0">
          <b>Accès suspendu</b>
          <p class="text-sm">${c.note || "Le client ne peut plus se connecter. L'abonnement n'est plus facturé."}</p>
        </div>` : ''}

      <p class="eyebrow mb-2">Abonnement</p>
      <dl class="adm-defs mb-4">
        ${ligne('Offre', getPlan(c.plan).nom)}
        ${ligne('Facturation', c.periodicite === 'annuel' ? 'Annuelle (−20 %)' : 'Mensuelle')}
        ${ligne('MRR', mrr ? `<b>${formatPrixAbo(mrr)}</b>` : '—')}
        ${ligne('Logements', c.logements)}
      </dl>

      <p class="eyebrow mb-2">Contact</p>
      <dl class="adm-defs mb-4">
        ${ligne('Interlocuteur', c.contact)}
        ${ligne('E-mail', `<a href="mailto:${c.email}">${c.email}</a>`)}
        ${ligne('Téléphone', c.telephone)}
        ${ligne('Lieu', `${c.ville}, ${c.pays}`)}
        ${ligne('Client depuis', formatDate(c.creeLe, { annee: true }))}
        ${ligne('Dernier accès', formatDate(c.dernierAcces, { annee: true }))}
        ${ligne('Origine', CLIENT_SOURCES[c.source] || c.source)}
      </dl>

      <p class="eyebrow mb-2">Dernières factures</p>
      ${factures.length ? factures.map(f => `
        <div class="adm-ligne">
          <div class="adm-ligne__meta grow">
            <b>${f.id}</b>
            <small>${libelleMois(f.periode)} · émise le ${formatDate(f.emiseLe)}</small>
          </div>
          <span class="adm-ligne__val">${formatPrixAbo(f.montant)}</span>
          ${Adm.badge(FACTURE_SAAS_STATUTS, statutFactureReel(f))}
        </div>`).join('') : '<p class="text-sm text-muted">Aucune facture émise.</p>'}

      ${demandes.length ? `
        <p class="eyebrow mb-2 mt-4">Demandes ouvertes</p>
        ${demandes.map(d => `
          <div class="adm-ligne">
            <div class="adm-ligne__meta grow">
              <b>${DEMANDE_SUJETS[d.sujet].label}</b>
              <small>${d.message.slice(0, 80)}${d.message.length > 80 ? '…' : ''}</small>
            </div>
            <a class="btn btn--ghost btn--sm" href="demandes.html#${d.id}">Ouvrir</a>
          </div>`).join('')}` : ''}

      ${c.note ? `<p class="eyebrow mb-2 mt-4">Note interne</p><p class="text-sm">${c.note}</p>` : ''}
    `;

    // Les actions dépendent du statut : proposer « Suspendre » sur un
    // compte déjà résilié n'aurait aucun sens, et proposer « Résilier »
    // partout invite à l'accident.
    const actions = [];
    if (peutAdmin('connexion')) actions.push(`<button class="btn btn--secondary btn--sm" id="ac-lecture">Ouvrir en lecture</button>`);
    if (peutAgir) {
      actions.push(`<button class="btn btn--secondary btn--sm" id="ac-modifier">Modifier</button>`);
      if (c.statut === 'essai')   actions.push(`<button class="btn btn--secondary btn--sm" id="ac-prolonger">Prolonger l'essai</button>`);
      if (c.statut === 'actif')   actions.push(`<button class="btn btn--danger btn--sm" id="ac-suspendre">Suspendre</button>`);
      if (c.statut === 'suspendu' || c.statut === 'resilie') actions.push(`<button class="btn btn--primary btn--sm" id="ac-reactiver">Réactiver</button>`);
      if (c.statut !== 'resilie') actions.push(`<button class="btn btn--ghost btn--sm" id="ac-resilier">Résilier</button>`);
    }
    F('ac-panel-pied').innerHTML = `<div class="adm-actions">${actions.join('')}</div>`;

    brancherActions(c);
    UI.openPanel('ac-panel');
  }

  function brancherActions(c) {
    const on = (id, fn) => { const el = F(id); if (el) el.addEventListener('click', fn); };

    on('ac-lecture', () => {
      // Pas de vraie usurpation d'identité dans une maquette : on dit ce
      // que ferait le bouton plutôt que d'ouvrir une app qui montrerait
      // les données d'un autre compte que celui annoncé.
      UI.toast(`Ouverture du compte ${c.societe} en lecture seule`);
    });

    on('ac-modifier', () => ouvrirModale(c.id));

    on('ac-prolonger', () => {
      prolongerEssai(c.id, 15);
      rafraichir();
      ouvrirFiche(c.id);
      UI.toast(`Essai prolongé jusqu'au ${formatDate(getClient(c.id).essaiFinLe)}`);
    });

    on('ac-suspendre', () => UI.confirm({
      title: 'Suspendre ce compte ?',
      message: `${c.societe} perdra l'accès à Oyvia immédiatement : plus de synchronisation des canaux, plus de messages automatiques. L'abonnement cesse d'être facturé.`,
      confirmText: 'Suspendre',
      danger: true,
      onConfirm: () => {
        suspendreClient(c.id, 'Suspension manuelle depuis le back-office.');
        rafraichir(); ouvrirFiche(c.id);
        UI.toast(`${c.societe} suspendu`);
      },
    }));

    on('ac-reactiver', () => {
      reactiverClient(c.id);
      rafraichir(); ouvrirFiche(c.id);
      UI.toast(`${c.societe} réactivé`);
    });

    on('ac-resilier', () => UI.confirm({
      title: 'Résilier ce compte ?',
      message: `Le compte de ${c.societe} sera clôturé. Les données restent conservées six mois, puis sont supprimées.`,
      confirmText: 'Résilier',
      danger: true,
      onConfirm: () => {
        resilierClient(c.id);
        rafraichir(); ouvrirFiche(c.id);
        UI.toast(`${c.societe} résilié`);
      },
    }));
  }

  /* ---------- Modale de création / modification ---------- */
  F('ac-f-plan').innerHTML = PLANS.map(p => `<option value="${p.id}">${p.nom}</option>`).join('');
  F('ac-f-statut').innerHTML = Object.keys(CLIENT_STATUTS)
    .map(k => `<option value="${k}">${CLIENT_STATUTS[k].label}</option>`).join('');
  F('ac-f-source').innerHTML = Object.keys(CLIENT_SOURCES)
    .map(k => `<option value="${k}">${CLIENT_SOURCES[k]}</option>`).join('');

  function ouvrirModale(id) {
    editId = id;
    const c = id ? getClient(id) : null;
    F('ac-modal-titre').textContent = c ? c.societe : 'Nouveau compte';
    F('ac-f-societe').value = c ? c.societe : '';
    F('ac-f-contact').value = c ? c.contact : '';
    F('ac-f-email').value = c ? c.email : '';
    F('ac-f-tel').value = c ? c.telephone : '';
    F('ac-f-ville').value = c ? c.ville : '';
    F('ac-f-pays').value = c ? c.pays : 'France';
    F('ac-f-plan').value = c ? c.plan : 'smart';
    F('ac-f-logements').value = c ? c.logements : 1;
    F('ac-f-statut').value = c ? c.statut : 'essai';
    F('ac-f-periodicite').value = c ? (c.periodicite || 'mensuel') : 'mensuel';
    F('ac-f-source').value = c ? c.source : 'site';
    F('ac-f-negocie').value = c && c.mrrNegocie ? montantAbo(c.mrrNegocie) : '';
    F('ac-f-note').value = c ? (c.note || '') : '';
    majApercu();
    UI.openPanel('ac-modal');
  }

  /* Le montant négocié est stocké en MAD (devise du catalogue) mais saisi
     dans la devise d'affichage : sans conversion à l'entrée comme à la
     sortie, un contrat saisi en euros deviendrait un contrat en dirhams
     au premier changement de devise. */
  function montantAbo(mad) { return Math.round(convertirMAD(mad, deviseAffichee())); }
  function montantAboVersRef(saisi) {
    const d = getDevise(deviseAffichee());
    return Math.round(saisi / (d.taux || 1));
  }

  // Aperçu du prix : montrer tout de suite ce que le compte va coûter
  // évite le classique « on a créé le compte, on découvre la facture ».
  function majApercu() {
    const plan = getPlan(F('ac-f-plan').value);
    const n = Math.max(1, parseInt(F('ac-f-logements').value, 10) || 1);
    const periodicite = F('ac-f-periodicite').value;
    const surDevis = plan.unite === 'devis';
    F('ac-f-negocie-champ').hidden = !surDevis;

    let texte;
    if (surDevis) {
      texte = "Contrat hors grille : indiquez le montant convenu ci-dessus.";
    } else if (plan.unite === 'gratuit') {
      texte = "Offre gratuite : aucun montant facturé.";
    } else {
      const mensuel = totalMensuel(plan.id, n, periodicite);
      texte = `${formatPrixAbo(mensuel)} par mois pour ${logementsFactures(plan.id, n)} logement${logementsFactures(plan.id, n) > 1 ? 's' : ''} facturé${logementsFactures(plan.id, n) > 1 ? 's' : ''}`
            + (periodicite === 'annuel' ? `, soit ${formatPrixAbo(mensuel * 12)} à l'année.` : '.');
      if (plan.id === 'decouverte' && n > 2) texte += " Attention : Découverte est limitée à 2 logements.";
    }
    F('ac-f-apercu').textContent = texte;
  }
  ['ac-f-plan', 'ac-f-logements', 'ac-f-periodicite'].forEach(id => {
    F(id).addEventListener('input', majApercu);
    F(id).addEventListener('change', majApercu);
  });

  F('ac-save').addEventListener('click', () => {
    const societe = F('ac-f-societe').value.trim();
    if (!societe) return UI.toast('Indiquez le nom de la société', false);
    const email = F('ac-f-email').value.trim();
    if (!email) return UI.toast("Indiquez un e-mail de contact", false);

    const plan = F('ac-f-plan').value;
    const statut = F('ac-f-statut').value;
    const donnees = {
      societe,
      contact: F('ac-f-contact').value.trim(),
      email,
      telephone: F('ac-f-tel').value.trim(),
      ville: F('ac-f-ville').value.trim(),
      pays: F('ac-f-pays').value.trim() || 'France',
      plan,
      logements: Math.max(1, parseInt(F('ac-f-logements').value, 10) || 1),
      statut,
      periodicite: F('ac-f-periodicite').value,
      source: F('ac-f-source').value,
      note: F('ac-f-note').value.trim(),
      mrrNegocie: getPlan(plan).unite === 'devis'
        ? montantAboVersRef(parseFloat(F('ac-f-negocie').value) || 0)
        : null,
    };

    if (editId) {
      const avant = getClient(editId);
      const changementOffre = avant.plan !== donnees.plan;
      Object.assign(avant, donnees);
      journaliser('Compte modifié', societe,
        changementOffre ? `Offre : ${getPlan(avant.plan).nom}.` : 'Fiche mise à jour.');
      UI.toast('Compte mis à jour');
    } else {
      const nouveau = {
        id: prochainId('C', CLIENTS),
        ...donnees,
        creeLe: AUJOURDHUI,
        dernierAcces: AUJOURDHUI,
        // Un compte créé en essai sans date de fin resterait en essai pour
        // toujours : 15 jours, comme l'offre Gratuit annoncée sur le site.
        essaiFinLe: statut === 'essai' ? addDays(AUJOURDHUI, 15) : null,
      };
      CLIENTS.unshift(nouveau);
      journaliser('Compte créé', societe, `${getPlan(plan).nom} · ${donnees.logements} logement(s) · ${CLIENT_STATUTS[statut].label}.`);
      UI.toast('Compte créé');
    }

    saveOyviaState();
    UI.closeAll();
    rafraichir();
  });

  /* ---------- Export ---------- */
  F('ac-export').addEventListener('click', () => {
    const liste = listeFiltree();
    UI.exportCSV('oyvia-comptes.csv',
      ['Société', 'Contact', 'E-mail', 'Ville', 'Pays', 'Offre', 'Logements', 'Statut', 'MRR', 'Client depuis'],
      liste.map(c => [c.societe, c.contact, c.email, c.ville, c.pays, getPlan(c.plan).nom,
        c.logements, CLIENT_STATUTS[c.statut].label, Math.round(convertirMAD(mrrClient(c), deviseAffichee())), c.creeLe]));
    UI.toast(`${liste.length} comptes exportés`);
  });

  /* ---------- Câblage ---------- */
  F('ac-add').addEventListener('click', () => {
    if (!peutAgir) return UI.toast("Votre rôle ne permet pas de créer un compte", false);
    ouvrirModale(null);
  });
  F('ac-q').addEventListener('input', e => { filtres.q = e.target.value; renderTable(); });
  ['statut', 'plan', 'tri'].forEach(cle => {
    F('ac-' + cle).addEventListener('change', e => { filtres[cle] = e.target.value; renderTable(); });
  });

  // Délégation : le tableau est redessiné à chaque filtre, poser un
  // écouteur par ligne ne survivrait pas au premier rendu.
  F('ac-tbody').addEventListener('click', e => {
    const cible = e.target.closest('[data-fiche]');
    if (cible) ouvrirFiche(cible.dataset.fiche);
  });

  function rafraichir() {
    renderKpis();
    renderTable();
    AdminLayout.refreshBadges();
  }

  rafraichir();

  // Ouverture directe d'une fiche par ancre : #C007 depuis un autre écran.
  if (location.hash.length > 1) {
    const c = getClient(location.hash.slice(1));
    if (c) ouvrirFiche(c.id);
  }
})();
}
