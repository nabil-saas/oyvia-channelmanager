/* ============================================================
   OYVIA — Espace prestataire : connexion + planning personnel
   Chaque prestataire ne voit que SES interventions à venir,
   filtrables par type (ménage, check-in, maintenance…).
   ============================================================ */
(function () {
  const JOURS_LONG = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const TYPE_BADGE = { menage: 'badge--accent', checkin: 'badge--positive', maintenance: 'badge--warning', linge: 'badge--neutral' };
  const STA_NEXT = { a_faire: 'en_cours', en_cours: 'termine', termine: 'a_faire' };
  const STA_LABEL = { a_faire: 'Démarrer', en_cours: 'Terminer', termine: 'Terminé ✓' };
  const initiales = n => n.split(' ').map(m => m[0]).slice(0, 2).join('').toUpperCase();
  const params = new URLSearchParams(location.search);

  const sel = document.getElementById('pr-who');
  sel.innerHTML = PRESTATAIRES.map(p => `<option value="${p.id}">${p.nom} · ${p.role}</option>`).join('');
  if (params.get('p') && getPrestataire(params.get('p'))) sel.value = params.get('p');

  let currentId = null;
  let filterType = 'all';

  function myTasks() {
    return TACHES
      .filter(t => t.prestataireId === currentId && parseDate(t.date) >= parseDate(AUJOURDHUI))
      .sort((a, b) => (a.date + a.heure).localeCompare(b.date + b.heure));
  }

  /* ---------- Lecture de la date de prise de vue (EXIF) ----------

     Aucune dépendance : on ouvre le JPEG et on va chercher le champ
     DateTimeOriginal que l'appareil y a écrit. Cette date-là vaut
     preuve ; celle du dépôt ne vaut que constat d'arrivée.

     On ne lit que les 128 premiers kilo-octets : l'en-tête EXIF est
     toujours au tout début du fichier, et charger 4 Mo de photo en
     mémoire pour en lire vingt caractères serait absurde. */
  function lireDateExif(fichier) {
    return new Promise(resolve => {
      const lecteur = new FileReader();
      lecteur.onerror = () => resolve(null);
      lecteur.onload = () => {
        try { resolve(extraireDateExif(new DataView(lecteur.result))); }
        catch (e) { resolve(null); }
      };
      lecteur.readAsArrayBuffer(fichier.slice(0, 131072));
    });
  }

  function extraireDateExif(vue) {
    if (vue.byteLength < 4 || vue.getUint16(0) !== 0xFFD8) return null;   // pas un JPEG
    let i = 2;
    while (i + 4 <= vue.byteLength) {
      if (vue.getUint8(i) !== 0xFF) return null;                          // flux mal formé
      const marqueur = vue.getUint8(i + 1);
      if (marqueur === 0xDA || marqueur === 0xD9) return null;            // on entre dans l'image
      const taille = vue.getUint16(i + 2);
      if (marqueur === 0xE1 && i + 10 <= vue.byteLength
          && vue.getUint32(i + 4) === 0x45786966) {                       // APP1, signature « Exif »
        return lireRepertoiresExif(vue, i + 10);
      }
      i += 2 + taille;
    }
    return null;
  }

  function lireRepertoiresExif(vue, tiff) {
    const ordre = vue.getUint16(tiff);
    const petit = ordre === 0x4949;                                       // « II » : petit-boutiste
    if (!petit && ordre !== 0x4D4D) return null;
    const u16 = o => vue.getUint16(o, petit);
    const u32 = o => vue.getUint32(o, petit);
    if (u16(tiff + 2) !== 0x002A) return null;

    const champ = (repertoire, tag) => {
      if (repertoire + 2 > vue.byteLength) return null;
      const n = u16(repertoire);
      for (let k = 0; k < n; k++) {
        const e = repertoire + 2 + k * 12;
        if (e + 12 > vue.byteLength) return null;
        if (u16(e) === tag) return e;
      }
      return null;
    };

    const ifd0 = tiff + u32(tiff + 4);
    const repertoires = [];
    // 0x8769 pointe vers le sous-répertoire EXIF, là où vit DateTimeOriginal.
    const pointeur = champ(ifd0, 0x8769);
    if (pointeur) repertoires.push(tiff + u32(pointeur + 8));
    repertoires.push(ifd0);                                               // 0x0132 en secours

    // Par ordre de valeur probante : déclenchement, numérisation, modification.
    for (const rep of repertoires) {
      for (const tag of [0x9003, 0x9004, 0x0132]) {
        const e = champ(rep, tag);
        if (!e) continue;
        const longueur = u32(e + 4);
        if (longueur < 19 || longueur > 32) continue;
        const o = tiff + u32(e + 8);
        let s = '';
        for (let k = 0; k < longueur - 1 && o + k < vue.byteLength; k++) s += String.fromCharCode(vue.getUint8(o + k));
        const m = s.trim().match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
        if (m) {
          const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`;
          if (dateExifPlausible(iso)) return iso;
        }
      }
    }
    return null;
  }

  /* Un appareil mal réglé écrit parfois 1980 ou une date dans le futur.
     Mieux vaut retomber sur l'heure de dépôt, qui est juste, que d'afficher
     une date de prise de vue fausse sous une étiquette « preuve ». */
  function dateExifPlausible(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return false;
    const maintenant = new Date();
    const demain = new Date(maintenant.getTime() + 86400000);
    const ilYaDixAns = new Date(maintenant.getFullYear() - 10, 0, 1);
    return d <= demain && d >= ilYaDixAns;
  }

  /* L'horodatage du dépôt, au format du modèle : « 2026-07-23T18:04 ». */
  function maintenantISO() {
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }

  function photoSection(t) {
    const photos = preuvesTriees(t);
    const thumbs = photos.map(photo => {
      const h = horodatagePreuve(photo);
      const src = srcPreuve(photo);
      // L'affichage est trié par date, le stockage reste dans l'ordre d'ajout :
      // la suppression doit viser le rang RÉEL, sinon on efface la voisine.
      const rang = (t.photos || []).indexOf(photo);
      return `
      <div class="pr-photos__item">
        <img src="${src}" alt="Photo de l'intervention" />
        ${h ? `<span class="pr-photos__date ${h.source === 'depot' ? 'pr-photos__date--depot' : ''}"
                 title="${PREUVE_SOURCES[h.source].aide}">${formatHorodatage(h.quand, { heureSeule: true })}</span>` : ''}
        <button type="button" class="pr-photos__del" data-photo-del="${t.id}::${rang}" aria-label="Supprimer la photo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>`;
    }).join('');
    return `<div class="pr-photos">
      <p class="pr-photos__label">Photos de l'intervention${photos.length ? ` (${photos.length})` : ''}</p>
      <div class="pr-photos__grid">
        ${thumbs}
        <label class="pr-photos__add">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
          <span>Ajouter</span>
          <input type="file" accept="image/*" multiple data-photo-input="${t.id}" hidden />
        </label>
      </div>
      <p class="pr-photos__aide">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
        Chaque photo est datée automatiquement. En cas de litige sur l'état du
        logement, c'est cette date qui fait foi — photographiez sur place, pas plus tard.
      </p>
    </div>`;
  }

  function taskCard(t) {
    const l = getLogement(t.logementId);
    return `<div class="pr-task ${t.statut === 'termine' ? 'is-done' : ''}" data-id="${t.id}">
      <div class="pr-task__head">
        <span class="badge ${TYPE_BADGE[t.type] || 'badge--neutral'}">${TACHE_LABEL[t.type] || t.type}</span>
        <span class="pr-task__time">${t.heure}</span>
      </div>
      <b>${l.nom}</b>
      <div class="pr-task__loc">${l.ville} · ${l.adresse}</div>
      ${t.note ? `<div class="pr-task__loc" style="margin-top:4px">📝 ${t.note}</div>` : ''}
      <div class="pr-task__access">
        <span class="pr-task__code">Code porte <b>${l.codeAcces}</b></span>
        <span class="pr-task__code">Wifi <b>${l.wifi.ssid}</b></span>
      </div>
      <div class="pr-task__foot">
        <button class="pr-status pr-status--${t.statut}" data-status="${t.id}">${STA_LABEL[t.statut]}</button>
      </div>
      ${t.statut === 'termine' ? photoSection(t) : ''}
    </div>`;
  }

  function render() {
    const p = getPrestataire(currentId);
    document.getElementById('pr-user').innerHTML =
      `<div class="pr-user__meta"><b>${p.nom}</b><small>${p.role} · ${p.zone}</small></div><span class="avatar">${initiales(p.nom)}</span>`;
    document.getElementById('pr-hello').innerHTML =
      `<b>Bonjour ${p.nom.split(' ')[0]} 👋</b><span>Voici vos interventions à venir.</span>`;

    const all = myTasks();
    // Plus de montant : une intervention n'est plus chiffrée. On montre le
    // travail accompli, seul indicateur qui a du sens côté prestataire.
    const faites = statsPrestataire(p.id).effectuees;
    document.getElementById('pr-stats').innerHTML =
      `<div class="pr-stat"><small>Tâches à venir</small><b>${all.length}</b></div>
       <div class="pr-stat"><small>Tâches effectuées</small><b>${faites}</b></div>`;

    const types = [...new Set(all.map(t => t.type))];
    if (!types.includes(filterType)) filterType = 'all';
    document.getElementById('pr-filter').innerHTML =
      `<span class="pr-chip ${filterType === 'all' ? 'is-active' : ''}" data-f="all">Toutes</span>` +
      types.map(ty => `<span class="pr-chip ${filterType === ty ? 'is-active' : ''}" data-f="${ty}">${TACHE_LABEL[ty] || ty}</span>`).join('');

    const list = all.filter(t => filterType === 'all' || t.type === filterType);
    const byDay = {};
    list.forEach(t => { (byDay[t.date] = byDay[t.date] || []).push(t); });
    const days = Object.keys(byDay).sort();
    document.getElementById('pr-tasks').innerHTML = days.length
      ? days.map(d => {
          const dd = parseDate(d);
          const label = (d === AUJOURDHUI ? 'Aujourd\'hui · ' : '') + `${JOURS_LONG[dd.getDay()]} ${dd.getDate()} ${MOIS_LONG[dd.getMonth()]}`;
          return `<div class="pr-day ${d === AUJOURDHUI ? 'pr-day--today' : ''}">${label}</div>${byDay[d].map(taskCard).join('')}`;
        }).join('')
      : '<div class="empty"><h4>Aucune intervention à venir</h4><p>Votre planning est à jour. 🎉</p></div>';
  }

  function signIn() {
    currentId = sel.value;
    filterType = 'all';
    document.getElementById('pr-login').classList.add('hidden');
    document.getElementById('pr-app').classList.remove('hidden');
    render();
  }

  document.getElementById('pr-form').addEventListener('submit', signIn);
  document.getElementById('pr-signin').addEventListener('click', signIn);
  document.getElementById('pr-logout').addEventListener('click', () => {
    document.getElementById('pr-app').classList.add('hidden');
    document.getElementById('pr-login').classList.remove('hidden');
  });
  document.getElementById('pr-filter').addEventListener('click', e => {
    const c = e.target.closest('[data-f]'); if (c) { filterType = c.dataset.f; render(); }
  });
  document.getElementById('pr-tasks').addEventListener('click', e => {
    const del = e.target.closest('[data-photo-del]');
    if (del) {
      const [taskId, idx] = del.dataset.photoDel.split('::');
      const t = TACHES.find(x => x.id === taskId);
      if (t && t.photos) t.photos.splice(parseInt(idx, 10), 1);
      render();
      return;
    }
    const b = e.target.closest('[data-status]'); if (!b) return;
    const t = TACHES.find(x => x.id === b.dataset.status);
    t.statut = STA_NEXT[t.statut];
    render();
    if (typeof UI !== 'undefined') UI.toast(t.statut === 'termine' ? 'Intervention terminée' : t.statut === 'en_cours' ? 'Intervention démarrée' : 'Statut mis à jour');
  });
  document.getElementById('pr-tasks').addEventListener('change', e => {
    const input = e.target.closest('[data-photo-input]'); if (!input || !input.files.length) return;
    const t = TACHES.find(x => x.id === input.dataset.photoInput);
    if (!t) return;
    t.photos = t.photos || [];
    const fichiers = [...input.files];
    const deposeLe = maintenantISO();
    // Deux lectures par fichier : l'image elle-même en data URL (base64), qui
    // survit à localStorage et donc aux rechargements, et l'en-tête EXIF pour
    // la date de prise de vue. La seconde peut échouer sans gêner la première.
    Promise.all(fichiers.map(fichier => Promise.all([
      new Promise(resolve => {
        const lecteur = new FileReader();
        lecteur.onload = () => resolve(lecteur.result);
        lecteur.onerror = () => resolve(null);
        lecteur.readAsDataURL(fichier);
      }),
      lireDateExif(fichier),
    ]).then(([src, prisLe]) => (src ? { src, prisLe, deposeLe } : null))))
      .then(ajouts => {
        const valides = ajouts.filter(Boolean);
        if (!valides.length) return;
        t.photos.push(...valides);
        render();
        saveOyviaState();
        if (typeof UI === 'undefined') return;
        // On dit laquelle des deux dates a été retenue : le prestataire doit
        // savoir que sa photo porte l'heure du dépôt quand l'appareil n'a
        // rien écrit — c'est le moment où il peut encore refaire la photo.
        const sansExif = valides.filter(p => !p.prisLe).length;
        const quoi = valides.length > 1 ? `${valides.length} photos datées` : 'Photo datée';
        UI.toast(sansExif === valides.length
          ? `${quoi} à l'heure du dépôt`
          : sansExif ? `${quoi} · ${sansExif} à l'heure du dépôt` : quoi);
      });
    // Sans ça, re-sélectionner le même fichier ne déclencherait aucun change.
    input.value = '';
  });

  // Connexion directe via ?p=P1
  if (params.get('p') && getPrestataire(params.get('p'))) signIn();
})();
