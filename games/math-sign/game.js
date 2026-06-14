/* games/math-sign/game.js */

'use strict';

// ── Constants ────────────────────────────────────────────────
const TOTAL_ROUNDS    = 10;
const ROUND_TIME      = 8;
const RESULT_PAUSE_MS = 2000;

const PLAYER_CONFIG = [
  { label: 'P1', dot: '#0288D1', zoneBg: '#B3E5FC', cls: 'p1' },
  { label: 'P2', dot: '#E53935', zoneBg: '#FFCDD2', cls: 'p2' },
  { label: 'P3', dot: '#388E3C', zoneBg: '#C8E6C9', cls: 'p3' },
  { label: 'P4', dot: '#F57C00', zoneBg: '#FFE0B2', cls: 'p4' },
];

const OPERATORS = ['+', '−', '×', '÷'];

// ── Equation Data ────────────────────────────────────────────
// Each: { a, op, b, result }
// Validated: for "a ? b = result" only the listed op satisfies the equation.
const ALL_EQUATIONS = [
  // 덧셈 (9)
  { a: 5,  op: '+', b: 3,  result: 8  },
  { a: 7,  op: '+', b: 6,  result: 13 },
  { a: 9,  op: '+', b: 4,  result: 13 },
  { a: 12, op: '+', b: 7,  result: 19 },
  { a: 8,  op: '+', b: 8,  result: 16 },
  { a: 15, op: '+', b: 5,  result: 20 },
  { a: 6,  op: '+', b: 9,  result: 15 },
  { a: 11, op: '+', b: 4,  result: 15 },
  { a: 10, op: '+', b: 7,  result: 17 },
  // 뺄셈 (9)
  { a: 10, op: '−', b: 3,  result: 7  },
  { a: 15, op: '−', b: 8,  result: 7  },
  { a: 20, op: '−', b: 12, result: 8  },
  { a: 14, op: '−', b: 9,  result: 5  },
  { a: 18, op: '−', b: 6,  result: 12 },
  { a: 16, op: '−', b: 7,  result: 9  },
  { a: 13, op: '−', b: 5,  result: 8  },
  { a: 19, op: '−', b: 11, result: 8  },
  { a: 17, op: '−', b: 9,  result: 8  },
  // 곱셈 (9)
  { a: 3,  op: '×', b: 4,  result: 12 },
  { a: 6,  op: '×', b: 5,  result: 30 },
  { a: 7,  op: '×', b: 3,  result: 21 },
  { a: 8,  op: '×', b: 4,  result: 32 },
  { a: 9,  op: '×', b: 2,  result: 18 },
  { a: 5,  op: '×', b: 5,  result: 25 },
  { a: 4,  op: '×', b: 6,  result: 24 },
  { a: 7,  op: '×', b: 8,  result: 56 },
  { a: 6,  op: '×', b: 9,  result: 54 },
  // 나눗셈 (9)
  { a: 12, op: '÷', b: 3,  result: 4  },
  { a: 20, op: '÷', b: 4,  result: 5  },
  { a: 18, op: '÷', b: 6,  result: 3  },
  { a: 24, op: '÷', b: 8,  result: 3  },
  { a: 36, op: '÷', b: 9,  result: 4  },
  { a: 15, op: '÷', b: 5,  result: 3  },
  { a: 28, op: '÷', b: 7,  result: 4  },
  { a: 30, op: '÷', b: 6,  result: 5  },
  { a: 16, op: '÷', b: 4,  result: 4  },
];

// ── Sound Manager ────────────────────────────────────────────
const sound = createSoundManager();

// ── State ────────────────────────────────────────────────────
let playerCount    = 2;
let roundIdx       = 0;
let scores         = [];
let roundLog       = [];
let currentEq      = null;
let currentChoices = [];
let dqSet          = new Set();
let phase          = 'idle';
let timerHandle    = null;
let nextHandle     = null;
let timeRemaining  = ROUND_TIME;
let gameRounds     = [];

