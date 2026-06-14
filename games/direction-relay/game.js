/* direction-relay */
'use strict';

const TOTAL_ROUNDS = 5;
const DIRECTIONS = [
  { key:'up',    arrow:'↑', name:'위' },
  { key:'right', arrow:'→', name:'오른쪽' },
  { key:'down',  arrow:'↓', name:'아래' },
  { key:'left',  arrow:'←', name:'왼쪽' },
];
const ROUND_LENS = [3,3,4,4,5];
const REVEAL_STEP = 900;
const ROUND_TIME = 12;

// ── Pre-defined sequence pool (30+ entries for data diversity) ──
// Each entry is an array of direction keys. Lengths vary 3-5.
const ALL_SEQUENCES = [
  ['up','right','down'],
  ['left','down','right'],
  ['right','up','left'],
  ['down','left','up'],
  ['up','up','right'],
  ['right','right','down'],
  ['left','up','up'],
  ['down','down','left'],
  ['up','left','right','down'],
  ['right','down','left','up'],
  ['down','right','up','left'],
  ['left','up','right','down'],
  ['up','right','right','down'],
  ['left','left','up','right'],
  ['down','up','down','up'],
  ['right','left','right','left'],
  ['up','down','left','right'],
  ['down','left','down','right'],
  ['up','right','up','left','down'],
  ['left','down','right','up','right'],
  ['right','up','down','left','up'],
  ['down','right','left','up','down'],
  ['up','up','left','left','down'],
  ['right','right','down','down','left'],
  ['left','left','up','up','right'],
  ['down','down','right','right','up'],
  ['up','left','down','right','up'],
  ['right','up','left','down','right'],
  ['down','up','left','right','down'],
  ['left','right','up','down','left'],
  ['up','down','up','down','up'],
  ['right','left','right','left','right'],
];

let round=0,score=0,perfect=0;
let seq=[],input=[],roundActive=false,roundTimer=null,allTimeouts=[];
let usedSeqIndices = [];

const sfx=createSoundManager({
  beep(ctx){const o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.value=660;g.gain.setValueAtTime(.18,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.1);o.connect(g);g.connect(ctx.destination);o.start();o.stop(ctx.currentTime+.1);},
  tap(ctx){const o=ctx.createOscillator(),g=ctx.createGain();o.type='triangle';o.frequency.value=440;g.gain.setValueAtTime(.15,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.08);o.connect(g);g.connect(ctx.destination);o.start();o.stop(ctx.currentTime+.08);},
  correct(ctx){[523,784,1047].forEach((f,i)=>{const o=ctx.createOscillator(),g=ctx.createGain();o.type='triangle';o.frequency.value=f;const t=ctx.currentTime+i*.08;g.gain.setValueAtTime(.22,t);g.gain.exponentialRampToValueAtTime(.001,t+.3);o.connect(g);g.connect(ctx.destination);o.start(t);o.stop(t+.35);});},
  wrong(ctx){const o=ctx.createOscillator(),g=ctx.createGain();o.type='sawtooth';o.frequency.setValueAtTime(180,ctx.currentTime);o.frequency.exponentialRampToValueAtTime(80,ctx.currentTime+.3);g.gain.setValueAtTime(.25,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.32);o.connect(g);g.connect(ctx.destination);o.start();o.stop(ctx.currentTime+.35);},
  end(ctx){[523,659,784,1047].forEach((f,i)=>{const o=ctx.createOscillator(),g=ctx.createGain();o.type='triangle';o.frequency.value=f;const t=ctx.currentTime+i*.1;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.28,t+.05);g.gain.exponentialRampToValueAtTime(.001,t+.5);o.connect(g);g.connect(ctx.destination);o.start(t);o.stop(t+.55);});}
});

const $ = id=>document.getElementById(id);
const introScreen=$('introScreen'),countdownScreen=$('countdownScreen'),gameScreen=$('gameScreen'),resultScreen=$('resultScreen');
const countdownNum=$('countdownNumber'),hudRound=$('hudRound'),hudScore=$('hudScore'),hudFill=$('hudTimerFill');
const seqSlots=$('seqSlots'),inputRow=$('inputRow'),dirGrid=$('dirGrid'),banner=$('banner');

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

function stopAll(){clearAll();if(roundTimer){roundTimer.stop();roundTimer=null;}roundActive=false;}

function startCountdown(){
  stopAll();showScreen(countdownScreen);
  let n=3;countdownNum.textContent=n;
  function tick(){n--;if(n<=0){countdownNum.textContent='GO!';push(setTimeout(startGame,700));}else{countdownNum.textContent=n;push(setTimeout(tick,1000));}}
  push(setTimeout(tick,1000));
}

function startGame(){
  round=0;score=0;perfect=0;
  usedSeqIndices = [];
  stG.textContent=sfx.isMuted()?'🔇':'🔊';
  showScreen(gameScreen);
  buildDirGrid();
  nextRound();
}

function buildDirGrid(){
  dirGrid.innerHTML='';
  // Order: up, right, down, left as 2x2 grid
  DIRECTIONS.forEach(d=>{
    const b=document.createElement('button');
    b.className='dir-btn';
    b.dataset.key=d.key;
    b.textContent=d.arrow;
    b.setAttribute('aria-label', d.name);
    onTap(b,()=>handleInput(d.key));
    dirGrid.appendChild(b);
  });
}

