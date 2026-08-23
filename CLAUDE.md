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

## Vérification

- Syntaxe JS : `osascript -l JavaScript /tmp/chk2.js <fichiers>`
- Équilibre des accolades CSS : compter `{` et `}` en Python
- Serveur de démonstration : `.claude/devserver.py` (port 4322)
- L'aperçu ne défile pas : ce qui dépend du défilement se vérifie
  autrement, ou se signale comme non vérifié.
