/* games/beep-count/game.js */

'use strict';

// ── Constants ────────────────────────────────────────────────
const TOTAL_ROUNDS    = 8;
const ROUND_TIME      = 8;     // seconds after choices appear
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
let playerCount    = 2;
let roundIdx       = 0;
let scores         = [];
let roundLog       = [];    // { count, correctCount, winnerIdx, dqPlayers[], timedOut }
let currentRound   = null;  // { timings, count, choices }
let dqSet          = new Set();
let phase          = 'idle';
let timerHandle    = null;
let nextHandle     = null;
let timeRemaining  = ROUND_TIME;
let gameRounds     = [];    // 8 generated rounds
var countdownInterval = null;

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
const speakerPanel    = document.getElementById('speakerPanel');
const scoreBar        = document.getElementById('scoreBar');

const soundToggleIntro  = document.getElementById('soundToggleIntro');

const resultTitle       = document.getElementById('resultTitle');
const resultWinner      = document.getElementById('resultWinner');
const resultTableHead   = document.getElementById('resultTableHead');
const resultTableBody   = document.getElementById('resultTableBody');
const totalRow          = document.getElementById('totalRow');

// ── Helpers ──────────────────────────────────────────────────
function showScreen(s) {
  [introScreen, countdownScreen, gameScreen, resultScreen].forEach(x => x.classList.remove('active'));
  s.classList.add('active');
}

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


// ── Beep generation ──────────────────────────────────────────
function generateTimings(round) {
  // round 0-7
  let count, baseGap;
  if (round < 2) { count = 3 + Math.floor(Math.random() * 2); baseGap = 0.6; }
  else if (round < 4) { count = 4 + Math.floor(Math.random() * 2); baseGap = 0.5; }
  else if (round < 6) { count = 5 + Math.floor(Math.random() * 3); baseGap = 0.45; }
  else { count = 6 + Math.floor(Math.random() * 4); baseGap = 0.4; }

  const timings = [];
  let t = 0.2;
  for (let i = 0; i < count; i++) {
    timings.push(t);
    // irregular: sometimes rapid pairs
    if (round >= 4 && Math.random() < 0.3) {
      t += 0.25; // rapid
    } else {
      t += baseGap + (Math.random() - 0.5) * 0.15;
    }
  }
  return { timings, count };
}

function generateChoices(correctCount) {
  // 4 options around correct answer (correct ± 1, ±2, ±3)
  // deduplicated, no negatives, shuffled
  const offsets = [-3, -2, -1, 1, 2, 3];
  shuffle(offsets);

  const choices = new Set([correctCount]);
  for (const off of offsets) {
    if (choices.size >= 4) break;
    const val = correctCount + off;
    if (val > 0 && !choices.has(val)) {
      choices.add(val);
    }
  }

  // fallback: add positives if we still need more
  if (choices.size < 4) {
    let extra = correctCount + 4;
    while (choices.size < 4) {
      if (!choices.has(extra) && extra > 0) choices.add(extra);
      extra++;
    }
  }

  // Validate: correct is exactly one of the 4 choices
  const arr = Array.from(choices);
  if (!arr.includes(correctCount)) {
    arr[0] = correctCount;
  }
  // Deduplicate and ensure uniqueness
  const unique = [];
  const seen = new Set();
  for (const v of arr) {
    if (!seen.has(v)) { seen.add(v); unique.push(v); }
  }
  // ensure correct in set
  if (!unique.includes(correctCount)) {
    unique[0] = correctCount;
  }

  return shuffle(unique.slice(0, 4));
}

function buildGameRounds() {
  const rounds = [];
  for (let i = 0; i < TOTAL_ROUNDS; i++) {
    const { timings, count } = generateTimings(i);
    const choices = generateChoices(count);
    rounds.push({ timings, count, choices });
  }
  return rounds;
}

// ── Beep playback via AudioContext ───────────────────────────
function playBeeps(timings, onDone) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();

  timings.forEach(function(t) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime + t);
    gain.gain.setValueAtTime(0.5, ctx.currentTime + t);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.15);
    osc.start(ctx.currentTime + t);
    osc.stop(ctx.currentTime + t + 0.15);
  });

  const totalDuration = timings[timings.length - 1] + 0.3;
  setTimeout(onDone, totalDuration * 1000);
}

