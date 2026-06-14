/* games/capital-quiz/game.js */

'use strict';

// ── Constants ─────────────────────────────────────────────────
const TOTAL_ROUNDS    = 10;
const ROUND_TIME      = 8;     // seconds per round
const RESULT_PAUSE_MS = 1800;  // pause before next round

// Player colour config
const PLAYER_CONFIG = [
  { label: 'P1', dot: '#0288D1', zoneBg: '#B3E5FC', cls: 'p1', fillA: '#1565C0', fillB: '#0288D1', fillC: '#29B6F6', fillD: '#4FC3F7' },
  { label: 'P2', dot: '#E53935', zoneBg: '#FFCDD2', cls: 'p2', fillA: '#B71C1C', fillB: '#E53935', fillC: '#EF9A9A', fillD: '#FFCDD2' },
  { label: 'P3', dot: '#388E3C', zoneBg: '#C8E6C9', cls: 'p3', fillA: '#1B5E20', fillB: '#388E3C', fillC: '#66BB6A', fillD: '#A5D6A7' },
  { label: 'P4', dot: '#F57C00', zoneBg: '#FFE0B2', cls: 'p4', fillA: '#E65100', fillB: '#F57C00', fillC: '#FFA726', fillD: '#FFCC80' },
];

// Answer button fill colours per player (4 distinct shades)
const BTN_FILLS = [
  ['#1565C0', '#0288D1', '#0097A7', '#00796B'],
  ['#C62828', '#E53935', '#AD1457', '#6A1B9A'],
  ['#2E7D32', '#388E3C', '#558B2F', '#33691E'],
  ['#E65100', '#F57C00', '#F9A825', '#F57F17'],
];

// ── Country–Capital data ──────────────────────────────────────
const ALL_PAIRS = [
  { country: '대한민국',        capital: '서울' },
  { country: '일본',            capital: '도쿄' },
  { country: '중국',            capital: '베이징' },
  { country: '미국',            capital: '워싱턴' },
  { country: '영국',            capital: '런던' },
  { country: '프랑스',          capital: '파리' },
  { country: '독일',            capital: '베를린' },
  { country: '이탈리아',        capital: '로마' },
  { country: '스페인',          capital: '마드리드' },
  { country: '러시아',          capital: '모스크바' },
  { country: '캐나다',          capital: '오타와' },
  { country: '호주',            capital: '캔버라' },
  { country: '브라질',          capital: '브라질리아' },
  { country: '인도',            capital: '뉴델리' },
  { country: '태국',            capital: '방콕' },
  { country: '베트남',          capital: '하노이' },
  { country: '이집트',          capital: '카이로' },
  { country: '터키',            capital: '앙카라' },
  { country: '멕시코',          capital: '멕시코시티' },
  { country: '아르헨티나',      capital: '부에노스아이레스' },
  { country: '스위스',          capital: '베른' },
  { country: '네덜란드',        capital: '암스테르담' },
  { country: '그리스',          capital: '아테네' },
  { country: '필리핀',          capital: '마닐라' },
  { country: '인도네시아',      capital: '자카르타' },
  { country: '남아프리카공화국', capital: '프리토리아' },
  { country: '뉴질랜드',        capital: '웰링턴' },
  { country: '노르웨이',        capital: '오슬로' },
  { country: '스웨덴',          capital: '스톡홀름' },
  { country: '폴란드',          capital: '바르샤바' },
  { country: '콜롬비아',        capital: '보고타' },
  { country: '칠레',            capital: '산티아고' },
  { country: '나이지리아',      capital: '아부자' },
];

// ── Sound Manager ─────────────────────────────────────────────
const sound = createSoundManager();

// ── State ─────────────────────────────────────────────────────
let playerCount   = 2;
let roundIdx      = 0;
let scores        = [];
let roundLog      = [];    // { country, correctCapital, winnerIdx (-1=timeout), dqPlayers[] }
let currentRound  = null;  // { country, correctCapital, choices[] }
let dqSet         = new Set();
let phase         = 'idle'; // 'idle' | 'active' | 'done'
let timerHandle   = null;
let nextHandle    = null;
let timeRemaining = ROUND_TIME;
let gameRounds    = [];    // 10 rounds to play

