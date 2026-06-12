/* games/updown-number/game.js */
(function () {
  'use strict';

  // ─── 상수 ────────────────────────────────────────────────────────────────
  var TOTAL_ROUNDS = 6;
  var RESULT_PAUSE_MS = getAutoplayPauseMs(2200);

  // 라운드별 설정: [범위최소, 범위최대, 최대추측횟수]
  var ROUND_CONFIG = [
    [1, 20, 6],   // 라운드 1
    [1, 20, 5],   // 라운드 2
    [1, 50, 6],   // 라운드 3
    [1, 50, 5],   // 라운드 4
    [1, 100, 6],  // 라운드 5
    [1, 100, 5],  // 라운드 6
  ];

  // P1/P2 색
  var COLOR_P1 = '#0288D1';
  var COLOR_P2 = '#E53935';

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
    select: function (ctx) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(550, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.14);
    },
    up: function (ctx) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(330, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.25);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.3);
    },
    down: function (ctx) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(660, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.25);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.3);
    },
    correct: function (ctx) {
      [523, 659, 784, 1047].forEach(function (freq, i) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        var t = ctx.currentTime + i * 0.08;
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(t); osc.stop(t + 0.38);
      });
    },
    fail: function (ctx) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.38);
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
    },
    warn: function (ctx) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(200, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.18);
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
  var currentRound;      // 0-based
  var totalScore;        // 누적 팀 점수
  var roundHistory;      // [{round, role_p1_secret, role_p2_guesser, secret, guessCount, score}]
  var secretNum;         // 이번 라운드 비밀 수
  var rangeMin;          // 현재 가능 범위 하한
  var rangeMax;          // 현재 가능 범위 상한
  var absMin;            // 라운드 절대 최솟값
  var absMax;            // 라운드 절대 최댓값
  var maxGuesses;        // 이번 라운드 최대 추측
  var guessCount;        // 추측 횟수
  var selectedNum;       // P2가 선택한 숫자 (확정 전)
  var waitingForHint;    // true: P1 힌트 대기 중
  var roundDone;         // 라운드 종료 여부
  // 역할 교대: 짝수 라운드는 P1이 guesser, P2가 secret keeper
  // (0-based: 0=P1비밀/P2추측, 1=역할교대, ...)

  // ─── DOM 참조 ─────────────────────────────────────────────────────────────
  var secretNumEl       = document.getElementById('secretNum');
  var btnUp             = document.getElementById('btnUp');
  var btnExact          = document.getElementById('btnExact');
  var btnDown           = document.getElementById('btnDown');
  var contradictionMsg  = document.getElementById('contradictionMsg');
  var rangeLabel        = document.getElementById('rangeLabel');
  var rangeBarFill      = document.getElementById('rangeBarFill');
  var rangeBarGuess     = document.getElementById('rangeBarGuess');
  var guessDisplay      = document.getElementById('guessDisplay');
  var guessCountLabel   = document.getElementById('guessCountLabel');
  var numGrid           = document.getElementById('numGrid');
  var confirmBtn        = document.getElementById('confirmBtn');
  var bannerEl          = document.getElementById('banner');
  var roundNumEl        = document.getElementById('roundNum');
  var roundScoreEl      = document.getElementById('roundScore');
  var p1ScoreEl         = document.getElementById('p1ScoreEl');
  var p2ScoreEl         = document.getElementById('p2ScoreEl');
  var p1Zone            = document.getElementById('p1Zone');
  var p2Zone            = document.getElementById('p2Zone');
  var turnOverlay       = document.getElementById('turnOverlay');
  var overlayEmoji      = document.getElementById('overlayEmoji');
  var overlayTitle      = document.getElementById('overlayTitle');
  var overlaySub        = document.getElementById('overlaySub');
  var overlayBtn        = document.getElementById('overlayBtn');
  var resultTitle       = document.getElementById('resultTitle');
  var resultSub         = document.getElementById('resultSub');
  var resultTbody       = document.getElementById('resultTbody');

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

  // ─── 범위 바 업데이트 ────────────────────────────────────────────────────
  function updateRangeBar(guessedNum) {
    var total = absMax - absMin;
    var lo = (rangeMin - absMin) / total * 100;
    var hi = ((absMax - rangeMax) / total) * 100;
    var fillLeft = lo;
    var fillWidth = 100 - lo - hi;
    rangeBarFill.style.left = fillLeft + '%';
    rangeBarFill.style.width = fillWidth + '%';
    rangeLabel.textContent = '범위: ' + rangeMin + ' ~ ' + rangeMax;

    if (guessedNum !== undefined) {
      var gPos = (guessedNum - absMin) / total * 100;
      rangeBarGuess.style.left = 'calc(' + gPos + '% - 2px)';
      rangeBarGuess.style.display = 'block';
    } else {
      rangeBarGuess.style.display = 'none';
    }
  }

  // ─── 숫자 그리드 생성 ────────────────────────────────────────────────────
  function buildNumGrid() {
    numGrid.innerHTML = '';
    // 항상 absMin~absMax 전체 표시
    for (var n = absMin; n <= absMax; n++) {
      (function (num) {
        var cell = document.createElement('div');
        cell.className = 'num-cell';
        cell.textContent = num;
        cell.dataset.num = num;
        onTap(cell, function () {
          handleNumSelect(num);
        });
        numGrid.appendChild(cell);
      })(n);
    }
  }

  function updateNumGridState() {
    var cells = numGrid.querySelectorAll('.num-cell');
    cells.forEach(function (cell) {
      var n = parseInt(cell.dataset.num, 10);
      cell.classList.remove('too-low', 'too-high', 'selected');
      if (n < rangeMin) {
        cell.classList.add('too-low');
      } else if (n > rangeMax) {
        cell.classList.add('too-high');
      } else if (n === selectedNum) {
        cell.classList.add('selected');
      }
    });
  }

  function handleNumSelect(num) {
    if (roundDone) return;
    if (waitingForHint) return; // 힌트 대기 중엔 선택 불가
    if (num < rangeMin || num > rangeMax) return; // 범위 밖
    selectedNum = num;
    guessDisplay.textContent = num;
    updateNumGridState();
    updateRangeBar(num);
    confirmBtn.disabled = false;
    sounds.play('select');
  }

  // ─── 역할 판단 ────────────────────────────────────────────────────────────
  // 짝수 라운드(0-based): P1이 비밀 보유, P2가 추측
  // 홀수 라운드: 역할 교대
  function isP1Secret() {
    return (currentRound % 2 === 0);
  }

  function getSecretKeeper() {
    return isP1Secret() ? 'P1' : 'P2';
  }
  function getGuesser() {
    return isP1Secret() ? 'P2' : 'P1';
  }

  // 존 레이블과 스타일 적용 (역할 교대 시)
  function applyRoleToZones() {
    var p1Label = p1Zone.querySelector('.zone-label');
    var p2Label = p2Zone.querySelector('.zone-label');

    if (isP1Secret()) {
      // P1 존 = 비밀 보유자, P2 존 = 추측자 (기본 배치)
      p1Label.textContent = 'P1 (비밀)';
      p2Label.textContent = 'P2 (추측)';
      p1Label.style.background = COLOR_P1;
      p2Label.style.background = COLOR_P2;
    } else {
      // P1 존 = 추측자, P2 존 = 비밀 보유자
      p1Label.textContent = 'P1 (추측)';
      p2Label.textContent = 'P2 (비밀)';
      p1Label.style.background = COLOR_P1;
      p2Label.style.background = COLOR_P2;

      // DOM 순서는 그대로 두고, 비밀 표시 및 입력만 올바른 존으로 이동
      // p1Zone에 guess UI, p2Zone에 secret UI를 표시
    }
  }

  // 비밀 보유 존/추측 존의 DOM 요소 얻기
  function getSecretZoneEls() {
    if (isP1Secret()) {
      return {
        secretDisplay: p1Zone.querySelector('.secret-display'),
        secretNumEl:   p1Zone.querySelector('.secret-num'),
        hintBtns:      p1Zone.querySelector('.hint-btns'),
        contradiction: p1Zone.querySelector('.contradiction-msg'),
        guessArea:     p2Zone
      };
    } else {
      return {
        secretDisplay: p2Zone.querySelector('.secret-display'),
        secretNumEl:   p2Zone.querySelector('.secret-num'),
        hintBtns:      p2Zone.querySelector('.hint-btns'),
        contradiction: p2Zone.querySelector('.contradiction-msg'),
        guessArea:     p1Zone
      };
    }
  }

  // ─── 확정 버튼 핸들러 ────────────────────────────────────────────────────
  onTap(confirmBtn, function () {
    if (roundDone) return;
    if (waitingForHint) return;
    if (selectedNum === null || selectedNum === undefined) return;

    guessCount++;
    guessCountLabel.textContent = '추측 ' + guessCount + '회';
    confirmBtn.disabled = true;
    waitingForHint = true;

    // 힌트 버튼 활성화
    btnUp.disabled = false;
    btnExact.disabled = false;
    btnDown.disabled = false;

    sounds.play('select');
  });

  // ─── 힌트 버튼 핸들러 ────────────────────────────────────────────────────
  function handleHint(type) {
    if (!waitingForHint) return;

    // 모순 검증: P1이 누른 힌트가 선택한 수와 모순인지 확인
    var contradiction = false;
    if (type === 'up' && selectedNum >= secretNum) {
      contradiction = true;
    } else if (type === 'down' && selectedNum <= secretNum) {
      contradiction = true;
    } else if (type === 'exact' && selectedNum !== secretNum) {
      contradiction = true;
    }

    if (contradiction) {
      var msg = document.getElementById('contradictionMsg') || contradictionMsg;
      msg.textContent = '앗! 힌트가 달라요! 다시 눌러요';
      msg.classList.add('show');
      sounds.play('warn');
      return;
    }

    // 모순 없으면 메시지 숨김
    contradictionMsg.classList.remove('show');
    contradictionMsg.textContent = '';

    // 힌트 버튼 비활성화
    btnUp.disabled = true;
    btnExact.disabled = true;
    btnDown.disabled = true;
    waitingForHint = false;

    if (type === 'exact') {
      // 정답!
      sounds.play('correct');
      var pts = Math.max(1, 7 - guessCount);
      totalScore += pts;
      roundHistory.push({
        round: currentRound + 1,
        secret: secretNum,
        guesses: guessCount,
        score: pts,
        secretKeeper: getSecretKeeper()
      });
      showBanner('🎉 정답! ' + secretNum + '! +' + pts + '점 (추측 ' + guessCount + '회)', 'ok');
      updateScoreUI();
      later(function () {
        finishRound();
      }, RESULT_PAUSE_MS);
    } else if (type === 'up') {
      // 더 커야 함 → 선택 수 다음이 새 rangeMin
      sounds.play('up');
      rangeMin = selectedNum + 1;
      updateRangeBar(selectedNum);
      updateNumGridState();
      selectedNum = null;
      guessDisplay.textContent = '?';
      confirmBtn.disabled = true;

      // 최대 추측 초과 체크
      if (guessCount >= maxGuesses) {
        exhausted();
      }
    } else if (type === 'down') {
      // 더 작아야 함 → 선택 수 이전이 새 rangeMax
      sounds.play('down');
      rangeMax = selectedNum - 1;
      updateRangeBar(selectedNum);
      updateNumGridState();
      selectedNum = null;
      guessDisplay.textContent = '?';
      confirmBtn.disabled = true;

      // 최대 추측 초과 체크
      if (guessCount >= maxGuesses) {
        exhausted();
      }
    }
  }

  function exhausted() {
    // 최대 추측 소진
    roundDone = true;
    sounds.play('fail');
    var pts = 0;
    roundHistory.push({
      round: currentRound + 1,
      secret: secretNum,
      guesses: guessCount,
      score: pts,
      secretKeeper: getSecretKeeper()
    });
    showBanner('😅 못 맞혔어요! 비밀 수: ' + secretNum, 'ng');
    updateScoreUI();
    later(function () {
      finishRound();
    }, RESULT_PAUSE_MS);
  }

  onTap(btnUp, function () { handleHint('up'); });
  onTap(btnExact, function () { handleHint('exact'); });
  onTap(btnDown, function () { handleHint('down'); });

  // ─── 라운드 종료 ─────────────────────────────────────────────────────────
  function finishRound() {
    hideBanner();
    currentRound++;
    if (currentRound >= TOTAL_ROUNDS) {
      showResult();
    } else {
      beginRound();
    }
  }

  // ─── 라운드 시작 ─────────────────────────────────────────────────────────
  function beginRound() {
    roundDone = false;
    selectedNum = null;
    waitingForHint = false;
    guessCount = 0;

    var cfg = ROUND_CONFIG[currentRound];
    absMin = cfg[0];
    absMax = cfg[1];
    maxGuesses = cfg[2];
    rangeMin = absMin;
    rangeMax = absMax;

    // 비밀 수 생성
    secretNum = Math.floor(Math.random() * (absMax - absMin + 1)) + absMin;

    // 역할 레이블 적용
    applyRoleToZones();

    // 비밀 수는 비밀 보유 존에만 표시
    secretNumEl.textContent = secretNum;

    // P2 존 UI 초기화
    guessDisplay.textContent = '?';
    guessCountLabel.textContent = '추측 0회';
    confirmBtn.disabled = true;
    btnUp.disabled = true;
    btnExact.disabled = true;
    btnDown.disabled = true;
    contradictionMsg.classList.remove('show');
    contradictionMsg.textContent = '';

    buildNumGrid();
    updateNumGridState();
    updateRangeBar();
    updateRoundUI();

    var secreter = getSecretKeeper();
    var guesser = getGuesser();
    showOverlay('🔢', secreter + '의 비밀 수!',
      '범위 ' + absMin + '~' + absMax + ' 중 ' + secreter + '만 볼 수 있어요! ' + guesser + '가 추측해요.',
      '시작!',
      function () {
        // 게임 진행 시작
      }
    );
  }

  // ─── UI 업데이트 ─────────────────────────────────────────────────────────
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
    bannerEl.classList.remove('show', 'ok', 'ng');
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
        '<td>' + r.secretKeeper + ' 비밀</td>' +
        '<td>' + r.secret + '</td>' +
        '<td>' + r.guesses + '회</td>' +
        '<td>+' + r.score + '</td>';
      resultTbody.appendChild(tr);
    });
    resultTitle.textContent = totalScore + '점';
    var msg;
    if (totalScore >= 30) {
      msg = '👑 완벽한 팀워크! 이진 탐색 달인!';
    } else if (totalScore >= 20) {
      msg = '🌟 대단해요! 효율적으로 찾았어요!';
    } else if (totalScore >= 10) {
      msg = '👍 잘했어요! 더 연습하면 만점!';
    } else {
      msg = '💪 다시 도전! 범위를 좁혀가봐요!';
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
