import csv
import json
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


# BBQ brand id confirmed from the jshj.net brand detail URL/API analysis.
BRAND_ID = "BRD_20161241"

# fdd-insights returns the LLM-analyzed disclosure data for one brand.
API_URL = f"https://api.jshj.net/api/brands/{BRAND_ID}/fdd-insights"

# Save a flattened CSV so the response can be inspected in Excel/sheets before
# expanding this into the full 419-brand crawler.
OUTPUT_PATH = Path("output") / "fdd-insights" / "bbq_fdd_insights.csv"


def fetch_json(url: str) -> Any:
    """Call the jshj API once and return the parsed JSON response."""
    request = Request(
        url,
        method="GET",
        headers={
            # Browser-like headers observed during analysis. No auth is needed.
            "Accept": "application/json",
            "Origin": "https://jshj.net",
            "Referer": "https://jshj.net/",
            "User-Agent": "Mozilla/5.0 learning-scraper/1.0",
        },
    )

    try:
        with urlopen(request, timeout=30) as response:
            charset = response.headers.get_content_charset() or "utf-8"
            body = response.read().decode(charset)
            return json.loads(body)
    except HTTPError as error:
        # HTTPError also contains the response body, which is useful when the
        # API returns a JSON error message.
        error_body = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(
            f"API request failed: HTTP {error.code} {error.reason}\n{error_body}"
        ) from error
    except URLError as error:
        raise RuntimeError(f"API request failed: {error.reason}") from error


def flatten_json(value: Any, prefix: str = "") -> list[dict[str, str]]:
    """Flatten nested JSON into path/value rows for easy CSV inspection."""
    if isinstance(value, dict):
        rows: list[dict[str, str]] = []
        for key, child in value.items():
            child_prefix = f"{prefix}.{key}" if prefix else str(key)
            rows.extend(flatten_json(child, child_prefix))
        return rows

    if isinstance(value, list):
        rows = []
        for index, child in enumerate(value):
            child_prefix = f"{prefix}[{index}]"
            rows.extend(flatten_json(child, child_prefix))
        return rows

    if value is None:
        text = ""
    elif isinstance(value, bool):
        text = "true" if value else "false"
    else:
        text = str(value)

    return [{"brand_id": BRAND_ID, "path": prefix, "value": text}]


def write_csv(rows: list[dict[str, str]], output_path: Path) -> None:
    """Write flattened rows to a UTF-8 BOM CSV for better Excel compatibility."""
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with output_path.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=["brand_id", "path", "value"])
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    print(f"Requesting: {API_URL}")

    data = fetch_json(API_URL)
    rows = flatten_json(data)

    write_csv(rows, OUTPUT_PATH)

    print("BBQ fdd-insights request succeeded.")
    print(f"Saved CSV: {OUTPUT_PATH}")
    print(f"Flattened rows: {len(rows)}")

    # Print a compact preview so success can be checked from the terminal.
    if isinstance(data, dict):
        print(f"Top-level keys: {', '.join(data.keys())}")
    else:
        print(f"Response type: {type(data).__name__}")


if __name__ == "__main__":
    main()
