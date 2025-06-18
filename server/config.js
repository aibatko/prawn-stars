const fs = require('fs');
const path = require('path');

function loadConfig() {
  const file = path.join(__dirname, 'config.yml');
  const cfg = {
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
    grappleCooldown: 5,
    abilityCooldown: 5,
    abilityDamage: 6,
    abilityRange: 4
  };
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

module.exports = loadConfig();
