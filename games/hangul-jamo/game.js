/* games/hangul-jamo/game.js */

'use strict';

// ── Constants ────────────────────────────────────────────────
const TOTAL_ROUNDS    = 10;
const ROUND_TIME      = 8;     // seconds per round
const RESULT_PAUSE_MS = 2000;

// Player config
const PLAYER_CONFIG = [
  { label: 'P1', dot: '#0288D1', zoneBg: '#B3E5FC', cls: 'p1' },
  { label: 'P2', dot: '#E53935', zoneBg: '#FFCDD2', cls: 'p2' },
  { label: 'P3', dot: '#388E3C', zoneBg: '#C8E6C9', cls: 'p3' },
  { label: 'P4', dot: '#F57C00', zoneBg: '#FFE0B2', cls: 'p4' },
];

// ── Hangul Jamo display ──────────────────────────────────────
// Each jamo renders as a large character inside a square SVG.
function jamoSvg(ch, color) {
  // 색상은 자음(보라)/모음(주황)/쌍자음(빨강)로 자모군 구분
  return '<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">' +
    '<rect width="120" height="120" fill="#FFF8E1"/>' +
    '<text x="60" y="60" text-anchor="middle" dominant-baseline="central" ' +
    'font-family="\'Pretendard Variable\',-apple-system,\'Noto Sans KR\',sans-serif" ' +
    'font-size="90" font-weight="900" fill="' + color + '">' + ch + '</text>' +
  '</svg>';
}

var COLOR_CONSONANT  = '#5E35B1'; // 보라 — 기본 자음
var COLOR_DOUBLE     = '#C62828'; // 빨강 — 쌍자음
var COLOR_VOWEL      = '#EF6C00'; // 주황 — 모음
var COLOR_COMP_VOWEL = '#2E7D32'; // 초록 — 복합모음

// ── Jamo Data ───────────────────────────────────────────────
// 40개 자모 (자음 14 + 쌍자음 5 + 단모음 10 + 복합모음 11)
const ALL_JAMO = [
  // 단자음 (14)
  { name: '기역', ch: 'ㄱ', color: COLOR_CONSONANT, group: 'consonant' },
  { name: '니은', ch: 'ㄴ', color: COLOR_CONSONANT, group: 'consonant' },
  { name: '디귿', ch: 'ㄷ', color: COLOR_CONSONANT, group: 'consonant' },
  { name: '리을', ch: 'ㄹ', color: COLOR_CONSONANT, group: 'consonant' },
  { name: '미음', ch: 'ㅁ', color: COLOR_CONSONANT, group: 'consonant' },
  { name: '비읍', ch: 'ㅂ', color: COLOR_CONSONANT, group: 'consonant' },
  { name: '시옷', ch: 'ㅅ', color: COLOR_CONSONANT, group: 'consonant' },
  { name: '이응', ch: 'ㅇ', color: COLOR_CONSONANT, group: 'consonant' },
  { name: '지읒', ch: 'ㅈ', color: COLOR_CONSONANT, group: 'consonant' },
  { name: '치읓', ch: 'ㅊ', color: COLOR_CONSONANT, group: 'consonant' },
  { name: '키읔', ch: 'ㅋ', color: COLOR_CONSONANT, group: 'consonant' },
  { name: '티읕', ch: 'ㅌ', color: COLOR_CONSONANT, group: 'consonant' },
  { name: '피읖', ch: 'ㅍ', color: COLOR_CONSONANT, group: 'consonant' },
  { name: '히읗', ch: 'ㅎ', color: COLOR_CONSONANT, group: 'consonant' },
  // 쌍자음 (5)
  { name: '쌍기역', ch: 'ㄲ', color: COLOR_DOUBLE, group: 'double' },
  { name: '쌍디귿', ch: 'ㄸ', color: COLOR_DOUBLE, group: 'double' },
  { name: '쌍비읍', ch: 'ㅃ', color: COLOR_DOUBLE, group: 'double' },
  { name: '쌍시옷', ch: 'ㅆ', color: COLOR_DOUBLE, group: 'double' },
  { name: '쌍지읒', ch: 'ㅉ', color: COLOR_DOUBLE, group: 'double' },
  // 단모음 (10)
  { name: '아', ch: 'ㅏ', color: COLOR_VOWEL, group: 'vowel' },
  { name: '야', ch: 'ㅑ', color: COLOR_VOWEL, group: 'vowel' },
  { name: '어', ch: 'ㅓ', color: COLOR_VOWEL, group: 'vowel' },
  { name: '여', ch: 'ㅕ', color: COLOR_VOWEL, group: 'vowel' },
  { name: '오', ch: 'ㅗ', color: COLOR_VOWEL, group: 'vowel' },
  { name: '요', ch: 'ㅛ', color: COLOR_VOWEL, group: 'vowel' },
  { name: '우', ch: 'ㅜ', color: COLOR_VOWEL, group: 'vowel' },
  { name: '유', ch: 'ㅠ', color: COLOR_VOWEL, group: 'vowel' },
  { name: '으', ch: 'ㅡ', color: COLOR_VOWEL, group: 'vowel' },
  { name: '이', ch: 'ㅣ', color: COLOR_VOWEL, group: 'vowel' },
  // 복합모음 (11)
  { name: '애', ch: 'ㅐ', color: COLOR_COMP_VOWEL, group: 'comp-vowel' },
  { name: '얘', ch: 'ㅒ', color: COLOR_COMP_VOWEL, group: 'comp-vowel' },
  { name: '에', ch: 'ㅔ', color: COLOR_COMP_VOWEL, group: 'comp-vowel' },
  { name: '예', ch: 'ㅖ', color: COLOR_COMP_VOWEL, group: 'comp-vowel' },
  { name: '와', ch: 'ㅘ', color: COLOR_COMP_VOWEL, group: 'comp-vowel' },
  { name: '왜', ch: 'ㅙ', color: COLOR_COMP_VOWEL, group: 'comp-vowel' },
  { name: '외', ch: 'ㅚ', color: COLOR_COMP_VOWEL, group: 'comp-vowel' },
  { name: '워', ch: 'ㅝ', color: COLOR_COMP_VOWEL, group: 'comp-vowel' },
  { name: '웨', ch: 'ㅞ', color: COLOR_COMP_VOWEL, group: 'comp-vowel' },
  { name: '위', ch: 'ㅟ', color: COLOR_COMP_VOWEL, group: 'comp-vowel' },
  { name: '의', ch: 'ㅢ', color: COLOR_COMP_VOWEL, group: 'comp-vowel' },
];

