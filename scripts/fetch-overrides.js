import { writeFileSync } from 'node:fs';
import { fetchAndParseCsv } from './lib/csv.js';

const OVERRIDES_CSV_URL = process.env.OVERRIDES_CSV_URL;
const OUTPUT_PATH = 'data/overrides.json';

if (!OVERRIDES_CSV_URL) {
  console.error('エラー: .envにOVERRIDES_CSV_URLを設定してください');
  process.exit(1);
}

async function main() {
  console.log('overridesシートを取得中...');
  const rows = await fetchAndParseCsv(OVERRIDES_CSV_URL);
  writeFileSync(OUTPUT_PATH, JSON.stringify(rows, null, 2));
  console.log(`${OUTPUT_PATH} を更新しました（${rows.length}件）`);
}

main().catch((err) => {
  console.error('fetch-overrides.js でエラーが発生しました:', err.message);
  process.exit(1);
});