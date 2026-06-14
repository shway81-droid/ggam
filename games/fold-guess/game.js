/* games/fold-guess/game.js */

'use strict';

// ── Constants ────────────────────────────────────────────────
const TOTAL_ROUNDS    = 10;
const ROUND_TIME      = 10;    // seconds per round
const RESULT_PAUSE_MS = getAutoplayPauseMs(2000);

// Player config
const PLAYER_CONFIG = [
  { label: 'P1', dot: '#0288D1', zoneBg: '#B3E5FC', cls: 'p1' },
  { label: 'P2', dot: '#E53935', zoneBg: '#FFCDD2', cls: 'p2' },
  { label: 'P3', dot: '#388E3C', zoneBg: '#C8E6C9', cls: 'p3' },
  { label: 'P4', dot: '#F57C00', zoneBg: '#FFE0B2', cls: 'p4' },
];

const FILL = '#7C4DFF';   // colored cell
const PAPER = '#FFF8F0';  // paper background
const INK = '#2C2C2C';    // border / lines

// ── Grid helpers ─────────────────────────────────────────────
// A "full" grid is a 4×4 boolean pattern, stored as a 16-char mask
// string (row-major). The puzzle folds along the vertical centre line,
// so the right half (cols 2,3) is the mirror of the left half (cols 0,1):
//   col3 = col0, col2 = col1.

function maskToArr(mask) {
  return mask.split('').map(c => c === '1');
}
function arrToMask(arr) {
  return arr.map(b => (b ? '1' : '0')).join('');
}

// Render a full 4×4 grid (the answer / unfolded paper)
function gridSvgFull(mask) {
  const arr = maskToArr(mask);
  let cells = '';
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const on = arr[r * 4 + c];
      cells += `<rect class="g-cell" x="${4 + c * 12}" y="${4 + r * 12}" width="12" height="12"
        fill="${on ? FILL : '#FFFFFF'}" stroke="${INK}" stroke-width="1.4"/>`;
    }
  }
  return `<svg viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg">
    <rect class="g-frame" x="2" y="2" width="52" height="52" rx="4" fill="${PAPER}" stroke="${INK}" stroke-width="3"/>
    ${cells}
  </svg>`;
}

// Render the folded half (left 2 columns) + crease + unfold hint
function foldedHalfSvg(left) {
  // left: 8 bools, index r*2 + c  (c = 0,1)
  let cells = '';
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 2; c++) {
      const on = left[r * 2 + c];
      cells += `<rect x="${16 + c * 12}" y="${6 + r * 12}" width="12" height="12"
        fill="${on ? FILL : '#FFFFFF'}" stroke="${INK}" stroke-width="1.4"/>`;
    }
  }
  // dashed ghost of the right half (where it unfolds to)
  let ghost = '';
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 2; c++) {
      ghost += `<rect x="${40 + c * 12}" y="${6 + r * 12}" width="12" height="12"
        fill="none" stroke="${INK}" stroke-width="1" stroke-dasharray="2,2" opacity="0.45"/>`;
    }
  }
  return `<svg viewBox="0 0 90 60" xmlns="http://www.w3.org/2000/svg">
    <rect x="14" y="4" width="28" height="52" rx="3" fill="${PAPER}" stroke="${INK}" stroke-width="3"/>
    ${cells}
    <line x1="40" y1="3" x2="40" y2="57" stroke="${INK}" stroke-width="2" stroke-dasharray="4,3"/>
    ${ghost}
    <path d="M 44 30 q 10 -10 18 0" fill="none" stroke="${INK}" stroke-width="2"/>
    <path d="M 62 30 l -4 -3 l 0 6 z" fill="${INK}"/>
  </svg>`;
}

// ── Item Data ────────────────────────────────────────────────
// Generate 36 distinct symmetric fold puzzles.
const ALL_ITEMS = [];
(function buildItems() {
  const seen = new Set();
  let guard = 0;
  while (ALL_ITEMS.length < 36 && guard < 4000) {
    guard++;
    const k = 2 + Math.floor(Math.random() * 3);  // 2..4 coloured cells
    const left = new Array(8).fill(false);
    let placed = 0;
    while (placed < k) {
      const p = Math.floor(Math.random() * 8);
      if (!left[p]) { left[p] = true; placed++; }
    }
    const full = new Array(16).fill(false);
    for (let r = 0; r < 4; r++) {
      const l0 = left[r * 2 + 0], l1 = left[r * 2 + 1];
      full[r * 4 + 0] = l0; full[r * 4 + 1] = l1;
      full[r * 4 + 2] = l1; full[r * 4 + 3] = l0;
    }
    const mask = arrToMask(full);
    if (seen.has(mask)) continue;
    seen.add(mask);
    ALL_ITEMS.push({
      left: left.slice(),
      name: mask,
      svg: (function (L) { return function () { return foldedHalfSvg(L); }; })(left.slice()),
    });
  }
})();

