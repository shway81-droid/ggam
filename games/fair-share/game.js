/* games/fair-share/game.js */

(function () {
  'use strict';

  // ── 상수 ─────────────────────────────────────────────────────
  var TOTAL_ROUNDS    = 8;
  var RESULT_PAUSE_MS = getAutoplayPauseMs(2000);

  // 라운드별 상자 개수 및 제한시간
  var ROUND_PLAN = [
    { count: 4, time: 40 },  // 라운드 1
    { count: 4, time: 40 },  // 라운드 2
    { count: 5, time: 40 },  // 라운드 3
    { count: 5, time: 35 },  // 라운드 4
    { count: 6, time: 35 },  // 라운드 5
    { count: 6, time: 30 },  // 라운드 6
    { count: 6, time: 28 },  // 라운드 7
    { count: 6, time: 25 },  // 라운드 8
  ];

  var PLAYER_CONFIG = [
    { label: 'P1', dot: '#0288D1', cls: 'p1', color: '#0288D1' },
    { label: 'P2', dot: '#E53935', cls: 'p2', color: '#E53935' },
  ];

  // ── 상태 ─────────────────────────────────────────────────────
  var roundIdx      = 0;
  var teamScore     = 0;   // 팀 성공 라운드 수
  var roundLog      = [];
  var boxes         = [];  // { weight, owner: 'conv'|'p1'|'p2' }
  var phase         = 'idle';
  var timerHandle   = null;
  var nextHandle    = null;
  var timeRemaining = 40;
  var countdownInterval = null;

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
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(550, ctx.currentTime + 0.06);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    },
    equal: function (ctx) {
      [523, 659, 784, 1047].forEach(function (freq, i) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        var t = ctx.currentTime + i * 0.08;
        gain.gain.setValueAtTime(0.22, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.45);
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

  // ── 세트 생성 (총합 짝수 + 절반 부분집합 존재 검증) ──────────
  function hasSplit(weights, target) {
    // 전수 검사: 2^n 부분집합
    var n = weights.length;
    var total = 1 << n;
    for (var mask = 1; mask < total - 1; mask++) {
      var sum = 0;
      for (var i = 0; i < n; i++) {
        if (mask & (1 << i)) sum += weights[i];
      }
      if (sum === target) return true;
    }
    return false;
  }

  function generateBoxSet(count) {
    var maxVal = count <= 4 ? 9 : (count <= 5 ? 12 : 15);
    var maxAttempts = 200;
    for (var attempt = 0; attempt < maxAttempts; attempt++) {
      var weights = [];
      for (var i = 0; i < count; i++) {
        weights.push(Math.floor(Math.random() * maxVal) + 1);
      }
      var total = weights.reduce(function (a, b) { return a + b; }, 0);
      if (total % 2 !== 0) continue;
      if (hasSplit(weights, total / 2)) return weights;
    }
    // 폴백: 직접 구성 (짝수 쌍)
    var fallback = [];
    for (var j = 0; j < count / 2; j++) {
      var v = Math.floor(Math.random() * 5) + 1;
      fallback.push(v);
      fallback.push(v);
    }
    return fallback;
  }

  // ── 존 빌드 ──────────────────────────────────────────────────
  function buildZones() {
    zonesWrap.innerHTML = '';
    zonesWrap.className = 'zones-wrap p2';

    for (var i = 0; i < 2; i++) {
      var cfg  = PLAYER_CONFIG[i];
      var zone = document.createElement('div');
      zone.className = 'zone ' + cfg.cls;
      zone.dataset.player = String(i);

      var header = document.createElement('div');
      header.className = 'zone-header';
      header.innerHTML =
        '<span class="zone-label">' + cfg.label + ' 🚚</span>' +
        '<div class="truck-sum" id="truck-sum-' + i + '">' +
          '<span class="truck-sum-num" id="truck-num-' + i + '">0</span>' +
          '<span style="font-size:0.72rem;font-weight:700;color:#555">kg</span>' +
        '</div>';

      var convLabel = document.createElement('div');
      convLabel.className = 'conv-label';
      convLabel.textContent = '← 탭하면 내 트럭으로 →';

      var boxArea = document.createElement('div');
      boxArea.className = 'box-area';
      boxArea.id = 'box-area-' + i;

      zone.appendChild(header);
      zone.appendChild(convLabel);
      zone.appendChild(boxArea);
      zonesWrap.appendChild(zone);
    }
  }

  // ── 상자 렌더링 ──────────────────────────────────────────────
  function renderBoxes() {
    for (var pi = 0; pi < 2; pi++) {
      var area = document.getElementById('box-area-' + pi);
      area.innerHTML = '';
    }

    boxes.forEach(function (box, idx) {
      var card = document.createElement('div');
      card.className = 'box-card on-' + box.owner;

      var iconEl = document.createElement('span');
      iconEl.className = 'box-icon';
      iconEl.textContent = '📦';

      var weightEl = document.createElement('span');
      weightEl.className = 'box-weight';
      weightEl.textContent = box.weight;

      var ownerEl = document.createElement('span');
      ownerEl.className = 'box-owner';
      if (box.owner === 'p1') ownerEl.textContent = 'P1';
      else if (box.owner === 'p2') ownerEl.textContent = 'P2';
      else ownerEl.textContent = '−';

      card.appendChild(iconEl);
      card.appendChild(weightEl);
      card.appendChild(ownerEl);

      (function (capturedIdx) {
        onTap(card, function () { handleBoxTap(capturedIdx, card); });
      })(idx);

      // 두 존에 모두 표시 (같은 box-area 공유)
      // 실제로는 각 존의 box-area에 배치 — 두 존 모두 같은 컨베이어 목록 표시
      var targetArea = document.getElementById('box-area-0');
      // 컨베이어 박스 목록은 P1 zone에, P2 zone에도 동일하게
      targetArea.appendChild(card);
    });

    // P2 zone에도 동일하게 렌더링 (복사본)
    var area0 = document.getElementById('box-area-0');
    var area1 = document.getElementById('box-area-1');
    area1.innerHTML = '';

    boxes.forEach(function (box, idx) {
      var card = document.createElement('div');
      card.className = 'box-card on-' + box.owner;

      var iconEl = document.createElement('span');
      iconEl.className = 'box-icon';
      iconEl.textContent = '📦';

      var weightEl = document.createElement('span');
      weightEl.className = 'box-weight';
      weightEl.textContent = box.weight;

      var ownerEl = document.createElement('span');
      ownerEl.className = 'box-owner';
      if (box.owner === 'p1') ownerEl.textContent = 'P1';
      else if (box.owner === 'p2') ownerEl.textContent = 'P2';
      else ownerEl.textContent = '−';

      card.appendChild(iconEl);
      card.appendChild(weightEl);
      card.appendChild(ownerEl);

      (function (capturedIdx) {
        onTap(card, function () { handleBoxTap(capturedIdx, card); });
      })(idx);

      area1.appendChild(card);
    });

    updateSums();
  }

  // ── 합계 표시 갱신 ──────────────────────────────────────────
  function updateSums() {
    var sums = [0, 0];
    boxes.forEach(function (box) {
      if (box.owner === 'p1') sums[0] += box.weight;
      if (box.owner === 'p2') sums[1] += box.weight;
    });

    var allAssigned = boxes.every(function (b) { return b.owner !== 'conv'; });
    var isEqual = allAssigned && sums[0] === sums[1];

    for (var i = 0; i < 2; i++) {
      var numEl = document.getElementById('truck-num-' + i);
      var sumEl = document.getElementById('truck-sum-' + i);
      if (numEl) numEl.textContent = sums[i];
      if (sumEl) {
        if (isEqual) sumEl.classList.add('equal');
        else sumEl.classList.remove('equal');
      }
    }

    return { sums: sums, allAssigned: allAssigned, isEqual: isEqual };
  }

  // ── 상자 탭 처리 ─────────────────────────────────────────────
  function handleBoxTap(idx, card) {
    if (phase !== 'active') return;

    var box = boxes[idx];
    // 순환: conv → p1 → p2 → conv
    if (box.owner === 'conv') box.owner = 'p1';
    else if (box.owner === 'p1') box.owner = 'p2';
    else box.owner = 'conv';

    sounds.play('tap');
    renderBoxes();

    var state = updateSums();
    if (state.allAssigned && state.isEqual) {
      // 성공!
      resolveSuccess();
    }
  }

  // ── 성공 처리 ────────────────────────────────────────────────
  function resolveSuccess() {
    phase = 'done';
    clearTimers();
    sounds.play('equal');
    teamScore++;

    // 양 존 플래시
    zonesWrap.querySelectorAll('.zone').forEach(function (z) {
      z.classList.add('equal-flash');
      z.addEventListener('animationend', function () {
        z.classList.remove('equal-flash');
      }, { once: true });
    });

    var weights = boxes.map(function (b) { return b.weight; });
    var total = weights.reduce(function (a, b) { return a + b; }, 0);

    roundLog.push({
      round: roundIdx + 1,
      total: total,
      half: total / 2,
      success: true,
      timedOut: false,
    });

    nextHandle = setTimeout(function () { nextRound(); }, RESULT_PAUSE_MS);
  }

  // ── 시간 초과 ────────────────────────────────────────────────
  function handleTimeout() {
    phase = 'done';
    clearTimers();
    sounds.play('timeout');

    var weights = boxes.map(function (b) { return b.weight; });
    var total = weights.reduce(function (a, b) { return a + b; }, 0);

    roundLog.push({
      round: roundIdx + 1,
      total: total,
      half: total / 2,
      success: false,
      timedOut: true,
    });

    nextHandle = setTimeout(function () { nextRound(); }, RESULT_PAUSE_MS);
  }

  // ── 타이머 ──────────────────────────────────────────────────
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

  // ── 라운드 로드 ──────────────────────────────────────────────
  function loadRound() {
    phase = 'active';
    var plan = ROUND_PLAN[roundIdx];
    var weights = generateBoxSet(plan.count);

    boxes = weights.map(function (w) { return { weight: w, owner: 'conv' }; });

    questionCounter.textContent = (roundIdx + 1) + ' / ' + TOTAL_ROUNDS;
    problemTimer.classList.remove('urgent');

    buildZones();
    buildScoreBar();
    renderBoxes();
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
      '<span class="score-chip-dot" style="background:#FFD54F"></span>' +
      '<span>팀 성공</span>' +
      '<span class="score-chip-val" id="team-score-val">' + teamScore + '</span>';
    scoreBar.appendChild(chip);
  }

  // ── 게임 시작 ────────────────────────────────────────────────
  function startGame() {
    roundIdx   = 0;
    teamScore  = 0;
    roundLog   = [];
    phase      = 'idle';

    clearTimers();
    showScreen('game');
    loadRound();
  }

  // ── 결과 화면 ────────────────────────────────────────────────
  function showFinalResult() {
    clearTimers();
    phase = 'idle';
    sounds.play('fanfare');

    var successCount = roundLog.filter(function (r) { return r.success; }).length;

    resultTitle.textContent = '게임 종료!';
    resultWinner.textContent = '팀 성공: ' + successCount + ' / ' + TOTAL_ROUNDS + ' 라운드 ⚖️';

    // 테이블 헤더
    var headRow = document.createElement('tr');
    headRow.innerHTML = '<th>라운드</th><th>총 무게</th><th>목표</th><th>결과</th>';
    resultTableHead.innerHTML = '';
    resultTableHead.appendChild(headRow);

    // 테이블 바디
    resultTableBody.innerHTML = '';
    roundLog.forEach(function (log) {
      var tr = document.createElement('tr');
      var resultCell = log.success
        ? '<td class="cell-win">성공 ✓</td>'
        : (log.timedOut ? '<td class="cell-timeout">시간초과</td>' : '<td class="cell-fail">실패</td>');
      tr.innerHTML =
        '<td>' + log.round + '</td>' +
        '<td>' + log.total + 'kg</td>' +
        '<td>' + log.half + 'kg씩</td>' +
        resultCell;
      resultTableBody.appendChild(tr);
    });

    // 총 성적
    totalRow.innerHTML = '';
    var chip = document.createElement('div');
    chip.className = 'total-chip';
    chip.innerHTML =
      '<span class="chip-dot" style="background:#FFD54F"></span>' +
      '<span>팀 성공</span>' +
      '<span class="chip-score" style="color:' + (successCount >= 5 ? '#2E7D32' : '#555') + '">' +
        successCount + '/' + TOTAL_ROUNDS + ' 라운드</span>' +
      (successCount >= 7 ? '<span style="font-size:1.1rem;">⭐</span>' : '');
    totalRow.appendChild(chip);

    showScreen('result');
  }

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
