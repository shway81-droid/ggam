/* games/closest-number/game.js */

'use strict';

// ── Constants ────────────────────────────────────────────────
const CN_TOTAL_ROUNDS    = 8;
const CN_ROUND_TIME      = 12;
const CN_RESULT_PAUSE_MS = getAutoplayPauseMs(2000);

// Player config
const CN_PLAYER_CONFIG = [
  { label: 'P1', dot: '#0288D1', cls: 'p1' },
  { label: 'P2', dot: '#E53935', cls: 'p2' },
  { label: 'P3', dot: '#388E3C', cls: 'p3' },
  { label: 'P4', dot: '#F57C00', cls: 'p4' },
];

// ── Sound Manager ────────────────────────────────────────────
const cnSound = createSoundManager();

// ── State ────────────────────────────────────────────────────
let cnPlayerCount   = 2;
let cnRoundIdx      = 0;
let cnScores        = [];
let cnRoundLog      = [];
let cnCurrentRound  = null;
let cnDqSet         = new Set();
let cnPhase         = 'idle';
let cnTimerHandle   = null;
let cnNextHandle    = null;
let cnTimeRemaining = CN_ROUND_TIME;
let cnGameRounds    = [];

// ── DOM refs ─────────────────────────────────────────────────
const cnIntroScreen     = document.getElementById('introScreen');
const cnCountdownScreen = document.getElementById('countdownScreen');
const cnCountdownNumber = document.getElementById('countdownNumber');
const cnGameScreen      = document.getElementById('gameScreen');
const cnResultScreen    = document.getElementById('resultScreen');

const cnBackBtn   = document.getElementById('backBtn');
const cnPlayBtn   = document.getElementById('playBtn');
const cnCloseBtn  = document.getElementById('closeBtn');
const cnRetryBtn  = document.getElementById('retryBtn');
const cnHomeBtn   = document.getElementById('homeBtn');

const cnZonesWrap       = document.getElementById('zonesWrap');
const cnQuestionCounter = document.getElementById('questionCounter');
const cnProblemTimer    = document.getElementById('problemTimer');
const cnProblemStatus   = document.getElementById('problemStatus');
const cnScoreBar        = document.getElementById('scoreBar');
const cnTargetNumber    = document.getElementById('targetNumber');
const cnNumberLineWrap  = document.getElementById('numberLineWrap');
const cnNumberLineTarget = document.getElementById('numberLineTarget');

const cnSoundToggle = document.getElementById('soundToggleIntro');

const cnResultTitle     = document.getElementById('resultTitle');
const cnResultWinner    = document.getElementById('resultWinner');
const cnResultTableHead = document.getElementById('resultTableHead');
const cnResultTableBody = document.getElementById('resultTableBody');
const cnTotalRow        = document.getElementById('totalRow');

// ── Helpers ──────────────────────────────────────────────────
function cnShowScreen(s) {
  [cnIntroScreen, cnCountdownScreen, cnGameScreen, cnResultScreen]
    .forEach(x => x.classList.remove('active'));
  s.classList.add('active');
}

function cnRandInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function cnShuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function cnClearTimers() {
  if (cnTimerHandle) { clearInterval(cnTimerHandle); cnTimerHandle = null; }
  if (cnNextHandle)  { clearTimeout(cnNextHandle);   cnNextHandle  = null; }
}

function cnUpdateSoundBtn() {
  cnSoundToggle.textContent = cnSound.isMuted() ? '🔇' : '🔊';
}

