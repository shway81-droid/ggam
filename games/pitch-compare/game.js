/* games/pitch-compare/game.js */

'use strict';

// ── Constants ────────────────────────────────────────────────
const TOTAL_ROUNDS    = 8;
const ROUND_TIME      = 10;   // seconds per round (starts after playback)
const RESULT_PAUSE_MS = getAutoplayPauseMs(2000);

// Player config
const PLAYER_CONFIG = [
  { label: 'P1', dot: '#0288D1', cls: 'p1' },
  { label: 'P2', dot: '#E53935', cls: 'p2' },
  { label: 'P3', dot: '#388E3C', cls: 'p3' },
  { label: 'P4', dot: '#F57C00', cls: 'p4' },
];

// Semitone ratio
const SEMITONE = Math.pow(2, 1 / 12);

// Round difficulty plan (semitones apart)
// R1-2: 12 semitones, R3-4: 7, R5-6: 4, R7-8: 2
const SEMITONE_PLAN = [12, 12, 7, 7, 4, 4, 2, 2];

// ── Sound Manager ────────────────────────────────────────────
const sound = createSoundManager({
  beepA(ctx) {
    // placeholder — actual tone playback is done via playToneSequence
  },
  beepB(ctx) {
    // placeholder — actual tone playback is done via playToneSequence
  },
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

// ── Audio context for tone playback ──────────────────────────
let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// ── State ────────────────────────────────────────────────────
let playerCount   = 2;
let roundIdx      = 0;
let scores        = [];
let roundLog      = [];
let currentRound  = null;  // { freqA, freqB, answer: 'A'|'B' }
let dqSet         = new Set();
let phase         = 'idle';
let timerHandle   = null;
let nextHandle    = null;
let timeRemaining = ROUND_TIME;
let gameRounds    = [];
let replayUsed    = false;
let playbackLocked = false;

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
const scoreBar        = document.getElementById('scoreBar');

const cardA           = document.getElementById('cardA');
const cardB           = document.getElementById('cardB');
const replayBtn       = document.getElementById('replayBtn');

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
  countdownInterval = runCountdown(countdownNumber, onDone);
}

function randFloat(min, max) {
  return min + Math.random() * (max - min);
}

function clearTimers() {
  if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
  if (timerHandle) { clearInterval(timerHandle); timerHandle = null; }
  if (nextHandle)  { clearTimeout(nextHandle);   nextHandle  = null; }
}


// ── Tone sequence playback ────────────────────────────────────
function playToneSequence(freqA, freqB, onDone) {
  const ctx = getAudioCtx();
  const now = ctx.currentTime;

  // Play A: 0 to 0.6s
  const oscA = ctx.createOscillator();
  const gainA = ctx.createGain();
  oscA.connect(gainA);
  gainA.connect(ctx.destination);
  oscA.type = 'sine';
  oscA.frequency.setValueAtTime(freqA, now);
  gainA.gain.setValueAtTime(0.4, now);
  gainA.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
  oscA.start(now);
  oscA.stop(now + 0.6);

  // Play B: 0.9s to 1.5s
  const oscB = ctx.createOscillator();
  const gainB = ctx.createGain();
  oscB.connect(gainB);
  gainB.connect(ctx.destination);
  oscB.type = 'sine';
  oscB.frequency.setValueAtTime(freqB, now + 0.9);
  gainB.gain.setValueAtTime(0.4, now + 0.9);
  gainB.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
  oscB.start(now + 0.9);
  oscB.stop(now + 1.5);

  // Visual feedback
  cardA.classList.add('playing');
  cardB.classList.remove('playing');

  setTimeout(function() {
    cardA.classList.remove('playing');
    cardB.classList.add('playing');
  }, 900);

  setTimeout(function() {
    cardB.classList.remove('playing');
    if (onDone) onDone();
  }, 1600);
}

// Lock/unlock choice buttons during playback
function setChoiceBtnsLocked(locked) {
  playbackLocked = locked;
  zonesWrap.querySelectorAll('.choice-btn').forEach(function(btn) {
    if (locked) {
      btn.classList.add('state-disabled');
    } else {
      // Only unlock non-dq players
      var playerIdx = parseInt(btn.closest('.zone').dataset.player, 10);
      if (!dqSet.has(playerIdx)) {
        btn.classList.remove('state-disabled');
      }
    }
  });
}

// ── Round generation ─────────────────────────────────────────
function buildGameRounds() {
  var rounds = [];
  for (var i = 0; i < TOTAL_ROUNDS; i++) {
    var semitones = SEMITONE_PLAN[i];
    // Base freq randomized from 220-440 Hz
    var baseFreq = randFloat(220, 440);
    // Higher = base * SEMITONE^semitones
    var higherFreq = baseFreq * Math.pow(SEMITONE, semitones);
    // Randomly assign A or B as the higher tone
    var aIsHigher = Math.random() < 0.5;
    var freqA, freqB;
    if (aIsHigher) {
      freqA = higherFreq;
      freqB = baseFreq;
    } else {
      freqA = baseFreq;
      freqB = higherFreq;
    }
    rounds.push({
      freqA: freqA,
      freqB: freqB,
      answer: aIsHigher ? 'A' : 'B',
      semitones: semitones,
    });
  }
  return rounds;
}

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

// ── Replay button ─────────────────────────────────────────────
onTap(replayBtn, function() {
  if (phase !== 'active') return;
  if (replayUsed) return;
  if (playbackLocked) return;
  replayUsed = true;
  replayBtn.disabled = true;
  // Pause timer during replay
  clearInterval(timerHandle);
  timerHandle = null;
  setChoiceBtnsLocked(true);
  playToneSequence(currentRound.freqA, currentRound.freqB, function() {
    setChoiceBtnsLocked(false);
    // Resume timer
    startCountdownResume();
  });
});

// ── Build zone grid ──────────────────────────────────────────
function buildZones() {
  zonesWrap.innerHTML = '';
  zonesWrap.className = 'zones-wrap p' + playerCount;

  for (var i = 0; i < playerCount; i++) {
    var cfg  = PLAYER_CONFIG[i];
    var zone = document.createElement('div');
    zone.className = 'zone ' + cfg.cls;
    zone.dataset.player = i;

    // Header
    var header = document.createElement('div');
    header.className = 'zone-header';
    header.innerHTML =
      '<span class="zone-label">' + cfg.label + '</span>' +
      '<span class="zone-score-chip" id="score-chip-' + i + '">0점</span>';

    // Choice buttons
    var btns = document.createElement('div');
    btns.className = 'zone-btns';

    var btnA = document.createElement('button');
    btnA.className = 'choice-btn';
    btnA.dataset.player = String(i);
    btnA.dataset.choice = 'A';
    btnA.textContent = 'A';
    btnA.setAttribute('aria-label', cfg.label + ' A 선택');
    (function(playerIdx, choice) {
      onTap(btnA, function() { handleChoiceTap(playerIdx, choice); });
    })(i, 'A');

    var btnB = document.createElement('button');
    btnB.className = 'choice-btn';
    btnB.dataset.player = String(i);
    btnB.dataset.choice = 'B';
    btnB.textContent = 'B';
    btnB.setAttribute('aria-label', cfg.label + ' B 선택');
    (function(playerIdx, choice) {
      onTap(btnB, function() { handleChoiceTap(playerIdx, choice); });
    })(i, 'B');

    btns.appendChild(btnA);
    btns.appendChild(btnB);

    zone.appendChild(header);
    zone.appendChild(btns);
    zonesWrap.appendChild(zone);
  }
}

function getZone(idx) {
  return zonesWrap.querySelector('.zone[data-player="' + idx + '"]');
}

function getChoiceBtns(playerIdx) {
  var zone = getZone(playerIdx);
  return zone ? Array.from(zone.querySelectorAll('.choice-btn')) : [];
}

function updateScoreChip(playerIdx) {
  var chip = document.getElementById('score-chip-' + playerIdx);
  if (chip) chip.textContent = scores[playerIdx] + '점';
}

// ── Score bar ────────────────────────────────────────────────
function buildScoreBar() {
  scoreBar.innerHTML = '';
  for (var i = 0; i < playerCount; i++) {
    var cfg  = PLAYER_CONFIG[i];
    var chip = document.createElement('div');
    chip.className = 'score-chip';
    chip.innerHTML =
      '<span class="score-chip-dot" style="background:' + cfg.dot + '"></span>' +
      '<span>' + cfg.label + '</span>' +
      '<span class="score-chip-val" id="bar-score-' + i + '">0</span>';
    scoreBar.appendChild(chip);
  }
}

function updateBarScore(playerIdx) {
  var el = document.getElementById('bar-score-' + playerIdx);
  if (el) el.textContent = scores[playerIdx];
}

// ── Reset zone buttons for new round ─────────────────────────
function resetBtnsForRound() {
  for (var i = 0; i < playerCount; i++) {
    getChoiceBtns(i).forEach(function(btn) {
      btn.className = 'choice-btn';
      btn.disabled = false;
      btn.textContent = btn.dataset.choice;
    });
    var zone = getZone(i);
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

function startCountdownResume() {
  // Resume timer from current timeRemaining
  problemTimer.textContent = timeRemaining;
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

// ── Choice tap handler ───────────────────────────────────────
function handleChoiceTap(playerIdx, choice) {
  if (phase !== 'active') return;
  if (dqSet.has(playerIdx)) return;
  if (playbackLocked) return;

  if (choice === currentRound.answer) {
    resolveRound(playerIdx);
  } else {
    // Wrong answer: disqualify for this round
    sound.play('buzz');
    dqSet.add(playerIdx);

    getChoiceBtns(playerIdx).forEach(function(btn) {
      if (btn.dataset.choice === choice) {
        btn.classList.add('state-wrong');
      }
    });

    var zone = getZone(playerIdx);
    var flash = document.createElement('div');
    flash.className = 'penalty-flash';
    flash.textContent = '실격!';
    zone.appendChild(flash);
    flash.addEventListener('animationend', function() { flash.remove(); });

    disablePlayerBtns(playerIdx);
    zone.classList.add('dq-zone');

    // If all players are disqualified, go to timeout
    var anyActive = false;
    for (var i = 0; i < playerCount; i++) {
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

  getChoiceBtns(winnerIdx).forEach(function(btn) {
    if (btn.dataset.choice === currentRound.answer) {
      btn.classList.add('state-correct');
    } else {
      btn.classList.add('state-disabled');
      btn.disabled = true;
    }
  });

  // Disable all other players
  for (var i = 0; i < playerCount; i++) {
    if (i !== winnerIdx) disablePlayerBtns(i);
  }

  roundLog.push({
    answer: currentRound.answer,
    semitones: currentRound.semitones,
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
  for (var i = 0; i < playerCount; i++) {
    getChoiceBtns(i).forEach(function(btn) {
      if (btn.dataset.choice === currentRound.answer) {
        btn.classList.remove('state-disabled');
        btn.classList.add('state-correct');
        btn.disabled = true;
      } else {
        btn.classList.add('state-disabled');
        btn.disabled = true;
      }
    });
    var zone = getZone(i);
    if (zone) zone.classList.remove('dq-zone');
  }

  roundLog.push({
    answer: currentRound.answer,
    semitones: currentRound.semitones,
    winnerIdx: -1,
    dqPlayers: Array.from(dqSet),
    timedOut: true,
  });

  nextHandle = setTimeout(function() { nextRound(); }, RESULT_PAUSE_MS);
}

// ── Load round ───────────────────────────────────────────────
function loadRound() {
  phase        = 'active';
  currentRound = gameRounds[roundIdx];
  dqSet        = new Set();
  replayUsed   = false;

  questionCounter.textContent = (roundIdx + 1) + ' / ' + TOTAL_ROUNDS;
  problemTimer.classList.remove('urgent');

  replayBtn.disabled = false;

  resetBtnsForRound();

  // Lock buttons during initial playback
  setChoiceBtnsLocked(true);

  // Play the tone sequence, then unlock and start timer
  playToneSequence(currentRound.freqA, currentRound.freqB, function() {
    if (phase !== 'active') return;
    setChoiceBtnsLocked(false);
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
  replayUsed  = false;
  playbackLocked = false;

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

  // Clean up card states
  cardA.classList.remove('playing');
  cardB.classList.remove('playing');

  var maxScore = Math.max.apply(null, scores);
  var winners  = scores
    .map(function(s, i) { return { s: s, i: i }; })
    .filter(function(x) { return x.s === maxScore; })
    .map(function(x) { return x.i; });

  if (maxScore === 0) {
    resultTitle.textContent  = '무승부!';
    resultWinner.textContent = '아무도 점수를 얻지 못했어요.';
  } else if (winners.length === 1) {
    var w = winners[0];
    resultTitle.textContent  = '게임 종료!';
    resultWinner.textContent = PLAYER_CONFIG[w].label + ' 승리! (' + maxScore + '점)';
  } else {
    var labels = winners.map(function(w) { return PLAYER_CONFIG[w].label; }).join(', ');
    resultTitle.textContent  = '동점!';
    resultWinner.textContent = labels + ' 공동 1위! (' + maxScore + '점)';
  }

  // Build table header
  var headRow = document.createElement('tr');
  var headHTML = '<th>라운드</th>';
  for (var i = 0; i < playerCount; i++) {
    headHTML += '<th><span class="player-dot" style="background:' + PLAYER_CONFIG[i].dot + '"></span>' + PLAYER_CONFIG[i].label + '</th>';
  }
  headRow.innerHTML = headHTML;
  resultTableHead.innerHTML = '';
  resultTableHead.appendChild(headRow);

  // Build table body
  resultTableBody.innerHTML = '';
  roundLog.forEach(function(log, idx) {
    var tr = document.createElement('tr');
    var diffLabel = log.semitones + '반음';
    var answerLabel = log.answer + '가 높음';
    var cells = '<td style="text-align:left;font-size:0.82rem;">' +
      (idx + 1) + '. <span class="cell-round-emoji">🎵</span>' + diffLabel + ' · ' + answerLabel +
      '</td>';

    for (var i = 0; i < playerCount; i++) {
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
  for (var i = 0; i < playerCount; i++) {
    var cfg   = PLAYER_CONFIG[i];
    var isWin = winners.includes(i) && maxScore > 0;
    var chip  = document.createElement('div');
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
