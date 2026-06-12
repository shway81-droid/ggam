/* games/car-escape/game.js — 차 빼기 (러시아워 2~4인 동시 레이스) */
'use strict';

const TOTAL_ROUNDS = 3;
const ROUND_TIME = 90;
const RESULT_PAUSE_MS = getAutoplayPauseMs(2200);
const GRID = 6;

const PLAYER_CONFIG = [
  { label: 'P1', dot: '#0288D1', cls: 'p1' },
  { label: 'P2', dot: '#E53935', cls: 'p2' },
  { label: 'P3', dot: '#388E3C', cls: 'p3' },
  { label: 'P4', dot: '#F57C00', cls: 'p4' },
];

/*
 * 레벨 라이브러리 8개 — 하드코딩 (BFS 자가검증 아래 수행)
 * 형식: { cars: [ { id, row, col, len, horiz } ], redRow }
 * id=0 이 빨간 차 (horiz=true, 오른쪽 출구 = row 2 기준)
 * 출구: 오른쪽 벽 row=redRow
 */
const LEVEL_LIBRARY = [
  // 레벨 1 — 차 3대 (매우 쉬움)
  {
    cars: [
      { id: 0, row: 2, col: 1, len: 2, horiz: true },   // 빨간 차
      { id: 1, row: 0, col: 3, len: 2, horiz: false },
      { id: 2, row: 3, col: 3, len: 2, horiz: true },
    ],
    redRow: 2,
  },
  // 레벨 2 — 차 4대 (쉬움)
  {
    cars: [
      { id: 0, row: 2, col: 0, len: 2, horiz: true },
      { id: 1, row: 0, col: 2, len: 2, horiz: false },
      { id: 2, row: 3, col: 2, len: 2, horiz: false },
      { id: 3, row: 4, col: 0, len: 2, horiz: true },
    ],
    redRow: 2,
  },
  // 레벨 3 — 차 4대 (보통 쉬움)
  {
    cars: [
      { id: 0, row: 2, col: 0, len: 2, horiz: true },
      { id: 1, row: 0, col: 3, len: 3, horiz: false },
      { id: 2, row: 3, col: 0, len: 2, horiz: true },
      { id: 3, row: 3, col: 4, len: 2, horiz: false },
    ],
    redRow: 2,
  },
  // 레벨 4 — 차 5대 (보통)
  {
    cars: [
      { id: 0, row: 2, col: 1, len: 2, horiz: true },
      { id: 1, row: 0, col: 3, len: 2, horiz: false },
      { id: 2, row: 2, col: 4, len: 2, horiz: false },
      { id: 3, row: 4, col: 1, len: 2, horiz: true },
      { id: 4, row: 0, col: 5, len: 3, horiz: false },
    ],
    redRow: 2,
  },
  // 레벨 5 — 차 5대 (보통 어려움)
  {
    cars: [
      { id: 0, row: 2, col: 0, len: 2, horiz: true },
      { id: 1, row: 0, col: 2, len: 3, horiz: false },
      { id: 2, row: 3, col: 2, len: 2, horiz: true },
      { id: 3, row: 1, col: 4, len: 2, horiz: false },
      { id: 4, row: 4, col: 0, len: 3, horiz: true },
    ],
    redRow: 2,
  },
  // 레벨 6 — 차 5대 (어려움)
  {
    cars: [
      { id: 0, row: 2, col: 0, len: 2, horiz: true },
      { id: 1, row: 0, col: 2, len: 2, horiz: false },
      { id: 2, row: 2, col: 3, len: 2, horiz: false },
      { id: 3, row: 4, col: 2, len: 2, horiz: true },
      { id: 4, row: 0, col: 4, len: 3, horiz: false },
      { id: 5, row: 3, col: 0, len: 2, horiz: true },
    ],
    redRow: 2,
  },
  // 레벨 7 — 차 6대 (매우 어려움)
  {
    cars: [
      { id: 0, row: 2, col: 0, len: 2, horiz: true },
      { id: 1, row: 0, col: 2, len: 2, horiz: false },
      { id: 2, row: 2, col: 3, len: 2, horiz: false },
      { id: 3, row: 4, col: 0, len: 2, horiz: true },
      { id: 4, row: 0, col: 4, len: 2, horiz: false },
      { id: 5, row: 3, col: 3, len: 2, horiz: true },
      { id: 6, row: 1, col: 0, len: 2, horiz: true },
    ],
    redRow: 2,
  },
  // 레벨 8 — 차 6대 (최고 난이도)
  {
    cars: [
      { id: 0, row: 2, col: 0, len: 2, horiz: true },
      { id: 1, row: 0, col: 2, len: 3, horiz: false },
      { id: 2, row: 1, col: 4, len: 2, horiz: false },
      { id: 3, row: 3, col: 3, len: 2, horiz: false },
      { id: 4, row: 4, col: 1, len: 2, horiz: true },
      { id: 5, row: 4, col: 4, len: 2, horiz: false },
      { id: 6, row: 0, col: 0, len: 2, horiz: true },
    ],
    redRow: 2,
  },
];

