/* games/sign-quiz/game.js */

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

// ── Sign Library (12 signs, hardcoded) ──────────────────────
const SIGN_LIBRARY = [
  {
    id: 'pedestrian-crossing',
    name: '횡단보도',
    tier: 1,
    meaning: '횡단보도',
    svgBody: `<rect x="10" y="10" width="80" height="80" rx="5" fill="#1565C0" stroke="#2C2C2C" stroke-width="3"/>
              <text x="50" y="62" text-anchor="middle" font-size="38" font-family="sans-serif">🚶</text>`,
    wrongs: ['자전거 전용', '보행자 통행금지', '손 씻기']
  },
  {
    id: 'children-protection',
    name: '어린이 보호구역',
    tier: 1,
    meaning: '어린이 보호구역',
    svgBody: `<polygon points="50,12 92,88 8,88" fill="#FDD835" stroke="#2C2C2C" stroke-width="3"/>
              <text x="50" y="78" text-anchor="middle" font-size="32" font-family="sans-serif">👧</text>`,
    wrongs: ['미끄럼 주의', '공사 중', '낙석 주의']
  },
  {
    id: 'no-entry',
    name: '진입 금지',
    tier: 1,
    meaning: '진입 금지',
    svgBody: `<circle cx="50" cy="50" r="40" fill="#C62828" stroke="#2C2C2C" stroke-width="3"/>
              <rect x="16" y="42" width="68" height="16" rx="4" fill="white"/>`,
    wrongs: ['주차 금지', '쓰레기 금지', '화기 엄금']
  },
  {
    id: 'bicycle-only',
    name: '자전거 전용',
    tier: 1,
    meaning: '자전거 전용',
    svgBody: `<circle cx="50" cy="50" r="40" fill="#1565C0" stroke="#2C2C2C" stroke-width="3"/>
              <text x="50" y="64" text-anchor="middle" font-size="34" font-family="sans-serif">🚲</text>`,
    wrongs: ['오토바이 전용', '횡단보도', '손 씻기']
  },
  {
    id: 'no-parking',
    name: '주차 금지',
    tier: 2,
    meaning: '주차 금지',
    svgBody: `<circle cx="50" cy="50" r="40" fill="white" stroke="#C62828" stroke-width="5"/>
              <text x="50" y="64" text-anchor="middle" font-size="34" font-weight="900" fill="#C62828" font-family="sans-serif">P</text>
              <line x1="22" y1="22" x2="78" y2="78" stroke="#C62828" stroke-width="5"/>`,
    wrongs: ['진입 금지', '화기 엄금', '쓰레기 금지']
  },
  {
    id: 'slippery',
    name: '미끄럼 주의',
    tier: 2,
    meaning: '미끄럼 주의',
    svgBody: `<polygon points="50,12 92,88 8,88" fill="#FDD835" stroke="#2C2C2C" stroke-width="3"/>
              <path d="M28,60 Q35,50 42,60 Q49,70 56,60 Q63,50 70,60" stroke="#2C2C2C" stroke-width="3" fill="none"/>
              <path d="M28,72 Q35,62 42,72 Q49,82 56,72 Q63,62 70,72" stroke="#2C2C2C" stroke-width="3" fill="none"/>`,
    wrongs: ['공사 중', '어린이 보호구역', '낙석 주의']
  },
  {
    id: 'no-fire',
    name: '화기 엄금',
    tier: 2,
    meaning: '화기 엄금',
    svgBody: `<circle cx="50" cy="50" r="40" fill="white" stroke="#C62828" stroke-width="5"/>
              <text x="50" y="62" text-anchor="middle" font-size="28" font-family="sans-serif">🔥</text>
              <line x1="22" y1="22" x2="78" y2="78" stroke="#C62828" stroke-width="5"/>`,
    wrongs: ['진입 금지', '주차 금지', '쓰레기 금지']
  },
  {
    id: 'emergency-exit',
    name: '비상구',
    tier: 2,
    meaning: '비상구',
    svgBody: `<rect x="10" y="10" width="80" height="80" rx="5" fill="#2E7D32" stroke="#2C2C2C" stroke-width="3"/>
              <text x="50" y="62" text-anchor="middle" font-size="38" font-family="sans-serif">🏃</text>`,
    wrongs: ['횡단보도', '자전거 전용', '손 씻기']
  },
  {
    id: 'stop',
    name: '멈춤',
    tier: 2,
    meaning: '멈춤 (STOP)',
    svgBody: `<polygon points="30,10 70,10 90,30 90,70 70,90 30,90 10,70 10,30" fill="#C62828" stroke="#2C2C2C" stroke-width="3"/>
              <text x="50" y="44" text-anchor="middle" font-size="13" font-weight="900" fill="white" font-family="sans-serif">STOP</text>
              <text x="50" y="64" text-anchor="middle" font-size="13" font-weight="900" fill="white" font-family="sans-serif">멈춤</text>`,
    wrongs: ['진입 금지', '주차 금지', '화기 엄금']
  },
  {
    id: 'construction',
    name: '공사 중',
    tier: 3,
    meaning: '공사 중',
    svgBody: `<polygon points="50,12 92,88 8,88" fill="#FDD835" stroke="#2C2C2C" stroke-width="3"/>
              <text x="50" y="78" text-anchor="middle" font-size="30" font-family="sans-serif">⛏️</text>`,
    wrongs: ['어린이 보호구역', '미끄럼 주의', '낙석 주의']
  },
  {
    id: 'wash-hands',
    name: '손 씻기',
    tier: 3,
    meaning: '손 씻기',
    svgBody: `<circle cx="50" cy="50" r="40" fill="#1565C0" stroke="#2C2C2C" stroke-width="3"/>
              <text x="50" y="64" text-anchor="middle" font-size="34" font-family="sans-serif">🙌</text>`,
    wrongs: ['자전거 전용', '횡단보도', '비상구']
  },
  {
    id: 'no-trash',
    name: '쓰레기 금지',
    tier: 3,
    meaning: '쓰레기 투기 금지',
    svgBody: `<circle cx="50" cy="50" r="40" fill="white" stroke="#C62828" stroke-width="5"/>
              <text x="50" y="62" text-anchor="middle" font-size="28" font-family="sans-serif">🗑️</text>
              <line x1="22" y1="22" x2="78" y2="78" stroke="#C62828" stroke-width="5"/>`,
    wrongs: ['화기 엄금', '진입 금지', '주차 금지']
  },
];

