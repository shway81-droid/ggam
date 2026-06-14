/* games/reaction-race/game.js */

'use strict';

// ── Constants ────────────────────────────────────────────────
const TOTAL_ROUNDS  = 5;
const WAIT_MIN_MS   = 1000;
const WAIT_MAX_MS   = 4000;

const PLAYER_CONFIG = [
  { label: 'P1', icon: '🔵', colorClass: 'p-blue',   hex: '#1565C0' },
  { label: 'P2', icon: '🔴', colorClass: 'p-red',    hex: '#C62828' },
  { label: 'P3', icon: '🟠', colorClass: 'p-orange', hex: '#E65100' },
  { label: 'P4', icon: '🟣', colorClass: 'p-purple', hex: '#6A1B9A' },
];

// ── Sound Manager ────────────────────────────────────────────
const sound = createSoundManager({
  beep(ctx) {
    // Short metronome tick: low-pitched beep during wait phase
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type      = 'sine';
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.18);
  },

  go(ctx) {
    // Bright ascending two-tone "GO!" chime
    [523, 659].forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'triangle';
      const t = ctx.currentTime + i * 0.11;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.start(t);
      osc.stop(t + 0.28);
    });
  },

  ding(ctx) {
    // Victory ding — happy major arpeggio
    [523, 659, 784].forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      const t = ctx.currentTime + i * 0.1;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.start(t);
      osc.stop(t + 0.35);
    });
  },

  buzz(ctx) {
    // Harsh buzz for early tap / disqualification
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, ctx.currentTime);
    gain.gain.setValueAtTime(0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.35);
  },

  fanfare(ctx) {
    // Short winner fanfare
    [392, 523, 659, 784].forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'triangle';
      const t = ctx.currentTime + i * 0.13;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      osc.start(t);
      osc.stop(t + 0.4);
    });
  },
});

// ── State ────────────────────────────────────────────────────
let playerCount = 2;
let currentRound = 0;
let scores       = [];       // wins per player
let roundResults = [];       // array of round records: { winner: idx|-1 (tie/timeout), dq: Set<idx> }
let phase        = 'idle';   // idle | waiting | go | result
let waitTimer    = null;
let tickInterval = null;
let nextRoundTimer = null;
let roundActive  = false;

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
const statusPanel  = document.getElementById('statusPanel');
const statusText   = document.getElementById('statusText');
const roundBadge   = document.getElementById('roundBadge');

const soundToggleIntro = document.getElementById('soundToggleIntro');

const resultTitle  = document.getElementById('resultTitle');
const resultWinner = document.getElementById('resultWinner');
const resultTableHead = document.getElementById('resultTableHead');
const resultTableBody = document.getElementById('resultTableBody');
const totalRow     = document.getElementById('totalRow');

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

function randBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function updateSoundToggle(btn) {
  btn.textContent = sound.isMuted() ? '🔇' : '🔊';
}

// ── Sound Toggle ─────────────────────────────────────────────
[soundToggleIntro].forEach(btn => {
  onTap(btn, () => {
    sound.toggleMute();
    [soundToggleIntro].forEach(b => updateSoundToggle(b));
  });
  updateSoundToggle(btn);
});

// ── Player count selection ───────────────────────────────────
setupPlayerSelect(function (n) { playerCount = n; });

// ── Back / Home ──────────────────────────────────────────────
onTap(backBtn, () => goHome());
onTap(closeBtn, () => {
  clearWaitTimer();
  goHome();
});
onTap(homeBtn, () => goHome());
onTap(retryBtn, () => startGame());

// ── PLAY button ──────────────────────────────────────────────
onTap(playBtn, () => startCountdown(() => startGame()));

// ── Build zone grid ──────────────────────────────────────────
function buildZones() {
  zonesWrap.innerHTML = '';
  zonesWrap.className = `zones-wrap p${playerCount}`;

  for (let i = 0; i < playerCount; i++) {
    const cfg  = PLAYER_CONFIG[i];
    const zone = document.createElement('div');
    zone.className = `zone ${cfg.colorClass} state-wait`;
    zone.dataset.player = i;
    zone.innerHTML = `
      <span class="zone-icon">${cfg.icon}</span>
      <span class="zone-label">${cfg.label}</span>
    `;

    // Tap handler for zone
    onTap(zone, (e) => handleZoneTap(i, zone, e));
    zonesWrap.appendChild(zone);
  }
}

