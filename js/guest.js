/* ============================================================
   OYVIA — Guest Page (page voyageur publique, sans compte)
   Rendu à partir d'une réservation (par défaut R07).
   ============================================================ */
(function () {
  const params = new URLSearchParams(location.search);
  const r = getReservation(params.get('r') || 'R07') || getReservation('R07');
  const l = getLogement(r.logementId);
  const v = r.voyageurId ? getVoyageur(r.voyageurId) : null;
  const prenom = (v ? v.nom : r.voyageur).split(' ')[0];
  const ic = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;

  const GUIDE = [
    { ic: '<path d="M5 12.55a11 11 0 0 1 14 0M2 8.5a16 16 0 0 1 20 0M8.5 16.5a6 6 0 0 1 7 0M12 20h.01"/>', t: 'Wifi', p: `${l.wifi.ssid}` },
    { ic: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', t: 'Départ', p: 'Avant 11h le jour du départ' },
    { ic: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>', t: 'Sur place', p: `${l.capacite} voyageurs · ${l.chambres} ch.` },
    { ic: '<path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zM2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z"/>', t: 'Quartier', p: `${l.quartier}, ${l.ville}` },
    { ic: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>', t: 'Adresse', p: l.adresse },
    { ic: '<path d="M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4zM6 1v3M10 1v3M14 1v3"/>', t: 'Petit-déj', p: 'Café & thé offerts en cuisine' },
  ];

  document.getElementById('g-shell').innerHTML = `
    <div class="g-top">
      <div class="g-brand"><img src="assets/oyvia-logo.svg" alt="Oyvia" class="brand-logo"></div>
      <span class="g-top__tag">Votre séjour</span>
    </div>

    <div class="g-hero">
      <div class="g-hero__cover" style="background:linear-gradient(135deg, ${l.couleur}, var(--ch-airbnb))">
        <h1>${l.nom}</h1>
      </div>
      <div class="g-hero__body">
        <p class="g-hero__welcome">Bienvenue ${prenom} 👋</p>
        <p class="g-hero__sub">${l.ville} · ${l.quartier} — nous sommes ravis de vous accueillir.</p>
        <div class="g-dates">
          <div class="g-dates__box"><small>Arrivée</small><b>${formatDate(r.arrivee, { moisLong: false })}</b></div>
          <div class="g-dates__arrow">${ic('<path d="M5 12h14M13 6l6 6-6 6"/>')}</div>
          <div class="g-dates__box"><small>Départ</small><b>${formatDate(r.depart, { moisLong: false })}</b></div>
        </div>
      </div>
    </div>

    <div class="g-section">
      <h2>${ic('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>')} Fiche de police voyageurs</h2>
      <div class="g-card">
        <p class="text-soft text-sm mb-4">Conformément à la réglementation, chaque voyageur doit compléter sa fiche individuelle avant l'arrivée. Ces informations sont conservées avec votre réservation et ne sont communiquées qu'aux autorités si la loi l'exige.</p>
        <div id="fp-section"><!-- injecté --></div>
      </div>
    </div>

    <div class="g-section">
      <h2>${ic('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>')} Accès au logement</h2>
      <div class="g-codes">
        <div class="g-code"><small>Code porte</small><b>${l.codeAcces}</b></div>
        <div class="g-code"><small>Étage</small><b>2ᵉ</b></div>
        <div class="g-code g-code--full"><small>Wifi — ${l.wifi.ssid}</small><b>${l.wifi.pass}</b></div>
      </div>
    </div>

    <div class="g-section">
      <h2>${ic('<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>')} Instructions d'arrivée</h2>
      <div class="g-card"><div class="g-steps">
        <div class="g-step"><span class="g-step__num">1</span><div class="g-step__txt"><b>Rendez-vous au ${l.adresse.split(',')[0]}</b><p>Le quartier ${l.quartier} est facilement accessible.</p></div></div>
        <div class="g-step"><span class="g-step__num">2</span><div class="g-step__txt"><b>Boîte à clés à droite de la porte</b><p>Composez le code <strong>${l.codeAcces}</strong> puis récupérez les clés.</p></div></div>
        <div class="g-step"><span class="g-step__num">3</span><div class="g-step__txt"><b>Installez-vous</b><p>Le wifi et le guide de bienvenue vous attendent à l'intérieur. Arrivée à partir de 15h.</p></div></div>
      </div></div>
    </div>

    <div class="g-section">
      <h2>${ic('<path d="M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>')} Le guide de bienvenue</h2>
      <div class="g-guide">
        ${GUIDE.map(g => `<div class="g-tile"><div class="g-tile__ic">${ic(g.ic)}</div><b>${g.t}</b><p>${g.p}</p></div>`).join('')}
      </div>
    </div>

    <div class="g-section">
      <a class="g-cta" href="#" onclick="event.preventDefault(); alert('Un message a été envoyé à votre hôte. (démo)')">
        ${ic('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>')}
        Contacter votre hôte
      </a>
    </div>

    <p class="g-foot">Séjour géré avec <a href="index.html">Oyvia</a> · Merci de votre visite ✦</p>`;

  /* ---------- Fiches de police (une par voyageur de la réservation) ---------- */
  (function fichesPolice() {
    const TYPE_PIECE = { cni: 'Carte nationale d\'identité', passeport: 'Passeport', titre_sejour: 'Titre de séjour' };
    const total = r.pers || 1;
    let editingSlot = null;

    function ficheRowHTML(i, f) {
      if (f) {
        return `<div class="fp-row">
          <div class="fp-row__who">
            <span class="fp-row__ic fp-row__ic--done">${ic('<path d="M20 6 9 17l-5-5"/>')}</span>
            <div><b class="fp-row__name">${f.prenom} ${f.nom}</b><p class="fp-row__meta">${f.nationalite} · ${TYPE_PIECE[f.typePiece]}</p></div>
          </div>
          <button type="button" class="btn btn--secondary btn--sm" data-fp-edit="${i}">Modifier</button>
        </div>`;
      }
      return `<div class="fp-row">
        <div class="fp-row__who">
          <span class="fp-row__ic fp-row__ic--pending">${ic('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>')}</span>
          <div><b class="fp-row__name">Voyageur ${i + 1}</b><p class="fp-row__meta">Fiche à compléter</p></div>
        </div>
        <button type="button" class="btn btn--primary btn--sm" data-fp-edit="${i}">Remplir la fiche</button>
      </div>`;
    }

    function renderSection() {
      const fiches = getFichesPolice(r.id);
      const done = fiches.filter(Boolean).length;
      const pct = Math.round((done / total) * 100);
      document.getElementById('fp-section').innerHTML = `
        <div class="fp-summary">
          <div class="progress" style="flex:1"><div class="progress__bar ${done === total ? 'progress__bar--sage' : ''}" style="width:${pct}%"></div></div>
          <span class="fp-summary__count">${done}/${total} complétée${total > 1 ? 's' : ''}</span>
        </div>
        <div class="fp-list">${Array.from({ length: total }).map((_, i) => ficheRowHTML(i, fiches[i])).join('')}</div>`;
      document.querySelectorAll('[data-fp-edit]').forEach(b => b.addEventListener('click', () => openModal(parseInt(b.dataset.fpEdit, 10))));
    }

    function openModal(i) {
      editingSlot = i;
      const f = getFichesPolice(r.id)[i] || {};
      const set = (id, val) => { document.getElementById(id).value = val || ''; };
      set('fp-civilite', f.civilite || 'M.');
      set('fp-nom', f.nom);
      set('fp-prenom', f.prenom);
      set('fp-naissance', f.dateNaissance);
      set('fp-lieu', f.lieuNaissance);
      set('fp-nationalite', f.nationalite);
      set('fp-adresse', f.adresse);
      set('fp-type-piece', f.typePiece || 'cni');
      set('fp-numero', f.numeroPiece);
      document.getElementById('fp-consent').checked = !!f.soumisLe;
      document.getElementById('fp-modal-title').textContent = `Fiche de police — Voyageur ${i + 1}`;
      openOverlay();
    }

    function openOverlay() {
      let scrim = document.getElementById('g-scrim');
      if (!scrim) { scrim = document.createElement('div'); scrim.id = 'g-scrim'; scrim.className = 'overlay'; document.body.appendChild(scrim); scrim.addEventListener('click', closeOverlay); }
      scrim.classList.add('is-open');
      document.getElementById('fp-modal').classList.add('is-open');
    }
    function closeOverlay() {
      document.getElementById('fp-modal').classList.remove('is-open');
      const s = document.getElementById('g-scrim'); if (s) s.classList.remove('is-open');
    }
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeOverlay(); });

    function toast(msg, ok = true) {
      let zone = document.querySelector('.toast-zone');
      if (!zone) { zone = document.createElement('div'); zone.className = 'toast-zone'; document.body.appendChild(zone); }
      const t = document.createElement('div');
      t.className = 'toast';
      const svgIc = ok ? '<path d="M20 6 9 17l-5-5"/>' : '<path d="M18 6 6 18M6 6l12 12"/>';
      t.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${svgIc}</svg> ${msg}`;
      zone.appendChild(t);
      setTimeout(() => t.remove(), 2600);
    }

    document.getElementById('fp-close').addEventListener('click', closeOverlay);
    document.getElementById('fp-cancel').addEventListener('click', closeOverlay);
    document.getElementById('fp-save').addEventListener('click', () => {
      const val = id => document.getElementById(id).value.trim();
      const nom = val('fp-nom'), prenom = val('fp-prenom'), naissance = val('fp-naissance'),
        lieu = val('fp-lieu'), nationalite = val('fp-nationalite'), adresse = val('fp-adresse'), numero = val('fp-numero');
      const consent = document.getElementById('fp-consent').checked;
      if (!nom || !prenom || !naissance || !nationalite || !numero) { toast('Merci de compléter tous les champs obligatoires', false); return; }
      if (!consent) { toast('Merci de certifier l\'exactitude des informations', false); return; }
      saveFichePolice(r.id, editingSlot, {
        civilite: document.getElementById('fp-civilite').value,
        nom, prenom, dateNaissance: naissance, lieuNaissance: lieu, nationalite, adresse,
        typePiece: document.getElementById('fp-type-piece').value, numeroPiece: numero,
      });
      closeOverlay();
      renderSection();
      toast('Fiche enregistrée, merci !');
    });

    renderSection();
  })();
})();
