/* games/river-cross/game.js — 강 건너기, 퍼즐형 멀티(2~4인) 각자 보드 레이스 */
'use strict';

const RC_TOTAL_ROUNDS = 3;
const RC_ROUND_TIME = 90;
const RC_RESULT_PAUSE_MS = getAutoplayPauseMs(2000);

const RC_PLAYER_CONFIG = [
  { label: 'P1', dot: '#0288D1', cls: 'p1' },
  { label: 'P2', dot: '#E53935', cls: 'p2' },
  { label: 'P3', dot: '#388E3C', cls: 'p3' },
  { label: 'P4', dot: '#F57C00', cls: 'p4' },
];

// 라운드별 스킨 설정
// R1,R2: 클래식(늑대🐺,염소🐐,배추🥬), R3: 변형(고양이🐱,쥐🐭,치즈🧀)
const RC_SKINS = [
  { wolf: '🐺', goat: '🐐', cabbage: '🥬', warnWolf: '늑대+염소 위험!', warnGoat: '염소+배추 위험!' },
  { wolf: '🐺', goat: '🐐', cabbage: '🥬', warnWolf: '늑대+염소 위험!', warnGoat: '염소+배추 위험!' },
  { wolf: '🐱', goat: '🐭', cabbage: '🧀', warnWolf: '고양이+쥐 위험!', warnGoat: '쥐+치즈 위험!' },
];

const rcSound = createSoundManager({
  move(ctx) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type = 'sine';
    o.frequency.setValueAtTime(660, ctx.currentTime);
    g.gain.setValueAtTime(0.12, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.07);
    o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.07);
  },
  splash(ctx) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type = 'triangle';
    o.frequency.setValueAtTime(440, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.18);
    g.gain.setValueAtTime(0.2, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.22);
  },
  danger(ctx) {
    [280, 240, 200].forEach((f, i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination); o.type = 'sawtooth';
      const t = ctx.currentTime + i * 0.08;
      o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.25, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      o.start(t); o.stop(t + 0.12);
    });
  },
  ding(ctx) {
    [523, 659, 784].forEach((f, i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination); o.type = 'sine';
      const t = ctx.currentTime + i * 0.09;
      o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.32, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
      o.start(t); o.stop(t + 0.32);
    });
  },
  tick(ctx) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type = 'square';
    o.frequency.setValueAtTime(880, ctx.currentTime);
    g.gain.setValueAtTime(0.1, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
    o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.06);
  },
  timeout(ctx) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type = 'triangle';
    o.frequency.setValueAtTime(160, ctx.currentTime);
    g.gain.setValueAtTime(0.35, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.5);
  },
  fanfare(ctx) {
    [392, 494, 523, 659, 784].forEach((f, i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination); o.type = 'triangle';
      const t = ctx.currentTime + i * 0.12;
      o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.28, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
      o.start(t); o.stop(t + 0.38);
    });
  },
});

let rcPlayerCount = 2;
let rcRoundIdx = 0;
let rcScores = [];
let rcRoundResults = [];
// 각 플레이어 보드 상태
// side: 0=left bank, 1=river, 2=right bank
// boatSide: 0 or 2
// leftBank/rightBank/onBoat: Set of 'farmer','wolf','goat','cabbage'
// boatPassenger: null | 'wolf'|'goat'|'cabbage'
let rcStates = [];
let rcSolved = [];
let rcResetCounts = [];
let rcCrossCounts = [];
let rcPhase = 'idle';
let rcTimerHandle = null;
let rcNextHandle = null;
let rcTimeRemaining = RC_ROUND_TIME;
let rcRoundFirstWinner = -1;

