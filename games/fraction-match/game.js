/* games/fraction-match/game.js */

'use strict';

// ── Constants ────────────────────────────────────────────────
const FM_TOTAL_ROUNDS    = 8;
const FM_ROUND_TIME      = 12;
const FM_RESULT_PAUSE_MS = getAutoplayPauseMs(2000);

// Player config
const FM_PLAYER_CONFIG = [
  { label: 'P1', dot: '#0288D1', cls: 'p1' },
  { label: 'P2', dot: '#E53935', cls: 'p2' },
  { label: 'P3', dot: '#388E3C', cls: 'p3' },
  { label: 'P4', dot: '#F57C00', cls: 'p4' },
];

// ── Sound Manager ────────────────────────────────────────────
const fmSound = createSoundManager();

// ── State ────────────────────────────────────────────────────
let fmPlayerCount   = 2;
let fmRoundIdx      = 0;
let fmScores        = [];
let fmRoundLog      = [];
let fmCurrentRound  = null;
let fmDqSet         = new Set();
let fmPhase         = 'idle';
let fmTimerHandle   = null;
let fmNextHandle    = null;
let fmTimeRemaining = FM_ROUND_TIME;
let fmGameRounds    = [];

// ── DOM refs ─────────────────────────────────────────────────
const fmIntroScreen     = document.getElementById('introScreen');
const fmCountdownScreen = document.getElementById('countdownScreen');
const fmCountdownNumber = document.getElementById('countdownNumber');
const fmGameScreen      = document.getElementById('gameScreen');
const fmResultScreen    = document.getElementById('resultScreen');

const fmBackBtn  = document.getElementById('backBtn');
const fmPlayBtn  = document.getElementById('playBtn');
const fmCloseBtn = document.getElementById('closeBtn');
const fmRetryBtn = document.getElementById('retryBtn');
const fmHomeBtn  = document.getElementById('homeBtn');

const fmZonesWrap          = document.getElementById('zonesWrap');
const fmQuestionCounter    = document.getElementById('questionCounter');
const fmProblemTimer       = document.getElementById('problemTimer');
const fmProblemStatus      = document.getElementById('problemStatus');
const fmScoreBar           = document.getElementById('scoreBar');
const fmFractionFigure     = document.getElementById('fractionFigure');
const fmQuestionLabel      = document.getElementById('fractionQuestionLabel');

const fmSoundToggle = document.getElementById('soundToggleIntro');

const fmResultTitle     = document.getElementById('resultTitle');
const fmResultWinner    = document.getElementById('resultWinner');
const fmResultTableHead = document.getElementById('resultTableHead');
const fmResultTableBody = document.getElementById('resultTableBody');
const fmTotalRow        = document.getElementById('totalRow');

// ── Helpers ──────────────────────────────────────────────────
function fmShowScreen(s) {
  [fmIntroScreen, fmCountdownScreen, fmGameScreen, fmResultScreen]
    .forEach(x => x.classList.remove('active'));
  s.classList.add('active');
}

function fmRandInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function fmShuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function fmClearTimers() {
  if (fmTimerHandle) { clearInterval(fmTimerHandle); fmTimerHandle = null; }
  if (fmNextHandle)  { clearTimeout(fmNextHandle);   fmNextHandle  = null; }
}

function fmUpdateSoundBtn() {
  fmSoundToggle.textContent = fmSound.isMuted() ? '🔇' : '🔊';
}

// fraction value as a decimal for comparison
function fmFracVal(n, d) { return n / d; }

// Greatest common divisor for simplification
function fmGcd(a, b) { return b === 0 ? a : fmGcd(b, a % b); }

// Check if two fractions are equal (same value)
function fmFracEqual(n1, d1, n2, d2) {
  return n1 * d2 === n2 * d1;
}

