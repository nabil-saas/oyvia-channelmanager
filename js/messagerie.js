/* ============================================================
   OYVIA — Messagerie unifiée (3 colonnes)
   Liste des conversations · fil de discussion · contexte résa.

   Intégration de Vivi (cf. js/data.js) :
     - une conversation dont Vivi a une proposition en attente est
       signalée dans la liste et filtrable (« IA à relire ») ;
     - les messages écrits par Vivi sont identifiés comme tels ;
     - la proposition en attente s'affiche au-dessus du composeur,
       avec Approuver / Éditer / Refuser.
   Approuver poste réellement le message (viviApprouver), donc la
   page Vivi > Audit et cette page ne peuvent pas se contredire.
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
  let editionIA = null;   // id de la réponse Vivi en cours d'édition

  // Liens entrants : ?conv=C05 (depuis l'audit de Vivi) ou ?filtre=ia
  // (depuis le chat de Vivi, « les réponses qui vous attendent »).
  const params = new URLSearchParams(location.search);
  if (params.get('filtre') === 'ia') filtre = 'ia';
  const convParam = params.get('conv');
  if (convParam && CONVERSATIONS.some(c => c.id === convParam)) activeId = convParam;
  else if (filtre === 'ia') {
    const premiere = viviReponsesEnAttente().find(r => visibles.some(c => c.id === r.conversationId));
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
      if (filtre === 'ia' && !getViviEnAttente(c.id)) return false;
      return true;
    });

    const vides = {
      tout:  'Aucune conversation',
      nonlu: 'Tout est lu 🎉',
      ia:    'Aucune réponse de Vivi à relire',
    };

    elConvs.innerHTML = list.map((c, i) => {
      const { r, l } = ctxOf(c);
      const nom = r.voyageur;
      const last = c.messages[c.messages.length - 1];
      const attente = getViviEnAttente(c.id);
      // Un pictogramme discret suffit : ⏳ Vivi attend votre aval,
      // ✦ Vivi a déjà répondu seule sur ce fil.
      const marque = attente
        ? `<span class="msg-conv__ia msg-conv__ia--attente" title="Réponse de Vivi à relire — ${attente.raison}">⏳ IA</span>`
        : getViviReponses(c.id).length
          ? `<span class="msg-conv__ia" title="Vivi a répondu automatiquement sur cette conversation">✦ IA</span>`
          : '';
      return `<div class="msg-conv ${c.id === activeId ? 'is-active' : ''}" data-id="${c.id}">
        <span class="avatar ${AVA[i % 4]}">${initiales(nom)}</span>
        <div class="msg-conv__body">
          <div class="msg-conv__top"><span class="msg-conv__name">${nom}</span><span class="msg-conv__time">${c.horodatage}</span></div>
          <div class="msg-conv__sub"><span class="badge-canal badge-canal--${c.canal}" style="font-size:var(--fs-xs)"><span class="dot"></span>${CANAL_LABEL[c.canal]}</span>${marque}</div>
          <div class="msg-conv__top"><span class="msg-conv__preview">${last.texte}</span>${c.nonLu ? `<span class="msg-conv__unread">${c.nonLu}</span>` : ''}</div>
        </div>
      </div>`;
    }).join('') || `<div class="empty"><h4>${vides[filtre]}</h4></div>`;

    // Le compteur du filtre IA rend le travail restant visible sans cliquer.
    const btnIA = document.querySelector('#msg-filters [data-filtre="ia"]');
    if (btnIA) {
      const n = viviReponsesEnAttente().filter(r => canalActif((CONVERSATIONS.find(c => c.id === r.conversationId) || {}).canal)).length;
      btnIA.textContent = n ? `IA à relire · ${n}` : 'IA à relire';
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
            ? `<span class="msg-bubble__vivi" title="Vivi · confiance ${rep.confiance} % · ${viviOrigine(rep)}">✦ ${rep.corrigee ? 'Vivi, corrigée par vous' : rep.approuvee ? 'Vivi, approuvée par vous' : 'Envoyé par Vivi'}</span> · ${m.heure}`
            : m.heure}</div>
        </div>`;
      }).join('');
    elThread.scrollTop = elThread.scrollHeight;

    renderVivi(c);
    renderCtx(c, r, l, v);
    renderList();
  }

  /* ---------- Bloc Vivi au-dessus du composeur ---------- */
  // Trois états possibles, et un seul affiché à la fois :
  //   1. une proposition attend votre aval → Approuver / Éditer / Refuser
  //   2. Vivi a déjà répondu seule sur ce fil → rappel discret
  //   3. l'offre n'inclut pas l'IA → invitation à en savoir plus, une seule
  //      fois par conversation et seulement si le voyageur attend une réponse
  function renderVivi(c) {
    const zone = document.getElementById('msg-vivi');
    if (!zone) return;

    const attente = getViviEnAttente(c.id);
    const niveau = viviNiveauIA();

    if (attente) {
      const enEdition = editionIA === attente.id;
      zone.className = 'msg-vivi msg-vivi--attente';
      zone.innerHTML = `
        <div class="msg-vivi__head">
          <span class="msg-vivi__ic"><img src="../assets/vivi.svg" alt="" aria-hidden="true" /></span>
          <div class="grow">
            <b>${attente.statut === 'escaladee' ? 'Vivi a escaladé ce message' : 'Réponse proposée par Vivi'}</b>
            <small>${attente.raison} · confiance ${attente.confiance} %</small>
          </div>
          <span class="badge ${VIVI_STATUT_BADGE[attente.statut]}">${VIVI_STATUT_LABEL[attente.statut]}</span>
        </div>
        ${enEdition
          ? `<textarea class="textarea msg-vivi__edit" id="msg-vivi-txt">${attente.reponse.replace(/</g, '&lt;')}</textarea>`
          : `<p class="msg-vivi__texte">${attente.reponse}</p>`}
        <div class="msg-vivi__actions">
          ${enEdition
            ? `<button type="button" class="btn btn--primary btn--sm" data-ia-save="${attente.id}">Envoyer ma version</button>
               <button type="button" class="btn btn--ghost btn--sm" data-ia-cancel>Annuler</button>`
            : `<button type="button" class="btn btn--primary btn--sm" data-ia-ok="${attente.id}">Approuver et envoyer</button>
               <button type="button" class="btn btn--secondary btn--sm" data-ia-edit="${attente.id}">Éditer</button>
               <button type="button" class="btn btn--ghost btn--sm" data-ia-no="${attente.id}">Refuser</button>`}
        </div>`;
      return;
    }

    const deja = getViviReponses(c.id);
    if (deja.length) {
      // La plus récente = celle qui porte le msgIndex le plus élevé.
      const derniere = deja.reduce((a, b) => (b.msgIndex > a.msgIndex ? b : a));
      const auto = deja.filter(r => !r.approuvee).length;
      zone.className = 'msg-vivi msg-vivi--ok';
      zone.innerHTML = `
        <div class="msg-vivi__head">
          <span class="msg-vivi__ic"><img src="../assets/vivi.svg" alt="" aria-hidden="true" /></span>
          <div class="grow">
            <b>${auto ? 'Vivi a répondu automatiquement' : 'Réponse de Vivi validée'}</b>
            <small>${deja.length} réponse${deja.length > 1 ? 's' : ''} sur ce fil · la dernière ${viviOrigine(derniere)}</small>
          </div>
          <a class="btn btn--ghost btn--sm" href="vivi.html#audit">Voir l'audit</a>
        </div>`;
      return;
    }

    if (niveau !== 'avancee' && c.nonLu > 0) {
      zone.className = 'msg-vivi msg-vivi--promo';
      zone.innerHTML = `
        <div class="msg-vivi__head">
          <span class="msg-vivi__ic"><img src="../assets/vivi.svg" alt="" aria-hidden="true" /></span>
          <div class="grow">
            <b>Vivi pourrait répondre à ce message</b>
            <small>L'IA Avancée répond seule aux questions simples, dans la langue du voyageur.</small>
          </div>
          <a class="btn btn--secondary btn--sm" href="vivi.html">En savoir plus</a>
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
      <div class="rp-row"><span>Montant</span><span class="fw-semibold">${formatEuro(r.montant)}</span></div>
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
