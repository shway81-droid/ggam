/* games/mini-sudoku/game.js — 그림 스도쿠, 퍼즐형 멀티(2~4인) 각자 보드 레이스 */
'use strict';

const SD_TOTAL_ROUNDS = 3;
const SD_ROUND_TIME = 90;
const SD_RESULT_PAUSE_MS = getAutoplayPauseMs(2000);

const SD_PLAYER_CONFIG = [
  { label: 'P1', dot: '#0288D1', cls: 'p1' },
  { label: 'P2', dot: '#E53935', cls: 'p2' },
  { label: 'P3', dot: '#388E3C', cls: 'p3' },
  { label: 'P4', dot: '#F57C00', cls: 'p4' },
];

const SD_EMOJIS = ['🍎', '🍌', '🍇', '🍉'];
// 이모지 인덱스: 0=🍎, 1=🍌, 2=🍇, 3=🍉, 0=empty

// 4×4 스도쿠 퍼즐 라이브러리 (하드코딩 10개)
// 각 퍼즐: solution(4×4 배열, 1-4 값), hintMask(어떤 칸이 주어지는지 bitset per row)
// 규칙: 행, 열, 2×2 박스에 1~4 각 1번
// 백트래킹 솔버로 유일해 자가검증 (로드시 console.warn)

// 모든 퍼즐의 기반 해
// sol[r][c] = 1..4
const SD_PUZZLES_SOLUTIONS = [
  // P0
  [[1,2,3,4],[3,4,1,2],[2,1,4,3],[4,3,2,1]],
  // P1
  [[1,2,3,4],[3,4,1,2],[2,3,4,1],[4,1,2,3]],
  // P2
  [[2,1,4,3],[4,3,2,1],[1,2,3,4],[3,4,1,2]],
  // P3
  [[3,4,1,2],[1,2,3,4],[4,3,2,1],[2,1,4,3]],
  // P4
  [[4,3,2,1],[2,1,4,3],[3,4,1,2],[1,2,3,4]],
  // P5
  [[1,3,2,4],[4,2,1,3],[2,4,3,1],[3,1,4,2]],
  // P6
  [[2,4,1,3],[1,3,4,2],[4,2,3,1],[3,1,2,4]],
  // P7
  [[3,1,4,2],[2,4,3,1],[1,3,2,4],[4,2,1,3]],
  // P8
  [[4,2,3,1],[3,1,2,4],[2,4,1,3],[1,3,4,2]],
  // P9
  [[2,3,4,1],[4,1,2,3],[3,4,1,2],[1,2,3,4]],
];

// ── 백트래킹 솔버 ──
function sdIsValidPlacement(board, r, c, val) {
  // row
  for (let cc = 0; cc < 4; cc++) if (cc !== c && board[r][cc] === val) return false;
  // col
  for (let rr = 0; rr < 4; rr++) if (rr !== r && board[rr][c] === val) return false;
  // 2×2 box
  const br = Math.floor(r / 2) * 2, bc = Math.floor(c / 2) * 2;
  for (let dr = 0; dr < 2; dr++) {
    for (let dc = 0; dc < 2; dc++) {
      const rr = br + dr, cc = bc + dc;
      if ((rr !== r || cc !== c) && board[rr][cc] === val) return false;
    }
  }
  return true;
}

function sdSolveCount(board, limit) {
  let count = 0;
  function bt() {
    if (count >= limit) return;
    let found = -1;
    for (let i = 0; i < 16; i++) {
      const r = Math.floor(i / 4), c = i % 4;
      if (board[r][c] === 0) { found = i; break; }
    }
    if (found === -1) { count++; return; }
    const r = Math.floor(found / 4), c = found % 4;
    for (let v = 1; v <= 4; v++) {
      if (sdIsValidPlacement(board, r, c, v)) {
        board[r][c] = v;
        bt();
        board[r][c] = 0;
        if (count >= limit) return;
      }
    }
  }
  bt();
  return count;
}

// 라이브러리 자가검증: 로드 시 실행
(function sdVerifyLibrary() {
  SD_PUZZLES_SOLUTIONS.forEach((sol, idx) => {
    // 솔루션 자체 유효성 체크
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const v = sol[r][c];
        const copy = sol.map(row => [...row]);
        copy[r][c] = 0;
        if (!sdIsValidPlacement(copy, r, c, v)) {
          console.warn(`[mini-sudoku] 퍼즐 ${idx} (${r},${c}) 솔루션 무결성 오류`);
        }
      }
    }
  });
})();

// 라운드별 빈칸 수
const SD_BLANK_COUNTS = [6, 8, 10];

