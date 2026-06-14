/* games/pipe-connect/game.js — 패턴 D, 파이프 회전 퍼즐 */
'use strict';

const TOTAL_ROUNDS = 3;
const ROUND_TIME = 60;
const RESULT_PAUSE_MS = 2200;

const PLAYER_CONFIG = [
  { label: 'P1', dot: '#0288D1', cls: 'p1' },
  { label: 'P2', dot: '#E53935', cls: 'p2' },
  { label: 'P3', dot: '#388E3C', cls: 'p3' },
  { label: 'P4', dot: '#F57C00', cls: 'p4' },
];

// 파이프 종류:
// 'straight' (직선, 0=수평/1=수직)
// 'corner'   (꺾임, 0=ENE/1=ES/2=SW/3=WN), 4방향
// 'tee'      (T자) 0=N막힘, 1=E막힘, 2=S막힘, 3=W막힘
// 'cross'    (십자) 회전 무관
// 'cap-start' / 'cap-end' (입구/출구, 한 방향만)
// 빈 칸은 'empty'

// connections: 각 type별 (rotation에 따라) 연결되는 방향 [N=0, E=1, S=2, W=3]
function getConns(type, rot) {
  rot = rot % 4;
  if (type === 'straight') return rot % 2 === 0 ? [1, 3] : [0, 2]; // 0=수평(EW), 1=수직(NS)
  if (type === 'corner') {
    // 0: N+E, 1: E+S, 2: S+W, 3: W+N
    return [[0, 1], [1, 2], [2, 3], [3, 0]][rot];
  }
  if (type === 'tee') {
    // 0: 막힘 N → E,S,W / 1: 막힘 E → N,S,W / 2: 막힘 S → N,E,W / 3: 막힘 W → N,E,S
    return [[1, 2, 3], [0, 2, 3], [0, 1, 3], [0, 1, 2]][rot];
  }
  if (type === 'cross') return [0, 1, 2, 3];
  if (type === 'cap') {
    // 한 방향만: rot=0(N), 1(E), 2(S), 3(W)
    return [rot];
  }
  return [];
}

// 라운드 데이터 — 4x4 그리드, 입구는 좌측 또는 상단, 출구는 우측 또는 하단
// solution이 있는 풀이 가능한 퍼즐
// 각 셀: { type, rot, fixed }
const PUZZLES = [
  // Round 1: 4x4 단순. 경로: 0→1→5→6→10→14→15
  {
    size: 4,
    cells: [
      { type: 'cap', rot: 1, fixed: true },        // 0: 입구 East
      { type: 'corner', rot: 2, initial: 0 },      // 1: S+W (rot 2)
      { type: 'empty' },
      { type: 'empty' },
      { type: 'empty' },
      { type: 'corner', rot: 0, initial: 2 },      // 5: N+E (rot 0)
      { type: 'corner', rot: 2, initial: 3 },      // 6: S+W (rot 2)
      { type: 'empty' },
      { type: 'empty' },
      { type: 'empty' },
      { type: 'straight', rot: 1, initial: 0 },    // 10: NS (rot 1)
      { type: 'empty' },
      { type: 'empty' },
      { type: 'empty' },
      { type: 'corner', rot: 0, initial: 1 },      // 14: N+E (rot 0)
      { type: 'cap', rot: 3, fixed: true },        // 15: 출구 West
    ],
    inletPos: 0, inletDir: 1,
    outletPos: 15, outletDir: 3,
  },
  // Round 2: 경로: 0→4→5→6→10→11→15
  {
    size: 4,
    cells: [
      { type: 'cap', rot: 2, fixed: true },        // 0: 입구 South
      { type: 'empty' },
      { type: 'empty' },
      { type: 'empty' },
      { type: 'corner', rot: 0, initial: 2 },      // 4: N+E (rot 0)
      { type: 'straight', rot: 0, initial: 1 },    // 5: EW (rot 0)
      { type: 'corner', rot: 2, initial: 1 },      // 6: S+W (rot 2)
      { type: 'empty' },
      { type: 'empty' },
      { type: 'empty' },
      { type: 'corner', rot: 0, initial: 3 },      // 10: N+E (rot 0)
      { type: 'corner', rot: 2, initial: 3 },      // 11: S+W (rot 2)
      { type: 'empty' },
      { type: 'empty' },
      { type: 'empty' },
      { type: 'cap', rot: 0, fixed: true },        // 15: 출구 North
    ],
    inletPos: 0, inletDir: 2,
    outletPos: 15, outletDir: 0,
  },
  // Round 3: 경로 0→1→5→9→10→14→15 (회전이 더 많이 필요)
  {
    size: 4,
    cells: [
      { type: 'cap', rot: 1, fixed: true },        // 0: 입구 East
      { type: 'corner', rot: 2, initial: 1 },      // 1: S+W (rot 2)
      { type: 'empty' },
      { type: 'empty' },
      { type: 'empty' },
      { type: 'straight', rot: 1, initial: 0 },    // 5: NS (rot 1)
      { type: 'empty' },
      { type: 'empty' },
      { type: 'empty' },
      { type: 'corner', rot: 0, initial: 3 },      // 9: N+E (rot 0)
      { type: 'corner', rot: 2, initial: 1 },      // 10: S+W (rot 2)
      { type: 'empty' },
      { type: 'empty' },
      { type: 'empty' },
      { type: 'corner', rot: 0, initial: 1 },      // 14: N+E (rot 0)
      { type: 'cap', rot: 3, fixed: true },        // 15: 출구 West
    ],
    inletPos: 0, inletDir: 1,
    outletPos: 15, outletDir: 3,
  },
];

