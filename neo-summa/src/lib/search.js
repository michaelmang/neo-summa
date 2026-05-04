const SEARCHABLE_SECTIONS = [
  'title',
  'objections',
  'sedContra',
  'respondeo',
  'replies',
  'authorities'
];

function normalizeText(text = '') {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

function getTerms(query, mode) {
  const normalized = normalizeText(query);
  if (!normalized) return [];
  return mode === 'exact' ? [normalized] : normalized.split(' ').filter(Boolean);
}

function matchesText(text, terms, mode) {
  const normalized = normalizeText(text);
  if (!terms.length) return false;
  if (mode === 'all') return terms.every(term => normalized.includes(term));
  return terms.some(term => normalized.includes(term));
}

function getSnippet(text, terms) {
  const cleanText = text.replace(/\s+/g, ' ').trim();
  if (!cleanText) return '';

  const lowerText = cleanText.toLowerCase();
  const firstIndex = terms.reduce((best, term) => {
    const index = lowerText.indexOf(term);
    if (index === -1) return best;
    return best === -1 ? index : Math.min(best, index);
  }, -1);
  const start = Math.max(0, (firstIndex === -1 ? 0 : firstIndex) - 70);
  const end = Math.min(cleanText.length, start + 220);
  const prefix = start > 0 ? '...' : '';
  const suffix = end < cleanText.length ? '...' : '';

  return `${prefix}${cleanText.slice(start, end)}${suffix}`;
}

function getArticleAuthorities(article) {
  return [
    ...(article.authoritiesAnswered || []),
    ...(article.authoritiesInvoked || []),
    ...(article.authoritiesDiscussed || [])
  ];
}

function getArticleSearchFields(article, language) {
  const includeEnglish = language === 'all' || language === 'english';
  const includeLatin = language === 'all' || language === 'latin';
  const fields = [
    { section: 'title', label: 'Title', language: 'english', text: article.title },
    { section: 'title', label: 'Work', language: 'english', text: article.workTitle }
  ];

  for (const objection of article.objections || []) {
    if (includeEnglish) fields.push({ section: 'objections', label: `Objection ${objection.number}`, language: 'english', text: objection.english });
    if (includeLatin) fields.push({ section: 'objections', label: `Objection ${objection.number}`, language: 'latin', text: objection.latin });
  }

  if (includeEnglish) fields.push({ section: 'sedContra', label: 'Sed contra', language: 'english', text: article.sedContra?.english });
  if (includeLatin) fields.push({ section: 'sedContra', label: 'Sed contra', language: 'latin', text: article.sedContra?.latin });
  if (includeEnglish) fields.push({ section: 'respondeo', label: 'Respondeo', language: 'english', text: article.respondeo?.english });
  if (includeLatin) fields.push({ section: 'respondeo', label: 'Respondeo', language: 'latin', text: article.respondeo?.latin });

  for (const reply of article.replies || []) {
    if (includeEnglish) fields.push({ section: 'replies', label: `Reply ${reply.number}`, language: 'english', text: reply.english });
    if (includeLatin) fields.push({ section: 'replies', label: `Reply ${reply.number}`, language: 'latin', text: reply.latin });
  }

  fields.push({
    section: 'authorities',
    label: 'Authorities',
    language: 'english',
    text: getArticleAuthorities(article).map(authority => authority.name).join(' ')
  });

  return fields.filter(field => field.text);
}

export function getAuthorityOptions(data) {
  const names = new Set();
  for (const article of data?.articles || []) {
    for (const authority of getArticleAuthorities(article)) {
      names.add(authority.name);
    }
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

export function searchArticlesAdvanced(data, options = {}) {
  if (!data) return [];

  const {
    query = '',
    mode = 'all',
    part = 'all',
    workId = 'all',
    section = 'all',
    language = 'all',
    authority = 'all',
    limit = 80
  } = options;
  const terms = getTerms(query, mode);
  const requiresTextMatch = terms.length > 0;

  if (!requiresTextMatch && workId === 'all' && part === 'all' && section === 'all' && language === 'all' && authority === 'all') {
    return [];
  }

  const results = [];

  for (const article of data.articles || []) {
    if (workId !== 'all' && article.workId !== workId) continue;
    if (part !== 'all' && article.part !== part) continue;
    const authorities = getArticleAuthorities(article);
    if (authority !== 'all' && !authorities.some(entry => entry.name === authority)) continue;

    const fields = getArticleSearchFields(article, language).filter(field =>
      section === 'all' || field.section === section
    );
    const matchedFields = requiresTextMatch
      ? fields.filter(field => matchesText(field.text, terms, mode))
      : fields.slice(0, 1);

    if (!matchedFields.length) continue;

    results.push({
      article,
      matchedFields: matchedFields.slice(0, 4).map(field => ({
        label: field.label,
        language: field.language,
        snippet: getSnippet(field.text, terms)
      }))
    });

    if (results.length >= limit) break;
  }

  return results;
}

export { SEARCHABLE_SECTIONS };
