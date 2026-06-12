/* games/hundred-chart/game.js */

'use strict';

// ── Constants ────────────────────────────────────────────────
const HC_TOTAL_ROUNDS    = 8;
const HC_ROUND_TIME      = 12;
const HC_RESULT_PAUSE_MS = getAutoplayPauseMs(2000);

// Player config
const HC_PLAYER_CONFIG = [
  { label: 'P1', dot: '#0288D1', cls: 'p1' },
  { label: 'P2', dot: '#E53935', cls: 'p2' },
  { label: 'P3', dot: '#388E3C', cls: 'p3' },
  { label: 'P4', dot: '#F57C00', cls: 'p4' },
];

// ── Sound Manager ────────────────────────────────────────────
const hcSound = createSoundManager({
  ding(ctx) {
    [523, 659, 784].forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine';
      const t = ctx.currentTime + i * 0.09;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
      osc.start(t); osc.stop(t + 0.32);
    });
  },
  buzz(ctx) {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.28);
    gain.gain.setValueAtTime(0.45, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.32);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.32);
  },
  timeout(ctx) {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160, ctx.currentTime);
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.5);
  },
  tick(ctx) {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'square';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.08);
  },
  fanfare(ctx) {
    [392, 494, 523, 659, 784].forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'triangle';
      const t = ctx.currentTime + i * 0.12;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
      osc.start(t); osc.stop(t + 0.38);
    });
  },
});

// ── State ────────────────────────────────────────────────────
let hcPlayerCount   = 2;
let hcRoundIdx      = 0;
let hcScores        = [];
let hcRoundLog      = [];
let hcCurrentRound  = null;
let hcDqSet         = new Set();
let hcPhase         = 'idle';
let hcTimerHandle   = null;
let hcNextHandle    = null;
let hcTimeRemaining = HC_ROUND_TIME;
let hcGameRounds    = [];

// ── DOM refs ─────────────────────────────────────────────────
const hcIntroScreen     = document.getElementById('introScreen');
const hcCountdownScreen = document.getElementById('countdownScreen');
const hcCountdownNumber = document.getElementById('countdownNumber');
const hcGameScreen      = document.getElementById('gameScreen');
const hcResultScreen    = document.getElementById('resultScreen');

const hcBackBtn  = document.getElementById('backBtn');
const hcPlayBtn  = document.getElementById('playBtn');
const hcCloseBtn = document.getElementById('closeBtn');
const hcRetryBtn = document.getElementById('retryBtn');
const hcHomeBtn  = document.getElementById('homeBtn');

const hcZonesWrap       = document.getElementById('zonesWrap');
const hcQuestionCounter = document.getElementById('questionCounter');
const hcProblemTimer    = document.getElementById('problemTimer');
const hcProblemStatus   = document.getElementById('problemStatus');
const hcScoreBar        = document.getElementById('scoreBar');
const hcChartGrid       = document.getElementById('chartGrid');

const hcSoundToggle = document.getElementById('soundToggleIntro');

const hcResultTitle     = document.getElementById('resultTitle');
const hcResultWinner    = document.getElementById('resultWinner');
const hcResultTableHead = document.getElementById('resultTableHead');
const hcResultTableBody = document.getElementById('resultTableBody');
const hcTotalRow        = document.getElementById('totalRow');

// ── Helpers ──────────────────────────────────────────────────
function hcShowScreen(s) {
  [hcIntroScreen, hcCountdownScreen, hcGameScreen, hcResultScreen]
    .forEach(x => x.classList.remove('active'));
  s.classList.add('active');
}

function hcRandInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function hcShuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function hcClearTimers() {
  if (hcTimerHandle) { clearInterval(hcTimerHandle); hcTimerHandle = null; }
  if (hcNextHandle)  { clearTimeout(hcNextHandle);   hcNextHandle  = null; }
}

function hcUpdateSoundBtn() {
  hcSoundToggle.textContent = hcSound.isMuted() ? '🔇' : '🔊';
}

// ── 백판 (1~100, 가로 10, 아래 +10) ─────────────────────────
// row: 0~9 (top=1~10, bottom=91~100)
// col: 0~9
// value = row * 10 + col + 1
function hcCellValue(row, col) {
  return row * 10 + col + 1;
}