// ── Sound Manager ────────────────────────────────────────────
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

// ── State ────────────────────────────────────────────────────
let playerCount   = 2;
let roundIdx      = 0;
let scores        = [];
let roundLog      = [];   // { signName, meaning, choices[], winnerIdx, dqPlayers[], timedOut }
let currentSign   = null; // sign object from SIGN_LIBRARY
let currentChoices = [];  // shuffled 4 options for this round (all zones share same order)
let dqSet         = new Set();
let phase         = 'idle'; // 'idle' | 'active' | 'done'
let timerHandle   = null;
let nextHandle    = null;
let timeRemaining = ROUND_TIME;
let gameRounds    = [];   // 10 selected sign objects

// ── DOM refs ─────────────────────────────────────────────────
const introScreen     = document.getElementById('introScreen');
const countdownScreen = document.getElementById('countdownScreen');
const countdownNumber = document.getElementById('countdownNumber');
const gameScreen      = document.getElementById('gameScreen');
const resultScreen    = document.getElementById('resultScreen');

const backBtn  = document.getElementById('backBtn');
const playBtn  = document.getElementById('playBtn');
const closeBtn = document.getElementById('closeBtn');
const retryBtn = document.getElementById('retryBtn');
const homeBtn  = document.getElementById('homeBtn');

const zonesWrap       = document.getElementById('zonesWrap');
const questionCounter = document.getElementById('questionCounter');
const problemTimer    = document.getElementById('problemTimer');
const signDisplay     = document.getElementById('signDisplay');
const problemStatus   = document.getElementById('problemStatus');
const scoreBar        = document.getElementById('scoreBar');

const soundToggleIntro = document.getElementById('soundToggleIntro');

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
      countdownNumber.offsetHeight; // reflow
      countdownNumber.style.animation = '';
    }
  }, 1000);
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
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

// ── Round generation ─────────────────────────────────────────
// Rounds 1-5: pick 5 signs from tier ≤ 2 (tier 1 & 2 mixed)
// Rounds 6-10: pick 5 signs from tier ≥ 2 (tier 2 & 3 mixed)
// No duplicates overall; shuffle each group independently.
function buildGameRounds() {
  const tier12 = SIGN_LIBRARY.filter(s => s.tier <= 2);
  const tier23 = SIGN_LIBRARY.filter(s => s.tier >= 2);

  const shuffled12 = shuffle(tier12);
  const shuffled23 = shuffle(tier23);

  // Pick 5 from each group, avoiding duplicates in the combined set
  const usedIds = new Set();
  const group1 = [];
  for (let i = 0; i < shuffled12.length && group1.length < 5; i++) {
    if (!usedIds.has(shuffled12[i].id)) {
      usedIds.add(shuffled12[i].id);
      group1.push(shuffled12[i]);
    }
  }
  const group2 = [];
  for (let i = 0; i < shuffled23.length && group2.length < 5; i++) {
    if (!usedIds.has(shuffled23[i].id)) {
      usedIds.add(shuffled23[i].id);
      group2.push(shuffled23[i]);
    }
  }

  return group1.concat(group2);
}