const rcEl = id => document.getElementById(id);
const rcIntroScreen = rcEl('introScreen');
const rcCountdownScreen = rcEl('countdownScreen');
const rcGameScreen = rcEl('gameScreen');
const rcResultScreen = rcEl('resultScreen');
const rcCountdownNumber = rcEl('countdownNumber');
const rcBackBtn = rcEl('backBtn');
const rcPlayBtn = rcEl('playBtn');
const rcCloseBtn = rcEl('closeBtn');
const rcRetryBtn = rcEl('retryBtn');
const rcHomeBtn = rcEl('homeBtn');
const rcZonesWrap = rcEl('zonesWrap');
const rcQuestionCounter = rcEl('questionCounter');
const rcProblemTimer = rcEl('problemTimer');
const rcProblemStatus = rcEl('problemStatus');
const rcScoreBar = rcEl('scoreBar');
const rcSoundToggleIntro = rcEl('soundToggleIntro');
const rcResultTitle = rcEl('resultTitle');
const rcResultWinner = rcEl('resultWinner');
const rcTotalRow = rcEl('totalRow');

function rcShowScreen(s) {
  [rcIntroScreen, rcCountdownScreen, rcGameScreen, rcResultScreen]
    .forEach(x => x.classList.remove('active'));
  s.classList.add('active');
}

let rcCdInterval = null;
function rcStartCountdown(onDone) {
  rcShowScreen(rcCountdownScreen);
  let count = 3;
  rcCountdownNumber.textContent = count;
  rcCdInterval = setInterval(() => {
    count--;
    if (count <= 0) { clearInterval(rcCdInterval); rcCdInterval = null; onDone(); }
    else {
      rcCountdownNumber.textContent = count;
      rcCountdownNumber.style.animation = 'none';
      rcCountdownNumber.offsetHeight;
      rcCountdownNumber.style.animation = '';
    }
  }, 1000);
}

function rcClearTimers() {
  if (rcCdInterval) { clearInterval(rcCdInterval); rcCdInterval = null; }
  if (rcTimerHandle) { clearInterval(rcTimerHandle); rcTimerHandle = null; }
  if (rcNextHandle) { clearTimeout(rcNextHandle); rcNextHandle = null; }
}

function rcUpdateSoundBtn(btn) { btn.textContent = rcSound.isMuted() ? '🔇' : '🔊'; }

// ── 초기 상태 ──
function rcFreshState() {
  return {
    leftBank: new Set(['farmer', 'wolf', 'goat', 'cabbage']),
    rightBank: new Set(),
    onBoat: new Set(),        // 배 위 — farmer는 항상 배 이동에 필요하지만 이쪽에 올림
    boatSide: 'left',         // 'left' | 'right'
    boatPassenger: null,      // 'wolf'|'goat'|'cabbage'|null (농부 제외 승객)
    crossCount: 0,
  };
}

function rcGetSkin() { return RC_SKINS[rcRoundIdx]; }

function rcCharEmoji(key) {
  const skin = rcGetSkin();
  const map = { farmer: '🧑‍🌾', wolf: skin.wolf, goat: skin.goat, cabbage: skin.cabbage };
  return map[key] || '?';
}

// 특정 기슭에 농부 없이 늑대+염소 OR 염소+배추가 있으면 위험
function rcIsDanger(bank) {
  if (bank.has('farmer')) return false; // 농부 있으면 안전
  const hasWolf = bank.has('wolf'), hasGoat = bank.has('goat'), hasCabbage = bank.has('cabbage');
  return (hasWolf && hasGoat) || (hasGoat && hasCabbage);
}

function rcCheckDanger(playerIdx) {
  const st = rcStates[playerIdx];
  // 배가 있는 기슭의 반대편 기슭을 체크
  const dangerBank = st.boatSide === 'left' ? st.rightBank : st.leftBank;
  return rcIsDanger(dangerBank);
}

// ── 승리 체크: 모두 오른쪽에 있어야 함 ──
function rcIsWin(playerIdx) {
  const st = rcStates[playerIdx];
  return (
    st.rightBank.has('farmer') &&
    st.rightBank.has('wolf') &&
    st.rightBank.has('goat') &&
    st.rightBank.has('cabbage') &&
    st.onBoat.size === 0
  );
}

