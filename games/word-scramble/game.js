/* games/word-scramble/game.js */
'use strict';

// ── Constants ────────────────────────────────────────────────
const TOTAL_ROUNDS    = 8;
const ROUND_TIME      = 30;    // 30초 제한
const RESULT_PAUSE_MS = getAutoplayPauseMs(2000);
const LOCK_MS         = 1000;  // 오답 후 1초 잠금

// Player config
const PLAYER_CONFIG = [
  { label: 'P1', dot: '#0288D1', cls: 'p1' },
  { label: 'P2', dot: '#E53935', cls: 'p2' },
  { label: 'P3', dot: '#388E3C', cls: 'p3' },
  { label: 'P4', dot: '#F57C00', cls: 'p4' },
];

// ── 단어 라이브러리 ────────────────────────────────────────────
// 형식: { word: "사과", syllables: ["사","과"], hint: "🍎", len: 2 }
// 규칙: 음절 재배열로 다른 유효 단어가 되지 않는 것만 수록
// (예: "자기"/"기자" 같은 경우 제외)
// 난이도별 분류: len 2 = 쉬움, len 3 = 중간, len 4 = 어려움

const WS_WORD_LIBRARY = [
  // ── 2글자 (라운드 1~2용) ────────────────────────────────
  { word: '사과', syllables: ['사', '과'], hint: '🍎', hintLabel: '사과', len: 2 },
  { word: '바나나', syllables: ['바', '나', '나'], hint: '🍌', hintLabel: '바나나', len: 3 },
  // 2글자 추가 — "나비/비나"는 '비나' 도 단어가 아님 OK, 그러나 안전하게 확인한 것만
  { word: '하늘', syllables: ['하', '늘'], hint: '🌤️', hintLabel: '하늘', len: 2 },
  { word: '바람', syllables: ['바', '람'], hint: '💨', hintLabel: '바람', len: 2 },
  { word: '구름', syllables: ['구', '름'], hint: '☁️', hintLabel: '구름', len: 2 },
  { word: '나비', syllables: ['나', '비'], hint: '🦋', hintLabel: '나비', len: 2 },
  { word: '토끼', syllables: ['토', '끼'], hint: '🐰', hintLabel: '토끼', len: 2 },
  { word: '호랑이', syllables: ['호', '랑', '이'], hint: '🐯', hintLabel: '호랑이', len: 3 },
  { word: '고양이', syllables: ['고', '양', '이'], hint: '🐱', hintLabel: '고양이', len: 3 },
  { word: '거미', syllables: ['거', '미'], hint: '🕷️', hintLabel: '거미', len: 2 },
  { word: '개미', syllables: ['개', '미'], hint: '🐜', hintLabel: '개미', len: 2 },
  { word: '달팽이', syllables: ['달', '팽', '이'], hint: '🐌', hintLabel: '달팽이', len: 3 },
  // ── 3글자 (라운드 3~5용) ────────────────────────────────
  { word: '무지개', syllables: ['무', '지', '개'], hint: '🌈', hintLabel: '무지개', len: 3 },
  { word: '파란색', syllables: ['파', '란', '색'], hint: '🔵', hintLabel: '파란색', len: 3 },
  { word: '빨간색', syllables: ['빨', '간', '색'], hint: '🔴', hintLabel: '빨간색', len: 3 },
  { word: '노란색', syllables: ['노', '란', '색'], hint: '🟡', hintLabel: '노란색', len: 3 },
  { word: '초록색', syllables: ['초', '록', '색'], hint: '🟢', hintLabel: '초록색', len: 3 },
  { word: '수박씨', syllables: ['수', '박', '씨'], hint: '🍉', hintLabel: '수박씨', len: 3 },
  { word: '딸기잼', syllables: ['딸', '기', '잼'], hint: '🍓', hintLabel: '딸기잼', len: 3 },
  { word: '도토리', syllables: ['도', '토', '리'], hint: '🌰', hintLabel: '도토리', len: 3 },
  { word: '자전거', syllables: ['자', '전', '거'], hint: '🚲', hintLabel: '자전거', len: 3 },
  { word: '버스표', syllables: ['버', '스', '표'], hint: '🚌', hintLabel: '버스표', len: 3 },
  { word: '지우개', syllables: ['지', '우', '개'], hint: '⬜', hintLabel: '지우개', len: 3 },
  { word: '연필통', syllables: ['연', '필', '통'], hint: '✏️', hintLabel: '연필통', len: 3 },
  { word: '칫솔질', syllables: ['칫', '솔', '질'], hint: '🪥', hintLabel: '칫솔질', len: 3 },
  { word: '냉장고', syllables: ['냉', '장', '고'], hint: '🧊', hintLabel: '냉장고', len: 3 },
  { word: '세탁기', syllables: ['세', '탁', '기'], hint: '🫧', hintLabel: '세탁기', len: 3 },
  { word: '태양계', syllables: ['태', '양', '계'], hint: '🌞', hintLabel: '태양계', len: 3 },
  // ── 4글자 (라운드 6~8용) ────────────────────────────────
  { word: '운동장에', syllables: ['운', '동', '장', '에'], hint: '⚽', hintLabel: '운동장에서', len: 4 },
  { word: '도서관에', syllables: ['도', '서', '관', '에'], hint: '📚', hintLabel: '도서관에서', len: 4 },
  { word: '놀이터에', syllables: ['놀', '이', '터', '에'], hint: '🛝', hintLabel: '놀이터에서', len: 4 },
  { word: '수영장에', syllables: ['수', '영', '장', '에'], hint: '🏊', hintLabel: '수영장에서', len: 4 },
  { word: '동물원에', syllables: ['동', '물', '원', '에'], hint: '🦁', hintLabel: '동물원에서', len: 4 },
  { word: '식물원에', syllables: ['식', '물', '원', '에'], hint: '🌱', hintLabel: '식물원에서', len: 4 },
];

