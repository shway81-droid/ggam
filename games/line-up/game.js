/* games/line-up/game.js */
'use strict';

// ── Constants ────────────────────────────────────────────────
const TOTAL_ROUNDS    = 8;
const ROUND_TIME      = 20;
const RESULT_PAUSE_MS = getAutoplayPauseMs(2000);

// Player config
const PLAYER_CONFIG = [
  { label: 'P1', dot: '#0288D1', cls: 'p1' },
  { label: 'P2', dot: '#E53935', cls: 'p2' },
  { label: 'P3', dot: '#388E3C', cls: 'p3' },
  { label: 'P4', dot: '#F57C00', cls: 'p4' },
];

// 동물 이모지와 한글 이름
const ANIMALS = [
  { emoji: '🐰', name: '토끼' },
  { emoji: '🐻', name: '곰' },
  { emoji: '🦊', name: '여우' },
  { emoji: '🐢', name: '거북이' },
  { emoji: '🐸', name: '개구리' },
  { emoji: '🐧', name: '펭귄' },
];

// ── 힌트 생성 함수들 ──────────────────────────────────────────
// perm: [0,1,2,...] — 위치 배열 (인덱스 = 동물 인덱스, 값 = 줄 위치 1부터)
// 즉 perm[i] = j 이면 animals[i]가 j번째

// 힌트 타입
// 'before':  A가 B보다 앞이에요
// 'notlast': A는 맨 뒤가 아니에요
// 'notfirst': A는 맨 앞이 아니에요
// 'rank':    A는 N번째예요
// 'adjacent': A와 B는 바로 붙어있어요
// 'between': A는 B와 C 사이에 있어요

function generateHint(hintType, perm, animals, numAnimals) {
  if (hintType === 'before') {
    // A의 위치 < B의 위치
    const pairs = [];
    for (let i = 0; i < numAnimals; i++) {
      for (let j = 0; j < numAnimals; j++) {
        if (i !== j && perm[i] < perm[j]) pairs.push([i, j]);
      }
    }
    if (pairs.length === 0) return null;
    const [a, b] = pairs[Math.floor(Math.random() * pairs.length)];
    return {
      type: 'before',
      text: `${animals[a].emoji}${animals[a].name}은 ${animals[b].emoji}${animals[b].name}보다 앞이에요`,
      check: function(p) { return p[a] < p[b]; }
    };
  }
  if (hintType === 'notlast') {
    const candidates = [];
    for (let i = 0; i < numAnimals; i++) {
      if (perm[i] !== numAnimals) candidates.push(i);
    }
    if (candidates.length === 0) return null;
    const a = candidates[Math.floor(Math.random() * candidates.length)];
    return {
      type: 'notlast',
      text: `${animals[a].emoji}${animals[a].name}은 맨 뒤가 아니에요`,
      check: function(p) { return p[a] !== numAnimals; }
    };
  }
  if (hintType === 'notfirst') {
    const candidates = [];
    for (let i = 0; i < numAnimals; i++) {
      if (perm[i] !== 1) candidates.push(i);
    }
    if (candidates.length === 0) return null;
    const a = candidates[Math.floor(Math.random() * candidates.length)];
    return {
      type: 'notfirst',
      text: `${animals[a].emoji}${animals[a].name}은 맨 앞이 아니에요`,
      check: function(p) { return p[a] !== 1; }
    };
  }
  if (hintType === 'rank') {
    // 정확한 위치: 주로 후반 라운드에서 사용
    const a = Math.floor(Math.random() * numAnimals);
    const pos = perm[a];
    return {
      type: 'rank',
      text: `${animals[a].emoji}${animals[a].name}은 ${pos}번째예요`,
      check: function(p) { return p[a] === pos; }
    };
  }
  if (hintType === 'adjacent') {
    // A와 B는 바로 붙어있어요 (|pos_a - pos_b| === 1)
    const pairs = [];
    for (let i = 0; i < numAnimals; i++) {
      for (let j = i + 1; j < numAnimals; j++) {
        if (Math.abs(perm[i] - perm[j]) === 1) pairs.push([i, j]);
      }
    }
    if (pairs.length === 0) return null;
    const [a, b] = pairs[Math.floor(Math.random() * pairs.length)];
    return {
      type: 'adjacent',
      text: `${animals[a].emoji}${animals[a].name}과 ${animals[b].emoji}${animals[b].name}은 바로 옆에 있어요`,
      check: function(p) { return Math.abs(p[a] - p[b]) === 1; }
    };
  }
  return null;
}

