# Skyline Ridge Run — 3D Flight Game

[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/Ritwan007/best-flight-game-20261126-0057/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/Ritwan007/best-flight-game-20261126-0057/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

A complete, original 3D flight game for the [make.fun best flight game bounty](https://make.fun/bounty/best-flight-game-20261126-0057). Fly the little red prop plane out of Ridgefield Airfield over a procedural low-poly valley: thread 8 glowing rings, run the river canyon low and fast, or land gently on runway 27 — three times — while fuel, speed and the mountains all have opinions.

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network: `game/` is plain static files, three.js vendored under `game/vendor/`.

## Controls

- **W / S** — throttle up / down
- **↑ / ↓** — pitch · **← / →** — bank and turn · **A / D** — rudder
- **Mouse** — steer too · **G** — landing gear · **M** — mute · **R** — restart

## Missions

1. **Ring Course** — 8 glowing rings in order, against the clock. 150 points a ring, plus a time bonus for a fast clean run.
2. **Canyon Run** — stay under 120 ft through the river gorge. Every 5 seconds low is 40 points; climb out and the meter stops.
3. **Landing Challenge** — three gentle touchdowns on runway 27. A smooth, slow, gear-down landing scores up to 300 points and refuels you.

Fuel burns with throttle — land on the runway to refuel. Fly too slow and she stalls; fly into the ridges and she meets the mountain; come in too fast or too steep and the airframe gives out.

## Layout

- `main.ts` — hand-in program: copies `game/` + `screenshots/` to `/output` and writes `dossier.json`
- `game/index.html` — page shell and HUD
- `game/src/world.js` — procedural terrain, runway, rings, river, trees, clouds
- `game/src/aircraft.js` — the prop plane, built from primitives
- `game/src/input.js` — keyboard + mouse controls
- `game/src/audio.js` — WebAudio engine hum, wind, chimes (no audio files)
- `game/src/hud.js` — instruments, fuel, throttle, attitude, mission panel
- `game/src/missions.js` — the three missions and scoring
- `game/src/main.js` — flight physics, chase camera, landings, crashes, game loop
- `screenshots/` — real renders of the game running in a browser
