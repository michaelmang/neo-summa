function getReferenceParagraphs(text = '') {
  return text
    .replace(/\s+(?=(?:§\s*)?\d+[.]\s)/g, '\n')
    .split(/\n+/)
    .map(paragraph => paragraph.trim())
    .filter(Boolean);
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
      {article.source?.href ? (
        <a className="reference-panel-source" href={article.source.href}>
          Open source HTML
        </a>
      ) : null}
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
      ) : (
        <ImportedWorkReference article={reference.article} corpusData={corpusData} onOpenReference={onOpenReference} />
      )}
    </aside>
  );
}
