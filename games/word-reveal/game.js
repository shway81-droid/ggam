/* games/word-reveal/game.js */

'use strict';

// ── Constants ────────────────────────────────────────────────
const TOTAL_ROUNDS    = 8;
const REVEAL_INTERVAL = 1500;  // ms per letter reveal
const TIMEOUT_GRACE   = 3000;  // ms after full reveal before round ends
const RESULT_PAUSE_MS = getAutoplayPauseMs(2000);

// Player config
const PLAYER_CONFIG = [
  { label: 'P1', dot: '#0288D1', zoneBg: '#B3E5FC', cls: 'p1' },
  { label: 'P2', dot: '#E53935', zoneBg: '#FFCDD2', cls: 'p2' },
  { label: 'P3', dot: '#388E3C', zoneBg: '#C8E6C9', cls: 'p3' },
  { label: 'P4', dot: '#F57C00', zoneBg: '#FFE0B2', cls: 'p4' },
];

// ── Word Library ──────────────────────────────────────────────
// { word, alt1, alt2, alt3 } — all same length, similar but different
const WORD_LIBRARY = [
  // 3-char words (rounds 1-3)
  { word: '냉장고', alt1: '냉동고', alt2: '냉각기', alt3: '냉방기' },
  { word: '무지개', alt1: '무지가', alt2: '모지개', alt3: '무지기' },
  { word: '도서관', alt1: '도서실', alt2: '도서판', alt3: '도서원' },
  { word: '고양이', alt1: '고향이', alt2: '고양기', alt3: '고앙이' },
  { word: '강아지', alt1: '강아치', alt2: '강아기', alt3: '갈아지' },
  { word: '호랑이', alt1: '호랑기', alt2: '호랑개', alt3: '호망이' },
  { word: '거북이', alt1: '거복이', alt2: '거불이', alt3: '거부기' },
  { word: '달팽이', alt1: '달팽기', alt2: '달뱅이', alt3: '달팽구' },
  { word: '바나나', alt1: '파나나', alt2: '바나다', alt3: '바나바' },
  { word: '딸기잼', alt1: '딸기챔', alt2: '달기잼', alt3: '딸기잡' },
  // 4-char words (rounds 4-6)
  { word: '해바라기', alt1: '해파라기', alt2: '해바다기', alt3: '해바라구' },
  { word: '도깨비불', alt1: '도깨비굴', alt2: '도까비불', alt3: '도깨비집' },
  { word: '무궁화꽃', alt1: '무궁화봇', alt2: '무궁화잎', alt3: '무궁화풀' },
  { word: '개구리밥', alt1: '개구리발', alt2: '개구리알', alt3: '개구리집' },
  { word: '하늘나라', alt1: '하늘나무', alt2: '하늘다리', alt3: '하늘나비' },
  { word: '사자나라', alt1: '사자가족', alt2: '사자나무', alt3: '사자다리' },
  { word: '장미꽃밭', alt1: '장미꽃빛', alt2: '장미꽃잎', alt3: '장미꽃밖' },
  { word: '코끼리코', alt1: '코끼리귀', alt2: '코끼리발', alt3: '코끼리눈' },
  { word: '팽이버섯', alt1: '팽이장국', alt2: '팽이나물', alt3: '팽이비빔' },
  { word: '두꺼비집', alt1: '두꺼비굴', alt2: '두꺼비방', alt3: '두꺼비등' },
  // 5-char words (rounds 7-8)
  { word: '무지개다리', alt1: '무지개색깔', alt2: '무지개마을', alt3: '무지개구름' },
  { word: '코끼리아기', alt1: '코끼리엄마', alt2: '코끼리가족', alt3: '코끼리마을' },
  { word: '냉장고문짝', alt1: '냉장고손잡', alt2: '냉장고속재', alt3: '냉장고선반' },
  { word: '도서관책상', alt1: '도서관의자', alt2: '도서관창문', alt3: '도서관바닥' },
  { word: '해바라기씨', alt1: '해바라기밭', alt2: '해바라기꽃', alt3: '해바라기잎' },
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

  reveal(ctx) {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.12);
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
let roundLog      = [];   // { word, choices, winnerIdx, pointsAwarded, dqPlayers[], timedOut }
let currentEntry  = null; // { word, alt1, alt2, alt3 }
let currentChoices = [];  // shuffled [word, alt1, alt2, alt3]
let dqSet         = new Set();
let phase         = 'idle'; // 'idle' | 'active' | 'done'

// Reveal state
let revealedCount  = 0;  // how many chars revealed so far
let revealHandle   = null;
let gracePending   = false;
let graceHandle    = null;
let nextHandle     = null;
var countdownInterval = null;

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

const zonesWrap        = document.getElementById('zonesWrap');
const questionCounter  = document.getElementById('questionCounter');
const problemTimer     = document.getElementById('problemTimer');
const wordRevealDisplay = document.getElementById('wordRevealDisplay');
const problemStatus    = document.getElementById('problemStatus');
const scoreBar         = document.getElementById('scoreBar');

const soundToggleIntro = document.getElementById('soundToggleIntro');

const resultTitle     = document.getElementById('resultTitle');
const resultWinner    = document.getElementById('resultWinner');
const resultTableHead = document.getElementById('resultTableHead');
const resultTableBody = document.getElementById('resultTableBody');
const totalRow        = document.getElementById('totalRow');

// ── Helpers ──────────────────────────────────────────────────
function showScreen(s) {
  [introScreen, countdownScreen, gameScreen, resultScreen].forEach(function(x) {
    x.classList.remove('active');
  });
  s.classList.add('active');
}

function startPreGameCountdown(onDone) {
  showScreen(countdownScreen);
  countdownInterval = runCountdown(countdownNumber, onDone);
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
  if (revealHandle)  { clearInterval(revealHandle);  revealHandle  = null; }
  if (graceHandle)   { clearTimeout(graceHandle);    graceHandle   = null; }
  if (nextHandle)    { clearTimeout(nextHandle);     nextHandle    = null; }
}

function updateSoundBtn(btn) {
  btn.textContent = sound.isMuted() ? '🔇' : '🔊';
}

// ── Word difficulty helpers ──────────────────────────────────
function getWordLength(round) {
  // round is 0-indexed
  if (round <= 2) return 3;   // rounds 1-3
  if (round <= 5) return 4;   // rounds 4-6
  return 5;                    // rounds 7-8
}

function getWordsForLength(len) {
  return WORD_LIBRARY.filter(function(e) {
    return e.word.length === len;
  });
}

function buildRoundQueue() {
  // Pick 8 rounds: 3 from 3-char, 3 from 4-char, 2 from 5-char — no repeats
  var threes = shuffle(getWordsForLength(3)).slice(0, 3);
  var fours  = shuffle(getWordsForLength(4)).slice(0, 3);
  var fives  = shuffle(getWordsForLength(5)).slice(0, 2);
  return threes.concat(fours).concat(fives);
}

var roundQueue = [];

// ── Reveal logic ─────────────────────────────────────────────
function renderWordDisplay() {
  var word = currentEntry.word;
  var html = '';
  for (var i = 0; i < word.length; i++) {
    if (i < revealedCount) {
      html += '<span class="reveal-char revealed">' + word[i] + '</span>';
    } else {
      html += '<span class="reveal-char hidden-char">■</span>';
    }
  }
  wordRevealDisplay.innerHTML = html;
}

function getHiddenCount() {
  return currentEntry.word.length - revealedCount;
}

function calcPoints(hiddenCount) {
  if (hiddenCount >= 3) return 3;
  if (hiddenCount === 2) return 2;
  return 1; // 0 or 1 hidden
}

function startRevealTimer() {
  revealedCount = 0;
  gracePending  = false;
  renderWordDisplay();
  problemTimer.textContent = '—';
  problemTimer.classList.remove('urgent');

  revealHandle = setInterval(function() {
    if (phase !== 'active') {
      clearInterval(revealHandle);
      revealHandle = null;
      return;
    }

    revealedCount++;
    sound.play('reveal');
    renderWordDisplay();

    if (revealedCount >= currentEntry.word.length) {
      // All revealed — start grace period
      clearInterval(revealHandle);
      revealHandle  = null;
      gracePending  = true;

      // Show countdown in timer
      var graceLeft = Math.ceil(TIMEOUT_GRACE / 1000);
      problemTimer.textContent = graceLeft;
      problemTimer.classList.add('urgent');

      var graceInterval = setInterval(function() {
        graceLeft--;
        problemTimer.textContent = graceLeft > 0 ? graceLeft : '0';
        if (graceLeft <= 0) {
          clearInterval(graceInterval);
        }
      }, 1000);

      graceHandle = setTimeout(function() {
        clearInterval(graceInterval);
        if (phase === 'active') {
          handleTimeout();
        }
      }, TIMEOUT_GRACE);
    }
  }, REVEAL_INTERVAL);
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

    // Choice grid (4 buttons)
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
  r.style.left      = x + 'px';
  r.style.top       = y + 'px';
  r.style.width     = r.style.height = size + 'px';
  r.style.marginLeft = r.style.marginTop = '-' + (size / 2) + 'px';
  zone.appendChild(r);
  r.addEventListener('animationend', function() { r.remove(); });
}

// ── Reset buttons for round ──────────────────────────────────
function resetBtnsForRound() {
  for (var i = 0; i < playerCount; i++) {
    var btns = getChoiceBtns(i);
    for (var s = 0; s < btns.length; s++) {
      btns[s].className = 'choice-btn';
      btns[s].disabled  = false;
      btns[s].textContent = currentChoices[s];
    }
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

  var slot    = parseInt(btn.dataset.slot, 10);
  var chosen  = currentChoices[slot];
  var correct = currentEntry.word;

  if (chosen === correct) {
    // Correct answer
    var hidden = getHiddenCount();
    var pts    = calcPoints(hidden);
    resolveQuestion(playerIdx, pts);
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

    // Disable all choice buttons for this player
    var btns = getChoiceBtns(playerIdx);
    for (var s = 0; s < btns.length; s++) {
      btns[s].classList.add('state-disabled');
      btns[s].disabled = true;
    }
    zone.classList.add('dq-zone');

    // If all players are DQ'd, end round
    var activePlayers = 0;
    for (var i = 0; i < playerCount; i++) {
      if (!dqSet.has(i)) activePlayers++;
    }
    if (activePlayers === 0) {
      clearTimers();
      var t = setTimeout(function() { handleTimeout(); }, 300);
      // store in nextHandle so clearTimers can cancel
      nextHandle = t;
    }
  }
}

// ── Correct answer handler ───────────────────────────────────
function resolveQuestion(winnerIdx, pts) {
  phase = 'done';
  clearTimers();

  sound.play('ding');

  scores[winnerIdx] += pts;
  updateScoreChip(winnerIdx);
  updateBarScore(winnerIdx);

  // Reveal full word
  revealedCount = currentEntry.word.length;
  renderWordDisplay();

  // Highlight winner's correct button, disable others
  var winBtns = getChoiceBtns(winnerIdx);
  for (var s = 0; s < winBtns.length; s++) {
    if (currentChoices[s] === currentEntry.word) {
      winBtns[s].classList.add('state-correct');
    } else {
      winBtns[s].classList.add('state-disabled');
    }
  }

  // Disable all other players' buttons
  for (var i = 0; i < playerCount; i++) {
    if (i !== winnerIdx) {
      var btns = getChoiceBtns(i);
      for (var s2 = 0; s2 < btns.length; s2++) {
        btns[s2].classList.add('state-disabled');
        btns[s2].disabled = true;
      }
    }
  }

  // Score flash
  var zone = getZone(winnerIdx);
  var flash = document.createElement('div');
  flash.className = 'score-flash';
  flash.textContent = '+' + pts;
  zone.appendChild(flash);
  flash.addEventListener('animationend', function() { flash.remove(); });

  problemStatus.textContent = '✅ ' + PLAYER_CONFIG[winnerIdx].label + ' 정답! (' + pts + '점)';

  roundLog.push({
    word: currentEntry.word,
    choices: currentChoices.slice(),
    winnerIdx: winnerIdx,
    pointsAwarded: pts,
    dqPlayers: Array.from(dqSet),
    timedOut: false,
  });

  nextHandle = setTimeout(function() { nextRound(); }, RESULT_PAUSE_MS);
}

// ── Timeout handler ──────────────────────────────────────────
function handleTimeout() {
  phase = 'done';
  clearTimers();

  sound.play('timeout');

  // Reveal full word
  revealedCount = currentEntry.word.length;
  renderWordDisplay();

  // Show correct answer in all zones
  for (var i = 0; i < playerCount; i++) {
    var btns = getChoiceBtns(i);
    for (var s = 0; s < btns.length; s++) {
      if (currentChoices[s] === currentEntry.word) {
        btns[s].classList.add('state-reveal');
      } else {
        btns[s].classList.add('state-disabled');
      }
      btns[s].disabled = true;
    }
    getZone(i).classList.remove('dq-zone');
  }

  problemStatus.textContent = '⏰ 시간 초과! 정답: ' + currentEntry.word;

  roundLog.push({
    word: currentEntry.word,
    choices: currentChoices.slice(),
    winnerIdx: -1,
    pointsAwarded: 0,
    dqPlayers: Array.from(dqSet),
    timedOut: true,
  });

  nextHandle = setTimeout(function() { nextRound(); }, RESULT_PAUSE_MS);
}

// ── Load round ────────────────────────────────────────────────
function loadRound() {
  phase         = 'active';
  currentEntry  = roundQueue[roundIdx];
  dqSet         = new Set();

  // Build choices: shuffle [word, alt1, alt2, alt3]
  currentChoices = shuffle([
    currentEntry.word,
    currentEntry.alt1,
    currentEntry.alt2,
    currentEntry.alt3,
  ]);

  questionCounter.textContent = (roundIdx + 1) + ' / ' + TOTAL_ROUNDS;
  problemStatus.textContent   = '';

  resetBtnsForRound();
  startRevealTimer();
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
  roundQueue = buildRoundQueue();
  roundIdx   = 0;
  scores     = new Array(playerCount).fill(0);
  roundLog   = [];
  dqSet      = new Set();
  phase      = 'idle';

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

  var maxScore = Math.max.apply(null, scores);
  var winners  = [];
  for (var i = 0; i < playerCount; i++) {
    if (scores[i] === maxScore) winners.push(i);
  }

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
  var headHtml = '<th>단어</th>';
  for (var i = 0; i < playerCount; i++) {
    headHtml += '<th><span class="player-dot" style="background:' +
      PLAYER_CONFIG[i].dot + '"></span>' + PLAYER_CONFIG[i].label + '</th>';
  }
  headRow.innerHTML = headHtml;
  resultTableHead.innerHTML = '';
  resultTableHead.appendChild(headRow);

  // Table body
  resultTableBody.innerHTML = '';
  roundLog.forEach(function(log, idx) {
    var tr = document.createElement('tr');
    var cells = '<td style="text-align:left;font-size:0.85rem;">' +
      (idx + 1) + '. <strong>' + log.word + '</strong></td>';

    for (var i = 0; i < playerCount; i++) {
      if (log.winnerIdx === i) {
        cells += '<td class="cell-win">✅ +' + log.pointsAwarded + '</td>';
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
  for (var i = 0; i < playerCount; i++) {
    var cfg   = PLAYER_CONFIG[i];
    var isWin = winners.indexOf(i) !== -1 && maxScore > 0;
    var chip  = document.createElement('div');
    chip.className = 'total-chip';
    chip.innerHTML =
      '<span class="chip-dot" style="background:' + cfg.dot + '"></span>' +
      '<span>' + cfg.label + '</span>' +
      '<span class="chip-score" style="color:' + (isWin ? '#2E7D32' : '#555') + '">' +
        scores[i] + '점</span>' +
      (isWin ? '<span>🏆</span>' : '');
    totalRow.appendChild(chip);
  }

  showScreen(resultScreen);
}
