/* shared/engine.js */

/**
 * 카운트다운 타이머 생성
 * @param {number} seconds - 총 시간 (초)
 * @param {function} onTick - 매초 호출 (remaining 전달)
 * @param {function} onEnd - 종료 시 호출
 * @returns {{ start(), pause(), stop() }}
 */
function createTimer(seconds, onTick, onEnd) {
  let remaining = seconds;
  let intervalId = null;

  function tick() {
    remaining--;
    onTick(remaining);
    if (remaining <= 0) {
      clearInterval(intervalId);
      intervalId = null;
      onEnd();
    }
  }

  return {
    start() {
      if (intervalId) return;
      onTick(remaining);
      intervalId = setInterval(tick, 1000);
    },
    pause() {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    },
    stop() {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
      remaining = seconds;
    }
  };
}

/**
 * 표준 프리게임 카운트다운(3→2→1) 실행.
 * countdownNumber 요소를 즉시 시작값으로 채우고 매초 1씩 줄여 표시하다가,
 * 0이 되면 onDone()을 호출한다. (66여 개 게임에 복붙돼 있던 동일 블록 공통화)
 *
 * 화면 전환(showScreen)은 호출 측 책임으로 남긴다 — 게임마다 showScreen
 * 시그니처(요소형/문자열형)가 달라 헬퍼가 건드리면 위험하기 때문.
 * 반환값은 setInterval ID라서, 게임이 다른 곳에서 하던
 * `clearInterval(countdownInterval)` / `if (countdownInterval)` 패턴과 그대로 호환된다.
 *
 * @param {HTMLElement} el - 숫자를 표시할 요소 (보통 #countdownNumber)
 * @param {function} onDone - 카운트다운 종료 시 호출
 * @param {{from?:number, interval?:number}} [opts] - from: 시작 숫자(기본 3), interval: 간격 ms(기본 1000)
 * @returns {number} setInterval ID
 */
function runCountdown(el, onDone, opts) {
  opts = opts || {};
  var count = opts.from != null ? opts.from : 3;
  var step = opts.interval != null ? opts.interval : 1000;
  if (el) el.textContent = count;
  var id = setInterval(function () {
    count--;
    if (count <= 0) {
      clearInterval(id);
      onDone();
    } else if (el) {
      el.textContent = count;
      el.style.animation = 'none';
      void el.offsetHeight; // reflow로 애니메이션 재시작
      el.style.animation = '';
    }
  }, step);
  return id;
}

/**
 * 사운드 음소거 토글 버튼 공통 배선.
 * 버튼(들)에 onTap을 걸어 toggleMute()하고 아이콘(🔇/🔊)을 갱신한다.
 * (78게임에 복붙돼 있던 updateSoundBtn/Icon + onTap + 초기호출 3종 세트 공통화)
 * @param {object} sound - createSoundManager() 반환 객체 (isMuted/toggleMute)
 * @param {HTMLElement|HTMLElement[]} buttons - 토글 버튼(들)
 * @param {HTMLElement|HTMLElement[]} [iconEls] - 아이콘 표시 별도 요소(들). 생략 시 버튼 자체에 표시.
 * @returns {function} 아이콘 강제 갱신 함수
 */
function setupSoundToggle(sound, buttons, iconEls) {
  var btns = (Array.isArray(buttons) ? buttons : [buttons]).filter(Boolean);
  var icons = iconEls ? (Array.isArray(iconEls) ? iconEls : [iconEls]).filter(Boolean) : btns;
  function update() {
    var icon = sound.isMuted() ? '🔇' : '🔊';
    icons.forEach(function (el) { el.textContent = icon; });
  }
  btns.forEach(function (btn) {
    onTap(btn, function () { sound.toggleMute(); update(); });
  });
  update();
  return update;
}

/**
 * 인원수 선택(.player-btn) 공통 배선.
 * .player-btn 버튼들에 onTap을 걸어 active 클래스를 갱신하고, 선택 인원수를 콜백으로 전달.
 * (대다수 게임에 복붙돼 있던 동일 배선 블록 공통화)
 * @param {function} onSelect - (count:number) => void. 보통 playerCount 변수에 대입.
 */
function setupPlayerSelect(onSelect) {
  var btns = document.querySelectorAll('.player-btn');
  btns.forEach(function (btn) {
    onTap(btn, function () {
      btns.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      onSelect(parseInt(btn.dataset.count, 10));
    });
  });
}

/**
 * 점수 표시 관리
 * @param {HTMLElement} element - 점수를 표시할 DOM 요소
 * @returns {{ add(n), get(), reset() }}
 */
function createScoreboard(element) {
  let score = 0;

  function render() {
    element.textContent = score;
  }

  render();

  return {
    add(n) {
      score += n;
      render();
    },
    get() {
      return score;
    },
    reset() {
      score = 0;
      render();
    }
  };
}

