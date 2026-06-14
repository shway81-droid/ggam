/* games/spelling-quiz/game.js */

'use strict';

// ── Constants ────────────────────────────────────────────────
const TOTAL_QUESTIONS = 10;
const QUESTION_TIME   = 10;   // seconds per round
const RESULT_PAUSE_MS = getAutoplayPauseMs(1800); // 정답 공개 1.8초

// Player config (zone 배경은 여기서 동적 적용 — CSS 하드코딩 금지)
const PLAYER_CONFIG = [
  { label: 'P1', dot: '#0288D1', zoneBg: '#B3E5FC', cls: 'p1' },
  { label: 'P2', dot: '#E53935', zoneBg: '#FFCDD2', cls: 'p2' },
  { label: 'P3', dot: '#388E3C', zoneBg: '#C8E6C9', cls: 'p3' },
  { label: 'P4', dot: '#F57C00', zoneBg: '#FFE0B2', cls: 'p4' },
];

// ── 맞춤법 데이터 (표준국어대사전 기준) ──────────────────────
// { sentence: "빈칸(___) 포함 문장", correct: 바른 표기, wrong: 틀린 표기, tip: 한 줄 해설 }
const ALL_QUESTIONS = [
  { sentence: "오늘은 ___ 기분이 좋아.", correct: "왠지", wrong: "웬지", tip: "'왜인지'의 준말이라서 왠지!" },
  { sentence: "___이야? 네가 먼저 인사를 다 하고.", correct: "웬일", wrong: "왠일", tip: "'어찌 된 일'이라는 뜻은 웬일!" },
  { sentence: "이게 ___ 떡이야?", correct: "웬", wrong: "왠", tip: "'어찌 된'이라는 뜻은 웬!" },
  { sentence: "이제 집에 가도 ___.", correct: "돼요", wrong: "되요", tip: "'되어요'의 준말은 돼요!" },
  { sentence: "수업 시간에 떠들면 ___.", correct: "안 돼", wrong: "안 되", tip: "문장 끝에는 '돼'를 써요!" },
  { sentence: "숙제를 아직 하지 ___.", correct: "않았어", wrong: "안았어", tip: "'-지' 뒤에는 '않다'를 써요!" },
  { sentence: "오늘은 학원에 ___ 가요.", correct: "안", wrong: "않", tip: "'아니'의 준말은 안!" },
  { sentence: "감기가 다 ___ 정말 다행이야.", correct: "나아서", wrong: "낳아서", tip: "병은 낫다, 아기는 낳다!" },
  { sentence: "우리 집 강아지가 새끼를 ___.", correct: "낳았어", wrong: "나았어", tip: "새끼나 알은 낳다!" },
  { sentence: "무리하는 것보다 쉬는 게 더 ___.", correct: "나아", wrong: "낳아", tip: "'더 좋다'는 뜻은 낫다!" },
  { sentence: "이 퀴즈의 정답을 ___ 보세요.", correct: "맞혀", wrong: "맞춰", tip: "정답을 골라내는 건 맞히다!" },
  { sentence: "친구와 발걸음을 ___ 걸었다.", correct: "맞춰", wrong: "맞혀", tip: "나란히 하는 것은 맞추다!" },
  { sentence: "선생님께서 수학을 ___ 주신다.", correct: "가르쳐", wrong: "가리켜", tip: "지식을 알려 주는 건 가르치다!" },
  { sentence: "손가락으로 북쪽을 ___ 보세요.", correct: "가리켜", wrong: "가르쳐", tip: "방향을 콕 집는 건 가리키다!" },
  { sentence: "내 생각은 네 생각과 ___.", correct: "달라", wrong: "틀려", tip: "같지 않은 것은 다르다!" },
  { sentence: "3 더하기 4를 8이라고 쓰면 ___ 답이야.", correct: "틀린", wrong: "다른", tip: "정답이 아니면 틀리다!" },
  { sentence: "방학까지 ___ 남았지?", correct: "며칠", wrong: "몇일", tip: "'몇일'은 없는 말! 언제나 며칠." },
  { sentence: "소문이 ___ 온 학교에 퍼졌다.", correct: "금세", wrong: "금새", tip: "'금시에'가 줄어든 말이라 금세!" },
  { sentence: "___를 베고 낮잠을 잤다.", correct: "베개", wrong: "배게", tip: "베는 물건이라서 베개!" },
  { sentence: "교실을 ___ 청소하자.", correct: "깨끗이", wrong: "깨끗히", tip: "깨끗이는 '-이'로 써요!" },
  { sentence: "너를 만나려고 ___ 일찍 왔어.", correct: "일부러", wrong: "일부로", tip: "일부러가 표준어예요!" },
  { sentence: "문제를 ___ 생각해 보자.", correct: "곰곰이", wrong: "곰곰히", tip: "곰곰이는 '-이'로 써요!" },
  { sentence: "소풍 갈 생각에 벌써 마음이 ___.", correct: "설렌다", wrong: "설레인다", tip: "기본형은 설레다! '설레이다'는 X" },
  { sentence: "내 ___은 훌륭한 화가가 되는 거야.", correct: "바람", wrong: "바램", tip: "'바라다'에서 온 말이라 바람!" },
  { sentence: "네가 늘 건강하길 ___.", correct: "바라", wrong: "바래", tip: "기본형이 바라다라서 바라! 바래다는 색이 변하는 것." },
  { sentence: "오늘 정말 ___ 일이 있었어.", correct: "희한한", wrong: "희안한", tip: "희한하다가 맞아요!" },
  { sentence: "너무 ___ 말문이 막혔다.", correct: "어이없어서", wrong: "어의없어서", tip: "어이없다! 어의는 궁궐 의사예요." },
  { sentence: "연극에서 토끼 ___을 맡았어.", correct: "역할", wrong: "역활", tip: "역할이 표준어예요!" },
  { sentence: "선생님, 내일 ___!", correct: "봬요", wrong: "뵈요", tip: "'뵈어요'의 준말은 봬요!" },
  { sentence: "___ 만난 친구가 반가웠다.", correct: "오랜만에", wrong: "오랫만에", tip: "'오래간만'의 준말이라 오랜만!" },
  { sentence: "매콤한 ___ 정말 맛있다.", correct: "떡볶이", wrong: "떡볶기", tip: "떡을 볶은 음식이라 떡볶이!" },
  { sentence: "보글보글 된장___를 끓였다.", correct: "찌개", wrong: "찌게", tip: "찌개가 맞는 표기!" },
  { sentence: "급식에 ___이 나왔다.", correct: "육개장", wrong: "육계장", tip: "육개장이 표준어예요!" },
  { sentence: "밥을 먹고 ___를 했다.", correct: "설거지", wrong: "설겆이", tip: "설거지가 맞는 표기!" },
  { sentence: "___ 그렇게까지 할 필요는 없어.", correct: "굳이", wrong: "구지", tip: "[구지]로 소리 나도 굳이!" },
  { sentence: "지각하겠다, ___!", correct: "어떡해", wrong: "어떻해", tip: "'어떻게 해'의 준말은 어떡해!" },
  { sentence: "내가 꼭 다시 연락___.", correct: "할게", wrong: "할께", tip: "[할께]로 소리 나도 할게!" },
  { sentence: "이 지우개는 내 ___.", correct: "거야", wrong: "꺼야", tip: "[꺼야]로 소리 나도 거야!" },
  { sentence: "난로에 너무 ___ 가지 마.", correct: "가까이", wrong: "가까히", tip: "가까이는 '-이'로 써요!" },
  { sentence: "___ 말하면 나도 조금 무서웠어.", correct: "솔직히", wrong: "솔직이", tip: "솔직히는 '-히'로 써요!" },
  { sentence: "시험공부를 ___ 했다.", correct: "열심히", wrong: "열심이", tip: "열심히는 '-히'로 써요!" },
  { sentence: "도서관에서는 ___ 해야 해.", correct: "조용히", wrong: "조용이", tip: "조용히는 '-히'로 써요!" },
  { sentence: "의자에 ___ 앉아 있었다.", correct: "가만히", wrong: "가만이", tip: "가만히는 '-히'로 써요!" },
  { sentence: "주말에 가족과 ___ 영화를 봤다.", correct: "같이", wrong: "가치", tip: "[가치]로 소리 나도 같이!" },
  { sentence: "밥을 ___ 먹어서 배불러.", correct: "많이", wrong: "마니", tip: "[마니]로 소리 나도 많이!" },
  { sentence: "아삭아삭 ___가 맛있다.", correct: "깍두기", wrong: "깍뚜기", tip: "깍두기가 표준어예요!" },
  { sentence: "나갈 때 문을 꼭 ___.", correct: "잠가", wrong: "잠궈", tip: "잠그다 → 잠가! '잠구다'는 X" },
  { sentence: "할머니와 김치를 ___.", correct: "담갔다", wrong: "담궜다", tip: "담그다 → 담갔다! '담구다'는 X" },
  { sentence: "어제 수학 시험을 ___.", correct: "치렀다", wrong: "치뤘다", tip: "치르다 → 치렀다! '치루다'는 X" },
  { sentence: "집에 가는 길에 문구점에 ___.", correct: "들렀다", wrong: "들렸다", tip: "잠깐 머무는 것은 들르다!" },
  { sentence: "이 옷이 제일 ___ 것 같아.", correct: "무난한", wrong: "문안한", tip: "무난하다가 맞아요!" },
  { sentence: "자장면 ___를 시켰다.", correct: "곱빼기", wrong: "곱배기", tip: "곱빼기가 표준어예요!" },
  { sentence: "세수하면서 ___을 닦았다.", correct: "눈곱", wrong: "눈꼽", tip: "[눈꼽]으로 소리 나도 눈곱!" },
  { sentence: "동생이 ___을 찌푸렸다.", correct: "눈살", wrong: "눈쌀", tip: "[눈쌀]로 소리 나도 눈살!" },
  { sentence: "민수가 어제 놀이공원에 ___.", correct: "갔대", wrong: "갔데", tip: "남에게 들은 이야기는 '-대'!" },
  { sentence: "이건 제 ___.", correct: "가방이에요", wrong: "가방이예요", tip: "받침 있는 말 뒤는 '-이에요'!" },
  { sentence: "어제 ___ 빵이 정말 맛있었어.", correct: "먹던", wrong: "먹든", tip: "지난 일을 떠올릴 때는 '-던'!" },
  { sentence: "사탕의 ___를 세어 보자.", correct: "개수", wrong: "갯수", tip: "한자어라서 사이시옷 없이 개수!" },
  { sentence: "줄넘기 한 ___를 기록했다.", correct: "횟수", wrong: "회수", tip: "횟수가 맞는 표기!" },
  { sentence: "___ 늦었으니 천천히 가자.", correct: "어차피", wrong: "어짜피", tip: "어차피가 표준어예요!" },
  { sentence: "___ 무슨 일이 있었던 거야?", correct: "도대체", wrong: "도데체", tip: "도대체가 표준어예요!" },
  { sentence: "___ 일찍 자는 게 좋아.", correct: "웬만하면", wrong: "왠만하면", tip: "웬만하다의 웬!" },
  { sentence: "생일에 ___를 먹었다.", correct: "케이크", wrong: "케익", tip: "바른 외래어 표기는 케이크!" },
  { sentence: "달콤한 ___을 선물 받았다.", correct: "초콜릿", wrong: "초콜렛", tip: "바른 외래어 표기는 초콜릿!" },
  { sentence: "시원한 오렌지 ___를 마셨다.", correct: "주스", wrong: "쥬스", tip: "바른 외래어 표기는 주스!" },
  { sentence: "핫도그에 ___가 들어 있다.", correct: "소시지", wrong: "소세지", tip: "바른 외래어 표기는 소시지!" },
  { sentence: "점심으로 ___를 먹었다.", correct: "돈가스", wrong: "돈까스", tip: "바른 외래어 표기는 돈가스!" },
  { sentence: "청소 ___이 교실을 치운다.", correct: "로봇", wrong: "로보트", tip: "바른 외래어 표기는 로봇!" },
  { sentence: "친구에게 축하 ___를 보냈다.", correct: "메시지", wrong: "메세지", tip: "바른 외래어 표기는 메시지!" },
];

