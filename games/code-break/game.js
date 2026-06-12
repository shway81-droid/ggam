/* games/code-break/game.js — 자물쇠 풀기 (마스터마인드), 2~4인 각자 보드 레이스 */
'use strict';

const CB_TOTAL_ROUNDS = 3;
const CB_ROUND_TIME = 90;
const CB_MAX_TRIES = 7;
const CB_RESULT_PAUSE_MS = getAutoplayPauseMs(2200);

const CB_PLAYER_CONFIG = [
  { label: 'P1', dot: '#0288D1', cls: 'p1' },
  { label: 'P2', dot: '#E53935', cls: 'p2' },
  { label: 'P3', dot: '#388E3C', cls: 'p3' },
  { label: 'P4', dot: '#F57C00', cls: 'p4' },
];

// 색상 팔레트 — 라운드별 색 수 변화
// R1: 3자리 4색(중복 없음) → R2: 3자리 5색 → R3: 4자리 5색
const CB_ROUND_CONFIG = [
  { slots: 3, colors: 4 },
  { slots: 3, colors: 5 },
  { slots: 4, colors: 5 },
];

const CB_COLORS = [
  { id: 0, bg: '#E53935', name: '빨', textColor: '#fff' },
  { id: 1, bg: '#FFD600', name: '노', textColor: '#333' },
  { id: 2, bg: '#43A047', name: '초', textColor: '#fff' },
  { id: 3, bg: '#1E88E5', name: '파', textColor: '#fff' },
  { id: 4, bg: '#E91E63', name: '분', textColor: '#fff' },
];

const cbSnd = createSoundManager({
  pick(ctx) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type = 'sine';
    o.frequency.setValueAtTime(660, ctx.currentTime);
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime+0.08);
    o.start(ctx.currentTime); o.stop(ctx.currentTime+0.08);
  },
  submit(ctx) {
    [440,550].forEach((f,i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination); o.type = 'sine';
      const t = ctx.currentTime + i*0.07;
      o.frequency.setValueAtTime(f,t);
      g.gain.setValueAtTime(0.18,t);
      g.gain.exponentialRampToValueAtTime(0.001,t+0.15);
      o.start(t); o.stop(t+0.15);
    });
  },
  ding(ctx) {
    [523,659,784].forEach((f,i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination); o.type = 'sine';
      const t = ctx.currentTime + i*0.09;
      o.frequency.setValueAtTime(f,t);
      g.gain.setValueAtTime(0.28,t);
      g.gain.exponentialRampToValueAtTime(0.001,t+0.3);
      o.start(t); o.stop(t+0.3);
    });
  },
  buzz(ctx) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type = 'sawtooth';
    o.frequency.setValueAtTime(180, ctx.currentTime);
    g.gain.setValueAtTime(0.16, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime+0.15);
    o.start(ctx.currentTime); o.stop(ctx.currentTime+0.15);
  },
  tick(ctx) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type = 'square';
    o.frequency.setValueAtTime(880, ctx.currentTime);
    g.gain.setValueAtTime(0.1, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime+0.07);
    o.start(ctx.currentTime); o.stop(ctx.currentTime+0.07);
  },
  timeout(ctx) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type = 'triangle';
    o.frequency.setValueAtTime(160, ctx.currentTime);
    g.gain.setValueAtTime(0.4, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime+0.5);
    o.start(ctx.currentTime); o.stop(ctx.currentTime+0.5);
  },
  fanfare(ctx) {
    [392,494,523,659,784].forEach((f,i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination); o.type = 'triangle';
      const t = ctx.currentTime + i*0.12;
      o.frequency.setValueAtTime(f,t);
      g.gain.setValueAtTime(0.28,t);
      g.gain.exponentialRampToValueAtTime(0.001,t+0.35);
      o.start(t); o.stop(t+0.35);
    });
  },
});

