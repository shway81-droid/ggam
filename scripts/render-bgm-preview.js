#!/usr/bin/env node
/**
 * BGM 후보 10곡 미리듣기 WAV 렌더러
 * 엔진(Web Audio 합성)과 같은 원리를 오프라인 PCM 합성으로 재현.
 * 사용: node scripts/render-bgm-preview.js  →  bgm-preview/*.wav
 */
'use strict';
const fs = require('fs');
const path = require('path');

const SR = 44100;
const OUT_DIR = path.join(__dirname, '..', 'bgm-preview');

function nf(n) { return 440 * Math.pow(2, (n - 69) / 12); }

/* ── 오실레이터 ── */
function oscSample(type, phase) {
  const p = phase % 1;
  switch (type) {
    case 'sine': return Math.sin(2 * Math.PI * p);
    case 'square': return p < 0.5 ? 1 : -1;
    case 'saw': return 2 * p - 1;
    case 'triangle': return p < 0.5 ? 4 * p - 1 : 3 - 4 * p;
    default: return Math.sin(2 * Math.PI * p);
  }
}

/* ── 렌더 버퍼 ── */
function makeBuf(seconds) { return new Float64Array(Math.ceil(seconds * SR)); }

/* 음 하나 합성: attack-decay 엔벨로프 (+비브라토/글라이드 옵션) */
function addNote(buf, t, dur, freq, type, gain, opt) {
  opt = opt || {};
  const attack = opt.attack !== undefined ? opt.attack : 0.012;
  const start = Math.floor(t * SR);
  const len = Math.floor((dur + 0.03) * SR);
  let phase = 0;
  const vibDepth = opt.vibrato ? 0.012 : 0; // 비브라토 ±1.2%
  const vibRate = 5.5;
  for (let i = 0; i < len; i++) {
    const idx = start + i;
    if (idx < 0 || idx >= buf.length) continue;
    const tt = i / SR;
    let f = freq;
    if (opt.glideTo) f = freq + (opt.glideTo - freq) * Math.min(tt / dur, 1);
    if (vibDepth) f *= 1 + vibDepth * Math.sin(2 * Math.PI * vibRate * tt);
    phase += f / SR;
    // 엔벨로프
    let env;
    if (tt < attack) env = tt / attack;
    else if (opt.pluck) env = Math.exp(-(tt - attack) * (opt.pluck === true ? 9 : opt.pluck));
    else {
      const relStart = dur * (opt.sustain !== undefined ? opt.sustain : 0.6);
      env = tt < relStart ? 1 : Math.max(0, 1 - (tt - relStart) / (dur - relStart + 0.03));
    }
    buf[idx] += oscSample(type, phase) * gain * env;
  }
}

/* ── 드럼 (노이즈/사인 합성) ── */
function addKick(buf, t, gain) {
  const start = Math.floor(t * SR), len = Math.floor(0.14 * SR);
  let phase = 0;
  for (let i = 0; i < len; i++) {
    const idx = start + i; if (idx < 0 || idx >= buf.length) continue;
    const tt = i / SR;
    const f = 120 * Math.exp(-tt * 22) + 42;
    phase += f / SR;
    buf[idx] += Math.sin(2 * Math.PI * phase) * gain * Math.exp(-tt * 22);
  }
}
function addNoise(buf, t, dur, gain, opt) {
  // opt.hp: 1차 하이패스 느낌(차분), opt.lp: 로우패스 느낌(이동평균)
  opt = opt || {};
  const start = Math.floor(t * SR), len = Math.floor(dur * SR);
  let prev = 0, lpAcc = 0;
  for (let i = 0; i < len; i++) {
    const idx = start + i; if (idx < 0 || idx >= buf.length) continue;
    const tt = i / SR;
    let n = Math.random() * 2 - 1;
    if (opt.hp) { const d = n - prev; prev = n; n = d; }          // 밝은 노이즈 (햇/심벌)
    if (opt.lp) { lpAcc += (n - lpAcc) * opt.lp; n = lpAcc; }    // 둔탁한 노이즈 (스네어 몸통)
    buf[idx] += n * gain * Math.exp(-tt * (opt.decay || 60));
  }
}
function addHat(buf, t, gain) { addNoise(buf, t, 0.05, gain, { hp: true, decay: 80 }); }
function addOpenHat(buf, t, gain) { addNoise(buf, t, 0.22, gain, { hp: true, decay: 16 }); }
function addShaker(buf, t, gain) { addNoise(buf, t, 0.06, gain, { hp: true, decay: 55 }); }
function addSnare(buf, t, gain) {
  addNoise(buf, t, 0.16, gain, { lp: 0.5, decay: 28 });
  addNote(buf, t, 0.07, 190, 'triangle', gain * 0.7, { pluck: 40 });
}
function addClap(buf, t, gain) {
  for (let k = 0; k < 3; k++) addNoise(buf, t + k * 0.011, 0.09, gain * 0.8, { lp: 0.35, decay: 45 });
}
function addRim(buf, t, gain) { addNote(buf, t, 0.045, 820, 'triangle', gain, { pluck: 70 }); }

