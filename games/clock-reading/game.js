/* games/clock-reading/game.js */
'use strict';

// ── Constants ────────────────────────────────────────────────
const TOTAL_ROUNDS = 10;

const PLAYER_CONFIG = [
  { label: 'P1', colorClass: 'p-blue',   hex: '#1565C0' },
  { label: 'P2', colorClass: 'p-red',    hex: '#B71C1C' },
  { label: 'P3', colorClass: 'p-orange', hex: '#E65100' },
  { label: 'P4', colorClass: 'p-teal',   hex: '#00695C' },
];

// ── Sound Manager ────────────────────────────────────────────
const sound = createSoundManager({
  ding(ctx) {
    // Bright correct-answer chime
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
    // Wrong-answer buzz
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(130, ctx.currentTime);
    gain.gain.setValueAtTime(0.45, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.35);
  },
  fanfare(ctx) {
    // End-game fanfare arpeggio
    [392, 523, 659, 784, 1047].forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'triangle';
      const t = ctx.currentTime + i * 0.12;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.32, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
      osc.start(t);
      osc.stop(t + 0.38);
    });
  },
  tick(ctx) {
    // Soft tick between rounds
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.08);
  },
});

// ── State ────────────────────────────────────────────────────
let playerCount   = 2;
let currentRound  = 0;
let scores        = [];
let roundResults  = [];
let roundActive   = false;
let roundDQ       = new Set();
let correctTime   = null;   // { hour, minute }
let nextRoundTimerId = null;

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
const clockFaceWrap = document.getElementById('clockFaceWrap');
const clockFeedback = document.getElementById('clockFeedback');

const soundToggleIntro = document.getElementById('soundToggleIntro');
const soundIconIntro   = document.getElementById('soundIconIntro');

const resultTitle   = document.getElementById('resultTitle');
const resultWinner  = document.getElementById('resultWinner');
const resultTableHead = document.getElementById('resultTableHead');
const resultTableBody = document.getElementById('resultTableBody');
const totalRow      = document.getElementById('totalRow');

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

function updateSoundIcon() {
  const muted = sound.isMuted();
  soundIconIntro.innerHTML = muted
    ? `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
       <line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>`
    : `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
       <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
       <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>`;
}

// ── SVG Clock builder ─────────────────────────────────────────
/**
 * Returns the SVG string for an analog clock showing the given time.
 * @param {number} hour   1–12
 * @param {number} minute 0 or 30
 * @param {number} size   SVG width/height in px
 */
