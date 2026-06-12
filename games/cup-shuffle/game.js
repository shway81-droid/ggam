/* games/cup-shuffle/game.js */

'use strict';

// ── Constants ────────────────────────────────────────────────
const TOTAL_ROUNDS    = 8;
const ROUND_TIME      = 12;
const RESULT_PAUSE_MS = getAutoplayPauseMs(2000);

// Player config
const CS_PLAYER_CONFIG = [
  { label: 'P1', dot: '#0288D1', cls: 'p1' },
  { label: 'P2', dot: '#E53935', cls: 'p2' },
  { label: 'P3', dot: '#388E3C', cls: 'p3' },
  { label: 'P4', dot: '#F57C00', cls: 'p4' },
];

// 라운드별 난이도: [컵 수, 교환 횟수, 교환 간격ms]
const CS_ROUND_CONFIG = [
  { cups: 3, swaps: 3, intervalMs: 700 },  // R1
  { cups: 3, swaps: 3, intervalMs: 650 },  // R2
  { cups: 3, swaps: 4, intervalMs: 600 },  // R3
  { cups: 3, swaps: 5, intervalMs: 550 },  // R4
  { cups: 3, swaps: 5, intervalMs: 500 },  // R5
  { cups: 4, swaps: 6, intervalMs: 450 },  // R6
  { cups: 4, swaps: 6, intervalMs: 400 },  // R7
  { cups: 4, swaps: 7, intervalMs: 350 },  // R8
];

const CUP_EMOJI = '🥤';
const BALL_EMOJI = '⚽';

