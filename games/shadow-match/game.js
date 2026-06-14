/* games/shadow-match/game.js */

'use strict';

// ══════════════════════════════════════════════════════
// SVG HELPERS
// shadow=true  → fill:#333333, stroke:#222222 (solid silhouette)
// shadow=false → normal colorful fills/strokes
// ══════════════════════════════════════════════════════

function sf(color, shadow) { return shadow ? '#333333' : color; }
function ss(color, shadow) { return shadow ? '#222222' : color; }
// Transparent fill in shadow mode → dark fill
function sft(color, shadow) { return shadow ? '#333333' : color; }
// Rgba fills — in shadow mode collapse to solid dark
function sfr(color, shadow) { return shadow ? '#2a2a2a' : color; }

// ══════════════════════════════════════════════════════
// 20 SVG FUNCTIONS  — viewBox="0 0 60 60"
// ══════════════════════════════════════════════════════

function svgCat(shadow) {
  var s = !!shadow;
  return '<svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">'
    // ears
    + '<polygon points="10,22 18,6 24,20" fill="' + sf('#FF8A65',s) + '" stroke="' + ss('#E64A19',s) + '" stroke-width="1.5" stroke-linejoin="round"/>'
    + '<polygon points="36,20 42,6 50,22" fill="' + sf('#FF8A65',s) + '" stroke="' + ss('#E64A19',s) + '" stroke-width="1.5" stroke-linejoin="round"/>'
    // inner ear (hidden in shadow)
    + (s ? '' : '<polygon points="13,21 18,10 23,21" fill="#FFCCBC"/><polygon points="38,21 42,10 47,21" fill="#FFCCBC"/>')
    // head
    + '<ellipse cx="30" cy="34" rx="22" ry="20" fill="' + sf('#FF8A65',s) + '" stroke="' + ss('#E64A19',s) + '" stroke-width="1.5"/>'
    // eyes
    + (s ? '<ellipse cx="22" cy="30" rx="4" ry="4.5" fill="#2a2a2a"/><ellipse cx="38" cy="30" rx="4" ry="4.5" fill="#2a2a2a"/>'
         : '<ellipse cx="22" cy="30" rx="4" ry="4.5" fill="#fff"/><ellipse cx="38" cy="30" rx="4" ry="4.5" fill="#fff"/>'
           + '<circle cx="22" cy="31" r="2.5" fill="#333"/><circle cx="38" cy="31" r="2.5" fill="#333"/>'
           + '<circle cx="23" cy="30" r="1" fill="#fff"/><circle cx="39" cy="30" r="1" fill="#fff"/>')
    // nose
    + '<ellipse cx="30" cy="38" rx="3" ry="2" fill="' + sf('#FF7043',s) + '"/>'
    // mouth
    + '<path d="M27 40 Q30 44 33 40" fill="none" stroke="' + ss('#E64A19',s) + '" stroke-width="1.5" stroke-linecap="round"/>'
    // whiskers (hidden in shadow)
    + (s ? '' : '<line x1="8" y1="37" x2="24" y2="39" stroke="#BF360C" stroke-width="1" stroke-linecap="round"/>'
              + '<line x1="8" y1="40" x2="24" y2="40" stroke="#BF360C" stroke-width="1" stroke-linecap="round"/>'
              + '<line x1="36" y1="39" x2="52" y2="37" stroke="#BF360C" stroke-width="1" stroke-linecap="round"/>'
              + '<line x1="36" y1="40" x2="52" y2="40" stroke="#BF360C" stroke-width="1" stroke-linecap="round"/>')
    + '</svg>';
}

function svgDog(shadow) {
  var s = !!shadow;
  return '<svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">'
    // floppy ears
    + '<ellipse cx="14" cy="30" rx="9" ry="13" fill="' + sf('#A1887F',s) + '" stroke="' + ss('#6D4C41',s) + '" stroke-width="1.5"/>'
    + '<ellipse cx="46" cy="30" rx="9" ry="13" fill="' + sf('#A1887F',s) + '" stroke="' + ss('#6D4C41',s) + '" stroke-width="1.5"/>'
    // head
    + '<ellipse cx="30" cy="30" rx="20" ry="19" fill="' + sf('#BCAAA4',s) + '" stroke="' + ss('#6D4C41',s) + '" stroke-width="1.5"/>'
    // snout
    + '<ellipse cx="30" cy="38" rx="10" ry="7" fill="' + sf('#D7CCC8',s) + '" stroke="' + ss('#6D4C41',s) + '" stroke-width="1.2"/>'
    // eyes
    + (s ? '<circle cx="22" cy="27" r="4" fill="#2a2a2a"/><circle cx="38" cy="27" r="4" fill="#2a2a2a"/>'
         : '<circle cx="22" cy="27" r="4" fill="#fff"/><circle cx="38" cy="27" r="4" fill="#fff"/>'
           + '<circle cx="22" cy="28" r="2.5" fill="#333"/><circle cx="38" cy="28" r="2.5" fill="#333"/>'
           + '<circle cx="23" cy="27" r="1" fill="#fff"/><circle cx="39" cy="27" r="1" fill="#fff"/>')
    // nose
    + '<ellipse cx="30" cy="35" rx="4" ry="3" fill="' + sf('#4E342E',s) + '"/>'
    // tongue
    + '<path d="M26 41 Q30 48 34 41" fill="' + sf('#EF9A9A',s) + '" stroke="' + ss('#E57373',s) + '" stroke-width="1"/>'
    + '</svg>';
}