// ── DOM refs ──────────────────────────────────────────────────
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

const zonesWrap       = document.getElementById('zonesWrap');
const questionCounter = document.getElementById('questionCounter');
const problemTimer    = document.getElementById('problemTimer');
const countryText     = document.getElementById('countryText');
const problemStatus   = document.getElementById('problemStatus');
const scoreBar        = document.getElementById('scoreBar');
const soundToggleIntro = document.getElementById('soundToggleIntro');

const resultTitle     = document.getElementById('resultTitle');
const resultWinner    = document.getElementById('resultWinner');
const resultTableHead = document.getElementById('resultTableHead');
const resultTableBody = document.getElementById('resultTableBody');
const totalRow        = document.getElementById('totalRow');

// ── Helpers ───────────────────────────────────────────────────
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

function clearTimers() {
  if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
  if (timerHandle) { clearInterval(timerHandle); timerHandle = null; }
  if (nextHandle)  { clearTimeout(nextHandle);   nextHandle  = null; }
}

function updateSoundIcon() {
  const muted = sound.isMuted();
  const icon = document.getElementById('soundIconIntro');
  if (!icon) return;
  if (muted) {
    icon.innerHTML = `
      <path d="M4 8H8L13 4V18L8 14H4V8Z" fill="currentColor"/>
      <path d="M16 8L21 13M21 8L16 13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    `;
  } else {
    icon.innerHTML = `
      <path d="M4 8H8L13 4V18L8 14H4V8Z" fill="currentColor"/>
      <path d="M16 8C17.5 9 17.5 13 16 14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <path d="M18.5 6C21 8 21 14 18.5 16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    `;
  }
}

// ── Player count selection ────────────────────────────────────
document.querySelectorAll('.player-btn').forEach(btn => {
  onTap(btn, () => {
    document.querySelectorAll('.player-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    playerCount = parseInt(btn.dataset.count, 10);
  });
});

// ── Sound toggle ──────────────────────────────────────────────
onTap(soundToggleIntro, () => {
  sound.toggleMute();
  updateSoundIcon();
});
updateSoundIcon();

// ── Navigation ────────────────────────────────────────────────
onTap(backBtn,  () => goHome());
onTap(closeBtn, () => { clearTimers(); goHome(); });
onTap(homeBtn,  () => goHome());
onTap(retryBtn, () => startPreGameCountdown(() => startGame()));
onTap(playBtn,  () => startPreGameCountdown(() => startGame()));

// ── Round data builder ────────────────────────────────────────
// For each round: pick 1 correct pair + 3 random wrong capitals as distractors
function buildGameRounds(pairs) {
  const selected = shuffle(pairs).slice(0, TOTAL_ROUNDS);
  return selected.map(pair => {
    const distractors = shuffle(
      pairs.filter(p => p.capital !== pair.capital)
    ).slice(0, 3).map(p => p.capital);

    const choices = shuffle([pair.capital, ...distractors]);
    return {
      country: pair.country,
      correctCapital: pair.capital,
      choices, // array of 4 city strings
    };
  });
}

// ── Build zone grid ───────────────────────────────────────────
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

    // Answer grid (2x2)
    const grid = document.createElement('div');
    grid.className = 'answer-grid';
    grid.id = `grid-${i}`;

    zone.appendChild(header);
    zone.appendChild(grid);
    zonesWrap.appendChild(zone);
  }
}

