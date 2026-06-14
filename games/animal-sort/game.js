/* games/animal-sort/game.js */

'use strict';

// ── Constants ────────────────────────────────────────────────
const TOTAL_ROUNDS    = 10;
const ROUND_TIME      = 8;
const RESULT_PAUSE_MS = 1800;

// Player config
const PLAYER_CONFIG = [
  { label: 'P1', dot: '#0288D1', cls: 'p1' },
  { label: 'P2', dot: '#E53935', cls: 'p2' },
  { label: 'P3', dot: '#388E3C', cls: 'p3' },
  { label: 'P4', dot: '#F57C00', cls: 'p4' },
];

// ── Animal Data ──────────────────────────────────────────────
// 4 카테고리: 포유류 / 조류 / 어류 / 곤충
// 33개 (포유 10 · 조 8 · 어 7 · 곤 8)
const ALL_ANIMALS = [
  // 포유류 (10)
  { name: '사자',     emoji: '🦁', category: '포유류' },
  { name: '호랑이',   emoji: '🐯', category: '포유류' },
  { name: '코끼리',   emoji: '🐘', category: '포유류' },
  { name: '곰',       emoji: '🐻', category: '포유류' },
  { name: '토끼',     emoji: '🐰', category: '포유류' },
  { name: '원숭이',   emoji: '🐵', category: '포유류' },
  { name: '기린',     emoji: '🦒', category: '포유류' },
  { name: '얼룩말',   emoji: '🦓', category: '포유류' },
  { name: '캥거루',   emoji: '🦘', category: '포유류' },
  { name: '돌고래',   emoji: '🐬', category: '포유류' },

  // 조류 (8)
  { name: '독수리',   emoji: '🦅', category: '조류' },
  { name: '참새',     emoji: '🐦', category: '조류' },
  { name: '비둘기',   emoji: '🕊️', category: '조류' },
  { name: '닭',       emoji: '🐔', category: '조류' },
  { name: '오리',     emoji: '🦆', category: '조류' },
  { name: '펭귄',     emoji: '🐧', category: '조류' },
  { name: '부엉이',   emoji: '🦉', category: '조류' },
  { name: '백조',     emoji: '🦢', category: '조류' },

  // 어류 (7)
  { name: '상어',     emoji: '🦈', category: '어류' },
  { name: '고등어',   emoji: '🐟', category: '어류' },
  { name: '연어',     emoji: '🐟', category: '어류' },
  { name: '잉어',     emoji: '🐠', category: '어류' },
  { name: '붕어',     emoji: '🐠', category: '어류' },
  { name: '갈치',     emoji: '🐟', category: '어류' },
  { name: '복어',     emoji: '🐡', category: '어류' },

  // 곤충 (8)
  { name: '나비',     emoji: '🦋', category: '곤충' },
  { name: '벌',       emoji: '🐝', category: '곤충' },
  { name: '개미',     emoji: '🐜', category: '곤충' },
  { name: '메뚜기',   emoji: '🦗', category: '곤충' },
  { name: '무당벌레', emoji: '🐞', category: '곤충' },
  { name: '사슴벌레', emoji: '🪲', category: '곤충' },
  { name: '잠자리',   emoji: '🦟', category: '곤충' },
  { name: '귀뚜라미', emoji: '🦗', category: '곤충' },
];

// 보기로 사용할 4개 카테고리 (이모지는 보기 버튼에 함께 표기)
const CATEGORY_OPTIONS = [
  { name: '포유류', emoji: '🐾' },
  { name: '조류',   emoji: '🪶' },
  { name: '어류',   emoji: '🌊' },
  { name: '곤충',   emoji: '🐛' },
];

// ── Sound Manager ────────────────────────────────────────────
const sound = createSoundManager();

// ── State ────────────────────────────────────────────────────
let playerCount   = 2;
let roundIdx      = 0;
let scores        = [];
let roundLog      = [];
let currentAnimal = null;
let currentChoices = [];   // 4 category names (shuffled per round)
let dqSet         = new Set();
let phase         = 'idle';
let timerHandle   = null;
let nextHandle    = null;
let timeRemaining = ROUND_TIME;
let gameRounds    = [];

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
const animalDisplay = document.getElementById('animalDisplay');
const problemStatus = document.getElementById('problemStatus');
const scoreBar      = document.getElementById('scoreBar');

