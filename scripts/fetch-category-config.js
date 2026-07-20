import { writeFileSync } from 'node:fs';
import { fetchAndParseCsv } from './lib/csv.js';

const CATEGORY_CONFIG_CSV_URL = process.env.CATEGORY_CONFIG_CSV_URL;
const OUTPUT_PATH = 'data/category-config.json';

if (!CATEGORY_CONFIG_CSV_URL) {
  console.error('エラー: .envにCATEGORY_CONFIG_CSV_URLを設定してください');
  process.exit(1);
}

async function main() {
  console.log('カテゴリ設定シートを取得中...');
  const rows = await fetchAndParseCsv(CATEGORY_CONFIG_CSV_URL);
  writeFileSync(OUTPUT_PATH, JSON.stringify(rows, null, 2));
  console.log(`${OUTPUT_PATH} を更新しました（${rows.length}件）`);
}

main().catch((err) => {
  console.error('fetch-category-config.js でエラーが発生しました:', err.message);
  process.exit(1);
});