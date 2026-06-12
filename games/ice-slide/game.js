/* games/ice-slide/game.js — 펭귄 빙판길 (미끄럼 퍼즐 2~4인 동시 레이스) */
'use strict';

const ICE_TOTAL_ROUNDS = 4;
const ICE_ROUND_TIME = 60;
const ICE_RESULT_PAUSE_MS = getAutoplayPauseMs(2200);
const ICE_GRID = 7; // 7x7

const ICE_PLAYER_CONFIG = [
  { label: 'P1', dot: '#0288D1', cls: 'p1' },
  { label: 'P2', dot: '#E53935', cls: 'p2' },
  { label: 'P3', dot: '#388E3C', cls: 'p3' },
  { label: 'P4', dot: '#F57C00', cls: 'p4' },
];

/*
 * 레벨 라이브러리 10개 — 하드코딩
 * penguin: {row, col} 시작
 * fish: {row, col} 목표 (도착 시 성공)
 * rocks: [{row, col}, ...] 내부 바위 (가장자리는 항상 벽)
 *
 * 미끄럼 규칙: 방향으로 계속 이동, 벽(가장자리) 또는 바위 직전에 멈춤
 */
const ICE_LEVEL_LIBRARY = [
  // 라운드 1용 — 간단 (바위 2개)
  {
    penguin: { row: 1, col: 1 },
    fish: { row: 1, col: 5 },
    rocks: [{ row: 3, col: 3 }],
  },
  {
    penguin: { row: 5, col: 1 },
    fish: { row: 1, col: 1 },
    rocks: [{ row: 3, col: 2 }],
  },
  // 라운드 2용 — 바위 2~3개
  {
    penguin: { row: 1, col: 1 },
    fish: { row: 4, col: 4 },
    rocks: [{ row: 4, col: 1 }, { row: 1, col: 4 }],
  },
  {
    penguin: { row: 1, col: 5 },
    fish: { row: 4, col: 2 },
    rocks: [{ row: 1, col: 2 }, { row: 4, col: 5 }],
  },
  // 라운드 3용 — 바위 3~4개
  {
    penguin: { row: 1, col: 1 },
    fish: { row: 3, col: 5 },
    rocks: [{ row: 1, col: 5 }, { row: 5, col: 3 }, { row: 3, col: 1 }],
  },
  {
    penguin: { row: 5, col: 5 },
    fish: { row: 2, col: 2 },
    rocks: [{ row: 2, col: 5 }, { row: 5, col: 2 }, { row: 2, col: 3 }],
  },
  {
    penguin: { row: 1, col: 3 },
    fish: { row: 4, col: 1 },
    rocks: [{ row: 3, col: 3 }, { row: 1, col: 1 }, { row: 4, col: 3 }],
  },
  // 라운드 4용 — 바위 4~5개 (복잡)
  {
    penguin: { row: 1, col: 1 },
    fish: { row: 3, col: 4 },
    rocks: [{ row: 3, col: 1 }, { row: 1, col: 4 }, { row: 5, col: 4 }, { row: 3, col: 2 }],
  },
  {
    penguin: { row: 5, col: 1 },
    fish: { row: 2, col: 4 },
    rocks: [{ row: 2, col: 1 }, { row: 5, col: 4 }, { row: 2, col: 2 }, { row: 4, col: 4 }],
  },
  {
    penguin: { row: 1, col: 5 },
    fish: { row: 4, col: 2 },
    rocks: [{ row: 4, col: 5 }, { row: 1, col: 2 }, { row: 4, col: 4 }, { row: 2, col: 2 }, { row: 3, col: 5 }],
  },
];

// 4라운드 레벨 매핑
const ICE_ROUND_LEVELS = [0, 2, 4, 7];

