# 데스크톱 루틴 프롬프트 (붙여넣기용)

> Claude 데스크톱 앱 → 루틴(예약 작업)에 아래 블록을 그대로 붙여넣는다.
> 스케줄: **매일 10:00 KST**. 상세 절차는 저장소의 `docs/AUTO_MODE.md`에 있다.
> (이 짧은 프롬프트는 트리거 + 불변식만 담고, 절차 본문은 AUTO_MODE.md를 참조한다.)

---

```text
[자동 게임 추가 - 매일 10시 KST · 하루 목표 2개]

작업 디렉토리: C:/Users/User/Desktop/claude
대상 브랜치: main

저장소 `docs/AUTO_MODE.md`의 절차를 정확히 따라 새 게임을 자동으로 추가하라.
골든 템플릿은 `docs/PATTERNS.md`, 후보 제외 기준은 `docs/GAME_ANTIPATTERNS.md`(0절)
+ `docs/SELECTION.md`(삭제 1·2·3차)를 읽어 적용한다. 완전 자동 모드 — 사용자 승인 없음.

## 반드시 지킬 불변식
- 하루 목표 2개. `node scripts/auto-add-game-helpers.js preflight`로 시작해
  blockedForToday/alreadyComplete면 종료, 아니면 pendingGames만큼 제작.
- `git pull origin main` 실패 시 그날 중단. 푸시는 `git push origin main`.
- 카테고리 균등: 제작 전 게임 풀을 .claude/game-pool.json에 생성(가장 적은 카테고리 우선),
  소진 시 재생성, 삭제된 게임은 재생성 금지.
- 등록은 game.json 작성 후 `npm run gen` (CATEGORY_MAP/GAME_ICONS/PLAYER_COUNTS 수동편집 없음).
- 검증: `node scripts/verify-game.js {folder}` 전부 PASS + `npm test` + Preview MCP 자동 플레이.
- 커밋 제목은 반드시 "Auto-add:" 로 시작 (헬퍼가 이 프리픽스로 진행도 집계).
- shared/style.css 수정 금지. 디자인 새로 만들지 말 것(골든 템플릿 그대로).
- 종료 직전 `node scripts/auto-add-game-helpers.js today-pushed-count`로 재확인 —
  2개에 못 미치고 차단 안 됐으면 다음 게임 계속(절대 조기 종료 금지).
- 사용자가 중간에 질문해도 pendingGames가 0이 될 때까지 멈추지 말 것(짧게 답하고 즉시 재개).

## 종료
별도 메시지 없이 작업 끝. 결과는 git 커밋 로그로만 확인.
성공: `git log --oneline | grep Auto-add` 오늘 자 2건.
일부 성공: 1건 (다음날 preflight가 pendingGames:1로 자동 보강).
```

---

## 전제 확인 (최초 1회)

이 프롬프트는 작업 디렉토리가 **`shway81-droid/jjam`을 `main`으로 클론한 것**이라고 가정한다.
데스크톱에서 한 번만 확인:

```bash
git remote -v      # → shway81-droid/jjam 이어야 함
git branch         # → main 추적
```

전작(`jjamjjami-gyosil`)이나 `master` 기반이면 이 루틴은 맞지 않는다 — 디렉토리를 jjam으로 교체할 것.
