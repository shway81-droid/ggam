/* games/stop-bar/game.js */

'use strict';

// ── Constants ────────────────────────────────────────────────
const TOTAL_ROUNDS    = 5;
const SPEED_STEPS     = [1.0, 1.2, 1.4, 1.6, 1.8]; // 라운드별 마커 속도 배율
const BASE_PERIOD_MS  = 2600;   // 1.0x에서 좌→우→좌 한 사이클 시간
const GOLD_RATIO      = 0.12;   // 골드 존: 전체의 12% (중앙)
const YELLOW_RATIO    = 0.25;   // 옐로 존: 전체의 25% (중앙)
const GOLD_SCORE      = 3;
const YELLOW_SCORE    = 1;
const ROUND_TIMEOUT_MS = 12000; // 아무도 안 누를 때 안전 타임아웃
const NEXT_ROUND_PAUSE_MS = getAutoplayPauseMs(2000); // 모두 정지 후 다음 라운드까지

const PLAYER_CONFIG = [
  { label: 'P1', icon: '🔵', colorClass: 'p-blue',   hex: '#1565C0' },
  { label: 'P2', icon: '🔴', colorClass: 'p-red',    hex: '#C62828' },
  { label: 'P3', icon: '🟢', colorClass: 'p-purple', hex: '#2E7D32' },
  { label: 'P4', icon: '🟠', colorClass: 'p-orange', hex: '#E65100' },
];

