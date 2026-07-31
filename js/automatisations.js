/* ============================================================
   OYVIA — Automatisations : liste + éditeur de modèle
   ============================================================ */
Layout.init('automatisations');

(function () {
  // {lien_sejour} pointe vers la page voyageur : c'est la façon recommandée de
  // transmettre le code d'accès, plutôt que de l'écrire dans le message.
  const VARS = ['{prenom}', '{date_arrivee}', '{lien_sejour}', '{nom_logement}', '{adresse}', '{code_acces}', '{wifi}'];
  const TRIGGER_IC = {
    reservation:   '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
    avant_arrivee: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    jour_arrivee:  '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="M10 17l5-5-5-5M15 12H3"/>',
    jour_depart:   '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>',
    apres_depart:  '<path d="M12 2l3 6.9 7.6.6-5.8 5 1.8 7.4L12 18l-6.4 3.9 1.8-7.4-5.8-5 7.6-.6z"/>',
  };
  // Modèles de départ : créer une automatisation depuis une page blanche
  // suppose de connaître les variables et les bons horaires. Ces préréglages
  // partent d'un cas d'usage, l'utilisateur n'ajuste que ce qu'il veut.
  const PRESETS = [
    {
      id:'page_sejour', titre:'Envoi de la page séjour',
      desc:"Le lien vers la page voyageur : adresse, code d'accès, Wi-Fi, guide du quartier.",
      ic:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/>',
      a:{ nom:'Envoi de la page séjour', declencheur:'avant_arrivee', jours:1, heure:'10:00',
          modele:"Bonjour {prenom}, votre séjour au {nom_logement} approche ! Toutes les informations pratiques vous attendent ici : {lien_sejour}" },
    },
    {
      id:'rappel_fiche', titre:'Rappel fiche de police',
      desc:"Relance les voyageurs qui n'ont pas encore rempli leur fiche.",
      ic:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>',
      a:{ nom:'Rappel fiche de police', declencheur:'avant_arrivee', jours:3, heure:'11:00',
          modele:"Bonjour {prenom}, pensez à compléter votre fiche de police avant l'arrivée — c'est rapide et ça se fait en ligne : {lien_sejour}" },
    },
    {
      id:'avis', titre:"Demande d'avis",
      desc:"Après le départ, quand le séjour est encore frais.",
      ic:'<path d="M12 2l3 6.9 7.6.6-5.8 5 1.8 7.4L12 18l-6.4 3.9 1.8-7.4-5.8-5 7.6-.6z"/>',
      a:{ nom:"Demande d'avis", declencheur:'apres_depart', jours:1, heure:'11:00',
          modele:"Bonjour {prenom}, merci d'avoir séjourné au {nom_logement} ! Si tout vous a plu, un avis nous aiderait beaucoup." },
    },
    {
      id:'vierge', titre:'Message libre',
      desc:'Partir d\'une page blanche.',
      ic:'<path d="M12 5v14M5 12h14"/>',
      a:{ nom:'Nouvelle automatisation', declencheur:'avant_arrivee', jours:1, heure:'10:00',
          modele:'Bonjour {prenom}, ' },
    },
  ];

  const listView = document.getElementById('auto-list-view');
  const editView = document.getElementById('auto-edit-view');
  const listEl = document.getElementById('auto-list');
  const editEl = document.getElementById('auto-edit-content');
  const icon = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;

  function renderList() {
    listEl.innerHTML = AUTOMATISATIONS.map(a => `
      <div class="auto-item ${a.actif ? '' : 'is-off'}">
        <div class="auto-item__ic">${icon(TRIGGER_IC[a.declencheur])}</div>
        <div class="auto-item__meta">
          <b>${a.nom}</b>
          <div class="auto-item__sub">
            <span class="badge badge--neutral">${libelleDeclencheurCourt(a)}</span>
            <span class="auto-item__quand">${libelleDeclencheur(a)}</span> ·
            <span>Langue ${a.langue}</span> · <span>${a.canaux}</span> ·
            <span>${a.logements === 'tous' ? 'Tous les logements' : 'Sélection de logements'}</span> ·
            <span>${a.envoyes} envoyés</span>
          </div>
        </div>
        <div class="auto-item__actions">
          <span class="badge ${a.actif ? 'badge--positive' : 'badge--neutral'}">${a.actif ? 'Actif' : 'Inactif'}</span>
          <label class="switch" title="Activer/désactiver"><input type="checkbox" ${a.actif ? 'checked' : ''} data-toggle="${a.id}"><span class="switch__track"></span></label>
          <button class="btn btn--secondary btn--sm" data-edit="${a.id}">Modifier</button>
          <button class="icon-btn icon-btn--danger" data-del="${a.id}" title="Supprimer cette automatisation" aria-label="Supprimer ${a.nom}">
            ${icon('<path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V6"/><path d="M10 11v6M14 11v6"/>')}
          </button>
        </div>
      </div>`).join('') || `<div class="empty"><h4>Aucune automatisation</h4><p>Créez-en une pour envoyer vos messages sans y penser.</p></div>`;
  }

  // Aperçu sur une réservation de démonstration : toutes les variables sont
  // résolues, sinon on ne voit pas ce que le voyageur recevra vraiment.
  function sample(text) {
    const l = LOGEMENTS[0];
    const r = getReservationsByLogement(l.id).find(x => x.canal !== 'bloque') || RESERVATIONS[0];
    return text.replace(/{prenom}/g, 'Sophie').replace(/{date_arrivee}/g, '24 juil.')
      .replace(/{code_acces}/g, l.codeAcces).replace(/{wifi}/g, `${l.wifi.ssid} / ${l.wifi.pass}`)
      .replace(/{nom_logement}/g, l.nom).replace(/{adresse}/g, l.adresse)
      .replace(/{lien_sejour}/g, lienSejourAbsolu(r, true));
  }

  function showEdit(id) {
    const a = AUTOMATISATIONS.find(x => x.id === id);
    editEl.innerHTML = `
      <div class="app-pagehead"><div><h1>${a.nom}</h1><p>Programmez le moment de l'envoi et rédigez le message.</p></div>
        <div class="app-pagehead__actions">
          <label class="row gap-2 text-sm fw-medium">Automatisation active <span class="switch"><input type="checkbox" id="auto-active" ${a.actif ? 'checked' : ''}><span class="switch__track"></span></span></label>
        </div>
      </div>
      <div class="app-grid app-grid--2-1">
        <div class="card card--pad">
          <div class="field mb-4"><label class="field__label" for="auto-nom">Nom de l'automatisation</label>
            <input class="input" id="auto-nom" value="${a.nom.replace(/"/g, '&quot;')}" /></div>

          <!-- Bloc de planification : quand part le message. Le décalage et
               l'heure ne s'affichent que s'ils ont un sens pour l'événement. -->
          <p class="eyebrow mb-2">Quand envoyer</p>
          <div class="auto-plan">
            <div class="field"><label class="field__label" for="auto-trig">Événement</label>
              <select class="select" id="auto-trig">${DECLENCHEURS.map(d => `<option value="${d.id}" ${d.id === a.declencheur ? 'selected' : ''}>${d.label}</option>`).join('')}</select></div>
            <div class="field" id="auto-jours-wrap"><label class="field__label" for="auto-jours">Décalage</label>
              <div class="auto-plan__jours">
                <input class="input" id="auto-jours" type="number" min="0" max="60" value="${a.jours}" />
                <span class="text-sm text-muted" id="auto-jours-unit"></span>
              </div></div>
            <div class="field" id="auto-heure-wrap"><label class="field__label" for="auto-heure">Heure d'envoi</label>
              <input class="input" id="auto-heure" type="time" value="${a.heure}" /></div>
          </div>
          <p class="auto-plan__resume" id="auto-resume"></p>

          <div class="app-grid app-grid--2 mt-6">
            <div class="field"><label class="field__label" for="auto-langue">Langue</label>
              <select class="select" id="auto-langue">${['FR','EN','ES','DE'].map(l => `<option ${a.langue === l ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
            <div class="field"><label class="field__label" for="auto-canaux">Canaux</label>
              <select class="select" id="auto-canaux">${['Tous','Airbnb, Booking','Direct','WhatsApp'].map(c => `<option ${a.canaux === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
          </div>
          <div class="field mt-4"><label class="field__label" for="auto-logements">Logements concernés</label>
            <select class="select" id="auto-logements">
              <option value="tous" ${a.logements === 'tous' ? 'selected' : ''}>Tous les logements</option>
              <option value="selection" ${a.logements !== 'tous' ? 'selected' : ''}>Sélection de logements</option>
            </select></div>
          <div class="field" style="margin-top:var(--sp-4)"><label class="field__label">Message</label>
            <textarea class="textarea" id="auto-model" rows="7">${a.modele}</textarea></div>
          <p class="field__hint" style="margin-top:var(--sp-3)">Variables disponibles — cliquez pour insérer :</p>
          <div class="auto-vars" style="margin-top:var(--sp-2)">${VARS.map(v => `<span class="auto-var" data-var="${v}">${v}</span>`).join('')}</div>
          <div class="row gap-2" style="margin-top:var(--sp-5)">
            <button class="btn btn--primary" id="auto-save">Enregistrer</button>
            <button class="btn btn--secondary" id="auto-cancel">Annuler</button>
          </div>
        </div>
        <div>
          <div class="card card--pad">
            <p class="eyebrow mb-4">Aperçu</p>
            <div class="auto-preview" id="auto-prev">${sample(a.modele)}</div>
            <p class="field__hint" style="margin-top:var(--sp-3)">Exemple avec un séjour de démonstration au ${LOGEMENTS[0].nom}.</p>
          </div>

          <!-- Le panneau n'apparaît que si le message envoie effectivement la
               page : il serait hors sujet sur un simple rappel de départ. -->
          <div class="card card--pad mt-4 ${a.modele.includes('{lien_sejour}') ? '' : 'hidden'}" id="auto-page-card">
            <p class="eyebrow mb-2">Contenu de la page séjour</p>
            <p class="field__hint mb-4">Ces réglages s'appliquent à la page elle-même, donc à toutes les automatisations qui l'envoient.</p>
            <div class="auto-blocs">
              ${BLOCS_PAGE_SEJOUR.map(b => `
                <label class="auto-bloc ${blocPageSejourActif(b.id) ? 'is-on' : ''}">
                  <input type="checkbox" data-bloc="${b.id}" ${blocPageSejourActif(b.id) ? 'checked' : ''} />
                  <span><b>${b.label}</b><small>${b.desc}</small></span>
                </label>`).join('')}
            </div>

            <div class="field mt-4"><label class="field__label" for="auto-accueil">Mot d'accueil</label>
              <textarea class="textarea" id="auto-accueil" rows="3" ${blocPageSejourActif('accueil') ? '' : 'disabled'}>${PAGE_SEJOUR.messageAccueil}</textarea></div>

            <div class="field mt-4"><label class="field__label" for="auto-jcode">Afficher le code d'accès et le Wi-Fi</label>
              <select class="select" id="auto-jcode">
                ${[0, 1, 2, 3, 7].map(n => `<option value="${n}" ${PAGE_SEJOUR.joursAvantCode === n ? 'selected' : ''}>${n === 0 ? 'Dès l\'ouverture de la page' : n === 1 ? "La veille de l'arrivée" : `${n} jours avant l'arrivée`}</option>`).join('')}
              </select>
              <span class="field__hint" id="auto-jcode-hint"></span></div>

            <a class="btn btn--secondary btn--block mt-4" id="auto-preview-page" target="_blank" rel="noopener">Prévisualiser la page séjour ↗</a>
          </div>
        </div>
      </div>`;

    const ta = editEl.querySelector('#auto-model');
    const prev = editEl.querySelector('#auto-prev');
    const carteePage = editEl.querySelector('#auto-page-card');
    const refresh = () => {
      prev.textContent = sample(ta.value);
      // Le panneau suit le contenu : insérer {lien_sejour} le fait apparaître.
      carteePage.classList.toggle('hidden', !ta.value.includes('{lien_sejour}'));
    };
    ta.addEventListener('input', refresh);

    /* ---------- Contenu de la page séjour (config partagée) ---------- */
    const majHintCode = () => {
      const n = parseInt(editEl.querySelector('#auto-jcode').value, 10);
      editEl.querySelector('#auto-jcode-hint').textContent = n === 0
        ? "Le code sera lisible dès que le voyageur ouvrira le lien."
        : `Avant cette date, la page affiche tout sauf le code et le Wi-Fi. Utile si vous envoyez le lien longtemps à l'avance.`;
    };
    editEl.querySelectorAll('[data-bloc]').forEach(cb => cb.addEventListener('change', () => {
      const id = cb.dataset.bloc;
      const i = PAGE_SEJOUR.blocs.indexOf(id);
      if (cb.checked && i === -1) PAGE_SEJOUR.blocs.push(id);
      if (!cb.checked && i > -1) PAGE_SEJOUR.blocs.splice(i, 1);
      cb.closest('.auto-bloc').classList.toggle('is-on', cb.checked);
      if (id === 'accueil') editEl.querySelector('#auto-accueil').disabled = !cb.checked;
      if (typeof saveOyviaState === 'function') saveOyviaState();
    }));
    editEl.querySelector('#auto-accueil').addEventListener('input', e => {
      PAGE_SEJOUR.messageAccueil = e.target.value;
      if (typeof saveOyviaState === 'function') saveOyviaState();
    });
    editEl.querySelector('#auto-jcode').addEventListener('change', e => {
      PAGE_SEJOUR.joursAvantCode = parseInt(e.target.value, 10);
      majHintCode();
      if (typeof saveOyviaState === 'function') saveOyviaState();
    });
    majHintCode();
    // La prévisualisation utilise une vraie réservation en cours, pour que la
    // fenêtre de validité du lien ne bloque pas l'aperçu.
    (() => {
      const rDemo = RESERVATIONS.find(x => x.canal !== 'bloque' && lienSejourStatut(x).actif) || RESERVATIONS[0];
      editEl.querySelector('#auto-preview-page').href = lienSejour(rDemo, true);
    })();

    /* ---------- Planification ---------- */
    const selTrig  = editEl.querySelector('#auto-trig');
    const inJours  = editEl.querySelector('#auto-jours');
    const inHeure  = editEl.querySelector('#auto-heure');
    const wrapJ    = editEl.querySelector('#auto-jours-wrap');
    const wrapH    = editEl.querySelector('#auto-heure-wrap');
    const unit     = editEl.querySelector('#auto-jours-unit');
    const resume   = editEl.querySelector('#auto-resume');

    // L'état courant du formulaire, pour calculer le résumé sans avoir
    // encore enregistré quoi que ce soit.
    const brouillon = () => ({
      declencheur: selTrig.value,
      jours: parseInt(inJours.value, 10) || 0,
      heure: inHeure.value || '10:00',
    });

    function majPlanification() {
      const d = getDeclencheur(selTrig.value);
      // Un décalage n'a de sens que pour « avant l'arrivée » et « après le
      // départ » ; une heure n'en a pas pour un envoi immédiat.
      wrapJ.classList.toggle('hidden', !d.decalable);
      wrapH.classList.toggle('hidden', !!d.immediat);
      unit.textContent = selTrig.value === 'avant_arrivee' ? "jour(s) avant l'arrivée" : 'jour(s) après le départ';
      if (d.decalable && (parseInt(inJours.value, 10) || 0) < 1) inJours.value = 1;
      resume.textContent = libelleDeclencheur(brouillon());
    }
    [selTrig, inJours, inHeure].forEach(el => el.addEventListener('input', majPlanification));
    majPlanification();

    editEl.querySelectorAll('.auto-var').forEach(v => v.addEventListener('click', () => {
      const pos = ta.selectionStart;
      ta.value = ta.value.slice(0, pos) + v.dataset.var + ta.value.slice(ta.selectionEnd);
      ta.focus(); refresh();
    }));
    editEl.querySelector('#auto-save').addEventListener('click', () => {
      const nom = editEl.querySelector('#auto-nom').value.trim();
      if (!nom) { UI.toast("Donnez un nom à l'automatisation", false); return; }
      const b = brouillon();
      Object.assign(a, {
        nom, modele: ta.value,
        actif: editEl.querySelector('#auto-active').checked,
        declencheur: b.declencheur,
        // Un déclencheur non décalable ne conserve pas d'ancien décalage.
        jours: getDeclencheur(b.declencheur).decalable ? b.jours : 0,
        heure: b.heure,
        langue: editEl.querySelector('#auto-langue').value,
        canaux: editEl.querySelector('#auto-canaux').value,
        logements: editEl.querySelector('#auto-logements').value,
      });
      if (typeof saveOyviaState === 'function') saveOyviaState();
      backToList(); UI.toast(`Enregistrée — ${libelleDeclencheur(a).toLowerCase()}`);
    });
    editEl.querySelector('#auto-cancel').addEventListener('click', backToList);

    listView.classList.add('hidden'); editView.classList.remove('hidden'); window.scrollTo(0, 0);
  }

  function backToList() { editView.classList.add('hidden'); listView.classList.remove('hidden'); renderList(); }

  listEl.addEventListener('click', e => {
    const edit = e.target.closest('[data-edit]'); if (edit) { showEdit(edit.dataset.edit); return; }

    const del = e.target.closest('[data-del]');
    if (del) {
      const a = AUTOMATISATIONS.find(x => x.id === del.dataset.del);
      if (!a) return;
      // On rappelle le volume déjà traité : supprimer une automatisation qui
      // tourne depuis des mois n'a pas le même poids qu'en supprimer une
      // créée par erreur cinq minutes plus tôt.
      const historique = a.envoyes
        ? `\n\nElle a déjà envoyé ${a.envoyes} messages. L'historique des envois passés est conservé, mais plus aucun message ne partira.`
        : '';
      UI.confirm({
        title: `Supprimer « ${a.nom} » ?`,
        message: `Cette automatisation sera définitivement retirée.${historique}\n\nPour l'interrompre sans la perdre, désactivez-la plutôt avec l'interrupteur.`,
        confirmText: 'Supprimer',
        cancelText: 'Annuler',
        danger: true,
        onConfirm() {
          supprimerEntite('AUTOMATISATIONS', a.id);
          renderList();
          UI.toast(`« ${a.nom} » supprimée`);
        },
      });
    }
  });
  listEl.addEventListener('change', e => {
    const t = e.target.closest('[data-toggle]'); if (t) {
      const a = AUTOMATISATIONS.find(x => x.id === t.dataset.toggle);
      a.actif = t.checked; UI.toast(a.actif ? 'Automatisation activée' : 'Automatisation désactivée');
      renderList();
    }
  });
  document.getElementById('auto-back').addEventListener('click', backToList);

  /* ---------- Création : on choisit d'abord un modèle de départ ---------- */
  const modalNew = document.getElementById('auto-new-modal');
  document.getElementById('auto-preset-list').innerHTML = PRESETS.map(pr => `
    <button type="button" class="auto-preset" data-preset="${pr.id}">
      <span class="auto-preset__ic">${icon(pr.ic)}</span>
      <span class="grow"><b>${pr.titre}</b><small>${pr.desc}</small></span>
      <span class="auto-preset__quand">${libelleDeclencheurCourt(pr.a)}</span>
    </button>`).join('');

  document.getElementById('auto-new').addEventListener('click', () => UI.openPanel('auto-new-modal'));

  modalNew.addEventListener('click', e => {
    const b = e.target.closest('[data-preset]'); if (!b) return;
    const pr = PRESETS.find(x => x.id === b.dataset.preset);
    const a = {
      id: 'A' + Date.now(),
      actif: false, langue: 'FR', canaux: 'Tous', logements: 'tous', envoyes: 0,
      ...pr.a,
    };
    AUTOMATISATIONS.push(a);
    UI.closeAll();
    showEdit(a.id);
  });

  renderList();
})();
