/* games/memory-match/game.js */

(function () {
  'use strict';

  // ── Player color palette ─────────────────────────────────────────────────
  var PLAYER_COLORS = ['#AB47BC', '#29B6F6', '#EF5350', '#66BB6A'];
  var PLAYER_NAMES  = ['플레이어 1', '플레이어 2', '플레이어 3', '플레이어 4'];

  // ── Emoji pool — 8 random picked each game ───────────────────────────────
  var EMOJI_POOL = ['🐶','🐱','🐸','🦊','🐼','🐨','🦁','🐯','🐷','🐮','🐵','🐔','🦄','🐙','🦋','🐝'];

  // ── Screen refs ──────────────────────────────────────────────────────────
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

  var countdownInterval = null;
  function startCountdown(onDone) {
    var countdownNumber = document.getElementById('countdownNumber');
    showScreen('countdown');
    countdownInterval = runCountdown(countdownNumber, onDone);
  }

  // ── Sound ────────────────────────────────────────────────────────────────
  var sounds = createSoundManager({
    // Card flip: soft click
    flip: function (ctx) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(480, ctx.currentTime + 0.07);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    },
    // Match: two rising tones
    match: function (ctx) {
      [660, 880].forEach(function (freq, i) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        var t = ctx.currentTime + i * 0.12;
        gain.gain.setValueAtTime(0.22, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.28);
      });
    },
    // No-match: descending dull thud
    nomatch: function (ctx) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(340, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    },
    // Win fanfare: ascending arpeggio
    win: function (ctx) {
      var notes = [523, 659, 784, 1047, 1319];
      notes.forEach(function (freq, i) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        var t = ctx.currentTime + i * 0.12;
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.38);
      });
    }
  });

  // Sound toggle buttons
  var soundBtns = [
    document.getElementById('soundToggleIntro'),
    document.getElementById('soundToggleGame')
  ];

  function updateSoundBtns() {
    var icon = sounds.isMuted() ? '🔇' : '🔊';
    soundBtns.forEach(function (b) { b.textContent = icon; });
  }

  soundBtns.forEach(function (b) {
    b.addEventListener('click', function () {
      sounds.toggleMute();
      updateSoundBtns();
    });
  });

  updateSoundBtns();

  // ── Intro: player count selection ────────────────────────────────────────
  var playerCount = 2;
  var playerBtns  = document.querySelectorAll('.player-btn');

  playerBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      playerCount = parseInt(btn.getAttribute('data-count'), 10);
      playerBtns.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
    });
  });

  // ── Game state ───────────────────────────────────────────────────────────
  var cards        = [];   // array of { emoji, index, el, frontEl, matched }
  var flippedCards = [];   // at most 2 cards currently face-up & unmatched
  var locked       = false; // blocks taps during flip-back animation
  var currentPlayer = 0;
  var scores        = [];   // scores[playerIndex] = number of pairs

  // DOM
  var cardGridEl   = document.getElementById('cardGrid');
  var scoreboardEl = document.getElementById('scoreboard');
  var turnDotEl    = document.getElementById('turnDot');
  var turnTextEl   = document.getElementById('turnText');

  // ── Shuffle helper ───────────────────────────────────────────────────────
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  // ── Build card grid ──────────────────────────────────────────────────────
  function buildGrid() {
    // Pick 8 random emojis
    var chosen = shuffle(EMOJI_POOL).slice(0, 8);
    // Duplicate to make pairs, then shuffle positions
    var emojiList = shuffle(chosen.concat(chosen));

    cardGridEl.innerHTML = '';
    cards = [];

    emojiList.forEach(function (emoji, i) {
      // Card container
      var card = document.createElement('div');
      card.className = 'card';
      card.setAttribute('aria-label', '카드 ' + (i + 1));
      card.setAttribute('role', 'button');

      // Inner (for 3-D flip)
      var inner = document.createElement('div');
      inner.className = 'card-inner';

      // Back face
      var back = document.createElement('div');
      back.className = 'card-back';
      back.textContent = '?';

      // Front face
      var front = document.createElement('div');
      front.className = 'card-front';
      front.textContent = emoji;

      inner.appendChild(back);
      inner.appendChild(front);
      card.appendChild(inner);
      cardGridEl.appendChild(card);

      var cardData = { emoji: emoji, index: i, el: card, frontEl: front, matched: false };
      cards.push(cardData);

      onTap(card, function () { handleCardTap(cardData); });
    });
  }

  // ── Scoreboard UI ────────────────────────────────────────────────────────
  function buildScoreboard() {
    scoreboardEl.innerHTML = '';
    for (var p = 0; p < playerCount; p++) {
      var chip = document.createElement('div');
      chip.className = 'score-chip' + (p === 0 ? ' active-turn' : '');
      chip.id = 'chip-' + p;
      chip.style.color = PLAYER_COLORS[p];

      var dot = document.createElement('span');
      dot.className = 'score-dot';
      dot.style.background = PLAYER_COLORS[p];

      var label = document.createElement('span');
      label.className = 'score-label';
      label.textContent = 'P' + (p + 1);

      var val = document.createElement('span');
      val.className = 'score-val';
      val.id = 'score-val-' + p;
      val.textContent = '0';

      chip.appendChild(dot);
      chip.appendChild(label);
      chip.appendChild(val);
      scoreboardEl.appendChild(chip);
    }
  }

  function updateScoreUI(playerIdx) {
    var el = document.getElementById('score-val-' + playerIdx);
    if (el) el.textContent = scores[playerIdx];
  }

  function updateTurnUI() {
    turnDotEl.style.background = PLAYER_COLORS[currentPlayer];
    turnTextEl.textContent = PLAYER_NAMES[currentPlayer] + '의 차례';

    // Highlight active chip
    for (var p = 0; p < playerCount; p++) {
      var chip = document.getElementById('chip-' + p);
      if (chip) chip.classList.toggle('active-turn', p === currentPlayer);
    }
  }

  // ── Card tap handler ─────────────────────────────────────────────────────
  function handleCardTap(cardData) {
    if (locked) return;
    if (cardData.matched) return;
    if (cardData.el.classList.contains('flipped')) return;
    if (flippedCards.length >= 2) return;

    // Flip the card
    cardData.el.classList.add('flipped');
    sounds.play('flip');
    flippedCards.push(cardData);

    if (flippedCards.length === 2) {
      evaluatePair();
    }
  }

  function evaluatePair() {
    var a = flippedCards[0];
    var b = flippedCards[1];
    locked = true;

    if (a.emoji === b.emoji) {
      // Match!
      setTimeout(function () {
        sounds.play('match');

        a.matched = true;
        b.matched = true;
        a.el.classList.add('matched');
        b.el.classList.add('matched');

        // Color border in player's color
        a.frontEl.style.borderColor = PLAYER_COLORS[currentPlayer];
        b.frontEl.style.borderColor = PLAYER_COLORS[currentPlayer];

        scores[currentPlayer]++;
        updateScoreUI(currentPlayer);

        flippedCards = [];
        locked = false;

        // Check win
        if (allMatched()) {
          setTimeout(showResult, 400);
        }
        // Same player goes again — no turn change
      }, 300);
    } else {
      // Mismatch — shake, then flip back
      setTimeout(function () {
        sounds.play('nomatch');
        a.frontEl.classList.add('shake');
        b.frontEl.classList.add('shake');

        setTimeout(function () {
          a.el.classList.remove('flipped');
          b.el.classList.remove('flipped');
          a.frontEl.classList.remove('shake');
          b.frontEl.classList.remove('shake');

          flippedCards = [];
          locked = false;

          // Next player
          currentPlayer = (currentPlayer + 1) % playerCount;
          updateTurnUI();
        }, 450);
      }, 500);
    }
  }

  function allMatched() {
    return cards.every(function (c) { return c.matched; });
  }

  // ── Result screen ────────────────────────────────────────────────────────
  function showResult() {
    sounds.play('win');

    // Find winner(s)
    var maxScore = Math.max.apply(null, scores);
    var winners  = [];
    for (var p = 0; p < playerCount; p++) {
      if (scores[p] === maxScore) winners.push(p);
    }

    var resultEmojiEl = document.getElementById('resultEmoji');
    var resultTitleEl = document.getElementById('resultTitle');
    var resultScoresEl = document.getElementById('resultScores');

    if (winners.length === 1) {
      resultEmojiEl.textContent = '🎉';
      resultTitleEl.textContent = PLAYER_NAMES[winners[0]] + ' 승리!';
      resultTitleEl.style.color = PLAYER_COLORS[winners[0]];
    } else {
      resultEmojiEl.textContent = '🤝';
      resultTitleEl.textContent = '무승부!';
      resultTitleEl.style.color = '#AB47BC';
    }

    // Build score rows
    resultScoresEl.innerHTML = '';
    // Sort by score desc
    var order = [];
    for (var i = 0; i < playerCount; i++) { order.push(i); }
    order.sort(function (x, y) { return scores[y] - scores[x]; });

    order.forEach(function (p) {
      var isWinner = scores[p] === maxScore && winners.length === 1;
      var row = document.createElement('div');
      row.className = 'result-score-row' + (scores[p] === maxScore ? ' winner-row' : '');

      var dot = document.createElement('span');
      dot.className = 'result-score-dot';
      dot.style.background = PLAYER_COLORS[p];

      var name = document.createElement('span');
      name.className = 'result-score-name';
      name.textContent = PLAYER_NAMES[p];

      var pairs = document.createElement('span');
      pairs.className = 'result-score-pairs';
      pairs.textContent = scores[p] + '쌍';

      row.appendChild(dot);
      row.appendChild(name);
      row.appendChild(pairs);

      if (isWinner) {
        var crown = document.createElement('span');
        crown.className = 'result-crown';
        crown.textContent = '👑';
        row.appendChild(crown);
      }

      resultScoresEl.appendChild(row);
    });

    showScreen('result');
  }

  // ── Init game ────────────────────────────────────────────────────────────
  function initGame() {
    currentPlayer = 0;
    scores = [];
    flippedCards = [];
    locked = false;

    for (var p = 0; p < playerCount; p++) {
      scores.push(0);
    }

    buildGrid();
    buildScoreboard();
    updateTurnUI();
    showScreen('game');
  }

  // ── Button wiring ────────────────────────────────────────────────────────
  document.getElementById('playBtn').addEventListener('click', function () {
    startCountdown(function() { initGame(); });
  });

  document.getElementById('retryBtn').addEventListener('click', function () {
    initGame();
  });

  document.getElementById('homeBtn').addEventListener('click', function () {
    goHome();
  });

  document.getElementById('backBtn').addEventListener('click', function () {
    goHome();
  });

  document.getElementById('closeBtn').addEventListener('click', function () {
    if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
    showScreen('intro');
  });

})();
