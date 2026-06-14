/* games/english-word/game.js */

'use strict';

// ── Constants ────────────────────────────────────────────────
const TOTAL_ROUNDS    = 10;
const ROUND_TIME      = 8;
const RESULT_PAUSE_MS = 2000;

// Player config
const PLAYER_CONFIG = [
  { label: 'P1', dot: '#0288D1', zoneBg: '#B3E5FC', cls: 'p1' },
  { label: 'P2', dot: '#E53935', zoneBg: '#FFCDD2', cls: 'p2' },
  { label: 'P3', dot: '#388E3C', zoneBg: '#C8E6C9', cls: 'p3' },
  { label: 'P4', dot: '#F57C00', zoneBg: '#FFE0B2', cls: 'p4' },
];

// ── Word Data (100개, 9 categories) ──────────────────────────
const ALL_WORDS = [
  // 동물 (15)
  { q: 'dog',      a: '강아지', cat: 'animal' },
  { q: 'cat',      a: '고양이', cat: 'animal' },
  { q: 'lion',     a: '사자',   cat: 'animal' },
  { q: 'tiger',    a: '호랑이', cat: 'animal' },
  { q: 'elephant', a: '코끼리', cat: 'animal' },
  { q: 'monkey',   a: '원숭이', cat: 'animal' },
  { q: 'rabbit',   a: '토끼',   cat: 'animal' },
  { q: 'bear',     a: '곰',     cat: 'animal' },
  { q: 'fox',      a: '여우',   cat: 'animal' },
  { q: 'horse',    a: '말',     cat: 'animal' },
  { q: 'cow',      a: '소',     cat: 'animal' },
  { q: 'pig',      a: '돼지',   cat: 'animal' },
  { q: 'sheep',    a: '양',     cat: 'animal' },
  { q: 'duck',     a: '오리',   cat: 'animal' },
  { q: 'fish',     a: '물고기', cat: 'animal' },

  // 음식 (15)
  { q: 'apple',      a: '사과',   cat: 'food' },
  { q: 'banana',     a: '바나나', cat: 'food' },
  { q: 'grape',      a: '포도',   cat: 'food' },
  { q: 'watermelon', a: '수박',   cat: 'food' },
  { q: 'bread',      a: '빵',     cat: 'food' },
  { q: 'milk',       a: '우유',   cat: 'food' },
  { q: 'egg',        a: '달걀',   cat: 'food' },
  { q: 'rice',       a: '밥',     cat: 'food' },
  { q: 'cake',       a: '케이크', cat: 'food' },
  { q: 'pizza',      a: '피자',   cat: 'food' },
  { q: 'cookie',     a: '쿠키',   cat: 'food' },
  { q: 'juice',      a: '주스',   cat: 'food' },
  { q: 'water',      a: '물',     cat: 'food' },
  { q: 'cheese',     a: '치즈',   cat: 'food' },
  { q: 'chicken',    a: '닭고기', cat: 'food' },

  // 학용품 (12)
  { q: 'book',     a: '책',     cat: 'school' },
  { q: 'pencil',   a: '연필',   cat: 'school' },
  { q: 'eraser',   a: '지우개', cat: 'school' },
  { q: 'ruler',    a: '자',     cat: 'school' },
  { q: 'notebook', a: '공책',   cat: 'school' },
  { q: 'bag',      a: '가방',   cat: 'school' },
  { q: 'desk',     a: '책상',   cat: 'school' },
  { q: 'chair',    a: '의자',   cat: 'school' },
  { q: 'crayon',   a: '크레용', cat: 'school' },
  { q: 'scissors', a: '가위',   cat: 'school' },
  { q: 'glue',     a: '풀',     cat: 'school' },
  { q: 'paper',    a: '종이',   cat: 'school' },

  // 가족/사람 (10)
  { q: 'mother',  a: '엄마',     cat: 'people' },
  { q: 'father',  a: '아빠',     cat: 'people' },
  { q: 'sister',  a: '누나/언니', cat: 'people' },
  { q: 'brother', a: '형/오빠',   cat: 'people' },
  { q: 'friend',  a: '친구',     cat: 'people' },
  { q: 'teacher', a: '선생님',   cat: 'people' },
  { q: 'student', a: '학생',     cat: 'people' },
  { q: 'baby',    a: '아기',     cat: 'people' },
  { q: 'doctor',  a: '의사',     cat: 'people' },
  { q: 'police',  a: '경찰',     cat: 'people' },

  // 색깔 (8)
  { q: 'red',    a: '빨강', cat: 'color' },
  { q: 'blue',   a: '파랑', cat: 'color' },
  { q: 'green',  a: '초록', cat: 'color' },
  { q: 'yellow', a: '노랑', cat: 'color' },
  { q: 'white',  a: '하양', cat: 'color' },
  { q: 'black',  a: '검정', cat: 'color' },
  { q: 'pink',   a: '분홍', cat: 'color' },
  { q: 'purple', a: '보라', cat: 'color' },

  // 숫자 (10)
  { q: 'one',   a: '하나', cat: 'number' },
  { q: 'two',   a: '둘',   cat: 'number' },
  { q: 'three', a: '셋',   cat: 'number' },
  { q: 'four',  a: '넷',   cat: 'number' },
  { q: 'five',  a: '다섯', cat: 'number' },
  { q: 'six',   a: '여섯', cat: 'number' },
  { q: 'seven', a: '일곱', cat: 'number' },
  { q: 'eight', a: '여덟', cat: 'number' },
  { q: 'nine',  a: '아홉', cat: 'number' },
  { q: 'ten',   a: '열',   cat: 'number' },

  // 자연/날씨 (10)
  { q: 'sun',    a: '해',   cat: 'nature' },
  { q: 'moon',   a: '달',   cat: 'nature' },
  { q: 'star',   a: '별',   cat: 'nature' },
  { q: 'rain',   a: '비',   cat: 'nature' },
  { q: 'snow',   a: '눈',   cat: 'nature' },
  { q: 'wind',   a: '바람', cat: 'nature' },
  { q: 'tree',   a: '나무', cat: 'nature' },
  { q: 'flower', a: '꽃',   cat: 'nature' },
  { q: 'cloud',  a: '구름', cat: 'nature' },
  { q: 'sky',    a: '하늘', cat: 'nature' },

  // 신체 (10)
  { q: 'head',  a: '머리',     cat: 'body' },
  { q: 'hand',  a: '손',       cat: 'body' },
  { q: 'foot',  a: '발',       cat: 'body' },
  { q: 'eye',   a: '눈',       cat: 'body' },
  { q: 'nose',  a: '코',       cat: 'body' },
  { q: 'mouth', a: '입',       cat: 'body' },
  { q: 'ear',   a: '귀',       cat: 'body' },
  { q: 'hair',  a: '머리카락', cat: 'body' },
  { q: 'arm',   a: '팔',       cat: 'body' },
  { q: 'leg',   a: '다리',     cat: 'body' },

  // 동작 동사 (10)
  { q: 'run',   a: '달리다',   cat: 'verb' },
  { q: 'jump',  a: '뛰다',     cat: 'verb' },
  { q: 'eat',   a: '먹다',     cat: 'verb' },
  { q: 'sleep', a: '자다',     cat: 'verb' },
  { q: 'read',  a: '읽다',     cat: 'verb' },
  { q: 'write', a: '쓰다',     cat: 'verb' },
  { q: 'sing',  a: '노래하다', cat: 'verb' },
  { q: 'dance', a: '춤추다',   cat: 'verb' },
  { q: 'swim',  a: '수영하다', cat: 'verb' },
  { q: 'walk',  a: '걷다',     cat: 'verb' },
];

