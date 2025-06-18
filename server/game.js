const config = require('./config');

const TILE_EMPTY = 0;
const TILE_WALL = 1;


const {
  mapWidth: MAP_WIDTH,
  mapHeight: MAP_HEIGHT,
  playerSpeed: PLAYER_SPEED,
  bulletSpeed: BULLET_SPEED,
  reloadTime,
  grappleSpeed: GRAPPLE_SPEED,
  grappleRange: GRAPPLE_RANGE,
  bulletDamage: BULLET_DAMAGE,
  playerHp: PLAYER_HP,
  regenOnKill: REGEN_ON_KILL,
  grappleCooldown,
  abilityCooldown,
  abilityDamage: ABILITY_DAMAGE,
  abilityRange: ABILITY_RANGE
} = config;

const RELOAD_TIME = reloadTime * 1000;
const GRAPPLE_COOLDOWN = grappleCooldown * 1000;
const ABILITY_COOLDOWN = abilityCooldown * 1000;
const CONE_ANGLE = Math.PI / 3; // 60 degree cone
const players = {};
const bullets = [];
const cones = [];
let nextPlayerId = 1;
const map = [];

function damagePlayer(target, amount, attackerId) {
  target.hp -= amount;
  if (target.hp <= 0) {
    const killer = players[attackerId];
    if (killer) {
      killer.hp = Math.min(killer.hp + REGEN_ON_KILL, PLAYER_HP);
      killer.score++;
      killer.streak = (killer.streak || 0) + 1;
    }
    target.hp = PLAYER_HP;
    target.streak = 0;
    let sx, sy;
    do {
      sx = Math.floor(Math.random() * MAP_WIDTH);
      sy = Math.floor(Math.random() * MAP_HEIGHT);
    } while (map[sy][sx] !== TILE_EMPTY);
    target.x = sx + 0.5;
    target.y = sy + 0.5;
  }
}
function generateMap() {
  for (let y = 0; y < MAP_HEIGHT; y++) {
    map[y] = [];
    for (let x = 0; x < MAP_WIDTH; x++) {
      if (y === 0 || y === MAP_HEIGHT-1 || x === 0 || x === MAP_WIDTH-1) {
        map[y][x] = TILE_WALL;
      } else {
        map[y][x] = Math.random() < 0.3 ? TILE_WALL : TILE_EMPTY;
      }
    }
  }
  // simple cellular automata smoothing
  for (let it=0; it<2; it++) {
    const newMap = [];
    for (let y=0; y<MAP_HEIGHT; y++) {
      newMap[y] = [];
      for (let x=0; x<MAP_WIDTH; x++) {
        if (y===0 || y===MAP_HEIGHT-1 || x===0 || x===MAP_WIDTH-1) {
          newMap[y][x] = TILE_WALL;
          continue;
        }
        let count = 0;
        for (let dy=-1; dy<=1; dy++) {
          for (let dx=-1; dx<=1; dx++) {
            if (dx===0 && dy===0) continue;
            if (map[y+dy][x+dx]===TILE_WALL) count++;
          }
        }
        if (count >=5) newMap[y][x]=TILE_WALL;
        else if (count <=2) newMap[y][x]=TILE_EMPTY;
        else newMap[y][x]=map[y][x];
      }
    }
    for (let y=0; y<MAP_HEIGHT; y++) {
      for (let x=0; x<MAP_WIDTH; x++) {
        map[y][x] = newMap[y][x];
      }
    }
  }
}
function addPlayer(name = 'Player') {
  let x, y;
  do {
    x = Math.floor(Math.random() * MAP_WIDTH);
    y = Math.floor(Math.random() * MAP_HEIGHT);
  } while (map[y][x] !== TILE_EMPTY);
  const id = String(nextPlayerId++);
  players[id] = {
    id,
    name,
    x: x + 0.5,
    y: y + 0.5,
    hp: PLAYER_HP,
    score: 0,
    streak: 0,
    lastShoot: 0,
    lastGrapple: 0,
    lastAbility: 0,
    grapple: null
  };
  return players[id];
}
function removePlayer(id) {
  delete players[id];
}
function addBullet(ownerId, dir) {
  const owner = players[ownerId];
  const now = Date.now();
  if (now - owner.lastShoot < RELOAD_TIME) return;
  owner.lastShoot = now;
  const speed = BULLET_SPEED;
  const vel = {x:0,y:0};
  if (dir==='up') vel.y=-speed;
  else if (dir==='down') vel.y=speed;
  else if (dir==='left') vel.x=-speed;
  else if (dir==='right') vel.x=speed;
  bullets.push({x:owner.x, y:owner.y, vx:vel.x, vy:vel.y, owner:ownerId});
}

