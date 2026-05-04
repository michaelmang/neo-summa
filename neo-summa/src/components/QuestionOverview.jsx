import { formatQuestionTitle } from '../lib/questionTitles';

function aggregateAuthorities(articles, field) {
  const byName = new Map();

  for (const article of articles) {
    for (const authority of article[field] || []) {
      if (!byName.has(authority.name)) {
        byName.set(authority.name, { name: authority.name, count: 0, articles: 0 });
      }
      const entry = byName.get(authority.name);
      entry.count += authority.count;
      entry.articles += 1;
    }
  }

  return [...byName.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function AuthoritySummary({ title, authorities }) {
  if (!authorities.length) return null;

  return (
    <div className="question-overview-authority">
      <span>{title}</span>
      <p>{authorities.slice(0, 8).map(authority => `${authority.name} (${authority.count})`).join('; ')}</p>
    </div>
  );
}

export default function QuestionOverview({ question, articles, partName, onNavigate, onBack }) {
  const { headingLines, title } = formatQuestionTitle(question.title);
  const prefaceLines = question.preface?.english?.filter(Boolean) || [];
  const sortedArticles = [...articles].sort((a, b) => a.article - b.article);

  return (
    <div className="question-overview-view">
      <header className="library-view-header">
        <div>
          <button className="back-btn" onClick={onBack}>Back</button>
          <span className="library-kicker">{partName} · Question {question.question}</span>
          <h2>{title}</h2>
        </div>
        <span className="library-count">{sortedArticles.length} articles</span>
      </header>

      {headingLines.length ? (
        <div className="question-overview-headings">
          {headingLines.map(line => <span key={line}>{line}</span>)}
        </div>
      ) : null}

      {prefaceLines.length ? (
        <section className="question-overview-preface">
          <h3>Question Preface</h3>
          {prefaceLines.map(line => <p key={line}>{line}</p>)}
        </section>
      ) : null}

      <section className="question-overview-section">
        <h3>Articles</h3>
        <table className="question-overview-table">
          <tbody>
            {sortedArticles.map(article => (
              <tr key={article.id}>
                <th scope="row">
                  <button onClick={() => onNavigate(article.part, article.question, article.article)}>
                    A.{article.article}
                  </button>
                </th>
                <td>{article.title}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="question-overview-section">
        <h3>Authorities Across The Question</h3>
        <AuthoritySummary title="Answered" authorities={aggregateAuthorities(sortedArticles, 'authoritiesAnswered')} />
        <AuthoritySummary title="Invoked" authorities={aggregateAuthorities(sortedArticles, 'authoritiesInvoked')} />
        <AuthoritySummary title="Discussed" authorities={aggregateAuthorities(sortedArticles, 'authoritiesDiscussed')} />
      </section>
    </div>
  );
}
