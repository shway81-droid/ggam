/* games/color-count/game.js */
'use strict';

// ── Color definitions ──────────────────────────────────────────
const COLORS = [
  { id: 'red',    label: '빨간', fill: '#EF5350', stroke: '#B71C1C', btnFill: '#E53935', btnStroke: '#B71C1C' },
  { id: 'blue',   label: '파란', fill: '#29B6F6', stroke: '#0277BD', btnFill: '#039BE5', btnStroke: '#0277BD' },
  { id: 'green',  label: '초록', fill: '#66BB6A', stroke: '#2E7D32', btnFill: '#43A047', btnStroke: '#2E7D32' },
  { id: 'yellow', label: '노란', fill: '#FFEE58', stroke: '#F57F17', btnFill: '#FDD835', btnStroke: '#F57F17' },
];

const COLOR_BY_ID = {};
COLORS.forEach(c => { COLOR_BY_ID[c.id] = c; });

const TOTAL_ROUNDS    = 10;
const SVG_W           = 260;
const SVG_H           = 200;
const CIRCLE_R_MIN    = 12;
const CIRCLE_R_MAX    = 18;
const MIN_CIRCLES     = 10;
const MAX_CIRCLES     = 15;
const MAX_PLACE_TRIES = 200;

// Player configs
const PLAYER_CONFIG = [
  { label: 'P1', hex: '#4A148C', bgTint: 'rgba(74,20,140,0.18)' },
  { label: 'P2', hex: '#880E4F', bgTint: 'rgba(136,14,79,0.18)' },
  { label: 'P3', hex: '#0D47A1', bgTint: 'rgba(13,71,161,0.18)' },
  { label: 'P4', hex: '#1B5E20', bgTint: 'rgba(27,94,32,0.18)' },
];

// ── Sound Manager ──────────────────────────────────────────────
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
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  },
  buzz(ctx) {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(130, ctx.currentTime);
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.38);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.38);
  },
  fanfare(ctx) {
    [392, 523, 659, 784, 1047].forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'triangle';
      const t = ctx.currentTime + i * 0.12;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.28, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
      osc.start(t);
      osc.stop(t + 0.38);
    });
  },
  countdown(ctx) {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.12);
  },
});

// ── State ──────────────────────────────────────────────────────
let playerCount      = 2;
let currentRound     = 0;
let scores           = [];
let roundResults     = [];
let phase            = 'idle';
let currentRoundData = null;   // { targetColorId, targetCount, options[] }
let roundDQ          = new Set();
let roundResolved    = false;
let nextRoundTimer   = null;
let pendingTimers    = [];

// ── DOM ────────────────────────────────────────────────────────
const introScreen      = document.getElementById('introScreen');
const countdownScreen  = document.getElementById('countdownScreen');
const countdownNumber  = document.getElementById('countdownNumber');
const gameScreen       = document.getElementById('gameScreen');
const resultScreen     = document.getElementById('resultScreen');

const backBtn          = document.getElementById('backBtn');
const playBtn          = document.getElementById('playBtn');
const closeBtn         = document.getElementById('closeBtn');
const retryBtn         = document.getElementById('retryBtn');
const homeBtn          = document.getElementById('homeBtn');
const soundToggleIntro = document.getElementById('soundToggleIntro');
const soundIconIntro   = document.getElementById('soundIconIntro');

const zonesWrap        = document.getElementById('zonesWrap');
const roundBadge       = document.getElementById('roundBadge');
const circlesSvg       = document.getElementById('circlesSvg');
const questionText     = document.getElementById('questionText');
const roundStatus      = document.getElementById('roundStatus');

const resultTitle      = document.getElementById('resultTitle');
const resultWinner     = document.getElementById('resultWinner');
const resultTableHead  = document.getElementById('resultTableHead');
const resultTableBody  = document.getElementById('resultTableBody');
const totalRow         = document.getElementById('totalRow');

// ── Helpers ────────────────────────────────────────────────────
function showScreen(s) {
  [introScreen, countdownScreen, gameScreen, resultScreen].forEach(el => el.classList.remove('active'));
  s.classList.add('active');
}

