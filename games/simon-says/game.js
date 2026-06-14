/* games/simon-says/game.js */

'use strict';

// ── Constants ────────────────────────────────────────────────
const TOTAL_ROUNDS       = 10;
const SIMON_PROBABILITY  = 0.6;    // "가라사대"가 붙을 확률
const RESPONSE_WINDOW_MS = 4000;   // 지시 후 반응 제한 시간 (함정: 4초 버티면 통과)
const REST_MS            = 1200;   // 라운드 간 휴식
const PREP_START_MS      = 1500;   // 1라운드 준비 시간
const PREP_MIN_MS        = 600;    // 후반 라운드 최소 준비 시간 (점점 빨라짐)

const ACTIONS = [
  { emoji: '✋', name: '손!' },
  { emoji: '👏', name: '박수!' },
  { emoji: '🙌', name: '만세!' },
  { emoji: '👍', name: '엄지!' },
];

const PLAYER_CONFIG = [
  { label: 'P1', hex: '#1565C0' },
  { label: 'P2', hex: '#C62828' },
  { label: 'P3', hex: '#2E7D32' },
  { label: 'P4', hex: '#E65100' },
];

// ── Sound Manager ────────────────────────────────────────────
const sound = createSoundManager({
  tick(ctx) {
    // 지시문 등장 알림 — 짧고 또렷한 블립
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'square';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.12);
  },

  correct(ctx) {
    // 정답 — 밝은 상승 아르페지오
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
    // 함정에 걸렸을 때 — 거친 버즈
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(70, ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.45, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.35);
  },

  safe(ctx) {
    // 잘 참았어요 — 부드러운 두 음 차임
    [392, 523].forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'triangle';
      const t = ctx.currentTime + i * 0.14;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.start(t);
      osc.stop(t + 0.35);
    });
  },

  win(ctx) {
    // 최종 우승 팡파르
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
let playerCount   = 2;
let currentRound  = 0;
let scores        = [];      // 누적 점수 (음수 가능)
let roundResults  = [];      // { simon, action, deltas: [] }
let phase         = 'idle';  // idle | prep | active | rest
let currentSimon  = false;   // 이번 라운드 "가라사대" 여부
let currentAction = null;
let simonClaimed  = false;   // 가라사대 라운드에서 정답자가 나왔는지
let roundDeltas   = [];      // 이번 라운드 플레이어별 득점
let trapPressed   = new Set();

let prepTimer   = null;
let windowTimer = null;
let restTimer   = null;

// ── DOM references ───────────────────────────────────────────
const introScreen     = document.getElementById('introScreen');
const countdownScreen = document.getElementById('countdownScreen');
const countdownNumber = document.getElementById('countdownNumber');
const gameScreen      = document.getElementById('gameScreen');
const resultScreen    = document.getElementById('resultScreen');

const backBtn  = document.getElementById('backBtn');
const playBtn  = document.getElementById('playBtn');
const closeBtn = document.getElementById('closeBtn');
const retryBtn = document.getElementById('retryBtn');
const homeBtn  = document.getElementById('homeBtn');

const zonesWrap       = document.getElementById('zonesWrap');
const questionCounter = document.getElementById('questionCounter');
const commandDisplay  = document.getElementById('commandDisplay');
const problemStatus   = document.getElementById('problemStatus');
const scoreBar        = document.getElementById('scoreBar');

const soundToggleIntro = document.getElementById('soundToggleIntro');

const resultTitle     = document.getElementById('resultTitle');
const resultWinner    = document.getElementById('resultWinner');
const resultTableHead = document.getElementById('resultTableHead');
const resultTableBody = document.getElementById('resultTableBody');
const totalRow        = document.getElementById('totalRow');

// ── Helpers ──────────────────────────────────────────────────
function showScreen(screen) {
  [introScreen, countdownScreen, gameScreen, resultScreen].forEach(s => s.classList.remove('active'));
  screen.classList.add('active');
}

let countdownInterval = null;
function startCountdown(onDone) {
  showScreen(countdownScreen);
  countdownInterval = runCountdown(countdownNumber, onDone);
}

function clearAllTimers() {
  if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
  if (prepTimer)   { clearTimeout(prepTimer);   prepTimer = null; }
  if (windowTimer) { clearTimeout(windowTimer); windowTimer = null; }
  if (restTimer)   { clearTimeout(restTimer);   restTimer = null; }
}

// 라운드가 갈수록 지시 노출 간격이 짧아짐 (긴장감 상승)
function prepDelayFor(round) {
  const step = (PREP_START_MS - PREP_MIN_MS) / (TOTAL_ROUNDS - 1);
  return Math.max(PREP_MIN_MS, Math.round(PREP_START_MS - (round - 1) * step));
}

function updateSoundToggle(btn) {
  btn.textContent = sound.isMuted() ? '🔇' : '🔊';
}

// ── Sound Toggle ─────────────────────────────────────────────
onTap(soundToggleIntro, () => {
  sound.toggleMute();
  updateSoundToggle(soundToggleIntro);
});
updateSoundToggle(soundToggleIntro);

// ── Player count selection ───────────────────────────────────
document.querySelectorAll('.player-btn').forEach(btn => {
  onTap(btn, () => {
    document.querySelectorAll('.player-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    playerCount = parseInt(btn.dataset.count, 10);
  });
});

// ── Back / Home / Retry ──────────────────────────────────────
onTap(backBtn, () => goHome());
onTap(closeBtn, () => {
  clearAllTimers();
  goHome();
});
onTap(homeBtn, () => goHome());
onTap(retryBtn, () => startCountdown(() => startGame()));

// ── PLAY button ──────────────────────────────────────────────
onTap(playBtn, () => startCountdown(() => startGame()));

// ── Build zones ──────────────────────────────────────────────
function buildZones() {
  zonesWrap.innerHTML = '';
  zonesWrap.className = `zones-wrap p${playerCount}`;

  for (let i = 0; i < playerCount; i++) {
    const cfg  = PLAYER_CONFIG[i];
    const zone = document.createElement('div');
    zone.className = 'zone';
    zone.dataset.player = i;
    zone.innerHTML = `
      <div class="zone-header">
        <span class="zone-label">${cfg.label}</span>
        <span class="zone-score-chip" id="zoneScore${i}">0점</span>
      </div>
      <div class="zone-feedback" id="zoneFeedback${i}"></div>
      <button class="action-btn" type="button">동작!</button>
    `;
    const btn = zone.querySelector('.action-btn');
    onTap(btn, () => handleActionTap(i, zone));
    zonesWrap.appendChild(zone);
  }
}

function getZone(idx) {
  return zonesWrap.querySelector(`.zone[data-player="${idx}"]`);
}

function setZoneFeedback(idx, emoji) {
  const el = document.getElementById(`zoneFeedback${idx}`);
  if (!el) return;
  el.textContent = emoji;
  el.classList.remove('pop');
  el.offsetHeight;
  if (emoji) el.classList.add('pop');
}

function clearZoneStates() {
  for (let i = 0; i < playerCount; i++) {
    const z = getZone(i);
    if (!z) continue;
    z.classList.remove('state-correct', 'shake', 'trapped', 'armed');
    setZoneFeedback(i, '');
  }
}

function setAllZonesArmed(armed) {
  for (let i = 0; i < playerCount; i++) {
    const z = getZone(i);
    if (z) z.classList.toggle('armed', armed);
  }
}

function spawnPenaltyFloat(zone) {
  const float = document.createElement('div');
  float.className = 'penalty-flash';
  float.textContent = '-1';
  zone.appendChild(float);
  float.addEventListener('animationend', () => float.remove());
}

// ── Score bar ────────────────────────────────────────────────
function renderScoreBar() {
  scoreBar.innerHTML = Array.from({ length: playerCount }, (_, i) => {
    const cfg = PLAYER_CONFIG[i];
    return `
      <div class="score-chip">
        <span class="score-chip-dot" style="background:${cfg.hex}"></span>
        <span>${cfg.label}</span>
        <span class="score-chip-val" id="scoreVal${i}">${scores[i]}</span>
      </div>
    `;
  }).join('');
}

function updateScores() {
  for (let i = 0; i < playerCount; i++) {
    const el = document.getElementById(`scoreVal${i}`);
    if (el) el.textContent = scores[i];
    const chip = document.getElementById(`zoneScore${i}`);
    if (chip) chip.textContent = `${scores[i]}점`;
  }
}

// ── Game flow ────────────────────────────────────────────────
function startGame() {
  clearAllTimers();
  scores       = new Array(playerCount).fill(0);
  roundResults = [];
  currentRound = 0;
  phase        = 'idle';
  showScreen(gameScreen);
  buildZones();
  renderScoreBar();
  nextRound();
}

function nextRound() {
  currentRound++;
  phase        = 'prep';
  simonClaimed = false;
  trapPressed  = new Set();
  roundDeltas  = new Array(playerCount).fill(0);

  clearZoneStates();
  questionCounter.textContent = `${currentRound} / ${TOTAL_ROUNDS}`;
  problemStatus.textContent = '';
  commandDisplay.classList.remove('show');
  commandDisplay.textContent = '👀';

  prepTimer = setTimeout(showCommand, getAutoplayPauseMs(prepDelayFor(currentRound)));
}

function showCommand() {
  prepTimer     = null;
  currentSimon  = Math.random() < SIMON_PROBABILITY;
  currentAction = ACTIONS[Math.floor(Math.random() * ACTIONS.length)];
  phase         = 'active';

  const actionHtml = `${currentAction.emoji} ${currentAction.name}`;
  commandDisplay.innerHTML = currentSimon
    ? `<span class="simon-tag">가라사대</span>${actionHtml}`
    : actionHtml;
  commandDisplay.classList.remove('show');
  commandDisplay.offsetHeight;
  commandDisplay.classList.add('show');

  sound.play('tick');
  setAllZonesArmed(true);

  windowTimer = setTimeout(onWindowTimeout, getAutoplayPauseMs(RESPONSE_WINDOW_MS));
}

// ── Tap handler ──────────────────────────────────────────────
function handleActionTap(idx, zone) {
  if (phase !== 'active') return;

  if (currentSimon) {
    // 가라사대 라운드: 가장 먼저 누른 플레이어 +1
    if (simonClaimed) return;
    simonClaimed = true;
    if (windowTimer) { clearTimeout(windowTimer); windowTimer = null; }

    roundDeltas[idx] = 1;
    scores[idx]++;
    sound.play('correct');
    zone.classList.add('state-correct');
    setZoneFeedback(idx, '🎉');
    problemStatus.textContent = `${PLAYER_CONFIG[idx].label} 가장 빨라요! +1점 🎉`;
    finishRound();
  } else {
    // 함정 라운드: 누르면 -1점 (플레이어당 1회)
    if (trapPressed.has(idx)) return;
    trapPressed.add(idx);

    roundDeltas[idx] = -1;
    scores[idx]--;
    sound.play('buzz');
    zone.classList.add('shake', 'trapped');
    zone.addEventListener('animationend', () => zone.classList.remove('shake'), { once: true });
    setZoneFeedback(idx, '💥');
    spawnPenaltyFloat(zone);
    problemStatus.textContent = '함정! "가라사대"가 없었어요 🚫';
    updateScores();
    // 라운드는 4초 윈도우가 끝날 때까지 계속 (다른 플레이어도 걸릴 수 있음)
  }
}

// ── Round end ────────────────────────────────────────────────
function onWindowTimeout() {
  windowTimer = null;
  if (phase !== 'active') return;

  if (currentSimon) {
    problemStatus.textContent = '아무도 안 눌렀어요 😅';
  } else if (trapPressed.size === 0) {
    sound.play('safe');
    problemStatus.textContent = '잘 참았어요! 👏 모두 통과';
    for (let i = 0; i < playerCount; i++) setZoneFeedback(i, '😌');
  } else {
    problemStatus.textContent = '함정이었어요! 🚫';
  }
  finishRound();
}

function finishRound() {
  phase = 'rest';
  setAllZonesArmed(false);
  updateScores();
  roundResults.push({
    simon: currentSimon,
    action: currentAction,
    deltas: roundDeltas.slice(),
  });

  restTimer = setTimeout(() => {
    restTimer = null;
    if (currentRound >= TOTAL_ROUNDS) {
      showResult();
    } else {
      nextRound();
    }
  }, getAutoplayPauseMs(REST_MS));
}

// ── Result screen ────────────────────────────────────────────
function showResult() {
  sound.play('win');

  const maxScore = Math.max(...scores);
  const winners  = scores.reduce((acc, s, i) => { if (s === maxScore) acc.push(i); return acc; }, []);

  if (winners.length === 1) {
    const cfg = PLAYER_CONFIG[winners[0]];
    resultTitle.textContent  = '🏆 게임 종료!';
    resultWinner.textContent = `${cfg.label} 최종 우승! 🎉 (${maxScore}점)`;
    resultWinner.style.color = cfg.hex;
  } else {
    resultTitle.textContent  = '🤝 게임 종료!';
    resultWinner.textContent = `공동 우승: ${winners.map(i => PLAYER_CONFIG[i].label).join(', ')} (${maxScore}점)`;
    resultWinner.style.color = '#555';
  }

  const players = Array.from({ length: playerCount }, (_, i) => PLAYER_CONFIG[i]);

  resultTableHead.innerHTML = `
    <tr>
      <th>라운드</th>
      ${players.map(p => `<th><span class="player-dot" style="background:${p.hex}"></span>${p.label}</th>`).join('')}
    </tr>
  `;

  resultTableBody.innerHTML = roundResults.map((r, ri) => {
    const cmd = `${r.simon ? '👑 ' : ''}${r.action.emoji}`;
    const cells = r.deltas.map(d => {
      if (d > 0)  return `<td class="cell-win">+1</td>`;
      if (d < 0)  return `<td class="cell-wrong">-1</td>`;
      return `<td class="cell-none">—</td>`;
    }).join('');
    return `<tr><td class="round-cmd">${ri + 1} ${cmd}</td>${cells}</tr>`;
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
