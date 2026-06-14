/* games/trash-sort/game.js */

'use strict';

// ── Constants ────────────────────────────────────────────────
const TOTAL_ROUNDS    = 10;
const ROUND_TIME      = 10;   // seconds per round
const RESULT_PAUSE_MS = getAutoplayPauseMs(2000);

// Player config (zone 배경은 여기서 동적 적용)
const PLAYER_CONFIG = [
  { label: 'P1', dot: '#0288D1', zoneBg: '#B3E5FC', cls: 'p1' },
  { label: 'P2', dot: '#E53935', zoneBg: '#FFCDD2', cls: 'p2' },
  { label: 'P3', dot: '#388E3C', zoneBg: '#C8E6C9', cls: 'p3' },
  { label: 'P4', dot: '#F57C00', zoneBg: '#FFE0B2', cls: 'p4' },
];

// 분리수거함 정의 (순서 고정 — semantic colors는 CSS)
const TRASH_BINS = [
  { name: '종이',      color: '#1565C0' },
  { name: '플라스틱',  color: '#388E3C' },
  { name: '캔·고철',   color: '#C62828' },
  { name: '일반·음식물', color: '#757575' },
];

// ── 쓰레기 아이템 라이브러리 (tier=1~3 순 난이도) ──────────────
// { tier, emoji, name, answer, tip }
const TRASH_ITEMS = [
  // Tier 1 (라운드 1~3 — 한눈에 분명한 쓰레기)
  { tier: 1, emoji: '📰', name: '신문지',       answer: '종이',      tip: '신문지는 종이류로 배출해요' },
  { tier: 1, emoji: '🧴', name: '페트병',       answer: '플라스틱',  tip: '페트병은 플라스틱류예요' },
  { tier: 1, emoji: '🥫', name: '음료캔',       answer: '캔·고철',   tip: '빈 캔은 캔·고철류예요' },
  { tier: 1, emoji: '🍌', name: '바나나껍질',   answer: '일반·음식물', tip: '과일 껍질은 음식물쓰레기예요' },
  { tier: 1, emoji: '📦', name: '박스',         answer: '종이',      tip: '종이 박스는 종이류예요' },
  { tier: 1, emoji: '🥤', name: '플라스틱컵',   answer: '플라스틱',  tip: '플라스틱 컵은 플라스틱류예요' },
  { tier: 1, emoji: '🪣', name: '철캔',         answer: '캔·고철',   tip: '금속 캔은 캔·고철류예요' },
  { tier: 1, emoji: '🥚', name: '달걀껍데기',   answer: '일반·음식물', tip: '달걀 껍데기는 일반쓰레기예요' },
  // Tier 2 (라운드 4~7 — 헷갈리지만 전국 표준이 있는 쓰레기)
  { tier: 2, emoji: '🧾', name: '영수증',       answer: '일반·음식물', tip: '영수증(감열지)은 일반쓰레기예요' },
  { tier: 2, emoji: '🍕', name: '기름묻은 피자상자', answer: '일반·음식물', tip: '기름 묻은 박스는 일반쓰레기예요' },
  { tier: 2, emoji: '🫗', name: '깨진 유리컵', answer: '일반·음식물', tip: '깨진 유리는 일반쓰레기로 배출해요' },
  { tier: 2, emoji: '🥛', name: '우유팩',       answer: '종이',      tip: '우유팩은 종이류로 분리배출해요' },
  { tier: 2, emoji: '🍪', name: '과자봉지',     answer: '플라스틱',  tip: '과자 봉지(비닐)는 플라스틱류예요' },
  { tier: 2, emoji: '📓', name: '스프링노트',   answer: '일반·음식물', tip: '금속 스프링이 있으면 일반쓰레기예요' },
  { tier: 2, emoji: '🍾', name: '빈 유리병',   answer: '캔·고철',   tip: '빈 유리병은 유리류(캔·고철함)로 배출해요' },
  { tier: 2, emoji: '🔘', name: '페트병뚜껑',   answer: '플라스틱',  tip: '페트병 뚜껑도 플라스틱류예요' },
  // Tier 3 (라운드 8~10 — 많이 헷갈리는 쓰레기)
  { tier: 3, emoji: '☕', name: '테이크아웃컵', answer: '일반·음식물', tip: '코팅된 종이컵은 일반쓰레기예요' },
  { tier: 3, emoji: '📮', name: '택배 스티로폼', answer: '플라스틱', tip: '스티로폼은 플라스틱류예요' },
  { tier: 3, emoji: '🔋', name: '다 쓴 건전지', answer: '캔·고철',  tip: '폐건전지는 캔·고철류로 배출해요' },
];