// 퍼즐 인덱스 순환 (라운드별 다른 퍼즐)
let sdPuzzleOffset = 0;

// 유일해 검증 후 빈칸 마스크 생성
function sdMakePuzzle(roundIdx) {
  const sol = SD_PUZZLES_SOLUTIONS[sdPuzzleOffset % SD_PUZZLES_SOLUTIONS.length];
  sdPuzzleOffset++;
  const blanks = SD_BLANK_COUNTS[roundIdx];
  // 빈칸 위치 랜덤 선택 — 유일해 보장될 때까지 재시도
  const allCells = Array.from({ length: 16 }, (_, i) => i);
  // 셔플
  for (let i = allCells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allCells[i], allCells[j]] = [allCells[j], allCells[i]];
  }
  // 빈칸 후보를 하나씩 늘리며 유일해 확인
  const board = sol.map(row => [...row]);
  let blankSet = new Set();
  for (let i = 0; i < allCells.length && blankSet.size < blanks; i++) {
    const ci = allCells[i];
    const r = Math.floor(ci / 4), c = ci % 4;
    const saved = board[r][c];
    board[r][c] = 0;
    blankSet.add(ci);
    // 유일해 체크
    const testBoard = board.map(row => [...row]);
    const cnt = sdSolveCount(testBoard, 2);
    if (cnt !== 1) {
      // 유일해 아님 — 이 칸은 제외
      board[r][c] = saved;
      blankSet.delete(ci);
    }
  }
  // hint = 잠긴 칸 (비어있지 않은 칸)
  const given = []; // [{ r, c, val }]
  const blanksArr = [...blankSet];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (!blankSet.has(r * 4 + c)) {
        given.push({ r, c, val: sol[r][c] });
      }
    }
  }
  return { sol, blanksArr, given };
}

// ── 사운드 ──
const sdSound = createSoundManager({
  place(ctx) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type = 'sine';
    o.frequency.setValueAtTime(660, ctx.currentTime);
    g.gain.setValueAtTime(0.12, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.07);
    o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.07);
  },
  error(ctx) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type = 'sawtooth';
    o.frequency.setValueAtTime(220, ctx.currentTime);
    g.gain.setValueAtTime(0.18, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.14);
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

let sdPlayerCount = 2;
let sdRoundIdx = 0;
let sdScores = [];
let sdPhase = 'idle';
let sdTimerHandle = null;
let sdNextHandle = null;
let sdTimeRemaining = SD_ROUND_TIME;
let sdRoundFirstWinner = -1;
let sdSolved = [];
// 각 플레이어 보드 상태
let sdBoards = [];       // sdBoards[playerIdx] = { cells: number[], given: Set<idx>, sol: number[] }
let sdSelected = [];     // 선택된 칸 인덱스 (per player)
let sdCurrentPuzzle = null; // { sol, blanksArr, given }

const sdEl = id => document.getElementById(id);
const sdIntroScreen = sdEl('introScreen');
const sdCountdownScreen = sdEl('countdownScreen');
const sdGameScreen = sdEl('gameScreen');
const sdResultScreen = sdEl('resultScreen');
const sdCountdownNumber = sdEl('countdownNumber');
const sdBackBtn = sdEl('backBtn');
const sdPlayBtn = sdEl('playBtn');
const sdCloseBtn = sdEl('closeBtn');
const sdRetryBtn = sdEl('retryBtn');
const sdHomeBtn = sdEl('homeBtn');
const sdZonesWrap = sdEl('zonesWrap');
const sdQuestionCounter = sdEl('questionCounter');
const sdProblemTimer = sdEl('problemTimer');
const sdProblemStatus = sdEl('problemStatus');
const sdScoreBar = sdEl('scoreBar');
const sdSoundToggleIntro = sdEl('soundToggleIntro');
const sdResultTitle = sdEl('resultTitle');
const sdResultWinner = sdEl('resultWinner');
const sdTotalRow = sdEl('totalRow');

function sdShowScreen(s) {
  [sdIntroScreen, sdCountdownScreen, sdGameScreen, sdResultScreen]
    .forEach(x => x.classList.remove('active'));
  s.classList.add('active');
}

let sdCdInterval = null;
function sdStartCountdown(onDone) {
  sdShowScreen(sdCountdownScreen);
  let count = 3;
  sdCountdownNumber.textContent = count;
  sdCdInterval = setInterval(() => {
    count--;
    if (count <= 0) { clearInterval(sdCdInterval); sdCdInterval = null; onDone(); }
    else {
      sdCountdownNumber.textContent = count;
      sdCountdownNumber.style.animation = 'none';
      sdCountdownNumber.offsetHeight;
      sdCountdownNumber.style.animation = '';
    }
  }, 1000);
}