// 힌트 셋이 주어진 perm을 유일하게 결정하는지 검증
// allPerms: 이 numAnimals에 대한 모든 순열
// hints: [{check}] 배열
// perm: 정답 순열
function isUnique(perm, hints, allPerms) {
  let count = 0;
  for (let pi = 0; pi < allPerms.length; pi++) {
    const p = allPerms[pi];
    let ok = true;
    for (let hi = 0; hi < hints.length; hi++) {
      if (!hints[hi].check(p)) { ok = false; break; }
    }
    if (ok) {
      count++;
      if (count > 1) return false;
    }
  }
  return count === 1;
}

// n개의 순열 전체 생성 (n <= 4)
function generateAllPerms(n) {
  const result = [];
  function permute(arr, current) {
    if (current.length === n) {
      result.push(current.slice());
      return;
    }
    for (let i = 0; i < arr.length; i++) {
      const next = arr.slice();
      const val = next.splice(i, 1)[0];
      current.push(val);
      permute(next, current);
      current.pop();
    }
  }
  // perm[i] = 1-indexed position of animal i
  permute(Array.from({ length: n }, function(_, k) { return k + 1; }), []);
  return result;
}

// 라운드별 설정: numAnimals, numHints, 허용 힌트 타입
const ROUND_CONFIGS = [
  { numAnimals: 3, numHints: 2, hintTypes: ['before', 'notlast'] },          // R1
  { numAnimals: 3, numHints: 2, hintTypes: ['before', 'notfirst'] },         // R2
  { numAnimals: 3, numHints: 2, hintTypes: ['before', 'notlast', 'notfirst'] }, // R3
  { numAnimals: 4, numHints: 3, hintTypes: ['before', 'notlast'] },          // R4
  { numAnimals: 4, numHints: 3, hintTypes: ['before', 'notfirst', 'notlast'] }, // R5
  { numAnimals: 4, numHints: 3, hintTypes: ['before', 'notlast', 'adjacent'] }, // R6
  { numAnimals: 4, numHints: 3, hintTypes: ['before', 'notlast', 'notfirst', 'adjacent'] }, // R7
  { numAnimals: 4, numHints: 3, hintTypes: ['before', 'notlast', 'notfirst', 'rank'] },     // R8
];

// 질문 타입 (라운드별 — 후반으로 갈수록 다양)
const QUESTION_TYPES = [
  '1번째', '2번째', '1번째', '맨 마지막', '2번째', '3번째', '맨 마지막', '2번째'
];

// 질문 위치를 1-indexed로 파싱
function parseQuestionPos(qtype, numAnimals) {
  if (qtype === '1번째') return 1;
  if (qtype === '2번째') return 2;
  if (qtype === '3번째') return 3;
  if (qtype === '맨 마지막') return numAnimals;
  return 1;
}

function luShuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 게임 라운드 데이터 생성
function luBuildGameRounds() {
  const rounds = [];
  for (let ri = 0; ri < TOTAL_ROUNDS; ri++) {
    const cfg = ROUND_CONFIGS[ri];
    const qtype = QUESTION_TYPES[ri];
    const qPos = parseQuestionPos(qtype, cfg.numAnimals);
    const allPerms = generateAllPerms(cfg.numAnimals);

    let round = null;
    let attempts = 0;

    while (!round && attempts < 500) {
      attempts++;

      // 동물 선택 (랜덤 순서)
      const selectedAnimals = luShuffle(ANIMALS).slice(0, cfg.numAnimals);

      // 정답 순열 랜덤 선택
      const perm = luShuffle(allPerms)[0].slice(); // perm[i] = position of animal i

      // 힌트 후보 생성
      const hintTypePool = luShuffle(cfg.hintTypes.slice());
      const hints = [];
      let hintAttempts = 0;

      while (hints.length < cfg.numHints && hintAttempts < 100) {
        hintAttempts++;
        const htype = hintTypePool[hintAttempts % hintTypePool.length];
        const hint = generateHint(htype, perm, selectedAnimals, cfg.numAnimals);
        if (!hint) continue;
        // 중복 텍스트 방지
        if (hints.some(function(h) { return h.text === hint.text; })) continue;
        hints.push(hint);
      }

      if (hints.length < cfg.numHints) continue;

      // 유일성 검증
      if (!isUnique(perm, hints, allPerms)) continue;

      // 정답 동물 찾기 (qPos 번째)
      let answerAnimalIdx = -1;
      for (let ai = 0; ai < cfg.numAnimals; ai++) {
        if (perm[ai] === qPos) { answerAnimalIdx = ai; break; }
      }
      if (answerAnimalIdx === -1) continue;

      // 오답 동물 (정답 제외, 같은 세트에서)
      const wrongAnimals = selectedAnimals.filter(function(_, idx) { return idx !== answerAnimalIdx; });

      // 보기 4개 (정답 + 오답들, 부족하면 다른 동물 추가)
      const allOtherAnimals = ANIMALS.filter(function(a) {
        return !selectedAnimals.some(function(s) { return s.emoji === a.emoji; });
      });
      const extraAnimals = luShuffle(allOtherAnimals);
      const wrongPool = wrongAnimals.concat(extraAnimals).slice(0, 3);
      if (wrongPool.length < 3) continue;

      rounds.push({
        animals: selectedAnimals,
        perm,
        hints,
        qtype,
        qPos,
        answerAnimalIdx,
        answerAnimal: selectedAnimals[answerAnimalIdx],
        wrongAnimals: wrongPool,
      });
      round = rounds[rounds.length - 1];
    }

    // 폴백: 3마리 단순 전순열
    if (!round) {
      const fallbackAnimals = ANIMALS.slice(0, 3);
      const fallbackPerm = [1, 2, 3];
      const fallbackHints = [
        { text: `${fallbackAnimals[0].emoji}${fallbackAnimals[0].name}은 ${fallbackAnimals[1].emoji}${fallbackAnimals[1].name}보다 앞이에요`, check: function(p) { return p[0] < p[1]; } },
        { text: `${fallbackAnimals[1].emoji}${fallbackAnimals[1].name}은 맨 뒤가 아니에요`, check: function(p) { return p[1] !== 3; } },
      ];
      rounds.push({
        animals: fallbackAnimals,
        perm: fallbackPerm,
        hints: fallbackHints,
        qtype: '1번째',
        qPos: 1,
        answerAnimalIdx: 0,
        answerAnimal: fallbackAnimals[0],
        wrongAnimals: [fallbackAnimals[1], fallbackAnimals[2], ANIMALS[3]],
      });
    }
  }
  return rounds;
}

// ── Sound Manager ────────────────────────────────────────────
const luSound = createSoundManager({
  ding(ctx) {
    [523, 659, 784].forEach(function(freq, i) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine';
      const t = ctx.currentTime + i * 0.09;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
      osc.start(t); osc.stop(t + 0.32);
    });
  },
  buzz(ctx) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.28);
    gain.gain.setValueAtTime(0.45, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.32);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.32);
  },
  timeout(ctx) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160, ctx.currentTime);
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.5);
  },
  tick(ctx) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'square';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.08);
  },
  fanfare(ctx) {
    [392, 494, 523, 659, 784].forEach(function(freq, i) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'triangle';
      const t = ctx.currentTime + i * 0.12;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
      osc.start(t); osc.stop(t + 0.38);
    });
  },
});

// ── State ─────────────────────────────────────────────────────
let luPlayerCount   = 2;
let luRoundIdx      = 0;
let luScores        = [];
let luRoundLog      = [];
let luCurrentRound  = null;
let luDqSet         = new Set();
let luPhase         = 'idle';
let luTimerHandle   = null;
let luNextHandle    = null;
let luTimeRemaining = ROUND_TIME;
let luGameRounds    = [];
let luChoiceOrder   = []; // 버튼 순서 (셔플된 옵션 인덱스)

// ── DOM refs ──────────────────────────────────────────────────
const luIntroScreen     = document.getElementById('introScreen');
const luCountdownScreen = document.getElementById('countdownScreen');
const luCountdownNumber = document.getElementById('countdownNumber');
const luGameScreen      = document.getElementById('gameScreen');
const luResultScreen    = document.getElementById('resultScreen');

