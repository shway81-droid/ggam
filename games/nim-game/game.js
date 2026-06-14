/* games/nim-game/game.js */

(function () {
  'use strict';

  // ─── 상수 ───────────────────────────────────────────────────────────────
  var TOTAL_STONES = 15;
  var PLAYER_COLORS = ['#29B6F6', '#EF5350'];
  var PLAYER_NAMES  = ['P1', 'P2'];

  // ─── 타이머 관리 ─────────────────────────────────────────────────────────
  var timers = [];

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

  var countdownInterval = null;
  function startCountdown(onDone) {
    var countdownNumber = document.getElementById('countdownNumber');
    showScreen('countdown');
    countdownInterval = runCountdown(countdownNumber, onDone);
  }

  // ─── 사운드 ──────────────────────────────────────────────────────────────
  var sounds = createSoundManager({
    // 돌 클릭: 짧고 단단한 소리
    stone: function (ctx) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.28, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.14);
    },

    // 긴장감: 빠른 두 음
    tension: function (ctx) {
      [[180, 0], [140, 0.12]].forEach(function (item) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.value = item[0];
        var t = ctx.currentTime + item[1];
        gain.gain.setValueAtTime(0.12, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.18);
      });
    },

    // 승리 팡파레
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
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.42);
      });
    },

    // 패배 소리
    lose: function (ctx) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.55);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.6);
    },

    // 턴 변경 - P1 (높은 톤 "딩")
    turnP1: function (ctx) {
      [659, 880].forEach(function (freq, i) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        var t = ctx.currentTime + i * 0.08;
        gain.gain.setValueAtTime(0.22, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.2);
      });
    },

    // 턴 변경 - P2 (낮은 톤 "동")
    turnP2: function (ctx) {
      [392, 523].forEach(function (freq, i) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        var t = ctx.currentTime + i * 0.08;
        gain.gain.setValueAtTime(0.22, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.2);
      });
    }
  });

  // ─── 사운드 버튼 ──────────────────────────────────────────────────────────
  var soundBtns = [
    document.getElementById('soundToggleIntro'),
    document.getElementById('soundToggleGame')
  ];
  var soundIconIds = ['soundIconIntro', 'soundIconGame'];

  var SVG_SOUND_ON  = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>';
  var SVG_SOUND_OFF = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>';

  function updateSoundIcons() {
    var muted = sounds.isMuted();
    soundIconIds.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.innerHTML = muted ? SVG_SOUND_OFF : SVG_SOUND_ON;
    });
  }

  soundBtns.forEach(function (btn) {
    onTap(btn, function () {
      sounds.toggleMute();
      updateSoundIcons();
    });
  });

  updateSoundIcons();

  // ─── 게임 상태 ────────────────────────────────────────────────────────────
  var stonesLeft;
  var currentPlayer;  // 0 or 1
  var gameOver;
  var stoneEls;       // array of DOM elements (stone-wrap divs), index 0..14

  // ─── DOM ─────────────────────────────────────────────────────────────────
  var stonesArea  = document.getElementById('stonesArea');
  var stoneCount  = document.getElementById('stoneCount');
  var turnBanner  = document.getElementById('turnBanner');
  var turnDot     = document.getElementById('turnDot');
  var turnText    = document.getElementById('turnText');
  var takeButtons = document.getElementById('takeButtons');
  var takeBtns    = [
    document.getElementById('take1'),
    document.getElementById('take2'),
    document.getElementById('take3')
  ];
  var resultTitle    = document.getElementById('resultTitle');
  var resultSub      = document.getElementById('resultSub');
  var resultIconWrap = document.getElementById('resultIconWrap');

  // ─── 돌 SVG 생성 ──────────────────────────────────────────────────────────
  function makeStoneSVG() {
    // 모든 돌은 동일한 색상으로 통일 (가져갈 때 자연스럽게 보이도록)
    var fill = '#78909C';
    var stroke = '#546E7A';
    return (
      '<svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true">' +
        '<circle cx="20" cy="22" r="16" fill="' + fill + '" stroke="' + stroke + '" stroke-width="2"/>' +
        '<circle cx="15" cy="17" r="5" fill="rgba(255,255,255,0.2)"/>' +
      '</svg>'
    );
  }

  // ─── 게임 초기화 ──────────────────────────────────────────────────────────
  function initGame() {
    clearAllTimers();

    stonesLeft = TOTAL_STONES;
    currentPlayer = 0;
    gameOver = false;
    stoneEls = [];

    buildStonesGrid();
    updateCounterUI();
    updateTurnUI();
    updateButtonState();

    showScreen('game');
  }

  // ─── 돌 그리드 빌드 (3 rows x 5 cols = 15) ────────────────────────────────
  function buildStonesGrid() {
    stonesArea.innerHTML = '';
    stonesArea.classList.remove('tension');
    stoneEls = [];

    // Rows: 5, 5, 5
    var rows = [5, 5, 5];
    var stoneIdx = 0;

    rows.forEach(function (count) {
      var row = document.createElement('div');
      row.className = 'stones-row';

      for (var i = 0; i < count; i++) {
        var wrap = document.createElement('div');
        wrap.className = 'stone-wrap';
        wrap.innerHTML = makeStoneSVG();
        wrap.setAttribute('data-idx', stoneIdx);
        row.appendChild(wrap);
        stoneEls.push(wrap);
        stoneIdx++;
      }

      stonesArea.appendChild(row);
    });
  }

  // ─── 턴 UI 업데이트 ──────────────────────────────────────────────────────
  function updateTurnUI(announce) {
    var color = PLAYER_COLORS[currentPlayer];
    var name  = PLAYER_NAMES[currentPlayer];
    var pCls  = currentPlayer === 0 ? 'p1' : 'p2';

    turnDot.style.background = color;
    turnText.textContent = name + '의 차례';

    turnBanner.classList.remove('p1', 'p2');
    turnBanner.classList.add(pCls);

    takeButtons.classList.remove('p1', 'p2');
    takeButtons.classList.add(pCls);

    // 방안 B: 게임 보드 두꺼운 컬러 테두리 (지속)
    var gameScreen = document.getElementById('gameScreen');
    if (gameScreen) {
      gameScreen.classList.remove('turn-p1', 'turn-p2');
      gameScreen.classList.add('turn-' + pCls);
    }

    if (announce) {
      // 방안 A: 풀스크린 턴 변경 오버레이 (0.6초)
      showTurnOverlay(name, color, pCls);
      // 방안 D: 효과음
      sounds.play(currentPlayer === 0 ? 'turnP1' : 'turnP2');
    }
  }

  // ─── 풀스크린 턴 변경 오버레이 ──────────────────────────────────────────
  function showTurnOverlay(name, color, pCls) {
    var overlay = document.getElementById('turnOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'turnOverlay';
      overlay.className = 'turn-overlay';
      overlay.innerHTML = '<div class="turn-overlay-text"></div>';
      document.body.appendChild(overlay);
    }
    overlay.className = 'turn-overlay show ' + pCls;
    overlay.querySelector('.turn-overlay-text').textContent = '⚡ ' + name + ' 차례 ⚡';
    // Restart animation
    void overlay.offsetWidth;
    setTimeout(function () {
      overlay.classList.remove('show');
    }, 600);
  }

  // ─── 카운터 UI 업데이트 ──────────────────────────────────────────────────
  function updateCounterUI() {
    stoneCount.textContent = stonesLeft;
    stoneCount.classList.toggle('danger', stonesLeft <= 3);
    stoneCount.classList.remove('bump');
    // Trigger reflow for animation restart
    void stoneCount.offsetWidth;
    stoneCount.classList.add('bump');
  }

  // ─── 버튼 활성/비활성 ─────────────────────────────────────────────────────
  function updateButtonState() {
    takeBtns.forEach(function (btn) {
      var n = parseInt(btn.getAttribute('data-n'), 10);
      btn.disabled = (n > stonesLeft) || gameOver;
    });
    takeButtons.classList.toggle('locked', gameOver);
  }

  // ─── 가져가기 처리 ────────────────────────────────────────────────────────
  function handleTake(n) {
    if (gameOver) return;
    if (n > stonesLeft) return;

    // Temporarily lock buttons during animation
    takeButtons.classList.add('locked');

    sounds.play('stone');

    // Animate stones taken from the right (highest index first)
    var toRemove = stoneEls.filter(function (el) {
      return !el.classList.contains('taken');
    }).slice(-n);

    var animDelay = 0;
    toRemove.forEach(function (el, i) {
      (function (elem, delay) {
        later(function () {
          elem.classList.add('taken');
          if (i > 0) sounds.play('stone');
        }, delay);
      })(el, animDelay);
      animDelay += 80;
    });

    stonesLeft -= n;

    later(function () {
      updateCounterUI();

      // Tension: 3 or fewer stones left
      if (stonesLeft <= 3 && stonesLeft > 0) {
        stonesArea.classList.add('tension');
        sounds.play('tension');
      }

      if (stonesLeft === 0) {
        // Current player just took the last stone — they LOSE
        gameOver = true;
        var loser  = currentPlayer;
        var winner = 1 - currentPlayer;
        later(function () {
          sounds.play('lose');
          later(function () {
            sounds.play('win');
            showResult(winner, loser);
          }, 400);
        }, 200);
      } else {
        // Switch player
        currentPlayer = 1 - currentPlayer;
        updateTurnUI(true); // announce = true (오버레이 + 사운드)
        updateButtonState();
        takeButtons.classList.remove('locked');
      }
    }, animDelay + 80);
  }

  // ─── 결과 화면 ───────────────────────────────────────────────────────────
  var SVG_TROPHY =
    '<svg viewBox="0 0 80 80" width="80" height="80">' +
      '<rect x="28" y="62" width="24" height="6" rx="3" fill="#FFA726"/>' +
      '<rect x="22" y="68" width="36" height="6" rx="3" fill="#FFA726"/>' +
      '<path d="M15 18 Q15 50 40 54 Q65 50 65 18 Z" fill="#FFD54F" stroke="#FFA726" stroke-width="2"/>' +
      '<path d="M15 18 Q8 18 8 28 Q8 40 20 42 Q15 35 15 26 Z" fill="#FFA726"/>' +
      '<path d="M65 18 Q72 18 72 28 Q72 40 60 42 Q65 35 65 26 Z" fill="#FFA726"/>' +
      '<ellipse cx="40" cy="20" rx="22" ry="6" fill="#FFE082"/>' +
      '<text x="40" y="42" text-anchor="middle" font-size="18" font-weight="900" fill="#E65100">WIN</text>' +
    '</svg>';

  var SVG_LOSE =
    '<svg viewBox="0 0 80 80" width="80" height="80">' +
      '<circle cx="40" cy="40" r="30" fill="#EF9A9A" stroke="#EF5350" stroke-width="3"/>' +
      '<line x1="26" y1="26" x2="54" y2="54" stroke="#C62828" stroke-width="5" stroke-linecap="round"/>' +
      '<line x1="54" y1="26" x2="26" y2="54" stroke="#C62828" stroke-width="5" stroke-linecap="round"/>' +
    '</svg>';

  function showResult(winner, loser) {
    var winColor = PLAYER_COLORS[winner];

    // Result icon: trophy
    resultIconWrap.innerHTML = SVG_TROPHY;

    resultTitle.textContent = PLAYER_NAMES[winner] + ' 승리!';
    resultTitle.style.color = winColor;

    resultSub.textContent = PLAYER_NAMES[loser] + '가 마지막 돌을 가져갔어요.';

    showScreen('result');
  }

  // ─── 버튼 이벤트 바인딩 ──────────────────────────────────────────────────
  // 가져가기 버튼
  takeBtns.forEach(function (btn) {
    onTap(btn, function () {
      if (btn.disabled || gameOver) return;
      var n = parseInt(btn.getAttribute('data-n'), 10);
      handleTake(n);
    });
  });

  // PLAY
  onTap(document.getElementById('playBtn'), function () {
    startCountdown(function() { initGame(); });
  });

  // 다시하기
  onTap(document.getElementById('retryBtn'), function () {
    startCountdown(function() { initGame(); });
  });

  // 홈으로
  onTap(document.getElementById('homeBtn'), function () {
    clearAllTimers();
    goHome();
  });

  // 뒤로 (인트로에서)
  onTap(document.getElementById('backBtn'), function () {
    clearAllTimers();
    goHome();
  });

  // 닫기 (게임에서 인트로로)
  onTap(document.getElementById('closeBtn'), function () {
    clearAllTimers();
    showScreen('intro');
  });

})();
