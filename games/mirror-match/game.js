/* games/mirror-match/game.js */

'use strict';

// ══════════════════════════════════════════════════════
// PATTERN GENERATION
// Each pattern: 3x3 grid of cells, each cell = 0 (empty) | 1 (color A) | 2 (color B)
// The correct mirror = reverse each row (horizontal flip)
// ══════════════════════════════════════════════════════

// Color palette pairs [fillA, strokeA, fillB, strokeB]
var COLOR_PAIRS = [
  ['#EF5350', '#B71C1C', '#26C6DA', '#00838F'],
  ['#FF8A65', '#BF360C', '#42A5F5', '#0D47A1'],
  ['#9C27B0', '#4A148C', '#FFCA28', '#F57F17'],
  ['#66BB6A', '#1B5E20', '#EF5350', '#B71C1C'],
  ['#FF7043', '#BF360C', '#5C6BC0', '#1A237E'],
  ['#26C6DA', '#00838F', '#FF8A65', '#BF360C'],
  ['#EC407A', '#880E4F', '#FFA726', '#E65100'],
  ['#29B6F6', '#01579B', '#EF5350', '#B71C1C'],
];

// 30 hand-crafted 3x3 LEFT-HALF patterns (not symmetric themselves)
// Values: 0=empty, 1=colorA, 2=colorB
var PATTERN_POOL = [
  // Row 0
  [[1,0,1],[0,1,0],[1,1,0]],
  [[1,1,0],[0,1,1],[2,0,1]],
  [[0,1,2],[1,0,1],[2,1,0]],
  [[1,0,0],[1,1,0],[0,1,1]],
  [[2,1,0],[0,0,1],[1,2,1]],
  // Row 1
  [[1,2,1],[0,1,0],[2,0,2]],
  [[0,0,1],[1,1,0],[1,0,1]],
  [[1,1,1],[0,0,1],[2,1,0]],
  [[2,0,1],[1,2,1],[0,1,2]],
  [[1,0,2],[0,1,0],[1,1,2]],
  // Row 2
  [[2,1,1],[0,2,0],[1,0,2]],
  [[1,2,0],[2,0,1],[0,1,2]],
  [[0,1,1],[1,0,2],[2,1,0]],
  [[1,1,2],[0,1,0],[2,0,1]],
  [[2,0,0],[1,1,2],[0,2,1]],
  // Row 3
  [[1,0,2],[2,1,0],[1,2,1]],
  [[0,2,1],[1,0,1],[2,1,0]],
  [[1,1,0],[2,0,2],[0,1,1]],
  [[2,1,2],[0,0,1],[1,2,0]],
  [[0,1,0],[1,2,1],[2,0,2]],
  // Row 4
  [[1,2,1],[2,0,0],[0,1,2]],
  [[0,0,2],[1,1,0],[2,1,1]],
  [[2,1,0],[0,2,1],[1,0,2]],
  [[1,0,1],[2,1,2],[0,2,0]],
  [[0,2,0],[1,0,1],[2,1,2]],
  // Row 5
  [[1,1,2],[0,2,1],[2,0,0]],
  [[2,0,1],[1,1,2],[0,2,1]],
  [[1,2,0],[0,1,2],[2,0,1]],
  [[0,1,2],[2,1,0],[1,2,1]],
  [[2,2,0],[1,0,1],[0,1,2]],
];

// Mirror a 3x3 grid horizontally (reverse each row)
function mirrorGrid(grid) {
  return grid.map(function(row) { return row.slice().reverse(); });
}

// Generate 3 wrong grids that differ from the correct mirror by >= 2 cells
function generateWrongGrids(correctMirror, leftGrid) {
  var wrongs = [];
  var attempts = 0;
  while (wrongs.length < 3 && attempts < 200) {
    attempts++;
    var candidate = makeDistortedGrid(correctMirror);
    // must differ from correct mirror
    if (countDiff(candidate, correctMirror) < 2) continue;
    // must differ from left grid (avoid showing same as left)
    if (countDiff(candidate, leftGrid) === 0) continue;
    // must differ from already-picked wrongs
    var dupFound = false;
    for (var w = 0; w < wrongs.length; w++) {
      if (countDiff(candidate, wrongs[w]) < 2) { dupFound = true; break; }
    }
    if (!dupFound) wrongs.push(candidate);
  }
  // fallback: brute-force unique grids
  while (wrongs.length < 3) {
    wrongs.push(makeRandomGrid());
  }
  return wrongs;
}

