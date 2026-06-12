/* games/flag-updown/game.js */
'use strict';

// ── Constants ────────────────────────────────────────────────
const TOTAL_ROUNDS = 12;
const RESULT_PAUSE_MS = getAutoplayPauseMs(2000);

const PLAYER_CONFIG = [
  { label: 'P1', hex: '#0288D1' },
  { label: 'P2', hex: '#E53935' },
  { label: 'P3', hex: '#388E3C' },
  { label: 'P4', hex: '#F57C00' },
];

// Time limits per question range
function getTimeLimit(qIdx) {
  if (qIdx < 4)  return 3000;
  if (qIdx < 8)  return 2500;
  return 1500;
}

// ── Sound Manager ────────────────────────────────────────────
const sound = createSoundManager({
  command(ctx) {
    // Short beep when command is shown
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    gain.gain.setValueAtTime(0.35, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
  },

  ding(ctx) {
    // Correct — ascending 3-note
    [523, 659, 784].forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      const t = ctx.currentTime + i * 0.1;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  },

  buzz(ctx) {
    // Wrong — sawtooth descend
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.35);
  },

  timeout(ctx) {
    // Timeout beep
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(330, ctx.currentTime);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  },

  tick(ctx) {
    // Metronome tick
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'square';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.07);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.07);
  },

  fanfare(ctx) {
    // Victory fanfare
    [392, 523, 659, 784].forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'triangle';
      const t = ctx.currentTime + i * 0.13;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      osc.start(t);
      osc.stop(t + 0.4);
    });
  },
});

// ── Command definitions ──────────────────────────────────────
// Command types and their effect on flag state
const CMD_TYPES = {
  BLUE_UP:            { text: '청기 들어!',          apply: (s) => ({ blue: 'up',   white: s.white }) },
  BLUE_DOWN:          { text: '청기 내려!',          apply: (s) => ({ blue: 'down', white: s.white }) },
  WHITE_UP:           { text: '백기 들어!',          apply: (s) => ({ blue: s.blue, white: 'up'   }) },
  WHITE_DOWN:         { text: '백기 내려!',          apply: (s) => ({ blue: s.blue, white: 'down' }) },
  BOTH_UP:            { text: '둘 다 들어!',         apply: ()  => ({ blue: 'up',   white: 'up'   }) },
  BOTH_DOWN:          { text: '둘 다 내려!',         apply: ()  => ({ blue: 'down', white: 'down' }) },
  BLUE_UP_WHITE_DOWN: { text: '청기 들어, 백기 내려!', apply: () => ({ blue: 'up',   white: 'down' }) },
  WHITE_UP_BLUE_DOWN: { text: '백기 들어, 청기 내려!', apply: () => ({ blue: 'down', white: 'up'   }) },
  BLUE_ONLY_UP:       { text: '청기만 들어!',        apply: ()  => ({ blue: 'up',   white: 'down' }) },
  WHITE_ONLY_UP:      { text: '백기만 들어!',        apply: ()  => ({ blue: 'down', white: 'up'   }) },
  KEEP_BLUE:          { text: '청기 내리지 마!',     apply: (s) => ({ blue: s.blue, white: s.white }) },
  KEEP_WHITE:         { text: '백기 내리지 마!',     apply: (s) => ({ blue: s.blue, white: s.white }) },
};

// Simple commands (questions 1-4)
const SIMPLE_CMDS = ['BLUE_UP', 'BLUE_DOWN', 'WHITE_UP', 'WHITE_DOWN'];
// Compound commands (questions 5-8)
const COMPOUND_CMDS = ['BOTH_UP', 'BOTH_DOWN', 'BLUE_UP_WHITE_DOWN', 'WHITE_UP_BLUE_DOWN', 'BLUE_ONLY_UP', 'WHITE_ONLY_UP'];
// Tricky commands including negations (questions 9-12)
const TRICKY_CMDS = ['KEEP_BLUE', 'KEEP_WHITE', 'BLUE_UP_WHITE_DOWN', 'WHITE_UP_BLUE_DOWN'];

function pickCommandForQuestion(qIdx) {
  if (qIdx < 4) {
    return SIMPLE_CMDS[Math.floor(Math.random() * SIMPLE_CMDS.length)];
  } else if (qIdx < 8) {
    return COMPOUND_CMDS[Math.floor(Math.random() * COMPOUND_CMDS.length)];
  } else {
    return TRICKY_CMDS[Math.floor(Math.random() * TRICKY_CMDS.length)];
  }
}

