const fs = require('fs');
const path = require('path');

const PARTS = ['FP', 'FS', 'SS', 'TP', 'XP'];
const DEFAULT_INPUT_DIR = '/Users/michael.mangialardi/Downloads/AquinasOperaOmnia-master/english/summa';
const DEFAULT_OUTPUT_FILE = path.join(__dirname, '..', 'public', 'parallel-passages.json');

const inputDir = process.argv[2] || DEFAULT_INPUT_DIR;
const outputFile = process.argv[3] || DEFAULT_OUTPUT_FILE;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function articleKey(article) {
  return `${article.part}:${article.question}:${article.article}`;
}

function normalizeWhitespace(text) {
  return text.replace(/\s+/g, ' ').trim();
}

function stripHtml(html) {
  return normalizeWhitespace(
    html
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
  );
}

function isValidTarget(index, target) {
  return index.has(articleKey(target));
}

function addPassage(passages, source, target, note, relation) {
  const key = articleKey(source);
  const targetKey = articleKey(target);
  if (key === targetKey) return;

  if (!passages.has(key)) passages.set(key, []);
  const existing = passages.get(key);
  if (existing.some(entry =>
    entry.part === target.part &&
    entry.question === target.question &&
    entry.article === target.article &&
    entry.relation === relation
  )) {
    return;
  }

  existing.push({
    part: target.part,
    question: target.question,
    article: target.article,
    relation,
    source: 'Benziger editorial cross-reference',
    note
  });
}

function getCfNotes(html) {
  return [
    ...html.matchAll(/\[\*Cf\.[\s\S]*?\]/gi),
    ...html.matchAll(/\(Cf\.[^)]+\)/gi)
  ].map(match => stripHtml(match[0]));
}

function getArticleTargets(note, fallbackPart) {
  const targets = [];
  const pattern = /(?:(FP|FS|SS|TP|XP),\s*)?Question\s*\[(\d+)\]\s*,\s*Articles?\s*((?:\[\d+\]|\d+)(?:\s*(?:,|and)\s*(?:\[\d+\]|\d+))*)/gi;

  for (const match of note.matchAll(pattern)) {
    const part = match[1] || fallbackPart;
    const question = Number(match[2]);
    const articleNumbers = [...match[3].matchAll(/\[?(\d+)\]?/g)].map(articleMatch => Number(articleMatch[1]));

    for (const article of articleNumbers) {
      targets.push({ part, question, article });
    }
  }

  return targets;
}

function getArticleSegments(html) {
  const anchorPattern = /<a\s+name="([A-Z0-9]+)Q(\d+)A(\d+)THEP1"[\s\S]*?<\/a>/gi;
  const anchors = [...html.matchAll(anchorPattern)];

  return anchors.map((anchor, index) => {
    const nextAnchor = anchors[index + 1];
    return {
      source: {
        part: anchor[1],
        question: Number(anchor[2]),
        article: Number(anchor[3])
      },
      html: html.slice(anchor.index, nextAnchor ? nextAnchor.index : html.length)
    };
  });
}

function sortPassages(entries) {
  return entries.sort((a, b) =>
    PARTS.indexOf(a.part) - PARTS.indexOf(b.part) ||
    a.question - b.question ||
    a.article - b.article ||
    a.relation.localeCompare(b.relation)
  );
}

function main() {
  const summaPath = path.join(__dirname, '..', 'public', 'summa.json');
  const summa = readJson(summaPath);
  const index = new Set(summa.articles.map(articleKey));
  const passages = new Map();

  for (const part of PARTS) {
    const partDir = path.join(inputDir, part);
    if (!fs.existsSync(partDir)) continue;

    const files = fs.readdirSync(partDir)
      .filter(file => file.endsWith('.html'))
      .sort()
      .map(file => path.join(partDir, file));

    for (const file of files) {
      const html = fs.readFileSync(file, 'utf8');

      for (const segment of getArticleSegments(html)) {
        if (!isValidTarget(index, segment.source)) continue;

        for (const note of getCfNotes(segment.html)) {
          for (const target of getArticleTargets(note, segment.source.part)) {
            if (!isValidTarget(index, target)) continue;

            addPassage(passages, segment.source, target, note, 'mentions');
            addPassage(passages, target, segment.source, note, 'mentioned-by');
          }
        }
      }
    }
  }

  const output = {
    generatedFrom: path.basename(path.dirname(path.dirname(inputDir))) === 'AquinasOperaOmnia-master'
      ? 'AquinasOperaOmnia-master/english/summa'
      : inputDir,
    description: 'Internal Summa parallels seeded from explicit Cf. cross-references in the source HTML. Entries are bidirectional so either side of the relation can surface the passage.',
    passages: Object.fromEntries(
      [...passages.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entries]) => [key, sortPassages(entries)])
    )
  };

  fs.writeFileSync(outputFile, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`Wrote ${Object.keys(output.passages).length} article passage groups to ${outputFile}`);
}

main();
