/* games/number-tap/game.js */
(function () {
  'use strict';

  /* =============================================
     화면 전환
  ============================================= */
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

  /* =============================================
     사운드
  ============================================= */
  var sounds = createSoundManager({
    // 정답: 밝고 짧은 틱
    correct: function (ctx) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    },
    // 오답: 낮은 버즈
    wrong: function (ctx) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(120, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    },
    // 플레이어 완료: 짧은 팡파레
    complete: function (ctx) {
      var melody = [523, 659, 784, 1047];
      melody.forEach(function (freq, i) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        var t = ctx.currentTime + i * 0.1;
        gain.gain.setValueAtTime(0.22, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.25);
      });
    },
    // 타임업: 하강 음
    timeup: function (ctx) {
      var notes = [440, 349, 262];
      notes.forEach(function (freq, i) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        var t = ctx.currentTime + i * 0.18;
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.3);
      });
    }
  });

  /* 사운드 토글 */
  var soundToggleIntro = document.getElementById('soundToggleIntro');
  function updateSoundBtn() {
    soundToggleIntro.textContent = sounds.isMuted() ? '🔇' : '🔊';
  }
  soundToggleIntro.addEventListener('click', function () {
    sounds.toggleMute();
    updateSoundBtn();
  });
  updateSoundBtn();

  /* =============================================
     인트로 옵션 선택
  ============================================= */
  var selectedPlayerCount = 3;
  var selectedDifficulty  = 'easy'; // 'easy' | 'normal'

  function setupOptionGroup(groupId, onSelect) {
    var group = document.getElementById(groupId);
    group.addEventListener('click', function (e) {
      var btn = e.target.closest('.option-btn');
      if (!btn) return;
      group.querySelectorAll('.option-btn').forEach(function (b) {
        b.classList.remove('selected');
      });
      btn.classList.add('selected');
      onSelect(btn.dataset.value);
    });
  }

  setupOptionGroup('playerCountGroup', function (val) {
    selectedPlayerCount = parseInt(val, 10);
  });

  setupOptionGroup('difficultyGroup', function (val) {
    selectedDifficulty = val;
  });

  /* =============================================
     카운트다운
  ============================================= */
  var countdownEl = document.getElementById('countdownNumber');

  function startCountdown(onDone) {
    showScreen('countdown');
    runCountdown(countdownEl, onDone);
  }

  /* =============================================
     게임 상태
  ============================================= */
  var PLAYER_COLORS = [
    { bg: '#BBDEFB', dot: '#1565C0', label: '플레이어 1' },
    { bg: '#FFCDD2', dot: '#B71C1C', label: '플레이어 2' },
    { bg: '#C8E6C9', dot: '#1B5E20', label: '플레이어 3' },
    { bg: '#FFE0B2', dot: '#E65100', label: '플레이어 4' }
  ];

  var RANK_MEDALS = ['🥇', '🥈', '🥉', '4위'];
  var RANK_LABELS = ['1등!', '2등!', '3등!', '4등'];

  var GAME_DURATION = 90; // seconds

  var playerCount  = 3;
  var maxNumber    = 10;
  var gameRunning  = false;
  var finishOrder  = []; // player indices in completion order
  var playerStates = []; // per-player state objects
  var gameTimer    = null;
  var hudTimeEl    = document.getElementById('hudTime');
  var timerBarEl   = document.getElementById('timerBar');
  var zonesContainer = document.getElementById('zonesContainer');

  /* =============================================
     숫자 위치 랜덤 배분 (겹치지 않게)
  ============================================= */
  function placeNumbers(count, fieldW, fieldH) {
    var radius  = 26; // half of 52px
    var padding = radius + 4;
    var positions = [];
    var maxAttempts = 400;

    for (var n = 1; n <= count; n++) {
      var placed = false;
      for (var attempt = 0; attempt < maxAttempts; attempt++) {
        var x = padding + Math.random() * (fieldW - padding * 2);
        var y = padding + Math.random() * (fieldH - padding * 2);
        // Collision check
        var ok = true;
        for (var j = 0; j < positions.length; j++) {
          var dx = positions[j].x - x;
          var dy = positions[j].y - y;
          if (Math.sqrt(dx * dx + dy * dy) < radius * 2 + 6) {
            ok = false;
            break;
          }
        }
        if (ok) {
          positions.push({ n: n, x: x, y: y });
          placed = true;
          break;
        }
      }
      if (!placed) {
        // Fallback: place anyway (grid-ish)
        var cols = Math.ceil(Math.sqrt(count));
        var col  = (n - 1) % cols;
        var row  = Math.floor((n - 1) / cols);
        positions.push({
          n: n,
          x: padding + col * (fieldW - padding * 2) / cols,
          y: padding + row * (fieldH - padding * 2) / Math.ceil(count / cols)
        });
      }
    }
    return positions;
  }

  /* =============================================
     플레이어 존 빌드
  ============================================= */
  function buildZones() {
    zonesContainer.innerHTML = '';
    zonesContainer.className = 'zones-container layout-' + playerCount + 'p';
    playerStates = [];

    for (var i = 0; i < playerCount; i++) {
      var color = PLAYER_COLORS[i];

      var zone = document.createElement('div');
      zone.className = 'player-zone';
      zone.dataset.player = i;

      // Header
      var header = document.createElement('div');
      header.className = 'zone-header';

      var nameEl = document.createElement('span');
      nameEl.className = 'zone-player-name';
      nameEl.textContent = color.label;

      var targetWrap = document.createElement('span');
      targetWrap.className = 'zone-target';
      targetWrap.innerHTML = '목표: <span class="zone-target-num" id="target-' + i + '">1</span>';

      var rankBadge = document.createElement('span');
      rankBadge.className = 'zone-rank-badge';
      rankBadge.id = 'rank-badge-' + i;

      header.appendChild(nameEl);
      header.appendChild(targetWrap);
      header.appendChild(rankBadge);
      zone.appendChild(header);

      // Field (scattered numbers)
      var field = document.createElement('div');
      field.className = 'zone-field';
      field.id = 'field-' + i;
      zone.appendChild(field);

      // Complete overlay
      var overlay = document.createElement('div');
      overlay.className = 'zone-complete-overlay';
      overlay.innerHTML = '<div class="complete-rank-text" id="overlay-rank-' + i + '"></div>' +
                          '<div class="complete-sub-text">' + color.label + '</div>';
      zone.appendChild(overlay);

      zonesContainer.appendChild(zone);

      // Player state
      playerStates.push({
        index:     i,
        current:   1,          // next number to tap
        max:       maxNumber,
        done:      false,
        zone:      zone,
        field:     field,
        circles:   {},         // num -> DOM element
        targetEl:  null        // set after DOM ready
      });
    }
  }

  function populateFields() {
    playerStates.forEach(function (ps) {
      var field    = ps.field;
      var fieldW   = field.offsetWidth  || 160;
      var fieldH   = field.offsetHeight || 160;
      var positions = placeNumbers(ps.max, fieldW, fieldH);

      positions.forEach(function (pos) {
        var circle = document.createElement('div');
        circle.className = 'num-circle';
        circle.textContent = pos.n;
        circle.style.left = pos.x + 'px';
        circle.style.top  = pos.y + 'px';
        circle.dataset.num = pos.n;

        // Touch + click handler
        onTap(circle, function () {
          handleTap(ps, parseInt(circle.dataset.num, 10), circle);
        });

        field.appendChild(circle);
        ps.circles[pos.n] = circle;
      });

      // Mark target
      ps.targetEl = document.getElementById('target-' + ps.index);
      highlightTarget(ps);
    });
  }

  function highlightTarget(ps) {
    // Clear all is-target classes
    Object.keys(ps.circles).forEach(function (n) {
      ps.circles[n].classList.remove('is-target');
    });
    // Set current target
    if (ps.current <= ps.max && ps.circles[ps.current]) {
      ps.circles[ps.current].classList.add('is-target');
    }
    if (ps.targetEl) {
      ps.targetEl.textContent = ps.current;
    }
  }

  /* =============================================
     탭 처리
  ============================================= */
  function handleTap(ps, num, circle) {
    if (!gameRunning || ps.done) return;

    if (num === ps.current) {
      // Correct!
      sounds.play('correct');
      circle.classList.remove('is-target');
      circle.classList.add('done');
      circle.textContent = '✓';
      ps.current++;

      if (ps.current > ps.max) {
        // Player finished!
        completePlayer(ps);
      } else {
        highlightTarget(ps);
      }
    } else {
      // Wrong – brief shake on the tapped circle
      sounds.play('wrong');
      circle.classList.remove('wrong-shake');
      circle.offsetHeight; // reflow
      circle.classList.add('wrong-shake');
      setTimeout(function () { circle.classList.remove('wrong-shake'); }, 350);
    }
  }

  /* =============================================
     플레이어 완료
  ============================================= */
  function completePlayer(ps) {
    ps.done = true;
    finishOrder.push(ps.index);

    var rank      = finishOrder.length;
    var medal     = RANK_MEDALS[rank - 1] || rank + '위';
    var rankLabel = RANK_LABELS[rank - 1] || rank + '위';

    ps.zone.classList.add('completed');
    document.getElementById('overlay-rank-' + ps.index).textContent = medal;
    document.getElementById('rank-badge-' + ps.index).textContent  = medal;

    sounds.play('complete');

    // Check if all players finished
    var allDone = playerStates.every(function (s) { return s.done; });
    if (allDone) {
      endGame(false);
    }
  }

  /* =============================================
     게임 시작 / 종료
  ============================================= */
  function startGame() {
    gameRunning = true;
    finishOrder = [];

    playerCount = selectedPlayerCount;
    maxNumber   = selectedDifficulty === 'easy' ? 10 : 15;

    buildZones();
    showScreen('game');

    // Let layout settle before placing numbers
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        populateFields();
      });
    });

    // Timer
    timerBarEl.style.width = '100%';
    hudTimeEl.textContent  = GAME_DURATION;

    gameTimer = createTimer(GAME_DURATION, function (rem) {
      hudTimeEl.textContent = rem;
      timerBarEl.style.width = (rem / GAME_DURATION * 100) + '%';
      // Flash red at 10s
      if (rem <= 10) {
        hudTimeEl.style.color = '#FF5252';
      }
    }, function () {
      endGame(true);
    });

    gameTimer.start();
  }

  function endGame(timeUp) {
    gameRunning = false;
    if (gameTimer) {
      gameTimer.stop();
      gameTimer = null;
    }
    hudTimeEl.style.color = '';

    if (timeUp) {
      sounds.play('timeup');
    }

    // Build result
    buildResult(timeUp);
    setTimeout(function () {
      showScreen('result');
    }, timeUp ? 400 : 600);
  }

  /* =============================================
     결과 화면
  ============================================= */
  function buildResult(timeUp) {
    var container = document.getElementById('resultRankings');
    container.innerHTML = '';

    // Build ranking: finished players first (in order), then unfinished by progress desc
    var finished   = finishOrder.slice();
    var unfinished = [];
    playerStates.forEach(function (ps) {
      if (!ps.done) unfinished.push(ps);
    });
    unfinished.sort(function (a, b) { return b.current - a.current; });

    var allOrdered = finished.concat(unfinished.map(function (ps) { return ps.index; }));

    allOrdered.forEach(function (pIdx, rankIdx) {
      var ps    = playerStates[pIdx];
      var color = PLAYER_COLORS[pIdx];
      var medal = RANK_MEDALS[rankIdx] || (rankIdx + 1) + '위';

      var row = document.createElement('div');
      row.className = 'rank-row' + (rankIdx === 0 ? ' rank-1' : '');

      var medalEl = document.createElement('div');
      medalEl.className = 'rank-medal';
      medalEl.textContent = medal;

      var dot = document.createElement('div');
      dot.className = 'rank-player-dot';
      dot.style.background = color.dot;

      var nameEl = document.createElement('div');
      nameEl.className = 'rank-player-name';
      nameEl.textContent = color.label;

      var progEl = document.createElement('div');
      progEl.className = 'rank-progress';
      if (ps.done) {
        progEl.textContent = '완료! ✓';
      } else {
        progEl.textContent = (ps.current - 1) + ' / ' + ps.max;
      }

      row.appendChild(medalEl);
      row.appendChild(dot);
      row.appendChild(nameEl);
      row.appendChild(progEl);
      container.appendChild(row);
    });
  }

  /* =============================================
     버튼 이벤트
  ============================================= */
  document.getElementById('playBtn').addEventListener('click', function () {
    startCountdown(startGame);
  });

  document.getElementById('backBtn').addEventListener('click', function () {
    goHome();
  });

  document.getElementById('closeBtn').addEventListener('click', function () {
    if (gameRunning) {
      gameRunning = false;
      if (gameTimer) { gameTimer.stop(); gameTimer = null; }
    }
    goHome();
  });

  document.getElementById('retryBtn').addEventListener('click', function () {
    startCountdown(startGame);
  });

  document.getElementById('homeBtn').addEventListener('click', function () {
    goHome();
  });

})();
