const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const board = document.getElementById('leaderboard');
const bctx = board.getContext('2d');
const tileSize = 16;
function resize(){
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  board.width = 160;
  board.height = 100;
}
window.addEventListener('resize', resize);
resize();
let playerId = null;
let map = [];
let players = {};
let bullets = [];
let lastHp = 10;
const keys = {};
const prevPlayers = {};
let smoothPrev = {};
let lastUpdate = Date.now();
let animations = [];
let grappleAnims = [];
let config = {
  playerSpeed: 0.2,
  bulletSpeed: 0.5,
  reloadTime: 0.3,
  grappleSpeed: 1,
  grappleRange: 5,
  mapWidth: 100,
  mapHeight: 50,
  bulletDamage: 1,
  playerHp: 10,
  regenOnKill: 10,
  grappleCooldown: 5
};
const sndShoot = new Audio('assets/shoot.wav');
const sndKill = new Audio('assets/kill.wav');
const sndDie = new Audio('assets/die.wav');

function draw() {
  ctx.clearRect(0,0,canvas.width,canvas.height);

  const tilesX = canvas.width/tileSize;
  const tilesY = canvas.height/tileSize;
  const t = Math.min(1,(Date.now()-lastUpdate)/100);
  const me = players[playerId];
  let camX=0, camY=0, mx=0, my=0;
  if(me){
    const prev = smoothPrev[playerId] || me;
    mx = prev.x + (me.x - prev.x)*t;
    my = prev.y + (me.y - prev.y)*t;
    camX = mx - tilesX/2;
    camY = my - tilesY/2;
    const maxX = map[0].length - tilesX;
    const maxY = map.length - tilesY;
    camX = Math.max(0, Math.min(camX, maxX));
    camY = Math.max(0, Math.min(camY, maxY));
  }

  const startX = Math.floor(camX);
  const startY = Math.floor(camY);

  for (let y=startY; y<startY+tilesY+1; y++){
    for(let x=startX; x<startX+tilesX+1; x++){
      if(map[y] && map[y][x]===1){
        ctx.fillStyle='#555';
        ctx.fillRect((x-camX)*tileSize,(y-camY)*tileSize,tileSize,tileSize);
      }
    }
  }

  for(const id in players){
    const p=players[id];
    const prev=smoothPrev[id]||p;
    const px=(prev.x + (p.x-prev.x)*t - camX)*tileSize;
    const py=(prev.y + (p.y-prev.y)*t - camY)*tileSize;
    ctx.fillStyle=id===playerId?'#0f0':'#f00';
    ctx.beginPath();
    ctx.arc(px, py, tileSize/2-2,0,Math.PI*2);
    ctx.fill();
    // health bar
    ctx.fillStyle='#000';
    ctx.fillRect(px - tileSize/2, py - tileSize/2 - 4, tileSize, 3);
    ctx.fillStyle='#0f0';
    ctx.fillRect(px - tileSize/2, py - tileSize/2 - 4, tileSize*(p.hp/config.playerHp), 3);
  }
  ctx.fillStyle='#ff0';
  bullets.forEach(b=>{
    ctx.fillRect((b.x - camX)*tileSize-2,(b.y - camY)*tileSize-2,4,4);
  });
  // grapple lines
  ctx.strokeStyle = '#0ff';
  ctx.lineWidth = 2;
  grappleAnims.forEach(g=>{
    const p = players[g.id];
    if(!p){ g.t=100; return; }
    ctx.beginPath();
    ctx.moveTo((p.x - camX)*tileSize,(p.y - camY)*tileSize);
    ctx.lineTo((g.tx - camX)*tileSize,(g.ty - camY)*tileSize);
    ctx.stroke();
    g.t++;
  });
  grappleAnims = grappleAnims.filter(g=>g.t<5);
  // death animations
  animations.forEach(a=>{
    const alpha = 1 - a.t/10;
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.beginPath();
    ctx.arc((a.x - camX)*tileSize, (a.y - camY)*tileSize, tileSize*(a.t/10+0.5), 0, Math.PI*2);
    ctx.fill();
    a.t++;
  });
  animations = animations.filter(a=>a.t<10);

  if(me && (keys['ArrowUp']||keys['ArrowDown']||keys['ArrowLeft']||keys['ArrowRight'])){
    drawGrapplePreview({x:mx,y:my}, camX, camY);
  }
  drawLeaderboard();
/// help
  if(me){
    const cd = config.grappleCooldown*1000 - (Date.now() - me.lastGrapple);
    ctx.fillStyle='#fff';
    ctx.font='16px sans-serif';
    ctx.textBaseline='top';
    ctx.textAlign='left';
    if(cd<=0) ctx.fillText('Grapple ready',10,10);
    else ctx.fillText('Grapple: '+Math.ceil(cd/1000)+'s',10,10);
  }
  requestAnimationFrame(draw);
}

