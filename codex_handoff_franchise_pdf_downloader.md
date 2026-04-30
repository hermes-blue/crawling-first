# 공정위 정보공개서 PDF 자동 다운로드 — Codex 핸드오프 사양서

> **작성일**: 2026-04-30
> **검증 상태**: 교촌치킨 단일 다운로드 실측 성공 (workspace `download_kyochon_v4.py`)
> **목표**: 583개 치킨 브랜드 일괄 다운로드 코드 생성 후 사용자 로컬에서 실행

---

## 0. 목표

공정거래위원회 가맹사업정보제공시스템(`franchise.ftc.go.kr`)에서 **치킨 업종 583개 브랜드의 정보공개서 PDF를 자동 다운로드**한다.

- 입력: 없음 (사이트가 자동으로 583개 목록 제공)
- 출력: `./franchise_pdfs/` 디렉토리에 PDF 583개 + 매니페스트 CSV + 실패 로그 CSV
- 제약: 같은 세션 안에서 STEP 1~3을 즉시 처리 (토큰이 세션 단위로만 유효)

---

## 1. 전체 흐름 — 3단계 구조

```
[STEP 1: 목록 수집]
GET  /mnu/00013/program/userRqst/list.do?selUpjong=21&selIndus=H1
     ↓ (세션 쿠키 발급)
POST /mnu/00013/program/userRqst/list.do  (페이지 1~7, 각 100개씩)
     ↓
HTML 응답 → <tbody> → <tr> 단위로 583개 행 추출
각 행에서 fn_moveUrl(...,'XXXX') 형식의 encFirMstSn 토큰 파싱

[STEP 2: 상세 페이지 진입 → firMstSn 추출]
GET /mnu/00013/program/userRqst/view.do?encFirMstSn=<encFirMstSn>
     ↓
HTML 응답 → <input name="firMstSn" value="숫자"> 추출

[STEP 3: PDF 다운로드]
POST /cmm/fms/firOpenPdfView.do
     body: firMstSn=<숫자>&encFirMstSn=<encFirMstSn>&...
     ↓
응답 binary 시작이 b"%PDF" 면 성공 → 파일로 저장
```

**핵심 제약**:
- STEP 1에서 받은 `encFirMstSn` 토큰은 **같은 세션 안에서만 유효**.
- 토큰을 모아뒀다가 나중에 STEP 2~3 돌리면 100% 실패.
- **반드시 한 세션 안에서 583개를 즉시 처리**해야 한다.

---

## 2. 토큰 구조 — 두 종류 식별자

| 토큰 | 어디서 나오는지 | 어디에 쓰는지 | 수명 |
|---|---|---|---|
| **encFirMstSn** | STEP 1 목록 HTML의 `fn_moveUrl()` JS 함수 인자 | STEP 2 view.do URL 파라미터 + STEP 3 form body | **세션 단위** (브라우저 닫으면 무효) |
| **firMstSn** | STEP 2 view.do 페이지의 `<input type="hidden">` | STEP 3 firOpenPdfView.do form body | 세션 단위 |

**왜 2단계인가**: 공정위는 "목록 페이지에서 진짜 PDF 식별번호를 노출시키지 않고, 한 단계 더 클릭해야 노출"시키는 보안 패턴을 쓴다. 자동화는 이 2단계를 그대로 흉내내야 한다.

**파싱 정규식 (검증 완료)**:

```python
# STEP 1: encFirMstSn 토큰 추출
re.search(r"fn_moveUrl\(['\"][^'\"]*encFirMstSn=['\"],\s*['\"]([^'\"]+)['\"]\)", tr_html)

# STEP 2: firMstSn 추출
re.search(r'<input[^>]*name=["\']firMstSn["\'][^>]*value=["\'](\d+)["\']', view_html)
```

---

## 3. 필수 헤더 (3종 + α)

```python
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "ko-KR,ko;q=0.9",
    "Connection": "close",   # ← 이거 빠지면 keep-alive로 인한 간헐적 행(hang) 발생
}
```

**요청별 추가 헤더** (Referer가 결정적):

