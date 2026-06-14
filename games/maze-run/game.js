/* games/maze-run/game.js — 패턴 D, 미로찾기 (탭으로 길 추적) */
'use strict';

const TOTAL_ROUNDS = 3;
const ROUND_TIME = 45;
const RESULT_PAUSE_MS = 2200;

const PLAYER_CONFIG = [
  { label: 'P1', dot: '#0288D1', cls: 'p1' },
  { label: 'P2', dot: '#E53935', cls: 'p2' },
  { label: 'P3', dot: '#388E3C', cls: 'p3' },
  { label: 'P4', dot: '#F57C00', cls: 'p4' },
];

// 미로 데이터 — 0=path, 1=wall, S=start, E=end (모두 path 가능)
// 각 라운드별 5x5 ~ 6x6 미로
const MAZES = [
  // Round 1: 5x5 단순 미로
  {
    size: 5,
    grid: [
      0,0,1,0,0,
      1,0,0,0,1,
      1,1,1,0,0,
      0,0,0,0,1,
      0,1,1,0,0,
    ],
    start: 0,    // top-left
    end: 24,     // bottom-right
  },
  // Round 2: 6x6 약간 복잡
  {
    size: 6,
    grid: [
      0,1,0,0,0,0,
      0,1,0,1,1,0,
      0,0,0,1,0,0,
      1,1,0,0,0,1,
      0,0,0,1,0,0,
      0,1,1,1,0,0,
    ],
    start: 0,
    end: 35,
  },
  // Round 3: 6x6 더 복잡
  {
    size: 6,
    grid: [
      0,0,0,1,0,0,
      1,1,0,1,0,1,
      0,0,0,0,0,1,
      0,1,1,1,0,0,
      0,1,0,0,0,1,
      0,0,0,1,0,0,
    ],
    start: 0,
    end: 35,
  },
];

const sound = createSoundManager({
  ding(ctx) {
    [523, 659, 784].forEach((f, i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination); o.type = 'sine';
      const t = ctx.currentTime + i * 0.09;
      o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.32, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
      o.start(t); o.stop(t + 0.32);
    });
  },
  step(ctx) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type = 'sine';
    o.frequency.setValueAtTime(660, ctx.currentTime);
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
    o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.06);
  },
  buzz(ctx) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type = 'sawtooth';
    o.frequency.setValueAtTime(180, ctx.currentTime);
    g.gain.setValueAtTime(0.25, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.15);
  },
  tick(ctx) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type = 'square';
    o.frequency.setValueAtTime(880, ctx.currentTime);
    g.gain.setValueAtTime(0.12, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.08);
  },
  timeout(ctx) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type = 'triangle';
    o.frequency.setValueAtTime(160, ctx.currentTime);
    g.gain.setValueAtTime(0.4, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.5);
  },
  fanfare(ctx) {
    [392, 494, 523, 659, 784].forEach((f, i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination); o.type = 'triangle';
      const t = ctx.currentTime + i * 0.12;
      o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.3, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
      o.start(t); o.stop(t + 0.38);
    });
  },
});

let playerCount = 2;
let roundIdx = 0;
let scores = [];
let roundResults = [];
let zonePaths = [];      // each player's traced cells (in order)
let zoneSolved = [];
let phase = 'idle';
let timerHandle = null;
let nextHandle = null;
let timeRemaining = ROUND_TIME;

const $ = id => document.getElementById(id);
const introScreen = $('introScreen'), countdownScreen = $('countdownScreen'), countdownNumber = $('countdownNumber');
const gameScreen = $('gameScreen'), resultScreen = $('resultScreen');
const backBtn = $('backBtn'), playBtn = $('playBtn'), closeBtn = $('closeBtn'), retryBtn = $('retryBtn'), homeBtn = $('homeBtn');
const zonesWrap = $('zonesWrap'), questionCounter = $('questionCounter'), problemTimer = $('problemTimer'), problemStatus = $('problemStatus'), scoreBar = $('scoreBar');
const soundToggleIntro = $('soundToggleIntro');
const resultTitle = $('resultTitle'), resultWinner = $('resultWinner'), totalRow = $('totalRow');

function showScreen(s) { [introScreen, countdownScreen, gameScreen, resultScreen].forEach(x => x.classList.remove('active')); s.classList.add('active'); }
let countdownInterval = null;
function startPreGameCountdown(onDone) {
  showScreen(countdownScreen);
  countdownInterval = runCountdown(countdownNumber, onDone);
}
function clearTimers() { if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; } if (timerHandle) { clearInterval(timerHandle); timerHandle = null; } if (nextHandle) { clearTimeout(nextHandle); nextHandle = null; } }