// ── Sound Manager ────────────────────────────────────────────
const sound = createSoundManager();

// ── State ────────────────────────────────────────────────────
let playerCount   = 2;
let roundIdx      = 0;
let scores        = [];
let roundLog      = [];
let currentFlag   = null;  // current item { name, svg, left }
let currentChoices = [];   // 4 full-grid mask strings
let dqSet         = new Set();
let phase         = 'idle';
let timerHandle   = null;
let nextHandle    = null;
let timeRemaining = ROUND_TIME;
let gameRounds    = [];

// ── DOM refs ─────────────────────────────────────────────────
const introScreen     = document.getElementById('introScreen');
const countdownScreen = document.getElementById('countdownScreen');
const countdownNumber = document.getElementById('countdownNumber');
const gameScreen    = document.getElementById('gameScreen');
const resultScreen  = document.getElementById('resultScreen');

const backBtn       = document.getElementById('backBtn');
const playBtn       = document.getElementById('playBtn');
const closeBtn      = document.getElementById('closeBtn');
const retryBtn      = document.getElementById('retryBtn');
const homeBtn       = document.getElementById('homeBtn');

const zonesWrap     = document.getElementById('zonesWrap');
const questionCounter = document.getElementById('questionCounter');
const problemTimer  = document.getElementById('problemTimer');
const flagDisplay   = document.getElementById('flagDisplay');
const problemStatus = document.getElementById('problemStatus');
const scoreBar      = document.getElementById('scoreBar');

const soundToggleIntro = document.getElementById('soundToggleIntro');
const introFlagRow  = document.getElementById('introFlagRow');

const resultTitle   = document.getElementById('resultTitle');
const resultWinner  = document.getElementById('resultWinner');
const resultTableHead = document.getElementById('resultTableHead');
const resultTableBody = document.getElementById('resultTableBody');
const totalRow      = document.getElementById('totalRow');

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


// Build 4 answer choices: correct unfolded grid + 3 distinct wrong grids
function makeChoices(item) {
  const correct = item.name;
  const correctArr = maskToArr(correct);
  const wrongs = new Set();

  // Distractor A: break symmetry — flip one right-half cell
  {
    const a = correctArr.slice();
    const rightIdx = [];
    for (let r = 0; r < 4; r++) { rightIdx.push(r * 4 + 2, r * 4 + 3); }
    const i = rightIdx[Math.floor(Math.random() * rightIdx.length)];
    a[i] = !a[i];
    const s = arrToMask(a);
    if (s !== correct) wrongs.add(s);
  }
  // Distractor B: a different symmetric grid
  {
    let tries = 0;
    while (tries < 30) {
      const other = ALL_ITEMS[Math.floor(Math.random() * ALL_ITEMS.length)].name;
      if (other !== correct && !wrongs.has(other)) { wrongs.add(other); break; }
      tries++;
    }
  }
  // Distractor C: add or remove one cell
  {
    const a = correctArr.slice();
    const i = Math.floor(Math.random() * 16);
    a[i] = !a[i];
    const s = arrToMask(a);
    if (s !== correct) wrongs.add(s);
  }
  // Fill up to 3 distinct wrongs with double-flip perturbations
  let guard = 0;
  while (wrongs.size < 3 && guard < 200) {
    guard++;
    const a = correctArr.slice();
    a[Math.floor(Math.random() * 16)] = !a[Math.floor(Math.random() * 16)];
    a[Math.floor(Math.random() * 16)] = !a[Math.floor(Math.random() * 16)];
    const s = arrToMask(a);
    if (s !== correct) wrongs.add(s);
  }

  const wrongArr = Array.from(wrongs).slice(0, 3);
  return shuffle([correct, ...wrongArr]);
}