// ── State ────────────────────────────────────────────────────
let playerCount = 2;
let scores      = [];          // points per player
let playerStates = [];         // current flag states per player: { blue, white }
let questionResults = [];      // array of { cmdKey, cmdText, results: [{correct}] }
let currentQuestion = 0;
let currentCmdKey   = '';
let stateAtQuestionStart = []; // snapshot before player toggles

let questionTimer   = null;    // setTimeout handle
let tickInterval    = null;    // setInterval for timer ticks
let questionActive  = false;
let timerMs         = 0;
let timerEndAt      = 0;
let timerDisplay    = null;

// ── DOM references ───────────────────────────────────────────
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

const questionCounter = document.getElementById('questionCounter');
const problemTimer    = document.getElementById('problemTimer');
const commandDisplay  = document.getElementById('commandDisplay');
const zonesWrap       = document.getElementById('zonesWrap');
const scoreBar        = document.getElementById('scoreBar');

const resultTitle     = document.getElementById('resultTitle');
const resultWinner    = document.getElementById('resultWinner');
const resultTableHead = document.getElementById('resultTableHead');
const resultTableBody = document.getElementById('resultTableBody');
const totalRow        = document.getElementById('totalRow');

// ── Screen helpers ───────────────────────────────────────────
function showScreen(el) {
  [introScreen, countdownScreen, gameScreen, resultScreen].forEach(s => {
    s.classList.remove('active');
  });
  el.classList.add('active');
}

// ── Player select ────────────────────────────────────────────
document.querySelectorAll('.player-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.player-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    playerCount = parseInt(btn.dataset.count, 10);
  });
});

// ── Back / Close / Retry / Home ──────────────────────────────
backBtn.addEventListener('click', () => { goHome(); });
closeBtn.addEventListener('click', () => { clearAllTimers(); goHome(); });
retryBtn.addEventListener('click', () => { startGame(); });
homeBtn.addEventListener('click',  () => { goHome(); });

// ── Play button ──────────────────────────────────────────────
playBtn.addEventListener('click', () => {
  startGame();
});

// ── Start game ───────────────────────────────────────────────
function startGame() {
  // Init state
  scores        = Array(playerCount).fill(0);
  playerStates  = Array.from({ length: playerCount }, () => ({ blue: 'down', white: 'down' }));
  questionResults = [];
  currentQuestion = 0;

  buildZones();
  buildScoreBar();
  showScreen(countdownScreen);
  runCountdown();
}

// ── Countdown ────────────────────────────────────────────────
function runCountdown() {
  let count = 3;
  countdownNumber.textContent = count;

  const iv = setInterval(() => {
    count--;
    if (count <= 0) {
      clearInterval(iv);
      showScreen(gameScreen);
      startQuestion();
    } else {
      countdownNumber.textContent = count;
    }
  }, 800);
}

// ── Build zones ──────────────────────────────────────────────
function buildZones() {
  zonesWrap.innerHTML = '';
  zonesWrap.className = 'zones-wrap p' + playerCount;

  for (let i = 0; i < playerCount; i++) {
    const cfg = PLAYER_CONFIG[i];
    const zone = document.createElement('div');
    zone.className = 'zone';
    zone.id = 'zone-' + i;
    zone.style.background = cfg.hex + '22';
    zone.style.borderRight = i < playerCount - 1 ? '2px solid rgba(0,0,0,0.15)' : '';

    zone.innerHTML = `
      <div class="zone-header">
        <span class="zone-label" style="color:${cfg.hex}">${cfg.label}</span>
        <span class="zone-score-chip" style="background:${cfg.hex};color:#fff">0</span>
      </div>
      <div class="flag-buttons">
        <button class="flag-btn blue-btn flag-down" id="zone${i}-blue" data-player="${i}" data-flag="blue">
          <span class="flag-icon">🔵</span><span class="flag-arrow">⬇</span>
        </button>
        <button class="flag-btn white-btn flag-down" id="zone${i}-white" data-player="${i}" data-flag="white">
          <span class="flag-icon">⚪</span><span class="flag-arrow">⬇</span>
        </button>
      </div>
    `;

    zonesWrap.appendChild(zone);
  }

  // Attach toggle listeners
  for (let i = 0; i < playerCount; i++) {
    const blueBtn  = document.getElementById('zone' + i + '-blue');
    const whiteBtn = document.getElementById('zone' + i + '-white');
    blueBtn.addEventListener('click',  () => toggleFlag(i, 'blue'));
    whiteBtn.addEventListener('click', () => toggleFlag(i, 'white'));
  }
}

