const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'engine', 'game-engine.js');
const txt = fs.readFileSync(file, 'utf8');
const lines = txt.split('\n');

function posToLineCol(pos) {
  let line = 1, col = 1, p = 0;
  for (; p < pos; p++) {
    if (txt[p] === '\n') { line++; col = 1; } else col++;
  }
  return { line, col };
}

const re = /try\s*\{/g;
let m;
const problems = [];
while ((m = re.exec(txt)) !== null) {
  const start = m.index;
  // lookahead window
  const window = txt.slice(start, Math.min(txt.length, start + 5000));
  if (!/\bcatch\b|\bfinally\b/.test(window)) {
    problems.push({ start, snippet: window.slice(0,300) });
  } else {
    // ensure catch/finally appears after the matching closing brace of try-block
    // naive approach: find first 'catch' or 'finally' after start
    const catchIdx = window.search(/\bcatch\b|\bfinally\b/);
    if (catchIdx === -1) problems.push({ start, snippet: window.slice(0,300) });
  }
}

if (problems.length === 0) {
  console.log('No obvious try { without catch/finally found in scan window.');
  process.exit(0);
}
console.log('Potential issues found: ' + problems.length);
for (const p of problems) {
  const lc = posToLineCol(p.start);
  console.log(`--- at ${lc.line}:${lc.col} ---`);
  console.log(p.snippet.replace(/\n/g,'\n'));
  console.log('-----------------------');
}
process.exit(0);
