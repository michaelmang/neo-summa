function getPartRows(data, partNames, partScopes) {
  return Object.entries(partNames).map(([code, name]) => {
    const articles = data.articles.filter(article => article.part === code);
    const questions = data.meta.questions.filter(question => question.part === code);

    return {
      code,
      name,
      scope: partScopes[code],
      articleCount: articles.length,
      questionCount: questions.length,
      firstArticle: [...articles].sort((a, b) => a.question - b.question || a.article - b.article)[0]
    };
  }).filter(row => row.articleCount > 0);
}

export default function WelcomeView({ data, partNames, partScopes, onNavigate, onShowAuthorities, onShowCatalog, onShowParallels, onShowSearch }) {
  const partRows = getPartRows(data, partNames, partScopes);
  const firstArticle = partRows[0]?.firstArticle;

  return (
    <div className="welcome">
      <div className="welcome-inner">
        <div className="welcome-kicker">Thomas Aquinas</div>
        <h2>Summa Theologica</h2>
        <p>A structured reader for moving through the articles, questions, internal references, and authorities of the Summa.</p>

        <div className="welcome-actions">
          {firstArticle ? (
            <button
              className="welcome-primary-action"
              onClick={() => onNavigate(firstArticle.part, firstArticle.question, firstArticle.article)}
            >
              Begin with Prima Pars Q.1 A.1
            </button>
          ) : null}
          <button className="welcome-secondary-action" onClick={onShowAuthorities}>
            Open Authority Index
          </button>
          <button className="welcome-secondary-action" onClick={onShowCatalog}>
            Browse Question Catalog
          </button>
          <button className="welcome-secondary-action" onClick={onShowParallels}>
            Browse Parallel Passages
          </button>
          <button className="welcome-secondary-action" onClick={onShowSearch}>
            Open Advanced Search
          </button>
        </div>

        <table className="welcome-table">
          <thead>
            <tr>
              <th scope="col">Part</th>
              <th scope="col">Scope</th>
              <th scope="col">Questions</th>
              <th scope="col">Articles</th>
              <th scope="col">Start</th>
            </tr>
          </thead>
          <tbody>
            {partRows.map(row => (
              <tr key={row.code}>
                <th scope="row">
                  <span className="welcome-part-code">{row.code}</span>
                  <span className="welcome-part-name">{row.name}</span>
                </th>
                <td>{row.scope}</td>
                <td>{row.questionCount}</td>
                <td>{row.articleCount}</td>
                <td>
                  {row.firstArticle ? (
                    <button
                      className="welcome-start-link"
                      onClick={() => onNavigate(row.firstArticle.part, row.firstArticle.question, row.firstArticle.article)}
                      data-tooltip={`${row.name} Q.${row.firstArticle.question} A.${row.firstArticle.article}: ${row.firstArticle.title}`}
                      aria-label={`${row.name} Q.${row.firstArticle.question} A.${row.firstArticle.article}: ${row.firstArticle.title}`}
                    >
                      Q.{row.firstArticle.question} A.{row.firstArticle.article}
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
