const ROMAN_VALUES = { i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000 };

const THOMAS_WORKS = [
  {
    id: 'scg',
    title: 'Summa Contra Gentiles',
    pattern: /\b(?:I|II|III|IV)\s+Cont\.\s*Gent\./i,
    labelPattern: /\b(I|II|III|IV)\s+Cont\.\s*Gent\.\s*,?\s*cap\.?\s*([^;]+)/i,
    getRef: (match) => ({
      label: `Summa Contra Gentiles ${match[1]}, c. ${formatNumberList(match[2])}`,
      path: `/thomas/source/ContraGentiles${romanToInt(match[1])}.htm`,
      anchor: firstNumber(match[2]),
      anchors: referenceNumbers(match[2])
    })
  },
  {
    id: 'de-veritate',
    title: 'Disputed Questions on Truth',
    pattern: /\bDe\s+Verit\./i,
    labelPattern: /\bDe\s+Verit\.\s*,?\s*(?:qu|q)\.?\s*([ivxlcdm\d]+)\s*,\s*(?:art|a)\.?\s*([^;]+)/i,
    getRef: (match) => ({
      label: `Disputed Questions on Truth q. ${formatNumber(match[1])}, a. ${formatNumberList(match[2])}`,
      path: `/thomas/source/QDdeVer${formatNumber(match[1])}.htm`,
      anchor: firstNumber(match[2]),
      anchors: referenceNumbers(match[2])
    })
  },
  {
    id: 'de-potentia',
    title: 'Disputed Questions on the Power of God',
    pattern: /\bDe\s+Pot\./i,
    labelPattern: /\bDe\s+Pot\.\s*,?\s*(?:qu|q)\.?\s*([ivxlcdm\d]+)\s*,\s*(?:art|a)\.?\s*([^;]+)/i,
    getRef: (match) => ({
      label: `Disputed Questions on the Power of God q. ${formatNumber(match[1])}, a. ${formatNumberList(match[2])}`,
      path: `/thomas/source/QDdePotentia${formatNumber(match[1])}.htm`,
      anchor: firstNumber(match[2]),
      anchors: referenceNumbers(match[2])
    })
  },
  {
    id: 'boethius-trinity',
    title: 'Commentary on Boethius De Trinitate',
    pattern: /\bBoet\.\s+de\s+Trin\./i,
    labelPattern: /\b(?:in\s+)?Boet\.\s+de\s+Trin\.\s*,?\s*(?:qu|q)\.?\s*([ivxlcdm\d]+)\s*,\s*(?:art|a)\.?\s*([^;]+)/i,
    getRef: (match) => ({
      label: `Commentary on Boethius De Trinitate q. ${formatNumber(match[1])}, a. ${formatNumberList(match[2])}`,
      path: '/thomas/source/BoethiusDeTr.htm',
      anchor: firstNumber(match[2]),
      anchors: referenceNumbers(match[2])
    })
  },
  {
    id: 'compendium',
    title: 'Compendium of Theology',
    pattern: /\bCompend\.\s*T/i,
    labelPattern: /\bCompend\.\s*T\w+\.?\s*,?\s*cap\.?\s*([^;]+)/i,
    getRef: (match) => ({
      label: `Compendium of Theology c. ${formatNumberList(match[1])}`,
      path: '/thomas/source/Compendium.htm',
      anchor: firstNumber(match[1]),
      anchors: referenceNumbers(match[1])
    })
  },
  {
    id: 'de-ente',
    title: 'On Being and Essence',
    pattern: /\b(?:de\s+)?Ent\.\s+et\s+Ess\./i,
    labelPattern: /\b(?:de\s+)?Ent\.\s+et\s+Ess\.\s*,?\s*cap\.?\s*([^;]+)/i,
    getRef: (match) => ({
      label: `On Being and Essence c. ${formatNumberList(match[1])}`,
      path: '/thomas/source/DeEnte&Essentia.htm',
      anchor: firstNumber(match[1]),
      anchors: referenceNumbers(match[1])
    })
  }
];

const SUMMA_LABELS = [
  ['I-II', 'FS'],
  ['II-II', 'SS'],
  ['III', 'TP'],
  ['Suppl.', 'XP'],
  ['Suppl', 'XP'],
  ['I', 'FP']
];

