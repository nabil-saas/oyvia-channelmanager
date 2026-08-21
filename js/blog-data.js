/* ============================================================
   OYVIA — Contenu éditorial (blog public + back-office)

   Ce fichier est partagé par les deux bouts de la chaîne : la page
   publique blog.html le lit pour afficher les articles, le back-office
   l'écrit depuis admin/blog.html. Un seul jeu de données, donc aucune
   possibilité qu'un article publié dans l'un n'existe pas dans l'autre.

   Trois choix méritent explication :

   1. Deux statuts stockés, trois affichés. Un article est « brouillon »
      ou « publié » ; s'il est publié avec une date à venir, l'interface
      le montre comme « programmé ». Stocker un troisième statut aurait
      obligé à le faire basculer soi-même le jour J — et un article
      programmé oublié serait resté programmé pour toujours.

   2. Le temps de lecture se calcule, il ne se saisit pas. Un champ
      « 6 min » recopié à la main survit rarement à la troisième
      réécriture du texte.

   3. Le contenu est du texte, pas du HTML. On accepte une syntaxe
      minimale (## titre, - liste, ligne vide = paragraphe) : de quoi
      structurer un article sans ouvrir la porte à du balisage collé
      depuis un traitement de texte, qui casserait la mise en page.
   ============================================================ */

const BLOG_CATEGORIES = [
  { id:'reglementation', label:'Réglementation', desc:"Obligations légales, fiches de police, déclarations." },
  { id:'organisation',   label:'Organisation',   desc:"Équipes, plannings, ménage, logistique." },
  { id:'productivite',   label:'Productivité',   desc:"Automatisations, gains de temps, méthodes." },
  { id:'voyageurs',      label:'Voyageurs',      desc:"Communication, expérience de séjour, avis." },
  { id:'outils',         label:'Outils',         desc:"Channel manager, serrures, comparatifs." },
];
function getCategorieBlog(id) { return BLOG_CATEGORIES.find(c => c.id === id) || BLOG_CATEGORIES[0]; }
function labelCategorieBlog(id) { return getCategorieBlog(id).label; }

const ARTICLE_STATUTS = {
  brouillon: { label:'Brouillon', badge:'badge--neutral' },
  programme: { label:'Programmé', badge:'badge--accent'  },
  publie:    { label:'Publié',    badge:'badge--positive' },
};

/* Le statut réel se déduit de la date : « publié » avec une date à venir
   veut dire « programmé ». Toute la lecture passe par ici, jamais par
   a.statut brut, sinon un article de la semaine prochaine apparaîtrait
   dès aujourd'hui sur le site. */
function statutArticleReel(a) {
  if (!a || a.statut !== 'publie') return 'brouillon';
  return a.datePublication > AUJOURDHUI ? 'programme' : 'publie';
}
function articleEnLigne(a) { return statutArticleReel(a) === 'publie'; }

