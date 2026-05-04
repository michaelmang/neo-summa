import { Fragment, useMemo, useState } from 'react';
import { formatQuestionTitle } from '../lib/questionTitles';

function getQuestionsByPart(data) {
  const firstArticles = new Map();
  const currentTrailByPart = new Map();

  for (const article of data.articles) {
    const key = `${article.part}:${article.question}`;
    const current = firstArticles.get(key);

    if (!current || article.article < current.article) {
      firstArticles.set(key, article);
    }
  }

  return [...data.meta.questions]
    .sort((a, b) => a.part.localeCompare(b.part) || a.question - b.question)
    .reduce((grouped, question) => {
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

      const entry = {
        ...question,
        category: sectionTrail[0] || '',
        sectionTrail,
        heading,
        headingLines,
        title,
        firstArticle: firstArticles.get(`${question.part}:${question.question}`)
      };

      return {
        ...grouped,
        [question.part]: [...(grouped[question.part] || []), entry]
      };
    }, {});
}

function getPartRows(data, partNames) {
  return Object.entries(partNames).map(([code, name]) => ({
    code,
    name,
    questions: data.meta.questions.filter(question => question.part === code)
  })).filter(part => part.questions.length > 0);
}

function getCategoryOptions(parts, questionsByPart, selectedPart) {
  const categoryMap = new Map();

  for (const part of parts) {
    if (selectedPart !== 'all' && part.code !== selectedPart) continue;

    for (const question of questionsByPart[part.code] || []) {
      for (const heading of question.sectionTrail || []) {
        if (!heading) continue;

        if (!categoryMap.has(heading)) {
          categoryMap.set(heading, {
            heading,
            count: 0
          });
        }

        categoryMap.get(heading).count += 1;
      }
    }
  }

  return [...categoryMap.values()].sort((a, b) => a.heading.localeCompare(b.heading));
}

function getPrefaceLines(question) {
  return question.preface?.english?.filter(Boolean) || [];
}

export default function QuestionCatalogue({ data, partNames, onNavigate, onBack }) {
  const [selectedPart, setSelectedPart] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [query, setQuery] = useState('');
  const questionsByPart = useMemo(() => getQuestionsByPart(data), [data]);
  const parts = useMemo(() => getPartRows(data, partNames), [data, partNames]);
  const categoryOptions = useMemo(
    () => getCategoryOptions(parts, questionsByPart, selectedPart),
    [parts, questionsByPart, selectedPart]
  );
  const normalizedQuery = query.trim().toLowerCase();
  const visibleParts = parts.map(part => {
    const questions = (questionsByPart[part.code] || []).filter(question => {
      const matchesPart = selectedPart === 'all' || question.part === selectedPart;
      const matchesCategory = selectedCategory === 'all' || question.sectionTrail.includes(selectedCategory);
      const matchesQuery = !normalizedQuery || [
        question.question,
        question.category,
        ...(question.sectionTrail || []),
        question.heading,
        question.title,
        ...getPrefaceLines(question),
        question.articleCount
      ].join(' ').toLowerCase().includes(normalizedQuery);

      return matchesPart && matchesCategory && matchesQuery;
    });

    return { ...part, questions };
  }).filter(part => part.questions.length > 0);
  const visibleQuestionCount = visibleParts.reduce((total, part) => total + part.questions.length, 0);

  return (
    <div className="question-catalogue-view">
      <header className="library-view-header">
        <div>
          <button className="back-btn" onClick={onBack}>Back</button>
          <span className="library-kicker">Table of Contents</span>
          <h2>Question Catalog</h2>
        </div>
        <span className="library-count">{visibleQuestionCount} of {data.meta.questions.length} questions</span>
      </header>

      <div className="catalog-filter-bar">
        <label className="catalog-filter-field">
          <span>Part</span>
          <select
            value={selectedPart}
            onChange={event => {
              setSelectedPart(event.target.value);
              setSelectedCategory('all');
            }}
          >
            <option value="all">All parts</option>
            {parts.map(part => (
              <option key={part.code} value={part.code}>{part.code} · {part.name}</option>
            ))}
          </select>
        </label>

        <label className="catalog-filter-field">
          <span>Category</span>
          <select
            value={selectedCategory}
            onChange={event => setSelectedCategory(event.target.value)}
            disabled={categoryOptions.length === 0}
          >
            <option value="all">All categories</option>
            {categoryOptions.map(category => (
              <option key={category.heading} value={category.heading}>
                {category.heading} ({category.count})
              </option>
            ))}
          </select>
        </label>

        <label className="catalog-filter-field catalog-search-field">
          <span>Filter</span>
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search question names..."
          />
        </label>
      </div>

      <div className="welcome-question-catalogue">
        {visibleParts.length === 0 ? (
          <p className="catalog-empty">No questions match this filter.</p>
        ) : null}

        {visibleParts.map(part => (
          <section key={part.code} className="welcome-question-section">
            <div className="welcome-question-part">
              <span>{part.code}</span>
              <h4>{part.name}</h4>
            </div>

            <table className="welcome-question-table">
              <tbody>
                {part.questions.map((question, index, questions) => {
                  const previous = questions[index - 1];
                  const sectionKey = (question.sectionTrail || []).join(' / ');
                  const previousSectionKey = (previous?.sectionTrail || []).join(' / ');
                  const prefaceLines = getPrefaceLines(question);
                  const showSectionHeader = sectionKey && sectionKey !== previousSectionKey;

                  return (
                    <Fragment key={`${question.part}-${question.question}-group`}>
                      {showSectionHeader ? (
                        <tr key={`${question.part}-${question.question}-section`} className="catalog-category-row">
                          <td colSpan="3">
                            {(question.sectionTrail || []).map((heading, headingIndex) => (
                              <span key={heading} className={headingIndex === 0 ? 'catalog-category-primary' : 'catalog-category-secondary'}>
                                {heading}
                              </span>
                            ))}
                          </td>
                        </tr>
                      ) : null}
                      {prefaceLines.length > 0 ? (
                        <tr key={`${question.part}-${question.question}-preface`} className="catalog-preface-row">
                          <td colSpan="3">
                            {prefaceLines.map(line => (
                              <p key={line}>{line}</p>
                            ))}
                          </td>
                        </tr>
                      ) : null}
                      <tr key={`${question.part}-${question.question}`}>
                        <th scope="row">
                          {question.firstArticle ? (
                            <button
                              className="welcome-question-link quick-tooltip"
                              onClick={() => onNavigate(question.firstArticle.part, question.firstArticle.question, question.firstArticle.article)}
                              data-tooltip={`${part.name} Q.${question.question}: ${question.title}`}
                              aria-label={`${part.name} Q.${question.question}: ${question.title}`}
                            >
                              {question.question}
                            </button>
                          ) : (
                            question.question
                          )}
                        </th>
                        <td>
                          <span className="welcome-question-title">{question.title}</span>
                        </td>
                        <td>{question.articleCount} articles</td>
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </section>
        ))}
      </div>
    </div>
  );
}
