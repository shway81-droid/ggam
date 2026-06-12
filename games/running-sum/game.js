/* games/running-sum/game.js */

'use strict';

// ── Constants ────────────────────────────────────────────────
const RS_TOTAL_ROUNDS    = 8;
const RS_RESULT_PAUSE_MS = getAutoplayPauseMs(2000);
const RS_ANSWER_TIME     = 8;  // 초 (카드 제시 후 정답 선택 시간)

// 라운드별 난이도
// cardCount: 카드 수, numRange: 각 수 최대값, intervalMs: 카드 표시 간격(ms)
const RS_ROUND_PLAN = [
  { cardCount: 3, numRange: 5,  intervalMs: 1200 },
  { cardCount: 3, numRange: 5,  intervalMs: 1200 },
  { cardCount: 4, numRange: 7,  intervalMs: 1100 },
  { cardCount: 4, numRange: 7,  intervalMs: 1000 },
  { cardCount: 4, numRange: 9,  intervalMs: 1000 },
  { cardCount: 5, numRange: 9,  intervalMs: 900  },
  { cardCount: 5, numRange: 9,  intervalMs: 800  },
  { cardCount: 5, numRange: 9,  intervalMs: 700  },
];

const RS_PLAYER_CONFIG = [
  { label: 'P1', dot: '#0288D1', cls: 'p1' },
  { label: 'P2', dot: '#E53935', cls: 'p2' },
  { label: 'P3', dot: '#388E3C', cls: 'p3' },
  { label: 'P4', dot: '#F57C00', cls: 'p4' },
];

// ── Sound Manager ────────────────────────────────────────────
const rsSound = createSoundManager({
  card(ctx) {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.18);
    gain.gain.setValueAtTime(0.22, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.22);
  },
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
  question(ctx) {
    [440, 550].forEach(function(freq, i) {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'triangle';
      const t = ctx.currentTime + i * 0.15;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.28, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.start(t); osc.stop(t + 0.28);
    });
  },
});

// ── State ────────────────────────────────────────────────────
let rsPlayerCount   = 2;
let rsRoundIdx      = 0;
let rsScores        = [];
let rsRoundLog      = [];
let rsDqSet         = new Set();
let rsPhase         = 'idle';
let rsTimerHandle   = null;
let rsNextHandle    = null;
let rsCardTimeout   = null;
let rsTimeRemaining = RS_ANSWER_TIME;

// 현재 라운드
let rsCards         = [];    // 수 배열
let rsCorrectAnswer = 0;
let rsChoices       = [];    // 4지선다 보기

// ── DOM refs ─────────────────────────────────────────────────
const rsIntroScreen     = document.getElementById('introScreen');
const rsCountdownScreen = document.getElementById('countdownScreen');
const rsCountdownNumber = document.getElementById('countdownNumber');
const rsGameScreen      = document.getElementById('gameScreen');
const rsResultScreen    = document.getElementById('resultScreen');

const rsBackBtn   = document.getElementById('backBtn');
const rsPlayBtn   = document.getElementById('playBtn');
const rsCloseBtn  = document.getElementById('closeBtn');
const rsRetryBtn  = document.getElementById('retryBtn');
const rsHomeBtn   = document.getElementById('homeBtn');

const rsZonesWrap       = document.getElementById('zonesWrap');
const rsQuestionCounter = document.getElementById('questionCounter');
const rsProblemTimer    = document.getElementById('problemTimer');
const rsCardSlot        = document.getElementById('rsCardSlot');
const rsCard            = document.getElementById('rsCard');
const rsQuestionLabel   = document.getElementById('rsQuestionLabel');
const rsProblemStatus   = document.getElementById('problemStatus');
const rsScoreBar        = document.getElementById('scoreBar');

const rsSoundToggle     = document.getElementById('soundToggleIntro');

const rsResultTitle     = document.getElementById('resultTitle');
const rsResultWinner    = document.getElementById('resultWinner');
const rsResultTableHead = document.getElementById('resultTableHead');
const rsResultTableBody = document.getElementById('resultTableBody');
const rsTotalRow        = document.getElementById('totalRow');

