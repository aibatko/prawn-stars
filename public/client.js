const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const tileSize = 16;
let playerId = null;
let map = [];
let players = {};
let bullets = [];
let lastHp = 10;
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
  }
  ctx.fillStyle='#ff0';
  bullets.forEach(b=>{
    ctx.fillRect(b.x*tileSize,b.y*tileSize,4,4);
  });
  requestAnimationFrame(draw);
}

function send(action){
  fetch('/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:playerId,action})});
}

function setupInput(){
  const keys={};
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

function start(){
  fetch('/join',{method:'POST'}).then(r=>r.json()).then(data=>{
    playerId=data.id; map=data.map;
    const es=new EventSource('/stream?id='+playerId);
    es.onmessage=ev=>{
      const state=JSON.parse(ev.data);
      players=state.players;bullets=state.bullets;
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
