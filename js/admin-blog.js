/* ============================================================
   OYVIA interne — Rédaction et publication des articles

   Deux écrans dans une seule page : la liste, et l'éditeur. Écrire un
   article dans une boîte de dialogue revenait à rédiger par le trou
   d'une serrure — l'éditeur prend donc toute la page, avec le texte à
   gauche et les décisions de publication à droite.

   Trois principes le régissent :

   — Publier est une action, pas une case à cocher. « Enregistrer » et
     « Publier » sont deux boutons distincts : personne ne met un texte
     en ligne par inadvertance.

   — Le statut affiché vient toujours de statutArticleReel() : un
     article publié avec une date à venir est « Programmé », ici comme
     sur le site.

   — Les images sont redimensionnées avant d'être stockées. Une photo
     de téléphone pèse 4 Mo, le stockage local en accepte 5 en tout :
     sans compression, le deuxième article ferait tout échouer.
   ============================================================ */
if (AdminLayout.init('blog')) { /* accès refusé */ } else {
(function () {

  const F = id => document.getElementById(id);
  const ic = Adm.ic;
  const peutEcrire = peutAdmin('blog');

  // Les chemins d'images livrées avec le site sont relatifs à la racine ;
  // l'éditeur, lui, s'affiche depuis /admin/.
  const BASE = '../';

  let editId = null;      // article ouvert dans l'éditeur (null = brouillon neuf)
  let brouillon = null;   // copie de travail, tant que rien n'est enregistré
  let slugTouche = false;
  let modifie = false;    // des changements non enregistrés ?

  const filtres = { q: '', statut: 'tous', categorie: 'toutes' };

  F('bl-statut').innerHTML = '<option value="tous">Tous les statuts</option>' +
    Object.keys(ARTICLE_STATUTS).map(k => `<option value="${k}">${ARTICLE_STATUTS[k].label}</option>`).join('');
  F('bl-categorie').innerHTML = '<option value="toutes">Toutes les catégories</option>' +
    BLOG_CATEGORIES.map(c => `<option value="${c.id}">${c.label}</option>`).join('');
  F('bl-f-categorie').innerHTML = BLOG_CATEGORIES.map(c => `<option value="${c.id}">${c.label}</option>`).join('');
  F('bl-f-auteur').innerHTML = MEMBRES_OYVIA.filter(m => m.statut === 'actif')
    .map(m => `<option value="${m.id}">${m.nom}</option>`).join('');

  /* ============================================================
     LISTE
     ============================================================ */
  function listeFiltree() {
    const q = filtres.q.trim().toLowerCase();
    return ARTICLES.filter(a => {
      if (filtres.statut !== 'tous' && statutArticleReel(a) !== filtres.statut) return false;
      if (filtres.categorie !== 'toutes' && a.categorie !== filtres.categorie) return false;
      if (!q) return true;
      return [a.titre, a.chapo, a.contenu, a.slug].join(' ').toLowerCase().includes(q);
    }).sort((a, b) => b.datePublication.localeCompare(a.datePublication));
  }

  function renderKpis() {
    const parStatut = s => ARTICLES.filter(a => statutArticleReel(a) === s);
    const enLigne = parStatut('publie');
    const derniere = enLigne.length ? enLigne.reduce((r, a) => a.datePublication > r.datePublication ? a : r) : null;

    F('bl-kpis').innerHTML = [
      Adm.kpi({ label:'En ligne', valeur: enLigne.length,
        pied: derniere ? `Dernier : ${formatDate(derniere.datePublication)}` : 'Aucun article publié',
        icone:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
        ton:'positive' }),
      Adm.kpi({ label:'Brouillons', valeur: parStatut('brouillon').length,
        pied:"En cours d'écriture",
        icone:'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>' }),
      Adm.kpi({ label:'Programmés', valeur: parStatut('programme').length,
        pied:'Publication automatique à la date prévue',
        icone:'<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>' }),
      Adm.kpi({ label:'Rythme', valeur: rythmePublication(),
        pied:'Articles publiés sur les 90 derniers jours',
        icone:'<path d="M3 3v18h18"/><path d="M18 17V9M13 17V5M8 17v-3"/>' }),
    ].join('');
  }

  // Un blog se juge à sa régularité plus qu'à son volume : trois articles
  // par trimestre valent mieux que douze publiés le même mois puis rien.
  function rythmePublication() {
    const depuis = addDays(AUJOURDHUI, -90);
    return ARTICLES.filter(a => articleEnLigne(a) && a.datePublication >= depuis).length;
  }

  /* Cartes plutôt qu'un tableau : un article se reconnaît à son image et
     à son titre, pas à l'alignement de ses colonnes. */
  function renderListe() {
    const liste = listeFiltree();
    F('bl-compteur').textContent = `${liste.length} article${liste.length > 1 ? 's' : ''} sur ${ARTICLES.length}`;

    F('bl-cartes').innerHTML = liste.length ? `<div class="bl-grille">${liste.map(a => {
      const statut = statutArticleReel(a);
      const couv = couvertureArticle(a, BASE);
      return `<article class="bl-carte ${statut === 'brouillon' ? 'is-brouillon' : ''}" data-edit="${a.id}">
        <div class="bl-carte__media">
          ${couv ? `<img src="${couv.url}" alt="">`
                 : `<span class="bl-carte__vide">${ic('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.8"/><path d="m21 16-5-5-6 6-3-3-4 4"/>')}</span>`}
          ${a.aLaUne ? '<span class="bl-carte__une">À la une</span>' : ''}
        </div>
        <div class="bl-carte__corps">
          <div class="bl-carte__tete">
            ${Adm.badge(ARTICLE_STATUTS, statut)}
            <span class="text-xs text-muted">${labelCategorieBlog(a.categorie)}</span>
          </div>
          <h3>${a.titre || 'Sans titre'}</h3>
          <p>${a.chapo ? a.chapo.slice(0, 110) + (a.chapo.length > 110 ? '…' : '') : 'Pas encore de chapô'}</p>
          <div class="bl-carte__pied">
            <span>${formatDate(a.datePublication, { annee: true })}</span>
            <span>·</span><span>${tempsLectureArticle(a)} min</span>
            <span>·</span><span>${nomMembre(a.auteurId)}</span>
            <div class="grow"></div>
            <button class="icon-btn" data-menu="${a.id}" aria-label="Autres actions">${ic('<circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/>')}</button>
          </div>
        </div>
      </article>`;
    }).join('')}</div>` : Adm.vide('Aucun article', "Aucun article ne correspond à ces filtres.");
  }

  /* ---------- Menu d'actions ---------- */
  function ouvrirMenu(id, ancre) {
    const a = getArticle(id);
    if (!a) return;
    const statut = statutArticleReel(a);
    const actions = [];
    if (statut === 'brouillon') {
      /* Un brouillon daté du mois prochain ne peut pas être « publié
         maintenant » sans qu'on touche à sa date. On propose les deux
         gestes et on nomme la date, plutôt que de choisir en douce. */
      if (a.datePublication > AUJOURDHUI) {
        actions.push({ id:'publier_aujourdhui', label:"Publier aujourd'hui" });
        actions.push({ id:'publier', label:`Programmer au ${formatDate(a.datePublication)}` });
      } else {
        actions.push({ id:'publier', label:'Publier' });
      }
    } else {
      actions.push({ id:'voir', label:'Voir sur le site' });
      actions.push({ id:'depublier', label:'Repasser en brouillon' });
      if (!a.aLaUne) actions.push({ id:'une', label:'Mettre à la une' });
    }
    actions.push({ id:'dupliquer', label:'Dupliquer' });
    actions.push({ id:'supprimer', label:'Supprimer', danger:true });

    let menu = F('bl-menu');
    if (!menu) {
      menu = document.createElement('div');
      menu.id = 'bl-menu';
      menu.className = 'bl-menu';
      document.body.appendChild(menu);
      document.addEventListener('click', e => {
        if (!e.target.closest('#bl-menu') && !e.target.closest('[data-menu]')) fermerMenu();
      });
    }
    menu.innerHTML = actions.map(x =>
      `<button type="button" data-act="${x.id}" class="${x.danger ? 'is-danger' : ''}">${x.label}</button>`).join('');

    const r = ancre.getBoundingClientRect();
    menu.style.top = `${Math.round(r.bottom + 6)}px`;
    // Ouvert vers la gauche : sur la dernière colonne de la grille, un
    // menu aligné à gauche du bouton sortirait de la fenêtre.
    menu.style.left = `${Math.round(Math.max(8, r.right - 190))}px`;
    menu.classList.add('is-open');

    menu.onclick = e => {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      fermerMenu();
      executer(btn.dataset.act, a);
    };
  }
  function fermerMenu() {
    const menu = F('bl-menu');
    if (menu) menu.classList.remove('is-open');
  }

  function executer(action, a) {
    if (action === 'voir') { window.open(`../article.html?a=${a.slug}`, '_blank', 'noopener'); return; }
    if (!peutEcrire) return UI.toast("Votre rôle ne permet pas de modifier le blog", false);

    if (action === 'publier' || action === 'publier_aujourdhui') {
      const manque = manquesPourPublier(a);
      if (manque.length) return UI.toast(`Impossible de publier — il manque : ${manque.join(', ')}`, false);
      publierArticle(a.id, action === 'publier_aujourdhui' ? AUJOURDHUI : null);
      UI.toast(statutArticleReel(a) === 'programme'
        ? `Programmé pour le ${formatDate(a.datePublication)}`
        : 'Article en ligne');
    }
    if (action === 'depublier') {
      UI.confirm({
        title: 'Retirer cet article du blog ?',
        message: `« ${a.titre} » disparaîtra du site public et son adresse ne répondra plus. Le texte est conservé en brouillon.`,
        confirmText: 'Retirer', danger: true,
        onConfirm: () => { depublierArticle(a.id); rafraichir(); UI.toast('Article repassé en brouillon'); },
      });
      return;
    }
    if (action === 'une') { mettreALaUne(a.id); UI.toast(`« ${a.titre} » est à la une`); }
    if (action === 'dupliquer') {
      const copie = dupliquerArticle(a.id);
      rafraichir();
      ouvrirEditeur(copie.id);
      UI.toast('Copie créée en brouillon');
      return;
    }
    if (action === 'supprimer') {
      UI.confirm({
        title: 'Supprimer cet article ?',
        message: `« ${a.titre} » sera définitivement supprimé. Pour le retirer du site en gardant le texte, préférez « Repasser en brouillon ».`,
        confirmText: 'Supprimer', danger: true,
        onConfirm: () => { supprimerArticle(a.id); rafraichir(); UI.toast('Article supprimé'); },
      });
      return;
    }
    rafraichir();
  }

  // Ce qui bloque la mise en ligne, énoncé en toutes lettres plutôt que
  // par un bouton désactivé sans explication.
  function manquesPourPublier(a) {
    const m = [];
    if (!(a.titre || '').trim())   m.push('le titre');
    if (!(a.chapo || '').trim())   m.push('le chapô');
    if (!(a.contenu || '').trim()) m.push('le contenu');
    return m;
  }

  /* ============================================================
     ÉDITEUR
     ============================================================ */
  function ouvrirEditeur(id) {
    if (!peutEcrire && !id) return UI.toast("Votre rôle ne permet pas d'écrire sur le blog", false);
    editId = id;
    const a = id ? getArticle(id) : null;

    /* On travaille sur une COPIE. Éditer l'objet en place afficherait les
       changements sur le site avant même d'avoir enregistré — et un
       abandon en cours de route laisserait l'article à moitié réécrit. */
    brouillon = a
      ? JSON.parse(JSON.stringify(a))
      : { titre:'', slug:'', categorie:'organisation', auteurId: membreCourant().id,
          datePublication: AUJOURDHUI, statut:'brouillon', aLaUne:false,
          chapo:'', contenu:'', metaDescription:'', image:null, medias:[] };

    slugTouche = !!a;
    modifie = false;

    F('bl-f-titre').value = brouillon.titre;
    F('bl-f-slug').value = brouillon.slug;
    F('bl-f-categorie').value = brouillon.categorie;
    F('bl-f-auteur').value = brouillon.auteurId;
    F('bl-f-date').value = brouillon.datePublication;
    F('bl-f-chapo').value = brouillon.chapo;
    F('bl-f-contenu').value = brouillon.contenu;
    F('bl-f-meta').value = brouillon.metaDescription || '';
    F('bl-f-une').checked = !!brouillon.aLaUne;

    /* Sur un article déjà en ligne, « Enregistrer » disparaît : il
       enregistrerait en brouillon, c'est-à-dire dépublierait sans le
       dire. Le retrait du site reste possible, mais par une action qui
       porte son nom (colonne de droite). */
    const dejaPublie = !!(a && a.statut === 'publie');
    F('bl-publier').textContent = dejaPublie ? 'Mettre à jour' : 'Publier';
    F('bl-brouillon').hidden = dejaPublie;
    F('bl-apercu-zone').hidden = true;
    F('bl-apercu').textContent = 'Aperçu';

    F('bl-vue-editeur').querySelectorAll('input, textarea, select, button[data-md], #bl-img-inline')
      .forEach(el => { el.disabled = !peutEcrire; });
    F('bl-brouillon').disabled = !peutEcrire;
    F('bl-publier').disabled = !peutEcrire;

    renderCouverture();
    renderActionsLaterales();
    majMesures();
    majAideDate();
    majBarre();

    F('bl-vue-liste').hidden = true;
    F('bl-vue-editeur').hidden = false;
    window.scrollTo(0, 0);
    F('bl-f-titre').focus();
  }

  function fermerEditeur() {
    const sortir = () => {
      editId = null; brouillon = null; modifie = false;
      F('bl-vue-editeur').hidden = true;
      F('bl-vue-liste').hidden = false;
      rafraichir();
    };
    // Quitter l'éditeur ne doit jamais faire disparaître un texte : on
    // prévient plutôt que d'enregistrer d'office, qui publierait parfois
    // un brouillon non voulu.
    if (modifie) {
      UI.confirm({
        title: 'Quitter sans enregistrer ?',
        message: 'Les modifications de cet article seront perdues.',
        confirmText: 'Quitter', danger: true,
        onConfirm: sortir,
      });
      return;
    }
    sortir();
  }

  function majBarre() {
    const statut = editId ? statutArticleReel(getArticle(editId)) : 'brouillon';
    F('bl-barre-statut').innerHTML = Adm.badge(ARTICLE_STATUTS, statut);
    F('bl-etat').textContent = modifie ? 'Modifications non enregistrées'
      : editId ? 'À jour' : 'Nouveau brouillon';
    F('bl-etat').classList.toggle('is-modifie', modifie);
  }

  function toucher() {
    if (!modifie) { modifie = true; majBarre(); }
  }

  /* ---------- Colonne latérale : actions sur l'article ---------- */
  function renderActionsLaterales() {
    const zone = F('bl-side-actions');
    if (!editId) {
      zone.innerHTML = `<p class="eyebrow mb-2">Cet article</p>
        <p class="text-sm text-muted">Enregistrez une première fois pour pouvoir le prévisualiser sur le site, le dupliquer ou le supprimer.</p>`;
      return;
    }
    const a = getArticle(editId);
    const enLigne = articleEnLigne(a);
    zone.innerHTML = `
      <p class="eyebrow mb-3">Cet article</p>
      <div class="adm-actions">
        ${enLigne ? `<a class="btn btn--secondary btn--sm" href="../article.html?a=${a.slug}" target="_blank" rel="noopener">Voir sur le site</a>` : ''}
        ${a.statut === 'publie' ? `<button class="btn btn--ghost btn--sm" id="bl-side-depublier">Repasser en brouillon</button>` : ''}
        <button class="btn btn--ghost btn--sm" id="bl-side-dupliquer">Dupliquer</button>
        <button class="btn btn--danger btn--sm" id="bl-side-supprimer">Supprimer</button>
      </div>`;

    const on = (id, fn) => { const el = F(id); if (el) el.addEventListener('click', fn); };
    on('bl-side-depublier', () => executer('depublier', a));
    on('bl-side-dupliquer', () => executer('dupliquer', a));
    on('bl-side-supprimer', () => UI.confirm({
      title: 'Supprimer cet article ?',
      message: `« ${a.titre} » sera définitivement supprimé.`,
      confirmText: 'Supprimer', danger: true,
      onConfirm: () => { supprimerArticle(a.id); modifie = false; fermerEditeur(); UI.toast('Article supprimé'); },
    }));
  }

  /* ---------- Couverture ---------- */
  function renderCouverture() {
    const couv = couvertureArticle(brouillon, BASE);
    F('bl-couverture').innerHTML = couv
      ? `<div class="bl-couv">
           <img src="${couv.url}" alt="">
           <div class="bl-couv__actions">
             <button class="btn btn--secondary btn--sm" id="bl-couv-changer">Remplacer</button>
             <button class="btn btn--ghost btn--sm" id="bl-couv-retirer">Retirer</button>
           </div>
           <p class="text-xs text-muted">${couv.legende || 'Sans légende'}</p>
         </div>`
      : `<button class="bl-depot" id="bl-couv-ajouter" type="button">
           ${ic('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.8"/><path d="m21 16-5-5-6 6-3-3-4 4"/>')}
           <b>Ajouter une image</b>
           <small>Affichée sur la carte du blog et en haut de l'article. Format paysage conseillé.</small>
         </button>`;

    const on = (id, fn) => { const el = F(id); if (el) el.addEventListener('click', fn); };
    on('bl-couv-ajouter', () => F('bl-f-fichier-couv').click());
    on('bl-couv-changer', () => F('bl-f-fichier-couv').click());
    on('bl-couv-retirer', () => {
      brouillon.image = null;
      toucher();
      renderCouverture();
    });
  }

  /* ---------- Import et compression d'image ----------
     Une photo de téléphone fait 3 à 5 Mo ; le stockage local du
     navigateur en accepte 5 au total, tous écrans confondus. On
     redimensionne donc systématiquement avant de stocker : au-delà de
     1400 px de large, un article de blog n'y gagne rien de visible. */
  const LARGEUR_MAX = 1400;
  const POIDS_ALERTE = 700 * 1024;

  function compresserImage(fichier) {
    return new Promise((resolve, reject) => {
      if (!/^image\//.test(fichier.type)) return reject(new Error("Ce fichier n'est pas une image"));
      const lecteur = new FileReader();
      lecteur.onerror = () => reject(new Error('Lecture impossible'));
      lecteur.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Image illisible'));
        img.onload = () => {
          // Le SVG n'a rien à gagner à passer par un canvas : il est
          // vectoriel, léger, et le rasteriser le dégraderait.
          if (fichier.type === 'image/svg+xml') return resolve(lecteur.result);
          const ratio = Math.min(1, LARGEUR_MAX / img.width);
          const c = document.createElement('canvas');
          c.width = Math.round(img.width * ratio);
          c.height = Math.round(img.height * ratio);
          const ctx = c.getContext('2d');
          // Fond blanc : un PNG transparent converti en JPEG donnerait
          // sinon des aplats noirs.
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, c.width, c.height);
          ctx.drawImage(img, 0, 0, c.width, c.height);
          let sortie = c.toDataURL('image/jpeg', 0.78);
          if (sortie.length > POIDS_ALERTE * 1.4) sortie = c.toDataURL('image/jpeg', 0.62);
          resolve(sortie);
        };
        img.src = lecteur.result;
      };
      lecteur.readAsDataURL(fichier);
    });
  }

  // Fichier choisi → légende → insertion. La légende est demandée avant
  // insertion parce qu'elle sert de texte alternatif : la réclamer après
  // coup revient à ne jamais l'avoir.
  let imageEnAttente = null;
  function demanderLegende(dataUrl, cible) {
    imageEnAttente = { dataUrl, cible };
    F('bl-image-apercu').innerHTML = `<img src="${dataUrl}" alt="">`;
    F('bl-f-legende').value = '';
    const ko = Math.round(dataUrl.length * 0.75 / 1024);
    F('bl-image-poids').textContent = `Image redimensionnée : environ ${ko} Ko.`
      + (dataUrl.length > POIDS_ALERTE ? " C'est lourd pour une page web ; une image plus petite se chargerait plus vite." : '');
    UI.openPanel('bl-modal-image');
    setTimeout(() => F('bl-f-legende').focus(), 120);
  }

  F('bl-image-ok').addEventListener('click', () => {
    if (!imageEnAttente) return;
    const legende = F('bl-f-legende').value.trim();
    if (imageEnAttente.cible === 'couverture') {
      brouillon.image = { url: imageEnAttente.dataUrl, legende };
      renderCouverture();
    } else {
      const id = ajouterMediaArticle(brouillon, imageEnAttente.dataUrl, legende);
      insererBloc(`![${legende}](${id})`);
    }
    imageEnAttente = null;
    toucher();
    UI.closeAll();
    UI.toast('Image ajoutée');
  });

  function brancherFichier(inputId, cible) {
    F(inputId).addEventListener('change', e => {
      const fichier = e.target.files && e.target.files[0];
      e.target.value = '';   // permet de rechoisir le même fichier ensuite
      if (!fichier) return;
      compresserImage(fichier)
        .then(url => demanderLegende(url, cible))
        .catch(err => UI.toast(err.message, false));
    });
  }
  brancherFichier('bl-f-fichier-couv', 'couverture');
  brancherFichier('bl-f-fichier-inline', 'inline');
  F('bl-img-inline').addEventListener('click', () => F('bl-f-fichier-inline').click());

  /* ---------- Barre d'outils ----------
     On insère de la syntaxe dans le textarea plutôt que d'éditer du HTML
     enrichi : un champ contenteditable rapporte le balisage du
     traitement de texte d'origine, et c'est précisément ce qu'on
     cherche à ne pas laisser entrer dans le site. */
  function entoure(avant, apres = avant, remplacement = 'texte') {
    const ta = F('bl-f-contenu');
    const [d, f] = [ta.selectionStart, ta.selectionEnd];
    const selection = ta.value.slice(d, f) || remplacement;
    ta.setRangeText(avant + selection + apres, d, f, 'select');
    if (!ta.value.slice(d, f)) ta.setSelectionRange(d + avant.length, d + avant.length + selection.length);
    ta.focus();
    majMesures();
    toucher();
  }
  function prefixeLignes(prefixe) {
    const ta = F('bl-f-contenu');
    const [d, f] = [ta.selectionStart, ta.selectionEnd];
    const debutLigne = ta.value.lastIndexOf('\n', d - 1) + 1;
    const lignes = (ta.value.slice(debutLigne, f) || 'Élément').split('\n');
    const texte = lignes.map(l => l.startsWith(prefixe) ? l : prefixe + l).join('\n');
    ta.setRangeText(texte, debutLigne, f, 'end');
    ta.focus();
    majMesures();
    toucher();
  }
  function insererBloc(texte) {
    const ta = F('bl-f-contenu');
    const pos = ta.selectionStart;
    // Une image ou un bloc doit être isolé par des lignes vides, sinon il
    // se fond dans le paragraphe voisin au moment du rendu.
    const avant = ta.value.slice(0, pos).replace(/\n*$/, '');
    const apres = ta.value.slice(pos).replace(/^\n*/, '');
    ta.value = `${avant}${avant ? '\n\n' : ''}${texte}\n\n${apres}`;
    const p = avant.length + (avant ? 2 : 0) + texte.length + 2;
    ta.setSelectionRange(p, p);
    ta.focus();
    majMesures();
    toucher();
  }

  F('bl-outils').addEventListener('click', e => {
    const btn = e.target.closest('[data-md]');
    if (!btn || !peutEcrire) return;
    ({
      titre:    () => prefixeLignes('## '),
      liste:    () => prefixeLignes('- '),
      citation: () => prefixeLignes('> '),
      gras:     () => entoure('**'),
      lien:     () => entoure('[', '](https://)', 'texte du lien'),
    })[btn.dataset.md]();
  });

  /* ---------- Mesures et aides ---------- */
  function majMesures() {
    const mots = F('bl-f-contenu').value.trim().split(/\s+/).filter(Boolean).length;
    const minutes = Math.max(1, Math.round(mots / 200));
    F('bl-f-mesure').textContent = `${mots} mot${mots > 1 ? 's' : ''} · ${minutes} min`;

    const n = F('bl-f-meta').value.length;
    const compteur = F('bl-f-meta-compteur');
    compteur.textContent = `${n} / 160`;
    compteur.style.color = n > 160 ? 'var(--c-danger)' : '';
  }

  // La date pilote le statut : le dire au moment de la saisie évite la
  // surprise d'un article « publié » qui n'apparaît pas sur le site.
  function majAideDate() {
    const d = F('bl-f-date').value;
    F('bl-f-date-aide').textContent = !d ? ''
      : d > AUJOURDHUI ? "Date à venir : l'article sera programmé."
      : 'Publication immédiate.';
  }

  ['bl-f-titre', 'bl-f-chapo', 'bl-f-contenu', 'bl-f-meta', 'bl-f-slug', 'bl-f-categorie', 'bl-f-auteur', 'bl-f-date', 'bl-f-une']
    .forEach(id => F(id).addEventListener('input', toucher));
  F('bl-f-titre').addEventListener('input', e => {
    if (slugTouche) return;
    F('bl-f-slug').value = slugifierTitre(e.target.value);
  });
  F('bl-f-slug').addEventListener('input', () => { slugTouche = true; });
  F('bl-f-contenu').addEventListener('input', majMesures);
  F('bl-f-meta').addEventListener('input', majMesures);
  F('bl-f-date').addEventListener('change', majAideDate);
  F('bl-f-une').addEventListener('change', toucher);

  /* ---------- Aperçu ----------
     Rendu par la même fonction que la page publique : un aperçu écrit à
     part finirait par diverger du site, ce qu'on vient justement
     vérifier ici. */
  F('bl-apercu').addEventListener('click', () => {
    const zone = F('bl-apercu-zone');
    if (!zone.hidden) { zone.hidden = true; F('bl-apercu').textContent = 'Aperçu'; return; }
    const d = lireFormulaire();
    const provisoire = { ...brouillon, ...d };
    const couv = couvertureArticle(provisoire, BASE);
    zone.innerHTML = `
      ${couv ? `<img class="bl-apercu__couv" src="${couv.url}" alt="">` : ''}
      <span class="lp-blog__tag lp-blog__tag--${d.categorie}">${labelCategorieBlog(d.categorie)}</span>
      <h2>${echapperHtml(d.titre || 'Sans titre')}</h2>
      <p class="bl-apercu__chapo">${echapperHtml(d.chapo)}</p>
      <div class="bl-apercu__corps">${contenuArticleHtml(d.contenu, provisoire, BASE)}</div>`;
    zone.hidden = false;
    F('bl-apercu').textContent = "Masquer l'aperçu";
    zone.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  /* ---------- Enregistrement ---------- */
  function lireFormulaire() {
    return {
      titre: F('bl-f-titre').value.trim(),
      slug: F('bl-f-slug').value.trim(),
      categorie: F('bl-f-categorie').value,
      auteurId: F('bl-f-auteur').value,
      datePublication: F('bl-f-date').value || AUJOURDHUI,
      chapo: F('bl-f-chapo').value.trim(),
      contenu: F('bl-f-contenu').value.trim(),
      metaDescription: F('bl-f-meta').value.trim(),
      aLaUne: F('bl-f-une').checked,
      image: brouillon.image,
      medias: brouillon.medias || [],
    };
  }

  // Une image retirée du texte n'a plus de raison d'occuper le stockage.
  function nettoyerMedias(donnees) {
    const vivants = (donnees.medias || []).filter(m => donnees.contenu.includes(`](${m.id})`));
    return { ...donnees, medias: vivants };
  }

  function enregistrer(statutVoulu) {
    const d = nettoyerMedias(lireFormulaire());

    if (statutVoulu === 'publie') {
      const manque = manquesPourPublier(d);
      if (manque.length) return UI.toast(`Il manque ${manque.join(', ')} pour publier`, false);
    } else if (!d.titre) {
      return UI.toast('Donnez au moins un titre à votre brouillon', false);
    }

    // Un brouillon ne peut pas être à la une : il n'y a rien à mettre en
    // avant tant que rien n'est en ligne.
    const donnees = statutVoulu === 'publie' ? { ...d, statut:'publie' } : { ...d, statut:'brouillon', aLaUne:false };
    const article = enregistrerArticle(donnees, editId);
    if (!article) return UI.toast("L'article n'a pas pu être enregistré", false);

    if (statutVoulu === 'publie') {
      publierArticle(article.id, d.datePublication);
      if (d.aLaUne) mettreALaUne(article.id);
    }

    /* Le stockage local plafonne à environ 5 Mo. Se taire sur un échec
       ferait croire l'article sauvegardé jusqu'au prochain rechargement,
       où il aurait disparu. */
    if (!saveOyviaState()) {
      UI.toast("Stockage saturé : allégez ou retirez des images, l'article n'est pas enregistré", false);
      return;
    }

    editId = article.id;
    brouillon = JSON.parse(JSON.stringify(article));
    modifie = false;
    slugTouche = true;
    renderActionsLaterales();
    majBarre();
    renderCouverture();

    UI.toast(statutVoulu === 'publie'
      ? (statutArticleReel(article) === 'programme'
          ? `Programmé pour le ${formatDate(article.datePublication)}`
          : 'Article en ligne')
      : 'Brouillon enregistré');
  }

  F('bl-brouillon').addEventListener('click', () => enregistrer('brouillon'));
  F('bl-publier').addEventListener('click', () => enregistrer('publie'));
  F('bl-retour').addEventListener('click', fermerEditeur);

  /* ---------- Câblage de la liste ---------- */
  F('bl-add').addEventListener('click', () => ouvrirEditeur(null));
  F('bl-q').addEventListener('input', e => { filtres.q = e.target.value; renderListe(); });
  ['statut', 'categorie'].forEach(cle => {
    F('bl-' + cle).addEventListener('change', e => { filtres[cle] = e.target.value; renderListe(); });
  });
  F('bl-cartes').addEventListener('click', e => {
    const menu = e.target.closest('[data-menu]');
    if (menu) { e.stopPropagation(); return ouvrirMenu(menu.dataset.menu, menu); }
    const carte = e.target.closest('[data-edit]');
    if (carte) ouvrirEditeur(carte.dataset.edit);
  });

  // Fermer l'onglet en pleine rédaction doit au moins demander confirmation.
  window.addEventListener('beforeunload', e => {
    if (!modifie) return;
    e.preventDefault();
    e.returnValue = '';
  });

  function rafraichir() {
    renderKpis();
    renderListe();
    AdminLayout.refreshBadges();
  }

  rafraichir();

  if (location.hash.length > 1) {
    const a = getArticle(location.hash.slice(1));
    if (a) ouvrirEditeur(a.id);
  }
})();
}
