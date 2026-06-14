/* games/magic-square/game.js — 마방진, 퍼즐형 멀티(2~4인) 각자 보드 레이스 */
'use strict';

const MS_TOTAL_ROUNDS = 3;
const MS_ROUND_TIME = 90;
const MS_RESULT_PAUSE_MS = getAutoplayPauseMs(2000);
const MS_MAGIC_SUM = 15;

const MS_PLAYER_CONFIG = [
  { label: 'P1', dot: '#0288D1', cls: 'p1' },
  { label: 'P2', dot: '#E53935', cls: 'p2' },
  { label: 'P3', dot: '#388E3C', cls: 'p3' },
  { label: 'P4', dot: '#F57C00', cls: 'p4' },
];

// 기본 마방진 (2,7,6 / 9,5,1 / 4,3,8) 의 8가지 변형
// cells[0..8] = row-major: [r0c0, r0c1, r0c2, r1c0, ...]
// 중앙은 항상 cells[4] = 5
const MS_BASE_VARIANTS = [
  [2,7,6, 9,5,1, 4,3,8], // 원형
  [2,9,4, 7,5,3, 6,1,8], // 90° 회전
  [8,3,4, 1,5,9, 6,7,2], // 180° 회전
  [8,1,6, 3,5,7, 4,9,2], // 270° 회전
  [2,7,6, 9,5,1, 4,3,8].reverse(), // 좌우 반전
  [6,7,2, 1,5,9, 8,3,4], // 상하 반전
  [4,9,2, 3,5,7, 8,1,6], // 주대각선 반전
  [6,1,8, 7,5,3, 2,9,4], // 부대각선 반전
];

// ── 유일해 검증 ──
// 3×3 마방진에서 주어진 힌트로 남은 수 순열 대입 → 해 1개 확인
function msCountSolutions(givenCells) {
  // givenCells: 9개 배열, 0=비어있음, 1~9=주어진 수
  const blanks = [];
  const usedNums = new Set();
  for (let i = 0; i < 9; i++) {
    if (givenCells[i] !== 0) usedNums.add(givenCells[i]);
    else blanks.push(i);
  }
  const remaining = [];
  for (let n = 1; n <= 9; n++) if (!usedNums.has(n)) remaining.push(n);

  let count = 0;
  const cells = [...givenCells];

  function checkValid() {
    // rows
    for (let r = 0; r < 3; r++) {
      const s = cells[r*3] + cells[r*3+1] + cells[r*3+2];
      if (s !== MS_MAGIC_SUM) return false;
    }
    // cols
    for (let c = 0; c < 3; c++) {
      const s = cells[c] + cells[3+c] + cells[6+c];
      if (s !== MS_MAGIC_SUM) return false;
    }
    // diags
    if (cells[0]+cells[4]+cells[8] !== MS_MAGIC_SUM) return false;
    if (cells[2]+cells[4]+cells[6] !== MS_MAGIC_SUM) return false;
    return true;
  }

  function perm(start) {
    if (count > 1) return;
    if (start === blanks.length) {
      if (checkValid()) count++;
      return;
    }
    for (let i = start; i < remaining.length; i++) {
      [remaining[start], remaining[i]] = [remaining[i], remaining[start]];
      cells[blanks[start]] = remaining[start];
      perm(start + 1);
      cells[blanks[start]] = 0;
      [remaining[start], remaining[i]] = [remaining[i], remaining[start]];
    }
  }
  perm(0);
  return count;
}

// 라운드별 빈칸 수 (중앙 5는 항상 힌트 유지)
const MS_BLANK_COUNTS = [3, 5, 7];

// 라운드별 퍼즐 생성
let msPuzzleVariantIdx = 0;