// ── Round generation ─────────────────────────────────────────
// 라운드 계획 (점증 난이도 8단계):
// 1~3: 차이 뚜렷 (target ±10 이상 차이)
// 4~5: 근소 (±2 vs ±4)
// 6: 어림 라운드 (expression sum)
// 7~8: 더 근소 (±1 vs ±3, 세 자리)
function cnGenerateRound(roundIdx) {
  const stage = roundIdx + 1; // 1-based

  let target, choices, answer, exprText, showLine;

  if (stage <= 3) {
    // 쉬움: 두 자리 수, 차이 뚜렷 (±15, ±25, ±35)
    showLine = true;
    let valid = false;
    while (!valid) {
      target = cnRandInt(30, 80);
      const distances = cnShuffle([5, 15, 25, 35]);
      const signs = [1, -1, 1, -1];
      choices = distances.map((d, i) => target + signs[i] * d);
      // 확인: 모두 양수이고 동률 없는지
      if (choices.some(c => c < 1 || c > 100)) { valid = false; continue; }
      const dists = choices.map(c => Math.abs(c - target));
      const minDist = Math.min(...dists);
      const minCount = dists.filter(d => d === minDist).length;
      if (minCount === 1) { valid = true; }
    }
    answer = choices.reduce((best, c) =>
      Math.abs(c - target) < Math.abs(best - target) ? c : best
    , choices[0]);
    exprText = null;
  } else if (stage <= 5) {
    // 중간: 근소 (±2 vs ±4)
    showLine = false;
    let valid = false;
    while (!valid) {
      target = cnRandInt(25, 85);
      const baseDistances = [2, 4, 8, 12];
      const shuffled = cnShuffle(baseDistances);
      const signs = cnShuffle([1, -1, 1, -1]);
      choices = shuffled.map((d, i) => target + signs[i] * d);
      if (choices.some(c => c < 1 || c > 100)) { valid = false; continue; }
      const dists = choices.map(c => Math.abs(c - target));
      const minDist = Math.min(...dists);
      const minCount = dists.filter(d => d === minDist).length;
      if (minCount === 1) { valid = true; }
    }
    answer = choices.reduce((best, c) =>
      Math.abs(c - target) < Math.abs(best - target) ? c : best
    , choices[0]);
    exprText = null;
  } else if (stage === 6) {
    // 어림 라운드: "29 + 32와 가장 가까운 수는?" → target은 실제 합
    showLine = false;
    let valid = false;
    while (!valid) {
      const a = cnRandInt(15, 45);
      const b = cnRandInt(15, 45);
      target = a + b;
      // 보기: 크게 간격 두기 (×20씩)
      const base = Math.round(target / 20) * 20;
      const candidates = [base - 40, base - 20, base, base + 20, base + 40]
        .filter(v => v > 0 && v < 200);
      if (candidates.length < 4) { valid = false; continue; }
      // 동률 금지: 두 보기가 target과 같은 거리면 안 됨
      const pool = cnShuffle(candidates).slice(0, 4);
      const dists = pool.map(c => Math.abs(c - target));
      const minDist = Math.min(...dists);
      const minCount = dists.filter(d => d === minDist).length;
      if (minCount !== 1) { valid = false; continue; }
      choices = pool;
      exprText = `${a} + ${b}`;
      valid = true;
    }
    answer = choices.reduce((best, c) =>
      Math.abs(c - target) < Math.abs(best - target) ? c : best
    , choices[0]);
  } else {
    // 7~8: 더 어려움, 세 자리 수도 등장, 근소
    showLine = false;
    let valid = false;
    while (!valid) {
      target = cnRandInt(40, 150);
      const baseDistances = [1, 3, 6, 10];
      const shuffled = cnShuffle(baseDistances);
      const signs = cnShuffle([1, -1, 1, -1]);
      choices = shuffled.map((d, i) => target + signs[i] * d);
      if (choices.some(c => c < 1)) { valid = false; continue; }
      const dists = choices.map(c => Math.abs(c - target));
      const minDist = Math.min(...dists);
      const minCount = dists.filter(d => d === minDist).length;
      if (minCount === 1) { valid = true; }
    }
    answer = choices.reduce((best, c) =>
      Math.abs(c - target) < Math.abs(best - target) ? c : best
    , choices[0]);
    exprText = null;
  }

  // shuffle choices for display order
  const displayChoices = cnShuffle(choices.slice());

  return { target, displayChoices, answer, exprText, showLine };
}

function cnBuildGameRounds() {
  const rounds = [];
  for (let i = 0; i < CN_TOTAL_ROUNDS; i++) {
    rounds.push(cnGenerateRound(i));
  }
  return rounds;
}

// ── Number line helper ────────────────────────────────────────
// min and max values displayed on the line (surrounding choices + target)
function cnUpdateNumberLine(round) {
  if (!round.showLine) {
    cnNumberLineWrap.classList.add('hidden');
    return;
  }
  cnNumberLineWrap.classList.remove('hidden');
  const all = [round.target, ...round.displayChoices];
  const minVal = Math.min(...all);
  const maxVal = Math.max(...all);
  const range = Math.max(maxVal - minVal, 1);
  const pct = ((round.target - minVal) / range) * 100;
  cnNumberLineTarget.style.left = `${Math.min(Math.max(pct, 5), 95)}%`;
}

// ── Navigation ───────────────────────────────────────────────
var cnCountdownInterval = null;
function cnStartPreGameCountdown(onDone) {
  cnShowScreen(cnCountdownScreen);
  cnCountdownInterval = runCountdown(cnCountdownNumber, onDone);
}

