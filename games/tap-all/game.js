/* games/tap-all/game.js */

'use strict';

// ── Constants ────────────────────────────────────────────────
const TOTAL_ROUNDS    = 8;
const ROUND_TIME      = 30;    // seconds per round
const GRID_SIZE       = 16;    // 4x4
const PENALTY_SECS    = 2;     // lock duration on wrong tap
const RESULT_PAUSE_MS = getAutoplayPauseMs(2000);

// Player config
const PLAYER_CONFIG = [
  { label: 'P1', dot: '#0288D1', cls: 'p1' },
  { label: 'P2', dot: '#E53935', cls: 'p2' },
  { label: 'P3', dot: '#388E3C', cls: 'p3' },
  { label: 'P4', dot: '#F57C00', cls: 'p4' },
];

// ── Category library ─────────────────────────────────────────
const CATEGORIES = [
  {
    cond: '바다 동물만!',
    targets: ['🐟', '🐙', '🐳', '🦈', '🦑', '🐠'],
    distractors: ['🐮', '🐷', '🐸', '🐧', '🦁', '🐯', '🐻', '🐺', '🦊', '🐰'],
  },
  {
    cond: '과일만!',
    targets: ['🍎', '🍌', '🍇', '🍉', '🍊', '🍓'],
    distractors: ['🥦', '🥕', '🌽', '🍆', '🥔', '🧅', '🥒', '🍄', '🌰', '🥑'],
  },
  {
    cond: '탈것만!',
    targets: ['🚗', '🚌', '✈️', '🚢', '🚂', '🚁'],
    distractors: ['🐘', '🦒', '🐬', '🐦', '🐍', '🦋', '🌵', '🌲', '⛰️', '🏠'],
  },
  {
    cond: '곤충만!',
    targets: ['🦋', '🐝', '🐛', '🐞', '🦗', '🪲'],
    distractors: ['🐦', '🦜', '🦅', '🐦‍⬛', '🦆', '🦉', '🐧', '🐔', '🦚', '🦩'],
  },
  {
    cond: '새만!',
    targets: ['🐦', '🦜', '🦅', '🦆', '🦉', '🐧'],
    distractors: ['🦋', '🐝', '🐞', '🦗', '🪲', '🐛', '🦟', '🪳', '🐜', '🦎'],
  },
  {
    cond: '채소만!',
    targets: ['🥦', '🥕', '🌽', '🍆', '🥔', '🧅'],
    distractors: ['🍎', '🍌', '🍇', '🍊', '🍓', '🍑', '🍒', '🥝', '🍍', '🫐'],
  },
];

// Round plan: [targetCount, similarDistractors]
// similarDistractors=true means round 7~8 uses more similar distractors
const ROUND_PLAN = [
  { targetCount: 4, similar: false }, // round 1
  { targetCount: 4, similar: false }, // round 2
  { targetCount: 5, similar: false }, // round 3
  { targetCount: 5, similar: false }, // round 4
  { targetCount: 6, similar: false }, // round 5
  { targetCount: 6, similar: false }, // round 6
  { targetCount: 6, similar: true  }, // round 7
  { targetCount: 6, similar: true  }, // round 8
];

// ── Sound Manager ─────────────────────────────────────────────
const sound = createSoundManager({
  ding(ctx) {
    [523, 659, 784].forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      const t = ctx.currentTime + i * 0.09;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
      osc.start(t);
      osc.stop(t + 0.32);
    });
  },
  buzz(ctx) {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.28);
    gain.gain.setValueAtTime(0.45, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.32);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.32);
  },
  timeout(ctx) {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160, ctx.currentTime);
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  },
  tick(ctx) {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'square';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.08);
  },
  fanfare(ctx) {
    [392, 494, 523, 659, 784].forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'triangle';
      const t = ctx.currentTime + i * 0.12;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
      osc.start(t);
      osc.stop(t + 0.38);
    });
  },
});

// ── State ─────────────────────────────────────────────────────
let playerCount   = 2;
let roundIdx      = 0;
let scores        = [];
let roundLog      = [];
let currentRound  = null;   // { cells[16], targetSet(Set), cond }
let phase         = 'idle';
let timerHandle   = null;
let nextHandle    = null;
let timeRemaining = ROUND_TIME;
let gameRounds    = [];     // pre-generated rounds

