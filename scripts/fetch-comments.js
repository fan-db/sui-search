import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { callYoutubeApi } from './lib/youtube-api.js';
import { extractTimestamps, parseDurationToSeconds } from './lib/timestamp.js';

const API_KEY = process.env.YOUTUBE_API_KEY;
const VIDEOS_PATH = 'data/videos-raw.json';
const COMMENTS_PATH = 'data/comments-raw.json';
const CURSOR_PATH = 'data/cursor.json';

// 1回の実行で使ってよいクォータの上限（安全マージンを見て8000に設定）
const QUOTA_BUDGET = Number(process.env.YOUTUBE_COMMENT_QUOTA_BUDGET ?? 8000);
let unitsUsed = 0;

function loadJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  const content = readFileSync(path, 'utf-8').trim();
  return content === '' ? fallback : JSON.parse(content);
}

// 1動画分のコメントを取得し、新着分だけタイムスタンプ抽出する
async function fetchNewCommentsForVideo(video, cursor, existingCommentIds) {
  const knownCutoff = cursor[video.videoId]?.lastCheckedPublishedAt ?? null;
  const videoDurationSec = parseDurationToSeconds(video.duration);

  const newEntries = [];
  let newestSeenAt = knownCutoff;
  let pageToken = '';
  let reachedKnownComments = false;

  do {
    if (unitsUsed >= QUOTA_BUDGET) {
      console.log(`⚠️ クォータ予算(${QUOTA_BUDGET}ユニット)に達したため、この動画の途中で打ち切ります: ${video.title}`);
      break;
    }

    let data;
    try {
      data = await callYoutubeApi('commentThreads', {
        part: 'snippet',
        videoId: video.videoId,
        order: 'time',
        maxResults: 100,
        pageToken,
        key: API_KEY,
      });
      unitsUsed += 1;
    } catch (err) {
      if (err.reason === 'commentsDisabled' || err.reason === 'videoNotFound') {
        console.log(`  スキップ（${err.reason}）: ${video.title}`);
        return { newEntries: [], newestSeenAt };
      }
      throw err; // クォータ切れなど、想定外のエラーは上に投げて止める
    }

    for (const item of data.items) {
      const top = item.snippet.topLevelComment;
      const commentId = top.id;
      const publishedAt = top.snippet.publishedAt;

      // 前回処理済みの時点まで遡ったら、それ以降は全部既知なので打ち切り
      if (knownCutoff && publishedAt <= knownCutoff) {
        reachedKnownComments = true;
        break;
      }

      if (existingCommentIds.has(commentId)) continue; // 念のための二重防止

      const extracted = extractTimestamps(top.snippet.textOriginal, videoDurationSec);
      for (const { timestampSec, label } of extracted) {
        newEntries.push({
          videoId: video.videoId,
          commentId,
          timestampSec,
          label,
          likeCount: top.snippet.likeCount,
          publishedAt,
        });
      }

      if (!newestSeenAt || publishedAt > newestSeenAt) {
        newestSeenAt = publishedAt;
      }
    }

    pageToken = data.nextPageToken ?? '';
  } while (pageToken && !reachedKnownComments && unitsUsed < QUOTA_BUDGET);

  return { newEntries, newestSeenAt };
}

async function main() {
  const videos = loadJson(VIDEOS_PATH, []);
  const cursor = loadJson(CURSOR_PATH, {});
  const existingComments = loadJson(COMMENTS_PATH, []);
  const existingCommentIds = new Set(existingComments.map((c) => c.commentId));

  let allComments = existingComments;

  for (const video of videos) {
    if (unitsUsed >= QUOTA_BUDGET) {
      console.log('⚠️ クォータ予算に達したため、残りの動画は次回に持ち越します');
      break;
    }

    console.log(`処理中: ${video.title}`);
    const { newEntries, newestSeenAt } = await fetchNewCommentsForVideo(
      video,
      cursor,
      existingCommentIds
    );

    if (newEntries.length > 0) {
      allComments = [...allComments, ...newEntries];
      for (const e of newEntries) existingCommentIds.add(e.commentId);
      console.log(`  → ${newEntries.length}件の新規タイムスタンプを追加`);
    }

    if (newestSeenAt) {
      cursor[video.videoId] = { lastCheckedPublishedAt: newestSeenAt };
    }

    // ★重要：1動画終わるごとに毎回保存（途中で打ち切られても進捗を失わない）
    writeFileSync(COMMENTS_PATH, JSON.stringify(allComments, null, 2));
    writeFileSync(CURSOR_PATH, JSON.stringify(cursor, null, 2));
  }

  console.log(`完了。使用ユニット数（概算）: ${unitsUsed} / ${QUOTA_BUDGET}`);
  console.log(`タイムスタンプ総数: ${allComments.length}件`);
}

main().catch((err) => {
  console.error('fetch-comments.js でエラーが発生しました:', err.message);
  process.exit(1);
});