// ── Helpers ──────────────────────────────────────────────────
function rsShowScreen(s) {
  [rsIntroScreen, rsCountdownScreen, rsGameScreen, rsResultScreen]
    .forEach(function(x) { x.classList.remove('active'); });
  s.classList.add('active');
}

var rsCountdownInterval = null;
function rsStartPreCountdown(onDone) {
  rsShowScreen(rsCountdownScreen);
  var count = 3;
  rsCountdownNumber.textContent = count;
  rsCountdownInterval = setInterval(function() {
    count--;
    if (count <= 0) {
      clearInterval(rsCountdownInterval);
      rsCountdownInterval = null;
      onDone();
    } else {
      rsCountdownNumber.textContent = count;
      rsCountdownNumber.style.animation = 'none';
      rsCountdownNumber.offsetHeight;
      rsCountdownNumber.style.animation = '';
    }
  }, 1000);
}

function rsClearTimers() {
  if (rsCountdownInterval) { clearInterval(rsCountdownInterval); rsCountdownInterval = null; }
  if (rsTimerHandle) { clearInterval(rsTimerHandle); rsTimerHandle = null; }
  if (rsNextHandle)  { clearTimeout(rsNextHandle);   rsNextHandle  = null; }
  if (rsCardTimeout) { clearTimeout(rsCardTimeout);  rsCardTimeout  = null; }
}

function rsUpdateSoundBtn() {
  rsSoundToggle.textContent = rsSound.isMuted() ? '🔇' : '🔊';
}

function rsRandInt(n) {
  return Math.floor(Math.random() * n);
}

// ── Generate round question ───────────────────────────────────
function rsGenerateRound(plan) {
  var cards = [];
  for (var i = 0; i < plan.cardCount; i++) {
    cards.push(1 + rsRandInt(plan.numRange));
  }
  var correctAnswer = 0;
  for (var j = 0; j < cards.length; j++) { correctAnswer += cards[j]; }

  // 4지선다: 정답 + 오답 3개 (정답 ±1~3에서 중복 없이)
  var choices = [correctAnswer];
  var offsets = [-3, -2, -1, 1, 2, 3];
  // shuffle offsets
  for (var k = offsets.length - 1; k > 0; k--) {
    var r = rsRandInt(k + 1);
    var tmp = offsets[k]; offsets[k] = offsets[r]; offsets[r] = tmp;
  }
  for (var m = 0; m < offsets.length && choices.length < 4; m++) {
    var candidate = correctAnswer + offsets[m];
    if (candidate > 0 && choices.indexOf(candidate) === -1) {
      choices.push(candidate);
    }
  }
  // 4개 못 채웠으면 추가 오프셋
  var extra = 4;
  while (choices.length < 4) {
    if (choices.indexOf(correctAnswer + extra) === -1 && correctAnswer + extra > 0) {
      choices.push(correctAnswer + extra);
    }
    extra++;
    if (extra > 50) break;
  }
  // shuffle choices
  for (var n = choices.length - 1; n > 0; n--) {
    var s = rsRandInt(n + 1);
    var t2 = choices[n]; choices[n] = choices[s]; choices[s] = t2;
  }

  return { cards: cards, correctAnswer: correctAnswer, choices: choices };
}