// ── Sound Manager ────────────────────────────────────────────
const sound = createSoundManager();

// ── State ────────────────────────────────────────────────────
let playerCount   = 2;
let roundIdx      = 0;
let scores        = [];
let roundLog      = [];   // { item, winnerIdx (-1=timeout), dqPlayers[], timedOut }
let currentItem   = null; // 현재 라운드 쓰레기 아이템
let dqSet         = new Set();
let phase         = 'idle';
let timerHandle   = null;
let nextHandle    = null;
let timeRemaining = ROUND_TIME;
let gameItems     = [];   // 10문제 (tier 균형 선정)

// ── DOM refs ─────────────────────────────────────────────────
const introScreen     = document.getElementById('introScreen');
const countdownScreen = document.getElementById('countdownScreen');
const countdownNumber = document.getElementById('countdownNumber');
const gameScreen      = document.getElementById('gameScreen');
const resultScreen    = document.getElementById('resultScreen');

const backBtn   = document.getElementById('backBtn');
const playBtn   = document.getElementById('playBtn');
const closeBtn  = document.getElementById('closeBtn');
const retryBtn  = document.getElementById('retryBtn');
const homeBtn   = document.getElementById('homeBtn');

const zonesWrap       = document.getElementById('zonesWrap');
const questionCounter = document.getElementById('questionCounter');
const problemTimer    = document.getElementById('problemTimer');
const trashEmoji      = document.getElementById('trashEmoji');
const trashName       = document.getElementById('trashName');
const answerTip       = document.getElementById('answerTip');
const problemStatus   = document.getElementById('problemStatus');
const scoreBar        = document.getElementById('scoreBar');

const soundToggleIntro = document.getElementById('soundToggleIntro');

const resultTitle     = document.getElementById('resultTitle');
const resultWinner    = document.getElementById('resultWinner');
const resultTableHead = document.getElementById('resultTableHead');
const resultTableBody = document.getElementById('resultTableBody');
const totalRow        = document.getElementById('totalRow');

// ── Helpers ──────────────────────────────────────────────────
function showScreen(s) {
  [introScreen, countdownScreen, gameScreen, resultScreen].forEach(x => x.classList.remove('active'));
  s.classList.add('active');
}

