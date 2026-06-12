# 대규모 확장 기록: 60 → 105 (신규 45종, 2026-06-12)

사용자 지시: 45종 추가, 전 카테고리 고르게, 발상 전 `GAME_ANTIPATTERNS.md` 분석 필수.

## 안티패턴 준수 방법

- **금지 메커니즘 21종 교차 대조** — GAME_ANTIPATTERNS 0절 17종 + SELECTION.md 사용자 삭제 4종
  (저울 균형·비밀 암호·끝말잇기·불 끄기). 45종 전부 비충돌 확인 후 제작.
- **기존 60종과 메커니즘 비교** — 데이터 형식+인터랙션 기준으로 전부 신규
  (예: 낱말 찾기≠초성 퀴즈, 수직선≠수 비교, 컵 셔플≠기억 짝맞추기).
- **협력 9종**: 전부 객관 데이터(숫자·좌표·시각·글자·타이밍)의 조합/전달.
  주관적 말 설명·짝찾기·단순 교대 없음. "자기 차례만 활성화" 금지 준수
  (글자 릴레이는 두 존 상시 활성 + 오답 잠금으로 '내 차례 판단'이 재미 요소).
- **반응속도 9종**: 전부 판단 요소 내장(비교·홀짝·누적합·속성 조합·상태 추적·
  음 높낮이·개수 세기). 흔한 클론·자제력 타이밍·순간노출 기억 없음
  (점점 커져요는 계속 보이며 커지는 방식 — 순간노출 아님).
- **B절 품질 규칙**: 출제 유일성 검증 코드(요술 상자 규칙 전수 대조, 줄서기 순열
  대입, 10 만들기 단일 쌍 검사, 스도쿠·노노그램·마방진 솔버 유일해 검증),
  라운드 점증 난이도, 오답 페널티, 3인 3열 균등, 같은 의미 같은 색,
  보기 전부 한 화면(flex+clamp).
- **C절 디자인**: Level 3 Comic(크림 #FFF8E1·검정 3px 테두리·하드 그림자),
  다크 배경 없음, shared/style.css 무수정.

## 신규 45종 목록

| 카테고리 | 게임 (폴더) |
|---|---|
| ⚡ speed +9 → 17 | 오르락내리락(high-low), 특징 찾기(feature-hunt), 홀짝 판단(even-odd), 높은 음 찾기(pitch-compare), 소리 세기(beep-count), 점점 커져요(emoji-zoom), 모두 잡아라(tap-all), 청기백기(flag-updown), 달리는 덧셈(running-sum) |
| 🧠 brain +7 → 18 | 컵 셔플(cup-shuffle), 요술 상자(rule-find), 위에서 보면?(block-view), 섞인 글자(word-scramble), 톱니바퀴(gear-spin), 줄서기 추리(line-up), 숨은 도형 세기(hidden-shapes) |
| 📐 math +6 → 18 | 블록 세기(count-blocks), 가까운 수(closest-number), 분수 맞히기(fraction-match), 수직선(number-line), 10 만들기(make-ten), 백판 빈칸(hundred-chart) |
| 📚 knowledge +5 → 18 | 한 글자씩(word-reveal), 계절 찾기(season-match), 아기 동물(animal-baby), 분리수거(trash-sort), 표지판 읽기(sign-quiz) |
| 🤝 coop +9 → 17 | 이어 계산(chain-calc), 나눠 세기(split-count), 업다운(updown-number), 보물 좌표(coord-pass), 동시에 터치(sync-tap), 공평하게 나누기(fair-share), 글자 릴레이(word-relay), 함께 정렬(sort-together), 시계 맞추기(clock-pass) |
| 🧩 puzzle +9 → 17 | 차 빼기(car-escape), 강 건너기(river-cross), 펭귄 빙판길(ice-slide), 낱말 찾기(word-search), 그림 스도쿠(mini-sudoku), 개구리 자리 바꾸기(frog-swap), 숫자 색칠 로직(logic-grid), 마방진(magic-square), 자물쇠 풀기(code-break) |

최종 분포: ⚡17 🧠18 📐18 📚18 🤝17 🧩17 = **105**

2인 전용(PLAYER_COUNTS '2명'): chain-calc, split-count, updown-number, coord-pass,
sync-tap, fair-share, word-relay, clock-pass. (sort-together는 2~4인 공동 목표)

## 검증

- `verify-game.js` 105종 전수 20/20 통과 (기존 60종 회귀 포함)
- 런처 인라인 스크립트 `node --check`, registry/manifest/game.json 유효성
- 로컬 서버에서 신규 45종 페이지 + 런처 200 응답
- 캐시 버전 v8 (engine `?v=8`, SW CACHE_NAME)