// ── Build SVG answer buttons for a player zone ────────────────
function buildAnswerButtons(playerIdx, choices) {
  const grid    = document.getElementById(`grid-${playerIdx}`);
  const fills   = BTN_FILLS[playerIdx];
  grid.innerHTML = '';

  choices.forEach((city, btnIdx) => {
    const wrap = document.createElement('div');
    wrap.className = 'answer-btn-wrap';
    wrap.dataset.player  = playerIdx;
    wrap.dataset.btnIdx  = btnIdx;
    wrap.dataset.capital = city;

    // SVG button: rounded rect + text
    const fill = fills[btnIdx % fills.length];
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 200 54');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('aria-hidden', 'true');

    // Use player's dot color with low opacity for soft pastel look (matching flag-quiz pattern)
    const dotColor = PLAYER_CONFIG[playerIdx].dot;
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', '2');
    rect.setAttribute('y', '2');
    rect.setAttribute('width', '196');
    rect.setAttribute('height', '50');
    rect.setAttribute('rx', '13');
    rect.setAttribute('ry', '13');
    rect.setAttribute('fill', dotColor);
    rect.setAttribute('fill-opacity', '0.18');
    rect.setAttribute('stroke', dotColor);
    rect.setAttribute('stroke-width', '2');
    rect.classList.add('btn-rect');
    // Drop shadow filter
    rect.setAttribute('filter', `url(#sh${playerIdx}${btnIdx})`);

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
    filter.setAttribute('id', `sh${playerIdx}${btnIdx}`);
    filter.setAttribute('x', '-5%');
    filter.setAttribute('y', '-10%');
    filter.setAttribute('width', '110%');
    filter.setAttribute('height', '130%');
    const feDropShadow = document.createElementNS('http://www.w3.org/2000/svg', 'feDropShadow');
    feDropShadow.setAttribute('dx', '0');
    feDropShadow.setAttribute('dy', '2');
    feDropShadow.setAttribute('stdDeviation', '2');
    feDropShadow.setAttribute('flood-color', 'rgba(0,0,0,0.25)');
    filter.appendChild(feDropShadow);
    defs.appendChild(filter);

    // Determine font size based on city name length
    const len = city.length;
    let fontSize = 18;
    if (len >= 9) fontSize = 12;
    else if (len >= 7) fontSize = 14;
    else if (len >= 5) fontSize = 16;

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', '100');
    text.setAttribute('y', '29');
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'middle');
    text.setAttribute('font-family', "'Pretendard Variable',-apple-system,'Noto Sans KR',sans-serif");
    text.setAttribute('font-size', fontSize);
    text.setAttribute('font-weight', '800');
    text.setAttribute('fill', '#222');
    text.setAttribute('letter-spacing', '0.5');
    text.classList.add('btn-text');
    text.textContent = city;

    svg.appendChild(defs);
    svg.appendChild(rect);
    svg.appendChild(text);
    wrap.appendChild(svg);

    onTap(wrap, () => handleAnswerTap(playerIdx, city, wrap));
    grid.appendChild(wrap);
  });
}

function getZone(idx) {
  return zonesWrap.querySelector(`.zone[data-player="${idx}"]`);
}

function getAnswerWraps(playerIdx) {
  return zonesWrap.querySelectorAll(`.answer-btn-wrap[data-player="${playerIdx}"]`);
}

function updateScoreChip(playerIdx) {
  const chip = document.getElementById(`score-chip-${playerIdx}`);
  if (chip) chip.textContent = `${scores[playerIdx]}점`;
}

// ── Score bar ─────────────────────────────────────────────────
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

// ── Ripple effect ─────────────────────────────────────────────
function spawnRipple(zone, e) {
  const rect  = zone.getBoundingClientRect();
  const touch = e && e.touches ? e.touches[0] : (e || null);
  const x     = touch ? touch.clientX - rect.left : rect.width  / 2;
  const y     = touch ? touch.clientY - rect.top  : rect.height / 2;
  const size  = Math.max(rect.width, rect.height);
  const r     = document.createElement('span');
  r.className = 'zone-ripple';
  r.style.left      = x + 'px';
  r.style.top       = y + 'px';
  r.style.width     = r.style.height = size + 'px';
  r.style.marginLeft = r.style.marginTop = `-${size / 2}px`;
  zone.appendChild(r);
  r.addEventListener('animationend', () => r.remove());
}

