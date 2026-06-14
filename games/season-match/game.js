/* games/season-match/game.js */

'use strict';

// ── Constants ────────────────────────────────────────────────
const TOTAL_ROUNDS    = 10;
const ROUND_TIME      = 10;   // seconds per round
const RESULT_PAUSE_MS = getAutoplayPauseMs(2000);

// Player config
const PLAYER_CONFIG = [
  { label: 'P1', dot: '#0288D1', zoneBg: '#B3E5FC', cls: 'p1' },
  { label: 'P2', dot: '#E53935', zoneBg: '#FFCDD2', cls: 'p2' },
  { label: 'P3', dot: '#388E3C', zoneBg: '#C8E6C9', cls: 'p3' },
  { label: 'P4', dot: '#F57C00', zoneBg: '#FFE0B2', cls: 'p4' },
];

// Season definitions (semantic, fixed colors)
const SEASONS = [
  { name: '봄',   color: '#8BC34A' },
  { name: '여름', color: '#0288D1' },
  { name: '가을', color: '#F57C00' },
  { name: '겨울', color: '#29B6F6' },
];

// ── Item Library ─────────────────────────────────────────────
// tier1: obvious emoji items (rounds 1-3)
const TIER1_ITEMS = [
  { tier: 1, emoji: '⛄', name: '눈사람',   answer: '겨울' },
  { tier: 1, emoji: '🍁', name: '단풍잎',   answer: '가을' },
  { tier: 1, emoji: '🏖️', name: '물놀이',   answer: '여름' },
  { tier: 1, emoji: '🌱', name: '새싹',     answer: '봄'   },
  { tier: 1, emoji: '🌸', name: '벚꽃',     answer: '봄'   },
  { tier: 1, emoji: '🍉', name: '수박',     answer: '여름' },
  { tier: 1, emoji: '❄️', name: '눈',       answer: '겨울' },
  { tier: 1, emoji: '🍂', name: '낙엽',     answer: '가을' },
  { tier: 1, emoji: '🏊', name: '해수욕',   answer: '여름' },
  { tier: 1, emoji: '💐', name: '진달래꽃', answer: '봄'   },
];

// tier2: festival/event items (rounds 4-7)
const TIER2_ITEMS = [
  { tier: 2, emoji: '🎊', name: '설날',     answer: '겨울' },
  { tier: 2, emoji: '🌕', name: '추석',     answer: '가을' },
  { tier: 2, emoji: '🎁', name: '어린이날', answer: '봄'   },
  { tier: 2, emoji: '🎄', name: '크리스마스', answer: '겨울' },
  { tier: 2, emoji: '🎓', name: '졸업식',   answer: '겨울' },
  { tier: 2, emoji: '📚', name: '입학식',   answer: '봄'   },
  { tier: 2, emoji: '🍁', name: '단풍놀이', answer: '가을' },
  { tier: 2, emoji: '⛷️', name: '스키',     answer: '겨울' },
  { tier: 2, emoji: '🏊', name: '수영장',   answer: '여름' },
  { tier: 2, emoji: '🦟', name: '모기',     answer: '여름' },
];

// tier3: two-step inference questions (rounds 8-10)
const TIER3_ITEMS = [
  { tier: 3, emoji: '', name: '개구리가 겨울잠에서 깨는 계절은?', answer: '봄'   },
  { tier: 3, emoji: '', name: '매미가 우는 계절은?',             answer: '여름' },
  { tier: 3, emoji: '', name: '추수를 하는 계절은?',             answer: '가을' },
];

