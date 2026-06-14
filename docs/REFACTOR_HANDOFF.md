# 작업 인수인계 — 보일러플레이트 공통화 (새 세션 이어가기용)

> 작성: 2026-06-14 · 대상 브랜치: `claude/gallant-babbage-d7hqb6`
> 이 문서는 새 세션이 중단 지점부터 바로 이어갈 수 있도록 작성됨.

---

## 0. 새 세션에서 가장 먼저 할 일 (요약)

1. **네트워크 허용 목록 확인** — 환경 설정에서 `cdn.playwright.dev`, `*.playwright.dev`, `storage.googleapis.com`이 Custom allowlist에 추가됐고 "default package managers"도 체크돼 있어야 함. (이게 돼 있어야 브라우저 검증 가능)
2. **Chromium + Playwright 설치**:
   ```bash
   python3 -m pip install playwright
   python3 -m playwright install chromium
   # 확인: python3 -c "from playwright.sync_api import sync_playwright; print('ok')"
   ```
   설치가 또 막히면(403 Host not in allowlist) → 허용 목록이 아직 반영 안 된 것. 사용자에게 확인 요청.
3. **보일러플레이트 공통화 진행** — 아래 §3 계획대로. **카운트다운부터 파일럿**(사용자 결정).

---

## 1. 프로젝트 개요

- **짬짬이 교실** — 전자칠판용 초등 미니게임 **78개**. 빌드 도구 없는 순수 정적 PWA. GitHub Pages 배포.
- 저장소: `shway81-droid/jjam` · 배포: https://shway81-droid.github.io/jjam/
- 구조:
  - `index.html` 런처(룰렛+그리드) / `shared/engine.js`(타이머·점수·사운드·BGM·자동FX) / `shared/style.css`
  - `games/<폴더>/` 게임별 `game.json`+`index.html`+`style.css`+`game.js` (4파일 자기완결)
  - `games/registry.json` 게임 목록 / `scripts/verify-game.js` 정적검증(21항목)
  - `sw.js` 서비스워커 / `.github/workflows/pages.yml` 배포

## 2. 이번 세션에서 완료된 작업 (전부 main 머지·배포됨)

| PR | 내용 | 상태 |
|----|------|------|
| #8 | 문서 게임 수 정합성 81→78, README 카테고리 분포 재집계, 깨진 링크 `ggam`→`jjam` | ✅ 머지·배포 |
| #9 | **SW 캐시 버전 배포 시 자동 범프** — `pages.yml`이 `sw.js`의 `CACHE_NAME`을 커밋 SHA로 sed 치환. 게임/공통 파일 수정이 다음 접속 시 자동 반영(수동 +1 불필요) | ✅ 머지·배포(검증: gh-pages에 `gyosil-noriplan-359177c` 확인) |
| #10 | **og:image 추가** — `og-image.svg`(게임수 46→78 수정, 폰트 36→30) → `og-image.png` 변환(cairosvg+나눔고딕), `index.html`에 og/twitter 메타, `sw.js` 프리캐시 | ✅ 머지·배포 |

> 주의: 이 브랜치는 PR 머지(squash)마다 main과 갈라져서, 새 작업 전 `git reset --hard origin/<branch>` 후 `git merge origin/main` 패턴으로 동기화해 왔음. force-push는 차단됨(정책). 새 작업은 origin/main 기준으로 진행 권장.

## 3. 다음 작업: 보일러플레이트 공통화 (진행 예정)

### 목표
78개 game.js에 복붙된 **구조적 보일러플레이트**를 `engine.js`로 끌어올려 코드 중복 제거.
- 대상 4종: **카운트다운 · 화면전환(showScreen) · 사운드 토글 버튼 · 플레이어 설정**
- 사용자 결정 진행 방식: **카운트다운부터 파일럿** → 정적+브라우저 검증 → 이상 없으면 나머지 패턴 순차.

### 측정된 중복 규모 (재측정 불필요)
- 전체 game.js: **46,020줄** / 78게임 / 평균 590줄
- 여러 게임에 동일 반복되는 줄: **약 4,600줄** (~10%) — 단 절반은 `} else {` 등 못 줄이는 문법
- **실질 제거 가능(구조적 보일러플레이트): 게임당 ~40줄 × ~70게임 ≈ 2,000~3,000줄**
- 단일 최대 항목: **카운트다운 블록 ~1,000줄**(66게임 × ~15줄)