// ── 보드 렌더링 ──
function rcRenderBoard(playerIdx) {
  const zone = rcGetZone(playerIdx);
  if (!zone) return;
  const st = rcStates[playerIdx];
  const board = zone.querySelector('.river-board');
  if (!board) return;

  const skin = rcGetSkin();
  // 배가 왼쪽에 있을 때 → 왼쪽 기슭에 배 표시
  // 배가 오른쪽에 있을 때 → 오른쪽 기슭에 배 표시

  function makeCharBtn(key, side) {
    const btn = document.createElement('button');
    btn.className = 'char-btn';
    if (key === 'farmer') btn.classList.add('farmer');
    btn.textContent = rcCharEmoji(key);
    btn.setAttribute('aria-label', key);
    if (st.onBoat.has(key)) btn.classList.add('on-boat');
    onTap(btn, () => rcHandleCharTap(playerIdx, key, side));
    return btn;
  }

  function makeBank(bankSet, side, label) {
    const div = document.createElement('div');
    div.className = 'bank';
    const lbl = document.createElement('div');
    lbl.className = 'bank-label';
    lbl.textContent = label;
    div.appendChild(lbl);

    // 이 기슭에 있는 캐릭터들 + 배가 이 쪽에 있으면 배+onBoat 표시
    const boatHere = (st.boatSide === side);
    const chars = ['farmer', 'wolf', 'goat', 'cabbage'];

    if (boatHere) {
      // 배 표시
      const boatDiv = document.createElement('div');
      boatDiv.className = 'boat-icon';
      boatDiv.textContent = '⛵';
      div.appendChild(boatDiv);
      // 배 위의 캐릭터들
      chars.forEach(key => {
        if (st.onBoat.has(key)) {
          div.appendChild(makeCharBtn(key, side));
        }
      });
      // 건너기 버튼
      const crossBtn = document.createElement('button');
      crossBtn.className = 'cross-btn';
      // 라운드 2: 최소 횟수 도전 표시
      if (rcRoundIdx === 1) {
        crossBtn.textContent = '건너기\n(목표:7회)';
      } else {
        crossBtn.textContent = '건너기';
      }
      crossBtn.style.whiteSpace = 'pre';
      onTap(crossBtn, () => rcHandleCross(playerIdx));
      div.appendChild(crossBtn);
    }

    // 기슭에 있는 캐릭터들
    chars.forEach(key => {
      if (bankSet.has(key) && !st.onBoat.has(key)) {
        div.appendChild(makeCharBtn(key, side));
      }
    });

    return div;
  }

  board.innerHTML = '';
  board.appendChild(makeBank(st.leftBank, 'left', '왼쪽'));

  // 강 중간
  const riverDiv = document.createElement('div');
  riverDiv.className = 'river';
  const riverLbl = document.createElement('div');
  riverLbl.className = 'river-label';
  riverLbl.textContent = '강\n🌊';
  riverLbl.style.whiteSpace = 'pre';
  riverDiv.appendChild(riverLbl);
  board.appendChild(riverDiv);

  board.appendChild(makeBank(st.rightBank, 'right', '오른쪽'));
}

function rcGetZone(idx) {
  return rcZonesWrap.querySelector(`.zone[data-player="${idx}"]`);
}

