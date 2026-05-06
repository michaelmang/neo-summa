import { findShareArticle, getArticleShareMeta, getDefaultShareMeta } from './_shareData.js';

export default function handler(req, res) {
  const article = findShareArticle(req.query || {});
  const meta = article ? getArticleShareMeta(article) : getDefaultShareMeta();
  const origin = getOrigin(req);
  const appUrl = new URL(meta.appPath, origin).toString();
  const imageUrl = new URL(meta.imagePath, origin).toString();
  const shareUrl = article
    ? new URL(`/share/articles/${article.part}/${article.question}/${article.article}`, origin).toString()
    : new URL('/share', origin).toString();

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400');
  return res.status(200).send(renderShareHtml({ ...meta, appUrl, imageUrl, shareUrl }));
}

function renderShareHtml({ title, description, appUrl, imageUrl, shareUrl }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <link rel="canonical" href="${escapeAttribute(appUrl)}" />
    <meta name="description" content="${escapeAttribute(description)}" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="Neo Summa Reader" />
    <meta property="og:title" content="${escapeAttribute(title)}" />
    <meta property="og:description" content="${escapeAttribute(description)}" />
    <meta property="og:url" content="${escapeAttribute(shareUrl)}" />
    <meta property="og:image" content="${escapeAttribute(imageUrl)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeAttribute(title)}" />
    <meta name="twitter:description" content="${escapeAttribute(description)}" />
    <meta name="twitter:image" content="${escapeAttribute(imageUrl)}" />
    <script>setTimeout(function(){ window.location.replace(${JSON.stringify(appUrl)}); }, 250);</script>
  </head>
  <body style="font-family: Georgia, serif; background:#f4f0e7; color:#1d1b18; padding:2rem;">
    <main style="max-width:720px;">
      <p style="font-family:Arial,sans-serif; color:#8a4f21; font-weight:700; letter-spacing:.08em; text-transform:uppercase;">Neo Summa Reader</p>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(description)}</p>
      <p><a href="${escapeAttribute(appUrl)}">Open in the reader</a></p>
    </main>
  </body>
</html>`;
}

function getOrigin(req) {
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${protocol}://${host}`;
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttribute(value = '') {
  return escapeHtml(value).replace(/"/g, '&quot;');
}