// Per-zone state (reset each round)
// zoneState[i] = { tapped: Set<cellIdx>, locked: bool, lockTimer: null, lockCountdown: 0, done: bool }
let zoneState = [];

// ── DOM refs ──────────────────────────────────────────────────
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
const condLabel       = document.getElementById('condLabel');
const scoreBar        = document.getElementById('scoreBar');

const soundToggleIntro  = document.getElementById('soundToggleIntro');
const introIllust       = document.getElementById('introIllust');

const resultTitle       = document.getElementById('resultTitle');
const resultWinner      = document.getElementById('resultWinner');
const resultTableHead   = document.getElementById('resultTableHead');
const resultTableBody   = document.getElementById('resultTableBody');
const totalRow          = document.getElementById('totalRow');

// ── Helpers ───────────────────────────────────────────────────
function showScreen(s) {
  [introScreen, countdownScreen, gameScreen, resultScreen].forEach(function(x) {
    x.classList.remove('active');
  });
  s.classList.add('active');
}

var countdownInterval = null;
function startPreGameCountdown(onDone) {
  showScreen(countdownScreen);
  var count = 3;
  countdownNumber.textContent = count;
  countdownInterval = setInterval(function() {
    count--;
    if (count <= 0) {
      clearInterval(countdownInterval);
      countdownInterval = null;
      onDone();
    } else {
      countdownNumber.textContent = count;
      countdownNumber.style.animation = 'none';
      void countdownNumber.offsetHeight;
      countdownNumber.style.animation = '';
    }
  }, 1000);
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }
  return a;
}

function randInt(n) {
  return Math.floor(Math.random() * n);
}

function clearTimers() {
  if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
  if (timerHandle) { clearInterval(timerHandle); timerHandle = null; }
  if (nextHandle)  { clearTimeout(nextHandle);   nextHandle  = null; }
}

function updateSoundBtn(btn) {
  btn.textContent = sound.isMuted() ? '🔇' : '🔊';
}

// ── Round generation ──────────────────────────────────────────
function buildGameRounds() {
  const rounds = [];
  const usedCatIdx = new Set();

  for (let r = 0; r < TOTAL_ROUNDS; r++) {
    const plan = ROUND_PLAN[r];

    // Pick category (avoid repeats if possible)
    let catIdx;
    const available = [];
    for (let c = 0; c < CATEGORIES.length; c++) {
      if (!usedCatIdx.has(c)) available.push(c);
    }
    if (available.length === 0) {
      catIdx = randInt(CATEGORIES.length);
    } else {
      catIdx = available[randInt(available.length)];
    }
    usedCatIdx.add(catIdx);
    if (usedCatIdx.size >= CATEGORIES.length) usedCatIdx.clear();

    const cat = CATEGORIES[catIdx];

    // Pick target emojis
    const shuffledTargets = shuffle(cat.targets);
    const pickedTargets = shuffledTargets.slice(0, plan.targetCount);

    // Pick distractor emojis
    const distCount = GRID_SIZE - plan.targetCount;
    let distPool = cat.distractors.slice();
    if (plan.similar) {
      // Use distractors from adjacent categories for more similarity
      const adjIdx = (catIdx + 1) % CATEGORIES.length;
      distPool = distPool.concat(CATEGORIES[adjIdx].distractors);
    }
    const shuffledDist = shuffle(distPool);
    const pickedDist = shuffledDist.slice(0, distCount);

    // Build 16-cell grid: shuffle targets + distractors together
    const allEmojis = shuffle(pickedTargets.concat(pickedDist));

    const targetSet = new Set(pickedTargets);

    rounds.push({
      cells: allEmojis,
      targetSet: targetSet,
      targetArr: pickedTargets.slice(),
      cond: cat.cond,
      catIdx: catIdx,
    });
  }

  return rounds;
}