// ── 캐릭터 탭 처리 ──
function rcHandleCharTap(playerIdx, key, side) {
  if (rcPhase !== 'active' || rcSolved[playerIdx]) return;
  const st = rcStates[playerIdx];
  if (st.boatSide !== side) return; // 배가 이 기슭에 없으면 무시

  if (st.onBoat.has(key)) {
    // 배에서 내리기 — 배가 있는 기슭으로
    st.onBoat.delete(key);
    if (st.boatSide === 'left') {
      st.leftBank.add(key);
    } else {
      st.rightBank.add(key);
    }
    rcSound.play('move');
  } else {
    // 배에 태우기
    // 농부는 항상 배에 탈 수 있음 (or 한 명의 승객)
    if (key === 'farmer') {
      // 이미 배에 있으면 무시 (위에서 처리)
      if (st.onBoat.has('farmer')) return;
      // 기슭에서 제거
      if (st.boatSide === 'left') st.leftBank.delete('farmer');
      else st.rightBank.delete('farmer');
      st.onBoat.add('farmer');
      rcSound.play('move');
    } else {
      // 승객 — 농부가 배 위에 있어야 함 + 승객은 1명만
      const currentPassenger = [...st.onBoat].find(k => k !== 'farmer');
      if (!st.onBoat.has('farmer')) return; // 농부 없이는 탑승 불가
      if (currentPassenger) return; // 이미 승객 있음
      if (st.boatSide === 'left') st.leftBank.delete(key);
      else st.rightBank.delete(key);
      st.onBoat.add(key);
      rcSound.play('move');
    }
  }
  rcRenderBoard(playerIdx);
  rcUpdateChips(playerIdx);
}

// ── 건너기 ──
function rcHandleCross(playerIdx) {
  if (rcPhase !== 'active' || rcSolved[playerIdx]) return;
  const st = rcStates[playerIdx];
  // 농부가 배 위에 있어야 건너기 가능
  if (!st.onBoat.has('farmer')) {
    // 경고 없이 무시
    return;
  }

  // 건너기 실행: 배 위의 모두를 반대편으로 이동
  const dest = st.boatSide === 'left' ? 'right' : 'left';
  const destBank = dest === 'right' ? st.rightBank : st.leftBank;

  st.onBoat.forEach(key => destBank.add(key));
  st.onBoat.clear();
  st.boatSide = dest;
  st.crossCount++;
  rcCrossCounts[playerIdx] = st.crossCount;

  rcSound.play('splash');
  rcRenderBoard(playerIdx);
  rcUpdateChips(playerIdx);

  // 도착 후 위험 체크 — 농부가 없는 기슭에서 규칙 위반 체크
  if (rcCheckDanger(playerIdx)) {
    rcTriggerDanger(playerIdx);
    return;
  }

  // 승리 체크
  if (rcIsWin(playerIdx)) {
    rcHandleSolve(playerIdx);
  }
}

// ── 위험 처리 ──
function rcTriggerDanger(playerIdx) {
  rcSound.play('danger');
  const zone = rcGetZone(playerIdx);
  if (!zone) return;
  zone.classList.add('danger');
  const overlay = zone.querySelector('.danger-overlay');
  if (overlay) overlay.textContent = '😱 리셋!';
  setTimeout(() => {
    zone.classList.remove('danger');
    // 자동 리셋
    rcStates[playerIdx] = rcFreshState();
    rcResetCounts[playerIdx]++;
    rcUpdateChips(playerIdx);
    rcRenderBoard(playerIdx);
  }, 1200);
}

// ── 칩 업데이트 ──
function rcUpdateChips(playerIdx) {
  const zone = rcGetZone(playerIdx);
  if (!zone) return;
  const crossChip = zone.querySelector('.chip-cross');
  const resetChip = zone.querySelector('.chip-reset');
  if (crossChip) crossChip.textContent = `⛵ ${rcStates[playerIdx].crossCount}회`;
  if (resetChip) resetChip.textContent = `↺ ${rcResetCounts[playerIdx]}`;
}

// ── 존 빌드 ──
function rcBuildZones() {
  rcZonesWrap.innerHTML = '';
  rcZonesWrap.className = `zones-wrap p${rcPlayerCount}`;
  for (let i = 0; i < rcPlayerCount; i++) {
    const cfg = RC_PLAYER_CONFIG[i];
    const zone = document.createElement('div');
    zone.className = `zone ${cfg.cls}`;
    zone.dataset.player = i;
    zone.innerHTML = `
      <div class="zone-header">
        <span class="zone-label">${cfg.label}</span>
        <span class="zone-chips">
          <span class="zone-chip chip-cross">⛵ 0회</span>
          <span class="zone-chip chip-reset">↺ 0</span>
        </span>
      </div>
      <div class="river-board"></div>
      <div class="danger-overlay">😱</div>`;
    rcZonesWrap.appendChild(zone);
  }
}

