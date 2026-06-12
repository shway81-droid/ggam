/* games/block-view/game.js */
'use strict';

// ── Constants ────────────────────────────────────────────────
const BV_TOTAL_ROUNDS    = 8;
const BV_ROUND_TIME      = 15;
const BV_RESULT_PAUSE_MS = getAutoplayPauseMs(2000);

// Player config
const BV_PLAYER_CONFIG = [
  { label: 'P1', dot: '#0288D1', cls: 'p1' },
  { label: 'P2', dot: '#E53935', cls: 'p2' },
  { label: 'P3', dot: '#388E3C', cls: 'p3' },
  { label: 'P4', dot: '#F57C00', cls: 'p4' },
];

// Block color: single hue family — teal/blue-green tone (no random shading)
const BV_BLOCK_TOP    = '#80CBC4';  // bright top face
const BV_BLOCK_LEFT   = '#00897B';  // medium left face
const BV_BLOCK_RIGHT  = '#005F56';  // dark right face
const BV_BLOCK_STROKE = '#2C2C2C';

// Difficulty plan per round
// Each entry: { gridW, gridH, maxH } — gridW×gridH base, columns up to maxH blocks tall
const BV_DIFF_PLAN = [
  { gridW: 2, gridH: 2, maxH: 2 }, // round 1
  { gridW: 2, gridH: 2, maxH: 2 }, // round 2
  { gridW: 2, gridH: 2, maxH: 3 }, // round 3
  { gridW: 3, gridH: 2, maxH: 2 }, // round 4
  { gridW: 3, gridH: 2, maxH: 3 }, // round 5
  { gridW: 3, gridH: 3, maxH: 2 }, // round 6
  { gridW: 3, gridH: 3, maxH: 3 }, // round 7
  { gridW: 3, gridH: 3, maxH: 3 }, // round 8
];

// ── Isometric SVG renderer ───────────────────────────────────
// Isometric unit: tile width=2*IU, tile height=IU
const BV_IU = 18; // iso unit (px)

/**
 * Convert grid position (col, row, z) to isometric SVG pixel.
 * col: x-axis (right), row: y-axis (depth/back), z: height (up)
 * Render order: back-to-front, bottom-to-top for natural occlusion.
 */
function bvIsoProject(col, row, z, iuW, iuH) {
  // isometric: x = (col - row) * iuW, y = (col + row) * iuH - z * iuH*2
  const px = (col - row) * iuW;
  const py = (col + row) * iuH - z * iuH * 2;
  return { px, py };
}

/**
 * Draw one isometric block at grid position (col, row, z).
 * Returns SVG path strings.
 */
function bvDrawBlock(col, row, z, iuW, iuH) {
  // 6 key vertices of the block cube face visible from isometric front-top view
  const { px, py } = bvIsoProject(col, row, z, iuW, iuH);
  // top face: diamond
  const tl = { x: px,          y: py };
  const tr = { x: px + iuW,    y: py + iuH };
  const br = { x: px,          y: py + iuH * 2 };
  const bl = { x: px - iuW,    y: py + iuH };

  // left face (bottom-left of cube)
  const ll = { x: px - iuW,    y: py + iuH + iuH * 2 };  // bottom-left
  const lr = { x: px,          y: py + iuH * 2 + iuH * 2 }; // bottom-right of left face

  // right face (bottom-right of cube)
  const rl = { x: px,          y: py + iuH * 2 + iuH * 2 }; // bottom-left of right face
  const rr = { x: px + iuW,    y: py + iuH + iuH * 2 };  // bottom-right

  function poly(pts) {
    return pts.map(p => `${p.x},${p.y}`).join(' ');
  }

  const stroke = `stroke="${BV_BLOCK_STROKE}" stroke-width="1.5" stroke-linejoin="round"`;

  return [
    // Left face
    `<polygon points="${poly([bl, br, lr, ll])}" fill="${BV_BLOCK_LEFT}" ${stroke}/>`,
    // Right face
    `<polygon points="${poly([br, tr, rr, rl])}" fill="${BV_BLOCK_RIGHT}" ${stroke}/>`,
    // Top face
    `<polygon points="${poly([tl, tr, br, bl])}" fill="${BV_BLOCK_TOP}" ${stroke}/>`,
  ].join('');
}

/**
 * Render the block stack SVG.
 * heights: 2D array [row][col] of stack heights (0 = empty)
 * gridW, gridH: dimensions
 * Returns: { svg: string, occupancy: boolean[][] }
 */
