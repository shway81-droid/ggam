/* games/count-blocks/game.js */
'use strict';

// ── Constants ────────────────────────────────────────────────
const CB_TOTAL_ROUNDS    = 8;
const CB_ROUND_TIME      = 15;
const CB_RESULT_PAUSE_MS = getAutoplayPauseMs(2000);

// Player config
const CB_PLAYER_CONFIG = [
  { label: 'P1', dot: '#0288D1', cls: 'p1' },
  { label: 'P2', dot: '#E53935', cls: 'p2' },
  { label: 'P3', dot: '#388E3C', cls: 'p3' },
  { label: 'P4', dot: '#F57C00', cls: 'p4' },
];

// Block color: warm brown/terracotta tone (no random shading)
const CB_BLOCK_TOP    = '#BCAAA4';  // bright top face
const CB_BLOCK_LEFT   = '#8D6E63';  // medium left face
const CB_BLOCK_RIGHT  = '#5D4037';  // dark right face
const CB_BLOCK_STROKE = '#2C2C2C';

// Difficulty plan per round
const CB_DIFF_PLAN = [
  { gridW: 2, gridH: 2, maxH: 2 }, // round 1
  { gridW: 2, gridH: 2, maxH: 3 }, // round 2
  { gridW: 2, gridH: 2, maxH: 3 }, // round 3
  { gridW: 3, gridH: 2, maxH: 2 }, // round 4
  { gridW: 3, gridH: 2, maxH: 3 }, // round 5
  { gridW: 3, gridH: 3, maxH: 2 }, // round 6
  { gridW: 3, gridH: 3, maxH: 3 }, // round 7
  { gridW: 3, gridH: 3, maxH: 4 }, // round 8
];

// ── Isometric SVG renderer ───────────────────────────────────
const CB_IU = 18; // iso unit (px)

function cbIsoProject(col, row, z, iuW, iuH) {
  const px = (col - row) * iuW;
  const py = (col + row) * iuH - z * iuH * 2;
  return { px, py };
}