function getZone(idx) {
  return zonesWrap.querySelector(`.zone[data-player="${idx}"]`);
}

// ── Ripple visual ────────────────────────────────────────────
function spawnRipple(zone, e) {
  const rect   = zone.getBoundingClientRect();
  const touch  = e.touches ? e.touches[0] : e;
  const x      = (touch ? touch.clientX : rect.left + rect.width  / 2) - rect.left;
  const y      = (touch ? touch.clientY : rect.top  + rect.height / 2) - rect.top;
  const ripple = document.createElement('span');
  ripple.className = 'zone-ripple';
  ripple.style.left   = x + 'px';
  ripple.style.top    = y + 'px';
  ripple.style.width  = ripple.style.height = Math.max(rect.width, rect.height) + 'px';
  ripple.style.marginLeft = ripple.style.marginTop = `-${Math.max(rect.width, rect.height) / 2}px`;
  zone.appendChild(ripple);
  ripple.addEventListener('animationend', () => ripple.remove());
}

// ── Zone tap handler ─────────────────────────────────────────
function handleZoneTap(playerIdx, zone, e) {
  if (!roundActive) return;

  spawnRipple(zone, e);

  if (phase === 'waiting') {
    // Early tap → disqualify this player for the round
    sound.play('buzz');
    disqualifyPlayer(playerIdx, zone);
    return;
  }

  if (phase === 'go') {
    // Valid tap → this player wins the round
    resolveRound(playerIdx);
  }
}

// ── Disqualify a player ──────────────────────────────────────
// Track which players are DQ'd this round
let roundDQ = new Set();

function disqualifyPlayer(idx, zone) {
  if (roundDQ.has(idx)) return; // already DQ'd
  roundDQ.add(idx);
  zone.classList.remove('state-wait', 'state-ready');
  zone.classList.add('state-dq');

  // If all remaining (non-DQ) players are disqualified → no winner this round
  const activePlayers = Array.from({ length: playerCount }, (_, i) => i).filter(i => !roundDQ.has(i));
  if (activePlayers.length === 0) {
    // Everyone DQ'd — nobody wins
    endRound(-1);
  }
}

// ── Game flow ────────────────────────────────────────────────
function startGame() {
  scores       = new Array(playerCount).fill(0);
  roundResults = [];
  currentRound = 0;
  showScreen(gameScreen);
  buildZones();
  nextRound();
}

function nextRound() {
  currentRound++;
  roundDQ      = new Set();
  roundActive  = false;
  phase        = 'idle';

  updateRoundBadge();
  setStatusText('기다려...', false);
  setAllZoneState('state-wait');

  // Small pause before starting the wait phase
  setTimeout(() => {
    startWaitPhase();
  }, 600);
}

function startWaitPhase() {
  phase       = 'waiting';
  roundActive = true;

  // Random wait between WAIT_MIN and WAIT_MAX ms
  const delay = randBetween(WAIT_MIN_MS, WAIT_MAX_MS);

  // Tick a beep every second during the wait to build tension
  let elapsed = 0;
  tickInterval = setInterval(() => {
    elapsed += 800;
    if (elapsed < delay) {
      sound.play('beep');
    }
  }, 800);

  waitTimer = setTimeout(() => {
    clearInterval(tickInterval);
    triggerGo();
  }, delay);
}

function clearWaitTimer() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
  if (waitTimer) {
    clearTimeout(waitTimer);
    waitTimer = null;
  }
  if (tickInterval) {
    clearInterval(tickInterval);
    tickInterval = null;
  }
  if (nextRoundTimer) {
    clearTimeout(nextRoundTimer);
    nextRoundTimer = null;
  }
}

function triggerGo() {
  phase = 'go';
  sound.play('go');
  setStatusText('지금!', true);
  setAllZoneState('state-ready');

  // Flash game screen background
  gameScreen.classList.add('flash-green');
  gameScreen.addEventListener('animationend', () => gameScreen.classList.remove('flash-green'), { once: true });

  // Timeout: if nobody taps within 3s, no winner
  waitTimer = setTimeout(() => {
    if (phase === 'go') {
      endRound(-1);
    }
  }, 3000);
}