// ── 라운드 종료 ──
function rcHandleSolve(playerIdx) {
  if (rcSolved[playerIdx]) return;
  rcSolved[playerIdx] = true;
  const zone = rcGetZone(playerIdx);
  if (zone) zone.classList.add('solved');
  if (rcRoundFirstWinner === -1) {
    rcRoundFirstWinner = playerIdx;
    rcScores[playerIdx]++;
    rcRenderBarScore(playerIdx);
    rcSound.play('ding');
    const crossMsg = rcRoundIdx === 1 ?
      `(${rcStates[playerIdx].crossCount}회${rcStates[playerIdx].crossCount <= 7 ? ' 🎉최소!' : ''})` :
      `(${rcStates[playerIdx].crossCount}회)`;
    rcProblemStatus.textContent = `${RC_PLAYER_CONFIG[playerIdx].label} 성공! ${crossMsg}`;
    // 나머지 잠금
    for (let i = 0; i < rcPlayerCount; i++) {
      if (!rcSolved[i]) { const z = rcGetZone(i); if (z) z.classList.add('locked'); }
    }
    rcPhase = 'done';
    rcClearTimers();
    rcNextHandle = setTimeout(() => rcNextRound(), RC_RESULT_PAUSE_MS);
  }
}

function rcHandleTimeout() {
  if (rcPhase !== 'active') return;
  rcPhase = 'done';
  rcSound.play('timeout');
  // 가장 많이 건넌 사람 기준으로 처리 (tie → draw)
  let maxCross = -1;
  for (let i = 0; i < rcPlayerCount; i++) {
    if (!rcSolved[i]) { const z = rcGetZone(i); if (z) z.classList.add('locked'); }
    if (rcStates[i].crossCount > maxCross) maxCross = rcStates[i].crossCount;
  }
  if (rcRoundFirstWinner === -1) rcProblemStatus.textContent = '시간 초과! 다음 라운드로';
  rcNextHandle = setTimeout(() => rcNextRound(), RC_RESULT_PAUSE_MS);
}

// ── 점수 바 ──
function rcBuildScoreBar() {
  rcScoreBar.innerHTML = '';
  for (let i = 0; i < rcPlayerCount; i++) {
    const cfg = RC_PLAYER_CONFIG[i];
    const chip = document.createElement('div');
    chip.className = 'score-chip';
    chip.innerHTML = `<span class="score-chip-dot" style="background:${cfg.dot}"></span><span>${cfg.label}</span><span class="score-chip-val" id="rc-bar-${i}">0</span>`;
    rcScoreBar.appendChild(chip);
  }
}
function rcRenderBarScore(idx) { const el = rcEl(`rc-bar-${idx}`); if (el) el.textContent = rcScores[idx]; }

// ── 타이머 ──
function rcStartTimer() {
  rcTimeRemaining = RC_ROUND_TIME;
  rcProblemTimer.textContent = rcTimeRemaining;
  rcProblemTimer.classList.remove('urgent');
  rcTimerHandle = setInterval(() => {
    rcTimeRemaining--;
    rcProblemTimer.textContent = rcTimeRemaining;
    if (rcTimeRemaining <= 10) { rcProblemTimer.classList.add('urgent'); rcSound.play('tick'); }
    if (rcTimeRemaining <= 0) { rcClearTimers(); rcHandleTimeout(); }
  }, 1000);
}