// 라운드별 글자 수 계획
// R1~2: 2글자 + 힌트O, R3~4: 3글자 + 힌트O, R5: 3글자 힌트X, R6~8: 4글자 힌트X
const ROUND_PLAN = [
  { len: 2, hint: true },
  { len: 2, hint: true },
  { len: 3, hint: true },
  { len: 3, hint: true },
  { len: 3, hint: false },
  { len: 4, hint: false },
  { len: 4, hint: false },
  { len: 4, hint: false },
];

// ── 라운드 데이터 생성 ─────────────────────────────────────────
function wsShuffleArr(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function wsBuildGameRounds() {
  const rounds = [];
  const usedWords = new Set();

  for (let ri = 0; ri < TOTAL_ROUNDS; ri++) {
    const plan = ROUND_PLAN[ri];
    const pool = WS_WORD_LIBRARY.filter(function(w) {
      return w.len === plan.len && !usedWords.has(w.word);
    });

    let wordData = null;
    if (pool.length > 0) {
      wordData = pool[Math.floor(Math.random() * pool.length)];
    } else {
      // 폴백: 같은 길이에서 재사용 허용
      const fallbackPool = WS_WORD_LIBRARY.filter(function(w) { return w.len === plan.len; });
      wordData = fallbackPool[Math.floor(Math.random() * fallbackPool.length)];
    }
    usedWords.add(wordData.word);

    // 음절 섞기 — 원래 순서와 달라야 함
    let shuffledSyllables;
    let attempts = 0;
    do {
      shuffledSyllables = wsShuffleArr(wordData.syllables);
      attempts++;
    } while (
      shuffledSyllables.join('') === wordData.syllables.join('') && attempts < 20
    );

    rounds.push({
      word: wordData.word,
      syllables: wordData.syllables.slice(), // 정답 순서
      shuffled: shuffledSyllables,           // 섞인 순서 (표시용)
      hint: wordData.hint,
      hintLabel: wordData.hintLabel,
      showHint: plan.hint,
    });
  }
  return rounds;
}

// ── Sound Manager ────────────────────────────────────────────
const wsSound = createSoundManager({
  click(ctx) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.1);
  },
  wrong(ctx) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.25);
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.3);
  },
  complete(ctx) {
    [523, 659, 784, 1047].forEach(function(freq, i) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine';
      const t = ctx.currentTime + i * 0.08;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.start(t); osc.stop(t + 0.28);
    });
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
let wsPlayerCount   = 2;
let wsRoundIdx      = 0;
let wsScores        = [];
let wsRoundLog      = [];
let wsCurrentRound  = null;
let wsPhase         = 'idle'; // 'idle' | 'active' | 'done'
let wsTimerHandle   = null;
let wsNextHandle    = null;
let wsTimeRemaining = ROUND_TIME;
let wsGameRounds    = [];

