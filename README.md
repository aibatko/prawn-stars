# Prawn Stars

Minimal top‑down shooter inspired by Brawl Stars.

## Running

```
cd server
npm start
```

Open `http://localhost:3000` in your browser. Connecting clients join the same arena immediately.

## Controls

- **WASD** – move
- **IJKL** – shoot in the four directions
- **Space + IJKL** – grapple hook

Each player has 10 HP. Taking damage lowers HP by 1. Killing another player heals you to full. Dying respawns you at a random location.

Walls block bullets and can be grappled.
