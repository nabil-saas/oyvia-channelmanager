/* ============================================================
   OYVIA — Comptabilité : synthèse par propriétaire, facturation
   et dépenses par logement.

   Chaque propriétaire a son propre modèle de facturation
   (voir MODE_FACTURATION_LABEL / MODE_FACTURATION_DESC dans data.js) :
     - reversement : la conciergerie encaisse le CA, prélève sa
       commission + les dépenses, puis reverse le net au propriétaire.
     - commission  : le propriétaire encaisse directement le CA ; la
       conciergerie lui facture sa commission (+ dépenses si refacturées).
     - forfait     : abonnement mensuel fixe, indépendant du CA.
     - mixte       : commission + forfait fixe, dépenses refacturées à part.
   Dans tous les cas, « Net propriétaire » = CA − (tout ce qui est
   facturé/déduit) ; seul le sens du flux (qui paie qui) change.
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

  /* ============================================================
     SYNTHÈSE COMPTABLE
     ============================================================ */
  const ownerSel = document.getElementById('cp-owner');
  const fromField = document.getElementById('cp-from');
  const toField = document.getElementById('cp-to');

  ownerSel.innerHTML = '<option value="all">Tous les propriétaires</option>' +
    PROPRIETAIRES.map(o => `<option value="${o.id}">${o.societe}</option>`).join('');

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

  // Applique le modèle de facturation du propriétaire à son CA/dépenses
  // sur la période, et renvoie le détail de sa facture.
  function computeFacture(o, ca, depenses, nbJours) {
    const mode = o.modeFacturation;
    const commission = mode === 'forfait' ? 0 : ca * o.commission;
    const forfait = (mode === 'forfait' || mode === 'mixte') ? (o.forfaitMensuel || 0) * (nbJours / 30) : 0;
    const depensesFacturees = o.refacturerDepenses ? depenses : 0;
    const factureMontant = commission + forfait + depensesFacturees;
    const net = ca - factureMontant;
    return { mode, commission, forfait, depensesFacturees, factureMontant, net };
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

    let ca = 0, depenses = 0, commission = 0, forfait = 0, depensesFacturees = 0, factureMontant = 0, net = 0;
    const facturesParProprio = [];
    Object.keys(byOwner).forEach(oid => {
      const o = getProprietaire(oid);
      const g = byOwner[oid];
      const f = computeFacture(o, g.ca, g.depenses, nbJours);
      ca += g.ca; depenses += g.depenses;
      commission += f.commission; forfait += f.forfait; depensesFacturees += f.depensesFacturees;
      factureMontant += f.factureMontant; net += f.net;
      facturesParProprio.push({ proprietaire: o, ca: g.ca, depenses: g.depenses, ...f });
      // Répartit la commission par logement (utile pour le tableau de détail).
      biens.filter(l => l.proprietaireId === oid).forEach(l => {
        if (o.modeFacturation !== 'forfait') perLogement[l.id].commission = perLogement[l.id].ca * o.commission;
      });
    });

    return { rows: Object.values(perLogement), ca, depenses, commission, forfait, depensesFacturees, factureMontant, net, facturesParProprio };
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
      el.textContent = `Modèle « ${MODE_FACTURATION_LABEL[o.modeFacturation]} » — ${MODE_FACTURATION_DESC[o.modeFacturation]}`;
    } else {
      const modes = new Set(data.facturesParProprio.map(f => f.mode));
      el.textContent = modes.size > 1
        ? 'Vue consolidée : chaque propriétaire a son propre modèle de facturation (voir l\'onglet Facturation).'
        : (data.facturesParProprio[0] ? `Tous les propriétaires visibles utilisent le modèle « ${MODE_FACTURATION_LABEL[data.facturesParProprio[0].mode]} ».` : '');
    }
  }

  function renderKPIs(data, ownerId) {
    const o = ownerId !== 'all' ? getProprietaire(ownerId) : null;
    const factureFoot = o
      ? (o.modeFacturation === 'forfait' ? `forfait ${formatEuro(o.forfaitMensuel)}/mois`
        : o.modeFacturation === 'mixte' ? `${Math.round(o.commission * 100)} % + forfait ${formatEuro(o.forfaitMensuel)}/mois`
        : `taux ${Math.round(o.commission * 100)} %`)
      : `${data.facturesParProprio.length} propriétaire${data.facturesParProprio.length > 1 ? 's' : ''}`;
    let depFoot;
    if (!data.depenses) depFoot = 'aucune dépense sur la période';
    else if (data.depensesFacturees >= data.depenses) depFoot = 'intégralement refacturées / déduites';
    else if (!data.depensesFacturees) depFoot = 'prises en charge par la conciergerie';
    else depFoot = `dont ${formatEuro(data.depensesFacturees)} refacturées`;
    const netFoot = o
      ? (o.modeFacturation === 'reversement' ? 'reversé par la conciergerie' : 'conservé par le propriétaire (après facture)')
      : 'selon le modèle de chaque propriétaire';

    const KPIS = [
      { label: 'CA généré', value: formatEuro(data.ca), foot: `${data.rows.length} logement${data.rows.length > 1 ? 's' : ''}`,
        ic: icon('<path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>') },
      { label: 'Facturé au propriétaire', value: formatEuro(data.factureMontant), foot: factureFoot,
        ic: icon('<line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>') },
      { label: 'Dépenses', value: formatEuro(data.depenses), foot: depFoot,
        ic: icon('<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-2.4z"/>') },
      { label: 'Net propriétaire', value: formatEuro(data.net), foot: netFoot,
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
        <span><i class="cp-dot cp-dot--comm"></i>Commission & forfait — ${formatEuro(data.commission + data.forfait)}</span>
        <span><i class="cp-dot cp-dot--dep"></i>Dépenses refacturées — ${formatEuro(data.depensesFacturees)}</span>
        <span><i class="cp-dot cp-dot--net"></i>Net propriétaire — ${formatEuro(data.net)}</span>
      </div>`;
  }

  function renderSynthTable(data) {
    document.getElementById('cp-synth-table').innerHTML = data.rows.length
      ? data.rows.map(r => `
        <tr>
          <td class="fw-semibold">${r.logement.nom}</td>
          <td class="num money">${formatEuro(r.ca)}</td>
          <td class="num text-soft">${r.depenses ? '− ' + formatEuro(r.depenses) : '—'}</td>
          <td class="num money fw-semibold">${formatEuro(r.commission || 0)}</td>
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
    return { o, mois: f.mois, from, to, ca, depenses, ...computeFacture(o, ca, depenses, nbJours) };
  }

  // Génère un vrai PDF (jsPDF) reprenant le détail de la facture/relevé
  // du propriétaire pour le mois donné, et déclenche son téléchargement.
  function downloadFacturePDF(f) {
    const d = buildFactureData(f);
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const isReversement = d.mode === 'reversement';
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
    doc.text(`Modèle : ${MODE_FACTURATION_LABEL[d.mode]}`, 120, y + 6);

    y += 24;
    doc.setDrawColor(225, 225, 225); doc.line(14, y, 196, y);
    y += 4;

    // Tableau des lignes
    const rows = [];
    rows.push(['Chiffre d\'affaires encaissé sur la période', formatEuro(d.ca)]);
    if (d.mode !== 'forfait') rows.push([`Commission (${Math.round(d.o.commission * 100)} %)`, formatEuro(d.commission)]);
    if (d.mode === 'forfait' || d.mode === 'mixte') rows.push(['Forfait mensuel', formatEuro(d.forfait)]);
    if (d.depensesFacturees) rows.push(['Dépenses refacturées', formatEuro(d.depensesFacturees)]);

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
    doc.text(formatEuro(isReversement ? d.net : d.factureMontant), 190, y + 1.5, { align: 'right' });

    y += 24;
    doc.setFontSize(9); doc.setTextColor(140, 140, 140); doc.setFont('helvetica', 'normal');
    doc.text(isReversement
      ? `Net = CA (${formatEuro(d.ca)}) − commission${d.depensesFacturees ? ' − dépenses' : ''}.`
      : `Net conservé par le propriétaire après facture : ${formatEuro(d.net)}.`, 14, y);

    doc.setFontSize(8); doc.setTextColor(170, 170, 170);
    doc.text('Document généré automatiquement par Oyvia — mockup de démonstration.', 14, 285);

    doc.save(`${isReversement ? 'releve' : 'facture'}-${slugify(d.o.societe)}-${slugify(f.mois)}.pdf`);
  }

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
      const mode = o.modeFacturation;
      return `<div class="cp-ownercard">
        <div class="cp-ownercard__head">
          <div class="cp-ownercard__id"><b>${o.societe}</b><small>${o.contact} · ${biens.length} bien${biens.length > 1 ? 's' : ''}</small></div>
        </div>
        <div class="app-grid app-grid--3" style="margin-bottom:var(--sp-4)">
          <div class="field">
            <label class="field__label">Type de facturation</label>
            <select class="select" data-mode="${o.id}">
              ${Object.entries(MODE_FACTURATION_LABEL).map(([k, v]) => `<option value="${k}" ${mode === k ? 'selected' : ''}>${v}</option>`).join('')}
            </select>
          </div>
          <div class="field" ${mode === 'forfait' ? 'style="display:none"' : ''}>
            <label class="field__label">Commission (%)</label>
            <input class="input" type="number" min="0" max="100" step="1" value="${Math.round(o.commission * 100)}" data-rate="${o.id}" aria-label="Taux de commission (%)">
          </div>
          <div class="field" ${(mode === 'forfait' || mode === 'mixte') ? '' : 'style="display:none"'}>
            <label class="field__label">Forfait mensuel (€)</label>
            <input class="input" type="number" min="0" step="1" value="${o.forfaitMensuel || 0}" data-forfait="${o.id}" aria-label="Forfait mensuel (€)">
          </div>
        </div>
        <label class="row gap-2 mb-4" style="font-size:var(--fs-sm)">
          <input type="checkbox" data-refacturer="${o.id}" ${o.refacturerDepenses ? 'checked' : ''}> ${mode === 'reversement' ? 'Déduire les dépenses du montant reversé' : 'Refacturer les dépenses au propriétaire'}
        </label>
        <p class="text-xs text-muted mb-4">${MODE_FACTURATION_DESC[mode]}</p>
        <div class="cp-months">${months}</div>
      </div>`;
    }).join('');
  }

  document.getElementById('cp-owners').addEventListener('change', e => {
    const modeSel = e.target.closest('[data-mode]');
    if (modeSel) {
      const o = getProprietaire(modeSel.dataset.mode);
      o.modeFacturation = modeSel.value;
      renderOwners();
      renderSynthese();
      UI.toast(`Modèle de facturation de ${o.societe} : ${MODE_FACTURATION_LABEL[o.modeFacturation]}`);
      return;
    }
    const rate = e.target.closest('[data-rate]');
    if (rate) {
      const o = getProprietaire(rate.dataset.rate);
      const v = Math.min(100, Math.max(0, parseFloat(rate.value) || 0));
      rate.value = v;
      o.commission = v / 100;
      UI.toast(`Commission de ${o.societe} mise à jour (${v} %)`);
      renderSynthese();
      return;
    }
    const forfaitInput = e.target.closest('[data-forfait]');
    if (forfaitInput) {
      const o = getProprietaire(forfaitInput.dataset.forfait);
      const v = Math.max(0, parseFloat(forfaitInput.value) || 0);
      forfaitInput.value = v;
      o.forfaitMensuel = v;
      UI.toast(`Forfait mensuel de ${o.societe} mis à jour`);
      renderSynthese();
      return;
    }
    const refact = e.target.closest('[data-refacturer]');
    if (refact) {
      const o = getProprietaire(refact.dataset.refacturer);
      o.refacturerDepenses = refact.checked;
      UI.toast(`Refacturation des dépenses ${o.refacturerDepenses ? 'activée' : 'désactivée'} pour ${o.societe}`);
      renderSynthese();
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
          <td class="num money">${formatEuro(d.montant)}</td>
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
    const montant = parseFloat(document.getElementById('cp-f-montant').value);
    const libelle = document.getElementById('cp-f-libelle').value.trim();
    if (!date) { UI.toast('Choisissez une date', false); return; }
    if (!montant || montant <= 0) { UI.toast('Indiquez un montant valide', false); return; }
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