// ── Round generation ─────────────────────────────────────────
// Stage 1~3: unit fractions (분자=1)
// Stage 4~5: proper fractions (진분수)
// Stage 6~8: compare round — show two figures, pick the bigger fraction
function fmGenerateRound(roundIdx) {
  const stage = roundIdx + 1;

  let numerator, denominator, figureType, choices, answer, isCompare, comparePair;

  if (stage <= 3) {
    // Unit fractions: 1/2, 1/3, 1/4
    const denoms = [2, 3, 4, 6];
    denominator = denoms[fmRandInt(0, denoms.length - 1)];
    numerator = 1;
    figureType = 'pizza';
    // Generate 3 wrong fractions: same denominator, different numerator
    // or different denominator unit fractions
    // All choices must be unit fractions with different denominators
    const otherDenoms = denoms.filter(d => d !== denominator);
    const wrongFracs = fmShuffle(otherDenoms).slice(0, 3).map(d => ({ n: 1, d }));
    // Verify no duplicate values
    const allChoices = [{ n: numerator, d: denominator }, ...wrongFracs];
    // Check uniqueness
    const vals = allChoices.map(f => fmFracVal(f.n, f.d));
    const uniqueVals = new Set(vals.map(v => Math.round(v * 10000)));
    if (uniqueVals.size < 4) {
      // fallback: rebuild with simple fractions
      return fmGenerateRound(roundIdx);
    }
    choices = fmShuffle(allChoices);
    answer = { n: numerator, d: denominator };
  } else if (stage <= 5) {
    // Proper fractions: n/d where 1 < n < d
    let valid = false;
    let attempts = 0;
    while (!valid && attempts < 50) {
      attempts++;
      denominator = fmRandInt(3, 8);
      numerator   = fmRandInt(1, denominator - 1);
      figureType  = Math.random() < 0.5 ? 'pizza' : 'bar';
      // Generate 3 distinct wrong fractions with same denominator
      const wrongNums = [];
      for (let n = 1; n < denominator && wrongNums.length < 3; n++) {
        if (n !== numerator) wrongNums.push(n);
      }
      if (wrongNums.length < 3) { continue; }
      const wrongFracs = fmShuffle(wrongNums).slice(0, 3).map(n => ({ n, d: denominator }));
      const allChoices = [{ n: numerator, d: denominator }, ...wrongFracs];
      // Check no two choices have the same value (equivalence)
      const vals = allChoices.map(f => f.n * 100 + f.d); // same denom so just compare n
      const uniqueVals = new Set(vals);
      if (uniqueVals.size === 4) {
        choices = fmShuffle(allChoices);
        answer  = { n: numerator, d: denominator };
        valid   = true;
      }
    }
    if (!valid) return fmGenerateRound(roundIdx);
  } else {
    // Compare round: show two fractions visually, pick the bigger one
    // Both fractions have same denominator; display side by side
    isCompare = true;
    let valid = false;
    let attempts = 0;
    while (!valid && attempts < 50) {
      attempts++;
      denominator = fmRandInt(4, 8);
      const n1 = fmRandInt(1, denominator - 2);
      const n2 = fmRandInt(n1 + 1, denominator - 1);
      // n1/d < n2/d; answer is n2/d
      numerator = n2; // correct answer numerator
      comparePair = [
        { n: n1, d: denominator },
        { n: n2, d: denominator },
      ];
      figureType = 'pizza';
      // Wrong choices: other numerators with same denominator
      const wrongNums = [];
      for (let n = 1; n < denominator && wrongNums.length < 2; n++) {
        if (n !== n1 && n !== n2) wrongNums.push(n);
      }
      if (wrongNums.length < 2) { continue; }
      const wrongFracs = fmShuffle(wrongNums).slice(0, 2).map(n => ({ n, d: denominator }));
      const allChoices = [{ n: n2, d: denominator }, { n: n1, d: denominator }, ...wrongFracs];
      // Check all unique
      const numSet = new Set(allChoices.map(f => f.n));
      if (numSet.size === 4) {
        choices = fmShuffle(allChoices);
        answer  = { n: n2, d: denominator };
        valid   = true;
      }
    }
    if (!valid) return fmGenerateRound(roundIdx);
  }

  return {
    numerator:   answer.n,
    denominator: answer.d,
    figureType:  figureType || 'pizza',
    choices,
    answer,
    isCompare:   !!isCompare,
    comparePair: comparePair || null,
  };
}

function fmBuildGameRounds() {
  const rounds = [];
  for (let i = 0; i < FM_TOTAL_ROUNDS; i++) {
    rounds.push(fmGenerateRound(i));
  }
  return rounds;
}

