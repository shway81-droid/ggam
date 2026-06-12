/* games/missing-piece/game.js */

'use strict';

// ══════════════════════════════════════════════════════
// SHAPE / COLOR DEFINITIONS
// ══════════════════════════════════════════════════════

var SHAPES = ['circle', 'square', 'triangle'];
var COLORS = {
  red:    '#E53935',
  blue:   '#1E88E5',
  yellow: '#F9A825'
};
var COLOR_KEYS = ['red', 'blue', 'yellow'];

// Korean labels for display / hint
var SHAPE_LABEL = { circle: '원', square: '사각형', triangle: '세모' };
var COLOR_LABEL = { red: '빨강', blue: '파랑', yellow: '노랑' };

// Render an SVG piece for a given shape + color key.
// svgSize: the pixel size of the SVG element (width/height).
function makePieceSVG(shape, colorKey, svgSize) {
  var fill = COLORS[colorKey];
  var s = svgSize || 44;
  var inner = '';
  if (shape === 'circle') {
    inner = '<circle cx="25" cy="25" r="18" fill="' + fill + '"/>';
  } else if (shape === 'square') {
    inner = '<rect x="7" y="7" width="36" height="36" rx="4" fill="' + fill + '"/>';
  } else {
    inner = '<polygon points="25,7 43,43 7,43" fill="' + fill + '"/>';
  }
  return '<svg viewBox="0 0 50 50" width="' + s + '" height="' + s + '" xmlns="http://www.w3.org/2000/svg">' + inner + '</svg>';
}

// ══════════════════════════════════════════════════════
// PATTERN TYPES
// ══════════════════════════════════════════════════════
//
// We have two pattern types (simpler for elementary):
//   'color-row'  : each row = same color, columns = all 3 shapes
//   'shape-col'  : each column = same shape, rows = all 3 colors
//
// The 3x3 grid is stored as grid[row][col] = { shape, colorKey }
// missingRow / missingCol point to the empty cell.

function generateColorRowPattern() {
  // Rows get their own color (shuffled), columns = circle/square/triangle
  var rowColors = shuffle(COLOR_KEYS.slice());   // 3 colors, one per row
  var colShapes = shuffle(SHAPES.slice());        // 3 shapes, one per col

  var grid = [];
  for (var r = 0; r < 3; r++) {
    var row = [];
    for (var c = 0; c < 3; c++) {
      row.push({ shape: colShapes[c], colorKey: rowColors[r] });
    }
    grid.push(row);
  }

  // Pick a random missing cell
  var missingRow = Math.floor(Math.random() * 3);
  var missingCol = Math.floor(Math.random() * 3);
  var answer = grid[missingRow][missingCol];

  return {
    grid: grid,
    missingRow: missingRow,
    missingCol: missingCol,
    answer: answer,
    hintText: '각 행의 색깔이 같아요!'
  };
}

function generateShapeColPattern() {
  // Cols get their own shape (shuffled), rows = all 3 colors (shuffled)
  var colShapes = shuffle(SHAPES.slice());
  var rowColors = shuffle(COLOR_KEYS.slice());

  var grid = [];
  for (var r = 0; r < 3; r++) {
    var row = [];
    for (var c = 0; c < 3; c++) {
      row.push({ shape: colShapes[c], colorKey: rowColors[r] });
    }
    grid.push(row);
  }

  var missingRow = Math.floor(Math.random() * 3);
  var missingCol = Math.floor(Math.random() * 3);
  var answer = grid[missingRow][missingCol];

  return {
    grid: grid,
    missingRow: missingRow,
    missingCol: missingCol,
    answer: answer,
    hintText: '각 열의 모양이 같아요!'
  };
}

function generatePattern() {
  if (Math.random() < 0.5) {
    return generateColorRowPattern();
  } else {
    return generateShapeColPattern();
  }
}

// ══════════════════════════════════════════════════════
// WRONG ANSWER GENERATION
// ══════════════════════════════════════════════════════
//
// Generate 3 wrong pieces (distinct from each other and from correct).
// Strategy: vary color or shape of the correct piece to get plausible distractors.

function generateWrongPieces(answer) {
  var all = [];
  SHAPES.forEach(function(sh) {
    COLOR_KEYS.forEach(function(ck) {
      if (sh !== answer.shape || ck !== answer.colorKey) {
        all.push({ shape: sh, colorKey: ck });
      }
    });
  });

  // Prefer distractors that share one attribute with correct (harder)
  var oneOff = all.filter(function(p) {
    return (p.shape === answer.shape) !== (p.colorKey === answer.colorKey);
  });
  var other  = all.filter(function(p) {
    return p.shape !== answer.shape && p.colorKey !== answer.colorKey;
  });

  var pool = shuffle(oneOff).slice(0, 3);
  if (pool.length < 3) {
    pool = pool.concat(shuffle(other).slice(0, 3 - pool.length));
  }
  return pool.slice(0, 3);
}