function svgRabbit(shadow) {
  var s = !!shadow;
  return '<svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">'
    // tall ears
    + '<ellipse cx="20" cy="14" rx="6" ry="13" fill="' + sf('#F8BBD9',s) + '" stroke="' + ss('#E91E8C',s) + '" stroke-width="1.5"/>'
    + '<ellipse cx="40" cy="14" rx="6" ry="13" fill="' + sf('#F8BBD9',s) + '" stroke="' + ss('#E91E8C',s) + '" stroke-width="1.5"/>'
    // inner ear
    + (s ? '' : '<ellipse cx="20" cy="14" rx="3.5" ry="10" fill="#F48FB1"/><ellipse cx="40" cy="14" rx="3.5" ry="10" fill="#F48FB1"/>')
    // head
    + '<ellipse cx="30" cy="36" rx="20" ry="18" fill="' + sf('#F8BBD9',s) + '" stroke="' + ss('#E91E8C',s) + '" stroke-width="1.5"/>'
    // eyes
    + (s ? '<circle cx="22" cy="32" r="4" fill="#2a2a2a"/><circle cx="38" cy="32" r="4" fill="#2a2a2a"/>'
         : '<circle cx="22" cy="32" r="4" fill="#fff"/><circle cx="38" cy="32" r="4" fill="#fff"/>'
           + '<circle cx="22" cy="33" r="2.2" fill="#CE93D8"/><circle cx="38" cy="33" r="2.2" fill="#CE93D8"/>'
           + '<circle cx="23" cy="32" r="0.9" fill="#fff"/><circle cx="39" cy="32" r="0.9" fill="#fff"/>')
    // nose
    + '<ellipse cx="30" cy="40" rx="2.5" ry="2" fill="' + sf('#E91E8C',s) + '"/>'
    // mouth
    + '<path d="M27 42 Q30 46 33 42" fill="none" stroke="' + ss('#C2185B',s) + '" stroke-width="1.5" stroke-linecap="round"/>'
    + '</svg>';
}

function svgFish(shadow) {
  var s = !!shadow;
  return '<svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">'
    // tail fin
    + '<polygon points="52,20 60,12 60,48 52,40" fill="' + sf('#29B6F6',s) + '" stroke="' + ss('#0288D1',s) + '" stroke-width="1.2"/>'
    // body
    + '<ellipse cx="28" cy="30" rx="26" ry="16" fill="' + sf('#4FC3F7',s) + '" stroke="' + ss('#0288D1',s) + '" stroke-width="1.5"/>'
    // belly
    + (s ? '' : '<ellipse cx="26" cy="33" rx="16" ry="8" fill="#B3E5FC"/>')
    // eye
    + (s ? '<circle cx="10" cy="27" r="5" fill="#2a2a2a"/>'
         : '<circle cx="10" cy="27" r="5" fill="#fff" stroke="#0288D1" stroke-width="1.2"/>'
           + '<circle cx="10" cy="27" r="3" fill="#333"/><circle cx="9" cy="26" r="1.2" fill="#fff"/>')
    // mouth
    + '<path d="M4 31 Q6 34 8 31" fill="none" stroke="' + ss('#0277BD',s) + '" stroke-width="1.5" stroke-linecap="round"/>'
    // scales (skip in shadow)
    + (s ? '' : '<path d="M22 22 Q26 18 30 22" fill="none" stroke="#0288D1" stroke-width="1.2"/>'
              + '<path d="M30 22 Q34 18 38 22" fill="none" stroke="#0288D1" stroke-width="1.2"/>'
              + '<path d="M26 28 Q30 24 34 28" fill="none" stroke="#0288D1" stroke-width="1.2"/>')
    // dorsal fin
    + '<path d="M24 14 Q30 6 36 14" fill="' + sf('#29B6F6',s) + '" stroke="' + ss('#0288D1',s) + '" stroke-width="1.2"/>'
    + '</svg>';
}

function svgBird(shadow) {
  var s = !!shadow;
  return '<svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">'
    // body
    + '<ellipse cx="30" cy="36" rx="18" ry="14" fill="' + sf('#FFCC02',s) + '" stroke="' + ss('#F9A825',s) + '" stroke-width="1.5"/>'
    // wing
    + '<ellipse cx="18" cy="34" rx="10" ry="6" fill="' + sf('#FFB300',s) + '" stroke="' + ss('#F9A825',s) + '" stroke-width="1.2" transform="rotate(-20,18,34)"/>'
    // head
    + '<circle cx="42" cy="24" r="13" fill="' + sf('#FFCC02',s) + '" stroke="' + ss('#F9A825',s) + '" stroke-width="1.5"/>'
    // eye
    + (s ? '<circle cx="47" cy="21" r="4" fill="#2a2a2a"/>'
         : '<circle cx="47" cy="21" r="4" fill="#fff" stroke="#F9A825" stroke-width="1"/>'
           + '<circle cx="47" cy="21" r="2.5" fill="#333"/><circle cx="46" cy="20" r="1" fill="#fff"/>')
    // beak
    + '<polygon points="55,25 62,30 55,31" fill="' + sf('#FF6F00',s) + '" stroke="' + ss('#E65100',s) + '" stroke-width="1"/>'
    // tail
    + '<polygon points="12,42 4,52 14,48 6,56 20,48" fill="' + sf('#FFB300',s) + '" stroke="' + ss('#F9A825',s) + '" stroke-width="1.2" stroke-linejoin="round"/>'
    // feet (skip in shadow)
    + (s ? '' : '<line x1="26" y1="49" x2="22" y2="56" stroke="#F9A825" stroke-width="2" stroke-linecap="round"/>'
              + '<line x1="34" y1="49" x2="38" y2="56" stroke="#F9A825" stroke-width="2" stroke-linecap="round"/>'
              + '<line x1="22" y1="56" x2="18" y2="54" stroke="#F9A825" stroke-width="1.5" stroke-linecap="round"/>'
              + '<line x1="22" y1="56" x2="22" y2="58" stroke="#F9A825" stroke-width="1.5" stroke-linecap="round"/>'
              + '<line x1="22" y1="56" x2="26" y2="58" stroke="#F9A825" stroke-width="1.5" stroke-linecap="round"/>')
    + '</svg>';
}

function svgApple(shadow) {
  var s = !!shadow;
  return '<svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">'
    // leaf
    + '<path d="M30 8 Q38 2 42 10 Q36 12 30 8Z" fill="' + sf('#66BB6A',s) + '" stroke="' + ss('#388E3C',s) + '" stroke-width="1"/>'
    // stem
    + '<line x1="30" y1="8" x2="30" y2="14" stroke="' + ss('#6D4C41',s) + '" stroke-width="2.5" stroke-linecap="round"/>'
    // body
    + '<path d="M30 14 Q10 12 8 30 Q8 48 30 52 Q52 48 52 30 Q50 12 30 14Z" fill="' + sf('#EF5350',s) + '" stroke="' + ss('#C62828',s) + '" stroke-width="1.5"/>'
    // shine (skip in shadow)
    + (s ? '' : '<ellipse cx="20" cy="24" rx="6" ry="4" fill="rgba(255,255,255,0.3)" transform="rotate(-20,20,24)"/>')
    // dimple top
    + '<path d="M27 14 Q30 11 33 14" fill="none" stroke="' + ss('#C62828',s) + '" stroke-width="1.2"/>'
    + '</svg>';
}

