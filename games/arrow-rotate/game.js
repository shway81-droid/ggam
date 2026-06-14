/* games/arrow-rotate/game.js — 패턴 D (퍼즐 병렬 경쟁) — 화살표 회전 퍼즐 */
'use strict';

// ── Constants ────────────────────────────────────────────────
const TOTAL_ROUNDS = 3;
const ROUND_TIME = 45;        // seconds
const RESULT_PAUSE_MS = getAutoplayPauseMs(2200);
const GRID_SIZE = 9;          // 3x3
// 화살표 방향: 0=↑, 1=→, 2=↓, 3=←
const ARROW_CHARS = ['↑', '→', '↓', '←'];
const TARGET_DIR = 0;         // 모든 칸이 ↑(위)이면 클리어

const PLAYER_CONFIG = [
  { label: 'P1', dot: '#0288D1', cls: 'p1' },
  { label: 'P2', dot: '#E53935', cls: 'p2' },
  { label: 'P3', dot: '#388E3C', cls: 'p3' },
  { label: 'P4', dot: '#F57C00', cls: 'p4' },
];

// ── Sound Manager ────────────────────────────────────────────
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
  rotate(ctx) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type = 'triangle';
    o.frequency.setValueAtTime(520, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(720, ctx.currentTime + 0.08);
    g.gain.setValueAtTime(0.18, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.1);
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

// ── State ────────────────────────────────────────────────────
let playerCount = 2;
let roundIdx = 0;
let scores = [];                 // round wins per player
let roundResults = [];           // [{winnerIdx, timedOut}]
let zoneStates = [];             // each player's current 3x3 arrow state (array of 9 ints 0-3)
let zoneTaps = [];               // each player's tap count
let zoneSolved = [];             // boolean
let phase = 'idle';
let timerHandle = null;
let nextHandle = null;
let timeRemaining = ROUND_TIME;
let initialStateForRound = null; // shared shuffled state for all players

// ── DOM refs ─────────────────────────────────────────────────
const introScreen = document.getElementById('introScreen');
const countdownScreen = document.getElementById('countdownScreen');
const countdownNumber = document.getElementById('countdownNumber');
const gameScreen = document.getElementById('gameScreen');
const resultScreen = document.getElementById('resultScreen');

const backBtn = document.getElementById('backBtn');
const playBtn = document.getElementById('playBtn');
const closeBtn = document.getElementById('closeBtn');
const retryBtn = document.getElementById('retryBtn');
const homeBtn = document.getElementById('homeBtn');

const zonesWrap = document.getElementById('zonesWrap');
const questionCounter = document.getElementById('questionCounter');
const problemTimer = document.getElementById('problemTimer');
const problemStatus = document.getElementById('problemStatus');
const scoreBar = document.getElementById('scoreBar');

const soundToggleIntro = document.getElementById('soundToggleIntro');

const resultTitle = document.getElementById('resultTitle');
const resultWinner = document.getElementById('resultWinner');
const totalRow = document.getElementById('totalRow');

// ── Helpers ──────────────────────────────────────────────────
function showScreen(s) {
  [introScreen, countdownScreen, gameScreen, resultScreen].forEach(x => x.classList.remove('active'));
  s.classList.add('active');
}

var countdownInterval = null;
function startPreGameCountdown(onDone) {
  showScreen(countdownScreen);
  countdownInterval = runCountdown(countdownNumber, onDone);
}

function clearTimers() {
  if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
  if (timerHandle) { clearInterval(timerHandle); timerHandle = null; }
  if (nextHandle) { clearTimeout(nextHandle); nextHandle = null; }
}


// ── Puzzle utilities ─────────────────────────────────────────
// 셔플: 9칸 모두 무작위 방향 (단, 모두 ↑은 피함 = 풀이 시작점 보장)
function shuffleArrows() {
  let state;
  do {
    state = [];
    for (let i = 0; i < GRID_SIZE; i++) {
      state.push(Math.floor(Math.random() * 4));
    }
  } while (isSolved(state)); // 모두 ↑이면 다시 뽑기 (초기부터 풀려있는 거 방지)
  return state;
}

function isSolved(state) {
  for (let i = 0; i < GRID_SIZE; i++) {
    if (state[i] !== TARGET_DIR) return false;
  }
  return true;
}

// ── Build zones (each zone has its own 3x3 arrow grid) ──────
function buildZones() {
  zonesWrap.innerHTML = '';
  zonesWrap.className = `zones-wrap p${playerCount}`;

  for (let i = 0; i < playerCount; i++) {
    const cfg = PLAYER_CONFIG[i];
    const zone = document.createElement('div');
    zone.className = `zone ${cfg.cls}`;
    zone.dataset.player = i;

    const header = document.createElement('div');
    header.className = 'zone-header';
    header.innerHTML = `
      <span class="zone-label">${cfg.label}</span>
      <span class="zone-moves" id="moves-${i}">0회</span>
    `;
    zone.appendChild(header);

    const grid = document.createElement('div');
    grid.className = 'puzzle-grid';
    grid.id = `puzzle-grid-${i}`;
    zone.appendChild(grid);

    zonesWrap.appendChild(zone);
  }
}

function getZone(idx) {
  return zonesWrap.querySelector(`.zone[data-player="${idx}"]`);
}

function renderPuzzle(playerIdx) {
  const grid = document.getElementById(`puzzle-grid-${playerIdx}`);
  if (!grid) return;
  const state = zoneStates[playerIdx];
  grid.innerHTML = '';
  state.forEach((dir, posIdx) => {
    const tile = document.createElement('button');
    tile.className = 'puzzle-tile';
    if (dir === TARGET_DIR) tile.classList.add('aligned');
    tile.textContent = ARROW_CHARS[dir];
    tile.dataset.player = playerIdx;
    tile.dataset.pos = posIdx;
    onTap(tile, () => handleTileTap(playerIdx, posIdx));
    grid.appendChild(tile);
  });
}

function updateMovesChip(playerIdx) {
  const el = document.getElementById(`moves-${playerIdx}`);
  if (el) el.textContent = `${zoneTaps[playerIdx]}회`;
}

// ── Score bar ────────────────────────────────────────────────
function buildScoreBar() {
  scoreBar.innerHTML = '';
  for (let i = 0; i < playerCount; i++) {
    const cfg = PLAYER_CONFIG[i];
    const chip = document.createElement('div');
    chip.className = 'score-chip';
    chip.innerHTML = `
      <span class="score-chip-dot" style="background:${cfg.dot}"></span>
      <span>${cfg.label}</span>
      <span class="score-chip-val" id="bar-score-${i}">0</span>
    `;
    scoreBar.appendChild(chip);
  }
}

function updateBarScore(playerIdx) {
  const el = document.getElementById(`bar-score-${playerIdx}`);
  if (el) el.textContent = scores[playerIdx];
}

// ── Tile tap handler ─────────────────────────────────────────
// 클릭하면 그 칸의 화살표가 시계방향 90도 회전 (0→1→2→3→0)
function handleTileTap(playerIdx, posIdx) {
  if (phase !== 'active') return;
  if (zoneSolved[playerIdx]) return;

  const state = zoneStates[playerIdx];
  state[posIdx] = (state[posIdx] + 1) % 4;
  zoneTaps[playerIdx]++;
  sound.play('rotate');

  renderPuzzle(playerIdx);
  updateMovesChip(playerIdx);

  if (isSolved(state)) {
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

    for (let i = 0; i < playerCount; i++) {
      if (i !== winnerIdx && !zoneSolved[i]) {
        getZone(i).classList.add('locked');
      }
    }

    phase = 'done';
    clearTimers();
    nextHandle = setTimeout(() => nextRound(), RESULT_PAUSE_MS);
  }
}

// ── Timer ────────────────────────────────────────────────────
function startCountdown() {
  timeRemaining = ROUND_TIME;
  problemTimer.textContent = timeRemaining;
  problemTimer.classList.remove('urgent');

  timerHandle = setInterval(() => {
    timeRemaining--;
    problemTimer.textContent = timeRemaining;

    if (timeRemaining <= 5) {
      problemTimer.classList.add('urgent');
      sound.play('tick');
    }

    if (timeRemaining <= 0) {
      clearTimers();
      handleTimeout();
    }
  }, 1000);
}

function handleTimeout() {
  if (phase !== 'active') return;
  phase = 'done';
  sound.play('timeout');

  for (let i = 0; i < playerCount; i++) {
    if (!zoneSolved[i]) {
      getZone(i).classList.add('locked');
    }
  }

  roundResults.push({ winnerIdx: -1, timedOut: true });
  problemStatus.textContent = `시간 초과! 아무도 완성하지 못했어요`;

  nextHandle = setTimeout(() => nextRound(), RESULT_PAUSE_MS);
}

// ── Round flow ───────────────────────────────────────────────
function loadRound() {
  phase = 'active';

  initialStateForRound = shuffleArrows();
  zoneStates = [];
  zoneTaps = [];
  zoneSolved = [];

  for (let i = 0; i < playerCount; i++) {
    zoneStates.push(initialStateForRound.slice());
    zoneTaps.push(0);
    zoneSolved.push(false);
    const zone = getZone(i);
    if (zone) {
      zone.classList.remove('solved', 'locked');
    }
    renderPuzzle(i);
    updateMovesChip(i);
  }

  questionCounter.textContent = `${roundIdx + 1} / ${TOTAL_ROUNDS}`;
  problemStatus.textContent = '톡톡! 모든 화살표를 ↑ 위로!';

  startCountdown();
}

function nextRound() {
  roundIdx++;
  if (roundIdx >= TOTAL_ROUNDS) {
    showResult();
  } else {
    loadRound();
  }
}

function startGame() {
  roundIdx = 0;
  scores = new Array(playerCount).fill(0);
  roundResults = [];
  phase = 'idle';

  clearTimers();
  buildZones();
  buildScoreBar();
  showScreen(gameScreen);
  loadRound();
}

// ── Result ───────────────────────────────────────────────────
function showResult() {
  clearTimers();
  phase = 'idle';
  sound.play('fanfare');

  const maxScore = Math.max(...scores);
  const winners = scores.map((s, i) => ({ s, i }))
    .filter(x => x.s === maxScore)
    .map(x => x.i);

  if (maxScore === 0) {
    resultTitle.textContent = '무승부!';
    resultWinner.textContent = '아무도 라운드를 이기지 못했어요.';
  } else if (winners.length === 1) {
    const w = winners[0];
    resultTitle.textContent = '게임 종료!';
    resultWinner.textContent = `${PLAYER_CONFIG[w].label} 우승! (${maxScore}승)`;
  } else {
    const labels = winners.map(w => PLAYER_CONFIG[w].label).join(', ');
    resultTitle.textContent = '동점!';
    resultWinner.textContent = `${labels} 공동 1위! (${maxScore}승)`;
  }

  totalRow.innerHTML = '';
  for (let i = 0; i < playerCount; i++) {
    const cfg = PLAYER_CONFIG[i];
    const isWin = winners.includes(i);
    const chip = document.createElement('div');
    chip.className = 'total-chip';
    chip.innerHTML = `
      <span class="chip-dot" style="background:${cfg.dot}"></span>
      <span>${cfg.label}</span>
      <span class="chip-score" style="color:${isWin ? '#2E7D32' : '#555'}">${scores[i]}승</span>
      ${isWin ? '<span style="font-size:1.1rem;">★</span>' : ''}
    `;
    totalRow.appendChild(chip);
  }

  showScreen(resultScreen);
}

// ── Player count selection ───────────────────────────────────
setupPlayerSelect(function (n) { playerCount = n; });

// ── Sound toggle ─────────────────────────────────────────────
setupSoundToggle(sound, soundToggleIntro);

// ── Navigation ───────────────────────────────────────────────
onTap(backBtn, () => goHome());
onTap(closeBtn, () => { clearTimers(); goHome(); });
onTap(homeBtn, () => goHome());
onTap(retryBtn, () => startPreGameCountdown(() => startGame()));
onTap(playBtn, () => startPreGameCountdown(() => startGame()));
