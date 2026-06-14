/* games/dot-connect/game.js — 패턴 D, Flow 점 잇기 (탭으로 경로 그리기) */
'use strict';

const TOTAL_ROUNDS = 3;
const ROUND_TIME = 75;
const RESULT_PAUSE_MS = 2200;

const PLAYER_CONFIG = [
  { label: 'P1', dot: '#0288D1', cls: 'p1' },
  { label: 'P2', dot: '#E53935', cls: 'p2' },
  { label: 'P3', dot: '#388E3C', cls: 'p3' },
  { label: 'P4', dot: '#F57C00', cls: 'p4' },
];

const DOT_COLORS = {
  R: '#E53935', // red
  B: '#1976D2', // blue
  G: '#43A047', // green
  Y: '#FBC02D', // yellow
};

// 퍼즐: NxN 그리드, 점들 위치 (color → [posIdx, posIdx])
// All dots paired. Grid size 5x5.
// `endpoints`: { color: [pos1, pos2] }
const PUZZLES = [
  // Round 1: 2 colors. R: [0,8] B: [12,24]
  // R 경로: 0→1→2→3→8 (위→오른쪽)
  // B 경로: 12→13→14→19→24 (오른쪽→아래)
  {
    size: 5,
    endpoints: {
      R: [0, 8],
      B: [12, 24],
    },
  },
  // Round 2: 2 colors, 더 긴 경로
  // R: 0→5→10→15→16→17→22 (왼쪽 아래로)
  // B: 4→9→14→19→24 (오른쪽 세로)
  {
    size: 5,
    endpoints: {
      R: [0, 22],
      B: [4, 24],
    },
  },
  // Round 3: 3 colors
  // R: 0→1→2→3→4→9 (윗줄)
  // B: 5→10→11→12→13→14→19→24 (가로지르며 대각선)
  // G: 15→16→17→18→23 (아래줄)
  {
    size: 5,
    endpoints: {
      R: [0, 9],
      B: [5, 24],
      G: [15, 23],
    },
  },
];

const sound = createSoundManager({
  ding(ctx) { [523, 659, 784].forEach((f, i) => { const o = ctx.createOscillator(); const g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.type = 'sine'; const t = ctx.currentTime + i * 0.09; o.frequency.setValueAtTime(f, t); g.gain.setValueAtTime(0.32, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.32); o.start(t); o.stop(t + 0.32); }); },
  step(ctx) { const o = ctx.createOscillator(); const g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.type = 'sine'; o.frequency.setValueAtTime(660, ctx.currentTime); g.gain.setValueAtTime(0.15, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06); o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.06); },
  buzz(ctx) { const o = ctx.createOscillator(); const g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.type = 'sawtooth'; o.frequency.setValueAtTime(180, ctx.currentTime); g.gain.setValueAtTime(0.25, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15); o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.15); },
  tick(ctx) { const o = ctx.createOscillator(); const g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.type = 'square'; o.frequency.setValueAtTime(880, ctx.currentTime); g.gain.setValueAtTime(0.12, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08); o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.08); },
  timeout(ctx) { const o = ctx.createOscillator(); const g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.type = 'triangle'; o.frequency.setValueAtTime(160, ctx.currentTime); g.gain.setValueAtTime(0.4, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5); o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.5); },
  fanfare(ctx) { [392, 494, 523, 659, 784].forEach((f, i) => { const o = ctx.createOscillator(); const g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.type = 'triangle'; const t = ctx.currentTime + i * 0.12; o.frequency.setValueAtTime(f, t); g.gain.setValueAtTime(0.3, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.38); o.start(t); o.stop(t + 0.38); }); },
});

let playerCount = 2;
let roundIdx = 0;
let scores = [];
let roundResults = [];
// each player: { paths: { color: [posIdx, ...] }, currentColor: null }
let zoneStates = [];
let zoneSolved = [];
let phase = 'idle';
let timerHandle = null, nextHandle = null;
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
function updateSoundBtn(btn) { btn.textContent = sound.isMuted() ? '🔇' : '🔊'; }

function getPuzzle() { return PUZZLES[roundIdx % PUZZLES.length]; }