function svgBanana(shadow) {
  var s = !!shadow;
  return '<svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">'
    // banana body
    + '<path d="M12 48 Q8 28 18 16 Q26 6 44 8 Q50 8 52 12 Q50 14 44 12 Q28 10 22 20 Q14 32 18 48Z" fill="' + sf('#FFEE58',s) + '" stroke="' + ss('#F9A825',s) + '" stroke-width="2" stroke-linejoin="round"/>'
    // tip shading
    + '<path d="M12 48 Q14 52 18 50 Q14 46 12 48Z" fill="' + sf('#F9A825',s) + '"/>'
    + '<path d="M44 8 Q50 8 52 12 Q48 10 44 8Z" fill="' + sf('#F9A825',s) + '"/>'
    // shine (skip in shadow)
    + (s ? '' : '<path d="M22 18 Q30 12 40 14" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="3" stroke-linecap="round"/>')
    + '</svg>';
}

function svgGrape(shadow) {
  var s = !!shadow;
  return '<svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">'
    // stem
    + '<line x1="30" y1="4" x2="30" y2="12" stroke="' + ss('#6D4C41',s) + '" stroke-width="2.5" stroke-linecap="round"/>'
    // leaf
    + '<path d="M30 8 Q22 4 20 10 Q26 12 30 8Z" fill="' + sf('#66BB6A',s) + '" stroke="' + ss('#388E3C',s) + '" stroke-width="1"/>'
    // grapes
    + '<circle cx="22" cy="20" r="8" fill="' + sf('#9C27B0',s) + '" stroke="' + ss('#6A1B9A',s) + '" stroke-width="1.2"/>'
    + '<circle cx="38" cy="20" r="8" fill="' + sf('#9C27B0',s) + '" stroke="' + ss('#6A1B9A',s) + '" stroke-width="1.2"/>'
    + '<circle cx="14" cy="33" r="8" fill="' + sf('#AB47BC',s) + '" stroke="' + ss('#6A1B9A',s) + '" stroke-width="1.2"/>'
    + '<circle cx="30" cy="33" r="8" fill="' + sf('#9C27B0',s) + '" stroke="' + ss('#6A1B9A',s) + '" stroke-width="1.2"/>'
    + '<circle cx="46" cy="33" r="8" fill="' + sf('#AB47BC',s) + '" stroke="' + ss('#6A1B9A',s) + '" stroke-width="1.2"/>'
    + '<circle cx="22" cy="46" r="8" fill="' + sf('#9C27B0',s) + '" stroke="' + ss('#6A1B9A',s) + '" stroke-width="1.2"/>'
    + '<circle cx="38" cy="46" r="8" fill="' + sf('#AB47BC',s) + '" stroke="' + ss('#6A1B9A',s) + '" stroke-width="1.2"/>'
    // shine (skip in shadow)
    + (s ? '' : '<circle cx="19" cy="17" r="2.5" fill="rgba(255,255,255,0.4)"/>'
              + '<circle cx="35" cy="17" r="2.5" fill="rgba(255,255,255,0.4)"/>'
              + '<circle cx="27" cy="30" r="2.5" fill="rgba(255,255,255,0.4)"/>')
    + '</svg>';
}

function svgStrawberry(shadow) {
  var s = !!shadow;
  return '<svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">'
    // calyx leaves
    + '<path d="M30 12 Q24 4 20 10 Q28 14 30 12Z" fill="' + sf('#4CAF50',s) + '" stroke="' + ss('#2E7D32',s) + '" stroke-width="1"/>'
    + '<path d="M30 12 Q36 4 40 10 Q32 14 30 12Z" fill="' + sf('#66BB6A',s) + '" stroke="' + ss('#2E7D32',s) + '" stroke-width="1"/>'
    + '<path d="M30 12 Q18 6 18 14 Q24 14 30 12Z" fill="' + sf('#4CAF50',s) + '" stroke="' + ss('#2E7D32',s) + '" stroke-width="1"/>'
    + '<path d="M30 12 Q42 6 42 14 Q36 14 30 12Z" fill="' + sf('#66BB6A',s) + '" stroke="' + ss('#2E7D32',s) + '" stroke-width="1"/>'
    // body
    + '<path d="M30 14 Q46 16 50 30 Q52 44 30 56 Q8 44 10 30 Q14 16 30 14Z" fill="' + sf('#F44336',s) + '" stroke="' + ss('#C62828',s) + '" stroke-width="1.5"/>'
    // seeds (skip in shadow)
    + (s ? '' : '<ellipse cx="24" cy="28" rx="1.5" ry="2" fill="#FFCC80" transform="rotate(-15,24,28)"/>'
              + '<ellipse cx="30" cy="24" rx="1.5" ry="2" fill="#FFCC80" transform="rotate(5,30,24)"/>'
              + '<ellipse cx="36" cy="28" rx="1.5" ry="2" fill="#FFCC80" transform="rotate(15,36,28)"/>'
              + '<ellipse cx="22" cy="36" rx="1.5" ry="2" fill="#FFCC80" transform="rotate(-10,22,36)"/>'
              + '<ellipse cx="30" cy="36" rx="1.5" ry="2" fill="#FFCC80"/>'
              + '<ellipse cx="38" cy="36" rx="1.5" ry="2" fill="#FFCC80" transform="rotate(10,38,36)"/>'
              + '<ellipse cx="26" cy="44" rx="1.5" ry="2" fill="#FFCC80" transform="rotate(-5,26,44)"/>'
              + '<ellipse cx="34" cy="44" rx="1.5" ry="2" fill="#FFCC80" transform="rotate(5,34,44)"/>')
    // shine (skip in shadow)
    + (s ? '' : '<ellipse cx="22" cy="24" rx="4" ry="3" fill="rgba(255,255,255,0.25)" transform="rotate(-20,22,24)"/>')
    + '</svg>';
}

