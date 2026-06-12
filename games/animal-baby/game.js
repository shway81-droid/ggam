/* games/animal-baby/game.js */

'use strict';

// ── Constants ────────────────────────────────────────────────
const TOTAL_QUESTIONS = 10;
const QUESTION_TIME   = 10;   // seconds per round
const RESULT_PAUSE_MS = getAutoplayPauseMs(2000);

// Player config
const PLAYER_CONFIG = [
  { label: 'P1', dot: '#0288D1', zoneBg: '#B3E5FC', cls: 'p1' },
  { label: 'P2', dot: '#E53935', zoneBg: '#FFCDD2', cls: 'p2' },
  { label: 'P3', dot: '#388E3C', zoneBg: '#C8E6C9', cls: 'p3' },
  { label: 'P4', dot: '#F57C00', zoneBg: '#FFE0B2', cls: 'p4' },
];

// ── Animal Data ──────────────────────────────────────────────
const ANIMAL_DATA = [
  { parent: '개',    parentEmoji: '🐕', baby: '강아지',    babyEmoji: '🐶' },
  { parent: '소',    parentEmoji: '🐄', baby: '송아지',    babyEmoji: '🐮' },
  { parent: '말',    parentEmoji: '🐎', baby: '망아지',    babyEmoji: '🐴' },
  { parent: '닭',    parentEmoji: '🐓', baby: '병아리',    babyEmoji: '🐣' },
  { parent: '고양이', parentEmoji: '🐈', baby: '새끼고양이', babyEmoji: '🐱' },
  { parent: '돼지',  parentEmoji: '🐖', baby: '새끼돼지',  babyEmoji: '🐷' },
  { parent: '오리',  parentEmoji: '🦆', baby: '새끼오리',  babyEmoji: '🐥' },
  { parent: '개구리', parentEmoji: '🐸', baby: '올챙이',    babyEmoji: '🐸' },
  { parent: '나비',  parentEmoji: '🦋', baby: '애벌레',    babyEmoji: '🐛' },
  { parent: '토끼',  parentEmoji: '🐰', baby: '새끼토끼',  babyEmoji: '🐇' },
  { parent: '사자',  parentEmoji: '🦁', baby: '새끼사자',  babyEmoji: '🦁' },
  { parent: '코끼리', parentEmoji: '🐘', baby: '새끼코끼리', babyEmoji: '🐘' },
  { parent: '곰',    parentEmoji: '🐻', baby: '새끼곰',    babyEmoji: '🐻' },
  { parent: '양',    parentEmoji: '🐑', baby: '새끼양',    babyEmoji: '🐑' },
];

// ── Question generation ──────────────────────────────────────
// Build a pool of forward + reverse questions
function buildAllQuestions() {
  var pool = [];
  ANIMAL_DATA.forEach(function(a) {
    // Forward: show parent → choose baby
    pool.push({
      type: 'forward',
      questionText: '이 동물의 아기는?',
      showEmoji: a.parentEmoji,
      showName: a.parent,
      correct: a.baby,
      correctEmoji: a.babyEmoji,
      answerPool: ANIMAL_DATA.map(function(x) { return x.baby; }),
    });
    // Reverse: show baby → choose parent
    pool.push({
      type: 'reverse',
      questionText: '이 동물의 엄마는?',
      showEmoji: a.babyEmoji,
      showName: a.baby,
      correct: a.parent,
      correctEmoji: a.parentEmoji,
      answerPool: ANIMAL_DATA.map(function(x) { return x.parent; }),
    });
  });
  return pool;
}

// Pick 3 wrong answers (unique, different from correct)
function pickWrongAnswers(correct, answerPool) {
  var candidates = answerPool.filter(function(x) { return x !== correct; });
  // Remove duplicates
  var unique = [];
  candidates.forEach(function(x) {
    if (unique.indexOf(x) === -1) unique.push(x);
  });
  shuffle(unique);
  return unique.slice(0, 3);
}

// Build the 4 choices for a question
function buildChoices(q) {
  var wrongs = pickWrongAnswers(q.correct, q.answerPool);
  var choices = [q.correct].concat(wrongs);
  return shuffle(choices);
}

// ── Sound Manager ────────────────────────────────────────────
const sound = createSoundManager({
  ding: function(ctx) {
    [523, 659, 784].forEach(function(freq, i) {
      var osc  = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      var t = ctx.currentTime + i * 0.09;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
      osc.start(t);
      osc.stop(t + 0.32);
    });
  },

  buzz: function(ctx) {
    var osc  = ctx.createOscillator();
    var gain = ctx.createGain();
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

  timeout: function(ctx) {
    var osc  = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160, ctx.currentTime);
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  },

  tick: function(ctx) {
    var osc  = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'square';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.08);
  },

  fanfare: function(ctx) {
    [392, 494, 523, 659, 784].forEach(function(freq, i) {
      var osc  = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'triangle';
      var t = ctx.currentTime + i * 0.12;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
      osc.start(t);
      osc.stop(t + 0.38);
    });
  },
});

