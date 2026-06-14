/* games/make-ten/game.js */

'use strict';

// ── Constants ────────────────────────────────────────────────
const TOTAL_ROUNDS    = 8;
const ROUND_TIME      = 15;    // seconds per round
const RESULT_PAUSE_MS = getAutoplayPauseMs(2000);

// Player config
const PLAYER_CONFIG = [
  { label: 'P1', dot: '#0288D1', cls: 'p1' },
  { label: 'P2', dot: '#E53935', cls: 'p2' },
  { label: 'P3', dot: '#388E3C', cls: 'p3' },
  { label: 'P4', dot: '#F57C00', cls: 'p4' },
];

// ── Sound Manager ────────────────────────────────────────────
const sound = createSoundManager();

// ── State ────────────────────────────────────────────────────
let playerCount   = 2;
let roundIdx      = 0;
let scores        = [];
let roundLog      = [];  // { target, cards, winnerIdx, timedOut }
let currentRound  = null; // { cards: [6], target }
let phase         = 'idle';
let timerHandle   = null;
let nextHandle    = null;
let timeRemaining = ROUND_TIME;
let gameRounds    = [];

// Per-player selection state: firstSelected index or null, lockedUntil timestamp
let playerState   = [];

// ── DOM refs ─────────────────────────────────────────────────
const introScreen     = document.getElementById('introScreen');
const countdownScreen = document.getElementById('countdownScreen');
const countdownNumber = document.getElementById('countdownNumber');
const gameScreen      = document.getElementById('gameScreen');
const resultScreen    = document.getElementById('resultScreen');

const backBtn         = document.getElementById('backBtn');
const playBtn         = document.getElementById('playBtn');
const closeBtn        = document.getElementById('closeBtn');
const retryBtn        = document.getElementById('retryBtn');
const homeBtn         = document.getElementById('homeBtn');

const zonesWrap       = document.getElementById('zonesWrap');
const questionCounter = document.getElementById('questionCounter');
const problemTimer    = document.getElementById('problemTimer');
const problemStatus   = document.getElementById('problemStatus');
const scoreBar        = document.getElementById('scoreBar');

const soundToggleIntro = document.getElementById('soundToggleIntro');
const introIllust      = document.getElementById('introIllust');

const resultTitle      = document.getElementById('resultTitle');
const resultWinner     = document.getElementById('resultWinner');
const resultTableHead  = document.getElementById('resultTableHead');
const resultTableBody  = document.getElementById('resultTableBody');
const totalRow         = document.getElementById('totalRow');

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

function randInt(n) {
  return Math.floor(Math.random() * n);
}

function clearTimers() {
  if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
  if (timerHandle)       { clearInterval(timerHandle);       timerHandle = null; }
  if (nextHandle)        { clearTimeout(nextHandle);         nextHandle  = null; }
}

function updateSoundBtn(btn) {
  btn.textContent = sound.isMuted() ? '🔇' : '🔊';
}

// ── Round generation ─────────────────────────────────────────
// Exactly 1 pair among 6 cards must sum to target
function generateRound(rIdx) {
  let target, minVal, maxVal;

  if (rIdx <= 2) {
    target = 10;
    minVal = 1;
    maxVal = 9;
  } else if (rIdx <= 5) {
    target = 20;
    minVal = 5;
    maxVal = 18;
  } else {
    target = 30;
    minVal = 11;
    maxVal = 24;
  }

  // Build full candidate range
  const range = [];
  for (let v = minVal; v <= maxVal; v++) range.push(v);

  // Retry until exactly 1 pair sums to target
  for (let attempt = 0; attempt < 300; attempt++) {
    const shuffled = shuffle(range);
    const cards = shuffled.slice(0, 6);

    // Count pairs summing to target
    let pairCount = 0;
    for (let a = 0; a < cards.length; a++) {
      for (let b = a + 1; b < cards.length; b++) {
        if (cards[a] + cards[b] === target) pairCount++;
      }
    }

    if (pairCount === 1) {
      return { cards, target };
    }
  }

  // Fallback: force exactly 1 pair manually
  return forceSinglePair(target, minVal, maxVal);
}

