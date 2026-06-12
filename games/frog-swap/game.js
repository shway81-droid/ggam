/* games/frog-swap/game.js — 개구리 자리 바꾸기 (2~4인 동시 레이스) */
'use strict';

const FROG_TOTAL_ROUNDS = 3;
const FROG_ROUND_TIME = 90;
const FROG_RESULT_PAUSE_MS = getAutoplayPauseMs(2200);

const FROG_PLAYER_CONFIG = [
  { label: 'P1', dot: '#0288D1', cls: 'p1' },
  { label: 'P2', dot: '#E53935', cls: 'p2' },
  { label: 'P3', dot: '#388E3C', cls: 'p3' },
  { label: 'P4', dot: '#F57C00', cls: 'p4' },
];

// 라운드별 N값 (N마리씩)
const FROG_ROUND_N = [2, 3, 4];

/*
 * 개구리 자리 바꾸기 규칙:
 * 보드 크기 2N+1칸
 * 왼쪽 N칸: 초록 개구리 (G — 오른쪽 진행)
 * 가운데 1칸: 빈 잎 (empty)
 * 오른쪽 N칸: 노란 개구리 (Y — 왼쪽 진행)
 *
 * 이동 규칙:
 * 초록(G): 오른쪽 방향만
 *   - 앞(오른쪽) 1칸이 비면 → 이동
 *   - 앞(오른쪽) 1칸이 노란 개구리, 그 너머(오른쪽 2칸)가 비면 → 점프
 * 노란(Y): 왼쪽 방향만
 *   - 앞(왼쪽) 1칸이 비면 → 이동
 *   - 앞(왼쪽) 1칸이 초록 개구리, 그 너머(왼쪽 2칸)가 비면 → 점프
 *
 * 완성: 초록이 오른쪽 N칸, 노란이 왼쪽 N칸 (위치 완전 교환)
 * 막힘: 아무 개구리도 이동 불가
 */

// ─── Sound ───────────────────────────────────────────────────
const frogSound = createSoundManager({
  hop(ctx) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type = 'sine';
    o.frequency.setValueAtTime(440, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.08);
    g.gain.setValueAtTime(0.18, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.1);
  },
  jump(ctx) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type = 'sine';
    o.frequency.setValueAtTime(330, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
    g.gain.setValueAtTime(0.22, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.18);
  },
  stuck(ctx) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type = 'sawtooth';
    o.frequency.setValueAtTime(180, ctx.currentTime);
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.18);
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
    g.gain.setValueAtTime(0.12, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.08);
  },
  timeout(ctx) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type = 'triangle';
    o.frequency.setValueAtTime(160, ctx.currentTime);
    g.gain.setValueAtTime(0.4, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.5);
  },
  fanfare(ctx) {
    [392, 494, 523, 659, 784].forEach((f, i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination); o.type = 'triangle';
      const t = ctx.currentTime + i * 0.12;
      o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.3, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
      o.start(t); o.stop(t + 0.38);
    });
  },
});

// ─── State ───────────────────────────────────────────────────
let frogPlayerCount = 2;
let frogRoundIdx = 0;
let frogScores = [];
let frogRoundResults = [];
let frogBoards = [];     // per-player: array of 'G'|'Y'|'E' (2N+1)
let frogMoves = [];
let frogSolved = [];
let frogStuck = [];      // 막힘 상태
let frogPhase = 'idle';
let frogTimerHandle = null;
let frogNextHandle = null;
let frogTimeRemaining = FROG_ROUND_TIME;

const frogIntroScreen = document.getElementById('introScreen');
const frogCountdownScreen = document.getElementById('countdownScreen');
const frogCountdownNumber = document.getElementById('countdownNumber');
const frogGameScreen = document.getElementById('gameScreen');
const frogResultScreen = document.getElementById('resultScreen');
const frogBackBtn = document.getElementById('backBtn');
const frogPlayBtn = document.getElementById('playBtn');
const frogCloseBtn = document.getElementById('closeBtn');
const frogRetryBtn = document.getElementById('retryBtn');
const frogHomeBtn = document.getElementById('homeBtn');
const frogZonesWrap = document.getElementById('zonesWrap');
const frogQuestionCounter = document.getElementById('questionCounter');
const frogProblemTimer = document.getElementById('problemTimer');
const frogProblemStatus = document.getElementById('problemStatus');
const frogScoreBar = document.getElementById('scoreBar');
const frogSoundToggleIntro = document.getElementById('soundToggleIntro');
const frogResultTitle = document.getElementById('resultTitle');
const frogResultWinner = document.getElementById('resultWinner');
const frogTotalRow = document.getElementById('totalRow');

