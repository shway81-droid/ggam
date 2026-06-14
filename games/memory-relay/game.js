/* games/memory-relay/game.js
   기억 이어가기 — 협력 시퀀스 릴레이 (패턴 C)
   차례대로 색 순서를 따라 누르고 새 색 1개를 추가해 함께 길게 이어간다. */
'use strict';

var COLORS = [
  { key: 'red',    bg: '#EF5350', name: '빨강', emoji: '🔴' },
  { key: 'blue',   bg: '#42A5F5', name: '파랑', emoji: '🔵' },
  { key: 'green',  bg: '#66BB6A', name: '초록', emoji: '🟢' },
  { key: 'yellow', bg: '#FFEE58', name: '노랑', emoji: '🟡' }
];
var MAX_LEN = 12;      // 이 길이에 도달하면 승리
var SUCCESS_LEN = 6;   // 성공 기준
var TURN_TIME = 20;    // 차례당 제한 시간(초)
var FLASH_ON = 460;    // 패드 점등 시간(ms)
var FLASH_GAP = 220;   // 점등 간격(ms)

var playerCount = 2;
var turnIdx = 0;
var seq = [];
var inputPos = 0;
var phase = 'idle';    // idle | flash | input
var turnTimer = null;
var allTimeouts = [];
var padEls = {};

var sfx = createSoundManager({
  beep(ctx){const o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.value=660;g.gain.setValueAtTime(.18,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.12);o.connect(g);g.connect(ctx.destination);o.start();o.stop(ctx.currentTime+.12);},
  tap(ctx){const o=ctx.createOscillator(),g=ctx.createGain();o.type='triangle';o.frequency.value=520;g.gain.setValueAtTime(.16,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.08);o.connect(g);g.connect(ctx.destination);o.start();o.stop(ctx.currentTime+.08);},
  add(ctx){[660,990].forEach((f,i)=>{const o=ctx.createOscillator(),g=ctx.createGain();o.type='triangle';o.frequency.value=f;const t=ctx.currentTime+i*.09;g.gain.setValueAtTime(.2,t);g.gain.exponentialRampToValueAtTime(.001,t+.22);o.connect(g);g.connect(ctx.destination);o.start(t);o.stop(t+.25);});},
  wrong(ctx){const o=ctx.createOscillator(),g=ctx.createGain();o.type='sawtooth';o.frequency.setValueAtTime(180,ctx.currentTime);o.frequency.exponentialRampToValueAtTime(70,ctx.currentTime+.3);g.gain.setValueAtTime(.25,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.32);o.connect(g);g.connect(ctx.destination);o.start();o.stop(ctx.currentTime+.35);},
  end(ctx){[523,659,784,1047].forEach((f,i)=>{const o=ctx.createOscillator(),g=ctx.createGain();o.type='triangle';o.frequency.value=f;const t=ctx.currentTime+i*.1;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.26,t+.05);g.gain.exponentialRampToValueAtTime(.001,t+.5);o.connect(g);g.connect(ctx.destination);o.start(t);o.stop(t+.55);});}
});

var $ = id => document.getElementById(id);
var introScreen=$('introScreen'),countdownScreen=$('countdownScreen'),gameScreen=$('gameScreen'),resultScreen=$('resultScreen');
var countdownNum=$('countdownNumber'),hudTurn=$('hudTurn'),hudLen=$('hudLen'),hudFill=$('hudTimerFill');
var padGrid=$('padGrid'),seqProgress=$('seqProgress'),banner=$('banner');

function showScreen(el){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));void el.offsetWidth;el.classList.add('active');}
function push(t){allTimeouts.push(t);return t;}
function clearAll(){allTimeouts.forEach(clearTimeout);allTimeouts=[];}
function colorByKey(k){for(var i=0;i<COLORS.length;i++)if(COLORS[i].key===k)return COLORS[i];return COLORS[0];}
function randItem(a){return a[Math.floor(Math.random()*a.length)];}

// ── 인원 선택 ──
document.querySelectorAll('.player-btn').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.player-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    playerCount=parseInt(btn.dataset.count,10);
  });
});

// ── 사운드 토글 ──
$('backBtn').addEventListener('click',()=>{stopAll();goHome();});
var stI=$('soundToggleIntro');
stI.addEventListener('click',()=>{stI.textContent=sfx.toggleMute()?'🔇':'🔊';});
stI.textContent=sfx.isMuted()?'🔇':'🔊';
var stG=$('soundToggleGame');
stG.addEventListener('click',()=>{stG.textContent=sfx.toggleMute()?'🔇':'🔊';});

onTap($('playBtn'),startCountdown);
onTap($('retryBtn'),startCountdown);
onTap($('homeBtn'),()=>{stopAll();goHome();});
onTap($('closeBtn'),()=>{stopAll();goHome();});

function stopAll(){clearAll();if(turnTimer){turnTimer.stop();turnTimer=null;}phase='idle';}

function startCountdown(){
  stopAll();showScreen(countdownScreen);
  var n=3;countdownNum.textContent=n;
  function tick(){n--;if(n<=0){countdownNum.textContent='GO!';push(setTimeout(startGame,600));}else{countdownNum.textContent=n;push(setTimeout(tick,1000));}}
  push(setTimeout(tick,1000));
}

function buildPads(){
  padGrid.innerHTML='';
  padEls={};
  COLORS.forEach(c=>{
    var p=document.createElement('button');
    p.className='pad';
    p.style.background=c.bg;
    p.dataset.key=c.key;
    p.setAttribute('aria-label',c.name);
    onTap(p,()=>handlePad(c.key));
    padGrid.appendChild(p);
    padEls[c.key]=p;
  });
}