// ── Penalty SVG flash ─────────────────────────────────────────
function spawnPenaltyFlash(zone) {
  const flash = document.createElement('div');
  flash.className = 'penalty-flash';
  // SVG "-1" badge
  flash.innerHTML = `
    <svg width="70" height="42" viewBox="0 0 70 42" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="68" height="40" rx="10" fill="#EF5350" stroke="#C62828" stroke-width="2"/>
      <text x="35" y="26" text-anchor="middle" dominant-baseline="middle"
            font-family="'Pretendard Variable',-apple-system,'Noto Sans KR',sans-serif"
            font-size="22" font-weight="900" fill="#FFFFFF">-1</text>
    </svg>
  `;
  zone.appendChild(flash);
  flash.addEventListener('animationend', () => flash.remove());
}

// ── Timer logic ───────────────────────────────────────────────
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

// ── Enable / disable all answer wraps ────────────────────────
function setAllWrapsDisabled(disabled) {
  zonesWrap.querySelectorAll('.answer-btn-wrap').forEach(w => {
    if (disabled) {
      w.classList.add('state-disabled');
    } else {
      w.classList.remove('state-disabled');
    }
  });
}

function resetWrapsForRound() {
  for (let i = 0; i < playerCount; i++) {
    const wraps = getAnswerWraps(i);
    wraps.forEach(w => {
      w.className = 'answer-btn-wrap';
      if (dqSet.has(i)) w.classList.add('state-disabled');
    });
    const zone = getZone(i);
    if (zone) {
      if (dqSet.has(i)) zone.classList.add('dq-zone');
      else zone.classList.remove('dq-zone');
    }
  }
}

// ── Answer tap handler ────────────────────────────────────────
function handleAnswerTap(playerIdx, chosenCapital, wrap) {
  if (phase !== 'active') return;
  if (dqSet.has(playerIdx)) return;

  const zone = getZone(playerIdx);
  spawnRipple(zone, null);

  const correct = (chosenCapital === currentRound.correctCapital);

  if (correct) {
    resolveRound(playerIdx);
  } else {
    // Wrong answer — penalise and disqualify for this round
    sound.play('buzz');
    wrap.classList.add('state-wrong');
    setTimeout(() => { wrap.classList.remove('state-wrong'); }, 380);

    dqSet.add(playerIdx);

    scores[playerIdx] = Math.max(0, scores[playerIdx] - 1);
    updateScoreChip(playerIdx);
    updateBarScore(playerIdx);

    spawnPenaltyFlash(zone);

    // Disable this player's buttons
    getAnswerWraps(playerIdx).forEach(w => w.classList.add('state-disabled'));
    zone.classList.add('dq-zone');

    // If all players are DQ'd, trigger timeout
    let anyActive = false;
    for (let i = 0; i < playerCount; i++) {
      if (!dqSet.has(i)) { anyActive = true; break; }
    }
    if (!anyActive) {
      clearTimers();
      setTimeout(() => handleTimeout(), 300);
    }
  }
}

// ── Correct answer ────────────────────────────────────────────
function resolveRound(winnerIdx) {
  phase = 'done';
  clearTimers();

  sound.play('ding');

  scores[winnerIdx]++;
  updateScoreChip(winnerIdx);
  updateBarScore(winnerIdx);

  // Highlight correct button for winner
  const wraps = getAnswerWraps(winnerIdx);
  wraps.forEach(w => {
    if (w.dataset.capital === currentRound.correctCapital) {
      w.classList.add('state-correct');
    } else {
      w.classList.add('state-disabled');
    }
  });

  // Dim other zones
  for (let i = 0; i < playerCount; i++) {
    if (i !== winnerIdx) {
      getAnswerWraps(i).forEach(w => w.classList.add('state-disabled'));
    }
  }

  problemStatus.textContent = `${PLAYER_CONFIG[winnerIdx].label} 정답!`;

  roundLog.push({
    country: currentRound.country,
    correctCapital: currentRound.correctCapital,
    winnerIdx,
    dqPlayers: [...dqSet],
    timedOut: false,
  });

  nextHandle = setTimeout(() => nextRound(), RESULT_PAUSE_MS);
}