function msMakePuzzle(roundIdx) {
  const variant = MS_BASE_VARIANTS[msPuzzleVariantIdx % MS_BASE_VARIANTS.length];
  msPuzzleVariantIdx++;
  const sol = [...variant];
  const centerIdx = 4; // 중앙은 항상 힌트
  const blanks = MS_BLANK_COUNTS[roundIdx];

  // 빈칸 후보: 중앙 제외
  const candidates = [0,1,2,3,5,6,7,8];
  // 셔플
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  // 유일해 보장 빈칸 선택
  const givenCells = [...sol];
  const blankSet = new Set();
  for (let i = 0; i < candidates.length && blankSet.size < blanks; i++) {
    const ci = candidates[i];
    const saved = givenCells[ci];
    givenCells[ci] = 0;
    blankSet.add(ci);
    const cnt = msCountSolutions(givenCells);
    if (cnt !== 1) {
      // 유일해 아님 → 이 칸은 제외
      givenCells[ci] = saved;
      blankSet.delete(ci);
    }
  }

  return { sol, blankSet, centerIdx };
}

// ── 사운드 ──
const msSound = createSoundManager({
  place(ctx) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type = 'sine';
    o.frequency.setValueAtTime(660, ctx.currentTime);
    g.gain.setValueAtTime(0.12, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.07);
    o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.07);
  },
  lineOk(ctx) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type = 'sine';
    o.frequency.setValueAtTime(784, ctx.currentTime);
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.17);
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

let msPlayerCount = 2;
let msRoundIdx = 0;
let msScores = [];
let msPhase = 'idle';
let msTimerHandle = null;
let msNextHandle = null;
let msTimeRemaining = MS_ROUND_TIME;
let msRoundFirstWinner = -1;
let msSolved = [];
let msBoards = [];   // [{ cells: [0..9], given: Set<idx>, sol: [] }]
let msSelected = []; // per player
let msCurrentPuzzle = null;

const msEl = id => document.getElementById(id);
const msIntroScreen = msEl('introScreen');
const msCountdownScreen = msEl('countdownScreen');
const msGameScreen = msEl('gameScreen');
const msResultScreen = msEl('resultScreen');
const msCountdownNumber = msEl('countdownNumber');
const msBackBtn = msEl('backBtn');
const msPlayBtn = msEl('playBtn');
const msCloseBtn = msEl('closeBtn');
const msRetryBtn = msEl('retryBtn');
const msHomeBtn = msEl('homeBtn');
const msZonesWrap = msEl('zonesWrap');
const msQuestionCounter = msEl('questionCounter');
const msProblemTimer = msEl('problemTimer');
const msProblemStatus = msEl('problemStatus');
const msScoreBar = msEl('scoreBar');
const msSoundToggleIntro = msEl('soundToggleIntro');
const msResultTitle = msEl('resultTitle');
const msResultWinner = msEl('resultWinner');
const msTotalRow = msEl('totalRow');

function msShowScreen(s) {
  [msIntroScreen, msCountdownScreen, msGameScreen, msResultScreen]
    .forEach(x => x.classList.remove('active'));
  s.classList.add('active');
}

let msCdInterval = null;
function msStartCountdown(onDone) {
  msShowScreen(msCountdownScreen);
  msCdInterval = runCountdown(msCountdownNumber, onDone);
}

function msClearTimers() {
  if (msCdInterval) { clearInterval(msCdInterval); msCdInterval = null; }
  if (msTimerHandle) { clearInterval(msTimerHandle); msTimerHandle = null; }
  if (msNextHandle) { clearTimeout(msNextHandle); msNextHandle = null; }
}


// ── 합 계산 ──
// lines: 각 라인별 합 (8개: row0,row1,row2,col0,col1,col2,diag1,diag2)
function msGetLineSums(cells) {
  return [
    cells[0]+cells[1]+cells[2],
    cells[3]+cells[4]+cells[5],
    cells[6]+cells[7]+cells[8],
    cells[0]+cells[3]+cells[6],
    cells[1]+cells[4]+cells[7],
    cells[2]+cells[5]+cells[8],
    cells[0]+cells[4]+cells[8],
    cells[2]+cells[4]+cells[6],
  ];
}

// 행/열/대각선 인덱스 목록
const MS_LINES = [
  [0,1,2], [3,4,5], [6,7,8],   // rows
  [0,3,6], [1,4,7], [2,5,8],   // cols
  [0,4,8], [2,4,6],            // diags
];