function svgWatermelon(shadow) {
  var s = !!shadow;
  return '<svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">'
    // rind outer
    + '<path d="M8 32 Q8 8 30 8 Q52 8 52 32Z" fill="' + sf('#4CAF50',s) + '" stroke="' + ss('#2E7D32',s) + '" stroke-width="1.5"/>'
    // rind inner
    + (s ? '' : '<path d="M12 32 Q12 12 30 12 Q48 12 48 32Z" fill="#A5D6A7"/>')
    // flesh
    + '<path d="M16 32 Q16 16 30 16 Q44 16 44 32Z" fill="' + sf('#EF5350',s) + '"/>'
    // seeds
    + '<ellipse cx="24" cy="26" rx="2" ry="3" fill="' + sf('#333',s) + '" transform="rotate(-15,24,26)"/>'
    + '<ellipse cx="30" cy="23" rx="2" ry="3" fill="' + sf('#333',s) + '"/>'
    + '<ellipse cx="36" cy="26" rx="2" ry="3" fill="' + sf('#333',s) + '" transform="rotate(15,36,26)"/>'
    // flat bottom line
    + '<line x1="8" y1="32" x2="52" y2="32" stroke="' + ss('#2E7D32',s) + '" stroke-width="2"/>'
    // rind stripe (skip in shadow)
    + (s ? '' : '<path d="M8 32 Q30 38 52 32" fill="none" stroke="#388E3C" stroke-width="1"/>')
    + '</svg>';
}

function svgStar(shadow) {
  var s = !!shadow;
  return '<svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">'
    + '<polygon points="30,4 36,21 55,21 40,32 46,50 30,39 14,50 20,32 5,21 24,21" fill="' + sf('#FFD600',s) + '" stroke="' + ss('#F9A825',s) + '" stroke-width="2" stroke-linejoin="round"/>'
    // shine (skip in shadow)
    + (s ? '' : '<ellipse cx="24" cy="20" rx="5" ry="3" fill="rgba(255,255,255,0.35)" transform="rotate(-25,24,20)"/>')
    + '</svg>';
}

function svgHeart(shadow) {
  var s = !!shadow;
  return '<svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">'
    + '<path d="M30 52 Q6 36 6 20 Q6 8 18 8 Q24 8 30 16 Q36 8 42 8 Q54 8 54 20 Q54 36 30 52Z" fill="' + sf('#E91E63',s) + '" stroke="' + ss('#880E4F',s) + '" stroke-width="2"/>'
    // shine (skip in shadow)
    + (s ? '' : '<ellipse cx="20" cy="18" rx="6" ry="4" fill="rgba(255,255,255,0.3)" transform="rotate(-30,20,18)"/>')
    + '</svg>';
}

function svgMoon(shadow) {
  var s = !!shadow;
  return '<svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">'
    + '<path d="M36 6 Q20 10 16 24 Q12 38 24 50 Q38 56 50 46 Q60 38 56 26 Q44 38 32 34 Q18 28 22 16 Q24 8 36 6Z" fill="' + sf('#FFF176',s) + '" stroke="' + ss('#F9A825',s) + '" stroke-width="1.5"/>'
    // stars (skip in shadow)
    + (s ? '' : '<circle cx="42" cy="14" r="2" fill="#FFD600"/>'
              + '<circle cx="50" cy="22" r="1.5" fill="#FFD600"/>'
              + '<circle cx="46" cy="30" r="1" fill="#FFD600"/>')
    + '</svg>';
}

function svgCloud(shadow) {
  var s = !!shadow;
  return '<svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">'
    + '<circle cx="20" cy="34" r="12" fill="' + sf('#B3E5FC',s) + '" stroke="' + ss('#29B6F6',s) + '" stroke-width="1.5"/>'
    + '<circle cx="32" cy="28" r="15" fill="' + sf('#E1F5FE',s) + '" stroke="' + ss('#29B6F6',s) + '" stroke-width="1.5"/>'
    + '<circle cx="44" cy="34" r="11" fill="' + sf('#B3E5FC',s) + '" stroke="' + ss('#29B6F6',s) + '" stroke-width="1.5"/>'
    // base fill to merge bottom
    + '<rect x="10" y="34" width="38" height="14" fill="' + sf('#E1F5FE',s) + '"/>'
    // hide strokes at bottom
    + '<line x1="9" y1="45" x2="55" y2="45" stroke="' + sf('#E1F5FE',s) + '" stroke-width="3"/>'
    // shine (skip in shadow)
    + (s ? '' : '<ellipse cx="28" cy="24" rx="7" ry="3" fill="rgba(255,255,255,0.6)" transform="rotate(-10,28,24)"/>')
    + '</svg>';
}

function svgLightning(shadow) {
  var s = !!shadow;
  return '<svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">'
    + '<polygon points="36,4 18,30 28,30 24,56 42,28 32,28" fill="' + sf('#FFD600',s) + '" stroke="' + ss('#FF8F00',s) + '" stroke-width="2" stroke-linejoin="round"/>'
    // inner glow (skip in shadow)
    + (s ? '' : '<polygon points="36,4 18,30 28,30 24,56 42,28 32,28" fill="rgba(255,255,255,0.2)"/>')
    + '</svg>';
}

function svgTree(shadow) {
  var s = !!shadow;
  return '<svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">'
    // trunk
    + '<rect x="24" y="44" width="12" height="14" rx="3" fill="' + sf('#795548',s) + '" stroke="' + ss('#5D4037',s) + '" stroke-width="1.5"/>'
    // foliage layers
    + '<polygon points="6,48 30,20 54,48" fill="' + sf('#388E3C',s) + '" stroke="' + ss('#1B5E20',s) + '" stroke-width="1.5" stroke-linejoin="round"/>'
    + '<polygon points="10,36 30,12 50,36" fill="' + sf('#43A047',s) + '" stroke="' + ss('#2E7D32',s) + '" stroke-width="1.5" stroke-linejoin="round"/>'
    + '<polygon points="16,26 30,6 44,26" fill="' + sf('#66BB6A',s) + '" stroke="' + ss('#388E3C',s) + '" stroke-width="1.5" stroke-linejoin="round"/>'
    // star on top (skip in shadow)
    + (s ? '' : '<polygon points="30,4 32,10 38,10 33,13 35,19 30,16 25,19 27,13 22,10 28,10" fill="#FFD600" stroke="#F9A825" stroke-width="0.8"/>')
    + '</svg>';
}