const luBackBtn   = document.getElementById('backBtn');
const luPlayBtn   = document.getElementById('playBtn');
const luCloseBtn  = document.getElementById('closeBtn');
const luRetryBtn  = document.getElementById('retryBtn');
const luHomeBtn   = document.getElementById('homeBtn');

const luZonesWrap       = document.getElementById('zonesWrap');
const luQuestionCounter = document.getElementById('questionCounter');
const luProblemTimer    = document.getElementById('problemTimer');
const luProblemStatus   = document.getElementById('problemStatus');
const luLineupHints     = document.getElementById('lineupHints');
const luLineupQuestion  = document.getElementById('lineupQuestion');
const luScoreBar        = document.getElementById('scoreBar');

const luSoundToggleIntro = document.getElementById('soundToggleIntro');

const luResultTitle     = document.getElementById('resultTitle');
const luResultWinner    = document.getElementById('resultWinner');
const luResultTableHead = document.getElementById('resultTableHead');
const luResultTableBody = document.getElementById('resultTableBody');
const luTotalRow        = document.getElementById('totalRow');

// ── Helpers ───────────────────────────────────────────────────
function luShowScreen(s) {
  [luIntroScreen, luCountdownScreen, luGameScreen, luResultScreen].forEach(function(x) { x.classList.remove('active'); });
  s.classList.add('active');
}

var luCountdownInterval = null;
function luStartPreGameCountdown(onDone) {
  luShowScreen(luCountdownScreen);
  var count = 3;
  luCountdownNumber.textContent = count;
  luCountdownInterval = setInterval(function() {
    count--;
    if (count <= 0) {
      clearInterval(luCountdownInterval);
      luCountdownInterval = null;
      onDone();
    } else {
      luCountdownNumber.textContent = count;
      luCountdownNumber.style.animation = 'none';
      luCountdownNumber.offsetHeight; // reflow
      luCountdownNumber.style.animation = '';
    }
  }, 1000);
}

function luClearTimers() {
  if (luCountdownInterval) { clearInterval(luCountdownInterval); luCountdownInterval = null; }
  if (luTimerHandle) { clearInterval(luTimerHandle); luTimerHandle = null; }
  if (luNextHandle)  { clearTimeout(luNextHandle);   luNextHandle  = null; }
}

function luUpdateSoundBtn(btn) {
  btn.textContent = luSound.isMuted() ? '🔇' : '🔊';
}

// ── Intro illustration ─────────────────────────────────────────
(function luRenderIntroIllust() {
  const el = document.getElementById('introIllust');
  if (!el) return;
  el.innerHTML = `<svg viewBox="0 0 220 100" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="4" width="212" height="92" rx="14" fill="#FFF8E1" stroke="#2C2C2C" stroke-width="3"/>
    <line x1="22" y1="72" x2="198" y2="72" stroke="#2C2C2C" stroke-width="2.5" stroke-linecap="round"/>
    <text x="22" y="60" font-size="28">🐰</text>
    <text x="70" y="60" font-size="28">🐻</text>
    <text x="120" y="60" font-size="28">🦊</text>
    <text x="170" y="60" font-size="28">🐢</text>
    <text x="22" y="88" text-anchor="middle" font-size="11" font-weight="800" fill="#F9A825">1번째</text>
    <text x="84" y="88" text-anchor="middle" font-size="11" font-weight="800" fill="#555">2번째</text>
    <text x="136" y="88" text-anchor="middle" font-size="11" font-weight="800" fill="#555">3번째</text>
    <text x="186" y="88" text-anchor="middle" font-size="11" font-weight="800" fill="#555">4번째</text>
  </svg>`;
})();

// ── Player count selection ─────────────────────────────────────
document.querySelectorAll('.player-btn').forEach(function(btn) {
  onTap(btn, function() {
    document.querySelectorAll('.player-btn').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    luPlayerCount = parseInt(btn.dataset.count, 10);
  });
});

// ── Sound toggle ───────────────────────────────────────────────
onTap(luSoundToggleIntro, function() {
  luSound.toggleMute();
  luUpdateSoundBtn(luSoundToggleIntro);
});
luUpdateSoundBtn(luSoundToggleIntro);

