const fs = require("node:fs");
const path = require("node:path");

const REQUEST_DELAY_MS = 3000;
const API_BASE_URL = "https://api.jshj.net/api/brands";
const OUTPUT_ROOT = path.join(process.cwd(), "output", "fdd-insights");
const RAW_DIR = path.join(OUTPUT_ROOT, "raw-test-5");
const FLAT_CSV_PATH = path.join(OUTPUT_ROOT, "test_5_fdd_insights_flat.csv");
const FAILED_CSV_PATH = path.join(OUTPUT_ROOT, "test_5_failed.csv");

const BRANDS = [
  { brand_id: "BRD_20180608", brand_name: "진미대왕통닭" },
  { brand_id: "BRD_20150724", brand_name: "오부장치킨" },
  { brand_id: "BRD_20141157", brand_name: "아이벗 치킨" },
  { brand_id: "BRD_20180793", brand_name: "허갈닭강정" },
  { brand_id: "BRD_20211217", brand_name: "당신은지금치킨이땡긴다" },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeFileName(text) {
  return text.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_").replace(/\s+/g, "_");
}

function flatten(value, brand, prefix = "", rows = []) {
  if (value === null || value === undefined) {
    rows.push({
      brand_id: brand.brand_id,
      brand_name: brand.brand_name,
      path: prefix,
      value: "",
    });
    return rows;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      flatten(item, brand, `${prefix}[${index}]`, rows);
    });
    return rows;
  }

  if (typeof value === "object") {
    Object.entries(value).forEach(([key, child]) => {
      flatten(child, brand, prefix ? `${prefix}.${key}` : key, rows);
    });
    return rows;
  }

  rows.push({
    brand_id: brand.brand_id,
    brand_name: brand.brand_name,
    path: prefix,
    value: String(value),
  });
  return rows;
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function writeCsv(filePath, rows, headers) {
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")),
  ];

  fs.writeFileSync(filePath, `\uFEFF${lines.join("\n")}\n`, "utf8");
}

async function fetchFddInsight(brand) {
  const apiUrl = `${API_BASE_URL}/${brand.brand_id}/fdd-insights`;
  const response = await fetch(apiUrl, {
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

  return response.json();
}

async function main() {
  fs.mkdirSync(RAW_DIR, { recursive: true });

  const flatRows = [];
  const failedRows = [];

  for (const [index, brand] of BRANDS.entries()) {
    const label = `[${index + 1}/${BRANDS.length}] ${brand.brand_name} (${brand.brand_id})`;

    try {
      console.log(`${label} requesting`);
      const data = await fetchFddInsight(brand);
      const fileName = `${brand.brand_id}_${safeFileName(brand.brand_name)}.json`;

      fs.writeFileSync(path.join(RAW_DIR, fileName), JSON.stringify(data, null, 2), "utf8");
      flatRows.push(...flatten(data, brand));

      console.log(`${label} saved`);
    } catch (error) {
      failedRows.push({
        brand_id: brand.brand_id,
        brand_name: brand.brand_name,
        error_message: error.message,
      });
      console.log(`${label} failed: ${error.message}`);
    }

    if (index < BRANDS.length - 1) {
      await sleep(REQUEST_DELAY_MS);
    }
  }

  writeCsv(FLAT_CSV_PATH, flatRows, ["brand_id", "brand_name", "path", "value"]);
  writeCsv(FAILED_CSV_PATH, failedRows, ["brand_id", "brand_name", "error_message"]);

  console.log(`Done. Success: ${BRANDS.length - failedRows.length}, failed: ${failedRows.length}`);
  console.log(`Flat CSV: ${FLAT_CSV_PATH}`);
  console.log(`Failed CSV: ${FAILED_CSV_PATH}`);
  console.log(`Raw JSON dir: ${RAW_DIR}`);
  console.log(`Flat rows: ${flatRows.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
