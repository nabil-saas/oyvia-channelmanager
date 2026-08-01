/* ============================================================
   OYVIA — Site web & réservations directes

   Ce que cette page pilote : une vitrine publique (../site.html) et
   surtout son moteur de réservation. L'intérêt n'est pas décoratif —
   une réservation prise en direct économise la commission de l'OTA.
   L'écran affiche donc en permanence ce que le direct a déjà rapporté.

   Point de conception important : le site lit le MÊME calendrier que
   le reste d'Oyvia (nuitsOccupees), et une demande acceptée crée une
   réservation ordinaire de canal « direct ». Pas de stock parallèle,
   donc pas de surréservation possible entre le site et les plateformes.
   ============================================================ */
Layout.init('site');

(function () {
  const S = SITE_WEB;
  const save = () => { if (typeof saveOyviaState === 'function') saveOyviaState(); };
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

  /* ============================================================
     ASSISTANT DE CRÉATION — 5 étapes

     Pourquoi un assistant plutôt que les onglets d'emblée : régler une
     politique d'annulation ou un enregistrement DNS n'a aucun sens tant
     que le site n'a ni nom, ni couleurs, ni logements. On demande donc
     d'abord le strict nécessaire, dans l'ordre où on y pense, puis on
     ouvre les réglages fins.
     ============================================================ */
  let etape = 0;

  function renderWizard() {
    const e = SITE_ETAPES[etape];
    const dernier = etape === SITE_ETAPES.length - 1;
    document.getElementById('sw-wizard').innerHTML = `
      <div class="wz">
        <div class="wz__head">
          <p class="eyebrow">Création de votre site</p>
          <h1>${e.titre}</h1>
          <p class="wz__sous">${e.sous}</p>
        </div>

        <ol class="wz__pas">
          ${SITE_ETAPES.map((x, i) => `
            <li class="${i === etape ? 'is-courant' : ''} ${i < etape ? 'is-fait' : ''}">
              <span>${i < etape ? '✓' : i + 1}</span>${x.titre}
            </li>`).join('')}
        </ol>

        <div class="card card--pad wz__corps">${corpsEtape(e.id)}</div>

        ${dernier ? blocFinal() : `
          <div class="wz__actions">
            ${etape > 0 ? '<button class="btn btn--ghost" data-wz="prev">Retour</button>' : ''}
            <button class="btn btn--primary" data-wz="next" ${e.complete() ? '' : 'disabled'}>Continuer</button>
            ${e.complete() ? '' : '<span class="wz__bloque">Renseignez ce champ pour continuer</span>'}
          </div>`}
      </div>`;
  }

  function corpsEtape(id) {
    if (id === 'identite') return `
      <div class="field">
        <label class="field__label" for="wz-titre">Nom de la conciergerie</label>
        <input class="input" id="wz-titre" data-s="titre" value="${esc(S.titre)}" placeholder="Conciergerie Marrakech" />
      </div>
      <div class="field mt-4">
        <label class="field__label" for="wz-slogan">Slogan</label>
        <input class="input" id="wz-slogan" data-s="slogan" value="${esc(S.slogan)}" placeholder="Location d'exception" />
      </div>
      <div class="field mt-4">
        <span class="field__label">Logo</span>
        <div class="wz-logo">
          <div class="wz-logo__apercu">${S.logo
            ? `<img src="${S.logo}" alt="Logo actuel" />`
            : `<span>${esc((S.titre || '?').slice(0, 2).toUpperCase())}</span>`}</div>
          <div class="wz-logo__actions">
            <label class="btn btn--secondary btn--sm">
              ${S.logo ? 'Changer' : 'Ajouter un logo'}
              <input type="file" accept="image/*" id="wz-logo-file" hidden />
            </label>
            ${S.logo ? '<button class="btn btn--ghost btn--sm" data-wz="logo-off">Retirer</button>' : ''}
          </div>
        </div>
        <span class="field__hint">PNG transparent conseillé. L'image est réduite automatiquement.</span>
      </div>`;

    if (id === 'couleurs') return `
      <div class="vc-grid">
        <div class="field">
          <label class="field__label" for="wz-c1">Couleur principale</label>
          <div class="wz-couleur">
            <input type="color" id="wz-c1" data-s="couleur" value="${esc(S.couleur)}" />
            <input class="input" data-s="couleur" value="${esc(S.couleur)}" aria-label="Code hexadécimal de la couleur principale" />
          </div>
          <span class="field__hint">Boutons, liens et accents.</span>
        </div>
        <div class="field">
          <label class="field__label" for="wz-c2">Couleur secondaire</label>
          <div class="wz-couleur">
            <input type="color" id="wz-c2" data-s="couleurSecondaire" value="${esc(S.couleurSecondaire)}" />
            <input class="input" data-s="couleurSecondaire" value="${esc(S.couleurSecondaire)}" aria-label="Code hexadécimal de la couleur secondaire" />
          </div>
          <span class="field__hint">Titres et pied de page.</span>
        </div>
      </div>
      <div class="wz-apercu" style="--c1:${esc(S.couleur)};--c2:${esc(S.couleurSecondaire)}">
        <b>Aperçu</b>
        <div class="wz-apercu__bloc">
          <span class="wz-apercu__titre">${esc(S.titre || 'Votre conciergerie')}</span>
          <span class="wz-apercu__btn">Réserver</span>
        </div>
      </div>`;

    if (id === 'photos') return `
      <div class="wz-photos" id="wz-photos">
        ${S.photos.map((p, i) => `
          <div class="wz-photo">
            <img src="${p}" alt="Photo d'accueil ${i + 1}" />
            <button class="wz-photo__x" data-wz="photo-off" data-i="${i}" aria-label="Retirer cette photo">×</button>
          </div>`).join('')}
        ${S.photos.length < SITE_PHOTOS_MAX ? `
          <label class="wz-photo wz-photo--add">
            <span>+</span>Ajouter une image
            <input type="file" accept="image/*" multiple id="wz-photo-file" hidden />
          </label>` : ''}
      </div>
      <p class="field__hint mt-3">
        ${S.photos.length > 1
          ? `${S.photos.length} images : elles défileront automatiquement sur l'accueil.`
          : S.photos.length === 1
            ? `Une seule image : ajoutez-en d'autres pour obtenir un carrousel.`
            : `Sans photo, l'accueil affichera un aplat de votre couleur principale.`}
        Maximum ${SITE_PHOTOS_MAX} photos.
      </p>`;

    if (id === 'contact') return blocContacts();

    // logements
    const publiables = logementsPubliables();
    if (!publiables.length) return `
      <div class="empty">
        <h4>Aucun logement à publier</h4>
        <p>Ajoutez d'abord un logement, ou publiez le site en vitrine seule — vous pourrez les rattacher ensuite.</p>
        <a class="btn btn--secondary btn--sm mt-4" href="logements.html">Ajouter un logement</a>
      </div>`;
    const tous = logementsDuSite().length === publiables.length;
    return `
      <div class="row" style="align-items:center;gap:var(--sp-3);margin-bottom:var(--sp-4)">
        <p class="text-sm text-muted grow">Sélectionnez les biens à afficher (${logementsDuSite().length}/${publiables.length}).</p>
        <button type="button" class="btn btn--secondary btn--sm" data-wz="tous">${tous ? 'Tout désélectionner' : 'Tout sélectionner'}</button>
      </div>
      <div class="sw-logs">
        ${publiables.map(l => {
          const on = S.logementsPublies.includes(l.id);
          return `
          <label class="sw-log ${on ? 'is-on' : ''}">
            <input type="checkbox" data-log="${l.id}" ${on ? 'checked' : ''} />
            <span class="sw-log__thumb" style="background:${l.couleur}">${l.ville.slice(0, 2).toUpperCase()}</span>
            <span class="sw-log__meta"><b>${esc(l.nom)}</b><small>${esc(l.ville)} · ${l.capacite} voyageurs</small></span>
            <span class="sw-log__prix"><b>${formatEuro(l.tarifBase)}</b><small>/ nuit</small></span>
          </label>`;
        }).join('')}
      </div>`;
  }

  /* ---------- Moyens de contact ----------
     Un même bloc sert à l'assistant et aux réglages : deux formulaires
     distincts pour la même donnée finiraient par diverger. */
  function blocContacts() {
    return `
      <div class="sw-contacts">
        ${SITE_CONTACTS.map(c => {
          const conf = (S.contacts || {})[c.id] || { actif: false, valeur: '' };
          return `
          <div class="sw-contact ${conf.actif ? 'is-on' : ''}">
            <label class="sw-contact__tete">
              <input type="checkbox" data-contact-actif="${c.id}" ${conf.actif ? 'checked' : ''} />
              <span class="sw-contact__ic">${icone(c.icone)}</span>
              <b>${c.label}</b>
            </label>
            <input class="input" data-contact-val="${c.id}" value="${esc(conf.valeur)}"
              placeholder="${c.placeholder}" ${conf.actif ? '' : 'disabled'}
              aria-label="${c.label}" />
          </div>`;
        }).join('')}
      </div>
      <label class="vc-check mt-4 ${S.whatsappFlottant ? 'is-on' : ''}">
        <input type="checkbox" id="sw-wa-flottant" ${S.whatsappFlottant ? 'checked' : ''}
          ${contactValeur('whatsapp') ? '' : 'disabled'} />
        <span class="vc-check__txt">Bouton WhatsApp flottant
          <small>${contactValeur('whatsapp')
            ? "Une pastille verte en bas à droite de chaque page, qui ouvre la conversation."
            : "Renseignez d'abord un numéro WhatsApp ci-dessus."}</small></span>
      </label>`;
  }

  const icone = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;

  function blocFinal() {
    return `
      <div class="wz-fin">
        <div class="wz-fin__ic">✓</div>
        <b>Tout est prêt !</b>
        <p>Vous pouvez publier votre site dès maintenant, ou l'enregistrer en brouillon pour le peaufiner
           (réservation, caution, contrat…).</p>
        <div class="wz-fin__actions">
          <button class="btn btn--primary" data-wz="publier">Publier mon site</button>
          <button class="btn btn--secondary" data-wz="brouillon">Enregistrer en brouillon</button>
        </div>
        <button class="btn btn--ghost btn--sm mt-4" data-wz="prev">Retour</button>
      </div>`;
  }

  /* ---------- Interactions de l'assistant ---------- */
  function terminer(publie) {
    S.configure = true;
    S.statut = publie ? 'publie' : 'brouillon';
    // Un brouillon ne doit pas être accessible publiquement : le statut et
    // la mise en ligne sont deux facettes de la même décision.
    S.actif = publie;
    save();
    afficher();
    UI.toast(publie ? `Site publié sur ${urlSite()}` : 'Site enregistré en brouillon');
  }

  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-wz]');
    if (!b) return;
    const a = b.dataset.wz;
    if (a === 'next') { etape = Math.min(SITE_ETAPES.length - 1, etape + 1); renderWizard(); window.scrollTo(0, 0); }
    if (a === 'prev') { etape = Math.max(0, etape - 1); renderWizard(); window.scrollTo(0, 0); }
    if (a === 'publier') terminer(true);
    if (a === 'rouvrir') { S.configure = false; etape = 0; save(); afficher(); window.scrollTo(0, 0); }
    if (a === 'brouillon') terminer(false);
    if (a === 'logo-off') { S.logo = null; save(); renderWizard(); }
    if (a === 'tous') {
      const ids = logementsPubliables().map(l => l.id);
      S.logementsPublies = S.logementsPublies.length === ids.length ? [] : ids;
      save(); renderWizard();
    }
    if (a === 'photo-off') { S.photos.splice(Number(b.dataset.i), 1); save(); renderWizard(); }
  });

  // Import d'images : réduction avant stockage, sinon le quota localStorage
  // saute et c'est TOUT l'état de l'application qui cesse d'être sauvegardé.
  document.addEventListener('change', async e => {
    if (e.target.id === 'wz-logo-file') {
      const f = e.target.files[0]; if (!f) return;
      try {
        S.logo = await reduireImage(f, SITE_LOGO_LARGEUR_MAX);
        save(); renderWizard();
      } catch { UI.toast('Image illisible', false); }
      return;
    }
    if (e.target.id === 'wz-photo-file') {
      const fichiers = [...e.target.files].slice(0, SITE_PHOTOS_MAX - S.photos.length);
      if (!fichiers.length) return;
      for (const f of fichiers) {
        try { S.photos.push(await reduireImage(f, SITE_IMAGE_LARGEUR_MAX)); }
        catch { UI.toast(`« ${f.name} » n'a pas pu être lue`, false); }
      }
      save(); renderWizard();
    }
  });

  /* ---------- Aiguillage : assistant ou réglages ---------- */
  function afficher() {
    const enCreation = !S.configure;
    document.getElementById('sw-wizard').classList.toggle('hidden', !enCreation);
    document.getElementById('sw-reglages').classList.toggle('hidden', enCreation);
    if (enCreation) renderWizard(); else renderAll();
  }

  /* ---------- Bandeau d'état ---------- */
  function renderHero() {
    const st = statsReservationsDirectes();
    const nbPub = logementsDuSite().length;
    document.getElementById('sw-hero').innerHTML = `
      <div class="sw-hero ${S.actif ? '' : 'is-off'}">
        <div class="sw-hero__main">
          <span class="badge ${S.statut === 'brouillon' ? 'badge--warning' : S.actif ? 'badge--positive' : 'badge--neutral'}">${
            S.statut === 'brouillon' ? 'Brouillon' : S.actif ? 'En ligne' : 'Hors ligne'}</span>
          <b class="sw-hero__url">${esc(urlSite())}</b>
          <label class="switch" title="Mettre le site en ligne ou hors ligne">
            <input type="checkbox" id="sw-actif" ${S.actif ? 'checked' : ''}><span class="switch__track"></span>
          </label>
        </div>
        <div class="sw-hero__stats">
          <div><b>${nbPub}</b><small>logement${nbPub > 1 ? 's' : ''} publié${nbPub > 1 ? 's' : ''}</small></div>
          <div><b>${S.stats.visites30j.toLocaleString('fr-FR')}</b><small>visites (30 j)</small></div>
          <div><b>${S.stats.demandes30j}</b><small>demandes (30 j)</small></div>
          <div><b>${formatEuro(st.commissionEvitee)}</b><small>de commission évitée</small></div>
        </div>
        <div class="sw-hero__liens">
          <button class="btn btn--ghost btn--sm" data-wz="rouvrir">Reprendre l'assistant de création</button>
          ${S.statut === 'brouillon' ? '<button class="btn btn--primary btn--sm" data-wz="publier">Publier le site</button>' : ''}
        </div>
        <p class="sw-hero__note">
          ${st.nombre} réservation${st.nombre > 1 ? 's' : ''} en direct pour ${formatEuro(st.ca)} de chiffre d'affaires.
          La commission évitée est estimée à ${Math.round(COMMISSION_OTA_MOYENNE * 100)} %, taux moyen constaté sur les OTA —
          c'est une hypothèse, pas un montant facturé.
        </p>
      </div>`;
  }

  /* ---------- Onglet Vitrine ----------
     L'objectif énoncé : « modifier son site comme sur WordPress, en
     simplifié ». On expose donc l'identité, l'apparence, la couverture,
     les contacts et surtout les SECTIONS — ajoutables, déplaçables,
     masquables — sans jamais demander à toucher au code. */
  function renderVitrine() {
    const th = getTheme(S.theme);
    document.getElementById('sw-pane-vitrine').innerHTML = `
      <div class="card card--pad">
        <p class="eyebrow mb-4">Identité</p>
        <div class="form-grid">
          <div class="field">
            <label class="field__label" for="sw-titre">Nom affiché</label>
            <input class="input" id="sw-titre" data-s="titre" value="${esc(S.titre)}" />
          </div>
          <div class="field">
            <label class="field__label" for="sw-slogan">Slogan</label>
            <input class="input" id="sw-slogan" data-s="slogan" value="${esc(S.slogan)}" />
          </div>
        </div>
        <div class="field mt-4">
          <span class="field__label">Logo</span>
          <div class="wz-logo">
            <div class="wz-logo__apercu">${S.logo
              ? `<img src="${S.logo}" alt="Logo" />`
              : `<span>${esc((S.titre || '?').slice(0, 2).toUpperCase())}</span>`}</div>
            <div class="wz-logo__actions">
              <label class="btn btn--secondary btn--sm">${S.logo ? 'Changer' : 'Ajouter un logo'}
                <input type="file" accept="image/*" id="wz-logo-file" hidden /></label>
              ${S.logo ? '<button class="btn btn--ghost btn--sm" data-wz="logo-off">Retirer</button>' : ''}
            </div>
          </div>
        </div>
      </div>

      <div class="card card--pad mt-4">
        <p class="eyebrow mb-4">Thème</p>
        <div class="sw-themes">
          ${SITE_THEMES.map(t => `
            <label class="sw-theme ${S.theme === t.id ? 'is-on' : ''}">
              <input type="radio" name="sw-theme" data-theme="${t.id}" ${S.theme === t.id ? 'checked' : ''} />
              <span class="sw-theme__apercu" style="background:linear-gradient(180deg, ${t.fond} 52%, ${t.alt} 52%)">
                <i style="background:${t.c1}"></i><i style="background:${t.c2}"></i>
              </span>
              <b>${t.label}</b><small>${t.desc}</small>
            </label>`).join('')}
        </div>
        <p class="vc-hint">Choisir un thème remplace les quatre couleurs ci-dessous. Vous pouvez ensuite les ajuster une par une.</p>
      </div>

      <div class="card card--pad mt-4">
        <p class="eyebrow mb-4">Couleurs</p>
        <div class="sw-couleurs">
          ${[['couleur','Principale','Boutons, liens, accents'],
             ['couleurSecondaire','Secondaire','Pied de page et aplats'],
             ['couleurTitres','Titres','Grands titres de section'],
             ['couleurTexte','Texte','Paragraphes'],
             ['couleurFond','Fond','Arrière-plan des pages']].map(([k, lab, aide]) => `
            <div class="field">
              <label class="field__label">${lab}</label>
              <div class="wz-couleur">
                <input type="color" data-s="${k}" value="${esc(S[k] || '#000000')}" aria-label="${lab}" />
                <input class="input" data-s="${k}" value="${esc(S[k] || '')}" aria-label="Code ${lab}" />
              </div>
              <span class="field__hint">${aide}</span>
            </div>`).join('')}
        </div>
      </div>

      <div class="card card--pad mt-4">
        <p class="eyebrow mb-4">Couverture</p>
        <div class="wz-photos">
          ${S.photos.map((p, i) => `
            <div class="wz-photo"><img src="${p}" alt="Photo ${i + 1}" />
              <button class="wz-photo__x" data-wz="photo-off" data-i="${i}" aria-label="Retirer">×</button></div>`).join('')}
          ${S.photos.length < SITE_PHOTOS_MAX ? `
            <label class="wz-photo wz-photo--add"><span>+</span>Ajouter une image
              <input type="file" accept="image/*" multiple id="wz-photo-file" hidden /></label>` : ''}
        </div>
        <div class="vc-grid mt-4">
          <div class="field">
            <label class="field__label" for="sw-haut">Hauteur de la couverture — ${S.couvertureHauteur} %</label>
            <input type="range" min="40" max="100" step="2" id="sw-haut" data-n="couvertureHauteur" value="${S.couvertureHauteur}" />
          </div>
          <div class="field">
            <label class="field__label" for="sw-voile">Voile sombre — ${S.couvertureVoile} %</label>
            <input type="range" min="0" max="80" step="5" id="sw-voile" data-n="couvertureVoile" value="${S.couvertureVoile}" />
            <span class="field__hint">Sans voile, un titre blanc devient illisible sur une photo claire.</span>
          </div>
        </div>
        <div class="form-grid mt-4">
          <div class="field">
            <label class="field__label" for="sw-accroche">Titre d'accueil</label>
            <input class="input" id="sw-accroche" data-s="accroche" value="${esc(S.accroche)}" />
          </div>
          <div class="field">
            <label class="field__label" for="sw-sous">Sous-titre</label>
            <input class="input" id="sw-sous" data-s="sousAccroche" value="${esc(S.sousAccroche || '')}" />
          </div>
        </div>
      </div>

      <div class="card card--pad mt-4">
        <p class="eyebrow mb-4">Moyens de contact</p>
        ${blocContacts()}
      </div>

      <div class="card card--pad mt-4">
        <div class="row" style="align-items:center;gap:var(--sp-3)">
          <p class="eyebrow grow">Sections de la page</p>
          <select class="select" id="sw-ajout-type" style="max-width:200px">
            ${SITE_TYPES_SECTION.map(t => {
              const pris = t.unique && S.sections.some(x => x.type === t.id);
              return `<option value="${t.id}" ${pris ? 'disabled' : ''}>${t.label}${pris ? ' (déjà présent)' : ''}</option>`;
            }).join('')}
          </select>
          <button class="btn btn--secondary btn--sm" data-sec="add">Ajouter</button>
        </div>
        <div class="sw-secs mt-4">${S.sections.map((sec, i) => secHTML(sec, i)).join('')}</div>
      </div>`;
  }

  /* Une section repliée montre son titre et son état ; dépliée, elle
     expose ses champs. Tout déplier d'un coup rendrait la page illisible
     dès qu'on dépasse trois ou quatre sections. */
  let secOuverte = null;

  function secHTML(sec, i) {
    const t = SITE_TYPES_SECTION.find(x => x.id === sec.type) || {};
    const ouvert = secOuverte === sec.id;
    return `
      <div class="sw-sec ${sec.actif ? '' : 'is-off'}">
        <div class="sw-sec__tete">
          <div class="sw-sec__ordre">
            <button class="icon-btn" data-sec="up" data-id="${sec.id}" ${i === 0 ? 'disabled' : ''} aria-label="Monter">↑</button>
            <button class="icon-btn" data-sec="down" data-id="${sec.id}" ${i === S.sections.length - 1 ? 'disabled' : ''} aria-label="Descendre">↓</button>
          </div>
          <div class="grow">
            <b>${esc(sec.titre || t.label)}</b>
            <small>${t.label}${sec.actif ? '' : ' · masquée'}</small>
          </div>
          <label class="switch" title="Afficher cette section">
            <input type="checkbox" data-sec-actif="${sec.id}" ${sec.actif ? 'checked' : ''}><span class="switch__track"></span>
          </label>
          <button class="btn btn--ghost btn--sm" data-sec="toggle" data-id="${sec.id}">${ouvert ? 'Replier' : 'Modifier'}</button>
          <button class="icon-btn icon-btn--danger" data-sec="del" data-id="${sec.id}" aria-label="Supprimer la section">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2m2 0v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V6"/></svg>
          </button>
        </div>
        ${ouvert ? `
        <div class="sw-sec__corps">
          <div class="form-grid">
            <div class="field">
              <label class="field__label">Surtitre</label>
              <input class="input" data-sec-champ="surtitre" data-id="${sec.id}" value="${esc(sec.surtitre || '')}" />
            </div>
            <div class="field">
              <label class="field__label">Titre</label>
              <input class="input" data-sec-champ="titre" data-id="${sec.id}" value="${esc(sec.titre || '')}" />
            </div>
          </div>
          ${['texte', 'proprietaire'].includes(sec.type) ? `
            <div class="field mt-4">
              <label class="field__label">Texte</label>
              <textarea class="textarea" data-sec-champ="texte" data-id="${sec.id}" style="min-height:88px">${esc(sec.texte || '')}</textarea>
            </div>` : ''}
          ${sec.type === 'proprietaire' ? `
            <div class="field mt-4">
              <label class="field__label">Libellé du bouton</label>
              <input class="input" data-sec-champ="bouton" data-id="${sec.id}" value="${esc(sec.bouton || '')}" />
            </div>` : ''}
          ${sec.type === 'cartes' ? `
            <div class="sw-cartes mt-4">
              ${(sec.items || []).map((it, j) => `
                <div class="sw-carte">
                  <input class="input" data-carte="titre" data-id="${sec.id}" data-j="${j}" value="${esc(it.titre)}" placeholder="Titre" />
                  <textarea class="textarea" data-carte="texte" data-id="${sec.id}" data-j="${j}" placeholder="Description">${esc(it.texte)}</textarea>
                  <button class="icon-btn icon-btn--danger" data-sec="carte-del" data-id="${sec.id}" data-j="${j}" aria-label="Retirer la carte">×</button>
                </div>`).join('')}
              <button class="btn btn--secondary btn--sm" data-sec="carte-add" data-id="${sec.id}">Ajouter une carte</button>
            </div>` : ''}
          ${sec.type === 'logements' ? `<p class="field__hint mt-4">Les biens affichés se choisissent dans l'onglet « Logements publiés ».</p>` : ''}
          ${sec.type === 'contact' ? `<p class="field__hint mt-4">Les coordonnées se règlent dans « Moyens de contact » ci-dessus.</p>` : ''}
          <div class="field mt-4">
            <label class="field__label">Fond de la section</label>
            <select class="select" data-sec-champ="fond" data-id="${sec.id}">
              <option value="" ${!sec.fond ? 'selected' : ''}>Fond principal</option>
              <option value="alt" ${sec.fond === 'alt' ? 'selected' : ''}>Fond alterné</option>
            </select>
          </div>
        </div>` : ''}
      </div>`;
  }

  /* ---------- Onglet Logements ----------
     Un logement en brouillon ou hors ligne n'est pas proposé : publier
     une annonce incomplète sur son propre site est pire que sur une OTA,
     puisqu'il n'y a personne pour la modérer. */
  function renderLogements() {
    const publiables = logementsPubliables();
    const exclus = LOGEMENTS.length - publiables.length;
    document.getElementById('sw-pane-logements').innerHTML = `
      <div class="card card--pad">
        <div class="row" style="align-items:center;gap:var(--sp-3)">
          <div class="grow">
            <p class="eyebrow">Logements publiés sur le site</p>
            <span class="text-xs text-muted">${logementsDuSite().length} sur ${publiables.length} publiables${exclus ? ` · ${exclus} annonce${exclus > 1 ? 's' : ''} en brouillon, non proposable${exclus > 1 ? 's' : ''}` : ''}</span>
          </div>
          <button class="btn btn--secondary btn--sm" id="sw-tout">${logementsDuSite().length === publiables.length ? 'Tout retirer' : 'Tout publier'}</button>
        </div>
        <div class="sw-logs mt-4">
          ${publiables.map(l => {
            const on = S.logementsPublies.includes(l.id);
            return `
            <label class="sw-log ${on ? 'is-on' : ''}">
              <input type="checkbox" data-log="${l.id}" ${on ? 'checked' : ''} />
              <span class="sw-log__thumb" style="background:${l.couleur}">${l.ville.slice(0, 2).toUpperCase()}</span>
              <span class="sw-log__meta">
                <b>${esc(l.nom)}</b>
                <small>${esc(l.ville)} · ${l.capacite} voyageurs · ${formatEuro(l.tarifBase)} / nuit</small>
              </span>
              <span class="sw-log__prix">
                <b>${formatEuro(prixDirect(l))}</b>
                <small>en direct</small>
              </span>
            </label>`;
          }).join('')}
        </div>
      </div>`;
  }

  /* ---------- Onglet Réservation directe ---------- */
  function renderResa() {
    const r = S.reservation;
    document.getElementById('sw-pane-resa').innerHTML = `
      <div class="vc-intro">
        Le moteur lit vos disponibilités réelles : un voyageur ne peut pas demander une nuit
        déjà vendue sur Airbnb ou Booking. Une demande acceptée devient une réservation
        <b>de canal « direct »</b>, visible dans le calendrier comme n'importe quelle autre.
      </div>

      <div class="card card--pad">
        <label class="vc-check ${r.actif ? 'is-on' : ''}">
          <input type="checkbox" id="sw-resa-actif" ${r.actif ? 'checked' : ''} />
          <span class="vc-check__txt">Accepter les réservations depuis le site<small>Décochez pour n'afficher qu'une vitrine et un formulaire de contact.</small></span>
        </label>
      </div>

      <div class="card card--pad mt-4 ${r.actif ? '' : 'is-muted'}">
        <p class="eyebrow mb-4">Comment une demande est confirmée</p>
        <div class="sw-modes">
          ${SITE_MODES_RESA.map(m => `
            <label class="vc-check ${r.mode === m.id ? 'is-on' : ''}">
              <input type="radio" name="sw-mode" data-mode="${m.id}" ${r.mode === m.id ? 'checked' : ''} ${r.actif ? '' : 'disabled'} />
              <span class="vc-check__txt">${m.label}<small>${m.desc}</small></span>
            </label>`).join('')}
        </div>
        <p class="vc-hint" id="sw-mode-hint"></p>
      </div>

      <div class="card card--pad mt-4 ${r.actif ? '' : 'is-muted'}">
        <p class="eyebrow mb-4">Conditions affichées au voyageur</p>
        <div class="vc-grid">
          <div class="field">
            <label class="field__label" for="sw-remise">Remise directe</label>
            <select class="select" id="sw-remise" data-r="remiseDirecte">
              ${[0, 5, 10, 15].map(v => `<option value="${v}" ${r.remiseDirecte === v ? 'selected' : ''}>${v ? `-${v} %` : 'Aucune'}</option>`).join('')}
            </select>
            <span class="field__hint" id="sw-remise-hint"></span>
          </div>
          <div class="field">
            <label class="field__label" for="sw-acompte">Acompte à la réservation</label>
            <select class="select" id="sw-acompte" data-r="acompte">
              ${[0, 20, 30, 50, 100].map(v => `<option value="${v}" ${r.acompte === v ? 'selected' : ''}>${v ? `${v} %` : 'Aucun'}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label class="field__label" for="sw-nuitsmin">Séjour minimum</label>
            <select class="select" id="sw-nuitsmin" data-r="nuitsMin">
              ${[1, 2, 3, 5, 7].map(v => `<option value="${v}" ${r.nuitsMin === v ? 'selected' : ''}>${v} nuit${v > 1 ? 's' : ''}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label class="field__label" for="sw-delai">Délai avant l'arrivée</label>
            <select class="select" id="sw-delai" data-r="delaiMin">
              ${[0, 1, 2, 7].map(v => `<option value="${v}" ${r.delaiMin === v ? 'selected' : ''}>${v ? `${v} jour${v > 1 ? 's' : ''}` : 'Le jour même'}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label class="field__label" for="sw-annul">Politique d'annulation</label>
            <select class="select" id="sw-annul" data-r="annulation">
              ${POLITIQUES_ANNULATION.map(p => `<option value="${p.id}" ${r.annulation === p.id ? 'selected' : ''}>${p.label}</option>`).join('')}
            </select>
          </div>
        </div>
        <label class="vc-check mt-4 ${r.paiementEnLigne ? 'is-on' : ''}">
          <input type="checkbox" id="sw-paiement" ${r.paiementEnLigne ? 'checked' : ''} ${r.actif ? '' : 'disabled'} />
          <span class="vc-check__txt">Paiement en ligne par carte<small>Sans lui, vous devrez réclamer l'acompte à la main après chaque demande.</small></span>
        </label>
      </div>`;
    majHints();
  }

  // On chiffre l'effet des réglages sur le parc réel : c'est plus parlant
  // qu'un pourcentage abstrait.
  function majHints() {
    const r = S.reservation;
    const h = document.getElementById('sw-remise-hint');
    if (h) {
      const logs = logementsDuSite();
      const moy = logs.length ? Math.round(logs.reduce((s, l) => s + l.tarifBase, 0) / logs.length) : 0;
      h.innerHTML = r.remiseDirecte
        ? `Nuit moyenne ${formatEuro(moy)} → <b>${formatEuro(Math.round(moy * (1 - r.remiseDirecte / 100)))}</b> en direct. Vous restez gagnant tant que la remise est sous les ${Math.round(COMMISSION_OTA_MOYENNE * 100)} % de commission.`
        : `Sans remise, le direct n'a pas d'avantage visible pour le voyageur — mais vous gardez la totalité des ${Math.round(COMMISSION_OTA_MOYENNE * 100)} %.`;
    }
    const m = document.getElementById('sw-mode-hint');
    if (m) {
      m.innerHTML = r.mode === 'instantane'
        ? `Les dates se bloquent dès le paiement : le voyageur est sûr d'avoir sa place, et vous ne pouvez pas la revendre par erreur. En contrepartie, vous ne filtrez pas les demandes.`
        : `Vous gardez la main sur chaque séjour, mais les dates restent vendables ailleurs tant que vous n'avez pas répondu : une demande peut donc devenir caduque.`;
    }
  }

  /* ---------- Onglet Domaine ---------- */
  function renderDomaine() {
    document.getElementById('sw-pane-domaine').innerHTML = `
      <div class="card card--pad">
        <p class="eyebrow mb-4">Adresse Oyvia</p>
        <div class="sw-domaine">
          <input class="input" id="sw-sousdomaine" data-s="sousDomaine" value="${esc(S.sousDomaine)}" />
          <span class="sw-domaine__suffixe">.oyvia.site</span>
        </div>
        <span class="field__hint">Disponible immédiatement, certificat de sécurité inclus. C'est l'adresse utilisée tant qu'aucun domaine personnalisé n'est vérifié.</span>
      </div>

      <div class="card card--pad mt-4">
        <p class="eyebrow mb-4">Domaine personnalisé</p>
        <div class="field">
          <label class="field__label" for="sw-domaine">Votre nom de domaine</label>
          <input class="input" id="sw-domaine" data-s="domainePerso" placeholder="www.mon-site.fr" value="${esc(S.domainePerso)}" />
        </div>
        ${S.domainePerso ? `
          <div class="sw-dns mt-4">
            <p class="sw-dns__titre">${S.domaineVerifie
              ? '<span class="badge badge--positive">Vérifié</span> Le site répond sur ce domaine.'
              : '<span class="badge badge--warning">En attente</span> Ajoutez cet enregistrement chez votre hébergeur, puis lancez la vérification.'}</p>
            <div class="sw-dns__row"><span>Type</span><b class="font-mono">CNAME</b></div>
            <div class="sw-dns__row"><span>Nom</span><b class="font-mono">${esc(S.domainePerso.replace(/^https?:\/\//, '').split('.')[0])}</b></div>
            <div class="sw-dns__row"><span>Valeur</span><b class="font-mono">${esc(S.sousDomaine)}.oyvia.site</b></div>
            ${S.domaineVerifie ? '' : `<button class="btn btn--secondary btn--sm mt-4" id="sw-verifier">Vérifier le domaine</button>`}
          </div>`
        : `<p class="text-sm text-muted mt-4">Renseignez un domaine pour obtenir les enregistrements DNS à créer.</p>`}
      </div>`;
  }

  /* ---------- Rendu global ---------- */
  function renderAll() { renderHero(); renderVitrine(); renderLogements(); renderResa(); renderDomaine(); }
  afficher();

  /* ---------- Onglets ---------- */
  document.getElementById('sw-tabs').addEventListener('click', e => {
    const b = e.target.closest('button[data-tab]'); if (!b) return;
    document.querySelectorAll('#sw-tabs button').forEach(x => x.classList.toggle('is-active', x === b));
    document.querySelectorAll('.tabpane').forEach(p => p.classList.toggle('is-active', p.dataset.pane === b.dataset.tab));
  });

  /* ---------- Saisie : enregistrée au fil de l'eau ---------- */
  document.addEventListener('input', e => {
    const t = e.target;
    if (t.dataset.s) {
      S[t.dataset.s] = t.value;
      save();
      if (t.dataset.s === 'sousDomaine') renderHero();
      // Les deux champs d'une couleur (nuancier et code hexa) désignent la
      // même valeur : les laisser diverger donnerait deux vérités à l'écran.
      if (['couleur', 'couleurSecondaire'].includes(t.dataset.s)) {
        document.querySelectorAll(`[data-s="${t.dataset.s}"]`).forEach(x => { if (x !== t) x.value = t.value; });
        const ap = document.querySelector('.wz-apercu');
        if (ap) ap.style.setProperty(t.dataset.s === 'couleur' ? '--c1' : '--c2', t.value);
      }
      // Le nom nourrit l'initiale du logo par défaut et l'aperçu.
      if (t.dataset.s === 'titre') {
        const ini = document.querySelector('.wz-logo__apercu span');
        if (ini) ini.textContent = (t.value || '?').slice(0, 2).toUpperCase();
        const ttl = document.querySelector('.wz-apercu__titre');
        if (ttl) ttl.textContent = t.value || 'Votre conciergerie';
        const btn = document.querySelector('[data-wz="next"]');
        if (btn) btn.disabled = !t.value.trim();
      }
      return;
    }
    // Champs d'une section
    if (t.dataset.secChamp) {
      const sec = S.sections.find(x => x.id === t.dataset.id);
      if (sec) { sec[t.dataset.secChamp] = t.value; save(); }
      return;
    }
    if (t.dataset.carte) {
      const sec = S.sections.find(x => x.id === t.dataset.id);
      if (sec && sec.items[t.dataset.j]) { sec.items[t.dataset.j][t.dataset.carte] = t.value; save(); }
      return;
    }
    // Valeur d'un canal de contact
    if (t.dataset.contactVal) {
      S.contacts[t.dataset.contactVal].valeur = t.value;
      save();
      // Le bouton flottant n'a de sens qu'avec un numéro WhatsApp.
      if (t.dataset.contactVal === 'whatsapp') {
        const f = document.getElementById('sw-wa-flottant');
        if (f) f.disabled = !contactValeur('whatsapp');
      }
      const btn = document.querySelector('[data-wz="next"]');
      if (btn) btn.disabled = !contactsActifs().length;
      return;
    }
    // Curseurs de couverture : le libellé porte la valeur, il doit suivre.
    if (t.dataset.n) {
      S[t.dataset.n] = parseInt(t.value, 10);
      const lab = t.previousElementSibling;
      if (lab) lab.textContent = lab.textContent.replace(/—.*$/, `— ${t.value} %`);
      save();
      return;
    }
    if (t.dataset.r) {
      const num = ['remiseDirecte', 'acompte', 'nuitsMin', 'delaiMin'].includes(t.dataset.r);
      S.reservation[t.dataset.r] = num ? parseInt(t.value, 10) : t.value;
      majHints(); save(); return;
    }
  });

  document.addEventListener('change', e => {
    const t = e.target;
    const visuel = () => {
      const lab = t.closest('.vc-check, .sw-theme, .sw-log');
      if (!lab) return;
      if (t.type === 'radio') {
        const grp = lab.parentElement;
        grp.querySelectorAll('.vc-check, .sw-theme').forEach(x => x.classList.remove('is-on'));
      }
      lab.classList.toggle('is-on', t.checked);
    };

    if (t.id === 'sw-actif') { S.actif = t.checked; save(); renderHero(); UI.toast(S.actif ? 'Site en ligne' : 'Site hors ligne'); return; }
    if (t.dataset.theme) {
      // Un thème n'est pas qu'une étiquette : il pose ses cinq couleurs.
      // Les laisser inchangées donnerait un thème « nuit » sur fond blanc.
      const th = getTheme(t.dataset.theme);
      S.theme = th.id;
      S.couleur = th.c1; S.couleurSecondaire = th.c2;
      S.couleurTitres = th.titres; S.couleurTexte = th.texte; S.couleurFond = th.fond;
      save(); renderVitrine();
      UI.toast(`Thème « ${th.label} » appliqué`);
      return;
    }
    if (t.dataset.contactActif) {
      S.contacts[t.dataset.contactActif].actif = t.checked;
      save(); renderVitrine();
      const btn = document.querySelector('[data-wz="next"]');
      if (btn) btn.disabled = !contactsActifs().length;
      return;
    }
    if (t.id === 'sw-wa-flottant') { S.whatsappFlottant = t.checked; visuel(); save(); return; }
    if (t.dataset.secActif) {
      const sec = S.sections.find(x => x.id === t.dataset.secActif);
      if (sec) { sec.actif = t.checked; save(); renderVitrine(); }
      return;
    }
    if (t.id === 'sw-resa-actif') { S.reservation.actif = t.checked; save(); renderResa(); return; }
    if (t.dataset.mode) { S.reservation.mode = t.dataset.mode; visuel(); majHints(); save(); return; }
    if (t.id === 'sw-paiement') { S.reservation.paiementEnLigne = t.checked; visuel(); save(); return; }
    if (t.dataset.log) {
      const id = t.dataset.log;
      const i = S.logementsPublies.indexOf(id);
      if (t.checked && i === -1) S.logementsPublies.push(id);
      if (!t.checked && i > -1) S.logementsPublies.splice(i, 1);
      visuel(); save(); renderHero(); renderLogements(); majHints();
      return;
    }
  });

  /* ---------- Sections : ordre, ajout, suppression ---------- */
  function getSec(id) { return S.sections.find(x => x.id === id); }

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-sec]');
    if (!b) return;
    const a = b.dataset.sec, id = b.dataset.id, sec = id ? getSec(id) : null;

    if (a === 'add') {
      const type = document.getElementById('sw-ajout-type').value;
      const nouvelle = nouvelleSection(type);
      S.sections.push(nouvelle);
      secOuverte = nouvelle.id;              // on ouvre ce qu'on vient d'ajouter
      save(); renderVitrine();
      return;
    }
    if (a === 'toggle') { secOuverte = secOuverte === id ? null : id; renderVitrine(); return; }
    if (a === 'up' || a === 'down') {
      const i = S.sections.indexOf(sec);
      const j = a === 'up' ? i - 1 : i + 1;
      if (j < 0 || j >= S.sections.length) return;
      S.sections.splice(j, 0, S.sections.splice(i, 1)[0]);
      save(); renderVitrine();
      return;
    }
    if (a === 'del') {
      UI.confirm({
        title: `Supprimer « ${sec.titre || 'cette section'} » ?`,
        message: "La section disparaîtra du site. Pour la retirer sans perdre son contenu, utilisez plutôt l'interrupteur.",
        confirmText: 'Supprimer', cancelText: 'Annuler', danger: true,
        onConfirm() {
          S.sections.splice(S.sections.indexOf(sec), 1);
          save(); renderVitrine(); UI.toast('Section supprimée');
        },
      });
      return;
    }
    if (a === 'carte-add') { (sec.items = sec.items || []).push({ titre: 'Nouvel atout', texte: '' }); save(); renderVitrine(); return; }
    if (a === 'carte-del') { sec.items.splice(Number(b.dataset.j), 1); save(); renderVitrine(); return; }
  });

  document.addEventListener('click', e => {
    if (e.target.closest('#sw-tout')) {
      const publiables = logementsPubliables().map(l => l.id);
      S.logementsPublies = S.logementsPublies.length === publiables.length ? [] : publiables;
      save(); renderHero(); renderLogements(); majHints();
      return;
    }
    if (e.target.closest('#sw-verifier')) {
      // Démo : la propagation DNS prend en réalité de quelques minutes à 48 h.
      S.domaineVerifie = true; save(); renderHero(); renderDomaine();
      UI.toast('Domaine vérifié — le site répond sur votre adresse');
      return;
    }
    if (e.target.closest('#sw-publier')) {
      // « Publier » sur un brouillon doit réellement le mettre en ligne :
      // se contenter d'enregistrer laisserait le site invisible.
      if (S.statut === 'brouillon' || !S.actif) { terminer(true); return; }
      save();
      UI.toast(`Site publié sur ${urlSite()}`);
    }
  });
})();
