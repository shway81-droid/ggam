/* games/area-compare/game.js — 넓이 비교 (math, 패턴 A) */

'use strict';

// ── Constants ────────────────────────────────────────────────
const TOTAL_ROUNDS    = 10;
const ROUND_TIME      = 10;
const RESULT_PAUSE_MS = 2000;

const PLAYER_CONFIG = [
  { label: 'P1', dot: '#0288D1', zoneBg: '#B3E5FC', cls: 'p1' },
  { label: 'P2', dot: '#E53935', zoneBg: '#FFCDD2', cls: 'p2' },
  { label: 'P3', dot: '#388E3C', zoneBg: '#C8E6C9', cls: 'p3' },
  { label: 'P4', dot: '#F57C00', zoneBg: '#FFE0B2', cls: 'p4' },
];

const LABEL_LETTERS = ['A', 'B', 'C', 'D'];
const SHAPE_FILLS   = ['#B3E5FC', '#FFCDD2', '#C8E6C9', '#FFE0B2'];

// ── Shape Library ────────────────────────────────────────────
// 각 도형은 (r,c) 셀 좌표 배열로 표현. 모든 도형은 4x4 격자 안에 들어감.
// 셀 수 (cells.length) = 넓이.
const SHAPES = [
  // 3 cells
  { id: 'I3a',  cells: [[1,0],[1,1],[1,2]] },
  { id: 'L3',   cells: [[0,0],[1,0],[1,1]] },
  { id: 'V3',   cells: [[0,0],[1,0],[2,0]] },
  // 4 cells
  { id: 'I4',   cells: [[1,0],[1,1],[1,2],[1,3]] },
  { id: 'sq4',  cells: [[0,0],[0,1],[1,0],[1,1]] },
  { id: 'L4',   cells: [[0,0],[1,0],[2,0],[2,1]] },
  { id: 'T4',   cells: [[0,0],[0,1],[0,2],[1,1]] },
  { id: 'S4',   cells: [[0,1],[0,2],[1,0],[1,1]] },
  // 5 cells
  { id: 'I5',   cells: [[0,0],[0,1],[0,2],[0,3],[0,4]] },
  { id: 'L5',   cells: [[0,0],[1,0],[2,0],[3,0],[3,1]] },
  { id: 'T5',   cells: [[0,0],[0,1],[0,2],[1,1],[2,1]] },
  { id: 'P5',   cells: [[0,0],[0,1],[1,0],[1,1],[2,0]] },
  { id: 'plus', cells: [[0,1],[1,0],[1,1],[1,2],[2,1]] },
  // 6 cells
  { id: 'rec23',cells: [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2]] },
  { id: 'L6',   cells: [[0,0],[1,0],[2,0],[3,0],[3,1],[3,2]] },
  { id: 'U6',   cells: [[0,0],[0,2],[1,0],[1,1],[1,2],[2,0]] },
  // 7 cells
  { id: 'L7',   cells: [[0,0],[1,0],[2,0],[3,0],[3,1],[3,2],[3,3]] },
  { id: 'T7',   cells: [[0,0],[0,1],[0,2],[0,3],[1,1],[1,2],[2,1]] },
  // 8 cells
  { id: 'rec24',cells: [[0,0],[0,1],[0,2],[0,3],[1,0],[1,1],[1,2],[1,3]] },
  { id: 'H8',   cells: [[0,0],[0,2],[1,0],[1,1],[1,2],[2,0],[2,2],[3,0]] },
  // 9 cells
  { id: 'sq3',  cells: [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2],[2,0],[2,1],[2,2]] },
  { id: 'plus9',cells: [[0,1],[1,0],[1,1],[1,2],[2,0],[2,1],[2,2],[3,1],[0,1]] },
  // 10 cells
  { id: 'rec25',cells: [[0,0],[0,1],[0,2],[0,3],[0,4],[1,0],[1,1],[1,2],[1,3],[1,4]] },
  { id: 'L10',  cells: [[0,0],[1,0],[2,0],[3,0],[3,1],[3,2],[3,3],[3,4],[2,4],[2,3]] },
  // 11 cells
  { id: 'T11',  cells: [[0,0],[0,1],[0,2],[0,3],[0,4],[1,2],[2,2],[3,2],[1,1],[1,3],[2,1]] },
  // 12 cells
  { id: 'rec34',cells: [[0,0],[0,1],[0,2],[0,3],[1,0],[1,1],[1,2],[1,3],[2,0],[2,1],[2,2],[2,3]] },
  // 13 cells
  { id: 'plusBig',cells:[[0,2],[1,0],[1,1],[1,2],[1,3],[1,4],[2,0],[2,1],[2,2],[2,3],[2,4],[3,2],[0,2]]},
  // 14 cells
  { id: 'rec27',cells: [[0,0],[0,1],[0,2],[0,3],[0,4],[0,5],[0,6],[1,0],[1,1],[1,2],[1,3],[1,4],[1,5],[1,6]] },
  // 15 cells
  { id: 'rec35',cells: [[0,0],[0,1],[0,2],[0,3],[0,4],[1,0],[1,1],[1,2],[1,3],[1,4],[2,0],[2,1],[2,2],[2,3],[2,4]] },
  // 16 cells
  { id: 'sq4big',cells:[[0,0],[0,1],[0,2],[0,3],[1,0],[1,1],[1,2],[1,3],[2,0],[2,1],[2,2],[2,3],[3,0],[3,1],[3,2],[3,3]] }
];

