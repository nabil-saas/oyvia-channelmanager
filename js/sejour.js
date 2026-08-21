/* ============================================================
   OYVIA — Fiche séjour : personnalisation

   Ces réglages vivaient dans l'éditeur d'automatisations, visibles
   seulement si le message contenait {lien_sejour}. Autant dire
   introuvables : on ne cherche pas la mise en page d'une brochure dans
   l'écran qui décide de son envoi. Ils ont désormais leur écran.

   L'aperçu n'est pas une reconstitution : c'est la vraie page voyageur,
   chargée dans un cadre avec un vrai jeton de séjour. Un aperçu redessiné
   à part finit toujours par mentir — c'est le jour où il ment qu'on
   découvre qu'on aurait dû afficher la page elle-même.
   ============================================================ */
Layout.init('sejour');

(function () {
  const F = id => document.getElementById(id);
  const ic = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;

  const COULEURS = [
    { id: '#5B6BF5', nom: 'Bleu Oyvia' },
    { id: '#0F8A5F', nom: 'Vert' },
    { id: '#D97706', nom: 'Ambre' },
    { id: '#C2410C', nom: 'Terracotta' },
    { id: '#7C3AED', nom: 'Violet' },
    { id: '#0F172A', nom: 'Encre' },
  ];

  /* Une réservation en cours de validité sert de support à l'aperçu : la
     page voyageur refuse un lien ouvert trop tôt ou périmé, et un cadre
     affichant « ce lien a expiré » ne dirait rien de la mise en page. */
  const resaDemo = RESERVATIONS.find(r => r.canal !== 'bloque' && r.statut !== 'annule' && lienSejourStatut(r).actif)
    || RESERVATIONS.find(r => r.canal !== 'bloque' && r.statut !== 'annule');

  function urlApercu() {
    // lienSejour() construit l'adresse réelle envoyée au voyageur ; on lui
    // ajoute un horodatage, sans lequel le navigateur ressert le cadre en
    // cache et les réglages semblent sans effet.
    const base = resaDemo ? lienSejour(resaDemo, true) : '../guest.html';
    return `${base}${base.includes('?') ? '&' : '?'}apercu=${Date.now()}`;
  }

  function rafraichirApercu() {
    /* Enregistrer AVANT de charger le cadre. La page voyageur relit tout
       depuis le stockage local ; si l'état courant n'y est pas encore
       (jetons de séjour fraîchement créés, réglage à peine modifié),
       elle repart des données d'origine et affiche « ce lien n'est pas
       valide » — l'aperçu semble cassé alors que seul l'ordre des
       opérations était faux. */
    saveOyviaState();
    const url = urlApercu();
    F('sj-frame').src = url;
    F('sj-ouvrir').href = url;
  }

  // Toute modification est enregistrée puis répercutée dans l'aperçu.
  // Le délai évite de recharger la page à chaque frappe dans un texte.
  let minuteur = null;
  function enregistrer(immediat = false) {
    saveOyviaState();
    clearTimeout(minuteur);
    minuteur = setTimeout(rafraichirApercu, immediat ? 0 : 500);
  }

  /* ---------- Contenu de la page ----------
     Une ligne par bloc : interrupteur, libellé, flèches d'ordre. Les
     réglages détaillés (titre, texte) passent par une modale plutôt que
     de s'empiler à l'écran — huit blocs dépliés occupaient toute la
     page avant qu'on ait réglé quoi que ce soit. */
  function renderBlocs() {
    const liste = blocsPageSejourTous();
    const actifs = PAGE_SEJOUR.blocs;

    F('sj-blocs').innerHTML = liste.map(b => {
      const actif = blocPageSejourActif(b.id);
      const rang = actifs.indexOf(b.id);
      const t = texteBloc(b.id);
      const defaut = texteBlocParDefaut(b.id);
      const modifie = t.titre !== defaut.titre || t.texte !== defaut.texte;
      return `<div class="sj-bloc ${actif ? 'is-on' : ''}" data-bloc="${b.id}">
        <label class="switch sj-bloc__sw" title="${actif ? 'Masquer ce bloc' : 'Afficher ce bloc'}">
          <input type="checkbox" data-toggle="${b.id}" ${actif ? 'checked' : ''} />
          <span class="switch__track"></span>
        </label>
        <button type="button" class="sj-bloc__nom" data-editer="${b.id}" title="${b.desc.replace(/"/g, '&quot;')}">
          <span>${t.titre || b.label}</span>
          ${modifie ? '<i class="sj-bloc__perso" title="Texte personnalisé"></i>' : ''}
        </button>
        <div class="sj-bloc__ordre">
          <button type="button" data-monter="${b.id}" ${!actif || rang <= 0 ? 'disabled' : ''} aria-label="Monter">
            ${ic('<path d="m18 15-6-6-6 6"/>')}
          </button>
          <button type="button" data-descendre="${b.id}" ${!actif || rang === -1 || rang >= actifs.length - 1 ? 'disabled' : ''} aria-label="Descendre">
            ${ic('<path d="m6 9 6 6 6-6"/>')}
          </button>
        </div>
      </div>`;
    }).join('');
  }

  // Délégation : la liste est redessinée à chaque changement, des
  // écouteurs posés ligne par ligne ne survivraient pas au premier clic.
  F('sj-blocs').addEventListener('click', e => {
    const monter = e.target.closest('[data-monter]');
    const descendre = e.target.closest('[data-descendre]');
    const editer = e.target.closest('[data-editer]');
    if (monter)    return deplacer(monter.dataset.monter, -1);
    if (descendre) return deplacer(descendre.dataset.descendre, 1);
    if (editer)    return ouvrirEditeur(editer.dataset.editer);
  });

  F('sj-blocs').addEventListener('change', e => {
    const cb = e.target.closest('[data-toggle]');
    if (!cb) return;
    const id = cb.dataset.toggle;
    const i = PAGE_SEJOUR.blocs.indexOf(id);
    if (cb.checked && i === -1) PAGE_SEJOUR.blocs.push(id);
    if (!cb.checked && i > -1) PAGE_SEJOUR.blocs.splice(i, 1);
    renderBlocs();
    majDependances();
    enregistrer(true);
  });

  function deplacer(id, sens) {
    const i = PAGE_SEJOUR.blocs.indexOf(id);
    const j = i + sens;
    if (i === -1 || j < 0 || j >= PAGE_SEJOUR.blocs.length) return;
    const [x] = PAGE_SEJOUR.blocs.splice(i, 1);
    PAGE_SEJOUR.blocs.splice(j, 0, x);
    renderBlocs();
    enregistrer(true);
  }

  /* ---------- Édition d'un bloc ---------- */
  let blocEnCours = null;

  // Deux blocs n'ont pas d'en-tête dans la page : l'accueil s'inscrit
  // dans le bandeau, le contact est un bouton. Le champ « titre » y
  // change donc de sens, et pour l'accueil il n'a aucun sens du tout.
  const PARTICULARITES = {
    accueil: { titre: null, texte: 'Mot d\'accueil', aide: "Affiché sous le nom du logement, avant les dates de séjour." },
    contact: { titre: 'Libellé du bouton', texte: null, aide: "Le bouton reprend ce libellé. Le canal se règle plus bas." },
    depart:  { titre: 'Titre de la section', texte: 'Consignes', aide: "Ce qu'il faut faire en partant : clés, fenêtres, poubelles." },
  };

  /* ---------- Éléments d'une section ----------
     Deux blocs contiennent une liste : les étapes d'arrivée et les
     tuiles du guide. On les édite dans la même fenêtre que le texte,
     sous une séparation — passer par un troisième niveau de fenêtre
     pour changer un mot serait démesuré. */
  const LISTES = {
    acces: {
      titre: "Informations d'accès",
      lire: accesSejour,
      defaut: () => ACCES_SEJOUR_DEFAUT,
      ecrire: v => { PAGE_SEJOUR.acces = v; },
      neuf: () => ({ titre: 'Nouvelle information', texte: '' }),
      icone: false,
      champ: 'acces',
    },
    instructions: {
      titre: "Étapes d'arrivée",
      lire: etapesSejour,
      defaut: () => ETAPES_SEJOUR_DEFAUT,
      ecrire: v => { PAGE_SEJOUR.etapes = v; },
      neuf: () => ({ titre: 'Nouvelle étape', texte: '' }),
      icone: false,
      champ: 'etapes',
    },
    guide: {
      titre: 'Tuiles du guide',
      lire: tuilesSejour,
      defaut: () => TUILES_SEJOUR_DEFAUT,
      ecrire: v => { PAGE_SEJOUR.tuiles = v; },
      neuf: () => ({ icone: 'info', titre: 'Nouvelle tuile', texte: '' }),
      icone: true,
      champ: 'tuiles',
    },
  };

  function listeCourante() { return LISTES[blocEnCours] || null; }

  // Copie profonde avant écriture : tant que rien n'est modifié, la liste
  // rendue est la liste de RÉFÉRENCE, partagée. La muter en place
  // changerait les défauts pour tout le monde.
  function itemsModifiables() {
    const spec = listeCourante();
    if (!spec) return [];
    if (!Array.isArray(PAGE_SEJOUR[spec.champ])) {
      spec.ecrire(JSON.parse(JSON.stringify(spec.lire())));
    }
    return spec.lire();
  }

  function renderItems() {
    const spec = listeCourante();
    F('sj-items-zone').hidden = !spec;
    if (!spec) return;

    F('sj-items-titre').textContent = spec.titre;
    const items = spec.lire();
    F('sj-items').innerHTML = items.length ? items.map((it, i) => `
      <div class="sj-item" data-i="${i}">
        <div class="sj-item__tete">
          ${spec.icone ? `<select class="select sj-item__icone" data-champ="icone" data-i="${i}" aria-label="Pictogramme">
            ${Object.keys(ICONES_SEJOUR).map(k => `<option value="${k}" ${it.icone === k ? 'selected' : ''}>${ICONES_SEJOUR[k].label}</option>`).join('')}
          </select>` : `<span class="sj-item__num">${i + 1}</span>`}
          <input class="input sj-item__titre" data-champ="titre" data-i="${i}" value="${(it.titre || '').replace(/"/g, '&quot;')}" placeholder="${spec.champ === 'acces' ? 'Libellé' : 'Titre'}" />
          <div class="sj-item__actions">
            <button type="button" data-monter-item="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Monter">${ic('<path d="m18 15-6-6-6 6"/>')}</button>
            <button type="button" data-descendre-item="${i}" ${i === items.length - 1 ? 'disabled' : ''} aria-label="Descendre">${ic('<path d="m6 9 6 6 6-6"/>')}</button>
            <button type="button" data-supprimer-item="${i}" aria-label="Supprimer" class="is-danger">${ic('<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>')}</button>
          </div>
        </div>
        <input class="input sj-item__texte" data-champ="texte" data-i="${i}" value="${(it.texte || '').replace(/"/g, '&quot;')}" placeholder="${spec.champ === 'acces' ? 'Valeur — ex. {code}' : 'Texte (facultatif)'}" />
      </div>`).join('')
      : '<p class="field__hint">Aucun élément : la section n\'apparaîtra pas sur la page.</p>';

    F('sj-vars-liste').innerHTML = VARIABLES_SEJOUR
      .map(v => `<button type="button" class="sj-var" data-var="${v.cle}" title="${v.aide}">${v.cle}</button>`).join('');
  }

  F('sj-items').addEventListener('input', e => {
    const champ = e.target.closest('[data-champ]');
    if (!champ) return;
    const items = itemsModifiables();
    items[parseInt(champ.dataset.i, 10)][champ.dataset.champ] = champ.value;
    enregistrer();
  });
  F('sj-items').addEventListener('change', e => {
    if (e.target.closest('[data-champ="icone"]')) enregistrer(true);
  });

  F('sj-items').addEventListener('click', e => {
    const monter = e.target.closest('[data-monter-item]');
    const descendre = e.target.closest('[data-descendre-item]');
    const supprimer = e.target.closest('[data-supprimer-item]');
    if (!monter && !descendre && !supprimer) return;
    const items = itemsModifiables();
    if (supprimer) {
      items.splice(parseInt(supprimer.dataset.supprimerItem, 10), 1);
    } else {
      const i = parseInt((monter || descendre).dataset[monter ? 'monterItem' : 'descendreItem'], 10);
      const j = i + (monter ? -1 : 1);
      if (j < 0 || j >= items.length) return;
      const [x] = items.splice(i, 1);
      items.splice(j, 0, x);
    }
    renderItems();
    enregistrer(true);
  });

  F('sj-item-ajouter').addEventListener('click', () => {
    const spec = listeCourante();
    if (!spec) return;
    itemsModifiables().push(spec.neuf());
    renderItems();
    enregistrer(true);
  });

  // Un clic sur une variable l'insère dans le dernier champ touché :
  // recopier « {h_arrivee} » à la main, c'est se tromper une fois sur deux.
  let dernierChamp = null;
  F('sj-items').addEventListener('focusin', e => {
    if (e.target.matches('input[data-champ]')) dernierChamp = e.target;
  });
  F('sj-vars-liste').addEventListener('click', e => {
    const b = e.target.closest('[data-var]');
    if (!b) return;
    const cible = dernierChamp || F('sj-f-texte');
    const pos = cible.selectionStart != null ? cible.selectionStart : cible.value.length;
    cible.value = cible.value.slice(0, pos) + b.dataset.var + cible.value.slice(pos);
    cible.focus();
    cible.setSelectionRange(pos + b.dataset.var.length, pos + b.dataset.var.length);
    cible.dispatchEvent(new Event('input', { bubbles: true }));
  });

  function ouvrirEditeur(id) {
    const b = BLOCS_PAGE_SEJOUR.find(x => x.id === id);
    if (!b) return;
    blocEnCours = id;
    const t = texteBloc(id);
    const spec = PARTICULARITES[id] || {};

    F('sj-modal-titre').textContent = b.label;
    F('sj-modal-aide').textContent = spec.aide || b.desc;

    F('sj-modal-champ-titre').hidden = spec.titre === null;
    F('sj-modal-champ-titre').querySelector('.field__label').textContent = spec.titre || 'Titre affiché';
    F('sj-f-titre').value = t.titre;

    F('sj-f-texte').closest('.field').hidden = spec.texte === null;
    F('sj-f-texte-label').textContent = spec.texte || 'Texte affiché sous le titre';
    F('sj-f-texte').value = t.texte;

    renderItems();
    UI.openPanel('sj-modal');
  }

  /* Enregistrement à la frappe, comme partout ailleurs sur cet écran.

     La première version demandait un clic sur « Enregistrer » : fermer la
     fenêtre autrement — la croix, un clic à côté, la touche Échap —
     perdait le texte sans le dire. Sur une page où tous les autres
     champs s'enregistrent tout seuls, personne ne s'attend à devoir
     valider ici. */
  function appliquerTexte() {
    if (!blocEnCours) return;
    if (!PAGE_SEJOUR.textes) PAGE_SEJOUR.textes = {};
    const saisi = { titre: F('sj-f-titre').value.trim(), texte: F('sj-f-texte').value.trim() };
    const defaut = texteBlocParDefaut(blocEnCours);

    /* Un texte identique au nôtre n'est pas une personnalisation : on
       efface l'entrée au lieu de la recopier. Sans ça, « Rétablir le
       texte d'origine » figerait la formulation d'aujourd'hui — et une
       reformulation ultérieure de notre part n'atteindrait jamais cet
       hôte, qui croit pourtant suivre le texte standard. */
    if (saisi.titre === defaut.titre && saisi.texte === defaut.texte) delete PAGE_SEJOUR.textes[blocEnCours];
    else PAGE_SEJOUR.textes[blocEnCours] = saisi;

    renderBlocs();
    enregistrer();
  }

  ['sj-f-titre', 'sj-f-texte'].forEach(id => {
    F(id).addEventListener('input', appliquerTexte);
    F(id).addEventListener('change', () => { appliquerTexte(); });
  });

  // Entrée dans le titre : on ferme, c'est le geste attendu sur un champ
  // d'une ligne.
  F('sj-f-titre').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); UI.closeAll(); }
  });

  F('sj-f-defaut').addEventListener('click', () => {
    const d = texteBlocParDefaut(blocEnCours);
    F('sj-f-titre').value = d.titre;
    F('sj-f-texte').value = d.texte;
    // Le bouton parle du bloc entier : les éléments repartent eux aussi
    // de la liste de référence, sans quoi « rétabli » serait à moitié vrai.
    const spec = listeCourante();
    if (spec) {
      spec.ecrire(null);
      renderItems();
    }
    appliquerTexte();
    UI.toast("Contenu d'origine rétabli");
  });

  // Le canal de contact ne pilote rien si le bouton n'est pas affiché.
  function majDependances() {
    F('sj-canal').disabled = !blocPageSejourActif('contact');
  }

  /* ---------- Identité ---------- */
  function renderCouleurs() {
    F('sj-couleurs').innerHTML = COULEURS.map(c => `
      <button type="button" class="sj-couleur ${PAGE_SEJOUR.couleur === c.id ? 'is-on' : ''}"
        data-couleur="${c.id}" style="--pastille:${c.id}" title="${c.nom}" aria-label="${c.nom}"></button>`).join('');

    F('sj-couleurs').querySelectorAll('[data-couleur]').forEach(b => b.addEventListener('click', () => {
      PAGE_SEJOUR.couleur = b.dataset.couleur;
      renderCouleurs();
      enregistrer(true);
    }));
  }

  /* ---------- Contact ---------- */
  F('sj-canal').innerHTML = Object.keys(CONTACTS_SEJOUR)
    .map(k => `<option value="${k}">${CONTACTS_SEJOUR[k].label}</option>`).join('');

  function majContact() {
    const canal = F('sj-canal').value;
    F('sj-canal-aide').textContent = (CONTACTS_SEJOUR[canal] || {}).aide || '';
    // Demander un numéro pour un bouton qui ouvre la messagerie interne
    // n'aurait aucun effet : on masque ce qui ne sert pas.
    F('sj-champ-numero').hidden = !(canal === 'whatsapp' || canal === 'telephone');
    F('sj-champ-email').hidden = canal !== 'email';
  }

  /* ---------- Délai d'affichage du code ---------- */
  F('sj-jcode').innerHTML = [0, 1, 2, 3, 7].map(n => `<option value="${n}">${
    n === 0 ? "Dès l'ouverture de la page" : n === 1 ? "La veille de l'arrivée" : `${n} jours avant l'arrivée`
  }</option>`).join('');

  function majAideCode() {
    const n = parseInt(F('sj-jcode').value, 10);
    F('sj-jcode-aide').textContent = n === 0
      ? "Le code sera lisible dès que le voyageur ouvrira le lien."
      : "Avant cette date, la page affiche tout sauf le code et le Wi-Fi. Utile quand le lien part longtemps à l'avance.";
  }

  /* ---------- Remplissage initial ---------- */
  const contact = PAGE_SEJOUR.contact || (PAGE_SEJOUR.contact = { canal: 'message', numero: '', email: '' });
  F('sj-enseigne').value = PAGE_SEJOUR.enseigne || '';
  F('sj-signature').value = PAGE_SEJOUR.signature || '';
  F('sj-jcode').value = PAGE_SEJOUR.joursAvantCode;
  F('sj-canal').value = contact.canal || 'message';
  F('sj-numero').value = contact.numero || '';
  F('sj-email').value = contact.email || '';

  /* ---------- Câblage ---------- */
  const lier = (id, appliquer, immediat = false) => {
    const el = F(id);
    el.addEventListener('input', () => { appliquer(el.value); enregistrer(immediat); });
    el.addEventListener('change', () => { appliquer(el.value); enregistrer(true); });
  };

  lier('sj-enseigne',  v => { PAGE_SEJOUR.enseigne = v.trim(); });
  lier('sj-signature', v => { PAGE_SEJOUR.signature = v.trim(); });
  lier('sj-numero',    v => { PAGE_SEJOUR.contact.numero = v.trim(); });
  lier('sj-email',     v => { PAGE_SEJOUR.contact.email = v.trim(); });

  F('sj-jcode').addEventListener('change', e => {
    PAGE_SEJOUR.joursAvantCode = parseInt(e.target.value, 10);
    majAideCode();
    enregistrer(true);
  });
  F('sj-canal').addEventListener('change', e => {
    PAGE_SEJOUR.contact.canal = e.target.value;
    majContact();
    enregistrer(true);
  });
  F('sj-rafraichir').addEventListener('click', rafraichirApercu);

  renderBlocs();
  renderCouleurs();
  majDependances();
  majContact();
  majAideCode();

  F('sj-apercu-note').textContent = resaDemo
    ? `Séjour de ${resaDemo.voyageur} · ${getLogement(resaDemo.logementId).nom}`
    : 'Aucune réservation à afficher';
  rafraichirApercu();
})();
