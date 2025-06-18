const MAP_WIDTH = 200;
const MAP_HEIGHT = 200;
const TILE_EMPTY = 0;
const TILE_WALL = 1;
const PLAYER_SPEED = 0.2;
const BULLET_SPEED = 0.5;
const players = {};
const bullets = [];
let nextPlayerId = 1;
const map = [];
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
function addPlayer() {
  let x, y;
  do {
    x = Math.floor(Math.random() * MAP_WIDTH);
    y = Math.floor(Math.random() * MAP_HEIGHT);
  } while (map[y][x] !== TILE_EMPTY);
  const id = String(nextPlayerId++);
  players[id] = {id, x: x + 0.5, y: y + 0.5, hp:10, score:0};
  return players[id];
}
function removePlayer(id) {
  delete players[id];
}
function addBullet(ownerId, dir) {
  const owner = players[ownerId];
  const speed = BULLET_SPEED;
  const vel = {x:0,y:0};
  if (dir==='up') vel.y=-speed;
  else if (dir==='down') vel.y=speed;
  else if (dir==='left') vel.x=-speed;
  else if (dir==='right') vel.x=speed;
  bullets.push({x:owner.x, y:owner.y, vx:vel.x, vy:vel.y, owner:ownerId});
}
function update() {
  // update bullets
  for (let i=bullets.length-1;i>=0;i--) {
    const b = bullets[i];
    b.x += b.vx;
    b.y += b.vy;
    if (b.x<0||b.y<0||b.x>=MAP_WIDTH||b.y>=MAP_HEIGHT) { bullets.splice(i,1); continue; }
    if (map[Math.floor(b.y)][Math.floor(b.x)]===TILE_WALL){ bullets.splice(i,1); continue; }
    for (const id in players) {
      const p=players[id];
      if (Math.floor(p.x)===Math.floor(b.x)&&Math.floor(p.y)===Math.floor(b.y)) {
        if (id!==b.owner){
          p.hp-=1;
          if (p.hp<=0){
            const killer=players[b.owner];
            if(killer){killer.hp=10;killer.score++;}
            p.hp=10;
            let sx,sy;
            do{ sx=Math.floor(Math.random()*MAP_WIDTH); sy=Math.floor(Math.random()*MAP_HEIGHT);}while(map[sy][sx]!==TILE_EMPTY);
            p.x=sx+0.5; p.y=sy+0.5;
          }
          bullets.splice(i,1); break;
        }
      }
    }
  }
}
function handleAction(id, action) {
  const p = players[id];
  if (!p) return;
  if (action.type==='move') {
    const dx = action.dx||0; const dy=action.dy||0;
    const nx = p.x + dx * PLAYER_SPEED; const ny = p.y + dy * PLAYER_SPEED;
    if (nx>=0&&ny>=0&&nx<MAP_WIDTH&&ny<MAP_HEIGHT&&map[Math.floor(ny)][Math.floor(nx)]===TILE_EMPTY){
      p.x = nx; p.y = ny;
    }
  } else if (action.type==='shoot') {
    addBullet(id, action.dir);
  } else if (action.type==='grapple') {
    const dir=action.dir;
    let dx=0,dy=0;
    if(dir==='up')dy=-1;else if(dir==='down')dy=1;else if(dir==='left')dx=-1;else if(dir==='right')dx=1;
    let cx=Math.floor(p.x), cy=Math.floor(p.y);
    for(let i=0;i<5;i++){
      cx+=dx; cy+=dy;
      if(cx<0||cy<0||cx>=MAP_WIDTH||cy>=MAP_HEIGHT)break;
      if(map[cy][cx]===TILE_WALL){
        p.x=cx-dx+0.5;
        p.y=cy-dy+0.5;
        break;
      }
    }
  }
}
function gameState(){
  return {players, bullets, map};
}
module.exports={generateMap,addPlayer,removePlayer,handleAction,update,gameState,map,players,bullets};