// ── Intro illustration ───────────────────────────────────────
function renderIntroIllust() {
  const el = document.getElementById('introIllust');
  if (!el) return;
  el.innerHTML = `<svg viewBox="0 0 220 130" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="6" width="208" height="118" rx="16" fill="#FFF8E1" stroke="#2C2C2C" stroke-width="3"/>
    <text x="110" y="70" text-anchor="middle" font-size="56">👂</text>
    <text x="60" y="50" text-anchor="middle" font-size="22" fill="#F4511E">삑!</text>
    <text x="160" y="90" text-anchor="middle" font-size="22" fill="#F4511E">삑!</text>
    <text x="85" y="95" text-anchor="middle" font-size="22" fill="#F4511E">삑!</text>
  </svg>`;
}
renderIntroIllust();

// ── Player count selection ───────────────────────────────────
setupPlayerSelect(function (n) { playerCount = n; });

// ── Sound toggle ─────────────────────────────────────────────
setupSoundToggle(sound, soundToggleIntro);

// ── Navigation ───────────────────────────────────────────────
onTap(backBtn,  function() { goHome(); });
onTap(closeBtn, function() { clearTimers(); goHome(); });
onTap(homeBtn,  function() { goHome(); });
onTap(retryBtn, function() { startPreGameCountdown(function() { startGame(); }); });
onTap(playBtn,  function() { startPreGameCountdown(function() { startGame(); }); });