// ── Sound Manager ────────────────────────────────────────────
const sound = createSoundManager();

// ── State ────────────────────────────────────────────────────
let playerCount   = 2;
let roundIdx      = 0;
let scores        = [];
let roundLog      = [];    // { jamoName, winnerIdx(-1=timeout), dqPlayers[], timedOut }
let currentJamo   = null;  // { name, ch, color, group }
let currentChoices = [];   // 4 names for this round (includes correct)
let dqSet         = new Set();
let phase         = 'idle';
let timerHandle   = null;
let nextHandle    = null;
let timeRemaining = ROUND_TIME;
let gameRounds    = [];    // 10 selected jamo

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
const flagDisplay   = document.getElementById('flagDisplay');
const problemStatus = document.getElementById('problemStatus');
const scoreBar      = document.getElementById('scoreBar');

const soundToggleIntro = document.getElementById('soundToggleIntro');
const introFlagRow  = document.getElementById('introFlagRow');

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

function clearTimers() {
  if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
  if (timerHandle) { clearInterval(timerHandle); timerHandle = null; }
  if (nextHandle)  { clearTimeout(nextHandle);   nextHandle  = null; }
}

function updateSoundBtn(btn) {
  btn.textContent = sound.isMuted() ? '🔇' : '🔊';
}

// Pick 4 answer choices: correct + 3 random wrong ones (이름 중복 방지)
function makeChoices(correctName) {
  const others = shuffle(ALL_JAMO.filter(j => j.name !== correctName));
  const wrong = others.slice(0, 3).map(j => j.name);
  return shuffle([correctName, ...wrong]);
}

// ── Intro jamo preview ───────────────────────────────────────
function renderIntroFlags() {
  introFlagRow.innerHTML = '';
  const sample = shuffle(ALL_JAMO).slice(0, 3);
  sample.forEach(j => {
    const wrap = document.createElement('div');
    wrap.className = 'intro-flag-thumb';
    wrap.innerHTML = jamoSvg(j.ch, j.color);
    introFlagRow.appendChild(wrap);
  });
}
renderIntroFlags();

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

// ── Populate answer buttons for a round ─────────────────────
function populateAnswerBtns() {
  for (let i = 0; i < playerCount; i++) {
    const grid = document.getElementById(`answer-grid-${i}`);
    if (!grid) continue;
    grid.innerHTML = '';

    currentChoices.forEach((name, ci) => {
      const btn = document.createElement('button');
      btn.className = 'answer-btn';
      btn.dataset.player = i;
      btn.dataset.choice = name;
      btn.setAttribute('aria-label', `P${i + 1} ${name}`);

      btn.innerHTML = `<svg viewBox="0 0 110 44" xmlns="http://www.w3.org/2000/svg">
        <rect x="2" y="2" width="106" height="40" rx="14" ry="14"
              fill="${PLAYER_CONFIG[i].dot}" opacity="0.18" stroke="${PLAYER_CONFIG[i].dot}" stroke-width="2"/>
        <text x="55" y="28" text-anchor="middle" dominant-baseline="middle"
              font-family="'Pretendard Variable',-apple-system,'Noto Sans KR',sans-serif"
              font-size="16" font-weight="800" fill="#222">${name}</text>
      </svg>`;

      onTap(btn, () => handleAnswerTap(i, name, btn));
      grid.appendChild(btn);
    });
  }
}

