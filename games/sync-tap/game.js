/* games/sync-tap/game.js */
(function () {
  'use strict';

  // ─── 상수 ────────────────────────────────────────────────────────────────
  var TOTAL_ROUNDS = 10;
  var WAIT_MS = 1100;          // 한쪽만 누르고 상대 대기 시간
  var RESULT_PAUSE_MS = getAutoplayPauseMs(2000);

  // 라운드별 허용 오차 (ms)와 펄스 표시 여부
  // 점증: 1~3=300ms 펄스있음, 4~6=150ms 펄스있음, 7~8=80ms 펄스있음,
  //       9~10=80ms 펄스없음(청각만)
  var ROUND_CONFIG = [
    { tolerance: 300, pulse: true },
    { tolerance: 300, pulse: true },
    { tolerance: 300, pulse: true },
    { tolerance: 150, pulse: true },
    { tolerance: 150, pulse: true },
    { tolerance: 150, pulse: true },
    { tolerance: 80,  pulse: true },
    { tolerance: 80,  pulse: true },
    { tolerance: 80,  pulse: false },
    { tolerance: 80,  pulse: false },
  ];

  // ─── 타이머 ──────────────────────────────────────────────────────────────
  var timers = [];
  var countdownInterval = null;
  var pulseAnimFrame = null;
  var waitTimer = null;

  function later(fn, ms) {
    var id = setTimeout(fn, ms);
    timers.push(id);
    return id;
  }
  function clearAllTimers() {
    if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
    if (waitTimer) { clearTimeout(waitTimer); waitTimer = null; }
    if (pulseAnimFrame) { cancelAnimationFrame(pulseAnimFrame); pulseAnimFrame = null; }
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
    // 청각 박자 (펄스 없는 라운드용) - 두 번의 짧은 비트
    beat: function (ctx) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 440;
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.07);
    },
    tap: function (ctx) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      gain.gain.setValueAtTime(0.22, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.1);
    },
    success: function (ctx) {
      [523, 659, 784, 1047].forEach(function (freq, i) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        var t = ctx.currentTime + i * 0.07;
        gain.gain.setValueAtTime(0.22, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(t); osc.stop(t + 0.33);
      });
    },
    perfect: function (ctx) {
      [523, 659, 784, 1047, 1319, 1568].forEach(function (freq, i) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        var t = ctx.currentTime + i * 0.06;
        gain.gain.setValueAtTime(0.22, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(t); osc.stop(t + 0.38);
      });
    },
    fail: function (ctx) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(250, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.35);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.38);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.4);
    },
    miss: function (ctx) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.13, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.24);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.26);
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
  var p1TapTime;       // null or timestamp
  var p2TapTime;       // null or timestamp
  var roundDone;
  var currentTolerance;
  var pulseVisible;
  // 청각 박자 인터벌 (펄스 없는 라운드)
  var beatInterval = null;

  // ─── DOM 참조 ─────────────────────────────────────────────────────────────
  var pulsePanel   = document.getElementById('pulsePanel');
  var toleranceLbl = document.getElementById('toleranceLabel');
  var diffDisplay  = document.getElementById('diffDisplay');
  var p1Pad        = document.getElementById('p1Pad');
  var p2Pad        = document.getElementById('p2Pad');
  var p1Status     = document.getElementById('p1Status');
  var p2Status     = document.getElementById('p2Status');
  var p1ScoreEl    = document.getElementById('p1ScoreEl');
  var p2ScoreEl    = document.getElementById('p2ScoreEl');
  var bannerEl     = document.getElementById('banner');
  var roundNumEl   = document.getElementById('roundNum');
  var roundScoreEl = document.getElementById('roundScore');
  var resultTitle  = document.getElementById('resultTitle');
  var resultSub    = document.getElementById('resultSub');
  var resultTbody  = document.getElementById('resultTbody');

  // ─── 청각 박자 (펄스 없는 라운드) ────────────────────────────────────────
  function startBeat() {
    if (beatInterval) clearInterval(beatInterval);
    // 1초 주기로 비트음 재생 (펄스 애니메이션 대신)
    beatInterval = setInterval(function () {
      if (!roundDone) { sounds.play('beat'); }
    }, 1000);
  }
  function stopBeat() {
    if (beatInterval) { clearInterval(beatInterval); beatInterval = null; }
  }

  // ─── 터치 패드 핸들러 ────────────────────────────────────────────────────
  onTap(p1Pad, function () {
    handleTap(1);
  });
  onTap(p2Pad, function () {
    handleTap(2);
  });

  function handleTap(player) {
    if (roundDone) return;
    var now = Date.now();
    sounds.play('tap');

    if (player === 1) {
      if (p1TapTime !== null) return; // 이미 눌렀으면 무시
      p1TapTime = now;
      p1Pad.classList.add('pressed');
      p1Status.textContent = '터치!';
      p1Status.classList.add('tapped');
    } else {
      if (p2TapTime !== null) return;
      p2TapTime = now;
      p2Pad.classList.add('pressed');
      p2Status.textContent = '터치!';
      p2Status.classList.add('tapped');
    }

    // 두 플레이어 모두 눌렀는지 확인
    if (p1TapTime !== null && p2TapTime !== null) {
      // 대기 타이머 취소
      if (waitTimer) { clearTimeout(waitTimer); waitTimer = null; }
      evaluateSync();
    } else {
      // 한 명만 눌렀음: 1초 대기 후 실패 처리
      var whoPushed = player;
      waitTimer = setTimeout(function () {
        if (!roundDone) {
          handleOnlyOneTap(whoPushed);
        }
      }, WAIT_MS);
      // 대기 중 상태 표시
      if (player === 1) {
        p2Status.textContent = '대기 중...';
        p2Status.classList.add('waiting');
      } else {
        p1Status.textContent = '대기 중...';
        p1Status.classList.add('waiting');
      }
    }
  }

  function handleOnlyOneTap(whoPushed) {
    // 상대가 안 누른 경우 = 실패
    roundDone = true;
    stopBeat();
    sounds.play('miss');
    var whoMissed = whoPushed === 1 ? 'P2' : 'P1';
    showBanner('❗ ' + whoMissed + '가 안 눌렀어요! 다음엔 같이!', 'miss');
    diffDisplay.textContent = '실패';

    roundHistory.push({
      round: currentRound + 1,
      diff: null,
      label: '실패',
      score: 0
    });

    later(function () {
      finishRound();
    }, RESULT_PAUSE_MS);
  }

  function evaluateSync() {
    roundDone = true;
    stopBeat();

    var diff = Math.abs(p1TapTime - p2TapTime);
    var diffStr = diff + 'ms 차이';
    diffDisplay.textContent = diffStr + '!';

    var pts = 0;
    var label;
    var cls;

    if (diff <= currentTolerance) {
      // 성공
      if (diff < 50) {
        pts = 5;
        label = '⭐⭐⭐ 완벽!';
        cls = 'ok';
        sounds.play('perfect');
        p1Pad.classList.add('success');
        p2Pad.classList.add('success');
      } else if (diff < 120) {
        pts = 3;
        label = '⭐⭐ 훌륭해요!';
        cls = 'ok';
        sounds.play('success');
        p1Pad.classList.add('success');
        p2Pad.classList.add('success');
      } else {
        pts = 1;
        label = '⭐ 성공!';
        cls = 'ok';
        sounds.play('success');
        p1Pad.classList.add('success');
        p2Pad.classList.add('success');
      }
      totalScore += pts;
      updateScoreUI();
      showBanner(diffStr + '! ' + label + ' +' + pts + '점', cls);
    } else {
      // 실패 (오차 초과)
      pts = 0;
      label = '아슬아슬';
      cls = 'ng';
      sounds.play('fail');
      p1Pad.classList.add('fail-pad');
      p2Pad.classList.add('fail-pad');
      showBanner(diffStr + '! 오차 ' + currentTolerance + 'ms 초과 😅', cls);
    }

    roundHistory.push({
      round: currentRound + 1,
      diff: diff,
      label: label,
      score: pts
    });

    later(function () {
      finishRound();
    }, RESULT_PAUSE_MS);
  }

  // ─── 라운드 종료 ─────────────────────────────────────────────────────────
  function finishRound() {
    hideBanner();
    diffDisplay.textContent = '';
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
    p1TapTime = null;
    p2TapTime = null;
    if (waitTimer) { clearTimeout(waitTimer); waitTimer = null; }
    stopBeat();

    var cfg = ROUND_CONFIG[currentRound];
    currentTolerance = cfg.tolerance;
    pulseVisible = cfg.pulse;

    // 패드 초기화
    p1Pad.classList.remove('pressed', 'success', 'fail-pad');
    p2Pad.classList.remove('pressed', 'success', 'fail-pad');
    p1Status.textContent = '대기 중...';
    p2Status.textContent = '대기 중...';
    p1Status.classList.remove('tapped', 'waiting');
    p2Status.classList.remove('tapped', 'waiting');
    diffDisplay.textContent = '';

    // 펄스 표시 여부
    if (pulseVisible) {
      pulsePanel.classList.remove('pulse-hidden');
    } else {
      pulsePanel.classList.add('pulse-hidden');
      // 청각 박자 시작
      startBeat();
    }

    toleranceLbl.textContent = '허용 오차: ' + currentTolerance + 'ms' +
      (pulseVisible ? '' : ' (🔊 소리로만!)');

    updateRoundUI();
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
    bannerEl.classList.remove('show', 'ok', 'ng', 'miss');
    bannerEl.textContent = '';
  }

  // ─── 게임 초기화 ─────────────────────────────────────────────────────────
  function initGame() {
    clearAllTimers();
    stopBeat();
    currentRound = 0;
    totalScore = 0;
    roundHistory = [];
    updateScoreUI();
    showScreen('game');
    beginRound();
  }

  // ─── 결과 화면 ───────────────────────────────────────────────────────────
  function showResult() {
    stopBeat();
    resultTbody.innerHTML = '';
    roundHistory.forEach(function (r) {
      var tr = document.createElement('tr');
      var diffTxt = r.diff !== null ? r.diff + 'ms' : '--';
      tr.innerHTML = '<td>' + r.round + '</td>' +
        '<td>' + diffTxt + '</td>' +
        '<td>' + r.label + '</td>' +
        '<td>+' + r.score + '</td>';
      resultTbody.appendChild(tr);
    });
    resultTitle.textContent = totalScore + '점';
    var msg;
    if (totalScore >= 35) {
      msg = '👑 마음이 완전히 통했어요! 최고 콤비!';
    } else if (totalScore >= 25) {
      msg = '🌟 훌륭한 동기화! 찰떡 팀!';
    } else if (totalScore >= 15) {
      msg = '👍 잘했어요! 조금 더 맞춰봐요!';
    } else {
      msg = '💪 다시 도전! 박자에 집중해봐요!';
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
    stopBeat();
    goHome();
  });
  onTap(document.getElementById('backBtn'), function () {
    clearAllTimers();
    stopBeat();
    goHome();
  });
  onTap(document.getElementById('closeBtn'), function () {
    clearAllTimers();
    stopBeat();
    showScreen('intro');
  });

})();