// ─── 미끄럼 BFS 자가검증 ─────────────────────────────────────
function iceBfsVerify(levelDef) {
  const { penguin, fish, rocks } = levelDef;
  const rockSet = new Set(rocks.map(r => r.row * ICE_GRID + r.col));

  function slide(row, col, dr, dc) {
    let r = row + dr, c = col + dc;
    while (r > 0 && r < ICE_GRID - 1 && c > 0 && c < ICE_GRID - 1 && !rockSet.has(r * ICE_GRID + c)) {
      r += dr; c += dc;
    }
    // 벽 또는 바위 직전에 멈춤
    r -= dr; c -= dc;
    return { row: r, col: c };
  }

  const start = penguin.row * ICE_GRID + penguin.col;
  const goal = fish.row * ICE_GRID + fish.col;
  const visited = new Set([start]);
  const queue = [{ row: penguin.row, col: penguin.col }];
  const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
  const limit = 5000;
  let iters = 0;
  while (queue.length > 0 && iters < limit) {
    iters++;
    const cur = queue.shift();
    for (const [dr, dc] of dirs) {
      const dest = slide(cur.row, cur.col, dr, dc);
      const key = dest.row * ICE_GRID + dest.col;
      if (key === goal) return true;
      if (!visited.has(key)) {
        visited.add(key);
        queue.push(dest);
      }
    }
  }
  return false;
}

ICE_LEVEL_LIBRARY.forEach((lv, i) => {
  if (!iceBfsVerify(lv)) {
    console.warn(`[ice-slide] Level ${i} BFS: no solution found`);
  }
});

// ─── Sound ───────────────────────────────────────────────────
const iceSound = createSoundManager({
  slide(ctx) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type = 'sine';
    o.frequency.setValueAtTime(800, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.2);
    g.gain.setValueAtTime(0.18, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
    o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.22);
  },
  bump(ctx) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type = 'square';
    o.frequency.setValueAtTime(200, ctx.currentTime);
    g.gain.setValueAtTime(0.2, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.12);
  },
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

// ─── State ───────────────────────────────────────────────────
let icePlayerCount = 2;
let iceRoundIdx = 0;
let iceScores = [];
let iceRoundResults = [];
let icePenguinPos = [];   // [{row, col}] per player
let iceMoves = [];
let iceSolved = [];
let icePhase = 'idle';
let iceTimerHandle = null;
let iceNextHandle = null;
let iceTimeRemaining = ICE_ROUND_TIME;
let iceCurLevelDef = null;
let iceRockSet = null;    // Set of rock positions (row*GRID+col)

const iceIntroScreen = document.getElementById('introScreen');
const iceCountdownScreen = document.getElementById('countdownScreen');
const iceCountdownNumber = document.getElementById('countdownNumber');
const iceGameScreen = document.getElementById('gameScreen');
const iceResultScreen = document.getElementById('resultScreen');
const iceBackBtn = document.getElementById('backBtn');
const icePlayBtn = document.getElementById('playBtn');
const iceCloseBtn = document.getElementById('closeBtn');
const iceRetryBtn = document.getElementById('retryBtn');
const iceHomeBtn = document.getElementById('homeBtn');
const iceZonesWrap = document.getElementById('zonesWrap');
const iceQuestionCounter = document.getElementById('questionCounter');
const iceProblemTimer = document.getElementById('problemTimer');
const iceProblemStatus = document.getElementById('problemStatus');
const iceScoreBar = document.getElementById('scoreBar');
const iceSoundToggleIntro = document.getElementById('soundToggleIntro');
const iceResultTitle = document.getElementById('resultTitle');
const iceResultWinner = document.getElementById('resultWinner');
const iceTotalRow = document.getElementById('totalRow');

function iceShowScreen(s) {
  [iceIntroScreen, iceCountdownScreen, iceGameScreen, iceResultScreen].forEach(x => x.classList.remove('active'));
  s.classList.add('active');
}

