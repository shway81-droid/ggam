# 골든 템플릿 — 패턴별 복사 기준 (PATTERNS)

> 자동 추가 루틴(`docs/AUTO_MODE.md`)이 새 게임을 만들 때 **새 디자인을 발명하지 않고**
> 아래 실존 게임 폴더를 통째로 복사해 시작한다. 모든 템플릿은 현재 저장소에 존재한다.
> 공통 불변식과 등록 절차는 이 문서 하단을 따른다.

## 공통 4화면 골격 (모든 게임 동일)

`games/<폴더>/index.html`은 4개 화면(screen)을 가진다 — 검증(`verify-game.js`)이 강제한다:

```
screen-intro      인트로(제목·일러스트·인원 선택 .player-btn·PLAY 버튼 .btn-play)
screen-countdown  카운트다운(.countdown-number, engine.js runCountdown 사용)
screen-game       게임(HUD 타이머·점수·게임 영역)
screen-result     결과(승자·점수·.result-actions[다시하기/홈])
```

`<head>`에 공통 자원 링크 필수: `../../shared/style.css` + `../../shared/engine.js`.
engine.js가 제공하는 헬퍼를 재사용한다: `runCountdown`, `createTimer`, `createScoreboard`,
`createSoundManager`(+`DEFAULT_SOUNDS`), `setupSoundToggle`, `setupPlayerSelect`,
`onTap`, `getAutoplayPauseMs`, `goHome`. (BGM·군중음·상황 효과음은 자동 주입 — 게임 코드 무수정)

## 패턴 A — 데이터 4지선다 / 분류 (knowledge·일부 math)

대상→4지선다 반복. 문제 데이터 풀에서 매 라운드 무작위 출제.

- **골든 템플릿:** `flag-quiz` · `opposite-word` · `ox-quiz` · `quick-math`
- **구조:** `TOTAL_ROUNDS`(보통 10) × `ROUND_TIME`(초). `PLAYER_CONFIG` 존(P1~P4) 동시 응답.
  데이터는 배열/라이브러리로 보유(예: flag-quiz의 국기 SVG 라이브러리).
- **품질 필수:** 데이터 **30개 이상**(자가 게이트 a). 보기 4개 중 정답 1개 확정 —
  오답이 정답으로도 성립하면 `avoid` 로직으로 제외(GAME_ANTIPATTERNS B-2).
- **인원:** 보통 `"2-4명"`.

## 패턴 B — 반응속도 / 타이밍 탭 (speed)

존별로 빠르게 터치·반응하되 **판단 요소 내장**(비교·홀짝·누적합·속성 조합 등).

- **골든 템플릿:** `balloon-pop` · `reaction-race` · `chase-tap`
- **구조:** 제한시간(보통 30초) 동안 점수 경쟁. `game-zones`에 플레이어 존을 동적 생성.
  HUD에 타이머 바(`timerFill`)+점수(`hudScores`).
- **품질 필수:** 흔한 클론(두더지)·자제력 타이밍("0에서 멈춤")·순간노출 기억 금지
  (GAME_ANTIPATTERNS A-2). "빠르게 누르기"만이 아니라 깊은 판단을 담을 것.
- **인원:** 보통 `"2-4명"`.

## 패턴 C — 보드/전략 · 공간 퍼즐 (brain·puzzle)

번갈아 두는 전략(brain) 또는 1인 공간 퍼즐 경쟁(puzzle).

- **골든 템플릿(전략):** `nim-game` · `dots-and-boxes`
- **골든 템플릿(퍼즐):** `slide-puzzle` · `maze-run` · `hanoi`
- **구조:** 턴제 보드 상태 관리 또는 격자 퍼즐. 퍼즐은 "가장 먼저 완성" 경쟁이 흔함.
- **품질 필수:** 정답/해가 **유일**하도록 솔버 검증(마방진·미로 등). 라운드 점증 난이도.
- **인원:** 전략형은 `"2명"`, 퍼즐 경쟁형은 `"2-4명"`.

## 패턴 D — 협력 조합 / 전달 (coop)

객관적 데이터(숫자·자모·색·방향·시퀀스)를 **조합하거나 전달**. 주관적 "말 설명"·짝찾기·단순 교대 금지.

- **골든 템플릿:** `sum-relay` · `jamo-merge` · `memory-relay`
- **구조:** 두 존 상시 활성 + 오답 잠금/페널티로 "지금 내 차례인가"를 판단하게 만든다
  ("자기 차례만 버튼 활성화" 금지 — GAME_ANTIPATTERNS B-1).
- **인원:** 보통 `"2명"`(공동 목표형은 `"2-4명"`도 가능).

---

## game.json 필드 (메타데이터 단일 소스)

복사한 템플릿의 `game.json`을 새 게임에 맞게 채운다. 검증 필수 필드:

```json
{
  "name": "한글 이름",
  "description": "한 줄 설명",
  "icon": "🎲",                         // 이모지 1개
  "color": "#RRGGBB",                    // 헥스 6자리
  "grades": [1, 2, 3, 4, 5, 6],
  "playTime": "30초",
  "category": "speed|brain|math|knowledge|coop|puzzle",
  "players": "2-4명" | "2명"
}
```

`category`·`players`는 **game.json에만** 둔다. 런처(FALLBACK_GAMES)와 engine.js
(`_GAME_CATEGORY_MAP`)는 `npm run gen`이 자동 생성한다 — 직접 편집 금지.

## 등록 절차 (4단계)

```bash
# 1) games/<폴더>/ 4파일 작성 (game.json, index.html, style.css, game.js)
# 2) games/registry.json 배열에 "<폴더>" 추가
# 3) 파생 메타 자동 생성
npm run gen        # → index.html FALLBACK_GAMES + shared/engine.js _GAME_CATEGORY_MAP
# 4) 검증
node scripts/verify-game.js <폴더>   # 정적 21항목 전부 PASS
npm test                              # 메타 동기화 + 전 게임 정합성 (CI와 동일)
```

> 과거의 런처 수동 등록(`CATEGORY_MAP`·`GAME_ICONS`·`PLAYER_COUNTS`)은 폐지되었다.
> 지금은 **game.json 작성 → `npm run gen`** 한 번으로 끝난다.