// Pick a sequence from pool matching desired length, without repeating within game
function pickSequence(len){
  const candidates = ALL_SEQUENCES
    .map((s, idx) => ({ s, idx }))
    .filter(({ s, idx }) => s.length === len && !usedSeqIndices.includes(idx));
  if (candidates.length === 0) {
    // Fallback: random generation if pool exhausted for this length
    const out = [];
    for (let i = 0; i < len; i++) out.push(DIRECTIONS[Math.floor(Math.random()*DIRECTIONS.length)].key);
    return out;
  }
  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  usedSeqIndices.push(pick.idx);
  return pick.s.slice();
}

function nextRound(){
  if(round>=TOTAL_ROUNDS){endGame();return;}
  round++;
  const len=ROUND_LENS[round-1];
  seq = pickSequence(len);
  input=[];
  roundActive=false;
  hudRound.textContent=round+'/'+TOTAL_ROUNDS;
  hudScore.textContent=score+'점';
  renderSlots(true);
  renderInputDots();
  disableInputs(true);
  showBanner('👁 P1: 집중해서 보세요!','info');
  revealSequence();
}

function renderSlots(hidden){
  seqSlots.innerHTML='';
  seq.forEach((k,i)=>{
    const s=document.createElement('div');
    s.className='seq-slot';
    if(!hidden){
      const d=DIRECTIONS.find(x=>x.key===k);
      s.classList.add('filled');
      s.textContent=d.arrow;
      // Pastel color by direction
      const bgMap = { up:'#B3E5FC', right:'#FFCDD2', down:'#C8E6C9', left:'#FFE0B2' };
      s.style.background=bgMap[k];
    }else{
      s.textContent=(i+1);
    }
    seqSlots.appendChild(s);
  });
}

function renderInputDots(){
  inputRow.innerHTML='';
  seq.forEach((_,i)=>{
    const d=document.createElement('div');
    d.className='input-dot';
    if(input[i]!=null){
      const dir=DIRECTIONS.find(x=>x.key===input[i]);
      d.classList.add('filled');
      d.textContent=dir.arrow;
    }
    inputRow.appendChild(d);
  });
}

function disableInputs(dis){
  dirGrid.querySelectorAll('.dir-btn').forEach(b=>b.disabled=dis);
}

function revealSequence(){
  let i=0;
  function step(){
    if(i>=seq.length){
      push(setTimeout(()=>{
        startInputPhase();
      },800));
      return;
    }
    const slot=seqSlots.children[i];
    const d=DIRECTIONS.find(x=>x.key===seq[i]);
    const bgMap = { up:'#B3E5FC', right:'#FFCDD2', down:'#C8E6C9', left:'#FFE0B2' };
    slot.style.background=bgMap[seq[i]];
    slot.classList.add('filled');
    slot.textContent=d.arrow;
    sfx.play('beep');
    i++;
    push(setTimeout(step,REVEAL_STEP));
  }
  push(setTimeout(step,400));
}

function startInputPhase(){
  roundActive=true;
  disableInputs(false);
  showBanner('🗣 P1: 순서를 말해주세요!','info');
  if(roundTimer)roundTimer.stop();
  hudFill.style.width='100%';
  hudFill.className='hud-timer-fill';
  roundTimer=createTimer(ROUND_TIME,rem=>{
    const pct=(rem/ROUND_TIME)*100;
    hudFill.style.width=pct+'%';
    if(rem<=5)hudFill.className='hud-timer-fill danger';
  },()=>{evaluate(false);});
  roundTimer.start();
}

function handleInput(key){
  if(!roundActive)return;
  sfx.play('tap');
  input.push(key);
  renderInputDots();
  const idx=input.length-1;
  if(input[idx]!==seq[idx]){
    evaluate(false);
    return;
  }
  if(input.length===seq.length){
    evaluate(true);
  }
}

function evaluate(correct){
  if(!roundActive)return;
  roundActive=false;
  if(roundTimer)roundTimer.pause();
  disableInputs(true);
  if(correct){
    score++;perfect++;
    sfx.play('correct');
    showBanner('🎉 정답! 완벽한 해독!','ok');
  }else{
    sfx.play('wrong');
    const arrows = seq.map(k=>DIRECTIONS.find(d=>d.key===k).arrow).join(' ');
    showBanner('❌ 실패! 정답: '+arrows,'ng');
  }
  hudScore.textContent=score+'점';
  push(setTimeout(nextRound,2200));
}

function showBanner(txt,cls){
  banner.textContent=txt;
  banner.className='banner '+cls+' show';
}

function endGame(){
  stopAll();
  sfx.play('end');
  const success=score>=3;
  $('resultEmoji').textContent=success?'🏆':'😔';
  $('resultHeadline').textContent=success?'방향 해독 성공!':'아쉬워요...';
  $('resultHeadline').className='result-headline '+(success?'success':'fail');
  $('resultSub').textContent=success?'호흡이 잘 맞았어요!':'3라운드 이상 성공이 목표!';
  $('statScore').textContent=score+'/'+TOTAL_ROUNDS;
  $('statPerfect').textContent=perfect+'회';
  push(setTimeout(()=>showScreen(resultScreen),400));
}