// 셀 수가 unique한 것만 사용하기 위해 중복 제거 후 cells.length 사용
function shapeArea(s){
  const set = new Set(s.cells.map(c=>c[0]+','+c[1]));
  return set.size;
}

// ── Sound Manager ────────────────────────────────────────────
const sound = createSoundManager();

// ── State ────────────────────────────────────────────────────
let playerCount   = 2;
let roundIdx      = 0;
let scores        = [];
let roundLog      = [];
let currentRound  = null;  // { shapes:[4], direction:'max'|'min', correctIdx, correctLabel }
let currentChoices = [];   // ['A','B','C','D']
let dqSet         = new Set();
let phase         = 'idle';
let timerHandle   = null;
let nextHandle    = null;
let timeRemaining = ROUND_TIME;

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

// ── Shape rendering ──────────────────────────────────────────
function shapeBoundingBox(shape){
  let maxR = 0, maxC = 0;
  shape.cells.forEach(([r,c])=>{
    if(r>maxR)maxR=r; if(c>maxC)maxC=c;
  });
  return { rows: maxR+1, cols: maxC+1 };
}

// 도형을 (gridW × gridH) 모눈 격자 안에 그린다.
// 채워진 칸은 색칠 + 검정 테두리, 빈 칸은 점선 회색 외곽 (학생이 칸 수를 직접 세도록 유도).
function shapeSVG(shape, fillColor, gridW, gridH, cellPx){
  cellPx = cellPx || 14;
  const w = gridW * cellPx;
  const h = gridH * cellPx;
  const cellSet = new Set(shape.cells.map(c=>c[0]+','+c[1]));
  const rects = [];
  for(let r=0; r<gridH; r++){
    for(let c=0; c<gridW; c++){
      const x = c * cellPx;
      const y = r * cellPx;
      const key = r+','+c;
      if(cellSet.has(key)){
        rects.push(`<rect x="${x}" y="${y}" width="${cellPx}" height="${cellPx}" fill="${fillColor}" stroke="#2C2C2C" stroke-width="2"/>`);
      } else {
        rects.push(`<rect x="${x+1}" y="${y+1}" width="${cellPx-2}" height="${cellPx-2}" fill="none" stroke="#BDBDBD" stroke-width="1" stroke-dasharray="2,2"/>`);
      }
    }
  }
  return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">${rects.join('')}</svg>`;
}

