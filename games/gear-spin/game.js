/* games/gear-spin/game.js */

'use strict';

// ── Constants ────────────────────────────────────────────────
const GS_TOTAL_ROUNDS    = 8;
const GS_ROUND_TIME      = 12;
const GS_RESULT_PAUSE_MS = getAutoplayPauseMs(2000);

// Player config
const GS_PLAYER_CONFIG = [
  { label: 'P1', dot: '#0288D1', cls: 'p1' },
  { label: 'P2', dot: '#E53935', cls: 'p2' },
  { label: 'P3', dot: '#388E3C', cls: 'p3' },
  { label: 'P4', dot: '#F57C00', cls: 'p4' },
];

// 라운드별 설정: [톱니 개수, 분기 있음여부]
// 분기: 한 톱니에 두 톱니가 물림 (6라운드 이상)
// gearCount: 체인에 있는 톱니 수 (분기 없을 때는 선형)
// branch: true이면 중간 어딘가에서 하나 추가 분기 (★는 분기 끝)
const GS_ROUND_CONFIG = [
  { gearCount: 3, branch: false },   // R1
  { gearCount: 3, branch: false },   // R2
  { gearCount: 4, branch: false },   // R3
  { gearCount: 4, branch: false },   // R4
  { gearCount: 5, branch: false },   // R5
  { gearCount: 5, branch: true  },   // R6
  { gearCount: 6, branch: true  },   // R7
  { gearCount: 6, branch: true  },   // R8
];

// ── Sound Manager ────────────────────────────────────────────
const gsSound = createSoundManager({
  ding(ctx) {
    [523, 659, 784].forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine';
      const t = ctx.currentTime + i * 0.09;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
      osc.start(t); osc.stop(t + 0.32);
    });
  },
  buzz(ctx) {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.28);
    gain.gain.setValueAtTime(0.45, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.32);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.32);
  },
  timeout(ctx) {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160, ctx.currentTime);
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.5);
  },
  tick(ctx) {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'square';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.08);
  },
  fanfare(ctx) {
    [392, 494, 523, 659, 784].forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'triangle';
      const t = ctx.currentTime + i * 0.12;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
      osc.start(t); osc.stop(t + 0.38);
    });
  },
});

// ── State ────────────────────────────────────────────────────
let gsPlayerCount   = 2;
let gsRoundIdx      = 0;
let gsScores        = [];
let gsRoundLog      = [];
let gsDqSet         = new Set();
let gsPhase         = 'idle';
let gsTimerHandle   = null;
let gsNextHandle    = null;
let gsTimeRemaining = GS_ROUND_TIME;

// Current round state
let gsFirstDir      = 1;   // 1 = clockwise (↻), -1 = counterclockwise (↺)
let gsAnswerDir     = 1;   // direction of the ★ gear

// ── DOM refs ─────────────────────────────────────────────────
const gsIntroScreen     = document.getElementById('introScreen');
const gsCountdownScreen = document.getElementById('countdownScreen');
const gsCountdownNumber = document.getElementById('countdownNumber');
const gsGameScreen      = document.getElementById('gameScreen');
const gsResultScreen    = document.getElementById('resultScreen');

const gsBackBtn     = document.getElementById('backBtn');
const gsPlayBtn     = document.getElementById('playBtn');
const gsCloseBtn    = document.getElementById('closeBtn');
const gsRetryBtn    = document.getElementById('retryBtn');
const gsHomeBtn     = document.getElementById('homeBtn');

const gsZonesWrap   = document.getElementById('zonesWrap');
const gsQCounter    = document.getElementById('questionCounter');
const gsProbTimer   = document.getElementById('problemTimer');
const gsProbStatus  = document.getElementById('problemStatus');
const gsScoreBar    = document.getElementById('scoreBar');
const gsGearPanel   = document.getElementById('gearPanel');

const gsSoundToggle = document.getElementById('soundToggleIntro');
const gsIntroIllust = document.getElementById('introIllust');

const gsResultTitle = document.getElementById('resultTitle');
const gsResultWinner= document.getElementById('resultWinner');
const gsResultTHead = document.getElementById('resultTableHead');
const gsResultTBody = document.getElementById('resultTableBody');
const gsTotalRow    = document.getElementById('totalRow');

