const ROWS = 5, COLS = 4;
const CELL_SIZE = 120;
let tileGrid = [];              // Matriz lógica que representa el tablero
let activeTile = null;          // Bloque que está cayendo o en tiempo de gracia
let score = 0, moves = 0, gameOver = false;
let nextId = 1, startTime = null;
let dropInterval = 120;         // Velocidad de caída

//Tiempo de gracia después de la fusión-
const GRACE_MS = 1200;          // Tiempo disponible para mover lateral tras fusión
let inMergeGrace = false;       // Flag para indicar si se está en la ventana
let graceTimer = null;          // Timer que controla la duración

//Música
const music = document.getElementById("bg-music");
const musicBtn = document.getElementById("musicBtn");
let musicEnabled = false;
music.volume = 0.3;
musicBtn.addEventListener("click", ()=>{
  // Toggle entre encender y apagar música
  musicEnabled = !musicEnabled;
  if (musicEnabled) {
    music.play().catch(()=>{});
    musicBtn.textContent="🔊 Música";
  } else {
    music.pause();
    musicBtn.textContent="🔇 Música";
  }
});

//Dificultad
const difficultySelect = document.getElementById("difficulty");
const diffLabel = document.getElementById("currentDiff");

// dificultad inicial
setDifficulty(difficultySelect.value);

// Cambio de dificultad desde el select
difficultySelect.addEventListener("change", ()=>{
  setDifficulty(difficultySelect.value);
});

function setDifficulty(val){
  // Muestra el nombre en pantalla y ajusta velocidad de caída
  diffLabel.textContent = val.charAt(0).toUpperCase()+val.slice(1);
  switch(val){
    case "easy": dropInterval = 500; break;
    case "medium": dropInterval = 300; break;
    case "hard": dropInterval = 200; break;
    case "expert": dropInterval = 120; break;
  }
}

//Inicio
window.addEventListener("load", startGame);
document.getElementById("restartBtn").addEventListener("click", startGame);
document.getElementById("summaryBtn").addEventListener("click", showSummary);

function startGame(){
  // Reinicia tablero y variables
  const board = document.getElementById("board");
  board.innerHTML = "";
  score = 0; moves = 0; gameOver=false; activeTile=null;
  inMergeGrace = false;
  clearTimeout(graceTimer); graceTimer=null;

  startTime=Date.now();
  document.getElementById("score").innerText=score;
  document.getElementById("overlay").classList.add("hidden");

  // Crea grid vacío
  tileGrid = Array.from({length: ROWS}, ()=>Array(COLS).fill(null));

  // Spawnea primer bloque
  spawnNewTile();
  lastTime = 0;
  requestAnimationFrame(gameLoop);
}

//Utilidades
function toTranslate(r,c){ return `translate(${c*CELL_SIZE}px, ${r*CELL_SIZE}px)`; }
function classForValue(v){ return "x"+(v<=8192?v:8192); }

function createTile(value,r,c){
  // Crea un div visual y devuelve objeto bloque
  const tile=document.createElement("div");
  tile.className=`tile ${classForValue(value)}`;
  tile.textContent=value;
  tile.style.transform=toTranslate(r,c);
  document.getElementById("board").appendChild(tile);
  return {id: nextId++, value, r, c, div: tile};
}

function resetGraceTimer() {
  // Reinicia el temporizador del tiempo de gracia
  clearTimeout(graceTimer);
  graceTimer = setTimeout(()=>{
    // Cuando se acaba la gracia se pierde control y aparece nuevo bloque
    inMergeGrace = false;
    activeTile = null;
    spawnNewTile();
  }, GRACE_MS);
}

//Spawn
function spawnNewTile(){
  // Determina el mayor valor en el tablero para spawnear el 8
  let maxVal=0;
  for(let r=0;r<ROWS;r++)
    for(let c=0;c<COLS;c++)
      if(tileGrid[r][c] && tileGrid[r][c].value>maxVal) maxVal=tileGrid[r][c].value;

  // Valores más altos solo si ya existe un bloque >=128
  const value = (maxVal>=128)
    ? [2,4,8][Math.floor(Math.random()*3)]
    : (Math.random()<0.9?2:4);

  // Escoge columna aleatoria
  const c=Math.floor(Math.random()*COLS);

  // Si está ocupado arriba: fin de juego
  if(tileGrid[0][c]) return endGame("Sin espacio", `Fila superior llena. Puntaje: ${score}.`);

  // Crea tile activo en la fila superior
  activeTile = createTile(value, 0, c);
}

//Entrada
document.addEventListener("keydown",(e)=>{
  if(gameOver || !activeTile) return;
  if(musicEnabled && music.paused) music.play().catch(()=>{});

  // Movimientos básicos
  if(e.code==="ArrowLeft") { tryMove(-1); moves++; }
  else if(e.code==="ArrowRight") { tryMove(1); moves++; }
  else if(e.code==="ArrowDown") { 
    // Solo baja manual si no estamos en gracia
    if(!inMergeGrace) { dropStep(); moves++; } 
  }
});