// ── Sound Manager ────────────────────────────────────────────
const sound = createSoundManager({
  ding(ctx) {
    [523, 659, 784].forEach(function(freq, i) {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      const t = ctx.currentTime + i * 0.09;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
      osc.start(t);
      osc.stop(t + 0.32);
    });
  },

  buzz(ctx) {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.28);
    gain.gain.setValueAtTime(0.45, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.32);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.32);
  },

  timeout(ctx) {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160, ctx.currentTime);
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  },

  tick(ctx) {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'square';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.08);
  },

  fanfare(ctx) {
    [392, 494, 523, 659, 784].forEach(function(freq, i) {
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
let playerCount   = 2;
let roundIdx      = 0;
let scores        = [];
let roundLog      = [];   // { item, winnerIdx (-1=timeout), dqPlayers[], timedOut }
let currentItem   = null; // { tier, emoji, name, answer }
let dqSet         = new Set();
let phase         = 'idle'; // 'idle' | 'active' | 'done'
let timerHandle   = null;
let nextHandle    = null;
let timeRemaining = ROUND_TIME;
let gameItems     = [];   // 10 selected items for the game

// ── DOM refs ─────────────────────────────────────────────────
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
const problemTimer    = document.getElementById('problemTimer');
const problemEmoji    = document.getElementById('problemEmoji');
const problemName     = document.getElementById('problemName');
const problemStatus   = document.getElementById('problemStatus');
const scoreBar        = document.getElementById('scoreBar');

const soundToggleIntro = document.getElementById('soundToggleIntro');
const introIllust      = document.getElementById('introIllust');

const resultTitle     = document.getElementById('resultTitle');
const resultWinner    = document.getElementById('resultWinner');
const resultTableHead = document.getElementById('resultTableHead');
const resultTableBody = document.getElementById('resultTableBody');
const totalRow        = document.getElementById('totalRow');

// ── Helpers ──────────────────────────────────────────────────
function showScreen(s) {
  [introScreen, countdownScreen, gameScreen, resultScreen].forEach(function(x) {
    x.classList.remove('active');
  });
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
    const tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }
  return a;
}

function clearTimers() {
  if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
  if (timerHandle) { clearInterval(timerHandle); timerHandle = null; }
  if (nextHandle)  { clearTimeout(nextHandle);   nextHandle  = null; }
}


// ── Item selection: 3 tier1 + 4 tier2 + 3 tier3, shuffled within each tier ──
function buildGameItems() {
  const t1 = shuffle(TIER1_ITEMS).slice(0, 3);
  const t2 = shuffle(TIER2_ITEMS).slice(0, 4);
  const t3 = shuffle(TIER3_ITEMS).slice(0, 3);
  return t1.concat(t2).concat(t3);
}

// ── Intro illustration ───────────────────────────────────────
function renderIntroIllust() {
  introIllust.innerHTML = '<svg viewBox="0 0 220 130" xmlns="http://www.w3.org/2000/svg">' +
    '<rect x="6" y="6" width="208" height="118" rx="16" fill="#FFF8E1" stroke="#2C2C2C" stroke-width="3"/>' +
    '<rect x="16" y="22" width="44" height="90" rx="10" fill="#C8E6C9" stroke="#2C2C2C" stroke-width="2.5"/>' +
    '<rect x="66" y="22" width="44" height="90" rx="10" fill="#B3E5FC" stroke="#2C2C2C" stroke-width="2.5"/>' +
    '<rect x="116" y="22" width="44" height="90" rx="10" fill="#FFE0B2" stroke="#2C2C2C" stroke-width="2.5"/>' +
    '<rect x="166" y="22" width="44" height="90" rx="10" fill="#FFCDD2" stroke="#2C2C2C" stroke-width="2.5"/>' +
    '<text x="38" y="58" text-anchor="middle" font-size="22">🌸</text>' +
    '<text x="38" y="98" text-anchor="middle" font-size="13" font-weight="900" fill="#388E3C">봄</text>' +
    '<text x="88" y="58" text-anchor="middle" font-size="22">🍉</text>' +
    '<text x="88" y="98" text-anchor="middle" font-size="13" font-weight="900" fill="#0288D1">여름</text>' +
    '<text x="138" y="58" text-anchor="middle" font-size="22">🍁</text>' +
    '<text x="138" y="98" text-anchor="middle" font-size="13" font-weight="900" fill="#F57C00">가을</text>' +
    '<text x="188" y="58" text-anchor="middle" font-size="22">⛄</text>' +
    '<text x="188" y="98" text-anchor="middle" font-size="13" font-weight="900" fill="#0288D1">겨울</text>' +
  '</svg>';
}
renderIntroIllust();

// ── Player count selection ───────────────────────────────────
setupPlayerSelect(function (n) { playerCount = n; });

// ── Sound toggle ─────────────────────────────────────────────
setupSoundToggle(sound, soundToggleIntro);

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
    zone.dataset.player = String(i);
    zone.style.background = cfg.zoneBg;

    // Zone header
    const header = document.createElement('div');
    header.className = 'zone-header';
    header.innerHTML =
      '<span class="zone-label">' + cfg.label + '</span>' +
      '<span class="zone-score-chip" id="score-chip-' + i + '">0점</span>';

    // Season button grid (all 4 buttons, always active)
    const grid = document.createElement('div');
    grid.className = 'season-grid';
    grid.id = 'season-grid-' + i;

    SEASONS.forEach(function(season) {
      const btn = document.createElement('button');
      btn.className = 'season-btn';
      btn.dataset.season = season.name;
      btn.dataset.player = String(i);
      btn.setAttribute('aria-label', cfg.label + ' ' + season.name);
      btn.textContent = season.name;
      onTap(btn, function() { handleSeasonTap(i, season.name, btn); });
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

function getSeasonBtns(playerIdx) {
  const grid = document.getElementById('season-grid-' + playerIdx);
  return grid ? Array.from(grid.querySelectorAll('.season-btn')) : [];
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
  if (el) el.textContent = String(scores[playerIdx]);
}

// ── Reset zone buttons for new round ─────────────────────────
function resetBtnsForRound() {
  for (let i = 0; i < playerCount; i++) {
    getSeasonBtns(i).forEach(function(btn) {
      btn.className = 'season-btn';
      btn.disabled = false;
    });
    const zone = getZone(i);
    if (zone) zone.classList.remove('dq-zone');
  }
}

function disablePlayerBtns(playerIdx) {
  getSeasonBtns(playerIdx).forEach(function(b) {
    b.classList.add('state-disabled');
    b.disabled = true;
  });
}

// ── Timer logic ──────────────────────────────────────────────
function startCountdown() {
  timeRemaining = ROUND_TIME;
  problemTimer.textContent = String(timeRemaining);
  problemTimer.classList.remove('urgent');

  timerHandle = setInterval(function() {
    timeRemaining--;
    problemTimer.textContent = String(timeRemaining);

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

// ── Answer tap handler ───────────────────────────────────────
function handleSeasonTap(playerIdx, season, btn) {
  if (phase !== 'active') return;
  if (dqSet.has(playerIdx)) return;

  if (season === currentItem.answer) {
    resolveRound(playerIdx, btn);
  } else {
    // Wrong answer — round disqualification
    sound.play('buzz');
    btn.classList.add('state-wrong');
    setTimeout(function() { btn.classList.remove('state-wrong'); }, 400);

    dqSet.add(playerIdx);

    // Penalty flash
    const zone = getZone(playerIdx);
    const flash = document.createElement('div');
    flash.className = 'penalty-flash';
    flash.textContent = '실격!';
    zone.appendChild(flash);
    flash.addEventListener('animationend', function() { flash.remove(); });

    disablePlayerBtns(playerIdx);
    zone.classList.add('dq-zone');

    // If all players disqualified, go to timeout
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

// ── Correct answer ───────────────────────────────────────────
function resolveRound(winnerIdx, winBtn) {
  phase = 'done';
  clearTimers();
  sound.play('ding');

  scores[winnerIdx]++;
  updateScoreChip(winnerIdx);
  updateBarScore(winnerIdx);

  // Highlight winner's correct button
  if (winBtn) winBtn.classList.add('state-correct');

  // Disable all other buttons in winning zone
  getSeasonBtns(winnerIdx).forEach(function(b) {
    if (b !== winBtn) {
      b.classList.add('state-disabled');
      b.disabled = true;
    }
  });

  // Disable all other zones
  for (let i = 0; i < playerCount; i++) {
    if (i !== winnerIdx) disablePlayerBtns(i);
  }

  problemStatus.textContent = '✅ ' + PLAYER_CONFIG[winnerIdx].label + ' 정답! (' + currentItem.answer + ')';

  roundLog.push({
    item: currentItem,
    winnerIdx: winnerIdx,
    dqPlayers: Array.from(dqSet),
    timedOut: false,
  });

  nextHandle = setTimeout(function() { nextRound(); }, RESULT_PAUSE_MS);
}

// ── Timeout (or all disqualified) ────────────────────────────
function handleTimeout() {
  phase = 'done';
  clearTimers();
  sound.play('timeout');

  // Reveal correct answer button in all zones
  for (let i = 0; i < playerCount; i++) {
    const zone = getZone(i);
    if (zone) zone.classList.remove('dq-zone');
    getSeasonBtns(i).forEach(function(b) {
      if (b.dataset.season === currentItem.answer) {
        b.classList.remove('state-disabled');
        b.classList.add('state-reveal');
      } else {
        b.classList.add('state-disabled');
      }
      b.disabled = true;
    });
  }

  problemStatus.textContent = '⏰ 시간 초과! 정답: ' + currentItem.answer;

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
  phase       = 'active';
  currentItem = gameItems[roundIdx];
  dqSet       = new Set();

  questionCounter.textContent = (roundIdx + 1) + ' / ' + TOTAL_ROUNDS;
  problemEmoji.textContent    = currentItem.emoji;
  problemName.textContent     = currentItem.name;
  problemStatus.textContent   = '';
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
  headRow.innerHTML = '<th>라운드</th>' +
    Array.from({ length: playerCount }, function(_, i) {
      return '<th><span class="player-dot" style="background:' + PLAYER_CONFIG[i].dot + '"></span>' +
             PLAYER_CONFIG[i].label + '</th>';
    }).join('');
  resultTableHead.innerHTML = '';
  resultTableHead.appendChild(headRow);

  // Table body
  resultTableBody.innerHTML = '';
  roundLog.forEach(function(log, idx) {
    const tr = document.createElement('tr');
    const display = log.item.emoji
      ? log.item.emoji + ' ' + log.item.name
      : log.item.name;
    const shortDisplay = display.length > 14 ? display.slice(0, 12) + '…' : display;

    let cells = '<td style="text-align:left;font-size:0.78rem;max-width:140px;">' +
      (idx + 1) + '. ' + shortDisplay + '<br>' +
      '<span style="font-size:0.7rem;color:#888;">정답: ' + log.item.answer + '</span></td>';

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