// ── Sound Manager ────────────────────────────────────────────
const sound = createSoundManager({
  start(ctx) {
    // 라운드 시작 — 짧은 두 음 신호
    [440, 587].forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'triangle';
      const t = ctx.currentTime + i * 0.1;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      osc.start(t);
      osc.stop(t + 0.2);
    });
  },

  gold(ctx) {
    // 골드 존 명중 — 반짝이는 상승 아르페지오
    [784, 988, 1175].forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      const t = ctx.currentTime + i * 0.09;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.start(t);
      osc.stop(t + 0.35);
    });
  },

  yellow(ctx) {
    // 옐로 존 — 단일 딩
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(659, ctx.currentTime);
    gain.gain.setValueAtTime(0.35, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  },

  miss(ctx) {
    // 존 바깥 — 낮은 버즈
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(130, ctx.currentTime);
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  },

  fanfare(ctx) {
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
let playerCount  = 2;
let currentRound = 0;            // 1-based
let totals       = [];           // 플레이어별 누적 점수
let roundScores  = [];           // roundScores[round][player] = { pts, tier }
let roundRunning = false;
let roundStartTime = 0;          // performance.now() 기준
let speedMult    = 1.0;
let stoppedFlags = [];           // 이번 라운드에 멈췄는지
let rafId        = null;
let roundTimeoutTimer = null;
let nextRoundTimer    = null;
let startDelayTimer   = null;

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

const zonesWrap  = document.getElementById('zonesWrap');
const roundBadge = document.getElementById('roundBadge');
const speedBadge = document.getElementById('speedBadge');

const soundToggleIntro = document.getElementById('soundToggleIntro');

const resultTitle     = document.getElementById('resultTitle');
const resultWinner    = document.getElementById('resultWinner');
const resultTableHead = document.getElementById('resultTableHead');
const resultTableBody = document.getElementById('resultTableBody');
const totalRow        = document.getElementById('totalRow');

// per-zone DOM refs (buildZones에서 채움)
let zoneEls   = [];  // { zone, marker, track, msg, btn, scoreChip }

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

// ── Back / Home / Retry ──────────────────────────────────────
onTap(backBtn, () => goHome());
onTap(closeBtn, () => {
  stopAllTimers();
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
  zoneEls = [];

  for (let i = 0; i < playerCount; i++) {
    const cfg  = PLAYER_CONFIG[i];
    const zone = document.createElement('div');
    zone.className = `zone ${cfg.colorClass}`;
    zone.dataset.player = i;
    zone.innerHTML = `
      <div class="zone-header">
        <span class="zone-label">${cfg.icon} ${cfg.label}</span>
        <span class="zone-score-chip">0점</span>
      </div>
      <div class="gauge-area">
        <div class="gauge-track">
          <div class="gz-yellow"></div>
          <div class="gz-gold"></div>
          <div class="gauge-marker"><span class="marker-arrow">▼</span><span class="marker-line"></span></div>
        </div>
        <div class="gauge-msg"></div>
      </div>
      <button class="stop-btn" type="button">멈춰!</button>
    `;
    zonesWrap.appendChild(zone);

    const refs = {
      zone,
      track:     zone.querySelector('.gauge-track'),
      marker:    zone.querySelector('.gauge-marker'),
      msg:       zone.querySelector('.gauge-msg'),
      btn:       zone.querySelector('.stop-btn'),
      scoreChip: zone.querySelector('.zone-score-chip'),
      gaugeArea: zone.querySelector('.gauge-area'),
    };
    zoneEls.push(refs);

    onTap(refs.btn, () => handleStop(i));
  }
}

// ── Marker math ──────────────────────────────────────────────
// sin 곡선 왕복: 0(좌) → 1(우) → 0(좌) 부드럽게
function markerPos(elapsedMs) {
  const period = BASE_PERIOD_MS / speedMult;
  return 0.5 - 0.5 * Math.cos((2 * Math.PI * elapsedMs) / period);
}

function setMarkerTransform(i, pos) {
  const refs = zoneEls[i];
  const w = refs.track.clientWidth; // border 제외 내부 폭
  refs.marker.style.transform = `translateX(${(pos * w).toFixed(1)}px)`;
}

// ── Animation loop (멈추지 않은 마커만 갱신) ─────────────────
function animLoop(now) {
  if (!roundRunning) return;
  const pos = markerPos(now - roundStartTime);
  for (let i = 0; i < playerCount; i++) {
    if (!stoppedFlags[i]) setMarkerTransform(i, pos);
  }
  rafId = requestAnimationFrame(animLoop);
}

// ── Stop handler ─────────────────────────────────────────────
function handleStop(playerIdx) {
  if (!roundRunning || stoppedFlags[playerIdx]) return;

  // performance.now() 기준으로 정지 시점 위치 계산
  const pos = markerPos(performance.now() - roundStartTime);
  stoppedFlags[playerIdx] = true;
  setMarkerTransform(playerIdx, pos);

  const dist = Math.abs(pos - 0.5);
  let pts, tier;
  if (dist <= GOLD_RATIO / 2) {
    pts = GOLD_SCORE;   tier = 'gold';
    sound.play('gold');
  } else if (dist <= YELLOW_RATIO / 2) {
    pts = YELLOW_SCORE; tier = 'yellow';
    sound.play('yellow');
  } else {
    pts = 0;            tier = 'miss';
    sound.play('miss');
  }

  applyStopResult(playerIdx, pts, tier, pos);

  if (stoppedFlags.every(Boolean)) {
    endRound();
  }
}

function applyStopResult(playerIdx, pts, tier, pos) {
  const refs = zoneEls[playerIdx];

  roundScores[currentRound - 1][playerIdx] = { pts, tier };
  totals[playerIdx] += pts;

  // 즉시 피드백: 메시지 + 점수 플로팅 + 점수칩 갱신
  const MSGS = {
    gold:    '🌟 골드! +3',
    yellow:  '👍 옐로! +1',
    miss:    '아쉽다! 0점',
    timeout: '⏰ 시간 초과 0점',
  };
  refs.msg.textContent = MSGS[tier];
  refs.msg.className = `gauge-msg tier-${tier === 'timeout' ? 'miss' : tier} pop`;

  if (tier === 'gold') refs.marker.classList.add('hit-gold');

  refs.scoreChip.textContent = `${totals[playerIdx]}점`;
  refs.scoreChip.classList.remove('score-bounce');
  refs.scoreChip.offsetHeight;
  refs.scoreChip.classList.add('score-bounce');

  refs.btn.classList.add('done');
  refs.btn.textContent = '정지!';

  // 점수 플로팅 (정지 위치 근처)
  if (tier !== 'timeout') {
    const float = document.createElement('span');
    float.className = `score-float ${pts > 0 ? 'plus' : 'minus'}`;
    float.textContent = pts > 0 ? `+${pts}` : '0';
    const w = refs.track.clientWidth;
    float.style.left = `${Math.max(8, Math.min(w - 24, pos * w - 8))}px`;
    refs.gaugeArea.appendChild(float);
    float.addEventListener('animationend', () => float.remove());
  }
}

// ── Game flow ────────────────────────────────────────────────
function startGame() {
  stopAllTimers();
  totals      = new Array(playerCount).fill(0);
  roundScores = [];
  currentRound = 0;
  showScreen(gameScreen);
  buildZones();
  nextRound();
}

function nextRound() {
  currentRound++;
  speedMult = SPEED_STEPS[currentRound - 1];
  roundScores.push(new Array(playerCount).fill(null));
  stoppedFlags = new Array(playerCount).fill(false);

  roundBadge.textContent = `Round ${currentRound} / ${TOTAL_ROUNDS}`;
  speedBadge.textContent = `속도 x${speedMult.toFixed(1)}`;

  // zone 리셋
  zoneEls.forEach(refs => {
    refs.msg.textContent = '';
    refs.msg.className = 'gauge-msg';
    refs.btn.classList.remove('done');
    refs.btn.textContent = '멈춰!';
    refs.marker.classList.remove('hit-gold');
    refs.marker.style.transform = 'translateX(0px)';
  });

  // 짧은 준비 후 마커 출발
  startDelayTimer = setTimeout(() => {
    startDelayTimer = null;
    sound.play('start');
    roundRunning   = true;
    roundStartTime = performance.now();
    rafId = requestAnimationFrame(animLoop);

    // 안전 타임아웃: 안 누른 플레이어는 0점 처리
    roundTimeoutTimer = setTimeout(() => {
      roundTimeoutTimer = null;
      forceTimeoutRound();
    }, ROUND_TIMEOUT_MS);
  }, 600);
}

function forceTimeoutRound() {
  if (!roundRunning) return;
  for (let i = 0; i < playerCount; i++) {
    if (!stoppedFlags[i]) {
      stoppedFlags[i] = true;
      applyStopResult(i, 0, 'timeout', markerPos(performance.now() - roundStartTime));
    }
  }
  sound.play('miss');
  endRound();
}

function endRound() {
  roundRunning = false;
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  if (roundTimeoutTimer) { clearTimeout(roundTimeoutTimer); roundTimeoutTimer = null; }

  // 모두 멈추면 2초 후 다음 라운드 (autoplay 시 단축)
  nextRoundTimer = setTimeout(() => {
    nextRoundTimer = null;
    if (currentRound >= TOTAL_ROUNDS) {
      showResult();
    } else {
      nextRound();
    }
  }, NEXT_ROUND_PAUSE_MS);
}

function stopAllTimers() {
  roundRunning = false;
  if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
  if (rafId)             { cancelAnimationFrame(rafId); rafId = null; }
  if (roundTimeoutTimer) { clearTimeout(roundTimeoutTimer); roundTimeoutTimer = null; }
  if (nextRoundTimer)    { clearTimeout(nextRoundTimer); nextRoundTimer = null; }
  if (startDelayTimer)   { clearTimeout(startDelayTimer); startDelayTimer = null; }
}

// ── Result screen ────────────────────────────────────────────
function showResult() {
  sound.play('fanfare');

  // 최종 우승자 (합산 최고점)
  const maxScore = Math.max(...totals);
  const winners  = totals.reduce((acc, s, i) => { if (s === maxScore) acc.push(i); return acc; }, []);

  if (winners.length === 1) {
    const cfg = PLAYER_CONFIG[winners[0]];
    resultTitle.textContent  = '🏆 게임 종료!';
    resultWinner.textContent = `${cfg.label} 최종 우승! 🎉 (${maxScore}점)`;
    resultWinner.style.color = cfg.hex;
  } else {
    resultTitle.textContent  = '🤝 게임 종료!';
    resultWinner.textContent = `공동 우승: ${winners.map(i => PLAYER_CONFIG[i].label).join(', ')} 🎉 (${maxScore}점)`;
    resultWinner.style.color = '#555';
  }

  // 라운드별 표 헤더
  const players = Array.from({ length: playerCount }, (_, i) => PLAYER_CONFIG[i]);
  resultTableHead.innerHTML = `
    <tr>
      <th>라운드</th>
      ${players.map(p => `<th><span class="player-dot" style="background:${p.hex}"></span>${p.label}</th>`).join('')}
    </tr>
  `;

  // 라운드별 표 본문
  resultTableBody.innerHTML = roundScores.map((row, ri) => {
    const cells = row.map(rec => {
      if (!rec) return `<td class="cell-miss">—</td>`;
      if (rec.tier === 'gold')   return `<td class="cell-gold">🌟 +3</td>`;
      if (rec.tier === 'yellow') return `<td class="cell-yellow">+1</td>`;
      return `<td class="cell-miss">0</td>`;
    }).join('');
    return `<tr><td>${ri + 1}R (x${SPEED_STEPS[ri].toFixed(1)})</td>${cells}</tr>`;
  }).join('');

  // 총점 칩
  totalRow.innerHTML = players.map((p, i) => `
    <div class="total-chip ${totals[i] === maxScore ? 'champ' : ''}">
      <span class="chip-dot" style="background:${p.hex}"></span>
      <span>${p.label}</span>
      <span class="chip-score">${totals[i]}점</span>
    </div>
  `).join('');

  showScreen(resultScreen);
}
