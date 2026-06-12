/* games/rule-find/game.js */
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

// ── Rule definitions ─────────────────────────────────────────
// 라운드별 규칙 유형 계획 (8라운드 점증)
// 1~3: 단순 ×a 또는 +a
// 4~6: ×a+b 복합
// 7~8: 자릿수 뒤집기 / 제곱 같은 비산술적 규칙

// 규칙 유형 정의
// type: 'mul' | 'add' | 'muladd' | 'reverse_digits' | 'square'
const RULE_TYPES_BY_ROUND = [
  'mul', 'add', 'mul', 'add', 'muladd', 'muladd', 'reverse_digits', 'square'
];

// 각 유형별 규칙 파라미터 범위
function generateRuleByType(ruleType) {
  if (ruleType === 'mul') {
    const a = randInt(4) + 2; // 2~5
    return {
      type: 'mul',
      a,
      label: `×${a}`,
      apply: function(x) { return x * a; }
    };
  }
  if (ruleType === 'add') {
    const a = randInt(9) + 2; // 2~10
    return {
      type: 'add',
      a,
      label: `+${a}`,
      apply: function(x) { return x + a; }
    };
  }
  if (ruleType === 'muladd') {
    const a = randInt(3) + 2; // 2~4
    const b = randInt(5) + 1; // 1~5
    return {
      type: 'muladd',
      a,
      b,
      label: `×${a}+${b}`,
      apply: function(x) { return x * a + b; }
    };
  }
  if (ruleType === 'reverse_digits') {
    return {
      type: 'reverse_digits',
      label: '자릿수 뒤집기',
      apply: function(x) {
        return parseInt(String(x).split('').reverse().join(''), 10);
      }
    };
  }
  if (ruleType === 'square') {
    return {
      type: 'square',
      label: '제곱',
      apply: function(x) { return x * x; }
    };
  }
  return null;
}

// 모든 규칙 후보를 생성 (유일성 검증용)
function getAllCandidateRules() {
  const rules = [];
  // +a (1~20)
  for (let a = 1; a <= 20; a++) {
    rules.push({ type: 'add', a, apply: function(a) { return function(x) { return x + a; }; }(a) });
  }
  // ×a (2~10)
  for (let a = 2; a <= 10; a++) {
    rules.push({ type: 'mul', a, apply: function(a) { return function(x) { return x * a; }; }(a) });
  }
  // ×a+b (2~5, 1~9)
  for (let a = 2; a <= 5; a++) {
    for (let b = 1; b <= 9; b++) {
      rules.push({ type: 'muladd', a, b, apply: function(a, b) { return function(x) { return x * a + b; }; }(a, b) });
    }
  }
  // 자릿수 뒤집기
  rules.push({ type: 'reverse_digits', apply: function(x) { return parseInt(String(x).split('').reverse().join(''), 10); } });
  // 제곱
  rules.push({ type: 'square', apply: function(x) { return x * x; } });
  return rules;
}

// 예시 쌍(입력, 출력)을 받아 유일성 검증
// pairs: [{input, output}, ...]
// targetRule: 출제 규칙
// 반환: 이 규칙 외에 모든 예시를 만족하는 다른 후보 수
function countAmbiguousRules(pairs, targetRule) {
  const candidates = getAllCandidateRules();
  let ambiguous = 0;
  for (let ci = 0; ci < candidates.length; ci++) {
    const c = candidates[ci];
    // 타겟과 타입+파라미터가 같으면 건너뜀
    if (c.type === targetRule.type && c.a === targetRule.a && c.b === targetRule.b) continue;
    // 모든 예시를 만족하는지
    let allMatch = true;
    for (let pi = 0; pi < pairs.length; pi++) {
      try {
        if (c.apply(pairs[pi].input) !== pairs[pi].output) { allMatch = false; break; }
      } catch (e) {
        allMatch = false; break;
      }
    }
    if (allMatch) ambiguous++;
  }
  return ambiguous;
}