let iceCountdownInterval = null;
function iceStartPreGameCountdown(onDone) {
  iceShowScreen(iceCountdownScreen);
  let count = 3;
  iceCountdownNumber.textContent = count;
  iceCountdownInterval = setInterval(() => {
    count--;
    if (count <= 0) { clearInterval(iceCountdownInterval); iceCountdownInterval = null; onDone(); }
    else {
      iceCountdownNumber.textContent = count;
      iceCountdownNumber.style.animation = 'none';
      iceCountdownNumber.offsetHeight;
      iceCountdownNumber.style.animation = '';
    }
  }, 1000);
}

function iceClearTimers() {
  if (iceCountdownInterval) { clearInterval(iceCountdownInterval); iceCountdownInterval = null; }
  if (iceTimerHandle) { clearInterval(iceTimerHandle); iceTimerHandle = null; }
  if (iceNextHandle) { clearTimeout(iceNextHandle); iceNextHandle = null; }
}

function iceUpdateSoundBtn(btn) { btn.textContent = iceSound.isMuted() ? '🔇' : '🔊'; }

// ─── 미끄럼 이동 계산 ─────────────────────────────────────
function iceSlideTo(row, col, dr, dc) {
  let r = row + dr, c = col + dc;
  while (r > 0 && r < ICE_GRID - 1 && c > 0 && c < ICE_GRID - 1 && !iceRockSet.has(r * ICE_GRID + c)) {
    r += dr; c += dc;
  }
  // 벽 또는 바위 직전
  r -= dr; c -= dc;
  return { row: r, col: c };
}

// ─── 존 구성 ───────────────────────────────────────────────
function iceBuildZones() {
  iceZonesWrap.innerHTML = '';
  iceZonesWrap.className = `zones-wrap p${icePlayerCount}`;
  for (let i = 0; i < icePlayerCount; i++) {
    const cfg = ICE_PLAYER_CONFIG[i];
    const zone = document.createElement('div');
    zone.className = `zone ${cfg.cls}`;
    zone.dataset.player = i;
    zone.innerHTML = `
      <div class="zone-header">
        <span class="zone-label">${cfg.label}</span>
        <span class="zone-moves" id="ice-moves-${i}">이동 0</span>
      </div>
      <div class="ice-grid-wrap" id="ice-wrap-${i}">
        <div class="ice-grid" id="ice-grid-${i}"></div>
      </div>
      <div class="ice-dpad" id="ice-dpad-${i}">
        <button class="ice-dpad-btn dpad-ice-up" id="ice-up-${i}" aria-label="위">⬆️</button>
        <button class="ice-dpad-btn dpad-ice-left" id="ice-left-${i}" aria-label="왼쪽">⬅️</button>
        <button class="ice-dpad-btn dpad-ice-right" id="ice-right-${i}" aria-label="오른쪽">➡️</button>
        <button class="ice-dpad-btn dpad-ice-down" id="ice-down-${i}" aria-label="아래">⬇️</button>
      </div>`;
    iceZonesWrap.appendChild(zone);
    const dirs = { up: [-1,0], down: [1,0], left: [0,-1], right: [0,1] };
    Object.entries(dirs).forEach(([dir, [dr, dc]]) => {
      const btn = document.getElementById(`ice-${dir}-${i}`);
      if (btn) onTap(btn, () => iceHandleMove(i, dr, dc));
    });
  }
}

function iceGetZone(idx) { return iceZonesWrap.querySelector(`.zone[data-player="${idx}"]`); }

