# API 크롤링 인수인계 메모 (2026-04-27)

## 1) 지금까지 파악한 핵심

- 목표: 브라우저 자동화(노가다) 대신 API 직접 호출 방식으로 전체 데이터 수집.
- 확인된 상세 API(단건):
  - `https://api.jshj.net/api/brands/BRD_20161241`
  - 이건 브랜드 1개 상세 조회용으로 판단.
- 잘못 잡은 요청:
  - `https://jshj.net/franchise/chicken?_rsc=...`
  - `Content-Type: text/x-component`, `rsc`, `next-router-*` 헤더 포함.
  - 결론: Next.js 화면 조립용(RSC) 요청이라 크롤링 메인 타겟으로 부적합.
- `collect...`, `brand_events` 류 요청은 대체로 분석/로그 이벤트일 가능성이 높음.

## 2) 현재 상태 (2026-04-28 업데이트)

- 상세 API 방식으로 전체 수집 성공.
- `urls.txt`에 들어있는 브랜드 상세 URL 목록을 읽어서 각 URL의 `BRD_숫자` 값을 추출함.
- 추출한 브랜드 ID로 아래 API를 호출함:
  - `https://api.jshj.net/api/brands/{BRD_ID}`
  - 예: `https://api.jshj.net/api/brands/BRD_20161241`
- `urls.txt`에는 URL 줄이 419개였지만, 중복 URL 3개가 있어 고유 URL은 416개.
- 최종 수집 결과:
  - 성공: 416개
  - 실패: 0개

## 3) 목록 API 판별 기준 (실전)

아래 3개를 만족하면 거의 정답:

1. 응답이 JSON 구조 (`[]`, `{}`, `items`, `data` 등)
2. 반복 레코드(브랜드 여러 건)가 있음
3. 페이지/필터를 바꾸면 응답 내용도 바뀜

참고:
- URL에 `api` 문자열이 없을 수도 있음 (필수 아님)
- 파일 크기는 힌트일 뿐, 최종 판단 기준은 `Response` 구조

## 4) 생성된 파일

- `urls.txt`
  - 브랜드 상세 URL 목록.
  - 한 줄에 하나씩 URL이 있고, 현재는 따옴표/콤마가 포함된 목록 형태.
  - 스크립트에서 자동으로 따옴표/콤마를 정리함.
- `scripts/scrape-bbq.js`
  - BBQ 1개만 테스트하는 최소 스크립트.
  - 결과: `output/bbq.csv`
- `scripts/scrape-all.js`
  - `urls.txt` 전체 URL을 순회해서 전체 브랜드 데이터를 수집하는 메인 스크립트.
  - 요청 간격: 600ms
  - 재시도: 최대 2회
  - 결과: `output/brands.csv`
  - 실패 목록: `output/failed.csv`
- `scripts/make-simple-csv.js`
  - `output/brands.csv`에서 핵심 컬럼만 뽑아 보기 쉬운 CSV 생성.
  - 결과: `output/brands_simple.csv`
  - 엑셀 한글 깨짐 방지를 위해 UTF-8 BOM 포함.

## 5) 실행 명령

```bash
# BBQ 1개 테스트
node scripts/scrape-bbq.js

# 전체 URL 수집
node scripts/scrape-all.js

# 핵심 컬럼 CSV 다시 만들기
node scripts/make-simple-csv.js
```

## 6) 산출물

- `output/bbq.csv`
  - BBQ 단일 테스트 결과.
- `output/brands.csv`
  - 전체 상세 컬럼 CSV.
  - 현재 데이터 행 수: 416개.
- `output/brands_simple.csv`
  - 핵심 컬럼만 정리한 CSV.
  - 엑셀에서 열기 쉬운 최종 추천 파일.
- `output/failed.csv`
  - 실패 URL 목록.
  - 현재 실패 0개.

## 7) 주요 추출 컬럼

`output/brands_simple.csv` 기준:

- `brand_name`: 브랜드명
- `corp_name`: 회사명
- `year`: 기준 연도
- `startup_cost_만원`: 총 창업비용
- `avg_sales_만원`: 평균매출
- `store_count`: 가맹점 수
- `closure_rate_percent`: 폐점률
- `new_store_count`: 신규 가맹점 수
- `contract_end_count`: 계약 종료 수
- `contract_cancel_count`: 계약 해지 수
- `business_years`: 업력
- `page_url`: 원본 상세 페이지 URL

## 8) 중복 URL

`urls.txt`에는 419줄이지만 아래 3개 URL이 각각 2번씩 들어있어서 고유 브랜드는 416개.

- `진미대왕통닭-BRD_20180608`
- `오부장치킨-BRD_20150724`
- `찌웅이네숯불두마리치킨-BRD_20212147`

## 9) 한글 깨짐 참고

- CSV 자체는 UTF-8로 정상 저장됨.
- 엑셀이 CSV를 한국 기본 인코딩(CP949/EUC-KR)처럼 열면 한글이 깨져 보일 수 있음.
- `output/brands_simple.csv`는 엑셀이 UTF-8로 인식하기 쉽게 BOM을 붙여 저장했음.
- 그래도 깨지면 엑셀에서 `데이터 가져오기 -> 텍스트/CSV -> 파일 원본 UTF-8`로 열기.

## 10) 보안 주의 (매우 중요)

- 이전 대화에서 긴 쿠키/토큰이 채팅에 노출됨.
- 권장 조치:
  - 서비스 로그아웃(세션 종료)
  - 필요 시 비밀번호 변경
  - 재로그인 후 새 세션 사용
- 앞으로 cURL 공유 시 `cookie`/`authorization` 값은 `***`로 마스킹해서 전달.

