/* games/color-mix/game.js */

(function () {
  'use strict';

  // ─── 색 팔레트 ────────────────────────────────────────────────────────────
  var COLORS = {
    red:    { name: '빨강',   hex: '#E53935' },
    yellow: { name: '노랑',   hex: '#FDD835' },
    blue:   { name: '파랑',   hex: '#1E88E5' },
    white:  { name: '흰색',   hex: '#FFFFFF' },
    black:  { name: '검정',   hex: '#212121' },
    green:  { name: '초록',   hex: '#43A047' }
  };

  // ─── 색 혼합 규칙 (순서 무관) ─────────────────────────────────────────────
  var MIX_RESULTS = {
    'red+yellow':   { key: 'orange',     name: '주황',   hex: '#FB8C00' },
    'blue+yellow':  { key: 'lightgreen', name: '연두',   hex: '#7CB342' },
    'blue+red':     { key: 'purple',     name: '보라',   hex: '#8E24AA' },
    'red+white':    { key: 'pink',       name: '분홍',   hex: '#F48FB1' },
    'blue+white':   { key: 'skyblue',    name: '하늘',   hex: '#81D4FA' },
    'black+white':  { key: 'gray',       name: '회색',   hex: '#9E9E9E' },
    'black+red':    { key: 'brown',      name: '갈색',   hex: '#6D4C41' },
    'black+yellow': { key: 'olive',      name: '카키',   hex: '#827717' },
    'green+red':    { key: 'darkbrown',  name: '진갈색', hex: '#4E342E' },
    'green+white':  { key: 'mint',       name: '민트',   hex: '#A5D6A7' },
    'green+yellow': { key: 'lime',       name: '라임',   hex: '#C0CA33' },
    'black+blue':   { key: 'navy',       name: '남색',   hex: '#1A237E' },
    'black+green':  { key: 'darkgreen',  name: '진초록', hex: '#1B5E20' }
  };

  function mixKey(a, b) {
    return [a, b].sort().join('+');
  }
  function getMixResult(a, b) {
    return MIX_RESULTS[mixKey(a, b)] || null;
  }

  // ─── 라운드 문제 풀 ──────────────────────────────────────────────────────
  var PROBLEM_POOL = [
    // 주황 = 빨강 + 노랑
    { p1: ['red', 'blue', 'green', 'white'], p2: ['yellow', 'black', 'white', 'green'], answer: ['red', 'yellow'] },
    { p1: ['white', 'red', 'black', 'green'], p2: ['blue', 'yellow', 'white', 'green'], answer: ['red', 'yellow'] },
    { p1: ['red', 'black', 'green', 'blue'], p2: ['yellow', 'red', 'white', 'blue'], answer: ['red', 'yellow'] },
    // 연두 = 파랑 + 노랑
    { p1: ['blue', 'red', 'white', 'black'], p2: ['yellow', 'red', 'green', 'white'], answer: ['blue', 'yellow'] },
    { p1: ['green', 'blue', 'white', 'red'], p2: ['black', 'yellow', 'red', 'white'], answer: ['blue', 'yellow'] },
    { p1: ['blue', 'green', 'red', 'black'], p2: ['yellow', 'white', 'green', 'black'], answer: ['blue', 'yellow'] },
    // 보라 = 빨강 + 파랑
    { p1: ['red', 'green', 'yellow', 'white'], p2: ['blue', 'yellow', 'green', 'black'], answer: ['red', 'blue'] },
    { p1: ['red', 'white', 'yellow', 'black'], p2: ['blue', 'red', 'green', 'white'], answer: ['red', 'blue'] },
    { p1: ['blue', 'green', 'white', 'yellow'], p2: ['red', 'yellow', 'white', 'green'], answer: ['blue', 'red'] },
    // 분홍 = 빨강 + 흰색
    { p1: ['red', 'black', 'blue', 'green'], p2: ['white', 'yellow', 'green', 'black'], answer: ['red', 'white'] },
    { p1: ['white', 'green', 'yellow', 'black'], p2: ['red', 'blue', 'green', 'yellow'], answer: ['white', 'red'] },
    { p1: ['red', 'yellow', 'green', 'blue'], p2: ['white', 'black', 'green', 'yellow'], answer: ['red', 'white'] },
    // 하늘 = 파랑 + 흰색
    { p1: ['blue', 'red', 'green', 'black'], p2: ['white', 'yellow', 'red', 'green'], answer: ['blue', 'white'] },
    { p1: ['white', 'yellow', 'red', 'green'], p2: ['blue', 'green', 'black', 'yellow'], answer: ['white', 'blue'] },
    { p1: ['blue', 'yellow', 'green', 'red'], p2: ['white', 'red', 'black', 'green'], answer: ['blue', 'white'] },
    // 회색 = 검정 + 흰색
    { p1: ['black', 'red', 'blue', 'yellow'], p2: ['white', 'green', 'red', 'yellow'], answer: ['black', 'white'] },
    { p1: ['white', 'green', 'red', 'blue'], p2: ['black', 'yellow', 'red', 'green'], answer: ['white', 'black'] },
    // 갈색 = 검정 + 빨강
    { p1: ['black', 'green', 'blue', 'white'], p2: ['red', 'white', 'yellow', 'green'], answer: ['black', 'red'] },
    { p1: ['red', 'green', 'blue', 'white'], p2: ['black', 'yellow', 'white', 'green'], answer: ['red', 'black'] },
    { p1: ['black', 'yellow', 'green', 'blue'], p2: ['red', 'white', 'green', 'yellow'], answer: ['black', 'red'] },
    // 카키 = 검정 + 노랑
    { p1: ['black', 'red', 'green', 'blue'], p2: ['yellow', 'red', 'white', 'green'], answer: ['black', 'yellow'] },
    { p1: ['yellow', 'green', 'red', 'white'], p2: ['black', 'blue', 'red', 'green'], answer: ['yellow', 'black'] },
    // 민트 = 초록 + 흰색
    { p1: ['green', 'red', 'blue', 'yellow'], p2: ['white', 'black', 'red', 'yellow'], answer: ['green', 'white'] },
    { p1: ['white', 'yellow', 'red', 'blue'], p2: ['green', 'black', 'yellow', 'red'], answer: ['white', 'green'] },
    // 라임 = 초록 + 노랑
    { p1: ['green', 'red', 'blue', 'white'], p2: ['yellow', 'red', 'white', 'black'], answer: ['green', 'yellow'] },
    { p1: ['yellow', 'red', 'blue', 'black'], p2: ['green', 'white', 'blue', 'red'], answer: ['yellow', 'green'] },
    // 남색 = 검정 + 파랑
    { p1: ['black', 'red', 'green', 'yellow'], p2: ['blue', 'white', 'red', 'yellow'], answer: ['black', 'blue'] },
    { p1: ['blue', 'green', 'yellow', 'red'], p2: ['black', 'white', 'red', 'green'], answer: ['blue', 'black'] },
    // 진초록 = 검정 + 초록
    { p1: ['black', 'red', 'yellow', 'white'], p2: ['green', 'blue', 'red', 'yellow'], answer: ['black', 'green'] },
    { p1: ['green', 'yellow', 'blue', 'red'], p2: ['black', 'white', 'red', 'yellow'], answer: ['green', 'black'] },
    // 진갈색 = 초록 + 빨강
    { p1: ['green', 'blue', 'yellow', 'white'], p2: ['red', 'black', 'white', 'yellow'], answer: ['green', 'red'] },
    { p1: ['red', 'blue', 'yellow', 'white'], p2: ['green', 'black', 'white', 'yellow'], answer: ['red', 'green'] }
  ];

  PROBLEM_POOL.forEach(function (p) {
    p.target = getMixResult(p.answer[0], p.answer[1]);
  });

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
  var currentRound;
  var score;
  var problems;
  var p1Selected;
  var p2Selected;
  var locked;

  // ─── DOM ─────────────────────────────────────────────────────────────────
  var p1Grid       = document.getElementById('p1Cards');
  var p2Grid       = document.getElementById('p2Cards');
  var p1PickEl     = document.getElementById('p1Pick');
  var p2PickEl     = document.getElementById('p2Pick');
  var targetSwatch = document.getElementById('targetSwatch');
  var targetName   = document.getElementById('targetName');
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

  // ─── 색 카드 생성 ────────────────────────────────────────────────────────
  function buildCards(grid, colorKeys, player) {
    grid.innerHTML = '';
    colorKeys.forEach(function (key, idx) {
      var c = COLORS[key];
      var btn = document.createElement('button');
      btn.className = 'num-card color-card';
      btn.type = 'button';
      btn.setAttribute('data-idx', idx);
      btn.setAttribute('data-color', key);

      var swatch = document.createElement('span');
      swatch.className = 'card-swatch';
      swatch.style.background = c.hex;
      if (key === 'white') {
        swatch.style.borderColor = '#2C2C2C';
      }
      btn.appendChild(swatch);

      var name = document.createElement('span');
      name.className = 'card-name';
      name.textContent = c.name;
      btn.appendChild(name);

      onTap(btn, function () {
        if (locked) return;
        handleCardPick(player, idx, key, grid);
      });
      grid.appendChild(btn);
    });
  }

  // ─── 카드 선택 처리 ──────────────────────────────────────────────────────
  function handleCardPick(player, idx, colorKey, grid) {
    sounds.play('pick');

    var cards = grid.querySelectorAll('.num-card');
    cards.forEach(function (c) { c.classList.remove('selected'); });
    cards[idx].classList.add('selected');

    if (player === 1) {
      p1Selected = { idx: idx, color: colorKey };
      p1PickEl.style.background = COLORS[colorKey].hex;
    } else {
      p2Selected = { idx: idx, color: colorKey };
      p2PickEl.style.background = COLORS[colorKey].hex;
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
    var mixed = getMixResult(p1Selected.color, p2Selected.color);
    var ok = mixed && mixed.key === problem.target.key;

    var p1Card = p1Grid.querySelectorAll('.num-card')[p1Selected.idx];
    var p2Card = p2Grid.querySelectorAll('.num-card')[p2Selected.idx];

    if (ok) {
      score++;
      p1Card.classList.add('correct');
      p2Card.classList.add('correct');
      showBanner('성공! ' + COLORS[p1Selected.color].name + ' + ' + COLORS[p2Selected.color].name + ' = ' + problem.target.name, 'ok');
      sounds.play('correct');
    } else {
      p1Card.classList.add('wrong');
      p2Card.classList.add('wrong');
      var mixedName = mixed ? mixed.name : '?';
      showBanner('아쉬워요! ' + COLORS[p1Selected.color].name + ' + ' + COLORS[p2Selected.color].name + ' → ' + mixedName + ' (목표: ' + problem.target.name + ')', 'ng');
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
    }, 1700);
  }

  // ─── 다음 라운드 ─────────────────────────────────────────────────────────
  function nextRound() {
    locked = false;
    boardsEl.classList.remove('locked');
    p1Selected = null;
    p2Selected = null;
    p1PickEl.style.background = '#FFFFFF';
    p2PickEl.style.background = '#FFFFFF';
    hideBanner();

    var problem = problems[currentRound];
    targetSwatch.style.background = problem.target.hex;
    targetName.textContent = problem.target.name;
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