// ── Navigation ────────────────────────────────────────────────
onTap(luBackBtn,  function() { goHome(); });
onTap(luCloseBtn, function() { luClearTimers(); goHome(); });
onTap(luHomeBtn,  function() { goHome(); });
onTap(luRetryBtn, function() { luStartPreGameCountdown(function() { luStartGame(); }); });
onTap(luPlayBtn,  function() { luStartPreGameCountdown(function() { luStartGame(); }); });

// ── Problem panel ──────────────────────────────────────────────
function luRenderPanel() {
  const r = luCurrentRound;

  luLineupHints.innerHTML = '';
  r.hints.forEach(function(h) {
    const div = document.createElement('div');
    div.className = 'hint-item';
    div.textContent = h.text;
    luLineupHints.appendChild(div);
  });

  luLineupQuestion.textContent = `❓ ${r.qtype}는 누구?`;
}

// ── Build zones ────────────────────────────────────────────────
function luBuildZones() {
  luZonesWrap.innerHTML = '';
  luZonesWrap.className = `zones-wrap p${luPlayerCount}`;

  for (let i = 0; i < luPlayerCount; i++) {
    const cfg  = PLAYER_CONFIG[i];
    const zone = document.createElement('div');
    zone.className = `zone ${cfg.cls}`;
    zone.dataset.player = i;

    const header = document.createElement('div');
    header.className = 'zone-header';
    header.innerHTML = `
      <span class="zone-label">${cfg.label}</span>
      <span class="zone-score-chip" id="lu-score-chip-${i}">0점</span>
    `;

    const grid = document.createElement('div');
    grid.className = 'choice-grid';
    grid.id = `lu-choice-grid-${i}`;

    for (let s = 0; s < 4; s++) {
      const btn = document.createElement('button');
      btn.className = 'choice-btn';
      btn.dataset.player = String(i);
      btn.dataset.slot = String(s);
      btn.setAttribute('aria-label', `${cfg.label} 보기 ${s + 1}`);
      onTap(btn, (function(pi, b) { return function() { luHandleAnswerTap(pi, b); }; })(i, btn));
      grid.appendChild(btn);
    }

    zone.appendChild(header);
    zone.appendChild(grid);
    luZonesWrap.appendChild(zone);
  }
}

function luGetZone(idx) {
  return luZonesWrap.querySelector(`.zone[data-player="${idx}"]`);
}

function luGetChoiceBtns(playerIdx) {
  return luZonesWrap.querySelectorAll(`.choice-btn[data-player="${playerIdx}"]`);
}

function luUpdateScoreChip(playerIdx) {
  const chip = document.getElementById(`lu-score-chip-${playerIdx}`);
  if (chip) chip.textContent = `${luScores[playerIdx]}점`;
}

// ── Score bar ──────────────────────────────────────────────────
function luBuildScoreBar() {
  luScoreBar.innerHTML = '';
  for (let i = 0; i < luPlayerCount; i++) {
    const cfg  = PLAYER_CONFIG[i];
    const chip = document.createElement('div');
    chip.className = 'score-chip';
    chip.innerHTML = `
      <span class="score-chip-dot" style="background:${cfg.dot}"></span>
      <span>${cfg.label}</span>
      <span class="score-chip-val" id="lu-bar-score-${i}">0</span>
    `;
    luScoreBar.appendChild(chip);
  }
}

function luUpdateBarScore(playerIdx) {
  const el = document.getElementById(`lu-bar-score-${playerIdx}`);
  if (el) el.textContent = luScores[playerIdx];
}

// ── Reset buttons for round ─────────────────────────────────────
function luResetBtnsForRound() {
  const r = luCurrentRound;
  // 보기: 정답 + 오답3
  const options = [r.answerAnimal, r.wrongAnimals[0], r.wrongAnimals[1], r.wrongAnimals[2]];
  luChoiceOrder = luShuffle([0, 1, 2, 3]);

  for (let i = 0; i < luPlayerCount; i++) {
    const btns = luGetChoiceBtns(i);
    btns.forEach(function(btn, s) {
      btn.className = 'choice-btn';
      btn.disabled = false;
      const optIdx = luChoiceOrder[s];
      const animal = options[optIdx];
      btn.innerHTML = `<span>${animal.emoji}</span><span class="choice-btn-label">${animal.name}</span>`;
      btn.dataset.optIdx = String(optIdx);
    });
    const zone = luGetZone(i);
    if (zone) zone.classList.remove('dq-zone');
  }
}

