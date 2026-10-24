let pegs = [];
let selectedPeg = null;
let moveCount = 0;
let invalidCount = 0;
let isAnimating = false;
let isSolving = false;
let manualMoveMade = false;
let timerInterval = null;
let timerRunning = false;
let elapsedMs = 0;

const towersContainer = document.getElementById('towersContainer');
const statusMsg = document.getElementById('statusMsg');
const timerDisplay = document.getElementById('timerDisplay');
const speedSlider = document.getElementById('speedSlider');
const speedValue = document.getElementById('speedValue');
const moveBtn = document.getElementById('moveBtn');
const autoBtn = document.getElementById('autoBtn');

function startTimer() {
  if (timerRunning) return;
  timerRunning = true;
  const startTime = Date.now() - elapsedMs;
  timerInterval = setInterval(() => {
    elapsedMs = Date.now() - startTime;
    const m = Math.floor(elapsedMs / 60000);
    const s = Math.floor((elapsedMs % 60000) / 1000);
    const ms = Math.floor((elapsedMs % 1000) / 100);
    timerDisplay.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${ms}`;
  }, 100);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerRunning = false;
}

function render() {
  towersContainer.innerHTML = '';
  pegs.forEach((pegDisks, idx) => {
    const sorted = [...pegDisks].sort((a, b) => b - a);
    const tower = document.createElement('div');
    tower.className = 'tower';
    
    const area = document.createElement('div');
    area.className = 'disks-area';
    const stack = document.createElement('div');
    stack.className = 'disks-stack';

    sorted.forEach((size, i) => {
      const disk = document.createElement('div');
      disk.className = 'disk disk-' + size; 
      
      const w = 40 + (size / parseInt(document.getElementById('diskCountInput').value)) * 70;
      disk.style.setProperty('--w', w + 'px');
      
      if (selectedPeg === idx && i === sorted.length - 1) disk.classList.add('selected');
      stack.appendChild(disk);
    });

    area.appendChild(stack);
    const peg = document.createElement('div'); peg.className = 'peg';
    const base = document.createElement('div'); base.className = 'base';

    tower.appendChild(area);
    tower.appendChild(peg);
    tower.appendChild(base);
    tower.onclick = () => handlePegClick(idx);
    towersContainer.appendChild(tower);
  });

  // Update button states
  moveBtn.disabled = (selectedPeg === null) || isAnimating || isSolving;
  autoBtn.disabled = manualMoveMade || isAnimating || isSolving;
}

async function handlePegClick(clickedPeg) {
  if (isAnimating || isSolving) return;
  if (!timerRunning) startTimer();

  if (selectedPeg === null) {
    if (pegs[clickedPeg].length > 0) {
      selectedPeg = clickedPeg;
      render();
    }
    return;
  }

  if (selectedPeg === clickedPeg) {
    selectedPeg = null;
    render();
    return;
  }

  const from = selectedPeg;
  const to = clickedPeg;
  selectedPeg = null;
  render();

  try {
    const response = await fetch('/api/move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: pegs, from: from, to: to })
    });
    const result = await response.json();

    if (result.valid) {
      manualMoveMade = true;
      moveCount++;
      document.getElementById('moveCounter').textContent = moveCount;
      isAnimating = true;
      await animateMove(from, to, pegs[from][pegs[from].length - 1], result.newState);
      isAnimating = false;
      render();
    } else {
      invalidCount++;
      document.getElementById('invalidCounter').textContent = invalidCount;
      flashPeg(to, 'wrong');
    }
  } catch (e) {
    statusMsg.textContent = "Prolog Server Offline!";
    statusMsg.style.color = "#ff9a9a";
  }
}

// Fewest known moves for n disks on p pegs (Frame-Stewart), matching hanoi.pl
const optimalCache = {};
function optimalMoves(n, p) {
  if (n === 0) return 0;
  if (n === 1) return 1;
  if (p < 3) return Infinity;
  if (p === 3) return Math.pow(2, n) - 1;
  const key = n + ',' + p;
  if (key in optimalCache) return optimalCache[key];
  let best = Infinity;
  for (let k = 1; k < n; k++) {
    best = Math.min(best, 2 * optimalMoves(k, p) + optimalMoves(n - k, p - 1));
  }
  optimalCache[key] = best;
  return best;
}

function getSpeedFactor() { return 0.4 + (parseInt(speedSlider.value) - 1) * (3.6 / 9); }

async function animateMove(fromPeg, toPeg, diskSize, newState) {
  const speed = getSpeedFactor();
  const liftTime = 300 / speed;
  const travelTime = 350 / speed;
  const dropTime = 250 / speed;

  const srcDisk = document.querySelectorAll('.tower')[fromPeg].querySelector('.disks-stack').lastElementChild;
  const srcRect = srcDisk.getBoundingClientRect();
  
  const fly = document.createElement('div');
  fly.className = 'flying-disk disk disk-' + diskSize;
  fly.style.width = srcRect.width + 'px';
  fly.style.left = `${srcRect.left}px`;
  fly.style.top = `${srcRect.top}px`;
  fly.style.transform = 'translate(0, 0)';
  document.body.appendChild(fly);
  srcDisk.style.visibility = 'hidden';

  const topY = document.querySelector('.peg').getBoundingClientRect().top - 40;
  const targetRect = document.querySelectorAll('.tower')[toPeg].getBoundingClientRect();
  const targetX = targetRect.left + (targetRect.width - srcRect.width) / 2;
  const baseY = document.querySelectorAll('.tower')[toPeg].querySelector('.peg').getBoundingClientRect().bottom;
  
  // Height per disk is now 18px + 2px margin = 20px
  const landY = baseY - (newState[toPeg].length) * 20; 

  // 1. LIFT
  await fly.animate([
    { transform: 'translate(0, 0)' },
    { transform: `translate(0, ${topY - srcRect.top}px)` }
  ], { duration: liftTime, easing: 'linear', fill: 'forwards' }).finished;

  // 2. TRAVEL
  await fly.animate([
    { transform: `translate(0, ${topY - srcRect.top}px)` },
    { transform: `translate(${targetX - srcRect.left}px, ${topY - srcRect.top}px)` }
  ], { duration: travelTime, easing: 'linear', fill: 'forwards' }).finished;

  // 3. DROP
  await fly.animate([
    { transform: `translate(${targetX - srcRect.left}px, ${topY - srcRect.top}px)` },
    { transform: `translate(${targetX - srcRect.left}px, ${landY - srcRect.top}px)` }
  ], { duration: dropTime, easing: 'linear', fill: 'forwards' }).finished;

  fly.remove();
  pegs = newState;
  render();

  if (pegs[pegs.length - 1].length === parseInt(document.getElementById('diskCountInput').value)) {
    stopTimer();
    document.getElementById('modalTime').textContent = timerDisplay.textContent;
    document.getElementById('modalMoves').textContent = moveCount;
    document.getElementById('modalOptimal').textContent = optimalMoves(
      parseInt(document.getElementById('diskCountInput').value),
      pegs.length
    );
    document.getElementById('modalInvalid').textContent = invalidCount;
    document.getElementById('winModal').classList.add('show');
  }
}

function flashPeg(index, type) {
  const tower = document.querySelectorAll('.tower')[index];
  tower.classList.add(`highlight-${type}`);
  setTimeout(() => tower.classList.remove(`highlight-${type}`), 600);
}

// New Move To Button Logic
moveBtn.onclick = () => {
  if (selectedPeg === null) return;
  const targetStr = prompt(`Move selected disk from Tower ${selectedPeg + 1} to which tower? (1-${pegs.length})`);
  if (targetStr === null) return;
  const target = parseInt(targetStr) - 1;
  if (isNaN(target) || target < 0 || target >= pegs.length) {
    alert("Invalid tower number.");
    return;
  }
  if (target === selectedPeg) {
    selectedPeg = null;
    render();
    return;
  }
  handlePegClick(target);
};

autoBtn.onclick = async () => {
  if (manualMoveMade) return;
  isSolving = true;
  render();
  statusMsg.textContent = "Prolog is solving...";
  
  if (!timerRunning) startTimer();

  try {
    const res = await fetch('/api/solve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ disks: parseInt(document.getElementById('diskCountInput').value), pegs: parseInt(document.getElementById('towerCountInput').value) })
    });
    const data = await res.json();
    
    for (let i = 0; i < data.moves.length; i++) {
      const m = data.moves[i];
      moveCount++;
      document.getElementById('moveCounter').textContent = moveCount;
      
      const valRes = await fetch('/api/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: pegs, from: m.from, to: m.to })
      });
      const valData = await valRes.json();
      await animateMove(m.from, m.to, pegs[m.from][pegs[m.from].length - 1], valData.newState);
    }
  } catch (e) {
    console.error(e);
  }
  isSolving = false;
  render();
};

function initGame() {
  stopTimer();
  elapsedMs = 0;
  timerDisplay.textContent = '00:00.0';
  moveCount = 0; invalidCount = 0; manualMoveMade = false; selectedPeg = null;
  document.getElementById('moveCounter').textContent = 0;
  document.getElementById('invalidCounter').textContent = 0;
  document.getElementById('winModal').classList.remove('show');

  // STRICT CLAMPING to prevent >8
  let t = parseInt(document.getElementById('towerCountInput').value) || 3;
  if (t > 8) t = 8;
  if (t < 3) t = 3;
  document.getElementById('towerCountInput').value = t;

  let d = parseInt(document.getElementById('diskCountInput').value) || 3;
  if (d > 8) d = 8;
  if (d < 1) d = 1;
  document.getElementById('diskCountInput').value = d;

  pegs = Array.from({ length: t }, (_, i) => i === 0 ? Array.from({ length: d }, (_, j) => d - j) : []);
  statusMsg.textContent = "Ready (Prolog Backend)";
  statusMsg.style.color = "#d4af37";
  render();
}

// Event Listeners for Inputs
document.getElementById('towerCountInput').onchange = initGame;
document.getElementById('diskCountInput').onchange = initGame;

document.getElementById('resetBtn').onclick = initGame;
document.getElementById('playAgainBtn').onclick = initGame;

// Refresh Button
document.getElementById('refreshBtn').onclick = () => {
  window.location.reload();
};

speedSlider.oninput = () => speedValue.textContent = speedSlider.value + 'x';

initGame();