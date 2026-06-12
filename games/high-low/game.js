/* games/high-low/game.js */

'use strict';

// ── Constants ────────────────────────────────────────────────
const TOTAL_ROUNDS    = 8;
const RESULT_PAUSE_MS = getAutoplayPauseMs(2000);

// 라운드별 난이도 계획
// phase: 1=한자리(1-9, 차이≥3, 5초), 2=두자리(10-99, 차이≥5, 4초), 3=두자리(차이≥1, 3초)
const ROUND_PLAN = [
  { phase: 1, timeLimit: 5 },
  { phase: 1, timeLimit: 5 },
  { phase: 2, timeLimit: 4 },
  { phase: 2, timeLimit: 4 },
  { phase: 2, timeLimit: 4 },
  { phase: 3, timeLimit: 3 },
  { phase: 3, timeLimit: 3 },
  { phase: 3, timeLimit: 3 },
];

// 라운드당 문항 수
const ITEMS_PER_ROUND = 5;

const PLAYER_CONFIG = [
  { label: 'P1', dot: '#0288D1', cls: 'p1' },
  { label: 'P2', dot: '#E53935', cls: 'p2' },
  { label: 'P3', dot: '#388E3C', cls: 'p3' },
  { label: 'P4', dot: '#F57C00', cls: 'p4' },
];

