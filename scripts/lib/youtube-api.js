const API_BASE = 'https://www.googleapis.com/youtube/v3';

export async function callYoutubeApi(endpoint, params) {
  const url = new URL(`${API_BASE}/${endpoint}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== '' && value !== undefined) {
      url.searchParams.set(key, value);
    }
  }

  const res = await fetch(url);
  const data = await res.json();

  if (!res.ok) {
    const reason = data?.error?.errors?.[0]?.reason ?? 'unknown';
    const err = new Error(`YouTube APIエラー(${reason}): ${data?.error?.message ?? res.statusText}`);
    err.reason = reason; // ★追加：呼び出し側で個別ハンドリングできるように
    if (reason === 'quotaExceeded') {
      err.message = 'YouTube APIの1日のクォータ(10,000ユニット)を使い切りました。日本時間で午後4-5時頃にリセットされるので、その後に再実行してください。';
    }
    throw err;
  }

  return data;
}