/* ============================================================
   OYVIA — Vivi Chat : le copilote de l'utilisateur

   Disponible sur TOUTES les offres (contrairement à l'IA Avancée,
   qui répond aux voyageurs et n'existe qu'en Business).

   Le widget s'injecte tout seul : il suffit d'inclure ce fichier
   après layout.js. Il se construit une fois le DOM prêt, donc il
   fonctionne aussi sur les pages qui n'ont pas de shell applicatif.

   Vivi n'appelle aucune API : les réponses sont dérivées des
   données réelles de la démo (STATS, VIVI_REPONSES, PLATEFORMES,
   COMPTE…). C'est volontaire — dans une maquette, une réponse
   fausse mais bien formatée serait pire qu'une réponse absente.
   ============================================================ */
const Vivi = (function () {

  const ICO = {
    close: '<path d="M18 6 6 18M6 6l12 12"/>',
    send:  '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
  };
  const svg = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;

  // Chemin relatif vers les pages de l'app : le widget est aussi chargé
  // depuis des pages situées à la racine.
  const dansApp = /\/app\//.test(location.pathname);
  const lien = page => (dansApp ? '' : 'app/') + page;
  const asset = f => (dansApp ? '../' : '') + 'assets/' + f;
  // Le logo de Vivi, réutilisé partout où elle « se présente ».
  const avatar = (cls = '') => `<img class="vivi-avatar ${cls}" src="${asset('vivi.svg')}" alt="" aria-hidden="true" />`;

  let panel, fab, body, input, faqList, ouvert = false;
  let faqOffset = 0;

  /* ------------------------------------------------------------
     Ce que Vivi sait dire — les intentions, dans l'ordre de test
     ------------------------------------------------------------ */
  const heure = () => new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const enAttente = () => viviReponsesEnAttente();
  const btn = (label, href) => `<a class="btn btn--secondary" href="${href}">${label}</a>`;

  const INTENTS = [
    {
      id: 'config_ia',
      mots: ['configurer l\'ia', 'config ia', 'ia avancée', 'ia avancee', 'configurer vivi', 'parametrer l\'ia', 'paramétrer l\'ia'],
      repond() {
        const niveau = viviNiveauIA();
        const p = getPlan(COMPTE.plan);
        if (niveau === 'avancee') {
          return {
            texte: `Vous êtes en <b>${p.nom}</b>, vous avez donc accès à la configuration complète. Cinq sections à régler, dans cet ordre :
              <ul>
                <li><b>Contexte global</b> — qui vous êtes, vos langues</li>
                <li><b>Personnalité & ton</b> — pour que Vivi écrive comme vous</li>
                <li><b>Garde-fous</b> — quand elle doit s'arrêter et vous passer la main</li>
                <li><b>Contexte par logement</b> — le plus important : WiFi, accès, règles</li>
                <li><b>Audit</b> — relire ce qu'elle a répondu et la corriger</li>
              </ul>
              Le contexte par logement est celui qui change le plus la qualité des réponses : ${viviLogementsACompleter().length} de vos logements ne sont pas encore décrits.`,
            actions: btn('Configurer mon IA →', lien('vivi.html')),
          };
        }
        return {
          texte: `Votre offre <b>${p.nom}</b> n'inclut pas d'IA pour répondre aux voyageurs. Vivi reste disponible ici, en revanche, pour répondre à <em>vos</em> questions.
            <br><br>Attention à ne pas confondre : vos <b>automatisations</b> (confirmation, rappel avant arrivée, demande d'avis) sont bien actives — ce sont des règles déclenchées par la réservation, pas de l'IA.
            <br><br>Pour que Vivi réponde d'elle-même aux messages entrants, il faut l'offre <b>Business</b> à ${formatMAD(prixParLogement('business', COMPTE.nbLogements))} par logement et par mois, pour votre parc de ${COMPTE.nbLogements} logements.`,
          actions: btn('Comparer les offres', lien('abonnement.html')),
        };
      },
    },
    {
      id: 'attente',
      mots: ['en attente', 'révision', 'revision', 'à relire', 'a relire', 'à valider', 'a valider', 'approuver', 'valider les réponses'],
      repond() {
        // Deux natures de propositions attendent votre aval : les réponses
        // écrites et les tâches déduites des messages. Ne compter que les
        // réponses contredirait le filtre « IA - À valider », qui réunit les
        // deux — Vivi annoncerait « rien ne vous attend » alors que des
        // tâches dorment.
        const list = enAttente();
        const taches = typeof viviTachesProposees === 'function' ? viviTachesProposees() : [];
        const total = list.length + taches.length;
        if (!total) return { texte: `Rien à valider : les réponses de Vivi sont toutes parties automatiquement, et aucune tâche n'attend votre aval. 🎉` };

        const lignes = list.slice(0, 3).map(r => {
          const c = viviContexte(r);
          return `<li><b>${c.voyageur || '—'}</b> — « ${viviQuestion(r)} »<br><small>Réponse · ${c.logement ? c.logement.nom + ' · ' : ''}${r.raison} · confiance ${r.confiance} %</small></li>`;
        }).join('');
        const lignesT = taches.slice(0, 3).map(p => {
          const l = getLogement(p.tache.logementId);
          return `<li><b>${p.categorie.label}</b> — « ${p.extrait.slice(0, 70)}${p.extrait.length > 70 ? '…' : ''} »<br><small>Tâche · ${l ? l.nom + ' · ' : ''}${formatDate(p.tache.date)} à ${p.tache.heure}</small></li>`;
        }).join('');
        const reste = total - Math.min(list.length, 3) - Math.min(taches.length, 3);

        const detail = [
          list.length ? `${list.length} réponse${list.length > 1 ? 's' : ''}` : '',
          taches.length ? `${taches.length} tâche${taches.length > 1 ? 's' : ''}` : '',
        ].filter(Boolean).join(' et ');

        return {
          texte: `Vous avez <b>${total} élément${total > 1 ? 's' : ''}</b> à valider — ${detail} :<ul>${lignes}${lignesT}</ul>
            ${reste > 0 ? `<br>… et ${reste} autre${reste > 1 ? 's' : ''}.` : ''}`,
          actions: btn('Ouvrir la messagerie', lien('messagerie.html?filtre=ia')) + btn("Voir l'audit", lien('vivi.html#audit')),
        };
      },
    },
    {
      id: 'pourquoi_pas_repondu',
      mots: ['pas eu de réponse', 'pas répondu', 'pas repondu', 'pourquoi pas envoyé', "n'a pas envoyé", 'pas partie'],
      repond() {
        const g = VIVI_CONFIG.gardeFous;
        const bloquees = enAttente();
        const raisons = {};
        bloquees.forEach(r => { raisons[r.raison] = (raisons[r.raison] || 0) + 1; });
        const detail = Object.entries(raisons).map(([r, n]) => `<li>${r} — ${n} message${n > 1 ? 's' : ''}</li>`).join('');
        return {
          texte: `Quand Vivi ne répond pas seule, c'est toujours pour une de ces trois raisons :
            <ul>
              <li>un <b>garde-fou</b> s'est déclenché (${g.escalade.length} catégories activées)</li>
              <li>sa <b>confiance</b> était sous votre seuil de ${g.confianceMin} %</li>
              <li>le message est arrivé pendant vos <b>heures de silence</b> (${g.silenceDebut} – ${g.silenceFin})</li>
            </ul>
            Sur vos ${bloquees.length} messages actuellement bloqués :<ul>${detail}</ul>`,
          actions: btn('Régler les garde-fous', lien('vivi.html#gardefous')),
        };
      },
    },
    {
      id: 'revenus',
      mots: ['revenus', 'chiffre d\'affaires', 'ca du mois', 'combien j\'ai gagné', 'combien ai-je gagné'],
      repond() {
        const i = STATS.ca.length - 1;
        const ca = STATS.ca[i], prev = STATS.ca[i - 1];
        const evo = Math.round((ca - prev) / prev * 100);
        const meilleur = [...STATS.parLogement].sort((a, b) => b.ca - a.ca)[0];
        const l = getLogement(meilleur.id);
        return {
          texte: `Sur le mois en cours, votre chiffre d'affaires est de <b>${formatEuro(ca)}</b>, soit ${evo >= 0 ? '+' : ''}${evo} % par rapport au mois dernier.
            <br><br>Votre meilleur bien est <b>${l ? l.nom : meilleur.id}</b> avec ${formatEuro(meilleur.ca)} et ${meilleur.occ} % d'occupation. Le taux d'occupation moyen du parc est de ${STATS.occupation[i]} %.`,
          actions: btn('Voir les statistiques', lien('statistiques.html')),
        };
      },
    },
    {
      id: 'diagnostic_canal',
      mots: ['messages booking', 'pas les messages', 'reçois pas', 'recois pas', 'synchronisation', 'pas synchro', 'connexion airbnb'],
      repond() {
        const deconnectees = PLATEFORMES.filter(p => !p.connecte);
        const connectees = PLATEFORMES.filter(p => p.connecte);
        return {
          texte: `Faisons le tour dans l'ordre :
            <ul>
              <li><b>La plateforme est-elle connectée ?</b> Actuellement connectées : ${connectees.map(p => p.nom).join(', ')}.
                ${deconnectees.length ? `Non connectées : ${deconnectees.map(p => p.nom).join(', ')} — les messages de ces canaux n'arrivent pas dans Oyvia.` : ''}</li>
              <li><b>La conversation existe-t-elle ?</b> Un canal déconnecté masque ses conversations dans la messagerie : elles réapparaissent dès la reconnexion, rien n'est perdu.</li>
              <li><b>Le message est-il rattaché à une réservation ?</b> Oyvia relie chaque conversation à une réservation : un message hors réservation n'apparaît pas.</li>
            </ul>`,
          actions: btn('Vérifier mes plateformes', lien('parametres.html')),
        };
      },
    },
    {
      id: 'ajouter_logement',
      mots: ['ajouter un logement', '2e logement', 'deuxième logement', 'nouveau logement', 'ajouter un bien'],
      repond() {
        const p = getPlan(COMPTE.plan);
        const apres = COMPTE.nbLogements + 1;
        const total = planTotal(p.id, apres);
        const debordement = !planEligible(p.id, apres);
        return {
          texte: `Rendez-vous sur <b>Logements → Ajouter un logement</b>. Vous n'avez que le nom, la ville, le type et le tarif de base à renseigner ; les canaux se connectent ensuite un par un.
            <br><br>Côté facturation : vous gérez ${COMPTE.nbLogements} logements en <b>${p.nom}</b>. ${
              debordement
                ? `Un logement de plus dépasse la limite de ${p.maxLog} de votre offre : il faudra passer à l'offre suivante.`
                : `Avec un logement de plus, votre abonnement passerait à ${formatMAD(total)} par mois.`}
            <br><br>Pensez aussi à l'affecter à un propriétaire, sinon il n'apparaîtra dans aucun relevé.`,
          actions: btn('Ajouter un logement', lien('logements.html')) + btn('Affecter un propriétaire', lien('proprietaires.html')),
        };
      },
    },
    {
      id: 'facturation',
      mots: ['facturation', 'combien je paie', 'mon abonnement', 'ma facture', 'prix', 'tarif'],
      repond() {
        const p = getPlan(COMPTE.plan);
        const prix = planPrixTexte(p.id, COMPTE.nbLogements);
        return {
          texte: `Vous êtes en <b>${p.nom}</b> : ${prix.montant} ${prix.suffixe}. Pour ${COMPTE.nbLogements} logements gérés, cela fait <b>${formatMAD(planTotal(p.id, COMPTE.nbLogements))} par mois</b>.
            <br><br>Sans engagement, résiliable à tout moment. L'option WhatsApp voyageur, si elle est active, est facturée au message envoyé — les réponses dans la fenêtre de 24 h restent gratuites.`,
          actions: btn('Voir mon abonnement', lien('abonnement.html')),
        };
      },
    },
    {
      id: 'menage',
      mots: ['ménage', 'menage', 'tâches', 'taches', 'prestataire'],
      repond() {
        const aFaire = TACHES.filter(t => t.statut !== 'termine');
        const nonAssignees = aFaire.filter(t => !t.prestataireId);
        return {
          texte: `Il reste <b>${aFaire.length} tâche${aFaire.length > 1 ? 's' : ''}</b> non terminée${aFaire.length > 1 ? 's' : ''}, dont ${nonAssignees.length} sans prestataire assigné.
            <br><br>Astuce : les tâches récurrentes (ménage après chaque départ, par exemple) se définissent une fois par logement, dans sa fiche — vous n'avez plus à les créer à la main.`,
          actions: btn('Gestion des tâches', lien('menage.html')),
        };
      },
    },
    {
      id: 'optimiser',
      mots: ['optimiser', 'améliorer', 'ameliorer', 'conseil', 'astuce', 'gagner plus'],
      repond() {
        const aCompleter = viviLogementsACompleter();
        const direct = STATS.repartitionCanal.direct;
        return {
          texte: `Trois pistes, dans l'ordre d'impact pour votre compte :
            <ul>
              <li><b>Décrire vos logements à Vivi</b> — ${aCompleter.length} logements ne sont pas encore renseignés. Sans contexte, Vivi escalade au lieu de répondre.</li>
              <li><b>Pousser le direct</b> — ${direct} % de vos réservations sont en direct, donc sans commission. Chaque point gagné là est du revenu net.</li>
              <li><b>Baisser le seuil de confiance</b> — il est à ${VIVI_CONFIG.gardeFous.confianceMin} %. Si vos réponses en attente sont presque toujours approuvées telles quelles, descendre à 65 % vous fera gagner du temps sans risque.</li>
            </ul>`,
          actions: btn('Configurer Vivi', lien('vivi.html#logements')),
        };
      },
    },
    {
      id: 'occupation',
      mots: ['occupation', 'taux de remplissage', 'remplissage'],
      repond() {
        const i = STATS.occupation.length - 1;
        const tri = [...STATS.parLogement].sort((a, b) => a.occ - b.occ);
        const pire = getLogement(tri[0].id);
        return {
          texte: `Le parc est à <b>${STATS.occupation[i]} %</b> d'occupation ce mois-ci (${STATS.occupation[i] - STATS.occupation[i - 1]} points de plus que le mois dernier).
            <br><br>Le bien le moins rempli est <b>${pire ? pire.nom : tri[0].id}</b> à ${tri[0].occ} % : c'est là qu'un ajustement de tarif a le plus d'effet.`,
          actions: btn('Voir les statistiques', lien('statistiques.html')),
        };
      },
    },
  ];

  // Question hors périmètre → on propose le support plutôt que d'inventer.
  function reponseParDefaut(question) {
    return {
      texte: `Je ne suis pas sûre de savoir répondre à ça, et je préfère vous le dire plutôt que d'improviser.
        <br><br>Je peux en revanche vous aider sur : votre activité (revenus, occupation, tâches), le fonctionnement d'Oyvia, la configuration de l'IA, ou le diagnostic d'un canal qui ne remonte pas ses messages.`,
      actions: `<button type="button" class="btn btn--secondary" data-vivi-support="${encodeURIComponent(question)}">Contacter le support</button>`,
    };
  }

  function trouverIntent(texte) {
    const t = texte.toLowerCase();
    return INTENTS.find(i => i.mots.some(m => t.includes(m))) || null;
  }

  /* ------------------------------------------------------------
     Rendu
     ------------------------------------------------------------ */
  function panelHTML() {
    const p = getPlan(COMPTE.plan);
    const niveau = viviNiveauIA();
    const niveauTxt = niveau === 'avancee' ? 'Vivi IA Avancée active' : 'sans IA voyageurs';
    const lienConfig = niveau === 'avancee'
      ? `<div class="vivi-msg__actions">${btn('⚙️ Configurer mon IA', lien('vivi.html'))}</div>`
      : '';

    return `
      <div class="vivi-panel__head">
        <span class="vivi-face">${avatar()}</span>
        <div>
          <b>Vivi</b>
          <small>Votre assistant virtuel Oyvia</small>
        </div>
        <button type="button" class="vivi-panel__close" id="vivi-close" aria-label="Fermer">${svg(ICO.close)}</button>
      </div>

      <div class="vivi-body" id="vivi-body">
        <div class="vivi-hello">
          <b>Salut ${UTILISATEUR.nom.split(' ')[0]} ! C'est Vivi 👋</b>
          <p>Je suis votre assistant virtuel Oyvia. Je peux vous aider à :</p>
          <ul>
            <li>répondre à vos questions sur Oyvia</li>
            <li>vous conseiller sur les fonctionnalités</li>
            <li>optimiser vos réponses IA</li>
            <li>analyser votre activité</li>
          </ul>
          <span class="vivi-hello__plan">Offre ${p.nom} · ${niveauTxt}</span>
          ${lienConfig}
        </div>
      </div>

      <div class="vivi-faq">
        <div class="vivi-faq__label">
          <span>Questions fréquentes</span>
          <button type="button" class="vivi-faq__shuffle" id="vivi-faq-shuffle">Autres ↻</button>
        </div>
        <div class="vivi-faq__list" id="vivi-faq-list"></div>
      </div>

      <form class="vivi-input" id="vivi-form">
        <input type="text" id="vivi-input" placeholder="Posez votre question…" aria-label="Votre question pour Vivi" autocomplete="off" />
        <button type="submit" aria-label="Envoyer">${svg(ICO.send)}</button>
      </form>`;
  }

  function renderFaq() {
    // 3 suggestions à la fois, en rotation sur la liste complète.
    const trois = [0, 1, 2].map(i => VIVI_FAQ[(faqOffset + i) % VIVI_FAQ.length]);
    faqList.innerHTML = trois.map(f => `<button type="button" data-vivi-faq="${f.intent}">${f.q}</button>`).join('');
  }

  function bulle(auteur, html, actions) {
    const el = document.createElement('div');
    el.className = 'vivi-msg vivi-msg--' + (auteur === 'moi' ? 'moi' : 'vivi');
    el.innerHTML = `<span class="vivi-msg__meta">${auteur === 'moi' ? 'Vous' : 'Vivi'} — ${heure()}</span>${html}
      ${actions ? `<div class="vivi-msg__actions">${actions}</div>` : ''}`;
    body.appendChild(el);
    body.scrollTop = body.scrollHeight;
    return el;
  }

  // Petit délai + indicateur de frappe : sans ça, une réponse instantanée
  // à une question longue casse l'illusion et se lit mal.
  function repondre(intent, question) {
    const t = document.createElement('div');
    t.className = 'vivi-typing';
    t.innerHTML = '<i></i><i></i><i></i>';
    body.appendChild(t);
    body.scrollTop = body.scrollHeight;

    setTimeout(() => {
      t.remove();
      const r = intent ? intent.repond() : reponseParDefaut(question);
      bulle('vivi', r.texte, r.actions);
    }, 520);
  }

  function envoyer(question) {
    const q = question.trim();
    if (!q) return;
    bulle('moi', q.replace(/</g, '&lt;'));
    input.value = '';
    repondre(trouverIntent(q), q);
  }

  /* ------------------------------------------------------------
     Construction
     ------------------------------------------------------------ */
  function build() {
    if (document.getElementById('vivi-fab')) return;

    // La pastille compte tout ce qui attend votre aval — réponses ET tâches —
    // pour coller au compteur « IA - À valider » de la messagerie.
    const nb = enAttente().length + (typeof viviTachesProposees === 'function' ? viviTachesProposees().length : 0);
    fab = document.createElement('button');
    fab.type = 'button';
    fab.className = 'vivi-fab';
    fab.id = 'vivi-fab';
    fab.setAttribute('aria-label', 'Ouvrir Vivi, votre assistant');
    fab.innerHTML = `
      <span class="vivi-face">
        ${avatar()}
        ${nb ? `<span class="vivi-fab__dot">${nb}</span>` : ''}
      </span>
      <span class="vivi-fab__label">Vivi</span>`;

    panel = document.createElement('div');
    panel.className = 'vivi-panel';
    panel.id = 'vivi-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Vivi, votre assistant virtuel');
    panel.innerHTML = panelHTML();

    /* Le bouton vit désormais DANS la barre du haut, juste à gauche du
       champ de recherche, au lieu de flotter au-dessus du contenu. En
       flottant il recouvrait ce qui se trouvait dans le coin bas-droit :
       le composeur de la messagerie sur mobile, les actions d'une
       proposition de tâche, le dernier message d'un fil. Ancré dans la
       barre, il ne peut plus rien masquer.
       Repli sur <body> si la page n'a pas de barre : le bouton doit
       exister même hors de la coquille applicative. */
    const ancre = document.querySelector('.app-topbar__search');
    if (ancre && ancre.parentNode) ancre.parentNode.insertBefore(fab, ancre);
    else document.body.appendChild(fab);
    document.body.appendChild(panel);

    body = panel.querySelector('#vivi-body');
    input = panel.querySelector('#vivi-input');
    faqList = panel.querySelector('#vivi-faq-list');
    renderFaq();

    // Ouverture / fermeture : cliquer le bouton bascule (clics multiples OK)
    fab.addEventListener('click', toggle);
    panel.querySelector('#vivi-close').addEventListener('click', close);
    panel.querySelector('#vivi-faq-shuffle').addEventListener('click', () => { faqOffset += 3; renderFaq(); });

    panel.querySelector('#vivi-form').addEventListener('submit', e => {
      e.preventDefault();
      envoyer(input.value);
    });

    // FAQ + escalade support (délégation : les bulles sont créées à la volée)
    panel.addEventListener('click', e => {
      const faq = e.target.closest('[data-vivi-faq]');
      if (faq) {
        bulle('moi', faq.textContent);
        repondre(INTENTS.find(i => i.id === faq.dataset.viviFaq), faq.textContent);
        return;
      }
      const sup = e.target.closest('[data-vivi-support]');
      if (sup) {
        const q = decodeURIComponent(sup.dataset.viviSupport);
        sup.disabled = true;
        bulle('vivi', `C'est noté : j'ai ouvert un ticket au support avec le contexte de notre conversation et votre question « ${q} ». Vous recevrez une réponse par e-mail à <b>${UTILISATEUR.email || 'votre adresse'}</b>.`);
        if (typeof UI !== 'undefined') UI.toast('Ticket de support ouvert');
      }
    });

    document.addEventListener('keydown', e => { if (e.key === 'Escape' && ouvert) close(); });
  }

  function open() {
    ouvert = true;
    panel.classList.add('is-open');
    fab.classList.add('is-hidden');
    setTimeout(() => input && input.focus(), 120);
  }
  function close() {
    ouvert = false;
    panel.classList.remove('is-open');
    fab.classList.remove('is-hidden');
  }
  function toggle() { ouvert ? close() : open(); }

  // Permet d'ouvrir Vivi sur une question précise depuis n'importe où
  // (ex. bouton « Demander à Vivi » sur un écran).
  function demander(question) {
    if (!panel) build();
    open();
    envoyer(question);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();

  return { open, close, toggle, demander };
})();