function buildClockSVG(hour, minute, size) {
  const cx = size / 2, cy = size / 2;
  const r  = size * 0.45;          // outer radius of clock face

  // Compute hand angles (degrees from 12 o'clock, clockwise)
  const hourAngleDeg   = (hour % 12) * 30 + minute * 0.5;
  const minuteAngleDeg = minute * 6;

  function polarToXY(angleDeg, length) {
    const rad = (angleDeg - 90) * Math.PI / 180;
    return {
      x: cx + length * Math.cos(rad),
      y: cy + length * Math.sin(rad),
    };
  }

  const hourLen   = r * 0.52;
  const minuteLen = r * 0.72;

  const hEnd = polarToXY(hourAngleDeg,   hourLen);
  const mEnd = polarToXY(minuteAngleDeg, minuteLen);

  // Hour tick marks (12 evenly spaced)
  let ticks = '';
  for (let i = 0; i < 12; i++) {
    const a   = (i * 30 - 90) * Math.PI / 180;
    const isMajor = (i % 3 === 0);
    const inner = r * (isMajor ? 0.80 : 0.86);
    const outer = r * 0.94;
    const x1 = cx + inner * Math.cos(a);
    const y1 = cy + inner * Math.sin(a);
    const x2 = cx + outer * Math.cos(a);
    const y2 = cy + outer * Math.sin(a);
    ticks += `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}"
      stroke="${isMajor ? '#546E7A' : '#90A4AE'}" stroke-width="${isMajor ? 2.2 : 1.4}" stroke-linecap="round"/>`;
  }

  // Cardinal numbers (12, 3, 6, 9)
  const numRadius = r * 0.70;
  const cardinals = [
    { n: '12', a: -90 },
    { n: '3',  a:   0 },
    { n: '6',  a:  90 },
    { n: '9',  a: 180 },
  ];
  let nums = '';
  for (const c of cardinals) {
    const rad = c.a * Math.PI / 180;
    const nx  = cx + numRadius * Math.cos(rad);
    const ny  = cy + numRadius * Math.sin(rad) + 4; // +4 for visual centering
    nums += `<text x="${nx.toFixed(2)}" y="${ny.toFixed(2)}" text-anchor="middle"
      font-size="${size * 0.095}" font-weight="bold" fill="#37474F"
      font-family="'Pretendard Variable',-apple-system,'Noto Sans KR',sans-serif">${c.n}</text>`;
  }

  return `
<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <!-- Face -->
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="#FFFFFF" stroke="#546E7A" stroke-width="2.5"/>
  <!-- Ticks -->
  ${ticks}
  <!-- Numbers -->
  ${nums}
  <!-- Hour hand -->
  <line x1="${cx}" y1="${cy}" x2="${hEnd.x.toFixed(2)}" y2="${hEnd.y.toFixed(2)}"
    stroke="#263238" stroke-width="${size * 0.038}" stroke-linecap="round"/>
  <!-- Minute hand -->
  <line x1="${cx}" y1="${cy}" x2="${mEnd.x.toFixed(2)}" y2="${mEnd.y.toFixed(2)}"
    stroke="#EF5350" stroke-width="${size * 0.026}" stroke-linecap="round"/>
  <!-- Centre dot -->
  <circle cx="${cx}" cy="${cy}" r="${size * 0.038}" fill="#263238"/>
</svg>`.trim();
}

// ── SVG Time button builder ───────────────────────────────────
/**
 * Returns an SVG string of a rounded-rect digital-time button.
 * @param {number} hour
 * @param {number} minute
 * @param {string} fill  Background color
 * @param {number} w     Width
 * @param {number} h     Height
 */
function buildTimeBtnSVG(hour, minute, fill, w, h) {
  const label = `${hour}:${minute === 0 ? '00' : '30'}`;
  return `
<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <rect x="2" y="2" width="${w - 4}" height="${h - 4}" rx="12" ry="12"
    fill="${fill}" stroke="rgba(255,255,255,0.45)" stroke-width="2"/>
  <text x="${w / 2}" y="${h / 2 + 1}" text-anchor="middle" dominant-baseline="middle"
    font-size="${h * 0.38}" font-weight="800" fill="#FFFFFF"
    font-family="'Pretendard Variable',-apple-system,'Noto Sans KR',sans-serif">${label}</text>
</svg>`.trim();
}

// ── Time generation ───────────────────────────────────────────
/**
 * Generates one unique correct time per round.
 * Keeps track of used times for 10 rounds.
 */
let usedTimes = [];

function resetUsedTimes() {
  usedTimes = [];
}

function generateCorrectTime() {
  let h, m, key;
  const maxTries = 200;
  let tries = 0;
  do {
    h = Math.floor(Math.random() * 12) + 1; // 1–12
    m = Math.random() < 0.5 ? 0 : 30;
    key = `${h}:${m}`;
    tries++;
  } while (usedTimes.includes(key) && tries < maxTries);
  usedTimes.push(key);
  return { hour: h, minute: m };
}

/**
 * Generates two wrong-answer times that are distinct from correct and each other.
 * Strategy: ±1 hour, or :00 ↔ :30 swap, or random fallback.
 */
