/* games/proverb-quiz/game.js */

'use strict';

// ── Constants ────────────────────────────────────────────────
const TOTAL_ROUNDS    = 10;
const ROUND_TIME      = 8;     // seconds per round
const RESULT_PAUSE_MS = 2000;  // pause before next round

// Player config
const PLAYER_CONFIG = [
  { label: 'P1', dot: '#0288D1', zoneBg: '#B3E5FC', cls: 'p1', btnFill: '#0277BD' },
  { label: 'P2', dot: '#E53935', zoneBg: '#FFCDD2', cls: 'p2', btnFill: '#C62828' },
  { label: 'P3', dot: '#388E3C', zoneBg: '#C8E6C9', cls: 'p3', btnFill: '#2E7D32' },
  { label: 'P4', dot: '#F57C00', zoneBg: '#FFE0B2', cls: 'p4', btnFill: '#E65100' },
];

// ── Proverb Data ─────────────────────────────────────────────
const ALL_PROVERBS = [
  { front: "가는 말이 고와야",          answer: "오는 말이 곱다",              wrongs: ["가는 길이 멀다", "오는 발이 빠르다"] },
  { front: "낮말은 새가 듣고",          answer: "밤말은 쥐가 듣는다",          wrongs: ["밤말은 달이 듣는다", "밤말은 바람이 듣는다"] },
  { front: "세 살 버릇",                answer: "여든까지 간다",               wrongs: ["백 살까지 간다", "열 살까지 간다"] },
  { front: "빈 수레가",                  answer: "요란하다",                   wrongs: ["조용하다", "무겁다"] },
  { front: "원숭이도",                   answer: "나무에서 떨어진다",           wrongs: ["하늘을 난다", "물에서 헤엄친다"] },
  { front: "콩 심은 데",                answer: "콩 나고 팥 심은 데 팥 난다",  wrongs: ["꽃이 핀다", "쌀이 난다"] },
  { front: "우물 안",                    answer: "개구리",                     wrongs: ["두꺼비", "물고기"] },
  { front: "백지장도",                   answer: "맞들면 낫다",                wrongs: ["혼자 들면 낫다", "찢으면 끝이다"] },
  { front: "소 잃고",                    answer: "외양간 고친다",              wrongs: ["말을 산다", "돼지를 키운다"] },
  { front: "돌다리도",                   answer: "두들겨 보고 건너라",         wrongs: ["뛰어서 건너라", "빨리 건너라"] },
  { front: "하늘이 무너져도",            answer: "솟아날 구멍이 있다",         wrongs: ["도망갈 곳이 있다", "비가 온다"] },
  { front: "뛰는 놈 위에",               answer: "나는 놈 있다",               wrongs: ["걷는 놈 있다", "서는 놈 있다"] },
  { front: "가재는",                     answer: "게 편",                      wrongs: ["새우 편", "물고기 편"] },
  { front: "고래 싸움에",                answer: "새우 등 터진다",             wrongs: ["물고기가 논다", "상어가 웃는다"] },
  { front: "꿩 대신",                    answer: "닭",                         wrongs: ["오리", "참새"] },
  { front: "누워서",                     answer: "떡 먹기",                    wrongs: ["잠 자기", "하늘 보기"] },
  { front: "등잔 밑이",                  answer: "어둡다",                     wrongs: ["밝다", "따뜻하다"] },
  { front: "말이 씨가",                  answer: "된다",                       wrongs: ["없다", "많다"] },
  { front: "아니 땐 굴뚝에",             answer: "연기 날까",                  wrongs: ["불 날까", "바람 불까"] },
  { front: "열 번 찍어",                 answer: "안 넘어가는 나무 없다",      wrongs: ["넘어가는 나무 있다", "부러지는 나무 없다"] },
  { front: "호랑이도",                   answer: "제 말 하면 온다",            wrongs: ["밥을 먹으면 온다", "산에서 내려온다"] },
  { front: "김칫국부터",                 answer: "마신다",                     wrongs: ["끓인다", "먹는다"] },
  { front: "하룻강아지",                 answer: "범 무서운 줄 모른다",        wrongs: ["고양이를 무서워한다", "밤을 무서워한다"] },
  { front: "작은 고추가",                answer: "맵다",                       wrongs: ["달다", "크다"] },
  { front: "티끌 모아",                  answer: "태산",                       wrongs: ["바다", "구름"] },
  { front: "공든 탑이",                  answer: "무너지랴",                   wrongs: ["높아지랴", "커지랴"] },
  { front: "될성부른 나무는",            answer: "떡잎부터 알아본다",          wrongs: ["열매부터 알아본다", "꽃부터 알아본다"] },
  { front: "수박 겉",                    answer: "핥기",                       wrongs: ["먹기", "깎기"] },
  { front: "바늘 도둑이",                answer: "소도둑 된다",                wrongs: ["말도둑 된다", "쌀도둑 된다"] },
  { front: "제 눈에",                    answer: "안경",                       wrongs: ["거울", "돋보기"] },
  { front: "발 없는 말이",               answer: "천 리 간다",                 wrongs: ["하늘로 간다", "백 리 간다"] },
  { front: "꼬리가 길면",                answer: "밟힌다",                     wrongs: ["짧아진다", "사라진다"] },
  { front: "종로에서 뺨 맞고",           answer: "한강에서 눈 흘긴다",         wrongs: ["남산에서 운다", "마당에서 웃는다"] },
  { front: "가지 많은 나무",             answer: "바람 잘 날 없다",            wrongs: ["새가 많이 앉는다", "그늘이 좋다"] },
  { front: "가물에",                     answer: "콩 나듯",                    wrongs: ["꽃 피듯", "비 오듯"] },
  { front: "가는 정이 있어야",           answer: "오는 정이 있다",             wrongs: ["오는 길이 멀다", "오는 손님이 있다"] },
  { front: "호미로 막을 것을",           answer: "가래로 막는다",              wrongs: ["삽으로 막는다", "손으로 막는다"] },
  { front: "사공이 많으면",              answer: "배가 산으로 간다",           wrongs: ["배가 빨라진다", "물고기가 도망간다"] },
  { front: "우는 아이",                  answer: "떡 하나 더 준다",            wrongs: ["밥을 굶긴다", "잠을 재운다"] },
  { front: "윗물이 맑아야",              answer: "아랫물이 맑다",              wrongs: ["바다가 깊다", "강이 흐른다"] },
  { front: "친구 따라",                  answer: "강남 간다",                  wrongs: ["산으로 간다", "집에 간다"] },
  { front: "같은 값이면",                answer: "다홍치마",                   wrongs: ["검정치마", "흰옷"] },
  { front: "닭 잡아먹고",                answer: "오리발 내민다",              wrongs: ["새 발 내민다", "거위발 내민다"] },
  { front: "누이 좋고",                  answer: "매부 좋다",                  wrongs: ["형 좋다", "동생 좋다"] },
  { front: "무소식이",                   answer: "희소식",                     wrongs: ["슬픈 소식", "나쁜 소식"] },
  { front: "길고 짧은 것은",             answer: "대 봐야 안다",               wrongs: ["보면 안다", "느낌으로 안다"] },
  { front: "가는 날이",                  answer: "장날",                       wrongs: ["휴일", "비 오는 날"] },
  { front: "보기 좋은 떡이",             answer: "먹기도 좋다",                wrongs: ["맛이 없다", "비싸다"] },
  { front: "새 발의",                    answer: "피",                         wrongs: ["깃털", "발톱"] },
  { front: "도둑이",                     answer: "제 발 저리다",               wrongs: ["빨리 도망간다", "잠을 잘 잔다"] },
  { front: "산 입에",                    answer: "거미줄 치랴",                wrongs: ["꽃이 피랴", "물이 마르랴"] },
  { front: "시작이",                     answer: "반이다",                     wrongs: ["끝이다", "전부다"] },
  { front: "천 리 길도",                 answer: "한 걸음부터",                wrongs: ["뛰어가야 한다", "차를 타야 한다"] },
  { front: "쇠뿔도",                     answer: "단김에 빼라",                wrongs: ["천천히 빼라", "두 손으로 빼라"] },
  { front: "굼벵이도",                   answer: "구르는 재주가 있다",         wrongs: ["나는 재주가 있다", "헤엄치는 재주가 있다"] },
  { front: "핑계 없는",                  answer: "무덤 없다",                  wrongs: ["사람 없다", "이유 없다"] },
  { front: "다람쥐",                     answer: "쳇바퀴 돌듯",                wrongs: ["나무를 타듯", "도토리를 줍듯"] },
  { front: "마른하늘에",                 answer: "날벼락",                     wrongs: ["천둥소리", "무지개"] },
  { front: "바늘 가는 데",               answer: "실 간다",                    wrongs: ["가위 간다", "옷 간다"] },
  { front: "빛 좋은",                    answer: "개살구",                     wrongs: ["사과", "참외"] },
  { front: "산 넘어",                    answer: "산",                         wrongs: ["바다", "강"] },
  { front: "식은 죽",                    answer: "먹기",                       wrongs: ["끓이기", "버리기"] },
  { front: "십 년이면",                  answer: "강산도 변한다",              wrongs: ["사람도 변한다", "모든 게 멈춘다"] },
  { front: "옷이",                       answer: "날개다",                     wrongs: ["짐이다", "구름이다"] },
  { front: "우물에 가",                  answer: "숭늉 찾는다",                wrongs: ["밥을 짓는다", "차를 끓인다"] },
  { front: "윗돌 빼서",                  answer: "아랫돌 괴기",                wrongs: ["옆돌 괴기", "새 돌 놓기"] },
  { front: "입에 쓴 약이",               answer: "몸에 좋다",                  wrongs: ["몸에 나쁘다", "맛이 나쁘다"] },
  { front: "자라 보고 놀란 가슴",        answer: "솥뚜껑 보고 놀란다",         wrongs: ["냄비 보고 놀란다", "거북 보고 놀란다"] },
  { front: "호박이",                     answer: "넝쿨째로 굴러왔다",          wrongs: ["혼자 굴러왔다", "씨앗째로 왔다"] },
  { front: "첫술에",                     answer: "배부르랴",                   wrongs: ["맛있으랴", "다 먹으랴"] },
  { front: "어물전 망신은",              answer: "꼴뚜기가 시킨다",            wrongs: ["오징어가 시킨다", "조개가 시킨다"] },
  { front: "콩으로 메주를 쑨다 해도",    answer: "곧이듣지 않는다",            wrongs: ["기뻐한다", "그대로 믿는다"] },
  { front: "콩 한 쪽도",                 answer: "나누어 먹는다",              wrongs: ["혼자 먹는다", "버린다"] },
  { front: "큰 고기는",                  answer: "깊은 물에 있다",             wrongs: ["얕은 물에 있다", "바닷가에 있다"] },
  { front: "털어서",                     answer: "먼지 안 나는 사람 없다",     wrongs: ["보석 나오는 사람 없다", "돈 나오는 사람 없다"] },
  { front: "팔이",                       answer: "안으로 굽는다",              wrongs: ["밖으로 굽는다", "위로 굽는다"] },
  { front: "평양 감사도",                answer: "저 싫으면 그만이다",         wrongs: ["돈 주면 한다", "남이 시키면 한다"] },
  { front: "화는",                       answer: "입에서 나온다",              wrongs: ["손에서 나온다", "발에서 나온다"] },
  { front: "형만 한",                    answer: "아우 없다",                  wrongs: ["친구 없다", "부모 없다"] },
  { front: "호랑이 굴에 가야",           answer: "호랑이를 잡는다",            wrongs: ["고양이를 잡는다", "토끼를 잡는다"] },
  { front: "도토리",                     answer: "키 재기",                    wrongs: ["맛 보기", "굴리기"] },
  { front: "게 눈",                      answer: "감추듯",                     wrongs: ["뜨듯", "비비듯"] },
  { front: "그림의",                     answer: "떡",                         wrongs: ["밥", "물"] },
  { front: "깨가",                       answer: "쏟아진다",                   wrongs: ["멈춘다", "익는다"] },
  { front: "모로 가도",                  answer: "서울만 가면 된다",           wrongs: ["부산만 가면 된다", "집에만 가면 된다"] },
  { front: "모기 보고",                  answer: "칼 빼기",                    wrongs: ["손 흔들기", "도망가기"] },
  { front: "물에 빠진 사람",             answer: "지푸라기라도 잡는다",        wrongs: ["수영을 잘한다", "물을 마신다"] },
  { front: "미꾸라지 한 마리가",         answer: "온 웅덩이를 흐린다",         wrongs: ["물을 맑게 한다", "물고기를 부른다"] },
  { front: "바다는 메워도",              answer: "사람 욕심은 못 채운다",      wrongs: ["사람 욕심은 채워진다", "물고기를 못 잡는다"] },
  { front: "배보다",                     answer: "배꼽이 더 크다",             wrongs: ["손이 더 크다", "발이 더 크다"] },
  { front: "사람은 죽으면",              answer: "이름을 남긴다",              wrongs: ["재산을 남긴다", "옷을 남긴다"] },
  { front: "서당 개 삼 년이면",          answer: "풍월을 읊는다",              wrongs: ["춤을 춘다", "글을 쓴다"] },
  { front: "서툰 무당이",                answer: "장구만 나무란다",            wrongs: ["북만 나무란다", "탈만 나무란다"] },
  { front: "손바닥으로",                 answer: "하늘 가리기",                wrongs: ["땅 덮기", "구름 잡기"] },
  { front: "십 년 묵은 체증이",          answer: "내려간다",                   wrongs: ["올라간다", "사라진다"] },
  { front: "아닌 밤중에",                answer: "홍두깨",                     wrongs: ["방망이", "도깨비"] },
  { front: "늦었다고 생각할 때가",       answer: "가장 빠른 때다",             wrongs: ["가장 늦은 때다", "마지막 때다"] },
  { front: "인사가",                     answer: "만사다",                     wrongs: ["전부다", "예의다"] },
  { front: "벼는 익을수록",              answer: "고개를 숙인다",              wrongs: ["고개를 든다", "뿌리를 내린다"] },
  { front: "구슬이 서 말이라도",         answer: "꿰어야 보배",                wrongs: ["놓아야 보배", "팔아야 보배"] },
];

