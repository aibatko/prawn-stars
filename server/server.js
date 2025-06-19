const http = require('http');
const fs = require('fs');
const url = require('url');
const path = require('path');
const game = require('./game');
const configs = require('./config');

const clients = new Map();
const PORT = 3000;

function sendFile(res, filePath, contentType) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404); res.end('Not found');
    } else {
      res.writeHead(200, {'Content-Type': contentType});
      res.end(data);
    }
  });
}

function handleJoin(req, res) {
  let body='';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    let name = 'Player';
    let cls = 'class1';
    try {
      const data = JSON.parse(body);
      if (data.name) name = String(data.name).slice(0, 20);
      if (data.class) cls = String(data.class);
    } catch (_) {}
    const player = game.addPlayer(name, cls);
    const playerCfg = Object.assign({}, configs.game, configs.classes[cls] || configs.classes[Object.keys(configs.classes)[0]]);
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({id: player.id, map: game.map, config: playerCfg}));
  });
}

function handleStream(req, res, id) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  res.write('\n');
  clients.set(id, res);
  req.on('close', () => { clients.delete(id); game.removePlayer(id); });
}

function handleAction(req, res) {
  let body='';
  req.on('data', chunk=> body+=chunk);
  req.on('end', ()=> {
    try{
      const data=JSON.parse(body);
      game.handleAction(data.id, data.action);
    }catch(e){ }
    res.writeHead(200); res.end('ok');
  });
}

function serve(req, res) {
  const parsed = url.parse(req.url, true);
  if (req.method==='GET' && parsed.pathname==='/') {
    sendFile(res, path.join(__dirname,'..','public','index.html'),'text/html');
  } else if (req.method==='GET' && parsed.pathname==='/client.js') {
    sendFile(res, path.join(__dirname,'..','public','client.js'),'application/javascript');
  } else if (req.method==='GET' && parsed.pathname==='/style.css') {
    sendFile(res, path.join(__dirname,'..','public','style.css'),'text/css');
  } else if (req.method==='GET' && parsed.pathname.startsWith('/assets/')) {
    const asset = parsed.pathname.replace(/^\/+/, '');
    sendFile(res, path.join(__dirname, '..', 'public', asset), 'audio/wav');
  } else if (req.method==='POST' && parsed.pathname==='/join') {
    handleJoin(req, res);
  } else if (req.method==='GET' && parsed.pathname==='/stream') {
    const id=parsed.query.id;
    handleStream(req, res, id);
  } else if (req.method==='POST' && parsed.pathname==='/action') {
    handleAction(req, res);
  } else {
    res.writeHead(404); res.end('Not found');
  }
}

game.generateMap();
setInterval(()=>{
  game.update();
  const state=JSON.stringify({type:'state', players: game.players, bullets: game.bullets, cones: game.cones});
  for (const [id, res] of clients.entries()) {
    res.write(`data: ${state}\n\n`);
  }
}, 100);

http.createServer(serve).listen(PORT, '0.0.0.0', () => {
  console.log('Server running on', PORT);
});
