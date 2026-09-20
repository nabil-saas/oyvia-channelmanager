# Oyvia — conventions du projet

Prototype statique : HTML/CSS/JS, aucun build, aucune dépendance.
`js/data.js` porte le domaine, `js/layout.js` le shell de l'app cliente,
`js/admin-layout.js` celui du back-office. État persisté dans
`localStorage` (`oyvia_state_v2`).

## Règles d'interface

**Pas de bandeau de KPI en haut des écrans.** Ni dans l'app, ni dans le
back-office. Ces quatre grands chiffres alignés occupent le premier
écran, ne se lisent qu'une fois et repoussent vers le bas la seule chose
qu'on vient chercher : le tableau. Quand une information mérite d'être
signalée, elle se place là où l'action se décide — une pastille sur la
ligne concernée, une pastille de menu, un encart quand un cas particulier
le justifie.

Historique : les KPI ont déjà été retirés des Fiches de police, des
Services additionnels, des Avis, puis des deux écrans Marketplace du
back-office. Ne pas les réintroduire.

## Landing (index.html, blog.html, article.html)

**Une seule feuille : `css/landing.css`**, lue dans l'ordre où la page
se déroule, avec un sommaire numéroté de 1 à 20 en tête de fichier.
Les règles adaptatives sont toutes regroupées en §19, par largeur
décroissante, au lieu d'être dispersées après chaque composant.

La §14 (Tarifs) est une **zone gelée** : le client a validé les offres
et le tableau comparatif, on n'y touche pas.

Préfixes : `.lp-` pour la page, `.d…` pour les dix aperçus
d'application (`dcal`, `di`, `da`, `dt`, `ds`, `dpo`, `dbk`, `dtp`,
`dfs`, `dsv`), `.pv-` pour les micro-visuels de la bande sombre, `.vv`
pour la conversation de Vivi. Les classes `is-*` sont des états posés
par `js/landing-anim.js`, jamais des crochets de style structurel.

**Les logos des plateformes sont les vrais** (`assets/logos/`, sources et
licences dans `CREDITS.md`). Pas de pastille colorée avec une initiale :
un « A » orange ne dit pas Airbnb, il dit maquette. Les `viewBox` ont été
resserrées sur le tracé pour qu'à hauteur égale les marques pèsent
optiquement la même chose ; les attributs `data-h="s|l"` corrigent les
dessins très bas de casse (Vrbo, agoda).

**Ne promettre que ce que le produit déclare.** La liste des canaux
affichée sur la landing suit `PLATEFORMES` dans `js/data.js` — ajouter
un logo qui n'y figure pas, c'est vendre une intégration qui n'existe pas.
Les marques de serrures (Yale, Nuki, August, TTLock) correspondent au
service « Seam » de `SERVICES_PLATEFORME`.

**Une démo ne ment pas non plus.** Le récapitulatif de prix de l'onglet
« Réservation directe » affiche un total qui est la somme des lignes
visibles. Si une règle responsive masque une ligne, le total devient
faux — donc on masque un champ de formulaire, jamais une ligne de prix.

**Vivi, l'assistant IA, a sa propre section** (`.lp-vivi`, mascotte
`assets/vivi.svg`). Ce qu'on y raconte vient de `VIVI_SUJETS`,
`VIVI_ESCALADES`, `VIVI_TONS` et `VIVI_LANGUES` : le périmètre traité
seul, les cas toujours escaladés, le ton réglable, les six langues.

**Un appel à l'action clôt chaque section.** `.lp-cta-row` est le
composant partagé ; le hero, la bande sombre, la visite du produit,
Vivi et l'écosystème en portent tous un.

**Attention aux collisions de noms de classes.** `.lp-tab` désignait déjà
le tableau comparatif des tarifs ; le réutiliser pour les onglets de la
visite guidée leur a collé un `min-width: 780px` invisible à la lecture.
Avant d'introduire un composant, vérifier que son nom est libre dans
`landing.css`, `components.css` et `blog.css`. Depuis la fusion des
feuilles, une simple recherche dans `landing.css` suffit pour la landing.

**Révélation au défilement.** `[data-reveal]` n'est masqué que sous
`html.js`, classe posée par un script en ligne dans le `<head>` : sans
JavaScript, la page reste entièrement lisible. La détection se fait par
mesure directe (`getBoundingClientRect`) et non par IntersectionObserver,
dont le premier appel n'arrive pas tant que le document n'est pas peint.

## Vérification

- Syntaxe JS : `osascript -l JavaScript /tmp/chk2.js <fichiers>`
- Équilibre des accolades CSS : compter `{` et `}` en Python
- Serveur de démonstration : `.claude/devserver.py` (port 4322)
- L'aperçu ne défile pas : ce qui dépend du défilement se vérifie
  autrement, ou se signale comme non vérifié. Pour photographier une
  section basse, masquer celles du dessus (`style.display='none'`).
- L'aperçu tourne avec `document.hidden === true` : les transitions CSS,
  les animations et `requestAnimationFrame` y sont gelés. Injecter
  `*{transition:none!important;animation:none!important}` avant une
  capture, sinon tout ce qui apparaît en fondu se photographie invisible.
