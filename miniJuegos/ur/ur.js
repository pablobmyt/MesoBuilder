(()=>{
  const canvas = document.getElementById('board');
  const ctx = canvas.getContext('2d');
  const btnNew = document.getElementById('btn-new');
  const btnRoll = document.getElementById('btn-roll');
  const status = document.getElementById('status');
  const turnName = document.getElementById('turnName');
  const potEl = document.getElementById('pot');
  const movesEl = document.getElementById('moves');
  const p0info = document.getElementById('p0-info');
  const p1info = document.getElementById('p1-info');

  const rulesModal = document.getElementById('rulesModal');
  document.getElementById('btn-rules').addEventListener('click', ()=> rulesModal.classList.remove('hidden'));
  document.getElementById('closeRules').addEventListener('click', ()=> rulesModal.classList.add('hidden'));

  // Board config
  const TRACK_LEN = 14; // main linear track indices 0..13
  const ROSETTES = new Set([3,7,13]); // 0-based positions (4,8,14)
  const ENTRY_MAP = { // pieceType -> entry index (0-based)
    0: 3, // Golondrina -> 4
    1: 4, // Ave de la Tormenta -> 5
    2: 5, // Cuervo -> 6
    3: 6, // Gallo -> 7
    4: 9  // Aguila -> 10
  };
  const PIECE_VALUE = [3,4,4,4,5];

  function makePlayer(name, color){
    return { name, color, pieces: Array.from({length:5}, (_,i)=>({type:i, pos:null, atHome:false})), score:0 };
  }

  let players = [makePlayer('Blanco','#ffffff'), makePlayer('Negro','#000000')];
  let turn = 0; // index
  let pot = 20; // both put 10 each by default
  let lastRoll = null;

  function reset(){
    players = [makePlayer('Blanco','#ffffff'), makePlayer('Negro','#000000')];
    turn = 0; pot = 20; lastRoll = null; updateInfo(); draw();
  }

  function updateInfo(){
    turnName.textContent = players[turn].name;
    potEl.textContent = pot;
    p0info.textContent = `Piezas en tablero: ${players[0].pieces.filter(p=>p.pos!==null && !p.atHome).length}`;
    p1info.textContent = `Piezas en tablero: ${players[1].pieces.filter(p=>p.pos!==null && !p.atHome).length}`;
  }

  function rollDice(){
    const primary = Math.floor(Math.random()*4)+1; // 1-4
    const yn = Math.random() < 0.5; // yes/no
    const value = yn ? ({1:5,2:6,3:7,4:10})[primary] : primary;
    lastRoll = { primary, yn, value };
    return lastRoll;
  }

  function canEnterPiece(player, pieceIndex, rollValue){
    const piece = players[player].pieces[pieceIndex];
    if (piece.pos !== null || piece.atHome) return false;
    // Golondrina enters with 2
    if (piece.type === 0) return (rollValue === 2) || (lastRoll && lastRoll.primary===2 && !lastRoll.yn && lastRoll.value===2);
    // others require converted roll matching entry start (5/6/7/10)
    return (rollValue === ENTRY_MAP[piece.type]+1) || (lastRoll && lastRoll.yn && lastRoll.value === ENTRY_MAP[piece.type]+1);
  }

  function possibleMovesForPlayer(player, rollValue){
    const moves = [];
    const pl = players[player];
    // entering
    for(let i=0;i<pl.pieces.length;i++){
      const piece = pl.pieces[i];
      if (piece.pos===null && !piece.atHome){
        const entry = ENTRY_MAP[piece.type];
        // interpret rollValue==2 for golondrina, or converted values for others
        if (piece.type===0 && rollValue===2) moves.push({piece:i,to:entry,enter:true});
        else if (piece.type!==0 && [5,6,7,10].includes(rollValue) && rollValue === (entry+1)) moves.push({piece:i,to:entry,enter:true});
      }
    }
    // movement for on-board pieces
    for(let i=0;i<pl.pieces.length;i++){
      const piece = pl.pieces[i];
      if (piece.pos!==null && !piece.atHome){
        const target = piece.pos + rollValue;
        if (target > TRACK_LEN) continue; // overshoot
        if (target === TRACK_LEN){ // exact exit
          moves.push({piece:i,to:'exit'});
        } else if (target < TRACK_LEN){
          moves.push({piece:i,to:target});
        }
      }
    }
    return moves;
  }

  function pieceAt(pos){
    const out = [];
    for(let p=0;p<2;p++){
      players[p].pieces.forEach((pc, idx)=>{ if (pc.pos===pos && !pc.atHome) out.push({player:p,index:idx,pc}); });
    }
    return out;
  }

  function applyMove(move){
    const pl = players[turn];
    const piece = pl.pieces[move.piece];
    if (move.enter){
      piece.pos = move.to;
      // landing actions below
    } else if (move.to === 'exit'){
      piece.pos = null; piece.atHome = true;
    } else {
      piece.pos = move.to;
    }
    // landing effects
    if (move.to !== 'exit'){
      if (ROSETTES.has(move.to)){
        // collect pot per piece value
        const gain = PIECE_VALUE[piece.type] || 1; pot = Math.max(0, pot - gain); pl.score += gain;
      }
      // capture
      const occupants = pieceAt(move.to).filter(o => o.player !== turn);
      if (occupants.length && !ROSETTES.has(move.to)){
        // capture first occupant (send home)
        const occ = occupants[0];
        players[occ.player].pieces[occ.index].pos = null; // restart
      }
    }
  }

  function nextTurn(){ turn = 1 - turn; lastRoll = null; updateInfo(); draw(); }

  function draw(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.font = '12px sans-serif'; ctx.fillStyle='#222';
    // draw squares linear
    const margin = 12; const square = 48; const gap = 6; const startX = margin; const startY = 24;
    // draw track
    for(let i=0;i<TRACK_LEN;i++){
      const x = startX + i*(square+gap);
      ctx.fillStyle = ROSETTES.has(i) ? '#f5e6c4' : '#fff';
      ctx.fillRect(x, startY, square, square);
      ctx.strokeStyle = '#333'; ctx.strokeRect(x, startY, square, square);
      ctx.fillStyle = '#222'; ctx.fillText(String(i+1), x+6, startY+12);
    }
    // draw pieces
    for(let p=0;p<2;p++){
      players[p].pieces.forEach((pc, idx)=>{
        if (pc.pos===null) return;
        const x = startX + pc.pos*(square+gap) + square/2; const y = startY + square/2 + (p===0? -12:12)+ idx*2;
        ctx.beginPath(); ctx.fillStyle = players[p].color; ctx.arc(x,y,10,0,Math.PI*2); ctx.fill(); ctx.strokeStyle='#000'; ctx.stroke();
      });
    }
    updateInfo();
  }

  // UI handlers
  btnNew.addEventListener('click', ()=>{ reset(); status.textContent='Partida nueva'; });
  btnRoll.addEventListener('click', ()=>{
    if (lastRoll) return; // already rolled
    const r = rollDice();
    status.textContent = `Tirada: ${r.primary} ${r.yn?'+convert('+r.value+')':'(no convert)'} => ${r.value}`;
    const moves = possibleMovesForPlayer(turn, r.value);
    if (moves.length===0){ status.textContent += ' — Sin movimientos, pasa turno.'; setTimeout(()=> nextTurn(), 800); return; }
    // show moves
    movesEl.innerHTML = '';
    moves.forEach((m, i)=>{
      const btn = document.createElement('button');
      btn.textContent = m.enter ? `Entrar pieza ${m.piece+1} → casilla ${m.to+1}` : (m.to==='exit' ? `Sacar pieza ${m.piece+1}` : `Mover pieza ${m.piece+1} → ${m.to+1}`);
      btn.addEventListener('click', ()=>{ applyMove(m); movesEl.innerHTML=''; draw(); setTimeout(()=> nextTurn(), 350); });
      movesEl.appendChild(btn);
    });
  });

  // initial
  reset();
  draw();
})();
