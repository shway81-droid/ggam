/* games/feature-hunt/game.js */

'use strict';

// ── Constants ────────────────────────────────────────────────
const TOTAL_ROUNDS    = 8;
const ROUND_TIME      = 12;   // seconds per round
const GRID_COLS       = 4;
const GRID_ROWS       = 3;
const GRID_SIZE       = GRID_COLS * GRID_ROWS; // 12
const RESULT_PAUSE_MS = getAutoplayPauseMs(2000);

// Player config
const PLAYER_CONFIG = [
  { label: 'P1', dot: '#0288D1', cls: 'p1' },
  { label: 'P2', dot: '#E53935', cls: 'p2' },
  { label: 'P3', dot: '#388E3C', cls: 'p3' },
  { label: 'P4', dot: '#F57C00', cls: 'p4' },
];

// ── Shape & Color definitions ─────────────────────────────────
const SHAPES = ['circle', 'square', 'star', 'triangle'];
const COLORS = ['red', 'yellow', 'blue', 'green'];
const COLOR_LABELS = { red: '빨간', yellow: '노란', blue: '파란', green: '초록' };
const SHAPE_LABELS = { circle: '원', square: '네모', star: '별', triangle: '삼각형' };

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
var playerCount   = 2;
var roundIdx      = 0;
var scores        = [];
var roundLog      = [];
// roundLog entry: { condition, answerIdx, winnerIdx, dqPlayers[], timedOut }
var currentRound  = null;
// currentRound: { cells[12], condition, answerIdx }
//   cells[i]: { shape, color, bordered }
//   condition: { shape, color, bordered (null for rounds 1-6) }
var dqSet         = new Set();
var phase         = 'idle';
var timerHandle   = null;
var nextHandle    = null;
var timeRemaining = ROUND_TIME;
var gameRounds    = [];
var countdownInterval = null;

// ── DOM refs ─────────────────────────────────────────────────
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
var condPanel       = document.getElementById('condPanel');
var condText        = document.getElementById('condText');

var soundToggleIntro = document.getElementById('soundToggleIntro');
var introIllust      = document.getElementById('introIllust');

var resultTitle      = document.getElementById('resultTitle');
var resultWinner     = document.getElementById('resultWinner');
var resultTableHead  = document.getElementById('resultTableHead');
var resultTableBody  = document.getElementById('resultTableBody');
var totalRow         = document.getElementById('totalRow');

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

function randInt(n) {
  return Math.floor(Math.random() * n);
}

function randItem(arr) {
  return arr[randInt(arr.length)];
}

function clearTimers() {
  if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
  if (timerHandle) { clearInterval(timerHandle); timerHandle = null; }
  if (nextHandle)  { clearTimeout(nextHandle);   nextHandle  = null; }
}

function updateSoundBtn(btn) {
  btn.textContent = sound.isMuted() ? '🔇' : '🔊';
}

// ── Shape HTML builder ────────────────────────────────────────
function makeShapeEl(shape, color, bordered, sizeClass) {
  var el = document.createElement('div');
  var cls = 'shape shape-' + shape + ' shape-' + color;
  if (bordered) cls += ' shape-bordered';
  if (sizeClass) cls += ' ' + sizeClass;
  el.className = cls;
  return el;
}

// ── Condition text builder ────────────────────────────────────
function conditionLabel(cond) {
  var parts = [];
  if (cond.color) parts.push(COLOR_LABELS[cond.color]);
  if (cond.shape) parts.push(SHAPE_LABELS[cond.shape]);
  if (cond.bordered === true)  parts.push('(테두리 있음)');
  if (cond.bordered === false) parts.push('(테두리 없음)');
  return parts.join(' ');
}

// ── Render condition panel ────────────────────────────────────
function renderCondPanel(cond) {
  // Text label
  condText.innerHTML = '';
  var label = document.createElement('span');
  label.className = 'cond-label';
  label.textContent = conditionLabel(cond);
  condText.appendChild(label);

  // Shape preview (always show in cond-shape-wrap)
  var wrap = document.createElement('div');
  wrap.className = 'cond-shape-wrap';
  var shape = makeShapeEl(
    cond.shape || 'circle',
    cond.color || 'red',
    cond.bordered === true,
    null
  );
  shape.style.width = '28px';
  shape.style.height = '28px';
  wrap.appendChild(shape);
  condText.appendChild(wrap);
}