function countDiff(a, b) {
  var d = 0;
  for (var r = 0; r < 3; r++) {
    for (var c = 0; c < 3; c++) {
      if (a[r][c] !== b[r][c]) d++;
    }
  }
  return d;
}

function makeDistortedGrid(base) {
  var grid = base.map(function(row) { return row.slice(); });
  // flip 2-4 random cells
  var flips = 2 + Math.floor(Math.random() * 3);
  for (var i = 0; i < flips; i++) {
    var r = Math.floor(Math.random() * 3);
    var c = Math.floor(Math.random() * 3);
    grid[r][c] = (grid[r][c] === 0)
      ? (Math.random() < 0.5 ? 1 : 2)
      : (grid[r][c] === 1 ? (Math.random() < 0.5 ? 0 : 2) : (Math.random() < 0.5 ? 0 : 1));
  }
  return grid;
}

function makeRandomGrid() {
  var g = [];
  for (var r = 0; r < 3; r++) {
    var row = [];
    for (var c = 0; c < 3; c++) {
      row.push(Math.floor(Math.random() * 3)); // 0,1,2
    }
    g.push(row);
  }
  return g;
}

// ══════════════════════════════════════════════════════
// SVG RENDERING
// ══════════════════════════════════════════════════════

// Render a 3x3 grid as SVG (viewBox determined by caller)
// cellSize, gap, x0, y0 are in SVG units
// Returns SVG elements string (no <svg> wrapper)
function renderGrid3x3(grid, colorPair, cellSize, gap, x0, y0) {
  var fillA = colorPair[0], strokeA = colorPair[1];
  var fillB = colorPair[2], strokeB = colorPair[3];
  var out = '';
  for (var r = 0; r < 3; r++) {
    for (var c = 0; c < 3; c++) {
      var v  = grid[r][c];
      var cx = x0 + c * (cellSize + gap);
      var cy = y0 + r * (cellSize + gap);
      var rx = Math.max(2, cellSize * 0.15);
      if (v === 0) {
        // Empty cell — dashed outline
        out += '<rect x="' + cx + '" y="' + cy + '" width="' + cellSize + '" height="' + cellSize + '"'
          + ' rx="' + rx + '"'
          + ' fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="1.2" stroke-dasharray="3,2"/>';
      } else {
        var fill   = (v === 1) ? fillA   : fillB;
        var stroke = (v === 1) ? strokeA : strokeB;
        out += '<rect x="' + cx + '" y="' + cy + '" width="' + cellSize + '" height="' + cellSize + '"'
          + ' rx="' + rx + '"'
          + ' fill="' + fill + '" stroke="' + stroke + '" stroke-width="1.2"/>';
      }
    }
  }
  return out;
}

// Build the center display SVG: left 3x3 + dashed mirror line + "?" placeholder
// viewBox="0 0 148 74"
function buildCenterSVG(leftGrid, colorPair) {
  var cell = 18, gap = 3, cols = 3, rows = 3;
  var gridW = cols * cell + (cols - 1) * gap; // 60
  var gridH = rows * cell + (rows - 1) * gap; // 60
  var totalW = 148, totalH = 74;
  var leftX  = 4;
  var leftY  = (totalH - gridH) / 2;
  var lineX  = leftX + gridW + 6; // 70
  var rightX = lineX + 10;        // 80
  var rightY = leftY;

  var svgBody = '';
  // Left grid
  svgBody += renderGrid3x3(leftGrid, colorPair, cell, gap, leftX, leftY);
  // Mirror line (dashed)
  svgBody += '<line x1="' + lineX + '" y1="2" x2="' + lineX + '" y2="' + (totalH - 2) + '"'
    + ' stroke="#FF8A00" stroke-width="2.5" stroke-dasharray="5,3" stroke-linecap="round"/>';
  // "?" on right side
  svgBody += '<rect x="' + rightX + '" y="' + rightY + '" width="' + gridW + '" height="' + gridH + '"'
    + ' rx="8" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.2)" stroke-width="1.5" stroke-dasharray="4,3"/>';
  svgBody += '<text x="' + (rightX + gridW / 2) + '" y="' + (rightY + gridH / 2 + 10) + '"'
    + ' text-anchor="middle" font-size="28" font-weight="900" font-family="sans-serif"'
    + ' fill="rgba(255,255,255,0.4)">?</text>';

  return '<svg viewBox="0 0 ' + totalW + ' ' + totalH + '" xmlns="http://www.w3.org/2000/svg">'
    + svgBody + '</svg>';
}