// ── Timeout ───────────────────────────────────────────────────
function handleTimeout() {
  phase = 'done';
  clearTimers();
  sound.play('timeout');

  // Reveal correct answer on all zones
  for (let i = 0; i < playerCount; i++) {
    const wraps = getAnswerWraps(i);
    wraps.forEach(w => {
      if (w.dataset.capital === currentRound.correctCapital) {
        w.classList.remove('state-disabled');
        w.classList.add('state-reveal');
      } else {
        w.classList.add('state-disabled');
      }
    });
    getZone(i).classList.remove('dq-zone');
  }

  problemStatus.textContent = `시간 초과! 정답: ${currentRound.correctCapital}`;

  roundLog.push({
    country: currentRound.country,
    correctCapital: currentRound.correctCapital,
    winnerIdx: -1,
    dqPlayers: [...dqSet],
    timedOut: true,
  });

  nextHandle = setTimeout(() => nextRound(), RESULT_PAUSE_MS);
}

// ── Load round ────────────────────────────────────────────────
function loadRound() {
  phase        = 'active';
  currentRound = gameRounds[roundIdx];
  dqSet        = new Set();

  questionCounter.textContent = `${roundIdx + 1} / ${TOTAL_ROUNDS}`;
  countryText.textContent     = currentRound.country;
  problemStatus.textContent   = '';
  problemTimer.classList.remove('urgent');

  // Rebuild answer buttons with this round's choices
  for (let i = 0; i < playerCount; i++) {
    buildAnswerButtons(i, currentRound.choices);
  }
  resetWrapsForRound();

  startCountdown();
}

// ── Next round ────────────────────────────────────────────────
function nextRound() {
  roundIdx++;
  if (roundIdx >= TOTAL_ROUNDS) {
    showResult();
  } else {
    loadRound();
  }
}

// ── Start game ────────────────────────────────────────────────
function startGame() {
  gameRounds  = buildGameRounds(ALL_PAIRS);
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

// ── Show result ───────────────────────────────────────────────
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

  // Table header
  const headRow = document.createElement('tr');
  headRow.innerHTML = '<th>나라</th>' +
    Array.from({ length: playerCount }, (_, i) =>
      `<th><span class="player-dot" style="background:${PLAYER_CONFIG[i].dot}"></span>${PLAYER_CONFIG[i].label}</th>`
    ).join('');
  resultTableHead.innerHTML = '';
  resultTableHead.appendChild(headRow);

  // Table body
  resultTableBody.innerHTML = '';
  roundLog.forEach((log, idx) => {
    const tr = document.createElement('tr');
    let cells = `<td style="text-align:left;font-size:0.78rem;">${idx + 1}. ${log.country}<br>
      <span style="font-size:0.7rem;color:#888;">정답: ${log.correctCapital}</span></td>`;

    for (let i = 0; i < playerCount; i++) {
      if (log.timedOut) {
        cells += `<td class="cell-timeout">시간초과</td>`;
      } else if (log.winnerIdx === i) {
        cells += `<td class="cell-win">+1</td>`;
      } else if (log.dqPlayers.includes(i)) {
        cells += `<td class="cell-wrong">-1</td>`;
      } else {
        cells += `<td class="cell-none">-</td>`;
      }
    }
    tr.innerHTML = cells;
    resultTableBody.appendChild(tr);
  });

  // Total chips
  totalRow.innerHTML = '';
  for (let i = 0; i < playerCount; i++) {
    const cfg   = PLAYER_CONFIG[i];
    const isWin = winners.includes(i);
    const chip  = document.createElement('div');
    chip.className = 'total-chip';
    chip.innerHTML = `
      <span class="chip-dot" style="background:${cfg.dot}"></span>
      <span>${cfg.label}</span>
      <span class="chip-score" style="color:${isWin ? '#2E7D32' : '#555'}">${scores[i]}점</span>
      ${isWin ? '<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 2L11.5 7H17L12.5 10.5L14 16L9 13L4 16L5.5 10.5L1 7H6.5L9 2Z" fill="#F9A825"/></svg>' : ''}
    `;
    totalRow.appendChild(chip);
  }

  showScreen(resultScreen);
}
