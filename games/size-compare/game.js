/* games/size-compare/game.js */
'use strict';

// ── Constants ────────────────────────────────────────────────
const TOTAL_ROUNDS = 15;

const PLAYER_CONFIG = [
  { label: 'P1', colorClass: 'p-blue',   hex: '#1565C0', arrowFill: '#42A5F5', arrowStroke: '#1565C0' },
  { label: 'P2', colorClass: 'p-red',    hex: '#B71C1C', arrowFill: '#EF5350', arrowStroke: '#B71C1C' },
  { label: 'P3', colorClass: 'p-orange', hex: '#E65100', arrowFill: '#FFA726', arrowStroke: '#E65100' },
  { label: 'P4', colorClass: 'p-purple', hex: '#4A148C', arrowFill: '#AB47BC', arrowStroke: '#4A148C' },
];

// Number circle colors per player
const NUM_COLORS = [
  { fill: '#29B6F6', stroke: '#0277BD' },
  { fill: '#EF5350', stroke: '#B71C1C' },
  { fill: '#FFA726', stroke: '#E65100' },
  { fill: '#AB47BC', stroke: '#4A148C' },
];

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
    osc.frequency.setValueAtTime(110, ctx.currentTime);
    gain.gain.setValueAtTime(0.45, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.35);
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
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
      osc.start(t);
      osc.stop(t + 0.38);
    });
  },
});

// ── State ────────────────────────────────────────────────────
let playerCount  = 2;
let difficulty   = 'easy';   // 'easy' | 'normal'
let currentRound = 0;
let scores       = [];       // points per player
let roundResults = [];       // { winner: idx | -1, dq: Set<idx> }
let numLeft      = 0;
let numRight     = 0;
let roundActive  = false;
let roundDQ      = new Set();

// timers
let nextRoundTimer = null;

// ── DOM references ───────────────────────────────────────────
const introScreen     = document.getElementById('introScreen');
const countdownScreen = document.getElementById('countdownScreen');
const countdownNumber = document.getElementById('countdownNumber');
const gameScreen   = document.getElementById('gameScreen');
const resultScreen = document.getElementById('resultScreen');

const backBtn      = document.getElementById('backBtn');
const playBtn      = document.getElementById('playBtn');
const closeBtn     = document.getElementById('closeBtn');
const retryBtn     = document.getElementById('retryBtn');
const homeBtn      = document.getElementById('homeBtn');

const zonesWrap    = document.getElementById('zonesWrap');
const roundBadge   = document.getElementById('roundBadge');
const roundMsg     = document.getElementById('roundMsg');
const numLeftEl    = document.getElementById('numLeft');
const numRightEl   = document.getElementById('numRight');

const soundToggleIntro = document.getElementById('soundToggleIntro');

const resultTitle      = document.getElementById('resultTitle');
const resultWinner     = document.getElementById('resultWinner');
const resultTableHead  = document.getElementById('resultTableHead');
const resultTableBody  = document.getElementById('resultTableBody');
const totalRow         = document.getElementById('totalRow');

// ── Helpers ──────────────────────────────────────────────────
function showScreen(screen) {
  [introScreen, countdownScreen, gameScreen, resultScreen].forEach(s => s.classList.remove('active'));
  screen.classList.add('active');
}

var countdownInterval = null;
function startCountdown(onDone) {
  showScreen(countdownScreen);
  countdownInterval = runCountdown(countdownNumber, onDone);
}


function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateNumbers() {
  let a, b;
  if (difficulty === 'easy') {
    do {
      a = randInt(1, 9);
      b = randInt(1, 9);
    } while (a === b);
  } else {
    do {
      a = randInt(10, 99);
      b = randInt(10, 99);
    } while (a === b);
  }
  return [a, b];
}