// ── Helpers ──────────────────────────────────────────────────
function gsShowScreen(s) {
  [gsIntroScreen, gsCountdownScreen, gsGameScreen, gsResultScreen].forEach(x => x.classList.remove('active'));
  s.classList.add('active');
}

var gsCdInterval = null;
function gsStartCountdown(onDone) {
  gsShowScreen(gsCountdownScreen);
  var count = 3;
  gsCountdownNumber.textContent = count;
  gsCdInterval = setInterval(function() {
    count--;
    if (count <= 0) {
      clearInterval(gsCdInterval); gsCdInterval = null;
      onDone();
    } else {
      gsCountdownNumber.textContent = count;
      gsCountdownNumber.style.animation = 'none';
      gsCountdownNumber.offsetHeight;
      gsCountdownNumber.style.animation = '';
    }
  }, 1000);
}

function gsClearTimers() {
  if (gsCdInterval)  { clearInterval(gsCdInterval);  gsCdInterval  = null; }
  if (gsTimerHandle) { clearInterval(gsTimerHandle); gsTimerHandle = null; }
  if (gsNextHandle)  { clearTimeout(gsNextHandle);   gsNextHandle  = null; }
}

function gsUpdateSoundBtn(btn) {
  btn.textContent = gsSound.isMuted() ? '🔇' : '🔊';
}

// ── Gear SVG builder ──────────────────────────────────────────
// Draws a simple gear: circle with rectangular teeth around it
function gsBuildGearSVG(size, teethCount, strokeColor, strokeWidth, fillColor) {
  const r     = size * 0.36;    // inner radius
  const rOuter= size * 0.48;    // outer (tooth tip) radius
  const toothW= (2 * Math.PI * r / teethCount) * 0.38; // tooth angular half-width in radians
  const cx    = size / 2;
  const cy    = size / 2;

  let pathD = '';
  for (let i = 0; i < teethCount; i++) {
    const angleStart = (2 * Math.PI * i / teethCount) - toothW;
    const angleEnd   = (2 * Math.PI * i / teethCount) + toothW;
    const angleGapStart = angleEnd;
    const angleGapEnd   = (2 * Math.PI * (i + 1) / teethCount) - toothW;

    // Tooth tip (outer)
    const x1 = cx + rOuter * Math.cos(angleStart);
    const y1 = cy + rOuter * Math.sin(angleStart);
    const x2 = cx + rOuter * Math.cos(angleEnd);
    const y2 = cy + rOuter * Math.sin(angleEnd);

    // Gap (inner)
    const x3 = cx + r * Math.cos(angleGapEnd);
    const y3 = cy + r * Math.sin(angleGapEnd);
    const x4 = cx + r * Math.cos(angleGapStart);
    const y4 = cy + r * Math.sin(angleGapStart);

    if (i === 0) {
      pathD += `M ${x1} ${y1} `;
    } else {
      pathD += `L ${x1} ${y1} `;
    }
    pathD += `L ${x2} ${y2} `;
    pathD += `L ${x3} ${y3} `;
    pathD += `L ${x4} ${y4} `;
  }
  pathD += 'Z';

  // Center hole
  const holeR = size * 0.10;

  return `<svg class="gear-svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <g>
      <path d="${pathD}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linejoin="round"/>
      <circle cx="${cx}" cy="${cy}" r="${holeR}" fill="#FFF8E1" stroke="${strokeColor}" stroke-width="${strokeWidth * 0.7}"/>
    </g>
  </svg>`;
}

// ── Round generation ──────────────────────────────────────────
// Compute direction of star gear given chain structure
// Linear chain: gear[i] direction = firstDir * (-1)^i
// Branch: mainChain[0..branchAt] then extra gear attached at branchAt
//   extra gear direction = -mainChain[branchAt] direction

function gsComputeAnswer(cfg, firstDir) {
  // Linear: last gear index = gearCount - 1
  // direction = firstDir * (-1)^(gearCount-1)
  const lastIdx = cfg.gearCount - 1;
  return firstDir * (lastIdx % 2 === 0 ? 1 : -1);
}