// ── State ────────────────────────────────────────────────────
var playerCount   = 2;
var questionIdx   = 0;
var scores        = [];
var questionLog   = [];
var currentQ      = null;   // { type, questionText, showEmoji, showName, correct, choices[] }
var dqSet         = new Set();
var phase         = 'idle'; // 'idle' | 'active' | 'done'
var timerHandle   = null;
var nextHandle    = null;
var timeRemaining = QUESTION_TIME;
var gameQuestions = [];
var countdownInterval = null;

// ── DOM refs ─────────────────────────────────────────────────
var introScreen     = document.getElementById('introScreen');
var countdownScreen = document.getElementById('countdownScreen');
var countdownNumber = document.getElementById('countdownNumber');
var gameScreen      = document.getElementById('gameScreen');
var resultScreen    = document.getElementById('resultScreen');

var backBtn  = document.getElementById('backBtn');
var playBtn  = document.getElementById('playBtn');
var closeBtn = document.getElementById('closeBtn');
var retryBtn = document.getElementById('retryBtn');
var homeBtn  = document.getElementById('homeBtn');

var zonesWrap       = document.getElementById('zonesWrap');
var questionCounter = document.getElementById('questionCounter');
var problemTimer    = document.getElementById('problemTimer');
var questionTextEl  = document.getElementById('questionText');
var animalEmojiEl   = document.getElementById('animalEmoji');
var animalNameEl    = document.getElementById('animalName');
var problemStatus   = document.getElementById('problemStatus');
var scoreBar        = document.getElementById('scoreBar');

var soundToggleIntro = document.getElementById('soundToggleIntro');

var resultTitle     = document.getElementById('resultTitle');
var resultWinner    = document.getElementById('resultWinner');
var resultTableHead = document.getElementById('resultTableHead');
var resultTableBody = document.getElementById('resultTableBody');
var totalRow        = document.getElementById('totalRow');

// ── Helpers ──────────────────────────────────────────────────
function showScreen(s) {
  [introScreen, countdownScreen, gameScreen, resultScreen].forEach(function(x) {
    x.classList.remove('active');
  });
  s.classList.add('active');
}

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
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
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

