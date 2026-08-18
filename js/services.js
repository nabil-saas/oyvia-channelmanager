/* ============================================================
   OYVIA — Services additionnels (Vente directe)

   Ce que l'hôte vend en plus de la nuitée. C'est la marge la plus
   rentable du métier : aucune commission d'OTA à reverser, et le
   voyageur est déjà acquis — il ne reste qu'à lui proposer.

   Le point délicat du paramétrage est l'UNITÉ de facturation, et
   l'écran insiste dessus : un transfert se paie par trajet, un
   petit-déjeuner par personne et par jour, un lit d'appoint par
   séjour. Se tromper d'unité, ce n'est pas une imprécision, c'est
   facturer dix fois trop cher ou dix fois trop peu. D'où l'aperçu
   chiffré sous le formulaire, sur un séjour type.
   ============================================================ */
Layout.init('services');

(function () {
  const ic = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  const ICO_EDIT = '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>';
  const ICO_DEL  = '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6"/>';

  // Séjour de référence pour l'aperçu : 4 nuits, 2 voyageurs. Assez court
  // pour rester lisible, assez long pour que l'unité se voie.
  const EX_NUITS = 4, EX_PERS = 2;

  let editId = null;
  const F = id => document.getElementById(id);

  // Ce que coûte le service sur le séjour de référence, selon son unité.
  function totalExemple(prix, unite) {
    switch (unite) {
      case 'personne':      return prix * EX_PERS;
      case 'personne_jour': return prix * EX_PERS * EX_NUITS;
      case 'nuit':          return prix * EX_NUITS;
      default:              return prix;   // séjour, trajet, unité, heure
    }
  }

  /* ---------- Compteurs ---------- */
  function renderKpis() {
    const actifs = servicesActifs();
    const panier = actifs.reduce((s, x) => s + totalExemple(x.prix, x.unite), 0);
    const marge = actifs.reduce((s, x) => s + totalExemple(x.prix, x.unite) * (x.marge || 0) / 100, 0);
    const kpi = (label, valeur, pied, icone) => `
      <div class="kpi"><div class="kpi__label">${label}</div><div class="kpi__value">${valeur}</div>
      <div class="kpi__foot">${pied}</div><div class="kpi__icon">${ic(icone)}</div></div>`;
    F('sv-kpis').innerHTML = [
      kpi('Services proposés', `${actifs.length}<span class="kpi__sur">/${SERVICES.length}</span>`,
        `${SERVICES.length - actifs.length} désactivés`, '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>'),
      kpi('Panier maximum', formatMontant(panier), `si tout est pris sur ${EX_NUITS} nuits, ${EX_PERS} voyageurs`,
        '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>'),
      kpi('Marge sur ce panier', formatMontant(marge), 'hors commission de plateforme',
        '<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>'),
      kpi('Catégories', servicesParCategorie().length, 'Arrivée, confort, restauration…',
        '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>'),
    ].join('');
  }

  /* ---------- Liste, groupée par catégorie ---------- */
  function renderListe() {
    F('sv-liste').innerHTML = servicesParCategorie().map(g => `
      <div class="card card--pad mb-4">
        <div class="row-between mb-4">
          <p class="eyebrow">${g.label}</p>
          <span class="text-xs text-muted">${g.items.filter(s => s.actif).length} / ${g.items.length} proposés</span>
        </div>
        ${g.items.map(s => `
          <div class="sv-item ${s.actif ? '' : 'is-off'}" data-id="${s.id}">
            <div class="sv-item__meta grow">
              <b>${s.nom}</b>
              <small>${s.desc}</small>
              <div class="sv-item__tags">
                <span class="sv-tag">${s.prix ? formatMontant(s.prix) : 'Offert'} ${SERVICES_UNITES[s.unite]}</span>
                <span class="sv-tag sv-tag--muted">${s.delaiPrevenance} h de prévenance</span>
                ${s.prestataire ? `<span class="sv-tag sv-tag--muted">${s.prestataire}</span>` : '<span class="sv-tag sv-tag--muted">En interne</span>'}
                ${(() => { const p = porteeService(s);
                  return `<span class="sv-tag ${p.tous ? 'sv-tag--muted' : (p.ids.length ? 'sv-tag--portee' : 'sv-tag--vide')}"
                    title="${p.tous ? 'Tout le parc' : p.ids.map(id => getLogement(id).nom).join(', ') || 'Aucun logement sélectionné'}">${p.label}</span>`; })()}
                ${s.prix ? `<span class="sv-tag sv-tag--muted">marge ${s.marge} %</span>` : ''}
              </div>
            </div>
            <label class="switch" title="${s.actif ? 'Ne plus proposer' : 'Proposer aux voyageurs'}">
              <input type="checkbox" data-toggle="${s.id}" ${s.actif ? 'checked' : ''}><span class="switch__track"></span>
            </label>
            <button class="icon-btn" data-edit="${s.id}" aria-label="Modifier">${ic(ICO_EDIT)}</button>
            <button class="icon-btn icon-btn--danger" data-del="${s.id}" aria-label="Supprimer">${ic(ICO_DEL)}</button>
          </div>`).join('')}
      </div>`).join('');
  }

  function render() { renderKpis(); renderListe(); }

  /* ---------- Formulaire ---------- */
  F('sv-f-cat').innerHTML = Object.entries(SERVICES_CATEGORIES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
  F('sv-f-unite').innerHTML = Object.entries(SERVICES_UNITES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');

  // L'aperçu est le garde-fou contre l'erreur d'unité : il montre ce que le
  // voyageur paiera réellement, pas ce qui est écrit dans la case prix.
  function majApercu() {
    const prix = Number(F('sv-f-prix').value) || 0;
    const unite = F('sv-f-unite').value;
    const total = totalExemple(prix, unite);
    const marge = Math.round(total * (Number(F('sv-f-marge').value) || 0) / 100);
    F('sv-f-apercu').innerHTML = prix
      ? `Sur un séjour de ${EX_NUITS} nuits à ${EX_PERS} voyageurs, le voyageur paie <b>${formatMontant(total)}</b>, dont <b>${formatMontant(marge)}</b> pour vous.`
      : 'Service offert : aucun montant facturé au voyageur.';
  }
  ['sv-f-prix', 'sv-f-unite', 'sv-f-marge'].forEach(id => {
    F(id).addEventListener('input', majApercu);
    F(id).addEventListener('change', majApercu);
  });

  /* Cases à cocher des logements. On les rend à chaque ouverture plutôt qu'une
     fois pour toutes : le parc peut avoir changé depuis le dernier passage. */
  function renderLogements(selection) {
    F('sv-f-logements').innerHTML = LOGEMENTS.map(l => `
      <label class="sv-logement">
        <input type="checkbox" value="${l.id}" ${selection.includes(l.id) ? 'checked' : ''} />
        <span><b>${l.nom}</b><small>${l.ville}</small></span>
      </label>`).join('')
      + `<div class="sv-logements__actions">
           <button type="button" class="btn btn--ghost btn--sm" data-tout="1">Tout cocher</button>
           <button type="button" class="btn btn--ghost btn--sm" data-tout="0">Tout décocher</button>
         </div>`;
  }
  function majPortee() {
    const selection = document.querySelector('input[name="sv-f-portee"]:checked').value === 'selection';
    F('sv-f-logements').classList.toggle('hidden', !selection);
  }
  document.querySelectorAll('input[name="sv-f-portee"]').forEach(r => r.addEventListener('change', majPortee));
  F('sv-f-logements').addEventListener('click', e => {
    const b = e.target.closest('[data-tout]');
    if (!b) return;
    const cocher = b.dataset.tout === '1';
    F('sv-f-logements').querySelectorAll('input[type="checkbox"]').forEach(c => { c.checked = cocher; });
  });

  function ouvrir(id) {
    editId = id || null;
    const s = id ? getService(id) : null;
    F('sv-f-nom').value = s ? s.nom : '';
    F('sv-f-cat').value = s ? s.categorie : 'confort';
    F('sv-f-desc').value = s ? s.desc : '';
    F('sv-f-prix').value = s ? s.prix : 0;
    F('sv-f-unite').value = s ? s.unite : 'sejour';
    F('sv-f-marge').value = s ? s.marge : 100;
    F('sv-f-delai').value = s ? s.delaiPrevenance : 24;
    F('sv-f-prest').value = s && s.prestataire ? s.prestataire : '';
    F('sv-f-actif').checked = s ? s.actif : true;
    const p = porteeService(s);
    document.querySelector(`input[name="sv-f-portee"][value="${!s || p.tous ? 'tous' : 'selection'}"]`).checked = true;
    renderLogements(p.tous ? [] : p.ids);
    majPortee();
    F('sv-modal-title').textContent = s ? `Modifier — ${s.nom}` : 'Nouveau service';
    majApercu();
    UI.openPanel('sv-modal');
  }

  F('sv-add').addEventListener('click', () => ouvrir(null));

  F('sv-save').addEventListener('click', () => {
    const nom = F('sv-f-nom').value.trim();
    if (!nom) { UI.toast('Donnez un nom au service', false); return; }

    const surSelection = document.querySelector('input[name="sv-f-portee"]:checked').value === 'selection';
    const coches = [...F('sv-f-logements').querySelectorAll('input[type="checkbox"]:checked')].map(c => c.value);
    // Un service restreint à zéro logement ne serait proposable nulle part :
    // il serait « actif » à l'écran et invisible partout ailleurs.
    if (surSelection && !coches.length) { UI.toast('Choisissez au moins un logement, ou passez sur « Tous »', false); return; }
    const portee = surSelection ? coches : 'tous';
    const data = {
      nom, categorie: F('sv-f-cat').value, desc: F('sv-f-desc').value.trim(),
      prix: Math.max(0, Number(F('sv-f-prix').value) || 0),
      unite: F('sv-f-unite').value,
      marge: Math.max(0, Math.min(100, Number(F('sv-f-marge').value) || 0)),
      delaiPrevenance: Math.max(0, parseInt(F('sv-f-delai').value, 10) || 0),
      prestataire: F('sv-f-prest').value.trim() || null,
      actif: F('sv-f-actif').checked,
      logements: portee,
    };
    if (editId) Object.assign(getService(editId), data);
    else SERVICES.push({ id: 'SV' + Date.now(), ...data });
    saveOyviaState(); UI.closeAll(); render();
    UI.toast(editId ? 'Service modifié' : 'Service créé');
  });

  /* ---------- Interactions ---------- */
  F('sv-liste').addEventListener('click', e => {
    const ed = e.target.closest('[data-edit]');
    const del = e.target.closest('[data-del]');
    if (ed) { ouvrir(ed.dataset.edit); return; }
    if (del) {
      const s = getService(del.dataset.del);
      UI.confirm({
        title: `Supprimer « ${s.nom} » ?`,
        message: "Le service disparaît du catalogue. Si vous voulez seulement cesser de le proposer, désactivez-le plutôt : le paramétrage sera conservé.",
        confirmText: 'Supprimer', danger: true,
        onConfirm: () => {
          const i = SERVICES.findIndex(x => x.id === del.dataset.del);
          if (i > -1) SERVICES.splice(i, 1);
          saveOyviaState(); render(); UI.toast('Service supprimé');
        },
      });
    }
  });

  F('sv-liste').addEventListener('change', e => {
    const t = e.target.closest('[data-toggle]');
    if (!t) return;
    const s = getService(t.dataset.toggle);
    s.actif = t.checked;
    saveOyviaState(); render();
    UI.toast(s.actif ? `${s.nom} proposé aux voyageurs` : `${s.nom} retiré du catalogue`);
  });

  render();
})();