function svgFlower(shadow) {
  var s = !!shadow;
  return '<svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">'
    // stem
    + '<line x1="30" y1="36" x2="30" y2="56" stroke="' + sf('#4CAF50',s) + '" stroke-width="3" stroke-linecap="round"/>'
    // leaf
    + '<path d="M30 48 Q22 42 24 36 Q30 40 30 48Z" fill="' + sf('#66BB6A',s) + '" stroke="' + ss('#388E3C',s) + '" stroke-width="1"/>'
    // petals
    + '<ellipse cx="30" cy="18" rx="6" ry="10" fill="' + sf('#FF80AB',s) + '"/>'
    + '<ellipse cx="30" cy="18" rx="6" ry="10" fill="' + sf('#FF80AB',s) + '" transform="rotate(45,30,30)"/>'
    + '<ellipse cx="30" cy="18" rx="6" ry="10" fill="' + sf('#FF4081',s) + '" transform="rotate(90,30,30)"/>'
    + '<ellipse cx="30" cy="18" rx="6" ry="10" fill="' + sf('#FF80AB',s) + '" transform="rotate(135,30,30)"/>'
    // center
    + '<circle cx="30" cy="30" r="9" fill="' + sf('#FFCC02',s) + '" stroke="' + ss('#F9A825',s) + '" stroke-width="1.5"/>'
    + '<circle cx="30" cy="30" r="5" fill="' + sf('#FF8F00',s) + '"/>'
    // center dots (skip in shadow)
    + (s ? '' : '<circle cx="28" cy="28" r="1.2" fill="#FFEE58"/>'
              + '<circle cx="32" cy="28" r="1.2" fill="#FFEE58"/>'
              + '<circle cx="30" cy="32" r="1.2" fill="#FFEE58"/>')
    + '</svg>';
}

function svgCar(shadow) {
  var s = !!shadow;
  return '<svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">'
    // body
    + '<rect x="4" y="30" width="52" height="18" rx="5" fill="' + sf('#EF5350',s) + '" stroke="' + ss('#B71C1C',s) + '" stroke-width="1.5"/>'
    // cabin
    + '<path d="M14 30 Q18 18 28 16 L36 16 Q44 18 46 30Z" fill="' + sf('#EF9A9A',s) + '" stroke="' + ss('#B71C1C',s) + '" stroke-width="1.5"/>'
    // windows
    + (s ? '' : '<rect x="18" y="20" width="10" height="9" rx="2" fill="#B3E5FC" stroke="#0288D1" stroke-width="1"/>'
              + '<rect x="31" y="20" width="10" height="9" rx="2" fill="#B3E5FC" stroke="#0288D1" stroke-width="1"/>')
    // wheels
    + '<circle cx="15" cy="48" r="7" fill="' + sf('#333',s) + '" stroke="' + ss('#555',s) + '" stroke-width="1.5"/>'
    + '<circle cx="45" cy="48" r="7" fill="' + sf('#333',s) + '" stroke="' + ss('#555',s) + '" stroke-width="1.5"/>'
    + (s ? '' : '<circle cx="15" cy="48" r="3.5" fill="#888"/><circle cx="45" cy="48" r="3.5" fill="#888"/>')
    // headlight
    + (s ? '' : '<ellipse cx="56" cy="36" rx="3" ry="2.5" fill="#FFEE58" stroke="#F9A825" stroke-width="1"/>')
    // tail light
    + (s ? '' : '<ellipse cx="4" cy="36" rx="3" ry="2.5" fill="#FF5252" stroke="#B71C1C" stroke-width="1"/>')
    + '</svg>';
}

function svgRocket(shadow) {
  var s = !!shadow;
  return '<svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">'
    // flame
    + '<path d="M22 52 Q24 58 30 56 Q36 58 38 52 Q34 54 30 52 Q26 54 22 52Z" fill="' + sf('#FF6D00',s) + '"/>'
    + '<path d="M24 50 Q26 56 30 54 Q34 56 36 50 Q32 52 30 50 Q28 52 24 50Z" fill="' + sf('#FFD600',s) + '"/>'
    // fins
    + '<path d="M16 44 Q10 50 12 56 L22 48Z" fill="' + sf('#1565C0',s) + '" stroke="' + ss('#0D47A1',s) + '" stroke-width="1"/>'
    + '<path d="M44 44 Q50 50 48 56 L38 48Z" fill="' + sf('#1565C0',s) + '" stroke="' + ss('#0D47A1',s) + '" stroke-width="1"/>'
    // body
    + '<rect x="20" y="22" width="20" height="28" rx="4" fill="' + sf('#1E88E5',s) + '" stroke="' + ss('#0D47A1',s) + '" stroke-width="1.5"/>'
    // nose cone
    + '<path d="M20 22 Q20 6 30 4 Q40 6 40 22Z" fill="' + sf('#EF5350',s) + '" stroke="' + ss('#B71C1C',s) + '" stroke-width="1.5"/>'
    // window
    + (s ? '' : '<circle cx="30" cy="34" r="7" fill="#B3E5FC" stroke="#0288D1" stroke-width="1.5"/>'
              + '<circle cx="30" cy="34" r="4" fill="#E3F2FD"/>'
              + '<ellipse cx="24" cy="14" rx="3" ry="5" fill="rgba(255,255,255,0.3)" transform="rotate(-15,24,14)"/>')
    + '</svg>';
}

function svgHouse(shadow) {
  var s = !!shadow;
  return '<svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">'
    // roof
    + '<polygon points="30,4 58,26 2,26" fill="' + sf('#EF5350',s) + '" stroke="' + ss('#B71C1C',s) + '" stroke-width="1.5" stroke-linejoin="round"/>'
    // chimney
    + '<rect x="40" y="10" width="7" height="12" rx="1" fill="' + sf('#795548',s) + '" stroke="' + ss('#5D4037',s) + '" stroke-width="1"/>'
    // smoke (skip in shadow)
    + (s ? '' : '<circle cx="42" cy="8" r="2.5" fill="rgba(180,180,180,0.6)"/>'
              + '<circle cx="44" cy="5" r="2" fill="rgba(180,180,180,0.4)"/>')
    // wall
    + '<rect x="6" y="26" width="48" height="30" rx="2" fill="' + sf('#FFF9C4',s) + '" stroke="' + ss('#F9A825',s) + '" stroke-width="1.5"/>'
    // door
    + '<rect x="23" y="38" width="14" height="18" rx="3" fill="' + sf('#795548',s) + '" stroke="' + ss('#5D4037',s) + '" stroke-width="1.5"/>'
    + (s ? '' : '<circle cx="35" cy="47" r="1.8" fill="#FFD600"/>')
    // left window
    + '<rect x="9" y="32" width="10" height="10" rx="2" fill="' + sf('#B3E5FC',s) + '" stroke="' + ss('#29B6F6',s) + '" stroke-width="1.2"/>'
    + (s ? '' : '<line x1="14" y1="32" x2="14" y2="42" stroke="#29B6F6" stroke-width="1"/>'
              + '<line x1="9" y1="37" x2="19" y2="37" stroke="#29B6F6" stroke-width="1"/>')
    // right window
    + '<rect x="41" y="32" width="10" height="10" rx="2" fill="' + sf('#B3E5FC',s) + '" stroke="' + ss('#29B6F6',s) + '" stroke-width="1.2"/>'
    + (s ? '' : '<line x1="46" y1="32" x2="46" y2="42" stroke="#29B6F6" stroke-width="1"/>'
              + '<line x1="41" y1="37" x2="51" y2="37" stroke="#29B6F6" stroke-width="1"/>')
    + '</svg>';
}

