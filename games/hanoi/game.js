/* games/hanoi/game.js — 패턴 D (퍼즐 병렬 경쟁) — 하노이탑 */
'use strict';

// ── Constants ────────────────────────────────────────────────
const TOTAL_ROUNDS = 3;
const ROUND_TIME = 60;        // seconds
const RESULT_PAUSE_MS = getAutoplayPauseMs(2200);
const DISK_COUNTS = [3, 3, 4]; // 라운드별 원반 개수 (난이도 점증)
const PEG_COUNT = 3;
const TARGET_PEG = 2;          // 모든 원반을 마지막(오른쪽) 기둥으로

// 원반 크기별 파스텔 색 (size 1..4)
const DISK_COLORS = ['#B3E5FC', '#C8E6C9', '#FFE0B2', '#FFCDD2'];

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
  slide(ctx) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type = 'sine';
    o.frequency.setValueAtTime(440, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.08);
    g.gain.setValueAtTime(0.18, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.1);
  },
  lift(ctx) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type = 'triangle';
    o.frequency.setValueAtTime(330, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(520, ctx.currentTime + 0.07);
    g.gain.setValueAtTime(0.16, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);
    o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.09);
  },
  buzz(ctx) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type = 'sawtooth';
    o.frequency.setValueAtTime(200, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(90, ctx.currentTime + 0.2);
    g.gain.setValueAtTime(0.32, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.24);
    o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.24);
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
let zonePegs = [];               // each player's [peg0, peg1, peg2] (bottom→top)
let zoneSelected = [];           // each player's currently lifted peg idx or null
let zoneMoves = [];              // each player's move count
let zoneSolved = [];             // boolean
let diskCount = 3;               // 현재 라운드 원반 수
let phase = 'idle';
let timerHandle = null;
let nextHandle = null;
let timeRemaining = ROUND_TIME;

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


// ── Hanoi utilities ──────────────────────────────────────────
function makeInitialPegs(n) {
  const first = [];
  for (let s = n; s >= 1; s--) first.push(s); // bottom = largest
  return [first, [], []];
}

function isSolvedHanoi(pegs, n) {
  return pegs[TARGET_PEG].length === n;
}

// ── Build zones (each zone has its own hanoi board) ──────────
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

    const board = document.createElement('div');
    board.className = 'hanoi-board';
    board.id = `hanoi-board-${i}`;
    zone.appendChild(board);

    zonesWrap.appendChild(zone);
  }
}

function getZone(idx) {
  return zonesWrap.querySelector(`.zone[data-player="${idx}"]`);
}

function renderBoard(playerIdx) {
  const board = document.getElementById(`hanoi-board-${playerIdx}`);
  if (!board) return;
  const pegs = zonePegs[playerIdx];
  const sel = zoneSelected[playerIdx];
  board.innerHTML = '';

  for (let p = 0; p < PEG_COUNT; p++) {
    const peg = document.createElement('div');
    peg.className = 'hanoi-peg' + (sel === p ? ' selected' : '');
    peg.dataset.player = playerIdx;
    peg.dataset.peg = p;

    const base = document.createElement('div');
    base.className = 'hanoi-base';
    peg.appendChild(base);

    const post = document.createElement('div');
    post.className = 'hanoi-post';
    peg.appendChild(post);

    // 원반 (bottom→top 순서). column-reverse 이므로 첫 자식이 맨 아래.
    pegs[p].forEach((size, di) => {
      const disk = document.createElement('div');
      const isTop = (di === pegs[p].length - 1);
      disk.className = 'hanoi-disk' + (sel === p && isTop ? ' lifted' : '');
      const widthPct = (size / diskCount) * 80 + 18;
      disk.style.width = widthPct + '%';
      disk.style.background = DISK_COLORS[(size - 1) % DISK_COLORS.length];
      peg.appendChild(disk);
    });

    onTap(peg, () => handlePegTap(playerIdx, p));
    board.appendChild(peg);
  }
}

function updateMovesChip(playerIdx) {
  const el = document.getElementById(`moves-${playerIdx}`);
  if (el) el.textContent = `${zoneMoves[playerIdx]}회`;
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

// ── Peg tap handler ──────────────────────────────────────────
function handlePegTap(playerIdx, pegIdx) {
  if (phase !== 'active') return;
  if (zoneSolved[playerIdx]) return;

  const pegs = zonePegs[playerIdx];
  const sel = zoneSelected[playerIdx];

  if (sel === null) {
    // 원반 집기
    if (pegs[pegIdx].length > 0) {
      zoneSelected[playerIdx] = pegIdx;
      sound.play('lift');
      renderBoard(playerIdx);
    }
    return;
  }

  if (sel === pegIdx) {
    // 같은 기둥 → 내려놓기(선택 취소)
    zoneSelected[playerIdx] = null;
    renderBoard(playerIdx);
    return;
  }

  // 다른 기둥으로 이동 시도
  const from = pegs[sel];
  const to = pegs[pegIdx];
  const disk = from[from.length - 1];

  if (to.length === 0 || to[to.length - 1] > disk) {
    // 유효한 이동
    to.push(from.pop());
    zoneMoves[playerIdx]++;
    zoneSelected[playerIdx] = null;
    sound.play('slide');
    renderBoard(playerIdx);
    updateMovesChip(playerIdx);

    if (isSolvedHanoi(pegs, diskCount)) {
      handleSolve(playerIdx);
    }
  } else {
    // 큰 원반을 작은 원반 위에 → 불가. 탭한 기둥을 다시 선택해 그 원반을 옮길 수 있게.
    sound.play('buzz');
    zoneSelected[playerIdx] = pegs[pegIdx].length > 0 ? pegIdx : null;
    renderBoard(playerIdx);
  }
}

function handleSolve(winnerIdx) {
  if (zoneSolved[winnerIdx]) return;
  zoneSolved[winnerIdx] = true;

  const zone = getZone(winnerIdx);
  zone.classList.add('solved');

  // 첫 번째로 완성한 사람이 라운드 승
  if (roundResults.length === roundIdx) {
    roundResults.push({ winnerIdx, timedOut: false });
    scores[winnerIdx]++;
    updateBarScore(winnerIdx);

    sound.play('ding');
    problemStatus.textContent = `${PLAYER_CONFIG[winnerIdx].label} 승리!`;

    // 나머지 zone freeze
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
  diskCount = DISK_COUNTS[roundIdx];

  zonePegs = [];
  zoneSelected = [];
  zoneMoves = [];
  zoneSolved = [];

  for (let i = 0; i < playerCount; i++) {
    zonePegs.push(makeInitialPegs(diskCount));
    zoneSelected.push(null);
    zoneMoves.push(0);
    zoneSolved.push(false);
    const zone = getZone(i);
    if (zone) zone.classList.remove('solved', 'locked');
    renderBoard(i);
    updateMovesChip(i);
  }

  questionCounter.textContent = `${roundIdx + 1} / ${TOTAL_ROUNDS}`;
  problemStatus.textContent = `원반 ${diskCount}개를 모두 오른쪽 기둥으로!`;

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
