/* half-match — 패턴 C 협력형: P1만 보기 → 말로 설명 → P2가 4장 중 정답 카드 선택 */
'use strict';

const TOTAL_ROUNDS = 5;
const SHOW_TIME = 8;     // P1 목표 그림 표시 시간(초)
const CHOOSE_TIME = 15;  // P2 선택 제한 시간(초)
const SUCCESS_NEED = 3;  // 협력 성공 기준 점수

// 요소 그룹: 오답은 반드시 같은 그룹 내 다른 요소로 교체 → "한 요소만 다름" 보장
const GROUPS = {
  hat:    ['🎩','🧢','👒','👑'],
  buddy:  ['⛄','🐧','🤖','🐻'],
  sky:    ['🌈','☀️','🌙','❄️'],
  home:   ['🏠','🏰','⛺','🏫'],
  ride:   ['🚗','🚌','🚓','🚲'],
  animal: ['🦁','🐯','🐱','🐶'],
  fruit:  ['🍎','🍊','🍇','🍉'],
  flower: ['🌸','🌻','🌷','🌹']
};

// 목표 그림 풀 12개: {tg: 상단 그룹, ti: 상단 인덱스, bg: 하단 그룹, bi: 하단 인덱스}
const COMBOS = [
  { tg:'hat',    ti:0, bg:'buddy',  bi:0 }, // 🎩+⛄
  { tg:'hat',    ti:3, bg:'animal', bi:0 }, // 👑+🦁
  { tg:'sky',    ti:0, bg:'home',   bi:0 }, // 🌈+🏠
  { tg:'hat',    ti:1, bg:'buddy',  bi:1 }, // 🧢+🐧
  { tg:'sky',    ti:1, bg:'flower', bi:1 }, // ☀️+🌻
  { tg:'fruit',  ti:0, bg:'ride',   bi:0 }, // 🍎+🚗
  { tg:'sky',    ti:3, bg:'home',   bi:1 }, // ❄️+🏰
  { tg:'flower', ti:2, bg:'animal', bi:2 }, // 🌷+🐱
  { tg:'fruit',  ti:3, bg:'buddy',  bi:2 }, // 🍉+🤖
  { tg:'ride',   ti:2, bg:'animal', bi:3 }, // 🚓+🐶
  { tg:'hat',    ti:2, bg:'flower', bi:0 }, // 👒+🌸
  { tg:'sky',    ti:2, bg:'home',   bi:2 }  // 🌙+⛺
];

let round=0,score=0,streak=0,bestStreak=0;
let roundPool=[],target=null,choices=[];
let roundActive=false,roundTimer=null,allTimeouts=[];

const sfx=createSoundManager({
  beep(ctx){const o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.value=660;g.gain.setValueAtTime(.18,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.1);o.connect(g);g.connect(ctx.destination);o.start();o.stop(ctx.currentTime+.1);},
  tap(ctx){const o=ctx.createOscillator(),g=ctx.createGain();o.type='triangle';o.frequency.value=440;g.gain.setValueAtTime(.15,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.08);o.connect(g);g.connect(ctx.destination);o.start();o.stop(ctx.currentTime+.08);},
  correct(ctx){[523,784,1047].forEach((f,i)=>{const o=ctx.createOscillator(),g=ctx.createGain();o.type='triangle';o.frequency.value=f;const t=ctx.currentTime+i*.08;g.gain.setValueAtTime(.22,t);g.gain.exponentialRampToValueAtTime(.001,t+.3);o.connect(g);g.connect(ctx.destination);o.start(t);o.stop(t+.35);});},
  clap(ctx){
    // 박수: 짧은 노이즈 버스트 4회
    for(let i=0;i<4;i++){
      const t=ctx.currentTime+i*.13;
      const len=Math.floor(ctx.sampleRate*.06);
      const buf=ctx.createBuffer(1,len,ctx.sampleRate);
      const d=buf.getChannelData(0);
      for(let j=0;j<len;j++)d[j]=(Math.random()*2-1)*(1-j/len);
      const src=ctx.createBufferSource();src.buffer=buf;
      const bp=ctx.createBiquadFilter();bp.type='bandpass';bp.frequency.value=1100+i*180;bp.Q.value=1.2;
      const g=ctx.createGain();g.gain.setValueAtTime(.3,t);g.gain.exponentialRampToValueAtTime(.001,t+.07);
      src.connect(bp);bp.connect(g);g.connect(ctx.destination);
      src.start(t);src.stop(t+.08);
    }
  },
  wrong(ctx){const o=ctx.createOscillator(),g=ctx.createGain();o.type='sawtooth';o.frequency.setValueAtTime(180,ctx.currentTime);o.frequency.exponentialRampToValueAtTime(80,ctx.currentTime+.3);g.gain.setValueAtTime(.25,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.32);o.connect(g);g.connect(ctx.destination);o.start();o.stop(ctx.currentTime+.35);},
  end(ctx){[523,659,784,1047].forEach((f,i)=>{const o=ctx.createOscillator(),g=ctx.createGain();o.type='triangle';o.frequency.value=f;const t=ctx.currentTime+i*.1;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.28,t+.05);g.gain.exponentialRampToValueAtTime(.001,t+.5);o.connect(g);g.connect(ctx.destination);o.start(t);o.stop(t+.55);});}
});