function lightPad(key,strong){
  var p=padEls[key];
  if(!p)return;
  p.classList.add('lit');
  push(setTimeout(()=>{p.classList.remove('lit');},strong?FLASH_ON:240));
}

function disablePads(dis){
  Object.keys(padEls).forEach(k=>{padEls[k].disabled=dis;});
}

function renderProgress(){
  seqProgress.innerHTML='';
  for(var i=0;i<seq.length;i++){
    var d=document.createElement('div');
    d.className='prog-dot';
    if(phase==='input'&&i<inputPos){
      var c=colorByKey(seq[i]);
      d.style.background=c.bg;
      d.classList.add('done');
    }
    seqProgress.appendChild(d);
  }
  // 추가될 새 칸 표시
  var add=document.createElement('div');
  add.className='prog-dot add';
  add.textContent='+';
  seqProgress.appendChild(add);
}

function showBanner(txt,cls){
  banner.textContent=txt;
  banner.className='banner '+(cls||'')+' show';
}

function startGame(){
  seq=[];turnIdx=0;phase='idle';
  stG.textContent=sfx.isMuted()?'🔇':'🔊';
  showScreen(gameScreen);
  buildPads();
  startTurn();
}

function startTurn(){
  phase='idle';
  inputPos=0;
  disablePads(true);
  hudTurn.textContent='P'+(turnIdx+1)+' 차례';
  hudLen.textContent=seq.length+'칸';
  renderProgress();
  if(seq.length>0){
    showBanner('👀 P'+(turnIdx+1)+': 순서를 잘 보세요!','info');
    flashSequence();
  }else{
    showBanner('🎬 P'+(turnIdx+1)+': 첫 색을 골라 시작!','info');
    push(setTimeout(beginInput,500));
  }
}

function flashSequence(){
  phase='flash';
  var i=0;
  function step(){
    if(i>=seq.length){
      push(setTimeout(beginInput,420));
      return;
    }
    lightPad(seq[i],true);
    sfx.play('beep');
    i++;
    push(setTimeout(step,FLASH_ON+FLASH_GAP));
  }
  push(setTimeout(step,400));
}

function beginInput(){
  phase='input';
  inputPos=0;
  disablePads(false);
  renderProgress();
  if(seq.length>0){
    showBanner('🎮 P'+(turnIdx+1)+': 순서대로 누르고 새 색 추가!','info');
  }else{
    showBanner('🎮 P'+(turnIdx+1)+': 새 색 1개를 골라요!','info');
  }
  startTurnTimer();
}

function startTurnTimer(){
  if(turnTimer)turnTimer.stop();
  hudFill.style.width='100%';
  hudFill.className='hud-timer-fill';
  turnTimer=createTimer(TURN_TIME,function(rem){
    var pct=(rem/TURN_TIME)*100;
    hudFill.style.width=pct+'%';
    if(rem<=5)hudFill.className='hud-timer-fill danger';
  },function(){fail('⏰ 시간 초과!');});
  turnTimer.start();
}

function handlePad(key){
  if(phase!=='input')return;
  lightPad(key,false);

  if(inputPos<seq.length){
    // 재현 단계
    if(key===seq[inputPos]){
      sfx.play('tap');
      inputPos++;
      renderProgress();
      if(inputPos===seq.length){
        showBanner('➕ 이제 새 색 1개를 추가!','ok');
      }
    }else{
      fail('❌ 순서가 달라요!');
    }
  }else{
    // 추가 단계
    seq.push(key);
    sfx.play('add');
    turnSuccess();
  }
}

function turnSuccess(){
  phase='idle';
  if(turnTimer){turnTimer.pause();}
  disablePads(true);
  hudLen.textContent=seq.length+'칸';
  renderProgress();

  if(seq.length>=MAX_LEN){
    showBanner('🏆 최고 길이 달성!','ok');
    push(setTimeout(()=>endGame(true),getAutoplayPauseMs(1400)));
    return;
  }
  showBanner('✅ 좋아요! '+seq.length+'칸 완성!','ok');
  turnIdx=(turnIdx+1)%playerCount;
  push(setTimeout(startTurn,getAutoplayPauseMs(1500)));
}

function fail(msg){
  if(phase==='idle')return;
  phase='idle';
  if(turnTimer){turnTimer.pause();}
  disablePads(true);
  sfx.play('wrong');
  var ans=seq.map(k=>colorByKey(k).emoji).join(' ');
  showBanner(msg+(seq.length?' 정답: '+ans:''),'ng');
  push(setTimeout(()=>endGame(false),getAutoplayPauseMs(2200)));
}

function endGame(won){
  stopAll();
  sfx.play('end');
  var len=seq.length;
  var success=len>=SUCCESS_LEN;
  $('resultEmoji').textContent=success?'🏆':'🙂';
  $('resultHeadline').textContent=success?'대단해요!':'좋은 도전!';
  $('resultHeadline').className='result-headline '+(success?'success':'fail');
  $('resultSub').textContent=success?('함께 '+len+'칸이나 이어갔어요!'):('다음엔 '+SUCCESS_LEN+'칸을 넘겨봐요!');
  $('statLen').textContent=len+'칸';
  push(setTimeout(()=>showScreen(resultScreen),400));
}

window.addEventListener('beforeunload',stopAll);
window.addEventListener('pagehide',stopAll);