// 셀 인덱스가 포함된 라인의 합 배열 반환 (display용)
// sumDisplay: row합 [0..2], col합 [0..2], diag합 [0..1]
function msGetSumDisplay(cells) {
  return {
    rows: [cells[0]+cells[1]+cells[2], cells[3]+cells[4]+cells[5], cells[6]+cells[7]+cells[8]],
    cols: [cells[0]+cells[3]+cells[6], cells[1]+cells[4]+cells[7], cells[2]+cells[5]+cells[8]],
    diagTL: cells[0]+cells[4]+cells[8],
    diagTR: cells[2]+cells[4]+cells[6],
  };
}

function msIsComplete(cells, sol) {
  for (let i = 0; i < 9; i++) if (cells[i] !== sol[i]) return false;
  return true;
}

// ── 보드 렌더링 ──
// ms-outer 5×5 구조:
// [corner] [col0sum] [col1sum] [col2sum] [diagTR_label]
// [row0sum] [cell0]  [cell1]   [cell2]   [diag_label_right]
// [row1sum] [cell3]  [cell4]   [cell5]   [diag_label_right2]
// [row2sum] [cell6]  [cell7]   [cell8]   [diag_label_right3]
// [diagTL_label] [???] [???] [???] [corner2]
//
// 단순화: 가장자리에 합 표시
// outer grid: [corner, colSum0, colSum1, colSum2, corner]
//              [rowSum0, cell0, cell1, cell2, (diagTR one row)]
//              [rowSum1, cell3, cell4, cell5, ]
//              [rowSum2, cell6, cell7, cell8, ]
//              [corner, diagTL_label, ..., diagTR_label]
// → 5x5 = 25 요소로 실제 렌더

function msRenderBoard(playerIdx) {
  const zone = msGetZone(playerIdx);
  if (!zone) return;
  const bd = msBoards[playerIdx];
  const sumD = msGetSumDisplay(bd.cells);
  const selIdx = msSelected[playerIdx];

  const outerEl = zone.querySelector('.ms-outer');
  if (!outerEl) return;
  outerEl.innerHTML = '';

  // 5×5 구조로 렌더
  // row -1 (idx 0..4): corner, colSum0, colSum1, colSum2, corner(diagTR표시)
  // row 0 (idx 5..9): rowSum0, cell0, cell1, cell2, blank
  // row 1 (idx 10..14): rowSum1, cell3, cell4, cell5, blank
  // row 2 (idx 15..19): rowSum2, cell6, cell7, cell8, blank
  // row 3 (idx 20..24): diagTL, blank, blank, blank, diagTR

  function sumEl(val, label) {
    const el = document.createElement('div');
    el.className = 'ms-sum';
    // 빈 칸이 포함된 라인은 합 표시 (합이 0이면 대시)
    if (val === 0) {
      el.textContent = label || '-';
    } else {
      el.textContent = val;
      if (val === MS_MAGIC_SUM) el.classList.add('ok');
    }
    return el;
  }

  function cornerEl() {
    const el = document.createElement('div');
    el.className = 'ms-sum corner';
    return el;
  }

  // Row 0: corner, col합 0,1,2, corner
  outerEl.appendChild(cornerEl());
  for (let c = 0; c < 3; c++) {
    outerEl.appendChild(sumEl(sumD.cols[c]));
  }
  outerEl.appendChild(cornerEl());

  // Rows 1..3: rowSum, cell×3, blank
  for (let r = 0; r < 3; r++) {
    outerEl.appendChild(sumEl(sumD.rows[r]));
    for (let c = 0; c < 3; c++) {
      const ci = r * 3 + c;
      const cellEl = document.createElement('div');
      cellEl.className = 'ms-cell';
      if (bd.given.has(ci)) {
        cellEl.classList.add('locked');
        if (ci === 4) cellEl.classList.add('center-hint');
      }
      if (!bd.given.has(ci) && ci === selIdx) cellEl.classList.add('selected');
      const v = bd.cells[ci];
      cellEl.textContent = v > 0 ? v : '';
      if (!bd.given.has(ci)) {
        onTap(cellEl, () => msHandleCellTap(playerIdx, ci));
      }
      outerEl.appendChild(cellEl);
    }
    // 오른쪽 가장자리: 대각선 합 (row 0에 diagTR, row 2에 diagTL)
    if (r === 0) {
      outerEl.appendChild(sumEl(sumD.diagTR, '↗'));
    } else if (r === 2) {
      outerEl.appendChild(sumEl(sumD.diagTL, '↘'));
    } else {
      outerEl.appendChild(cornerEl());
    }
  }

  // 마지막 row: 코너만
  for (let i = 0; i < 5; i++) outerEl.appendChild(cornerEl());

  // 팔레트 업데이트
  msUpdatePalette(playerIdx);
}