const cbGb = id => document.getElementById(id);
const cbIntroScreen = cbGb('introScreen');
const cbCountdownScreen = cbGb('countdownScreen');
const cbCountdownNumber = cbGb('countdownNumber');
const cbGameScreen = cbGb('gameScreen');
const cbResultScreen = cbGb('resultScreen');
const cbBackBtn = cbGb('backBtn');
const cbPlayBtn = cbGb('playBtn');
const cbCloseBtn = cbGb('closeBtn');
const cbRetryBtn = cbGb('retryBtn');
const cbHomeBtn = cbGb('homeBtn');
const cbZonesWrap = cbGb('zonesWrap');
const cbQuestionCounter = cbGb('questionCounter');
const cbProblemTimer = cbGb('problemTimer');
const cbProblemStatus = cbGb('problemStatus');
const cbScoreBar = cbGb('scoreBar');
const cbSoundToggle = cbGb('soundToggleIntro');
const cbResultTitle = cbGb('resultTitle');
const cbResultWinner = cbGb('resultWinner');
const cbTotalRow = cbGb('totalRow');

let cbPlayerCount = 2;
let cbRoundIdx = 0;
let cbScores = [];
let cbRoundResults = [];
let cbPhase = 'idle';
let cbTimerHandle = null;
let cbNextHandle = null;
let cbCountdownInterval = null;
let cbTimeRemaining = CB_ROUND_TIME;

// 라운드 공유 비밀 코드 (전원 같은 코드)
let cbSecretCode = [];
let cbRoundSlots = 3;
let cbRoundColorCount = 4;

// 플레이어별 상태
let cbZoneStates = [];
// { history: [{guess:[...], blacks, whites}], current: [null,null,...], activeSlot: 0, solved: false, failed: false }
let cbZoneSolved = [];

function cbShowScreen(s) {
  [cbIntroScreen, cbCountdownScreen, cbGameScreen, cbResultScreen].forEach(x => x.classList.remove('active'));
  s.classList.add('active');
}
function cbUpdateSoundBtn() { cbSoundToggle.textContent = cbSnd.isMuted() ? '🔇' : '🔊'; }
function cbClearTimers() {
  if (cbCountdownInterval) { clearInterval(cbCountdownInterval); cbCountdownInterval = null; }
  if (cbTimerHandle) { clearInterval(cbTimerHandle); cbTimerHandle = null; }
  if (cbNextHandle) { clearTimeout(cbNextHandle); cbNextHandle = null; }
}
function cbStartPreGameCountdown(onDone) {
  cbShowScreen(cbCountdownScreen);
  let count = 3; cbCountdownNumber.textContent = count;
  cbCountdownInterval = setInterval(() => {
    count--;
    if (count <= 0) { clearInterval(cbCountdownInterval); cbCountdownInterval = null; onDone(); }
    else { cbCountdownNumber.textContent = count; cbCountdownNumber.style.animation = 'none'; cbCountdownNumber.offsetHeight; cbCountdownNumber.style.animation = ''; }
  }, 1000);
}

// ─── 비밀 코드 생성 ───

function cbGenerateSecret(slots, colorCount) {
  const pool = Array.from({length: colorCount}, (_,i) => i);
  // 셔플 후 slots개 선택 (중복 없음)
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, slots);
}

// ─── 피드백 계산 ─── (중복 없으므로 단순 비교)
function cbCalcFeedback(secret, guess) {
  let blacks = 0, whites = 0;
  const secretUsed = new Array(secret.length).fill(false);
  const guessUsed = new Array(guess.length).fill(false);

  // 먼저 정확한 위치(⚫) 확인
  for (let i = 0; i < secret.length; i++) {
    if (guess[i] === secret[i]) {
      blacks++;
      secretUsed[i] = true;
      guessUsed[i] = true;
    }
  }
  // 색만 맞는 것(⚪) 확인
  for (let i = 0; i < guess.length; i++) {
    if (guessUsed[i]) continue;
    for (let j = 0; j < secret.length; j++) {
      if (!secretUsed[j] && guess[i] === secret[j]) {
        whites++;
        secretUsed[j] = true;
        break;
      }
    }
  }
  return {blacks, whites};
}

// ─── 존 구성 ───

function cbGetAvailableColors() {
  return CB_COLORS.slice(0, cbRoundColorCount);
}

