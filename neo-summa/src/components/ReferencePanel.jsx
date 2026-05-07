import { useEffect, useState } from 'react';
import {
  IMPORTED_BOOK_FIRST_PATTERN,
  IMPORTED_WORK_FIRST_PATTERN,
  parseImportedCitationMatch,
  resolveImportedCitation
} from '../lib/importedCitations';
import {
  BIBLE_REF_PATTERN,
  parseBibleCitationMatch,
  resolveBibleCitation
} from '../lib/bibleCitations';

function getReferenceParagraphs(text = '') {
  return text
    .replace(/\s+(?=(?:§\s*)?\d+[.]\s)/g, '\n')
    .split(/\n+/)
    .map(paragraph => paragraph.trim())
    .filter(Boolean);
}

function getHtmlParagraphs(html = '', anchor) {
  const document = new DOMParser().parseFromString(html, 'text/html');
  const anchorElement = anchor
    ? document.getElementById(String(anchor)) || document.querySelector(`a[name="${anchor}"]`)
    : null;
  const tableParagraphs = getAnchoredTableParagraphs(anchorElement);
  if (tableParagraphs.length) return tableParagraphs;
  const followingParagraphs = getFollowingAnchorParagraphs(document, anchorElement);
  if (followingParagraphs.length) return followingParagraphs;
  const anchorParagraphs = getAnchorTextParagraphs(anchorElement);
  if (anchorParagraphs.length) return anchorParagraphs;

  const root = anchorElement?.parentElement || document.body;
  const text = root.textContent || document.body.textContent || '';

  return text
    .replace(/\s+/g, ' ')
    .replace(/(\d+[.]\s)/g, '\n$1')
    .split(/\n+/)
    .map(paragraph => paragraph.trim())
    .filter(Boolean)
    .slice(0, 14);
}

function getFollowingAnchorParagraphs(document, anchorElement) {
  if (!anchorElement) return [];

  const nextAnchor = getNextNamedAnchor(document, anchorElement);
  if (!nextAnchor) return [];

  const range = document.createRange();
  range.setStartAfter(anchorElement);
  range.setEndBefore(nextAnchor);

  const container = document.createElement('div');
  container.append(range.cloneContents());

  const paragraphs = [...container.querySelectorAll('p')]
    .map(paragraph => cleanHtmlText(paragraph.textContent || ''))
    .filter(Boolean)
    .filter(paragraph => !/^ARTICLE\s/i.test(paragraph))
    .slice(0, 18);

  if (paragraphs.length) return paragraphs;

  return cleanHtmlText(container.textContent || '')
    .replace(/\s+(?=(?:Article|Sub-question|SOLUTION|ON THE CONTRARY|Ad\s+\d|To the)\b)/g, '\n')
    .split(/\n+/)
    .map(paragraph => paragraph.trim())
    .filter(Boolean)
    .slice(0, 18);
}

function getNextNamedAnchor(document, anchorElement) {
  const anchors = [...document.querySelectorAll('a[name], a[id]')];
  const currentIndex = anchors.indexOf(anchorElement);
  if (currentIndex < 0) return null;

  return anchors.slice(currentIndex + 1).find(anchor =>
    (anchor.getAttribute('name') || anchor.id) !== (anchorElement.getAttribute('name') || anchorElement.id)
  ) || null;
}

function getAnchorTextParagraphs(anchorElement) {
  if (!anchorElement) return [];
  const text = cleanHtmlText(anchorElement.textContent || '');
  if (!text) return [];

  return text
    .replace(/\s+(?=(?:Article|Sub-question|SOLUTION|ON THE CONTRARY|Ad\s+\d|To the)\b)/g, '\n')
    .split(/\n+/)
    .map(paragraph => paragraph.trim())
    .filter(Boolean)
    .slice(0, 18);
}

function getAnchoredTableParagraphs(anchorElement) {
  const table = anchorElement?.closest('table');
  if (!table) return [];

  return [...table.querySelectorAll('tr')]
    .map(row => {
      const cells = [...row.querySelectorAll('td')];
      const englishCell = cells.length > 1 ? cells[cells.length - 1] : cells[0];
      return cleanHtmlText(englishCell?.textContent || '');
    })
    .filter(Boolean)
    .filter((paragraph, index, paragraphs) => paragraph !== paragraphs[index - 1])
    .slice(0, 18);
}

function cleanHtmlText(text = '') {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\[\s*(\d+)\s*\]/g, '[$1]')
    .trim();
}