function msGetZone(idx) {
  return msZonesWrap.querySelector(`.zone[data-player="${idx}"]`);
}

function msUpdatePalette(playerIdx) {
  const zone = msGetZone(playerIdx);
  if (!zone) return;
  const bd = msBoards[playerIdx];
  const usedNums = new Set();
  for (let i = 0; i < 9; i++) {
    if (bd.cells[i] > 0) usedNums.add(bd.cells[i]);
  }
  zone.querySelectorAll('.ms-palette-btn').forEach(btn => {
    const n = parseInt(btn.dataset.num, 10);
    btn.classList.toggle('used', usedNums.has(n) && !msPaletteIsCurrentSel(playerIdx, n));
  });
}

function msPaletteIsCurrentSel(playerIdx, n) {
  const sel = msSelected[playerIdx];
  if (sel < 0) return false;
  return msBoards[playerIdx].cells[sel] === n;
}

// ── 셀 탭 ──
function msHandleCellTap(playerIdx, cellIdx) {
  if (msPhase !== 'active' || msSolved[playerIdx]) return;
  const bd = msBoards[playerIdx];
  if (bd.given.has(cellIdx)) return;
  // 이미 선택된 칸 재탭 → 지우기
  if (msSelected[playerIdx] === cellIdx && bd.cells[cellIdx] !== 0) {
    bd.cells[cellIdx] = 0;
    msSelected[playerIdx] = cellIdx;
    msRenderBoard(playerIdx);
    return;
  }
  msSelected[playerIdx] = cellIdx;
  msRenderBoard(playerIdx);
}

// ── 팔레트 탭 ──
function msHandlePaletteTap(playerIdx, num) {
  if (msPhase !== 'active' || msSolved[playerIdx]) return;
  const sel = msSelected[playerIdx];
  if (sel < 0) return;
  const bd = msBoards[playerIdx];
  if (bd.given.has(sel)) return;

  // 이미 사용 중인 수 (다른 칸에서)
  const otherUse = bd.cells.findIndex((v, i) => v === num && i !== sel);
  if (otherUse >= 0) return; // 이미 다른 칸에 있음 — 팔레트 used 표시로 막힘

  // 재터치 → 지우기
  if (bd.cells[sel] === num) {
    bd.cells[sel] = 0;
    msRenderBoard(playerIdx);
    return;
  }
  bd.cells[sel] = num;
  msSound.play('place');
  msRenderBoard(playerIdx);

  // 완성 체크 — 모두 채우고 합 일치
  if (msIsComplete(bd.cells, bd.sol)) {
    msHandleSolve(playerIdx);
  } else {
    // 방금 채운 행/열/대각선이 15 맞으면 lineOk 음
    const sumD = msGetSumDisplay(bd.cells);
    const r = Math.floor(sel / 3), c = sel % 3;
    const rowFull = bd.cells[r*3]>0 && bd.cells[r*3+1]>0 && bd.cells[r*3+2]>0;
    const colFull = bd.cells[c]>0 && bd.cells[3+c]>0 && bd.cells[6+c]>0;
    if ((rowFull && sumD.rows[r] === MS_MAGIC_SUM) ||
        (colFull && sumD.cols[c] === MS_MAGIC_SUM)) {
      msSound.play('lineOk');
    }
  }
}