const ARTICLES = [
  {
    id:'A01', slug:'loi-80-14-fiche-de-police-hebergeur',
    titre:"Loi 80-14 : ce que tout hébergeur touristique doit savoir sur la fiche de police",
    categorie:'reglementation', auteurId:'M1', datePublication:'2026-06-12',
    statut:'publie', aLaUne:true,
    image:{ url:'assets/blog/reglementation.svg', legende:"La fiche de police se collecte avant l'arrivée, pas sur le pas de la porte." },
    medias:[],
    chapo:"Qui doit la remplir, quelles informations sont obligatoires, et comment l'automatiser pour ne plus jamais y penser.",
    metaDescription:"Fiche de police en location courte durée : obligations, mentions requises, délais et automatisation.",
    contenu:
`La fiche de police n'est pas une formalité d'hôtel. Tout hébergement touristique qui accueille un voyageur étranger doit consigner son identité et tenir ces informations à disposition des autorités. L'obligation pèse sur l'hébergeur, pas sur le voyageur : c'est vous qui répondez d'une fiche manquante, pas le client qui n'a pas voulu la remplir. Cette distinction est importante parce qu'elle déplace la responsabilité et, avec elle, la méthode à adopter pour s'en assurer.

## À qui s'applique l'obligation

Le périmètre varie selon la réglementation locale. Au Maroc, la loi 80-14 relative à l'hébergement touristique impose la déclaration de tout voyageur étranger, qu'il séjourne dans un hôtel classé, une maison d'hôtes ou un appartement loué entre particuliers. En France, une obligation similaire existe pour les hébergements accueillant des ressortissants étrangers non membres de l'Union européenne. Vérifiez la règle applicable dans votre commune ou votre pays : des exemptions ou des seuils différents peuvent exister, et le texte évolue.

## Ce que la fiche doit contenir

Six mentions reviennent systématiquement lors d'un contrôle : identité complète du voyageur, date et lieu de naissance, nationalité, domicile habituel, nature et numéro de la pièce d'identité, dates d'arrivée et de départ prévues. Une fiche à laquelle il manque le numéro de document est une fiche incomplète, même si tout le reste y figure. Les agents de contrôle ne font pas de distinction entre une fiche absente et une fiche partielle : dans les deux cas, l'hébergeur est en défaut.

![Le formulaire part avec le message d'avant-arrivée, 48 h avant le séjour.](assets/blog/voyageurs.svg)

## Le vrai sujet, c'est le moment de la collecte

Demander ces informations au moment de l'arrivée, c'est accueillir quelqu'un avec un formulaire. Le voyageur est fatigué, pressé d'entrer dans le logement, et si l'arrivée est tardive, la conversation se termine souvent par « je vous enverrai ça demain ». Ce demain n'arrive pas toujours. La bonne fenêtre se situe 48 heures avant le séjour : le voyageur prépare son départ, ses documents sont sous la main, et il est encore dans une logique administrative.

- Envoyez le lien de collecte avec le message d'avant-arrivée, 48 h avant le séjour.
- Faites télécharger la copie de la pièce d'identité au même moment, tant que le voyageur a son document sous la main.
- Prévoyez une relance automatique 24 h avant l'arrivée pour les fiches encore incomplètes, uniquement pour celles-là.
- Ne relancez pas une fiche déjà remplie : cela crée de la confusion et déclenche des messages d'inquiétude inutiles.

## La formulation qui obtient le plus de réponses

Le taux de complétion dépend largement du contexte donné. « Merci de remplir ce formulaire obligatoire » obtient des résultats médiocres. « La réglementation locale nous oblige à déclarer les voyageurs étrangers avant leur arrivée ; le formulaire prend moins de deux minutes et vous évite toute démarche à votre arrivée » est nettement plus efficace. Une explication honnête fait mieux qu'une injonction, même polie.

## Conservation et accessibilité

Les fiches doivent être conservées pendant une durée minimale fixée par la réglementation applicable, généralement plusieurs mois. Un classeur papier fait l'affaire tant que vous gérez deux ou trois logements et que les contrôles sont rares. Au-delà, la question n'est plus le stockage mais la recherche : retrouver la fiche d'un séjour précis parmi plusieurs centaines d'enregistrements, rapidement, le jour où un agent vous le demande. Un stockage numérique avec un champ de recherche par nom ou par date de séjour résout ce problème sans effort.

## Ce que change l'automatisation

Quand la collecte est automatisée, le taux de fiches complètes avant l'arrivée dépasse régulièrement 85 % sur les conciergeries qui ont mis en place une relance ciblée. Le gain n'est pas seulement réglementaire : une fiche complète au moment du check-in signifie un accueil plus fluide, aucune négociation à l'arrivée, et un dossier prêt si une réclamation survient après le séjour. Les outils de gestion qui intègrent la collecte de documents dans le flux de messagerie permettent de traiter ce point sans y consacrer de temps supplémentaire.

## Ce qu'il faut vérifier

Avant tout déploiement, confirmez avec votre mairie ou votre administration locale : quels séjours sont concernés (durée minimale, nationalité), quelle durée de conservation est requise, et si un registre doit être tenu dans un format précis. Ces détails varient et aucune source générale ne se substitue à la règle qui s'applique à votre adresse.`,
  },
  {
    id:'A02', slug:'eviter-doubles-reservations-multi-canaux',
    titre:"Comment éviter les doubles réservations quand on gère plusieurs canaux",
    categorie:'organisation', auteurId:'M2', datePublication:'2026-05-28',
    statut:'publie', aLaUne:false,
    image:{ url:'assets/blog/outils.svg', legende:'Un calendrier de référence, tous les autres en découlent.' },
    medias:[],
    chapo:"Airbnb, Booking.com, réservations directes : la synchronisation manuelle atteint vite ses limites. Voici comment s'en sortir.",
    metaDescription:"Doubles réservations : pourquoi elles arrivent, ce que change un calendrier unifié, quand l'iCal suffit encore.",
    contenu:
`Une double réservation ne se produit presque jamais sur un seul canal. Elle naît de l'écart entre deux calendriers : le temps que la disponibilité soit fermée sur Booking, quelqu'un a réservé sur Airbnb. Cet écart peut se compter en minutes, mais c'est assez. La question n'est donc pas « est-ce que je fais confiance aux plateformes » mais « à quelle vitesse mes calendriers se parlent ».

## Pourquoi l'iCal ne suffit pas toujours

La synchronisation par iCal fonctionne, mais elle interroge les plateformes à intervalle régulier — souvent toutes les heures, parfois toutes les quatre heures selon les réglages de la plateforme émettrice. Une heure, c'est peu à l'échelle d'une semaine, et beaucoup un vendredi soir de haute saison sur un logement très demandé. Le problème s'aggrave avec le nombre de canaux : chaque flux iCal que vous ajoutez multiplie le nombre d'écarts possibles, et un logement exposé sur quatre canaux a six paires de calendriers à maintenir cohérentes.

## Le canal qui ne se ferme jamais tout seul

Les plateformes ferment automatiquement les dates quand elles reçoivent une réservation. Les réservations directes ne font pas ça. Quand un client vous contacte par téléphone ou par votre site et que vous confirmez verbalement, vos calendriers Airbnb et Booking restent ouverts jusqu'à ce que vous les bloquiez manuellement. Ce délai, même de quinze minutes, est celui où une double réservation se crée. La règle à appliquer sans exception : bloquer avant de confirmer, pas après.

## Trois réflexes qui règlent l'essentiel

- Choisissez un calendrier de référence unique, celui que vous regardez le matin. Tous les autres en découlent ; s'il y a un conflit, ce calendrier a raison.
- Bloquez immédiatement toute réservation directe dès qu'elle est acceptée, avant même d'envoyer la confirmation au client.
- Gardez une marge de nettoyage entre deux séjours : elle absorbe les écarts de synchronisation en plus de vous laisser le temps de préparer le logement. Une marge de deux heures élimine la quasi-totalité des conflits résiduels.

## Ce que coûte vraiment une double réservation

Le coût direct est celui du relogement : trouver en urgence un hébergement équivalent, en payer la différence, parfois rembourser le voyageur lésé avec une pénalité. Le coût indirect est celui de l'avis négatif qui suit, et de la dégradation du classement sur la plateforme. Certaines plateformes peuvent suspendre une annonce après plusieurs incidents. Rapporté à une seule nuit, le coût d'un calendrier unifié devient dérisoire.

## Quand passer à un calendrier unifié

Au-delà de trois logements ou de deux canaux actifs, le suivi manuel devient un travail à part entière. Le basculement se sent moins au nombre de biens qu'au nombre de fois où vous avez vérifié un calendrier « juste pour être sûr ». Cette vigilance permanente est un signal : elle indique que le système en place mobilise de l'attention sans la remplacer. Un calendrier centralisé qui reçoit toutes les réservations et ferme simultanément tous les canaux ramène ce point de contrôle à un seul endroit.

## La gestion d'une double réservation déjà constituée

Si elle se produit malgré tout, agissez dans les premières heures. Contactez le voyageur le plus récemment réservé en priorité : il a moins d'engagement et sera plus facile à déplacer vers une date alternative ou vers un remboursement. Gardez une trace écrite de toutes les communications. Informez la plateforme immédiatement : certaines ont des procédures de résolution qui réduisent les pénalités si vous les déclenchez avant l'arrivée prévue. Ce qui transforme une erreur en crise, c'est presque toujours le silence. Un hébergeur qui prend les devants, propose des solutions concrètes et communique clairement limite presque toujours les dégâts, en termes d'avis comme de pénalités financières.`,
  },
  {
    id:'A03', slug:'cinq-automatisations-conciergerie',
    titre:"5 automatisations qui font gagner des heures aux conciergeries",
    categorie:'productivite', auteurId:'M2', datePublication:'2026-05-14',
    statut:'publie', aLaUne:false,
    chapo:"Du message de bienvenue au rappel de départ, les scénarios à mettre en place dès votre première semaine.",
    metaDescription:"Cinq automatisations concrètes pour une conciergerie : messages, ménage, avis, fiches de police, relances.",
    contenu:
`Une automatisation utile remplace une tâche que vous faites déjà, à l'identique, plusieurs fois par semaine. Les autres ajoutent surtout de la configuration à maintenir sans apporter de gain mesurable. Le premier critère pour évaluer un scénario est donc simple : est-ce que je fais ça manuellement aujourd'hui ? Si la réponse est non, l'automatiser ne libérera aucun temps.

## 1. La confirmation de réservation

Envoyée dans la minute qui suit la réservation, elle remplit deux fonctions. Elle rassure le voyageur qui vient de payer et qui attend un signe de vie. Elle pose aussi le cadre du séjour : check-in prévu, documents à fournir, contact pour les questions. Une conciergerie qui répond dans la minute est perçue comme fiable bien avant que le voyageur ait mis les pieds dans le logement. Ce premier message est aussi le bon endroit pour inclure le lien de collecte de la fiche de police, sans attendre le message d'arrivée.

## 2. Les instructions d'arrivée

Programmées 48 heures avant le séjour, avec l'adresse précise, le code d'accès et le plan pour trouver la place de parking si elle existe. C'est le message le plus lu de tout le séjour, souvent relu plusieurs fois le jour du départ du voyageur. Sa longueur idéale : assez court pour être lu d'un coup d'oeil dans un train, assez complet pour ne pas déclencher de question. Tout ce qui n'est pas indispensable pour entrer dans le logement peut aller dans un guide de séjour séparé, consultable ensuite.

## 3. La tâche de ménage

Créée automatiquement à la date de départ du voyageur et assignée à la personne qui couvre le secteur géographique. Le gain n'est pas dans la création de la tâche elle-même — ça prend trente secondes à la main — il est dans le fait de ne plus y penser : même les semaines chargées avec cinq rotations le même samedi, chaque départ déclenche son intervention sans intervention humaine. L'assignation par secteur plutôt que par logement réduit les oublis lors des remplacements : si la personne habituelle est absente, la tâche reste visible pour quelqu'un qui connaît la zone.

## 4. La demande d'avis

Envoyée le lendemain du départ, quand le souvenir du séjour est encore frais et que le voyageur est de retour chez lui. Passé trois jours, le taux de réponse chute significativement. Passé une semaine, il est marginal. Le message doit être court : une phrase de remerciement, un lien direct vers le formulaire d'avis, rien d'autre. Un message trop long qui explique pourquoi les avis sont importants donne l'impression qu'on négocie une faveur plutôt qu'on en sollicite une.

## 5. La relance de fiche de police

Vingt-quatre heures avant l'arrivée, envoyée uniquement aux voyageurs dont la fiche est encore incomplète. C'est l'automatisation la moins visible et souvent la plus rentable sur le plan réglementaire : elle porte le taux de fiches complètes à l'arrivée de 60-70 % à plus de 85 % sur les conciergeries qui la déploient. Elle élimine aussi les échanges embarrassants au moment du check-in avec un voyageur qui n'a pas ses documents sous la main. Envoyez-la uniquement aux fiches incomplètes : une relance sur une fiche déjà remplie génère de la confusion et un message d'inquiétude à traiter.

## Ce qui peut attendre

Les automatisations de rappel de départ (heure de check-out), de proposition d'extension de séjour, ou d'upselling (service de ménage supplémentaire, coffre à bagages) existent et peuvent être utiles. Mais elles demandent un paramétrage plus fin et une surveillance plus régulière — un message de rappel envoyé à un voyageur déjà parti se retourne contre vous. Commencez par les cinq scénarios ci-dessus, laissez-les tourner un mois complet, ajustez les formulations si nécessaire, puis envisagez d'aller plus loin.

## Ce qu'il faut retenir

Le volume de temps récupéré dépend directement du volume de séjours traités. Sur dix réservations par mois, l'automatisation économise peut-être deux heures. Sur cinquante, elle évite une embauche. Le seuil de rentabilité d'une configuration bien faite se situe autour de vingt séjours mensuels sur un seul logement, ou dès le deuxième logement si vous gérez plusieurs propriétés.`,
  },
  {
    id:'A04', slug:'message-arrivee-voyageurs',
    titre:"Comment rédiger un message d'arrivée que vos voyageurs liront vraiment",
    categorie:'voyageurs', auteurId:'M4', datePublication:'2026-05-06',
    statut:'publie', aLaUne:false,
    image:{ url:'assets/blog/voyageurs.svg', legende:"L'essentiel dans les trois premières lignes." },
    medias:[],
    chapo:"Code d'accès, wifi, recommandations : la structure qui réduit les questions répétitives sans paraître froide.",
    metaDescription:"Message d'arrivée en location courte durée : structure, longueur et informations à mettre en avant.",
    contenu:
`Un message d'arrivée trop long n'est pas lu ; un message trop court génère cinq questions. L'équilibre tient moins à la longueur qu'à l'ordre des informations. La règle de base : tout ce dont le voyageur a besoin pour entrer dans le logement sans vous appeler doit apparaître en premier. Tout le reste peut attendre.

## Mettez l'essentiel dans les trois premières lignes

Adresse complète, code d'accès ou numéro de boîte à clés, heure à partir de laquelle l'entrée est possible. Ce sont les trois informations qu'un voyageur cherche dans le train, sur un téléphone, avec 8 % de batterie. Si ces éléments sont noyés après deux paragraphes de bienvenue, le voyageur vous appellera malgré tout — et vous devrez lui relire ce que vous aviez déjà écrit.

## Séparez accès et séjour

Le message d'arrivée répond à une question : comment est-ce que j'entre ? Tout ce qui concerne le séjour lui-même — wifi, poubelles, climatisation, recommandations de restaurants — répond à des questions qui n'existent qu'une fois le voyageur installé. Mettre ces deux niveaux dans le même message allonge inutilement le premier et dilue l'information critique. Un guide de séjour séparé, envoyé le jour de l'arrivée ou accessible depuis un lien permanent, permet au voyageur de consulter ces informations quand il en a besoin, pas avant.

## La longueur idéale

Un message qui tient en dix à quinze lignes lisibles sur mobile. En dessous, l'accueil semble expédié. Au-dessus, il ne sera pas lu en entier. Si vous avez besoin de plus de place pour couvrir tout ce que vous voulez dire, c'est le signal qu'une partie du contenu appartient au guide de séjour, pas au message d'arrivée.

## Un ton, pas un règlement

« Merci de ne pas faire la fête », « il est interdit de fumer », « les animaux ne sont pas acceptés » : répété six fois, ce registre transforme un accueil en liste d'interdictions. Les voyageurs qui ne liront pas ces lignes sont exactement ceux qui ne respecteraient pas les règles de toute façon ; ceux qui les lisent méritent un accueil qui suppose bonne foi. Les mêmes règles passent mieux formulées à l'endroit : « le logement est non-fumeur » plutôt que « il est interdit de fumer ». Ce n'est pas de l'indulgence, c'est une différence de registre qui change la façon dont le message est reçu.

## Ce que vous pouvez personnaliser sans effort

Le prénom du voyageur, le nom du logement, et une phrase contextualisée au séjour (« vous arrivez pendant la saison des marchés de Noël, voici celui qui est à cinq minutes à pied ») font la différence entre un message automatique et un message attentionné. Ces trois éléments suffisent à personnaliser un message standardisé sans le réécrire à chaque fois.

## La gestion des questions après envoi

Un message bien structuré réduit les questions, mais ne les supprime pas. Repérez les questions qui reviennent deux fois par mois ou plus : ce sont des lacunes dans votre message, pas des voyageurs peu attentifs. Chaque question récurrente est une ligne à ajouter ou à reformuler. Après quelques cycles de correction, le nombre d'échanges par séjour descend en dessous de deux pour la grande majorité des voyageurs.

## Ce qu'il faut retenir

Le test le plus simple : lisez votre message à voix haute en imaginant que vous avez deux valises et que vous cherchez votre logement pour la première fois. Si vous trouvez ce dont vous avez besoin dans les dix premières secondes, le message est bien construit. Sinon, déplacez ce qui manque en tête. Ce test peut aussi être fait par quelqu'un qui ne connaît pas le logement : une lecture extérieure repère des lacunes que vous ne voyez plus, parce que vous connaissez trop bien l'endroit pour imaginer qu'on puisse ne pas savoir où se trouve l'entrée.`,
  },
  {
    id:'A05', slug:'faut-il-un-channel-manager',
    titre:"Airbnb, Booking.com, direct : faut-il vraiment un channel manager ?",
    categorie:'outils', auteurId:'M5', datePublication:'2026-04-27',
    statut:'publie', aLaUne:false,
    chapo:"Ce qu'un calendrier unifié change concrètement au quotidien, et dans quels cas une simple synchro iCal suffit encore.",
    metaDescription:"Channel manager ou iCal : comparatif honnête selon le nombre de logements et de canaux.",
    contenu:
`La question se pose rarement au bon moment : on cherche un channel manager après une double réservation, alors que l'intérêt principal est ailleurs. Une double réservation peut arriver avec ou sans channel manager — ce qui change, c'est la fréquence et la façon de la prévenir. Comprendre ce que l'outil apporte réellement permet de décider quand le moment est bon, sans attendre l'incident.

## Ce qu'apporte réellement un calendrier unifié

- Une seule saisie de tarif ou de disponibilité, répercutée simultanément sur tous les canaux connectés, en quelques secondes plutôt qu'en plusieurs minutes de navigation.
- Un seul endroit où voir qui arrive demain, qui repart ce soir, et ce qui est libre la semaine prochaine, tous canaux confondus.
- Des messages centralisés : répondre à un voyageur Booking depuis la même interface qu'un voyageur Airbnb, sans changer d'application ni de contexte.
- Un historique complet par logement, accessible sans fouiller dans trois boîtes mail différentes.

## Quand l'iCal reste suffisant

Un seul logement, un ou deux canaux actifs, très peu de réservations directes : la synchronisation gratuite par iCal fait le travail dans la quasi-totalité des cas. Elle a un délai de mise à jour — souvent de vingt minutes à une heure selon la plateforme — mais sur un seul bien, ce délai est rarement problématique. Ajouter un outil de gestion à ce stade, c'est ajouter une configuration à maintenir, des abonnements à payer, et une courbe d'apprentissage pour un problème que vous n'avez pas encore.

## Ce que l'iCal ne résout pas

La synchronisation par iCal ne centralise pas la messagerie, ne crée pas de tâches de ménage, et ne vous permet pas d'ajuster les tarifs partout depuis un seul endroit. Ce sont des fonctions différentes, qui justifient un outil centralisé indépendamment du risque de double réservation. Si vous passez plus de trente minutes par jour à basculer d'une application à l'autre, la question n'est pas « est-ce que j'ai des doubles réservations » mais « est-ce que je perds du temps que je pourrais éviter de perdre ».

## Le vrai seuil

Il n'est pas dans le nombre de biens mais dans le produit du nombre de canaux par le nombre de biens. Trois logements sur trois canaux, ce sont neuf calendriers à tenir cohérents, dix-huit si vous comptez les allers-retours. Personne ne le fait à la main très longtemps sans erreur. En pratique, le seuil où un channel manager devient rentable se situe autour de deux logements sur trois canaux, ou de cinq logements même sur un seul canal si les réservations directes sont nombreuses.

## Les frais à anticiper

La plupart des outils de gestion facturent un abonnement mensuel par logement, entre quelques euros et plusieurs dizaines d'euros selon les fonctionnalités. Certains prennent une commission sur les réservations directes. Le modèle à éviter : les outils qui facturent à la fois un abonnement élevé et une commission sur les revenus. La comparaison doit toujours se faire sur le coût total annuel, pas sur le tarif d'affichage mensuel.

## Ce qu'il faut retenir

La décision de passer à un calendrier centralisé n'est pas irréversible, mais elle demande du temps de mise en place : connexion des canaux, import des calendriers existants, formation des équipes si vous n'êtes pas seul. Prévoyez cette migration hors saison, sur une période creuse, avec suffisamment de temps pour vérifier que les synchronisations fonctionnent avant la période chargée suivante. Le seul mauvais moment pour migrer est au milieu d'une saison forte : une erreur de configuration sur un calendrier pendant une période de forte demande coûte bien plus que l'abonnement annuel à l'outil.`,
  },
  {
    id:'A06', slug:'meuble-tourisme-changements-2026',
    titre:"Location meublée de tourisme : les changements à surveiller cette année",
    categorie:'reglementation', auteurId:'M1', datePublication:'2026-04-15',
    statut:'publie', aLaUne:false,
    chapo:"Numéro d'enregistrement, quotas municipaux, diagnostic de performance énergétique : le point sur les obligations en cours d'évolution.",
    metaDescription:"Meublés de tourisme : enregistrement, quotas, DPE — ce qui change et ce qu'il faut vérifier.",
    contenu:
`Les règles applicables aux meublés de tourisme se décident de moins en moins au niveau national, et de plus en plus à l'échelle de la commune. C'est ce qui rend le sujet difficile à suivre : deux villes voisines n'appliquent pas la même chose, et les règles changent d'une année à l'autre sans que les plateformes vous en informent nécessairement. La veille réglementaire est donc une tâche à part entière, distincte de la gestion courante.

## Le numéro d'enregistrement

Dans de nombreuses communes touristiques, tout hébergement proposé à la location courte durée doit être enregistré auprès de la mairie et disposer d'un numéro d'enregistrement. Ce numéro doit figurer sur chaque annonce, quelle que soit la plateforme. Les plateformes sont de plus en plus proactives pour retirer les annonces sans numéro ou avec un numéro invalide, parfois sans préavis. La procédure d'enregistrement varie : certaines communes proposent une démarche en ligne en quelques minutes, d'autres exigent un dossier papier avec des délais plus longs. Anticipez.

## Les quotas et durées maximales

Plusieurs grandes villes et communes touristiques plafonnent le nombre de nuitées annuelles autorisées pour les résidences principales. Le seuil varie selon les endroits et la qualification du logement. Le décompte se fait sur l'année civile et se cumule entre plateformes : vous ne pouvez pas raisonner canal par canal. Aucune plateforme ne vous préviendra lorsque vous approchez du plafond, et aucune ne comptabilise ce que vous avez loué via les autres. La gestion de ce compteur est entièrement à votre charge.

## La déclaration et la taxe de séjour

Dans la quasi-totalité des communes où la location courte durée est développée, une taxe de séjour est due par nuitée et par voyageur. Certaines plateformes la collectent et la reversent directement à la commune ; d'autres vous laissent le faire. Vérifiez, pour chaque canal sur lequel vous êtes présent, si la collecte est automatisée ou si elle vous incombe. Une erreur sur ce point peut entraîner un rappel de plusieurs années de taxes non versées, avec des majorations.

## Le diagnostic de performance énergétique

L'exigence progresse par paliers dans plusieurs pays. Le sujet n'est plus « faut-il un DPE » mais « quelle classe minimale sera exigée, et à quel horizon ». Les logements énergivores font face à une perspective de travaux ou d'interdiction de mise en location — un calendrier qui se planifie sur plusieurs saisons, pas en quelques semaines. Si votre logement est classé dans les catégories les moins performantes, c'est un risque opérationnel à évaluer maintenant, même si les délais semblent lointains.

## Les restrictions dans les copropriétés

Certains règlements de copropriété interdisent ou limitent la location touristique, indépendamment de ce que la mairie autorise. La vérification du règlement de copropriété précède toute mise en location : une autorisation municipale ne prime pas sur un règlement intérieur, et une assemblée générale peut voter une restriction à tout moment.

## Ce qu'il faut retenir

Vérifiez chaque année auprès de votre mairie ou administration locale : c'est la seule source qui tranche pour votre adresse. Les sites de référence nationaux donnent un cadre général, mais les exceptions locales sont nombreuses et peuvent changer en dehors des cycles législatifs habituels. Une bonne pratique : consacrez une heure par an, en début d'année, à contacter la mairie, à vérifier votre annonce sur chaque plateforme, et à confirmer que vos obligations de déclaration sont à jour. Si vous gérez des logements dans plusieurs communes ou plusieurs pays, cette vérification annuelle se multiplie : les règles ne se transposent pas d'un territoire à l'autre, et ce qui est autorisé ici peut être soumis à autorisation préalable ailleurs.`,
  },
  {
    id:'A07', slug:'structurer-equipe-au-dela-de-dix-logements',
    titre:"Ménage, linge, clés : structurer une équipe au-delà de 10 logements",
    categorie:'organisation', auteurId:'M2', datePublication:'2026-04-02',
    statut:'publie', aLaUne:false,
    image:{ url:'assets/blog/organisation.svg', legende:'Découper par secteur plutôt que par logement.' },
    medias:[],
    chapo:"À partir de quel volume il devient nécessaire de formaliser les plannings, et comment répartir les tâches sans surcharger personne.",
    metaDescription:"Organiser une équipe de conciergerie : plannings, répartition, check-lists, gestion du linge et des clés.",
    contenu:
`En dessous de dix logements, l'organisation tient dans une tête et un groupe de discussion. Les tâches sont mémorisées, les exceptions gérées à la volée, et un oubli occasionnel reste rattrapable. Au-dessus de dix, chaque absence devient un incident potentiel : la personne qui savait que l'appartement du troisième a une serrure capricieuse n'est plus là, et personne d'autre ne le sait. C'est à ce stade que l'organisation informelle commence à coûter plus cher qu'une formalisation rigoureuse.

## Formalisez d'abord ce qui se répète

Le ménage de départ, la vérification du linge, le relevé des compteurs, la mise en route du chauffe-eau en hiver : ce sont des tâches identiques d'un séjour à l'autre. Une check-list partagée accessible sur téléphone vaut mieux que dix explications orales. Elle n'élimine pas les oublis, mais elle les déplace : c'est la case non cochée qui déclenche l'alerte, pas le voyageur qui arrive dans un logement mal préparé. La check-list doit être construite par la personne qui fait le ménage, pas par celle qui ne le fait pas — c'est elle qui connaît les étapes dans l'ordre réel.

## Répartissez par secteur, pas par logement

Assigner les biens un par un crée des trajets absurdes : une personne peut se retrouver à couvrir deux logements distants de quarante minutes et en rater un troisième, mieux placé, qui était la journée d'une autre. Le découpage géographique réduit les déplacements, améliore la connaissance des spécificités de chaque bien dans le secteur, et rend les remplacements plus simples. Quelqu'un qui connaît le secteur peut reprendre trois logements sans briefing approfondi. Quelqu'un qui reprend un logement qu'il n'a jamais vu, situé à l'autre bout de la ville, commence à zéro.

## Le linge est le vrai goulot d'étranglement

C'est presque toujours le linge qui bloque un enchaînement serré, pas le ménage. Un appartement peut être nettoyé en deux heures ; si les draps propres ne sont pas disponibles, l'appartement ne peut pas être préparé. Prévoyez un jeu d'avance par lit, pas par logement : un studio avec un lit double a besoin de deux jeux en stock, pas d'un. La différence se voit clairement le premier samedi de forte rotation, quand cinq logements partent et cinq arrivent dans la même journée. Sans stock suffisant, la blanchisserie devient un facteur bloquant que vous ne contrôlez plus.

## La gestion des clés et des accès

C'est un point sensible qui grandit avec le portefeuille. Deux logements, c'est gérable à la main. Vingt logements avec des équipes qui tournent, des prestataires ponctuels et des voyageurs qui ont parfois besoin d'un double, c'est un risque permanent de clé égarée ou de code trop partagé. Les serrures à code changeable permettent de renouveler l'accès entre chaque séjour sans déplacement. Pour les logements qui restent à serrure mécanique, un système de boîte à clés numérotée avec un registre d'entrées et de sorties est le minimum.

## La montée en charge des remplacements

L'indicateur le plus fiable d'une organisation fragile est le temps qu'il faut pour gérer une absence imprévue. Si remplacer une personne prend plus de deux heures et plusieurs appels, l'organisation dépend trop des individus. La robustesse vient de la documentation : chaque logement doit avoir une fiche accessible à tout nouveau prestataire, avec l'accès, les spécificités techniques, et les contacts utiles. Cette fiche ne se rédige pas quand l'urgence arrive ; elle existe avant.

## Ce qu'il faut retenir

Le passage de dix à vingt logements ne demande pas seulement plus de personnes ; il demande une organisation différente. Les outils qui centralisent les tâches, les accès et les communications entre l'équipe permettent de passer ce cap sans doubler le temps de coordination. Mais aucun outil ne remplace une répartition géographique claire et des procédures écrites que quelqu'un qui arrive le lundi matin peut suivre sans avoir été briefé le vendredi.`,
  },
  {
    id:'A08', slug:'reservations-directes-sans-perdre-airbnb',
    titre:"Réservations directes : reprendre la main sans perdre ses avis Airbnb",
    categorie:'productivite', auteurId:'M4', datePublication:'2026-03-20',
    statut:'publie', aLaUne:false,
    chapo:"Une stratégie progressive pour proposer un moteur de réservation directe tout en gardant la visibilité de vos annonces existantes.",
    metaDescription:"Développer les réservations directes progressivement, sans sacrifier la visibilité des plateformes.",
    contenu:
`Opposer direct et plateformes est un faux débat : les plateformes apportent des voyageurs que vous n'auriez pas eus autrement, le direct améliore la marge sur ceux qui reviennent. La bonne question n'est pas « lequel choisir » mais « comment faire coexister les deux sans créer de conflits ». Une stratégie directe qui sabote la visibilité existante coûte plus qu'elle ne rapporte, au moins à court terme.

## Ce que « réservation directe » veut dire en pratique

Une réservation directe, ce n'est pas nécessairement un site internet avec un moteur de réservation intégré. C'est toute réservation qui bypasse une plateforme : un email, un message WhatsApp, un formulaire simple. La commission économisée est réelle dans tous ces cas. Ce qui change avec un vrai moteur de réservation, c'est la capacité à traiter ce volume sans intervention manuelle, et à accepter le paiement à distance sans intermédiaire. La graduation de la démarche dépend du volume et du profil des voyageurs qui reviennent.

## Commencez par les voyageurs déjà venus

Ce sont les seuls que vous pouvez recontacter sans aucun démarchage : ils vous connaissent, ont séjourné dans votre logement, et ont choisi de revenir s'ils en avaient l'occasion. Un message après le séjour, une offre simple et transparente pour la fois suivante (« réservez directement et je vous évite les frais de service de la plateforme »), et le canal direct se construit progressivement. Sur certains logements à forte fidélisation — résidences familiales prisées, emplacements rares — ce seul levier peut représenter 20 à 30 % des réservations annuelles au bout de deux saisons.

## Ne cassez pas ce qui fonctionne

Retirer une annonce performante pour « forcer » le direct est une erreur fréquente. Le référencement sur les plateformes se construit sur des mois — volume de réservations, avis, taux de réponse, ancienneté — et se perd bien plus vite. Un logement qui sort des premières pages de résultats met souvent plusieurs saisons à les retrouver. La bonne approche : faites cohabiter les deux canaux jusqu'à ce que le direct atteigne une part qui justifie une décision différente. Cette décision n'est pas binaire ; vous pouvez maintenir les plateformes en réduisant les disponibilités qu'elles voient, sans les quitter.

## Ce qu'il faut avoir avant de promouvoir le direct

- Une page ou un formulaire de réservation qui accepte le paiement à distance, avec un récapitulatif clair du séjour.
- Des conditions d'annulation écrites, accessibles avant la réservation, qui définissent exactement ce qui est remboursé et dans quel délai.
- Un calendrier connecté aux autres canaux : la première réservation directe sur un calendrier non synchronisé crée inévitablement un conflit.
- Un accusé de réception automatique : un voyageur qui réserve directement et n'obtient pas de confirmation dans l'heure peut annuler et repartir vers une plateforme.

## Les erreurs à éviter

Proposer un tarif identique au tarif plateforme en direct, sans avantage explicite, n'incite personne à changer ses habitudes. L'avantage doit être visible : prix inférieur, conditions d'annulation plus souples, service personnalisé. L'autre erreur classique est de promouvoir le direct sur la page publique d'une plateforme — certaines sanctionnent cette pratique par une baisse de visibilité ou une suspension.

## Ce qu'il faut retenir

Le direct n'est pas une alternative aux plateformes, c'est un complément. Il prend du temps à construire et demande une infrastructure minimale pour fonctionner sans friction. Commencez petit : un email aux anciens voyageurs, un lien de paiement simple, et une offre claire. Ajoutez de la sophistication uniquement quand le volume le justifie. Un indicateur utile pour évaluer la maturité du canal direct : le ratio entre le nombre de réservations directes et le nombre d'anciens voyageurs contactés. S'il dépasse 15 %, le canal est actif et mérite d'être développé. En dessous de 5 %, l'offre ou la formulation demande à être revue avant d'investir dans de l'outillage plus sophistiqué.`,
  },
  {
    id:'A09', slug:'fiche-police-automatisee-arrivee',
    titre:"Fiche de police automatisée : fluidifier l'arrivée sans perdre de temps",
    categorie:'voyageurs', auteurId:'M4', datePublication:'2026-03-08',
    statut:'publie', aLaUne:false,
    chapo:"Comment collecter les informations obligatoires avant le check-in, sans que ça ressemble à une formalité administrative pour le voyageur.",
    metaDescription:"Collecter la fiche de police avant l'arrivée : formulation, moment d'envoi, relance et pièce d'identité.",
    contenu:
`La collecte des informations réglementaires est mal vécue quand elle arrive au mauvais moment, pas quand elle est demandée. C'est une distinction importante : la plupart des voyageurs ne rechignent pas à remplir une fiche de police si elle leur est présentée correctement et au bon moment. Ce qui génère de la friction, c'est la demande à l'arrivée, improvisée, sans contexte, quand le voyageur est déjà dans une autre logique.

## Pourquoi c'est l'hébergeur qui porte l'obligation

La réglementation de la plupart des pays qui imposent une fiche de police fait peser la responsabilité sur l'hébergeur, pas sur le voyageur. Si la fiche est absente lors d'un contrôle, c'est l'hébergeur qui est en défaut — qu'il ait ou non demandé au voyageur de la remplir. Cette asymétrie justifie une démarche proactive : le voyageur peut oublier, tarder, négliger. L'hébergeur ne peut pas se permettre de compter sur sa bonne volonté.

## Expliquez en une phrase

« La réglementation locale nous oblige à enregistrer les voyageurs étrangers avant leur arrivée ; le formulaire prend moins de deux minutes. » Une demande justifiée obtient un taux de complétion nettement supérieur à un formulaire envoyé sans contexte. Le mot « obligatoire » rassure plus qu'il n'inquiète : il indique que la démarche n'est pas une fantaisie de l'hébergeur mais une exigence administrative. Évitez les formulations qui semblent suspectes : « nous avons besoin de vos informations personnelles » sans explication déclenchera des questions.

## Envoyez au bon moment

Quarante-huit heures avant l'arrivée est la fenêtre la plus efficace. Le voyageur prépare son départ, ses documents de voyage sont à portée de main, et il est encore dans une logique de « choses à faire avant de partir ». Le jour même, il est dans un train ou un aéroport, distrait et souvent sans accès facile à sa pièce d'identité. Le lendemain de la réservation est trop tôt : pour un séjour dans trois semaines, la fiche de police n'est pas une priorité mentale.

## La composition du message de collecte

Le message doit contenir trois éléments dans cet ordre : l'explication en une phrase (voir ci-dessus), le lien direct vers le formulaire, et une mention du délai (« deux minutes »). Il ne doit pas contenir de liste d'informations demandées, de captures d'écran du formulaire, ni de longues explications sur ce que vous faites des données. Ces ajouts allongent le message sans augmenter le taux de complétion — ils le réduisent, parce qu'ils donnent l'impression que la démarche est complexe.

## Ce que le formulaire doit collecter

Les mentions minimales qui reviennent dans les réglementations comparables : nom complet, prénom, date et lieu de naissance, nationalité, pays de résidence, type et numéro de la pièce d'identité, date d'expiration, dates de séjour. La copie du document n'est pas toujours exigée par le texte, mais elle simplifie la vérification et rend la fiche plus robuste lors d'un contrôle. Si vous demandez la copie, indiquez clairement pourquoi et comment elle est conservée.

## Relancez une seule fois

Une relance vingt-quatre heures avant l'arrivée, sur les fiches encore incomplètes uniquement. Deux relances sur une fiche déjà remplie donnent l'impression que le système ne fonctionne pas — et déclenchent un message d'inquiétude du voyageur à traiter manuellement. La relance doit donc être conditionnelle à l'absence de complétion, pas automatique pour tous.

## Ce qu'il faut retenir

Le taux de fiches complètes avant l'arrivée est un bon indicateur de la qualité du processus. En dessous de 70 %, il y a un problème de timing ou de formulation. Au-dessus de 85 %, le processus est solide. Entre les deux, une variation du moment d'envoi ou de la formulation suffit généralement à corriger le résultat sans modifier le formulaire lui-même.`,
  },
  {
    id:'A10', slug:'tarification-dynamique-par-ou-commencer',
    titre:"Tarification dynamique : par où commencer sans se tromper",
    categorie:'outils', auteurId:'M5', datePublication:'2026-08-05',
    statut:'publie', aLaUne:false,
    chapo:"Occupation, saison, durée de séjour : les règles à activer en premier, et celles qui peuvent attendre.",
    metaDescription:"Débuter en tarification dynamique : quelles règles activer d'abord, quel plancher fixer, quoi surveiller.",
    contenu:
`La tarification dynamique fait peur parce qu'elle donne l'impression de confier ses prix à une machine. En pratique, elle applique des règles que vous auriez appliquées vous-même, si vous aviez le temps de le faire chaque jour et les données pour le faire chaque semaine. La différence entre une tarification manuelle bien gérée et une tarification dynamique bien configurée est d'abord une différence de fréquence et de réactivité, pas de méthode.

## Commencez par le plancher

Avant toute règle, fixez le prix en dessous duquel vous ne descendez jamais, quelles que soient les circonstances. Ce plancher doit couvrir vos charges fixes réelles : ménage, linge, plateforme, taxe de séjour, amortissement des équipements. En dessous, chaque nuit vendue vous coûte de l'argent. Un plancher bien calculé est un garde-fou : tout le reste peut se régler ensuite sans risque de vendre à perte.

## Deux règles suffisent au départ

La première règle utile est celle de l'occupation : monter les prix quand le calendrier se remplit, les baisser quand la période approche et que des dates restent libres. Sur un logement bien positionné, cette seule règle améliore le revenu moyen par nuit de 10 à 20 % la première saison. La deuxième règle utile est celle de la durée de séjour : une remise sur les séjours longs (cinq nuits ou plus) coûte moins qu'une semaine à moitié vide. Ces deux règles couvrent l'essentiel des situations.

## Comment calibrer les seuils

L'erreur courante est de calibrer les hausses trop tôt ou trop tard. Une hausse déclenchée quand il reste 80 % de disponibilité fait monter les prix trop tôt et dissuade les réservations précoces. Une hausse déclenchée à 20 % de disponibilité récupère peu de valeur parce que les créneaux restants sont déjà proches. Le bon réglage dépend de la saisonnalité de votre logement et du délai moyen de réservation — un logement qui se réserve trois semaines à l'avance n'a pas le même calendrier de hausse qu'un logement qui se réserve deux jours avant.

## Ce qui peut attendre

Les ajustements par jour de semaine (vendredi plus cher que mardi) et par saison (été plus cher qu'automne) affinent le résultat, mais ne sauvent pas un mois creux. Ils ajoutent aussi de la complexité à surveiller : un tarif de week-end mal calibré peut créer des trous le vendredi soir ou le dimanche. Activez-les quand les deux premières règles tournent depuis un cycle complet de réservation, que vous avez suffisamment de données pour voir les patterns, et que vous avez du temps pour les ajuster si quelque chose ne fonctionne pas.

## Les signaux que quelque chose ne va pas

Un calendrier constamment plein deux mois à l'avance indique que vos prix sont trop bas : vous laissez de la valeur sur la table. Un calendrier régulièrement vide trois semaines avant indique soit des prix trop élevés, soit un problème de positionnement de l'annonce — il faut distinguer les deux avant de toucher aux tarifs. Une règle de tarification dynamique ne corrige pas un problème d'attractivité de l'annonce.

## L'importance de la surveillance

Une tarification dynamique bien configurée se surveille, pas se pilote. Prévoyez de regarder les prix appliqués une fois par semaine au début, puis une fois par mois quand vous avez confiance dans les règles. Regardez particulièrement les périodes événementielles locales — festivals, congrès, vacances scolaires — que les règles automatiques ne couvrent pas toujours correctement. Un tarif normal pendant un grand événement local est une opportunité manquée ; un tarif très élevé pendant une période creuse chasse les réservations sans raison.

## Ce qu'il faut retenir

La tarification dynamique ne remplace pas la connaissance de votre marché local. Elle la complète en appliquant des ajustements que vous ne pouvez pas faire manuellement tous les jours. Commencez par deux règles simples et un plancher solide ; ajoutez de la sophistication uniquement quand vous comprenez pourquoi les règles existantes donnent les résultats qu'elles donnent.`,
  },
  {
    id:'A11', slug:'serrures-connectees-ce-quil-faut-savoir',
    titre:"Serrures connectées : ce qu'il faut vérifier avant d'équiper un logement",
    categorie:'outils', auteurId:'M5', datePublication:'2026-07-30',
    statut:'brouillon', aLaUne:false,
    chapo:"Autonomie, compatibilité, secours en cas de panne : les points à trancher avant l'achat, pas après.",
    metaDescription:"Choisir une serrure connectée pour une location courte durée : autonomie, compatibilité, plan de secours.",
    contenu:
`Une serrure connectée résout un problème réel — la remise des clés à distance, à n'importe quelle heure, sans intermédiaire — et en crée un nouveau : que se passe-t-il quand elle ne répond plus ? C'est la question que la plupart des hébergeurs se posent après l'installation, pas avant. La poser avant change les décisions d'achat, de configuration, et de plan de secours.

## L'autonomie avant la marque

La panne numéro un des serrures connectées n'est pas logicielle, elle est électrique. Une serrure dont la batterie tient douze à dix-huit mois permet un rythme de remplacement gérable sur un portefeuille de dix logements. Une serrure dont la batterie tient deux à trois mois demande quatre interventions par an et par logement — soit quarante interventions annuelles pour dix biens, juste pour changer des piles. Ce calcul est souvent absent des comparatifs mais déterminant dans le coût d'exploitation réel.

## Les modes de communication à comparer

Les serrures connectées fonctionnent selon trois technologies principales : Bluetooth (connexion directe depuis un téléphone à portée), Wi-Fi (connexion permanente au réseau local), et Z-Wave ou Zigbee (protocoles domotiques qui nécessitent un hub). Chaque technologie a ses compromis. Le Bluetooth consomme peu mais demande une présence physique pour opérer. Le Wi-Fi offre un accès à distance mais consomme plus et dépend de la qualité du réseau du logement. Les protocoles domotiques sont robustes mais nécessitent une infrastructure supplémentaire. Pour un logement de location courte durée, le Wi-Fi ou le Bluetooth avec accès à distance via le cloud sont les configurations les plus pratiques.

## Prévoyez le plan B dès l'installation

Le plan de secours doit être défini avant la première réservation, pas après la première panne. Les options concrètes : un cylindre mécanique de secours avec une clé physique déposée chez un voisin de confiance, une boîte à clés à code mécanique dont vous connaissez la combinaison, ou un double jeu de clés déposé chez un prestataire local. Le choix dépend du logement et de votre réseau sur place. Ce qui ne fonctionne pas : promettre au voyageur qu'en cas de problème vous « trouverez une solution ». La solution doit exister et être testée avant d'être nécessaire.

## Compatibilité avec votre outil de gestion

Une serrure connectée non intégrée à votre système de gestion redevient une serrure qu'on programme à la main : vous créez le code d'accès manuellement pour chaque réservation, vous l'envoyez au voyageur, et vous le supprimez après le départ. C'est faisable sur deux ou trois logements, mais c'est précisément le travail qu'on cherche à éliminer. Vérifiez la liste des intégrations supportées par votre outil de gestion avant d'acheter la serrure, pas après. Les modèles les plus populaires ont des intégrations natives ; les marques moins connues ont parfois une API mais aucune intégration prête à l'emploi.

## Les codes temporaires et leur gestion

L'intérêt principal des serrures connectées intégrées est la génération automatique de codes temporaires valables pour la durée exacte du séjour. Le code s'active le jour de l'arrivée, se désactive le jour du départ, et n'existe plus après. Cela supprime le risque d'un voyageur qui conserve l'accès après son départ, et évite de devoir changer les codes manuellement entre chaque séjour. Sur les modèles bien intégrés, ce cycle est entièrement automatisé à partir des dates de réservation.

## Ce qu'il faut vérifier avant d'acheter

Résistance aux intempéries si le logement est en extérieur, compatibilité avec le type de porte existant (certaines serrures ne s'adaptent qu'aux portes à mortaise standard), et disponibilité du service après-vente dans votre pays. Une serrure achetée en import direct peut être excellente techniquement mais introuvable en cas de panne matérielle. Vérifiez aussi si la serrure nécessite un abonnement cloud pour fonctionner à distance : certains modèles deviennent inutilisables si l'éditeur disparaît ou arrête son service.

## Ce qu'il faut retenir

Le critère d'achat le plus important n'est pas le design ni les fonctionnalités avancées, mais la fiabilité dans le temps et la simplicité du plan de secours. Une serrure sobre qui fonctionne tous les jours depuis deux ans vaut mieux qu'une serrure sophistiquée qui tombe en panne la veille d'un week-end de forte affluence.`,
  },
];

