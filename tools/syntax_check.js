const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'engine', 'game-engine.js');
const txt = fs.readFileSync(file, 'utf8');
try {
  new Function(txt);
  console.log('Syntax OK');
} catch (e) {
  console.error('Syntax error:', e.message);
  if (e.stack) console.error(e.stack);
}