// ── Round generation ─────────────────────────────────────────
function pickRound(){
  const byArea = new Map();
  SHAPES.forEach(s=>{
    const a = shapeArea(s);
    if(!byArea.has(a)) byArea.set(a, []);
    byArea.get(a).push(s);
  });
  const allAreas = [...byArea.keys()].sort((a,b)=>a-b);

  // 4개 도형의 칸 수 차이를 ±2(범위 4) 이내로 좁혀 의미 있는 비교가 되게 함
  let chosenAreas = null;
  for(let attempt=0; attempt<50; attempt++){
    const base = allAreas[Math.floor(Math.random()*allAreas.length)];
    const window = allAreas.filter(a => Math.abs(a-base) <= 2);
    if(window.length >= 4){
      chosenAreas = shuffle(window).slice(0, 4);
      break;
    }
  }
  if(!chosenAreas){
    chosenAreas = shuffle(allAreas).slice(0, 4);
  }

  const shapes = chosenAreas.map(a => {
    const list = byArea.get(a);
    return list[Math.floor(Math.random()*list.length)];
  });
  const shuffled = shuffle(shapes);
  const direction = Math.random() < 0.5 ? 'max' : 'min';
  let bestIdx = 0;
  shuffled.forEach((s, i)=>{
    const a = shapeArea(s);
    const ba = shapeArea(shuffled[bestIdx]);
    if(direction==='max' ? a>ba : a<ba) bestIdx = i;
  });

  // 4개 도형 공통 모눈 크기: 모든 bbox의 최대값 사용 → 셀 픽셀 크기가 4개 도형 모두 동일하게 보임
  const gridW = Math.max(...shuffled.map(s => shapeBoundingBox(s).cols));
  const gridH = Math.max(...shuffled.map(s => shapeBoundingBox(s).rows));

  return {
    shapes: shuffled,
    direction,
    correctIdx: bestIdx,
    correctLabel: LABEL_LETTERS[bestIdx],
    gridW, gridH
  };
}