function getArticle(id) { return ARTICLES.find(a => a.id === id) || null; }
function articleParSlug(slug) { return ARTICLES.find(a => a.slug === slug) || null; }

/* Articles visibles du public, du plus récent au plus ancien. Les
   brouillons et les articles programmés en sont exclus par
   construction : c'est la seule liste que la page publique consomme,
   il n'y a donc pas d'endroit où oublier le filtre. */
function articlesPublies() {
  return ARTICLES.filter(articleEnLigne)
                 .sort((a, b) => b.datePublication.localeCompare(a.datePublication));
}
function articleALaUne() {
  const enLigne = articlesPublies();
  return enLigne.find(a => a.aLaUne) || enLigne[0] || null;
}
function articlesLies(article, nb = 2) {
  return articlesPublies()
    .filter(a => a.id !== article.id && a.categorie === article.categorie)
    .slice(0, nb);
}

// 200 mots par minute : la moyenne usuelle pour de la lecture d'écran.
// Toujours au moins 1 minute, « 0 min de lecture » n'a aucun sens.
function tempsLectureArticle(a) {
  const mots = ((a.chapo || '') + ' ' + (a.contenu || '')).trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(mots / 200));
}

/* Identifiant d'URL dérivé du titre. Les accents sont réduits à leur
   lettre de base : « réglementation » et « reglementation » doivent
   désigner la même page, sinon un lien partagé finit en 404 selon la
   façon dont il a été recopié. */
