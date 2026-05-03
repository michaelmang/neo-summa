import { useState } from 'react';
import CitationGraph from './CitationGraph';

function CrossRefPill({ crossRef, onNavigate, direction }) {
  return (
    <button
      className={`xref-pill ${direction === 'inbound' ? 'xref-inbound' : 'xref-outbound'}`}
      onClick={() => onNavigate(crossRef.part, crossRef.question, crossRef.article)}
      title={direction === 'inbound' ? 'This article cites the current article' : 'Navigate to cited article'}
    >
      {crossRef.part} Q.{crossRef.question} A.{crossRef.article}
    </button>
  );
}

function AuthorityGroup({ title, authorities }) {
  if (!authorities?.length) return null;

  return (
    <div className="authority-group">
      <span className="authority-title">{title}</span>
      <div className="authority-list">
        {authorities.map(authority => (
          <span
            key={authority.name}
            className="authority-chip"
            title={[
              authority.sections?.join(', '),
              authority.citations?.length ? authority.citations.join('; ') : ''
            ].filter(Boolean).join(' — ')}
          >
            <span>{authority.name}</span>
            {authority.count > 1 && <span className="authority-count">{authority.count}</span>}
          </span>
        ))}
      </div>
    </div>
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

function ObjectionBlock({ objection, reply }) {
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
      <div className="objection-body">{objectionText}</div>
      {open && reply && (
        <div className="reply-body">
          <div className="reply-label">Reply to Objection {reply.number}</div>
          <div>{replyText}</div>
        </div>
      )}
      {open && !reply && (
        <div className="reply-body reply-missing">No reply recorded for this objection.</div>
      )}
    </div>
  );
}

export default function ArticleView({ article, onNavigate, onBack, partNames }) {
  const partName = partNames[article.part] || article.part;

  const citationCount = article.inboundRefs?.length || 0;
  const citationLabel = citationCount === 1 ? '1 article cites this' : `${citationCount} articles cite this`;

  return (
    <div className="article-view">
      <div className="article-topbar">
        <div className="article-breadcrumb">
          {onBack && (
            <button className="back-btn" onClick={onBack}>← back</button>
          )}
          <span className="breadcrumb-part">{partName}</span>
          <span className="breadcrumb-sep">·</span>
          <span>Question {article.question}</span>
          <span className="breadcrumb-sep">·</span>
          <span>Article {article.article}</span>
          {citationCount > 0 && (
            <span className="citation-badge">{citationLabel}</span>
          )}
        </div>
        <div className="article-nav-arrows">
          <button
            className="nav-arrow"
            onClick={() => onNavigate(article.part, article.question, article.article - 1)}
            disabled={article.article <= 1}
          >← prev</button>
          <button
            className="nav-arrow"
            onClick={() => onNavigate(article.part, article.question, article.article + 1)}
          >next →</button>
        </div>
      </div>

      <div className="article-content">
        <h2 className="article-title">{article.title}</h2>

        {(article.authoritiesAnswered?.length > 0 || article.authoritiesInvoked?.length > 0 || article.authoritiesDiscussed?.length > 0) && (
          <div className="authority-panel">
            <AuthorityGroup title="Authorities Answered" authorities={article.authoritiesAnswered} />
            <AuthorityGroup title="Authorities Invoked" authorities={article.authoritiesInvoked} />
            <AuthorityGroup title="Authorities Discussed" authorities={article.authoritiesDiscussed} />
          </div>
        )}

        {(article.outboundRefs?.length > 0 || article.inboundRefs?.length > 0) && (
          <>
            <CitationGraph article={article} onNavigate={onNavigate} />
            <div className="xref-panel">
              {article.outboundRefs?.length > 0 && (
                <div className="xref-row">
                  <span className="xref-direction">Cites →</span>
                  {article.outboundRefs.map((ref, i) => (
                    <CrossRefPill key={i} crossRef={ref} onNavigate={onNavigate} direction="outbound" />
                  ))}
                </div>
              )}
              {article.inboundRefs?.length > 0 && (
                <div className="xref-row">
                  <span className="xref-direction">Cited by →</span>
                  {article.inboundRefs.map((ref, i) => (
                    <CrossRefPill key={i} crossRef={ref} onNavigate={onNavigate} direction="inbound" />
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {article.objections?.length > 0 && (
          <div className="section">
            <div className="section-label">Objections & replies</div>
            {article.objections.map(obj => {
              const reply = article.replies?.find(r => r.number === obj.number);
              return <ObjectionBlock key={obj.number} objection={obj} reply={reply} />;
            })}
          </div>
        )}

        {article.sedContra?.english && (
          <div className="section">
            <div className="section-label">Sed contra</div>
            <div className="sed-contra">{article.sedContra.english}</div>
          </div>
        )}

        {article.respondeo?.english && (
          <div className="section">
            <div className="section-label">Respondeo</div>
            <div className="respondeo">{article.respondeo.english}</div>
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
