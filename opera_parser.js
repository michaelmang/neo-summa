const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const DEFAULT_SOURCE_DIR = '/Users/michael.mangialardi/Downloads/AquinasOperaOmnia-master/english';
const DEFAULT_OUTPUT_DIR = path.join(__dirname, 'neo-summa/public/works');

const WORKS = [
  {
    id: 'aristotle-ethics',
    title: "Commentary on Aristotle's Nicomachean Ethics",
    code: 'ETHICS',
    files: ['Ethics1.htm', 'Ethics2.htm', 'Ethics3.htm', 'Ethics4.htm', 'Ethics5.htm', 'Ethics6.htm', 'Ethics7.htm', 'Ethics8.htm', 'Ethics9.htm', 'Ethics10.htm']
  },
  {
    id: 'aristotle-metaphysics',
    title: "Commentary on Aristotle's Metaphysics",
    code: 'METAPH',
    files: ['Metaphysics.htm', 'Metaphysics1.htm', 'Metaphysics2.htm', 'Metaphysics3.htm', 'Metaphysics4.htm', 'Metaphysics5.htm', 'Metaphysics6.htm', 'Metaphysics7.htm', 'Metaphysics8.htm', 'Metaphysics9.htm', 'Metaphysics10.htm', 'Metaphysics11.htm', 'Metaphysics12.htm']
  },
  {
    id: 'aristotle-physics',
    title: "Commentary on Aristotle's Physics",
    code: 'PHYS',
    files: ['Physics1.htm', 'Physics2.htm', 'Physics3.htm', 'Physics4.htm', 'Physics5.htm', 'Physics6.htm', 'Physics7.htm', 'Physics8.htm']
  },
  {
    id: 'aristotle-de-caelo',
    title: "Commentary on Aristotle's De Caelo",
    code: 'DCAELO',
    files: ['DeCoelo.htm']
  },
  {
    id: 'aristotle-de-anima',
    title: "Commentary on Aristotle's De Anima",
    code: 'DANIMA',
    files: ['DeAnima.htm']
  },
  {
    id: 'aristotle-peri-hermeneias',
    title: "Commentary on Aristotle's Peri Hermeneias",
    code: 'PERIHERM',
    files: ['PeriHermeneias.htm']
  }
];

const WORD_NUMBERS = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
  SIX: 6,
  SEVEN: 7,
  EIGHT: 8,
  NINE: 9,
  TEN: 10,
  ELEVEN: 11,
  TWELVE: 12,
  THIRTEEN: 13,
  FOURTEEN: 14,
  FIFTEEN: 15,
  SIXTEEN: 16,
  SEVENTEEN: 17,
  EIGHTEEN: 18,
  NINETEEN: 19,
  TWENTY: 20,
  'TWENTY-ONE': 21,
  'TWENTY-TWO': 22,
  'TWENTY-THREE': 23,
  'TWENTY-FOUR': 24,
  'TWENTY-FIVE': 25,
  'TWENTY-SIX': 26,
  'TWENTY-SEVEN': 27,
  'TWENTY-EIGHT': 28,
  'TWENTY-NINE': 29,
  THIRTY: 30
};

function normalizeText(text = '') {
  return text.replace(/\s+/g, ' ').trim();
}

function getBookNumber(filename) {
  const match = filename.match(/(\d+)\.htm$/i);
  return match ? Number(match[1]) : 1;
}

function getElementText($, element) {
  const clone = $(element).clone();
  clone.find('script, style').remove();
  clone.find('br').replaceWith('\n');
  return clone.text().split('\n').map(normalizeText).filter(Boolean).join('\n');
}

function getLinkedAnchorTitles($) {
  const titles = new Map();

  $('a[href*="#"]').each((_, link) => {
    const href = $(link).attr('href') || '';
    const anchor = href.split('#')[1];
    const title = normalizeText($(link).text());

    if (!anchor || !title || /^book\b/i.test(title) || /^commentary:\s*lectio\b/i.test(title)) return;
    titles.set(anchor, title);
  });

  return titles;
}

function isIgnoredText(text) {
  return !text ||
    /^contents$/i.test(text) ||
    /^table of contents$/i.test(text) ||
    /^by$/i.test(text) ||
    /^Thomas Aquinas$/i.test(text) ||
    /^commentary$/i.test(text) ||
    /^translated by/i.test(text) ||
    /^html/i.test(text);
}