// ── 게임 흐름 ──
function rcLoadRound() {
  rcPhase = 'active';
  rcRoundFirstWinner = -1;
  rcStates = [];
  rcSolved = [];
  rcResetCounts = [];
  rcCrossCounts = [];
  const skin = rcGetSkin();

  for (let i = 0; i < rcPlayerCount; i++) {
    rcStates.push(rcFreshState());
    rcSolved.push(false);
    rcResetCounts.push(0);
    rcCrossCounts.push(0);
    const zone = rcGetZone(i);
    if (zone) zone.classList.remove('solved', 'locked', 'danger');
    rcRenderBoard(i);
    rcUpdateChips(i);
  }

  rcQuestionCounter.textContent = `${rcRoundIdx + 1} / ${RC_TOTAL_ROUNDS}`;
  const labels = { wolf: skin.wolf, goat: skin.goat, cabbage: skin.cabbage };
  const desc = rcRoundIdx === 1 ?
    `7회 이하로 건너면 최소! ${labels.wolf}${labels.goat}${labels.cabbage}를 오른쪽으로!` :
    `${labels.wolf}${labels.goat}${labels.cabbage}를 모두 오른쪽으로!`;
  rcProblemStatus.textContent = desc;
  rcStartTimer();
}

function rcNextRound() {
  rcRoundIdx++;
  if (rcRoundIdx >= RC_TOTAL_ROUNDS) rcShowResult();
  else rcLoadRound();
}

function rcStartGame() {
  rcRoundIdx = 0;
  rcScores = new Array(rcPlayerCount).fill(0);
  rcRoundResults = [];
  rcPhase = 'idle';
  rcClearTimers();
  rcBuildZones();
  rcBuildScoreBar();
  rcShowScreen(rcGameScreen);
  rcLoadRound();
}

function rcShowResult() {
  rcClearTimers();
  rcPhase = 'idle';
  rcSound.play('fanfare');
  const max = Math.max(...rcScores);
  const winners = rcScores.map((s, i) => ({ s, i })).filter(x => x.s === max).map(x => x.i);
  if (max === 0) {
    rcResultTitle.textContent = '무승부!';
    rcResultWinner.textContent = '아무도 먼저 성공하지 못했어요.';
  } else if (winners.length === 1) {
    rcResultTitle.textContent = '게임 종료!';
    rcResultWinner.textContent = `${RC_PLAYER_CONFIG[winners[0]].label} 우승! (${max}승)`;
  } else {
    const labels = winners.map(w => RC_PLAYER_CONFIG[w].label).join(', ');
    rcResultTitle.textContent = '동점!';
    rcResultWinner.textContent = `${labels} 공동 1위! (${max}승)`;
  }
  rcTotalRow.innerHTML = '';
  for (let i = 0; i < rcPlayerCount; i++) {
    const cfg = RC_PLAYER_CONFIG[i];
    const isWin = winners.includes(i) && max > 0;
    const chip = document.createElement('div');
    chip.className = 'total-chip';
    chip.innerHTML = `<span class="chip-dot" style="background:${cfg.dot}"></span><span>${cfg.label}</span><span class="chip-score" style="color:${isWin ? '#2E7D32' : '#555'}">${rcScores[i]}승</span>${isWin ? '<span style="font-size:1.1rem">★</span>' : ''}`;
    rcTotalRow.appendChild(chip);
  }
  rcShowScreen(rcResultScreen);
}

// ── 이벤트 바인딩 ──
document.querySelectorAll('.player-btn').forEach(btn => {
  onTap(btn, () => {
    document.querySelectorAll('.player-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    rcPlayerCount = parseInt(btn.dataset.count, 10);
  });
});

onTap(rcSoundToggleIntro, () => { rcSound.toggleMute(); rcUpdateSoundBtn(rcSoundToggleIntro); });
rcUpdateSoundBtn(rcSoundToggleIntro);
onTap(rcBackBtn, () => goHome());
onTap(rcCloseBtn, () => { rcClearTimers(); goHome(); });
onTap(rcHomeBtn, () => goHome());
onTap(rcRetryBtn, () => rcStartCountdown(() => rcStartGame()));
onTap(rcPlayBtn, () => rcStartCountdown(() => rcStartGame()));
