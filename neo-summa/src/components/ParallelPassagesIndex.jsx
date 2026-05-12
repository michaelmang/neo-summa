import { useMemo, useState } from 'react';
import {
  formatLeonineSource,
  getRenderableLeonineCitations
} from '../lib/leonineApparatus';
import { formatQuestionTitle } from '../lib/questionTitles';

function getQuestionMap(data) {
  const currentTrailByPart = new Map();
  const map = new Map();

  for (const question of [...data.meta.questions].sort((a, b) => a.part.localeCompare(b.part) || a.question - b.question)) {
    const { heading, headingLines, title } = formatQuestionTitle(question.title);
    const previousTrail = currentTrailByPart.get(question.part) || [];
    let sectionTrail = previousTrail;

    if (headingLines.length > 0) {
      const startsBroadSection = /^(TREATISE|SECOND PART|FIRST PART|THIRD PART)\b/i.test(headingLines[0]);
      sectionTrail = startsBroadSection || previousTrail.length === 0
        ? headingLines
        : [previousTrail[0], ...headingLines];
      currentTrailByPart.set(question.part, sectionTrail);
    }

    map.set(`${question.part}:${question.question}`, {
      ...question,
      category: sectionTrail[0] || '',
      sectionTrail,
      heading,
      headingLines,
      title
    });
  }

  return map;
}

function getEntries(data, questionMap) {
  return data.articles
    .map(article => ({
      article,
      question: questionMap.get(`${article.part}:${article.question}`),
      citations: article.leonineApparatus?.note ? getRenderableLeonineCitations(article.leonineApparatus.note) : [],
      parallelPassages: article.parallelPassages || []
    }))
    .filter(entry => entry.citations.length || entry.parallelPassages.length);
}

function getCitationSummary(entry) {
  const citationLabels = entry.citations.map(citation => citation.label);
  const passageLabels = entry.parallelPassages.map(passage =>
    `${passage.part} Q.${passage.question} A.${passage.article}`
  );

  return [...citationLabels, ...passageLabels].join('; ');
}

function CitationLink({ citation, onNavigate, onOpenReference, resolveArticle }) {
  if (citation.type === 'summa') {
    return (
      <>
        {citation.articles.map((articleNumber, index) => {
          const targetArticle = resolveArticle?.(citation.part, citation.question, articleNumber);

          return (
            <span key={`${citation.part}-${citation.question}-${articleNumber}`}>
              {index > 0 ? <span className="reference-separator">, </span> : null}
              <button
                type="button"
                className="leonine-citation-link quick-tooltip"
                onClick={() => onNavigate(citation.part, citation.question, articleNumber)}
                data-tooltip={targetArticle
                  ? `${citation.part} Q.${citation.question} A.${articleNumber}: ${targetArticle.title}`
                  : `Go to ${citation.part} Q.${citation.question} A.${articleNumber}`}
              >
                {citation.part} Q.{citation.question} A.{articleNumber}
              </button>
            </span>
          );
        })}
      </>
    );
  }

  if (citation.type === 'thomas') {
    const anchors = citation.anchors?.length ? citation.anchors : [citation.anchor].filter(Boolean);

    if (anchors.length > 1) {
      return (
        <>
          {anchors.map((anchor, index) => (
            <span key={`${citation.path}-${anchor}`}>
              {index > 0 ? <span className="reference-separator">, </span> : null}
              <ThomasCitationButton
                citation={citation}
                label={getThomasCitationLabel(citation, anchor)}
                anchor={anchor}
                onOpenReference={onOpenReference}
              />
            </span>
          ))}
        </>
      );
    }

    return (
      <ThomasCitationButton
        citation={citation}
        label={citation.label}
        anchor={citation.anchor}
        onOpenReference={onOpenReference}
      />
    );
  }

  return null;
}

function ThomasCitationButton({ citation, label, anchor, onOpenReference }) {
  return (
    <button
      type="button"
      className="leonine-citation-link leonine-external-link"
      onClick={() => onOpenReference?.({
        type: 'thomas',
        label,
        workTitle: citation.workTitle,
        path: citation.path,
        anchor
      })}
    >
      {label}
    </button>
  );
}