function luDisablePlayerBtns(playerIdx) {
  luGetChoiceBtns(playerIdx).forEach(function(b) {
    b.classList.add('state-disabled');
    b.disabled = true;
  });
}

// ── Timer ──────────────────────────────────────────────────────
function luStartCountdown() {
  luTimeRemaining = ROUND_TIME;
  luProblemTimer.textContent = luTimeRemaining;
  luProblemTimer.classList.remove('urgent');

  luTimerHandle = setInterval(function() {
    luTimeRemaining--;
    luProblemTimer.textContent = luTimeRemaining;

    if (luTimeRemaining <= 5) {
      luProblemTimer.classList.add('urgent');
      luSound.play('tick');
    }
    if (luTimeRemaining <= 0) {
      luClearTimers();
      luHandleTimeout();
    }
  }, 1000);
}

// ── Answer tap ─────────────────────────────────────────────────
function luHandleAnswerTap(playerIdx, btn) {
  if (luPhase !== 'active') return;
  if (luDqSet.has(playerIdx)) return;

  const optIdx = parseInt(btn.dataset.optIdx, 10);
  const isCorrect = (optIdx === 0); // index 0 = answerAnimal

  if (isCorrect) {
    luResolveRound(playerIdx);
  } else {
    luSound.play('buzz');
    btn.classList.add('state-wrong');

    luDqSet.add(playerIdx);

    const zone = luGetZone(playerIdx);
    const flash = document.createElement('div');
    flash.className = 'penalty-flash';
    flash.textContent = '실격!';
    zone.appendChild(flash);
    flash.addEventListener('animationend', function() { flash.remove(); });

    luDisablePlayerBtns(playerIdx);
    zone.classList.add('dq-zone');

    let anyActive = false;
    for (let i = 0; i < luPlayerCount; i++) {
      if (!luDqSet.has(i)) { anyActive = true; break; }
    }
    if (!anyActive) {
      luClearTimers();
      luNextHandle = setTimeout(function() { luHandleTimeout(); }, 300);
    }
  }
}

// ── Correct resolved ────────────────────────────────────────────
function luResolveRound(winnerIdx) {
  luPhase = 'done';
  luClearTimers();
  luSound.play('ding');

  luScores[winnerIdx]++;
  luUpdateScoreChip(winnerIdx);
  luUpdateBarScore(winnerIdx);

  luGetChoiceBtns(winnerIdx).forEach(function(b) {
    if (parseInt(b.dataset.optIdx, 10) === 0) {
      b.classList.add('state-correct');
    } else {
      b.classList.add('state-disabled');
      b.disabled = true;
    }
  });

  for (let i = 0; i < luPlayerCount; i++) {
    if (i !== winnerIdx) luDisablePlayerBtns(i);
  }

  const r = luCurrentRound;
  const wLabel = PLAYER_CONFIG[winnerIdx].label;
  luProblemStatus.textContent = `${wLabel} 정답! (${r.qtype}: ${r.answerAnimal.emoji}${r.answerAnimal.name})`;

  luRoundLog.push({
    qtype: r.qtype,
    answerAnimal: r.answerAnimal,
    winnerIdx,
    dqPlayers: Array.from(luDqSet),
    timedOut: false,
  });

  luNextHandle = setTimeout(function() { luNextRound(); }, RESULT_PAUSE_MS);
}

// ── Timeout ────────────────────────────────────────────────────
function luHandleTimeout() {
  luPhase = 'done';
  luClearTimers();
  luSound.play('timeout');

  for (let i = 0; i < luPlayerCount; i++) {
    luGetChoiceBtns(i).forEach(function(b) {
      if (parseInt(b.dataset.optIdx, 10) === 0) {
        b.classList.remove('state-disabled');
        b.classList.add('state-reveal');
      } else {
        b.classList.add('state-disabled');
      }
      b.disabled = true;
    });
    const zone = luGetZone(i);
    if (zone) zone.classList.remove('dq-zone');
  }

  const r = luCurrentRound;
  luProblemStatus.textContent = `정답: ${r.answerAnimal.emoji}${r.answerAnimal.name}`;

  luRoundLog.push({
    qtype: r.qtype,
    answerAnimal: r.answerAnimal,
    winnerIdx: -1,
    dqPlayers: Array.from(luDqSet),
    timedOut: true,
  });

  luNextHandle = setTimeout(function() { luNextRound(); }, RESULT_PAUSE_MS);
}

