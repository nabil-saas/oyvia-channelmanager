/* ============================================================
   OYVIA — Messagerie unifiée (3 colonnes)
   Liste des conversations · fil de discussion · contexte résa.

   Intégration de Vivi (cf. js/data.js) :
     - une conversation dont Vivi a une proposition en attente est
       signalée dans la liste et filtrable (« IA - À valider ») ;
     - les messages écrits par Vivi sont identifiés comme tels ;
     - la proposition en attente s'affiche au-dessus du composeur,
       avec Approuver / Éditer / Refuser.
   Approuver poste réellement le message (viviApprouver), donc la
   page Vivi > Audit et cette page ne peuvent pas se contredire.

   Vivi déduit aussi des TÂCHES des messages reçus (fuite, logement
   sale, serviettes manquantes, ménage de mi-séjour). Selon le réglage
   de la catégorie, la tâche est créée seule ou proposée à validation.
   Créer la pousse réellement dans TACHES : elle apparaît dans la
   section Ménage exactement comme une tâche saisie à la main.
   ============================================================ */
Layout.init('messagerie');

(function () {
  const AVA = ['', 'avatar--v2', 'avatar--v3', 'avatar--v4'];
  const PAY_BADGE = { paye: 'badge--positive', acompte: 'badge--warning', impaye: 'badge--danger', rembourse: 'badge--neutral' };
  const initiales = nom => nom.split(' ').map(m => m[0]).slice(0, 2).join('').toUpperCase();

  const MODELES = [
    { nom: 'Lien de la page séjour', texte: 'Bonjour {prenom}, retrouvez toutes les informations de votre séjour au {nom_logement} ici : {lien_sejour} — adresse, code d\'accès, Wi-Fi et guide du quartier.' },
    { nom: 'Instructions d\'arrivée (détaillées)', texte: 'Bonjour {prenom}, voici les informations pour votre arrivée au {nom_logement} : {adresse}. Code d\'accès : {code_acces}. Wifi : {wifi}. Arrivée possible à partir de 15h. Bon voyage !' },
    { nom: 'Message de bienvenue', texte: 'Bienvenue {prenom} ! Nous espérons que votre voyage s\'est bien passé. N\'hésitez pas à nous écrire pour toute question. Bon séjour !' },
    { nom: 'Parking à proximité', texte: 'Bonjour {prenom}, un parking public se trouve à proximité (environ 18 €/jour). Je vous communique l\'adresse exacte si besoin.' },
    { nom: 'Arrivée tardive', texte: 'Bonjour {prenom}, aucun souci pour une arrivée tardive : l\'accès est autonome par boîte à clés, à toute heure.' },
    { nom: 'Rappel de départ', texte: 'Bonjour {prenom}, le départ est prévu avant 11h. Merci de laisser les clés dans la boîte et de fermer les fenêtres. Merci pour votre séjour !' },
  ];

  const elLayout = document.getElementById('msg-layout');
  const elConvs = document.getElementById('msg-convs');
  const elThread = document.getElementById('msg-thread');
  const elHead = document.getElementById('msg-threadhead');
  const elCtx = document.getElementById('msg-ctx');
  const elInput = document.getElementById('msg-input');
  const elTemplate = document.getElementById('msg-template');
  const elSearch = document.getElementById('msg-search');

  elTemplate.innerHTML = '<option value="">Insérer un modèle…</option>' +
    MODELES.map((m, i) => `<option value="${i}">${m.nom}</option>`).join('');

  // Un canal n'alimente la messagerie que si sa plateforme est connectée
  // (Paramètres > Plateformes). Les canaux sans plateforme, comme l'e-mail,
  // restent toujours disponibles.
  function canalActif(canal) {
    const pf = PLATEFORMES.find(p => p.id === canal);
    return pf ? pf.connecte : true;
  }
  const conversationsVisibles = () => CONVERSATIONS.filter(c => canalActif(c.canal));

  const visibles = conversationsVisibles();
  let filtre = 'tout';
  let activeId = (visibles.find(c => c.nonLu > 0) || visibles[0] || CONVERSATIONS[0]).id;
  let editionIA = null;      // id de la réponse Vivi en cours d'édition
  let editionTache = null;   // id de la tâche proposée dont les champs sont dépliés

  // Liens entrants : ?conv=C05 (depuis l'audit de Vivi) ou ?filtre=ia
  // (depuis le chat de Vivi, « les réponses qui vous attendent »).
  const params = new URLSearchParams(location.search);
  // « tache » est accepté comme alias : les deux natures de propositions sont
  // désormais réunies sous le même filtre.
  if (['ia', 'tache'].includes(params.get('filtre'))) filtre = 'ia';
  const convParam = params.get('conv');
  if (convParam && CONVERSATIONS.some(c => c.id === convParam)) activeId = convParam;
  else if (filtre === 'ia') {
    const dansLesVisibles = id => visibles.some(c => c.id === id);
    const premiere = viviReponsesEnAttente().find(r => dansLesVisibles(r.conversationId))
                  || viviTachesProposees().find(p => dansLesVisibles(p.conversationId));
    if (premiere) activeId = premiere.conversationId;
  }

  const ctxOf = c => { const r = getReservation(c.reservationId); return { r, l: getLogement(r.logementId), v: r.voyageurId ? getVoyageur(r.voyageurId) : null }; };

  function fillVars(t, r, l, v) {
    return t
      .replace(/{prenom}/g, (v ? v.nom : r.voyageur).split(' ')[0])
      .replace(/{nom_logement}/g, l.nom)
      .replace(/{adresse}/g, l.adresse)
      .replace(/{code_acces}/g, l.codeAcces)
      .replace(/{wifi}/g, `${l.wifi.ssid} / ${l.wifi.pass}`)
      .replace(/{date_arrivee}/g, formatDate(r.arrivee))
      // URL absolue : ce texte part chez le voyageur, hors du site.
      .replace(/{lien_sejour}/g, lienSejourAbsolu(r, true));
  }

  /* ---------- Liste des conversations ---------- */
  function renderList() {
    const q = elSearch.value.trim().toLowerCase();
    const list = conversationsVisibles().filter(c => {
      const { l } = ctxOf(c);
      if (q && !`${c.voyageur || getReservation(c.reservationId).voyageur} ${l.nom}`.toLowerCase().includes(q)) return false;
      if (filtre === 'nonlu' && !c.nonLu) return false;
      // « IA - À valider » réunit les deux natures de propositions : une
      // réponse à envoyer et une tâche à créer réclament le même geste de
      // votre part, et une même conversation peut porter les deux.
      if (filtre === 'ia' && !getViviEnAttente(c.id) && !viviTacheEnAttente(c.id)) return false;
      return true;
    });

    const vides = {
      tout:  'Aucune conversation',
      nonlu: 'Tout est lu 🎉',
      ia:    'Rien à valider — Vivi est à jour',
    };

    elConvs.innerHTML = list.map((c, i) => {
      const { r, l } = ctxOf(c);
      const nom = r.voyageur;
      const last = c.messages[c.messages.length - 1];
      const attente = getViviEnAttente(c.id);
      // Un pictogramme discret suffit : ⏳ Vivi attend votre aval,
      // ✦ Vivi a déjà répondu seule sur ce fil.
      const marque = attente
        ? `<span class="msg-conv__ia msg-conv__ia--attente" title="Réponse de Vivi à valider — ${attente.raison}">⏳ Réponse</span>`
        : getViviReponses(c.id).length
          ? `<span class="msg-conv__ia" title="Vivi a répondu automatiquement sur cette conversation">✦ Vivi</span>`
          : '';
      // Une tâche proposée est signalée à part : elle appelle une décision
      // différente d'une réponse, et les deux peuvent coexister sur un fil.
      const prop = viviTacheEnAttente(c.id);
      const marqueTache = prop
        ? `<span class="msg-conv__ia msg-conv__ia--tache" title="Vivi propose une tâche — ${prop.categorie.label}">🧹 Tâche</span>`
        : '';
      return `<div class="msg-conv ${c.id === activeId ? 'is-active' : ''}" data-id="${c.id}">
        <span class="avatar ${AVA[i % 4]}">${initiales(nom)}</span>
        <div class="msg-conv__body">
          <div class="msg-conv__top"><span class="msg-conv__name">${nom}</span><span class="msg-conv__time">${c.horodatage}</span></div>
          <div class="msg-conv__sub"><span class="badge-canal badge-canal--${c.canal}" style="font-size:var(--fs-xs)"><span class="dot"></span>${CANAL_LABEL[c.canal]}</span>${marque}${marqueTache}</div>
          <div class="msg-conv__top"><span class="msg-conv__preview">${last.texte}</span>${c.nonLu ? `<span class="msg-conv__unread">${c.nonLu}</span>` : ''}</div>
        </div>
      </div>`;
    }).join('') || `<div class="empty"><h4>${vides[filtre]}</h4></div>`;

    // Le compteur rend le travail restant visible sans cliquer. On compte les
    // DÉCISIONS à prendre, pas les conversations : un fil qui porte à la fois
    // une réponse et une tâche vous demande bien deux gestes.
    const btnIA = document.querySelector('#msg-filters [data-filtre="ia"]');
    if (btnIA) {
      const visible = id => canalActif((CONVERSATIONS.find(c => c.id === id) || {}).canal);
      const n = viviReponsesEnAttente().filter(r => visible(r.conversationId)).length
              + viviTachesProposees().filter(p => visible(p.conversationId)).length;
      btnIA.textContent = n ? `IA - À valider · ${n}` : 'IA - À valider';
    }
  }

  /* ---------- Fil de discussion ---------- */
  function renderThread() {
    const c = CONVERSATIONS.find(x => x.id === activeId);
    const { r, l, v } = ctxOf(c);
    c.nonLu = 0;

    elHead.innerHTML = `
      <button type="button" class="icon-btn msg-back" id="msg-back" aria-label="Retour à la liste des conversations">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg>
      </button>
      <span class="avatar">${initiales(r.voyageur)}</span>
      <div class="msg-threadhead__meta">
        <b>${r.voyageur}</b>
        <small>${l.nom} · ${l.ville} · <span class="badge-canal badge-canal--${c.canal}"><span class="dot"></span>${CANAL_LABEL[c.canal]}</span></small>
      </div>
      <div class="msg-threadhead__actions">
        <button class="btn btn--secondary btn--sm" onclick="UI.openResa('${r.id}')">Voir la réservation</button>
      </div>`;
    const backBtn = document.getElementById('msg-back');
    if (backBtn) backBtn.addEventListener('click', () => elLayout.classList.remove('is-thread-open'));

    elThread.innerHTML = `<div class="msg-daysep">Séjour du ${formatPlage(r.arrivee, r.depart)}</div>` +
      c.messages.map((m, i) => {
        // Un message signé Vivi doit être identifiable : c'est la condition
        // pour faire confiance à l'automatisation.
        const parVivi = m.de === 'hote' && viviAEcrit(c.id, i);
        const rep = parVivi ? getViviReponses(c.id).find(x => x.msgIndex === i) : null;
        return `<div class="msg-bubble msg-bubble--${m.de === 'hote' ? 'out' : 'in'}">
          ${m.texte}
          <div class="msg-bubble__time">${parVivi
            ? `<span class="msg-bubble__vivi" title="Vivi · ${viviOrigine(rep)}">✦ ${rep.confirmationCreneau ? 'Créneau confirmé par Vivi' : rep.corrigee ? 'Vivi, corrigée par vous' : rep.approuvee ? 'Vivi, approuvée par vous' : 'Envoyé par Vivi'}</span> · ${m.heure}`
            : m.heure}</div>
        </div>`;
      }).join('');
    renderVivi(c);
    // Le défilement vient APRÈS l'injection des encarts Vivi : ce sont eux qui
    // rétrécissent le fil et créent le débordement. Appelé avant, scrollTop
    // restait à 0 faute de dépassement, et le dernier message — souvent la
    // réponse que Vivi vient d'envoyer — n'était pas visible.
    elThread.scrollTop = elThread.scrollHeight;
    renderCtx(c, r, l, v);
    renderList();
  }

  /* ============================================================
     PANNEAU VIVI — une seule file, traitée étape par étape

     Avant, deux encarts se disputaient l'écran : la tâche au-dessus, la
     réponse en dessous. On ne savait pas par quoi commencer, ni combien
     il restait à faire. Or l'ordre n'est pas arbitraire : on RÉPOND au
     voyageur d'abord, on engage un prestataire ensuite.

     Le panneau construit donc une file ordonnée et n'en montre qu'une
     étape à la fois, avec le reste annoncé dessous. Les signalements
     sont traités par groupe — message puis tâche — dans l'ordre où les
     messages sont arrivés.
     ============================================================ */
  function etapesVivi(c) {
    const sigs = viviSignalements(c.id);
    const props = viviTachesProposees(c.id);
    const items = [];

    // Les réponses en attente sont de vraies questions de voyageur. Une
    // intervention détectée, elle, ne passe plus par un accusé de réception :
    // le message part à la création de la tâche, avec le créneau dedans.
    viviReponsesEnAttente()
      .filter(r => r.conversationId === c.id)
      .forEach(r => {
        // Une réponse en attente n'a pas encore d'index (elle n'est pas
        // postée) : on l'ancre sur la QUESTION à laquelle elle répond, sinon
        // elle passerait après des tâches nées de messages plus récents.
        const i = c.messages.findIndex(m => m.texte === r.question);
        items.push({ ancre: i >= 0 ? i : (r.msgIndex == null ? -1 : r.msgIndex), etapes: [{ type: 'reponse', reponse: r }] });
      });

    // Une seule étape par signalement : la tâche à créer.
    sigs.forEach(s => {
      const p = props.find(x => x.msgIndex === s.msgIndex);
      if (p) items.push({ ancre: s.msgIndex, etapes: [{ type: 'tache', proposition: p, signalement: s }] });
    });

    // Ordre chronologique des messages d'origine : on traite la
    // conversation dans le sens où elle s'est déroulée.
    return items.sort((a, b) => a.ancre - b.ancre).flatMap(x => x.etapes);
  }

  function libelleEtape(e) {
    if (e.type === 'reponse') return 'Répondre au voyageur';
    return `Créer la tâche · ${e.proposition.categorie.label}`;
  }

  /* ---------- Étape « réponse » ---------- */
  function blocReponse(e) {
    const r = e.reponse;
    const enEdition = editionIA === r.id;
    const motif = viviMotifAttente(r);
    // Le seuil de confiance n'est pas montré : c'est un réglage interne,
    // il n'aide pas à décider. La RAISON, elle, est utile.
    return `
      <div class="vp-etape__titre">
        <div class="grow">
          <b>${r.statut === 'escaladee' ? 'Vivi a escaladé ce message' : 'Réponse proposée par Vivi'}</b>
          ${motif && motif.cause ? `<small>${motif.cause}</small>` : ''}
        </div>
      </div>
      ${enEdition
        ? `<textarea class="textarea msg-vivi__edit" id="msg-vivi-txt">${r.reponse.replace(/</g, '&lt;')}</textarea>`
        : `<p class="msg-vivi__texte">${r.reponse}</p>`}
      <div class="msg-vivi__actions">
        ${enEdition
          ? `<button type="button" class="btn btn--primary btn--sm" data-ia-save="${r.id}">Envoyer ma version</button>
             <button type="button" class="btn btn--ghost btn--sm" data-ia-cancel>Annuler</button>`
          : `<button type="button" class="btn btn--primary btn--sm" data-ia-ok="${r.id}">Approuver et envoyer</button>
             <button type="button" class="btn btn--secondary btn--sm" data-ia-edit="${r.id}">Éditer</button>
             <button type="button" class="btn btn--ghost btn--sm" data-ia-no="${r.id}">Refuser</button>`}
      </div>`;
  }

  /* ---------- Étape « tâche » ---------- */
  function blocTache(e, c) {
    const prop = e.proposition;
    const l = getLogement(prop.tache.logementId);
    const u = VIVI_URGENCES[prop.categorie.urgence];
    const prest = getPrestataire(prop.tache.prestataireId);
    const enEdition = editionTache === prop.id;
    const options = PRESTATAIRES.map(p =>
      `<option value="${p.id}" ${p.id === prop.tache.prestataireId ? 'selected' : ''}>${p.nom} — ${p.role}</option>`).join('');

    const resa = getReservation(c.reservationId);
    const apercu = viviTexteConfirmation(prop.categorie, resa, prop.tache,
      viviLangueMessage(c.messages[prop.msgIndex].texte));

    return `
      <div class="vp-etape__titre">
        <div class="grow"><b>Tâche proposée · ${prop.categorie.label}</b></div>
        <span class="badge ${u.badge}">${u.label}</span>
      </div>
      <p class="msg-tache__cible">
        ${TACHE_LABEL[prop.tache.type] || prop.tache.type} · <b>${l.nom}</b> ·
        ${formatDate(prop.tache.date)} à ${prop.tache.heure}${prest ? ` · ${prest.nom}` : ' · à assigner'}
      </p>
      ${enEdition ? `
        <div class="msg-tache__grid">
          <div class="field">
            <label class="field__label" for="vt-date">Date</label>
            <input class="input" type="date" id="vt-date" value="${prop.tache.date}" />
          </div>
          <div class="field">
            <label class="field__label" for="vt-heure">Heure</label>
            <input class="input" type="time" id="vt-heure" value="${prop.tache.heure}" />
          </div>
          <div class="field">
            <label class="field__label" for="vt-prest">Prestataire</label>
            <select class="select" id="vt-prest">${options}</select>
          </div>
        </div>
        <p class="msg-tache__cible">Vivi a proposé <b>${prest ? prest.nom : 'personne'}</b> : ${prest ? "c'est le prestataire habituel de ce logement" : "aucun intervenant n'est rattaché à ce logement"}.</p>`
      : ''}
      <label class="msg-tache__prevenir">
        <input type="checkbox" id="vt-prevenir" checked />
        <span>
          Prévenir ${resa ? resa.voyageur.split(' ')[0] : 'le voyageur'} du créneau
          <small id="vt-apercu">« ${apercu} »</small>
        </span>
      </label>
      <div class="msg-vivi__actions">
        <button type="button" class="btn btn--primary btn--sm" data-vt-ok="${prop.id}">Créer la tâche</button>
        ${enEdition
          ? `<button type="button" class="btn btn--ghost btn--sm" data-vt-cancel>Replier</button>`
          : `<button type="button" class="btn btn--secondary btn--sm" data-vt-edit="${prop.id}">Modifier</button>`}
        <button type="button" class="btn btn--ghost btn--sm" data-vt-no="${prop.id}">Ignorer</button>
      </div>`;
  }

  function renderVivi(c) {
    const zone = document.getElementById('msg-vivi');
    if (!zone) return;

    const etapes = etapesVivi(c);
    if (etapes.length) {
      const e = etapes[0];
      const reste = etapes.slice(1);
      zone.className = `msg-vivi vp vp--${e.type}`;
      zone.innerHTML = `
        <div class="vp__head">
          <span class="msg-vivi__ic"><img src="../assets/vivi.svg" alt="" aria-hidden="true" /></span>
          <b>À traiter</b>
          ${etapes.length > 1 ? `<span class="vp__compteur">1 / ${etapes.length}</span>` : ''}
        </div>
        <div class="vp-etape">${e.type === 'reponse' ? blocReponse(e) : blocTache(e, c)}</div>
        ${reste.length ? `<ul class="vp__suite">${reste.map((x, i) =>
          `<li><span>${i + 2}</span>${libelleEtape(x)}</li>`).join('')}</ul>` : ''}`;

      // Le champ de date n'existe que déplié : on l'équipe après le rendu,
      // avec le même contrat que la planification manuelle (cf. js/menage.js).
      const champDate = document.getElementById('vt-date');
      if (champDate) {
        const prop = e.proposition;
        DatePicker.attach(champDate, () => ({
          min: AUJOURDHUI,
          indispo: d => d < AUJOURDHUI ? 'Date passée' : null,
          note: d => {
            const bouts = [];
            const occ = occupationLogement(prop.tache.logementId, d);
            if (occ) bouts.push(occ);
            const idPrest = (document.getElementById('vt-prest') || {}).value || prop.tache.prestataireId;
            const charge = chargePrestataire(idPrest, d);
            if (charge.length) {
              const pr = getPrestataire(idPrest);
              bouts.push(`${pr ? pr.nom : 'Le prestataire'} : ${charge.length} intervention${charge.length > 1 ? 's' : ''} déjà prévue${charge.length > 1 ? 's' : ''}`);
            }
            return bouts.length ? bouts.join(' · ') : null;
          },
          legende: [{ classe: 'off', texte: 'Passé' }, { classe: 'note', texte: 'Voyageur sur place ou prestataire chargé' }],
        }));
      }
      return;
    }

    // Plus rien à décider : on récapitule ce que Vivi a fait sur ce fil.
    const creees = viviSignalements(c.id).filter(d => d.statut === 'creee');
    const deja = getViviReponses(c.id);
    if (creees.length || deja.length) {
      const lignes = [];
      if (deja.length) {
        const derniere = deja.reduce((a, b) => ((b.msgIndex || 0) > (a.msgIndex || 0) ? b : a));
        lignes.push(`${deja.length} réponse${deja.length > 1 ? 's' : ''} · la dernière ${viviOrigine(derniere)}`);
      }
      creees.forEach(d => {
        const t = TACHES.find(x => x.id === d.tacheId);
        if (!t) return;
        const p = getPrestataire(t.prestataireId);
        lignes.push(`${TACHE_LABEL[t.type] || t.type} le ${formatDate(t.date)} à ${t.heure}${p ? ` · ${p.nom}` : ''}${d.confirmationId ? ' · voyageur prévenu' : ''}`);
      });
      zone.className = 'msg-vivi msg-vivi--ok';
      zone.innerHTML = `
        <div class="msg-vivi__head">
          <span class="msg-vivi__ic"><img src="../assets/vivi.svg" alt="" aria-hidden="true" /></span>
          <div class="grow">
            <b>Rien à valider sur ce fil</b>
            <small>${lignes.join(' · ')}</small>
          </div>
          <div class="msg-vivi__head-actions">
            ${creees.length
              ? `<a class="btn btn--ghost btn--sm" href="menage.html">Voir dans Ménage</a>
                 <button type="button" class="btn btn--ghost btn--sm" data-vt-annul="${creees[creees.length - 1].conversationId}|${creees[creees.length - 1].msgIndex}|${creees[creees.length - 1].categorieId || ''}">Annuler la tâche</button>`
              : `<a class="btn btn--ghost btn--sm" href="vivi.html#audit">Voir l'audit</a>`}
          </div>
        </div>`;
      return;
    }

    if (viviNiveauIA() !== 'avancee' && c.nonLu > 0) {
      zone.className = 'msg-vivi msg-vivi--promo';
      zone.innerHTML = `
        <div class="msg-vivi__head">
          <span class="msg-vivi__ic"><img src="../assets/vivi.svg" alt="" aria-hidden="true" /></span>
          <div class="grow">
            <b>Vivi pourrait répondre à ce message</b>
            <small>L'IA Avancée répond seule aux questions simples, dans la langue du voyageur.</small>
          </div>
          <div class="msg-vivi__head-actions">
            <a class="btn btn--secondary btn--sm" href="vivi.html">En savoir plus</a>
          </div>
        </div>`;
      return;
    }

    zone.className = 'msg-vivi hidden';
    zone.innerHTML = '';
  }

  /* ---------- Contexte réservation ---------- */
  function renderCtx(c, r, l, v) {
    elCtx.innerHTML = `
      <p class="eyebrow mb-2">Réservation</p>
      <div class="rp-row"><span>Séjour</span><span>${formatPlage(r.arrivee, r.depart)}</span></div>
      <div class="rp-row"><span>Nuits</span><span>${r.nuits}</span></div>
      <div class="rp-row"><span>Voyageurs</span><span>${r.pers}</span></div>
      <div class="rp-row"><span>Montant</span><span class="fw-semibold">${formatMontant(r.montant)}</span></div>
      <div class="rp-row"><span>Paiement</span><span><span class="badge ${PAY_BADGE[r.paiement]}">${PAIEMENT_LABEL[r.paiement]}</span></span></div>
      <hr class="divider" style="margin:var(--sp-4) 0;">
      <p class="eyebrow mb-2">Accès</p>
      <div class="msg-ctx__code"><span class="text-sm text-soft">Code porte</span><b>${l.codeAcces}</b></div>
      <div class="msg-ctx__code"><span class="text-sm text-soft">Wifi</span><b>${l.wifi.ssid}</b></div>
      <div class="msg-ctx__code"><span class="text-sm text-soft">Mot de passe</span><b>${l.wifi.pass}</b></div>
      ${v ? `<hr class="divider" style="margin:var(--sp-4) 0;">
      <p class="eyebrow mb-2">Voyageur</p>
      <div class="rp-row"><span>Pays</span><span>${v.pays}</span></div>
      <div class="rp-row"><span>Téléphone</span><span>${v.tel}</span></div>
      <div class="rp-row"><span>Historique</span><span>${v.nbSejours} séjour${v.nbSejours > 1 ? 's' : ''}</span></div>` : ''}
      <button class="btn btn--secondary btn--block" style="margin-top:var(--sp-5)" onclick="UI.openResa('${r.id}')">Ouvrir la fiche complète</button>`;
  }

  /* ---------- Interactions ---------- */
  elConvs.addEventListener('click', e => {
    const el = e.target.closest('.msg-conv'); if (!el) return;
    activeId = el.dataset.id;
    editionIA = null;
    editionTache = null;
    renderThread();
    elLayout.classList.add('is-thread-open'); // bascule vers le fil sur mobile (une seule colonne visible à la fois)
  });
  elSearch.addEventListener('input', renderList);

  document.getElementById('msg-filters').addEventListener('click', e => {
    const b = e.target.closest('button[data-filtre]'); if (!b) return;
    filtre = b.dataset.filtre;
    document.querySelectorAll('#msg-filters button').forEach(x => x.classList.toggle('is-active', x === b));
    renderList();
  });

  /* ---------- Actions sur la proposition de Vivi ---------- */
  document.getElementById('msg-vivi').addEventListener('click', e => {
    const ok = e.target.closest('[data-ia-ok]');
    if (ok) {
      viviApprouver(ok.dataset.iaOk);
      editionIA = null;
      if (typeof saveOyviaState === 'function') saveOyviaState();
      renderThread();
      UI.toast('Réponse de Vivi envoyée au voyageur');
      return;
    }
    const ed = e.target.closest('[data-ia-edit]');
    if (ed) {
      editionIA = ed.dataset.iaEdit;
      renderVivi(CONVERSATIONS.find(x => x.id === activeId));
      const ta = document.getElementById('msg-vivi-txt');
      if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
      return;
    }
    if (e.target.closest('[data-ia-cancel]')) {
      editionIA = null;
      renderVivi(CONVERSATIONS.find(x => x.id === activeId));
      return;
    }
    const sv = e.target.closest('[data-ia-save]');
    if (sv) {
      const txt = document.getElementById('msg-vivi-txt').value.trim();
      if (!txt) { UI.toast('La réponse ne peut pas être vide', false); return; }
      viviApprouver(sv.dataset.iaSave, txt);
      editionIA = null;
      if (typeof saveOyviaState === 'function') saveOyviaState();
      renderThread();
      UI.toast('Votre version a été envoyée — Vivi en tiendra compte');
      return;
    }
    const no = e.target.closest('[data-ia-no]');
    if (no) {
      const id = no.dataset.iaNo;
      UI.confirm({
        title: 'Refuser cette réponse ?',
        message: "La proposition de Vivi sera supprimée. Le message du voyageur reste ici, mais il n'aura pas de réponse tant que vous n'aurez pas écrit vous-même.",
        confirmText: 'Refuser la réponse',
        cancelText: 'Annuler',
        danger: true,
        onConfirm() {
          viviRefuser(id);
          editionIA = null;
          if (typeof saveOyviaState === 'function') saveOyviaState();
          renderThread();
          UI.toast('Réponse refusée');
        },
      });
    }
  });

  /* ---------- Aperçu de la confirmation, tenu à jour ----------
     Changer la date ou l'heure change le message que recevra le voyageur :
     l'aperçu doit suivre, sinon il annoncerait un créneau périmé. */
  document.getElementById('msg-vivi').addEventListener('input', e => {
    if (!['vt-date', 'vt-heure'].includes(e.target.id)) return;
    const ap = document.getElementById('vt-apercu');
    const c = CONVERSATIONS.find(x => x.id === activeId);
    const prop = viviTacheEnAttente(activeId);
    if (!ap || !prop || !c) return;
    const tache = Object.assign({}, prop.tache, {
      date: (document.getElementById('vt-date') || {}).value || prop.tache.date,
      heure: (document.getElementById('vt-heure') || {}).value || prop.tache.heure,
    });
    ap.textContent = `« ${viviTexteConfirmation(prop.categorie, getReservation(c.reservationId), tache,
      viviLangueMessage(c.messages[prop.msgIndex].texte))} »`;
  });

  /* ---------- Actions sur la tâche proposée par Vivi ---------- */
  document.getElementById('msg-vivi').addEventListener('click', e => {
    const ok = e.target.closest('[data-vt-ok]');
    if (ok) {
      // Si les champs sont dépliés, ils priment sur la proposition : ce que
      // l'utilisateur voit à l'écran est ce qui part dans la tâche. Repliés,
      // on garde les valeurs proposées par Vivi.
      const champ = id => (document.getElementById(id) || {}).value;
      const over = {};
      if (champ('vt-date'))  over.date = champ('vt-date');
      if (champ('vt-heure')) over.heure = champ('vt-heure');
      if (champ('vt-prest')) over.prestataireId = champ('vt-prest');

      const prevenir = (document.getElementById('vt-prevenir') || {}).checked !== false;
      const t = viviTacheCreer(ok.dataset.vtOk, over, false, prevenir);
      editionTache = null;
      if (typeof saveOyviaState === 'function') saveOyviaState();
      renderThread();
      if (t) {
        const p = getPrestataire(t.prestataireId);
        UI.toast(`Tâche créée pour le ${formatDate(t.date)}${p ? ` — ${p.nom}` : ''}${prevenir ? ' · voyageur prévenu' : ''}`);
      }
      return;
    }

    const ed = e.target.closest('[data-vt-edit]');
    if (ed) {
      editionTache = ed.dataset.vtEdit;
      renderVivi(CONVERSATIONS.find(x => x.id === activeId));
      return;
    }
    if (e.target.closest('[data-vt-cancel]')) {
      editionTache = null;
      renderVivi(CONVERSATIONS.find(x => x.id === activeId));
      return;
    }

    const no = e.target.closest('[data-vt-no]');
    if (no) {
      editionTache = null;
      viviTacheRefuser(no.dataset.vtNo);
      if (typeof saveOyviaState === 'function') saveOyviaState();
      renderThread();
      UI.toast('Proposition ignorée');
      return;
    }

    const an = e.target.closest('[data-vt-annul]');
    if (an) {
      const [convId, idx, catId] = an.dataset.vtAnnul.split('|');
      // En mode « Créer seule », Vivi ne se contente pas de reproposer : elle
      // recrée la tâche. Le dire, sinon l'utilisateur annule en boucle sans
      // comprendre pourquoi la tâche revient.
      const cat = getCategorieTache(catId);
      const suite = viviModeTache(catId) === 'auto'
        ? `\n\n« ${cat ? cat.label : 'Cette catégorie'} » est réglée sur « Créer seule » : Vivi recréera la tâche tant que le message restera sans réponse. Pour l'en empêcher, passez la catégorie sur « Me proposer » dans Assistant IA > Tâches ménagères.`
        : `\n\nVivi vous la reproposera tant que le message restera sans réponse.`;
      // Un message parti ne se rattrape pas : le dire plutôt que de laisser
      // le voyageur attendre une intervention annulée.
      const sig = getSignalement(convId, Number(idx));
      const prevenu = sig && sig.confirmationId
        ? `\n\n⚠️ Le créneau a déjà été confirmé au voyageur. Annuler la tâche ne rétracte pas ce message : pensez à le réécrire.`
        : '';
      UI.confirm({
        title: 'Annuler cette tâche ?',
        message: `La tâche sera retirée du planning et du programme du prestataire.${prevenu}${suite}`,
        confirmText: 'Annuler la tâche',
        cancelText: 'La garder',
        danger: true,
        onConfirm() {
          viviTacheAnnuler(convId, Number(idx));
          if (typeof saveOyviaState === 'function') saveOyviaState();
          renderThread();
          UI.toast('Tâche annulée');
        },
      });
    }
  });

  elTemplate.addEventListener('change', () => {
    const i = elTemplate.value; if (i === '') return;
    const c = CONVERSATIONS.find(x => x.id === activeId);
    const { r, l, v } = ctxOf(c);
    elInput.value = fillVars(MODELES[i].texte, r, l, v);
    elInput.focus(); elTemplate.value = '';
    elInput.style.height = 'auto'; elInput.style.height = Math.min(elInput.scrollHeight, 140) + 'px';
  });

  function send() {
    const txt = elInput.value.trim(); if (!txt) return;
    const c = CONVERSATIONS.find(x => x.id === activeId);
    c.messages.push({ de: 'hote', texte: txt, heure: 'À l\'instant' });
    c.horodatage = 'À l\'instant';
    elInput.value = ''; elInput.style.height = 'auto';
    renderThread(); UI.toast('Message envoyé');
  }
  document.getElementById('msg-send').addEventListener('click', send);
  elInput.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
  elInput.addEventListener('input', () => { elInput.style.height = 'auto'; elInput.style.height = Math.min(elInput.scrollHeight, 140) + 'px'; });

  // Le filtre peut venir de l'URL (?filtre=ia) : on aligne le bouton actif sur
  // l'état réel, sinon la barre annoncerait « Toutes » sur une liste filtrée.
  document.querySelectorAll('#msg-filters button').forEach(b => b.classList.toggle('is-active', b.dataset.filtre === filtre));
  renderThread();
})();