function generateWrongTimes(correct) {
  const wrongs = [];
  const candidates = [];

  // ±1 hour (same minute)
  for (let dh of [-1, 1, -2, 2]) {
    const h = ((correct.hour - 1 + dh + 12) % 12) + 1;
    candidates.push({ hour: h, minute: correct.minute });
  }
  // Same hour, swapped minute
  candidates.push({ hour: correct.hour, minute: correct.minute === 0 ? 30 : 0 });
  // ±1 hour, swapped minute
  for (let dh of [-1, 1]) {
    const h = ((correct.hour - 1 + dh + 12) % 12) + 1;
    candidates.push({ hour: h, minute: correct.minute === 0 ? 30 : 0 });
  }
  // Shuffle candidates
  candidates.sort(() => Math.random() - 0.5);

  for (const c of candidates) {
    if (wrongs.length >= 2) break;
    const key = `${c.hour}:${c.minute}`;
    const correctKey = `${correct.hour}:${correct.minute}`;
    if (key === correctKey) continue;
    if (wrongs.some(w => `${w.hour}:${w.minute}` === key)) continue;
    wrongs.push(c);
  }
  return wrongs;
}

/**
 * Given the correct time, produce an array of 3 shuffled options [{hour,minute,isCorrect}].
 * Each player zone gets the same 3 options but independently shuffled.
 */
function generateOptions(correct) {
  const wrongs = generateWrongTimes(correct);
  const options = [
    { ...correct, isCorrect: true },
    { ...wrongs[0], isCorrect: false },
    { ...wrongs[1], isCorrect: false },
  ];
  // Fisher-Yates shuffle
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return options;
}

// ── Sound Toggle ─────────────────────────────────────────────
onTap(soundToggleIntro, () => {
  sound.toggleMute();
  updateSoundIcon();
});
updateSoundIcon();

// ── Player count selection ────────────────────────────────────
setupPlayerSelect(function (n) { playerCount = n; });

// ── Navigation ───────────────────────────────────────────────
onTap(backBtn, () => { clearNextRoundTimer(); goHome(); });
onTap(closeBtn, () => {
  clearNextRoundTimer();
  goHome();
});
onTap(homeBtn, () => { clearNextRoundTimer(); goHome(); });
onTap(retryBtn, () => startCountdown(() => startGame()));
onTap(playBtn, () => startCountdown(() => startGame()));

// ── Zone building ─────────────────────────────────────────────
function buildZones() {
  zonesWrap.innerHTML = '';
  zonesWrap.className = `zones-wrap p${playerCount}`;

  for (let i = 0; i < playerCount; i++) {
    const cfg  = PLAYER_CONFIG[i];
    const zone = document.createElement('div');
    zone.className = `zone ${cfg.colorClass} state-wait`;
    zone.dataset.player = i;

    // Zone label
    const labelEl = document.createElement('span');
    labelEl.className = 'zone-label';
    labelEl.textContent = cfg.label;

    // Time options container
    const optionsEl = document.createElement('div');
    optionsEl.className = 'time-options';
    optionsEl.dataset.player = i;

    zone.appendChild(optionsEl);
    zone.appendChild(labelEl);
    zonesWrap.appendChild(zone);
  }
}

function getZone(idx) {
  return zonesWrap.querySelector(`.zone[data-player="${idx}"]`);
}

function getOptionsEl(idx) {
  return zonesWrap.querySelector(`.time-options[data-player="${idx}"]`);
}

// ── Render time buttons into a zone ──────────────────────────
function renderTimeButtons(playerIdx, options) {
  const container = getOptionsEl(playerIdx);
  if (!container) return;
  container.innerHTML = '';

  const cfg = PLAYER_CONFIG[playerIdx];
  // Determine button size based on layout
  const btnW = 68, btnH = 54;
  // Slightly darker shade for button BG
  const btnFill = darkenHex(cfg.hex, 20);

  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'time-btn';
    btn.setAttribute('aria-label', `${opt.hour}시 ${opt.minute === 0 ? '정각' : '반'}`);
    btn.innerHTML = buildTimeBtnSVG(opt.hour, opt.minute, btnFill, btnW, btnH);
    btn.dataset.correct = opt.isCorrect ? '1' : '0';

    onTap(btn, (e) => {
      e.stopPropagation();
      if (!roundActive) return;
      if (roundDQ.has(playerIdx)) return;
      handleAnswer(playerIdx, opt.isCorrect, e);
    });

    container.appendChild(btn);
  });
}

