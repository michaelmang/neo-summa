import { useMemo, useState } from 'react';

function mergeAuthorityStats(authorityStats = {}) {
  const byName = new Map();

  const addStats = (entries = [], key) => {
    for (const entry of entries) {
      if (!byName.has(entry.name)) {
        byName.set(entry.name, {
          name: entry.name,
          answeredCount: 0,
          answeredArticles: 0,
          invokedCount: 0,
          invokedArticles: 0,
          discussedCount: 0,
          discussedArticles: 0
        });
      }

      const stat = byName.get(entry.name);
      stat[`${key}Count`] = entry.count;
      stat[`${key}Articles`] = entry.articles;
    }
  };

  addStats(authorityStats.answered, 'answered');
  addStats(authorityStats.invoked, 'invoked');
  addStats(authorityStats.discussed, 'discussed');

  return [...byName.values()].sort((a, b) => {
    const aTotal = a.answeredCount + a.invokedCount + a.discussedCount;
    const bTotal = b.answeredCount + b.invokedCount + b.discussedCount;
    return bTotal - aTotal || a.name.localeCompare(b.name);
  });
}

function findAuthorityArticles(articles, authorityName) {
  const answered = [];
  const invoked = [];
  const discussed = [];

  for (const article of articles) {
    const answeredRef = article.authoritiesAnswered?.find(authority => authority.name === authorityName);
    if (answeredRef) {
      answered.push({ article, authority: answeredRef });
    }

    const invokedRef = article.authoritiesInvoked?.find(authority => authority.name === authorityName);
    if (invokedRef) {
      invoked.push({ article, authority: invokedRef });
    }

    const discussedRef = article.authoritiesDiscussed?.find(authority => authority.name === authorityName);
    if (discussedRef) {
      discussed.push({ article, authority: discussedRef });
    }
  }

  return { answered, invoked, discussed };
}

function AuthorityArticleList({ title, entries, onNavigate }) {
  return (
    <section className="authority-detail-section">
      <div className="authority-detail-heading">
        <h3>{title}</h3>
        <span>{entries.length} articles</span>
      </div>

      {entries.length === 0 ? (
        <p className="authority-empty">No articles in this category.</p>
      ) : (
        <div className="authority-article-list">
          {entries.map(({ article, authority }) => (
            <button
              key={`${article.id}-${title}`}
              className="authority-article-row quick-tooltip"
              onClick={() => onNavigate(article.part, article.question, article.article)}
              data-tooltip={`${article.part} Q.${article.question} A.${article.article}: ${article.title}`}
              aria-label={`${article.part} Q.${article.question} A.${article.article}: ${article.title}`}
            >
              <span className="authority-article-ref">{article.part} Q.{article.question} A.{article.article}</span>
              <span className="authority-article-title">{article.title}</span>
              <span className="authority-article-meta">
                {authority.sections?.join(', ')}
                {authority.citations?.length ? ` · ${authority.citations.slice(0, 3).join('; ')}` : ''}
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

export default function AuthorityIndex({ data, onNavigate, onBack }) {
  const authorities = useMemo(() => mergeAuthorityStats(data.meta.authorityStats), [data]);
  const [selectedAuthority, setSelectedAuthority] = useState(authorities[0]?.name || '');
  const [query, setQuery] = useState('');

  const filteredAuthorities = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return authorities;
    return authorities.filter(authority => authority.name.toLowerCase().includes(normalizedQuery));
  }, [authorities, query]);

  const activeAuthority = authorities.find(authority => authority.name === selectedAuthority) || authorities[0];
  const authorityArticles = useMemo(
    () => findAuthorityArticles(data.articles, activeAuthority?.name),
    [data, activeAuthority]
  );

  if (!activeAuthority) return null;

  return (
    <div className="authority-index">
      <aside className="authority-index-list">
        <div className="authority-index-intro">
          <h2>Authorities</h2>
          <p>Track whom Aquinas answers in the objections and invokes in the sed contra.</p>
        </div>

        <input
          className="authority-search"
          placeholder="Filter authorities..."
          value={query}
          onChange={event => setQuery(event.target.value)}
        />

        <div className="authority-list-scroll">
          {filteredAuthorities.map(authority => {
            const total = authority.answeredCount + authority.invokedCount + authority.discussedCount;
            const selected = authority.name === activeAuthority.name;

            return (
              <button
                key={authority.name}
                className={`authority-index-row ${selected ? 'active' : ''}`}
                onClick={() => setSelectedAuthority(authority.name)}
              >
                <span className="authority-index-name">{authority.name}</span>
                <span className="authority-index-total">{total}</span>
                <span className="authority-index-breakdown">
                  {authority.answeredArticles} answered · {authority.invokedArticles} invoked · {authority.discussedArticles} discussed
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="authority-detail">
        <div className="authority-detail-header">
          <div className="authority-detail-title">
            <button className="back-btn" onClick={onBack}>Back</button>
            <div>
              <div className="section-label">Authority Index</div>
              <h2>{activeAuthority.name}</h2>
            </div>
          </div>
          <div className="authority-detail-stats">
            <div>
              <span>{activeAuthority.answeredCount}</span>
              <label>answered</label>
            </div>
            <div>
              <span>{activeAuthority.invokedCount}</span>
              <label>invoked</label>
            </div>
            <div>
              <span>{activeAuthority.discussedCount}</span>
              <label>discussed</label>
            </div>
          </div>
        </div>

        <AuthorityArticleList
          title="Authorities Answered"
          entries={authorityArticles.answered}
          onNavigate={onNavigate}
        />
        <AuthorityArticleList
          title="Authorities Invoked"
          entries={authorityArticles.invoked}
          onNavigate={onNavigate}
        />
        <AuthorityArticleList
          title="Authorities Discussed"
          entries={authorityArticles.discussed}
          onNavigate={onNavigate}
        />
      </section>
    </div>
  );
}