// ── Cell matching ─────────────────────────────────────────────
function cellMatches(cell, cond) {
  if (cond.shape !== null && cell.shape !== cond.shape) return false;
  if (cond.color !== null && cell.color !== cond.color) return false;
  if (cond.bordered !== null && cell.bordered !== cond.bordered) return false;
  return true;
}

// ── Round generation ──────────────────────────────────────────
// Difficulty tiers:
//   1-3: color+shape, grid has exactly 1 match, decoys differ in at least one attribute
//   4-6: color+shape, increased decoys (same color/diff shape, same shape/diff color)
//   7-8: color+shape+bordered, exactly 1 match

function makeTier(tier) {
  // Pick the condition
  var condShape  = randItem(SHAPES);
  var condColor  = randItem(COLORS);
  var condBorder = (tier === 3) ? (Math.random() < 0.5) : null;

  var cond = {
    shape:    condShape,
    color:    condColor,
    bordered: condBorder,
  };

  // Try to generate a valid grid (exactly 1 match)
  for (var attempt = 0; attempt < 100; attempt++) {
    var cells = buildGrid(cond, tier);
    var matchCount = 0;
    for (var i = 0; i < cells.length; i++) {
      if (cellMatches(cells[i], cond)) matchCount++;
    }
    if (matchCount === 1) {
      var answerIdx = -1;
      for (var j = 0; j < cells.length; j++) {
        if (cellMatches(cells[j], cond)) { answerIdx = j; break; }
      }
      return { cells: cells, condition: cond, answerIdx: answerIdx };
    }
  }

  // Fallback: construct grid manually with exactly 1 match
  return buildGridForced(cond, tier);
}

function buildGrid(cond, tier) {
  var cells = [];
  var answerPlaced = false;
  var answerPos = randInt(GRID_SIZE);

  for (var i = 0; i < GRID_SIZE; i++) {
    if (i === answerPos) {
      // Place the answer cell
      cells.push({
        shape:    cond.shape,
        color:    cond.color,
        bordered: (cond.bordered !== null) ? cond.bordered : false,
      });
      answerPlaced = true;
    } else {
      cells.push(makeDecoy(cond, tier));
    }
  }
  return cells;
}

function makeDecoy(cond, tier) {
  // Decoy must NOT match all condition attributes
  for (var attempt = 0; attempt < 50; attempt++) {
    var shape, color, bordered;

    if (tier === 1) {
      // Tier 1: random shape/color that doesn't fully match
      shape   = randItem(SHAPES);
      color   = randItem(COLORS);
      bordered = false;
    } else if (tier === 2) {
      // Tier 2: increased decoys — same color/diff shape OR same shape/diff color
      var r = Math.random();
      if (r < 0.35) {
        // same color, different shape
        color  = cond.color;
        shape  = randItem(SHAPES.filter(function(s) { return s !== cond.shape; }));
      } else if (r < 0.7) {
        // same shape, different color
        shape  = cond.shape;
        color  = randItem(COLORS.filter(function(c) { return c !== cond.color; }));
      } else {
        // fully different
        shape  = randItem(SHAPES.filter(function(s) { return s !== cond.shape; }));
        color  = randItem(COLORS.filter(function(c) { return c !== cond.color; }));
      }
      bordered = false;
    } else {
      // Tier 3: color+shape+border
      var r2 = Math.random();
      if (r2 < 0.25) {
        // same color, same shape, different border
        color    = cond.color;
        shape    = cond.shape;
        bordered = !cond.bordered;
      } else if (r2 < 0.5) {
        // same color, different shape, any border
        color    = cond.color;
        shape    = randItem(SHAPES.filter(function(s) { return s !== cond.shape; }));
        bordered = (Math.random() < 0.5);
      } else if (r2 < 0.75) {
        // different color, same shape, any border
        color    = randItem(COLORS.filter(function(c) { return c !== cond.color; }));
        shape    = cond.shape;
        bordered = (Math.random() < 0.5);
      } else {
        color    = randItem(COLORS);
        shape    = randItem(SHAPES);
        bordered = (Math.random() < 0.5);
      }
    }

    var cell = { shape: shape, color: color, bordered: bordered || false };

    // Check that this cell does NOT match the condition
    if (!cellMatches(cell, cond)) {
      return cell;
    }
  }

  // Fallback: pick a shape/color that definitely doesn't match
  var safeShape = SHAPES.filter(function(s) { return s !== cond.shape; })[0];
  var safeColor = COLORS.filter(function(c) { return c !== cond.color; })[0];
  return { shape: safeShape, color: safeColor, bordered: false };
}

