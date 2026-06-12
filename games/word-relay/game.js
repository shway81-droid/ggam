/* games/word-relay/game.js */

(function () {
  'use strict';

  // ── 단어 라이브러리 (25개+, 음절+힌트이모지+난이도) ──────────
  // tier 1: 3글자, tier 2: 4글자, tier 3: 5글자+미끼
  var WORD_POOL = [
    { w: ['무', '지', '개'], hint: '🌈', tier: 1 },
    { w: ['사', '과'], hint: '🍎', tier: 1 },
    { w: ['고', '양', '이'], hint: '🐱', tier: 1 },
    { w: ['나', '비'], hint: '🦋', tier: 1 },
    { w: ['수', '박'], hint: '🍉', tier: 1 },
    { w: ['토', '끼'], hint: '🐰', tier: 1 },
    { w: ['바', '나', '나'], hint: '🍌', tier: 1 },
    { w: ['강', '아', '지'], hint: '🐶', tier: 1 },
    { w: ['기', '린'], hint: '🦒', tier: 1 },
    { w: ['코', '끼', '리'], hint: '🐘', tier: 1 },
    { w: ['딸', '기'], hint: '🍓', tier: 1 },
    { w: ['오', '리'], hint: '🦆', tier: 1 },
    { w: ['피', '아', '노'], hint: '🎹', tier: 2 },
    { w: ['비', '행', '기'], hint: '✈️', tier: 2 },
    { w: ['축', '구', '공'], hint: '⚽', tier: 2 },
    { w: ['햄', '버', '거'], hint: '🍔', tier: 2 },
    { w: ['아', '이', '스'], hint: '🍦', tier: 2 },
    { w: ['도', '서', '관'], hint: '📚', tier: 2 },
    { w: ['헬', '리', '콥', '터'], hint: '🚁', tier: 2 },
    { w: ['초', '콜', '릿'], hint: '🍫', tier: 2 },
    { w: ['수', '영', '장'], hint: '🏊', tier: 2 },
    { w: ['태', '권', '도'], hint: '🥋', tier: 2 },
    { w: ['파', '인', '애', '플'], hint: '🍍', tier: 3 },
    { w: ['무', '당', '벌', '레'], hint: '🐞', tier: 3 },
    { w: ['해', '바', '라', '기'], hint: '🌻', tier: 3 },
    { w: ['수', '학', '여', '행'], hint: '🎒', tier: 3 },
    { w: ['청', '소', '기'], hint: '🧹', tier: 2 },
    { w: ['세', '탁', '기'], hint: '🫧', tier: 2 },
  ];

  // 미끼 음절 (tier 3에서 추가)
  var DECOY_POOL = ['짬', '쫑', '떡', '냠', '핑', '뚱', '꽈', '삐', '깡', '홀', '릉', '멍'];

  // ── 상수 ─────────────────────────────────────────────────────
  var GAME_TIME       = 90;   // 전체 90초
  var RESULT_PAUSE_MS = getAutoplayPauseMs(2000);
  var PENALTY_MS      = 1000; // 1초 잠금

  // 라운드(단어) 점증 계획
  var ROUND_TIERS = [1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3]; // 최대 15 단어

  // ── 상태 ─────────────────────────────────────────────────────
  var wordIdx      = 0;     // 현재 단어 인덱스 (라이브러리 순서)
  var currentWord  = null;  // { w, hint, tier, decoys }
  var nextSylIdx   = 0;     // 완성해야 할 다음 음절 인덱스
  var wordsCompleted = 0;   // 완성된 단어 수
  var completedWords = [];  // [{ word, emoji }]
  var phase        = 'idle';
  var timerHandle  = null;
  var countdownInterval = null;
  var timeRemaining = GAME_TIME;
  var usedWordIndices = [];

  // P1·P2 음절 분배
  var p1Syls = [];  // 음절 문자열 배열
  var p2Syls = [];

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
  var wordScoreBadge  = document.getElementById('wordScoreBadge');
  var wordDisplay     = document.getElementById('wordDisplay');
  var hintEmoji       = document.getElementById('hintEmoji');
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
      osc.frequency.setValueAtTime(660, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.07);
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
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.22);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.26);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.28);
    },
    wordDone: function (ctx) {
      [523, 659, 784, 1047].forEach(function (freq, i) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        var t = ctx.currentTime + i * 0.07;
        gain.gain.setValueAtTime(0.22, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.35);
      });
    },
    tick: function (ctx) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
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

  // ── 단어 선택 ────────────────────────────────────────────────
  function pickWord(tier) {
    var candidates = WORD_POOL
      .map(function (w, i) { return { w: w, i: i }; })
      .filter(function (x) { return x.w.tier === tier && usedWordIndices.indexOf(x.i) === -1; });

    if (candidates.length === 0) {
      // 같은 tier 재사용
      candidates = WORD_POOL
        .map(function (w, i) { return { w: w, i: i }; })
        .filter(function (x) { return x.w.tier === tier; });
    }
    var pick = candidates[Math.floor(Math.random() * candidates.length)];
    usedWordIndices.push(pick.i);
    return pick.w;
  }

  // ── 음절 분배 ────────────────────────────────────────────────
  function distributeWord(word, tier) {
    var syls = word.w.slice(); // 음절 배열
    var n = syls.length;
    var p1 = [];
    var p2 = [];

    // 음절을 섞어서 각 플레이어에게 배분 (최소 1개씩)
    var shuffledIdx = shuffle(syls.map(function (_, i) { return i; }));
    shuffledIdx.forEach(function (idx, pos) {
      if (pos % 2 === 0) p1.push(idx);
      else p2.push(idx);
    });

    // 최소 1개씩 보장
    if (p1.length === 0) { p1.push(p2.pop()); }
    if (p2.length === 0) { p2.push(p1.pop()); }

    // tier 3: 미끼 음절 추가
    var decoys = [];
    if (tier === 3) {
      var picked = shuffle(DECOY_POOL).slice(0, 2);
      picked.forEach(function (d) {
        if (Math.random() < 0.5) p1.push('DECOY:' + d);
        else p2.push('DECOY:' + d);
        decoys.push(d);
      });
    }

    return {
      p1Indices: p1,   // 각 요소는 실제 음절 인덱스 또는 'DECOY:X'
      p2Indices: p2,
      syls: syls,      // 실제 음절 순서 배열
      decoys: decoys,
    };
  }

  // ── 음절 슬롯 렌더링 ─────────────────────────────────────────
  function renderWordDisplay(word, filledCount) {
    wordDisplay.innerHTML = '';
    var syls = word.w;
    syls.forEach(function (syl, i) {
      var slot = document.createElement('div');
      slot.className = 'syllable-slot';
      if (i < filledCount) {
        slot.className += ' filled';
        slot.textContent = syl;
      } else if (i === filledCount) {
        slot.className += ' current';
        slot.textContent = syl;
      } else {
        slot.textContent = '_';
      }
      wordDisplay.appendChild(slot);
    });
    hintEmoji.textContent = word.hint;
    questionCounter.textContent = '단어 ' + (wordsCompleted + 1);
    wordScoreBadge.textContent = '✓ ' + wordsCompleted;
  }

  // ── 존 빌드 ──────────────────────────────────────────────────
  function buildZones(dist) {
    zonesWrap.innerHTML = '';
    zonesWrap.className = 'zones-wrap p2';

    var players = [
      { label: 'P1', cls: 'p1', indices: dist.p1Indices },
      { label: 'P2', cls: 'p2', indices: dist.p2Indices },
    ];

    players.forEach(function (pl, pi) {
      var zone = document.createElement('div');
      zone.className = 'zone ' + pl.cls;
      zone.dataset.player = String(pi);
      zone.id = 'zone-' + pi;

      var header = document.createElement('div');
      header.className = 'zone-header';
      header.innerHTML = '<span class="zone-label">' + pl.label + ' 존</span>';

      var grid = document.createElement('div');
      grid.className = 'syl-grid';
      grid.id = 'syl-grid-' + pi;

      pl.indices.forEach(function (item) {
        var isDecoy = typeof item === 'string' && item.indexOf('DECOY:') === 0;
        var sylChar = isDecoy ? item.slice(6) : dist.syls[item];
        var actualIdx = isDecoy ? -1 : item;

        var card = document.createElement('div');
        card.className = 'syl-card' + (isDecoy ? ' decoy' : '');
        card.textContent = sylChar;
        card.dataset.sylIdx = String(actualIdx);
        card.dataset.player = String(pi);
        card.dataset.isDecoy = isDecoy ? '1' : '0';

        (function (capturedCard, capturedIdx, capturedIsDecoy, capturedPi) {
          onTap(capturedCard, function () {
            handleSylTap(capturedCard, capturedIdx, capturedIsDecoy, capturedPi);
          });
        })(card, actualIdx, isDecoy, pi);

        grid.appendChild(card);
      });

      zone.appendChild(header);
      zone.appendChild(grid);
      zonesWrap.appendChild(zone);
    });
  }

  // ── 음절 탭 처리 ─────────────────────────────────────────────
  function handleSylTap(card, sylIdx, isDecoy, playerIdx) {
    if (phase !== 'active') return;
    if (card.classList.contains('used') || card.classList.contains('locked')) return;

    var syls = currentWord.w;
    var expected = nextSylIdx; // 다음에 채워야 할 인덱스

    // 미끼 또는 순서가 아닌 글자 → 페널티
    var isCorrect = (!isDecoy) && (sylIdx === expected);

    if (isCorrect) {
      // 정답 음절
      sounds.play('tap');
      card.classList.add('used');
      nextSylIdx++;
      renderWordDisplay(currentWord, nextSylIdx);

      if (nextSylIdx >= syls.length) {
        // 단어 완성!
        onWordComplete();
      }
    } else {
      // 오답 페널티: 해당 카드 1초 잠금
      sounds.play('wrong');
      card.classList.add('locked');

      var zone = document.getElementById('zone-' + playerIdx);
      var flash = document.createElement('div');
      flash.className = 'penalty-flash';
      flash.textContent = '아직 아니에요!';
      zone.appendChild(flash);
      flash.addEventListener('animationend', function () { flash.remove(); }, { once: true });

      setTimeout(function () {
        card.classList.remove('locked');
      }, PENALTY_MS);
    }
  }

  // ── 단어 완성 ────────────────────────────────────────────────
  function onWordComplete() {
    phase = 'transition';
    sounds.play('wordDone');
    wordsCompleted++;
    wordScoreBadge.textContent = '✓ ' + wordsCompleted;

    completedWords.push({ word: currentWord.w.join(''), hint: currentWord.hint });

    // 양 존 플래시
    zonesWrap.querySelectorAll('.zone').forEach(function (z) {
      z.classList.add('word-complete');
      z.addEventListener('animationend', function () {
        z.classList.remove('word-complete');
      }, { once: true });
    });

    // 다음 단어 준비 (짧은 딜레이)
    var delay = RESULT_PAUSE_MS;
    setTimeout(function () {
      if (phase === 'transition') {
        loadNextWord();
      }
    }, delay);
  }

  // ── 다음 단어 로드 ───────────────────────────────────────────
  function loadNextWord() {
    var tierIdx = wordsCompleted;
    if (tierIdx >= ROUND_TIERS.length) tierIdx = ROUND_TIERS.length - 1;
    var tier = ROUND_TIERS[tierIdx];

    currentWord = pickWord(tier);
    nextSylIdx  = 0;
    phase       = 'active';

    var dist = distributeWord(currentWord, tier);
    p1Syls = dist.p1Indices;
    p2Syls = dist.p2Indices;

    renderWordDisplay(currentWord, 0);
    buildZones(dist);
  }

  // ── 게임 타이머 ──────────────────────────────────────────────
  function startGameTimer() {
    timeRemaining = GAME_TIME;
    problemTimer.textContent = timeRemaining;
    problemTimer.classList.remove('urgent');

    timerHandle = setInterval(function () {
      timeRemaining--;
      problemTimer.textContent = timeRemaining;

      if (timeRemaining <= 10) {
        problemTimer.classList.add('urgent');
        sounds.play('tick');
      }
      if (timeRemaining <= 0) {
        clearTimers();
        showFinalResult();
      }
    }, 1000);
  }

  // ── 게임 시작 ────────────────────────────────────────────────
  function startGame() {
    wordsCompleted   = 0;
    completedWords   = [];
    usedWordIndices  = [];
    phase            = 'idle';

    clearTimers();
    showScreen('game');
    buildScoreBar();
    loadNextWord();
    startGameTimer();
  }

  // ── 점수 바 ─────────────────────────────────────────────────
  function buildScoreBar() {
    scoreBar.innerHTML = '';
    var chip = document.createElement('div');
    chip.className = 'score-chip';
    chip.innerHTML = '<span>팀 점수: 완성한 단어 수 = 점수</span>';
    scoreBar.appendChild(chip);
  }

  // ── 결과 화면 ────────────────────────────────────────────────
  function showFinalResult() {
    clearTimers();
    phase = 'idle';
    sounds.play('fanfare');

    resultTitle.textContent = '글자 릴레이 종료!';
    resultWinner.textContent = '팀 점수: ' + wordsCompleted + '단어 완성! 🧩';

    // 테이블 헤더
    var headRow = document.createElement('tr');
    headRow.innerHTML = '<th>순서</th><th>단어</th><th>힌트</th>';
    resultTableHead.innerHTML = '';
    resultTableHead.appendChild(headRow);

    // 테이블 바디
    resultTableBody.innerHTML = '';
    if (completedWords.length === 0) {
      var tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="3" style="color:#999">완성한 단어 없음</td>';
      resultTableBody.appendChild(tr);
    } else {
      completedWords.forEach(function (cw, i) {
        var tr = document.createElement('tr');
        tr.innerHTML =
          '<td>' + (i + 1) + '</td>' +
          '<td class="cell-win">' + cw.word + '</td>' +
          '<td>' + cw.hint + '</td>';
        resultTableBody.appendChild(tr);
      });
    }

    // 총 성적
    totalRow.innerHTML = '';
    var chip = document.createElement('div');
    chip.className = 'total-chip';
    chip.innerHTML =
      '<span>완성:</span>' +
      '<span class="chip-score" style="color:' + (wordsCompleted >= 5 ? '#2E7D32' : '#555') + '">' +
        wordsCompleted + ' 단어</span>' +
      (wordsCompleted >= 8 ? '<span style="font-size:1.1rem;">🏆</span>' : '');
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