// Build 4 choices for a round: [sign.meaning, ...sign.wrongs] shuffled
function buildChoices(sign) {
  return shuffle([sign.meaning, sign.wrongs[0], sign.wrongs[1], sign.wrongs[2]]);
}

// ── Sign display ─────────────────────────────────────────────
function renderSign(sign) {
  signDisplay.innerHTML = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">${sign.svgBody}</svg>`;
}

// ── Player count selection ───────────────────────────────────
document.querySelectorAll('.player-btn').forEach(function(btn) {
  onTap(btn, function() {
    document.querySelectorAll('.player-btn').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    playerCount = parseInt(btn.dataset.count, 10);
  });
});

// ── Sound toggle ─────────────────────────────────────────────
onTap(soundToggleIntro, function() {
  sound.toggleMute();
  updateSoundBtn(soundToggleIntro);
});
updateSoundBtn(soundToggleIntro);

// ── Navigation ───────────────────────────────────────────────
onTap(backBtn,  function() { goHome(); });
onTap(closeBtn, function() { clearTimers(); goHome(); });
onTap(homeBtn,  function() { goHome(); });
onTap(retryBtn, function() { startPreGameCountdown(function() { startGame(); }); });
onTap(playBtn,  function() { startPreGameCountdown(function() { startGame(); }); });

// ── Build zones ──────────────────────────────────────────────
function buildZones() {
  zonesWrap.innerHTML = '';
  zonesWrap.className = 'zones-wrap p' + playerCount;

  for (let i = 0; i < playerCount; i++) {
    const cfg  = PLAYER_CONFIG[i];
    const zone = document.createElement('div');
    zone.className = 'zone ' + cfg.cls;
    zone.dataset.player = String(i);
    zone.style.background = cfg.zoneBg;

    // Header
    const header = document.createElement('div');
    header.className = 'zone-header';
    header.innerHTML =
      '<span class="zone-label">' + cfg.label + '</span>' +
      '<span class="zone-score-chip" id="score-chip-' + i + '">0점</span>';

    // 4-choice grid
    const grid = document.createElement('div');
    grid.className = 'choice-grid';
    grid.id = 'choice-grid-' + i;

    for (let slot = 0; slot < 4; slot++) {
      const btn = document.createElement('button');
      btn.className = 'choice-btn';
      btn.dataset.player = String(i);
      btn.dataset.slot = String(slot);
      btn.setAttribute('aria-label', cfg.label + ' 보기 ' + (slot + 1));
      (function(pi, b) {
        onTap(b, function() { handleChoiceTap(pi, b); });
      }(i, btn));
      grid.appendChild(btn);
    }

    zone.appendChild(header);
    zone.appendChild(grid);
    zonesWrap.appendChild(zone);
  }
}

function getZone(idx) {
  return zonesWrap.querySelector('.zone[data-player="' + idx + '"]');
}

function getChoiceBtns(playerIdx) {
  const grid = document.getElementById('choice-grid-' + playerIdx);
  return grid ? Array.from(grid.querySelectorAll('.choice-btn')) : [];
}

function updateScoreChip(playerIdx) {
  const chip = document.getElementById('score-chip-' + playerIdx);
  if (chip) chip.textContent = scores[playerIdx] + '점';
}

// ── Score bar ────────────────────────────────────────────────
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

// ── Reset buttons for new round ──────────────────────────────
function resetBtnsForRound() {
  for (let i = 0; i < playerCount; i++) {
    const btns = getChoiceBtns(i);
    btns.forEach(function(btn, slot) {
      btn.className = 'choice-btn';
      btn.disabled = false;
      btn.textContent = currentChoices[slot] || '';
    });
    const zone = getZone(i);
    if (zone) zone.classList.remove('dq-zone');
  }
}

function disablePlayerBtns(playerIdx) {
  getChoiceBtns(playerIdx).forEach(function(b) {
    b.classList.add('state-disabled');
    b.disabled = true;
  });
}

// ── Timer logic ──────────────────────────────────────────────
function startCountdown() {
  timeRemaining = ROUND_TIME;
  problemTimer.textContent = String(timeRemaining);
  problemTimer.classList.remove('urgent');

  timerHandle = setInterval(function() {
    timeRemaining--;
    problemTimer.textContent = String(timeRemaining);

    if (timeRemaining <= 3 && timeRemaining > 0) {
      problemTimer.classList.add('urgent');
      sound.play('tick');
    }

    if (timeRemaining <= 0) {
      clearTimers();
      handleTimeout();
    }
  }, 1000);
}