// ── Load round ──────────────────────────────────────────────────
function luLoadRound() {
  luPhase       = 'active';
  luCurrentRound = luGameRounds[luRoundIdx];
  luDqSet       = new Set();

  luQuestionCounter.textContent = `${luRoundIdx + 1} / ${TOTAL_ROUNDS}`;
  luProblemStatus.textContent   = '';
  luProblemTimer.classList.remove('urgent');

  luRenderPanel();
  luResetBtnsForRound();
  luStartCountdown();
}

// ── Next round ─────────────────────────────────────────────────
function luNextRound() {
  luRoundIdx++;
  if (luRoundIdx >= TOTAL_ROUNDS) {
    luShowResult();
  } else {
    luLoadRound();
  }
}

// ── Start game ─────────────────────────────────────────────────
function luStartGame() {
  luGameRounds  = luBuildGameRounds();
  luRoundIdx    = 0;
  luScores      = new Array(luPlayerCount).fill(0);
  luRoundLog    = [];
  luDqSet       = new Set();
  luPhase       = 'idle';

  luClearTimers();
  luBuildZones();
  luBuildScoreBar();
  luShowScreen(luGameScreen);
  luLoadRound();
}

// ── Show result ────────────────────────────────────────────────
function luShowResult() {
  luClearTimers();
  luPhase = 'idle';
  luSound.play('fanfare');

  const maxScore = Math.max.apply(null, luScores);
  const winners  = luScores
    .map(function(s, i) { return { s: s, i: i }; })
    .filter(function(x) { return x.s === maxScore; })
    .map(function(x) { return x.i; });

  if (maxScore === 0) {
    luResultTitle.textContent  = '무승부!';
    luResultWinner.textContent = '아무도 점수를 얻지 못했어요.';
  } else if (winners.length === 1) {
    const w = winners[0];
    luResultTitle.textContent  = '게임 종료!';
    luResultWinner.textContent = `${PLAYER_CONFIG[w].label} 승리! (${maxScore}점)`;
  } else {
    const labels = winners.map(function(w) { return PLAYER_CONFIG[w].label; }).join(', ');
    luResultTitle.textContent  = '동점!';
    luResultWinner.textContent = `${labels} 공동 1위! (${maxScore}점)`;
  }

  // Table header
  const headRow = document.createElement('tr');
  headRow.innerHTML = '<th>라운드</th>' +
    Array.from({ length: luPlayerCount }, function(_, i) {
      return `<th><span class="player-dot" style="background:${PLAYER_CONFIG[i].dot}"></span>${PLAYER_CONFIG[i].label}</th>`;
    }).join('');
  luResultTableHead.innerHTML = '';
  luResultTableHead.appendChild(headRow);

  // Table body
  luResultTableBody.innerHTML = '';
  luRoundLog.forEach(function(log, idx) {
    const tr = document.createElement('tr');
    let cells = `<td style="text-align:left;font-size:0.82rem;">${idx + 1}. ${log.qtype}<br><span style="font-size:0.72rem;color:#888">정답 ${log.answerAnimal.emoji}${log.answerAnimal.name}</span></td>`;

    for (let i = 0; i < luPlayerCount; i++) {
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
    luResultTableBody.appendChild(tr);
  });

  // Total chips
  luTotalRow.innerHTML = '';
  for (let i = 0; i < luPlayerCount; i++) {
    const cfg   = PLAYER_CONFIG[i];
    const isWin = winners.includes(i) && maxScore > 0;
    const chip  = document.createElement('div');
    chip.className = 'total-chip';
    chip.innerHTML = `
      <span class="chip-dot" style="background:${cfg.dot}"></span>
      <span>${cfg.label}</span>
      <span class="chip-score" style="color:${isWin ? '#2E7D32' : '#555'}">${luScores[i]}점</span>
      ${isWin ? '<span style="font-size:1.1rem;">★</span>' : ''}
    `;
    luTotalRow.appendChild(chip);
  }

  luShowScreen(luResultScreen);
}
