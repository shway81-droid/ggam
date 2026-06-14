/* games/ox-quiz/game.js */

'use strict';

// ── Constants ────────────────────────────────────────────────
const TOTAL_QUESTIONS  = 10;
const QUESTION_TIME    = 5;    // seconds per question
const RESULT_PAUSE_MS  = 1800; // pause before next question

// Player config
const PLAYER_CONFIG = [
  { label: 'P1', dot: '#0288D1', zoneBg: '#B3E5FC', cls: 'p1' },
  { label: 'P2', dot: '#E53935', zoneBg: '#FFCDD2', cls: 'p2' },
  { label: 'P3', dot: '#388E3C', zoneBg: '#C8E6C9', cls: 'p3' },
  { label: 'P4', dot: '#F57C00', zoneBg: '#FFE0B2', cls: 'p4' },
];

// ── 300 Questions ────────────────────────────────────────────
// Format: { q: "문장", a: true } or { q: "문장", a: false }
// Categories: 과학(60), 수학(40), 국어/한국어(40), 사회/역사(50), 상식(50), 자연/동물(30), 지리(30)

const ALL_QUESTIONS = [
  // ══════════════════════════════════════════════
  // 과학 (60문제)
  // ══════════════════════════════════════════════
  { q: "지구는 태양 주위를 돈다", a: true },
  { q: "태양은 지구 주위를 돈다", a: false },
  { q: "개구리는 양서류이다", a: true },
  { q: "개구리는 파충류이다", a: false },
  { q: "식물은 광합성을 통해 스스로 양분을 만든다", a: true },
  { q: "사람의 심장은 왼쪽 가슴에 있다", a: true },
  { q: "달은 스스로 빛을 낸다", a: false },
  { q: "지구에서 가장 가까운 별은 태양이다", a: true },
  { q: "소리는 진공 속에서도 전달된다", a: false },
  { q: "얼음이 녹으면 물이 된다", a: true },
  { q: "물은 100도씨에서 끓는다", a: true },
  { q: "물은 0도씨에서 언다", a: true },
  { q: "공기는 눈에 보이지 않는다", a: true },
  { q: "사람의 뼈는 206개이다", a: true },
  { q: "식물의 잎이 초록색인 것은 엽록소 때문이다", a: true },
  { q: "지구는 24시간마다 한 번씩 자전한다", a: true },
  { q: "지구가 태양을 한 바퀴 도는 데 365일이 걸린다", a: true },
  { q: "달은 지구를 약 한 달에 한 번 공전한다", a: true },
  { q: "번개는 빛보다 소리가 먼저 들린다", a: false },
  { q: "혈액 속 적혈구는 산소를 운반한다", a: true },
  { q: "사람의 혈액형은 A, B, AB, O형으로 나뉜다", a: true },
  { q: "눈(雪)은 물이 얼어서 만들어진다", a: false },
  { q: "무지개는 비 온 뒤 햇빛이 물방울을 통과할 때 생긴다", a: true },
  { q: "자석은 같은 극끼리 당긴다", a: false },
  { q: "자석의 N극과 S극은 서로 끌어당긴다", a: true },
  { q: "식물은 뿌리로 물을 흡수한다", a: true },
  { q: "곤충의 다리는 6개이다", a: true },
  { q: "거미는 곤충이다", a: false },
  { q: "지구 표면의 약 70%는 물로 덮여 있다", a: true },
  { q: "사람의 폐는 호흡을 담당한다", a: true },
  { q: "뇌는 몸의 신경을 조절한다", a: true },
  { q: "태양계에는 행성이 8개 있다", a: true },
  { q: "화성은 태양에서 가장 가까운 행성이다", a: false },
  { q: "수성은 태양에서 가장 가까운 행성이다", a: true },
  { q: "금성은 지구보다 태양에 멀다", a: false },
  { q: "달에는 대기가 없다", a: true },
  { q: "달은 지구의 조수에 영향을 주지 않는다", a: false },
  { q: "빛은 물보다 공기 중에서 더 빠르게 이동한다", a: true },
  { q: "지진은 사람이 만들어내는 현상이다", a: false },
  { q: "화산은 땅속의 마그마가 분출하는 현상이다", a: true },
  { q: "사람의 피부는 체온 조절에 도움이 되지 않는다", a: false },
  { q: "사람의 심장은 1분에 약 60~100번 박동한다", a: true },
  { q: "식물의 씨앗은 뿌리에서 만들어진다", a: false },
  { q: "꽃이 피지 않는 식물을 현화식물이라고 한다", a: false },
  { q: "산소가 없으면 불이 꺼진다", a: true },
  { q: "이산화탄소는 식물이 광합성할 때 필요하다", a: true },
  { q: "식물은 광합성 할 때 이산화탄소를 만들어낸다", a: false },
  { q: "전기는 구리선을 통해 잘 흐른다", a: true },
  { q: "나무는 전기가 잘 통한다", a: false },
  { q: "지구의 자전축은 기울어져 있다", a: true },
  { q: "사계절은 달이 지구를 돌기 때문에 생긴다", a: false },
  { q: "여름철에는 낮이 밤보다 길다", a: true },
  { q: "겨울철에는 낮이 밤보다 길다", a: false },
  { q: "물을 가열하면 수증기가 된다", a: true },
  { q: "구름은 기체 상태로만 이루어져 있다", a: false },
  { q: "비는 구름에서 내린다", a: true },
  { q: "돋보기로 햇빛을 모아도 열이 생기지 않는다", a: false },
  { q: "쇠는 물보다 무겁다", a: true },
  { q: "사람의 몸 중 가장 큰 기관은 심장이다", a: false },
  { q: "지렁이는 곤충이다", a: false },

  // ══════════════════════════════════════════════
  // 수학 (40문제)
  // ══════════════════════════════════════════════
  { q: "삼각형의 내각의 합은 180도이다", a: true },
  { q: "사각형의 내각의 합은 270도이다", a: false },
  { q: "원의 지름은 반지름의 3배이다", a: false },
  { q: "1km는 100m이다", a: false },
  { q: "1km는 1000m이다", a: true },
  { q: "1시간은 60분이다", a: true },
  { q: "1분은 100초이다", a: false },
  { q: "1분은 60초이다", a: true },
  { q: "2 × 3 = 6이다", a: true },
  { q: "3 × 4 = 11이다", a: false },
  { q: "짝수는 2로 나누어 떨어지는 수이다", a: true },
  { q: "홀수는 2로 나누어 떨어진다", a: false },
  { q: "0은 홀수이다", a: false },
  { q: "소수는 1과 자기 자신으로만 나누어지는 수이다", a: true },
  { q: "1은 소수이다", a: false },
  { q: "2는 짝수이다", a: true },
  { q: "정사각형의 네 변의 길이는 서로 다르다", a: false },
  { q: "직사각형의 네 각은 모두 직각이다", a: true },
  { q: "5 + 7 = 13이다", a: false },
  { q: "8 + 9 = 17이다", a: true },
  { q: "100보다 큰 수 중 가장 작은 정수는 101이다", a: true },
  { q: "분수 1/2은 1/3보다 작다", a: false },
  { q: "분수 1/4은 0.5보다 크다", a: false },
  { q: "10 ÷ 2 = 6이다", a: false },
  { q: "9 × 9 = 81이다", a: true },
  { q: "7 × 8 = 54이다", a: false },
  { q: "직각은 90도이다", a: true },
  { q: "세 직각을 합치면 360도이다", a: false },
  { q: "정삼각형의 세 각의 크기는 모두 60도이다", a: true },
  { q: "1L는 1000mL이다", a: true },
  { q: "1kg은 100g이다", a: false },
  { q: "1m는 10cm이다", a: false },
  { q: "1m는 100cm이다", a: true },
  { q: "50은 7의 배수이다", a: false },
  { q: "36은 6의 배수이다", a: true },
  { q: "음수와 양수를 더하면 항상 양수가 된다", a: false },
  { q: "0보다 작은 수를 음수라고 한다", a: true },
  { q: "원의 둘레는 반지름 × 원주율(π)이다", a: false },
  { q: "직각삼각형에는 반드시 90도 각이 있다", a: true },
  { q: "4의 약수는 1, 2, 4이다", a: true },

  // ══════════════════════════════════════════════
  // 국어/한국어 (40문제)
  // ══════════════════════════════════════════════
  { q: "'안녕하세요'는 작별 인사말이다", a: false },
  { q: "'되'와 '돼'는 항상 같은 곳에 쓸 수 있다", a: false },
  { q: "한글은 자음과 모음으로 이루어져 있다", a: true },
  { q: "한글 자음의 수는 20개이다", a: false },
  { q: "한글 모음의 수는 10개이다", a: true },
  { q: "'읽다'의 올바른 발음은 '익따'이다", a: true },
  { q: "'닭'의 올바른 발음은 '달'이다", a: false },
  { q: "'닭'의 올바른 발음은 '닥'이다", a: true },
  { q: "속담 '가는 말이 고와야 오는 말이 곱다'는 예의를 강조한다", a: true },
  { q: "속담 '빈 수레가 요란하다'는 내용이 없을수록 요란하다는 뜻이다", a: true },
  { q: "주어는 문장에서 서술어를 꾸며주는 말이다", a: false },
  { q: "서술어는 주어의 동작, 상태, 성질을 나타낸다", a: true },
  { q: "'사과가 맛있다'에서 '맛있다'는 주어이다", a: false },
  { q: "의성어는 소리를 흉내 낸 말이다", a: true },
  { q: "의태어는 소리를 흉내 낸 말이다", a: false },
  { q: "'예쁘다'는 동사이다", a: false },
  { q: "'달리다'는 동사이다", a: true },
  { q: "속담 '세 살 버릇 여든까지 간다'는 어릴 때 습관이 중요하다는 뜻이다", a: true },
  { q: "'맞히다'와 '맞추다'는 항상 같은 뜻이다", a: false },
  { q: "일기는 다른 사람의 생각과 느낌을 기록하는 글이다", a: false },
  { q: "동시는 소설의 한 종류이다", a: false },
  { q: "이야기의 구성은 발단, 전개, 절정, 결말로 이루어진다", a: true },
  { q: "'웃음'은 동사이다", a: false },
  { q: "받침 'ㄱ' 뒤에 'ㅇ'으로 시작하는 글자가 오면 연음이 된다", a: true },
  { q: "속담 '우물 안 개구리'는 견문이 좁은 사람을 뜻한다", a: true },
  { q: "'나는 밥을 먹었다'에서 '나는'이 목적어이다", a: false },
  { q: "문장 부호 중 마침표는 '.'이다", a: true },
  { q: "문장 부호 중 물음표는 '!'이다", a: false },
  { q: "독서는 어휘력 향상에 도움이 된다", a: true },
  { q: "'꽃이 핀다'에서 '꽃이'는 목적어이다", a: false },
  { q: "높임말에서 '드리다'는 '주다'의 높임 표현이다", a: true },
  { q: "'국어'와 '영어'는 같은 말이다", a: false },
  { q: "설명문은 자신의 주장을 내세우는 글이다", a: false },
  { q: "광고문은 주로 주관적인 입장에서 쓰인다", a: true },
  { q: "'하늘이 파랗다'는 완결된 문장이다", a: true },
  { q: "동화는 어른을 위한 이야기 문학이다", a: false },
  { q: "'이다'는 형용사이다", a: false },
  { q: "시에서 반복되는 말은 리듬감을 준다", a: true },
  { q: "일기에는 날짜를 쓰지 않아도 된다", a: false },
  { q: "편지에서 받는 사람의 이름은 보통 맨 처음에 쓴다", a: true },

  // ══════════════════════════════════════════════
  // 사회/역사 (50문제)
  // ══════════════════════════════════════════════
  { q: "한글을 만든 왕은 세종대왕이다", a: true },
  { q: "대한민국의 수도는 인천이다", a: false },
  { q: "대한민국의 수도는 부산이다", a: false },
  { q: "대한민국 국기는 태극기이다", a: true },
  { q: "대한민국의 국화는 진달래이다", a: false },
  { q: "이순신 장군은 병자호란 때 활약했다", a: false },
  { q: "조선을 세운 왕은 태조 이성계이다", a: true },
  { q: "고구려, 백제, 신라를 삼국시대라고 한다", a: true },
  { q: "백제가 삼국을 통일했다", a: false },
  { q: "고려를 세운 사람은 왕건이다", a: true },
  { q: "3·1 운동은 1945년에 일어났다", a: false },
  { q: "광복절은 매년 8월 15일이다", a: true },
  { q: "한국전쟁은 1950년에 시작되었다", a: true },
  { q: "대한민국은 민주주의 국가이다", a: true },
  { q: "대한민국 국회의원의 임기는 6년이다", a: false },
  { q: "대통령의 임기는 4년이다", a: false },
  { q: "세계에서 가장 인구가 많은 나라는 미국이다", a: false },
  { q: "미국의 수도는 뉴욕이다", a: false },
  { q: "미국의 수도는 워싱턴 D.C.이다", a: true },
  { q: "일본의 수도는 오사카이다", a: false },
  { q: "중국의 수도는 상하이이다", a: false },
  { q: "프랑스의 수도는 파리이다", a: true },
  { q: "영국의 수도는 맨체스터이다", a: false },
  { q: "국제연합(UN)은 세계 평화를 위한 국제기구이다", a: true },
  { q: "화폐는 물건을 교환하는 매개 수단이다", a: true },
  { q: "우리나라 화폐 단위는 달러이다", a: false },
  { q: "설날은 양력 1월 1일이다", a: false },
  { q: "추석은 음력 8월 15일이다", a: true },
  { q: "어린이날은 5월 5일이다", a: true },
  { q: "스승의 날은 6월 15일이다", a: false },
  { q: "세계 여러 나라는 모두 같은 언어를 사용한다", a: false },
  { q: "유엔(UN)의 본부는 미국 뉴욕에 있다", a: true },
  { q: "거북선은 이순신 장군이 만든 배이다", a: true },
  { q: "고인돌은 철기 시대의 무덤이다", a: false },
  { q: "조선시대에는 신분제도가 있었다", a: true },
  { q: "안중근 의사는 1919년 3·1운동을 이끌었다", a: false },
  { q: "추석은 우리나라 고유의 명절이다", a: true },
  { q: "독립문은 나라의 독립을 기념하여 세운 문이다", a: true },
  { q: "경복궁은 부산에 있는 조선시대 궁궐이다", a: false },
  { q: "신사임당은 조선시대의 여성 예술가이자 학자이다", a: true },
  { q: "우리나라는 사면이 모두 바다로 둘러싸인 섬나라이다", a: false },
  { q: "경주는 고려의 수도였다", a: false },
  { q: "한양은 조선의 수도였다", a: true },
  { q: "고려의 수도는 개성이었다", a: true },
  { q: "국민에게는 세금을 낼 의무가 있다", a: true },
  { q: "국민에게는 국방의 의무가 없다", a: false },
  { q: "직지심체요절은 세계에서 가장 오래된 금속활자 인쇄물이다", a: true },
  { q: "국회는 세금을 거두는 기관이다", a: false },
  { q: "법원은 법을 집행하는 기관이다", a: false },
  { q: "행정부의 수반은 대통령이다", a: true },

  // ══════════════════════════════════════════════
  // 상식 (50문제)
  // ══════════════════════════════════════════════
  { q: "올림픽은 2년마다 열린다", a: false },
  { q: "축구에서 한 팀의 선수는 11명이다", a: true },
  { q: "야구에서 타자가 4번 볼을 얻으면 1루로 나간다", a: true },
  { q: "농구 경기는 2쿼터로 이루어진다", a: false },
  { q: "마라톤의 거리는 약 100km이다", a: false },
  { q: "태권도는 우리나라 고유의 무술이다", a: true },
  { q: "피아노의 건반은 모두 흰 건반이다", a: false },
  { q: "음계에서 '도, 레, 미, 파, 솔, 라, 시'는 8개이다", a: false },
  { q: "영화는 라디오로만 즐길 수 있는 예술이다", a: false },
  { q: "우표는 편지를 보낼 때 붙이는 것이다", a: true },
  { q: "구급차는 아픈 사람을 병원에 데려다 준다", a: true },
  { q: "신호등의 빨간불은 출발을 의미한다", a: false },
  { q: "신호등에서 노란불은 주의하라는 신호이다", a: true },
  { q: "소방차는 불을 끄는 데 사용한다", a: true },
  { q: "경찰차는 범죄를 예방하고 단속하는 데 쓰인다", a: true },
  { q: "생일에 케이크를 먹는 것은 서양에서 유래한 풍습이다", a: true },
  { q: "김치는 주로 채소를 발효시켜 만든 음식이다", a: true },
  { q: "피자는 일본에서 유래한 음식이다", a: false },
  { q: "스파게티는 중국에서 유래한 음식이다", a: false },
  { q: "초밥(스시)은 중국의 전통 음식이다", a: false },
  { q: "컴퓨터 자판에서 알파벳은 25개이다", a: false },
  { q: "스마트폰으로 사진을 찍을 수 있다", a: true },
  { q: "전화기는 소리를 멀리 전달하는 도구이다", a: true },
  { q: "도서관에서는 책을 빌릴 수 없다", a: false },
  { q: "병원에서는 음식을 판다", a: false },
  { q: "제과점에서는 빵과 케이크를 판다", a: true },
  { q: "우체국에서는 편지를 보낼 수 있다", a: true },
  { q: "수영장에서는 육상 달리기 경기를 한다", a: false },
  { q: "박물관에서는 역사적 유물을 볼 수 있다", a: true },
  { q: "미술관에서는 예술 작품을 볼 수 있다", a: true },
  { q: "은행에서는 책을 빌릴 수 있다", a: false },
  { q: "마트에서는 생활용품과 식품을 살 수 있다", a: true },
  { q: "약국에서는 음식을 판다", a: false },
  { q: "1년은 12개월이다", a: true },
  { q: "1년은 13개월이다", a: false },
  { q: "2월은 항상 29일이다", a: false },
  { q: "크리스마스는 12월 24일이다", a: false },
  { q: "새해 첫날은 1월 1일이다", a: true },
  { q: "하루는 12시간이다", a: false },
  { q: "가야금은 우리나라 전통 악기이다", a: true },
  { q: "씨름은 외국에서 들어온 스포츠이다", a: false },
  { q: "한복은 우리나라의 전통 의상이다", a: true },
  { q: "온돌은 서양에서 들어온 난방 방식이다", a: false },
  { q: "제기차기는 우리나라 전통 놀이이다", a: true },
  { q: "축구공은 사각형이다", a: false },
  { q: "농구공은 사각형이다", a: false },
  { q: "수영의 영법 중 하나는 자유형이다", a: true },
  { q: "태권도는 올림픽 정식 종목이다", a: true },
  { q: "세계 보건 기구의 약자는 WTO이다", a: false },
  { q: "국제 올림픽 위원회의 약자는 IOC이다", a: true },

  // ══════════════════════════════════════════════
  // 자연/동물 (30문제)
  // ══════════════════════════════════════════════
  { q: "고래는 물속에 살지만 포유류이다", a: true },
  { q: "고래는 아가미로 숨을 쉰다", a: false },
  { q: "뱀에게는 다리가 4개 있다", a: false },
  { q: "뱀은 변온동물이다", a: true },
  { q: "박쥐는 곤충류이다", a: false },
  { q: "박쥐는 날개가 있는 포유류이다", a: true },
  { q: "펭귄은 날 수 없는 새이다", a: true },
  { q: "타조는 세계에서 가장 빠른 새이다", a: false },
  { q: "독수리는 육식성 맹금류이다", a: true },
  { q: "개는 잡식동물이다", a: true },
  { q: "소는 육식동물이다", a: false },
  { q: "사자는 초식동물이다", a: false },
  { q: "토끼는 육식동물이다", a: false },
  { q: "곰은 겨울잠을 자는 동물이다", a: true },
  { q: "연어는 알을 낳기 위해 강으로 거슬러 올라간다", a: true },
  { q: "개미는 홀로 생활하는 동물이다", a: false },
  { q: "꿀벌은 꿀을 만든다", a: true },
  { q: "나비의 변태 과정에서 번데기는 애벌레 다음 단계이다", a: true },
  { q: "매미는 겨울에 가장 많이 운다", a: false },
  { q: "카멜레온은 색을 바꿀 수 없다", a: false },
  { q: "달팽이는 껍데기 없이 산다", a: false },
  { q: "오징어는 다리가 10개이다", a: true },
  { q: "상어는 포유류이다", a: false },
  { q: "돌고래는 어류이다", a: false },
  { q: "돌고래는 폐로 숨을 쉰다", a: true },
  { q: "기린은 목이 가장 긴 동물이다", a: true },
  { q: "코끼리는 세계에서 가장 큰 바다 동물이다", a: false },
  { q: "치타는 세계에서 가장 빠른 육상 동물이다", a: true },
  { q: "거북이는 포유류이다", a: false },
  { q: "악어는 파충류이다", a: true },

  // ══════════════════════════════════════════════
  // 지리 (30문제)
  // ══════════════════════════════════════════════
  { q: "울릉도는 대한민국에서 가장 큰 섬이다", a: false },
  { q: "한강은 서울을 가로지르는 강이다", a: true },
  { q: "낙동강은 서울을 가로지르는 강이다", a: false },
  { q: "백두산은 한반도에서 가장 높은 산이다", a: true },
  { q: "한라산은 경기도에 있다", a: false },
  { q: "설악산은 강원도에 있다", a: true },
  { q: "세계에서 가장 큰 대륙은 유럽이다", a: false },
  { q: "세계에서 가장 큰 나라(면적)는 캐나다이다", a: false },
  { q: "아마존 강은 아프리카에 있다", a: false },
  { q: "나일 강은 아시아에 있다", a: false },
  { q: "히말라야 산맥은 유럽에 있다", a: false },
  { q: "에베레스트 산은 세계에서 가장 높은 산이다", a: true },
  { q: "사하라 사막은 아시아에 있다", a: false },
  { q: "태평양은 세계에서 가장 큰 바다이다", a: true },
  { q: "인도양은 유럽과 아메리카 사이에 있다", a: false },
  { q: "북극에는 육지가 있다", a: false },
  { q: "남극은 거대한 대륙이다", a: true },
  { q: "우리나라의 동쪽에는 서해가 있다", a: false },
  { q: "우리나라의 서쪽에는 황해(서해)가 있다", a: true },
  { q: "우리나라의 북쪽에는 남해가 있다", a: false },
  { q: "독도는 일본의 영토이다", a: false },
  { q: "울릉도는 경상북도에 속한다", a: true },
  { q: "부산은 우리나라 최남단의 도시이다", a: false },
  { q: "부산은 항구 도시이다", a: true },
  { q: "인천 국제공항은 영종도에 있다", a: true },
  { q: "강원도는 바다가 없는 내륙 지역이다", a: false },
  { q: "호남 지방은 쌀이 많이 생산된다", a: true },
  { q: "낙동강은 경상도를 흐르는 강이다", a: true },
  { q: "충청도는 우리나라 남부 지역에 있다", a: false },
  { q: "판문점은 남북 군사분계선 근처에 있다", a: true },
];