function cbBuildZones() {
  cbZonesWrap.innerHTML = '';
  cbZonesWrap.className = `zones-wrap p${cbPlayerCount}`;
  cbZoneStates = [];
  cbZoneSolved = [];

  for (let i = 0; i < cbPlayerCount; i++) {
    cbZoneStates.push({
      history: [],
      current: new Array(cbRoundSlots).fill(null),
      activeSlot: 0,
      solved: false,
      failed: false,
    });
    cbZoneSolved.push(false);

    const cfg = CB_PLAYER_CONFIG[i];
    const zone = document.createElement('div');
    zone.className = `zone ${cfg.cls}`;
    zone.dataset.player = i;

    // 피드백 범례
    const legendHtml = `<div class="cb-legend">
      <span class="cb-legend-item">⚫ 색+위치 맞음</span>
      <span class="cb-legend-item">⚪ 색만 맞음</span>
    </div>`;

    // 추측 기록 (빈 행들 미리 생성)
    let historyRows = '';
    for (let t = 0; t < CB_MAX_TRIES; t++) {
      let dotsHtml = '';
      for (let s = 0; s < cbRoundSlots; s++) {
        dotsHtml += `<div class="cb-guess-dot" id="cbhist-${i}-${t}-${s}" style="background:#DDD"></div>`;
      }
      const fbHtml = `<div class="cb-feedback" id="cbfb-${i}-${t}"></div>`;
      historyRows += `<div class="cb-history-row" id="cbrow-${i}-${t}">${dotsHtml}${fbHtml}</div>`;
    }

    // 현재 슬롯들
    let slotsHtml = '';
    for (let s = 0; s < cbRoundSlots; s++) {
      slotsHtml += `<div class="cb-slot${s === 0 ? ' active-slot' : ''}" id="cbslot-${i}-${s}" data-player="${i}" data-slot="${s}"><span class="cb-slot-x">?</span></div>`;
    }

    // 색 팔레트
    const colors = cbGetAvailableColors();
    let paletteHtml = '';
    for (const c of colors) {
      paletteHtml += `<button class="cb-color-btn" data-player="${i}" data-colorid="${c.id}" style="background:${c.bg};color:${c.textColor}" aria-label="${c.name}">${c.name}</button>`;
    }

    zone.innerHTML = `
      <div class="zone-header">
        <span class="zone-label">${cfg.label}</span>
        <span class="zone-tries-badge" id="cbtries-${i}">0 / ${CB_MAX_TRIES}</span>
      </div>
      ${legendHtml}
      <div class="cb-history" id="cbhistory-${i}">${historyRows}</div>
      <div class="cb-input-panel" id="cbinput-${i}">
        <div class="cb-current-slots">${slotsHtml}</div>
        <div class="cb-palette">${paletteHtml}</div>
        <button class="cb-submit-btn" id="cbsubmit-${i}" disabled>제출</button>
      </div>`;

    cbZonesWrap.appendChild(zone);

    // 슬롯 클릭 → activeSlot 이동
    for (let s = 0; s < cbRoundSlots; s++) {
      const slotEl = cbGb(`cbslot-${i}-${s}`);
      onTap(slotEl, () => cbHandleSlotTap(i, s));
    }

    // 색 버튼 클릭
    zone.querySelectorAll('.cb-color-btn').forEach(btn => {
      onTap(btn, () => cbHandleColorPick(i, parseInt(btn.dataset.colorid, 10)));
    });

    // 제출 버튼
    const submitEl = cbGb(`cbsubmit-${i}`);
    onTap(submitEl, () => cbHandleSubmit(i));
  }
}

function cbHandleSlotTap(playerIdx, slotIdx) {
  if (cbPhase !== 'active' || cbZoneSolved[playerIdx]) return;
  const st = cbZoneStates[playerIdx];
  if (st.solved || st.failed) return;
  // activeSlot을 선택한 슬롯으로 이동
  cbGb(`cbslot-${playerIdx}-${st.activeSlot}`)?.classList.remove('active-slot');
  st.activeSlot = slotIdx;
  cbGb(`cbslot-${playerIdx}-${st.activeSlot}`)?.classList.add('active-slot');
}

function cbHandleColorPick(playerIdx, colorId) {
  if (cbPhase !== 'active' || cbZoneSolved[playerIdx]) return;
  const st = cbZoneStates[playerIdx];
  if (st.solved || st.failed) return;

  st.current[st.activeSlot] = colorId;
  cbRenderCurrentSlots(playerIdx);
  cbSnd.play('pick');

  // 다음 빈 슬롯으로 activeSlot 이동
  let next = (st.activeSlot + 1) % cbRoundSlots;
  // 빈 슬롯 우선
  for (let i = 1; i <= cbRoundSlots; i++) {
    const idx = (st.activeSlot + i) % cbRoundSlots;
    if (st.current[idx] === null) { next = idx; break; }
  }
  cbGb(`cbslot-${playerIdx}-${st.activeSlot}`)?.classList.remove('active-slot');
  st.activeSlot = next;
  cbGb(`cbslot-${playerIdx}-${st.activeSlot}`)?.classList.add('active-slot');

  // 제출 버튼 활성화 여부
  const submitEl = cbGb(`cbsubmit-${playerIdx}`);
  if (submitEl) submitEl.disabled = st.current.some(v => v === null);
}