// 플레이어별 진행 상태
// wsProgress[i] = 현재까지 입력한 음절 수 (올바른 순서로)
let wsProgress      = [];
// wsLockHandles[i] = 잠금 타이머 핸들
let wsLockHandles   = [];
// wsDone[i] = 완성 여부
let wsDone          = [];

// ── DOM refs ──────────────────────────────────────────────────
const wsIntroScreen     = document.getElementById('introScreen');
const wsCountdownScreen = document.getElementById('countdownScreen');
const wsCountdownNumber = document.getElementById('countdownNumber');
const wsGameScreen      = document.getElementById('gameScreen');
const wsResultScreen    = document.getElementById('resultScreen');

const wsBackBtn   = document.getElementById('backBtn');
const wsPlayBtn   = document.getElementById('playBtn');
const wsCloseBtn  = document.getElementById('closeBtn');
const wsRetryBtn  = document.getElementById('retryBtn');
const wsHomeBtn   = document.getElementById('homeBtn');

const wsZonesWrap       = document.getElementById('zonesWrap');
const wsQuestionCounter = document.getElementById('questionCounter');
const wsProblemTimer    = document.getElementById('problemTimer');
const wsProblemStatus   = document.getElementById('problemStatus');
const wsHintRow         = document.getElementById('wsHintRow');
const wsHintEmoji       = document.getElementById('wsHintEmoji');
const wsHintLabel       = document.getElementById('wsHintLabel');
const wsScoreBar        = document.getElementById('scoreBar');

const wsSoundToggleIntro = document.getElementById('soundToggleIntro');

const wsResultTitle     = document.getElementById('resultTitle');
const wsResultWinner    = document.getElementById('resultWinner');
const wsResultTableHead = document.getElementById('resultTableHead');
const wsResultTableBody = document.getElementById('resultTableBody');
const wsTotalRow        = document.getElementById('totalRow');

// ── Helpers ───────────────────────────────────────────────────
function wsShowScreen(s) {
  [wsIntroScreen, wsCountdownScreen, wsGameScreen, wsResultScreen].forEach(function(x) { x.classList.remove('active'); });
  s.classList.add('active');
}

var wsCountdownInterval = null;
function wsStartPreGameCountdown(onDone) {
  wsShowScreen(wsCountdownScreen);
  wsCountdownInterval = runCountdown(wsCountdownNumber, onDone);
}

function wsClearTimers() {
  if (wsCountdownInterval) { clearInterval(wsCountdownInterval); wsCountdownInterval = null; }
  if (wsTimerHandle) { clearInterval(wsTimerHandle); wsTimerHandle = null; }
  if (wsNextHandle)  { clearTimeout(wsNextHandle);   wsNextHandle  = null; }
  wsLockHandles.forEach(function(h) { if (h) clearTimeout(h); });
  wsLockHandles = new Array(wsPlayerCount).fill(null);
}

function wsUpdateSoundBtn(btn) {
  btn.textContent = wsSound.isMuted() ? '🔇' : '🔊';
}