// ── SVG figure rendering ──────────────────────────────────────
function fmRenderPizzaSVG(n, d, size) {
  // d equal sectors; n of them filled in FFCC80 (same color every time)
  const cx = size / 2, cy = size / 2, r = size * 0.42;
  const sliceAngle = (2 * Math.PI) / d;
  const fillColor = '#FFCC80';
  const strokeColor = '#2C2C2C';

  let paths = '';
  for (let i = 0; i < d; i++) {
    const startAngle = -Math.PI / 2 + i * sliceAngle;
    const endAngle   = startAngle + sliceAngle;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const largeArc = sliceAngle > Math.PI ? 1 : 0;
    const filled = i < n;
    paths += `<path d="M${cx},${cy} L${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 ${largeArc},1 ${x2.toFixed(2)},${y2.toFixed(2)} Z"
      fill="${filled ? fillColor : '#FFF8E1'}" stroke="${strokeColor}" stroke-width="1.8"/>`;
  }
  // outer circle border
  const circle = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${strokeColor}" stroke-width="2.5"/>`;
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">${paths}${circle}</svg>`;
}

function fmRenderBarSVG(n, d, w, h) {
  // d equal rectangular cells; n filled
  const cellW = w / d;
  const fillColor = '#FFCC80';
  const strokeColor = '#2C2C2C';
  let rects = '';
  for (let i = 0; i < d; i++) {
    const x = i * cellW;
    const filled = i < n;
    rects += `<rect x="${x.toFixed(2)}" y="0" width="${cellW.toFixed(2)}" height="${h}"
      fill="${filled ? fillColor : '#FFF8E1'}" stroke="${strokeColor}" stroke-width="1.8" rx="2"/>`;
  }
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    ${rects}
    <rect x="0" y="0" width="${w}" height="${h}" fill="none" stroke="${strokeColor}" stroke-width="2.5" rx="4"/>
  </svg>`;
}

function fmRenderFigure(round) {
  if (round.isCompare && round.comparePair) {
    // Show two pizzas side by side
    const pair = round.comparePair;
    const size = 72;
    const svg1 = fmRenderPizzaSVG(pair[0].n, pair[0].d, size);
    const svg2 = fmRenderPizzaSVG(pair[1].n, pair[1].d, size);
    fmFractionFigure.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;">
        <div style="text-align:center;">
          ${svg1}
          <div style="font-size:0.75rem;font-weight:800;color:rgba(255,255,255,0.85);margin-top:2px;">${pair[0].n}/${pair[0].d}</div>
        </div>
        <div style="font-size:1.2rem;font-weight:900;color:#fff;">VS</div>
        <div style="text-align:center;">
          ${svg2}
          <div style="font-size:0.75rem;font-weight:800;color:rgba(255,255,255,0.85);margin-top:2px;">${pair[1].n}/${pair[1].d}</div>
        </div>
      </div>
    `;
    fmQuestionLabel.textContent = '더 큰 분수는?';
  } else if (round.figureType === 'pizza') {
    const size = 90;
    const svg = fmRenderPizzaSVG(round.numerator, round.denominator, size);
    fmFractionFigure.innerHTML = svg;
    fmQuestionLabel.textContent = '이 그림이 나타내는 분수는?';
  } else {
    // bar
    const w = 180, h = 44;
    const svg = fmRenderBarSVG(round.numerator, round.denominator, w, h);
    fmFractionFigure.innerHTML = svg;
    fmQuestionLabel.textContent = '이 그림이 나타내는 분수는?';
  }
}

// ── Navigation ───────────────────────────────────────────────
var fmCountdownInterval = null;
function fmStartPreGameCountdown(onDone) {
  fmShowScreen(fmCountdownScreen);
  fmCountdownInterval = runCountdown(fmCountdownNumber, onDone);
}

onTap(fmSoundToggle, () => { fmSound.toggleMute(); fmUpdateSoundBtn(); });
fmUpdateSoundBtn();