// ─── 렌더링 ───────────────────────────────────────────────
function iceRenderBoard(playerIdx) {
  const gridEl = document.getElementById(`ice-grid-${playerIdx}`);
  if (!gridEl) return;
  const wrap = document.getElementById(`ice-wrap-${playerIdx}`);
  const wrapW = wrap ? wrap.offsetWidth : 120;
  const wrapH = wrap ? wrap.offsetHeight : 120;
  const sz = Math.min(wrapW - 8, wrapH - 8, 200);
  const cellSz = sz / ICE_GRID;
  gridEl.style.width = sz + 'px';
  gridEl.style.height = sz + 'px';
  gridEl.innerHTML = '';

  // 셀 격자 레이어
  const cellGrid = document.createElement('div');
  cellGrid.className = 'ice-cell-grid';
  cellGrid.style.gridTemplateColumns = `repeat(${ICE_GRID}, 1fr)`;
  cellGrid.style.gridTemplateRows = `repeat(${ICE_GRID}, 1fr)`;
  for (let r = 0; r < ICE_GRID; r++) {
    for (let c = 0; c < ICE_GRID; c++) {
      const cell = document.createElement('div');
      if (r === 0 || r === ICE_GRID - 1 || c === 0 || c === ICE_GRID - 1) {
        cell.className = 'ice-cell wall-cell';
      } else {
        cell.className = 'ice-cell';
      }
      cellGrid.appendChild(cell);
    }
  }
  gridEl.appendChild(cellGrid);

  if (!iceCurLevelDef) return;

  // 바위
  for (const rock of iceCurLevelDef.rocks) {
    const el = document.createElement('div');
    el.className = 'ice-obj rock';
    el.style.top = (rock.row * cellSz + 1) + 'px';
    el.style.left = (rock.col * cellSz + 1) + 'px';
    el.style.width = (cellSz - 2) + 'px';
    el.style.height = (cellSz - 2) + 'px';
    el.textContent = '🪨';
    gridEl.appendChild(el);
  }

  // 물고기
  const fish = iceCurLevelDef.fish;
  const fishEl = document.createElement('div');
  fishEl.className = 'ice-obj fish';
  fishEl.style.top = (fish.row * cellSz + 2) + 'px';
  fishEl.style.left = (fish.col * cellSz + 2) + 'px';
  fishEl.style.width = (cellSz - 4) + 'px';
  fishEl.style.height = (cellSz - 4) + 'px';
  fishEl.textContent = '🐟';
  gridEl.appendChild(fishEl);

  // 펭귄
  const pos = icePenguinPos[playerIdx];
  const penguinEl = document.createElement('div');
  penguinEl.className = 'ice-obj penguin';
  penguinEl.id = `penguin-${playerIdx}`;
  penguinEl.style.top = (pos.row * cellSz + 1) + 'px';
  penguinEl.style.left = (pos.col * cellSz + 1) + 'px';
  penguinEl.style.width = (cellSz - 2) + 'px';
  penguinEl.style.height = (cellSz - 2) + 'px';
  penguinEl.textContent = '🐧';
  gridEl.appendChild(penguinEl);
}

function iceAnimatePenguin(playerIdx, toRow, toCol, onDone) {
  const gridEl = document.getElementById(`ice-grid-${playerIdx}`);
  if (!gridEl) { if (onDone) onDone(); return; }
  const wrap = document.getElementById(`ice-wrap-${playerIdx}`);
  const wrapW = wrap ? wrap.offsetWidth : 120;
  const wrapH = wrap ? wrap.offsetHeight : 120;
  const sz = Math.min(wrapW - 8, wrapH - 8, 200);
  const cellSz = sz / ICE_GRID;

  const penguinEl = document.getElementById(`penguin-${playerIdx}`);
  if (!penguinEl) { if (onDone) onDone(); return; }
  penguinEl.style.top = (toRow * cellSz + 1) + 'px';
  penguinEl.style.left = (toCol * cellSz + 1) + 'px';
  // CSS transition handles the animation (0.18s)
  setTimeout(() => { if (onDone) onDone(); }, 200);
}