function isAristotleTextHeading(text) {
  return /^ARISTOTLE['’]S TEXT\b/i.test(text);
}

function getHeadingKind(text) {
  if (/^(LECTURE|LESSON)\s+\d+/i.test(text)) return 'lecture';
  if (/^LECTIO\s+[A-Z-]+/i.test(text)) return 'lectio';
  if (/^PROLOGUE$/i.test(text)) return 'prologue';
  if (/^INTRODUCTION( BY (SAINT|ST\.?) THOMAS)?$/i.test(text)) return 'introduction';
  return '';
}

function getUnitNumber(text, fallback) {
  const digitMatch = text.match(/^(?:LECTURE|LESSON)\s+(\d+)/i);
  if (digitMatch) return Number(digitMatch[1]);

  const wordMatch = text.match(/^LECTIO\s+([A-Z-]+)/i);
  if (wordMatch) return WORD_NUMBERS[wordMatch[1].toUpperCase()] || fallback;

  return fallback;
}

function formatTitle(title) {
  const normalized = normalizeText(title);
  if (!normalized || normalized !== normalized.toUpperCase() || !/[A-Z]{4}/.test(normalized)) return normalized;

  const smallWords = new Set(['a', 'an', 'and', 'as', 'at', 'by', 'for', 'from', 'in', 'nor', 'of', 'on', 'or', 'the', 'to', 'with']);
  return normalized.toLowerCase().replace(/\b[a-z][a-z']*/g, (word, offset) => {
    if (offset > 0 && smallWords.has(word)) return word;
    return `${word.charAt(0).toUpperCase()}${word.slice(1)}`;
  });
}

function getUnitTitle(heading, nextText, kind, fallback, linkedTitle = '') {
  if (kind === 'prologue') return 'Prologue';
  if (kind === 'introduction') return 'Introduction';

  const titleFromHeading = heading
    .replace(/^(?:LECTURE|LESSON)\s+\d+(?:\s*\([^)]*\))?\s*[:.-]?\s*/i, '')
    .replace(/^LECTIO\s+[A-Z-]+(?:\s*[:.-])?\s*/i, '')
    .split('\n')
    .map(normalizeText)
    .filter(Boolean)
    .find(Boolean);

  if (titleFromHeading) return formatTitle(titleFromHeading);
  if (linkedTitle) return formatTitle(linkedTitle);
  if (kind === 'lectio') return fallback;

  const afterBreak = heading.split('\n').map(normalizeText).filter(Boolean)[1];
  if (afterBreak) return formatTitle(afterBreak);
  if (
    nextText &&
    !getHeadingKind(nextText) &&
    !/^chapter\b/i.test(nextText) &&
    !/^(§|\d+[a-z]\s+\d+)/i.test(nextText)
  ) {
    return formatTitle(nextText);
  }
  return fallback;
}

function getAnchorNear($, element) {
  const contained = $(element).find('a[name], a[id]').first();
  if (contained.length) return contained.attr('id') || contained.attr('name') || '';

  const direct = $(element).prevAll('a[name], a[id]').first();
  if (direct.length) return direct.attr('id') || direct.attr('name') || '';

  const previousContained = $(element).prevAll().find('a[name], a[id]').last();
  if (previousContained.length) return previousContained.attr('id') || previousContained.attr('name') || '';

  const parentPrevious = $(element).parent().prevAll('a[name], a[id]').first();
  if (parentPrevious.length) return parentPrevious.attr('id') || parentPrevious.attr('name') || '';

  const parentPreviousContained = $(element).parent().prevAll().find('a[name], a[id]').last();
  return parentPreviousContained.attr('id') || parentPreviousContained.attr('name') || '';
}

