/* games/skip-count/game.js */

'use strict';

// ── Constants ────────────────────────────────────────────────
const TOTAL_ROUNDS    = 10;
const ROUND_TIME      = 8;     // seconds per round
const RESULT_PAUSE_MS = getAutoplayPauseMs(2000);

// Player config
const PLAYER_CONFIG = [
  { label: 'P1', dot: '#0288D1', zoneBg: '#B3E5FC', cls: 'p1' },
  { label: 'P2', dot: '#E53935', zoneBg: '#FFCDD2', cls: 'p2' },
  { label: 'P3', dot: '#388E3C', zoneBg: '#C8E6C9', cls: 'p3' },
  { label: 'P4', dot: '#F57C00', zoneBg: '#FFE0B2', cls: 'p4' },
];

// ── Sequence data ────────────────────────────────────────────
// 뛰어 세기: 일정한 간격으로 뛰어 센 수열에서 빈칸에 들어갈 수 고르기.
// 각 항목: { name(정답 문자열), answer(정답 숫자), step(간격), nums(전체 수열), blankIdx(빈칸 위치), seqText }
function buildSequences() {
  const list = [];
  const PLANS = [
    { step: 2,  starts: [2, 4, 6, 8, 10, 12, 14, 16] },
    { step: 3,  starts: [3, 6, 9, 12, 15, 18, 21, 24] },
    { step: 5,  starts: [5, 10, 15, 20, 25, 30, 35, 40] },
    { step: 10, starts: [10, 20, 30, 40, 50, 60, 70, 80] },
  ];
  const LEN = 5;
  PLANS.forEach(plan => {
    plan.starts.forEach((start, k) => {
      const blankIdx = (k % 3) + 1; // 1, 2, 3 순환 (양 끝은 피함)
      const nums = [];
      for (let i = 0; i < LEN; i++) nums.push(start + plan.step * i);
      const answer = nums[blankIdx];
      const seqText = nums.map((n, i) => (i === blankIdx ? '?' : n)).join(' · ');
      list.push({
        name: String(answer),
        answer,
        step: plan.step,
        nums,
        blankIdx,
        seqText,
      });
    });
  });
  return list;
}

const ALL_ITEMS = buildSequences(); // 32개

// ── Sound (chunky retro effects) ─────────────────────────────
const sound = createSoundManager({
  ding(ctx) {
    [880, 1320].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'triangle'; o.frequency.value = f;
      const t = ctx.currentTime + i * 0.07;
      g.gain.setValueAtTime(0.22, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      o.connect(g); g.connect(ctx.destination);
      o.start(t); o.stop(t + 0.28);
    });
  },
  buzz(ctx) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(200, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.25);
    g.gain.setValueAtTime(0.22, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + 0.3);
  },
  tick(ctx) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'square'; o.frequency.value = 1200;
    g.gain.setValueAtTime(0.12, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + 0.06);
  },
  timeout(ctx) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(440, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(160, ctx.currentTime + 0.4);
    g.gain.setValueAtTime(0.2, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.42);
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + 0.45);
  },
  fanfare(ctx) {
    [523, 659, 784, 1047].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'triangle'; o.frequency.value = f;
      const t = ctx.currentTime + i * 0.1;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.26, t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      o.connect(g); g.connect(ctx.destination);
      o.start(t); o.stop(t + 0.55);
    });
  },
});

// ── State ────────────────────────────────────────────────────
let playerCount   = 2;
let roundIdx      = 0;
let scores        = [];
let roundLog      = [];    // { flagName, winnerIdx(-1=timeout), dqPlayers[], timedOut }
let currentFlag   = null;  // 현재 수열 항목
let currentChoices = [];   // 4 보기 (정답 포함, 문자열)
let dqSet         = new Set();
let phase         = 'idle';
let timerHandle   = null;
let nextHandle    = null;
let timeRemaining = ROUND_TIME;
let gameRounds    = [];    // 10 selected items

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