// ── SVG Builders ─────────────────────────────────────────────
function makeSvgNumber(num, fill, stroke) {
  const fontSize = num >= 100 ? 28 : num >= 10 ? 36 : 44;
  return `<svg viewBox="0 0 120 120" width="110" height="110" xmlns="http://www.w3.org/2000/svg">
    <circle cx="60" cy="60" r="55" fill="${fill}" stroke="${stroke}" stroke-width="3"/>
    <text x="60" y="68" text-anchor="middle" dominant-baseline="middle"
          font-size="${fontSize}" font-weight="900" fill="#FFF"
          font-family="-apple-system,sans-serif">${num}</text>
  </svg>`;
}

function makeSvgArrowLeft(fill, stroke) {
  return `<svg viewBox="0 0 80 80" width="72" height="72" xmlns="http://www.w3.org/2000/svg">
    <circle cx="40" cy="40" r="36" fill="${fill}" stroke="${stroke}" stroke-width="3"/>
    <polygon points="26,40 46,24 46,56" fill="#FFF"/>
  </svg>`;
}

function makeSvgArrowRight(fill, stroke) {
  return `<svg viewBox="0 0 80 80" width="72" height="72" xmlns="http://www.w3.org/2000/svg">
    <circle cx="40" cy="40" r="36" fill="${fill}" stroke="${stroke}" stroke-width="3"/>
    <polygon points="54,40 34,24 34,56" fill="#FFF"/>
  </svg>`;
}

// ── Sound Toggle ─────────────────────────────────────────────
setupSoundToggle(sound, soundToggleIntro);

// ── Intro selectors ──────────────────────────────────────────
setupPlayerSelect(function (n) { playerCount = n; });

document.querySelectorAll('.diff-btn').forEach(btn => {
  onTap(btn, () => {
    document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    difficulty = btn.dataset.diff;
  });
});

// ── Nav ──────────────────────────────────────────────────────
onTap(backBtn,  () => { clearAllTimers(); goHome(); });
onTap(closeBtn, () => { clearAllTimers(); goHome(); });
onTap(homeBtn,  () => { clearAllTimers(); goHome(); });
onTap(retryBtn, () => startCountdown(() => startGame()));
onTap(playBtn,  () => startCountdown(() => startGame()));

// ── Timer cleanup ─────────────────────────────────────────────
function clearAllTimers() {
  if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
  if (nextRoundTimer) {
    clearTimeout(nextRoundTimer);
    nextRoundTimer = null;
  }
}

// ── Build zones ──────────────────────────────────────────────
function buildZones() {
  zonesWrap.innerHTML = '';
  zonesWrap.className = `zones-wrap p${playerCount}`;

  for (let i = 0; i < playerCount; i++) {
    const cfg  = PLAYER_CONFIG[i];
    const zone = document.createElement('div');
    zone.className = `zone ${cfg.colorClass} state-wait`;
    zone.dataset.player = i;

    // Determine zone rotation for 3P bottom player readability
    const isBottomCenter = (playerCount === 3 && i === 2);

    zone.innerHTML = `
      <div class="zone-label">${cfg.label}</div>
      <div class="zone-score" id="score-${i}">0점</div>
      <div class="arrows-row">
        <button class="arrow-btn" data-player="${i}" data-side="left" aria-label="왼쪽 선택">
          ${makeSvgArrowLeft(cfg.arrowFill, cfg.arrowStroke)}
        </button>
        <button class="arrow-btn" data-player="${i}" data-side="right" aria-label="오른쪽 선택">
          ${makeSvgArrowRight(cfg.arrowFill, cfg.arrowStroke)}
        </button>
      </div>
    `;

    // Tap handlers for each arrow button
    const leftBtn  = zone.querySelector('[data-side="left"]');
    const rightBtn = zone.querySelector('[data-side="right"]');
    onTap(leftBtn,  (e) => handleArrowTap(i, 'left',  zone, e));
    onTap(rightBtn, (e) => handleArrowTap(i, 'right', zone, e));

    zonesWrap.appendChild(zone);
  }
}