function getThomasCitationLabel(citation, anchor) {
  const marker = ['scg', 'compendium', 'de-ente'].includes(citation.workId) ? 'c.' : 'a.';
  const pattern = new RegExp(`${escapeRegExp(marker)}\\s*.*$`, 'i');
  const prefix = citation.label.match(pattern)
    ? citation.label.replace(pattern, `${marker} `)
    : `${citation.label} `;

  return `${prefix}${anchor}`;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getPartOptions(entries, partNames) {
  const parts = [...new Set(entries.map(entry => entry.article.part))];
  return parts.map(part => ({
    part,
    label: partNames[part] || part,
    count: entries.filter(entry => entry.article.part === part).length
  }));
}

function getCategoryOptions(entries, selectedPart) {
  const categories = new Map();

  for (const entry of entries) {
    if (selectedPart !== 'all' && entry.article.part !== selectedPart) continue;
    for (const heading of entry.question?.sectionTrail || []) {
      if (!heading) continue;
      categories.set(heading, (categories.get(heading) || 0) + 1);
    }
  }

  return [...categories.entries()]
    .map(([heading, count]) => ({ heading, count }))
    .sort((a, b) => a.heading.localeCompare(b.heading));
}

function getQuestionOptions(entries, selectedPart, selectedCategory) {
  const questions = new Map();

  for (const entry of entries) {
    const question = entry.question;
    if (!question) continue;
    if (selectedPart !== 'all' && entry.article.part !== selectedPart) continue;
    if (selectedCategory !== 'all' && !question.sectionTrail.includes(selectedCategory)) continue;

    const key = `${entry.article.part}:${entry.article.question}`;
    if (!questions.has(key)) {
      questions.set(key, {
        key,
        part: entry.article.part,
        question: entry.article.question,
        title: question.title,
        count: 0
      });
    }

    questions.get(key).count += 1;
  }

  return [...questions.values()].sort((a, b) => a.part.localeCompare(b.part) || a.question - b.question);
}

function filterEntries(entries, filters) {
  const { selectedPart, selectedCategory, selectedQuestion, query } = filters;
  const normalizedQuery = query.trim().toLowerCase();

  return entries.filter(entry => {
    const article = entry.article;
    const question = entry.question;
    const matchesPart = selectedPart === 'all' || article.part === selectedPart;
    const matchesCategory = selectedCategory === 'all' || question?.sectionTrail.includes(selectedCategory);
    const matchesQuestion = selectedQuestion === 'all' || `${article.part}:${article.question}` === selectedQuestion;
    const matchesQuery = !normalizedQuery || [
      `${article.part} q.${article.question} a.${article.article}`,
      article.title,
      question?.title,
      question?.category,
      ...(question?.sectionTrail || []),
      getCitationSummary(entry)
    ].join(' ').toLowerCase().includes(normalizedQuery);

    return matchesPart && matchesCategory && matchesQuestion && matchesQuery;
  });
}

export default function ParallelPassagesIndex({ data, partNames, resolveArticle, onNavigate, onOpenReference, onBack }) {
  const questionMap = useMemo(() => getQuestionMap(data), [data]);
  const entries = useMemo(() => getEntries(data, questionMap), [data, questionMap]);
  const partOptions = useMemo(() => getPartOptions(entries, partNames), [entries, partNames]);
  const [query, setQuery] = useState('');
  const [selectedPart, setSelectedPart] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedQuestion, setSelectedQuestion] = useState('all');
  const [selectedId, setSelectedId] = useState(entries[0]?.article.id || '');
  const categoryOptions = useMemo(
    () => getCategoryOptions(entries, selectedPart),
    [entries, selectedPart]
  );
  const questionOptions = useMemo(
    () => getQuestionOptions(entries, selectedPart, selectedCategory),
    [entries, selectedPart, selectedCategory]
  );
  const filteredEntries = useMemo(
    () => filterEntries(entries, { selectedPart, selectedCategory, selectedQuestion, query }),
    [entries, selectedPart, selectedCategory, selectedQuestion, query]
  );

  const activeEntry = filteredEntries.find(entry => entry.article.id === selectedId) || filteredEntries[0];
  if (!entries.length) return null;

  const activeArticle = activeEntry?.article;

  return (
    <div className="authority-index parallel-index">
      <aside className="authority-index-list">
        <div className="authority-index-intro">
          <h2>Parallel Passages</h2>
          <p>Browse the Leonine apparatus and related Summa passages by article.</p>
        </div>

        <input
          className="authority-search"
          placeholder="Filter passages..."
          value={query}
          onChange={event => setQuery(event.target.value)}
        />

        <div className="parallel-filter-stack">
          <label>
            <span>Part</span>
            <select
              value={selectedPart}
              onChange={event => {
                setSelectedPart(event.target.value);
                setSelectedCategory('all');
                setSelectedQuestion('all');
              }}
            >
              <option value="all">All parts</option>
              {partOptions.map(option => (
                <option key={option.part} value={option.part}>
                  {option.part} · {option.label} ({option.count})
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Theme</span>
            <select
              value={selectedCategory}
              onChange={event => {
                setSelectedCategory(event.target.value);
                setSelectedQuestion('all');
              }}
              disabled={categoryOptions.length === 0}
            >
              <option value="all">All themes</option>
              {categoryOptions.map(option => (
                <option key={option.heading} value={option.heading}>
                  {option.heading} ({option.count})
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Question</span>
            <select
              value={selectedQuestion}
              onChange={event => setSelectedQuestion(event.target.value)}
              disabled={questionOptions.length === 0}
            >
              <option value="all">All questions</option>
              {questionOptions.map(option => (
                <option key={option.key} value={option.key}>
                  {option.part} Q.{option.question} · {option.title} ({option.count})
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="authority-list-scroll">
          {!filteredEntries.length ? (
            <p className="authority-empty">No parallel passages match this filter.</p>
          ) : null}
          {filteredEntries.map((entry, index) => {
            const article = entry.article;
            const previous = filteredEntries[index - 1]?.article;
            const selected = article.id === activeEntry?.article.id;
            const count = entry.citations.length + entry.parallelPassages.length;
            const startsQuestion = !previous || previous.part !== article.part || previous.question !== article.question;

            return (
              <div key={article.id}>
                {startsQuestion ? (
                  <div className="parallel-question-divider">
                    <span>{article.part} Q.{article.question}</span>
                    <strong>{entry.question?.title || 'Question'}</strong>
                  </div>
                ) : null}
                <button
                  className={`authority-index-row ${selected ? 'active' : ''}`}
                  onClick={() => setSelectedId(article.id)}
                >
                  <span className="authority-index-name">A.{article.article}</span>
                  <span className="authority-index-total">{count}</span>
                  <span className="authority-index-breakdown">{article.title}</span>
                </button>
              </div>
            );
          })}
        </div>
      </aside>

      <section className="authority-detail">
        {!activeEntry ? (
          <div className="authority-detail-header">
            <div className="authority-detail-title">
              <button className="back-btn" onClick={onBack}>Back</button>
              <div>
                <div className="section-label">Leonine Apparatus</div>
                <h2>No Matches</h2>
                <p className="parallel-index-title">Try another part, theme, question, or search term.</p>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="authority-detail-header">
              <div className="authority-detail-title">
                <button className="back-btn" onClick={onBack}>Back</button>
                <div>
                  <div className="section-label">Leonine Apparatus</div>
                  <h2>{activeArticle.part} Q.{activeArticle.question} A.{activeArticle.article}</h2>
                  {activeEntry.question?.sectionTrail?.length ? (
                    <div className="parallel-index-trail">
                      {activeEntry.question.sectionTrail.join(' / ')}
                    </div>
                  ) : null}
                  <p className="parallel-index-title">{activeArticle.title}</p>
                </div>
              </div>
              <button
                type="button"
                className="nav-arrow"
                onClick={() => onNavigate(activeArticle.part, activeArticle.question, activeArticle.article)}
              >
                Open Article
              </button>
            </div>

            {activeEntry.citations.length ? (
              <section className="authority-detail-section">
                <div className="authority-detail-heading">
                  <h3>Leonine References</h3>
                  <span>{activeEntry.citations.length} references</span>
                </div>
                <div className="parallel-index-panel">
                  {activeEntry.citations.map((citation, index) => (
                    <span key={`${citation.label}-${index}`} className="parallel-index-citation">
                      <CitationLink
                        citation={citation}
                        onNavigate={onNavigate}
                        onOpenReference={onOpenReference}
                        resolveArticle={resolveArticle}
                      />
                    </span>
                  ))}
                  <p>{formatLeonineSource(activeArticle.leonineApparatus)}</p>
                </div>
              </section>
            ) : null}

            {activeEntry.parallelPassages.length ? (
              <section className="authority-detail-section">
                <div className="authority-detail-heading">
                  <h3>Related Summa Articles</h3>
                  <span>{activeEntry.parallelPassages.length} articles</span>
                </div>
                <div className="authority-article-list">
                  {activeEntry.parallelPassages.map(passage => {
                    const target = data.articles.find(article =>
                      article.part === passage.part &&
                      article.question === passage.question &&
                      article.article === passage.article
                    );

                    return (
                      <button
                        key={`${passage.part}-${passage.question}-${passage.article}-${passage.relation}`}
                        className="authority-article-row"
                        onClick={() => onNavigate(passage.part, passage.question, passage.article)}
                      >
                        <span className="authority-article-ref">{passage.part} Q.{passage.question} A.{passage.article}</span>
                        <span className="authority-article-title">{target?.title || 'Related article'}</span>
                        <span className="authority-article-meta">
                          {passage.relation === 'mentioned-by' ? 'Referenced from' : 'References'}
                          {passage.note ? ` · ${passage.note}` : ''}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
