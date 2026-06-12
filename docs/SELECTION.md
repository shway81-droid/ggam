# 게임 선별 기록 (56 → 40)

원본 짬짬이 교실 56개 게임을 코드 분석(5개 그룹 병렬 분석)하여 메커니즘 중복 클러스터를 식별하고,
각 클러스터에서 더 재미있는(시각 피드백·교실 왁자지껄함·교육 가치 우위) 게임만 남김.

## 삭제된 16개와 사유

| 삭제 게임 | 중복 클러스터 | 남긴 대체 게임 | 사유 |
|---|---|---|---|
| synonym-quiz | 텍스트 4지선다 | opposite-word | 코드 99% 동일, 반대말이 저학년에 더 명확 |
| capital-quiz | 텍스트 4지선다 | flag-quiz | 같은 지리 주제, 국기 SVG가 시각적 압승 |
| unit-noun | 텍스트 4지선다 | animal-sort | 단위명사 개념이 어려움, 분류는 직관적 |
| more-or-less | 좌우 비교 | size-compare | 로직 100% 동일, 시각만 다름 |
| number-bond | 연산 빈칸 | quick-math | 같은 틀의 느린 변형 |
| coin-count | 합 계산 | dice-sum | dice-sum과 복붙 템플릿, 주사위가 더 시각적 |
| missing-piece | 시각 매칭 4지선다 | shadow-match | 동일 "대상→4선택" 반복 |
| mirror-match | 좌우 대칭 매칭 | fold-guess | 종이접기가 동적 생성 + 공간추론 상위호환 |
| shape-match | 같은 그림 찾기 | shadow-match | 그림자 추상화가 더 도전적·재밌음 |
| bomb-dodge | 움직이는 표적 탭 | balloon-pop, chase-tap | 파티클·피드백 열세 |
| arrow-tap | 자극→빠른 선택 | rps-react | 가위바위보가 웃음 + 논리 우위 |
| direction-relay | 순서 암기→말로 설명 | secret-code | 색 이름이 방향보다 명확, 25초 여유 |
| color-signal | 설명→9지선다 | word-chain | 끝말잇기가 한국 교실 친화 압승 |
| color-mix | 둘이 골라 조합 | sum-relay, jamo-merge | 색 혼합 규칙을 모르는 학생 많음 |
| arrow-rotate | 탭 회전 퍼즐 | pipe-connect | 단순 반복, 파이프가 시각·로직 상위호환 |
| one-stroke | 선 잇기 퍼즐 | dot-connect | 색 경로(Flow)가 시각·전략 우위 |

## 유지 40개 (카테고리 분포)

- speed (5): reaction-race, balloon-pop, rps-react, chase-tap, odd-color
- brain (8): color-touch, shadow-match, dots-and-boxes, memory-match, nim-game, odd-one-out, pattern-next, relation-match
- math (8): quick-math, size-compare, color-count, number-tap, clock-reading, math-sign, area-compare, dice-sum
- knowledge (8): ox-quiz, initial-quiz, flag-quiz, proverb-quiz, english-word, animal-sort, hangul-jamo, opposite-word
- coop (5): secret-code, sum-relay, jamo-merge, word-chain, memory-relay
- puzzle (6): slide-puzzle, maze-run, pipe-connect, dot-connect, fold-guess, hanoi

비고: english-word(유일한 영어 과목 게임), memory-match(검증된 고전)는
분석 에이전트가 삭제 후보로 올렸으나 콘텐츠 고유성을 이유로 유지.

## 신규 10개 추가 계획 (총 50)

카테고리 비율을 맞추기 위해: speed +2, brain +1, math +1, knowledge +1, coop +3, puzzle +2
→ 최종 분포: speed 7 / brain 9 / math 9 / knowledge 9 / coop 8 / puzzle 8 = 50

⚠️ 원본 사용자가 명시 삭제한 메커니즘 재추가 금지:
quick-sort, number-strike, assemble-shape, twin-find, find-pair-coop, whack-a-mole,
mirror-draw, rhythm-echo, turn-count, countdown-tap, flash-shape, clue-find, color-switch


## 🚫 사용자 삭제 (재추가 금지)

2026-06-11 사용자가 직접 삭제 지시 — 폴더명이든 다른 이름이든 같은 메커니즘 재추가 금지:
- balance-scale (저울 균형 — 양팔저울 무게 합 비교)
- secret-code (비밀 암호 — 색 순서 암기해 말로 전달)
- word-chain (끝말잇기 협동)
- lights-out (불 끄기 — 십자 토글 라이츠아웃)

→ 46개 시점 분포: speed 7 / brain 9 / math 8 / knowledge 9 / coop 6 / puzzle 7

## ✅ 사용자 요청 복원 (2026-06-12)

사용자가 원작(jjamjjami-gyosil)에서 14개 게임 재추가를 직접 지시 —
위 "삭제된 16개" 표의 분석 사유보다 사용자 결정이 우선:

- speed: arrow-tap(방향 화살표)
- brain: missing-piece(빠진 조각), mirror-match(거울 대칭)
- math: skip-count(뛰어 세기), more-or-less(많다 적다), number-bond(수 가르기), coin-count(동전 세기)
- knowledge: job-tool(직업과 도구), unit-noun(단위 세기), synonym-quiz(비슷한 말), capital-quiz(수도 맞히기)
- coop: direction-relay(방향 따라하기), color-mix(색 섞기)
- puzzle: arrow-rotate(화살표 돌리기)

skip-count·job-tool은 선별 당시 원작에 없던 신규 게임. 나머지 12개는 중복 클러스터
정리분의 복원. "🚫 재추가 금지" 목록(balance-scale·secret-code·word-chain·lights-out)
과는 겹치지 않음.

→ 현재 60개. 분포: speed 8 / brain 11 / math 12 / knowledge 13 / coop 8 / puzzle 8