// ── Sound Manager ────────────────────────────────────────────
const sound = createSoundManager();

// ── State ────────────────────────────────────────────────────
let playerCount   = 2;
let roundIdx      = 0;
let scores        = [];
let roundLog      = [];    // { front, answer, winnerIdx (-1=timeout), dqPlayers[] }
let currentP      = null;  // current proverb { front, answer, wrongs }
let roundAnswers  = [];    // [{ text, isCorrect }] — 3 shuffled options
let dqSet         = new Set();
let phase         = 'idle'; // 'idle' | 'active' | 'done'
let timerHandle   = null;
let nextHandle    = null;
let timeRemaining = ROUND_TIME;
let gameProverbs  = [];    // 10 randomly selected proverbs

// ── DOM refs ─────────────────────────────────────────────────
const introScreen     = document.getElementById('introScreen');
const countdownScreen = document.getElementById('countdownScreen');
const countdownNumber = document.getElementById('countdownNumber');
const gameScreen   = document.getElementById('gameScreen');
const resultScreen = document.getElementById('resultScreen');

const backBtn          = document.getElementById('backBtn');
const playBtn          = document.getElementById('playBtn');
const closeBtn         = document.getElementById('closeBtn');
const retryBtn         = document.getElementById('retryBtn');
const homeBtn          = document.getElementById('homeBtn');
const soundToggleIntro = document.getElementById('soundToggleIntro');