// ── Choice tap handler ───────────────────────────────────────
function handleChoiceTap(playerIdx, btn) {
  if (phase !== 'active') return;
  if (dqSet.has(playerIdx)) return;

  const slot = parseInt(btn.dataset.slot, 10);
  const chosen = currentChoices[slot];

  if (chosen === currentSign.meaning) {
    // Correct answer
    resolveRound(playerIdx);
  } else {
    // Wrong answer: disqualify this player for the round
    sound.play('buzz');
    btn.classList.add('state-wrong');
    setTimeout(function() { btn.classList.remove('state-wrong'); }, 400);

    dqSet.add(playerIdx);

    const zone = getZone(playerIdx);
    const flash = document.createElement('div');
    flash.className = 'penalty-flash';
    flash.textContent = '실격!';
    zone.appendChild(flash);
    flash.addEventListener('animationend', function() { flash.remove(); });

    disablePlayerBtns(playerIdx);
    zone.classList.add('dq-zone');

    // If all players disqualified, end round
    let anyActive = false;
    for (let i = 0; i < playerCount; i++) {
      if (!dqSet.has(i)) { anyActive = true; break; }
    }
    if (!anyActive) {
      clearTimers();
      nextHandle = setTimeout(function() { handleTimeout(); }, 300);
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

  // Highlight correct button for winner; disable others in winner zone
  getChoiceBtns(winnerIdx).forEach(function(btn) {
    const slot = parseInt(btn.dataset.slot, 10);
    if (currentChoices[slot] === currentSign.meaning) {
      btn.classList.add('state-correct');
    } else {
      btn.classList.add('state-disabled');
      btn.disabled = true;
    }
  });

  // Disable all other zones
  for (let i = 0; i < playerCount; i++) {
    if (i !== winnerIdx) disablePlayerBtns(i);
  }

  problemStatus.textContent = PLAYER_CONFIG[winnerIdx].label + ' 정답! (' + currentSign.meaning + ')';

  roundLog.push({
    signName: currentSign.name,
    meaning: currentSign.meaning,
    choices: currentChoices.slice(),
    winnerIdx: winnerIdx,
    dqPlayers: Array.from(dqSet),
    timedOut: false,
  });

  nextHandle = setTimeout(function() { nextRound(); }, RESULT_PAUSE_MS);
}

// ── Timeout (or all disqualified) ────────────────────────────
function handleTimeout() {
  phase = 'done';
  clearTimers();
  sound.play('timeout');

  // Reveal correct answer in all zones
  for (let i = 0; i < playerCount; i++) {
    getChoiceBtns(i).forEach(function(btn) {
      const slot = parseInt(btn.dataset.slot, 10);
      if (currentChoices[slot] === currentSign.meaning) {
        btn.classList.remove('state-disabled');
        btn.classList.add('state-reveal');
        btn.disabled = true;
      } else {
        btn.classList.add('state-disabled');
        btn.disabled = true;
      }
    });
    const zone = getZone(i);
    if (zone) zone.classList.remove('dq-zone');
  }

  problemStatus.textContent = '정답: ' + currentSign.meaning + '!';

  roundLog.push({
    signName: currentSign.name,
    meaning: currentSign.meaning,
    choices: currentChoices.slice(),
    winnerIdx: -1,
    dqPlayers: Array.from(dqSet),
    timedOut: true,
  });

  nextHandle = setTimeout(function() { nextRound(); }, RESULT_PAUSE_MS);
}

// ── Load round ───────────────────────────────────────────────
function loadRound() {
  phase         = 'active';
  currentSign   = gameRounds[roundIdx];
  currentChoices = buildChoices(currentSign);
  dqSet         = new Set();

  questionCounter.textContent = (roundIdx + 1) + ' / ' + TOTAL_ROUNDS;
  problemStatus.textContent   = '';
  problemTimer.classList.remove('urgent');

  renderSign(currentSign);
  resetBtnsForRound();
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
  gameRounds  = buildGameRounds();
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

  const maxScore = Math.max.apply(null, scores);
  const winners  = scores
    .map(function(s, i) { return { s: s, i: i }; })
    .filter(function(x) { return x.s === maxScore; })
    .map(function(x) { return x.i; });

  if (maxScore === 0) {
    resultTitle.textContent  = '무승부!';
    resultWinner.textContent = '아무도 점수를 얻지 못했어요.';
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
  let headHtml = '<th>표지판</th>';
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
    let cells = '<td style="text-align:left;font-size:0.82rem;">' +
      (idx + 1) + '. ' + log.signName +
      '<br><span style="font-size:0.72rem;color:#888;">정답: ' + log.meaning + '</span>' +
      '</td>';

    for (let i = 0; i < playerCount; i++) {
      if (log.winnerIdx === i) {
        cells += '<td class="cell-win">+1</td>';
      } else if (log.dqPlayers.indexOf(i) !== -1) {
        cells += '<td class="cell-wrong">실격</td>';
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