function isAdjacent(a, b, size) {
  const ar = Math.floor(a / size), ac = a % size;
  const br = Math.floor(b / size), bc = b % size;
  return Math.abs(ar - br) + Math.abs(ac - bc) === 1;
}

// 어떤 셀이 어떤 path에 속하는지
function getCellPath(state, cellIdx) {
  for (const color in state.paths) {
    if (state.paths[color].includes(cellIdx)) return color;
  }
  return null;
}

function isEndpoint(pz, cellIdx) {
  for (const c in pz.endpoints) {
    if (pz.endpoints[c].includes(cellIdx)) return c;
  }
  return null;
}

function buildZones() {
  zonesWrap.innerHTML = '';
  zonesWrap.className = `zones-wrap p${playerCount}`;
  for (let i = 0; i < playerCount; i++) {
    const cfg = PLAYER_CONFIG[i];
    const zone = document.createElement('div');
    zone.className = `zone ${cfg.cls}`;
    zone.dataset.player = i;
    zone.innerHTML = `<div class="zone-header"><span class="zone-label">${cfg.label}</span><span class="zone-progress" id="prog-${i}">0/0</span></div>`;
    const grid = document.createElement('div');
    grid.className = 'dot-grid';
    grid.id = `dot-${i}`;
    zone.appendChild(grid);
    const reset = document.createElement('div');
    reset.className = 'zone-reset';
    reset.innerHTML = `<button class="reset-btn" data-player="${i}">↺ 다시</button>`;
    zone.appendChild(reset);
    zonesWrap.appendChild(zone);
    onTap(reset.querySelector('.reset-btn'), () => resetZone(i));
  }
}
function getZone(idx) { return zonesWrap.querySelector(`.zone[data-player="${idx}"]`); }

function renderDots(playerIdx) {
  const grid = $(`dot-${playerIdx}`);
  if (!grid) return;
  const pz = getPuzzle();
  grid.style.gridTemplateColumns = `repeat(${pz.size}, 1fr)`;
  grid.style.gridTemplateRows = `repeat(${pz.size}, 1fr)`;
  grid.innerHTML = '';
  const state = zoneStates[playerIdx];

  for (let i = 0; i < pz.size * pz.size; i++) {
    const cell = document.createElement('button');
    cell.dataset.player = playerIdx;
    cell.dataset.idx = i;
    cell.className = 'dot-cell';

    const ep = isEndpoint(pz, i);
    const pathColor = getCellPath(state, i);

    if (pathColor) {
      cell.classList.add('path-cell');
      cell.style.background = DOT_COLORS[pathColor] + '88';
    }

    if (ep) {
      cell.classList.add('endpoint');
      const dot = document.createElement('span');
      dot.className = 'dot';
      dot.style.background = DOT_COLORS[ep];
      cell.appendChild(dot);
    }

    onTap(cell, () => handleCellTap(playerIdx, i));
    grid.appendChild(cell);
  }

  // 진행 상황: 완성된 색 / 전체 색
  const total = Object.keys(pz.endpoints).length;
  const done = Object.keys(pz.endpoints).filter(c => isPathComplete(state, pz, c)).length;
  const el = $(`prog-${playerIdx}`);
  if (el) el.textContent = `${done}/${total}`;
}

function isPathComplete(state, pz, color) {
  const path = state.paths[color];
  if (!path || path.length < 2) return false;
  const eps = pz.endpoints[color];
  return path[0] === eps[0] && path[path.length - 1] === eps[1] ||
    path[0] === eps[1] && path[path.length - 1] === eps[0];
}