// ── Sound Manager ────────────────────────────────────────────
const sound = createSoundManager();

// ── State ────────────────────────────────────────────────────
let playerCount      = 2;
let questionIdx      = 0;
let scores           = [];
let questionLog      = [];      // { q, correctAnswer, winnerIdx (-1=timeout), dqPlayers[] }
let currentQ         = null;    // { q, a }
let dqSet            = new Set();
let phase            = 'idle';  // 'idle' | 'active' | 'done'
let timerHandle      = null;
let nextHandle       = null;
let timeRemaining    = QUESTION_TIME;
let gameQuestions    = [];      // 10 randomly selected questions

// ── DOM refs ─────────────────────────────────────────────────
const introScreen     = document.getElementById('introScreen');
const countdownScreen = document.getElementById('countdownScreen');
const countdownNumber = document.getElementById('countdownNumber');
const gameScreen     = document.getElementById('gameScreen');
const resultScreen   = document.getElementById('resultScreen');

const backBtn        = document.getElementById('backBtn');
const playBtn        = document.getElementById('playBtn');
const closeBtn       = document.getElementById('closeBtn');
const retryBtn       = document.getElementById('retryBtn');
const homeBtn        = document.getElementById('homeBtn');

const zonesWrap      = document.getElementById('zonesWrap');
const questionCounter = document.getElementById('questionCounter');
const problemTimer   = document.getElementById('problemTimer');
const problemText    = document.getElementById('problemText');
const problemStatus  = document.getElementById('problemStatus');
const scoreBar       = document.getElementById('scoreBar');