// ── 존 빌드 ──
function msBuildZones() {
  msZonesWrap.innerHTML = '';
  msZonesWrap.className = `zones-wrap p${msPlayerCount}`;
  for (let i = 0; i < msPlayerCount; i++) {
    const cfg = MS_PLAYER_CONFIG[i];
    const zone = document.createElement('div');
    zone.className = `zone ${cfg.cls}`;
    zone.dataset.player = i;
    zone.innerHTML = `
      <div class="zone-header">
        <span class="zone-label">${cfg.label}</span>
        <span class="zone-chips"><span class="zone-chip" id="ms-blanks-${i}">빈칸 ?</span></span>
      </div>
      <div class="ms-board-area">
        <div class="ms-outer" id="ms-outer-${i}"></div>
      </div>
      <div class="ms-palette" id="ms-palette-${i}"></div>`;
    msZonesWrap.appendChild(zone);
    // 팔레트 1~9
    const palette = zone.querySelector('.ms-palette');
    for (let n = 1; n <= 9; n++) {
      const btn = document.createElement('button');
      btn.className = 'ms-palette-btn';
      btn.textContent = n;
      btn.dataset.num = n;
      btn.setAttribute('aria-label', `${n}`);
      onTap(btn, () => msHandlePaletteTap(i, n));
      palette.appendChild(btn);
    }
  }
}

// ── 라운드 종료 ──
function msHandleSolve(playerIdx) {
  if (msSolved[playerIdx]) return;
  msSolved[playerIdx] = true;
  const zone = msGetZone(playerIdx);
  if (zone) zone.classList.add('solved');
  if (msRoundFirstWinner === -1) {
    msRoundFirstWinner = playerIdx;
    msScores[playerIdx]++;
    msRenderBarScore(playerIdx);
    msSound.play('ding');
    msProblemStatus.textContent = `${MS_PLAYER_CONFIG[playerIdx].label} 완성! ✨`;
    for (let i = 0; i < msPlayerCount; i++) {
      if (!msSolved[i]) { const z = msGetZone(i); if (z) z.classList.add('locked'); }
    }
    msPhase = 'done';
    msClearTimers();
    msNextHandle = setTimeout(() => msNextRound(), MS_RESULT_PAUSE_MS);
  }
}

function msHandleTimeout() {
  if (msPhase !== 'active') return;
  msPhase = 'done';
  msSound.play('timeout');
  for (let i = 0; i < msPlayerCount; i++) {
    if (!msSolved[i]) { const z = msGetZone(i); if (z) z.classList.add('locked'); }
  }
  if (msRoundFirstWinner === -1) msProblemStatus.textContent = '시간 초과! 다음 라운드로';
  msNextHandle = setTimeout(() => msNextRound(), MS_RESULT_PAUSE_MS);
}

// ── 점수 바 ──
function msBuildScoreBar() {
  msScoreBar.innerHTML = '';
  for (let i = 0; i < msPlayerCount; i++) {
    const cfg = MS_PLAYER_CONFIG[i];
    const chip = document.createElement('div');
    chip.className = 'score-chip';
    chip.innerHTML = `<span class="score-chip-dot" style="background:${cfg.dot}"></span><span>${cfg.label}</span><span class="score-chip-val" id="ms-bar-${i}">0</span>`;
    msScoreBar.appendChild(chip);
  }
}
function msRenderBarScore(idx) { const el = msEl(`ms-bar-${idx}`); if (el) el.textContent = msScores[idx]; }

// ── 타이머 ──
function msStartTimer() {
  msTimeRemaining = MS_ROUND_TIME;
  msProblemTimer.textContent = msTimeRemaining;
  msProblemTimer.classList.remove('urgent');
  msTimerHandle = setInterval(() => {
    msTimeRemaining--;
    msProblemTimer.textContent = msTimeRemaining;
    if (msTimeRemaining <= 10) { msProblemTimer.classList.add('urgent'); msSound.play('tick'); }
    if (msTimeRemaining <= 0) { msClearTimers(); msHandleTimeout(); }
  }, 1000);
}