// ── DOM refs ─────────────────────────────────────────────────
const introScreen     = document.getElementById('introScreen');
const countdownScreen = document.getElementById('countdownScreen');
const countdownNumber = document.getElementById('countdownNumber');
const gameScreen      = document.getElementById('gameScreen');
const resultScreen    = document.getElementById('resultScreen');

const backBtn       = document.getElementById('backBtn');
const playBtn       = document.getElementById('playBtn');
const closeBtn      = document.getElementById('closeBtn');
const retryBtn      = document.getElementById('retryBtn');
const homeBtn       = document.getElementById('homeBtn');

const zonesWrap       = document.getElementById('zonesWrap');
const questionCounter = document.getElementById('questionCounter');
const problemTimer    = document.getElementById('problemTimer');
const equationDisplay = document.getElementById('equationDisplay');
const problemStatus   = document.getElementById('problemStatus');
const scoreBar        = document.getElementById('scoreBar');

const soundToggleIntro = document.getElementById('soundToggleIntro');
const introEqRow       = document.getElementById('introEqRow');

const resultTitle     = document.getElementById('resultTitle');
const resultWinner    = document.getElementById('resultWinner');
const resultTableHead = document.getElementById('resultTableHead');
const resultTableBody = document.getElementById('resultTableBody');
const totalRow        = document.getElementById('totalRow');

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

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function clearTimers() {
  if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
  if (timerHandle) { clearInterval(timerHandle); timerHandle = null; }
  if (nextHandle)  { clearTimeout(nextHandle);   nextHandle  = null; }
}

function updateSoundBtn(btn) {
  btn.textContent = sound.isMuted() ? '🔇' : '🔊';
}

// Always 4 operators, shuffled. Correct is among them (and unique).
function makeChoices() {
  return shuffle(OPERATORS.slice());
}

function formatEquation(eq, opOverride) {
  const op = opOverride !== undefined ? opOverride : '<span class="blank">?</span>';
  return `${eq.a} ${op} ${eq.b} = ${eq.result}`;
}

// ── Intro equation preview ───────────────────────────────────
function renderIntroEqs() {
  introEqRow.innerHTML = '';
  const sample = shuffle(ALL_EQUATIONS).slice(0, 3);
  sample.forEach(eq => {
    const wrap = document.createElement('div');
    wrap.className = 'intro-eq-thumb';
    wrap.innerHTML = `${eq.a} <span class="blank">?</span> ${eq.b} = ${eq.result}`;
    introEqRow.appendChild(wrap);
  });
}
renderIntroEqs();