// ── Sound Manager ────────────────────────────────────────────
const sound = createSoundManager();

// ── State ────────────────────────────────────────────────────
let playerCount    = 2;
let roundIdx       = 0;
let scores         = [];
let roundLog       = [];
let currentWord    = null;
let currentChoices = [];
let dqSet          = new Set();
let phase          = 'idle';
let timerHandle    = null;
let nextHandle     = null;
let timeRemaining  = ROUND_TIME;
let gameRounds     = [];

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
const wordDisplay   = document.getElementById('wordDisplay');
const problemStatus = document.getElementById('problemStatus');
const scoreBar      = document.getElementById('scoreBar');

const soundToggleIntro = document.getElementById('soundToggleIntro');
const introWordRow  = document.getElementById('introWordRow');

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

// 같은 카테고리 우선으로 오답 보기 3개 + 정답 1개를 섞어 반환
function makeChoices(correctWord) {
  const sameCategory = ALL_WORDS.filter(w => w.cat === correctWord.cat && w.a !== correctWord.a);
  const otherCategory = ALL_WORDS.filter(w => w.cat !== correctWord.cat);

  let pool = shuffle(sameCategory);
  if (pool.length < 3) {
    pool = pool.concat(shuffle(otherCategory));
  }
  const wrong = pool.slice(0, 3).map(w => w.a);
  return shuffle([correctWord.a, ...wrong]);
}