function resolveRound(winnerIdx) {
  if (phase !== 'go') return;
  clearWaitTimer();
  phase = 'result';
  roundActive = false;

  sound.play('ding');
  scores[winnerIdx]++;

  // Flash winning zone
  const winZone = getZone(winnerIdx);
  if (winZone) {
    winZone.classList.remove('state-wait', 'state-ready');
    winZone.classList.add('state-win');
  }

  const cfg = PLAYER_CONFIG[winnerIdx];
  setStatusText(`${cfg.label} 승! 🎉`, false);

  recordRound(winnerIdx);
  scheduleNextOrEnd();
}

function endRound(winnerIdx) {
  // winnerIdx === -1 means no winner
  clearWaitTimer();
  phase = 'result';
  roundActive = false;

  if (winnerIdx === -1) {
    setStatusText('무승부 😐', false);
  }
  recordRound(winnerIdx);
  scheduleNextOrEnd();
}

function recordRound(winnerIdx) {
  roundResults.push({ winner: winnerIdx, dq: new Set(roundDQ) });
}

function scheduleNextOrEnd() {
  nextRoundTimer = setTimeout(() => {
    nextRoundTimer = null;
    if (currentRound >= TOTAL_ROUNDS) {
      showResult();
    } else {
      nextRound();
    }
  }, 1800);
}

// ── Zone state helpers ───────────────────────────────────────
function setAllZoneState(stateClass) {
  for (let i = 0; i < playerCount; i++) {
    const z = getZone(i);
    if (!z) continue;
    // Don't override a DQ state
    if (roundDQ && roundDQ.has(i)) continue;
    z.classList.remove('state-wait', 'state-ready', 'state-win', 'state-dq');
    z.classList.add(stateClass);
  }
}

function updateRoundBadge() {
  roundBadge.textContent = `Round ${currentRound} / ${TOTAL_ROUNDS}`;
}

function setStatusText(text, isGo) {
  statusText.textContent = text;
  if (isGo) {
    statusText.classList.add('go');
  } else {
    statusText.classList.remove('go');
  }
}

// ── Result screen ────────────────────────────────────────────
function showResult() {
  sound.play('fanfare');

  // Determine overall winner(s)
  const maxScore = Math.max(...scores);
  const winners  = scores.reduce((acc, s, i) => { if (s === maxScore) acc.push(i); return acc; }, []);

  if (winners.length === 1) {
    const cfg = PLAYER_CONFIG[winners[0]];
    resultTitle.textContent  = '🏆 게임 종료!';
    resultWinner.textContent = `${cfg.label} 최종 우승! 🎉`;
    resultWinner.style.color = cfg.hex;
  } else {
    resultTitle.textContent  = '🤝 게임 종료!';
    resultWinner.textContent = `공동 우승: ${winners.map(i => PLAYER_CONFIG[i].label).join(', ')} 🎉`;
    resultWinner.style.color = '#555';
  }

  // Build table header
  const players = Array.from({ length: playerCount }, (_, i) => PLAYER_CONFIG[i]);
  resultTableHead.innerHTML = `
    <tr>
      <th>라운드</th>
      ${players.map(p => `<th><span class="player-dot" style="background:${p.hex}"></span>${p.label}</th>`).join('')}
    </tr>
  `;

  // Build table body
  resultTableBody.innerHTML = roundResults.map((r, ri) => {
    const cells = players.map((_, pi) => {
      if (r.dq.has(pi)) return `<td class="cell-dq">실격</td>`;
      if (r.winner === pi) return `<td class="cell-win">★ 승</td>`;
      return `<td class="cell-none">—</td>`;
    }).join('');
    return `<tr><td>${ri + 1}</td>${cells}</tr>`;
  }).join('');

  // Build total chips
  totalRow.innerHTML = players.map((p, i) => `
    <div class="total-chip">
      <span class="chip-dot" style="background:${p.hex}"></span>
      <span>${p.label}</span>
      <span class="chip-score">${scores[i]}승</span>
    </div>
  `).join('');

  showScreen(resultScreen);
}
