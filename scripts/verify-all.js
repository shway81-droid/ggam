#!/usr/bin/env node
/**
 * 전체 게임 일괄 검증 + 저장소 정합성 검사
 *
 * 사용법: node scripts/verify-all.js   (또는 npm run verify)
 *
 * 검사 항목:
 *   1. registry.json ↔ games/ 디렉토리 정합성 (양방향 누락 없음)
 *   2. registry의 전 게임에 verify-game.js 실행 (정적 20여 항목)
 *
 * 종료 코드: 0 = 모두 통과, 1 = 1개 이상 실패
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const gamesDir = path.join(ROOT, 'games');
const registry = JSON.parse(fs.readFileSync(path.join(gamesDir, 'registry.json'), 'utf-8'));

const problems = [];

// === 1. registry ↔ 디스크 정합성 ===
const dirs = fs.readdirSync(gamesDir).filter(f =>
  fs.statSync(path.join(gamesDir, f)).isDirectory()
);
const onDiskNotReg = dirs.filter(d => !registry.includes(d));
const inRegNotDisk = registry.filter(r => !dirs.includes(r));
if (onDiskNotReg.length) problems.push(`디스크에 있지만 registry에 없음: ${onDiskNotReg.join(', ')}`);
if (inRegNotDisk.length) problems.push(`registry에 있지만 디스크에 없음: ${inRegNotDisk.join(', ')}`);

// === 2. 전 게임 정적 검증 ===
let pass = 0;
const failed = [];
for (const g of registry) {
  try {
    execSync(`node "${path.join(__dirname, 'verify-game.js')}" "${g}"`, { stdio: 'pipe' });
    pass++;
  } catch (e) {
    failed.push(g);
  }
}

console.log(`\n게임 검증: ${pass}/${registry.length} 통과`);
if (failed.length) {
  console.log(`❌ 실패(${failed.length}): ${failed.join(', ')}`);
  console.log('   → node scripts/verify-game.js <폴더> 로 상세 확인');
}
problems.forEach(p => console.log(`✗ ${p}`));

if (failed.length || problems.length) {
  process.exit(1);
}
console.log('✅ 전체 검증 통과');