export function getLeonineDisplayTitle(article) {
  return titleCase(article?.title || '');
}

export function formatLeonineNote(note = '') {
  return parseLeonineCitations(note).map(entry => entry.label).join('; ');
}

export function parseLeonineCitations(note = '') {
  const cleaned = cleanNote(note);
  return cleaned
    .split(';')
    .map(segment => parseCitationSegment(segment.trim()))
    .filter(Boolean);
}

export function formatLeonineSource(apparatus = {}) {
  const volume = apparatus.volume?.includes('04')
    ? 'Leonine Edition, Volume IV'
    : apparatus.volume?.includes('5')
      ? 'Leonine Edition, Volume V'
      : apparatus.volume?.includes('06')
        ? 'Leonine Edition, Volume VI'
        : apparatus.volume?.includes('07')
          ? 'Leonine Edition, Volume VII'
          : apparatus.volume?.includes('08')
            ? 'Leonine Edition, Volume VIII'
            : apparatus.volume?.includes('09')
              ? 'Leonine Edition, Volume IX'
              : apparatus.volume?.includes('10')
                ? 'Leonine Edition, Volume X'
                : apparatus.volume?.includes('11')
                  ? 'Leonine Edition, Volume XI'
                  : apparatus.volume?.includes('12')
                    ? 'Leonine Edition, Volume XII'
                    : 'Leonine Edition';

  return volume;
}

function parseCitationSegment(segment) {
  if (!segment) return null;
  const normalized = normalizeSegment(segment);
  const summaRef = parseSummaRef(normalized);
  if (summaRef) return summaRef;

  for (const work of THOMAS_WORKS) {
    const match = segment.match(work.labelPattern);
    if (!match) continue;
    return {
      type: 'thomas',
      workId: work.id,
      workTitle: work.title,
      ...work.getRef(match),
      raw: segment
    };
  }

  return {
    type: 'text',
    label: formatPlainCitation(segment),
    raw: segment
  };
}