function cbRenderBlockSvg(heights, gridW, gridH) {
  const iuW = CB_IU;
  const iuH = CB_IU * 0.5;

  // Compute bounding box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let row = 0; row < gridH; row++) {
    for (let col = 0; col < gridW; col++) {
      const h = heights[row][col];
      const topZ = Math.max(h, 1);
      for (let z = 0; z < topZ; z++) {
        const p0 = cbIsoProject(col, row, z, iuW, iuH);
        const p1 = cbIsoProject(col + 1, row, z, iuW, iuH);
        const p2 = cbIsoProject(col, row + 1, z, iuW, iuH);
        for (const p of [p0, p1, p2]) {
          minX = Math.min(minX, p.px - iuW);
          maxX = Math.max(maxX, p.px + iuW);
          minY = Math.min(minY, p.py - iuH * 2);
          maxY = Math.max(maxY, p.py + iuH * 4);
        }
      }
    }
  }
  if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 120; maxY = 120; }

  const pad = 6;
  const svgW = maxX - minX + pad * 2;
  const svgH = maxY - minY + pad * 2;
  const offX = -minX + pad;
  const offY = -minY + pad;

  // Collect blocks
  const blocks = [];
  for (let row = 0; row < gridH; row++) {
    for (let col = 0; col < gridW; col++) {
      const h = heights[row][col];
      for (let z = 0; z < h; z++) {
        blocks.push({ col, row, z });
      }
    }
  }
  // Sort: back-to-front, bottom-to-top
  blocks.sort(function(a, b) {
    const da = a.row + a.col;
    const db = b.row + b.col;
    if (da !== db) return da - db;
    return a.z - b.z;
  });

  function drawBlock(col, row, z) {
    const { px: bpx, py: bpy } = cbIsoProject(col, row, z, iuW, iuH);
    const px = bpx + offX;
    const py = bpy + offY;

    const tl = { x: px,        y: py };
    const tr = { x: px + iuW,  y: py + iuH };
    const br = { x: px,        y: py + iuH * 2 };
    const bl = { x: px - iuW,  y: py + iuH };

    const llBot = { x: px - iuW, y: py + iuH + iuH * 2 };
    const lrBot = { x: px,       y: py + iuH * 2 + iuH * 2 };
    const rlBot = { x: px,       y: py + iuH * 2 + iuH * 2 };
    const rrBot = { x: px + iuW, y: py + iuH + iuH * 2 };

    function poly(pts) {
      return pts.map(function(p) { return p.x.toFixed(1) + ',' + p.y.toFixed(1); }).join(' ');
    }

    const stroke = 'stroke="' + CB_BLOCK_STROKE + '" stroke-width="1.5" stroke-linejoin="round"';

    return [
      '<polygon points="' + poly([bl, br, lrBot, llBot]) + '" fill="' + CB_BLOCK_LEFT + '" ' + stroke + '/>',
      '<polygon points="' + poly([br, tr, rrBot, rlBot]) + '" fill="' + CB_BLOCK_RIGHT + '" ' + stroke + '/>',
      '<polygon points="' + poly([tl, tr, br, bl]) + '" fill="' + CB_BLOCK_TOP + '" ' + stroke + '/>',
    ].join('');
  }

  const blocksSvg = blocks.map(function(b) { return drawBlock(b.col, b.row, b.z); }).join('');
  const svg = '<svg viewBox="0 0 ' + svgW.toFixed(1) + ' ' + svgH.toFixed(1) + '" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;height:auto">' + blocksSvg + '</svg>';

  // Count visible blocks (total = sum of all heights)
  const total = heights.reduce(function(s, row) {
    return s + row.reduce(function(a, v) { return a + v; }, 0);
  }, 0);

  // Count "visible only" blocks: for each column, only the top block and
  // blocks visible from the front are "visible."
  // In isometric view, a block at (r,c,z) is hidden if there is a block
  // directly in front-left (r+1,c,z) or front-right (r,c+1,z) covering it.
  // For simplicity: visible block = top of each column (not covered from above),
  // plus side-exposed blocks.
  // "Visible count" heuristic: sum of heights minus fully hidden interior blocks.
  // A block at (r,c,z) is hidden if z < heights[r][c]-1 AND
  // (heights[r+1][c] > z || r+1 >= gridH) AND (heights[r][c+1] > z || c+1 >= gridW)
  // This is a simplification for the "visible blocks only" wrong answer.
  let visibleCount = 0;
  for (let row = 0; row < gridH; row++) {
    for (let col = 0; col < gridW; col++) {
      const h = heights[row][col];
      for (let z = 0; z < h; z++) {
        // Block is visible if its top face or any side face is exposed
        const topVisible = (z === h - 1);
        const leftVisible = (row === 0) || (heights[row - 1][col] <= z);
        const rightVisible = (col === 0) || (heights[row][col - 1] <= z);
        if (topVisible || leftVisible || rightVisible) {
          visibleCount++;
        }
      }
    }
  }

  return { svg, total, visibleCount };
}

// ── Helpers ──────────────────────────────────────────────────
function cbRandInt(n) { return Math.floor(Math.random() * n); }

function cbGenerateHeights(gridW, gridH, maxH) {
  const heights = [];
  for (let r = 0; r < gridH; r++) {
    heights.push([]);
    for (let c = 0; c < gridW; c++) {
      // Each column: random height 1..maxH (no empty columns — ensures hidden blocks)
      heights[r].push(1 + cbRandInt(maxH));
    }
  }
  return heights;
}

/**
 * Generate choices for count-blocks.
 * Must include: correct total, visible-only count (common misconception),
 * and 2 more plausible wrong values.
 */
function cbGenerateChoices(total, visibleCount, maxTotal) {
  const used = new Set();
  used.add(total);

  const choices = [];

  // Wrong 1: visible-only count (if different from total)
  let vis = visibleCount;
  if (vis === total) { vis = total - 1 - cbRandInt(3); }
  if (vis < 1) { vis = total + 1; }
  if (!used.has(vis) && vis > 0) {
    used.add(vis);
    choices.push(vis);
  }

  // Wrong 2: total ± small offset
  const offsets = [-2, -1, 1, 2, 3, -3];
  for (const off of offsets) {
    const candidate = total + off;
    if (candidate > 0 && !used.has(candidate)) {
      used.add(candidate);
      choices.push(candidate);
      if (choices.length >= 3) break;
    }
  }

  // Fill remaining if needed
  let extra = total + 4;
  while (choices.length < 3) {
    if (!used.has(extra) && extra > 0) {
      used.add(extra);
      choices.push(extra);
    }
    extra++;
  }

  // Build final list with correct answer, shuffled
  const allChoices = [total].concat(choices.slice(0, 3));

  // Shuffle
  for (let i = allChoices.length - 1; i > 0; i--) {
    const j = cbRandInt(i + 1);
    const tmp = allChoices[i];
    allChoices[i] = allChoices[j];
    allChoices[j] = tmp;
  }

  return allChoices;
}

