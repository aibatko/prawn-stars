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
  for (let y=0;y<map.length;y++){
    for(let x=0;x<map[y].length;x++){
      if(map[y][x]===1){
        ctx.fillStyle='#555';
        ctx.fillRect(x*tileSize,y*tileSize,tileSize,tileSize);
      }
    }
  }
  for(const id in players){
    const p=players[id];
    ctx.fillStyle=id===playerId?'#0f0':'#f00';
    ctx.fillRect(p.x*tileSize,p.y*tileSize,tileSize,tileSize);
    // health bar
    ctx.fillStyle='#000';
    ctx.fillRect(p.x*tileSize, p.y*tileSize-4, tileSize, 3);
    ctx.fillStyle='#0f0';
    ctx.fillRect(p.x*tileSize, p.y*tileSize-4, tileSize*(p.hp/10), 3);
  }
  ctx.fillStyle='#ff0';
  bullets.forEach(b=>{
    ctx.fillRect(b.x*tileSize,b.y*tileSize,4,4);
  });
  // death animations
  animations.forEach(a=>{
    const alpha = 1 - a.t/10;
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.beginPath();
    ctx.arc((a.x+0.5)*tileSize, (a.y+0.5)*tileSize, tileSize*(a.t/10+0.5), 0, Math.PI*2);
    ctx.fill();
    a.t++;
  });
  animations = animations.filter(a=>a.t<10);

  const me = players[playerId];
  if(me && keys[' ']){
    drawGrapplePreview(me);
  }
  requestAnimationFrame(draw);
}

function send(action){
  fetch('/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:playerId,action})});
}

function setupInput(){
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

function drawGrapplePreview(me){
  ctx.fillStyle='rgba(255,255,255,0.3)';
  const dirs=[{x:0,y:-1},{x:0,y:1},{x:-1,y:0},{x:1,y:0}];
  for(const d of dirs){
    let cx=me.x, cy=me.y;
    for(let i=0;i<5;i++){
      cx+=d.x; cy+=d.y;
      if(cx<0||cy<0||cx>=map[0].length||cy>=map.length) break;
      ctx.fillRect(cx*tileSize+4, cy*tileSize+4, tileSize-8, tileSize-8);
      if(map[Math.floor(cy)][Math.floor(cx)]===1) break;
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