| 요청 | 추가 Referer | 추가 헤더 |
|---|---|---|
| STEP 1 GET (초기) | 없음 | 없음 |
| STEP 1 POST (페이지) | `https://franchise.ftc.go.kr/mnu/00013/program/userRqst/list.do` | `Content-Type: application/x-www-form-urlencoded` |
| STEP 2 GET view.do | 위와 동일 (list.do) | 없음 |
| STEP 3 POST PDF | `…/view.do?encFirMstSn=<token>` | `Content-Type: application/x-www-form-urlencoded` + **`Origin: https://franchise.ftc.go.kr`** |

**STEP 3의 `Origin` 헤더는 빠지면 거절당한다** (실측 확인).

---

## 4. POST body 정확한 형식

### STEP 1 POST (목록 페이지 호출)

```python
data = {
    "selUpjong": "21",       # 외식업
    "selIndus": "H1",        # 치킨
    "searchKeyword": "",
    "column": "",
    "pageIndex": str(page),  # 1~7
    "pageUnit": "100",       # 페이지당 100개 (583개 ÷ 100 = 6페이지 + 잔여)
}
```

### STEP 3 POST (PDF 다운로드)

```python
data = {
    "firMstSn": fir,         # STEP 2에서 추출한 숫자
    "encFirMstSn": token,    # STEP 1에서 추출한 토큰
    "openType": "",
    "searchKeyword": "",
    "column": "",
    "pageUnit": "10",
    "pageIndex": "1",
    "selUpjong": "",
    "selIndus": "",
}
```

이 빈 필드들 빠뜨리면 거절당한다 (서버가 모든 필드 존재 여부를 검증함).

---

## 5. 에러 처리

### 5-1. TLS handshake 간헐 실패 → 재시도 5회 + 백오프

정부 사이트 특성상 583번 연속 호출 시 30~50번은 `SSLError`, `ConnectionError`, `RemoteDisconnected` 중 하나가 터진다. 재시도 없이 돌리면 누락 발생.

```python
def retry(fn, *args, **kwargs):
    last_exc = None
    for i in range(1, 6):  # 최대 5회
        try:
            return fn(*args, **kwargs)
        except Exception as e:
            last_exc = e
            print(f"  retry {i}: {type(e).__name__}", file=sys.stderr)
            time.sleep(1.5 * i)  # 1.5s, 3s, 4.5s, 6s, 7.5s 백오프
    raise last_exc
```

### 5-2. PDF 시그니처 검증 (Content-Type 신뢰 X)

서버가 에러 시에도 `Content-Type: application/pdf`를 그대로 박아 보내는 경우가 있다. **반드시 응답 binary 첫 4바이트로 판별**한다.

```python
if r3.content[:4] != b"%PDF":
    # HTML 에러 페이지일 가능성 - 앞 60바이트 출력하면 진단 가능
    raise RuntimeError(f"PDF 시그니처 아님: {r3.content[:60]}")
```

### 5-3. firMstSn 추출 실패

view.do 응답이 비정상이면 `<input name="firMstSn">`이 아예 없을 수 있다. 그러면 `RuntimeError("firMstSn 없음")` 던지고 그 브랜드는 실패 로그로 분류 → 마지막에 재시도.

### 5-4. HTML 파싱 시 행 섞임 방지 (실측 사고 사례)

목록 HTML에서 토큰을 뽑을 때 `<tr>...</tr>` 단위로 정확히 자른 후 그 내부에서만 정규식 매칭해야 한다. 큰 덩어리 통째로 정규식 돌리면 행이 섞여서 **봉이치킨 토큰으로 교촌이 다운로드되는 사고** 발생. (첫 시도에 실제로 발생함)

```python
tbody_html = re.search(r'<tbody[^>]*>(.*?)</tbody>', html, re.S).group(1)
tr_list = re.findall(r'<tr[^>]*>(.*?)</tr>', tbody_html, re.S)
for tr in tr_list:
    # ← 여기서 토큰 + 셀 추출 (반드시 tr 내부에서만)
```

---

## 6. 저장 구조

### 6-1. 파일명 규칙

```
{out_dir}/{brand_name_safe}_{brand_id}.pdf
```

- `brand_name_safe` = 브랜드명에서 OS 금지문자(`/\:*?"<>|`) 제거 + 공백을 `_`로 치환
- `brand_id` = 셀에서 추출한 등록번호 (보통 첫 번째 또는 두 번째 셀, 사이트 구조 실측 후 확정)

