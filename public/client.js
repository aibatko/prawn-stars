const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const tileSize = 16;
let playerId = null;
let map = [];
let players = {};
let bullets = [];
let lastHp = 10;
const keys = {};
const prevPlayers = {};
let animations = [];
const sndShoot = new Audio('assets/shoot.wav');
const sndKill = new Audio('assets/kill.wav');
const sndDie = new Audio('assets/die.wav');

function draw() {
  ctx.clearRect(0,0,canvas.width,canvas.height);

  const tilesX = canvas.width/tileSize;
  const tilesY = canvas.height/tileSize;
  const me = players[playerId];
  let camX=0, camY=0;
  if(me){
    camX = me.x - tilesX/2;
    camY = me.y - tilesY/2;
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
    const px=(p.x - camX)*tileSize;
    const py=(p.y - camY)*tileSize;
    ctx.fillStyle=id===playerId?'#0f0':'#f00';
    ctx.beginPath();
    ctx.arc(px, py, tileSize/2-2,0,Math.PI*2);
    ctx.fill();
    // health bar
    ctx.fillStyle='#000';
    ctx.fillRect(px - tileSize/2, py - tileSize/2 - 4, tileSize, 3);
    ctx.fillStyle='#0f0';
    ctx.fillRect(px - tileSize/2, py - tileSize/2 - 4, tileSize*(p.hp/10), 3);
  }
  ctx.fillStyle='#ff0';
  bullets.forEach(b=>{
    ctx.fillRect((b.x - camX)*tileSize-2,(b.y - camY)*tileSize-2,4,4);
  });
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

  if(me && keys[' ']){
    drawGrapplePreview(me, camX, camY);
  }
  requestAnimationFrame(draw);
}

function send(action){
  fetch('/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:playerId,action})});
}

function setupInput(){
  window.addEventListener('keydown',e=>{
    if(e.ctrlKey && ['-','_','+','=','0'].includes(e.key)) e.preventDefault();
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
    if(keys[' ']){
      if(keys['i'])send({type:'grapple',dir:'up'});
      if(keys['k'])send({type:'grapple',dir:'down'});
      if(keys['j'])send({type:'grapple',dir:'left'});
      if(keys['l'])send({type:'grapple',dir:'right'});
    }
  },100);
}
function drawGrapplePreview(me, camX, camY){
  ctx.fillStyle='rgba(255,255,255,0.3)';
  const dirs=[{x:0,y:-1},{x:0,y:1},{x:-1,y:0},{x:1,y:0}];
  for(const d of dirs){
    let cx=Math.floor(me.x), cy=Math.floor(me.y);
    for(let i=0;i<5;i++){
      cx+=d.x; cy+=d.y;
      if(cx<0||cy<0||cx>=map[0].length||cy>=map.length) break;
      ctx.fillRect((cx - camX)*tileSize+4, (cy - camY)*tileSize+4, tileSize-8, tileSize-8);
      if(map[cy][cx]===1) break;
    }
  }
}

function drawGrapplePreview(me, camX, camY){
  ctx.fillStyle='rgba(255,255,255,0.3)';
  const dirs=[{x:0,y:-1},{x:0,y:1},{x:-1,y:0},{x:1,y:0}];
  for(const d of dirs){
    let cx=Math.floor(me.x), cy=Math.floor(me.y);
    for(let i=0;i<5;i++){
      cx+=d.x; cy+=d.y;
      if(cx<0||cy<0||cx>=map[0].length||cy>=map.length) break;
      ctx.fillRect((cx - camX)*tileSize+4, (cy - camY)*tileSize+4, tileSize-8, tileSize-8);
      if(map[cy][cx]===1) break;
    }
  }
}

function start(){
  fetch('/join',{method:'POST'}).then(r=>r.json()).then(data=>{
    playerId=data.id; map=data.map;
    const es=new EventSource('/stream?id='+playerId);
    es.onmessage=ev=>{
      const state=JSON.parse(ev.data);
      players=state.players;bullets=state.bullets;
      for(const id in state.players){
        const p=state.players[id];
        const prev=prevPlayers[id];
        if(prev && p.hp===10 && prev.hp<10 && (p.x!==prev.x || p.y!==prev.y)){
          animations.push({x:prev.x,y:prev.y,t:0});
        }
        prevPlayers[id]={x:p.x,y:p.y,hp:p.hp};
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
