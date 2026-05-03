import { useState } from 'react';

const INTERNAL_REF_PATTERN = /(?:(FP|FS|SS|TP),\s*)?(?:Question\s+\[(\d+)\]\s*,?\s*)?(Articles?\s+\[(\d+)\](?:\s*(?:,|and)\s*\[?\d+\]?)*)/gi;

function getInternalRefTarget(match, contextArticle, articleNumber = Number(match[4])) {
  return {
    part: match[1] || contextArticle.part,
    question: match[2] ? Number(match[2]) : contextArticle.question,
    article: articleNumber
  };
}

function getArticleNumberMatches(articleLabel) {
  return [...articleLabel.matchAll(/\[?(\d+)\]?/g)];
}

function renderInternalRef(match, contextArticle, onNavigate, keyPrefix) {
  const [label] = match;
  const articleLabel = match[3];
  const articleNumberMatches = getArticleNumberMatches(articleLabel);
  const articleLabelStart = label.indexOf(articleLabel);
  const questionPrefix = label.slice(0, articleLabelStart);
  const articlePrefix = articleLabel.match(/^Articles?\s*/i)?.[0] || '';
  let cursor = articlePrefix.length;

  return (
    <span key={keyPrefix}>
      {questionPrefix}
      {articlePrefix}
      {articleNumberMatches.map((articleMatch) => {
        const articleNumber = Number(articleMatch[1]);
        const target = getInternalRefTarget(match, contextArticle, articleNumber);
        const separator = articleLabel.slice(cursor, articleMatch.index);
        cursor = articleMatch.index + articleMatch[0].length;

        return (
          <span key={`${articleNumber}-${articleMatch.index}`}>
            {separator}
            <button
              className="inline-citation-link"
              onClick={() => onNavigate(target.part, target.question, articleNumber)}
              title={`Go to ${target.part} Q.${target.question} A.${articleNumber}`}
            >
              {articleMatch[0]}
            </button>
          </span>
        );
      })}
      {articleLabel.slice(cursor)}
    </span>
  );
}

