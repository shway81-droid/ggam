/* games/chain-calc/game.js */

(function () {
  'use strict';

  // ─── 상수 ────────────────────────────────────────────────────────────────
  var TOTAL_ROUNDS = 8;
  var ROUND_TIME   = 90;   // 전체 제한시간 90초
  var RESULT_PAUSE_MS = getAutoplayPauseMs(2000);

  // ─── 난이도 단계 (라운드별) ───────────────────────────────────────────────
  // 단계 0: 한 자리 덧뺄셈 (라운드 1~3)
  // 단계 1: 두 자리 포함 (라운드 4~6)
  // 단계 2: 3연쇄 (라운드 7~8) — P1→P2→P1 세 번째 식 P1 존에 추가
  function getStage(round) {
    if (round < 3) return 0;
    if (round < 6) return 1;
    return 2;
  }

  // ─── 타이머 관리 ─────────────────────────────────────────────────────────
  var timers = [];
  var countdownInterval = null;
  var gameTimer = null;

  function later(fn, ms) {
    var id = setTimeout(fn, ms);
    timers.push(id);
    return id;
  }

  function clearAllTimers() {
    if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
    if (gameTimer) { gameTimer.stop(); gameTimer = null; }
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
    var countdownNumber = document.getElementById('countdownNumber');
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
        countdownNumber.offsetHeight; // reflow
        countdownNumber.style.animation = '';
      }
    }, 1000);
  }

  // ─── 사운드 ──────────────────────────────────────────────────────────────
  var sounds = createSoundManager({
    pick: function (ctx) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.1);
    },
    chain: function (ctx) {
      // 체인 연결 효과음 — 휙 하고 올라가는 소리
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.22);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.3);
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
    warn: function (ctx) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(392, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.2);
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
    ['soundIconIntro'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.innerHTML = muted ? SVG_SOUND_OFF : SVG_SOUND_ON;
    });
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
  // 현재 라운드 문제 데이터
  var p1Ans;       // P1 정답 값
  var p2Ans;       // P2 정답 값
  var p3Ans;       // 3연쇄 3번째 정답 (stage2)
  var p1Selected;  // null or value
  var p2Selected;
  var p3Selected;  // stage2용
  var p1Done;      // P1이 선택 완료했는지
  var stage;       // 현재 라운드 난이도 단계
  var isTriChain;  // 3연쇄 모드

  // ─── DOM ─────────────────────────────────────────────────────────────────
  var roundNumEl   = document.getElementById('roundNum');
  var timerEl      = document.getElementById('timerEl');
  var teamScoreEl  = document.getElementById('teamScore');
  var p1EqEl       = document.getElementById('p1Eq');
  var p2EqEl       = document.getElementById('p2Eq');
  var p1ChoicesEl  = document.getElementById('p1Choices');
  var p2ChoicesEl  = document.getElementById('p2Choices');
  var chainArrow   = document.getElementById('chainArrow');
  var chainValueEl = document.getElementById('chainValue');
  var p1HintEl     = document.getElementById('p1Hint');
  var p2HintEl     = document.getElementById('p2Hint');
  var bannerEl     = document.getElementById('banner');
  var resultTitle  = document.getElementById('resultTitle');
  var resultSub    = document.getElementById('resultSub');
  var resultIconWrap = document.getElementById('resultIconWrap');

  // ─── 문제 생성 ───────────────────────────────────────────────────────────
  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function makeChoices(correct, count, minVal, maxVal) {
    // 오답 보기 생성 — 정답 근처 ±1~4, 중복/정답과 겹침 없게
    var choices = [correct];
    var attempts = 0;
    while (choices.length < count && attempts < 200) {
      attempts++;
      var delta = randInt(1, 4) * (Math.random() < 0.5 ? 1 : -1);
      var val = correct + delta;
      if (val < minVal || val > maxVal) continue;
      if (choices.indexOf(val) !== -1) continue;
      choices.push(val);
    }
    // fallback: 오답이 부족하면 min~max에서 채우기
    var fill = minVal;
    while (choices.length < count && fill <= maxVal) {
      if (choices.indexOf(fill) === -1) choices.push(fill);
      fill++;
    }
    // 셔플
    for (var i = choices.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = choices[i]; choices[i] = choices[j]; choices[j] = tmp;
    }
    return choices;
  }

  function genProblem(st) {
    // st=0: 한 자리, st=1: 두 자리, st=2: 3연쇄
    if (st === 0) {
      // P1: a + b = ans1 (a,b in 1~9, ans1 in 3~15)
      var a = randInt(1, 7);
      var b = randInt(1, 7);
      var ans1 = a + b;
      // P2: ans1 - c = ans2 (c in 1..ans1-1, ans2>=1)
      var c = randInt(1, Math.min(ans1 - 1, 7));
      var ans2 = ans1 - c;
      return {
        p1Eq: a + ' + ' + b + ' = □',
        p2Eq: '□ - ' + c + ' = ?',
        p1Ans: ans1,
        p2Ans: ans2,
        isTriChain: false
      };
    } else if (st === 1) {
      // 두 자리 포함 — 덧셈 또는 뺄셈 혼합
      var ops = ['+', '-'];
      var op1 = ops[Math.floor(Math.random() * 2)];
      var op2 = ops[Math.floor(Math.random() * 2)];
      var a1, b1, ans1b, c1, ans2b;
      var ok = false;
      var tries = 0;
      while (!ok && tries < 100) {
        tries++;
        if (op1 === '+') {
          a1 = randInt(5, 15); b1 = randInt(5, 15); ans1b = a1 + b1;
        } else {
          a1 = randInt(10, 25); b1 = randInt(1, a1 - 1); ans1b = a1 - b1;
        }
        if (ans1b < 2 || ans1b > 30) continue;
        if (op2 === '+') {
          c1 = randInt(1, 10); ans2b = ans1b + c1;
          if (ans2b > 40) continue;
        } else {
          c1 = randInt(1, ans1b - 1); ans2b = ans1b - c1;
          if (ans2b < 1) continue;
        }
        ok = true;
      }
      var eqStr1 = a1 + ' ' + op1 + ' ' + b1 + ' = □';
      var eqStr2 = '□ ' + op2 + ' ' + c1 + ' = ?';
      return {
        p1Eq: eqStr1,
        p2Eq: eqStr2,
        p1Ans: ans1b,
        p2Ans: ans2b,
        isTriChain: false
      };
    } else {
      // 3연쇄: P1→P2→P1(세 번째 식)
      var aa = randInt(3, 10); var bb = randInt(1, 6); var ans1c = aa + bb;
      var cc = randInt(1, Math.min(ans1c - 1, 8)); var ans2c = ans1c - cc;
      var dd = randInt(1, 8); var ans3 = ans2c + dd;
      return {
        p1Eq: aa + ' + ' + bb + ' = □',
        p2Eq: '□ - ' + cc + ' = ?',
        p1Eq3: ans2c + ' + ' + dd + ' = ?',  // 세 번째 식 (P1 존에 표시)
        p1Ans: ans1c,
        p2Ans: ans2c,
        p3Ans: ans3,
        isTriChain: true
      };
    }
  }

  // ─── 보기 렌더 ───────────────────────────────────────────────────────────
  function buildChoices(container, correct, minVal, maxVal, onSelect, disabledWait) {
    container.innerHTML = '';
    var choices = makeChoices(correct, 4, minVal, maxVal);
    choices.forEach(function (val) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'choice-btn' + (disabledWait ? ' disabled-wait' : '');
      btn.textContent = val;
      btn.setAttribute('data-val', val);
      onTap(btn, function () {
        onSelect(val, btn, container);
      });
      container.appendChild(btn);
    });
  }

  // ─── 라운드 시작 ─────────────────────────────────────────────────────────
  function startRound() {
    roundLocked = false;
    p1Selected = null;
    p2Selected = null;
    p3Selected = null;
    p1Done = false;

    stage = getStage(currentRound);
    var prob = genProblem(stage);
    p1Ans = prob.p1Ans;
    p2Ans = prob.p2Ans;
    p3Ans = prob.p3Ans || null;
    isTriChain = prob.isTriChain || false;

    roundNumEl.textContent = (currentRound + 1) + '/' + TOTAL_ROUNDS;
    chainValueEl.textContent = '?';
    chainValueEl.classList.remove('arrived');
    chainArrow.classList.remove('flowing');

    p1EqEl.textContent = prob.p1Eq;
    p2EqEl.textContent = prob.p2Eq;
    p2EqEl.classList.remove('p2-active');

    p1HintEl.textContent = isTriChain ? '먼저 계산! (1번째)' : '먼저 계산!';
    p2HintEl.textContent = 'P1 결과를 받아요';

    hideBanner();

    // P1 보기: 정답 포함 4지선다
    buildChoices(p1ChoicesEl, p1Ans, Math.max(1, p1Ans - 6), p1Ans + 6, onP1Select, false);

    // P2 보기: 처음엔 dim 처리 (P1이 전에 누르면 경고)
    buildChoices(p2ChoicesEl, p2Ans, Math.max(1, p2Ans - 6), p2Ans + 6, onP2Select, true);

    // 3연쇄이면 세 번째 식은 P2 완료 후 표시
    if (isTriChain) {
      p1HintEl.textContent = '1단계';
    }
  }

  // ─── P1 선택 ─────────────────────────────────────────────────────────────
  function onP1Select(val, btn, container) {
    if (roundLocked) return;
    if (p1Done) return; // 이미 선택 완료

    sounds.play('pick');
    // 기존 선택 해제
    container.querySelectorAll('.choice-btn').forEach(function (b) {
      b.classList.remove('selected');
    });
    btn.classList.add('selected');
    p1Selected = val;

    // P1 선택 완료 → 체인 전달 연출
    p1Done = true;
    // 버튼 잠금
    container.querySelectorAll('.choice-btn').forEach(function (b) {
      b.style.pointerEvents = 'none';
    });

    later(function () {
      animateChain(val, function () {
        // □를 p1Selected 값으로 교체하여 P2 수식 완성
        p2EqEl.textContent = p2EqEl.textContent.replace('□', String(val));
        p2EqEl.classList.add('p2-active');
        p2HintEl.textContent = '이어서 계산!';
        // P2 보기 enabled
        p2ChoicesEl.querySelectorAll('.choice-btn').forEach(function (b) {
          b.classList.remove('disabled-wait');
        });
      });
    }, 200);
  }

  // ─── 체인 흐름 애니메이션 ───────────────────────────────────────────────
  function animateChain(val, onDone) {
    sounds.play('chain');
    chainArrow.classList.add('flowing');
    later(function () {
      chainArrow.classList.remove('flowing');
      chainValueEl.textContent = val;
      chainValueEl.classList.add('arrived');
      if (onDone) onDone();
    }, 700);
  }

  // ─── P2 선택 ─────────────────────────────────────────────────────────────
  function onP2Select(val, btn, container) {
    if (roundLocked) return;

    // P1이 아직 선택 안 했으면 경고
    if (!p1Done) {
      showBanner('아직 앞 계산이 안 왔어요! P1이 먼저예요 🔗', 'warn');
      sounds.play('warn');
      return;
    }

    sounds.play('pick');
    container.querySelectorAll('.choice-btn').forEach(function (b) {
      b.classList.remove('selected');
    });
    btn.classList.add('selected');
    p2Selected = val;

    if (isTriChain) {
      // 3연쇄: P2 완료 → 세 번째 식이 P1 존에 등장
      container.querySelectorAll('.choice-btn').forEach(function (b) {
        b.style.pointerEvents = 'none';
      });
      later(function () {
        // P2 정답 여부 체크는 최종 판정 때
        // 세 번째 식: P1 존 업데이트
        p1EqEl.textContent = p2Selected + ' + ' + (p3Ans - p2Selected) + ' = ?';
        p1HintEl.textContent = '3단계!';
        // P1 보기 재생성 (3번째)
        buildChoices(p1ChoicesEl, p3Ans, Math.max(1, p3Ans - 6), p3Ans + 6, onP3Select, false);
        // 체인 흐름 역방향 표시
        animateChain(p2Selected, null);
        p2HintEl.textContent = '완료!';
      }, 400);
    } else {
      container.querySelectorAll('.choice-btn').forEach(function (b) {
        b.style.pointerEvents = 'none';
      });
      later(judgeRound, 400);
    }
  }

  // ─── 3번째 선택 (stage2) ─────────────────────────────────────────────────
  function onP3Select(val, btn, container) {
    if (roundLocked) return;
    sounds.play('pick');
    container.querySelectorAll('.choice-btn').forEach(function (b) {
      b.classList.remove('selected');
    });
    btn.classList.add('selected');
    p3Selected = val;
    container.querySelectorAll('.choice-btn').forEach(function (b) {
      b.style.pointerEvents = 'none';
    });
    later(judgeRound, 400);
  }

  // ─── 판정 ─────────────────────────────────────────────────────────────────
  function judgeRound() {
    roundLocked = true;
    var p1Ok = (p1Selected === p1Ans);
    var p2Ok = (p2Selected === p2Ans);
    var p3Ok = !isTriChain || (p3Selected === p3Ans);
    var allOk = p1Ok && p2Ok && p3Ok;

    // 정답/오답 표시
    markChoices(p1ChoicesEl, p1Selected, p1Ans);
    markChoices(p2ChoicesEl, p2Selected, p2Ans);
    if (isTriChain) {
      markChoices(p1ChoicesEl, p3Selected, p3Ans);
    }

    if (allOk) {
      teamScore++;
      updateScoreUI();
      sounds.play('correct');
      showBanner('🎉 완성! 멋진 협력!', 'ok');
    } else {
      sounds.play('wrong');
      var msg = '';
      if (!p1Ok) msg = 'P1 계산이 틀렸어요 (' + p1Selected + '→ 정답 ' + p1Ans + ')';
      else if (!p2Ok) msg = 'P2 계산이 틀렸어요 (' + p2Selected + '→ 정답 ' + p2Ans + ')';
      else msg = '3단계 계산이 틀렸어요';
      showBanner('아쉬워요! ' + msg, 'ng');
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
  }

  function markChoices(container, selected, correct) {
    if (!container) return;
    container.querySelectorAll('.choice-btn').forEach(function (b) {
      var v = parseInt(b.getAttribute('data-val'), 10);
      if (v === correct) {
        b.classList.add('correct');
      } else if (v === selected && selected !== correct) {
        b.classList.add('wrong');
      }
    });
  }

  // ─── 타이머 UI ───────────────────────────────────────────────────────────
  function updateTimerUI(remain) {
    timerEl.textContent = remain;
    if (remain <= 15) {
      timerEl.classList.add('warning');
    } else {
      timerEl.classList.remove('warning');
    }
  }

  // ─── UI 업데이트 ─────────────────────────────────────────────────────────
  function updateScoreUI() {
    teamScoreEl.textContent = teamScore;
  }

  function showBanner(text, cls) {
    bannerEl.textContent = text;
    bannerEl.className = 'banner show ' + cls;
  }

  function hideBanner() {
    bannerEl.classList.remove('show', 'ok', 'ng', 'warn');
    bannerEl.textContent = '';
  }

  // ─── 게임 초기화 ─────────────────────────────────────────────────────────
  function initGame() {
    clearAllTimers();
    currentRound = 0;
    teamScore = 0;
    roundLocked = false;
    updateScoreUI();
    updateTimerUI(ROUND_TIME);

    // 90초 전체 타이머
    gameTimer = createTimer(ROUND_TIME, function (remain) {
      updateTimerUI(remain);
    }, function () {
      // 시간 종료
      roundLocked = true;
      showBanner('시간 종료!', 'ng');
      later(showResult, 1200);
    });

    showScreen('game');
    startRound();
    gameTimer.start();
  }

  // ─── 결과 화면 ───────────────────────────────────────────────────────────
  function showResult() {
    if (gameTimer) { gameTimer.stop(); gameTimer = null; }
    var pct = teamScore / TOTAL_ROUNDS;
    var sub, iconHtml;
    if (pct === 1) {
      sub = '완벽한 이어 계산! 최고의 팀!';
      iconHtml = makeResultIcon('🏆', '#FFD54F');
    } else if (pct >= 0.75) {
      sub = '훌륭한 협력이에요! 다시 도전해봐요!';
      iconHtml = makeResultIcon('🔗', '#B2DFDB');
    } else if (pct >= 0.5) {
      sub = '절반 성공! 계산 실력을 키워봐요!';
      iconHtml = makeResultIcon('🔗', '#FFF9C4');
    } else {
      sub = '조금 더 연습해봐요! 다시 도전!';
      iconHtml = makeResultIcon('🔗', '#FFCDD2');
    }
    resultTitle.textContent = teamScore + '/' + TOTAL_ROUNDS + ' 성공';
    resultSub.textContent = sub;
    resultIconWrap.innerHTML = iconHtml;
    sounds.play('win');
    showScreen('result');
  }

  function makeResultIcon(emoji, bg) {
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
