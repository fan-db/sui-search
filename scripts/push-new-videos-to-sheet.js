import { readFileSync, existsSync } from 'node:fs';

const WEBHOOK_URL = process.env.SHEET_WEBHOOK_URL;
const WEBHOOK_TOKEN = process.env.SHEET_WEBHOOK_TOKEN;
const NEW_VIDEOS_PATH = 'data/new-videos-this-run.json';

if (!WEBHOOK_URL || !WEBHOOK_TOKEN) {
  console.error('エラー: .envにSHEET_WEBHOOK_URLとSHEET_WEBHOOK_TOKENを設定してください');
  process.exit(1);
}

async function main() {
  if (!existsSync(NEW_VIDEOS_PATH)) {
    console.log('新規動画ファイルが見つかりません。fetch-videos.jsを先に実行してください。');
    return;
  }

  const newVideos = JSON.parse(readFileSync(NEW_VIDEOS_PATH, 'utf-8'));

  if (newVideos.length === 0) {
    console.log('新規動画は0件でした。スプシへの追加はスキップします。');
    return;
  }

  console.log(`${newVideos.length}件の新規動画をスプシに送信中...`);

  const res = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: WEBHOOK_TOKEN,
      videos: newVideos.map((v) => ({
        videoId: v.videoId,
        numbering_ref: v.numbering_ref,
        title_ref: v.title,
      })),
    }),
  });

  const result = await res.json();

  if (!result.ok) {
    console.error('GAS側でエラー:', result.error);
    process.exit(1);
  }

  console.log(`スプシに${result.added}件の新規行を追加しました`);
}

main().catch((err) => {
  console.error('push-new-videos-to-sheet.js でエラーが発生しました:', err.message);
  process.exit(1);
});