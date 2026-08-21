/* ============================================================
   OYVIA — Page de lecture d'un article de blog

   Ce fichier lit ?a=<slug>, charge l'article via articleParSlug(),
   vérifie qu'il est bien en ligne, puis injecte tout le contenu
   dans #article-main.

   Deux précautions importantes :

   1. La vérification articleEnLigne() est refaite ici côté client,
      même si articlesPublies() l'applique déjà : un brouillon dont
      le slug est connu ne doit jamais être lisible par une URL
      devinée. C'est une défense en profondeur, pas une redondance.

   2. nomMembre() vit dans admin-data.js, qui n'est pas chargé sur
      le site public. On utilise typeof pour détecter sa présence et
      l'on retombe proprement sur « L'équipe Oyvia » sans lever
      d'exception.
   ============================================================ */
(function () {

  var elMain = document.getElementById('article-main');
  if (!elMain) return;

  /* ---------- Résoudre le slug depuis l'URL ---------- */
  var params = new URLSearchParams(window.location.search);
  var slug   = params.get('a') || '';
  var article = slug ? articleParSlug(slug) : null;

  /* ---------- État « article introuvable » ----------
     Déclenché si le slug est inconnu OU si l'article n'est pas en
     ligne (brouillon ou programmé). On ne distingue pas les deux cas
     pour ne pas indiquer à quelqu'un qui devine des slugs que le
     brouillon existe. */
  if (!article || !articleEnLigne(article)) {
    document.title = 'Article introuvable — Oyvia';
    elMain.innerHTML =
      '<section class="lp-section">'
      + '<div class="lp-shell article-notfound">'
      + '<p class="eyebrow">Erreur 404</p>'
      + '<h1>Article introuvable</h1>'
      + '<p>Cet article n\'existe pas ou n\'est plus disponible.</p>'
      + '<a class="btn btn--primary" href="blog.html">Retour au blog</a>'
      + '</div>'
      + '</section>';
    return;
  }

  /* ---------- Métadonnées de la page ---------- */
  document.title = echapperHtml(article.titre) + ' — Oyvia';
  var metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.setAttribute('content', article.metaDescription || '');

  /* ---------- Données de rendu ---------- */
  var cat      = echapperHtml(article.categorie);
  var label    = echapperHtml(labelCategorieBlog(article.categorie));
  var mins     = tempsLectureArticle(article);
  var dateLong = formatDate(article.datePublication, { moisLong: true, annee: true });
  /* nomMembre n'est disponible que dans le back-office ;
     on affiche un auteur générique sans planter la page publique. */
  var auteur   = (typeof nomMembre === 'function') ? nomMembre(article.auteurId) : 'L\'équipe Oyvia';
  var contenu  = contenuArticleHtml(article.contenu, article);
  var couv     = couvertureArticle(article);

  /* ---------- Fil d'Ariane ---------- */
  var filAriane =
    '<nav class="article-breadcrumb" aria-label="Fil d\'Ariane">'
    + '<a href="blog.html">Blog</a>'
    + '<span aria-hidden="true">›</span>'
    + '<a href="blog.html?cat=' + cat + '">' + label + '</a>'
    + '</nav>';

  /* ---------- En-tête de l'article ---------- */
  var entete =
    '<header class="article-hero">'
    + filAriane
    + '<span class="lp-blog__tag lp-blog__tag--' + cat + '">' + label + '</span>'
    + '<h1>' + echapperHtml(article.titre) + '</h1>'
    + '<p class="article-chapo">' + echapperHtml(article.chapo) + '</p>'
    + '<div class="lp-blog__meta article-meta">'
    + '<span>' + echapperHtml(dateLong) + '</span>'
    + '<span aria-hidden="true">·</span>'
    + '<span>' + mins + ' min de lecture</span>'
    + '<span aria-hidden="true">·</span>'
    + '<span>' + echapperHtml(auteur) + '</span>'
    + '</div>'
    + '</header>';

  /* ---------- Couverture ----------
     Placée après le titre et non avant : on vient lire un article, la
     photo n'est là que pour l'accompagner. */
  var couverture = couv
    ? '<figure class="article-couv lp-shell">'
      + '<img src="' + echapperHtml(couv.url) + '" alt="' + echapperHtml(couv.legende) + '">'
      + (couv.legende ? '<figcaption>' + echapperHtml(couv.legende) + '</figcaption>' : '')
      + '</figure>'
    : '';

  /* ---------- Corps de l'article ---------- */
  var corps =
    couverture
    + '<div class="article-body lp-shell">'
    + contenu
    + '</div>';

  /* ---------- Articles liés ---------- */
  var lies = articlesLies(article);
  var htmlLies = '';
  if (lies.length > 0) {
    var cartes = lies.map(function (a) {
      var c   = echapperHtml(a.categorie);
      var lbl = echapperHtml(labelCategorieBlog(a.categorie));
      var m   = tempsLectureArticle(a);
      var d   = formatDate(a.datePublication, { moisLong: true, annee: true });
      var cv = couvertureArticle(a);
      return '<a class="lp-blog__post' + (cv ? ' has-media' : '') + '" href="article.html?a=' + echapperHtml(a.slug) + '">'
        + (cv ? '<span class="lp-blog__media"><img src="' + echapperHtml(cv.url) + '" alt="" loading="lazy"></span>' : '')
        + '<span class="lp-blog__tag lp-blog__tag--' + c + '">' + lbl + '</span>'
        + '<h3>' + echapperHtml(a.titre) + '</h3>'
        + '<p>' + echapperHtml(a.chapo) + '</p>'
        + '<div class="lp-blog__meta">'
        + '<span>' + echapperHtml(d) + '</span>'
        + '<span aria-hidden="true">·</span>'
        + '<span>' + m + ' min de lecture</span>'
        + '</div>'
        + '</a>';
    }).join('');

    htmlLies =
      '<section class="lp-section article-lies" style="padding-top:0">'
      + '<div class="lp-shell">'
      + '<h2 class="article-lies__titre">Dans la même catégorie</h2>'
      + '<div class="lp-blog">' + cartes + '</div>'
      + '</div>'
      + '</section>';
  }

  /* ---------- Navigation retour ---------- */
  var nav =
    '<div class="article-nav lp-shell">'
    + '<a href="blog.html" class="article-nav__back">'
    + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">'
    + '<path d="m15 18-6-6 6-6"/>'
    + '</svg>'
    + 'Retour au blog'
    + '</a>'
    + '</div>';

  /* ---------- Injection dans le DOM ---------- */
  elMain.innerHTML =
    '<article>'
    + '<section class="lp-section article-section">'
    + '<div class="lp-shell">'
    + entete
    + '</div>'
    + '</section>'
    + corps
    + '</article>'
    + htmlLies
    + nav;

}());