function frogShowScreen(s) {
  [frogIntroScreen, frogCountdownScreen, frogGameScreen, frogResultScreen].forEach(x => x.classList.remove('active'));
  s.classList.add('active');
}

let frogCountdownInterval = null;
function frogStartPreGameCountdown(onDone) {
  frogShowScreen(frogCountdownScreen);
  let count = 3;
  frogCountdownNumber.textContent = count;
  frogCountdownInterval = setInterval(() => {
    count--;
    if (count <= 0) { clearInterval(frogCountdownInterval); frogCountdownInterval = null; onDone(); }
    else {
      frogCountdownNumber.textContent = count;
      frogCountdownNumber.style.animation = 'none';
      frogCountdownNumber.offsetHeight;
      frogCountdownNumber.style.animation = '';
    }
  }, 1000);
}

function frogClearTimers() {
  if (frogCountdownInterval) { clearInterval(frogCountdownInterval); frogCountdownInterval = null; }
  if (frogTimerHandle) { clearInterval(frogTimerHandle); frogTimerHandle = null; }
  if (frogNextHandle) { clearTimeout(frogNextHandle); frogNextHandle = null; }
}

function frogUpdateSoundBtn(btn) { btn.textContent = frogSound.isMuted() ? '🔇' : '🔊'; }

// ─── 보드 초기화 ─────────────────────────────────────────────
function frogInitBoard(n) {
  const board = [];
  for (let i = 0; i < n; i++) board.push('G');
  board.push('E');
  for (let i = 0; i < n; i++) board.push('Y');
  return board;
}

function frogIsComplete(board, n) {
  // 왼쪽 N칸은 모두 Y, 오른쪽 N칸은 모두 G
  for (let i = 0; i < n; i++) {
    if (board[i] !== 'Y') return false;
  }
  if (board[n] !== 'E') return false;
  for (let i = n + 1; i < board.length; i++) {
    if (board[i] !== 'G') return false;
  }
  return true;
}

// 이동 가능한 개구리 목록 반환 [{idx, type}]
function frogGetMoves(board) {
  const emptyIdx = board.indexOf('E');
  const moves = [];
  for (let i = 0; i < board.length; i++) {
    if (board[i] === 'G') {
      // 앞(오른쪽) 1칸 빈 경우
      if (i + 1 === emptyIdx) moves.push({ idx: i, type: 'step' });
      // 앞 1칸 Y + 앞 2칸 빈 경우
      else if (i + 1 < board.length && board[i + 1] === 'Y' && i + 2 === emptyIdx) moves.push({ idx: i, type: 'jump' });
    } else if (board[i] === 'Y') {
      // 앞(왼쪽) 1칸 빈 경우
      if (i - 1 === emptyIdx) moves.push({ idx: i, type: 'step' });
      // 앞 1칸 G + 앞 2칸 빈 경우
      else if (i - 1 >= 0 && board[i - 1] === 'G' && i - 2 === emptyIdx) moves.push({ idx: i, type: 'jump' });
    }
  }
  return moves;
}

function frogApplyMove(board, frogIdx) {
  const newBoard = board.slice();
  const emptyIdx = board.indexOf('E');
  newBoard[emptyIdx] = board[frogIdx];
  newBoard[frogIdx] = 'E';
  return newBoard;
}

function frogIsStuck(board, n) {
  if (frogIsComplete(board, n)) return false;
  return frogGetMoves(board).length === 0;
}