// 입력값 범위 (규칙 유형에 따라)
function inputRangeForType(ruleType) {
  if (ruleType === 'reverse_digits') return [12, 13, 14, 21, 23, 31, 32, 41]; // 2자리 뒤집기 명확
  if (ruleType === 'square') return [2, 3, 4, 5, 6, 7];
  return [2, 3, 4, 5, 6, 7, 8, 9];
}

// 라운드 데이터 생성
// 예시 2~3쌍 + 질문 1개 (모두 다른 입력값)
function buildGameRounds() {
  const rounds = [];
  for (let ri = 0; ri < TOTAL_ROUNDS; ri++) {
    let round = null;
    let attempts = 0;
    while (!round && attempts < 200) {
      attempts++;
      const ruleType = RULE_TYPES_BY_ROUND[ri];
      const rule = generateRuleByType(ruleType);
      if (!rule) continue;

      const inputPool = shuffle(inputRangeForType(ruleType));
      const numExamples = (ri < 2) ? 2 : 3; // 초반 2개, 후반 3개 예시
      const totalNeeded = numExamples + 1; // 예시 + 질문
      if (inputPool.length < totalNeeded) continue;

      const selectedInputs = inputPool.slice(0, totalNeeded);

      // 출력값 계산
      let valid = true;
      const pairs = [];
      for (let k = 0; k < numExamples; k++) {
        let out;
        try { out = rule.apply(selectedInputs[k]); } catch (e) { valid = false; break; }
        if (!Number.isFinite(out) || out < 0 || out > 9999) { valid = false; break; }
        pairs.push({ input: selectedInputs[k], output: out });
      }
      if (!valid) continue;

      const qInput = selectedInputs[numExamples];
      let qOutput;
      try { qOutput = rule.apply(qInput); } catch (e) { continue; }
      if (!Number.isFinite(qOutput) || qOutput < 0 || qOutput > 9999) continue;

      // 유일성 검증: 예시 쌍만으로 다른 규칙이 있는지 확인
      const ambig = countAmbiguousRules(pairs, rule);
      if (ambig > 0) continue; // 모호 → 재생성

      // 4지선다 오답 생성 (다른 그럴듯한 규칙의 결과값)
      const wrongAnswers = generateWrongAnswers(qInput, qOutput, pairs, rule);
      if (wrongAnswers.length < 3) continue;

      rounds.push({
        rule,
        pairs,
        qInput,
        qOutput,
        wrongAnswers: wrongAnswers.slice(0, 3),
        ruleType,
      });
      round = rounds[rounds.length - 1];
    }
    // 최대 시도 후 실패하면 간단한 규칙으로 폴백
    if (!round) {
      const a = randInt(4) + 2;
      const rule = { type: 'mul', a, label: `×${a}`, apply: function(x) { return x * a; } };
      const pairs = [{ input: 3, output: 3 * a }, { input: 5, output: 5 * a }];
      const qInput = 7;
      const qOutput = 7 * a;
      const wrongAnswers = [qOutput + 1, qOutput + 2, qOutput - 1].filter(v => v !== qOutput && v > 0);
      rounds.push({ rule, pairs, qInput, qOutput, wrongAnswers, ruleType: 'mul' });
    }
  }
  return rounds;
}

function generateWrongAnswers(qInput, qOutput, pairs, targetRule) {
  const candidates = getAllCandidateRules();
  const wrongs = new Set();

  for (let ci = 0; ci < candidates.length; ci++) {
    const c = candidates[ci];
    if (c.type === targetRule.type && c.a === targetRule.a && c.b === targetRule.b) continue;
    let wrongOut;
    try { wrongOut = c.apply(qInput); } catch (e) { continue; }
    if (!Number.isFinite(wrongOut) || wrongOut < 0 || wrongOut > 9999) continue;
    if (wrongOut === qOutput) continue;
    wrongs.add(wrongOut);
    if (wrongs.size >= 5) break;
  }

  // 충분하지 않으면 ±1, ±2 추가
  for (let d = 1; d <= 5 && wrongs.size < 3; d++) {
    if (qOutput - d > 0) wrongs.add(qOutput - d);
    wrongs.add(qOutput + d);
  }
  const arr = Array.from(wrongs).filter(v => v !== qOutput && v > 0);
  return shuffle(arr).slice(0, 3);
}