function renderImportedRef(match, corpusData, onOpenReference, keyPrefix) {
  const type = match.type;
  const citation = parseImportedCitationMatch(match.match, type === 'imported-work-first' ? 'work-first' : 'book-first');
  const target = resolveImportedCitation(corpusData, citation);
  const label = match.match[0];

  if (!target?.source?.href) return label;

  return (
    <button
      key={keyPrefix}
      type="button"
      className="inline-citation-link inline-imported-citation quick-tooltip"
      onClick={() => onOpenReference?.({
        type: 'imported',
        label,
        article: target
      })}
      data-tooltip={`${target.workTitle} · ${target.headingLabel || `Lecture ${target.article}`}: ${target.title}`}
      aria-label={`${label}: ${target.workTitle}, ${target.title}`}
    >
      {label}
    </button>
  );
}

function renderBibleRef(match, bibleData, onOpenReference, keyPrefix) {
  const citation = parseBibleCitationMatch(match.match);
  const target = resolveBibleCitation(bibleData, citation);
  const label = match.match[0];

  if (!target) return label;

  return (
    <button
      key={keyPrefix}
      type="button"
      className="inline-citation-link inline-bible-citation quick-tooltip"
      onClick={() => onOpenReference?.({
        type: 'bible',
        label,
        ...target
      })}
      data-tooltip={`${target.book} ${target.chapter}:${target.startVerse}${target.endVerse !== target.startVerse ? `-${target.endVerse}` : ''}`}
      aria-label={`${label}: ${target.book} ${target.chapter}`}
    >
      {label}
    </button>
  );
}

function getPanelReferenceMatches(text) {
  const matches = [
    ...[...text.matchAll(IMPORTED_WORK_FIRST_PATTERN)].map(match => ({
      match,
      type: 'imported-work-first',
      index: match.index,
      end: match.index + match[0].length
    })),
    ...[...text.matchAll(IMPORTED_BOOK_FIRST_PATTERN)].map(match => ({
      match,
      type: 'imported-book-first',
      index: match.index,
      end: match.index + match[0].length
    })),
    ...[...text.matchAll(BIBLE_REF_PATTERN)].map(match => ({
      match,
      type: 'bible',
      index: match.index,
      end: match.index + match[0].length
    }))
  ].sort((a, b) => a.index - b.index || b.end - a.end);

  const accepted = [];
  let cursor = -1;

  for (const match of matches) {
    if (match.index < cursor) continue;
    accepted.push(match);
    cursor = match.end;
  }

  return accepted;
}