// ── Intro illustration ────────────────────────────────────────
function renderIntroIllust() {
  introIllust.innerHTML = '<svg viewBox="0 0 240 140" xmlns="http://www.w3.org/2000/svg">' +
    '<rect x="6" y="6" width="228" height="128" rx="16" fill="#FFF8E1" stroke="#2C2C2C" stroke-width="3"/>' +
    '<rect x="20" y="20" width="200" height="90" rx="10" fill="#fff" stroke="#2C2C2C" stroke-width="2"/>' +
    '<text x="50"  y="52" text-anchor="middle" font-size="22">🐟</text>' +
    '<text x="90"  y="52" text-anchor="middle" font-size="22">🍎</text>' +
    '<text x="130" y="52" text-anchor="middle" font-size="22">🐙</text>' +
    '<text x="170" y="52" text-anchor="middle" font-size="22">🐷</text>' +
    '<text x="50"  y="90" text-anchor="middle" font-size="22">🦈</text>' +
    '<text x="90"  y="90" text-anchor="middle" font-size="22">🐮</text>' +
    '<text x="130" y="90" text-anchor="middle" font-size="22">🦑</text>' +
    '<text x="170" y="90" text-anchor="middle" font-size="22">🐸</text>' +
    '<circle cx="50"  cy="44" r="18" fill="none" stroke="#2E7D32" stroke-width="3"/>' +
    '<circle cx="130" cy="44" r="18" fill="none" stroke="#2E7D32" stroke-width="3"/>' +
    '<circle cx="50"  cy="82" r="18" fill="none" stroke="#2E7D32" stroke-width="3"/>' +
    '<circle cx="130" cy="82" r="18" fill="none" stroke="#2E7D32" stroke-width="3"/>' +
    '<rect x="80" y="112" width="80" height="22" rx="10" fill="#0288D1"/>' +
    '<text x="120" y="128" text-anchor="middle" font-size="13" font-weight="900" fill="#fff">바다 동물만!</text>' +
    '</svg>';
}
renderIntroIllust();

// ── Player count selection ────────────────────────────────────
document.querySelectorAll('.player-btn').forEach(function(btn) {
  onTap(btn, function() {
    document.querySelectorAll('.player-btn').forEach(function(b) {
      b.classList.remove('active');
    });
    btn.classList.add('active');
    playerCount = parseInt(btn.dataset.count, 10);
  });
});

// ── Sound toggle ──────────────────────────────────────────────
onTap(soundToggleIntro, function() {
  sound.toggleMute();
  updateSoundBtn(soundToggleIntro);
});
updateSoundBtn(soundToggleIntro);

// ── Navigation ────────────────────────────────────────────────
onTap(backBtn,  function() { goHome(); });
onTap(closeBtn, function() { clearTimers(); goHome(); });
onTap(homeBtn,  function() { goHome(); });
onTap(retryBtn, function() { startPreGameCountdown(function() { startGame(); }); });
onTap(playBtn,  function() { startPreGameCountdown(function() { startGame(); }); });

// ── Build zones ───────────────────────────────────────────────
function buildZones() {
  zonesWrap.innerHTML = '';
  zonesWrap.className = 'zones-wrap p' + playerCount;

  for (let i = 0; i < playerCount; i++) {
    const cfg  = PLAYER_CONFIG[i];
    const zone = document.createElement('div');
    zone.className = 'zone ' + cfg.cls;
    zone.dataset.player = String(i);

    // Header
    const header = document.createElement('div');
    header.className = 'zone-header';
    header.innerHTML =
      '<span class="zone-label" style="color:' + cfg.dot + '">' + cfg.label + '</span>' +
      '<span class="zone-score-chip" id="score-chip-' + i + '">0점</span>';

    // 4x4 Emoji grid
    const grid = document.createElement('div');
    grid.className = 'emoji-grid';
    grid.id = 'emoji-grid-' + i;

    for (let c = 0; c < GRID_SIZE; c++) {
      const cell = document.createElement('div');
      cell.className = 'emoji-cell';
      cell.dataset.player = String(i);
      cell.dataset.cell = String(c);
      cell.setAttribute('role', 'button');
      cell.setAttribute('tabindex', '0');
      onTap(cell, function(pi, ci) {
        return function() { handleCellTap(pi, ci); };
      }(i, c));
      grid.appendChild(cell);
    }

    zone.appendChild(header);
    zone.appendChild(grid);
    zonesWrap.appendChild(zone);
  }
}