function gsComputeBranchAnswer(cfg, firstDir, branchAt) {
  // branchAt: index in main chain where branch is attached
  // extra gear is attached at branchAt (in parallel)
  // extra gear direction = opposite of main chain gear at branchAt
  const mainDirAtBranch = firstDir * (branchAt % 2 === 0 ? 1 : -1);
  // The extra gear (★) direction is opposite to its parent
  return -mainDirAtBranch;
}

function gsRenderGearPanel(cfg) {
  gsGearPanel.innerHTML = '';

  const firstDir = Math.random() < 0.5 ? 1 : -1;
  gsFirstDir = firstDir;

  const gearSize  = Math.max(36, Math.min(52, Math.floor(300 / cfg.gearCount)));
  const teethCount= cfg.gearCount <= 4 ? 10 : 8;

  // Gear fill & stroke: all same grey, first=blue border, star=gold border
  const normalFill   = '#B0BEC5';
  const normalStroke = '#546E7A';
  const firstStroke  = '#0288D1';
  const starStroke   = '#F9A825';

  if (!cfg.branch) {
    // Linear chain
    const lastIdx = cfg.gearCount - 1;
    gsAnswerDir = gsComputeAnswer(cfg, firstDir);

    for (let i = 0; i < cfg.gearCount; i++) {
      if (i > 0) {
        const arrow = document.createElement('div');
        arrow.className = 'gear-arrow';
        arrow.textContent = '⚙';
        gsGearPanel.appendChild(arrow);
      }

      const wrap = document.createElement('div');
      wrap.className = 'gear-wrap';

      const stroke = i === 0 ? firstStroke : (i === lastIdx ? starStroke : normalStroke);
      const isFirst = i === 0;
      const isStar  = i === lastIdx;

      // SVG
      const svgStr = gsBuildGearSVG(gearSize, teethCount, stroke, isFirst ? 3 : (isStar ? 3 : 2), normalFill);
      const svgContainer = document.createElement('div');
      svgContainer.innerHTML = svgStr;
      const svgEl = svgContainer.firstChild;

      // Apply rotation animation to first gear only
      if (isFirst) {
        const gEl = svgEl.querySelector('g');
        if (gEl) {
          gEl.style.transformOrigin = `${gearSize / 2}px ${gearSize / 2}px`;
          gEl.style.animation = firstDir === 1
            ? `gear-cw 1.8s linear infinite`
            : `gear-ccw 1.8s linear infinite`;
        }
      }

      wrap.appendChild(svgEl);

      if (isFirst) {
        const lbl = document.createElement('div');
        lbl.className = 'gear-dir-label';
        lbl.textContent = firstDir === 1 ? '↻ 시계방향' : '↺ 반시계방향';
        wrap.appendChild(lbl);
      }
      if (isStar) {
        const lbl = document.createElement('div');
        lbl.className = 'gear-dir-label';
        lbl.textContent = '⭐';
        wrap.appendChild(lbl);
      }

      gsGearPanel.appendChild(wrap);
    }
  } else {
    // Branch: main chain of (gearCount-1) gears, then one branch gear at a random middle position
    // branchAt = random position in [1, gearCount-3]
    const mainCount = cfg.gearCount - 1;
    const branchAt  = 1 + Math.floor(Math.random() * Math.max(1, mainCount - 2));
    gsAnswerDir = gsComputeBranchAnswer(cfg, firstDir, branchAt);

    // Layout: main chain horizontally, branch gear below the branchAt gear
    // For simplicity, render as: main[0]..main[branchAt]↓branch, main[branchAt]..main[mainCount-1]
    // We'll render all in one row: main gears, and note branch visually

    // Render main chain and indicate branch
    const mainContainer = document.createElement('div');
    mainContainer.style.cssText = 'display:flex;align-items:center;gap:4px;flex-wrap:nowrap;';

    for (let i = 0; i < mainCount; i++) {
      if (i > 0) {
        const arrow = document.createElement('div');
        arrow.className = 'gear-arrow';
        arrow.textContent = '⚙';
        mainContainer.appendChild(arrow);
      }

      const wrap = document.createElement('div');
      wrap.className = 'gear-wrap';
      wrap.style.position = 'relative';

      const isFirst = i === 0;
      const stroke = isFirst ? firstStroke : normalStroke;
      const svgStr = gsBuildGearSVG(gearSize, teethCount, stroke, isFirst ? 3 : 2, normalFill);
      const svgContainer = document.createElement('div');
      svgContainer.innerHTML = svgStr;
      const svgEl = svgContainer.firstChild;

      if (isFirst) {
        const gEl = svgEl.querySelector('g');
        if (gEl) {
          gEl.style.transformOrigin = `${gearSize / 2}px ${gearSize / 2}px`;
          gEl.style.animation = firstDir === 1
            ? `gear-cw 1.8s linear infinite`
            : `gear-ccw 1.8s linear infinite`;
        }
      }

      wrap.appendChild(svgEl);

      if (isFirst) {
        const lbl = document.createElement('div');
        lbl.className = 'gear-dir-label';
        lbl.textContent = firstDir === 1 ? '↻ 시계방향' : '↺ 반시계방향';
        wrap.appendChild(lbl);
      }

      // Branch gear below branchAt gear
      if (i === branchAt) {
        const branchWrap = document.createElement('div');
        branchWrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:2px;';

        // Branch connection indicator
        const connLbl = document.createElement('div');
        connLbl.className = 'gear-dir-label';
        connLbl.style.fontSize = '0.55rem';
        connLbl.textContent = '↕';
        branchWrap.appendChild(connLbl);

        // Branch (star) gear
        const starSvgStr = gsBuildGearSVG(gearSize, teethCount, starStroke, 3, normalFill);
        const starContainer = document.createElement('div');
        starContainer.innerHTML = starSvgStr;
        branchWrap.appendChild(starContainer.firstChild);

        const starLbl = document.createElement('div');
        starLbl.className = 'gear-dir-label';
        starLbl.textContent = '⭐';
        branchWrap.appendChild(starLbl);

        wrap.appendChild(branchWrap);
      }

      mainContainer.appendChild(wrap);
    }

    gsGearPanel.appendChild(mainContainer);
  }
}

