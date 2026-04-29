const fs = require("node:fs");
const path = require("node:path");

const INPUT_PATH = path.join(process.cwd(), "output", "brand-details", "brands.csv");
const OUTPUT_PATH = path.join(process.cwd(), "output", "brand-details", "brands_simple.csv");

const SIMPLE_HEADERS = [
  "brand_name",
  "corp_name",
  "year",
  "startup_cost_만원",
  "avg_sales_만원",
  "store_count",
  "closure_rate_percent",
  "new_store_count",
  "contract_end_count",
  "contract_cancel_count",
  "business_years",
  "page_url",
];

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && nextChar === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current);
  return values;
}

function csvEscape(value) {
  if (value === null || value === undefined) {
    return "";
  }

  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function main() {
  const text = fs.readFileSync(INPUT_PATH, "utf8").replace(/^\uFEFF/, "");
  const lines = text.trimEnd().split(/\r?\n/);
  const headers = parseCsvLine(lines[0]);

  const rows = lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });

  const simpleLines = [
    SIMPLE_HEADERS.join(","),
    ...rows.map((row) => SIMPLE_HEADERS.map((header) => csvEscape(row[header])).join(",")),
  ];

  // Excel이 한글을 UTF-8로 바로 인식하도록 BOM을 붙입니다.
  fs.writeFileSync(OUTPUT_PATH, `\uFEFF${simpleLines.join("\n")}\n`, "utf8");

  console.log(`핵심 컬럼 CSV 저장 완료: ${OUTPUT_PATH}`);
  console.log(`데이터 행 수: ${rows.length}`);
}

main();
