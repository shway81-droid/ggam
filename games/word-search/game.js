/* games/word-search/game.js — 낱말 찾기, 퍼즐형 2~4인 각자 보드 레이스 */
'use strict';

const WS_TOTAL_ROUNDS = 3;
const WS_ROUND_TIME = 90;
const WS_RESULT_PAUSE_MS = getAutoplayPauseMs(2000);

const WS_PLAYER_CONFIG = [
  { label: 'P1', dot: '#0288D1', cls: 'p1' },
  { label: 'P2', dot: '#E53935', cls: 'p2' },
  { label: 'P3', dot: '#388E3C', cls: 'p3' },
  { label: 'P4', dot: '#F57C00', cls: 'p4' },
];

// 단어 라이브러리 — 2~4글자 초등 명사 40개+
const WS_WORD_LIBRARY = [
  '사과','바나나','포도','수박','딸기',
  '학교','교실','친구','선생','공책',
  '나무','바다','하늘','구름','바람',
  '강아지','고양이','토끼','사자','코끼리',
  '자동차','기차','비행기','버스','배',
  '연필','지우개','가위','풀','색종이',
  '봄여름','가을','겨울','눈','비',
  '태양','달','별','지구','우주',
  '산','강','호수','사막','섬',
  '피자','김밥','라면','케이크','주스',
];

// 라운드별 격자 크기와 단어 길이 범위
const WS_ROUND_CONFIG = [
  { size: 5, minLen: 2, maxLen: 2 },
  { size: 6, minLen: 2, maxLen: 3 },
  { size: 6, minLen: 3, maxLen: 4 },
];