// ── Reset buttons for new round ──────────────────────────────
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

// ── Ripple effect ────────────────────────────────────────────
function spawnRipple(zone, e) {
  const rect  = zone.getBoundingClientRect();
  const touch = e && e.touches ? e.touches[0] : (e || null);
  const x     = touch ? touch.clientX - rect.left : rect.width  / 2;
  const y     = touch ? touch.clientY - rect.top  : rect.height / 2;
  const size  = Math.max(rect.width, rect.height);
  const r     = document.createElement('span');
  r.className = 'zone-ripple';
  r.style.left   = x + 'px';
  r.style.top    = y + 'px';
  r.style.width  = r.style.height = size + 'px';
  r.style.marginLeft = r.style.marginTop = `-${size / 2}px`;
  zone.appendChild(r);
  r.addEventListener('animationend', () => r.remove());
}

// ── Timer logic ──────────────────────────────────────────────
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

// ── Disable / enable all answer buttons ─────────────────────
function setAllBtnsDisabled(disabled) {
  zonesWrap.querySelectorAll('.answer-btn').forEach(btn => {
    btn.disabled = disabled;
    if (disabled) btn.classList.add('state-disabled');
    else btn.classList.remove('state-disabled');
  });
}

// ── Answer tap handler ───────────────────────────────────────
function handleAnswerTap(playerIdx, chosenName, btn) {
  if (phase !== 'active') return;
  if (dqSet.has(playerIdx)) return;

  const zone = getZone(playerIdx);
  spawnRipple(zone, null);

  const correct = (chosenName === currentJamo.name);

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

// ── Correct answer resolved ──────────────────────────────────
function resolveRound(winnerIdx) {
  phase = 'done';
  clearTimers();
  sound.play('ding');

  scores[winnerIdx]++;
  updateScoreChip(winnerIdx);
  updateBarScore(winnerIdx);

  getAnswerBtns(winnerIdx).forEach(btn => {
    if (btn.dataset.choice === currentJamo.name) {
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

  const winnerLabel = PLAYER_CONFIG[winnerIdx].label;
  problemStatus.textContent = `${winnerLabel} 정답! (${currentJamo.ch} → ${currentJamo.name})`;

  roundLog.push({
    jamoName: currentJamo.name,
    jamoCh:   currentJamo.ch,
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
      if (btn.dataset.choice === currentJamo.name) {
        btn.classList.add('state-reveal');
      } else {
        btn.classList.add('state-disabled');
        btn.disabled = true;
      }
    });
    const zone = getZone(i);
    if (zone) zone.classList.remove('dq-zone');
  }

  problemStatus.textContent = `시간 초과! ${currentJamo.ch} → ${currentJamo.name}`;

  roundLog.push({
    jamoName: currentJamo.name,
    jamoCh:   currentJamo.ch,
    winnerIdx: -1,
    dqPlayers: [...dqSet],
    timedOut: true,
  });

  nextHandle = setTimeout(() => nextRound(), RESULT_PAUSE_MS);
}

// ── Load round ───────────────────────────────────────────────
function loadRound() {
  phase        = 'active';
  currentJamo  = gameRounds[roundIdx];
  currentChoices = makeChoices(currentJamo.name);
  dqSet        = new Set();

  questionCounter.textContent = `${roundIdx + 1} / ${TOTAL_ROUNDS}`;
  flagDisplay.innerHTML = jamoSvg(currentJamo.ch, currentJamo.color);
  problemStatus.textContent = '';
  problemTimer.classList.remove('urgent');

  populateAnswerBtns();
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
  gameRounds  = shuffle(ALL_JAMO).slice(0, TOTAL_ROUNDS);
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

  const headRow = document.createElement('tr');
  headRow.innerHTML = '<th>자모</th>' +
    Array.from({ length: playerCount }, (_, i) =>
      `<th><span class="player-dot" style="background:${PLAYER_CONFIG[i].dot}"></span>${PLAYER_CONFIG[i].label}</th>`
    ).join('');
  resultTableHead.innerHTML = '';
  resultTableHead.appendChild(headRow);

  resultTableBody.innerHTML = '';
  roundLog.forEach((log, idx) => {
    const tr = document.createElement('tr');
    let cells = `<td style="text-align:left;font-size:0.82rem;">${idx + 1}. ${log.jamoCh} (${log.jamoName})</td>`;

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