// ── Timer ────────────────────────────────────────────────────
function gsStartRoundTimer() {
  gsTimeRemaining = GS_ROUND_TIME;
  gsProbTimer.textContent = gsTimeRemaining;
  gsProbTimer.classList.remove('urgent');

  gsTimerHandle = setInterval(function() {
    gsTimeRemaining--;
    gsProbTimer.textContent = gsTimeRemaining;
    if (gsTimeRemaining <= 3) {
      gsProbTimer.classList.add('urgent');
      gsSound.play('tick');
    }
    if (gsTimeRemaining <= 0) {
      gsClearTimers();
      gsHandleTimeout();
    }
  }, 1000);
}

// ── Choice handler ────────────────────────────────────────────
function gsHandleChoiceTap(playerIdx, chosenDir, btn) {
  if (gsPhase !== 'active') return;
  if (gsDqSet.has(playerIdx)) return;

  if (chosenDir === gsAnswerDir) {
    gsResolveRound(playerIdx);
  } else {
    gsSound.play('buzz');
    btn.classList.add('state-wrong');

    gsDqSet.add(playerIdx);
    const zone = gsGetZone(playerIdx);
    const flash = document.createElement('div');
    flash.className = 'penalty-flash';
    flash.textContent = '실격!';
    zone.appendChild(flash);
    flash.addEventListener('animationend', function() { flash.remove(); });

    gsDisablePlayerBtns(playerIdx);
    zone.classList.add('dq-zone');

    let anyActive = false;
    for (let i = 0; i < gsPlayerCount; i++) {
      if (!gsDqSet.has(i)) { anyActive = true; break; }
    }
    if (!anyActive) {
      gsClearTimers();
      gsNextHandle = setTimeout(gsHandleTimeout, 300);
    }
  }
}

