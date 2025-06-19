const { game: GAME_CONFIG, classes: CLASS_CONFIGS } = require('./config');

const TILE_EMPTY = 0;
const TILE_WALL = 1;

const MAP_WIDTH = GAME_CONFIG.mapWidth || 100;
const MAP_HEIGHT = GAME_CONFIG.mapHeight || 50;

const CONE_ANGLE = Math.PI / 3; // 60 degree cone
const players = {};
const bullets = [];
const cones = [];
const flames = [];
const aoes = [];
const warnings = [];
let nextPlayerId = 1;
const map = [];

function damagePlayer(target, amount, attackerId) {
  target.hp -= amount;
  if (target.hp <= 0) {
    const killer = players[attackerId];
    if (killer) {
      killer.hp = Math.min(killer.hp + killer.stats.regenOnKill, killer.stats.playerHp);
      killer.score++;
      killer.streak = (killer.streak || 0) + 1;
    }
    target.hp = target.stats.playerHp;
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
function addPlayer(name = 'Player', cls = 'class1') {
  const stats = CLASS_CONFIGS[cls] || CLASS_CONFIGS[Object.keys(CLASS_CONFIGS)[0]];
  let x, y;
  do {
    x = Math.floor(Math.random() * MAP_WIDTH);
    y = Math.floor(Math.random() * MAP_HEIGHT);
  } while (map[y][x] !== TILE_EMPTY);
  const id = String(nextPlayerId++);
  players[id] = {
    id,
    name,
    class: cls,
    stats,
    x: x + 0.5,
    y: y + 0.5,
    hp: stats.playerHp,
    score: 0,
    streak: 0,
    lastShoot: 0,
    lastGrapple: 0,
    lastAbility: 0,
    grapple: null,
    frozen: 0
  };
  return players[id];
}
function removePlayer(id) {
  delete players[id];
}
function addBullet(ownerId, dir) {
  const owner = players[ownerId];
  const now = Date.now();
  const reloadTime = owner.stats.reloadTime * 1000;
  if (now - owner.lastShoot < reloadTime) return;
  owner.lastShoot = now;
  const speed = owner.stats.bulletSpeed;
  let angle = 0;
  if (dir==='up') angle = -Math.PI/2;
  else if (dir==='down') angle = Math.PI/2;
  else if (dir==='left') angle = Math.PI;
  else if (dir==='right') angle = 0;
  else if (dir==='upleft') angle = -3*Math.PI/4;
  else if (dir==='upright') angle = -Math.PI/4;
  else if (dir==='downleft') angle = 3*Math.PI/4;
  else if (dir==='downright') angle = Math.PI/4;

  if (owner.stats.bulletSpray) {
    const spread = owner.stats.bulletSpray;
    angle += (Math.random() - 0.5) * spread;
  }

  const vel = {x: Math.cos(angle)*speed, y: Math.sin(angle)*speed};
  const life = Math.ceil((owner.stats.bulletRange || 999) / speed);
  bullets.push({
    x: owner.x,
    y: owner.y,
    vx: vel.x,
    vy: vel.y,
    owner: ownerId,
    damage: owner.stats.bulletDamage,
    life,
    size: owner.stats.bulletSize || 4,
    color: owner.stats.bulletColor || '#ff0'
  });
}

function addFreezeArrow(ownerId, dir) {
  const owner = players[ownerId];
  const now = Date.now();
  const cooldown = owner.stats.grappleCooldown * 1000;
  if (now - owner.lastGrapple < cooldown) return;
  owner.lastGrapple = now;
  const speed = owner.stats.arrowSpeed || owner.stats.bulletSpeed || 2;
  let angle = 0;
  if (dir==='up') angle = -Math.PI/2;
  else if (dir==='down') angle = Math.PI/2;
  else if (dir==='left') angle = Math.PI;
  else if (dir==='right') angle = 0;
  else if (dir==='upleft') angle = -3*Math.PI/4;
  else if (dir==='upright') angle = -Math.PI/4;
  else if (dir==='downleft') angle = 3*Math.PI/4;
  else if (dir==='downright') angle = Math.PI/4;

  const vel = {x: Math.cos(angle)*speed, y: Math.sin(angle)*speed};
  const range = owner.stats.arrowRange || 6;
  const life = Math.ceil(range / speed);
  bullets.push({
    x: owner.x,
    y: owner.y,
    vx: vel.x,
    vy: vel.y,
    owner: ownerId,
    damage: 0,
    life,
    size: owner.stats.arrowSize || 6,
    color: 'cyan',
    freeze: owner.stats.freezeDuration || 3
  });
}

function useAbility(ownerId) {
  const owner = players[ownerId];
  const now = Date.now();
  const abilityCooldown = owner.stats.abilityCooldown * 1000;
  if (now - owner.lastAbility < abilityCooldown) return;
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

  if (owner.stats.rocketBarrage) {
    for (let i = 0; i < 5; i++) {
      warnings.push({
        x: target.x,
        y: target.y,
        owner: ownerId,
        timer: 10 + i * 2,
        radius: owner.stats.rocketRadius || 2,
        damage: owner.stats.rocketDamage || 3
      });
    }
    return;
  }

  const angle = Math.atan2(target.y - owner.y, target.x - owner.x);
  if (owner.stats.flameCone) {
    const dur = (owner.stats.flameDuration || 3) * 10;
    const width = owner.stats.flameAngle || (CONE_ANGLE/2);
    const range = owner.stats.flameRange || owner.stats.abilityRange;
    cones.push({x: owner.x, y: owner.y, angle, life: dur, width: width, range: range, color: owner.stats.flameColor || 'rgba(255,128,0,0.4)'});
    flames.push({x: owner.x, y: owner.y, angle, life: dur, width, range, damage: owner.stats.abilityDamage, interval: (owner.stats.flameInterval||10), tick:0, owner: ownerId});
  } else {
    // keep the cone visible for a full second (10 ticks)
    cones.push({x: owner.x, y: owner.y, angle, life: 10, width: CONE_ANGLE, range: owner.stats.abilityRange});

    for (const id in players) {
      if (id === ownerId) continue;
      const p = players[id];
      const dx = p.x - owner.x;
      const dy = p.y - owner.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const abilityRange = owner.stats.abilityRange;
      if (dist > abilityRange) continue;
      const ang = Math.atan2(dy, dx);
      let diff = Math.abs(ang - angle);
      if (diff > Math.PI) diff = Math.abs(diff - 2*Math.PI);
      if (diff <= CONE_ANGLE/2) {
        damagePlayer(p, owner.stats.abilityDamage, ownerId);
      }
    }
  }
}
function update() {
  for (const id in players) {
    const p = players[id];
    if (p.frozen > 0) p.frozen -= 1;
  }
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
            if (b.freeze) p.frozen = Math.max(p.frozen, b.freeze * 10);
            p.hp -= b.damage;
            if (p.hp <= 0) {
              const killer = players[b.owner];
              if (killer) {
                killer.hp = Math.min(killer.hp + killer.stats.regenOnKill, killer.stats.playerHp);
                killer.score++;
                killer.streak = (killer.streak || 0) + 1;
              }
              p.hp = p.stats.playerHp;
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
    if (!removed) {
      b.life -= 1;
      if (b.life <= 0) removed = true;
    }
    if (removed) bullets.splice(i, 1);
  }

  for (let i = cones.length - 1; i >= 0; i--) {
    cones[i].life -= 1;
    if (cones[i].life <= 0) cones.splice(i, 1);
  }

  for (let i = warnings.length - 1; i >= 0; i--) {
    const w = warnings[i];
    w.timer -= 1;
    if (w.timer <= 0) {
      aoes.push({
        x: w.x,
        y: w.y,
        owner: w.owner,
        radius: w.radius,
        damage: w.damage,
        hits: 1,
        interval: 1,
        tick: 1
      });
      warnings.splice(i, 1);
    }
  }

  for (let i = flames.length - 1; i >= 0; i--) {
    const f = flames[i];
    f.life -= 1;
    f.tick -= 1;
    if (f.tick <= 0) {
      for (const id in players) {
        if (id === f.owner) continue;
        const p = players[id];
        const dx = p.x - f.x;
        const dy = p.y - f.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist > f.range) continue;
        const ang = Math.atan2(dy, dx);
        let diff = Math.abs(ang - f.angle);
        if (diff > Math.PI) diff = Math.abs(diff - 2*Math.PI);
        if (diff <= f.width/2) damagePlayer(p, f.damage, f.owner);
      }
      f.tick = f.interval;
    }
    if (f.life <= 0) flames.splice(i, 1);
  }

  for (let i = aoes.length - 1; i >= 0; i--) {
    const a = aoes[i];
    a.tick -= 1;
    if (a.tick <= 0) {
      for (const id in players) {
        if (id === a.owner) continue;
        const p = players[id];
        const dx = p.x - a.x;
        const dy = p.y - a.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist <= a.radius) damagePlayer(p, a.damage, a.owner);
      }
      a.tick = a.interval;
      a.hits -= 1;
    }
    if (a.hits <= 0) aoes.splice(i, 1);
  }

  // update grappling players
  for (const id in players) {
    const p = players[id];
    if (p.grapple) {
      const gx = p.grapple.x;
      const gy = p.grapple.y;
      const dx = Math.sign(gx - p.x);
      const dy = Math.sign(gy - p.y);
      let nx = p.x + dx * p.stats.grappleSpeed;
      let ny = p.y + dy * p.stats.grappleSpeed;
      if ((dx <= 0 && nx <= gx) || (dx >= 0 && nx >= gx)) nx = gx;
      if ((dy <= 0 && ny <= gy) || (dy >= 0 && ny >= gy)) ny = gy;
      p.x = nx;
      p.y = ny;
      if (p.x === gx && p.y === gy) {
        if (p.grapple.type === 'jump') {
          aoes.push({
            x: p.x,
            y: p.y,
            owner: id,
            radius: p.stats.aoeRadius || 2,
            damage: p.stats.aoeDamage || 5,
            hits: p.stats.aoeHits || 3,
            interval: 1,
            tick: 1
          });
        }
        p.grapple = null;
      }
    }
  }
}
function handleAction(id, action) {
  const p = players[id];
  if (!p) return;
  if (p.frozen > 0) return;
  if (action.type==='move') {
    if (p.grapple) return;
    const dx = action.dx||0; const dy=action.dy||0;
    const nx = p.x + dx * p.stats.playerSpeed; const ny = p.y + dy * p.stats.playerSpeed;
    if (nx>=0&&ny>=0&&nx<MAP_WIDTH&&ny<MAP_HEIGHT&&map[Math.floor(ny)][Math.floor(nx)]===TILE_EMPTY){
      p.x = nx; p.y = ny;
    }
  } else if (action.type==='shoot') {
    addBullet(id, action.dir);
  } else if (action.type==='grapple') {
    if (p.stats.freezeArrow) {
      addFreezeArrow(id, action.dir);
      return;
    }
    const now = Date.now();
    const cooldown = p.stats.grappleCooldown * 1000;
    if (now - p.lastGrapple < cooldown || p.grapple) return;
    const dir = action.dir;
    let dx=0,dy=0;
    if(dir==='up')dy=-1;
    else if(dir==='down')dy=1;
    else if(dir==='left')dx=-1;
    else if(dir==='right')dx=1;
    else if(dir==='upleft'){dx=-1;dy=-1;}
    else if(dir==='upright'){dx=1;dy=-1;}
    else if(dir==='downleft'){dx=-1;dy=1;}
    else if(dir==='downright'){dx=1;dy=1;}
    let cx=Math.floor(p.x), cy=Math.floor(p.y);
    if (p.stats.jump) {
      for(let i=0;i<p.stats.grappleRange;i++){
        cx+=dx; cy+=dy;
        if(cx<0||cy<0||cx>=MAP_WIDTH||cy>=MAP_HEIGHT) { cx-=dx; cy-=dy; break; }
        if(map[cy][cx]===TILE_WALL){ cx-=dx; cy-=dy; break; }
      }
      p.grapple = {x:cx+0.5, y:cy+0.5, type:'jump'};
      p.lastGrapple = now;
    } else {
      for(let i=0;i<p.stats.grappleRange;i++){
        cx+=dx; cy+=dy;
        if(cx<0||cy<0||cx>=MAP_WIDTH||cy>=MAP_HEIGHT)break;
        if(map[cy][cx]===TILE_WALL){
          p.grapple = {x:cx-dx+0.5, y:cy-dy+0.5};
          p.lastGrapple = now;
          break;
        }
      }
    }
  } else if (action.type==='ability') {
    useAbility(id);
  }
}
function gameState(){
  return {players, bullets, cones, flames, aoes, warnings, map};
}

module.exports = {
  generateMap,
  addPlayer,
  removePlayer,
  handleAction,
  update,
  gameState,
  map,
  players,
  bullets,
  cones,
  flames,
  aoes,
  warnings
};