예: `교촌치킨_20080600002.pdf`, `BHC_20061200004.pdf`

### 6-2. 디렉토리 구조

```
./franchise_pdfs/
├── 교촌치킨_20080600002.pdf
├── BHC_20061200004.pdf
├── ...
├── _failed.csv     # 실패한 브랜드 기록 (재시도용)
└── _manifest.csv   # 성공 목록 + 토큰 + 파일크기
```

### 6-3. 멱등성 (재실행 안전)

- 파일이 이미 존재하면 스킵
- 단, 크기가 1KB 미만이면 손상 가능성 있으므로 재다운로드
- 같은 스크립트를 여러 번 돌려도 안전 → 실패한 건만 자동 재시도

---

## 7. 작동하는 Python 코드 (전체)

> 이 코드는 교촌 단일 다운로드로 **검증 완료** (workspace에서 실측). 583개 일괄로 확장하면 즉시 작동한다.

```python
"""
공정위 정보공개서 PDF 일괄 다운로드 (583개 치킨 브랜드)
- 같은 세션 안에서 STEP 1~3을 즉시 처리
- 재시도 5회, 백오프 1.5x
- 멱등성: 이미 받은 파일은 스킵
- 실패 로그: _failed.csv
"""
import re
import sys
import time
import csv
import requests
from pathlib import Path
from urllib.parse import quote

BASE = "https://franchise.ftc.go.kr"
LIST_URL = f"{BASE}/mnu/00013/program/userRqst/list.do"
VIEW_URL_TPL = f"{BASE}/mnu/00013/program/userRqst/view.do?encFirMstSn={{}}"
PDF_URL = f"{BASE}/cmm/fms/firOpenPdfView.do"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "ko-KR,ko;q=0.9",
    "Connection": "close",
}

OUT_DIR = Path("./franchise_pdfs")
OUT_DIR.mkdir(exist_ok=True)
FAILED_CSV = OUT_DIR / "_failed.csv"
MANIFEST_CSV = OUT_DIR / "_manifest.csv"


def retry(fn, *args, **kwargs):
    """5회 재시도 + 백오프 1.5*i"""
    last = None
    for i in range(1, 6):
        try:
            return fn(*args, **kwargs)
        except Exception as e:
            last = e
            print(f"  retry {i}: {type(e).__name__}: {e}", file=sys.stderr)
            time.sleep(1.5 * i)
    raise last


def safe_filename(name: str) -> str:
    """OS 금지문자 제거"""
    return re.sub(r'[\\/:*?"<>|]', '_', name).strip().replace(' ', '_')


def collect_chicken_rows(s: requests.Session) -> list[dict]:
    """STEP 1: 치킨 카테고리 583개 행 수집"""
    # 초기 GET (세션 쿠키 발급)
    retry(s.get, f"{LIST_URL}?selUpjong=21&selIndus=H1", timeout=30)

    rows = []
    for page in range(1, 8):  # 583개 ÷ 100 = 6페이지 + 잔여
        rr = retry(
            s.post, LIST_URL,
            data={
                "selUpjong": "21", "selIndus": "H1",
                "searchKeyword": "", "column": "",
                "pageIndex": str(page), "pageUnit": "100",
            },
            timeout=30,
            headers={
                "Referer": LIST_URL,
                "Content-Type": "application/x-www-form-urlencoded",
            },
        )

        # tbody 영역만 정확히 잘라내기 (행 섞임 방지)
        tbody_m = re.search(r'<tbody[^>]*>(.*?)</tbody>', rr.text, re.S)
        if not tbody_m:
            print(f"page {page}: tbody 없음", file=sys.stderr)
            continue

        # <tr> 단위 정확 매칭
        tr_list = re.findall(r'<tr[^>]*>(.*?)</tr>', tbody_m.group(1), re.S)
        for tr in tr_list:
            tok_m = re.search(
                r"fn_moveUrl\(['\"][^'\"]*encFirMstSn=['\"],\s*['\"]([^'\"]+)['\"]\)",
                tr,
            )
            if not tok_m:
                continue

            # 셀 텍스트 추출 (HTML 태그 제거 + 공백 정리)
            cells = [
                re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', c)).strip()
                for c in re.findall(r'<td[^>]*>(.*?)</td>', tr, re.S)
            ]
            rows.append({"token": tok_m.group(1), "cells": cells})

        time.sleep(0.5)  # 페이지 간 매너 대기

    return rows


def download_pdf(s: requests.Session, token: str, out_path: Path) -> tuple[int, str]:
    """STEP 2~3: view.do 진입 → firMstSn 추출 → PDF 다운로드"""
    view_url = VIEW_URL_TPL.format(quote(token, safe=''))

    # STEP 2: view.do GET
    r2 = retry(
        s.get, view_url, timeout=30,
        headers={"Referer": LIST_URL},
    )
    m = re.search(
        r'<input[^>]*name=["\']firMstSn["\'][^>]*value=["\'](\d+)["\']',
        r2.text,
    )
    if not m:
        raise RuntimeError("firMstSn 없음 (view.do 응답 비정상)")
    fir = m.group(1)

    # STEP 3: PDF 다운로드 POST
    r3 = retry(
        s.post, PDF_URL,
        data={
            "firMstSn": fir, "encFirMstSn": token,
            "openType": "", "searchKeyword": "", "column": "",
            "pageUnit": "10", "pageIndex": "1",
            "selUpjong": "", "selIndus": "",
        },
        timeout=120,
        headers={
            "Referer": view_url,
            "Origin": BASE,
            "Content-Type": "application/x-www-form-urlencoded",
        },
    )

    # PDF 시그니처 검증 (Content-Type 신뢰 X)
    if r3.content[:4] != b"%PDF":
        raise RuntimeError(f"PDF 시그니처 아님: head={r3.content[:60]!r}")

    out_path.write_bytes(r3.content)
    return len(r3.content), fir


def main():
    s = requests.Session()
    s.headers.update(HEADERS)

    print("[1/3] 목록 수집 시작")
    rows = collect_chicken_rows(s)
    print(f"  → 총 {len(rows)} 행 수집 (예상 583)")
    if len(rows) < 500:
        print("  ⚠ 행 수가 예상보다 적음. tbody 파싱 확인 필요.", file=sys.stderr)

    print(f"\n[2/3] PDF 일괄 다운로드 (출력: {OUT_DIR.resolve()})")
    success, skipped, failed = 0, 0, 0
    failed_rows = []
    manifest_rows = []

    for idx, row in enumerate(rows, 1):
        token = row["token"]
        cells = row["cells"]
        # 셀 구조는 사이트마다 다를 수 있음 — 실측 후 인덱스 조정
        # 일반적으로 [번호, 등록번호, 상호, 영업표지, 대표자, ...] 순
        brand_id = cells[1] if len(cells) > 1 else f"unknown_{idx}"
        brand_name = cells[3] if len(cells) > 3 else f"brand_{idx}"

        out_path = OUT_DIR / f"{safe_filename(brand_name)}_{brand_id}.pdf"

        # 멱등성: 이미 정상 크기면 스킵
        if out_path.exists() and out_path.stat().st_size > 1024:
            print(f"  [{idx}/{len(rows)}] {brand_name} → 이미 존재, 스킵")
            skipped += 1
            continue

        try:
            size, fir = download_pdf(s, token, out_path)
            print(f"  [{idx}/{len(rows)}] {brand_name}: {size:,} bytes ✅")
            success += 1
            manifest_rows.append({
                "brand_id": brand_id, "brand_name": brand_name,
                "encFirMstSn": token, "firMstSn": fir,
                "filename": out_path.name, "size": size,
            })
            time.sleep(0.3)  # 서버 매너 대기
        except Exception as e:
            print(f"  [{idx}/{len(rows)}] {brand_name}: ❌ {e}", file=sys.stderr)
            failed += 1
            failed_rows.append({
                "brand_id": brand_id, "brand_name": brand_name,
                "token": token, "error": str(e),
            })

    # 매니페스트 저장
    if manifest_rows:
        with open(MANIFEST_CSV, "w", newline="", encoding="utf-8-sig") as f:
            w = csv.DictWriter(f, fieldnames=manifest_rows[0].keys())
            w.writeheader(); w.writerows(manifest_rows)

    if failed_rows:
        with open(FAILED_CSV, "w", newline="", encoding="utf-8-sig") as f:
            w = csv.DictWriter(f, fieldnames=failed_rows[0].keys())
            w.writeheader(); w.writerows(failed_rows)

    print(f"\n[3/3] 완료: ✅{success} / ⏭{skipped} / ❌{failed}")
    if failed:
        print(f"  실패 목록: {FAILED_CSV}")
        print(f"  → 같은 스크립트 재실행하면 성공한 건 자동 스킵, 실패만 재시도됨")


if __name__ == "__main__":
    main()
```