function useAbility(ownerId) {
  const owner = players[ownerId];
  const now = Date.now();
  if (now - owner.lastAbility < ABILITY_COOLDOWN) return;
  owner.lastAbility = now;

  let target = null;
  let best = Infinity;
  for (const id in players) {
    if (id === ownerId) continue;
    const p = players[id];
    const dx = p.x - owner.x;
    const dy = p.y - owner.y;
    const dist2 = dx*dx + dy*dy;
    if (dist2 < best) { best = dist2; target = p; }
  }
  if (!target) return;

  const angle = Math.atan2(target.y - owner.y, target.x - owner.x);
  // keep the cone visible for a full second (10 ticks)
  cones.push({x: owner.x, y: owner.y, angle, life: 10});

  for (const id in players) {
    if (id === ownerId) continue;
    const p = players[id];
    const dx = p.x - owner.x;
    const dy = p.y - owner.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist > ABILITY_RANGE) continue;
    const ang = Math.atan2(dy, dx);
    let diff = Math.abs(ang - angle);
    if (diff > Math.PI) diff = Math.abs(diff - 2*Math.PI);
    if (diff <= CONE_ANGLE/2) {
      damagePlayer(p, ABILITY_DAMAGE, ownerId);
    }
  }
}
function update() {
  // update bullets with sub-steps to avoid skipping over players/walls
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    const steps = Math.ceil(Math.max(Math.abs(b.vx), Math.abs(b.vy))); // max 1 tile per step
    let removed = false;

    for (let s = 0; s < steps; s++) {
      b.x += b.vx / steps;
      b.y += b.vy / steps;

      if (b.x < 0 || b.y < 0 || b.x >= MAP_WIDTH || b.y >= MAP_HEIGHT) { removed = true; break; }
      if (map[Math.floor(b.y)][Math.floor(b.x)] === TILE_WALL) { removed = true; break; }

      for (const id in players) {
        const p = players[id];
        if (Math.floor(p.x) === Math.floor(b.x) && Math.floor(p.y) === Math.floor(b.y)) {
          if (id !== b.owner) {
            p.hp -= BULLET_DAMAGE;
            if (p.hp <= 0) {
              const killer = players[b.owner];
              if (killer) {
                killer.hp = Math.min(killer.hp + REGEN_ON_KILL, PLAYER_HP);
                killer.score++;
                killer.streak = (killer.streak || 0) + 1;
              }
              p.hp = PLAYER_HP;
              p.streak = 0;
              let sx, sy;
              do { sx = Math.floor(Math.random() * MAP_WIDTH); sy = Math.floor(Math.random() * MAP_HEIGHT); } while (map[sy][sx] !== TILE_EMPTY);
              p.x = sx + 0.5; p.y = sy + 0.5;
            }
            removed = true;
          }
          break;
        }
      }
      if (removed) break;
    }
    if (removed) bullets.splice(i, 1);
  }

  for (let i = cones.length - 1; i >= 0; i--) {
    cones[i].life -= 1;
    if (cones[i].life <= 0) cones.splice(i, 1);
  }

  // update grappling players
  for (const id in players) {
    const p = players[id];
    if (p.grapple) {
      const gx = p.grapple.x;
      const gy = p.grapple.y;
      const dx = Math.sign(gx - p.x);
      const dy = Math.sign(gy - p.y);
      let nx = p.x + dx * GRAPPLE_SPEED;
      let ny = p.y + dy * GRAPPLE_SPEED;
      if ((dx <= 0 && nx <= gx) || (dx >= 0 && nx >= gx)) nx = gx;
      if ((dy <= 0 && ny <= gy) || (dy >= 0 && ny >= gy)) ny = gy;
      p.x = nx;
      p.y = ny;
      if (p.x === gx && p.y === gy) p.grapple = null;
    }
  }
}
function handleAction(id, action) {
  const p = players[id];
  if (!p) return;
  if (action.type==='move') {
    if (p.grapple) return;
    const dx = action.dx||0; const dy=action.dy||0;
    const nx = p.x + dx * PLAYER_SPEED; const ny = p.y + dy * PLAYER_SPEED;
    if (nx>=0&&ny>=0&&nx<MAP_WIDTH&&ny<MAP_HEIGHT&&map[Math.floor(ny)][Math.floor(nx)]===TILE_EMPTY){
      p.x = nx; p.y = ny;
    }
  } else if (action.type==='shoot') {
    addBullet(id, action.dir);
  } else if (action.type==='grapple') {
    const now = Date.now();
    if (now - p.lastGrapple < GRAPPLE_COOLDOWN || p.grapple) return;
    const dir = action.dir;
    let dx=0,dy=0;
    if(dir==='up')dy=-1;else if(dir==='down')dy=1;else if(dir==='left')dx=-1;else if(dir==='right')dx=1;
    let cx=Math.floor(p.x), cy=Math.floor(p.y);
    for(let i=0;i<GRAPPLE_RANGE;i++){
      cx+=dx; cy+=dy;
      if(cx<0||cy<0||cx>=MAP_WIDTH||cy>=MAP_HEIGHT)break;
      if(map[cy][cx]===TILE_WALL){
        p.grapple = {x:cx-dx+0.5, y:cy-dy+0.5};
        p.lastGrapple = now;
        break;
      }
    }
  } else if (action.type==='ability') {
    useAbility(id);
  }
}
function gameState(){
  return {players, bullets, cones, map};
}
module.exports={generateMap,addPlayer,removePlayer,handleAction,update,gameState,map,players,bullets,cones,config};