// ─── 존 구성 ───────────────────────────────────────────────
function frogBuildZones() {
  frogZonesWrap.innerHTML = '';
  frogZonesWrap.className = `zones-wrap p${frogPlayerCount}`;
  for (let i = 0; i < frogPlayerCount; i++) {
    const cfg = FROG_PLAYER_CONFIG[i];
    const zone = document.createElement('div');
    zone.className = `zone ${cfg.cls}`;
    zone.dataset.player = i;
    zone.innerHTML = `
      <div class="zone-header">
        <span class="zone-label">${cfg.label}</span>
        <div class="zone-info-row">
          <span class="zone-moves" id="frog-moves-${i}">이동 0</span>
          <button class="frog-reset-btn" id="frog-reset-${i}">↺ 처음부터</button>
        </div>
      </div>
      <div class="frog-board" id="frog-board-${i}"></div>
      <div class="stuck-notice" id="frog-stuck-${i}">막혔어요! 처음부터 버튼을 눌러요</div>`;
    frogZonesWrap.appendChild(zone);
    const resetBtn = document.getElementById(`frog-reset-${i}`);
    if (resetBtn) onTap(resetBtn, () => frogHandleReset(i));
  }
}

function frogGetZone(idx) { return frogZonesWrap.querySelector(`.zone[data-player="${idx}"]`); }

// ─── 렌더링 ───────────────────────────────────────────────
function frogRenderBoard(playerIdx) {
  const boardEl = document.getElementById(`frog-board-${playerIdx}`);
  if (!boardEl) return;
  boardEl.innerHTML = '';
  const board = frogBoards[playerIdx];
  const n = FROG_ROUND_N[frogRoundIdx % FROG_ROUND_N.length];
  const validMoves = frogGetMoves(board);
  const canMoveIdxs = new Set(validMoves.map(m => m.idx));

  for (let i = 0; i < board.length; i++) {
    const cell = document.createElement('div');
    const type = board[i];

    if (type === 'G') {
      cell.className = 'leaf-cell green-leaf';
      cell.textContent = '🐸';
      const arrow = document.createElement('span');
      arrow.className = 'frog-arrow';
      arrow.textContent = '→';
      cell.appendChild(arrow);
    } else if (type === 'Y') {
      cell.className = 'leaf-cell yellow-leaf';
      cell.textContent = '🐸';
      const arrow = document.createElement('span');
      arrow.className = 'frog-arrow';
      arrow.textContent = '←';
      cell.appendChild(arrow);
    } else {
      // 빈 잎
      cell.className = 'leaf-cell empty-leaf';
      cell.textContent = '';
    }

    if (type !== 'E') {
      if (canMoveIdxs.has(i)) {
        cell.classList.add('can-move');
      } else {
        cell.classList.add('blocked');
      }
      if (!frogSolved[playerIdx] && frogPhase === 'active') {
        const capturedIdx = i;
        onTap(cell, () => frogHandleTap(playerIdx, capturedIdx));
      }
    }

    boardEl.appendChild(cell);
  }

  // 막힘 표시
  const stuckEl = document.getElementById(`frog-stuck-${playerIdx}`);
  if (stuckEl) {
    if (frogStuck[playerIdx]) {
      stuckEl.classList.add('visible');
    } else {
      stuckEl.classList.remove('visible');
    }
  }
}

// ─── 조작 ───────────────────────────────────────────────────
function frogHandleTap(playerIdx, cellIdx) {
  if (frogPhase !== 'active' || frogSolved[playerIdx]) return;
  const board = frogBoards[playerIdx];
  const type = board[cellIdx];
  if (type === 'E') return;

  const validMoves = frogGetMoves(board);
  const move = validMoves.find(m => m.idx === cellIdx);
  if (!move) return; // 이동 불가 개구리 클릭 → 무시

  frogBoards[playerIdx] = frogApplyMove(board, cellIdx);
  frogMoves[playerIdx]++;

  const movesEl = document.getElementById(`frog-moves-${playerIdx}`);
  if (movesEl) movesEl.textContent = `이동 ${frogMoves[playerIdx]}`;

  frogSound.play(move.type === 'jump' ? 'jump' : 'hop');

  const n = FROG_ROUND_N[frogRoundIdx % FROG_ROUND_N.length];

  // 완성 체크
  if (frogIsComplete(frogBoards[playerIdx], n)) {
    frogHandleSolve(playerIdx);
    return;
  }

  // 막힘 체크
  frogStuck[playerIdx] = frogIsStuck(frogBoards[playerIdx], n);
  if (frogStuck[playerIdx]) frogSound.play('stuck');

  frogRenderBoard(playerIdx);
}