function getZone(playerIdx) {
  return zonesWrap.querySelector('.zone[data-player="' + playerIdx + '"]');
}

function getGrid(playerIdx) {
  return document.getElementById('emoji-grid-' + playerIdx);
}

function getCells(playerIdx) {
  const grid = getGrid(playerIdx);
  return grid ? Array.from(grid.querySelectorAll('.emoji-cell')) : [];
}

function updateScoreChip(playerIdx) {
  const chip = document.getElementById('score-chip-' + playerIdx);
  if (chip) chip.textContent = scores[playerIdx] + '점';
}

// ── Score bar ─────────────────────────────────────────────────
function buildScoreBar() {
  scoreBar.innerHTML = '';
  for (let i = 0; i < playerCount; i++) {
    const cfg  = PLAYER_CONFIG[i];
    const chip = document.createElement('div');
    chip.className = 'score-chip';
    chip.innerHTML =
      '<span class="score-chip-dot" style="background:' + cfg.dot + '"></span>' +
      '<span>' + cfg.label + '</span>' +
      '<span class="score-chip-val" id="bar-score-' + i + '">0</span>';
    scoreBar.appendChild(chip);
  }
}

function updateBarScore(playerIdx) {
  const el = document.getElementById('bar-score-' + playerIdx);
  if (el) el.textContent = String(scores[playerIdx]);
}

// ── Fill emoji grid cells with current round emojis ──────────
function fillGridCells(playerIdx) {
  const cells = getCells(playerIdx);
  cells.forEach(function(cell, c) {
    cell.textContent = currentRound.cells[c];
    cell.className = 'emoji-cell';
  });
}

// ── Reset zone state for new round ───────────────────────────
function initZoneState() {
  zoneState = [];
  for (let i = 0; i < playerCount; i++) {
    zoneState.push({
      tapped: new Set(),
      locked: false,
      lockTimer: null,
      lockCountdown: 0,
      done: false,
    });
  }
}

function resetZonesForRound() {
  for (let i = 0; i < playerCount; i++) {
    const zone = getZone(i);
    if (zone) {
      // remove lock overlay and complete banner
      const lo = zone.querySelector('.lock-overlay');
      if (lo) lo.remove();
      const cb = zone.querySelector('.zone-complete-banner');
      if (cb) cb.remove();
    }
    fillGridCells(i);
  }
}

// ── Lock overlay ──────────────────────────────────────────────
function showLockOverlay(playerIdx, secs) {
  const zone = getZone(playerIdx);
  if (!zone) return;

  let overlay = zone.querySelector('.lock-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'lock-overlay';
    overlay.innerHTML =
      '<span class="lock-overlay-icon">🔒</span>' +
      '<span class="lock-overlay-count" id="lock-count-' + playerIdx + '">' + secs + '초</span>';
    zone.appendChild(overlay);
  } else {
    const countEl = overlay.querySelector('.lock-overlay-count');
    if (countEl) countEl.textContent = secs + '초';
  }
}

function hideLockOverlay(playerIdx) {
  const zone = getZone(playerIdx);
  if (!zone) return;
  const overlay = zone.querySelector('.lock-overlay');
  if (overlay) overlay.remove();
}

function updateLockCount(playerIdx, secs) {
  const el = document.getElementById('lock-count-' + playerIdx);
  if (el) el.textContent = secs + '초';
}

// ── Apply penalty lock to a zone ─────────────────────────────
function applyPenalty(playerIdx) {
  const st = zoneState[playerIdx];
  if (st.lockTimer) {
    clearInterval(st.lockTimer);
    st.lockTimer = null;
  }
  st.locked = true;
  st.lockCountdown = PENALTY_SECS;

  showLockOverlay(playerIdx, st.lockCountdown);

  st.lockTimer = setInterval(function() {
    st.lockCountdown--;
    if (st.lockCountdown <= 0) {
      clearInterval(st.lockTimer);
      st.lockTimer = null;
      st.locked = false;
      hideLockOverlay(playerIdx);
    } else {
      updateLockCount(playerIdx, st.lockCountdown);
    }
  }, 1000);
}