const soundToggleIntro = document.getElementById('soundToggleIntro');
const introAnimalRow  = document.getElementById('introAnimalRow');

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
  countdownInterval = runCountdown(countdownNumber, onDone);
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

function updateSoundBtn(btn) {
  btn.textContent = sound.isMuted() ? '🔇' : '🔊';
}

// 4 보기는 항상 4개 카테고리 (셔플)
function makeChoices() {
  return shuffle(CATEGORY_OPTIONS.slice());
}

// ── Intro animal preview (인트로 일러스트) ────────────────────
function renderIntroAnimals() {
  introAnimalRow.innerHTML = '';
  // 카테고리별 1마리씩 4개 (다양성)
  const sample = ['포유류','조류','어류','곤충'].map(cat => {
    const list = ALL_ANIMALS.filter(a => a.category === cat);
    return list[Math.floor(Math.random() * list.length)];
  });
  sample.forEach(a => {
    const wrap = document.createElement('div');
    wrap.className = 'intro-animal-thumb';
    wrap.innerHTML = `<svg viewBox="0 0 78 78" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="78" height="78" fill="#FFF8E1"/>
      <text x="39" y="52" text-anchor="middle" font-size="44">${a.emoji}</text>
    </svg>`;
    introAnimalRow.appendChild(wrap);
  });
}
renderIntroAnimals();

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

// ── Build zone grid ──────────────────────────────────────────
function buildZones() {
  zonesWrap.innerHTML = '';
  zonesWrap.className = `zones-wrap p${playerCount}`;

  for (let i = 0; i < playerCount; i++) {
    const cfg  = PLAYER_CONFIG[i];
    const zone = document.createElement('div');
    zone.className = `zone ${cfg.cls}`;
    zone.dataset.player = i;

    const header = document.createElement('div');
    header.className = 'zone-header';
    header.innerHTML = `
      <span class="zone-label">${cfg.label}</span>
      <span class="zone-score-chip" id="score-chip-${i}">0점</span>
    `;

    const grid = document.createElement('div');
    grid.className = 'answer-grid';
    grid.id = `answer-grid-${i}`;

    zone.appendChild(header);
    zone.appendChild(grid);
    zonesWrap.appendChild(zone);
  }
}

function getZone(idx) {
  return zonesWrap.querySelector(`.zone[data-player="${idx}"]`);
}