/* ═══ 트랙 정의 인터프리터 ═══
   def: { bpm, steps(마디당 8분음표 수), loops, swing(0~0.33),
          chords: [[bassMidi,[pad...]] ×4], melody: [midi|null ×(steps*4)],
          lead: {type,gain,pluck?,vibrato?,oct?}, pad: {type,gain,mode:'sustain'|'stab'|null},
          bass: {style:'notes'|'oompah'|'walk', steps:[..], gain, type},
          arp: {gain,type}|null (코드톤 16분 아르페지오),
          drums: {kick:[],snare:[],clap:[],hat:[],openhat:[],rim:[],shaker16:bool} }
*/
function renderTrack(def) {
  const stepDur = (60 / def.bpm) / 2;
  const barDur = stepDur * def.steps;
  const total = barDur * def.chords.length * def.loops + 0.6;
  const buf = makeBuf(total);
  const swing = def.swing || 0;

  function stepTime(globalStep) {
    const base = globalStep * stepDur;
    return (globalStep % 2 === 1) ? base + stepDur * swing : base; // 스윙: 뒷박 밀기
  }

  const totalSteps = def.steps * def.chords.length;
  for (let loop = 0; loop < def.loops; loop++) {
    const loopOff = loop * totalSteps;
    for (let s = 0; s < totalSteps; s++) {
      const bar = Math.floor(s / def.steps);
      const inBar = s % def.steps;
      const chord = def.chords[bar];
      const t = stepTime(loopOff + s);

      // 패드
      if (def.pad && inBar === 0 && def.pad.mode === 'sustain') {
        chord[1].forEach(n => addNote(buf, t, barDur * 0.96, nf(n), def.pad.type, def.pad.gain, { attack: 0.05, sustain: 0.7 }));
      }
      if (def.pad && def.pad.mode === 'stab' && def.pad.steps.indexOf(inBar) !== -1) {
        chord[1].forEach(n => addNote(buf, t, stepDur * 0.9, nf(n), def.pad.type, def.pad.gain, { pluck: 14 }));
      }

      // 베이스
      if (def.bass.style === 'notes' && def.bass.steps.indexOf(inBar) !== -1) {
        addNote(buf, t, stepDur * 1.6, nf(chord[0]), def.bass.type || 'sine', def.bass.gain, { sustain: 0.5 });
      } else if (def.bass.style === 'oompah') {
        if (inBar % 2 === 0) {
          const note = (inBar % 4 === 0) ? chord[0] : chord[0] + 7; // 근음-5음 움파
          addNote(buf, t, stepDur * 0.9, nf(note), 'triangle', def.bass.gain, { pluck: 11 });
        }
      } else if (def.bass.style === 'walk' && inBar % 2 === 0) {
        const tones = [chord[0], chord[0] + 4, chord[0] + 7, chord[0] + 9];
        addNote(buf, t, stepDur * 1.7, nf(tones[(inBar / 2) % 4]), 'sine', def.bass.gain, { sustain: 0.5 });
      } else if (def.bass.style === 'riff16') {
        // 16분 베이스 리프 (스피드런용): 근음 연타 + 옥타브 점프
        for (let h = 0; h < 2; h++) {
          const note = (inBar + h) % 4 === 3 ? chord[0] + 12 : chord[0];
          addNote(buf, t + h * stepDur / 2, stepDur * 0.42, nf(note), 'square', def.bass.gain * 0.8, { pluck: 22 });
        }
      }

      // 아르페지오 (16분)
      if (def.arp) {
        const tones = [chord[1][0], chord[1][1], chord[1][2], chord[1][0] + 12];
        for (let h = 0; h < 2; h++) {
          const tone = tones[(inBar * 2 + h) % 4];
          addNote(buf, t + h * stepDur / 2, stepDur * 0.45, nf(tone), def.arp.type, def.arp.gain, { pluck: 18 });
        }
      }

      // 멜로디
      const m = def.melody[s];
      if (m !== null && m !== undefined) {
        const o = def.lead.oct || 0;
        addNote(buf, t, stepDur * (def.lead.len || 0.92), nf(m + o), def.lead.type, def.lead.gain,
          { pluck: def.lead.pluck, vibrato: def.lead.vibrato, sustain: 0.55 });
      }

      // 드럼
      const d = def.drums || {};
      if ((d.kick || []).indexOf(inBar) !== -1) addKick(buf, t, 0.5);
      if ((d.snare || []).indexOf(inBar) !== -1) addSnare(buf, t, 0.28);
      if ((d.clap || []).indexOf(inBar) !== -1) addClap(buf, t, 0.3);
      if ((d.hat || []).indexOf(inBar) !== -1) addHat(buf, t, 0.14);
      if ((d.openhat || []).indexOf(inBar) !== -1) addOpenHat(buf, t, 0.12);
      if ((d.rim || []).indexOf(inBar) !== -1) addRim(buf, t, 0.2);
      if (d.shaker16) { addShaker(buf, t, 0.09); addShaker(buf, t + stepDur / 2, 0.055); }
    }
  }
  return buf;
}