function frogHandleReset(playerIdx) {
  if (frogSolved[playerIdx]) return;
  const n = FROG_ROUND_N[frogRoundIdx % FROG_ROUND_N.length];
  frogBoards[playerIdx] = frogInitBoard(n);
  frogMoves[playerIdx] = 0;
  frogStuck[playerIdx] = false;
  const movesEl = document.getElementById(`frog-moves-${playerIdx}`);
  if (movesEl) movesEl.textContent = '이동 0';
  frogRenderBoard(playerIdx);
}

// ─── 라운드 결과 ───────────────────────────────────────────
function frogHandleSolve(winnerIdx) {
  if (frogSolved[winnerIdx]) return;
  frogSolved[winnerIdx] = true;
  const zone = frogGetZone(winnerIdx);
  if (zone) zone.classList.add('solved');

  if (frogRoundResults.length === frogRoundIdx) {
    frogRoundResults.push({ winnerIdx, timedOut: false });
    frogScores[winnerIdx]++;
    frogUpdateBarScore(winnerIdx);
    frogSound.play('ding');
    frogProblemStatus.textContent = `${FROG_PLAYER_CONFIG[winnerIdx].label} 완성! (${frogMoves[winnerIdx]}번 이동)`;
    for (let i = 0; i < frogPlayerCount; i++) {
      if (i !== winnerIdx && !frogSolved[i]) { const z = frogGetZone(i); if (z) z.classList.add('locked'); }
    }
    frogPhase = 'done';
    frogClearTimers();
    frogNextHandle = setTimeout(() => frogNextRound(), FROG_RESULT_PAUSE_MS);
  }
}

function frogHandleTimeout() {
  if (frogPhase !== 'active') return;
  frogPhase = 'done';
  frogSound.play('timeout');
  for (let i = 0; i < frogPlayerCount; i++) {
    if (!frogSolved[i]) { const z = frogGetZone(i); if (z) z.classList.add('locked'); }
  }
  frogRoundResults.push({ winnerIdx: -1, timedOut: true });
  frogProblemStatus.textContent = '시간 초과! 다음 라운드로';
  frogNextHandle = setTimeout(() => frogNextRound(), FROG_RESULT_PAUSE_MS);
}

// ─── 점수 바 ───────────────────────────────────────────────
function frogBuildScoreBar() {
  frogScoreBar.innerHTML = '';
  for (let i = 0; i < frogPlayerCount; i++) {
    const cfg = FROG_PLAYER_CONFIG[i];
    const chip = document.createElement('div');
    chip.className = 'score-chip';
    chip.innerHTML = `<span class="score-chip-dot" style="background:${cfg.dot}"></span><span>${cfg.label}</span><span class="score-chip-val" id="frog-bar-score-${i}">0</span>`;
    frogScoreBar.appendChild(chip);
  }
}
function frogUpdateBarScore(idx) { const el = document.getElementById(`frog-bar-score-${idx}`); if (el) el.textContent = frogScores[idx]; }

// ─── 타이머 ───────────────────────────────────────────────
function frogStartCountdown() {
  frogTimeRemaining = FROG_ROUND_TIME;
  frogProblemTimer.textContent = frogTimeRemaining;
  frogProblemTimer.classList.remove('urgent');
  frogTimerHandle = setInterval(() => {
    frogTimeRemaining--;
    frogProblemTimer.textContent = frogTimeRemaining;
    if (frogTimeRemaining <= 5) { frogProblemTimer.classList.add('urgent'); frogSound.play('tick'); }
    if (frogTimeRemaining <= 0) { frogClearTimers(); frogHandleTimeout(); }
  }, 1000);
}

