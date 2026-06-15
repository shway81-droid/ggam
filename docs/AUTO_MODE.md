# 자동 게임 추가 — 절차서 (AUTO_MODE)

> 매일 **10:00 KST** 데스크톱 루틴이 이 문서를 따라 새 게임을 자동 추가한다.
> **하루 목표 2개. 완전 자동(사용자 승인 단계 없음). 대상 브랜치 `main`.**
> 데스크톱에 붙여넣는 트리거 프롬프트: `docs/AUTO_ROUTINE_PROMPT.md`
> 골든 템플릿(복사 기준): `docs/PATTERNS.md`

## 핵심 원칙

1. **기존과 일치** — 새 디자인을 발명하지 않는다. `PATTERNS.md`의 골든 템플릿을 그대로
   복사하고 Level 3 Comic(크림 `#FFF8E1`·검정 3px 테두리·하드 그림자)을 고정한다.
2. **카테고리 균등** — 제작 전 게임 풀을 먼저 만들어 *가장 적은 카테고리부터* 채운다.
   풀이 소진되면 재생성한다. **이미 삭제된 게임은 재생성하지 않는다.**
3. **전수 검증** — 만들면 검증하고, 오류가 있으면 통과할 때까지 고친다.

## 사용하는 헬퍼

```
node scripts/auto-add-game-helpers.js <command>
  preflight              실패차단 + 오늘 푸시 수 + pendingGames 통합 응답
  stats                  카테고리별 게임 수 (풀 생성 입력)
  list-existing-folders  등록된 폴더명 목록
  today-pushed-count     오늘 KST Auto-add 푸시 수 + 남은 수
  discard <folder>       실패 게임 폐기(폴더+registry+메타 재생성+실패로그)
  recent-failures        오늘 실패 횟수(3회 시 차단)
```

---

## 0. 사전 점검 (필수)

```bash
node scripts/auto-add-game-helpers.js preflight
git pull origin main      # 실패 시 그날 작업 중단
```

`preflight` 응답으로 분기:

| 조건 | 행동 |
|---|---|
| `shouldRun:false` + `blockedForToday:true` | 즉시 종료 (오늘 누적 실패 3회) |
| `shouldRun:false` + `alreadyComplete:true` | 즉시 종료 (오늘 이미 2개 푸시) |
| `shouldRun:true` | `pendingGames`(1 또는 2) 개수만큼 제작 |

> ⚠️ `pendingGames`를 변수로 기억하라. = "오늘 추가로 만들어야 하는 게임 수".
> 1이면 1개만, 2면 2개를 연속 제작한다.

## 1. 게임 풀 생성·선택 (카테고리 균등)

게임 풀은 `.claude/game-pool.json`에 로컬 영구 저장한다(`.gitignore`되어 커밋 안 됨 —
같은 데스크톱에서 매일 이어 쓴다).

```bash
node scripts/auto-add-game-helpers.js stats
node scripts/auto-add-game-helpers.js list-existing-folders
```

**(A) 풀이 없거나 비었으면 재생성한다:**

- `stats`의 `byCategory`에서 **가장 적은 카테고리부터** 채워, 6개 카테고리
  (speed/brain/math/knowledge/coop/puzzle)가 균등해지도록 후보 **12개**를 만든다.
- 각 후보 = `{ folder, name, category, pattern, template }`
  (`pattern`=A~D, `template`=`PATTERNS.md`의 복사할 실존 게임 폴더).
- 만든 배열을 `.claude/game-pool.json`에 저장한다.

**(B) 오늘 만들 게임을 풀 앞에서 꺼낸다:**

- N번째 게임은 *오늘 이미 푸시된 게임 + 직전 게임*과 **다른 카테고리 우선**(다양성).
  `preflight` 응답 `todayPushed[].subject`의 `(카테고리, …)`에서 추출해 회피.
  후보가 그 카테고리에만 남았으면 같은 카테고리도 허용.
- 선택 항목은 풀에서 제거(소비). 풀이 비면 다음 실행에서 (A)로 재생성된다.

### 재생성 금지(avoid) 기준 — 후보 생성 시 전부 교차 대조

- 현재 `games/registry.json`의 등록 폴더(중복 폴더·동일 메커니즘 금지)
- `docs/GAME_ANTIPATTERNS.md` 0절 — **삭제 확정 17종**
- `docs/SELECTION.md` — **사용자 삭제 1차·2차·3차** 전체
- 폴더명이 달라도 기존 게임과 *데이터 형식 + 인터랙션*이 같으면 금지