// ── Intro illustration ─────────────────────────────────────────
(function wsRenderIntroIllust() {
  const el = document.getElementById('introIllust');
  if (!el) return;
  el.innerHTML = `<svg viewBox="0 0 220 120" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="4" width="212" height="112" rx="14" fill="#FFF8E1" stroke="#2C2C2C" stroke-width="3"/>
    <rect x="16" y="20" width="44" height="44" rx="10" fill="#FCE4EC" stroke="#2C2C2C" stroke-width="3"/>
    <text x="38" y="51" text-anchor="middle" font-size="24" font-weight="900" fill="#D81B60">과</text>
    <rect x="70" y="20" width="44" height="44" rx="10" fill="#FCE4EC" stroke="#2C2C2C" stroke-width="3"/>
    <text x="92" y="51" text-anchor="middle" font-size="24" font-weight="900" fill="#D81B60">사</text>
    <text x="130" y="48" text-anchor="middle" font-size="22" fill="#555">→</text>
    <rect x="152" y="22" width="44" height="40" rx="10" fill="#A5D6A7" stroke="#2E7D32" stroke-width="3"/>
    <text x="174" y="51" text-anchor="middle" font-size="18" font-weight="900" fill="#1B5E20">사과</text>
    <text x="110" y="96" text-anchor="middle" font-size="14" font-weight="800" fill="#D81B60">바른 순서로 터치!</text>
  </svg>`;
})();

// ── Player count selection ─────────────────────────────────────
document.querySelectorAll('.player-btn').forEach(function(btn) {
  onTap(btn, function() {
    document.querySelectorAll('.player-btn').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    wsPlayerCount = parseInt(btn.dataset.count, 10);
  });
});

// ── Sound toggle ───────────────────────────────────────────────
onTap(wsSoundToggleIntro, function() {
  wsSound.toggleMute();
  wsUpdateSoundBtn(wsSoundToggleIntro);
});
wsUpdateSoundBtn(wsSoundToggleIntro);

// ── Navigation ────────────────────────────────────────────────
onTap(wsBackBtn,  function() { goHome(); });
onTap(wsCloseBtn, function() { wsClearTimers(); goHome(); });
onTap(wsHomeBtn,  function() { goHome(); });
onTap(wsRetryBtn, function() { wsStartPreGameCountdown(function() { wsStartGame(); }); });
onTap(wsPlayBtn,  function() { wsStartPreGameCountdown(function() { wsStartGame(); }); });

// ── Problem panel ──────────────────────────────────────────────
function wsRenderHint() {
  const r = wsCurrentRound;
  if (r.showHint) {
    wsHintRow.classList.remove('hidden');
    wsHintEmoji.textContent = r.hint;
    wsHintLabel.textContent = r.hintLabel;
  } else {
    wsHintRow.classList.add('hidden');
  }
}

// ── Build zones ────────────────────────────────────────────────
function wsBuildZones() {
  wsZonesWrap.innerHTML = '';
  wsZonesWrap.className = `zones-wrap p${wsPlayerCount}`;

  for (let i = 0; i < wsPlayerCount; i++) {
    const cfg  = PLAYER_CONFIG[i];
    const zone = document.createElement('div');
    zone.className = `zone ${cfg.cls}`;
    zone.dataset.player = i;
    zone.id = `ws-zone-${i}`;

    const header = document.createElement('div');
    header.className = 'zone-header';
    header.innerHTML = `
      <span class="zone-label">${cfg.label}</span>
      <span class="zone-score-chip" id="ws-score-chip-${i}">0점</span>
    `;

    // 조립 슬롯 (상단)
    const slots = document.createElement('div');
    slots.className = 'assemble-slots';
    slots.id = `ws-slots-${i}`;

    // 음절 카드 (하단, margin-top: auto)
    const cardGrid = document.createElement('div');
    cardGrid.className = 'syllable-grid';
    cardGrid.id = `ws-cards-${i}`;

    zone.appendChild(header);
    zone.appendChild(slots);
    zone.appendChild(cardGrid);
    wsZonesWrap.appendChild(zone);
  }
}

function wsGetZone(idx) {
  return document.getElementById(`ws-zone-${idx}`);
}

function wsUpdateScoreChip(playerIdx) {
  const chip = document.getElementById(`ws-score-chip-${playerIdx}`);
  if (chip) chip.textContent = `${wsScores[playerIdx]}점`;
}

// ── Score bar ──────────────────────────────────────────────────
function wsBuildScoreBar() {
  wsScoreBar.innerHTML = '';
  for (let i = 0; i < wsPlayerCount; i++) {
    const cfg  = PLAYER_CONFIG[i];
    const chip = document.createElement('div');
    chip.className = 'score-chip';
    chip.innerHTML = `
      <span class="score-chip-dot" style="background:${cfg.dot}"></span>
      <span>${cfg.label}</span>
      <span class="score-chip-val" id="ws-bar-score-${i}">0</span>
    `;
    wsScoreBar.appendChild(chip);
  }
}