// ── Build score bar ──────────────────────────────────────────
function buildScoreBar() {
  scoreBar.innerHTML = '';
  for (let i = 0; i < playerCount; i++) {
    const cfg = PLAYER_CONFIG[i];
    const chip = document.createElement('div');
    chip.className = 'score-chip';
    chip.innerHTML = `
      <span class="score-chip-dot" style="background:${cfg.hex}"></span>
      <span style="color:#fff;font-weight:700;font-size:0.85rem">${cfg.label}</span>
      <span class="score-chip-val" id="score-chip-${i}" style="color:#fff">0</span>
    `;
    scoreBar.appendChild(chip);
  }
}

// ── Toggle flag ──────────────────────────────────────────────
function toggleFlag(playerIdx, flag) {
  if (!questionActive) return;

  const state = playerStates[playerIdx];
  state[flag] = state[flag] === 'up' ? 'down' : 'up';
  updateFlagBtn(playerIdx, flag);
}

function updateFlagBtn(playerIdx, flag) {
  const btn = document.getElementById('zone' + playerIdx + '-' + flag);
  if (!btn) return;
  const isUp = playerStates[playerIdx][flag] === 'up';

  btn.classList.toggle('flag-up', isUp);
  btn.classList.toggle('flag-down', !isUp);

  const arrow = btn.querySelector('.flag-arrow');
  if (arrow) arrow.textContent = isUp ? '⬆' : '⬇';
}

function refreshAllFlags() {
  for (let i = 0; i < playerCount; i++) {
    updateFlagBtn(i, 'blue');
    updateFlagBtn(i, 'white');
    // Clear feedback classes
    const blueBtn  = document.getElementById('zone' + i + '-blue');
    const whiteBtn = document.getElementById('zone' + i + '-white');
    if (blueBtn)  { blueBtn.classList.remove('state-correct', 'state-wrong'); }
    if (whiteBtn) { whiteBtn.classList.remove('state-correct', 'state-wrong'); }
  }
}

// ── Start question ───────────────────────────────────────────
function startQuestion() {
  clearAllTimers();

  questionCounter.textContent = (currentQuestion + 1) + ' / ' + TOTAL_ROUNDS;

  // Snapshot current state before this question
  stateAtQuestionStart = playerStates.map(s => ({ blue: s.blue, white: s.white }));

  // Pick command
  currentCmdKey = pickCommandForQuestion(currentQuestion);
  const cmd = CMD_TYPES[currentCmdKey];

  // Show command
  commandDisplay.textContent = cmd.text;
  commandDisplay.classList.remove('show');
  void commandDisplay.offsetWidth; // reflow to restart animation
  commandDisplay.classList.add('show');
  sound.play('command');

  questionActive = true;
  refreshAllFlags();

  // Remove any zone flashes
  for (let i = 0; i < playerCount; i++) {
    const zone = document.getElementById('zone-' + i);
    if (zone) zone.classList.remove('correct-flash', 'wrong-flash');
  }

  // Start countdown timer
  timerMs   = getTimeLimit(currentQuestion);
  timerEndAt = Date.now() + timerMs;
  updateTimerDisplay(timerMs);

  tickInterval = setInterval(() => {
    const remaining = timerEndAt - Date.now();
    if (remaining <= 0) {
      clearAllTimers();
      resolveQuestion();
    } else {
      updateTimerDisplay(remaining);
      if (remaining <= 1500) {
        sound.play('tick');
      }
    }
  }, 100);

  questionTimer = setTimeout(() => {
    clearAllTimers();
    resolveQuestion();
  }, timerMs + 50);
}

function updateTimerDisplay(msLeft) {
  const secs = Math.max(0, msLeft / 1000).toFixed(1);
  problemTimer.textContent = secs + 's';
}

