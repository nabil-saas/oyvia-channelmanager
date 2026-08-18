/* ============================================================
   OYVIA — Fiches de police

   Obligation légale, pas confort produit : l'hébergeur doit faire
   remplir une fiche individuelle à chaque voyageur étranger, la
   conserver six mois et la tenir à disposition des autorités. Elle
   doit être complétée AVANT l'arrivée — d'où la surveillance des
   échéances, en haut de page comme dans les règles d'alerte.

   Trois partis pris :

   1. C'est le VOYAGEUR qui remplit. Cet écran sert d'abord à lire ce
      qu'il a déclaré et à vérifier sa pièce jointe. L'ouverture d'une
      fiche donne donc une vue en lecture ; le stylo, en haut, bascule
      en édition pour les corrections ponctuelles.

   2. Le statut ne se choisit pas, il se DÉDUIT de ce qui est
      renseigné. Une fiche à qui il manque le numéro de document ne
      peut pas être marquée « complète » par un clic optimiste. Seule
      la transmission aux autorités reste une action explicite.

   3. La photo du document prime sur la saisie. Recopier un numéro de
      passeport à la main, c'est une coquille sur deux documents, et
      elle ne se voit qu'au contrôle.
   ============================================================ */
Layout.init('police');

(function () {
  const ic = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  const ICO_PHOTO = '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>';
  const ICO_DOC = '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>';
  const SEUIL_ALERTE = 24;   // heures : le délai réglementaire avant l'arrivée

  let editId = null;
  let enEdition = false;
  let piecesEnCours = [];
  let filtre = 'tous';

  const F = id => document.getElementById(id);
  const vide = '<span class="text-muted">Non renseigné</span>';

  /* ---------- Compteurs ---------- */
  function renderKpis() {
    const par = st => FICHES_POLICE.filter(f => f.statut === st).length;
    const urgentes = fichesPoliceUrgentes(SEUIL_ALERTE);
    const enRetard = urgentes.filter(f => (heuresAvantArrivee(f) || 0) < 0).length;
    const kpi = (label, valeur, pied, icone, alerte) => `
      <div class="kpi"><div class="kpi__label">${label}</div>
      <div class="kpi__value ${alerte ? 'text-danger' : ''}">${valeur}</div>
      <div class="kpi__foot">${pied}</div><div class="kpi__icon">${ic(icone)}</div></div>`;
    F('fp-kpis').innerHTML = [
      kpi('Échéance sous 24 h', urgentes.length,
        enRetard ? `dont ${enRetard} déjà arrivé${enRetard > 1 ? 's' : ''}` : 'à relancer avant l\'arrivée',
        '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', urgentes.length > 0),
      kpi('En attente du voyageur', par('a_remplir') + par('en_attente'), 'Fiches non finalisées',
        '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>'),
      kpi('Complètes', par('complete'), 'Prêtes à être transmises', '<path d="M20 6 9 17l-5-5"/>'),
      kpi('Transmises', par('transmise'), 'Conservation en cours',
        '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/>'),
    ].join('');
  }

  /* ---------- Bandeau d'échéance ----------
     Rappel de ce qui doit partir aujourd'hui. Les fiches dont l'arrivée est
     passée sont nommées à part : ce n'est plus une relance, c'est un manquement. */
  function renderUrgences() {
    const zone = F('fp-urgences');
    if (!zone) return;
    const urgentes = fichesPoliceUrgentes(SEUIL_ALERTE);
    if (!urgentes.length) { zone.innerHTML = ''; return; }
    zone.innerHTML = `
      <div class="fp-urgence">
        ${ic('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>')}
        <div class="grow">
          <b>${urgentes.length} fiche${urgentes.length > 1 ? 's' : ''} à obtenir avant l'arrivée</b>
          <p>${urgentes.map(f => {
            const h = heuresAvantArrivee(f);
            const quand = h < 0 ? `arrivé depuis ${Math.abs(Math.round(h / 24))} j` : `dans ${h} h`;
            return `${f.prenom} ${f.nom} (${quand})`;
          }).join(' · ')}</p>
        </div>
        <a class="btn btn--secondary btn--sm" href="alertes.html">Régler mes alertes</a>
      </div>`;
  }

  /* ---------- Tableau ---------- */
  function renderTable() {
    const liste = filtre === 'tous' ? FICHES_POLICE : FICHES_POLICE.filter(f => f.statut === filtre);
    const tb = F('fp-tbody');
    if (!liste.length) {
      tb.innerHTML = `<tr><td colspan="7"><div class="empty">${ic(ICO_DOC)}
        <h4>Aucune fiche</h4><p>Aucune fiche ne correspond à ce filtre.</p></div></td></tr>`;
      return;
    }
    tb.innerHTML = liste.map(f => {
      const r = getReservation(f.reservationId);
      const l = r ? getLogement(r.logementId) : null;
      const st = POLICE_STATUTS[f.statut];
      const h = heuresAvantArrivee(f);
      const nonFinalisee = f.statut !== 'complete' && f.statut !== 'transmise';
      const echeance = nonFinalisee && h !== null && h <= SEUIL_ALERTE
        ? `<br><small class="text-danger">${h < 0 ? 'Arrivée passée' : `Arrivée dans ${h} h`}</small>` : '';
      return `<tr class="is-clickable" data-fiche="${f.id}">
        <td><div class="fw-semibold">${f.prenom} ${f.nom}</div>
          <small class="text-muted">${f.accompagnants > 0 ? `+ ${f.accompagnants} accompagnant${f.accompagnants > 1 ? 's' : ''}` : 'Seul'}</small></td>
        <td class="text-soft">${l ? l.nom : '—'}</td>
        <td class="text-soft">${r ? formatPlage(r.arrivee, r.depart) : '—'}${echeance}</td>
        <td class="text-soft">${f.nationalite || '—'}</td>
        <td>${f.pieces.length
          ? `<span class="fp-piecetag">${ic('<path d="M21.4 11.05 12.25 20.2a6 6 0 0 1-8.49-8.49l9.2-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>')} ${f.pieces.length}</span>`
          : '<span class="text-muted">—</span>'}</td>
        <td><span class="badge ${st.badge}">${st.label}</span></td>
        <td><button class="btn btn--secondary btn--sm" data-ouvrir="${f.id}">Ouvrir</button></td>
      </tr>`;
    }).join('');
  }

  function render() { renderKpis(); renderUrgences(); renderTable(); }

  /* ============================================================
     Vue LECTURE — ce que le voyageur a déclaré
     ============================================================ */
  function vueLecture(f) {
    const r = getReservation(f.reservationId);
    const l = r ? getLogement(r.logementId) : null;
    const doc = POLICE_DOCUMENTS.find(d => d.id === f.document);
    const manque = fichePoliceManquants(f);
    const h = heuresAvantArrivee(f);

    const ligne = (k, v) => `<div class="rp-row"><span>${k}</span><span>${v || vide}</span></div>`;

    return `
      ${/* formatDate abrège le mois avec un point : ne pas en rajouter un. */ ''}
      ${r ? `<p class="text-sm text-soft mb-4">Séjour de <b>${r.voyageur}</b> au <b>${l ? l.nom : '—'}</b>,
        du ${formatDate(r.arrivee)} au ${formatDate(r.depart)}</p>` : ''}

      ${manque.length ? `<div class="fp-manque">
        ${ic('<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>')}
        <div><b>En attente du voyageur</b>
        <p>${manque.length} mention${manque.length > 1 ? 's' : ''} obligatoire${manque.length > 1 ? 's' : ''} manquante${manque.length > 1 ? 's' : ''} : ${manque.join(', ')}.
        ${h !== null && h <= SEUIL_ALERTE ? (h < 0 ? "L'arrivée est passée." : `Arrivée dans ${h} h.`) : ''}</p></div>
      </div>` : ''}

      <div class="app-grid app-grid--2">
        <div>
          <p class="eyebrow mb-3">Identité</p>
          ${ligne('Nom', f.nom)}
          ${ligne('Prénom', f.prenom)}
          ${ligne('Date de naissance', f.naissanceDate ? formatDate(f.naissanceDate, { annee: true }) : '')}
          ${ligne('Lieu de naissance', f.naissanceLieu)}
          ${ligne('Nationalité', f.nationalite)}
          ${ligne('Accompagnants', f.accompagnants)}
          ${ligne('Domicile habituel', f.domicile)}
        </div>
        <div>
          <p class="eyebrow mb-3">Document d'identité</p>
          ${ligne('Type', doc ? doc.label : '')}
          ${ligne('Numéro', f.documentNumero ? `<span class="font-mono">${f.documentNumero}</span>` : '')}

          <p class="eyebrow mb-3 mt-4">Suivi</p>
          ${ligne('Lien envoyé le', f.envoyeeLe ? formatDate(f.envoyeeLe) : '')}
          ${ligne('Complétée le', f.completeeLe ? formatDate(f.completeeLe) : '')}
          ${ligne('Transmise le', f.transmiseLe ? formatDate(f.transmiseLe) : '')}
        </div>
      </div>

      <hr class="divider" style="margin:var(--sp-5) 0" />
      <p class="eyebrow mb-3">Pièce jointe</p>
      ${f.pieces.length
        ? f.pieces.map(p => `<div class="fp-piece">
            ${ic(p.type === 'photo' ? ICO_PHOTO : ICO_DOC)}
            <div class="grow"><b>${p.nom}</b><small>${p.type === 'photo' ? 'Photo prise par le voyageur' : 'Fichier importé'} · ${formatDate(p.ajouteLe)}</small></div>
            <button class="btn btn--ghost btn--sm" data-voir="${p.nom}">Voir</button>
          </div>`).join('')
        : `<p class="text-sm text-muted">Aucune pièce transmise. Le document d'identité est exigé par la réglementation.</p>`}`;
  }

  function piedLecture(f) {
    const finalisee = f.statut === 'complete';
    return `
      <button class="btn btn--secondary" onclick="UI.closeAll()">Fermer</button>
      ${f.statut === 'transmise'
        ? '<span class="badge badge--accent">Transmise aux autorités</span>'
        : `<button class="btn btn--ghost" id="fp-relancer">Relancer le voyageur</button>
           <button class="btn btn--primary" id="fp-transmettre" ${finalisee ? '' : 'disabled'}
             title="${finalisee ? '' : 'La fiche doit être complète avant transmission'}">Marquer transmise</button>`}`;
  }

  /* ============================================================
     Vue ÉDITION — correction ponctuelle par l'hôte
     ============================================================ */
  function vueEdition(f) {
    const opt = (v, label, sel) => `<option value="${v}" ${v === sel ? 'selected' : ''}>${label}</option>`;
    return `
      <p class="text-sm text-soft mb-4">Ces informations sont normalement saisies par le voyageur. Corrigez-les si nécessaire.</p>

      <p class="eyebrow mb-2">Identité</p>
      <div class="app-grid app-grid--2">
        <div class="field"><label class="field__label" for="fp-f-nom">Nom</label><input class="input" id="fp-f-nom" value="${f.nom}" /></div>
        <div class="field"><label class="field__label" for="fp-f-prenom">Prénom</label><input class="input" id="fp-f-prenom" value="${f.prenom}" /></div>
      </div>
      <div class="app-grid app-grid--2 mt-4">
        <div class="field"><label class="field__label" for="fp-f-naissance">Date de naissance</label><input class="input" type="date" id="fp-f-naissance" value="${f.naissanceDate}" /></div>
        <div class="field"><label class="field__label" for="fp-f-lieu">Lieu de naissance</label><input class="input" id="fp-f-lieu" value="${f.naissanceLieu}" placeholder="Ville, pays" /></div>
      </div>
      <div class="app-grid app-grid--2 mt-4">
        <div class="field"><label class="field__label" for="fp-f-nationalite">Nationalité</label><input class="input" id="fp-f-nationalite" value="${f.nationalite}" /></div>
        <div class="field"><label class="field__label" for="fp-f-accompagnants">Personnes accompagnantes</label><input class="input" type="number" min="0" id="fp-f-accompagnants" value="${f.accompagnants}" /></div>
      </div>
      <div class="field mt-4"><label class="field__label" for="fp-f-domicile">Domicile habituel</label>
        <input class="input" id="fp-f-domicile" value="${f.domicile}" placeholder="Adresse dans le pays de résidence" /></div>

      <hr class="divider" style="margin:var(--sp-5) 0" />
      <p class="eyebrow mb-2">Document d'identité</p>
      <div class="app-grid app-grid--2">
        <div class="field"><label class="field__label" for="fp-f-doc">Type de document</label>
          <select class="select" id="fp-f-doc">${opt('', 'À préciser', f.document)}
            ${POLICE_DOCUMENTS.map(d => opt(d.id, d.label, f.document)).join('')}</select></div>
        <div class="field"><label class="field__label" for="fp-f-docnum">Numéro</label>
          <input class="input font-mono" id="fp-f-docnum" value="${f.documentNumero}" /></div>
      </div>

      <div class="fp-pieces mt-4">
        <div class="row-between mb-3">
          <div><b class="text-sm">Pièces jointes</b>
            <p class="text-xs text-muted">Photographier le document vaut mieux que recopier son numéro.</p></div>
          <div class="row gap-2">
            <input type="file" accept="image/*" capture="environment" id="fp-f-photo" hidden />
            <button type="button" class="btn btn--primary btn--sm" id="fp-f-photo-btn">${ic(ICO_PHOTO)} Prendre en photo</button>
            <input type="file" accept="image/*,.pdf" id="fp-f-fichier" hidden />
            <button type="button" class="btn btn--secondary btn--sm" id="fp-f-fichier-btn">Importer</button>
          </div>
        </div>
        <div id="fp-f-liste"></div>
      </div>`;
  }

  const piedEdition = () => `
    <button class="btn btn--secondary" id="fp-annuler">Annuler</button>
    <button class="btn btn--primary" id="fp-save">Enregistrer</button>`;

  function renderPieces() {
    const zone = F('fp-f-liste');
    if (!zone) return;
    zone.innerHTML = piecesEnCours.length
      ? piecesEnCours.map((p, i) => `<div class="fp-piece">
          ${ic(p.type === 'photo' ? ICO_PHOTO : ICO_DOC)}
          <div class="grow"><b>${p.nom}</b><small>${p.type === 'photo' ? 'Photo' : 'Fichier'} · ${formatDate(p.ajouteLe)}</small></div>
          <button class="icon-btn icon-btn--danger" data-piece="${i}" aria-label="Retirer">${ic('<path d="M18 6 6 18M6 6l12 12"/>')}</button>
        </div>`).join('')
      : `<p class="text-sm text-muted">Aucune pièce jointe.</p>`;
  }

  /* ---------- Bascule lecture / édition ---------- */
  function rendreModale() {
    const f = getFichePolice(editId);
    F('fp-modal-title').textContent = `${f.prenom} ${f.nom} — fiche de police`;
    F('fp-edit').hidden = enEdition;
    F('fp-corps').innerHTML = enEdition ? vueEdition(f) : vueLecture(f);
    F('fp-pied').innerHTML = enEdition ? piedEdition() : piedLecture(f);
    if (enEdition) { renderPieces(); brancherEdition(); }
    else brancherLecture();
  }

  function ouvrir(id) {
    editId = id;
    enEdition = false;
    piecesEnCours = getFichePolice(id).pieces.map(p => ({ ...p }));
    rendreModale();
    UI.openPanel('fp-modal');
  }

  F('fp-edit').addEventListener('click', () => { enEdition = true; rendreModale(); });

  function brancherLecture() {
    const relancer = F('fp-relancer');
    if (relancer) relancer.addEventListener('click', () => {
      const f = getFichePolice(editId);
      f.envoyeeLe = AUJOURDHUI;
      if (f.statut === 'a_remplir') f.statut = 'en_attente';
      saveOyviaState(); UI.closeAll(); render();
      UI.toast('Lien de saisie renvoyé au voyageur');
    });
    const transmettre = F('fp-transmettre');
    if (transmettre) transmettre.addEventListener('click', () => {
      const f = getFichePolice(editId);
      f.statut = 'transmise'; f.transmiseLe = AUJOURDHUI;
      saveOyviaState(); UI.closeAll(); render();
      UI.toast('Fiche transmise — conservation six mois');
    });
    F('fp-corps').addEventListener('click', e => {
      const v = e.target.closest('[data-voir]');
      // Aucun stockage de fichier dans cette maquette : on le dit plutôt que
      // d'ouvrir une visionneuse vide.
      if (v) UI.toast(`Aperçu de « ${v.dataset.voir} » — non disponible dans la démo`);
    });
  }

  function brancherEdition() {
    // Les deux boutons de pièce partagent la même mécanique, seul le type diffère.
    const brancher = (inputId, boutonId, type) => {
      F(boutonId).addEventListener('click', () => F(inputId).click());
      F(inputId).addEventListener('change', e => {
        const fichier = e.target.files && e.target.files[0];
        if (!fichier) return;
        piecesEnCours.push({ nom: fichier.name, type, ajouteLe: AUJOURDHUI });
        e.target.value = '';   // sinon reprendre le même fichier ne déclenche rien
        renderPieces();
        UI.toast(type === 'photo' ? 'Photo ajoutée' : 'Fichier importé');
      });
    };
    brancher('fp-f-photo', 'fp-f-photo-btn', 'photo');
    brancher('fp-f-fichier', 'fp-f-fichier-btn', 'fichier');

    F('fp-f-liste').addEventListener('click', e => {
      const b = e.target.closest('[data-piece]');
      if (!b) return;
      piecesEnCours.splice(Number(b.dataset.piece), 1);
      renderPieces();
    });

    F('fp-annuler').addEventListener('click', () => {
      // Retour à la lecture sans rien écrire : les pièces ajoutées en cours
      // d'édition sont abandonnées avec le reste.
      piecesEnCours = getFichePolice(editId).pieces.map(p => ({ ...p }));
      enEdition = false; rendreModale();
    });

    F('fp-save').addEventListener('click', () => {
      const f = getFichePolice(editId);
      Object.assign(f, {
        nom: F('fp-f-nom').value.trim(),
        prenom: F('fp-f-prenom').value.trim(),
        naissanceDate: F('fp-f-naissance').value,
        naissanceLieu: F('fp-f-lieu').value.trim(),
        nationalite: F('fp-f-nationalite').value.trim(),
        accompagnants: parseInt(F('fp-f-accompagnants').value, 10) || 0,
        domicile: F('fp-f-domicile').value.trim(),
        document: F('fp-f-doc').value,
        documentNumero: F('fp-f-docnum').value.trim(),
        pieces: piecesEnCours,
      });

      // Le statut se déduit : une fiche transmise le reste, une fiche
      // incomplète ne peut pas être déclarée complète.
      if (f.statut !== 'transmise') {
        const manque = fichePoliceManquants(f);
        if (!manque.length) {
          if (f.statut !== 'complete') f.completeeLe = AUJOURDHUI;
          f.statut = 'complete';
        } else {
          f.statut = f.envoyeeLe ? 'en_attente' : 'a_remplir';
        }
      }

      saveOyviaState();
      enEdition = false; rendreModale(); render();
      const manque = fichePoliceManquants(f);
      UI.toast(manque.length ? `Enregistré — il manque : ${manque.join(', ')}` : 'Fiche complète, prête à être transmise');
    });
  }

  /* ---------- Filtre et ouverture ---------- */
  F('fp-filtre').innerHTML = '<option value="tous">Tous les statuts</option>'
    + Object.entries(POLICE_STATUTS).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('');
  F('fp-filtre').addEventListener('change', e => { filtre = e.target.value; renderTable(); });

  F('fp-tbody').addEventListener('click', e => {
    const row = e.target.closest('[data-fiche]');
    if (row) ouvrir(row.dataset.fiche);
  });

  render();
})();