// ─── 이동 처리 ───────────────────────────────────────────────
function iceHandleMove(playerIdx, dr, dc) {
  if (icePhase !== 'active' || iceSolved[playerIdx]) return;
  const cur = icePenguinPos[playerIdx];
  const dest = iceSlideTo(cur.row, cur.col, dr, dc);

  // 제자리 (움직임 없음) = 막혀 있음
  if (dest.row === cur.row && dest.col === cur.col) {
    iceSound.play('bump');
    return;
  }

  iceMoves[playerIdx]++;
  const movesEl = document.getElementById(`ice-moves-${playerIdx}`);
  if (movesEl) movesEl.textContent = `이동 ${iceMoves[playerIdx]}`;

  iceSound.play('slide');

  // 애니메이션 먼저, 그 후 상태 업데이트
  iceAnimatePenguin(playerIdx, dest.row, dest.col, () => {
    icePenguinPos[playerIdx] = { row: dest.row, col: dest.col };
    const fish = iceCurLevelDef.fish;
    if (dest.row === fish.row && dest.col === fish.col) {
      iceSolvePuzzle(playerIdx);
    }
  });
}

function iceSolvePuzzle(playerIdx) {
  if (iceSolved[playerIdx]) return;
  iceSolved[playerIdx] = true;
  const zone = iceGetZone(playerIdx);
  if (zone) zone.classList.add('solved');

  if (iceRoundResults.length === iceRoundIdx) {
    iceRoundResults.push({ winnerIdx: playerIdx, timedOut: false });
    iceScores[playerIdx]++;
    iceUpdateBarScore(playerIdx);
    iceSound.play('ding');
    iceProblemStatus.textContent = `${ICE_PLAYER_CONFIG[playerIdx].label} 도착! (${iceMoves[playerIdx]}번 이동)`;
    for (let i = 0; i < icePlayerCount; i++) {
      if (i !== playerIdx && !iceSolved[i]) { const z = iceGetZone(i); if (z) z.classList.add('locked'); }
    }
    icePhase = 'done';
    iceClearTimers();
    iceNextHandle = setTimeout(() => iceNextRound(), ICE_RESULT_PAUSE_MS);
  }
}

function iceHandleTimeout() {
  if (icePhase !== 'active') return;
  icePhase = 'done';
  iceSound.play('timeout');
  for (let i = 0; i < icePlayerCount; i++) {
    if (!iceSolved[i]) { const z = iceGetZone(i); if (z) z.classList.add('locked'); }
  }
  iceRoundResults.push({ winnerIdx: -1, timedOut: true });
  iceProblemStatus.textContent = '시간 초과! 다음 라운드로';
  iceNextHandle = setTimeout(() => iceNextRound(), ICE_RESULT_PAUSE_MS);
}

// ─── 점수 바 ───────────────────────────────────────────────
function iceBuildScoreBar() {
  iceScoreBar.innerHTML = '';
  for (let i = 0; i < icePlayerCount; i++) {
    const cfg = ICE_PLAYER_CONFIG[i];
    const chip = document.createElement('div');
    chip.className = 'score-chip';
    chip.innerHTML = `<span class="score-chip-dot" style="background:${cfg.dot}"></span><span>${cfg.label}</span><span class="score-chip-val" id="ice-bar-score-${i}">0</span>`;
    iceScoreBar.appendChild(chip);
  }
}
function iceUpdateBarScore(idx) { const el = document.getElementById(`ice-bar-score-${idx}`); if (el) el.textContent = iceScores[idx]; }

// ─── 타이머 ───────────────────────────────────────────────
function iceStartCountdown() {
  iceTimeRemaining = ICE_ROUND_TIME;
  iceProblemTimer.textContent = iceTimeRemaining;
  iceProblemTimer.classList.remove('urgent');
  iceTimerHandle = setInterval(() => {
    iceTimeRemaining--;
    iceProblemTimer.textContent = iceTimeRemaining;
    if (iceTimeRemaining <= 5) { iceProblemTimer.classList.add('urgent'); iceSound.play('tick'); }
    if (iceTimeRemaining <= 0) { iceClearTimers(); iceHandleTimeout(); }
  }, 1000);
}