function getZone(idx) {
  return zonesWrap.querySelector(`.zone[data-player="${idx}"]`);
}

// ── Ripple ────────────────────────────────────────────────────
function spawnRipple(btn, e) {
  const zone   = btn.closest('.zone');
  const rect   = zone.getBoundingClientRect();
  const touch  = e.touches ? e.touches[0] : e;
  const x      = (touch ? touch.clientX : rect.left + rect.width  / 2) - rect.left;
  const y      = (touch ? touch.clientY : rect.top  + rect.height / 2) - rect.top;
  const size   = Math.max(rect.width, rect.height);
  const ripple = document.createElement('span');
  ripple.className  = 'zone-ripple';
  ripple.style.left = x + 'px';
  ripple.style.top  = y + 'px';
  ripple.style.width = ripple.style.height = size + 'px';
  ripple.style.marginLeft = ripple.style.marginTop = `-${size / 2}px`;
  zone.appendChild(ripple);
  ripple.addEventListener('animationend', () => ripple.remove());
}

// ── Arrow tap handler ─────────────────────────────────────────
function handleArrowTap(playerIdx, side, zone, e) {
  if (!roundActive) return;
  if (roundDQ.has(playerIdx)) return;

  spawnRipple(e.currentTarget || e.target, e);

  // Determine correctness
  const bigger = numLeft > numRight ? 'left' : 'right';
  const correct = (side === bigger);

  if (correct) {
    resolveRound(playerIdx);
  } else {
    // Wrong answer: disqualify this player for the round
    sound.play('buzz');
    disqualifyPlayer(playerIdx, zone);
  }
}

// ── Disqualify ────────────────────────────────────────────────
function disqualifyPlayer(idx, zone) {
  if (roundDQ.has(idx)) return;
  roundDQ.add(idx);
  zone.classList.remove('state-wait', 'state-active');
  zone.classList.add('state-dq');
  // Disable arrow buttons in this zone
  zone.querySelectorAll('.arrow-btn').forEach(b => b.disabled = true);

  // Deduct 1 point (floor at 0)
  scores[idx] = Math.max(0, scores[idx] - 1);
  updateScoreDisplay(idx);

  // Show "-1" flash
  const penalty = document.createElement('div');
  penalty.className = 'penalty-flash';
  penalty.textContent = '-1';
  zone.style.position = 'relative';
  zone.appendChild(penalty);
  penalty.addEventListener('animationend', () => penalty.remove());

  // If all players DQ'd, nobody wins
  const remaining = Array.from({ length: playerCount }, (_, i) => i).filter(i => !roundDQ.has(i));
  if (remaining.length === 0) {
    endRound(-1);
  }
}

// ── Game flow ─────────────────────────────────────────────────
function startGame() {
  clearAllTimers();
  scores       = new Array(playerCount).fill(0);
  roundResults = [];
  currentRound = 0;
  showScreen(gameScreen);
  buildZones();
  nextRound();
}

function nextRound() {
  clearAllTimers();
  currentRound++;
  roundDQ     = new Set();
  roundActive = false;

  updateRoundBadge();
  setRoundMsg('');
  setAllZoneState('state-wait');

  // Generate numbers
  const [a, b] = generateNumbers();
  numLeft  = a;
  numRight = b;

  // Render SVG circles with alternating colors per round
  const colorIdx = (currentRound - 1) % NUM_COLORS.length;
  const nc = NUM_COLORS[colorIdx];
  numLeftEl.innerHTML  = makeSvgNumber(a, nc.fill, nc.stroke);
  numRightEl.innerHTML = makeSvgNumber(b, nc.fill, nc.stroke);

  // Brief pause then activate
  nextRoundTimer = setTimeout(() => {
    nextRoundTimer = null;
    activateRound();
  }, 500);
}

