/* games/sum-relay/game.js */

(function () {
  'use strict';

  // ─── 라운드 데이터 (36개 풀에서 5개 선택) ───────────────────────────────
  // 각 항목: target, p1Cards (4개), p2Cards (4개) — 적어도 한 쌍이 정답
  var PROBLEM_POOL = [
    { target: 10, p1: [3, 5, 7, 2], p2: [8, 4, 6, 1] },
    { target: 12, p1: [4, 6, 3, 8], p2: [9, 7, 5, 2] },
    { target: 15, p1: [6, 9, 4, 8], p2: [7, 5, 6, 3] },
    { target: 11, p1: [2, 5, 7, 4], p2: [9, 3, 6, 8] },
    { target: 13, p1: [5, 8, 2, 6], p2: [7, 4, 9, 10] },
    { target: 8,  p1: [1, 3, 5, 7], p2: [7, 4, 6, 2] },
    { target: 14, p1: [6, 4, 9, 8], p2: [5, 7, 3, 10] },
    { target: 17, p1: [8, 9, 5, 6], p2: [8, 4, 7, 11] },
    { target: 9,  p1: [2, 4, 6, 1], p2: [3, 5, 7, 8] },
    { target: 16, p1: [7, 9, 5, 6], p2: [9, 7, 3, 11] },
    { target: 18, p1: [9, 7, 6, 10], p2: [9, 5, 8, 12] },
    { target: 20, p1: [11, 8, 9, 7], p2: [9, 12, 6, 13] },
    { target: 7,  p1: [2, 4, 1, 5], p2: [3, 6, 5, 2] },
    { target: 19, p1: [10, 8, 9, 11], p2: [9, 11, 7, 13] },
    { target: 21, p1: [12, 9, 10, 11], p2: [9, 14, 11, 8] },
    { target: 6,  p1: [1, 2, 4, 3], p2: [5, 4, 2, 6] },
    { target: 22, p1: [13, 9, 11, 14], p2: [13, 8, 11, 15] },
    { target: 12, p1: [7, 3, 5, 9], p2: [3, 7, 5, 2] },
    { target: 14, p1: [3, 8, 6, 11], p2: [7, 9, 4, 6] },
    { target: 11, p1: [4, 7, 9, 2], p2: [4, 8, 6, 3] },
    { target: 16, p1: [9, 5, 7, 4], p2: [11, 7, 9, 6] },
    { target: 13, p1: [4, 8, 5, 11], p2: [6, 9, 3, 10] },
    { target: 15, p1: [12, 8, 6, 4], p2: [11, 7, 3, 9] },
    { target: 8,  p1: [3, 5, 1, 6], p2: [3, 5, 7, 2] },
    { target: 10, p1: [4, 7, 2, 8], p2: [3, 6, 5, 9] },
    { target: 9,  p1: [3, 7, 2, 5], p2: [6, 4, 2, 8] },
    { target: 17, p1: [12, 8, 9, 11], p2: [5, 6, 8, 9] },
    { target: 18, p1: [11, 7, 9, 10], p2: [11, 7, 8, 5] },
    { target: 7,  p1: [1, 4, 3, 6], p2: [3, 6, 4, 1] },
    { target: 11, p1: [5, 7, 4, 8], p2: [3, 6, 9, 4] },
    { target: 13, p1: [7, 4, 9, 8], p2: [5, 4, 6, 9] },
    { target: 6,  p1: [3, 1, 4, 2], p2: [5, 3, 4, 2] },
    { target: 15, p1: [8, 4, 7, 11], p2: [7, 4, 11, 8] },
    { target: 14, p1: [9, 5, 11, 7], p2: [5, 7, 3, 9] },
    { target: 19, p1: [10, 12, 8, 11], p2: [9, 7, 11, 8] },
    { target: 5,  p1: [1, 3, 2, 4], p2: [4, 2, 1, 3] }
  ];

  var TOTAL_ROUNDS = 5;

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
    pick: function (ctx) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    },
    correct: function (ctx) {
      [659, 784, 988].forEach(function (freq, i) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        var t = ctx.currentTime + i * 0.08;
        gain.gain.setValueAtTime(0.22, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.22);
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
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
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
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.42);
      });
    }
  });

  // ─── 사운드 버튼 ──────────────────────────────────────────────────────────
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
  [
    document.getElementById('soundToggleIntro'),
    document.getElementById('soundToggleGame')
  ].forEach(function (btn) {
    if (!btn) return;
    onTap(btn, function () {
      sounds.toggleMute();
      updateSoundIcons();
    });
  });
  updateSoundIcons();

  // ─── 게임 상태 ────────────────────────────────────────────────────────────
  var roundsLeft;
  var currentRound;
  var score;
  var problems;       // 이번 게임에서 사용할 5개 문제
  var p1Selected;     // 선택된 카드 인덱스 또는 null
  var p2Selected;
  var locked;         // 채점 중 잠금

  // ─── DOM ─────────────────────────────────────────────────────────────────
  var p1Grid       = document.getElementById('p1Cards');
  var p2Grid       = document.getElementById('p2Cards');
  var p1Pick       = document.getElementById('p1Pick');
  var p2Pick       = document.getElementById('p2Pick');
  var targetVal    = document.getElementById('targetVal');
  var roundNumEl   = document.getElementById('roundNum');
  var roundScoreEl = document.getElementById('roundScore');
  var bannerEl     = document.getElementById('banner');
  var boardsEl     = document.querySelector('.boards');
  var resultTitle  = document.getElementById('resultTitle');
  var resultSub    = document.getElementById('resultSub');
  var resultIconWrap = document.getElementById('resultIconWrap');

  // ─── 셔플 ────────────────────────────────────────────────────────────────
  function shuffleArr(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  // ─── 카드 생성 ───────────────────────────────────────────────────────────
  function buildCards(grid, nums, player) {
    grid.innerHTML = '';
    nums.forEach(function (n, idx) {
      var btn = document.createElement('button');
      btn.className = 'num-card';
      btn.type = 'button';
      btn.textContent = n;
      btn.setAttribute('data-idx', idx);
      btn.setAttribute('data-val', n);
      onTap(btn, function () {
        if (locked) return;
        handleCardPick(player, idx, n, grid);
      });
      grid.appendChild(btn);
    });
  }

  // ─── 카드 선택 처리 ──────────────────────────────────────────────────────
  function handleCardPick(player, idx, val, grid) {
    sounds.play('pick');

    // 같은 보드의 다른 카드 선택 해제
    var cards = grid.querySelectorAll('.num-card');
    cards.forEach(function (c) { c.classList.remove('selected'); });
    cards[idx].classList.add('selected');

    if (player === 1) {
      p1Selected = { idx: idx, val: val };
      p1Pick.textContent = val;
    } else {
      p2Selected = { idx: idx, val: val };
      p2Pick.textContent = val;
    }

    if (p1Selected && p2Selected) {
      locked = true;
      boardsEl.classList.add('locked');
      later(checkAnswer, 500);
    }
  }

  // ─── 채점 ────────────────────────────────────────────────────────────────
  function checkAnswer() {
    var problem = problems[currentRound];
    var sum = p1Selected.val + p2Selected.val;
    var ok = sum === problem.target;

    var p1Card = p1Grid.querySelectorAll('.num-card')[p1Selected.idx];
    var p2Card = p2Grid.querySelectorAll('.num-card')[p2Selected.idx];

    if (ok) {
      score++;
      p1Card.classList.add('correct');
      p2Card.classList.add('correct');
      showBanner('성공! ' + p1Selected.val + ' + ' + p2Selected.val + ' = ' + problem.target, 'ok');
      sounds.play('correct');
    } else {
      p1Card.classList.add('wrong');
      p2Card.classList.add('wrong');
      showBanner('아쉬워요! ' + p1Selected.val + ' + ' + p2Selected.val + ' = ' + sum + ' (목표 ' + problem.target + ')', 'ng');
      sounds.play('wrong');
    }

    updateScoreUI();

    later(function () {
      currentRound++;
      if (currentRound >= TOTAL_ROUNDS) {
        showResult();
      } else {
        nextRound();
      }
    }, 1500);
  }

  // ─── 다음 라운드 ─────────────────────────────────────────────────────────
  function nextRound() {
    locked = false;
    boardsEl.classList.remove('locked');
    p1Selected = null;
    p2Selected = null;
    p1Pick.textContent = '?';
    p2Pick.textContent = '?';
    hideBanner();

    var problem = problems[currentRound];
    targetVal.textContent = problem.target;
    buildCards(p1Grid, shuffleArr(problem.p1), 1);
    buildCards(p2Grid, shuffleArr(problem.p2), 2);
    updateRoundUI();
  }

  // ─── UI 업데이트 ─────────────────────────────────────────────────────────
  function updateRoundUI() {
    roundNumEl.textContent = (currentRound + 1) + '/' + TOTAL_ROUNDS;
  }
  function updateScoreUI() {
    roundScoreEl.textContent = '★ ' + score;
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
    score = 0;
    p1Selected = null;
    p2Selected = null;
    locked = false;
    problems = shuffleArr(PROBLEM_POOL).slice(0, TOTAL_ROUNDS);
    updateScoreUI();
    nextRound();
    showScreen('game');
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
      '<text x="40" y="42" text-anchor="middle" font-size="16" font-weight="900" fill="#E65100">WIN</text>' +
    '</svg>';

  var SVG_HAND =
    '<svg viewBox="0 0 80 80" width="80" height="80">' +
      '<circle cx="40" cy="40" r="32" fill="#FFE082" stroke="#2C2C2C" stroke-width="3"/>' +
      '<text x="40" y="52" text-anchor="middle" font-size="32">🤝</text>' +
    '</svg>';

  var SVG_OK =
    '<svg viewBox="0 0 80 80" width="80" height="80">' +
      '<circle cx="40" cy="40" r="32" fill="#C8E6C9" stroke="#2C2C2C" stroke-width="3"/>' +
      '<polyline points="24,42 36,54 58,30" fill="none" stroke="#1B5E20" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>' +
    '</svg>';

  function showResult() {
    var title, sub, icon;
    if (score === TOTAL_ROUNDS) {
      title = score + '/' + TOTAL_ROUNDS;
      sub = '완벽한 협력이에요! 👏';
      icon = SVG_TROPHY;
    } else if (score >= 3) {
      title = score + '/' + TOTAL_ROUNDS;
      sub = '훌륭한 팀워크! 다시 도전해봐요';
      icon = SVG_OK;
    } else {
      title = score + '/' + TOTAL_ROUNDS;
      sub = '조금 더 호흡을 맞춰봐요!';
      icon = SVG_HAND;
    }
    resultTitle.textContent = title;
    resultSub.textContent = sub;
    resultIconWrap.innerHTML = icon;
    sounds.play('win');
    showScreen('result');
  }

  // ─── 버튼 이벤트 ─────────────────────────────────────────────────────────
  onTap(document.getElementById('playBtn'), function () {
    startCountdown(function() { initGame(); });
  });
  onTap(document.getElementById('retryBtn'), function () {
    startCountdown(function() { initGame(); });
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