function gsResolveRound(winnerIdx) {
  gsPhase = 'done';
  gsClearTimers();
  gsSound.play('ding');

  gsScores[winnerIdx]++;
  gsUpdateScoreChip(winnerIdx);
  gsUpdateBarScore(winnerIdx);

  gsMarkAnswerBtns(winnerIdx, 'correct');
  for (let i = 0; i < gsPlayerCount; i++) {
    if (i !== winnerIdx) gsDisablePlayerBtns(i);
  }

  const wLabel = GS_PLAYER_CONFIG[winnerIdx].label;
  const dirLabel = gsAnswerDir === 1 ? '↻ 시계방향' : '↺ 반시계방향';
  gsProbStatus.textContent = `${wLabel} 정답! (${dirLabel})`;

  gsRoundLog.push({ firstDir: gsFirstDir, answerDir: gsAnswerDir, winnerIdx, dqPlayers: [...gsDqSet], timedOut: false });
  gsNextHandle = setTimeout(gsNextRound, GS_RESULT_PAUSE_MS);
}

function gsHandleTimeout() {
  gsPhase = 'done';
  gsClearTimers();
  gsSound.play('timeout');

  for (let i = 0; i < gsPlayerCount; i++) {
    gsMarkAnswerBtns(i, 'reveal');
  }
  const dirLabel = gsAnswerDir === 1 ? '↻ 시계방향' : '↺ 반시계방향';
  gsProbStatus.textContent = `정답은 ${dirLabel}!`;

  gsRoundLog.push({ firstDir: gsFirstDir, answerDir: gsAnswerDir, winnerIdx: -1, dqPlayers: [...gsDqSet], timedOut: true });
  gsNextHandle = setTimeout(gsNextRound, GS_RESULT_PAUSE_MS);
}

function gsMarkAnswerBtns(playerIdx, state) {
  const wrap = document.getElementById(`gs-btns-${playerIdx}`);
  if (!wrap) return;
  wrap.querySelectorAll('.dir-btn').forEach(function(btn) {
    const d = parseInt(btn.dataset.dir, 10);
    if (d === gsAnswerDir) {
      btn.classList.remove('state-disabled');
      if (state === 'correct') btn.classList.add('state-correct');
      else if (state === 'reveal') btn.classList.add('state-reveal');
    } else {
      btn.classList.add('state-disabled');
      btn.disabled = true;
    }
  });
}

function gsDisablePlayerBtns(playerIdx) {
  const wrap = document.getElementById(`gs-btns-${playerIdx}`);
  if (!wrap) return;
  wrap.querySelectorAll('.dir-btn').forEach(function(btn) {
    btn.classList.add('state-disabled');
    btn.disabled = true;
  });
}

function gsGetZone(idx) {
  return gsZonesWrap.querySelector(`.zone[data-player="${idx}"]`);
}

function gsUpdateScoreChip(playerIdx) {
  const chip = document.getElementById(`gs-score-chip-${playerIdx}`);
  if (chip) chip.textContent = `${gsScores[playerIdx]}점`;
}

function gsUpdateBarScore(playerIdx) {
  const el = document.getElementById(`gs-bar-score-${playerIdx}`);
  if (el) el.textContent = gsScores[playerIdx];
}

// ── Build zones ───────────────────────────────────────────────
function gsBuildZones() {
  gsZonesWrap.innerHTML = '';
  gsZonesWrap.className = `zones-wrap p${gsPlayerCount}`;

  for (let i = 0; i < gsPlayerCount; i++) {
    const cfg  = GS_PLAYER_CONFIG[i];
    const zone = document.createElement('div');
    zone.className = `zone ${cfg.cls}`;
    zone.dataset.player = i;

    const header = document.createElement('div');
    header.className = 'zone-header';
    header.innerHTML = `
      <span class="zone-label">${cfg.label}</span>
      <span class="zone-score-chip" id="gs-score-chip-${i}">0점</span>
    `;

    const hint = document.createElement('div');
    hint.className = 'zone-hint';
    hint.textContent = '⭐ 톱니 방향 선택!';

    const btns = document.createElement('div');
    btns.className = 'dir-btns';
    btns.id = `gs-btns-${i}`;

    // ↻ clockwise
    const btnCw = document.createElement('button');
    btnCw.className = 'dir-btn';
    btnCw.dataset.player = String(i);
    btnCw.dataset.dir = '1';
    btnCw.innerHTML = `<span class="dir-arrow">↻</span><span class="dir-text">시계방향</span>`;
    onTap(btnCw, function() { gsHandleChoiceTap(i, 1, btnCw); });

    // ↺ counter-clockwise
    const btnCcw = document.createElement('button');
    btnCcw.className = 'dir-btn';
    btnCcw.dataset.player = String(i);
    btnCcw.dataset.dir = '-1';
    btnCcw.innerHTML = `<span class="dir-arrow">↺</span><span class="dir-text">반시계방향</span>`;
    onTap(btnCcw, function() { gsHandleChoiceTap(i, -1, btnCcw); });

    btns.appendChild(btnCw);
    btns.appendChild(btnCcw);

    zone.appendChild(header);
    zone.appendChild(hint);
    zone.appendChild(btns);
    gsZonesWrap.appendChild(zone);
  }
}