// ── Resolve question ─────────────────────────────────────────
function resolveQuestion() {
  questionActive = false;
  clearAllTimers();
  sound.play('timeout');

  const cmd = CMD_TYPES[currentCmdKey];
  const results = [];
  let anyCorrect = false;

  for (let i = 0; i < playerCount; i++) {
    const expected = cmd.apply(stateAtQuestionStart[i]);
    const actual   = playerStates[i];
    const correct  = actual.blue === expected.blue && actual.white === expected.white;
    results.push({ correct });

    if (correct) {
      scores[i]++;
      anyCorrect = true;
    }

    // Update zone flash
    const zone = document.getElementById('zone-' + i);
    if (zone) {
      zone.classList.remove('correct-flash', 'wrong-flash');
      void zone.offsetWidth;
      zone.classList.add(correct ? 'correct-flash' : 'wrong-flash');
    }

    // Update flag button feedback
    showFlagFeedback(i, expected);

    // Update score chip
    const chip = document.getElementById('score-chip-' + i);
    if (chip) chip.textContent = scores[i];
  }

  // Play sound based on majority outcome
  if (anyCorrect) {
    sound.play('ding');
  } else {
    sound.play('buzz');
  }

  // Update score chip display in zone header
  for (let i = 0; i < playerCount; i++) {
    const zone = document.getElementById('zone-' + i);
    if (zone) {
      const chip = zone.querySelector('.zone-score-chip');
      if (chip) chip.textContent = scores[i];
    }
  }

  // Record result
  questionResults.push({
    cmdKey:  currentCmdKey,
    cmdText: cmd.text,
    results,
  });

  // Next question or end
  setTimeout(() => {
    currentQuestion++;
    if (currentQuestion >= TOTAL_ROUNDS) {
      showResult();
    } else {
      startQuestion();
    }
  }, RESULT_PAUSE_MS);
}

function showFlagFeedback(playerIdx, expected) {
  const blueBtn  = document.getElementById('zone' + playerIdx + '-blue');
  const whiteBtn = document.getElementById('zone' + playerIdx + '-white');
  if (!blueBtn || !whiteBtn) return;

  const actual = playerStates[playerIdx];

  blueBtn.classList.remove('state-correct', 'state-wrong');
  whiteBtn.classList.remove('state-correct', 'state-wrong');

  blueBtn.classList.add(actual.blue  === expected.blue  ? 'state-correct' : 'state-wrong');
  whiteBtn.classList.add(actual.white === expected.white ? 'state-correct' : 'state-wrong');
}

// ── Clear timers ─────────────────────────────────────────────
function clearAllTimers() {
  if (questionTimer) { clearTimeout(questionTimer);  questionTimer = null; }
  if (tickInterval)  { clearInterval(tickInterval);  tickInterval  = null; }
}

// ── Result screen ────────────────────────────────────────────
function showResult() {
  sound.play('fanfare');

  const maxScore = Math.max(...scores);
  const winners  = scores.reduce((acc, s, i) => { if (s === maxScore) acc.push(i); return acc; }, []);

  if (winners.length === 1) {
    const cfg = PLAYER_CONFIG[winners[0]];
    resultTitle.textContent  = '🏆 게임 종료!';
    resultWinner.innerHTML   = `<span style="color:${cfg.hex}">${cfg.label}</span> 최종 우승! 🎉`;
  } else {
    resultTitle.textContent  = '🤝 게임 종료!';
    resultWinner.innerHTML   = `공동 우승: ${winners.map(i => `<span style="color:${PLAYER_CONFIG[i].hex}">${PLAYER_CONFIG[i].label}</span>`).join(', ')} 🎉`;
  }

  const players = Array.from({ length: playerCount }, (_, i) => PLAYER_CONFIG[i]);

  resultTableHead.innerHTML = `
    <tr>
      <th>문항</th>
      <th>명령</th>
      ${players.map(p => `<th><span class="player-dot" style="background:${p.hex}"></span>${p.label}</th>`).join('')}
    </tr>
  `;

  resultTableBody.innerHTML = questionResults.map((r, qi) => {
    const cells = players.map((_, pi) => {
      const res = r.results[pi];
      if (res.correct) return `<td class="cell-win">✓</td>`;
      return `<td class="cell-wrong">✗</td>`;
    }).join('');
    return `<tr><td>${qi + 1}</td><td class="round-cmd">${r.cmdText}</td>${cells}</tr>`;
  }).join('');

  totalRow.innerHTML = players.map((p, i) => `
    <div class="total-chip">
      <span class="chip-dot" style="background:${p.hex}"></span>
      <span>${p.label}</span>
      <span class="chip-score">${scores[i]}점</span>
    </div>
  `).join('');

  showScreen(resultScreen);
}