// 3라운드: 레벨 인덱스 (쉬움→중간→어려움)
const ROUND_LEVELS = [0, 3, 6];

// ─── BFS 자가검증 (개발 검증용) ───────────────────────────────
function encodeState(cars) {
  return cars.map(c => `${c.row},${c.col}`).join('|');
}
function bfsVerify(levelDef) {
  const init = levelDef.cars.map(c => ({ ...c }));
  const redRow = levelDef.redRow;
  const start = encodeState(init);
  const queue = [init];
  const visited = new Set([start]);
  const limit = 80000;
  let iters = 0;
  while (queue.length > 0 && iters < limit) {
    iters++;
    const state = queue.shift();
    const red = state.find(c => c.id === 0);
    // 빨간 차 오른쪽 끝이 5(=GRID-1) 이상이면 탈출
    if (red.col + red.len - 1 >= GRID - 1) return true;
    // 빈 칸 맵
    const occupied = new Set();
    for (const car of state) {
      for (let k = 0; k < car.len; k++) {
        occupied.add(car.horiz
          ? car.row * GRID + car.col + k
          : (car.row + k) * GRID + car.col);
      }
    }
    for (let ci = 0; ci < state.length; ci++) {
      const car = state[ci];
      for (const delta of [-1, 1]) {
        let nr = car.row, nc = car.col;
        if (car.horiz) nc += delta;
        else nr += delta;
        if (nr < 0 || nc < 0 || nr >= GRID || nc >= GRID) continue;
        // 이동했을 때 차가 차지하는 셀
        const newCells = [];
        for (let k = 0; k < car.len; k++) {
          newCells.push(car.horiz
            ? nr * GRID + nc + k
            : (nr + k) * GRID + nc);
        }
        if (newCells[0] < 0 || newCells[newCells.length - 1] >= GRID * GRID) continue;
        // 범위 체크
        const rEnd = car.horiz ? nr : nr + car.len - 1;
        const cEnd = car.horiz ? nc + car.len - 1 : nc;
        if (rEnd >= GRID || cEnd >= GRID) continue;
        // 충돌: 자기 자신 빼고
        const ownCells = new Set();
        for (let k = 0; k < car.len; k++) {
          ownCells.add(car.horiz
            ? car.row * GRID + car.col + k
            : (car.row + k) * GRID + car.col);
        }
        const blocked = newCells.some(cell => occupied.has(cell) && !ownCells.has(cell));
        if (blocked) continue;
        const newState = state.map((c, idx) => idx === ci ? { ...c, row: nr, col: nc } : c);
        const key = encodeState(newState);
        if (!visited.has(key)) {
          visited.add(key);
          queue.push(newState);
        }
      }
    }
  }
  return false;
}

