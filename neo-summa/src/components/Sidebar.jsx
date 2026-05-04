import { useMemo, useState } from 'react';
import { formatQuestionTitle } from '../lib/questionTitles';

function getAuthorityCount(authorityStats = {}) {
  return new Set([
    ...(authorityStats.answered || []).map(authority => authority.name),
    ...(authorityStats.invoked || []).map(authority => authority.name),
    ...(authorityStats.discussed || []).map(authority => authority.name)
  ]).size;
}

export default function Sidebar({ data, selected, view, onSelect, onShowAuthorities, onShowCatalog, onShowSearch, searchArticles, partNames, partScopes }) {
  const [search, setSearch] = useState('');
  const [expandedParts, setExpandedParts] = useState({ FP: true, FS: false, SS: false, TP: false, XP: false });
  const [expandedQuestions, setExpandedQuestions] = useState({});

  const searchResults = useMemo(() =>
    search.length > 1 ? searchArticles(search) : [],
    [search, searchArticles]
  );

  const questionsByPart = useMemo(() => {
    const map = {};
    for (const question of data.meta.questions) {
      const key = `${question.part}:${question.question}`;
      const { heading, headingLines, title } = formatQuestionTitle(question.title);
      map[key] = {
        part: question.part,
        question: question.question,
        heading,
        headingLines,
        title,
        articleCount: question.articleCount,
        articles: []
      };
    }

    for (const article of data.articles) {
      const key = `${article.part}:${article.question}`;
      if (!map[key]) {
        map[key] = {
          part: article.part,
          question: article.question,
          heading: '',
          title: article.title,
          articleCount: 0,
          articles: []
        };
      }
      map[key].articles.push(article);
    }

    const grouped = {};
    for (const entry of Object.values(map)) {
      if (!grouped[entry.part]) grouped[entry.part] = [];
      grouped[entry.part].push(entry);
    }
    for (const part of Object.keys(grouped)) {
      grouped[part].sort((a, b) => a.question - b.question);
    }
    return grouped;
  }, [data]);

  const togglePart = (part) => setExpandedParts(p => ({
    ...p,
    [part]: !(p[part] ?? selected?.part === part)
  }));
  const toggleQuestion = (key) => setExpandedQuestions(q => ({
    ...q,
    [key]: !(q[key] ?? selectedQuestionKey === key)
  }));
  const selectedQuestionKey = selected ? `${selected.part}:${selected.question}` : '';

  return (
    <aside className="sidebar">
      <div className="search-wrapper">
        <input
          className="search-input"
          placeholder="Search articles…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button
          className={`sidebar-library-btn ${view === 'authorities' ? 'active' : ''}`}
          onClick={() => { setSearch(''); onShowAuthorities(); }}
        >
          <span>Authorities</span>
          <span>{getAuthorityCount(data.meta.authorityStats)} indexed</span>
        </button>
        <button
          className={`sidebar-library-btn ${view === 'catalog' ? 'active' : ''}`}
          onClick={() => { setSearch(''); onShowCatalog(); }}
        >
          <span>Question Catalog</span>
          <span>{data.meta.questions.length} questions</span>
        </button>
        <button
          className={`sidebar-library-btn ${view === 'search' ? 'active' : ''}`}
          onClick={() => { setSearch(''); onShowSearch(); }}
        >
          <span>Advanced Search</span>
          <span>text + filters</span>
        </button>
      </div>

      {search.length > 1 ? (
        <div className="search-results">
          {searchResults.length === 0 && <p className="no-results">No results found.</p>}
          {searchResults.map(art => (
            <button
              key={art.id}
              className={`article-btn quick-tooltip ${selected?.id === art.id ? 'active' : ''}`}
              onClick={() => { onSelect(art); setSearch(''); }}
              data-tooltip={`${art.part} Q.${art.question} A.${art.article}: ${art.title}`}
              aria-label={`${art.part} Q.${art.question} A.${art.article}: ${art.title}`}
            >
              <span className="article-ref">{art.part} Q.{art.question} A.{art.article}</span>
              <span className="article-title-small">{art.title}</span>
            </button>
          ))}
        </div>
      ) : (
        <nav className="sidebar-nav">
          {Object.entries(partNames).map(([partCode, partName]) => {
            const questions = questionsByPart[partCode] || [];
            if (questions.length === 0) return null;
            const isExpanded = Boolean(expandedParts[partCode] ?? selected?.part === partCode);
            const articleCount = questions.reduce((total, question) => total + question.articles.length, 0);
            return (
              <div key={partCode} className="part-section">
                <button className="part-header" onClick={() => togglePart(partCode)}>
                  <span className="part-code">{partCode}</span>
                  <span className="part-copy">
                    <span className="part-name">{partName}</span>
                    <span className="part-scope">{partScopes[partCode]}</span>
                    <span className="part-count">{questions.length} questions · {articleCount} articles</span>
                  </span>
                  <span className="part-toggle">{isExpanded ? '−' : '+'}</span>
                </button>

                {isExpanded && (
                  <div className="questions-list">
                    {questions.map(q => {
                      const qKey = `${q.part}:${q.question}`;
                      const isQExpanded = Boolean(expandedQuestions[qKey] ?? selectedQuestionKey === qKey);
                      const isQSelected = selected?.part === q.part && selected?.question === q.question;
                      return (
                        <div key={qKey} className={`question-item ${isQSelected ? 'question-selected' : ''}`}>
                          <button
                            className="question-btn"
                            onClick={() => toggleQuestion(qKey)}
                          >
                            <span className="question-num">Q. {q.question}</span>
                            <span className="question-copy">
                              {q.headingLines?.map(line => <span key={line} className="question-heading">{line}</span>)}
                              <span className="question-title">{q.title}</span>
                            </span>
                            <span className="question-toggle">{isQExpanded ? '−' : '+'}</span>
                          </button>

                          {isQExpanded && (
                            <div className="articles-list">
                              {[...q.articles].sort((a, b) => a.article - b.article).map(art => (
                                <button
                                  key={art.id}
                                  className={`article-btn quick-tooltip ${selected?.id === art.id ? 'active' : ''}`}
                                  onClick={() => onSelect(art)}
                                  data-tooltip={`${art.part} Q.${art.question} A.${art.article}: ${art.title}`}
                                  aria-label={`${art.part} Q.${art.question} A.${art.article}: ${art.title}`}
                                >
                                  <span className="article-num">A. {art.article}</span>
                                  <span className="article-title-small">{art.title}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      )}
    </aside>
  );
}