// ─── 게임 흐름 ───────────────────────────────────────────────
function frogLoadRound() {
  frogPhase = 'active';
  const n = FROG_ROUND_N[frogRoundIdx % FROG_ROUND_N.length];
  frogBoards = [];
  frogMoves = [];
  frogSolved = [];
  frogStuck = [];

  for (let i = 0; i < frogPlayerCount; i++) {
    frogBoards.push(frogInitBoard(n));
    frogMoves.push(0);
    frogSolved.push(false);
    frogStuck.push(false);
    const zone = frogGetZone(i);
    if (zone) zone.classList.remove('solved', 'locked');
    const movesEl = document.getElementById(`frog-moves-${i}`);
    if (movesEl) movesEl.textContent = '이동 0';
    const stuckEl = document.getElementById(`frog-stuck-${i}`);
    if (stuckEl) stuckEl.classList.remove('visible');
  }

  frogQuestionCounter.textContent = `${frogRoundIdx + 1} / ${FROG_TOTAL_ROUNDS}`;
  frogProblemStatus.textContent = `${n}+${n} 개구리 자리 완전히 바꾸기!`;

  for (let i = 0; i < frogPlayerCount; i++) frogRenderBoard(i);
  frogStartCountdown();
}

function frogNextRound() {
  frogRoundIdx++;
  if (frogRoundIdx >= FROG_TOTAL_ROUNDS) frogShowResult();
  else frogLoadRound();
}

function frogStartGame() {
  frogRoundIdx = 0;
  frogScores = new Array(frogPlayerCount).fill(0);
  frogRoundResults = [];
  frogPhase = 'idle';
  frogClearTimers();
  frogBuildZones();
  frogBuildScoreBar();
  frogShowScreen(frogGameScreen);
  frogLoadRound();
}

function frogShowResult() {
  frogClearTimers();
  frogPhase = 'idle';
  frogSound.play('fanfare');
  const max = Math.max(...frogScores);
  const winners = frogScores.map((s, i) => ({ s, i })).filter(x => x.s === max).map(x => x.i);
  if (max === 0) { frogResultTitle.textContent = '무승부!'; frogResultWinner.textContent = '아무도 완성하지 못했어요.'; }
  else if (winners.length === 1) { frogResultTitle.textContent = '게임 종료!'; frogResultWinner.textContent = `${FROG_PLAYER_CONFIG[winners[0]].label} 우승! (${max}승)`; }
  else { const labels = winners.map(w => FROG_PLAYER_CONFIG[w].label).join(', '); frogResultTitle.textContent = '동점!'; frogResultWinner.textContent = `${labels} 공동 1위! (${max}승)`; }
  frogTotalRow.innerHTML = '';
  for (let i = 0; i < frogPlayerCount; i++) {
    const cfg = FROG_PLAYER_CONFIG[i]; const isWin = winners.includes(i) && max > 0;
    const chip = document.createElement('div'); chip.className = 'total-chip';
    chip.innerHTML = `<span class="chip-dot" style="background:${cfg.dot}"></span><span>${cfg.label}</span><span class="chip-score" style="color:${isWin ? '#2E7D32' : '#555'}">${frogScores[i]}승</span>${isWin ? '<span style="font-size:1.1rem;">★</span>' : ''}`;
    frogTotalRow.appendChild(chip);
  }
  frogShowScreen(frogResultScreen);
}

// ─── 인원 선택 ───────────────────────────────────────────────
document.querySelectorAll('.player-btn').forEach(btn => {
  onTap(btn, () => {
    document.querySelectorAll('.player-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    frogPlayerCount = parseInt(btn.dataset.count, 10);
  });
});

// ─── 이벤트 바인딩 ───────────────────────────────────────────
onTap(frogSoundToggleIntro, () => { frogSound.toggleMute(); frogUpdateSoundBtn(frogSoundToggleIntro); });
frogUpdateSoundBtn(frogSoundToggleIntro);
onTap(frogBackBtn, () => goHome());
onTap(frogCloseBtn, () => { frogClearTimers(); goHome(); });
onTap(frogHomeBtn, () => goHome());
onTap(frogRetryBtn, () => frogStartPreGameCountdown(() => frogStartGame()));
onTap(frogPlayBtn, () => frogStartPreGameCountdown(() => frogStartGame()));