function cbRenderCurrentSlots(playerIdx) {
  const st = cbZoneStates[playerIdx];
  for (let s = 0; s < cbRoundSlots; s++) {
    const slotEl = cbGb(`cbslot-${playerIdx}-${s}`);
    if (!slotEl) continue;
    const colorId = st.current[s];
    if (colorId === null) {
      slotEl.style.background = '#FFF8E1';
      slotEl.innerHTML = '<span class="cb-slot-x">?</span>';
    } else {
      const c = CB_COLORS[colorId];
      slotEl.style.background = c.bg;
      slotEl.innerHTML = `<span style="font-size:0.7rem;font-weight:900;color:${c.textColor}">${c.name}</span>`;
    }
  }
}

function cbHandleSubmit(playerIdx) {
  if (cbPhase !== 'active' || cbZoneSolved[playerIdx]) return;
  const st = cbZoneStates[playerIdx];
  if (st.solved || st.failed) return;
  if (st.current.some(v => v === null)) return;

  const guess = st.current.slice();
  const {blacks, whites} = cbCalcFeedback(cbSecretCode, guess);
  const tryIdx = st.history.length;
  st.history.push({guess, blacks, whites});

  cbSnd.play('submit');

  // 기록 행 업데이트
  for (let s = 0; s < cbRoundSlots; s++) {
    const dot = cbGb(`cbhist-${playerIdx}-${tryIdx}-${s}`);
    if (dot) dot.style.background = CB_COLORS[guess[s]].bg;
  }

  // 피드백 표시
  const fbEl = cbGb(`cbfb-${playerIdx}-${tryIdx}`);
  if (fbEl) {
    fbEl.innerHTML = '';
    for (let k = 0; k < blacks; k++) {
      const d = document.createElement('div');
      d.className = 'cb-fb-dot black';
      fbEl.appendChild(d);
    }
    for (let k = 0; k < whites; k++) {
      const d = document.createElement('div');
      d.className = 'cb-fb-dot white';
      fbEl.appendChild(d);
    }
    const empty = cbRoundSlots - blacks - whites;
    for (let k = 0; k < empty; k++) {
      const d = document.createElement('div');
      d.className = 'cb-fb-dot empty';
      fbEl.appendChild(d);
    }
  }

  // 시도 횟수 업데이트
  const triesEl = cbGb(`cbtries-${playerIdx}`);
  if (triesEl) triesEl.textContent = `${st.history.length} / ${CB_MAX_TRIES}`;

  // 스크롤 최하단
  const histEl = cbGb(`cbhistory-${playerIdx}`);
  if (histEl) histEl.scrollTop = histEl.scrollHeight;

  // 현재 슬롯 초기화
  st.current = new Array(cbRoundSlots).fill(null);
  st.activeSlot = 0;
  cbRenderCurrentSlots(playerIdx);
  cbGb(`cbsubmit-${playerIdx}`).disabled = true;
  // 슬롯 active 표시 초기화
  for (let s = 0; s < cbRoundSlots; s++) {
    cbGb(`cbslot-${playerIdx}-${s}`)?.classList.remove('active-slot');
  }
  cbGb(`cbslot-${playerIdx}-0`)?.classList.add('active-slot');

  if (blacks === cbRoundSlots) {
    // 성공!
    st.solved = true;
    cbZoneSolved[playerIdx] = true;
    const zone = cbZonesWrap.querySelector(`.zone[data-player="${playerIdx}"]`);
    zone.classList.add('solved');
    cbGb(`cbinput-${playerIdx}`)?.classList.add('locked');
    cbHandleWin(playerIdx, tryIdx + 1);
  } else if (st.history.length >= CB_MAX_TRIES) {
    // 실패
    st.failed = true;
    const zone = cbZonesWrap.querySelector(`.zone[data-player="${playerIdx}"]`);
    zone.classList.add('failed');
    cbGb(`cbinput-${playerIdx}`)?.classList.add('locked');
    cbSnd.play('buzz');
    cbCheckAllFailed();
  }
}