// ── Build zone grid ──────────────────────────────────────────
function buildZones() {
  zonesWrap.innerHTML = '';
  zonesWrap.className = 'zones-wrap p' + playerCount;

  for (let i = 0; i < playerCount; i++) {
    const cfg  = PLAYER_CONFIG[i];
    const zone = document.createElement('div');
    zone.className = 'zone ' + cfg.cls;
    zone.dataset.player = i;

    // Header
    const header = document.createElement('div');
    header.className = 'zone-header';
    header.innerHTML =
      '<span class="zone-label">' + cfg.label + '</span>' +
      '<span class="zone-score-chip" id="score-chip-' + i + '">0점</span>';

    // Hint
    const hint = document.createElement('div');
    hint.className = 'zone-hint';
    hint.id = 'zone-hint-' + i;
    hint.textContent = '소리를 들어요!';

    // Choice grid (built per round)
    const grid = document.createElement('div');
    grid.className = 'choice-grid';
    grid.id = 'choice-grid-' + i;

    zone.appendChild(header);
    zone.appendChild(hint);
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
  if (el) el.textContent = scores[playerIdx];
}

// ── Build choices for round ──────────────────────────────────
function buildChoicesForRound(choices) {
  for (let i = 0; i < playerCount; i++) {
    const grid = document.getElementById('choice-grid-' + i);
    if (!grid) continue;
    grid.innerHTML = '';

    choices.forEach(function(val) {
      const btn = document.createElement('button');
      btn.className = 'choice-btn state-disabled';
      btn.textContent = val;
      btn.disabled = true;
      btn.dataset.player = String(i);
      btn.dataset.val = String(val);
      onTap(btn, function() { handleChoiceTap(i, val, btn); });
      grid.appendChild(btn);
    });

    const hint = document.getElementById('zone-hint-' + i);
    if (hint) hint.textContent = '소리를 들어요!';
    const zone = getZone(i);
    if (zone) zone.classList.remove('dq-zone');
  }
}

function enableChoiceBtns() {
  for (let i = 0; i < playerCount; i++) {
    if (dqSet.has(i)) continue;
    getChoiceBtns(i).forEach(function(btn) {
      btn.classList.remove('state-disabled');
      btn.disabled = false;
    });
    const hint = document.getElementById('zone-hint-' + i);
    if (hint) hint.textContent = '개수를 선택!';
  }
}

function disablePlayerBtns(playerIdx) {
  getChoiceBtns(playerIdx).forEach(function(btn) {
    btn.classList.add('state-disabled');
    btn.disabled = true;
  });
}

// ── Speaker panel ─────────────────────────────────────────────
function showSpeakerPlaying() {
  speakerPanel.innerHTML = '<span class="speaker-emoji pulsing" id="speakerEmoji">🔊</span>';
}

function showSpeakerReady() {
  speakerPanel.innerHTML = '<span class="speaker-msg">선택하세요!</span>';
}

// ── Timer logic ──────────────────────────────────────────────
function startCountdown() {
  timeRemaining = ROUND_TIME;
  problemTimer.textContent = timeRemaining;
  problemTimer.classList.remove('urgent');

  timerHandle = setInterval(function() {
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

// ── Choice tap handler ────────────────────────────────────────
function handleChoiceTap(playerIdx, val, btn) {
  if (phase !== 'active') return;
  if (dqSet.has(playerIdx)) return;
  if (btn.disabled || btn.classList.contains('state-disabled')) return;

  const correct = currentRound.count;

  if (val === correct) {
    resolveRound(playerIdx, btn);
  } else {
    // Wrong answer: disqualify for round
    sound.play('buzz');
    btn.classList.remove('state-disabled');
    btn.classList.add('state-wrong');

    dqSet.add(playerIdx);

    const zone = getZone(playerIdx);
    const flash = document.createElement('div');
    flash.className = 'penalty-flash';
    flash.textContent = '실격!';
    zone.appendChild(flash);
    flash.addEventListener('animationend', function() { flash.remove(); });

    disablePlayerBtns(playerIdx);
    zone.classList.add('dq-zone');

    const hint = document.getElementById('zone-hint-' + playerIdx);
    if (hint) hint.textContent = '실격';

    // If all disqualified, proceed to timeout
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
function resolveRound(winnerIdx, winBtn) {
  phase = 'done';
  clearTimers();
  sound.play('ding');

  scores[winnerIdx]++;
  updateScoreChip(winnerIdx);
  updateBarScore(winnerIdx);

  // Mark winner's correct btn
  getChoiceBtns(winnerIdx).forEach(function(btn) {
    const v = parseInt(btn.dataset.val, 10);
    if (v === currentRound.count) {
      btn.classList.remove('state-disabled');
      btn.classList.add('state-correct');
    } else {
      btn.classList.add('state-disabled');
      btn.disabled = true;
    }
  });

  // Disable other players
  for (let i = 0; i < playerCount; i++) {
    if (i !== winnerIdx) disablePlayerBtns(i);
  }

  showSpeakerReady();
  speakerPanel.innerHTML = '<span class="speaker-msg">' + PLAYER_CONFIG[winnerIdx].label + ' 정답! (정답: ' + currentRound.count + '번)</span>';

  roundLog.push({
    count: currentRound.count,
    correctCount: currentRound.count,
    winnerIdx: winnerIdx,
    dqPlayers: Array.from(dqSet),
    timedOut: false,
  });

  nextHandle = setTimeout(function() { nextRound(); }, RESULT_PAUSE_MS);
}

// ── Timeout ──────────────────────────────────────────────────
function handleTimeout() {
  phase = 'done';
  clearTimers();
  sound.play('timeout');

  // Reveal correct answer for everyone
  for (let i = 0; i < playerCount; i++) {
    getChoiceBtns(i).forEach(function(btn) {
      const v = parseInt(btn.dataset.val, 10);
      if (v === currentRound.count) {
        btn.classList.remove('state-disabled');
        btn.classList.add('state-correct');
        btn.disabled = false;
      } else {
        btn.classList.add('state-disabled');
        btn.disabled = true;
      }
    });
    const zone = getZone(i);
    if (zone) zone.classList.remove('dq-zone');
  }

  speakerPanel.innerHTML = '<span class="speaker-msg">시간 초과! (정답: ' + currentRound.count + '번)</span>';

  roundLog.push({
    count: currentRound.count,
    correctCount: currentRound.count,
    winnerIdx: -1,
    dqPlayers: Array.from(dqSet),
    timedOut: true,
  });

  nextHandle = setTimeout(function() { nextRound(); }, RESULT_PAUSE_MS);
}

// ── Load round ───────────────────────────────────────────────
function loadRound() {
  phase        = 'playback';
  currentRound = gameRounds[roundIdx];
  dqSet        = new Set();

  questionCounter.textContent = (roundIdx + 1) + ' / ' + TOTAL_ROUNDS;
  problemTimer.textContent = '—';
  problemTimer.classList.remove('urgent');

  buildChoicesForRound(currentRound.choices);
  showSpeakerPlaying();

  // Play beeps, then enable choices and start timer
  playBeeps(currentRound.timings, function() {
    if (phase !== 'playback') return; // aborted
    phase = 'active';
    showSpeakerReady();
    enableChoiceBtns();
    startCountdown();
  });
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
  let headCells = '<th>라운드</th>';
  for (let i = 0; i < playerCount; i++) {
    headCells += '<th><span class="player-dot" style="background:' + PLAYER_CONFIG[i].dot + '"></span>' + PLAYER_CONFIG[i].label + '</th>';
  }
  headRow.innerHTML = headCells;
  resultTableHead.innerHTML = '';
  resultTableHead.appendChild(headRow);

  // Build table body
  resultTableBody.innerHTML = '';
  roundLog.forEach(function(log, idx) {
    const tr = document.createElement('tr');
    let cells = '<td style="text-align:left;font-size:0.82rem;">' + (idx + 1) + '. 소리 ' + log.count + '번</td>';

    for (let i = 0; i < playerCount; i++) {
      if (log.winnerIdx === i) {
        cells += '<td class="cell-win">+1</td>';
      } else if (log.dqPlayers.includes(i)) {
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
    const isWin = winners.includes(i) && maxScore > 0;
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