/* ── 공용: 사운드 설정 읽기 (localStorage 영구 저장, 과거 sessionStorage 값 이관) ── */
function _readSoundMuted() {
  try {
    var v = localStorage.getItem('sound-muted');
    if (v === null) v = sessionStorage.getItem('sound-muted');
    return v === 'true';
  } catch (e) { return false; }
}
function _writeSoundMuted(muted) {
  try {
    localStorage.setItem('sound-muted', muted ? 'true' : 'false');
    sessionStorage.setItem('sound-muted', muted ? 'true' : 'false'); // 구버전 호환
  } catch (e) {}
}

/**
 * Web Audio API 기반 효과음 관리
 * soundMap: { name: function(audioCtx) => AudioNode } 형태
 * 각 함수는 audioCtx를 받아 oscillator 등을 설정하고 재생
 *
 * v5 업그레이드:
 * - 마스터 컴프레서 체인: 게임마다 제각각인 음량을 평준화하고 클리핑 방지
 *   (게임 코드는 ctx.destination에 연결하지만, 실제로는 facade가 마스터 입력으로 우회)
 * - suspended 자동 복구: 어떤 상황에서도 무음 버그가 나지 않게 play()마다 resume
 * - 연속 정답 콤보: correct/ding 계열이 연속되면 상승 스파클 음을 한 겹 얹음
 * - 음소거 설정 localStorage 영구화 (교실 고정 기기 전제)
 *
 * @param {Object} soundMap
 * @returns {{ play(name), mute(), unmute(), isMuted(), toggleMute() }}
 */
/**
 * 공통 효과음 프리셋 — 다수 게임이 동일하게 합성하던 ding/buzz/timeout/tick/fanfare를
 * 엔진으로 끌어올림. createSoundManager가 이 기본값 위에 게임별 맵을 병합하므로,
 * 게임은 표준 효과음을 생략(빈 호출)하거나 일부만 덮어쓸 수 있다. (게임 동작 불변)
 */
const DEFAULT_SOUNDS = {
  ding(ctx) {
    [523, 659, 784].forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      const t = ctx.currentTime + i * 0.09;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
      osc.start(t);
      osc.stop(t + 0.32);
    });
  },
  buzz(ctx) {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.28);
    gain.gain.setValueAtTime(0.45, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.32);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.32);
  },
  timeout(ctx) {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160, ctx.currentTime);
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  },
  tick(ctx) {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'square';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.08);
  },
  fanfare(ctx) {
    [392, 494, 523, 659, 784].forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'triangle';
      const t = ctx.currentTime + i * 0.12;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
      osc.start(t);
      osc.stop(t + 0.38);
    });
  },
};

function createSoundManager(soundMap) {
  // 표준 효과음 기본값 위에 게임별 정의를 덮어씀 (전달 맵이 우선)
  soundMap = Object.assign({}, DEFAULT_SOUNDS, soundMap || {});
  let audioCtx = null;
  let facade = null;
  let masterIn = null;
  let muted = _readSoundMuted();

  // 연속 정답 콤보 스파클
  let combo = 0;
  let lastComboAt = 0;
  const COMBO_UP = { correct: 1, ding: 1, success: 1, good: 1, win: 0 };
  const COMBO_RESET = { wrong: 1, buzz: 1, miss: 1, bad: 1, fail: 1, bomb: 1 };
  const COMBO_SCALE = [659.25, 783.99, 1046.5, 1318.5, 1568.0, 2093.0];

  function getContext() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      // 마스터 체인: masterIn → compressor → destination
      const comp = audioCtx.createDynamicsCompressor();
      try {
        comp.threshold.value = -14;
        comp.knee.value = 24;
        comp.ratio.value = 6;
        comp.attack.value = 0.003;
        comp.release.value = 0.2;
      } catch (e) {}
      masterIn = audioCtx.createGain();
      masterIn.gain.value = 0.9;
      masterIn.connect(comp);
      comp.connect(audioCtx.destination);
      // 게임 코드가 ctx.destination에 연결하면 마스터 입력으로 우회되는 facade
      facade = new Proxy(audioCtx, {
        get(target, key) {
          if (key === 'destination') return masterIn;
          const v = target[key];
          return typeof v === 'function' ? v.bind(target) : v;
        }
      });
    }
    if (audioCtx.state === 'suspended') {
      try { audioCtx.resume(); } catch (e) {}
    }
    return facade;
  }

  function sparkle() {
    try {
      const t = audioCtx.currentTime + 0.06;
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = 'triangle';
      o.frequency.value = COMBO_SCALE[Math.min(combo - 2, COMBO_SCALE.length - 1)];
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.14, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
      o.connect(g);
      g.connect(masterIn);
      o.start(t);
      o.stop(t + 0.36);
    } catch (e) {}
  }

  return {
    play(name) {
      if (muted) return;
      const fn = soundMap[name];
      if (!fn) return;
      const ctx = getContext();
      fn(ctx);
      // 콤보 추적 (게임 사운드 위에 상승음을 얹는 방식 — 게임 코드 무수정)
      try {
        const now = Date.now();
        if (COMBO_UP[name]) {
          combo = (now - lastComboAt < 8000) ? combo + 1 : 1;
          lastComboAt = now;
          if (combo >= 2) sparkle();
        } else if (COMBO_RESET[name]) {
          combo = 0;
        }
      } catch (e) {}
    },
    mute() {
      muted = true;
      _writeSoundMuted(true);
    },
    unmute() {
      muted = false;
      _writeSoundMuted(false);
    },
    isMuted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      _writeSoundMuted(muted);
      return muted;
    }
  };
}