function cbHandleWin(winnerIdx, triesUsed) {
  if (cbRoundResults.length === cbRoundIdx) {
    cbRoundResults.push({winnerIdx, timedOut: false, triesUsed});
    cbScores[winnerIdx]++;
    cbUpdateBarScore(winnerIdx);
    cbSnd.play('ding');
    const bonus = CB_MAX_TRIES - triesUsed;
    cbProblemStatus.textContent = `${CB_PLAYER_CONFIG[winnerIdx].label} 해독! (${triesUsed}번 시도, 보너스 ${bonus})`;
    // 다른 플레이어 잠금
    for (let i = 0; i < cbPlayerCount; i++) {
      if (i !== winnerIdx && !cbZoneSolved[i]) {
        cbZonesWrap.querySelector(`.zone[data-player="${i}"]`)?.classList.add('locked');
      }
    }
    cbPhase = 'done';
    cbClearTimers();
    cbNextHandle = setTimeout(() => cbNextRound(), CB_RESULT_PAUSE_MS);
  }
}

function cbCheckAllFailed() {
  // 모든 플레이어가 실패 또는 풀었으면 라운드 종료
  const allDone = cbZoneStates.every(st => st.solved || st.failed);
  if (!allDone) return;
  if (cbRoundResults.length === cbRoundIdx) {
    cbRoundResults.push({winnerIdx: -1, timedOut: false});
    cbProblemStatus.textContent = `모두 실패! 비밀 코드: ${cbSecretCode.map(id => CB_COLORS[id].name).join('-')}`;
    cbPhase = 'done';
    cbClearTimers();
    cbNextHandle = setTimeout(() => cbNextRound(), CB_RESULT_PAUSE_MS);
  }
}

function cbHandleTimeout() {
  if (cbPhase !== 'active') return;
  cbPhase = 'done';
  cbSnd.play('timeout');
  for (let i = 0; i < cbPlayerCount; i++) {
    if (!cbZoneSolved[i]) {
      cbZonesWrap.querySelector(`.zone[data-player="${i}"]`)?.classList.add('locked');
    }
  }
  // 남은 시도와 ⚫ 수 기준으로 가장 잘한 사람
  if (cbRoundResults.length === cbRoundIdx) {
    let bestScore = -1;
    let bestPlayer = -1;
    let tie = false;
    for (let i = 0; i < cbPlayerCount; i++) {
      const st = cbZoneStates[i];
      if (st.solved) continue; // 이미 처리됨
      const maxBlacks = st.history.reduce((m, h) => Math.max(m, h.blacks), 0);
      if (maxBlacks > bestScore) { bestScore = maxBlacks; bestPlayer = i; tie = false; }
      else if (maxBlacks === bestScore) { tie = true; }
    }
    if (!tie && bestPlayer >= 0 && bestScore > 0) {
      cbRoundResults.push({winnerIdx: bestPlayer, timedOut: true});
      cbScores[bestPlayer]++;
      cbUpdateBarScore(bestPlayer);
      cbProblemStatus.textContent = `시간 초과! ${CB_PLAYER_CONFIG[bestPlayer].label} 최다 정확!`;
    } else {
      cbRoundResults.push({winnerIdx: -1, timedOut: true});
      cbProblemStatus.textContent = `시간 초과! 무승부 — 정답: ${cbSecretCode.map(id => CB_COLORS[id].name).join('-')}`;
    }
    cbNextHandle = setTimeout(() => cbNextRound(), CB_RESULT_PAUSE_MS);
  }
}

// ─── 점수 바 ───

function cbBuildScoreBar() {
  cbScoreBar.innerHTML = '';
  for (let i = 0; i < cbPlayerCount; i++) {
    const cfg = CB_PLAYER_CONFIG[i];
    const chip = document.createElement('div');
    chip.className = 'score-chip';
    chip.innerHTML = `<span class="score-chip-dot" style="background:${cfg.dot}"></span><span>${cfg.label}</span><span class="score-chip-val" id="cbbar-score-${i}">0</span>`;
    cbScoreBar.appendChild(chip);
  }
}
function cbUpdateBarScore(idx) { const el = cbGb(`cbbar-score-${idx}`); if (el) el.textContent = cbScores[idx]; }

// ─── 타이머 ───