// 게임 로드 시 자가검증
LEVEL_LIBRARY.forEach((lv, i) => {
  if (!bfsVerify(lv)) {
    console.warn(`[car-escape] Level ${i} BFS: no solution found`);
  }
});

// ─── Sound ───────────────────────────────────────────────────
const carSound = createSoundManager({
  move(ctx) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type = 'sine';
    o.frequency.setValueAtTime(520, ctx.currentTime);
    g.gain.setValueAtTime(0.12, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.07);
    o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.07);
  },
  buzz(ctx) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type = 'sawtooth';
    o.frequency.setValueAtTime(160, ctx.currentTime);
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.1);
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
let carPlayerCount = 2;
let carRoundIdx = 0;
let carScores = [];
let carRoundResults = [];
let carZoneStates = [];   // [ [ {id, row, col, len, horiz}, ... ] ]
let carZoneMoves = [];
let carZoneSolved = [];
let carSelectedCar = [];  // per-player selected car id (-1 = none)
let carPhase = 'idle';
let carTimerHandle = null;
let carNextHandle = null;
let carTimeRemaining = ROUND_TIME;
let carRedRow = 2;

const carIntroScreen = document.getElementById('introScreen');
const carCountdownScreen = document.getElementById('countdownScreen');
const carCountdownNumber = document.getElementById('countdownNumber');
const carGameScreen = document.getElementById('gameScreen');
const carResultScreen = document.getElementById('resultScreen');
const carBackBtn = document.getElementById('backBtn');
const carPlayBtn = document.getElementById('playBtn');
const carCloseBtn = document.getElementById('closeBtn');
const carRetryBtn = document.getElementById('retryBtn');
const carHomeBtn = document.getElementById('homeBtn');
const carZonesWrap = document.getElementById('zonesWrap');
const carQuestionCounter = document.getElementById('questionCounter');
const carProblemTimer = document.getElementById('problemTimer');
const carProblemStatus = document.getElementById('problemStatus');
const carScoreBar = document.getElementById('scoreBar');
const carSoundToggleIntro = document.getElementById('soundToggleIntro');
const carResultTitle = document.getElementById('resultTitle');
const carResultWinner = document.getElementById('resultWinner');
const carTotalRow = document.getElementById('totalRow');

function showScreen(s) {
  [carIntroScreen, carCountdownScreen, carGameScreen, carResultScreen].forEach(x => x.classList.remove('active'));
  s.classList.add('active');
}

let carCountdownInterval = null;
function startPreGameCountdown(onDone) {
  showScreen(carCountdownScreen);
  let count = 3;
  carCountdownNumber.textContent = count;
  carCountdownInterval = setInterval(() => {
    count--;
    if (count <= 0) { clearInterval(carCountdownInterval); carCountdownInterval = null; onDone(); }
    else {
      carCountdownNumber.textContent = count;
      carCountdownNumber.style.animation = 'none';
      carCountdownNumber.offsetHeight; // reflow
      carCountdownNumber.style.animation = '';
    }
  }, 1000);
}

function clearTimers() {
  if (carCountdownInterval) { clearInterval(carCountdownInterval); carCountdownInterval = null; }
  if (carTimerHandle) { clearInterval(carTimerHandle); carTimerHandle = null; }
  if (carNextHandle) { clearTimeout(carNextHandle); carNextHandle = null; }
}

function updateSoundBtn(btn) { btn.textContent = carSound.isMuted() ? '🔇' : '🔊'; }

// ─── 레벨 로직 ───────────────────────────────────────────────
function getLevelDef() {
  return LEVEL_LIBRARY[ROUND_LEVELS[carRoundIdx % ROUND_LEVELS.length]];
}
function cloneState(cars) {
  return cars.map(c => ({ ...c }));
}