/**
 * 런처(홈)로 이동
 */
function goHome() {
  window.location.href = '../../index.html';
}

/* ═══ BGM Manager v6 — 사용자 선정 6곡 (미리듣기 2·5·7·8·9·10번 포팅) ═══
   전 곡 120 BPM 이상. 자산 0byte, 전부 실시간 합성.

   speed     그린힐 러너 150        — 질주 록
   brain     트로피컬 마림바 120    — 산뻔한 칠
   math      슈퍼 점프 140           — 마리오풍 스윙 치프튼
   knowledge 운동회 행진곡 132       — 팡파레 행진
   coop      섬마을 휘파람 126       — 동물의숲풍 (비브라토 휘파람)
   puzzle    두구두구 스피드런 160  — DnB 라이트

   - 기본 ON, 아주 작은 볼륨 (localStorage 'bgm-on' 영구 저장)
   - setTension(true): 타이머 임박 시 템포 +25% / 반음 상승
*/
function createBgmManager() {
  let ctx = null;
  let master = null;
  let noiseBuf = null;
  let on = true;
  let currentCategory = null;
  let timerId = null;
  let nextTime = 0;
  let step = 0;
  let tension = false;
  let unlockArmed = false;

  try {
    var v = localStorage.getItem('bgm-on');
    if (v === null) v = sessionStorage.getItem('bgm-on');
    on = v !== 'false'; // 기본 ON
  } catch (e) {}

  const BGM_VOLUME = 0.05;

  function nf(n) { return 440 * Math.pow(2, (n - 69) / 12); }

  /* 곡 데이터 — 4마디 루프, 마디당 8스텝(8분음표)
     melody: 스텝별 midi 노트 (null=쉬표)
     bass.style: notes | oompah(움파) | riff16(16분 리프)
     pad.mode: sustain | stab / arp: 코드톤 16분 아르페지오 */
  const N = null;
  const SONGS = {
    speed: { bpm: 150, steps: 8, swing: 0,
      chords: [[48,[60,64,67]],[45,[57,60,64]],[41,[57,60,65]],[43,[55,59,62]]],
      melody: [72,74,76,N,79,N,76,N, 74,76,77,N,81,N,79,77, 76,N,74,76,79,76,74,72, 74,N,71,74,72,N,N,N],
      lead: {type:'square',gain:0.18,pluck:6}, pad: {type:'triangle',gain:0.06,mode:'stab',steps:[0,4]},
      bass: {style:'notes',steps:[0,2,4,6],gain:0.4,type:'triangle'}, arp: null,
      drums: {kick:[0,4],snare:[2,6],hat:[0,1,2,3,4,5,6,7]} },
    brain: { bpm: 120, steps: 8, swing: 0,
      chords: [[48,[60,64,67]],[45,[57,64,69]],[41,[57,60,65]],[43,[59,62,67]]],
      melody: [N,72,N,76,N,79,N,76, N,72,N,74,N,76,N,N, N,69,N,72,N,77,N,76, N,74,N,71,N,67,N,N],
      lead: {type:'triangle',gain:0.26,pluck:12}, pad: null,
      bass: {style:'notes',steps:[0,3,6],gain:0.38,type:'sine'}, arp: {type:'triangle',gain:0.08},
      drums: {shaker16:true,rim:[3,6],kick:[0,4]} },
    math: { bpm: 140, steps: 8, swing: 0.3,
      chords: [[48,[60,64,67]],[41,[57,60,65]],[43,[55,59,62]],[48,[60,64,67]]],
      melody: [76,N,76,N,76,N,72,76, 79,N,N,N,67,N,N,N, 72,N,67,N,64,N,69,71, 70,69,67,72,76,77,N,N],
      lead: {type:'square',gain:0.18,pluck:8}, pad: {type:'triangle',gain:0.07,mode:'stab',steps:[1,3,5,7]},
      bass: {style:'oompah',gain:0.38}, arp: null,
      drums: {hat:[0,2,4,6],rim:[2,6]} },
    knowledge: { bpm: 132, steps: 8, swing: 0,
      chords: [[41,[57,60,65]],[41,[57,60,65]],[43,[55,58,62]],[41,[57,60,65]]],
      melody: [77,N,77,79,81,N,77,N, 74,N,77,N,72,N,N,N, 74,75,74,72,70,N,74,N, 77,N,74,N,65,N,N,N],
      lead: {type:'sawtooth',gain:0.13,len:1.0}, pad: {type:'triangle',gain:0.06,mode:'stab',steps:[0,2,4,6]},
      bass: {style:'oompah',gain:0.42}, arp: null,
      drums: {kick:[0,4],snare:[2,5,6],hat:[1,3,7]} },
    coop: { bpm: 126, steps: 8, swing: 0.18,
      chords: [[48,[60,64,67]],[43,[55,59,62]],[45,[57,60,64]],[41,[57,60,65]]],
      melody: [79,N,N,76,N,N,74,N, 76,N,74,N,71,N,N,N, 72,N,N,76,N,N,79,N, 81,N,79,N,76,N,N,N],
      lead: {type:'sine',gain:0.3,vibrato:true,len:1.4}, pad: null,
      bass: {style:'oompah',gain:0.3}, arp: {type:'triangle',gain:0.07},
      drums: {shaker16:true,rim:[4]} },
    puzzle: { bpm: 160, steps: 8, swing: 0,
      chords: [[33,[57,60,64]],[33,[57,60,64]],[29,[53,57,60]],[31,[55,59,62]]],
      melody: [N,N,69,N,N,72,N,71, N,N,69,N,67,N,64,N, N,N,65,N,N,69,N,67, N,N,71,N,72,N,74,N],
      lead: {type:'square',gain:0.15,pluck:10}, pad: {type:'sine',gain:0.07,mode:'sustain'},
      bass: {style:'riff16',gain:0.3}, arp: null,
      drums: {kick:[0,3,4],snare:[2,6],hat:[0,1,2,3,4,5,6,7],openhat:[5]} },
  };

  function getContext() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      const comp = ctx.createDynamicsCompressor();
      try { comp.threshold.value = -18; comp.ratio.value = 4; } catch (e) {}
      master = ctx.createGain();
      master.gain.value = BGM_VOLUME;
      master.connect(comp);
      comp.connect(ctx.destination);
    }
    return ctx;
  }

  function getNoise() {
    const c = getContext();
    if (!noiseBuf) {
      noiseBuf = c.createBuffer(1, c.sampleRate * 0.5, c.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return noiseBuf;
  }

  function saveState() {
    try {
      localStorage.setItem('bgm-on', on ? 'true' : 'false');
      sessionStorage.setItem('bgm-on', on ? 'true' : 'false');
    } catch (e) {}
  }

  function pitchMult() { return tension ? Math.pow(2, 1 / 12) : 1; }

  /* 음 하나: pluck(짧은 감쇠) 또는 sustain 엔벨로프, 비브라토 옵션 */
  function note(freq, time, dur, type, gain, opt) {
    opt = opt || {};
    const c = getContext();
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = freq * pitchMult();
    let stopAt = time + dur + 0.08;
    if (opt.vibrato) {
      const lfo = c.createOscillator();
      const lg = c.createGain();
      lfo.frequency.value = 5.5;
      lg.gain.value = freq * 0.012;
      lfo.connect(lg);
      lg.connect(o.frequency);
      lfo.start(time);
      lfo.stop(stopAt + 0.5);
    }
    const a = 0.012;
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(gain, time + a);
    if (opt.pluck) {
      const decay = Math.min(6.9 / opt.pluck, dur * 2 + 0.4);
      g.gain.exponentialRampToValueAtTime(0.001, time + a + decay);
      stopAt = time + a + decay + 0.05;
    } else {
      g.gain.setValueAtTime(gain, time + Math.max(a, dur * 0.6));
      g.gain.exponentialRampToValueAtTime(0.001, time + dur);
    }
    o.connect(g);
    g.connect(master);
    o.start(time);
    o.stop(stopAt);
  }

  /* 드럼 */
  function drumNoise(time, dur, gain, hp) {
    const c = getContext();
    const s = c.createBufferSource();
    s.buffer = getNoise();
    const f = c.createBiquadFilter();
    f.type = hp ? 'highpass' : 'lowpass';
    f.frequency.value = hp ? 6500 : 2200;
    const g = c.createGain();
    g.gain.setValueAtTime(gain, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(time, Math.random() * 0.3, dur + 0.02);
  }
  function kick(time) {
    const c = getContext();
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(120, time);
    o.frequency.exponentialRampToValueAtTime(42, time + 0.11);
    g.gain.setValueAtTime(0.5, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.13);
    o.connect(g); g.connect(master);
    o.start(time);
    o.stop(time + 0.15);
  }
  function snare(time) {
    drumNoise(time, 0.15, 0.25, false);
    note(190, time, 0.07, 'triangle', 0.18, { pluck: 40 });
  }

  function scheduler() {
    if (!on || !currentCategory) return;
    const song = SONGS[currentCategory] || SONGS.brain;
    const c = getContext();
    const stepDur = (60 / song.bpm) / 2 / (tension ? 1.25 : 1);
    const totalSteps = song.steps * song.chords.length;
    const barDur = stepDur * song.steps;

    while (nextTime < c.currentTime + 0.6) {
      const s = step % totalSteps;
      const bar = Math.floor(s / song.steps);
      const inBar = s % song.steps;
      const chord = song.chords[bar];
      // 스윙: 뒷박(홀수 스텝)을 살짝 뒤로
      const t = nextTime + ((s % 2 === 1) ? stepDur * (song.swing || 0) : 0);

      // 패드
      if (song.pad) {
        if (song.pad.mode === 'sustain' && inBar === 0) {
          for (let i = 0; i < chord[1].length; i++) {
            note(nf(chord[1][i]), t, barDur * 0.96, song.pad.type, song.pad.gain);
          }
        } else if (song.pad.mode === 'stab' && song.pad.steps.indexOf(inBar) !== -1) {
          for (let i = 0; i < chord[1].length; i++) {
            note(nf(chord[1][i]), t, stepDur * 0.9, song.pad.type, song.pad.gain, { pluck: 14 });
          }
        }
      }

      // 베이스
      if (song.bass.style === 'notes') {
        if (song.bass.steps.indexOf(inBar) !== -1) {
          note(nf(chord[0]), t, stepDur * 1.6, song.bass.type || 'sine', song.bass.gain);
        }
      } else if (song.bass.style === 'oompah') {
        if (inBar % 2 === 0) {
          const bn = (inBar % 4 === 0) ? chord[0] : chord[0] + 7;
          note(nf(bn), t, stepDur * 0.9, 'triangle', song.bass.gain, { pluck: 11 });
        }
      } else if (song.bass.style === 'riff16') {
        for (let h = 0; h < 2; h++) {
          const bn = (inBar + h) % 4 === 3 ? chord[0] + 12 : chord[0];
          note(nf(bn), t + h * stepDur / 2, stepDur * 0.42, 'square', song.bass.gain * 0.8, { pluck: 22 });
        }
      }

      // 아르페지오 (16분 코드톤)
      if (song.arp) {
        const tones = [chord[1][0], chord[1][1], chord[1][2], chord[1][0] + 12];
        for (let h = 0; h < 2; h++) {
          note(nf(tones[(inBar * 2 + h) % 4]), t + h * stepDur / 2, stepDur * 0.45, song.arp.type, song.arp.gain, { pluck: 18 });
        }
      }

      // 멜로디
      const m = song.melody[s];
      if (m !== null && m !== undefined) {
        note(nf(m), t, stepDur * (song.lead.len || 0.92), song.lead.type, song.lead.gain,
          { pluck: song.lead.pluck, vibrato: song.lead.vibrato });
      }

      // 드럼
      const d = song.drums || {};
      if ((d.kick || []).indexOf(inBar) !== -1) kick(t);
      if ((d.snare || []).indexOf(inBar) !== -1) snare(t);
      if ((d.hat || []).indexOf(inBar) !== -1) drumNoise(t, 0.05, 0.12, true);
      if ((d.openhat || []).indexOf(inBar) !== -1) drumNoise(t, 0.25, 0.1, true);
      if ((d.rim || []).indexOf(inBar) !== -1) note(820, t, 0.05, 'triangle', 0.16, { pluck: 60 });
      if (d.shaker16) {
        drumNoise(t, 0.05, 0.08, true);
        drumNoise(t + stepDur / 2, 0.05, 0.05, true);
      }

      nextTime += stepDur;
      step++;
    }
  }

  function startScheduler() {
    if (timerId) return;
    nextTime = getContext().currentTime + 0.1;
    step = 0;
    scheduler();
    timerId = setInterval(scheduler, 150);
  }

  function stopScheduler() {
    if (timerId) { clearInterval(timerId); timerId = null; }
  }

  // 브라우저 자동재생 정책: 첫 터치에서 컨텍스트 해제 후 시작
  function armUnlock() {
    if (unlockArmed) return;
    unlockArmed = true;
    function unlock() {
      document.removeEventListener('pointerdown', unlock, true);
      document.removeEventListener('touchstart', unlock, true);
      if (!on || !currentCategory) return;
      try {
        const c = getContext();
        if (c.state === 'suspended') c.resume();
        startScheduler();
      } catch (e) {}
    }
    document.addEventListener('pointerdown', unlock, true);
    document.addEventListener('touchstart', unlock, true);
  }

  // 페이지 종료 시 정리
  window.addEventListener('beforeunload', function () {
    stopScheduler();
    if (ctx) { try { ctx.close(); } catch (e) {} }
  });

  return {
    play(category) {
      currentCategory = category;
      if (!on) return;
      try {
        const c = getContext();
        if (c.state === 'suspended') {
          c.resume();
          armUnlock();
        }
        if (c.state === 'running') startScheduler();
        else armUnlock();
      } catch (e) {}
    },
    stop() {
      stopScheduler();
      if (master && ctx) {
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.setValueAtTime(0, ctx.currentTime);
        master.gain.linearRampToValueAtTime(BGM_VOLUME, ctx.currentTime + 0.6);
      }
    },
    toggle() {
      on = !on;
      saveState();
      if (on) {
        if (currentCategory) this.play(currentCategory);
      } else {
        this.stop();
      }
      return on;
    },
    isOn() { return on; },
    setTension(t) {
      tension = !!t;
    }
  };
}

/* ═══════════════════════════════════════════════════════════════
   군중 사운드 — 노이즈 합성 박수·드럼롤·심벌·환호 (자산 0byte)
   결과 화면·룰렛 당첨 등 "승리의 순간"을 풍성하게.
   전역 함수라 런처/게임 어디서든 호출 가능. 음소거 설정을 따른다.
   ═══════════════════════════════════════════════════════════════ */
var _FX = (function () {
  let ctx = null;
  let master = null;
  let noiseBuf = null;

  function get() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      const comp = ctx.createDynamicsCompressor();
      try { comp.threshold.value = -14; comp.ratio.value = 8; } catch (e) {}
      master = ctx.createGain();
      master.gain.value = 0.8;
      master.connect(comp);
      comp.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }
    return ctx;
  }

  function noise() {
    const c = get();
    if (!noiseBuf) {
      noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return noiseBuf;
  }

  function beep(freq, dur, type, gain, delay) {
    const c = get();
    const t = c.currentTime + (delay || 0);
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type || 'square';
    o.frequency.value = freq;
    g.gain.setValueAtTime(gain || 0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t);
    o.stop(t + dur + 0.03);
  }

  return { get: get, masterNode: function () { return master; }, noise: noise, beep: beep };
})();

function _soundEnabled() { return !_readSoundMuted(); }

/** 박수 갈채 — 랜덤 노이즈 버스트 다발 (우승 발표용) */
function playApplause(durationSec) {
  if (!_soundEnabled()) return;
  try {
    const c = _FX.get();
    const dur = durationSec || 1.6;
    const t0 = c.currentTime + 0.02;
    const n = Math.floor(dur * 30);
    for (let i = 0; i < n; i++) {
      const when = t0 + Math.pow(Math.random(), 0.75) * dur;
      const s = c.createBufferSource();
      s.buffer = _FX.noise();
      const f = c.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 700 + Math.random() * 2300;
      f.Q.value = 1.2;
      const g = c.createGain();
      const fade = 1 - (when - t0) / (dur * 1.35); // 끝으로 갈수록 잦아듦
      g.gain.setValueAtTime((0.04 + Math.random() * 0.09) * Math.max(fade, 0.15), when);
      g.gain.exponentialRampToValueAtTime(0.001, when + 0.05);
      s.connect(f); f.connect(g); g.connect(_FX.masterNode());
      s.start(when, Math.random() * 0.8, 0.06);
    }
  } catch (e) {}
}

/** 드럼롤 — 두구두구 (결과 공개 직전, 룰렛 스핀) */
function playDrumroll(durationSec) {
  if (!_soundEnabled()) return;
  try {
    const c = _FX.get();
    const dur = durationSec || 1.5;
    const t0 = c.currentTime + 0.02;
    for (let t = 0; t < dur; t += 0.038) {
      const s = c.createBufferSource();
      s.buffer = _FX.noise();
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 2600;
      const g = c.createGain();
      g.gain.setValueAtTime(0.05 + (t / dur) * 0.12, t0 + t); // 크레셴도
      g.gain.exponentialRampToValueAtTime(0.001, t0 + t + 0.035);
      s.connect(f); f.connect(g); g.connect(_FX.masterNode());
      s.start(t0 + t, Math.random() * 0.8, 0.04);
    }
  } catch (e) {}
}

/** 심벌 — 챙! (당첨/공개 순간) */
function playCymbal() {
  if (!_soundEnabled()) return;
  try {
    const c = _FX.get();
    const t = c.currentTime + 0.02;
    const s = c.createBufferSource();
    s.buffer = _FX.noise();
    const f = c.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 5500;
    const g = c.createGain();
    g.gain.setValueAtTime(0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
    s.connect(f); f.connect(g); g.connect(_FX.masterNode());
    s.start(t, 0, 1.3);
  } catch (e) {}
}

/** 환호 — 와아~ (필터 스윕 노이즈, 협력 성공 등) */
function playCheer() {
  if (!_soundEnabled()) return;
  try {
    const c = _FX.get();
    const t = c.currentTime + 0.05;
    const s = c.createBufferSource();
    s.buffer = _FX.noise();
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 2;
    f.frequency.setValueAtTime(320, t);
    f.frequency.linearRampToValueAtTime(950, t + 0.5);
    f.frequency.linearRampToValueAtTime(550, t + 1.0);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.22, t + 0.18);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
    s.connect(f); f.connect(g); g.connect(_FX.masterNode());
    s.start(t, 0, 1.2);
  } catch (e) {}
}

/**
 * 게임 폴더명 → 카테고리 매핑 (BGM 분위기 결정용)
 * 런처 index.html의 CATEGORY_MAP과 동기화 유지
 */
const _GAME_CATEGORY_MAP = {
  'reaction-race': 'speed', 'balloon-pop': 'speed', 'rps-react': 'speed', 'chase-tap': 'speed', 'odd-color': 'speed',
  'simon-says': 'speed', 'stop-bar': 'speed',
  'find-diff': 'brain', 'spelling-quiz': 'knowledge',
  'half-match': 'coop', 'telepathy': 'coop', 'emoji-clue': 'coop', 'sokoban': 'puzzle',
  'color-touch': 'brain', 'shadow-match': 'brain',
  'dots-and-boxes': 'brain', 'memory-match': 'brain', 'nim-game': 'brain', 'odd-one-out': 'brain', 'pattern-next': 'brain', 'relation-match': 'brain',
  'quick-math': 'math', 'size-compare': 'math', 'color-count': 'math',
  'number-tap': 'math', 'clock-reading': 'math', 'math-sign': 'math', 'area-compare': 'math', 'dice-sum': 'math',
  'ox-quiz': 'knowledge', 'initial-quiz': 'knowledge',
  'flag-quiz': 'knowledge', 'proverb-quiz': 'knowledge', 'english-word': 'knowledge',
  'animal-sort': 'knowledge', 'hangul-jamo': 'knowledge', 'opposite-word': 'knowledge', 'sum-relay': 'coop', 'jamo-merge': 'coop', 'memory-relay': 'coop',
  'slide-puzzle': 'puzzle', 'maze-run': 'puzzle', 'pipe-connect': 'puzzle',
  'dot-connect': 'puzzle',
  'fold-guess': 'puzzle', 'hanoi': 'puzzle',
  'arrow-tap': 'speed',
  'missing-piece': 'brain', 'mirror-match': 'brain',
  'skip-count': 'math', 'more-or-less': 'math', 'number-bond': 'math', 'coin-count': 'math',
  'job-tool': 'knowledge', 'unit-noun': 'knowledge', 'synonym-quiz': 'knowledge', 'capital-quiz': 'knowledge',
  'direction-relay': 'coop', 'color-mix': 'coop',
  'arrow-rotate': 'puzzle',
  'high-low': 'speed',
  'feature-hunt': 'speed',
  'even-odd': 'speed',
  'pitch-compare': 'speed',
  'beep-count': 'speed',
  'running-sum': 'speed',
  'word-scramble': 'brain',
  'closest-number': 'math',
  'fraction-match': 'math',
  'number-line': 'math',
  'make-ten': 'math',
  'hundred-chart': 'math',
  'word-reveal': 'knowledge',
  'season-match': 'knowledge',
  'trash-sort': 'knowledge',
  'chain-calc': 'coop',
  'ice-slide': 'puzzle',
  'magic-square': 'puzzle',
  };

function _detectGameCategory() {
  const m = location.pathname.match(/\/games\/([^/]+)\//);
  return m ? (_GAME_CATEGORY_MAP[m[1]] || 'brain') : 'brain';
}

/**
 * BGM 토글 버튼 자동 주입 (모든 게임 페이지에 표시)
 * 좌하단 떠다니는 작은 버튼. 카테고리 자동 감지.
 * v5: 기본 ON (작은 볼륨) — 끄면 localStorage에 기억됨.
 */
let _bgm = null;
function _injectBgmToggle() {
  // 게임 페이지인지 확인
  if (!/\/games\//.test(location.pathname)) return;
  if (document.getElementById('bgmToggleBtn')) return;

  if (!_bgm) _bgm = createBgmManager();
  const category = _detectGameCategory();
  _bgm.play(category);

  const btn = document.createElement('button');
  btn.id = 'bgmToggleBtn';
  btn.className = 'bgm-toggle-fab';
  btn.setAttribute('aria-label', '배경음악 토글');
  function updateIcon() {
    btn.textContent = _bgm.isOn() ? '🎵' : '🎵̸';
    btn.classList.toggle('bgm-on', _bgm.isOn());
  }
  updateIcon();
  btn.addEventListener('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
    _bgm.toggle();
    updateIcon();
  }, false);

  // CSS 자동 주입 (한 번만)
  if (!document.getElementById('bgmToggleStyle')) {
    const style = document.createElement('style');
    style.id = 'bgmToggleStyle';
    style.textContent = `
      .bgm-toggle-fab {
        position: fixed;
        bottom: 14px;
        left: 14px;
        z-index: 9000;
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: #fff;
        border: 3px solid #2C2C2C;
        box-shadow: 3px 3px 0 #2C2C2C;
        cursor: pointer;
        font-size: 1.2rem;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        line-height: 1;
        opacity: 0.6;
        transition: opacity 0.15s, background 0.15s, transform 0.1s;
        -webkit-tap-highlight-color: transparent;
      }
      .bgm-toggle-fab:hover { opacity: 1; }
      .bgm-toggle-fab:active { transform: translate(2px, 2px); box-shadow: 1px 1px 0 #2C2C2C; }
      .bgm-toggle-fab.bgm-on {
        background: #FFD54F;
        opacity: 1;
        animation: bgmPulse 1.4s ease-in-out infinite alternate;
      }
      @keyframes bgmPulse {
        from { box-shadow: 3px 3px 0 #2C2C2C; }
        to   { box-shadow: 3px 3px 0 #2C2C2C, 0 0 0 4px rgba(255,213,79,0.4); }
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(btn);
}

/* ═══════════════════════════════════════════════════════════════
   상황 반응형 오디오 자동 연결 (게임 코드 무수정 — DOM 감지 방식)
   - 카운트다운 3·2·1 삑 + 게임 시작 GO! 스팅거
   - 결과 화면 진입 → 박수 갈채 + 환호
   - 타이머 임박(.danger) → 째깍음 + BGM 긴장 모드(템포·피치 상승)
   ═══════════════════════════════════════════════════════════════ */
function _initAutoFx() {
  if (!/\/games\//.test(location.pathname)) return;

  let sawCountdown = false;
  let resultApplauded = false;
  let lastBeepText = '';

  function cdBeep(text) {
    text = (text || '').trim();
    if (!text || text === lastBeepText) return;
    lastBeepText = text;
    if (!_soundEnabled()) return;
    _FX.beep(740, 0.09, 'square', 0.1);
  }

  function goSting() {
    if (!_soundEnabled()) return;
    _FX.beep(659, 0.1, 'square', 0.1, 0);
    _FX.beep(880, 0.12, 'square', 0.11, 0.09);
    _FX.beep(1318, 0.25, 'triangle', 0.13, 0.18);
  }

  const mo = new MutationObserver(function (muts) {
    for (let i = 0; i < muts.length; i++) {
      const m = muts[i];
      const el = m.target.nodeType === 1 ? m.target : m.target.parentElement;
      if (!el) continue;

      if (m.type === 'attributes') {
        const cl = el.classList;
        if (!cl) continue;
        if (cl.contains('screen-countdown') && cl.contains('active')) {
          sawCountdown = true;
          lastBeepText = '';
          const num = el.querySelector('.countdown-number');
          if (num) cdBeep(num.textContent);
        } else if (cl.contains('screen-game') && cl.contains('active') && sawCountdown) {
          sawCountdown = false;
          goSting();
        } else if (cl.contains('screen-result')) {
          if (cl.contains('active')) {
            if (!resultApplauded) {
              resultApplauded = true;
              setTimeout(function () { playApplause(1.8); playCheer(); }, 250);
            }
          } else {
            resultApplauded = false;
          }
        }
      } else if (sawCountdown) {
        // 카운트다운 숫자 텍스트 변경 감지 (3 → 2 → 1)
        const cd = document.querySelector('.screen-countdown.active .countdown-number');
        if (cd && (m.target === cd || cd.contains(m.target))) cdBeep(cd.textContent);
      }
    }
  });

  if (document.body) {
    mo.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
      childList: true,
      characterData: true
    });
  }

  // 타이머 임박(.danger) 감지 → 째깍음 + BGM 긴장 모드
  setInterval(function () {
    try {
      const danger = !!document.querySelector('.danger');
      if (_bgm && _bgm.setTension) _bgm.setTension(danger);
      if (danger && document.querySelector('.screen-game.active') && _soundEnabled()) {
        _FX.beep(1560, 0.045, 'square', 0.045);
      }
    } catch (e) {}
  }, 1000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function () {
    _injectBgmToggle();
    _initAutoFx();
  });
} else {
  _injectBgmToggle();
  _initAutoFx();
}

/**
 * 클릭 + 터치 통합 핸들러
 * 300ms 딜레이 없이 즉시 반응
 * @param {HTMLElement} element
 * @param {function} callback
 */
function onTap(element, callback) {
  let touched = false;

  element.addEventListener('touchstart', function(e) {
    touched = true;
    e.preventDefault();
    callback(e);
  }, { passive: false });

  element.addEventListener('click', function(e) {
    if (!touched) {
      callback(e);
    }
    touched = false;
  });
}

/**
 * 자동 모드 검증용 빠른 라운드 사이 대기 시간.
 * URL에 ?autoplay=1 가 있으면 50ms (시뮬 가속), 아니면 defaultMs 그대로.
 * 신규 게임의 RESULT_PAUSE_MS는 이 헬퍼로 작성하면 자동 모드 검증이 ~5배 빨라진다.
 * 평소 사용자 플레이는 영향 없음.
 */
function getAutoplayPauseMs(defaultMs) {
  try {
    if (new URLSearchParams(location.search).get('autoplay') === '1') return 50;
  } catch (e) {}
  return defaultMs;
}