/**
 * Rough hex darkening — shifts each RGB channel down by `amount`.
 */
function darkenHex(hex, amount) {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const r = Math.max(0, parseInt(c.slice(0, 2), 16) - amount);
  const g = Math.max(0, parseInt(c.slice(2, 4), 16) - amount);
  const b = Math.max(0, parseInt(c.slice(4, 6), 16) - amount);
  return `rgb(${r},${g},${b})`;
}

// ── Ripple visual ─────────────────────────────────────────────
function spawnRipple(zone, e) {
  const rect  = zone.getBoundingClientRect();
  const touch = e.touches ? e.touches[0] : (e.changedTouches ? e.changedTouches[0] : e);
  const x = (touch ? touch.clientX : rect.left + rect.width / 2) - rect.left;
  const y = (touch ? touch.clientY : rect.top  + rect.height / 2) - rect.top;
  const size = Math.max(rect.width, rect.height);
  const ripple = document.createElement('span');
  ripple.className = 'zone-ripple';
  ripple.style.cssText = `left:${x}px;top:${y}px;width:${size}px;height:${size}px;margin-left:-${size/2}px;margin-top:-${size/2}px`;
  zone.appendChild(ripple);
  ripple.addEventListener('animationend', () => ripple.remove());
}

// ── Answer handling ───────────────────────────────────────────
function handleAnswer(playerIdx, isCorrect, e) {
  const zone = getZone(playerIdx);
  if (zone) spawnRipple(zone, e);

  if (isCorrect) {
    // This player answered correctly first
    sound.play('ding');
    scores[playerIdx]++;
    roundDQ.add('resolved'); // marker so no other player can score

    if (zone) {
      zone.classList.remove('state-wait', 'state-active', 'state-dq');
      zone.classList.add('state-correct');
    }

    const cfg = PLAYER_CONFIG[playerIdx];
    clockFeedback.textContent = `${cfg.label} 정답!`;
    clockFeedback.style.background = 'rgba(46,125,50,0.85)';

    recordRound(playerIdx);
    roundActive = false;
    scheduleNextOrEnd();
  } else {
    // Wrong answer — disqualify this player for the round
    sound.play('buzz');
    roundDQ.add(playerIdx);

    // Deduct 1 point (floor at 0)
    scores[playerIdx] = Math.max(0, scores[playerIdx] - 1);

    if (zone) {
      zone.classList.remove('state-wait', 'state-active');
      zone.classList.add('state-dq');

      // Show "-1" flash
      const penalty = document.createElement('div');
      penalty.className = 'penalty-flash';
      penalty.textContent = '-1';
      zone.style.position = 'relative';
      zone.appendChild(penalty);
      penalty.addEventListener('animationend', () => penalty.remove());
    }

    // Check if all players are disqualified (or already resolved)
    const activePlayers = Array.from({ length: playerCount }, (_, i) => i)
      .filter(i => !roundDQ.has(i));

    if (activePlayers.length === 0) {
      // All players either DQ'd or resolved — end round
      if (!roundDQ.has('resolved')) {
        clockFeedback.textContent = '모두 실격!';
        clockFeedback.style.background = 'rgba(183,28,28,0.85)';
        recordRound(-1);
        roundActive = false;
        scheduleNextOrEnd();
      }
    }
  }
}

// ── Timer cleanup ─────────────────────────────────────────────
function clearNextRoundTimer() {
  if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
  if (nextRoundTimerId) {
    clearTimeout(nextRoundTimerId);
    nextRoundTimerId = null;
  }
}

// ── Game flow ─────────────────────────────────────────────────
function startGame() {
  clearNextRoundTimer();
  scores        = new Array(playerCount).fill(0);
  roundResults  = [];
  currentRound  = 0;
  resetUsedTimes();
  showScreen(gameScreen);
  buildZones();
  nextRound();
}

