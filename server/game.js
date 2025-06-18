const MAP_WIDTH = 50;
const MAP_HEIGHT = 30;
const TILE_EMPTY = 0;
const TILE_WALL = 1;
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
        map[y][x] = Math.random() < 0.1 ? TILE_WALL : TILE_EMPTY;
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
  players[id] = {id, x, y, hp:10, score:0};
  return players[id];
}
function removePlayer(id) {
  delete players[id];
}
function addBullet(ownerId, dir) {
  const owner = players[ownerId];
  const speed = 1;
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
            p.x=sx; p.y=sy;
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
    const nx = p.x + dx; const ny = p.y + dy;
    if (nx>=0&&ny>=0&&nx<MAP_WIDTH&&ny<MAP_HEIGHT&&map[Math.floor(ny)][Math.floor(nx)]===TILE_EMPTY){
      p.x = nx; p.y = ny;
    }
  } else if (action.type==='shoot') {
    addBullet(id, action.dir);
  } else if (action.type==='grapple') {
    const dir=action.dir;
    let dx=0,dy=0;
    if(dir==='up')dy=-1;else if(dir==='down')dy=1;else if(dir==='left')dx=-1;else if(dir==='right')dx=1;
    let cx=p.x,cy=p.y;
    for(let i=0;i<5;i++){cx+=dx;cy+=dy;if(cx<0||cy<0||cx>=MAP_WIDTH||cy>=MAP_HEIGHT)break; if(map[Math.floor(cy)][Math.floor(cx)]===TILE_WALL){p.x=cx-dx;p.y=cy-dy;break;}}
  }
}
function gameState(){
  return {players, bullets, map};
}
module.exports={generateMap,addPlayer,removePlayer,handleAction,update,gameState,map,players,bullets};