function LinkedText({ text, contextArticle, onNavigate }) {
  if (!text) return null;

  const nodes = [];
  let lastIndex = 0;

  for (const match of text.matchAll(INTERNAL_REF_PATTERN)) {
    const [label] = match;
    const index = match.index;

    if (index > lastIndex) {
      nodes.push(text.slice(lastIndex, index));
    }

    nodes.push(renderInternalRef(match, contextArticle, onNavigate, `${index}-${label}`));

    lastIndex = index + label.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

function CrossRefLink({ crossRef, onNavigate, direction }) {
  return (
    <button
      className={`reference-link ${direction === 'inbound' ? 'reference-inbound' : 'reference-outbound'}`}
      onClick={() => onNavigate(crossRef.part, crossRef.question, crossRef.article)}
      title={direction === 'inbound' ? 'This article cites the current article' : 'Navigate to cited article'}
    >
      {crossRef.part} Q.{crossRef.question} A.{crossRef.article}
    </button>
  );
}

function AuthorityList({ authorities = [] }) {
  if (!authorities.length) return <span className="reference-empty">None</span>;

  return (
    <>
      {authorities.map((authority, index) => (
        <span
          key={authority.name}
          className="authority-entry"
          title={[
            authority.sections?.join(', '),
            authority.citations?.length ? authority.citations.join('; ') : ''
          ].filter(Boolean).join(' — ')}
        >
          {index > 0 ? <span className="reference-separator">; </span> : null}
          {authority.name}
          {authority.count > 1 ? <span className="authority-entry-count"> ({authority.count})</span> : null}
        </span>
      ))}
    </>
  );
}

function AuthorityTable({ article }) {
  const rows = [
    ['Authorities Answered', article.authoritiesAnswered],
    ['Authorities Invoked', article.authoritiesInvoked],
    ['Authorities Discussed', article.authoritiesDiscussed],
  ].filter(([, authorities]) => authorities?.length > 0);

  if (!rows.length) return null;

  return (
    <table className="reference-table authority-table">
      <tbody>
        {rows.map(([title, authorities]) => (
          <tr key={title}>
            <th scope="row">{title}</th>
            <td><AuthorityList authorities={authorities} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CrossReferenceRow({ title, refs, direction, onNavigate }) {
  const [expanded, setExpanded] = useState(false);
  const previewCount = 8;
  const visibleRefs = expanded ? refs : refs.slice(0, previewCount);
  const hiddenCount = refs.length - visibleRefs.length;

  return (
    <tr>
      <th scope="row">{title}</th>
      <td>
        <div className="reference-list">
          {visibleRefs.map((ref, index) => (
            <span key={`${ref.part}-${ref.question}-${ref.article}`} className="reference-entry">
              {index > 0 ? <span className="reference-separator">, </span> : null}
              <CrossRefLink crossRef={ref} onNavigate={onNavigate} direction={direction} />
            </span>
          ))}
          {hiddenCount > 0 ? (
            <>
              <span className="reference-separator">, </span>
              <button className="reference-more" onClick={() => setExpanded(true)}>
                show {hiddenCount} more
              </button>
            </>
          ) : null}
          {expanded && refs.length > previewCount ? (
            <>
              <span className="reference-separator"> </span>
              <button className="reference-more" onClick={() => setExpanded(false)}>
                show fewer
              </button>
            </>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

function CrossReferenceTable({ article, onNavigate }) {
  const rows = [
    ['Cites', article.outboundRefs, 'outbound'],
    ['Cited by', article.inboundRefs, 'inbound'],
  ].filter(([, refs]) => refs?.length > 0);

  if (!rows.length) return null;

  return (
    <table className="reference-table xref-table">
      <tbody>
        {rows.map(([title, refs, direction]) => (
          <CrossReferenceRow
            key={title}
            title={title}
            refs={refs}
            direction={direction}
            onNavigate={onNavigate}
          />
        ))}
      </tbody>
    </table>
  );
}

function stripPrefix(text, ...prefixes) {
  if (!text) return text;
  for (const prefix of prefixes) {
    const regex = new RegExp(`^${prefix}\\s*`, 'i');
    if (regex.test(text)) return text.replace(regex, '').trim();
  }
  return text;
}

function ObjectionBlock({ objection, reply, article, onNavigate }) {
  const [open, setOpen] = useState(false);

  const objectionText = stripPrefix(
    objection.english,
    `Objection ${objection.number}:`,
    `Objection ${objection.number}.`
  );

  const replyText = reply ? stripPrefix(
    reply.english,
    `Reply to Objection ${reply.number}:`,
    `Reply to Objection ${reply.number}.`
  ) : null;

  return (
    <div className="objection-block">
      <div className="objection-header" onClick={() => setOpen(o => !o)}>
        <span className="objection-label">Objection {objection.number}</span>
        <button className="toggle-btn">
          {open ? 'hide reply ↑' : 'show reply ↓'}
        </button>
      </div>
      <div className="objection-body">
        <LinkedText text={objectionText} contextArticle={article} onNavigate={onNavigate} />
      </div>
      {open && reply && (
        <div className="reply-body">
          <div className="reply-label">Reply to Objection {reply.number}</div>
          <div><LinkedText text={replyText} contextArticle={article} onNavigate={onNavigate} /></div>
        </div>
      )}
      {open && !reply && (
        <div className="reply-body reply-missing">No reply recorded for this objection.</div>
      )}
    </div>
  );
}

export default function ArticleView({ article, onNavigate, previousArticle, nextArticle, partNames }) {
  const partName = partNames[article.part] || article.part;

  return (
    <div className="article-view">
      <div className="article-topbar">
        <div className="article-breadcrumb">
          <span className="breadcrumb-part">{partName}</span>
          <span className="breadcrumb-sep">·</span>
          <span>Question {article.question}</span>
          <span className="breadcrumb-sep">·</span>
          <span>Article {article.article}</span>
        </div>
        <div className="article-nav-arrows">
          <button
            className="nav-arrow"
            onClick={() => previousArticle && onNavigate(previousArticle.part, previousArticle.question, previousArticle.article)}
            disabled={!previousArticle}
          >← prev</button>
          <button
            className="nav-arrow"
            onClick={() => nextArticle && onNavigate(nextArticle.part, nextArticle.question, nextArticle.article)}
            disabled={!nextArticle}
          >next →</button>
        </div>
      </div>

      <div className="article-content">
        <h2 className="article-title">{article.title}</h2>

        <div className="article-reference-tables">
          <AuthorityTable article={article} />
          <CrossReferenceTable article={article} onNavigate={onNavigate} />
        </div>

        {article.objections?.length > 0 && (
          <div className="section">
            <div className="section-label">Objections & replies</div>
            {article.objections.map(obj => {
              const reply = article.replies?.find(r => r.number === obj.number);
              return <ObjectionBlock key={obj.number} objection={obj} reply={reply} article={article} onNavigate={onNavigate} />;
            })}
          </div>
        )}

        {article.sedContra?.english && (
          <div className="section">
            <div className="section-label">Sed contra</div>
            <div className="sed-contra">
              <LinkedText text={article.sedContra.english} contextArticle={article} onNavigate={onNavigate} />
            </div>
          </div>
        )}

        {article.respondeo?.english && (
          <div className="section">
            <div className="section-label">Respondeo</div>
            <div className="respondeo">
              <LinkedText text={article.respondeo.english} contextArticle={article} onNavigate={onNavigate} />
            </div>
          </div>
        )}

        {article.respondeo?.latin && (
          <details className="latin-toggle">
            <summary>View Latin text</summary>
            <div className="latin-text">{article.respondeo.latin}</div>
          </details>
        )}
      </div>
    </div>
  );
}