function getMaze() { return MAZES[roundIdx % MAZES.length]; }
function isAdjacent(a, b, size) {
  const ar = Math.floor(a / size), ac = a % size;
  const br = Math.floor(b / size), bc = b % size;
  return (Math.abs(ar - br) + Math.abs(ac - bc)) === 1;
}

function buildZones() {
  zonesWrap.innerHTML = '';
  zonesWrap.className = `zones-wrap p${playerCount}`;
  for (let i = 0; i < playerCount; i++) {
    const cfg = PLAYER_CONFIG[i];
    const zone = document.createElement('div');
    zone.className = `zone ${cfg.cls}`;
    zone.dataset.player = i;
    zone.innerHTML = `<div class="zone-header"><span class="zone-label">${cfg.label}</span><span class="zone-progress" id="prog-${i}">0칸</span></div>`;
    const grid = document.createElement('div');
    grid.className = 'maze-grid';
    grid.id = `maze-${i}`;
    zone.appendChild(grid);
    zonesWrap.appendChild(zone);
  }
}
function getZone(idx) { return zonesWrap.querySelector(`.zone[data-player="${idx}"]`); }

function renderMaze(playerIdx) {
  const grid = $(`maze-${playerIdx}`);
  if (!grid) return;
  const maze = getMaze();
  grid.style.gridTemplateColumns = `repeat(${maze.size}, 1fr)`;
  grid.style.gridTemplateRows = `repeat(${maze.size}, 1fr)`;
  grid.innerHTML = '';
  const path = zonePaths[playerIdx];
  for (let i = 0; i < maze.grid.length; i++) {
    const cell = document.createElement('button');
    cell.dataset.player = playerIdx;
    cell.dataset.idx = i;
    if (maze.grid[i] === 1) {
      cell.className = 'maze-cell wall';
      cell.disabled = true;
    } else {
      cell.className = 'maze-cell path';
      if (i === maze.start) { cell.classList.add('start'); cell.textContent = '🟢'; }
      if (i === maze.end) { cell.classList.add('end'); cell.textContent = '🔴'; }
      if (path.includes(i)) cell.classList.add('traced');
      onTap(cell, () => handleCellTap(playerIdx, i));
    }
    grid.appendChild(cell);
  }
}
function updateProgressChip(playerIdx) {
  const el = $(`prog-${playerIdx}`);
  if (el) el.textContent = `${zonePaths[playerIdx].length}칸`;
}

function handleCellTap(playerIdx, cellIdx) {
  if (phase !== 'active' || zoneSolved[playerIdx]) return;
  const maze = getMaze();
  if (maze.grid[cellIdx] === 1) return;
  const path = zonePaths[playerIdx];

  if (path.length === 0) {
    if (cellIdx !== maze.start) return; // 시작점부터만
    path.push(cellIdx);
    sound.play('step');
  } else {
    const last = path[path.length - 1];
    if (cellIdx === last) return;
    if (path.length >= 2 && cellIdx === path[path.length - 2]) {
      path.pop(); // 되돌리기
      sound.play('step');
    } else if (isAdjacent(last, cellIdx, maze.size) && !path.includes(cellIdx)) {
      path.push(cellIdx);
      sound.play('step');
    } else {
      sound.play('buzz');
      return;
    }
  }
  renderMaze(playerIdx);
  updateProgressChip(playerIdx);

  // 끝에 도달했는지 확인
  if (path[path.length - 1] === maze.end) {
    handleSolve(playerIdx);
  }
}

function handleSolve(winnerIdx) {
  if (zoneSolved[winnerIdx]) return;
  zoneSolved[winnerIdx] = true;
  const zone = getZone(winnerIdx);
  zone.classList.add('solved');
  if (roundResults.length === roundIdx) {
    roundResults.push({ winnerIdx, timedOut: false });
    scores[winnerIdx]++;
    updateBarScore(winnerIdx);
    sound.play('ding');
    problemStatus.textContent = `${PLAYER_CONFIG[winnerIdx].label} 승리!`;
    for (let i = 0; i < playerCount; i++) if (i !== winnerIdx && !zoneSolved[i]) getZone(i).classList.add('locked');
    phase = 'done';
    clearTimers();
    nextHandle = setTimeout(() => nextRound(), RESULT_PAUSE_MS);
  }
}

