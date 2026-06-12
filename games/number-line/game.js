/* games/number-line/game.js */
'use strict';

// ── Constants ────────────────────────────────────────────────
const NL_TOTAL_ROUNDS    = 8;
const NL_ROUND_TIME      = 12;
const NL_RESULT_PAUSE_MS = getAutoplayPauseMs(2000);

// Player config
const NL_PLAYER_CONFIG = [
  { label: 'P1', dot: '#0288D1', cls: 'p1' },
  { label: 'P2', dot: '#E53935', cls: 'p2' },
  { label: 'P3', dot: '#388E3C', cls: 'p3' },
  { label: 'P4', dot: '#F57C00', cls: 'p4' },
];

/**
 * Difficulty plan (4 levels, 2 rounds each):
 * Level 1: 0~10, all tick marks labeled
 * Level 2: 0~10, only 0,5,10 labeled
 * Level 3: 0~100 (10-unit steps), only endpoints labeled
 * Level 4: 0~100 (5-unit steps, every other tick), endpoints only
 */
const NL_LEVEL_PLAN = [1, 1, 2, 2, 3, 3, 4, 4];

// ── Number line SVG renderer ─────────────────────────────────
const NL_SVG_W  = 280;
const NL_SVG_H  = 80;
const NL_PAD_X  = 20;
const NL_LINE_Y = 46;
const NL_TICK_H = 12;
const NL_SMALL_TICK_H = 7;
const NL_ARROW_COLOR  = '#E53935';

/**
 * Generate a number line SVG for a given problem.
 * @param {number} minVal - start of number line
 * @param {number} maxVal - end of number line
 * @param {number} step   - tick interval
 * @param {number[]} labeledTicks - which tick values get a label
 * @param {number} arrowAt - value the red arrow points to (must be on a tick)
 * @returns {string} SVG string
 */
function nlRenderSvg(minVal, maxVal, step, labeledTicks, arrowAt) {
  const lineX0 = NL_PAD_X;
  const lineX1 = NL_SVG_W - NL_PAD_X;
  const lineLen = lineX1 - lineX0;
  const range = maxVal - minVal;

  function valToX(v) {
    return lineX0 + ((v - minVal) / range) * lineLen;
  }

  let parts = [];

  // Horizontal line with arrow tips
  parts.push(
    '<line x1="' + lineX0 + '" y1="' + NL_LINE_Y + '" x2="' + lineX1 + '" y2="' + NL_LINE_Y + '"' +
    ' stroke="#2C2C2C" stroke-width="2.5" stroke-linecap="round"/>'
  );

  // Tick marks
  const ticks = [];
  for (let v = minVal; v <= maxVal; v += step) {
    ticks.push(v);
  }

  ticks.forEach(function(v) {
    const x = valToX(v);
    const isLabeled = labeledTicks.indexOf(v) !== -1;
    const tickH = isLabeled ? NL_TICK_H : NL_SMALL_TICK_H;
    const y1 = NL_LINE_Y - tickH / 2;
    const y2 = NL_LINE_Y + tickH / 2;

    parts.push(
      '<line x1="' + x.toFixed(1) + '" y1="' + y1 + '" x2="' + x.toFixed(1) + '" y2="' + y2 + '"' +
      ' stroke="#2C2C2C" stroke-width="' + (isLabeled ? '2' : '1.5') + '" stroke-linecap="round"/>'
    );

    if (isLabeled) {
      parts.push(
        '<text x="' + x.toFixed(1) + '" y="' + (NL_LINE_Y + NL_TICK_H + 14) + '"' +
        ' text-anchor="middle" font-size="13" font-weight="700" fill="#333" font-family="sans-serif">' +
        v + '</text>'
      );
    }
  });

  // Red arrow pointing down to the target tick
  const ax = valToX(arrowAt);
  const arrowTipY  = NL_LINE_Y - 2;
  const arrowBodyY = NL_LINE_Y - 22;
  const arrowHeadH = 8;
  const arrowHeadW = 7;

  // Arrow body (vertical line)
  parts.push(
    '<line x1="' + ax.toFixed(1) + '" y1="' + arrowBodyY + '" x2="' + ax.toFixed(1) + '" y2="' + arrowTipY + '"' +
    ' stroke="' + NL_ARROW_COLOR + '" stroke-width="3" stroke-linecap="round"/>'
  );

  // Arrowhead (triangle pointing down)
  const ahPts = [
    ax.toFixed(1) + ',' + arrowTipY,
    (ax - arrowHeadW).toFixed(1) + ',' + (arrowTipY - arrowHeadH),
    (ax + arrowHeadW).toFixed(1) + ',' + (arrowTipY - arrowHeadH),
  ].join(' ');
  parts.push(
    '<polygon points="' + ahPts + '" fill="' + NL_ARROW_COLOR + '"/>'
  );

  // "?" label above arrow
  parts.push(
    '<text x="' + ax.toFixed(1) + '" y="' + (arrowBodyY - 4) + '"' +
    ' text-anchor="middle" font-size="15" font-weight="900" fill="' + NL_ARROW_COLOR + '" font-family="sans-serif">?</text>'
  );

  const svg =
    '<svg viewBox="0 0 ' + NL_SVG_W + ' ' + NL_SVG_H + '"' +
    ' xmlns="http://www.w3.org/2000/svg"' +
    ' style="width:100%;height:auto;display:block">' +
    parts.join('') +
    '</svg>';

  return svg;
}

