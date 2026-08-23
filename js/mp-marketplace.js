/* ============================================================
   OYVIA — Marketplace : les biens à prendre en gestion

   Un tableau, pas des vignettes. Une conciergerie qui prospecte
   compare des lignes — ville, quartier, type — et cherche ce qui la
   concerne ; les cartes obligeaient à balayer l'écran pour la même
   information. Le bien n'est décrit qu'en surface : ce qui décide
   d'une candidature, c'est le secteur et le type, le reste se discute
   avec le propriétaire.

   La demande de gestion ne se rédige pas : elle emporte un rapport
   composé de ce que nous mesurons déjà de la conciergerie. Un texte
   libre avantagerait ceux qui écrivent bien, pas ceux qui gèrent bien.
   ============================================================ */
Layout.init('marketplace');

/* La marketplace n'a pas d'entrée dans le menu : Layout.init retombe
   sur le premier écran du produit et en reprend le titre. */
document.title = 'Oyvia — Marketplace';
(function () {
  const t = document.querySelector('.app-topbar__title');
  if (t) t.textContent = 'Marketplace';
})();

(function () {
  const F = id => document.getElementById(id);
  const filtres = { q: '', ville: 'toutes', type: 'tous', statut: 'tous' };
  let bienEnCours = null;

  F('mp-ville').innerHTML = '<option value="toutes">Toutes les villes</option>' +
    mpVilles().map(v => `<option value="${mpEch(v)}">${mpEch(v)}</option>`).join('');
  F('mp-type').innerHTML = '<option value="tous">Tous les types</option>' +
    mpTypes().map(t => `<option value="${mpEch(t)}">${mpEch(t)}</option>`).join('');

  function liste() {
    const q = filtres.q.trim().toLowerCase();
    return MP_BIENS.slice()
      .filter(b => {
        if (filtres.ville !== 'toutes' && b.ville !== filtres.ville) return false;
        if (filtres.type !== 'tous' && b.type !== filtres.type) return false;
        if (filtres.statut === 'disponible' && b.statut !== 'disponible') return false;
        if (filtres.statut === 'recent' && !mpEstRecent(b)) return false;
        if (filtres.statut === 'postule' && !mpMaDemandePourBien(b.id)) return false;
        if (!q) return true;
        return `${b.ville} ${b.quartier} ${b.type}`.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        // Les biens pris descendent sans disparaître : voir qu'un secteur
        // bouge vaut mieux qu'une liste artificiellement courte.
        if ((a.statut === 'pris') !== (b.statut === 'pris')) return a.statut === 'pris' ? 1 : -1;
        return b.publieLe.localeCompare(a.publieLe);
      });
  }

  function render() {
    const l = liste();
    const dispo = MP_BIENS.filter(b => b.statut === 'disponible').length;
    F('mp-compteur').textContent = `${l.length} bien${l.length > 1 ? 's' : ''} · ${dispo} encore libre${dispo > 1 ? 's' : ''}`;

    F('mp-tbody').innerHTML = l.length ? l.map(b => {
      const pris = b.statut === 'pris';
      const demande = mpMaDemandePourBien(b.id);
      return `
        <tr class="${pris ? 'mp-ligne-prise' : ''}">
          <td>
            <b>${mpEch(b.ville)}</b>
            <div class="text-xs text-muted">${mpEch(b.quartier)}</div>
          </td>
          <td>
            <span class="mp-type">${mpEch(b.type)}</span>
            ${mpEstRecent(b) ? '<span class="mp-neuf">Nouveau</span>' : ''}
          </td>
          <td class="text-sm">${mpEch(mpDateCourte(b.publieLe))}
            <div class="text-xs text-muted">${mpDepuis(b.publieLe)}</div></td>
          <td>${pris
            ? '<span class="badge badge--neutral">Déjà pris</span>'
            : '<span class="badge badge--positive">Disponible</span>'}</td>
          <td style="text-align:right">
            ${demande
              ? `<a class="mp-suivi" href="prospects.html#${mpEch(demande.id)}">
                   <span class="badge ${MP_STATUTS_DEMANDE[demande.statut].badge}">${MP_STATUTS_DEMANDE[demande.statut].label}</span></a>`
              : pris
                ? '<span class="text-xs text-muted">Pris par une autre conciergerie</span>'
                : `<button class="btn btn--primary btn--sm" data-postuler="${b.id}">Demande de gestion</button>`}
          </td>
        </tr>`;
    }).join('') : `<tr><td colspan="5">
      <div class="mp-vide"><h4>Aucun bien ne correspond</h4>
      <p>Élargissez la ville ou le type. De nouvelles annonces arrivent chaque semaine.</p></div></td></tr>`;
  }

  /* ---------- Rapport de candidature ----------
     La conciergerie ne remplit rien : elle relit ce qui partira en son
     nom. Montrer le rapport avant l'envoi est le minimum — on publie ses
     chiffres à un tiers, elle doit savoir lesquels. */
  function ouvrirModale(bienId) {
    const b = mpBien(bienId);
    if (!b) return;
    bienEnCours = bienId;
    const r = mpRapport(mpMoi(), b);

    F('mp-modal-titre').textContent = `${b.type} · ${b.ville} — ${b.quartier}`;
    F('mp-modal-corps').innerHTML = `
      <p class="text-sm text-muted mb-4">
        Voici ce que le propriétaire recevra. Ces chiffres viennent de votre compte Oyvia et sont figés
        au moment de l'envoi — ils ne bougeront plus après coup.
      </p>

      <div class="mp-rapport">
        <div class="mp-rapport__tete">
          <div>
            <h4>${mpEch(r.nom)}</h4>
            <p>${mpEch(r.ville)} · ${r.anciennete} ans d'activité · ${r.logements} logements en gestion</p>
          </div>
          <span class="badge badge--accent">Rapport automatique</span>
        </div>

        <div class="mp-rapport__chiffres">
          <div><span>Occupation moyenne</span><b>${r.occupationGlobale} %</b><small>sur ${r.fenetreMois} mois</small></div>
          <div><span>Note des voyageurs</span><b>${String(r.note).replace('.', ',')}/5</b><small>tous canaux</small></div>
          <div><span>Réponse aux voyageurs</span><b>${r.delaiReponseMin} min</b><small>délai médian</small></div>
        </div>

        <p class="eyebrow mt-4 mb-2">Types de biens gérés</p>
        <table class="table mp-rapport__types">
          <thead><tr><th>Famille</th><th class="num">Biens</th><th class="num">Occupation</th></tr></thead>
          <tbody>
            ${r.parType.map(t => `
              <tr class="${t.famille === r.famille ? 'is-pertinent' : ''}">
                <td>${mpEch(t.label)}${t.famille === r.famille ? ' <span class="mp-neuf">type recherché</span>' : ''}</td>
                <td class="num">${t.nb}</td>
                <td class="num">${t.occupation} %</td>
              </tr>`).join('')}
          </tbody>
        </table>

        ${r.experienceFamille
          ? `<p class="mp-rapport__note">Vous gérez déjà ${r.experienceFamille.nb}
             ${mpLabelFamille(r.famille).toLowerCase()}${r.experienceFamille.nb > 1 ? 's' : ''},
             avec ${r.experienceFamille.occupation} % d'occupation sur ${r.fenetreMois} mois.</p>`
          : `<p class="mp-rapport__note mp-rapport__note--alerte">
             Vous ne gérez aucun bien de type ${mpLabelFamille(r.famille).toLowerCase()}.
             Le rapport le mentionnera : le propriétaire le verrait de toute façon en comparant les candidatures.</p>`}
      </div>`;

    UI.openPanel('mp-modal');
  }

  F('mp-envoyer').addEventListener('click', () => {
    if (!bienEnCours) return;
    const d = mpEnvoyerDemande(bienEnCours);
    if (!d) return UI.toast("Ce bien n'est plus disponible", false);
    UI.closeAll();
    render();
    UI.toast('Demande envoyée — suivez-la dans Mes prospects');
  });

  F('mp-tbody').addEventListener('click', e => {
    const b = e.target.closest('[data-postuler]');
    if (b) ouvrirModale(b.dataset.postuler);
  });
  F('mp-q').addEventListener('input', e => { filtres.q = e.target.value; render(); });
  ['ville', 'type', 'statut'].forEach(cle => {
    F('mp-' + cle).addEventListener('change', e => { filtres[cle] = e.target.value; render(); });
  });

  render();
})();