// ══════════════════════════════════════════════════════
// ITEM POOL
// ══════════════════════════════════════════════════════

var ITEM_POOL = [
  { id: 'cat',        label: '고양이',   fn: svgCat        },
  { id: 'dog',        label: '강아지',   fn: svgDog        },
  { id: 'rabbit',     label: '토끼',     fn: svgRabbit     },
  { id: 'fish',       label: '물고기',   fn: svgFish       },
  { id: 'bird',       label: '새',       fn: svgBird       },
  { id: 'apple',      label: '사과',     fn: svgApple      },
  { id: 'banana',     label: '바나나',   fn: svgBanana     },
  { id: 'grape',      label: '포도',     fn: svgGrape      },
  { id: 'strawberry', label: '딸기',     fn: svgStrawberry },
  { id: 'watermelon', label: '수박',     fn: svgWatermelon },
  { id: 'star',       label: '별',       fn: svgStar       },
  { id: 'heart',      label: '하트',     fn: svgHeart      },
  { id: 'moon',       label: '달',       fn: svgMoon       },
  { id: 'cloud',      label: '구름',     fn: svgCloud      },
  { id: 'lightning',  label: '번개',     fn: svgLightning  },
  { id: 'tree',       label: '나무',     fn: svgTree       },
  { id: 'flower',     label: '꽃',       fn: svgFlower     },
  { id: 'car',        label: '자동차',   fn: svgCar        },
  { id: 'rocket',     label: '로켓',     fn: svgRocket     },
  { id: 'house',      label: '집',       fn: svgHouse      },
];

// ══════════════════════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════════════════════

var TOTAL_ROUNDS   = 10;
var ITEMS_PER_ZONE = 6;  // 2x3 grid per zone

var PLAYER_CONFIG = [
  { label: 'P1', hex: '#00BCD4', bgTint: 'rgba(0,188,212,0.14)' },
  { label: 'P2', hex: '#FF5722', bgTint: 'rgba(255,87,34,0.14)'  },
  { label: 'P3', hex: '#9C27B0', bgTint: 'rgba(156,39,176,0.14)' },
  { label: 'P4', hex: '#4CAF50', bgTint: 'rgba(76,175,80,0.14)'  },
];

// ══════════════════════════════════════════════════════
// SOUND
// ══════════════════════════════════════════════════════

var sound = createSoundManager({
  ding: function(ctx) {
    [523, 659, 784].forEach(function(freq, i) {
      var osc  = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      var t = ctx.currentTime + i * 0.1;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.start(t);
      osc.stop(t + 0.35);
    });
  },
  buzz: function(ctx) {
    var osc  = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, ctx.currentTime);
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.35);
  },
  fanfare: function(ctx) {
    [392, 523, 659, 784, 1047].forEach(function(freq, i) {
      var osc  = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'triangle';
      var t = ctx.currentTime + i * 0.13;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.28, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      osc.start(t);
      osc.stop(t + 0.4);
    });
  },
  tick: function(ctx) {
    var osc  = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(900, ctx.currentTime);
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.1);
  }
});

// ══════════════════════════════════════════════════════
// STATE
// ══════════════════════════════════════════════════════

var playerCount   = 2;
var currentRound  = 0;
var scores        = [];
var phase         = 'idle';    // idle | active | resolved
var targetItem    = null;      // { id, label, fn }
var roundDQ       = [];        // set-like: DQ'd player indices this round
var roundResolved = false;
var nextRoundTimer = null;
var gameActive    = false;

// ══════════════════════════════════════════════════════
// DOM REFS
// ══════════════════════════════════════════════════════

var introScreen      = document.getElementById('introScreen');
var countdownScreen  = document.getElementById('countdownScreen');
var countdownNumber  = document.getElementById('countdownNumber');
var gameScreen       = document.getElementById('gameScreen');
var resultScreen     = document.getElementById('resultScreen');
var backBtn          = document.getElementById('backBtn');
var playBtn          = document.getElementById('playBtn');
var closeBtn         = document.getElementById('closeBtn');
var retryBtn         = document.getElementById('retryBtn');
var homeBtn          = document.getElementById('homeBtn');
var soundToggleIntro = document.getElementById('soundToggleIntro');
var zonesWrap        = document.getElementById('zonesWrap');
var roundBadge       = document.getElementById('roundBadge');
var targetSvgBox     = document.getElementById('targetSvgBox');
var roundStatus      = document.getElementById('roundStatus');
var resultTitle      = document.getElementById('resultTitle');
var resultWinner     = document.getElementById('resultWinner');
var resultScoresWrap = document.getElementById('resultScoresWrap');

// ══════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════

function showScreen(el) {
  [introScreen, countdownScreen, gameScreen, resultScreen].forEach(function(s) {
    s.classList.remove('active');
  });
  el.classList.add('active');
}

var countdownInterval = null;
function startCountdown(onDone) {
  showScreen(countdownScreen);
  countdownInterval = runCountdown(countdownNumber, onDone);
}