function slugifierTitre(titre) {
  return (titre || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70) || 'article';
}
// Un slug déjà pris renverrait deux articles sur la même adresse : on
// suffixe jusqu'à trouver libre, en ignorant l'article qu'on modifie.
function slugDisponible(base, sauf = null) {
  let slug = base, n = 2;
  while (ARTICLES.some(a => a.slug === slug && a.id !== sauf)) slug = `${base}-${n++}`;
  return slug;
}

/* Rendu du contenu : sous-titres (## …), listes (- …), paragraphes.
   L'échappement est fait ici et nulle part ailleurs — un contenu saisi
   dans le back-office ne doit pas pouvoir injecter de balise dans la
   page publique. */
function echapperHtml(texte) {
  return String(texte || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
/* `base` sert au back-office : les illustrations livrées avec le site
   sont référencées en chemin relatif (assets/blog/…), or l'aperçu de
   l'éditeur s'affiche depuis /admin/ où ce chemin ne mène nulle part.
   Le site public ne passe rien, l'admin passe '../'. */
function contenuArticleHtml(contenu, article = null, base = '') {
  const blocs = String(contenu || '').split(/\n\s*\n/);
  return blocs.map(bloc => {
    const lignes = bloc.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lignes.length) return '';

    // Une image seule sur son bloc devient une figure légendée. Collée au
    // milieu d'un paragraphe, elle resterait au fil du texte : ce n'est
    // pas ce qu'on veut d'une illustration d'article.
    if (lignes.length === 1 && RE_IMAGE.test(lignes[0])) {
      return figureHtml(lignes[0], article, base);
    }
    if (lignes[0].startsWith('## ')) {
      const titre = enrichir(lignes[0].slice(3));
      const reste = lignes.slice(1).join(' ');
      return `<h2>${titre}</h2>` + (reste ? `<p>${enrichir(reste)}</p>` : '');
    }
    if (lignes.every(l => l.startsWith('> '))) {
      return `<blockquote>${enrichir(lignes.map(l => l.slice(2)).join(' '))}</blockquote>`;
    }
    if (lignes.every(l => l.startsWith('- '))) {
      return `<ul>${lignes.map(l => `<li>${enrichir(l.slice(2))}</li>`).join('')}</ul>`;
    }
    return `<p>${enrichir(lignes.join(' '))}</p>`;
  }).join('');
}

const RE_IMAGE = /^!\[([^\]]*)\]\(([^)]+)\)$/;
const RE_LIEN  = /\[([^\]]+)\]\(([^)]+)\)/g;