const wsSnd = createSoundManager({
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
  found(ctx) {
    [660,880].forEach((f,i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination); o.type = 'sine';
      const t = ctx.currentTime + i*0.08;
      o.frequency.setValueAtTime(f,t);
      g.gain.setValueAtTime(0.22,t);
      g.gain.exponentialRampToValueAtTime(0.001,t+0.22);
      o.start(t); o.stop(t+0.22);
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

const wsGb = id => document.getElementById(id);
const wsIntroScreen = wsGb('introScreen');
const wsCountdownScreen = wsGb('countdownScreen');
const wsCountdownNumber = wsGb('countdownNumber');
const wsGameScreen = wsGb('gameScreen');
const wsResultScreen = wsGb('resultScreen');
const wsBackBtn = wsGb('backBtn');
const wsPlayBtn = wsGb('playBtn');
const wsCloseBtn = wsGb('closeBtn');
const wsRetryBtn = wsGb('retryBtn');
const wsHomeBtn = wsGb('homeBtn');
const wsZonesWrap = wsGb('zonesWrap');
const wsQuestionCounter = wsGb('questionCounter');
const wsProblemTimer = wsGb('problemTimer');
const wsProblemStatus = wsGb('problemStatus');
const wsScoreBar = wsGb('scoreBar');
const wsSoundToggle = wsGb('soundToggleIntro');
const wsResultTitle = wsGb('resultTitle');
const wsResultWinner = wsGb('resultWinner');
const wsTotalRow = wsGb('totalRow');

let wsPlayerCount = 2;
let wsRoundIdx = 0;
let wsScores = [];
let wsRoundResults = [];
let wsPhase = 'idle';
let wsTimerHandle = null;
let wsNextHandle = null;
let wsCountdownInterval = null;
let wsTimeRemaining = WS_ROUND_TIME;

// 라운드 공유 퍼즐 데이터
let wsSharedGrid = [];   // 2D 배열 [row][col] = 글자
let wsSharedSize = 5;
let wsSharedWords = [];  // 목표 단어 3개
let wsWordPositions = []; // [{word, positions:[{r,c},...]}]

// 플레이어별 상태
let wsZoneStates = []; // [{foundMask: [bool,bool,bool], selecting: null | {r,c}, lockUntil: 0}]
let wsZoneSolved = [];

function wsShowScreen(s) {
  [wsIntroScreen, wsCountdownScreen, wsGameScreen, wsResultScreen].forEach(x => x.classList.remove('active'));
  s.classList.add('active');
}

function wsUpdateSoundBtn() { wsSoundToggle.textContent = wsSnd.isMuted() ? '🔇' : '🔊'; }

function wsClearTimers() {
  if (wsCountdownInterval) { clearInterval(wsCountdownInterval); wsCountdownInterval = null; }
  if (wsTimerHandle) { clearInterval(wsTimerHandle); wsTimerHandle = null; }
  if (wsNextHandle) { clearTimeout(wsNextHandle); wsNextHandle = null; }
}

function wsStartPreGameCountdown(onDone) {
  wsShowScreen(wsCountdownScreen);
  let count = 3; wsCountdownNumber.textContent = count;
  wsCountdownInterval = setInterval(() => {
    count--;
    if (count <= 0) { clearInterval(wsCountdownInterval); wsCountdownInterval = null; onDone(); }
    else { wsCountdownNumber.textContent = count; wsCountdownNumber.style.animation = 'none'; wsCountdownNumber.offsetHeight; wsCountdownNumber.style.animation = ''; }
  }, 1000);
}

// ─── 퍼즐 생성 ───

function wsPickWords(size, minLen, maxLen) {
  const pool = WS_WORD_LIBRARY.filter(w => w.length >= minLen && w.length <= maxLen && w.length <= size);
  // 셔플 후 3개 선택
  const shuffled = pool.slice().sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3);
}

function wsPlaceWords(size, words) {
  // 반복 시도로 배치
  for (let attempt = 0; attempt < 200; attempt++) {
    const grid = Array.from({length: size}, () => new Array(size).fill(''));
    const positions = [];
    let ok = true;

    for (const word of words) {
      const chars = word.split('');
      let placed = false;
      const dirs = Math.random() < 0.5 ? ['h','v'] : ['v','h'];
      for (let d = 0; d < dirs.length && !placed; d++) {
        const dir = dirs[d];
        // 모든 가능한 시작 위치 셔플
        const slots = [];
        if (dir === 'h') {
          for (let r = 0; r < size; r++)
            for (let c = 0; c <= size - chars.length; c++)
              slots.push({r, c, dir});
        } else {
          for (let r = 0; r <= size - chars.length; r++)
            for (let c = 0; c < size; c++)
              slots.push({r, c, dir});
        }
        slots.sort(() => Math.random() - 0.5);
        for (const {r, c, dir: slotDir} of slots) {
          let canPlace = true;
          for (let i = 0; i < chars.length; i++) {
            const gr = slotDir === 'h' ? r : r + i;
            const gc = slotDir === 'h' ? c + i : c;
            const existing = grid[gr][gc];
            if (existing !== '' && existing !== chars[i]) { canPlace = false; break; }
          }
          if (canPlace) {
            const pos = [];
            for (let i = 0; i < chars.length; i++) {
              const gr = slotDir === 'h' ? r : r + i;
              const gc = slotDir === 'h' ? c + i : c;
              grid[gr][gc] = chars[i];
              pos.push({r: gr, c: gc});
            }
            positions.push({word, positions: pos});
            placed = true;
            break;
          }
        }
      }
      if (!placed) { ok = false; break; }
    }

    if (!ok) continue;

    // 빈칸 채우기 — 목표 단어 글자 위주로
    const allChars = words.join('').split('');
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (grid[r][c] === '') {
          grid[r][c] = allChars[Math.floor(Math.random() * allChars.length)];
        }
      }
    }

    // 검증: 목표 단어가 의도치 않게 추가로 등장하는지 스캔
    if (!wsVerifyNoExtraWords(grid, size, words, positions)) continue;

    return {grid, positions};
  }
  return null; // 실패
}

function wsVerifyNoExtraWords(grid, size, words, knownPositions) {
  // knownPositions의 위치를 정규 위치로 마킹
  const knownKeys = new Set();
  for (const {word, positions} of knownPositions) {
    const key = positions.map(p => `${p.r},${p.c}`).join('|');
    knownKeys.add(word + ':' + key);
  }

  for (const word of words) {
    const chars = word.split('');
    const len = chars.length;

    // 가로 스캔
    for (let r = 0; r < size; r++) {
      for (let c = 0; c <= size - len; c++) {
        let match = true;
        for (let i = 0; i < len; i++) {
          if (grid[r][c+i] !== chars[i]) { match = false; break; }
        }
        if (match) {
          const pos = Array.from({length:len}, (_,i) => ({r, c:c+i}));
          const key = word + ':' + pos.map(p=>`${p.r},${p.c}`).join('|');
          if (!knownKeys.has(key)) return false; // 예상치 못한 추가 등장
        }
      }
    }

    // 세로 스캔
    for (let r = 0; r <= size - len; r++) {
      for (let c = 0; c < size; c++) {
        let match = true;
        for (let i = 0; i < len; i++) {
          if (grid[r+i][c] !== chars[i]) { match = false; break; }
        }
        if (match) {
          const pos = Array.from({length:len}, (_,i) => ({r:r+i, c}));
          const key = word + ':' + pos.map(p=>`${p.r},${p.c}`).join('|');
          if (!knownKeys.has(key)) return false;
        }
      }
    }
  }
  return true;
}

function wsGeneratePuzzle(roundIdx) {
  const cfg = WS_ROUND_CONFIG[Math.min(roundIdx, WS_ROUND_CONFIG.length - 1)];
  const size = cfg.size;

  for (let retry = 0; retry < 50; retry++) {
    const words = wsPickWords(size, cfg.minLen, cfg.maxLen);
    if (words.length < 3) continue;
    const result = wsPlaceWords(size, words);
    if (result) return {size, words, grid: result.grid, positions: result.positions};
  }
  // 최후 폴백: size=5, 2글자 단어
  const words = WS_WORD_LIBRARY.filter(w => w.length === 2).slice(0,3);
  const result = wsPlaceWords(5, words);
  return {size: 5, words, grid: result.grid, positions: result.positions};
}

// ─── 존 구성 ───

function wsBuildZones() {
  wsZonesWrap.innerHTML = '';
  wsZonesWrap.className = `zones-wrap p${wsPlayerCount}`;
  wsZoneStates = [];
  wsZoneSolved = [];

  for (let i = 0; i < wsPlayerCount; i++) {
    wsZoneStates.push({ foundMask: [false, false, false], selecting: null, lockUntil: 0 });
    wsZoneSolved.push(false);

    const cfg = WS_PLAYER_CONFIG[i];
    const zone = document.createElement('div');
    zone.className = `zone ${cfg.cls}`;
    zone.dataset.player = i;

    // 단어 목록
    const wordListHtml = wsSharedWords.map((w, wi) =>
      `<span class="word-chip" id="wc-${i}-${wi}">${w}</span>`
    ).join('');

    // 격자
    let gridCells = '';
    for (let r = 0; r < wsSharedSize; r++) {
      for (let c = 0; c < wsSharedSize; c++) {
        gridCells += `<div class="ws-cell" id="wscell-${i}-${r}-${c}" data-player="${i}" data-r="${r}" data-c="${c}">${wsSharedGrid[r][c]}</div>`;
      }
    }

    zone.innerHTML = `
      <div class="zone-header">
        <span class="zone-label">${cfg.label}</span>
        <span class="zone-score-badge" id="wscore-${i}">0 / 3</span>
      </div>
      <div class="word-list">${wordListHtml}</div>
      <div class="ws-grid" id="wsgrid-${i}" style="grid-template-columns:repeat(${wsSharedSize},1fr);grid-template-rows:repeat(${wsSharedSize},1fr);">${gridCells}</div>`;

    wsZonesWrap.appendChild(zone);

    // 셀 터치 바인딩
    for (let r = 0; r < wsSharedSize; r++) {
      for (let c = 0; c < wsSharedSize; c++) {
        const cell = wsGb(`wscell-${i}-${r}-${c}`);
        onTap(cell, () => wsHandleCellTap(i, r, c));
      }
    }
  }
}

function wsGetZone(idx) { return wsZonesWrap.querySelector(`.zone[data-player="${idx}"]`); }

// ─── 상호작용 ───

function wsHandleCellTap(playerIdx, r, c) {
  if (wsPhase !== 'active' || wsZoneSolved[playerIdx]) return;
  const now = Date.now();
  const st = wsZoneStates[playerIdx];
  if (now < st.lockUntil) return; // 잠금 중

  if (st.selecting === null) {
    // 첫 번째 터치 — 시작 칸 선택
    st.selecting = {r, c};
    wsHighlightCell(playerIdx, r, c, 'selecting');
  } else {
    // 두 번째 터치 — 판정
    const start = st.selecting;
    st.selecting = null;

    // 먼저 기존 selecting 하이라이트 제거
    wsClearSelectingHighlight(playerIdx);

    if (start.r === r && start.c === c) return; // 같은 칸 취소

    // 같은 행 또는 같은 열만 허용
    if (start.r !== r && start.c !== c) {
      wsShakeSelected(playerIdx, [start, {r, c}]);
      wsSnd.play('buzz');
      return;
    }

    // 선택된 칸들 목록 생성
    const selected = wsGetCellsBetween(start, {r, c});

    // 단어 판정
    const wordIdx = wsCheckWord(playerIdx, selected);
    if (wordIdx >= 0) {
      // 정답!
      wsMarkFound(playerIdx, wordIdx, selected);
      wsSnd.play('found');
      // 모두 찾았는지 확인
      if (wsZoneStates[playerIdx].foundMask.every(v => v)) {
        wsHandleSolve(playerIdx);
      }
    } else {
      // 오답 — 흔들림 + 0.5초 잠금
      wsShakeSelected(playerIdx, selected);
      wsSnd.play('buzz');
      st.lockUntil = Date.now() + 500;
    }
  }
}

function wsGetCellsBetween(start, end) {
  const cells = [];
  if (start.r === end.r) {
    const minC = Math.min(start.c, end.c);
    const maxC = Math.max(start.c, end.c);
    for (let c = minC; c <= maxC; c++) cells.push({r: start.r, c});
  } else {
    const minR = Math.min(start.r, end.r);
    const maxR = Math.max(start.r, end.r);
    for (let r = minR; r <= maxR; r++) cells.push({r, c: start.c});
  }
  return cells;
}

function wsCheckWord(playerIdx, selected) {
  const st = wsZoneStates[playerIdx];
  for (let wi = 0; wi < wsSharedWords.length; wi++) {
    if (st.foundMask[wi]) continue;
    const wordPos = wsWordPositions[wi].positions;
    if (wordPos.length !== selected.length) continue;
    // 순방향 확인
    let fwd = true;
    for (let i = 0; i < wordPos.length; i++) {
      if (wordPos[i].r !== selected[i].r || wordPos[i].c !== selected[i].c) { fwd = false; break; }
    }
    if (fwd) return wi;
    // 역방향 확인
    let rev = true;
    const rev2 = selected.slice().reverse();
    for (let i = 0; i < wordPos.length; i++) {
      if (wordPos[i].r !== rev2[i].r || wordPos[i].c !== rev2[i].c) { rev = false; break; }
    }
    if (rev) return wi;
  }
  return -1;
}

function wsHighlightCell(playerIdx, r, c, cls) {
  const cell = wsGb(`wscell-${playerIdx}-${r}-${c}`);
  if (cell) cell.classList.add(cls);
}

function wsClearSelectingHighlight(playerIdx) {
  const grid = wsGb(`wsgrid-${playerIdx}`);
  if (grid) grid.querySelectorAll('.ws-cell.selecting').forEach(el => el.classList.remove('selecting'));
}

function wsMarkFound(playerIdx, wordIdx, cells) {
  wsZoneStates[playerIdx].foundMask[wordIdx] = true;
  for (const {r,c} of cells) {
    const cell = wsGb(`wscell-${playerIdx}-${r}-${c}`);
    if (cell) { cell.classList.remove('selecting'); cell.classList.add('found-hi'); }
  }
  const chip = wsGb(`wc-${playerIdx}-${wordIdx}`);
  if (chip) chip.classList.add('found');
  const scoreBadge = wsGb(`wscore-${playerIdx}`);
  const found = wsZoneStates[playerIdx].foundMask.filter(v => v).length;
  if (scoreBadge) scoreBadge.textContent = `${found} / 3`;
}

function wsShakeSelected(playerIdx, cells) {
  for (const {r,c} of cells) {
    const cell = wsGb(`wscell-${playerIdx}-${r}-${c}`);
    if (cell) {
      cell.classList.remove('shake');
      cell.offsetHeight; // reflow
      cell.classList.add('shake');
      cell.classList.remove('selecting');
      setTimeout(() => { if (cell) cell.classList.remove('shake'); }, 500);
    }
  }
}

// ─── 라운드 종료 ───

function wsHandleSolve(winnerIdx) {
  if (wsZoneSolved[winnerIdx]) return;
  wsZoneSolved[winnerIdx] = true;
  const zone = wsGetZone(winnerIdx);
  zone.classList.add('solved');
  if (wsRoundResults.length === wsRoundIdx) {
    wsRoundResults.push({winnerIdx, timedOut: false});
    wsScores[winnerIdx]++;
    wsUpdateBarScore(winnerIdx);
    wsSnd.play('ding');
    wsProblemStatus.textContent = `${WS_PLAYER_CONFIG[winnerIdx].label} 완성!`;
    for (let i = 0; i < wsPlayerCount; i++) {
      if (i !== winnerIdx && !wsZoneSolved[i]) wsGetZone(i).classList.add('locked');
    }
    wsPhase = 'done';
    wsClearTimers();
    wsNextHandle = setTimeout(() => wsNextRound(), WS_RESULT_PAUSE_MS);
  }
}

function wsHandleTimeout() {
  if (wsPhase !== 'active') return;
  wsPhase = 'done';
  wsSnd.play('timeout');
  for (let i = 0; i < wsPlayerCount; i++) {
    if (!wsZoneSolved[i]) wsGetZone(i).classList.add('locked');
  }
  // 찾은 단어 수 비교
  const counts = wsZoneStates.map(st => st.foundMask.filter(v => v).length);
  const max = Math.max(...counts);
  const leaders = counts.map((n,i) => ({n,i})).filter(x => x.n === max).map(x => x.i);
  if (leaders.length === 1) {
    const w = leaders[0];
    wsRoundResults.push({winnerIdx: w, timedOut: true});
    wsScores[w]++;
    wsUpdateBarScore(w);
    wsProblemStatus.textContent = `시간 초과! ${WS_PLAYER_CONFIG[w].label} ${max}개로 승리!`;
  } else {
    wsRoundResults.push({winnerIdx: -1, timedOut: true});
    wsProblemStatus.textContent = '시간 초과! 무승부예요';
  }
  wsNextHandle = setTimeout(() => wsNextRound(), WS_RESULT_PAUSE_MS);
}

// ─── 점수 바 ───

function wsBuildScoreBar() {
  wsScoreBar.innerHTML = '';
  for (let i = 0; i < wsPlayerCount; i++) {
    const cfg = WS_PLAYER_CONFIG[i];
    const chip = document.createElement('div');
    chip.className = 'score-chip';
    chip.innerHTML = `<span class="score-chip-dot" style="background:${cfg.dot}"></span><span>${cfg.label}</span><span class="score-chip-val" id="wsbar-score-${i}">0</span>`;
    wsScoreBar.appendChild(chip);
  }
}
function wsUpdateBarScore(idx) { const el = wsGb(`wsbar-score-${idx}`); if (el) el.textContent = wsScores[idx]; }

// ─── 타이머 ───

function wsStartCountdown() {
  wsTimeRemaining = WS_ROUND_TIME;
  wsProblemTimer.textContent = wsTimeRemaining;
  wsProblemTimer.classList.remove('urgent');
  wsTimerHandle = setInterval(() => {
    wsTimeRemaining--;
    wsProblemTimer.textContent = wsTimeRemaining;
    if (wsTimeRemaining <= 10) { wsProblemTimer.classList.add('urgent'); wsSnd.play('tick'); }
    if (wsTimeRemaining <= 0) { wsClearTimers(); wsHandleTimeout(); }
  }, 1000);
}

// ─── 게임 흐름 ───

function wsLoadRound() {
  wsPhase = 'active';
  const puzzle = wsGeneratePuzzle(wsRoundIdx);
  wsSharedSize = puzzle.size;
  wsSharedWords = puzzle.words;
  wsSharedGrid = puzzle.grid;
  wsWordPositions = puzzle.positions;

  wsBuildZones();
  wsQuestionCounter.textContent = `${wsRoundIdx + 1} / ${WS_TOTAL_ROUNDS}`;
  wsProblemStatus.textContent = `낱말 3개를 먼저 찾아요! (${wsSharedSize}×${wsSharedSize})`;
  wsStartCountdown();
}

function wsNextRound() {
  wsRoundIdx++;
  if (wsRoundIdx >= WS_TOTAL_ROUNDS) wsShowResult();
  else wsLoadRound();
}

function wsStartGame() {
  wsRoundIdx = 0;
  wsScores = new Array(wsPlayerCount).fill(0);
  wsRoundResults = [];
  wsPhase = 'idle';
  wsClearTimers();
  wsBuildScoreBar();
  wsShowScreen(wsGameScreen);
  wsLoadRound();
}

function wsShowResult() {
  wsClearTimers();
  wsPhase = 'idle';
  wsSnd.play('fanfare');
  const max = Math.max(...wsScores);
  const winners = wsScores.map((s,i) => ({s,i})).filter(x => x.s === max).map(x => x.i);
  if (max === 0) {
    wsResultTitle.textContent = '무승부!';
    wsResultWinner.textContent = '아무도 라운드를 이기지 못했어요.';
  } else if (winners.length === 1) {
    wsResultTitle.textContent = '게임 종료!';
    wsResultWinner.textContent = `${WS_PLAYER_CONFIG[winners[0]].label} 우승! (${max}승)`;
  } else {
    const labels = winners.map(w => WS_PLAYER_CONFIG[w].label).join(', ');
    wsResultTitle.textContent = '동점!';
    wsResultWinner.textContent = `${labels} 공동 1위! (${max}승)`;
  }
  wsTotalRow.innerHTML = '';
  for (let i = 0; i < wsPlayerCount; i++) {
    const cfg = WS_PLAYER_CONFIG[i];
    const isWin = winners.includes(i) && max > 0;
    const chip = document.createElement('div');
    chip.className = 'total-chip';
    chip.innerHTML = `<span class="chip-dot" style="background:${cfg.dot}"></span><span>${cfg.label}</span><span class="chip-score" style="color:${isWin ? '#2E7D32' : '#555'}">${wsScores[i]}승</span>${isWin ? '<span style="font-size:1.1rem;">★</span>' : ''}`;
    wsTotalRow.appendChild(chip);
  }
  wsShowScreen(wsResultScreen);
}

// ─── 인원 선택 ───

document.querySelectorAll('.player-btn').forEach(btn => {
  onTap(btn, () => {
    wsPlayerCount = parseInt(btn.dataset.players, 10);
    document.querySelectorAll('.player-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});
// 기본 2명 활성화
const wsDefaultBtn = document.querySelector('.player-btn[data-players="2"]');
if (wsDefaultBtn) wsDefaultBtn.classList.add('active');

// ─── 이벤트 바인딩 ───

onTap(wsSoundToggle, () => { wsSnd.toggleMute(); wsUpdateSoundBtn(); });
wsUpdateSoundBtn();
onTap(wsBackBtn, () => goHome());
onTap(wsCloseBtn, () => { wsClearTimers(); goHome(); });
onTap(wsHomeBtn, () => goHome());
onTap(wsRetryBtn, () => wsStartPreGameCountdown(() => wsStartGame()));
onTap(wsPlayBtn, () => wsStartPreGameCountdown(() => wsStartGame()));