// Build an answer button SVG showing a 3x3 right-half grid
// viewBox="0 0 62 62"
function buildAnswerSVG(grid, colorPair) {
  var cell = 16, gap = 3;
  var gridW = 3 * cell + 2 * gap; // 54
  var gridH = gridW;
  var x0 = (62 - gridW) / 2; // 4
  var y0 = (62 - gridH) / 2; // 4

  return '<svg viewBox="0 0 62 62" xmlns="http://www.w3.org/2000/svg">'
    + renderGrid3x3(grid, colorPair, cell, gap, x0, y0)
    + '</svg>';
}

// ══════════════════════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════════════════════

var TOTAL_ROUNDS   = 10;
var ANSWERS_COUNT  = 4; // 2x2 grid of answer choices per zone

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
    osc.frequency.setValueAtTime(150, ctx.currentTime);
    gain.gain.setValueAtTime(0.38, ctx.currentTime);
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
    osc.frequency.setValueAtTime(880, ctx.currentTime);
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
var roundDQ        = [];
var roundResolved  = false;
var nextRoundTimer = null;
var gameActive     = false;

// Current round data
var currentLeftGrid    = null;  // 3x3 array
var currentMirrorGrid  = null;  // correct answer
var currentColorPair   = null;
var correctAnswerIdx   = -1;    // index among 4 answers (same for all zones)

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
var targetSvgBox     = document.getElementById('targetSvgBox');
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

function randInt(n) { return Math.floor(Math.random() * n); }

function isDQ(playerIdx) { return roundDQ.indexOf(playerIdx) !== -1; }
function setDQ(playerIdx) { if (!isDQ(playerIdx)) roundDQ.push(playerIdx); }

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

    // Zone header
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

// Populate a zone's answer grid with the 4 SVG buttons
function populateZoneGrid(playerIdx, roundData) {
  var grid = zonesWrap.querySelector('[data-grid-for="' + playerIdx + '"]');
  if (!grid) return;
  grid.innerHTML = '';

  roundData.answers.forEach(function(answerGrid, ansIdx) {
    var btn = document.createElement('div');
    btn.className = 'answer-btn';
    btn.setAttribute('role', 'button');
    btn.setAttribute('aria-label', '보기 ' + (ansIdx + 1));
    btn.setAttribute('data-ans-idx', ansIdx);
    btn.innerHTML = buildAnswerSVG(answerGrid, roundData.colorPair);

    onTap(btn, function(e) {
      e.stopPropagation();
      handleAnswerTap(playerIdx, ansIdx, btn, e);
    });

    grid.appendChild(btn);
  });
}

// ══════════════════════════════════════════════════════
// RIPPLE
// ══════════════════════════════════════════════════════