const soundToggleIntro = document.getElementById('soundToggleIntro');

const resultTitle    = document.getElementById('resultTitle');
const resultWinner   = document.getElementById('resultWinner');
const resultTableHead = document.getElementById('resultTableHead');
const resultTableBody = document.getElementById('resultTableBody');
const totalRow       = document.getElementById('totalRow');

// ── Helpers ──────────────────────────────────────────────────
function showScreen(s) {
  [introScreen, countdownScreen, gameScreen, resultScreen].forEach(x => x.classList.remove('active'));
  s.classList.add('active');
}

var countdownInterval = null;
function startPreGameCountdown(onDone) {
  showScreen(countdownScreen);
  var count = 3;
  countdownNumber.textContent = count;
  countdownInterval = setInterval(function() {
    count--;
    if (count <= 0) {
      clearInterval(countdownInterval);
      countdownInterval = null;
      onDone();
    } else {
      countdownNumber.textContent = count;
      countdownNumber.style.animation = 'none';
      countdownNumber.offsetHeight;
      countdownNumber.style.animation = '';
    }
  }, 1000);
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function clearTimers() {
  if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
  if (timerHandle) { clearInterval(timerHandle); timerHandle = null; }
  if (nextHandle)  { clearTimeout(nextHandle);   nextHandle  = null; }
}

function updateSoundBtn(btn) {
  btn.textContent = sound.isMuted() ? '🔇' : '🔊';
}

// ── Player count selection ───────────────────────────────────
document.querySelectorAll('.player-btn').forEach(btn => {
  onTap(btn, () => {
    document.querySelectorAll('.player-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    playerCount = parseInt(btn.dataset.count, 10);
  });
});

// ── Sound toggle ─────────────────────────────────────────────
onTap(soundToggleIntro, () => {
  sound.toggleMute();
  updateSoundBtn(soundToggleIntro);
});
updateSoundBtn(soundToggleIntro);

// ── Navigation ───────────────────────────────────────────────
onTap(backBtn,  () => goHome());
onTap(closeBtn, () => { clearTimers(); goHome(); });
onTap(homeBtn,  () => goHome());
onTap(retryBtn, () => startPreGameCountdown(() => startGame()));
onTap(playBtn,  () => startPreGameCountdown(() => startGame()));

// ── Build zone grid ──────────────────────────────────────────
function buildZones() {
  zonesWrap.innerHTML = '';
  zonesWrap.className = `zones-wrap p${playerCount}`;

  for (let i = 0; i < playerCount; i++) {
    const cfg  = PLAYER_CONFIG[i];
    const zone = document.createElement('div');
    zone.className = `zone ${cfg.cls}`;
    zone.dataset.player = i;

    // Header
    const header = document.createElement('div');
    header.className = 'zone-header';
    header.innerHTML = `
      <span class="zone-label">${cfg.label}</span>
      <span class="zone-score-chip" id="score-chip-${i}">0점</span>
    `;

    // OX button grid
    const grid = document.createElement('div');
    grid.className = 'ox-grid';

    // O button
    const oBtn = document.createElement('button');
    oBtn.className = 'ox-btn o-btn';
    oBtn.dataset.player = i;
    oBtn.dataset.answer = 'true';
    oBtn.setAttribute('aria-label', `P${i+1} O 버튼`);
    oBtn.textContent = 'O';
    onTap(oBtn, () => handleAnswerTap(i, true, oBtn));
    grid.appendChild(oBtn);

    // X button
    const xBtn = document.createElement('button');
    xBtn.className = 'ox-btn x-btn';
    xBtn.dataset.player = i;
    xBtn.dataset.answer = 'false';
    xBtn.setAttribute('aria-label', `P${i+1} X 버튼`);
    xBtn.textContent = 'X';
    onTap(xBtn, () => handleAnswerTap(i, false, xBtn));
    grid.appendChild(xBtn);

    zone.appendChild(header);
    zone.appendChild(grid);
    zonesWrap.appendChild(zone);
  }
}

function getZone(idx) {
  return zonesWrap.querySelector(`.zone[data-player="${idx}"]`);
}

function getOXBtns(playerIdx) {
  return zonesWrap.querySelectorAll(`.ox-btn[data-player="${playerIdx}"]`);
}

function updateScoreChip(playerIdx) {
  const chip = document.getElementById(`score-chip-${playerIdx}`);
  if (chip) chip.textContent = `${scores[playerIdx]}점`;
}

// ── Score bar ────────────────────────────────────────────────
function buildScoreBar() {
  scoreBar.innerHTML = '';
  for (let i = 0; i < playerCount; i++) {
    const cfg  = PLAYER_CONFIG[i];
    const chip = document.createElement('div');
    chip.className = 'score-chip';
    chip.innerHTML = `
      <span class="score-chip-dot" style="background:${cfg.dot}"></span>
      <span>${cfg.label}</span>
      <span class="score-chip-val" id="bar-score-${i}">0</span>
    `;
    scoreBar.appendChild(chip);
  }
}

function updateBarScore(playerIdx) {
  const el = document.getElementById(`bar-score-${playerIdx}`);
  if (el) el.textContent = scores[playerIdx];
}

// ── Ripple effect ────────────────────────────────────────────
function spawnRipple(zone, e) {
  const rect  = zone.getBoundingClientRect();
  const touch = e && e.touches ? e.touches[0] : (e || null);
  const x     = touch ? touch.clientX - rect.left : rect.width  / 2;
  const y     = touch ? touch.clientY - rect.top  : rect.height / 2;
  const size  = Math.max(rect.width, rect.height);
  const r     = document.createElement('span');
  r.className = 'zone-ripple';
  r.style.left   = x + 'px';
  r.style.top    = y + 'px';
  r.style.width  = r.style.height = size + 'px';
  r.style.marginLeft = r.style.marginTop = `-${size / 2}px`;
  zone.appendChild(r);
  r.addEventListener('animationend', () => r.remove());
}

// ── Timer logic ──────────────────────────────────────────────
function startCountdown() {
  timeRemaining = QUESTION_TIME;
  problemTimer.textContent = timeRemaining;
  problemTimer.classList.remove('urgent');

  timerHandle = setInterval(() => {
    timeRemaining--;
    problemTimer.textContent = timeRemaining;

    if (timeRemaining <= 2) {
      problemTimer.classList.add('urgent');
      sound.play('tick');
    }

    if (timeRemaining <= 0) {
      clearTimers();
      handleTimeout();
    }
  }, 1000);
}

// ── Disable / enable all OX buttons ─────────────────────────
function setAllBtnsDisabled(disabled) {
  zonesWrap.querySelectorAll('.ox-btn').forEach(btn => {
    btn.disabled = disabled;
    if (disabled) btn.classList.add('state-disabled');
    else btn.classList.remove('state-disabled');
  });
}

function resetBtnsForRound() {
  for (let i = 0; i < playerCount; i++) {
    const btns = getOXBtns(i);
    btns.forEach(btn => {
      btn.className = btn.classList.contains('o-btn') ? 'ox-btn o-btn' : 'ox-btn x-btn';
      btn.disabled = false;
      if (dqSet.has(i)) {
        btn.classList.add('state-disabled');
        btn.disabled = true;
      }
    });
    const zone = getZone(i);
    if (zone) {
      if (dqSet.has(i)) zone.classList.add('dq-zone');
      else zone.classList.remove('dq-zone');
    }
  }
}

// ── Answer tap handler ───────────────────────────────────────
function handleAnswerTap(playerIdx, chosenAnswer, btn) {
  if (phase !== 'active') return;
  if (dqSet.has(playerIdx)) return;

  const zone = getZone(playerIdx);
  spawnRipple(zone, window.event || null);

  const correct = (chosenAnswer === currentQ.a);

  if (correct) {
    resolveQuestion(playerIdx, chosenAnswer);
  } else {
    // Wrong — disqualify this player for this round
    sound.play('buzz');
    btn.classList.add('state-wrong');
    setTimeout(() => {
      btn.classList.remove('state-wrong');
    }, 400);

    dqSet.add(playerIdx);

    // Deduct 1 point (floor at 0)
    scores[playerIdx] = Math.max(0, scores[playerIdx] - 1);
    updateScoreChip(playerIdx);
    updateBarScore(playerIdx);

    // Show "-1" flash
    const penalty = document.createElement('div');
    penalty.className = 'penalty-flash';
    penalty.textContent = '-1';
    zone.style.position = 'relative';
    zone.appendChild(penalty);
    penalty.addEventListener('animationend', () => penalty.remove());

    // Disable this player's buttons
    getOXBtns(playerIdx).forEach(b => {
      b.classList.add('state-disabled');
      b.disabled = true;
    });
    zone.classList.add('dq-zone');

    // Check if all players are DQ'd — timeout if so
    const activePlayers = [];
    for (let i = 0; i < playerCount; i++) {
      if (!dqSet.has(i)) activePlayers.push(i);
    }
    if (activePlayers.length === 0) {
      clearTimers();
      setTimeout(() => handleTimeout(), 300);
    }
  }
}

// ── Correct answer ───────────────────────────────────────────
function resolveQuestion(winnerIdx, chosenAnswer) {
  phase = 'done';
  clearTimers();

  sound.play('ding');

  // Score
  scores[winnerIdx]++;
  updateScoreChip(winnerIdx);
  updateBarScore(winnerIdx);

  // Highlight winner's correct btn
  const btns = getOXBtns(winnerIdx);
  btns.forEach(btn => {
    const isCorrectBtn = (btn.dataset.answer === String(currentQ.a));
    if (isCorrectBtn) btn.classList.add('state-correct');
    else              btn.classList.add('state-disabled');
  });

  // Dim all other zones
  for (let i = 0; i < playerCount; i++) {
    if (i !== winnerIdx) {
      getOXBtns(i).forEach(b => { b.classList.add('state-disabled'); b.disabled = true; });
    }
  }

  const winnerLabel = PLAYER_CONFIG[winnerIdx].label;
  problemStatus.textContent = `✅ ${winnerLabel} 정답!`;

  questionLog.push({
    q: currentQ.q,
    correctAnswer: currentQ.a,
    winnerIdx,
    dqPlayers: [...dqSet],
    timedOut: false,
  });

  nextHandle = setTimeout(() => nextQuestion(), RESULT_PAUSE_MS);
}

// ── Timeout ──────────────────────────────────────────────────
function handleTimeout() {
  phase = 'done';
  clearTimers();

  sound.play('timeout');

  // Reveal correct answer on all zones
  for (let i = 0; i < playerCount; i++) {
    const btns = getOXBtns(i);
    btns.forEach(btn => {
      const isCorrectBtn = (btn.dataset.answer === String(currentQ.a));
      if (isCorrectBtn) btn.classList.add('state-reveal');
      else              btn.classList.add('state-disabled');
      btn.disabled = true;
    });
    getZone(i).classList.remove('dq-zone');
  }

  const label = currentQ.a ? 'O' : 'X';
  problemStatus.textContent = `⏰ 시간 초과! 정답: ${label}`;

  questionLog.push({
    q: currentQ.q,
    correctAnswer: currentQ.a,
    winnerIdx: -1,
    dqPlayers: [...dqSet],
    timedOut: true,
  });

  nextHandle = setTimeout(() => nextQuestion(), RESULT_PAUSE_MS);
}

// ── Load question ────────────────────────────────────────────
function loadQuestion() {
  phase         = 'active';
  currentQ      = gameQuestions[questionIdx];
  dqSet         = new Set();

  questionCounter.textContent = `${questionIdx + 1} / ${TOTAL_QUESTIONS}`;
  problemText.textContent     = currentQ.q;
  problemStatus.textContent   = '';
  problemTimer.classList.remove('urgent');

  resetBtnsForRound();

  // Remove leftover banners
  gameScreen.querySelectorAll('.answer-banner').forEach(b => b.remove());

  startCountdown();
}

// ── Next question ────────────────────────────────────────────
function nextQuestion() {
  questionIdx++;
  if (questionIdx >= TOTAL_QUESTIONS) {
    showResult();
  } else {
    loadQuestion();
  }
}

// ── Start game ───────────────────────────────────────────────
function startGame() {
  // Pick 10 random questions
  gameQuestions = shuffle(ALL_QUESTIONS).slice(0, TOTAL_QUESTIONS);
  questionIdx   = 0;
  scores        = new Array(playerCount).fill(0);
  questionLog   = [];
  dqSet         = new Set();
  phase         = 'idle';

  clearTimers();

  buildZones();
  buildScoreBar();

  showScreen(gameScreen);
  loadQuestion();
}

// ── Show result ──────────────────────────────────────────────
function showResult() {
  clearTimers();
  phase = 'idle';

  sound.play('fanfare');

  // Determine winner(s)
  const maxScore = Math.max(...scores);
  const winners  = scores
    .map((s, i) => ({ s, i }))
    .filter(x => x.s === maxScore)
    .map(x => x.i);

  if (maxScore === 0) {
    resultTitle.textContent  = '😅 무승부!';
    resultWinner.textContent = '아무도 점수를 얻지 못했어요.';
  } else if (winners.length === 1) {
    const w = winners[0];
    resultTitle.textContent  = '🏆 게임 종료!';
    resultWinner.textContent = `${PLAYER_CONFIG[w].label} 승리! (${maxScore}점)`;
  } else {
    const labels = winners.map(w => PLAYER_CONFIG[w].label).join(', ');
    resultTitle.textContent  = '🤝 동점!';
    resultWinner.textContent = `${labels} 공동 1위! (${maxScore}점)`;
  }

  // Build table header
  const headRow = document.createElement('tr');
  headRow.innerHTML = '<th>문제</th>' +
    Array.from({ length: playerCount }, (_, i) =>
      `<th><span class="player-dot" style="background:${PLAYER_CONFIG[i].dot}"></span>${PLAYER_CONFIG[i].label}</th>`
    ).join('');
  resultTableHead.innerHTML = '';
  resultTableHead.appendChild(headRow);

  // Build table body
  resultTableBody.innerHTML = '';
  questionLog.forEach((log, idx) => {
    const tr = document.createElement('tr');
    const label = log.correctAnswer ? 'O' : 'X';
    let qDisplay = log.q.length > 20 ? log.q.slice(0, 18) + '…' : log.q;
    let cells = `<td style="text-align:left;font-size:0.78rem;max-width:120px;">${idx + 1}. ${qDisplay}<br><span style="font-size:0.7rem;color:#888;">정답: ${label}</span></td>`;

    for (let i = 0; i < playerCount; i++) {
      if (log.timedOut) {
        cells += `<td class="cell-timeout">⏰</td>`;
      } else if (log.winnerIdx === i) {
        cells += `<td class="cell-win">✅ +1</td>`;
      } else if (log.dqPlayers.includes(i)) {
        cells += `<td class="cell-wrong">❌</td>`;
      } else {
        cells += `<td class="cell-none">—</td>`;
      }
    }
    tr.innerHTML = cells;
    resultTableBody.appendChild(tr);
  });

  // Total chips
  totalRow.innerHTML = '';
  for (let i = 0; i < playerCount; i++) {
    const cfg   = PLAYER_CONFIG[i];
    const isWin = winners.includes(i);
    const chip  = document.createElement('div');
    chip.className = 'total-chip';
    chip.innerHTML = `
      <span class="chip-dot" style="background:${cfg.dot}"></span>
      <span>${cfg.label}</span>
      <span class="chip-score" style="color:${isWin ? '#2E7D32' : '#555'}">${scores[i]}점</span>
      ${isWin ? '<span>🏆</span>' : ''}
    `;
    totalRow.appendChild(chip);
  }

  showScreen(resultScreen);
}

// ── Verify question count (dev sanity check) ─────────────────
if (ALL_QUESTIONS.length !== 300) {
}
