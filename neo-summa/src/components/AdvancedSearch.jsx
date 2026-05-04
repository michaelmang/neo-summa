import { useMemo, useState } from 'react';
import { getAuthorityOptions } from '../lib/search';

const SEARCH_SECTIONS = [
  ['all', 'All sections'],
  ['title', 'Titles'],
  ['objections', 'Objections'],
  ['sedContra', 'Sed contra'],
  ['respondeo', 'Respondeo'],
  ['replies', 'Replies'],
  ['authorities', 'Authorities']
];

export default function AdvancedSearch({ data, partNames, onNavigate, onBack, onSearch }) {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState('all');
  const [workId, setWorkId] = useState('all');
  const [part, setPart] = useState('all');
  const [section, setSection] = useState('all');
  const [language, setLanguage] = useState('all');
  const [authority, setAuthority] = useState('all');
  const authorityOptions = useMemo(() => getAuthorityOptions(data), [data]);
  const workOptions = data?.works || [];
  const partOptions = useMemo(() => {
    const parts = new Set();
    for (const article of data?.articles || []) {
      if (workId !== 'all' && article.workId !== workId) continue;
      parts.add(article.part);
    }

    return [...parts].sort((a, b) => a.localeCompare(b));
  }, [data, workId]);
  const results = useMemo(() => onSearch({
    query,
    mode,
    workId,
    part,
    section,
    language,
    authority
  }), [query, mode, workId, part, section, language, authority, onSearch]);
  const hasActiveSearch = query.trim() || workId !== 'all' || part !== 'all' || section !== 'all' || language !== 'all' || authority !== 'all';

  function handleOpenResult(article) {
    if (article.workId && article.workId !== 'summa-theologica' && article.source?.href) {
      window.location.assign(article.source.href);
      return;
    }

    onNavigate(article.part, article.question, article.article);
  }

  function getArticleRef(article) {
    if (article.workId && article.workId !== 'summa-theologica') {
      return `${article.workTitle} · ${article.source?.file || article.part} · ${article.headingLabel || `Lecture ${article.article}`}`;
    }

    return `${article.part} Q.${article.question} A.${article.article}`;
  }

  return (
    <div className="advanced-search-view">
      <header className="library-view-header">
        <div>
          <button className="back-btn" onClick={onBack}>Back</button>
          <span className="library-kicker">Full Text</span>
          <h2>Advanced Search</h2>
        </div>
        <span className="library-count">{results.length} results</span>
      </header>

      <div className="advanced-search-panel">
        <label className="advanced-search-query">
          <span>Search</span>
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search terms, phrase, authority, or citation..."
          />
        </label>

        <div className="advanced-search-grid">
          <label>
            <span>Work</span>
            <select value={workId} onChange={event => {
              setWorkId(event.target.value);
              setPart('all');
            }}>
              <option value="all">All works</option>
              {workOptions.map(work => (
                <option key={work.id} value={work.id}>{work.title}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Match</span>
            <select value={mode} onChange={event => setMode(event.target.value)}>
              <option value="all">All words</option>
              <option value="any">Any word</option>
              <option value="exact">Exact phrase</option>
            </select>
          </label>
          <label>
            <span>Part / Book</span>
            <select value={part} onChange={event => setPart(event.target.value)}>
              <option value="all">All parts and books</option>
              {partOptions.map(code => (
                <option key={code} value={code}>{partNames[code] ? `${code} · ${partNames[code]}` : code}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Section</span>
            <select value={section} onChange={event => setSection(event.target.value)}>
              {SEARCH_SECTIONS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Language</span>
            <select value={language} onChange={event => setLanguage(event.target.value)}>
              <option value="all">English and Latin</option>
              <option value="english">English only</option>
              <option value="latin">Latin only</option>
            </select>
          </label>
          <label>
            <span>Authority</span>
            <select value={authority} onChange={event => setAuthority(event.target.value)}>
              <option value="all">Any authority</option>
              {authorityOptions.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="advanced-results">
        {!hasActiveSearch ? (
          <p className="catalog-empty">Enter search terms or choose filters to search the library.</p>
        ) : results.length === 0 ? (
          <p className="catalog-empty">No articles match this search.</p>
        ) : (
          results.map(({ article, matchedFields }) => (
            <button
              key={article.id}
              className="advanced-result-row quick-tooltip"
              onClick={() => handleOpenResult(article)}
              data-tooltip={`${getArticleRef(article)}: ${article.title}`}
              aria-label={`${getArticleRef(article)}: ${article.title}`}
            >
              <span className="advanced-result-ref">{getArticleRef(article)}</span>
              <span className="advanced-result-title">{article.title}</span>
              <span className="advanced-result-snippets">
                {matchedFields.map(field => (
                  <span key={`${field.label}-${field.language}`} className="advanced-result-snippet">
                    <strong>{field.label}</strong>
                    <em>{field.language}</em>
                    {field.snippet}
                  </span>
                ))}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
