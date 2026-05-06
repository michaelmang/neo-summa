import fs from 'node:fs';
import path from 'node:path';

const PART_NAMES = {
  FP: 'Prima Pars',
  FS: 'Prima Secundae',
  SS: 'Secunda Secundae',
  TP: 'Tertia Pars',
  XP: 'Supplementum'
};

let cachedData;

export function getShareData() {
  if (!cachedData) {
    const filePath = path.join(process.cwd(), 'public', 'summa.json');
    cachedData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }

  return cachedData;
}

export function findShareArticle({ part, question, article }) {
  if (!part || !question || !article) return null;
  const data = getShareData();
  return data.articles.find(candidate =>
    candidate.part === part &&
    candidate.question === Number(question) &&
    candidate.article === Number(article)
  ) || null;
}

export function getArticleShareMeta(article) {
  if (!article) return getDefaultShareMeta();

  const partName = PART_NAMES[article.part] || article.part;
  const title = `${article.title} | Neo Summa Reader`;
  const label = `${partName} · Question ${article.question} · Article ${article.article}`;
  const description = getExcerpt(article.respondeo?.english || article.sedContra?.english || article.title);

  return {
    title,
    label,
    description,
    appPath: `/app/articles/${article.part}/${article.question}/${article.article}`,
    imagePath: `/api/og?part=${encodeURIComponent(article.part)}&question=${article.question}&article=${article.article}`
  };
}

export function getDefaultShareMeta() {
  return {
    title: 'Neo Summa Reader',
    label: 'A scholarly reader for Aquinas',
    description: 'Read the Summa with its questions, authorities, references, Latin text, and citation apparatus close at hand.',
    appPath: '/',
    imagePath: '/api/og'
  };
}

function getExcerpt(text = '') {
  return text
    .replace(/^I answer that,?\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 210);
}