// ── Intro thumbnails ─────────────────────────────────────────
function renderIntroFlags() {
  introFlagRow.innerHTML = '';
  const small = SHAPES.filter(s => shapeArea(s)<=6);
  const sample = shuffle(small).slice(0,3);
  sample.forEach((s,i) => {
    const wrap = document.createElement('div');
    wrap.className = 'intro-flag-thumb';
    wrap.style.background = '#FFF8E1';
    wrap.style.border = '3px solid #2C2C2C';
    wrap.style.borderRadius = '10px';
    wrap.style.padding = '6px';
    wrap.style.display = 'flex';
    wrap.style.alignItems = 'center';
    wrap.style.justifyContent = 'center';
    const bb = shapeBoundingBox(s);
    wrap.innerHTML = shapeSVG(s, SHAPE_FILLS[i % SHAPE_FILLS.length], bb.cols, bb.rows, 10);
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

// ── Populate answer buttons ─────────────────────────────────
function populateAnswerBtns() {
  for (let i = 0; i < playerCount; i++) {
    const grid = document.getElementById(`answer-grid-${i}`);
    if (!grid) continue;
    grid.innerHTML = '';

    currentChoices.forEach((letter, ci) => {
      const btn = document.createElement('button');
      btn.className = 'answer-btn';
      btn.dataset.player = i;
      btn.dataset.choice = letter;
      btn.setAttribute('aria-label', `P${i + 1} ${letter}`);

      btn.innerHTML = `<svg viewBox="0 0 110 44" xmlns="http://www.w3.org/2000/svg">
        <rect x="2" y="2" width="106" height="40" rx="14" ry="14"
              fill="${PLAYER_CONFIG[i].dot}" opacity="0.18" stroke="${PLAYER_CONFIG[i].dot}" stroke-width="2"/>
        <text x="55" y="28" text-anchor="middle" dominant-baseline="middle"
              font-family="'Pretendard Variable',-apple-system,'Noto Sans KR',sans-serif"
              font-size="20" font-weight="900" fill="#222">${letter}</text>
      </svg>`;

      onTap(btn, () => handleAnswerTap(i, letter, btn));
      grid.appendChild(btn);
    });
  }
}

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

// ── Answer tap handler ───────────────────────────────────────
function handleAnswerTap(playerIdx, chosenLetter, btn) {
  if (phase !== 'active') return;
  if (dqSet.has(playerIdx)) return;

  const zone = getZone(playerIdx);
  spawnRipple(zone, null);

  const correct = (chosenLetter === currentRound.correctLabel);

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

function resolveRound(winnerIdx) {
  phase = 'done';
  clearTimers();
  sound.play('ding');

  scores[winnerIdx]++;
  updateScoreChip(winnerIdx);
  updateBarScore(winnerIdx);

  getAnswerBtns(winnerIdx).forEach(btn => {
    if (btn.dataset.choice === currentRound.correctLabel) {
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

  // Highlight correct shape in display
  flagDisplay.querySelectorAll('.shape-cell').forEach((cell, i) => {
    if (i === currentRound.correctIdx) {
      cell.style.background = '#C8E6C9';
      cell.style.boxShadow = 'inset 0 0 0 3px #2E7D32';
    }
  });

  const winnerLabel = PLAYER_CONFIG[winnerIdx].label;
  problemStatus.textContent = `${winnerLabel} 정답! (${currentRound.correctLabel})`;

  roundLog.push({
    questionTxt: directionText(currentRound.direction),
    correct: currentRound.correctLabel,
    winnerIdx,
    dqPlayers: [...dqSet],
    timedOut: false,
  });

  nextHandle = setTimeout(() => nextRound(), RESULT_PAUSE_MS);
}

function handleTimeout() {
  phase = 'done';
  clearTimers();
  sound.play('timeout');

  for (let i = 0; i < playerCount; i++) {
    getAnswerBtns(i).forEach(btn => {
      if (btn.dataset.choice === currentRound.correctLabel) {
        btn.classList.add('state-reveal');
      } else {
        btn.classList.add('state-disabled');
        btn.disabled = true;
      }
    });
    const zone = getZone(i);
    if (zone) zone.classList.remove('dq-zone');
  }

  flagDisplay.querySelectorAll('.shape-cell').forEach((cell, i) => {
    if (i === currentRound.correctIdx) {
      cell.style.background = '#FFF59D';
      cell.style.boxShadow = 'inset 0 0 0 3px #F9A825';
    }
  });

  problemStatus.textContent = `시간 초과! 정답: ${currentRound.correctLabel}`;

  roundLog.push({
    questionTxt: directionText(currentRound.direction),
    correct: currentRound.correctLabel,
    winnerIdx: -1,
    dqPlayers: [...dqSet],
    timedOut: true,
  });

  nextHandle = setTimeout(() => nextRound(), RESULT_PAUSE_MS);
}

function directionText(d){
  return d === 'max' ? '🟢 네모가 가장 많은 도형은?' : '🔵 네모가 가장 적은 도형은?';
}

function renderShapeDisplay(){
  flagDisplay.innerHTML = '';
  const {gridW, gridH} = currentRound;
  currentRound.shapes.forEach((s, i) => {
    const cell = document.createElement('div');
    cell.className = 'shape-cell';
    cell.innerHTML = `<div class="shape-label">${LABEL_LETTERS[i]}</div>` + shapeSVG(s, SHAPE_FILLS[i], gridW, gridH, 14);
    flagDisplay.appendChild(cell);
  });
}

function loadRound() {
  phase = 'active';
  currentRound = pickRound();
  currentChoices = LABEL_LETTERS.slice();
  dqSet = new Set();

  questionCounter.textContent = `${roundIdx + 1} / ${TOTAL_ROUNDS}`;
  renderShapeDisplay();
  problemStatus.textContent = directionText(currentRound.direction);
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
  headRow.innerHTML = '<th>문제</th>' +
    Array.from({ length: playerCount }, (_, i) =>
      `<th><span class="player-dot" style="background:${PLAYER_CONFIG[i].dot}"></span>${PLAYER_CONFIG[i].label}</th>`
    ).join('');
  resultTableHead.innerHTML = '';
  resultTableHead.appendChild(headRow);

  resultTableBody.innerHTML = '';
  roundLog.forEach((log, idx) => {
    const tr = document.createElement('tr');
    let cells = `<td style="text-align:left;font-size:0.78rem;">${idx + 1}. ${log.questionTxt} (${log.correct})</td>`;

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
