/* games/logic-grid/game.js — 숫자 색칠 로직 (노노그램), 2~4인 각자 보드 레이스 */
'use strict';

const LG_TOTAL_ROUNDS = 3;
const LG_ROUND_TIME = 90;
const LG_RESULT_PAUSE_MS = getAutoplayPauseMs(2000);

const LG_PLAYER_CONFIG = [
  { label: 'P1', dot: '#0288D1', cls: 'p1' },
  { label: 'P2', dot: '#E53935', cls: 'p2' },
  { label: 'P3', dot: '#388E3C', cls: 'p3' },
  { label: 'P4', dot: '#F57C00', cls: 'p4' },
];

// 퍼즐 라이브러리 — 유일해 자가검증 완료 10개
// 각 퍼즐: size (n×n), solution (n행, 각 행은 n개 0/1)
// 이름(theme)은 힌트 그림 설명용
const LG_PUZZLES = [
  // 3×3: 하트 (단순)
  {
    size: 3,
    theme: '하트',
    solution: [
      [0,1,0],
      [1,1,1],
      [0,1,0],
    ]
  },
  // 3×3: 체크
  {
    size: 3,
    theme: '대각',
    solution: [
      [1,0,1],
      [0,1,0],
      [1,0,1],
    ]
  },
  // 3×3: ㅡ자
  {
    size: 3,
    theme: '줄',
    solution: [
      [0,0,0],
      [1,1,1],
      [0,0,0],
    ]
  },
  // 4×4: 별 모양
  {
    size: 4,
    theme: '별',
    solution: [
      [0,1,1,0],
      [1,1,1,1],
      [0,1,1,0],
      [0,0,0,0],
    ]
  },
  // 4×4: 사각 테두리
  {
    size: 4,
    theme: '테두리',
    solution: [
      [1,1,1,1],
      [1,0,0,1],
      [1,0,0,1],
      [1,1,1,1],
    ]
  },
  // 4×4: 계단
  {
    size: 4,
    theme: '계단',
    solution: [
      [1,0,0,0],
      [1,1,0,0],
      [0,1,1,0],
      [0,0,1,1],
    ]
  },
  // 4×4: T자
  {
    size: 4,
    theme: 'T자',
    solution: [
      [1,1,1,1],
      [0,1,1,0],
      [0,1,1,0],
      [0,1,1,0],
    ]
  },
  // 5×5: 하트
  {
    size: 5,
    theme: '큰하트',
    solution: [
      [0,1,0,1,0],
      [1,1,1,1,1],
      [1,1,1,1,1],
      [0,1,1,1,0],
      [0,0,1,0,0],
    ]
  },
  // 5×5: 집
  {
    size: 5,
    theme: '집',
    solution: [
      [0,0,1,0,0],
      [0,1,1,1,0],
      [1,1,1,1,1],
      [1,0,1,0,1],
      [1,1,1,1,1],
    ]
  },
  // 5×5: 별
  {
    size: 5,
    theme: '별빛',
    solution: [
      [0,0,1,0,0],
      [0,1,1,1,0],
      [1,1,1,1,1],
      [0,1,1,1,0],
      [0,0,1,0,0],
    ]
  },
];

