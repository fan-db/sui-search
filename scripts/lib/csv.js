import Papa from 'papaparse';

/**
 * 公開されたスプシのCSV URLを取得し、ヘッダー行をキーとした
 * オブジェクトの配列にパースする。
 *
 * URLの末尾に毎回変わる値をくっつけることで、Google側のCDNキャッシュを
 * 回避し、常に最新のスプシの内容を取得できるようにしている。
 */
export async function fetchAndParseCsv(url) {
  const cacheBustUrl = `${url}${url.includes('?') ? '&' : '?'}_cb=${Date.now()}`;

  const res = await fetch(cacheBustUrl, {
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`CSV取得に失敗しました (status: ${res.status}): ${url}`);
  }
  const text = await res.text();
  const { data } = Papa.parse(text, { header: true, skipEmptyLines: true });
  return data;
}