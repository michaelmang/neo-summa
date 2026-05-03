const fs = require('fs');
const path = require('path');
let cheerio = null;
try {
  cheerio = require('cheerio');
} catch (error) {
  if (require.main === module) throw error;
}

function walkHtml(dir) {
  let results = [];
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) {
      results = results.concat(walkHtml(full));
    } else if (entry.endsWith('.html')) {
      results.push(full);
    }
  }
  return results.sort();
}

function getPartCode(filepath) {
  const basename = path.basename(filepath);
  if (basename.startsWith('FP')) return 'FP';
  if (basename.startsWith('FS')) return 'FS';
  if (basename.startsWith('SS')) return 'SS';
  if (basename.startsWith('TP')) return 'TP';
  return null;
}

function parseArticle($, anchorEl) {
  const anchorId = $(anchorEl).attr('id') || $(anchorEl).attr('name') || '';

  const match = anchorId.match(/([A-Z0-9]+)Q(\d+)A(\d+)THEP1/);
  if (!match) return null;

  const part = match[1];
  const questionNum = parseInt(match[2]);
  const articleNum = parseInt(match[3]);

  const titleTag = $(anchorEl).nextAll('h3').first();
  const title = titleTag.text().trim().replace(/\n/g, ' ');

  const table = $(anchorEl).nextAll('table').first();
  if (!table.length) return null;

  const objections = [];
  const replies = [];
  let sedContraLatin = '';
  let sedContraEnglish = '';
  let respondeoLatin = '';
  let respondeoEnglish = '';

  // Track state for multi-row sections
  let inRespondeo = false;
  let inSedContra = false;
  const respondeoLatinParts = [];
  const respondeoEnglishParts = [];

  table.find('tr').each((_, row) => {
    const cells = $(row).find('td');
    if (cells.length < 2) return;

    const latin = $(cells[0]).text().trim();
    const english = $(cells[1]).text().trim();

    if (!english) return;

    // Detect section boundaries — these end any ongoing multi-row section
    const isObjection = /^Objection \d+[:.]/i.test(english);
    const isReply = /^Reply to Objection \d+[:.]/i.test(english);
    const isSedContra = /on the contrary/i.test(english);
    const isRespondeo = /I answer that/i.test(english);

    if (isObjection) {
      inRespondeo = false;
      inSedContra = false;
      const numMatch = english.match(/Objection (\d+)/i);
      objections.push({
        number: numMatch ? parseInt(numMatch[1]) : objections.length + 1,
        latin,
        english
      });
    } else if (isReply) {
      inRespondeo = false;
      inSedContra = false;
      const numMatch = english.match(/Reply to Objection (\d+)/i);
      replies.push({
        number: numMatch ? parseInt(numMatch[1]) : replies.length + 1,
        latin,
        english
      });
    } else if (isSedContra) {
      inRespondeo = false;
      inSedContra = true;
      sedContraLatin = latin;
      sedContraEnglish = english;
    } else if (isRespondeo) {
      inSedContra = false;
      inRespondeo = true;
      respondeoLatinParts.length = 0;
      respondeoEnglishParts.length = 0;
      respondeoLatinParts.push(latin);
      respondeoEnglishParts.push(english);
    } else if (inRespondeo) {
      // Continuation row of the Respondeo
      if (latin) respondeoLatinParts.push(latin);
      if (english) respondeoEnglishParts.push(english);
    } else if (inSedContra) {
      // Continuation row of Sed Contra (rare but possible)
      if (latin) sedContraLatin += ' ' + latin;
      if (english) sedContraEnglish += ' ' + english;
    }
  });

  // Join multi-row Respondeo
  respondeoLatin = respondeoLatinParts.join(' ');
  respondeoEnglish = respondeoEnglishParts.join(' ');

  const outboundRefs = [];

  table.find('a[href]').each((_, link) => {
    const href = $(link).attr('href');
    const hrefMatch = href.match(/([A-Z0-9]+)(\d+)\.html#([A-Z0-9]+)Q(\d+)A(\d+)/);
    if (hrefMatch) {
      const refQ = parseInt(hrefMatch[4]);
      const refA = parseInt(hrefMatch[5]);
      const refPart = hrefMatch[3];
      const ref = { question: refQ, article: refA, part: refPart };
      const isDuplicate = outboundRefs.some(r =>
        r.question === ref.question && r.article === ref.article && r.part === ref.part
      );
      if (!isDuplicate && !(refQ === questionNum && refA === articleNum)) {
        outboundRefs.push(ref);
      }
    }
  });

  const tableText = table.text();
  const inlineRefs = [...tableText.matchAll(/Question \[(\d+)\].*?Article \[(\d+)\]/g)];
  for (const ref of inlineRefs) {
    const refQ = parseInt(ref[1]);
    const refA = parseInt(ref[2]);
    const candidate = { question: refQ, article: refA, part };
    const isDuplicate = outboundRefs.some(r =>
      r.question === candidate.question && r.article === candidate.article
    );
    if (!isDuplicate && !(refQ === questionNum && refA === articleNum)) {
      outboundRefs.push(candidate);
    }
  }

  const authoritiesAnswered = aggregateAuthorityRefs(
    objections.map(objection => ({
      section: `Objection ${objection.number}`,
      text: objection.english
    }))
  );
  const authoritiesInvoked = aggregateAuthorityRefs(
    sedContraEnglish ? [{ section: 'Sed contra', text: sedContraEnglish }] : []
  );
  const authoritiesDiscussed = aggregateAuthorityRefs([
    respondeoEnglish ? { section: 'Respondeo', text: respondeoEnglish } : null,
    ...replies.map(reply => ({
      section: `Reply ${reply.number}`,
      text: reply.english
    }))
  ].filter(Boolean));

  return {
    id: anchorId,
    part,
    question: questionNum,
    article: articleNum,
    title,
    objections,
    sedContra: { latin: sedContraLatin, english: sedContraEnglish },
    respondeo: { latin: respondeoLatin, english: respondeoEnglish },
    replies,
    authoritiesAnswered,
    authoritiesInvoked,
    authoritiesDiscussed,
    outboundRefs,
    inboundRefs: []
  };
}

const AUTHORITY_NAMES = [
  'Albert',
  'Ambrose',
  'Anselm',
  'Aristotle',
  'Athanasius',
  'Augustine',
  'Avicenna',
  'Averroes',
  'Basil',
  'Bede',
  'Bernard',
  'Boethius',
  'Cassian',
  'Chrysostom',
  'Cicero',
  'Damascene',
  'Dionysius',
  'Gregory',
  'Hilary',
  'Hugh of St. Victor',
  'Isidore',
  'Jerome',
  'Maimonides',
  'Origen',
  'Plato',
  'Plotinus',
  'Porphyry',
  'Ptolemy',
  'Rabbi Moses',
  'Seneca',
  'Tully',
  'the Apostle',
  'the Commentator',
  'the Philosopher'
];

const SCRIPTURE_BOOKS = [
  'Acts', 'Apoc', 'Bar', 'Cant', 'Chron', 'Col', 'Cor', 'Dan', 'Deut',
  'Ecclus', 'Eph', 'Ex', 'Ezech', 'Gal', 'Gen', 'Heb', 'Isa', 'Jas',
  'Jer', 'Jn', 'Job', 'Joel', 'Lk', 'Mach', 'Mal', 'Mk', 'Mt', 'Num',
  'Pet', 'Phil', 'Prov', 'Ps', 'Rm', 'Rom', 'Thess', 'Tim', 'Titus',
  'Wis', 'Zach'
];

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeAuthorityName(name) {
  if (!name) return '';
  const cleaned = name
    .replace(/^as\s+/i, '')
    .replace(/^according to\s+/i, '')
    .replace(/^the\s+Rabbi Moses$/i, 'Rabbi Moses')
    .trim();
  if (/^(holy )?scripture$/i.test(cleaned)) return 'Sacred Scripture';
  if (/^the apostle$/i.test(cleaned)) return 'The Apostle Paul';
  if (/^the philosopher$/i.test(cleaned)) return 'Aristotle';
  if (/^the commentator$/i.test(cleaned)) return 'Averroes';
  if (/^rabbi moses$/i.test(cleaned)) return 'Maimonides';
  if (/^tully$/i.test(cleaned)) return 'Cicero';
  return cleaned.replace(/\b\w/g, c => c.toUpperCase()).replace(/\bOf\b/g, 'of');
}

function citationLooksScriptural(citation) {
  const firstToken = citation.replace(/^[1-4]\s*/, '').split(/[.\s]/)[0];
  return SCRIPTURE_BOOKS.some(book => book.toLowerCase() === firstToken.toLowerCase());
}

function inferAuthorityFromContext(context) {
  if (/it is written|holy scripture|scripture speaks|sacred scripture/i.test(context)) {
    return 'Sacred Scripture';
  }

  for (const name of AUTHORITY_NAMES) {
    const pattern = new RegExp(`(?:${escapeRegex(name)})\\s+(?:says|writes|states|remarks|observes|proves|teaches|taught|held|calls|declares|defines|argues)`, 'i');
    if (pattern.test(context)) return normalizeAuthorityName(name);
  }

  const accordingTo = context.match(new RegExp(`(?:according to|as)\\s+(${AUTHORITY_NAMES.map(escapeRegex).join('|')})`, 'i'));
  if (accordingTo) return normalizeAuthorityName(accordingTo[1]);

  return '';
}

function extractAuthorityRefs(text, section) {
  const refs = [];
  const seen = new Set();

  const addRef = (name, citation = '') => {
    const normalizedName = normalizeAuthorityName(name);
    if (!normalizedName) return;
    const normalizedCitation = citation.trim().replace(/\s+/g, ' ');
    const key = `${normalizedName}:${normalizedCitation}:${section}`;
    if (seen.has(key)) return;
    seen.add(key);
    refs.push({ name: normalizedName, citation: normalizedCitation, section });
  };

  if (/\bRabbi Moses(?:\s+the\s+Jew)?\b/i.test(text)) {
    addRef('Rabbi Moses');
  }

  const authorityPattern = AUTHORITY_NAMES.map(escapeRegex).join('|');
  const authorityVerbs = 'says|writes|states|remarks|observes|proves|teaches|taught|held|calls|declares|defines|argues|speaks|understands|excluded|maintained';

  const namedPattern = new RegExp(`\\b(${authorityPattern}|Holy Scripture|Scripture)(?:\\s+the\\s+Jew)?(?:\\s*\\([^)]*\\))?(?:,?\\s+[^.;:!?]{0,80})?\\s+(?:${authorityVerbs})`, 'gi');
  for (const match of text.matchAll(namedPattern)) {
    addRef(match[1]);
  }

  const accordingPattern = new RegExp(`\\b(?:according to|as|with)\\s+(?:the\\s+)?(${authorityPattern})\\b`, 'gi');
  for (const match of text.matchAll(accordingPattern)) {
    addRef(match[1]);
  }

  const passivePattern = new RegExp(`\\b(?:taught|held|maintained|observed|declared|given)\\s+by\\s+(?:the\\s+)?(${authorityPattern})\\b`, 'gi');
  for (const match of text.matchAll(passivePattern)) {
    addRef(match[1]);
  }

  const opinionPattern = new RegExp(`\\bopinion\\s+of\\s+(?:the\\s+)?(${authorityPattern})\\b`, 'gi');
  for (const match of text.matchAll(opinionPattern)) {
    addRef(match[1]);
  }

  for (const match of text.matchAll(/\(([^()]{2,90})\)/g)) {
    const citation = match[1].trim();
    if (/Question \[\d+\]|Article \[\d+\]/i.test(citation)) continue;

    const contextStart = Math.max(0, match.index - 140);
    const context = text.slice(contextStart, match.index);
    const inferred = inferAuthorityFromContext(context);
    if (inferred) {
      addRef(inferred, citation);
    } else if (citationLooksScriptural(citation)) {
      addRef('Sacred Scripture', citation);
    }
  }

  return refs;
}

function aggregateAuthorityRefs(entries) {
  const byName = new Map();

  for (const entry of entries) {
    for (const ref of extractAuthorityRefs(entry.text, entry.section)) {
      if (!byName.has(ref.name)) {
        byName.set(ref.name, {
          name: ref.name,
          count: 0,
          citations: [],
          sections: []
        });
      }

      const aggregate = byName.get(ref.name);
      aggregate.count += 1;
      if (ref.citation && !aggregate.citations.includes(ref.citation)) {
        aggregate.citations.push(ref.citation);
      }
      if (!aggregate.sections.includes(ref.section)) {
        aggregate.sections.push(ref.section);
      }
    }
  }

  return [...byName.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function buildAuthorityStats(articles) {
  const makeStats = (field) => {
    const stats = new Map();
    for (const article of articles) {
      for (const authority of article[field] || []) {
        if (!stats.has(authority.name)) {
          stats.set(authority.name, { name: authority.name, count: 0, articles: 0 });
        }
        const entry = stats.get(authority.name);
        entry.count += authority.count;
        entry.articles += 1;
      }
    }
    return [...stats.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  };

    return {
    answered: makeStats('authoritiesAnswered'),
    invoked: makeStats('authoritiesInvoked'),
    discussed: makeStats('authoritiesDiscussed')
  };
}

function parseFile($, filepath, partCode) {
  const basename = path.basename(filepath);
  const qMatch = basename.match(/(\d+)\.html/);
  const questionNum = qMatch ? parseInt(qMatch[1]) : 0;

  const qAnchor = $('a').filter((_, el) =>
    /[A-Z0-9]+Q\d+OUTP1/.test($(el).attr('id') || $(el).attr('name') || '')
  ).first();

  const questionTitle = qAnchor.length
    ? qAnchor.nextAll('h3').first().text().trim()
    : '';

  const articles = [];
  $('a').filter((_, el) =>
    /[A-Z0-9]+Q\d+A\d+THEP1/.test($(el).attr('id') || $(el).attr('name') || '')
  ).each((_, anchorEl) => {
    const article = parseArticle($, anchorEl);
    if (article) articles.push(article);
  });

  return { part: partCode, question: questionNum, title: questionTitle, articles };
}

function buildBidirectionalIndex(allArticles) {
  const lookup = {};
  for (const article of allArticles) {
    const key = `${article.part}:${article.question}:${article.article}`;
    lookup[key] = article;
  }

  for (const article of allArticles) {
    for (const ref of article.outboundRefs) {
      const targetKey = `${ref.part}:${ref.question}:${ref.article}`;
      if (lookup[targetKey]) {
        const inbound = {
          part: article.part,
          question: article.question,
          article: article.article,
          id: article.id
        };
        const alreadyLinked = lookup[targetKey].inboundRefs.some(r =>
          r.part === inbound.part &&
          r.question === inbound.question &&
          r.article === inbound.article
        );
        if (!alreadyLinked) {
          lookup[targetKey].inboundRefs.push(inbound);
        }
      }
    }
  }

  return Object.values(lookup);
}

function parseSumma(inputDir, outputFile) {
  if (!cheerio) {
    throw new Error('cheerio is required to parse HTML input');
  }

  const files = walkHtml(inputDir);
  console.log(`Found ${files.length} HTML files`);

  const allArticles = [];
  const allQuestions = [];

  for (const filepath of files) {
    const partCode = getPartCode(filepath);
    if (!partCode) continue;

    const html = fs.readFileSync(filepath, 'utf-8');
    const $ = cheerio.load(html);

    const question = parseFile($, filepath, partCode);

    if (question.articles.length) {
      allQuestions.push({
        part: question.part,
        question: question.question,
        title: question.title,
        articleCount: question.articles.length
      });
      allArticles.push(...question.articles);
      console.log(`  ${path.basename(filepath)}: Q.${question.question} — ${question.articles.length} articles`);
    }
  }

  console.log(`\nTotal articles parsed: ${allArticles.length}`);
  console.log('Building bidirectional citation index...');

  const indexed = buildBidirectionalIndex(allArticles);

  const totalOutbound = indexed.reduce((n, a) => n + a.outboundRefs.length, 0);
  const totalInbound = indexed.reduce((n, a) => n + a.inboundRefs.length, 0);

  const output = {
    meta: {
      totalQuestions: allQuestions.length,
      totalArticles: indexed.length,
      authorityStats: buildAuthorityStats(indexed),
      questions: allQuestions
    },
    articles: indexed
  };

  fs.writeFileSync(outputFile, JSON.stringify(output, null, 2), 'utf-8');

  console.log(`\nOutput written to ${outputFile}`);
  console.log(`Total questions: ${allQuestions.length}`);
  console.log(`Total articles: ${indexed.length}`);
  console.log(`Total outbound references: ${totalOutbound}`);
  console.log(`Total inbound references: ${totalInbound}`);
}

module.exports = {
  aggregateAuthorityRefs,
  buildAuthorityStats,
  extractAuthorityRefs,
  parseSumma
};

if (require.main === module) {
  const [,, inputDir, outputFile] = process.argv;
  if (!inputDir || !outputFile) {
    console.log('Usage: node summa_parser.js <input_directory> <output.json>');
    console.log('Example: node summa_parser.js ../summa summa.json');
    process.exit(1);
  }

  parseSumma(inputDir, outputFile);
}
