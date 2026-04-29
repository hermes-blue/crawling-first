const fs = require("node:fs");
const path = require("node:path");

const BRAND_ID = "BRD_20161241";
const API_URL = `https://api.jshj.net/api/brands/${BRAND_ID}/fdd-insights`;
const OUTPUT_DIR = path.join(process.cwd(), "output", "fdd-insights");
const JSON_PATH = path.join(OUTPUT_DIR, "bbq_fdd_insights.json");
const CSV_PATH = path.join(OUTPUT_DIR, "bbq_fdd_insights.csv");

function flatten(value, prefix = "", rows = []) {
  if (value === null || value === undefined) {
    rows.push({ brand_id: BRAND_ID, path: prefix, value: "" });
    return rows;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      flatten(item, `${prefix}[${index}]`, rows);
    });
    return rows;
  }

  if (typeof value === "object") {
    Object.entries(value).forEach(([key, child]) => {
      flatten(child, prefix ? `${prefix}.${key}` : key, rows);
    });
    return rows;
  }

  rows.push({ brand_id: BRAND_ID, path: prefix, value: String(value) });
  return rows;
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(rows) {
  const lines = [
    "brand_id,path,value",
    ...rows.map((row) => [row.brand_id, row.path, row.value].map(csvEscape).join(",")),
  ];

  return `\uFEFF${lines.join("\n")}\n`;
}

async function main() {
  const response = await fetch(API_URL, {
    headers: {
      Accept: "application/json",
      Origin: "https://jshj.net",
      Referer: "https://jshj.net/",
      "User-Agent": "Mozilla/5.0 learning-scraper/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const rows = flatten(data);

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(JSON_PATH, JSON.stringify(data, null, 2), "utf8");
  fs.writeFileSync(CSV_PATH, toCsv(rows), "utf8");

  console.log(`Saved JSON: ${JSON_PATH}`);
  console.log(`Saved CSV: ${CSV_PATH}`);
  console.log(`Rows: ${rows.length}`);
  console.log(`Brand: ${data.brand_nm}`);
  console.log(`Category: ${data.category}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
