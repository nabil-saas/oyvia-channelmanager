/* ============================================================
   OYVIA — Configuration de l'IA Avancée de Vivi (offre Business)

   Cinq sections, dans l'ordre où on les règle réellement :
     A. Contexte global        — qui vous êtes, dans quelles langues
     B. Personnalité & ton     — pour que Vivi écrive comme vous
     C. Garde-fous & escalade  — quand elle s'arrête et vous passe la main
     D. Contexte par logement  — le réglage qui change tout
     E. Audit & apprentissage  — relire, corriger, améliorer

   Rappel important, matérialisé dans l'interface : ce qui est
   configuré ici ne concerne QUE les réponses aux messages entrants
   des voyageurs. Les confirmations et rappels sortants restent
   pilotés par les automatisations de règles.

   Les offres sans IA Avancée voient un écran d'explication au lieu
   du formulaire : on n'affiche pas des réglages qui n'auraient
   aucun effet.
   ============================================================ */
Layout.init('vivi');

(function () {
  const C = VIVI_CONFIG;
  const save = () => { if (typeof saveOyviaState === 'function') saveOyviaState(); };
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const icon = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  const CHECK = icon('<path d="M20 6 9 17l-5-5"/>');

  /* ------------------------------------------------------------
     Verrouillage selon l'offre
     ------------------------------------------------------------ */
  const niveau = viviNiveauIA();   // 'avancee' (Business) | null (Gratuit, Smart)

  function renderLocked() {
    const p = getPlan(COMPTE.plan);
    const biz = getPlan('business');
    const prix = planPrixTexte('business');
    const total = planTotal('business', COMPTE.nbLogements);

    // Ce que l'utilisateur gagne concrètement : on liste les capacités,
    // pas des arguments marketing.
    const gains = [
      "Vivi répond seule aux messages Airbnb, Booking, e-mail et WhatsApp, 24 h/24",
      "Elle répond dans la langue du voyageur",
      "Elle détecte les incidents et crée les tâches correspondantes (ménage, maintenance, intervention)",
      "Des garde-fous que vous définissez : elle s'arrête sur les remboursements, les réclamations, les demandes sensibles",
      "Un seuil de confiance et des heures de silence, pour qu'elle ne réponde jamais à votre place quand c'est délicat",
      "Le contexte de chaque logement (Wi-Fi, parking, check-in, équipements, règles) pour des réponses justes",
      "Un journal d'audit complet : vous approuvez, corrigez ou refusez avant envoi",
    ];

    document.getElementById('vc-locked').innerHTML = `
      <div class="vc-lock">
        <div class="vc-lock__ic"><img src="../assets/vivi.svg" alt="" aria-hidden="true" /></div>
        <h2>L'IA Avancée fait partie de l'offre Business</h2>
        <p>Vous êtes actuellement en <b>${p.nom}</b> : vos automatisations de règles fonctionnent
          (confirmation, rappel avant arrivée, demande d'avis), mais aucune IA ne répond aux
          messages entrants de vos voyageurs.</p>
        <ul class="vc-lock__list">${gains.map(g => `<li>${CHECK}<span>${g}</span></li>`).join('')}</ul>
        <p class="text-sm text-muted" style="margin-bottom:var(--sp-5)">
          Business : ${prix.montant} ${prix.suffixe} — soit ${formatMAD(total)} par mois pour vos ${COMPTE.nbLogements} logements.
        </p>
        <div class="vc-lock__cta">
          <a class="btn btn--primary btn--lg" href="abonnement.html">Passer en ${biz.nom}</a>
          <button type="button" class="btn btn--secondary btn--lg" id="vc-lock-ask">En parler à Vivi</button>
        </div>
      </div>`;

    document.getElementById('vc-locked').classList.remove('hidden');
    document.getElementById('vc-sub').textContent =
      "L'IA Avancée n'est pas active sur votre offre : voici ce qu'elle ferait à votre place.";
    document.getElementById('vc-lock-ask').addEventListener('click', () => {
      if (typeof Vivi !== 'undefined') Vivi.demander("Comment configurer l'IA avancée ?");
    });
  }

  /* ------------------------------------------------------------
     A — Contexte global
     ------------------------------------------------------------ */
  function renderGlobal() {
    const g = C.global;
    document.getElementById('vc-pane-global').innerHTML = `
      <div class="vc-intro">
        Vivi utilise ce contexte dans <b>chaque</b> réponse : c'est ce qui lui dit au nom de qui elle
        écrit, à qui elle s'adresse et dans quelle langue répondre.
      </div>
      <div class="card card--pad">
        <div class="vc-grid">
          <div class="field">
            <label class="field__label" for="vc-g-entreprise">Nom de votre entreprise</label>
            <input class="input" id="vc-g-entreprise" data-g="entreprise" value="${esc(g.entreprise)}" placeholder="Ex. Conciergerie Lumia" />
            <span class="field__hint">Vivi signe ses réponses avec ce nom.</span>
          </div>
          <div class="field">
            <label class="field__label" for="vc-g-type">Type d'hôte</label>
            <select class="select" id="vc-g-type" data-g="typeHote">
              ${VIVI_TYPES_HOTE.map(t => `<option value="${t.id}" ${g.typeHote === t.id ? 'selected' : ''}>${t.label}</option>`).join('')}
            </select>
            <span class="field__hint">Une conciergerie parle au nom d'un propriétaire, pas un particulier.</span>
          </div>
          <div class="field">
            <label class="field__label" for="vc-g-nb">Logements gérés</label>
            <input class="input" id="vc-g-nb" value="${COMPTE.nbLogements}" disabled />
            <span class="field__hint">Repris automatiquement de votre compte.</span>
          </div>
          <div class="field">
            <label class="field__label" for="vc-g-langue">Langue de travail</label>
            <select class="select" id="vc-g-langue" data-g="langueTravail">
              ${VIVI_LANGUES.map(l => `<option value="${l.id}" ${g.langueTravail === l.id ? 'selected' : ''}>${l.label}</option>`).join('')}
            </select>
            <span class="field__hint">La langue dans laquelle Vivi vous parle, à vous.</span>
          </div>
        </div>

        <div class="field mt-6">
          <span class="field__label">Langues de vos voyageurs</span>
          <div class="vc-checks vc-checks--inline">
            ${VIVI_LANGUES.map(l => `
              <label class="vc-check ${g.languesVoyageurs.includes(l.id) ? 'is-on' : ''}">
                <input type="checkbox" data-langue="${l.id}" ${g.languesVoyageurs.includes(l.id) ? 'checked' : ''} />
                <span class="vc-check__txt">${l.label}</span>
              </label>`).join('')}
          </div>
          <span class="field__hint">Vivi répond dans la langue du message reçu, à condition qu'elle soit cochée ici. Sinon, le message passe en attente.</span>
        </div>

        <p class="vc-hint mt-6">
          Aucune zone géographique à renseigner : chaque message est rattaché à une réservation,
          donc à un logement dont Vivi connaît la ville et le pays. Elle adapte ses repères
          (transports, saisonnalité, jours fériés) au lieu du séjour.
        </p>
      </div>`;
  }

  /* ------------------------------------------------------------
     B — Personnalité & ton
     ------------------------------------------------------------ */
  function renderTon() {
    const p = C.personnalite;
    document.getElementById('vc-pane-ton').innerHTML = `
      <div class="vc-intro">
        Sans ces réglages, Vivi écrit comme n'importe quel assistant. Avec, elle imite <b>votre</b> voix —
        c'est le point qui fait qu'un voyageur ne devine pas qu'il parle à une IA.
      </div>
      <div class="card card--pad">
        <div class="field">
          <label class="field__label" for="vc-p-perception">Comment votre entreprise se perçoit</label>
          <textarea class="textarea" id="vc-p-perception" data-p="perception" maxlength="200"
            placeholder="Ex. On est accueillants, chaleureux, on répond vite et on n'aime pas les formalités.">${esc(p.perception)}</textarea>
          <span class="field__hint"><span id="vc-p-count">${(p.perception || '').length}</span> / 200 caractères</span>
        </div>

        <div class="field mt-6">
          <span class="field__label">Ton préféré de réponse</span>
          <div class="vc-checks">
            ${VIVI_TONS.map(t => `
              <label class="vc-check ${p.ton === t.id ? 'is-on' : ''}">
                <input type="radio" name="vc-ton" data-ton="${t.id}" ${p.ton === t.id ? 'checked' : ''} />
                <span class="vc-check__txt">${t.label}<small>${t.desc}</small></span>
              </label>`).join('')}
          </div>
        </div>

        <div class="field mt-6">
          <label class="field__label" for="vc-p-exemples">Exemples de réponses que vous aimez</label>
          <textarea class="textarea" id="vc-p-exemples" data-p="exemples" style="min-height:140px"
            placeholder="Collez 2 ou 3 vraies réponses que vous avez écrites…">${esc(p.exemples)}</textarea>
          <span class="field__hint">C'est le réglage le plus efficace de cette section : Vivi imite le style, le niveau de détail et la longueur de ces exemples.</span>
        </div>

        <div class="field mt-6">
          <span class="field__label">Éléments à éviter</span>
          <div class="vc-checks vc-checks--inline">
            ${VIVI_A_EVITER.map(a => `
              <label class="vc-check ${p.eviter.includes(a.id) ? 'is-on' : ''}">
                <input type="checkbox" data-eviter="${a.id}" ${p.eviter.includes(a.id) ? 'checked' : ''} />
                <span class="vc-check__txt">${a.label}</span>
              </label>`).join('')}
          </div>
          <!-- Champ libre rattaché à la case « Autre » : la liste fermée ne
               peut pas couvrir toutes les habitudes de rédaction maison. -->
          <input class="input mt-2 ${p.eviter.includes('autre') ? '' : 'hidden'}" id="vc-p-eviter-autre"
            data-p="eviterAutre" value="${esc(p.eviterAutre)}"
            placeholder="${VIVI_A_EVITER.find(a => a.id === 'autre').placeholder}" />
        </div>
      </div>`;
  }

  /* ------------------------------------------------------------
     C — Garde-fous & escalade
     ------------------------------------------------------------ */
  function renderGardeFous() {
    const g = C.gardeFous;
    const seuils = [50, 60, 75, 85, 95];
    const delais = [{ v: 0, l: 'Immédiat' }, { v: 15, l: '15 secondes' }, { v: 30, l: '30 secondes' }, { v: 60, l: '1 minute' }, { v: 300, l: '5 minutes' }];

    document.getElementById('vc-pane-gardefous').innerHTML = `
      <div class="vc-intro">
        Vivi répond seule aux questions simples et sûres. Tout ce qui est coché ci-dessous <b>ne partira jamais</b>
        sans votre aval : le message est mis en attente et vous êtes notifié.
      </div>

      <div class="card card--pad">
        <p class="eyebrow mb-4">Escalade immédiate — Vivi ne répond pas automatiquement</p>
        <div class="vc-checks">
          ${VIVI_ESCALADES.map(e => `
            <label class="vc-check ${g.escalade.includes(e.id) ? 'is-on' : ''}">
              <input type="checkbox" data-escalade="${e.id}" ${g.escalade.includes(e.id) ? 'checked' : ''} />
              <span class="vc-check__txt">${e.label}</span>
            </label>`).join('')}
        </div>
        <!-- Champ libre de la case « Autre » : les six catégories prévues ne
             couvrent pas les sujets sensibles propres à chaque conciergerie. -->
        <textarea class="textarea mt-2 ${g.escalade.includes('autre') ? '' : 'hidden'}" id="vc-gf-escalade-autre"
          data-gf="escaladeAutre" style="min-height:72px"
          placeholder="${VIVI_ESCALADES.find(e => e.id === 'autre').placeholder}">${esc(g.escaladeAutre)}</textarea>
        <p class="vc-hint" id="vc-gf-warn"></p>
      </div>

      <div class="card card--pad mt-4">
        <p class="eyebrow mb-4">Limites de confiance &amp; timing</p>
        <div class="vc-grid">
          <div class="field">
            <label class="field__label" for="vc-gf-conf">Confiance minimum pour répondre automatiquement</label>
            <select class="select" id="vc-gf-conf" data-gf="confianceMin">
              ${seuils.map(s => `<option value="${s}" ${g.confianceMin === s ? 'selected' : ''}>${s} %</option>`).join('')}
            </select>
            <span class="field__hint" id="vc-gf-conf-hint"></span>
          </div>
          <div class="field">
            <label class="field__label" for="vc-gf-delai">Temps minimum avant l'envoi automatique</label>
            <select class="select" id="vc-gf-delai" data-gf="delaiMin">
              ${delais.map(d => `<option value="${d.v}" ${g.delaiMin === d.v ? 'selected' : ''}>${d.l}</option>`).join('')}
            </select>
            <span class="field__hint">Évite la réponse instantanée, qui trahit immédiatement un robot.</span>
          </div>
          <div class="field">
            <label class="field__label" for="vc-gf-silence1">Heures de silence — début</label>
            <input class="input" type="time" id="vc-gf-silence1" data-gf="silenceDebut" value="${esc(g.silenceDebut)}" ${g.silenceActif ? '' : 'disabled'} />
          </div>
          <div class="field">
            <label class="field__label" for="vc-gf-silence2">Heures de silence — fin</label>
            <input class="input" type="time" id="vc-gf-silence2" data-gf="silenceFin" value="${esc(g.silenceFin)}" ${g.silenceActif ? '' : 'disabled'} />
          </div>
        </div>
        <!-- Certaines conciergeries veulent une réponse immédiate à toute heure
             (clientèle internationale, arrivées de nuit) : on rend la plage de
             silence désactivable plutôt que d'imposer une fenêtre. -->
        <label class="vc-check mt-4 ${g.silenceActif ? '' : 'is-on'}">
          <input type="checkbox" id="vc-gf-247" ${g.silenceActif ? '' : 'checked'} />
          <span class="vc-check__txt">Vivi répond 24 h/24<small>Aucune heure de silence : les messages de nuit reçoivent une réponse immédiate.</small></span>
        </label>
        <p class="vc-hint" id="vc-gf-silence-hint"></p>

        <div class="field mt-6">
          <span class="field__label">Qui peut approuver les réponses en attente ?</span>
          <div class="vc-checks">
            ${VIVI_APPROBATEURS.map(a => `
              <label class="vc-check ${g.approbateurs === a.id ? 'is-on' : ''}">
                <input type="radio" name="vc-appro" data-appro="${a.id}" ${g.approbateurs === a.id ? 'checked' : ''} />
                <span class="vc-check__txt">${a.label}</span>
              </label>`).join('')}
          </div>
        </div>
      </div>`;

    majHintsGardeFous();
  }

  // On chiffre l'effet du seuil sur les réponses réelles : c'est plus parlant
  // qu'une explication abstraite.
  function majHintsGardeFous() {
    const g = C.gardeFous;
    const hint = document.getElementById('vc-gf-conf-hint');
    if (hint) {
      const sous = VIVI_REPONSES.filter(r => r.confiance < g.confianceMin).length;
      hint.innerHTML = `Sur les ${VIVI_REPONSES.length} dernières réponses, <b>${sous}</b> passeraient en attente avec ce seuil.`;
    }
    const warn = document.getElementById('vc-gf-warn');
    if (warn) {
      warn.innerHTML = g.escalade.length === 0
        ? `⚠️ Aucun garde-fou actif : Vivi répondra seule même à une demande de remboursement ou à une plainte.`
        : `${g.escalade.length} garde-fou${g.escalade.length > 1 ? 's' : ''} sur ${VIVI_ESCALADES.length} actif${g.escalade.length > 1 ? 's' : ''}.`;
    }
    const sil = document.getElementById('vc-gf-silence-hint');
    if (sil) {
      sil.innerHTML = g.silenceActif
        ? `Les messages reçus entre <b>${esc(g.silenceDebut)}</b> et <b>${esc(g.silenceFin)}</b> attendent le lendemain matin : personne n'écrit spontanément à 3 h du matin.`
        : `Vivi répond à toute heure. Les garde-fous et le seuil de confiance continuent de s'appliquer — c'est seulement la plage horaire qui est levée.`;
    }
  }

  /* ------------------------------------------------------------
     D — Contexte par logement
     ------------------------------------------------------------ */
  let logOuvert = null;

  function ctxHTML(l, ctx) {
    // Rappel de ce que Vivi lit déjà ailleurs : sans ce récapitulatif,
    // l'utilisateur ressaisit l'adresse et le Wi-Fi « au cas où ».
    const deja = [
      { label:'Adresse',        valeur:`${l.adresse}` },
      { label:'Quartier',       valeur:`${l.quartier}, ${l.ville}` },
      { label:'Capacité',       valeur:`${labelTypeLogement(l.type)} · ${l.capacite} voyageurs · ${l.chambres} chambre${l.chambres > 1 ? 's' : ''}` },
      { label:"Code d'accès",   valeur:l.codeAcces },
      { label:'Wi-Fi',          valeur:`${l.wifi.ssid} · ${l.wifi.pass}` },
      // equipements contient des identifiants normalisés : on les traduit.
      { label:'Équipements',    valeur:labelAmenities(l.equipements).join(', ') || '—' },
      { label:'Horaires',       valeur:`Arrivée ${PARAMETRES_GENERAUX.heureArriveeDefaut} · départ ${PARAMETRES_GENERAUX.heureDepartDefaut}` },
    ];

    return `
      <div class="vc-ctx" data-ctx="${l.id}">
        <div class="vc-ctx__head">
          <span class="vc-log__thumb" style="background:${l.couleur}">${l.nom.slice(0, 2).toUpperCase()}</span>
          <b>${esc(l.nom)}</b>
          <button type="button" class="btn btn--ghost btn--sm" data-fermer="${l.id}">Replier</button>
        </div>

        <div class="vc-deja">
          <p class="vc-deja__label">Vivi connaît déjà, depuis la fiche du logement</p>
          <div class="vc-deja__grid">
            ${deja.map(d => `<div class="vc-deja__item"><small>${d.label}</small><span>${esc(d.valeur)}</span></div>`).join('')}
          </div>
          <p class="vc-deja__foot">
            Inutile de le recopier ici : ces informations viennent de la fiche du logement et des
            paramètres généraux. Les modifier là-bas suffit.
            <a href="logements.html">Ouvrir la fiche du logement ↗</a>
          </p>
        </div>

        <div class="field mt-6">
          <label class="field__label">Contexte supplémentaire</label>
          <textarea class="textarea" data-ctx-champ="contexte" data-log="${l.id}" style="min-height:120px"
            placeholder="Ce qu'aucune fiche ne dit : particularités d'accès, voisinage, saisonnalité, pannes récurrentes, bons plans du quartier…">${esc(ctx.contexte)}</textarea>
          <span class="field__hint">C'est ici que Vivi gagne le plus : tout ce que vous répétez de vive voix à chaque voyageur.</span>
        </div>

        <div class="field mt-6">
          <label class="field__label">Règles spéciales</label>
          <textarea class="textarea" data-ctx-champ="regles" data-log="${l.id}"
            placeholder="Ex. Pas de bruit après 22 h, pas de fête, interdiction de fumer à l'intérieur.">${esc(ctx.regles)}</textarea>
        </div>

        <div class="vc-grid mt-6">
          <div class="field">
            <label class="field__label">Contact urgent</label>
            <input class="input" data-ctx-champ="contactTel" data-log="${l.id}" value="${esc(ctx.contactTel)}" placeholder="+33 6 …" />
            <span class="field__hint">Ce que Vivi propose quand elle ne sait pas répondre.</span>
          </div>
          <div class="field">
            <label class="field__label">Horaires de disponibilité du contact</label>
            <input class="input" data-ctx-champ="contactHoraires" data-log="${l.id}" value="${esc(ctx.contactHoraires)}" placeholder="9 h – 19 h" />
          </div>
        </div>

        <div class="field mt-6">
          <span class="field__label">Types de messages que Vivi peut traiter seule</span>
          <div class="vc-checks vc-checks--inline">
            ${VIVI_SUJETS.map(s => {
              const on = (ctx.sujets || []).includes(s.id);
              return `
                <label class="vc-check ${on ? 'is-on' : ''}">
                  <input type="checkbox" data-sujet="${s.id}" data-log="${l.id}" ${on ? 'checked' : ''} />
                  <span class="vc-check__txt">${s.label}${s.escaladeConseillee ? '<small>Escalade conseillée</small>' : ''}</span>
                </label>`;
            }).join('')}
          </div>
        </div>
      </div>`;
  }

  // Complétude du contexte ADDITIONNEL uniquement : ce qui vient de la fiche
  // du logement est toujours là, il n'y a rien à compter.
  function completude(ctx) {
    if (!ctx) return 0;
    const points = [
      !!ctx.contexte,
      !!ctx.regles,
      !!ctx.contactTel,
      (ctx.sujets || []).length > 0,
    ];
    return Math.round(points.filter(Boolean).length / points.length * 100);
  }

  function renderLogements() {
    const renseignes = viviLogementsRenseignes().length;
    const rows = LOGEMENTS.map(l => {
      const ctx = getViviLogement(l.id);
      if (logOuvert === l.id) return ctxHTML(l, ctx || {});
      const pct = completude(ctx);
      const badge = !ctx
        ? '<span class="badge badge--neutral">Non décrit</span>'
        : pct === 100 ? '<span class="badge badge--positive">Complet</span>'
        : `<span class="badge badge--warning">${pct} % complété</span>`;
      return `
        <div class="vc-log">
          <span class="vc-log__thumb" style="background:${l.couleur}">${l.nom.slice(0, 2).toUpperCase()}</span>
          <div class="vc-log__meta">
            <b>${esc(l.nom)}</b>
            <small>${esc(l.ville)} · ${esc(l.type)}</small>
          </div>
          <div class="vc-log__state">
            ${badge}
            <button type="button" class="btn btn--secondary btn--sm" data-ouvrir="${l.id}">${ctx ? 'Éditer le contexte' : 'Décrire ce logement'}</button>
          </div>
        </div>`;
    }).join('');

    document.getElementById('vc-pane-logements').innerHTML = `
      <div class="vc-intro">
        Vivi lit déjà la fiche de chaque logement : adresse, code d'accès, Wi-Fi, équipements, horaires.
        <b>N'ajoutez ici que ce qu'aucune fiche ne dit</b> — les particularités que vous répétez de vive
        voix à chaque voyageur. C'est ce qui lui évite d'escalader une question à laquelle vous auriez
        répondu en dix secondes.
      </div>
      <div class="card card--pad">
        <div class="row" style="justify-content:space-between;align-items:baseline;margin-bottom:var(--sp-4)">
          <p class="eyebrow">Vos logements</p>
          <span class="text-sm text-muted">${renseignes} / ${LOGEMENTS.length} décrits</span>
        </div>
        <div class="vc-logs">${rows}</div>
      </div>`;
  }

  /* ------------------------------------------------------------
     E — Audit & apprentissage
     ------------------------------------------------------------ */
  let repEnEdition = null;

  function repHTML(r) {
    // Logement, canal et voyageur sont déduits de la conversation liée :
    // aucune information n'est recopiée, donc rien ne peut se contredire.
    const ctx = viviContexte(r);
    const enAttente = r.statut !== 'envoyee';
    const langue = (VIVI_LANGUES.find(x => x.id === r.langue) || {}).label || r.langue;

    const actions = enAttente
      ? `<button type="button" class="btn btn--primary btn--sm" data-rep-ok="${r.id}">Approuver et envoyer</button>
         <button type="button" class="btn btn--secondary btn--sm" data-rep-edit="${r.id}">Éditer</button>
         <button type="button" class="btn btn--ghost btn--sm" data-rep-no="${r.id}">Refuser</button>`
      : `<span class="text-xs text-muted">Réponse ${viviOrigine(r)}</span>
         <a class="btn btn--ghost btn--sm" href="messagerie.html?conv=${r.conversationId}">Voir la conversation</a>`;

    const edition = repEnEdition === r.id
      ? `<div class="vc-rep__edit">
           <textarea class="textarea" id="vc-rep-txt">${esc(viviTexte(r))}</textarea>
           <div class="row gap-2 mt-2">
             <button type="button" class="btn btn--primary btn--sm" data-rep-save="${r.id}">Envoyer ma version</button>
             <button type="button" class="btn btn--ghost btn--sm" data-rep-cancel="${r.id}">Annuler</button>
           </div>
         </div>`
      : '';

    return `
      <article class="vc-rep vc-rep--${r.statut}">
        <div class="vc-rep__top">
          <span class="vc-rep__id">${r.id}</span>
          <span class="badge ${VIVI_STATUT_BADGE[r.statut]}">${viviStatutLabel(r)}</span>
          ${ctx.canal ? `<span class="badge-canal badge-canal--${ctx.canal}"><span class="dot"></span>${CANAL_LABEL[ctx.canal] || ctx.canal}</span>` : ''}
          <span class="text-xs text-muted">${ctx.voyageur ? esc(ctx.voyageur) + ' · ' : ''}${ctx.logement ? esc(ctx.logement.nom) : ''} · ${langue}</span>
          <span class="vc-rep__when">${r.quand.replace(' ', ' à ')}</span>
        </div>
        <p class="vc-rep__q">« ${esc(viviQuestion(r))} »</p>
        <p class="vc-rep__a">${esc(viviTexte(r))}</p>
        ${r.raison ? `<span class="vc-rep__why">Raison : ${esc(r.raison)}</span>` : ''}
        ${edition}
        <div class="vc-rep__foot">
          <span class="vc-rep__conf">Confiance ${r.confiance} %</span>
          ${actions}
        </div>
      </article>`;
  }

  function renderAudit() {
    const m = VIVI_METRIQUES;
    const attente = VIVI_REPONSES.filter(r => r.statut === 'attente' || r.statut === 'escaladee').length;
    const envoyees = VIVI_REPONSES.filter(r => r.statut === 'envoyee').length;
    const tauxAuto = Math.round(m.autoEnvoyees / m.reponsesGenerees * 100);

    const metrics = [
      { label: 'Messages reçus',      val: m.messagesRecus.toLocaleString('fr-FR'), sub: m.mois },
      { label: 'Réponses générées',   val: m.reponsesGenerees, sub: 'par Vivi' },
      { label: 'Envoyées auto',       val: m.autoEnvoyees, sub: `${tauxAuto} % des réponses` },
      { label: 'En attente',          val: attente, sub: 'à relire maintenant' },
      { label: 'Temps économisé',     val: m.heuresGagnees + ' h', sub: 'sur le mois' },
      { label: 'Satisfaction',        val: m.satisfaction + ' / 5', sub: 'avis voyageurs' },
    ];

    document.getElementById('vc-pane-audit').innerHTML = `
      <div class="vc-intro">
        Vous voyez chaque réponse générée par Vivi. Celles qui attendent votre aval peuvent être
        approuvées, corrigées ou refusées — et <b>vos corrections servent d'exemples</b> pour les suivantes.
      </div>

      <div class="vc-metrics">
        ${metrics.map(k => `<div class="vc-metric"><small>${k.label}</small><b>${k.val}</b><em>${k.sub}</em></div>`).join('')}
      </div>

      <div class="card card--pad mt-4">
        <div class="row" style="justify-content:space-between;align-items:baseline;margin-bottom:var(--sp-4)">
          <p class="eyebrow">Dernières réponses</p>
          <span class="text-sm text-muted">${envoyees} envoyée${envoyees > 1 ? 's' : ''} · ${attente} en attente</span>
        </div>
        <div class="vc-reps">${VIVI_REPONSES.map(repHTML).join('')}</div>
      </div>

      <div class="card card--pad mt-4">
        <p class="eyebrow mb-4">Suggestions d'amélioration</p>
        <div class="vc-sugg">
          ${VIVI_SUGGESTIONS.map((s, i) => `
            <div class="vc-sugg__item">
              <span class="vc-sugg__n">${i + 1}</span>
              <div class="grow">
                <b>${esc(s.titre)}</b>
                <p>${esc(s.conseil)}</p>
              </div>
              <button type="button" class="btn btn--secondary btn--sm" data-pane-go="${s.section}">Corriger</button>
            </div>`).join('')}
        </div>
      </div>`;
  }

  /* ------------------------------------------------------------
     Onglets
     ------------------------------------------------------------ */
  function activate(name) {
    const nav = document.getElementById('vc-nav');
    if (!nav.querySelector(`[data-pane="${name}"]`)) name = 'global';
    nav.querySelectorAll('button').forEach(b => b.classList.toggle('is-active', b.dataset.pane === name));
    document.querySelectorAll('.vc-pane').forEach(p => p.classList.toggle('is-active', p.id === 'vc-pane-' + name));
    history.replaceState(null, '', '#' + name);
  }

  /* ------------------------------------------------------------
     Démarrage
     ------------------------------------------------------------ */
  document.getElementById('vc-ask').addEventListener('click', () => {
    if (typeof Vivi !== 'undefined') Vivi.demander("Comment configurer l'IA avancée ?");
  });

  if (niveau !== 'avancee') { renderLocked(); return; }

  document.getElementById('vc-app').classList.remove('hidden');
  renderGlobal(); renderTon(); renderGardeFous(); renderLogements(); renderAudit();
  activate(location.hash ? location.hash.slice(1) : 'global');

  document.getElementById('vc-nav').addEventListener('click', e => {
    const b = e.target.closest('button[data-pane]');
    if (b) activate(b.dataset.pane);
  });

  /* ---------- Saisie : tout est enregistré au fil de l'eau ---------- */
  const app = document.getElementById('vc-app');

  app.addEventListener('input', e => {
    const t = e.target;

    // A / B : champs texte simples
    if (t.dataset.g)  { C.global[t.dataset.g] = t.value; save(); return; }
    if (t.dataset.p)  {
      C.personnalite[t.dataset.p] = t.value;
      const cpt = document.getElementById('vc-p-count');
      if (cpt && t.dataset.p === 'perception') cpt.textContent = t.value.length;
      save(); return;
    }
    // C : seuils et horaires
    if (t.dataset.gf) {
      const num = t.dataset.gf === 'confianceMin' || t.dataset.gf === 'delaiMin';
      C.gardeFous[t.dataset.gf] = num ? parseInt(t.value, 10) : t.value;
      majHintsGardeFous(); save(); return;
    }
    // D : champs du contexte d'un logement
    if (t.dataset.ctxChamp) {
      const ctx = C.logements[t.dataset.log];
      if (ctx) { ctx[t.dataset.ctxChamp] = t.value; save(); }
      return;
    }
  });

  app.addEventListener('change', e => {
    const t = e.target;
    // Les <select> déclenchent aussi 'change' : le handler 'input' les couvre déjà.
    const cocher = (liste, val, on) => {
      const i = liste.indexOf(val);
      if (on && i === -1) liste.push(val);
      if (!on && i > -1) liste.splice(i, 1);
    };
    const majVisuel = () => {
      const lab = t.closest('.vc-check');
      if (!lab) return;
      if (t.type === 'radio') {
        lab.closest('.vc-checks').querySelectorAll('.vc-check').forEach(x => x.classList.remove('is-on'));
      }
      lab.classList.toggle('is-on', t.checked);
    };

    if (t.dataset.langue)  { cocher(C.global.languesVoyageurs, t.dataset.langue, t.checked); majVisuel(); save(); return; }
    if (t.dataset.eviter)  {
      cocher(C.personnalite.eviter, t.dataset.eviter, t.checked);
      // La case « Autre » ne sert à rien sans son champ de saisie : on le révèle.
      if (t.dataset.eviter === 'autre') document.getElementById('vc-p-eviter-autre').classList.toggle('hidden', !t.checked);
      majVisuel(); save(); return;
    }
    if (t.dataset.ton)     { C.personnalite.ton = t.dataset.ton; majVisuel(); save(); return; }
    if (t.dataset.appro)   { C.gardeFous.approbateurs = t.dataset.appro; majVisuel(); save(); return; }
    if (t.dataset.escalade){
      cocher(C.gardeFous.escalade, t.dataset.escalade, t.checked);
      if (t.dataset.escalade === 'autre') document.getElementById('vc-gf-escalade-autre').classList.toggle('hidden', !t.checked);
      majVisuel(); majHintsGardeFous(); save(); return;
    }
    // 24 h/24 : la case coche l'ABSENCE de plage de silence, d'où la négation.
    if (t.id === 'vc-gf-247') {
      C.gardeFous.silenceActif = !t.checked;
      ['vc-gf-silence1', 'vc-gf-silence2'].forEach(id => { document.getElementById(id).disabled = t.checked; });
      majVisuel(); majHintsGardeFous(); save(); return;
    }

    // D — contexte par logement
    const ctx = C.logements[t.dataset.log];
    if (t.dataset.sujet && ctx) {
      ctx.sujets = ctx.sujets || [];
      cocher(ctx.sujets, t.dataset.sujet, t.checked);
      majVisuel(); save(); return;
    }
  });

  /* ---------- Clics : ouverture d'un logement, actions d'audit ---------- */
  app.addEventListener('click', e => {
    const ouvrir = e.target.closest('[data-ouvrir]');
    if (ouvrir) {
      const id = ouvrir.dataset.ouvrir;
      // Créer un contexte vide à la volée : décrire un logement ne doit pas
      // demander une étape « créer la fiche » préalable.
      if (!C.logements[id]) {
        C.logements[id] = { contexte: '', regles: '', contactTel: '', contactHoraires: '', sujets: [] };
        save();
      }
      logOuvert = id;
      renderLogements();
      return;
    }
    const fermer = e.target.closest('[data-fermer]');
    if (fermer) { logOuvert = null; renderLogements(); return; }

    const go = e.target.closest('[data-pane-go]');
    if (go) { activate(go.dataset.paneGo); window.scrollTo(0, 0); return; }

    // Audit : approuver / éditer / refuser.
    // viviApprouver() poste réellement le message dans la conversation,
    // pour que la messagerie affiche la même chose immédiatement.
    const ok = e.target.closest('[data-rep-ok]');
    if (ok) {
      viviApprouver(ok.dataset.repOk);
      repEnEdition = null; renderAudit(); majHintsGardeFous(); save();
      UI.toast('Réponse approuvée et envoyée au voyageur');
      return;
    }
    const ed = e.target.closest('[data-rep-edit]');
    if (ed) { repEnEdition = ed.dataset.repEdit; renderAudit(); return; }

    const cancel = e.target.closest('[data-rep-cancel]');
    if (cancel) { repEnEdition = null; renderAudit(); return; }

    const sv = e.target.closest('[data-rep-save]');
    if (sv) {
      const txt = document.getElementById('vc-rep-txt').value.trim();
      if (!txt) { UI.toast('La réponse ne peut pas être vide', false); return; }
      viviApprouver(sv.dataset.repSave, txt);
      repEnEdition = null; renderAudit(); save();
      UI.toast('Votre version a été envoyée — Vivi en tiendra compte');
      return;
    }
    const no = e.target.closest('[data-rep-no]');
    if (no) {
      const id = no.dataset.repNo;
      UI.confirm({
        title: 'Refuser cette réponse ?',
        message: `La proposition de Vivi sera supprimée et le voyageur restera sans réponse tant que vous n'aurez pas écrit vous-même.\n\nSon message, lui, reste visible dans la messagerie.`,
        confirmText: 'Refuser la réponse',
        cancelText: 'Annuler',
        danger: true,
        onConfirm() {
          viviRefuser(id);
          repEnEdition = null; renderAudit(); save();
          UI.toast('Réponse refusée');
        },
      });
    }
  });
})();