function handleCellTap(playerIdx, cellIdx) {
  if (phase !== 'active' || zoneSolved[playerIdx]) return;
  const pz = getPuzzle();
  const state = zoneStates[playerIdx];
  const ep = isEndpoint(pz, cellIdx);
  const cellColor = getCellPath(state, cellIdx);

  if (state.currentColor === null) {
    // 새 색 시작 - endpoint를 탭해야 함
    if (!ep) { sound.play('buzz'); return; }
    // 해당 색 path 초기화
    if (state.paths[ep]) {
      // 기존 path가 있으면 지우고 다시 시작
      state.paths[ep] = [cellIdx];
    } else {
      state.paths[ep] = [cellIdx];
    }
    state.currentColor = ep;
    sound.play('step');
  } else {
    const color = state.currentColor;
    const path = state.paths[color];
    const last = path[path.length - 1];

    // 같은 색의 다른 endpoint를 탭하면 완성
    if (ep === color && cellIdx !== last && isAdjacent(last, cellIdx, pz.size)) {
      // 다른 endpoint면서 인접
      if (cellColor && cellColor !== color) { sound.play('buzz'); return; }
      path.push(cellIdx);
      state.currentColor = null;
      sound.play('step');
    }
    // 인접 + 미사용 + 다른 색 path 아님
    else if (isAdjacent(last, cellIdx, pz.size) && !path.includes(cellIdx) && (!cellColor || cellColor === color) && !ep) {
      path.push(cellIdx);
      sound.play('step');
    }
    // 되돌리기
    else if (path.length >= 2 && cellIdx === path[path.length - 2]) {
      path.pop();
      sound.play('step');
    }
    // 같은 endpoint 다시 탭 (취소)
    else if (cellIdx === last && ep === color) {
      // 이미 그리던 색을 취소
      state.paths[color] = [];
      state.currentColor = null;
      sound.play('buzz');
    }
    // 다른 색 endpoint 탭하면 그쪽으로 시작
    else if (ep && ep !== color) {
      // 현재 path 종료 (미완성이면 클리어)
      if (path.length === 1 || !isPathComplete(state, pz, color)) {
        state.paths[color] = [];
      }
      state.paths[ep] = [cellIdx];
      state.currentColor = ep;
      sound.play('step');
    }
    else { sound.play('buzz'); return; }
  }
  renderDots(playerIdx);

  // 완료 체크: 모든 색 연결 완성
  const allColorsDone = Object.keys(pz.endpoints).every(c => isPathComplete(state, pz, c));
  if (allColorsDone) handleSolve(playerIdx);
}

function resetZone(playerIdx) {
  if (phase !== 'active' || zoneSolved[playerIdx]) return;
  zoneStates[playerIdx] = { paths: {}, currentColor: null };
  renderDots(playerIdx);
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
    problemStatus.textContent = `${PLAYER_CONFIG[winnerIdx].label} 완성!`;
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
  problemStatus.textContent = `시간 초과! 아무도 완성하지 못했어요`;
  nextHandle = setTimeout(() => nextRound(), RESULT_PAUSE_MS);
}

function loadRound() {
  phase = 'active';
  zoneStates = []; zoneSolved = [];
  for (let i = 0; i < playerCount; i++) {
    zoneStates.push({ paths: {}, currentColor: null });
    zoneSolved.push(false);
    const zone = getZone(i);
    if (zone) zone.classList.remove('solved', 'locked');
    renderDots(i);
  }
  questionCounter.textContent = `${roundIdx + 1} / ${TOTAL_ROUNDS}`;
  problemStatus.textContent = '같은 색 점을 길로 연결!';
  startCountdown();
}
function nextRound() { roundIdx++; if (roundIdx >= TOTAL_ROUNDS) showResult(); else loadRound(); }
function startGame() {
  roundIdx = 0; scores = new Array(playerCount).fill(0); roundResults = []; phase = 'idle';
  clearTimers(); buildZones(); buildScoreBar();
  showScreen(gameScreen);
  loadRound();
}
function showResult() {
  clearTimers(); phase = 'idle'; sound.play('fanfare');
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

document.querySelectorAll('.player-btn').forEach(btn => onTap(btn, () => { document.querySelectorAll('.player-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); playerCount = parseInt(btn.dataset.count, 10); }));
onTap(soundToggleIntro, () => { sound.toggleMute(); updateSoundBtn(soundToggleIntro); }); updateSoundBtn(soundToggleIntro);
onTap(backBtn, () => goHome());
onTap(closeBtn, () => { clearTimers(); goHome(); });
onTap(homeBtn, () => goHome());
onTap(retryBtn, () => startPreGameCountdown(() => startGame()));
onTap(playBtn, () => startPreGameCountdown(() => startGame()));
