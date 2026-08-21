/* ============================================================
   OYVIA — Blog public : filtres, pagination, rendu dynamique

   Ce fichier remplace le contenu en dur de blog.html par des
   données issues de blog-data.js. Il dépend aussi de data.js
   pour formatDate() et AUJOURDHUI.

   Trois choix méritent explication :

   1. Les catégories vides sont exclues des filtres. Un bouton
      « Voyageurs » qui affiche « aucun article » est un cul-de-sac
      qu'on ne peut pas corriger depuis le front-end : mieux vaut ne
      pas le proposer plutôt que de décevoir l'internaute.

   2. L'article à la une est exclu de la grille. Afficher le même
      article deux fois sur la même page (en vedette ET dans la
      grille) serait redondant et confondrait la pagination, qui
      compte les articles de la grille séparément.

   3. Le filtre courant vit dans l'URL (?cat=organisation). Cela
      permet de partager un lien filtré (ex. newsletter thématique)
      sans JavaScript côté serveur. La pagination repart à 1 à
      chaque changement de filtre pour ne pas pointer une page qui
      n'existe pas dans la nouvelle sélection.
   ============================================================ */
(function () {

  /* ---------- Constantes ---------- */
  var PAR_PAGE = 6;

  /* SVG pictogrammes par catégorie (sobre, monoligne, cohérent avec
     le reste du design). Une icône par thème évite que la une change
     de visuel selon l'article mis en avant. */
  var ICONES_CAT = {
    reglementation: '<path d="M12 2 3 6v6c0 5 4 8.5 9 10 5-1.5 9-5 9-10V6z"/><path d="M9 12l2 2 4-4"/>',
    organisation:   '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>',
    productivite:   '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
    voyageurs:      '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    outils:         '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  };

  /* ---------- Références DOM ---------- */
  var elFiltres   = document.getElementById('blog-filters');
  var elFeatured  = document.getElementById('blog-featured');
  var elGrille    = document.getElementById('blog-grid');
  var elEmpty     = document.getElementById('blog-empty');
  var elPagination= document.getElementById('blog-pagination');

  if (!elFiltres || !elGrille) return;

  /* ---------- État ---------- */
  var catCourante  = 'all';
  var pageCourante = 1;

  /* ---------- Lecture de l'URL au chargement ---------- */
  (function lireUrl() {
    var params = new URLSearchParams(window.location.search);
    var cat    = params.get('cat') || 'all';
    /* On n'accepte que les catégories connues pour éviter qu'une URL
       trafiquée n'active un filtre fantôme sans bouton correspondant. */
    var valide = BLOG_CATEGORIES.some(function (c) { return c.id === cat; });
    catCourante = (cat === 'all' || valide) ? cat : 'all';
  }());

  /* ---------- Données filtrées ---------- */
  function articlesDeLaPage() {
    var une  = articleALaUne();
    var tous = articlesPublies().filter(function (a) {
      return (!une || a.id !== une.id) &&
             (catCourante === 'all' || a.categorie === catCourante);
    });
    var debut = (pageCourante - 1) * PAR_PAGE;
    return {
      grille:   tous.slice(debut, debut + PAR_PAGE),
      total:    tous.length,
      pages:    Math.max(1, Math.ceil(tous.length / PAR_PAGE)),
      une:      une && (catCourante === 'all' || une.categorie === catCourante) ? une : null,
    };
  }

  /* ---------- Rendu : une carte de grille ---------- */
  function htmlCarte(a) {
    var cat   = echapperHtml(a.categorie);
    var label = echapperHtml(labelCategorieBlog(a.categorie));
    var mins  = tempsLectureArticle(a);
    var date  = formatDate(a.datePublication, { moisLong: true, annee: true });
    var couv = couvertureArticle(a);
    return '<a class="lp-blog__post' + (couv ? ' has-media' : '') + '" href="article.html?a=' + echapperHtml(a.slug) + '" data-cat="' + cat + '">'
      + (couv ? '<span class="lp-blog__media"><img src="' + echapperHtml(couv.url) + '" alt="" loading="lazy"></span>' : '')
      + '<span class="lp-blog__tag lp-blog__tag--' + cat + '">' + label + '</span>'
      + '<h3>' + echapperHtml(a.titre) + '</h3>'
      + '<p>' + echapperHtml(a.chapo) + '</p>'
      + '<div class="lp-blog__meta">'
      + '<span>' + echapperHtml(date) + '</span>'
      + '<span>·</span>'
      + '<span>' + mins + ' min de lecture</span>'
      + '</div>'
      + '</a>';
  }

  /* ---------- Rendu : article à la une ---------- */
  function htmlUne(a) {
    if (!a) return '';
    var cat   = echapperHtml(a.categorie);
    var label = echapperHtml(labelCategorieBlog(a.categorie));
    var mins  = tempsLectureArticle(a);
    var date  = formatDate(a.datePublication, { moisLong: true, annee: true });
    var icone = ICONES_CAT[a.categorie] || ICONES_CAT.reglementation;
    var couv  = couvertureArticle(a);
    return '<a class="blog-featured" href="article.html?a=' + echapperHtml(a.slug) + '" data-cat="' + cat + '">'
      + '<div class="blog-featured__media blog-featured__media--' + cat + (couv ? ' has-image' : '') + '">'
      + (couv
          ? '<img src="' + echapperHtml(couv.url) + '" alt="' + echapperHtml(couv.legende) + '" loading="lazy">'
          : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">' + icone + '</svg>')
      + '</div>'
      + '<div class="blog-featured__body">'
      + '<span class="lp-blog__tag lp-blog__tag--' + cat + '">' + label + '</span>'
      + '<h2>' + echapperHtml(a.titre) + '</h2>'
      + '<p>' + echapperHtml(a.chapo) + '</p>'
      + '<div class="lp-blog__meta">'
      + '<span>' + echapperHtml(date) + '</span>'
      + '<span>·</span>'
      + '<span>' + mins + ' min de lecture</span>'
      + '</div>'
      + '</div>'
      + '</a>';
  }

  /* ---------- Rendu : pagination ---------- */
  function htmlPagination(pages, courante) {
    if (pages <= 1) return '';
    var html = '';
    /* Bouton précédent */
    html += '<button type="button" class="blog-pagination__btn"'
      + (courante === 1 ? ' disabled' : '')
      + ' aria-label="Page précédente" data-page="' + (courante - 1) + '">'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">'
      + '<path d="m15 18-6-6 6-6"/></svg>'
      + '</button>';
    /* Numéros — on affiche jusqu'à 7 numéros ; au-delà on tronque
       avec des points de suspension pour éviter un débordement sur mobile. */
    for (var i = 1; i <= pages; i++) {
      var debut = courante <= 4 || pages <= 7;
      var fin   = courante >= pages - 3;
      var proche = Math.abs(i - courante) <= 1;
      if (pages <= 7 || i === 1 || i === pages || proche) {
        html += '<button type="button" class="blog-pagination__num'
          + (i === courante ? ' is-active' : '')
          + '" data-page="' + i + '" aria-label="Page ' + i + '"'
          + (i === courante ? ' aria-current="page"' : '')
          + '>' + i + '</button>';
      } else if ((i === 2 && courante > 4 && pages > 7) ||
                 (i === pages - 1 && courante < pages - 3 && pages > 7)) {
        html += '<span class="blog-pagination__ellipsis" aria-hidden="true">…</span>';
      }
    }
    /* Bouton suivant */
    html += '<button type="button" class="blog-pagination__btn"'
      + (courante === pages ? ' disabled' : '')
      + ' aria-label="Page suivante" data-page="' + (courante + 1) + '">'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">'
      + '<path d="m9 18 6-6-6-6"/></svg>'
      + '</button>';
    return html;
  }

  /* ---------- Rendu global ---------- */
  function render() {
    var d = articlesDeLaPage();

    /* Article à la une */
    elFeatured.innerHTML = htmlUne(d.une);

    /* Grille */
    if (d.grille.length === 0) {
      elGrille.innerHTML = '';
      elEmpty.hidden = false;
    } else {
      elGrille.innerHTML = d.grille.map(htmlCarte).join('');
      elEmpty.hidden = true;
    }

    /* Pagination — masquée si la une est absente ET la grille vide */
    var toutVide = !d.une && d.total === 0;
    elEmpty.hidden = !toutVide;
    elPagination.innerHTML = toutVide ? '' : htmlPagination(d.pages, pageCourante);
  }

  /* ---------- Rendu des filtres ----------
     Seules les catégories qui ont au moins un article en ligne sont
     affichées : un filtre sans résultat est trompeur pour l'utilisateur
     et ne peut pas être rendu utile depuis le front. */
  function renderFiltres() {
    var publies = articlesPublies();
    /* Catégories effectivement représentées dans les articles en ligne */
    var catsAvecArticles = BLOG_CATEGORIES.filter(function (c) {
      return publies.some(function (a) { return a.categorie === c.id; });
    });

    var html = '<button type="button" class="blog-filter'
      + (catCourante === 'all' ? ' is-active' : '')
      + '" data-cat="all" role="tab" aria-selected="'
      + (catCourante === 'all' ? 'true' : 'false') + '">Tous</button>';

    catsAvecArticles.forEach(function (c) {
      var actif = catCourante === c.id;
      html += '<button type="button" class="blog-filter'
        + (actif ? ' is-active' : '')
        + '" data-cat="' + echapperHtml(c.id) + '"'
        + ' role="tab" aria-selected="' + (actif ? 'true' : 'false') + '">'
        + echapperHtml(c.label) + '</button>';
    });

    elFiltres.innerHTML = html;
  }

  /* ---------- Mise à jour de l'URL sans rechargement ----------
     pushState permet de partager le lien filtré ; on ne pousse pas
     si le paramètre n'a pas changé pour ne pas polluer l'historique. */
  function reflechirUrl(cat) {
    var url = new URL(window.location.href);
    if (cat === 'all') {
      url.searchParams.delete('cat');
    } else {
      url.searchParams.set('cat', cat);
    }
    if (url.href !== window.location.href) {
      history.pushState(null, '', url.href);
    }
  }

  /* ---------- Écouteurs ---------- */
  elFiltres.addEventListener('click', function (e) {
    var btn = e.target.closest('.blog-filter');
    if (!btn) return;
    catCourante  = btn.dataset.cat;
    pageCourante = 1;   /* retour à la page 1 pour éviter une page vide */
    reflechirUrl(catCourante);
    /* Mise à jour des états aria des onglets de filtre */
    elFiltres.querySelectorAll('.blog-filter').forEach(function (b) {
      var est = b === btn;
      b.classList.toggle('is-active', est);
      b.setAttribute('aria-selected', est ? 'true' : 'false');
    });
    render();
  });

  elPagination.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-page]');
    if (!btn || btn.disabled) return;
    var p = parseInt(btn.dataset.page, 10);
    if (!isFinite(p) || p === pageCourante) return;
    pageCourante = p;
    render();
    /* Remonter en haut de la grille après changement de page : l'utilisateur
       vient de cliquer en bas et les nouveaux articles sont en haut. */
    elGrille.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  /* ---------- Navigation navigateur (boutons précédent/suivant) ----------
     Si l'utilisateur utilise les flèches du navigateur après avoir filtré,
     on relit l'URL pour restaurer l'état. */
  window.addEventListener('popstate', function () {
    var params = new URLSearchParams(window.location.search);
    var cat    = params.get('cat') || 'all';
    var valide = BLOG_CATEGORIES.some(function (c) { return c.id === cat; });
    catCourante  = (cat === 'all' || valide) ? cat : 'all';
    pageCourante = 1;
    renderFiltres();
    render();
  });

  /* ---------- Initialisation ---------- */
  renderFiltres();
  render();

}());