/* Enrichissements en ligne : gras et liens. L'ordre compte — on échappe
   D'ABORD, puis on réintroduit les seules balises qu'on a décidé
   d'autoriser. L'inverse laisserait passer du HTML collé depuis un
   traitement de texte. */
function enrichir(texte) {
  let html = echapperHtml(texte);
  html = html.replace(RE_LIEN, (m, libelle, url) => {
    const cible = urlSure(url);
    // Lien refusé : on laisse la syntaxe telle quelle plutôt qu'un texte
    // recomposé. L'auteur voit que son lien n'a pas été accepté, au lieu
    // de découvrir une parenthèse orpheline dans la phrase.
    if (!cible) return m;
    const externe = /^https?:/i.test(cible);
    return `<a href="${cible}"${externe ? ' target="_blank" rel="noopener"' : ''}>${libelle}</a>`;
  });
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  return html;
}

/* Un contenu d'article est écrit par l'équipe, mais rien n'empêche un
   copier-coller d'apporter un « javascript: » : on n'accepte que ce qui
   mène vers une page ou une boîte mail. */
function urlSure(url) {
  const u = String(url || '').trim();
  if (/^(https?:|mailto:|\/|\.\/|#)/i.test(u)) return echapperHtml(u);
  if (/^(assets\/|blog\.html|article\.html|index\.html)/i.test(u)) return echapperHtml(u);
  return null;
}

/* Une référence d'image est soit un identifiant de média stocké dans
   l'article, soit un chemin de fichier. Les deux cohabitent : les
   illustrations livrées avec le site sont des fichiers, celles ajoutées
   depuis le back-office sont embarquées dans l'article. */
function resoudreMedia(ref, article, base = '') {
  const r = String(ref || '').trim();
  if (/^(data:image\/|https?:)/i.test(r)) return r;
  if (/^(assets\/|\.\.\/)/i.test(r)) return base + r;
  const m = article && (article.medias || []).find(x => x.id === r);
  return m ? m.url : null;
}

function figureHtml(ligne, article, base = '') {
  const [, legende, ref] = ligne.match(RE_IMAGE) || [];
  const src = resoudreMedia(ref, article, base);
  // Une image manquante ne laisse pas un cadre vide : on garde la légende,
  // qui porte souvent l'information utile.
  if (!src) return legende ? `<p class="article-media-absente">${echapperHtml(legende)}</p>` : '';
  return `<figure class="article-figure">
      <img src="${echapperHtml(src)}" alt="${echapperHtml(legende)}" loading="lazy">
      ${legende ? `<figcaption>${echapperHtml(legende)}</figcaption>` : ''}
    </figure>`;
}

/* Image de couverture : celle des cartes du blog et du haut de l'article.
   Renvoie null plutôt qu'une chaîne vide pour que l'appelant puisse
   basculer sur l'illustration de repli sans tester deux cas. */
function couvertureArticle(a, base = '') {
  if (!a || !a.image || !a.image.url) return null;
  return { url: resoudreMedia(a.image.url, a, base) || a.image.url, legende: a.image.legende || '' };
}

// Ajoute un média à l'article et renvoie son identifiant, celui qu'on
// insère dans le texte sous la forme ![légende](M3).
function ajouterMediaArticle(article, url, legende = '') {
  if (!article.medias) article.medias = [];
  const n = article.medias.reduce((max, m) => Math.max(max, parseInt(String(m.id).slice(1), 10) || 0), 0);
  const media = { id: 'M' + (n + 1), url, legende };
  article.medias.push(media);
  return media.id;
}

// Médias qui ne sont plus cités nulle part dans le texte : ils pèsent sur
// le stockage sans rien afficher. Nettoyés à l'enregistrement.
function mediasOrphelins(article) {
  const texte = String(article.contenu || '');
  return (article.medias || []).filter(m => !texte.includes(`](${m.id})`));
}

/* ------------------------------------------------------------
   ÉCRITURE — appelée depuis le back-office

   journaliser() vit dans admin-data.js, qui n'est pas chargé sur le
   site public : chaque appel est donc conditionnel. Sans cette
   précaution, un futur formulaire côté public planterait ici.
   ------------------------------------------------------------ */
function _journalBlog(action, cible, detail) {
  if (typeof journaliser === 'function') journaliser(action, cible, detail);
}

function enregistrerArticle(donnees, id = null) {
  const base = slugifierTitre(donnees.slug || donnees.titre);
  if (id) {
    const a = getArticle(id);
    if (!a) return null;
    const avant = a.statut;
    Object.assign(a, donnees, { slug: slugDisponible(base, id) });
    if (a.aLaUne) _exclusiviteUne(a.id);
    _journalBlog('Article modifié', a.titre,
      avant !== a.statut ? `Statut : ${ARTICLE_STATUTS[statutArticleReel(a)].label}.` : 'Contenu mis à jour.');
    if (typeof saveOyviaState === 'function') saveOyviaState();
    return a;
  }
  const nouveau = {
    id: _prochainIdArticle(),
    slug: slugDisponible(base),
    titre:'', categorie:'organisation', auteurId:'M1',
    datePublication: AUJOURDHUI, statut:'brouillon', aLaUne:false,
    chapo:'', metaDescription:'', contenu:'', image:null, medias:[],
    ...donnees,
  };
  ARTICLES.unshift(nouveau);
  if (nouveau.aLaUne) _exclusiviteUne(nouveau.id);
  _journalBlog('Article créé', nouveau.titre, `${labelCategorieBlog(nouveau.categorie)} · ${ARTICLE_STATUTS[statutArticleReel(nouveau)].label}.`);
  if (typeof saveOyviaState === 'function') saveOyviaState();
  return nouveau;
}

// prochainId() appartient au back-office ; le blog public doit pouvoir
// vivre sans lui, d'où cette version locale.
function _prochainIdArticle() {
  const max = ARTICLES.reduce((m, a) => Math.max(m, parseInt(String(a.id).replace(/\D/g, ''), 10) || 0), 0);
  return 'A' + String(max + 1).padStart(2, '0');
}

// Une seule mise en avant à la fois : deux articles « à la une »
// donneraient une page d'accueil qui en affiche un au hasard.
function _exclusiviteUne(id) {
  ARTICLES.forEach(a => { if (a.id !== id) a.aLaUne = false; });
}
function mettreALaUne(id) {
  const a = getArticle(id);
  if (!a) return false;
  if (!articleEnLigne(a)) return false;   // mettre en avant un brouillon n'afficherait rien
  a.aLaUne = true;
  _exclusiviteUne(id);
  _journalBlog('Article mis à la une', a.titre, '');
  if (typeof saveOyviaState === 'function') saveOyviaState();
  return true;
}

function publierArticle(id, date = null) {
  const a = getArticle(id);
  if (!a) return false;
  if (!a.titre.trim() || !a.contenu.trim()) return false;
  a.statut = 'publie';
  if (date) a.datePublication = date;
  _journalBlog(a.datePublication > AUJOURDHUI ? 'Article programmé' : 'Article publié', a.titre,
    formatDate(a.datePublication, { annee: true }));
  if (typeof saveOyviaState === 'function') saveOyviaState();
  return true;
}

function depublierArticle(id) {
  const a = getArticle(id);
  if (!a) return false;
  a.statut = 'brouillon';
  a.aLaUne = false;      // un brouillon ne peut pas rester la une du site
  _journalBlog('Article dépublié', a.titre, 'Repassé en brouillon.');
  if (typeof saveOyviaState === 'function') saveOyviaState();
  return true;
}

function dupliquerArticle(id) {
  const a = getArticle(id);
  if (!a) return null;
  const copie = {
    ...a,
    id: _prochainIdArticle(),
    titre: a.titre + ' (copie)',
    slug: slugDisponible(slugifierTitre(a.titre + ' copie')),
    statut: 'brouillon', aLaUne: false, datePublication: AUJOURDHUI,
  };
  ARTICLES.unshift(copie);
  _journalBlog('Article dupliqué', copie.titre, `D'après « ${a.titre} ».`);
  if (typeof saveOyviaState === 'function') saveOyviaState();
  return copie;
}

function supprimerArticle(id) {
  const a = getArticle(id);
  if (!a) return false;
  const titre = a.titre;
  if (typeof supprimerEntite === 'function') supprimerEntite('ARTICLES', id);
  else {
    const i = ARTICLES.findIndex(x => x.id === id);
    if (i > -1) ARTICLES.splice(i, 1);
    if (typeof saveOyviaState === 'function') saveOyviaState();
  }
  _journalBlog('Article supprimé', titre, '');
  return true;
}

/* ------------------------------------------------------------
   PERSISTANCE
   ------------------------------------------------------------ */
if (typeof enregistrerEntitesOyvia === 'function') {
  enregistrerEntitesOyvia({ ARTICLES }, () => {
    // Les articles créés depuis le back-office reviennent en fin de
    // tableau après restauration ; l'ordre chronologique est ce que le
    // site publie, il se rétablit donc ici une fois pour toutes.
    ARTICLES.sort((a, b) => String(b.datePublication).localeCompare(String(a.datePublication)));
  });
}
