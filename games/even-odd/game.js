/* games/even-odd/game.js */

'use strict';

// ── Constants ────────────────────────────────────────────────
const EO_TOTAL_ROUNDS    = 8;
const EO_RESULT_PAUSE_MS = getAutoplayPauseMs(2000);

// 라운드별 난이도
// phase 1: 한 자리(1-9), 5초
// phase 2: 두 자리(10-99), 4초
// phase 3: 덧셈식 (a+b, 각 1-19), 3초
const EO_ROUND_PLAN = [
  { phase: 1, timeLimit: 5 },
  { phase: 1, timeLimit: 5 },
  { phase: 2, timeLimit: 4 },
  { phase: 2, timeLimit: 4 },
  { phase: 2, timeLimit: 4 },
  { phase: 3, timeLimit: 3 },
  { phase: 3, timeLimit: 3 },
  { phase: 3, timeLimit: 3 },
];

const EO_ITEMS_PER_ROUND = 5;

const EO_PLAYER_CONFIG = [
  { label: 'P1', dot: '#0288D1', cls: 'p1' },
  { label: 'P2', dot: '#E53935', cls: 'p2' },
  { label: 'P3', dot: '#388E3C', cls: 'p3' },
  { label: 'P4', dot: '#F57C00', cls: 'p4' },
];

