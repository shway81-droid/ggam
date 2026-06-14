/* games/color-touch/game.js */

'use strict';

// ── Color definitions ─────────────────────────────────────
const COLORS = [
  { id: 'red',    label: '빨강', fill: '#EF5350', stroke: '#B71C1C', dark: '#B71C1C' },
  { id: 'blue',   label: '파랑', fill: '#29B6F6', stroke: '#0277BD', dark: '#0277BD' },
  { id: 'green',  label: '초록', fill: '#66BB6A', stroke: '#2E7D32', dark: '#2E7D32' },
  { id: 'yellow', label: '노랑', fill: '#FFEE58', stroke: '#F57F17', dark: '#F57F17' },
];

// Build lookup maps
const COLOR_BY_ID    = {};
const COLOR_BY_LABEL = {};
COLORS.forEach(c => {
  COLOR_BY_ID[c.id]       = c;
  COLOR_BY_LABEL[c.label] = c;
});

const TOTAL_ROUNDS = 10;

// Player zone configs (background tint for zone border/header)
const PLAYER_CONFIG = [
  { label: 'P1', hex: '#4A148C', bgTint: 'rgba(74,20,140,0.18)' },
  { label: 'P2', hex: '#880E4F', bgTint: 'rgba(136,14,79,0.18)' },
  { label: 'P3', hex: '#0D47A1', bgTint: 'rgba(13,71,161,0.18)' },
  { label: 'P4', hex: '#1B5E20', bgTint: 'rgba(27,94,32,0.18)' },
];

// ── Sound Manager ─────────────────────────────────────────
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
      gain.gain.setValueAtTime(0.32, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
      osc.start(t);
      osc.stop(t + 0.32);
    });
  },

  buzz(ctx) {
    // Harsh buzz for wrong answer
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(130, ctx.currentTime);
    gain.gain.setValueAtTime(0.45, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.38);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.38);
  },

  fanfare(ctx) {
    // Winner fanfare arpeggio
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

  countdown(ctx) {
    // Short tick between rounds
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.12);
  },
});

// ── State ─────────────────────────────────────────────────
let playerCount   = 2;
let currentRound  = 0;
let scores        = [];   // points per player
let roundResults  = [];   // { winner: idx|-1, correctId: string, dq: Set }
let phase         = 'idle'; // idle | active | result
let currentRoundData = null; // { correctId, displayColor }
let roundDQ       = new Set();
let roundResolved = false;
let nextRoundTimer   = null;
let pendingTimers    = [];   // tracks all non-nextRound timeouts for cleanup

// ── DOM ───────────────────────────────────────────────────
const introScreen     = document.getElementById('introScreen');
const countdownScreen = document.getElementById('countdownScreen');
const countdownNumber = document.getElementById('countdownNumber');
const gameScreen    = document.getElementById('gameScreen');
const resultScreen  = document.getElementById('resultScreen');

const backBtn       = document.getElementById('backBtn');
const playBtn       = document.getElementById('playBtn');
const closeBtn      = document.getElementById('closeBtn');
const retryBtn      = document.getElementById('retryBtn');
const homeBtn       = document.getElementById('homeBtn');
const soundToggleIntro = document.getElementById('soundToggleIntro');

const zonesWrap     = document.getElementById('zonesWrap');
const stroopPanel   = document.getElementById('stroopPanel');
const stroopWord    = document.getElementById('stroopWord');
const roundBadge    = document.getElementById('roundBadge');
const roundStatus   = document.getElementById('roundStatus');

const resultTitle   = document.getElementById('resultTitle');
const resultWinner  = document.getElementById('resultWinner');
const resultTableHead = document.getElementById('resultTableHead');
const resultTableBody = document.getElementById('resultTableBody');
const totalRow      = document.getElementById('totalRow');

// ── Helpers ───────────────────────────────────────────────
function showScreen(s) {
  [introScreen, countdownScreen, gameScreen, resultScreen].forEach(el => el.classList.remove('active'));
  s.classList.add('active');
}

