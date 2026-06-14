/* games/chase-tap/game.js */
(function () {
  'use strict';

  var GAME_DURATION = 30;

  var PLAYER_NAMES  = ['P1', 'P2', 'P3', 'P4'];
  var PLAYER_COLORS = ['#1565C0', '#C62828', '#2E7D32', '#E65100'];

  // ===== 화면 =====
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

  // ===== 사운드 =====
  var sounds = createSoundManager({
    hit: function (ctx) {
      var osc  = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(720, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(380, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    },
    fanfare: function (ctx) {
      var notes = [523, 659, 784, 1047];
      notes.forEach(function (freq, i) {
        var osc  = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.2, ctx.currentTime + i * 0.13);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.13 + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.13);
        osc.stop(ctx.currentTime + i * 0.13 + 0.35);
      });
    }
  });

  // 사운드 버튼
  var soundBtnIntro = document.getElementById('soundToggleIntro');
  function updateSoundBtn() {
    soundBtnIntro.textContent = sounds.isMuted() ? '🔇' : '🔊';
  }
  soundBtnIntro.addEventListener('click', function () {
    sounds.toggleMute();
    updateSoundBtn();
  });
  updateSoundBtn();

  // ===== 인원 선택 =====
  var selectedCount = 2;
  var playerBtns = document.querySelectorAll('.player-btn');
  playerBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      selectedCount = parseInt(btn.dataset.count, 10);
      playerBtns.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
    });
  });

  // ===== 카운트다운 =====
  var countdownEl     = document.getElementById('countdownNumber');
  var countdownTimers = [];

  function clearCountdownTimers() {
    countdownTimers.forEach(clearTimeout);
    countdownTimers = [];
  }

  function startCountdown(onDone) {
    showScreen('countdown');
    var count = 3;
    countdownEl.textContent = count;
    countdownEl.style.animation = 'none';
    void countdownEl.offsetHeight;
    countdownEl.style.animation = '';

    function tick() {
      count--;
      if (count <= 0) {
        onDone();
        return;
      }
      countdownEl.textContent = count;
      countdownEl.style.animation = 'none';
      void countdownEl.offsetHeight;
      countdownEl.style.animation = '';
      countdownTimers.push(setTimeout(tick, 1000));
    }

    countdownTimers.push(setTimeout(tick, 1000));
  }

  // ===== 게임 상태 =====
  var gameRunning   = false;
  var playerCount   = 2;
  var playerScores  = [];
  var zoneFields    = [];
  var zoneTargets   = [];
  var jumpTimers    = []; // 각 zone의 자동 점프 타이머
  var allTimers     = [];
  var gameTimer     = null;

  var timerFill   = document.getElementById('timerFill');
  var timerText   = document.getElementById('timerText');
  var hudScoresEl = document.getElementById('hudScores');

  // ===== 존 구성 =====
  function buildZones(count) {
    var zonesEl = document.getElementById('gameZones');
    zonesEl.innerHTML = '';
    zonesEl.className = 'game-zones layout-' + count;

    hudScoresEl.innerHTML = '';
    playerScores = [];
    zoneFields   = [];
    zoneTargets  = [];
    jumpTimers   = [];

    for (var p = 0; p < count; p++) {
      var zone = document.createElement('div');
      zone.className = 'player-zone';
      zone.dataset.player = p + 1;

      var label = document.createElement('div');
      label.className = 'zone-label';
      label.textContent = PLAYER_NAMES[p];
      zone.appendChild(label);

      var scoreEl = document.createElement('div');
      scoreEl.className = 'zone-score';
      scoreEl.id = 'zoneScore' + p;
      scoreEl.textContent = '0';
      zone.appendChild(scoreEl);

      var field = document.createElement('div');
      field.className = 'target-field';
      zone.appendChild(field);
      zoneFields.push(field);
      zoneTargets.push(null);
      jumpTimers.push(null);

      zonesEl.appendChild(zone);
      playerScores.push(0);

      var chip = document.createElement('div');
      chip.className = 'hud-score-chip';
      chip.dataset.player = p + 1;
      chip.id = 'hudChip' + p;
      chip.textContent = PLAYER_NAMES[p] + ' 0';
      hudScoresEl.appendChild(chip);
    }
  }

  function addScore(playerIdx, amount) {
    playerScores[playerIdx] += amount;
    var val = playerScores[playerIdx];
    var zs = document.getElementById('zoneScore' + playerIdx);
    if (zs) zs.textContent = val;
    var chip = document.getElementById('hudChip' + playerIdx);
    if (chip) chip.textContent = PLAYER_NAMES[playerIdx] + ' ' + val;
  }

  // ===== 표적 크기 =====
  function getTargetSize() {
    if (playerCount >= 4) return 48;
    if (playerCount === 3) return 54;
    return 64;
  }

  // ===== 임의 위치 + 점프 거리 조건 =====
  function randomPosition(field, size) {
    var w = field.clientWidth  || 100;
    var h = field.clientHeight || 100;
    var maxX = Math.max(0, w - size);
    var maxY = Math.max(0, h - size);
    return {
      x: Math.floor(Math.random() * (maxX + 1)),
      y: Math.floor(Math.random() * (maxY + 1))
    };
  }

  function pickJumpPosition(field, size, current) {
    var fallback = randomPosition(field, size);
    if (!current) return fallback;
    var minDist = Math.min(field.clientWidth, field.clientHeight) * 0.4;
    for (var i = 0; i < 6; i++) {
      var p = randomPosition(field, size);
      var dx = p.x - current.x;
      var dy = p.y - current.y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist >= minDist) return p;
      fallback = p;
    }
    return fallback;
  }

  // ===== Hit burst =====
  function spawnHitBurst(field, x, y) {
    var burst = document.createElement('div');
    burst.className = 'hit-burst';
    burst.style.left = x + 'px';
    burst.style.top  = y + 'px';
    field.appendChild(burst);

    var angles = [0, 60, 120, 180, 240, 300];
    angles.forEach(function (angle) {
      var rad = angle * Math.PI / 180;
      var dist = 24 + Math.random() * 14;
      var tx = Math.cos(rad) * dist;
      var ty = Math.sin(rad) * dist;

      var p = document.createElement('div');
      p.className = 'hit-particle';
      p.style.setProperty('--tx', tx + 'px');
      p.style.setProperty('--ty', ty + 'px');
      p.style.animation = 'particleFly 0.32s ease-out forwards';
      burst.appendChild(p);
    });

    var t = setTimeout(function () {
      if (burst.parentNode) burst.parentNode.removeChild(burst);
    }, 360);
    allTimers.push(t);
  }

  // ===== 표적 이동 =====
  function jumpTarget(playerIdx) {
    var target = zoneTargets[playerIdx];
    if (!target) return;
    var field = zoneFields[playerIdx];
    var size = getTargetSize();
    var currentPos = { x: parseFloat(target.style.left), y: parseFloat(target.style.top) };
    var newPos = pickJumpPosition(field, size, currentPos);
    target.style.left = newPos.x + 'px';
    target.style.top  = newPos.y + 'px';
    target.classList.remove('popping');
    void target.offsetHeight;
    target.classList.add('popping');
  }

  function scheduleAutoJump(playerIdx) {
    if (!gameRunning) return;
    var delay = 1500 + Math.random() * 1000;
    var t = setTimeout(function () {
      if (!gameRunning) return;
      jumpTarget(playerIdx);
      scheduleAutoJump(playerIdx);
    }, delay);
    jumpTimers[playerIdx] = t;
    allTimers.push(t);
  }

  function resetAutoJump(playerIdx) {
    var prev = jumpTimers[playerIdx];
    if (prev) clearTimeout(prev);
    scheduleAutoJump(playerIdx);
  }

  function createTarget(playerIdx) {
    var field = zoneFields[playerIdx];
    var size = getTargetSize();
    var startPos = randomPosition(field, size);

    var target = document.createElement('div');
    target.className = 'target';
    target.style.left = startPos.x + 'px';
    target.style.top  = startPos.y + 'px';
    field.appendChild(target);
    zoneTargets[playerIdx] = target;

    onTap(target, function (e) {
      if (!gameRunning) return;
      if (e && e.stopPropagation) e.stopPropagation();

      var sz = getTargetSize();
      var bx = parseFloat(target.style.left) + sz / 2;
      var by = parseFloat(target.style.top)  + sz / 2;
      spawnHitBurst(field, bx, by);

      sounds.play('hit');
      addScore(playerIdx, 1);

      jumpTarget(playerIdx);
      resetAutoJump(playerIdx);
    });
  }

  // ===== 게임 시작 =====
  function startGame() {
    playerCount = selectedCount;
    buildZones(playerCount);

    gameRunning = true;
    timerFill.style.width = '100%';
    timerText.textContent = GAME_DURATION;

    showScreen('game');

    gameTimer = createTimer(GAME_DURATION, function (rem) {
      var pct = (rem / GAME_DURATION * 100);
      timerFill.style.width = pct + '%';
      timerText.textContent = rem;
    }, function () {
      endGame();
    });

    gameTimer.start();

    for (var p = 0; p < playerCount; p++) {
      (function (idx) {
        var t = setTimeout(function () {
          if (!gameRunning) return;
          createTarget(idx);
          scheduleAutoJump(idx);
        }, idx * 60);
        allTimers.push(t);
      })(p);
    }
  }

  // ===== 게임 종료 =====
  function endGame() {
    gameRunning = false;

    allTimers.forEach(clearTimeout);
    allTimers = [];

    zoneFields.forEach(function (field) {
      field.innerHTML = '';
    });
    zoneTargets = [];
    jumpTimers = [];

    sounds.play('fanfare');
    showResult();
  }

  function cleanupGame() {
    if (gameTimer) { gameTimer.stop(); gameTimer = null; }
    gameRunning = false;
    allTimers.forEach(clearTimeout);
    allTimers = [];
    clearCountdownTimers();
  }

  // ===== 결과 화면 =====
  function showResult() {
    var maxScore = -1;
    var winnerIdx = 0;
    playerScores.forEach(function (s, i) {
      if (s > maxScore) { maxScore = s; winnerIdx = i; }
    });

    var isTie = playerScores.filter(function (s) { return s === maxScore; }).length > 1;

    document.getElementById('resultWinnerLabel').textContent = isTie ? '동점!' : '승자';
    var winnerNameEl = document.getElementById('resultWinnerName');
    winnerNameEl.textContent  = isTie ? '무승부' : PLAYER_NAMES[winnerIdx];
    winnerNameEl.style.color  = isTie ? '#666' : PLAYER_COLORS[winnerIdx];

    var order = playerScores.map(function (s, i) { return { s: s, i: i }; });
    order.sort(function (a, b) { return b.s - a.s; });

    var resultScoresEl = document.getElementById('resultScores');
    resultScoresEl.innerHTML = '';
    order.forEach(function (item) {
      var isWinner = item.i === winnerIdx && !isTie;
      var row = document.createElement('div');
      row.className = 'result-score-row' + (isWinner ? ' winner' : '');
      row.dataset.player = item.i + 1;

      var trophySVG = '';
      if (isWinner) {
        trophySVG = '<svg viewBox="0 0 20 16" width="20" height="16" style="display:inline;vertical-align:middle;margin-right:4px"><polygon points="2,12 5,5 10,8 15,5 18,12" fill="#FFD700" stroke="#FFA000" stroke-width="1" stroke-linejoin="round"/><rect x="1.5" y="12" width="17" height="3" rx="1.5" fill="#FFD700" stroke="#FFA000" stroke-width="1"/></svg>';
      }

      var nameEl = document.createElement('div');
      nameEl.className = 'result-score-name';
      nameEl.innerHTML = trophySVG + PLAYER_NAMES[item.i];

      var valEl = document.createElement('div');
      valEl.className = 'result-score-val';
      valEl.textContent = item.s + '점';

      row.appendChild(nameEl);
      row.appendChild(valEl);
      resultScoresEl.appendChild(row);
    });

    showScreen('result');
  }

  // ===== 버튼 이벤트 =====
  document.getElementById('playBtn').addEventListener('click', function () {
    startCountdown(startGame);
  });

  document.getElementById('retryBtn').addEventListener('click', function () {
    cleanupGame();
    startCountdown(startGame);
  });

  document.getElementById('homeBtn').addEventListener('click', function () {
    cleanupGame();
    goHome();
  });

  document.getElementById('backBtn').addEventListener('click', function () {
    cleanupGame();
    goHome();
  });

  document.getElementById('closeBtn').addEventListener('click', function () {
    cleanupGame();
    goHome();
  });

  window.addEventListener('beforeunload', cleanupGame);
  window.addEventListener('pagehide', cleanupGame);

})();
