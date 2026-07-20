import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';

function loadJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  const content = readFileSync(path, 'utf-8').trim();
  return content === '' ? fallback : JSON.parse(content);
}

function isExcluded(value) {
  return String(value ?? '').trim().toUpperCase() === 'TRUE';
}

function parseCategories(value) {
  return String(value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function buildCategoryTree(configRows) {
  const invalidRow = configRows.find((r) => typeof r.category !== 'string');
  if (invalidRow) {
    throw new Error(
      'category-config.jsonの形式が想定と異なります。' +
      '.envのCATEGORY_CONFIG_CSV_URLが、正しく"category-config"タブを指しているか確認してください。' +
      `(問題のある行: ${JSON.stringify(invalidRow)})`
    );
  }

  const mains = configRows
    .filter((r) => !r.parent || r.parent.trim() === '')
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));

  return mains.map((main) => {
    const mainName = main.category.trim();
    const subCategories = configRows
      .filter((r) => r.parent && r.parent.trim() === mainName)
      .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
      .map((r) => r.category.trim());
    return { name: mainName, subCategories };
  });
}

function findUncategorized(videos, configRows) {
  const known = new Set(configRows.map((r) => r.category.trim()));
  const used = new Set();
  for (const v of videos) {
    for (const c of v.categories) used.add(c);
  }
  return [...used].filter((c) => !known.has(c)).sort();
}

function main() {
  const videosRaw = loadJson('data/videos-raw.json', []);
  const overridesRows = loadJson('data/overrides.json', []);
  const categoryConfigRows = loadJson('data/category-config.json', []);
  const commentsRaw = loadJson('data/comments-raw.json', []);

  const overridesByVideoId = new Map(overridesRows.map((r) => [r.videoId, r]));
  const excludedVideoIds = new Set();

  const videos = [];
  for (const raw of videosRaw) {
    const ov = overridesByVideoId.get(raw.videoId) ?? {};

    if (isExcluded(ov.exclude)) {
      excludedVideoIds.add(raw.videoId);
      continue;
    }

    videos.push({
      videoId: raw.videoId,
      title: raw.title,
      thumbnail: raw.thumbnail,
      url: raw.url,
      publishedAt: raw.publishedAt,
      numbering: (ov.numbering_confirmed || raw.numbering_ref || '').trim(),
      guest: (ov.guest_confirmed || '').trim(),
      categories: parseCategories(ov.category_confirmed),
      tags: (ov.tags || '').trim(),
      memo: (ov.memo || '').trim(),
    });
  }

  videos.sort((a, b) => (Number(b.numbering) || 0) - (Number(a.numbering) || 0));

  // 検索対象データ：除外動画は含めない。
  // ★重要：1つのコメントに複数タイムスタンプがある場合、commentIdが重複するため
  //         配列のインデックスを使って必ずユニークなidを生成する(MiniSearchのエラー対策)
  const comments = commentsRaw
    .filter((c) => !excludedVideoIds.has(c.videoId))
    .map((c, idx) => ({
      id: `${c.commentId}-${idx}`,
      videoId: c.videoId,
      commentId: c.commentId,
      timestampSec: c.timestampSec,
      label: c.label,
      likeCount: c.likeCount,
    }));

  const categoryTree = {
    mainCategories: buildCategoryTree(categoryConfigRows),
    uncategorized: findUncategorized(videos, categoryConfigRows),
  };

  mkdirSync('src/data', { recursive: true });
  mkdirSync('public/data', { recursive: true });

  const videosOutput = JSON.stringify({ videos, categoryTree }, null, 2);
  const commentsOutput = JSON.stringify({ entries: comments }, null, 2);

  writeFileSync('src/data/videos.json', videosOutput);
  writeFileSync('src/data/comments.json', commentsOutput);
  writeFileSync('public/data/videos.json', videosOutput);
  writeFileSync('public/data/comments.json', commentsOutput);

  console.log(`videos.json を生成（${videos.length}本、除外${excludedVideoIds.size}本）`);
  console.log(`comments.json を生成（${comments.length}件）`);
}

main();