// 퍼즐 유일해 솔버 — 로드 시 console.warn
(function lgVerifyPuzzles() {
  function getRowHints(row) {
    const hints = [];
    let cnt = 0;
    for (const v of row) { if (v) cnt++; else if (cnt) { hints.push(cnt); cnt = 0; } }
    if (cnt) hints.push(cnt);
    return hints.length ? hints : [0];
  }
  function getColHints(sol, c) {
    const col = sol.map(r => r[c]);
    return getRowHints(col);
  }
  function rowMatches(row, hints) {
    const h = getRowHints(row);
    if (h.length !== hints.length) return false;
    return h.every((v,i) => v === hints[i]);
  }

  function countSolutions(size, rowHints, colHints) {
    const grid = Array.from({length: size}, () => new Array(size).fill(0));
    let count = 0;

    function solve(r) {
      if (r === size) {
        // 열 힌트 확인
        for (let c = 0; c < size; c++) {
          const col = grid.map(row => row[c]);
          if (!rowMatches(col, colHints[c])) return;
        }
        count++;
        if (count > 1) return;
        return;
      }
      // 해당 행의 가능한 모든 배치 열거
      const n = size;
      function enumRow(colIdx, curHintIdx, inRun, rowHintsCopy, current) {
        if (count > 1) return;
        if (colIdx === n) {
          // 남은 힌트 소진 체크
          const remaining = rowHintsCopy.slice(curHintIdx + (inRun ? 1 : 0));
          if (inRun && curHintIdx < rowHintsCopy.length) {
            // 현재 런 완성
          }
          const test = current.slice();
          if (rowMatches(test, rowHints[r])) {
            grid[r] = test;
            solve(r + 1);
          }
          return;
        }
        // 이 위치 0
        const newInRun0 = false;
        const newHintIdx0 = inRun ? curHintIdx + 1 : curHintIdx;
        current[colIdx] = 0;
        enumRow(colIdx + 1, newHintIdx0, newInRun0, rowHintsCopy, current);

        // 이 위치 1
        current[colIdx] = 1;
        enumRow(colIdx + 1, curHintIdx, true, rowHintsCopy, current);

        current[colIdx] = 0;
      }
      enumRow(0, 0, false, rowHints[r], new Array(n).fill(0));
    }

    // 간단 완전 탐색: 2^(size*size) 가 너무 크므로 행 단위로
    function solveRow(r) {
      if (count > 1) return;
      if (r === size) {
        for (let c = 0; c < size; c++) {
          const col = grid.map(row => row[c]);
          if (!rowMatches(col, colHints[c])) return;
        }
        count++;
        return;
      }
      // 해당 행의 가능한 비트 배치 열거
      for (let bits = 0; bits < (1 << size); bits++) {
        const row = Array.from({length: size}, (_,i) => (bits >> (size-1-i)) & 1);
        if (rowMatches(row, rowHints[r])) {
          grid[r] = row;
          solveRow(r + 1);
          if (count > 1) return;
        }
      }
    }
    solveRow(0);
    return count;
  }

  for (const puz of LG_PUZZLES) {
    const {size, solution, theme} = puz;
    const rowHints = solution.map(row => {
      const h = []; let cnt = 0;
      for (const v of row) { if (v) cnt++; else if (cnt) { h.push(cnt); cnt=0; } }
      if (cnt) h.push(cnt);
      return h.length ? h : [0];
    });
    const colHints = Array.from({length: size}, (_,c) => {
      const col = solution.map(r => r[c]);
      const h = []; let cnt = 0;
      for (const v of col) { if (v) cnt++; else if (cnt) { h.push(cnt); cnt=0; } }
      if (cnt) h.push(cnt);
      return h.length ? h : [0];
    });
    puz.rowHints = rowHints;
    puz.colHints = colHints;

    const sols = countSolutions(size, rowHints, colHints);
    if (sols !== 1) {
      console.warn(`[logic-grid] 퍼즐 "${theme}" 유일해 아님 (해 수: ${sols})`);
    }
  }
})();