// ── Round generation ─────────────────────────────────────────
// 3x3 창(windowRow, windowCol) = 시작 행/열(0-based)
// windowRow: 0~7(마지막 창의 마지막 행은 row9, 3행 필요하므로 windowRow ≤ 7)
// windowCol: 0~7
// questionPos: 0~8 (3x3 창에서 물음표 위치)
//
// 점증 계획:
// Stage 1~2: 주변 칸 다 보임 (questionPos = 4 center)
// Stage 3~4: 대각선 방향 칸만 보임 + questionPos varies
// Stage 5~6: 창 밖 추론 (answer is outside the 3x3 window)
// Stage 7~8: 표시 칸 감소 (더 적은 단서)

function hcGenerateRound(roundIdx) {
  const stage = roundIdx + 1;

  let windowRow, windowCol, questionPos, visiblePositions, answer;
  let outOfWindow = false; // stage 5~6: answer is outside the window
  let outDir = null;       // 'below' or 'right'
  let attempts = 0;

  while (attempts < 100) {
    attempts++;

    // Pick a valid window (stays within 1~100)
    if (stage <= 2) {
      // Center question, all surrounding visible
      windowRow = hcRandInt(0, 7);
      windowCol = hcRandInt(0, 7);
      questionPos = 4; // center of 3x3
      // All 8 surrounding + center visible, remove center
      visiblePositions = [0,1,2,3,5,6,7,8]; // center is question
    } else if (stage <= 4) {
      // Only diagonal neighbours visible + one edge
      windowRow = hcRandInt(0, 7);
      windowCol = hcRandInt(0, 7);
      // Pick a non-center, non-corner question pos
      const edgePositions = [1, 3, 5, 7];
      questionPos = edgePositions[hcRandInt(0, 3)];
      // Visible: diagonal (0,2,6,8) + adjacent non-question
      const diagonals = [0, 2, 6, 8];
      visiblePositions = diagonals.filter(p => p !== questionPos);
    } else if (stage <= 6) {
      // 창 밖 추론: questionPos is OUTSIDE the 3x3 grid
      // Show a 3x3 window, the answer is one step below or to the right
      outOfWindow = true;
      windowRow = hcRandInt(0, 6); // ensure row below exists
      windowCol = hcRandInt(0, 7);
      outDir = Math.random() < 0.5 ? 'below' : 'right';
      if (outDir === 'right' && windowCol > 6) {
        outDir = 'below';
      }
      if (outDir === 'below' && windowRow > 6) {
        outDir = 'right';
        windowCol = hcRandInt(0, 6);
      }
      questionPos = -1; // special: outside window
      visiblePositions = [0,1,2,3,4,5,6,7,8]; // all 3x3 visible
    } else {
      // Stage 7~8: fewer visible cells
      windowRow = hcRandInt(0, 7);
      windowCol = hcRandInt(0, 7);
      questionPos = 4; // center
      // Only show corners and one edge
      const possibleVisible = [0, 2, 6, 8, 1];
      visiblePositions = hcShuffle(possibleVisible).slice(0, hcRandInt(2, 3));
    }

    // Validate window bounds (1~100)
    const r0 = windowRow, r1 = windowRow + 2;
    const c0 = windowCol, c1 = windowCol + 2;
    if (r1 > 9 || c1 > 9) { continue; }

    // Calculate answer
    if (outOfWindow) {
      if (outDir === 'below') {
        // The answer is the number directly below the bottom-center of window
        // bottom-center: (windowRow+2, windowCol+1)
        const targetRow = windowRow + 3;
        const targetCol = windowCol + 1;
        if (targetRow > 9) { continue; }
        answer = hcCellValue(targetRow, targetCol);
      } else {
        // right of center-right: (windowRow+1, windowCol+3)
        const targetRow = windowRow + 1;
        const targetCol = windowCol + 3;
        if (targetCol > 9) { continue; }
        answer = hcCellValue(targetRow, targetCol);
      }
    } else {
      const qRow = windowRow + Math.floor(questionPos / 3);
      const qCol = windowCol + (questionPos % 3);
      answer = hcCellValue(qRow, qCol);
    }

    // Generate wrong choices: confusing offsets (±1 and ±10)
    const confuseOffsets = hcShuffle([-10, -1, 1, 10, -11, 11, -9, 9]);
    const wrongSet = new Set();
    for (const offset of confuseOffsets) {
      const w = answer + offset;
      if (w >= 1 && w <= 100 && w !== answer && !wrongSet.has(w)) {
        wrongSet.add(w);
        if (wrongSet.size >= 3) break;
      }
    }
    if (wrongSet.size < 3) { continue; }

    const displayChoices = hcShuffle([answer, ...wrongSet]);

    return {
      windowRow,
      windowCol,
      questionPos,
      visiblePositions,
      answer,
      displayChoices,
      outOfWindow,
      outDir,
      stage,
    };
  }

  // Fallback: simple round
  const windowRow2 = hcRandInt(0, 7);
  const windowCol2 = hcRandInt(0, 7);
  const answer2 = hcCellValue(windowRow2 + 1, windowCol2 + 1);
  const wrongSet2 = new Set([answer2 + 1, answer2 - 1, answer2 + 10]);
  return {
    windowRow: windowRow2,
    windowCol: windowCol2,
    questionPos: 4,
    visiblePositions: [0,1,2,3,5,6,7,8],
    answer: answer2,
    displayChoices: hcShuffle([answer2, ...wrongSet2]),
    outOfWindow: false,
    outDir: null,
    stage,
  };
}