function LinkedReferenceText({ text, corpusData, bibleData, onOpenReference }) {
  if (!text) return null;

  const nodes = [];
  let lastIndex = 0;

  for (const entry of getPanelReferenceMatches(text)) {
    const { index, end, type } = entry;
    const label = entry.match[0];

    if (index > lastIndex) {
      nodes.push(text.slice(lastIndex, index));
    }

    nodes.push(type === 'bible'
      ? renderBibleRef(entry, bibleData, onOpenReference, `${index}-${label}`)
      : renderImportedRef(entry, corpusData, onOpenReference, `${index}-${label}`));

    lastIndex = end;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

function getReferenceScope(corpusData, article) {
  if (!article?.workId) return [];

  const articles = (corpusData?.articles || []).filter(candidate =>
    candidate.workId === article.workId &&
    candidate.question === article.question
  );

  return articles.length ? articles : (corpusData?.articles || []).filter(candidate => candidate.workId === article.workId);
}

function ReferenceNavigator({ article, corpusData, onOpenReference, position }) {
  const scope = getReferenceScope(corpusData, article);
  const currentIndex = scope.findIndex(candidate => candidate.id === article.id);
  const previous = currentIndex > 0 ? scope[currentIndex - 1] : null;
  const next = currentIndex >= 0 && currentIndex < scope.length - 1 ? scope[currentIndex + 1] : null;

  if (scope.length <= 1) return null;

  function openArticle(nextArticle) {
    onOpenReference?.({
      type: 'imported',
      label: nextArticle.headingLabel || `Lecture ${nextArticle.article}`,
      article: nextArticle
    });
  }

  return (
    <div className={`reference-panel-nav reference-panel-nav-${position}`}>
      <button type="button" onClick={() => previous && openArticle(previous)} disabled={!previous}>
        Prev
      </button>
      <select
        value={article.id}
        onChange={event => {
          const selected = scope.find(candidate => candidate.id === event.target.value);
          if (selected) openArticle(selected);
        }}
        aria-label="Move within reference"
      >
        {scope.map(candidate => (
          <option key={candidate.id} value={candidate.id}>
            {candidate.headingLabel || `Lecture ${candidate.article}`} · {candidate.title}
          </option>
        ))}
      </select>
      <button type="button" onClick={() => next && openArticle(next)} disabled={!next}>
        Next
      </button>
    </div>
  );
}

function ImportedWorkReference({ article, corpusData, bibleData, onOpenReference }) {
  const paragraphs = getReferenceParagraphs(article.respondeo?.english);

  return (
    <div className="reference-panel-body">
      <div className="reference-panel-kicker">{article.workTitle}</div>
      <h3>{article.title}</h3>
      <div className="reference-panel-meta">
        {article.headingLabel || `Lecture ${article.article}`}
        {article.source?.file ? ` · ${article.source.file}` : ''}
      </div>
      <ReferenceNavigator article={article} corpusData={corpusData} onOpenReference={onOpenReference} position="top" />
      <div className="reference-panel-paragraphs">
        {paragraphs.map((paragraph, index) => (
          <p key={`${index}-${paragraph.slice(0, 16)}`}>
            <LinkedReferenceText text={paragraph} corpusData={corpusData} bibleData={bibleData} onOpenReference={onOpenReference} />
          </p>
        ))}
      </div>
      <ReferenceNavigator article={article} corpusData={corpusData} onOpenReference={onOpenReference} position="bottom" />
    </div>
  );
}

function BibleReference({ reference }) {
  const range = reference.startVerse === reference.endVerse
    ? `${reference.chapter}:${reference.startVerse}`
    : `${reference.chapter}:${reference.startVerse}-${reference.endVerse}`;

  return (
    <div className="reference-panel-body">
      <div className="reference-panel-kicker">King James Version</div>
      <h3>{reference.book} {range}</h3>
      <div className="reference-panel-verses">
        {reference.verses.map(verse => (
          <p key={verse.number}>
            <sup>{verse.number}</sup>
            {verse.text}
          </p>
        ))}
      </div>
    </div>
  );
}

function ThomasWorkReference({ reference, corpusData, bibleData, onOpenReference }) {
  const referenceKey = `${reference.path}#${reference.anchor || ''}`;
  const [state, setState] = useState({ key: referenceKey, paragraphs: [], error: '' });
  const loading = state.key !== referenceKey;

  useEffect(() => {
    let cancelled = false;

    fetch(reference.path)
      .then(response => {
        if (!response.ok) throw new Error('Reference source not found');
        return response.text();
      })
      .then(html => {
        if (!cancelled) {
          setState({
            key: referenceKey,
            paragraphs: getHtmlParagraphs(html, reference.anchor),
            error: ''
          });
        }
      })
      .catch(error => {
        if (!cancelled) {
          setState({ key: referenceKey, paragraphs: [], error: error.message });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [reference.path, reference.anchor, referenceKey]);

  return (
    <div className="reference-panel-body">
      <div className="reference-panel-kicker">{reference.workTitle || 'Thomas Aquinas'}</div>
      <h3>{reference.label}</h3>
      {loading ? <p>Loading reference...</p> : null}
      {!loading && state.error ? <p>{state.error}</p> : null}
      {!loading && state.paragraphs.length ? (
        <div className="reference-panel-paragraphs">
          {state.paragraphs.map((paragraph, index) => (
            <p key={`${index}-${paragraph.slice(0, 16)}`}>
              <LinkedReferenceText text={paragraph} corpusData={corpusData} bibleData={bibleData} onOpenReference={onOpenReference} />
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function ReferencePanel({ reference, onClose, corpusData, bibleData, canGoBack = false, onOpenReference, onBack }) {
  if (!reference) return null;

  return (
    <aside className="reference-panel" aria-label="Reference panel">
      <div className="reference-panel-header">
        <div>
          <span className="reference-panel-label">Reference</span>
          <strong>{reference.label}</strong>
        </div>
        <div className="reference-panel-actions">
          {canGoBack ? (
            <button type="button" className="reference-panel-action" onClick={onBack}>
              Back
            </button>
          ) : null}
          <button type="button" className="reference-panel-close" onClick={onClose} aria-label="Close reference panel">
            Close
          </button>
        </div>
      </div>
      {reference.type === 'bible' ? (
        <BibleReference reference={reference} />
      ) : reference.type === 'thomas' ? (
        <ThomasWorkReference reference={reference} corpusData={corpusData} bibleData={bibleData} onOpenReference={onOpenReference} />
      ) : (
        <ImportedWorkReference article={reference.article} corpusData={corpusData} bibleData={bibleData} onOpenReference={onOpenReference} />
      )}
    </aside>
  );
}