function parseSummaRef(segment) {
  const match = segment.match(/^(I-II|II-II|III|Suppl\.?|I)["']?\s*,?\s*q\.?\s*([ivxlcdm\d]+)\s*,\s*a\.?\s*([^;]+)/i);
  if (!match) return null;
  const part = SUMMA_LABELS.find(([label]) => label.toUpperCase() === match[1].toUpperCase())?.[1];
  const question = parseNumber(match[2]);
  const articles = getNumbers(match[3]);
  if (!question || !articles.length) return null;

  return {
    type: 'summa',
    label: `${part} Q.${question} ${articles.length > 1 ? 'AA' : 'A'}.${articles.join(', ')}`,
    part,
    question,
    articles,
    raw: segment
  };
}

function cleanNote(note) {
  return note
    .replace(/\bir\s*II["']?/gi, 'I-II')
    .replace(/\br\s*II["']?/gi, 'I-II')
    .replace(/\bI\*\s*II["']?/gi, 'I-II')
    .replace(/\bII\*\s*II["']?/gi, 'II-II')
    .replace(/\bI['"]?\s*II['"]?/gi, 'I-II')
    .replace(/\bII['"]?\s*II['"]?/gi, 'II-II')
    .replace(/\bqu[,.\s]+n\b/gi, 'q. 2')
    .replace(/\bqu[,.\s]+/gi, 'q. ')
    .replace(/\bqu\.\s*/gi, 'q. ')
    .replace(/\bart[,.\s]+/gi, 'a. ')
    .replace(/\bart\.\s*/gi, 'a. ')
    .replace(/\bcap[,.\s]+/gi, 'cap. ')
    .replace(/\bcap\.\s*/gi, 'cap. ')
    .replace(/\bdist[,.\s]+/gi, 'dist. ')
    .replace(/\bdist\.\s*/gi, 'dist. ')
    .replace(/,,/g, ',')
    .replace(/\s*-\s*,\s*/g, ' ')
    .replace(/[■►»]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:])/g, '$1')
    .trim();
}

function normalizeSegment(segment) {
  return cleanNote(segment)
    .replace(/\bI\s+Cont\.\s*Gent\./gi, 'SCG I')
    .replace(/\bII\s+Cont\.\s*Gent\./gi, 'SCG II')
    .replace(/\bIII\s+Cont\.\s*Gent\./gi, 'SCG III')
    .replace(/\bIV\s+Cont\.\s*Gent\./gi, 'SCG IV')
    .replace(/\bart\./gi, 'a.')
    .replace(/\bqu\./gi, 'q.');
}

function formatPlainCitation(segment) {
  return normalizeRomanLabels(
    cleanNote(segment)
      .replace(/\bI\s+Cont\.\s*Gent\./gi, 'Summa Contra Gentiles I')
      .replace(/\bII\s+Cont\.\s*Gent\./gi, 'Summa Contra Gentiles II')
      .replace(/\bIII\s+Cont\.\s*Gent\./gi, 'Summa Contra Gentiles III')
      .replace(/\bIV\s+Cont\.\s*Gent\./gi, 'Summa Contra Gentiles IV')
      .replace(/\bDe\s+Verit\./gi, 'Disputed Questions on Truth')
      .replace(/\bDe\s+Pot\./gi, 'Disputed Questions on the Power of God')
      .replace(/\bCont\.\s*Gent\./gi, 'Summa Contra Gentiles')
      .replace(/\bCompend\.\s*T\w+\./gi, 'Compendium of Theology')
      .replace(/\bBoet\.\s+de\s+Trin\./gi, 'Commentary on Boethius De Trinitate')
      .replace(/\bEnt\.\s+et\s+Ess\./gi, 'On Being and Essence')
      .replace(/\bq\.\s*/gi, 'q. ')
      .replace(/\ba\.\s*/gi, 'a. ')
      .replace(/\bcap\.\s*/gi, 'c. ')
      .replace(/\bdist\.\s*/gi, 'd. ')
      .replace(/\bProl\b\.?/gi, 'Prologue')
  );
}

function normalizeRomanLabels(text) {
  let normalized = text.replace(
    /\b(q|a|c|d|lect)\.\s*([ivxlcdm]+)(?=\b|[,.;])/gi,
    (_, label, roman) => `${label.toLowerCase()}. ${romanToInt(roman)}`
  );

  let previous;
  do {
    previous = normalized;
    normalized = normalized.replace(
      /(\b(?:q|a|c|d|lect)\.\s*(?:\d+|[ivxlcdm]+)(?:\s*,\s*(?:\d+|[ivxlcdm]+))*\s*,\s*)([ivxlcdm]+)\b/gi,
      (_, prefix, roman) => `${prefix}${romanToInt(roman)}`
    );
  } while (normalized !== previous);

  return normalized;
}

function formatNumberList(raw) {
  const numbers = getNumbers(primaryReferenceRange(raw));
  return numbers.length ? numbers.join(', ') : normalizeRomanLabels(raw).replace(/\.$/, '').trim();
}

function firstNumber(raw) {
  return getNumbers(primaryReferenceRange(raw))[0] || null;
}

function referenceNumbers(raw) {
  return getNumbers(primaryReferenceRange(raw));
}

function primaryReferenceRange(raw = '') {
  return raw.split(/\s*,?\s+(?:ad|in)\b/i)[0];
}

function getNumbers(raw = '') {
  return [...raw.matchAll(/\b([ivxlcdm]+|\d+)\b/gi)]
    .map(match => parseNumber(match[1]))
    .filter(Boolean);
}

function formatNumber(raw) {
  return parseNumber(raw) || raw;
}

function parseNumber(raw = '') {
  if (/^\d+$/.test(raw.trim())) return Number(raw);
  return romanToInt(raw);
}

function romanToInt(raw = '') {
  let total = 0;
  let previous = 0;
  const roman = raw.toLowerCase().replace(/j/g, 'i').replace(/[^ivxlcdm]/g, '');

  for (let index = roman.length - 1; index >= 0; index -= 1) {
    const value = ROMAN_VALUES[roman[index]] || 0;
    if (value < previous) {
      total -= value;
    } else {
      total += value;
      previous = value;
    }
  }

  return total || null;
}

function titleCase(text) {
  const lowerWords = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'nor', 'of', 'on', 'or', 'the', 'to', 'with']);
  return text
    .toLowerCase()
    .split(/\s+/)
    .map((word, index, words) => {
      if (index > 0 && index < words.length - 1 && lowerWords.has(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}
