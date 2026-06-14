/* games/telepathy/game.js */

(function () {
  'use strict';

  // ─── 주제 풀 (24개) — 라운드마다 7개 무작위 선택 ─────────────────────────
  // 각 항목: q (질문), choices (이모지 + 이름 4개)
  var TOPIC_POOL = [
    { q: '🍎 과일 하면 떠오르는 것은?', choices: [
      { e: '🍎', n: '사과' }, { e: '🍌', n: '바나나' }, { e: '🍇', n: '포도' }, { e: '🍉', n: '수박' }
    ] },
    { q: '🐾 동물 하면 떠오르는 것은?', choices: [
      { e: '🐶', n: '강아지' }, { e: '🐱', n: '고양이' }, { e: '🐰', n: '토끼' }, { e: '🦁', n: '사자' }
    ] },
    { q: '🎨 좋아하는 색깔은?', choices: [
      { e: '❤️', n: '빨강' }, { e: '💙', n: '파랑' }, { e: '💛', n: '노랑' }, { e: '💚', n: '초록' }
    ] },
    { q: '📅 좋아하는 계절은?', choices: [
      { e: '🌸', n: '봄' }, { e: '☀️', n: '여름' }, { e: '🍂', n: '가을' }, { e: '⛄', n: '겨울' }
    ] },
    { q: '🍽️ 최고의 급식 메뉴는?', choices: [
      { e: '🍗', n: '치킨' }, { e: '🍕', n: '피자' }, { e: '🍜', n: '라면' }, { e: '🍛', n: '카레' }
    ] },
    { q: '🏃 하고 싶은 운동은?', choices: [
      { e: '⚽', n: '축구' }, { e: '🏀', n: '농구' }, { e: '⚾', n: '야구' }, { e: '🏸', n: '배드민턴' }
    ] },
    { q: '📖 동화 주인공 하면?', choices: [
      { e: '🧜‍♀️', n: '인어공주' }, { e: '🤥', n: '피노키오' }, { e: '👧', n: '빨간모자' }, { e: '🐷', n: '아기돼지' }
    ] },
    { q: '🍦 아이스크림 맛을 고른다면?', choices: [
      { e: '🍫', n: '초코' }, { e: '🍓', n: '딸기' }, { e: '🍦', n: '바닐라' }, { e: '🍈', n: '멜론' }
    ] },
    { q: '🦸 갖고 싶은 슈퍼 파워는?', choices: [
      { e: '🦅', n: '하늘날기' }, { e: '👻', n: '투명인간' }, { e: '⚡', n: '순간이동' }, { e: '💪', n: '괴력' }
    ] },
    { q: '🧳 여행 가고 싶은 곳은?', choices: [
      { e: '🏖️', n: '바다' }, { e: '⛰️', n: '산' }, { e: '🎢', n: '놀이공원' }, { e: '🏰', n: '궁전' }
    ] },
    { q: '🍪 간식 하면 떠오르는 것은?', choices: [
      { e: '🍪', n: '쿠키' }, { e: '🍩', n: '도넛' }, { e: '🍬', n: '사탕' }, { e: '🍟', n: '감자튀김' }
    ] },
    { q: '🚗 타고 싶은 탈것은?', choices: [
      { e: '🚗', n: '자동차' }, { e: '✈️', n: '비행기' }, { e: '🚂', n: '기차' }, { e: '🚢', n: '배' }
    ] },
    { q: '🎵 배우고 싶은 악기는?', choices: [
      { e: '🎹', n: '피아노' }, { e: '🎸', n: '기타' }, { e: '🥁', n: '드럼' }, { e: '🎻', n: '바이올린' }
    ] },
    { q: '🐛 곤충 하면 떠오르는 것은?', choices: [
      { e: '🦋', n: '나비' }, { e: '🐝', n: '꿀벌' }, { e: '🐞', n: '무당벌레' }, { e: '🦗', n: '메뚜기' }
    ] },
    { q: '🌊 바다 하면 떠오르는 것은?', choices: [
      { e: '🐬', n: '돌고래' }, { e: '🐙', n: '문어' }, { e: '🦈', n: '상어' }, { e: '🐠', n: '물고기' }
    ] },
    { q: '🌌 우주 하면 떠오르는 것은?', choices: [
      { e: '🌙', n: '달' }, { e: '⭐', n: '별' }, { e: '🪐', n: '토성' }, { e: '🚀', n: '로켓' }
    ] },
    { q: '🌦️ 좋아하는 날씨는?', choices: [
      { e: '☀️', n: '맑음' }, { e: '🌧️', n: '비' }, { e: '❄️', n: '눈' }, { e: '🌈', n: '무지개' }
    ] },
    { q: '🥗 채소 하면 떠오르는 것은?', choices: [
      { e: '🥕', n: '당근' }, { e: '🥒', n: '오이' }, { e: '🍅', n: '토마토' }, { e: '🌽', n: '옥수수' }
    ] },
    { q: '🥤 마시고 싶은 음료는?', choices: [
      { e: '🥛', n: '우유' }, { e: '🧃', n: '주스' }, { e: '🥤', n: '콜라' }, { e: '💧', n: '물' }
    ] },
    { q: '💼 되고 싶은 직업은?', choices: [
      { e: '👨‍🚀', n: '우주비행사' }, { e: '👨‍🍳', n: '요리사' }, { e: '👩‍⚕️', n: '의사' }, { e: '👮', n: '경찰' }
    ] },
    { q: '🎲 쉬는 시간에 하고 싶은 것은?', choices: [
      { e: '🎲', n: '보드게임' }, { e: '🧩', n: '퍼즐' }, { e: '🎮', n: '게임' }, { e: '⚽', n: '공놀이' }
    ] },
    { q: '🎁 생일 선물로 받고 싶은 것은?', choices: [
      { e: '🧸', n: '인형' }, { e: '📱', n: '스마트폰' }, { e: '🚲', n: '자전거' }, { e: '🎮', n: '게임기' }
    ] },
    { q: '🍞 빵집에서 하나만 고른다면?', choices: [
      { e: '🥐', n: '크루아상' }, { e: '🍞', n: '식빵' }, { e: '🍰', n: '케이크' }, { e: '🍩', n: '도넛' }
    ] },
    { q: '🦁 동물원에서 제일 먼저 볼 동물은?', choices: [
      { e: '🐘', n: '코끼리' }, { e: '🦒', n: '기린' }, { e: '🐼', n: '판다' }, { e: '🐧', n: '펭귄' }
    ] }
  ];

  var TOTAL_ROUNDS = 7;
  var SUCCESS_MATCHES = 4;

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
    flip: function (ctx) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(620, ctx.currentTime + 0.16);
      gain.gain.setValueAtTime(0.14, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.22);
    },
    match: function (ctx) {
      // 반짝이는 차임 (텔레파시 성공)
      [784, 988, 1175, 1568].forEach(function (freq, i) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        var t = ctx.currentTime + i * 0.09;
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.5);
      });
    },
    miss: function (ctx) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(392, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(262, ctx.currentTime + 0.32);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.36);
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
  var currentRound;   // 0부터
  var matches;        // 일치 횟수
  var topics;         // 이번 게임 7개 주제
  var phase;          // 'idle' | 'p1' | 'p2' | 'reveal'
  var locked;         // 입력 잠금
  var p1Choice;       // { idx, e, n }
  var p2Choice;

  // ─── DOM ─────────────────────────────────────────────────────────────────
  var topicText     = document.getElementById('topicText');
  var choiceGrid    = document.getElementById('choiceGrid');
  var telepathyRow  = document.getElementById('telepathyRow');
  var p1PickCard    = document.getElementById('p1PickCard');
  var p2PickCard    = document.getElementById('p2PickCard');
  var p1RevealEmoji = document.getElementById('p1RevealEmoji');
  var p1RevealName  = document.getElementById('p1RevealName');
  var p2RevealEmoji = document.getElementById('p2RevealEmoji');
  var p2RevealName  = document.getElementById('p2RevealName');
  var roundNumEl    = document.getElementById('roundNum');
  var roundScoreEl  = document.getElementById('roundScore');
  var bannerEl      = document.getElementById('banner');
  var resultTitle   = document.getElementById('resultTitle');
  var resultSub     = document.getElementById('resultSub');
  var resultIconWrap = document.getElementById('resultIconWrap');
  var turnOverlay   = document.getElementById('turnOverlay');
  var overlayEmoji  = document.getElementById('overlayEmoji');
  var overlayTitle  = document.getElementById('overlayTitle');
  var overlaySub    = document.getElementById('overlaySub');
  var overlayBtn    = document.getElementById('overlayBtn');

  // ─── 차례 안내 오버레이 ──────────────────────────────────────────────────
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
    sounds.play('pick');
    if (cb) cb();
  });

  // ─── 셔플 ────────────────────────────────────────────────────────────────
  function shuffleArr(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  // ─── 선택 카드 생성 (하단, 크게) ─────────────────────────────────────────
  function buildChoices(topic) {
    choiceGrid.innerHTML = '';
    topic.choices.forEach(function (ch, idx) {
      var btn = document.createElement('button');
      btn.className = 'choice-card';
      btn.type = 'button';
      btn.innerHTML =
        '<div class="cc-inner">' +
          '<div class="cc-face cc-front">' +
            '<span class="cc-emoji"></span>' +
            '<span class="cc-name"></span>' +
          '</div>' +
          '<div class="cc-face cc-back">💭</div>' +
        '</div>';
      btn.querySelector('.cc-emoji').textContent = ch.e;
      btn.querySelector('.cc-name').textContent = ch.n;
      onTap(btn, function () {
        handleChoice(idx);
      });
      choiceGrid.appendChild(btn);
    });
  }

  function setFacedown(down) {
    choiceGrid.classList.toggle('facedown', down);
  }

  function clearPickedHighlight() {
    var cards = choiceGrid.querySelectorAll('.choice-card');
    cards.forEach(function (c) { c.classList.remove('picked'); });
  }

  // ─── 카드 선택 처리 ──────────────────────────────────────────────────────
  function handleChoice(idx) {
    if (locked) return;
    if (phase !== 'p1' && phase !== 'p2') return;

    var topic = topics[currentRound];
    var ch = topic.choices[idx];
    locked = true;
    sounds.play('pick');

    var card = choiceGrid.querySelectorAll('.choice-card')[idx];
    card.classList.add('picked');

    if (phase === 'p1') {
      p1Choice = { idx: idx, e: ch.e, n: ch.n };
      // 선택 숨김: 카드를 모두 뒷면으로 뒤집기 (P2가 못 보게!)
      later(function () {
        clearPickedHighlight();
        setFacedown(true);
        sounds.play('flip');
      }, 300);
      later(function () {
        showOverlay('👀', 'P2 차례!', 'P1 선택 완료! 이제 P2가 같은 질문에 답해요', 'P2 시작!', function () {
          setFacedown(false);
          sounds.play('flip');
          phase = 'p2';
          locked = false;
        });
      }, 950);
    } else {
      p2Choice = { idx: idx, e: ch.e, n: ch.n };
      later(function () {
        clearPickedHighlight();
        setFacedown(true);
        sounds.play('flip');
      }, 300);
      later(reveal, 950);
    }
  }

  // ─── 공개 연출: 두 카드 동시에 뒤집기 ────────────────────────────────────
  function reveal() {
    phase = 'reveal';

    p1RevealEmoji.textContent = p1Choice.e;
    p1RevealName.textContent  = p1Choice.n;
    p2RevealEmoji.textContent = p2Choice.e;
    p2RevealName.textContent  = p2Choice.n;

    sounds.play('flip');
    p1PickCard.classList.add('revealed');
    p2PickCard.classList.add('revealed');

    later(function () {
      var isMatch = p1Choice.idx === p2Choice.idx;
      if (isMatch) {
        matches++;
        updateScoreUI();
        telepathyRow.classList.add('match');
        showBanner('통했다! 💫 둘 다 "' + p1Choice.n + '"!', 'ok');
        sounds.play('match');
      } else {
        showBanner('아쉽다~ P1: ' + p1Choice.e + p1Choice.n + ' · P2: ' + p2Choice.e + p2Choice.n, 'ng');
        sounds.play('miss');
      }

      later(function () {
        currentRound++;
        if (currentRound >= TOTAL_ROUNDS) {
          showResult();
        } else {
          nextRound();
        }
      }, getAutoplayPauseMs(2100));
    }, 750);
  }

  // ─── 다음 라운드 ─────────────────────────────────────────────────────────
  function nextRound() {
    phase = 'idle';
    locked = false;
    p1Choice = null;
    p2Choice = null;
    hideBanner();
    telepathyRow.classList.remove('match');
    p1PickCard.classList.remove('revealed');
    p2PickCard.classList.remove('revealed');

    var topic = topics[currentRound];
    topicText.textContent = topic.q;
    buildChoices(topic);
    setFacedown(false);
    updateRoundUI();

    showOverlay('🙈', 'P1 차례!', 'P2는 눈을 감아요! P1이 몰래 골라요', 'P1 시작!', function () {
      phase = 'p1';
    });
  }

  // ─── UI 업데이트 ─────────────────────────────────────────────────────────
  function updateRoundUI() {
    roundNumEl.textContent = (currentRound + 1) + '/' + TOTAL_ROUNDS;
  }
  function updateScoreUI() {
    roundScoreEl.textContent = '💫 ' + matches;
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
    matches = 0;
    topics = shuffleArr(TOPIC_POOL).slice(0, TOTAL_ROUNDS);
    updateScoreUI();
    nextRound();
    showScreen('game');
  }

  // ─── 결과 화면 ───────────────────────────────────────────────────────────
  function emojiIcon(emoji, bg) {
    return '<svg viewBox="0 0 80 80" width="80" height="80">' +
      '<circle cx="40" cy="40" r="32" fill="' + bg + '" stroke="#2C2C2C" stroke-width="3"/>' +
      '<text x="40" y="52" text-anchor="middle" font-size="32">' + emoji + '</text>' +
    '</svg>';
  }

  function showResult() {
    var sub, icon;
    if (matches === 7) {
      sub = '👑 운명의 콤비! 완벽하게 통했어요!';
      icon = emojiIcon('👑', '#FFD54F');
    } else if (matches === 6) {
      sub = '💎 환상의 콤비! 거의 한마음이에요!';
      icon = emojiIcon('💎', '#B3E5FC');
    } else if (matches >= SUCCESS_MATCHES) {
      sub = '💫 찰떡 콤비! 텔레파시 성공!';
      icon = emojiIcon('💫', '#E1BEE7');
    } else if (matches >= 2) {
      sub = '🤝 조금씩 통하고 있어요! 다시 도전!';
      icon = emojiIcon('🤝', '#FFE082');
    } else {
      sub = '🙈 다음엔 꼭 통할 거예요! 다시 도전!';
      icon = emojiIcon('🙈', '#FFCDD2');
    }
    resultTitle.textContent = matches + '/' + TOTAL_ROUNDS + ' 일치';
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
    hideOverlay();
    showScreen('intro');
  });

})();
