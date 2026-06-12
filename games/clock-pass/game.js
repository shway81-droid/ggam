/* games/clock-pass/game.js */

(function () {
  'use strict';

  // ─── 상수 ────────────────────────────────────────────────────────────────
  var TOTAL_ROUNDS    = 8;
  var ROUND_TIME      = 25;  // 라운드당 25초
  var RESULT_PAUSE_MS = getAutoplayPauseMs(2000);

  // 시각 풀 — { h, m } — 단계별 필터링
  // 단계 0: 정시 (m===0, 라운드 1~2)
  // 단계 1: 30분 (m===30, 라운드 3~5)
  // 단계 2: 15분 단위 (m===0/15/30/45, 라운드 6~8)
  var TIME_POOL_0 = [
    {h:1,m:0},{h:2,m:0},{h:3,m:0},{h:4,m:0},{h:5,m:0},
    {h:6,m:0},{h:7,m:0},{h:8,m:0},{h:9,m:0},{h:10,m:0},{h:11,m:0},{h:12,m:0}
  ];
  var TIME_POOL_1 = [
    {h:1,m:30},{h:2,m:30},{h:3,m:30},{h:4,m:30},{h:5,m:30},
    {h:6,m:30},{h:7,m:30},{h:8,m:30},{h:9,m:30},{h:10,m:30},{h:11,m:30},{h:12,m:30}
  ];
  var TIME_POOL_2 = [
    {h:1,m:15},{h:2,m:45},{h:3,m:15},{h:4,m:45},{h:5,m:15},
    {h:6,m:15},{h:7,m:45},{h:8,m:15},{h:9,m:45},{h:10,m:15},{h:11,m:45},{h:12,m:15},
    {h:1,m:0},{h:3,m:30},{h:6,m:45},{h:9,m:15}
  ];

  // ─── 타이머 관리 ─────────────────────────────────────────────────────────
  var timers = [];
  var countdownInterval = null;
  var roundTimer = null;

  function later(fn, ms) {
    var id = setTimeout(fn, ms);
    timers.push(id);
    return id;
  }

  function clearAllTimers() {
    if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
    if (roundTimer) { roundTimer.stop(); roundTimer = null; }
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
    Object.keys(screens).forEach(function (key) {
      screens[key].classList.toggle('active', key === name);
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
    tick: function (ctx) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.07);
    },
    correct: function (ctx) {
      [659, 784, 988, 1175].forEach(function (freq, i) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        var t = ctx.currentTime + i * 0.08;
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(t); osc.stop(t + 0.25);
      });
    },
    wrong: function (ctx) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(280, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + 0.35);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.38);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.4);
    },
    win: function (ctx) {
      var notes = [523, 659, 784, 1047, 1319];
      notes.forEach(function (freq, i) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        var t = ctx.currentTime + i * 0.1;
        gain.gain.setValueAtTime(0.22, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(t); osc.stop(t + 0.42);
      });
    }
  });

  // ─── 사운드 아이콘 ───────────────────────────────────────────────────────
  var SVG_SOUND_ON  = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>';
  var SVG_SOUND_OFF = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>';

  function updateSoundIcons() {
    var muted = sounds.isMuted();
    var el = document.getElementById('soundIconIntro');
    if (el) el.innerHTML = muted ? SVG_SOUND_OFF : SVG_SOUND_ON;
  }
  var stIntro = document.getElementById('soundToggleIntro');
  if (stIntro) {
    onTap(stIntro, function () { sounds.toggleMute(); updateSoundIcons(); });
  }
  updateSoundIcons();

  // ─── 게임 상태 ────────────────────────────────────────────────────────────
  var currentRound;
  var teamScore;
  var roundLocked;
  var targetH;     // 정답 시
  var targetM;     // 정답 분
  var setH;        // P2가 맞춘 시
  var setM;        // P2가 맞춘 분
  var readerIsP1;  // true: P1이 읽어주기, false: P2가 읽어주기

  // ─── DOM ─────────────────────────────────────────────────────────────────
  var roundNumEl        = document.getElementById('roundNum');
  var timerEl           = document.getElementById('timerEl');
  var teamScoreEl       = document.getElementById('teamScore');
  var digitalTimeEl     = document.getElementById('digitalTime');
  var hourHand          = document.getElementById('hourHand');
  var minHand           = document.getElementById('minHand');
  var currentTimeDsp    = document.getElementById('currentTimeDisplay');
  var bannerEl          = document.getElementById('banner');
  var readerLabel       = document.getElementById('readerLabel');
  var setterLabel       = document.getElementById('setterLabel');
  var roleBadge1        = document.getElementById('roleBadge1');
  var roleBadge2        = document.getElementById('roleBadge2');
  var resultTitle       = document.getElementById('resultTitle');
  var resultSub         = document.getElementById('resultSub');
  var resultIconWrap    = document.getElementById('resultIconWrap');
  var hourTicks         = document.getElementById('hourTicks');
  var hourNums          = document.getElementById('hourNums');
  var confirmBtn        = document.getElementById('confirmBtn');

  // ─── 시계 눈금·숫자 초기화 ──────────────────────────────────────────────
  function initClockFace() {
    hourTicks.innerHTML = '';
    hourNums.innerHTML = '';
    for (var i = 0; i < 12; i++) {
      var angle = (i / 12) * 360;
      var rad = (angle - 90) * Math.PI / 180;
      var x1 = 100 + 86 * Math.cos(rad);
      var y1 = 100 + 86 * Math.sin(rad);
      var x2 = 100 + 76 * Math.cos(rad);
      var y2 = 100 + 76 * Math.sin(rad);
      var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', x1);
      line.setAttribute('y1', y1);
      line.setAttribute('x2', x2);
      line.setAttribute('y2', y2);
      line.setAttribute('stroke', '#555');
      line.setAttribute('stroke-width', '3');
      hourTicks.appendChild(line);

      // 숫자
      var nx = 100 + 64 * Math.cos(rad);
      var ny = 100 + 64 * Math.sin(rad);
      var text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', nx);
      text.setAttribute('y', ny);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'central');
      text.setAttribute('font-size', '16');
      text.setAttribute('font-weight', '900');
      text.setAttribute('fill', '#2C2C2C');
      text.textContent = (i === 0 ? 12 : i);
      hourNums.appendChild(text);
    }
  }

  // ─── 시침·분침 각도 계산 ─────────────────────────────────────────────────
  // 시침: 시 * 30도 + 분 * 0.5도 (분에 비례해 기울게)
  // 분침: 분 * 6도
  function getHandCoords(angleDeg, length) {
    var rad = (angleDeg - 90) * Math.PI / 180;
    var x2 = 100 + length * Math.cos(rad);
    var y2 = 100 + length * Math.sin(rad);
    return { x2: x2, y2: y2 };
  }

  function updateClock(h, m) {
    var hourAngle = ((h % 12) / 12) * 360 + (m / 60) * 30;
    var minAngle  = (m / 60) * 360;

    var hc = getHandCoords(hourAngle, 52);
    var mc = getHandCoords(minAngle, 70);

    hourHand.setAttribute('x2', hc.x2);
    hourHand.setAttribute('y2', hc.y2);
    minHand.setAttribute('x2', mc.x2);
    minHand.setAttribute('y2', mc.y2);

    // 현재 시각 표시
    var hStr = String(h);
    var mStr = m < 10 ? '0' + m : String(m);
    currentTimeDsp.textContent = hStr + ':' + mStr;
  }

  // ─── 시각 포맷 ───────────────────────────────────────────────────────────
  function formatTime(h, m) {
    var mStr = m < 10 ? '0' + m : String(m);
    return h + ':' + mStr;
  }

  // ─── 난이도 단계 ─────────────────────────────────────────────────────────
  function getStage(round) {
    if (round < 2) return 0;
    if (round < 5) return 1;
    return 2;
  }

  // ─── 셔플 ────────────────────────────────────────────────────────────────
  function shuffleArr(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  // 사용한 시각 풀 (중복 방지)
  var usedTimes;

  function pickTime(stage) {
    var pool;
    if (stage === 0) pool = TIME_POOL_0;
    else if (stage === 1) pool = TIME_POOL_1;
    else pool = TIME_POOL_2;

    var shuffled = shuffleArr(pool);
    for (var i = 0; i < shuffled.length; i++) {
      var key = shuffled[i].h + ':' + shuffled[i].m;
      if (usedTimes.indexOf(key) === -1) {
        usedTimes.push(key);
        return shuffled[i];
      }
    }
    // 모두 사용됐으면 풀 리셋
    usedTimes = [];
    var t = shuffled[0];
    usedTimes.push(t.h + ':' + t.m);
    return t;
  }

  // ─── 역할 UI 업데이트 ────────────────────────────────────────────────────
  function updateRoleUI() {
    if (readerIsP1) {
      readerLabel.textContent = 'P1';
      readerLabel.className = 'zone-label zr';
      setterLabel.textContent = 'P2';
      setterLabel.className = 'zone-label zs';
      roleBadge1.textContent = 'P1: 읽어주기';
      roleBadge1.className = 'role-badge r1';
      roleBadge2.textContent = 'P2: 맞추기';
      roleBadge2.className = 'role-badge r2';
    } else {
      readerLabel.textContent = 'P2';
      readerLabel.className = 'zone-label zs';
      setterLabel.textContent = 'P1';
      setterLabel.className = 'zone-label zr';
      roleBadge1.textContent = 'P2: 읽어주기';
      roleBadge1.className = 'role-badge r2';
      roleBadge2.textContent = 'P1: 맞추기';
      roleBadge2.className = 'role-badge r1';
    }
  }

  // ─── 라운드 시작 ─────────────────────────────────────────────────────────
  function startRound() {
    if (roundTimer) { roundTimer.stop(); roundTimer = null; }
    roundLocked = false;

    var st = getStage(currentRound);
    var time = pickTime(st);
    targetH = time.h;
    targetM = time.m;

    // 역할 교대 (홀수 라운드: P1 읽어주기, 짝수: P2 읽어주기)
    readerIsP1 = (currentRound % 2 === 0);
    updateRoleUI();

    roundNumEl.textContent = (currentRound + 1) + '/' + TOTAL_ROUNDS;
    digitalTimeEl.textContent = formatTime(targetH, targetM);

    // 시계 초기 12:00
    setH = 12;
    setM = 0;
    updateClock(setH, setM);
    hideBanner();

    // 확인 버튼 활성화
    confirmBtn.disabled = false;
    confirmBtn.style.opacity = '1';

    // 타이머 시작
    timerEl.textContent = ROUND_TIME;
    timerEl.classList.remove('warning');
    roundTimer = createTimer(ROUND_TIME, function (remain) {
      timerEl.textContent = remain;
      if (remain <= 8) {
        timerEl.classList.add('warning');
        sounds.play('tick');
      }
    }, function () {
      // 시간 초과 → 자동 오답 처리
      if (!roundLocked) {
        roundLocked = true;
        confirmBtn.disabled = true;
        sounds.play('wrong');
        showBanner('⏰ 시간 초과! (정답: ' + formatTime(targetH, targetM) + ')', 'ng');
        later(function () {
          currentRound++;
          if (currentRound >= TOTAL_ROUNDS) {
            showResult();
          } else {
            hideBanner();
            startRound();
          }
        }, RESULT_PAUSE_MS);
      }
    });
    roundTimer.start();
  }

  // ─── 조절 버튼 ───────────────────────────────────────────────────────────
  onTap(document.getElementById('hourUp'), function () {
    if (roundLocked) return;
    sounds.play('tick');
    setH = setH < 12 ? setH + 1 : 1;
    updateClock(setH, setM);
  });

  onTap(document.getElementById('hourDown'), function () {
    if (roundLocked) return;
    sounds.play('tick');
    setH = setH > 1 ? setH - 1 : 12;
    updateClock(setH, setM);
  });

  onTap(document.getElementById('minUp'), function () {
    if (roundLocked) return;
    sounds.play('tick');
    setM = (setM + 15) % 60;
    updateClock(setH, setM);
  });

  onTap(document.getElementById('minDown'), function () {
    if (roundLocked) return;
    sounds.play('tick');
    setM = (setM - 15 + 60) % 60;
    updateClock(setH, setM);
  });

  // ─── 확인 버튼 ───────────────────────────────────────────────────────────
  onTap(confirmBtn, function () {
    if (roundLocked) return;
    roundLocked = true;
    if (roundTimer) { roundTimer.stop(); roundTimer = null; }
    confirmBtn.disabled = true;

    var hOk = (setH === targetH) || (setH === targetH % 12 && targetH === 12) || (targetH % 12 === setH % 12);
    var mOk = (setM === targetM);

    // 시침: 12시 = 0시 동일 처리
    var setH12 = setH === 12 ? 0 : setH;
    var tgtH12 = targetH === 12 ? 0 : targetH;
    hOk = (setH12 === tgtH12) && mOk;

    var ok = (setH12 === tgtH12) && mOk;

    if (ok) {
      teamScore++;
      updateScoreUI();
      sounds.play('correct');
      showBanner('🎉 정확해요! ' + formatTime(targetH, targetM) + ' 맞아요!', 'ok');
    } else {
      sounds.play('wrong');
      showBanner('아쉬워요! 정답: ' + formatTime(targetH, targetM) + ' (맞춘 시각: ' + formatTime(setH, setM) + ')', 'ng');
    }

    later(function () {
      currentRound++;
      if (currentRound >= TOTAL_ROUNDS) {
        showResult();
      } else {
        hideBanner();
        startRound();
      }
    }, RESULT_PAUSE_MS);
  });

  // ─── UI ──────────────────────────────────────────────────────────────────
  function updateScoreUI() {
    teamScoreEl.textContent = teamScore;
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
    currentRound = 0;
    teamScore = 0;
    roundLocked = false;
    readerIsP1 = true;
    usedTimes = [];
    updateScoreUI();
    initClockFace();
    showScreen('game');
    startRound();
  }

  // ─── 결과 화면 ───────────────────────────────────────────────────────────
  function showResult() {
    var pct = teamScore / TOTAL_ROUNDS;
    var sub, iconHtml;
    if (pct === 1) {
      sub = '완벽한 시계 읽기! 찰떡 호흡!';
      iconHtml = makeIcon('🏆', '#FFD54F');
    } else if (pct >= 0.75) {
      sub = '훌륭해요! 시계 박사에 가까워요!';
      iconHtml = makeIcon('⏰', '#FFE0B2');
    } else if (pct >= 0.5) {
      sub = '절반 성공! 조금 더 연습해요!';
      iconHtml = makeIcon('⏰', '#FFF9C4');
    } else {
      sub = '시계 공부를 더 해봐요! 다시 도전!';
      iconHtml = makeIcon('⏰', '#FFCDD2');
    }
    resultTitle.textContent = teamScore + '/' + TOTAL_ROUNDS + ' 성공';
    resultSub.textContent = sub;
    resultIconWrap.innerHTML = iconHtml;
    sounds.play('win');
    showScreen('result');
  }

  function makeIcon(emoji, bg) {
    return '<svg viewBox="0 0 80 80" width="80" height="80">' +
      '<circle cx="40" cy="40" r="32" fill="' + bg + '" stroke="#2C2C2C" stroke-width="3"/>' +
      '<text x="40" y="52" text-anchor="middle" font-size="32">' + emoji + '</text>' +
      '</svg>';
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
    showScreen('intro');
  });

})();