const zonesWrap        = document.getElementById('zonesWrap');
const questionCounter  = document.getElementById('questionCounter');
const proverbSvg       = document.getElementById('proverbSvg');
const proverbText      = document.getElementById('proverbText');
const problemStatus    = document.getElementById('problemStatus');
const problemTimer     = document.getElementById('problemTimer');
const scoreBar         = document.getElementById('scoreBar');

const resultTitle      = document.getElementById('resultTitle');
const resultWinner     = document.getElementById('resultWinner');
const resultTableHead  = document.getElementById('resultTableHead');
const resultTableBody  = document.getElementById('resultTableBody');
const totalRow         = document.getElementById('totalRow');

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

function clearTimers() {
  if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
  if (timerHandle) { clearInterval(timerHandle); timerHandle = null; }
  if (nextHandle)  { clearTimeout(nextHandle);   nextHandle  = null; }
}

function updateSoundIcon() {
  const el = document.getElementById('soundIconIntro');
  if (!el) return;
  if (sound.isMuted()) {
    el.innerHTML = `
      <path d="M4 8H7L11 5V17L7 14H4V8Z" fill="currentColor"/>
      <line x1="14" y1="9" x2="20" y2="15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
      <line x1="20" y1="9" x2="14" y2="15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    `;
  } else {
    el.innerHTML = `
      <path d="M4 8H7L11 5V17L7 14H4V8Z" fill="currentColor"/>
      <path d="M14 8.5C15 9.5 15 12.5 14 13.5M16 6.5C18.5 8.5 18.5 13.5 16 15.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    `;
  }
}