// ── Player count selection ───────────────────────────────────
document.querySelectorAll('.player-btn').forEach(btn => {
  onTap(btn, () => {
    document.querySelectorAll('.player-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    playerCount = parseInt(btn.dataset.count, 10);
  });
});

// ── Sound toggle ─────────────────────────────────────────────
onTap(soundToggleIntro, () => {
  sound.toggleMute();
  updateSoundBtn(soundToggleIntro);
});
updateSoundBtn(soundToggleIntro);

// ── Navigation ───────────────────────────────────────────────
onTap(backBtn,  () => goHome());
onTap(closeBtn, () => { clearTimers(); goHome(); });
onTap(homeBtn,  () => goHome());
onTap(retryBtn, () => startPreGameCountdown(() => startGame()));
onTap(playBtn,  () => startPreGameCountdown(() => startGame()));

// ── Build zone grid ──────────────────────────────────────────
function buildZones() {
  zonesWrap.innerHTML = '';
  zonesWrap.className = `zones-wrap p${playerCount}`;

  for (let i = 0; i < playerCount; i++) {
    const cfg  = PLAYER_CONFIG[i];
    const zone = document.createElement('div');
    zone.className = `zone ${cfg.cls}`;
    zone.dataset.player = i;

    const header = document.createElement('div');
    header.className = 'zone-header';
    header.innerHTML = `
      <span class="zone-label">${cfg.label}</span>
      <span class="zone-score-chip" id="score-chip-${i}">0점</span>
    `;

    const grid = document.createElement('div');
    grid.className = 'answer-grid';
    grid.id = `answer-grid-${i}`;

    zone.appendChild(header);
    zone.appendChild(grid);
    zonesWrap.appendChild(zone);
  }
}

function getZone(idx) {
  return zonesWrap.querySelector(`.zone[data-player="${idx}"]`);
}

function getAnswerBtns(playerIdx) {
  const grid = document.getElementById(`answer-grid-${playerIdx}`);
  return grid ? Array.from(grid.querySelectorAll('.answer-btn')) : [];
}

function updateScoreChip(playerIdx) {
  const chip = document.getElementById(`score-chip-${playerIdx}`);
  if (chip) chip.textContent = `${scores[playerIdx]}점`;
}

// ── Score bar ────────────────────────────────────────────────
function buildScoreBar() {
  scoreBar.innerHTML = '';
  for (let i = 0; i < playerCount; i++) {
    const cfg  = PLAYER_CONFIG[i];
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

// ── Populate answer buttons ──────────────────────────────────
function populateAnswerBtns() {
  for (let i = 0; i < playerCount; i++) {
    const grid = document.getElementById(`answer-grid-${i}`);
    if (!grid) continue;
    grid.innerHTML = '';

    currentChoices.forEach((op, ci) => {
      const btn = document.createElement('button');
      btn.className = 'answer-btn';
      btn.dataset.player = i;
      btn.dataset.choice = op;
      btn.setAttribute('aria-label', `P${i + 1} ${op}`);

      btn.innerHTML = `<svg viewBox="0 0 110 58" xmlns="http://www.w3.org/2000/svg">
        <rect x="2" y="2" width="106" height="54" rx="14" ry="14"
              fill="${PLAYER_CONFIG[i].dot}" opacity="0.18" stroke="${PLAYER_CONFIG[i].dot}" stroke-width="2.5"/>
        <text x="55" y="38" text-anchor="middle" dominant-baseline="middle"
              font-family="'Pretendard Variable',-apple-system,'Noto Sans KR',sans-serif"
              font-size="34" font-weight="900" fill="#222">${op}</text>
      </svg>`;

      onTap(btn, () => handleAnswerTap(i, op, btn));
      grid.appendChild(btn);
    });
  }
}

// ── Reset buttons for new round ──────────────────────────────
function resetBtnsForRound() {
  for (let i = 0; i < playerCount; i++) {
    const btns = getAnswerBtns(i);
    const zone = getZone(i);
    btns.forEach(btn => {
      btn.className = 'answer-btn';
      btn.disabled = false;
      if (dqSet.has(i)) {
        btn.classList.add('state-disabled');
        btn.disabled = true;
      }
    });
    if (zone) {
      if (dqSet.has(i)) zone.classList.add('dq-zone');
      else zone.classList.remove('dq-zone');
    }
  }
}

// ── Ripple effect ────────────────────────────────────────────
function spawnRipple(zone, e) {
  const rect  = zone.getBoundingClientRect();
  const touch = e && e.touches ? e.touches[0] : (e || null);
  const x     = touch ? touch.clientX - rect.left : rect.width  / 2;
  const y     = touch ? touch.clientY - rect.top  : rect.height / 2;
  const size  = Math.max(rect.width, rect.height);
  const r     = document.createElement('span');
  r.className = 'zone-ripple';
  r.style.left   = x + 'px';
  r.style.top    = y + 'px';
  r.style.width  = r.style.height = size + 'px';
  r.style.marginLeft = r.style.marginTop = `-${size / 2}px`;
  zone.appendChild(r);
  r.addEventListener('animationend', () => r.remove());
}

// ── Timer logic ──────────────────────────────────────────────
function startCountdown() {
  timeRemaining = ROUND_TIME;
  problemTimer.textContent = timeRemaining;
  problemTimer.classList.remove('urgent');

  timerHandle = setInterval(() => {
    timeRemaining--;
    problemTimer.textContent = timeRemaining;

    if (timeRemaining <= 2) {
      problemTimer.classList.add('urgent');
      sound.play('tick');
    }

    if (timeRemaining <= 0) {
      clearTimers();
      handleTimeout();
    }
  }, 1000);
}

// ── Answer tap handler ───────────────────────────────────────
function handleAnswerTap(playerIdx, chosenOp, btn) {
  if (phase !== 'active') return;
  if (dqSet.has(playerIdx)) return;

  const zone = getZone(playerIdx);
  spawnRipple(zone, null);

  const correct = (chosenOp === currentEq.op);

  if (correct) {
    resolveRound(playerIdx);
  } else {
    sound.play('buzz');
    btn.classList.add('state-wrong');
    setTimeout(() => btn.classList.remove('state-wrong'), 400);

    dqSet.add(playerIdx);
    scores[playerIdx] = Math.max(0, scores[playerIdx] - 1);
    updateScoreChip(playerIdx);
    updateBarScore(playerIdx);

    const penalty = document.createElement('div');
    penalty.className = 'penalty-flash';
    penalty.textContent = '-1';
    zone.style.position = 'relative';
    zone.appendChild(penalty);
    penalty.addEventListener('animationend', () => penalty.remove());

    getAnswerBtns(playerIdx).forEach(b => {
      b.classList.add('state-disabled');
      b.disabled = true;
    });
    zone.classList.add('dq-zone');

    let anyActive = false;
    for (let i = 0; i < playerCount; i++) {
      if (!dqSet.has(i)) { anyActive = true; break; }
    }
    if (!anyActive) {
      clearTimers();
      nextHandle = setTimeout(() => handleTimeout(), 300);
    }
  }
}

// ── Correct answer resolved ──────────────────────────────────
function resolveRound(winnerIdx) {
  phase = 'done';
  clearTimers();
  sound.play('ding');

  scores[winnerIdx]++;
  updateScoreChip(winnerIdx);
  updateBarScore(winnerIdx);

  // Reveal equation with answer filled in
  equationDisplay.innerHTML = `${currentEq.a} <span class="blank" style="color:#2E7D32;border-color:#2E7D32;">${currentEq.op}</span> ${currentEq.b} = ${currentEq.result}`;

  getAnswerBtns(winnerIdx).forEach(btn => {
    if (btn.dataset.choice === currentEq.op) {
      btn.classList.add('state-correct');
    } else {
      btn.classList.add('state-disabled');
      btn.disabled = true;
    }
  });

  for (let i = 0; i < playerCount; i++) {
    if (i !== winnerIdx) {
      getAnswerBtns(i).forEach(b => { b.classList.add('state-disabled'); b.disabled = true; });
    }
  }

  const winnerLabel = PLAYER_CONFIG[winnerIdx].label;
  problemStatus.textContent = `${winnerLabel} 정답!`;

  roundLog.push({
    eq: currentEq,
    winnerIdx,
    dqPlayers: [...dqSet],
    timedOut: false,
  });

  nextHandle = setTimeout(() => nextRound(), RESULT_PAUSE_MS);
}

// ── Timeout ──────────────────────────────────────────────────
function handleTimeout() {
  phase = 'done';
  clearTimers();
  sound.play('timeout');

  equationDisplay.innerHTML = `${currentEq.a} <span class="blank" style="color:#E65100;border-color:#E65100;">${currentEq.op}</span> ${currentEq.b} = ${currentEq.result}`;

  for (let i = 0; i < playerCount; i++) {
    getAnswerBtns(i).forEach(btn => {
      if (btn.dataset.choice === currentEq.op) {
        btn.classList.add('state-reveal');
      } else {
        btn.classList.add('state-disabled');
        btn.disabled = true;
      }
    });
    const zone = getZone(i);
    if (zone) zone.classList.remove('dq-zone');
  }

  problemStatus.textContent = `시간 초과! 정답: ${currentEq.op}`;

  roundLog.push({
    eq: currentEq,
    winnerIdx: -1,
    dqPlayers: [...dqSet],
    timedOut: true,
  });

  nextHandle = setTimeout(() => nextRound(), RESULT_PAUSE_MS);
}

// ── Load round ───────────────────────────────────────────────
function loadRound() {
  phase          = 'active';
  currentEq      = gameRounds[roundIdx];
  currentChoices = makeChoices();
  dqSet          = new Set();

  questionCounter.textContent = `${roundIdx + 1} / ${TOTAL_ROUNDS}`;
  equationDisplay.innerHTML = `${currentEq.a} <span class="blank">?</span> ${currentEq.b} = ${currentEq.result}`;
  problemStatus.textContent = '';
  problemTimer.classList.remove('urgent');

  populateAnswerBtns();
  resetBtnsForRound();
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
  gameRounds  = shuffle(ALL_EQUATIONS).slice(0, TOTAL_ROUNDS);
  roundIdx    = 0;
  scores      = new Array(playerCount).fill(0);
  roundLog    = [];
  dqSet       = new Set();
  phase       = 'idle';

  clearTimers();
  buildZones();
  buildScoreBar();
  showScreen(gameScreen);
  loadRound();
}

// ── Show result ──────────────────────────────────────────────
function showResult() {
  clearTimers();
  phase = 'idle';
  sound.play('fanfare');

  const maxScore = Math.max(...scores);
  const winners  = scores
    .map((s, i) => ({ s, i }))
    .filter(x => x.s === maxScore)
    .map(x => x.i);

  if (maxScore === 0) {
    resultTitle.textContent  = '무승부!';
    resultWinner.textContent = '아무도 점수를 얻지 못했어요.';
  } else if (winners.length === 1) {
    const w = winners[0];
    resultTitle.textContent  = '게임 종료!';
    resultWinner.textContent = `${PLAYER_CONFIG[w].label} 승리! (${maxScore}점)`;
  } else {
    const labels = winners.map(w => PLAYER_CONFIG[w].label).join(', ');
    resultTitle.textContent  = '동점!';
    resultWinner.textContent = `${labels} 공동 1위! (${maxScore}점)`;
  }

  const headRow = document.createElement('tr');
  headRow.innerHTML = '<th>식</th>' +
    Array.from({ length: playerCount }, (_, i) =>
      `<th><span class="player-dot" style="background:${PLAYER_CONFIG[i].dot}"></span>${PLAYER_CONFIG[i].label}</th>`
    ).join('');
  resultTableHead.innerHTML = '';
  resultTableHead.appendChild(headRow);

  resultTableBody.innerHTML = '';
  roundLog.forEach((log, idx) => {
    const tr = document.createElement('tr');
    const eq = log.eq;
    const eqText = `${eq.a} ${eq.op} ${eq.b} = ${eq.result}`;
    let cells = `<td style="text-align:left;font-size:0.82rem;font-variant-numeric:tabular-nums;">${idx + 1}. ${eqText}</td>`;

    for (let i = 0; i < playerCount; i++) {
      if (log.timedOut) {
        cells += `<td class="cell-timeout">시간초과</td>`;
      } else if (log.winnerIdx === i) {
        cells += `<td class="cell-win">+1</td>`;
      } else if (log.dqPlayers.includes(i)) {
        cells += `<td class="cell-wrong">-1</td>`;
      } else {
        cells += `<td class="cell-none">—</td>`;
      }
    }
    tr.innerHTML = cells;
    resultTableBody.appendChild(tr);
  });

  totalRow.innerHTML = '';
  for (let i = 0; i < playerCount; i++) {
    const cfg   = PLAYER_CONFIG[i];
    const isWin = winners.includes(i);
    const chip  = document.createElement('div');
    chip.className = 'total-chip';
    chip.innerHTML = `
      <span class="chip-dot" style="background:${cfg.dot}"></span>
      <span>${cfg.label}</span>
      <span class="chip-score" style="color:${isWin ? '#2E7D32' : '#555'}">${scores[i]}점</span>
      ${isWin ? '<span style="font-size:1.1rem;">★</span>' : ''}
    `;
    totalRow.appendChild(chip);
  }

  showScreen(resultScreen);
}