function buildScoreBar() {
  scoreBar.innerHTML = '';
  for (let i = 0; i < playerCount; i++) {
    const cfg = PLAYER_CONFIG[i];
    const chip = document.createElement('div');
    chip.className = 'score-chip';
    chip.innerHTML = `<span class="score-chip-dot" style="background:${cfg.dot}"></span><span>${cfg.label}</span><span class="score-chip-val" id="bar-score-${i}">0</span>`;
    scoreBar.appendChild(chip);
  }
}
function updateBarScore(idx) { const el = $(`bar-score-${idx}`); if (el) el.textContent = scores[idx]; }

function startCountdown() {
  timeRemaining = ROUND_TIME;
  problemTimer.textContent = timeRemaining;
  problemTimer.classList.remove('urgent');
  timerHandle = setInterval(() => {
    timeRemaining--;
    problemTimer.textContent = timeRemaining;
    if (timeRemaining <= 5) { problemTimer.classList.add('urgent'); sound.play('tick'); }
    if (timeRemaining <= 0) { clearTimers(); handleTimeout(); }
  }, 1000);
}
function handleTimeout() {
  if (phase !== 'active') return;
  phase = 'done';
  sound.play('timeout');
  for (let i = 0; i < playerCount; i++) if (!zoneSolved[i]) getZone(i).classList.add('locked');
  roundResults.push({ winnerIdx: -1, timedOut: true });
  problemStatus.textContent = `시간 초과! 아무도 도착하지 못했어요`;
  nextHandle = setTimeout(() => nextRound(), RESULT_PAUSE_MS);
}

function loadRound() {
  phase = 'active';
  zonePaths = []; zoneSolved = [];
  for (let i = 0; i < playerCount; i++) {
    zonePaths.push([]);
    zoneSolved.push(false);
    const zone = getZone(i);
    if (zone) zone.classList.remove('solved', 'locked');
    renderMaze(i);
    updateProgressChip(i);
  }
  questionCounter.textContent = `${roundIdx + 1} / ${TOTAL_ROUNDS}`;
  problemStatus.textContent = '시작🟢부터 끝🔴까지!';
  startCountdown();
}
function nextRound() {
  roundIdx++;
  if (roundIdx >= TOTAL_ROUNDS) showResult();
  else loadRound();
}
function startGame() {
  roundIdx = 0;
  scores = new Array(playerCount).fill(0);
  roundResults = [];
  phase = 'idle';
  clearTimers(); buildZones(); buildScoreBar();
  showScreen(gameScreen);
  loadRound();
}
function showResult() {
  clearTimers();
  phase = 'idle';
  sound.play('fanfare');
  const max = Math.max(...scores);
  const winners = scores.map((s, i) => ({ s, i })).filter(x => x.s === max).map(x => x.i);
  if (max === 0) { resultTitle.textContent = '무승부!'; resultWinner.textContent = '아무도 라운드를 이기지 못했어요.'; }
  else if (winners.length === 1) { resultTitle.textContent = '게임 종료!'; resultWinner.textContent = `${PLAYER_CONFIG[winners[0]].label} 우승! (${max}승)`; }
  else { const labels = winners.map(w => PLAYER_CONFIG[w].label).join(', '); resultTitle.textContent = '동점!'; resultWinner.textContent = `${labels} 공동 1위! (${max}승)`; }
  totalRow.innerHTML = '';
  for (let i = 0; i < playerCount; i++) {
    const cfg = PLAYER_CONFIG[i]; const isWin = winners.includes(i);
    const chip = document.createElement('div'); chip.className = 'total-chip';
    chip.innerHTML = `<span class="chip-dot" style="background:${cfg.dot}"></span><span>${cfg.label}</span><span class="chip-score" style="color:${isWin ? '#2E7D32' : '#555'}">${scores[i]}승</span>${isWin ? '<span style="font-size:1.1rem;">★</span>' : ''}`;
    totalRow.appendChild(chip);
  }
  showScreen(resultScreen);
}

setupPlayerSelect(function (n) { playerCount = n; });
setupSoundToggle(sound, soundToggleIntro);
onTap(backBtn, () => goHome());
onTap(closeBtn, () => { clearTimers(); goHome(); });
onTap(homeBtn, () => goHome());
onTap(retryBtn, () => startPreGameCountdown(() => startGame()));
onTap(playBtn, () => startPreGameCountdown(() => startGame()));
