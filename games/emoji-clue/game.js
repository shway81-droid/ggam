/* emoji-clue */
'use strict';

const TOTAL_ROUNDS = 5;
const HINT_SIZE = 3;
const WIN_SCORE = 3;

// 24개 고정 범용 이모지 팔레트 (모든 비밀 단어 표현 가능하도록 선정)
const PALETTE = [
  '🔥','💧','🚒','🚓','🏥','🏫',
  '🏠','👨','🌳','🌊','⛰️','🐟',
  '🐘','🍎','🍳','🎂','📚','⚽',
  '🎵','🎢','❄️','☀️','⛺','🎨'
];

// 비밀 단어 풀 (w: 정답, x: 같은 범주 오답 3개)
const WORDS = [
  // 직업
  { w: '소방관', x: ['경찰관', '의사', '요리사'] },
  { w: '경찰관', x: ['소방관', '선생님', '의사'] },
  { w: '의사', x: ['요리사', '선생님', '경찰관'] },
  { w: '요리사', x: ['의사', '화가', '선생님'] },
  { w: '선생님', x: ['의사', '경찰관', '요리사'] },
  { w: '화가', x: ['가수', '요리사', '선생님'] },
  // 장소
  { w: '학교', x: ['도서관', '병원', '놀이공원'] },
  { w: '바다', x: ['산', '강', '수영장'] },
  { w: '산', x: ['바다', '강', '섬'] },
  { w: '놀이공원', x: ['동물원', '학교', '수영장'] },
  { w: '도서관', x: ['학교', '병원', '영화관'] },
  { w: '병원', x: ['학교', '도서관', '소방서'] },
  { w: '동물원', x: ['놀이공원', '농장', '수족관'] },
  { w: '소방서', x: ['경찰서', '병원', '학교'] },
  { w: '경찰서', x: ['소방서', '병원', '도서관'] },
  // 사물/행사/개념
  { w: '생일', x: ['설날', '소풍', '운동회'] },
  { w: '겨울방학', x: ['여름방학', '운동회', '소풍'] },
  { w: '여름방학', x: ['겨울방학', '설날', '운동회'] },
  { w: '운동회', x: ['소풍', '생일', '입학식'] },
  { w: '소풍', x: ['운동회', '캠핑', '생일'] },
  { w: '캠핑', x: ['소풍', '낚시', '등산'] },
  { w: '등산', x: ['캠핑', '수영', '낚시'] },
  { w: '눈사람', x: ['인형', '허수아비', '로봇'] },
  { w: '물놀이', x: ['눈싸움', '등산', '캠핑'] }
];

let round = 0, score = 0, streak = 0, bestStreak = 0;
let deck = [], current = null, picked = [], guessActive = false;
let gateCallback = null, allTimeouts = [];

const sfx = createSoundManager({
  tap(ctx){const o=ctx.createOscillator(),g=ctx.createGain();o.type='triangle';o.frequency.value=440;g.gain.setValueAtTime(.15,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.08);o.connect(g);g.connect(ctx.destination);o.start();o.stop(ctx.currentTime+.08);},
  pick(ctx){const o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.value=660;g.gain.setValueAtTime(.18,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.1);o.connect(g);g.connect(ctx.destination);o.start();o.stop(ctx.currentTime+.1);},
  correct(ctx){[523,784,1047].forEach((f,i)=>{const o=ctx.createOscillator(),g=ctx.createGain();o.type='triangle';o.frequency.value=f;const t=ctx.currentTime+i*.08;g.gain.setValueAtTime(.22,t);g.gain.exponentialRampToValueAtTime(.001,t+.3);o.connect(g);g.connect(ctx.destination);o.start(t);o.stop(t+.35);});},
  wrong(ctx){const o=ctx.createOscillator(),g=ctx.createGain();o.type='sawtooth';o.frequency.setValueAtTime(180,ctx.currentTime);o.frequency.exponentialRampToValueAtTime(80,ctx.currentTime+.3);g.gain.setValueAtTime(.25,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.32);o.connect(g);g.connect(ctx.destination);o.start();o.stop(ctx.currentTime+.35);},
  end(ctx){[523,659,784,1047].forEach((f,i)=>{const o=ctx.createOscillator(),g=ctx.createGain();o.type='triangle';o.frequency.value=f;const t=ctx.currentTime+i*.1;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.28,t+.05);g.gain.exponentialRampToValueAtTime(.001,t+.5);o.connect(g);g.connect(ctx.destination);o.start(t);o.stop(t+.55);});}
});

