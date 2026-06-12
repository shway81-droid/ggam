# 🎮 짬짬이 교실

**전자칠판으로 즐기는 자투리 시간 초등 미니게임 60개.**
설치·로그인 없이 브라우저에서 바로 시작하고, 오프라인에서도 동작합니다.

▶️ **바로 하기: https://shway81-droid.github.io/ggam/**

[짬짬이 교실](https://shway81-droid.github.io/jjamjjami-gyosil/)을 기반으로 5가지를 개선한 후속 프로젝트입니다.

## 개선점

1. **게임 룰렛** — "🎲 룰렛으로 게임 고르기!" 버튼 하나면 룰렛이 게임을 골라줍니다. 카테고리 필터를 선택한 상태면 그 카테고리 안에서만 뽑습니다.
2. **전자칠판 레이아웃 + 보드게임 디자인** — 인기 보드게임 앱(Ludo King/Monopoly Go) 스타일의 펠트 그린 테이블 + 우드 프레임 + 골드 청키 버튼. 1280px/1920px 대화면에서 글씨·버튼이 자동 확대되고, 조작 요소는 학생 손이 닿는 화면 하단에 배치됩니다. 교실 스피커 전제로 **사운드 기본 ON**.
3. **게임 선별 56 → 40** — 메커니즘 중복 클러스터를 코드 분석으로 식별하고 각 클러스터에서 더 재미있는 게임만 유지 ([docs/SELECTION.md](docs/SELECTION.md)).
4. **신규 게임 추가** — 카테고리 비율에 맞춰 가라사대·타이밍 스톱·다른 곳 찾기·맞춤법 퀴즈·반쪽 맞추기·텔레파시·이모지 힌트·상자 밀기.
5. **전수 검증** — 전 게임 정적 검증(verify-game.js 20항목) + 브라우저 자동 플레이 테스트 통과.

## 구조

```
index.html          # 런처 (퀵스타트 룰렛 + 게임 그리드)
shared/style.css    # 공통 스타일 + 보드게임 테마 레이어
shared/engine.js    # 타이머·점수판·Web Audio 효과음·onTap
games/<폴더>/        # 게임별 game.json + index.html + style.css + game.js
games/registry.json # 게임 목록
sw.js               # 오프라인 서비스 워커
scripts/verify-game.js  # 정적 검증 (node scripts/verify-game.js <폴더>)
```

## 카테고리 분포 (60)

⚡반응속도 8 · 🧠두뇌 11 · 📐수학 12 · 📚지식 13 · 🤝협력 8 · 🧩퍼즐 8

## 로컬 실행

```
python -m http.server 8000
# http://localhost:8000
```