//Movimiento horizontal y fusiones laterales
function tryMove(dc){
  const t = activeTile;
  const nc = t.c+dc;
  if(nc<0 || nc>=COLS) return; // fuera de tablero

  // En ventana de gracia: permite mover y fusionar lateralmente
  if (inMergeGrace) {
    const neighbor = tileGrid[t.r]?.[nc];
    if (!neighbor) {
      // Celda vacía entonces mover
      t.c = nc;
      t.div.style.transform = toTranslate(t.r, t.c);
      return;
    }
    // Si hay bloque igual entonces fusión lateral
    if (neighbor.value === t.value) {
      const newVal = neighbor.value * 2;
      neighbor.value = newVal;
      neighbor.div.textContent = newVal;
      neighbor.div.className = `tile ${classForValue(newVal)} pop`;
      setTimeout(()=>neighbor.div.classList.remove("pop"), 200);

      // Eliminar tile activo de grilla y DOM
      tileGrid[t.r][t.c] = null;
      t.div.remove();

      // Ahora el bloque activo es el fusionado (vecino)
      activeTile = neighbor;

      // Actualiza score
      score += newVal;
      document.getElementById("score").innerText = score;

      // Reinicia tiempo de gracia
      resetGraceTimer();
      return;
    }
    // Si hay bloque distinto entonces no hace nada
    return;
  }

  // En caída normal se mueve solo si celda vacía
  if(!tileGrid[t.r][nc]){
    t.c=nc;
    t.div.style.transform=toTranslate(t.r,t.c);
  }
}

//Bucle de juego
let lastTime=0;
function gameLoop(timestamp){
  if(gameOver) return;
  if(!lastTime) lastTime=timestamp;
  const delta=timestamp-lastTime;

  // Mientras dure el tiempo de gracia no cae
  if(!inMergeGrace && delta>dropInterval){
    dropStep();
    lastTime=timestamp;
  }
  requestAnimationFrame(gameLoop);
}

//Caída y fusión vertical
function dropStep(){
  if(!activeTile) return;

  if(canMove(1)) {
    // Avanza una fila hacia abajo
    moveActive(1,0);
  } else {
    // Fija tile en el grid
    tileGrid[activeTile.r][activeTile.c]=activeTile;

    // Intenta fusionar en cascada hacia abajo
    const { resultTile, anyMerge } = mergeDown(activeTile.r, activeTile.c);

    if (anyMerge) {
      // Si hubo fusión: se activa tiempo de gracia
      activeTile = resultTile;
      inMergeGrace = true;
      resetGraceTimer();
    } else {
      // Si no, spawnea nuevo bloque
      activeTile = null;
      spawnNewTile();
    }
  }
}

function canMove(dr){
  // Verifica si la celda de abajo está libre
  const nr = activeTile.r + dr;
  return nr < ROWS && !tileGrid[nr][activeTile.c];
}

function moveActive(dr,dc){
  // Actualiza posición visual y lógica del bloque activo
  activeTile.r += dr; activeTile.c += dc;
  activeTile.div.style.transform = toTranslate(activeTile.r, activeTile.c);
}

// Fusión vertical en cascada
function mergeDown(r,c){
  let tile = tileGrid[r][c];
  if(!tile) return { resultTile: null, anyMerge: false };

  let merged = false;

  while (r+1 < ROWS) {
    const below = tileGrid[r+1][c];

    if (!below) {
      // Si está vacío encontes baja el bloque
      tileGrid[r][c] = null;
      tileGrid[r+1][c] = tile;
      tile.r = r+1;
      tile.div.style.transform = toTranslate(tile.r, tile.c);
      r++;
    } else if (below.value === tile.value) {
      // Si son iguales entonces fusión vertical
      const newVal = tile.value * 2;
      below.value = newVal;
      below.div.textContent = newVal;
      below.div.className = `tile ${classForValue(newVal)} pop`;
      setTimeout(()=>below.div.classList.remove("pop"), 200);

      tile.div.remove();
      tileGrid[r][c] = null;

      tile = below; // el resultado de la fusión es el bloque de abajo
      r++;
      merged = true;

      // Aumenta score
      score += newVal;
      document.getElementById("score").innerText = score;
    } else {
      break; // Diferentes entonces detener
    }
  }

  return { resultTile: tile, anyMerge: merged };
}

//Resumen
function showSummary(){
  // Calcula suma total de todos los bloques + tiempo y movimientos
  let total=0;
  for(let r=0;r<ROWS;r++)
    for(let c=0;c<COLS;c++)
      if(tileGrid[r][c]) total+=tileGrid[r][c].value;
  const time=Math.floor((Date.now()-startTime)/1000);
  alert(`Resumen de la partida:\nSuma de bloques: ${total}\nMovimientos: ${moves}\nTiempo: ${time} seg`);
}

//Fin de juego
function endGame(title,message){
  gameOver=true;
  const overlay=document.getElementById("overlay");
  document.getElementById("endTitle").textContent=title;
  document.getElementById("endMessage").textContent=message;
  overlay.classList.remove("hidden");
}