// ── Sound Manager ────────────────────────────────────────────
const rfSound = createSoundManager({
  ding(ctx) {
    [523, 659, 784].forEach((freq, i) => {
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
    [392, 494, 523, 659, 784].forEach((freq, i) => {
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
let rfPlayerCount   = 2;
let rfRoundIdx      = 0;
let rfScores        = [];
let rfRoundLog      = [];
let rfCurrentRound  = null;
let rfDqSet         = new Set();
let rfPhase         = 'idle';
let rfTimerHandle   = null;
let rfNextHandle    = null;
let rfTimeRemaining = ROUND_TIME;
let rfGameRounds    = [];
let rfChoiceOrder   = []; // 버튼 순서 (셔플된 인덱스)

// ── DOM refs ──────────────────────────────────────────────────
const rfIntroScreen     = document.getElementById('introScreen');
const rfCountdownScreen = document.getElementById('countdownScreen');
const rfCountdownNumber = document.getElementById('countdownNumber');
const rfGameScreen      = document.getElementById('gameScreen');
const rfResultScreen    = document.getElementById('resultScreen');

const rfBackBtn   = document.getElementById('backBtn');
const rfPlayBtn   = document.getElementById('playBtn');
const rfCloseBtn  = document.getElementById('closeBtn');
const rfRetryBtn  = document.getElementById('retryBtn');
const rfHomeBtn   = document.getElementById('homeBtn');

const rfZonesWrap       = document.getElementById('zonesWrap');
const rfQuestionCounter = document.getElementById('questionCounter');
const rfProblemTimer    = document.getElementById('problemTimer');
const rfProblemStatus   = document.getElementById('problemStatus');
const rfMagicRows       = document.getElementById('magicRows');
const rfScoreBar        = document.getElementById('scoreBar');

const rfSoundToggleIntro = document.getElementById('soundToggleIntro');

const rfResultTitle     = document.getElementById('resultTitle');
const rfResultWinner    = document.getElementById('resultWinner');
const rfResultTableHead = document.getElementById('resultTableHead');
const rfResultTableBody = document.getElementById('resultTableBody');
const rfTotalRow        = document.getElementById('totalRow');

// ── Helpers ───────────────────────────────────────────────────
function rfShowScreen(s) {
  [rfIntroScreen, rfCountdownScreen, rfGameScreen, rfResultScreen].forEach(x => x.classList.remove('active'));
  s.classList.add('active');
}

var rfCountdownInterval = null;
function rfStartPreGameCountdown(onDone) {
  rfShowScreen(rfCountdownScreen);
  var count = 3;
  rfCountdownNumber.textContent = count;
  rfCountdownInterval = setInterval(function() {
    count--;
    if (count <= 0) {
      clearInterval(rfCountdownInterval);
      rfCountdownInterval = null;
      onDone();
    } else {
      rfCountdownNumber.textContent = count;
      rfCountdownNumber.style.animation = 'none';
      rfCountdownNumber.offsetHeight; // reflow
      rfCountdownNumber.style.animation = '';
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

function randInt(n) {
  return Math.floor(Math.random() * n);
}

function rfClearTimers() {
  if (rfCountdownInterval) { clearInterval(rfCountdownInterval); rfCountdownInterval = null; }
  if (rfTimerHandle) { clearInterval(rfTimerHandle); rfTimerHandle = null; }
  if (rfNextHandle)  { clearTimeout(rfNextHandle);   rfNextHandle  = null; }
}

function rfUpdateSoundBtn(btn) {
  btn.textContent = rfSound.isMuted() ? '🔇' : '🔊';
}

// ── Intro illustration ─────────────────────────────────────────
(function renderRFIntroIllust() {
  const el = document.getElementById('introIllust');
  if (!el) return;
  el.innerHTML = `<svg viewBox="0 0 220 130" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="6" width="208" height="118" rx="16" fill="#FFF8E1" stroke="#2C2C2C" stroke-width="3"/>
    <rect x="16" y="40" width="50" height="50" rx="10" fill="#E8EAF6" stroke="#2C2C2C" stroke-width="3" box-shadow="3px 3px 0 #2C2C2C"/>
    <text x="41" y="72" text-anchor="middle" font-size="22" font-weight="900" fill="#1A237E">3</text>
    <text x="75" y="72" text-anchor="middle" font-size="18" fill="#555">→</text>
    <text x="100" y="52" text-anchor="middle" font-size="34">📦</text>
    <text x="132" y="72" text-anchor="middle" font-size="18" fill="#555">→</text>
    <rect x="150" y="40" width="50" height="50" rx="10" fill="#E8EAF6" stroke="#2C2C2C" stroke-width="3"/>
    <text x="175" y="72" text-anchor="middle" font-size="22" font-weight="900" fill="#5E35B1">6</text>
    <text x="110" y="108" text-anchor="middle" font-size="12" font-weight="800" fill="#5E35B1">규칙: ×2</text>
  </svg>`;
})();

// ── Player count selection ─────────────────────────────────────
document.querySelectorAll('.player-btn').forEach(function(btn) {
  onTap(btn, function() {
    document.querySelectorAll('.player-btn').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    rfPlayerCount = parseInt(btn.dataset.count, 10);
  });
});

// ── Sound toggle ───────────────────────────────────────────────
onTap(rfSoundToggleIntro, function() {
  rfSound.toggleMute();
  rfUpdateSoundBtn(rfSoundToggleIntro);
});
rfUpdateSoundBtn(rfSoundToggleIntro);

// ── Navigation ────────────────────────────────────────────────
onTap(rfBackBtn,  function() { goHome(); });
onTap(rfCloseBtn, function() { rfClearTimers(); goHome(); });
onTap(rfHomeBtn,  function() { goHome(); });
onTap(rfRetryBtn, function() { rfStartPreGameCountdown(function() { rfStartGame(); }); });
onTap(rfPlayBtn,  function() { rfStartPreGameCountdown(function() { rfStartGame(); }); });

// ── Problem panel ──────────────────────────────────────────────
function rfRenderMagicRows() {
  const r = rfCurrentRound;
  rfMagicRows.innerHTML = '';

  // 예시 컬럼
  const exCol = document.createElement('div');
  exCol.className = 'magic-examples';
  r.pairs.forEach(function(pair) {
    const row = document.createElement('div');
    row.className = 'magic-row';
    row.innerHTML = `
      <div class="magic-num">${pair.input}</div>
      <div class="magic-arrow">→</div>
      <div class="magic-box-img">📦</div>
      <div class="magic-arrow">→</div>
      <div class="magic-num">${pair.output}</div>
    `;
    exCol.appendChild(row);
  });
  rfMagicRows.appendChild(exCol);

  // 구분선
  const div = document.createElement('div');
  div.className = 'magic-divider';
  rfMagicRows.appendChild(div);

  // 질문 컬럼
  const qCol = document.createElement('div');
  qCol.className = 'magic-question';
  const qlabel = document.createElement('div');
  qlabel.className = 'magic-qlabel';
  qlabel.textContent = '이걸 넣으면?';
  const qrow = document.createElement('div');
  qrow.className = 'magic-qrow';
  qrow.innerHTML = `
    <div class="magic-num question-num">${r.qInput}</div>
    <div class="magic-arrow">→</div>
    <div class="magic-box-img">📦</div>
    <div class="magic-arrow">→</div>
    <div class="magic-num question-num">?</div>
  `;
  qCol.appendChild(qlabel);
  qCol.appendChild(qrow);
  rfMagicRows.appendChild(qCol);
}

// ── Build zones ────────────────────────────────────────────────
function rfBuildZones() {
  rfZonesWrap.innerHTML = '';
  rfZonesWrap.className = `zones-wrap p${rfPlayerCount}`;

  for (let i = 0; i < rfPlayerCount; i++) {
    const cfg  = PLAYER_CONFIG[i];
    const zone = document.createElement('div');
    zone.className = `zone ${cfg.cls}`;
    zone.dataset.player = i;

    const header = document.createElement('div');
    header.className = 'zone-header';
    header.innerHTML = `
      <span class="zone-label">${cfg.label}</span>
      <span class="zone-score-chip" id="rf-score-chip-${i}">0점</span>
    `;

    const grid = document.createElement('div');
    grid.className = 'choice-grid';
    grid.id = `rf-choice-grid-${i}`;

    for (let s = 0; s < 4; s++) {
      const btn = document.createElement('button');
      btn.className = 'choice-btn';
      btn.dataset.player = String(i);
      btn.dataset.slot = String(s);
      btn.setAttribute('aria-label', `${cfg.label} 보기 ${s + 1}`);
      onTap(btn, function(pi, b) { return function() { rfHandleAnswerTap(pi, b); }; }(i, btn));
      grid.appendChild(btn);
    }

    zone.appendChild(header);
    zone.appendChild(grid);
    rfZonesWrap.appendChild(zone);
  }
}

function rfGetZone(idx) {
  return rfZonesWrap.querySelector(`.zone[data-player="${idx}"]`);
}

function rfGetChoiceBtns(playerIdx) {
  return rfZonesWrap.querySelectorAll(`.choice-btn[data-player="${playerIdx}"]`);
}

function rfUpdateScoreChip(playerIdx) {
  const chip = document.getElementById(`rf-score-chip-${playerIdx}`);
  if (chip) chip.textContent = `${rfScores[playerIdx]}점`;
}

// ── Score bar ──────────────────────────────────────────────────
function rfBuildScoreBar() {
  rfScoreBar.innerHTML = '';
  for (let i = 0; i < rfPlayerCount; i++) {
    const cfg  = PLAYER_CONFIG[i];
    const chip = document.createElement('div');
    chip.className = 'score-chip';
    chip.innerHTML = `
      <span class="score-chip-dot" style="background:${cfg.dot}"></span>
      <span>${cfg.label}</span>
      <span class="score-chip-val" id="rf-bar-score-${i}">0</span>
    `;
    rfScoreBar.appendChild(chip);
  }
}

function rfUpdateBarScore(playerIdx) {
  const el = document.getElementById(`rf-bar-score-${playerIdx}`);
  if (el) el.textContent = rfScores[playerIdx];
}

// ── Reset buttons for round ─────────────────────────────────────
function rfResetBtnsForRound() {
  const r = rfCurrentRound;
  // 보기 순서: 정답 + 오답3 섞기
  const options = [r.qOutput, r.wrongAnswers[0], r.wrongAnswers[1], r.wrongAnswers[2]];
  rfChoiceOrder = shuffle([0, 1, 2, 3]); // options 인덱스 순서

  for (let i = 0; i < rfPlayerCount; i++) {
    const btns = rfGetChoiceBtns(i);
    btns.forEach(function(btn, s) {
      btn.className = 'choice-btn';
      btn.disabled = false;
      const optIdx = rfChoiceOrder[s];
      btn.textContent = String(options[optIdx]);
      btn.dataset.optIdx = String(optIdx);
    });
    const zone = rfGetZone(i);
    if (zone) zone.classList.remove('dq-zone');
  }
}

function rfDisablePlayerBtns(playerIdx) {
  rfGetChoiceBtns(playerIdx).forEach(function(b) {
    b.classList.add('state-disabled');
    b.disabled = true;
  });
}

// ── Timer ──────────────────────────────────────────────────────
function rfStartCountdown() {
  rfTimeRemaining = ROUND_TIME;
  rfProblemTimer.textContent = rfTimeRemaining;
  rfProblemTimer.classList.remove('urgent');

  rfTimerHandle = setInterval(function() {
    rfTimeRemaining--;
    rfProblemTimer.textContent = rfTimeRemaining;

    if (rfTimeRemaining <= 5) {
      rfProblemTimer.classList.add('urgent');
      rfSound.play('tick');
    }
    if (rfTimeRemaining <= 0) {
      rfClearTimers();
      rfHandleTimeout();
    }
  }, 1000);
}

// ── Answer tap ─────────────────────────────────────────────────
function rfHandleAnswerTap(playerIdx, btn) {
  if (rfPhase !== 'active') return;
  if (rfDqSet.has(playerIdx)) return;

  const optIdx = parseInt(btn.dataset.optIdx, 10);
  // optIdx 0이 정답 (qOutput = options[0])
  const isCorrect = (optIdx === 0);

  if (isCorrect) {
    rfResolveRound(playerIdx);
  } else {
    rfSound.play('buzz');
    btn.classList.add('state-wrong');
    btn.textContent = '✗';

    rfDqSet.add(playerIdx);

    const zone = rfGetZone(playerIdx);
    const flash = document.createElement('div');
    flash.className = 'penalty-flash';
    flash.textContent = '실격!';
    zone.appendChild(flash);
    flash.addEventListener('animationend', function() { flash.remove(); });

    rfDisablePlayerBtns(playerIdx);
    zone.classList.add('dq-zone');

    let anyActive = false;
    for (let i = 0; i < rfPlayerCount; i++) {
      if (!rfDqSet.has(i)) { anyActive = true; break; }
    }
    if (!anyActive) {
      rfClearTimers();
      rfNextHandle = setTimeout(function() { rfHandleTimeout(); }, 300);
    }
  }
}

// ── Correct resolved ────────────────────────────────────────────
function rfResolveRound(winnerIdx) {
  rfPhase = 'done';
  rfClearTimers();
  rfSound.play('ding');

  rfScores[winnerIdx]++;
  rfUpdateScoreChip(winnerIdx);
  rfUpdateBarScore(winnerIdx);

  rfGetChoiceBtns(winnerIdx).forEach(function(b) {
    if (parseInt(b.dataset.optIdx, 10) === 0) {
      b.classList.add('state-correct');
    } else {
      b.classList.add('state-disabled');
      b.disabled = true;
    }
  });

  for (let i = 0; i < rfPlayerCount; i++) {
    if (i !== winnerIdx) rfDisablePlayerBtns(i);
  }

  const wLabel = PLAYER_CONFIG[winnerIdx].label;
  rfProblemStatus.textContent = `${wLabel} 정답! (${rfCurrentRound.qOutput})`;

  rfRoundLog.push({
    qInput: rfCurrentRound.qInput,
    qOutput: rfCurrentRound.qOutput,
    winnerIdx,
    dqPlayers: Array.from(rfDqSet),
    timedOut: false,
  });

  rfNextHandle = setTimeout(function() { rfNextRound(); }, RESULT_PAUSE_MS);
}

// ── Timeout ────────────────────────────────────────────────────
function rfHandleTimeout() {
  rfPhase = 'done';
  rfClearTimers();
  rfSound.play('timeout');

  for (let i = 0; i < rfPlayerCount; i++) {
    rfGetChoiceBtns(i).forEach(function(b) {
      if (parseInt(b.dataset.optIdx, 10) === 0) {
        b.classList.remove('state-disabled');
        b.classList.add('state-reveal');
      } else {
        b.classList.add('state-disabled');
      }
      b.disabled = true;
    });
    const zone = rfGetZone(i);
    if (zone) zone.classList.remove('dq-zone');
  }

  rfProblemStatus.textContent = `정답: ${rfCurrentRound.qOutput}`;

  rfRoundLog.push({
    qInput: rfCurrentRound.qInput,
    qOutput: rfCurrentRound.qOutput,
    winnerIdx: -1,
    dqPlayers: Array.from(rfDqSet),
    timedOut: true,
  });

  rfNextHandle = setTimeout(function() { rfNextRound(); }, RESULT_PAUSE_MS);
}

// ── Load round ──────────────────────────────────────────────────
function rfLoadRound() {
  rfPhase       = 'active';
  rfCurrentRound = rfGameRounds[rfRoundIdx];
  rfDqSet       = new Set();

  rfQuestionCounter.textContent = `${rfRoundIdx + 1} / ${TOTAL_ROUNDS}`;
  rfProblemStatus.textContent   = '';
  rfProblemTimer.classList.remove('urgent');

  rfRenderMagicRows();
  rfResetBtnsForRound();
  rfStartCountdown();
}

// ── Next round ─────────────────────────────────────────────────
function rfNextRound() {
  rfRoundIdx++;
  if (rfRoundIdx >= TOTAL_ROUNDS) {
    rfShowResult();
  } else {
    rfLoadRound();
  }
}

// ── Start game ─────────────────────────────────────────────────
function rfStartGame() {
  rfGameRounds  = buildGameRounds();
  rfRoundIdx    = 0;
  rfScores      = new Array(rfPlayerCount).fill(0);
  rfRoundLog    = [];
  rfDqSet       = new Set();
  rfPhase       = 'idle';

  rfClearTimers();
  rfBuildZones();
  rfBuildScoreBar();
  rfShowScreen(rfGameScreen);
  rfLoadRound();
}

// ── Show result ────────────────────────────────────────────────
function rfShowResult() {
  rfClearTimers();
  rfPhase = 'idle';
  rfSound.play('fanfare');

  const maxScore = Math.max.apply(null, rfScores);
  const winners  = rfScores
    .map(function(s, i) { return { s, i }; })
    .filter(function(x) { return x.s === maxScore; })
    .map(function(x) { return x.i; });

  if (maxScore === 0) {
    rfResultTitle.textContent  = '무승부!';
    rfResultWinner.textContent = '아무도 점수를 얻지 못했어요.';
  } else if (winners.length === 1) {
    const w = winners[0];
    rfResultTitle.textContent  = '게임 종료!';
    rfResultWinner.textContent = `${PLAYER_CONFIG[w].label} 승리! (${maxScore}점)`;
  } else {
    const labels = winners.map(function(w) { return PLAYER_CONFIG[w].label; }).join(', ');
    rfResultTitle.textContent  = '동점!';
    rfResultWinner.textContent = `${labels} 공동 1위! (${maxScore}점)`;
  }

  // Table header
  const headRow = document.createElement('tr');
  headRow.innerHTML = '<th>라운드</th>' +
    Array.from({ length: rfPlayerCount }, function(_, i) {
      return `<th><span class="player-dot" style="background:${PLAYER_CONFIG[i].dot}"></span>${PLAYER_CONFIG[i].label}</th>`;
    }).join('');
  rfResultTableHead.innerHTML = '';
  rfResultTableHead.appendChild(headRow);

  // Table body
  rfResultTableBody.innerHTML = '';
  rfRoundLog.forEach(function(log, idx) {
    const tr = document.createElement('tr');
    let cells = `<td style="text-align:left;font-size:0.82rem;">${idx + 1}. ${log.qInput}→?<br><span style="font-size:0.72rem;color:#888">정답 ${log.qOutput}</span></td>`;

    for (let i = 0; i < rfPlayerCount; i++) {
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
    rfResultTableBody.appendChild(tr);
  });

  // Total chips
  rfTotalRow.innerHTML = '';
  for (let i = 0; i < rfPlayerCount; i++) {
    const cfg   = PLAYER_CONFIG[i];
    const isWin = winners.includes(i) && maxScore > 0;
    const chip  = document.createElement('div');
    chip.className = 'total-chip';
    chip.innerHTML = `
      <span class="chip-dot" style="background:${cfg.dot}"></span>
      <span>${cfg.label}</span>
      <span class="chip-score" style="color:${isWin ? '#2E7D32' : '#555'}">${rfScores[i]}점</span>
      ${isWin ? '<span style="font-size:1.1rem;">★</span>' : ''}
    `;
    rfTotalRow.appendChild(chip);
  }

  rfShowScreen(rfResultScreen);
}
