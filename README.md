# crawling-first

JSHJ brand crawling/API test workspace.

## Folder Layout

- `input/`
  - `urls.txt`: jshj.net brand detail URL list.
- `scripts/`
  - `scrape-bbq.js`: BBQ single brand detail API test.
  - `scrape-all.js`: brand detail API crawler for all URLs in `input/urls.txt`.
  - `make-simple-csv.js`: creates a smaller CSV from the full brand detail CSV.
  - `fetch_bbq_fdd_insights.py`: BBQ single `fdd-insights` API test, flattened to CSV.
- `output/brand-details/`
  - Standard brand detail API CSV outputs.
- `output/fdd-insights/`
  - FDD insight API CSV outputs.
- `docs/`
  - Work notes and handoff docs.

## Commands

```powershell
node scripts\scrape-bbq.js
node scripts\scrape-all.js
node scripts\make-simple-csv.js
python scripts\fetch_bbq_fdd_insights.py
```