// ── Sound Manager ────────────────────────────────────────────
const eoSound = createSoundManager({
  ding(ctx) {
    [523, 659, 784].forEach(function(freq, i) {
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
  fanfare(ctx) {
    [392, 494, 523, 659, 784].forEach(function(freq, i) {
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
let eoPlayerCount   = 2;
let eoRoundIdx      = 0;
let eoScores        = [];
let eoRoundLog      = [];
let eoDqSet         = new Set();
let eoPhase         = 'idle';
let eoTimerHandle   = null;
let eoNextHandle    = null;
let eoTimeRemaining = 5;

let eoItems         = [];
let eoItemIdx       = 0;
let eoRoundScores   = [];

// ── DOM refs ─────────────────────────────────────────────────
const eoIntroScreen     = document.getElementById('introScreen');
const eoCountdownScreen = document.getElementById('countdownScreen');
const eoCountdownNumber = document.getElementById('countdownNumber');
const eoGameScreen      = document.getElementById('gameScreen');
const eoResultScreen    = document.getElementById('resultScreen');

const eoBackBtn   = document.getElementById('backBtn');
const eoPlayBtn   = document.getElementById('playBtn');
const eoCloseBtn  = document.getElementById('closeBtn');
const eoRetryBtn  = document.getElementById('retryBtn');
const eoHomeBtn   = document.getElementById('homeBtn');

const eoZonesWrap       = document.getElementById('zonesWrap');
const eoQuestionCounter = document.getElementById('questionCounter');
const eoProblemTimer    = document.getElementById('problemTimer');
const eoNumBox          = document.getElementById('eoNumBox');
const eoProblemStatus   = document.getElementById('problemStatus');
const eoScoreBar        = document.getElementById('scoreBar');

const eoSoundToggle     = document.getElementById('soundToggleIntro');

const eoResultTitle     = document.getElementById('resultTitle');
const eoResultWinner    = document.getElementById('resultWinner');
const eoResultTableHead = document.getElementById('resultTableHead');
const eoResultTableBody = document.getElementById('resultTableBody');
const eoTotalRow        = document.getElementById('totalRow');

// ── Helpers ──────────────────────────────────────────────────
function eoShowScreen(s) {
  [eoIntroScreen, eoCountdownScreen, eoGameScreen, eoResultScreen]
    .forEach(function(x) { x.classList.remove('active'); });
  s.classList.add('active');
}

var eoCountdownInterval = null;
function eoStartPreCountdown(onDone) {
  eoShowScreen(eoCountdownScreen);
  eoCountdownInterval = runCountdown(eoCountdownNumber, onDone);
}

function eoClearTimers() {
  if (eoCountdownInterval) { clearInterval(eoCountdownInterval); eoCountdownInterval = null; }
  if (eoTimerHandle) { clearInterval(eoTimerHandle); eoTimerHandle = null; }
  if (eoNextHandle)  { clearTimeout(eoNextHandle);   eoNextHandle  = null; }
}

function eoUpdateSoundBtn() {
  eoSoundToggle.textContent = eoSound.isMuted() ? '🔇' : '🔊';
}

function eoRandInt(n) {
  return Math.floor(Math.random() * n);
}

// 문항 생성
// returns { display: string, value: number, answer: 'odd'|'even' }
function eoGenerateItem(phaseNum) {
  var value, display;
  if (phaseNum === 1) {
    value = 1 + eoRandInt(9);
    display = String(value);
  } else if (phaseNum === 2) {
    value = 10 + eoRandInt(90);
    display = String(value);
  } else {
    // 덧셈식: a+b, a,b in 1..19
    var a = 1 + eoRandInt(19);
    var b = 1 + eoRandInt(19);
    value = a + b;
    display = a + '+' + b;
  }
  var answer = value % 2 === 0 ? 'even' : 'odd';
  return { display: display, value: value, answer: answer };
}

function eoGenerateItems(phaseNum) {
  var items = [];
  for (var i = 0; i < EO_ITEMS_PER_ROUND; i++) {
    items.push(eoGenerateItem(phaseNum));
  }
  return items;
}

// ── Intro illustration ───────────────────────────────────────
(function() {
  var el = document.getElementById('introIllust');
  if (el) {
    el.innerHTML = '<svg viewBox="0 0 220 110" xmlns="http://www.w3.org/2000/svg">' +
      '<rect x="6" y="6" width="208" height="98" rx="16" fill="#FFF8E1" stroke="#2C2C2C" stroke-width="3"/>' +
      '<rect x="22" y="22" width="54" height="50" rx="10" fill="#FFF3E0" stroke="#2C2C2C" stroke-width="3"/>' +
      '<text x="49" y="55" text-anchor="middle" font-size="22" font-weight="900">7</text>' +
      '<text x="49" y="82" text-anchor="middle" font-size="11" font-weight="800" fill="#E65100">홀수</text>' +
      '<rect x="144" y="22" width="54" height="50" rx="10" fill="#E0F7FA" stroke="#2C2C2C" stroke-width="3"/>' +
      '<text x="171" y="55" text-anchor="middle" font-size="22" font-weight="900">12</text>' +
      '<text x="171" y="82" text-anchor="middle" font-size="11" font-weight="800" fill="#00838F">짝수</text>' +
      '<text x="110" y="55" text-anchor="middle" font-size="18" fill="rgba(255,255,255,0.9)">vs</text>' +
      '</svg>';
  }
})();

// ── Player count selection ───────────────────────────────────
document.querySelectorAll('.player-btn').forEach(function(btn) {
  onTap(btn, function() {
    document.querySelectorAll('.player-btn').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    eoPlayerCount = parseInt(btn.dataset.count, 10);
  });
});

// ── Sound toggle ─────────────────────────────────────────────
onTap(eoSoundToggle, function() {
  eoSound.toggleMute();
  eoUpdateSoundBtn();
});
eoUpdateSoundBtn();

// ── Navigation ───────────────────────────────────────────────
onTap(eoBackBtn,  function() { goHome(); });
onTap(eoCloseBtn, function() { eoClearTimers(); goHome(); });
onTap(eoHomeBtn,  function() { goHome(); });
onTap(eoRetryBtn, function() { eoStartPreCountdown(function() { eoStartGame(); }); });
onTap(eoPlayBtn,  function() { eoStartPreCountdown(function() { eoStartGame(); }); });

// ── Build zones ──────────────────────────────────────────────
function eoBuildZones() {
  eoZonesWrap.innerHTML = '';
  eoZonesWrap.className = 'zones-wrap p' + eoPlayerCount;

  for (var i = 0; i < eoPlayerCount; i++) {
    var cfg  = EO_PLAYER_CONFIG[i];
    var zone = document.createElement('div');
    zone.className = 'zone ' + cfg.cls;
    zone.dataset.player = i;

    var header = document.createElement('div');
    header.className = 'zone-header';
    header.innerHTML =
      '<span class="zone-label">' + cfg.label + '</span>' +
      '<span class="zone-score-chip" id="eo-score-chip-' + i + '">0점</span>';

    var btnGroup = document.createElement('div');
    btnGroup.className = 'eo-btn-group';

    var oddBtn = document.createElement('button');
    oddBtn.className = 'eo-btn eo-btn-odd';
    oddBtn.dataset.player = i;
    oddBtn.dataset.ans = 'odd';
    oddBtn.setAttribute('aria-label', cfg.label + ' 홀수');
    oddBtn.textContent = '홀 (odd)';
    (function(pi, btn) { onTap(btn, function() { eoHandleTap(pi, 'odd', btn); }); })(i, oddBtn);

    var evenBtn = document.createElement('button');
    evenBtn.className = 'eo-btn eo-btn-even';
    evenBtn.dataset.player = i;
    evenBtn.dataset.ans = 'even';
    evenBtn.setAttribute('aria-label', cfg.label + ' 짝수');
    evenBtn.textContent = '짝 (even)';
    (function(pi, btn) { onTap(btn, function() { eoHandleTap(pi, 'even', btn); }); })(i, evenBtn);

    btnGroup.appendChild(oddBtn);
    btnGroup.appendChild(evenBtn);

    zone.appendChild(header);
    zone.appendChild(btnGroup);
    eoZonesWrap.appendChild(zone);
  }
}

function eoGetZone(idx) {
  return eoZonesWrap.querySelector('.zone[data-player="' + idx + '"]');
}

function eoGetBtns(playerIdx) {
  var zone = eoGetZone(playerIdx);
  return zone ? Array.from(zone.querySelectorAll('.eo-btn')) : [];
}

function eoUpdateScoreChip(playerIdx) {
  var chip = document.getElementById('eo-score-chip-' + playerIdx);
  if (chip) chip.textContent = eoScores[playerIdx] + '점';
}

// ── Score bar ────────────────────────────────────────────────
function eoBuildScoreBar() {
  eoScoreBar.innerHTML = '';
  for (var i = 0; i < eoPlayerCount; i++) {
    var cfg  = EO_PLAYER_CONFIG[i];
    var chip = document.createElement('div');
    chip.className = 'score-chip';
    chip.innerHTML =
      '<span class="score-chip-dot" style="background:' + cfg.dot + '"></span>' +
      '<span>' + cfg.label + '</span>' +
      '<span class="score-chip-val" id="eo-bar-score-' + i + '">0</span>';
    eoScoreBar.appendChild(chip);
  }
}

function eoUpdateBarScore(playerIdx) {
  var el = document.getElementById('eo-bar-score-' + playerIdx);
  if (el) el.textContent = eoScores[playerIdx];
}

// ── Reset buttons for new item ────────────────────────────────
function eoResetItemBtns() {
  for (var i = 0; i < eoPlayerCount; i++) {
    eoGetBtns(i).forEach(function(btn) {
      btn.className = 'eo-btn ' + (btn.dataset.ans === 'odd' ? 'eo-btn-odd' : 'eo-btn-even');
      btn.disabled = false;
    });
    var zone = eoGetZone(i);
    if (zone) zone.classList.remove('dq-zone');
  }
  eoDqSet = new Set();
}

function eoDisablePlayerBtns(playerIdx) {
  eoGetBtns(playerIdx).forEach(function(btn) {
    btn.classList.add('state-disabled');
    btn.disabled = true;
  });
}

// ── Timer ─────────────────────────────────────────────────────
function eoStartItemTimer() {
  var plan = EO_ROUND_PLAN[eoRoundIdx];
  eoTimeRemaining = plan.timeLimit;
  eoProblemTimer.textContent = eoTimeRemaining;
  eoProblemTimer.classList.remove('urgent');

  eoTimerHandle = setInterval(function() {
    eoTimeRemaining--;
    eoProblemTimer.textContent = eoTimeRemaining;
    if (eoTimeRemaining <= 2 && eoTimeRemaining > 0) {
      eoProblemTimer.classList.add('urgent');
      eoSound.play('tick');
    }
    if (eoTimeRemaining <= 0) {
      eoClearTimers();
      eoHandleItemTimeout();
    }
  }, 1000);
}

// ── Tap handler ───────────────────────────────────────────────
function eoHandleTap(playerIdx, ans, btn) {
  if (eoPhase !== 'item-active') return;
  if (eoDqSet.has(playerIdx)) return;

  var currentItem = eoItems[eoItemIdx];

  if (ans === currentItem.answer) {
    // 정답
    eoSound.play('ding');
    btn.classList.add('state-correct');
    eoDqSet.add(playerIdx);
    eoScores[playerIdx]++;
    eoRoundScores[playerIdx]++;
    eoUpdateScoreChip(playerIdx);
    eoUpdateBarScore(playerIdx);

    eoGetBtns(playerIdx).forEach(function(b) {
      if (b !== btn) { b.classList.add('state-disabled'); b.disabled = true; }
    });

    if (eoAllAnswered()) {
      eoClearTimers();
      eoNextHandle = setTimeout(function() { eoNextItem(); }, 600);
    }
  } else {
    // 오답
    eoSound.play('buzz');
    btn.classList.add('state-wrong');
    eoDqSet.add(playerIdx);

    var zone = eoGetZone(playerIdx);
    var flash = document.createElement('div');
    flash.className = 'penalty-flash';
    flash.textContent = '실격!';
    zone.appendChild(flash);
    flash.addEventListener('animationend', function() { flash.remove(); });

    eoDisablePlayerBtns(playerIdx);
    zone.classList.add('dq-zone');

    var anyActive = false;
    for (var i = 0; i < eoPlayerCount; i++) {
      if (!eoDqSet.has(i)) { anyActive = true; break; }
    }
    if (!anyActive) {
      eoClearTimers();
      eoNextHandle = setTimeout(function() { eoHandleItemTimeout(); }, 300);
    }
  }
}

function eoAllAnswered() {
  for (var i = 0; i < eoPlayerCount; i++) {
    if (!eoDqSet.has(i)) return false;
  }
  return true;
}

// ── Item timeout ─────────────────────────────────────────────
function eoHandleItemTimeout() {
  eoSound.play('timeout');
  var currentItem = eoItems[eoItemIdx];
  for (var i = 0; i < eoPlayerCount; i++) {
    eoGetBtns(i).forEach(function(btn) {
      if (btn.dataset.ans === currentItem.answer) {
        btn.classList.remove('state-disabled');
        btn.classList.add('state-reveal');
      } else {
        btn.classList.add('state-disabled');
      }
      btn.disabled = true;
    });
    var zone = eoGetZone(i);
    if (zone) zone.classList.remove('dq-zone');
  }
  eoProblemStatus.textContent = '⏰ 정답: ' + (currentItem.answer === 'odd' ? '홀수' : '짝수') + ' (' + currentItem.display + '=' + currentItem.value + ')';
  eoNextHandle = setTimeout(function() { eoNextItem(); }, 1200);
}

// ── Load item ─────────────────────────────────────────────────
function eoLoadItem() {
  eoPhase = 'item-active';
  var currentItem = eoItems[eoItemIdx];

  eoQuestionCounter.textContent = '라운드 ' + (eoRoundIdx + 1) + '/' + EO_TOTAL_ROUNDS + '  문항 ' + (eoItemIdx + 1) + '/' + EO_ITEMS_PER_ROUND;
  eoProblemStatus.textContent = '';
  eoProblemTimer.classList.remove('urgent');

  eoNumBox.textContent = currentItem.display;
  eoNumBox.classList.remove('num-pop');
  void eoNumBox.offsetWidth;
  eoNumBox.classList.add('num-pop');

  eoResetItemBtns();
  eoStartItemTimer();
}

// ── Next item ─────────────────────────────────────────────────
function eoNextItem() {
  eoItemIdx++;
  if (eoItemIdx >= EO_ITEMS_PER_ROUND) {
    eoEndRound();
  } else {
    eoLoadItem();
  }
}

// ── End round ─────────────────────────────────────────────────
function eoEndRound() {
  eoPhase = 'done';
  eoRoundLog.push({
    roundIdx: eoRoundIdx,
    roundScores: eoRoundScores.slice(),
  });
  eoProblemStatus.textContent = '라운드 ' + (eoRoundIdx + 1) + ' 완료!';
  eoNextHandle = setTimeout(function() { eoNextRound(); }, EO_RESULT_PAUSE_MS);
}

function eoNextRound() {
  eoRoundIdx++;
  if (eoRoundIdx >= EO_TOTAL_ROUNDS) {
    eoShowResult();
  } else {
    eoStartRound();
  }
}

// ── Start round ───────────────────────────────────────────────
function eoStartRound() {
  var plan = EO_ROUND_PLAN[eoRoundIdx];
  eoItems = eoGenerateItems(plan.phase);
  eoItemIdx = 0;
  eoRoundScores = new Array(eoPlayerCount).fill(0);
  eoDqSet = new Set();
  eoLoadItem();
}

// ── Start game ────────────────────────────────────────────────
function eoStartGame() {
  eoRoundIdx   = 0;
  eoScores     = new Array(eoPlayerCount).fill(0);
  eoRoundLog   = [];
  eoDqSet      = new Set();
  eoPhase      = 'idle';

  eoClearTimers();
  eoBuildZones();
  eoBuildScoreBar();
  eoShowScreen(eoGameScreen);
  eoStartRound();
}

// ── Show result ───────────────────────────────────────────────
function eoShowResult() {
  eoClearTimers();
  eoPhase = 'idle';
  eoSound.play('fanfare');

  var maxScore = Math.max.apply(null, eoScores);
  var winners  = eoScores
    .map(function(s, i) { return { s: s, i: i }; })
    .filter(function(x) { return x.s === maxScore; })
    .map(function(x) { return x.i; });

  if (maxScore === 0) {
    eoResultTitle.textContent  = '무승부!';
    eoResultWinner.textContent = '아무도 점수를 얻지 못했어요.';
  } else if (winners.length === 1) {
    var w = winners[0];
    eoResultTitle.textContent  = '게임 종료!';
    eoResultWinner.textContent = EO_PLAYER_CONFIG[w].label + ' 승리! (' + maxScore + '점)';
  } else {
    var labels = winners.map(function(w2) { return EO_PLAYER_CONFIG[w2].label; }).join(', ');
    eoResultTitle.textContent  = '동점!';
    eoResultWinner.textContent = labels + ' 공동 1위! (' + maxScore + '점)';
  }

  // Table header
  var headRow = document.createElement('tr');
  var headHtml = '<th>라운드</th>';
  for (var i = 0; i < eoPlayerCount; i++) {
    headHtml += '<th><span class="player-dot" style="background:' + EO_PLAYER_CONFIG[i].dot + '"></span>' + EO_PLAYER_CONFIG[i].label + '</th>';
  }
  headRow.innerHTML = headHtml;
  eoResultTableHead.innerHTML = '';
  eoResultTableHead.appendChild(headRow);

  // Table body
  eoResultTableBody.innerHTML = '';
  eoRoundLog.forEach(function(log) {
    var tr = document.createElement('tr');
    var plan = EO_ROUND_PLAN[log.roundIdx];
    var phaseLabel = ['', '한 자리', '두 자리', '덧셈식'][plan.phase];
    var cells = '<td style="text-align:left;font-size:0.82rem;">' + (log.roundIdx + 1) + '라운드 (' + phaseLabel + ')</td>';
    for (var i = 0; i < eoPlayerCount; i++) {
      var pts = log.roundScores[i];
      cells += pts > 0
        ? '<td class="cell-win">+' + pts + '</td>'
        : '<td class="cell-none">0</td>';
    }
    tr.innerHTML = cells;
    eoResultTableBody.appendChild(tr);
  });

  // Total chips
  eoTotalRow.innerHTML = '';
  for (var i = 0; i < eoPlayerCount; i++) {
    var cfg   = EO_PLAYER_CONFIG[i];
    var isWin = winners.indexOf(i) !== -1 && maxScore > 0;
    var chip  = document.createElement('div');
    chip.className = 'total-chip';
    chip.innerHTML =
      '<span class="chip-dot" style="background:' + cfg.dot + '"></span>' +
      '<span>' + cfg.label + '</span>' +
      '<span class="chip-score" style="color:' + (isWin ? '#2E7D32' : '#555') + '">' + eoScores[i] + '점</span>' +
      (isWin ? '<span style="font-size:1.1rem;">★</span>' : '');
    eoTotalRow.appendChild(chip);
  }

  eoShowScreen(eoResultScreen);
}