// ── Show zone complete banner ─────────────────────────────────
function showCompleteBanner(playerIdx) {
  const zone = getZone(playerIdx);
  if (!zone) return;
  const banner = document.createElement('div');
  banner.className = 'zone-complete-banner';
  banner.innerHTML = '<div class="zone-complete-text">✅ 완료!<br>' + PLAYER_CONFIG[playerIdx].label + '</div>';
  zone.appendChild(banner);
}

// ── Cell tap handler ──────────────────────────────────────────
function handleCellTap(playerIdx, cellIdx) {
  if (phase !== 'active') return;
  const st = zoneState[playerIdx];
  if (st.done) return;
  if (st.locked) return;
  if (st.tapped.has(cellIdx)) return;

  const emoji = currentRound.cells[cellIdx];
  const isTarget = currentRound.targetSet.has(emoji);

  const cells = getCells(playerIdx);
  const cell = cells[cellIdx];
  if (!cell) return;

  if (isTarget) {
    // Correct tap
    sound.play('ding');
    st.tapped.add(cellIdx);
    cell.classList.add('tapped-correct');

    // Check if all targets are found in this zone
    let allFound = true;
    for (let c = 0; c < GRID_SIZE; c++) {
      if (currentRound.targetSet.has(currentRound.cells[c]) && !st.tapped.has(c)) {
        allFound = false;
        break;
      }
    }

    if (allFound) {
      st.done = true;
      resolveRound(playerIdx);
    }
  } else {
    // Wrong tap (distractor) — penalty
    sound.play('buzz');
    cell.classList.add('tapped-wrong');

    // Flash penalty text
    const zone = getZone(playerIdx);
    const flash = document.createElement('div');
    flash.className = 'penalty-flash';
    flash.textContent = '🔒 잠금!';
    zone.appendChild(flash);
    flash.addEventListener('animationend', function() { flash.remove(); });

    applyPenalty(playerIdx);
  }
}

// ── Round won by a player ─────────────────────────────────────
function resolveRound(winnerIdx) {
  phase = 'done';
  clearTimers();
  sound.play('ding');

  scores[winnerIdx]++;
  updateScoreChip(winnerIdx);
  updateBarScore(winnerIdx);

  showCompleteBanner(winnerIdx);

  // Clear locks on all zones
  for (let i = 0; i < playerCount; i++) {
    const st = zoneState[i];
    if (st.lockTimer) {
      clearInterval(st.lockTimer);
      st.lockTimer = null;
    }
    st.locked = false;
    hideLockOverlay(i);
  }

  roundLog.push({
    cond: currentRound.cond,
    winnerIdx: winnerIdx,
    timedOut: false,
  });

  nextHandle = setTimeout(function() { nextRound(); }, RESULT_PAUSE_MS);
}

// ── Timeout ───────────────────────────────────────────────────
function handleTimeout() {
  phase = 'done';
  clearTimers();
  sound.play('timeout');

  // Clear all locks
  for (let i = 0; i < playerCount; i++) {
    const st = zoneState[i];
    if (st.lockTimer) {
      clearInterval(st.lockTimer);
      st.lockTimer = null;
    }
    st.locked = false;
    hideLockOverlay(i);
  }

  // Reveal un-tapped targets in all zones
  for (let i = 0; i < playerCount; i++) {
    const cells = getCells(i);
    cells.forEach(function(cell, c) {
      if (currentRound.targetSet.has(currentRound.cells[c]) && !zoneState[i].tapped.has(c)) {
        cell.classList.add('reveal-target');
      }
    });
  }

  roundLog.push({
    cond: currentRound.cond,
    winnerIdx: -1,
    timedOut: true,
  });

  nextHandle = setTimeout(function() { nextRound(); }, RESULT_PAUSE_MS);
}

