/* ============================================================
   OYVIA — Aide à la rédaction (Vivi)

   Un bouton discret dans chaque zone de texte : on jette ses idées en
   vrac, on clique, Vivi remet la phrase d'aplomb.

   Trois partis pris.

   1. ON N'ÉCRIT JAMAIS À LA PLACE DE QUELQU'UN SANS RETOUR POSSIBLE.
      Le texte d'origine est conservé et le bouton devient « Rétablir »
      pendant quelques secondes. Une reformulation qui écrase huit lignes
      de travail sans annulation se paie une seule fois : après, plus
      personne n'ose cliquer.

   2. LE CONTEXTE CHANGE LE TON. Répondre à un avis public, évaluer un
      voyageur ou écrire à un prestataire ne demandent ni la même
      politesse ni la même longueur. Le champ déclare son contexte
      (`data-ia="avis"`), et à défaut on se contente de nettoyer.

   3. RIEN N'EST INVENTÉ. La reformulation corrige, ponctue, développe
      les abréviations et pose les formules d'usage — elle n'ajoute
      aucun fait. Un texte qui affirmerait « le ménage a été refait »
      alors que l'hôte n'a rien dit de tel serait un mensonge signé de
      son nom.

   ⚠ Prototype : aucun appel réseau. La reformulation est produite
   localement par des règles, pas par un modèle de langage. Le geste,
   l'attente et le retour arrière sont en revanche ceux du produit final.
   ============================================================ */