function spawnRipple(zone, e) {
  var rect = zone.getBoundingClientRect();
  var src  = (e.touches && e.touches[0]) ? e.touches[0] : e;
  var x    = (src ? src.clientX : rect.left + rect.width  / 2) - rect.left;
  var y    = (src ? src.clientY : rect.top  + rect.height / 2) - rect.top;
  var size = Math.max(rect.width, rect.height);
  var r    = document.createElement('span');
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

function handleAnswerTap(playerIdx, ansIdx, btn, e) {
  if (phase !== 'active') return;
  if (isDQ(playerIdx))    return;
  if (roundResolved)      return;

  var zone      = getZone(playerIdx);
  spawnRipple(zone, e);

  var isCorrect = (ansIdx === correctAnswerIdx);

  if (isCorrect) {
    roundResolved = true;
    phase = 'resolved';
    sound.play('ding');

    scores[playerIdx]++;
    updateZoneScore(playerIdx);

    btn.classList.add('ans-correct-flash');

    zone.classList.remove('state-idle', 'state-active', 'state-dq', 'state-wrong');
    zone.classList.add('state-correct');

    // Dim other zones
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
    var timeoutWrongBtn = setTimeout(function() {
      if (gameActive) btn.classList.remove('ans-wrong-flash');
    }, 400);

    zone.classList.remove('state-active', 'state-correct', 'state-idle');
    zone.classList.add('state-dq', 'state-wrong');
    var timeoutWrongZone = setTimeout(function() {
      if (gameActive) zone.classList.remove('state-wrong');
    }, 420);

    roundStatus.textContent = PLAYER_CONFIG[playerIdx].label + ' 오답! 실격 -1점';
    roundStatus.className   = 'round-status wrong';

    var timeoutStatus = setTimeout(function() {
      if (gameActive && phase === 'active') {
        roundStatus.textContent = '';
        roundStatus.className   = 'round-status';
      }
    }, 900);

    // Check if everyone is DQ'd
    var allOut = true;
    for (var j = 0; j < playerCount; j++) {
      if (!isDQ(j)) { allOut = false; break; }
    }
    if (allOut) {
      // Cancel the smaller timeouts since we resolve now
      clearTimeout(timeoutWrongBtn);
      clearTimeout(timeoutWrongZone);
      clearTimeout(timeoutStatus);
      roundResolved = true;
      phase = 'resolved';
      roundStatus.textContent = '전원 실격 — 다음 라운드';
      roundStatus.className   = 'round-status wrong';
      scheduleNextOrEnd();
    }
  }
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

  showScreen(gameScreen);
  buildZones();

  nextRoundTimer = setTimeout(function() {
    nextRoundTimer = null;
    nextRound();
  }, 300);
}

// Shuffled pool index tracker to avoid repeating patterns too quickly
var patternShuffled = [];
var patternShuffleIdx = 0;

function nextPatternIdx() {
  if (patternShuffleIdx >= patternShuffled.length) {
    patternShuffled = shuffle(
      Array.from ? Array.from({length: PATTERN_POOL.length}, function(_, i) { return i; })
                 : (function() { var a = []; for (var i = 0; i < PATTERN_POOL.length; i++) a.push(i); return a; }())
    );
    patternShuffleIdx = 0;
  }
  return patternShuffled[patternShuffleIdx++];
}

function nextRound() {
  currentRound++;
  roundDQ       = [];
  roundResolved = false;
  phase         = 'idle';

  roundBadge.textContent  = currentRound + ' / ' + TOTAL_ROUNDS;
  roundStatus.textContent = '준비...';
  roundStatus.className   = 'round-status';

  // Show empty center (waiting state)
  targetSvgBox.innerHTML = '<svg viewBox="0 0 148 74" xmlns="http://www.w3.org/2000/svg">'
    + '<rect x="2" y="2" width="144" height="70" rx="10" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.12)" stroke-width="1.5"/>'
    + '<text x="74" y="44" text-anchor="middle" font-size="28" font-weight="900"'
    + ' font-family="sans-serif" fill="rgba(255,255,255,0.25)">...</text></svg>';

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

  // Generate round data
  var patIdx    = nextPatternIdx();
  var leftGrid  = PATTERN_POOL[patIdx];
  var mGrid     = mirrorGrid(leftGrid);
  var colorPair = COLOR_PAIRS[randInt(COLOR_PAIRS.length)];
  var wrongGrids = generateWrongGrids(mGrid, leftGrid);
  var answers   = wrongGrids.slice();
  var insertIdx = randInt(ANSWERS_COUNT);
  answers.splice(insertIdx, 0, mGrid);

  currentLeftGrid   = leftGrid;
  currentMirrorGrid = mGrid;
  currentColorPair  = colorPair;
  correctAnswerIdx  = insertIdx;

  var roundData = {
    leftGrid:   leftGrid,
    mirrorGrid: mGrid,
    colorPair:  colorPair,
    answers:    answers,
    correctIdx: insertIdx
  };

  // Short pause then reveal
  nextRoundTimer = setTimeout(function() {
    nextRoundTimer = null;
    if (!gameActive) return;

    // Render center: left half + mirror line + "?"
    targetSvgBox.innerHTML = buildCenterSVG(leftGrid, colorPair);

    roundStatus.textContent = '';
    roundStatus.className   = 'round-status';

    // Populate each zone with the same 4 answer options
    for (var p = 0; p < playerCount; p++) {
      populateZoneGrid(p, roundData);
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
    if (!gameActive) return;
    if (currentRound >= TOTAL_ROUNDS) {
      showResult();
    } else {
      nextRound();
    }
  }, 1500);
}

// ══════════════════════════════════════════════════════
// RESULT SCREEN
// ══════════════════════════════════════════════════════

function showResult() {
  sound.play('fanfare');
  gameActive = false;

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
    resultWinner.style.color = '#006064';
  }

  // Sort by score desc
  var order = [];
  for (var k = 0; k < playerCount; k++) { order.push(k); }
  order.sort(function(a, b) { return scores[b] - scores[a]; });

  resultScoresWrap.innerHTML = '';
  order.forEach(function(p, rank) {
    var row = document.createElement('div');
    row.className = 'result-score-row' + (scores[p] === maxScore ? ' winner-row' : '');

    var rankEl = document.createElement('span');
    rankEl.className = 'result-score-rank';
    rankEl.textContent = (rank + 1) + '위';

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
