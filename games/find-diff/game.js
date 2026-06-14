/* games/find-diff/game.js */

'use strict';

// ── Constants ────────────────────────────────────────────────
const TOTAL_ROUNDS    = 8;
const ROUND_TIME      = 12;    // seconds per round
const GRID_SIZE       = 9;     // 3x3
const RESULT_PAUSE_MS = getAutoplayPauseMs(2000);

// Player config
const PLAYER_CONFIG = [
  { label: 'P1', dot: '#0288D1', cls: 'p1' },
  { label: 'P2', dot: '#E53935', cls: 'p2' },
  { label: 'P3', dot: '#388E3C', cls: 'p3' },
  { label: 'P4', dot: '#F57C00', cls: 'p4' },
];

// ── Emoji sets (tier가 높을수록 서로 비슷해서 어려움) ────────
const EMOJI_SETS = [
  // tier 1: 한눈에 구분되는 세트 (라운드 1~3)
  { tier: 1, emojis: ['🍎', '🍌', '🍇', '🍉'] },
  { tier: 1, emojis: ['🐶', '🐱', '🐭', '🐰'] },
  { tier: 1, emojis: ['⚽', '🏀', '🏈', '⚾'] },
  { tier: 1, emojis: ['🚗', '🚌', '🚓', '🚜'] },
  { tier: 1, emojis: ['🌞', '🌙', '⭐', '☁️'] },
  // tier 2: 같은 종류라 헷갈리는 세트 (라운드 4~6)
  { tier: 2, emojis: ['🌹', '🌸', '🌺', '🌷'] },
  { tier: 2, emojis: ['🚗', '🚕', '🚙', '🛻'] },
  { tier: 2, emojis: ['🍊', '🍑', '🥭', '🍋'] },
  { tier: 2, emojis: ['🐢', '🐊', '🦎', '🐍'] },
  { tier: 2, emojis: ['🦆', '🐦', '🐤', '🐧'] },
  // tier 3: 매우 비슷한 세트 (라운드 7~8)
  { tier: 3, emojis: ['😀', '😃', '😄', '😁'] },
  { tier: 3, emojis: ['🙂', '😊', '😇', '🙃'] },
  { tier: 3, emojis: ['😆', '😅', '😂', '🤣'] },
  { tier: 3, emojis: ['🐱', '🐯', '🦁', '🐹'] },
  { tier: 3, emojis: ['🕐', '🕑', '🕒', '🕓'] },
];

// 라운드별 난이도 계획 (8라운드: 쉬움 → 어려움)
const TIER_PLAN = [1, 1, 1, 2, 2, 2, 3, 3];

// ── Sound Manager ────────────────────────────────────────────
const sound = createSoundManager();

// ── State ────────────────────────────────────────────────────
let playerCount   = 2;
let roundIdx      = 0;
let scores        = [];
let roundLog      = [];    // { origEmoji, diffEmoji, diffPos, winnerIdx, dqPlayers[], timedOut }
let currentRound  = null;  // { cells[9], diffPos, diffEmoji }
let dqSet         = new Set();
let phase         = 'idle';
let timerHandle   = null;
let nextHandle    = null;
let timeRemaining = ROUND_TIME;
let gameRounds    = [];    // 8 generated rounds

// ── DOM refs ─────────────────────────────────────────────────
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

const zonesWrap     = document.getElementById('zonesWrap');
const questionCounter = document.getElementById('questionCounter');
const problemTimer  = document.getElementById('problemTimer');
const problemStatus = document.getElementById('problemStatus');
const scoreBar      = document.getElementById('scoreBar');
const gridLeft      = document.getElementById('gridLeft');
const gridRight     = document.getElementById('gridRight');

const soundToggleIntro = document.getElementById('soundToggleIntro');
const introIllust   = document.getElementById('introIllust');

const resultTitle   = document.getElementById('resultTitle');
const resultWinner  = document.getElementById('resultWinner');
const resultTableHead = document.getElementById('resultTableHead');
const resultTableBody = document.getElementById('resultTableBody');
const totalRow      = document.getElementById('totalRow');

// ── Helpers ──────────────────────────────────────────────────
function showScreen(s) {
  [introScreen, countdownScreen, gameScreen, resultScreen].forEach(x => x.classList.remove('active'));
  s.classList.add('active');
}