// SVG renderer for each pipe type
function pipeSVG(type, rot) {
  // 작은 SVG, 검정 두꺼운 선
  const stroke = '#2C2C2C';
  const sw = 8;
  const inner = '#7C4DFF';
  let paths = '';
  if (type === 'straight') {
    paths = rot % 2 === 0
      ? `<line x1="0" y1="50" x2="100" y2="50" stroke="${stroke}" stroke-width="${sw + 6}" stroke-linecap="round"/><line x1="0" y1="50" x2="100" y2="50" stroke="${inner}" stroke-width="${sw}" stroke-linecap="round"/>`
      : `<line x1="50" y1="0" x2="50" y2="100" stroke="${stroke}" stroke-width="${sw + 6}" stroke-linecap="round"/><line x1="50" y1="0" x2="50" y2="100" stroke="${inner}" stroke-width="${sw}" stroke-linecap="round"/>`;
  } else if (type === 'corner') {
    // 0: N+E, 1: E+S, 2: S+W, 3: W+N
    const corners = [
      'M 50 0 L 50 50 L 100 50',
      'M 100 50 L 50 50 L 50 100',
      'M 50 100 L 50 50 L 0 50',
      'M 0 50 L 50 50 L 50 0'
    ];
    paths = `<path d="${corners[rot]}" stroke="${stroke}" stroke-width="${sw + 6}" stroke-linecap="round" fill="none"/><path d="${corners[rot]}" stroke="${inner}" stroke-width="${sw}" stroke-linecap="round" fill="none"/>`;
  } else if (type === 'cap') {
    const caps = [
      'M 50 50 L 50 0',
      'M 50 50 L 100 50',
      'M 50 50 L 50 100',
      'M 50 50 L 0 50'
    ];
    paths = `<circle cx="50" cy="50" r="14" fill="${stroke}"/><circle cx="50" cy="50" r="9" fill="${rot === 0 || rot === 1 ? '#4CAF50' : '#E53935'}"/><path d="${caps[rot]}" stroke="${stroke}" stroke-width="${sw + 6}" stroke-linecap="round" fill="none"/><path d="${caps[rot]}" stroke="${inner}" stroke-width="${sw}" stroke-linecap="round" fill="none"/>`;
  }
  return `<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">${paths}</svg>`;
}

const sound = createSoundManager({
  ding(ctx) { [523, 659, 784].forEach((f, i) => { const o = ctx.createOscillator(); const g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.type = 'sine'; const t = ctx.currentTime + i * 0.09; o.frequency.setValueAtTime(f, t); g.gain.setValueAtTime(0.32, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.32); o.start(t); o.stop(t + 0.32); }); },
  rotate(ctx) { const o = ctx.createOscillator(); const g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.type = 'sine'; o.frequency.setValueAtTime(550, ctx.currentTime); o.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.08); g.gain.setValueAtTime(0.18, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1); o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.1); },
  tick(ctx) { const o = ctx.createOscillator(); const g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.type = 'square'; o.frequency.setValueAtTime(880, ctx.currentTime); g.gain.setValueAtTime(0.12, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08); o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.08); },
  timeout(ctx) { const o = ctx.createOscillator(); const g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.type = 'triangle'; o.frequency.setValueAtTime(160, ctx.currentTime); g.gain.setValueAtTime(0.4, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5); o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.5); },
  fanfare(ctx) { [392, 494, 523, 659, 784].forEach((f, i) => { const o = ctx.createOscillator(); const g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.type = 'triangle'; const t = ctx.currentTime + i * 0.12; o.frequency.setValueAtTime(f, t); g.gain.setValueAtTime(0.3, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.38); o.start(t); o.stop(t + 0.38); }); },
});

let playerCount = 2;
let roundIdx = 0;
let scores = [];
let roundResults = [];
let zoneRots = [];        // each player's current rotation per cell
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

