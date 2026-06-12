/* games/coord-pass/game.js */
(function () {
  'use strict';

  // ─── 상수 ────────────────────────────────────────────────────────────────
  var TOTAL_ROUNDS = 8;
  var RESULT_PAUSE_MS = getAutoplayPauseMs(2200);

  // 라운드별 설정: [격자크기, 보물수, 함정수]
  // 점증: 1~2라운드=4x4 보물1, 3~4=4x4 보물2, 5~6=4x4 보물3+함정1, 7~8=5x5 보물3+함정2
  var ROUND_CONFIG = [
    { cols: 4, rows: 4, treasures: 1, traps: 0 },
    { cols: 4, rows: 4, treasures: 1, traps: 0 },
    { cols: 4, rows: 4, treasures: 2, traps: 0 },
    { cols: 4, rows: 4, treasures: 2, traps: 0 },
    { cols: 4, rows: 4, treasures: 3, traps: 1 },
    { cols: 4, rows: 4, treasures: 3, traps: 1 },
    { cols: 5, rows: 5, treasures: 3, traps: 2 },
    { cols: 5, rows: 5, treasures: 3, traps: 2 },
  ];

  var COL_LABELS_4 = ['A', 'B', 'C', 'D'];
  var COL_LABELS_5 = ['A', 'B', 'C', 'D', 'E'];

  // ─── 타이머 ──────────────────────────────────────────────────────────────
  var timers = [];
  var countdownInterval = null;

  function later(fn, ms) {
    var id = setTimeout(fn, ms);
    timers.push(id);
    return id;
  }
  function clearAllTimers() {
    if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
    timers.forEach(function (id) { clearTimeout(id); });
    timers = [];
  }

  // ─── 화면 전환 ────────────────────────────────────────────────────────────
  var screens = {
    intro:     document.getElementById('introScreen'),
    countdown: document.getElementById('countdownScreen'),
    game:      document.getElementById('gameScreen'),
    result:    document.getElementById('resultScreen')
  };
  function showScreen(name) {
    Object.keys(screens).forEach(function (k) {
      screens[k].classList.toggle('active', k === name);
    });
  }
  function startCountdown(onDone) {
    var el = document.getElementById('countdownNumber');
    showScreen('countdown');
    var count = 3;
    el.textContent = count;
    countdownInterval = setInterval(function () {
      count--;
      if (count <= 0) {
        clearInterval(countdownInterval);
        countdownInterval = null;
        onDone();
      } else {
        el.textContent = count;
        el.style.animation = 'none';
        el.offsetHeight;
        el.style.animation = '';
      }
    }, 1000);
  }

  // ─── 사운드 ──────────────────────────────────────────────────────────────
  var sounds = createSoundManager({
    send: function (ctx) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.16);
    },
    found: function (ctx) {
      [523, 659, 784, 1047].forEach(function (freq, i) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        var t = ctx.currentTime + i * 0.07;
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(t); osc.stop(t + 0.35);
      });
    },
    trap: function (ctx) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(350, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.38);
    },
    miss: function (ctx) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.24);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.26);
    },
    select: function (ctx) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(500, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.1);
    },
    win: function (ctx) {
      [523, 659, 784, 1047, 1319].forEach(function (freq, i) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        var t = ctx.currentTime + i * 0.1;
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(t); osc.stop(t + 0.42);
      });
    }
  });

  // ─── 사운드 토글 ─────────────────────────────────────────────────────────
  var SVG_ON  = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>';
  var SVG_OFF = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>';
  function updateSoundIcons() {
    var muted = sounds.isMuted();
    ['soundIconIntro', 'soundIconGame'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.innerHTML = muted ? SVG_OFF : SVG_ON;
    });
  }
  ['soundToggleIntro', 'soundToggleGame'].forEach(function (id) {
    var btn = document.getElementById(id);
    if (!btn) return;
    onTap(btn, function () { sounds.toggleMute(); updateSoundIcons(); });
  });
  updateSoundIcons();

  // ─── 게임 상태 ────────────────────────────────────────────────────────────
  var currentRound;
  var totalScore;
  var roundHistory;
  var gridCols;
  var gridRows;
  var colLabels;
  var treasurePositions;  // [{col, row}] P1 지도에만 표시
  var trapPositions;      // [{col, row}] P1 지도에만 표시
  var remainingTargets;   // 남은 보물 인덱스 배열
  var currentTargetIdx;   // 현재 찾아야 할 보물 인덱스
  var sentCoord;          // P1이 전송한 좌표 {col, row} or null
  var selectedColBtn;     // 선택된 열 버튼 인덱스 or null
  var selectedRowBtn;     // 선택된 행 버튼 인덱스 or null
  var roundDone;
  var foundCount;         // 이번 라운드 찾은 보물 수
  var trapHit;            // 이번 라운드 함정 맞은 수

  // ─── DOM 참조 ─────────────────────────────────────────────────────────────
  var p1MapLabelRow = document.getElementById('p1MapLabelRow');
  var p1RowLabels   = document.getElementById('p1RowLabels');
  var p1Map         = document.getElementById('p1Map');
  var p2MapLabelRow = document.getElementById('p2MapLabelRow');
  var p2RowLabels   = document.getElementById('p2RowLabels');
  var p2Map         = document.getElementById('p2Map');
  var coordPad      = document.getElementById('coordPad');
  var sendInfo      = document.getElementById('sendInfo');
  var coordDisplay  = document.getElementById('coordDisplay');
  var targetsLabel  = document.getElementById('targetsLabel');
  var bannerEl      = document.getElementById('banner');
  var roundNumEl    = document.getElementById('roundNum');
  var roundScoreEl  = document.getElementById('roundScore');
  var p1ScoreEl     = document.getElementById('p1ScoreEl');
  var p2ScoreEl     = document.getElementById('p2ScoreEl');
  var turnOverlay   = document.getElementById('turnOverlay');
  var overlayEmoji  = document.getElementById('overlayEmoji');
  var overlayTitle  = document.getElementById('overlayTitle');
  var overlaySub    = document.getElementById('overlaySub');
  var overlayBtn    = document.getElementById('overlayBtn');
  var resultTitle   = document.getElementById('resultTitle');
  var resultSub     = document.getElementById('resultSub');
  var resultTbody   = document.getElementById('resultTbody');

  // ─── 오버레이 ─────────────────────────────────────────────────────────────
  var overlayCallback = null;
  function showOverlay(emoji, title, sub, btnText, onGo) {
    overlayEmoji.textContent = emoji;
    overlayTitle.textContent = title;
    overlaySub.textContent = sub;
    overlayBtn.textContent = btnText;
    overlayCallback = onGo;
    turnOverlay.classList.add('show');
  }
  function hideOverlay() {
    turnOverlay.classList.remove('show');
    overlayCallback = null;
  }
  onTap(overlayBtn, function () {
    var cb = overlayCallback;
    overlayCallback = null;
    turnOverlay.classList.remove('show');
    sounds.play('select');
    if (cb) cb();
  });

  // ─── 셔플 ────────────────────────────────────────────────────────────────
  function shuffleArr(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  // ─── 격자 생성 ────────────────────────────────────────────────────────────
  function buildMap(mapEl, labelRowEl, rowLabelsEl, showTreasures, interactive) {
    // 열 라벨
    labelRowEl.innerHTML = '';
    for (var c = 0; c < gridCols; c++) {
      var lbl = document.createElement('div');
      lbl.className = 'map-col-label';
      lbl.textContent = colLabels[c];
      labelRowEl.appendChild(lbl);
    }

    // 행 라벨
    rowLabelsEl.innerHTML = '';
    for (var r = 0; r < gridRows; r++) {
      var rl = document.createElement('div');
      rl.className = 'map-row-label';
      rl.textContent = r + 1;
      rowLabelsEl.appendChild(rl);
    }

    // 격자 셀
    mapEl.innerHTML = '';
    mapEl.style.gridTemplateColumns = 'repeat(' + gridCols + ', 1fr)';
    mapEl.style.gridTemplateRows    = 'repeat(' + gridRows + ', 1fr)';

    for (var row = 0; row < gridRows; row++) {
      for (var col = 0; col < gridCols; col++) {
        (function (col, row) {
          var cell = document.createElement('div');
          cell.className = 'map-cell';
          cell.dataset.col = col;
          cell.dataset.row = row;

          if (showTreasures) {
            // P1 지도: 보물/함정 표시
            var isTreasure = treasurePositions.some(function (p) { return p.col === col && p.row === row; });
            var isTrap = trapPositions.some(function (p) { return p.col === col && p.row === row; });
            if (isTreasure) {
              cell.textContent = '💎';
              cell.classList.add('treasure');
            } else if (isTrap) {
              cell.textContent = '💣';
              cell.classList.add('trap');
            }
          } else if (interactive) {
            // P2 지도: 터치 가능
            onTap(cell, function () {
              handleP2Tap(col, row);
            });
          }

          mapEl.appendChild(cell);
        })(col, row);
      }
    }
  }

  // P2 격자에서 특정 셀 얻기
  function getP2Cell(col, row) {
    return p2Map.querySelector('[data-col="' + col + '"][data-row="' + row + '"]');
  }
  function getP1Cell(col, row) {
    return p1Map.querySelector('[data-col="' + col + '"][data-row="' + row + '"]');
  }

  // ─── 좌표 전송 패드 생성 (P1 존) ────────────────────────────────────────
  function buildCoordPad() {
    coordPad.innerHTML = '';
    selectedColBtn = null;
    selectedRowBtn = null;

    // 위쪽 행: 열 버튼
    for (var c = 0; c < gridCols; c++) {
      (function (ci) {
        var btn = document.createElement('button');
        btn.className = 'coord-btn col-btn';
        btn.textContent = colLabels[ci];
        btn.type = 'button';
        onTap(btn, function () {
          selectCol(ci);
        });
        coordPad.appendChild(btn);
      })(c);
    }

    // 아래쪽 행: 행 버튼
    for (var r = 0; r < gridRows; r++) {
      (function (ri) {
        var btn = document.createElement('button');
        btn.className = 'coord-btn row-btn';
        btn.textContent = ri + 1;
        btn.type = 'button';
        onTap(btn, function () {
          selectRow(ri);
        });
        coordPad.appendChild(btn);
      })(r);
    }

    // 전송 버튼 (마지막 칸)
    var sendBtn = document.createElement('button');
    sendBtn.id = 'sendCoordBtn';
    sendBtn.className = 'coord-btn';
    sendBtn.style.background = '#F4511E';
    sendBtn.style.color = '#fff';
    sendBtn.style.gridColumn = 'span ' + (gridCols > 4 ? 1 : 2);
    sendBtn.textContent = '전송 📡';
    sendBtn.type = 'button';
    onTap(sendBtn, function () {
      doSendCoord();
    });
    coordPad.appendChild(sendBtn);

    // 그리드 컬럼
    coordPad.style.gridTemplateColumns = 'repeat(' + gridCols + ', 1fr)';
    updateSendInfo();
  }

  function selectCol(ci) {
    if (roundDone) return;
    selectedColBtn = ci;
    // 버튼 하이라이트
    coordPad.querySelectorAll('.col-btn').forEach(function (btn, i) {
      btn.classList.toggle('selected-col', i === ci);
    });
    sounds.play('select');
    updateSendInfo();
  }

  function selectRow(ri) {
    if (roundDone) return;
    selectedRowBtn = ri;
    coordPad.querySelectorAll('.row-btn').forEach(function (btn, i) {
      btn.classList.toggle('selected-row', i === ri);
    });
    sounds.play('select');
    updateSendInfo();
  }

  function updateSendInfo() {
    if (selectedColBtn !== null && selectedRowBtn !== null) {
      sendInfo.textContent = '선택: ' + colLabels[selectedColBtn] + (selectedRowBtn + 1) + ' — 전송 누르세요!';
    } else if (selectedColBtn !== null) {
      sendInfo.textContent = '열: ' + colLabels[selectedColBtn] + ' — 행을 선택하세요';
    } else if (selectedRowBtn !== null) {
      sendInfo.textContent = '행: ' + (selectedRowBtn + 1) + ' — 열을 선택하세요';
    } else {
      sendInfo.textContent = '선택: --';
    }
  }

  function doSendCoord() {
    if (roundDone) return;
    if (selectedColBtn === null || selectedRowBtn === null) return;
    sentCoord = { col: selectedColBtn, row: selectedRowBtn };
    var coordText = colLabels[selectedColBtn] + (selectedRowBtn + 1);
    coordDisplay.textContent = coordText;
    sounds.play('send');
    showBanner('📡 "' + coordText + '" 전송! P2가 터치하세요!', 'ok');

    // P2 격자에서 해당 셀 강조 (P2만 보임)
    // — 이미 P2 격자는 빈 칸이라 강조 없이 P2가 판단해야 함 (정보 노출 금지)
  }

  // ─── P2 터치 처리 ────────────────────────────────────────────────────────
  function handleP2Tap(col, row) {
    if (roundDone) return;
    if (sentCoord === null) {
      showBanner('⚠️ P1이 아직 좌표를 전송하지 않았어요!', 'warn');
      return;
    }

    var cell = getP2Cell(col, row);
    var coordText = colLabels[col] + (row + 1);

    // 맞는 좌표인지 확인
    if (col !== sentCoord.col || row !== sentCoord.row) {
      // 틀린 위치 터치
      cell.classList.add('found-trap');
      cell.textContent = '✗';
      sounds.play('miss');
      showBanner('❌ 틀렸어요! P1의 좌표를 잘 들어요!', 'ng');
      sentCoord = null;
      coordDisplay.textContent = '--';
      return;
    }

    // 맞는 위치 터치 → 보물인지 함정인지 확인
    var isTreasure = treasurePositions.some(function (p) { return p.col === col && p.row === row; });
    var isTrap = trapPositions.some(function (p) { return p.col === col && p.row === row; });

    if (isTreasure) {
      // 보물 찾음!
      cell.classList.add('found-ok');
      cell.textContent = '💎';
      foundCount++;
      totalScore += 3;

      // P1 지도에서도 찾은 보물 표시
      var p1Cell = getP1Cell(col, row);
      if (p1Cell) { p1Cell.style.opacity = '0.4'; }

      sounds.play('found');
      showBanner('💎 보물 발견! ' + coordText + ' +3점!', 'ok');
      updateScoreUI();

      // 다음 보물로
      sentCoord = null;
      coordDisplay.textContent = '--';

      // 남은 보물 찾기
      var nextTreasure = treasurePositions.find(function (p) {
        return !p.found;
      });
      // 찾은 보물 마킹
      treasurePositions.forEach(function (p) {
        if (p.col === col && p.row === row) { p.found = true; }
      });

      var remaining = treasurePositions.filter(function (p) { return !p.found; });
      targetsLabel.textContent = '남은 보물: ' + remaining.length;

      if (remaining.length === 0) {
        // 모든 보물 찾음
        later(function () { finishRound(true); }, RESULT_PAUSE_MS);
      }
    } else if (isTrap) {
      // 함정 밟음!
      cell.classList.add('found-trap');
      cell.textContent = '💣';
      trapHit++;
      totalScore = Math.max(0, totalScore - 1);

      // P1 지도에서도 표시
      var p1TrapCell = getP1Cell(col, row);
      if (p1TrapCell) { p1TrapCell.style.opacity = '0.4'; }

      sounds.play('trap');
      showBanner('💣 함정! ' + coordText + ' -1점!', 'ng');
      updateScoreUI();
      sentCoord = null;
      coordDisplay.textContent = '--';
    } else {
      // 빈 칸 (좌표는 맞지만 보물도 함정도 아님 — 발생 안 함)
      cell.classList.add('found-ok');
      cell.textContent = '·';
      sounds.play('miss');
      showBanner('빈 칸! ' + coordText, 'ng');
      sentCoord = null;
      coordDisplay.textContent = '--';
    }
  }

  // ─── 라운드 종료 ─────────────────────────────────────────────────────────
  function finishRound(allFound) {
    roundDone = true;
    hideBanner();

    // 남은 보물 위치 P2 지도에 공개
    treasurePositions.forEach(function (p) {
      if (!p.found) {
        var cell = getP2Cell(p.col, p.row);
        if (cell) {
          cell.classList.add('revealed-treasure');
          cell.textContent = '💎';
        }
      }
    });

    roundHistory.push({
      round: currentRound + 1,
      size: gridCols + 'x' + gridRows,
      treasures: treasurePositions.length,
      found: foundCount,
      score: foundCount * 3 - trapHit
    });

    currentRound++;
    if (currentRound >= TOTAL_ROUNDS) {
      later(function () { showResult(); }, 1500);
    } else {
      later(function () { beginRound(); }, RESULT_PAUSE_MS);
    }
  }

  // ─── 라운드 시작 ─────────────────────────────────────────────────────────
  function beginRound() {
    roundDone = false;
    sentCoord = null;
    selectedColBtn = null;
    selectedRowBtn = null;
    foundCount = 0;
    trapHit = 0;

    var cfg = ROUND_CONFIG[currentRound];
    gridCols = cfg.cols;
    gridRows = cfg.rows;
    colLabels = gridCols <= 4 ? COL_LABELS_4 : COL_LABELS_5;

    // 위치 생성 (보물과 함정 겹치지 않게)
    var allCells = [];
    for (var r = 0; r < gridRows; r++) {
      for (var c = 0; c < gridCols; c++) {
        allCells.push({ col: c, row: r });
      }
    }
    var shuffled = shuffleArr(allCells);
    treasurePositions = shuffled.slice(0, cfg.treasures).map(function (p) {
      return { col: p.col, row: p.row, found: false };
    });
    trapPositions = shuffled.slice(cfg.treasures, cfg.treasures + cfg.traps);

    // 격자 빌드
    buildMap(p1Map, p1MapLabelRow, p1RowLabels, true, false);
    buildMap(p2Map, p2MapLabelRow, p2RowLabels, false, true);

    // 좌표 패드 빌드
    buildCoordPad();

    // 표시 초기화
    coordDisplay.textContent = '--';
    targetsLabel.textContent = '남은 보물: ' + cfg.treasures;
    hideBanner();
    updateRoundUI();

    // 라운드 라벨 업데이트
    var trapInfo = cfg.traps > 0 ? ' (함정 ' + cfg.traps + '개 주의!)' : '';
    showOverlay('🗺️',
      '라운드 ' + (currentRound + 1),
      gridCols + '×' + gridRows + ' 격자! 보물 ' + cfg.treasures + '개' + trapInfo + '\nP1 → 좌표 전송, P2 → 격자 터치!',
      '시작!',
      function () {}
    );
  }

  // ─── UI ──────────────────────────────────────────────────────────────────
  function updateRoundUI() {
    roundNumEl.textContent = (currentRound + 1) + '/' + TOTAL_ROUNDS;
  }
  function updateScoreUI() {
    roundScoreEl.textContent = '🏆 ' + totalScore + '점';
    p1ScoreEl.textContent = totalScore + '점';
    p2ScoreEl.textContent = totalScore + '점';
  }
  function showBanner(text, cls) {
    bannerEl.textContent = text;
    bannerEl.className = 'banner show ' + cls;
  }
  function hideBanner() {
    bannerEl.classList.remove('show', 'ok', 'ng', 'warn');
    bannerEl.textContent = '';
  }

  // ─── 게임 초기화 ─────────────────────────────────────────────────────────
  function initGame() {
    clearAllTimers();
    hideOverlay();
    currentRound = 0;
    totalScore = 0;
    roundHistory = [];
    updateScoreUI();
    showScreen('game');
    beginRound();
  }

  // ─── 결과 화면 ───────────────────────────────────────────────────────────
  function showResult() {
    resultTbody.innerHTML = '';
    roundHistory.forEach(function (r) {
      var tr = document.createElement('tr');
      tr.innerHTML = '<td>' + r.round + '</td>' +
        '<td>' + r.size + '</td>' +
        '<td>' + r.treasures + '</td>' +
        '<td>' + r.found + '/' + r.treasures + '</td>' +
        '<td>' + (r.score >= 0 ? '+' : '') + r.score + '</td>';
      resultTbody.appendChild(tr);
    });
    resultTitle.textContent = totalScore + '점';
    var maxPossible = ROUND_CONFIG.reduce(function (s, c) { return s + c.treasures * 3; }, 0);
    var ratio = totalScore / maxPossible;
    var msg;
    if (ratio >= 0.9) {
      msg = '👑 완벽한 탐험가! 좌표 전문가!';
    } else if (ratio >= 0.7) {
      msg = '🌟 훌륭해요! 보물 좌표 고수!';
    } else if (ratio >= 0.5) {
      msg = '👍 잘했어요! 좌표를 더 연습해봐요!';
    } else {
      msg = '💪 다시 도전! 열문자+행숫자 기억!';
    }
    resultSub.textContent = msg;
    sounds.play('win');
    showScreen('result');
  }

  // ─── 버튼 이벤트 ─────────────────────────────────────────────────────────
  onTap(document.getElementById('playBtn'), function () {
    startCountdown(function () { initGame(); });
  });
  onTap(document.getElementById('retryBtn'), function () {
    startCountdown(function () { initGame(); });
  });
  onTap(document.getElementById('homeBtn'), function () {
    clearAllTimers();
    goHome();
  });
  onTap(document.getElementById('backBtn'), function () {
    clearAllTimers();
    goHome();
  });
  onTap(document.getElementById('closeBtn'), function () {
    clearAllTimers();
    hideOverlay();
    showScreen('intro');
  });

})();
