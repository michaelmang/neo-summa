const BOOK_ALIASES = [
  ['Genesis', 'gn', /^(?:gen(?:esis)?\.?)$/i],
  ['Exodus', 'ex', /^(?:ex(?:od(?:us)?)?\.?)$/i],
  ['Psalms', 'ps', /^(?:ps\.?|psalm(?:s)?\.?)$/i],
  ['Isaiah', 'is', /^(?:is\.|isa(?:iah)?\.?)$/i],
  ['Jeremiah', 'jr', /^(?:jer(?:emiah)?\.?)$/i],
  ['Ezekiel', 'ez', /^(?:ez(?:ek)?\.?|ezech(?:iel)?\.?)$/i],
  ['Daniel', 'dn', /^(?:dan(?:iel)?\.?)$/i],
  ['Matthew', 'mt', /^(?:mt\.?|matt(?:hew)?\.?)$/i],
  ['Mark', 'mk', /^(?:mk\.?|mark)$/i],
  ['Luke', 'lk', /^(?:lk\.?|luke)$/i],
  ['John', 'jo', /^(?:jn\.?|john)$/i],
  ['Acts', 'act', /^(?:acts?|act\.?)$/i],
  ['Romans', 'rm', /^(?:rm\.?|rom(?:ans)?\.?)$/i],
  ['Galatians', 'gl', /^(?:gal(?:atians)?\.?)$/i],
  ['Ephesians', 'eph', /^(?:eph(?:esians)?\.?)$/i],
  ['Philippians', 'ph', /^(?:phil(?:ippians)?\.?)$/i],
  ['Colossians', 'cl', /^(?:col(?:ossians)?\.?)$/i],
  ['Hebrews', 'hb', /^(?:heb(?:rews)?\.?)$/i],
  ['James', 'jm', /^(?:jas\.?|james)$/i],
  ['Jude', 'jd', /^(?:jude|jd\.?)$/i],
  ['Revelation', 're', /^(?:rev(?:elation)?\.?|apoc(?:alypse)?\.?)$/i]
];

const NUMBERED_BOOKS = [
  ['Samuel', ['1sm', '2sm']],
  ['Kings', ['1kgs', '2kgs']],
  ['Chronicles', ['1ch', '2ch']],
  ['Corinthians', ['1co', '2co']],
  ['Thessalonians', ['1ts', '2ts']],
  ['Timothy', ['1tm', '2tm']],
  ['Peter', ['1pe', '2pe']],
  ['John', ['1jo', '2jo', '3jo']]
];

export const BIBLE_REF_PATTERN = /\b((?:(?:[123]|I{1,3})\s*)?(?:Gen(?:esis)?\.?|Ex(?:od(?:us)?)?\.?|Ps\.?|Psalm(?:s)?\.?|Isa(?:iah)?\.?|Is\.|Jer(?:emiah)?\.?|Ezek(?:iel)?\.?|Ezech(?:iel)?\.?|Dan(?:iel)?\.?|Matt(?:hew)?\.?|Mt\.?|Mark|Mk\.?|Luke|Lk\.?|John|Jn\.?|Acts?|Rom(?:ans)?\.?|Rm\.?|Cor(?:inthians)?\.?|Gal(?:atians)?\.?|Eph(?:esians)?\.?|Phil(?:ippians)?\.?|Col(?:ossians)?\.?|Thess(?:alonians)?\.?|Tim(?:othy)?\.?|Heb(?:rews)?\.?|James|Jas\.?|Peter|Pet\.?|Jude|Rev(?:elation)?\.?|Apoc(?:alypse)?\.?))\s+([ivxlcdm]+|\d+)(?![a-z])\s*:\s*(\d+(?:-\d+)?)(?![a-z])/gi;

function romanToNumber(value = '') {
  if (/^\d+$/.test(value)) return Number(value);

  const numerals = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  const roman = value.toUpperCase();
  let total = 0;

  for (let index = 0; index < roman.length; index += 1) {
    const current = numerals[roman[index]] || 0;
    const next = numerals[roman[index + 1]] || 0;
    total += current < next ? -current : current;
  }

  return total || null;
}

function getOrdinalPrefix(label) {
  const match = label.trim().match(/^(1|2|3|I{1,3})\s+/i);
  if (!match) return null;
  return romanToNumber(match[1]);
}

function stripOrdinalPrefix(label) {
  return label.trim().replace(/^(1|2|3|I{1,3})\s+/i, '');
}

function getBookAbbrev(label) {
  const ordinal = getOrdinalPrefix(label);
  const bareLabel = stripOrdinalPrefix(label);

  if (ordinal) {
    const numbered = NUMBERED_BOOKS.find(([name]) => new RegExp(`^${name}|^${name.slice(0, 3)}\\.?`, 'i').test(bareLabel));
    return numbered?.[1][ordinal - 1] || null;
  }

  return BOOK_ALIASES.find(([, , pattern]) => pattern.test(bareLabel))?.[1] || null;
}

function cleanVerseText(text = '') {
  return text
    .replace(/\s*\{[^{}:]+:\s*[^{}]*\}/g, '')
    .replace(/\{([^{}]+)\}/g, '$1')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseBibleCitationMatch(match) {
  const label = match[0];
  const bookAbbrev = getBookAbbrev(match[1]);
  const chapter = romanToNumber(match[2]);
  const verseLabel = match[3] || '';
  const [startVerse, endVerse] = verseLabel.split('-').map(value => Number(value)).filter(Boolean);

  return {
    label,
    bookAbbrev,
    chapter,
    startVerse: startVerse || null,
    endVerse: endVerse || startVerse || null
  };
}

export function resolveBibleCitation(bibleData, citation) {
  if (!bibleData || !citation?.bookAbbrev || !citation.chapter) return null;

  const book = bibleData.find(entry => entry.abbrev === citation.bookAbbrev);
  const chapter = book?.chapters?.[citation.chapter - 1];
  if (!book || !chapter) return null;

  const startVerse = citation.startVerse || 1;
  const endVerse = citation.endVerse || chapter.length;
  const verses = chapter.slice(startVerse - 1, endVerse).map((text, index) => ({
    number: startVerse + index,
    text: cleanVerseText(text)
  }));

  if (!verses.length) return null;

  return {
    label: citation.label,
    book: book.name,
    chapter: citation.chapter,
    startVerse,
    endVerse,
    verses
  };
}