// ── Sound Manager ────────────────────────────────────────────
const hlSound = createSoundManager({
  ding(ctx) {
    [523, 659, 784].forEach((freq, i) => {
      const osc  = ctx.createOscillator();
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
    const osc  = ctx.createOscillator();
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
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160, ctx.currentTime);
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.5);
  },
  tick(ctx) {
    const osc  = ctx.createOscillator();
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
      const osc  = ctx.createOscillator();
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

// ── State ────────────────────────────────────────────────────
let hlPlayerCount   = 2;
let hlRoundIdx      = 0;
let hlScores        = [];
let hlRoundLog      = [];
let hlDqSet         = new Set();
let hlPhase         = 'idle';
let hlTimerHandle   = null;
let hlNextHandle    = null;
let hlTimeRemaining = 5;

// 현재 라운드 문항 목록
let hlItems         = [];    // [{ prev, next, answer:'up'|'down' }, ...]
let hlItemIdx       = 0;
let hlItemDqSets    = [];    // dq per item
// 라운드 내 점수 (문항당 정답자 기록)
let hlRoundScores   = [];    // per player score in this round

// ── DOM refs ─────────────────────────────────────────────────
const hlIntroScreen     = document.getElementById('introScreen');
const hlCountdownScreen = document.getElementById('countdownScreen');
const hlCountdownNumber = document.getElementById('countdownNumber');
const hlGameScreen      = document.getElementById('gameScreen');
const hlResultScreen    = document.getElementById('resultScreen');

const hlBackBtn   = document.getElementById('backBtn');
const hlPlayBtn   = document.getElementById('playBtn');
const hlCloseBtn  = document.getElementById('closeBtn');
const hlRetryBtn  = document.getElementById('retryBtn');
const hlHomeBtn   = document.getElementById('homeBtn');

const hlZonesWrap       = document.getElementById('zonesWrap');
const hlQuestionCounter = document.getElementById('questionCounter');
const hlProblemTimer    = document.getElementById('problemTimer');
const hlPrevNum         = document.getElementById('prevNum');
const hlNewNum          = document.getElementById('newNum');
const hlProblemStatus   = document.getElementById('problemStatus');
const hlScoreBar        = document.getElementById('scoreBar');

const hlSoundToggle     = document.getElementById('soundToggleIntro');

const hlResultTitle     = document.getElementById('resultTitle');
const hlResultWinner    = document.getElementById('resultWinner');
const hlResultTableHead = document.getElementById('resultTableHead');
const hlResultTableBody = document.getElementById('resultTableBody');
const hlTotalRow        = document.getElementById('totalRow');

// ── Helpers ──────────────────────────────────────────────────
function hlShowScreen(s) {
  [hlIntroScreen, hlCountdownScreen, hlGameScreen, hlResultScreen]
    .forEach(x => x.classList.remove('active'));
  s.classList.add('active');
}

var hlCountdownInterval = null;
function hlStartPreCountdown(onDone) {
  hlShowScreen(hlCountdownScreen);
  var count = 3;
  hlCountdownNumber.textContent = count;
  hlCountdownInterval = setInterval(function() {
    count--;
    if (count <= 0) {
      clearInterval(hlCountdownInterval);
      hlCountdownInterval = null;
      onDone();
    } else {
      hlCountdownNumber.textContent = count;
      hlCountdownNumber.style.animation = 'none';
      hlCountdownNumber.offsetHeight;
      hlCountdownNumber.style.animation = '';
    }
  }, 1000);
}

function hlClearTimers() {
  if (hlCountdownInterval) { clearInterval(hlCountdownInterval); hlCountdownInterval = null; }
  if (hlTimerHandle) { clearInterval(hlTimerHandle); hlTimerHandle = null; }
  if (hlNextHandle)  { clearTimeout(hlNextHandle);   hlNextHandle  = null; }
}

function hlUpdateSoundBtn() {
  hlSoundToggle.textContent = hlSound.isMuted() ? '🔇' : '🔊';
}

function hlRandInt(n) {
  return Math.floor(Math.random() * n);
}

// 두 수가 다르고 같은 수 연속 없음을 보장하는 문항 생성
function hlGenerateItem(phaseNum, prevValue) {
  let prev, next, minDiff;
  if (phaseNum === 1) {
    // 한 자리: 1~9, 차이 ≥ 2
    minDiff = 2;
    let attempts = 0;
    do {
      prev = 1 + hlRandInt(9);
      next = 1 + hlRandInt(9);
      attempts++;
    } while (next === prev || Math.abs(next - prev) < minDiff || (prevValue !== undefined && prev === prevValue) || attempts > 100);
  } else if (phaseNum === 2) {
    // 두 자리: 10~99, 차이 ≥ 5
    minDiff = 5;
    let attempts = 0;
    do {
      prev = 10 + hlRandInt(90);
      next = 10 + hlRandInt(90);
      attempts++;
    } while (next === prev || Math.abs(next - prev) < minDiff || (prevValue !== undefined && prev === prevValue) || attempts > 100);
  } else {
    // 두 자리: 10~99, 차이 ≥ 1 (어려움)
    let attempts = 0;
    do {
      prev = 10 + hlRandInt(90);
      next = 10 + hlRandInt(90);
      attempts++;
    } while (next === prev || (prevValue !== undefined && prev === prevValue) || attempts > 100);
  }
  const answer = next > prev ? 'up' : 'down';
  return { prev, next, answer };
}

function hlGenerateItems(phaseNum) {
  const items = [];
  let lastNext;
  for (let i = 0; i < ITEMS_PER_ROUND; i++) {
    const item = hlGenerateItem(phaseNum, lastNext);
    items.push(item);
    lastNext = item.next;
  }
  return items;
}

// ── Intro illustration ───────────────────────────────────────
(function() {
  const el = document.getElementById('introIllust');
  if (el) {
    el.innerHTML = `<svg viewBox="0 0 220 110" xmlns="http://www.w3.org/2000/svg">
      <rect x="6" y="6" width="208" height="98" rx="16" fill="#FFF8E1" stroke="#2C2C2C" stroke-width="3"/>
      <rect x="22" y="20" width="54" height="54" rx="10" fill="#E8F5E9" stroke="#2C2C2C" stroke-width="3"/>
      <text x="49" y="57" text-anchor="middle" font-size="26" font-weight="900">7</text>
      <text x="100" y="55" text-anchor="middle" font-size="22" fill="rgba(255,255,255,0.9)">→</text>
      <rect x="136" y="20" width="54" height="54" rx="10" fill="#E8F5E9" stroke="#43A047" stroke-width="3"/>
      <text x="163" y="57" text-anchor="middle" font-size="26" font-weight="900">12</text>
      <text x="110" y="92" text-anchor="middle" font-size="13" font-weight="900" fill="#43A047">⬆ 크면 위!</text>
    </svg>`;
  }
})();

// ── Player count selection ───────────────────────────────────
document.querySelectorAll('.player-btn').forEach(function(btn) {
  onTap(btn, function() {
    document.querySelectorAll('.player-btn').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    hlPlayerCount = parseInt(btn.dataset.count, 10);
  });
});

// ── Sound toggle ─────────────────────────────────────────────
onTap(hlSoundToggle, function() {
  hlSound.toggleMute();
  hlUpdateSoundBtn();
});
hlUpdateSoundBtn();

// ── Navigation ───────────────────────────────────────────────
onTap(hlBackBtn,  function() { goHome(); });
onTap(hlCloseBtn, function() { hlClearTimers(); goHome(); });
onTap(hlHomeBtn,  function() { goHome(); });
onTap(hlRetryBtn, function() { hlStartPreCountdown(function() { hlStartGame(); }); });
onTap(hlPlayBtn,  function() { hlStartPreCountdown(function() { hlStartGame(); }); });

// ── Build zones ──────────────────────────────────────────────
function hlBuildZones() {
  hlZonesWrap.innerHTML = '';
  hlZonesWrap.className = 'zones-wrap p' + hlPlayerCount;

  for (let i = 0; i < hlPlayerCount; i++) {
    const cfg  = PLAYER_CONFIG[i];
    const zone = document.createElement('div');
    zone.className = 'zone ' + cfg.cls;
    zone.dataset.player = i;

    const header = document.createElement('div');
    header.className = 'zone-header';
    header.innerHTML =
      '<span class="zone-label">' + cfg.label + '</span>' +
      '<span class="zone-score-chip" id="hl-score-chip-' + i + '">0점</span>';

    const btnGroup = document.createElement('div');
    btnGroup.className = 'hl-btn-group';

    const upBtn = document.createElement('button');
    upBtn.className = 'hl-btn hl-btn-up';
    upBtn.dataset.player = i;
    upBtn.dataset.dir = 'up';
    upBtn.setAttribute('aria-label', cfg.label + ' 위로(크다)');
    upBtn.textContent = '⬆';
    onTap(upBtn, function() { hlHandleTap(i, 'up', upBtn); });

    const downBtn = document.createElement('button');
    downBtn.className = 'hl-btn hl-btn-down';
    downBtn.dataset.player = i;
    downBtn.dataset.dir = 'down';
    downBtn.setAttribute('aria-label', cfg.label + ' 아래로(작다)');
    downBtn.textContent = '⬇';
    onTap(downBtn, function() { hlHandleTap(i, 'down', downBtn); });

    btnGroup.appendChild(upBtn);
    btnGroup.appendChild(downBtn);

    zone.appendChild(header);
    zone.appendChild(btnGroup);
    hlZonesWrap.appendChild(zone);
  }
}

function hlGetZone(idx) {
  return hlZonesWrap.querySelector('.zone[data-player="' + idx + '"]');
}

function hlGetBtns(playerIdx) {
  const zone = hlGetZone(playerIdx);
  return zone ? Array.from(zone.querySelectorAll('.hl-btn')) : [];
}

function hlUpdateScoreChip(playerIdx) {
  const chip = document.getElementById('hl-score-chip-' + playerIdx);
  if (chip) chip.textContent = hlScores[playerIdx] + '점';
}

// ── Score bar ────────────────────────────────────────────────
function hlBuildScoreBar() {
  hlScoreBar.innerHTML = '';
  for (let i = 0; i < hlPlayerCount; i++) {
    const cfg  = PLAYER_CONFIG[i];
    const chip = document.createElement('div');
    chip.className = 'score-chip';
    chip.innerHTML =
      '<span class="score-chip-dot" style="background:' + cfg.dot + '"></span>' +
      '<span>' + cfg.label + '</span>' +
      '<span class="score-chip-val" id="hl-bar-score-' + i + '">0</span>';
    hlScoreBar.appendChild(chip);
  }
}

function hlUpdateBarScore(playerIdx) {
  const el = document.getElementById('hl-bar-score-' + playerIdx);
  if (el) el.textContent = hlScores[playerIdx];
}

// ── Reset buttons for new item ────────────────────────────────
function hlResetItemBtns() {
  for (let i = 0; i < hlPlayerCount; i++) {
    hlGetBtns(i).forEach(function(btn) {
      btn.className = 'hl-btn ' + (btn.dataset.dir === 'up' ? 'hl-btn-up' : 'hl-btn-down');
      btn.disabled = false;
    });
    const zone = hlGetZone(i);
    if (zone) zone.classList.remove('dq-zone');
  }
  hlDqSet = new Set();
}

function hlDisablePlayerBtns(playerIdx) {
  hlGetBtns(playerIdx).forEach(function(btn) {
    btn.classList.add('state-disabled');
    btn.disabled = true;
  });
}

// ── Timer ─────────────────────────────────────────────────────
function hlStartItemTimer() {
  const plan = ROUND_PLAN[hlRoundIdx];
  hlTimeRemaining = plan.timeLimit;
  hlProblemTimer.textContent = hlTimeRemaining;
  hlProblemTimer.classList.remove('urgent');

  hlTimerHandle = setInterval(function() {
    hlTimeRemaining--;
    hlProblemTimer.textContent = hlTimeRemaining;
    if (hlTimeRemaining <= 2 && hlTimeRemaining > 0) {
      hlProblemTimer.classList.add('urgent');
      hlSound.play('tick');
    }
    if (hlTimeRemaining <= 0) {
      hlClearTimers();
      hlHandleItemTimeout();
    }
  }, 1000);
}

// ── Tap handler ───────────────────────────────────────────────
function hlHandleTap(playerIdx, dir, btn) {
  if (hlPhase !== 'item-active') return;
  if (hlDqSet.has(playerIdx)) return;

  const currentItem = hlItems[hlItemIdx];

  if (dir === currentItem.answer) {
    // 정답
    hlSound.play('ding');
    btn.classList.add('state-correct');
    hlDqSet.add(playerIdx); // 이 문항에서 이미 맞힘 — 중복 방지
    hlScores[playerIdx]++;
    hlRoundScores[playerIdx]++;
    hlUpdateScoreChip(playerIdx);
    hlUpdateBarScore(playerIdx);

    // 그 플레이어의 다른 버튼 비활성
    hlGetBtns(playerIdx).forEach(function(b) {
      if (b !== btn) { b.classList.add('state-disabled'); b.disabled = true; }
    });

    // 모두 답했으면 바로 다음 문항
    if (hlAllAnswered()) {
      hlClearTimers();
      hlNextHandle = setTimeout(function() { hlNextItem(); }, 600);
    }
  } else {
    // 오답: 그 문항 실격
    hlSound.play('buzz');
    btn.classList.add('state-wrong');
    hlDqSet.add(playerIdx);

    const zone = hlGetZone(playerIdx);
    const flash = document.createElement('div');
    flash.className = 'penalty-flash';
    flash.textContent = '실격!';
    zone.appendChild(flash);
    flash.addEventListener('animationend', function() { flash.remove(); });

    hlDisablePlayerBtns(playerIdx);
    zone.classList.add('dq-zone');

    // 전원 실격 시 타임아웃 처리
    let anyActive = false;
    for (let i = 0; i < hlPlayerCount; i++) {
      if (!hlDqSet.has(i)) { anyActive = true; break; }
    }
    if (!anyActive) {
      hlClearTimers();
      hlNextHandle = setTimeout(function() { hlHandleItemTimeout(); }, 300);
    }
  }
}

// 모든 플레이어가 이미 정답을 맞혔거나 실격인지 (= 아무도 남지 않음)
function hlAllAnswered() {
  for (let i = 0; i < hlPlayerCount; i++) {
    if (!hlDqSet.has(i)) return false;
  }
  return true;
}

// ── Item timeout ─────────────────────────────────────────────
function hlHandleItemTimeout() {
  hlSound.play('timeout');
  // 정답 버튼 공개
  const currentItem = hlItems[hlItemIdx];
  for (let i = 0; i < hlPlayerCount; i++) {
    hlGetBtns(i).forEach(function(btn) {
      if (btn.dataset.dir === currentItem.answer) {
        btn.classList.remove('state-disabled');
        btn.classList.add('state-reveal');
      } else {
        btn.classList.add('state-disabled');
      }
      btn.disabled = true;
    });
    const zone = hlGetZone(i);
    if (zone) zone.classList.remove('dq-zone');
  }
  hlProblemStatus.textContent = '⏰ 정답: ' + (currentItem.answer === 'up' ? '⬆ 크다' : '⬇ 작다') + ' (' + currentItem.prev + '→' + currentItem.next + ')';
  hlNextHandle = setTimeout(function() { hlNextItem(); }, 1200);
}

// ── Load item ─────────────────────────────────────────────────
function hlLoadItem() {
  hlPhase = 'item-active';
  const currentItem = hlItems[hlItemIdx];

  hlQuestionCounter.textContent = '라운드 ' + (hlRoundIdx + 1) + '/' + TOTAL_ROUNDS + '  문항 ' + (hlItemIdx + 1) + '/' + ITEMS_PER_ROUND;
  hlProblemStatus.textContent = '';
  hlProblemTimer.classList.remove('urgent');

  hlPrevNum.textContent = currentItem.prev;
  hlNewNum.textContent = currentItem.next;
  hlNewNum.classList.remove('num-reveal');
  // force reflow
  void hlNewNum.offsetWidth;
  hlNewNum.classList.add('num-reveal');

  hlResetItemBtns();
  hlStartItemTimer();
}

// ── Next item ─────────────────────────────────────────────────
function hlNextItem() {
  hlItemIdx++;
  if (hlItemIdx >= ITEMS_PER_ROUND) {
    hlEndRound();
  } else {
    hlLoadItem();
  }
}

// ── End round (log result, pause, next round) ─────────────────
function hlEndRound() {
  hlPhase = 'done';
  // 라운드 결과 로그: 이 라운드 각 플레이어가 얻은 점 기록
  hlRoundLog.push({
    roundIdx: hlRoundIdx,
    roundScores: hlRoundScores.slice(),
  });
  hlProblemStatus.textContent = '라운드 ' + (hlRoundIdx + 1) + ' 완료!';
  hlNextHandle = setTimeout(function() { hlNextRound(); }, RESULT_PAUSE_MS);
}

// ── Next round ────────────────────────────────────────────────
function hlNextRound() {
  hlRoundIdx++;
  if (hlRoundIdx >= TOTAL_ROUNDS) {
    hlShowResult();
  } else {
    hlStartRound();
  }
}

// ── Start round ───────────────────────────────────────────────
function hlStartRound() {
  const plan = ROUND_PLAN[hlRoundIdx];
  hlItems = hlGenerateItems(plan.phase);
  hlItemIdx = 0;
  hlRoundScores = new Array(hlPlayerCount).fill(0);
  hlDqSet = new Set();
  hlLoadItem();
}

// ── Start game ────────────────────────────────────────────────
function hlStartGame() {
  hlRoundIdx   = 0;
  hlScores     = new Array(hlPlayerCount).fill(0);
  hlRoundLog   = [];
  hlDqSet      = new Set();
  hlPhase      = 'idle';

  hlClearTimers();
  hlBuildZones();
  hlBuildScoreBar();
  hlShowScreen(hlGameScreen);
  hlStartRound();
}

// ── Show result ───────────────────────────────────────────────
function hlShowResult() {
  hlClearTimers();
  hlPhase = 'idle';
  hlSound.play('fanfare');

  const maxScore = Math.max.apply(null, hlScores);
  const winners  = hlScores
    .map(function(s, i) { return { s: s, i: i }; })
    .filter(function(x) { return x.s === maxScore; })
    .map(function(x) { return x.i; });

  if (maxScore === 0) {
    hlResultTitle.textContent  = '무승부!';
    hlResultWinner.textContent = '아무도 점수를 얻지 못했어요.';
  } else if (winners.length === 1) {
    const w = winners[0];
    hlResultTitle.textContent  = '게임 종료!';
    hlResultWinner.textContent = PLAYER_CONFIG[w].label + ' 승리! (' + maxScore + '점)';
  } else {
    const labels = winners.map(function(w) { return PLAYER_CONFIG[w].label; }).join(', ');
    hlResultTitle.textContent  = '동점!';
    hlResultWinner.textContent = labels + ' 공동 1위! (' + maxScore + '점)';
  }

  // Table header
  const headRow = document.createElement('tr');
  let headHtml = '<th>라운드</th>';
  for (let i = 0; i < hlPlayerCount; i++) {
    headHtml += '<th><span class="player-dot" style="background:' + PLAYER_CONFIG[i].dot + '"></span>' + PLAYER_CONFIG[i].label + '</th>';
  }
  headRow.innerHTML = headHtml;
  hlResultTableHead.innerHTML = '';
  hlResultTableHead.appendChild(headRow);

  // Table body
  hlResultTableBody.innerHTML = '';
  hlRoundLog.forEach(function(log) {
    const tr = document.createElement('tr');
    const plan = ROUND_PLAN[log.roundIdx];
    let cells = '<td style="text-align:left;font-size:0.82rem;">' + (log.roundIdx + 1) + '라운드 (난이도' + plan.phase + ')</td>';
    for (let i = 0; i < hlPlayerCount; i++) {
      const pts = log.roundScores[i];
      cells += pts > 0
        ? '<td class="cell-win">+' + pts + '</td>'
        : '<td class="cell-none">0</td>';
    }
    tr.innerHTML = cells;
    hlResultTableBody.appendChild(tr);
  });

  // Total chips
  hlTotalRow.innerHTML = '';
  for (let i = 0; i < hlPlayerCount; i++) {
    const cfg   = PLAYER_CONFIG[i];
    const isWin = winners.indexOf(i) !== -1 && maxScore > 0;
    const chip  = document.createElement('div');
    chip.className = 'total-chip';
    chip.innerHTML =
      '<span class="chip-dot" style="background:' + cfg.dot + '"></span>' +
      '<span>' + cfg.label + '</span>' +
      '<span class="chip-score" style="color:' + (isWin ? '#2E7D32' : '#555') + '">' + hlScores[i] + '점</span>' +
      (isWin ? '<span style="font-size:1.1rem;">★</span>' : '');
    hlTotalRow.appendChild(chip);
  }

  hlShowScreen(hlResultScreen);
}