## 2. 제작 (게임마다)

`docs/PATTERNS.md`를 따른다:

1. 패턴에 맞는 골든 템플릿 폴더를 `games/<새폴더>/`로 통째 복사.
2. 4파일(`game.json`, `index.html`, `style.css`, `game.js`) 작성. 디자인은 템플릿 그대로.
3. `game.json`에 `category`·`players`·`icon`·`color` 정확히 기입(메타데이터 단일 소스).
4. `games/registry.json` 배열에 새 폴더명 추가.
5. 파생 메타 자동 생성:

```bash
npm run gen   # → index.html FALLBACK_GAMES + shared/engine.js _GAME_CATEGORY_MAP
```

## 3. 검증 (게임마다, 모두 통과해야 함)

```bash
node scripts/verify-game.js <폴더>   # 정적 21항목 전부 PASS
npm test                              # gen --check 동기화 + 전 게임 정합성 (CI와 동일 게이트)
```

- **브라우저:** Preview MCP로 인트로→게임→결과 자동 플레이, 콘솔 에러 0개.
- **자가 품질 게이트 6개:**
  - (a) 데이터 30개 이상 (패턴 A 한정)
  - (b) 보기 정답 중복 없음
  - (c) 인트로 일러스트 존재
  - (d) `shared/style.css` 미수정 (engine.js `_GAME_CATEGORY_MAP`은 `npm run gen`이 갱신 → 허용)
  - (e) 콘솔 에러 0
  - (f) 결과 화면 도달 성공

## 4. 통과 시 (게임마다) — 커밋·푸시

```bash
git add games/<폴더>/ games/registry.json index.html shared/engine.js
git commit -m "Auto-add: <이름> (<카테고리>, 패턴 <A|B|C|D>)"
git push origin main
```

> **커밋 제목은 반드시 `Auto-add:`로 시작**한다 — 헬퍼의 `today-pushed-count`/`preflight`가
> 이 프리픽스로 오늘 푸시 수를 집계한다. 형식이 깨지면 진행도 추적이 망가진다.

푸시 실패(네트워크)는 로컬 커밋을 유지하고 다음 게임으로 계속한다.

## 5. 실패 시

```bash
node scripts/auto-add-game-helpers.js discard <폴더>
node scripts/auto-add-game-helpers.js recent-failures
```

- 실패 후보는 `.claude/game-pool.json`에서도 제거하고 다음 후보로.
- `blockedForToday:true`(오늘 누적 3회) → 그날 작업 중단. 아니면 다음 후보 시도.

## 6. 종료 전 자가 점검 (필수)

```bash
node scripts/auto-add-game-helpers.js today-pushed-count
```

- `todayPushedCount`가 `dailyTarget`(=2)에 도달했는가?
- 부족 + `blockedForToday` 아님 → **다음 게임 제작 계속(절대 종료 금지)**.
- 도달 또는 차단 → 종료.

---

## 실행 흐름 (요약)

```
[preflight] →
  blockedForToday → 종료
  alreadyComplete → 종료
  else (pendingGames = 1 또는 2):
    반복: [풀 선택 → 제작 → 검증(verify + npm test + 브라우저) → 커밋 → push origin main]
    종료 직전: today-pushed-count 재확인
      → 부족 + 미차단 → 다음 게임 계속
      → 충족 또는 차단 → 종료
```

## 절대 금지

- `shared/style.css` 수정 (engine.js `_GAME_CATEGORY_MAP` 갱신은 `npm run gen` 경유만 허용)
- 사용자 승인 단계 (완전 자동 모드)
- 디자인 새로 만들기 (골든 템플릿 그대로)
- `GAME_ANTIPATTERNS.md`(0절)·`SELECTION.md`(삭제 1·2·3차)의 게임/메커니즘 재생성
- 사용자가 중간에 질문해도 `pendingGames`가 0이 될 때까지 작업 중단 금지
  (짧게 답하고 즉시 재개)
- 자가 점검(6단계) 생략 금지 — 게임 1개 푸시하고 끝내지 말 것

## 종료

별도 메시지 없이 끝낸다. 결과는 git 커밋 로그로만 확인:
`git log --oneline | grep Auto-add` 의 오늘 자 커밋 수.
일부 성공(1건)이면 다음날 `preflight`가 `pendingGames:1`로 자동 보강한다.