function cbStartCountdown() {
  cbTimeRemaining = CB_ROUND_TIME;
  cbProblemTimer.textContent = cbTimeRemaining;
  cbProblemTimer.classList.remove('urgent');
  cbTimerHandle = setInterval(() => {
    cbTimeRemaining--;
    cbProblemTimer.textContent = cbTimeRemaining;
    if (cbTimeRemaining <= 10) { cbProblemTimer.classList.add('urgent'); cbSnd.play('tick'); }
    if (cbTimeRemaining <= 0) { cbClearTimers(); cbHandleTimeout(); }
  }, 1000);
}

// ─── 게임 흐름 ───

function cbLoadRound() {
  cbPhase = 'active';
  const cfg = CB_ROUND_CONFIG[Math.min(cbRoundIdx, CB_ROUND_CONFIG.length - 1)];
  cbRoundSlots = cfg.slots;
  cbRoundColorCount = cfg.colors;
  cbSecretCode = cbGenerateSecret(cbRoundSlots, cbRoundColorCount);

  cbBuildZones();
  cbQuestionCounter.textContent = `${cbRoundIdx + 1} / ${CB_TOTAL_ROUNDS}`;
  cbProblemStatus.textContent = `${cbRoundSlots}자리 ${cbRoundColorCount}색 암호를 7번 안에 해독!`;
  cbStartCountdown();
}

function cbNextRound() {
  cbRoundIdx++;
  if (cbRoundIdx >= CB_TOTAL_ROUNDS) cbShowResult();
  else cbLoadRound();
}

function cbStartGame() {
  cbRoundIdx = 0;
  cbScores = new Array(cbPlayerCount).fill(0);
  cbRoundResults = [];
  cbPhase = 'idle';
  cbClearTimers();
  cbBuildScoreBar();
  cbShowScreen(cbGameScreen);
  cbLoadRound();
}

function cbShowResult() {
  cbClearTimers();
  cbPhase = 'idle';
  cbSnd.play('fanfare');
  const max = Math.max(...cbScores);
  const winners = cbScores.map((s,i) => ({s,i})).filter(x => x.s === max).map(x => x.i);
  if (max === 0) {
    cbResultTitle.textContent = '무승부!';
    cbResultWinner.textContent = '아무도 라운드를 이기지 못했어요.';
  } else if (winners.length === 1) {
    cbResultTitle.textContent = '게임 종료!';
    cbResultWinner.textContent = `${CB_PLAYER_CONFIG[winners[0]].label} 우승! (${max}승)`;
  } else {
    const labels = winners.map(w => CB_PLAYER_CONFIG[w].label).join(', ');
    cbResultTitle.textContent = '동점!';
    cbResultWinner.textContent = `${labels} 공동 1위! (${max}승)`;
  }
  cbTotalRow.innerHTML = '';
  for (let i = 0; i < cbPlayerCount; i++) {
    const cfg = CB_PLAYER_CONFIG[i];
    const isWin = winners.includes(i) && max > 0;
    const chip = document.createElement('div');
    chip.className = 'total-chip';
    chip.innerHTML = `<span class="chip-dot" style="background:${cfg.dot}"></span><span>${cfg.label}</span><span class="chip-score" style="color:${isWin ? '#2E7D32' : '#555'}">${cbScores[i]}승</span>${isWin ? '<span style="font-size:1.1rem;">★</span>' : ''}`;
    cbTotalRow.appendChild(chip);
  }
  cbShowScreen(cbResultScreen);
}

// ─── 인원 선택 ───

document.querySelectorAll('.cb-player-btn').forEach(btn => {
  onTap(btn, () => {
    cbPlayerCount = parseInt(btn.dataset.players, 10);
    document.querySelectorAll('.cb-player-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});
const cbDefaultBtn = document.querySelector('.cb-player-btn[data-players="2"]');
if (cbDefaultBtn) cbDefaultBtn.classList.add('active');

// ─── 이벤트 바인딩 ───

onTap(cbSoundToggle, () => { cbSnd.toggleMute(); cbUpdateSoundBtn(); });
cbUpdateSoundBtn();
onTap(cbBackBtn, () => goHome());
onTap(cbCloseBtn, () => { cbClearTimers(); goHome(); });
onTap(cbHomeBtn, () => goHome());
onTap(cbRetryBtn, () => cbStartPreGameCountdown(() => cbStartGame()));
onTap(cbPlayBtn, () => cbStartPreGameCountdown(() => cbStartGame()));