const $ = id => document.getElementById(id);
const introScreen=$('introScreen'),countdownScreen=$('countdownScreen'),gameScreen=$('gameScreen'),resultScreen=$('resultScreen');
const countdownNum=$('countdownNumber'),hudRound=$('hudRound'),hudScore=$('hudScore'),banner=$('banner');
const phaseP1=$('phaseP1'),phaseP2=$('phaseP2'),gate=$('gate');
const secretWord=$('secretWord'),pickedSlots=$('pickedSlots'),paletteGrid=$('paletteGrid'),doneBtn=$('doneBtn');
const hintEmojis=$('hintEmojis'),choiceGrid=$('choiceGrid');

function showScreen(el){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));void el.offsetWidth;el.classList.add('active');}
function push(t){allTimeouts.push(t);return t;}
function clearAll(){allTimeouts.forEach(clearTimeout);allTimeouts=[];}
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}

$('backBtn').addEventListener('click',goHome);
const stI=$('soundToggleIntro');
stI.addEventListener('click',()=>{stI.textContent=sfx.toggleMute()?'🔇':'🔊';});
stI.textContent=sfx.isMuted()?'🔇':'🔊';
const stG=$('soundToggleGame');
stG.addEventListener('click',()=>{stG.textContent=sfx.toggleMute()?'🔇':'🔊';});

onTap($('playBtn'),startCountdown);
onTap($('retryBtn'),startCountdown);
onTap($('homeBtn'),goHome);
onTap($('closeBtn'),()=>{stopAll();goHome();});
onTap(gate,()=>{
  if(!gateCallback)return;
  const cb=gateCallback;
  gateCallback=null;
  gate.classList.remove('show');
  sfx.play('tap');
  cb();
});
onTap(doneBtn,finishHint);

function stopAll(){clearAll();gateCallback=null;guessActive=false;}

function startCountdown(){
  stopAll();showScreen(countdownScreen);
  let n=3;countdownNum.textContent=n;
  function tick(){n--;if(n<=0){countdownNum.textContent='GO!';push(setTimeout(startGame,700));}else{countdownNum.textContent=n;push(setTimeout(tick,1000));}}
  push(setTimeout(tick,1000));
}

function startGame(){
  round=0;score=0;streak=0;bestStreak=0;
  deck=shuffle([...WORDS]).slice(0,TOTAL_ROUNDS);
  stG.textContent=sfx.isMuted()?'🔇':'🔊';
  showScreen(gameScreen);
  buildPalette();
  nextRound();
}

function buildPalette(){
  paletteGrid.innerHTML='';
  PALETTE.forEach(e=>{
    const b=document.createElement('button');
    b.className='palette-btn';
    b.textContent=e;
    b.dataset.emoji=e;
    onTap(b,()=>togglePick(e));
    paletteGrid.appendChild(b);
  });
}

function nextRound(){
  if(round>=TOTAL_ROUNDS){endGame();return;}
  round++;
  current=deck[round-1];
  picked=[];
  guessActive=false;
  hudRound.textContent=round+'/'+TOTAL_ROUNDS;
  hudScore.textContent=score+'점';
  showGate('👁','P1만 보세요!','P2는 눈을 감아요 🙈',startP1Phase);
}

function showGate(emoji,title,sub,cb){
  $('gateEmoji').textContent=emoji;
  $('gateTitle').textContent=title;
  $('gateSub').textContent=sub;
  gateCallback=cb;
  gate.classList.add('show');
}

function setPhase(el){
  phaseP1.classList.remove('active');
  phaseP2.classList.remove('active');
  el.classList.add('active');
}

