/* games/emoji-zoom/game.js */

'use strict';

// ── Constants ─────────────────────────────────────────────────
const TOTAL_ROUNDS    = 8;
const ZOOM_DURATION   = 7000;   // ms: 8px → 120px
const RESULT_PAUSE_MS = getAutoplayPauseMs(2000);

// Player config
const PLAYER_CONFIG = [
  { label: 'P1', dot: '#0288D1', cls: 'p1' },
  { label: 'P2', dot: '#E53935', cls: 'p2' },
  { label: 'P3', dot: '#388E3C', cls: 'p3' },
  { label: 'P4', dot: '#F57C00', cls: 'p4' },
];

// ── Question sets ─────────────────────────────────────────────
const QUESTION_SETS = [
  // tier 1: 전혀 다른 종류 (라운드 1~2)
  { tier:1, answer:'🍎', choices:['🍎','🚗','🐶','⭐'] },
  { tier:1, answer:'🚌', choices:['🚌','🌸','🦁','🎸'] },
  { tier:1, answer:'🐸', choices:['🐸','🍕','⚽','🌈'] },
  { tier:1, answer:'🎃', choices:['🎃','🚀','🐬','🌻'] },
  // tier 2: 같은 대분류 (라운드 3~4)
  { tier:2, answer:'🐶', choices:['🐶','🐱','🐰','🐻'] },
  { tier:2, answer:'🦁', choices:['🦁','🐯','🐻','🐼'] },
  { tier:2, answer:'🚗', choices:['🚗','🚌','🚓','🚕'] },
  { tier:2, answer:'🍇', choices:['🍇','🍎','🍊','🍌'] },
  // tier 3: 같은 소분류 (라운드 5~6)
  { tier:3, answer:'🍊', choices:['🍊','🍑','🥭','🍋'] },
  { tier:3, answer:'🌹', choices:['🌹','🌸','🌺','🌷'] },
  { tier:3, answer:'🐢', choices:['🐢','🐊','🦎','🐍'] },
  { tier:3, answer:'🦆', choices:['🦆','🐦','🐤','🐧'] },
  // tier 4: 매우 유사 (라운드 7~8)
  { tier:4, answer:'😀', choices:['😀','😃','😄','😁'] },
  { tier:4, answer:'🙂', choices:['🙂','😊','😇','🙃'] },
  { tier:4, answer:'😆', choices:['😆','😅','😂','🤣'] },
  { tier:4, answer:'🚗', choices:['🚗','🚙','🛻','🚕'] },
];

// 라운드별 tier 계획
const TIER_PLAN = [1,1,2,2,3,3,4,4];

