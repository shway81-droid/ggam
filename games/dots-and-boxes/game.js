/* games/dots-and-boxes/game.js */

(function () {
  'use strict';

  // ─── 상수 ───────────────────────────────────────────────────────────────
  var GRID = 5;          // 5x5 dots → 4x4 boxes
  var COLS = GRID - 1;   // 4 boxes per row/col

  // 플레이어 색상
  var PLAYER_COLORS = ['#29B6F6', '#EF5350', '#66BB6A', '#FFA726'];
  var PLAYER_NAMES  = ['P1', 'P2', 'P3', 'P4'];

  // ─── 화면 전환 ────────────────────────────────────────────────────────────
  var screens = {
    intro:     document.getElementById('introScreen'),
    countdown: document.getElementById('countdownScreen'),
    game:      document.getElementById('gameScreen'),
    result:    document.getElementById('resultScreen')
  };

  function showScreen(name) {
    Object.keys(screens).forEach(function (key) {
      screens[key].classList.toggle('active', key === name);
    });
  }

  var countdownInterval = null;
  function startCountdown(onDone) {
    var countdownNumber = document.getElementById('countdownNumber');
    showScreen('countdown');
    countdownInterval = runCountdown(countdownNumber, onDone);
  }

  // ─── 사운드 ──────────────────────────────────────────────────────────────
  var sounds = createSoundManager({
    // 선 긋기: 짧고 경쾌한 클릭
    draw: function (ctx) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(360, ctx.currentTime + 0.07);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    },
    // 박스 완성: 명랑한 두 음
    box: function (ctx) {
      [[600, 0], [800, 0.1]].forEach(function (item) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = item[0];
        var t = ctx.currentTime + item[1];
        gain.gain.setValueAtTime(0.22, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.22);
      });
    },
    // 승리 팡파레: 밝은 상승 아르페지오
    win: function (ctx) {
      var notes = [523, 659, 784, 880, 1047];
      notes.forEach(function (freq, i) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        var t = ctx.currentTime + i * 0.11;
        gain.gain.setValueAtTime(0.22, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.4);
      });
    },
    // 무승부: 평이한 단음
    tie: function (ctx) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(350, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(250, ctx.currentTime + 0.45);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    },
    // 턴 변경 사운드 - P1 (높은 톤)
    turnP1: function (ctx) {
      [880, 1175].forEach(function (freq, i) {
        var osc = ctx.createOscillator(); var gain = ctx.createGain();
        osc.type = 'triangle'; osc.frequency.value = freq;
        var t = ctx.currentTime + i * 0.08;
        gain.gain.setValueAtTime(0.22, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(t); osc.stop(t + 0.2);
      });
    },
    // 턴 변경 - P2 (낮은 톤)
    turnP2: function (ctx) {
      [392, 523].forEach(function (freq, i) {
        var osc = ctx.createOscillator(); var gain = ctx.createGain();
        osc.type = 'triangle'; osc.frequency.value = freq;
        var t = ctx.currentTime + i * 0.08;
        gain.gain.setValueAtTime(0.22, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(t); osc.stop(t + 0.2);
      });
    },
    // 턴 변경 - P3 (중간 높음)
    turnP3: function (ctx) {
      [659, 880].forEach(function (freq, i) {
        var osc = ctx.createOscillator(); var gain = ctx.createGain();
        osc.type = 'triangle'; osc.frequency.value = freq;
        var t = ctx.currentTime + i * 0.08;
        gain.gain.setValueAtTime(0.22, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(t); osc.stop(t + 0.2);
      });
    },
    // 턴 변경 - P4 (중간 낮음)
    turnP4: function (ctx) {
      [494, 659].forEach(function (freq, i) {
        var osc = ctx.createOscillator(); var gain = ctx.createGain();
        osc.type = 'triangle'; osc.frequency.value = freq;
        var t = ctx.currentTime + i * 0.08;
        gain.gain.setValueAtTime(0.22, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(t); osc.stop(t + 0.2);
      });
    }
  });

  // 사운드 버튼 동기화
  var soundBtns = [
    document.getElementById('soundToggleIntro'),
    document.getElementById('soundToggleGame')
  ];

  function updateSoundBtns() {
    var icon = sounds.isMuted() ? '🔇' : '🔊';
    soundBtns.forEach(function (btn) { btn.textContent = icon; });
  }

  soundBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      sounds.toggleMute();
      updateSoundBtns();
    });
  });

  updateSoundBtns();

  // ─── 인트로: 플레이어 수 선택 ─────────────────────────────────────────────
  var selectedCount = 2;
  var playerCountBtns = document.querySelectorAll('.player-count-btn');

  playerCountBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      selectedCount = parseInt(btn.getAttribute('data-count'), 10);
      playerCountBtns.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
    });
  });

  // ─── 게임 상태 ────────────────────────────────────────────────────────────
  /*
   * hLines[row][col] = playerIndex (0-based) | -1 (undrawn)
   *   row: 0..GRID-1 (5 rows of horizontal lines)
   *   col: 0..GRID-2 (4 per row)
   *
   * vLines[row][col] = playerIndex | -1
   *   row: 0..GRID-2 (4 rows)
   *   col: 0..GRID-1 (5 per row)
   *
   * boxes[row][col] = playerIndex | -1
   *   row,col: 0..GRID-2 (4x4)
   */
  var hLines, vLines, boxes;
  var scores;          // scores[playerIndex] = number of boxes
  var currentPlayer;   // 0-based index
  var numPlayers;
  var gameOver;

  // ─── DOM ─────────────────────────────────────────────────────────────────
  var scoreboardEl    = document.getElementById('scoreboard');
  var boardContainer  = document.getElementById('boardContainer');
  var turnDot         = document.getElementById('turnDot');
  var turnText        = document.getElementById('turnText');
  var resultEmoji     = document.getElementById('resultEmoji');
  var resultTitle     = document.getElementById('resultTitle');
  var resultSub       = document.getElementById('resultSub');
  var resultScoresEl  = document.getElementById('resultScores');
  var resultBoardPrev = document.getElementById('resultBoardPreview');

  // ─── 보드 크기 계산 ──────────────────────────────────────────────────────
  function getBoardSize() {
    // Available space (roughly square)
    var vh = window.innerHeight;
    var vw = window.innerWidth;
    // Header ~64px, scoreboard ~48px, some padding
    var maxH = vh - 64 - 56 - 32;
    var maxW = vw - 24;
    var size = Math.min(maxH, maxW, 400);
    return Math.max(size, 240);
  }

  // ─── 게임 초기화 ──────────────────────────────────────────────────────────
  function initGame() {
    numPlayers = selectedCount;
    currentPlayer = 0;
    gameOver = false;

    // 상태 배열 초기화
    hLines = [];
    for (var r = 0; r < GRID; r++) {
      hLines[r] = [];
      for (var c = 0; c < COLS; c++) hLines[r][c] = -1;
    }

    vLines = [];
    for (var r2 = 0; r2 < COLS; r2++) {
      vLines[r2] = [];
      for (var c2 = 0; c2 < GRID; c2++) vLines[r2][c2] = -1;
    }

    boxes = [];
    for (var r3 = 0; r3 < COLS; r3++) {
      boxes[r3] = [];
      for (var c3 = 0; c3 < COLS; c3++) boxes[r3][c3] = -1;
    }

    scores = [];
    for (var i = 0; i < numPlayers; i++) scores[i] = 0;

    buildScoreboard();
    buildBoard();
    updateTurnUI();
    showScreen('game');
  }

  // ─── 점수판 빌드 ──────────────────────────────────────────────────────────
  function buildScoreboard() {
    scoreboardEl.innerHTML = '';
    for (var i = 0; i < numPlayers; i++) {
      var chip = document.createElement('div');
      chip.className = 'score-chip' + (i === 0 ? ' active-player' : '');
      chip.id = 'scoreChip' + i;
      chip.style.color = PLAYER_COLORS[i];

      var dot = document.createElement('span');
      dot.className = 'score-dot';
      dot.style.background = PLAYER_COLORS[i];

      var label = document.createElement('span');
      label.className = 'score-label';
      label.innerHTML = PLAYER_NAMES[i] + ' <span class="score-num" id="scoreNum' + i + '">0</span>';

      chip.appendChild(dot);
      chip.appendChild(label);
      scoreboardEl.appendChild(chip);
    }
  }

  function updateScoreUI() {
    for (var i = 0; i < numPlayers; i++) {
      var numEl = document.getElementById('scoreNum' + i);
      if (numEl) numEl.textContent = scores[i];

      var chip = document.getElementById('scoreChip' + i);
      if (chip) chip.classList.toggle('active-player', i === currentPlayer);
    }
  }

  // ─── 턴 UI ────────────────────────────────────────────────────────────────
  function updateTurnUI(announce) {
    turnDot.style.background = PLAYER_COLORS[currentPlayer];
    turnText.textContent = PLAYER_NAMES[currentPlayer] + '의 차례';
    updateScoreUI();

    // 방안 B: 게임 화면 전체 두꺼운 컬러 테두리
    var gameScreen = document.getElementById('gameScreen');
    if (gameScreen) {
      gameScreen.classList.remove('turn-p1', 'turn-p2', 'turn-p3', 'turn-p4');
      gameScreen.classList.add('turn-p' + (currentPlayer + 1));
    }

    if (announce) {
      // 방안 A: 풀스크린 오버레이
      showTurnOverlay();
      // 방안 D: 사운드
      sounds.play('turnP' + (currentPlayer + 1));
    }
  }

  // ─── 풀스크린 턴 변경 오버레이 ──────────────────────────────────────────
  function showTurnOverlay() {
    var overlay = document.getElementById('turnOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'turnOverlay';
      overlay.className = 'turn-overlay';
      overlay.innerHTML = '<div class="turn-overlay-text"></div>';
      document.body.appendChild(overlay);
    }
    var pCls = 'p' + (currentPlayer + 1);
    overlay.className = 'turn-overlay show ' + pCls;
    overlay.querySelector('.turn-overlay-text').textContent =
      '⚡ ' + PLAYER_NAMES[currentPlayer] + ' 차례 ⚡';
    void overlay.offsetWidth;
    setTimeout(function () {
      overlay.classList.remove('show');
    }, 600);
  }

  // ─── 보드 빌드 ────────────────────────────────────────────────────────────
  /*
   * 레이아웃:
   *   boardSize x boardSize 컨테이너
   *   GRID x GRID 점을 균등 간격으로 배치
   *   점 사이의 선 영역을 클릭 가능한 div로 생성
   *   박스 채우기 div를 점 사이의 영역에 생성
   */

  var cellSize;      // px per grid cell
  var dotR = 6;      // dot radius px
  var hitThick = 36; // hit area thickness

  // DOM 요소 참조 캐시
  var hLineEls = [];  // hLineEls[r][c] = div
  var vLineEls = [];  // vLineEls[r][c] = div
  var boxEls   = [];  // boxEls[r][c] = div

  function buildBoard() {
    boardContainer.innerHTML = '';
    boardContainer.classList.remove('done');

    var size = getBoardSize();
    boardContainer.style.width  = size + 'px';
    boardContainer.style.height = size + 'px';

    cellSize = size / (GRID - 1);
    dotR = Math.max(5, Math.round(cellSize * 0.095));

    // Box fill divs (below lines)
    boxEls = [];
    for (var br = 0; br < COLS; br++) {
      boxEls[br] = [];
      for (var bc = 0; bc < COLS; bc++) {
        var boxDiv = document.createElement('div');
        boxDiv.className = 'box-fill';
        var bx = bc * cellSize + dotR;
        var by = br * cellSize + dotR;
        var bw = cellSize - dotR * 2;
        var bh = cellSize - dotR * 2;
        boxDiv.style.left   = bx + 'px';
        boxDiv.style.top    = by + 'px';
        boxDiv.style.width  = bw + 'px';
        boxDiv.style.height = bh + 'px';
        boxDiv.style.opacity = '0';
        boardContainer.appendChild(boxDiv);
        boxEls[br][bc] = boxDiv;
      }
    }

    // Horizontal line hit areas
    hLineEls = [];
    for (var hr = 0; hr < GRID; hr++) {
      hLineEls[hr] = [];
      for (var hc = 0; hc < COLS; hc++) {
        (function (row, col) {
          var hitDiv = makeLineHit('h', row, col);
          boardContainer.appendChild(hitDiv);
          hLineEls[row][col] = hitDiv;
        })(hr, hc);
      }
    }

    // Vertical line hit areas
    vLineEls = [];
    for (var vr = 0; vr < COLS; vr++) {
      vLineEls[vr] = [];
      for (var vc = 0; vc < GRID; vc++) {
        (function (row, col) {
          var hitDiv = makeLineHit('v', row, col);
          boardContainer.appendChild(hitDiv);
          vLineEls[row][col] = hitDiv;
        })(vr, vc);
      }
    }

    // Dots (on top)
    for (var dr = 0; dr < GRID; dr++) {
      for (var dc = 0; dc < GRID; dc++) {
        var dot = document.createElement('div');
        dot.className = 'dot';
        dot.style.width  = (dotR * 2) + 'px';
        dot.style.height = (dotR * 2) + 'px';
        dot.style.left   = (dc * cellSize) + 'px';
        dot.style.top    = (dr * cellSize) + 'px';
        boardContainer.appendChild(dot);
      }
    }
  }

  function makeLineHit(dir, row, col) {
    var hitDiv = document.createElement('div');
    hitDiv.className = 'line-hit';
    hitDiv.setAttribute('data-dir', dir);
    hitDiv.setAttribute('data-row', row);
    hitDiv.setAttribute('data-col', col);

    var visualDiv = document.createElement('div');
    visualDiv.className = 'line-visual';

    if (dir === 'h') {
      // Horizontal: spans from dot(row,col) to dot(row,col+1)
      var lineLen = cellSize - dotR * 2;
      var hx = col * cellSize + dotR;
      var hy = row * cellSize - hitThick / 2;

      hitDiv.style.left   = hx + 'px';
      hitDiv.style.top    = hy + 'px';
      hitDiv.style.width  = lineLen + 'px';
      hitDiv.style.height = hitThick + 'px';

      var lineH = Math.max(5, Math.round(cellSize * 0.07));
      visualDiv.style.left   = '0';
      visualDiv.style.top    = ((hitThick - lineH) / 2) + 'px';
      visualDiv.style.width  = '100%';
      visualDiv.style.height = lineH + 'px';
    } else {
      // Vertical: spans from dot(row,col) to dot(row+1,col)
      var lineLen2 = cellSize - dotR * 2;
      var vx = col * cellSize - hitThick / 2;
      var vy = row * cellSize + dotR;

      hitDiv.style.left   = vx + 'px';
      hitDiv.style.top    = vy + 'px';
      hitDiv.style.width  = hitThick + 'px';
      hitDiv.style.height = lineLen2 + 'px';

      var lineW = Math.max(5, Math.round(cellSize * 0.07));
      visualDiv.style.top    = '0';
      visualDiv.style.left   = ((hitThick - lineW) / 2) + 'px';
      visualDiv.style.width  = lineW + 'px';
      visualDiv.style.height = '100%';
    }

    // Initial state: very faint
    visualDiv.style.background = '#B0BEC5';
    visualDiv.style.opacity    = '0.25';
    hitDiv.appendChild(visualDiv);

    // Hover effect (only when not drawn)
    hitDiv.addEventListener('mouseenter', function () {
      if (!hitDiv.classList.contains('drawn')) {
        visualDiv.style.background = PLAYER_COLORS[currentPlayer];
        visualDiv.style.opacity    = '0.45';
      }
    });
    hitDiv.addEventListener('mouseleave', function () {
      if (!hitDiv.classList.contains('drawn')) {
        visualDiv.style.background = '#B0BEC5';
        visualDiv.style.opacity    = '0.25';
      }
    });

    onTap(hitDiv, function () {
      if (gameOver) return;
      var d   = hitDiv.getAttribute('data-dir');
      var r   = parseInt(hitDiv.getAttribute('data-row'), 10);
      var c   = parseInt(hitDiv.getAttribute('data-col'), 10);
      handleLineTap(d, r, c, hitDiv, visualDiv);
    });

    return hitDiv;
  }

  // ─── 선 탭 처리 ───────────────────────────────────────────────────────────
  function handleLineTap(dir, row, col, hitDiv, visualDiv) {
    // 이미 그려진 선이면 무시
    if (dir === 'h' && hLines[row][col] !== -1) return;
    if (dir === 'v' && vLines[row][col] !== -1) return;

    // 선 기록
    if (dir === 'h') hLines[row][col] = currentPlayer;
    else             vLines[row][col] = currentPlayer;

    // 시각 업데이트
    hitDiv.classList.add('drawn');
    visualDiv.classList.add('drawn');
    visualDiv.style.background = PLAYER_COLORS[currentPlayer];
    visualDiv.style.opacity    = '1';

    sounds.play('draw');

    // 박스 완성 체크
    var completed = checkBoxes(dir, row, col);

    var playerSwitched = false;
    if (completed > 0) {
      sounds.play('box');
      // 같은 플레이어 연속 턴 (no player switch)
    } else {
      // 다음 플레이어
      currentPlayer = (currentPlayer + 1) % numPlayers;
      playerSwitched = true;
    }

    updateTurnUI(playerSwitched); // announce only when player actually changed

    // 게임 종료 체크
    if (allBoxesFilled()) {
      gameOver = true;
      boardContainer.classList.add('done');
      var winnerIdx = findWinner();
      setTimeout(function () {
        sounds.play(winnerIdx >= 0 ? 'win' : 'tie');
        showResult(winnerIdx);
      }, 400);
    }
  }

  // ─── 박스 완성 체크 ──────────────────────────────────────────────────────
  /*
   * 선(dir,row,col)이 그어졌을 때 영향받는 박스를 확인
   * Returns: 이번에 완성된 박스 수
   */
  function checkBoxes(dir, row, col) {
    var completed = 0;

    if (dir === 'h') {
      // 상단 박스: box[row-1][col] (if row > 0)
      if (row > 0 && isBoxComplete(row - 1, col)) {
        fillBox(row - 1, col);
        completed++;
      }
      // 하단 박스: box[row][col] (if row < COLS)
      if (row < COLS && isBoxComplete(row, col)) {
        fillBox(row, col);
        completed++;
      }
    } else {
      // 좌측 박스: box[row][col-1] (if col > 0)
      if (col > 0 && isBoxComplete(row, col - 1)) {
        fillBox(row, col - 1);
        completed++;
      }
      // 우측 박스: box[row][col] (if col < COLS)
      if (col < COLS && isBoxComplete(row, col)) {
        fillBox(row, col);
        completed++;
      }
    }

    return completed;
  }

  function isBoxComplete(bRow, bCol) {
    if (boxes[bRow][bCol] !== -1) return false; // 이미 채워짐
    // top    hLines[bRow][bCol]
    // bottom hLines[bRow+1][bCol]
    // left   vLines[bRow][bCol]
    // right  vLines[bRow][bCol+1]
    return (
      hLines[bRow][bCol]     !== -1 &&
      hLines[bRow + 1][bCol] !== -1 &&
      vLines[bRow][bCol]     !== -1 &&
      vLines[bRow][bCol + 1] !== -1
    );
  }

  function fillBox(bRow, bCol) {
    boxes[bRow][bCol] = currentPlayer;
    scores[currentPlayer]++;

    var color = PLAYER_COLORS[currentPlayer];
    var el = boxEls[bRow][bCol];
    el.style.background = color;
    el.style.opacity = '0.28';
    el.classList.add('filled');

    // 플레이어 이니셜 레이블
    var label = document.createElement('div');
    label.className = 'box-label';
    label.textContent = PLAYER_NAMES[currentPlayer];
    label.style.color = color;
    label.style.fontSize = Math.max(10, Math.round(cellSize * 0.28)) + 'px';
    label.style.width  = '100%';
    label.style.height = '100%';
    el.appendChild(label);
  }

  // ─── 게임 종료 체크 ──────────────────────────────────────────────────────
  function allBoxesFilled() {
    for (var r = 0; r < COLS; r++) {
      for (var c = 0; c < COLS; c++) {
        if (boxes[r][c] === -1) return false;
      }
    }
    return true;
  }

  function findWinner() {
    var max = -1;
    var winner = -1;
    var tie = false;
    for (var i = 0; i < numPlayers; i++) {
      if (scores[i] > max) {
        max = scores[i];
        winner = i;
        tie = false;
      } else if (scores[i] === max) {
        tie = true;
      }
    }
    return tie ? -1 : winner;
  }

  // ─── 결과 화면 ───────────────────────────────────────────────────────────
  function showResult(winnerIdx) {
    if (winnerIdx >= 0) {
      resultEmoji.textContent = '🏆';
      resultTitle.textContent = PLAYER_NAMES[winnerIdx] + ' 승리!';
      resultTitle.style.color = PLAYER_COLORS[winnerIdx];
      resultSub.textContent   = PLAYER_NAMES[winnerIdx] + '가 가장 많은 사각형을 완성했어요!';
    } else {
      resultEmoji.textContent = '🤝';
      resultTitle.textContent = '무승부!';
      resultTitle.style.color = '#78909C';
      resultSub.textContent   = '모두 같은 점수예요. 한 판 더!';
    }

    // 점수 목록
    resultScoresEl.innerHTML = '';

    // 순위 정렬
    var ranked = [];
    for (var i = 0; i < numPlayers; i++) {
      ranked.push({ idx: i, score: scores[i] });
    }
    ranked.sort(function (a, b) { return b.score - a.score; });

    ranked.forEach(function (item) {
      var row = document.createElement('div');
      row.className = 'result-score-row' + (item.idx === winnerIdx ? ' winner' : '');

      var dot = document.createElement('div');
      dot.className = 'result-score-dot';
      dot.style.background = PLAYER_COLORS[item.idx];

      var name = document.createElement('span');
      name.className = 'result-score-name';
      name.textContent = PLAYER_NAMES[item.idx];
      name.style.color = PLAYER_COLORS[item.idx];

      var boxCount = document.createElement('span');
      boxCount.className = 'result-score-boxes';
      boxCount.textContent = item.score + '칸';

      if (item.idx === winnerIdx) {
        var crown = document.createElement('span');
        crown.className = 'winner-crown';
        crown.textContent = '👑';
        row.appendChild(dot);
        row.appendChild(name);
        row.appendChild(boxCount);
        row.appendChild(crown);
      } else {
        row.appendChild(dot);
        row.appendChild(name);
        row.appendChild(boxCount);
      }

      resultScoresEl.appendChild(row);
    });

    // 미니 보드 프리뷰 (SVG)
    buildResultPreview();

    showScreen('result');
  }

  function buildResultPreview() {
    resultBoardPrev.innerHTML = '';

    var previewSize = Math.min(220, window.innerWidth - 48);
    var pCell = previewSize / (GRID - 1);
    var pdotR  = Math.max(3, Math.round(pCell * 0.09));
    var pLineW = Math.max(3, Math.round(pCell * 0.07));

    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 ' + previewSize + ' ' + previewSize);
    svg.setAttribute('width',  previewSize);
    svg.setAttribute('height', previewSize);

    // Box fills
    for (var br = 0; br < COLS; br++) {
      for (var bc = 0; bc < COLS; bc++) {
        if (boxes[br][bc] !== -1) {
          var rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          rect.setAttribute('x',      bc * pCell + pdotR);
          rect.setAttribute('y',      br * pCell + pdotR);
          rect.setAttribute('width',  pCell - pdotR * 2);
          rect.setAttribute('height', pCell - pdotR * 2);
          rect.setAttribute('fill',   PLAYER_COLORS[boxes[br][bc]]);
          rect.setAttribute('opacity', '0.3');
          rect.setAttribute('rx', '3');
          svg.appendChild(rect);
        }
      }
    }

    // Horizontal lines
    for (var hr = 0; hr < GRID; hr++) {
      for (var hc = 0; hc < COLS; hc++) {
        var x1 = hc * pCell + pdotR;
        var y1 = hr * pCell;
        var x2 = (hc + 1) * pCell - pdotR;
        var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', x1);
        line.setAttribute('y1', y1);
        line.setAttribute('x2', x2);
        line.setAttribute('y2', y1);
        if (hLines[hr][hc] !== -1) {
          line.setAttribute('stroke', PLAYER_COLORS[hLines[hr][hc]]);
          line.setAttribute('stroke-width', pLineW);
        } else {
          line.setAttribute('stroke', '#CFD8DC');
          line.setAttribute('stroke-width', Math.max(2, pLineW - 1));
          line.setAttribute('stroke-dasharray', '3 3');
        }
        line.setAttribute('stroke-linecap', 'round');
        svg.appendChild(line);
      }
    }

    // Vertical lines
    for (var vr = 0; vr < COLS; vr++) {
      for (var vc = 0; vc < GRID; vc++) {
        var x3 = vc * pCell;
        var y3a = vr * pCell + pdotR;
        var y3b = (vr + 1) * pCell - pdotR;
        var vline = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        vline.setAttribute('x1', x3);
        vline.setAttribute('y1', y3a);
        vline.setAttribute('x2', x3);
        vline.setAttribute('y2', y3b);
        if (vLines[vr][vc] !== -1) {
          vline.setAttribute('stroke', PLAYER_COLORS[vLines[vr][vc]]);
          vline.setAttribute('stroke-width', pLineW);
        } else {
          vline.setAttribute('stroke', '#CFD8DC');
          vline.setAttribute('stroke-width', Math.max(2, pLineW - 1));
          vline.setAttribute('stroke-dasharray', '3 3');
        }
        vline.setAttribute('stroke-linecap', 'round');
        svg.appendChild(vline);
      }
    }

    // Dots
    for (var dr = 0; dr < GRID; dr++) {
      for (var dc = 0; dc < GRID; dc++) {
        var circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', dc * pCell);
        circle.setAttribute('cy', dr * pCell);
        circle.setAttribute('r',  pdotR);
        circle.setAttribute('fill', '#37474F');
        svg.appendChild(circle);
      }
    }

    resultBoardPrev.appendChild(svg);
  }

  // ─── 버튼 이벤트 ──────────────────────────────────────────────────────────
  document.getElementById('playBtn').addEventListener('click', function () {
    startCountdown(function() { initGame(); });
  });

  document.getElementById('retryBtn').addEventListener('click', function () {
    initGame();
  });

  document.getElementById('homeBtn').addEventListener('click', function () {
    goHome();
  });

  document.getElementById('backBtn').addEventListener('click', function () {
    goHome();
  });

  document.getElementById('closeBtn').addEventListener('click', function () {
    if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
    showScreen('intro');
  });

  // 창 크기 변경 시 보드 재빌드
  var resizeTimer = null;
  window.addEventListener('resize', function () {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (screens.game.classList.contains('active') && !gameOver) {
        // 현재 상태 보존하며 보드 재렌더링
        rebuildBoardKeepState();
      }
    }, 200);
  });

  function rebuildBoardKeepState() {
    // 보드 재빌드 후 현재 상태 복원
    buildBoard();

    // 그려진 선 복원
    for (var hr = 0; hr < GRID; hr++) {
      for (var hc = 0; hc < COLS; hc++) {
        if (hLines[hr][hc] !== -1) {
          var el = hLineEls[hr][hc];
          var vis = el.querySelector('.line-visual');
          el.classList.add('drawn');
          vis.style.background = PLAYER_COLORS[hLines[hr][hc]];
          vis.style.opacity    = '1';
        }
      }
    }
    for (var vr = 0; vr < COLS; vr++) {
      for (var vc = 0; vc < GRID; vc++) {
        if (vLines[vr][vc] !== -1) {
          var el2 = vLineEls[vr][vc];
          var vis2 = el2.querySelector('.line-visual');
          el2.classList.add('drawn');
          vis2.style.background = PLAYER_COLORS[vLines[vr][vc]];
          vis2.style.opacity    = '1';
        }
      }
    }

    // 채워진 박스 복원
    for (var br = 0; br < COLS; br++) {
      for (var bc = 0; bc < COLS; bc++) {
        if (boxes[br][bc] !== -1) {
          var bel = boxEls[br][bc];
          var color = PLAYER_COLORS[boxes[br][bc]];
          bel.style.background = color;
          bel.style.opacity    = '0.28';

          var lbl = document.createElement('div');
          lbl.className = 'box-label';
          lbl.textContent = PLAYER_NAMES[boxes[br][bc]];
          lbl.style.color = color;
          lbl.style.fontSize = Math.max(10, Math.round(cellSize * 0.28)) + 'px';
          lbl.style.width  = '100%';
          lbl.style.height = '100%';
          bel.appendChild(lbl);
        }
      }
    }
  }

})();