function parseFile(sourceDir, work, filename) {
  const filepath = path.join(sourceDir, filename);
  if (!fs.existsSync(filepath)) return [];

  const html = fs.readFileSync(filepath, 'utf8');
  const $ = cheerio.load(html);
  const linkedAnchorTitles = getLinkedAnchorTitles($);
  const elements = $('p, h1, h2, h3, center, b').toArray();
  const units = [];
  let current = null;
  let unitFallback = 1;
  const book = getBookNumber(filename);

  for (let index = 0; index < elements.length; index += 1) {
    const element = elements[index];
    if ($(element).parents('a[href]').length) continue;

    const text = getElementText($, element);
    const kind = getHeadingKind(text);

    if (kind) {
      if (current) units.push(current);

      const nextText = getElementText($, elements[index + 1]);
      const number = getUnitNumber(text, unitFallback);
      const headingLabel = kind === 'lecture' || kind === 'lectio'
        ? text.match(/^(LECTURE|LESSON)\s+\d+/i)?.[0] || `Lectio ${number}`
        : kind === 'prologue' ? 'Prologue' : 'Introduction';
      const sourceAnchor = getAnchorNear($, element);

      current = {
        number,
        headingLabel,
        title: getUnitTitle(text, nextText, kind, headingLabel, linkedAnchorTitles.get(sourceAnchor)),
        sourceFile: filename,
        sourceAnchor,
        body: [],
        skippingSourceText: false
      };
      unitFallback = number + 1;
      continue;
    }

    if (!current) continue;
    if (isAristotleTextHeading(text)) {
      current.skippingSourceText = true;
      continue;
    }
    if (current.skippingSourceText) {
      if (/^commentary$/i.test(text)) current.skippingSourceText = false;
      continue;
    }
    if (isIgnoredText(text)) continue;

    if (text === current.title || text === current.headingLabel) continue;
    current.body.push(text);
  }

  if (current) units.push(current);

  return units.map((unit, index) => ({
    id: `${work.id}:${filename.replace(/\.htm$/i, '').toLowerCase()}:${unit.sourceAnchor || unit.number || index + 1}`,
    workId: work.id,
    workTitle: work.title,
    part: work.code,
    question: book,
    article: unit.number || index + 1,
    headingLabel: unit.headingLabel,
    title: unit.title,
    source: {
      file: filename,
      anchor: unit.sourceAnchor,
      href: `/works/source/${filename}${unit.sourceAnchor ? `#${unit.sourceAnchor}` : ''}`
    },
    objections: [],
    sedContra: { latin: '', english: '' },
    respondeo: {
      latin: '',
      english: unit.body.join(' ')
    },
    replies: [],
    authoritiesAnswered: [],
    authoritiesInvoked: [],
    authoritiesDiscussed: [],
    outboundRefs: [],
    inboundRefs: []
  })).filter(article => article.respondeo.english);
}

function parseWork(sourceDir, work) {
  const articles = work.files.flatMap(filename => parseFile(sourceDir, work, filename));

  return {
    meta: {
      workId: work.id,
      title: work.title,
      code: work.code,
      source: sourceDir,
      totalArticles: articles.length,
      questions: work.files.map(filename => ({
        part: work.code,
        question: getBookNumber(filename),
        title: filename.replace(/\.htm$/i, ''),
        articleCount: articles.filter(article => article.source.file === filename).length
      }))
    },
    articles
  };
}

function writeManifest(outputDir, works) {
  const manifestPath = path.join(outputDir, 'manifest.json');
  const existing = fs.existsSync(manifestPath)
    ? JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    : { works: [] };
  const byId = new Map(existing.works.map(work => [work.id, work]));

  for (const work of works) {
    byId.set(work.id, {
      id: work.id,
      title: work.title,
      kind: 'article-collection',
      path: `/works/${work.id}.json`,
      routeBase: `/works/${work.id}`
    });
  }

  fs.writeFileSync(manifestPath, `${JSON.stringify({ works: [...byId.values()] }, null, 2)}\n`);
}

function copySourceFiles(sourceDir, outputDir, works) {
  const sourceOutputDir = path.join(outputDir, 'source');
  fs.mkdirSync(sourceOutputDir, { recursive: true });

  const filenames = new Set(works.flatMap(work => work.files));
  for (const filename of filenames) {
    const sourcePath = path.join(sourceDir, filename);
    const outputPath = path.join(sourceOutputDir, filename);
    if (fs.existsSync(sourcePath)) fs.copyFileSync(sourcePath, outputPath);
  }
}

function main() {
  const sourceDir = process.argv[2] || DEFAULT_SOURCE_DIR;
  const outputDir = process.argv[3] || DEFAULT_OUTPUT_DIR;
  fs.mkdirSync(outputDir, { recursive: true });

  const parsedWorks = [];

  for (const work of WORKS) {
    const parsed = parseWork(sourceDir, work);
    const outputPath = path.join(outputDir, `${work.id}.json`);
    fs.writeFileSync(outputPath, `${JSON.stringify(parsed, null, 2)}\n`);
    parsedWorks.push(work);
    console.log(`${work.title}: ${parsed.articles.length} units -> ${outputPath}`);
  }

  copySourceFiles(sourceDir, outputDir, parsedWorks);
  writeManifest(outputDir, parsedWorks);
}

if (require.main === module) {
  main();
}

module.exports = { parseWork, parseFile };