function activateRound() {
  setAllZoneState('state-active');
  // Re-enable buttons (they might have been disabled)
  zonesWrap.querySelectorAll('.arrow-btn').forEach(b => b.disabled = false);
  roundActive = true;
  setRoundMsg('더 큰 숫자를 골라라!');
}

function resolveRound(winnerIdx) {
  if (!roundActive) return;
  roundActive = false;

  sound.play('ding');
  scores[winnerIdx]++;

  // Update score display
  updateScoreDisplay(winnerIdx);

  const zone = getZone(winnerIdx);
  if (zone) {
    zone.classList.remove('state-wait', 'state-active');
    zone.classList.add('state-correct');
  }

  const cfg = PLAYER_CONFIG[winnerIdx];
  setRoundMsg(`${cfg.label} 정답! +1점`);

  roundResults.push({ winner: winnerIdx, dq: new Set(roundDQ) });

  nextRoundTimer = setTimeout(() => {
    nextRoundTimer = null;
    if (currentRound >= TOTAL_ROUNDS) {
      showResult();
    } else {
      nextRound();
    }
  }, 1400);
}

function endRound(winnerIdx) {
  roundActive = false;
  if (winnerIdx === -1) {
    setRoundMsg('모두 탈락! 다음 라운드...');
  }
  roundResults.push({ winner: -1, dq: new Set(roundDQ) });

  nextRoundTimer = setTimeout(() => {
    nextRoundTimer = null;
    if (currentRound >= TOTAL_ROUNDS) {
      showResult();
    } else {
      nextRound();
    }
  }, 1400);
}

// ── Zone state helpers ────────────────────────────────────────
function setAllZoneState(stateClass) {
  for (let i = 0; i < playerCount; i++) {
    const z = getZone(i);
    if (!z) continue;
    if (roundDQ && roundDQ.has(i)) continue;
    z.classList.remove('state-wait', 'state-active', 'state-correct', 'state-wrong', 'state-dq');
    z.classList.add(stateClass);
  }
}

function updateRoundBadge() {
  roundBadge.textContent = `${currentRound} / ${TOTAL_ROUNDS}`;
}

function setRoundMsg(msg) {
  roundMsg.textContent = msg;
}

function updateScoreDisplay(idx) {
  const el = document.getElementById(`score-${idx}`);
  if (el) el.textContent = `${scores[idx]}점`;
}

// ── Result screen ─────────────────────────────────────────────
function showResult() {
  sound.play('fanfare');

  const maxScore = Math.max(...scores);
  const winners  = scores.reduce((acc, s, i) => { if (s === maxScore) acc.push(i); return acc; }, []);

  if (winners.length === 1) {
    const cfg = PLAYER_CONFIG[winners[0]];
    resultTitle.textContent  = '게임 종료!';
    resultWinner.textContent = `${cfg.label} 최종 우승! (${maxScore}점)`;
    resultWinner.style.color = cfg.hex;
  } else {
    resultTitle.textContent  = '게임 종료!';
    resultWinner.textContent = `공동 우승: ${winners.map(i => PLAYER_CONFIG[i].label).join(', ')} (${maxScore}점)`;
    resultWinner.style.color = '#FF9800';
  }

  const players = Array.from({ length: playerCount }, (_, i) => PLAYER_CONFIG[i]);

  resultTableHead.innerHTML = `
    <tr>
      <th>라운드</th>
      ${players.map(p => `<th><span class="player-dot" style="background:${p.hex}"></span>${p.label}</th>`).join('')}
    </tr>
  `;

  resultTableBody.innerHTML = roundResults.map((r, ri) => {
    const cells = players.map((_, pi) => {
      if (r.dq.has(pi)) return `<td class="cell-dq">오답</td>`;
      if (r.winner === pi) return `<td class="cell-win">★ 정답</td>`;
      return `<td class="cell-none">—</td>`;
    }).join('');
    return `<tr><td>${ri + 1}</td>${cells}</tr>`;
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
