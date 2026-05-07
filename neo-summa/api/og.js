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
  const titleLines = wrapText(meta.title.replace(/\s+\|\s+Neo Summa Reader$/, ''), 36, 3);
  const descriptionLines = wrapText(meta.description, 68, 3);
  const titleStartY = titleLines.length > 2 ? 212 : 236;
  const descriptionStartY = titleStartY + titleLines.length * 58 + 54;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" viewBox="0 0 1200 630" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="paper-shadow" x="-10%" y="-14%" width="120%" height="130%" color-interpolation-filters="sRGB">
      <feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#000000" flood-opacity="0.28"/>
    </filter>
    <linearGradient id="paper" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FFF9EC"/>
      <stop offset="100%" stop-color="#F3EBDD"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="#1F1C17"/>
  <rect x="36" y="36" width="1128" height="558" fill="#EFE7D8" filter="url(#paper-shadow)"/>
  <rect x="72" y="72" width="1056" height="486" fill="url(#paper)" stroke="#D3C4AA" stroke-width="2"/>
  <path d="M116 134H1084" stroke="#B9864E" stroke-width="3"/>
  <text x="116" y="118" fill="#8A4F21" font-family="Inter, system-ui, sans-serif" font-size="29" font-weight="800" letter-spacing="5">${escapeXml(meta.label.toUpperCase())}</text>
  ${titleLines.map((line, index) => `<text x="116" y="${titleStartY + index * 58}" fill="#17130F" font-family="Georgia, serif" font-size="54" font-weight="600">${escapeXml(line)}</text>`).join('')}
  ${descriptionLines.map((line, index) => `<text x="116" y="${descriptionStartY + index * 34}" fill="#5F594F" font-family="Inter, system-ui, sans-serif" font-size="27">${escapeXml(line)}</text>`).join('')}
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