function shuffle(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

function randItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function isDQ(playerIdx) { return roundDQ.indexOf(playerIdx) !== -1; }
function setDQ(playerIdx) { if (!isDQ(playerIdx)) roundDQ.push(playerIdx); }

function updateSoundToggle() {
  soundToggleIntro.textContent = sound.isMuted() ? '🔇' : '🔊';
}

function clearNextRoundTimer() {
  if (nextRoundTimer !== null) {
    clearTimeout(nextRoundTimer);
    nextRoundTimer = null;
  }
}

function cleanup() {
  if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
  gameActive = false;
  clearNextRoundTimer();
}

// ══════════════════════════════════════════════════════
// SOUND TOGGLE
// ══════════════════════════════════════════════════════

onTap(soundToggleIntro, function() {
  sound.toggleMute();
  updateSoundToggle();
});
updateSoundToggle();

// ══════════════════════════════════════════════════════
// PLAYER COUNT SELECT
// ══════════════════════════════════════════════════════

document.querySelectorAll('.player-btn').forEach(function(btn) {
  onTap(btn, function() {
    document.querySelectorAll('.player-btn').forEach(function(b) {
      b.classList.remove('active');
    });
    btn.classList.add('active');
    playerCount = parseInt(btn.getAttribute('data-count'), 10);
  });
});

// ══════════════════════════════════════════════════════
// NAV BUTTONS
// ══════════════════════════════════════════════════════

onTap(backBtn,  function() { cleanup(); goHome(); });
onTap(playBtn,  function() { startCountdown(function() { startGame(); }); });
onTap(closeBtn, function() { cleanup(); goHome(); });
onTap(retryBtn, function() { startCountdown(function() { startGame(); }); });
onTap(homeBtn,  function() { cleanup(); goHome(); });

// ══════════════════════════════════════════════════════
// ZONE BUILDING
// ══════════════════════════════════════════════════════

function buildZones() {
  zonesWrap.innerHTML = '';
  zonesWrap.className = 'zones-wrap p' + playerCount;

  for (var i = 0; i < playerCount; i++) {
    var cfg  = PLAYER_CONFIG[i];
    var zone = document.createElement('div');
    zone.className = 'zone state-idle';
    zone.dataset.player = i;
    zone.style.background = cfg.bgTint;

    // Zone header
    var header = document.createElement('div');
    header.className = 'zone-header';

    var label = document.createElement('div');
    label.className = 'zone-label';
    label.style.color = cfg.hex;
    label.textContent = cfg.label;

    var scoreEl = document.createElement('div');
    scoreEl.className = 'zone-score';
    scoreEl.setAttribute('data-score-for', i);
    scoreEl.textContent = '0점';
    scoreEl.style.color = cfg.hex;

    header.appendChild(label);
    header.appendChild(scoreEl);

    // Item grid (2x3)
    var grid = document.createElement('div');
    grid.className = 'item-grid';
    grid.setAttribute('data-grid-for', i);

    zone.appendChild(header);
    zone.appendChild(grid);
    zonesWrap.appendChild(zone);
  }
}

function getZone(idx) {
  return zonesWrap.querySelector('.zone[data-player="' + idx + '"]');
}

function updateZoneScore(idx) {
  var el = zonesWrap.querySelector('[data-score-for="' + idx + '"]');
  if (el) el.textContent = scores[idx] + '점';
}

// ══════════════════════════════════════════════════════
// ROUND ITEM GENERATION (6 items: 1 correct + 5 wrong)
// ══════════════════════════════════════════════════════

function generateRoundItems(correctItem) {
  var pool   = ITEM_POOL.filter(function(it) { return it.id !== correctItem.id; });
  var wrong  = shuffle(pool).slice(0, ITEMS_PER_ZONE - 1);
  var items  = wrong.slice();
  var insertIdx = Math.floor(Math.random() * ITEMS_PER_ZONE);
  items.splice(insertIdx, 0, correctItem);
  return items;
}

function populateZoneGrid(playerIdx, items) {
  var grid = zonesWrap.querySelector('[data-grid-for="' + playerIdx + '"]');
  if (!grid) return;
  grid.innerHTML = '';

  items.forEach(function(item) {
    var btn = document.createElement('div');
    btn.className = 'item-btn';
    btn.setAttribute('role', 'button');
    btn.setAttribute('aria-label', item.label);
    btn.setAttribute('data-item-id', item.id);
    // Render colored version in each zone
    btn.innerHTML = item.fn(false);

    onTap(btn, function(e) {
      e.stopPropagation();
      handleItemTap(playerIdx, item.id, btn, e);
    });

    grid.appendChild(btn);
  });
}

// ══════════════════════════════════════════════════════
// RIPPLE
// ══════════════════════════════════════════════════════

function spawnRipple(zone, e) {
  var rect = zone.getBoundingClientRect();
  var src  = (e.touches && e.touches[0]) ? e.touches[0] : e;
  var x = (src ? src.clientX : rect.left + rect.width  / 2) - rect.left;
  var y = (src ? src.clientY : rect.top  + rect.height / 2) - rect.top;
  var size = Math.max(rect.width, rect.height);
  var r = document.createElement('span');
  r.className = 'zone-ripple';
  r.style.left = x + 'px';
  r.style.top  = y + 'px';
  r.style.width  = size + 'px';
  r.style.height = size + 'px';
  r.style.marginLeft = (-size / 2) + 'px';
  r.style.marginTop  = (-size / 2) + 'px';
  zone.appendChild(r);
  r.addEventListener('animationend', function() { r.remove(); });
}

// ══════════════════════════════════════════════════════
// TAP HANDLER
// ══════════════════════════════════════════════════════

function handleItemTap(playerIdx, itemId, btn, e) {
  if (phase !== 'active') return;
  if (isDQ(playerIdx))    return;
  if (roundResolved)      return;

  var zone = getZone(playerIdx);
  spawnRipple(zone, e);

  var isCorrect = (itemId === targetItem.id);

  if (isCorrect) {
    roundResolved = true;
    phase = 'resolved';
    sound.play('ding');

    scores[playerIdx]++;
    updateZoneScore(playerIdx);

    // Highlight the correct button
    btn.classList.add('item-correct-flash');

    // Winner zone lights up
    zone.classList.remove('state-idle', 'state-active', 'state-dq', 'state-wrong');
    zone.classList.add('state-correct');

    // Dim other zones
    for (var i = 0; i < playerCount; i++) {
      if (i === playerIdx) continue;
      var z = getZone(i);
      if (z && !isDQ(i)) {
        z.classList.remove('state-active');
        z.classList.add('state-idle');
      }
    }

    var cfg = PLAYER_CONFIG[playerIdx];
    roundStatus.textContent = cfg.label + ' 정답! +1점';
    roundStatus.className   = 'round-status correct';

    scheduleNextOrEnd();

  } else {
    // Wrong — disqualify this player for the round
    sound.play('buzz');
    setDQ(playerIdx);

    // Deduct 1 point (floor at 0)
    scores[playerIdx] = Math.max(0, scores[playerIdx] - 1);
    updateZoneScore(playerIdx);

    // Show "-1" flash
    var penalty = document.createElement('div');
    penalty.className = 'penalty-flash';
    penalty.textContent = '-1';
    zone.style.position = 'relative';
    zone.appendChild(penalty);
    penalty.addEventListener('animationend', function() { penalty.remove(); });

    btn.classList.add('item-wrong-flash');
    setTimeout(function() {
      if (gameActive) btn.classList.remove('item-wrong-flash');
    }, 400);

    zone.classList.remove('state-active', 'state-correct', 'state-idle');
    zone.classList.add('state-dq', 'state-wrong');
    setTimeout(function() {
      if (gameActive) zone.classList.remove('state-wrong');
    }, 420);

    roundStatus.textContent = PLAYER_CONFIG[playerIdx].label + ' 오답! 실격 -1점';
    roundStatus.className   = 'round-status wrong';

    setTimeout(function() {
      if (gameActive && phase === 'active') {
        roundStatus.textContent = '';
        roundStatus.className   = 'round-status';
      }
    }, 900);

    // Check if everyone is DQ'd
    var allOut = true;
    for (var j = 0; j < playerCount; j++) {
      if (!isDQ(j)) { allOut = false; break; }
    }
    if (allOut) {
      roundResolved = true;
      phase = 'resolved';
      roundStatus.textContent = '전원 실격 — 다음 라운드';
      roundStatus.className   = 'round-status wrong';
      scheduleNextOrEnd();
    }
  }
}

// ══════════════════════════════════════════════════════
// GAME FLOW
// ══════════════════════════════════════════════════════

function startGame() {
  cleanup();
  gameActive = true;

  scores = [];
  for (var i = 0; i < playerCount; i++) { scores.push(0); }
  currentRound  = 0;
  roundResolved = false;
  roundDQ       = [];
  phase         = 'idle';

  showScreen(gameScreen);
  buildZones();

  nextRoundTimer = setTimeout(function() {
    nextRoundTimer = null;
    nextRound();
  }, 300);
}

function nextRound() {
  currentRound++;
  roundDQ       = [];
  roundResolved = false;
  phase         = 'idle';

  roundBadge.textContent  = currentRound + ' / ' + TOTAL_ROUNDS;
  roundStatus.textContent = '준비...';
  roundStatus.className   = 'round-status';

  // Show "?" placeholder shadow box
  targetSvgBox.innerHTML = '<svg viewBox="0 0 60 60" width="120" height="120" xmlns="http://www.w3.org/2000/svg">'
    + '<text x="30" y="42" text-anchor="middle" font-size="44" font-weight="900"'
    + ' font-family="sans-serif" fill="rgba(255,255,255,0.35)">?</text></svg>';

  // Reset all zones
  for (var i = 0; i < playerCount; i++) {
    var z = getZone(i);
    if (z) {
      z.className = 'zone state-idle';
      z.style.background = PLAYER_CONFIG[i].bgTint;
      var grid = z.querySelector('.item-grid');
      if (grid) grid.innerHTML = '';
    }
  }

  sound.play('tick');

  // Short pause then reveal silhouette and colored choices
  nextRoundTimer = setTimeout(function() {
    nextRoundTimer = null;

    // Pick target item
    targetItem = randItem(ITEM_POOL);

    // Show silhouette (shadow=true) in center
    targetSvgBox.innerHTML = targetItem.fn(true);

    roundStatus.textContent = '';
    roundStatus.className   = 'round-status';

    // Populate each zone with colored items (shadow=false)
    for (var p = 0; p < playerCount; p++) {
      var items = generateRoundItems(targetItem);
      populateZoneGrid(p, items);
      var zone = getZone(p);
      if (zone) {
        zone.classList.remove('state-idle', 'state-correct', 'state-wrong', 'state-dq');
        zone.classList.add('state-active');
      }
    }

    phase = 'active';
  }, 700);
}

function scheduleNextOrEnd() {
  clearNextRoundTimer();
  nextRoundTimer = setTimeout(function() {
    nextRoundTimer = null;
    if (currentRound >= TOTAL_ROUNDS) {
      showResult();
    } else {
      nextRound();
    }
  }, 1500);
}

// ══════════════════════════════════════════════════════
// RESULT SCREEN
// ══════════════════════════════════════════════════════

function showResult() {
  sound.play('fanfare');

  var maxScore = 0;
  for (var i = 0; i < playerCount; i++) {
    if (scores[i] > maxScore) maxScore = scores[i];
  }
  var winners = [];
  for (var j = 0; j < playerCount; j++) {
    if (scores[j] === maxScore) winners.push(j);
  }

  resultTitle.textContent = '게임 종료!';

  if (winners.length === 1) {
    var cfg = PLAYER_CONFIG[winners[0]];
    resultWinner.textContent = cfg.label + ' 최종 우승!';
    resultWinner.style.color = cfg.hex;
  } else {
    resultWinner.textContent = '공동 우승: ' + winners.map(function(w) {
      return PLAYER_CONFIG[w].label;
    }).join(', ');
    resultWinner.style.color = '#546E7A';
  }

  // Sort players by score descending
  var order = [];
  for (var k = 0; k < playerCount; k++) { order.push(k); }
  order.sort(function(a, b) { return scores[b] - scores[a]; });

  resultScoresWrap.innerHTML = '';
  order.forEach(function(p, rank) {
    var row = document.createElement('div');
    row.className = 'result-score-row' + (scores[p] === maxScore ? ' winner-row' : '');

    var rankEl = document.createElement('span');
    rankEl.className = 'result-score-rank';
    // Rank medal using text, not emoji per spec (game elements only)
    rankEl.textContent = rank === 0 ? '1위' : (rank === 1 ? '2위' : (rank === 2 ? '3위' : (rank + 1) + '위'));

    var dot = document.createElement('span');
    dot.className = 'result-score-dot';
    dot.style.background = PLAYER_CONFIG[p].hex;

    var name = document.createElement('span');
    name.className = 'result-score-name';
    name.textContent = PLAYER_CONFIG[p].label;

    var pts = document.createElement('span');
    pts.className = 'result-score-pts';
    pts.textContent = scores[p] + '점';

    row.appendChild(rankEl);
    row.appendChild(dot);
    row.appendChild(name);
    row.appendChild(pts);
    resultScoresWrap.appendChild(row);
  });

  showScreen(resultScreen);
}