document.querySelectorAll('.player-btn').forEach(btn => {
  onTap(btn, () => {
    document.querySelectorAll('.player-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    fmPlayerCount = parseInt(btn.dataset.count, 10);
  });
});

onTap(fmBackBtn,  () => goHome());
onTap(fmCloseBtn, () => { fmClearTimers(); if (fmCountdownInterval) { clearInterval(fmCountdownInterval); fmCountdownInterval = null; } goHome(); });
onTap(fmHomeBtn,  () => goHome());
onTap(fmRetryBtn, () => fmStartPreGameCountdown(() => fmStartGame()));
onTap(fmPlayBtn,  () => fmStartPreGameCountdown(() => fmStartGame()));

// ── Build zones ───────────────────────────────────────────────
function fmBuildZones() {
  fmZonesWrap.innerHTML = '';
  fmZonesWrap.className = `zones-wrap p${fmPlayerCount}`;

  for (let i = 0; i < fmPlayerCount; i++) {
    const cfg  = FM_PLAYER_CONFIG[i];
    const zone = document.createElement('div');
    zone.className = `zone ${cfg.cls}`;
    zone.dataset.player = i;

    const header = document.createElement('div');
    header.className = 'zone-header';
    header.innerHTML = `
      <span class="zone-label">${cfg.label}</span>
      <span class="zone-score-chip" id="fm-score-chip-${i}">0점</span>
    `;

    const grid = document.createElement('div');
    grid.className = 'answer-grid';
    grid.id = `fm-answer-grid-${i}`;

    for (let j = 0; j < 4; j++) {
      const btn = document.createElement('button');
      btn.className = 'answer-btn';
      btn.dataset.player = i;
      btn.dataset.slot = j;
      btn.innerHTML = '<span class="frac-num">?</span>';
      onTap(btn, () => fmHandleAnswerTap(i, j, btn));
      grid.appendChild(btn);
    }

    zone.appendChild(header);
    zone.appendChild(grid);
    fmZonesWrap.appendChild(zone);
  }
}

function fmGetZone(idx) {
  return fmZonesWrap.querySelector(`.zone[data-player="${idx}"]`);
}

function fmGetAnswerBtns(playerIdx) {
  return fmZonesWrap.querySelectorAll(`.answer-btn[data-player="${playerIdx}"]`);
}

function fmUpdateScoreChip(playerIdx) {
  const chip = document.getElementById(`fm-score-chip-${playerIdx}`);
  if (chip) chip.textContent = `${fmScores[playerIdx]}점`;
}

// ── Score bar ─────────────────────────────────────────────────
function fmBuildScoreBar() {
  fmScoreBar.innerHTML = '';
  for (let i = 0; i < fmPlayerCount; i++) {
    const cfg  = FM_PLAYER_CONFIG[i];
    const chip = document.createElement('div');
    chip.className = 'score-chip';
    chip.innerHTML = `
      <span class="score-chip-dot" style="background:${cfg.dot}"></span>
      <span>${cfg.label}</span>
      <span class="score-chip-val" id="fm-bar-score-${i}">0</span>
    `;
    fmScoreBar.appendChild(chip);
  }
}

function fmUpdateBarScore(playerIdx) {
  const el = document.getElementById(`fm-bar-score-${playerIdx}`);
  if (el) el.textContent = fmScores[playerIdx];
}

// Fraction display HTML
function fmFracHTML(n, d) {
  return `<span class="frac-num">${n}</span><span class="frac-line"></span><span class="frac-den">${d}</span>`;
}

// ── Populate answers ──────────────────────────────────────────
function fmPopulateAnswers(round) {
  for (let i = 0; i < fmPlayerCount; i++) {
    const btns = fmGetAnswerBtns(i);
    btns.forEach((btn, j) => {
      const ch = round.choices[j];
      btn.innerHTML = fmFracHTML(ch.n, ch.d);
      btn.dataset.choiceN = ch.n;
      btn.dataset.choiceD = ch.d;
      btn.className   = 'answer-btn';
      btn.disabled    = false;
      if (fmDqSet.has(i)) {
        btn.classList.add('state-disabled');
        btn.disabled = true;
      }
    });
  }
}

// ── Answer tap handler ────────────────────────────────────────
function fmHandleAnswerTap(playerIdx, slotIdx, btn) {
  if (fmPhase !== 'active') return;
  if (fmDqSet.has(playerIdx)) return;

  const choiceN = parseInt(btn.dataset.choiceN, 10);
  const choiceD = parseInt(btn.dataset.choiceD, 10);
  const correct = fmFracEqual(choiceN, choiceD, fmCurrentRound.answer.n, fmCurrentRound.answer.d);

  if (correct) {
    fmResolveRound(playerIdx, btn);
  } else {
    fmSound.play('buzz');
    btn.classList.add('state-wrong');
    fmDisqualifyPlayer(playerIdx);
  }
}

function fmDisqualifyPlayer(playerIdx) {
  if (fmDqSet.has(playerIdx)) return;
  fmDqSet.add(playerIdx);

  const zone = fmGetZone(playerIdx);
  if (zone) {
    const flash = document.createElement('div');
    flash.className = 'penalty-flash';
    flash.textContent = '실격!';
    zone.appendChild(flash);
    flash.addEventListener('animationend', () => flash.remove());
    zone.classList.add('dq-zone');
  }

  fmGetAnswerBtns(playerIdx).forEach(b => {
    b.classList.add('state-disabled');
    b.disabled = true;
  });

  const allDq = Array.from({ length: fmPlayerCount }, (_, i) => i)
    .every(i => fmDqSet.has(i));
  if (allDq) {
    fmClearTimers();
    fmHandleTimeout();
  }
}

function fmResolveRound(winnerIdx, winBtn) {
  if (fmPhase !== 'active') return;
  fmPhase = 'done';
  fmClearTimers();
  fmSound.play('ding');

  fmScores[winnerIdx]++;
  fmUpdateScoreChip(winnerIdx);
  fmUpdateBarScore(winnerIdx);

  if (winBtn) winBtn.classList.add('state-correct');

  for (let i = 0; i < fmPlayerCount; i++) {
    if (i !== winnerIdx) {
      fmGetAnswerBtns(i).forEach(b => { b.classList.add('state-disabled'); b.disabled = true; });
    }
  }
  fmGetAnswerBtns(winnerIdx).forEach(b => {
    if (!b.classList.contains('state-correct')) {
      b.classList.add('state-disabled'); b.disabled = true;
    }
  });

  const cfg = FM_PLAYER_CONFIG[winnerIdx];
  fmProblemStatus.textContent = `${cfg.label} 정답! 🎉`;

  fmRoundLog.push({
    answerN: fmCurrentRound.answer.n,
    answerD: fmCurrentRound.answer.d,
    winnerIdx,
    dqSet:   new Set(fmDqSet),
    timedOut: false,
    isCompare: fmCurrentRound.isCompare,
  });

  fmNextHandle = setTimeout(() => fmNextRound(), FM_RESULT_PAUSE_MS);
}

function fmHandleTimeout() {
  if (fmPhase !== 'active' && fmPhase !== 'done') return;
  fmPhase = 'done';
  fmClearTimers();
  fmSound.play('timeout');

  for (let i = 0; i < fmPlayerCount; i++) {
    fmGetAnswerBtns(i).forEach(b => {
      const bn = parseInt(b.dataset.choiceN, 10);
      const bd = parseInt(b.dataset.choiceD, 10);
      if (fmFracEqual(bn, bd, fmCurrentRound.answer.n, fmCurrentRound.answer.d)) {
        b.classList.remove('state-disabled');
        b.classList.add('state-reveal');
        b.disabled = true;
      } else {
        b.classList.add('state-disabled');
        b.disabled = true;
      }
    });
    const zone = fmGetZone(i);
    if (zone) zone.classList.remove('dq-zone');
  }

  fmProblemStatus.textContent = `정답: ${fmCurrentRound.answer.n}/${fmCurrentRound.answer.d}`;

  fmRoundLog.push({
    answerN: fmCurrentRound.answer.n,
    answerD: fmCurrentRound.answer.d,
    winnerIdx: -1,
    dqSet:    new Set(fmDqSet),
    timedOut: true,
    isCompare: fmCurrentRound.isCompare,
  });

  fmNextHandle = setTimeout(() => fmNextRound(), FM_RESULT_PAUSE_MS);
}

// ── Timer ─────────────────────────────────────────────────────
function fmStartTimer() {
  fmTimeRemaining = FM_ROUND_TIME;
  fmProblemTimer.textContent = fmTimeRemaining;
  fmProblemTimer.classList.remove('urgent');

  fmTimerHandle = setInterval(() => {
    fmTimeRemaining--;
    fmProblemTimer.textContent = fmTimeRemaining;
    if (fmTimeRemaining <= 3) {
      fmProblemTimer.classList.add('urgent');
      fmSound.play('tick');
    }
    if (fmTimeRemaining <= 0) {
      fmClearTimers();
      fmPhase = 'active';
      fmHandleTimeout();
    }
  }, 1000);
}

// ── Round flow ────────────────────────────────────────────────
function fmLoadRound() {
  fmCurrentRound = fmGameRounds[fmRoundIdx];
  fmDqSet = new Set();
  fmPhase = 'idle';

  fmQuestionCounter.textContent = `${fmRoundIdx + 1} / ${FM_TOTAL_ROUNDS}`;
  fmProblemStatus.textContent = '';
  fmProblemTimer.classList.remove('urgent');

  for (let i = 0; i < fmPlayerCount; i++) {
    const zone = fmGetZone(i);
    if (zone) zone.classList.remove('dq-zone');
    fmGetAnswerBtns(i).forEach(b => {
      b.className = 'answer-btn';
      b.disabled  = false;
      b.innerHTML = '<span class="frac-num">?</span>';
    });
  }

  fmRenderFigure(fmCurrentRound);

  setTimeout(() => {
    fmPopulateAnswers(fmCurrentRound);
    fmPhase = 'active';
    fmStartTimer();
  }, 300);
}

function fmNextRound() {
  fmRoundIdx++;
  if (fmRoundIdx >= FM_TOTAL_ROUNDS) {
    fmShowResult();
  } else {
    fmLoadRound();
  }
}

function fmStartGame() {
  fmGameRounds = fmBuildGameRounds();
  fmRoundIdx   = 0;
  fmScores     = new Array(fmPlayerCount).fill(0);
  fmRoundLog   = [];
  fmDqSet      = new Set();
  fmPhase      = 'idle';

  fmClearTimers();
  fmBuildZones();
  fmBuildScoreBar();
  fmShowScreen(fmGameScreen);
  fmLoadRound();
}

// ── Result screen ─────────────────────────────────────────────
function fmShowResult() {
  fmClearTimers();
  fmPhase = 'idle';
  fmSound.play('fanfare');

  const maxScore = Math.max(...fmScores);
  const winners  = fmScores
    .map((s, i) => ({ s, i }))
    .filter(x => x.s === maxScore)
    .map(x => x.i);

  if (winners.length === 1) {
    const w = winners[0];
    fmResultTitle.textContent  = '🏆 게임 종료!';
    fmResultWinner.textContent = `${FM_PLAYER_CONFIG[w].label} 승리! (${maxScore}점)`;
  } else {
    const labels = winners.map(w => FM_PLAYER_CONFIG[w].label).join(', ');
    fmResultTitle.textContent  = '🤝 공동 우승!';
    fmResultWinner.textContent = `${labels} 공동 1위! (${maxScore}점)`;
  }

  const headRow = document.createElement('tr');
  headRow.innerHTML = '<th>#</th><th>정답</th>' +
    Array.from({ length: fmPlayerCount }, (_, i) =>
      `<th><span class="player-dot" style="background:${FM_PLAYER_CONFIG[i].dot}"></span>${FM_PLAYER_CONFIG[i].label}</th>`
    ).join('');
  fmResultTableHead.innerHTML = '';
  fmResultTableHead.appendChild(headRow);

  fmResultTableBody.innerHTML = '';
  fmRoundLog.forEach((log, idx) => {
    const tr = document.createElement('tr');
    const label = log.isCompare
      ? `${log.answerN}/${log.answerD} (더 큰 쪽)`
      : `${log.answerN}/${log.answerD}`;
    let cells = `<td>${idx + 1}</td><td style="font-weight:800">${label}</td>`;
    for (let i = 0; i < fmPlayerCount; i++) {
      if (log.winnerIdx === i)    { cells += `<td class="cell-win">★</td>`; }
      else if (log.dqSet.has(i))  { cells += `<td class="cell-dq">실격</td>`; }
      else if (log.timedOut)      { cells += `<td class="cell-timeout">시간초과</td>`; }
      else                         { cells += `<td class="cell-none">—</td>`; }
    }
    tr.innerHTML = cells;
    fmResultTableBody.appendChild(tr);
  });

  fmTotalRow.innerHTML = '';
  for (let i = 0; i < fmPlayerCount; i++) {
    const cfg   = FM_PLAYER_CONFIG[i];
    const isWin = winners.includes(i) && maxScore > 0;
    const chip  = document.createElement('div');
    chip.className = 'total-chip';
    chip.innerHTML = `
      <span class="chip-dot" style="background:${cfg.dot}"></span>
      <span>${cfg.label}</span>
      <span class="chip-score" style="color:${isWin ? '#2E7D32' : '#555'}">${fmScores[i]}점</span>
      ${isWin ? '<span style="font-size:1.1rem;">★</span>' : ''}
    `;
    fmTotalRow.appendChild(chip);
  }

  fmShowScreen(fmResultScreen);
}
