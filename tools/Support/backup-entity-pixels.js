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

const ts = new Date().toISOString().replace(/[:.]/g, '-');
const dest = path.join(destDir, `entity-pixels.bck.${ts}.json`);
fs.copyFileSync(src, dest);
console.log('Backed up entity-pixels.json to', dest);