function getAnswerBtns(playerIdx) {
  const grid = document.getElementById(`answer-grid-${playerIdx}`);
  return grid ? Array.from(grid.querySelectorAll('.answer-btn')) : [];
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

// ── Populate answer buttons ─────────────────────────────────
function populateAnswerBtns() {
  for (let i = 0; i < playerCount; i++) {
    const grid = document.getElementById(`answer-grid-${i}`);
    if (!grid) continue;
    grid.innerHTML = '';

    currentChoices.forEach((opt) => {
      const btn = document.createElement('button');
      btn.className = 'answer-btn';
      btn.dataset.player = i;
      btn.dataset.choice = opt.name;
      btn.setAttribute('aria-label', `P${i + 1} ${opt.name}`);
      btn.innerHTML = `
        <span class="btn-emoji">${opt.emoji}</span>
        <span class="btn-text">${opt.name}</span>
      `;
      onTap(btn, () => handleAnswerTap(i, opt.name, btn));
      grid.appendChild(btn);
    });
  }
}

// ── Reset buttons ────────────────────────────────────────────
function resetBtnsForRound() {
  for (let i = 0; i < playerCount; i++) {
    const btns = getAnswerBtns(i);
    const zone = getZone(i);
    btns.forEach(btn => {
      btn.className = 'answer-btn';
      btn.disabled = false;
      if (dqSet.has(i)) {
        btn.classList.add('state-disabled');
        btn.disabled = true;
      }
    });
    if (zone) {
      if (dqSet.has(i)) zone.classList.add('dq-zone');
      else zone.classList.remove('dq-zone');
    }
  }
}

// ── Ripple ───────────────────────────────────────────────────
function spawnRipple(zone) {
  const rect = zone.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const r = document.createElement('span');
  r.className = 'zone-ripple';
  r.style.left = (rect.width / 2) + 'px';
  r.style.top  = (rect.height / 2) + 'px';
  r.style.width = r.style.height = size + 'px';
  r.style.marginLeft = r.style.marginTop = `-${size / 2}px`;
  zone.appendChild(r);
  r.addEventListener('animationend', () => r.remove());
}

// ── Timer ────────────────────────────────────────────────────
function startCountdown() {
  timeRemaining = ROUND_TIME;
  problemTimer.textContent = timeRemaining;
  problemTimer.classList.remove('urgent');

  timerHandle = setInterval(() => {
    timeRemaining--;
    problemTimer.textContent = timeRemaining;

    if (timeRemaining <= 2) {
      problemTimer.classList.add('urgent');
      sound.play('tick');
    }

    if (timeRemaining <= 0) {
      clearTimers();
      handleTimeout();
    }
  }, 1000);
}

// ── Answer tap ───────────────────────────────────────────────
function handleAnswerTap(playerIdx, chosenName, btn) {
  if (phase !== 'active') return;
  if (dqSet.has(playerIdx)) return;

  const zone = getZone(playerIdx);
  spawnRipple(zone);

  const correct = (chosenName === currentAnimal.category);

  if (correct) {
    resolveRound(playerIdx);
  } else {
    sound.play('buzz');
    btn.classList.add('state-wrong');
    setTimeout(() => btn.classList.remove('state-wrong'), 400);

    dqSet.add(playerIdx);
    scores[playerIdx] = Math.max(0, scores[playerIdx] - 1);
    updateScoreChip(playerIdx);
    updateBarScore(playerIdx);

    const penalty = document.createElement('div');
    penalty.className = 'penalty-flash';
    penalty.textContent = '-1';
    zone.style.position = 'relative';
    zone.appendChild(penalty);
    penalty.addEventListener('animationend', () => penalty.remove());

    getAnswerBtns(playerIdx).forEach(b => {
      b.classList.add('state-disabled');
      b.disabled = true;
    });
    zone.classList.add('dq-zone');

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

// ── Round resolved ───────────────────────────────────────────
function resolveRound(winnerIdx) {
  phase = 'done';
  clearTimers();
  sound.play('ding');

  scores[winnerIdx]++;
  updateScoreChip(winnerIdx);
  updateBarScore(winnerIdx);

  getAnswerBtns(winnerIdx).forEach(btn => {
    if (btn.dataset.choice === currentAnimal.category) {
      btn.classList.add('state-correct');
    } else {
      btn.classList.add('state-disabled');
      btn.disabled = true;
    }
  });

  for (let i = 0; i < playerCount; i++) {
    if (i !== winnerIdx) {
      getAnswerBtns(i).forEach(b => { b.classList.add('state-disabled'); b.disabled = true; });
    }
  }

  problemStatus.textContent = `${PLAYER_CONFIG[winnerIdx].label} 정답! (${currentAnimal.category})`;

  roundLog.push({
    animalName: currentAnimal.name,
    category: currentAnimal.category,
    winnerIdx,
    dqPlayers: [...dqSet],
    timedOut: false,
  });

  nextHandle = setTimeout(() => nextRound(), RESULT_PAUSE_MS);
}

// ── Timeout ──────────────────────────────────────────────────
function handleTimeout() {
  phase = 'done';
  clearTimers();
  sound.play('timeout');

  for (let i = 0; i < playerCount; i++) {
    getAnswerBtns(i).forEach(btn => {
      if (btn.dataset.choice === currentAnimal.category) {
        btn.classList.add('state-reveal');
      } else {
        btn.classList.add('state-disabled');
        btn.disabled = true;
      }
    });
    const zone = getZone(i);
    if (zone) zone.classList.remove('dq-zone');
  }

  problemStatus.textContent = `시간 초과! 정답: ${currentAnimal.category}`;

  roundLog.push({
    animalName: currentAnimal.name,
    category: currentAnimal.category,
    winnerIdx: -1,
    dqPlayers: [...dqSet],
    timedOut: true,
  });

  nextHandle = setTimeout(() => nextRound(), RESULT_PAUSE_MS);
}

// ── Load round ───────────────────────────────────────────────
function loadRound() {
  phase          = 'active';
  currentAnimal  = gameRounds[roundIdx];
  currentChoices = makeChoices();
  dqSet          = new Set();

  questionCounter.textContent = `${roundIdx + 1} / ${TOTAL_ROUNDS}`;
  animalDisplay.innerHTML = `
    <span class="animal-icon">${currentAnimal.emoji}</span>
    <span class="animal-name">${currentAnimal.name}</span>
  `;
  problemStatus.textContent = '';
  problemTimer.classList.remove('urgent');

  populateAnswerBtns();
  resetBtnsForRound();
  startCountdown();
}

function nextRound() {
  roundIdx++;
  if (roundIdx >= TOTAL_ROUNDS) {
    showResult();
  } else {
    loadRound();
  }
}

function startGame() {
  // 라운드 동물: 카테고리 다양성을 위해 셔플 후 10마리 (가능하면 카테고리 균형)
  const byCat = {
    '포유류': shuffle(ALL_ANIMALS.filter(a => a.category === '포유류')),
    '조류':   shuffle(ALL_ANIMALS.filter(a => a.category === '조류')),
    '어류':   shuffle(ALL_ANIMALS.filter(a => a.category === '어류')),
    '곤충':   shuffle(ALL_ANIMALS.filter(a => a.category === '곤충')),
  };
  // 각 카테고리 2~3마리씩 골고루 뽑기
  const picks = [];
  ['포유류','조류','어류','곤충'].forEach(cat => {
    picks.push(...byCat[cat].slice(0, 3));
  });
  // 부족하면 채우기, 넘치면 자르기
  const allShuffled = shuffle(picks);
  gameRounds = allShuffled.slice(0, TOTAL_ROUNDS);
  if (gameRounds.length < TOTAL_ROUNDS) {
    const extra = shuffle(ALL_ANIMALS).slice(0, TOTAL_ROUNDS - gameRounds.length);
    gameRounds = gameRounds.concat(extra);
  }

  roundIdx = 0;
  scores   = new Array(playerCount).fill(0);
  roundLog = [];
  dqSet    = new Set();
  phase    = 'idle';

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

  const headRow = document.createElement('tr');
  headRow.innerHTML = '<th>동물</th>' +
    Array.from({ length: playerCount }, (_, i) =>
      `<th><span class="player-dot" style="background:${PLAYER_CONFIG[i].dot}"></span>${PLAYER_CONFIG[i].label}</th>`
    ).join('');
  resultTableHead.innerHTML = '';
  resultTableHead.appendChild(headRow);

  resultTableBody.innerHTML = '';
  roundLog.forEach((log, idx) => {
    const tr = document.createElement('tr');
    let cells = `<td style="text-align:left;font-size:0.82rem;">${idx + 1}. ${log.animalName} <span style="color:#888;">(${log.category})</span></td>`;
    for (let i = 0; i < playerCount; i++) {
      if (log.timedOut) {
        cells += `<td class="cell-timeout">시간초과</td>`;
      } else if (log.winnerIdx === i) {
        cells += `<td class="cell-win">+1</td>`;
      } else if (log.dqPlayers.includes(i)) {
        cells += `<td class="cell-wrong">-1</td>`;
      } else {
        cells += `<td class="cell-none">—</td>`;
      }
    }
    tr.innerHTML = cells;
    resultTableBody.appendChild(tr);
  });

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
      ${isWin ? '<span style="font-size:1.1rem;">★</span>' : ''}
    `;
    totalRow.appendChild(chip);
  }

  showScreen(resultScreen);
}
