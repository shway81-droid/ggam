/* games/split-count/game.js */

(function () {
  'use strict';

  // ─── 상수 ────────────────────────────────────────────────────────────────
  var TOTAL_ROUNDS = 8;
  var RESULT_PAUSE_MS = getAutoplayPauseMs(2000);

  // 단계별 설정
  // 0: 각 구역 3~5개, 이모지 1종 (라운드 1~3)
  // 1: 각 구역 6~9개, 이모지 1종 (라운드 4~6)
  // 2: 각 구역 4~8개, 이모지 2종 중 지정된 것만 세기 (라운드 7~8)

  // 이모지 세트 쌍 (메인, 미끼)
  var EMOJI_SETS = [
    { main: '🍎', decoy: '🍐' },
    { main: '⭐', decoy: '🌙' },
    { main: '🐶', decoy: '🐱' },
    { main: '🌸', decoy: '🌼' },
    { main: '🔵', decoy: '🟡' },
    { main: '🍓', decoy: '🫐' },
    { main: '🦋', decoy: '🐝' },
    { main: '🚗', decoy: '🚕' }
  ];

  // ─── 타이머 관리 ─────────────────────────────────────────────────────────
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
    pick: function (ctx) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.12);
    },
    correct: function (ctx) {
      [523, 659, 784, 1047].forEach(function (freq, i) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        var t = ctx.currentTime + i * 0.08;
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(t); osc.stop(t + 0.22);
      });
    },
    wrong: function (ctx) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(260, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(130, ctx.currentTime + 0.35);
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
  var leftAns;   // 왼쪽(P1) 정답
  var rightAns;  // 오른쪽(P2) 정답
  var p1Value;   // P1이 선택한 값 (null이면 미선택)
  var p2Value;   // P2가 선택한 값

  // ─── DOM ─────────────────────────────────────────────────────────────────
  var roundNumEl    = document.getElementById('roundNum');
  var targetBadge   = document.getElementById('targetBadge');
  var teamScoreEl   = document.getElementById('teamScore');
  var gridLeft      = document.getElementById('gridLeft');
  var gridRight     = document.getElementById('gridRight');
  var p1Display     = document.getElementById('p1Display');
  var p2Display     = document.getElementById('p2Display');
  var p1Numpad      = document.getElementById('p1Numpad');
  var p2Numpad      = document.getElementById('p2Numpad');
  var bannerEl      = document.getElementById('banner');
  var resultTitle   = document.getElementById('resultTitle');
  var resultSub     = document.getElementById('resultSub');
  var resultIconWrap = document.getElementById('resultIconWrap');

  // ─── 난이도 단계 ─────────────────────────────────────────────────────────
  function getStage(round) {
    if (round < 3) return 0;
    if (round < 6) return 1;
    return 2;
  }

  // ─── 랜덤 정수 ───────────────────────────────────────────────────────────
  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // ─── 셔플 ────────────────────────────────────────────────────────────────
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  // ─── 이모지 그리드 생성 ──────────────────────────────────────────────────
  function buildEmojiGrid(container, items) {
    container.innerHTML = '';
    var shuffled = shuffle(items);
    shuffled.forEach(function (em) {
      var cell = document.createElement('span');
      cell.className = 'emoji-cell';
      cell.textContent = em;
      container.appendChild(cell);
    });
  }

  // ─── 숫자패드 생성 (1~9) ──────────────────────────────────────────────────
  function buildNumpad(container, onSelect) {
    container.innerHTML = '';
    for (var n = 1; n <= 9; n++) {
      (function (num) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'np-btn';
        btn.textContent = num;
        btn.setAttribute('data-num', num);
        onTap(btn, function () {
          onSelect(num, btn, container);
        });
        container.appendChild(btn);
      })(n);
    }
  }

  // ─── 라운드 시작 ─────────────────────────────────────────────────────────
  function startRound() {
    roundLocked = false;
    p1Value = null;
    p2Value = null;

    var st = getStage(currentRound);
    var emojiSet = EMOJI_SETS[currentRound % EMOJI_SETS.length];

    roundNumEl.textContent = (currentRound + 1) + '/' + TOTAL_ROUNDS;
    p1Display.textContent = '?';
    p2Display.textContent = '?';
    p1Display.className = 'iz-display';
    p2Display.className = 'iz-display';
    hideBanner();

    var leftItems = [];
    var rightItems = [];

    if (st === 0) {
      // 단계 0: 각 구역 3~5개, 이모지 1종
      var leftCount = randInt(3, 5);
      var rightCount = randInt(3, 5);
      for (var i = 0; i < leftCount; i++) leftItems.push(emojiSet.main);
      for (var i = 0; i < rightCount; i++) rightItems.push(emojiSet.main);
      leftAns = leftCount;
      rightAns = rightCount;
      targetBadge.textContent = emojiSet.main + ' 세기';

    } else if (st === 1) {
      // 단계 1: 각 구역 6~9개, 이모지 1종
      var leftCount = randInt(6, 9);
      var rightCount = randInt(6, 9);
      for (var i = 0; i < leftCount; i++) leftItems.push(emojiSet.main);
      for (var i = 0; i < rightCount; i++) rightItems.push(emojiSet.main);
      leftAns = leftCount;
      rightAns = rightCount;
      targetBadge.textContent = emojiSet.main + ' 세기';

    } else {
      // 단계 2: 이모지 2종, 지정 이모지만 세기
      var mainLeft = randInt(3, 6);
      var decoyLeft = randInt(1, 3);
      var mainRight = randInt(3, 6);
      var decoyRight = randInt(1, 3);
      for (var i = 0; i < mainLeft; i++) leftItems.push(emojiSet.main);
      for (var i = 0; i < decoyLeft; i++) leftItems.push(emojiSet.decoy);
      for (var i = 0; i < mainRight; i++) rightItems.push(emojiSet.main);
      for (var i = 0; i < decoyRight; i++) rightItems.push(emojiSet.decoy);
      leftAns = mainLeft;
      rightAns = mainRight;
      targetBadge.textContent = emojiSet.main + '만 세요!';
    }

    buildEmojiGrid(gridLeft, leftItems);
    buildEmojiGrid(gridRight, rightItems);

    // 숫자패드 최대값 결정 (답이 9 이하이므로 1~9 항상 OK)
    buildNumpad(p1Numpad, onP1Pick);
    buildNumpad(p2Numpad, onP2Pick);
  }

  // ─── P1 선택 ─────────────────────────────────────────────────────────────
  function onP1Pick(num, btn, container) {
    if (roundLocked) return;
    sounds.play('pick');
    container.querySelectorAll('.np-btn').forEach(function (b) {
      b.classList.remove('selected');
    });
    btn.classList.add('selected');
    p1Value = num;
    p1Display.textContent = num;
    checkBothSelected();
  }

  // ─── P2 선택 ─────────────────────────────────────────────────────────────
  function onP2Pick(num, btn, container) {
    if (roundLocked) return;
    sounds.play('pick');
    container.querySelectorAll('.np-btn').forEach(function (b) {
      b.classList.remove('selected');
    });
    btn.classList.add('selected');
    p2Value = num;
    p2Display.textContent = num;
    checkBothSelected();
  }

  // ─── 자동 판정 (둘 다 선택 완료 시) ─────────────────────────────────────
  function checkBothSelected() {
    if (p1Value === null || p2Value === null) return;
    roundLocked = true;
    // 잠금
    p1Numpad.querySelectorAll('.np-btn').forEach(function (b) { b.classList.add('locked'); });
    p2Numpad.querySelectorAll('.np-btn').forEach(function (b) { b.classList.add('locked'); });

    later(judgeRound, 400);
  }

  // ─── 판정 ────────────────────────────────────────────────────────────────
  function judgeRound() {
    var p1Ok = (p1Value === leftAns);
    var p2Ok = (p2Value === rightAns);
    var allOk = p1Ok && p2Ok;

    // 표시
    if (p1Ok) {
      p1Display.classList.add('correct');
    } else {
      p1Display.classList.add('wrong');
    }
    if (p2Ok) {
      p2Display.classList.add('correct');
    } else {
      p2Display.classList.add('wrong');
    }

    if (allOk) {
      teamScore++;
      updateScoreUI();
      sounds.play('correct');
      showBanner('🎉 정확해요! P1 구역 ✓ P2 구역 ✓', 'ok');
    } else {
      sounds.play('wrong');
      var p1Msg = 'P1 구역 ' + (p1Ok ? '○' : '✕(정답:' + leftAns + ')');
      var p2Msg = 'P2 구역 ' + (p2Ok ? '○' : '✕(정답:' + rightAns + ')');
      showBanner(p1Msg + '  ' + p2Msg, 'ng');
    }

    later(function () {
      currentRound++;
      if (currentRound >= TOTAL_ROUNDS) {
        showResult();
      } else {
        startRound();
      }
    }, RESULT_PAUSE_MS);
  }

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
    updateScoreUI();
    showScreen('game');
    startRound();
  }

  // ─── 결과 화면 ───────────────────────────────────────────────────────────
  function showResult() {
    var pct = teamScore / TOTAL_ROUNDS;
    var sub, iconHtml;
    if (pct === 1) {
      sub = '완벽한 세기 실력! 최고의 팀!';
      iconHtml = makeIcon('🏆', '#FFD54F');
    } else if (pct >= 0.75) {
      sub = '훌륭해요! 거의 다 맞혔어요!';
      iconHtml = makeIcon('🧮', '#C5CAE9');
    } else if (pct >= 0.5) {
      sub = '절반 성공! 조금 더 꼼꼼히!';
      iconHtml = makeIcon('🧮', '#FFF9C4');
    } else {
      sub = '천천히 세어봐요! 다시 도전!';
      iconHtml = makeIcon('🧮', '#FFCDD2');
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