function buildGridForced(cond, tier) {
  // Place exactly one answer cell, fill rest with guaranteed non-matching decoys
  var cells = [];
  var answerPos = randInt(GRID_SIZE);
  for (var i = 0; i < GRID_SIZE; i++) {
    if (i === answerPos) {
      cells.push({
        shape:    cond.shape,
        color:    cond.color,
        bordered: (cond.bordered !== null) ? cond.bordered : false,
      });
    } else {
      // Always use a guaranteed non-matching cell
      var safeShape = SHAPES.filter(function(s) { return s !== cond.shape; })[0];
      var safeColor = COLORS.filter(function(c) { return c !== cond.color; })[0];
      cells.push({ shape: safeShape, color: safeColor, bordered: false });
    }
  }
  return { cells: cells, condition: cond, answerIdx: answerPos };
}

// Tier plan for 8 rounds: 1~3 => tier1, 4~6 => tier2, 7~8 => tier3
var TIER_PLAN = [1, 1, 1, 2, 2, 2, 3, 3];

function buildGameRounds() {
  var rounds = [];
  for (var i = 0; i < TOTAL_ROUNDS; i++) {
    rounds.push(makeTier(TIER_PLAN[i]));
  }
  return rounds;
}

// ── Intro illustration ───────────────────────────────────────
function renderIntroIllust() {
  introIllust.innerHTML = '<svg viewBox="0 0 220 130" xmlns="http://www.w3.org/2000/svg">' +
    '<rect x="6" y="6" width="208" height="118" rx="16" fill="#FFF8E1" stroke="#2C2C2C" stroke-width="3"/>' +
    '<circle cx="50" cy="65" r="22" fill="#1E88E5" stroke="#2C2C2C" stroke-width="2"/>' +
    '<rect x="80" y="44" width="40" height="40" rx="4" fill="#43A047" stroke="#2C2C2C" stroke-width="2"/>' +
    '<polygon points="160,44 180,84 140,84" fill="#FDD835" stroke="#2C2C2C" stroke-width="2"/>' +
    '<circle cx="50" cy="65" r="22" fill="none" stroke="#5C6BC0" stroke-width="4" stroke-dasharray="5 4"/>' +
    '<text x="110" y="24" text-anchor="middle" font-size="11" font-weight="900" fill="#E53935">찾아라!</text>' +
    '<text x="50" y="110" text-anchor="middle" font-size="10" font-weight="700" fill="#5C6BC0">파란 원</text>' +
  '</svg>';
}
renderIntroIllust();

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

    // Hint
    var hint = document.createElement('div');
    hint.className = 'zone-hint';
    hint.textContent = '조건에 맞는 도형을 터치!';

    // 4×3 feature grid
    var grid = document.createElement('div');
    grid.className = 'feat-grid';
    grid.id = 'feat-grid-' + i;

    for (var p = 0; p < GRID_SIZE; p++) {
      var btn = document.createElement('button');
      btn.className = 'feat-btn';
      btn.dataset.player = String(i);
      btn.dataset.pos    = String(p);
      btn.setAttribute('aria-label', cfg.label + ' ' + (Math.floor(p / GRID_COLS) + 1) + '행 ' + (p % GRID_COLS + 1) + '열');
      (function(playerIdx, pos, b) {
        onTap(b, function() { handleFeatTap(playerIdx, pos, b); });
      })(i, p, btn);
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

function getFeatBtns(playerIdx) {
  var grid = document.getElementById('feat-grid-' + playerIdx);
  return grid ? Array.from(grid.querySelectorAll('.feat-btn')) : [];
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

// ── Render shape cells in grid ────────────────────────────────
function renderGridShapes(playerIdx) {
  var btns = getFeatBtns(playerIdx);
  btns.forEach(function(btn, p) {
    btn.innerHTML = '';
    var cell = currentRound.cells[p];
    var el = makeShapeEl(cell.shape, cell.color, cell.bordered, null);
    el.style.width  = 'clamp(14px, 5vw, 26px)';
    el.style.height = 'clamp(14px, 5vw, 26px)';
    btn.appendChild(el);
  });
}

// ── Reset zone buttons for new round ─────────────────────────
function resetBtnsForRound() {
  for (var i = 0; i < playerCount; i++) {
    renderGridShapes(i);
    getFeatBtns(i).forEach(function(btn) {
      btn.className = 'feat-btn';
      btn.disabled  = false;
    });
    var zone = getZone(i);
    if (zone) zone.classList.remove('dq-zone');
  }
}

function disablePlayerBtns(playerIdx) {
  getFeatBtns(playerIdx).forEach(function(b) {
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

// ── Tap handler ───────────────────────────────────────────────
function handleFeatTap(playerIdx, pos, btn) {
  if (phase !== 'active') return;
  if (dqSet.has(playerIdx)) return;

  if (pos === currentRound.answerIdx) {
    resolveRound(playerIdx);
  } else {
    // Wrong tap: player is disqualified for this round
    sound.play('buzz');
    btn.classList.add('state-wrong');
    btn.disabled = true;

    dqSet.add(playerIdx);

    var zone = getZone(playerIdx);
    var flash = document.createElement('div');
    flash.className = 'penalty-flash';
    flash.textContent = '실격!';
    zone.appendChild(flash);
    flash.addEventListener('animationend', function() { flash.remove(); });

    disablePlayerBtns(playerIdx);
    zone.classList.add('dq-zone');

    // Check if everyone is disqualified
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

  // Mark correct button
  getFeatBtns(winnerIdx).forEach(function(b) {
    var p = parseInt(b.dataset.pos, 10);
    if (p === currentRound.answerIdx) {
      b.classList.add('state-correct');
    } else {
      b.classList.add('state-disabled');
      b.disabled = true;
    }
  });

  // Disable other players
  for (var i = 0; i < playerCount; i++) {
    if (i !== winnerIdx) disablePlayerBtns(i);
  }

  var winnerLabel = PLAYER_CONFIG[winnerIdx].label;
  problemStatus.textContent = winnerLabel + ' 정답!';

  roundLog.push({
    condition:  currentRound.condition,
    answerIdx:  currentRound.answerIdx,
    winnerIdx:  winnerIdx,
    dqPlayers:  Array.from(dqSet),
    timedOut:   false,
  });

  nextHandle = setTimeout(function() { nextRound(); }, RESULT_PAUSE_MS);
}

// ── Timeout / all disqualified ────────────────────────────────
function handleTimeout() {
  phase = 'done';
  clearTimers();
  sound.play('timeout');

  // Reveal answer for all zones
  for (var i = 0; i < playerCount; i++) {
    getFeatBtns(i).forEach(function(b) {
      var p = parseInt(b.dataset.pos, 10);
      if (p === currentRound.answerIdx) {
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

  problemStatus.textContent = '시간 초과! 정답: ' + conditionLabel(currentRound.condition);

  roundLog.push({
    condition:  currentRound.condition,
    answerIdx:  currentRound.answerIdx,
    winnerIdx:  -1,
    dqPlayers:  Array.from(dqSet),
    timedOut:   true,
  });

  nextHandle = setTimeout(function() { nextRound(); }, RESULT_PAUSE_MS);
}

// ── Load round ───────────────────────────────────────────────
function loadRound() {
  phase        = 'active';
  currentRound = gameRounds[roundIdx];
  dqSet        = new Set();

  questionCounter.textContent = (roundIdx + 1) + ' / ' + TOTAL_ROUNDS;
  problemStatus.textContent = '';
  problemTimer.classList.remove('urgent');

  renderCondPanel(currentRound.condition);
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
  headRow.innerHTML = '<th>라운드</th>' +
    Array.from({ length: playerCount }, function(_, i) {
      return '<th><span class="player-dot" style="background:' + PLAYER_CONFIG[i].dot + '"></span>' + PLAYER_CONFIG[i].label + '</th>';
    }).join('');
  resultTableHead.innerHTML = '';
  resultTableHead.appendChild(headRow);

  // Build table body
  resultTableBody.innerHTML = '';
  roundLog.forEach(function(log, idx) {
    var tr = document.createElement('tr');
    var condStr = conditionLabel(log.condition);
    var cells = '<td style="text-align:left;font-size:0.82rem;">' +
      (idx + 1) + '. <span class="cell-round-cond">' + condStr + '</span>' +
      '</td>';

    for (var i = 0; i < playerCount; i++) {
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
  for (var i = 0; i < playerCount; i++) {
    var cfg   = PLAYER_CONFIG[i];
    var isWin = winners.indexOf(i) !== -1 && maxScore > 0;
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