function send(action){
  fetch('/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:playerId,action})});
}

function setupInput(){
  window.addEventListener('keydown',e=>{
    if(e.ctrlKey && ['-','_','+','=','0'].includes(e.key)) e.preventDefault();
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) e.preventDefault();
  });
  window.addEventListener('wheel',e=>{ if(e.ctrlKey) e.preventDefault(); },{passive:false});
  document.addEventListener('keydown',e=>{keys[e.key]=true;});
  document.addEventListener('keyup',e=>{keys[e.key]=false;});
  setInterval(()=>{
    if(!playerId) return;
    let dx=0,dy=0;
    if(keys['w'])dy-=1;
    if(keys['s'])dy+=1;
    if(keys['a'])dx-=1;
    if(keys['d'])dx+=1;
    if(dx||dy) send({type:'move',dx,dy});
    if(keys['i']){send({type:'shoot',dir:'up'}); sndShoot.play();}
    if(keys['k']){send({type:'shoot',dir:'down'}); sndShoot.play();}
    if(keys['j']){send({type:'shoot',dir:'left'}); sndShoot.play();}
    if(keys['l']){send({type:'shoot',dir:'right'}); sndShoot.play();}
    if(keys['ArrowUp'])send({type:'grapple',dir:'up'});
    if(keys['ArrowDown'])send({type:'grapple',dir:'down'});
    if(keys['ArrowLeft'])send({type:'grapple',dir:'left'});
    if(keys['ArrowRight'])send({type:'grapple',dir:'right'});
  },100);
}
function drawGrapplePreview(me, camX, camY){
  ctx.fillStyle='rgba(255,255,255,0.3)';
  const dirs=[{x:0,y:-1},{x:0,y:1},{x:-1,y:0},{x:1,y:0}];
  for(const d of dirs){
    let cx=Math.floor(me.x), cy=Math.floor(me.y);
    for(let i=0;i<(config.grappleRange||5);i++){
      cx+=d.x; cy+=d.y;
      if(cx<0||cy<0||cx>=map[0].length||cy>=map.length) break;
      ctx.fillRect((cx - camX)*tileSize+4, (cy - camY)*tileSize+4, tileSize-8, tileSize-8);
      if(map[cy][cx]===1) break;
    }
  }
}

function drawLeaderboard(){
  const arr = Object.values(players).sort((a,b)=> (b.score||0) - (a.score||0));
  board.height = 20 + arr.length*14;
  bctx.clearRect(0,0,board.width,board.height);
  bctx.fillStyle = 'rgba(0,0,0,0.6)';
  bctx.fillRect(0,0,board.width,board.height);
  bctx.fillStyle='#fff';
  bctx.font='12px sans-serif';
  let y=14;
  for(const p of arr){
    bctx.fillStyle='#fff';
    bctx.fillText(p.name||p.id,4,y);
    bctx.fillText(String(p.score||0),100,y);
    bctx.fillStyle='#f00';
    bctx.fillText(String(p.streak||0),130,y);
    y+=14;
  }
}

function start(){
  const name = prompt('Enter your name');
  fetch('/join',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name})}).then(r=>r.json()).then(data=>{
    playerId=data.id; map=data.map; config=data.config||config;
    lastHp = config.playerHp;
    const es=new EventSource('/stream?id='+playerId);
    es.onmessage=ev=>{
      const state=JSON.parse(ev.data);
      smoothPrev={};
      for(const id in state.players){
        if(players[id]) smoothPrev[id]={x:players[id].x,y:players[id].y};
        else smoothPrev[id]={x:state.players[id].x,y:state.players[id].y};
      }
      players=state.players;bullets=state.bullets;lastUpdate=Date.now();
      for(const id in state.players){
        const p=state.players[id];
        const prev=prevPlayers[id];
        if(prev && !prev.grapple && p.grapple){
          grappleAnims.push({id,tx:p.grapple.x,ty:p.grapple.y,t:0});
        }
        if(prev && p.hp===config.playerHp && prev.hp<config.playerHp && (p.x!==prev.x || p.y!==prev.y)){
          animations.push({x:prev.x,y:prev.y,t:0});
        }
        prevPlayers[id]={x:p.x,y:p.y,hp:p.hp,grapple:p.grapple};
      }
      for(const id in prevPlayers){
        if(!state.players[id]) delete prevPlayers[id];
      }
      const me=players[playerId];
      if(me){
        if(me.hp<lastHp) sndDie.play();
        else if(me.hp>lastHp) sndKill.play();
        lastHp=me.hp;
      }
    };
    draw();
    setupInput();
  });
}
start();