// ── Timer logic ───────────────────────────────────────────────
function startCountdown() {
  timeRemaining = ROUND_TIME;
  problemTimer.textContent = String(timeRemaining);
  problemTimer.classList.remove('urgent');

  timerHandle = setInterval(function() {
    timeRemaining--;
    problemTimer.textContent = String(timeRemaining);

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

// ── Load round ────────────────────────────────────────────────
function loadRound() {
  phase        = 'active';
  currentRound = gameRounds[roundIdx];

  questionCounter.textContent = (roundIdx + 1) + ' / ' + TOTAL_ROUNDS;
  condLabel.textContent       = currentRound.cond;
  problemTimer.classList.remove('urgent');

  initZoneState();
  resetZonesForRound();
  startCountdown();
}

// ── Next round ────────────────────────────────────────────────
function nextRound() {
  roundIdx++;
  if (roundIdx >= TOTAL_ROUNDS) {
    showResult();
  } else {
    loadRound();
  }
}

// ── Start game ────────────────────────────────────────────────
function startGame() {
  gameRounds  = buildGameRounds();
  roundIdx    = 0;
  scores      = new Array(playerCount).fill(0);
  roundLog    = [];
  phase       = 'idle';
  zoneState   = [];

  clearTimers();
  buildZones();
  buildScoreBar();
  showScreen(gameScreen);
  loadRound();
}

// ── Show result ───────────────────────────────────────────────
function showResult() {
  clearTimers();
  phase = 'idle';
  sound.play('fanfare');

  const maxScore = Math.max.apply(null, scores);
  const winners  = scores
    .map(function(s, i) { return { s: s, i: i }; })
    .filter(function(x) { return x.s === maxScore; })
    .map(function(x) { return x.i; });

  if (maxScore === 0) {
    resultTitle.textContent  = '무승부!';
    resultWinner.textContent = '아무도 라운드를 완료하지 못했어요.';
  } else if (winners.length === 1) {
    const w = winners[0];
    resultTitle.textContent  = '게임 종료!';
    resultWinner.textContent = PLAYER_CONFIG[w].label + ' 승리! (' + maxScore + '점)';
  } else {
    const labels = winners.map(function(w) { return PLAYER_CONFIG[w].label; }).join(', ');
    resultTitle.textContent  = '동점!';
    resultWinner.textContent = labels + ' 공동 1위! (' + maxScore + '점)';
  }

  // Build table header
  const headRow = document.createElement('tr');
  let headHtml = '<th>라운드</th>';
  for (let i = 0; i < playerCount; i++) {
    headHtml += '<th><span class="player-dot" style="background:' + PLAYER_CONFIG[i].dot + '"></span>' + PLAYER_CONFIG[i].label + '</th>';
  }
  headRow.innerHTML = headHtml;
  resultTableHead.innerHTML = '';
  resultTableHead.appendChild(headRow);

  // Build table body
  resultTableBody.innerHTML = '';
  roundLog.forEach(function(log, idx) {
    const tr = document.createElement('tr');
    let cells = '<td style="text-align:left;font-size:0.82rem;">' + (idx + 1) + '. ' + log.cond + '</td>';

    for (let i = 0; i < playerCount; i++) {
      if (log.winnerIdx === i) {
        cells += '<td class="cell-win">+1</td>';
      } else if (log.timedOut) {
        cells += '<td class="cell-timeout">시간초과</td>';
      } else {
        cells += '<td class="cell-none">—</td>';
      }
    }
    tr.innerHTML = cells;
    resultTableBody.appendChild(tr);
  });

  // Total chips
  totalRow.innerHTML = '';
  for (let i = 0; i < playerCount; i++) {
    const cfg   = PLAYER_CONFIG[i];
    const isWin = winners.indexOf(i) !== -1 && maxScore > 0;
    const chip  = document.createElement('div');
    chip.className = 'total-chip';
    chip.innerHTML =
      '<span class="chip-dot" style="background:' + cfg.dot + '"></span>' +
      '<span>' + cfg.label + '</span>' +
      '<span class="chip-score" style="color:' + (isWin ? '#2E7D32' : '#555') + '">' + scores[i] + '점</span>' +
      (isWin ? '<span style="font-size:1.1rem;">★</span>' : '');
    totalRow.appendChild(chip);
  }

  showScreen(resultScreen);
}