function forceSinglePair(target, minVal, maxVal) {
  // Pick one valid pair where both are in range
  const validPairs = [];
  for (let a = minVal; a < target; a++) {
    const b = target - a;
    if (b >= minVal && b <= maxVal && b !== a) {
      validPairs.push([a, b]);
    }
  }

  const pair = validPairs[randInt(validPairs.length)];
  const [pa, pb] = pair;

  // Fill remaining 4 slots: avoid creating extra pairs with each other or with pa/pb
  const fillers = [];
  const all = [];
  for (let v = minVal; v <= maxVal; v++) {
    if (v !== pa && v !== pb) all.push(v);
  }
  const shuffledAll = shuffle(all);

  for (const v of shuffledAll) {
    if (fillers.length >= 4) break;
    // Check v doesn't form a pair with pa, pb, or any existing filler
    const testSet = [...fillers, v];
    let ok = true;
    if (pa + v === target || pb + v === target) { ok = false; }
    if (ok) {
      for (let i = 0; i < fillers.length; i++) {
        if (fillers[i] + v === target) { ok = false; break; }
      }
    }
    if (ok) fillers.push(v);
  }

  const cards = shuffle([pa, pb, ...fillers]);
  return { cards, target };
}

function buildGameRounds() {
  const rounds = [];
  for (let i = 0; i < TOTAL_ROUNDS; i++) {
    rounds.push(generateRound(i));
  }
  return rounds;
}

// ── Intro illustration ───────────────────────────────────────
function renderIntroIllust() {
  introIllust.innerHTML = `<svg viewBox="0 0 220 130" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="6" width="208" height="118" rx="16" fill="#FFF8E1" stroke="#2C2C2C" stroke-width="3"/>
    <rect x="18" y="24" width="52" height="52" rx="10" fill="#fff" stroke="#2C2C2C" stroke-width="3"/>
    <rect x="84" y="24" width="52" height="52" rx="10" fill="#fff" stroke="#2C2C2C" stroke-width="3"/>
    <text x="44" y="58" text-anchor="middle" font-size="22" font-weight="900" fill="#2C2C2C">3</text>
    <text x="110" y="58" text-anchor="middle" font-size="22" font-weight="900" fill="#2C2C2C">7</text>
    <text x="148" y="36" text-anchor="middle" font-size="14" font-weight="900" fill="#43A047">+</text>
    <text x="166" y="36" text-anchor="middle" font-size="12" font-weight="900" fill="#2C2C2C">=</text>
    <rect x="150" y="40" width="56" height="34" rx="8" fill="#A5D6A7" stroke="#2C2C2C" stroke-width="2"/>
    <text x="178" y="64" text-anchor="middle" font-size="20" font-weight="900" fill="#1B5E20">10</text>
    <text x="68" y="114" text-anchor="middle" font-size="13" font-weight="900" fill="#43A047">합이 10!</text>
  </svg>`;
}
renderIntroIllust();

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

// ── Build zones ──────────────────────────────────────────────
function buildZones() {
  zonesWrap.innerHTML = '';
  zonesWrap.className = `zones-wrap p${playerCount}`;

  for (let i = 0; i < playerCount; i++) {
    const cfg  = PLAYER_CONFIG[i];
    const zone = document.createElement('div');
    zone.className = `zone ${cfg.cls}`;
    zone.dataset.player = i;

    // Header
    const header = document.createElement('div');
    header.className = 'zone-header';
    header.innerHTML = `
      <span class="zone-label">${cfg.label}</span>
      <span class="zone-score-chip" id="score-chip-${i}">0점</span>
    `;

    // Target display (shows current target)
    const targetEl = document.createElement('div');
    targetEl.className = 'zone-target';
    targetEl.id = `zone-target-${i}`;
    targetEl.textContent = '합: ?';

    // 2x3 card grid
    const grid = document.createElement('div');
    grid.className = 'card-grid';
    grid.id = `card-grid-${i}`;

    for (let c = 0; c < 6; c++) {
      const btn = document.createElement('button');
      btn.className = 'card-btn';
      btn.dataset.player = String(i);
      btn.dataset.card = String(c);
      btn.setAttribute('aria-label', `${cfg.label} 카드 ${c + 1}`);
      onTap(btn, () => handleCardTap(i, c));
      grid.appendChild(btn);
    }

    zone.appendChild(header);
    zone.appendChild(targetEl);
    zone.appendChild(grid);
    zonesWrap.appendChild(zone);
  }
}

function getZone(idx) {
  return zonesWrap.querySelector(`.zone[data-player="${idx}"]`);
}