var countdownInterval = null;
function startCountdown(onDone) {
  showScreen(countdownScreen);
  countdownInterval = runCountdown(countdownNumber, onDone);
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Sound toggle ───────────────────────────────────────────────
function updateSoundIcon() {
  const muted = sound.isMuted();
  soundIconIntro.innerHTML = muted
    ? `<path d="M11 5L6 9H2v6h4l5 4V5z" fill="#aaa"/>
       <path d="M17 9l-6 6M23 9l-6 6" stroke="#aaa" stroke-width="1.8" stroke-linecap="round"/>`
    : `<path d="M11 5L6 9H2v6h4l5 4V5z" fill="#555"/>
       <path d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14" stroke="#555" stroke-width="1.8" stroke-linecap="round"/>`;
}
onTap(soundToggleIntro, () => {
  sound.toggleMute();
  updateSoundIcon();
});
updateSoundIcon();

// ── Player count select ────────────────────────────────────────
document.querySelectorAll('.player-btn').forEach(btn => {
  onTap(btn, () => {
    document.querySelectorAll('.player-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    playerCount = parseInt(btn.dataset.count, 10);
  });
});

// ── Nav ────────────────────────────────────────────────────────
onTap(backBtn,  () => { clearAllTimers(); goHome(); });
onTap(closeBtn, () => { clearAllTimers(); goHome(); });
onTap(homeBtn,  () => { clearAllTimers(); goHome(); });
onTap(retryBtn, () => startCountdown(() => startGame()));
onTap(playBtn,  () => startCountdown(() => startGame()));

// ── Circle placement with collision detection ──────────────────
function placeCircles(total) {
  const placed = [];   // { x, y, r, colorId }
  const colorIds = COLORS.map(c => c.id);

  for (let i = 0; i < total; i++) {
    const r = randInt(CIRCLE_R_MIN, CIRCLE_R_MAX);
    let placed_ok = false;

    for (let attempt = 0; attempt < MAX_PLACE_TRIES; attempt++) {
      const x = randInt(r + 4, SVG_W - r - 4);
      const y = randInt(r + 4, SVG_H - r - 4);
      let overlap = false;

      for (const p of placed) {
        const dx = x - p.x;
        const dy = y - p.y;
        const minDist = r + p.r + 3;
        if (dx * dx + dy * dy < minDist * minDist) {
          overlap = true;
          break;
        }
      }

      if (!overlap) {
        placed.push({ x, y, r, colorId: colorIds[i % colorIds.length] });
        placed_ok = true;
        break;
      }
    }

    // If still not placed after max attempts, skip (rare edge case)
    if (!placed_ok && placed.length >= MIN_CIRCLES) break;
  }

  // Shuffle colorId assignment to randomize colors
  const shuffledColors = [];
  for (let i = 0; i < placed.length; i++) {
    shuffledColors.push(randItem(colorIds));
  }
  placed.forEach((p, i) => { p.colorId = shuffledColors[i]; });

  return placed;
}

// ── Round generation ───────────────────────────────────────────
function generateRound() {
  const totalCircles = randInt(MIN_CIRCLES, MAX_CIRCLES);
  const circles = placeCircles(totalCircles);

  // Count per color
  const counts = {};
  COLORS.forEach(c => { counts[c.id] = 0; });
  circles.forEach(c => { counts[c.colorId]++; });

  // Pick a target color (one that has at least 1 circle)
  const nonEmpty = COLORS.filter(c => counts[c.id] > 0);
  const targetColor = randItem(nonEmpty);
  const targetCount = counts[targetColor.id];

  // Generate 4 options: correct + 3 wrong (unique, non-negative, no dup)
  const options = generateOptions(targetCount);

  return { targetColorId: targetColor.id, targetCount, circles, options };
}

function generateOptions(correct) {
  const opts = new Set([correct]);

  // Expand outward from correct until we have 4 unique non-negative values
  for (let delta = 1; opts.size < 4; delta++) {
    if (correct - delta >= 0) opts.add(correct - delta);
    if (opts.size < 4) opts.add(correct + delta);
  }

  return shuffle([...opts]);
}

// ── SVG circle rendering ───────────────────────────────────────
function renderCircles(circles) {
  const parts = circles.map(c => {
    const col = COLOR_BY_ID[c.colorId];
    const highlight = `rgba(255,255,255,0.28)`;
    // Slightly off-center highlight for depth
    const hx = c.x - c.r * 0.25;
    const hy = c.y - c.r * 0.28;
    const hr = c.r * 0.4;
    return `<circle cx="${c.x}" cy="${c.y}" r="${c.r}" fill="${col.fill}" stroke="${col.stroke}" stroke-width="1.5"/>
            <circle cx="${hx}" cy="${hy}" r="${hr}" fill="${highlight}"/>`;
  });
  circlesSvg.innerHTML = parts.join('');
}

// ── Number button SVG ──────────────────────────────────────────
function buildNumBtnSVG(num, color) {
  // Rounded rect button with player's number
  return `
    <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
      <rect x="2" y="2" width="60" height="60" rx="16" ry="16"
        fill="${color.btnFill}" stroke="${color.btnStroke}" stroke-width="2"/>
      <rect x="8" y="8" width="28" height="14" rx="6"
        fill="rgba(255,255,255,0.18)"/>
      <text x="32" y="42" text-anchor="middle"
        font-size="26" font-weight="900"
        font-family="'Pretendard Variable', -apple-system, 'Noto Sans KR', sans-serif"
        fill="#fff"
        style="text-shadow:0 1px 3px rgba(0,0,0,0.3)">${num}</text>
    </svg>`;
}

// ── Zone builder ───────────────────────────────────────────────
function buildZones() {
  zonesWrap.innerHTML = '';
  zonesWrap.className = `zones-wrap p${playerCount}`;

  for (let i = 0; i < playerCount; i++) {
    const cfg  = PLAYER_CONFIG[i];
    const zone = document.createElement('div');
    zone.className = 'zone state-idle';
    zone.dataset.player = i;
    zone.style.background = cfg.bgTint;

    const label = document.createElement('div');
    label.className = 'zone-label';
    label.textContent = cfg.label;

    const grid = document.createElement('div');
    // For 3P bottom zone (full width) or when zone is wide, use row layout
    grid.className = 'num-grid';
    grid.dataset.gridFor = i;

    // We'll render 4 placeholder buttons — will be updated each round
    for (let b = 0; b < 4; b++) {
      const btn = document.createElement('div');
      btn.className = 'num-btn';
      btn.dataset.btnIdx = b;
      btn.dataset.playerZone = i;
      btn.setAttribute('role', 'button');
      btn.setAttribute('aria-label', '숫자 버튼');

      onTap(btn, (e) => {
        e.stopPropagation();
        const num = parseInt(btn.dataset.value, 10);
        handleNumTap(i, num, zone, e);
      });

      grid.appendChild(btn);
    }

    const scoreLine = document.createElement('div');
    scoreLine.className = 'zone-score';
    scoreLine.dataset.scoreFor = i;
    scoreLine.textContent = '0점';

    zone.appendChild(label);
    zone.appendChild(grid);
    zone.appendChild(scoreLine);
    zonesWrap.appendChild(zone);
  }
}

function getZone(idx) {
  return zonesWrap.querySelector(`.zone[data-player="${idx}"]`);
}

function updateZoneScore(idx) {
  const el = zonesWrap.querySelector(`[data-score-for="${idx}"]`);
  if (el) el.textContent = scores[idx] + '점';
}

// Update number buttons in all zones with current round options
function updateNumButtons() {
  const { options, targetColorId } = currentRoundData;
  const targetColor = COLOR_BY_ID[targetColorId];

  for (let i = 0; i < playerCount; i++) {
    const grid = zonesWrap.querySelector(`[data-grid-for="${i}"]`);
    if (!grid) continue;
    const btns = grid.querySelectorAll('.num-btn');
    btns.forEach((btn, b) => {
      const num = options[b];
      btn.dataset.value = num;
      btn.setAttribute('aria-label', `${num}`);
      btn.innerHTML = buildNumBtnSVG(num, targetColor);
    });
  }
}

// ── Ripple ─────────────────────────────────────────────────────
function spawnRipple(zone, e) {
  const rect  = zone.getBoundingClientRect();
  const touch = e.touches ? e.touches[0] : e;
  const x = (touch ? touch.clientX : rect.left + rect.width  / 2) - rect.left;
  const y = (touch ? touch.clientY : rect.top  + rect.height / 2) - rect.top;
  const size = Math.max(rect.width, rect.height);
  const r = document.createElement('span');
  r.className = 'zone-ripple';
  r.style.left      = x + 'px';
  r.style.top       = y + 'px';
  r.style.width     = size + 'px';
  r.style.height    = size + 'px';
  r.style.marginLeft = `-${size / 2}px`;
  r.style.marginTop  = `-${size / 2}px`;
  zone.appendChild(r);
  r.addEventListener('animationend', () => r.remove());
}

// ── Tap handler ─────────────────────────────────────────────────
function handleNumTap(playerIdx, num, zone, e) {
  if (phase !== 'active')       return;
  if (roundDQ.has(playerIdx))   return;
  if (roundResolved)             return;

  spawnRipple(zone, e);

  const isCorrect = (num === currentRoundData.targetCount);

  if (isCorrect) {
    roundResolved = true;
    phase = 'result';
    sound.play('ding');

    scores[playerIdx]++;
    updateZoneScore(playerIdx);

    zone.classList.remove('state-idle', 'state-active', 'state-dq', 'state-wrong');
    zone.classList.add('state-correct');

    // Dim remaining zones
    for (let i = 0; i < playerCount; i++) {
      if (i === playerIdx) continue;
      const z = getZone(i);
      if (!z || roundDQ.has(i)) continue;
      z.classList.remove('state-active', 'state-correct', 'state-wrong');
      z.classList.add('state-idle');
    }

    const cfg = PLAYER_CONFIG[playerIdx];
    roundStatus.textContent = cfg.label + ' 정답! +1점';
    roundStatus.className   = 'round-status correct';

    roundResults.push({
      winner:        playerIdx,
      targetColorId: currentRoundData.targetColorId,
      targetCount:   currentRoundData.targetCount,
      dq:            new Set(roundDQ),
    });

    scheduleNextOrEnd();

  } else {
    sound.play('buzz');
    roundDQ.add(playerIdx);

    // Deduct 1 point (floor at 0)
    scores[playerIdx] = Math.max(0, scores[playerIdx] - 1);
    updateZoneScore(playerIdx);

    // Show "-1" flash
    const penalty = document.createElement('div');
    penalty.className = 'penalty-flash';
    penalty.textContent = '-1';
    zone.style.position = 'relative';
    zone.appendChild(penalty);
    penalty.addEventListener('animationend', () => penalty.remove());

    zone.classList.remove('state-idle', 'state-active', 'state-correct');
    zone.classList.add('state-dq', 'state-wrong');
    pendingTimers.push(setTimeout(() => zone.classList.remove('state-wrong'), 450));

    roundStatus.textContent = PLAYER_CONFIG[playerIdx].label + ' 오답 실격! -1점';
    roundStatus.className   = 'round-status wrong';
    pendingTimers.push(setTimeout(() => {
      if (phase === 'active') {
        roundStatus.textContent = '';
        roundStatus.className   = 'round-status';
      }
    }, 900));

    // All players DQ'd?
    const alive = Array.from({ length: playerCount }, (_, i) => i)
      .filter(i => !roundDQ.has(i));
    if (alive.length === 0) {
      roundResolved = true;
      phase = 'result';
      roundStatus.textContent = '전원 실격 — 무효';
      roundStatus.className   = 'round-status wrong';
      roundResults.push({
        winner:        -1,
        targetColorId: currentRoundData.targetColorId,
        targetCount:   currentRoundData.targetCount,
        dq:            new Set(roundDQ),
      });
      scheduleNextOrEnd();
    }
  }
}

// ── Game flow ───────────────────────────────────────────────────
function startGame() {
  clearAllTimers();
  scores       = new Array(playerCount).fill(0);
  roundResults = [];
  currentRound = 0;
  showScreen(gameScreen);
  buildZones();
  pendingTimers.push(setTimeout(() => nextRound(), 300));
}

function nextRound() {
  currentRound++;
  roundDQ       = new Set();
  roundResolved = false;
  phase         = 'idle';

  roundBadge.textContent  = currentRound + ' / ' + TOTAL_ROUNDS;
  roundStatus.textContent = '준비...';
  roundStatus.className   = 'round-status';
  questionText.textContent = '?';

  // Reset all zones to idle
  for (let i = 0; i < playerCount; i++) {
    const z = getZone(i);
    if (z) {
      z.classList.remove('state-active', 'state-correct', 'state-wrong', 'state-dq');
      z.classList.add('state-idle');
    }
  }

  sound.play('countdown');

  // Clear SVG while loading
  circlesSvg.innerHTML = '';

  pendingTimers.push(setTimeout(() => {
    // Generate round data
    currentRoundData = generateRound();

    // Render circles
    renderCircles(currentRoundData.circles);

    // Render question text
    const col = COLOR_BY_ID[currentRoundData.targetColorId];
    // Use SVG-based colored question text in the question box
    questionText.innerHTML =
      `<span style="color:${col.fill};text-shadow:0 0 8px ${col.fill}66,0 1px 2px rgba(0,0,0,0.5);">${col.label}</span>` +
      ` 원은 몇 개?`;

    // Update number buttons
    updateNumButtons();

    roundStatus.textContent = '';

    // Activate all zones
    for (let i = 0; i < playerCount; i++) {
      const z = getZone(i);
      if (z) {
        z.classList.remove('state-idle', 'state-correct', 'state-wrong', 'state-dq');
        z.classList.add('state-active');
      }
    }
    phase = 'active';
  }, 700));
}

function clearNextRoundTimer() {
  if (nextRoundTimer) {
    clearTimeout(nextRoundTimer);
    nextRoundTimer = null;
  }
}

function clearAllTimers() {
  if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
  clearNextRoundTimer();
  pendingTimers.forEach(id => clearTimeout(id));
  pendingTimers = [];
}

function scheduleNextOrEnd() {
  clearNextRoundTimer();
  nextRoundTimer = setTimeout(() => {
    nextRoundTimer = null;
    if (currentRound >= TOTAL_ROUNDS) {
      showResult();
    } else {
      nextRound();
    }
  }, 1800);
}

// ── Result screen ───────────────────────────────────────────────
function showResult() {
  sound.play('fanfare');

  const maxScore = Math.max(...scores);
  const winners  = scores.reduce((acc, s, i) => {
    if (s === maxScore) acc.push(i);
    return acc;
  }, []);

  if (winners.length === 1) {
    const cfg = PLAYER_CONFIG[winners[0]];
    resultTitle.textContent  = '게임 종료!';
    resultWinner.textContent = cfg.label + ' 최종 우승!';
    resultWinner.style.color = cfg.hex;
  } else {
    resultTitle.textContent  = '게임 종료!';
    resultWinner.textContent = '공동 우승: ' + winners.map(i => PLAYER_CONFIG[i].label).join(', ');
    resultWinner.style.color = '#1565C0';
  }

  const players = Array.from({ length: playerCount }, (_, i) => PLAYER_CONFIG[i]);

  resultTableHead.innerHTML = `
    <tr>
      <th>라운드</th>
      <th>정답</th>
      ${players.map(p => `<th><span class="player-dot" style="background:${p.hex}"></span>${p.label}</th>`).join('')}
    </tr>
  `;

  resultTableBody.innerHTML = roundResults.map((r, ri) => {
    const col = COLOR_BY_ID[r.targetColorId];
    const colorDot = `<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${col.fill};border:1.5px solid ${col.stroke};vertical-align:middle;margin-right:3px;"></span>${col.label} ${r.targetCount}개`;
    const cells = players.map((_, pi) => {
      if (r.dq.has(pi))    return `<td class="cell-dq">실격</td>`;
      if (r.winner === pi) return `<td class="cell-win">★ 정답</td>`;
      return `<td class="cell-none">—</td>`;
    }).join('');
    return `<tr><td>${ri + 1}</td><td>${colorDot}</td>${cells}</tr>`;
  }).join('');

  totalRow.innerHTML = players.map((p, i) => `
    <div class="total-chip">
      <span class="chip-dot" style="background:${p.hex}"></span>
      <span>${p.label}</span>
      <span class="chip-score">${scores[i]}점</span>
    </div>
  `).join('');

  showScreen(resultScreen);
}