function bvRenderBlockSvg(heights, gridW, gridH) {
  const iuW = BV_IU;
  const iuH = BV_IU * 0.5;

  // Compute bounding box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let row = 0; row < gridH; row++) {
    for (let col = 0; col < gridW; col++) {
      const h = heights[row][col];
      for (let z = 0; z < h; z++) {
        // top face: tl corner = isoProject(col,row,z+1)
        const topTL = bvIsoProject(col, row, z + 1, iuW, iuH);
        const topTR = bvIsoProject(col + 1, row, z + 1, iuW, iuH);
        const botBR = bvIsoProject(col + 1, row + 1, z, iuW, iuH);
        const botLL = bvIsoProject(col, row + 1, z, iuW, iuH);

        // Left face bottom
        const leftBot = { px: topTL.px - iuW, py: topTL.py + iuH + iuH * 2 };
        // Right face bottom
        const rightBot = { px: topTR.px + iuW, py: topTR.py + iuH + iuH * 2 };

        const pts = [topTL, topTR, botBR, botLL, leftBot, rightBot];
        for (const p of pts) {
          minX = Math.min(minX, p.px);
          maxX = Math.max(maxX, p.px);
          minY = Math.min(minY, p.py);
          maxY = Math.max(maxY, p.py);
        }
      }
      // Also account for the base even if height=0
      if (h === 0) {
        const p0 = bvIsoProject(col, row, 0, iuW, iuH);
        minX = Math.min(minX, p0.px - iuW);
        maxX = Math.max(maxX, p0.px + iuW);
        minY = Math.min(minY, p0.py);
        maxY = Math.max(maxY, p0.py + iuH * 2);
      }
    }
  }

  // Fallback
  if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 100; maxY = 100; }

  const pad = 6;
  const svgW = maxX - minX + pad * 2;
  const svgH = maxY - minY + pad * 2;
  const offX = -minX + pad;
  const offY = -minY + pad;

  // Collect blocks and sort back-to-front, bottom-to-top
  const blocks = [];
  for (let row = 0; row < gridH; row++) {
    for (let col = 0; col < gridW; col++) {
      const h = heights[row][col];
      for (let z = 0; z < h; z++) {
        blocks.push({ col, row, z });
      }
    }
  }
  // Sort: render from back (high row+col) to front (low row+col), then bottom-to-top
  blocks.sort((a, b) => {
    const depthA = a.row + a.col;
    const depthB = b.row + b.col;
    if (depthA !== depthB) return depthA - depthB;
    return a.z - b.z;
  });

  // Translate isoProject with offset
  function isoXY(col, row, z) {
    const { px, py } = bvIsoProject(col, row, z, iuW, iuH);
    return { px: px + offX, py: py + offY };
  }

  function drawBlockAt(col, row, z) {
    const iuHH = iuH;
    const p = isoXY(col, row, z);
    const px = p.px, py = p.py;

    const tl = { x: px,        y: py };
    const tr = { x: px + iuW,  y: py + iuHH };
    const br = { x: px,        y: py + iuHH * 2 };
    const bl = { x: px - iuW,  y: py + iuHH };

    // left face bottom vertices (z level)
    const llBot = { x: px - iuW, y: py + iuHH + iuHH * 2 };
    const lrBot = { x: px,       y: py + iuHH * 2 + iuHH * 2 };
    // right face bottom vertices
    const rlBot = { x: px,       y: py + iuHH * 2 + iuHH * 2 };
    const rrBot = { x: px + iuW, y: py + iuHH + iuHH * 2 };

    function poly(pts) {
      return pts.map(pt => `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(' ');
    }

    const stroke = `stroke="${BV_BLOCK_STROKE}" stroke-width="1.5" stroke-linejoin="round"`;

    return [
      `<polygon points="${poly([bl, br, lrBot, llBot])}" fill="${BV_BLOCK_LEFT}" ${stroke}/>`,
      `<polygon points="${poly([br, tr, rrBot, rlBot])}" fill="${BV_BLOCK_RIGHT}" ${stroke}/>`,
      `<polygon points="${poly([tl, tr, br, bl])}" fill="${BV_BLOCK_TOP}" ${stroke}/>`,
    ].join('');
  }

  const blocksSvg = blocks.map(b => drawBlockAt(b.col, b.row, b.z)).join('');

  const svg = `<svg viewBox="0 0 ${svgW.toFixed(1)} ${svgH.toFixed(1)}" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;height:auto">${blocksSvg}</svg>`;

  // Occupancy: which (row,col) has at least 1 block
  const occupancy = [];
  for (let r = 0; r < gridH; r++) {
    occupancy.push([]);
    for (let c = 0; c < gridW; c++) {
      occupancy[r].push(heights[r][c] > 0);
    }
  }

  return { svg, occupancy };
}

/**
 * Render a top-view occupancy grid as SVG (choice option).
 * occupancy: boolean[][] [row][col]
 */
function bvRenderTopViewSvg(occupancy, gridW, gridH, cellSize) {
  const cs = cellSize || 18;
  const gap = 2;
  const pad = 4;
  const svgW = gridW * cs + (gridW - 1) * gap + pad * 2;
  const svgH = gridH * cs + (gridH - 1) * gap + pad * 2;
  let cells = '';
  for (let r = 0; r < gridH; r++) {
    for (let c = 0; c < gridW; c++) {
      const x = pad + c * (cs + gap);
      const y = pad + r * (cs + gap);
      const filled = occupancy[r][c];
      const fill = filled ? BV_BLOCK_TOP : '#FFFDF5';
      cells += `<rect x="${x}" y="${y}" width="${cs}" height="${cs}" rx="3" fill="${fill}" stroke="${BV_BLOCK_STROKE}" stroke-width="1.5"/>`;
    }
  }
  return `<svg viewBox="0 0 ${svgW} ${svgH}" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;height:auto">${cells}</svg>`;
}

// ── Uniqueness check ─────────────────────────────────────────
function bvOccupancyKey(occ) {
  return occ.map(row => row.map(v => v ? '1' : '0').join('')).join('|');
}

function bvOccupanciesEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let r = 0; r < a.length; r++) {
    if (a[r].length !== b[r].length) return false;
    for (let c = 0; c < a[r].length; c++) {
      if (a[r][c] !== b[r][c]) return false;
    }
  }
  return true;
}