onTap(cnSoundToggle, () => { cnSound.toggleMute(); cnUpdateSoundBtn(); });
cnUpdateSoundBtn();

document.querySelectorAll('.player-btn').forEach(btn => {
  onTap(btn, () => {
    document.querySelectorAll('.player-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    cnPlayerCount = parseInt(btn.dataset.count, 10);
  });
});

onTap(cnBackBtn,  () => goHome());
onTap(cnCloseBtn, () => { cnClearTimers(); if (cnCountdownInterval) { clearInterval(cnCountdownInterval); cnCountdownInterval = null; } goHome(); });
onTap(cnHomeBtn,  () => goHome());
onTap(cnRetryBtn, () => cnStartPreGameCountdown(() => cnStartGame()));
onTap(cnPlayBtn,  () => cnStartPreGameCountdown(() => cnStartGame()));

// ── Build zones ───────────────────────────────────────────────
function cnBuildZones() {
  cnZonesWrap.innerHTML = '';
  cnZonesWrap.className = `zones-wrap p${cnPlayerCount}`;

  for (let i = 0; i < cnPlayerCount; i++) {
    const cfg  = CN_PLAYER_CONFIG[i];
    const zone = document.createElement('div');
    zone.className = `zone ${cfg.cls}`;
    zone.dataset.player = i;

    const header = document.createElement('div');
    header.className = 'zone-header';
    header.innerHTML = `
      <span class="zone-label">${cfg.label}</span>
      <span class="zone-score-chip" id="cn-score-chip-${i}">0점</span>
    `;

    const grid = document.createElement('div');
    grid.className = 'answer-grid';
    grid.id = `cn-answer-grid-${i}`;

    for (let j = 0; j < 4; j++) {
      const btn = document.createElement('button');
      btn.className = 'answer-btn';
      btn.dataset.player = i;
      btn.dataset.slot = j;
      btn.textContent = '?';
      onTap(btn, () => cnHandleAnswerTap(i, j, btn));
      grid.appendChild(btn);
    }

    zone.appendChild(header);
    zone.appendChild(grid);
    cnZonesWrap.appendChild(zone);
  }
}

function cnGetZone(idx) {
  return cnZonesWrap.querySelector(`.zone[data-player="${idx}"]`);
}

function cnGetAnswerBtns(playerIdx) {
  return cnZonesWrap.querySelectorAll(`.answer-btn[data-player="${playerIdx}"]`);
}

function cnUpdateScoreChip(playerIdx) {
  const chip = document.getElementById(`cn-score-chip-${playerIdx}`);
  if (chip) chip.textContent = `${cnScores[playerIdx]}점`;
}

// ── Score bar ─────────────────────────────────────────────────
function cnBuildScoreBar() {
  cnScoreBar.innerHTML = '';
  for (let i = 0; i < cnPlayerCount; i++) {
    const cfg  = CN_PLAYER_CONFIG[i];
    const chip = document.createElement('div');
    chip.className = 'score-chip';
    chip.innerHTML = `
      <span class="score-chip-dot" style="background:${cfg.dot}"></span>
      <span>${cfg.label}</span>
      <span class="score-chip-val" id="cn-bar-score-${i}">0</span>
    `;
    cnScoreBar.appendChild(chip);
  }
}

function cnUpdateBarScore(playerIdx) {
  const el = document.getElementById(`cn-bar-score-${playerIdx}`);
  if (el) el.textContent = cnScores[playerIdx];
}

// ── Populate answers ──────────────────────────────────────────
function cnPopulateAnswers(round) {
  for (let i = 0; i < cnPlayerCount; i++) {
    const btns = cnGetAnswerBtns(i);
    btns.forEach((btn, j) => {
      btn.textContent = round.displayChoices[j];
      btn.className   = 'answer-btn';
      btn.disabled    = false;
      if (cnDqSet.has(i)) {
        btn.classList.add('state-disabled');
        btn.disabled = true;
      }
    });
  }
}

// ── Answer tap handler ────────────────────────────────────────
function cnHandleAnswerTap(playerIdx, slotIdx, btn) {
  if (cnPhase !== 'active') return;
  if (cnDqSet.has(playerIdx)) return;

  const chosen  = cnCurrentRound.displayChoices[slotIdx];
  const correct = chosen === cnCurrentRound.answer;

  if (correct) {
    cnResolveRound(playerIdx, btn);
  } else {
    cnSound.play('buzz');
    btn.classList.add('state-wrong');
    cnDisqualifyPlayer(playerIdx);
  }
}

function cnDisqualifyPlayer(playerIdx) {
  if (cnDqSet.has(playerIdx)) return;
  cnDqSet.add(playerIdx);

  const zone = cnGetZone(playerIdx);
  if (zone) {
    const flash = document.createElement('div');
    flash.className = 'penalty-flash';
    flash.textContent = '실격!';
    zone.appendChild(flash);
    flash.addEventListener('animationend', () => flash.remove());
    zone.classList.add('dq-zone');
  }

  cnGetAnswerBtns(playerIdx).forEach(b => {
    b.classList.add('state-disabled');
    b.disabled = true;
  });

  // 모두 실격이면 timeout
  const allDq = Array.from({ length: cnPlayerCount }, (_, i) => i)
    .every(i => cnDqSet.has(i));
  if (allDq) {
    cnClearTimers();
    cnHandleTimeout();
  }
}

function cnResolveRound(winnerIdx, winBtn) {
  if (cnPhase !== 'active') return;
  cnPhase = 'done';
  cnClearTimers();
  cnSound.play('ding');

  cnScores[winnerIdx]++;
  cnUpdateScoreChip(winnerIdx);
  cnUpdateBarScore(winnerIdx);

  if (winBtn) winBtn.classList.add('state-correct');

  // Disable all others
  for (let i = 0; i < cnPlayerCount; i++) {
    if (i !== winnerIdx) {
      cnGetAnswerBtns(i).forEach(b => { b.classList.add('state-disabled'); b.disabled = true; });
    }
  }
  cnGetAnswerBtns(winnerIdx).forEach(b => {
    if (!b.classList.contains('state-correct')) {
      b.classList.add('state-disabled'); b.disabled = true;
    }
  });

  const cfg = CN_PLAYER_CONFIG[winnerIdx];
  cnProblemStatus.textContent = `${cfg.label} 정답! 🎉`;

  cnRoundLog.push({
    target: cnCurrentRound.target,
    answer: cnCurrentRound.answer,
    exprText: cnCurrentRound.exprText,
    winnerIdx,
    dqSet: new Set(cnDqSet),
    timedOut: false,
  });

  cnNextHandle = setTimeout(() => cnNextRound(), CN_RESULT_PAUSE_MS);
}

function cnHandleTimeout() {
  if (cnPhase !== 'active' && cnPhase !== 'done') return;
  cnPhase = 'done';
  cnClearTimers();
  cnSound.play('timeout');

  // reveal answer
  for (let i = 0; i < cnPlayerCount; i++) {
    cnGetAnswerBtns(i).forEach(b => {
      const val = parseInt(b.textContent, 10);
      if (val === cnCurrentRound.answer) {
        b.classList.remove('state-disabled');
        b.classList.add('state-reveal');
        b.disabled = true;
      } else {
        b.classList.add('state-disabled');
        b.disabled = true;
      }
    });
    const zone = cnGetZone(i);
    if (zone) zone.classList.remove('dq-zone');
  }

  cnProblemStatus.textContent = `정답은 ${cnCurrentRound.answer}!`;

  cnRoundLog.push({
    target: cnCurrentRound.target,
    answer: cnCurrentRound.answer,
    exprText: cnCurrentRound.exprText,
    winnerIdx: -1,
    dqSet: new Set(cnDqSet),
    timedOut: true,
  });

  cnNextHandle = setTimeout(() => cnNextRound(), CN_RESULT_PAUSE_MS);
}

// ── Timer ─────────────────────────────────────────────────────
function cnStartTimer() {
  cnTimeRemaining = CN_ROUND_TIME;
  cnProblemTimer.textContent = cnTimeRemaining;
  cnProblemTimer.classList.remove('urgent');

  cnTimerHandle = setInterval(() => {
    cnTimeRemaining--;
    cnProblemTimer.textContent = cnTimeRemaining;
    if (cnTimeRemaining <= 3) {
      cnProblemTimer.classList.add('urgent');
      cnSound.play('tick');
    }
    if (cnTimeRemaining <= 0) {
      cnClearTimers();
      cnPhase = 'active'; // ensure timeout handles
      cnHandleTimeout();
    }
  }, 1000);
}

// ── Round flow ────────────────────────────────────────────────
function cnLoadRound() {
  cnCurrentRound = cnGameRounds[cnRoundIdx];
  cnDqSet = new Set();
  cnPhase = 'idle';

  cnQuestionCounter.textContent = `${cnRoundIdx + 1} / ${CN_TOTAL_ROUNDS}`;
  cnProblemStatus.textContent = '';
  cnProblemTimer.classList.remove('urgent');

  // Reset zones
  for (let i = 0; i < cnPlayerCount; i++) {
    const zone = cnGetZone(i);
    if (zone) zone.classList.remove('dq-zone');
    cnGetAnswerBtns(i).forEach(b => {
      b.className = 'answer-btn';
      b.disabled  = false;
      b.textContent = '?';
    });
  }

  // Show target
  if (cnCurrentRound.exprText) {
    cnTargetNumber.textContent = cnCurrentRound.exprText;
  } else {
    cnTargetNumber.textContent = cnCurrentRound.target;
  }

  cnUpdateNumberLine(cnCurrentRound);

  setTimeout(() => {
    cnPopulateAnswers(cnCurrentRound);
    cnPhase = 'active';
    cnStartTimer();
  }, 300);
}

function cnNextRound() {
  cnRoundIdx++;
  if (cnRoundIdx >= CN_TOTAL_ROUNDS) {
    cnShowResult();
  } else {
    cnLoadRound();
  }
}

function cnStartGame() {
  cnGameRounds = cnBuildGameRounds();
  cnRoundIdx   = 0;
  cnScores     = new Array(cnPlayerCount).fill(0);
  cnRoundLog   = [];
  cnDqSet      = new Set();
  cnPhase      = 'idle';

  cnClearTimers();
  cnBuildZones();
  cnBuildScoreBar();
  cnShowScreen(cnGameScreen);
  cnLoadRound();
}

// ── Result screen ─────────────────────────────────────────────
function cnShowResult() {
  cnClearTimers();
  cnPhase = 'idle';
  cnSound.play('fanfare');

  const maxScore = Math.max(...cnScores);
  const winners  = cnScores
    .map((s, i) => ({ s, i }))
    .filter(x => x.s === maxScore)
    .map(x => x.i);

  if (winners.length === 1) {
    const w = winners[0];
    cnResultTitle.textContent  = '🏆 게임 종료!';
    cnResultWinner.textContent = `${CN_PLAYER_CONFIG[w].label} 승리! (${maxScore}점)`;
  } else {
    const labels = winners.map(w => CN_PLAYER_CONFIG[w].label).join(', ');
    cnResultTitle.textContent  = '🤝 공동 우승!';
    cnResultWinner.textContent = `${labels} 공동 1위! (${maxScore}점)`;
  }

  // Table header
  const headRow = document.createElement('tr');
  headRow.innerHTML = '<th>#</th><th>목표</th><th>정답</th>' +
    Array.from({ length: cnPlayerCount }, (_, i) =>
      `<th><span class="player-dot" style="background:${CN_PLAYER_CONFIG[i].dot}"></span>${CN_PLAYER_CONFIG[i].label}</th>`
    ).join('');
  cnResultTableHead.innerHTML = '';
  cnResultTableHead.appendChild(headRow);

  // Table body
  cnResultTableBody.innerHTML = '';
  cnRoundLog.forEach((log, idx) => {
    const tr = document.createElement('tr');
    const targetLabel = log.exprText ? log.exprText : String(log.target);
    let cells = `<td>${idx + 1}</td><td>${targetLabel}</td><td style="font-weight:800">${log.answer}</td>`;
    for (let i = 0; i < cnPlayerCount; i++) {
      if (log.winnerIdx === i)    { cells += `<td class="cell-win">★</td>`; }
      else if (log.dqSet.has(i))  { cells += `<td class="cell-dq">실격</td>`; }
      else if (log.timedOut)      { cells += `<td class="cell-timeout">시간초과</td>`; }
      else                         { cells += `<td class="cell-none">—</td>`; }
    }
    tr.innerHTML = cells;
    cnResultTableBody.appendChild(tr);
  });

  // Total chips
  cnTotalRow.innerHTML = '';
  for (let i = 0; i < cnPlayerCount; i++) {
    const cfg   = CN_PLAYER_CONFIG[i];
    const isWin = winners.includes(i) && maxScore > 0;
    const chip  = document.createElement('div');
    chip.className = 'total-chip';
    chip.innerHTML = `
      <span class="chip-dot" style="background:${cfg.dot}"></span>
      <span>${cfg.label}</span>
      <span class="chip-score" style="color:${isWin ? '#2E7D32' : '#555'}">${cnScores[i]}점</span>
      ${isWin ? '<span style="font-size:1.1rem;">★</span>' : ''}
    `;
    cnTotalRow.appendChild(chip);
  }

  cnShowScreen(cnResultScreen);
}