// ── Player count selection ───────────────────────────────────
setupPlayerSelect(function (n) { playerCount = n; });

// ── Sound toggle ─────────────────────────────────────────────
onTap(soundToggleIntro, () => {
  sound.toggleMute();
  updateSoundIcon();
});
updateSoundIcon();

// ── Navigation ───────────────────────────────────────────────
onTap(backBtn,  () => goHome());
onTap(closeBtn, () => { clearTimers(); goHome(); });
onTap(homeBtn,  () => goHome());
onTap(retryBtn, () => startPreGameCountdown(() => startGame()));
onTap(playBtn,  () => startPreGameCountdown(() => startGame()));

// ── SVG button builder ───────────────────────────────────────
// Creates a full-SVG-backed answer button
function buildAnswerSvgBtn(text, fill, playerIdx, answerIdx) {
  const btn = document.createElement('button');
  btn.className = 'answer-btn';
  btn.dataset.player = playerIdx;
  btn.dataset.answerIdx = answerIdx;
  btn.setAttribute('aria-label', text);

  // SVG background
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.classList.add('btn-bg');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('viewBox', '0 0 200 56');

  const rect = document.createElementNS(svgNS, 'rect');
  rect.setAttribute('x', '0');
  rect.setAttribute('y', '0');
  rect.setAttribute('width', '200');
  rect.setAttribute('height', '56');
  rect.setAttribute('rx', '14');
  rect.setAttribute('fill', fill);

  // Subtle lighter highlight stripe
  const shine = document.createElementNS(svgNS, 'rect');
  shine.setAttribute('x', '0');
  shine.setAttribute('y', '0');
  shine.setAttribute('width', '200');
  shine.setAttribute('height', '24');
  shine.setAttribute('rx', '14');
  shine.setAttribute('fill', 'rgba(255,255,255,0.12)');

  // Drop shadow rect (decorative bottom)
  const shadow = document.createElementNS(svgNS, 'rect');
  shadow.setAttribute('x', '4');
  shadow.setAttribute('y', '50');
  shadow.setAttribute('width', '192');
  shadow.setAttribute('height', '6');
  shadow.setAttribute('rx', '3');
  shadow.setAttribute('fill', 'rgba(0,0,0,0.18)');

  svg.appendChild(shadow);
  svg.appendChild(rect);
  svg.appendChild(shine);
  btn.appendChild(svg);

  // Label
  const label = document.createElement('span');
  label.className = 'btn-label';
  label.textContent = text;
  btn.appendChild(label);

  return btn;
}