// ── Intro illustration ───────────────────────────────────────
(function() {
  var el = document.getElementById('introIllust');
  if (el) {
    el.innerHTML = '<svg viewBox="0 0 220 110" xmlns="http://www.w3.org/2000/svg">' +
      '<rect x="6" y="6" width="208" height="98" rx="16" fill="#FFF8E1" stroke="#2C2C2C" stroke-width="3"/>' +
      '<text x="28" y="58" font-size="32">🚂</text>' +
      '<rect x="76" y="28" width="44" height="44" rx="10" fill="#FFFDF5" stroke="#2C2C2C" stroke-width="3"/>' +
      '<text x="98" y="58" text-anchor="middle" font-size="22" font-weight="900">3</text>' +
      '<rect x="130" y="28" width="44" height="44" rx="10" fill="#FFFDF5" stroke="#2C2C2C" stroke-width="3"/>' +
      '<text x="152" y="58" text-anchor="middle" font-size="22" font-weight="900">5</text>' +
      '<text x="110" y="90" text-anchor="middle" font-size="12" font-weight="900" fill="#6D4C41">지금까지 합은?</text>' +
      '</svg>';
  }
})();

// ── Player count selection ───────────────────────────────────
document.querySelectorAll('.player-btn').forEach(function(btn) {
  onTap(btn, function() {
    document.querySelectorAll('.player-btn').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    rsPlayerCount = parseInt(btn.dataset.count, 10);
  });
});

// ── Sound toggle ─────────────────────────────────────────────
onTap(rsSoundToggle, function() {
  rsSound.toggleMute();
  rsUpdateSoundBtn();
});
rsUpdateSoundBtn();

// ── Navigation ───────────────────────────────────────────────
onTap(rsBackBtn,  function() { goHome(); });
onTap(rsCloseBtn, function() { rsClearTimers(); goHome(); });
onTap(rsHomeBtn,  function() { goHome(); });
onTap(rsRetryBtn, function() { rsStartPreCountdown(function() { rsStartGame(); }); });
onTap(rsPlayBtn,  function() { rsStartPreCountdown(function() { rsStartGame(); }); });

// ── Build zones ──────────────────────────────────────────────
function rsBuildZones() {
  rsZonesWrap.innerHTML = '';
  rsZonesWrap.className = 'zones-wrap p' + rsPlayerCount;

  for (var i = 0; i < rsPlayerCount; i++) {
    var cfg  = RS_PLAYER_CONFIG[i];
    var zone = document.createElement('div');
    zone.className = 'zone ' + cfg.cls;
    zone.dataset.player = i;

    var header = document.createElement('div');
    header.className = 'zone-header';
    header.innerHTML =
      '<span class="zone-label">' + cfg.label + '</span>' +
      '<span class="zone-score-chip" id="rs-score-chip-' + i + '">0점</span>';

    var grid = document.createElement('div');
    grid.className = 'rs-choice-grid';
    grid.id = 'rs-choice-grid-' + i;

    for (var slot = 0; slot < 4; slot++) {
      var btn = document.createElement('button');
      btn.className = 'rs-choice-btn state-waiting';
      btn.dataset.player = i;
      btn.dataset.slot = slot;
      btn.setAttribute('aria-label', cfg.label + ' 보기 ' + (slot + 1));
      btn.disabled = true;
      btn.textContent = '?';
      (function(pi, b) {
        onTap(b, function() { rsHandleTap(pi, b); });
      })(i, btn);
      grid.appendChild(btn);
    }

    zone.appendChild(header);
    zone.appendChild(grid);
    rsZonesWrap.appendChild(zone);
  }
}

function rsGetZone(idx) {
  return rsZonesWrap.querySelector('.zone[data-player="' + idx + '"]');
}

function rsGetChoiceBtns(playerIdx) {
  var grid = document.getElementById('rs-choice-grid-' + playerIdx);
  return grid ? Array.from(grid.querySelectorAll('.rs-choice-btn')) : [];
}

function rsUpdateScoreChip(playerIdx) {
  var chip = document.getElementById('rs-score-chip-' + playerIdx);
  if (chip) chip.textContent = rsScores[playerIdx] + '점';
}

// ── Score bar ────────────────────────────────────────────────
function rsBuildScoreBar() {
  rsScoreBar.innerHTML = '';
  for (var i = 0; i < rsPlayerCount; i++) {
    var cfg  = RS_PLAYER_CONFIG[i];
    var chip = document.createElement('div');
    chip.className = 'score-chip';
    chip.innerHTML =
      '<span class="score-chip-dot" style="background:' + cfg.dot + '"></span>' +
      '<span>' + cfg.label + '</span>' +
      '<span class="score-chip-val" id="rs-bar-score-' + i + '">0</span>';
    rsScoreBar.appendChild(chip);
  }
}

