/* games/sort-together/game.js */

(function () {
  'use strict';

  // ── 상수 ─────────────────────────────────────────────────────
  var TOTAL_ROUNDS    = 6;
  var RESULT_PAUSE_MS = getAutoplayPauseMs(2000);
  var TIME_PENALTY    = 2;  // 틀리면 2초 차감

  // 라운드 점증 계획
  var ROUND_PLAN = [
    { count: 6,  twoDigit: false, reverse: false, time: 30 }, // 1
    { count: 6,  twoDigit: false, reverse: false, time: 28 }, // 2
    { count: 7,  twoDigit: false, reverse: true,  time: 30 }, // 3: 역방향
    { count: 7,  twoDigit: true,  reverse: false, time: 35 }, // 4: 두자리
    { count: 8,  twoDigit: true,  reverse: false, time: 38 }, // 5
    { count: 9,  twoDigit: true,  reverse: true,  time: 40 }, // 6: 두자리+역방향
  ];

  var PLAYER_CONFIG = [
    { label: 'P1', dot: '#0288D1', cls: 'p1' },
    { label: 'P2', dot: '#E53935', cls: 'p2' },
    { label: 'P3', dot: '#388E3C', cls: 'p3' },
    { label: 'P4', dot: '#F57C00', cls: 'p4' },
  ];

  // ── 상태 ─────────────────────────────────────────────────────
  var playerCount   = 2;
  var roundIdx      = 0;
  var roundLog      = [];
  var numbers       = [];   // 정렬 전 숫자 배열 (순서 무작위)
  var sortedOrder   = [];   // 실제 정렬 순서 (오름/내림)
  var nextPickIdx   = 0;    // 다음으로 눌러야 할 sortedOrder의 인덱스
  var sortedSoFar   = [];   // 이미 정렬된 숫자들
  var phase         = 'idle';
  var timerHandle   = null;
  var nextHandle    = null;
  var countdownInterval = null;
  var timeRemaining = 30;
  var isReverse     = false;
  var teamSuccesses = 0;
  var teamBonusTime = 0;

  // ── DOM ──────────────────────────────────────────────────────
  var introScreen     = document.getElementById('introScreen');
  var countdownScreen = document.getElementById('countdownScreen');
  var countdownNumber = document.getElementById('countdownNumber');
  var gameScreen      = document.getElementById('gameScreen');
  var resultScreen    = document.getElementById('resultScreen');

  var backBtn         = document.getElementById('backBtn');
  var playBtn         = document.getElementById('playBtn');
  var closeBtn        = document.getElementById('closeBtn');
  var retryBtn        = document.getElementById('retryBtn');
  var homeBtn         = document.getElementById('homeBtn');
  var soundToggleIntro = document.getElementById('soundToggleIntro');

  var zonesWrap       = document.getElementById('zonesWrap');
  var questionCounter = document.getElementById('questionCounter');
  var problemTimer    = document.getElementById('problemTimer');
  var directionBadge  = document.getElementById('directionBadge');
  var sortedRow       = document.getElementById('sortedRow');
  var scoreBar        = document.getElementById('scoreBar');

  var resultTitle     = document.getElementById('resultTitle');
  var resultWinner    = document.getElementById('resultWinner');
  var resultTableHead = document.getElementById('resultTableHead');
  var resultTableBody = document.getElementById('resultTableBody');
  var totalRow        = document.getElementById('totalRow');

  // ── 사운드 ──────────────────────────────────────────────────
  var sounds = createSoundManager({
    tap: function (ctx) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.07);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.11);
    },
    wrong: function (ctx) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.22);
      gain.gain.setValueAtTime(0.35, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.26);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.28);
    },
    roundClear: function (ctx) {
      [523, 659, 784, 1047, 1319].forEach(function (freq, i) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'triangle';
        var t = ctx.currentTime + i * 0.09;
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.25, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.4);
      });
    },
    timeout: function (ctx) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(160, ctx.currentTime);
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    },
    tick: function (ctx) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.07);
    },
    fanfare: function (ctx) {
      [392, 494, 523, 659, 784].forEach(function (freq, i) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'triangle';
        var t = ctx.currentTime + i * 0.12;
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.4);
      });
    }
  });

  function updateSoundBtn() {
    soundToggleIntro.textContent = sounds.isMuted() ? '🔇' : '🔊';
  }

  // ── 유틸 ─────────────────────────────────────────────────────
  function showScreen(name) {
    [introScreen, countdownScreen, gameScreen, resultScreen].forEach(function (s) {
      s.classList.remove('active');
    });
    if (name === 'intro')     introScreen.classList.add('active');
    if (name === 'countdown') countdownScreen.classList.add('active');
    if (name === 'game')      gameScreen.classList.add('active');
    if (name === 'result')    resultScreen.classList.add('active');
  }

  function clearTimers() {
    if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
    if (timerHandle)       { clearInterval(timerHandle);       timerHandle = null; }
    if (nextHandle)        { clearTimeout(nextHandle);         nextHandle  = null; }
  }

  function startPreGameCountdown(onDone) {
    showScreen('countdown');
    var count = 3;
    countdownNumber.textContent = count;
    countdownInterval = setInterval(function () {
      count--;
      if (count <= 0) {
        clearInterval(countdownInterval);
        countdownInterval = null;
        onDone();
      } else {
        countdownNumber.textContent = count;
        countdownNumber.style.animation = 'none';
        void countdownNumber.offsetHeight;
        countdownNumber.style.animation = '';
      }
    }, 1000);
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  // ── 숫자 세트 생성 (중복 없는 숫자) ──────────────────────────
  function generateNumbers(count, twoDigit) {
    var min = twoDigit ? 10 : 1;
    var max = twoDigit ? 99 : 30;
    var nums = [];
    var attempts = 0;
    while (nums.length < count && attempts < 500) {
      var n = Math.floor(Math.random() * (max - min + 1)) + min;
      if (nums.indexOf(n) === -1) nums.push(n);
      attempts++;
    }
    return nums;
  }

  // ── 정렬 줄 렌더링 ──────────────────────────────────────────
  function renderSortedRow() {
    sortedRow.innerHTML = '';
    var total = numbers.length;

    for (var i = 0; i < total; i++) {
      if (i < sortedSoFar.length) {
        var chip = document.createElement('div');
        chip.className = 'sorted-chip';
        chip.textContent = sortedSoFar[i];
        sortedRow.appendChild(chip);
      } else {
        var slot = document.createElement('div');
        slot.className = 'sorted-slot-empty';
        sortedRow.appendChild(slot);
      }
    }
  }

  // ── 각 존 카드 렌더링 ───────────────────────────────────────
  function renderZoneCards() {
    for (var pi = 0; pi < playerCount; pi++) {
      var grid = document.getElementById('num-grid-' + pi);
      if (!grid) continue;
      grid.innerHTML = '';

      // 각 존은 동일한 numbers 보드 — 다른 순서로 섞기
      var shuffledNums = shuffle(numbers.slice());

      shuffledNums.forEach(function (num) {
        var isSorted = sortedSoFar.indexOf(num) !== -1;
        var isNext = sortedOrder[nextPickIdx] === num;

        var card = document.createElement('div');
        card.className = 'num-card' + (isSorted ? ' sorted' : '') + (isNext ? ' next-target' : '');
        card.textContent = num;
        card.dataset.num = String(num);
        card.dataset.player = String(pi);

        if (!isSorted) {
          (function (capturedNum, capturedCard, capturedPi) {
            onTap(capturedCard, function () {
              handleCardTap(capturedNum, capturedCard, capturedPi);
            });
          })(num, card, pi);
        }

        grid.appendChild(card);
      });
    }
  }

  // ── 카드 탭 처리 ─────────────────────────────────────────────
  function handleCardTap(num, card, playerIdx) {
    if (phase !== 'active') return;
    if (card.classList.contains('sorted') || card.classList.contains('wrong-flash')) return;

    var expected = sortedOrder[nextPickIdx];

    if (num === expected) {
      // 정답
      sounds.play('tap');
      sortedSoFar.push(num);
      nextPickIdx++;
      renderSortedRow();
      renderZoneCards();

      if (nextPickIdx >= sortedOrder.length) {
        // 전부 정렬 완료!
        resolveRoundSuccess();
      }
    } else {
      // 오답: 팀 시간 2초 차감
      sounds.play('wrong');

      // 이 카드 흔들기
      card.classList.add('wrong-flash');
      card.addEventListener('animationend', function () {
        card.classList.remove('wrong-flash');
      }, { once: true });

      // 같은 번호 다른 존 카드들도 흔들기
      var allCards = zonesWrap.querySelectorAll('.num-card[data-num="' + num + '"]');
      allCards.forEach(function (c) {
        if (!c.classList.contains('sorted')) {
          c.classList.add('wrong-flash');
          c.addEventListener('animationend', function () {
            c.classList.remove('wrong-flash');
          }, { once: true });
        }
      });

      // 시각 경고
      var zone = zonesWrap.querySelectorAll('.zone')[playerIdx];
      if (zone) {
        var flash = document.createElement('div');
        flash.className = 'penalty-flash';
        flash.textContent = '-2초!';
        zone.appendChild(flash);
        flash.addEventListener('animationend', function () { flash.remove(); }, { once: true });
      }

      // 타이머 2초 차감
      timeRemaining = Math.max(0, timeRemaining - TIME_PENALTY);
      problemTimer.textContent = timeRemaining;
      problemTimer.classList.add('time-penalty');
      setTimeout(function () {
        problemTimer.classList.remove('time-penalty');
      }, 450);

      if (timeRemaining <= 0) {
        clearTimers();
        handleTimeout();
      }
    }
  }

  // ── 라운드 성공 ──────────────────────────────────────────────
  function resolveRoundSuccess() {
    phase = 'done';
    clearTimers();
    sounds.play('roundClear');
    teamSuccesses++;
    teamBonusTime += timeRemaining;

    zonesWrap.querySelectorAll('.zone').forEach(function (z) {
      z.classList.add('round-complete');
      z.addEventListener('animationend', function () {
        z.classList.remove('round-complete');
      }, { once: true });
    });

    roundLog.push({
      round: roundIdx + 1,
      count: numbers.length,
      reverse: isReverse,
      success: true,
      timedOut: false,
      bonusTime: timeRemaining,
    });

    nextHandle = setTimeout(function () { nextRound(); }, RESULT_PAUSE_MS);
  }

  // ── 시간 초과 ────────────────────────────────────────────────
  function handleTimeout() {
    phase = 'done';
    clearTimers();
    sounds.play('timeout');

    roundLog.push({
      round: roundIdx + 1,
      count: numbers.length,
      reverse: isReverse,
      success: false,
      timedOut: true,
      bonusTime: 0,
    });

    nextHandle = setTimeout(function () { nextRound(); }, RESULT_PAUSE_MS);
  }

  // ── 타이머 시작 ──────────────────────────────────────────────
  function startRoundTimer(seconds) {
    timeRemaining = seconds;
    problemTimer.textContent = timeRemaining;
    problemTimer.classList.remove('urgent');

    timerHandle = setInterval(function () {
      timeRemaining--;
      problemTimer.textContent = timeRemaining;

      if (timeRemaining <= 5) {
        problemTimer.classList.add('urgent');
        sounds.play('tick');
      }
      if (timeRemaining <= 0) {
        clearTimers();
        handleTimeout();
      }
    }, 1000);
  }

  // ── 존 빌드 ──────────────────────────────────────────────────
  function buildZones() {
    zonesWrap.innerHTML = '';
    zonesWrap.className = 'zones-wrap p' + playerCount;

    for (var pi = 0; pi < playerCount; pi++) {
      var cfg  = PLAYER_CONFIG[pi];
      var zone = document.createElement('div');
      zone.className = 'zone ' + cfg.cls;
      zone.dataset.player = String(pi);
      zone.id = 'zone-' + pi;

      var header = document.createElement('div');
      header.className = 'zone-header';
      header.innerHTML = '<span class="zone-label">' + cfg.label + '</span>';

      var hint = document.createElement('div');
      hint.className = 'zone-hint';
      hint.textContent = isReverse ? '큰 수부터 터치!' : '작은 수부터 터치!';

      var grid = document.createElement('div');
      grid.className = 'num-grid';
      grid.id = 'num-grid-' + pi;

      zone.appendChild(header);
      zone.appendChild(hint);
      zone.appendChild(grid);
      zonesWrap.appendChild(zone);
    }
  }

  // ── 라운드 로드 ──────────────────────────────────────────────
  function loadRound() {
    phase = 'active';
    var plan = ROUND_PLAN[roundIdx];
    isReverse = plan.reverse;

    numbers    = generateNumbers(plan.count, plan.twoDigit);
    sortedOrder = numbers.slice().sort(function (a, b) {
      return isReverse ? b - a : a - b;
    });
    nextPickIdx = 0;
    sortedSoFar = [];

    questionCounter.textContent = (roundIdx + 1) + ' / ' + TOTAL_ROUNDS;

    if (isReverse) {
      directionBadge.textContent = '⬇️ 큰 수부터!';
      directionBadge.classList.add('reverse');
    } else {
      directionBadge.textContent = '⬆️ 작은 수부터!';
      directionBadge.classList.remove('reverse');
    }

    buildZones();
    buildScoreBar();
    renderSortedRow();
    renderZoneCards();
    startRoundTimer(plan.time);
  }

  // ── 다음 라운드 ──────────────────────────────────────────────
  function nextRound() {
    roundIdx++;
    if (roundIdx >= TOTAL_ROUNDS) {
      showFinalResult();
    } else {
      loadRound();
    }
  }

  // ── 점수 바 ─────────────────────────────────────────────────
  function buildScoreBar() {
    scoreBar.innerHTML = '';
    var chip = document.createElement('div');
    chip.className = 'score-chip';
    chip.innerHTML =
      '<span>팀 성공</span>' +
      '<span class="score-chip-val" id="team-succ-val">' + teamSuccesses + '</span>' +
      '<span>/ ' + TOTAL_ROUNDS + '</span>';
    scoreBar.appendChild(chip);
  }

  // ── 게임 시작 ────────────────────────────────────────────────
  function startGame() {
    roundIdx      = 0;
    teamSuccesses = 0;
    teamBonusTime = 0;
    roundLog      = [];
    phase         = 'idle';

    clearTimers();
    showScreen('game');
    loadRound();
  }

  // ── 결과 화면 ────────────────────────────────────────────────
  function showFinalResult() {
    clearTimers();
    phase = 'idle';
    sounds.play('fanfare');

    resultTitle.textContent = '함께 정렬 종료!';
    resultWinner.textContent =
      '팀 기록: ' + teamSuccesses + '/' + TOTAL_ROUNDS + ' 성공 · 보너스 시간 ' + teamBonusTime + '초 📊';

    // 테이블 헤더
    var headRow = document.createElement('tr');
    headRow.innerHTML = '<th>라운드</th><th>카드 수</th><th>방향</th><th>결과</th><th>남은시간</th>';
    resultTableHead.innerHTML = '';
    resultTableHead.appendChild(headRow);

    // 테이블 바디
    resultTableBody.innerHTML = '';
    roundLog.forEach(function (log) {
      var tr = document.createElement('tr');
      var resultCell = log.success
        ? '<td class="cell-win">성공 ✓</td>'
        : '<td class="cell-timeout">시간초과</td>';
      var bonusCell = log.success
        ? '<td class="cell-win">+' + log.bonusTime + 's</td>'
        : '<td class="cell-fail">—</td>';
      tr.innerHTML =
        '<td>' + log.round + '</td>' +
        '<td>' + log.count + '장</td>' +
        '<td>' + (log.reverse ? '⬇️내림' : '⬆️오름') + '</td>' +
        resultCell +
        bonusCell;
      resultTableBody.appendChild(tr);
    });

    // 총 성적
    totalRow.innerHTML = '';
    var chip = document.createElement('div');
    chip.className = 'total-chip';
    chip.innerHTML =
      '<span>팀 성공</span>' +
      '<span class="chip-score" style="color:' + (teamSuccesses >= 4 ? '#2E7D32' : '#555') + '">' +
        teamSuccesses + '/' + TOTAL_ROUNDS + '</span>' +
      '<span>· ⏱️' + teamBonusTime + '초 보너스</span>' +
      (teamSuccesses >= 5 ? '<span style="font-size:1.1rem;">🏆</span>' : '');
    totalRow.appendChild(chip);

    showScreen('result');
  }

  // ── 인원 선택 버튼 ───────────────────────────────────────────
  document.querySelectorAll('.player-btn').forEach(function (btn) {
    onTap(btn, function () {
      document.querySelectorAll('.player-btn').forEach(function (b) {
        b.classList.remove('active');
      });
      btn.classList.add('active');
      playerCount = parseInt(btn.dataset.count, 10);
    });
  });

  // ── 버튼 이벤트 ──────────────────────────────────────────────
  onTap(soundToggleIntro, function () {
    sounds.toggleMute();
    updateSoundBtn();
  });
  updateSoundBtn();

  onTap(backBtn, function () { clearTimers(); goHome(); });
  onTap(closeBtn, function () { clearTimers(); showScreen('intro'); });
  onTap(homeBtn, function () { clearTimers(); goHome(); });
  onTap(retryBtn, function () { startPreGameCountdown(function () { startGame(); }); });
  onTap(playBtn, function () { startPreGameCountdown(function () { startGame(); }); });

})();