const $ = id=>document.getElementById(id);
const introScreen=$('introScreen'),countdownScreen=$('countdownScreen'),gameScreen=$('gameScreen'),resultScreen=$('resultScreen');
const countdownNum=$('countdownNumber'),hudRound=$('hudRound'),hudScore=$('hudScore'),hudFill=$('hudTimerFill');
const banner=$('banner'),targetWrap=$('targetWrap'),targetCard=$('targetCard'),targetTop=$('targetTop'),targetBottom=$('targetBottom');
const targetLabel=$('targetLabel'),targetHint=$('targetHint'),choicesEl=$('choices'),clapLayer=$('clapLayer');
const roleOverlay=$('roleOverlay'),roleEmoji=$('roleEmoji'),roleTitle=$('roleTitle'),roleDesc=$('roleDesc'),roleBtn=$('roleBtn');

function showScreen(el){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));void el.offsetWidth;el.classList.add('active');}
function push(t){allTimeouts.push(t);return t;}
function clearAll(){allTimeouts.forEach(clearTimeout);allTimeouts=[];}
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function emojiOf(c){return {top:GROUPS[c.tg][c.ti],bottom:GROUPS[c.bg][c.bi]};}
function sameCombo(a,b){return a.tg===b.tg&&a.ti===b.ti&&a.bg===b.bg&&a.bi===b.bi;}

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

let roleAction=null;
onTap(roleBtn,()=>{if(roleAction){const fn=roleAction;roleAction=null;sfx.play('tap');fn();}});

function stopAll(){clearAll();if(roundTimer){roundTimer.stop();roundTimer=null;}roundActive=false;}

function startCountdown(){
  stopAll();showScreen(countdownScreen);
  let n=3;countdownNum.textContent=n;
  function tick(){n--;if(n<=0){countdownNum.textContent='GO!';push(setTimeout(startGame,700));}else{countdownNum.textContent=n;push(setTimeout(tick,1000));}}
  push(setTimeout(tick,1000));
}

function startGame(){
  round=0;score=0;streak=0;bestStreak=0;
  roundPool=shuffle([...COMBOS]).slice(0,TOTAL_ROUNDS);
  stG.textContent=sfx.isMuted()?'🔇':'🔊';
  showScreen(gameScreen);
  nextRound();
}

function nextRound(){
  if(round>=TOTAL_ROUNDS){endGame();return;}
  round++;
  target=roundPool[round-1];
  choices=buildChoices(target);
  roundActive=false;
  hudRound.textContent=round+'/'+TOTAL_ROUNDS;
  hudScore.textContent=score+'점';
  hudFill.style.width='100%';
  hudFill.className='hud-timer-fill';
  choicesEl.innerHTML='';
  renderTarget(false);
  showBanner('🧩 라운드 '+round+' 시작!','info');
  showRoleOverlay('👁','P1만 보세요!','P2는 잠깐 화면을 보지 마세요!\n확인을 누르면 목표 그림이 '+SHOW_TIME+'초간 나와요.','P1 준비 완료!',startShowPhase);
}

// 정답과 "한 요소만" 다른 오답 3개 생성 (같은 그룹 내 교체만 허용)
function buildChoices(ans){
  const variants=[];
  GROUPS[ans.tg].forEach((_,i)=>{
    if(i!==ans.ti)variants.push({tg:ans.tg,ti:i,bg:ans.bg,bi:ans.bi}); // 상단만 교체
  });
  GROUPS[ans.bg].forEach((_,i)=>{
    if(i!==ans.bi)variants.push({tg:ans.tg,ti:ans.ti,bg:ans.bg,bi:i}); // 하단만 교체
  });
  const wrongs=shuffle(variants).slice(0,3);
  return shuffle([Object.assign({},ans),...wrongs]);
}

function showRoleOverlay(emoji,title,desc,btnText,onConfirm){
  roleEmoji.textContent=emoji;
  roleTitle.textContent=title;
  roleDesc.innerHTML='';
  desc.split('\n').forEach((line,i)=>{
    if(i>0)roleDesc.appendChild(document.createElement('br'));
    roleDesc.appendChild(document.createTextNode(line));
  });
  roleBtn.textContent=btnText;
  roleAction=onConfirm;
  roleOverlay.classList.remove('hide');
}
function hideRoleOverlay(){roleOverlay.classList.add('hide');}

function renderTarget(visible){
  const e=emojiOf(target);
  if(visible){
    targetCard.classList.remove('hidden-card');
    targetTop.textContent=e.top;
    targetBottom.textContent=e.bottom;
    targetLabel.textContent='🎯 목표 그림';
    targetHint.textContent='P1: 잘 기억해 두세요!';
  }else{
    targetCard.classList.add('hidden-card');
    targetTop.textContent='❓';
    targetBottom.textContent='❓';
    targetLabel.textContent='🎯 목표 그림';
    targetHint.textContent='';
  }
}