var countdownInterval = null;
function startPreGameCountdown(onDone) {
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
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function randInt(n) {
  return Math.floor(Math.random() * n);
}

function clearTimers() {
  if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
  if (timerHandle) { clearInterval(timerHandle); timerHandle = null; }
  if (nextHandle)  { clearTimeout(nextHandle);   nextHandle  = null; }
}

function updateSoundBtn(btn) {
  btn.textContent = sound.isMuted() ? '🔇' : '🔊';
}

function posLabel(pos) {
  return `${Math.floor(pos / 3) + 1}행 ${pos % 3 + 1}열`;
}

// ── Round generation ─────────────────────────────────────────
// 한 라운드 = 3x3 격자 9칸 (세트 이모지 무작위 배치) + 다른 칸 1개
function buildGameRounds() {
  const rounds = [];
  const usedSetIdx = new Set();

  TIER_PLAN.forEach(tier => {
    const candidates = EMOJI_SETS
      .map((s, idx) => ({ s, idx }))
      .filter(x => x.s.tier === tier && !usedSetIdx.has(x.idx));
    const pool = candidates.length > 0
      ? candidates
      : EMOJI_SETS.map((s, idx) => ({ s, idx })).filter(x => x.s.tier === tier);
    const pick = pool[randInt(pool.length)];
    usedSetIdx.add(pick.idx);

    const emojis = pick.s.emojis;
    const cells = [];
    for (let i = 0; i < GRID_SIZE; i++) {
      cells.push(emojis[randInt(emojis.length)]);
    }
    const diffPos = randInt(GRID_SIZE);
    const others  = emojis.filter(e => e !== cells[diffPos]);
    const diffEmoji = others[randInt(others.length)];

    rounds.push({ cells, diffPos, diffEmoji });
  });

  return rounds;
}

// ── Intro illustration ───────────────────────────────────────
function renderIntroIllust() {
  introIllust.innerHTML = `<svg viewBox="0 0 220 130" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="6" width="208" height="118" rx="16" fill="#FFF8E1" stroke="#2C2C2C" stroke-width="3"/>
    <rect x="22" y="26" width="78" height="78" rx="10" fill="#fff" stroke="#2C2C2C" stroke-width="3"/>
    <rect x="120" y="26" width="78" height="78" rx="10" fill="#fff" stroke="#2C2C2C" stroke-width="3"/>
    <text x="48" y="58" text-anchor="middle" font-size="20">🌸</text>
    <text x="74" y="58" text-anchor="middle" font-size="20">🌷</text>
    <text x="48" y="90" text-anchor="middle" font-size="20">🌷</text>
    <text x="74" y="90" text-anchor="middle" font-size="20">🌸</text>
    <text x="146" y="58" text-anchor="middle" font-size="20">🌸</text>
    <text x="172" y="58" text-anchor="middle" font-size="20">🌷</text>
    <text x="146" y="90" text-anchor="middle" font-size="20">🌹</text>
    <text x="172" y="90" text-anchor="middle" font-size="20">🌸</text>
    <circle cx="146" cy="83" r="20" fill="none" stroke="#5C6BC0" stroke-width="4" stroke-dasharray="5 4"/>
    <text x="110" y="72" text-anchor="middle" font-size="14" font-weight="900" fill="#5C6BC0">VS</text>
  </svg>`;
}
renderIntroIllust();

// ── Player count selection ───────────────────────────────────
document.querySelectorAll('.player-btn').forEach(btn => {
  onTap(btn, () => {
    document.querySelectorAll('.player-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    playerCount = parseInt(btn.dataset.count, 10);
  });
});

// ── Sound toggle ─────────────────────────────────────────────
onTap(soundToggleIntro, () => {
  sound.toggleMute();
  updateSoundBtn(soundToggleIntro);
});
updateSoundBtn(soundToggleIntro);

// ── Navigation ───────────────────────────────────────────────
onTap(backBtn,  () => goHome());
onTap(closeBtn, () => { clearTimers(); goHome(); });
onTap(homeBtn,  () => goHome());
onTap(retryBtn, () => startPreGameCountdown(() => startGame()));
onTap(playBtn,  () => startPreGameCountdown(() => startGame()));

// ── Problem grids (top panel) ────────────────────────────────
function renderProblemGrids() {
  gridLeft.innerHTML  = '';
  gridRight.innerHTML = '';
  for (let i = 0; i < GRID_SIZE; i++) {
    const left = document.createElement('div');
    left.className = 'diff-cell';
    left.textContent = currentRound.cells[i];
    gridLeft.appendChild(left);

    const right = document.createElement('div');
    right.className = 'diff-cell';
    right.dataset.pos = String(i);
    right.textContent = (i === currentRound.diffPos)
      ? currentRound.diffEmoji
      : currentRound.cells[i];
    gridRight.appendChild(right);
  }
}

function markAnswerCell(cls) {
  const cell = gridRight.querySelector(`.diff-cell[data-pos="${currentRound.diffPos}"]`);
  if (cell) cell.classList.add(cls);
}

// ── Build zone grid ──────────────────────────────────────────
function buildZones() {
  zonesWrap.innerHTML = '';
  zonesWrap.className = `zones-wrap p${playerCount}`;

  for (let i = 0; i < playerCount; i++) {
    const cfg  = PLAYER_CONFIG[i];
    const zone = document.createElement('div');
    zone.className = `zone ${cfg.cls}`;
    zone.dataset.player = i;

    // Header
    const header = document.createElement('div');
    header.className = 'zone-header';
    header.innerHTML = `
      <span class="zone-label">${cfg.label}</span>
      <span class="zone-score-chip" id="score-chip-${i}">0점</span>
    `;

    // Hint (정보는 위쪽)
    const hint = document.createElement('div');
    hint.className = 'zone-hint';
    hint.textContent = '다른 칸의 위치를 터치!';

    // 3x3 position pick grid (조작은 하단)
    const grid = document.createElement('div');
    grid.className = 'pick-grid';
    grid.id = `pick-grid-${i}`;

    for (let p = 0; p < GRID_SIZE; p++) {
      const btn = document.createElement('button');
      btn.className = 'pick-btn';
      btn.dataset.player = String(i);
      btn.dataset.pos = String(p);
      btn.setAttribute('aria-label', `${cfg.label} 위치 ${Math.floor(p / 3) + 1}행 ${p % 3 + 1}열`);
      onTap(btn, () => handlePickTap(i, p, btn));
      grid.appendChild(btn);
    }

    zone.appendChild(header);
    zone.appendChild(hint);
    zone.appendChild(grid);
    zonesWrap.appendChild(zone);
  }
}

function getZone(idx) {
  return zonesWrap.querySelector(`.zone[data-player="${idx}"]`);
}

function getPickBtns(playerIdx) {
  const grid = document.getElementById(`pick-grid-${playerIdx}`);
  return grid ? Array.from(grid.querySelectorAll('.pick-btn')) : [];
}

function updateScoreChip(playerIdx) {
  const chip = document.getElementById(`score-chip-${playerIdx}`);
  if (chip) chip.textContent = `${scores[playerIdx]}점`;
}

// ── Score bar ────────────────────────────────────────────────
function buildScoreBar() {
  scoreBar.innerHTML = '';
  for (let i = 0; i < playerCount; i++) {
    const cfg  = PLAYER_CONFIG[i];
    const chip = document.createElement('div');
    chip.className = 'score-chip';
    chip.innerHTML = `
      <span class="score-chip-dot" style="background:${cfg.dot}"></span>
      <span>${cfg.label}</span>
      <span class="score-chip-val" id="bar-score-${i}">0</span>
    `;
    scoreBar.appendChild(chip);
  }
}

function updateBarScore(playerIdx) {
  const el = document.getElementById(`bar-score-${playerIdx}`);
  if (el) el.textContent = scores[playerIdx];
}

// ── Reset zone buttons for new round ─────────────────────────
function resetBtnsForRound() {
  for (let i = 0; i < playerCount; i++) {
    getPickBtns(i).forEach(btn => {
      btn.className = 'pick-btn';
      btn.disabled = false;
      btn.textContent = '';
    });
    const zone = getZone(i);
    if (zone) zone.classList.remove('dq-zone');
  }
}

function disablePlayerBtns(playerIdx) {
  getPickBtns(playerIdx).forEach(b => {
    b.classList.add('state-disabled');
    b.disabled = true;
  });
}

// ── Timer logic ──────────────────────────────────────────────
function startCountdown() {
  timeRemaining = ROUND_TIME;
  problemTimer.textContent = timeRemaining;
  problemTimer.classList.remove('urgent');

  timerHandle = setInterval(() => {
    timeRemaining--;
    problemTimer.textContent = timeRemaining;

    if (timeRemaining <= 3) {
      problemTimer.classList.add('urgent');
      sound.play('tick');
    }

    if (timeRemaining <= 0) {
      clearTimers();
      handleTimeout();
    }
  }, 1000);
}

// ── Pick tap handler ─────────────────────────────────────────
function handlePickTap(playerIdx, pos, btn) {
  if (phase !== 'active') return;
  if (dqSet.has(playerIdx)) return;

  if (pos === currentRound.diffPos) {
    resolveRound(playerIdx);
  } else {
    // 오답: 그 라운드 실격 (zone 흐려짐)
    sound.play('buzz');
    btn.classList.add('state-wrong');
    btn.textContent = '✗';

    dqSet.add(playerIdx);

    const zone = getZone(playerIdx);
    const flash = document.createElement('div');
    flash.className = 'penalty-flash';
    flash.textContent = '실격!';
    zone.appendChild(flash);
    flash.addEventListener('animationend', () => flash.remove());

    disablePlayerBtns(playerIdx);
    zone.classList.add('dq-zone');

    // 모두 실격이면 정답 공개 후 다음 라운드
    let anyActive = false;
    for (let i = 0; i < playerCount; i++) {
      if (!dqSet.has(i)) { anyActive = true; break; }
    }
    if (!anyActive) {
      clearTimers();
      nextHandle = setTimeout(() => handleTimeout(), 300);
    }
  }
}

// ── Correct answer resolved ──────────────────────────────────
function resolveRound(winnerIdx) {
  phase = 'done';
  clearTimers();
  sound.play('ding');

  scores[winnerIdx]++;
  updateScoreChip(winnerIdx);
  updateBarScore(winnerIdx);

  // 정답 위치 표시: 승자 버튼 + 문제 패널의 정답 칸
  getPickBtns(winnerIdx).forEach(b => {
    const p = parseInt(b.dataset.pos, 10);
    if (p === currentRound.diffPos) {
      b.classList.add('state-correct');
      b.textContent = '✓';
    } else {
      b.classList.add('state-disabled');
      b.disabled = true;
    }
  });
  markAnswerCell('found');

  // 나머지 zone 비활성화
  for (let i = 0; i < playerCount; i++) {
    if (i !== winnerIdx) disablePlayerBtns(i);
  }

  const winnerLabel = PLAYER_CONFIG[winnerIdx].label;
  problemStatus.textContent = `${winnerLabel} 정답! (${posLabel(currentRound.diffPos)})`;

  roundLog.push({
    origEmoji: currentRound.cells[currentRound.diffPos],
    diffEmoji: currentRound.diffEmoji,
    diffPos: currentRound.diffPos,
    winnerIdx,
    dqPlayers: [...dqSet],
    timedOut: false,
  });

  nextHandle = setTimeout(() => nextRound(), RESULT_PAUSE_MS);
}

// ── Timeout (또는 전원 실격) ─────────────────────────────────
function handleTimeout() {
  phase = 'done';
  clearTimers();
  sound.play('timeout');

  // 정답 위치 하이라이트: 문제 패널 + 모든 zone 격자
  markAnswerCell('reveal');
  for (let i = 0; i < playerCount; i++) {
    getPickBtns(i).forEach(b => {
      const p = parseInt(b.dataset.pos, 10);
      if (p === currentRound.diffPos) {
        b.classList.remove('state-disabled');
        b.classList.add('state-reveal');
        b.disabled = true;
        b.textContent = '!';
      } else {
        b.classList.add('state-disabled');
        b.disabled = true;
      }
    });
    const zone = getZone(i);
    if (zone) zone.classList.remove('dq-zone');
  }

  problemStatus.textContent = `정답은 ${posLabel(currentRound.diffPos)} (${currentRound.diffEmoji})!`;

  roundLog.push({
    origEmoji: currentRound.cells[currentRound.diffPos],
    diffEmoji: currentRound.diffEmoji,
    diffPos: currentRound.diffPos,
    winnerIdx: -1,
    dqPlayers: [...dqSet],
    timedOut: true,
  });

  nextHandle = setTimeout(() => nextRound(), RESULT_PAUSE_MS);
}

// ── Load round ───────────────────────────────────────────────
function loadRound() {
  phase        = 'active';
  currentRound = gameRounds[roundIdx];
  dqSet        = new Set();

  questionCounter.textContent = `${roundIdx + 1} / ${TOTAL_ROUNDS}`;
  problemStatus.textContent = '';
  problemTimer.classList.remove('urgent');

  renderProblemGrids();
  resetBtnsForRound();
  startCountdown();
}

// ── Next round ───────────────────────────────────────────────
function nextRound() {
  roundIdx++;
  if (roundIdx >= TOTAL_ROUNDS) {
    showResult();
  } else {
    loadRound();
  }
}

// ── Start game ───────────────────────────────────────────────
function startGame() {
  gameRounds  = buildGameRounds();
  roundIdx    = 0;
  scores      = new Array(playerCount).fill(0);
  roundLog    = [];
  dqSet       = new Set();
  phase       = 'idle';

  clearTimers();
  buildZones();
  buildScoreBar();
  showScreen(gameScreen);
  loadRound();
}

// ── Show result ──────────────────────────────────────────────
function showResult() {
  clearTimers();
  phase = 'idle';
  sound.play('fanfare');

  const maxScore = Math.max(...scores);
  const winners  = scores
    .map((s, i) => ({ s, i }))
    .filter(x => x.s === maxScore)
    .map(x => x.i);

  if (maxScore === 0) {
    resultTitle.textContent  = '무승부!';
    resultWinner.textContent = '아무도 점수를 얻지 못했어요.';
  } else if (winners.length === 1) {
    const w = winners[0];
    resultTitle.textContent  = '게임 종료!';
    resultWinner.textContent = `${PLAYER_CONFIG[w].label} 승리! (${maxScore}점)`;
  } else {
    const labels = winners.map(w => PLAYER_CONFIG[w].label).join(', ');
    resultTitle.textContent  = '동점!';
    resultWinner.textContent = `${labels} 공동 1위! (${maxScore}점)`;
  }

  // Build table header
  const headRow = document.createElement('tr');
  headRow.innerHTML = '<th>라운드</th>' +
    Array.from({ length: playerCount }, (_, i) =>
      `<th><span class="player-dot" style="background:${PLAYER_CONFIG[i].dot}"></span>${PLAYER_CONFIG[i].label}</th>`
    ).join('');
  resultTableHead.innerHTML = '';
  resultTableHead.appendChild(headRow);

  // Build table body
  resultTableBody.innerHTML = '';
  roundLog.forEach((log, idx) => {
    const tr = document.createElement('tr');
    let cells = `<td style="text-align:left;font-size:0.82rem;">
      ${idx + 1}. <span class="cell-round-emoji">${log.origEmoji}→${log.diffEmoji}</span> ${posLabel(log.diffPos)}
    </td>`;

    for (let i = 0; i < playerCount; i++) {
      if (log.winnerIdx === i) {
        cells += `<td class="cell-win">+1</td>`;
      } else if (log.dqPlayers.includes(i)) {
        cells += `<td class="cell-wrong">실격</td>`;
      } else if (log.timedOut) {
        cells += `<td class="cell-timeout">시간초과</td>`;
      } else {
        cells += `<td class="cell-none">—</td>`;
      }
    }
    tr.innerHTML = cells;
    resultTableBody.appendChild(tr);
  });

  // Total chips
  totalRow.innerHTML = '';
  for (let i = 0; i < playerCount; i++) {
    const cfg   = PLAYER_CONFIG[i];
    const isWin = winners.includes(i) && maxScore > 0;
    const chip  = document.createElement('div');
    chip.className = 'total-chip';
    chip.innerHTML = `
      <span class="chip-dot" style="background:${cfg.dot}"></span>
      <span>${cfg.label}</span>
      <span class="chip-score" style="color:${isWin ? '#2E7D32' : '#555'}">${scores[i]}점</span>
      ${isWin ? '<span style="font-size:1.1rem;">★</span>' : ''}
    `;
    totalRow.appendChild(chip);
  }

  showScreen(resultScreen);
}