function cbGenerateRound(roundIdx) {
  const plan = CB_DIFF_PLAN[Math.min(roundIdx, CB_DIFF_PLAN.length - 1)];
  const { gridW, gridH, maxH } = plan;

  let heights, total, visibleCount;
  let attempts = 0;

  while (attempts < 200) {
    attempts++;
    heights = cbGenerateHeights(gridW, gridH, maxH);
    const result = cbRenderBlockSvg(heights, gridW, gridH);
    total = result.total;
    visibleCount = result.visibleCount;

    // Ensure there are actually hidden blocks (total > visibleCount)
    if (total > visibleCount && total >= 2) break;
  }

  // Fallback: force hidden blocks by making at least one column height 2+
  if (total <= visibleCount) {
    heights[0][0] = Math.min(maxH, 2);
    heights[0][1] = Math.min(maxH, 2);
    const result = cbRenderBlockSvg(heights, gridW, gridH);
    total = result.total;
    visibleCount = result.visibleCount;
  }

  const { svg } = cbRenderBlockSvg(heights, gridW, gridH);
  const maxTotal = gridW * gridH * maxH;
  const choices  = cbGenerateChoices(total, visibleCount, maxTotal);

  return { heights, gridW, gridH, svg, total, visibleCount, choices };
}

// ── Sound Manager ────────────────────────────────────────────
const cbSound = createSoundManager({
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
let cbPlayerCount   = 2;
let cbRoundIdx      = 0;
let cbScores        = [];
let cbRoundLog      = [];
let cbCurrentRound  = null;
let cbDqSet         = new Set();
let cbPhase         = 'idle';
let cbTimerHandle   = null;
let cbNextHandle    = null;
let cbTimeRemaining = CB_ROUND_TIME;
let cbGameRounds    = [];
var cbCDInterval    = null;

// ── DOM refs ─────────────────────────────────────────────────
const cbIntroScreen     = document.getElementById('introScreen');
const cbCountdownScreen = document.getElementById('countdownScreen');
const cbCountdownNumber = document.getElementById('countdownNumber');
const cbGameScreen      = document.getElementById('gameScreen');
const cbResultScreen    = document.getElementById('resultScreen');
const cbBackBtn         = document.getElementById('backBtn');
const cbPlayBtn         = document.getElementById('playBtn');
const cbCloseBtn        = document.getElementById('closeBtn');
const cbRetryBtn        = document.getElementById('retryBtn');
const cbHomeBtn         = document.getElementById('homeBtn');
const cbZonesWrap       = document.getElementById('zonesWrap');
const cbQuestionCounter = document.getElementById('questionCounter');
const cbProblemTimer    = document.getElementById('problemTimer');
const cbProblemStatus   = document.getElementById('problemStatus');
const cbScoreBar        = document.getElementById('scoreBar');
const cbBlockSvgWrap    = document.getElementById('blockSvgWrap');
const cbSoundToggle     = document.getElementById('soundToggleIntro');
const cbIntroIllust     = document.getElementById('introIllust');
const cbResultTitle     = document.getElementById('resultTitle');
const cbResultWinner    = document.getElementById('resultWinner');
const cbResultTableHead = document.getElementById('resultTableHead');
const cbResultTableBody = document.getElementById('resultTableBody');
const cbTotalRow        = document.getElementById('totalRow');

// ── Helpers ──────────────────────────────────────────────────
function cbShowScreen(s) {
  [cbIntroScreen, cbCountdownScreen, cbGameScreen, cbResultScreen]
    .forEach(function(x) { x.classList.remove('active'); });
  s.classList.add('active');
}

function cbClearTimers() {
  if (cbCDInterval)   { clearInterval(cbCDInterval);  cbCDInterval  = null; }
  if (cbTimerHandle)  { clearInterval(cbTimerHandle); cbTimerHandle = null; }
  if (cbNextHandle)   { clearTimeout(cbNextHandle);   cbNextHandle  = null; }
}

function cbUpdateSoundBtn() {
  cbSoundToggle.textContent = cbSound.isMuted() ? '🔇' : '🔊';
}

function cbStartPreGameCountdown(onDone) {
  cbShowScreen(cbCountdownScreen);
  let count = 3;
  cbCountdownNumber.textContent = count;
  cbCDInterval = setInterval(function() {
    count--;
    if (count <= 0) {
      clearInterval(cbCDInterval);
      cbCDInterval = null;
      onDone();
    } else {
      cbCountdownNumber.textContent = count;
      cbCountdownNumber.style.animation = 'none';
      void cbCountdownNumber.offsetHeight;
      cbCountdownNumber.style.animation = '';
    }
  }, 1000);
}

// ── Intro illustration ───────────────────────────────────────
function cbRenderIntroIllust() {
  const h = [[2, 3], [1, 2]];
  const { svg } = cbRenderBlockSvg(h, 2, 2);
  cbIntroIllust.innerHTML = svg;
}
cbRenderIntroIllust();

// ── Player count selection ───────────────────────────────────
document.querySelectorAll('.player-btn').forEach(function(btn) {
  onTap(btn, function() {
    document.querySelectorAll('.player-btn').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    cbPlayerCount = parseInt(btn.dataset.count, 10);
  });
});

onTap(cbSoundToggle, function() { cbSound.toggleMute(); cbUpdateSoundBtn(); });
cbUpdateSoundBtn();

onTap(cbBackBtn,  function() { goHome(); });
onTap(cbCloseBtn, function() { cbClearTimers(); goHome(); });
onTap(cbHomeBtn,  function() { goHome(); });
onTap(cbRetryBtn, function() { cbStartPreGameCountdown(function() { cbStartGame(); }); });
onTap(cbPlayBtn,  function() { cbStartPreGameCountdown(function() { cbStartGame(); }); });

// ── Render problem panel ─────────────────────────────────────
function cbRenderProblem() {
  cbBlockSvgWrap.innerHTML = cbCurrentRound.svg;
}

// ── Build zones ──────────────────────────────────────────────
function cbBuildZones() {
  cbZonesWrap.innerHTML = '';
  cbZonesWrap.className = 'zones-wrap p' + cbPlayerCount;

  for (let i = 0; i < cbPlayerCount; i++) {
    const cfg  = CB_PLAYER_CONFIG[i];
    const zone = document.createElement('div');
    zone.className = 'zone ' + cfg.cls;
    zone.dataset.player = i;

    const header = document.createElement('div');
    header.className = 'zone-header';
    header.innerHTML =
      '<span class="zone-label">' + cfg.label + '</span>' +
      '<span class="zone-score-chip" id="cb-score-chip-' + i + '">0점</span>';

    const hint = document.createElement('div');
    hint.className = 'zone-hint';
    hint.textContent = '총 블록 수 선택 (숨은 것 포함)';

    const choiceList = document.createElement('div');
    choiceList.className = 'choice-list';
    choiceList.id = 'cb-choice-list-' + i;

    zone.appendChild(header);
    zone.appendChild(hint);
    zone.appendChild(choiceList);
    cbZonesWrap.appendChild(zone);
  }
}

function cbGetZone(idx) {
  return cbZonesWrap.querySelector('.zone[data-player="' + idx + '"]');
}

function cbGetChoiceBtns(playerIdx) {
  const list = document.getElementById('cb-choice-list-' + playerIdx);
  return list ? Array.from(list.querySelectorAll('.choice-btn')) : [];
}

function cbUpdateScoreChip(playerIdx) {
  const chip = document.getElementById('cb-score-chip-' + playerIdx);
  if (chip) chip.textContent = cbScores[playerIdx] + '점';
}

// ── Score bar ────────────────────────────────────────────────
function cbBuildScoreBar() {
  cbScoreBar.innerHTML = '';
  for (let i = 0; i < cbPlayerCount; i++) {
    const cfg  = CB_PLAYER_CONFIG[i];
    const chip = document.createElement('div');
    chip.className = 'score-chip';
    chip.innerHTML =
      '<span class="score-chip-dot" style="background:' + cfg.dot + '"></span>' +
      '<span>' + cfg.label + '</span>' +
      '<span class="score-chip-val" id="cb-bar-score-' + i + '">0</span>';
    cbScoreBar.appendChild(chip);
  }
}

function cbUpdateBarScore(playerIdx) {
  const el = document.getElementById('cb-bar-score-' + playerIdx);
  if (el) el.textContent = cbScores[playerIdx];
}

// ── Reset buttons for new round ──────────────────────────────
function cbResetBtnsForRound() {
  const { choices, total } = cbCurrentRound;

  for (let i = 0; i < cbPlayerCount; i++) {
    const list = document.getElementById('cb-choice-list-' + i);
    if (!list) continue;
    list.innerHTML = '';

    choices.forEach(function(val, ci) {
      const btn = document.createElement('button');
      btn.className = 'choice-btn';
      btn.dataset.player = String(i);
      btn.dataset.choiceIdx = String(ci);
      btn.dataset.value = String(val);
      btn.setAttribute('aria-label', 'P' + (i + 1) + ' 선택: ' + val + '개');
      btn.textContent = val + '개';
      onTap(btn, function() { cbHandleChoiceTap(i, ci, btn, val === total); });
      list.appendChild(btn);
    });

    const zone = cbGetZone(i);
    if (zone) zone.classList.remove('dq-zone');
  }
}

function cbDisablePlayerBtns(playerIdx) {
  cbGetChoiceBtns(playerIdx).forEach(function(b) {
    b.classList.add('state-disabled');
    b.disabled = true;
  });
}

// ── Timer logic ──────────────────────────────────────────────
function cbStartCountdown() {
  cbTimeRemaining = CB_ROUND_TIME;
  cbProblemTimer.textContent = cbTimeRemaining;
  cbProblemTimer.classList.remove('urgent');

  cbTimerHandle = setInterval(function() {
    cbTimeRemaining--;
    cbProblemTimer.textContent = cbTimeRemaining;
    if (cbTimeRemaining <= 3) {
      cbProblemTimer.classList.add('urgent');
      cbSound.play('tick');
    }
    if (cbTimeRemaining <= 0) {
      cbClearTimers();
      cbHandleTimeout();
    }
  }, 1000);
}

// ── Choice tap handler ───────────────────────────────────────
function cbHandleChoiceTap(playerIdx, choiceIdx, btn, isCorrect) {
  if (cbPhase !== 'active') return;
  if (cbDqSet.has(playerIdx)) return;

  if (isCorrect) {
    cbResolveRound(playerIdx);
  } else {
    cbSound.play('buzz');
    btn.classList.add('state-wrong');
    cbDqSet.add(playerIdx);

    const zone = cbGetZone(playerIdx);
    const flash = document.createElement('div');
    flash.className = 'penalty-flash';
    flash.textContent = '실격!';
    zone.appendChild(flash);
    flash.addEventListener('animationend', function() { flash.remove(); });

    cbDisablePlayerBtns(playerIdx);
    zone.classList.add('dq-zone');

    let anyActive = false;
    for (let i = 0; i < cbPlayerCount; i++) {
      if (!cbDqSet.has(i)) { anyActive = true; break; }
    }
    if (!anyActive) {
      cbClearTimers();
      cbNextHandle = setTimeout(function() { cbHandleTimeout(); }, 300);
    }
  }
}

// ── Correct resolved ─────────────────────────────────────────
function cbResolveRound(winnerIdx) {
  cbPhase = 'done';
  cbClearTimers();
  cbSound.play('ding');

  cbScores[winnerIdx]++;
  cbUpdateScoreChip(winnerIdx);
  cbUpdateBarScore(winnerIdx);

  cbGetChoiceBtns(winnerIdx).forEach(function(b) {
    const val = parseInt(b.dataset.value, 10);
    if (val === cbCurrentRound.total) {
      b.classList.add('state-correct');
    } else {
      b.classList.add('state-disabled');
      b.disabled = true;
    }
  });

  for (let i = 0; i < cbPlayerCount; i++) {
    if (i !== winnerIdx) cbDisablePlayerBtns(i);
  }

  cbProblemStatus.textContent = CB_PLAYER_CONFIG[winnerIdx].label + ' 정답! (총 ' + cbCurrentRound.total + '개)';

  cbRoundLog.push({
    total: cbCurrentRound.total,
    winnerIdx: winnerIdx,
    dqPlayers: Array.from(cbDqSet),
    timedOut: false,
  });

  cbNextHandle = setTimeout(function() { cbNextRound(); }, CB_RESULT_PAUSE_MS);
}

// ── Timeout ──────────────────────────────────────────────────
function cbHandleTimeout() {
  cbPhase = 'done';
  cbClearTimers();
  cbSound.play('timeout');

  for (let i = 0; i < cbPlayerCount; i++) {
    cbGetChoiceBtns(i).forEach(function(b) {
      const val = parseInt(b.dataset.value, 10);
      if (val === cbCurrentRound.total) {
        b.classList.remove('state-disabled');
        b.classList.add('state-reveal');
        b.disabled = true;
      } else {
        b.classList.add('state-disabled');
        b.disabled = true;
      }
    });
    const zone = cbGetZone(i);
    if (zone) zone.classList.remove('dq-zone');
  }

  cbProblemStatus.textContent = '정답은 ' + cbCurrentRound.total + '개!';

  cbRoundLog.push({
    total: cbCurrentRound.total,
    winnerIdx: -1,
    dqPlayers: Array.from(cbDqSet),
    timedOut: true,
  });

  cbNextHandle = setTimeout(function() { cbNextRound(); }, CB_RESULT_PAUSE_MS);
}

// ── Load round ───────────────────────────────────────────────
function cbLoadRound() {
  cbPhase        = 'active';
  cbCurrentRound = cbGameRounds[cbRoundIdx];
  cbDqSet        = new Set();

  cbQuestionCounter.textContent = (cbRoundIdx + 1) + ' / ' + CB_TOTAL_ROUNDS;
  cbProblemStatus.textContent   = '';
  cbProblemTimer.classList.remove('urgent');

  cbRenderProblem();
  cbResetBtnsForRound();
  cbStartCountdown();
}

// ── Next round ───────────────────────────────────────────────
function cbNextRound() {
  cbRoundIdx++;
  if (cbRoundIdx >= CB_TOTAL_ROUNDS) {
    cbShowResult();
  } else {
    cbLoadRound();
  }
}

// ── Start game ───────────────────────────────────────────────
function cbStartGame() {
  cbGameRounds = [];
  for (let i = 0; i < CB_TOTAL_ROUNDS; i++) {
    cbGameRounds.push(cbGenerateRound(i));
  }

  cbRoundIdx  = 0;
  cbScores    = new Array(cbPlayerCount).fill(0);
  cbRoundLog  = [];
  cbDqSet     = new Set();
  cbPhase     = 'idle';

  cbClearTimers();
  cbBuildZones();
  cbBuildScoreBar();
  cbShowScreen(cbGameScreen);
  cbLoadRound();
}

// ── Show result ──────────────────────────────────────────────
function cbShowResult() {
  cbClearTimers();
  cbPhase = 'idle';
  cbSound.play('fanfare');

  const maxScore = Math.max.apply(null, cbScores);
  const winners  = cbScores
    .map(function(s, i) { return { s: s, i: i }; })
    .filter(function(x) { return x.s === maxScore; })
    .map(function(x) { return x.i; });

  if (maxScore === 0) {
    cbResultTitle.textContent  = '무승부!';
    cbResultWinner.textContent = '아무도 점수를 얻지 못했어요.';
  } else if (winners.length === 1) {
    const w = winners[0];
    cbResultTitle.textContent  = '게임 종료!';
    cbResultWinner.textContent = CB_PLAYER_CONFIG[w].label + ' 승리! (' + maxScore + '점)';
  } else {
    const labels = winners.map(function(w) { return CB_PLAYER_CONFIG[w].label; }).join(', ');
    cbResultTitle.textContent  = '동점!';
    cbResultWinner.textContent = labels + ' 공동 1위! (' + maxScore + '점)';
  }

  const headRow = document.createElement('tr');
  headRow.innerHTML = '<th>라운드</th>' +
    Array.from({ length: cbPlayerCount }, function(_, i) {
      return '<th><span class="player-dot" style="background:' + CB_PLAYER_CONFIG[i].dot + '"></span>' + CB_PLAYER_CONFIG[i].label + '</th>';
    }).join('');
  cbResultTableHead.innerHTML = '';
  cbResultTableHead.appendChild(headRow);

  cbResultTableBody.innerHTML = '';
  cbRoundLog.forEach(function(log, idx) {
    const tr = document.createElement('tr');
    let cells = '<td>' + (idx + 1) + '라운드 (' + log.total + '개)</td>';
    for (let i = 0; i < cbPlayerCount; i++) {
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
    cbResultTableBody.appendChild(tr);
  });

  cbTotalRow.innerHTML = '';
  for (let i = 0; i < cbPlayerCount; i++) {
    const cfg   = CB_PLAYER_CONFIG[i];
    const isWin = winners.includes(i) && maxScore > 0;
    const chip  = document.createElement('div');
    chip.className = 'total-chip';
    chip.innerHTML =
      '<span class="chip-dot" style="background:' + cfg.dot + '"></span>' +
      '<span>' + cfg.label + '</span>' +
      '<span class="chip-score" style="color:' + (isWin ? '#2E7D32' : '#555') + '">' + cbScores[i] + '점</span>' +
      (isWin ? '<span style="font-size:1.1rem;">★</span>' : '');
    cbTotalRow.appendChild(chip);
  }

  cbShowScreen(cbResultScreen);
}