function rsUpdateBarScore(playerIdx) {
  var el = document.getElementById('rs-bar-score-' + playerIdx);
  if (el) el.textContent = rsScores[playerIdx];
}

// ── Activate answer buttons (after all cards shown) ───────────
function rsActivateChoiceBtns() {
  for (var i = 0; i < rsPlayerCount; i++) {
    if (rsDqSet.has(i)) continue;
    rsGetChoiceBtns(i).forEach(function(btn, slot) {
      btn.className = 'rs-choice-btn';
      btn.disabled = false;
      btn.textContent = rsChoices[slot];
    });
  }
}

function rsDisablePlayerBtns(playerIdx) {
  rsGetChoiceBtns(playerIdx).forEach(function(btn) {
    btn.classList.add('state-disabled');
    btn.disabled = true;
  });
}

// ── Timer (answer phase) ─────────────────────────────────────
function rsStartAnswerTimer() {
  rsTimeRemaining = RS_ANSWER_TIME;
  rsProblemTimer.textContent = rsTimeRemaining;
  rsProblemTimer.classList.remove('urgent');

  rsTimerHandle = setInterval(function() {
    rsTimeRemaining--;
    rsProblemTimer.textContent = rsTimeRemaining;
    if (rsTimeRemaining <= 3 && rsTimeRemaining > 0) {
      rsProblemTimer.classList.add('urgent');
      rsSound.play('tick');
    }
    if (rsTimeRemaining <= 0) {
      rsClearTimers();
      rsHandleTimeout();
    }
  }, 1000);
}

// ── Tap handler ───────────────────────────────────────────────
function rsHandleTap(playerIdx, btn) {
  if (rsPhase !== 'answer') return;
  if (rsDqSet.has(playerIdx)) return;

  var slot = parseInt(btn.dataset.slot, 10);
  var chosen = rsChoices[slot];

  if (chosen === rsCorrectAnswer) {
    // 정답
    rsSound.play('ding');
    btn.classList.add('state-correct');
    rsDqSet.add(playerIdx);
    rsScores[playerIdx]++;
    rsUpdateScoreChip(playerIdx);
    rsUpdateBarScore(playerIdx);

    rsGetChoiceBtns(playerIdx).forEach(function(b) {
      if (b !== btn) { b.classList.add('state-disabled'); b.disabled = true; }
    });

    if (rsAllAnswered()) {
      rsClearTimers();
      rsNextHandle = setTimeout(function() { rsEndRound(false); }, 600);
    }
  } else {
    // 오답
    rsSound.play('buzz');
    btn.classList.add('state-wrong');
    rsDqSet.add(playerIdx);

    var zone = rsGetZone(playerIdx);
    var flash = document.createElement('div');
    flash.className = 'penalty-flash';
    flash.textContent = '실격!';
    zone.appendChild(flash);
    flash.addEventListener('animationend', function() { flash.remove(); });

    rsDisablePlayerBtns(playerIdx);
    zone.classList.add('dq-zone');

    var anyActive = false;
    for (var i = 0; i < rsPlayerCount; i++) {
      if (!rsDqSet.has(i)) { anyActive = true; break; }
    }
    if (!anyActive) {
      rsClearTimers();
      rsNextHandle = setTimeout(function() { rsHandleTimeout(); }, 300);
    }
  }
}

function rsAllAnswered() {
  for (var i = 0; i < rsPlayerCount; i++) {
    if (!rsDqSet.has(i)) return false;
  }
  return true;
}