function wsUpdateBarScore(playerIdx) {
  const el = document.getElementById(`ws-bar-score-${playerIdx}`);
  if (el) el.textContent = wsScores[playerIdx];
}

// ── 라운드 초기화 — 슬롯 + 카드 렌더 ───────────────────────────
function wsInitPlayerZone(playerIdx) {
  const r = wsCurrentRound;
  const slots = document.getElementById(`ws-slots-${playerIdx}`);
  const cards = document.getElementById(`ws-cards-${playerIdx}`);

  // 슬롯 초기화
  slots.innerHTML = '';
  for (let s = 0; s < r.syllables.length; s++) {
    const slot = document.createElement('div');
    slot.className = 'assemble-slot';
    slot.id = `ws-slot-${playerIdx}-${s}`;
    slots.appendChild(slot);
  }

  // 카드 초기화 (섞인 순서 — 모든 플레이어 동일)
  cards.innerHTML = '';
  for (let c = 0; c < r.shuffled.length; c++) {
    const card = document.createElement('div');
    card.className = 'syllable-card';
    card.textContent = r.shuffled[c];
    card.dataset.syllable = r.shuffled[c];
    card.dataset.cardIdx = String(c);
    card.dataset.player = String(playerIdx);
    onTap(card, (function(pi, cd) {
      return function() { wsHandleCardTap(pi, cd); };
    })(playerIdx, card));
    cards.appendChild(card);
  }

  wsProgress[playerIdx] = 0;
  wsDone[playerIdx] = false;

  const zone = wsGetZone(playerIdx);
  if (zone) zone.classList.remove('zone-locked', 'zone-done');
}

function wsResetBtnsForRound() {
  for (let i = 0; i < wsPlayerCount; i++) {
    wsInitPlayerZone(i);
  }
}

// ── 카드 탭 핸들러 ─────────────────────────────────────────────
function wsHandleCardTap(playerIdx, card) {
  if (wsPhase !== 'active') return;
  if (wsDone[playerIdx]) return;

  const zone = wsGetZone(playerIdx);
  if (zone && zone.classList.contains('zone-locked')) return;

  const syllable = card.dataset.syllable;
  const currentStep = wsProgress[playerIdx];
  const expected = wsCurrentRound.syllables[currentStep];

  if (syllable === expected) {
    // 정답 음절 — 슬롯에 채움
    wsSound.play('click');
    card.classList.add('used');

    const slot = document.getElementById(`ws-slot-${playerIdx}-${currentStep}`);
    if (slot) {
      slot.textContent = syllable;
      slot.classList.add('filled');
    }

    wsProgress[playerIdx]++;

    // 모든 음절 완성 체크
    if (wsProgress[playerIdx] >= wsCurrentRound.syllables.length) {
      wsHandleComplete(playerIdx);
    }
  } else {
    // 오답 — 리셋 + 1초 잠금 페널티
    wsHandleWrongCard(playerIdx, card);
  }
}

// ── 오답 처리 ──────────────────────────────────────────────────
function wsHandleWrongCard(playerIdx, card) {
  wsSound.play('wrong');

  // 진행 리셋
  wsProgress[playerIdx] = 0;

  // 슬롯 초기화
  const r = wsCurrentRound;
  for (let s = 0; s < r.syllables.length; s++) {
    const slot = document.getElementById(`ws-slot-${playerIdx}-${s}`);
    if (slot) {
      slot.textContent = '';
      slot.classList.remove('filled', 'complete');
    }
  }

  // 카드 모두 초기화 (used 제거)
  const cards = document.getElementById(`ws-cards-${playerIdx}`);
  if (cards) {
    cards.querySelectorAll('.syllable-card').forEach(function(c) {
      c.classList.remove('used');
    });
  }

  // 틀린 카드 잠깐 shake
  card.classList.add('locked');
  setTimeout(function() { card.classList.remove('locked'); }, 400);

  // 1초 존 잠금
  const zone = wsGetZone(playerIdx);
  if (zone) zone.classList.add('zone-locked');

  // 페널티 플래시
  const flash = document.createElement('div');
  flash.className = 'penalty-flash';
  flash.textContent = '처음부터!';
  zone.appendChild(flash);
  flash.addEventListener('animationend', function() { flash.remove(); });

  // 기존 잠금 해제 핸들 취소
  if (wsLockHandles[playerIdx]) {
    clearTimeout(wsLockHandles[playerIdx]);
  }
  wsLockHandles[playerIdx] = setTimeout(function() {
    const z = wsGetZone(playerIdx);
    if (z) z.classList.remove('zone-locked');
    wsLockHandles[playerIdx] = null;
  }, LOCK_MS);
}