// ── Sound Manager ─────────────────────────────────────────────
const sound = createSoundManager({
  ding(ctx) {
    [523, 659, 784].forEach(function(freq, i) {
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
    [392, 494, 523, 659, 784].forEach(function(freq, i) {
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

// ── State ──────────────────────────────────────────────────────
var playerCount      = 2;
var roundIdx         = 0;
var scores           = [];
var roundLog         = [];
var currentQuestion  = null;   // { answer, shuffledChoices }
var dqSet            = new Set();
var phase            = 'idle'; // 'idle' | 'active' | 'done'
var timerHandle      = null;
var nextHandle       = null;
var zoomStartTime    = 0;
var zoomRafId        = null;
var gameRounds       = [];

// ── DOM refs ──────────────────────────────────────────────────
var introScreen     = document.getElementById('introScreen');
var countdownScreen = document.getElementById('countdownScreen');
var countdownNumber = document.getElementById('countdownNumber');
var gameScreen      = document.getElementById('gameScreen');
var resultScreen    = document.getElementById('resultScreen');

var backBtn         = document.getElementById('backBtn');
var playBtn         = document.getElementById('playBtn');
var closeBtn        = document.getElementById('closeBtn');
var retryBtn        = document.getElementById('retryBtn');
var homeBtn         = document.getElementById('homeBtn');

var zonesWrap       = document.getElementById('zonesWrap');
var questionCounter = document.getElementById('questionCounter');
var problemTimer    = document.getElementById('problemTimer');
var problemStatus   = document.getElementById('problemStatus');
var scoreBar        = document.getElementById('scoreBar');
var zoomPanel       = document.getElementById('zoomPanel');
var zoomEmoji       = document.getElementById('zoomEmoji');

var soundToggleIntro  = document.getElementById('soundToggleIntro');
var introIllust       = document.getElementById('introIllust');

var resultTitle       = document.getElementById('resultTitle');
var resultWinner      = document.getElementById('resultWinner');
var resultTableHead   = document.getElementById('resultTableHead');
var resultTableBody   = document.getElementById('resultTableBody');
var totalRow          = document.getElementById('totalRow');

// ── Helpers ──────────────────────────────────────────────────
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
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

function clearTimers() {
  if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
  if (timerHandle)  { clearInterval(timerHandle);  timerHandle  = null; }
  if (nextHandle)   { clearTimeout(nextHandle);    nextHandle   = null; }
  if (zoomRafId)    { cancelAnimationFrame(zoomRafId); zoomRafId = null; }
}

function updateSoundBtn(btn) {
  btn.textContent = sound.isMuted() ? '🔇' : '🔊';
}

// ── Round generation ──────────────────────────────────────────
function buildGameRounds() {
  var rounds = [];
  var usedSetIdx = new Set();

  TIER_PLAN.forEach(function(tier) {
    var candidates = QUESTION_SETS
      .map(function(s, idx) { return { s: s, idx: idx }; })
      .filter(function(x) { return x.s.tier === tier && !usedSetIdx.has(x.idx); });
    var pool = candidates.length > 0
      ? candidates
      : QUESTION_SETS.map(function(s, idx) { return { s: s, idx: idx }; })
          .filter(function(x) { return x.s.tier === tier; });
    var pick = pool[Math.floor(Math.random() * pool.length)];
    usedSetIdx.add(pick.idx);
    rounds.push(pick.s);
  });

  return rounds;
}

// ── Intro illustration ────────────────────────────────────────
function renderIntroIllust() {
  introIllust.innerHTML = '<svg viewBox="0 0 220 130" xmlns="http://www.w3.org/2000/svg">'
    + '<rect x="6" y="6" width="208" height="118" rx="16" fill="#FFF8E1" stroke="#2C2C2C" stroke-width="3"/>'
    + '<rect x="70" y="20" width="80" height="80" rx="12" fill="#fff" stroke="#2C2C2C" stroke-width="3"/>'
    + '<text x="110" y="52" text-anchor="middle" font-size="10">🔍</text>'
    + '<text x="110" y="80" text-anchor="middle" font-size="30">🍎</text>'
    + '<text x="30" y="75" text-anchor="middle" font-size="13" font-weight="900" fill="#8E24AA">작게</text>'
    + '<text x="185" y="75" text-anchor="middle" font-size="13" font-weight="900" fill="#8E24AA">크게!</text>'
    + '<line x1="50" y1="72" x2="68" y2="72" stroke="#8E24AA" stroke-width="3" marker-end="url(#arr)"/>'
    + '<defs><marker id="arr" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">'
    + '<path d="M0,0 L6,3 L0,6 Z" fill="#8E24AA"/></marker></defs>'
    + '</svg>';
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

// ── Zoom animation ────────────────────────────────────────────
function startZoom() {
  zoomEmoji.style.transition = 'none';
  zoomEmoji.style.fontSize   = '8px';
  // Force reflow so the transition starts from 8px
  void zoomEmoji.offsetWidth;
  zoomEmoji.style.transition = 'font-size ' + (ZOOM_DURATION / 1000) + 's ease-in';
  zoomEmoji.style.fontSize   = '120px';
  zoomStartTime = Date.now();
}

function stopZoom() {
  var elapsed   = Date.now() - zoomStartTime;
  var progress  = Math.min(elapsed / ZOOM_DURATION, 1);
  var currentPx = 8 + (120 - 8) * progress;
  // Freeze at current size
  zoomEmoji.style.transition = 'none';
  zoomEmoji.style.fontSize   = currentPx + 'px';
}

// ── Score calculation ─────────────────────────────────────────
function calcPoints() {
  var elapsed  = Date.now() - zoomStartTime;
  var progress = Math.min(elapsed / ZOOM_DURATION, 1);
  if (progress < 0.33) return 3;
  if (progress < 0.66) return 2;
  return 1;
}

// ── Build zones ───────────────────────────────────────────────
function buildZones() {
  zonesWrap.innerHTML = '';
  zonesWrap.className = 'zones-wrap p' + playerCount;

  for (var i = 0; i < playerCount; i++) {
    var cfg  = PLAYER_CONFIG[i];
    var zone = document.createElement('div');
    zone.className   = 'zone ' + cfg.cls;
    zone.dataset.player = i;

    var header = document.createElement('div');
    header.className = 'zone-header';
    header.innerHTML = '<span class="zone-label">' + cfg.label + '</span>'
      + '<span class="zone-score-chip" id="score-chip-' + i + '">0점</span>';

    var hint = document.createElement('div');
    hint.className   = 'zone-hint';
    hint.textContent = '정답 이모지를 터치!';

    var grid = document.createElement('div');
    grid.className   = 'choice-grid';
    grid.id          = 'choice-grid-' + i;

    // 4 choice buttons (filled in loadRound)
    for (var b = 0; b < 4; b++) {
      var btn = document.createElement('button');
      btn.className  = 'choice-btn';
      btn.dataset.player = String(i);
      btn.dataset.choiceIdx = String(b);
      grid.appendChild(btn);
    }

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
  var grid = document.getElementById('choice-grid-' + playerIdx);
  return grid ? Array.from(grid.querySelectorAll('.choice-btn')) : [];
}

function updateScoreChip(playerIdx) {
  var chip = document.getElementById('score-chip-' + playerIdx);
  if (chip) chip.textContent = scores[playerIdx] + '점';
}

// ── Score bar ─────────────────────────────────────────────────
function buildScoreBar() {
  scoreBar.innerHTML = '';
  for (var i = 0; i < playerCount; i++) {
    var cfg  = PLAYER_CONFIG[i];
    var chip = document.createElement('div');
    chip.className   = 'score-chip';
    chip.innerHTML   = '<span class="score-chip-dot" style="background:' + cfg.dot + '"></span>'
      + '<span>' + cfg.label + '</span>'
      + '<span class="score-chip-val" id="bar-score-' + i + '">0</span>';
    scoreBar.appendChild(chip);
  }
}

function updateBarScore(playerIdx) {
  var el = document.getElementById('bar-score-' + playerIdx);
  if (el) el.textContent = scores[playerIdx];
}

// ── Reset buttons for new round ───────────────────────────────
function resetBtnsForRound() {
  for (var i = 0; i < playerCount; i++) {
    getChoiceBtns(i).forEach(function(btn) {
      btn.className  = 'choice-btn';
      btn.disabled   = false;
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

// ── Fill choice buttons with shuffled choices ─────────────────
function fillChoiceBtns() {
  for (var i = 0; i < playerCount; i++) {
    var btns = getChoiceBtns(i);
    currentQuestion.shuffledChoices.forEach(function(emoji, idx) {
      if (btns[idx]) {
        btns[idx].textContent = emoji;
        btns[idx].dataset.emoji = emoji;
        // Re-bind tap with correct closure
        (function(playerIdx, choiceEmoji, btn) {
          onTap(btn, function() { handleChoiceTap(playerIdx, choiceEmoji, btn); });
        })(i, emoji, btns[idx]);
      }
    });
  }
}

// ── Timer ─────────────────────────────────────────────────────
function startCountdown() {
  var timeRemaining = Math.ceil(ZOOM_DURATION / 1000);
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

// ── Tap handler ───────────────────────────────────────────────
function handleChoiceTap(playerIdx, choiceEmoji, btn) {
  if (phase !== 'active') return;
  if (dqSet.has(playerIdx)) return;

  if (choiceEmoji === currentQuestion.answer) {
    // 정답
    var pts = calcPoints();
    resolveRound(playerIdx, pts, btn);
  } else {
    // 오답: 라운드 실격
    sound.play('buzz');
    btn.classList.add('state-wrong');

    dqSet.add(playerIdx);

    var zone = getZone(playerIdx);
    var flash = document.createElement('div');
    flash.className   = 'penalty-flash';
    flash.textContent = '실격!';
    zone.appendChild(flash);
    flash.addEventListener('animationend', function() { flash.remove(); });

    disablePlayerBtns(playerIdx);
    zone.classList.add('dq-zone');

    // 모두 실격이면 타임아웃 처리
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

// ── Correct answer resolved ───────────────────────────────────
function resolveRound(winnerIdx, pts, winBtn) {
  phase = 'done';
  clearTimers();
  sound.play('ding');
  stopZoom();

  scores[winnerIdx] += pts;
  updateScoreChip(winnerIdx);
  updateBarScore(winnerIdx);

  // 정답 버튼 표시
  if (winBtn) {
    winBtn.classList.add('state-correct');
  }

  // 점수 플래시
  var zone = getZone(winnerIdx);
  var scoreFlash = document.createElement('div');
  scoreFlash.className   = 'score-flash';
  scoreFlash.textContent = '+' + pts + '점';
  zone.appendChild(scoreFlash);
  scoreFlash.addEventListener('animationend', function() { scoreFlash.remove(); });

  // 다른 zone 비활성화
  for (var i = 0; i < playerCount; i++) {
    if (i !== winnerIdx) disablePlayerBtns(i);
  }

  problemStatus.textContent = PLAYER_CONFIG[winnerIdx].label + ' 정답! (' + pts + '점)';

  roundLog.push({
    answer:    currentQuestion.answer,
    winnerIdx: winnerIdx,
    pts:       pts,
    dqPlayers: Array.from(dqSet),
    timedOut:  false,
  });

  nextHandle = setTimeout(function() { nextRound(); }, RESULT_PAUSE_MS);
}

// ── Timeout ───────────────────────────────────────────────────
function handleTimeout() {
  phase = 'done';
  clearTimers();
  sound.play('timeout');
  stopZoom();

  // 정답 버튼 하이라이트
  for (var i = 0; i < playerCount; i++) {
    getChoiceBtns(i).forEach(function(b) {
      if (b.dataset.emoji === currentQuestion.answer) {
        b.classList.remove('state-disabled');
        b.classList.add('state-reveal');
        b.disabled = true;
      } else {
        b.classList.add('state-disabled');
        b.disabled = true;
      }
    });
    var zone = getZone(i);
    if (zone) zone.classList.remove('dq-zone');
  }

  problemStatus.textContent = '정답은 ' + currentQuestion.answer + '!';

  roundLog.push({
    answer:    currentQuestion.answer,
    winnerIdx: -1,
    pts:       0,
    dqPlayers: Array.from(dqSet),
    timedOut:  true,
  });

  nextHandle = setTimeout(function() { nextRound(); }, RESULT_PAUSE_MS);
}

// ── Load round ────────────────────────────────────────────────
function loadRound() {
  phase           = 'active';
  var qSet        = gameRounds[roundIdx];
  dqSet           = new Set();

  currentQuestion = {
    answer:          qSet.answer,
    shuffledChoices: shuffle(qSet.choices),
  };

  questionCounter.textContent = (roundIdx + 1) + ' / ' + TOTAL_ROUNDS;
  problemStatus.textContent   = '';
  problemTimer.classList.remove('urgent');

  // Set zoom emoji
  zoomEmoji.textContent = currentQuestion.answer;

  resetBtnsForRound();
  fillChoiceBtns();
  startZoom();
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
  dqSet       = new Set();
  phase       = 'idle';

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

  // Table header
  var headRow = document.createElement('tr');
  headRow.innerHTML = '<th>라운드</th>'
    + Array.from({ length: playerCount }, function(_, i) {
      return '<th><span class="player-dot" style="background:' + PLAYER_CONFIG[i].dot + '"></span>'
        + PLAYER_CONFIG[i].label + '</th>';
    }).join('');
  resultTableHead.innerHTML = '';
  resultTableHead.appendChild(headRow);

  // Table body
  resultTableBody.innerHTML = '';
  roundLog.forEach(function(log, idx) {
    var tr = document.createElement('tr');
    var cells = '<td style="text-align:left;font-size:0.82rem;">'
      + (idx + 1) + '. ' + log.answer
      + '</td>';

    for (var i = 0; i < playerCount; i++) {
      if (log.winnerIdx === i) {
        cells += '<td class="cell-win">+' + log.pts + '</td>';
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
  for (var i = 0; i < playerCount; i++) {
    var cfg   = PLAYER_CONFIG[i];
    var isWin = winners.indexOf(i) !== -1 && maxScore > 0;
    var chip  = document.createElement('div');
    chip.className = 'total-chip';
    chip.innerHTML = '<span class="chip-dot" style="background:' + cfg.dot + '"></span>'
      + '<span>' + cfg.label + '</span>'
      + '<span class="chip-score" style="color:' + (isWin ? '#2E7D32' : '#555') + '">'
        + scores[i] + '점</span>'
      + (isWin ? '<span style="font-size:1.1rem;">★</span>' : '');
    totalRow.appendChild(chip);
  }

  showScreen(resultScreen);
}
