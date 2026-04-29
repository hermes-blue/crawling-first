const fs = require("node:fs");
const path = require("node:path");

const INPUT_PATH = path.join(process.cwd(), "input", "urls.txt");
const OUTPUT_DIR = path.join(process.cwd(), "output", "brand-details");
const OUTPUT_PATH = path.join(OUTPUT_DIR, "brands.csv");
const FAILED_PATH = path.join(OUTPUT_DIR, "failed.csv");
const API_BASE_URL = "https://api.jshj.net/api/brands";
const REQUEST_DELAY_MS = 600;
const MAX_RETRIES = 2;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readUrls(filePath) {
  const text = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");

  try {
    const parsed = JSON.parse(text);

    if (Array.isArray(parsed)) {
      return [...new Set(parsed.filter((url) => typeof url === "string" && url.includes("https://jshj.net/brands/")))];
    }
  } catch {
    // JSON 배열이 아닌 단순 txt 목록이어도 아래 정규식으로 처리합니다.
  }

  const lineUrls = text
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/,$/, "").replace(/^["']|["']$/g, ""))
    .filter((url) => url.startsWith("https://jshj.net/brands/"));

  if (lineUrls.length > 0) {
    return [...new Set(lineUrls)];
  }

  const urls = text.match(/https:\/\/jshj\.net\/brands\/[^"',\s\]]+/g) || [];
  return [...new Set(urls)];
}

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

function toCsv(rows, headers) {
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")),
  ];

  return `${lines.join("\n")}\n`;
}

async function fetchJsonWithRetry(apiUrl) {
  let lastError;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetch(apiUrl, {
        headers: {
          "user-agent": "Mozilla/5.0 learning-scraper/1.0",
          accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      lastError = error;

      if (attempt < MAX_RETRIES) {
        await sleep(1000 * (attempt + 1));
      }
    }
  }

  throw lastError;
}

async function fetchBrand(pageUrl) {
  const brandId = extractBrandId(pageUrl);
  const apiUrl = `${API_BASE_URL}/${brandId}`;
  const data = await fetchJsonWithRetry(apiUrl);

  const brand = data.brand || {};
  const franchiseStats = data.frcs_stats?.[0] || {};
  const startupStats = data.fntn_stats?.[0] || {};
  const brandStats = data.brand_stats?.[0] || {};
  const interior = data.interior?.[0] || {};
  const benchmark = data.industry_benchmarks || {};
  const percentiles = data.percentiles || {};

  return {
    page_url: pageUrl,
    api_url: apiUrl,
    brand_id: brandId,
    brand_name: brand.brand_nm || franchiseStats.brand_nm || startupStats.brand_nm || "",
    corp_name: brand.corp_nm || franchiseStats.corp_nm || "",
    category_large: brand.induty_lclas_nm || franchiseStats.induty_lclas_nm || "",
    category_middle: brand.induty_mlsfc_nm || franchiseStats.induty_mlsfc_nm || "",
    year: franchiseStats.yr || startupStats.yr || brandStats.yr || "",
    "startup_cost_만원": toNumber(startupStats.smtn_amt),
    "franchise_fee_만원": toNumber(startupStats.jng_bzmn_jng_amt),
    "education_fee_만원": toNumber(startupStats.jng_bzmn_edu_amt),
    "deposit_만원": toNumber(startupStats.jng_bzmn_assrnc_amt),
    "other_cost_만원": toNumber(startupStats.jng_bzmn_etc_amt),
    "avg_sales_만원": toNumber(franchiseStats.avrg_sls_amt),
    "avg_sales_per_area_만원": toNumber(franchiseStats.ar_unit_avrg_sls_amt),
    store_count: toNumber(franchiseStats.frcs_cnt ?? brandStats.frcs_cnt),
    new_store_count: toNumber(franchiseStats.new_frcs_rgs_cnt),
    contract_end_count: toNumber(franchiseStats.ctrt_end_cnt),
    contract_cancel_count: toNumber(franchiseStats.ctrt_cncltn_cnt),
    name_change_count: toNumber(franchiseStats.nm_chg_cnt),
    closure_rate_percent: calcClosureRate(franchiseStats),
    "interior_area_평": toNumber(interior.stor_crtra_ar),
    "interior_cost_min_만원": toNumber(interior.interior_range?.min),
    "interior_cost_max_만원": toNumber(interior.interior_range?.max),
    "interior_cost_mid_만원": toNumber(interior.interior_range?.mid),
    business_start_date: brand.jng_biz_strt_date || brandStats.jng_biz_strt_date || "",
    business_years: brandStats.jng_biz_yycnt || "",
    store_count_percentile: toNumber(percentiles.store_count_pct),
    avg_sales_percentile: toNumber(percentiles.avg_sales_pct),
    total_cost_percentile: toNumber(percentiles.total_cost_pct),
    industry_avg_sales_만원: toNumber(benchmark.avg_sales),
    industry_avg_total_cost_만원: toNumber(benchmark.avg_total_cost),
  };
}

async function main() {
  const urls = readUrls(INPUT_PATH);

  if (urls.length === 0) {
    throw new Error(`URL을 찾지 못했습니다: ${INPUT_PATH}`);
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const rows = [];
  const failedRows = [];

  console.log(`총 ${urls.length}개 URL 수집 시작`);

  for (const [index, url] of urls.entries()) {
    const label = `[${index + 1}/${urls.length}]`;

    try {
      const row = await fetchBrand(url);
      rows.push(row);
      console.log(`${label} 성공: ${row.brand_name || row.brand_id}`);
    } catch (error) {
      failedRows.push({
        page_url: url,
        error_message: error.message,
      });
      console.log(`${label} 실패: ${url} - ${error.message}`);
    }

    if (index < urls.length - 1) {
      await sleep(REQUEST_DELAY_MS);
    }
  }

  const headers = [
    "page_url",
    "api_url",
    "brand_id",
    "brand_name",
    "corp_name",
    "category_large",
    "category_middle",
    "year",
    "startup_cost_만원",
    "franchise_fee_만원",
    "education_fee_만원",
    "deposit_만원",
    "other_cost_만원",
    "avg_sales_만원",
    "avg_sales_per_area_만원",
    "store_count",
    "new_store_count",
    "contract_end_count",
    "contract_cancel_count",
    "name_change_count",
    "closure_rate_percent",
    "interior_area_평",
    "interior_cost_min_만원",
    "interior_cost_max_만원",
    "interior_cost_mid_만원",
    "business_start_date",
    "business_years",
    "store_count_percentile",
    "avg_sales_percentile",
    "total_cost_percentile",
    "industry_avg_sales_만원",
    "industry_avg_total_cost_만원",
  ];

  fs.writeFileSync(OUTPUT_PATH, toCsv(rows, headers), "utf8");
  fs.writeFileSync(FAILED_PATH, toCsv(failedRows, ["page_url", "error_message"]), "utf8");

  console.log(`완료: 성공 ${rows.length}개, 실패 ${failedRows.length}개`);
  console.log(`결과 CSV: ${OUTPUT_PATH}`);
  console.log(`실패 CSV: ${FAILED_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
