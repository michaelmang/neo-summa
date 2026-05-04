const WORK_ALIASES = [
  { pattern: /^(?:nicomachean\s+)?ethic(?:s)?\.?$/i, workId: 'aristotle-ethics' },
  { pattern: /^metaph(?:ys)?\.?$/i, workId: 'aristotle-metaphysics' },
  { pattern: /^metaphysics$/i, workId: 'aristotle-metaphysics' },
  { pattern: /^phys\.?$/i, workId: 'aristotle-physics' },
  { pattern: /^physics$/i, workId: 'aristotle-physics' },
  { pattern: /^de\s+anima$/i, workId: 'aristotle-de-anima' },
  { pattern: /^de\s+c[ao]elo$/i, workId: 'aristotle-de-caelo' },
  { pattern: /^peri\s*hermeneias$/i, workId: 'aristotle-peri-hermeneias' },
  { pattern: /^perihermeneias$/i, workId: 'aristotle-peri-hermeneias' }
];

export const IMPORTED_WORK_FIRST_PATTERN = /\b((?:Nicomachean\s+)?Ethic(?:s)?\.?|Metaph(?:ys)?\.?|Metaphysics|Phys\.?|Physics|De\s+Anima|De\s+C[ao]elo|Peri\s*Hermeneias|Perihermeneias)\s+([ivxlcdm]+)(?:,\s*((?:\d+\s*,?\s*)+))?/gi;
export const IMPORTED_BOOK_FIRST_PATTERN = /\b([ivxlcdm]+)\s+(Ethic(?:s)?\.?|Metaph(?:ys)?\.?|Metaphysics|Phys\.?|Physics|De\s+Anima|De\s+C[ao]elo|Peri\s*Hermeneias|Perihermeneias)\b/gi;

function romanToNumber(value = '') {
  const roman = value.toUpperCase();
  const numerals = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let total = 0;

  for (let index = 0; index < roman.length; index += 1) {
    const current = numerals[roman[index]] || 0;
    const next = numerals[roman[index + 1]] || 0;
    total += current < next ? -current : current;
  }

  return total || null;
}

function getWorkId(label) {
  return WORK_ALIASES.find(alias => alias.pattern.test(label.trim()))?.workId || null;
}

function getNumericTargets(value = '') {
  return [...value.matchAll(/\d+/g)].map(match => Number(match[0])).filter(Boolean);
}

function getArticleBook(article) {
  const anchor = article.source?.anchor || '';

  if (article.workId === 'aristotle-de-anima') {
    const match = anchor.match(/^(\d)/);
    return match ? Number(match[1]) : article.question;
  }

  if (article.workId === 'aristotle-de-caelo') {
    const match = anchor.match(/^(\d+)-/);
    return match ? Number(match[1]) : article.question;
  }

  if (article.workId === 'aristotle-peri-hermeneias') {
    return /^B/i.test(anchor) ? 2 : article.question;
  }

  return article.question;
}

function getParagraphPattern(target) {
  return new RegExp(`(^|\\s|["'“‘(])(?:§\\s*)?${target}[.]`);
}

function getImportedArticles(corpusData, workId) {
  return (corpusData?.articles || []).filter(article => article.workId === workId);
}

export function parseImportedCitationMatch(match, order = 'work-first') {
  const label = match[0];
  const workLabel = order === 'work-first' ? match[1] : match[2];
  const bookLabel = order === 'work-first' ? match[2] : match[1];
  const numericTargets = getNumericTargets(order === 'work-first' ? match[3] : '');

  return {
    label,
    workId: getWorkId(workLabel),
    book: romanToNumber(bookLabel),
    numericTargets
  };
}

export function resolveImportedCitation(corpusData, citation) {
  if (!citation?.workId || !citation.book) return null;

  const articles = getImportedArticles(corpusData, citation.workId);
  if (!articles.length) return null;

  const inBook = articles.filter(article => getArticleBook(article) === citation.book);
  const pool = inBook.length ? inBook : articles;
  const primaryTarget = citation.numericTargets[0];

  const exact = primaryTarget
    ? pool.find(article => article.article === primaryTarget)
    : pool[0];
  if (exact) return exact;

  for (const target of citation.numericTargets) {
    const paragraphPattern = getParagraphPattern(target);
    const paragraphHit = pool.find(article => paragraphPattern.test(article.respondeo?.english || ''));
    if (paragraphHit) return paragraphHit;
  }

  return pool[0] || null;
}