function gsBuildScoreBar() {
  gsScoreBar.innerHTML = '';
  for (let i = 0; i < gsPlayerCount; i++) {
    const cfg  = GS_PLAYER_CONFIG[i];
    const chip = document.createElement('div');
    chip.className = 'score-chip';
    chip.innerHTML = `
      <span class="score-chip-dot" style="background:${cfg.dot}"></span>
      <span>${cfg.label}</span>
      <span class="score-chip-val" id="gs-bar-score-${i}">0</span>
    `;
    gsScoreBar.appendChild(chip);
  }
}

function gsResetZoneBtns() {
  for (let i = 0; i < gsPlayerCount; i++) {
    const zone = gsGetZone(i);
    if (zone) zone.classList.remove('dq-zone');
    const wrap = document.getElementById(`gs-btns-${i}`);
    if (!wrap) continue;
    wrap.querySelectorAll('.dir-btn').forEach(function(btn) {
      btn.className = 'dir-btn';
      btn.disabled = false;
    });
  }
}

// ── Intro illust ──────────────────────────────────────────────
function gsRenderIntroIllust() {
  gsIntroIllust.innerHTML = `<svg viewBox="0 0 220 130" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="6" width="208" height="118" rx="16" fill="#FFF8E1" stroke="#2C2C2C" stroke-width="3"/>
    <circle cx="60" cy="65" r="28" fill="#B0BEC5" stroke="#0288D1" stroke-width="3"/>
    <circle cx="60" cy="65" r="7" fill="#FFF8E1" stroke="#546E7A" stroke-width="2"/>
    <circle cx="120" cy="65" r="28" fill="#B0BEC5" stroke="#546E7A" stroke-width="2"/>
    <circle cx="120" cy="65" r="7" fill="#FFF8E1" stroke="#546E7A" stroke-width="2"/>
    <circle cx="180" cy="65" r="28" fill="#B0BEC5" stroke="#F9A825" stroke-width="3"/>
    <circle cx="180" cy="65" r="7" fill="#FFF8E1" stroke="#546E7A" stroke-width="2"/>
    <text x="60" y="22" text-anchor="middle" font-size="11" font-weight="900" fill="#0288D1">↻</text>
    <text x="180" y="22" text-anchor="middle" font-size="11" font-weight="900" fill="#F9A825">⭐?</text>
  </svg>`;
}
gsRenderIntroIllust();

// ── Player count selection ────────────────────────────────────
document.querySelectorAll('.player-btn').forEach(function(btn) {
  onTap(btn, function() {
    document.querySelectorAll('.player-btn').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    gsPlayerCount = parseInt(btn.dataset.count, 10);
  });
});

// ── Sound toggle ──────────────────────────────────────────────
onTap(gsSoundToggle, function() {
  gsSound.toggleMute();
  gsUpdateSoundBtn(gsSoundToggle);
});
gsUpdateSoundBtn(gsSoundToggle);

// ── Navigation ────────────────────────────────────────────────
onTap(gsBackBtn,  function() { goHome(); });
onTap(gsCloseBtn, function() { gsClearTimers(); goHome(); });
onTap(gsHomeBtn,  function() { goHome(); });
onTap(gsRetryBtn, function() { gsStartCountdown(function() { gsStartGame(); }); });
onTap(gsPlayBtn,  function() { gsStartCountdown(function() { gsStartGame(); }); });