// ── Build zone grid ──────────────────────────────────────────
function buildZones() {
  zonesWrap.innerHTML = '';
  zonesWrap.className = `zones-wrap p${playerCount}`;

  for (let i = 0; i < playerCount; i++) {
    const cfg  = PLAYER_CONFIG[i];
    const zone = document.createElement('div');
    zone.className = `zone ${cfg.cls}`;
    zone.dataset.player = i;

    // Header
    const header = document.createElement('div');
    header.className = 'zone-header';
    header.innerHTML = `
      <span class="zone-label">${cfg.label}</span>
      <span class="zone-score-chip" id="score-chip-${i}">0점</span>
    `;

    // Answer list container (filled per round)
    const list = document.createElement('div');
    list.className = 'answer-list';
    list.id = `answer-list-${i}`;

    zone.appendChild(header);
    zone.appendChild(list);
    zonesWrap.appendChild(zone);
  }
}

function getZone(idx) {
  return zonesWrap.querySelector(`.zone[data-player="${idx}"]`);
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
  const x     = touch ? touch.clientX - rect.left : rect.width  / 2;
  const y     = touch ? touch.clientY - rect.top  : rect.height / 2;
  const size  = Math.max(rect.width, rect.height);
  const r     = document.createElement('span');
  r.className = 'zone-ripple';
  r.style.left      = x + 'px';
  r.style.top       = y + 'px';
  r.style.width     = r.style.height = size + 'px';
  r.style.marginLeft = r.style.marginTop = `-${size / 2}px`;
  zone.appendChild(r);
  r.addEventListener('animationend', () => r.remove());
}