// ── 게임 흐름 ──
function msLoadRound() {
  msPhase = 'active';
  msRoundFirstWinner = -1;
  msCurrentPuzzle = msMakePuzzle(msRoundIdx);
  msBoards = [];
  msSolved = [];
  msSelected = [];

  const blanks = MS_BLANK_COUNTS[msRoundIdx];

  for (let i = 0; i < msPlayerCount; i++) {
    const cells = [...msCurrentPuzzle.sol];
    const givenSet = new Set();
    // 주어진 칸 (블랭크가 아닌 칸 + 중앙은 항상 힌트)
    for (let ci = 0; ci < 9; ci++) {
      if (!msCurrentPuzzle.blankSet.has(ci)) givenSet.add(ci);
    }
    // 중앙은 반드시 힌트
    givenSet.add(msCurrentPuzzle.centerIdx);
    // 빈칸 초기화
    msCurrentPuzzle.blankSet.forEach(ci => {
      if (ci !== msCurrentPuzzle.centerIdx) cells[ci] = 0;
    });
    msBoards.push({ cells, given: givenSet, sol: msCurrentPuzzle.sol });
    msSolved.push(false);
    msSelected.push(-1);
    const zone = msGetZone(i);
    if (zone) zone.classList.remove('solved', 'locked');
    msRenderBoard(i);
    const blankChip = msEl(`ms-blanks-${i}`);
    if (blankChip) blankChip.textContent = `빈칸 ${blanks}개`;
  }

  msQuestionCounter.textContent = `${msRoundIdx + 1} / ${MS_TOTAL_ROUNDS}`;
  msProblemStatus.textContent = `합 ${MS_MAGIC_SUM}을 완성! (빈칸 ${blanks}개)`;
  msStartTimer();
}

function msNextRound() {
  msRoundIdx++;
  if (msRoundIdx >= MS_TOTAL_ROUNDS) msShowResult();
  else msLoadRound();
}

function msStartGame() {
  msRoundIdx = 0;
  msScores = new Array(msPlayerCount).fill(0);
  msPhase = 'idle';
  msPuzzleVariantIdx = 0;
  msClearTimers();
  msBuildZones();
  msBuildScoreBar();
  msShowScreen(msGameScreen);
  msLoadRound();
}

function msShowResult() {
  msClearTimers();
  msPhase = 'idle';
  msSound.play('fanfare');
  const max = Math.max(...msScores);
  const winners = msScores.map((s, i) => ({ s, i })).filter(x => x.s === max).map(x => x.i);
  if (max === 0) {
    msResultTitle.textContent = '무승부!';
    msResultWinner.textContent = '아무도 먼저 완성하지 못했어요.';
  } else if (winners.length === 1) {
    msResultTitle.textContent = '게임 종료!';
    msResultWinner.textContent = `${MS_PLAYER_CONFIG[winners[0]].label} 우승! (${max}승)`;
  } else {
    const labels = winners.map(w => MS_PLAYER_CONFIG[w].label).join(', ');
    msResultTitle.textContent = '동점!';
    msResultWinner.textContent = `${labels} 공동 1위! (${max}승)`;
  }
  msTotalRow.innerHTML = '';
  for (let i = 0; i < msPlayerCount; i++) {
    const cfg = MS_PLAYER_CONFIG[i];
    const isWin = winners.includes(i) && max > 0;
    const chip = document.createElement('div');
    chip.className = 'total-chip';
    chip.innerHTML = `<span class="chip-dot" style="background:${cfg.dot}"></span><span>${cfg.label}</span><span class="chip-score" style="color:${isWin ? '#2E7D32' : '#555'}">${msScores[i]}승</span>${isWin ? '<span style="font-size:1.1rem">★</span>' : ''}`;
    msTotalRow.appendChild(chip);
  }
  msShowScreen(msResultScreen);
}

// ── 이벤트 바인딩 ──
setupPlayerSelect(function (n) { msPlayerCount = n; });

setupSoundToggle(msSound, msSoundToggleIntro);
onTap(msBackBtn, () => goHome());
onTap(msCloseBtn, () => { msClearTimers(); goHome(); });
onTap(msHomeBtn, () => goHome());
onTap(msRetryBtn, () => msStartCountdown(() => msStartGame()));
onTap(msPlayBtn, () => msStartCountdown(() => msStartGame()));