// ── Visibility check ─────────────────────────────────────────
/**
 * Check that no column is completely hidden by a taller neighbor.
 * Specifically: every occupied (r,c) must have at least one of its
 * top-face corners visible (i.e., not fully occluded by a block at
 * a "closer" position that is at least as tall).
 *
 * A simpler heuristic: for each column with height h>0, check that
 * the column at (r+1, c+1) (closer in isometric view) does not have
 * height >= h+gridH (impossible in practice), OR more simply:
 * we ensure the top block's top face is not entirely behind another block.
 *
 * Practical rule: the top of column (r,c) at level h is visible if
 * neither (r+1,c) nor (r,c+1) completely blocks it. The top face at
 * level h is at y-position that equals isoProject(col,row,h). It is
 * hidden if a block at (r, c+1) or (r+1, c) has height >= h and its
 * bottom face at z=h-1 covers the top face's y range.
 *
 * For simplicity and correctness: we use the rule that if a column
 * (r,c) with h>0 has a neighbor (r+1, c) or (r, c+1) with height
 * >= h, the top of (r,c) may still be partially visible because iso
 * view shows the top face diagonally. The column is only FULLY hidden
 * if height[r+1][c+1] (diagonally closer) >= h+1 (i.e., completely
 * obscures from above). This is a conservative check.
 *
 * We enforce a simpler rule: generate only configurations where the
 * occupancy from above is unambiguous, meaning that from a top-down
 * perspective, the positions of occupied columns can be deduced.
 * Since top-view only depends on whether height>0, not on actual height,
 * we just need the SVG to show the structure clearly enough that players
 * can determine top-view occupancy. We'll accept all configurations
 * where no column at (r,c) is completely behind a taller column at
 * the "front" diagonal neighbor (r-1, c-1) which has height strictly
 * greater.
 */
