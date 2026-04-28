const fs = require("node:fs");
const path = require("node:path");

const PAGE_URL = "https://jshj.net/brands/BBQ-BRD_20161241";
const API_BASE_URL = "https://api.jshj.net/api/brands";

function extractBrandId(url) {
  const decodedUrl = decodeURIComponent(url);
  const match = decodedUrl.match(/BRD_\d+/);

  if (!match) {
    throw new Error(`브랜드 ID를 찾지 못했습니다: ${url}`);
  }

  return match[0];
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function calcClosureRate(stats) {
  const storeCount = toNumber(stats?.frcs_cnt);
  const contractEndCount = toNumber(stats?.ctrt_end_cnt) || 0;
  const cancelCount = toNumber(stats?.ctrt_cncltn_cnt) || 0;

  if (!storeCount) {
    return null;
  }

  return Number((((contractEndCount + cancelCount) / storeCount) * 100).toFixed(2));
}

function csvEscape(value) {
  if (value === null || value === undefined) {
    return "";
  }

  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(rows) {
  const headers = [
    "page_url",
    "brand_id",
    "brand_name",
    "corp_name",
    "year",
    "startup_cost_만원",
    "avg_sales_만원",
    "store_count",
    "new_store_count",
    "contract_end_count",
    "contract_cancel_count",
    "closure_rate_percent",
    "interior_cost_min_만원",
    "interior_cost_max_만원",
    "business_years",
  ];

  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")),
  ];

  return `${lines.join("\n")}\n`;
}

async function fetchBrand(pageUrl) {
  const brandId = extractBrandId(pageUrl);
  const apiUrl = `${API_BASE_URL}/${brandId}`;

  const response = await fetch(apiUrl, {
    headers: {
      "user-agent": "Mozilla/5.0 learning-scraper/1.0",
      accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`API 요청 실패: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const brand = data.brand || {};
  const franchiseStats = data.frcs_stats?.[0] || {};
  const startupStats = data.fntn_stats?.[0] || {};
  const brandStats = data.brand_stats?.[0] || {};
  const interior = data.interior?.[0] || {};

  return {
    page_url: pageUrl,
    brand_id: brandId,
    brand_name: brand.brand_nm || franchiseStats.brand_nm || startupStats.brand_nm || "",
    corp_name: brand.corp_nm || franchiseStats.corp_nm || "",
    year: franchiseStats.yr || startupStats.yr || brandStats.yr || "",
    "startup_cost_만원": toNumber(startupStats.smtn_amt),
    "avg_sales_만원": toNumber(franchiseStats.avrg_sls_amt),
    store_count: toNumber(franchiseStats.frcs_cnt ?? brandStats.frcs_cnt),
    new_store_count: toNumber(franchiseStats.new_frcs_rgs_cnt),
    contract_end_count: toNumber(franchiseStats.ctrt_end_cnt),
    contract_cancel_count: toNumber(franchiseStats.ctrt_cncltn_cnt),
    closure_rate_percent: calcClosureRate(franchiseStats),
    "interior_cost_min_만원": toNumber(interior.interior_range?.min),
    "interior_cost_max_만원": toNumber(interior.interior_range?.max),
    business_years: brandStats.jng_biz_yycnt || "",
  };
}

async function main() {
  const result = await fetchBrand(PAGE_URL);
  const outputDir = path.join(process.cwd(), "output");
  const outputPath = path.join(outputDir, "bbq.csv");

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputPath, toCsv([result]), "utf8");

  console.log("BBQ 추출 결과");
  console.table(result);
  console.log(`CSV 저장 완료: ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
