#!/usr/bin/env node
/**
 * 자동 게임 추가 - 보조 스크립트 모음
 *
 * Claude가 자동 모드에서 호출하는 헬퍼:
 *   list-existing-folders   현재 등록된 폴더명 출력
 *   stats                   카테고리별 게임 수 출력 (선택 알고리즘 입력)
 *   discard <folder>        실패 게임 폐기 (폴더 삭제 + registry/launcher 등록 해제)
 *   recent-failures         최근 3회 실패 기록 (3연속 실패 차단용)
 *   today-pushed-count      오늘 KST 푸시된 Auto-add 커밋 수 + 남은 게임 수
 *   preflight               recent-failures + today-pushed-count + pendingGames 통합 응답
 *
 * 사용법:
 *   node scripts/auto-add-game-helpers.js <command> [args]
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const REGISTRY = path.join(ROOT, 'games', 'registry.json');
const FAIL_LOG = path.join(ROOT, '.claude', 'auto-failures.json');

const cmd = process.argv[2];
const arg = process.argv[3];

function readRegistry() {
  return JSON.parse(fs.readFileSync(REGISTRY, 'utf-8'));
}

function readFailLog() {
  if (!fs.existsSync(FAIL_LOG)) return [];
  try { return JSON.parse(fs.readFileSync(FAIL_LOG, 'utf-8')); }
  catch { return []; }
}

function writeFailLog(arr) {
  fs.mkdirSync(path.dirname(FAIL_LOG), { recursive: true });
  fs.writeFileSync(FAIL_LOG, JSON.stringify(arr, null, 2));
}

if (cmd === 'list-existing-folders') {
  const reg = readRegistry();
  console.log(reg.join('\n'));
  process.exit(0);
}

if (cmd === 'stats') {
  // 카테고리는 game.json 단일 소스에서 집계
  const reg = readRegistry();
  const counts = { speed: 0, brain: 0, math: 0, knowledge: 0, coop: 0, puzzle: 0 };
  reg.forEach(folder => {
    try {
      const j = JSON.parse(fs.readFileSync(path.join(ROOT, 'games', folder, 'game.json'), 'utf-8'));
      if (counts[j.category] !== undefined) counts[j.category]++;
    } catch (e) {}
  });
  console.log(JSON.stringify({ total: reg.length, byCategory: counts }, null, 2));
  process.exit(0);
}

if (cmd === 'discard') {
  if (!arg) { console.error('Usage: discard <folder>'); process.exit(1); }
  const folder = arg;

  // 1. Delete game folder
  const gameDir = path.join(ROOT, 'games', folder);
  if (fs.existsSync(gameDir)) {
    fs.rmSync(gameDir, { recursive: true, force: true });
    console.log(`✓ 폴더 삭제: games/${folder}`);
  }

  // 2. Remove from registry.json
  const reg = readRegistry();
  const newReg = reg.filter(f => f !== folder);
  if (newReg.length !== reg.length) {
    fs.writeFileSync(REGISTRY, JSON.stringify(newReg) + '\n');
    console.log(`✓ registry.json에서 제거`);
  }

  // 3. 파생 메타데이터 재생성 (런처 FALLBACK_GAMES + engine 카테고리맵)
  //    — category/players/폴백은 game.json 단일 소스에서 gen-metadata.js가 생성
  execSync(`node "${path.join(__dirname, 'gen-metadata.js')}"`, { stdio: 'inherit' });
  console.log(`✓ 파생 메타데이터 재생성 (launcher/engine)`);

  // 6. Record failure
  const failures = readFailLog();
  failures.push({ folder, timestamp: new Date().toISOString() });
  // Keep only last 7 days
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recent = failures.filter(f => new Date(f.timestamp).getTime() > sevenDaysAgo);
  writeFailLog(recent);
  console.log(`✓ 실패 로그 기록`);

  process.exit(0);
}

if (cmd === 'recent-failures') {
  const failures = readFailLog();
  // Today's failures only (KST)
  const now = new Date();
  const kstOffset = 9 * 60 * 60 * 1000;
  const kstNow = new Date(now.getTime() + kstOffset);
  const todayKstStart = new Date(kstNow);
  todayKstStart.setUTCHours(0, 0, 0, 0);
  const todayStartUtc = todayKstStart.getTime() - kstOffset;

  const todayFailures = failures.filter(f => new Date(f.timestamp).getTime() >= todayStartUtc);
  console.log(JSON.stringify({
    todayCount: todayFailures.length,
    todayFailures,
    blockedForToday: todayFailures.length >= 3
  }, null, 2));
  process.exit(0);
}

if (cmd === 'reset-failures') {
  writeFailLog([]);
  console.log('✓ 실패 로그 초기화');
  process.exit(0);
}

// 오늘 KST 기준 푸시된 Auto-add 커밋 수와 남은 게임 수 계산
function todayPushedInfo() {
  const DAILY_TARGET = 2;
  let pushedToday = [];
  try {
    const raw = execSync('git log --format="%h|%aI|%s" -n 50', { cwd: ROOT, encoding: 'utf-8' });
    const kstOffset = 9 * 60 * 60 * 1000;
    const now = new Date();
    const kstNow = new Date(now.getTime() + kstOffset);
    const kstTodayStart = new Date(Date.UTC(
      kstNow.getUTCFullYear(),
      kstNow.getUTCMonth(),
      kstNow.getUTCDate(),
      0, 0, 0
    ));
    const todayStartUtc = kstTodayStart.getTime() - kstOffset;
    raw.split(/\r?\n/).forEach(line => {
      if (!line) return;
      const [hash, iso, ...rest] = line.split('|');
      const subject = rest.join('|');
      if (!subject || !subject.startsWith('Auto-add:')) return;
      const ts = new Date(iso).getTime();
      if (ts >= todayStartUtc) pushedToday.push({ hash, iso, subject });
    });
  } catch (e) {
    return { error: String(e.message || e), todayPushedCount: 0, pendingGames: DAILY_TARGET };
  }
  const pendingGames = Math.max(0, DAILY_TARGET - pushedToday.length);
  return {
    dailyTarget: DAILY_TARGET,
    todayPushedCount: pushedToday.length,
    todayPushed: pushedToday,
    pendingGames,
    alreadyComplete: pendingGames === 0
  };
}

if (cmd === 'today-pushed-count') {
  console.log(JSON.stringify(todayPushedInfo(), null, 2));
  process.exit(0);
}

if (cmd === 'preflight') {
  const failures = readFailLog();
  const now = new Date();
  const kstOffset = 9 * 60 * 60 * 1000;
  const kstNow = new Date(now.getTime() + kstOffset);
  const todayKstStart = new Date(kstNow);
  todayKstStart.setUTCHours(0, 0, 0, 0);
  const todayStartUtc = todayKstStart.getTime() - kstOffset;
  const todayFailures = failures.filter(f => new Date(f.timestamp).getTime() >= todayStartUtc);
  const blockedForToday = todayFailures.length >= 3;

  const pushed = todayPushedInfo();

  const shouldRun = !blockedForToday && !pushed.alreadyComplete;
  const action = blockedForToday
    ? 'abort: 오늘 누적 실패 3회 도달 → 그날 작업 중단'
    : pushed.alreadyComplete
      ? 'skip: 오늘 이미 2개 모두 푸시됨 → 추가 작업 불필요'
      : `proceed: ${pushed.pendingGames}개 게임 제작 필요 (오늘 이미 ${pushed.todayPushedCount}개 푸시)`;

  console.log(JSON.stringify({
    todayFailCount: todayFailures.length,
    blockedForToday,
    todayPushedCount: pushed.todayPushedCount,
    todayPushed: pushed.todayPushed,
    pendingGames: pushed.pendingGames,
    alreadyComplete: pushed.alreadyComplete,
    shouldRun,
    action
  }, null, 2));
  process.exit(0);
}

console.error(`Unknown command: ${cmd}`);
console.error('Available: list-existing-folders | stats | discard <folder> | recent-failures | reset-failures');
process.exit(1);
