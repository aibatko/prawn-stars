const fs = require('fs');
const path = require('path');

const CONFIG_DIR = path.join(__dirname, 'configs');

function parseFile(file) {
  const cfg = {};
  try {
    const data = fs.readFileSync(file, 'utf8');
    data.split(/\r?\n/).forEach(line => {
      const t = line.trim();
      if (!t || t.startsWith('#')) return;
      const [k, v] = t.split(/:\s*/);
      cfg[k] = parseFloat(v);
    });
  } catch (_) {}
  return cfg;
}

function loadConfigs() {
  const files = fs.readdirSync(CONFIG_DIR);
  const game = parseFile(path.join(CONFIG_DIR, 'game.yml'));
  const classes = {};
  files.forEach(f => {
    if (f === 'game.yml' || !f.endsWith('.yml')) return;
    const name = f.replace(/\.yml$/, '');
    classes[name] = parseFile(path.join(CONFIG_DIR, f));
  });
  return { game, classes };
}

module.exports = loadConfigs();