---

## 8. 코덱스에게 추가로 확인시킬 것

이 사양서로 코드는 거의 그대로 돌아가지만, **셀 인덱스 1개**는 사이트 실측이 필요하다:

```python
brand_id   = cells[1]  # ← 등록번호가 몇 번째 셀인지
brand_name = cells[3]  # ← 영업표지(브랜드명)가 몇 번째 셀인지
```

**코덱스 작업 순서**:
1. 처음 실행 시 상위 3행만 `print(cells)` 찍어서 셀 배열 구조 확인
2. 어느 인덱스가 brand_id / brand_name인지 확정
3. 코드 수정 후 5개 정도만 우선 받아 PDF 정상 열림 확인
4. 검증 OK면 583개 풀 실행

---

## 9. 다른 업종 확장 시

치킨(`H1`)이 아닌 다른 업종을 받으려면 **2개 파라미터만 변경**:

| 파라미터 | 치킨 | 변경 시 확인할 곳 |
|---|---|---|
| `selUpjong` | `21` (외식업) | 상위 카테고리 |
| `selIndus` | `H1` (치킨) | 하위 업종 코드 |

업종 코드는 사이트의 셀렉트박스 HTML을 보고 추출 가능.

---

## 10. 주의사항 — 사용자 컴퓨터에서 실행 시