function hcBuildGameRounds() {
  const rounds = [];
  for (let i = 0; i < HC_TOTAL_ROUNDS; i++) {
    rounds.push(hcGenerateRound(i));
  }
  return rounds;
}

// ── Render the 3x3 chart grid ─────────────────────────────────
function hcRenderChartGrid(round) {
  hcChartGrid.innerHTML = '';
  for (let i = 0; i < 9; i++) {
    const cell = document.createElement('div');
    const row = round.windowRow + Math.floor(i / 3);
    const col = round.windowCol + (i % 3);
    const val = hcCellValue(row, col);

    if (!round.outOfWindow && i === round.questionPos) {
      cell.className = 'chart-cell cell-question';
      cell.textContent = '?';
    } else if (round.outOfWindow) {
      // All 3x3 visible, but with a label showing the question is outside
      cell.className = 'chart-cell';
      cell.textContent = val;
    } else if (round.visiblePositions.includes(i)) {
      cell.className = 'chart-cell';
      cell.textContent = val;
    } else {
      // Not the question, not visible → empty hint cell
      cell.className = 'chart-cell cell-empty';
      cell.textContent = '';
    }

    hcChartGrid.appendChild(cell);
  }

  // If out-of-window, add a hint label
  if (round.outOfWindow) {
    const hintEl = document.createElement('div');
    hintEl.style.cssText = 'grid-column:1/-1;text-align:center;font-size:0.8rem;font-weight:800;color:rgba(255,255,255,0.9);margin-top:2px;';
    if (round.outDir === 'below') {
      hintEl.textContent = '↓ 이 창 바로 아래 칸의 가운데 수는?';
    } else {
      hintEl.textContent = '→ 이 창 오른쪽 줄 가운데 수는?';
    }
    hcChartGrid.appendChild(hintEl);
  }
}

// ── Navigation ───────────────────────────────────────────────
var hcCountdownInterval = null;
function hcStartPreGameCountdown(onDone) {
  hcShowScreen(hcCountdownScreen);
  var count = 3;
  hcCountdownNumber.textContent = count;
  hcCountdownInterval = setInterval(function() {
    count--;
    if (count <= 0) {
      clearInterval(hcCountdownInterval);
      hcCountdownInterval = null;
      onDone();
    } else {
      hcCountdownNumber.textContent = count;
      hcCountdownNumber.style.animation = 'none';
      hcCountdownNumber.offsetHeight;
      hcCountdownNumber.style.animation = '';
    }
  }, 1000);
}

onTap(hcSoundToggle, () => { hcSound.toggleMute(); hcUpdateSoundBtn(); });
hcUpdateSoundBtn();