### 패턴별 현황 (조사 결과)
- `startCountdown(onDone)` 보유: **66게임**. 블록이 거의 동일.
  - 표준 요소 ID `countdownNumber`: **78게임 전부 사용** (일관 ✅)
  - 표준 패턴: `var count=3` → `setInterval`(1000ms) → `count--` → `if(count<=0){clearInterval; onDone()} else {countdownNumber.textContent=count; 애니메이션 리셋}`
- `createSoundManager()` 호출: 78게임 전부. 표준효과음(ding 등) 재정의: 63게임 (이미 PR #7에서 일부 정리됨; `DEFAULT_SOUNDS`가 engine.js에 존재)
- `createTimer()`(엔진 제공) 사용: **7게임뿐** (71게임이 직접 setInterval)
- 사운드 토글 버튼/뒤로가기: 78게임 전부
- 플레이어 설정(PLAYER_NAMES/COLORS/CONFIG): 69게임

### ⚠️ 핵심 위험 요소 (반드시 주의)
1. **`showScreen()` 호출 시그니처가 게임마다 다름**:
   - 요소 방식: `showScreen(countdownScreen)` (DOM 요소 변수) — 다수(~68)
   - 문자열 방식: `showScreen('countdown')` (이름 문자열) — 일부(예: memory-match, balloon-pop)
   - → 일괄 치환 금지. 카운트다운 헬퍼는 **screen 전환을 건드리지 말고**, 게임이 기존 `showScreen(...)`을 그대로 호출하게 둘 것.
2. **`countdownInterval` 변수**를 게임이 다른 곳(조기 종료 등)에서 `clearInterval`하는 경우가 있음 → 제거 전 각 게임에서 다른 참조 없는지 확인.
3. 스코프: 77게임 IIFE 래핑, 1게임 전역.
4. game.js 내 효과음/로직은 원작 보존이 원칙(`docs/GAME_ANTIPATTERNS.md` 참고).

### 권장 설계 (카운트다운 파일럿)
- `engine.js`에 **하위호환 헬퍼** 추가. 예:
  ```js
  // 표준 카운트다운: countdownNumber 요소를 3→2→1, 매초 갱신, 끝나면 onDone.
  // 화면 전환은 호출 측 책임(showScreen 시그니처 변종 회피).
  function runCountdown(onDone, opts) { /* setInterval 관리, 반환값으로 취소 함수 */ }
  ```
- 게임의 `startCountdown`은:
  ```js
  function startCountdown(onDone) {
    showScreen(countdownScreen);   // 게임 고유 — 그대로 유지
    countdownInterval = runCountdown(onDone);  // 블록 치환
  }
  ```
- 파일럿: 시그니처 변종을 모두 포함하도록 **요소형 1~2개 + 문자열형 1~2개** 게임에 먼저 적용 → 검증 → 전체 확대.

### 검증 절차
1. 정적: `node scripts/verify-game.js <folder>` (21항목) + `node --check games/<folder>/game.js`
2. 브라우저(설치 후): Playwright 헤드리스로 게임당 로드→PLAY→카운트다운→게임화면 진입→수초 무작위 터치, JS예외/콘솔오류 0 확인. (이전 PR #5·#7 방식)
3. `sw.js` `CACHE_NAME`은 배포 시 자동 범프되므로 **수동 변경 불필요**(#9).

### 작업 분할(PR) 제안
- PR-A: 엔진 헬퍼 + 카운트다운 전 게임 적용
- PR-B: 화면전환 표준화(showScreen 시그니처 통일 — 위험 높음, 신중)
- PR-C: 사운드 토글 버튼 공통화
- PR-D: 플레이어 설정 공통화

## 4. 이 환경에서 확인된 도구 가용성
- ✅ node v22, npm/npx, python3.11+pip, apt (PyPI·우분투 저장소 접근 가능)
- ✅ 이미 설치됨: `cairosvg`, `fonts-nanum`(한글), `playwright`(파이썬 패키지)
- ❌ **Chromium 미설치** — `cdn.playwright.dev` 차단으로 다운로드 실패. 우분투 `chromium`은 snap 껍데기라 불가.
  → 네트워크 허용 목록 추가가 선행 조건(§0).

## 5. 미진행 추천 (참고)
- 화면전환/사운드/플레이어 공통화(위 PR-B~D)
- (이전 분석의 나머지) 특이사항 없음. README/메타 정합성·SW 자동범프·og:image는 완료.
