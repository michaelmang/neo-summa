import { findShareArticle, getArticleShareMeta, getDefaultShareMeta } from './_shareData.js';

export default function handler(req, res) {
  const article = findShareArticle(req.query || {});
  const meta = article ? getArticleShareMeta(article) : getDefaultShareMeta();
  const svg = renderOgSvg(meta);

  res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800');
  return res.status(200).send(svg);
}

function renderOgSvg(meta) {
  const titleLines = wrapText(meta.title.replace(/\s+\|\s+Neo Summa Reader$/, ''), 34, 3);
  const descriptionLines = wrapText(meta.description, 64, 3);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" viewBox="0 0 1200 630" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#1F1C17"/>
  <rect x="48" y="48" width="1104" height="534" fill="#F4F0E7"/>
  <rect x="84" y="84" width="1032" height="462" fill="#FFF9EC" stroke="#D4C4AC" stroke-width="2"/>
  <path d="M126 139H1074" stroke="#B9864E" stroke-width="3"/>
  <text x="126" y="125" fill="#8A4F21" font-family="Inter, Arial, sans-serif" font-size="30" font-weight="800" letter-spacing="4">${escapeXml(meta.label.toUpperCase())}</text>
  ${titleLines.map((line, index) => `<text x="126" y="${235 + index * 64}" fill="#17130F" font-family="Georgia, serif" font-size="56" font-weight="600">${escapeXml(line)}</text>`).join('')}
  ${descriptionLines.map((line, index) => `<text x="126" y="${432 + index * 34}" fill="#5F594F" font-family="Inter, Arial, sans-serif" font-size="28">${escapeXml(line)}</text>`).join('')}
  <text x="126" y="527" fill="#8A4F21" font-family="Inter, Arial, sans-serif" font-size="28" font-weight="800">Neo Summa Reader</text>
  <text x="840" y="527" fill="#8A4F21" font-family="Georgia, serif" font-size="56" font-weight="600">Summa</text>
</svg>`;
}

function wrapText(text, maxLength, maxLines) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxLength && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }

    if (lines.length === maxLines) break;
  }

  if (current && lines.length < maxLines) lines.push(current);
  if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) {
    lines[maxLines - 1] = `${lines[maxLines - 1].replace(/[.,;:!?]$/, '')}...`;
  }

  return lines;
}

function escapeXml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