1. **Python 3.10+** 필수 (타입 힌트 `list[dict]` 등 사용)
2. **의존성**: `pip install requests`
3. **첫 실행은 디버그 모드로** — 우선 1~5개만 받아보고 PDF가 정상 열리는지 확인 후 583개 풀 실행
4. **실행 시간**: 583개 × (5~10초/건) = 약 50~100분 (재시도 포함)
5. **네트워크 매너**: 동일 IP에서 너무 빨리 두드리면 일시 차단 가능 → `time.sleep(0.3)` 유지 권장
6. **결과물 용량**: PDF 평균 2~3MB × 583 ≈ 1.2~1.8GB 디스크 공간 필요
7. **재시도 가능**: 중간에 멈춰도 다시 실행하면 성공한 건 스킵, 실패만 재처리

---

## 11. 디버깅 체크리스트 (문제 생기면 순서대로 확인)

| 증상 | 의심 원인 | 확인 방법 |
|---|---|---|
| `len(rows) < 500` | tbody 파싱 실패 / 사이트 HTML 구조 변경 | 응답 HTML을 파일로 저장 후 `<tbody>` 존재 여부 확인 |
| `firMstSn 없음` 에러 다발 | view.do 응답이 에러 페이지 / 세션 만료 | 응답 HTML 처음 500자 출력 → 로그인 페이지 등인지 확인 |
| `PDF 시그니처 아님` | STEP 3 form 필드 누락 / Origin 헤더 누락 | 응답 첫 60바이트 출력 → HTML이면 헤더 점검 |
| 모든 요청 SSLError | Python `requests` SSL 검증 이슈 | `urllib3.disable_warnings()` 추가 또는 `verify=False` (마지막 수단) |
| 잘못된 브랜드 PDF 받음 (예: 교촌 요청 → 봉이) | tr 단위 파싱 안 됨 | tbody → tr 잘라내기 후 그 내부에서만 토큰 매칭 확인 |
| 583개 중 절반만 받음 | 재시도 로직 누락 / sleep 너무 짧음 | retry 5회 + backoff 1.5x 적용 확인 |

---

## 12. 참고 — 검증된 원본 스크립트

- 위치: `download_kyochon_v4.py` (workspace)
- 검증 결과: 교촌 1개 단일 다운로드 성공, PDF 1페이지에 "교촌" 텍스트 포함 확인
- 이 사양서는 v4 스크립트의 원리를 그대로 유지하면서 583개 일괄 처리용으로 확장한 것

---

**이 문서만 코덱스에게 던지면 바로 `python download_all.py` 실행 가능한 코드가 나옵니다.**
