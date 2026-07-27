/* ============================================================
   OYVIA — Messagerie unifiée (3 colonnes)
   Liste des conversations · fil de discussion · contexte résa.
   ============================================================ */
Layout.init('messagerie');

(function () {
  const AVA = ['', 'avatar--v2', 'avatar--v3', 'avatar--v4'];
  const PAY_BADGE = { paye: 'badge--positive', acompte: 'badge--warning', impaye: 'badge--danger', rembourse: 'badge--neutral' };
  const initiales = nom => nom.split(' ').map(m => m[0]).slice(0, 2).join('').toUpperCase();

  const MODELES = [
    { nom: 'Instructions d\'arrivée', texte: 'Bonjour {prenom}, voici les informations pour votre arrivée au {nom_logement} : {adresse}. Code d\'accès : {code_acces}. Wifi : {wifi}. Arrivée possible à partir de 15h. Bon voyage !' },
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
  let activeId = (visibles.find(c => c.nonLu > 0) || visibles[0] || CONVERSATIONS[0]).id;

  const ctxOf = c => { const r = getReservation(c.reservationId); return { r, l: getLogement(r.logementId), v: r.voyageurId ? getVoyageur(r.voyageurId) : null }; };

  function fillVars(t, r, l, v) {
    return t
      .replace(/{prenom}/g, (v ? v.nom : r.voyageur).split(' ')[0])
      .replace(/{nom_logement}/g, l.nom)
      .replace(/{adresse}/g, l.adresse)
      .replace(/{code_acces}/g, l.codeAcces)
      .replace(/{wifi}/g, `${l.wifi.ssid} / ${l.wifi.pass}`)
      .replace(/{date_arrivee}/g, formatDate(r.arrivee));
  }

  /* ---------- Liste des conversations ---------- */
  function renderList() {
    const q = elSearch.value.trim().toLowerCase();
    const list = conversationsVisibles().filter(c => {
      const { l } = ctxOf(c);
      return !q || `${c.voyageur || getReservation(c.reservationId).voyageur} ${l.nom}`.toLowerCase().includes(q);
    });
    elConvs.innerHTML = list.map((c, i) => {
      const { r, l } = ctxOf(c);
      const nom = r.voyageur;
      const last = c.messages[c.messages.length - 1];
      const canalTxt = CANAL_LABEL[c.canal];
      const dotClass = `badge-canal--${c.canal}`;
      return `<div class="msg-conv ${c.id === activeId ? 'is-active' : ''}" data-id="${c.id}">
        <span class="avatar ${AVA[i % 4]}">${initiales(nom)}</span>
        <div class="msg-conv__body">
          <div class="msg-conv__top"><span class="msg-conv__name">${nom}</span><span class="msg-conv__time">${c.horodatage}</span></div>
          <div class="msg-conv__sub"><span class="badge-canal ${dotClass}" style="font-size:var(--fs-xs)"><span class="dot"></span>${canalTxt}</span></div>
          <div class="msg-conv__top"><span class="msg-conv__preview">${last.texte}</span>${c.nonLu ? `<span class="msg-conv__unread">${c.nonLu}</span>` : ''}</div>
        </div>
      </div>`;
    }).join('') || '<div class="empty"><h4>Aucune conversation</h4></div>';
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
      c.messages.map(m => `<div class="msg-bubble msg-bubble--${m.de === 'hote' ? 'out' : 'in'}">
        ${m.texte}<div class="msg-bubble__time">${m.heure}</div></div>`).join('');
    elThread.scrollTop = elThread.scrollHeight;

    renderCtx(c, r, l, v);
    renderList();
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
    renderThread();
    elLayout.classList.add('is-thread-open'); // bascule vers le fil sur mobile (une seule colonne visible à la fois)
  });
  elSearch.addEventListener('input', renderList);

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

  renderThread();
})();