const IARedaction = (function () {

  /* Abréviations et raccourcis de saisie rapide. La liste vient de ce
     qu'on écrit vraiment en tapant vite, pas d'un dictionnaire de SMS. */
  const ABREVIATIONS = {
    bcp: 'beaucoup', pb: 'problème', pbs: 'problèmes', rdv: 'rendez-vous',
    tjs: 'toujours', tt: 'tout', ds: 'dans', qd: 'quand', pr: 'pour',
    ms: 'mais', qq: 'quelques', qqn: 'quelqu\'un', qqch: 'quelque chose',
    nb: 'nombre', svp: 's\'il vous plaît', mtn: 'maintenant', dsl: 'désolé',
    bjr: 'bonjour', bsr: 'bonsoir', mrc: 'merci', jms: 'jamais',
    ok: 'entendu', vs: 'vous', ns: 'nous', ete: 'été', tres: 'très',
    prb: 'problème', apparte: 'appartement', appart: 'appartement',
    log: 'logement', voy: 'voyageur', menage: 'ménage', reserv: 'réservation',
  };

  /* Accents oubliés en tapant vite. La liste est volontairement COURTE
     et sans ambiguïté : « regle » peut être « règle » ou « réglé », « a »
     peut être « à ». Corriger au jugé ferait dire au texte autre chose
     que ce que son auteur a écrit — exactement ce qu'on veut éviter. */
  const ACCENTS = {
    reparé: 'réparé', repare: 'réparé', reparation: 'réparation',
    probleme: 'problème', problemes: 'problèmes',
    desole: 'désolé', desolee: 'désolée', decu: 'déçu', decue: 'déçue',
    sejour: 'séjour', sejours: 'séjours', apres: 'après', deja: 'déjà',
    etait: 'était', etaient: 'étaient', meme: 'même', memes: 'mêmes',
    prefere: 'préfère', arrivee: 'arrivée', proprete: 'propreté',
    numero: 'numéro', cle: 'clé', cles: 'clés', tele: 'télé',
    reponse: 'réponse', reserve: 'réservé', verifie: 'vérifié',
    acces: 'accès', prevenez: 'prévenez', prevenir: 'prévenir',
    depart: 'départ', reglee: 'réglée', chauffe: 'chauffé',
    nettoye: 'nettoyé', nettoyee: 'nettoyée', repondu: 'répondu',
  };

  // Ce que le champ attend, selon d'où il vient.
  const CONTEXTES = {
    avis: {
      label: 'Réponse publique à un avis',
      ouverture: 'Bonjour, et merci d’avoir pris le temps de partager votre retour.',
      cloture: 'Au plaisir de vous accueillir à nouveau.',
    },
    evaluation: {
      label: 'Évaluation d’un voyageur',
      ouverture: '',
      cloture: '',
    },
    message: {
      label: 'Message au voyageur',
      ouverture: 'Bonjour,',
      cloture: 'Bien à vous.',
    },
    note: { label: 'Note interne', ouverture: '', cloture: '' },
    libre: { label: 'Texte', ouverture: '', cloture: '' },
  };

  /* ---------- Le moteur ----------

     Trois passes, dans cet ordre : on nettoie la matière, on la découpe
     en phrases, on la remet en forme. Inverser reviendrait à ponctuer un
     texte qu'on va ensuite redécouper. */
  function nettoyer(txt) {
    let t = txt.replace(/\s+/g, ' ').trim();

    /* Abréviations et accents, en respectant la casse du mot d'origine.

       Pas de `\b` autour du motif : en JavaScript, la limite de mot est
       calculée sur l'alphabet ASCII, si bien que « reparé » se coupait
       après « repar » et que la correction ne trouvait jamais sa clé. On
       capture donc simplement les suites de lettres. */
    t = t.replace(/[a-zàâçéèêëîïôûùüÿñ']+/gi, mot => {
      const bas = mot.toLowerCase();
      const dev = ABREVIATIONS[bas] || ACCENTS[bas];
      if (!dev) return mot;
      return mot[0] === mot[0].toUpperCase() ? dev[0].toUpperCase() + dev.slice(1) : dev;
    });

    /* Apostrophe élidée : « l appartement », « j ai », « qu il ». Une
       seule lettre suivie d'une voyelle ne peut pas être un mot en
       français — la règle est donc sûre, et c'est la faute de frappe la
       plus fréquente au clavier de téléphone. */
    t = t.replace(/\b([ldjmtscnLDJMTSCN])\s+(?=[aeiouyhàâéèêîïôûùAEIOUYHÀÂÉÈÊÎÏÔÛÙ])/g, "$1’");
    t = t.replace(/\b(qu|jusqu|lorsqu|puisqu|quoiqu)\s+(?=[aeiouyhàâéèêîïôûù])/gi, "$1’");

    // Ponctuation française : espace insécable avant les doubles signes,
    // pas d'espace avant les simples, un seul après.
    t = t.replace(/\s*([;:!?])/g, ' $1').replace(/\s*([,.])/g, '$1');
    t = t.replace(/([,.;:!?])(?=[^\s])/g, '$1 ');
    t = t.replace(/\s{2,}/g, ' ');
    return t.trim();
  }

  function phrases(txt) {
    // On coupe sur la ponctuation forte, et à défaut sur les connecteurs
    // qui servent de virgule à l'oral (« et », « mais », « donc »).
    const brut = txt.split(/(?<=[.!?])\s+/).filter(Boolean);
    return brut.flatMap(p => (p.length > 180 ? p.split(/,\s+(?=(?:et|mais|donc|car|puis)\b)/i) : [p]));
  }

  function capitaliser(p) {
    const t = p.trim();
    if (!t) return t;
    return t[0].toUpperCase() + t.slice(1);
  }

  function reformuler(texte, contexte = 'libre') {
    const c = CONTEXTES[contexte] || CONTEXTES.libre;
    const base = nettoyer(texte);
    if (!base) return '';

    const corps = phrases(base)
      .map(capitaliser)
      .map(p => (/[.!?…]$/.test(p) ? p : p + '.'))
      .join(' ');

    const morceaux = [];
    // On n'ajoute la formule d'ouverture que si l'auteur n'en a pas déjà
    // écrit une : « Bonjour Bonjour » est le premier signe qu'une machine
    // est passée par là.
    const commenceParSalutation = /^(bonjour|bonsoir|madame|monsieur|cher|chère|merci)/i.test(base);
    if (c.ouverture && !commenceParSalutation) morceaux.push(c.ouverture);
    morceaux.push(corps);
    const finitParFormule = /(bien à vous|cordialement|à bientôt|au plaisir)[\s.!]*$/i.test(base);
    if (c.cloture && !finitParFormule) morceaux.push(c.cloture);

    return morceaux.join('\n\n');
  }

  /* ---------- Le bouton ---------- */
  const ICONE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"/><circle cx="12" cy="12" r="3.4"/></svg>';
  const ICONE_RETOUR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M3.5 13a9 9 0 1 0 2.1-5.9L3 10"/></svg>';

  function attacher(champ) {
    if (!champ || champ.dataset.iaPret === '1') return;
    // Un champ en lecture seule n'a rien à reformuler.
    if (champ.readOnly || champ.disabled) return;
    champ.dataset.iaPret = '1';

    const enveloppe = document.createElement('div');
    enveloppe.className = 'ia-champ';
    champ.parentNode.insertBefore(enveloppe, champ);
    enveloppe.appendChild(champ);

    const bouton = document.createElement('button');
    bouton.type = 'button';
    bouton.className = 'ia-btn';
    bouton.innerHTML = ICONE;
    bouton.title = 'Reformuler avec Vivi';
    bouton.setAttribute('aria-label', 'Reformuler ce texte avec Vivi');
    enveloppe.appendChild(bouton);

    let avant = null;
    let minuteur = null;

    const remettreEnEtat = () => {
      clearTimeout(minuteur);
      avant = null;
      bouton.innerHTML = ICONE;
      bouton.classList.remove('is-retour');
      bouton.title = 'Reformuler avec Vivi';
      bouton.setAttribute('aria-label', 'Reformuler ce texte avec Vivi');
    };

    bouton.addEventListener('click', () => {
      // Deuxième clic : on rend le texte d'origine.
      if (avant !== null) {
        champ.value = avant;
        champ.dispatchEvent(new Event('input', { bubbles: true }));
        remettreEnEtat();
        toast('Texte d’origine rétabli');
        return;
      }

      const brut = champ.value.trim();
      if (!brut) { toast('Écrivez quelques mots, Vivi s’occupe du reste', false); champ.focus(); return; }

      const contexte = champ.dataset.ia || 'libre';
      bouton.classList.add('is-occupe');
      bouton.disabled = true;

      /* Le délai n'est pas décoratif : il tient lieu d'aller-retour
         réseau. Sans lui, le texte changerait dans la même image que le
         clic et l'on douterait qu'il se soit passé quelque chose. */
      setTimeout(() => {
        avant = champ.value;
        champ.value = reformuler(brut, contexte);
        champ.dispatchEvent(new Event('input', { bubbles: true }));
        bouton.classList.remove('is-occupe');
        bouton.disabled = false;
        bouton.innerHTML = ICONE_RETOUR;
        bouton.classList.add('is-retour');
        bouton.title = 'Rétablir le texte d’origine';
        bouton.setAttribute('aria-label', 'Rétablir le texte d’origine');
        toast('Texte reformulé — cliquez à nouveau pour revenir en arrière');
        // Passé un moment, l'annulation n'a plus de sens : on repart sur
        // une reformulation possible du nouveau texte.
        minuteur = setTimeout(remettreEnEtat, 20000);
      }, 480);
    });

    // Retaper dans le champ annule la possibilité de rétablir : le texte
    // d'origine n'est plus ce qu'on voulait retrouver.
    champ.addEventListener('input', () => { if (avant !== null && champ.value !== reformuler(avant, champ.dataset.ia || 'libre')) remettreEnEtat(); });
  }

  function toast(msg, ok = true) {
    if (typeof UI !== 'undefined' && UI.toast) return UI.toast(msg, ok);
  }

  /* ---------- Accrochage automatique ----------

     Beaucoup de zones de texte n'existent qu'après un clic (panneaux,
     modales, formulaires injectés). Un balayage unique au chargement en
     manquerait la moitié : on observe donc le document. */
  function balayer(racine = document) {
    racine.querySelectorAll('textarea:not([data-ia-off])').forEach(attacher);
  }

  function demarrer() {
    balayer();
    new MutationObserver(mutations => {
      mutations.forEach(m => m.addedNodes.forEach(n => {
        if (n.nodeType !== 1) return;
        if (n.matches && n.matches('textarea:not([data-ia-off])')) attacher(n);
        if (n.querySelectorAll) balayer(n);
      }));
    }).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer);
  else demarrer();

  return { attacher, reformuler, balayer };
})();