// ── Proverb SVG display ──────────────────────────────────────
// Dynamically adjusts font size + wraps long text in SVG
function renderProverbSvg(frontText) {
  const svgNS = 'http://www.w3.org/2000/svg';
  const displayText = frontText + ' ...';

  // Measure approximate char count to decide layout
  const isLong = displayText.length > 14;
  const svgH   = isLong ? 110 : 90;

  proverbSvg.setAttribute('viewBox', `0 0 300 ${svgH}`);
  proverbSvg.setAttribute('height', String(svgH));

  // Clear existing children except the rect already in DOM
  proverbSvg.innerHTML = '';

  // Background rect
  const bg = document.createElementNS(svgNS, 'rect');
  bg.setAttribute('x', '0');
  bg.setAttribute('y', '0');
  bg.setAttribute('width', '300');
  bg.setAttribute('height', String(svgH));
  bg.setAttribute('rx', '18');
  bg.setAttribute('fill', 'rgba(0,0,0,0.82)');
  proverbSvg.appendChild(bg);

  // Decorative scroll circles on left/right
  const decorLeft = document.createElementNS(svgNS, 'circle');
  decorLeft.setAttribute('cx', '16');
  decorLeft.setAttribute('cy', String(svgH / 2));
  decorLeft.setAttribute('r', '6');
  decorLeft.setAttribute('fill', 'rgba(255,255,255,0.18)');
  proverbSvg.appendChild(decorLeft);

  const decorRight = document.createElementNS(svgNS, 'circle');
  decorRight.setAttribute('cx', '284');
  decorRight.setAttribute('cy', String(svgH / 2));
  decorRight.setAttribute('r', '6');
  decorRight.setAttribute('fill', 'rgba(255,255,255,0.18)');
  proverbSvg.appendChild(decorRight);

  // Text — wrap if long
  if (isLong) {
    // Split at first space after half-point
    const mid    = Math.ceil(displayText.length / 2);
    const spaceI = displayText.indexOf(' ', mid);
    const line1  = spaceI > -1 ? displayText.slice(0, spaceI) : displayText.slice(0, mid);
    const line2  = spaceI > -1 ? displayText.slice(spaceI + 1) : displayText.slice(mid);
    const fontSize = line1.length > 16 ? 17 : 19;

    [line1, line2].forEach((line, idx) => {
      const t = document.createElementNS(svgNS, 'text');
      t.setAttribute('x', '150');
      t.setAttribute('y', String(idx === 0 ? svgH / 2 - 10 : svgH / 2 + 16));
      t.setAttribute('text-anchor', 'middle');
      t.setAttribute('dominant-baseline', 'middle');
      t.setAttribute('fill', '#FFFFFF');
      t.setAttribute('font-size', String(fontSize));
      t.setAttribute('font-weight', 'bold');
      t.setAttribute('font-family', "'Pretendard Variable',-apple-system,'Noto Sans KR',sans-serif");
      t.textContent = line;
      proverbSvg.appendChild(t);
    });
  } else {
    const fontSize = displayText.length > 10 ? 20 : 24;
    const t = document.createElementNS(svgNS, 'text');
    t.setAttribute('x', '150');
    t.setAttribute('y', String(svgH / 2));
    t.setAttribute('text-anchor', 'middle');
    t.setAttribute('dominant-baseline', 'middle');
    t.setAttribute('fill', '#FFFFFF');
    t.setAttribute('font-size', String(fontSize));
    t.setAttribute('font-weight', 'bold');
    t.setAttribute('font-family', "'Pretendard Variable',-apple-system,'Noto Sans KR',sans-serif");
    t.textContent = displayText;
    proverbSvg.appendChild(t);
  }
}

// ── Populate answer buttons for a round ─────────────────────
function populateAnswerButtons() {
  for (let i = 0; i < playerCount; i++) {
    const list = document.getElementById(`answer-list-${i}`);
    if (!list) continue;
    list.innerHTML = '';

    const cfg = PLAYER_CONFIG[i];

    roundAnswers.forEach((opt, ansIdx) => {
      const btn = buildAnswerSvgBtn(opt.text, cfg.btnFill, i, ansIdx);
      onTap(btn, (e) => handleAnswerTap(i, ansIdx, btn, e));
      list.appendChild(btn);
    });
  }
}

function getAnswerBtns(playerIdx) {
  const list = document.getElementById(`answer-list-${playerIdx}`);
  return list ? list.querySelectorAll('.answer-btn') : [];
}

// ── Timer logic ──────────────────────────────────────────────
function startCountdown() {
  timeRemaining = ROUND_TIME;
  problemTimer.textContent = timeRemaining;
  problemTimer.classList.remove('urgent');

  timerHandle = setInterval(() => {
    timeRemaining--;
    problemTimer.textContent = timeRemaining;

    if (timeRemaining <= 3) {
      problemTimer.classList.add('urgent');
      sound.play('tick');
    }
    if (timeRemaining <= 0) {
      clearTimers();
      handleTimeout();
    }
  }, 1000);
}

