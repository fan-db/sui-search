import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { callYoutubeApi } from './lib/youtube-api.js';
import { extractNumbering } from './lib/numbering.js';

const API_KEY = process.env.YOUTUBE_API_KEY;
const PLAYLIST_ID = process.env.YOUTUBE_PLAYLIST_ID;
const OUTPUT_PATH = 'data/videos-raw.json';
const SKIPPED_PATH = 'data/skipped-debug.json';
const NEW_VIDEOS_PATH = 'data/new-videos-this-run.json'; // ★追加：今回分だけの新規動画

if (!API_KEY || !PLAYLIST_ID) {
  console.error('エラー: .envにYOUTUBE_API_KEYとYOUTUBE_PLAYLIST_IDを設定してください');
  process.exit(1);
}

async function fetchAllPlaylistVideoIds() {
  const videoIds = [];
  let pageToken = '';

  do {
    const data = await callYoutubeApi('playlistItems', {
      part: 'contentDetails',
      playlistId: PLAYLIST_ID,
      maxResults: 50,
      pageToken,
      key: API_KEY,
    });

    for (const item of data.items) {
      videoIds.push(item.contentDetails.videoId);
    }

    pageToken = data.nextPageToken ?? '';
  } while (pageToken);

  return videoIds;
}

async function fetchVideoDetails(videoIds) {
  const results = [];

  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const data = await callYoutubeApi('videos', {
      part: 'snippet,contentDetails',
      id: batch.join(','),
      key: API_KEY,
    });

    for (const item of data.items) {
      const { title, description, publishedAt, thumbnails } = item.snippet;
      results.push({
        videoId: item.id,
        title,
        description,
        publishedAt,
        thumbnail: thumbnails.high?.url ?? thumbnails.default.url,
        duration: item.contentDetails.duration,
        url: `https://www.youtube.com/watch?v=${item.id}`,
        numbering_ref: extractNumbering(description, title),
      });
    }
  }

  return results;
}

async function main() {
  console.log('プレイリストから動画IDを取得中...');
  const videoIds = await fetchAllPlaylistVideoIds();
  console.log(`${videoIds.length}本の動画が見つかりました`);

  const existing = loadExistingVideos();

  const existingIds = new Set(existing.map((v) => v.videoId));
  const newIds = videoIds.filter((id) => !existingIds.has(id));

  console.log(`うち新規動画: ${newIds.length}本`);

  const newVideos = newIds.length > 0 ? await fetchVideoDetails(newIds) : [];
  const merged = [...existing, ...newVideos];

  writeFileSync(OUTPUT_PATH, JSON.stringify(merged, null, 2));
  console.log(`${OUTPUT_PATH} を更新しました（合計${merged.length}本）`);

  // ★追加：今回見つかった新規動画だけを書き出す（GASへのpush用）
  writeFileSync(NEW_VIDEOS_PATH, JSON.stringify(newVideos, null, 2));

  const skipped = merged
    .filter((v) => v.numbering_ref === null)
    .map((v) => ({ videoId: v.videoId, title: v.title, url: v.url }));
  writeFileSync(SKIPPED_PATH, JSON.stringify(skipped, null, 2));
  console.log(`ナンバリング抽出漏れ: ${skipped.length}本（${SKIPPED_PATH}を確認してください）`);
}

main().catch((err) => {
  console.error('fetch-videos.js でエラーが発生しました:', err.message);
  process.exit(1);
});

function loadExistingVideos() {
  if (!existsSync(OUTPUT_PATH)) return [];

  const content = readFileSync(OUTPUT_PATH, 'utf-8').trim();
  if (content === '') return []; // 空ファイルなら「データなし」として扱う

  return JSON.parse(content);
}