// ── Intro word preview ───────────────────────────────────────
function renderIntroWords() {
  introWordRow.innerHTML = '';
  const sample = shuffle(ALL_WORDS).slice(0, 3);
  sample.forEach(w => {
    const wrap = document.createElement('div');
    wrap.className = 'intro-word-thumb';
    wrap.textContent = w.q;
    introWordRow.appendChild(wrap);
  });
}
renderIntroWords();

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

    currentChoices.forEach((meaning) => {
      const btn = document.createElement('button');
      btn.className = 'answer-btn';
      btn.dataset.player = i;
      btn.dataset.choice = meaning;
      btn.setAttribute('aria-label', `P${i + 1} ${meaning}`);

      btn.innerHTML = `<svg viewBox="0 0 110 44" xmlns="http://www.w3.org/2000/svg">
        <rect x="2" y="2" width="106" height="40" rx="14" ry="14"
              fill="${PLAYER_CONFIG[i].dot}" opacity="0.18" stroke="${PLAYER_CONFIG[i].dot}" stroke-width="2"/>
        <text x="55" y="28" text-anchor="middle" dominant-baseline="middle"
              font-family="'Pretendard Variable',-apple-system,'Noto Sans KR',sans-serif"
              font-size="16" font-weight="800" fill="#222">${meaning}</text>
      </svg>`;

      onTap(btn, () => handleAnswerTap(i, meaning, btn));
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

function setAllBtnsDisabled(disabled) {
  zonesWrap.querySelectorAll('.answer-btn').forEach(btn => {
    btn.disabled = disabled;
    if (disabled) btn.classList.add('state-disabled');
    else btn.classList.remove('state-disabled');
  });
}

// ── Answer tap handler ───────────────────────────────────────
function handleAnswerTap(playerIdx, chosenMeaning, btn) {
  if (phase !== 'active') return;
  if (dqSet.has(playerIdx)) return;

  const zone = getZone(playerIdx);
  spawnRipple(zone, null);

  const correct = (chosenMeaning === currentWord.a);

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
    if (btn.dataset.choice === currentWord.a) {
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
  problemStatus.textContent = `${winnerLabel} 정답!`;

  roundLog.push({
    word: currentWord.q,
    answer: currentWord.a,
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
      if (btn.dataset.choice === currentWord.a) {
        btn.classList.add('state-reveal');
      } else {
        btn.classList.add('state-disabled');
        btn.disabled = true;
      }
    });
    const zone = getZone(i);
    if (zone) zone.classList.remove('dq-zone');
  }

  problemStatus.textContent = `시간 초과! 정답: ${currentWord.a}`;

  roundLog.push({
    word: currentWord.q,
    answer: currentWord.a,
    winnerIdx: -1,
    dqPlayers: [...dqSet],
    timedOut: true,
  });

  nextHandle = setTimeout(() => nextRound(), RESULT_PAUSE_MS);
}

// ── Load round ───────────────────────────────────────────────
function loadRound() {
  phase          = 'active';
  currentWord    = gameRounds[roundIdx];
  currentChoices = makeChoices(currentWord);
  dqSet          = new Set();

  questionCounter.textContent = `${roundIdx + 1} / ${TOTAL_ROUNDS}`;
  wordDisplay.textContent = currentWord.q;
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
  gameRounds  = shuffle(ALL_WORDS).slice(0, TOTAL_ROUNDS);
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
  headRow.innerHTML = '<th>단어</th>' +
    Array.from({ length: playerCount }, (_, i) =>
      `<th><span class="player-dot" style="background:${PLAYER_CONFIG[i].dot}"></span>${PLAYER_CONFIG[i].label}</th>`
    ).join('');
  resultTableHead.innerHTML = '';
  resultTableHead.appendChild(headRow);

  resultTableBody.innerHTML = '';
  roundLog.forEach((log, idx) => {
    const tr = document.createElement('tr');
    let cells = `<td style="text-align:left;font-size:0.82rem;">${idx + 1}. ${log.word} → ${log.answer}</td>`;

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
