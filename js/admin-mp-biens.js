/* ============================================================
   OYVIA — Back-office : logements déposés par les propriétaires

   La question de cet écran n'est pas « combien de biens avons-nous
   collectés » — ce nombre ne fait que monter et ne demande rien à
   personne. C'est : quel propriétaire est en train d'attendre ?

   Un bien déposé depuis cinq jours sans une seule candidature est un
   mandat qu'on va perdre, et rien ne le signale si l'on se contente de
   compter les annonces. D'où l'indicateur « sans aucune demande » en
   rouge, la mention `aucune` dans la colonne demandes, et le filtre
   dédié : trois chemins vers le même point aveugle.

   Les coordonnées du propriétaire sont en clair ici. Le masquage
   n'existe que face aux conciergeries, tant qu'aucun mandat n'est
   signé ; nous, c'est nous qui appelons.
   ============================================================ */
(function () {
  if (AdminLayout.init('mpbiens')) return;

  const F = id => document.getElementById(id);
  const filtres = { q: '', ville: 'toutes', statut: 'tous' };

  F('mb-ville').innerHTML = '<option value="toutes">Toutes les villes</option>' +
    mpVilles().map(v => `<option value="${mpEch(v)}">${mpEch(v)}</option>`).join('');

  function liste() {
    const q = filtres.q.trim().toLowerCase();
    return MP_BIENS.slice()
      .filter(b => {
        const n = mpDemandesDuBien(b.id).length;
        if (filtres.ville !== 'toutes' && b.ville !== filtres.ville) return false;
        if (filtres.statut === 'disponible' && b.statut !== 'disponible') return false;
        if (filtres.statut === 'pris' && b.statut !== 'pris') return false;
        if (filtres.statut === 'sansdemande' && (n > 0 || b.statut !== 'disponible')) return false;
        if (filtres.statut === 'ecarte' && !mpToutesEcartees(b)) return false;
        if (!q) return true;
        const p = b.proprietaire;
        return `${b.ville} ${b.quartier} ${b.type} ${p.prenom} ${p.nom} ${p.email}`.toLowerCase().includes(q);
      })
      .sort((a, b) => b.publieLe.localeCompare(a.publieLe));
  }

  /* Trois états, pas deux. Un logement à pourvoir dont toutes les
     candidatures ont été écartées n'est pas dans la même situation
     qu'un logement qui vient d'être déposé : le premier a été examiné
     et n'a rien donné, il faut aller chercher d'autres conciergeries.
     Même libellé, couleur différente — la définition vit dans
     mp-data.js pour que cet écran et celui des demandes s'accordent. */
  function etat(b) {
    const e = mpEtatBien(b);
    return `<span class="badge ${e.badge}">${e.label}</span>` +
      (e.note ? `<span class="mp-alerte">${e.note}</span>` : '');
  }

  function renderTable() {
    const l = liste();
    F('mb-compteur').textContent = `${l.length} bien${l.length > 1 ? 's' : ''} sur ${MP_BIENS.length}`;

    F('mb-tbody').innerHTML = l.length ? l.map(b => {
      const demandes = mpDemandesDuBien(b.id);
      const jours = mpJoursDepuis(b.publieLe);
      const seul = b.statut === 'disponible' && !demandes.length;
      const p = b.proprietaire;
      return `
        <tr class="mp-clic" data-bien="${b.id}">
          <td>
            <b>${mpEch(b.type)} · ${mpEch(b.ville)}</b>
            <div class="text-xs text-muted">${mpEch(b.quartier)} · ${b.surface} m² · ${b.couchages} couchages</div>
          </td>
          <td>
            ${mpEch(p.prenom)} ${mpEch(p.nom)}
            <div class="text-xs text-muted">${mpEch(p.email)}</div>
          </td>
          <td class="text-sm">${mpEch(mpTrancheRevenu(b))}</td>
          <td class="text-sm">${mpEch(mpDateCourte(b.publieLe))}
            <div class="text-xs text-muted">${mpDepuis(b.publieLe)}</div></td>
          <td class="num">
            ${demandes.length}
            ${seul && jours >= 5 ? '<span class="mp-alerte">aucune</span>' : ''}
          </td>
          <td>${etat(b)}</td>
          <td style="text-align:right"><button class="icon-btn" data-bien="${b.id}" aria-label="Ouvrir la fiche">
            ${Adm.ic('<path d="m9 18 6-6-6-6"/>')}</button></td>
        </tr>`;
    }).join('') : `<tr><td colspan="7">${Adm.vide('Aucun bien', 'Aucun bien ne correspond à ces filtres.')}</td></tr>`;
  }

  /* ---------- Fiche d'un bien ---------- */
  function ouvrirFiche(id) {
    const b = mpBien(id);
    if (!b) return;
    const p = b.proprietaire;
    const classement = mpClassement(id);

    F('mb-panel-titre').textContent = `${b.type} · ${b.ville}`;
    F('mb-panel-corps').innerHTML = `
      <div class="row-between mb-4">
        ${etat(b)}
        <span class="text-xs text-muted">Déposé le ${mpEch(mpDate(b.publieLe))}</span>
      </div>

      <p class="eyebrow mb-2">Le bien</p>
      <div class="mp-recap mb-4">
        <div><span>Localisation</span><b>${mpEch(b.quartier)}, ${mpEch(b.ville)}</b></div>
        <div><span>Type</span><b>${mpEch(b.type)}</b></div>
        <div><span>Famille</span><b>${mpEch(mpLabelFamille(mpFamille(b.type)))}</b></div>
        <div><span>Surface</span><b>${b.surface} m²</b></div>
        <div><span>Couchages</span><b>${b.couchages}</b></div>
        <div><span>Revenu annoncé</span><b>${mpEch(mpTrancheRevenu(b))}</b></div>
        <div><span>Déjà loué</span><b>${b.dejaLoue ? 'Oui' : 'Non'}</b></div>
      </div>

      <p class="eyebrow mb-2">Propriétaire</p>
      <div class="mp-recap mb-4">
        <div><span>Nom</span><b>${mpEch(p.prenom)} ${mpEch(p.nom)}</b></div>
        <div><span>Courriel</span><b><a href="mailto:${mpEch(p.email)}">${mpEch(p.email)}</a></b></div>
        <div><span>Téléphone</span><b>${mpEch(p.telephone)}</b></div>
      </div>

      ${b.note ? `<p class="eyebrow mb-2">Ce qu'il en dit</p><p class="mp-note mb-4">« ${mpEch(b.note)} »</p>` : ''}

      <p class="eyebrow mb-2">Candidatures reçues (${classement.length})</p>
      ${classement.length ? classement.map(({ demande, conciergerie, compat }) => `
        <div class="mpa-cand">
          <div class="mpa-cand__tete">
            <b>${mpEch(conciergerie ? conciergerie.nom : 'Conciergerie inconnue')}</b>
            ${Adm.badge(MP_STATUTS_DEMANDE, demande.statut)}
          </div>
          <div class="mpa-cand__score">
            <span class="mpa-jauge mpa-jauge--${compat ? compat.niveau : 'faible'}"><i style="width:${compat ? compat.score : 0}%"></i></span>
            <span class="text-xs text-muted">${compat ? compat.score : 0}/100 · ${compat ? MP_NIVEAUX[compat.niveau].label : '—'}</span>
          </div>
        </div>`).join('')
        : Adm.vide('Aucune candidature',
            "Personne n'a encore demandé la gestion de ce bien. C'est le moment de le proposer aux conciergeries du secteur.")}
    `;

    F('mb-panel-pied').innerHTML = `
      <button class="btn btn--secondary" onclick="UI.closeAll()">Fermer</button>
      <a class="btn btn--primary" href="demandes-gestion.html#${mpEch(b.id)}">Voir le classement détaillé</a>`;

    UI.openPanel('mb-panel');
  }

  F('mb-tbody').addEventListener('click', e => {
    const cible = e.target.closest('[data-bien]');
    if (cible) ouvrirFiche(cible.dataset.bien);
  });
  F('mb-q').addEventListener('input', e => { filtres.q = e.target.value; renderTable(); });
  ['ville', 'statut'].forEach(cle => {
    F('mb-' + cle).addEventListener('change', e => { filtres[cle] = e.target.value; renderTable(); });
  });

  F('mb-export').addEventListener('click', () => {
    const l = liste();
    UI.exportCSV('oyvia-marketplace-biens',
      ['Ville', 'Quartier', 'Type', 'Surface', 'Couchages', 'Revenu annoncé', 'Propriétaire', 'Courriel', 'Téléphone', 'Déposé le', 'Demandes', 'État'],
      l.map(b => [b.ville, b.quartier, b.type, b.surface, b.couchages, mpTrancheRevenu(b),
        `${b.proprietaire.prenom} ${b.proprietaire.nom}`, b.proprietaire.email, b.proprietaire.telephone,
        b.publieLe, mpDemandesDuBien(b.id).length,
        mpEtatBien(b).label + (mpEtatBien(b).note ? ` (${mpEtatBien(b).note})` : '')]));
  });

  renderTable();
})();
