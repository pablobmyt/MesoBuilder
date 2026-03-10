#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const src = path.resolve(__dirname, '../../data/entity-pixels.json');
const destDir = path.resolve(__dirname, 'bckup');

if (!fs.existsSync(src)) {
  console.error('Source file not found:', src);
  process.exit(1);
}

if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

let last = fs.readFileSync(src, 'utf8');
console.log('Watching', src, 'for changes. Backups will be placed in', destDir);

fs.watchFile(src, { interval: 1000 }, (curr, prev) => {
  if (curr.mtimeMs === prev.mtimeMs) return;
  try {
    const now = fs.readFileSync(src, 'utf8');
    if (now !== last) {
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const dest = path.join(destDir, `entity-pixels.bck.${ts}.json`);
      fs.writeFileSync(dest, last, 'utf8');
      console.log('Saved backup to', dest);
      last = now;
    }
  } catch (e) { console.error('watch error', e); }
});
