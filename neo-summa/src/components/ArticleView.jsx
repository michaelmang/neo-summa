import { useState } from 'react';
import {
  IMPORTED_BOOK_FIRST_PATTERN,
  IMPORTED_WORK_FIRST_PATTERN,
  parseImportedCitationMatch,
  resolveImportedCitation
} from '../lib/importedCitations';
import {
  BIBLE_REF_PATTERN,
  parseBibleCitationMatch,
  resolveBibleCitation
} from '../lib/bibleCitations';

const INTERNAL_REF_PATTERN = /(?:(FP|FS|SS|TP|XP),\s*)?(?:Question\s+\[(\d+)\]\s*,?\s*)?(Articles?\s+\[(\d+)\](?:\s*(?:,|and)\s*\[?\d+\]?)*)/gi;

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

function renderInternalRef(match, contextArticle, onNavigate, resolveArticle, keyPrefix) {
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
        const targetArticle = resolveArticle?.(target.part, target.question, articleNumber);
        const separator = articleLabel.slice(cursor, articleMatch.index);
        cursor = articleMatch.index + articleMatch[0].length;

        return (
          <span key={`${articleNumber}-${articleMatch.index}`}>
            {separator}
            <button
              className="inline-citation-link quick-tooltip"
              onClick={() => onNavigate(target.part, target.question, articleNumber)}
              data-tooltip={targetArticle
                ? `${target.part} Q.${target.question} A.${articleNumber}: ${targetArticle.title}`
                : `Go to ${target.part} Q.${target.question} A.${articleNumber}`}
              aria-label={targetArticle
                ? `${target.part} Q.${target.question} A.${articleNumber}: ${targetArticle.title}`
                : `Go to ${target.part} Q.${target.question} A.${articleNumber}`}
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

function renderImportedRef(match, corpusData, order, onOpenReference, keyPrefix) {
  const citation = parseImportedCitationMatch(match, order);
  const target = resolveImportedCitation(corpusData, citation);
  const label = match[0];

  if (!target?.source?.href) return label;

  return (
    <button
      key={keyPrefix}
      type="button"
      className="inline-citation-link inline-imported-citation quick-tooltip"
      onClick={() => onOpenReference?.({
        type: 'imported',
        label,
        article: target
      })}
      data-tooltip={`${target.workTitle} · ${target.headingLabel || `Lecture ${target.article}`}: ${target.title}`}
      aria-label={`${label}: ${target.workTitle}, ${target.title}`}
    >
      {label}
    </button>
  );
}

function renderBibleRef(match, bibleData, onOpenReference, keyPrefix) {
  const citation = parseBibleCitationMatch(match);
  const target = resolveBibleCitation(bibleData, citation);
  const label = match[0];

  if (!target) return label;

  return (
    <button
      key={keyPrefix}
      type="button"
      className="inline-citation-link inline-bible-citation quick-tooltip"
      onClick={() => onOpenReference?.({
        type: 'bible',
        label,
        ...target
      })}
      data-tooltip={`${target.book} ${target.chapter}:${target.startVerse}${target.endVerse !== target.startVerse ? `-${target.endVerse}` : ''}`}
      aria-label={`${label}: ${target.book} ${target.chapter}`}
    >
      {label}
    </button>
  );
}

function getReferenceMatches(text) {
  const matches = [
    ...[...text.matchAll(INTERNAL_REF_PATTERN)].map(match => ({
      match,
      type: 'summa',
      index: match.index,
      end: match.index + match[0].length
    })),
    ...[...text.matchAll(IMPORTED_WORK_FIRST_PATTERN)].map(match => ({
      match,
      type: 'imported-work-first',
      index: match.index,
      end: match.index + match[0].length
    })),
    ...[...text.matchAll(IMPORTED_BOOK_FIRST_PATTERN)].map(match => ({
      match,
      type: 'imported-book-first',
      index: match.index,
      end: match.index + match[0].length
    })),
    ...[...text.matchAll(BIBLE_REF_PATTERN)].map(match => ({
      match,
      type: 'bible',
      index: match.index,
      end: match.index + match[0].length
    }))
  ].sort((a, b) => a.index - b.index || b.end - a.end);

  const accepted = [];
  let cursor = -1;

  for (const match of matches) {
    if (match.index < cursor) continue;
    accepted.push(match);
    cursor = match.end;
  }

  return accepted;
}

function LinkedText({ text, contextArticle, onNavigate, resolveArticle, corpusData, bibleData, onOpenReference }) {
  if (!text) return null;

  const nodes = [];
  let lastIndex = 0;

  for (const entry of getReferenceMatches(text)) {
    const { match, index, end, type } = entry;
    const [label] = match;

    if (index > lastIndex) {
      nodes.push(text.slice(lastIndex, index));
    }

    if (type === 'summa') {
      nodes.push(renderInternalRef(match, contextArticle, onNavigate, resolveArticle, `${index}-${label}`));
    } else {
      nodes.push(type === 'bible'
        ? renderBibleRef(match, bibleData, onOpenReference, `${index}-${label}`)
        : renderImportedRef(
          match,
          corpusData,
          type === 'imported-work-first' ? 'work-first' : 'book-first',
          onOpenReference,
          `${index}-${label}`
        ));
    }

    lastIndex = end;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

function CrossRefLink({ crossRef, onNavigate, direction, resolveArticle }) {
  const article = resolveArticle?.(crossRef.part, crossRef.question, crossRef.article);

  return (
    <button
      className={`reference-link quick-tooltip ${direction === 'inbound' ? 'reference-inbound' : 'reference-outbound'}`}
      onClick={() => onNavigate(crossRef.part, crossRef.question, crossRef.article)}
      data-tooltip={article
        ? `${crossRef.part} Q.${crossRef.question} A.${crossRef.article}: ${article.title}`
        : direction === 'inbound' ? 'This article cites the current article' : 'Navigate to cited article'}
      aria-label={article
        ? `${crossRef.part} Q.${crossRef.question} A.${crossRef.article}: ${article.title}`
        : direction === 'inbound' ? 'This article cites the current article' : 'Navigate to cited article'}
    >
      {crossRef.part} Q.{crossRef.question} A.{crossRef.article}
    </button>
  );
}

function AuthorityList({ authorities = [] }) {
  if (!authorities.length) return <span className="reference-empty">None</span>;

  const getAuthorityTooltip = (authority) => [
    authority.sections?.length ? `Appears in: ${authority.sections.join(', ')}` : '',
    authority.citations?.length ? `Citations: ${authority.citations.join('; ')}` : ''
  ].filter(Boolean).join(' | ');

  return (
    <>
      {authorities.map((authority, index) => (
        <span
          key={authority.name}
          className="authority-entry"
        >
          {index > 0 ? <span className="reference-separator">; </span> : null}
          {authority.name}
          {authority.count > 1 ? (
            <span
              className="authority-entry-count quick-tooltip"
              data-tooltip={getAuthorityTooltip(authority)}
              aria-label={`${authority.name} appears ${authority.count} times`}
            >
              {' '}({authority.count})
            </span>
          ) : null}
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

function CrossReferenceRow({ title, refs, direction, onNavigate, resolveArticle }) {
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
              <CrossRefLink crossRef={ref} onNavigate={onNavigate} direction={direction} resolveArticle={resolveArticle} />
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

function CrossReferenceTable({ article, onNavigate, resolveArticle }) {
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
            resolveArticle={resolveArticle}
          />
        ))}
      </tbody>
    </table>
  );
}

function StructuralNavLink({ article, onNavigate }) {
  return (
    <button
      className="reference-link reference-structural quick-tooltip"
      onClick={() => onNavigate(article.part, article.question, article.article)}
      data-tooltip={`${article.part} Q.${article.question} A.${article.article}: ${article.title}`}
      aria-label={`${article.part} Q.${article.question} A.${article.article}: ${article.title}`}
    >
      {article.part} Q.{article.question} A.{article.article}
    </button>
  );
}

function StructuralNavigationTable({ adjacentContext = {}, onNavigate }) {
  const rows = [
    adjacentContext.previous,
    adjacentContext.next,
  ].filter(Boolean);

  if (!rows.length) return null;

  return (
    <table className="reference-table structural-nav-table">
      <tbody>
        {rows.map(({ label, article, emptyText }) => (
          <tr key={label}>
            <th scope="row">{label}</th>
            <td>
              {article ? (
                <>
                  <StructuralNavLink article={article} onNavigate={onNavigate} />
                  <span className="reference-title-preview">{article.title}</span>
                </>
              ) : (
                <span className="reference-empty">{emptyText}</span>
              )}
            </td>
          </tr>
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

function LanguageToggle({ language, onChange, label }) {
  return (
    <div className="language-toggle" aria-label={label}>
      <button
        type="button"
        className={language === 'english' ? 'active' : ''}
        onClick={(event) => {
          event.stopPropagation();
          onChange('english');
        }}
      >
        English
      </button>
      <button
        type="button"
        className={language === 'latin' ? 'active' : ''}
        onClick={(event) => {
          event.stopPropagation();
          onChange('latin');
        }}
      >
        Latin
      </button>
    </div>
  );
}

function stripLatinObjectionLead(text) {
  return stripPrefix(text, 'Ad primum sic proceditur.');
}

function stripLatinReplyLead(text) {
  return stripPrefix(
    text,
    'Ad primum ergo dicendum quod,',
    'Ad secundum dicendum quod,',
    'Ad tertium dicendum quod,',
    'Ad quartum dicendum quod,',
    'Ad quintum dicendum quod,',
    'Ad sextum dicendum quod,',
    'Ad septimum dicendum quod,',
    'Ad octavum dicendum quod,',
    'Ad nonum dicendum quod,',
    'Ad decimum dicendum quod,'
  );
}

function stripLatinSedContraLead(text) {
  return stripPrefix(text, 'Sed contra est quod', 'Sed contra');
}

function stripSedContraLead(text) {
  return stripPrefix(text, 'On the contrary,', 'On the contrary.');
}

function ObjectionBlock({ objection, reply, article, onNavigate, resolveArticle, corpusData, bibleData, onOpenReference }) {
  const [open, setOpen] = useState(false);
  const [language, setLanguage] = useState('english');
  const showingLatin = language === 'latin';
  const hasLatin = Boolean(objection.latin || reply?.latin);

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
  const latinObjectionText = stripLatinObjectionLead(objection.latin);
  const latinReplyText = reply?.latin ? stripLatinReplyLead(reply.latin) : null;

  return (
    <div className="objection-block">
      <div className="objection-header" onClick={() => setOpen(o => !o)}>
        <span className="objection-label">Objection {objection.number}</span>
        <div className="objection-controls">
          {hasLatin ? (
            <LanguageToggle
              language={language}
              onChange={setLanguage}
              label={`Objection ${objection.number} language`}
            />
          ) : null}
          <button className="toggle-btn" type="button">
            {open ? 'hide reply ↑' : 'show reply ↓'}
          </button>
        </div>
      </div>
      <div className="objection-body">
        {showingLatin && latinObjectionText ? (
          <span className="latin-inline-text">{latinObjectionText}</span>
        ) : (
          <LinkedText text={objectionText} contextArticle={article} onNavigate={onNavigate} resolveArticle={resolveArticle} corpusData={corpusData} bibleData={bibleData} onOpenReference={onOpenReference} />
        )}
      </div>
      {open && reply && (
        <div className="reply-body">
          <div className="reply-label">Reply to Objection {reply.number}</div>
          <div>
            {showingLatin && latinReplyText ? (
              <span className="latin-inline-text">{latinReplyText}</span>
            ) : (
              <LinkedText text={replyText} contextArticle={article} onNavigate={onNavigate} resolveArticle={resolveArticle} corpusData={corpusData} bibleData={bibleData} onOpenReference={onOpenReference} />
            )}
          </div>
        </div>
      )}
      {open && !reply && (
        <div className="reply-body reply-missing">No reply recorded for this objection.</div>
      )}
    </div>
  );
}

function stripRespondeoLead(text) {
  return stripPrefix(text, 'I answer that,', 'I answer that.');
}

function stripLatinRespondeoLead(text) {
  return stripPrefix(text, 'Respondeo dicendum');
}

function SedContraSection({ article, onNavigate, resolveArticle, corpusData, bibleData, onOpenReference }) {
  const [language, setLanguage] = useState('english');
  const hasLatin = Boolean(article.sedContra?.latin);
  const showingLatin = hasLatin && language === 'latin';

  return (
    <div className="section">
      {hasLatin ? (
        <div className="section-header-row section-tools-only">
          {hasLatin ? (
            <LanguageToggle
              language={language}
            onChange={setLanguage}
              label="Sed contra language"
            />
          ) : null}
        </div>
      ) : null}
      <div className={`sed-contra ${showingLatin ? 'latin-inline-text' : ''}`}>
        <span className="argument-lead">
          {showingLatin ? 'Sed contra est quod' : 'On the contrary'}
        </span>
        {showingLatin ? (
          stripLatinSedContraLead(article.sedContra.latin)
        ) : (
          <LinkedText text={stripSedContraLead(article.sedContra.english)} contextArticle={article} onNavigate={onNavigate} resolveArticle={resolveArticle} corpusData={corpusData} bibleData={bibleData} onOpenReference={onOpenReference} />
        )}
      </div>
    </div>
  );
}

function RespondeoSection({ article, onNavigate, resolveArticle, corpusData, bibleData, onOpenReference }) {
  const [language, setLanguage] = useState('english');
  const hasLatin = Boolean(article.respondeo?.latin);
  const showingLatin = hasLatin && language === 'latin';

  return (
    <div className="section">
      {hasLatin ? (
        <div className="section-header-row section-tools-only">
          {hasLatin ? (
            <LanguageToggle
              language={language}
            onChange={setLanguage}
              label="Respondeo language"
            />
          ) : null}
        </div>
      ) : null}

      <div className={`respondeo ${showingLatin ? 'respondeo-latin' : ''}`}>
        <span className="argument-lead">
          {showingLatin ? 'Respondeo dicendum' : 'I answer that'}
        </span>
        {showingLatin ? (
          stripLatinRespondeoLead(article.respondeo.latin)
        ) : (
          <LinkedText
            text={stripRespondeoLead(article.respondeo.english)}
            contextArticle={article}
            onNavigate={onNavigate}
            resolveArticle={resolveArticle}
            corpusData={corpusData}
            bibleData={bibleData}
            onOpenReference={onOpenReference}
          />
        )}
      </div>
    </div>
  );
}

function QuestionPreface({ article, questionMeta }) {
  const prefaceLines = questionMeta?.preface?.english?.filter(Boolean) || [];
  const shouldShowPreface = article.article === 1 && prefaceLines.length > 0;

  if (!shouldShowPreface) return null;

  return (
    <section className="article-preface-block" aria-label="Question preface">
      <div className="article-preface-label">Before This Question</div>
      {prefaceLines.map(line => (
        <p key={line}>{line}</p>
      ))}
    </section>
  );
}

function QuestionProgress({ article, questionMeta }) {
  const articleCount = questionMeta?.articleCount || 0;
  if (!articleCount) return null;

  const currentArticle = Math.min(article.article, articleCount);
  const progress = Math.max(0, Math.min(100, (currentArticle / articleCount) * 100));

  return (
    <div className="question-progress" aria-label={`Article ${currentArticle} of ${articleCount} in this question`}>
      <div className="question-progress-meta">
        <span>Question progress</span>
        <span>{currentArticle}/{articleCount}</span>
      </div>
      <div className="question-progress-track">
        <div className="question-progress-fill" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

export default function ArticleView({ article, onNavigate, resolveArticle, previousArticle, nextArticle, adjacentContext, questionMeta, partNames, corpusData, bibleData, onOpenReference }) {
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
            data-tooltip={previousArticle ? `${previousArticle.part} Q.${previousArticle.question} A.${previousArticle.article}: ${previousArticle.title}` : null}
            aria-label={previousArticle ? `${previousArticle.part} Q.${previousArticle.question} A.${previousArticle.article}: ${previousArticle.title}` : 'No previous article'}
          >← Prev</button>
          <button
            className="nav-arrow"
            onClick={() => nextArticle && onNavigate(nextArticle.part, nextArticle.question, nextArticle.article)}
            disabled={!nextArticle}
            data-tooltip={nextArticle ? `${nextArticle.part} Q.${nextArticle.question} A.${nextArticle.article}: ${nextArticle.title}` : null}
            aria-label={nextArticle ? `${nextArticle.part} Q.${nextArticle.question} A.${nextArticle.article}: ${nextArticle.title}` : 'No next article'}
          >Next →</button>
        </div>
      </div>
      <QuestionProgress article={article} questionMeta={questionMeta} />

      <div className="article-content">
        <h2 className="article-title">{article.title}</h2>

        <QuestionPreface article={article} questionMeta={questionMeta} />

        <div className="article-reference-tables">
          <AuthorityTable article={article} />
          <StructuralNavigationTable adjacentContext={adjacentContext} onNavigate={onNavigate} />
          <CrossReferenceTable article={article} onNavigate={onNavigate} resolveArticle={resolveArticle} />
        </div>

        {article.objections?.length > 0 && (
          <div className="section">
            <div className="section-label">Objections & replies</div>
            {article.objections.map(obj => {
              const reply = article.replies?.find(r => r.number === obj.number);
              return <ObjectionBlock key={obj.number} objection={obj} reply={reply} article={article} onNavigate={onNavigate} resolveArticle={resolveArticle} corpusData={corpusData} bibleData={bibleData} onOpenReference={onOpenReference} />;
            })}
          </div>
        )}

        {article.sedContra?.english && (
          <SedContraSection article={article} onNavigate={onNavigate} resolveArticle={resolveArticle} corpusData={corpusData} bibleData={bibleData} onOpenReference={onOpenReference} />
        )}

        {article.respondeo?.english && (
          <RespondeoSection article={article} onNavigate={onNavigate} resolveArticle={resolveArticle} corpusData={corpusData} bibleData={bibleData} onOpenReference={onOpenReference} />
        )}
      </div>
    </div>
  );
}
