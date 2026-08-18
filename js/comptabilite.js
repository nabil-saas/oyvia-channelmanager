/* ============================================================
   OYVIA — Comptabilité : synthèse par propriétaire, facturation
   et dépenses par logement.

   Le contrat de chaque propriétaire se décrit par trois réglages
   indépendants (cf. calculFacture dans data.js) : qui encaisse, comment
   la conciergerie est rémunérée, et qui paie les dépenses.

   Conséquence pour cet écran : le document produit change de SENS.
   Quand la conciergerie encaisse, elle retient ses honoraires et
   produit un RELEVÉ DE REVERSEMENT ; quand le propriétaire encaisse,
   elle lui adresse une FACTURE. Les mêmes chiffres se lisent alors
   avec des signes opposés, et un parc mixte génère les deux à la fois
   — c'est pourquoi les totaux « à verser » et « à recevoir » ne sont
   jamais additionnés.
   ============================================================ */
Layout.init('comptabilite');

(function () {
  const icon = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;

  /* ---------- Onglets ---------- */
  const tabs = document.getElementById('cp-tabs');
  const panes = [...document.querySelectorAll('.tabpane')];
  function activateTab(name) {
    const b = tabs.querySelector(`[data-tab="${name}"]`); if (!b) return;
    tabs.querySelectorAll('button').forEach(x => x.classList.remove('is-active'));
    b.classList.add('is-active');
    panes.forEach(p => p.classList.toggle('is-active', p.dataset.pane === name));
  }
  tabs.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    activateTab(b.dataset.tab);
  });
  // Permet d'arriver directement sur un onglet via l'URL (ex : comptabilite.html#facturation)
  if (location.hash) activateTab(location.hash.slice(1));
  /* Le menu propose Facturation et Dépenses comme entrées à part entière.
     Depuis cette page, elles ne changent que le fragment : sans écoute du
     hashchange, l'URL bougerait et l'onglet resterait figé. */
  window.addEventListener('hashchange', () => {
    activateTab(location.hash.slice(1) || 'synthese');
    if (typeof Layout !== 'undefined' && Layout.refreshNav) Layout.refreshNav();
  });

  /* ============================================================
     SYNTHÈSE COMPTABLE
     ============================================================ */
  const ownerSel = document.getElementById('cp-owner');
  const fromField = document.getElementById('cp-from');
  const toField = document.getElementById('cp-to');

  ownerSel.innerHTML = '<option value="all">Tous les propriétaires</option>' +
    PROPRIETAIRES.map(o => `<option value="${o.id}">${o.societe}</option>`).join('');

  /* ---------- Période de synthèse ----------
     Une plage inversée ne renvoie rien et ressemble à un bug de l'app :
     on l'empêche à la source plutôt que d'afficher un tableau vide.
     Rien au-delà d'aujourd'hui non plus — la comptabilité ne porte que
     sur des mouvements déjà survenus. */
  DatePicker.range(fromField, toField, () => ({
    labels: { debut: 'la date de début', fin: 'la date de fin' },
    max: AUJOURDHUI,
    indispo: d => d > AUJOURDHUI ? 'À venir' : null,
    indispoFin: d => d > AUJOURDHUI ? 'À venir' : null,
    uniteDuree: 'jours',
  }));

  function premierJourMois(dateStr) {
    const d = parseDate(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  }
  function setDefaultPeriod() {
    fromField.value = premierJourMois(AUJOURDHUI);
    toField.value = AUJOURDHUI;
  }
  setDefaultPeriod();

  function nbJoursPeriode(from, to) {
    return Math.max(1, Math.round((parseDate(to) - parseDate(from)) / 86400000) + 1);
  }


  function computeSynthese(ownerId, from, to) {
    const biens = ownerId === 'all' ? LOGEMENTS : getLogementsByProprietaire(ownerId);
    const bienIds = biens.map(l => l.id);
    const nbJours = nbJoursPeriode(from, to);

    const perLogement = {};
    biens.forEach(l => { perLogement[l.id] = { logement: l, ca: 0, depenses: 0, commission: 0 }; });

    RESERVATIONS
      .filter(r => r.canal !== 'bloque' && bienIds.includes(r.logementId) && parseDate(r.arrivee) >= parseDate(from) && parseDate(r.arrivee) <= parseDate(to))
      .forEach(r => { perLogement[r.logementId].ca += r.montant; });

    DEPENSES
      .filter(d => bienIds.includes(d.logementId) && parseDate(d.date) >= parseDate(from) && parseDate(d.date) <= parseDate(to))
      .forEach(d => { if (perLogement[d.logementId]) perLogement[d.logementId].depenses += d.montant; });

    // Regroupement par propriétaire : chacun applique son propre modèle.
    const byOwner = {};
    Object.values(perLogement).forEach(row => {
      const oid = row.logement.proprietaireId;
      byOwner[oid] = byOwner[oid] || { ca: 0, depenses: 0 };
      byOwner[oid].ca += row.ca;
      byOwner[oid].depenses += row.depenses;
    });

    let ca = 0, depenses = 0, commission = 0, forfait = 0, depensesFacturees = 0;
    let factureMontant = 0, net = 0, aVerser = 0, aRecevoir = 0, resultatGestionnaire = 0, depensesAbsorbees = 0;
    const facturesParProprio = [];
    Object.keys(byOwner).forEach(oid => {
      const o = getProprietaire(oid);
      const g = byOwner[oid];
      const f = calculFacture(o, g.ca, g.depenses, nbJours);
      ca += g.ca; depenses += g.depenses;
      commission += f.commission; forfait += f.forfait;
      depensesFacturees += f.depensesRefacturees; depensesAbsorbees += f.depensesAbsorbees;
      factureMontant += f.montant; net += f.netProprietaire;
      aVerser += f.aVerser; aRecevoir += f.aRecevoir;
      resultatGestionnaire += f.resultatGestionnaire;
      facturesParProprio.push({ proprietaire: o, ...f });
      // Répartit la commission par logement (utile pour le tableau de détail).
      biens.filter(l => l.proprietaireId === oid).forEach(l => {
        if (o.remuneration !== 'forfait') perLogement[l.id].commission = perLogement[l.id].ca * o.commission;
      });
    });

    return { rows: Object.values(perLogement), ca, depenses, commission, forfait,
      depensesFacturees, depensesAbsorbees, factureMontant, net,
      aVerser, aRecevoir, resultatGestionnaire, facturesParProprio };
  }

  function renderInvoiceAlert(ownerId) {
    const el = document.getElementById('cp-invoice-alert');
    if (!el) return;
    const attente = FACTURES.filter(f => f.statut === 'attente' && (ownerId === 'all' || f.proprietaireId === ownerId));
    if (!attente.length) { el.innerHTML = ''; return; }
    const noms = [...new Set(attente.map(f => getProprietaire(f.proprietaireId).societe))];
    const label = attente.length > 1
      ? `${attente.length} factures sont en attente de génération`
      : `1 facture est en attente de génération`;
    el.innerHTML = `
      <div class="cp-alert">
        ${icon('<circle cx="12" cy="12" r="10"/><path d="M12 8v5M12 16h.01"/>')}
        <div class="cp-alert__body">
          <b>${label}</b>
          <span>${noms.join(', ')}</span>
        </div>
        <button type="button" class="btn btn--secondary" id="cp-alert-goto">Voir la facturation</button>
      </div>`;
    document.getElementById('cp-alert-goto').addEventListener('click', () => {
      tabs.querySelector('[data-tab="facturation"]').click();
    });
  }

  function renderModeNote(ownerId, data) {
    const el = document.getElementById('cp-mode-note');
    if (!el) return;
    if (ownerId !== 'all') {
      const o = getProprietaire(ownerId);
      el.textContent = `${libelleContrat(o)} · ${libelleDepenses(o)}.`;
    } else {
      // En vue consolidée, ce qui compte est de savoir si les contrats
      // vont dans le MÊME SENS : additionner un reversement dû et une
      // facture à recevoir donnerait un total qui ne veut rien dire.
      const sens = new Set(data.facturesParProprio.map(f => f.sens));
      el.textContent = sens.size > 1
        ? "Vue consolidée : certains propriétaires encaissent eux-mêmes, d'autres non. Les montants dus dans chaque sens sont donc présentés séparément."
        : (data.facturesParProprio[0]
            ? (data.facturesParProprio[0].sens === 'reversement'
                ? 'Vous encaissez pour tous les propriétaires visibles et leur reversez le solde.'
                : 'Tous les propriétaires visibles encaissent eux-mêmes ; vous leur facturez vos honoraires.')
            : '');
    }
  }

  function renderKPIs(data, ownerId) {
    const o = ownerId !== 'all' ? getProprietaire(ownerId) : null;

    const honoFoot = o
      ? (o.remuneration === 'forfait' ? `forfait ${formatMontant(o.forfaitMensuel)}/mois`
        : o.remuneration === 'mixte' ? `${Math.round(o.commission * 100)} % + forfait ${formatMontant(o.forfaitMensuel)}/mois`
        : `taux ${Math.round(o.commission * 100)} %`)
      : `${data.facturesParProprio.length} propriétaire${data.facturesParProprio.length > 1 ? 's' : ''}`;

    let depFoot;
    if (!data.depenses) depFoot = 'aucune dépense sur la période';
    else if (data.depensesAbsorbees) depFoot = `dont ${formatMontant(data.depensesAbsorbees)} à votre charge`;
    else if (data.depensesFacturees >= data.depenses) depFoot = 'intégralement à la charge du propriétaire';
    else depFoot = `dont ${formatMontant(data.depensesFacturees)} refacturées`;

    /* Le troisième compteur change de NATURE selon le contrat : reverser
       de l'argent et en recevoir ne sont pas la même opération, et un
       parc mixte produit les deux en même temps. On l'annonce plutôt que
       de tout empiler sous un « Facturé au propriétaire » qui serait faux
       la moitié du temps. */
    const mixte = data.aVerser > 0 && data.aRecevoir > 0;
    const fluxLabel = mixte ? 'Mouvements' : (data.aRecevoir > 0 ? 'À recevoir des propriétaires' : 'À verser aux propriétaires');
    const fluxValue = mixte
      ? `${formatMontant(data.aVerser)} <span class="kpi__sur">versés</span>`
      : formatMontant(data.aRecevoir > 0 ? data.aRecevoir : data.aVerser);
    const fluxFoot = mixte ? `et ${formatMontant(data.aRecevoir)} à recevoir` : honoFoot;

    const netFoot = o
      ? (o.encaissement === 'gestionnaire' ? 'après retenue, versé par vos soins' : 'conservé par le propriétaire, après facture')
      : 'selon le contrat de chaque propriétaire';

    const KPIS = [
      { label: 'CA généré', value: formatMontant(data.ca), foot: `${data.rows.length} logement${data.rows.length > 1 ? 's' : ''}`,
        ic: icon('<path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>') },
      { label: 'Vos honoraires', value: formatMontant(data.commission + data.forfait), foot: honoFoot,
        ic: icon('<line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>') },
      { label: fluxLabel, value: fluxValue, foot: fluxFoot,
        ic: icon('<path d="M7 17 17 7M17 7h-6M17 7v6"/>') },
      { label: 'Dépenses', value: formatMontant(data.depenses), foot: depFoot,
        ic: icon('<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-2.4z"/>') },
      { label: 'Net propriétaire', value: formatMontant(data.net), foot: netFoot,
        ic: icon('<path d="M20 6 9 17l-5-5"/>') },
    ];
    document.getElementById('cp-kpis').innerHTML = KPIS.map(k => `
      <div class="kpi"><span class="kpi__label">${k.label}</span><span class="kpi__value">${k.value}</span>
      <span class="kpi__foot">${k.foot}</span><span class="kpi__icon">${k.ic}</span></div>`).join('');
  }

  function renderBar(data) {
    const total = data.ca || 1;
    const pCF = Math.max(0, (data.commission + data.forfait) / total * 100);
    const pDep = Math.max(0, data.depensesFacturees / total * 100);
    const pNet = Math.max(0, 100 - pCF - pDep);
    document.getElementById('cp-bar').innerHTML = `
      <div class="cp-bar">
        <div class="cp-bar__seg cp-bar__seg--comm" style="width:${pCF}%"></div>
        <div class="cp-bar__seg cp-bar__seg--dep" style="width:${pDep}%"></div>
        <div class="cp-bar__seg cp-bar__seg--net" style="width:${pNet}%"></div>
      </div>
      <div class="cp-legend">
        <span><i class="cp-dot cp-dot--comm"></i>Commission & forfait — ${formatMontant(data.commission + data.forfait)}</span>
        <span><i class="cp-dot cp-dot--dep"></i>Dépenses refacturées — ${formatMontant(data.depensesFacturees)}</span>
        <span><i class="cp-dot cp-dot--net"></i>Net propriétaire — ${formatMontant(data.net)}</span>
      </div>`;
  }

  function renderSynthTable(data) {
    document.getElementById('cp-synth-table').innerHTML = data.rows.length
      ? data.rows.map(r => `
        <tr>
          <td class="fw-semibold">${r.logement.nom}</td>
          <td class="num money">${formatMontant(r.ca)}</td>
          <td class="num text-soft">${r.depenses ? '− ' + formatMontant(r.depenses) : '—'}</td>
          <td class="num money fw-semibold">${formatMontant(r.commission || 0)}</td>
        </tr>`).join('')
      : '<tr><td colspan="4"><div class="empty"><h4>Aucune donnée sur cette période</h4><p>Essayez d\'élargir la période sélectionnée.</p></div></td></tr>';
  }

  function renderSynthese() {
    const ownerId = ownerSel.value;
    const data = computeSynthese(ownerId, fromField.value || premierJourMois(AUJOURDHUI), toField.value || AUJOURDHUI);
    renderInvoiceAlert(ownerId);
    renderModeNote(ownerId, data);
    renderKPIs(data, ownerId);
    renderBar(data);
    renderSynthTable(data);
  }

  [ownerSel, fromField, toField].forEach(el => el.addEventListener('change', renderSynthese));
  document.getElementById('cp-period-month').addEventListener('click', () => { setDefaultPeriod(); renderSynthese(); });

  /* ============================================================
     FACTURATION — modèle, taux/forfait par propriétaire + statut
     des relevés mensuels
     ============================================================ */

  // Convertit un libellé "Juin 2026" en bornes de dates du mois.
  function monthRangeFromLabel(mois) {
    const [nom, anneeStr] = mois.split(' ');
    const idx = MOIS_LONG.findIndex(m => m.toLowerCase() === nom.toLowerCase());
    const annee = parseInt(anneeStr, 10);
    const mm = String(idx + 1).padStart(2, '0');
    const dernierJour = new Date(annee, idx + 1, 0).getDate();
    return { from: `${annee}-${mm}-01`, to: `${annee}-${mm}-${String(dernierJour).padStart(2, '0')}` };
  }

  function slugify(str) {
    return str.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
  }

  // Recalcule le détail d'une facture (CA, commission, forfait, dépenses…)
  // pour le mois exact du relevé, à partir des données actuelles.
  function buildFactureData(f) {
    const o = getProprietaire(f.proprietaireId);
    const { from, to } = monthRangeFromLabel(f.mois);
    const nbJours = nbJoursPeriode(from, to);
    const bienIds = getLogementsByProprietaire(o.id).map(l => l.id);
    let ca = 0, depenses = 0;
    RESERVATIONS
      .filter(r => r.canal !== 'bloque' && bienIds.includes(r.logementId) && parseDate(r.arrivee) >= parseDate(from) && parseDate(r.arrivee) <= parseDate(to))
      .forEach(r => { ca += r.montant; });
    DEPENSES
      .filter(d => bienIds.includes(d.logementId) && parseDate(d.date) >= parseDate(from) && parseDate(d.date) <= parseDate(to))
      .forEach(d => { depenses += d.montant; });
    return { o, mois: f.mois, from, to, ...calculFacture(o, ca, depenses, nbJours) };
  }

  // Génère un vrai PDF (jsPDF) reprenant le détail de la facture/relevé
  // du propriétaire pour le mois donné, et déclenche son téléchargement.
  function downloadFacturePDF(f) {
    const d = buildFactureData(f);
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const isReversement = d.sens === 'reversement';
    const titre = isReversement ? 'Relevé de reversement' : "Facture d'honoraires";
    let y = 20;

    doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(20, 20, 20);
    doc.text('Oyvia', 14, y);
    doc.setFontSize(11); doc.setTextColor(90, 90, 90); doc.setFont('helvetica', 'normal');
    doc.text('Conciergerie & gestion locative', 14, y + 6);

    doc.setFontSize(16); doc.setTextColor(20, 20, 20); doc.setFont('helvetica', 'bold');
    doc.text(titre, 196, y, { align: 'right' });
    doc.setFontSize(10); doc.setTextColor(110, 110, 110); doc.setFont('helvetica', 'normal');
    doc.text(`N° ${f.id}`, 196, y + 6, { align: 'right' });
    doc.text(`Émis le ${formatDate(AUJOURDHUI)}`, 196, y + 11, { align: 'right' });

    y += 22;
    doc.setDrawColor(225, 225, 225); doc.line(14, y, 196, y);
    y += 10;

    doc.setFontSize(9); doc.setTextColor(140, 140, 140);
    doc.text('DESTINATAIRE', 14, y);
    doc.text('PÉRIODE', 120, y);
    y += 6;
    doc.setFontSize(11); doc.setTextColor(20, 20, 20); doc.setFont('helvetica', 'bold');
    doc.text(d.o.societe, 14, y);
    doc.text(d.mois, 120, y);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(90, 90, 90);
    doc.text(d.o.contact, 14, y + 6);
    doc.text(d.o.email, 14, y + 12);
    doc.text(libelleContrat(d.o), 120, y + 6);
    doc.text(libelleDepenses(d.o), 120, y + 12);

    y += 24;
    doc.setDrawColor(225, 225, 225); doc.line(14, y, 196, y);
    y += 4;

    // Tableau des lignes
    // Les signes suivent le sens du document : sur un relevé de
    // reversement les honoraires se RETRANCHENT du CA, sur une facture
    // ils s'ADDITIONNENT. Même chiffre, lecture opposée.
    const signe = isReversement ? '- ' : '';
    const rows = [];
    rows.push([isReversement ? "Chiffre d'affaires encaissé sur la période"
                             : "Chiffre d'affaires déclaré sur la période", formatMontant(d.ca)]);
    if (d.commission) rows.push([`${signe}Commission (${Math.round(d.o.commission * 100)} %)`, signe + formatMontant(d.commission)]);
    if (d.forfait) rows.push([signe + 'Forfait de gestion', signe + formatMontant(d.forfait)]);
    if (d.depensesRefacturees) rows.push([
      isReversement ? '- Dépenses avancées' : '+ Dépenses refacturées',
      (isReversement ? '- ' : '+ ') + formatMontant(d.depensesRefacturees)]);

    doc.setFontSize(10);
    rows.forEach(([label, val], i) => {
      y += 10;
      doc.setTextColor(60, 60, 60); doc.setFont('helvetica', 'normal');
      doc.text(label, 14, y);
      doc.setFont('helvetica', 'bold'); doc.setTextColor(20, 20, 20);
      doc.text(val, 196, y, { align: 'right' });
    });

    y += 8;
    doc.setDrawColor(225, 225, 225); doc.line(14, y, 196, y);
    y += 12;

    doc.setFillColor(246, 246, 246);
    doc.roundedRect(14, y - 8, 182, 16, 2, 2, 'F');
    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(20, 20, 20);
    doc.text(isReversement ? 'Net reversé au propriétaire' : 'Total à régler par le propriétaire', 20, y + 1.5);
    doc.text(formatMontant(isReversement ? d.aVerser : d.aRecevoir), 190, y + 1.5, { align: 'right' });

    y += 24;
    doc.setFontSize(9); doc.setTextColor(140, 140, 140); doc.setFont('helvetica', 'normal');
    doc.text(isReversement
      ? `Net versé = CA (${formatMontant(d.ca)}) − honoraires${d.depensesRefacturees ? ' − dépenses avancées' : ''}.`
      : `Le propriétaire conserve ${formatMontant(d.netProprietaire)} après règlement de cette facture.`, 14, y);
    if (d.depensesAbsorbees) {
      y += 5;
      doc.text(`${formatMontant(d.depensesAbsorbees)} de frais avancés ne sont pas refacturés : ils restent à la charge du gestionnaire.`, 14, y);
    }

    doc.setFontSize(8); doc.setTextColor(170, 170, 170);
    doc.text('Document généré automatiquement par Oyvia — mockup de démonstration.', 14, 285);

    doc.save(`${isReversement ? 'releve' : 'facture'}-${slugify(d.o.societe)}-${slugify(f.mois)}.pdf`);
  }

  // Propriétaires dépliés. Tout est replié au départ : cet écran se
  // consulte bien plus souvent qu'il ne se modifie.
  const ouverts = new Set();

  function renderOwners() {
    document.getElementById('cp-owners').innerHTML = PROPRIETAIRES.map(o => {
      const biens = getLogementsByProprietaire(o.id);
      const months = getFacturesByProprietaire(o.id).map(f => {
        const done = f.statut === 'generee';
        const ic = done
          ? icon('<path d="M20 6 9 17l-5-5"/>').replace('<svg ', '<svg class="cp-month__ic" ')
          : icon('<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>').replace('<svg ', '<svg class="cp-month__ic" ');
        return `<button type="button" class="cp-month ${done ? 'cp-month--generee' : 'cp-month--attente'}" data-facture="${f.id}" title="${done ? 'Facture générée — cliquer pour télécharger' : 'En attente — cliquer pour générer'}">
          ${ic}
          <span><b>${f.mois.split(' ')[0]}</b><small>${done ? 'Générée' : 'En attente'}</small></span>
        </button>`;
      }).join('');
      // Aperçu chiffré sur la période affichée : le contrat ne se juge
      // pas sur ses libellés mais sur le décompte qu'il produit.
      const bienIds = biens.map(l => l.id);
      const [from, to] = [fromField.value, toField.value];
      const caPeriode = RESERVATIONS
        .filter(r => r.canal !== 'bloque' && bienIds.includes(r.logementId)
          && parseDate(r.arrivee) >= parseDate(from) && parseDate(r.arrivee) <= parseDate(to))
        .reduce((t, r) => t + r.montant, 0);
      const depPeriode = DEPENSES
        .filter(d => bienIds.includes(d.logementId)
          && parseDate(d.date) >= parseDate(from) && parseDate(d.date) <= parseDate(to))
        .reduce((t, d) => t + d.montant, 0);
      const d = calculFacture(o, caPeriode, depPeriode, nbJoursPeriode(from, to));
      const avance = o.depensesPayeesPar === 'gestionnaire';

      const ligne = (lab, val, cls) => `<div class="cp-decompte__l ${cls || ''}"><span>${lab}</span><b>${val}</b></div>`;
      const decompte = d.sens === 'reversement'
        ? [
            ligne("Chiffre d'affaires encaissé", formatMontant(d.ca)),
            d.forfait ? ligne('− Forfait de gestion', '− ' + formatMontant(d.forfait)) : '',
            d.commission ? ligne('− Commission', '− ' + formatMontant(d.commission)) : '',
            d.depensesRefacturees ? ligne('− Dépenses avancées', '− ' + formatMontant(d.depensesRefacturees)) : '',
            ligne('= Net à verser au propriétaire', formatMontant(d.aVerser), 'cp-decompte__l--total'),
          ].join('')
        : [
            ligne("Chiffre d'affaires déclaré", formatMontant(d.ca), 'cp-decompte__l--info'),
            d.forfait ? ligne('Forfait de gestion', formatMontant(d.forfait)) : '',
            d.commission ? ligne('Commission', formatMontant(d.commission)) : '',
            d.depensesRefacturees ? ligne('+ Dépenses à refacturer', '+ ' + formatMontant(d.depensesRefacturees)) : '',
            ligne('= À régler au gestionnaire', formatMontant(d.aRecevoir), 'cp-decompte__l--total'),
          ].join('');

      // Le sort des dépenses non refacturées ne se devine pas : il faut
      // l'écrire, sinon l'écart entre honoraires et marge réelle reste
      // invisible jusqu'au bilan.
      const noteAbsorbees = d.depensesAbsorbees
        ? `<p class="cp-decompte__note">Le gestionnaire supporte ${formatMontant(d.depensesAbsorbees)} de frais non refacturés : sa marge réelle est de ${formatMontant(d.resultatGestionnaire)}, pas de ${formatMontant(d.honoraires)}.</p>`
        : '';
      const noteProprio = d.sens === 'facture' && !avance && d.depenses
        ? `<p class="cp-decompte__note">Le propriétaire règle en plus ${formatMontant(d.depenses)} de frais directement à ses prestataires : il conserve ${formatMontant(d.netProprietaire)}.</p>`
        : '';

      // Ce que le résumé plié doit porter : de quoi DÉCIDER s'il faut
      // ouvrir. Le contrat, le montant du mois, et surtout les factures
      // encore à générer — sinon replier reviendrait à cacher du travail
      // en attente derrière un volet fermé.
      const enAttente = getFacturesByProprietaire(o.id).filter(f => f.statut === 'attente').length;
      const montantResume = d.sens === 'reversement'
        ? `${formatMontant(d.aVerser)} <small>à verser</small>`
        : `${formatMontant(d.aRecevoir)} <small>à recevoir</small>`;

      return `<details class="cp-ownercard" ${ouverts.has(o.id) ? 'open' : ''} data-owner="${o.id}">
        <summary class="cp-ownercard__head">
          <span class="cp-ownercard__chevron" aria-hidden="true">${icon('<path d="m9 18 6-6-6-6"/>')}</span>
          <div class="cp-ownercard__id">
            <b>${o.societe}</b>
            <small>${o.contact} · ${biens.length} bien${biens.length > 1 ? 's' : ''}</small>
            <!-- Les deux termes du contrat sont énoncés comme des faits
                 étiquetés, pas noyés dans la ligne grise du contact :
                 c'est ce qui se lit en premier quand on cherche à savoir
                 sur quelle carte cliquer. -->
            <div class="cp-contrat">
              <span class="cp-contrat__f">
                <em>Encaisse</em>
                <b>${o.encaissement === 'gestionnaire' ? 'Gestionnaire' : 'Propriétaire'}</b>
              </span>
              <span class="cp-contrat__f">
                <em>Rémunération</em>
                <b>${o.remuneration === 'commission' ? `Commission ${Math.round((o.commission || 0) * 100)} %`
                   : o.remuneration === 'forfait' ? `Forfait ${formatMontant(o.forfaitMensuel || 0)}/mois`
                   : `Commission ${Math.round((o.commission || 0) * 100)} % + forfait ${formatMontant(o.forfaitMensuel || 0)}/mois`}</b>
              </span>
              <span class="cp-contrat__f">
                <em>Dépenses</em>
                <b>${o.depensesPayeesPar === 'proprietaire' ? 'Payées par le propriétaire'
                   : (o.refacturerDepenses ? 'Avancées, refacturées' : 'Avancées, non refacturées')}</b>
              </span>
            </div>
          </div>
          <div class="cp-ownercard__resume">
            ${enAttente ? `<span class="badge badge--warning">${enAttente} facture${enAttente > 1 ? 's' : ''} en attente</span>` : ''}
            <span class="badge ${d.sens === 'reversement' ? 'badge--accent' : 'badge--positive'}">${d.sens === 'reversement' ? 'Relevé de reversement' : 'Facture de gestion'}</span>
            <span class="cp-ownercard__montant">${montantResume}</span>
          </div>
        </summary>

        <div class="app-grid app-grid--2" style="margin-bottom:var(--sp-4)">
          <div class="field">
            <label class="field__label">Qui encaisse les réservations ?</label>
            <select class="select" data-encaissement="${o.id}">
              ${Object.entries(ENCAISSEMENT_LABEL).map(([k, v]) => `<option value="${k}" ${o.encaissement === k ? 'selected' : ''}>${v}</option>`).join('')}
            </select>
            <span class="field__hint">${ENCAISSEMENT_DESC[o.encaissement]}</span>
          </div>
          <div class="field">
            <label class="field__label">Comment êtes-vous rémunéré ?</label>
            <select class="select" data-remuneration="${o.id}">
              ${Object.entries(REMUNERATION_LABEL).map(([k, v]) => `<option value="${k}" ${o.remuneration === k ? 'selected' : ''}>${v}</option>`).join('')}
            </select>
            <span class="field__hint">${REMUNERATION_DESC[o.remuneration]}</span>
          </div>
        </div>

        <div class="app-grid app-grid--2" style="margin-bottom:var(--sp-4)">
          <div class="field" ${o.remuneration === 'forfait' ? 'hidden' : ''}>
            <label class="field__label">Commission (%)</label>
            <input class="input" type="number" min="0" max="100" step="1" value="${Math.round(o.commission * 100)}" data-rate="${o.id}" aria-label="Taux de commission (%)">
          </div>
          <div class="field" ${(o.remuneration === 'forfait' || o.remuneration === 'mixte') ? '' : 'hidden'}>
            <label class="field__label">Forfait mensuel (${symboleDevise()})</label>
            <input class="input" type="number" min="0" step="1" value="${montantSaisie(o.forfaitMensuel || 0)}" data-forfait="${o.id}" aria-label="Forfait mensuel (${symboleDevise()})">
          </div>
        </div>

        <div class="app-grid app-grid--2" style="margin-bottom:var(--sp-4)">
          <div class="field">
            <label class="field__label">Qui paie les dépenses ?</label>
            <select class="select" data-payeur="${o.id}">
              ${Object.entries(PAYEUR_LABEL).map(([k, v]) => `<option value="${k}" ${o.depensesPayeesPar === k ? 'selected' : ''}>${v}</option>`).join('')}
            </select>
          </div>
          <div class="field" ${avance ? '' : 'hidden'}>
            <label class="field__label">Refacturer les dépenses au propriétaire ?</label>
            <label class="row gap-2" style="min-height:44px;font-size:var(--fs-sm)">
              <span class="switch"><input type="checkbox" data-refacturer="${o.id}" ${o.refacturerDepenses ? 'checked' : ''}><span class="switch__track"></span></span>
              <span>${o.refacturerDepenses
                ? (o.encaissement === 'gestionnaire' ? 'Déduites du reversement' : 'Ajoutées à la facture')
                : 'Non — elles restent à votre charge'}</span>
            </label>
          </div>
        </div>

        <div class="cp-decompte">
          <p class="cp-decompte__titre">Décompte sur la période affichée</p>
          ${decompte}
          ${noteAbsorbees}
          ${noteProprio}
        </div>

        <div class="cp-months">${months}</div>
      </details>`;
    }).join('');

    /* Le volet ouvert doit survivre au re-rendu : chaque réglage modifié
       reconstruit toute la liste, et sans cette mémoire la carte que l'on
       est en train d'éditer se refermerait à chaque clic. */
    document.querySelectorAll('#cp-owners .cp-ownercard').forEach(el => {
      el.addEventListener('toggle', () => {
        if (el.open) ouverts.add(el.dataset.owner);
        else ouverts.delete(el.dataset.owner);
      });
    });
  }

  document.getElementById('cp-owners').addEventListener('change', e => {
    const enc = e.target.closest('[data-encaissement]');
    if (enc) {
      const o = getProprietaire(enc.dataset.encaissement);
      o.encaissement = enc.value;
      saveOyviaState(); renderOwners(); renderSynthese();
      UI.toast(`${o.societe} — ${ENCAISSEMENT_LABEL[o.encaissement].toLowerCase()}`);
      return;
    }
    const remun = e.target.closest('[data-remuneration]');
    if (remun) {
      const o = getProprietaire(remun.dataset.remuneration);
      o.remuneration = remun.value;
      saveOyviaState(); renderOwners(); renderSynthese();
      UI.toast(`${o.societe} — ${REMUNERATION_LABEL[o.remuneration].toLowerCase()}`);
      return;
    }
    const payeur = e.target.closest('[data-payeur]');
    if (payeur) {
      const o = getProprietaire(payeur.dataset.payeur);
      o.depensesPayeesPar = payeur.value;
      saveOyviaState(); renderOwners(); renderSynthese();
      UI.toast(`${o.societe} — ${PAYEUR_LABEL[o.depensesPayeesPar].toLowerCase()}`);
      return;
    }
    const rate = e.target.closest('[data-rate]');
    if (rate) {
      const o = getProprietaire(rate.dataset.rate);
      const v = Math.min(100, Math.max(0, parseFloat(rate.value) || 0));
      rate.value = v;
      o.commission = v / 100;
      saveOyviaState(); renderOwners(); renderSynthese();
      UI.toast(`Commission de ${o.societe} mise à jour (${v} %)`);
      return;
    }
    const forfaitInput = e.target.closest('[data-forfait]');
    if (forfaitInput) {
      const o = getProprietaire(forfaitInput.dataset.forfait);
      const v = Math.max(0, parseFloat(forfaitInput.value) || 0);
      forfaitInput.value = v;
      o.forfaitMensuel = Math.max(0, lireMontantSaisi(v, o.forfaitMensuel));
      saveOyviaState(); renderOwners(); renderSynthese();
      UI.toast(`Forfait mensuel de ${o.societe} mis à jour`);
      return;
    }
    const refact = e.target.closest('[data-refacturer]');
    if (refact) {
      const o = getProprietaire(refact.dataset.refacturer);
      o.refacturerDepenses = refact.checked;
      saveOyviaState(); renderOwners(); renderSynthese();
      UI.toast(`Refacturation des dépenses ${o.refacturerDepenses ? 'activée' : 'désactivée'} pour ${o.societe}`);
      return;
    }
  });

  document.getElementById('cp-owners').addEventListener('click', e => {
    const btn = e.target.closest('[data-facture]'); if (!btn) return;
    const f = FACTURES.find(x => x.id === btn.dataset.facture);
    if (f.statut === 'attente') {
      if (confirm(`Générer la facture de ${f.mois} pour ${getProprietaire(f.proprietaireId).societe} ?`)) {
        f.statut = 'generee';
        renderOwners();
        renderSynthese();
        downloadFacturePDF(f);
        UI.toast('Facture générée et téléchargée (PDF)');
      }
    } else {
      downloadFacturePDF(f);
      UI.toast('PDF téléchargé');
    }
  });

  /* ============================================================
     DÉPENSES
     ============================================================ */
  const depFilter = document.getElementById('cp-dep-filter');
  const depFilterOwner = document.getElementById('cp-dep-filter-owner');

  depFilterOwner.innerHTML = '<option value="all">Tous les propriétaires</option>' +
    PROPRIETAIRES.map(o => `<option value="${o.id}">${o.societe}</option>`).join('');

  function refreshDepLogementOptions() {
    const ownerId = depFilterOwner.value;
    const biens = ownerId === 'all' ? LOGEMENTS : getLogementsByProprietaire(ownerId);
    const current = depFilter.value;
    depFilter.innerHTML = '<option value="all">Tous les logements</option>' +
      biens.map(l => `<option value="${l.id}">${l.nom}</option>`).join('');
    depFilter.value = biens.some(l => l.id === current) ? current : 'all';
  }
  refreshDepLogementOptions();

  function renderDepenses() {
    const ownerId = depFilterOwner.value;
    const filter = depFilter.value;
    const list = DEPENSES
      .filter(d => filter === 'all' || d.logementId === filter)
      .filter(d => ownerId === 'all' || getLogement(d.logementId).proprietaireId === ownerId)
      .sort((a, b) => b.date.localeCompare(a.date));
    document.getElementById('cp-dep-table').innerHTML = list.length
      ? list.map(d => {
        const l = getLogement(d.logementId);
        const o = getProprietaire(l.proprietaireId);
        const facture = d.factureData
          ? `<button type="button" class="cp-depense__facture" data-view-justificatif="${d.id}">${icon('<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/><circle cx="12" cy="12" r="3"/>')}${d.factureNom || 'Voir'}</button>`
          : d.factureNom
            ? `<span class="text-muted text-xs">${d.factureNom}</span>`
            : '<span class="text-muted text-xs">—</span>';
        return `<tr data-id="${d.id}">
          <td class="text-soft">${formatDate(d.date)}</td>
          <td>${l.nom}</td>
          <td class="text-soft">${o.societe}</td>
          <td>${d.libelle}</td>
          <td class="num money">${formatMontant(d.montant)}</td>
          <td>${facture}</td>
          <td><button class="icon-btn" data-dep-del="${d.id}" aria-label="Supprimer la dépense">${icon('<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/>')}</button></td>
        </tr>`;
      }).join('')
      : '<tr><td colspan="7"><div class="empty"><h4>Aucune dépense</h4><p>Ajoutez une dépense ou élargissez les filtres.</p></div></td></tr>';
  }
  depFilterOwner.addEventListener('change', () => { refreshDepLogementOptions(); renderDepenses(); });
  depFilter.addEventListener('change', renderDepenses);
  document.getElementById('cp-dep-table').addEventListener('click', e => {
    const del = e.target.closest('[data-dep-del]');
    if (del) {
      const idx = DEPENSES.findIndex(d => d.id === del.dataset.depDel);
      if (idx > -1) {
        DEPENSES.splice(idx, 1);
        renderDepenses(); renderSynthese();
        UI.toast('Dépense supprimée');
      }
      return;
    }
    const view = e.target.closest('[data-view-justificatif]');
    if (view) {
      const d = DEPENSES.find(x => x.id === view.dataset.viewJustificatif);
      if (d) openJustificatif(d);
    }
  });

  /* ---------- Modale : visualiser un justificatif ---------- */
  function openJustificatif(d) {
    const body = document.getElementById('cp-just-body');
    const dl = document.getElementById('cp-just-download');
    const mime = (d.factureData || '').match(/^data:([^;]+);/);
    const type = mime ? mime[1] : '';
    if (type.startsWith('image/')) {
      body.innerHTML = `<img src="${d.factureData}" alt="${d.factureNom || 'Justificatif'}" style="max-width:100%;border-radius:var(--r-md);display:block;margin:0 auto" />`;
    } else if (type === 'application/pdf') {
      body.innerHTML = `<iframe src="${d.factureData}" style="width:100%;height:70vh;border:1px solid var(--c-border);border-radius:var(--r-md)"></iframe>`;
    } else {
      body.innerHTML = `<div class="empty"><h4>Aperçu indisponible</h4><p>Ce type de fichier ne peut pas être prévisualisé — téléchargez-le pour le consulter.</p></div>`;
    }
    dl.href = d.factureData;
    dl.download = d.factureNom || 'justificatif';
    document.getElementById('cp-just-title').textContent = d.factureNom || 'Justificatif';
    UI.openPanel('cp-just-modal');
  }

  /* ---------- Modale : ajouter une dépense ---------- */
  let pendingFactureData = null, pendingFactureNom = null;

  function fillDepModal() {
    document.getElementById('cp-f-logement').innerHTML = LOGEMENTS.map(l => `<option value="${l.id}">${l.nom} — ${l.ville}</option>`).join('');
    document.getElementById('cp-f-date').value = AUJOURDHUI;
    // Une dépense constate un paiement déjà fait : elle ne peut pas être
    // datée de demain. On borne donc au jour même.
    DatePicker.attach(document.getElementById('cp-f-date'), () => ({
      max: AUJOURDHUI,
      indispo: d => d > AUJOURDHUI ? "Une dépense ne peut pas être datée dans le futur" : null,
    }));
    document.getElementById('cp-f-montant').value = '';
    document.getElementById('cp-f-libelle').value = '';
    document.getElementById('cp-f-facture').value = '';
    document.getElementById('cp-f-facture-name').textContent = '';
    pendingFactureData = null; pendingFactureNom = null;
  }
  document.getElementById('cp-dep-add').addEventListener('click', () => { fillDepModal(); UI.openPanel('cp-dep-modal'); });

  document.getElementById('cp-f-facture').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) { pendingFactureData = null; pendingFactureNom = null; document.getElementById('cp-f-facture-name').textContent = ''; return; }
    const reader = new FileReader();
    reader.onload = () => {
      pendingFactureData = reader.result;
      pendingFactureNom = file.name;
      document.getElementById('cp-f-facture-name').textContent = file.name;
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('cp-dep-confirm').addEventListener('click', () => {
    const logementId = document.getElementById('cp-f-logement').value;
    const date = document.getElementById('cp-f-date').value;
    // Champ saisi dans la devise d'affichage, stocké en euros.
    const montantAffiche = parseFloat(document.getElementById('cp-f-montant').value);
    const montant = lireMontantSaisi(montantAffiche, null);
    const libelle = document.getElementById('cp-f-libelle').value.trim();
    if (!date) { UI.toast('Choisissez une date', false); return; }
    if (!montantAffiche || montantAffiche <= 0) { UI.toast('Indiquez un montant valide', false); return; }
    if (!libelle) { UI.toast('Indiquez un libellé', false); return; }
    DEPENSES.push({
      id: 'D' + Date.now(), logementId, date, montant, libelle,
      factureNom: pendingFactureNom, factureData: pendingFactureData,
    });
    UI.closeAll();
    renderDepenses(); renderSynthese();
    UI.toast('Dépense ajoutée');
  });

  /* ---------- Rendu initial ---------- */
  renderSynthese();
  renderOwners();
  renderDepenses();
})();