function getCardBtns(playerIdx) {
  const grid = document.getElementById(`card-grid-${playerIdx}`);
  return grid ? Array.from(grid.querySelectorAll('.card-btn')) : [];
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

// ── Reset cards for new round ────────────────────────────────
function resetCardsForRound() {
  for (let i = 0; i < playerCount; i++) {
    playerState[i] = { firstSelected: null, lockedUntil: 0 };
    const btns = getCardBtns(i);
    btns.forEach((btn, c) => {
      btn.className = 'card-btn';
      btn.disabled = false;
      btn.textContent = String(currentRound.cards[c]);
    });
    const targetEl = document.getElementById(`zone-target-${i}`);
    if (targetEl) targetEl.textContent = `합: ${currentRound.target}`;
  }
}

function disableAllCards(playerIdx) {
  getCardBtns(playerIdx).forEach(b => {
    b.disabled = true;
    b.classList.add('locked');
  });
}

// ── Timer logic ──────────────────────────────────────────────
function startCountdown() {
  timeRemaining = ROUND_TIME;
  problemTimer.textContent = timeRemaining;
  problemTimer.classList.remove('urgent');

  timerHandle = setInterval(() => {
    timeRemaining--;
    problemTimer.textContent = timeRemaining;

    if (timeRemaining <= 3) {
      problemTimer.classList.add('urgent');
      sound.play('tick');
    }

    if (timeRemaining <= 0) {
      clearTimers();
      handleTimeout();
    }
  }, 1000);
}

// ── Card tap handler ─────────────────────────────────────────
function handleCardTap(playerIdx, cardIdx) {
  if (phase !== 'active') return;

  const now  = Date.now();
  const pst  = playerState[playerIdx];

  // Check if locked
  if (now < pst.lockedUntil) return;

  const btns = getCardBtns(playerIdx);
  const btn  = btns[cardIdx];
  if (!btn || btn.disabled) return;

  if (pst.firstSelected === null) {
    // First selection: highlight
    pst.firstSelected = cardIdx;
    btn.classList.add('selected');
  } else if (pst.firstSelected === cardIdx) {
    // Tap same card: deselect
    btn.classList.remove('selected');
    pst.firstSelected = null;
  } else {
    // Second card: judge
    const firstIdx = pst.firstSelected;
    const firstBtn = btns[firstIdx];
    const cardA = currentRound.cards[firstIdx];
    const cardB = currentRound.cards[cardIdx];

    if (cardA + cardB === currentRound.target) {
      // Correct!
      resolveRound(playerIdx, firstIdx, cardIdx);
    } else {
      // Wrong: flash both cards, then lock player for 1s
      sound.play('buzz');
      firstBtn.classList.remove('selected');
      firstBtn.classList.add('wrong-flash');
      btn.classList.add('wrong-flash');

      // Show lock flash on zone
      const zone = getZone(playerIdx);
      const flash = document.createElement('div');
      flash.className = 'lock-flash';
      flash.textContent = '✗ 1초';
      zone.appendChild(flash);
      flash.addEventListener('animationend', () => flash.remove());

      pst.firstSelected = null;
      pst.lockedUntil = now + 1000;

      // Reset card states after brief flash
      setTimeout(() => {
        firstBtn.classList.remove('wrong-flash');
        btn.classList.remove('wrong-flash');
      }, 400);
    }
  }
}

// ── Correct answer resolved ──────────────────────────────────
function resolveRound(winnerIdx, cardA, cardB) {
  phase = 'done';
  clearTimers();
  sound.play('ding');

  scores[winnerIdx]++;
  updateScoreChip(winnerIdx);
  updateBarScore(winnerIdx);

  // Show correct pair in winner zone
  const winnerBtns = getCardBtns(winnerIdx);
  winnerBtns.forEach((btn, c) => {
    btn.classList.remove('selected', 'wrong-flash');
    if (c === cardA || c === cardB) {
      btn.classList.add('correct');
      btn.disabled = false;
    } else {
      btn.disabled = true;
      btn.classList.add('locked');
    }
  });

  // Disable all other zones
  for (let i = 0; i < playerCount; i++) {
    if (i !== winnerIdx) {
      disableAllCards(i);
      // Clear any selection state
      const btns = getCardBtns(i);
      btns.forEach(b => b.classList.remove('selected'));
    }
  }

  const winnerLabel = PLAYER_CONFIG[winnerIdx].label;
  const sumA = currentRound.cards[cardA];
  const sumB = currentRound.cards[cardB];
  problemStatus.textContent = `${winnerLabel} 정답! (${sumA} + ${sumB} = ${currentRound.target})`;

  roundLog.push({
    target: currentRound.target,
    cards: currentRound.cards.slice(),
    winnerIdx,
    timedOut: false,
  });

  nextHandle = setTimeout(() => nextRound(), RESULT_PAUSE_MS);
}

// ── Timeout ──────────────────────────────────────────────────
function handleTimeout() {
  phase = 'done';
  clearTimers();
  sound.play('timeout');

  // Find the correct pair and reveal it in all zones
  let pairA = -1, pairB = -1;
  const cards = currentRound.cards;
  for (let a = 0; a < cards.length; a++) {
    for (let b = a + 1; b < cards.length; b++) {
      if (cards[a] + cards[b] === currentRound.target) {
        pairA = a;
        pairB = b;
        break;
      }
    }
    if (pairA >= 0) break;
  }

  for (let i = 0; i < playerCount; i++) {
    const btns = getCardBtns(i);
    btns.forEach((btn, c) => {
      btn.classList.remove('selected', 'wrong-flash', 'locked');
      if (c === pairA || c === pairB) {
        btn.classList.add('reveal-pair');
        btn.disabled = true;
      } else {
        btn.disabled = true;
        btn.classList.add('locked');
      }
    });
  }

  const sumA = cards[pairA];
  const sumB = cards[pairB];
  problemStatus.textContent = `시간 초과! 정답: ${sumA} + ${sumB} = ${currentRound.target}`;

  roundLog.push({
    target: currentRound.target,
    cards: currentRound.cards.slice(),
    winnerIdx: -1,
    timedOut: true,
  });

  nextHandle = setTimeout(() => nextRound(), RESULT_PAUSE_MS);
}

// ── Load round ───────────────────────────────────────────────
function loadRound() {
  phase        = 'active';
  currentRound = gameRounds[roundIdx];

  questionCounter.textContent = `${roundIdx + 1} / ${TOTAL_ROUNDS}`;
  problemStatus.textContent   = '';
  problemTimer.classList.remove('urgent');

  resetCardsForRound();
  startCountdown();
}

// ── Next round ───────────────────────────────────────────────
function nextRound() {
  roundIdx++;
  if (roundIdx >= TOTAL_ROUNDS) {
    showResult();
  } else {
    loadRound();
  }
}

// ── Start game ───────────────────────────────────────────────
function startGame() {
  gameRounds    = buildGameRounds();
  roundIdx      = 0;
  scores        = new Array(playerCount).fill(0);
  roundLog      = [];
  playerState   = [];
  for (let i = 0; i < playerCount; i++) {
    playerState.push({ firstSelected: null, lockedUntil: 0 });
  }
  phase = 'idle';

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

  // Build table header
  const headRow = document.createElement('tr');
  headRow.innerHTML = '<th>라운드</th>' +
    Array.from({ length: playerCount }, (_, i) =>
      `<th><span class="player-dot" style="background:${PLAYER_CONFIG[i].dot}"></span>${PLAYER_CONFIG[i].label}</th>`
    ).join('');
  resultTableHead.innerHTML = '';
  resultTableHead.appendChild(headRow);

  // Build table body
  resultTableBody.innerHTML = '';
  roundLog.forEach((log, idx) => {
    const tr = document.createElement('tr');
    let cells = `<td style="text-align:left;font-size:0.82rem;">
      ${idx + 1}. 합: ${log.target}
    </td>`;

    for (let i = 0; i < playerCount; i++) {
      if (log.winnerIdx === i) {
        cells += `<td class="cell-win">+1</td>`;
      } else if (log.timedOut) {
        cells += `<td class="cell-timeout">시간초과</td>`;
      } else {
        cells += `<td class="cell-none">—</td>`;
      }
    }
    tr.innerHTML = cells;
    resultTableBody.appendChild(tr);
  });

  // Total chips
  totalRow.innerHTML = '';
  for (let i = 0; i < playerCount; i++) {
    const cfg   = PLAYER_CONFIG[i];
    const isWin = winners.includes(i) && maxScore > 0;
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
