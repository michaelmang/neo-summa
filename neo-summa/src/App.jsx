import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSumma } from './hooks/useSumma';
import { PART_NAMES, PART_ORDER, PART_SCOPES } from './config/summa';
import { canAccessApp, getAccessState, getCheckoutUrl, isLocalBypassAvailable, markPurchased, startTrial, verifyPurchasedAccess } from './lib/access';
import { getAdjacentArticles, getOrderedArticles } from './lib/articles';
import { AUTHORITIES_PATH, CATALOG_PATH, HOME_PATH, SEARCH_PATH, articlePath, parseRoute, questionPath } from './lib/routing';
import Sidebar from './components/Sidebar';
import AccessGate from './components/AccessGate';
import AdvancedSearch from './components/AdvancedSearch';
import ArticleView from './components/ArticleView';
import AuthorityIndex from './components/AuthorityIndex';
import ErrorBoundary from './components/ErrorBoundary';
import LandingPage from './components/LandingPage';
import QuestionCatalogue from './components/QuestionCatalogue';
import QuestionOverview from './components/QuestionOverview';
import ReferencePanel from './components/ReferencePanel';
import WelcomeView from './components/WelcomeView';
import './App.css';

export default function App() {
  const { data, corpusData, bibleData, loading, getArticle, searchArticles, advancedSearchArticles } = useSumma();
  const [route, setRoute] = useState(() => parseRoute(window.location.pathname));
  const [access, setAccess] = useState(getAccessState);
  const [checkoutNotice, setCheckoutNotice] = useState(false);
  const canBypassPaywall = useMemo(() => isLocalBypassAvailable(), []);
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

  const beginTrial = useCallback((email) => {
    setCheckoutNotice(false);
    setAccess(startTrial(email));
    pushRoute(HOME_PATH);
  }, [pushRoute]);

  const openCheckout = useCallback(() => {
    const checkoutUrl = getCheckoutUrl(access.email);
    if (!checkoutUrl) {
      setCheckoutNotice(true);
      return;
    }
    window.location.assign(checkoutUrl);
  }, [access.email]);

  const confirmPurchase = useCallback(async (email) => {
    const result = await verifyPurchasedAccess(email || access.email);
    if (!result.hasAccess) {
      return result;
    }

    setCheckoutNotice(false);
    setAccess(markPurchased(result.email));
    pushRoute(HOME_PATH);
    return result;
  }, [access.email, pushRoute]);

  const bypassPaywall = useCallback(() => {
    setCheckoutNotice(false);
    setAccess(markPurchased(access.email || 'local-testing@neo-summa.local'));
    pushRoute(HOME_PATH);
  }, [access.email, pushRoute]);

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

  if (route.type === 'landing') {
    return (
      <LandingPage
        access={access}
        checkoutNotice={checkoutNotice}
        onStartTrial={beginTrial}
        onOpenApp={() => pushRoute(HOME_PATH)}
        onCheckout={openCheckout}
      />
    );
  }

  if (!canAccessApp(access)) {
    return (
      <AccessGate
        access={access}
        checkoutNotice={checkoutNotice}
        onStartTrial={beginTrial}
        onCheckout={openCheckout}
        onConfirmPurchase={confirmPurchase}
        onBypassPaywall={bypassPaywall}
        canBypassPaywall={canBypassPaywall}
      />
    );
  }

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
          {access.isPurchased ? (
            <span>Lifetime Access</span>
          ) : access.isTrialActive ? (
            <span>{access.daysRemaining} trial day{access.daysRemaining === 1 ? '' : 's'} left</span>
          ) : null}
          {!access.isPurchased ? (
            <button className="header-purchase-btn" onClick={openCheckout}>Unlock $12</button>
          ) : null}
        </div>
      </header>

      <div className="app-body">
        <Sidebar
          data={data}
          selected={selected}
          view={route.type}
          onSelect={(art) => pushRoute(articlePath(art.part, art.question, art.article))}
          onSelectQuestion={(part, question) => pushRoute(questionPath(part, question))}
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
              onShowQuestion={(part, question) => pushRoute(questionPath(part, question))}
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

function MainView({ data, corpusData, bibleData, route, selected, adjacentArticles, orderedArticles, onNavigate, onBack, onShowAuthorities, onShowCatalog, onShowSearch, onShowQuestion, onAdvancedSearch, partNames, partOrder, getArticle, onOpenReference }) {
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
        onShowQuestion={onShowQuestion}
        onBack={onBack}
      />
    );
  }

  if (route.type === 'question' && route.questionRef) {
    const question = data.meta.questions.find(candidate =>
      candidate.part === route.questionRef.part &&
      candidate.question === route.questionRef.question
    );
    const articles = data.articles.filter(article =>
      article.part === route.questionRef.part &&
      article.question === route.questionRef.question
    );

    if (question) {
      return (
        <QuestionOverview
          question={question}
          articles={articles}
          partName={partNames[question.part] || question.part}
          onNavigate={onNavigate}
          onBack={onBack}
        />
      );
    }
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
      onShowQuestion={onShowQuestion}
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