// ── Start game ────────────────────────────────────────────────
function gsStartGame() {
  gsRoundIdx    = 0;
  gsScores      = new Array(gsPlayerCount).fill(0);
  gsRoundLog    = [];
  gsDqSet       = new Set();
  gsPhase       = 'idle';

  gsClearTimers();
  gsBuildZones();
  gsBuildScoreBar();
  gsShowScreen(gsGameScreen);
  gsLoadRound();
}

function gsLoadRound() {
  gsDqSet = new Set();
  gsQCounter.textContent = `${gsRoundIdx + 1} / ${GS_TOTAL_ROUNDS}`;
  gsProbStatus.textContent = '';
  gsProbTimer.classList.remove('urgent');
  gsProbTimer.textContent = GS_ROUND_TIME;
  gsPhase = 'active';

  gsResetZoneBtns();
  gsRenderGearPanel(GS_ROUND_CONFIG[gsRoundIdx]);
  gsStartRoundTimer();
}

function gsNextRound() {
  gsRoundIdx++;
  if (gsRoundIdx >= GS_TOTAL_ROUNDS) {
    gsShowResult();
  } else {
    gsLoadRound();
  }
}

// ── Result ────────────────────────────────────────────────────
function gsShowResult() {
  gsClearTimers();
  gsPhase = 'idle';
  gsSound.play('fanfare');

  const maxScore = Math.max(...gsScores);
  const winners  = gsScores.map(function(s, i) { return { s, i }; }).filter(function(x) { return x.s === maxScore; }).map(function(x) { return x.i; });

  if (maxScore === 0) {
    gsResultTitle.textContent  = '무승부!';
    gsResultWinner.textContent = '아무도 점수를 얻지 못했어요.';
  } else if (winners.length === 1) {
    const w = winners[0];
    gsResultTitle.textContent  = '게임 종료!';
    gsResultWinner.textContent = `${GS_PLAYER_CONFIG[w].label} 승리! (${maxScore}점)`;
  } else {
    const labels = winners.map(function(w) { return GS_PLAYER_CONFIG[w].label; }).join(', ');
    gsResultTitle.textContent  = '동점!';
    gsResultWinner.textContent = `${labels} 공동 1위! (${maxScore}점)`;
  }

  const headRow = document.createElement('tr');
  headRow.innerHTML = '<th>라운드</th>' +
    Array.from({ length: gsPlayerCount }, function(_, i) {
      return `<th><span class="player-dot" style="background:${GS_PLAYER_CONFIG[i].dot}"></span>${GS_PLAYER_CONFIG[i].label}</th>`;
    }).join('');
  gsResultTHead.innerHTML = '';
  gsResultTHead.appendChild(headRow);

  gsResultTBody.innerHTML = '';
  gsRoundLog.forEach(function(log, idx) {
    const tr = document.createElement('tr');
    const firstLbl = log.firstDir === 1 ? '↻' : '↺';
    const ansLbl   = log.answerDir === 1 ? '↻' : '↺';
    let cells = `<td style="text-align:left;font-size:0.82rem;">${idx + 1}. 첫=${firstLbl} → ⭐=${ansLbl}</td>`;
    for (let i = 0; i < gsPlayerCount; i++) {
      if (log.winnerIdx === i) cells += `<td class="cell-win">+1</td>`;
      else if (log.dqPlayers.includes(i)) cells += `<td class="cell-wrong">실격</td>`;
      else if (log.timedOut) cells += `<td class="cell-timeout">시간초과</td>`;
      else cells += `<td class="cell-none">—</td>`;
    }
    tr.innerHTML = cells;
    gsResultTBody.appendChild(tr);
  });

  gsTotalRow.innerHTML = '';
  for (let i = 0; i < gsPlayerCount; i++) {
    const cfg   = GS_PLAYER_CONFIG[i];
    const isWin = winners.includes(i) && maxScore > 0;
    const chip  = document.createElement('div');
    chip.className = 'total-chip';
    chip.innerHTML = `
      <span class="chip-dot" style="background:${cfg.dot}"></span>
      <span>${cfg.label}</span>
      <span class="chip-score" style="color:${isWin ? '#2E7D32' : '#555'}">${gsScores[i]}점</span>
      ${isWin ? '<span style="font-size:1.1rem;">★</span>' : ''}
    `;
    gsTotalRow.appendChild(chip);
  }

  gsShowScreen(gsResultScreen);
}
