import { useEffect, useState } from 'react';

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

function ImportedWorkReference({ article, corpusData, onOpenReference }) {
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
          <p key={`${index}-${paragraph.slice(0, 16)}`}>{paragraph}</p>
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

function ThomasWorkReference({ reference }) {
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
            <p key={`${index}-${paragraph.slice(0, 16)}`}>{paragraph}</p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function ReferencePanel({ reference, onClose, corpusData, onOpenReference }) {
  if (!reference) return null;

  return (
    <aside className="reference-panel" aria-label="Reference panel">
      <div className="reference-panel-header">
        <div>
          <span className="reference-panel-label">Reference</span>
          <strong>{reference.label}</strong>
        </div>
        <button type="button" className="reference-panel-close" onClick={onClose} aria-label="Close reference panel">
          Close
        </button>
      </div>
      {reference.type === 'bible' ? (
        <BibleReference reference={reference} />
      ) : reference.type === 'thomas' ? (
        <ThomasWorkReference reference={reference} />
      ) : (
        <ImportedWorkReference article={reference.article} corpusData={corpusData} onOpenReference={onOpenReference} />
      )}
    </aside>
  );
}
