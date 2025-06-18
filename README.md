# Prawn Stars

Minimal top-down shooter inspired by Brawl Stars.

## Running

```bash
cd server
npm start
```

Open `http://localhost:3000` in your browser. You can also connect from other machines using `http://<server-ip>:3000`. Connecting clients join the same arena immediately.

## Controls

- **WASD** – move
- **IJKL** – shoot in the four directions
- **Space + IJKL** – grapple hook

Each player has a limited amount of HP (10 by default). Taking damage reduces HP by 1. Killing another player heals you, but HP never exceeds the maximum. Dying respawns you at a random location. The map scrolls with your character so only a small area is visible at once.

Walls block bullets and can be grappled.

At game start you will be prompted for your player name. A small leaderboard
canvas sits in the top right corner showing all connected players ordered by
their kill count. The red number next to each entry is the current kill streak
(reset to zero when that player dies).

## Developer Guide

### Project layout

```
public/       - client side assets
  index.html  - main game page
  client.js   - browser logic and drawing
  style.css   - basic styles
  assets/     - sound effects
server/       - Node.js backend
  server.js   - HTTP server and event stream
  game.js     - game state and rules
  config.yml  - gameplay parameters
  package.json
```

The server serves files from the `public` folder and exposes simple endpoints:

- `POST /join` – register a new player and return the map
- `GET /stream?id=<id>` – server-sent events stream with game state updates
- `POST /action` – send player actions (`move`, `shoot`, `grapple`)

Client logic in `public/client.js` uses these endpoints to join the game, listen for updates and send actions based on keyboard input.

### Gameplay features

- Randomly generated rectangular map with walls around the border
- Four-directional movement and shooting
- Simple collision, damage and respawn logic in `game.js`
- Grapple hook that pulls the player next to the first wall in a direction
- Basic sound effects and colored rectangles for graphics
- Small death animation and visible health bars
- Holding **space** shows the grappling hook range preview
- Large scrolling map with camera centered on the player
- Smooth movement between grid cells
- Browser zoom keys are disabled so everyone sees the same area

### Modifying the game

- **Changing map size or player stats** – tweak values in `server/config.yml`.
- **Game logic implementation** – handled in `addPlayer`, `update` and `handleAction` inside `server/game.js`.
- **Client rendering** – update canvas drawing code or add sprites in `public/client.js` and assets under `public/`.
- **Camera behaviour** – the view follows the current player, computed in `draw()` inside `public/client.js`.
- **Networking** – `server/server.js` streams the current state every 100ms. Adjust the interval or protocol here.
- **Sounds and assets** – add files under `public/assets` and reference them from `public/client.js`.

### Installation

Only Node.js is required. The server has no external dependencies. In the `server` directory you can run `npm install` (creates a `package-lock.json` but installs nothing) then `npm start` to launch.