// ── 완성 처리 ──────────────────────────────────────────────────
function wsHandleComplete(playerIdx) {
  if (wsPhase !== 'active') return;
  wsPhase = 'done';
  wsClearTimers();
  wsSound.play('complete');

  wsDone[playerIdx] = true;
  wsScores[playerIdx]++;
  wsUpdateScoreChip(playerIdx);
  wsUpdateBarScore(playerIdx);

  // 완성 슬롯 강조
  const r = wsCurrentRound;
  for (let s = 0; s < r.syllables.length; s++) {
    const slot = document.getElementById(`ws-slot-${playerIdx}-${s}`);
    if (slot) slot.classList.add('complete');
  }

  // 존 완성 표시
  const zone = wsGetZone(playerIdx);
  if (zone) {
    zone.classList.add('zone-done');
    const winFlash = document.createElement('div');
    winFlash.className = 'win-flash';
    winFlash.textContent = `${r.word} 완성!`;
    zone.appendChild(winFlash);
    winFlash.addEventListener('animationend', function() { winFlash.remove(); });
  }

  // 나머지 플레이어 비활성화
  for (let i = 0; i < wsPlayerCount; i++) {
    if (i !== playerIdx) {
      const otherZone = wsGetZone(i);
      if (otherZone) otherZone.classList.add('zone-done');
    }
  }

  const wLabel = PLAYER_CONFIG[playerIdx].label;
  wsProblemStatus.textContent = `${wLabel} 완성! (${r.word})`;

  wsRoundLog.push({
    word: r.word,
    winnerIdx: playerIdx,
    timedOut: false,
  });

  wsNextHandle = setTimeout(function() { wsNextRound(); }, RESULT_PAUSE_MS);
}

// ── Timeout ────────────────────────────────────────────────────
function wsHandleTimeout() {
  wsPhase = 'done';
  wsClearTimers();
  wsSound.play('timeout');

  for (let i = 0; i < wsPlayerCount; i++) {
    const zone = wsGetZone(i);
    if (zone) zone.classList.add('zone-done');
  }

  const r = wsCurrentRound;
  wsProblemStatus.textContent = `정답: ${r.word}`;

  wsRoundLog.push({
    word: r.word,
    winnerIdx: -1,
    timedOut: true,
  });

  wsNextHandle = setTimeout(function() { wsNextRound(); }, RESULT_PAUSE_MS);
}

// ── Timer ──────────────────────────────────────────────────────
function wsStartCountdown() {
  wsTimeRemaining = ROUND_TIME;
  wsProblemTimer.textContent = wsTimeRemaining;
  wsProblemTimer.classList.remove('urgent');

  wsTimerHandle = setInterval(function() {
    wsTimeRemaining--;
    wsProblemTimer.textContent = wsTimeRemaining;

    if (wsTimeRemaining <= 8) {
      wsProblemTimer.classList.add('urgent');
      wsSound.play('tick');
    }
    if (wsTimeRemaining <= 0) {
      wsClearTimers();
      wsHandleTimeout();
    }
  }, 1000);
}

// ── Load round ──────────────────────────────────────────────────
function wsLoadRound() {
  wsPhase       = 'active';
  wsCurrentRound = wsGameRounds[wsRoundIdx];
  wsLockHandles = new Array(wsPlayerCount).fill(null);

  wsQuestionCounter.textContent = `${wsRoundIdx + 1} / ${TOTAL_ROUNDS}`;
  wsProblemStatus.textContent   = '';
  wsProblemTimer.classList.remove('urgent');

  wsRenderHint();
  wsResetBtnsForRound();
  wsStartCountdown();
}