function sdClearTimers() {
  if (sdCdInterval) { clearInterval(sdCdInterval); sdCdInterval = null; }
  if (sdTimerHandle) { clearInterval(sdTimerHandle); sdTimerHandle = null; }
  if (sdNextHandle) { clearTimeout(sdNextHandle); sdNextHandle = null; }
}

function sdUpdateSoundBtn(btn) { btn.textContent = sdSound.isMuted() ? '🔇' : '🔊'; }

// ── 충돌 계산 ──
// 각 셀이 오류인지 반환 (Set of cell index)
function sdGetErrors(cells) {
  const errors = new Set();
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const idx = r * 4 + c;
      const v = cells[idx];
      if (v === 0) continue;
      // 행
      for (let cc = 0; cc < 4; cc++) {
        if (cc !== c && cells[r * 4 + cc] === v) { errors.add(idx); errors.add(r * 4 + cc); }
      }
      // 열
      for (let rr = 0; rr < 4; rr++) {
        if (rr !== r && cells[rr * 4 + c] === v) { errors.add(idx); errors.add(rr * 4 + c); }
      }
      // 2×2 박스
      const br = Math.floor(r / 2) * 2, bc = Math.floor(c / 2) * 2;
      for (let dr = 0; dr < 2; dr++) {
        for (let dc = 0; dc < 2; dc++) {
          const rr = br + dr, cc = bc + dc;
          if ((rr !== r || cc !== c) && cells[rr * 4 + cc] === v) {
            errors.add(idx); errors.add(rr * 4 + cc);
          }
        }
      }
    }
  }
  return errors;
}

function sdIsComplete(cells, sol) {
  for (let i = 0; i < 16; i++) {
    if (cells[i] !== sol[i]) return false;
  }
  return true;
}

// ── 보드 렌더링 ──
function sdRenderBoard(playerIdx) {
  const zone = sdGetZone(playerIdx);
  if (!zone) return;
  const bd = sdBoards[playerIdx];
  const errors = sdGetErrors(bd.cells);
  const selIdx = sdSelected[playerIdx];
  const gridEl = zone.querySelector('.sudoku-grid');
  if (!gridEl) return;
  gridEl.innerHTML = '';
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const idx = r * 4 + c;
      const cell = document.createElement('div');
      cell.className = 'sd-cell';
      // 박스 경계선
      if (c === 1) cell.classList.add('box-right');
      if (r === 1) cell.classList.add('box-bottom');
      if (bd.given.has(idx)) cell.classList.add('locked');
      if (errors.has(idx)) cell.classList.add('error');
      if (idx === selIdx && !bd.given.has(idx)) cell.classList.add('selected');
      const v = bd.cells[idx];
      if (v > 0) cell.textContent = SD_EMOJIS[v - 1];
      if (!bd.given.has(idx)) {
        onTap(cell, () => sdHandleCellTap(playerIdx, idx));
      }
      gridEl.appendChild(cell);
    }
  }
}

function sdGetZone(idx) {
  return sdZonesWrap.querySelector(`.zone[data-player="${idx}"]`);
}

// ── 셀 탭 ──
function sdHandleCellTap(playerIdx, cellIdx) {
  if (sdPhase !== 'active' || sdSolved[playerIdx]) return;
  const bd = sdBoards[playerIdx];
  if (bd.given.has(cellIdx)) return;
  // 이미 선택된 같은 칸 → 지우기
  if (sdSelected[playerIdx] === cellIdx && bd.cells[cellIdx] !== 0) {
    bd.cells[cellIdx] = 0;
    sdSelected[playerIdx] = cellIdx;
    sdRenderBoard(playerIdx);
    return;
  }
  sdSelected[playerIdx] = cellIdx;
  sdRenderBoard(playerIdx);
}

// ── 팔레트 탭 ──
function sdHandlePaletteTap(playerIdx, emojiIdx) {
  if (sdPhase !== 'active' || sdSolved[playerIdx]) return;
  const sel = sdSelected[playerIdx];
  if (sel === -1 || sel === undefined) return;
  const bd = sdBoards[playerIdx];
  if (bd.given.has(sel)) return;
  // 같은 이모지 재터치 → 지우기
  if (bd.cells[sel] === emojiIdx + 1) {
    bd.cells[sel] = 0;
    sdRenderBoard(playerIdx);
    return;
  }
  bd.cells[sel] = emojiIdx + 1;
  // 오류 체크
  const errors = sdGetErrors(bd.cells);
  if (errors.has(sel)) {
    sdSound.play('error');
  } else {
    sdSound.play('place');
  }
  sdRenderBoard(playerIdx);
  // 완성 체크
  if (sdIsComplete(bd.cells, sdCurrentPuzzle.sol)) {
    sdHandleSolve(playerIdx);
  }
}

