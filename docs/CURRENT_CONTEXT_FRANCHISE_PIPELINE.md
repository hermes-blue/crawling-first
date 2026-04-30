# Franchise DB Pipeline Current Context

작성일: 2026-04-30

## 1. 현재 결론

이 프로젝트의 목표는 공정위 가맹사업정보제공시스템에서 치킨 프랜차이즈 정보공개서 PDF를 수집하고, PDF 내용을 텍스트로 추출한 뒤, LLM으로 구조화해서 Supabase DB와 MVP 서비스에 연결하는 것이다.

중요한 방향은 `트랙 B`, 즉 원본 PDF 기반 파이프라인이다.

이미 정리된 외부 JSON 데이터를 단순히 DB에 넣는 방식은 공부 목적에 맞지 않으므로 우선순위가 아니다.

## 2. 사실관계 정리

현재 `crawling-first` 폴더에는 크롤링 실험 자료가 섞여 있다. 이 폴더는 앞으로도 크롤링 실험 전용으로 두고, DB 파이프라인은 새 폴더에서 진행한다.

새 작업 폴더:

```text
C:\Users\keato\coding\franchise-db-pipeline
```

이 폴더는 실제 DB 파이프라인 프로젝트로 사용한다.

## 3. 기존 파일에서 확인한 내용

### 공정위 PDF 다운로드 문서

원본 파일:

```text
codex_handoff_franchise_pdf_downloader.md
```

새 폴더 복사 위치:

```text
docs/codex_handoff_franchise_pdf_downloader.md
```

핵심 내용:

```text
1. list.do에서 치킨 업종 목록 수집
   selUpjong=21
   selIndus=H1

2. 목록 HTML에서 encFirMstSn 토큰 추출

3. 같은 requests.Session 안에서 view.do 접근

4. view.do HTML에서 firMstSn hidden input 추출

5. /cmm/fms/firOpenPdfView.do 로 POST

6. 응답 앞 4바이트가 %PDF면 PDF 저장
```

문서상 상태:

```text
교촌치킨 단일 PDF 다운로드 실측 성공
치킨 업종 583개 PDF 일괄 다운로드 목표
```

주의:

현재 `crawling-first` 폴더 안에는 문서에서 언급된 `download_kyochon_v4.py` 파일이 보이지 않는다. 따라서 실제 583개 PDF 전체 다운로드 결과는 아직 확보된 상태가 아니다.

### jshj API 크롤링 문서

원본 파일:

```text
docs/HANDOFF_API_CRAWLING.md
```

새 폴더 복사 위치:

```text
docs/HANDOFF_API_CRAWLING.md
```

핵심 내용:

```text
https://api.jshj.net/api/brands/{BRD_ID}
```

이 API는 PDF 다운로드가 아니라 이미 구조화된 JSON 데이터를 반환한다.

확인된 산출물:

```text
output/brand-details/brands_simple.csv
416개
실패 0개
```

하지만 이 방식은 원본 PDF를 직접 수집하고 파싱하는 공부 목적과는 다르다. 참고 자료로만 사용한다.

## 4. 현재 오해 정리

질문 중에 "PDF 내용이 전부 확보된 것인가?"가 있었다.

정답:

```text
아니다.
```

확보된 것:

```text
jshj API 기반 구조화 데이터 416개
fdd-insights 샘플 JSON 일부
공정위 PDF 다운로드 방법 문서
```

아직 확보되지 않은 것:

```text
공정위 원본 PDF 583개 전체
PDF 전체 텍스트 추출 결과
PDF 기반 LLM 구조화 결과
Supabase 저장 결과
MVP API 연결
```

## 5. 목표 파이프라인

최종 목표는 아래 순서다.

```text
1. 공정위 PDF 수집
2. PDF 텍스트 추출
3. Supabase 스키마 설계
4. LLM으로 데이터 구조화
5. Supabase 저장
6. API 엔드포인트 작성
7. MVP 서비스와 연결
```

## 6. 새 폴더 구조

현재 만든 기본 구조:

```text
franchise-db-pipeline/
  docs/
  scripts/
  data/
    raw_pdfs/
    raw_text/
  supabase/
```

각 역할:

```text
docs/
  기존 핸드오프 문서와 현재 상황 정리

scripts/
  PDF 다운로드, 텍스트 추출, LLM 추출, DB 저장 스크립트

data/raw_pdfs/
  다운로드한 공정위 PDF 원본

data/raw_text/
  PDF에서 추출한 텍스트

supabase/
  테이블 생성 SQL, DB 관련 문서
```

## 7. 다음 대화창에서 바로 해야 할 일

다음 작업은 PDF 다운로드 코드 정리부터 시작한다.

우선순위:

```text
1. docs/codex_handoff_franchise_pdf_downloader.md 읽기
2. scripts/01_download_pdfs.py 작성
3. 처음에는 5개만 다운로드하도록 제한
4. PDF 파일이 진짜 열리는지 확인
5. 성공하면 텍스트 추출 코드 작성
```

처음부터 583개 전체를 받지 않는다. 먼저 5개로 검증한다.

## 8. 중요한 판단 기준

이 프로젝트는 단순히 데이터만 얻는 것이 목적이 아니다.

공부 목적은 아래 전체 흐름을 직접 경험하는 것이다.

```text
원천 수집
문서 저장
텍스트 추출
LLM 구조화
DB 저장
API 연결
MVP 반영
```

따라서 이미 정리된 JSON을 바로 DB에 넣는 빠른 길은 주목적이 아니다.

## 9. 다음 작업 시 주의

공정위 PDF 다운로드는 같은 세션 안에서 처리해야 한다.

```text
목록 수집
상세 페이지 접근
PDF POST 요청
```

이 순서를 끊어서 토큰만 저장해두면 실패할 가능성이 높다.

또한 목록 테이블의 컬럼 순서는 실측이 필요하다. 이전 확인 기준으로는 다음 순서였다.

```text
[번호, 상호, 영업표지, 대표자, 등록번호, 최초등록일, 업종]
```

따라서 파일명에는 대략 아래 인덱스가 맞을 가능성이 있다.

```python
brand_name = cells[2]
brand_id = cells[4]
```

하지만 실제 코드 작성 시 반드시 상위 3개 `cells`를 출력해서 확인해야 한다.

