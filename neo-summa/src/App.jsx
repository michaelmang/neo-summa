import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSumma } from './hooks/useSumma';
import { PART_NAMES, PART_ORDER, PART_SCOPES } from './config/summa';
import { getAdjacentArticles, getOrderedArticles } from './lib/articles';
import { AUTHORITIES_PATH, CATALOG_PATH, HOME_PATH, SEARCH_PATH, articlePath, parseRoute } from './lib/routing';
import Sidebar from './components/Sidebar';
import AdvancedSearch from './components/AdvancedSearch';
import ArticleView from './components/ArticleView';
import AuthorityIndex from './components/AuthorityIndex';
import ErrorBoundary from './components/ErrorBoundary';
import QuestionCatalogue from './components/QuestionCatalogue';
import ReferencePanel from './components/ReferencePanel';
import WelcomeView from './components/WelcomeView';
import './App.css';

export default function App() {
  const { data, corpusData, bibleData, loading, getArticle, searchArticles, advancedSearchArticles } = useSumma();
  const [route, setRoute] = useState(() => parseRoute(window.location.pathname));
  const [hasAppHistory, setHasAppHistory] = useState(false);
  const [referencePanel, setReferencePanel] = useState(null);

  useEffect(() => {
    const handlePopState = () => setRoute(parseRoute(window.location.pathname));
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const pushRoute = useCallback((path) => {
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
      setHasAppHistory(true);
    }
    setRoute(parseRoute(path));
  }, []);

  const navigate = useCallback((part, question, article) => {
    const found = getArticle(part, question, article);
    if (found) {
      pushRoute(articlePath(part, question, article));
    }
  }, [getArticle, pushRoute]);

  const goHome = useCallback(() => pushRoute(HOME_PATH), [pushRoute]);

  const goBack = useCallback(() => {
    if (hasAppHistory) {
      window.history.back();
    } else {
      pushRoute(HOME_PATH);
    }
  }, [hasAppHistory, pushRoute]);

  const orderedArticles = useMemo(() => getOrderedArticles(data?.articles), [data]);

  if (loading) return (
    <div className="loading">
      <div className="loading-inner">
        <div className="loading-cross">✝</div>
        <p>Loading the Summa Theologica…</p>
      </div>
    </div>
  );

  const selected = route.type === 'reader' && route.articleRef
    ? getArticle(route.articleRef.part, route.articleRef.question, route.articleRef.article)
    : null;
  const adjacentArticles = getAdjacentArticles(orderedArticles, selected);
  const routeKey = selected ? selected.id : route.type;

  return (
    <div className="app">
      <header className="app-header">
        <button className="header-home-link" onClick={goHome}>
          <span className="header-cross">✝</span>
          <div>
            <h1 className="header-title">Summa Theologica</h1>
            <p className="header-sub">A new reader for the scholastic text</p>
          </div>
        </button>
        <div className="header-stats">
        </div>
      </header>

      <div className="app-body">
        <Sidebar
          data={data}
          selected={selected}
          view={route.type}
          onSelect={(art) => pushRoute(articlePath(art.part, art.question, art.article))}
          onShowAuthorities={() => pushRoute(AUTHORITIES_PATH)}
          onShowCatalog={() => pushRoute(CATALOG_PATH)}
          onShowSearch={() => pushRoute(SEARCH_PATH)}
          searchArticles={searchArticles}
          partNames={PART_NAMES}
          partScopes={PART_SCOPES}
        />

        <main className="main-content">
          <ErrorBoundary key={routeKey}>
            <MainView
              data={data}
              corpusData={corpusData}
              bibleData={bibleData}
              route={route}
              selected={selected}
              adjacentArticles={adjacentArticles}
              orderedArticles={orderedArticles}
              onNavigate={navigate}
              onBack={goBack}
              onShowAuthorities={() => pushRoute(AUTHORITIES_PATH)}
              onShowCatalog={() => pushRoute(CATALOG_PATH)}
              onShowSearch={() => pushRoute(SEARCH_PATH)}
              onAdvancedSearch={advancedSearchArticles}
              partNames={PART_NAMES}
              partOrder={PART_ORDER}
              getArticle={getArticle}
              onOpenReference={setReferencePanel}
            />
          </ErrorBoundary>
        </main>
        <ReferencePanel
          reference={referencePanel}
          corpusData={corpusData}
          onOpenReference={setReferencePanel}
          onClose={() => setReferencePanel(null)}
        />
      </div>
    </div>
  );
}

function MainView({ data, corpusData, bibleData, route, selected, adjacentArticles, orderedArticles, onNavigate, onBack, onShowAuthorities, onShowCatalog, onShowSearch, onAdvancedSearch, partNames, partOrder, getArticle, onOpenReference }) {
  if (route.type === 'authorities') {
    return (
      <AuthorityIndex
        data={data}
        onNavigate={onNavigate}
        onBack={onBack}
      />
    );
  }

  if (route.type === 'catalog') {
    return (
      <QuestionCatalogue
        data={data}
        partNames={partNames}
        onNavigate={onNavigate}
        onBack={onBack}
      />
    );
  }

  if (route.type === 'search') {
    return (
      <AdvancedSearch
        data={corpusData}
        partNames={partNames}
        onNavigate={onNavigate}
        onBack={onBack}
        onSearch={onAdvancedSearch}
      />
    );
  }

  if (selected) {
    return (
      <ArticleView
        article={selected}
        onNavigate={onNavigate}
        resolveArticle={getArticle}
        previousArticle={adjacentArticles.previousArticle}
        nextArticle={adjacentArticles.nextArticle}
        adjacentContext={getAdjacentContext(data, selected, orderedArticles, partOrder)}
        questionMeta={getQuestionMeta(data, selected)}
        partNames={partNames}
        corpusData={corpusData}
        bibleData={bibleData}
        onOpenReference={onOpenReference}
      />
    );
  }

  return (
    <WelcomeView
      data={data}
      partNames={partNames}
      partScopes={PART_SCOPES}
      onNavigate={onNavigate}
      onShowAuthorities={onShowAuthorities}
      onShowCatalog={onShowCatalog}
      onShowSearch={onShowSearch}
    />
  );
}

function getFirstArticleForPart(articles, part) {
  return articles.find(article => article.part === part);
}

function getLastArticleForPart(articles, part) {
  return articles.findLast(article => article.part === part);
}

function getAdjacentContext(data, selected, orderedArticles, partOrder) {
  if (!selected) return {};

  const articleIndex = orderedArticles.findIndex(article => article.id === selected.id);
  const partIndex = partOrder.indexOf(selected.part);
  const firstArticleOfPart = getFirstArticleForPart(orderedArticles, selected.part);
  const lastArticleOfPart = getLastArticleForPart(orderedArticles, selected.part);
  const isFirstArticleOfPart = firstArticleOfPart?.id === selected.id;
  const isLastArticleOfPart = lastArticleOfPart?.id === selected.id;
  const previousArticle = articleIndex > 0 && orderedArticles[articleIndex - 1].part === selected.part
    ? orderedArticles[articleIndex - 1]
    : null;
  const nextArticle = articleIndex >= 0 && articleIndex < orderedArticles.length - 1 && orderedArticles[articleIndex + 1].part === selected.part
    ? orderedArticles[articleIndex + 1]
    : null;
  const previousPart = isFirstArticleOfPart && partIndex > 0
    ? getFirstArticleForPart(orderedArticles, partOrder[partIndex - 1])
    : null;
  const nextPart = isLastArticleOfPart && partIndex >= 0 && partIndex < partOrder.length - 1
    ? getFirstArticleForPart(orderedArticles, partOrder[partIndex + 1])
    : null;

  return {
    previous: previousPart
      ? { label: 'Previous Part', article: previousPart }
      : previousArticle
        ? { label: 'Previous Article', article: previousArticle }
        : { label: 'Previous Part', article: null, emptyText: 'Beginning of the work' },
    next: nextPart
      ? { label: 'Next Part', article: nextPart }
      : nextArticle
        ? { label: 'Next Article', article: nextArticle }
        : { label: 'Next Part', article: null, emptyText: 'End of the work' }
  };
}

function getQuestionMeta(data, selected) {
  if (!data || !selected) return null;
  return data.meta.questions.find(question =>
    question.part === selected.part &&
    question.question === selected.question
  ) || null;
}