// ── Next round ─────────────────────────────────────────────────
function wsNextRound() {
  wsRoundIdx++;
  if (wsRoundIdx >= TOTAL_ROUNDS) {
    wsShowResult();
  } else {
    wsLoadRound();
  }
}

// ── Start game ─────────────────────────────────────────────────
function wsStartGame() {
  wsGameRounds  = wsBuildGameRounds();
  wsRoundIdx    = 0;
  wsScores      = new Array(wsPlayerCount).fill(0);
  wsRoundLog    = [];
  wsProgress    = new Array(wsPlayerCount).fill(0);
  wsLockHandles = new Array(wsPlayerCount).fill(null);
  wsDone        = new Array(wsPlayerCount).fill(false);
  wsPhase       = 'idle';

  wsClearTimers();
  wsBuildZones();
  wsBuildScoreBar();
  wsShowScreen(wsGameScreen);
  wsLoadRound();
}

// ── Show result ────────────────────────────────────────────────
function wsShowResult() {
  wsClearTimers();
  wsPhase = 'idle';
  wsSound.play('fanfare');

  const maxScore = Math.max.apply(null, wsScores);
  const winners  = wsScores
    .map(function(s, i) { return { s: s, i: i }; })
    .filter(function(x) { return x.s === maxScore; })
    .map(function(x) { return x.i; });

  if (maxScore === 0) {
    wsResultTitle.textContent  = '무승부!';
    wsResultWinner.textContent = '아무도 완성하지 못했어요.';
  } else if (winners.length === 1) {
    const w = winners[0];
    wsResultTitle.textContent  = '게임 종료!';
    wsResultWinner.textContent = `${PLAYER_CONFIG[w].label} 승리! (${maxScore}점)`;
  } else {
    const labels = winners.map(function(w) { return PLAYER_CONFIG[w].label; }).join(', ');
    wsResultTitle.textContent  = '동점!';
    wsResultWinner.textContent = `${labels} 공동 1위! (${maxScore}점)`;
  }

  // Table header
  const headRow = document.createElement('tr');
  headRow.innerHTML = '<th>라운드</th>' +
    Array.from({ length: wsPlayerCount }, function(_, i) {
      return `<th><span class="player-dot" style="background:${PLAYER_CONFIG[i].dot}"></span>${PLAYER_CONFIG[i].label}</th>`;
    }).join('');
  wsResultTableHead.innerHTML = '';
  wsResultTableHead.appendChild(headRow);

  // Table body
  wsResultTableBody.innerHTML = '';
  wsRoundLog.forEach(function(log, idx) {
    const tr = document.createElement('tr');
    let cells = `<td style="text-align:left;font-size:0.82rem;">${idx + 1}. ${log.word}</td>`;

    for (let i = 0; i < wsPlayerCount; i++) {
      if (log.winnerIdx === i) {
        cells += `<td class="cell-win">+1</td>`;
      } else if (log.timedOut) {
        cells += `<td class="cell-timeout">시간초과</td>`;
      } else {
        cells += `<td class="cell-none">—</td>`;
      }
    }
    tr.innerHTML = cells;
    wsResultTableBody.appendChild(tr);
  });

  // Total chips
  wsTotalRow.innerHTML = '';
  for (let i = 0; i < wsPlayerCount; i++) {
    const cfg   = PLAYER_CONFIG[i];
    const isWin = winners.includes(i) && maxScore > 0;
    const chip  = document.createElement('div');
    chip.className = 'total-chip';
    chip.innerHTML = `
      <span class="chip-dot" style="background:${cfg.dot}"></span>
      <span>${cfg.label}</span>
      <span class="chip-score" style="color:${isWin ? '#2E7D32' : '#555'}">${wsScores[i]}점</span>
      ${isWin ? '<span style="font-size:1.1rem;">★</span>' : ''}
    `;
    wsTotalRow.appendChild(chip);
  }

  wsShowScreen(wsResultScreen);
}