// ── Sound Manager ────────────────────────────────────────────
const sound = createSoundManager();

// ── State ────────────────────────────────────────────────────
let playerCount   = 2;
let questionIdx   = 0;
let scores        = [];
let questionLog   = [];      // { sentence, correct, winnerIdx (-1=timeout), dqPlayers[], timedOut }
let currentQ      = null;    // { sentence, correct, wrong, tip }
let leftIsCorrect = true;    // 라운드별 좌우 랜덤 배치 (모든 zone 동일 — 공정성)
let dqSet         = new Set();
let phase         = 'idle';  // 'idle' | 'active' | 'done'
let timerHandle   = null;
let nextHandle    = null;
let timeRemaining = QUESTION_TIME;
let gameQuestions = [];      // 무작위 10문제 (중복 출제 방지)

// ── DOM refs ─────────────────────────────────────────────────
const introScreen     = document.getElementById('introScreen');
const countdownScreen = document.getElementById('countdownScreen');
const countdownNumber = document.getElementById('countdownNumber');
const gameScreen      = document.getElementById('gameScreen');
const resultScreen    = document.getElementById('resultScreen');

const backBtn  = document.getElementById('backBtn');
const playBtn  = document.getElementById('playBtn');
const closeBtn = document.getElementById('closeBtn');
const retryBtn = document.getElementById('retryBtn');
const homeBtn  = document.getElementById('homeBtn');