// ─── 게임 흐름 ───────────────────────────────────────────────
function iceLoadRound() {
  icePhase = 'active';
  iceCurLevelDef = ICE_LEVEL_LIBRARY[ICE_ROUND_LEVELS[iceRoundIdx % ICE_ROUND_LEVELS.length]];
  iceRockSet = new Set(iceCurLevelDef.rocks.map(r => r.row * ICE_GRID + r.col));

  icePenguinPos = [];
  iceMoves = [];
  iceSolved = [];

  for (let i = 0; i < icePlayerCount; i++) {
    icePenguinPos.push({ ...iceCurLevelDef.penguin });
    iceMoves.push(0);
    iceSolved.push(false);
    const zone = iceGetZone(i);
    if (zone) zone.classList.remove('solved', 'locked');
  }

  iceQuestionCounter.textContent = `${iceRoundIdx + 1} / ${ICE_TOTAL_ROUNDS}`;
  iceProblemStatus.textContent = '펭귄🐧을 물고기🐟 위로!';

  for (let i = 0; i < icePlayerCount; i++) iceRenderBoard(i);
  requestAnimationFrame(() => {
    for (let i = 0; i < icePlayerCount; i++) iceRenderBoard(i);
  });
  iceStartCountdown();
}

function iceNextRound() {
  iceRoundIdx++;
  if (iceRoundIdx >= ICE_TOTAL_ROUNDS) iceShowResult();
  else iceLoadRound();
}

function iceStartGame() {
  iceRoundIdx = 0;
  iceScores = new Array(icePlayerCount).fill(0);
  iceRoundResults = [];
  icePhase = 'idle';
  iceClearTimers();
  iceBuildZones();
  iceBuildScoreBar();
  iceShowScreen(iceGameScreen);
  iceLoadRound();
}

function iceShowResult() {
  iceClearTimers();
  icePhase = 'idle';
  iceSound.play('fanfare');
  const max = Math.max(...iceScores);
  const winners = iceScores.map((s, i) => ({ s, i })).filter(x => x.s === max).map(x => x.i);
  if (max === 0) { iceResultTitle.textContent = '무승부!'; iceResultWinner.textContent = '아무도 완성하지 못했어요.'; }
  else if (winners.length === 1) { iceResultTitle.textContent = '게임 종료!'; iceResultWinner.textContent = `${ICE_PLAYER_CONFIG[winners[0]].label} 우승! (${max}승)`; }
  else { const labels = winners.map(w => ICE_PLAYER_CONFIG[w].label).join(', '); iceResultTitle.textContent = '동점!'; iceResultWinner.textContent = `${labels} 공동 1위! (${max}승)`; }
  iceTotalRow.innerHTML = '';
  for (let i = 0; i < icePlayerCount; i++) {
    const cfg = ICE_PLAYER_CONFIG[i]; const isWin = winners.includes(i) && max > 0;
    const chip = document.createElement('div'); chip.className = 'total-chip';
    chip.innerHTML = `<span class="chip-dot" style="background:${cfg.dot}"></span><span>${cfg.label}</span><span class="chip-score" style="color:${isWin ? '#2E7D32' : '#555'}">${iceScores[i]}승</span>${isWin ? '<span style="font-size:1.1rem;">★</span>' : ''}`;
    iceTotalRow.appendChild(chip);
  }
  iceShowScreen(iceResultScreen);
}

// ─── 인원 선택 ───────────────────────────────────────────────
document.querySelectorAll('.player-btn').forEach(btn => {
  onTap(btn, () => {
    document.querySelectorAll('.player-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    icePlayerCount = parseInt(btn.dataset.count, 10);
  });
});

// ─── 이벤트 바인딩 ───────────────────────────────────────────
onTap(iceSoundToggleIntro, () => { iceSound.toggleMute(); iceUpdateSoundBtn(iceSoundToggleIntro); });
iceUpdateSoundBtn(iceSoundToggleIntro);
onTap(iceBackBtn, () => goHome());
onTap(iceCloseBtn, () => { iceClearTimers(); goHome(); });
onTap(iceHomeBtn, () => goHome());
onTap(iceRetryBtn, () => iceStartPreGameCountdown(() => iceStartGame()));
onTap(icePlayBtn, () => iceStartPreGameCountdown(() => iceStartGame()));