// 충돌 체크용 occupied set
function buildOccupied(cars, excludeId) {
  const set = new Set();
  for (const car of cars) {
    if (car.id === excludeId) continue;
    for (let k = 0; k < car.len; k++) {
      set.add(car.horiz
        ? car.row * GRID + car.col + k
        : (car.row + k) * GRID + car.col);
    }
  }
  return set;
}

function canMoveCar(cars, carId, delta) {
  const car = cars.find(c => c.id === carId);
  if (!car) return false;
  const occupied = buildOccupied(cars, carId);
  const nr = car.horiz ? car.row : car.row + delta;
  const nc = car.horiz ? car.col + delta : car.col;
  for (let k = 0; k < car.len; k++) {
    const r = car.horiz ? nr : nr + k;
    const c = car.horiz ? nc + k : nc;
    if (r < 0 || r >= GRID || c < 0 || c >= GRID) return false;
    if (occupied.has(r * GRID + c)) return false;
  }
  return true;
}

function moveCar(cars, carId, delta) {
  return cars.map(c => {
    if (c.id !== carId) return c;
    return c.horiz
      ? { ...c, col: c.col + delta }
      : { ...c, row: c.row + delta };
  });
}

function isEscaped(cars) {
  const red = cars.find(c => c.id === 0);
  if (!red) return false;
  return red.col + red.len - 1 >= GRID - 1 && red.horiz;
}

// ─── 존 구성 ───────────────────────────────────────────────
function buildZones() {
  carZonesWrap.innerHTML = '';
  carZonesWrap.className = `zones-wrap p${carPlayerCount}`;
  for (let i = 0; i < carPlayerCount; i++) {
    const cfg = PLAYER_CONFIG[i];
    const zone = document.createElement('div');
    zone.className = `zone ${cfg.cls}`;
    zone.dataset.player = i;
    zone.innerHTML = `
      <div class="zone-header">
        <span class="zone-label">${cfg.label}</span>
        <span class="zone-moves" id="car-moves-${i}">이동 0</span>
      </div>
      <div class="rh-grid-wrap" id="rh-wrap-${i}">
        <div class="rh-grid" id="rh-grid-${i}" style="width:100%;height:100%;"></div>
      </div>
      <div class="car-controls" id="car-ctrl-${i}">
        <div class="car-ctrl-row">
          <div class="car-ctrl-spacer"></div>
          <button class="car-ctrl-btn" id="btn-up-${i}" data-player="${i}" data-dir="up">⬆️</button>
          <div class="car-ctrl-spacer"></div>
        </div>
        <div class="car-ctrl-row">
          <button class="car-ctrl-btn" id="btn-left-${i}" data-player="${i}" data-dir="left">⬅️</button>
          <button class="car-ctrl-btn" id="btn-desel-${i}" data-player="${i}" data-dir="desel" style="font-size:1rem;opacity:0.7;pointer-events:auto;">✖</button>
          <button class="car-ctrl-btn" id="btn-right-${i}" data-player="${i}" data-dir="right">➡️</button>
        </div>
        <div class="car-ctrl-row">
          <div class="car-ctrl-spacer"></div>
          <button class="car-ctrl-btn" id="btn-down-${i}" data-player="${i}" data-dir="down">⬇️</button>
          <div class="car-ctrl-spacer"></div>
        </div>
      </div>`;
    carZonesWrap.appendChild(zone);
    // bind control buttons
    ['up', 'left', 'right', 'down'].forEach(dir => {
      const btn = document.getElementById(`btn-${dir}-${i}`);
      if (btn) onTap(btn, () => handleCarMoveBtn(i, dir));
    });
    const deselBtn = document.getElementById(`btn-desel-${i}`);
    if (deselBtn) onTap(deselBtn, () => { carSelectedCar[i] = -1; renderBoard(i); });
  }
}

function getZone(idx) { return carZonesWrap.querySelector(`.zone[data-player="${idx}"]`); }

