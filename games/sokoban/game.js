/* games/sokoban/game.js — 패턴 D, 상자 밀기 (동일 퍼즐 병렬 경쟁, 2인 전용) */
'use strict';

const TOTAL_ROUNDS = 3;
const ROUND_TIME = 90;
const RESULT_PAUSE_MS = getAutoplayPauseMs(2200);
const GRID_SIZE = 6;

const PLAYER_CONFIG = [
  { label: 'P1', dot: '#0288D1', cls: 'p1' },
  { label: 'P2', dot: '#E53935', cls: 'p2' },
];

// 레벨 데이터 — 6x6 고정 프리셋 (BFS 솔버로 풀이 검증 완료)
// '#'=벽, '.'=바닥, 'G'=목표(⭐), 'B'=상자, 'P'=플레이어 시작
// R1 해법(5수): ↓ → ↑ → ↓
// R2 해법(7수): → ↓ ↓ → ↑ → ↓
// R3 해법(10수): → ↓ ↓ → ↓ ← → → ↑ ↑
const LEVELS = [
  [
    '######',
    '#P...#',
    '#.B..#',
    '#..G.#',
    '#....#',
    '######',
  ],
  [
    '######',
    '#P...#',
    '#.B..#',
    '#..B.#',
    '#.G.G#',
    '######',
  ],
  [
    '######',
    '#P..G#',
    '#.B#.#',
    '#..B.#',
    '#G...#',
    '######',
  ],
];

const DIRS = {
  up: { dr: -1, dc: 0, icon: '⬆️' },
  down: { dr: 1, dc: 0, icon: '⬇️' },
  left: { dr: 0, dc: -1, icon: '⬅️' },
  right: { dr: 0, dc: 1, icon: '➡️' },
};

const sound = createSoundManager({
  move(ctx) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type = 'sine';
    o.frequency.setValueAtTime(660, ctx.currentTime);
    g.gain.setValueAtTime(0.13, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
    o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.06);
  },
  push(ctx) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type = 'square';
    o.frequency.setValueAtTime(220, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.1);
    g.gain.setValueAtTime(0.18, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.12);
  },
  chime(ctx) {
    [784, 1046].forEach((f, i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination); o.type = 'sine';
      const t = ctx.currentTime + i * 0.1;
      o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.28, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      o.start(t); o.stop(t + 0.3);
    });
  },
  buzz(ctx) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type = 'sawtooth';
    o.frequency.setValueAtTime(180, ctx.currentTime);
    g.gain.setValueAtTime(0.18, ctx.currentTime);
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

const playerCount = 2; // 2명 전용
let roundIdx = 0;
let scores = [];
let roundResults = [];
let zoneStates = [];   // [{ pos, boxes:Set, moves }]
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

// ═══ 레벨 파싱 ═══
function getLevel() { return LEVELS[roundIdx % LEVELS.length]; }
function parseLevel(rows) {
  const walls = new Set(); const goals = new Set(); const boxes = new Set();
  let pos = 0;
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const ch = rows[r][c]; const idx = r * GRID_SIZE + c;
      if (ch === '#') walls.add(idx);
      if (ch === 'G') goals.add(idx);
      if (ch === 'B') boxes.add(idx);
      if (ch === 'P') pos = idx;
    }
  }
  return { walls, goals, boxes, pos };
}
let levelStatic = { walls: new Set(), goals: new Set() }; // 현재 라운드 공통 (벽/목표)

function freshState() {
  const p = parseLevel(getLevel());
  return { pos: p.pos, boxes: new Set(p.boxes), moves: 0 };
}
function goalCount(playerIdx) {
  const st = zoneStates[playerIdx];
  let n = 0; st.boxes.forEach(b => { if (levelStatic.goals.has(b)) n++; });
  return n;
}

