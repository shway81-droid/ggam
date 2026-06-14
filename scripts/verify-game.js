#!/usr/bin/env node
/**
 * 게임 자동 검증 스크립트
 *
 * 사용법:
 *   node scripts/verify-game.js {folder}
 *
 * 예시:
 *   node scripts/verify-game.js english-word
 *
 * 검증 항목 (정적):
 *   1. 4개 파일 존재
 *   2. game.json 필수 필드
 *   3. index.html 4개 screen 존재
 *   4. shared/style.css, shared/engine.js 링크
 *   5. registry.json 등록
 *   6. launcher CATEGORY_MAP / FALLBACK_GAMES 등록
 *   7. JS 문법 오류 검사
 *
 * 종료 코드:
 *   0: 모든 검증 통과
 *   1: 1개 이상 실패
 *
 * 브라우저 검증은 별도 (Preview MCP 사용).
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const folder = process.argv[2];

if (!folder) {
  console.error('Usage: node scripts/verify-game.js {folder}');
  process.exit(1);
}

const gameDir = path.join(ROOT, 'games', folder);
const checks = [];

function check(name, fn) {
  try {
    const result = fn();
    if (result === true || result === undefined) {
      checks.push({ name, status: 'PASS' });
    } else {
      checks.push({ name, status: 'FAIL', detail: result });
    }
  } catch (e) {
    checks.push({ name, status: 'ERROR', detail: e.message });
  }
}

// === 1. 4개 파일 존재 ===
check('1. game.json 존재', () => {
  return fs.existsSync(path.join(gameDir, 'game.json')) || 'game.json 파일 없음';
});
check('1. index.html 존재', () => {
  return fs.existsSync(path.join(gameDir, 'index.html')) || 'index.html 파일 없음';
});
check('1. style.css 존재', () => {
  return fs.existsSync(path.join(gameDir, 'style.css')) || 'style.css 파일 없음';
});
check('1. game.js 존재', () => {
  return fs.existsSync(path.join(gameDir, 'game.js')) || 'game.js 파일 없음';
});

// === 2. game.json 필수 필드 ===
check('2. game.json 필수 필드', () => {
  const p = path.join(gameDir, 'game.json');
  if (!fs.existsSync(p)) return 'game.json 없음';
  const json = JSON.parse(fs.readFileSync(p, 'utf-8'));
  const required = ['name', 'description', 'icon', 'color', 'grades', 'playTime'];
  const missing = required.filter(k => !(k in json));
  return missing.length === 0 || `누락: ${missing.join(', ')}`;
});

// === 3. index.html 4개 screen 존재 ===
check('3. index.html screen 4개', () => {
  const p = path.join(gameDir, 'index.html');
  if (!fs.existsSync(p)) return 'index.html 없음';
  const html = fs.readFileSync(p, 'utf-8');
  const screens = ['screen-intro', 'screen-countdown', 'screen-game', 'screen-result'];
  const missing = screens.filter(s => !html.includes(s));
  return missing.length === 0 || `누락 screen: ${missing.join(', ')}`;
});

// === 4. shared 링크 ===
check('4. shared/style.css 링크', () => {
  const p = path.join(gameDir, 'index.html');
  const html = fs.readFileSync(p, 'utf-8');
  return html.includes('shared/style.css') || 'shared/style.css 링크 없음';
});
check('4. shared/engine.js 링크', () => {
  const p = path.join(gameDir, 'index.html');
  const html = fs.readFileSync(p, 'utf-8');
  return html.includes('shared/engine.js') || 'shared/engine.js 링크 없음';
});

// === 5. registry.json 등록 ===
check('5. registry.json 등록', () => {
  const p = path.join(ROOT, 'games', 'registry.json');
  const list = JSON.parse(fs.readFileSync(p, 'utf-8'));
  return list.includes(folder) || `registry.json에 "${folder}" 없음`;
});

// === 6. 런처 등록 ===
check('6. 런처 CATEGORY_MAP 등록', () => {
  const p = path.join(ROOT, 'index.html');
  const html = fs.readFileSync(p, 'utf-8');
  const re = new RegExp(`['"]${folder}['"]\\s*:\\s*['"](speed|brain|math|knowledge|coop|puzzle)['"]`);
  return re.test(html) || `CATEGORY_MAP에 "${folder}" 없음`;
});

check('6. 런처 FALLBACK_GAMES 등록', () => {
  const p = path.join(ROOT, 'index.html');
  const html = fs.readFileSync(p, 'utf-8');
  const re = new RegExp(`folder\\s*:\\s*['"]${folder}['"]`);
  return re.test(html) || `FALLBACK_GAMES에 "${folder}" 없음`;
});

// === 7. 디자인 일관성 (CSS 금지 패턴) ===
check('7. style.css에 !important 남용 없음', () => {
  const p = path.join(gameDir, 'style.css');
  if (!fs.existsSync(p)) return 'style.css 없음';
  const css = fs.readFileSync(p, 'utf-8');
  const count = (css.match(/!important/g) || []).length;
  return count <= 15 || `!important ${count}개 사용 (15개 초과 — 공통 스타일 덮어쓰기 의심)`;
});

check('7. style.css에 새 폰트 도입 없음', () => {
  const p = path.join(gameDir, 'style.css');
  const css = fs.readFileSync(p, 'utf-8');
  // @font-face 또는 @import url(font) 금지
  if (/@font-face/i.test(css)) return '@font-face 사용 금지';
  if (/@import\s+url\([^)]*font/i.test(css)) return '폰트 @import 금지';
  return true;
});

check('7. game.json color가 헥스 형식', () => {
  const p = path.join(gameDir, 'game.json');
  const json = JSON.parse(fs.readFileSync(p, 'utf-8'));
  return /^#[0-9A-Fa-f]{6}$/.test(json.color) || `color "${json.color}" — #RRGGBB 형식이어야 함`;
});

check('7. index.html에 PLAY 버튼 클래스 보존', () => {
  const p = path.join(gameDir, 'index.html');
  const html = fs.readFileSync(p, 'utf-8');
  return html.includes('btn-play') || 'btn-play 클래스 없음 — 골든 템플릿 PLAY 버튼 깨짐';
});

check('7. index.html에 result-actions 보존', () => {
  const p = path.join(gameDir, 'index.html');
  const html = fs.readFileSync(p, 'utf-8');
  return html.includes('result-actions') || 'result-actions 없음 — 다시하기/홈 버튼 깨짐';
});

check('7. 터치 접근성: style.css에 다크 배경 색 없음', () => {
  const p = path.join(gameDir, 'style.css');
  if (!fs.existsSync(p)) return 'style.css 없음';
  const css = fs.readFileSync(p, 'utf-8');
  // 흔한 다크 배경 색상 체크 (GAME_ANTIPATTERNS.md C절 명시 색 포함)
  const darkColors = [
    /background[^;]*#000(?:000)?(?:[^0-9a-f]|$)/i,
    /background[^;]*#0D1B2A/i,
    /background[^;]*#1A1A1A/i,
    /background[^;]*#1a1a2e/i,
    /background[^;]*#222(?:[^0-9a-f]|$)/i,
    /background[^;]*#0a0a0a/i,
  ];
  for (const re of darkColors) {
    if (re.test(css)) return `다크 배경 색 발견 (Level 3 위반): ${re}`;
  }
  return true;
});

check('7. 3인용 공정성: 3열 균등 배치 (2+1 금지)', () => {
  const p = path.join(gameDir, 'style.css');
  if (!fs.existsSync(p)) return 'style.css 없음';
  const css = fs.readFileSync(p, 'utf-8');

  // .zones-wrap.p3 규칙이 없으면 zone 기반 게임이 아님 → 통과
  const p3Block = css.match(/\.zones-wrap\.p3\s*\{([^}]*)\}/);
  if (!p3Block) return true;

  // 금지: P3가 하단 전체폭을 차지하는 2+1 배치 (nth-child(3) grid-column 스팬)
  if (/\.zones-wrap\.p3\s+\.zone:nth-child\(3\)\s*\{[^}]*grid-column\s*:\s*1\s*\/\s*3/.test(css)) {
    return '2+1 배치 발견 — 3인용은 3열 균등(1fr 1fr 1fr)이어야 공정함 (P3 비대칭 금지)';
  }

  // 권장: 3열 균등 컬럼
  const cols = p3Block[1].match(/grid-template-columns\s*:\s*([^;]+)/);
  if (cols) {
    const v = cols[1].replace(/\s+/g, ' ').trim();
    const frCount = (v.match(/1fr/g) || []).length;
    if (frCount < 3) {
      return `.zones-wrap.p3 컬럼이 "${v}" — 3인용은 "1fr 1fr 1fr" 3열 균등이어야 공정함`;
    }
  }
  return true;
});

// === 8. 카테고리 매핑 일관성 (런처 ↔ engine.js) ===
check('8. 카테고리 매핑 일관성 (launcher ↔ engine.js)', () => {
  const launcher = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf-8');
  const engine = fs.readFileSync(path.join(ROOT, 'shared', 'engine.js'), 'utf-8');

  const launcherRe = new RegExp(`['"]${folder}['"]\\s*:\\s*['"](speed|brain|math|knowledge|coop|puzzle)['"]`);
  const engineRe = new RegExp(`['"]${folder}['"]\\s*:\\s*['"](speed|brain|math|knowledge|coop|puzzle)['"]`);

  const launcherMatch = launcher.match(launcherRe);
  const engineMatch = engine.match(engineRe);

  if (!launcherMatch) return `런처에 카테고리 없음`;
  if (!engineMatch) return `engine.js _GAME_CATEGORY_MAP에 "${folder}" 없음 (BGM 분류 누락)`;
  if (launcherMatch[1] !== engineMatch[1]) {
    return `카테고리 불일치 — launcher: ${launcherMatch[1]}, engine: ${engineMatch[1]}`;
  }
  return true;
});

// === 9. JS 문법 검사 ===
check('9. game.js 문법 검사', () => {
  const p = path.join(gameDir, 'game.js');
  if (!fs.existsSync(p)) return 'game.js 없음';
  try {
    execSync(`node --check "${p}"`, { stdio: 'pipe' });
    return true;
  } catch (e) {
    return `문법 오류: ${e.stderr.toString().split('\n')[0]}`;
  }
});

// === 결과 출력 ===
console.log(`\n=== 게임 검증: ${folder} ===\n`);
let passed = 0, failed = 0;
checks.forEach(c => {
  const icon = c.status === 'PASS' ? '✓' : '✗';
  const detail = c.detail ? ` — ${c.detail}` : '';
  console.log(`  ${icon} ${c.name}${detail}`);
  if (c.status === 'PASS') passed++;
  else failed++;
});

console.log(`\n결과: ${passed}/${checks.length} 통과`);
if (failed > 0) {
  console.log(`❌ ${failed}개 실패 — 수정 필요`);
  process.exit(1);
} else {
  console.log('✅ 정적 검증 모두 통과');
  console.log('   다음: 브라우저 검증 (Preview MCP로 실제 동작 테스트)');
  process.exit(0);
}