// ══════════════════════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════════════════════

var TOTAL_ROUNDS = 10;

var PLAYER_CONFIG = [
  { label: 'P1', hex: '#00BCD4', bgTint: 'rgba(0,188,212,0.14)' },
  { label: 'P2', hex: '#FF5722', bgTint: 'rgba(255,87,34,0.14)'  },
  { label: 'P3', hex: '#9C27B0', bgTint: 'rgba(156,39,176,0.14)' },
  { label: 'P4', hex: '#4CAF50', bgTint: 'rgba(76,175,80,0.14)'  },
];

// ══════════════════════════════════════════════════════
// SOUND
// ══════════════════════════════════════════════════════

var sound = createSoundManager({
  ding: function(ctx) {
    [523, 659, 784].forEach(function(freq, i) {
      var osc  = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      var t = ctx.currentTime + i * 0.1;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.start(t);
      osc.stop(t + 0.35);
    });
  },
  buzz: function(ctx) {
    var osc  = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, ctx.currentTime);
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.35);
  },
  fanfare: function(ctx) {
    [392, 523, 659, 784, 1047].forEach(function(freq, i) {
      var osc  = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'triangle';
      var t = ctx.currentTime + i * 0.13;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.28, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      osc.start(t);
      osc.stop(t + 0.4);
    });
  },
  tick: function(ctx) {
    var osc  = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(900, ctx.currentTime);
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.1);
  }
});

// ══════════════════════════════════════════════════════
// STATE
// ══════════════════════════════════════════════════════

var playerCount    = 2;
var currentRound   = 0;
var scores         = [];
var phase          = 'idle';    // idle | active | resolved
var currentPattern = null;      // { grid, missingRow, missingCol, answer, hintText }
var roundDQ        = [];
var roundResolved  = false;
var nextRoundTimer = null;
var gameActive     = false;

// ══════════════════════════════════════════════════════
// DOM REFS
// ══════════════════════════════════════════════════════

var introScreen      = document.getElementById('introScreen');
var countdownScreen  = document.getElementById('countdownScreen');
var countdownNumber  = document.getElementById('countdownNumber');
var gameScreen       = document.getElementById('gameScreen');
var resultScreen     = document.getElementById('resultScreen');
var backBtn          = document.getElementById('backBtn');
var playBtn          = document.getElementById('playBtn');
var closeBtn         = document.getElementById('closeBtn');
var retryBtn         = document.getElementById('retryBtn');
var homeBtn          = document.getElementById('homeBtn');
var soundToggleIntro = document.getElementById('soundToggleIntro');
var zonesWrap        = document.getElementById('zonesWrap');
var roundBadge       = document.getElementById('roundBadge');
var patternGrid      = document.getElementById('patternGrid');
var patternHint      = document.getElementById('patternHint');
var roundStatus      = document.getElementById('roundStatus');
var resultTitle      = document.getElementById('resultTitle');
var resultWinner     = document.getElementById('resultWinner');
var resultScoresWrap = document.getElementById('resultScoresWrap');

// ══════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════

function showScreen(el) {
  [introScreen, countdownScreen, gameScreen, resultScreen].forEach(function(s) {
    s.classList.remove('active');
  });
  el.classList.add('active');
}

