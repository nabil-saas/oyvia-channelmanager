/* ============================================================
   OYVIA — Blog : filtre par catégorie (article à la une + grille)
   ============================================================ */
(function () {
  const filters = document.getElementById('blog-filters');
  const featured = document.querySelector('.blog-featured');
  const cards = [...document.querySelectorAll('#blog-grid .lp-blog__post')];
  const empty = document.getElementById('blog-empty');
  if (!filters) return;

  function apply(cat) {
    let visible = 0;

    if (featured) {
      const show = cat === 'all' || featured.dataset.cat === cat;
      featured.style.display = show ? '' : 'none';
      if (show) visible++;
    }
    cards.forEach(c => {
      const show = cat === 'all' || c.dataset.cat === cat;
      c.style.display = show ? '' : 'none';
      if (show) visible++;
    });

    if (empty) empty.hidden = visible > 0;
  }

  filters.addEventListener('click', e => {
    const btn = e.target.closest('.blog-filter');
    if (!btn) return;
    filters.querySelectorAll('.blog-filter').forEach(b => b.classList.toggle('is-active', b === btn));
    apply(btn.dataset.cat);
  });
})();