// ─── 렌더링 ───────────────────────────────────────────────
function renderBoard(playerIdx) {
  const gridEl = document.getElementById(`rh-grid-${playerIdx}`);
  if (!gridEl) return;
  gridEl.innerHTML = '';

  // 격자 선 레이어
  const cellGrid = document.createElement('div');
  cellGrid.className = 'rh-cell-grid';
  for (let i = 0; i < GRID * GRID; i++) {
    const cell = document.createElement('div');
    cell.className = 'rh-cell';
    cellGrid.appendChild(cell);
  }
  gridEl.appendChild(cellGrid);

  // 출구 표시
  const exit = document.createElement('div');
  exit.className = 'rh-exit';
  exit.textContent = '출구';
  gridEl.appendChild(exit);

  const cars = carZoneStates[playerIdx];
  const selectedId = carSelectedCar[playerIdx];

  // 격자 크기 계산
  const wrap = document.getElementById(`rh-wrap-${playerIdx}`);
  const wrapW = wrap ? wrap.offsetWidth : 120;
  const wrapH = wrap ? wrap.offsetHeight : 120;
  const sz = Math.min(wrapW - 16, wrapH - 8, 220);
  gridEl.style.width = sz + 'px';
  gridEl.style.height = sz + 'px';
  const cellSz = sz / GRID;

  for (const car of cars) {
    const el = document.createElement('div');
    el.className = 'rh-car ' + (car.id === 0 ? 'car-red' : 'car-gray');
    if (car.id === selectedId) el.classList.add('selected');

    const top = car.row * cellSz + 3;
    const left = car.col * cellSz + 3;
    const w = car.horiz ? car.len * cellSz - 6 : cellSz - 6;
    const h = car.horiz ? cellSz - 6 : car.len * cellSz - 6;

    el.style.top = top + 'px';
    el.style.left = left + 'px';
    el.style.width = w + 'px';
    el.style.height = h + 'px';
    el.textContent = car.id === 0 ? '🚗' : '🚙';

    onTap(el, () => handleCarSelect(playerIdx, car.id));
    gridEl.appendChild(el);
  }

  updateDirectionButtons(playerIdx);
}

function updateDirectionButtons(playerIdx) {
  const selId = carSelectedCar[playerIdx];
  const cars = carZoneStates[playerIdx];
  const dirs = ['up', 'left', 'right', 'down'];
  dirs.forEach(dir => {
    const btn = document.getElementById(`btn-${dir}-${playerIdx}`);
    if (!btn) return;
    btn.classList.remove('active');
    if (selId < 0) return;
    const car = cars.find(c => c.id === selId);
    if (!car) return;
    // 차 방향과 맞는 버튼만 활성화
    const isH = car.horiz;
    if ((dir === 'left' || dir === 'right') && !isH) return;
    if ((dir === 'up' || dir === 'down') && isH) return;
    const delta = (dir === 'right' || dir === 'down') ? 1 : -1;
    if (canMoveCar(cars, selId, delta)) btn.classList.add('active');
  });
}

function handleCarSelect(playerIdx, carId) {
  if (carPhase !== 'active' || carZoneSolved[playerIdx]) return;
  if (carSelectedCar[playerIdx] === carId) {
    carSelectedCar[playerIdx] = -1;
  } else {
    carSelectedCar[playerIdx] = carId;
  }
  renderBoard(playerIdx);
}