// ── Round generation ─────────────────────────────────────────
function nlRandInt(n) { return Math.floor(Math.random() * n); }

function nlShuffleArray(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = nlRandInt(i + 1);
    const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

function nlGenerateRound(roundIdx) {
  const level = NL_LEVEL_PLAN[Math.min(roundIdx, NL_LEVEL_PLAN.length - 1)];

  let minVal, maxVal, step, labeledTicks, ticks;

  if (level === 1) {
    // 0~10, all ticks labeled
    minVal = 0; maxVal = 10; step = 1;
    ticks = [];
    for (let v = 0; v <= 10; v++) ticks.push(v);
    labeledTicks = ticks.slice();
  } else if (level === 2) {
    // 0~10, only 0, 5, 10 labeled
    minVal = 0; maxVal = 10; step = 1;
    ticks = [];
    for (let v = 0; v <= 10; v++) ticks.push(v);
    labeledTicks = [0, 5, 10];
  } else if (level === 3) {
    // 0~100, 10-unit steps, endpoints only labeled
    minVal = 0; maxVal = 100; step = 10;
    ticks = [];
    for (let v = 0; v <= 100; v += 10) ticks.push(v);
    labeledTicks = [0, 100];
  } else {
    // level 4: 0~100, 5-unit steps, endpoints only labeled
    minVal = 0; maxVal = 100; step = 5;
    ticks = [];
    for (let v = 0; v <= 100; v += 5) ticks.push(v);
    labeledTicks = [0, 100];
  }

  // Pick a tick for the arrow (not at endpoints if possible)
  const innerTicks = ticks.filter(function(v) { return v !== minVal && v !== maxVal; });
  const arrowAt = innerTicks.length > 0
    ? innerTicks[nlRandInt(innerTicks.length)]
    : ticks[nlRandInt(ticks.length)];

  // Generate wrong choices: adjacent tick values, no duplicates
  const used = new Set();
  used.add(arrowAt);
  const wrongChoices = [];

  // Adjacent ticks first
  const arrowIdx = ticks.indexOf(arrowAt);
  const adjacents = [];
  if (arrowIdx - 1 >= 0) adjacents.push(ticks[arrowIdx - 1]);
  if (arrowIdx + 1 < ticks.length) adjacents.push(ticks[arrowIdx + 1]);
  if (arrowIdx - 2 >= 0) adjacents.push(ticks[arrowIdx - 2]);
  if (arrowIdx + 2 < ticks.length) adjacents.push(ticks[arrowIdx + 2]);

  for (const v of adjacents) {
    if (!used.has(v) && wrongChoices.length < 3) {
      used.add(v);
      wrongChoices.push(v);
    }
  }

  // Fill remaining with random ticks
  const shuffledTicks = nlShuffleArray(ticks);
  for (const v of shuffledTicks) {
    if (!used.has(v) && wrongChoices.length < 3) {
      used.add(v);
      wrongChoices.push(v);
    }
  }

  // Build choices array (correct + 3 wrong), shuffled
  const allChoices = nlShuffleArray([arrowAt].concat(wrongChoices.slice(0, 3)));

  const svg = nlRenderSvg(minVal, maxVal, step, labeledTicks, arrowAt);

  return {
    minVal, maxVal, step, labeledTicks, ticks,
    arrowAt,
    svg,
    choices: allChoices,
  };
}

// ── Sound Manager ────────────────────────────────────────────
const nlSound = createSoundManager({
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
let nlPlayerCount   = 2;
let nlRoundIdx      = 0;
let nlScores        = [];
let nlRoundLog      = [];
let nlCurrentRound  = null;
let nlDqSet         = new Set();
let nlPhase         = 'idle';
let nlTimerHandle   = null;
let nlNextHandle    = null;
let nlTimeRemaining = NL_ROUND_TIME;
let nlGameRounds    = [];
var nlCDInterval    = null;

// ── DOM refs ─────────────────────────────────────────────────
const nlIntroScreen     = document.getElementById('introScreen');
const nlCountdownScreen = document.getElementById('countdownScreen');
const nlCountdownNumber = document.getElementById('countdownNumber');
const nlGameScreen      = document.getElementById('gameScreen');
const nlResultScreen    = document.getElementById('resultScreen');
const nlBackBtn         = document.getElementById('backBtn');
const nlPlayBtn         = document.getElementById('playBtn');
const nlCloseBtn        = document.getElementById('closeBtn');
const nlRetryBtn        = document.getElementById('retryBtn');
const nlHomeBtn         = document.getElementById('homeBtn');
const nlZonesWrap       = document.getElementById('zonesWrap');
const nlQuestionCounter = document.getElementById('questionCounter');
const nlProblemTimer    = document.getElementById('problemTimer');
const nlProblemStatus   = document.getElementById('problemStatus');
const nlScoreBar        = document.getElementById('scoreBar');
const nlSvgWrap         = document.getElementById('nlSvgWrap');
const nlSoundToggle     = document.getElementById('soundToggleIntro');
const nlIntroIllust     = document.getElementById('introIllust');
const nlResultTitle     = document.getElementById('resultTitle');
const nlResultWinner    = document.getElementById('resultWinner');
const nlResultTableHead = document.getElementById('resultTableHead');
const nlResultTableBody = document.getElementById('resultTableBody');
const nlTotalRow        = document.getElementById('totalRow');

// ── Helpers ──────────────────────────────────────────────────
function nlShowScreen(s) {
  [nlIntroScreen, nlCountdownScreen, nlGameScreen, nlResultScreen]
    .forEach(function(x) { x.classList.remove('active'); });
  s.classList.add('active');
}

function nlClearTimers() {
  if (nlCDInterval)   { clearInterval(nlCDInterval);  nlCDInterval  = null; }
  if (nlTimerHandle)  { clearInterval(nlTimerHandle); nlTimerHandle = null; }
  if (nlNextHandle)   { clearTimeout(nlNextHandle);   nlNextHandle  = null; }
}

function nlUpdateSoundBtn() {
  nlSoundToggle.textContent = nlSound.isMuted() ? '🔇' : '🔊';
}

function nlStartPreGameCountdown(onDone) {
  nlShowScreen(nlCountdownScreen);
  let count = 3;
  nlCountdownNumber.textContent = count;
  nlCDInterval = setInterval(function() {
    count--;
    if (count <= 0) {
      clearInterval(nlCDInterval);
      nlCDInterval = null;
      onDone();
    } else {
      nlCountdownNumber.textContent = count;
      nlCountdownNumber.style.animation = 'none';
      void nlCountdownNumber.offsetHeight;
      nlCountdownNumber.style.animation = '';
    }
  }, 1000);
}

// ── Intro illustration ───────────────────────────────────────
function nlRenderIntroIllust() {
  const svg = nlRenderSvg(0, 10, 1, [0, 5, 10], 7);
  nlIntroIllust.innerHTML = svg;
}
nlRenderIntroIllust();

// ── Player count selection ───────────────────────────────────
document.querySelectorAll('.player-btn').forEach(function(btn) {
  onTap(btn, function() {
    document.querySelectorAll('.player-btn').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    nlPlayerCount = parseInt(btn.dataset.count, 10);
  });
});

onTap(nlSoundToggle, function() { nlSound.toggleMute(); nlUpdateSoundBtn(); });
nlUpdateSoundBtn();

onTap(nlBackBtn,  function() { goHome(); });
onTap(nlCloseBtn, function() { nlClearTimers(); goHome(); });
onTap(nlHomeBtn,  function() { goHome(); });
onTap(nlRetryBtn, function() { nlStartPreGameCountdown(function() { nlStartGame(); }); });
onTap(nlPlayBtn,  function() { nlStartPreGameCountdown(function() { nlStartGame(); }); });

// ── Render problem panel ─────────────────────────────────────
function nlRenderProblem() {
  nlSvgWrap.innerHTML = nlCurrentRound.svg;
}

// ── Build zones ──────────────────────────────────────────────
function nlBuildZones() {
  nlZonesWrap.innerHTML = '';
  nlZonesWrap.className = 'zones-wrap p' + nlPlayerCount;

  for (let i = 0; i < nlPlayerCount; i++) {
    const cfg  = NL_PLAYER_CONFIG[i];
    const zone = document.createElement('div');
    zone.className = 'zone ' + cfg.cls;
    zone.dataset.player = i;

    const header = document.createElement('div');
    header.className = 'zone-header';
    header.innerHTML =
      '<span class="zone-label">' + cfg.label + '</span>' +
      '<span class="zone-score-chip" id="nl-score-chip-' + i + '">0점</span>';

    const hint = document.createElement('div');
    hint.className = 'zone-hint';
    hint.textContent = '화살표가 가리키는 수 선택!';

    const choiceList = document.createElement('div');
    choiceList.className = 'choice-list';
    choiceList.id = 'nl-choice-list-' + i;

    zone.appendChild(header);
    zone.appendChild(hint);
    zone.appendChild(choiceList);
    nlZonesWrap.appendChild(zone);
  }
}

function nlGetZone(idx) {
  return nlZonesWrap.querySelector('.zone[data-player="' + idx + '"]');
}

function nlGetChoiceBtns(playerIdx) {
  const list = document.getElementById('nl-choice-list-' + playerIdx);
  return list ? Array.from(list.querySelectorAll('.choice-btn')) : [];
}

function nlUpdateScoreChip(playerIdx) {
  const chip = document.getElementById('nl-score-chip-' + playerIdx);
  if (chip) chip.textContent = nlScores[playerIdx] + '점';
}

// ── Score bar ────────────────────────────────────────────────
function nlBuildScoreBar() {
  nlScoreBar.innerHTML = '';
  for (let i = 0; i < nlPlayerCount; i++) {
    const cfg  = NL_PLAYER_CONFIG[i];
    const chip = document.createElement('div');
    chip.className = 'score-chip';
    chip.innerHTML =
      '<span class="score-chip-dot" style="background:' + cfg.dot + '"></span>' +
      '<span>' + cfg.label + '</span>' +
      '<span class="score-chip-val" id="nl-bar-score-' + i + '">0</span>';
    nlScoreBar.appendChild(chip);
  }
}

function nlUpdateBarScore(playerIdx) {
  const el = document.getElementById('nl-bar-score-' + playerIdx);
  if (el) el.textContent = nlScores[playerIdx];
}

// ── Reset buttons for new round ──────────────────────────────
function nlResetBtnsForRound() {
  const { choices, arrowAt } = nlCurrentRound;

  for (let i = 0; i < nlPlayerCount; i++) {
    const list = document.getElementById('nl-choice-list-' + i);
    if (!list) continue;
    list.innerHTML = '';

    choices.forEach(function(val, ci) {
      const btn = document.createElement('button');
      btn.className = 'choice-btn';
      btn.dataset.player = String(i);
      btn.dataset.choiceIdx = String(ci);
      btn.dataset.value = String(val);
      btn.setAttribute('aria-label', 'P' + (i + 1) + ' 선택: ' + val);
      btn.textContent = String(val);
      onTap(btn, function() { nlHandleChoiceTap(i, ci, btn, val === arrowAt); });
      list.appendChild(btn);
    });

    const zone = nlGetZone(i);
    if (zone) zone.classList.remove('dq-zone');
  }
}

function nlDisablePlayerBtns(playerIdx) {
  nlGetChoiceBtns(playerIdx).forEach(function(b) {
    b.classList.add('state-disabled');
    b.disabled = true;
  });
}

// ── Timer logic ──────────────────────────────────────────────
function nlStartCountdown() {
  nlTimeRemaining = NL_ROUND_TIME;
  nlProblemTimer.textContent = nlTimeRemaining;
  nlProblemTimer.classList.remove('urgent');

  nlTimerHandle = setInterval(function() {
    nlTimeRemaining--;
    nlProblemTimer.textContent = nlTimeRemaining;
    if (nlTimeRemaining <= 3) {
      nlProblemTimer.classList.add('urgent');
      nlSound.play('tick');
    }
    if (nlTimeRemaining <= 0) {
      nlClearTimers();
      nlHandleTimeout();
    }
  }, 1000);
}

// ── Choice tap handler ───────────────────────────────────────
function nlHandleChoiceTap(playerIdx, choiceIdx, btn, isCorrect) {
  if (nlPhase !== 'active') return;
  if (nlDqSet.has(playerIdx)) return;

  if (isCorrect) {
    nlResolveRound(playerIdx);
  } else {
    nlSound.play('buzz');
    btn.classList.add('state-wrong');
    nlDqSet.add(playerIdx);

    const zone = nlGetZone(playerIdx);
    const flash = document.createElement('div');
    flash.className = 'penalty-flash';
    flash.textContent = '실격!';
    zone.appendChild(flash);
    flash.addEventListener('animationend', function() { flash.remove(); });

    nlDisablePlayerBtns(playerIdx);
    zone.classList.add('dq-zone');

    let anyActive = false;
    for (let i = 0; i < nlPlayerCount; i++) {
      if (!nlDqSet.has(i)) { anyActive = true; break; }
    }
    if (!anyActive) {
      nlClearTimers();
      nlNextHandle = setTimeout(function() { nlHandleTimeout(); }, 300);
    }
  }
}

// ── Correct resolved ─────────────────────────────────────────
function nlResolveRound(winnerIdx) {
  nlPhase = 'done';
  nlClearTimers();
  nlSound.play('ding');

  nlScores[winnerIdx]++;
  nlUpdateScoreChip(winnerIdx);
  nlUpdateBarScore(winnerIdx);

  nlGetChoiceBtns(winnerIdx).forEach(function(b) {
    const val = parseInt(b.dataset.value, 10);
    if (val === nlCurrentRound.arrowAt) {
      b.classList.add('state-correct');
    } else {
      b.classList.add('state-disabled');
      b.disabled = true;
    }
  });

  for (let i = 0; i < nlPlayerCount; i++) {
    if (i !== winnerIdx) nlDisablePlayerBtns(i);
  }

  nlProblemStatus.textContent = NL_PLAYER_CONFIG[winnerIdx].label + ' 정답! (' + nlCurrentRound.arrowAt + ')';

  nlRoundLog.push({
    arrowAt: nlCurrentRound.arrowAt,
    winnerIdx: winnerIdx,
    dqPlayers: Array.from(nlDqSet),
    timedOut: false,
  });

  nlNextHandle = setTimeout(function() { nlNextRound(); }, NL_RESULT_PAUSE_MS);
}

// ── Timeout ──────────────────────────────────────────────────
function nlHandleTimeout() {
  nlPhase = 'done';
  nlClearTimers();
  nlSound.play('timeout');

  for (let i = 0; i < nlPlayerCount; i++) {
    nlGetChoiceBtns(i).forEach(function(b) {
      const val = parseInt(b.dataset.value, 10);
      if (val === nlCurrentRound.arrowAt) {
        b.classList.remove('state-disabled');
        b.classList.add('state-reveal');
        b.disabled = true;
      } else {
        b.classList.add('state-disabled');
        b.disabled = true;
      }
    });
    const zone = nlGetZone(i);
    if (zone) zone.classList.remove('dq-zone');
  }

  nlProblemStatus.textContent = '정답은 ' + nlCurrentRound.arrowAt + '!';

  nlRoundLog.push({
    arrowAt: nlCurrentRound.arrowAt,
    winnerIdx: -1,
    dqPlayers: Array.from(nlDqSet),
    timedOut: true,
  });

  nlNextHandle = setTimeout(function() { nlNextRound(); }, NL_RESULT_PAUSE_MS);
}

// ── Load round ───────────────────────────────────────────────
function nlLoadRound() {
  nlPhase        = 'active';
  nlCurrentRound = nlGameRounds[nlRoundIdx];
  nlDqSet        = new Set();

  nlQuestionCounter.textContent = (nlRoundIdx + 1) + ' / ' + NL_TOTAL_ROUNDS;
  nlProblemStatus.textContent   = '';
  nlProblemTimer.classList.remove('urgent');

  nlRenderProblem();
  nlResetBtnsForRound();
  nlStartCountdown();
}

// ── Next round ───────────────────────────────────────────────
function nlNextRound() {
  nlRoundIdx++;
  if (nlRoundIdx >= NL_TOTAL_ROUNDS) {
    nlShowResult();
  } else {
    nlLoadRound();
  }
}

// ── Start game ───────────────────────────────────────────────
function nlStartGame() {
  nlGameRounds = [];
  for (let i = 0; i < NL_TOTAL_ROUNDS; i++) {
    nlGameRounds.push(nlGenerateRound(i));
  }

  nlRoundIdx  = 0;
  nlScores    = new Array(nlPlayerCount).fill(0);
  nlRoundLog  = [];
  nlDqSet     = new Set();
  nlPhase     = 'idle';

  nlClearTimers();
  nlBuildZones();
  nlBuildScoreBar();
  nlShowScreen(nlGameScreen);
  nlLoadRound();
}

// ── Show result ──────────────────────────────────────────────
function nlShowResult() {
  nlClearTimers();
  nlPhase = 'idle';
  nlSound.play('fanfare');

  const maxScore = Math.max.apply(null, nlScores);
  const winners  = nlScores
    .map(function(s, i) { return { s: s, i: i }; })
    .filter(function(x) { return x.s === maxScore; })
    .map(function(x) { return x.i; });

  if (maxScore === 0) {
    nlResultTitle.textContent  = '무승부!';
    nlResultWinner.textContent = '아무도 점수를 얻지 못했어요.';
  } else if (winners.length === 1) {
    const w = winners[0];
    nlResultTitle.textContent  = '게임 종료!';
    nlResultWinner.textContent = NL_PLAYER_CONFIG[w].label + ' 승리! (' + maxScore + '점)';
  } else {
    const labels = winners.map(function(w) { return NL_PLAYER_CONFIG[w].label; }).join(', ');
    nlResultTitle.textContent  = '동점!';
    nlResultWinner.textContent = labels + ' 공동 1위! (' + maxScore + '점)';
  }

  const headRow = document.createElement('tr');
  headRow.innerHTML = '<th>라운드</th>' +
    Array.from({ length: nlPlayerCount }, function(_, i) {
      return '<th><span class="player-dot" style="background:' + NL_PLAYER_CONFIG[i].dot + '"></span>' + NL_PLAYER_CONFIG[i].label + '</th>';
    }).join('');
  nlResultTableHead.innerHTML = '';
  nlResultTableHead.appendChild(headRow);

  nlResultTableBody.innerHTML = '';
  nlRoundLog.forEach(function(log, idx) {
    const tr = document.createElement('tr');
    let cells = '<td>' + (idx + 1) + '라운드 (' + log.arrowAt + ')</td>';
    for (let i = 0; i < nlPlayerCount; i++) {
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
    nlResultTableBody.appendChild(tr);
  });

  nlTotalRow.innerHTML = '';
  for (let i = 0; i < nlPlayerCount; i++) {
    const cfg   = NL_PLAYER_CONFIG[i];
    const isWin = winners.includes(i) && maxScore > 0;
    const chip  = document.createElement('div');
    chip.className = 'total-chip';
    chip.innerHTML =
      '<span class="chip-dot" style="background:' + cfg.dot + '"></span>' +
      '<span>' + cfg.label + '</span>' +
      '<span class="chip-score" style="color:' + (isWin ? '#2E7D32' : '#555') + '">' + nlScores[i] + '점</span>' +
      (isWin ? '<span style="font-size:1.1rem;">★</span>' : '');
    nlTotalRow.appendChild(chip);
  }

  nlShowScreen(nlResultScreen);
}