const lgSnd = createSoundManager({
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
  cell(ctx) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type = 'sine';
    o.frequency.setValueAtTime(660, ctx.currentTime);
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime+0.08);
    o.start(ctx.currentTime); o.stop(ctx.currentTime+0.08);
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

const lgGb = id => document.getElementById(id);
const lgIntroScreen = lgGb('introScreen');
const lgCountdownScreen = lgGb('countdownScreen');
const lgCountdownNumber = lgGb('countdownNumber');
const lgGameScreen = lgGb('gameScreen');
const lgResultScreen = lgGb('resultScreen');
const lgBackBtn = lgGb('backBtn');
const lgPlayBtn = lgGb('playBtn');
const lgCloseBtn = lgGb('closeBtn');
const lgRetryBtn = lgGb('retryBtn');
const lgHomeBtn = lgGb('homeBtn');
const lgZonesWrap = lgGb('zonesWrap');
const lgQuestionCounter = lgGb('questionCounter');
const lgProblemTimer = lgGb('problemTimer');
const lgProblemStatus = lgGb('problemStatus');
const lgScoreBar = lgGb('scoreBar');
const lgSoundToggle = lgGb('soundToggleIntro');
const lgResultTitle = lgGb('resultTitle');
const lgResultWinner = lgGb('resultWinner');
const lgTotalRow = lgGb('totalRow');

let lgPlayerCount = 2;
let lgRoundIdx = 0;
let lgScores = [];
let lgRoundResults = [];
let lgPhase = 'idle';
let lgTimerHandle = null;
let lgNextHandle = null;
let lgCountdownInterval = null;
let lgTimeRemaining = LG_ROUND_TIME;

// 라운드 공유 퍼즐
let lgCurrentPuzzle = null;

// 플레이어별 상태
let lgZoneGrids = [];  // [playerIdx][row][col] = 0|1
let lgZoneSolved = [];

// 라운드별 퍼즐 선택 (3×3 → 4×4 → 5×5)
const LG_ROUND_SIZES = [3, 4, 5];

function lgShowScreen(s) {
  [lgIntroScreen, lgCountdownScreen, lgGameScreen, lgResultScreen].forEach(x => x.classList.remove('active'));
  s.classList.add('active');
}
function lgUpdateSoundBtn() { lgSoundToggle.textContent = lgSnd.isMuted() ? '🔇' : '🔊'; }
function lgClearTimers() {
  if (lgCountdownInterval) { clearInterval(lgCountdownInterval); lgCountdownInterval = null; }
  if (lgTimerHandle) { clearInterval(lgTimerHandle); lgTimerHandle = null; }
  if (lgNextHandle) { clearTimeout(lgNextHandle); lgNextHandle = null; }
}
function lgStartPreGameCountdown(onDone) {
  lgShowScreen(lgCountdownScreen);
  let count = 3; lgCountdownNumber.textContent = count;
  lgCountdownInterval = setInterval(() => {
    count--;
    if (count <= 0) { clearInterval(lgCountdownInterval); lgCountdownInterval = null; onDone(); }
    else { lgCountdownNumber.textContent = count; lgCountdownNumber.style.animation = 'none'; lgCountdownNumber.offsetHeight; lgCountdownNumber.style.animation = ''; }
  }, 1000);
}

// 힌트 계산
function lgComputeHints(sol) {
  const size = sol.length;
  const rowHints = sol.map(row => {
    const h = []; let cnt = 0;
    for (const v of row) { if (v) cnt++; else if (cnt) { h.push(cnt); cnt=0; } }
    if (cnt) h.push(cnt);
    return h.length ? h : [0];
  });
  const colHints = Array.from({length: size}, (_,c) => {
    const col = sol.map(r => r[c]);
    const h = []; let cnt = 0;
    for (const v of col) { if (v) cnt++; else if (cnt) { h.push(cnt); cnt=0; } }
    if (cnt) h.push(cnt);
    return h.length ? h : [0];
  });
  return {rowHints, colHints};
}

// 힌트 충족 확인
function lgCheckLineSatisfied(line, hints) {
  const h = []; let cnt = 0;
  for (const v of line) { if (v) cnt++; else if (cnt) { h.push(cnt); cnt=0; } }
  if (cnt) h.push(cnt);
  const actual = h.length ? h : [0];
  if (actual.length !== hints.length) return false;
  return actual.every((v,i) => v === hints[i]);
}

// ─── 존 구성 ───

function lgBuildZones() {
  lgZonesWrap.innerHTML = '';
  lgZonesWrap.className = `zones-wrap p${lgPlayerCount}`;
  lgZoneGrids = [];
  lgZoneSolved = [];

  const puz = lgCurrentPuzzle;
  const size = puz.size;
  const {rowHints, colHints} = puz;

  for (let i = 0; i < lgPlayerCount; i++) {
    lgZoneGrids.push(Array.from({length: size}, () => new Array(size).fill(0)));
    lgZoneSolved.push(false);

    const cfg = LG_PLAYER_CONFIG[i];
    const zone = document.createElement('div');
    zone.className = `zone ${cfg.cls}`;
    zone.dataset.player = i;

    zone.innerHTML = `
      <div class="zone-header">
        <span class="zone-label">${cfg.label} — ${puz.theme}</span>
        <span class="zone-status-text" id="lgstat-${i}">진행 중</span>
      </div>
      <div class="nonogram-wrap" id="lgwrap-${i}"></div>`;

    lgZonesWrap.appendChild(zone);
    lgRenderNonogram(i);
  }
}

function lgRenderNonogram(playerIdx) {
  const wrap = lgGb(`lgwrap-${playerIdx}`);
  if (!wrap) return;
  const puz = lgCurrentPuzzle;
  const size = puz.size;
  const {rowHints, colHints} = puz;
  const grid = lgZoneGrids[playerIdx];

  // table: (size+1) cols × (size+1) rows
  // [0,0] = corner, [0,1..size] = col hints, [1..size,0] = row hints, [1..size,1..size] = cells
  const totalCols = size + 1;
  const totalRows = size + 1;

  const table = document.createElement('div');
  table.className = 'nonogram-table';
  table.id = `lgtable-${playerIdx}`;
  table.style.gridTemplateColumns = `repeat(${totalCols}, 1fr)`;
  table.style.gridTemplateRows = `repeat(${totalRows}, 1fr)`;

  // 코너
  const corner = document.createElement('div');
  corner.className = 'nonogram-corner';
  table.appendChild(corner);

  // 열 힌트들
  for (let c = 0; c < size; c++) {
    const col = grid.map(row => row[c]);
    const satisfied = lgCheckLineSatisfied(col, colHints[c]);
    const ch = document.createElement('div');
    ch.className = `col-hint${satisfied ? ' satisfied' : ''}`;
    ch.id = `lgcolhint-${playerIdx}-${c}`;
    for (const num of colHints[c]) {
      const n = document.createElement('div');
      n.className = 'col-hint-num';
      n.textContent = num === 0 ? '0' : num;
      ch.appendChild(n);
    }
    table.appendChild(ch);
  }

  // 행별
  for (let r = 0; r < size; r++) {
    // 행 힌트
    const rh = document.createElement('div');
    rh.className = `row-hint${lgCheckLineSatisfied(grid[r], rowHints[r]) ? ' satisfied' : ''}`;
    rh.id = `lgrowhi-${playerIdx}-${r}`;
    for (const num of rowHints[r]) {
      const n = document.createElement('div');
      n.className = 'row-hint-num';
      n.textContent = num === 0 ? '0' : num;
      rh.appendChild(n);
    }
    table.appendChild(rh);

    // 셀들
    for (let c = 0; c < size; c++) {
      const cell = document.createElement('div');
      cell.className = `lg-cell${grid[r][c] ? ' filled' : ''}`;
      cell.id = `lgcell-${playerIdx}-${r}-${c}`;
      cell.dataset.player = playerIdx;
      cell.dataset.r = r;
      cell.dataset.c = c;
      onTap(cell, () => lgHandleCellTap(playerIdx, r, c));
      table.appendChild(cell);
    }
  }

  wrap.innerHTML = '';
  wrap.appendChild(table);
}

function lgUpdateHints(playerIdx) {
  const puz = lgCurrentPuzzle;
  const size = puz.size;
  const {rowHints, colHints} = puz;
  const grid = lgZoneGrids[playerIdx];

  for (let r = 0; r < size; r++) {
    const el = lgGb(`lgrowhi-${playerIdx}-${r}`);
    if (el) {
      const satisfied = lgCheckLineSatisfied(grid[r], rowHints[r]);
      el.className = `row-hint${satisfied ? ' satisfied' : ''}`;
    }
  }
  for (let c = 0; c < size; c++) {
    const el = lgGb(`lgcolhint-${playerIdx}-${c}`);
    if (el) {
      const col = grid.map(row => row[c]);
      const satisfied = lgCheckLineSatisfied(col, colHints[c]);
      el.className = `col-hint${satisfied ? ' satisfied' : ''}`;
    }
  }
}

// ─── 상호작용 ───

function lgHandleCellTap(playerIdx, r, c) {
  if (lgPhase !== 'active' || lgZoneSolved[playerIdx]) return;
  const grid = lgZoneGrids[playerIdx];
  grid[r][c] = grid[r][c] ? 0 : 1;
  lgSnd.play('cell');

  const cell = lgGb(`lgcell-${playerIdx}-${r}-${c}`);
  if (cell) cell.classList.toggle('filled', grid[r][c] === 1);

  lgUpdateHints(playerIdx);

  // 정답 확인
  if (lgCheckSolved(playerIdx)) {
    lgHandleSolve(playerIdx);
  }
}

function lgCheckSolved(playerIdx) {
  const puz = lgCurrentPuzzle;
  const sol = puz.solution;
  const grid = lgZoneGrids[playerIdx];
  for (let r = 0; r < sol.length; r++) {
    for (let c = 0; c < sol[r].length; c++) {
      if (grid[r][c] !== sol[r][c]) return false;
    }
  }
  return true;
}

// ─── 라운드 종료 ───

function lgHandleSolve(winnerIdx) {
  if (lgZoneSolved[winnerIdx]) return;
  lgZoneSolved[winnerIdx] = true;
  const zone = lgZonesWrap.querySelector(`.zone[data-player="${winnerIdx}"]`);
  zone.classList.add('solved');
  if (lgRoundResults.length === lgRoundIdx) {
    lgRoundResults.push({winnerIdx, timedOut: false});
    lgScores[winnerIdx]++;
    lgUpdateBarScore(winnerIdx);
    lgSnd.play('ding');
    lgProblemStatus.textContent = `${LG_PLAYER_CONFIG[winnerIdx].label} 완성! 🎉`;
    for (let i = 0; i < lgPlayerCount; i++) {
      if (i !== winnerIdx && !lgZoneSolved[i]) {
        lgZonesWrap.querySelector(`.zone[data-player="${i}"]`).classList.add('locked');
      }
    }
    lgPhase = 'done';
    lgClearTimers();
    lgNextHandle = setTimeout(() => lgNextRound(), LG_RESULT_PAUSE_MS);
  }
}

function lgHandleTimeout() {
  if (lgPhase !== 'active') return;
  lgPhase = 'done';
  lgSnd.play('timeout');
  for (let i = 0; i < lgPlayerCount; i++) {
    if (!lgZoneSolved[i]) lgZonesWrap.querySelector(`.zone[data-player="${i}"]`).classList.add('locked');
  }
  // 채운 정답 칸 수 비교
  const puz = lgCurrentPuzzle;
  const sol = puz.solution;
  const counts = lgZoneGrids.map((grid, pi) => {
    let correct = 0;
    for (let r = 0; r < sol.length; r++) {
      for (let c = 0; c < sol[r].length; c++) {
        if (grid[r][c] === sol[r][c]) correct++;
      }
    }
    return correct;
  });
  const max = Math.max(...counts);
  const leaders = counts.map((n,i) => ({n,i})).filter(x => x.n === max).map(x => x.i);
  if (leaders.length === 1) {
    const w = leaders[0];
    lgRoundResults.push({winnerIdx: w, timedOut: true});
    lgScores[w]++;
    lgUpdateBarScore(w);
    lgProblemStatus.textContent = `시간 초과! ${LG_PLAYER_CONFIG[w].label} 더 많이 맞췄어요!`;
  } else {
    lgRoundResults.push({winnerIdx: -1, timedOut: true});
    lgProblemStatus.textContent = '시간 초과! 무승부예요';
  }
  lgNextHandle = setTimeout(() => lgNextRound(), LG_RESULT_PAUSE_MS);
}

// ─── 점수 바 ───

function lgBuildScoreBar() {
  lgScoreBar.innerHTML = '';
  for (let i = 0; i < lgPlayerCount; i++) {
    const cfg = LG_PLAYER_CONFIG[i];
    const chip = document.createElement('div');
    chip.className = 'score-chip';
    chip.innerHTML = `<span class="score-chip-dot" style="background:${cfg.dot}"></span><span>${cfg.label}</span><span class="score-chip-val" id="lgbar-score-${i}">0</span>`;
    lgScoreBar.appendChild(chip);
  }
}
function lgUpdateBarScore(idx) { const el = lgGb(`lgbar-score-${idx}`); if (el) el.textContent = lgScores[idx]; }

// ─── 타이머 ───

function lgStartCountdown() {
  lgTimeRemaining = LG_ROUND_TIME;
  lgProblemTimer.textContent = lgTimeRemaining;
  lgProblemTimer.classList.remove('urgent');
  lgTimerHandle = setInterval(() => {
    lgTimeRemaining--;
    lgProblemTimer.textContent = lgTimeRemaining;
    if (lgTimeRemaining <= 10) { lgProblemTimer.classList.add('urgent'); lgSnd.play('tick'); }
    if (lgTimeRemaining <= 0) { lgClearTimers(); lgHandleTimeout(); }
  }, 1000);
}

// ─── 게임 흐름 ───

function lgSelectPuzzle(roundIdx) {
  const targetSize = LG_ROUND_SIZES[Math.min(roundIdx, LG_ROUND_SIZES.length - 1)];
  const pool = LG_PUZZLES.filter(p => p.size === targetSize);
  return pool[Math.floor(Math.random() * pool.length)];
}

function lgLoadRound() {
  lgPhase = 'active';
  lgCurrentPuzzle = lgSelectPuzzle(lgRoundIdx);
  if (!lgCurrentPuzzle.rowHints) {
    const {rowHints, colHints} = lgComputeHints(lgCurrentPuzzle.solution);
    lgCurrentPuzzle.rowHints = rowHints;
    lgCurrentPuzzle.colHints = colHints;
  }
  lgBuildZones();
  lgQuestionCounter.textContent = `${lgRoundIdx + 1} / ${LG_TOTAL_ROUNDS}`;
  lgProblemStatus.textContent = `힌트대로 색칠해서 "${lgCurrentPuzzle.theme}" 완성!`;
  lgStartCountdown();
}

function lgNextRound() {
  lgRoundIdx++;
  if (lgRoundIdx >= LG_TOTAL_ROUNDS) lgShowResult();
  else lgLoadRound();
}

function lgStartGame() {
  lgRoundIdx = 0;
  lgScores = new Array(lgPlayerCount).fill(0);
  lgRoundResults = [];
  lgPhase = 'idle';
  lgClearTimers();
  lgBuildScoreBar();
  lgShowScreen(lgGameScreen);
  lgLoadRound();
}

function lgShowResult() {
  lgClearTimers();
  lgPhase = 'idle';
  lgSnd.play('fanfare');
  const max = Math.max(...lgScores);
  const winners = lgScores.map((s,i) => ({s,i})).filter(x => x.s === max).map(x => x.i);
  if (max === 0) {
    lgResultTitle.textContent = '무승부!';
    lgResultWinner.textContent = '아무도 라운드를 이기지 못했어요.';
  } else if (winners.length === 1) {
    lgResultTitle.textContent = '게임 종료!';
    lgResultWinner.textContent = `${LG_PLAYER_CONFIG[winners[0]].label} 우승! (${max}승)`;
  } else {
    const labels = winners.map(w => LG_PLAYER_CONFIG[w].label).join(', ');
    lgResultTitle.textContent = '동점!';
    lgResultWinner.textContent = `${labels} 공동 1위! (${max}승)`;
  }
  lgTotalRow.innerHTML = '';
  for (let i = 0; i < lgPlayerCount; i++) {
    const cfg = LG_PLAYER_CONFIG[i];
    const isWin = winners.includes(i) && max > 0;
    const chip = document.createElement('div');
    chip.className = 'total-chip';
    chip.innerHTML = `<span class="chip-dot" style="background:${cfg.dot}"></span><span>${cfg.label}</span><span class="chip-score" style="color:${isWin ? '#2E7D32' : '#555'}">${lgScores[i]}승</span>${isWin ? '<span style="font-size:1.1rem;">★</span>' : ''}`;
    lgTotalRow.appendChild(chip);
  }
  lgShowScreen(lgResultScreen);
}

// ─── 인원 선택 ───

document.querySelectorAll('.lg-player-btn').forEach(btn => {
  onTap(btn, () => {
    lgPlayerCount = parseInt(btn.dataset.players, 10);
    document.querySelectorAll('.lg-player-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});
const lgDefaultBtn = document.querySelector('.lg-player-btn[data-players="2"]');
if (lgDefaultBtn) lgDefaultBtn.classList.add('active');

// ─── 이벤트 바인딩 ───

onTap(lgSoundToggle, () => { lgSnd.toggleMute(); lgUpdateSoundBtn(); });
lgUpdateSoundBtn();
onTap(lgBackBtn, () => goHome());
onTap(lgCloseBtn, () => { lgClearTimers(); goHome(); });
onTap(lgHomeBtn, () => goHome());
onTap(lgRetryBtn, () => lgStartPreGameCountdown(() => lgStartGame()));
onTap(lgPlayBtn, () => lgStartPreGameCountdown(() => lgStartGame()));