var countdownInterval = null;
function startPreGameCountdown(onDone) {
  showScreen(countdownScreen);
  countdownInterval = runCountdown(countdownNumber, onDone);
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

function clearTimers() {
  if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
  if (timerHandle) { clearInterval(timerHandle); timerHandle = null; }
  if (nextHandle)  { clearTimeout(nextHandle);   nextHandle  = null; }
}

function updateSoundBtn(btn) {
  btn.textContent = sound.isMuted() ? '🔇' : '🔊';
}

// ── 10문제 선정 (3 tier1 + 4 tier2 + 3 tier3) ────────────────
function buildGameItems() {
  const t1 = shuffle(TRASH_ITEMS.filter(x => x.tier === 1)).slice(0, 3);
  const t2 = shuffle(TRASH_ITEMS.filter(x => x.tier === 2)).slice(0, 4);
  const t3 = shuffle(TRASH_ITEMS.filter(x => x.tier === 3)).slice(0, 3);
  // tier1 먼저, tier2 중간, tier3 나중 (난이도 순 배열)
  return [...t1, ...t2, ...t3];
}

// ── Intro illustration ───────────────────────────────────────
function renderIntroIllust() {
  const el = document.getElementById('introIllust');
  if (!el) return;
  el.innerHTML = `<svg viewBox="0 0 220 130" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="6" width="208" height="118" rx="16" fill="#FFF8E1" stroke="#2C2C2C" stroke-width="3"/>
    <!-- 파란 종이통 -->
    <rect x="18" y="50" width="38" height="44" rx="6" fill="#1565C0" stroke="#2C2C2C" stroke-width="3"/>
    <text x="37" y="79" text-anchor="middle" font-size="18">📰</text>
    <!-- 초록 플라스틱통 -->
    <rect x="64" y="50" width="38" height="44" rx="6" fill="#388E3C" stroke="#2C2C2C" stroke-width="3"/>
    <text x="83" y="79" text-anchor="middle" font-size="18">🧴</text>
    <!-- 빨간 캔통 -->
    <rect x="110" y="50" width="38" height="44" rx="6" fill="#C62828" stroke="#2C2C2C" stroke-width="3"/>
    <text x="129" y="79" text-anchor="middle" font-size="18">🥫</text>
    <!-- 회색 일반통 -->
    <rect x="156" y="50" width="38" height="44" rx="6" fill="#757575" stroke="#2C2C2C" stroke-width="3"/>
    <text x="175" y="79" text-anchor="middle" font-size="18">🗑️</text>
    <!-- 쓰레기 아이템 낙하 표시 -->
    <text x="110" y="36" text-anchor="middle" font-size="20">♻️</text>
    <line x1="110" y1="40" x2="110" y2="48" stroke="#2C2C2C" stroke-width="2" stroke-dasharray="3 2"/>
  </svg>`;
}
renderIntroIllust();

// ── Player count selection ───────────────────────────────────
document.querySelectorAll('.player-btn').forEach(function(btn) {
  onTap(btn, function() {
    document.querySelectorAll('.player-btn').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    playerCount = parseInt(btn.dataset.count, 10);
  });
});

// ── Sound toggle ─────────────────────────────────────────────
onTap(soundToggleIntro, function() {
  sound.toggleMute();
  updateSoundBtn(soundToggleIntro);
});
updateSoundBtn(soundToggleIntro);

// ── Navigation ───────────────────────────────────────────────
onTap(backBtn,  function() { goHome(); });
onTap(closeBtn, function() { clearTimers(); goHome(); });
onTap(homeBtn,  function() { goHome(); });
onTap(retryBtn, function() { startPreGameCountdown(function() { startGame(); }); });
onTap(playBtn,  function() { startPreGameCountdown(function() { startGame(); }); });

// ── Build zone grid ──────────────────────────────────────────
function buildZones() {
  zonesWrap.innerHTML = '';
  zonesWrap.className = 'zones-wrap p' + playerCount;

  for (let i = 0; i < playerCount; i++) {
    const cfg  = PLAYER_CONFIG[i];
    const zone = document.createElement('div');
    zone.className = 'zone ' + cfg.cls;
    zone.dataset.player = i;
    zone.style.background = cfg.zoneBg;

    // Header
    const header = document.createElement('div');
    header.className = 'zone-header';
    header.innerHTML =
      '<span class="zone-label">' + cfg.label + '</span>' +
      '<span class="zone-score-chip" id="score-chip-' + i + '">0점</span>';

    // 4 bin buttons
    const grid = document.createElement('div');
    grid.className = 'bin-grid';

    TRASH_BINS.forEach(function(bin) {
      const btn = document.createElement('button');
      btn.className = 'bin-btn';
      btn.dataset.bin = bin.name;
      btn.dataset.player = i;
      btn.setAttribute('aria-label', cfg.label + ' ' + bin.name + ' 수거함');
      btn.textContent = bin.name;
      onTap(btn, function() { handleBinTap(i, bin.name, btn); });
      grid.appendChild(btn);
    });

    zone.appendChild(header);
    zone.appendChild(grid);
    zonesWrap.appendChild(zone);
  }
}

function getZone(idx) {
  return zonesWrap.querySelector('.zone[data-player="' + idx + '"]');
}

function getBinBtns(playerIdx) {
  return zonesWrap.querySelectorAll('.bin-btn[data-player="' + playerIdx + '"]');
}

function updateScoreChip(playerIdx) {
  const chip = document.getElementById('score-chip-' + playerIdx);
  if (chip) chip.textContent = scores[playerIdx] + '점';
}

// ── Score bar ────────────────────────────────────────────────
function buildScoreBar() {
  scoreBar.innerHTML = '';
  for (let i = 0; i < playerCount; i++) {
    const cfg  = PLAYER_CONFIG[i];
    const chip = document.createElement('div');
    chip.className = 'score-chip';
    chip.innerHTML =
      '<span class="score-chip-dot" style="background:' + cfg.dot + '"></span>' +
      '<span>' + cfg.label + '</span>' +
      '<span class="score-chip-val" id="bar-score-' + i + '">0</span>';
    scoreBar.appendChild(chip);
  }
}

function updateBarScore(playerIdx) {
  const el = document.getElementById('bar-score-' + playerIdx);
  if (el) el.textContent = scores[playerIdx];
}

// ── Reset zone buttons for new round ─────────────────────────
function resetBtnsForRound() {
  for (let i = 0; i < playerCount; i++) {
    getBinBtns(i).forEach(function(btn) {
      btn.className = 'bin-btn';
      btn.disabled = false;
    });
    const zone = getZone(i);
    if (zone) zone.classList.remove('dq-zone');
  }
}

function disablePlayerBtns(playerIdx) {
  getBinBtns(playerIdx).forEach(function(b) {
    b.classList.add('state-disabled');
    b.disabled = true;
  });
}

// ── Timer logic ──────────────────────────────────────────────
function startCountdown() {
  timeRemaining = ROUND_TIME;
  problemTimer.textContent = timeRemaining;
  problemTimer.classList.remove('urgent');

  timerHandle = setInterval(function() {
    timeRemaining--;
    problemTimer.textContent = timeRemaining;

    if (timeRemaining <= 3 && timeRemaining > 0) {
      problemTimer.classList.add('urgent');
      sound.play('tick');
    }

    if (timeRemaining <= 0) {
      clearTimers();
      handleTimeout();
    }
  }, 1000);
}

// ── Bin tap handler ──────────────────────────────────────────
function handleBinTap(playerIdx, binName, btn) {
  if (phase !== 'active') return;
  if (dqSet.has(playerIdx)) return;

  if (binName === currentItem.answer) {
    // 정답!
    resolveRound(playerIdx, btn);
  } else {
    // 오답 — 라운드 실격
    sound.play('buzz');
    btn.classList.add('state-wrong');
    setTimeout(function() { btn.classList.remove('state-wrong'); }, 400);

    dqSet.add(playerIdx);
    disablePlayerBtns(playerIdx);

    const zone = getZone(playerIdx);
    zone.classList.add('dq-zone');

    // 실격 플래시
    const flash = document.createElement('div');
    flash.className = 'penalty-flash';
    flash.textContent = '실격!';
    zone.appendChild(flash);
    flash.addEventListener('animationend', function() { flash.remove(); });

    // 전원 실격 시 타임아웃 처리
    let anyActive = false;
    for (let i = 0; i < playerCount; i++) {
      if (!dqSet.has(i)) { anyActive = true; break; }
    }
    if (!anyActive) {
      clearTimers();
      nextHandle = setTimeout(function() { handleTimeout(); }, 300);
    }
  }
}

// ── 정답 처리 ────────────────────────────────────────────────
function resolveRound(winnerIdx, correctBtn) {
  phase = 'done';
  clearTimers();
  sound.play('ding');

  scores[winnerIdx]++;
  updateScoreChip(winnerIdx);
  updateBarScore(winnerIdx);

  // 승자 — 정답 버튼 강조, 나머지 비활성
  getBinBtns(winnerIdx).forEach(function(btn) {
    if (btn.dataset.bin === currentItem.answer) {
      btn.classList.add('state-correct');
    } else {
      btn.classList.add('state-disabled');
      btn.disabled = true;
    }
  });

  // 나머지 플레이어 비활성화
  for (let i = 0; i < playerCount; i++) {
    if (i !== winnerIdx) disablePlayerBtns(i);
  }

  problemStatus.textContent = '✅ ' + PLAYER_CONFIG[winnerIdx].label + ' 정답!';
  answerTip.textContent = '💡 ' + currentItem.tip;

  roundLog.push({
    item: currentItem,
    winnerIdx: winnerIdx,
    dqPlayers: Array.from(dqSet),
    timedOut: false,
  });

  nextHandle = setTimeout(function() { nextRound(); }, RESULT_PAUSE_MS);
}

// ── 타임아웃 처리 ────────────────────────────────────────────
function handleTimeout() {
  phase = 'done';
  clearTimers();
  sound.play('timeout');

  // 정답 수거함 강조 (모든 zone)
  for (let i = 0; i < playerCount; i++) {
    getBinBtns(i).forEach(function(btn) {
      if (btn.dataset.bin === currentItem.answer) {
        btn.classList.remove('state-disabled');
        btn.classList.add('state-reveal');
        btn.disabled = true;
      } else {
        btn.classList.add('state-disabled');
        btn.disabled = true;
      }
    });
    const zone = getZone(i);
    if (zone) zone.classList.remove('dq-zone');
  }

  problemStatus.textContent = '⏰ 시간 초과! 정답: ' + currentItem.answer;
  answerTip.textContent = '💡 ' + currentItem.tip;

  roundLog.push({
    item: currentItem,
    winnerIdx: -1,
    dqPlayers: Array.from(dqSet),
    timedOut: true,
  });

  nextHandle = setTimeout(function() { nextRound(); }, RESULT_PAUSE_MS);
}

// ── Load round ───────────────────────────────────────────────
function loadRound() {
  phase        = 'active';
  currentItem  = gameItems[roundIdx];
  dqSet        = new Set();

  questionCounter.textContent = (roundIdx + 1) + ' / ' + TOTAL_ROUNDS;
  trashEmoji.textContent  = currentItem.emoji;
  trashName.textContent   = currentItem.name;
  answerTip.textContent   = '';
  problemStatus.textContent = '';
  problemTimer.classList.remove('urgent');

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
  gameItems   = buildGameItems();
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

  const maxScore = Math.max.apply(null, scores);
  const winners  = scores
    .map(function(s, i) { return { s: s, i: i }; })
    .filter(function(x) { return x.s === maxScore; })
    .map(function(x) { return x.i; });

  if (maxScore === 0) {
    resultTitle.textContent  = '😅 무승부!';
    resultWinner.textContent = '아무도 점수를 얻지 못했어요.';
  } else if (winners.length === 1) {
    const w = winners[0];
    resultTitle.textContent  = '🏆 게임 종료!';
    resultWinner.textContent = PLAYER_CONFIG[w].label + ' 승리! (' + maxScore + '점)';
  } else {
    const labels = winners.map(function(w) { return PLAYER_CONFIG[w].label; }).join(', ');
    resultTitle.textContent  = '🤝 동점!';
    resultWinner.textContent = labels + ' 공동 1위! (' + maxScore + '점)';
  }

  // Table header
  const headRow = document.createElement('tr');
  let headCells = '<th>라운드</th>';
  for (let i = 0; i < playerCount; i++) {
    headCells += '<th><span class="player-dot" style="background:' + PLAYER_CONFIG[i].dot + '"></span>' + PLAYER_CONFIG[i].label + '</th>';
  }
  headRow.innerHTML = headCells;
  resultTableHead.innerHTML = '';
  resultTableHead.appendChild(headRow);

  // Table body
  resultTableBody.innerHTML = '';
  roundLog.forEach(function(log, idx) {
    const tr = document.createElement('tr');
    let cells = '<td style="text-align:left;font-size:0.8rem;">' +
      (idx + 1) + '. ' + log.item.emoji + ' ' + log.item.name +
      '<br><span style="font-size:0.7rem;color:#888;">정답: ' + log.item.answer + '</span>' +
      '</td>';

    for (let i = 0; i < playerCount; i++) {
      if (log.winnerIdx === i) {
        cells += '<td class="cell-win">✅ +1</td>';
      } else if (log.dqPlayers.indexOf(i) !== -1) {
        cells += '<td class="cell-wrong">❌ 실격</td>';
      } else if (log.timedOut) {
        cells += '<td class="cell-timeout">⏰</td>';
      } else {
        cells += '<td class="cell-none">—</td>';
      }
    }
    tr.innerHTML = cells;
    resultTableBody.appendChild(tr);
  });

  // Total chips
  totalRow.innerHTML = '';
  for (let i = 0; i < playerCount; i++) {
    const cfg   = PLAYER_CONFIG[i];
    const isWin = winners.indexOf(i) !== -1 && maxScore > 0;
    const chip  = document.createElement('div');
    chip.className = 'total-chip';
    chip.innerHTML =
      '<span class="chip-dot" style="background:' + cfg.dot + '"></span>' +
      '<span>' + cfg.label + '</span>' +
      '<span class="chip-score" style="color:' + (isWin ? '#2E7D32' : '#555') + '">' + scores[i] + '점</span>' +
      (isWin ? '<span>🏆</span>' : '');
    totalRow.appendChild(chip);
  }

  showScreen(resultScreen);
}