// ── Timeout ─────────────────────────────────────────────────
function rsHandleTimeout() {
  rsSound.play('timeout');
  // 정답 공개
  for (var i = 0; i < rsPlayerCount; i++) {
    rsGetChoiceBtns(i).forEach(function(btn, slot) {
      if (rsChoices[slot] === rsCorrectAnswer) {
        btn.classList.remove('state-disabled');
        btn.classList.remove('state-waiting');
        btn.classList.add('state-reveal');
        btn.textContent = rsChoices[slot];
      } else {
        btn.classList.add('state-disabled');
      }
      btn.disabled = true;
    });
    var zone = rsGetZone(i);
    if (zone) zone.classList.remove('dq-zone');
  }
  rsProblemStatus.textContent = '⏰ 정답: ' + rsCorrectAnswer;
  rsNextHandle = setTimeout(function() { rsEndRound(true); }, 1400);
}

// ── Animate card sequence ─────────────────────────────────────
function rsPlayCards(cards, intervalMs, onDone) {
  var idx = 0;

  function showNext() {
    if (idx >= cards.length) {
      // 마지막 카드 숨기고 완료 콜백
      rsCard.classList.remove('card-show');
      rsCard.classList.add('card-hide');
      rsCardTimeout = setTimeout(function() {
        rsCard.classList.remove('card-hide');
        rsCard.style.opacity = '0';
        onDone();
      }, 220);
      return;
    }

    // show card
    rsCard.classList.remove('card-show', 'card-hide');
    rsCard.textContent = cards[idx];
    rsCard.style.opacity = '0';
    // force reflow
    void rsCard.offsetWidth;
    rsCard.classList.add('card-show');
    rsSound.play('card');

    idx++;

    rsCardTimeout = setTimeout(function() {
      // hide
      rsCard.classList.remove('card-show');
      rsCard.classList.add('card-hide');
      rsCardTimeout = setTimeout(function() {
        rsCard.classList.remove('card-hide');
        rsCard.style.opacity = '0';
        if (idx < cards.length) {
          rsCardTimeout = setTimeout(showNext, 120);
        } else {
          showNext();
        }
      }, 220);
    }, intervalMs - 240);
  }

  showNext();
}

// ── Load round ────────────────────────────────────────────────
function rsLoadRound() {
  var plan = RS_ROUND_PLAN[rsRoundIdx];
  var round = rsGenerateRound(plan);
  rsCards = round.cards;
  rsCorrectAnswer = round.correctAnswer;
  rsChoices = round.choices;
  rsDqSet = new Set();
  rsPhase = 'cards';

  rsQuestionCounter.textContent = '라운드 ' + (rsRoundIdx + 1) + '/' + RS_TOTAL_ROUNDS;
  rsProblemTimer.textContent = '';
  rsProblemTimer.classList.remove('urgent');
  rsProblemStatus.textContent = '';
  rsQuestionLabel.textContent = '🚂 카드를 눈으로 더해요!';

  // 답 버튼 대기 상태로 초기화
  for (var i = 0; i < rsPlayerCount; i++) {
    rsGetChoiceBtns(i).forEach(function(btn, slot) {
      btn.className = 'rs-choice-btn state-waiting';
      btn.disabled = true;
      btn.textContent = '?';
    });
    var zone = rsGetZone(i);
    if (zone) zone.classList.remove('dq-zone');
  }

  // 카드 시퀀스 재생
  rsPlayCards(rsCards, plan.intervalMs, function() {
    // 카드 모두 지나간 후 질문 표시 + 버튼 활성화
    rsQuestionLabel.textContent = '지금까지 합은? 🤔';
    rsSound.play('question');
    rsPhase = 'answer';
    rsActivateChoiceBtns();
    rsStartAnswerTimer();
  });
}

// ── End round ─────────────────────────────────────────────────
function rsEndRound(timedOut) {
  rsPhase = 'done';
  rsRoundLog.push({
    roundIdx: rsRoundIdx,
    correctAnswer: rsCorrectAnswer,
    cards: rsCards.slice(),
    timedOut: timedOut,
  });
  rsProblemStatus.textContent = '라운드 ' + (rsRoundIdx + 1) + ' 완료! (정답: ' + rsCorrectAnswer + ')';
  rsNextHandle = setTimeout(function() { rsNextRound(); }, RS_RESULT_PAUSE_MS);
}

