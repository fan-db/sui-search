
export function extractNumbering(description, title) {
  const match = title.match(/【第(\d+)回】/);
  return match ? match[1] : null;
}