// ── Disable / enable answer buttons ─────────────────────────
function setPlayerBtnsDisabled(playerIdx, disabled) {
  const btns = getAnswerBtns(playerIdx);
  btns.forEach(btn => {
    btn.disabled = disabled;
    if (disabled) btn.classList.add('state-disabled');
    else          btn.classList.remove('state-disabled');
  });
}

function resetBtnsForRound() {
  for (let i = 0; i < playerCount; i++) {
    const btns = getAnswerBtns(i);
    btns.forEach(btn => {
      btn.className = 'answer-btn';
      btn.disabled  = false;
    });
    const zone = getZone(i);
    if (zone) zone.classList.remove('dq-zone');

    if (dqSet.has(i)) {
      setPlayerBtnsDisabled(i, true);
      if (zone) zone.classList.add('dq-zone');
    }
  }
}

// ── Answer tap handler ───────────────────────────────────────
function handleAnswerTap(playerIdx, answerIdx, btn, e) {
  if (phase !== 'active') return;
  if (dqSet.has(playerIdx)) return;

  const zone = getZone(playerIdx);
  spawnRipple(zone, e);

  const isCorrect = roundAnswers[answerIdx].isCorrect;

  if (isCorrect) {
    resolveRound(playerIdx, answerIdx);
  } else {
    // Wrong answer
    sound.play('buzz');
    btn.classList.add('state-wrong');
    setTimeout(() => {
      btn.classList.remove('state-wrong');
    }, 350);

    dqSet.add(playerIdx);

    // Deduct 1 (floor 0)
    scores[playerIdx] = Math.max(0, scores[playerIdx] - 1);
    updateScoreChip(playerIdx);
    updateBarScore(playerIdx);

    // Penalty flash
    const flash = document.createElement('div');
    flash.className = 'penalty-flash';
    flash.textContent = '-1';
    zone.appendChild(flash);
    flash.addEventListener('animationend', () => flash.remove());

    // Disable this player's buttons
    setPlayerBtnsDisabled(playerIdx, true);
    if (zone) zone.classList.add('dq-zone');

    // Check all-DQ → timeout
    let anyActive = false;
    for (let i = 0; i < playerCount; i++) {
      if (!dqSet.has(i)) { anyActive = true; break; }
    }
    if (!anyActive) {
      clearTimers();
      nextHandle = setTimeout(() => handleTimeout(), 350);
    }
  }
}

// ── Correct answer ───────────────────────────────────────────
function resolveRound(winnerIdx, correctAnsIdx) {
  phase = 'done';
  clearTimers();

  sound.play('ding');

  scores[winnerIdx]++;
  updateScoreChip(winnerIdx);
  updateBarScore(winnerIdx);

  // Show correct on winner's zone
  const winnerBtns = getAnswerBtns(winnerIdx);
  winnerBtns.forEach((btn, idx) => {
    if (idx === correctAnsIdx) btn.classList.add('state-correct');
    else btn.classList.add('state-disabled');
    btn.disabled = true;
  });

  // Dim all other zones
  for (let i = 0; i < playerCount; i++) {
    if (i !== winnerIdx) {
      const btns = getAnswerBtns(i);
      btns.forEach(b => { b.classList.add('state-disabled'); b.disabled = true; });
    }
  }

  const winLabel = PLAYER_CONFIG[winnerIdx].label;
  problemStatus.textContent = `${winLabel} 정답!`;

  roundLog.push({
    front: currentP.front,
    answer: currentP.answer,
    winnerIdx,
    dqPlayers: [...dqSet],
    timedOut: false,
  });

  nextHandle = setTimeout(() => nextRound(), RESULT_PAUSE_MS);
}

// ── Timeout ──────────────────────────────────────────────────
function handleTimeout() {
  phase = 'done';
  clearTimers();

  sound.play('timeout');

  // Reveal correct answer on all zones
  for (let i = 0; i < playerCount; i++) {
    const btns = getAnswerBtns(i);
    btns.forEach((btn, idx) => {
      if (roundAnswers[idx].isCorrect) btn.classList.add('state-reveal');
      else btn.classList.add('state-disabled');
      btn.disabled = true;
    });
    const zone = getZone(i);
    if (zone) zone.classList.remove('dq-zone');
  }

  problemStatus.textContent = `시간 초과! 정답: ${currentP.answer}`;

  roundLog.push({
    front: currentP.front,
    answer: currentP.answer,
    winnerIdx: -1,
    dqPlayers: [...dqSet],
    timedOut: true,
  });

  nextHandle = setTimeout(() => nextRound(), RESULT_PAUSE_MS);
}