const zonesWrap       = document.getElementById('zonesWrap');
const questionCounter = document.getElementById('questionCounter');
const problemTimer    = document.getElementById('problemTimer');
const sentenceDisplay = document.getElementById('sentenceDisplay');
const problemStatus   = document.getElementById('problemStatus');
const answerTip       = document.getElementById('answerTip');
const scoreBar        = document.getElementById('scoreBar');

const soundToggleIntro = document.getElementById('soundToggleIntro');

const resultTitle     = document.getElementById('resultTitle');
const resultWinner    = document.getElementById('resultWinner');
const resultTableHead = document.getElementById('resultTableHead');
const resultTableBody = document.getElementById('resultTableBody');
const totalRow        = document.getElementById('totalRow');

// ── Helpers ──────────────────────────────────────────────────
function showScreen(s) {
  [introScreen, countdownScreen, gameScreen, resultScreen].forEach(x => x.classList.remove('active'));
  s.classList.add('active');
}

var countdownInterval = null;
function startPreGameCountdown(onDone) {
  showScreen(countdownScreen);
  countdownInterval = runCountdown(countdownNumber, onDone);
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function clearTimers() {
  if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
  if (timerHandle) { clearInterval(timerHandle); timerHandle = null; }
  if (nextHandle)  { clearTimeout(nextHandle);   nextHandle  = null; }
}


// ── Player count selection ───────────────────────────────────
setupPlayerSelect(function (n) { playerCount = n; });

// ── Sound toggle ─────────────────────────────────────────────
setupSoundToggle(sound, soundToggleIntro);

// ── Navigation ───────────────────────────────────────────────
onTap(backBtn,  () => goHome());
onTap(closeBtn, () => { clearTimers(); goHome(); });
onTap(homeBtn,  () => goHome());
onTap(retryBtn, () => startPreGameCountdown(() => startGame()));
onTap(playBtn,  () => startPreGameCountdown(() => startGame()));

// ── Build zone grid ──────────────────────────────────────────
function buildZones() {
  zonesWrap.innerHTML = '';
  zonesWrap.className = `zones-wrap p${playerCount}`;

  for (let i = 0; i < playerCount; i++) {
    const cfg  = PLAYER_CONFIG[i];
    const zone = document.createElement('div');
    zone.className = `zone ${cfg.cls}`;
    zone.dataset.player = i;
    zone.style.background = cfg.zoneBg;

    // Header (정보 — zone 상단)
    const header = document.createElement('div');
    header.className = 'zone-header';
    header.innerHTML = `
      <span class="zone-label">${cfg.label}</span>
      <span class="zone-score-chip" id="score-chip-${i}">0점</span>
    `;

    // 답 버튼 2개 (조작 — zone 하단, margin-top: auto)
    const grid = document.createElement('div');
    grid.className = 'choice-grid';

    for (let slot = 0; slot < 2; slot++) {
      const btn = document.createElement('button');
      btn.className = 'choice-btn';
      btn.dataset.player = i;
      btn.dataset.slot = slot;
      btn.setAttribute('aria-label', `P${i + 1} 보기 ${slot + 1}`);
      onTap(btn, () => handleAnswerTap(i, btn));
      grid.appendChild(btn);
    }

    zone.appendChild(header);
    zone.appendChild(grid);
    zonesWrap.appendChild(zone);
  }
}

function getZone(idx) {
  return zonesWrap.querySelector(`.zone[data-player="${idx}"]`);
}

function getChoiceBtns(playerIdx) {
  return zonesWrap.querySelectorAll(`.choice-btn[data-player="${playerIdx}"]`);
}

function updateScoreChip(playerIdx) {
  const chip = document.getElementById(`score-chip-${playerIdx}`);
  if (chip) chip.textContent = `${scores[playerIdx]}점`;
}

// ── Score bar ────────────────────────────────────────────────
function buildScoreBar() {
  scoreBar.innerHTML = '';
  for (let i = 0; i < playerCount; i++) {
    const cfg  = PLAYER_CONFIG[i];
    const chip = document.createElement('div');
    chip.className = 'score-chip';
    chip.innerHTML = `
      <span class="score-chip-dot" style="background:${cfg.dot}"></span>
      <span>${cfg.label}</span>
      <span class="score-chip-val" id="bar-score-${i}">0</span>
    `;
    scoreBar.appendChild(chip);
  }
}

function updateBarScore(playerIdx) {
  const el = document.getElementById(`bar-score-${playerIdx}`);
  if (el) el.textContent = scores[playerIdx];
}

// ── Ripple effect ────────────────────────────────────────────
function spawnRipple(zone, e) {
  const rect  = zone.getBoundingClientRect();
  const touch = e && e.touches ? e.touches[0] : (e || null);
  const x     = touch && touch.clientX ? touch.clientX - rect.left : rect.width  / 2;
  const y     = touch && touch.clientY ? touch.clientY - rect.top  : rect.height / 2;
  const size  = Math.max(rect.width, rect.height);
  const r     = document.createElement('span');
  r.className = 'zone-ripple';
  r.style.left   = x + 'px';
  r.style.top    = y + 'px';
  r.style.width  = r.style.height = size + 'px';
  r.style.marginLeft = r.style.marginTop = `-${size / 2}px`;
  zone.appendChild(r);
  r.addEventListener('animationend', () => r.remove());
}

// ── Timer logic ──────────────────────────────────────────────
function startCountdown() {
  timeRemaining = QUESTION_TIME;
  problemTimer.textContent = timeRemaining;
  problemTimer.classList.remove('urgent');

  timerHandle = setInterval(() => {
    timeRemaining--;
    problemTimer.textContent = timeRemaining;

    if (timeRemaining <= 3 && timeRemaining > 0) {
      problemTimer.classList.add('urgent');
      sound.play('tick');
    }

    if (timeRemaining <= 0) {
      clearTimers();
      handleTimeout();
    }
  }, 1000);
}

// ── Button helpers ───────────────────────────────────────────
function isCorrectBtn(btn) {
  const slot = parseInt(btn.dataset.slot, 10);
  return (slot === 0) === leftIsCorrect;
}

function resetBtnsForRound() {
  for (let i = 0; i < playerCount; i++) {
    getChoiceBtns(i).forEach(btn => {
      btn.className = 'choice-btn';
      btn.disabled = false;
      const slot = parseInt(btn.dataset.slot, 10);
      const isCorrect = (slot === 0) === leftIsCorrect;
      btn.textContent = isCorrect ? currentQ.correct : currentQ.wrong;
    });
    const zone = getZone(i);
    if (zone) zone.classList.remove('dq-zone');
  }
}

// ── Answer tap handler ───────────────────────────────────────
function handleAnswerTap(playerIdx, btn) {
  if (phase !== 'active') return;
  if (dqSet.has(playerIdx)) return;

  const zone = getZone(playerIdx);
  spawnRipple(zone, window.event || null);

  if (isCorrectBtn(btn)) {
    resolveQuestion(playerIdx);
  } else {
    // 오답 — -1점 & 라운드 실격
    sound.play('buzz');
    btn.classList.add('state-wrong');
    setTimeout(() => { btn.classList.remove('state-wrong'); }, 400);

    dqSet.add(playerIdx);

    scores[playerIdx] = Math.max(0, scores[playerIdx] - 1);
    updateScoreChip(playerIdx);
    updateBarScore(playerIdx);

    // "-1" flash
    const penalty = document.createElement('div');
    penalty.className = 'penalty-flash';
    penalty.textContent = '-1';
    zone.appendChild(penalty);
    penalty.addEventListener('animationend', () => penalty.remove());

    // 해당 플레이어 버튼 비활성화
    getChoiceBtns(playerIdx).forEach(b => {
      b.classList.add('state-disabled');
      b.disabled = true;
    });
    zone.classList.add('dq-zone');

    // 전원 실격 시 라운드 종료
    let activePlayers = 0;
    for (let i = 0; i < playerCount; i++) {
      if (!dqSet.has(i)) activePlayers++;
    }
    if (activePlayers === 0) {
      clearTimers();
      setTimeout(() => handleTimeout(), 300);
    }
  }
}

// ── 정답 공개 (문장 전체 + 해설) ─────────────────────────────
function revealAnswer() {
  const full = escapeHtml(currentQ.sentence).replace(
    '___',
    `<span class="reveal-word">${escapeHtml(currentQ.correct)}</span>`
  );
  sentenceDisplay.innerHTML = full;
  answerTip.textContent = '💡 ' + currentQ.tip;
}

// ── Correct answer ───────────────────────────────────────────
function resolveQuestion(winnerIdx) {
  phase = 'done';
  clearTimers();

  sound.play('ding');

  scores[winnerIdx]++;
  updateScoreChip(winnerIdx);
  updateBarScore(winnerIdx);

  // 승자 정답 버튼 강조
  getChoiceBtns(winnerIdx).forEach(btn => {
    if (isCorrectBtn(btn)) btn.classList.add('state-correct');
    else                   btn.classList.add('state-disabled');
  });

  // 나머지 zone 비활성화
  for (let i = 0; i < playerCount; i++) {
    if (i !== winnerIdx) {
      getChoiceBtns(i).forEach(b => { b.classList.add('state-disabled'); b.disabled = true; });
    }
  }

  problemStatus.textContent = `✅ ${PLAYER_CONFIG[winnerIdx].label} 정답!`;
  revealAnswer();

  questionLog.push({
    sentence: currentQ.sentence,
    correct: currentQ.correct,
    winnerIdx,
    dqPlayers: [...dqSet],
    timedOut: false,
  });

  nextHandle = setTimeout(() => nextQuestion(), RESULT_PAUSE_MS);
}

// ── Timeout ──────────────────────────────────────────────────
function handleTimeout() {
  phase = 'done';
  clearTimers();

  sound.play('timeout');

  // 모든 zone에 정답 공개
  for (let i = 0; i < playerCount; i++) {
    getChoiceBtns(i).forEach(btn => {
      if (isCorrectBtn(btn)) btn.classList.add('state-reveal');
      else                   btn.classList.add('state-disabled');
      btn.disabled = true;
    });
    getZone(i).classList.remove('dq-zone');
  }

  problemStatus.textContent = `⏰ 시간 초과! 정답: ${currentQ.correct}`;
  revealAnswer();

  questionLog.push({
    sentence: currentQ.sentence,
    correct: currentQ.correct,
    winnerIdx: -1,
    dqPlayers: [...dqSet],
    timedOut: true,
  });

  nextHandle = setTimeout(() => nextQuestion(), RESULT_PAUSE_MS);
}

// ── Load question ────────────────────────────────────────────
function loadQuestion() {
  phase         = 'active';
  currentQ      = gameQuestions[questionIdx];
  dqSet         = new Set();
  leftIsCorrect = Math.random() < 0.5; // 좌우 랜덤 배치 (모든 zone 동일)

  questionCounter.textContent = `${questionIdx + 1} / ${TOTAL_QUESTIONS}`;
  sentenceDisplay.innerHTML   = escapeHtml(currentQ.sentence)
    .replace('___', '<span class="blank">___</span>');
  problemStatus.textContent   = '';
  answerTip.textContent       = '';
  problemTimer.classList.remove('urgent');

  resetBtnsForRound();
  startCountdown();
}

// ── Next question ────────────────────────────────────────────
function nextQuestion() {
  questionIdx++;
  if (questionIdx >= TOTAL_QUESTIONS) {
    showResult();
  } else {
    loadQuestion();
  }
}

// ── Start game ───────────────────────────────────────────────
function startGame() {
  // 무작위 10문제 선택 — 한 게임 내 같은 문제 재출제 없음
  gameQuestions = shuffle(ALL_QUESTIONS).slice(0, TOTAL_QUESTIONS);
  questionIdx   = 0;
  scores        = new Array(playerCount).fill(0);
  questionLog   = [];
  dqSet         = new Set();
  phase         = 'idle';

  clearTimers();

  buildZones();
  buildScoreBar();

  showScreen(gameScreen);
  loadQuestion();
}

// ── Show result ──────────────────────────────────────────────
function showResult() {
  clearTimers();
  phase = 'idle';

  sound.play('fanfare');

  const maxScore = Math.max(...scores);
  const winners  = scores
    .map((s, i) => ({ s, i }))
    .filter(x => x.s === maxScore)
    .map(x => x.i);

  if (maxScore === 0) {
    resultTitle.textContent  = '😅 무승부!';
    resultWinner.textContent = '아무도 점수를 얻지 못했어요.';
  } else if (winners.length === 1) {
    const w = winners[0];
    resultTitle.textContent  = '🏆 게임 종료!';
    resultWinner.textContent = `${PLAYER_CONFIG[w].label} 승리! (${maxScore}점)`;
  } else {
    const labels = winners.map(w => PLAYER_CONFIG[w].label).join(', ');
    resultTitle.textContent  = '🤝 동점!';
    resultWinner.textContent = `${labels} 공동 1위! (${maxScore}점)`;
  }

  // Table header
  const headRow = document.createElement('tr');
  headRow.innerHTML = '<th>문제</th>' +
    Array.from({ length: playerCount }, (_, i) =>
      `<th><span class="player-dot" style="background:${PLAYER_CONFIG[i].dot}"></span>${PLAYER_CONFIG[i].label}</th>`
    ).join('');
  resultTableHead.innerHTML = '';
  resultTableHead.appendChild(headRow);

  // Table body
  resultTableBody.innerHTML = '';
  questionLog.forEach((log, idx) => {
    const tr = document.createElement('tr');
    const fullSentence = log.sentence.replace('___', log.correct);
    const qDisplay = fullSentence.length > 18 ? fullSentence.slice(0, 16) + '…' : fullSentence;
    let cells = `<td style="text-align:left;font-size:0.78rem;max-width:130px;">${idx + 1}. ${escapeHtml(qDisplay)}<br><span style="font-size:0.7rem;color:#888;">정답: ${escapeHtml(log.correct)}</span></td>`;

    for (let i = 0; i < playerCount; i++) {
      if (log.winnerIdx === i) {
        cells += `<td class="cell-win">✅ +1</td>`;
      } else if (log.dqPlayers.includes(i)) {
        cells += `<td class="cell-wrong">❌ -1</td>`;
      } else if (log.timedOut) {
        cells += `<td class="cell-timeout">⏰</td>`;
      } else {
        cells += `<td class="cell-none">—</td>`;
      }
    }
    tr.innerHTML = cells;
    resultTableBody.appendChild(tr);
  });

  // Total chips
  totalRow.innerHTML = '';
  for (let i = 0; i < playerCount; i++) {
    const cfg   = PLAYER_CONFIG[i];
    const isWin = winners.includes(i) && maxScore > 0;
    const chip  = document.createElement('div');
    chip.className = 'total-chip';
    chip.innerHTML = `
      <span class="chip-dot" style="background:${cfg.dot}"></span>
      <span>${cfg.label}</span>
      <span class="chip-score" style="color:${isWin ? '#2E7D32' : '#555'}">${scores[i]}점</span>
      ${isWin ? '<span>🏆</span>' : ''}
    `;
    totalRow.appendChild(chip);
  }

  showScreen(resultScreen);
}