// ── Phase 1: P1 builds the hint ─────────────────────
function startP1Phase(){
  setPhase(phaseP1);
  secretWord.textContent=current.w;
  renderPicked();
  renderPaletteState();
  showBanner('💡 P1: 이모지 3개로 힌트를 만들어요!','info');
}

function togglePick(emoji){
  if(!phaseP1.classList.contains('active'))return;
  const idx=picked.indexOf(emoji);
  if(idx>=0){
    picked.splice(idx,1);
    sfx.play('tap');
  }else{
    if(picked.length>=HINT_SIZE)return;
    picked.push(emoji);
    sfx.play('pick');
  }
  renderPicked();
  renderPaletteState();
}

function renderPicked(){
  pickedSlots.innerHTML='';
  for(let i=0;i<HINT_SIZE;i++){
    const s=document.createElement('div');
    s.className='picked-slot';
    if(picked[i]!=null){
      s.classList.add('filled');
      s.textContent=picked[i];
      const e=picked[i];
      onTap(s,()=>togglePick(e)); // 다시 누르면 선택 해제
    }else{
      s.textContent=(i+1);
    }
    pickedSlots.appendChild(s);
  }
  doneBtn.disabled=picked.length!==HINT_SIZE;
}

function renderPaletteState(){
  const full=picked.length>=HINT_SIZE;
  paletteGrid.querySelectorAll('.palette-btn').forEach(b=>{
    const sel=picked.indexOf(b.dataset.emoji)>=0;
    b.classList.toggle('picked',sel);
    b.disabled=full&&!sel;
  });
}

function finishHint(){
  if(picked.length!==HINT_SIZE)return;
  sfx.play('pick');
  showGate('🔄','이제 P2 차례!','터치하면 이모지 힌트가 공개돼요',startP2Phase);
}

// ── Phase 2: P2 guesses ─────────────────────────────
function startP2Phase(){
  setPhase(phaseP2);
  hintEmojis.innerHTML='';
  picked.forEach((e,i)=>{
    const d=document.createElement('div');
    d.className='hint-emoji';
    d.textContent=e;
    d.style.animationDelay=(i*0.12)+'s';
    d.classList.add('pop');
    hintEmojis.appendChild(d);
  });
  const choices=shuffle([current.w,...current.x]);
  choiceGrid.innerHTML='';
  choices.forEach(word=>{
    const b=document.createElement('button');
    b.className='choice-btn';
    b.textContent=word;
    onTap(b,()=>handleGuess(b,word));
    choiceGrid.appendChild(b);
  });
  guessActive=true;
  showBanner('🎮 P2: 힌트를 보고 단어를 골라요!','info');
}

function handleGuess(btn,word){
  if(!guessActive)return;
  guessActive=false;
  const correct=word===current.w;
  choiceGrid.querySelectorAll('.choice-btn').forEach(b=>{
    b.disabled=true;
    if(b.textContent===current.w)b.classList.add('correct');
  });
  if(correct){
    score++;streak++;
    if(streak>bestStreak)bestStreak=streak;
    sfx.play('correct');
    showBanner('🎉 정답! 마음이 통했어요!','ok');
  }else{
    btn.classList.add('wrong');
    streak=0;
    sfx.play('wrong');
    showBanner('❌ 아쉬워요! 정답은 "'+current.w+'"','ng');
  }
  hudScore.textContent=score+'점';
  push(setTimeout(nextRound,getAutoplayPauseMs(2200)));
}

function showBanner(txt,cls){
  banner.textContent=txt;
  banner.className='banner '+cls+' show';
}

function endGame(){
  stopAll();
  sfx.play('end');
  const success=score>=WIN_SCORE;
  $('resultEmoji').textContent=success?'🏆':'😔';
  $('resultHeadline').textContent=success?'협력 성공!':'아쉬워요...';
  $('resultHeadline').className='result-headline '+(success?'success':'fail');
  $('resultSub').textContent=success?'이모지만으로 마음이 통했어요!':'5라운드 중 3번 이상 성공이 목표!';
  $('statScore').textContent=score+'/'+TOTAL_ROUNDS;
  $('statStreak').textContent=bestStreak+'회';
  push(setTimeout(()=>showScreen(resultScreen),400));
}