function rsNextRound() {
  rsRoundIdx++;
  if (rsRoundIdx >= RS_TOTAL_ROUNDS) {
    rsShowResult();
  } else {
    rsLoadRound();
  }
}

// ── Start game ────────────────────────────────────────────────
function rsStartGame() {
  rsRoundIdx   = 0;
  rsScores     = new Array(rsPlayerCount).fill(0);
  rsRoundLog   = [];
  rsDqSet      = new Set();
  rsPhase      = 'idle';

  rsClearTimers();
  rsBuildZones();
  rsBuildScoreBar();
  rsShowScreen(rsGameScreen);
  rsLoadRound();
}

// ── Show result ───────────────────────────────────────────────
function rsShowResult() {
  rsClearTimers();
  rsPhase = 'idle';
  rsSound.play('fanfare');

  var maxScore = Math.max.apply(null, rsScores);
  var winners  = rsScores
    .map(function(s, i) { return { s: s, i: i }; })
    .filter(function(x) { return x.s === maxScore; })
    .map(function(x) { return x.i; });

  if (maxScore === 0) {
    rsResultTitle.textContent  = '무승부!';
    rsResultWinner.textContent = '아무도 점수를 얻지 못했어요.';
  } else if (winners.length === 1) {
    var w = winners[0];
    rsResultTitle.textContent  = '게임 종료!';
    rsResultWinner.textContent = RS_PLAYER_CONFIG[w].label + ' 승리! (' + maxScore + '점)';
  } else {
    var labels = winners.map(function(w2) { return RS_PLAYER_CONFIG[w2].label; }).join(', ');
    rsResultTitle.textContent  = '동점!';
    rsResultWinner.textContent = labels + ' 공동 1위! (' + maxScore + '점)';
  }

  // Table header
  var headRow = document.createElement('tr');
  var headHtml = '<th>라운드</th>';
  for (var i = 0; i < rsPlayerCount; i++) {
    headHtml += '<th><span class="player-dot" style="background:' + RS_PLAYER_CONFIG[i].dot + '"></span>' + RS_PLAYER_CONFIG[i].label + '</th>';
  }
  headRow.innerHTML = headHtml;
  rsResultTableHead.innerHTML = '';
  rsResultTableHead.appendChild(headRow);

  // Table body
  rsResultTableBody.innerHTML = '';
  rsRoundLog.forEach(function(log, idx) {
    var tr = document.createElement('tr');
    var cardsStr = log.cards.join('+');
    var cells = '<td style="text-align:left;font-size:0.8rem;">' + (log.roundIdx + 1) + '. ' + cardsStr + '=' + log.correctAnswer + '</td>';
    for (var i = 0; i < rsPlayerCount; i++) {
      // winners in this round: player who scored this round
      // We track overall scores not per-round in log; just show win/dq/none
      cells += '<td class="cell-none">—</td>';
    }
    tr.innerHTML = cells;
    rsResultTableBody.appendChild(tr);
  });

  // Total chips
  rsTotalRow.innerHTML = '';
  for (var i = 0; i < rsPlayerCount; i++) {
    var cfg   = RS_PLAYER_CONFIG[i];
    var isWin = winners.indexOf(i) !== -1 && maxScore > 0;
    var chip  = document.createElement('div');
    chip.className = 'total-chip';
    chip.innerHTML =
      '<span class="chip-dot" style="background:' + cfg.dot + '"></span>' +
      '<span>' + cfg.label + '</span>' +
      '<span class="chip-score" style="color:' + (isWin ? '#2E7D32' : '#555') + '">' + rsScores[i] + '점</span>' +
      (isWin ? '<span style="font-size:1.1rem;">★</span>' : '');
    rsTotalRow.appendChild(chip);
  }

  rsShowScreen(rsResultScreen);
}