function nextRound() {
  clearNextRoundTimer();
  currentRound++;
  roundDQ      = new Set();
  roundActive  = false;
  correctTime  = null;

  roundBadge.textContent = `${currentRound} / ${TOTAL_ROUNDS}`;
  clockFeedback.textContent = '';
  clockFeedback.style.background = 'transparent';

  // Brief "get ready" pause
  clockFaceWrap.innerHTML = '<svg viewBox="0 0 140 140" width="140" height="140"><circle cx="70" cy="70" r="63" fill="#ECEFF1" stroke="#90A4AE" stroke-width="2.5"/></svg>';

  setAllZoneState('state-wait');
  clearTimeButtons();

  nextRoundTimerId = setTimeout(() => {
    nextRoundTimerId = null;
    sound.play('tick');
    presentRound();
  }, 700);
}

function presentRound() {
  correctTime = generateCorrectTime();

  // Render clock
  clockFaceWrap.innerHTML = buildClockSVG(correctTime.hour, correctTime.minute, 140);

  // Render options in each zone
  for (let i = 0; i < playerCount; i++) {
    const options = generateOptions(correctTime);
    renderTimeButtons(i, options);
  }

  setAllZoneState('state-active');
  roundActive = true;
}

function clearTimeButtons() {
  for (let i = 0; i < playerCount; i++) {
    const el = getOptionsEl(i);
    if (el) el.innerHTML = '';
  }
}

function setAllZoneState(stateClass) {
  for (let i = 0; i < playerCount; i++) {
    const z = getZone(i);
    if (!z) continue;
    z.classList.remove('state-wait', 'state-active', 'state-dq', 'state-correct', 'state-wrong');
    z.classList.add(stateClass);
  }
}

function recordRound(winnerIdx) {
  roundResults.push({ winner: winnerIdx, dq: new Set(roundDQ) });
}

function scheduleNextOrEnd() {
  nextRoundTimerId = setTimeout(() => {
    nextRoundTimerId = null;
    if (currentRound >= TOTAL_ROUNDS) {
      showResult();
    } else {
      nextRound();
    }
  }, 1600);
}

// ── Result screen ─────────────────────────────────────────────
function showResult() {
  sound.play('fanfare');

  const maxScore = Math.max(...scores);
  const winners  = scores.reduce((acc, s, i) => { if (s === maxScore) acc.push(i); return acc; }, []);

  if (winners.length === 1) {
    const cfg = PLAYER_CONFIG[winners[0]];
    resultTitle.textContent  = '게임 종료!';
    resultWinner.textContent = `${cfg.label} 최종 우승!`;
    resultWinner.style.color = cfg.hex;
  } else {
    resultTitle.textContent  = '게임 종료!';
    resultWinner.textContent = `공동 우승: ${winners.map(i => PLAYER_CONFIG[i].label).join(', ')}`;
    resultWinner.style.color = '#546E7A';
  }

  // Table header
  const players = Array.from({ length: playerCount }, (_, i) => PLAYER_CONFIG[i]);
  resultTableHead.innerHTML = `
    <tr>
      <th>라운드</th>
      ${players.map(p => `<th><span class="player-dot" style="background:${p.hex}"></span>${p.label}</th>`).join('')}
    </tr>
  `;

  // Table body
  resultTableBody.innerHTML = roundResults.map((r, ri) => {
    const cells = players.map((_, pi) => {
      if (r.dq.has(pi)) return `<td class="cell-dq">실격</td>`;
      if (r.winner === pi) return `<td class="cell-win">정답</td>`;
      return `<td class="cell-none">—</td>`;
    }).join('');
    return `<tr><td>${ri + 1}</td>${cells}</tr>`;
  }).join('');

  // Total chips
  totalRow.innerHTML = players.map((p, i) => `
    <div class="total-chip">
      <span class="chip-dot" style="background:${p.hex}"></span>
      <span>${p.label}</span>
      <span class="chip-score">${scores[i]}점</span>
    </div>
  `).join('');

  showScreen(resultScreen);
}