// ── 존 빌드 ──
function sdBuildZones() {
  sdZonesWrap.innerHTML = '';
  sdZonesWrap.className = `zones-wrap p${sdPlayerCount}`;
  for (let i = 0; i < sdPlayerCount; i++) {
    const cfg = SD_PLAYER_CONFIG[i];
    const zone = document.createElement('div');
    zone.className = `zone ${cfg.cls}`;
    zone.dataset.player = i;
    zone.innerHTML = `
      <div class="zone-header">
        <span class="zone-label">${cfg.label}</span>
        <span class="zone-chips"><span class="zone-chip" id="sd-blanks-${i}">빈칸 ?</span></span>
      </div>
      <div class="sudoku-grid-wrap">
        <div class="sudoku-grid" id="sd-grid-${i}"></div>
      </div>
      <div class="palette" id="sd-palette-${i}"></div>`;
    sdZonesWrap.appendChild(zone);
    // 팔레트 버튼
    const palette = zone.querySelector('.palette');
    SD_EMOJIS.forEach((emoji, ei) => {
      const btn = document.createElement('button');
      btn.className = 'palette-btn';
      btn.textContent = emoji;
      btn.setAttribute('aria-label', emoji);
      onTap(btn, () => sdHandlePaletteTap(i, ei));
      palette.appendChild(btn);
    });
  }
}

// ── 라운드 결과 ──
function sdHandleSolve(playerIdx) {
  if (sdSolved[playerIdx]) return;
  sdSolved[playerIdx] = true;
  const zone = sdGetZone(playerIdx);
  if (zone) zone.classList.add('solved');
  if (sdRoundFirstWinner === -1) {
    sdRoundFirstWinner = playerIdx;
    sdScores[playerIdx]++;
    sdRenderBarScore(playerIdx);
    sdSound.play('ding');
    sdProblemStatus.textContent = `${SD_PLAYER_CONFIG[playerIdx].label} 완성! 🎉`;
    for (let i = 0; i < sdPlayerCount; i++) {
      if (!sdSolved[i]) { const z = sdGetZone(i); if (z) z.classList.add('locked'); }
    }
    sdPhase = 'done';
    sdClearTimers();
    sdNextHandle = setTimeout(() => sdNextRound(), SD_RESULT_PAUSE_MS);
  }
}

function sdHandleTimeout() {
  if (sdPhase !== 'active') return;
  sdPhase = 'done';
  sdSound.play('timeout');
  for (let i = 0; i < sdPlayerCount; i++) {
    if (!sdSolved[i]) { const z = sdGetZone(i); if (z) z.classList.add('locked'); }
  }
  if (sdRoundFirstWinner === -1) sdProblemStatus.textContent = '시간 초과! 다음 라운드로';
  sdNextHandle = setTimeout(() => sdNextRound(), SD_RESULT_PAUSE_MS);
}

// ── 점수 바 ──
function sdBuildScoreBar() {
  sdScoreBar.innerHTML = '';
  for (let i = 0; i < sdPlayerCount; i++) {
    const cfg = SD_PLAYER_CONFIG[i];
    const chip = document.createElement('div');
    chip.className = 'score-chip';
    chip.innerHTML = `<span class="score-chip-dot" style="background:${cfg.dot}"></span><span>${cfg.label}</span><span class="score-chip-val" id="sd-bar-${i}">0</span>`;
    sdScoreBar.appendChild(chip);
  }
}
function sdRenderBarScore(idx) { const el = sdEl(`sd-bar-${idx}`); if (el) el.textContent = sdScores[idx]; }

// ── 타이머 ──
function sdStartTimer() {
  sdTimeRemaining = SD_ROUND_TIME;
  sdProblemTimer.textContent = sdTimeRemaining;
  sdProblemTimer.classList.remove('urgent');
  sdTimerHandle = setInterval(() => {
    sdTimeRemaining--;
    sdProblemTimer.textContent = sdTimeRemaining;
    if (sdTimeRemaining <= 10) { sdProblemTimer.classList.add('urgent'); sdSound.play('tick'); }
    if (sdTimeRemaining <= 0) { sdClearTimers(); sdHandleTimeout(); }
  }, 1000);
}