function bvIsVisible(heights, gridW, gridH) {
  // Check: every occupied (r,c) has its top face NOT completely hidden.
  // In isometric view, a column at (r,c) is "in front of" columns with
  // higher r+c values. A block at (r2,c2) where r2>r or c2>c is "in front".
  // The top face at (r,c) height h is hidden only if there exists (r2,c2)
  // "directly in front" with height covering it. For our tile-based iso,
  // column (r+1, c) and (r, c+1) are "one step in front."
  //
  // We check: for each (r,c) with h>0, if both (r+1,c) and (r,c+1)
  // have height >= h+1, the top face of (r,c) might be hidden.
  // (This is conservative — we just exclude such cases.)
  for (let r = 0; r < gridH; r++) {
    for (let c = 0; c < gridW; c++) {
      const h = heights[r][c];
      if (h === 0) continue;
      // Check if hidden by front neighbors
      const frontR = (r + 1 < gridH) ? heights[r + 1][c] : 0;
      const frontC = (c + 1 < gridW) ? heights[r][c + 1] : 0;
      const frontRC = (r + 1 < gridH && c + 1 < gridW) ? heights[r + 1][c + 1] : 0;
      // If all three front neighbors are >= h, this block's top might be ambiguous
      if (frontR >= h + 1 && frontC >= h + 1 && frontRC >= h + 1) {
        return false;
      }
    }
  }
  return true;
}

// ── Round generation ─────────────────────────────────────────
function bvRandInt(n) { return Math.floor(Math.random() * n); }

function bvGenerateHeights(gridW, gridH, maxH) {
  // Each cell: random height 0..maxH, but at least one cell > 0
  const heights = [];
  for (let r = 0; r < gridH; r++) {
    heights.push([]);
    for (let c = 0; c < gridW; c++) {
      heights[r].push(bvRandInt(maxH + 1));
    }
  }
  // Ensure at least one block
  let total = heights.reduce((s, row) => s + row.reduce((a, v) => a + v, 0), 0);
  if (total === 0) {
    heights[bvRandInt(gridH)][bvRandInt(gridW)] = 1 + bvRandInt(maxH);
  }
  return heights;
}

/**
 * Generate one round with 4 unique top-view choices.
 * Returns: { heights, gridW, gridH, correctOcc, choices[4] }
 * choices[i] = { occupancy, isCorrect }
 */
function bvGenerateRound(roundIdx) {
  const plan = BV_DIFF_PLAN[Math.min(roundIdx, BV_DIFF_PLAN.length - 1)];
  const { gridW, gridH, maxH } = plan;

  let heights, correctOcc;
  let attempts = 0;

  // Generate valid structure
  while (true) {
    attempts++;
    if (attempts > 200) break;
    heights = bvGenerateHeights(gridW, gridH, maxH);
    if (!bvIsVisible(heights, gridW, gridH)) continue;
    const { occupancy } = bvRenderBlockSvg(heights, gridW, gridH);
    correctOcc = occupancy;
    break;
  }

  // Generate 3 wrong choices: similar occupancy (differ by 1 cell)
  const wrongOccs = [];
  const usedKeys = new Set();
  usedKeys.add(bvOccupancyKey(correctOcc));

  let wAttempts = 0;
  while (wrongOccs.length < 3 && wAttempts < 500) {
    wAttempts++;
    // Clone and flip one random cell
    const candidate = correctOcc.map(row => row.slice());

    // Determine which cells to flip: prefer single-cell flips for difficulty
    // In later rounds, flip only 1 cell; in early rounds, allow 1-2
    const numFlips = (roundIdx >= 5) ? 1 : (bvRandInt(2) + 1);
    const candidates = [];
    for (let r = 0; r < gridH; r++) {
      for (let c = 0; c < gridW; c++) {
        candidates.push({ r, c });
      }
    }
    // Shuffle
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = bvRandInt(i + 1);
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    // Flip numFlips cells
    let flipped = 0;
    for (const { r, c } of candidates) {
      if (flipped >= numFlips) break;
      candidate[r][c] = !candidate[r][c];
      flipped++;
    }

    const key = bvOccupancyKey(candidate);
    if (usedKeys.has(key)) continue;

    // Check candidate is valid (not all empty, not identical to correct)
    const anyFilled = candidate.some(row => row.some(v => v));
    if (!anyFilled) continue;

    usedKeys.add(key);
    wrongOccs.push(candidate);
  }

  // If we couldn't get 3 unique wrongs, fill with pattern-shifted versions
  while (wrongOccs.length < 3) {
    const fallback = correctOcc.map(row => row.map(() => bvRandInt(2) === 0));
    const key = bvOccupancyKey(fallback);
    if (!usedKeys.has(key) && fallback.some(row => row.some(v => v))) {
      usedKeys.add(key);
      wrongOccs.push(fallback);
    }
  }

  // Build choices array [correct + 3 wrong], shuffled
  const allChoices = [{ occupancy: correctOcc, isCorrect: true }];
  wrongOccs.forEach(o => allChoices.push({ occupancy: o, isCorrect: false }));

  // Shuffle
  for (let i = allChoices.length - 1; i > 0; i--) {
    const j = bvRandInt(i + 1);
    [allChoices[i], allChoices[j]] = [allChoices[j], allChoices[i]];
  }

  // Verify uniqueness: exactly one correct
  const correctCount = allChoices.filter(c => c.isCorrect).length;
  if (correctCount !== 1) {
    // Should not happen — but safety fallback
    return bvGenerateRound(roundIdx);
  }

  return { heights, gridW, gridH, correctOcc, choices: allChoices };
}

