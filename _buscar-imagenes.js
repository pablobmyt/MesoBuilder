// Busca imágenes recientes en las carpetas de VS Code y temporales (uso puntual).
const fs = require('fs');
const path = require('path');

const raices = [
  path.join(process.env.APPDATA || '', 'Code', 'User'),
  path.join(process.env.TEMP || ''),
  path.join(process.env.LOCALAPPDATA || '', 'Temp')
];
const limiteMs = Number(process.argv[2] || 6) * 3600000;
const ahora = Date.now();
const encontradas = [];

function walk(dir, nivel) {
  if (nivel > 7) return;
  let entradas;
  try { entradas = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
  for (const e of entradas) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (/node_modules|\.git|GPUCache|Code Cache|CachedData|Cache|logs/i.test(e.name)) continue;
      walk(f, nivel + 1);
    } else if (/\.(png|jpe?g|webp)$/i.test(e.name)) {
      try {
        const s = fs.statSync(f);
        if (s.size > 15000 && (ahora - s.mtimeMs) < limiteMs) {
          encontradas.push({ t: s.mtimeMs, kb: Math.round(s.size / 1024), f });
        }
      } catch (x) { /* ignore */ }
    }
  }
}

for (const r of raices) walk(r, 0);
encontradas.sort((a, b) => b.t - a.t);
for (const x of encontradas.slice(0, 40)) {
  console.log(new Date(x.t).toISOString().slice(0, 19), String(x.kb).padStart(6) + ' KB', x.f);
}
console.log('total: ' + encontradas.length);