// ── 게임 흐름 ──
function sdLoadRound() {
  sdPhase = 'active';
  sdRoundFirstWinner = -1;
  sdCurrentPuzzle = sdMakePuzzle(sdRoundIdx);
  sdBoards = [];
  sdSolved = [];
  sdSelected = [];

  const blanks = SD_BLANK_COUNTS[sdRoundIdx];

  for (let i = 0; i < sdPlayerCount; i++) {
    const cells = sdCurrentPuzzle.sol.map(row => [...row]).flat();
    const givenSet = new Set();
    // 주어진 칸 설정
    sdCurrentPuzzle.given.forEach(g => givenSet.add(g.r * 4 + g.c));
    // 빈칸 초기화
    sdCurrentPuzzle.blanksArr.forEach(ci => { cells[ci] = 0; });
    sdBoards.push({ cells, given: givenSet, sol: sdCurrentPuzzle.sol.flat() });
    sdSolved.push(false);
    sdSelected.push(-1);
    const zone = sdGetZone(i);
    if (zone) zone.classList.remove('solved', 'locked');
    sdRenderBoard(i);
    // 칩 업데이트
    const blankChip = sdEl(`sd-blanks-${i}`);
    if (blankChip) blankChip.textContent = `빈칸 ${blanks}개`;
  }

  sdQuestionCounter.textContent = `${sdRoundIdx + 1} / ${SD_TOTAL_ROUNDS}`;
  sdProblemStatus.textContent = `빈칸 ${blanks}개를 채워요!`;
  sdStartTimer();
}

function sdNextRound() {
  sdRoundIdx++;
  if (sdRoundIdx >= SD_TOTAL_ROUNDS) sdShowResult();
  else sdLoadRound();
}

function sdStartGame() {
  sdRoundIdx = 0;
  sdScores = new Array(sdPlayerCount).fill(0);
  sdPhase = 'idle';
  sdPuzzleOffset = 0;
  sdClearTimers();
  sdBuildZones();
  sdBuildScoreBar();
  sdShowScreen(sdGameScreen);
  sdLoadRound();
}

function sdShowResult() {
  sdClearTimers();
  sdPhase = 'idle';
  sdSound.play('fanfare');
  const max = Math.max(...sdScores);
  const winners = sdScores.map((s, i) => ({ s, i })).filter(x => x.s === max).map(x => x.i);
  if (max === 0) {
    sdResultTitle.textContent = '무승부!';
    sdResultWinner.textContent = '아무도 먼저 완성하지 못했어요.';
  } else if (winners.length === 1) {
    sdResultTitle.textContent = '게임 종료!';
    sdResultWinner.textContent = `${SD_PLAYER_CONFIG[winners[0]].label} 우승! (${max}승)`;
  } else {
    const labels = winners.map(w => SD_PLAYER_CONFIG[w].label).join(', ');
    sdResultTitle.textContent = '동점!';
    sdResultWinner.textContent = `${labels} 공동 1위! (${max}승)`;
  }
  sdTotalRow.innerHTML = '';
  for (let i = 0; i < sdPlayerCount; i++) {
    const cfg = SD_PLAYER_CONFIG[i];
    const isWin = winners.includes(i) && max > 0;
    const chip = document.createElement('div');
    chip.className = 'total-chip';
    chip.innerHTML = `<span class="chip-dot" style="background:${cfg.dot}"></span><span>${cfg.label}</span><span class="chip-score" style="color:${isWin ? '#2E7D32' : '#555'}">${sdScores[i]}승</span>${isWin ? '<span style="font-size:1.1rem">★</span>' : ''}`;
    sdTotalRow.appendChild(chip);
  }
  sdShowScreen(sdResultScreen);
}

// ── 이벤트 바인딩 ──
document.querySelectorAll('.player-btn').forEach(btn => {
  onTap(btn, () => {
    document.querySelectorAll('.player-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    sdPlayerCount = parseInt(btn.dataset.count, 10);
  });
});

onTap(sdSoundToggleIntro, () => { sdSound.toggleMute(); sdUpdateSoundBtn(sdSoundToggleIntro); });
sdUpdateSoundBtn(sdSoundToggleIntro);
onTap(sdBackBtn, () => goHome());
onTap(sdCloseBtn, () => { sdClearTimers(); goHome(); });
onTap(sdHomeBtn, () => goHome());
onTap(sdRetryBtn, () => sdStartCountdown(() => sdStartGame()));
onTap(sdPlayBtn, () => sdStartCountdown(() => sdStartGame()));