// ═══ Zone 구성 ═══
function buildZones() {
  zonesWrap.innerHTML = '';
  zonesWrap.className = 'zones-wrap p2';
  for (let i = 0; i < playerCount; i++) {
    const cfg = PLAYER_CONFIG[i];
    const zone = document.createElement('div');
    zone.className = `zone ${cfg.cls}`;
    zone.dataset.player = i;
    zone.innerHTML = `
      <div class="zone-header">
        <span class="zone-label">${cfg.label}</span>
        <span class="zone-chips">
          <span class="zone-chip" id="moves-${i}">이동 0</span>
          <span class="zone-chip" id="boxes-${i}">📦 0/0</span>
        </span>
      </div>
      <div class="soko-grid" id="board-${i}"></div>
      <div class="dpad" id="dpad-${i}">
        <button class="dpad-btn dpad-up" data-dir="up" aria-label="위로">⬆️</button>
        <button class="dpad-btn dpad-left" data-dir="left" aria-label="왼쪽으로">⬅️</button>
        <button class="dpad-btn dpad-reset" id="reset-${i}" aria-label="처음부터">↺<small>처음부터</small></button>
        <button class="dpad-btn dpad-right" data-dir="right" aria-label="오른쪽으로">➡️</button>
        <button class="dpad-btn dpad-down" data-dir="down" aria-label="아래로">⬇️</button>
      </div>`;
    zonesWrap.appendChild(zone);
    zone.querySelectorAll('.dpad-btn[data-dir]').forEach(btn => {
      onTap(btn, () => handleMove(i, btn.dataset.dir));
    });
    onTap(zone.querySelector(`#reset-${i}`), () => handleReset(i));
  }
}
function getZone(idx) { return zonesWrap.querySelector(`.zone[data-player="${idx}"]`); }

// ═══ 격자 렌더링 ═══
function renderBoard(playerIdx) {
  const board = $(`board-${playerIdx}`);
  if (!board) return;
  const st = zoneStates[playerIdx];
  board.style.gridTemplateColumns = `repeat(${GRID_SIZE}, 1fr)`;
  board.style.gridTemplateRows = `repeat(${GRID_SIZE}, 1fr)`;
  board.innerHTML = '';
  for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
    const cell = document.createElement('div');
    if (levelStatic.walls.has(i)) {
      cell.className = 'soko-cell wall';
    } else {
      cell.className = 'soko-cell floor';
      const isGoal = levelStatic.goals.has(i);
      if (isGoal) cell.classList.add('goal');
      if (st.boxes.has(i)) {
        cell.textContent = '📦';
        cell.classList.add(isGoal ? 'box-done' : 'box');
      } else if (st.pos === i) {
        cell.textContent = '🙂';
        cell.classList.add('hero');
      } else if (isGoal) {
        cell.textContent = '⭐';
      }
    }
    board.appendChild(cell);
  }
}
function updateChips(playerIdx) {
  const st = zoneStates[playerIdx];
  const m = $(`moves-${playerIdx}`); if (m) m.textContent = `이동 ${st.moves}`;
  const b = $(`boxes-${playerIdx}`); if (b) b.textContent = `📦 ${goalCount(playerIdx)}/${levelStatic.goals.size}`;
}

// ═══ 조작 ═══
function handleMove(playerIdx, dirName) {
  if (phase !== 'active' || zoneSolved[playerIdx]) return;
  const dir = DIRS[dirName];
  if (!dir) return;
  const st = zoneStates[playerIdx];
  const r = Math.floor(st.pos / GRID_SIZE), c = st.pos % GRID_SIZE;
  const nr = r + dir.dr, nc = c + dir.dc;
  if (nr < 0 || nc < 0 || nr >= GRID_SIZE || nc >= GRID_SIZE) { sound.play('buzz'); return; }
  const ni = nr * GRID_SIZE + nc;
  if (levelStatic.walls.has(ni)) { sound.play('buzz'); return; }

  if (st.boxes.has(ni)) {
    // 상자 밀기 시도
    const br = nr + dir.dr, bc = nc + dir.dc;
    if (br < 0 || bc < 0 || br >= GRID_SIZE || bc >= GRID_SIZE) { sound.play('buzz'); return; }
    const bi = br * GRID_SIZE + bc;
    if (levelStatic.walls.has(bi) || st.boxes.has(bi)) { sound.play('buzz'); return; }
    st.boxes.delete(ni); st.boxes.add(bi);
    st.pos = ni; st.moves++;
    sound.play(levelStatic.goals.has(bi) ? 'chime' : 'push');
  } else {
    st.pos = ni; st.moves++;
    sound.play('move');
  }
  renderBoard(playerIdx);
  updateChips(playerIdx);

  // 전부 목표 위에 올렸는지 확인
  if (goalCount(playerIdx) === levelStatic.goals.size) handleSolve(playerIdx);
}