function buildZones() {
  zonesWrap.innerHTML = '';
  zonesWrap.className = `zones-wrap p${playerCount}`;
  for (let i = 0; i < playerCount; i++) {
    const cfg = PLAYER_CONFIG[i];
    const zone = document.createElement('div');
    zone.className = `zone ${cfg.cls}`;
    zone.dataset.player = i;
    zone.innerHTML = `<div class="zone-header"><span class="zone-label">${cfg.label}</span><span class="zone-progress" id="prog-${i}">진행중</span></div>`;
    const grid = document.createElement('div');
    grid.className = 'pipe-grid';
    grid.id = `pipe-${i}`;
    zone.appendChild(grid);
    zonesWrap.appendChild(zone);
  }
}
function getZone(idx) { return zonesWrap.querySelector(`.zone[data-player="${idx}"]`); }

function renderPipes(playerIdx) {
  const grid = $(`pipe-${playerIdx}`);
  if (!grid) return;
  const pz = getPuzzle();
  grid.style.gridTemplateColumns = `repeat(${pz.size}, 1fr)`;
  grid.style.gridTemplateRows = `repeat(${pz.size}, 1fr)`;
  grid.innerHTML = '';
  const rots = zoneRots[playerIdx];
  const connectedSet = computeConnected(playerIdx);
  pz.cells.forEach((cell, idx) => {
    const btn = document.createElement('button');
    btn.dataset.player = playerIdx;
    btn.dataset.idx = idx;
    if (cell.type === 'empty') {
      btn.className = 'pipe-cell';
      btn.style.background = '#2C2C2C';
      btn.disabled = true;
      btn.style.boxShadow = 'none';
    } else {
      btn.className = 'pipe-cell';
      if (cell.fixed) btn.classList.add('fixed');
      if (connectedSet.has(idx)) btn.classList.add('connected');
      btn.innerHTML = pipeSVG(cell.type, rots[idx]);
      if (!cell.fixed) onTap(btn, () => handlePipeTap(playerIdx, idx));
    }
    grid.appendChild(btn);
  });
}

// 입구부터 BFS로 연결된 셀들 찾기
function computeConnected(playerIdx) {
  const pz = getPuzzle();
  const rots = zoneRots[playerIdx];
  const connected = new Set();
  const queue = [pz.inletPos];
  connected.add(pz.inletPos);
  const dRow = [-1, 0, 1, 0]; // N, E, S, W
  const dCol = [0, 1, 0, -1];
  while (queue.length) {
    const cur = queue.shift();
    const cell = pz.cells[cur];
    if (cell.type === 'empty') continue;
    const conns = getConns(cell.type, rots[cur]);
    const r = Math.floor(cur / pz.size), c = cur % pz.size;
    for (const dir of conns) {
      const nr = r + dRow[dir], nc = c + dCol[dir];
      if (nr < 0 || nr >= pz.size || nc < 0 || nc >= pz.size) continue;
      const ni = nr * pz.size + nc;
      if (connected.has(ni)) continue;
      const ncell = pz.cells[ni];
      if (ncell.type === 'empty') continue;
      const nconns = getConns(ncell.type, rots[ni]);
      const oppositeDir = (dir + 2) % 4;
      if (nconns.includes(oppositeDir)) {
        connected.add(ni);
        queue.push(ni);
      }
    }
  }
  return connected;
}

function checkSolved(playerIdx) {
  const pz = getPuzzle();
  return computeConnected(playerIdx).has(pz.outletPos);
}

function handlePipeTap(playerIdx, idx) {
  if (phase !== 'active' || zoneSolved[playerIdx]) return;
  zoneRots[playerIdx][idx] = (zoneRots[playerIdx][idx] + 1) % 4;
  sound.play('rotate');
  renderPipes(playerIdx);
  if (checkSolved(playerIdx)) handleSolve(playerIdx);
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
  problemStatus.textContent = `시간 초과! 아무도 연결하지 못했어요`;
  nextHandle = setTimeout(() => nextRound(), RESULT_PAUSE_MS);
}

function loadRound() {
  phase = 'active';
  const pz = getPuzzle();
  zoneRots = []; zoneSolved = [];
  for (let i = 0; i < playerCount; i++) {
    const rots = pz.cells.map(c => c.fixed ? c.rot : (c.initial !== undefined ? c.initial : 0));
    zoneRots.push(rots);
    zoneSolved.push(false);
    const zone = getZone(i);
    if (zone) zone.classList.remove('solved', 'locked');
    renderPipes(i);
  }
  questionCounter.textContent = `${roundIdx + 1} / ${TOTAL_ROUNDS}`;
  problemStatus.textContent = '파이프를 탭해서 회전!';
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