// 보기 4개 생성: 정답 + 정답 근처의 서로 다른 오답 3개 (정답 중복 없음)
function makeChoices(item) {
  const ans  = item.answer;
  const step = item.step;
  const deltas = shuffle([-1, 1, -2, 2, step, -step, step + 1, -(step + 1)]);
  const wrong = [];
  for (const d of deltas) {
    const v = ans + d;
    if (v > 0 && v !== ans && !wrong.includes(v) && wrong.length < 3) wrong.push(v);
  }
  let extra = 11;
  while (wrong.length < 3) {
    const v = ans + extra;
    if (v > 0 && v !== ans && !wrong.includes(v)) wrong.push(v);
    extra++;
  }
  return shuffle([ans, ...wrong].map(String));
}

// 수열 표시 HTML (게임 화면 상단)
function seqDisplayHTML(item) {
  return '<div class="seq-row">' + item.nums.map((n, i) =>
    i === item.blankIdx
      ? '<span class="seq-cell blank">?</span>'
      : '<span class="seq-cell">' + n + '</span>'
  ).join('') + '</div>';
}

// ── Intro illustration ───────────────────────────────────────
function renderIntroFlags() {
  introFlagRow.innerHTML = `
    <div class="intro-illust">
      <svg viewBox="0 0 240 120" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 95 Q55 30 90 95 Q125 30 160 95 Q195 30 230 95"
              fill="none" stroke="#2C2C2C" stroke-width="3" stroke-dasharray="6 7" stroke-linecap="round"/>
        <g font-family="'Pretendard Variable',sans-serif" font-weight="900" font-size="20" text-anchor="middle">
          <circle cx="20"  cy="95" r="16" fill="#B3E5FC" stroke="#2C2C2C" stroke-width="3"/>
          <text x="20"  y="102" fill="#2C2C2C">2</text>
          <circle cx="90"  cy="95" r="16" fill="#FFE0B2" stroke="#2C2C2C" stroke-width="3"/>
          <text x="90"  y="102" fill="#2C2C2C">4</text>
          <circle cx="160" cy="95" r="16" fill="#FFD54F" stroke="#2C2C2C" stroke-width="3"/>
          <text x="160" y="102" fill="#2C2C2C">?</text>
          <circle cx="230" cy="95" r="16" fill="#C8E6C9" stroke="#2C2C2C" stroke-width="3"/>
          <text x="230" y="102" fill="#2C2C2C">8</text>
        </g>
      </svg>
    </div>`;
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

    currentChoices.forEach((name) => {
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
              font-size="20" font-weight="900" fill="#222">${name}</text>
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

  const correct = (chosenName === currentFlag.name);

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
    if (btn.dataset.choice === currentFlag.name) {
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
    flagName: currentFlag.seqText + ' = ' + currentFlag.name,
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
      if (btn.dataset.choice === currentFlag.name) {
        btn.classList.add('state-reveal');
      } else {
        btn.classList.add('state-disabled');
        btn.disabled = true;
      }
    });
    const zone = getZone(i);
    if (zone) zone.classList.remove('dq-zone');
  }

  problemStatus.textContent = `시간 초과! 정답: ${currentFlag.name}`;

  roundLog.push({
    flagName: currentFlag.seqText + ' = ' + currentFlag.name,
    winnerIdx: -1,
    dqPlayers: [...dqSet],
    timedOut: true,
  });

  nextHandle = setTimeout(() => nextRound(), RESULT_PAUSE_MS);
}

// ── Load round ───────────────────────────────────────────────
function loadRound() {
  phase        = 'active';
  currentFlag  = gameRounds[roundIdx];
  currentChoices = makeChoices(currentFlag);
  dqSet        = new Set();

  questionCounter.textContent = `${roundIdx + 1} / ${TOTAL_ROUNDS}`;
  flagDisplay.innerHTML = seqDisplayHTML(currentFlag);
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
  gameRounds  = shuffle(ALL_ITEMS).slice(0, TOTAL_ROUNDS);
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
  headRow.innerHTML = '<th>수열</th>' +
    Array.from({ length: playerCount }, (_, i) =>
      `<th><span class="player-dot" style="background:${PLAYER_CONFIG[i].dot}"></span>${PLAYER_CONFIG[i].label}</th>`
    ).join('');
  resultTableHead.innerHTML = '';
  resultTableHead.appendChild(headRow);

  resultTableBody.innerHTML = '';
  roundLog.forEach((log, idx) => {
    const tr = document.createElement('tr');
    let cells = `<td style="text-align:left;font-size:0.82rem;">${idx + 1}. ${log.flagName}</td>`;

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
