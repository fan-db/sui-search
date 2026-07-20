/**
 * ISO8601形式の動画時間（例: "PT1H2M15S"）を秒数に変換する。
 * 動画の長さを超えるタイムスタンプを誤検出として弾くために使う。
 */
export function parseDurationToSeconds(isoDuration) {
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const [, h, m, s] = match;
  return (Number(h) || 0) * 3600 + (Number(m) || 0) * 60 + (Number(s) || 0);
}

/**
 * コメント本文から「12:34」「1:02:15」のようなタイムスタンプ表記を抽出する。
 * - 1行につき最初に見つかった1つのタイムスタンプのみ対象（複数記載の行は今回は非対応）
 * - 動画の長さを超える数値は誤検出（例: 比率表記など）として除外する
 *
 * 戻り値: [{ timestampSec: number, label: string }, ...]
 */
export function extractTimestamps(commentText, videoDurationSec) {
  const results = [];
  const lines = commentText.split(/\r?\n/);

  const pattern = /\b(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\b/;

  for (const line of lines) {
    const match = line.match(pattern);
    if (!match) continue;

    const [fullMatch, hours, minutes, seconds] = match;
    const timestampSec =
      (Number(hours) || 0) * 3600 + Number(minutes) * 60 + Number(seconds);

    // 動画の長さを超えていたら誤検出とみなして除外（多少の余裕を持たせる）
    if (timestampSec > videoDurationSec + 5) continue;

    const label = line.replace(fullMatch, '').replace(/^[\s\-:：]+/, '').trim();
    if (label.length === 0) continue; // ラベルが空なら検索対象として意味がないので除外

    results.push({ timestampSec, label });
  }

  return results;
}