var countdownInterval = null;
function startCountdown(onDone) {
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
      countdownNumber.offsetHeight;
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

function isDQ(idx) { return roundDQ.indexOf(idx) !== -1; }
function setDQ(idx) { if (!isDQ(idx)) roundDQ.push(idx); }

function updateSoundToggle() {
  soundToggleIntro.textContent = sound.isMuted() ? '🔇' : '🔊';
}

function clearNextRoundTimer() {
  if (nextRoundTimer !== null) {
    clearTimeout(nextRoundTimer);
    nextRoundTimer = null;
  }
}

function cleanup() {
  if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
  gameActive = false;
  clearNextRoundTimer();
}

// ══════════════════════════════════════════════════════
// SOUND TOGGLE
// ══════════════════════════════════════════════════════

onTap(soundToggleIntro, function() {
  sound.toggleMute();
  updateSoundToggle();
});
updateSoundToggle();

// ══════════════════════════════════════════════════════
// PLAYER COUNT SELECT
// ══════════════════════════════════════════════════════

document.querySelectorAll('.player-btn').forEach(function(btn) {
  onTap(btn, function() {
    document.querySelectorAll('.player-btn').forEach(function(b) {
      b.classList.remove('active');
    });
    btn.classList.add('active');
    playerCount = parseInt(btn.getAttribute('data-count'), 10);
  });
});

// ══════════════════════════════════════════════════════
// NAV BUTTONS
// ══════════════════════════════════════════════════════

onTap(backBtn,  function() { cleanup(); goHome(); });
onTap(playBtn,  function() { startCountdown(function() { startGame(); }); });
onTap(closeBtn, function() { cleanup(); goHome(); });
onTap(retryBtn, function() { startCountdown(function() { startGame(); }); });
onTap(homeBtn,  function() { cleanup(); goHome(); });

// ══════════════════════════════════════════════════════
// ZONE BUILDING
// ══════════════════════════════════════════════════════

function buildZones() {
  zonesWrap.innerHTML = '';
  zonesWrap.className = 'zones-wrap p' + playerCount;

  for (var i = 0; i < playerCount; i++) {
    var cfg  = PLAYER_CONFIG[i];
    var zone = document.createElement('div');
    zone.className = 'zone state-idle';
    zone.dataset.player = i;
    zone.style.background = cfg.bgTint;

    // Header
    var header = document.createElement('div');
    header.className = 'zone-header';

    var label = document.createElement('div');
    label.className = 'zone-label';
    label.style.color = cfg.hex;
    label.textContent = cfg.label;

    var scoreEl = document.createElement('div');
    scoreEl.className = 'zone-score';
    scoreEl.setAttribute('data-score-for', i);
    scoreEl.textContent = '0점';
    scoreEl.style.color = cfg.hex;

    header.appendChild(label);
    header.appendChild(scoreEl);

    // 2x2 answer grid
    var grid = document.createElement('div');
    grid.className = 'answer-grid';
    grid.setAttribute('data-grid-for', i);

    zone.appendChild(header);
    zone.appendChild(grid);
    zonesWrap.appendChild(zone);
  }
}

function getZone(idx) {
  return zonesWrap.querySelector('.zone[data-player="' + idx + '"]');
}

function updateZoneScore(idx) {
  var el = zonesWrap.querySelector('[data-score-for="' + idx + '"]');
  if (el) el.textContent = scores[idx] + '점';
}

// ══════════════════════════════════════════════════════
// POPULATE ANSWER BUTTONS
// ══════════════════════════════════════════════════════

function populateAnswerGrid(playerIdx, answers) {
  // answers: array of 4 pieces { shape, colorKey }, shuffled with 1 correct
  var grid = zonesWrap.querySelector('[data-grid-for="' + playerIdx + '"]');
  if (!grid) return;
  grid.innerHTML = '';

  answers.forEach(function(piece) {
    var btn = document.createElement('div');
    btn.className = 'answer-btn';
    btn.setAttribute('role', 'button');
    btn.setAttribute('aria-label', COLOR_LABEL[piece.colorKey] + ' ' + SHAPE_LABEL[piece.shape]);
    btn.innerHTML = makePieceSVG(piece.shape, piece.colorKey, 48);

    onTap(btn, function(e) {
      e.stopPropagation();
      handleAnswerTap(playerIdx, piece, btn, e);
    });

    grid.appendChild(btn);
  });
}

// ══════════════════════════════════════════════════════
// PATTERN GRID RENDERING (CENTER)
// ══════════════════════════════════════════════════════

function renderPatternGrid(pattern) {
  patternGrid.innerHTML = '';
  for (var r = 0; r < 3; r++) {
    for (var c = 0; c < 3; c++) {
      var cell = document.createElement('div');
      cell.className = 'pattern-cell';
      if (r === pattern.missingRow && c === pattern.missingCol) {
        cell.classList.add('missing');
        var q = document.createElement('span');
        q.className = 'missing-q';
        q.textContent = '?';
        cell.appendChild(q);
      } else {
        var piece = pattern.grid[r][c];
        cell.innerHTML = makePieceSVG(piece.shape, piece.colorKey, 38);
      }
      patternGrid.appendChild(cell);
    }
  }
  patternHint.textContent = pattern.hintText;
}

function showReadyPattern() {
  patternGrid.innerHTML = '';
  for (var i = 0; i < 9; i++) {
    var cell = document.createElement('div');
    cell.className = 'pattern-cell';
    patternGrid.appendChild(cell);
  }
  patternHint.textContent = '준비...';
}

// ══════════════════════════════════════════════════════
// RIPPLE
// ══════════════════════════════════════════════════════

function spawnRipple(zone, e) {
  var rect = zone.getBoundingClientRect();
  var src  = (e.touches && e.touches[0]) ? e.touches[0] : e;
  var x = (src ? src.clientX : rect.left + rect.width  / 2) - rect.left;
  var y = (src ? src.clientY : rect.top  + rect.height / 2) - rect.top;
  var size = Math.max(rect.width, rect.height);
  var r = document.createElement('span');
  r.className = 'zone-ripple';
  r.style.left       = x + 'px';
  r.style.top        = y + 'px';
  r.style.width      = size + 'px';
  r.style.height     = size + 'px';
  r.style.marginLeft = (-size / 2) + 'px';
  r.style.marginTop  = (-size / 2) + 'px';
  zone.appendChild(r);
  r.addEventListener('animationend', function() { r.remove(); });
}

// ══════════════════════════════════════════════════════
// TAP HANDLER
// ══════════════════════════════════════════════════════

function piecesMatch(a, b) {
  return a.shape === b.shape && a.colorKey === b.colorKey;
}

function handleAnswerTap(playerIdx, piece, btn, e) {
  if (phase !== 'active') return;
  if (isDQ(playerIdx))    return;
  if (roundResolved)      return;

  var zone = getZone(playerIdx);
  spawnRipple(zone, e);

  var isCorrect = piecesMatch(piece, currentPattern.answer);

  if (isCorrect) {
    roundResolved = true;
    phase = 'resolved';
    sound.play('ding');

    scores[playerIdx]++;
    updateZoneScore(playerIdx);

    btn.classList.add('ans-correct-flash');

    // Reveal the missing cell in the pattern grid
    revealMissingCell(currentPattern);

    zone.classList.remove('state-idle', 'state-active', 'state-dq', 'state-wrong');
    zone.classList.add('state-correct');

    for (var i = 0; i < playerCount; i++) {
      if (i === playerIdx) continue;
      var z = getZone(i);
      if (z && !isDQ(i)) {
        z.classList.remove('state-active');
        z.classList.add('state-idle');
      }
    }

    var cfg = PLAYER_CONFIG[playerIdx];
    roundStatus.textContent = cfg.label + ' 정답! +1점';
    roundStatus.className   = 'round-status correct';

    scheduleNextOrEnd();

  } else {
    sound.play('buzz');
    setDQ(playerIdx);

    // Deduct 1 point (floor at 0)
    scores[playerIdx] = Math.max(0, scores[playerIdx] - 1);
    updateZoneScore(playerIdx);

    // Show "-1" flash
    var penalty = document.createElement('div');
    penalty.className = 'penalty-flash';
    penalty.textContent = '-1';
    zone.style.position = 'relative';
    zone.appendChild(penalty);
    penalty.addEventListener('animationend', function() { penalty.remove(); });

    btn.classList.add('ans-wrong-flash');
    setTimeout(function() {
      if (gameActive) btn.classList.remove('ans-wrong-flash');
    }, 400);

    zone.classList.remove('state-active', 'state-correct', 'state-idle');
    zone.classList.add('state-dq', 'state-wrong');
    setTimeout(function() {
      if (gameActive) zone.classList.remove('state-wrong');
    }, 420);

    roundStatus.textContent = PLAYER_CONFIG[playerIdx].label + ' 오답! 실격 -1점';
    roundStatus.className   = 'round-status wrong';

    setTimeout(function() {
      if (gameActive && phase === 'active') {
        roundStatus.textContent = '';
        roundStatus.className   = 'round-status';
      }
    }, 900);

    // Check if all DQ'd
    var allOut = true;
    for (var j = 0; j < playerCount; j++) {
      if (!isDQ(j)) { allOut = false; break; }
    }
    if (allOut) {
      roundResolved = true;
      phase = 'resolved';
      roundStatus.textContent = '전원 실격 — 다음 라운드';
      roundStatus.className   = 'round-status wrong';
      scheduleNextOrEnd();
    }
  }
}

// Reveal the missing cell after someone gets it right
function revealMissingCell(pattern) {
  var cells = patternGrid.querySelectorAll('.pattern-cell');
  var idx = pattern.missingRow * 3 + pattern.missingCol;
  var cell = cells[idx];
  if (!cell) return;
  cell.classList.remove('missing');
  cell.innerHTML = makePieceSVG(pattern.answer.shape, pattern.answer.colorKey, 38);
}

// ══════════════════════════════════════════════════════
// GAME FLOW
// ══════════════════════════════════════════════════════

function startGame() {
  cleanup();
  gameActive = true;

  scores = [];
  for (var i = 0; i < playerCount; i++) { scores.push(0); }
  currentRound  = 0;
  roundResolved = false;
  roundDQ       = [];
  phase         = 'idle';
  currentPattern = null;

  showScreen(gameScreen);
  buildZones();

  nextRoundTimer = setTimeout(function() {
    nextRoundTimer = null;
    nextRound();
  }, 300);
}

function nextRound() {
  currentRound++;
  roundDQ        = [];
  roundResolved  = false;
  phase          = 'idle';
  currentPattern = null;

  roundBadge.textContent  = currentRound + ' / ' + TOTAL_ROUNDS;
  roundStatus.textContent = '준비...';
  roundStatus.className   = 'round-status';

  // Show empty grid while loading
  showReadyPattern();

  // Reset all zones
  for (var i = 0; i < playerCount; i++) {
    var z = getZone(i);
    if (z) {
      z.className = 'zone state-idle';
      z.style.background = PLAYER_CONFIG[i].bgTint;
      var g = z.querySelector('.answer-grid');
      if (g) g.innerHTML = '';
    }
  }

  sound.play('tick');

  nextRoundTimer = setTimeout(function() {
    nextRoundTimer = null;
    if (!gameActive) return;

    // Generate pattern
    currentPattern = generatePattern();

    // Render center pattern grid
    renderPatternGrid(currentPattern);

    roundStatus.textContent = '';
    roundStatus.className   = 'round-status';

    // Build answer sets for each player (same choices, independently shuffled)
    for (var p = 0; p < playerCount; p++) {
      var wrongs  = generateWrongPieces(currentPattern.answer);
      var choices = shuffle([currentPattern.answer].concat(wrongs));
      populateAnswerGrid(p, choices);

      var zone = getZone(p);
      if (zone) {
        zone.classList.remove('state-idle', 'state-correct', 'state-wrong', 'state-dq');
        zone.classList.add('state-active');
      }
    }

    phase = 'active';
  }, 700);
}

function scheduleNextOrEnd() {
  clearNextRoundTimer();
  nextRoundTimer = setTimeout(function() {
    nextRoundTimer = null;
    if (currentRound >= TOTAL_ROUNDS) {
      showResult();
    } else {
      nextRound();
    }
  }, 1800);
}

// ══════════════════════════════════════════════════════
// RESULT SCREEN
// ══════════════════════════════════════════════════════

function showResult() {
  cleanup();
  sound.play('fanfare');

  var maxScore = 0;
  for (var i = 0; i < playerCount; i++) {
    if (scores[i] > maxScore) maxScore = scores[i];
  }
  var winners = [];
  for (var j = 0; j < playerCount; j++) {
    if (scores[j] === maxScore) winners.push(j);
  }

  resultTitle.textContent = '게임 종료!';

  if (winners.length === 1) {
    var cfg = PLAYER_CONFIG[winners[0]];
    resultWinner.textContent = cfg.label + ' 최종 우승!';
    resultWinner.style.color = cfg.hex;
  } else {
    resultWinner.textContent = '공동 우승: ' + winners.map(function(w) {
      return PLAYER_CONFIG[w].label;
    }).join(', ');
    resultWinner.style.color = '#7E57C2';
  }

  // Sort players by score descending
  var order = [];
  for (var k = 0; k < playerCount; k++) { order.push(k); }
  order.sort(function(a, b) { return scores[b] - scores[a]; });

  resultScoresWrap.innerHTML = '';
  order.forEach(function(p, rank) {
    var row = document.createElement('div');
    row.className = 'result-score-row' + (scores[p] === maxScore ? ' winner-row' : '');

    var rankEl = document.createElement('span');
    rankEl.className = 'result-score-rank';
    // Use text ranks, avoid emoji per spec
    rankEl.textContent = rank === 0 ? '1위' : (rank === 1 ? '2위' : (rank === 2 ? '3위' : (rank + 1) + '위'));

    var dot = document.createElement('span');
    dot.className = 'result-score-dot';
    dot.style.background = PLAYER_CONFIG[p].hex;

    var name = document.createElement('span');
    name.className = 'result-score-name';
    name.textContent = PLAYER_CONFIG[p].label;

    var pts = document.createElement('span');
    pts.className = 'result-score-pts';
    pts.textContent = scores[p] + '점';

    row.appendChild(rankEl);
    row.appendChild(dot);
    row.appendChild(name);
    row.appendChild(pts);
    resultScoresWrap.appendChild(row);
  });

  showScreen(resultScreen);
}