// 1단계: P1에게 목표 그림 8초간 표시
function startShowPhase(){
  hideRoleOverlay();
  renderTarget(true);
  sfx.play('beep');
  showBanner('👁 P1: 그림을 잘 보세요! ('+SHOW_TIME+'초)','info');
  if(roundTimer)roundTimer.stop();
  hudFill.style.width='100%';
  hudFill.className='hud-timer-fill';
  roundTimer=createTimer(SHOW_TIME,rem=>{
    const pct=(rem/SHOW_TIME)*100;
    hudFill.style.width=pct+'%';
    if(rem<=2)hudFill.className='hud-timer-fill danger';
  },()=>{
    renderTarget(false);
    sfx.play('beep');
    showRoleOverlay('🗣','P2 차례!','P1은 그림을 말로 설명해 주세요!\nP2는 설명을 듣고 정답 카드를 골라요.','P2 시작!',startChoosePhase);
  });
  roundTimer.start();
}

// 2단계: P2가 4개 후보 카드 중 선택 (15초)
function startChoosePhase(){
  hideRoleOverlay();
  renderTarget(false);
  targetHint.textContent='P1의 설명을 잘 들어요!';
  choicesEl.innerHTML='';
  choices.forEach((c,idx)=>{
    const e=emojiOf(c);
    const b=document.createElement('button');
    b.className='choice-card';
    b.dataset.idx=idx;
    const top=document.createElement('div');top.className='combo-emoji';top.textContent=e.top;
    const bot=document.createElement('div');bot.className='combo-emoji';bot.textContent=e.bottom;
    b.appendChild(top);b.appendChild(bot);
    onTap(b,()=>handleChoice(idx));
    choicesEl.appendChild(b);
  });
  roundActive=true;
  showBanner('🎮 P2: 정답 카드를 골라요! ('+CHOOSE_TIME+'초)','info');
  if(roundTimer)roundTimer.stop();
  hudFill.style.width='100%';
  hudFill.className='hud-timer-fill';
  roundTimer=createTimer(CHOOSE_TIME,rem=>{
    const pct=(rem/CHOOSE_TIME)*100;
    hudFill.style.width=pct+'%';
    if(rem<=5)hudFill.className='hud-timer-fill danger';
  },()=>{evaluate(-1);});
  roundTimer.start();
}

function handleChoice(idx){
  if(!roundActive)return;
  evaluate(idx);
}

function evaluate(pickedIdx){
  if(!roundActive&&pickedIdx>=0)return;
  roundActive=false;
  if(roundTimer)roundTimer.pause();
  const cards=choicesEl.querySelectorAll('.choice-card');
  cards.forEach(b=>b.disabled=true);
  const answerIdx=choices.findIndex(c=>sameCombo(c,target));
  const correct=pickedIdx===answerIdx;
  renderTarget(true); // 목표 그림 공개
  if(correct){
    score++;streak++;if(streak>bestStreak)bestStreak=streak;
    sfx.play('correct');
    sfx.play('clap');
    cards[answerIdx].classList.add('correct');
    cards.forEach((b,i)=>{if(i!==answerIdx)b.classList.add('dim');});
    spawnClaps();
    showBanner('🎉 정답! 둘이 함께 박수! 👏👏','ok');
  }else{
    streak=0;
    sfx.play('wrong');
    if(pickedIdx>=0)cards[pickedIdx].classList.add('wrong-pick');
    cards[answerIdx].classList.add('correct');
    cards.forEach((b,i)=>{if(i!==answerIdx&&i!==pickedIdx)b.classList.add('dim');});
    const e=emojiOf(target);
    showBanner(pickedIdx<0?'⏰ 시간 초과! 정답은 '+e.top+e.bottom:'❌ 아쉬워요! 정답은 '+e.top+e.bottom,'ng');
  }
  hudScore.textContent=score+'점';
  push(setTimeout(nextRound,getAutoplayPauseMs(2400)));
}

function spawnClaps(){
  for(let i=0;i<10;i++){
    const s=document.createElement('span');
    s.className='clap-emoji';
    s.textContent=Math.random()<0.7?'👏':'🎉';
    s.style.left=(5+Math.random()*90)+'%';
    s.style.animationDelay=(Math.random()*0.4)+'s';
    clapLayer.appendChild(s);
    push(setTimeout(()=>s.remove(),2000));
  }
}

function showBanner(txt,cls){
  banner.textContent=txt;
  banner.className='banner '+cls+' show';
}

function endGame(){
  stopAll();
  sfx.play('end');
  const success=score>=SUCCESS_NEED;
  if(success)sfx.play('clap');
  $('resultEmoji').textContent=success?'🏆':'😔';
  $('resultHeadline').textContent=success?'협력 성공!':'아쉬워요...';
  $('resultHeadline').className='result-headline '+(success?'success':'fail');
  $('resultSub').textContent=success?'설명이 찰떡같았어요!':SUCCESS_NEED+'번 이상 성공이 목표!';
  $('statScore').textContent=score+'/'+TOTAL_ROUNDS;
  $('statStreak').textContent=bestStreak+'회';
  push(setTimeout(()=>showScreen(resultScreen),400));
}
