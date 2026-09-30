# ÉRIS

App de pronostics **esport** — type *Mon Petit Prono*, mais pour le compétitif (Valorant · CS2 · LoL).
Gratuit, sans argent réel : on pronostique pour le fun et on chambre ses potes. **Points, pas de coins.**

## Direction artistique

« Pierre + dorure discrète + point de jeu. » Le neutre fait 90% du boulot.

- **Fond pierre** gris-violacé neutre (`#14131A`, cartes `#1C1B23`).
- **Doré signature** (`#C9A86A`) — marque, pas accent qui crie : logo, « ÉRIS », compteur de points, chiffres d'exploit.
- **Couleur-jeu** uniquement en **pastille 6px** à côté du tournoi : 🔴 Valo · 🟠 CS · 🔵 LoL.

## Le barème (façon MPP)

- **Base** = cote de l'issue choisie (issue rare correcte = plus de points).
- **Bonus rareté** sur le **score de série exact** (BO3 : 2–0/2–1 · BO5 : 3–0/3–1/3–2).
- **×2** : un seul match boosté.
- Jamais de points négatifs.

## Données — PandaScore (tournois tier S + logos)

L'app charge les **matchs à venir tier S** de Valorant, CS2 et LoL depuis [PandaScore](https://pandascore.co),
avec les **logos d'équipes**. Sans token, elle tourne en **mode démo** sur des données mockées.

```bash
cp .env.example .env.local
# puis colle ton token dans .env.local :
# EXPO_PUBLIC_PANDASCORE_TOKEN=ton_token
```

- Slugs API : `valorant` · `csgo` (CS2 sert sous csgo) · `lol`.
- Le `tier` est sur `tournament.tier` → on filtre côté client sur `tier === 's'`.
- ⚠️ `EXPO_PUBLIC_*` est **embarqué en clair dans le bundle**. OK proto, mais en prod → backend proxy.
- ⚠️ L'API standard **n'a pas d'odds** → les cotes (= points de base) sont **synthétisées** de façon déterministe.

## Lancer l'app

```bash
npm install        # déjà fait
npx expo start -c  # -c vide le cache (utile après avoir édité .env.local)
# puis 'i' (iOS), 'a' (Android) ou scanner le QR avec Expo Go
```

## Structure

```
App.tsx                      point d'entrée (SafeArea + thème sombre)
src/
  theme.ts                   tokens de la DA (couleurs, doré, pastilles jeu, typo)
  types.ts                   modèle de données (Team.logo inclus)
  api/pandascore.ts          client PandaScore : tier S, mapping, cotes synthétisées
  data/matches.ts            données démo (fallback sans token)
  lib/scoring.ts             barème : vainqueur déduit + gain potentiel
  components/
    GamePill.tsx             la pastille 6px couleur-jeu
    PointsCounter.tsx        compteur de points doré
    MatchCard.tsx            carte match : logos + score saisi à la main + ×2 + gain
  screens/FeedScreen.tsx     écran cœur "Tes pronos" (live / démo + pull-to-refresh)
```

## Périmètre actuel (MVP)

Écran **Feed + pronos** uniquement. Prévu pour s'étendre : Classement / ligues privées, Profil + exploits.
Données mockées, pas de backend.