// ── Load round ───────────────────────────────────────────────
function loadRound() {
  phase    = 'active';
  currentP = gameProverbs[roundIdx];
  dqSet    = new Set();

  // Build shuffled answer options
  roundAnswers = shuffle([
    { text: currentP.answer,    isCorrect: true  },
    { text: currentP.wrongs[0], isCorrect: false },
    { text: currentP.wrongs[1], isCorrect: false },
  ]);

  questionCounter.textContent = `${roundIdx + 1} / ${TOTAL_ROUNDS}`;
  problemStatus.textContent   = '';
  problemTimer.classList.remove('urgent');

  renderProverbSvg(currentP.front);
  populateAnswerButtons();
  resetBtnsForRound();

  startCountdown();
}

// ── Next round ────────────────────────────────────────────────
function nextRound() {
  roundIdx++;
  if (roundIdx >= TOTAL_ROUNDS) {
    showResult();
  } else {
    loadRound();
  }
}

// ── Start game ───────────────────────────────────────────────
function startGame() {
  gameProverbs = shuffle(ALL_PROVERBS).slice(0, TOTAL_ROUNDS);
  roundIdx     = 0;
  scores       = new Array(playerCount).fill(0);
  roundLog     = [];
  dqSet        = new Set();
  phase        = 'idle';

  clearTimers();

  buildZones();
  buildScoreBar();

  showScreen(gameScreen);
  loadRound();
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
    resultTitle.textContent  = '아쉬워요!';
    resultWinner.textContent = '아무도 점수를 얻지 못했어요.';
  } else if (winners.length === 1) {
    const w = winners[0];
    resultTitle.textContent  = '게임 종료!';
    resultWinner.textContent = `${PLAYER_CONFIG[w].label} 승리! (${maxScore}점)`;
  } else {
    const labels = winners.map(w => PLAYER_CONFIG[w].label).join(', ');
    resultTitle.textContent  = '동점!';
    resultWinner.textContent = `${labels} 공동 1위! (${maxScore}점)`;
  }

  // Table header
  const headRow = document.createElement('tr');
  headRow.innerHTML = '<th>속담</th>' +
    Array.from({ length: playerCount }, (_, i) =>
      `<th><span class="player-dot" style="background:${PLAYER_CONFIG[i].dot}"></span>${PLAYER_CONFIG[i].label}</th>`
    ).join('');
  resultTableHead.innerHTML = '';
  resultTableHead.appendChild(headRow);

  // Table body
  resultTableBody.innerHTML = '';
  roundLog.forEach((log, idx) => {
    const tr = document.createElement('tr');
    const front = log.front.length > 10 ? log.front.slice(0, 9) + '…' : log.front;
    let cells = `<td style="text-align:left;font-size:0.78rem;max-width:120px;">
      ${idx + 1}. ${front}<br>
      <span style="font-size:0.7rem;color:#888;">${log.answer}</span>
    </td>`;

    for (let i = 0; i < playerCount; i++) {
      if (log.timedOut) {
        cells += `<td class="cell-timeout">시간초과</td>`;
      } else if (log.winnerIdx === i) {
        cells += `<td class="cell-win">+1</td>`;
      } else if (log.dqPlayers.includes(i)) {
        cells += `<td class="cell-wrong">오답</td>`;
      } else {
        cells += `<td class="cell-none">-</td>`;
      }
    }
    tr.innerHTML = cells;
    resultTableBody.appendChild(tr);
  });

  // Total chips
  totalRow.innerHTML = '';
  for (let i = 0; i < playerCount; i++) {
    const cfg   = PLAYER_CONFIG[i];
    const isWin = winners.includes(i);
    const chip  = document.createElement('div');
    chip.className = 'total-chip';
    chip.innerHTML = `
      <span class="chip-dot" style="background:${cfg.dot}"></span>
      <span>${cfg.label}</span>
      <span class="chip-score" style="color:${isWin ? '#2E7D32' : '#555'}">${scores[i]}점</span>
      ${isWin ? '<svg width="18" height="18" viewBox="0 0 18 18"><polygon points="9,2 11.5,6.5 17,7.2 13,11 14.2,17 9,14 3.8,17 5,11 1,7.2 6.5,6.5" fill="#F9A825"/></svg>' : ''}
    `;
    totalRow.appendChild(chip);
  }

  showScreen(resultScreen);
}