function handleCarMoveBtn(playerIdx, dir) {
  if (carPhase !== 'active' || carZoneSolved[playerIdx]) return;
  const selId = carSelectedCar[playerIdx];
  if (selId < 0) return;
  const cars = carZoneStates[playerIdx];
  const car = cars.find(c => c.id === selId);
  if (!car) return;

  const isH = car.horiz;
  if ((dir === 'left' || dir === 'right') && !isH) return;
  if ((dir === 'up' || dir === 'down') && isH) return;

  const delta = (dir === 'right' || dir === 'down') ? 1 : -1;
  if (!canMoveCar(cars, selId, delta)) {
    // 흔들기 애니메이션
    const gridEl = document.getElementById(`rh-grid-${playerIdx}`);
    if (gridEl) {
      const carEls = gridEl.querySelectorAll('.rh-car.selected');
      carEls.forEach(el => { el.classList.remove('shake'); void el.offsetHeight; el.classList.add('shake'); });
    }
    carSound.play('buzz');
    return;
  }

  carZoneStates[playerIdx] = moveCar(cars, selId, delta);
  carZoneMoves[playerIdx]++;
  carSound.play('move');

  const movesEl = document.getElementById(`car-moves-${playerIdx}`);
  if (movesEl) movesEl.textContent = `이동 ${carZoneMoves[playerIdx]}`;

  renderBoard(playerIdx);

  if (isEscaped(carZoneStates[playerIdx])) {
    handleSolve(playerIdx);
  }
}

// ─── 라운드 결과 ───────────────────────────────────────────
function handleSolve(winnerIdx) {
  if (carZoneSolved[winnerIdx]) return;
  carZoneSolved[winnerIdx] = true;
  const zone = getZone(winnerIdx);
  if (zone) zone.classList.add('solved');

  if (carRoundResults.length === carRoundIdx) {
    carRoundResults.push({ winnerIdx, timedOut: false });
    carScores[winnerIdx]++;
    updateBarScore(winnerIdx);
    carSound.play('ding');
    carProblemStatus.textContent = `${PLAYER_CONFIG[winnerIdx].label} 탈출! (${carZoneMoves[winnerIdx]}번 이동)`;
    for (let i = 0; i < carPlayerCount; i++) {
      if (i !== winnerIdx && !carZoneSolved[i]) { const z = getZone(i); if (z) z.classList.add('locked'); }
    }
    carPhase = 'done';
    clearTimers();
    carNextHandle = setTimeout(() => nextRound(), RESULT_PAUSE_MS);
  }
}

function handleTimeout() {
  if (carPhase !== 'active') return;
  carPhase = 'done';
  carSound.play('timeout');
  for (let i = 0; i < carPlayerCount; i++) {
    if (!carZoneSolved[i]) { const z = getZone(i); if (z) z.classList.add('locked'); }
  }
  carRoundResults.push({ winnerIdx: -1, timedOut: true });
  carProblemStatus.textContent = '시간 초과! 다음 라운드로';
  carNextHandle = setTimeout(() => nextRound(), RESULT_PAUSE_MS);
}

// ─── 점수 바 ───────────────────────────────────────────────
function buildScoreBar() {
  carScoreBar.innerHTML = '';
  for (let i = 0; i < carPlayerCount; i++) {
    const cfg = PLAYER_CONFIG[i];
    const chip = document.createElement('div');
    chip.className = 'score-chip';
    chip.innerHTML = `<span class="score-chip-dot" style="background:${cfg.dot}"></span><span>${cfg.label}</span><span class="score-chip-val" id="car-bar-score-${i}">0</span>`;
    carScoreBar.appendChild(chip);
  }
}
function updateBarScore(idx) { const el = document.getElementById(`car-bar-score-${idx}`); if (el) el.textContent = carScores[idx]; }

// ─── 타이머 ───────────────────────────────────────────────
function startCountdown() {
  carTimeRemaining = ROUND_TIME;
  carProblemTimer.textContent = carTimeRemaining;
  carProblemTimer.classList.remove('urgent');
  carTimerHandle = setInterval(() => {
    carTimeRemaining--;
    carProblemTimer.textContent = carTimeRemaining;
    if (carTimeRemaining <= 5) { carProblemTimer.classList.add('urgent'); carSound.play('tick'); }
    if (carTimeRemaining <= 0) { clearTimers(); handleTimeout(); }
  }, 1000);
}