// ── Player count selection ───────────────────────────────────
document.querySelectorAll('.player-btn').forEach(function(btn) {
  onTap(btn, function() {
    document.querySelectorAll('.player-btn').forEach(function(b) {
      b.classList.remove('active');
    });
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

// ── Build zone grid ──────────────────────────────────────────
function buildZones() {
  zonesWrap.innerHTML = '';
  zonesWrap.className = 'zones-wrap p' + playerCount;

  for (var i = 0; i < playerCount; i++) {
    var cfg  = PLAYER_CONFIG[i];
    var zone = document.createElement('div');
    zone.className = 'zone ' + cfg.cls;
    zone.dataset.player = i;
    zone.style.background = cfg.zoneBg;

    // Header
    var header = document.createElement('div');
    header.className = 'zone-header';
    header.innerHTML =
      '<span class="zone-label">' + cfg.label + '</span>' +
      '<span class="zone-score-chip" id="score-chip-' + i + '">0점</span>';

    // 4-choice grid
    var grid = document.createElement('div');
    grid.className = 'choice-grid';

    for (var slot = 0; slot < 4; slot++) {
      var btn = document.createElement('button');
      btn.className = 'choice-btn';
      btn.dataset.player = i;
      btn.dataset.slot = slot;
      btn.setAttribute('aria-label', 'P' + (i + 1) + ' 보기 ' + (slot + 1));
      (function(playerIdx, b) {
        onTap(b, function() { handleAnswerTap(playerIdx, b); });
      })(i, btn);
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
  return zonesWrap.querySelectorAll('.choice-btn[data-player="' + playerIdx + '"]');
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

// ── Ripple effect ────────────────────────────────────────────
function spawnRipple(zone, e) {
  var rect  = zone.getBoundingClientRect();
  var touch = e && e.touches ? e.touches[0] : (e || null);
  var x     = touch && touch.clientX ? touch.clientX - rect.left : rect.width  / 2;
  var y     = touch && touch.clientY ? touch.clientY - rect.top  : rect.height / 2;
  var size  = Math.max(rect.width, rect.height);
  var r     = document.createElement('span');
  r.className = 'zone-ripple';
  r.style.left   = x + 'px';
  r.style.top    = y + 'px';
  r.style.width  = r.style.height = size + 'px';
  r.style.marginLeft = r.style.marginTop = '-' + (size / 2) + 'px';
  zone.appendChild(r);
  r.addEventListener('animationend', function() { r.remove(); });
}

// ── Timer logic ──────────────────────────────────────────────
function startCountdown() {
  timeRemaining = QUESTION_TIME;
  problemTimer.textContent = timeRemaining;
  problemTimer.classList.remove('urgent');

  timerHandle = setInterval(function() {
    timeRemaining--;
    problemTimer.textContent = timeRemaining;

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

// ── Reset buttons for current round ──────────────────────────
function resetBtnsForRound() {
  for (var i = 0; i < playerCount; i++) {
    var btns = getChoiceBtns(i);
    btns.forEach(function(btn, slot) {
      btn.className = 'choice-btn';
      btn.disabled = false;
      btn.textContent = currentQ.choices[slot];
    });
    var zone = getZone(i);
    if (zone) zone.classList.remove('dq-zone');
  }
}

// ── Answer tap handler ───────────────────────────────────────
function handleAnswerTap(playerIdx, btn) {
  if (phase !== 'active') return;
  if (dqSet.has(playerIdx)) return;

  var zone = getZone(playerIdx);
  spawnRipple(zone, window.event || null);

  var slot = parseInt(btn.dataset.slot, 10);
  var chosen = currentQ.choices[slot];

  if (chosen === currentQ.correct) {
    resolveQuestion(playerIdx, btn);
  } else {
    // Wrong answer — DQ for this round
    sound.play('buzz');
    btn.classList.add('state-wrong');
    setTimeout(function() { btn.classList.remove('state-wrong'); }, 400);

    dqSet.add(playerIdx);

    // Penalty flash
    var penalty = document.createElement('div');
    penalty.className = 'penalty-flash';
    penalty.textContent = '❌';
    zone.appendChild(penalty);
    penalty.addEventListener('animationend', function() { penalty.remove(); });

    // Disable all buttons for this player
    getChoiceBtns(playerIdx).forEach(function(b) {
      b.classList.add('state-disabled');
      b.disabled = true;
    });
    zone.classList.add('dq-zone');

    // Check if all players are DQ'd
    var activePlayers = 0;
    for (var i = 0; i < playerCount; i++) {
      if (!dqSet.has(i)) activePlayers++;
    }
    if (activePlayers === 0) {
      clearTimers();
      setTimeout(function() { handleTimeout(); }, 300);
    }
  }
}

// ── Correct answer ───────────────────────────────────────────
function resolveQuestion(winnerIdx, winBtn) {
  phase = 'done';
  clearTimers();

  sound.play('ding');

  scores[winnerIdx]++;
  updateScoreChip(winnerIdx);
  updateBarScore(winnerIdx);

  // Highlight winner's correct button, disable others
  getChoiceBtns(winnerIdx).forEach(function(btn) {
    if (btn === winBtn) btn.classList.add('state-correct');
    else                btn.classList.add('state-disabled');
    btn.disabled = true;
  });

  // Disable other players
  for (var i = 0; i < playerCount; i++) {
    if (i !== winnerIdx) {
      getChoiceBtns(i).forEach(function(b) {
        b.classList.add('state-disabled');
        b.disabled = true;
      });
    }
  }

  problemStatus.textContent = '✅ ' + PLAYER_CONFIG[winnerIdx].label + ' 정답!';

  questionLog.push({
    showName: currentQ.showName,
    correct: currentQ.correct,
    winnerIdx: winnerIdx,
    dqPlayers: Array.from(dqSet),
    timedOut: false,
  });

  nextHandle = setTimeout(function() { nextQuestion(); }, RESULT_PAUSE_MS);
}

// ── Timeout ──────────────────────────────────────────────────
function handleTimeout() {
  phase = 'done';
  clearTimers();

  sound.play('timeout');

  // Reveal correct answer for all zones
  for (var i = 0; i < playerCount; i++) {
    getChoiceBtns(i).forEach(function(btn) {
      var slot = parseInt(btn.dataset.slot, 10);
      if (currentQ.choices[slot] === currentQ.correct) {
        btn.classList.add('state-reveal');
      } else {
        btn.classList.add('state-disabled');
      }
      btn.disabled = true;
    });
    getZone(i).classList.remove('dq-zone');
  }

  problemStatus.textContent = '⏰ 시간 초과! 정답: ' + currentQ.correct;

  questionLog.push({
    showName: currentQ.showName,
    correct: currentQ.correct,
    winnerIdx: -1,
    dqPlayers: Array.from(dqSet),
    timedOut: true,
  });

  nextHandle = setTimeout(function() { nextQuestion(); }, RESULT_PAUSE_MS);
}

// ── Load question ────────────────────────────────────────────
function loadQuestion() {
  phase         = 'active';
  currentQ      = gameQuestions[questionIdx];
  dqSet         = new Set();

  questionCounter.textContent = (questionIdx + 1) + ' / ' + TOTAL_QUESTIONS;
  questionTextEl.textContent  = currentQ.questionText;
  animalEmojiEl.textContent   = currentQ.showEmoji;
  animalNameEl.textContent    = currentQ.showName;
  problemStatus.textContent   = '';
  problemTimer.classList.remove('urgent');

  resetBtnsForRound();
  startCountdown();
}

// ── Next question ────────────────────────────────────────────
function nextQuestion() {
  questionIdx++;
  if (questionIdx >= TOTAL_QUESTIONS) {
    showResult();
  } else {
    loadQuestion();
  }
}

// ── Start game ───────────────────────────────────────────────
function startGame() {
  var allQ = buildAllQuestions();
  var shuffled = shuffle(allQ);
  // Take TOTAL_QUESTIONS from shuffled pool, attach choices
  gameQuestions = shuffled.slice(0, TOTAL_QUESTIONS).map(function(q) {
    return Object.assign({}, q, { choices: buildChoices(q) });
  });

  questionIdx = 0;
  scores      = new Array(playerCount).fill(0);
  questionLog = [];
  dqSet       = new Set();
  phase       = 'idle';

  clearTimers();
  buildZones();
  buildScoreBar();

  showScreen(gameScreen);
  loadQuestion();
}

// ── Show result ──────────────────────────────────────────────
function showResult() {
  clearTimers();
  phase = 'idle';

  sound.play('fanfare');

  var maxScore = Math.max.apply(null, scores);
  var winners  = scores
    .map(function(s, i) { return { s: s, i: i }; })
    .filter(function(x) { return x.s === maxScore; })
    .map(function(x) { return x.i; });

  if (maxScore === 0) {
    resultTitle.textContent  = '😅 무승부!';
    resultWinner.textContent = '아무도 점수를 얻지 못했어요.';
  } else if (winners.length === 1) {
    var w = winners[0];
    resultTitle.textContent  = '🏆 게임 종료!';
    resultWinner.textContent = PLAYER_CONFIG[w].label + ' 승리! (' + maxScore + '점)';
  } else {
    var labels = winners.map(function(w) { return PLAYER_CONFIG[w].label; }).join(', ');
    resultTitle.textContent  = '🤝 동점!';
    resultWinner.textContent = labels + ' 공동 1위! (' + maxScore + '점)';
  }

  // Table header
  var headRow = document.createElement('tr');
  var headHtml = '<th>문제</th>';
  for (var pi = 0; pi < playerCount; pi++) {
    headHtml += '<th><span class="player-dot" style="background:' + PLAYER_CONFIG[pi].dot + '"></span>' + PLAYER_CONFIG[pi].label + '</th>';
  }
  headRow.innerHTML = headHtml;
  resultTableHead.innerHTML = '';
  resultTableHead.appendChild(headRow);

  // Table body
  resultTableBody.innerHTML = '';
  questionLog.forEach(function(log, idx) {
    var tr = document.createElement('tr');
    var qDisplay = log.showName.length > 8 ? log.showName.slice(0, 7) + '…' : log.showName;
    var cells = '<td style="text-align:left;font-size:0.78rem;">' + (idx + 1) + '. ' + escapeHtml(qDisplay) +
      '<br><span style="font-size:0.7rem;color:#888;">정답: ' + escapeHtml(log.correct) + '</span></td>';

    for (var i = 0; i < playerCount; i++) {
      if (log.winnerIdx === i) {
        cells += '<td class="cell-win">✅ +1</td>';
      } else if (log.dqPlayers.indexOf(i) !== -1) {
        cells += '<td class="cell-wrong">❌</td>';
      } else if (log.timedOut) {
        cells += '<td class="cell-timeout">⏰</td>';
      } else {
        cells += '<td class="cell-none">—</td>';
      }
    }
    tr.innerHTML = cells;
    resultTableBody.appendChild(tr);
  });

  // Total chips
  totalRow.innerHTML = '';
  for (var ti = 0; ti < playerCount; ti++) {
    var cfg   = PLAYER_CONFIG[ti];
    var isWin = winners.indexOf(ti) !== -1 && maxScore > 0;
    var chip  = document.createElement('div');
    chip.className = 'total-chip';
    chip.innerHTML =
      '<span class="chip-dot" style="background:' + cfg.dot + '"></span>' +
      '<span>' + cfg.label + '</span>' +
      '<span class="chip-score" style="color:' + (isWin ? '#2E7D32' : '#555') + '">' + scores[ti] + '점</span>' +
      (isWin ? '<span>🏆</span>' : '');
    totalRow.appendChild(chip);
  }

  showScreen(resultScreen);
}

// ── escapeHtml ───────────────────────────────────────────────
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