// ── Sound Manager ────────────────────────────────────────────
const bvSound = createSoundManager({
  ding(ctx) {
    [523, 659, 784].forEach((freq, i) => {
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
    [392, 494, 523, 659, 784].forEach((freq, i) => {
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
let bvPlayerCount   = 2;
let bvRoundIdx      = 0;
let bvScores        = [];
let bvRoundLog      = [];
let bvCurrentRound  = null;
let bvDqSet         = new Set();
let bvPhase         = 'idle';
let bvTimerHandle   = null;
let bvNextHandle    = null;
let bvTimeRemaining = BV_ROUND_TIME;
let bvGameRounds    = [];
var bvCDInterval    = null;

// ── DOM refs ─────────────────────────────────────────────────
const bvIntroScreen     = document.getElementById('introScreen');
const bvCountdownScreen = document.getElementById('countdownScreen');
const bvCountdownNumber = document.getElementById('countdownNumber');
const bvGameScreen      = document.getElementById('gameScreen');
const bvResultScreen    = document.getElementById('resultScreen');
const bvBackBtn         = document.getElementById('backBtn');
const bvPlayBtn         = document.getElementById('playBtn');
const bvCloseBtn        = document.getElementById('closeBtn');
const bvRetryBtn        = document.getElementById('retryBtn');
const bvHomeBtn         = document.getElementById('homeBtn');
const bvZonesWrap       = document.getElementById('zonesWrap');
const bvQuestionCounter = document.getElementById('questionCounter');
const bvProblemTimer    = document.getElementById('problemTimer');
const bvProblemStatus   = document.getElementById('problemStatus');
const bvScoreBar        = document.getElementById('scoreBar');
const bvBlockSvgWrap    = document.getElementById('blockSvgWrap');
const bvSoundToggle     = document.getElementById('soundToggleIntro');
const bvIntroIllust     = document.getElementById('introIllust');
const bvResultTitle     = document.getElementById('resultTitle');
const bvResultWinner    = document.getElementById('resultWinner');
const bvResultTableHead = document.getElementById('resultTableHead');
const bvResultTableBody = document.getElementById('resultTableBody');
const bvTotalRow        = document.getElementById('totalRow');

// ── Helpers ──────────────────────────────────────────────────
function bvShowScreen(s) {
  [bvIntroScreen, bvCountdownScreen, bvGameScreen, bvResultScreen]
    .forEach(x => x.classList.remove('active'));
  s.classList.add('active');
}

function bvClearTimers() {
  if (bvCDInterval)    { clearInterval(bvCDInterval);   bvCDInterval   = null; }
  if (bvTimerHandle)   { clearInterval(bvTimerHandle);  bvTimerHandle  = null; }
  if (bvNextHandle)    { clearTimeout(bvNextHandle);    bvNextHandle   = null; }
}

function bvUpdateSoundBtn() {
  bvSoundToggle.textContent = bvSound.isMuted() ? '🔇' : '🔊';
}

function bvStartPreGameCountdown(onDone) {
  bvShowScreen(bvCountdownScreen);
  let count = 3;
  bvCountdownNumber.textContent = count;
  bvCDInterval = setInterval(function() {
    count--;
    if (count <= 0) {
      clearInterval(bvCDInterval);
      bvCDInterval = null;
      onDone();
    } else {
      bvCountdownNumber.textContent = count;
      bvCountdownNumber.style.animation = 'none';
      void bvCountdownNumber.offsetHeight;
      bvCountdownNumber.style.animation = '';
    }
  }, 1000);
}

// ── Intro illustration ───────────────────────────────────────
function bvRenderIntroIllust() {
  // Simple iso block stack illustration
  const h = [[2,1],[0,2]];
  const { svg } = bvRenderBlockSvg(h, 2, 2);
  bvIntroIllust.innerHTML = svg;
}
bvRenderIntroIllust();

// ── Player count selection ───────────────────────────────────
document.querySelectorAll('.player-btn').forEach(function(btn) {
  onTap(btn, function() {
    document.querySelectorAll('.player-btn').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    bvPlayerCount = parseInt(btn.dataset.count, 10);
  });
});

onTap(bvSoundToggle, function() { bvSound.toggleMute(); bvUpdateSoundBtn(); });
bvUpdateSoundBtn();

onTap(bvBackBtn,  function() { goHome(); });
onTap(bvCloseBtn, function() { bvClearTimers(); goHome(); });
onTap(bvHomeBtn,  function() { goHome(); });
onTap(bvRetryBtn, function() { bvStartPreGameCountdown(function() { bvStartGame(); }); });
onTap(bvPlayBtn,  function() { bvStartPreGameCountdown(function() { bvStartGame(); }); });

// ── Render problem panel ─────────────────────────────────────
function bvRenderProblem() {
  const { heights, gridW, gridH } = bvCurrentRound;
  const { svg } = bvRenderBlockSvg(heights, gridW, gridH);
  bvBlockSvgWrap.innerHTML = svg;
}

// ── Build zones ──────────────────────────────────────────────
function bvBuildZones() {
  bvZonesWrap.innerHTML = '';
  bvZonesWrap.className = 'zones-wrap p' + bvPlayerCount;

  for (let i = 0; i < bvPlayerCount; i++) {
    const cfg  = BV_PLAYER_CONFIG[i];
    const zone = document.createElement('div');
    zone.className = 'zone ' + cfg.cls;
    zone.dataset.player = i;

    const header = document.createElement('div');
    header.className = 'zone-header';
    header.innerHTML =
      '<span class="zone-label">' + cfg.label + '</span>' +
      '<span class="zone-score-chip" id="bv-score-chip-' + i + '">0점</span>';

    const hint = document.createElement('div');
    hint.className = 'zone-hint';
    hint.textContent = '위에서 본 모양 선택!';

    const choiceList = document.createElement('div');
    choiceList.className = 'choice-list';
    choiceList.id = 'bv-choice-list-' + i;

    zone.appendChild(header);
    zone.appendChild(hint);
    zone.appendChild(choiceList);
    bvZonesWrap.appendChild(zone);
  }
}

function bvGetZone(idx) {
  return bvZonesWrap.querySelector('.zone[data-player="' + idx + '"]');
}

function bvGetChoiceBtns(playerIdx) {
  const list = document.getElementById('bv-choice-list-' + playerIdx);
  return list ? Array.from(list.querySelectorAll('.choice-btn')) : [];
}

function bvUpdateScoreChip(playerIdx) {
  const chip = document.getElementById('bv-score-chip-' + playerIdx);
  if (chip) chip.textContent = bvScores[playerIdx] + '점';
}

// ── Score bar ────────────────────────────────────────────────
function bvBuildScoreBar() {
  bvScoreBar.innerHTML = '';
  for (let i = 0; i < bvPlayerCount; i++) {
    const cfg  = BV_PLAYER_CONFIG[i];
    const chip = document.createElement('div');
    chip.className = 'score-chip';
    chip.innerHTML =
      '<span class="score-chip-dot" style="background:' + cfg.dot + '"></span>' +
      '<span>' + cfg.label + '</span>' +
      '<span class="score-chip-val" id="bv-bar-score-' + i + '">0</span>';
    bvScoreBar.appendChild(chip);
  }
}

function bvUpdateBarScore(playerIdx) {
  const el = document.getElementById('bv-bar-score-' + playerIdx);
  if (el) el.textContent = bvScores[playerIdx];
}

// ── Reset buttons for new round ──────────────────────────────
function bvResetBtnsForRound() {
  const { choices, gridW, gridH } = bvCurrentRound;
  const cellSize = (gridW <= 2 && gridH <= 2) ? 24 : 18;

  for (let i = 0; i < bvPlayerCount; i++) {
    const list = document.getElementById('bv-choice-list-' + i);
    if (!list) continue;
    list.innerHTML = '';

    choices.forEach(function(choice, ci) {
      const btn = document.createElement('button');
      btn.className = 'choice-btn';
      btn.dataset.player = String(i);
      btn.dataset.choiceIdx = String(ci);
      btn.setAttribute('aria-label', 'P' + (i + 1) + ' 선택지 ' + (ci + 1));
      btn.innerHTML = bvRenderTopViewSvg(choice.occupancy, gridW, gridH, cellSize);
      onTap(btn, function() { bvHandleChoiceTap(i, ci, btn, choice.isCorrect); });
      list.appendChild(btn);
    });

    const zone = bvGetZone(i);
    if (zone) zone.classList.remove('dq-zone');
  }
}

function bvDisablePlayerBtns(playerIdx) {
  bvGetChoiceBtns(playerIdx).forEach(function(b) {
    b.classList.add('state-disabled');
    b.disabled = true;
  });
}

// ── Timer logic ──────────────────────────────────────────────
function bvStartCountdown() {
  bvTimeRemaining = BV_ROUND_TIME;
  bvProblemTimer.textContent = bvTimeRemaining;
  bvProblemTimer.classList.remove('urgent');

  bvTimerHandle = setInterval(function() {
    bvTimeRemaining--;
    bvProblemTimer.textContent = bvTimeRemaining;
    if (bvTimeRemaining <= 3) {
      bvProblemTimer.classList.add('urgent');
      bvSound.play('tick');
    }
    if (bvTimeRemaining <= 0) {
      bvClearTimers();
      bvHandleTimeout();
    }
  }, 1000);
}

// ── Choice tap handler ───────────────────────────────────────
function bvHandleChoiceTap(playerIdx, choiceIdx, btn, isCorrect) {
  if (bvPhase !== 'active') return;
  if (bvDqSet.has(playerIdx)) return;

  if (isCorrect) {
    bvResolveRound(playerIdx);
  } else {
    bvSound.play('buzz');
    btn.classList.add('state-wrong');
    bvDqSet.add(playerIdx);

    const zone = bvGetZone(playerIdx);
    const flash = document.createElement('div');
    flash.className = 'penalty-flash';
    flash.textContent = '실격!';
    zone.appendChild(flash);
    flash.addEventListener('animationend', function() { flash.remove(); });

    bvDisablePlayerBtns(playerIdx);
    zone.classList.add('dq-zone');

    // Check all DQ'd
    let anyActive = false;
    for (let i = 0; i < bvPlayerCount; i++) {
      if (!bvDqSet.has(i)) { anyActive = true; break; }
    }
    if (!anyActive) {
      bvClearTimers();
      bvNextHandle = setTimeout(function() { bvHandleTimeout(); }, 300);
    }
  }
}

// ── Correct resolved ─────────────────────────────────────────
function bvResolveRound(winnerIdx) {
  bvPhase = 'done';
  bvClearTimers();
  bvSound.play('ding');

  bvScores[winnerIdx]++;
  bvUpdateScoreChip(winnerIdx);
  bvUpdateBarScore(winnerIdx);

  // Highlight winner's correct button
  bvGetChoiceBtns(winnerIdx).forEach(function(b) {
    const ci = parseInt(b.dataset.choiceIdx, 10);
    if (bvCurrentRound.choices[ci] && bvCurrentRound.choices[ci].isCorrect) {
      b.classList.add('state-correct');
    } else {
      b.classList.add('state-disabled');
      b.disabled = true;
    }
  });

  // Disable others
  for (let i = 0; i < bvPlayerCount; i++) {
    if (i !== winnerIdx) bvDisablePlayerBtns(i);
  }

  bvProblemStatus.textContent = BV_PLAYER_CONFIG[winnerIdx].label + ' 정답!';

  bvRoundLog.push({
    winnerIdx: winnerIdx,
    dqPlayers: Array.from(bvDqSet),
    timedOut: false,
    roundNum: bvRoundIdx + 1,
  });

  bvNextHandle = setTimeout(function() { bvNextRound(); }, BV_RESULT_PAUSE_MS);
}

// ── Timeout ──────────────────────────────────────────────────
function bvHandleTimeout() {
  bvPhase = 'done';
  bvClearTimers();
  bvSound.play('timeout');

  // Reveal correct answer in all zones
  for (let i = 0; i < bvPlayerCount; i++) {
    bvGetChoiceBtns(i).forEach(function(b) {
      const ci = parseInt(b.dataset.choiceIdx, 10);
      if (bvCurrentRound.choices[ci] && bvCurrentRound.choices[ci].isCorrect) {
        b.classList.remove('state-disabled');
        b.classList.add('state-reveal');
        b.disabled = true;
      } else {
        b.classList.add('state-disabled');
        b.disabled = true;
      }
    });
    const zone = bvGetZone(i);
    if (zone) zone.classList.remove('dq-zone');
  }

  bvProblemStatus.textContent = '시간 초과! 정답은 색칠된 모양';

  bvRoundLog.push({
    winnerIdx: -1,
    dqPlayers: Array.from(bvDqSet),
    timedOut: true,
    roundNum: bvRoundIdx + 1,
  });

  bvNextHandle = setTimeout(function() { bvNextRound(); }, BV_RESULT_PAUSE_MS);
}

// ── Load round ───────────────────────────────────────────────
function bvLoadRound() {
  bvPhase        = 'active';
  bvCurrentRound = bvGameRounds[bvRoundIdx];
  bvDqSet        = new Set();

  bvQuestionCounter.textContent = (bvRoundIdx + 1) + ' / ' + BV_TOTAL_ROUNDS;
  bvProblemStatus.textContent   = '';
  bvProblemTimer.classList.remove('urgent');

  bvRenderProblem();
  bvResetBtnsForRound();
  bvStartCountdown();
}

// ── Next round ───────────────────────────────────────────────
function bvNextRound() {
  bvRoundIdx++;
  if (bvRoundIdx >= BV_TOTAL_ROUNDS) {
    bvShowResult();
  } else {
    bvLoadRound();
  }
}

// ── Start game ───────────────────────────────────────────────
function bvStartGame() {
  bvGameRounds = [];
  for (let i = 0; i < BV_TOTAL_ROUNDS; i++) {
    bvGameRounds.push(bvGenerateRound(i));
  }

  bvRoundIdx  = 0;
  bvScores    = new Array(bvPlayerCount).fill(0);
  bvRoundLog  = [];
  bvDqSet     = new Set();
  bvPhase     = 'idle';

  bvClearTimers();
  bvBuildZones();
  bvBuildScoreBar();
  bvShowScreen(bvGameScreen);
  bvLoadRound();
}

// ── Show result ──────────────────────────────────────────────
function bvShowResult() {
  bvClearTimers();
  bvPhase = 'idle';
  bvSound.play('fanfare');

  const maxScore = Math.max.apply(null, bvScores);
  const winners  = bvScores
    .map(function(s, i) { return { s: s, i: i }; })
    .filter(function(x) { return x.s === maxScore; })
    .map(function(x) { return x.i; });

  if (maxScore === 0) {
    bvResultTitle.textContent  = '무승부!';
    bvResultWinner.textContent = '아무도 점수를 얻지 못했어요.';
  } else if (winners.length === 1) {
    const w = winners[0];
    bvResultTitle.textContent  = '게임 종료!';
    bvResultWinner.textContent = BV_PLAYER_CONFIG[w].label + ' 승리! (' + maxScore + '점)';
  } else {
    const labels = winners.map(function(w) { return BV_PLAYER_CONFIG[w].label; }).join(', ');
    bvResultTitle.textContent  = '동점!';
    bvResultWinner.textContent = labels + ' 공동 1위! (' + maxScore + '점)';
  }

  // Table header
  const headRow = document.createElement('tr');
  headRow.innerHTML = '<th>라운드</th>' +
    Array.from({ length: bvPlayerCount }, function(_, i) {
      return '<th><span class="player-dot" style="background:' + BV_PLAYER_CONFIG[i].dot + '"></span>' + BV_PLAYER_CONFIG[i].label + '</th>';
    }).join('');
  bvResultTableHead.innerHTML = '';
  bvResultTableHead.appendChild(headRow);

  bvResultTableBody.innerHTML = '';
  bvRoundLog.forEach(function(log, idx) {
    const tr = document.createElement('tr');
    let cells = '<td>' + (idx + 1) + '라운드</td>';
    for (let i = 0; i < bvPlayerCount; i++) {
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
    bvResultTableBody.appendChild(tr);
  });

  bvTotalRow.innerHTML = '';
  for (let i = 0; i < bvPlayerCount; i++) {
    const cfg   = BV_PLAYER_CONFIG[i];
    const isWin = winners.includes(i) && maxScore > 0;
    const chip  = document.createElement('div');
    chip.className = 'total-chip';
    chip.innerHTML =
      '<span class="chip-dot" style="background:' + cfg.dot + '"></span>' +
      '<span>' + cfg.label + '</span>' +
      '<span class="chip-score" style="color:' + (isWin ? '#2E7D32' : '#555') + '">' + bvScores[i] + '점</span>' +
      (isWin ? '<span style="font-size:1.1rem;">★</span>' : '');
    bvTotalRow.appendChild(chip);
  }

  bvShowScreen(bvResultScreen);
}