// ── Intro preview ────────────────────────────────────────────
function renderIntroFlags() {
  introFlagRow.innerHTML = '';
  const sample = shuffle(ALL_ITEMS).slice(0, 3);
  sample.forEach(it => {
    const wrap = document.createElement('div');
    wrap.className = 'intro-flag-thumb';
    wrap.innerHTML = it.svg();
    introFlagRow.appendChild(wrap);
  });
}
renderIntroFlags();

// ── Player count selection ───────────────────────────────────
setupPlayerSelect(function (n) { playerCount = n; });

// ── Sound toggle ─────────────────────────────────────────────
setupSoundToggle(sound, soundToggleIntro);

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

// ── Populate answer buttons (grid SVGs) ──────────────────────
function populateAnswerBtns() {
  for (let i = 0; i < playerCount; i++) {
    const grid = document.getElementById(`answer-grid-${i}`);
    if (!grid) continue;
    grid.innerHTML = '';

    currentChoices.forEach((mask) => {
      const btn = document.createElement('button');
      btn.className = 'answer-btn answer-grid-btn';
      btn.dataset.player = i;
      btn.dataset.choice = mask;
      btn.setAttribute('aria-label', `P${i + 1} 보기`);
      btn.innerHTML = gridSvgFull(mask);

      onTap(btn, () => handleAnswerTap(i, mask, btn));
      grid.appendChild(btn);
    });
  }
}

function resetBtnsForRound() {
  for (let i = 0; i < playerCount; i++) {
    const btns = getAnswerBtns(i);
    const zone = getZone(i);
    btns.forEach(btn => {
      btn.className = 'answer-btn answer-grid-btn';
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

// ── Ripple ───────────────────────────────────────────────────
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

// ── Timer ────────────────────────────────────────────────────
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

// ── Answer tap ───────────────────────────────────────────────
function handleAnswerTap(playerIdx, chosenMask, btn) {
  if (phase !== 'active') return;
  if (dqSet.has(playerIdx)) return;

  const zone = getZone(playerIdx);
  spawnRipple(zone, null);

  const correct = (chosenMask === currentFlag.name);

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

// ── Resolve correct ──────────────────────────────────────────
function resolveRound(winnerIdx) {
  phase = 'done';
  clearTimers();
  sound.play('ding');

  scores[winnerIdx]++;
  updateScoreChip(winnerIdx);
  updateBarScore(winnerIdx);

  getAnswerBtns(winnerIdx).forEach(btn => {
    if (btn.dataset.choice === currentFlag.name) {
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
    flagName: `${roundIdx + 1}번 종이`,
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

  for (let i = 0; i < playerCount; i++) {
    getAnswerBtns(i).forEach(btn => {
      if (btn.dataset.choice === currentFlag.name) {
        btn.classList.add('state-reveal');
      } else {
        btn.classList.add('state-disabled');
        btn.disabled = true;
      }
    });
    const zone = getZone(i);
    if (zone) zone.classList.remove('dq-zone');
  }

  problemStatus.textContent = '시간 초과! 정답을 확인하세요';

  roundLog.push({
    flagName: `${roundIdx + 1}번 종이`,
    winnerIdx: -1,
    dqPlayers: [...dqSet],
    timedOut: true,
  });

  nextHandle = setTimeout(() => nextRound(), RESULT_PAUSE_MS);
}

// ── Load round ───────────────────────────────────────────────
function loadRound() {
  phase        = 'active';
  currentFlag  = gameRounds[roundIdx];
  currentChoices = makeChoices(currentFlag);
  dqSet        = new Set();

  questionCounter.textContent = `${roundIdx + 1} / ${TOTAL_ROUNDS}`;
  flagDisplay.innerHTML = currentFlag.svg();
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
  gameRounds  = shuffle(ALL_ITEMS).slice(0, TOTAL_ROUNDS);
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

// ── Result ───────────────────────────────────────────────────
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
  headRow.innerHTML = '<th>문제</th>' +
    Array.from({ length: playerCount }, (_, i) =>
      `<th><span class="player-dot" style="background:${PLAYER_CONFIG[i].dot}"></span>${PLAYER_CONFIG[i].label}</th>`
    ).join('');
  resultTableHead.innerHTML = '';
  resultTableHead.appendChild(headRow);

  resultTableBody.innerHTML = '';
  roundLog.forEach((log, idx) => {
    const tr = document.createElement('tr');
    let cells = `<td style="text-align:left;font-size:0.82rem;">${idx + 1}. ${log.flagName}</td>`;

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