document.querySelectorAll('.player-btn').forEach(btn => {
  onTap(btn, () => {
    document.querySelectorAll('.player-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    hcPlayerCount = parseInt(btn.dataset.count, 10);
  });
});

onTap(hcBackBtn,  () => goHome());
onTap(hcCloseBtn, () => { hcClearTimers(); if (hcCountdownInterval) { clearInterval(hcCountdownInterval); hcCountdownInterval = null; } goHome(); });
onTap(hcHomeBtn,  () => goHome());
onTap(hcRetryBtn, () => hcStartPreGameCountdown(() => hcStartGame()));
onTap(hcPlayBtn,  () => hcStartPreGameCountdown(() => hcStartGame()));

// ── Build zones ───────────────────────────────────────────────
function hcBuildZones() {
  hcZonesWrap.innerHTML = '';
  hcZonesWrap.className = `zones-wrap p${hcPlayerCount}`;

  for (let i = 0; i < hcPlayerCount; i++) {
    const cfg  = HC_PLAYER_CONFIG[i];
    const zone = document.createElement('div');
    zone.className = `zone ${cfg.cls}`;
    zone.dataset.player = i;

    const header = document.createElement('div');
    header.className = 'zone-header';
    header.innerHTML = `
      <span class="zone-label">${cfg.label}</span>
      <span class="zone-score-chip" id="hc-score-chip-${i}">0점</span>
    `;

    const grid = document.createElement('div');
    grid.className = 'answer-grid';
    grid.id = `hc-answer-grid-${i}`;

    for (let j = 0; j < 4; j++) {
      const btn = document.createElement('button');
      btn.className = 'answer-btn';
      btn.dataset.player = i;
      btn.dataset.slot = j;
      btn.textContent = '?';
      onTap(btn, () => hcHandleAnswerTap(i, j, btn));
      grid.appendChild(btn);
    }

    zone.appendChild(header);
    zone.appendChild(grid);
    hcZonesWrap.appendChild(zone);
  }
}

function hcGetZone(idx) {
  return hcZonesWrap.querySelector(`.zone[data-player="${idx}"]`);
}

function hcGetAnswerBtns(playerIdx) {
  return hcZonesWrap.querySelectorAll(`.answer-btn[data-player="${playerIdx}"]`);
}

function hcUpdateScoreChip(playerIdx) {
  const chip = document.getElementById(`hc-score-chip-${playerIdx}`);
  if (chip) chip.textContent = `${hcScores[playerIdx]}점`;
}

// ── Score bar ─────────────────────────────────────────────────
function hcBuildScoreBar() {
  hcScoreBar.innerHTML = '';
  for (let i = 0; i < hcPlayerCount; i++) {
    const cfg  = HC_PLAYER_CONFIG[i];
    const chip = document.createElement('div');
    chip.className = 'score-chip';
    chip.innerHTML = `
      <span class="score-chip-dot" style="background:${cfg.dot}"></span>
      <span>${cfg.label}</span>
      <span class="score-chip-val" id="hc-bar-score-${i}">0</span>
    `;
    hcScoreBar.appendChild(chip);
  }
}

function hcUpdateBarScore(playerIdx) {
  const el = document.getElementById(`hc-bar-score-${playerIdx}`);
  if (el) el.textContent = hcScores[playerIdx];
}

// ── Populate answers ──────────────────────────────────────────
function hcPopulateAnswers(round) {
  for (let i = 0; i < hcPlayerCount; i++) {
    const btns = hcGetAnswerBtns(i);
    btns.forEach((btn, j) => {
      btn.textContent = round.displayChoices[j];
      btn.className   = 'answer-btn';
      btn.disabled    = false;
      if (hcDqSet.has(i)) {
        btn.classList.add('state-disabled');
        btn.disabled = true;
      }
    });
  }
}

// ── Answer tap handler ────────────────────────────────────────
function hcHandleAnswerTap(playerIdx, slotIdx, btn) {
  if (hcPhase !== 'active') return;
  if (hcDqSet.has(playerIdx)) return;

  const chosen  = parseInt(btn.textContent, 10);
  const correct = chosen === hcCurrentRound.answer;

  if (correct) {
    hcResolveRound(playerIdx, btn);
  } else {
    hcSound.play('buzz');
    btn.classList.add('state-wrong');
    hcDisqualifyPlayer(playerIdx);
  }
}

function hcDisqualifyPlayer(playerIdx) {
  if (hcDqSet.has(playerIdx)) return;
  hcDqSet.add(playerIdx);

  const zone = hcGetZone(playerIdx);
  if (zone) {
    const flash = document.createElement('div');
    flash.className = 'penalty-flash';
    flash.textContent = '실격!';
    zone.appendChild(flash);
    flash.addEventListener('animationend', () => flash.remove());
    zone.classList.add('dq-zone');
  }

  hcGetAnswerBtns(playerIdx).forEach(b => {
    b.classList.add('state-disabled');
    b.disabled = true;
  });

  const allDq = Array.from({ length: hcPlayerCount }, (_, i) => i)
    .every(i => hcDqSet.has(i));
  if (allDq) {
    hcClearTimers();
    hcHandleTimeout();
  }
}

function hcResolveRound(winnerIdx, winBtn) {
  if (hcPhase !== 'active') return;
  hcPhase = 'done';
  hcClearTimers();
  hcSound.play('ding');

  hcScores[winnerIdx]++;
  hcUpdateScoreChip(winnerIdx);
  hcUpdateBarScore(winnerIdx);

  if (winBtn) winBtn.classList.add('state-correct');

  for (let i = 0; i < hcPlayerCount; i++) {
    if (i !== winnerIdx) {
      hcGetAnswerBtns(i).forEach(b => { b.classList.add('state-disabled'); b.disabled = true; });
    }
  }
  hcGetAnswerBtns(winnerIdx).forEach(b => {
    if (!b.classList.contains('state-correct')) {
      b.classList.add('state-disabled'); b.disabled = true;
    }
  });

  const cfg = HC_PLAYER_CONFIG[winnerIdx];
  hcProblemStatus.textContent = `${cfg.label} 정답! 🎉`;

  // Reveal answer on chart grid
  if (!hcCurrentRound.outOfWindow) {
    const cells = hcChartGrid.querySelectorAll('.chart-cell');
    if (cells[hcCurrentRound.questionPos]) {
      cells[hcCurrentRound.questionPos].textContent = hcCurrentRound.answer;
      cells[hcCurrentRound.questionPos].classList.remove('cell-question');
      cells[hcCurrentRound.questionPos].style.background = '#A5D6A7';
      cells[hcCurrentRound.questionPos].style.borderColor = '#388E3C';
      cells[hcCurrentRound.questionPos].style.animation = 'none';
    }
  }

  hcRoundLog.push({
    answer: hcCurrentRound.answer,
    winnerIdx,
    dqSet: new Set(hcDqSet),
    timedOut: false,
  });

  hcNextHandle = setTimeout(() => hcNextRound(), HC_RESULT_PAUSE_MS);
}

function hcHandleTimeout() {
  if (hcPhase !== 'active' && hcPhase !== 'done') return;
  hcPhase = 'done';
  hcClearTimers();
  hcSound.play('timeout');

  for (let i = 0; i < hcPlayerCount; i++) {
    hcGetAnswerBtns(i).forEach(b => {
      const val = parseInt(b.textContent, 10);
      if (val === hcCurrentRound.answer) {
        b.classList.remove('state-disabled');
        b.classList.add('state-reveal');
        b.disabled = true;
      } else {
        b.classList.add('state-disabled');
        b.disabled = true;
      }
    });
    const zone = hcGetZone(i);
    if (zone) zone.classList.remove('dq-zone');
  }

  // Reveal answer on chart grid
  if (!hcCurrentRound.outOfWindow) {
    const cells = hcChartGrid.querySelectorAll('.chart-cell');
    if (cells[hcCurrentRound.questionPos]) {
      cells[hcCurrentRound.questionPos].textContent = hcCurrentRound.answer;
      cells[hcCurrentRound.questionPos].classList.remove('cell-question');
      cells[hcCurrentRound.questionPos].style.background = '#FFE082';
      cells[hcCurrentRound.questionPos].style.borderColor = '#F57F17';
      cells[hcCurrentRound.questionPos].style.animation = 'none';
    }
  }

  hcProblemStatus.textContent = `정답은 ${hcCurrentRound.answer}!`;

  hcRoundLog.push({
    answer: hcCurrentRound.answer,
    winnerIdx: -1,
    dqSet: new Set(hcDqSet),
    timedOut: true,
  });

  hcNextHandle = setTimeout(() => hcNextRound(), HC_RESULT_PAUSE_MS);
}

// ── Timer ─────────────────────────────────────────────────────
function hcStartTimer() {
  hcTimeRemaining = HC_ROUND_TIME;
  hcProblemTimer.textContent = hcTimeRemaining;
  hcProblemTimer.classList.remove('urgent');

  hcTimerHandle = setInterval(() => {
    hcTimeRemaining--;
    hcProblemTimer.textContent = hcTimeRemaining;
    if (hcTimeRemaining <= 3) {
      hcProblemTimer.classList.add('urgent');
      hcSound.play('tick');
    }
    if (hcTimeRemaining <= 0) {
      hcClearTimers();
      hcPhase = 'active';
      hcHandleTimeout();
    }
  }, 1000);
}

// ── Round flow ────────────────────────────────────────────────
function hcLoadRound() {
  hcCurrentRound = hcGameRounds[hcRoundIdx];
  hcDqSet = new Set();
  hcPhase = 'idle';

  hcQuestionCounter.textContent = `${hcRoundIdx + 1} / ${HC_TOTAL_ROUNDS}`;
  hcProblemStatus.textContent = '';
  hcProblemTimer.classList.remove('urgent');

  for (let i = 0; i < hcPlayerCount; i++) {
    const zone = hcGetZone(i);
    if (zone) zone.classList.remove('dq-zone');
    hcGetAnswerBtns(i).forEach(b => {
      b.className = 'answer-btn';
      b.disabled  = false;
      b.textContent = '?';
    });
  }

  hcRenderChartGrid(hcCurrentRound);

  setTimeout(() => {
    hcPopulateAnswers(hcCurrentRound);
    hcPhase = 'active';
    hcStartTimer();
  }, 300);
}

function hcNextRound() {
  hcRoundIdx++;
  if (hcRoundIdx >= HC_TOTAL_ROUNDS) {
    hcShowResult();
  } else {
    hcLoadRound();
  }
}

function hcStartGame() {
  hcGameRounds = hcBuildGameRounds();
  hcRoundIdx   = 0;
  hcScores     = new Array(hcPlayerCount).fill(0);
  hcRoundLog   = [];
  hcDqSet      = new Set();
  hcPhase      = 'idle';

  hcClearTimers();
  hcBuildZones();
  hcBuildScoreBar();
  hcShowScreen(hcGameScreen);
  hcLoadRound();
}

// ── Result screen ─────────────────────────────────────────────
function hcShowResult() {
  hcClearTimers();
  hcPhase = 'idle';
  hcSound.play('fanfare');

  const maxScore = Math.max(...hcScores);
  const winners  = hcScores
    .map((s, i) => ({ s, i }))
    .filter(x => x.s === maxScore)
    .map(x => x.i);

  if (winners.length === 1) {
    const w = winners[0];
    hcResultTitle.textContent  = '🏆 게임 종료!';
    hcResultWinner.textContent = `${HC_PLAYER_CONFIG[w].label} 승리! (${maxScore}점)`;
  } else {
    const labels = winners.map(w => HC_PLAYER_CONFIG[w].label).join(', ');
    hcResultTitle.textContent  = '🤝 공동 우승!';
    hcResultWinner.textContent = `${labels} 공동 1위! (${maxScore}점)`;
  }

  const headRow = document.createElement('tr');
  headRow.innerHTML = '<th>#</th><th>정답</th>' +
    Array.from({ length: hcPlayerCount }, (_, i) =>
      `<th><span class="player-dot" style="background:${HC_PLAYER_CONFIG[i].dot}"></span>${HC_PLAYER_CONFIG[i].label}</th>`
    ).join('');
  hcResultTableHead.innerHTML = '';
  hcResultTableHead.appendChild(headRow);

  hcResultTableBody.innerHTML = '';
  hcRoundLog.forEach((log, idx) => {
    const tr = document.createElement('tr');
    let cells = `<td>${idx + 1}</td><td style="font-weight:800">${log.answer}</td>`;
    for (let i = 0; i < hcPlayerCount; i++) {
      if (log.winnerIdx === i)    { cells += `<td class="cell-win">★</td>`; }
      else if (log.dqSet.has(i))  { cells += `<td class="cell-dq">실격</td>`; }
      else if (log.timedOut)      { cells += `<td class="cell-timeout">시간초과</td>`; }
      else                         { cells += `<td class="cell-none">—</td>`; }
    }
    tr.innerHTML = cells;
    hcResultTableBody.appendChild(tr);
  });

  hcTotalRow.innerHTML = '';
  for (let i = 0; i < hcPlayerCount; i++) {
    const cfg   = HC_PLAYER_CONFIG[i];
    const isWin = winners.includes(i) && maxScore > 0;
    const chip  = document.createElement('div');
    chip.className = 'total-chip';
    chip.innerHTML = `
      <span class="chip-dot" style="background:${cfg.dot}"></span>
      <span>${cfg.label}</span>
      <span class="chip-score" style="color:${isWin ? '#2E7D32' : '#555'}">${hcScores[i]}점</span>
      ${isWin ? '<span style="font-size:1.1rem;">★</span>' : ''}
    `;
    hcTotalRow.appendChild(chip);
  }

  hcShowScreen(hcResultScreen);
}