/* ── WAV 저장 (16bit mono) ── */
function writeWav(file, buf) {
  // 정규화 (피크 0.85)
  let peak = 0;
  for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i]));
  const scale = peak > 0 ? 0.85 / peak : 1;
  const pcm = Buffer.alloc(buf.length * 2);
  for (let i = 0; i < buf.length; i++) {
    pcm.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(buf[i] * scale * 32767))), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0); header.writeUInt32LE(36 + pcm.length, 4); header.write('WAVE', 8);
  header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22); header.writeUInt32LE(SR, 24); header.writeUInt32LE(SR * 2, 28);
  header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
  header.write('data', 36); header.writeUInt32LE(pcm.length, 40);
  fs.writeFileSync(file, Buffer.concat([header, pcm]));
}

/* ═══ 10곡 정의 ═══ */
const _ = null;
const TRACKS = [
  { file: '01_퀴즈쇼로비_124bpm.wav', // Kahoot풍 단조 펑크
    bpm: 124, steps: 8, loops: 2,
    chords: [[36, [60, 63, 67]], [32, [60, 63, 68]], [34, [58, 62, 65]], [31, [58, 62, 67]]],
    melody: [72, _, 70, 72, _, 67, _, 63,  68, _, 67, 68, 70, _, 67, _,
             70, _, 72, 70, 67, _, 65, 63,  62, _, 63, 65, 67, _, _, _],
    lead: { type: 'square', gain: 0.2, pluck: 7 },
    pad: { type: 'saw', gain: 0.05, mode: 'stab', steps: [0, 3, 6] },
    bass: { style: 'notes', steps: [0, 3, 4, 7], gain: 0.4, type: 'triangle' },
    drums: { kick: [0, 4], clap: [2, 6], hat: [1, 3, 5, 7] } },

  { file: '02_슈퍼점프어드벤처_140bpm.wav', // 마리오풍 스윙 치프튠
    bpm: 140, steps: 8, loops: 2, swing: 0.3,
    chords: [[48, [60, 64, 67]], [41, [57, 60, 65]], [43, [55, 59, 62]], [48, [60, 64, 67]]],
    melody: [76, _, 76, _, 76, _, 72, 76,  79, _, _, _, 67, _, _, _,
             72, _, 67, _, 64, _, 69, 71,  70, 69, 67, 72, 76, 77, _, _],
    lead: { type: 'square', gain: 0.18, pluck: 8 },
    pad: { type: 'triangle', gain: 0.07, mode: 'stab', steps: [1, 3, 5, 7] },
    bass: { style: 'oompah', gain: 0.38 },
    drums: { hat: [0, 2, 4, 6], rim: [2, 6] } },

  { file: '03_블록폴카_144bpm.wav', // 테트리스풍 단조 폴카
    bpm: 144, steps: 8, loops: 2,
    chords: [[45, [57, 60, 64]], [38, [57, 62, 65]], [40, [56, 59, 64]], [45, [57, 60, 64]]],
    melody: [76, _, 71, 72, 74, _, 72, 71,  69, _, 69, 72, 76, _, 74, 72,
             71, _, _, 72, 74, _, 76, _,  72, _, 69, _, 69, _, _, _],
    lead: { type: 'square', gain: 0.2, pluck: 9 },
    pad: null,
    bass: { style: 'oompah', gain: 0.42 },
    drums: { hat: [1, 3, 5, 7], snare: [4] } },

  { file: '04_네온아케이드_128bpm.wav', // 80s 아르페지오 신스
    bpm: 128, steps: 8, loops: 2,
    chords: [[36, [60, 63, 67]], [41, [60, 65, 68]], [43, [58, 62, 67]], [34, [58, 63, 65]]],
    melody: [_, _, _, _, _, _, _, _,  75, _, 74, _, 72, _, _, _,
             _, _, _, _, _, _, _, _,  74, _, 72, _, 70, _, 72, _],
    lead: { type: 'saw', gain: 0.16, len: 1.6 },
    pad: { type: 'sine', gain: 0.1, mode: 'sustain' },
    bass: { style: 'notes', steps: [0, 4], gain: 0.4, type: 'sine' },
    arp: { type: 'square', gain: 0.1 },
    drums: { kick: [0, 2, 4, 6], openhat: [1, 3, 5, 7] } },

  { file: '05_그린힐러너_150bpm.wav', // 소닉풍 질주 록
    bpm: 150, steps: 8, loops: 2,
    chords: [[48, [60, 64, 67]], [45, [57, 60, 64]], [41, [57, 60, 65]], [43, [55, 59, 62]]],
    melody: [72, 74, 76, _, 79, _, 76, _,  74, 76, 77, _, 81, _, 79, 77,
             76, _, 74, 76, 79, 76, 74, 72,  74, _, 71, 74, 72, _, _, _],
    lead: { type: 'square', gain: 0.18, pluck: 6 },
    pad: { type: 'triangle', gain: 0.06, mode: 'stab', steps: [0, 4] },
    bass: { style: 'notes', steps: [0, 2, 4, 6], gain: 0.4, type: 'triangle' },
    drums: { kick: [0, 4], snare: [2, 6], hat: [0, 1, 2, 3, 4, 5, 6, 7] } },

  { file: '06_쇼핑채널재즈_122bpm.wav', // Wii샵풍 바운시 스윙
    bpm: 122, steps: 8, loops: 2, swing: 0.32,
    chords: [[48, [60, 64, 67, 71]], [45, [57, 60, 64, 67]], [38, [53, 57, 60, 65]], [43, [55, 59, 62, 65]]],
    melody: [_, _, 76, _, 74, _, 72, _,  71, _, 72, 74, _, _, 67, _,
             69, _, 72, _, 76, _, 74, _,  71, _, 67, _, _, _, _, _],
    lead: { type: 'sine', gain: 0.26, pluck: 5 },
    pad: { type: 'triangle', gain: 0.055, mode: 'sustain' },
    bass: { style: 'walk', gain: 0.4 },
    drums: { hat: [0, 2, 4, 6], shaker16: false, rim: [3, 7] } },

  { file: '07_섬마을휘파람_126bpm.wav', // 동물의숲풍 휘파람
    bpm: 126, steps: 8, loops: 2, swing: 0.18,
    chords: [[48, [60, 64, 67]], [43, [55, 59, 62]], [45, [57, 60, 64]], [41, [57, 60, 65]]],
    melody: [79, _, _, 76, _, _, 74, _,  76, _, 74, _, 71, _, _, _,
             72, _, _, 76, _, _, 79, _,  81, _, 79, _, 76, _, _, _],
    lead: { type: 'sine', gain: 0.3, vibrato: true, oct: 0, len: 1.4 },
    pad: null,
    bass: { style: 'oompah', gain: 0.3 },
    arp: { type: 'triangle', gain: 0.07 },
    drums: { shaker16: true, rim: [4] } },

  { file: '08_운동회행진곡_132bpm.wav', // 팡파레 행진
    bpm: 132, steps: 8, loops: 2,
    chords: [[41, [57, 60, 65]], [41, [57, 60, 65]], [43, [55, 58, 62]], [41, [57, 60, 65]]],
    melody: [77, _, 77, 79, 81, _, 77, _,  74, _, 77, _, 72, _, _, _,
             74, 75, 74, 72, 70, _, 74, _,  77, _, 74, _, 65, _, _, _],
    lead: { type: 'saw', gain: 0.14, len: 1.0 },
    pad: { type: 'triangle', gain: 0.06, mode: 'stab', steps: [0, 2, 4, 6] },
    bass: { style: 'oompah', gain: 0.42 },
    drums: { kick: [0, 4], snare: [2, 5, 6], hat: [1, 3, 7] } },

  { file: '09_트로피컬마림바_120bpm.wav', // 여름 해변 칠
    bpm: 120, steps: 8, loops: 2,
    chords: [[48, [60, 64, 67]], [45, [57, 64, 69]], [41, [57, 60, 65]], [43, [59, 62, 67]]],
    melody: [_, 72, _, 76, _, 79, _, 76,  _, 72, _, 74, _, 76, _, _,
             _, 69, _, 72, _, 77, _, 76,  _, 74, _, 71, _, 67, _, _],
    lead: { type: 'triangle', gain: 0.26, pluck: 12 },
    pad: null,
    bass: { style: 'notes', steps: [0, 3, 6], gain: 0.38, type: 'sine' },
    arp: { type: 'triangle', gain: 0.08 },
    drums: { shaker16: true, rim: [3, 6], kick: [0, 4] } },

  { file: '10_두구두구스피드런_160bpm.wav', // DnB 라이트
    bpm: 160, steps: 8, loops: 2,
    chords: [[33, [57, 60, 64]], [33, [57, 60, 64]], [29, [53, 57, 60]], [31, [55, 59, 62]]],
    melody: [_, _, 69, _, _, 72, _, 71,  _, _, 69, _, 67, _, 64, _,
             _, _, 65, _, _, 69, _, 67,  _, _, 71, _, 72, _, 74, _],
    lead: { type: 'square', gain: 0.15, pluck: 10 },
    pad: { type: 'sine', gain: 0.07, mode: 'sustain' },
    bass: { style: 'riff16', gain: 0.3 },
    drums: { kick: [0, 3, 4], snare: [2, 6], hat: [0, 1, 2, 3, 4, 5, 6, 7], openhat: [5] } },
];

/* ── 실행 ── */
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR);
TRACKS.forEach(function (t) {
  const buf = renderTrack(t);
  const file = path.join(OUT_DIR, t.file);
  writeWav(file, buf);
  console.log('✓', t.file, (buf.length / SR).toFixed(1) + 's', Math.round(fs.statSync(file).size / 1024) + 'KB');
});
console.log('완료 → bgm-preview/');