// ── Sound Manager ────────────────────────────────────────────
const csSound = createSoundManager({
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
  shuffle(ctx) {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(330, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.18);
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
let csPlayerCount   = 2;
let csRoundIdx      = 0;
let csScores        = [];
let csRoundLog      = [];
let csDqSet         = new Set();
let csPhase         = 'idle';
let csTimerHandle   = null;
let csNextHandle    = null;
let csTimeRemaining = ROUND_TIME;
let csShuffleHandle = null;

// Cup positions: array of {slotIdx, hasBall}; slotIdx = current left-position slot
let csCupPositions  = [];  // [{hasBall: bool}] indexed by cup order, slotIdx tracked separately
let csCupSlots      = [];  // slot index → cup index (which cup is in which slot)
let csCupCount      = 3;
let csAnswerSlot    = 0;   // which slot has the ball after shuffle
let csAnswerCupNum  = 1;   // 1-indexed cup number at answer position

// ── DOM refs ─────────────────────────────────────────────────
const csIntroScreen     = document.getElementById('introScreen');
const csCountdownScreen = document.getElementById('countdownScreen');
const csCountdownNumber = document.getElementById('countdownNumber');
const csGameScreen      = document.getElementById('gameScreen');
const csResultScreen    = document.getElementById('resultScreen');

const csBackBtn     = document.getElementById('backBtn');
const csPlayBtn     = document.getElementById('playBtn');
const csCloseBtn    = document.getElementById('closeBtn');
const csRetryBtn    = document.getElementById('retryBtn');
const csHomeBtn     = document.getElementById('homeBtn');

const csZonesWrap   = document.getElementById('zonesWrap');
const csQCounter    = document.getElementById('questionCounter');
const csProbTimer   = document.getElementById('problemTimer');
const csProbStatus  = document.getElementById('problemStatus');
const csScoreBar    = document.getElementById('scoreBar');
const csCupStage    = document.getElementById('cupStage');

const csSoundToggle = document.getElementById('soundToggleIntro');
const csIntroIllust = document.getElementById('introIllust');

const csResultTitle = document.getElementById('resultTitle');
const csResultWinner= document.getElementById('resultWinner');
const csResultTHead = document.getElementById('resultTableHead');
const csResultTBody = document.getElementById('resultTableBody');
const csTotalRow    = document.getElementById('totalRow');

// ── Helpers ──────────────────────────────────────────────────
function csShowScreen(s) {
  [csIntroScreen, csCountdownScreen, csGameScreen, csResultScreen].forEach(x => x.classList.remove('active'));
  s.classList.add('active');
}

var csCdInterval = null;
function csStartCountdown(onDone) {
  csShowScreen(csCountdownScreen);
  var count = 3;
  csCountdownNumber.textContent = count;
  csCdInterval = setInterval(function() {
    count--;
    if (count <= 0) {
      clearInterval(csCdInterval); csCdInterval = null;
      onDone();
    } else {
      csCountdownNumber.textContent = count;
      csCountdownNumber.style.animation = 'none';
      csCountdownNumber.offsetHeight;
      csCountdownNumber.style.animation = '';
    }
  }, 1000);
}

function csClearTimers() {
  if (csCdInterval)    { clearInterval(csCdInterval);    csCdInterval    = null; }
  if (csTimerHandle)   { clearInterval(csTimerHandle);   csTimerHandle   = null; }
  if (csNextHandle)    { clearTimeout(csNextHandle);     csNextHandle    = null; }
  if (csShuffleHandle) { clearTimeout(csShuffleHandle);  csShuffleHandle = null; }
}

function csUpdateSoundBtn(btn) {
  btn.textContent = csSound.isMuted() ? '🔇' : '🔊';
}

// ── Cup stage rendering ───────────────────────────────────────
// csCupSlots[slotIdx] = cupIdx  (which cup occupies each slot)
// We track the left% positions of cups by slot index

function csGetSlotLeft(slotIdx, totalCups, stageWidth) {
  // Distribute cups evenly across stage width
  const padding = 0.08; // 8% padding each side
  const usable = 1 - 2 * padding;
  if (totalCups === 1) return 0.5;
  return padding + (usable * slotIdx / (totalCups - 1));
}

function csBuildCupStage(numCups) {
  csCupStage.innerHTML = '';
  csCupCount = numCups;

  // Initialize slots: slot i has cup i
  csCupSlots = Array.from({ length: numCups }, (_, i) => i);
  // cup index → slot index
  const cupToSlot = Array.from({ length: numCups }, (_, i) => i);

  // Place cup elements
  for (let c = 0; c < numCups; c++) {
    const item = document.createElement('div');
    item.className = 'cup-item';
    item.id = `cup-item-${c}`;
    item.innerHTML = `
      <div class="cup-ball" id="cup-ball-${c}" style="opacity:0;">${BALL_EMOJI}</div>
      <div class="cup-emoji">${CUP_EMOJI}</div>
      <div class="cup-label">${c + 1}번</div>
    `;
    // Position by slot
    const leftPct = csGetSlotLeft(c, numCups, 1) * 100;
    item.style.left = leftPct + '%';
    item.style.transform = 'translateX(-50%)';
    csCupStage.appendChild(item);
  }
}

function csGetCupElement(cupIdx) {
  return document.getElementById(`cup-item-${cupIdx}`);
}

function csBallElement(cupIdx) {
  return document.getElementById(`cup-ball-${cupIdx}`);
}

// Animate swap of two slots (swap cups at slotA and slotB)
// Returns a Promise that resolves after transition completes
function csAnimateSwap(slotA, slotB, durationMs) {
  return new Promise(function(resolve) {
    const cupA = csCupSlots[slotA];
    const cupB = csCupSlots[slotB];

    const elA = csGetCupElement(cupA);
    const elB = csGetCupElement(cupB);

    const leftA = csGetSlotLeft(slotA, csCupCount, 1) * 100;
    const leftB = csGetSlotLeft(slotB, csCupCount, 1) * 100;

    // Set transition duration
    const dur = (durationMs / 1000).toFixed(3) + 's';
    if (elA) { elA.style.transition = `left ${dur} ease-in-out`; elA.style.left = leftB + '%'; }
    if (elB) { elB.style.transition = `left ${dur} ease-in-out`; elB.style.left = leftA + '%'; }

    // Update tracking
    csCupSlots[slotA] = cupB;
    csCupSlots[slotB] = cupA;

    setTimeout(resolve, durationMs + 30);
  });
}

// ── Round lifecycle ───────────────────────────────────────────
// Phase 1: Show ball under cup (1.5s), Phase 2: Shuffle, Phase 3: Answer
function csRunRound() {
  const cfg = CS_ROUND_CONFIG[csRoundIdx];
  const numCups = cfg.cups;

  csBuildCupStage(numCups);
  csPhase = 'showing';
  csProbStatus.textContent = '공을 잘 보세요!';
  csSetZoneBtnsDisabled(true, numCups);

  // Pick which cup gets the ball (0-indexed cup)
  const ballCupIdx = Math.floor(Math.random() * numCups);

  // Show ball under cup
  const ballEl = csBallElement(ballCupIdx);
  if (ballEl) ballEl.style.opacity = '1';

  // After 1.5s, hide ball (cup "covers" it) then shuffle
  csShuffleHandle = setTimeout(function() {
    if (ballEl) ballEl.style.opacity = '0';
    csPhase = 'shuffling';
    csProbStatus.textContent = '잘 따라가세요!';

    // Build shuffle sequence: list of [slotA, slotB] pairs
    const swapSequence = csGenerateSwaps(cfg.swaps, numCups);
    // Track where ball cup ends up
    let ballSlot = ballCupIdx; // initially ball cup is at slot = ballCupIdx

    // Execute swaps sequentially (chained promises)
    let chain = Promise.resolve();
    swapSequence.forEach(function(pair) {
      chain = chain.then(function() {
        csSound.play('shuffle');
        // Update ball tracking
        if (csCupSlots[pair[0]] === /* cup containing ball initially */ null) { /* handled below */ }
        return csAnimateSwap(pair[0], pair[1], cfg.intervalMs);
      });
    });

    // We need to track the ball separately through swaps
    // Re-do tracking: csCupSlots[slot] = cupIdx; ball is in cupIdx=ballCupIdx
    // After each swap, find which slot has ballCupIdx
    chain = Promise.resolve();
    let currentSlots = Array.from({ length: numCups }, (_, i) => i); // slot→cup
    swapSequence.forEach(function(pair) {
      chain = chain.then(function() {
        csSound.play('shuffle');
        const promise = csAnimateSwap(pair[0], pair[1], cfg.intervalMs);
        // Track ball slot: after swap, if ball was in pair[0] → now in pair[1], vice versa
        // But csCupSlots is already updated in csAnimateSwap BEFORE resolve
        return promise;
      });
    });

    chain.then(function() {
      // Find which slot now holds the ball cup
      let finalSlot = -1;
      for (let s = 0; s < numCups; s++) {
        if (csCupSlots[s] === ballCupIdx) { finalSlot = s; break; }
      }
      csAnswerSlot = finalSlot;
      // The answer "cup number" is the slot+1 (displayed label stays with slot, not cup)
      // Actually cups display their original number (cup-label), but they MOVE
      // The player needs to pick the SLOT/POSITION number, which equals displayed label of CUP at that slot
      // Cup label is the cup's original index+1, not position.
      // For the game, buttons are labeled 1/2/3/4 = positions left to right
      // After shuffle, answer is: which position (slot) is the ball cup at?
      csAnswerSlot = finalSlot; // 0-indexed slot = answer position

      csPhase = 'answering';
      csProbStatus.textContent = '공이 든 컵 위치를 눌러요!';
      csSetZoneBtnsDisabled(false, numCups);
      csStartRoundTimer();
    });
  }, 1500);
}

function csGenerateSwaps(count, numCups) {
  const swaps = [];
  let lastA = -1, lastB = -1;
  for (let i = 0; i < count; i++) {
    let a, b;
    let attempts = 0;
    do {
      a = Math.floor(Math.random() * numCups);
      b = Math.floor(Math.random() * numCups);
      attempts++;
    } while ((a === b || (a === lastA && b === lastB) || (a === lastB && b === lastA)) && attempts < 20);
    if (a !== b) { swaps.push([a, b]); lastA = a; lastB = b; }
  }
  return swaps;
}

// ── Timer ────────────────────────────────────────────────────
function csStartRoundTimer() {
  csTimeRemaining = ROUND_TIME;
  csProbTimer.textContent = csTimeRemaining;
  csProbTimer.classList.remove('urgent');

  csTimerHandle = setInterval(function() {
    csTimeRemaining--;
    csProbTimer.textContent = csTimeRemaining;
    if (csTimeRemaining <= 3) {
      csProbTimer.classList.add('urgent');
      csSound.play('tick');
    }
    if (csTimeRemaining <= 0) {
      csClearTimers();
      csHandleTimeout();
    }
  }, 1000);
}

// ── Zone buttons ─────────────────────────────────────────────
function csSetZoneBtnsDisabled(disabled, numCups) {
  for (let i = 0; i < csPlayerCount; i++) {
    const grid = document.getElementById(`cs-btns-${i}`);
    if (!grid) continue;
    // Rebuild buttons for the current cup count
    grid.innerHTML = '';
    for (let c = 0; c < numCups; c++) {
      const btn = document.createElement('button');
      btn.className = 'cup-choice-btn' + (disabled ? ' state-disabled' : '');
      btn.disabled = disabled;
      btn.dataset.player = String(i);
      btn.dataset.slot = String(c);
      btn.innerHTML = `<span class="btn-cup-emoji">${CUP_EMOJI}</span><span class="btn-cup-num">${c + 1}번</span>`;
      onTap(btn, function() { csHandleChoiceTap(i, c, btn); });
      grid.appendChild(btn);
    }
  }
}

function csHandleChoiceTap(playerIdx, slotChosen, btn) {
  if (csPhase !== 'answering') return;
  if (csDqSet.has(playerIdx)) return;

  if (slotChosen === csAnswerSlot) {
    csResolveRound(playerIdx);
  } else {
    csSound.play('buzz');
    btn.classList.add('state-wrong');

    csDqSet.add(playerIdx);
    const zone = csGetZone(playerIdx);
    const flash = document.createElement('div');
    flash.className = 'penalty-flash';
    flash.textContent = '실격!';
    zone.appendChild(flash);
    flash.addEventListener('animationend', function() { flash.remove(); });

    csDisablePlayerBtns(playerIdx);
    zone.classList.add('dq-zone');

    // Check if all dq'd
    let anyActive = false;
    for (let i = 0; i < csPlayerCount; i++) {
      if (!csDqSet.has(i)) { anyActive = true; break; }
    }
    if (!anyActive) {
      csClearTimers();
      csNextHandle = setTimeout(csHandleTimeout, 300);
    }
  }
}

function csResolveRound(winnerIdx) {
  csPhase = 'done';
  csClearTimers();
  csSound.play('ding');

  csScores[winnerIdx]++;
  csUpdateScoreChip(winnerIdx);
  csUpdateBarScore(winnerIdx);

  // Mark winner button correct
  csMarkAnswerBtns(winnerIdx, 'correct');
  // Disable others
  for (let i = 0; i < csPlayerCount; i++) {
    if (i !== winnerIdx) csDisablePlayerBtns(i);
  }

  // Lift the correct cup to reveal ball
  csRevealBall(csAnswerSlot);

  const wLabel = CS_PLAYER_CONFIG[winnerIdx].label;
  csProbStatus.textContent = `${wLabel} 정답! (${csAnswerSlot + 1}번 컵)`;

  csRoundLog.push({ answerSlot: csAnswerSlot, winnerIdx, dqPlayers: [...csDqSet], timedOut: false });
  csNextHandle = setTimeout(csNextRound, RESULT_PAUSE_MS);
}

function csHandleTimeout() {
  csPhase = 'done';
  csClearTimers();
  csSound.play('timeout');

  csRevealBall(csAnswerSlot);
  // Mark reveal on all zones
  for (let i = 0; i < csPlayerCount; i++) {
    csMarkAnswerBtns(i, 'reveal');
  }
  csProbStatus.textContent = `정답은 ${csAnswerSlot + 1}번 컵!`;

  csRoundLog.push({ answerSlot: csAnswerSlot, winnerIdx: -1, dqPlayers: [...csDqSet], timedOut: true });
  csNextHandle = setTimeout(csNextRound, RESULT_PAUSE_MS);
}

function csRevealBall(slot) {
  // Lift the cup at this slot
  const cupIdx = csCupSlots[slot];
  const el = csGetCupElement(cupIdx);
  if (el) el.classList.add('lifting');
  const ballEl = csBallElement(cupIdx);
  if (ballEl) { ballEl.style.opacity = '1'; }
}

function csMarkAnswerBtns(playerIdx, state) {
  const grid = document.getElementById(`cs-btns-${playerIdx}`);
  if (!grid) return;
  const btns = grid.querySelectorAll('.cup-choice-btn');
  btns.forEach(function(btn) {
    const s = parseInt(btn.dataset.slot, 10);
    if (s === csAnswerSlot) {
      btn.classList.remove('state-disabled');
      if (state === 'correct') btn.classList.add('state-correct');
      else if (state === 'reveal') btn.classList.add('state-reveal');
    } else {
      btn.classList.add('state-disabled');
      btn.disabled = true;
    }
  });
}

function csDisablePlayerBtns(playerIdx) {
  const grid = document.getElementById(`cs-btns-${playerIdx}`);
  if (!grid) return;
  grid.querySelectorAll('.cup-choice-btn').forEach(function(btn) {
    btn.classList.add('state-disabled');
    btn.disabled = true;
  });
}

function csGetZone(idx) {
  return csZonesWrap.querySelector(`.zone[data-player="${idx}"]`);
}

function csUpdateScoreChip(playerIdx) {
  const chip = document.getElementById(`cs-score-chip-${playerIdx}`);
  if (chip) chip.textContent = `${csScores[playerIdx]}점`;
}

function csUpdateBarScore(playerIdx) {
  const el = document.getElementById(`cs-bar-score-${playerIdx}`);
  if (el) el.textContent = csScores[playerIdx];
}

// ── Build zones ───────────────────────────────────────────────
function csBuildZones() {
  csZonesWrap.innerHTML = '';
  csZonesWrap.className = `zones-wrap p${csPlayerCount}`;

  for (let i = 0; i < csPlayerCount; i++) {
    const cfg  = CS_PLAYER_CONFIG[i];
    const zone = document.createElement('div');
    zone.className = `zone ${cfg.cls}`;
    zone.dataset.player = i;

    const header = document.createElement('div');
    header.className = 'zone-header';
    header.innerHTML = `
      <span class="zone-label">${cfg.label}</span>
      <span class="zone-score-chip" id="cs-score-chip-${i}">0점</span>
    `;

    const hint = document.createElement('div');
    hint.className = 'zone-hint';
    hint.textContent = '공 있는 컵 번호 선택!';

    const grid = document.createElement('div');
    grid.className = 'cup-btns';
    grid.id = `cs-btns-${i}`;

    zone.appendChild(header);
    zone.appendChild(hint);
    zone.appendChild(grid);
    csZonesWrap.appendChild(zone);
  }
}

function csBuildScoreBar() {
  csScoreBar.innerHTML = '';
  for (let i = 0; i < csPlayerCount; i++) {
    const cfg  = CS_PLAYER_CONFIG[i];
    const chip = document.createElement('div');
    chip.className = 'score-chip';
    chip.innerHTML = `
      <span class="score-chip-dot" style="background:${cfg.dot}"></span>
      <span>${cfg.label}</span>
      <span class="score-chip-val" id="cs-bar-score-${i}">0</span>
    `;
    csScoreBar.appendChild(chip);
  }
}

// ── Intro illust ──────────────────────────────────────────────
function csRenderIntroIllust() {
  csIntroIllust.innerHTML = `<svg viewBox="0 0 220 130" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="6" width="208" height="118" rx="16" fill="#FFF8E1" stroke="#2C2C2C" stroke-width="3"/>
    <text x="52" y="90" text-anchor="middle" font-size="42">🥤</text>
    <text x="110" y="90" text-anchor="middle" font-size="42">🥤</text>
    <text x="168" y="90" text-anchor="middle" font-size="42">🥤</text>
    <text x="52" y="62" text-anchor="middle" font-size="22">⚽</text>
    <circle cx="52" cy="58" r="18" fill="none" stroke="#FF7043" stroke-width="3" stroke-dasharray="5 3"/>
    <text x="110" y="28" text-anchor="middle" font-size="13" font-weight="900" fill="#FF7043">어디에?</text>
  </svg>`;
}
csRenderIntroIllust();

// ── Player count selection ────────────────────────────────────
document.querySelectorAll('.player-btn').forEach(function(btn) {
  onTap(btn, function() {
    document.querySelectorAll('.player-btn').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    csPlayerCount = parseInt(btn.dataset.count, 10);
  });
});

// ── Sound toggle ──────────────────────────────────────────────
onTap(csSoundToggle, function() {
  csSound.toggleMute();
  csUpdateSoundBtn(csSoundToggle);
});
csUpdateSoundBtn(csSoundToggle);

// ── Navigation ────────────────────────────────────────────────
onTap(csBackBtn,  function() { goHome(); });
onTap(csCloseBtn, function() { csClearTimers(); goHome(); });
onTap(csHomeBtn,  function() { goHome(); });
onTap(csRetryBtn, function() { csStartCountdown(function() { csStartGame(); }); });
onTap(csPlayBtn,  function() { csStartCountdown(function() { csStartGame(); }); });

// ── Start game ────────────────────────────────────────────────
function csStartGame() {
  csRoundIdx    = 0;
  csScores      = new Array(csPlayerCount).fill(0);
  csRoundLog    = [];
  csDqSet       = new Set();
  csPhase       = 'idle';

  csClearTimers();
  csBuildZones();
  csBuildScoreBar();
  csShowScreen(csGameScreen);
  csLoadRound();
}

function csLoadRound() {
  csDqSet = new Set();
  csQCounter.textContent = `${csRoundIdx + 1} / ${TOTAL_ROUNDS}`;
  csProbStatus.textContent = '';
  csProbTimer.classList.remove('urgent');
  csProbTimer.textContent = ROUND_TIME;

  // Remove dq class from all zones
  for (let i = 0; i < csPlayerCount; i++) {
    const zone = csGetZone(i);
    if (zone) zone.classList.remove('dq-zone');
  }

  csRunRound();
}

function csNextRound() {
  csRoundIdx++;
  if (csRoundIdx >= TOTAL_ROUNDS) {
    csShowResult();
  } else {
    csLoadRound();
  }
}

// ── Result ────────────────────────────────────────────────────
function csShowResult() {
  csClearTimers();
  csPhase = 'idle';
  csSound.play('fanfare');

  const maxScore = Math.max(...csScores);
  const winners  = csScores.map(function(s, i) { return { s, i }; }).filter(function(x) { return x.s === maxScore; }).map(function(x) { return x.i; });

  if (maxScore === 0) {
    csResultTitle.textContent  = '무승부!';
    csResultWinner.textContent = '아무도 점수를 얻지 못했어요.';
  } else if (winners.length === 1) {
    const w = winners[0];
    csResultTitle.textContent  = '게임 종료!';
    csResultWinner.textContent = `${CS_PLAYER_CONFIG[w].label} 승리! (${maxScore}점)`;
  } else {
    const labels = winners.map(function(w) { return CS_PLAYER_CONFIG[w].label; }).join(', ');
    csResultTitle.textContent  = '동점!';
    csResultWinner.textContent = `${labels} 공동 1위! (${maxScore}점)`;
  }

  // Table header
  const headRow = document.createElement('tr');
  headRow.innerHTML = '<th>라운드</th>' +
    Array.from({ length: csPlayerCount }, function(_, i) {
      return `<th><span class="player-dot" style="background:${CS_PLAYER_CONFIG[i].dot}"></span>${CS_PLAYER_CONFIG[i].label}</th>`;
    }).join('');
  csResultTHead.innerHTML = '';
  csResultTHead.appendChild(headRow);

  csResultTBody.innerHTML = '';
  csRoundLog.forEach(function(log, idx) {
    const tr = document.createElement('tr');
    let cells = `<td style="text-align:left;font-size:0.82rem;">${idx + 1}. ${CUP_EMOJI} ${log.answerSlot + 1}번 컵</td>`;
    for (let i = 0; i < csPlayerCount; i++) {
      if (log.winnerIdx === i) cells += `<td class="cell-win">+1</td>`;
      else if (log.dqPlayers.includes(i)) cells += `<td class="cell-wrong">실격</td>`;
      else if (log.timedOut) cells += `<td class="cell-timeout">시간초과</td>`;
      else cells += `<td class="cell-none">—</td>`;
    }
    tr.innerHTML = cells;
    csResultTBody.appendChild(tr);
  });

  csTotalRow.innerHTML = '';
  for (let i = 0; i < csPlayerCount; i++) {
    const cfg   = CS_PLAYER_CONFIG[i];
    const isWin = winners.includes(i) && maxScore > 0;
    const chip  = document.createElement('div');
    chip.className = 'total-chip';
    chip.innerHTML = `
      <span class="chip-dot" style="background:${cfg.dot}"></span>
      <span>${cfg.label}</span>
      <span class="chip-score" style="color:${isWin ? '#2E7D32' : '#555'}">${csScores[i]}점</span>
      ${isWin ? '<span style="font-size:1.1rem;">★</span>' : ''}
    `;
    csTotalRow.appendChild(chip);
  }

  csShowScreen(csResultScreen);
}