// ─── 게임 흐름 ───────────────────────────────────────────────
function loadRound() {
  carPhase = 'active';
  const levelDef = getLevelDef();
  carRedRow = levelDef.redRow;
  carZoneStates = [];
  carZoneMoves = [];
  carZoneSolved = [];
  carSelectedCar = [];

  for (let i = 0; i < carPlayerCount; i++) {
    carZoneStates.push(cloneState(levelDef.cars));
    carZoneMoves.push(0);
    carZoneSolved.push(false);
    carSelectedCar.push(-1);
    const zone = getZone(i);
    if (zone) zone.classList.remove('solved', 'locked');
  }

  carQuestionCounter.textContent = `${carRoundIdx + 1} / ${TOTAL_ROUNDS}`;
  carProblemStatus.textContent = '빨간 차🚗를 오른쪽 출구로!';

  // 렌더 후 실제 크기로 재렌더 (레이아웃 확정 후)
  for (let i = 0; i < carPlayerCount; i++) renderBoard(i);
  requestAnimationFrame(() => {
    for (let i = 0; i < carPlayerCount; i++) renderBoard(i);
  });
  startCountdown();
}

function nextRound() {
  carRoundIdx++;
  if (carRoundIdx >= TOTAL_ROUNDS) showResult();
  else loadRound();
}

function startGame() {
  carRoundIdx = 0;
  carScores = new Array(carPlayerCount).fill(0);
  carRoundResults = [];
  carPhase = 'idle';
  clearTimers();
  buildZones();
  buildScoreBar();
  showScreen(carGameScreen);
  loadRound();
}

function showResult() {
  clearTimers();
  carPhase = 'idle';
  carSound.play('fanfare');
  const max = Math.max(...carScores);
  const winners = carScores.map((s, i) => ({ s, i })).filter(x => x.s === max).map(x => x.i);
  if (max === 0) { carResultTitle.textContent = '무승부!'; carResultWinner.textContent = '아무도 탈출하지 못했어요.'; }
  else if (winners.length === 1) { carResultTitle.textContent = '게임 종료!'; carResultWinner.textContent = `${PLAYER_CONFIG[winners[0]].label} 우승! (${max}승)`; }
  else { const labels = winners.map(w => PLAYER_CONFIG[w].label).join(', '); carResultTitle.textContent = '동점!'; carResultWinner.textContent = `${labels} 공동 1위! (${max}승)`; }
  carTotalRow.innerHTML = '';
  for (let i = 0; i < carPlayerCount; i++) {
    const cfg = PLAYER_CONFIG[i]; const isWin = winners.includes(i) && max > 0;
    const chip = document.createElement('div'); chip.className = 'total-chip';
    chip.innerHTML = `<span class="chip-dot" style="background:${cfg.dot}"></span><span>${cfg.label}</span><span class="chip-score" style="color:${isWin ? '#2E7D32' : '#555'}">${carScores[i]}승</span>${isWin ? '<span style="font-size:1.1rem;">★</span>' : ''}`;
    carTotalRow.appendChild(chip);
  }
  showScreen(carResultScreen);
}

// ─── 인원 선택 ───────────────────────────────────────────────
document.querySelectorAll('.player-btn').forEach(btn => {
  onTap(btn, () => {
    document.querySelectorAll('.player-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    carPlayerCount = parseInt(btn.dataset.count, 10);
  });
});

// ─── 이벤트 바인딩 ───────────────────────────────────────────
onTap(carSoundToggleIntro, () => { carSound.toggleMute(); updateSoundBtn(carSoundToggleIntro); });
updateSoundBtn(carSoundToggleIntro);
onTap(carBackBtn, () => goHome());
onTap(carCloseBtn, () => { clearTimers(); goHome(); });
onTap(carHomeBtn, () => goHome());
onTap(carRetryBtn, () => startPreGameCountdown(() => startGame()));
onTap(carPlayBtn, () => startPreGameCountdown(() => startGame()));