function handleReset(playerIdx) {
  if (phase !== 'active' || zoneSolved[playerIdx]) return;
  zoneStates[playerIdx] = freshState();
  sound.play('move');
  renderBoard(playerIdx);
  updateChips(playerIdx);
}

// ═══ 라운드 종료 ═══
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
    problemStatus.textContent = `${PLAYER_CONFIG[winnerIdx].label} 승리! (${zoneStates[winnerIdx].moves}번 이동)`;
    for (let i = 0; i < playerCount; i++) if (i !== winnerIdx && !zoneSolved[i]) getZone(i).classList.add('locked');
    phase = 'done';
    clearTimers();
    nextHandle = setTimeout(() => nextRound(), RESULT_PAUSE_MS);
  }
}

function handleTimeout() {
  if (phase !== 'active') return;
  phase = 'done';
  sound.play('timeout');
  for (let i = 0; i < playerCount; i++) if (!zoneSolved[i]) getZone(i).classList.add('locked');
  // 시간 초과: 목표에 올린 상자 수가 많은 사람 승리
  const counts = [];
  for (let i = 0; i < playerCount; i++) counts.push(goalCount(i));
  const max = Math.max(...counts);
  const leaders = counts.map((n, i) => ({ n, i })).filter(x => x.n === max).map(x => x.i);
  if (leaders.length === 1) {
    const w = leaders[0];
    roundResults.push({ winnerIdx: w, timedOut: true });
    scores[w]++;
    updateBarScore(w);
    problemStatus.textContent = `시간 초과! 📦 ${max}개로 ${PLAYER_CONFIG[w].label} 승리!`;
  } else {
    roundResults.push({ winnerIdx: -1, timedOut: true });
    problemStatus.textContent = '시간 초과! 무승부예요';
  }
  nextHandle = setTimeout(() => nextRound(), RESULT_PAUSE_MS);
}

// ═══ 점수 바 ═══
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

// ═══ 타이머 ═══
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

// ═══ 게임 흐름 ═══
function loadRound() {
  phase = 'active';
  const p = parseLevel(getLevel());
  levelStatic = { walls: p.walls, goals: p.goals };
  zoneStates = []; zoneSolved = [];
  for (let i = 0; i < playerCount; i++) {
    zoneStates.push(freshState());
    zoneSolved.push(false);
    const zone = getZone(i);
    if (zone) zone.classList.remove('solved', 'locked');
    renderBoard(i);
    updateChips(i);
  }
  questionCounter.textContent = `${roundIdx + 1} / ${TOTAL_ROUNDS}`;
  problemStatus.textContent = `상자📦 ${levelStatic.goals.size}개를 별⭐ 위로!`;
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
    const cfg = PLAYER_CONFIG[i]; const isWin = winners.includes(i) && max > 0;
    const chip = document.createElement('div'); chip.className = 'total-chip';
    chip.innerHTML = `<span class="chip-dot" style="background:${cfg.dot}"></span><span>${cfg.label}</span><span class="chip-score" style="color:${isWin ? '#2E7D32' : '#555'}">${scores[i]}승</span>${isWin ? '<span style="font-size:1.1rem;">★</span>' : ''}`;
    totalRow.appendChild(chip);
  }
  showScreen(resultScreen);
}

setupSoundToggle(sound, soundToggleIntro);
onTap(backBtn, () => goHome());
onTap(closeBtn, () => { clearTimers(); goHome(); });
onTap(homeBtn, () => goHome());
onTap(retryBtn, () => startPreGameCountdown(() => startGame()));
onTap(playBtn, () => startPreGameCountdown(() => startGame()));