var countdownInterval = null;
function startCountdown(onDone) {
  showScreen(countdownScreen);
  countdownInterval = runCountdown(countdownNumber, onDone);
}

function randItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function updateSoundToggle(btn) {
  btn.textContent = sound.isMuted() ? '🔇' : '🔊';
}

// ── Sound toggle ──────────────────────────────────────────
onTap(soundToggleIntro, () => {
  sound.toggleMute();
  updateSoundToggle(soundToggleIntro);
});
updateSoundToggle(soundToggleIntro);

// ── Player count select ───────────────────────────────────
document.querySelectorAll('.player-btn').forEach(btn => {
  onTap(btn, () => {
    document.querySelectorAll('.player-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    playerCount = parseInt(btn.dataset.count, 10);
  });
});

// ── Nav buttons ───────────────────────────────────────────
onTap(backBtn,  () => { clearAllTimers(); goHome(); });
onTap(closeBtn, () => { clearAllTimers(); goHome(); });
onTap(homeBtn,  () => { clearAllTimers(); goHome(); });
onTap(retryBtn, () => startCountdown(() => startGame()));
onTap(playBtn,  () => startCountdown(() => startGame()));

// ── SVG color button builder ──────────────────────────────
function buildColorSVG(color) {
  // Inline SVG circle button as per spec
  return `<svg viewBox="0 0 80 80" width="80" height="80" aria-hidden="true">
    <circle cx="40" cy="40" r="36" fill="${color.fill}" stroke="${color.stroke}" stroke-width="3"/>
    <circle cx="30" cy="30" r="8" fill="rgba(255,255,255,0.25)"/>
  </svg>`;
}

// ── Build player zones ────────────────────────────────────
function buildZones() {
  zonesWrap.innerHTML = '';
  zonesWrap.className = `zones-wrap p${playerCount}`;

  for (let i = 0; i < playerCount; i++) {
    const cfg  = PLAYER_CONFIG[i];
    const zone = document.createElement('div');
    zone.className = 'zone state-idle';
    zone.dataset.player = i;
    zone.style.background = cfg.bgTint;

    // Color button grid (2×2)
    const grid = document.createElement('div');
    grid.className = 'color-grid';

    COLORS.forEach(color => {
      const btn = document.createElement('div');
      btn.className   = 'color-btn';
      btn.dataset.colorId = color.id;
      btn.innerHTML   = buildColorSVG(color);
      btn.setAttribute('role', 'button');
      btn.setAttribute('aria-label', color.label);

      onTap(btn, (e) => {
        e.stopPropagation();
        handleColorTap(i, color.id, zone, e);
      });

      grid.appendChild(btn);
    });

    // Zone header info
    const label = document.createElement('div');
    label.className = 'zone-label';
    label.textContent = cfg.label;

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

// ── Ripple ────────────────────────────────────────────────
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

// ── Round generation ──────────────────────────────────────
function generateRound() {
  const correctColor  = randItem(COLORS);        // the meaning
  const useMismatch   = Math.random() < 0.5;     // ~50% mismatch
  let   displayColor;

  if (useMismatch) {
    // Pick a different color for display
    const others = COLORS.filter(c => c.id !== correctColor.id);
    displayColor = randItem(others);
  } else {
    displayColor = correctColor;
  }

  return { correctId: correctColor.id, displayColor };
}

// ── Stroop word display ───────────────────────────────────
function showStroopWord(roundData) {
  const correctColor = COLOR_BY_ID[roundData.correctId];
  stroopWord.textContent  = correctColor.label;
  stroopWord.style.color  = roundData.displayColor.fill;
}

// ── Color tap handler ─────────────────────────────────────
function handleColorTap(playerIdx, colorId, zone, e) {
  if (phase !== 'active') return;
  if (roundDQ.has(playerIdx))  return;
  if (roundResolved)            return;

  spawnRipple(zone, e);

  const isCorrect = (colorId === currentRoundData.correctId);

  if (isCorrect) {
    // First correct tap wins the round
    roundResolved = true;
    phase = 'result';
    sound.play('ding');

    scores[playerIdx]++;
    updateZoneScore(playerIdx);

    zone.classList.remove('state-idle', 'state-active', 'state-dq', 'state-wrong');
    zone.classList.add('state-correct');

    setAllZonesIdle(playerIdx); // dim other zones

    const cfg = PLAYER_CONFIG[playerIdx];
    roundStatus.textContent = cfg.label + ' 정답! +1점';
    roundStatus.className   = 'round-status correct';

    roundResults.push({
      winner:    playerIdx,
      correctId: currentRoundData.correctId,
      dq:        new Set(roundDQ),
    });

    scheduleNextOrEnd();
  } else {
    // Wrong tap → disqualify this player for the round
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

    // Remove wrong class after animation
    pendingTimers.push(setTimeout(() => zone.classList.remove('state-wrong'), 450));

    roundStatus.textContent = PLAYER_CONFIG[playerIdx].label + ' 오답 실격! -1점';
    roundStatus.className   = 'round-status wrong';
    // Reset status text shortly
    pendingTimers.push(setTimeout(() => {
      if (phase === 'active') {
        roundStatus.textContent = '';
        roundStatus.className   = 'round-status';
      }
    }, 800));

    // Check if all remaining players DQ'd
    const alive = Array.from({ length: playerCount }, (_, i) => i)
      .filter(i => !roundDQ.has(i));
    if (alive.length === 0) {
      roundResolved = true;
      phase = 'result';
      roundStatus.textContent = '전원 실격 — 무승부';
      roundStatus.className   = 'round-status wrong';
      roundResults.push({
        winner:    -1,
        correctId: currentRoundData.correctId,
        dq:        new Set(roundDQ),
      });
      scheduleNextOrEnd();
    }
  }
}

// ── Set all zones to idle except winner ───────────────────
function setAllZonesIdle(exceptIdx) {
  for (let i = 0; i < playerCount; i++) {
    if (i === exceptIdx) continue;
    const z = getZone(i);
    if (!z) continue;
    if (!roundDQ.has(i)) {
      z.classList.remove('state-active', 'state-correct', 'state-wrong');
      z.classList.add('state-idle');
    }
  }
}

// ── Game flow ─────────────────────────────────────────────
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
  stroopWord.textContent  = '?';
  stroopWord.style.color  = 'rgba(255,255,255,0.6)';

  // Activate all zones
  for (let i = 0; i < playerCount; i++) {
    const z = getZone(i);
    if (z) {
      z.classList.remove('state-idle', 'state-correct', 'state-wrong', 'state-dq');
      z.classList.add('state-idle');
    }
  }

  // Short pause, then reveal word
  sound.play('countdown');
  pendingTimers.push(setTimeout(() => {
    currentRoundData = generateRound();
    showStroopWord(currentRoundData);
    roundStatus.textContent = '';

    // Activate all zones for tapping
    for (let i = 0; i < playerCount; i++) {
      const z = getZone(i);
      if (z) {
        z.classList.remove('state-idle', 'state-correct', 'state-wrong', 'state-dq');
        z.classList.add('state-active');
      }
    }
    phase = 'active';
  }, 800));
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
  }, 1600);
}

// ── Result screen ─────────────────────────────────────────
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
    resultWinner.style.color = '#9C27B0';
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
    const answerColor = COLOR_BY_ID[r.correctId];
    const colorDot = `<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${answerColor.fill};border:1px solid ${answerColor.stroke};vertical-align:middle;margin-right:4px;"></span>${answerColor.label}`;
    const cells = players.map((_, pi) => {
      if (r.dq.has(pi))   return `<td class="cell-dq">실격</td>`;
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
